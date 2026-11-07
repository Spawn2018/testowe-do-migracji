-- DP-231 / #859: ferry_track_sample — limit per statek + sort DESC.
-- PostgREST ucina RPC do ~1000 wierszy; stare ASC + 48 h × 15 min × wiele MMSI
-- zostawiało tylko najstarsze → mapa pokazywała pozycje sprzed doby.

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
  /* Jedna próbka na 15 min na statek (jak 0258/0268). */
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
  /* Max 20 najnowszych binów / statek (~5 h) — Q-18 (kierunek + strefy) + COG; niezależne od floty. */
  limited as (
    select
      s.vessel_id,
      s.name,
      s.mmsi,
      s.lat,
      s.lon,
      s.observed_at,
      s.cog,
      s.sog_kn,
      row_number() over (
        partition by s.vessel_id
        order by s.observed_at desc
      ) as rn_recent
    from sampled s
    where s.rn_bin = 1
  ),
  /* Ostatnia pozycja aktywnego rejsu — także gdy starsza niż 48 h (0258 F7 r2). */
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
  'DP-231/#859: ≤20 próbek 15 min/statek z 48 h + latest aktywnego; ORDER BY observed_at DESC (PostgREST max-rows).';
