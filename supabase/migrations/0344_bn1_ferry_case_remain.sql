-- BN1 (#640/#648): pozostałe CASE → słownik (po 0339).
-- apply_ferry_se_from_position (0298), sailing_mismatch_propose/assign (0307).
-- a10_try_ferry_backup (0279) — bez CASE trasy (F7 wskazywał apply_geofence_status, już w 0339).
-- Regresja Stena/Polferries bez zmian zachowania.

begin;

-- ---------------------------------------------------------------------------
-- 1) apply_ferry_se_from_position — operator + PORT_IN ze słownika / rodziny
-- ---------------------------------------------------------------------------
create or replace function public.apply_ferry_se_from_position(
  p_load_id uuid,
  p_lat double precision,
  p_lon double precision,
  p_ts timestamptz
) returns void
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_status     load_status;
  v_project    uuid;
  v_op         text;
  v_pt         geometry(Point, 4326);
  v_port       record;
  v_in_port    boolean := false;
  v_port_m     double precision;
  v_on_land_se boolean := false;
  v_arr_at     timestamptz;
  v_arr_src    text;
  v_dep_at     timestamptz;
  v_plan_arr   timestamptz;
  v_plan_dep   timestamptz;
  v_voyage     interval;
  v_prev       text;
  v_detail     jsonb;
  v_route      text;
begin
  if p_lat is null or p_lon is null then
    return;
  end if;

  select l.status, l.project_id into v_status, v_project
    from loads l where l.id = p_load_id;
  if v_status is null or v_status not in ('FERRY', 'AT_PORT_NYNASHAMN') then
    return;
  end if;

  v_op := null;
  v_route := null;
  select s.route,
         s.actual_arrival_at,
         coalesce(s.actual_departure_at, s.delayed_departure_at, s.departure_at),
         coalesce(s.delayed_arrival_at, s.arrival_at),
         coalesce(s.delayed_departure_at, s.departure_at)
    into v_route, v_arr_at, v_dep_at, v_plan_arr, v_plan_dep
    from loads l
    left join sailings s on s.id = l.sailing_id
   where l.id = p_load_id;

  -- BN1: nieznana / nieaktywna trasa → bez zmiany (jak #496 else return; F7 #649).
  if v_route is not null
     and not exists (
       select 1 from public.ferry_routes fr
        where fr.code = upper(btrim(v_route)) and fr.active
     ) then
    return;
  end if;
  -- Przyjazd poza SE (np. TLL-HEL → FI): bez Port SE / Droga SE.
  if v_route is not null
     and not exists (
       select 1
         from public.ferry_routes fr
         join public.ferry_ports pt on pt.code = fr.port_to
        where fr.family_key = public.eta_obs_route_family(v_route)
          and fr.active
          and pt.country = 'SE'
     ) then
    return;
  end if;

  v_op := coalesce(public.eta_obs_operator_key(v_route), 'POLFERRIES');

  if v_arr_at is not null then
    v_arr_src := 'actual';
  elsif v_dep_at is not null and v_plan_arr is not null and v_plan_dep is not null then
    v_voyage := v_plan_arr - v_plan_dep;
    if (v_voyage > interval '0') is not true then
      v_voyage := interval '10 hours';
    end if;
    v_arr_at := v_dep_at + v_voyage;
    v_arr_src := 'plan';
  else
    v_arr_at := v_plan_arr;
    v_arr_src := 'plan';
  end if;

  if (v_arr_at is not null and p_ts >= v_arr_at) is not true then
    return;
  end if;

  v_pt := st_setsrid(st_makepoint(p_lon, p_lat), 4326);
  v_on_land_se := st_covers(public.sweden_land_geom(), v_pt);

  -- BN1: dopasowanie PORT_IN po rodzinie trasy (model A bałtyk / B armator PL).
  select g.id, g.name, g.geom
    into v_port
    from geofences g
   where g.project_id = v_project
     and g.active
     and g.kind = 'PORT_IN'
     and g.country = 'SE'
     and public.ferry_geofence_matches_route(g.route, v_route)
   order by st_distance(g.geom::geography, v_pt::geography)
   limit 1;

  if v_port.id is null then
    return;
  end if;

  v_in_port := st_contains(v_port.geom, v_pt);
  v_port_m := st_distance(v_port.geom::geography, v_pt::geography);

  v_detail := jsonb_build_object(
    'geofence_id', v_port.id,
    'geofence_name', v_port.name,
    'geofence_kind', 'PORT_IN',
    'source', 'GPS',
    'zdarzenie', 'POSITION'
  );

  if v_in_port then
    if v_status = 'FERRY' then
      perform public.auto_set_status(
        p_load_id, v_status, 'AT_PORT_NYNASHAMN',
        format('pozycja w strefie portu SE (%s)', coalesce(v_port.name, v_op)),
        p_ts,
        v_detail
      );
    end if;
    return;
  end if;

  if v_on_land_se is not true then
    return;
  end if;
  if (v_port_m >= 2000) is not true then
    return;
  end if;

  if v_status = 'FERRY' then
    v_prev := current_setting('tower.bulk_quiet', true);
    perform set_config('tower.bulk_quiet', 'on', true);
    perform public.auto_set_status(
      p_load_id, 'FERRY', 'AT_PORT_NYNASHAMN',
      'pozycja na trasie SE po promie — uzupełniony Port SE',
      least(coalesce(v_arr_at, p_ts), p_ts),
      v_detail || jsonb_build_object(
        'synthetic', true,
        'synthetic_port_se', true,
        'powod', 'pozycja na trasie SE po promie',
        'arr_source', coalesce(v_arr_src, 'plan')
      )
    );
    perform set_config('tower.bulk_quiet', coalesce(v_prev, ''), true);
    select status into v_status from loads where id = p_load_id;
  end if;

  if v_status = 'AT_PORT_NYNASHAMN' then
    perform public.auto_set_status(
      p_load_id, 'AT_PORT_NYNASHAMN', 'IN_TRANSIT_SE',
      'pozycja na trasie SE po promie',
      p_ts,
      v_detail || jsonb_build_object('powod', 'pozycja na trasie SE po promie')
    );
  end if;
end $function$;

revoke all on function public.apply_ferry_se_from_position(uuid, double precision, double precision, timestamptz)
  from public, anon, authenticated;
grant execute on function public.apply_ferry_se_from_position(uuid, double precision, double precision, timestamptz)
  to service_role;
comment on function public.apply_ferry_se_from_position(uuid, double precision, double precision, timestamptz) is
  'BN1: Port SE / Droga SE; operator+PORT_IN ze słownika; przyjazd SE po rodzinie.';

-- ---------------------------------------------------------------------------
-- 2) sailing_mismatch_propose_id — outbound + rodzina ze słownika
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
  v_first_se timestamptz;
  v_prop    uuid;
begin
  select l.project_id, s.route
    into v_project, v_route
    from public.loads l
    left join public.sailings s on s.id = l.sailing_id
   where l.id = p_load_id;
  if v_project is null then
    return null;
  end if;

  select min(p.ts) into v_first_se
    from public.positions p
   where p.load_id = p_load_id
     and coalesce((p.raw->>'stale_point')::boolean, false) is not true
     and st_covers(public.sweden_land_geom(), p.geom_raw::geometry);

  if v_first_se is null then
    return null;
  end if;

  -- Ostatni punkt w PL (bbox lądu ≤54.45°N albo PORT_OUT/LOADING — bez PRE_PORT/zatoki).
  select max(p.ts) into v_last_pl
    from public.positions p
   where p.load_id = p_load_id
     and p.ts < v_first_se
     and coalesce((p.raw->>'stale_point')::boolean, false) is not true
     and (
       (st_x(p.geom_raw::geometry) between 14.0 and 24.2
        and st_y(p.geom_raw::geometry) between 49.0 and 54.45)
       or exists (
         select 1 from public.geofences g
          where g.project_id = v_project
            and g.country = 'PL'
            and g.kind in ('PORT_OUT', 'LOADING')
            and st_covers(g.geom, p.geom_raw::geometry)
       )
     );

  -- BN1: outbound ze słownika (PL→SE/FI); przy braku rejsu ładunku — tylko z PL
  -- (jak dawniej GDN-NYN/GDY-KAA, bez Tallink).
  select s.id into v_prop
    from public.sailings s
   where s.project_id = v_project
     and s.status is distinct from 'ODWOLANY'
     and s.actual_departure_at is not null
     and public.ferry_route_is_outbound(s.route)
     and exists (
       select 1
         from public.ferry_routes fr
         join public.ferry_ports pf on pf.code = fr.port_from
        where fr.code = upper(btrim(s.route))
          and fr.active
          and pf.country = 'PL'
     )
     and (v_route is null
          or public.eta_obs_route_family(s.route)
             = public.eta_obs_route_family(v_route))
     and (v_last_pl is null or s.actual_departure_at >= v_last_pl)
     and s.actual_departure_at <= v_first_se
     and (s.actual_arrival_at is null or s.actual_arrival_at <= v_first_se)
   order by s.actual_departure_at desc, s.id
   limit 1;

  return v_prop;
end $function$;

revoke all on function public.sailing_mismatch_propose_id(uuid)
  from public, anon, authenticated;
grant execute on function public.sailing_mismatch_propose_id(uuid) to service_role;
comment on function public.sailing_mismatch_propose_id(uuid) is
  'BN1: rejs outbound PL→SE ze słownika w oknie PL→SE; bez ODWOLANY.';

-- ---------------------------------------------------------------------------
-- 3) sailing_mismatch_assign — outbound ze słownika (nie tylko GDN-NYN/GDY-KAA)
-- ---------------------------------------------------------------------------
create or replace function public.sailing_mismatch_assign(p_load_id uuid, p_sailing_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_old uuid;
  v_actor uuid;
  v_role public.user_role;
  v_status load_status;
  v_route text;
  v_sail_status text;
  v_dep_eff timestamptz;
  v_actual_dep timestamptz;
  v_plan_dep timestamptz;
  v_ferry_src text;
  v_lat double precision;
  v_lon double precision;
  v_pts timestamptz;
  v_prev text;
begin
  perform public.assert_not_preview();
  select id, role into v_actor, v_role
    from public.app_users
   where auth_id = auth.uid() and active;
  if (v_actor is not null and v_role = 'HHL_ADMIN' and public.mfa_satisfied(v_role) is true) is not true then
    raise exception 'Tylko Administrator HHL z 2FA' using errcode = '42501';
  end if;
  if p_load_id is null or p_sailing_id is null then
    raise exception 'load i sailing wymagane';
  end if;

  select sailing_id, status into v_old, v_status
    from public.loads where id = p_load_id for update;
  if not found then
    raise exception 'Nieznany ładunek';
  end if;

  select s.route, s.status::text,
         s.actual_departure_at,
         coalesce(s.delayed_departure_at, s.departure_at),
         coalesce(s.actual_departure_at, s.delayed_departure_at, s.departure_at)
    into v_route, v_sail_status, v_actual_dep, v_plan_dep, v_dep_eff
    from public.sailings s
   where s.id = p_sailing_id
     and s.project_id = (select project_id from public.loads where id = p_load_id);
  if not found then
    raise exception 'Rejs spoza projektu';
  end if;
  if v_sail_status = 'ODWOLANY' then
    raise exception 'Rejs odwołany';
  end if;
  -- BN1 F7: tylko wyjazd z portem wyjścia w PL (jak propose_id; bałtyckie w BN8).
  if (
    public.ferry_route_is_outbound(v_route) is true
    and exists (
      select 1
        from public.ferry_routes fr
        join public.ferry_ports pf on pf.code = fr.port_from
       where fr.code = upper(btrim(v_route))
         and fr.active
         and pf.country = 'PL'
    )
  ) is not true then
    raise exception 'Tylko trasa wyjazdowa z portem w PL (słownik ferry_routes)';
  end if;

  update public.loads
     set sailing_id = p_sailing_id, updated_at = now()
   where id = p_load_id;

  insert into public.load_events (load_id, event_type, occurred_at, actor_id, payload)
  values (
    p_load_id, 'SAILING_ASSIGNED', now(), v_actor,
    jsonb_build_object(
      'sailing_id', p_sailing_id,
      'from_sailing_id', v_old,
      'powod', 'przypięcie rejsu (korekta mismatch #557)',
      'source', 'SAILING_MISMATCH_ASSIGN'
    )
  );

  -- Trigger ustawia resolved_by; tu uzupełnienie gdy trigger nie złapał.
  update public.risk_signals
     set resolved_at = coalesce(resolved_at, now()),
         resolved_by = coalesce(resolved_by, v_actor)
   where load_id = p_load_id
     and dedup_key like 'SAILING_MISMATCH:' || p_load_id::text || '%'
     and (resolved_at is null or resolved_by is null);

  insert into public.audit_log (user_id, action, entity, entity_id, old_value, new_value)
  values (
    v_actor, 'SAILING_MISMATCH_ASSIGN', 'loads', p_load_id::text,
    jsonb_build_object('sailing_id', v_old),
    jsonb_build_object('sailing_id', p_sailing_id)
  );

  -- F7 r3: IN_TRANSIT_PL/AT_PORT_GDANSK + odejście ≤ now → FERRY quiet.
  select status into v_status from public.loads where id = p_load_id;
  if v_status in ('IN_TRANSIT_PL', 'AT_PORT_GDANSK')
     and v_dep_eff is not null
     and v_dep_eff <= now() then
    if v_actual_dep is not null and v_actual_dep <= now() then
      v_ferry_src := 'AIS';
    elsif v_plan_dep is not null and v_plan_dep <= now() then
      v_ferry_src := 'SCHEDULE';
    else
      v_ferry_src := null;
    end if;
    if v_ferry_src is not null then
      begin
        v_prev := current_setting('tower.bulk_quiet', true);
        perform set_config('tower.bulk_quiet', 'on', true);
        perform public.auto_set_status(
          p_load_id, v_status, 'FERRY',
          'przypięcie rejsu — ' || v_ferry_src,
          v_dep_eff,
          jsonb_build_object(
            'source', v_ferry_src,
            'sailing_id', p_sailing_id,
            'powod', 'SAILING_MISMATCH_ASSIGN'
          )
        );
        perform set_config('tower.bulk_quiet', coalesce(v_prev, ''), true);
      exception when others then
        perform set_config('tower.bulk_quiet', coalesce(v_prev, ''), true);
        raise warning '#557 assign auto FERRY: %', sqlerrm;
      end;
    end if;
  else
    begin
      perform public.a10_try_ferry_backup(p_load_id, now());
    exception when others then
      raise warning '#557 assign ferry_backup: %', sqlerrm;
    end;
  end if;

  select st_y(p.geom_raw::geometry), st_x(p.geom_raw::geometry), p.ts
    into v_lat, v_lon, v_pts
    from public.positions p
   where p.load_id = p_load_id
     and coalesce((p.raw->>'stale_point')::boolean, false) is not true
     and st_covers(public.sweden_land_geom(), p.geom_raw::geometry)
   order by p.ts desc
   limit 1;

  if v_lat is not null then
    begin
      perform public.apply_ferry_ais_arrival_backup(p_load_id, v_lat, v_lon, v_pts);
      perform public.apply_ferry_se_from_position(p_load_id, v_lat, v_lon, v_pts);
    exception when others then
      raise warning '#557 assign SE rule: %', sqlerrm;
    end;
  end if;

  return jsonb_build_object(
    'ok', true,
    'from_sailing_id', v_old,
    'to_sailing_id', p_sailing_id
  );
end $function$;

revoke all on function public.sailing_mismatch_assign(uuid, uuid) from public, anon;
grant execute on function public.sailing_mismatch_assign(uuid, uuid) to authenticated;
comment on function public.sailing_mismatch_assign(uuid, uuid) is
  'BN1: HHL_ADMIN+2FA; outbound PL→SE ze słownika; FERRY quiet + SE; audit.';

commit;
