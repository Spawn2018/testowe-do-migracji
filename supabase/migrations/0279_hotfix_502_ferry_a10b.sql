-- #502 / D-20261023-1945-01: A10_b tylko gdy statek płynie; FERRY z automatu bez dzwonka;
-- naprawa T-11 (fałszywy Prom 14:07 + PENDING → SUPPRESSED).

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
  v_sailing_status text;
  v_ais_lat double precision;
  v_ais_lon double precision;
  v_ais_at timestamptz;
  v_ais_sog real;
  v_sea boolean;
  v_near_ais boolean;
  v_dist_m double precision;
  v_fresh_h numeric;
  v_left_port boolean;
  v_sailing_departed boolean;
  v_ais_in_port_out boolean;
  v_ais_ge_1km boolean;
  v_in_port boolean;
  v_prev text;
  v_ok boolean;
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
  v_sailing_status := null;
  if l.sailing_id is not null then
    select s.vessel_id,
           coalesce(s.delayed_departure_at, s.departure_at),
           s.actual_departure_at,
           s.status::text
      into v_vessel, v_dep, v_actual_dep, v_sailing_status
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

  /* #502: statek płynie = W_REJSIE / actual_departure_at
     albo AIS > 3 kn i ≥ 1 km od PORT_OUT. Bez „plan minął + AIS daleko” (fałszywy Prom w porcie). */
  v_sailing_departed := false;
  v_ais_in_port_out := false;
  v_ais_ge_1km := false;
  if v_ais_lat is not null then
    select exists (
      select 1 from geofences g
       where g.project_id = l.project_id and g.active and g.kind = 'PORT_OUT'
         and ST_DWithin(
           g.geom::geography,
           ST_SetSRID(ST_MakePoint(v_ais_lon, v_ais_lat), 4326)::geography,
           greatest(coalesce(g.hysteresis_m, 200), 500)
         )
    ) into v_ais_in_port_out;
    select not exists (
      select 1 from geofences g
       where g.project_id = l.project_id and g.active and g.kind = 'PORT_OUT'
         and ST_DWithin(
           g.geom::geography,
           ST_SetSRID(ST_MakePoint(v_ais_lon, v_ais_lat), 4326)::geography,
           1000
         )
    ) into v_ais_ge_1km;
  end if;

  if v_actual_dep is not null then
    v_sailing_departed := true;
  elsif v_sailing_status = 'W_REJSIE' then
    v_sailing_departed := true;
  elsif coalesce(v_ais_sog, 0) > 3 and v_ais_ge_1km is true then
    v_sailing_departed := true;
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

  /* Zbieżność z AIS w porcie (zacumowany) nigdy nie daje FERRY. */
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
    /* #502 / #469: FERRY z automatu bez dzwonka (jak promote_ferry_departures). */
    v_prev := current_setting('tower.bulk_quiet', true);
    perform set_config('tower.bulk_quiet', 'on', true);
    v_ok := public.auto_set_status(
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
    perform set_config('tower.bulk_quiet', coalesce(v_prev, ''), true);
    return v_ok;
  end if;

  /* (c) #461: tylko po actual_departure_at. */
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
        v_prev := current_setting('tower.bulk_quiet', true);
        perform set_config('tower.bulk_quiet', 'on', true);
        v_ok := public.auto_set_status(
          l.id, l.status, 'FERRY',
          'statek odpłynął — brak pozycji w porcie PL od 30 min',
          coalesce(v_actual_dep, p_now),
          jsonb_build_object('actor', 'system', 'source', 'AIS', 'path', 'A10_c')
        );
        perform set_config('tower.bulk_quiet', coalesce(v_prev, ''), true);
        return v_ok;
      end if;
    end if;
  end if;

  return false;
end $$;

revoke all on function public.a10_try_ferry_backup(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.a10_try_ferry_backup(uuid, timestamptz) to service_role;
comment on function public.a10_try_ferry_backup(uuid, timestamptz) is
  'A10: zapas Na promie — #502: tylko gdy statek płynie (W_REJSIE/actual_dep lub AIS>3kn ≥1km); bez dzwonka.';

-- T-11: fałszywy Prom 14:07 z osi (zastepuje) + 12 PENDING status → SUPPRESSED.
do $t11$
declare
  v_load uuid := '01afbd19-4a6b-4b11-8078-800cdae948ca';
  v_ev bigint;
  v_ev_at timestamptz;
  v_dep timestamptz;
  v_status text;
  v_n int := 0;
  v_prev text;
begin
  select l.status::text, s.actual_departure_at
    into v_status, v_dep
    from public.loads l
    left join public.sailings s on s.id = l.sailing_id
   where l.id = v_load;
  if v_status is null then
    return; -- brak na TEST / lokalnie
  end if;

  insert into public.audit_log (user_id, action, entity, entity_id, new_value)
  values (
    null, 'HOTFIX_502_BEFORE', 'loads', v_load::text,
    jsonb_build_object('status', v_status, 'actual_dep', v_dep, 'hotfix', '0279')
  );

  /* Ukryj fałszywy wpis A10_b (bez korekty AIS) — zostaje ostatnia korekta z actual_departure. */
  select e.id, e.occurred_at into v_ev, v_ev_at
    from public.load_events e
   where e.load_id = v_load
     and e.event_type = 'STATUS_AUTO'
     and e.payload->>'to' = 'FERRY'
     and coalesce(e.payload->>'path', '') = 'A10_b'
     and not exists (
       select 1 from public.load_events z
        where z.load_id = e.load_id and z.payload->>'zastepuje' = e.id::text
     )
   order by e.id asc
   limit 1;

  if v_ev is not null and v_dep is not null and v_ev_at is distinct from v_dep then
    v_prev := current_setting('tower.bulk_quiet', true);
    perform set_config('tower.bulk_quiet', 'on', true);
    insert into public.load_events (load_id, event_type, occurred_at, payload)
    values (
      v_load, 'STATUS_AUTO', v_dep,
      jsonb_build_object(
        'from', 'FERRY', 'to', 'FERRY', 'source', 'AIS',
        'korekta', true, 'zastepuje', v_ev, 'poprzednio', v_ev_at,
        'hotfix', '0279', 'actor', 'system',
        'powod', 'korekta: fałszywy Prom A10_b przed wypłynięciem (#502)'
      )
    );
    perform set_config('tower.bulk_quiet', coalesce(v_prev, ''), true);
  end if;

  update public.notifications n
     set status = 'SUPPRESSED',
         error = coalesce(nullif(n.error, ''), 'hotfix #502: Prom z automatu bez dzwonka')
   where n.load_id = v_load
     and n.status = 'PENDING'
     and n.template = 'LOAD_STATUS_CHANGED'
     and coalesce(n.payload->>'to', '') = 'FERRY';
  get diagnostics v_n = row_count;

  insert into public.audit_log (user_id, action, entity, entity_id, new_value)
  values (
    null, 'HOTFIX_502_T11', 'loads', v_load::text,
    jsonb_build_object(
      'zastepuje', v_ev,
      'notifications_suppressed', v_n,
      'hotfix', '0279'
    )
  );
end $t11$;
