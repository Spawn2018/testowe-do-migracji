-- DP-131 (F7 #703): FERRY + GPS ≤3 km od portu wyjścia po ATD/ATA → HIGH
-- „Transport nie wypłynął? — sprawdź”. Bez zmiany statusu. Dedup per load+sailing.
-- Cron: ten sam tower-prom-opoznienie co detect_ferry_overdue (*/10).

create or replace function public.detect_ferry_gps_stuck_at_departure(
  p_now timestamptz default now(),
  p_radius_km double precision default 3
) returns integer
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  r record;
  n int := 0;
  v_code text;
  v_title text;
  v_params jsonb;
  v_radius double precision := coalesce(nullif(p_radius_km, 0), 3);
  v_dedup text;
begin
  -- Zamknij, gdy status już nie FERRY albo ostatnia pozycja > promienia.
  update public.risk_signals rs
     set resolved_at = coalesce(p_now, now())
   where rs.resolved_at is null
     and rs.dedup_key like 'FERRY_STUCK_DEP:%'
     and (
       not exists (
         select 1 from public.loads l
          where l.id = rs.load_id and l.status = 'FERRY'
       )
       or exists (
         select 1
           from public.loads l
           join public.sailings s on s.id = l.sailing_id
           join public.ferry_routes fr on fr.code = s.route
           join public.ferry_ports pf on pf.code = fr.port_from
           join lateral (
             select p.geom_raw
               from public.positions p
              where p.load_id = l.id
                and coalesce((p.raw->>'stale_point')::boolean, false) is not true
              order by p.ts desc
              limit 1
           ) lp on true
          where l.id = rs.load_id
            and st_distance(
                  lp.geom_raw::geography,
                  st_setsrid(st_makepoint(pf.lon, pf.lat), 4326)::geography
                ) / 1000.0 > v_radius
       )
     );

  for r in
    select l.id as load_id,
           s.id as sailing_id,
           v.name as vessel,
           pf.code as port_code,
           pf.name as port_name,
           s.actual_departure_at as atd,
           s.actual_arrival_at as ata,
           round((st_distance(
             lp.geom_raw::geography,
             st_setsrid(st_makepoint(pf.lon, pf.lat), 4326)::geography
           ) / 1000.0)::numeric, 2) as km,
           st_y(lp.geom_raw::geometry) as lat,
           st_x(lp.geom_raw::geometry) as lon,
           lp.ts as pos_ts
      from public.loads l
      join public.sailings s on s.id = l.sailing_id
      join public.vessels v on v.id = s.vessel_id
      join public.ferry_routes fr on fr.code = s.route
      join public.ferry_ports pf on pf.code = fr.port_from
      join lateral (
        select p.ts, p.geom_raw
          from public.positions p
         where p.load_id = l.id
           and coalesce((p.raw->>'stale_point')::boolean, false) is not true
         order by p.ts desc
         limit 1
      ) lp on true
     where l.status = 'FERRY'
       and (s.actual_departure_at is not null or s.actual_arrival_at is not null)
       and coalesce(p_now, now())
           > coalesce(s.actual_departure_at, s.actual_arrival_at)
       and (lp.ts > coalesce(s.actual_departure_at, s.actual_arrival_at)) is true
       and (st_distance(
             lp.geom_raw::geography,
             st_setsrid(st_makepoint(pf.lon, pf.lat), 4326)::geography
           ) / 1000.0 <= v_radius) is true
  loop
    v_dedup := 'FERRY_STUCK_DEP:' || r.load_id || ':' || r.sailing_id;
    -- Po ręcznym zamknięciu nie wraca (jak FERRY_OVERDUE).
    if exists (
      select 1 from public.risk_signals
       where dedup_key = v_dedup
         and resolved_at is not null
    ) then
      continue;
    end if;
    v_code := coalesce(
      nullif(nullif(btrim(public.load_sms_code(r.load_id)), ''), '—'),
      'transport'
    );
    v_params := jsonb_build_object(
      'code', v_code,
      'vessel', r.vessel,
      'port', coalesce(r.port_name, r.port_code),
      'km', r.km
    );
    v_title := format('Transport nie wypłynął? — sprawdź %s', v_code);
    perform public.raise_risk(
      r.load_id, 'FERRY', 'HIGH', v_title,
      jsonb_build_object(
        'sailing_id', r.sailing_id,
        'title_key', 'rk_ferry_not_departed',
        'params', v_params,
        'port', r.port_code,
        'km', r.km,
        'lat', r.lat,
        'lon', r.lon,
        'pos_ts', r.pos_ts,
        'actual_departure_at', r.atd,
        'actual_arrival_at', r.ata
      ),
      v_dedup
    );
    n := n + 1;
  end loop;
  return n;
end $function$;

revoke all on function public.detect_ferry_gps_stuck_at_departure(timestamptz, double precision)
  from public, anon, authenticated;
grant execute on function public.detect_ferry_gps_stuck_at_departure(timestamptz, double precision)
  to service_role;
comment on function public.detect_ferry_gps_stuck_at_departure(timestamptz, double precision) is
  'DP-131: FERRY + GPS ≤3 km port wyjścia po ATD/ATA → HIGH rk_ferry_not_departed; bez zmiany statusu.';

-- Ten sam cron co overdue (*/10).
do $cron131$
begin
  if to_regclass('cron.job') is not null
     and to_regprocedure('cron.schedule(text,text,text)') is not null then
    perform cron.unschedule(j.jobid)
      from cron.job j where j.jobname = 'tower-prom-opoznienie';
    perform cron.schedule(
      'tower-prom-opoznienie',
      '*/10 * * * *',
      $c$select public.detect_ferry_overdue(); select public.detect_ferry_gps_stuck_at_departure();$c$
    );
  end if;
exception when others then
  raise warning 'DP-131 cron tower-prom-opoznienie: %', sqlerrm;
end $cron131$;
