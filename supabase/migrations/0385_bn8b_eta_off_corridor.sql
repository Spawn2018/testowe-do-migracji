
-- BN8b (#720 §7) — OFF_CORRIDOR z geometrii HERE BN7 + compute_load_eta bałtyckie.
-- Nie edytuj starych migracji. Kopia funkcji z OSTATNIEJ definicji (0382 / 0338).

begin;

-- ---------------------------------------------------------------------------
-- Pomocnicze: świeża geometria HERE, sync polilinii, bufor MUU/PLD
-- ---------------------------------------------------------------------------
create or replace function public.bn8b_here_corridor_fresh(p_corridor text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.here_road_legs h
      join public.here_road_geometry g on g.leg = h.leg
     where h.corridor_code = p_corridor
       and g.points is not null
       and jsonb_typeof(g.points) = 'array'
       and jsonb_array_length(g.points) >= 2
       and g.fetched_at is not null
       and g.fetched_at >= now() - interval '7 days'
  );
$$;
comment on function public.bn8b_here_corridor_fresh(text) is
  'BN8b/#720: świeża geometria HERE dla corridor_code (punkty ≥2, fetched_at ≤7 dni).';
revoke all on function public.bn8b_here_corridor_fresh(text) from public, anon, authenticated;
grant execute on function public.bn8b_here_corridor_fresh(text) to service_role;

create or replace function public.bn8b_sync_corridor_polyline_from_here(p_corridor text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_geom geometry;
  v_km numeric;
begin
  -- Najświeższy leg z tym corridor_code (HERE, nie przybliżenie OSM).
  select st_setsrid(
           st_makeline(
             array_agg(
               st_makepoint((p->>1)::float8, (p->>0)::float8)
               order by ord
             )
           ),
           4326
         )
    into v_geom
    from (
      select g.points, g.fetched_at
        from public.here_road_legs h
        join public.here_road_geometry g on g.leg = h.leg
       where h.corridor_code = p_corridor
         and g.points is not null
         and jsonb_typeof(g.points) = 'array'
         and jsonb_array_length(g.points) >= 2
         and g.fetched_at is not null
         and g.fetched_at >= now() - interval '7 days'
       order by g.fetched_at desc
       limit 1
    ) g
   cross join lateral jsonb_array_elements(g.points) with ordinality as t(p, ord);

  if v_geom is null or st_npoints(v_geom) < 2 then
    return false;
  end if;

  v_km := round((st_length(v_geom::geography) / 1000.0)::numeric, 2);
  insert into public.corridor_polylines (code, geom, total_km, source, attribution, updated_at)
  values (
    p_corridor, v_geom, v_km,
    'HERE — sync BN8b (leg→corridor_code)',
    '© HERE',
    now()
  )
  on conflict (code) do update set
    geom = excluded.geom,
    total_km = excluded.total_km,
    source = excluded.source,
    attribution = excluded.attribution,
    updated_at = now();
  return true;
end;
$$;
comment on function public.bn8b_sync_corridor_polyline_from_here(text) is
  'BN8b/#720: nadpisuje corridor_polylines geometrią z here_road_geometry (świeża HERE).';
revoke all on function public.bn8b_sync_corridor_polyline_from_here(text)
  from public, anon, authenticated;
grant execute on function public.bn8b_sync_corridor_polyline_from_here(text) to service_role;

create or replace function public.bn8b_near_muu_pld_terminal(p_geom geometry)
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $$
  -- Muuga/Paldiski leżą poza końcem PL_EE_E67 — bufor 2 km jak terminal FI w BN4/BN6.
  select p_geom is not null and exists (
    select 1
      from public.ferry_ports fp
     where fp.code in ('MUU', 'PLD')
       and coalesce(fp.active, true)
       and st_distance(
             p_geom::geography,
             st_setsrid(st_makepoint(fp.lon, fp.lat), 4326)::geography
           ) <= 2000
  );
$$;
comment on function public.bn8b_near_muu_pld_terminal(geometry) is
  'BN8b/#720: punkt ≤2 km od terminalu MUU/PLD (bez fałszywego OFF_CORRIDOR).';
revoke all on function public.bn8b_near_muu_pld_terminal(geometry)
  from public, anon, authenticated;
grant execute on function public.bn8b_near_muu_pld_terminal(geometry) to service_role;


-- ---------------------------------------------------------------------------
-- promote_ferry_departures (komentarz assume_dep_min)
-- ---------------------------------------------------------------------------
create or replace function public.promote_ferry_departures(p_now timestamp with time zone default now())
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  r record;
  v_op text;
  v_dep timestamptz;
  v_src text;
  v_reason text;
  v_prev text;
  v_ev bigint;
  v_ev_at timestamptz;
  v_ev_src text;
  n int := 0;
begin
  /* Odwołany rejs — jak dotąd, względem planu (nie AIS). */
  for r in
    select l.id as load_id, l.project_id, l.status, s.id as sailing_id,
           s.route as sailing_route, v.name as vessel,
           coalesce(s.delayed_departure_at, s.departure_at) as plan_dep
      from loads l
      join sailings s on s.id = l.sailing_id and public.ferry_route_is_outbound(s.route)
      join vessels  v on v.id = s.vessel_id
     where s.status = 'ODWOLANY'
       and coalesce(s.delayed_departure_at, s.departure_at) <= p_now
       and l.status in ('PLANNED','RESOURCES_PENDING','DOCS_PENDING','READY',
                        'AT_LOADING','IN_TRANSIT_PL','AT_PORT_GDANSK')
  loop
    perform raise_risk(r.load_id, 'FERRY', 'HIGH',
      format('Rejs %s z %s odwołany — transport wymaga nowego rejsu', r.vessel,
             to_char(r.plan_dep at time zone 'Europe/Warsaw', 'DD.MM HH24:MI')),
      jsonb_build_object(
        'sailing_id', r.sailing_id,
        'title_key', 'rk_sailing_cancelled',
        'params', jsonb_build_object(
          'vessel', r.vessel,
          'dep', to_char(r.plan_dep at time zone 'Europe/Warsaw', 'DD.MM HH24:MI'))),
      'SAILING_CANCELLED:' || r.load_id || ':' || r.sailing_id);
  end loop;

  /* Prom: AIS albo plan + assume_dep_min z ferry_routes (dawniej sztywne +1 h).
     F7: tylko READY…AT_PORT_GDANSK (+ FERRY do korekty AIS) — nie PLANNED/DOCS/RESOURCES. */
  for r in
    select l.id as load_id, l.project_id, l.status, s.id as sailing_id,
           s.route as sailing_route, v.name as vessel,
           s.actual_departure_at as actual_dep,
           coalesce(s.delayed_departure_at, s.departure_at) as plan_dep,
           coalesce(fr.assume_dep_min, 60) as assume_dep_min
      from loads l
      join sailings s on s.id = l.sailing_id and public.ferry_route_is_outbound(s.route)
      join vessels  v on v.id = s.vessel_id
      left join ferry_routes fr on fr.code = upper(btrim(s.route)) and fr.active
     where s.status is distinct from 'ODWOLANY'
       and l.status in ('READY','AT_LOADING','IN_TRANSIT_PL','AT_PORT_GDANSK','FERRY')
  loop
    v_dep := null;
    v_src := null;
    v_reason := null;
    v_ev := null;
    v_ev_at := null;
    v_ev_src := null;

    if r.actual_dep is not null and r.actual_dep <= p_now then
      v_dep := r.actual_dep;
      v_src := 'AIS';
      v_reason := 'wypłynięcie rejsu (AIS)';
    elsif r.plan_dep is not null
          and r.plan_dep + make_interval(mins => greatest(coalesce(r.assume_dep_min, 60), 1)) <= p_now
          and r.actual_dep is null then
      v_dep := r.plan_dep + make_interval(mins => greatest(coalesce(r.assume_dep_min, 60), 1));
      v_src := 'SCHEDULE_ASSUMED';
      v_reason := 'wypłynięcie przyjęte z rozkładu (brak AIS, brak odwołania)';
    end if;

    if v_dep is null then
      continue;
    end if;

    v_op := public.eta_obs_operator_key(r.sailing_route); -- BN8a: bez fallbacku POLFERRIES

    /* Już Prom — AIS koryguje godzinę osi (bez powiadomień, jak 0235). */
    if r.status = 'FERRY' and v_src = 'AIS' then
      begin
        select e.id, e.occurred_at, e.payload->>'source'
          into v_ev, v_ev_at, v_ev_src
          from load_events e
         where e.load_id = r.load_id
           and (
             e.event_type = 'STATUS_FERRY'
             or (e.event_type = 'STATUS_AUTO' and e.payload->>'to' = 'FERRY')
           )
           and not exists (
             select 1 from load_events z
              where z.load_id = e.load_id
                and z.payload->>'zastepuje' = e.id::text
           )
         order by e.id desc
         limit 1;
        if v_ev is not null
           and (v_ev_at is distinct from v_dep or coalesce(v_ev_src, '') is distinct from 'AIS') then
          v_prev := current_setting('tower.bulk_quiet', true);
          perform set_config('tower.bulk_quiet', 'on', true);
          insert into load_events (load_id, event_type, occurred_at, payload)
          values (
            r.load_id,
            'STATUS_AUTO',
            v_dep,
            jsonb_build_object(
              'from', 'FERRY',
              'to', 'FERRY',
              'reason', v_reason,
              'sailing_id', r.sailing_id,
              'statek', r.vessel,
              'odejscie', v_dep,
              'route', r.sailing_route,
              'operator', v_op,
              'source', 'AIS',
              'korekta', true,
              'zastepuje', v_ev,
              'poprzednio', v_ev_at,
              'actor', 'system'
            )
          );
          perform set_config('tower.bulk_quiet', coalesce(v_prev, ''), true);
        end if;
      exception when others then
        raise exception 'promote_ferry_departures AIS korekta load=%: %', r.load_id, sqlerrm;
      end;
      continue;
    end if;

    if r.status = 'FERRY' then
      continue;
    end if;

    /* #461: bez dzwonka przy AIS / SCHEDULE_ASSUMED (trg_load_status_matrix_notify × bulk_quiet). */
    v_prev := current_setting('tower.bulk_quiet', true);
    perform set_config('tower.bulk_quiet', 'on', true);
    if public.auto_set_status(
         r.load_id, r.status, 'FERRY', v_reason, v_dep,
         jsonb_build_object(
           'sailing_id', r.sailing_id,
           'statek', r.vessel,
           'odejscie', v_dep,
           'route', r.sailing_route,
           'operator', v_op,
           'source', v_src,
           'actor', 'system'
         )
       ) then
      n := n + 1;
    end if;
    perform set_config('tower.bulk_quiet', coalesce(v_prev, ''), true);
  end loop;
  return n;
end $function$;

-- ---------------------------------------------------------------------------
-- detect_ferry_overdue (r.arr_country; p_grace przestarzały)
-- ---------------------------------------------------------------------------
create or replace function public.detect_ferry_overdue(
  p_now timestamptz default now(),
  p_grace interval default interval '2 hours'  -- przestarzały: tolerancja z ferry_routes.overdue_tolerance_min
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
begin
  -- Zamknij overdue po przejściu do SE.
  update public.risk_signals rs
     set resolved_at = coalesce(p_now, now())
   where rs.resolved_at is null
     and rs.dedup_key like 'FERRY_OVERDUE:%'
     and exists (
       select 1 from public.loads l
        where l.id = rs.load_id
          and public.load_status_rank(l.status)
              >= public.load_status_rank('AT_PORT_NYNASHAMN'::public.load_status)
     );

  for r in
    select x.load_id, x.project_id, x.sailing_id, x.vessel,
           x.plan_arr, x.act_arr, x.tol_min, x.arr_country,
           case
             -- Powrót (arrival PL/EE): bez gałęzi „actual” — świadomie tylko SE|FI.
             when x.act_arr is not null
                  and x.arr_country in ('SE', 'FI')
                  and x.act_arr
                      + make_interval(mins => greatest(coalesce(x.tol_min, 120), 1))
                      < coalesce(p_now, now())
                  and not exists (
                    select 1 from public.positions p
                     where p.load_id = x.load_id
                       and p.ts > x.act_arr
                       and coalesce((p.raw->>'stale_point')::boolean, false) is not true
                       and (
                         (x.arr_country = 'FI'
                          and st_covers(public.finland_land_geom(), p.geom_raw::geometry))
                         or (x.arr_country = 'SE'
                             and st_covers(public.sweden_land_geom(), p.geom_raw::geometry))
                       )
                  )
             then 'actual'
             when x.plan_arr
                  + make_interval(mins => greatest(coalesce(x.tol_min, 120), 1))
                  < coalesce(p_now, now())
             then 'plan'
             else null
           end as why
      from (
        select l.id as load_id, l.project_id, s.id as sailing_id, v.name as vessel,
               coalesce(s.delayed_arrival_at, s.arrival_at) as plan_arr,
               s.actual_arrival_at as act_arr,
               coalesce(fr.overdue_tolerance_min, 120) as tol_min,
               public.ferry_route_arrival_country(s.route) as arr_country
          from public.loads l
          join public.sailings s on s.id = l.sailing_id
          join public.vessels v on v.id = s.vessel_id
          left join public.ferry_routes fr on fr.code = upper(btrim(s.route)) and fr.active
         where l.status = 'FERRY'
      ) x
  loop
    if r.why is null then
      continue;
    end if;
    -- F7 r3: po ręcznym zamknięciu nie wraca.
    if exists (
      select 1 from public.risk_signals
       where dedup_key = 'FERRY_OVERDUE:' || r.load_id || ':' || r.sailing_id
         and resolved_at is not null
    ) then
      continue;
    end if;
    v_code := coalesce(
      nullif(nullif(btrim(public.load_sms_code(r.load_id)), ''), '—'),
      'transport'
    );
    if r.why = 'actual' then
      v_title := format('Sprawdź %s po dopłynięciu', v_code);
      v_params := jsonb_build_object('code', v_code, 'vessel', r.vessel,
        'arr', to_char(r.act_arr at time zone 'Europe/Warsaw', 'DD.MM HH24:MI'));
      perform public.raise_risk(
        r.load_id, 'FERRY', 'MEDIUM', v_title,
        jsonb_build_object(
          'sailing_id', r.sailing_id,
          'title_key', 'rk_ferry_check_after_arrival',
          'params', v_params,
          'why', r.why,
          'actual_arrival_at', r.act_arr
        ),
        'FERRY_OVERDUE:' || r.load_id || ':' || r.sailing_id
      );
    else
      v_title := format(
        'Transport nadal w statusie PROM, choć %s miał przypłynąć %s',
        r.vessel,
        to_char(r.plan_arr at time zone 'Europe/Warsaw', 'DD.MM HH24:MI')
      );
      v_params := jsonb_build_object('vessel', r.vessel,
        'arr', to_char(r.plan_arr at time zone 'Europe/Warsaw', 'DD.MM HH24:MI'));
      perform public.raise_risk(
        r.load_id, 'FERRY', 'MEDIUM', v_title,
        jsonb_build_object(
          'sailing_id', r.sailing_id,
          'title_key', 'rk_ferry_overdue',
          'params', v_params,
          'why', r.why,
          'actual_arrival_at', r.act_arr
        ),
        'FERRY_OVERDUE:' || r.load_id || ':' || r.sailing_id
      );
    end if;
    n := n + 1;
  end loop;
  return n;
end $function$;
revoke all on function public.detect_ferry_overdue(timestamptz, interval)
  from public, anon, authenticated;
grant execute on function public.detect_ferry_overdue(timestamptz, interval)
  to service_role;
comment on function public.detect_ferry_overdue(timestamptz, interval) is
  'BN8b/#720: overdue_tolerance_min; r.arr_country; p_grace przestarzały; powrót PL/EE bez gałęzi actual.';

-- ---------------------------------------------------------------------------
-- sailing_mismatch_propose_id (ferry_route_departure_country)
-- ---------------------------------------------------------------------------
create or replace function public.sailing_mismatch_propose_id(p_load_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_project uuid;
  v_route   text;
  v_last_pl timestamptz;
  v_first_land timestamptz;
  v_prop    uuid;
begin
  select l.project_id, coalesce(s.route, l.ferry_route)
    into v_project, v_route
    from public.loads l
    left join public.sailings s on s.id = l.sailing_id
   where l.id = p_load_id;
  if v_project is null then
    return null;
  end if;

  select min(p.ts) into v_first_land
    from public.positions p
   where p.load_id = p_load_id
     and coalesce((p.raw->>'stale_point')::boolean, false) is not true
     and (
       st_covers(public.sweden_land_geom(), p.geom_raw::geometry)
       or st_covers(public.finland_land_geom(), p.geom_raw::geometry)
     );

  if v_first_land is null then
    return null;
  end if;

  -- BN8a: ostatni punkt w kraju wyjścia (PL bbox albo EE/PL strefy PORT_OUT/LOADING).
  select max(p.ts) into v_last_pl
    from public.positions p
   where p.load_id = p_load_id
     and p.ts < v_first_land
     and coalesce((p.raw->>'stale_point')::boolean, false) is not true
     and (
       (st_x(p.geom_raw::geometry) between 14.0 and 24.2
        and st_y(p.geom_raw::geometry) between 49.0 and 54.45)
       or exists (
         select 1 from public.geofences g
          where g.project_id = v_project
            and g.country = coalesce(public.ferry_route_departure_country(v_route), g.country)
            and g.kind in ('PORT_OUT', 'LOADING')
            and st_covers(g.geom, p.geom_raw::geometry)
       )
     );

  -- BN8a: outbound PL/EE → SE/FI; bez ograniczenia do samego PL.
  select s.id into v_prop
    from public.sailings s
   where s.project_id = v_project
     and s.status is distinct from 'ODWOLANY'
     and s.actual_departure_at is not null
     and public.ferry_route_is_outbound(s.route)
     and exists (
       select 1
         from public.ferry_routes fr
        where fr.code = upper(btrim(s.route))
          and fr.active
          and public.ferry_route_departure_country(s.route) is not null
          and public.ferry_route_departure_country(s.route)
                = coalesce(public.ferry_route_departure_country(v_route),
                           public.ferry_route_departure_country(s.route))
     )
     and (v_route is null
          or public.eta_obs_route_family(s.route)
             = public.eta_obs_route_family(v_route))
     and (v_last_pl is null or s.actual_departure_at >= v_last_pl)
     and s.actual_departure_at <= v_first_land
     and (s.actual_arrival_at is null or s.actual_arrival_at <= v_first_land)
   order by s.actual_departure_at desc, s.id
   limit 1;

  return v_prop;
end $function$;
revoke all on function public.sailing_mismatch_propose_id(uuid)
  from public, anon, authenticated;
grant execute on function public.sailing_mismatch_propose_id(uuid) to service_role;
comment on function public.sailing_mismatch_propose_id(uuid) is
  'BN8b/#720: outbound; kraj wyjścia = ferry_route_departure_country; filtr rodziny; ląd SE|FI.';

-- ---------------------------------------------------------------------------
-- compute_load_eta (ciało z 0338 + BN8b)
-- ---------------------------------------------------------------------------
create or replace function public.compute_load_eta(p_load uuid, p_now timestamp with time zone DEFAULT now())
 returns table(eta timestamp with time zone, conf_min integer, basis jsonb)
 language plpgsql
 stable security definer
 set search_path = public, pg_temp
as $function$
declare
  l          record;
  v_sail     record;
  p          record;
  h_pl       numeric; sp_pl numeric;
  h_ci       numeric;
  h_cross    numeric; sp_cross numeric;
  h_se       numeric;
  fresh_h    numeric;
  v_status   load_status;
  v_eta      timestamptz;
  v_var      numeric := 0;
  v_sum      numeric := 0;
  v_comp     jsonb := '[]'::jsonb;
  h_road numeric; sp_road numeric; h_rest numeric; sp_rest numeric; h_brk numeric; sp_brk numeric;
  h_road_eff numeric;
  v_slow     numeric := 1.00;
  v_slow_reason text;
  v_segs     jsonb := '[]'::jsonb;
  v_flags    text[] := '{}';
  v_seg      text;
  v_start    timestamptz;
  v_frac     numeric;
  v_rem      numeric;
  v_dep      timestamptz;
  v_arr      timestamptz;
  v_sail_src text := null;
  v_has      boolean := false;
  g_load geometry; g_pout geometry; g_pin geometry; g_site geometry;
  cp record;
  v_attr text := '© OpenStreetMap contributors';
  v_progress text := 'status';
  v_off numeric;
  v_rem_km numeric;
  v_causes jsonb := '{}'::jsonb;
  v_drive_h numeric := 0;
  v_checkin_h numeric := 0;
  v_rest_h numeric := 0;
  st record;
  sch record;
  v_drive_need numeric;
  v_break_h numeric := 0;
  v_weather_pct numeric := 0;
  v_fresh boolean := false;
  v_alat double precision;
  v_alon double precision;
  v_sog real;
  v_obs timestamptz;
  v_sea_h numeric;
  v_left boolean := false;
  v_h4_rest_spread numeric := 0;
  v_op text;
  v_load_route text;
  v_family text;           -- BN8b: rodzina trasy (load_route_family)
  v_pl_corr text;          -- BN8b: korytarz przed promem
  v_se_corr text;          -- korytarz po promie / SE (SE_E22 / inland / SE_E4 / BN7)
  v_se_road_code text;     -- kod godzin SE_ROAD(_KAA[_INLAND]) / FI_ROAD
  v_is_kaa boolean := false;
begin
  select * into l from loads where id = p_load;
  if not found then return; end if;
  v_status := l.status;
  -- BN8b/#720: rodzina z load_route_family; null = regresja GDN-NYN (jak dotąd).
  v_load_route := public.load_route_family(p_load);
  v_family := coalesce(public.eta_obs_route_family(v_load_route), 'GDN-NYN');
  v_op := public.eta_obs_operator_key(v_load_route);

  select hours, spread_pct / 100 into h_pl, sp_pl
    from eta_segment_params
   where code = public.eta_obs_segment_code(v_family, 'PL_ROAD');
  -- PORT_CHECKIN per port (EE 2 h — 82-C); fallback ogólny.
  select hours into h_ci from eta_segment_params
   where code = coalesce(
     public.eta_obs_segment_code(v_family, 'PORT_CHECKIN'),
     'PORT_CHECKIN'
   );
  select hours, spread_pct / 100 into h_cross, sp_cross
    from eta_segment_params
   where code = public.eta_obs_segment_code(v_family, 'CROSSING');
  select hours, spread_pct / 100 into h_road, sp_road
    from eta_segment_params
   where code = public.eta_obs_segment_code(v_family, 'SE_ROAD');
  select hours, spread_pct / 100 into h_rest, sp_rest from eta_segment_params where code = 'SE_DAILY_REST';
  select hours, spread_pct / 100 into h_brk, sp_brk from eta_segment_params where code = 'SE_BREAKS';
  -- F7 r4: bez ogólnego coalesce(h_road,17)/(h_pl,4.5) — zasłaniały warianty ze słownika
  h_rest := coalesce(h_rest, 11); sp_rest := coalesce(sp_rest, 0);
  h_brk := coalesce(h_brk, 2); sp_brk := coalesce(sp_brk, 0.5);
  select hours into fresh_h from eta_segment_params where code = 'GPS_FRESH_MIN';
  h_ci := coalesce(h_ci, 2);
  h_cross := coalesce(h_cross, 18); sp_cross := coalesce(sp_cross, 0.15);
  fresh_h := coalesce(fresh_h, 1.5);

  -- BN8b: korytarz drogi z ferry_routes.road_corridor_* → here_road_legs.corridor_code.
  v_se_road_code := public.eta_obs_segment_code(v_family, 'SE_ROAD');
  v_is_kaa := coalesce(v_se_road_code, '') like '%KAA%';
  select ts, coalesce(geom_snapped, geom_raw) as g into p from positions where load_id = p_load order by ts desc limit 1;

  select h.corridor_code into v_pl_corr
    from public.ferry_routes fr
    join public.here_road_legs h on h.leg = fr.road_corridor_pre
   where fr.active
     and fr.family_key = v_family
     and public.ferry_route_is_outbound(fr.code)
   order by fr.code
   limit 1;
  v_pl_corr := coalesce(v_pl_corr, 'PL_ROAD');

  select h.corridor_code into v_se_corr
    from public.ferry_routes fr
    join public.here_road_legs h on h.leg = fr.road_corridor_post
   where fr.active
     and fr.family_key = v_family
     and public.ferry_route_is_outbound(fr.code)
   order by fr.code
   limit 1;

  if v_is_kaa then
    v_se_corr := public.stena_se_eta_corridor(p.g);
    if v_se_corr in ('SE_KAA_INLAND', 'SE_KAA_TRACK') then
      v_se_road_code := 'SE_ROAD_KAA_INLAND';
      if exists (select 1 from eta_segment_params where code = 'SE_ROAD_KAA_INLAND') then
        select hours, spread_pct / 100 into h_road, sp_road
          from eta_segment_params where code = 'SE_ROAD_KAA_INLAND';
      end if;
    else
      v_se_corr := coalesce(v_se_corr, 'SE_E22');
    end if;
  else
    v_se_corr := coalesce(v_se_corr, 'SE_E4');
  end if;

  -- Spowolnienie: korytarz BN7 / SE + spowolnienia BN6 ROAD_* (LT/LV/EE/FI).
  select slowdown_mult, reason into v_slow, v_slow_reason
    from corridor_conditions where corridor = v_se_corr;
  if v_slow is null and v_se_corr = 'FI_E75' then
    select slowdown_mult, reason into v_slow, v_slow_reason
      from corridor_conditions where corridor = 'ROAD_FI';
  end if;
  if v_slow is null and v_se_corr = 'PL_EE_E67' then
    select max(slowdown_mult), string_agg(reason, '; ' order by corridor)
      into v_slow, v_slow_reason
      from corridor_conditions
     where corridor in ('ROAD_LT', 'ROAD_LV', 'ROAD_EE');
  end if;
  if v_slow is null and v_se_corr in ('SE_E4_STO', 'SE_E18_KPS') then
    select slowdown_mult, reason into v_slow, v_slow_reason
      from corridor_conditions where corridor = 'SE_E4';
  end if;
  if v_slow is null and v_is_kaa and v_se_corr is distinct from 'SE_E22' then
    select slowdown_mult, reason into v_slow, v_slow_reason
      from corridor_conditions where corridor = 'SE_E22';
  end if;
  -- Odcinek PL (PL_EE_E67): spowolnienie ROAD_* gdy jeszcze brak z post.
  if v_slow is null and v_pl_corr = 'PL_EE_E67' then
    select max(slowdown_mult), string_agg(reason, '; ' order by corridor)
      into v_slow, v_slow_reason
      from corridor_conditions
     where corridor in ('ROAD_LT', 'ROAD_LV', 'ROAD_EE');
  end if;
  v_slow := coalesce(v_slow, 1.00);
  if v_slow > 1.00 then
    v_weather_pct := round((v_slow - 1) * 100);
    v_flags := array_append(v_flags, format('spowolnienie ×%s (%s)', v_slow, coalesce(v_slow_reason, 'BN6/BN8b')));
  end if;
  h_road_eff := h_road * v_slow;
  h_se := h_road_eff + h_rest + h_brk;

  -- H-4: stan kierowcy z GPS (bez tachografu); flagi dołączamy na końcu, po fladze korytarza
  select * into st from h4_driver_state_from_gps(p_load, p_now);
  -- H-4: odpoczynek/przerwy szacowane z GPS → niepewność NIE może być 0%.
  -- Pasmo obejmuje earlier/later; przy ostrożnym większy rozrzut (Wysoka niedostępna).
  if coalesce(st.cautious, false) then
    v_h4_rest_spread := 0.25;  -- 25% × rest_h (+ dolne H4_CAUTIOUS poniżej)
  else
    v_h4_rest_spread := 0.15;  -- 15% gdy last_rest znany z GPS/prom
  end if;


  select attribution into v_attr from corridor_polylines where code = 'PL_ROAD' limit 1;
  v_attr := coalesce(v_attr, '© OpenStreetMap contributors');

  select st_centroid(geom) into g_load from geofences where project_id = l.project_id and kind = 'LOADING' and active order by sort_order limit 1;
  select st_centroid(geom) into g_pout from geofences
   where project_id = l.project_id and kind = 'PORT_OUT' and active
     and public.ferry_geofence_matches_route(route, v_load_route)
   order by sort_order limit 1;
  if g_pout is null then
    select st_centroid(geom) into g_pout from geofences
     where project_id = l.project_id and kind = 'PORT_OUT' and active
     order by sort_order limit 1;
  end if;
  select st_centroid(geom) into g_pin from geofences
   where project_id = l.project_id and kind = 'PORT_IN' and active
     and public.ferry_geofence_matches_route(route, v_load_route)
   order by sort_order limit 1;
  if g_pin is null then
    select st_centroid(geom) into g_pin from geofences
     where project_id = l.project_id and kind = 'PORT_IN' and active
     order by sort_order limit 1;
  end if;
  select st_centroid(geom) into g_site from geofences where project_id = l.project_id and kind = 'SITE' and active order by sort_order limit 1;
  v_left := v_status in ('IN_TRANSIT_PL','AT_PORT_GDANSK','FERRY','AT_PORT_NYNASHAMN','IN_TRANSIT_SE','AT_SITE','UNLOADED','DELIVERED')
    or exists (
      select 1 from load_events e
      where e.load_id = p_load
        and e.event_type = 'GEOFENCE_EXIT'
        and e.payload->>'geofence_kind' = 'LOADING'
        and coalesce((e.payload->>'synthetic')::boolean, false) is not true
        -- D-1710 F7: EXIT LOADING tylko od startu okna (opened albo 03:00 dnia planu).
        and e.occurred_at >= coalesce(
              l.tracking_opened_at,
              case when l.plan_load_date is not null
                   then public.tracking_window_start(l.plan_load_date) end,
              '-infinity'::timestamptz)
    );

  -- pozycja p pobrana wyżej (27B:C wybór korytarza SE)

  -- F7 #638: REMOVED jak CANCELLED (regresja vs 0315/0320).
  if v_status in ('CANCELLED','REMOVED') then
    return query select null::timestamptz, null::int, jsonb_build_object(
      'method','ETA v2 (OSM)','segment','CANCELLED','flags',jsonb_build_array('anulowany'),
      'attribution', v_attr, 'computed_at', p_now);
    return;
  end if;
  if v_status in ('UNLOADED','DELIVERED','READY_TO_INVOICE','INVOICED') then
    return query select coalesce(l.actual_delivery_at, p_now), 0, jsonb_build_object(
      'method','ETA v2 (OSM)','segment','DONE','flags',jsonb_build_array('rozładowany — data rozładunku'),
      'attribution', v_attr, 'computed_at', p_now);
    return;
  end if;
  if v_status = 'AT_SITE' then
    select max(occurred_at) into v_eta from load_events where load_id = p_load and payload->>'to' = 'AT_SITE';
    return query select coalesce(v_eta, p_now), 0, jsonb_build_object(
      'method','ETA v2 (OSM)','segment','AT_SITE','flags',jsonb_build_array('na placu budowy'),
      'attribution', v_attr, 'computed_at', p_now);
    return;
  end if;

  -- ETA tylko z pozycji (2026-10-04). Plan załadunku i założony rejs nie wypełniają eta_site.
  v_fresh := p.ts is not null and p.ts >= p_now - make_interval(mins => (fresh_h * 60)::int);

  if v_status = 'FERRY' then
    select vp.lat, vp.lon, vp.sog_kn, vp.observed_at
      into v_alat, v_alon, v_sog, v_obs
      from vessel_positions vp
      join sailings sa on sa.vessel_id = vp.vessel_id
     where sa.id = l.sailing_id
       and vp.observed_at >= p_now - make_interval(mins => (fresh_h * 60)::int)
     order by vp.observed_at desc
     limit 1;
    if v_obs is null or v_sog is null or v_sog <= 0 or g_pin is null then
      return query select null::timestamptz, null::int, jsonb_build_object(
        'method','ETA v2 (OSM)','segment','FERRY',
        'flags', jsonb_build_array('na promie — ETA czeka na pozycję AIS'),
        'ferry_eta','waits_for_ais','wait_ais', true, 'ferry_eta_at', null, 'plan_eta', false,
        'attribution', v_attr, 'computed_at', p_now);
      return;
    end if;
    v_sea_h := st_distance(
      st_setsrid(st_makepoint(v_alon, v_alat), 4326)::geography,
      g_pin::geography) / (v_sog * 1852.0);
    v_eta := p_now + make_interval(secs => ((v_sea_h + h_se) * 3600)::int);
    return query select v_eta, greatest(1, round(v_sea_h * 60 * 0.15))::int, jsonb_build_object(
      'method','ETA v2 (OSM)','segment','FERRY',
      'flags', jsonb_build_array('pozycja AIS promu'),
      'ferry_eta','ais','wait_ais', false,
      'ferry_eta_at', (p_now + make_interval(secs => (v_sea_h * 3600)::int)),
      'plan_eta', false, 'sailing', null,
      'attribution', v_attr, 'computed_at', p_now, 'port_route', v_op);
    return;
  end if;

  if v_status in ('AT_PORT_NYNASHAMN','IN_TRANSIT_SE') then
    if v_fresh is not true then
      return query select null::timestamptz, null::int, jsonb_build_object(
        'method','ETA v2 (OSM)','segment', v_status::text,
        'flags', jsonb_build_array('brak pozycji GPS'),
        'plan_eta', false, 'attribution', v_attr, 'computed_at', p_now);
      return;
    end if;
  else
    if (v_left) is not true then
      if v_fresh is not true then
        return query select null::timestamptz, null::int, jsonb_build_object(
          'method','ETA v2 (OSM)','segment', v_status::text,
          'flags', jsonb_build_array('brak pozycji GPS'),
          'plan_eta', false, 'pre_load', true, 'attribution', v_attr, 'computed_at', p_now);
      else
        return query select null::timestamptz, null::int, jsonb_build_object(
          'method','ETA v2 (OSM)','segment', v_status::text,
          'flags', jsonb_build_array('pre_load'),
          'plan_eta', false, 'pre_load', true, 'attribution', v_attr, 'computed_at', p_now);
      end if;
      return;
    end if;
    if v_fresh is not true then
      return query select null::timestamptz, null::int, jsonb_build_object(
        'method','ETA v2 (OSM)','segment', v_status::text,
        'flags', jsonb_build_array('brak pozycji GPS'),
        'plan_eta', false, 'pre_load', false, 'attribution', v_attr, 'computed_at', p_now);
      return;
    end if;
  end if;

  -- 2) odcinek SE
  if v_status in ('AT_PORT_NYNASHAMN','IN_TRANSIT_SE') then
    v_frac := 1;
    if v_status = 'IN_TRANSIT_SE' then
      if p.ts is not null and p.ts >= p_now - make_interval(mins => (fresh_h * 60)::int) then
        select * into cp from corridor_progress(coalesce(v_se_corr, 'SE_E4'), p.g);
        if found and cp.remaining_frac is not null then
          v_frac := cp.remaining_frac;
          v_off := cp.off_m;
          v_rem_km := cp.remaining_km;
          v_progress := 'corridor';
          v_flags := array_append(v_flags, 'pozycja GPS — postęp na korytarzu OSM'::text);
        elsif g_site is not null and g_pin is not null
           and st_distance(g_pin::geography, g_site::geography) > 0 then
          v_frac := least(1, greatest(0, st_distance(p.g::geography, g_site::geography) / st_distance(g_pin::geography, g_site::geography)));
          v_flags := array_append(v_flags, 'pozycja GPS — odległość do placu w linii prostej'::text);
        else
          v_frac := 0.5; v_var := v_var + (h_se * 60 * 0.25)^2; v_sum := v_sum + (h_se * 60 * 0.25);
          v_comp := v_comp || jsonb_build_object('code','SE_NO_GPS','min',round(h_se * 60 * 0.25));
          v_flags := array_append(v_flags, 'brak świeżej pozycji — połowa odcinka SE'::text);
        end if;
      else
        v_frac := 0.5; v_var := v_var + (h_se * 60 * 0.25)^2; v_sum := v_sum + (h_se * 60 * 0.25);
        v_comp := v_comp || jsonb_build_object('code','SE_NO_GPS','min',round(h_se * 60 * 0.25));
        v_flags := array_append(v_flags, 'brak świeżej pozycji — połowa odcinka SE'::text);
      end if;
    end if;
    -- H-4: jazda pozostała; odpoczynki/przerwy wg UE (nie proporcja do trasy)
    v_drive_need := h_road_eff * v_frac;
    select * into sch from h4_schedule_remaining(
      v_drive_need,
      coalesce(st.driven_today_h, 0),
      coalesce(st.extended_used, 0),
      coalesce(st.since_break_h, st.driven_today_h)
    );
    v_drive_h := sch.drive_h; v_rest_h := sch.rest_h; v_break_h := sch.break_h;
    v_rem := sch.total_h;
    v_eta := p_now + make_interval(secs => (v_rem * 3600)::int);
    if sch.flags is not null then v_flags := v_flags || sch.flags; end if;
    v_var := v_var + (sch.drive_h * 60 * sp_road)^2; v_sum := v_sum + (sch.drive_h * 60 * sp_road);
    -- F7 #638: v_comp.code = ten sam kod co v_segs (SE_ROAD_KAA*).
    v_comp := v_comp || jsonb_build_object('code',coalesce(v_se_road_code,'SE_ROAD'),'min',round(sch.drive_h * 60 * sp_road));
    v_var := v_var + (sch.break_h * 60 * sp_brk)^2; v_sum := v_sum + (sch.break_h * 60 * sp_brk);
    v_comp := v_comp || jsonb_build_object('code','SE_BREAKS','min',round(sch.break_h * 60 * sp_brk));
    -- H-4: niepewność odpoczynku > 0 (earlier/later); I-15 ±0% nie dotyczy rest z GPS
    v_var := v_var + (sch.rest_h * 60 * v_h4_rest_spread)^2; v_sum := v_sum + (sch.rest_h * 60 * v_h4_rest_spread);
    v_comp := v_comp || jsonb_build_object('code','H4_EU_REST','min',round(sch.rest_h * 60 * v_h4_rest_spread));
    v_segs := v_segs || jsonb_build_object('code',coalesce(v_se_road_code,'SE_ROAD'),'hours',round(sch.drive_h, 1),'spread_pct',round(sp_road * 100),'slowdown_mult',v_slow,'corridor',v_se_corr)
                     || jsonb_build_object('code','H4_EU_REST','hours',round(sch.rest_h, 1),'spread_pct',round(v_h4_rest_spread * 100))
                     || jsonb_build_object('code','H4_EU_BREAKS','hours',round(sch.break_h, 1),'spread_pct',round(sp_brk * 100))
                     || jsonb_build_object('code','H4_SEGMENTS','items',sch.segments);
    v_seg := v_status::text;
  else
    select coalesce(x.delayed_departure_at, x.departure_at) as dep, coalesce(x.delayed_arrival_at, x.arrival_at) as arr,
           x.status, x.id, (x.delayed_departure_at is not null or x.status = 'OPOZNIONY') as delayed
      into v_sail from sailings x where x.id = l.sailing_id;
    v_has := found;
    if v_has and v_sail.status = 'ODWOLANY' then
      v_flags := array_append(v_flags, 'przypisany rejs odwołany'::text); v_has := false;
    elsif v_has and v_status < 'FERRY' and v_sail.dep < p_now then
      v_flags := array_append(v_flags, 'przypisany rejs odpłynął bez transportu'::text); v_has := false;
    end if;

    if v_status = 'FERRY' then
      if v_has then
        v_arr := v_sail.arr; v_sail_src := 'przypisany';
        v_var := v_var + (30)^2; v_sum := v_sum + (30); v_comp := v_comp || jsonb_build_object('code','SAILING','min',round(30));
        if v_sail.delayed then v_var := v_var + (60)^2; v_sum := v_sum + (60); v_comp := v_comp || jsonb_build_object('code','SAILING_DELAYED','min',round(60)); end if;
      else
        v_arr := p_now + make_interval(secs => (h_cross * 0.5 * 3600)::int);
        v_var := v_var + (h_cross * 60 * 0.5)^2; v_sum := v_sum + (h_cross * 60 * 0.5);
        v_comp := v_comp || jsonb_build_object('code','FERRY_NO_SAILING','min',round(h_cross * 60 * 0.5));
        v_flags := array_append(v_flags, 'na promie bez rejsu w rozkładzie — połowa przeprawy'::text);
      end if;
      v_seg := 'FERRY';
    else
      if (v_left) is true then
        v_start := p_now;
      else
        v_start := greatest(p_now, coalesce(l.plan_load_to, l.plan_load_from, (l.plan_load_date + time '12:00') at time zone 'Europe/Warsaw', p_now));
      end if;
      v_frac := case when v_status = 'AT_PORT_GDANSK' then 0 when v_status = 'IN_TRANSIT_PL' then 0.5 else 1 end;
      if v_status = 'IN_TRANSIT_PL' then
        if p.ts is not null and p.ts >= p_now - make_interval(mins => (fresh_h * 60)::int) then
          select * into cp from corridor_progress(coalesce(v_pl_corr, 'PL_ROAD'), p.g);
          if found and cp.remaining_frac is not null then
            v_frac := cp.remaining_frac;
            v_off := cp.off_m;
            v_rem_km := cp.remaining_km;
            v_progress := 'corridor';
            v_flags := array_append(v_flags, 'pozycja GPS — postęp na korytarzu OSM'::text);
          elsif g_pout is not null and g_load is not null
             and st_distance(g_load::geography, g_pout::geography) > 0 then
            v_frac := least(1, greatest(0, st_distance(p.g::geography, g_pout::geography) / st_distance(g_load::geography, g_pout::geography)));
            v_flags := array_append(v_flags, 'pozycja GPS — odległość do portu w linii prostej'::text);
          else
            v_flags := array_append(v_flags, 'brak świeżej pozycji — połowa odcinka PL'::text);
            v_var := v_var + (h_pl * 60 * 0.25)^2; v_sum := v_sum + (h_pl * 60 * 0.25);
            v_comp := v_comp || jsonb_build_object('code','PL_NO_GPS','min',round(h_pl * 60 * 0.25));
          end if;
        else
          v_flags := array_append(v_flags, 'brak świeżej pozycji — połowa odcinka PL'::text);
          v_var := v_var + (h_pl * 60 * 0.25)^2; v_sum := v_sum + (h_pl * 60 * 0.25);
          v_comp := v_comp || jsonb_build_object('code','PL_NO_GPS','min',round(h_pl * 60 * 0.25));
        end if;
      end if;
      if v_status < 'IN_TRANSIT_PL' and v_start > p_now then v_flags := array_append(v_flags, 'przed załadunkiem — start z planu załadunku'::text); end if;
      v_drive_h := round(h_pl * v_frac, 2);
      v_checkin_h := case when v_status = 'AT_PORT_GDANSK' then 0 else h_ci end;
      v_segs := v_segs || jsonb_build_object('code','PL_ROAD','hours',round(h_pl * v_frac, 1),'spread_pct',round(sp_pl * 100));
      v_start := v_start + make_interval(secs => ((h_pl * v_frac + v_checkin_h) * 3600)::int);
      if v_has then
        v_dep := v_sail.dep; v_arr := v_sail.arr; v_sail_src := 'przypisany';
        v_var := v_var + (30)^2; v_sum := v_sum + (30); v_comp := v_comp || jsonb_build_object('code','SAILING','min',round(30));
        if v_sail.delayed then v_var := v_var + (60)^2; v_sum := v_sum + (60); v_comp := v_comp || jsonb_build_object('code','SAILING_DELAYED','min',round(60)); end if;
        if v_start > v_dep then
          v_flags := array_append(v_flags, 'rejs zagrożony — dojazd i check-in po odejściu'::text);
          v_var := v_var + (12 * 60)^2; v_sum := v_sum + (12 * 60); v_comp := v_comp || jsonb_build_object('code','SAILING_AT_RISK','min',round(12 * 60));
        end if;
      else
        -- BN8b: założony rejs tylko z rodziny transportu (null → GDN-NYN jak Ś1).
        select coalesce(x.delayed_departure_at, x.departure_at), coalesce(x.delayed_arrival_at, x.arrival_at)
          into v_dep, v_arr
          from sailings x
         where x.project_id = l.project_id
           and public.eta_obs_route_family(x.route) = v_family
           and public.ferry_route_is_outbound(x.route)
           and x.status <> 'ODWOLANY'
           and coalesce(x.delayed_departure_at, x.departure_at) >= v_start
         order by coalesce(x.delayed_departure_at, x.departure_at) limit 1;
        if v_dep is not null then
          v_sail_src := 'założony (najbliższy w rozkładzie)';
          v_flags := array_append(v_flags, 'brak przypisanego rejsu — założony najbliższy z rozkładu'::text);
          v_var := v_var + (6 * 60)^2; v_sum := v_sum + (6 * 60); v_comp := v_comp || jsonb_build_object('code','SAILING_ASSUMED','min',round(6 * 60));
        else
          v_dep := v_start; v_arr := v_start + make_interval(secs => (h_cross * 3600)::int);
          v_flags := array_append(v_flags, 'brak rejsu w rozkładzie — przeprawa z założenia'::text);
          v_var := v_var + (12 * 60)^2; v_sum := v_sum + (12 * 60); v_comp := v_comp || jsonb_build_object('code','NO_SCHEDULE','min',round(12 * 60));
          v_var := v_var + (h_cross * 60 * sp_cross)^2; v_sum := v_sum + (h_cross * 60 * sp_cross);
          v_comp := v_comp || jsonb_build_object('code','CROSSING','min',round(h_cross * 60 * sp_cross));
        end if;
      end if;
      v_seg := v_status::text;
    end if;
    v_segs := v_segs || jsonb_build_object('code','CROSSING','departure',v_dep,'arrival',v_arr,'source',coalesce(v_sail_src,'założenie'));
    -- H-4 po promie: zegar od zera (D-9 odpoczynek na promie)
    select * into sch from h4_schedule_remaining(h_road_eff, 0, 0, 0);
    v_drive_h := coalesce(v_drive_h, 0) + sch.drive_h;
    v_rest_h := coalesce(v_rest_h, 0) + sch.rest_h;
    v_break_h := coalesce(v_break_h, 0) + sch.break_h;
    v_eta := v_arr + make_interval(secs => (sch.total_h * 3600)::int);
    v_flags := array_append(v_flags, 'H-4 po promie — odpoczynek D-9, zegar od zera'::text);
    if sch.flags is not null then v_flags := v_flags || sch.flags; end if;
    v_segs := v_segs || jsonb_build_object('code',coalesce(v_se_road_code,'SE_ROAD'),'hours',round(sch.drive_h, 1),'spread_pct',round(sp_road * 100),'slowdown_mult',v_slow,'corridor',v_se_corr)
                     || jsonb_build_object('code','H4_EU_REST','hours',round(sch.rest_h, 1),'spread_pct',round(v_h4_rest_spread * 100))
                     || jsonb_build_object('code','H4_EU_BREAKS','hours',round(sch.break_h, 1),'spread_pct',round(sp_brk * 100))
                     || jsonb_build_object('code','H4_SEGMENTS','items',sch.segments);
    v_var := v_var + (sch.drive_h * 60 * sp_road)^2; v_sum := v_sum + (sch.drive_h * 60 * sp_road);
    -- F7 #638: v_comp.code = ten sam kod co v_segs (SE_ROAD_KAA*).
    v_comp := v_comp || jsonb_build_object('code',coalesce(v_se_road_code,'SE_ROAD'),'min',round(sch.drive_h * 60 * sp_road));
    v_var := v_var + (sch.break_h * 60 * sp_brk)^2; v_sum := v_sum + (sch.break_h * 60 * sp_brk);
    v_comp := v_comp || jsonb_build_object('code','SE_BREAKS','min',round(sch.break_h * 60 * sp_brk));
    v_var := v_var + (sch.rest_h * 60 * v_h4_rest_spread)^2; v_sum := v_sum + (sch.rest_h * 60 * v_h4_rest_spread);
    v_comp := v_comp || jsonb_build_object('code','H4_EU_REST','min',round(sch.rest_h * 60 * v_h4_rest_spread));
    if v_status < 'FERRY' then
      v_var := v_var + (h_pl * 60 * sp_pl)^2; v_sum := v_sum + (h_pl * 60 * sp_pl);
      v_comp := v_comp || jsonb_build_object('code','PL_ROAD','min',round(h_pl * 60 * sp_pl));
    end if;
  end if;

  if st.flags is not null then
    v_flags := v_flags || st.flags;
  end if;
  if coalesce(st.cautious, false) then
    v_flags := array_append(v_flags, 'H-4 założenie ostrożne — czas pracy bez pełnej historii GPS'::text);
    -- „Wysoka” niedostępna przy braku historii odpoczynku (rozrzut > 60 min)
    v_var := v_var + (61)^2; v_sum := v_sum + 61;
    v_comp := v_comp || jsonb_build_object('code','H4_CAUTIOUS','min',61);
  end if;

  v_causes := jsonb_build_object(
    'drive_h', v_drive_h,
    'checkin_h', v_checkin_h,
    'rest_h', v_rest_h,
    'breaks_h', v_break_h,
    'weather_slowdown_pct', v_weather_pct,
    'progress', v_progress,
    'remaining_km', v_rem_km,
    'off_corridor_m', v_off,
    'se_corridor', v_se_corr,
    'se_road_code', v_se_road_code,
    'h4', true,
    'h4_source', coalesce(st.source, 'n/a'),
    'h4_cautious', coalesce(st.cautious, false),
    'tachograph', 'none'
  );

  return query select v_eta, round(sqrt(v_var))::int, jsonb_build_object(
    'method', 'ETA v2 (OSM)', 'segment', v_seg, 'segments', v_segs,
    'band', jsonb_build_object('method', 'RSS', 'min', round(sqrt(v_var)), 'linear_sum_min', round(v_sum),
                               'components', (select coalesce(jsonb_agg(c), '[]'::jsonb) from jsonb_array_elements(v_comp) c where (c->>'min')::numeric > 0)),
    'flags', to_jsonb(v_flags), 'sailing', v_sail_src,
    'attribution', v_attr, 'causes', v_causes, 'computed_at', p_now);
end $function$;

-- ---------------------------------------------------------------------------
-- refresh_load_eta (ciało z 0382 + BN8b OFF_CORRIDOR)
-- ---------------------------------------------------------------------------
create or replace function public.refresh_load_eta(p_load uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  r record;
  l record;
  v_end timestamptz;
  v_delay int;
  v_has boolean;
  v_kind risk_kind;
  v_off numeric;
  v_max_off numeric := null;
  v_span numeric := 0;
  v_samples int := 0;
  v_blocked boolean := false;
  v_corr text;
  v_eta_ok boolean;
  v_op text;
  v_route text;
  v_stena_dual boolean := false;
  v_bn7 boolean := false;
  v_bn7_no_here boolean := false;
  v_here_fresh boolean := false;
begin
  select * into r from compute_load_eta(p_load);
  select * into l from loads where id = p_load;
  if not found then return; end if;

  select load_delivery_deadline(l.plan_delivery_date, l.plan_delivery_to) into v_end;
  v_delay := case when r.eta is null or v_end is null then null
                  else greatest(0, round(extract(epoch from (r.eta - v_end)) / 60))::int end;

  perform set_config('tower.eta_ctx', 'on', true);
  update loads set eta_site = r.eta, eta_confidence_min = r.conf_min, eta_basis = r.basis, eta_computed_at = now(),
         delay_minutes = v_delay
   where id = p_load
     and (eta_site is distinct from r.eta or eta_confidence_min is distinct from r.conf_min
          or (eta_basis - 'computed_at') is distinct from (r.basis - 'computed_at')
          or delay_minutes is distinct from v_delay);
  perform set_config('tower.eta_ctx', '', true);

  v_has := exists (select 1 from positions p where p.load_id = p_load)
    or l.status in (
      'READY','AT_LOADING','IN_TRANSIT_PL','AT_PORT_GDANSK',
      'FERRY','AT_PORT_NYNASHAMN','IN_TRANSIT_SE','AT_SITE'
    );
  -- #590: wyklucz CANCELLED i REMOVED (strażnik import.sh; 0315 przepisało 0298 — nie zgub przy replace)
  v_eta_ok := l3_eta_alarm(r.eta, v_end, v_has)
    and l.actual_delivery_at is null
    and l.status::text not in ('CANCELLED', 'REMOVED')
    and public.load_status_rank(l.status) < public.load_status_rank('AT_SITE'::public.load_status);

  if v_eta_ok then
    perform l3_upsert_alarm(l.project_id, p_load, 'ETA_BREACH', 'ETA_BREACH:' || p_load,
      format('Opóźnienie %s min wobec planu dostawy (próg %s)', v_delay, l3_ops('DELAY_MIN')),
      'rk_eta_breach', true, true, now() + interval '2 hours',
      jsonb_build_object('params', jsonb_build_object('minutes', v_delay, 'threshold', l3_ops('DELAY_MIN'))),
      now());
  else
    perform l3_upsert_alarm(l.project_id, p_load, 'ETA_BREACH', 'ETA_BREACH:' || p_load,
      'ETA', 'rk_eta_breach', false, false, null, '{}'::jsonb, now());
    update risk_signals set resolved_at = now()
     where load_id = p_load and kind = 'ETA_BREACH' and resolved_at is null
       and dedup_key = 'ETA_BREACH:' || p_load and coalesce(detail->>'l3', '') <> '1';
  end if;

  v_blocked := l.status = 'FERRY' or l.status not in ('IN_TRANSIT_PL', 'IN_TRANSIT_SE');
  v_op := null;
  v_route := null;
  v_route := public.load_route_family(p_load);
  v_op := public.eta_obs_operator_key(v_route);

  -- BN8a: korytarz z ferry_routes.road_corridor_* → here_road_legs.corridor_code;
  -- brak kodu = brak alarmu (v_blocked). Regresja PL/SE: corridor_code legów core.
  if l.status = 'IN_TRANSIT_SE' then
    v_kind := 'ROAD_SE'::risk_kind;
    select h.corridor_code into v_corr
      from public.ferry_routes fr
      join public.here_road_legs h on h.leg = fr.road_corridor_post
     where fr.active
       and fr.family_key = public.eta_obs_route_family(v_route)
       and public.ferry_route_is_outbound(fr.code)
     order by fr.code
     limit 1;
    if v_corr is null and v_route is not null then
      select h.corridor_code into v_corr
        from public.ferry_routes fr
        join public.here_road_legs h on h.leg = fr.road_corridor_post
       where fr.active and fr.code = upper(btrim(v_route))
       limit 1;
    end if;
    if v_corr in ('SE_E22', 'SE_KAA_INLAND') or v_op = 'STENA' then
      v_stena_dual := true;
      v_corr := coalesce(nullif(v_corr, 'SE_KAA_INLAND'), 'SE_E22');
    end if;
  elsif l.status = 'IN_TRANSIT_PL' then
    v_kind := 'ROAD_PL'::risk_kind;
    select h.corridor_code into v_corr
      from public.ferry_routes fr
      join public.here_road_legs h on h.leg = fr.road_corridor_pre
     where fr.active
       and fr.family_key = public.eta_obs_route_family(v_route)
       and public.ferry_route_is_outbound(fr.code)
     order by fr.code
     limit 1;
    if v_corr is null and v_route is not null then
      select h.corridor_code into v_corr
        from public.ferry_routes fr
        join public.here_road_legs h on h.leg = fr.road_corridor_pre
       where fr.active and fr.code = upper(btrim(v_route))
       limit 1;
    end if;
  else
    v_kind := 'ROAD_PL'::risk_kind;
    v_corr := null;
  end if;

  -- W1/F7 r4: bez trasy — PL_ROAD tylko gdy oba ostatnie punkty (jak corridor_progress)
  -- leżą w prostokącie PL; wcześniejszy wyjazd z PL nie wystarcza (Bałtyk bez rejsu).
  -- SE bez trasy → null (0339: brak v_op ⇒ brak v_corr; nie SE_E4 na Stena/FI).
  if v_corr is null and v_route is null and l.status = 'IN_TRANSIT_PL' then
    select case
             when count(*) >= 1
              and bool_and(
                    st_x(s.g::geometry) between 14.0 and 24.2
                    and st_y(s.g::geometry) between 49.0 and 54.45
                  )
             then 'PL_ROAD'
           end
      into v_corr
      from (
        select coalesce(geom_snapped, geom_raw) as g
          from public.positions
         where load_id = p_load
         order by ts desc
         limit 2
      ) s;
  end if;

  -- BN8b/#720 §7: kody BN7 tylko przy świeżej geometrii HERE (≤7 dni, ≥2 pkt).
  -- Brak/stara → bez alarmu + eta_basis.corridor_geom=brak. PL_ROAD/SE_E4/Stena dual bez zmian.
  v_bn7 := v_corr in ('PL_EE_E67', 'FI_E75', 'SE_E4_STO', 'SE_E18_KPS');
  v_bn7_no_here := false;
  if v_bn7 and v_blocked is not true then
    v_here_fresh := public.bn8b_here_corridor_fresh(v_corr);
    if v_here_fresh is not true then
      v_bn7_no_here := true;
      v_blocked := true;
      v_samples := 0;
      v_max_off := 0;
      v_span := 0;
      perform set_config('tower.eta_ctx', 'on', true);
      update loads
         set eta_basis = coalesce(eta_basis, '{}'::jsonb)
                        || jsonb_build_object('corridor_geom', 'brak')
       where id = p_load;
      perform set_config('tower.eta_ctx', '', true);
    else
      perform public.bn8b_sync_corridor_polyline_from_here(v_corr);
    end if;
  end if;

  if v_bn7_no_here then
    null; -- już zablokowane: bez pomiaru na przybliżeniu OSM z 0381
  elsif v_stena_dual is not true
     and (v_corr is null
          or not exists (
            select 1 from corridor_polylines cp
             where cp.code = v_corr and coalesce(cp.total_km, 0) > 0
          )) then
    v_blocked := true;
    v_samples := 0;
    v_max_off := 0;
    v_span := 0;
  elsif v_stena_dual is true
        and not exists (
          select 1 from corridor_polylines cp
           where cp.code = 'SE_E22' and coalesce(cp.total_km, 0) > 0
        )
        and not exists (
          select 1 from corridor_polylines cp
           where cp.code = public.stena_se_inland_corridor_code()
             and coalesce(cp.total_km, 0) > 0
        ) then
    v_blocked := true;
    v_samples := 0;
    v_max_off := 0;
    v_span := 0;
  else
    if v_stena_dual is true then
      select count(*)::int,
             max(n.off_m),
             min(n.off_m),
             coalesce(extract(epoch from (max(s.ts) - min(s.ts))) / 60.0, 0),
             coalesce(bool_or(l3_in_port_or_yard(s.g)), false),
             (array_agg(n.corridor_code order by s.ts desc))[1]
        into v_samples, v_max_off, v_off, v_span, v_has, v_corr
        from (
          select ts, coalesce(geom_snapped, geom_raw) as g
            from positions
           where load_id = p_load
           order by ts desc
           limit 2
        ) s
        cross join lateral stena_se_corridor_nearest(s.g) n;
    else
      -- OFFROUTE_KM 2 km, ostatnie 2 punkty; MUU/PLD bufor 2 km (terminal poza końcem PL_EE_E67).
      select count(*)::int,
             max(cp.off_m),
             min(cp.off_m),
             coalesce(extract(epoch from (max(s.ts) - min(s.ts))) / 60.0, 0),
             coalesce(bool_or(
               l3_in_port_or_yard(s.g)
               or public.bn8b_near_muu_pld_terminal(s.g)
             ), false)
        into v_samples, v_max_off, v_off, v_span, v_has
        from (
          select ts, coalesce(geom_snapped, geom_raw) as g
            from positions
           where load_id = p_load
           order by ts desc
           limit 2
        ) s
        cross join lateral corridor_progress(v_corr, s.g) cp;
    end if;
    if coalesce(v_off, 0) <= l3_ops('OFFROUTE_KM') * 1000 then
      v_max_off := 0;
    end if;
    v_blocked := v_blocked or coalesce(v_has, false);
  end if;

  if l3_deviation_alarm(v_max_off, v_samples, v_span, v_blocked) then
    perform l3_upsert_alarm(l.project_id, p_load, v_kind, 'OFF_CORRIDOR:' || p_load,
      format('Zjazd z trasy z zezwolenia: %s m od korytarza OSM (próg %s m)', round(v_max_off), l3_ops('OFFROUTE_KM') * 1000),
      'rk_off_corridor', true, true, now() + interval '1 hour',
      jsonb_build_object('params', jsonb_build_object(
        'meters', round(v_max_off), 'threshold', l3_ops('OFFROUTE_KM') * 1000, 'corridor', v_corr)),
      now());
  else
    update risk_signals set resolved_at = now()
     where load_id = p_load and resolved_at is null and dedup_key = 'OFF_CORRIDOR:' || p_load;
    perform l3_lapse('OFF_CORRIDOR:' || p_load, now());
  end if;
end $$;


revoke all on function public.compute_load_eta(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.compute_load_eta(uuid, timestamptz) to service_role;
comment on function public.compute_load_eta(uuid, timestamptz) is
  'BN8b/#720: load_route_family; PORT_CHECKIN per port; korytarze road_corridor_*→corridor_code; corridor_conditions BN6/BN7.';

revoke all on function public.refresh_load_eta(uuid) from public, anon, authenticated;
grant execute on function public.refresh_load_eta(uuid) to service_role;
comment on function public.refresh_load_eta(uuid) is
  'BN8b/#720: OFF_CORRIDOR BN7 tylko przy świeżej HERE; PL_ROAD/SE_E4/Stena dual; MUU/PLD bufor 2 km; brak HERE→corridor_geom=brak.';

revoke all on function public.promote_ferry_departures(timestamptz) from public, anon, authenticated;
grant execute on function public.promote_ferry_departures(timestamptz) to service_role;
comment on function public.promote_ferry_departures(timestamptz) is
  'BN8b: FERRY po AIS / plan+assume_dep_min (parametr trasy, nie sztywne +1 h); outbound ze słownika.';

commit;
