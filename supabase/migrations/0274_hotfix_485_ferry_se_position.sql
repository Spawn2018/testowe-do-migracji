-- #485 PILNE: FERRY → Port SE / Droga SE z pozycji (nie tylko GEOFENCE_ENTER).
-- Gdy sygnał wraca poza strefą PORT_IN (typowe po promie), status nie zostawał
-- na „Prom” do bufora przed Boden.

create or replace function public.apply_ferry_se_from_position(
  p_load_id uuid,
  p_lat double precision,
  p_lon double precision,
  p_ts timestamptz
) returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_status   load_status;
  v_project  uuid;
  v_op       text;
  v_pt       geometry(Point, 4326);
  v_port     record;
  v_in_port  boolean := false;
  v_port_m   double precision;
  v_arrived  boolean := false;
  v_arr_at   timestamptz;
  v_prev     text;
  v_detail   jsonb;
begin
  if p_lat is null or p_lon is null then
    return;
  end if;

  select l.status, l.project_id into v_status, v_project
    from loads l where l.id = p_load_id;
  if v_status is null or v_status not in ('FERRY', 'AT_PORT_NYNASHAMN') then
    return;
  end if;

  v_op := 'POLFERRIES';
  select case when s.route in ('GDY-KAA', 'KAA-GDY') then 'STENA' else 'POLFERRIES' end,
         s.status = 'DOPLYNAL' or s.actual_arrival_at is not null,
         coalesce(s.actual_arrival_at, s.delayed_arrival_at, s.arrival_at)
    into v_op, v_arrived, v_arr_at
    from loads l
    left join sailings s on s.id = l.sailing_id
   where l.id = p_load_id;
  v_op := coalesce(v_op, 'POLFERRIES');

  v_pt := st_setsrid(st_makepoint(p_lon, p_lat), 4326);

  /* Blisko portu PL — nadal strona polska / morze od Gdańska; bez zmiany. */
  if exists (
    select 1
      from geofences g
     where g.project_id = v_project
       and g.active
       and g.kind = 'PORT_OUT'
       and coalesce(g.route, 'POLFERRIES') = v_op
       and st_dwithin(g.geom::geography, v_pt::geography, 50000)
  ) then
    return;
  end if;

  select g.id, g.name, g.geom
    into v_port
    from geofences g
   where g.project_id = v_project
     and g.active
     and g.kind = 'PORT_IN'
     and g.country = 'SE'
     and coalesce(g.route, 'POLFERRIES') = v_op
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

  /*
    Poza portem SE:
    - rejs DOPLYNAL (albo actual_arrival) i ≤ 2000 km od PORT_IN → Droga SE;
    - albo 10–80 km od PORT_IN (pierwsza pozycja zaraz poza strefą, bez ENTER).
    Morze / PL: wcześniej odfiltrowane albo poza tymi progami.
  */
  if (
       (v_arrived and v_port_m <= 2000000)
    or (v_port_m >= 10000 and v_port_m <= 80000)
  ) is not true then
    return;
  end if;

  /* Uzupełnienie pominiętego Port SE — bez powiadomień (jak synthetic FERRY). */
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
        'powod', 'pozycja na trasie SE po promie'
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
  '#485: z pozycji (nie tylko ENTER) FERRY/AT_PORT_NYNASHAMN → Port SE / Droga SE po promie.';

-- process_position: po ewaluacji stref — reguła #485 (EMTRACK_WEB / RIO / DRIVER_PWA).
create or replace function public.process_position(
  p_load_id  uuid,
  p_lat      double precision,
  p_lon      double precision,
  p_ts       timestamptz,
  p_source   position_source default 'TELEMATICS_API',
  p_speed    numeric default null,
  p_heading  numeric default null,
  p_ignition boolean default null,
  p_raw      jsonb default '{}'::jsonb
) returns table (event_type text, geofence_id uuid, geofence_name text)
language plpgsql security definer set search_path = public as $$
-- POPRAWKA 24.09.2026: kolumny wyniku (event_type, geofence_id) mają te same
-- nazwy co kolumny tabel geofence_states i load_events. Bez tej dyrektywy
-- każde wywołanie ze strefą w zasięgu kończyło się błędem „column reference
-- is ambiguous", a cała transakcja — razem z pozycją — była wycofywana.
-- Funkcja w tej postaci nigdy nie przetworzyła punktu w strefie.
#variable_conflict use_column
declare
  v_pt        geometry(Point, 4326);
  v_project   uuid;
  v_fence     record;
  v_state     record;
  v_inside    boolean;
  v_outside_h boolean;
  v_new_state geofence_state_kind;
  v_emit      text;
  v_dedup     text;
  v_payload   jsonb;
  v_dwell_min numeric;
begin
  if p_lat is null or p_lon is null then return; end if;
  if abs(p_lat) < 0.001 and abs(p_lon) < 0.001 then return; end if;
  if p_speed is not null and p_speed > 130 then return; end if;

  if public.load_in_tracking_window(p_load_id, coalesce(p_ts, now())) is not true then
    return;
  end if;
  perform set_config('tower.track_ctx', 'on', true);
  update loads
     set tracking_opened_at = public.tracking_window_start(plan_load_date)
   where id = p_load_id
     and tracking_opened_at is null
     and plan_load_date is not null;
  perform set_config('tower.track_ctx', 'off', true);

  if exists (select 1 from positions
              where load_id = p_load_id and ts <= p_ts and ts > p_ts - interval '60 seconds') then
    return;
  end if;

  v_pt := st_setsrid(st_makepoint(p_lon, p_lat), 4326);
  select project_id into v_project from loads where id = p_load_id;
  if v_project is null then
    raise exception 'Nieznany load_id: %', p_load_id;
  end if;

  insert into positions (load_id, ts, geom_raw, speed_kmh, heading_deg, ignition, source, raw)
  values (p_load_id, p_ts, v_pt, p_speed, p_heading, p_ignition, p_source, p_raw)
  on conflict (load_id, ts, source) do nothing;

  for v_fence in
    select g.* from geofences g
    where g.project_id = v_project and g.active
      and st_dwithin(g.geom::geography, v_pt::geography, g.hysteresis_m + 50)
    union
    select g.* from geofences g
    join geofence_states s on s.geofence_id = g.id and s.load_id = p_load_id
    where g.project_id = v_project and g.active and s.state <> 'OUTSIDE'
  loop
    v_inside    := st_contains(v_fence.geom, v_pt);
    v_outside_h := not st_dwithin(v_fence.geom::geography, v_pt::geography, v_fence.hysteresis_m);

    insert into geofence_states (load_id, geofence_id, state, consec_fixes, last_eval_at)
    values (p_load_id, v_fence.id, 'OUTSIDE', 0, p_ts)
    on conflict (load_id, geofence_id) do nothing;

    select * into v_state from geofence_states
      where load_id = p_load_id and geofence_id = v_fence.id for update;

    v_new_state := v_state.state;
    v_emit := null;

    if v_state.state = 'OUTSIDE' then
      if v_inside then
        if v_state.consec_fixes + 1 >= v_fence.debounce_fixes then
          v_new_state := 'INSIDE';
          v_emit := 'GEOFENCE_ENTER';
        else
          v_new_state := 'PENDING_IN';
        end if;
      end if;

    elsif v_state.state = 'PENDING_IN' then
      if v_inside then
        if v_state.consec_fixes + 1 >= v_fence.debounce_fixes then
          v_new_state := 'INSIDE';
          v_emit := 'GEOFENCE_ENTER';
        end if;
      else
        v_new_state := 'OUTSIDE';
      end if;

    elsif v_state.state = 'INSIDE' then
      if v_outside_h then
        v_new_state := 'PENDING_OUT';
      elsif v_fence.dwell_seconds > 0
            and v_state.entered_at is not null
            and p_ts - v_state.entered_at >= make_interval(secs => v_fence.dwell_seconds)
            and not exists (
              select 1 from load_events e
              where e.load_id = p_load_id
                and e.event_type = 'GEOFENCE_DWELL'
                and (e.payload->>'geofence_id')::uuid = v_fence.id
                and e.occurred_at >= v_state.entered_at
            ) then
        v_emit := 'GEOFENCE_DWELL';
      end if;

    elsif v_state.state = 'PENDING_OUT' then
      if v_inside then
        v_new_state := 'INSIDE';
      elsif v_outside_h then
        v_new_state := 'OUTSIDE';
        v_emit := 'GEOFENCE_EXIT';
      end if;
    end if;

    update geofence_states set
      state        = v_new_state,
      consec_fixes = case
                       when v_new_state in ('PENDING_IN') then v_state.consec_fixes + 1
                       when v_new_state = 'INSIDE' and v_state.state <> 'INSIDE' then 0
                       when v_new_state = 'OUTSIDE' then 0
                       else v_state.consec_fixes
                     end,
      entered_at   = case when v_emit = 'GEOFENCE_ENTER' then p_ts else v_state.entered_at end,
      exited_at    = case when v_emit = 'GEOFENCE_EXIT'  then p_ts else v_state.exited_at end,
      last_eval_at = p_ts
    where load_id = p_load_id and geofence_id = v_fence.id;

    if v_emit is not null then
      v_dedup := v_emit || ':' || p_load_id || ':' || v_fence.id || ':'
                 || to_char(p_ts at time zone 'UTC', 'YYYYMMDDHH24MI');
      v_payload := jsonb_build_object(
        'geofence_id',   v_fence.id,
        'geofence_name', v_fence.name,
        'geofence_kind', v_fence.kind,
        'notify_orgs',   to_jsonb(v_fence.notify_orgs),
        'message_tpl',   v_fence.message_tpl
      );
      if v_emit in ('GEOFENCE_EXIT', 'GEOFENCE_DWELL') and v_state.entered_at is not null then
        v_dwell_min := round(extract(epoch from (p_ts - v_state.entered_at)) / 60.0);
        v_payload := v_payload || jsonb_build_object(
          'dwell_min', v_dwell_min,
          'entered_at', v_state.entered_at,
          'minutes', v_dwell_min
        );
      end if;

      insert into load_events (load_id, event_type, occurred_at, source, geom, payload, dedup_key)
      values (
        p_load_id, v_emit, p_ts, p_source, v_pt,
        v_payload,
        v_dedup
      )
      -- POPRAWKA 24.09.2026: indeks unikalny na dedup_key jest częściowy
      -- (where dedup_key is not null) — bez tego warunku Postgres odrzucał
      -- zapis i żadne zdarzenie wjazdu ani wyjazdu nie mogło powstać.
      on conflict (dedup_key) where dedup_key is not null do nothing;

      event_type    := v_emit;
      geofence_id   := v_fence.id;
      geofence_name := v_fence.name;
      return next;
    end if;
  end loop;

  /* #485: Port SE / Droga SE z samej pozycji (gdy ENTER portu pominięty). */
  perform public.apply_ferry_se_from_position(p_load_id, p_lat, p_lon, coalesce(p_ts, now()));

  return;
end $$;

revoke all on function public.process_position(uuid, double precision, double precision, timestamptz, position_source, numeric, numeric, boolean, jsonb)
  from public, anon, authenticated;
grant execute on function public.process_position(uuid, double precision, double precision, timestamptz, position_source, numeric, numeric, boolean, jsonb)
  to service_role;

-- Naprawa danych: FERRY z pozycją poza PORT_IN SE (SG-23 i analogiczne).
do $fix485$
declare
  v_prev text;
  r record;
  v_lat double precision;
  v_lon double precision;
  v_ts timestamptz;
  v_arr timestamptz;
  v_before text;
begin
  v_prev := current_setting('tower.bulk_quiet', true);
  perform set_config('tower.bulk_quiet', 'on', true);

  for r in
    select l.id as load_id, l.status::text as status, si.shipment_code as code,
           s.actual_arrival_at, s.delayed_arrival_at, s.arrival_at, s.status as sail_status
      from public.loads l
      join public.sailings s on s.id = l.sailing_id
      left join public.shipment_items si on si.load_id = l.id
     where l.status in ('FERRY', 'AT_PORT_NYNASHAMN')
       and (s.status = 'DOPLYNAL' or s.actual_arrival_at is not null)
  loop
    select st_y(p.geom_raw::geometry), st_x(p.geom_raw::geometry), p.ts
      into v_lat, v_lon, v_ts
      from public.positions p
     where p.load_id = r.load_id
     order by p.ts desc
     limit 1;
    if v_lat is null then
      continue;
    end if;

    v_before := r.status;
    v_arr := coalesce(r.actual_arrival_at, r.delayed_arrival_at, r.arrival_at);

    insert into public.audit_log (user_id, action, entity, entity_id, new_value)
    values (
      null, 'HOTFIX_485_BEFORE', 'loads', r.load_id::text,
      jsonb_build_object(
        'code', r.code, 'status', v_before, 'lat', v_lat, 'lon', v_lon,
        'pos_at', v_ts, 'arrival', v_arr, 'sail', r.sail_status
      )
    );

    /* bulk_quiet już on — uzupełnienie Port SE ciche; Droga SE też w tej pętli cicho
       (odbiór: status na mapie; powiadomienie Droga SE przy kolejnej żywej pozycji). */
    perform public.apply_ferry_se_from_position(r.load_id, v_lat, v_lon, v_ts);

    insert into public.audit_log (user_id, action, entity, entity_id, new_value)
    values (
      null, 'HOTFIX_485_AFTER', 'loads', r.load_id::text,
      jsonb_build_object(
        'code', r.code,
        'from', v_before,
        'to', (select status::text from loads where id = r.load_id),
        'hotfix', '0274'
      )
    );
  end loop;

  perform set_config('tower.bulk_quiet', coalesce(v_prev, ''), true);
end $fix485$;
