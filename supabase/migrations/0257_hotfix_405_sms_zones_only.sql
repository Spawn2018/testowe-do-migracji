-- HOTFIX #405 / D-20261021-2014-01: SMS tylko do osób na załadunku i rozładunku
-- (ZONE_* → sms_zone_recipients) oraz TEST → sms_test_numbers / lista stref.
-- F7: TEST na sms_test_numbers zawsze; TEST na sms_zone_recipients tylko przy EXTERNAL_MESSAGING;
--      pilot redirect tylko dla ZONE_* (R-2).
-- Po 0256 (#411), przed #421 (0258) / #400 (0260).

-- ---------------------------------------------------------------------------
-- 1. Bramka w sms_enqueue — ZONE_*/TEST (+ pilot tylko dla ZONE_*)
-- ---------------------------------------------------------------------------
create or replace function public.sms_enqueue(
  p_kind text, p_load uuid, p_to text, p_locale text, p jsonb,
  p_priority int default 100, p_dedup text default null, p_secret boolean default false
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid; v_loc char(2); v_full text; v_to text; v_ok boolean := false;
  v_redir record; v_pilot boolean := false; v_ext boolean;
begin
  v_to := p_to;
  v_ext := external_messaging_enabled();

  -- F7 B2: przekierowanie pilota wyłącznie dla ZONE_* (E42 / R-2)
  if p_kind in ('ZONE_APPROACH', 'ZONE_ENTER') and p_load is not null then
    select * into v_redir from pilot_redirect_for_load(p_load);
    if found then
      v_to := v_redir.owner_phone_e164;
      v_pilot := true;
    end if;
  end if;

  if (v_to ~ '^\+[1-9][0-9]{7,14}$') is not true then return null; end if;

  if p_kind = 'TEST' then
    -- sms_test_numbers zawsze; lista stref = osoby zewnętrzne → tylko przy EXTERNAL_MESSAGING (R-2)
    v_ok := exists (select 1 from sms_test_numbers t where t.to_e164 = v_to)
         or (
              v_ext
              and exists (
                select 1 from sms_zone_recipients r
                 where r.active is true
                   and sms_zone_e164(r.phone_national, r.country) = v_to
              )
            );
  elsif p_kind in ('ZONE_APPROACH', 'ZONE_ENTER') then
    v_ok := v_pilot
         or exists (
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
  '#405: ZONE_*/TEST; TEST→sms_test_numbers (zawsze) | sms_zone_recipients (tylko EXTERNAL on); ZONE_*→lista lub pilot (R-2).';

-- ---------------------------------------------------------------------------
-- 2. sms_pull — tylko ZONE_*/TEST; pilot phone OK dla ZONE_*; reszta → EXPIRED
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
         and (
           v_ext is not true
           or not exists (
             select 1 from sms_zone_recipients r
              where r.active is true
                and sms_zone_e164(r.phone_national, r.country) = o.to_e164
           )
         )
       )
       or (
         o.kind in ('ZONE_APPROACH', 'ZONE_ENTER')
         and not exists (
           select 1 from sms_zone_recipients r
            where r.active is true
              and sms_zone_e164(r.phone_national, r.country) = o.to_e164
         )
         and not exists (
           select 1 from pilot_notify_redirect r
            where r.active is true
              and r.owner_phone_e164 = o.to_e164
              and (o.load_id is null or o.load_id = r.load_id)
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
         or (
           o.kind = 'TEST'
           and (
             exists (select 1 from sms_test_numbers t where t.to_e164 = o.to_e164)
             or (
               v_ext
               and exists (
                 select 1 from sms_zone_recipients r
                  where r.active is true
                    and sms_zone_e164(r.phone_national, r.country) = o.to_e164
               )
             )
           )
         )
         or (
           o.kind in ('ZONE_APPROACH', 'ZONE_ENTER')
           and (
             exists (
               select 1 from sms_zone_recipients r
                where r.active is true
                  and sms_zone_e164(r.phone_national, r.country) = o.to_e164
             )
             or exists (
               select 1 from pilot_notify_redirect r
                where r.active is true
                  and r.owner_phone_e164 = o.to_e164
                  and (o.load_id is null or o.load_id = r.load_id)
             )
           )
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

comment on function public.sms_pull(text, int) is
  '#405: pull tylko ZONE_*/TEST (+ pilot dla ZONE_*); spoza listy → EXPIRED.';

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

-- F7: cron tower-sms-rozladunek wołał skan co 10 min → zawsze 0; wyłączamy harmonogram.
-- Brama lokalna (tower_boot) bez rozszerzenia pg_cron — bez schematu cron (jak 0069).
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'tower-sms-rozladunek';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 6. pilot_redirect_dry_run — ZONE_* z przekierowaniem (F7 B2), wynik oznaczony EXPIRED
-- ---------------------------------------------------------------------------
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

  -- SMS na fikcyjny numer → ma zostać przepisany na pilota (tylko ZONE_*)
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

comment on function public.pilot_redirect_dry_run(uuid) is
  '#405 F7: dry-run ZONE_* → numer pilota; wynik oznaczony EXPIRED (bez wysyłki).';

-- ---------------------------------------------------------------------------
-- 7. admin_sms_zone_test — R-2: bez EXTERNAL_MESSAGING czytelny komunikat
-- ---------------------------------------------------------------------------
create or replace function public.admin_sms_zone_test(p_list text) returns int
language plpgsql security definer set search_path = public as $$
declare r record; n int := 0; v_to text; v_id uuid;
begin
  if (current_app_role() = 'HHL_ADMIN') is not true then
    raise exception 'Tylko administrator HHL' using errcode = '42501';
  end if;
  if (p_list in ('LOAD_SREM', 'UNLOAD_BODEN')) is not true then
    raise exception 'Lista niepoprawna' using errcode = '22023';
  end if;
  if external_messaging_enabled() is not true then
    raise exception 'wysyłka zewnętrzna wyłączona — R-2' using errcode = 'P0001';
  end if;
  for r in select * from sms_zone_recipients where list_key = p_list and active is true order by slot loop
    v_to := sms_zone_e164(r.phone_national, r.country);
    if v_to is null then continue; end if;
    v_id := sms_enqueue('TEST', null, v_to, case when r.country = 'SE' then 'sv' else 'pl' end, '{}'::jsonb, 100,
                        'ZONE_TEST:' || p_list || ':' || r.slot::text || ':' || to_char(now(), 'YYYYMMDDHH24MI'), false);
    if v_id is not null then n := n + 1; end if;
  end loop;
  return n;
end $$;
revoke all on function public.admin_sms_zone_test(text) from public, anon;
grant execute on function public.admin_sms_zone_test(text) to authenticated;

comment on function public.admin_sms_zone_test(text) is
  '#405 F7: TEST listy stref tylko przy EXTERNAL_MESSAGING; inaczej wyjątek R-2.';

-- ---------------------------------------------------------------------------
-- 8. Sprzątanie jednorazowe: kolejka spoza ZONE/TEST → EXPIRED
-- ---------------------------------------------------------------------------
do $$
declare
  n int;
  v_ext boolean := external_messaging_enabled();
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
         and (
           v_ext is not true
           or not exists (
             select 1 from sms_zone_recipients r
              where r.active is true
                and sms_zone_e164(r.phone_national, r.country) = o.to_e164
           )
         )
       )
       or (
         o.kind in ('ZONE_APPROACH', 'ZONE_ENTER')
         and not exists (
           select 1 from sms_zone_recipients r
            where r.active is true
              and sms_zone_e164(r.phone_national, r.country) = o.to_e164
         )
         and not exists (
           select 1 from pilot_notify_redirect r
            where r.active is true
              and r.owner_phone_e164 = o.to_e164
              and (o.load_id is null or o.load_id = r.load_id)
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
