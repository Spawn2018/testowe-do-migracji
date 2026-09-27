-- =====================================================================
-- TOWER — Migracja 0069: I-3 P0 (właściciel 28.09) — SMS 8 (brak GPS) i 9 (prośba o potwierdzenie rozładunku);
--   link kierowcy nigdy w sms_outbox.body
--
--   • sms_outbox.kind: + GPS_SILENT, UNLOAD_CONFIRM (pilotaż: 1–5, 8, 9 — ZLECENIE_ETAP_I, D-19);
--   • GPS_SILENT: nowe ryzyko SILENT_VEHICLE dla transportu w ruchu z aktywnym linkiem kierowcy — najwyżej 1 SMS na 3 h;
--   • UNLOAD_CONFIRM: status AT_SITE od ≥ 2 h bez MILESTONE_UNLOADED (rozładunek ustala datę usługi i kurs faktury) —
--     jeden SMS na transport; skan co 10 min (pg_cron tower-sms-rozladunek);
--   • treść z tokenem trzymana osobno w sms_outbox_secret (brak dostępu dla ról API, poza kopią zapasową);
--     sms_outbox.body ma zawsze „[link usunięty]” w miejscu linku — HHL, e-mail zastępczy i kopia nie widzą tokenu;
--     sekret kasowany natychmiast, gdy status opuszcza QUEUED/CLAIMED (SENT, FAILED, EXPIRED, CANCELLED);
--     sms_pull podaje telefonowi pełną treść.
--   Idempotentna.
-- =====================================================================
alter table sms_outbox drop constraint if exists sms_outbox_kind_check;
alter table sms_outbox add constraint sms_outbox_kind_check check (kind in
  ('DRIVER_LINK', 'WINDOW_CHANGE', 'SAILING_CHANGE', 'SAILING_CANCELLED', 'LOAD_CANCELLED', 'GPS_SILENT', 'UNLOAD_CONFIRM', 'TEST'));

create table if not exists sms_outbox_secret (
  sms_id uuid primary key references sms_outbox(id) on delete cascade,
  body   text not null check (char_length(body) <= 306)
);
alter table sms_outbox_secret enable row level security;
revoke all on sms_outbox_secret from anon, authenticated;

-- istniejące wiersze z linkiem (produkcja 28.09: 0) — przeniesienie sekretu i maskowanie treści
insert into sms_outbox_secret (sms_id, body)
select id, body from sms_outbox where contains_secret and status in ('QUEUED', 'CLAIMED') and body ~ 'https?://'
on conflict do nothing;
update sms_outbox set body = regexp_replace(body, 'https?://\S+', '[link usunięty]', 'g')
 where contains_secret and body ~ 'https?://';

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
    when 'GPS_SILENT:pl' then 'TOWER {nr}: brak pozycji GPS od {min} min. Otworz link TOWER i zostaw strone wlaczona. Jesli jest problem, zglos go w linku.'
    when 'GPS_SILENT:en' then 'TOWER {nr}: no GPS position for {min} min. Open your TOWER link and keep the page open. Report any problem in the link.'
    when 'GPS_SILENT:sv' then 'TOWER {nr}: ingen GPS-position på {min} min. Öppna din TOWER-länk och låt sidan vara öppen. Rapportera problem i länken.'
    when 'UNLOAD_CONFIRM:pl' then 'TOWER {nr}: jestes na placu Stegra Boden. Po rozladunku potwierdz ROZLADOWANO w linku TOWER (data i zdjecie POD).'
    when 'UNLOAD_CONFIRM:en' then 'TOWER {nr}: you are at Stegra Boden site. After unloading confirm UNLOADED in your TOWER link (time and POD photo).'
    when 'UNLOAD_CONFIRM:sv' then 'TOWER {nr}: du är på Stegra Boden. Bekräfta LOSSAD i din TOWER-länk efter lossning (tid och POD-foto).'
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


create or replace function sms_enqueue(p_kind text, p_load uuid, p_to text, p_locale text, p jsonb,
                                       p_priority int default 100, p_dedup text default null, p_secret boolean default false)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_loc char(2); v_full text;
begin
  if (p_to ~ '^\+[1-9][0-9]{7,14}$') is not true then return null; end if;
  v_loc := sms_locale_for(p_to, p_locale);
  v_full := sms_render(p_kind, v_loc, p);
  insert into sms_outbox (kind, load_id, to_e164, locale, body, contains_secret, priority, dedup_key, created_by)
  values (p_kind, p_load, p_to, v_loc,
          case when p_secret then sms_render(p_kind, v_loc, p || '{"url":"[link usunięty]"}'::jsonb) else v_full end,
          p_secret, p_priority, p_dedup, (select id from app_users where auth_id = auth.uid() and active))
  on conflict (dedup_key) do nothing
  returning id into v_id;
  if v_id is not null and p_secret then
    insert into sms_outbox_secret (sms_id, body) values (v_id, v_full);
  end if;
  return v_id;
end $$;
revoke all on function sms_enqueue(text, uuid, text, text, jsonb, int, text, boolean) from public, anon, authenticated;
revoke all on function sms_render(text, text, jsonb) from public, anon, authenticated;

create or replace function sms_pull(p_token text default null, p_limit int default 5)
returns table (id uuid, to_e164 text, body text, attempts smallint, expires_at timestamptz)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare v_dev uuid; v_left int; v_paused boolean; v_ext boolean;
begin
  v_dev := sms_device_auth(p_token);
  v_ext := external_messaging_enabled();
  update sms_outbox o set status = case when o.attempts >= 3 then 'FAILED'::sms_status else 'QUEUED'::sms_status end,
         error = case when o.attempts >= 3 then 'brak raportu z telefonu po 3 próbach' else o.error end
   where o.status = 'CLAIMED' and o.claimed_at < now() - interval '3 minutes';
  select greatest(day_limit - day_sent, 0), paused into v_left, v_paused from sms_devices where id = v_dev;
  if v_paused then return; end if;
  return query
  with c as (
    select o.id from sms_outbox o
     where o.status = 'QUEUED' and o.not_before <= now() and o.expires_at > now()
       and (v_ext or (o.kind = 'TEST' and exists (select 1 from sms_test_numbers t where t.to_e164 = o.to_e164)))
     order by o.priority desc, o.created_at
     limit least(greatest(coalesce(p_limit, 5), 0), 5, v_left)
     for update skip locked)
  update sms_outbox o set status = 'CLAIMED', device_id = v_dev, claimed_at = now(), attempts = o.attempts + 1
    from c where o.id = c.id
  returning o.id, o.to_e164, coalesce((select s.body from sms_outbox_secret s where s.sms_id = o.id), o.body), o.attempts, o.expires_at;
end $$;
revoke all on function sms_pull(text, int) from public, authenticated;
grant execute on function sms_pull(text, int) to anon;

create or replace function trg_sms_secret_drop() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status not in ('QUEUED', 'CLAIMED') then
    delete from sms_outbox_secret where sms_id = new.id;
  end if;
  return new;
end $$;
revoke all on function trg_sms_secret_drop() from public, anon, authenticated;
drop trigger if exists trg_sms_outbox_secret_drop on sms_outbox;
create trigger trg_sms_outbox_secret_drop after update of status on sms_outbox
  for each row execute function trg_sms_secret_drop();

-- SMS 8: brak pozycji GPS
create or replace function trg_sms_gps_silent() returns trigger
language plpgsql security definer set search_path = public as $$
declare l loads%rowtype; v_last timestamptz; v_min int;
begin
  if new.kind <> 'SILENT_VEHICLE' or new.load_id is null then return new; end if;
  select * into l from loads where id = new.load_id;
  if (found and l.driver_phone is not null
      and l.status in ('AT_LOADING', 'IN_TRANSIT_PL', 'AT_PORT_GDANSK', 'AT_PORT_NYNASHAMN', 'IN_TRANSIT_SE', 'AT_SITE')
      and sms_has_driver_link(l.id)) is not true then
    return new;
  end if;
  select max(ts) into v_last from positions where load_id = l.id;
  v_min := greatest(coalesce(round(extract(epoch from (now() - v_last)) / 60)::int, 0), 1);
  perform sms_enqueue('GPS_SILENT', l.id, l.driver_phone, l.driver_locale,
    jsonb_build_object('nr', coalesce(l.order_no, '—'), 'min', v_min::text),
    100, 'GPS_SILENT:' || l.id || ':' || floor(extract(epoch from now()) / 10800)::bigint);
  return new;
end $$;
revoke all on function trg_sms_gps_silent() from public, anon, authenticated;
drop trigger if exists trg_risk_sms_gps_silent on risk_signals;
create trigger trg_risk_sms_gps_silent after insert on risk_signals
  for each row when (new.kind = 'SILENT_VEHICLE') execute function trg_sms_gps_silent();

-- SMS 9: prośba o potwierdzenie rozładunku
create or replace function sms_unload_confirm_scan(p_now timestamptz default now()) returns int
language plpgsql security definer set search_path = public as $$
declare l record; n int := 0; v_id uuid;
begin
  for l in
    select x.* from loads x
     where x.status = 'AT_SITE' and x.driver_phone is not null
       and not exists (select 1 from load_events e where e.load_id = x.id and e.event_type = 'MILESTONE_UNLOADED')
       and coalesce((select max(e.occurred_at) from load_events e where e.load_id = x.id
                      and (e.event_type = 'STATUS_AT_SITE' or (e.event_type = 'STATUS_AUTO' and e.payload->>'to' = 'AT_SITE'))),
                    x.updated_at) <= p_now - interval '2 hours'
  loop
    if (sms_has_driver_link(l.id)) is not true then continue; end if;
    v_id := sms_enqueue('UNLOAD_CONFIRM', l.id, l.driver_phone, l.driver_locale,
      jsonb_build_object('nr', coalesce(l.order_no, '—')), 100, 'UNLOAD_CONFIRM:' || l.id);
    if v_id is not null then n := n + 1; end if;
  end loop;
  return n;
end $$;
revoke all on function sms_unload_confirm_scan(timestamptz) from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'tower-sms-rozladunek';
    perform cron.schedule('tower-sms-rozladunek', '*/10 * * * *', 'select public.sms_unload_confirm_scan()');
  end if;
end $$;
