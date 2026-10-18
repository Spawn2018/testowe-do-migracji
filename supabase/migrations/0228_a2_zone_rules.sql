-- =====================================================================
-- TOWER — 0228: A2 / E26 / L14 — reguły stref (D-20261017-0730-01 §2 A2)
--
-- 1) Wyjazd LOADING po postoju ≥ 5 min → IN_TRANSIT_PL + actual_load_at
--    (bez loaded_confirmed / LEFT_LOADING_UNCONFIRMED).
-- 2) Wyjazd SITE (AT_SITE) po ≥ 10 min → DELIVERED + actual_delivery_at;
--    krócej → sprawa DELIVERED_CHECK (SCX / HHL_ADMIN).
-- 3) delivered_check_resolve(load, yes, note) — odpowiedź na L14.
-- 4) process_position: payload EXIT z dwell_min / entered_at / geofence_name.
-- =====================================================================

insert into decision_types (code, title_key, decider_role, options, due_hours, due_note, severity_default, sort_order)
values (
  'DELIVERED_CHECK',
  'dec_type_DELIVERED_CHECK',
  'CARRIER',
  '[{"code":"DELIVERED_YES","label_key":"dec_opt_DELIVERED_YES","requires_comment":false,"effect":"ACCEPT"},{"code":"DELIVERED_NO","label_key":"dec_opt_DELIVERED_NO","requires_comment":false,"effect":"HOLD"}]'::jsonb,
  24,
  'po wyjeździe z placu przed progiem 10 min',
  'WARNING',
  35
)
on conflict (code) do nothing;

-- -------------------------------------------------------------------------
-- apply_geofence_status — ENTER jak 0049; EXIT: A2 (LOADING 5 min, SITE 10 min)
-- -------------------------------------------------------------------------
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
  select g.kind, g.country, g.name into v_kind, v_country, v_name
    from geofences g where g.id = v_gid;
  if v_kind is null then return null; end if;

  -- Syntetyczne wyjścia TELM (faza z pozycji) nie ustawiają actual_* (A2 / 0227).
  if coalesce(new.payload->>'synthetic', '') = 'true'
     or coalesce((new.payload->>'actual_load')::boolean, true) is false then
    return null;
  end if;

  v_detail := jsonb_build_object(
    'geofence_id', new.payload->>'geofence_id',
    'geofence_kind', v_kind,
    'geofence_name', coalesce(nullif(new.payload->>'geofence_name', ''), v_name),
    'zdarzenie', new.event_type
  );

  if new.event_type = 'GEOFENCE_ENTER' then

    if v_kind = 'LOADING' then
      if v_status = 'READY' then
        perform auto_set_status(new.load_id, v_status, 'AT_LOADING', 'wjazd w strefę załadunku', new.occurred_at, v_detail);
      elsif v_status in ('PLANNED','RESOURCES_PENDING','DOCS_PENDING') then
        perform raise_risk(new.load_id, 'AUTO_STATUS', 'HIGH',
          format('Pojazd w strefie załadunku, a transport niegotowy (status %s)', v_status),
          v_detail || jsonb_build_object('title_key', 'rk_loading_not_ready', 'params', jsonb_build_object('status', v_status)),
          'LOADING_NOT_READY:' || new.load_id);
      end if;

    elsif v_kind = 'PORT_OUT' and v_status in ('READY','AT_LOADING','IN_TRANSIT_PL') then
      if auto_set_status(new.load_id, v_status, 'AT_PORT_GDANSK', 'wjazd w strefę portu Gdańsk', new.occurred_at, v_detail)
         and loaded_confirmed(new.load_id) is not true then
        perform raise_risk(new.load_id, 'LOADING_UNCONFIRMED', 'MEDIUM',
          'Pojazd w porcie Gdańsk bez potwierdzenia załadunku',
          v_detail || jsonb_build_object('title_key', 'rk_port_no_loaded', 'params', '{}'::jsonb), 'PORT_NO_LOADED:' || new.load_id);
      end if;

    elsif v_kind = 'PORT_IN' and v_status = 'FERRY' then
      perform auto_set_status(new.load_id, v_status, 'AT_PORT_NYNASHAMN', 'wjazd w strefę portu Nynäshamn', new.occurred_at, v_detail);

    elsif v_kind = 'SITE' and v_status in ('FERRY','AT_PORT_NYNASHAMN','IN_TRANSIT_SE') then
      perform auto_set_status(new.load_id, v_status, 'AT_SITE', 'wjazd na plac budowy', new.occurred_at, v_detail);

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
      -- A2: ≥ 5 min → Droga PL + actual_load_at; bez loaded_confirmed.
      if v_dwell_min is not null and v_dwell_min >= 5 then
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
      -- krócej niż 5 min: status bez zmian, bez LEFT_LOADING_UNCONFIRMED

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
        -- L14: sprawa „Czy dostarczono?”
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

    elsif v_kind = 'PORT_IN' and v_status = 'AT_PORT_NYNASHAMN' then
      perform auto_set_status(new.load_id, v_status, 'IN_TRANSIT_SE', 'wyjazd ze strefy portu Nynäshamn', new.occurred_at, v_detail);
    end if;
  end if;
  return null;
end $function$;

revoke all on function public.apply_geofence_status() from public, anon, authenticated;

-- -------------------------------------------------------------------------
-- delivered_check_resolve — L14: Tak → Dostarczone; Nie → zamknięcie z notatką
-- -------------------------------------------------------------------------
create or replace function public.delivered_check_resolve(
  p_load uuid,
  p_yes boolean,
  p_note text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid;
  d decisions%rowtype;
  v_exit timestamptz;
  v_status load_status;
  v_dwell numeric;
  v_detail jsonb;
  v_note text;
begin
  if (current_app_user_id() is not null) is not true then
    raise exception 'Rozstrzygnięcie — tylko wskazana firma albo administrator' using errcode = '42501';
  end if;
  select id into v_me from app_users where id = current_app_user_id() and active;
  if v_me is null then
    raise exception 'Brak aktywnego konta' using errcode = '42501';
  end if;
  if (public.l2_may_resolve('CARRIER')) is not true then
    raise exception 'Rozstrzygnięcie — tylko wskazana firma albo administrator' using errcode = '42501';
  end if;

  select * into d
    from decisions
   where load_id = p_load
     and type_code = 'DELIVERED_CHECK'
     and status in ('NEW', 'ASSIGNED', 'SNOOZED')
   order by created_at desc
   limit 1
   for update;
  if not found then
    raise exception 'Brak otwartej sprawy „czy dostarczono?”' using errcode = '22023';
  end if;

  v_note := nullif(trim(coalesce(p_note, '')), '');
  v_detail := coalesce(d.detail, '{}'::jsonb);
  begin
    v_exit := coalesce((v_detail->>'exit_at')::timestamptz, d.created_at, now());
  exception when others then
    v_exit := coalesce(d.created_at, now());
  end;
  begin
    v_dwell := (v_detail->>'dwell_min')::numeric;
  exception when others then
    v_dwell := null;
  end;

  if p_yes is true then
    select status into v_status from loads where id = p_load for update;
    if v_status is null then
      raise exception 'Nieznany transport' using errcode = '22023';
    end if;
    if v_status = 'AT_SITE' then
      if auto_set_status(
           p_load, v_status, 'DELIVERED',
           'potwierdzenie dostawy (L14)',
           v_exit,
           v_detail || jsonb_build_object('resolution', 'DELIVERED_YES')
         ) then
        perform set_config('tower.status_ctx', 'on', true);
        update loads
           set actual_delivery_at = coalesce(actual_delivery_at, v_exit),
               updated_at = now()
         where id = p_load;
      end if;
    elsif v_status not in ('DELIVERED', 'UNLOADED', 'READY_TO_INVOICE', 'INVOICED') then
      -- już nie AT_SITE, ale sprawa otwarta — ustaw Dostarczone z kontekstu statusu
      perform set_config('tower.status_ctx', 'on', true);
      update loads
         set status = 'DELIVERED',
             actual_delivery_at = coalesce(actual_delivery_at, v_exit),
             updated_at = now()
       where id = p_load and status = v_status;
      insert into load_events (load_id, event_type, occurred_at, payload, dedup_key)
      values (
        p_load, 'STATUS_AUTO', v_exit,
        v_detail || jsonb_build_object('from', v_status, 'to', 'DELIVERED', 'powod', 'potwierdzenie dostawy (L14)'),
        'STATUS_AUTO:' || p_load || ':DELIVERED:L14'
      )
      on conflict (dedup_key) where dedup_key is not null do nothing;
    end if;

    update decisions
       set status = 'RESOLVED',
           resolved_at = now(),
           resolved_by = v_me,
           resolution_code = 'DELIVERED_YES',
           resolution_note = v_note,
           snooze_until = null,
           updated_at = now()
     where id = d.id;
    insert into decision_events (decision_id, actor_id, action, payload)
    values (d.id, v_me, 'RESOLVE', jsonb_build_object('option', 'DELIVERED_YES', 'note', v_note));
    insert into load_events (load_id, event_type, occurred_at, payload)
    values (
      p_load, 'NOTE', now(),
      jsonb_build_object(
        'note', coalesce(v_note, format('Tak, dostarczono (wyjazd po %s min)', coalesce(v_dwell::int::text, '?'))),
        'decision_id', d.id, 'option', 'DELIVERED_YES'
      )
    );
    insert into audit_log (user_id, action, entity, entity_id, new_value)
    values (v_me, 'DELIVERED_CHECK_YES', 'decisions', d.id::text,
            jsonb_build_object('load_id', p_load, 'exit_at', v_exit, 'dwell_min', v_dwell));
    return jsonb_build_object('ok', true, 'decision_id', d.id, 'status', 'DELIVERED');
  end if;

  -- Nie
  update decisions
     set status = 'RESOLVED',
         resolved_at = now(),
         resolved_by = v_me,
         resolution_code = 'DELIVERED_NO',
         resolution_note = v_note,
         snooze_until = null,
         updated_at = now()
   where id = d.id;
  insert into decision_events (decision_id, actor_id, action, payload)
  values (d.id, v_me, 'RESOLVE', jsonb_build_object('option', 'DELIVERED_NO', 'note', v_note));
  insert into load_events (load_id, event_type, occurred_at, payload)
  values (
    p_load, 'NOTE', now(),
    jsonb_build_object(
      'note', coalesce(v_note, format('Nie dostarczono (wyjazd po %s min)', coalesce(v_dwell::int::text, '?'))),
      'decision_id', d.id, 'option', 'DELIVERED_NO'
    )
  );
  insert into audit_log (user_id, action, entity, entity_id, new_value)
  values (v_me, 'DELIVERED_CHECK_NO', 'decisions', d.id::text,
          jsonb_build_object('load_id', p_load, 'note', v_note, 'dwell_min', v_dwell));
  return jsonb_build_object('ok', true, 'decision_id', d.id, 'status', 'AT_SITE');
end $$;

comment on function public.delivered_check_resolve(uuid, boolean, text) is
  'A2/L14: Tak → Dostarczone z czasem wyjazdu; Nie → zamknięcie sprawy. SCX albo HHL_ADMIN.';
revoke all on function public.delivered_check_resolve(uuid, boolean, text) from public, anon;
grant execute on function public.delivered_check_resolve(uuid, boolean, text) to authenticated;

-- -------------------------------------------------------------------------
-- process_position — jak 0227 + dwell_min / entered_at w payloadzie EXIT/DWELL
-- -------------------------------------------------------------------------
create or replace function public.process_position(
  p_load_id  uuid,
  p_lat      double precision,
  p_lon      double precision,
  p_ts       timestamptz default now(),
  p_source   position_source default 'TELEMATICS_API',
  p_speed    numeric default null,
  p_heading  numeric default null,
  p_ignition boolean default null,
  p_raw      jsonb default '{}'::jsonb
) returns table (event_type text, geofence_id uuid, geofence_name text)
language plpgsql security definer set search_path = public as $$
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
      on conflict (dedup_key) where dedup_key is not null do nothing;

      event_type    := v_emit;
      geofence_id   := v_fence.id;
      geofence_name := v_fence.name;
      return next;
    end if;
  end loop;

  return;
end $$;

revoke all on function public.process_position(uuid, double precision, double precision, timestamptz, position_source, numeric, numeric, boolean, jsonb)
  from public, anon, authenticated;
grant execute on function public.process_position(uuid, double precision, double precision, timestamptz, position_source, numeric, numeric, boolean, jsonb)
  to service_role;
