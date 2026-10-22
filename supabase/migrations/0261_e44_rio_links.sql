-- 0261 — E44 (#437 / #438 F7): odczyt pozycji z linku RIO.
-- Kolumna streak, flaga TELM_RIO_LINKS, audit skip, sanitize streak, cron, lock.
-- Zgoda RIO na piśmie — właściciel, 22.10.2026 09:02 (dokument u właściciela).
-- Adapter: _shared/telematics/rioPositionSharing.ts; Edge: rio-links; job: rio-links.

alter table public.loads
  add column if not exists rio_error_streak integer not null default 0;

comment on column public.loads.rio_error_streak is
  'E44 pkt 7: kolejne błędy 5xx/timeout/format; ≥3 → SOURCE_DOWN:RIO';

grant select (rio_error_streak) on public.loads to authenticated;

-- ---------------------------------------------------------------------
-- Flaga wyłączająca TELM_RIO_LINKS (jak TELM_EMTRACK_WEB). Domyślnie włączona (SG-19).
-- ---------------------------------------------------------------------
alter table public.security_flags drop constraint if exists security_flags_key_check;
alter table public.security_flags add constraint security_flags_key_check check (key in (
  'MFA_HHL_ADMIN', 'EXTERNAL_MESSAGING', 'PERMIT_REQUIRED_NON_STANDARD', 'FUEL_WOB_INGEST',
  'SMS_ZONE_APPROACH', 'SMS_ZONE_ENTER', 'DRIVER_LINK_ACCEPT', 'AUTOMATIC_DECISION_EMAIL',
  'H1_ROUTE_CHECK', 'H3_CORRIDOR_OBSTACLES', 'H6_MAP_OBSTACLES', 'FUEL_SE_PL_INGEST',
  'TELM_EMTRACK_WEB', 'TELM_RIO_LINKS'
));

insert into public.security_flags (key, enabled, note) values
  ('TELM_RIO_LINKS', true,
   'E44: odczyt pozycji z linku RIO (cron tower-rio-links). Wyłącz, aby zatrzymać zapytania.')
on conflict (key) do update
  set note = excluded.note;

create or replace function public.telm_rio_links_enabled()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select enabled from security_flags where key = 'TELM_RIO_LINKS'), true)
$$;
revoke all on function public.telm_rio_links_enabled() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.telm_rio_links_enabled() to service_role;
  end if;
end $$;

comment on function public.telm_rio_links_enabled() is
  'E44 / #438: czy cron rio-links może odpytywać API RIO (flaga HHL).';

-- ---------------------------------------------------------------------
-- Blokada nakładania się przebiegów (TTL w app_parameters; bez session advisory — pooler).
-- ---------------------------------------------------------------------
insert into public.app_parameters (key, value, label, source) values
  ('RIO_LINKS_LOCK_UNTIL', 0, 'Epoch s — blokada przebiegu rio-links', 'E44 #438 F7')
on conflict (key) do nothing;

create or replace function public.rio_links_lock_try(p_ttl_sec integer default 90)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now numeric := extract(epoch from now());
  v_until numeric;
  v_n int;
begin
  if (p_ttl_sec is null) or p_ttl_sec < 1 then
    p_ttl_sec := 90;
  end if;
  select coalesce(value, 0) into v_until
    from public.app_parameters where key = 'RIO_LINKS_LOCK_UNTIL';
  if v_until is null then
    insert into public.app_parameters (key, value, label, source)
    values ('RIO_LINKS_LOCK_UNTIL', v_now + p_ttl_sec,
            'Epoch s — blokada przebiegu rio-links', 'E44 #438 F7');
    return true;
  end if;
  if v_until > v_now then
    return false;
  end if;
  update public.app_parameters
     set value = v_now + p_ttl_sec, updated_at = now()
   where key = 'RIO_LINKS_LOCK_UNTIL'
     and coalesce(value, 0) <= v_now;
  get diagnostics v_n = row_count;
  return v_n > 0;
end
$$;
revoke all on function public.rio_links_lock_try(integer) from public, anon, authenticated;

create or replace function public.rio_links_lock_release()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.app_parameters
     set value = 0, updated_at = now()
   where key = 'RIO_LINKS_LOCK_UNTIL';
end
$$;
revoke all on function public.rio_links_lock_release() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.rio_links_lock_try(integer) to service_role;
    grant execute on function public.rio_links_lock_release() to service_role;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- audit_row_change: rio_check_at / rio_last_fix_at w v_skip (bez 720 wierszy/doba).
-- Bazuje na 0260 (#400) + skip E44.
-- ---------------------------------------------------------------------
create or replace function public.audit_row_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_old jsonb; v_new jsonb; o jsonb; n jsonb; k text;
  v_skip constant text[] := array[
    'updated_at', 'eta_site', 'eta_confidence_min', 'eta_basis', 'eta_computed_at',
    'delay_minutes', 'fetched_at', 'beat_at', 'beats', 'last_seen_at',
    'rio_check_at', 'rio_last_fix_at'
  ];
  v_pii  constant text[] := array[
    'driver_name', 'driver_phone', 'phone_national', 'phone', 'contact_phone',
    'contact_name', 'email_personal', 'rio_secret'
  ];
  v_id text; v_user uuid; v_source text; v_row jsonb;
  v_mask text;
  v_driver_clear boolean;
begin
  o := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  n := case when tg_op in ('UPDATE', 'INSERT') then to_jsonb(new) end;
  if tg_op = 'UPDATE' then
    v_old := '{}'; v_new := '{}';
    for k in select key from jsonb_each(n) loop
      if (n -> k) is distinct from (o -> k) and (k = any(v_skip)) is not true then
        v_old := v_old || jsonb_build_object(k, o -> k);
        v_new := v_new || jsonb_build_object(k, n -> k);
      end if;
    end loop;
    if v_new = '{}'::jsonb then return null; end if;
  else
    v_old := o; v_new := n;
  end if;

  v_source := nullif(btrim(current_setting('tower.audit_source', true)), '');
  v_driver_clear := tg_table_name in ('loads', 'load_escorts')
    and (v_source = 'rodo') is not true;

  foreach k in array v_pii loop
    if k = 'rio_secret' then
      v_mask := '"••••"';
    elsif k in ('driver_name', 'driver_phone') and v_driver_clear then
      v_mask := null;
    else
      v_mask := '"[dane osobowe]"';
    end if;
    if v_mask is not null then
      if v_old ? k and jsonb_typeof(v_old -> k) <> 'null' then
        v_old := jsonb_set(v_old, array[k], v_mask::jsonb);
      end if;
      if v_new ? k and jsonb_typeof(v_new -> k) <> 'null' then
        v_new := jsonb_set(v_new, array[k], v_mask::jsonb);
      end if;
    end if;
  end loop;

  v_row := coalesce(n, o);
  v_id := coalesce(
    v_row ->> 'id',
    v_row ->> 'key',
    v_row ->> 'kind',
    nullif((v_row ->> 'invoice_id') || ':' || (v_row ->> 'load_id'), ':'),
    nullif((v_row ->> 'load_id') || ':' || (v_row ->> 'permit_id'), ':'),
    nullif((v_row ->> 'event_group') || ':' || (v_row ->> 'org_kind'), ':'),
    nullif((v_row ->> 'currency') || ':' || (v_row ->> 'rate_date'), ':'),
    nullif((v_row ->> 'project_id') || ':' || (v_row ->> 'category'), ':'),
    nullif((v_row ->> 'list_key') || ':' || (v_row ->> 'slot'), ':'),
    tg_table_name
  );

  begin
    v_user := public.current_app_user_id();
  exception when others then
    v_user := null;
  end;

  if v_user is null then
    v_source := coalesce(v_source, 'system');
  end if;

  insert into audit_log (user_id, action, entity, entity_id, old_value, new_value, source)
    values (v_user, 'ROW_' || tg_op, tg_table_name, v_id, v_old, v_new, v_source);
  return null;
end $$;

revoke all on function public.audit_row_change() from public, anon, authenticated;

comment on function public.audit_row_change() is
  'HIST-11 + A7 + #400 + E44 F7: rio••••; skip rio_check_at/rio_last_fix_at; driver_* jawne (nie rodo).';

-- ---------------------------------------------------------------------
-- loads_rio_sanitize: zeruj rio_error_streak przy nowym linku (F7 #438).
-- ---------------------------------------------------------------------
create or replace function public.loads_rio_sanitize()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ref text;
  v_id text;
  v_secret text;
  v_old_id text;
  v_id_changed boolean;
begin
  v_ref := nullif(btrim(coalesce(new.telematics_vehicle_id, '')), '');
  if TG_OP = 'UPDATE' then
    v_old_id := nullif(btrim(coalesce(old.rio_tracking_id, '')), '');
  else
    v_old_id := null;
  end if;

  if v_ref is null then
    new.rio_tracking_id := null;
    new.rio_secret := null;
    new.rio_check_state := null;
    new.rio_check_at := null;
    new.rio_asset_name := null;
    new.rio_tracker_on := null;
    new.rio_valid_from := null;
    new.rio_valid_to := null;
    new.rio_last_fix_at := null;
    new.rio_error_streak := 0;
    return new;
  end if;

  if v_ref ~* '^rio:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    v_id := lower(substring(v_ref from 5));
    new.telematics_vehicle_id := 'rio:' || v_id;
    v_id_changed := (v_old_id is distinct from v_id);
    new.rio_tracking_id := v_id;
    if v_id_changed then
      new.rio_secret := null;
      new.rio_check_state := 'pending';
      new.rio_check_at := now();
      new.rio_asset_name := null;
      new.rio_tracker_on := null;
      new.rio_valid_from := null;
      new.rio_valid_to := null;
      new.rio_last_fix_at := null;
      new.rio_error_streak := 0;
    end if;
    return new;
  end if;

  if v_ref ~* 'position-sharing\.rio\.cloud' or v_ref ~* '[?&]secret=' then
    v_id := (regexp_match(v_ref, '([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})', 'i'))[1];
    v_secret := (regexp_match(v_ref, '[?&]secret=([^&\s#]+)', 'i'))[1];
    if (v_id is not null) is not true then
      raise exception 'Link RIO bez identyfikatora' using errcode = '22023';
    end if;
    v_id := lower(v_id);
    v_id_changed := (v_old_id is distinct from v_id);
    new.rio_tracking_id := v_id;
    new.telematics_vehicle_id := 'rio:' || v_id;
    if v_secret is not null then
      new.rio_secret := v_secret;
    elsif v_id_changed then
      new.rio_secret := null;
    end if;
    if v_id_changed or new.rio_check_state is null then
      new.rio_check_state := 'pending';
      new.rio_check_at := now();
    end if;
    if v_id_changed then
      new.rio_asset_name := null;
      new.rio_tracker_on := null;
      new.rio_valid_from := null;
      new.rio_valid_to := null;
      new.rio_last_fix_at := null;
      new.rio_error_streak := 0;
    end if;
    return new;
  end if;

  new.rio_tracking_id := null;
  new.rio_secret := null;
  new.rio_check_state := null;
  new.rio_check_at := null;
  new.rio_asset_name := null;
  new.rio_tracker_on := null;
  new.rio_valid_from := null;
  new.rio_valid_to := null;
  new.rio_last_fix_at := null;
  new.rio_error_streak := 0;
  return new;
end;
$$;

revoke all on function public.loads_rio_sanitize() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Cron co 2 min
-- ---------------------------------------------------------------------
do $m$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron')
     and exists (select 1 from pg_extension where extname = 'pg_net') then

    perform cron.unschedule(jobid) from cron.job where jobname = 'tower-rio-links';
    perform cron.schedule('tower-rio-links', '*/2 * * * *', $c$
      select net.http_post(
        url     := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/rio-links',
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'),
          'Content-Type', 'application/json'),
        body    := '{}'::jsonb,
        timeout_milliseconds := 60000)
    $c$);

  else
    raise notice '0261: pg_cron lub pg_net niedostępne — cron tower-rio-links do zaplanowania ręcznie';
  end if;
end
$m$;
