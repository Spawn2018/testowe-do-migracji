-- #502 / D-20261023-1945-01: A10_b tylko gdy statek płynie; FERRY z automatu bez dzwonka;
-- naprawa T-11 (fałszywy Prom 14:07 + PENDING → SUPPRESSED).
-- F7 #503: B1 czas GPS↔AIS + godzina zdarzenia; B2 plan≤now/−30min; B3 quiet SCHEDULE;
-- drobne: świeżość AIS SOG 20 min.

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
  v_ais_sog_fresh boolean;
  v_in_port boolean;
  v_event_at timestamptz;
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
    /* Świeżość 2 h do zbieżności; gałąź SOG wymaga ≤ 20 min (F7). */
    select vp.lat, vp.lon, vp.observed_at, vp.sog_kn
      into v_ais_lat, v_ais_lon, v_ais_at, v_ais_sog
      from vessel_positions vp
     where vp.vessel_id = v_vessel
       and vp.observed_at >= p_now - interval '2 hours'
     order by vp.observed_at desc
     limit 1;
  end if;
  v_ais_sog_fresh := v_ais_at is not null and v_ais_at >= p_now - interval '20 minutes';

  /* #502: statek płynie = W_REJSIE / actual_departure_at
     albo AIS > 3 kn i ≥ 1 km od PORT_OUT przy planie ≤ now (+okno −30 min).
     Bez „plan minął + AIS daleko” i bez wpływającego (plan w przyszłości). */
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
  elsif v_ais_sog_fresh is true
     and coalesce(v_ais_sog, 0) > 3
     and v_ais_ge_1km is true
     and v_dep is not null
     and v_dep <= p_now + interval '30 minutes' then
    /* F7 B2: plan ≤ now (okno −30 min) — blokuje wpływający (plan w przyszłości). */
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

  /* Zbieżność z AIS: tylko gdy GPS i AIS w ≤ 15 min (F7 B1a); zacumowany nigdy. */
  v_near_ais := false;
  if v_vessel is not null and v_lat is not null and v_ais_lat is not null
     and v_pos_at is not null and v_ais_at is not null
     and abs(extract(epoch from (v_pos_at - v_ais_at))) <= 15 * 60
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
    /* F7 B1b: godzina = actual_dep, inaczej AIS (SOG), nigdy stara GPS naczepy. */
    v_event_at := coalesce(
      v_actual_dep,
      case when v_near_ais then v_ais_at end,
      case when v_sea then v_pos_at end,
      v_ais_at,
      p_now
    );
    /* #502 / #469: FERRY z automatu bez dzwonka (jak promote_ferry_departures). */
    v_prev := current_setting('tower.bulk_quiet', true);
    perform set_config('tower.bulk_quiet', 'on', true);
    v_ok := public.auto_set_status(
      l.id, l.status, 'FERRY',
      case when v_near_ais then 'pozycja zbieżna z AIS statku (≤ 2 km)'
           else 'pozycja GPS na morzu (korytarz rejsu)' end,
      v_event_at,
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
  'A10: zapas Na promie — #502 F7: SOG+plan/−30min; GPS↔AIS ≤15 min; godzina z actual/AIS; bez dzwonka.';

-- F7 B3: syntetyczny FERRY (SCHEDULE) przy PORT_IN — bez dzwonka (#502 / #469).
create or replace function public.apply_geofence_status()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_kind    geofence_kind;
  v_gid     uuid;
  v_country char(2);
  v_name    text;
  v_status  load_status;
  v_detail  jsonb;
  v_entered timestamptz;
  v_dwell_min numeric;
  v_project uuid;
  v_title   text;
  v_code    text;
  v_route   text;
  v_op      text;
  v_gaps    jsonb;
  v_gaps_txt text;
  v_dep     timestamptz;
  v_prev    text;
begin
  select status, project_id into v_status, v_project from loads where id = new.load_id;
  if v_status in ('CANCELLED','UNLOADED','DELIVERED','READY_TO_INVOICE','INVOICED') then
    return null;
  end if;
  begin
    v_gid := (new.payload->>'geofence_id')::uuid;
  exception when others then
    return null;
  end;
  select g.kind, g.country, g.name, g.route into v_kind, v_country, v_name, v_route
    from geofences g where g.id = v_gid;
  if v_kind is null then return null; end if;
  v_op := 'POLFERRIES';
  select case when s.route in ('GDY-KAA','KAA-GDY') then 'STENA' else 'POLFERRIES' end
    into v_op from loads l left join sailings s on s.id = l.sailing_id
   where l.id = new.load_id;
  v_op := coalesce(v_op, 'POLFERRIES');

  if coalesce(new.payload->>'synthetic', '') = 'true'
     or coalesce((new.payload->>'actual_load')::boolean, true) is false then
    return null;
  end if;

  v_detail := jsonb_build_object(
    'geofence_id', new.payload->>'geofence_id',
    'geofence_kind', v_kind,
    'geofence_name', coalesce(nullif(new.payload->>'geofence_name', ''), v_name),
    'zdarzenie', new.event_type,
    'source', 'GPS'
  );

  if new.event_type = 'GEOFENCE_ENTER' then

    if v_kind = 'LOADING'
       and v_status in ('PLANNED','RESOURCES_PENDING','DOCS_PENDING','READY') then
      /*
        A10: Załadunek z każdego statusu Przygotowania.
        Ryzyko gdy nie Gotowy — albo Gotowy bez numeru HHL/SCX
        (wyjątek enforce_order_numbers dla trasy: status pokazuje jazdę, F7 W12).
      */
      v_gaps := public.awiz_missing(new.load_id);
      if v_status is distinct from 'READY'
         or exists (
           select 1
             from jsonb_array_elements(coalesce(v_gaps, '[]'::jsonb)) g
            where g->>'kind' in ('ORDER_SCX', 'ORDER_HHL')
         ) then
        v_gaps_txt := public.a10_prep_gaps_text(v_gaps);
        perform raise_risk(new.load_id, 'AUTO_STATUS', 'HIGH',
          case when coalesce(v_gaps_txt, '') = '' then
            format('Załadunek bez gotowości (status %s)', v_status)
          else
            format('Załadunek bez gotowości: %s', v_gaps_txt)
          end,
          v_detail || jsonb_build_object(
            'title_key', 'rk_loading_not_ready',
            'params', jsonb_build_object('status', v_status, 'gaps', coalesce(v_gaps_txt, '')),
            'gaps', v_gaps
          ),
          'LOADING_NOT_READY:' || new.load_id);
      end if;
      perform auto_set_status(new.load_id, v_status, 'AT_LOADING',
        'wjazd w strefę załadunku', new.occurred_at, v_detail);

    elsif v_kind = 'PORT_OUT'
          and public.load_status_rank(v_status) >= public.load_status_rank('READY')
          and public.load_status_rank(v_status) <= public.load_status_rank('IN_TRANSIT_PL')
          and coalesce(v_route, 'POLFERRIES') = v_op then
      if auto_set_status(new.load_id, v_status, 'AT_PORT_GDANSK',
           format('wjazd w strefę portu PL (%s)', coalesce(v_name, v_op)),
           new.occurred_at, v_detail)
         and loaded_confirmed(new.load_id) is not true then
        perform raise_risk(new.load_id, 'LOADING_UNCONFIRMED', 'MEDIUM',
          format('Pojazd w porcie PL (%s) bez potwierdzenia załadunku', coalesce(v_name, v_op)),
          v_detail || jsonb_build_object('title_key', 'rk_port_no_loaded', 'params', '{}'::jsonb),
          'PORT_NO_LOADED:' || new.load_id);
      end if;

    elsif v_kind = 'PORT_IN'
          and public.load_status_rank(v_status) < public.load_status_rank('AT_PORT_NYNASHAMN')
          and public.load_status_rank(v_status) >= public.load_status_rank('AT_LOADING')
          and coalesce(v_route, 'POLFERRIES') = v_op then
      /* A10: Port SE z wcześniejszego statusu; pominięty Na promie → wpis FERRY. */
      if v_status is distinct from 'FERRY' then
        select coalesce(s.delayed_departure_at, s.departure_at) into v_dep
          from loads l left join sailings s on s.id = l.sailing_id
         where l.id = new.load_id;
        /* #502 F7 B3: SCHEDULE synthetic_ferry bez dzwonka. */
        v_prev := current_setting('tower.bulk_quiet', true);
        perform set_config('tower.bulk_quiet', 'on', true);
        perform auto_set_status(
          new.load_id, v_status, 'FERRY',
          'wjazd do portu SE — uzupełniony status Na promie',
          least(coalesce(v_dep, new.occurred_at), new.occurred_at),
          v_detail || jsonb_build_object(
            'source', 'SCHEDULE',
            'synthetic_ferry', true
          )
        );
        perform set_config('tower.bulk_quiet', coalesce(v_prev, ''), true);
        select status into v_status from loads where id = new.load_id;
      end if;
      if v_status = 'FERRY' then
        perform auto_set_status(new.load_id, v_status, 'AT_PORT_NYNASHAMN',
          format('wjazd w strefę portu SE (%s)', coalesce(v_name, v_op)),
          new.occurred_at, v_detail);
      end if;

    elsif v_kind = 'SITE'
          and public.load_status_rank(v_status) >= public.load_status_rank('AT_LOADING')
          and public.load_status_rank(v_status) < public.load_status_rank('AT_SITE') then
      perform auto_set_status(new.load_id, v_status, 'AT_SITE',
        'wjazd na plac budowy', new.occurred_at, v_detail);

    -- Awaryjnie: GPS zgubił wyjazd z portu SE albo cały pobyt w porcie
    -- (sygnał wraca dopiero na lądzie). Auto na drogach SE nie może być na promie.
    elsif v_kind in ('CHECKPOINT','PRE_ARRIVAL') and v_country = 'SE'
          and v_status in ('FERRY','AT_PORT_NYNASHAMN') then
      perform auto_set_status(new.load_id, v_status, 'IN_TRANSIT_SE',
        'pozycja na trasie SE — wyjazd z portu niezarejestrowany', new.occurred_at, v_detail);
    end if;

  elsif new.event_type = 'GEOFENCE_EXIT' then

    select s.entered_at into v_entered
      from geofence_states s
     where s.load_id = new.load_id and s.geofence_id = v_gid;
    if v_entered is null and new.payload ? 'entered_at' then
      begin
        v_entered := (new.payload->>'entered_at')::timestamptz;
      exception when others then
        v_entered := null;
      end;
    end if;
    if v_entered is not null then
      v_dwell_min := round(extract(epoch from (new.occurred_at - v_entered)) / 60.0);
    elsif new.payload ? 'dwell_min' then
      v_dwell_min := (new.payload->>'dwell_min')::numeric;
    else
      v_dwell_min := null;
    end if;
    if v_dwell_min is not null then
      v_detail := v_detail || jsonb_build_object('dwell_min', v_dwell_min, 'entered_at', v_entered);
    end if;

    if v_kind = 'LOADING' and v_status = 'AT_LOADING' then
      if v_entered is null then
        null;
      elsif v_dwell_min is not null and v_dwell_min >= 5 then
        if auto_set_status(
             new.load_id, v_status, 'IN_TRANSIT_PL',
             'wyjazd ze strefy załadunku po postoju ≥ 5 min',
             new.occurred_at,
             v_detail
           ) then
          perform set_config('tower.status_ctx', 'on', true);
          update loads
             set actual_load_at = coalesce(actual_load_at, new.occurred_at),
                 updated_at = now()
           where id = new.load_id;
        end if;
      end if;

    elsif v_kind = 'SITE' and v_status = 'AT_SITE' then
      if v_dwell_min is not null and v_dwell_min >= 10 then
        if auto_set_status(
             new.load_id, v_status, 'DELIVERED',
             format('wyjazd z placu po %s min', v_dwell_min::int),
             new.occurred_at,
             v_detail
           ) then
          perform set_config('tower.status_ctx', 'on', true);
          update loads
             set actual_delivery_at = coalesce(actual_delivery_at, new.occurred_at),
                 updated_at = now()
           where id = new.load_id;
        end if;
      elsif v_dwell_min is not null and v_dwell_min < 10 then
        select public.load_sms_code(new.load_id) into v_code;
        v_title := format(
          '%s: wyjazd z placu po %s min — czy dostarczono?',
          coalesce(nullif(v_code, ''), 'transport'),
          v_dwell_min::int
        );
        perform decision_open_from_event(
          v_project,
          'DELIVERED_CHECK',
          'L14:' || new.load_id::text || ':' || v_gid::text || ':'
            || to_char(new.occurred_at at time zone 'UTC', 'YYYYMMDDHH24MI'),
          v_title,
          v_detail || jsonb_build_object(
            'exit_at', new.occurred_at,
            'threshold_min', 10,
            'zone', coalesce(nullif(new.payload->>'geofence_name', ''), v_name)
          ),
          new.load_id,
          null
        );
      end if;

    elsif v_kind = 'PORT_IN' and v_status = 'AT_PORT_NYNASHAMN'
          and coalesce(v_route, 'POLFERRIES') = v_op then
      perform auto_set_status(new.load_id, v_status, 'IN_TRANSIT_SE',
        format('wyjazd ze strefy portu SE (%s)', coalesce(v_name, v_op)),
        new.occurred_at, v_detail);
    end if;
    -- Wyjazd ze strefy portu Gdańsk po przełączeniu na PROM (statek
    -- odpływa) celowo niczego nie zmienia.
  end if;
  return null;
end $function$;

revoke all on function public.apply_geofence_status() from public, anon, authenticated;

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
