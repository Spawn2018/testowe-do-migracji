-- #461 / D-20261022-2045-01 (decyzje właściciela 22.10 20:45 i 20:47, F7 #469):
-- „Prom” automatycznie: AIS (actual_departure_at) albo plan+1 h (SCHEDULE_ASSUMED).
-- Bez NO_DEPARTURE / bez MISSED_SAILING dla rejsu nieodwołanego; bez dzwonka z tego źródła.
-- a10_try_ferry_backup (c): tylko po actual_departure_at; (b) z #445 bez zmian.
-- Jednorazowo: SG-17/18/23 + strażnik SILENT/decision-overdue przy otwartym RIO_NO_POSITION.

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

  /* Prom: AIS albo plan+1 h (brak odwołania). Bez spraw MISSED/NO_DEPARTURE.
     F7: tylko READY…AT_PORT_GDANSK (+ FERRY do korekty AIS) — nie PLANNED/DOCS/RESOURCES. */
  for r in
    select l.id as load_id, l.project_id, l.status, s.id as sailing_id,
           s.route as sailing_route, v.name as vessel,
           s.actual_departure_at as actual_dep,
           coalesce(s.delayed_departure_at, s.departure_at) as plan_dep
      from loads l
      join sailings s on s.id = l.sailing_id and s.route in ('GDN-NYN', 'GDY-KAA')
      join vessels  v on v.id = s.vessel_id
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
          and r.plan_dep + interval '1 hour' <= p_now
          and r.actual_dep is null then
      v_dep := r.plan_dep + interval '1 hour';
      v_src := 'SCHEDULE_ASSUMED';
      v_reason := 'wypłynięcie przyjęte z rozkładu (brak AIS, brak odwołania)';
    end if;

    if v_dep is null then
      continue;
    end if;

    v_op := case when r.sailing_route in ('GDY-KAA', 'KAA-GDY') then 'STENA' else 'POLFERRIES' end;

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

revoke all on function public.promote_ferry_departures(timestamptz) from public, anon, authenticated;
grant execute on function public.promote_ferry_departures(timestamptz) to service_role;
comment on function public.promote_ferry_departures(timestamptz) is
  'E25/#461: FERRY po actual_departure_at (AIS) albo plan+1h (SCHEDULE_ASSUMED); bez NO_DEPARTURE/MISSED; ODWOLANY wg planu.';

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

  /* (c) #461: tylko po actual_departure_at — brak świeżej pozycji w porcie PL (≥ 30 min).
     Stary stan geofence INSIDE nie blokuje (tracker mógł milczeć po wypłynięciu). */
  if v_actual_dep is not null and v_actual_dep <= p_now
     and l.status = 'AT_PORT_GDANSK'
     and (v_pos_at is null or v_pos_at <= p_now - interval '30 minutes') then
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

  return false;
end $$;

revoke all on function public.a10_try_ferry_backup(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.a10_try_ferry_backup(uuid, timestamptz) to service_role;
comment on function public.a10_try_ferry_backup(uuid, timestamptz) is
  'A10: zapas Na promie (b GPS/AIS po odejściu — #445; c tylko po actual_departure_at — #461).';

-- #461 F7 pkt 5: przy otwartym RIO_NO_POSITION nie otwieraj SILENT (ta sama przyczyna).
create or replace function public.detect_silent_vehicles(p_minutes integer default 90)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n int := 0;
  r record;
  v_min int;
  v_em int;
  v_connected boolean;
  v_moving boolean;
  v_last_ts timestamptz;
  v_src text;
  v_em_due boolean;
  v_rid uuid;
  v_rows int;
begin
  perform l1b_scan();
  perform dwell_scan(null, now());
  v_min := l3_ops('SILENT_MIN')::int;
  v_em := coalesce(l3_ops('SILENT_MIN_EMTRACK')::int, 720);
  if v_min is null then
    return 0;
  end if;

  for r in
    select s.id, s.dedup_key
      from risk_signals s
      join loads l on s.dedup_key = 'SILENT:' || l.id::text
     where s.resolved_at is null
       and public.load_in_tracking_window(l.id, now()) is not true
  loop
    update risk_signals set resolved_at = now() where id = r.id;
    perform l3_lapse(r.dedup_key, now());
  end loop;

  for r in
    select l.id, l.project_id, l.tractor_plate, l.status, l.telematics_vehicle_id
      from loads l
     where public.load_in_tracking_window(l.id, now())
  loop
    /* #461: jedna sprawa na przyczynę — RIO_NO_POSITION pokrywa brak pozycji.
       l3_lapse zawsze (idempotentne) — inaczej decyzja-sierota zostaje „Nowa”. */
    if exists (
      select 1 from risk_signals s
       where s.dedup_key = 'RIO_NO_POSITION:' || r.id::text
         and s.resolved_at is null
    ) then
      update risk_signals set resolved_at = now()
       where dedup_key = 'SILENT:' || r.id and resolved_at is null;
      perform l3_lapse('SILENT:' || r.id, now());
      continue;
    end if;

    v_moving := r.status in ('IN_TRANSIT_PL', 'AT_PORT_GDANSK', 'AT_PORT_NYNASHAMN', 'IN_TRANSIT_SE');
    select p.ts, p.source::text
      into v_last_ts, v_src
      from positions p
     where p.load_id = r.id
     order by p.ts desc
     limit 1;
    v_connected := r.telematics_vehicle_id is not null or v_last_ts is not null;

    if v_src = 'EMTRACK_WEB' then
      v_em_due := v_moving is true
        and v_em is not null
        and (v_last_ts is null or v_last_ts < now() - make_interval(mins => v_em));
      if v_em_due is not true then
        update risk_signals set resolved_at = now()
         where dedup_key = 'SILENT:' || r.id and resolved_at is null;
        if found then
          perform l3_lapse('SILENT:' || r.id, now());
        end if;
        continue;
      end if;
      select id into v_rid
        from risk_signals
       where dedup_key = 'SILENT:' || r.id and resolved_at is null
       limit 1;
      if v_rid is null then
        insert into risk_signals (
          project_id, load_id, kind, severity, title, title_key, detail, dedup_key, detected_at
        ) values (
          r.project_id, r.id, 'SILENT_VEHICLE', 'LOW',
          format('Brak pozycji naczepy (emtrack) %s od %s h',
                 coalesce(r.tractor_plate, '?'), round(v_em / 60.0)::int),
          'rk_silent_vehicle',
          jsonb_build_object(
            'emtrack_trailer', '1',
            'last_fix', v_last_ts,
            'threshold_min', v_em,
            'params', jsonb_build_object(
              'plate', coalesce(r.tractor_plate, '?'),
              'minutes', v_em,
              'source', 'EMTRACK_WEB'
            )
          ),
          'SILENT:' || r.id,
          now()
        )
        on conflict (dedup_key) where dedup_key is not null and resolved_at is null do nothing;
        get diagnostics v_rows = row_count;
        n := n + v_rows;
      else
        update risk_signals
           set severity = 'LOW',
               title = format('Brak pozycji naczepy (emtrack) %s od %s h',
                              coalesce(r.tractor_plate, '?'), round(v_em / 60.0)::int),
               detail = coalesce(detail, '{}'::jsonb) || jsonb_build_object(
                 'emtrack_trailer', '1',
                 'last_fix', v_last_ts,
                 'threshold_min', v_em,
                 'params', jsonb_build_object(
                   'plate', coalesce(r.tractor_plate, '?'),
                   'minutes', v_em,
                   'source', 'EMTRACK_WEB'
                 )
               )
         where id = v_rid;
      end if;
      perform l3_lapse('SILENT:' || r.id, now());
      continue;
    end if;

    if l3_silent_alarm(v_last_ts, now(), v_connected, v_moving) is not true then
      update risk_signals set resolved_at = now()
       where dedup_key = 'SILENT:' || r.id and resolved_at is null and detail->>'l3' = '1';
      if found then
        perform l3_lapse('SILENT:' || r.id, now());
      end if;
      continue;
    end if;
    n := n + l3_upsert_alarm(
      r.project_id, r.id, 'SILENT_VEHICLE', 'SILENT:' || r.id,
      format('Brak pozycji pojazdu %s od %s min', coalesce(r.tractor_plate, '?'), v_min),
      'rk_silent_vehicle',
      true,
      true,
      now() + interval '1 hour',
      jsonb_build_object(
        'last_fix', v_last_ts, 'threshold_min', v_min,
        'params', jsonb_build_object('plate', coalesce(r.tractor_plate, '?'), 'minutes', v_min)
      ),
      now()
    );
  end loop;
  return n;
end $$;

revoke all on function public.detect_silent_vehicles(integer) from public, anon, authenticated;
grant execute on function public.detect_silent_vehicles(integer) to service_role;

-- #461 F7: nie eskaluj „Decyzja po terminie” tej samej przyczyny przy otwartym RIO_NO_POSITION
-- (NO_POSITION / SILENT:…); inne decyzje transportu (SEFS, dokumenty…) eskalują normalnie.
create or replace function public.decision_escalate_overdue()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  h record;
  person record;
  n int := 0;
  v_key text;
  v_stamp text := to_char(now(), 'YYYYMMDDHH24MISSMS');
  v_ids jsonb;
  v_types int;
  v_type text;
  v_label text;
  v_title text;
  v_payload jsonb;
begin
  perform set_config('tower.escalate_overdue', '1', true);
  create temporary table if not exists esc_hit (
    user_id uuid,
    decision_id uuid,
    load_id uuid,
    type_code text,
    raw_title text,
    bell boolean,
    mail boolean,
    recipient text,
    locale text,
    party text
  ) on commit drop;
  delete from pg_temp.esc_hit;

  for r in
    select d.id, d.project_id, d.type_code, d.title, d.load_id, d.due_at,
           t.decider_role
      from decisions d
      join decision_types t on t.code = d.type_code
     where d.status in ('NEW','ASSIGNED','SNOOZED')
       and d.due_at is not null
       and d.due_at < now()
       and d.escalated_at is null
       and (d.status <> 'SNOOZED' or d.snooze_until is null or d.snooze_until < now())
       and not (
         d.load_id is not null
         and (
           d.type_code = 'NO_POSITION'
           or coalesce(d.detail->>'event_key', '') like 'SILENT:%'
         )
         and exists (
           select 1 from risk_signals s
            where s.dedup_key = 'RIO_NO_POSITION:' || d.load_id::text
              and s.resolved_at is null
         )
       )
  loop
    update decisions set escalated_at = now(), updated_at = now() where id = r.id;
    insert into decision_events (decision_id, actor_id, action, payload)
    values (r.id, null, 'ESCALATE', jsonb_build_object('due_at', r.due_at, 'type', r.type_code));
    v_title := public.tower_public_title(r.load_id, r.title, 'CODE');
    v_key := 'decision-overdue:' || r.id::text;
    if not exists (
      select 1 from risk_signals where dedup_key = v_key and resolved_at is null
    ) then
      insert into risk_signals (project_id, load_id, kind, severity, title, title_key, detail, dedup_key, audience)
      values (
        r.project_id, r.load_id, 'JOB_FAILURE', 'HIGH',
        'Decyzja po terminie: ' || v_title,
        'rk_decision_overdue',
        jsonb_build_object(
          'decision_id', r.id, 'type', r.type_code,
          'params', jsonb_build_object('title', v_title)
        ),
        v_key,
        'HHL'
      )
      on conflict (dedup_key) where dedup_key is not null and resolved_at is null do nothing;
    end if;
    insert into pg_temp.esc_hit (user_id, decision_id, load_id, type_code, raw_title, bell, mail, recipient, locale, party)
    select u.id, r.id, r.load_id, r.type_code, r.title,
           public.notify_person_on(u.id, 'dec_late', 'bell', m.in_app, m.fixed_in_app),
           public.notify_person_on(u.id, 'dec_late', 'mail', m.email, m.fixed_email)
             and u.email is not null,
           coalesce(u.email::text, u.id::text),
           u.locale,
           case o.kind::text when 'CARRIER' then 'SCX' when 'CLIENT' then 'KSH' else 'HHL' end
      from app_users u
      join organizations o on o.id = u.org_id
      join notification_matrix m
        on m.event_key = 'dec_late' and m.role = u.role and m.risks_only is not true
     where u.active
       and u.role in ('HHL_ADMIN','HHL_OPS','CLIENT_USER','CARRIER_DISPATCH','CARRIER_USER')
       and (
         public.notify_person_on(u.id, 'dec_late', 'bell', m.in_app, m.fixed_in_app)
         or (public.notify_person_on(u.id, 'dec_late', 'mail', m.email, m.fixed_email) and u.email is not null)
       )
       and (
         o.kind = 'FORWARDER'
         or (o.kind = 'CARRIER' and r.decider_role = 'CARRIER' and (
              r.load_id is null
              or exists (select 1 from loads l where l.id = r.load_id and l.carrier_org_id = o.id)))
         or (o.kind = 'CLIENT' and (
              r.project_id is null
              or exists (select 1 from projects p where p.id = r.project_id and p.client_org_id = o.id)
              or exists (select 1 from loads l join projects p on p.id = l.project_id
                          where l.id = r.load_id and p.client_org_id = o.id)))
       );
    n := n + 1;
  end loop;

  for person in
    select user_id, count(*)::int as cnt,
           bool_or(bell) as bell, bool_or(mail) as mail,
           min(recipient) as recipient, min(locale) as locale
      from pg_temp.esc_hit
     group by user_id
    having count(*) > 2
  loop
    select coalesce(jsonb_agg(distinct decision_id::text), '[]'::jsonb),
           count(distinct type_code), min(type_code)
      into v_ids, v_types, v_type
      from pg_temp.esc_hit
     where user_id = person.user_id;
    v_label := 'Po terminie: ' || person.cnt || ' '
      || case
           when person.cnt % 10 = 1 and person.cnt % 100 <> 11 then 'decyzja'
           when person.cnt % 10 between 2 and 4
                and (person.cnt % 100 < 10 or person.cnt % 100 >= 20) then 'decyzje'
           else 'decyzji'
         end;
    if v_types = 1 and v_type = 'SEFS_OUT_OF_TABLE' then
      v_label := v_label || ' · Opłata paliwowa';
    end if;
    v_payload := jsonb_build_object(
      'title', v_label, 'decision', v_label, 'path', '/ryzyka',
      'n', person.cnt, 'event', 'ESCALATE', 'locale', person.locale,
      'decision_ids', v_ids
    );
    if person.bell is true then
      insert into notifications (channel, recipient, user_id, template, payload, dedup_key)
      values (
        'IN_APP', person.recipient, person.user_id, 'DECISION_ESCALATED_BATCH', v_payload,
        left('ESC_BATCH:' || person.user_id::text || ':' || v_stamp || ':IN', 200)
      )
      on conflict (dedup_key) where dedup_key is not null do nothing;
    end if;
    if person.mail is true then
      perform public.l13_queue_email(
        'critical', 'DECISION_ESCALATED_BATCH', person.user_id, person.recipient,
        null, null, v_payload,
        left('ESC_BATCH:' || person.user_id::text || ':' || v_stamp || ':EM', 200),
        null
      );
    end if;
  end loop;

  for h in
    select * from pg_temp.esc_hit e
     where e.user_id not in (
       select user_id from pg_temp.esc_hit group by user_id having count(*) > 2
     )
  loop
    v_title := public.tower_public_title(h.load_id, h.raw_title, h.party);
    v_payload := jsonb_build_object(
      'decision_id', h.decision_id, 'type', h.type_code, 'title', v_title,
      'decision', v_title, 'event', 'ESCALATE', 'locale', h.locale
    );
    if h.bell is true and not exists (
      select 1 from notifications
       where user_id = h.user_id
         and dedup_key = left('dec:ESCALATE:' || h.decision_id::text || ':IN:' || h.user_id::text, 200)
    ) then
      insert into notifications (channel, recipient, user_id, load_id, template, payload, dedup_key)
      values (
        'IN_APP', h.recipient, h.user_id, h.load_id, 'DECISION_ESCALATED', v_payload,
        left('dec:ESCALATE:' || h.decision_id::text || ':IN:' || h.user_id::text, 200)
      )
      on conflict (dedup_key) where dedup_key is not null do nothing;
    end if;
    if h.mail is true and not exists (
      select 1 from notifications
       where user_id = h.user_id
         and dedup_key = left('dec:ESCALATE:' || h.decision_id::text || ':EM:' || h.user_id::text, 200)
    ) then
      perform public.l13_queue_email(
        'critical', 'DECISION_ESCALATED', h.user_id, h.recipient,
        h.load_id, null, v_payload,
        left('dec:ESCALATE:' || h.decision_id::text || ':EM:' || h.user_id::text, 200),
        null
      );
    end if;
  end loop;
  perform set_config('tower.escalate_overdue', '', true);
  return n;
end $$;

revoke all on function public.decision_escalate_overdue() from public, anon, authenticated;
comment on function public.decision_escalate_overdue() is
  'Eskalacja decyzji po terminie. #461: przy RIO_NO_POSITION pomija tylko NO_POSITION/SILENT tej samej przyczyny.';

-- Jednorazowo: SG-17 / SG-18 / SG-23 (produkcja; TEST bez wierszy → no-op).
do $fix461$
declare
  v_prev text;
  r record;
  v_load uuid;
  v_dep timestamptz;
  v_status text;
  v_ev bigint;
  v_ev_at timestamptz;
  v_ok boolean;
  v_sailing uuid;
begin
  v_prev := current_setting('tower.bulk_quiet', true);
  perform set_config('tower.bulk_quiet', 'on', true);

  /* SG-18: zamknij MISSED_SAILING; ustaw Prom od actual_departure_at. */
  select l.id, l.status::text, l.sailing_id, s.actual_departure_at
    into v_load, v_status, v_sailing, v_dep
    from public.loads l
    join public.shipment_items si on si.load_id = l.id and si.shipment_code = 'SG-18'
    left join public.sailings s on s.id = l.sailing_id
   order by si.shipment_code
   limit 1;

  if v_load is not null then
    insert into public.audit_log (user_id, action, entity, entity_id, new_value)
    values (
      null, 'HOTFIX_461_BEFORE', 'loads', v_load::text,
      jsonb_build_object('code', 'SG-18', 'status', v_status, 'sailing_id', v_sailing, 'actual_dep', v_dep)
    );

    update public.risk_signals
       set resolved_at = coalesce(resolved_at, now())
     where load_id = v_load
       and resolved_at is null
       and (
         dedup_key like 'MISSED_SAILING:' || v_load::text || ':%'
         or dedup_key = 'SILENT:' || v_load::text
         or dedup_key like 'decision-overdue:%'
       );
    /* F7: l3_lapse przy zamknięciu SILENT — inaczej decyzja NO_POSITION zostaje „Nowa”. */
    perform public.l3_lapse('SILENT:' || v_load::text, now());

    /* F7: kopia przeczytania powiadomień przy zamkniętych sprawach SG-18. */
    insert into public.audit_log (user_id, action, entity, entity_id, new_value)
    select null, 'AUDYT17_MARK_READ', 'notifications', n.id::text,
           jsonb_build_object('hotfix', '0270', 'load_id', v_load, 'template', n.template)
      from public.notifications n
     where n.load_id = v_load
       and n.read_at is null
       and n.template in ('RISK_OPEN', 'DECISION_ESCALATED', 'DECISION_ESCALATED_BATCH');
    update public.notifications
       set read_at = coalesce(read_at, now())
     where load_id = v_load
       and read_at is null
       and template in ('RISK_OPEN', 'DECISION_ESCALATED', 'DECISION_ESCALATED_BATCH');

    if v_dep is not null
       and v_status is distinct from 'FERRY'
       and public.load_status_rank(v_status::public.load_status)
           < public.load_status_rank('FERRY'::public.load_status) then
      v_ok := public.auto_set_status(
        v_load,
        v_status::public.load_status,
        'FERRY'::public.load_status,
        'wypłynięcie rejsu (AIS) — korekta #461',
        v_dep,
        jsonb_build_object('actor', 'system', 'source', 'AIS', 'hotfix', '0270')
      );
    elsif v_status = 'FERRY' and v_dep is not null then
      select e.id, e.occurred_at into v_ev, v_ev_at
        from public.load_events e
       where e.load_id = v_load
         and e.event_type = 'STATUS_AUTO'
         and e.payload->>'to' = 'FERRY'
         and not exists (
           select 1 from public.load_events z
            where z.load_id = e.load_id and z.payload->>'zastepuje' = e.id::text
         )
       order by e.id desc
       limit 1;
      if v_ev is not null and v_ev_at is distinct from v_dep then
        insert into public.load_events (load_id, event_type, occurred_at, payload)
        values (
          v_load, 'STATUS_AUTO', v_dep,
          jsonb_build_object(
            'from', 'FERRY', 'to', 'FERRY', 'source', 'AIS',
            'korekta', true, 'zastepuje', v_ev, 'poprzednio', v_ev_at,
            'hotfix', '0270', 'actor', 'system'
          )
        );
      end if;
    end if;

    insert into public.audit_log (user_id, action, entity, entity_id, new_value)
    values (
      null, 'HOTFIX_461_SG18', 'loads', v_load::text,
      jsonb_build_object('ok', v_ok, 'actual_dep', v_dep, 'hotfix', '0270')
    );
  end if;

  /* SG-17 i SG-23: godzina Prom = actual_departure_at. */
  for r in
    select l.id as load_id, l.status::text as status, s.actual_departure_at as dep, si.shipment_code as code
      from public.loads l
      join public.shipment_items si on si.load_id = l.id and si.shipment_code in ('SG-17', 'SG-23')
      join public.sailings s on s.id = l.sailing_id
     where s.actual_departure_at is not null
  loop
    if r.status is distinct from 'FERRY' then
      continue;
    end if;
    select e.id, e.occurred_at into v_ev, v_ev_at
      from public.load_events e
     where e.load_id = r.load_id
       and e.event_type = 'STATUS_AUTO'
       and e.payload->>'to' = 'FERRY'
       and not exists (
         select 1 from public.load_events z
          where z.load_id = e.load_id and z.payload->>'zastepuje' = e.id::text
       )
     order by e.id desc
     limit 1;
    if v_ev is null or v_ev_at is not distinct from r.dep then
      continue;
    end if;
    insert into public.audit_log (user_id, action, entity, entity_id, new_value)
    values (
      null, 'HOTFIX_461_BEFORE', 'loads', r.load_id::text,
      jsonb_build_object('code', r.code, 'occurred_at', v_ev_at, 'actual_dep', r.dep)
    );
    insert into public.load_events (load_id, event_type, occurred_at, payload)
    values (
      r.load_id, 'STATUS_AUTO', r.dep,
      jsonb_build_object(
        'from', 'FERRY', 'to', 'FERRY', 'source', 'AIS',
        'korekta', true, 'zastepuje', v_ev, 'poprzednio', v_ev_at,
        'hotfix', '0270', 'actor', 'system'
      )
    );
    insert into public.audit_log (user_id, action, entity, entity_id, new_value)
    values (
      null, 'HOTFIX_461_' || replace(r.code, '-', ''), 'loads', r.load_id::text,
      jsonb_build_object('from', v_ev_at, 'to', r.dep, 'hotfix', '0270')
    );
  end loop;

  perform set_config('tower.bulk_quiet', coalesce(v_prev, ''), true);
end $fix461$;
