-- DP-222 / #814: backfill actual_departure_at dla GDN-NYN (ostatnie 7 dni)
-- z vessel_positions wg DP-128 (para ≤3 km → >4 km, luka ≤20 min, hub Westerplatte).
-- Digitraffic nie pokrywa Zatoki; AISSTREAM bywa rzadki — UMG Gdańsk Nowy Port
-- łata przyszłe odjazdy w Edge; tu tylko pary już zapisane w AIS.

begin;

create or replace function public.dp222_atd_from_ais_gdn(
  p_vessel_id uuid,
  p_since timestamptz,
  p_until timestamptz
) returns timestamptz
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  v_hub geography := st_setsrid(st_makepoint(18.68130, 54.40372), 4326)::geography;
  v_last_in timestamptz := null;
  v_best timestamptz := null;
  r record;
  v_km double precision;
begin
  for r in
    select vp.observed_at, vp.lat, vp.lon
      from public.vessel_positions vp
     where vp.vessel_id = p_vessel_id
       and vp.observed_at >= p_since
       and vp.observed_at <= p_until
       and st_dwithin(
             st_setsrid(st_makepoint(vp.lon, vp.lat), 4326)::geography,
             v_hub,
             15000)
     order by vp.observed_at asc
  loop
    v_km := st_distance(
      st_setsrid(st_makepoint(r.lon, r.lat), 4326)::geography,
      v_hub) / 1000.0;
    if v_km <= 3 then
      v_last_in := r.observed_at;
      continue;
    end if;
    if v_km <= 4 then
      continue; -- pas 3–4 km pomijany
    end if;
    if v_last_in is not null
       and r.observed_at >= v_last_in
       and r.observed_at - v_last_in <= interval '20 minutes' then
      v_best := v_last_in;
    end if;
    v_last_in := null;
  end loop;
  return v_best;
end;
$$;

comment on function public.dp222_atd_from_ais_gdn(uuid, timestamptz, timestamptz) is
  'DP-222: ATD z AIS×geofence GDN (3/4 km, ≤20 min) — backfill jednorazowy.';

revoke all on function public.dp222_atd_from_ais_gdn(uuid, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.dp222_atd_from_ais_gdn(uuid, timestamptz, timestamptz) to service_role;

with cand as (
  select s.id,
         s.vessel_id,
         s.departure_at,
         s.status,
         public.dp222_atd_from_ais_gdn(
           s.vessel_id,
           greatest(
             s.departure_at - interval '2 hours',
             coalesce(
               (select max(x.actual_arrival_at)
                  from public.sailings x
                 where x.vessel_id = s.vessel_id
                   and x.id <> s.id
                   and x.actual_arrival_at is not null
                   and x.actual_arrival_at > s.departure_at - interval '2 hours'),
               s.departure_at - interval '2 hours'
             )
           ),
           least(now(), s.arrival_at + interval '3 hours')
         ) as atd
    from public.sailings s
   where s.route = 'GDN-NYN'
     and s.actual_departure_at is null
     and s.status is distinct from 'ODWOLANY'
     and s.departure_at >= now() - interval '7 days'
     and s.departure_at <= now() + interval '2 hours'
)
update public.sailings s
   set actual_departure_at = c.atd,
       status = case
         when s.status = 'ODWOLANY' then s.status
         when s.status in ('ZAPLANOWANY', 'OPOZNIONY') then 'W_REJSIE'
         else s.status
       end
  from cand c
 where s.id = c.id
   and c.atd is not null
   and c.atd >= c.departure_at - interval '2 hours'
   and c.atd <= now();

drop function public.dp222_atd_from_ais_gdn(uuid, timestamptz, timestamptz);

commit;
