-- =====================================================================
-- 0176 — TELM-EMTRACK-WEB LIVE (decyzja właściciela 05.10 ~13:12)
-- 0) Blokada SMS/e-mail dla wskazanych transportów → tylko właściciel
-- 1) Pozycje naczep bez awizacji (sieroty) bez alarmów
-- 3) Faza z pozycji (SE / morze) przy podłączeniu w trasie
-- Flagi H1/H3/H6 / TELM_EMTRACK_WEB ta migracja NIE włącza (flaga osobno po teście na sucho).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Blokada powiadomień zewnętrznych dla transportu testowego
-- ---------------------------------------------------------------------
create table if not exists public.pilot_notify_redirect (
  load_id          uuid primary key references public.loads(id) on delete cascade,
  owner_email      text not null,
  owner_phone_e164 text not null check (owner_phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  active           boolean not null default true,
  note             text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
alter table public.pilot_notify_redirect enable row level security;
revoke all on public.pilot_notify_redirect from anon, authenticated;
grant select on public.pilot_notify_redirect to authenticated;
drop policy if exists pilot_notify_redirect_read on public.pilot_notify_redirect;
create policy pilot_notify_redirect_read on public.pilot_notify_redirect
  for select to authenticated using (is_hhl());

comment on table public.pilot_notify_redirect is
  'TELM live / przed R-0: SMS i e-mail dla load_id tylko na właściciela (do odwołania).';

-- GD035YX = 15062/2026/OSL/GDA/P · właściciel: sebastian@log-mar.pl / +48695637907 (sms_test_numbers)
insert into public.pilot_notify_redirect (load_id, owner_email, owner_phone_e164, active, note)
select l.id, 'sebastian@log-mar.pl', '+48695637907', true,
       'TELM-EMTRACK-WEB LIVE 05.10 GD035YX — do odwołania właściciela'
  from loads l
 where l.id = '963e19dd-fe83-4690-9306-5c7fc4b95468'
on conflict (load_id) do update set
  owner_email = excluded.owner_email,
  owner_phone_e164 = excluded.owner_phone_e164,
  active = true,
  note = excluded.note,
  updated_at = now();

-- upewnij się, że numer właściciela jest na liście testowej (sms_pull przed EXTERNAL_MESSAGING)
insert into public.sms_test_numbers (to_e164, label)
values ('+48695637907', 'właściciel — TELM live redirect')
on conflict (to_e164) do nothing;

create or replace function public.pilot_redirect_for_load(p_load uuid)
returns table (owner_email text, owner_phone_e164 text)
language sql stable security definer set search_path = public as $$
  select r.owner_email, r.owner_phone_e164
    from pilot_notify_redirect r
   where r.load_id = p_load and r.active is true
   limit 1
$$;
revoke all on function public.pilot_redirect_for_load(uuid) from public, anon, authenticated;

-- sms_enqueue: przekieruj na numer właściciela gdy load w pilot_notify_redirect
create or replace function public.sms_enqueue(
  p_kind text, p_load uuid, p_to text, p_locale text, p jsonb,
  p_priority int default 100, p_dedup text default null, p_secret boolean default false
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid; v_loc char(2); v_full text; v_to text; v_redir record;
begin
  v_to := p_to;
  if p_load is not null then
    select * into v_redir from pilot_redirect_for_load(p_load);
    if found then
      v_to := v_redir.owner_phone_e164;
    end if;
  end if;
  if (v_to ~ '^\+[1-9][0-9]{7,14}$') is not true then return null; end if;
  v_loc := sms_locale_for(v_to, p_locale);
  v_full := sms_render(p_kind, v_loc, p);
  insert into sms_outbox (kind, load_id, to_e164, locale, body, contains_secret, priority, dedup_key, created_by)
  values (p_kind, p_load, v_to, v_loc,
          case when p_secret then sms_render(p_kind, v_loc, p || '{"url":"[link usunięty]"}'::jsonb) else v_full end,
          p_secret, p_priority, p_dedup, (select id from app_users where auth_id = auth.uid() and active))
  on conflict (dedup_key) do nothing
  returning id into v_id;
  if v_id is not null and p_secret then
    insert into sms_outbox_secret (sms_id, body) values (v_id, v_full);
  end if;
  return v_id;
end $$;
revoke all on function public.sms_enqueue(text, uuid, text, text, jsonb, int, text, boolean) from public, anon, authenticated;

-- sms_pull: przed EXTERNAL_MESSAGING — TEST na listę testową LUB dowolny kind na numer z aktywnego redirectu
create or replace function public.sms_pull(p_token text default null, p_limit int default 5)
returns table (id uuid, to_e164 text, body text, attempts smallint, expires_at timestamptz)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_dev uuid;
  v_left int;
  v_paused boolean;
  v_ext boolean;
begin
  v_dev := sms_device_auth(p_token);
  v_ext := external_messaging_enabled();
  update sms_outbox o set
    status = case when o.attempts >= 3 then 'FAILED'::sms_status else 'QUEUED'::sms_status end,
    error = case when o.attempts >= 3 then 'brak raportu z telefonu po 3 próbach' else o.error end,
    not_before = case when o.attempts >= 3 then o.not_before else now() + interval '3 seconds' end,
    device_id = case when o.attempts >= 3 then o.device_id else null end
  where o.status = 'CLAIMED' and o.claimed_at < now() - interval '3 minutes';

  select greatest(day_limit - day_sent, 0), paused into v_left, v_paused from sms_devices where id = v_dev;
  if v_paused then return; end if;

  return query
  with c as (
    select o.id from sms_outbox o
     where o.status = 'QUEUED' and o.not_before <= now() and o.expires_at > now()
       and (
         v_ext
         or (o.kind = 'TEST' and exists (select 1 from sms_test_numbers t where t.to_e164 = o.to_e164))
         or exists (
           select 1 from pilot_notify_redirect r
            where r.active is true
              and r.owner_phone_e164 = o.to_e164
              and (o.load_id is null or o.load_id = r.load_id)
         )
       )
     order by o.priority desc, o.created_at
     limit least(greatest(coalesce(p_limit, 5), 0), 5, v_left)
     for update skip locked
  )
  update sms_outbox o set
    status = 'CLAIMED',
    device_id = v_dev,
    claimed_at = now(),
    attempts = o.attempts + 1
  from c where o.id = c.id
  returning o.id, o.to_e164,
            coalesce((select s.body from sms_outbox_secret s where s.sms_id = o.id), o.body),
            o.attempts, o.expires_at;
end $$;
revoke all on function public.sms_pull(text, int) from public, authenticated;
grant execute on function public.sms_pull(text, int) to anon;

-- e-mail: przekieruj recipient na właściciela gdy load w redirect
create or replace function public.trg_notifications_pilot_redirect() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_email text;
begin
  if new.channel = 'EMAIL' and new.load_id is not null and new.status = 'PENDING' then
    select owner_email into v_email from pilot_redirect_for_load(new.load_id);
    if v_email is not null then
      new.recipient := v_email;
    end if;
  end if;
  return new;
end $$;
revoke all on function public.trg_notifications_pilot_redirect() from public, anon, authenticated;
drop trigger if exists trg_notifications_pilot_redirect on public.notifications;
create trigger trg_notifications_pilot_redirect
  before insert or update of recipient, status, load_id on public.notifications
  for each row execute function public.trg_notifications_pilot_redirect();

-- Test na sucho (bez wysyłki): enqueue SMS + e-mail → muszą trafić tylko do właściciela
create or replace function public.pilot_redirect_dry_run(p_load uuid default '963e19dd-fe83-4690-9306-5c7fc4b95468')
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_sms uuid;
  v_mail_id bigint;
  v_to text;
  v_rcpt text;
  v_owner_phone text;
  v_owner_email text;
begin
  select owner_phone_e164, owner_email into v_owner_phone, v_owner_email
    from pilot_notify_redirect where load_id = p_load and active;
  if v_owner_phone is null then
    return jsonb_build_object('ok', false, 'error', 'brak aktywnego redirectu');
  end if;

  -- SMS na fikcyjny numer KSH → ma zostać przepisany
  v_sms := sms_enqueue(
    'ZONE_APPROACH', p_load, '+48111222333', 'pl',
    jsonb_build_object('kto', 'TEST', 'rej', 'GD035YX', 'wysylka', 'DRY', 'miejsce', 'Boden', 'eta', '—'),
    10, 'PILOT_DRY_SMS:' || p_load::text || ':' || floor(extract(epoch from now()))::text, false
  );
  select to_e164 into v_to from sms_outbox where id = v_sms;

  insert into notifications (channel, recipient, load_id, template, payload, dedup_key, status)
  values (
    'EMAIL', 'ksh-fake@example.com', p_load, 'SMS_FALLBACK',
    jsonb_build_object('kind', 'ZONE_LIMIT', 'text', 'test na sucho — nie wysyłać dalej'),
    'PILOT_DRY_MAIL:' || p_load::text || ':' || floor(extract(epoch from now()))::text,
    'PENDING'
  )
  on conflict (dedup_key) where dedup_key is not null do nothing
  returning id, recipient into v_mail_id, v_rcpt;
  if v_mail_id is null then
    select id, recipient into v_mail_id, v_rcpt from notifications
     where dedup_key like 'PILOT_DRY_MAIL:' || p_load::text || ':%'
     order by id desc limit 1;
  end if;

  -- oznacz jako zablokowane testem (nie wyśle send-notifications)
  update notifications set status = 'BLOCKED_R2', error = 'pilot dry-run — nie wysyłać'
   where id = v_mail_id;
  update sms_outbox set status = 'EXPIRED', error = 'pilot dry-run — nie wysyłać'
   where id = v_sms;

  return jsonb_build_object(
    'ok', (v_to = v_owner_phone and lower(v_rcpt) = lower(v_owner_email)),
    'sms_id', v_sms,
    'sms_to', v_to,
    'expected_phone', v_owner_phone,
    'mail_id', v_mail_id,
    'mail_to', v_rcpt,
    'expected_email', v_owner_email
  );
end $$;
revoke all on function public.pilot_redirect_dry_run(uuid) from public, anon;
grant execute on function public.pilot_redirect_dry_run(uuid) to service_role;

-- ---------------------------------------------------------------------
-- 1. Pozycje naczep bez awizacji (bez alarmów)
-- ---------------------------------------------------------------------
create table if not exists public.telematics_orphan_positions (
  id            bigserial primary key,
  plate         text not null,
  tracking_object_id text,
  lat           double precision not null,
  lon           double precision not null,
  ts            timestamptz not null,
  source        public.position_source not null default 'EMTRACK_WEB',
  speed_kmh     numeric(5,1),
  heading_deg   numeric(5,1),
  ignition      boolean,
  raw           jsonb,
  inserted_at   timestamptz not null default now(),
  unique (plate, ts, source)
);
create index if not exists telematics_orphan_positions_ts_idx on public.telematics_orphan_positions (ts desc);
alter table public.telematics_orphan_positions enable row level security;
revoke all on public.telematics_orphan_positions from anon, authenticated;
grant select on public.telematics_orphan_positions to authenticated;
drop policy if exists telematics_orphan_positions_read on public.telematics_orphan_positions;
create policy telematics_orphan_positions_read on public.telematics_orphan_positions
  for select to authenticated using (is_hhl());

create or replace function public.telm_save_orphan_position(
  p_plate text, p_tracking_object_id text,
  p_lat float8, p_lon float8, p_ts timestamptz,
  p_source public.position_source default 'EMTRACK_WEB',
  p_speed numeric default null, p_heading numeric default null,
  p_ignition boolean default null, p_raw jsonb default '{}'::jsonb
) returns bigint
language plpgsql security definer set search_path = public as $$
declare v_id bigint; v_plate text;
begin
  v_plate := upper(regexp_replace(coalesce(p_plate, ''), '[^A-Z0-9]', '', 'g'));
  if v_plate = '' or p_lat is null or p_lon is null or p_ts is null then return null; end if;
  insert into telematics_orphan_positions (plate, tracking_object_id, lat, lon, ts, source, speed_kmh, heading_deg, ignition, raw)
  values (v_plate, p_tracking_object_id, p_lat, p_lon, p_ts, p_source, p_speed, p_heading, p_ignition, coalesce(p_raw, '{}'::jsonb))
  on conflict (plate, ts, source) do update set
    lat = excluded.lat, lon = excluded.lon, raw = excluded.raw, inserted_at = now()
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.telm_save_orphan_position(text, text, float8, float8, timestamptz, public.position_source, numeric, numeric, boolean, jsonb) from public, anon, authenticated;
grant execute on function public.telm_save_orphan_position(text, text, float8, float8, timestamptz, public.position_source, numeric, numeric, boolean, jsonb) to service_role;

-- ---------------------------------------------------------------------
-- 3. Faza z pozycji przy podłączeniu w trasie (SE / morze Bałtyckie)
-- ---------------------------------------------------------------------
create or replace function public.telm_infer_phase_from_position(
  p_load uuid, p_lat float8, p_lon float8, p_ts timestamptz default now()
) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_status load_status;
  v_phase text;
  v_ok boolean := false;
  v_ts timestamptz := coalesce(p_ts, now());
  v_gid uuid;
begin
  if p_load is null or p_lat is null or p_lon is null then return null; end if;
  select status into v_status from loads where id = p_load;
  if v_status is null or v_status in ('CANCELLED', 'UNLOADED', 'DELIVERED', 'AT_SITE', 'IN_TRANSIT_SE', 'AT_PORT_NYNASHAMN', 'FERRY') then
    return null;
  end if;

  -- Morze Bałtyckie (korytarz) albo Szwecja
  if p_lat >= 55.0 and p_lon >= 11.0 and p_lon <= 25.0 and p_lat <= 70.0 then
    v_phase := 'IN_TRANSIT_SE';
  elsif p_lat >= 54.2 and p_lat < 55.0 and p_lon >= 17.0 and p_lon <= 20.5 then
    v_phase := 'FERRY';
  else
    return null;
  end if;

  -- ETA-PRE-LOAD: syntetyczny GEOFENCE_EXIT LOADING (załadunek już był),
  -- żeby eta_site liczyło się mimo braku rzeczywistego wyjazdu ze Śremu.
  select id into v_gid from geofences
   where kind = 'LOADING' and active
   order by sort_order nulls last, name
   limit 1;
  insert into load_events (load_id, event_type, occurred_at, payload, dedup_key)
  values (
    p_load, 'GEOFENCE_EXIT', v_ts,
    jsonb_build_object(
      'geofence_id', v_gid,
      'geofence_kind', 'LOADING',
      'synthetic', true,
      'zrodlo', 'TELM_PHASE_INFER',
      'powod', 'faza ustalona z pozycji naczepy przy podłączeniu'
    ),
    'TELM_PHASE_EXIT_LOAD:' || p_load::text
  )
  on conflict (dedup_key) where dedup_key is not null do nothing;

  update loads
     set actual_load_at = coalesce(actual_load_at, v_ts),
         updated_at = now()
   where id = p_load;

  -- Próba ustawienia statusu zgodnego z fazą (może paść na braku carrier_order_no → ryzyko AUTO_STATUS).
  v_ok := auto_set_status(
    p_load, v_status, v_phase::load_status,
    'faza ustalona z pozycji naczepy przy podłączeniu',
    v_ts,
    jsonb_build_object(
      'zrodlo', 'TELM_PHASE_INFER',
      'lat', p_lat, 'lon', p_lon,
      'powod', 'faza ustalona z pozycji naczepy przy podłączeniu'
    )
  );

  insert into load_events (load_id, event_type, occurred_at, payload, dedup_key)
  values (
    p_load, 'STATUS_AUTO', v_ts,
    jsonb_build_object(
      'from', v_status,
      'to', case when v_ok then v_phase else v_status::text end,
      'target_phase', v_phase,
      'status_applied', v_ok,
      'powod', 'faza ustalona z pozycji naczepy przy podłączeniu',
      'zrodlo', 'TELM_PHASE_INFER',
      'lat', p_lat, 'lon', p_lon
    ),
    'TELM_PHASE_INFER:' || p_load::text || ':' || v_phase
  )
  on conflict (dedup_key) where dedup_key is not null do nothing;

  -- przelicz ETA (po EXIT LOADING pre_load odpada)
  begin
    perform public.refresh_load_eta(p_load);
  exception when others then
    null;
  end;

  return v_phase;
end $$;
revoke all on function public.telm_infer_phase_from_position(uuid, float8, float8, timestamptz) from public, anon, authenticated;
grant execute on function public.telm_infer_phase_from_position(uuid, float8, float8, timestamptz) to service_role;

comment on function public.telm_infer_phase_from_position(uuid, float8, float8, timestamptz) is
  'TELM: gdy transport podłączony w trasie (pozycja SE/morze) — status + historia + actual_load_at, żeby ETA nie było pre_load.';
