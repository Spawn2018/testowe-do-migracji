-- #460 / D-20261022-2043-01: ferry_track_sample — bez ambiguous vessel_id (42702).
-- W CTE `u` kolumny bez aliasu zderzały się z OUT RETURNS TABLE (0258).

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
  with active as (
    select s.vessel_id
      from sailings s
     where s.status is distinct from 'ODWOLANY'
       and coalesce(s.actual_departure_at, s.delayed_departure_at, s.departure_at) <= now() + interval '6 hours'
       and coalesce(s.actual_arrival_at, s.delayed_arrival_at, s.arrival_at) >= now() - interval '6 hours'
  ),
  sampled as (
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
  ),
  latest_active as (
    select distinct on (v.vessel_id)
      v.vessel_id,
      ves.name,
      ves.mmsi,
      v.lat,
      v.lon,
      v.observed_at,
      v.cog,
      v.sog_kn
    from vessel_positions v
    join vessels ves on ves.id = v.vessel_id
    where v.vessel_id in (select a.vessel_id from active a)
    order by v.vessel_id, v.observed_at desc
  ),
  u as (
    select s.vessel_id, s.name, s.mmsi, s.lat, s.lon, s.observed_at, s.cog, s.sog_kn
      from sampled s
     where s.rn = 1
    union
    select la.vessel_id, la.name, la.mmsi, la.lat, la.lon, la.observed_at, la.cog, la.sog_kn
      from latest_active la
  )
  select u.vessel_id, u.name, u.mmsi, u.lat, u.lon, u.observed_at, u.cog, u.sog_kn
    from u
   order by u.observed_at;
end $$;

revoke all on function public.ferry_track_sample() from public, anon;
grant execute on function public.ferry_track_sample() to authenticated;
