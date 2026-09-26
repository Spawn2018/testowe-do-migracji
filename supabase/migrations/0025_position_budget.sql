-- =====================================================================
-- TOWER — Migracja 0025: ANEKS 4 PR5 — budżet bazy 500 MB (pozycje GPS)
--
--   process_position(): punkt < 60 s po poprzednim dla tego transportu pomijany (telematyka
--     przewoźnika i każde inne źródło) — definicja z 0002 bez innych zmian.
--   purge_personal_data(): pozycje kasowane 30 dni po rozładunku (dotąd: 90 dni i tylko punkty
--     starsze niż 90 dni); dane kierowcy (imię, telefon) bez zmian — p_days, domyślnie 90.
--   Idempotentna (create or replace), niedestrukcyjna dla danych bieżących transportów.
-- =====================================================================

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
begin
  -- Odrzucamy oczywiste błędy GPS: ciężarówka nie jedzie 160 km/h,
  -- a (0,0) to klasyczny "null island" z uszkodzonego modułu.
  if p_lat is null or p_lon is null then return; end if;
  if abs(p_lat) < 0.001 and abs(p_lon) < 0.001 then return; end if;
  if p_speed is not null and p_speed > 130 then return; end if;

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

create or replace function purge_personal_data(p_days int default 90)
returns int language plpgsql as $$
declare n int;
begin
  update loads set driver_name = null, driver_phone = null
  where actual_delivery_at is not null
    and actual_delivery_at < now() - make_interval(days => p_days)
    and (driver_name is not null or driver_phone is not null);
  get diagnostics n = row_count;

  -- ANEKS 4 PR5: pozycje — 30 dni po rozładunku (cały ślad transportu)
  delete from positions p
  using loads l
  where l.id = p.load_id
    and l.actual_delivery_at is not null
    and l.actual_delivery_at < now() - interval '30 days';
  return n;
end $$;

-- Usterka przy okazji: purge_personal_data (security invoker) miał domyślne EXECUTE dla wszystkich —
-- zalogowany HHL mógł wywołać purge_personal_data(0) i wyczyścić dane kierowców. Wywołuje wyłącznie pg_cron.
revoke execute on function purge_personal_data(int) from public, anon, authenticated;
