-- #461 / D-20261022-2045-01: status „Prom” dopiero przy actual_departure_at (AIS), nie z rozkładu.
-- promote_ferry_departures: kandydat tylko po AIS; MISSED względem actual; source AIS.
-- a10_try_ferry_backup (c): tylko po actual_departure_at; (b) z #445 bez zmian.
-- 2 h bez actual po planie → sprawa HHL NO_DEPARTURE:<sailing_id>.

create or replace function public.promote_ferry_departures(p_now timestamp with time zone default now())
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  r record;
  v_inside boolean;
  v_op text;
  n int := 0;
begin
  /* Odwołany rejs — jak dotąd, względem planu (nie AIS). */
  for r in
    select l.id as load_id, l.project_id, l.status, s.id as sailing_id,
           s.route as sailing_route, v.name as vessel,
           coalesce(s.delayed_departure_at, s.departure_at) as plan_dep
      from loads l
      join sailings s on s.id = l.sailing_id and s.route in ('GDN-NYN', 'GDY-KAA')
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

  /* Brak potwierdzenia AIS 2 h po planowym odejściu — status zostaje Port PL. */
  for r in
    select distinct on (s.id)
           l.id as load_id, s.id as sailing_id, v.name as vessel,
           coalesce(s.delayed_departure_at, s.departure_at) as plan_dep
      from sailings s
      join vessels v on v.id = s.vessel_id
      join loads l on l.sailing_id = s.id
     where s.route in ('GDN-NYN', 'GDY-KAA')
       and s.status is distinct from 'ODWOLANY'
       and s.actual_departure_at is null
       and coalesce(s.delayed_departure_at, s.departure_at) <= p_now - interval '2 hours'
       and l.status in ('PLANNED','RESOURCES_PENDING','DOCS_PENDING','READY',
                        'AT_LOADING','IN_TRANSIT_PL','AT_PORT_GDANSK')
     order by s.id,
              case when l.status = 'AT_PORT_GDANSK' then 0 else 1 end,
              l.id
  loop
    perform raise_risk(r.load_id, 'FERRY', 'HIGH',
      format('Brak potwierdzenia wypłynięcia rejsu %s %s', r.vessel,
             to_char(r.plan_dep at time zone 'Europe/Warsaw', 'DD.MM HH24:MI')),
      jsonb_build_object(
        'sailing_id', r.sailing_id,
        'title_key', 'rk_no_departure',
        'params', jsonb_build_object(
          'vessel', r.vessel,
          'dep', to_char(r.plan_dep at time zone 'Europe/Warsaw', 'DD.MM HH24:MI'))),
      'NO_DEPARTURE:' || r.sailing_id);
  end loop;

  /* Status Prom — tylko po faktycznym wypłynięciu (AIS). */
  for r in
    select l.id as load_id, l.project_id, l.status, s.id as sailing_id,
           s.status as sailing_status, s.route as sailing_route, v.name as vessel,
           s.actual_departure_at as dep
      from loads l
      join sailings s on s.id = l.sailing_id and s.route in ('GDN-NYN', 'GDY-KAA')
      join vessels  v on v.id = s.vessel_id
     where s.actual_departure_at is not null
       and s.actual_departure_at <= p_now
       and s.status is distinct from 'ODWOLANY'
       and l.status in ('PLANNED','RESOURCES_PENDING','DOCS_PENDING','READY',
                        'AT_LOADING','IN_TRANSIT_PL','AT_PORT_GDANSK')
  loop
    v_op := case when r.sailing_route in ('GDY-KAA', 'KAA-GDY') then 'STENA' else 'POLFERRIES' end;

    select exists (
      select 1 from geofence_states gs
        join geofences g on g.id = gs.geofence_id
       where gs.load_id = r.load_id and g.project_id = r.project_id
         and g.kind = 'PORT_OUT' and g.active
         and coalesce(g.route, 'POLFERRIES') = v_op
         and gs.entered_at is not null and gs.entered_at <= r.dep
         and (gs.state in ('INSIDE','PENDING_OUT')
              or (gs.exited_at is not null and gs.exited_at >= r.dep))
    ) into v_inside;

    if r.status = 'AT_PORT_GDANSK' and v_inside then
      if auto_set_status(r.load_id, 'AT_PORT_GDANSK', 'FERRY', 'wypłynięcie rejsu (AIS)', r.dep,
           jsonb_build_object('sailing_id', r.sailing_id, 'statek', r.vessel, 'odejscie', r.dep,
                              'route', r.sailing_route, 'operator', v_op, 'source', 'AIS')) then
        n := n + 1;
      end if;
    else
      perform raise_risk(r.load_id, 'FERRY', 'HIGH',
        format('Brak potwierdzenia pozycją, że transport był w porcie PL (%s) w chwili odejścia rejsu %s %s',
               v_op, r.vessel, to_char(r.dep at time zone 'Europe/Warsaw', 'DD.MM HH24:MI')),
        jsonb_build_object('sailing_id', r.sailing_id, 'status', r.status, 'title_key', 'rk_missed_sailing', 'params', jsonb_build_object('vessel', r.vessel,
          'dep', to_char(r.dep at time zone 'Europe/Warsaw', 'DD.MM HH24:MI'), 'operator', v_op)),
        'MISSED_SAILING:' || r.load_id || ':' || r.sailing_id);
    end if;
  end loop;
  return n;
end $function$;

revoke all on function public.promote_ferry_departures(timestamptz) from public, anon, authenticated;
grant execute on function public.promote_ferry_departures(timestamptz) to service_role;
comment on function public.promote_ferry_departures(timestamptz) is
  'E25/#461: FERRY tylko po actual_departure_at (AIS); 2 h bez AIS → NO_DEPARTURE; ODWOLANY wg planu.';

create or replace function public.a10_try_ferry_backup(p_load uuid, p_now timestamptz default now())
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  l public.loads%rowtype;
  v_lat double precision;
  v_lon double precision;
  v_pos_at timestamptz;
  v_vessel uuid;
  v_dep timestamptz;
  v_actual_dep timestamptz;
  v_ais_lat double precision;
  v_ais_lon double precision;
  v_ais_at timestamptz;
  v_ais_sog real;
  v_in_port boolean;
  v_sea boolean;
  v_near_ais boolean;
  v_dist_m double precision;
  v_fresh_h numeric;
  v_left_port boolean;
  v_sailing_departed boolean;
  v_ais_within_3km boolean;
  v_ais_in_port_out boolean;
begin
  select * into l from public.loads where id = p_load;
  if l.id is null then return false; end if;
  if l.status::text not in ('READY','AT_LOADING','IN_TRANSIT_PL','AT_PORT_GDANSK') then
    return false;
  end if;
  if nullif(btrim(l.telematics_vehicle_id), '') is null then
    return false;
  end if;

  select hours into v_fresh_h from public.eta_segment_params where code = 'GPS_FRESH_MIN';
  v_fresh_h := coalesce(v_fresh_h, 1.5);

  select ST_Y(p.geom_raw::geometry), ST_X(p.geom_raw::geometry), p.ts
    into v_lat, v_lon, v_pos_at
    from positions p
   where p.load_id = l.id
   order by p.ts desc
   limit 1;

  v_vessel := null;
  v_dep := null;
  v_actual_dep := null;
  if l.sailing_id is not null then
    select s.vessel_id,
           coalesce(s.delayed_departure_at, s.departure_at),
           s.actual_departure_at
      into v_vessel, v_dep, v_actual_dep
      from sailings s where s.id = l.sailing_id;
  end if;

  v_ais_lat := null;
  v_ais_lon := null;
  v_ais_at := null;
  v_ais_sog := null;
  if v_vessel is not null then
    select vp.lat, vp.lon, vp.observed_at, vp.sog_kn
      into v_ais_lat, v_ais_lon, v_ais_at, v_ais_sog
      from vessel_positions vp
     where vp.vessel_id = v_vessel
       and vp.observed_at >= p_now - interval '2 hours'
     order by vp.observed_at desc
     limit 1;
  end if;

  /* Odejście rejsu: actual_departure_at albo (plan ≤ now i AIS > 3 km / sog≥3 poza PORT_OUT). #445 (b). */
  v_sailing_departed := false;
  v_ais_within_3km := false;
  v_ais_in_port_out := false;
  if v_ais_lat is not null then
    select exists (
      select 1 from geofences g
       where g.project_id = l.project_id and g.active and g.kind = 'PORT_OUT'
         and ST_DWithin(
           g.geom::geography,
           ST_SetSRID(ST_MakePoint(v_ais_lon, v_ais_lat), 4326)::geography,
           3000
         )
    ) into v_ais_within_3km;
    select exists (
      select 1 from geofences g
       where g.project_id = l.project_id and g.active and g.kind = 'PORT_OUT'
         and ST_DWithin(
           g.geom::geography,
           ST_SetSRID(ST_MakePoint(v_ais_lon, v_ais_lat), 4326)::geography,
           greatest(coalesce(g.hysteresis_m, 200), 500)
         )
    ) into v_ais_in_port_out;
  end if;

  if v_actual_dep is not null then
    v_sailing_departed := true;
  elsif v_dep is not null and v_dep <= p_now and v_ais_lat is not null then
    if v_ais_within_3km is not true then
      v_sailing_departed := true;
    elsif coalesce(v_ais_sog, 0) >= 3 and v_ais_in_port_out is not true then
      v_sailing_departed := true;
    end if;
  end if;

  select exists (
    select 1 from public.load_events e
     where e.load_id = l.id
       and e.event_type = 'GEOFENCE_EXIT'
       and coalesce(e.payload->>'geofence_kind', '') = 'PORT_OUT'
  ) into v_left_port;

  v_sea := false;
  if v_pos_at is not null
     and v_pos_at >= p_now - make_interval(secs => (v_fresh_h * 3600)::int)
     and (v_left_port is true or v_sailing_departed is true) then
    v_sea := v_lat is not null
         and v_lat between 54.55 and 58.90
         and v_lon between 16.80 and 20.50
         and not exists (
           select 1 from geofence_states gs
             join geofences g on g.id = gs.geofence_id
            where gs.load_id = l.id
              and gs.state in ('INSIDE','PENDING_OUT')
              and g.kind in ('LOADING','PORT_OUT','PORT_IN','SITE','CHECKPOINT','PRE_ARRIVAL')
              and g.active
         )
         and not exists (
           select 1 from geofences g
            where g.project_id = l.project_id and g.active
              and g.kind in ('LOADING','PORT_OUT','PORT_IN','SITE','CHECKPOINT','PRE_ARRIVAL')
              and ST_DWithin(
                g.geom::geography,
                ST_SetSRID(ST_MakePoint(v_lon, v_lat), 4326)::geography,
                greatest(coalesce(g.hysteresis_m, 200), 500)
              )
         );
  end if;

  v_near_ais := false;
  if v_vessel is not null and v_lat is not null and v_ais_lat is not null
     and v_ais_in_port_out is not true then
    v_dist_m := ST_DistanceSphere(
      ST_SetSRID(ST_MakePoint(v_lon, v_lat), 4326),
      ST_SetSRID(ST_MakePoint(v_ais_lon, v_ais_lat), 4326)
    );
    v_near_ais := v_dist_m is not null and v_dist_m <= 2000;
  end if;

  if (v_sea is true or v_near_ais is true)
     and v_sailing_departed is true
     and public.load_status_rank(l.status) < public.load_status_rank('FERRY') then
    return public.auto_set_status(
      l.id, l.status, 'FERRY',
      case when v_near_ais then 'pozycja zbieżna z AIS statku (≤ 2 km)'
           else 'pozycja GPS na morzu (korytarz rejsu)' end,
      coalesce(v_pos_at, p_now),
      jsonb_build_object(
        'actor', 'system',
        'source', case when v_near_ais then 'AIS' else 'GPS' end,
        'path', 'A10_b'
      )
    );
  end if;

  /* (c) #461: tylko po actual_departure_at — bez furtki z rozkładu. */
  if v_actual_dep is not null and v_actual_dep <= p_now then
    select exists (
      select 1 from geofence_states gs
        join geofences g on g.id = gs.geofence_id
       where gs.load_id = l.id and g.kind = 'PORT_OUT' and g.active
         and gs.state in ('INSIDE','PENDING_OUT')
         and (gs.entered_at is null or gs.entered_at <= p_now - interval '30 minutes')
    ) into v_in_port;
    if v_in_port is not true
       and (v_pos_at is null or v_pos_at <= p_now - interval '30 minutes'
            or not exists (
              select 1 from geofence_states gs
                join geofences g on g.id = gs.geofence_id
               where gs.load_id = l.id and g.kind = 'PORT_OUT' and g.active
                 and gs.state in ('INSIDE','PENDING_OUT')
            ))
       and l.status = 'AT_PORT_GDANSK' then
      if not exists (
        select 1 from positions p
         where p.load_id = l.id
           and p.ts >= p_now - interval '30 minutes'
           and exists (
             select 1 from geofences g
              where g.project_id = l.project_id and g.kind = 'PORT_OUT' and g.active
                and ST_DWithin(
                  g.geom::geography,
                  p.geom_raw::geography,
                  coalesce(g.hysteresis_m, 200)
                )
           )
      ) then
        return public.auto_set_status(
          l.id, l.status, 'FERRY',
          'statek odpłynął — brak pozycji w porcie PL od 30 min',
          coalesce(v_actual_dep, p_now),
          jsonb_build_object('actor', 'system', 'source', 'AIS', 'path', 'A10_c')
        );
      end if;
    end if;
  end if;

  return false;
end $$;

revoke all on function public.a10_try_ferry_backup(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.a10_try_ferry_backup(uuid, timestamptz) to service_role;
comment on function public.a10_try_ferry_backup(uuid, timestamptz) is
  'A10: zapas Na promie (b GPS/AIS po odejściu — #445; c tylko po actual_departure_at — #461).';
