-- A1 (E27, L15–L17): okno śledzenia od 03:00 czasu polskiego w dniu załadunku do „Dostarczone”.
-- Bezpiecznik L17: 24 h po planowanej dostawie sprawa dla SCX i HHL; śledzenie trwa.

alter table public.loads add column if not exists tracking_opened_at timestamptz;

comment on column public.loads.tracking_opened_at is
  'A1: moment startu okna (03:00 dnia załadunku). Ustawione raz — późniejsza zmiana daty nie zamyka śledzenia.';

create or replace function public.tracking_window_start(p_day date)
returns timestamptz
language sql
stable
set search_path = public
as $$
  select (p_day::timestamp + time '03:00') at time zone 'Europe/Warsaw';
$$;

create or replace function public.load_in_tracking_window(p_load uuid, p_ts timestamptz)
returns boolean
language plpgsql
stable
set search_path = public
as $$
declare
  v_status text;
  v_day date;
  v_opened timestamptz;
  v_ts timestamptz := coalesce(p_ts, now());
begin
  if p_load is null then
    return false;
  end if;
  select status::text, plan_load_date, tracking_opened_at
    into v_status, v_day, v_opened
    from loads
   where id = p_load;
  if v_status is null then
    return false;
  end if;
  if v_status in ('CANCELLED', 'DELIVERED', 'UNLOADED', 'READY_TO_INVOICE', 'INVOICED') then
    return false;
  end if;
  if v_opened is not null and v_ts >= v_opened then
    return true;
  end if;
  if v_day is null then
    return false;
  end if;
  return v_ts >= public.tracking_window_start(v_day);
end $$;

revoke all on function public.tracking_window_start(date) from public, anon, authenticated;
revoke all on function public.load_in_tracking_window(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.tracking_window_start(date) to service_role;
grant execute on function public.load_in_tracking_window(uuid, timestamptz) to service_role;

-- Po starcie okna zmiana daty załadunku nie zamyka śledzenia (zostaje pierwotne 03:00).
create or replace function public.loads_freeze_tracking_open()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.tracking_opened_at is null
     and old.plan_load_date is not null
     and now() >= public.tracking_window_start(old.plan_load_date) then
    new.tracking_opened_at := public.tracking_window_start(old.plan_load_date);
  end if;
  return new;
end $$;

drop trigger if exists loads_freeze_tracking_open on public.loads;
create trigger loads_freeze_tracking_open
  before update of plan_load_date on public.loads
  for each row
  execute function public.loads_freeze_tracking_open();

revoke all on function public.loads_freeze_tracking_open() from public, anon, authenticated;

-- Strażnik transportu: zamrożenie okna jest kolumną systemu, nie zmianą planu przez stronę.
create or replace function public.guard_load_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_changed  text[];
  v_bad      text[];
  v_ctx      text;
  v_carrier  text[] := array[
    'tractor_plate','trailer_plate','trailer_type','driver_name','driver_phone',
    'escort_vehicles','telematics_vehicle_id','telematics_provider',
    'ferry_booking_ref','sailing_id','carrier_order_no',
    'combo_length_m','combo_width_m','combo_height_m','combo_weight_t',
    'actual_load_at','actual_delivery_at','status','updated_at'];
begin
  if current_setting('tower.eta_ctx', true) = 'on' then
    select coalesce(array_agg(n.key), '{}') into v_changed
      from jsonb_each(to_jsonb(new)) n
     where n.value is distinct from (to_jsonb(old) -> n.key);
    if (v_changed <@ array['eta_site','eta_confidence_min','eta_basis','eta_computed_at','delay_minutes','updated_at']::text[]) is not true then
      raise exception 'Przeliczenie ETA może zmienić wyłącznie kolumny eta_* (zmienione: %)', array_to_string(v_changed, ', ');
    end if;
    return new;
  end if;

  if current_setting('tower.track_ctx', true) = 'on' then
    select coalesce(array_agg(n.key), '{}') into v_changed
      from jsonb_each(to_jsonb(new)) n
     where n.value is distinct from (to_jsonb(old) -> n.key);
    if (v_changed <@ array['tracking_opened_at','updated_at']::text[]) is not true then
      raise exception 'Okno śledzenia może zmienić wyłącznie tracking_opened_at (zmienione: %)', array_to_string(v_changed, ', ');
    end if;
    return new;
  end if;

  if current_setting('tower.dates_ctx', true) = 'on' then
    select coalesce(array_agg(n.key), '{}') into v_changed
      from jsonb_each(to_jsonb(new)) n
     where n.value is distinct from (to_jsonb(old) -> n.key);
    if (v_changed <@ array['plan_load_date','plan_load_from','plan_load_to','plan_delivery_date','plan_delivery_from','plan_delivery_to',
                           'plan_dates_status','plan_dates_confirmed_by','plan_dates_confirmed_at','tracking_opened_at','updated_at']::text[]) is not true then
      raise exception 'Potwierdzenie dat może zmienić wyłącznie daty planu (zmienione: %)', array_to_string(v_changed, ', ');
    end if;
    return new;
  end if;

  if auth.uid() is not null and (new.plan_dates_status, new.plan_dates_confirmed_by, new.plan_dates_confirmed_at)
       is distinct from (old.plan_dates_status, old.plan_dates_confirmed_by, old.plan_dates_confirmed_at) then
    raise exception 'Status dat planu zmienia wyłącznie potwierdzenie KSH („Potwierdź daty”)';
  end if;

  if new.status = 'CANCELLED' and old.status is distinct from 'CANCELLED' then
    v_ctx := coalesce(current_setting('tower.cancel_ctx', true), '');
    if v_ctx = 'IMPORT' then
      if exists (select 1 from invoice_lines where load_id = old.id) then
        raise exception 'Import nie anuluje transportu na fakturze (%)', coalesce(old.order_no, left(old.id::text, 8));
      end if;
      if old.status not in ('PLANNED','RESOURCES_PENDING','DOCS_PENDING','READY') then
        raise exception 'Import nie anuluje transportu w statusie % — od AT_LOADING wyłącznie HHL ręcznie, z powodem', old.status;
      end if;
    elsif v_ctx = 'MANUAL' then
      null;
    elsif auth.uid() is not null then
      raise exception 'Anulować transport może wyłącznie HHL — przez cancel_load() z powodem albo import harmonogramu';
    end if;
  end if;

  if new.status = 'UNLOADED' and new.actual_delivery_at is null then
    raise exception 'Status UNLOADED wymaga daty rozładunku — to data realizacji usługi';
  end if;

  if new.actual_delivery_at is distinct from old.actual_delivery_at then
    if auth.uid() is not null and is_hhl() is not true
       and exists (select 1 from invoice_lines where load_id = old.id) then
      raise exception 'Data rozładunku transportu na fakturze jest zamrożona — zmiana wyłącznie przez HHL';
    end if;
    insert into audit_log (user_id, action, entity, entity_id, old_value, new_value)
    values ((select id from app_users where auth_id = auth.uid()),
            'LOAD_DELIVERY_DATE_CHANGE', 'loads', old.id::text,
            jsonb_build_object('actual_delivery_at', old.actual_delivery_at),
            jsonb_build_object('actual_delivery_at', new.actual_delivery_at));
  end if;

  -- Automat / migracja (bez JWT) — bez dalszych ograniczeń roli.
  if auth.uid() is null then return new; end if;

  -- A5: sesja użytkownika — load_status_set (status_ctx) albo automat/anulowanie (cancel_ctx).
  v_ctx := coalesce(current_setting('tower.cancel_ctx', true), '');
  if (
    (new.status is distinct from old.status or new.actual_delivery_at is distinct from old.actual_delivery_at)
    and current_setting('tower.status_ctx', true) is distinct from 'on'
    and v_ctx not in ('MANUAL', 'IMPORT')
  ) then
    raise exception 'Status i datę rozładunku zmienia wyłącznie load_status_set albo automat'
      using errcode = '42501';
  end if;

  select coalesce(array_agg(n.key), '{}') into v_changed
    from jsonb_each(to_jsonb(new)) n
   where n.value is distinct from (to_jsonb(old) -> n.key);

  if is_hhl() is true then
    if new.carrier_order_no is distinct from old.carrier_order_no then
      raise exception 'Numer zlecenia przewoźnika wpisuje wyłącznie przewoźnik';
    end if;
    if (
      (new.plan_load_date, new.plan_load_from, new.plan_load_to,
       new.plan_delivery_date, new.plan_delivery_from, new.plan_delivery_to)
      is not distinct from
      (old.plan_load_date, old.plan_load_from, old.plan_load_to,
       old.plan_delivery_date, old.plan_delivery_from, old.plan_delivery_to)
      or current_setting('tower.import_ctx', true) = 'on'
    ) is not true then
      raise exception 'Daty i godziny załadunku i rozładunku zmienia wyłącznie KSH Użytkownik (G-20)'
        using errcode = '42501';
    end if;
    return new;
  end if;

  if (current_org_kind() = 'CARRIER' and old.carrier_org_id = current_org_id()) is true then
    select coalesce(array_agg(c), '{}') into v_bad from unnest(v_changed) c where c <> all (v_carrier);
    if cardinality(v_bad) > 0 then
      raise exception 'Przewoźnik nie może zmieniać: %', array_to_string(v_bad, ', ');
    end if;
    if new.status is distinct from old.status then
      if new.status = 'CANCELLED' then
        raise exception 'Anulować transport może wyłącznie HHL';
      end if;
      if old.status <> 'CANCELLED' and new.status < old.status then
        raise exception 'Status nie może się cofnąć: % → %', old.status, new.status;
      end if;
    end if;
    if new.sailing_id is distinct from old.sailing_id and old.status >= 'FERRY' then
      raise exception 'Zmiana rejsu po wypłynięciu — wyłącznie HHL';
    end if;
    return new;
  end if;

  raise exception 'Brak uprawnień do zmiany transportu';
end $$;

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


create or replace function public.telm_infer_phase_from_position(
  p_load uuid, p_lat float8, p_lon float8, p_ts timestamptz default now()
) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_status load_status;
  v_phase text;
  v_ok boolean := false;
  v_ts timestamptz := coalesce(p_ts, now());
  v_gid uuid;
  v_tracker text;
  v_plate text;
begin
  if public.load_in_tracking_window(p_load, v_ts) is not true then
    return null;
  end if;
  if p_load is null or p_lat is null or p_lon is null then return null; end if;
  select status, rio_tracker_on, coalesce(nullif(btrim(trailer_plate), ''), nullif(btrim(tractor_plate), ''))
    into v_status, v_tracker, v_plate
    from loads where id = p_load;
  if v_status is null or v_status in (
    'CANCELLED', 'UNLOADED', 'DELIVERED', 'AT_SITE',
    'IN_TRANSIT_SE', 'AT_PORT_NYNASHAMN', 'FERRY'
  ) then
    return null;
  end if;

  /* B10: tylko Droga PL / Droga SE — bez prostokąta FERRY (D-0300 B10) */
  if p_lat >= 55.0 and p_lon >= 11.0 and p_lon <= 25.0 and p_lat <= 70.0 then
    v_phase := 'IN_TRANSIT_SE';
  elsif p_lat >= 49.0 and p_lat < 55.0 and p_lon >= 14.0 and p_lon <= 25.0 then
    v_phase := 'IN_TRANSIT_PL';
  else
    return null;
  end if;

  insert into telm_attach_phase (load_id, phase, observed_at, lat, lon)
  values (p_load, v_phase, v_ts, p_lat, p_lon)
  on conflict (load_id) do nothing;

  select id into v_gid from geofences
   where kind = 'LOADING' and active
   order by sort_order nulls last, name
   limit 1;
  insert into load_events (load_id, event_type, occurred_at, payload, dedup_key)
  values (
    p_load, 'GEOFENCE_EXIT', v_ts,
    jsonb_build_object(
      'geofence_id', v_gid,
      'geofence_kind', 'LOADING',
      'synthetic', true,
      'zrodlo', 'TELM_PHASE_INFER',
      'powod', 'faza z pozycji przy podłączeniu',
      'actual_load', false
    ),
    'TELM_PHASE_EXIT_LOAD:' || p_load::text
  )
  on conflict (dedup_key) where dedup_key is not null do nothing;

  v_ok := auto_set_status(
    p_load, v_status, v_phase::load_status,
    'faza z pozycji przy podłączeniu',
    v_ts,
    jsonb_build_object(
      'zrodlo', 'TELM_PHASE_INFER',
      'lat', p_lat, 'lon', p_lon,
      'powod', 'faza z pozycji przy podłączeniu',
      'tracker_on', v_tracker,
      'trackerPlate', v_plate
    )
  );

  insert into load_events (load_id, event_type, occurred_at, payload, dedup_key)
  values (
    p_load, 'STATUS_AUTO', v_ts,
    jsonb_build_object(
      'from', v_status,
      'to', case when v_ok then v_phase else v_status::text end,
      'target_phase', v_phase,
      'status_applied', v_ok,
      'powod', 'faza z pozycji przy podłączeniu',
      'zrodlo', 'TELM_PHASE_INFER',
      'lat', p_lat, 'lon', p_lon,
      'tracker_on', v_tracker,
      'trackerPlate', v_plate
    ),
    'TELM_PHASE_INFER:' || p_load::text || ':' || v_phase
  )
  on conflict (dedup_key) where dedup_key is not null do nothing;

  begin
    perform public.refresh_load_eta(p_load);
  exception when others then
    null;
  end;

  return v_phase;
end $$;


revoke all on function public.telm_infer_phase_from_position(uuid, float8, float8, timestamptz) from public, anon, authenticated;
grant execute on function public.telm_infer_phase_from_position(uuid, float8, float8, timestamptz) to service_role;

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
  v_connected boolean;
  v_moving boolean;
begin
  perform l1b_scan();
  perform dwell_scan(null, now());
  v_min := l3_ops('SILENT_MIN')::int;
  if v_min is null then
    return 0;
  end if;
  -- A1: cisza transportu, który wyszedł z okna (np. „Dostarczone”), ma się zamknąć.
  for r in
    select s.id, s.dedup_key
      from risk_signals s
      join loads l on s.dedup_key = 'SILENT:' || l.id::text
     where s.resolved_at is null
       and s.detail->>'l3' = '1'
       and public.load_in_tracking_window(l.id, now()) is not true
  loop
    update risk_signals set resolved_at = now() where id = r.id;
    perform l3_lapse(r.dedup_key, now());
  end loop;
  for r in
    select l.id, l.project_id, l.tractor_plate, l.status, l.telematics_vehicle_id,
           max(p.ts) as last_fix
      from loads l
      left join positions p on p.load_id = l.id
     group by l.id
    having public.load_in_tracking_window(l.id, now())
  loop
    v_moving := r.status in ('IN_TRANSIT_PL', 'AT_PORT_GDANSK', 'AT_PORT_NYNASHAMN', 'IN_TRANSIT_SE');
    v_connected := r.telematics_vehicle_id is not null or exists (
      select 1 from positions p where p.load_id = r.id
    );
    if l3_silent_alarm(r.last_fix, now(), v_connected, v_moving) is not true then
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
        'last_fix', r.last_fix, 'threshold_min', v_min,
        'params', jsonb_build_object('plate', coalesce(r.tractor_plate, '?'), 'minutes', v_min)
      ),
      now()
    );
  end loop;
  return n;
end $$;


revoke all on function public.detect_silent_vehicles(integer) from public, anon, authenticated;

insert into decision_types (code, title_key, decider_role, options, due_hours, due_note, severity_default, sort_order)
values (
  'DELIVERY_UNCONFIRMED',
  'dec_type_DELIVERY_UNCONFIRMED',
  'CARRIER',
  '[{"code":"MANUAL_STATUS","label_key":"dec_opt_MANUAL_STATUS","requires_comment":false,"effect":"ACCEPT"},{"code":"STILL_EN_ROUTE","label_key":"dec_opt_STILL_EN_ROUTE","requires_comment":true,"effect":"HOLD"}]'::jsonb,
  24,
  '24 h od końca dnia planowanej dostawy (czas polski)',
  'WARNING',
  40
)
on conflict (code) do nothing;

create or replace function public.loads_close_delivery_unconfirmed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status in ('DELIVERED', 'UNLOADED', 'READY_TO_INVOICE', 'INVOICED') then
    update decisions
       set status = 'RESOLVED',
           resolved_at = now(),
           resolution_code = 'DELIVERED',
           updated_at = now()
     where load_id = new.id
       and type_code = 'DELIVERY_UNCONFIRMED'
       and status in ('NEW', 'ASSIGNED', 'SNOOZED');
  end if;
  return new;
end $$;

drop trigger if exists loads_close_delivery_unconfirmed on public.loads;
create trigger loads_close_delivery_unconfirmed
  after update of status on public.loads
  for each row
  execute function public.loads_close_delivery_unconfirmed();

revoke all on function public.loads_close_delivery_unconfirmed() from public, anon, authenticated;

create or replace function public.tracking_delivery_guard()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n int := 0;
  r record;
  d record;
  v_due timestamptz;
  v_lat float8;
  v_lon float8;
  v_fix timestamptz;
  v_place text;
  v_when text;
  v_title text;
  v_backlog int := 0;
begin
  for r in
    select id, project_id, order_no, plan_delivery_date
      from loads
     where plan_delivery_date is not null
       and public.load_in_tracking_window(id, now())
  loop
    -- Koniec dnia dostawy (00:00 dnia następnego, czas polski) + 24 h.
    -- Plan 09.10 → sprawa od 11.10 00:00.
    v_due := (((r.plan_delivery_date + 1)::timestamp) at time zone 'Europe/Warsaw') + interval '24 hours';
    if (now() >= v_due) is not true then
      continue;
    end if;
    d := null;
    select id, status, resolution_code, resolved_at
      into d
      from decisions
     where load_id = r.id and type_code = 'DELIVERY_UNCONFIRMED'
     order by created_at desc
     limit 1;
    if found and d.status in ('NEW', 'ASSIGNED', 'SNOOZED') then
      continue;
    end if;
    if found and d.status = 'RESOLVED' and d.resolution_code in ('STILL_EN_ROUTE', 'MANUAL_STATUS') then
      if d.resolved_at > now() - interval '24 hours' then
        continue;
      end if;
      update decisions
         set status = 'NEW',
             resolved_at = null,
             resolved_by = null,
             resolution_code = null,
             resolution_note = null,
             due_at = now() + interval '24 hours',
             updated_at = now()
       where id = d.id;
      n := n + 1;
      continue;
    end if;
    if found then
      continue;
    end if;
    v_lat := null; v_lon := null; v_fix := null; v_place := null;
    select st_y(geom_raw::geometry), st_x(geom_raw::geometry), ts
      into v_lat, v_lon, v_fix
      from positions
     where load_id = r.id
     order by ts desc
     limit 1;
    if v_fix is not null then
      select g.name into v_place
        from geofences g
       where g.project_id = r.project_id
         and g.active
         and st_contains(g.geom, (select geom_raw from positions where load_id = r.id order by ts desc limit 1))
       limit 1;
      if v_place is null then
        v_place := 'pozycja ' || trim(to_char(v_lat, '990.00')) || ', ' || trim(to_char(v_lon, '990.00'));
      end if;
      v_when := 'ostatnia pozycja ' || to_char(v_fix at time zone 'Europe/Warsaw', 'DD.MM.YYYY, HH24:MI') || ', ' || v_place;
    else
      v_when := 'brak pozycji';
    end if;
    v_title := public.load_sms_code(r.id) || ': brak „Dostarczone” dobę po planowanej dostawie '
      || to_char(r.plan_delivery_date, 'DD.MM.YYYY') || ' · ' || v_when;
    -- Zaległość: planowana dostawa minęła przed wdrożeniem A1 — sprawa bez dzwonka i telefonu.
    if r.plan_delivery_date < coalesce(
         (select label::timestamptz at time zone 'Europe/Warsaw' from app_parameters where key = 'A1_DEPLOYED_AT')::date,
         (now() at time zone 'Europe/Warsaw')::date
       ) then
      insert into decisions (project_id, type_code, title, detail, load_id, due_at)
      values (
        r.project_id,
        'DELIVERY_UNCONFIRMED',
        v_title,
        jsonb_build_object(
          'zrodlo', 'L17', 'event_key', 'L17:' || r.id::text, 'opened_by', 'L17-zaleglosc',
          'last_lat', v_lat, 'last_lon', v_lon, 'last_fix', v_fix,
          'plan_delivery_date', r.plan_delivery_date
        ),
        r.id,
        now() + interval '24 hours'
      );
      insert into decision_events (decision_id, actor_id, action, payload)
      select id, null, 'OPEN', jsonb_build_object('type', 'DELIVERY_UNCONFIRMED', 'event_key', 'L17:' || r.id::text, 'silent', true)
        from decisions
       where load_id = r.id and type_code = 'DELIVERY_UNCONFIRMED'
       order by created_at desc
       limit 1;
      n := n + 1;
      v_backlog := v_backlog + 1;
      continue;
    end if;
    perform decision_open_from_event(
      r.project_id,
      'DELIVERY_UNCONFIRMED',
      'L17:' || r.id::text,
      v_title,
      jsonb_build_object(
        'zrodlo', 'L17',
        'last_lat', v_lat,
        'last_lon', v_lon,
        'last_fix', v_fix,
        'plan_delivery_date', r.plan_delivery_date
      ),
      r.id,
      null
    );
    n := n + 1;
  end loop;
  if v_backlog > 0 then
    insert into notifications (channel, recipient, user_id, template, payload, dedup_key)
    select 'IN_APP', coalesce(u.email::text, u.id::text), u.id, 'L17_BACKLOG',
           jsonb_build_object(
             'title', 'Potwierdź dostawę: ' || v_backlog || ' transportów bez „Dostarczone” po planowanej dostawie — lista w „Do zrobienia”',
             'n', v_backlog
           ),
           'L17_BACKLOG:' || u.id::text
      from app_users u
     where u.active and u.role = 'HHL_ADMIN'
    on conflict (dedup_key) where dedup_key is not null do nothing;
  end if;
  return n;
end $$;

insert into app_parameters (key, value, label, source)
values ('A1_DEPLOYED_AT', 0, now()::text, 'A1: zaległości L17 sprzed tej chwili bez powiadomień')
on conflict (key) do nothing;

revoke all on function public.tracking_delivery_guard() from public, anon, authenticated;
grant execute on function public.tracking_delivery_guard() to service_role;

do $m$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'tower-tracking-guard';
    perform cron.schedule('tower-tracking-guard', '15 6 * * *', 'select public.tracking_delivery_guard()');
  else
    raise notice '0227: pg_cron niedostępne — cron L17 do zaplanowania ręcznie';
  end if;
end
$m$;
