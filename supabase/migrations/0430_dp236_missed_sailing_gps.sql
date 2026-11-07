-- DP-236 (#873): GPS daleko od PORT_OUT przed ATD → bez FERRY + ryzyko rk_missed_sailing.
-- Świeży GPS ≤2 h przed odejściem i > X km od strefy PORT_OUT portu wyjścia → blokada.
-- Brak GPS / GPS starszy niż 2 h → jak dziś (AIS / rozkład).
-- Jednorazowo: FERRY + rejs DOPLYNAL + świeży GPS (≤1 h) daleko od obu portów → ryzyko (bez zmiany statusu).

begin;

insert into public.app_parameters (key, value, label, source) values
  (
    'FERRY_PROMOTE_MAX_KM_FROM_PORT',
    5,
    'DP-236: maks. km od PORT_OUT wyjścia przy świeżym GPS przed ATD — dalej = bez FERRY + MISSED_SAILING',
    'DP-236 #873 07.11.2026'
  )
on conflict (key) do update
  set label = excluded.label,
      source = excluded.source,
      updated_at = now();

create or replace function public.gps_allows_ferry_promote(
  p_load_id uuid,
  p_sail_route text,
  p_dep timestamptz
) returns boolean
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_project uuid;
  v_sailing uuid;
  v_geom geometry;
  v_gps_ts timestamptz;
  v_in_own boolean;
  v_foreign record;
  v_dep_port text;
  v_gps_port text;
  v_code text;
  v_title text;
  v_params jsonb;
  v_dedup text;
  v_max_km numeric;
  v_dist_m double precision;
  v_km numeric;
  v_vessel text;
  v_dep_txt text;
begin
  if p_load_id is null or p_dep is null then
    return true;
  end if;

  select l.project_id, l.sailing_id
    into v_project, v_sailing
    from public.loads l
   where l.id = p_load_id;

  -- Otwarte GPS_WRONG_PORT → bez FERRY (F7 #870 B1).
  if v_sailing is not null and exists (
    select 1 from public.risk_signals rs
     where rs.load_id = p_load_id
       and rs.resolved_at is null
       and rs.dedup_key = 'GPS_WRONG_PORT:' || p_load_id::text || ':' || v_sailing::text
  ) then
    return false;
  end if;

  select p.geom_raw::geometry, p.ts
    into v_geom, v_gps_ts
    from public.positions p
   where p.load_id = p_load_id
     and p.ts <= p_dep
     and coalesce((p.raw->>'stale_point')::boolean, false) is not true
   order by p.ts desc
   limit 1;

  -- Brak GPS przed odejściem → jak dotąd (AIS / rozkład).
  if v_geom is null then
    return true;
  end if;

  -- DP-236: GPS starszy niż 2 h przed ATD → jak brak świeżego GPS.
  if v_gps_ts < p_dep - interval '2 hours' then
    return true;
  end if;

  select exists (
    select 1
      from public.geofences g
     where g.project_id = v_project
       and g.active
       and g.kind = 'PORT_OUT'
       and st_contains(g.geom, v_geom)
       and public.ferry_geofence_matches_route(g.route, p_sail_route) is true
  ) into v_in_own;

  if v_in_own is true then
    return true;
  end if;

  -- GPS w obcym PORT_OUT → ryzyko (HHL+SCX); bez FERRY / bez AIS na mapie.
  select g.route as gps_route,
         g.name as gps_fence_name,
         g.country as gps_country,
         pf.code as dep_port_code,
         pf.name as dep_port_name
    into v_foreign
    from public.geofences g
    left join public.ferry_routes fr
      on fr.code = upper(btrim(p_sail_route)) and fr.active
    left join public.ferry_ports pf on pf.code = fr.port_from
   where g.project_id = v_project
     and g.active
     and g.kind = 'PORT_OUT'
     and st_contains(g.geom, v_geom)
     and public.ferry_geofence_matches_route(g.route, p_sail_route) is not true
   order by g.name
   limit 1;

  if v_foreign.gps_route is not null then
    if v_sailing is not null then
      v_dedup := 'GPS_WRONG_PORT:' || p_load_id || ':' || v_sailing;
      if not exists (
        select 1 from public.risk_signals
         where dedup_key = v_dedup and resolved_at is not null
      ) then
        v_dep_port := coalesce(
          nullif(btrim(v_foreign.dep_port_name), ''),
          nullif(btrim(v_foreign.dep_port_code), ''),
          'rejsu'
        );
        v_gps_port := case
          when upper(coalesce(v_foreign.gps_route, '')) in ('POLFERRIES', 'GDN-NYN')
               and v_foreign.gps_country = 'PL'
            then 'Gdańsk'
          when upper(coalesce(v_foreign.gps_route, '')) in ('STENA', 'GDY-KAA')
               and v_foreign.gps_country = 'PL'
            then 'Gdynia'
          else coalesce(nullif(btrim(v_foreign.gps_fence_name), ''), 'innym')
        end;
        v_code := coalesce(
          nullif(nullif(btrim(public.load_sms_code(p_load_id)), ''), '—'),
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
          p_load_id, 'FERRY', 'HIGH', v_title,
          jsonb_build_object(
            'sailing_id', v_sailing,
            'title_key', 'rk_gps_wrong_port',
            'params', v_params,
            'audience', 'HHL_PRZEWOZNIK',
            'gps_route', v_foreign.gps_route,
            'sail_route', p_sail_route,
            'dep', p_dep,
            'source', 'promote_ferry_departures'
          ),
          v_dedup
        );
      end if;
    end if;
    return false;
  end if;

  -- DP-236: poza PORT_OUT — odległość od własnej strefy wyjścia.
  select coalesce(
    (select value from public.app_parameters where key = 'FERRY_PROMOTE_MAX_KM_FROM_PORT'),
    5
  ) into v_max_km;

  select min(st_distance(g.geom::geography, v_geom::geography))
    into v_dist_m
    from public.geofences g
   where g.project_id = v_project
     and g.active
     and g.kind = 'PORT_OUT'
     and public.ferry_geofence_matches_route(g.route, p_sail_route) is true;

  -- Brak strefy PORT_OUT trasy → jak #461 (nie blokuj).
  if v_dist_m is null then
    return true;
  end if;

  if (v_dist_m / 1000.0) <= v_max_km then
    return true;
  end if;

  -- Daleko od portu wyjścia → bez FERRY + MISSED_SAILING.
  if v_sailing is not null then
    v_dedup := 'MISSED_SAILING:' || p_load_id || ':' || v_sailing;
    if not exists (
      select 1 from public.risk_signals
       where dedup_key = v_dedup and resolved_at is not null
    ) then
      select coalesce(nullif(btrim(v.name), ''), 'prom'),
             to_char(coalesce(s.actual_departure_at, s.departure_at) at time zone 'Europe/Warsaw', 'DD.MM HH24:MI')
        into v_vessel, v_dep_txt
        from public.sailings s
        left join public.vessels v on v.id = s.vessel_id
       where s.id = v_sailing;
      v_km := round((v_dist_m / 1000.0)::numeric, 0);
      v_params := jsonb_build_object(
        'vessel', coalesce(v_vessel, 'prom'),
        'dep', coalesce(v_dep_txt, ''),
        'km', v_km
      );
      v_title := format(
        'Transport nie zdążył na rejs %s %s — GPS %s km od portu; przypisz nowy rejs',
        coalesce(v_vessel, 'prom'),
        coalesce(v_dep_txt, ''),
        v_km::text
      );
      perform public.raise_risk(
        p_load_id, 'FERRY', 'HIGH', v_title,
        jsonb_build_object(
          'sailing_id', v_sailing,
          'title_key', 'rk_missed_sailing',
          'params', v_params,
          'audience', 'HHL_PRZEWOZNIK',
          'sail_route', p_sail_route,
          'dep', p_dep,
          'gps_km', v_km,
          'source', 'promote_ferry_departures'
        ),
        v_dedup
      );
    end if;
  end if;

  return false;
end $function$;

revoke all on function public.gps_allows_ferry_promote(uuid, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.gps_allows_ferry_promote(uuid, text, timestamptz)
  to service_role;
comment on function public.gps_allows_ferry_promote(uuid, text, timestamptz) is
  'DP-236: FERRY po ATD — blokada obcy PORT_OUT (rk_gps_wrong_port) lub świeży GPS > FERRY_PROMOTE_MAX_KM_FROM_PORT od PORT_OUT (rk_missed_sailing); brak/stary GPS / w porcie / ≤X km — jak #461.';

-- ---------------------------------------------------------------------------
-- Jednorazowo: FERRY + DOPLYNAL + świeży GPS daleko od obu portów → ryzyko
-- (bez auto-zmiany statusu — HHL przypisze nowy rejs).
-- ---------------------------------------------------------------------------
do $backfill236$
declare
  r record;
  v_max_km numeric;
  v_geom geometry;
  v_dep_m double precision;
  v_arr_m double precision;
  v_km numeric;
  v_vessel text;
  v_dep_txt text;
  v_dedup text;
  v_title text;
  v_params jsonb;
  v_n int := 0;
begin
  select coalesce(
    (select value from public.app_parameters where key = 'FERRY_PROMOTE_MAX_KM_FROM_PORT'),
    5
  ) into v_max_km;

  for r in
    select l.id as load_id,
           l.project_id,
           l.sailing_id,
           s.route as sail_route,
           coalesce(s.actual_departure_at, s.departure_at) as dep_at
      from public.loads l
      join public.sailings s on s.id = l.sailing_id
     where l.status = 'FERRY'
       and s.status = 'DOPLYNAL'
       and l.sailing_id is not null
  loop
    select p.geom_raw::geometry
      into v_geom
      from public.positions p
     where p.load_id = r.load_id
       and p.ts >= now() - interval '1 hour'
       and coalesce((p.raw->>'stale_point')::boolean, false) is not true
     order by p.ts desc
     limit 1;

    if v_geom is null then
      continue;
    end if;

    select min(st_distance(g.geom::geography, v_geom::geography))
      into v_dep_m
      from public.geofences g
     where g.project_id = r.project_id
       and g.active
       and g.kind = 'PORT_OUT'
       and public.ferry_geofence_matches_route(g.route, r.sail_route) is true;

    select min(st_distance(g.geom::geography, v_geom::geography))
      into v_arr_m
      from public.geofences g
     where g.project_id = r.project_id
       and g.active
       and g.kind = 'PORT_IN'
       and public.ferry_geofence_matches_route(g.route, r.sail_route) is true;

    if v_dep_m is null or v_arr_m is null then
      continue;
    end if;
    if (v_dep_m / 1000.0) <= v_max_km or (v_arr_m / 1000.0) <= v_max_km then
      continue;
    end if;

    v_dedup := 'MISSED_SAILING:' || r.load_id || ':' || r.sailing_id;
    if exists (
      select 1 from public.risk_signals
       where dedup_key = v_dedup
    ) then
      continue;
    end if;

    select coalesce(nullif(btrim(v.name), ''), 'prom'),
           to_char(r.dep_at at time zone 'Europe/Warsaw', 'DD.MM HH24:MI')
      into v_vessel, v_dep_txt
      from public.sailings s
      left join public.vessels v on v.id = s.vessel_id
     where s.id = r.sailing_id;

    v_km := round((least(v_dep_m, v_arr_m) / 1000.0)::numeric, 0);
    v_params := jsonb_build_object(
      'vessel', coalesce(v_vessel, 'prom'),
      'dep', coalesce(v_dep_txt, ''),
      'km', v_km
    );
    v_title := format(
      'Transport nie zdążył na rejs %s %s — GPS %s km od portu; przypisz nowy rejs',
      coalesce(v_vessel, 'prom'),
      coalesce(v_dep_txt, ''),
      v_km::text
    );
    perform public.raise_risk(
      r.load_id, 'FERRY', 'HIGH', v_title,
      jsonb_build_object(
        'sailing_id', r.sailing_id,
        'title_key', 'rk_missed_sailing',
        'params', v_params,
        'audience', 'HHL_PRZEWOZNIK',
        'sail_route', r.sail_route,
        'dep', r.dep_at,
        'gps_km', v_km,
        'source', 'dp236_backfill'
      ),
      v_dedup
    );
    v_n := v_n + 1;
  end loop;

  raise notice 'DP-236 backfill MISSED_SAILING: %', v_n;
end $backfill236$;

commit;
