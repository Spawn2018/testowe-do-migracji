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
        and coalesce((e.payload->>'synthetic')::boolean, false) is not true
        -- D-1710 F7: EXIT LOADING tylko od startu okna (opened albo 03:00 dnia planu).
        and e.occurred_at >= coalesce(
              l.tracking_opened_at,
              case when l.plan_load_date is not null
                   then public.tracking_window_start(l.plan_load_date) end,
              '-infinity'::timestamptz)
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
-- 6) Kolumny odłączenia (RODO / śledzenie zmian)
-- -------------------------------------------------------------------------
alter table public.positions
  add column if not exists detached_load_id uuid,
  add column if not exists detached_at timestamptz;
alter table public.load_events
  add column if not exists detached_load_id uuid,
  add column if not exists detached_at timestamptz;

comment on column public.positions.detached_load_id is
  'D-1710: transport, z którego odłączono pozycję (load_id = null); retencja 30 dni.';
comment on column public.load_events.detached_load_id is
  'D-1710: transport, z którego odłączono zdarzenie (load_id = null).';

-- -------------------------------------------------------------------------
-- 7) telm_infer_phase_from_position — tylko po starcie (F7 #373 pkt 6)
-- -------------------------------------------------------------------------
create or replace function public.telm_infer_phase_from_position(
  p_load uuid, p_lat float8, p_lon float8, p_ts timestamptz default now()
) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_status load_status;
  v_actual timestamptz;
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
  select status, actual_load_at, rio_tracker_on,
         coalesce(nullif(btrim(trailer_plate), ''), nullif(btrim(tractor_plate), ''))
    into v_status, v_actual, v_tracker, v_plate
    from loads where id = p_load;
  -- D-1710: dla PLANNED…READY bez załadunku nie zmieniać statusu (fałszywe Droga PL).
  if v_actual is null and (v_status is null or v_status < 'AT_LOADING') then
    return null;
  end if;
  if v_status is null or v_status in (
    'CANCELLED', 'UNLOADED', 'DELIVERED', 'AT_SITE',
    'IN_TRANSIT_SE', 'AT_PORT_NYNASHAMN', 'FERRY'
  ) then
    return null;
  end if;

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

-- -------------------------------------------------------------------------
-- 8) guard_load_update — tracking_opened_at przy zmianie linku przez SCX (F7 pkt 8)
-- -------------------------------------------------------------------------
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
    'driver_phone_country',
    'driver_delivery_name','driver_delivery_phone','driver_delivery_phone_country',
    'tractor_delivery_plate','trailer_swap',
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

  if auth.uid() is null then return new; end if;

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
    if new.carrier_order_no is distinct from old.carrier_order_no
       and current_app_role() is distinct from 'HHL_ADMIN' then
      raise exception 'Numer zlecenia przewoźnika wpisuje wyłącznie przewoźnik';
    end if;
    if (
      (new.plan_load_date, new.plan_load_from, new.plan_load_to,
       new.plan_delivery_date, new.plan_delivery_from, new.plan_delivery_to)
      is not distinct from
      (old.plan_load_date, old.plan_load_from, old.plan_load_to,
       old.plan_delivery_date, old.plan_delivery_from, old.plan_delivery_to)
      or current_setting('tower.import_ctx', true) = 'on'
      or current_app_role() = 'HHL_ADMIN'
    ) is not true then
      raise exception 'Daty i godziny załadunku i rozładunku zmienia wyłącznie KSH Użytkownik (G-20)'
        using errcode = '42501';
    end if;
    return new;
  end if;

  if (current_org_kind() = 'CARRIER' and old.carrier_org_id = current_org_id()) is true then
    -- D-1710: freeze przy zmianie/usunięciu linku ustawia tracking_opened_at — nie blokuj SCX.
    select coalesce(array_agg(c), '{}') into v_bad
      from unnest(v_changed) c
     where c <> all (v_carrier)
       and c is distinct from 'tracking_opened_at';
    if cardinality(v_bad) > 0 then
      raise exception 'Przewoźnik nie może zmieniać: %', array_to_string(v_bad, ', ');
    end if;
    if new.status is distinct from old.status then
      if new.status = 'CANCELLED' then
        raise exception 'Anulować transport może wyłącznie HHL';
      end if;
      if old.status <> 'CANCELLED' and new.status < old.status then
        if current_setting('tower.invoice_edit', true) = 'on'
           and old.status = 'INVOICED'
           and new.status = 'READY_TO_INVOICE' then
          null;
        else
          raise exception 'Status nie może się cofnąć: % → %', old.status, new.status;
        end if;
      end if;
    end if;
    if new.sailing_id is distinct from old.sailing_id and old.status >= 'FERRY' then
      raise exception 'Zmiana rejsu po wypłynięciu — wyłącznie HHL';
    end if;
    return new;
  end if;

  raise exception 'Brak uprawnień do zmiany transportu';
end $$;

comment on function public.guard_load_update() is
  'D-1710 / 0242: SCX — tracking_opened_at przy linku; D-1525 trailer_swap/SE; HHL_ADMIN carrier_order_no.';

-- -------------------------------------------------------------------------
-- 9) tracking_delivery_guard — także bez linku (F7: L17 ≠ śledzenie)
-- -------------------------------------------------------------------------
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
       and status not in ('CANCELLED', 'DELIVERED', 'UNLOADED', 'READY_TO_INVOICE', 'INVOICED')
  loop
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

revoke all on function public.tracking_delivery_guard() from public, anon, authenticated;
grant execute on function public.tracking_delivery_guard() to service_role;

-- -------------------------------------------------------------------------
-- 10) report_position — bez linku odrzucane (F7)
-- -------------------------------------------------------------------------
create or replace function public.report_position(
  p_load_id uuid, p_lat double precision, p_lon double precision, p_ts timestamp with time zone,
  p_accuracy numeric DEFAULT NULL::numeric, p_speed numeric DEFAULT NULL::numeric,
  p_heading numeric DEFAULT NULL::numeric
)
returns table(event_type text, geofence_id uuid, geofence_name text)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_carrier uuid; v_link text;
begin
  select l.carrier_org_id, l.telematics_vehicle_id into v_carrier, v_link from loads l where l.id = p_load_id;
  if not found then raise exception 'Nieznany transport'; end if;
  if (is_hhl() or (current_org_kind() = 'CARRIER' and v_carrier = current_org_id())) is not true then
    raise exception 'Pozycję transportu zgłasza wyłącznie jego przewoźnik albo HHL';
  end if;
  if nullif(btrim(v_link), '') is null then
    raise exception 'Pozycja kierowcy wymaga linku śledzenia w awizacji';
  end if;
  if p_lat is null or p_lon is null or abs(p_lat) > 90 or abs(p_lon) > 180 then
    raise exception 'Niepoprawne współrzędne';
  end if;
  if p_ts is null or p_ts > now() + interval '5 minutes' then
    raise exception 'Czas pozycji z przyszłości';
  end if;
  if p_accuracy is not null and p_accuracy > 250 then return; end if;
  return query
    select r.event_type, r.geofence_id, r.geofence_name
      from process_position(p_load_id, p_lat, p_lon, p_ts, 'DRIVER_PWA'::position_source,
                            p_speed, p_heading, null,
                            jsonb_build_object('accuracy_m', p_accuracy, 'via', 'report_position')) r;
end $function$;

revoke all on function public.report_position(uuid, float8, float8, timestamptz, numeric, numeric, numeric) from public, anon;
grant execute on function public.report_position(uuid, float8, float8, timestamptz, numeric, numeric, numeric) to authenticated;

-- -------------------------------------------------------------------------
-- 11) d1710_repair() — naprawa danych (F7: bez eta_ctx/track_ctx; trigger off; po dowodzie)
-- -------------------------------------------------------------------------
create or replace function public.d1710_repair()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n int;
  r record;
  v_note text;
  v_from text;
  v_to text;
  v_pos_ids uuid[] := '{}';
  v_ev_ids bigint[] := '{}';
  v_load_ids uuid[] := '{}';
  v_t0 timestamptz;
begin
  perform set_config('tower.bulk_quiet', 'on', true);
  perform set_config('tower.status_ctx', 'on', true);

  -- A) czyść fałszywe tracking_opened_at w przygotowaniu
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

  -- B) transporty do naprawy — po dowodzie fałszywego automatu
  create temporary table if not exists _d1710_targets (
    load_id uuid primary key,
    reason text not null,
    restore_to text
  ) on commit drop;
  delete from _d1710_targets;

  insert into _d1710_targets (load_id, reason, restore_to)
  select distinct l.id,
         case
           when nullif(btrim(l.telematics_vehicle_id), '') is null then 'NO_LINK'
           else 'BEFORE_WINDOW'
         end,
         coalesce(
           (select e.payload->>'from'
              from load_events e
             where e.load_id = l.id
               and e.event_type = 'STATUS_AUTO'
               and e.payload->>'to' in ('IN_TRANSIT_PL', 'IN_TRANSIT_SE')
               and (
                 nullif(btrim(l.telematics_vehicle_id), '') is null
                 or (l.plan_load_date is not null
                     and e.occurred_at < public.tracking_window_start(l.plan_load_date))
               )
             order by e.occurred_at desc
             limit 1),
           'READY'
         )
    from loads l
   where l.actual_load_at is null
     and l.status in (
       'AT_LOADING','IN_TRANSIT_PL','AT_PORT_GDANSK','FERRY',
       'AT_PORT_NYNASHAMN','IN_TRANSIT_SE','AT_SITE'
     )
     and (
       exists (
         select 1 from load_events e
          where e.load_id = l.id
            and (
              e.event_type = 'STATUS_AUTO'
              or e.dedup_key like 'STATUS_AUTO:' || l.id::text || ':%'
              or e.dedup_key like 'TELM_PHASE_EXIT_LOAD:' || l.id::text
              or e.dedup_key like 'TELM_PHASE_INFER:' || l.id::text || ':%'
              or (e.event_type = 'GEOFENCE_EXIT'
                  and e.payload->>'geofence_kind' = 'LOADING'
                  and coalesce((e.payload->>'synthetic')::boolean, false) is true)
            )
            and (
              nullif(btrim(l.telematics_vehicle_id), '') is null
              or (l.plan_load_date is not null
                  and e.occurred_at < public.tracking_window_start(l.plan_load_date))
            )
       )
       or exists (
         select 1 from positions p
          where p.load_id = l.id
            and nullif(btrim(l.telematics_vehicle_id), '') is null
       )
     )
  on conflict (load_id) do nothing;

  select coalesce(array_agg(load_id), '{}') into v_load_ids from _d1710_targets;

  -- C) najpierw przywróć status
  for r in select * from _d1710_targets
  loop
    v_to := coalesce(nullif(r.restore_to, ''), 'READY');
    if v_to not in ('PLANNED','RESOURCES_PENDING','DOCS_PENDING','READY') then
      v_to := 'READY';
    end if;
    v_note := case
      when r.reason = 'NO_LINK'
        then 'Korekta: sledzenie bez linku (D-20261020-1959-01)'
      else 'Korekta: sledzenie otwarte przed dniem zaladunku (D-20261020-1710-01)'
    end;
    select status::text into v_from from loads where id = r.load_id;
    update public.loads
       set status = v_to::load_status,
           tracking_opened_at = null,
           eta_site = null,
           eta_confidence_min = null,
           eta_basis = null,
           eta_computed_at = null,
           delay_minutes = null,
           updated_at = now()
     where id = r.load_id;
    insert into public.load_events (load_id, event_type, occurred_at, payload, dedup_key)
    values (
      r.load_id, 'STATUS_READY', now(),
      jsonb_build_object('from', v_from, 'to', v_to, 'note', v_note, 'manual', true, 'korekta', true),
      'D1710_READY:' || r.load_id::text
    )
    on conflict (dedup_key) where dedup_key is not null do nothing;
    insert into public.audit_log(user_id, action, entity, entity_id, new_value)
    values (null, 'LOAD_STATUS_SET', 'loads', r.load_id::text,
            jsonb_build_object('from', v_from, 'to', v_to, 'note', v_note, 'korekta', true));
  end loop;

  -- D) odłącz pozycje / zdarzenia (trigger immutable off)
  alter table public.load_events disable trigger trg_load_events_immutable;
  begin
    with p as (
      update public.positions pos
         set detached_load_id = pos.load_id,
             detached_at = now(),
             load_id = null
        from _d1710_targets t
       where pos.load_id = t.load_id
         and (
           t.reason = 'NO_LINK'
           or exists (
             select 1 from loads l
              where l.id = t.load_id
                and l.plan_load_date is not null
                and pos.ts < public.tracking_window_start(l.plan_load_date)
           )
         )
      returning pos.id
    )
    select coalesce(array_agg(id), '{}') into v_pos_ids from p;

    with e as (
      update public.load_events ev
         set detached_load_id = ev.load_id,
             detached_at = now(),
             load_id = null,
             payload = coalesce(ev.payload, '{}'::jsonb) || jsonb_build_object(
               'd1710_detached', true,
               'd1710_note', 'D-20261020-1710-01'
             )
        from _d1710_targets t
       where ev.load_id = t.load_id
         and (
           ev.event_type in ('GEOFENCE_ENTER', 'GEOFENCE_EXIT', 'GEOFENCE_DWELL', 'STATUS_AUTO')
           or ev.dedup_key like 'STATUS_AUTO:' || t.load_id::text || ':%'
           or ev.dedup_key like 'TELM_PHASE_%'
         )
         and (
           t.reason = 'NO_LINK'
           or exists (
             select 1 from loads l
              where l.id = t.load_id
                and l.plan_load_date is not null
                and ev.occurred_at < public.tracking_window_start(l.plan_load_date)
           )
         )
      returning ev.id
    )
    select coalesce(array_agg(id), '{}') into v_ev_ids from e;

    delete from telm_attach_phase p using _d1710_targets t where p.load_id = t.load_id;
    delete from geofence_states s using _d1710_targets t where s.load_id = t.load_id;

    alter table public.load_events enable trigger trg_load_events_immutable;
  exception when others then
    alter table public.load_events enable trigger trg_load_events_immutable;
    raise;
  end;

  insert into public.audit_log(user_id, action, entity, entity_id, new_value)
  values (null, 'D1710_DETACH', 'loads', null,
          jsonb_build_object(
            'loads', v_load_ids,
            'positions', v_pos_ids,
            'events', v_ev_ids,
            'note', 'D-20261020-1710-01'
          ));

  -- E) zamknij ryzyka/sprawy tylko naprawionych, od pierwszej odłączonej chwili
  for r in select * from _d1710_targets
  loop
    select coalesce(
      least(
        (select min(detached_at) from positions where detached_load_id = r.load_id),
        (select min(detached_at) from load_events where detached_load_id = r.load_id)
      ),
      now() - interval '7 days'
    ) into v_t0;

    update public.risk_signals s
       set resolved_at = coalesce(s.resolved_at, now()),
           detail = coalesce(s.detail, '{}'::jsonb)
             || jsonb_build_object('korekta', 'D-1710', 'resolution_note', 'D-20261020-1710-01')
     where s.resolved_at is null
       and s.load_id = r.load_id
       and s.detected_at >= v_t0
       and (
         s.kind in ('SILENT_VEHICLE', 'ETA_BREACH', 'AUTO_STATUS', 'ROAD_PL', 'ROAD_SE')
         or s.kind::text like 'ROAD_%'
         or s.dedup_key like 'OFF_CORRIDOR:%'
         or coalesce(s.detail->>'title_key', s.title_key, '') in ('rk_off_corridor', 'rk_silent_vehicle')
       );

    update public.decisions d
       set status = 'RESOLVED',
           resolution_code = coalesce(d.resolution_code, 'MANUAL_STATUS'),
           resolution_note = coalesce(d.resolution_note, 'D-20261020-1710-01'),
           resolved_at = coalesce(d.resolved_at, now()),
           updated_at = now()
     where d.load_id = r.load_id
       and d.status in ('NEW', 'ASSIGNED', 'SNOOZED')
       and d.created_at >= v_t0
       and (
         coalesce(d.detail->>'zrodlo', '') in ('TELM_PHASE_INFER', 'AUTO_STATUS')
         or d.risk_id in (
           select s.id from risk_signals s
            where s.load_id = r.load_id
              and s.detected_at >= v_t0
              and (
                s.kind in ('SILENT_VEHICLE', 'ETA_BREACH', 'AUTO_STATUS', 'ROAD_PL', 'ROAD_SE')
                or s.dedup_key like 'OFF_CORRIDOR:%'
              )
         )
       );

    insert into decision_events (decision_id, action, payload)
    select d.id, 'RESOLVE',
           jsonb_build_object('note', 'D-20261020-1710-01', 'korekta', true, 'option', 'MANUAL_STATUS')
      from decisions d
     where d.load_id = r.load_id
       and d.resolution_note = 'D-20261020-1710-01'
       and d.resolved_at >= now() - interval '1 minute'
       and not exists (
         select 1 from decision_events de
          where de.decision_id = d.id and de.action = 'RESOLVE'
            and de.payload->>'note' = 'D-20261020-1710-01'
       );
  end loop;

  perform set_config('tower.bulk_quiet', 'off', true);
  perform set_config('tower.status_ctx', 'off', true);

  return jsonb_build_object(
    'loads', v_load_ids,
    'positions_detached', coalesce(cardinality(v_pos_ids), 0),
    'events_detached', coalesce(cardinality(v_ev_ids), 0)
  );
end $$;

revoke all on function public.d1710_repair() from public, anon, authenticated;
grant execute on function public.d1710_repair() to service_role;

select public.d1710_repair();

-- -------------------------------------------------------------------------
-- 12) purge_personal_data — odłączone pozycje 30 dni (RODO)
-- -------------------------------------------------------------------------
create or replace function public.purge_personal_data(p_days integer default 90)
returns integer
language plpgsql
set search_path to 'public', 'extensions'
as $function$
declare n int; n_c int; n_pos int; n_pos_c int; n_pos_d int; n_tok int; n_esc int;
begin
  if (p_days >= 0) is not true then raise exception 'p_days musi być ≥ 0' using errcode = '22023'; end if;

  update loads set driver_name = null, driver_phone = null
  where actual_delivery_at is not null
    and actual_delivery_at < now() - make_interval(days => p_days)
    and (driver_name is not null or driver_phone is not null);
  get diagnostics n = row_count;

  update loads set driver_name = null, driver_phone = null
  where status = 'CANCELLED' and actual_delivery_at is null
    and updated_at < now() - make_interval(days => p_days)
    and (driver_name is not null or driver_phone is not null);
  get diagnostics n_c = row_count;

  update load_escorts e set driver_name = null, driver_phone = null
    from loads l
   where l.id = e.load_id
     and (e.driver_name is not null or e.driver_phone is not null)
     and ((l.actual_delivery_at is not null and l.actual_delivery_at < now() - make_interval(days => p_days))
       or (l.status = 'CANCELLED' and l.actual_delivery_at is null and l.updated_at < now() - make_interval(days => p_days)));
  get diagnostics n_esc = row_count;

  delete from positions p
  using loads l
  where l.id = p.load_id
    and l.actual_delivery_at is not null
    and l.actual_delivery_at < now() - interval '30 days';
  get diagnostics n_pos = row_count;

  delete from positions p
  using loads l
  where l.id = p.load_id and l.status = 'CANCELLED' and l.actual_delivery_at is null
    and l.updated_at < now() - make_interval(days => p_days);
  get diagnostics n_pos_c = row_count;

  -- D-1710: odłączone pozycje — 30 dni od detached_at
  delete from positions
   where detached_load_id is not null
     and load_id is null
     and detached_at is not null
     and detached_at < now() - interval '30 days';
  get diagnostics n_pos_d = row_count;

  delete from driver_tokens
  where coalesce(revoked_at, expires_at) < now() - make_interval(days => p_days);
  get diagnostics n_tok = row_count;

  insert into integration_runs (job, ok, result)
  values ('rodo', true, jsonb_build_object('dni', p_days, 'kierowcy_rozladowane', n, 'kierowcy_anulowane', n_c,
          'piloci', n_esc, 'pozycje_rozladowane', n_pos, 'pozycje_anulowane', n_pos_c,
          'pozycje_odlaczone', n_pos_d, 'linki_kierowcy', n_tok));
  return n + n_c + n_esc;
end $function$;

revoke all on function public.purge_personal_data(integer) from public, anon, authenticated;