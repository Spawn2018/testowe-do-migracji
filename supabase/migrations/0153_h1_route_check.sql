-- =====================================================================
-- TOWER — Migracja 0153: H-1 kontrola trasy
--
-- Funkcja jest zbudowana i WYŁĄCZONA. security_flags.H1_ROUTE_CHECK = false.
-- Włączy ją właściciel, gdy poda wymiary zestawu (D-83). Brak crona.
-- Puste wymiary nie są uzupełniane. Ryzyko ROUTE_OBSTACLE tylko wtedy,
-- gdy zapis mówi, że przeszkoda jest krytyczna i fizyczna.
-- Komunikat „wymaga zezwolenia” leży w permits i nie tworzy ryzyka.
-- Surowe dane HERE kasowane po 30 dniach. Podsumowanie zostaje.
-- =====================================================================

alter table security_flags drop constraint if exists security_flags_key_check;
alter table security_flags add constraint security_flags_key_check
  check (key in (
    'MFA_HHL_ADMIN', 'EXTERNAL_MESSAGING', 'PERMIT_REQUIRED_NON_STANDARD', 'FUEL_WOB_INGEST',
    'SMS_ZONE_APPROACH', 'SMS_ZONE_ENTER', 'DRIVER_LINK_ACCEPT', 'AUTOMATIC_DECISION_EMAIL',
    'H1_ROUTE_CHECK'
  ));

insert into security_flags (key, enabled, note)
values (
  'H1_ROUTE_CHECK', false,
  'H-1: kontrola trasy HERE. Wyłączona, dopóki właściciel nie poda wymiarów zestawu (D-83).'
)
on conflict (key) do nothing;

create or replace function public.h1_route_check_enabled()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select enabled from security_flags where key = 'H1_ROUTE_CHECK'), false)
$$;
revoke all on function public.h1_route_check_enabled() from public, anon, authenticated;

create or replace function public.h1_route_check_state()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and current_app_user_id() is null then
    raise exception 'Brak aktywnego konta' using errcode = '42501';
  end if;
  return public.h1_route_check_enabled();
end $$;
revoke all on function public.h1_route_check_state() from public, anon;
grant execute on function public.h1_route_check_state() to authenticated;

alter table loads add column if not exists combo_axle_count integer;
alter table loads add column if not exists combo_axle_load_t numeric(8,2);
alter table loads drop constraint if exists loads_combo_axle_count_chk;
alter table loads add constraint loads_combo_axle_count_chk
  check (combo_axle_count is null or combo_axle_count > 0);
alter table loads drop constraint if exists loads_combo_axle_load_chk;
alter table loads add constraint loads_combo_axle_load_chk
  check (combo_axle_load_t is null or combo_axle_load_t > 0);

alter type risk_kind add value if not exists 'ROUTE_OBSTACLE';

create table if not exists public.route_checks (
  id uuid primary key default gen_random_uuid(),
  load_id uuid not null references loads(id) on delete cascade,
  leg text not null check (leg in ('PL', 'SE')),
  checked_at timestamptz not null,
  dims_key text not null,
  status text not null check (status in ('ok', 'bez_here', 'blad')),
  summary text not null,
  permits jsonb not null default '[]'::jsonb,
  obstacles jsonb not null default '[]'::jsonb,
  raw_response jsonb,
  raw_expires_at timestamptz,
  check (raw_response is null or raw_expires_at is not null)
);
create index if not exists route_checks_load_leg_idx on public.route_checks (load_id, leg, checked_at desc);

alter table public.route_checks enable row level security;
revoke all on table public.route_checks from anon, authenticated;
grant select on table public.route_checks to authenticated;
drop policy if exists route_checks_read on public.route_checks;
create policy route_checks_read on public.route_checks for select to authenticated using (
  is_hhl()
  or (
    current_org_kind() = 'CARRIER'
    and exists (
      select 1 from loads l
       where l.id = route_checks.load_id
         and l.carrier_org_id = current_org_id()
    )
  )
);

create table if not exists public.here_usage (
  month date not null,
  service text not null check (service = 'routing'),
  requests integer not null default 0,
  estimated_usd numeric(12,4) not null default 0,
  primary key (month, service)
);
alter table public.here_usage enable row level security;
revoke all on table public.here_usage from anon, authenticated;

create or replace function public.here_note_requests(p_n integer, p_usd numeric, p_now timestamptz default now())
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_month date;
begin
  if p_n is null or p_n < 0 or p_usd is null or p_usd < 0 then
    raise exception 'Zły zapis zużycia HERE' using errcode = '22023';
  end if;
  v_month := (date_trunc('month', p_now at time zone 'Europe/Warsaw'))::date;
  insert into here_usage (month, service, requests, estimated_usd)
  values (v_month, 'routing', p_n, p_usd)
  on conflict (month, service) do update
    set requests = here_usage.requests + excluded.requests,
        estimated_usd = here_usage.estimated_usd + excluded.estimated_usd;
end $$;
revoke all on function public.here_note_requests(integer, numeric, timestamptz) from public, anon, authenticated;

create or replace function public.here_month_spend(p_now timestamptz default now())
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select estimated_usd from here_usage
     where service = 'routing'
       and month = (date_trunc('month', p_now at time zone 'Europe/Warsaw'))::date
  ), 0)
$$;
revoke all on function public.here_month_spend(timestamptz) from public, anon, authenticated;

create or replace function public.here_budget_view()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_usd numeric; v_n integer; v_on boolean; v_level text;
begin
  if (is_hhl()) is not true then
    raise exception 'Stan HERE widzi wyłącznie HHL' using errcode = '42501';
  end if;
  v_on := public.h1_route_check_enabled();
  select coalesce(requests, 0), coalesce(estimated_usd, 0)
    into v_n, v_usd
    from here_usage
   where service = 'routing'
     and month = (date_trunc('month', now() at time zone 'Europe/Warsaw'))::date;
  v_n := coalesce(v_n, 0);
  v_usd := coalesce(v_usd, 0);
  v_level := case
    when v_on is not true then 'off'
    when v_usd >= 100 then 'stop'
    when v_usd >= 80 then 'high'
    when v_usd >= 50 then 'warn'
    else 'ok'
  end;
  return jsonb_build_object(
    'enabled', v_on,
    'requests', v_n,
    'estimated_usd', v_usd,
    'budget_usd', 100,
    'level', v_level
  );
end $$;
revoke all on function public.here_budget_view() from public, anon;
grant execute on function public.here_budget_view() to authenticated;

create or replace function public.purge_here_route_raw(p_now timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_n integer;
begin
  update route_checks
     set raw_response = null
   where raw_response is not null
     and raw_expires_at is not null
     and raw_expires_at <= p_now;
  get diagnostics v_n = row_count;
  return v_n;
end $$;
revoke all on function public.purge_here_route_raw(timestamptz) from public, anon, authenticated;

create or replace function public.h1_record_route_check(
  p_load uuid,
  p_leg text,
  p_checked_at timestamptz,
  p_dims_key text,
  p_status text,
  p_summary text,
  p_permits jsonb,
  p_obstacles jsonb,
  p_raw jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_obs jsonb;
  v_keep text[] := '{}';
  v_dedup text;
  v_place text;
  v_limit text;
  v_value text;
begin
  if p_leg not in ('PL', 'SE') then
    raise exception 'Zła noga trasy' using errcode = '22023';
  end if;
  if p_status not in ('ok', 'bez_here', 'blad') then
    raise exception 'Zły stan kontroli' using errcode = '22023';
  end if;
  if p_summary is null or length(btrim(p_summary)) = 0 then
    raise exception 'Brak podsumowania' using errcode = '22023';
  end if;
  insert into route_checks (
    load_id, leg, checked_at, dims_key, status, summary, permits, obstacles, raw_response, raw_expires_at
  ) values (
    p_load, p_leg, p_checked_at, p_dims_key, p_status, p_summary,
    coalesce(p_permits, '[]'::jsonb), coalesce(p_obstacles, '[]'::jsonb),
    p_raw, case when p_raw is null then null else p_checked_at + interval '30 days' end
  )
  returning id into v_id;

  if p_status = 'ok' then
    for v_obs in select value from jsonb_array_elements(coalesce(p_obstacles, '[]'::jsonb))
    loop
      if coalesce(v_obs->>'critical', '') in ('true', 't') then
        v_place := coalesce(v_obs->>'place', 'miejsce');
        v_limit := coalesce(v_obs->>'limitText', '');
        v_value := coalesce(v_obs->>'setText', '');
        v_dedup := 'ROUTE_OBSTACLE:' || p_load::text || ':' || p_leg || ':' || md5(v_place || '|' || v_limit);
        v_keep := v_keep || v_dedup;
        perform raise_risk(
          p_load, 'ROUTE_OBSTACLE', 'CRITICAL',
          'Przeszkoda na trasie: ' || v_place,
          jsonb_build_object(
            'title_key', 'rk_route_obstacle',
            'params', jsonb_build_object('place', v_place, 'limit', v_limit, 'value', v_value),
            'leg', p_leg
          ),
          v_dedup
        );
      end if;
    end loop;
    update risk_signals
       set resolved_at = p_checked_at
     where load_id = p_load
       and kind = 'ROUTE_OBSTACLE'
       and resolved_at is null
       and dedup_key like 'ROUTE_OBSTACLE:' || p_load::text || ':' || p_leg || ':%'
       and not (dedup_key = any (v_keep));
  end if;
  return v_id;
end $$;
revoke all on function public.h1_record_route_check(uuid, text, timestamptz, text, text, text, jsonb, jsonb, jsonb)
  from public, anon, authenticated;

-- Widoczność: HHL i przewoźnik. KSH nie (nie jest w HHL_PRZEWOZNIK ani WSZYSCY).
create or replace function public.risk_audience_for(p_kind text, p_detail jsonb)
returns risk_audience
language plpgsql
stable
security definer
set search_path = public
as $function$
declare v_dir text; v_inv text;
begin
  if auth.uid() is not null and current_app_user_id() is null then
    raise exception 'Brak aktywnego konta' using errcode = '42501';
  end if;
  if p_kind in ('FERRY', 'ROAD_SE', 'ROAD_PL', 'WEATHER', 'ETA_BREACH') then
    return 'WSZYSCY';
  end if;
  if p_kind = 'RESOURCE_MISSING' and coalesce(p_detail->>'rule', '') = 'ORDER_NO'
     and coalesce(p_detail->>'side', '') = 'HHL' then
    return 'HHL';
  end if;
  if p_kind in ('SILENT_VEHICLE', 'AUTO_STATUS', 'LOADING_UNCONFIRMED', 'RESOURCE_MISSING',
                'DOC_MISSING', 'PERMIT', 'INSURANCE', 'LATE_DATE_CHANGE', 'ROUTE_OBSTACLE') then
    return 'HHL_PRZEWOZNIK';
  end if;
  if p_kind in ('SEQUENCE', 'DATES_UNCONFIRMED') then
    return 'HHL_KLIENT';
  end if;
  if p_kind = 'INVOICE_MISMATCH' then
    v_dir := upper(coalesce(p_detail->>'direction', ''));
    v_inv := p_detail->>'invoice_id';
    if v_dir = '' and v_inv ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      select i.direction::text into v_dir from invoices i where i.id = v_inv::uuid;
    end if;
    return case coalesce(v_dir, '')
             when 'KOSZT' then 'HHL_PRZEWOZNIK'
             when 'PRZYCHOD' then 'HHL_KLIENT'
             else 'HHL' end;
  end if;
  return 'HHL';
end $function$;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.h1_route_check_enabled() to service_role;
    grant execute on function public.here_note_requests(integer, numeric, timestamptz) to service_role;
    grant execute on function public.here_month_spend(timestamptz) to service_role;
    grant execute on function public.purge_here_route_raw(timestamptz) to service_role;
    grant execute on function public.h1_record_route_check(uuid, text, timestamptz, text, text, text, jsonb, jsonb, jsonb) to service_role;
  end if;
end $$;
