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
  -- A2: po Dostarczone także gotowe do faktury i zafakturowane — bez cofania statusu.
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
    -- Wyjazd ze strefy portu Gdańsk po przełączeniu na PROM (statek
    -- odpływa) celowo niczego nie zmienia.
  end if;
  return null;
end $function$;

revoke all on function public.apply_geofence_status() from public, anon, authenticated;

-- -------------------------------------------------------------------------
-- delivered_check_apply — wspólna ścieżka L14 (karta i decision_resolve)
-- -------------------------------------------------------------------------
create or replace function public.delivered_check_apply(
  p_decision uuid,
  p_yes boolean,
  p_note text
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
  select id into v_me from app_users where id = current_app_user_id() and active;
  select * into d from decisions where id = p_decision for update;
  if not found or (d.status in ('NEW', 'ASSIGNED', 'SNOOZED') and d.type_code = 'DELIVERED_CHECK') is not true then
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
    select status into v_status from loads where id = d.load_id for update;
    if v_status is distinct from 'AT_SITE' then
      raise exception 'Status transportu zmienił się — ustaw „Dostarczone” przez „Zmień status”' using errcode = '22023';
    end if;
    if auto_set_status(
         d.load_id, v_status, 'DELIVERED',
         'potwierdzenie dostawy (L14)',
         v_exit,
         v_detail || jsonb_build_object('resolution', 'DELIVERED_YES')
       ) then
      perform set_config('tower.status_ctx', 'on', true);
      update loads
         set actual_delivery_at = coalesce(actual_delivery_at, v_exit),
             updated_at = now()
       where id = d.load_id;
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
      d.load_id, 'NOTE', now(),
      jsonb_build_object(
        'note', coalesce(v_note, format('Tak, dostarczono (wyjazd po %s min)', coalesce(v_dwell::int::text, '?'))),
        'decision_id', d.id, 'option', 'DELIVERED_YES'
      )
    );
    insert into audit_log (user_id, action, entity, entity_id, new_value)
    values (v_me, 'DELIVERED_CHECK_YES', 'decisions', d.id::text,
            jsonb_build_object('load_id', d.load_id, 'exit_at', v_exit, 'dwell_min', v_dwell));
    perform decision_notify(d.id, 'RESOLVE');
    return jsonb_build_object('ok', true, 'decision_id', d.id, 'status', 'DELIVERED');
  end if;

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
    d.load_id, 'NOTE', now(),
    jsonb_build_object(
      'note', coalesce(v_note, format('Nie dostarczono (wyjazd po %s min)', coalesce(v_dwell::int::text, '?'))),
      'decision_id', d.id, 'option', 'DELIVERED_NO'
    )
  );
  insert into audit_log (user_id, action, entity, entity_id, new_value)
  values (v_me, 'DELIVERED_CHECK_NO', 'decisions', d.id::text,
          jsonb_build_object('load_id', d.load_id, 'note', v_note, 'dwell_min', v_dwell));
  perform decision_notify(d.id, 'RESOLVE');
  return jsonb_build_object('ok', true, 'decision_id', d.id, 'status', 'AT_SITE');
end $$;

comment on function public.delivered_check_apply(uuid, boolean, text) is
  'A2/L14: wspólne rozstrzygnięcie. Tak tylko z AT_SITE przez auto_set_status. Bez GRANT dla authenticated.';
revoke all on function public.delivered_check_apply(uuid, boolean, text) from public, anon, authenticated;

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
  d_id uuid;
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

  select id into d_id
    from decisions
   where load_id = p_load
     and type_code = 'DELIVERED_CHECK'
     and status in ('NEW', 'ASSIGNED', 'SNOOZED')
   order by created_at desc
   limit 1
   for update;
  if d_id is null then
    raise exception 'Brak otwartej sprawy „czy dostarczono?”' using errcode = '22023';
  end if;
  return public.delivered_check_apply(d_id, p_yes, p_note);
end $$;

comment on function public.delivered_check_resolve(uuid, boolean, text) is
  'A2/L14: Tak → Dostarczone z czasem wyjazdu (tylko z AT_SITE); Nie → zamknięcie sprawy. SCX albo HHL_ADMIN.';
revoke all on function public.delivered_check_resolve(uuid, boolean, text) from public, anon;
grant execute on function public.delivered_check_resolve(uuid, boolean, text) to authenticated;

-- -------------------------------------------------------------------------
-- process_position — jak 0227 + dwell_min / entered_at w payloadzie EXIT/DWELL
-- -------------------------------------------------------------------------
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
  v_outside_h boolean;   -- poza strefą z uwzględnieniem histerezy
  v_new_state geofence_state_kind;
  v_emit      text;
  v_dedup     text;
  v_payload   jsonb;
  v_dwell_min numeric;
begin
  -- Odrzucamy oczywiste błędy GPS: ciężarówka nie jedzie 160 km/h,
  -- a (0,0) to klasyczny "null island" z uszkodzonego modułu.
  if p_lat is null or p_lon is null then return; end if;
  if abs(p_lat) < 0.001 and abs(p_lon) < 0.001 then return; end if;
  if p_speed is not null and p_speed > 130 then return; end if;

  -- A1 / E27: poza oknem pozycja nie trafia do transportu.
  if public.load_in_tracking_window(p_load_id, coalesce(p_ts, now())) is not true then
    return;
  end if;
  -- Kolumna systemowa: przy sesji kierowcy/przewoźnika strażnik puszcza tylko ten zapis.
  perform set_config('tower.track_ctx', 'on', true);
  update loads
     set tracking_opened_at = public.tracking_window_start(plan_load_date)
   where id = p_load_id
     and tracking_opened_at is null
     and plan_load_date is not null;
  perform set_config('tower.track_ctx', 'off', true);

  -- ANEKS 4 PR5 — budżet bazy 500 MB: punkt bliżej niż 60 s po poprzednim dla tego transportu
  -- jest pomijany w całości (bez zapisu i bez ewaluacji stref). Powtórka tego samego punktu
  -- (retry crona) też kończy się tutaj — pozycja i zdarzenia już są, idempotencja zachowana.
  if exists (select 1 from positions
              where load_id = p_load_id and ts <= p_ts and ts > p_ts - interval '60 seconds') then
    return;
  end if;

  v_pt := st_setsrid(st_makepoint(p_lon, p_lat), 4326);
  select project_id into v_project from loads where id = p_load_id;
  if v_project is null then
    raise exception 'Nieznany load_id: %', p_load_id;
  end if;

  -- 1) Zapis surowej pozycji. geom_snapped celowo NULL — snapowanie
  --    do sieci drogowej nigdy nie nadpisuje surowego odczytu.
  insert into positions (load_id, ts, geom_raw, speed_kmh, heading_deg, ignition, source, raw)
  values (p_load_id, p_ts, v_pt, p_speed, p_heading, p_ignition, p_source, p_raw)
  on conflict (load_id, ts, source) do nothing;

  -- 2) Ewaluacja stref. GiST na geofences.geom sprawia, że przy kilkunastu
  --    strefach to jest mikrosekundy — H3 prefilter jest tu zbędny.
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

    -- === MASZYNA STANÓW ===
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
        v_new_state := 'OUTSIDE';   -- jitter: reset licznika
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
        v_new_state := 'INSIDE';    -- wrócił, to nie było wyjście
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

    -- 3) Emisja zdarzenia z kluczem deduplikacji.
    --    Cron jest "best effort" i potrafi odpalić dwa razy — to jest zabezpieczenie.
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

  return;
end $$;

revoke all on function public.process_position(uuid, double precision, double precision, timestamptz, position_source, numeric, numeric, boolean, jsonb)
  from public, anon, authenticated;
grant execute on function public.process_position(uuid, double precision, double precision, timestamptz, position_source, numeric, numeric, boolean, jsonb)
  to service_role;

-- -------------------------------------------------------------------------
-- decision_resolve — jak 0139; DELIVERED_CHECK idzie przez delivered_check_apply
-- -------------------------------------------------------------------------
create or replace function decision_resolve(p_decision uuid, p_option text, p_note text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid; d decisions%rowtype; v_opt jsonb; v_need boolean;
  v_role text;
  v_fx jsonb;
begin
  if (current_app_user_id() is not null) is not true then
    raise exception 'Rozstrzygnięcie — tylko wskazana firma albo administrator' using errcode = '42501';
  end if;
  select id into v_me from app_users where id = current_app_user_id() and active;
  select * into d from decisions where id = p_decision for update;
  if not found then raise exception 'Brak decyzji' using errcode = '22023'; end if;
  if (d.status in ('NEW','ASSIGNED','SNOOZED')) is not true then
    raise exception 'Decyzja już zamknięta' using errcode = '22023';
  end if;
  select decider_role into v_role from decision_types where code = d.type_code;
  if (public.l2_may_resolve(v_role)) is not true then
    raise exception 'Rozstrzygnięcie — tylko wskazana firma albo administrator' using errcode = '42501';
  end if;
  select o into v_opt
    from decision_types t, jsonb_array_elements(t.options) o
   where t.code = d.type_code and o->>'code' = p_option;
  if v_opt is null then
    raise exception 'Nieznana opcja %', p_option using errcode = '22023';
  end if;
  v_need := coalesce((v_opt->>'requires_comment')::boolean, false);
  if v_need and length(coalesce(nullif(trim(p_note), ''), '')) < 3 then
    raise exception 'Ta opcja wymaga komentarza' using errcode = '22023';
  end if;
  -- D-20261018-1100-01: dzwonek i Automatyzacje — ta sama ścieżka co karta L14
  if d.type_code = 'DELIVERED_CHECK' then
    return public.delivered_check_apply(d.id, p_option = 'DELIVERED_YES', p_note);
  end if;
  update decisions set status = 'RESOLVED', resolved_at = now(), resolved_by = v_me,
    resolution_code = p_option, resolution_note = nullif(trim(p_note), ''),
    snooze_until = null, updated_at = now()
   where id = p_decision;
  v_fx := public.decision_apply_effect(p_decision, coalesce(v_opt->>'effect', 'ACCEPT'), p_option, p_note);
  insert into decision_events (decision_id, actor_id, action, payload)
  values (p_decision, v_me, 'RESOLVE',
          jsonb_build_object('option', p_option, 'effect', v_opt->>'effect', 'note', p_note, 'result', v_fx));
  insert into audit_log (user_id, action, entity, entity_id, new_value)
  values (v_me, 'DECISION_RESOLVE', 'decisions', p_decision::text,
          jsonb_build_object('option', p_option, 'effect', v_opt->>'effect', 'type', d.type_code, 'result', v_fx));
  perform decision_notify(p_decision, 'RESOLVE');
  return v_fx;
end $$;
revoke all on function decision_resolve(uuid, text, text) from public, anon;
grant execute on function decision_resolve(uuid, text, text) to authenticated;
