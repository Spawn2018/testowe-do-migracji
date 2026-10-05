-- 0171 — H-2-PL: HERE Traffic v7 (incidents) jako źródło ROAD_PL; osobna pula traffic.
-- GDDKiA KPD zostaje zapasem. H1/H3/H6 bez zmian (false). Idempotentna.

insert into app_parameters (key, value, label, source) values
  ('HERE_TRAFFIC_FREE', 5000, 'Darmowa pula HERE Real-Time Traffic / miesiąc (Europe/Warsaw) — wstępna', 'H-2-PL 05.10.2026 ~12:27'),
  ('HERE_TRAFFIC_RATE_USD', 0.00292, 'Stawka USD za zapytanie Traffic ponad pulę (Real-Time ~$2.92/1k)', 'H-2-PL 05.10.2026 ~12:27')
on conflict (key) do update
  set value = excluded.value,
      label = excluded.label,
      source = excluded.source,
      updated_at = now();

alter table public.here_usage drop constraint if exists here_usage_service_check;
alter table public.here_usage add constraint here_usage_service_check
  check (service in ('routing', 'attributes', 'tiles', 'matching', 'traffic'));

create or replace function public.here_over_cost(p_service text, p_requests integer)
returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_free numeric;
  v_rate numeric;
  v_n integer := greatest(coalesce(p_requests, 0), 0);
begin
  if p_service = 'tiles' then
    v_free := public.here_param('HERE_TILES_FREE', 30000);
    v_rate := public.here_param('HERE_TILES_RATE_USD', 0.0002);
  elsif p_service = 'traffic' then
    v_free := public.here_param('HERE_TRAFFIC_FREE', 5000);
    v_rate := public.here_param('HERE_TRAFFIC_RATE_USD', 0.00292);
  elsif p_service in ('routing', 'matching', 'attributes') then
    v_free := public.here_param('HERE_ROUTES_FREE', 5000);
    v_rate := public.here_param('HERE_ROUTES_RATE_USD', 0.00275);
  else
    raise exception 'Zła usługa HERE' using errcode = '22023';
  end if;
  return greatest(0, v_n - v_free) * greatest(0, v_rate);
end $$;
revoke all on function public.here_over_cost(text, integer) from public, anon, authenticated;

create or replace function public.here_recalc_month(p_month date)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_routes integer := 0;
  v_routes_over numeric := 0;
begin
  update here_usage u
     set estimated_usd = public.here_over_cost(u.service, u.requests)
   where u.month = p_month and u.service in ('tiles', 'traffic');

  select coalesce(sum(requests), 0) into v_routes
    from here_usage
   where month = p_month and service in ('routing', 'matching', 'attributes');
  v_routes_over := public.here_over_cost('routing', v_routes);

  update here_usage set estimated_usd = 0
   where month = p_month and service in ('routing', 'matching', 'attributes');
  update here_usage set estimated_usd = v_routes_over
   where month = p_month and service = 'routing';
  if v_routes_over > 0 and not exists (
    select 1 from here_usage where month = p_month and service = 'routing'
  ) then
    insert into here_usage (month, service, requests, estimated_usd)
    values (p_month, 'routing', 0, v_routes_over);
  end if;
end $$;
revoke all on function public.here_recalc_month(date) from public, anon, authenticated;

create or replace function public.here_note_service(
  p_service text,
  p_n integer,
  p_usd numeric default 0,
  p_now timestamptz default now()
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month date;
begin
  if (p_service in ('routing', 'attributes', 'tiles', 'matching', 'traffic')) is not true then
    raise exception 'Zła usługa HERE' using errcode = '22023';
  end if;
  if (p_n is not null and p_n >= 0) is not true then
    raise exception 'Zły zapis zużycia HERE' using errcode = '22023';
  end if;
  v_month := (date_trunc('month', p_now at time zone 'Europe/Warsaw'))::date;
  insert into here_usage (month, service, requests, estimated_usd)
  values (v_month, p_service, p_n, 0)
  on conflict (month, service) do update
    set requests = here_usage.requests + excluded.requests;
  perform public.here_recalc_month(v_month);
end $$;
revoke all on function public.here_note_service(text, integer, numeric, timestamptz) from public, anon, authenticated;

create or replace function public.here_budget_view()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_month date;
  v_budget numeric;
  v_tiles_free numeric;
  v_routes_free numeric;
  v_traffic_free numeric;
  v_tiles_rate numeric;
  v_routes_rate numeric;
  v_traffic_rate numeric;
  v_on boolean;
  v_level text;
  v_tiles_n integer := 0;
  v_routes_n integer := 0;
  v_match_n integer := 0;
  v_attr_n integer := 0;
  v_traffic_n integer := 0;
  v_tiles_over numeric := 0;
  v_routes_over numeric := 0;
  v_match_over numeric := 0;
  v_attr_over numeric := 0;
  v_traffic_over numeric := 0;
  v_sum numeric := 0;
  v_pct numeric := 0;
begin
  if (is_hhl()) is not true then
    raise exception 'Stan HERE widzi wyłącznie HHL' using errcode = '42501';
  end if;
  v_month := (date_trunc('month', now() at time zone 'Europe/Warsaw'))::date;
  v_budget := public.here_param('HERE_BUDGET_USD', 100);
  v_tiles_free := public.here_param('HERE_TILES_FREE', 30000);
  v_routes_free := public.here_param('HERE_ROUTES_FREE', 5000);
  v_traffic_free := public.here_param('HERE_TRAFFIC_FREE', 5000);
  v_tiles_rate := public.here_param('HERE_TILES_RATE_USD', 0.0002);
  v_routes_rate := public.here_param('HERE_ROUTES_RATE_USD', 0.00275);
  v_traffic_rate := public.here_param('HERE_TRAFFIC_RATE_USD', 0.00292);

  select coalesce(sum(case when service = 'tiles' then requests else 0 end), 0),
         coalesce(sum(case when service = 'routing' then requests else 0 end), 0),
         coalesce(sum(case when service = 'matching' then requests else 0 end), 0),
         coalesce(sum(case when service = 'attributes' then requests else 0 end), 0),
         coalesce(sum(case when service = 'traffic' then requests else 0 end), 0)
    into v_tiles_n, v_routes_n, v_match_n, v_attr_n, v_traffic_n
    from here_usage
   where month = v_month;

  v_tiles_over := public.here_over_cost('tiles', v_tiles_n);
  v_routes_over := public.here_over_cost('routing', v_routes_n + v_match_n + v_attr_n);
  v_match_over := 0;
  v_attr_over := 0;
  v_traffic_over := public.here_over_cost('traffic', v_traffic_n);
  v_sum := v_tiles_over + v_routes_over + v_traffic_over;
  v_pct := case when v_budget > 0 then round((v_sum / v_budget) * 100, 2) else 0 end;

  -- enabled: dotychczasowe flagi H1/H3/H6 LUB aktywne zużycie traffic / tiles
  v_on := public.h1_route_check_enabled()
       or public.h3_corridor_enabled()
       or public.h6_map_enabled()
       or (v_traffic_n > 0)
       or (v_tiles_n > 0);

  v_level := case
    when v_on is not true then 'off'
    when v_sum >= v_budget then 'stop'
    when v_sum >= v_budget * 0.8 then 'high'
    when v_sum >= v_budget * 0.5 then 'warn'
    else 'ok'
  end;

  return jsonb_build_object(
    'enabled', v_on,
    'month', v_month,
    'budget_usd', v_budget,
    'estimated_usd', v_sum,
    'over_pool_usd', v_sum,
    'pct', v_pct,
    'level', v_level,
    'tiles_open', v_sum < v_budget * 0.8,
    'requests', v_tiles_n + v_routes_n + v_match_n + v_attr_n + v_traffic_n,
    'tiles_requests', v_tiles_n,
    'tiles_pool', v_tiles_free,
    'tiles_over_usd', v_tiles_over,
    'tiles_pct_pool', case when v_tiles_free > 0 then round((v_tiles_n::numeric / v_tiles_free) * 100, 2) else null end,
    'tiles_usd', v_tiles_over,
    'routing_requests', v_routes_n,
    'routing_pool', v_routes_free,
    'routing_over_usd', v_routes_over,
    'routing_pct_pool', case when v_routes_free > 0 then round((v_routes_n::numeric / v_routes_free) * 100, 2) else null end,
    'matching_requests', v_match_n,
    'matching_pool', v_routes_free,
    'matching_over_usd', v_match_over,
    'matching_usd', v_match_over,
    'attributes_requests', v_attr_n,
    'attributes_over_usd', v_attr_over,
    'traffic_requests', v_traffic_n,
    'traffic_pool', v_traffic_free,
    'traffic_over_usd', v_traffic_over,
    'traffic_pct_pool', case when v_traffic_free > 0 then round((v_traffic_n::numeric / v_traffic_free) * 100, 2) else null end,
    'traffic_rate_usd', v_traffic_rate,
    'services', jsonb_build_array(
      jsonb_build_object('service','tiles','requests',v_tiles_n,'pool',v_tiles_free,'over_usd',v_tiles_over,'pct_pool', case when v_tiles_free > 0 then round((v_tiles_n::numeric / v_tiles_free) * 100, 2) else null end),
      jsonb_build_object('service','routing','requests',v_routes_n,'pool',v_routes_free,'over_usd',v_routes_over,'pct_pool', case when v_routes_free > 0 then round((v_routes_n::numeric / v_routes_free) * 100, 2) else null end),
      jsonb_build_object('service','matching','requests',v_match_n,'pool',v_routes_free,'over_usd',v_match_over,'pct_pool', case when v_routes_free > 0 then round((v_match_n::numeric / v_routes_free) * 100, 2) else null end),
      jsonb_build_object('service','traffic','requests',v_traffic_n,'pool',v_traffic_free,'over_usd',v_traffic_over,'pct_pool', case when v_traffic_free > 0 then round((v_traffic_n::numeric / v_traffic_free) * 100, 2) else null end)
    )
  );
end $$;
revoke all on function public.here_budget_view() from public, anon;
grant execute on function public.here_budget_view() to authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.here_over_cost(text, integer) to service_role;
    grant execute on function public.here_recalc_month(date) to service_role;
    grant execute on function public.here_note_service(text, integer, numeric, timestamptz) to service_role;
  end if;
end $$;

comment on function public.here_note_service(text, integer, numeric, timestamptz) is
  'D-78/H-2-PL: zlicza zapytania HERE (tiles/routing/matching/attributes/traffic); koszt = max(0,n−pula)×stawka.';
