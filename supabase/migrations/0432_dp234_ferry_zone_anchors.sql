-- DP-234 / F7 #863: Q-18 — po DP-231 ~5 h historii/statek długi rejs bez strefy
-- portu wyjścia ustalał kierunek tylko z COG. Do ≤20 świeżych binów dokładamy
-- kotwice: ostatni fix w strefie PORT_ZONES (draw.ts) z 48 h + pierwszy po wyjściu.
-- Bez przekraczania limitu PostgREST (~1000).

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
  /* Q-18 PORT_ZONES — te same środki/promienie co ferryPhase w draw.ts */
  zones as (
    select * from (values
      ('GDN'::text, 54.4::float8, 18.67::float8, 6.0::float8),
      ('GDY', 54.533, 18.55, 5.0),
      ('NYN', 58.912, 17.955, 4.0),
      ('KAA', 56.161, 15.586, 4.0),
      ('TLL', 59.443, 24.77, 5.0),
      ('MUU', 59.497, 24.96, 5.0),
      ('PLD', 59.335, 24.083, 5.0),
      ('HEL', 60.153, 24.915, 5.0),
      ('VUO', 60.206, 25.19, 5.0),
      ('STO', 59.35, 18.105, 5.0),
      ('KPS', 59.721, 19.065, 4.0)
    ) as z(id, zlat, zlng, radius_km)
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
      ) as rn_bin
    from vessel_positions v
    join vessels ves on ves.id = v.vessel_id
    where v.observed_at >= now() - interval '48 hours'
  ),
  bins as (
    select s.*
      from sampled s
     where s.rn_bin = 1
  ),
  limited as (
    select
      b.vessel_id,
      b.name,
      b.mmsi,
      b.lat,
      b.lon,
      b.observed_at,
      b.cog,
      b.sog_kn,
      row_number() over (
        partition by b.vessel_id
        order by b.observed_at desc
      ) as rn_recent
    from bins b
  ),
  in_zone as (
    select b.*
      from bins b
     where exists (
       select 1
         from zones z
        where st_distance(
                st_setsrid(st_makepoint(b.lon, b.lat), 4326)::geography,
                st_setsrid(st_makepoint(z.zlng, z.zlat), 4326)::geography
              ) / 1000.0 <= z.radius_km
     )
  ),
  /* Ostatni fix w dowolnej strefie portu w oknie 48 h. */
  last_zone as (
    select distinct on (i.vessel_id)
      i.vessel_id,
      i.name,
      i.mmsi,
      i.lat,
      i.lon,
      i.observed_at,
      i.cog,
      i.sog_kn
    from in_zone i
    order by i.vessel_id, i.observed_at desc
  ),
  /* Pierwszy bin po wyjściu z tej strefy (kotwica przejścia Q-18). */
  first_after as (
    select distinct on (b.vessel_id)
      b.vessel_id,
      b.name,
      b.mmsi,
      b.lat,
      b.lon,
      b.observed_at,
      b.cog,
      b.sog_kn
    from bins b
    join last_zone lz on lz.vessel_id = b.vessel_id
    where b.observed_at > lz.observed_at
    order by b.vessel_id, b.observed_at asc
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
    select l.vessel_id, l.name, l.mmsi, l.lat, l.lon, l.observed_at, l.cog, l.sog_kn
      from limited l
     where l.rn_recent <= 20
    union
    select lz.vessel_id, lz.name, lz.mmsi, lz.lat, lz.lon, lz.observed_at, lz.cog, lz.sog_kn
      from last_zone lz
    union
    select fa.vessel_id, fa.name, fa.mmsi, fa.lat, fa.lon, fa.observed_at, fa.cog, fa.sog_kn
      from first_after fa
    union
    select la.vessel_id, la.name, la.mmsi, la.lat, la.lon, la.observed_at, la.cog, la.sog_kn
      from latest_active la
  )
  select u.vessel_id, u.name, u.mmsi, u.lat, u.lon, u.observed_at, u.cog, u.sog_kn
    from u
   order by u.observed_at desc;
end $$;

revoke all on function public.ferry_track_sample() from public, anon;
grant execute on function public.ferry_track_sample() to authenticated;

comment on function public.ferry_track_sample() is
  'DP-234/#863: ≤20 świeżych 15 min/statek + kotwice stref Q-18 (ostatni w porcie + pierwszy po wyjściu) + latest aktywnego; ORDER BY observed_at DESC.';
