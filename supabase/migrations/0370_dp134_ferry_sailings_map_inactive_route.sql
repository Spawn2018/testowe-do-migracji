-- DP-134 (F7 #706 r1): ferry_sailings_map — join ferry_routes bez fr.active.
-- Wyłączenie trasy w trakcie rejsu z ładunkami nie może usuwać rejsu z mapy.
-- Promote / outbound nadal filtrują active (BN1 #648).

create or replace function public.ferry_sailings_map()
returns table (
  sailing_id uuid,
  vessel_id uuid,
  vessel_name text,
  mmsi bigint,
  route text,
  status text,
  departure_at timestamptz,
  arrival_at timestamptz,
  departed_at timestamptz,
  arrived_at timestamptz,
  dep_port text,
  arr_port text,
  dep_lat double precision,
  dep_lon double precision,
  arr_lat double precision,
  arr_lon double precision,
  ais_lat double precision,
  ais_lon double precision,
  ais_observed_at timestamptz,
  ais_source text,
  ais_sog_kn real
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
  with base as (
    select
      s.id as sailing_id,
      s.vessel_id,
      ves.name as vessel_name,
      ves.mmsi,
      s.route,
      s.status::text as status,
      s.departure_at,
      s.arrival_at,
      s.actual_departure_at as departed_at,
      s.actual_arrival_at as arrived_at,
      fr.port_from as dep_port,
      fr.port_to as arr_port
    from sailings s
    join vessels ves on ves.id = s.vessel_id
    join ferry_routes fr on fr.code = s.route
    where s.status is distinct from 'ODWOLANY'
      and coalesce(s.actual_departure_at, s.delayed_departure_at, s.departure_at) <= now() + interval '6 hours'
      and coalesce(s.actual_arrival_at, s.delayed_arrival_at, s.arrival_at) >= now() - interval '6 hours'
  ),
  latest_ais as (
    select distinct on (vp.vessel_id)
      vp.vessel_id,
      vp.lat,
      vp.lon,
      vp.observed_at,
      vp.source::text as source,
      vp.sog_kn
    from vessel_positions vp
    where vp.vessel_id in (select b.vessel_id from base b)
    order by vp.vessel_id, vp.observed_at desc, vp.id desc
  )
  select
    b.sailing_id,
    b.vessel_id,
    b.vessel_name,
    b.mmsi,
    b.route,
    b.status,
    b.departure_at,
    b.arrival_at,
    b.departed_at,
    b.arrived_at,
    b.dep_port,
    b.arr_port,
    pd.lat,
    pd.lon,
    pa.lat,
    pa.lon,
    la.lat,
    la.lon,
    la.observed_at,
    la.source,
    la.sog_kn
  from base b
  join ferry_ports pd on pd.code = b.dep_port
  join ferry_ports pa on pa.code = b.arr_port
  left join latest_ais la on la.vessel_id = b.vessel_id
  order by coalesce(b.departed_at, b.departure_at);
end
$$;

revoke all on function public.ferry_sailings_map() from public, anon;
grant execute on function public.ferry_sailings_map() to authenticated;
comment on function public.ferry_sailings_map() is
  'BN4/DP-134: rejsy mapy + AIS; join ferry_routes bez fr.active (wyłączona trasa zostaje na mapie).';
