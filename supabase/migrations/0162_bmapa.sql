-- 0162 — B-MAPA: zużycie kafelków HERE, geometria trasy na 30 dni, próbka śladu promu (Q-18).
-- H-6 zbudowane jako flaga i zostaje WYŁĄCZONE. H-1 i H-3 bez zmian.
-- Nie rusza transportów. Idempotentna.

alter table security_flags drop constraint if exists security_flags_key_check;
alter table security_flags add constraint security_flags_key_check
  check (key in (
    'MFA_HHL_ADMIN', 'EXTERNAL_MESSAGING', 'PERMIT_REQUIRED_NON_STANDARD', 'FUEL_WOB_INGEST',
    'SMS_ZONE_APPROACH', 'SMS_ZONE_ENTER', 'DRIVER_LINK_ACCEPT', 'AUTOMATIC_DECISION_EMAIL',
    'H1_ROUTE_CHECK', 'H3_CORRIDOR_OBSTACLES', 'H6_MAP_OBSTACLES'
  ));

insert into security_flags (key, enabled, note)
values (
  'H6_MAP_OBSTACLES', false,
  'H-6: warstwa przeszkód HERE na mapie. Zbudowana i wyłączona do wymiarów zestawu (D-83).'
)
on conflict (key) do nothing;

create or replace function public.h6_map_enabled()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select enabled from security_flags where key = 'H6_MAP_OBSTACLES'), false)
$$;
revoke all on function public.h6_map_enabled() from public, anon, authenticated;

alter table public.here_usage drop constraint if exists here_usage_service_check;
alter table public.here_usage add constraint here_usage_service_check
  check (service in ('routing', 'attributes', 'tiles', 'matching'));

create or replace function public.here_note_service(
  p_service text,
  p_n integer,
  p_usd numeric,
  p_now timestamptz default now()
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_month date;
begin
  if (p_service in ('routing', 'attributes', 'tiles', 'matching')) is not true then
    raise exception 'Zła usługa HERE' using errcode = '22023';
  end if;
  if (p_n is not null and p_n >= 0 and p_usd is not null and p_usd >= 0) is not true then
    raise exception 'Zły zapis zużycia HERE' using errcode = '22023';
  end if;
  v_month := (date_trunc('month', p_now at time zone 'Europe/Warsaw'))::date;
  insert into here_usage (month, service, requests, estimated_usd)
  values (v_month, p_service, p_n, p_usd)
  on conflict (month, service) do update
    set requests = here_usage.requests + excluded.requests,
        estimated_usd = here_usage.estimated_usd + excluded.estimated_usd;
end $$;
revoke all on function public.here_note_service(text, integer, numeric, timestamptz) from public, anon, authenticated;

create or replace function public.here_tiles_open(p_now timestamptz default now())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.here_month_spend(p_now) < 80
$$;
revoke all on function public.here_tiles_open(timestamptz) from public, anon, authenticated;

create or replace function public.here_budget_view()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_usd numeric;
  v_n integer;
  v_on boolean;
  v_level text;
  v_tiles_n integer;
  v_tiles_usd numeric;
  v_match_n integer;
  v_match_usd numeric;
  v_month date;
begin
  if (is_hhl()) is not true then
    raise exception 'Stan HERE widzi wyłącznie HHL' using errcode = '42501';
  end if;
  v_on := public.h1_route_check_enabled();
  v_month := (date_trunc('month', now() at time zone 'Europe/Warsaw'))::date;
  select coalesce(sum(requests), 0), coalesce(sum(estimated_usd), 0)
    into v_n, v_usd
    from here_usage
   where month = v_month;
  select coalesce(sum(requests), 0), coalesce(sum(estimated_usd), 0)
    into v_tiles_n, v_tiles_usd
    from here_usage
   where month = v_month and service = 'tiles';
  select coalesce(sum(requests), 0), coalesce(sum(estimated_usd), 0)
    into v_match_n, v_match_usd
    from here_usage
   where month = v_month and service = 'matching';
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
    'level', v_level,
    'tiles_requests', coalesce(v_tiles_n, 0),
    'tiles_usd', coalesce(v_tiles_usd, 0),
    'matching_requests', coalesce(v_match_n, 0),
    'matching_usd', coalesce(v_match_usd, 0),
    'tiles_open', v_usd < 80
  );
end $$;

create table if not exists public.here_road_geometry (
  leg text primary key check (leg in ('PL-GDN', 'PL-GDY', 'SE-NYN', 'SE-KAA')),
  points jsonb,
  summary text not null,
  fetched_at timestamptz not null
);
comment on table public.here_road_geometry is
  'B-MAPA: geometria trasy HERE tylko do rysowania. Punkty kasowane po 30 dniach (D-81). Zostaje własne podsumowanie.';
alter table public.here_road_geometry enable row level security;
revoke all on table public.here_road_geometry from anon, authenticated;

create or replace function public.here_store_road(
  p_leg text,
  p_points jsonb,
  p_summary text,
  p_now timestamptz default now()
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if (p_leg in ('PL-GDN', 'PL-GDY', 'SE-NYN', 'SE-KAA')) is not true then
    raise exception 'Zła noga trasy' using errcode = '22023';
  end if;
  if p_points is not null and (jsonb_typeof(p_points) = 'array' and jsonb_array_length(p_points) >= 2) is not true then
    raise exception 'Zła geometria' using errcode = '22023';
  end if;
  if (p_summary is not null and length(btrim(p_summary)) > 0) is not true then
    raise exception 'Brak podsumowania' using errcode = '22023';
  end if;
  insert into here_road_geometry (leg, points, summary, fetched_at)
  values (p_leg, p_points, left(p_summary, 240), p_now)
  on conflict (leg) do update
    set points = excluded.points,
        summary = excluded.summary,
        fetched_at = excluded.fetched_at;
end $$;
revoke all on function public.here_store_road(text, jsonb, text, timestamptz) from public, anon, authenticated;

create or replace function public.purge_here_road_geometry(p_now timestamptz default now())
returns int
language plpgsql
security definer
set search_path = public
as $$
declare n int;
begin
  update here_road_geometry
     set points = null
   where points is not null
     and fetched_at < p_now - interval '30 days';
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.purge_here_road_geometry(timestamptz) from public, anon, authenticated;

create or replace function public.map_display_state()
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare v_roads jsonb;
begin
  if (public.current_app_user_id() is null) then
    raise exception 'Brak aktywnego konta' using errcode = '42501';
  end if;
  perform public.purge_here_road_geometry(now());
  select coalesce(jsonb_agg(jsonb_build_object(
    'leg', leg,
    'points', points,
    'fetched_at', fetched_at
  )), '[]'::jsonb)
    into v_roads
    from here_road_geometry
   where points is not null;
  return jsonb_build_object(
    'tiles_open', public.here_month_spend(now()) < 80,
    'month', (date_trunc('month', now() at time zone 'Europe/Warsaw'))::date,
    'h6', public.h6_map_enabled(),
    'roads', v_roads
  );
end $$;
revoke all on function public.map_display_state() from public, anon;
grant execute on function public.map_display_state() to authenticated;

create or replace function public.ferry_track_sample()
returns table (
  vessel_id uuid,
  name text,
  mmsi bigint,
  lat double precision,
  lon double precision,
  observed_at timestamptz,
  cog real,
  sog_kn real
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if (public.current_app_user_id() is null) then
    raise exception 'Brak aktywnego konta' using errcode = '42501';
  end if;
  return query
  with s as (
    select
      v.vessel_id,
      ves.name,
      ves.mmsi,
      v.lat,
      v.lon,
      v.observed_at,
      v.cog,
      v.sog_kn,
      row_number() over (
        partition by v.vessel_id, date_bin('15 minutes', v.observed_at, timestamptz '2000-01-01')
        order by v.observed_at desc
      ) as rn
    from vessel_positions v
    join vessels ves on ves.id = v.vessel_id
    where v.observed_at >= now() - interval '48 hours'
  )
  select s.vessel_id, s.name, s.mmsi, s.lat, s.lon, s.observed_at, s.cog, s.sog_kn
    from s
   where s.rn = 1
   order by s.observed_at;
end $$;
revoke all on function public.ferry_track_sample() from public, anon;
grant execute on function public.ferry_track_sample() to authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant select on table public.here_road_geometry to service_role;
    grant execute on function public.here_note_service(text, integer, numeric, timestamptz) to service_role;
    grant execute on function public.here_month_spend(timestamptz) to service_role;
    grant execute on function public.here_tiles_open(timestamptz) to service_role;
    grant execute on function public.here_store_road(text, jsonb, text, timestamptz) to service_role;
    grant execute on function public.purge_here_road_geometry(timestamptz) to service_role;
    grant execute on function public.h6_map_enabled() to service_role;
  end if;
end $$;
