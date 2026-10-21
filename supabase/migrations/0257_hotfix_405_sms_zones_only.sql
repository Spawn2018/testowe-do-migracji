-- HOTFIX #405 / D-20261021-2014-01: SMS tylko do osób na załadunku i rozładunku
-- (ZONE_* → sms_zone_recipients) oraz TEST → sms_test_numbers.
-- Po 0256 (#411), przed #400 (0258).

-- ---------------------------------------------------------------------------
-- 1. Bramka w sms_enqueue — jedyne dozwolone rodzaje i numery
-- ---------------------------------------------------------------------------
create or replace function public.sms_enqueue(
  p_kind text, p_load uuid, p_to text, p_locale text, p jsonb,
  p_priority int default 100, p_dedup text default null, p_secret boolean default false
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid; v_loc char(2); v_full text; v_to text; v_ok boolean := false;
begin
  v_to := p_to;
  if (v_to ~ '^\+[1-9][0-9]{7,14}$') is not true then return null; end if;

  -- #405: bez przekierowania pilota — tylko lista stref albo numer testowy.
  if p_kind = 'TEST' then
    v_ok := exists (select 1 from sms_test_numbers t where t.to_e164 = v_to);
  elsif p_kind in ('ZONE_APPROACH', 'ZONE_ENTER') then
    v_ok := exists (
      select 1 from sms_zone_recipients r
       where r.active is true
         and sms_zone_e164(r.phone_national, r.country) = v_to
    );
  else
    v_ok := false;
  end if;
  if v_ok is not true then
    return null;
  end if;

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

comment on function public.sms_enqueue(text, uuid, text, text, jsonb, int, text, boolean) is
  '#405: tylko ZONE_APPROACH/ZONE_ENTER → sms_zone_recipients oraz TEST → sms_test_numbers; reszta null.';

-- ---------------------------------------------------------------------------
-- 2. sms_pull — tylko dozwolone rodzaje; stare spoza listy → EXPIRED
-- ---------------------------------------------------------------------------
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

  -- #405: nie wysyłaj starych wpisów do kierowców / spoza listy
  update sms_outbox o
     set status = 'EXPIRED',
         error = coalesce(nullif(o.error, ''), '405: poza ZONE/TEST')
   where o.status in ('QUEUED', 'CLAIMED')
     and (
       o.kind not in ('ZONE_APPROACH', 'ZONE_ENTER', 'TEST')
       or (
         o.kind = 'TEST'
         and not exists (select 1 from sms_test_numbers t where t.to_e164 = o.to_e164)
       )
       or (
         o.kind in ('ZONE_APPROACH', 'ZONE_ENTER')
         and not exists (
           select 1 from sms_zone_recipients r
            where r.active is true
              and sms_zone_e164(r.phone_national, r.country) = o.to_e164
         )
       )
     );

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
       and o.kind in ('ZONE_APPROACH', 'ZONE_ENTER', 'TEST')
       and (
         v_ext
         or (o.kind = 'TEST' and exists (select 1 from sms_test_numbers t where t.to_e164 = o.to_e164))
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

comment on function public.sms_pull(text, int) is
  '#405: pull tylko ZONE_*/TEST; spoza listy → EXPIRED przed pobraniem.';

-- ---------------------------------------------------------------------------
-- 3. Wyłączyć (nie usuwać) triggery SMS do kierowców
-- ---------------------------------------------------------------------------
alter table public.loads disable trigger trg_loads_sms;
alter table public.sailings disable trigger trg_sailings_sms;
alter table public.risk_signals disable trigger trg_risk_sms_gps_silent;

insert into audit_log (action, entity, entity_id, new_value)
values (
  'SMS_DRIVER_TRIGGERS_OFF',
  'sms',
  '405',
  jsonb_build_object(
    'triggers', array['trg_loads_sms', 'trg_sailings_sms', 'trg_risk_sms_gps_silent'],
    'reason', 'D-20261021-2014-01 / #405 — SMS tylko strefy + TEST'
  )
);

-- ---------------------------------------------------------------------------
-- 4. issue_driver_token_sms — token bez SMS
-- ---------------------------------------------------------------------------
create or replace function public.issue_driver_token_sms(p_load_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_token text;
  v_load loads%rowtype;
  v_to text;
begin
  if (current_app_user_id() is not null) is not true then
    raise exception 'Brak aktywnego konta' using errcode = '42501';
  end if;
  select * into v_load from loads where id = p_load_id;
  v_to := driver_phone_e164(v_load.driver_phone, v_load.driver_phone_country);
  if (found and v_to ~ '^\+[1-9][0-9]{7,14}$') is not true then
    raise exception 'Brak numeru telefonu kierowcy (krajowy, np. 601234567) — link można tylko skopiować' using errcode = '22023';
  end if;
  v_token := issue_driver_token(p_load_id);
  -- #405: bez SMS DRIVER_LINK (właściciel 21.10) — link tylko do skopiowania
  return jsonb_build_object('token', v_token, 'sms_id', null);
end $$;

revoke all on function public.issue_driver_token_sms(uuid) from public, anon;
grant execute on function public.issue_driver_token_sms(uuid) to authenticated;

comment on function public.issue_driver_token_sms(uuid) is
  '#405: wydaje token kierowcy bez wpisu SMS (link do skopiowania).';

-- ---------------------------------------------------------------------------
-- 5. sms_unload_confirm_scan — wyłączony (cron zostaje, wynik 0)
-- ---------------------------------------------------------------------------
create or replace function public.sms_unload_confirm_scan(p_now timestamptz default now()) returns int
language plpgsql security definer set search_path = public as $$
begin
  -- #405: bez UNLOAD_CONFIRM do kierowcy
  return 0;
end $$;

revoke all on function public.sms_unload_confirm_scan(timestamptz) from public, anon, authenticated;

comment on function public.sms_unload_confirm_scan(timestamptz) is
  '#405: wyłączone — SMS tylko ZONE_* / TEST.';

-- ---------------------------------------------------------------------------
-- 6. pilot_redirect_dry_run — bez SMS poza listą stref
-- ---------------------------------------------------------------------------
create or replace function public.pilot_redirect_dry_run(p_load uuid default '963e19dd-fe83-4690-9306-5c7fc4b95468')
returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  -- #405: dry-run wysyłał ZONE_APPROACH na numer poza sms_zone_recipients — wyłączone
  return jsonb_build_object(
    'ok', false,
    'error', '405: pilot_redirect_dry_run wyłączony — SMS tylko do sms_zone_recipients / TEST'
  );
end $$;

revoke all on function public.pilot_redirect_dry_run(uuid) from public, anon;
grant execute on function public.pilot_redirect_dry_run(uuid) to service_role;

comment on function public.pilot_redirect_dry_run(uuid) is
  '#405: wyłączony — nie kolejuje SMS poza listą stref.';

-- ---------------------------------------------------------------------------
-- 7. Sprzątanie jednorazowe: kolejka spoza ZONE/TEST → EXPIRED
-- ---------------------------------------------------------------------------
do $$
declare
  n int;
begin
  update sms_outbox o
     set status = 'EXPIRED',
         error = coalesce(nullif(o.error, ''), '405: poza ZONE/TEST (sprzątanie)')
   where o.status in ('QUEUED', 'CLAIMED')
     and (
       o.kind not in ('ZONE_APPROACH', 'ZONE_ENTER', 'TEST')
       or (
         o.kind = 'TEST'
         and not exists (select 1 from sms_test_numbers t where t.to_e164 = o.to_e164)
       )
       or (
         o.kind in ('ZONE_APPROACH', 'ZONE_ENTER')
         and not exists (
           select 1 from sms_zone_recipients r
            where r.active is true
              and sms_zone_e164(r.phone_national, r.country) = o.to_e164
         )
       )
     );
  get diagnostics n = row_count;
  insert into audit_log (action, entity, entity_id, new_value)
  values (
    'SMS_QUEUE_EXPIRE_405',
    'sms_outbox',
    '405',
    jsonb_build_object('expired', n, 'reason', 'HOTFIX #405 SMS tylko strefy')
  );
end $$;
