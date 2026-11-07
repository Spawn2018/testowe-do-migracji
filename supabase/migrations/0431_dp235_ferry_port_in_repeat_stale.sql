-- DP-235 (F7 #870 / prod 17184; F7 #875 r2):
-- (a) FERRY + GPS w PORT_IN obcej trasy niż rejs → to samo HIGH rk_gps_wrong_port (HHL+SCX);
-- (b) powtórzony identyczny fix (±1 m) ≥30 min po ATD/dep = nie otwieraj nowego ryzyka
--     i nie zamykaj otwartego (emtrack przy postoju powtarza te same współrzędne);
--     zamykanie tylko przy świeżym punkcie poza obcą strefą / w porcie rejsu / zmiana rejsu.
--     Przed odejściem postój w porcie = sygnał (bez zmian względem DP-230).

begin;

-- Po ATD: ten sam punkt co wcześniej o ≥30 min → przestarzały (emtrack powtarza stary fix).
create or replace function public.gps_is_repeat_stale_after_dep(
  p_load_id uuid,
  p_geom geometry,
  p_ts timestamptz,
  p_dep timestamptz,
  p_tol_m double precision default 1,
  p_age interval default interval '30 minutes'
) returns boolean
language sql
stable
security definer
set search_path to 'public', 'extensions'
as $function$
  select case
    when p_load_id is null or p_geom is null or p_ts is null or p_dep is null then false
    when p_ts <= p_dep then false
    else exists (
      select 1
        from public.positions p
       where p.load_id = p_load_id
         and p.ts <= p_ts - coalesce(p_age, interval '30 minutes')
         and st_dwithin(
               p.geom_raw::geography,
               p_geom::geography,
               coalesce(p_tol_m, 1)
             )
    )
  end;
$function$;

revoke all on function public.gps_is_repeat_stale_after_dep(uuid, geometry, timestamptz, timestamptz, double precision, interval)
  from public, anon, authenticated;
grant execute on function public.gps_is_repeat_stale_after_dep(uuid, geometry, timestamptz, timestamptz, double precision, interval)
  to service_role;
comment on function public.gps_is_repeat_stale_after_dep(uuid, geometry, timestamptz, timestamptz, double precision, interval) is
  'DP-235: po ATD/dep powtórzony identyczny fix (±1 m) sprzed ≥30 min = nie otwieraj/nie zamykaj ryzyka; przed ATD zawsze false.';

create or replace function public.detect_gps_wrong_ferry_port(
  p_now timestamptz default now(),
  p_window interval default interval '6 hours'
) returns integer
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  r record;
  n int := 0;
  v_now timestamptz := coalesce(p_now, now());
  v_win interval := coalesce(p_window, interval '6 hours');
  v_code text;
  v_title text;
  v_params jsonb;
  v_dedup text;
  v_gps_port text;
  v_dep_port text;
begin
  -- Zamknij gdy: brak rejsu / świeży GPS poza obcą strefą (OUT lub IN) / FERRY ze świeżym GPS w porcie rejsu.
  -- Nie zamykaj samym ATD. Powtórka po ATD ≠ wyjazd: nie zamyka otwartego (F7 #875).
  update public.risk_signals rs
     set resolved_at = coalesce(v_now, now())
   where rs.resolved_at is null
     and rs.dedup_key like 'GPS_WRONG_PORT:%'
     and (
       not exists (
         select 1
           from public.loads l
           join public.sailings s on s.id = l.sailing_id
          where l.id = rs.load_id
            and rs.dedup_key = 'GPS_WRONG_PORT:' || l.id::text || ':' || s.id::text
       )
       or (
         -- świeży (niepowtórzony) punkt poza obcym PORT_OUT/PORT_IN — albo brak pozycji
         not exists (
           select 1
             from public.loads l
             join public.sailings s on s.id = l.sailing_id
             join lateral (
               select p.geom_raw, p.ts,
                      public.gps_is_repeat_stale_after_dep(
                        l.id,
                        p.geom_raw::geometry,
                        p.ts,
                        coalesce(s.actual_departure_at, s.delayed_departure_at, s.departure_at)
                      ) as repeat_stale
                 from public.positions p
                where p.load_id = l.id
                  and coalesce((p.raw->>'stale_point')::boolean, false) is not true
                order by p.ts desc
                limit 1
             ) lp on true
             join public.geofences g
               on g.project_id = l.project_id
              and g.active
              and g.kind in ('PORT_OUT', 'PORT_IN')
              and st_contains(g.geom, lp.geom_raw)
              and public.ferry_geofence_matches_route(g.route, s.route) is not true
            where l.id = rs.load_id
              and rs.dedup_key = 'GPS_WRONG_PORT:' || l.id::text || ':' || s.id::text
         )
         and not exists (
           -- F7 #875: powtórka ≥30 min po ATD = brak nowej informacji → nie zamykaj
           select 1
             from public.loads l
             join public.sailings s on s.id = l.sailing_id
             join lateral (
               select public.gps_is_repeat_stale_after_dep(
                        l.id,
                        p.geom_raw::geometry,
                        p.ts,
                        coalesce(s.actual_departure_at, s.delayed_departure_at, s.departure_at)
                      ) as repeat_stale
                 from public.positions p
                where p.load_id = l.id
                  and coalesce((p.raw->>'stale_point')::boolean, false) is not true
                order by p.ts desc
                limit 1
             ) lp on true
            where l.id = rs.load_id
              and rs.dedup_key = 'GPS_WRONG_PORT:' || l.id::text || ':' || s.id::text
              and lp.repeat_stale is true
         )
       )
       or exists (
         select 1
           from public.loads l
           join public.sailings s on s.id = l.sailing_id
           join lateral (
             select p.geom_raw, p.ts,
                    public.gps_is_repeat_stale_after_dep(
                      l.id,
                      p.geom_raw::geometry,
                      p.ts,
                      coalesce(s.actual_departure_at, s.delayed_departure_at, s.departure_at)
                    ) as repeat_stale
               from public.positions p
              where p.load_id = l.id
                and coalesce((p.raw->>'stale_point')::boolean, false) is not true
              order by p.ts desc
              limit 1
           ) lp on true
           join public.geofences g
             on g.project_id = l.project_id
            and g.active
            and g.kind in ('PORT_OUT', 'PORT_IN')
            and st_contains(g.geom, lp.geom_raw)
            and public.ferry_geofence_matches_route(g.route, s.route) is true
          where l.id = rs.load_id
            and l.status >= 'FERRY'
            and lp.repeat_stale is not true
            and rs.dedup_key = 'GPS_WRONG_PORT:' || l.id::text || ':' || s.id::text
       )
     );

  -- (1) status < FERRY: GPS w obcym PORT_OUT (jak DP-230; postój przed ATD = sygnał)
  for r in
    select l.id as load_id,
           s.id as sailing_id,
           s.route as sail_route,
           coalesce(s.delayed_departure_at, s.departure_at) as dep,
           pf.code as dep_port_code,
           pf.name as dep_port_name,
           g.route as gps_route,
           g.name as gps_fence_name,
           g.country as gps_country,
           g.kind as gps_kind,
           st_y(lp.geom_raw::geometry) as lat,
           st_x(lp.geom_raw::geometry) as lon,
           lp.ts as pos_ts
      from public.loads l
      join public.sailings s on s.id = l.sailing_id
      left join public.ferry_routes fr on fr.code = upper(btrim(s.route)) and fr.active
      left join public.ferry_ports pf on pf.code = fr.port_from
      join lateral (
        select p.ts, p.geom_raw
          from public.positions p
         where p.load_id = l.id
           and coalesce((p.raw->>'stale_point')::boolean, false) is not true
         order by p.ts desc
         limit 1
      ) lp on true
      join public.geofences g
        on g.project_id = l.project_id
       and g.active
       and g.kind = 'PORT_OUT'
       and st_contains(g.geom, lp.geom_raw)
       and public.ferry_geofence_matches_route(g.route, s.route) is not true
     where l.status < 'FERRY'
       and coalesce(s.delayed_departure_at, s.departure_at) is not null
       and v_now >= coalesce(s.delayed_departure_at, s.departure_at) - v_win
  loop
    v_dedup := 'GPS_WRONG_PORT:' || r.load_id || ':' || r.sailing_id;
    if exists (
      select 1 from public.risk_signals
       where dedup_key = v_dedup
         and resolved_at is null
    ) then
      continue;
    end if;
    -- Po rozwiązaniu — bez ponownego otwarcia tego samego dedup (jak DP-230 / MISSED_SAILING).
    if exists (
      select 1 from public.risk_signals
       where dedup_key = v_dedup
         and resolved_at is not null
    ) then
      continue;
    end if;

    v_dep_port := coalesce(nullif(btrim(r.dep_port_name), ''), nullif(btrim(r.dep_port_code), ''), 'rejsu');
    v_gps_port := case
      when upper(coalesce(r.gps_route, '')) in ('POLFERRIES', 'GDN-NYN') and r.gps_country = 'PL'
        then 'Gdańsk'
      when upper(coalesce(r.gps_route, '')) in ('STENA', 'GDY-KAA') and r.gps_country = 'PL'
        then 'Gdynia'
      when upper(coalesce(r.gps_route, '')) in ('POLFERRIES', 'GDN-NYN') and r.gps_country = 'SE'
        then 'Nynäshamn'
      when upper(coalesce(r.gps_route, '')) in ('STENA', 'GDY-KAA') and r.gps_country = 'SE'
        then 'Karlskrona'
      else coalesce(nullif(btrim(r.gps_fence_name), ''), 'innym')
    end;

    v_code := coalesce(
      nullif(nullif(btrim(public.load_sms_code(r.load_id)), ''), '—'),
      'transport'
    );
    v_params := jsonb_build_object(
      'code', v_code,
      'gps_port', v_gps_port,
      'dep_port', v_dep_port
    );
    v_title := format(
      'GPS w porcie %s, rejs z portu %s — sprawdź przydział',
      v_gps_port, v_dep_port
    );
    perform public.raise_risk(
      r.load_id, 'FERRY', 'HIGH', v_title,
      jsonb_build_object(
        'sailing_id', r.sailing_id,
        'title_key', 'rk_gps_wrong_port',
        'params', v_params,
        'audience', 'HHL_PRZEWOZNIK',
        'gps_route', r.gps_route,
        'sail_route', r.sail_route,
        'gps_kind', r.gps_kind,
        'dep', r.dep,
        'lat', r.lat,
        'lon', r.lon,
        'pos_ts', r.pos_ts
      ),
      v_dedup
    );
    n := n + 1;
  end loop;

  -- (2) DP-235: FERRY + świeży GPS w obcym PORT_IN (np. Karlskrona przy GDN-NYN)
  for r in
    select l.id as load_id,
           s.id as sailing_id,
           s.route as sail_route,
           coalesce(s.actual_departure_at, s.delayed_departure_at, s.departure_at) as dep,
           pf.code as dep_port_code,
           pf.name as dep_port_name,
           g.route as gps_route,
           g.name as gps_fence_name,
           g.country as gps_country,
           g.kind as gps_kind,
           st_y(lp.geom_raw::geometry) as lat,
           st_x(lp.geom_raw::geometry) as lon,
           lp.ts as pos_ts
      from public.loads l
      join public.sailings s on s.id = l.sailing_id
      left join public.ferry_routes fr on fr.code = upper(btrim(s.route)) and fr.active
      left join public.ferry_ports pf on pf.code = fr.port_from
      join lateral (
        select p.ts, p.geom_raw,
               public.gps_is_repeat_stale_after_dep(
                 l.id,
                 p.geom_raw::geometry,
                 p.ts,
                 coalesce(s.actual_departure_at, s.delayed_departure_at, s.departure_at)
               ) as repeat_stale
          from public.positions p
         where p.load_id = l.id
           and coalesce((p.raw->>'stale_point')::boolean, false) is not true
         order by p.ts desc
         limit 1
      ) lp on true
      join public.geofences g
        on g.project_id = l.project_id
       and g.active
       and g.kind = 'PORT_IN'
       and st_contains(g.geom, lp.geom_raw)
       and public.ferry_geofence_matches_route(g.route, s.route) is not true
     where l.status = 'FERRY'
       and lp.repeat_stale is not true
       and coalesce(s.actual_departure_at, s.delayed_departure_at, s.departure_at) is not null
  loop
    v_dedup := 'GPS_WRONG_PORT:' || r.load_id || ':' || r.sailing_id;
    if exists (
      select 1 from public.risk_signals
       where dedup_key = v_dedup
         and resolved_at is null
    ) then
      continue;
    end if;
    if exists (
      select 1 from public.risk_signals
       where dedup_key = v_dedup
         and resolved_at is not null
    ) then
      continue;
    end if;

    v_dep_port := coalesce(nullif(btrim(r.dep_port_name), ''), nullif(btrim(r.dep_port_code), ''), 'rejsu');
    v_gps_port := case
      when upper(coalesce(r.gps_route, '')) in ('POLFERRIES', 'GDN-NYN') and r.gps_country = 'PL'
        then 'Gdańsk'
      when upper(coalesce(r.gps_route, '')) in ('STENA', 'GDY-KAA') and r.gps_country = 'PL'
        then 'Gdynia'
      when upper(coalesce(r.gps_route, '')) in ('POLFERRIES', 'GDN-NYN') and r.gps_country = 'SE'
        then 'Nynäshamn'
      when upper(coalesce(r.gps_route, '')) in ('STENA', 'GDY-KAA') and r.gps_country = 'SE'
        then 'Karlskrona'
      else coalesce(nullif(btrim(r.gps_fence_name), ''), 'innym')
    end;

    v_code := coalesce(
      nullif(nullif(btrim(public.load_sms_code(r.load_id)), ''), '—'),
      'transport'
    );
    v_params := jsonb_build_object(
      'code', v_code,
      'gps_port', v_gps_port,
      'dep_port', v_dep_port
    );
    v_title := format(
      'GPS w porcie %s, rejs z portu %s — sprawdź przydział',
      v_gps_port, v_dep_port
    );
    perform public.raise_risk(
      r.load_id, 'FERRY', 'HIGH', v_title,
      jsonb_build_object(
        'sailing_id', r.sailing_id,
        'title_key', 'rk_gps_wrong_port',
        'params', v_params,
        'audience', 'HHL_PRZEWOZNIK',
        'gps_route', r.gps_route,
        'sail_route', r.sail_route,
        'gps_kind', r.gps_kind,
        'dep', r.dep,
        'lat', r.lat,
        'lon', r.lon,
        'pos_ts', r.pos_ts,
        'source', 'dp235_port_in'
      ),
      v_dedup
    );
    n := n + 1;
  end loop;

  return n;
end $function$;

revoke all on function public.detect_gps_wrong_ferry_port(timestamptz, interval)
  from public, anon, authenticated;
grant execute on function public.detect_gps_wrong_ferry_port(timestamptz, interval)
  to service_role;
comment on function public.detect_gps_wrong_ferry_port(timestamptz, interval) is
  'DP-235: GPS w obcym PORT_OUT (< FERRY) lub obcym PORT_IN (FERRY) → HIGH rk_gps_wrong_port; powtórka po ATD nie otwiera i nie zamyka.';

commit;
