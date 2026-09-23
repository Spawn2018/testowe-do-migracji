-- =====================================================================
-- TOWER — Migracja 0002: silnik geofencingu
--
-- Trzy warstwy ochrony przed fałszywymi alertami, każda rozwiązuje
-- inny problem. Pominięcie którejkolwiek = dziesiątki maili z jednego postoju:
--
--   1. HISTEREZA  — wyjście dopiero po opuszczeniu strefy o hysteresis_m.
--                   Auto stojące na granicy nie generuje par enter/exit.
--   2. DEBOUNCE   — N kolejnych próbek wewnątrz, zanim ENTER zostanie uznany.
--                   Odfiltrowuje jitter GPS i pojedynczy zły fix.
--   3. DWELL      — dla portów i placu: strefa "zaliczona" dopiero po X sekundach.
--                   Przejazd obok bramy nie jest przyjazdem.
--
-- Maszyna stanów: OUTSIDE -> PENDING_IN -> INSIDE -> PENDING_OUT -> OUTSIDE
-- =====================================================================

-- ---------------------------------------------------------------------
-- Pomocnicza: tworzenie strefy okrągłej jako poligonu (bufor geograficzny)
-- ---------------------------------------------------------------------
create or replace function make_circle_fence(p_lat float8, p_lon float8, p_radius_m float8)
returns geometry(Polygon, 4326)
language sql immutable as $$
  select st_transform(
           st_buffer(
             st_transform(st_setsrid(st_makepoint(p_lon, p_lat), 4326), 3857),
             p_radius_m
           ), 4326
         )::geometry(Polygon, 4326);
$$;

-- ---------------------------------------------------------------------
-- GŁÓWNA FUNKCJA: przetworzenie jednej pozycji
--
-- Wywoływana przez webhook telematyki, cron pollingu albo PWA kierowcy.
-- Jest IDEMPOTENTNA: powtórzone wywołanie z tym samym (load_id, ts, source)
-- nie zduplikuje ani pozycji, ani zdarzenia (unique + dedup_key).
-- ---------------------------------------------------------------------
create or replace function process_position(
  p_load_id  uuid,
  p_lat      float8,
  p_lon      float8,
  p_ts       timestamptz,
  p_source   position_source default 'TELEMATICS_API',
  p_speed    numeric default null,
  p_heading  numeric default null,
  p_ignition boolean default null,
  p_raw      jsonb default '{}'::jsonb
) returns table (event_type text, geofence_id uuid, geofence_name text)
language plpgsql security definer set search_path = public as $$
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
begin
  -- Odrzucamy oczywiste błędy GPS: ciężarówka nie jedzie 160 km/h,
  -- a (0,0) to klasyczny "null island" z uszkodzonego modułu.
  if p_lat is null or p_lon is null then return; end if;
  if abs(p_lat) < 0.001 and abs(p_lon) < 0.001 then return; end if;
  if p_speed is not null and p_speed > 130 then return; end if;

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

      insert into load_events (load_id, event_type, occurred_at, source, geom, payload, dedup_key)
      values (
        p_load_id, v_emit, p_ts, p_source, v_pt,
        jsonb_build_object(
          'geofence_id',   v_fence.id,
          'geofence_name', v_fence.name,
          'geofence_kind', v_fence.kind,
          'notify_orgs',   to_jsonb(v_fence.notify_orgs),
          'message_tpl',   v_fence.message_tpl
        ),
        v_dedup
      )
      on conflict (dedup_key) do nothing;

      event_type    := v_emit;
      geofence_id   := v_fence.id;
      geofence_name := v_fence.name;
      return next;
    end if;
  end loop;

  return;
end $$;

-- ---------------------------------------------------------------------
-- Wykrywanie "cichego pojazdu" — brak pozycji dłużej niż próg.
-- Uruchamiane cronem co 15 min.
-- ---------------------------------------------------------------------
create or replace function detect_silent_vehicles(p_minutes int default 90)
returns int language plpgsql as $$
declare n int := 0; r record;
begin
  for r in
    select l.id, l.order_no, l.project_id, l.tractor_plate,
           max(p.ts) as last_fix
    from loads l
    left join positions p on p.load_id = l.id
    where l.status in ('IN_TRANSIT_PL','IN_TRANSIT_SE','AT_PORT_GDANSK','AT_PORT_NYNASHAMN')
    group by l.id
    having max(p.ts) is null or max(p.ts) < now() - make_interval(mins => p_minutes)
  loop
    insert into risk_signals (project_id, load_id, kind, severity, title, detail, dedup_key)
    values (
      r.project_id, r.id, 'SILENT_VEHICLE', 'MEDIUM',
      format('Brak pozycji pojazdu %s od %s min', coalesce(r.tractor_plate,'?'), p_minutes),
      jsonb_build_object('last_fix', r.last_fix, 'threshold_min', p_minutes),
      'SILENT:' || r.id || ':' || to_char(now(), 'YYYYMMDDHH24')
    )
    on conflict (dedup_key) where dedup_key is not null and resolved_at is null do nothing;
    n := n + 1;
  end loop;
  return n;
end $$;

-- ---------------------------------------------------------------------
-- Wykrywanie rozjazdu KOLEJNOŚCI MONTAŻOWEJ.
-- Ryzyko specyficzne dla konstrukcji stalowej — element potrzebny wcześniej
-- w montażu ma późniejszą planowaną dostawę niż element potrzebny później.
-- Żaden standardowy TMS tego nie pokaże.
-- ---------------------------------------------------------------------
create or replace function detect_sequence_risk(p_project uuid)
returns int language plpgsql as $$
declare n int := 0; r record;
begin
  for r in
    select a.id as early_id, a.shipment_code as early_code, a.assembly_seq as early_seq,
           b.shipment_code as late_code, b.assembly_seq as late_seq,
           la.plan_delivery_date as early_date, lb.plan_delivery_date as late_date
    from shipment_items a
    join loads la on la.id = a.load_id
    join shipment_items b on b.project_id = a.project_id
    join loads lb on lb.id = b.load_id
    where a.project_id = p_project
      and a.assembly_seq is not null and b.assembly_seq is not null
      and a.assembly_seq < b.assembly_seq
      and la.plan_delivery_date > lb.plan_delivery_date
      and la.status <> 'DELIVERED'
  loop
    insert into risk_signals (project_id, load_id, kind, severity, title, detail, dedup_key)
    values (
      p_project,
      (select load_id from shipment_items where id = r.early_id),
      'SEQUENCE', 'HIGH',
      format('Rozjazd kolejności montażu: %s (poz. %s) przyjedzie po %s (poz. %s)',
             r.early_code, r.early_seq, r.late_code, r.late_seq),
      jsonb_build_object('early', r.early_code, 'late', r.late_code,
                         'early_date', r.early_date, 'late_date', r.late_date),
      'SEQ:' || r.early_code || ':' || r.late_code
    )
    on conflict (dedup_key) where dedup_key is not null and resolved_at is null do nothing;
    n := n + 1;
  end loop;
  return n;
end $$;

-- ---------------------------------------------------------------------
-- KPI: exception detection lag — mediana czasu od zdarzenia do jego
-- zarejestrowania w systemie. Mierzy, jak szybko system WIE, a nie
-- jak szybko odświeża ekran. Najważniejszy KPI operacyjny.
-- ---------------------------------------------------------------------
create or replace function kpi_exception_detection_lag(p_project uuid, p_days int default 30)
returns interval language sql stable as $$
  select percentile_cont(0.5) within group (
           order by (e.recorded_at - e.occurred_at)
         )
  from load_events e
  join loads l on l.id = e.load_id
  where l.project_id = p_project
    and e.occurred_at > now() - make_interval(days => p_days)
    and e.event_type in ('DELAY_DETECTED','RISK_RAISED','SILENT_VEHICLE','GEOFENCE_ENTER');
$$;

-- ---------------------------------------------------------------------
-- SEED: 12 stref dla korytarza Gdańsk -> Nynäshamn -> Boden.
-- Współrzędne terminali i placu potwierdź przed produkcją.
-- ---------------------------------------------------------------------
-- insert into geofences (project_id, name, kind, geom, hysteresis_m, dwell_seconds, debounce_fixes, notify_enter, sort_order)
-- values
--  (:p, 'Terminal Polferries Gdańsk', 'PORT_OUT',    make_circle_fence(54.4030, 18.6800,  800), 200, 900, 2, true,  20),
--  (:p, 'Bufor 20 km przed Gdańskiem','PRE_PORT',    make_circle_fence(54.4030, 18.6800,20000), 500,   0, 2, true,  10),
--  (:p, 'Terminal Nynäshamn',         'PORT_IN',     make_circle_fence(58.9350, 17.9500,  800), 200, 600, 2, true,  30),
--  (:p, 'Bufor 50 km przed Boden',    'PRE_ARRIVAL', make_circle_fence(65.8054, 21.7591,50000), 1000,  0, 2, true,  80),
--  (:p, 'Plac budowy Stegra Boden',   'SITE',        make_circle_fence(65.8054, 21.7591,  1500), 300, 600, 2, true,  90);
