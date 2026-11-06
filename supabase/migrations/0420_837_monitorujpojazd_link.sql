-- #837 PILNE: monitorujpojazd — lokalizacja z linku udostępnienia (TS-08).
-- Token w kolumnie bez SELECT (jak safefleet_token / rio_secret); cron co 2 min.
-- API: GET https://sledz.monitorujpojazd.pl/websatadmin/share/data/<uuid>/
-- (strona share odświeża co 30 s; brak endpointu historii trasy).

alter type public.position_source add value if not exists 'MONITORUJPOJAZD';

alter table public.loads
  add column if not exists monitorujpojazd_token text,
  add column if not exists monitorujpojazd_error_streak integer not null default 0,
  add column if not exists monitorujpojazd_check_state text,
  add column if not exists monitorujpojazd_check_at timestamptz,
  add column if not exists monitorujpojazd_last_fix_at timestamptz;

comment on column public.loads.monitorujpojazd_token is
  '#837: UUID z linku sledz.monitorujpojazd.pl/share/<uuid>/ — bez SELECT dla authenticated.';
comment on column public.loads.monitorujpojazd_check_state is
  '#837: ok|pending|invalid|down — stan ostatniego odczytu monitorujpojazd-poll.';

alter table public.loads drop constraint if exists loads_monitorujpojazd_check_state_chk;
alter table public.loads
  add constraint loads_monitorujpojazd_check_state_chk
  check (
    monitorujpojazd_check_state is null
    or monitorujpojazd_check_state in ('ok', 'pending', 'invalid', 'down')
  );

revoke all (monitorujpojazd_token) on table public.loads from public, anon, authenticated;

do $g$
declare
  v_cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
    into v_cols
    from information_schema.columns
   where table_schema = 'public' and table_name = 'loads'
     and column_name not in ('rio_secret', 'safefleet_token', 'monitorujpojazd_token');
  if v_cols is not null then
    execute 'revoke insert, update on table public.loads from authenticated';
    execute format('grant insert (%s) on table public.loads to authenticated', v_cols);
    execute format('grant update (%s) on table public.loads to authenticated', v_cols);
  end if;
end
$g$;

grant select (
  monitorujpojazd_error_streak, monitorujpojazd_check_state, monitorujpojazd_check_at,
  monitorujpojazd_last_fix_at
) on table public.loads to authenticated;

-- Maska tokenu + pełnego URL w audit_log.
create or replace function public.audit_mask_monitorujpojazd_url_in_jsonb(p jsonb)
returns jsonb
language plpgsql
immutable
set search_path = public
as $$
declare
  v_ref text;
  v_token text;
  v_hex text;
begin
  if p is null or (p ? 'telematics_vehicle_id') is not true then
    return p;
  end if;
  if jsonb_typeof(p -> 'telematics_vehicle_id') <> 'string' then
    return p;
  end if;
  v_ref := p ->> 'telematics_vehicle_id';
  v_token := (regexp_match(
    v_ref,
    'https?://sledz\.monitorujpojazd\.pl/share/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/?',
    'i'
  ))[1];
  if v_token is null then
    return p;
  end if;
  v_hex := lower(replace(v_token, '-', ''));
  return jsonb_set(
    p,
    '{telematics_vehicle_id}',
    to_jsonb(('mp:' || right(v_hex, 6))::text)
  );
end;
$$;

revoke all on function public.audit_mask_monitorujpojazd_url_in_jsonb(jsonb)
  from public, anon, authenticated;

create or replace function public.audit_mask_monitorujpojazd_token()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.old_value is not null
     and new.old_value ? 'monitorujpojazd_token'
     and jsonb_typeof(new.old_value -> 'monitorujpojazd_token') <> 'null' then
    new.old_value := jsonb_set(new.old_value, '{monitorujpojazd_token}', '"••••"'::jsonb);
  end if;
  if new.new_value is not null
     and new.new_value ? 'monitorujpojazd_token'
     and jsonb_typeof(new.new_value -> 'monitorujpojazd_token') <> 'null' then
    new.new_value := jsonb_set(new.new_value, '{monitorujpojazd_token}', '"••••"'::jsonb);
  end if;
  new.old_value := public.audit_mask_monitorujpojazd_url_in_jsonb(new.old_value);
  new.new_value := public.audit_mask_monitorujpojazd_url_in_jsonb(new.new_value);
  return new;
end;
$$;

revoke all on function public.audit_mask_monitorujpojazd_token() from public, anon, authenticated;

drop trigger if exists trg_audit_mask_monitorujpojazd_token on public.audit_log;
create trigger trg_audit_mask_monitorujpojazd_token
  before insert on public.audit_log
  for each row
  execute function public.audit_mask_monitorujpojazd_token();

-- audit_row_change: skip pól polla + monitorujpojazd_token w v_secret (bazuje na 0350).
create or replace function public.audit_row_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_old jsonb; v_new jsonb; o jsonb; n jsonb; k text;
  v_skip constant text[] := array[
    'updated_at', 'eta_site', 'eta_confidence_min', 'eta_basis', 'eta_computed_at',
    'delay_minutes', 'fetched_at', 'beat_at', 'beats', 'last_seen_at',
    'rio_check_at', 'rio_last_fix_at',
    'safefleet_check_at', 'safefleet_last_fix_at', 'safefleet_error_streak',
    'safefleet_check_state', 'safefleet_trajectory_done',
    'monitorujpojazd_check_at', 'monitorujpojazd_last_fix_at', 'monitorujpojazd_error_streak',
    'monitorujpojazd_check_state'
  ];
  v_secret constant text[] := array['rio_secret', 'safefleet_token', 'monitorujpojazd_token'];
  v_pii constant text[] := array[
    'driver_name', 'driver_phone', 'phone_national', 'phone', 'contact_phone',
    'contact_name', 'email_personal'
  ];
  v_keep_fee constant text[] := array['side', 'status', 'proposed_by_kind', 'load_id', 'amount_eur', 'kind'];
  v_keep_doc constant text[] := array['visible_to', 'category', 'load_id', 'file_name', 'uploaded_by'];
  v_id text; v_user uuid; v_source text; v_full jsonb;
  v_mask text;
  v_rodo boolean;
  v_reason text;
  v_load uuid;
  v_carrier uuid;
  v_client uuid;
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
    if tg_table_name = 'shipment_items'
       and (select count(*) from jsonb_object_keys(v_new)) = 1
       and (v_new ? 'schedule_row') then
      return null;
    end if;
    if tg_table_name = 'load_agreed_fees' then
      foreach k in array v_keep_fee loop
        if o ? k and (v_old ? k) is not true then
          v_old := v_old || jsonb_build_object(k, o -> k);
        end if;
        if n ? k and (v_new ? k) is not true then
          v_new := v_new || jsonb_build_object(k, n -> k);
        end if;
      end loop;
    end if;
    if tg_table_name = 'documents' then
      foreach k in array v_keep_doc loop
        if o ? k and (v_old ? k) is not true then
          v_old := v_old || jsonb_build_object(k, o -> k);
        end if;
        if n ? k and (v_new ? k) is not true then
          v_new := v_new || jsonb_build_object(k, n -> k);
        end if;
      end loop;
    end if;
    if tg_table_name in ('loads', 'load')
       and (o ->> 'carrier_org_id') is distinct from (n ->> 'carrier_org_id') then
      v_old := v_old || jsonb_build_object('carrier_org_id', o -> 'carrier_org_id');
      v_new := v_new || jsonb_build_object('carrier_org_id', n -> 'carrier_org_id');
    end if;
  else
    v_old := o; v_new := n;
  end if;

  v_reason := nullif(btrim(current_setting('tower.audit_reason', true)), '');
  if v_reason is not null then
    v_new := coalesce(v_new, '{}'::jsonb) || jsonb_build_object('_reason', v_reason);
  end if;

  v_source := nullif(btrim(current_setting('tower.audit_source', true)), '');
  v_rodo := (v_source = 'rodo') is true;

  foreach k in array (v_secret || v_pii) loop
    if k = any (v_secret) then
      v_mask := '"••••"';
    elsif v_rodo and k = any (v_pii) then
      v_mask := '"[dane osobowe]"';
    else
      v_mask := null;
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

  v_full := coalesce(n, o);
  v_id := coalesce(
    v_full ->> 'id',
    v_full ->> 'key',
    v_full ->> 'kind',
    nullif((v_full ->> 'invoice_id') || ':' || (v_full ->> 'load_id'), ':'),
    nullif((v_full ->> 'load_id') || ':' || (v_full ->> 'permit_id'), ':'),
    nullif((v_full ->> 'event_group') || ':' || (v_full ->> 'org_kind'), ':'),
    nullif((v_full ->> 'currency') || ':' || (v_full ->> 'rate_date'), ':'),
    nullif((v_full ->> 'project_id') || ':' || (v_full ->> 'category'), ':'),
    nullif((v_full ->> 'list_key') || ':' || (v_full ->> 'slot'), ':'),
    case when public.audit_history_try_uuid(v_full ->> 'load_id') is not null
      then v_full ->> 'load_id' end,
    tg_table_name
  );

  select s.out_load, s.out_carrier, s.out_client
    into v_load, v_carrier, v_client
    from public.audit_history_compute_scope(
      tg_table_name, v_id, v_old, v_new, null, null, null
    ) s;
  if v_load is null then
    v_load := public.audit_history_try_uuid(v_full ->> 'load_id');
  end if;
  if v_load is null and tg_table_name in ('loads', 'load') then
    v_load := public.audit_history_try_uuid(v_full ->> 'id');
  end if;

  begin
    v_user := public.current_app_user_id();
  exception when others then
    v_user := null;
  end;

  if v_user is null then
    v_source := coalesce(v_source, 'system');
  end if;

  insert into audit_log (
    user_id, action, entity, entity_id, old_value, new_value, source,
    load_id, scope_carrier_org_id, scope_client_org_id
  ) values (
    v_user, 'ROW_' || tg_op, tg_table_name, v_id, v_old, v_new, v_source,
    v_load, v_carrier, v_client
  );
  return null;
end $$;

revoke all on function public.audit_row_change() from public, anon, authenticated;

comment on function public.audit_row_change() is
  'HIST-11 + #466 + #505 + #484 + #583 + #662-b + #837: PII; skip poll; sekrety ••••.';

-- Wyzwalacz: URL monitorujpojazd → token + znacznik mp:<6> + provider.
create or replace function public.loads_monitorujpojazd_sanitize()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ref text;
  v_token text;
  v_old_token text;
  v_hex text;
  v_changed boolean;
begin
  v_ref := nullif(btrim(coalesce(new.telematics_vehicle_id, '')), '');
  v_old_token := case when TG_OP = 'UPDATE' then old.monitorujpojazd_token else null end;

  if v_ref is null then
    new.monitorujpojazd_token := null;
    new.monitorujpojazd_error_streak := 0;
    new.monitorujpojazd_check_state := null;
    new.monitorujpojazd_check_at := null;
    new.monitorujpojazd_last_fix_at := null;
    if new.telematics_provider = 'MONITORUJPOJAZD' then
      new.telematics_provider := null;
    end if;
    return new;
  end if;

  -- Już zapisany znacznik (bez pełnego URL).
  if v_ref ~* '^mp:[0-9a-f]{6}$' then
    if (v_old_token is not null) is not true
       or lower(right(replace(v_old_token, '-', ''), 6)) is distinct from lower(substring(v_ref from 4)) then
      if (v_old_token is not null) is not true then
        raise exception 'Link monitorujpojazd wymaga ponownego wklejenia pełnego adresu'
          using errcode = '22023';
      end if;
    end if;
    new.telematics_provider := 'MONITORUJPOJAZD';
    new.telematics_vehicle_id := lower(v_ref);
    new.monitorujpojazd_token := v_old_token;
    return new;
  end if;

  -- Pełny URL (http lub https — odpytywanie tylko https).
  v_token := (regexp_match(
    v_ref,
    '^https?://sledz\.monitorujpojazd\.pl/share/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/?$',
    'i'
  ))[1];

  if v_token is not null then
    v_token := lower(v_token);
    v_hex := replace(v_token, '-', '');
    v_changed := (v_old_token is distinct from v_token);
    new.monitorujpojazd_token := v_token;
    new.telematics_provider := 'MONITORUJPOJAZD';
    new.telematics_vehicle_id := 'mp:' || right(v_hex, 6);
    if v_changed or new.monitorujpojazd_check_state is null then
      new.monitorujpojazd_check_state := 'pending';
      new.monitorujpojazd_check_at := now();
      new.monitorujpojazd_error_streak := 0;
      new.monitorujpojazd_last_fix_at := null;
    end if;
    return new;
  end if;

  -- Wygląda na monitorujpojazd, ale wzór zły (tylko ten host — ochrona przed SSRF).
  if v_ref ~* 'monitorujpojazd\.pl' then
    raise exception 'Nieprawidłowy link monitorujpojazd — oczekiwany adres sledz.monitorujpojazd.pl/share/<uuid>/'
      using errcode = '22023';
  end if;

  -- Inny dostawca — wyczyść monitorujpojazd.
  new.monitorujpojazd_token := null;
  new.monitorujpojazd_error_streak := 0;
  new.monitorujpojazd_check_state := null;
  new.monitorujpojazd_check_at := null;
  new.monitorujpojazd_last_fix_at := null;
  if new.telematics_provider = 'MONITORUJPOJAZD' then
    new.telematics_provider := null;
  end if;
  return new;
end;
$$;

revoke all on function public.loads_monitorujpojazd_sanitize() from public, anon, authenticated;

drop trigger if exists trg_loads_monitorujpojazd_sanitize on public.loads;
create trigger trg_loads_monitorujpojazd_sanitize
  before insert or update of telematics_vehicle_id, telematics_provider, monitorujpojazd_token
  on public.loads
  for each row
  execute function public.loads_monitorujpojazd_sanitize();

-- Flaga (domyślnie włączona — TS-08 w trasie).
alter table public.security_flags drop constraint if exists security_flags_key_check;
alter table public.security_flags add constraint security_flags_key_check check (key in (
  'MFA_HHL_ADMIN', 'EXTERNAL_MESSAGING', 'PERMIT_REQUIRED_NON_STANDARD', 'FUEL_WOB_INGEST',
  'SMS_ZONE_APPROACH', 'SMS_ZONE_ENTER', 'DRIVER_LINK_ACCEPT', 'AUTOMATIC_DECISION_EMAIL',
  'H1_ROUTE_CHECK', 'H3_CORRIDOR_OBSTACLES', 'H6_MAP_OBSTACLES', 'FUEL_SE_PL_INGEST',
  'TELM_EMTRACK_WEB', 'TELM_RIO_LINKS', 'TELM_SAFEFLEET_POLL', 'TELM_MONITORUJPOJAZD_POLL'
));

insert into public.security_flags (key, enabled, note)
values (
  'TELM_MONITORUJPOJAZD_POLL',
  true,
  '#837: odczyt pozycji z linku sledz.monitorujpojazd.pl co 2 min.'
)
on conflict (key) do update
  set note = excluded.note;

create or replace function public.telm_monitorujpojazd_poll_enabled()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select enabled from public.security_flags where key = 'TELM_MONITORUJPOJAZD_POLL'), false);
$$;

revoke all on function public.telm_monitorujpojazd_poll_enabled() from public, anon, authenticated;
grant execute on function public.telm_monitorujpojazd_poll_enabled() to service_role;

create table if not exists public.monitorujpojazd_poll_lock (
  id int primary key default 1 check (id = 1),
  token text,
  until_at timestamptz
);

alter table public.monitorujpojazd_poll_lock enable row level security;
revoke all on table public.monitorujpojazd_poll_lock from public, anon, authenticated;

create or replace function public.monitorujpojazd_poll_lock_try(p_ttl_sec int default 90, p_token text default null)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text := coalesce(nullif(btrim(p_token), ''), gen_random_uuid()::text);
  v_ttl int := greatest(coalesce(p_ttl_sec, 90), 15);
begin
  insert into public.monitorujpojazd_poll_lock (id, token, until_at)
  values (1, v_token, now() + make_interval(secs => v_ttl))
  on conflict (id) do update
    set token = excluded.token,
        until_at = excluded.until_at
  where public.monitorujpojazd_poll_lock.until_at is null
     or public.monitorujpojazd_poll_lock.until_at < now()
     or public.monitorujpojazd_poll_lock.token = v_token;
  return exists (
    select 1 from public.monitorujpojazd_poll_lock
     where id = 1 and token = v_token and until_at > now()
  );
end;
$$;

create or replace function public.monitorujpojazd_poll_lock_release(p_token text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.monitorujpojazd_poll_lock
     set until_at = now() - interval '1 second'
   where id = 1
     and (p_token is null or token = p_token);
end;
$$;

revoke all on function public.monitorujpojazd_poll_lock_try(int, text) from public, anon, authenticated;
revoke all on function public.monitorujpojazd_poll_lock_release(text) from public, anon, authenticated;
grant execute on function public.monitorujpojazd_poll_lock_try(int, text) to service_role;
grant execute on function public.monitorujpojazd_poll_lock_release(text) to service_role;

-- Jednorazowo: istniejące pełne URL (w tym TS-08) → wyzwalacz przenosi token.
do $once$
declare
  n int;
begin
  update public.loads
     set telematics_vehicle_id = telematics_vehicle_id
   where telematics_vehicle_id ~* '^https?://sledz\.monitorujpojazd\.pl/share/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/?$';
  get diagnostics n = row_count;
  raise notice '0420: przeniesiono % linków monitorujpojazd do monitorujpojazd_token', n;
end
$once$;

-- Jednorazowo: maska pełnego URL w audit_log (jeśli już zapisany).
update public.audit_log
   set old_value = public.audit_mask_monitorujpojazd_url_in_jsonb(old_value),
       new_value = public.audit_mask_monitorujpojazd_url_in_jsonb(new_value)
 where (old_value::text ~* 'sledz\.monitorujpojazd\.pl/share/[0-9a-f]{8}-')
    or (new_value::text ~* 'sledz\.monitorujpojazd\.pl/share/[0-9a-f]{8}-');

-- Cron co 2 min.
create or replace function public.tower_cron_monitorujpojazd_poll_invoke()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_key text;
begin
  if to_regclass('vault.decrypted_secrets') is null then
    raise notice 'tower_cron_monitorujpojazd_poll_invoke: brak vault.decrypted_secrets';
    return;
  end if;
  if to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') is null then
    raise notice 'tower_cron_monitorujpojazd_poll_invoke: brak net.http_post';
    return;
  end if;
  execute $q$
    select max(decrypted_secret) filter (where name = 'project_url'),
           max(decrypted_secret) filter (where name = 'service_role_key')
      from vault.decrypted_secrets
  $q$ into v_url, v_key;
  if v_url is null or v_url = '' or v_key is null or v_key = '' then
    raise notice 'tower_cron_monitorujpojazd_poll_invoke: brak project_url/service_role_key';
    return;
  end if;
  perform net.http_post(
    url     := rtrim(v_url, '/') || '/functions/v1/monitorujpojazd-poll',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_key,
      'Content-Type', 'application/json'),
    body    := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
end;
$$;

revoke all on function public.tower_cron_monitorujpojazd_poll_invoke() from public, anon, authenticated;
grant execute on function public.tower_cron_monitorujpojazd_poll_invoke() to postgres;

do $cron$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron')
     and to_regprocedure('cron.schedule(text,text,text)') is not null
  then
    perform cron.unschedule(jobid) from cron.job where jobname = 'tower-monitorujpojazd-poll';
    perform cron.schedule(
      'tower-monitorujpojazd-poll',
      '*/2 * * * *',
      $c$select public.tower_cron_monitorujpojazd_poll_invoke();$c$
    );
  else
    raise notice '0420: pg_cron niedostępne — tower-monitorujpojazd-poll do zaplanowania ręcznie';
  end if;
end
$cron$;
