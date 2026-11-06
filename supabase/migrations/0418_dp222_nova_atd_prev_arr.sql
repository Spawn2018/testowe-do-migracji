-- DP-222 drobne (#814): ATD GDN-NYN gdy 0412 pominął rejs przez zły since
-- (max actual_arrival_at także z *późniejszych* rejsów → okno po wypłynięciu).
-- Nova Star 02.11: para AIS 17:19→17:54 (35 min, SOG≥3) → ATD 17:19:06.
-- Etap: C2 / BN9-c2. Tylko uzupełnia actual_departure_at; status bez zmian gdy już DOPLYNAL.

begin;

create or replace function public.dp222_atd_from_ais_gdn_v2(
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
      continue;
    end if;
    if v_last_in is not null then
      v_pin := coalesce(v_last_in_moving, v_last_in);
      v_gap := r.observed_at - v_pin;
      v_allow_sparse := (r.sog_kn is not null and r.sog_kn >= 3);
      if (v_allow_sparse) is not true then
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

comment on function public.dp222_atd_from_ais_gdn_v2(uuid, timestamptz, timestamptz) is
  'DP-222: ATD z AIS×geofence GDN (3/4 km; ≤20/60 min) — backfill v2.';

revoke all on function public.dp222_atd_from_ais_gdn_v2(uuid, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.dp222_atd_from_ais_gdn_v2(uuid, timestamptz, timestamptz) to service_role;

with cand as (
  select s.id,
         s.vessel_id,
         s.departure_at,
         public.dp222_atd_from_ais_gdn_v2(
           s.vessel_id,
           greatest(
             s.departure_at - interval '3 hours',
             coalesce(
               (select max(x.actual_arrival_at)
                  from public.sailings x
                 where x.vessel_id = s.vessel_id
                   and x.id <> s.id
                   and x.actual_arrival_at is not null
                   and x.departure_at < s.departure_at
                   and x.actual_arrival_at <= s.departure_at),
               s.departure_at - interval '3 hours'
             )
           ),
           least(now(), s.arrival_at + interval '3 hours')
         ) as atd
    from public.sailings s
   where s.route = 'GDN-NYN'
     and s.actual_departure_at is null
     and s.status is distinct from 'ODWOLANY'
     and s.departure_at >= now() - interval '14 days'
     and s.departure_at <= now() + interval '2 hours'
),
cand_ok as (
  select c.*
    from cand c
   where c.atd is not null
     and c.atd >= c.departure_at - interval '3 hours'
     and c.atd <= c.departure_at + interval '3 hours'
     and c.atd <= now()
)
update public.sailings s
   set actual_departure_at = e.atd
  from cand_ok e
 where s.id = e.id;

drop function public.dp222_atd_from_ais_gdn_v2(uuid, timestamptz, timestamptz);

commit;
