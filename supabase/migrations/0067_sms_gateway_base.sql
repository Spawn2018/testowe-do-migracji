-- =====================================================================
-- TOWER — Migracja 0067: I-3 (część bazowa) — bramka SMS: kolejka, telefon PULL, strażnik, e-mail zastępczy
--
--   Według PROPOZYCJA_SMS.md §3 (model PULL bez serwera pośredniego; token urządzenia, nigdy service_role):
--     • sms_devices (token tylko jako SHA-256, limit dzienny, pauza), sms_heartbeats (7 dni), sms_outbox (kolejka);
--     • telefon (anon, token urządzenia w nagłówku x-device-token albo p_token): sms_pull, sms_report, sms_heartbeat;
--     • HHL: sms_issue_device (token jawny raz — kod QR), sms_revoke_device, sms_set_paused;
--     • issue_driver_token_sms(load) — token kierowcy + SMS z linkiem w JEDNEJ transakcji (token jawny istnieje tylko wtedy);
--     • wyzwalacze SMS niezbędnych (PROPOZYCJA §4 poz. 2–5): WINDOW_CHANGE (≥ 30 min), SAILING_CHANGE (zmiana rejsu
--       albo opóźnienie odejścia ≥ 30 min), SAILING_CANCELLED, LOAD_CANCELLED — tylko dla transportów z linkiem kierowcy;
--     • sms_watchdog() co minutę: cisza bramki > 15 min → ryzyko JOB_FAILURE HIGH + e-mail do HHL; SMS niewysłany
--       w 10 min albo FAILED → e-mail zastępczy (notifications EMAIL, SMS_FALLBACK) do osoby, która wywołała,
--       a dla zdarzeń automatycznych do HHL i dyspozytorów przewoźnika; przeterminowane → EXPIRED; czyszczenie linku
--       z treści po 24 h; retencja 90 dni (jak dane kierowcy) i 7 dni heartbeat.
--   Treść wyłącznie z zamkniętych szablonów (PL bez polskich znaków — GSM-7), język z loads.driver_locale albo
--   z prefiksu numeru (+48 pl, +46 sv, inne en). Zakaz cen: CHECK na treści. SMS nigdy w trybie demo (I-2h):
--   numery demo (pula PTS) nie są w loads.driver_phone produkcji; telefonu bramki jeszcze nie ma (D-4).
--   Idempotentna i niedestrukcyjna.
-- =====================================================================

alter table loads add column if not exists driver_locale char(2) check (driver_locale in ('pl', 'en', 'sv'));

do $$ begin
  if not exists (select 1 from pg_type where typname = 'sms_status') then
    create type sms_status as enum ('QUEUED', 'CLAIMED', 'SENT', 'DELIVERED', 'FAILED', 'EXPIRED', 'CANCELLED');
  end if;
end $$;

create table if not exists sms_devices (
  id            uuid primary key default gen_random_uuid(),
  label         text not null check (length(trim(label)) between 2 and 80),
  token_hash    bytea not null unique,
  created_by    uuid references app_users(id),
  created_at    timestamptz not null default now(),
  revoked_at    timestamptz,
  paused        boolean not null default false,
  last_seen_at  timestamptz,
  last_info     jsonb,
  day_date      date not null default current_date,
  day_sent      int  not null default 0,
  day_limit     int  not null default 150 check (day_limit between 0 and 1000),
  minute_start  timestamptz not null default now(),
  minute_calls  int  not null default 0
);

create table if not exists sms_heartbeats (
  id         bigserial primary key,
  device_id  uuid not null references sms_devices(id) on delete cascade,
  at         timestamptz not null default now(),
  info       jsonb
);
create index if not exists sms_heartbeats_device_at on sms_heartbeats (device_id, at desc);

create table if not exists sms_outbox (
  id              uuid primary key default gen_random_uuid(),
  kind            text not null check (kind in ('DRIVER_LINK', 'WINDOW_CHANGE', 'SAILING_CHANGE', 'SAILING_CANCELLED', 'LOAD_CANCELLED', 'TEST')),
  load_id         uuid references loads(id) on delete set null,
  to_e164         text not null check (to_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  locale          char(2) not null check (locale in ('pl', 'en', 'sv')),
  body            text not null check (char_length(body) <= 306),
  contains_secret boolean not null default false,
  priority        smallint not null default 50,
  status          sms_status not null default 'QUEUED',
  dedup_key       text unique,
  created_by      uuid references app_users(id),
  created_at      timestamptz not null default now(),
  not_before      timestamptz not null default now(),
  expires_at      timestamptz not null default now() + interval '6 hours',
  device_id       uuid references sms_devices(id),
  claimed_at      timestamptz,
  attempts        smallint not null default 0,
  parts           smallint,
  sent_at         timestamptz,
  delivered_at    timestamptz,
  error           text,
  fallback_at     timestamptz,
  constraint sms_outbox_no_prices check (body !~* '(EUR|PLN|SEK|zł|€|\mkr\M)')
);
create index if not exists sms_outbox_queue on sms_outbox (status, priority desc, created_at) where status in ('QUEUED', 'CLAIMED');
create index if not exists sms_outbox_load on sms_outbox (load_id, created_at desc);

alter table sms_devices enable row level security;
alter table sms_heartbeats enable row level security;
alter table sms_outbox enable row level security;
revoke all on sms_devices, sms_heartbeats, sms_outbox from anon, authenticated;
-- UI: HHL czyta kolejkę i urządzenia (bez skrótu tokenu); telefon nie ma dostępu do tabel, tylko do funkcji
grant select on sms_outbox to authenticated;
grant select (id, label, created_at, revoked_at, paused, last_seen_at, last_info, day_date, day_sent, day_limit) on sms_devices to authenticated;
drop policy if exists sms_outbox_read on sms_outbox;
create policy sms_outbox_read on sms_outbox for select to authenticated using (is_hhl());
drop policy if exists sms_devices_read on sms_devices;
create policy sms_devices_read on sms_devices for select to authenticated using (is_hhl());

-- ---------------------------------------------------------------- szablony
create or replace function sms_locale_for(p_phone text, p_locale text) returns char(2)
language sql immutable set search_path = public as $$
  select coalesce(case when p_locale in ('pl', 'en', 'sv') then p_locale end,
                  case when p_phone like '+48%' then 'pl' when p_phone like '+46%' then 'sv' else 'en' end)::char(2)
$$;

create or replace function sms_render(p_kind text, p_locale text, p jsonb) returns text
language plpgsql immutable set search_path = public as $$
declare t text; k text;
begin
  t := case p_kind || ':' || p_locale
    when 'DRIVER_LINK:pl' then 'TOWER {nr}: link kierowcy {url} Nie udostepniaj.'
    when 'DRIVER_LINK:en' then 'TOWER {nr}: driver link {url} Do not share.'
    when 'DRIVER_LINK:sv' then 'TOWER {nr}: förarlänk {url} Dela inte.'
    when 'WINDOW_CHANGE:pl' then 'TOWER {nr}: ZMIANA okna {okno_pl}: {dt}-{t2} (czas lokalny). Szczegoly w linku TOWER z pierwszego SMS.'
    when 'WINDOW_CHANGE:en' then 'TOWER {nr}: CHANGED {okno_en} window: {dt}-{t2} (local time). Details in your TOWER link from the first SMS.'
    when 'WINDOW_CHANGE:sv' then 'TOWER {nr}: ÄNDRAT {okno_sv}: {dt}-{t2} (lokal tid). Detaljer i din TOWER-länk från första SMS:et.'
    when 'SAILING_CHANGE:pl' then 'TOWER {nr}: ZMIANA PROMU: {statek}, Gdansk {dt}, rezerwacja {ref}. Szczegoly w linku TOWER.'
    when 'SAILING_CHANGE:en' then 'TOWER {nr}: FERRY CHANGED: {statek}, Gdansk {dt}, booking {ref}. Details in your TOWER link.'
    when 'SAILING_CHANGE:sv' then 'TOWER {nr}: NY FÄRJA: {statek}, Gdansk {dt}, bokning {ref}. Detaljer i din TOWER-länk.'
    when 'SAILING_CANCELLED:pl' then 'TOWER {nr}: PROM {statek} {dt} ODWOLANY. Czekaj na nowy rejs od dyspozytora. Nowe dane pojawia sie w linku TOWER.'
    when 'SAILING_CANCELLED:en' then 'TOWER {nr}: FERRY {statek} {dt} CANCELLED. Wait for a new sailing from your dispatcher. It will appear in your TOWER link.'
    when 'SAILING_CANCELLED:sv' then 'TOWER {nr}: FÄRJA {statek} {dt} INSTÄLLD. Vänta på ny avgång från din disponent. Den visas i din TOWER-länk.'
    when 'LOAD_CANCELLED:pl' then 'TOWER {nr}: TRANSPORT ANULOWANY. Link TOWER jest nieaktywny. Pytania: dyspozytor przewoznika.'
    when 'LOAD_CANCELLED:en' then 'TOWER {nr}: TRANSPORT CANCELLED. Your TOWER link is no longer active. Questions: your dispatcher.'
    when 'LOAD_CANCELLED:sv' then 'TOWER {nr}: TRANSPORT INSTÄLLD. Din TOWER-länk är inte längre aktiv. Frågor: din disponent.'
    when 'TEST:pl' then 'TOWER: SMS testowy bramki.'
    when 'TEST:en' then 'TOWER: gateway test SMS.'
    when 'TEST:sv' then 'TOWER: test-SMS från gatewayen.'
  end;
  if t is null then raise exception 'Nieznany szablon SMS: % / %', p_kind, p_locale; end if;
  if p ? 'okno' then
    p := p || case p->>'okno' when 'LOAD' then '{"okno_pl":"zaladunku","okno_en":"loading","okno_sv":"lastningsfönster"}'::jsonb
                              else '{"okno_pl":"rozladunku","okno_en":"unloading","okno_sv":"lossningsfönster"}'::jsonb end;
  end if;
  for k in select jsonb_object_keys(p) loop
    t := replace(t, '{' || k || '}', coalesce(left(p->>k, 120), ''));
  end loop;
  if t ~ '\{[a-z0-9_]+\}' then raise exception 'Szablon SMS % bez wartości: %', p_kind, substring(t from '\{[a-z0-9_]+\}'); end if;
  return t;
end $$;

-- wewnętrzne: zakolejkowanie (bez EXECUTE dla ról API)
create or replace function sms_enqueue(p_kind text, p_load uuid, p_to text, p_locale text, p jsonb,
                                       p_priority int default 100, p_dedup text default null, p_secret boolean default false)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_loc char(2);
begin
  if (p_to ~ '^\+[1-9][0-9]{7,14}$') is not true then return null; end if;  -- brak/niepoprawny numer: nic do wysłania
  v_loc := sms_locale_for(p_to, p_locale);
  insert into sms_outbox (kind, load_id, to_e164, locale, body, contains_secret, priority, dedup_key, created_by)
  values (p_kind, p_load, p_to, v_loc, sms_render(p_kind, v_loc, p), p_secret, p_priority, p_dedup,
          (select id from app_users where auth_id = auth.uid() and active))
  on conflict (dedup_key) do nothing
  returning id into v_id;
  return v_id;
end $$;
revoke all on function sms_enqueue(text, uuid, text, text, jsonb, int, text, boolean) from public, anon, authenticated;
revoke all on function sms_render(text, text, jsonb) from public, anon, authenticated;
revoke all on function sms_locale_for(text, text) from public, anon, authenticated;

create or replace function sms_fmt_dt(p timestamptz) returns text
language sql stable set search_path = public as $$
  select to_char(p at time zone 'Europe/Warsaw', 'DD.MM HH24:MI')
$$;
revoke all on function sms_fmt_dt(timestamptz) from public, anon, authenticated;

-- link kierowcy + SMS w jednej transakcji
create or replace function issue_driver_token_sms(p_load_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_token text; v_load loads%rowtype; v_sms uuid;
begin
  if (current_app_user_id() is not null) is not true then
    raise exception 'Brak aktywnego konta' using errcode = '42501';
  end if;
  select * into v_load from loads where id = p_load_id;
  if (found and v_load.driver_phone ~ '^\+[1-9][0-9]{7,14}$') is not true then
    raise exception 'Brak numeru telefonu kierowcy (format E.164, np. +48…) — link można tylko skopiować' using errcode = '22023';
  end if;
  v_token := issue_driver_token(p_load_id);   -- własna kontrola uprawnień (przewoźnik transportu albo HHL)
  v_sms := sms_enqueue('DRIVER_LINK', p_load_id, v_load.driver_phone, v_load.driver_locale,
                       jsonb_build_object('nr', coalesce(v_load.order_no, '—'), 'url', 'https://tower.log-mar.pl/#/driver/' || v_token),
                       100, null, true);
  return jsonb_build_object('token', v_token, 'sms_id', v_sms);
end $$;
revoke all on function issue_driver_token_sms(uuid) from public, anon;
grant execute on function issue_driver_token_sms(uuid) to authenticated;

-- ---------------------------------------------------------------- telefon (anon)
create or replace function sms_device_auth(p_token text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_tok text; d sms_devices%rowtype;
begin
  v_tok := coalesce(nullif(p_token, ''), current_setting('request.headers', true)::json->>'x-device-token');
  if (length(v_tok) between 32 and 200) is not true then
    raise exception 'Brak tokenu urządzenia' using errcode = '42501';
  end if;
  select * into d from sms_devices where token_hash = driver_token_hash(v_tok) for update;
  if (found and d.revoked_at is null) is not true then
    raise exception 'Nieznane albo odwołane urządzenie' using errcode = '42501';
  end if;
  if d.minute_start < now() - interval '1 minute' then
    update sms_devices set minute_start = now(), minute_calls = 1, last_seen_at = now() where id = d.id;
  elsif d.minute_calls >= 20 then
    raise exception 'Limit wywołań urządzenia (20/min)' using errcode = '54000';
  else
    update sms_devices set minute_calls = minute_calls + 1, last_seen_at = now() where id = d.id;
  end if;
  if d.day_date <> current_date then
    update sms_devices set day_date = current_date, day_sent = 0 where id = d.id;
  end if;
  return d.id;
end $$;
revoke all on function sms_device_auth(text) from public, anon, authenticated;

create or replace function sms_pull(p_token text default null, p_limit int default 5)
returns table (id uuid, to_e164 text, body text, attempts smallint, expires_at timestamptz)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare v_dev uuid; v_left int; v_paused boolean;
begin
  v_dev := sms_device_auth(p_token);
  -- zawieszone (CLAIMED > 3 min bez raportu): powrót do kolejki, po 3 próbach FAILED
  update sms_outbox o set status = case when o.attempts >= 3 then 'FAILED'::sms_status else 'QUEUED'::sms_status end,
         error = case when o.attempts >= 3 then 'brak raportu z telefonu po 3 próbach' else o.error end
   where o.status = 'CLAIMED' and o.claimed_at < now() - interval '3 minutes';
  select greatest(day_limit - day_sent, 0), paused into v_left, v_paused from sms_devices where id = v_dev;
  if v_paused then return; end if;
  return query
  with c as (
    select o.id from sms_outbox o
     where o.status = 'QUEUED' and o.not_before <= now() and o.expires_at > now()
     order by o.priority desc, o.created_at
     limit least(greatest(coalesce(p_limit, 5), 0), 5, v_left)
     for update skip locked)
  update sms_outbox o set status = 'CLAIMED', device_id = v_dev, claimed_at = now(), attempts = o.attempts + 1
    from c where o.id = c.id
  returning o.id, o.to_e164, o.body, o.attempts, o.expires_at;
end $$;

create or replace function sms_report(p_token text default null, p_id uuid default null, p_status text default null,
                                      p_error text default null, p_parts int default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_dev uuid; o sms_outbox%rowtype;
begin
  v_dev := sms_device_auth(p_token);
  select * into o from sms_outbox where id = p_id for update;
  if (found and o.device_id = v_dev) is not true then
    raise exception 'Wiadomość nie należy do tego urządzenia' using errcode = '42501';
  end if;
  if o.status::text = p_status then return; end if;                       -- powtórzony raport: bez błędu
  if ((o.status = 'CLAIMED' and p_status in ('SENT', 'FAILED'))
      or (o.status = 'SENT' and p_status in ('DELIVERED', 'FAILED'))) is not true then
    raise exception 'Niedozwolone przejście % → %', o.status, coalesce(p_status, '∅') using errcode = '22023';
  end if;
  update sms_outbox set status = p_status::sms_status,
         sent_at = case when p_status = 'SENT' then now() else sent_at end,
         delivered_at = case when p_status = 'DELIVERED' then now() else delivered_at end,
         parts = coalesce(least(greatest(p_parts, 1), 10)::smallint, parts),
         error = case when p_status = 'FAILED' then left(coalesce(p_error, 'błąd bez kodu'), 300) else error end
   where id = p_id;
  if p_status = 'SENT' then
    update sms_devices set day_sent = day_sent + 1 where id = v_dev;
  end if;
end $$;

create or replace function sms_heartbeat(p_token text default null, p_info jsonb default '{}')
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_dev uuid; d sms_devices%rowtype;
begin
  v_dev := sms_device_auth(p_token);
  update sms_devices set last_info = left(coalesce(p_info, '{}')::text, 2000)::jsonb where id = v_dev returning * into d;
  if not exists (select 1 from sms_heartbeats where device_id = v_dev and at > now() - interval '30 seconds') then
    insert into sms_heartbeats (device_id, info) values (v_dev, d.last_info);
  end if;
  return jsonb_build_object('poll_s', 15, 'day_limit', d.day_limit, 'day_sent', d.day_sent, 'paused', d.paused);
end $$;
revoke all on function sms_pull(text, int) from public, authenticated;
revoke all on function sms_report(text, uuid, text, text, int) from public, authenticated;
revoke all on function sms_heartbeat(text, jsonb) from public, authenticated;
grant execute on function sms_pull(text, int) to anon;
grant execute on function sms_report(text, uuid, text, text, int) to anon;
grant execute on function sms_heartbeat(text, jsonb) to anon;

-- ---------------------------------------------------------------- HHL: urządzenia
create or replace function sms_issue_device(p_label text) returns text
language plpgsql security definer set search_path = public as $$
declare v_tok text; v_me uuid;
begin
  if (is_hhl()) is not true then raise exception 'Urządzenia bramki SMS zarządza wyłącznie HHL' using errcode = '42501'; end if;
  v_me := current_app_user_id();
  v_tok := 'sd_' || encode(uuid_send(gen_random_uuid()) || uuid_send(gen_random_uuid()), 'hex');
  insert into sms_devices (label, token_hash, created_by) values (trim(p_label), driver_token_hash(v_tok), v_me);
  insert into audit_log (user_id, action, entity, entity_id, new_value)
  values (v_me, 'SMS_DEVICE_ISSUE', 'sms_devices', trim(p_label), jsonb_build_object('label', trim(p_label)));
  return v_tok;
end $$;

create or replace function sms_revoke_device(p_id uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_me uuid;
begin
  if (is_hhl()) is not true then raise exception 'Urządzenia bramki SMS zarządza wyłącznie HHL' using errcode = '42501'; end if;
  v_me := current_app_user_id();
  update sms_devices set revoked_at = now() where id = p_id and revoked_at is null;
  if not found then return false; end if;
  update sms_outbox set status = 'QUEUED', device_id = null where device_id = p_id and status = 'CLAIMED';
  insert into audit_log (user_id, action, entity, entity_id) values (v_me, 'SMS_DEVICE_REVOKE', 'sms_devices', p_id::text);
  return true;
end $$;

create or replace function sms_set_paused(p_id uuid, p_paused boolean) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if (is_hhl()) is not true then raise exception 'Urządzenia bramki SMS zarządza wyłącznie HHL' using errcode = '42501'; end if;
  update sms_devices set paused = coalesce(p_paused, false) where id = p_id and revoked_at is null;
  insert into audit_log (user_id, action, entity, entity_id, new_value)
  values (current_app_user_id(), 'SMS_DEVICE_PAUSE', 'sms_devices', p_id::text, jsonb_build_object('paused', coalesce(p_paused, false)));
  return found;
end $$;
revoke all on function sms_issue_device(text) from public, anon;
revoke all on function sms_revoke_device(uuid) from public, anon;
revoke all on function sms_set_paused(uuid, boolean) from public, anon;
grant execute on function sms_issue_device(text) to authenticated;
grant execute on function sms_revoke_device(uuid) to authenticated;
grant execute on function sms_set_paused(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------- wyzwalacze SMS niezbędnych (2–5)
create or replace function sms_has_driver_link(p_load uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from driver_tokens t where t.load_id = p_load
                  and (t.revoked_at is null or t.revoked_at > now() - interval '1 minute') and t.expires_at > now())
$$;
revoke all on function sms_has_driver_link(uuid) from public, anon, authenticated;

create or replace function trg_sms_load_changes() returns trigger
language plpgsql security definer set search_path = public as $$
declare s record; v_nr text;
begin
  if (new.driver_phone is not null and sms_has_driver_link(new.id)) is not true then return new; end if;
  v_nr := coalesce(new.order_no, '—');
  if new.status = 'CANCELLED' and old.status is distinct from 'CANCELLED' then
    perform sms_enqueue('LOAD_CANCELLED', new.id, new.driver_phone, new.driver_locale, jsonb_build_object('nr', v_nr),
                        100, 'LOAD_CANCELLED:' || new.id);
    return new;
  end if;
  if new.status in ('CANCELLED', 'UNLOADED', 'DELIVERED') then return new; end if;
  if new.plan_load_from is not null and new.plan_load_to is not null
     and (abs(extract(epoch from (new.plan_load_from - coalesce(old.plan_load_from, new.plan_load_from)))) >= 1800
          or abs(extract(epoch from (new.plan_load_to - coalesce(old.plan_load_to, new.plan_load_to)))) >= 1800)
     and new.status in ('PLANNED', 'RESOURCES_PENDING', 'DOCS_PENDING', 'READY') then
    perform sms_enqueue('WINDOW_CHANGE', new.id, new.driver_phone, new.driver_locale,
      jsonb_build_object('nr', v_nr, 'okno', 'LOAD', 'dt', sms_fmt_dt(new.plan_load_from), 't2', to_char(new.plan_load_to at time zone 'Europe/Warsaw', 'HH24:MI')),
      100, 'WINDOW_CHANGE:LOAD:' || new.id || ':' || new.plan_load_from || ':' || new.plan_load_to);
  end if;
  if new.plan_delivery_from is not null and new.plan_delivery_to is not null
     and (abs(extract(epoch from (new.plan_delivery_from - coalesce(old.plan_delivery_from, new.plan_delivery_from)))) >= 1800
          or abs(extract(epoch from (new.plan_delivery_to - coalesce(old.plan_delivery_to, new.plan_delivery_to)))) >= 1800) then
    perform sms_enqueue('WINDOW_CHANGE', new.id, new.driver_phone, new.driver_locale,
      jsonb_build_object('nr', v_nr, 'okno', 'DELIVERY', 'dt', sms_fmt_dt(new.plan_delivery_from), 't2', to_char(new.plan_delivery_to at time zone 'Europe/Warsaw', 'HH24:MI')),
      100, 'WINDOW_CHANGE:DELIVERY:' || new.id || ':' || new.plan_delivery_from || ':' || new.plan_delivery_to);
  end if;
  if new.sailing_id is distinct from old.sailing_id and new.sailing_id is not null then
    select v.name as statek, coalesce(sa.delayed_departure_at, sa.departure_at) as dep into s
      from sailings sa left join vessels v on v.id = sa.vessel_id where sa.id = new.sailing_id;
    perform sms_enqueue('SAILING_CHANGE', new.id, new.driver_phone, new.driver_locale,
      jsonb_build_object('nr', v_nr, 'statek', coalesce(s.statek, '—'), 'dt', coalesce(sms_fmt_dt(s.dep), '—'), 'ref', coalesce(new.ferry_booking_ref, '—')),
      100, 'SAILING_CHANGE:' || new.id || ':' || new.sailing_id || ':' || coalesce(s.dep::text, ''));
  end if;
  return new;
end $$;
revoke all on function trg_sms_load_changes() from public, anon, authenticated;
drop trigger if exists trg_loads_sms on loads;
create trigger trg_loads_sms after update of status, plan_load_from, plan_load_to, plan_delivery_from, plan_delivery_to, sailing_id on loads
  for each row execute function trg_sms_load_changes();

create or replace function trg_sms_sailing_changes() returns trigger
language plpgsql security definer set search_path = public as $$
declare l record; v_name text; v_dep timestamptz;
begin
  select name into v_name from vessels where id = new.vessel_id;
  v_dep := coalesce(new.delayed_departure_at, new.departure_at);
  for l in select * from loads where sailing_id = new.id and driver_phone is not null
             and status in ('PLANNED', 'RESOURCES_PENDING', 'DOCS_PENDING', 'READY', 'AT_LOADING', 'IN_TRANSIT_PL', 'AT_PORT_GDANSK') loop
    if (sms_has_driver_link(l.id)) is not true then continue; end if;
    if new.status = 'ODWOLANY' and old.status is distinct from 'ODWOLANY' then
      perform sms_enqueue('SAILING_CANCELLED', l.id, l.driver_phone, l.driver_locale,
        jsonb_build_object('nr', coalesce(l.order_no, '—'), 'statek', coalesce(v_name, '—'), 'dt', coalesce(sms_fmt_dt(new.departure_at), '—')),
        100, 'SAILING_CANCELLED:' || l.id || ':' || new.id);
    elsif new.status <> 'ODWOLANY' and abs(extract(epoch from (v_dep - coalesce(old.delayed_departure_at, old.departure_at)))) >= 1800 then
      perform sms_enqueue('SAILING_CHANGE', l.id, l.driver_phone, l.driver_locale,
        jsonb_build_object('nr', coalesce(l.order_no, '—'), 'statek', coalesce(v_name, '—'), 'dt', coalesce(sms_fmt_dt(v_dep), '—'), 'ref', coalesce(l.ferry_booking_ref, '—')),
        100, 'SAILING_CHANGE:' || l.id || ':' || new.id || ':' || v_dep);
    end if;
  end loop;
  return new;
end $$;
revoke all on function trg_sms_sailing_changes() from public, anon, authenticated;
drop trigger if exists trg_sailings_sms on sailings;
create trigger trg_sailings_sms after update of status, departure_at, delayed_departure_at on sailings
  for each row execute function trg_sms_sailing_changes();

-- ---------------------------------------------------------------- strażnik (co minutę)
create or replace function sms_watchdog(p_now timestamptz default now()) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_seen timestamptz; v_active int; v_queued int; v_silent boolean; v_proj record; v_key text; v_new int := 0;
  o record; r record; v_fb int := 0; v_exp int; v_scrub int; v_purge int;
begin
  select max(last_seen_at), count(*) into v_seen, v_active from sms_devices where revoked_at is null;
  select count(*) into v_queued from sms_outbox where status in ('QUEUED', 'CLAIMED');
  v_silent := (v_active > 0 and (v_seen is null or v_seen < p_now - interval '15 minutes')) or (v_active = 0 and v_queued > 0);
  for v_proj in select id from projects loop
    v_key := 'sms-gateway:' || v_proj.id;
    if v_silent then
      if not exists (select 1 from risk_signals where dedup_key = v_key and resolved_at is null) then
        insert into risk_signals (project_id, kind, severity, title, title_key, detail, dedup_key, detected_at)
        values (v_proj.id, 'JOB_FAILURE', 'HIGH', 'Bramka SMS milczy', 'rk_job_failure',
          jsonb_build_object('job', 'sms-gateway', 'ostatni_sygnal', v_seen, 'kolejka', v_queued,
            'text', 'Brak sygnału telefonu-bramki od ' || coalesce(to_char(v_seen at time zone 'Europe/Warsaw', 'DD.MM.YYYY HH24:MI'), 'początku') || ' (próg 15 min); SMS w kolejce: ' || v_queued,
            'next_action', 'Sprawdź telefon-bramkę (zasilanie, Wi-Fi, aplikacja TOWER SMS). SMS starsze niż 10 min idą e-mailem zastępczym.',
            'params', jsonb_build_object('label', 'bramka SMS', 'label_key', 'job_label_sms_gateway',
              'since', coalesce(to_char(v_seen at time zone 'Europe/Warsaw', 'DD.MM.YYYY HH24:MI'), ''), 'window', '15 minutes'),
            'text_key', case when v_seen is null then 'rk_job_failure_text_never' else 'rk_job_failure_text' end,
            'next_action_key', 'rk_job_failure_next'),
          v_key, p_now);
        v_new := v_new + 1;
        insert into notifications (channel, recipient, user_id, template, payload, dedup_key)
        select 'EMAIL', u.email, u.id, 'SMS_GATEWAY_SILENT',
               jsonb_build_object('since', to_char(v_seen at time zone 'Europe/Warsaw', 'DD.MM.YYYY HH24:MI'), 'queued', v_queued),
               'smsgw:' || v_proj.id || ':' || u.id || ':' || to_char(p_now, 'YYYYMMDDHH24MI')
          from app_users u where u.active and u.role = 'HHL_ADMIN' and u.email is not null
        on conflict do nothing;
      end if;
    else
      update risk_signals set resolved_at = p_now where dedup_key = v_key and resolved_at is null;
    end if;
  end loop;

  -- przeterminowane (przed fallbackiem: nieaktualna zmiana nie idzie nawet e-mailem)
  update sms_outbox set status = 'EXPIRED' where status in ('QUEUED', 'CLAIMED') and expires_at <= p_now;
  get diagnostics v_exp = row_count;

  -- e-mail zastępczy: niewysłany w 10 min albo FAILED
  for o in select s.*, l.order_no, l.carrier_org_id from sms_outbox s left join loads l on l.id = s.load_id
            where s.fallback_at is null
              and ((s.status in ('QUEUED', 'CLAIMED') and s.created_at < p_now - interval '10 minutes') or s.status = 'FAILED')
            for update of s skip locked loop
    for r in
      select u.id, u.email from app_users u where u.active and u.email is not null and u.id = o.created_by
      union
      select u.id, u.email from app_users u
       where o.created_by is null and u.active and u.email is not null
         and (u.role in ('HHL_ADMIN', 'HHL_OPS') or (o.carrier_org_id is not null and u.org_id = o.carrier_org_id and u.role = 'CARRIER_DISPATCH'))
    loop
      insert into notifications (channel, recipient, user_id, load_id, template, payload, dedup_key)
      values ('EMAIL', r.email, r.id, o.load_id, 'SMS_FALLBACK',
              jsonb_build_object('kind', o.kind, 'code', coalesce(o.order_no, '—'), 'to_tail', right(o.to_e164, 3),
                                 'status', o.status, 'error', o.error, 'text', o.body),
              'smsfb:' || o.id || ':' || r.id)
      on conflict do nothing;
    end loop;
    update sms_outbox set fallback_at = p_now where id = o.id;
    v_fb := v_fb + 1;
  end loop;

  -- link w treści: usuwany 24 h po wysłaniu albo po FAILED/EXPIRED/CANCELLED
  update sms_outbox set body = '[link usunięty]'
   where contains_secret and body <> '[link usunięty]'
     and ((status in ('SENT', 'DELIVERED') and sent_at < p_now - interval '24 hours')
          or (status in ('FAILED', 'EXPIRED', 'CANCELLED') and coalesce(fallback_at, created_at) < p_now - interval '24 hours'));
  get diagnostics v_scrub = row_count;
  delete from sms_heartbeats where at < p_now - interval '7 days';
  delete from sms_outbox where created_at < p_now - interval '90 days';
  get diagnostics v_purge = row_count;
  return jsonb_build_object('cisza', v_silent, 'nowe_ryzyka', v_new, 'kolejka', v_queued, 'fallback', v_fb,
                            'przeterminowane', v_exp, 'wyczyszczone_linki', v_scrub, 'usuniete_90d', v_purge);
end $$;
revoke all on function sms_watchdog(timestamptz) from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'tower-sms-straznik';
    perform cron.schedule('tower-sms-straznik', '* * * * *', 'select public.sms_watchdog()');
  end if;
end $$;
