-- DP-205 E49-a cz.3 (#783 / #785): wiatr w ETA (Z1), Z4 bez globalnego slowdown,
-- helpery pod sprawy Z2. WIND_E49=true na froncie w tym samym PR.

begin;

-- Dokończenie 8 progów E49 (Z1/Z4): SLIP_* — 0396 miało tylko 6× WIND_*.
do $$
declare
  c text;
begin
  select con.conname into c
    from pg_constraint con
   where con.conrelid = 'public.ops_thresholds'::regclass
     and con.contype = 'c'
     and pg_get_constraintdef(con.oid) like '%WIND_SLOW_MS%';
  if c is not null then
    execute format('alter table public.ops_thresholds drop constraint %I', c);
  end if;
end $$;

alter table public.ops_thresholds
  add constraint ops_thresholds_key_check check (key in (
    'WAVE_M','GUST_KN','DELAY_MIN','LEAD_DAYS',
    'AWIZ_EARLY_H','AWIZ_LATE_H','DOC_WARN_H','DOC_CRIT_H',
    'SILENT_MIN','SILENT_MIN_EMTRACK','OFFROUTE_KM',
    'DWELL_FREE_LOAD_H','DWELL_FREE_UNLOAD_H','DWELL_HOURLY_EUR','DWELL_DAILY_EUR',
    'DWELL_START_LATER','DWELL_FULL_HOUR','DWELL_DAY_AFTER_H',
    'ETA_CONF_HIGH_MIN','ETA_CONF_MED_MIN','GEOFENCE_EDGE_M','SILENT_STOP_H',
    'import_quiet_hours',
    'WIND_SLOW_MS','WIND_CROSS_PCT','WIND_HEAD_PCT',
    'WIND_HOLD_MS','WIND_RESUME_MS','WIND_RESUME_MIN',
    'SLIP_RADIUS_KM','SLIP_PCT'
  ));

insert into public.ops_thresholds (key, value_num, unit, label_pl) values
  ('SLIP_RADIUS_KM', 25, 'km', 'Śliskość: zasięg lokalny od punktu'),
  ('SLIP_PCT', 15, '%', 'Śliskość: dodatek czasu lokalnie')
on conflict (key) do nothing;

create or replace function public.admin_ops_threshold_set(p_key text, p_value numeric)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid;
  v_role text;
  v_old numeric;
begin
  perform public.assert_not_preview();
  select id, role::text into v_me, v_role from app_users where auth_id = auth.uid() and active;
  if (v_me is not null and v_role = 'HHL_ADMIN') is not true then
    raise exception 'Progi — wyłącznie administrator HHL' using errcode = '42501';
  end if;
  if (p_key in (
    'WAVE_M','GUST_KN','DELAY_MIN','LEAD_DAYS',
    'AWIZ_EARLY_H','AWIZ_LATE_H','DOC_WARN_H','DOC_CRIT_H',
    'SILENT_MIN','SILENT_MIN_EMTRACK','OFFROUTE_KM',
    'DWELL_FREE_LOAD_H','DWELL_FREE_UNLOAD_H','DWELL_HOURLY_EUR','DWELL_DAILY_EUR',
    'DWELL_START_LATER','DWELL_FULL_HOUR','DWELL_DAY_AFTER_H',
    'ETA_CONF_HIGH_MIN','ETA_CONF_MED_MIN','GEOFENCE_EDGE_M','SILENT_STOP_H',
    'import_quiet_hours',
    'WIND_SLOW_MS','WIND_CROSS_PCT','WIND_HEAD_PCT',
    'WIND_HOLD_MS','WIND_RESUME_MS','WIND_RESUME_MIN',
    'SLIP_RADIUS_KM','SLIP_PCT'
  )) is not true then
    raise exception 'Nieznany próg' using errcode = '22023';
  end if;
  if p_key = 'import_quiet_hours' then
    if (p_value is not null and p_value in (0, 1)) is not true then
      raise exception 'import_quiet_hours: 0 lub 1' using errcode = '22023';
    end if;
  elsif (p_value is not null and p_value > 0) is not true then
    raise exception 'Wartość progu musi być > 0' using errcode = '22023';
  end if;

  select value_num into v_old from ops_thresholds where key = p_key for update;
  if (v_old is not null) is not true then
    raise exception 'Brak wiersza progu' using errcode = 'P0002';
  end if;

  if (v_old is distinct from p_value) is not true then
    return;
  end if;

  update ops_thresholds
     set value_num = p_value, updated_at = now(), updated_by = v_me
   where key = p_key;

  insert into audit_log (user_id, action, entity, entity_id, old_value, new_value)
  values (
    v_me,
    'OPS_THRESHOLD_SET',
    'ops_thresholds',
    p_key,
    jsonb_build_object('value', v_old),
    jsonb_build_object('value', p_value)
  );
end;
$$;

revoke all on function public.admin_ops_threshold_set(text, numeric) from public, anon;
grant execute on function public.admin_ops_threshold_set(text, numeric) to authenticated;

-- Progi E49 z ops_thresholds (Z1 pkt 5).
create or replace function public.e49_wind_thresholds()
returns table (
  slow_ms numeric,
  cross_pct numeric,
  head_pct numeric,
  hold_ms numeric,
  resume_ms numeric,
  resume_min numeric,
  slip_radius_km numeric,
  slip_pct numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce((select value_num from ops_thresholds where key = 'WIND_SLOW_MS'), 20),
    coalesce((select value_num from ops_thresholds where key = 'WIND_CROSS_PCT'), 15),
    coalesce((select value_num from ops_thresholds where key = 'WIND_HEAD_PCT'), 5),
    coalesce((select value_num from ops_thresholds where key = 'WIND_HOLD_MS'), 25),
    coalesce((select value_num from ops_thresholds where key = 'WIND_RESUME_MS'), 20),
    coalesce((select value_num from ops_thresholds where key = 'WIND_RESUME_MIN'), 30),
    coalesce((select value_num from ops_thresholds where key = 'SLIP_RADIUS_KM'), 25),
    coalesce((select value_num from ops_thresholds where key = 'SLIP_PCT'), 15);
$$;

revoke all on function public.e49_wind_thresholds() from public, anon, authenticated;
grant execute on function public.e49_wind_thresholds() to service_role;

-- Kąt względny wiatr↔jazda (0–180).
create or replace function public.e49_wind_rel_angle(p_travel numeric, p_from numeric)
returns numeric
language sql
immutable
as $$
  select least(
    abs(mod(p_from - p_travel + 360, 360)),
    360 - abs(mod(p_from - p_travel + 360, 360))
  );
$$;

-- Efekty wiatru z corridor_wind_forecast dla odcinka przed autem (Z1).
-- p_from_km: postęp na korytarzu; p_start: teraz / start jazdy; p_drive_h: pozostała jazda.
create or replace function public.e49_wind_weather_for_corridor(
  p_corridor text,
  p_from_km numeric,
  p_start timestamptz,
  p_drive_h numeric
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  thr record;
  r record;
  v_weather jsonb := '[]'::jsonb;
  v_add int := 0;
  v_hold int := 0;
  v_at timestamptz;
  v_until timestamptz;
  v_gust numeric;
  v_dir numeric;
  v_angle numeric;
  v_mult numeric;
  v_seg_km numeric;
  v_base_min numeric;
  v_extra int;
  v_side text;
  v_sample jsonb;
  v_next_km numeric;
  v_truck_kmh numeric := 70;
  v_end timestamptz;
  v_s record;
begin
  if p_corridor is null or p_drive_h is null or p_drive_h <= 0 then
    return jsonb_build_object('weather', '[]'::jsonb, 'add_min', 0, 'hold_min', 0);
  end if;
  select * into thr from public.e49_wind_thresholds();
  v_end := p_start + make_interval(secs => (least(p_drive_h, 24) * 3600)::int);

  for r in
    select w.corridor, w.km, w.bearing_deg, w.source, w.samples
      from corridor_wind_forecast w
     where w.corridor = p_corridor
       and w.km >= coalesce(p_from_km, 0) - 0.01
       and w.fetched_at > p_start - interval '3 hours'
     order by w.km
  loop
    select min(w2.km) into v_next_km
      from corridor_wind_forecast w2
     where w2.corridor = p_corridor and w2.km > r.km;
    v_seg_km := greatest(0, coalesce(v_next_km, r.km + 25) - r.km);
    v_at := p_start + make_interval(secs => (
      (greatest(0, r.km - coalesce(p_from_km, 0)) / v_truck_kmh) * 3600
    )::int);
    exit when v_at > v_end;

    -- Najbliższa próbka ±90 min
    v_sample := null;
    for v_s in select value as s from jsonb_array_elements(coalesce(r.samples, '[]'::jsonb)) as t(value)
    loop
      if (v_s.s ? 'at') is not true then continue; end if;
      if abs(extract(epoch from ((v_s.s->>'at')::timestamptz - v_at))) <= 90 * 60 then
        if v_sample is null
           or abs(extract(epoch from ((v_s.s->>'at')::timestamptz - v_at)))
            < abs(extract(epoch from ((v_sample->>'at')::timestamptz - v_at)))
        then
          v_sample := v_s.s;
        end if;
      end if;
    end loop;
    if v_sample is null then continue; end if;
    v_gust := nullif(v_sample->>'gustMs', '')::numeric;
    if v_gust is null or v_gust < thr.slow_ms then continue; end if;
    v_dir := coalesce(nullif(v_sample->>'windFromDeg', '')::numeric, 0);
    v_angle := public.e49_wind_rel_angle(r.bearing_deg, v_dir);

    if v_gust >= thr.hold_ms then
      v_until := v_at;
      for v_s in
        select value as s
          from jsonb_array_elements(coalesce(r.samples, '[]'::jsonb)) as t(value)
         order by (value->>'at')
      loop
        if (v_s.s->>'at')::timestamptz < v_at then continue; end if;
        if nullif(v_s.s->>'gustMs', '')::numeric is not null
           and nullif(v_s.s->>'gustMs', '')::numeric < thr.resume_ms then
          v_until := (v_s.s->>'at')::timestamptz
            + make_interval(mins => thr.resume_min::int);
          exit;
        end if;
      end loop;
      if v_until <= v_at then
        v_until := v_at + interval '6 hours' + make_interval(mins => thr.resume_min::int);
      end if;
      v_extra := greatest(0, round(extract(epoch from (v_until - v_at)) / 60.0)::int);
      v_hold := v_hold + v_extra;
      v_add := v_add + v_extra;
      v_weather := v_weather || jsonb_build_array(jsonb_build_object(
        'kind', 'WIND_HOLD',
        'addMin', v_extra,
        'where', replace(r.corridor, '_', ' ') || ' · km ' || round(r.km)::text,
        'gustMs', v_gust,
        'fromIso', v_at,
        'untilIso', v_until,
        'source', r.source
      ));
      exit; -- postój blokuje dalszy odcinek
    end if;

    -- 20–24 m/s: z boku / z przodu
    if v_angle < 45 then
      v_mult := 1 + thr.head_pct / 100.0;
      v_side := 'HEAD';
    elsif v_angle <= 135 then
      v_mult := 1 + thr.cross_pct / 100.0;
      v_side := 'CROSS';
    else
      continue; -- z tyłu
    end if;
    v_base_min := (v_seg_km / v_truck_kmh) * 60.0;
    v_extra := round(v_base_min * (v_mult - 1))::int;
    if v_extra <= 0 then continue; end if;
    v_add := v_add + v_extra;
    v_weather := v_weather || jsonb_build_array(jsonb_build_object(
      'kind', 'WIND',
      'addMin', v_extra,
      'where', replace(r.corridor, '_', ' ') || ' · km ' || round(r.km)::text,
      'gustMs', v_gust,
      'side', v_side,
      'atIso', v_at,
      'source', r.source
    ));
  end loop;

  return jsonb_build_object(
    'weather', coalesce((
      select jsonb_agg(x order by (x->>'addMin')::int desc)
        from jsonb_array_elements(v_weather) x
    ), '[]'::jsonb),
    'add_min', v_add,
    'hold_min', v_hold
  );
end;
$$;

revoke all on function public.e49_wind_weather_for_corridor(text, numeric, timestamptz, numeric)
  from public, anon, authenticated;
grant execute on function public.e49_wind_weather_for_corridor(text, numeric, timestamptz, numeric)
  to service_role;

comment on function public.e49_wind_weather_for_corridor(text, numeric, timestamptz, numeric) is
  'E49-a Z1: causes.weather + add_min z corridor_wind_forecast (SMHI/FMI).';

-- Z4: lokalna śliskość z otwartych ROAD_* w promieniu SLIP_RADIUS_KM (nie mnoży całej trasy).
create or replace function public.e49_slip_weather_local(
  p_load uuid,
  p_corridor text,
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  thr record;
  r record;
  v_weather jsonb := '[]'::jsonb;
  v_add int := 0;
  v_lat double precision;
  v_lon double precision;
  v_dist numeric;
  v_place text;
  v_extra int;
  v_pos geometry;
begin
  select * into thr from public.e49_wind_thresholds();
  select st_setsrid(st_makepoint(p.lon, p.lat), 4326)
    into v_pos
    from positions p
   where p.load_id = p_load
   order by p.ts desc
   limit 1;
  if v_pos is null then
    return jsonb_build_object('weather', '[]'::jsonb, 'add_min', 0);
  end if;

  for r in
    select rs.id, rs.kind, rs.title, rs.detail, rs.detected_at
      from risk_signals rs
     where rs.resolved_at is null
       and rs.kind::text in ('ROAD_SE', 'ROAD_PL', 'ROAD_LT', 'ROAD_LV', 'ROAD_EE', 'ROAD_FI')
       and (
         rs.load_id = p_load
         or rs.load_id is null
       )
       and rs.detected_at > p_now - interval '24 hours'
       and (
         coalesce(rs.detail->>'rodzaj', '') in ('RoadCondition', 'WeatherMeasurepoint')
         or coalesce(rs.detail->>'oryginal', rs.title, '') ~* 'ślisk|ice|icy|hala|libed|apled|sn[iī]eg|snow|frost'
       )
     order by rs.detected_at desc
     limit 40
  loop
    v_lat := nullif(r.detail->>'lat', '')::double precision;
    v_lon := nullif(r.detail->>'lon', '')::double precision;
    if v_lat is null or v_lon is null then continue; end if;
    v_dist := st_distance(
      v_pos::geography,
      st_setsrid(st_makepoint(v_lon, v_lat), 4326)::geography
    ) / 1000.0;
    if v_dist is null or v_dist > thr.slip_radius_km then continue; end if;
    -- +15% na ~25 km odcinku przy 70 km/h ≈ +3–4 min; skaluj odległością
    v_extra := greatest(1, round((thr.slip_radius_km - v_dist) / thr.slip_radius_km * 25.0 / 70.0 * 60.0 * (thr.slip_pct / 100.0) * 2)::int);
    v_place := coalesce(r.detail->>'droga', r.detail->>'opis', r.title, p_corridor);
    v_add := v_add + v_extra;
    v_weather := v_weather || jsonb_build_array(jsonb_build_object(
      'kind', 'SLIPPERY',
      'addMin', v_extra,
      'where', left(v_place, 80),
      'atIso', coalesce(r.detected_at, p_now),
      'source', 'TRAFIKVERKET'
    ));
  end loop;

  return jsonb_build_object(
    'weather', coalesce((
      select jsonb_agg(x order by (x->>'addMin')::int desc)
        from jsonb_array_elements(v_weather) x
    ), '[]'::jsonb),
    'add_min', v_add
  );
end;
$$;

revoke all on function public.e49_slip_weather_local(uuid, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.e49_slip_weather_local(uuid, text, timestamptz)
  to service_role;

-- Opakowanie: Z4 wycofuje globalny slowdown z ETA; Z1 dokłada wiatr + lokalną śliskość.
do $$
begin
  if exists (
    select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'compute_load_eta'
       and pg_get_function_identity_arguments(p.oid) = 'uuid, timestamp with time zone'
  ) and not exists (
    select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'compute_load_eta_core'
  ) then
    execute 'alter function public.compute_load_eta(uuid, timestamptz) rename to compute_load_eta_core';
  end if;
end $$;

create or replace function public.compute_load_eta(p_load uuid, p_now timestamptz default now())
returns table(eta timestamptz, conf_min integer, basis jsonb)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $function$
declare
  r record;
  v_eta timestamptz;
  v_conf int;
  v_basis jsonb;
  v_causes jsonb;
  v_slow_se numeric;
  v_slow_pl numeric;
  v_undo_min numeric := 0;
  v_seg jsonb;
  v_hours numeric;
  v_wind jsonb;
  v_slip jsonb;
  v_weather jsonb := '[]'::jsonb;
  v_add int := 0;
  v_corr text;
  v_drive_h numeric;
  v_flags jsonb;
begin
  select c.eta, c.conf_min, c.basis
    into v_eta, v_conf, v_basis
    from public.compute_load_eta_core(p_load, p_now) c;

  if v_basis is null or v_eta is null then
    return query select v_eta, v_conf, v_basis;
    return;
  end if;

  v_causes := coalesce(v_basis->'causes', '{}'::jsonb);
  v_slow_se := coalesce((v_causes->>'slowdown_se')::numeric, 1);
  v_slow_pl := coalesce((v_causes->>'slowdown_pl')::numeric, 1);

  -- Z4: wycofaj globalny ×slowdown z ETA (zostaje w Stan systemu przez corridor_conditions).
  if v_slow_se > 1.001 then
    for v_seg in
      select * from jsonb_array_elements(coalesce(v_basis->'segments', '[]'::jsonb))
    loop
      if coalesce(v_seg->>'code', '') like 'SE_ROAD%'
         or coalesce(v_seg->>'corridor', '') like 'SE%'
         or coalesce(v_seg->>'corridor', '') like 'FI%' then
        v_hours := coalesce(nullif(v_seg->>'hours', '')::numeric, 0);
        if v_hours > 0 then
          v_undo_min := v_undo_min + (v_hours - v_hours / v_slow_se) * 60.0;
        end if;
      end if;
    end loop;
  end if;
  if v_slow_pl > 1.001 then
    for v_seg in
      select * from jsonb_array_elements(coalesce(v_basis->'segments', '[]'::jsonb))
    loop
      if coalesce(v_seg->>'code', '') = 'PL_ROAD'
         or coalesce(v_seg->>'corridor', '') like 'PL%' then
        v_hours := coalesce(nullif(v_seg->>'hours', '')::numeric, 0);
        if v_hours > 0 then
          v_undo_min := v_undo_min + (v_hours - v_hours / v_slow_pl) * 60.0;
        end if;
      end if;
    end loop;
  end if;

  if v_undo_min > 0 then
    v_eta := v_eta - make_interval(mins => round(v_undo_min)::int);
    v_causes := v_causes
      || jsonb_build_object(
           'weather_slowdown_pct', 0,
           'slowdown_se', 1,
           'slowdown_pl', 1,
           'e49_z4_undid_global_min', round(v_undo_min)
         );
    v_flags := coalesce(v_basis->'flags', '[]'::jsonb);
    v_flags := coalesce((
      select jsonb_agg(f)
        from jsonb_array_elements_text(v_flags) f
       where f not like 'spowolnienie %'
    ), '[]'::jsonb) || jsonb_build_array('E49 Z4: śliskość tylko lokalnie (bez × całej trasy)');
    v_basis := jsonb_set(v_basis, '{flags}', v_flags);
  end if;

  -- Z1: wiatr z prognozy na korytarzu SE/PL/FI
  v_corr := coalesce(v_causes->>'se_corridor', v_causes->>'pl_corridor');
  v_drive_h := coalesce(nullif(v_causes->>'drive_h', '')::numeric, 8);
  if v_corr is not null then
    v_wind := public.e49_wind_weather_for_corridor(v_corr, 0, p_now, v_drive_h);
    v_weather := coalesce(v_wind->'weather', '[]'::jsonb);
    v_add := v_add + coalesce((v_wind->>'add_min')::int, 0);
  end if;
  if coalesce(v_causes->>'pl_corridor', '') is distinct from coalesce(v_corr, '')
     and coalesce(v_causes->>'pl_corridor', '') <> '' then
    v_wind := public.e49_wind_weather_for_corridor(
      v_causes->>'pl_corridor', 0, p_now, greatest(v_drive_h * 0.4, 2)
    );
    v_weather := v_weather || coalesce(v_wind->'weather', '[]'::jsonb);
    v_add := v_add + coalesce((v_wind->>'add_min')::int, 0);
  end if;

  -- Z4 lokalnie
  v_slip := public.e49_slip_weather_local(p_load, v_corr, p_now);
  v_weather := v_weather || coalesce(v_slip->'weather', '[]'::jsonb);
  v_add := v_add + coalesce((v_slip->>'add_min')::int, 0);

  if v_add > 0 then
    v_eta := v_eta + make_interval(mins => v_add);
    -- Pasmo niepewności + ½ doliczonego czasu (Z1 pkt 4)
    v_conf := coalesce(v_conf, 0) + (v_add / 2);
  end if;

  v_causes := v_causes || jsonb_build_object(
    'weather', coalesce((
      select jsonb_agg(x order by (x->>'addMin')::numeric desc)
        from jsonb_array_elements(v_weather) x
    ), '[]'::jsonb),
    'e49_wind_add_min', v_add
  );
  v_basis := jsonb_set(v_basis, '{causes}', v_causes);

  return query select v_eta, v_conf, v_basis;
end;
$function$;

revoke all on function public.compute_load_eta(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.compute_load_eta(uuid, timestamptz) to service_role;

-- Uprawnienia core (jak wcześniej — tylko service_role)
revoke all on function public.compute_load_eta_core(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.compute_load_eta_core(uuid, timestamptz) to service_role;

comment on function public.compute_load_eta(uuid, timestamptz) is
  'E49-a: wrapper — Z4 bez globalnego slowdown + Z1 wiatr/śliskość w causes.weather; rdzeń = compute_load_eta_core.';

-- Lista kopii: corridor_wind_forecast wchodzi z katalogu automatycznie (I-2B).

notify pgrst, 'reload schema';

commit;
