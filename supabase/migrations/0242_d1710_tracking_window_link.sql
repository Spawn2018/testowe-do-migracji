-- D-1710 / #368 (D-20261020-1710-01 + 1959/2001): okno śledzenia tylko po starcie;
-- śledzenie i lokalizacja tylko przy niepustym telematics_vehicle_id (SG-15/16/17).
-- Scalenie przed #370 (D-1501 → migracja 0243 po rebase).

-- -------------------------------------------------------------------------
-- 1) positions / load_events: odłączenie bez DELETE (load_id nullable)
-- -------------------------------------------------------------------------
alter table public.positions alter column load_id drop not null;
alter table public.load_events alter column load_id drop not null;

comment on column public.positions.load_id is
  'D-1710: null = pozycja odłączona od transportu (bez usuwania), np. śledzenie bez linku / przed oknem.';
comment on column public.load_events.load_id is
  'D-1710: null = zdarzenie odłączone od transportu (bez usuwania).';

-- -------------------------------------------------------------------------
-- 2) Okno śledzenia: wymaga linku
-- -------------------------------------------------------------------------
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
  v_link text;
  v_ts timestamptz := coalesce(p_ts, now());
begin
  if p_load is null then
    return false;
  end if;
  select status::text, plan_load_date, tracking_opened_at, telematics_vehicle_id
    into v_status, v_day, v_opened, v_link
    from loads
   where id = p_load;
  if v_status is null then
    return false;
  end if;
  -- Decyzja właściciela 20.10 20:01: bez linku okno zamknięte.
  if nullif(btrim(v_link), '') is null then
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

revoke all on function public.load_in_tracking_window(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.load_in_tracking_window(uuid, timestamptz) to service_role;

-- -------------------------------------------------------------------------
-- 3) Zamrożenie okna tylko po starcie; usunięcie linku zamyka
-- -------------------------------------------------------------------------
create or replace function public.loads_freeze_tracking_open()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Usunięcie / brak linku → okno zamknięte.
  if nullif(btrim(new.telematics_vehicle_id), '') is null then
    new.tracking_opened_at := null;
    return new;
  end if;

  -- Transport już ruszył: zamroź pierwotne 03:00 (A1).
  if new.actual_load_at is not null
     or new.status >= 'AT_LOADING' then
    if new.tracking_opened_at is null
       and old.plan_load_date is not null
       and now() >= public.tracking_window_start(old.plan_load_date) then
      new.tracking_opened_at := public.tracking_window_start(old.plan_load_date);
    end if;
  else
    -- Przygotowanie: przesunięcie daty czyści zamrożenie; okno od nowej daty.
    if new.plan_load_date is distinct from old.plan_load_date then
      new.tracking_opened_at := null;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists loads_freeze_tracking_open on public.loads;
create trigger loads_freeze_tracking_open
  before update of plan_load_date, telematics_vehicle_id on public.loads
  for each row
  execute function public.loads_freeze_tracking_open();

revoke all on function public.loads_freeze_tracking_open() from public, anon, authenticated;

-- -------------------------------------------------------------------------
-- 4) apply_geofence_status — EXIT LOADING tylko po ENTER
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
  v_route   text;
  v_op      text;
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
  select g.kind, g.country, g.name, g.route into v_kind, v_country, v_name, v_route
    from geofences g where g.id = v_gid;
  if v_kind is null then return null; end if;
  v_op := 'POLFERRIES';
  select case when s.route in ('GDY-KAA','KAA-GDY') then 'STENA' else 'POLFERRIES' end
    into v_op from loads l left join sailings s on s.id = l.sailing_id
   where l.id = new.load_id;
  v_op := coalesce(v_op, 'POLFERRIES');

  -- Syntetyczne wyjścia TELM (faza z pozycji) nie ustawiają actual_* (A2 / 0227).
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

    if v_kind = 'LOADING' then
      if v_status = 'READY' then
        perform auto_set_status(new.load_id, v_status, 'AT_LOADING', 'wjazd w strefę załadunku', new.occurred_at, v_detail);
      elsif v_status in ('PLANNED','RESOURCES_PENDING','DOCS_PENDING') then
        perform raise_risk(new.load_id, 'AUTO_STATUS', 'HIGH',
          format('Pojazd w strefie załadunku, a transport niegotowy (status %s)', v_status),
          v_detail || jsonb_build_object('title_key', 'rk_loading_not_ready', 'params', jsonb_build_object('status', v_status)),
          'LOADING_NOT_READY:' || new.load_id);
      end if;

    elsif v_kind = 'PORT_OUT' and v_status in ('READY','AT_LOADING','IN_TRANSIT_PL')
          and coalesce(v_route, 'POLFERRIES') = v_op then
      if auto_set_status(new.load_id, v_status, 'AT_PORT_GDANSK',
           format('wjazd w strefę portu PL (%s)', coalesce(v_name, v_op)),
           new.occurred_at, v_detail)
         and loaded_confirmed(new.load_id) is not true then
        perform raise_risk(new.load_id, 'LOADING_UNCONFIRMED', 'MEDIUM',
          format('Pojazd w porcie PL (%s) bez potwierdzenia załadunku', coalesce(v_name, v_op)),
          v_detail || jsonb_build_object('title_key', 'rk_port_no_loaded', 'params', '{}'::jsonb), 'PORT_NO_LOADED:' || new.load_id);
      end if;

    elsif v_kind = 'PORT_IN' and v_status = 'FERRY'
          and coalesce(v_route, 'POLFERRIES') = v_op then
      perform auto_set_status(new.load_id, v_status, 'AT_PORT_NYNASHAMN',
        format('wjazd w strefę portu SE (%s)', coalesce(v_name, v_op)),
        new.occurred_at, v_detail);

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
      -- D-1710: EXIT LOADING wymaga wczesniejszego ENTER.
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

-- -------------------------------------------------------------------------
-- 5) compute_load_eta — EXIT LOADING tylko od startu okna
-- -------------------------------------------------------------------------
create or replace function public.compute_load_eta(p_load uuid, p_now timestamp with time zone DEFAULT now())
 returns table(eta timestamp with time zone, conf_min integer, basis jsonb)
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  l          record;
  v_sail     record;
  p          record;
  h_pl       numeric; sp_pl numeric;
  h_ci       numeric;
  h_cross    numeric; sp_cross numeric;
  h_se       numeric;
  fresh_h    numeric;
  v_status   load_status;
  v_eta      timestamptz;
  v_var      numeric := 0;
  v_sum      numeric := 0;
  v_comp     jsonb := '[]'::jsonb;
  h_road numeric; sp_road numeric; h_rest numeric; sp_rest numeric; h_brk numeric; sp_brk numeric;
  h_road_eff numeric;
  v_slow     numeric := 1.00;
  v_slow_reason text;
  v_segs     jsonb := '[]'::jsonb;
  v_flags    text[] := '{}';
  v_seg      text;
  v_start    timestamptz;
  v_frac     numeric;
  v_rem      numeric;
  v_dep      timestamptz;
  v_arr      timestamptz;
  v_sail_src text := null;
  v_has      boolean := false;
  g_load geometry; g_pout geometry; g_pin geometry; g_site geometry;
  cp record;
  v_attr text := '© OpenStreetMap contributors';
  v_progress text := 'status';
  v_off numeric;
  v_rem_km numeric;
  v_causes jsonb := '{}'::jsonb;
  v_drive_h numeric := 0;
  v_checkin_h numeric := 0;
  v_rest_h numeric := 0;
  st record;
  sch record;
  v_drive_need numeric;
  v_break_h numeric := 0;
  v_weather_pct numeric := 0;
  v_fresh boolean := false;
  v_alat double precision;
  v_alon double precision;
  v_sog real;
  v_obs timestamptz;
  v_sea_h numeric;
  v_left boolean := false;
  v_h4_rest_spread numeric := 0;
  v_op text;
begin
  select * into l from loads where id = p_load;
  if not found then return; end if;
  v_status := l.status;
  v_op := 'POLFERRIES';
  if l.sailing_id is not null then
    select case when sa.route in ('GDY-KAA','KAA-GDY') then 'STENA' else 'POLFERRIES' end
      into v_op from sailings sa where sa.id = l.sailing_id;
    v_op := coalesce(v_op, 'POLFERRIES');
  end if;

  select hours, spread_pct / 100 into h_pl, sp_pl from eta_segment_params where code = 'PL_ROAD';
  select hours into h_ci from eta_segment_params where code = 'PORT_CHECKIN';
  select hours, spread_pct / 100 into h_cross, sp_cross from eta_segment_params where code = 'CROSSING_DEFAULT';
  select hours, spread_pct / 100 into h_road, sp_road from eta_segment_params where code = 'SE_ROAD';
  select hours, spread_pct / 100 into h_rest, sp_rest from eta_segment_params where code = 'SE_DAILY_REST';
  select hours, spread_pct / 100 into h_brk, sp_brk from eta_segment_params where code = 'SE_BREAKS';
  h_road := coalesce(h_road, 17); sp_road := coalesce(sp_road, 0.2);
  h_rest := coalesce(h_rest, 11); sp_rest := coalesce(sp_rest, 0);
  h_brk := coalesce(h_brk, 2); sp_brk := coalesce(sp_brk, 0.5);
  select hours into fresh_h from eta_segment_params where code = 'GPS_FRESH_MIN';
  h_pl := coalesce(h_pl, 4.5); sp_pl := coalesce(sp_pl, 0.2); h_ci := coalesce(h_ci, 2);
  h_cross := coalesce(h_cross, 18); sp_cross := coalesce(sp_cross, 0.15);
  fresh_h := coalesce(fresh_h, 1.5);

  -- A5 F7: droga SE według trasy rejsu (geofences.route PORT_IN).
  -- Źródło SE_ROAD_KAA: 0160 FERRY-STATUS — Karlskrona → E22 → E4 → Boden = 21,5 h
  -- (dłużej niż SE_ROAD Nynäshamn–Boden = 17 h). PL: PL_ROAD_GDY = 8,2 h.
  if v_op = 'STENA' then
    select hours, spread_pct / 100 into h_road, sp_road from eta_segment_params where code = 'SE_ROAD_KAA';
    h_road := coalesce(h_road, 21.5); sp_road := coalesce(sp_road, 0.2);
    select hours, spread_pct / 100 into h_pl, sp_pl from eta_segment_params where code = 'PL_ROAD_GDY';
    h_pl := coalesce(h_pl, 8.2); sp_pl := coalesce(sp_pl, 0.25);
  end if;

  select slowdown_mult, reason into v_slow, v_slow_reason
    from corridor_conditions
   where corridor = case when v_op = 'STENA' then 'SE_E22' else 'SE_E4' end;
  v_slow := coalesce(v_slow, 1.00);
  if v_slow > 1.00 then
    v_weather_pct := round((v_slow - 1) * 100);
    v_flags := array_append(v_flags, format('spowolnienie SE ×%s (%s)', v_slow, coalesce(v_slow_reason, 'II-6')));
  end if;
  h_road_eff := h_road * v_slow;
  h_se := h_road_eff + h_rest + h_brk;

  -- H-4: stan kierowcy z GPS (bez tachografu); flagi dołączamy na końcu, po fladze korytarza
  select * into st from h4_driver_state_from_gps(p_load, p_now);
  -- H-4: odpoczynek/przerwy szacowane z GPS → niepewność NIE może być 0%.
  -- Pasmo obejmuje earlier/later; przy ostrożnym większy rozrzut (Wysoka niedostępna).
  if coalesce(st.cautious, false) then
    v_h4_rest_spread := 0.25;  -- 25% × rest_h (+ dolne H4_CAUTIOUS poniżej)
  else
    v_h4_rest_spread := 0.15;  -- 15% gdy last_rest znany z GPS/prom
  end if;


  select attribution into v_attr from corridor_polylines where code = 'PL_ROAD' limit 1;
  v_attr := coalesce(v_attr, '© OpenStreetMap contributors');

  select st_centroid(geom) into g_load from geofences where project_id = l.project_id and kind = 'LOADING' and active order by sort_order limit 1;
  select st_centroid(geom) into g_pout from geofences
   where project_id = l.project_id and kind = 'PORT_OUT' and active
     and coalesce(route, 'POLFERRIES') = v_op
   order by sort_order limit 1;
  if g_pout is null then
    select st_centroid(geom) into g_pout from geofences
     where project_id = l.project_id and kind = 'PORT_OUT' and active
     order by sort_order limit 1;
  end if;
  select st_centroid(geom) into g_pin from geofences
   where project_id = l.project_id and kind = 'PORT_IN' and active
     and coalesce(route, 'POLFERRIES') = v_op
   order by sort_order limit 1;
  if g_pin is null then
    select st_centroid(geom) into g_pin from geofences
     where project_id = l.project_id and kind = 'PORT_IN' and active
     order by sort_order limit 1;
  end if;
  select st_centroid(geom) into g_site from geofences where project_id = l.project_id and kind = 'SITE' and active order by sort_order limit 1;
  v_left := v_status in ('IN_TRANSIT_PL','AT_PORT_GDANSK','FERRY','AT_PORT_NYNASHAMN','IN_TRANSIT_SE','AT_SITE','UNLOADED','DELIVERED')
    or exists (
      select 1 from load_events e
      where e.load_id = p_load
        and e.event_type = 'GEOFENCE_EXIT'
        and e.payload->>'geofence_kind' = 'LOADING'
        and l.plan_load_date is not null
        and e.occurred_at >= public.tracking_window_start(l.plan_load_date)
        and coalesce((e.payload->>'synthetic')::boolean, false) is not true
    );

  select ts, coalesce(geom_snapped, geom_raw) as g into p from positions where load_id = p_load order by ts desc limit 1;

  if v_status = 'CANCELLED' then
    return query select null::timestamptz, null::int, jsonb_build_object(
      'method','ETA v2 (OSM)','segment','CANCELLED','flags',jsonb_build_array('anulowany'),
      'attribution', v_attr, 'computed_at', p_now);
    return;
  end if;
  if v_status in ('UNLOADED','DELIVERED','READY_TO_INVOICE','INVOICED') then
    return query select coalesce(l.actual_delivery_at, p_now), 0, jsonb_build_object(
      'method','ETA v2 (OSM)','segment','DONE','flags',jsonb_build_array('rozładowany — data rozładunku'),
      'attribution', v_attr, 'computed_at', p_now);
    return;
  end if;
  if v_status = 'AT_SITE' then
    select max(occurred_at) into v_eta from load_events where load_id = p_load and payload->>'to' = 'AT_SITE';
    return query select coalesce(v_eta, p_now), 0, jsonb_build_object(
      'method','ETA v2 (OSM)','segment','AT_SITE','flags',jsonb_build_array('na placu budowy'),
      'attribution', v_attr, 'computed_at', p_now);
    return;
  end if;

  -- ETA tylko z pozycji (2026-10-04). Plan załadunku i założony rejs nie wypełniają eta_site.
  v_fresh := p.ts is not null and p.ts >= p_now - make_interval(mins => (fresh_h * 60)::int);

  if v_status = 'FERRY' then
    select vp.lat, vp.lon, vp.sog_kn, vp.observed_at
      into v_alat, v_alon, v_sog, v_obs
      from vessel_positions vp
      join sailings sa on sa.vessel_id = vp.vessel_id
     where sa.id = l.sailing_id
       and vp.observed_at >= p_now - make_interval(mins => (fresh_h * 60)::int)
     order by vp.observed_at desc
     limit 1;
    if v_obs is null or v_sog is null or v_sog <= 0 or g_pin is null then
      return query select null::timestamptz, null::int, jsonb_build_object(
        'method','ETA v2 (OSM)','segment','FERRY',
        'flags', jsonb_build_array('na promie — ETA czeka na pozycję AIS'),
        'ferry_eta','waits_for_ais','wait_ais', true, 'ferry_eta_at', null, 'plan_eta', false,
        'attribution', v_attr, 'computed_at', p_now);
      return;
    end if;
    v_sea_h := st_distance(
      st_setsrid(st_makepoint(v_alon, v_alat), 4326)::geography,
      g_pin::geography) / (v_sog * 1852.0);
    v_eta := p_now + make_interval(secs => ((v_sea_h + h_se) * 3600)::int);
    return query select v_eta, greatest(1, round(v_sea_h * 60 * 0.15))::int, jsonb_build_object(
      'method','ETA v2 (OSM)','segment','FERRY',
      'flags', jsonb_build_array('pozycja AIS promu'),
      'ferry_eta','ais','wait_ais', false,
      'ferry_eta_at', (p_now + make_interval(secs => (v_sea_h * 3600)::int)),
      'plan_eta', false, 'sailing', null,
      'attribution', v_attr, 'computed_at', p_now, 'port_route', v_op);
    return;
  end if;

  if v_status in ('AT_PORT_NYNASHAMN','IN_TRANSIT_SE') then
    if v_fresh is not true then
      return query select null::timestamptz, null::int, jsonb_build_object(
        'method','ETA v2 (OSM)','segment', v_status::text,
        'flags', jsonb_build_array('brak pozycji GPS'),
        'plan_eta', false, 'attribution', v_attr, 'computed_at', p_now);
      return;
    end if;
  else
    if (v_left) is not true then
      if v_fresh is not true then
        return query select null::timestamptz, null::int, jsonb_build_object(
          'method','ETA v2 (OSM)','segment', v_status::text,
          'flags', jsonb_build_array('brak pozycji GPS'),
          'plan_eta', false, 'pre_load', true, 'attribution', v_attr, 'computed_at', p_now);
      else
        return query select null::timestamptz, null::int, jsonb_build_object(
          'method','ETA v2 (OSM)','segment', v_status::text,
          'flags', jsonb_build_array('pre_load'),
          'plan_eta', false, 'pre_load', true, 'attribution', v_attr, 'computed_at', p_now);
      end if;
      return;
    end if;
    if v_fresh is not true then
      return query select null::timestamptz, null::int, jsonb_build_object(
        'method','ETA v2 (OSM)','segment', v_status::text,
        'flags', jsonb_build_array('brak pozycji GPS'),
        'plan_eta', false, 'pre_load', false, 'attribution', v_attr, 'computed_at', p_now);
      return;
    end if;
  end if;

  -- 2) odcinek SE
  if v_status in ('AT_PORT_NYNASHAMN','IN_TRANSIT_SE') then
    v_frac := 1;
    if v_status = 'IN_TRANSIT_SE' then
      if p.ts is not null and p.ts >= p_now - make_interval(mins => (fresh_h * 60)::int) then
        select * into cp from corridor_progress(
          case when v_op = 'STENA' then 'SE_E22' else 'SE_E4' end, p.g);
        if found and cp.remaining_frac is not null then
          v_frac := cp.remaining_frac;
          v_off := cp.off_m;
          v_rem_km := cp.remaining_km;
          v_progress := 'corridor';
          v_flags := array_append(v_flags, 'pozycja GPS — postęp na korytarzu OSM'::text);
        elsif g_site is not null and g_pin is not null
           and st_distance(g_pin::geography, g_site::geography) > 0 then
          v_frac := least(1, greatest(0, st_distance(p.g::geography, g_site::geography) / st_distance(g_pin::geography, g_site::geography)));
          v_flags := array_append(v_flags, 'pozycja GPS — odległość do placu w linii prostej'::text);
        else
          v_frac := 0.5; v_var := v_var + (h_se * 60 * 0.25)^2; v_sum := v_sum + (h_se * 60 * 0.25);
          v_comp := v_comp || jsonb_build_object('code','SE_NO_GPS','min',round(h_se * 60 * 0.25));
          v_flags := array_append(v_flags, 'brak świeżej pozycji — połowa odcinka SE'::text);
        end if;
      else
        v_frac := 0.5; v_var := v_var + (h_se * 60 * 0.25)^2; v_sum := v_sum + (h_se * 60 * 0.25);
        v_comp := v_comp || jsonb_build_object('code','SE_NO_GPS','min',round(h_se * 60 * 0.25));
        v_flags := array_append(v_flags, 'brak świeżej pozycji — połowa odcinka SE'::text);
      end if;
    end if;
    -- H-4: jazda pozostała; odpoczynki/przerwy wg UE (nie proporcja do trasy)
    v_drive_need := h_road_eff * v_frac;
    select * into sch from h4_schedule_remaining(
      v_drive_need,
      coalesce(st.driven_today_h, 0),
      coalesce(st.extended_used, 0),
      coalesce(st.since_break_h, st.driven_today_h)
    );
    v_drive_h := sch.drive_h; v_rest_h := sch.rest_h; v_break_h := sch.break_h;
    v_rem := sch.total_h;
    v_eta := p_now + make_interval(secs => (v_rem * 3600)::int);
    if sch.flags is not null then v_flags := v_flags || sch.flags; end if;
    v_var := v_var + (sch.drive_h * 60 * sp_road)^2; v_sum := v_sum + (sch.drive_h * 60 * sp_road);
    v_comp := v_comp || jsonb_build_object('code','SE_ROAD','min',round(sch.drive_h * 60 * sp_road));
    v_var := v_var + (sch.break_h * 60 * sp_brk)^2; v_sum := v_sum + (sch.break_h * 60 * sp_brk);
    v_comp := v_comp || jsonb_build_object('code','SE_BREAKS','min',round(sch.break_h * 60 * sp_brk));
    -- H-4: niepewność odpoczynku > 0 (earlier/later); I-15 ±0% nie dotyczy rest z GPS
    v_var := v_var + (sch.rest_h * 60 * v_h4_rest_spread)^2; v_sum := v_sum + (sch.rest_h * 60 * v_h4_rest_spread);
    v_comp := v_comp || jsonb_build_object('code','H4_EU_REST','min',round(sch.rest_h * 60 * v_h4_rest_spread));
    v_segs := v_segs || jsonb_build_object('code','SE_ROAD','hours',round(sch.drive_h, 1),'spread_pct',round(sp_road * 100),'slowdown_mult',v_slow)
                     || jsonb_build_object('code','H4_EU_REST','hours',round(sch.rest_h, 1),'spread_pct',round(v_h4_rest_spread * 100))
                     || jsonb_build_object('code','H4_EU_BREAKS','hours',round(sch.break_h, 1),'spread_pct',round(sp_brk * 100))
                     || jsonb_build_object('code','H4_SEGMENTS','items',sch.segments);
    v_seg := v_status::text;
  else
    select coalesce(x.delayed_departure_at, x.departure_at) as dep, coalesce(x.delayed_arrival_at, x.arrival_at) as arr,
           x.status, x.id, (x.delayed_departure_at is not null or x.status = 'OPOZNIONY') as delayed
      into v_sail from sailings x where x.id = l.sailing_id;
    v_has := found;
    if v_has and v_sail.status = 'ODWOLANY' then
      v_flags := array_append(v_flags, 'przypisany rejs odwołany'::text); v_has := false;
    elsif v_has and v_status < 'FERRY' and v_sail.dep < p_now then
      v_flags := array_append(v_flags, 'przypisany rejs odpłynął bez transportu'::text); v_has := false;
    end if;

    if v_status = 'FERRY' then
      if v_has then
        v_arr := v_sail.arr; v_sail_src := 'przypisany';
        v_var := v_var + (30)^2; v_sum := v_sum + (30); v_comp := v_comp || jsonb_build_object('code','SAILING','min',round(30));
        if v_sail.delayed then v_var := v_var + (60)^2; v_sum := v_sum + (60); v_comp := v_comp || jsonb_build_object('code','SAILING_DELAYED','min',round(60)); end if;
      else
        v_arr := p_now + make_interval(secs => (h_cross * 0.5 * 3600)::int);
        v_var := v_var + (h_cross * 60 * 0.5)^2; v_sum := v_sum + (h_cross * 60 * 0.5);
        v_comp := v_comp || jsonb_build_object('code','FERRY_NO_SAILING','min',round(h_cross * 60 * 0.5));
        v_flags := array_append(v_flags, 'na promie bez rejsu w rozkładzie — połowa przeprawy'::text);
      end if;
      v_seg := 'FERRY';
    else
      if (v_left) is true then
        v_start := p_now;
      else
        v_start := greatest(p_now, coalesce(l.plan_load_to, l.plan_load_from, (l.plan_load_date + time '12:00') at time zone 'Europe/Warsaw', p_now));
      end if;
      v_frac := case when v_status = 'AT_PORT_GDANSK' then 0 when v_status = 'IN_TRANSIT_PL' then 0.5 else 1 end;
      if v_status = 'IN_TRANSIT_PL' then
        if p.ts is not null and p.ts >= p_now - make_interval(mins => (fresh_h * 60)::int) then
          select * into cp from corridor_progress('PL_ROAD', p.g);
          if found and cp.remaining_frac is not null then
            v_frac := cp.remaining_frac;
            v_off := cp.off_m;
            v_rem_km := cp.remaining_km;
            v_progress := 'corridor';
            v_flags := array_append(v_flags, 'pozycja GPS — postęp na korytarzu OSM'::text);
          elsif g_pout is not null and g_load is not null
             and st_distance(g_load::geography, g_pout::geography) > 0 then
            v_frac := least(1, greatest(0, st_distance(p.g::geography, g_pout::geography) / st_distance(g_load::geography, g_pout::geography)));
            v_flags := array_append(v_flags, 'pozycja GPS — odległość do portu w linii prostej'::text);
          else
            v_flags := array_append(v_flags, 'brak świeżej pozycji — połowa odcinka PL'::text);
            v_var := v_var + (h_pl * 60 * 0.25)^2; v_sum := v_sum + (h_pl * 60 * 0.25);
            v_comp := v_comp || jsonb_build_object('code','PL_NO_GPS','min',round(h_pl * 60 * 0.25));
          end if;
        else
          v_flags := array_append(v_flags, 'brak świeżej pozycji — połowa odcinka PL'::text);
          v_var := v_var + (h_pl * 60 * 0.25)^2; v_sum := v_sum + (h_pl * 60 * 0.25);
          v_comp := v_comp || jsonb_build_object('code','PL_NO_GPS','min',round(h_pl * 60 * 0.25));
        end if;
      end if;
      if v_status < 'IN_TRANSIT_PL' and v_start > p_now then v_flags := array_append(v_flags, 'przed załadunkiem — start z planu załadunku'::text); end if;
      v_drive_h := round(h_pl * v_frac, 2);
      v_checkin_h := case when v_status = 'AT_PORT_GDANSK' then 0 else h_ci end;
      v_segs := v_segs || jsonb_build_object('code','PL_ROAD','hours',round(h_pl * v_frac, 1),'spread_pct',round(sp_pl * 100));
      v_start := v_start + make_interval(secs => ((h_pl * v_frac + v_checkin_h) * 3600)::int);
      if v_has then
        v_dep := v_sail.dep; v_arr := v_sail.arr; v_sail_src := 'przypisany';
        v_var := v_var + (30)^2; v_sum := v_sum + (30); v_comp := v_comp || jsonb_build_object('code','SAILING','min',round(30));
        if v_sail.delayed then v_var := v_var + (60)^2; v_sum := v_sum + (60); v_comp := v_comp || jsonb_build_object('code','SAILING_DELAYED','min',round(60)); end if;
        if v_start > v_dep then
          v_flags := array_append(v_flags, 'rejs zagrożony — dojazd i check-in po odejściu'::text);
          v_var := v_var + (12 * 60)^2; v_sum := v_sum + (12 * 60); v_comp := v_comp || jsonb_build_object('code','SAILING_AT_RISK','min',round(12 * 60));
        end if;
      else
        -- II-7 / STENA-3: najbliższy rejs GDN-NYN lub GDY-KAA
        select coalesce(x.delayed_departure_at, x.departure_at), coalesce(x.delayed_arrival_at, x.arrival_at)
          into v_dep, v_arr
          from sailings x
         where x.project_id = l.project_id
           and x.route in ('GDN-NYN', 'GDY-KAA') and x.status <> 'ODWOLANY'
           and coalesce(x.delayed_departure_at, x.departure_at) >= v_start
         order by coalesce(x.delayed_departure_at, x.departure_at) limit 1;
        if v_dep is not null then
          v_sail_src := 'założony (najbliższy w rozkładzie)';
          v_flags := array_append(v_flags, 'brak przypisanego rejsu — założony najbliższy z rozkładu'::text);
          v_var := v_var + (6 * 60)^2; v_sum := v_sum + (6 * 60); v_comp := v_comp || jsonb_build_object('code','SAILING_ASSUMED','min',round(6 * 60));
        else
          v_dep := v_start; v_arr := v_start + make_interval(secs => (h_cross * 3600)::int);
          v_flags := array_append(v_flags, 'brak rejsu w rozkładzie — przeprawa z założenia'::text);
          v_var := v_var + (12 * 60)^2; v_sum := v_sum + (12 * 60); v_comp := v_comp || jsonb_build_object('code','NO_SCHEDULE','min',round(12 * 60));
          v_var := v_var + (h_cross * 60 * sp_cross)^2; v_sum := v_sum + (h_cross * 60 * sp_cross);
          v_comp := v_comp || jsonb_build_object('code','CROSSING','min',round(h_cross * 60 * sp_cross));
        end if;
      end if;
      v_seg := v_status::text;
    end if;
    v_segs := v_segs || jsonb_build_object('code','CROSSING','departure',v_dep,'arrival',v_arr,'source',coalesce(v_sail_src,'założenie'));
    -- H-4 po promie: zegar od zera (D-9 odpoczynek na promie)
    select * into sch from h4_schedule_remaining(h_road_eff, 0, 0, 0);
    v_drive_h := coalesce(v_drive_h, 0) + sch.drive_h;
    v_rest_h := coalesce(v_rest_h, 0) + sch.rest_h;
    v_break_h := coalesce(v_break_h, 0) + sch.break_h;
    v_eta := v_arr + make_interval(secs => (sch.total_h * 3600)::int);
    v_flags := array_append(v_flags, 'H-4 po promie — odpoczynek D-9, zegar od zera'::text);
    if sch.flags is not null then v_flags := v_flags || sch.flags; end if;
    v_segs := v_segs || jsonb_build_object('code','SE_ROAD','hours',round(sch.drive_h, 1),'spread_pct',round(sp_road * 100),'slowdown_mult',v_slow)
                     || jsonb_build_object('code','H4_EU_REST','hours',round(sch.rest_h, 1),'spread_pct',round(v_h4_rest_spread * 100))
                     || jsonb_build_object('code','H4_EU_BREAKS','hours',round(sch.break_h, 1),'spread_pct',round(sp_brk * 100))
                     || jsonb_build_object('code','H4_SEGMENTS','items',sch.segments);
    v_var := v_var + (sch.drive_h * 60 * sp_road)^2; v_sum := v_sum + (sch.drive_h * 60 * sp_road);
    v_comp := v_comp || jsonb_build_object('code','SE_ROAD','min',round(sch.drive_h * 60 * sp_road));
    v_var := v_var + (sch.break_h * 60 * sp_brk)^2; v_sum := v_sum + (sch.break_h * 60 * sp_brk);
    v_comp := v_comp || jsonb_build_object('code','SE_BREAKS','min',round(sch.break_h * 60 * sp_brk));
    v_var := v_var + (sch.rest_h * 60 * v_h4_rest_spread)^2; v_sum := v_sum + (sch.rest_h * 60 * v_h4_rest_spread);
    v_comp := v_comp || jsonb_build_object('code','H4_EU_REST','min',round(sch.rest_h * 60 * v_h4_rest_spread));
    if v_status < 'FERRY' then
      v_var := v_var + (h_pl * 60 * sp_pl)^2; v_sum := v_sum + (h_pl * 60 * sp_pl);
      v_comp := v_comp || jsonb_build_object('code','PL_ROAD','min',round(h_pl * 60 * sp_pl));
    end if;
  end if;

  if st.flags is not null then
    v_flags := v_flags || st.flags;
  end if;
  if coalesce(st.cautious, false) then
    v_flags := array_append(v_flags, 'H-4 założenie ostrożne — czas pracy bez pełnej historii GPS'::text);
    -- „Wysoka” niedostępna przy braku historii odpoczynku (rozrzut > 60 min)
    v_var := v_var + (61)^2; v_sum := v_sum + 61;
    v_comp := v_comp || jsonb_build_object('code','H4_CAUTIOUS','min',61);
  end if;

  v_causes := jsonb_build_object(
    'drive_h', v_drive_h,
    'checkin_h', v_checkin_h,
    'rest_h', v_rest_h,
    'breaks_h', v_break_h,
    'weather_slowdown_pct', v_weather_pct,
    'progress', v_progress,
    'remaining_km', v_rem_km,
    'off_corridor_m', v_off,
    'h4', true,
    'h4_source', coalesce(st.source, 'n/a'),
    'h4_cautious', coalesce(st.cautious, false),
    'tachograph', 'none'
  );

  return query select v_eta, round(sqrt(v_var))::int, jsonb_build_object(
    'method', 'ETA v2 (OSM)', 'segment', v_seg, 'segments', v_segs,
    'band', jsonb_build_object('method', 'RSS', 'min', round(sqrt(v_var)), 'linear_sum_min', round(v_sum),
                               'components', (select coalesce(jsonb_agg(c), '[]'::jsonb) from jsonb_array_elements(v_comp) c where (c->>'min')::numeric > 0)),
    'flags', to_jsonb(v_flags), 'sailing', v_sail_src,
    'attribution', v_attr, 'causes', v_causes, 'computed_at', p_now);
end $function$;


revoke execute on function public.compute_load_eta(uuid, timestamptz) from public, anon, authenticated;

-- -------------------------------------------------------------------------
-- 6) Naprawa danych (bez DELETE, z historią)
-- -------------------------------------------------------------------------
do $fix$
declare
  v_n int;
  r record;
  v_note text;
  v_link text;
begin
  perform set_config('tower.bulk_quiet', 'on', true);
  perform set_config('tower.status_ctx', 'on', true);
  perform set_config('tower.track_ctx', 'on', true);
  perform set_config('tower.eta_ctx', 'on', true);

  with upd as (
    update public.loads l
       set tracking_opened_at = null,
           updated_at = now()
     where l.actual_load_at is null
       and l.status < 'AT_LOADING'
       and l.tracking_opened_at is not null
       and (
         nullif(btrim(l.telematics_vehicle_id), '') is null
         or (
           l.plan_load_date is not null
           and l.tracking_opened_at < public.tracking_window_start(l.plan_load_date)
         )
       )
    returning l.id
  )
  select count(*) into v_n from upd;
  insert into public.audit_log(user_id, action, entity, entity_id, new_value)
  values (null, 'D1710_CLEAR_TRACKING_OPEN', 'loads', null,
          jsonb_build_object('cleared', v_n, 'note', 'D-20261020-1710-01'));

  with bad as (
    select id from public.loads where nullif(btrim(telematics_vehicle_id), '') is null
  ), p as (
    update public.positions pos set load_id = null from bad b where pos.load_id = b.id
    returning pos.id
  )
  select count(*) into v_n from p;
  insert into public.audit_log(user_id, action, entity, entity_id, new_value)
  values (null, 'D1710_DETACH_POS_NO_LINK', 'positions', null,
          jsonb_build_object('detached', v_n, 'note', 'D-20261020-1959-01'));

  with bad as (
    select id from public.loads where nullif(btrim(telematics_vehicle_id), '') is null
  ), e as (
    update public.load_events ev set load_id = null from bad b
     where ev.load_id = b.id
       and ev.event_type in ('GEOFENCE_ENTER', 'GEOFENCE_EXIT', 'GEOFENCE_DWELL')
    returning ev.id
  )
  select count(*) into v_n from e;
  insert into public.audit_log(user_id, action, entity, entity_id, new_value)
  values (null, 'D1710_DETACH_GEOFENCE_NO_LINK', 'load_events', null,
          jsonb_build_object('detached', v_n, 'note', 'D-20261020-1959-01'));

  with early as (
    select l.id as load_id, public.tracking_window_start(l.plan_load_date) as win
      from public.loads l
     where l.actual_load_at is null and l.status < 'AT_LOADING' and l.plan_load_date is not null
  ), p as (
    update public.positions pos set load_id = null from early e
     where pos.load_id = e.load_id and pos.ts < e.win
    returning pos.id
  )
  select count(*) into v_n from p;
  insert into public.audit_log(user_id, action, entity, entity_id, new_value)
  values (null, 'D1710_DETACH_POS_BEFORE_WINDOW', 'positions', null,
          jsonb_build_object('detached', v_n, 'note', 'D-20261020-1710-01'));

  with early as (
    select l.id as load_id, public.tracking_window_start(l.plan_load_date) as win
      from public.loads l
     where l.actual_load_at is null and l.status < 'AT_LOADING' and l.plan_load_date is not null
  ), e as (
    update public.load_events ev set load_id = null from early x
     where ev.load_id = x.load_id
       and ev.event_type in ('GEOFENCE_ENTER', 'GEOFENCE_EXIT', 'GEOFENCE_DWELL')
       and ev.occurred_at < x.win
    returning ev.id
  )
  select count(*) into v_n from e;
  insert into public.audit_log(user_id, action, entity, entity_id, new_value)
  values (null, 'D1710_DETACH_GEOFENCE_BEFORE_WINDOW', 'load_events', null,
          jsonb_build_object('detached', v_n, 'note', 'D-20261020-1710-01'));

  for r in
    select l.id, l.telematics_vehicle_id
      from public.loads l
     where l.status = 'IN_TRANSIT_PL'
       and l.actual_load_at is null
       and (
         nullif(btrim(l.telematics_vehicle_id), '') is null
         or (
           l.plan_load_date is not null
           and l.plan_load_date > ((now() at time zone 'Europe/Warsaw')::date)
         )
       )
  loop
    v_note := case
      when nullif(btrim(r.telematics_vehicle_id), '') is null
        then 'Korekta: sledzenie bez linku (D-20261020-1959-01)'
      else 'Korekta: sledzenie otwarte przed dniem zaladunku (D-20261020-1710-01)'
    end;
    update public.loads
       set status = 'READY',
           tracking_opened_at = null,
           eta_site = null,
           eta_confidence_min = null,
           eta_basis = null,
           eta_computed_at = null,
           delay_minutes = null,
           updated_at = now()
     where id = r.id;
    insert into public.load_events (load_id, event_type, occurred_at, payload, dedup_key)
    values (
      r.id, 'STATUS_READY', now(),
      jsonb_build_object('from', 'IN_TRANSIT_PL', 'to', 'READY', 'note', v_note, 'manual', true, 'korekta', true),
      'D1710_READY:' || r.id::text
    )
    on conflict (dedup_key) where dedup_key is not null do nothing;
    insert into public.audit_log(user_id, action, entity, entity_id, new_value)
    values (null, 'LOAD_STATUS_SET', 'loads', r.id::text,
            jsonb_build_object('from', 'IN_TRANSIT_PL', 'to', 'READY', 'note', v_note, 'korekta', true));
  end loop;

  update public.risk_signals s
     set resolved_at = coalesce(s.resolved_at, now()),
         detail = coalesce(s.detail, '{}'::jsonb) || jsonb_build_object('korekta', 'D-1710')
   where s.resolved_at is null
     and s.load_id in (
       select id from public.loads
        where nullif(btrim(telematics_vehicle_id), '') is null
           or (
             actual_load_at is null and status <= 'READY'
             and plan_load_date is not null
             and plan_load_date > ((now() at time zone 'Europe/Warsaw')::date)
           )
     )
     and (
       s.kind in ('SILENT_VEHICLE', 'ETA_BREACH', 'AUTO_STATUS', 'ROAD_PL', 'ROAD_SE')
       or s.dedup_key like 'OFF_CORRIDOR:%'
       or coalesce(s.detail->>'title_key', '') in ('rk_off_corridor', 'rk_silent_vehicle')
     );

  update public.decisions d
     set status = 'RESOLVED',
         resolution_code = coalesce(d.resolution_code, 'MANUAL_STATUS'),
         resolved_at = coalesce(d.resolved_at, now())
   where d.status = 'NEW'
     and d.load_id in (
       select id from public.loads
        where nullif(btrim(telematics_vehicle_id), '') is null
           or (
             actual_load_at is null and status <= 'READY'
             and plan_load_date is not null
             and plan_load_date > ((now() at time zone 'Europe/Warsaw')::date)
           )
     );

  perform set_config('tower.bulk_quiet', 'off', true);
  perform set_config('tower.status_ctx', 'off', true);
  perform set_config('tower.track_ctx', 'off', true);
  perform set_config('tower.eta_ctx', 'off', true);
end
$fix$;