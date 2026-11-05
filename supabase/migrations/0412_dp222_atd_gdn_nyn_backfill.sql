-- DP-222 / #814 F7 #818 B1: backfill actual_departure_at GDN-NYN (ostatnie 7 dni)
-- z vessel_positions: para ≤3 km → >4 km; luka ≤20 min, albo ≤60 min gdy SOG≥3
-- na p_out albo kolejne pozycje oddalają się; ATD = ostatnia w strefie z SOG≥1
-- (inaczej ostatnia w strefie). Hub Westerplatte. Zabezpieczenie: plan ±3 h od ATD.

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
  v_last_in_moving timestamptz := null;
  v_best timestamptz := null;
  r record;
  v_km double precision;
  v_gap interval;
  v_pin timestamptz;
  v_max interval;
  v_allow_sparse boolean;
  v_out_km double precision;
  v_later record;
begin
  for r in
    select vp.observed_at, vp.lat, vp.lon, vp.sog_kn
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
      if r.sog_kn is not null and r.sog_kn >= 1 then
        v_last_in_moving := r.observed_at;
      end if;
      continue;
    end if;
    if v_km <= 4 then
      continue; -- pas 3–4 km pomijany
    end if;
    if v_last_in is not null then
      v_pin := coalesce(v_last_in_moving, v_last_in);
      v_gap := r.observed_at - v_pin;
      v_allow_sparse := (r.sog_kn is not null and r.sog_kn >= 3);
      if not v_allow_sparse then
        v_out_km := v_km;
        for v_later in
          select vp2.lat, vp2.lon, vp2.observed_at
            from public.vessel_positions vp2
           where vp2.vessel_id = p_vessel_id
             and vp2.observed_at > r.observed_at
             and vp2.observed_at <= p_until
             and st_dwithin(
                   st_setsrid(st_makepoint(vp2.lon, vp2.lat), 4326)::geography,
                   v_hub,
                   15000)
           order by vp2.observed_at asc
           limit 8
        loop
          v_km := st_distance(
            st_setsrid(st_makepoint(v_later.lon, v_later.lat), 4326)::geography,
            v_hub) / 1000.0;
          if v_km <= 3 then
            exit;
          end if;
          if v_km > v_out_km + 0.05 then
            v_allow_sparse := true;
            exit;
          end if;
        end loop;
      end if;
      v_max := case when v_allow_sparse then interval '60 minutes' else interval '20 minutes' end;
      if v_gap >= interval '0' and v_gap <= v_max then
        v_best := v_pin;
      end if;
    end if;
    v_last_in := null;
    v_last_in_moving := null;
  end loop;
  return v_best;
end;
$$;

comment on function public.dp222_atd_from_ais_gdn(uuid, timestamptz, timestamptz) is
  'DP-222 F7 B1: ATD z AIS×geofence GDN (3/4 km; ≤20/60 min; SOG≥1) — backfill.';

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
             s.departure_at - interval '3 hours',
             coalesce(
               (select max(x.actual_arrival_at)
                  from public.sailings x
                 where x.vessel_id = s.vessel_id
                   and x.id <> s.id
                   and x.actual_arrival_at is not null
                   and x.actual_arrival_at > s.departure_at - interval '3 hours'),
               s.departure_at - interval '3 hours'
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
   and c.atd >= c.departure_at - interval '3 hours'
   and c.atd <= c.departure_at + interval '3 hours'
   and c.atd <= now();

drop function public.dp222_atd_from_ais_gdn(uuid, timestamptz, timestamptz);

commit;
