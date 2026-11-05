-- DP-222 / #814 F7 #818 B1+B2: backfill actual_departure_at (+ ATA) GDN-NYN (7 dni)
-- ATD: para ≤3 km → >4 km; luka ≤20 min, albo ≤60 min gdy SOG≥3 na p_out
--   albo kolejne pozycje oddalają się; ATD = ostatnia w strefie z SOG≥1.
-- ATA: strefa NYN, wejście ≤3 km po clear >4 km / SOG≥3; luka ≤20/60 min.
-- Status: ATA → DOPLYNAL; bez ATA + (późniejszy ATD tego statku LUB arrival+6h < now)
--   → DOPLYNAL (ATA null); inaczej W_REJSIE. Hub GDN Westerplatte; NYN 58.90453/17.95621.
-- Zabezpieczenie ATD: plan ±3 h.

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

comment on function public.dp222_atd_from_ais_gdn(uuid, timestamptz, timestamptz) is
  'DP-222 F7 B1: ATD z AIS×geofence GDN (3/4 km; ≤20/60 min; SOG≥1) — backfill.';

revoke all on function public.dp222_atd_from_ais_gdn(uuid, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.dp222_atd_from_ais_gdn(uuid, timestamptz, timestamptz) to service_role;

create or replace function public.dp222_ata_from_ais_nyn(
  p_vessel_id uuid,
  p_since timestamptz,
  p_until timestamptz
) returns timestamptz
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  v_hub geography := st_setsrid(st_makepoint(17.95621, 58.90453), 4326)::geography;
  v_last_clear_at timestamptz := null;
  v_last_clear_sog double precision := null;
  v_last_clear_km double precision := null;
  r record;
  v_km double precision;
  v_gap interval;
  v_max interval;
  v_allow_sparse boolean;
  v_prev_km double precision;
  v_mid record;
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
      if v_last_clear_at is not null then
        v_gap := r.observed_at - v_last_clear_at;
        v_allow_sparse := (v_last_clear_sog is not null and v_last_clear_sog >= 3);
        if (v_allow_sparse) is not true then
          v_prev_km := v_last_clear_km;
          for v_mid in
            select vp2.lat, vp2.lon
              from public.vessel_positions vp2
             where vp2.vessel_id = p_vessel_id
               and vp2.observed_at > v_last_clear_at
               and vp2.observed_at < r.observed_at
               and st_dwithin(
                     st_setsrid(st_makepoint(vp2.lon, vp2.lat), 4326)::geography,
                     v_hub,
                     15000)
             order by vp2.observed_at asc
             limit 8
          loop
            v_km := st_distance(
              st_setsrid(st_makepoint(v_mid.lon, v_mid.lat), 4326)::geography,
              v_hub) / 1000.0;
            if v_km < v_prev_km - 0.05 then
              v_allow_sparse := true;
              exit;
            end if;
            if v_km < v_prev_km then
              v_prev_km := v_km;
            end if;
          end loop;
        end if;
        -- CASE w IF powodowal "syntax error at end of input" w bramie (0412 B2).
        v_max := case when v_allow_sparse then interval '60 minutes' else interval '20 minutes' end;
        if v_gap >= interval '0' and v_gap <= v_max then
          return r.observed_at;
        end if;
      end if;
      v_last_clear_at := null;
      v_last_clear_sog := null;
      v_last_clear_km := null;
      continue;
    end if;
    if v_km > 4 or (r.sog_kn is not null and r.sog_kn >= 3) then
      v_last_clear_at := r.observed_at;
      v_last_clear_sog := r.sog_kn;
      v_last_clear_km := v_km;
    end if;
    /* Pas 3-4 km bez SOG>=3: pomijaj — last_clear zostaje. */
  end loop;
  return null;
end;
$$;

comment on function public.dp222_ata_from_ais_nyn(uuid, timestamptz, timestamptz) is
  'DP-222 F7 B2: ATA z AIS×geofence NYN (3/4 km; ≤20/60 min) — backfill.';

revoke all on function public.dp222_ata_from_ais_nyn(uuid, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.dp222_ata_from_ais_nyn(uuid, timestamptz, timestamptz) to service_role;

with cand as (
  select s.id,
         s.vessel_id,
         s.departure_at,
         s.arrival_at,
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
),
cand_ok as (
  select c.*
    from cand c
   where c.atd is not null
     and c.atd >= c.departure_at - interval '3 hours'
     and c.atd <= c.departure_at + interval '3 hours'
     and c.atd <= now()
),
enriched as (
  select c.*,
         public.dp222_ata_from_ais_nyn(
           c.vessel_id,
           c.atd,
           least(now(), c.arrival_at + interval '6 hours')
         ) as ata,
         exists (
           select 1
             from public.sailings x
            where x.vessel_id = c.vessel_id
              and x.id <> c.id
              and x.actual_departure_at is not null
              and x.departure_at > c.departure_at
         ) as later_left,
         exists (
           select 1
             from cand_ok y
            where y.vessel_id = c.vessel_id
              and y.id <> c.id
              and y.departure_at > c.departure_at
         ) as later_left_bf
    from cand_ok c
)
update public.sailings s
   set actual_departure_at = e.atd,
       actual_arrival_at = coalesce(s.actual_arrival_at, e.ata),
       status = case
         when s.status = 'ODWOLANY' then s.status
         when e.ata is not null then 'DOPLYNAL'
         when (e.later_left) is true or (e.later_left_bf) is true then 'DOPLYNAL'
         when s.arrival_at + interval '6 hours' < now() then 'DOPLYNAL'
         when s.status in ('ZAPLANOWANY', 'OPOZNIONY') then 'W_REJSIE'
         else s.status
       end
  from enriched e
 where s.id = e.id;

drop function public.dp222_ata_from_ais_nyn(uuid, timestamptz, timestamptz);
drop function public.dp222_atd_from_ais_gdn(uuid, timestamptz, timestamptz);

commit;
