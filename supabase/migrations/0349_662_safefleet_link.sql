-- #662 PILNE: SafeFleet — lokalizacja z linku tymczasowego (SG-27).
-- Źródło pozycji SAFEFLEET; token w kolumnie bez SELECT (jak rio_secret); cron co 2 min.

alter type public.position_source add value if not exists 'SAFEFLEET';

alter table public.loads
  add column if not exists safefleet_token text,
  add column if not exists safefleet_error_streak integer not null default 0,
  add column if not exists safefleet_check_state text,
  add column if not exists safefleet_check_at timestamptz,
  add column if not exists safefleet_last_fix_at timestamptz,
  add column if not exists safefleet_trajectory_done boolean not null default false;

comment on column public.loads.safefleet_token is
  '#662: token 32 hex z linku tymczasowego SafeFleet — bez SELECT dla authenticated (jak rio_secret).';
comment on column public.loads.safefleet_check_state is
  '#662: ok|pending|invalid|down — stan ostatniego odczytu safefleet-poll.';

alter table public.loads drop constraint if exists loads_safefleet_check_state_chk;
alter table public.loads
  add constraint loads_safefleet_check_state_chk
  check (
    safefleet_check_state is null
    or safefleet_check_state in ('ok', 'pending', 'invalid', 'down')
  );

-- Token: zero uprawnień dla ról API (zapis tylko wyzwalaczem / service_role).
revoke all (safefleet_token) on table public.loads from public, anon, authenticated;

do $g$
declare
  v_cols text;
begin
  -- Jak B6: INSERT/UPDATE bez kolumn sekretów.
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
    into v_cols
    from information_schema.columns
   where table_schema = 'public' and table_name = 'loads'
     and column_name not in ('rio_secret', 'safefleet_token');
  if v_cols is not null then
    execute 'revoke insert, update on table public.loads from authenticated';
    execute format('grant insert (%s) on table public.loads to authenticated', v_cols);
    execute format('grant update (%s) on table public.loads to authenticated', v_cols);
  end if;
end
$g$;

grant select (
  safefleet_error_streak, safefleet_check_state, safefleet_check_at,
  safefleet_last_fix_at, safefleet_trajectory_done
) on table public.loads to authenticated;

-- Maskowanie tokenu w audit_log (bez przepisywania całej audit_row_change).
create or replace function public.audit_mask_safefleet_token()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.old_value is not null
     and new.old_value ? 'safefleet_token'
     and jsonb_typeof(new.old_value -> 'safefleet_token') <> 'null' then
    new.old_value := jsonb_set(new.old_value, '{safefleet_token}', '"••••"'::jsonb);
  end if;
  if new.new_value is not null
     and new.new_value ? 'safefleet_token'
     and jsonb_typeof(new.new_value -> 'safefleet_token') <> 'null' then
    new.new_value := jsonb_set(new.new_value, '{safefleet_token}', '"••••"'::jsonb);
  end if;
  return new;
end;
$$;

revoke all on function public.audit_mask_safefleet_token() from public, anon, authenticated;

drop trigger if exists trg_audit_mask_safefleet_token on public.audit_log;
create trigger trg_audit_mask_safefleet_token
  before insert on public.audit_log
  for each row
  execute function public.audit_mask_safefleet_token();

-- Wyzwalacz: URL SafeFleet → token + znacznik safefleet:&lt;6&gt; + provider.
create or replace function public.loads_safefleet_sanitize()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ref text;
  v_token text;
  v_old_token text;
  v_changed boolean;
begin
  v_ref := nullif(btrim(coalesce(new.telematics_vehicle_id, '')), '');
  v_old_token := case when TG_OP = 'UPDATE' then old.safefleet_token else null end;

  if v_ref is null then
    new.safefleet_token := null;
    new.safefleet_error_streak := 0;
    new.safefleet_check_state := null;
    new.safefleet_check_at := null;
    new.safefleet_last_fix_at := null;
    new.safefleet_trajectory_done := false;
    if new.telematics_provider = 'SAFEFLEET' then
      new.telematics_provider := null;
    end if;
    return new;
  end if;

  -- Już zapisany znacznik (bez pełnego URL).
  if v_ref ~* '^safefleet:[0-9a-f]{6}$' then
    if (v_old_token is not null) is not true
       or lower(right(v_old_token, 6)) is distinct from lower(substring(v_ref from 11)) then
      -- Znacznik bez tokenu w NEW i bez zgodnego OLD — nie da się odtworzyć klucza.
      if (v_old_token is not null) is not true then
        raise exception 'Link SafeFleet wymaga ponownego wklejenia pełnego adresu'
          using errcode = '22023';
      end if;
    end if;
    new.telematics_provider := 'SAFEFLEET';
    new.telematics_vehicle_id := lower(v_ref);
    new.safefleet_token := v_old_token;
    return new;
  end if;

  -- Pełny URL tymczasowy.
  v_token := (regexp_match(
    v_ref,
    '^https://portal\.safefleet\.pl/safefleet/temporary_link/view/([0-9a-f]{32})/?$',
    'i'
  ))[1];

  if v_token is not null then
    v_token := lower(v_token);
    v_changed := (v_old_token is distinct from v_token);
    new.safefleet_token := v_token;
    new.telematics_provider := 'SAFEFLEET';
    new.telematics_vehicle_id := 'safefleet:' || right(v_token, 6);
    if v_changed or new.safefleet_check_state is null then
      new.safefleet_check_state := 'pending';
      new.safefleet_check_at := now();
      new.safefleet_error_streak := 0;
      new.safefleet_last_fix_at := null;
      new.safefleet_trajectory_done := false;
    end if;
    return new;
  end if;

  -- Wygląda na SafeFleet, ale wzór zły.
  if v_ref ~* 'safefleet\.pl' or v_ref ~* 'temporary_link' then
    raise exception 'Nieprawidłowy link SafeFleet — oczekiwany adres portal.safefleet.pl/…/view/<32 hex>/'
      using errcode = '22023';
  end if;

  -- Inny dostawca — wyczyść SafeFleet.
  new.safefleet_token := null;
  new.safefleet_error_streak := 0;
  new.safefleet_check_state := null;
  new.safefleet_check_at := null;
  new.safefleet_last_fix_at := null;
  new.safefleet_trajectory_done := false;
  if new.telematics_provider = 'SAFEFLEET' then
    new.telematics_provider := null;
  end if;
  return new;
end;
$$;

revoke all on function public.loads_safefleet_sanitize() from public, anon, authenticated;

drop trigger if exists trg_loads_safefleet_sanitize on public.loads;
create trigger trg_loads_safefleet_sanitize
  before insert or update of telematics_vehicle_id, telematics_provider, safefleet_token
  on public.loads
  for each row
  execute function public.loads_safefleet_sanitize();

-- Flaga (domyślnie włączona — SG-27 w trasie).
alter table public.security_flags drop constraint if exists security_flags_key_check;
alter table public.security_flags add constraint security_flags_key_check check (key in (
  'MFA_HHL_ADMIN', 'EXTERNAL_MESSAGING', 'PERMIT_REQUIRED_NON_STANDARD', 'FUEL_WOB_INGEST',
  'SMS_ZONE_APPROACH', 'SMS_ZONE_ENTER', 'DRIVER_LINK_ACCEPT', 'AUTOMATIC_DECISION_EMAIL',
  'H1_ROUTE_CHECK', 'H3_CORRIDOR_OBSTACLES', 'H6_MAP_OBSTACLES', 'FUEL_SE_PL_INGEST',
  'TELM_EMTRACK_WEB', 'TELM_RIO_LINKS', 'TELM_SAFEFLEET_POLL'
));

insert into public.security_flags (key, enabled, note)
values (
  'TELM_SAFEFLEET_POLL',
  true,
  '#662: odczyt pozycji z linku tymczasowego SafeFleet co 2 min.'
)
on conflict (key) do update
  set note = excluded.note;

create or replace function public.telm_safefleet_poll_enabled()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select enabled from public.security_flags where key = 'TELM_SAFEFLEET_POLL'), false);
$$;

revoke all on function public.telm_safefleet_poll_enabled() from public, anon, authenticated;
grant execute on function public.telm_safefleet_poll_enabled() to service_role;

-- Blokada nakładania się przebiegów.
create table if not exists public.safefleet_poll_lock (
  id int primary key default 1 check (id = 1),
  token text,
  until_at timestamptz
);

alter table public.safefleet_poll_lock enable row level security;
revoke all on table public.safefleet_poll_lock from public, anon, authenticated;

create or replace function public.safefleet_poll_lock_try(p_ttl_sec int default 90, p_token text default null)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text := coalesce(nullif(btrim(p_token), ''), gen_random_uuid()::text);
  v_ttl int := greatest(coalesce(p_ttl_sec, 90), 15);
begin
  insert into public.safefleet_poll_lock (id, token, until_at)
  values (1, v_token, now() + make_interval(secs => v_ttl))
  on conflict (id) do update
    set token = excluded.token,
        until_at = excluded.until_at
  where public.safefleet_poll_lock.until_at is null
     or public.safefleet_poll_lock.until_at < now()
     or public.safefleet_poll_lock.token = v_token;
  return exists (
    select 1 from public.safefleet_poll_lock
     where id = 1 and token = v_token and until_at > now()
  );
end;
$$;

create or replace function public.safefleet_poll_lock_release(p_token text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.safefleet_poll_lock
     set until_at = now() - interval '1 second'
   where id = 1
     and (p_token is null or token = p_token);
end;
$$;

revoke all on function public.safefleet_poll_lock_try(int, text) from public, anon, authenticated;
revoke all on function public.safefleet_poll_lock_release(text) from public, anon, authenticated;
grant execute on function public.safefleet_poll_lock_try(int, text) to service_role;
grant execute on function public.safefleet_poll_lock_release(text) to service_role;

-- Jednorazowo: istniejące pełne URL SafeFleet (w tym SG-27) → wyzwalacz przenosi token.
do $once$
declare
  n int;
begin
  update public.loads
     set telematics_vehicle_id = telematics_vehicle_id
   where telematics_vehicle_id ~* '^https://portal\.safefleet\.pl/safefleet/temporary_link/view/[0-9a-f]{32}/?$';
  get diagnostics n = row_count;
  raise notice '0349: przeniesiono % linków SafeFleet do safefleet_token', n;
end
$once$;

-- Cron co 2 min.
create or replace function public.tower_cron_safefleet_poll_invoke()
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
    raise notice 'tower_cron_safefleet_poll_invoke: brak vault.decrypted_secrets';
    return;
  end if;
  if to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') is null then
    raise notice 'tower_cron_safefleet_poll_invoke: brak net.http_post';
    return;
  end if;
  execute $q$
    select max(decrypted_secret) filter (where name = 'project_url'),
           max(decrypted_secret) filter (where name = 'service_role_key')
      from vault.decrypted_secrets
  $q$ into v_url, v_key;
  if v_url is null or v_url = '' or v_key is null or v_key = '' then
    raise notice 'tower_cron_safefleet_poll_invoke: brak project_url/service_role_key';
    return;
  end if;
  perform net.http_post(
    url     := rtrim(v_url, '/') || '/functions/v1/safefleet-poll',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_key,
      'Content-Type', 'application/json'),
    body    := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
end;
$$;

revoke all on function public.tower_cron_safefleet_poll_invoke() from public, anon, authenticated;
grant execute on function public.tower_cron_safefleet_poll_invoke() to postgres;

do $cron$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron')
     and to_regprocedure('cron.schedule(text,text,text)') is not null
  then
    perform cron.unschedule(jobid) from cron.job where jobname = 'tower-safefleet-poll';
    perform cron.schedule(
      'tower-safefleet-poll',
      '*/2 * * * *',
      $c$select public.tower_cron_safefleet_poll_invoke();$c$
    );
  else
    raise notice '0349: pg_cron niedostępne — tower-safefleet-poll do zaplanowania ręcznie';
  end if;
end
$cron$;
