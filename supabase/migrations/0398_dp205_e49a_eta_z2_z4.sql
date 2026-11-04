-- DP-205 E49-a cz.3 (#783 / #785): wiatr w ETA (Z1), Z4 bez globalnego slowdown (w rdzeniu ETA),
-- helpery pod sprawy Z2. WIND_E49=true na froncie w tym samym PR.
-- F7 #785 r1: odcinek przed autem + godzina przejazdu, postój minus H-4, śliskość lokalnie przed autem,
-- Z2 jedna sprawa na transport+korytarz (raise_integration_risk), audience HHL+SCX.

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
set search_path = public
as $$
  select least(
    abs(mod(p_from - p_travel + 360, 360)),
    360 - abs(mod(p_from - p_travel + 360, 360))
  );
$$;

-- Efekty wiatru z corridor_wind_forecast dla odcinka PRZED autem (Z1).
-- p_from_km: postęp auta na korytarzu (km od początku linii); p_start: kiedy auto jest w p_from_km
-- (teraz / zjazd z promu / start z planu załadunku); p_drive_h: pozostała jazda tym korytarzem;
-- p_now: odniesienie świeżości prognozy (≤ 3 h); p_rest: okna odpoczynku H-4 z rdzenia
-- ([{"from": ts, "to": ts}]) — postój wiatrowy nachodzący na odpoczynek nie sumuje się z nim
-- (Z1 pkt 3): ETA rośnie o czas postoju poza oknami odpoczynku.
drop function if exists public.e49_wind_weather_for_corridor(text, numeric, timestamptz, numeric);
create or replace function public.e49_wind_weather_for_corridor(
  p_corridor text,
  p_from_km numeric,
  p_start timestamptz,
  p_drive_h numeric,
  p_now timestamptz default now(),
  p_rest jsonb default '[]'::jsonb
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
  v_rows int := 0;
  v_at timestamptz;
  v_until timestamptz;
  v_gust numeric;
  v_dir numeric;
  v_angle numeric;
  v_mult numeric;
  v_seg_km numeric;
  v_base_min numeric;
  v_extra int;
  v_gross int;
  v_overlap numeric;
  v_side text;
  v_sample jsonb;
  v_next_km numeric;
  v_truck_kmh numeric := 70;
  v_end timestamptz;
  v_s record;
begin
  if (p_corridor is not null and p_start is not null and coalesce(p_drive_h, 0) > 0) is not true then
    return jsonb_build_object('weather', '[]'::jsonb, 'add_min', 0, 'hold_min', 0, 'rows', 0);
  end if;
  select * into thr from public.e49_wind_thresholds();
  v_end := p_start + make_interval(secs => (least(p_drive_h, 24) * 3600)::int);

  for r in
    select w.corridor, w.km, w.bearing_deg, w.source, w.samples
      from corridor_wind_forecast w
     where w.corridor = p_corridor
       and w.km >= coalesce(p_from_km, 0) - 0.01
       and w.fetched_at > p_now - interval '3 hours'
     order by w.km
  loop
    v_rows := v_rows + 1;
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
    v_dir := nullif(v_sample->>'windFromDeg', '')::numeric;
    -- brak kierunku: nie zgadujemy przodu/tyłu — bok (F7 #785 r1, nieblokujące)
    v_angle := case when v_dir is null then 90 else public.e49_wind_rel_angle(r.bearing_deg, v_dir) end;

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
      v_gross := greatest(0, round(extract(epoch from (v_until - v_at)) / 60.0)::int);
      -- Z1 pkt 3: postój ≠ suma z odpoczynkiem — odejmij nakładanie na okna H-4 (max, nie suma).
      v_overlap := 0;
      for v_s in select value as s from jsonb_array_elements(coalesce(p_rest, '[]'::jsonb)) as t(value)
      loop
        if (v_s.s ? 'from') is not true or (v_s.s ? 'to') is not true then continue; end if;
        v_overlap := v_overlap + greatest(0, extract(epoch from (
          least(v_until, (v_s.s->>'to')::timestamptz)
          - greatest(v_at, (v_s.s->>'from')::timestamptz)
        )) / 60.0);
      end loop;
      v_extra := greatest(0, v_gross - round(v_overlap)::int);
      v_hold := v_hold + v_extra;
      v_add := v_add + v_extra;
      v_weather := v_weather || jsonb_build_array(jsonb_build_object(
        'kind', 'WIND_HOLD',
        'addMin', v_extra,
        'grossMin', v_gross,
        'restOverlapMin', round(v_overlap)::int,
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
    'hold_min', v_hold,
    'rows', v_rows
  );
end;
$$;

revoke all on function public.e49_wind_weather_for_corridor(text, numeric, timestamptz, numeric, timestamptz, jsonb)
  from public, anon, authenticated;
grant execute on function public.e49_wind_weather_for_corridor(text, numeric, timestamptz, numeric, timestamptz, jsonb)
  to service_role;

comment on function public.e49_wind_weather_for_corridor(text, numeric, timestamptz, numeric, timestamptz, jsonb) is
  'E49-a Z1: causes.weather + add_min z corridor_wind_forecast (SMHI/FMI) dla odcinka przed autem; postój minus okna H-4.';

-- Z4: lokalna śliskość — odcinki PRZED autem w promieniu SLIP_RADIUS_KM od punktu śliskości
-- (nie od auta, nie za autem), jedno wydłużenie na skupisko sygnałów, tylko statusy drogowe
-- i świeża pozycja. Mnożnik całej trasy NIE wchodzi do ETA (Z4).
-- Reguła wspólna: nawierzchnia ≤ 0 °C (gdy sygnał ją podaje) + śnieg / lód / deszcz / stan nawierzchni;
-- sygnały Trafikverket RoadCondition liczą się same z siebie. FI: tylko to, co jest w ROAD_FI (bez nowego API).
drop function if exists public.e49_slip_weather_local(uuid, text, timestamptz);
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
  c record;
  r record;
  v_empty constant jsonb := jsonb_build_object('weather', '[]'::jsonb, 'add_min', 0);
  v_status text;
  v_pos geometry;
  v_pos_ts timestamptz;
  v_truck_km numeric;
  v_off_km numeric;
  v_kinds text[];
  v_blob text;
  v_surface numeric;
  v_ice boolean;
  v_wet boolean;
  v_lo numeric;
  v_hi numeric;
  v_clusters jsonb := '[]'::jsonb;
  v_cl_lo numeric;
  v_cl_hi numeric;
  v_cl_where text;
  v_cl_src text;
  v_cl_at timestamptz;
  v_cl jsonb;
  v_weather jsonb := '[]'::jsonb;
  v_add int := 0;
  v_extra int;
begin
  if p_corridor is null then
    return v_empty;
  end if;
  select l.status::text into v_status from loads l where l.id = p_load;
  -- tylko jazda drogą (nie DONE/AT_SITE/prom/porty)
  if (v_status in ('IN_TRANSIT_PL', 'IN_TRANSIT_SE')) is not true then
    return v_empty;
  end if;
  select p.ts, coalesce(p.geom_snapped, p.geom_raw)
    into v_pos_ts, v_pos
    from positions p
   where p.load_id = p_load
   order by p.ts desc
   limit 1;
  if (v_pos is not null and v_pos_ts >= p_now - interval '2 hours') is not true then
    return v_empty;
  end if;
  select * into c from corridor_polylines where code = p_corridor;
  if not found then
    return v_empty;
  end if;
  select * into thr from public.e49_wind_thresholds();

  v_truck_km := (st_linelocatepoint(c.geom, st_setsrid(v_pos, 4326)))::numeric * c.total_km;
  v_off_km := st_distance(st_setsrid(v_pos, 4326)::geography, c.geom::geography) / 1000.0;
  if v_off_km > 10 then
    return v_empty; -- auto poza korytarzem: nie da się ustalić „przed autem”
  end if;

  v_kinds := case
    when p_corridor like 'PL_EE%' then array['ROAD_PL', 'ROAD_LT', 'ROAD_LV', 'ROAD_EE']
    when p_corridor like 'PL%' then array['ROAD_PL']
    when p_corridor like 'FI%' then array['ROAD_FI']
    when p_corridor like 'SE%' then array['ROAD_SE']
    else array[]::text[]
  end;

  for r in
    with sig as (
      select rs.id, rs.kind::text as kind, rs.title, rs.detail, rs.detected_at,
             case when rs.detail->>'lat' ~ '^-?[0-9]+(\.[0-9]+)?$'
                  then (rs.detail->>'lat')::double precision end as lat,
             case when rs.detail->>'lon' ~ '^-?[0-9]+(\.[0-9]+)?$'
                  then (rs.detail->>'lon')::double precision end as lon
        from risk_signals rs
       where rs.resolved_at is null
         and rs.kind::text = any (v_kinds)
         and (rs.load_id = p_load or rs.load_id is null)
         and rs.detected_at > p_now - interval '24 hours'
         and (rs.valid_until is null or rs.valid_until > p_now)
         and coalesce(rs.detail->>'obok_trasy', '') <> 'true'
    ), pts as (
      select s.*, st_setsrid(st_makepoint(s.lon, s.lat), 4326) as pt
        from sig s
       where s.lat is not null and s.lon is not null
    ), proj as (
      select p.*,
             (st_linelocatepoint(c.geom, p.pt))::numeric * c.total_km as km,
             st_distance(p.pt::geography, c.geom::geography) / 1000.0 as off_km
        from pts p
    )
    select * from proj
     where off_km <= thr.slip_radius_km
     order by km
  loop
    v_blob := lower(
      coalesce(r.detail->>'oryginal', '') || ' ' || coalesce(r.title, '') || ' '
      || coalesce(r.detail->>'opis', '') || ' ' || coalesce(r.detail->>'kod', '')
    );
    v_surface := coalesce(
      nullif(substring(coalesce(r.detail->>'opis', '') from 'nawierzchnia\s+(-?[0-9]+(?:\.[0-9]+)?)\s*°C'), '')::numeric,
      case when r.detail->>'surfaceC' ~ '^-?[0-9]+(\.[0-9]+)?$' then (r.detail->>'surfaceC')::numeric end
    );
    v_ice := v_blob ~ '(ślisk|oblodz|gołoled|śnieg|mróz|\yice\y|\yicy\y|\ysnow\y|\yfrost\y|slipper|libed|apledz|sn[iī]eg)';
    v_wet := v_blob ~ '(deszcz|\yrain\y|mokr)';
    if (coalesce(r.detail->>'rodzaj', '') = 'RoadCondition'
        or (v_surface is not null and v_surface <= 0 and (v_ice or v_wet))
        or (v_surface is null and v_ice)) is not true then
      continue;
    end if;

    -- zasięg: promień od PUNKTU śliskości, tylko odcinek przed autem
    v_lo := greatest(r.km - thr.slip_radius_km, v_truck_km);
    v_hi := least(r.km + thr.slip_radius_km, c.total_km);
    if v_hi - v_lo <= 0.5 then
      continue; -- punkt (i jego zasięg) za autem
    end if;

    if v_cl_hi is null then
      v_cl_lo := v_lo; v_cl_hi := v_hi;
    elsif v_lo <= v_cl_hi then
      v_cl_hi := greatest(v_cl_hi, v_hi); -- to samo miejsce / skupisko: bez sumowania
      continue;
    else
      v_clusters := v_clusters || jsonb_build_array(jsonb_build_object(
        'lo', v_cl_lo, 'hi', v_cl_hi, 'where', v_cl_where, 'source', v_cl_src, 'at', v_cl_at));
      v_cl_lo := v_lo; v_cl_hi := v_hi;
    end if;
    v_cl_where := left(coalesce(nullif(r.detail->>'droga', ''), nullif(r.detail->>'opis', ''), r.title, p_corridor), 70);
    v_cl_src := case r.kind
      when 'ROAD_SE' then 'TRAFIKVERKET'
      when 'ROAD_FI' then 'DIGITRAFFIC'
      else coalesce(nullif(left(r.detail->>'zrodlo', 40), ''), r.kind)
    end;
    v_cl_at := r.detected_at;
  end loop;
  if v_cl_hi is not null then
    v_clusters := v_clusters || jsonb_build_array(jsonb_build_object(
      'lo', v_cl_lo, 'hi', v_cl_hi, 'where', v_cl_where, 'source', v_cl_src, 'at', v_cl_at));
  end if;

  for v_cl in select value from jsonb_array_elements(v_clusters) as t(value)
  loop
    v_extra := greatest(1, round(
      ((v_cl->>'hi')::numeric - (v_cl->>'lo')::numeric) / 70.0 * 60.0 * (thr.slip_pct / 100.0)
    )::int);
    v_add := v_add + v_extra;
    v_weather := v_weather || jsonb_build_array(jsonb_build_object(
      'kind', 'SLIPPERY',
      'addMin', v_extra,
      'where', (v_cl->>'where') || ' · km ' || round((v_cl->>'lo')::numeric)::text,
      'atIso', coalesce((v_cl->>'at')::timestamptz, p_now),
      'source', v_cl->>'source'
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

comment on function public.e49_slip_weather_local(uuid, text, timestamptz) is
  'E49-a Z4: lokalna śliskość przed autem (promień od punktu, skupiska bez sumowania, statusy drogowe, świeża pozycja).';

-- Rdzeń ETA: rename + Z4 w samym rdzeniu.
-- Rename przez to_regprocedure (nie pg_get_function_identity_arguments) —
-- RETURNS TABLE ma OUT w katalogu; porównanie identity bywa mylące i pomija rename.
do $$
begin
  if to_regprocedure('public.compute_load_eta_core(uuid, timestamptz)') is null then
    if to_regprocedure('public.compute_load_eta(uuid, timestamptz)') is null then
      raise exception 'DP-205 0398: brak compute_load_eta(uuid, timestamptz) do rename';
    end if;
    execute 'alter function public.compute_load_eta(uuid, timestamptz) rename to compute_load_eta_core';
  end if;
  if to_regprocedure('public.compute_load_eta_core(uuid, timestamptz)') is null then
    raise exception 'DP-205 0398: compute_load_eta_core nie istnieje po rename';
  end if;
end $$;

-- Z4 w rdzeniu (F7 #785 r1 pkt 3): mnożniki spowolnienia (slowdown_pl / slowdown_se z corridor_conditions)
-- NIE wchodzą do h_pl_eff / h_road_eff, więc h4_schedule_remaining układa przerwy i odpoczynki
-- z godzin jazdy bez mnożnika (×1,15 nie dokłada drugiego 11 h odpoczynku). Surowe v_slow_* zostają w causes
-- (wrapper zapisuje je jako observed_slowdown_*). Definicja rdzenia z 0389 (ostatnia przed 0398) — poprawka
-- dwóch przypisań na miejscu, bez kopiowania ~560 linii.
do $$
declare
  v_def text;
  v_new text;
begin
  v_def := pg_get_functiondef('public.compute_load_eta_core(uuid, timestamptz)'::regprocedure);
  if position('E49 Z4' in v_def) > 0 then
    return; -- już po poprawce
  end if;
  v_new := replace(v_def,
    'h_pl_eff := h_pl * v_slow_pl;',
    'h_pl_eff := h_pl;  -- E49 Z4: bez mnożnika całej trasy (śliskość lokalnie)');
  v_new := replace(v_new,
    'h_road_eff := h_road * v_slow_se;',
    'h_road_eff := h_road;  -- E49 Z4: bez mnożnika całej trasy (śliskość lokalnie)');
  if position('h_pl_eff := h_pl;  -- E49 Z4' in v_new) = 0
     or position('h_road_eff := h_road;  -- E49 Z4' in v_new) = 0 then
    raise exception 'DP-205 0398: rdzeń ETA nie ma oczekiwanych przypisań h_pl_eff / h_road_eff (Z4)';
  end if;
  execute v_new;
end $$;

-- Opakowanie: Z1 wiatr z prognozy (odcinek przed autem, godzina przejazdu) + Z4 lokalna śliskość.
create or replace function public.compute_load_eta(p_load uuid, p_now timestamptz default now())
returns table(eta timestamptz, conf_min integer, basis jsonb)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $function$
declare
  l record;
  v_eta timestamptz;
  v_conf int;
  v_basis jsonb;
  v_causes jsonb;
  v_status text;
  v_obs_se numeric;
  v_obs_pl numeric;
  v_flags jsonb;
  v_segs jsonb;
  v_wind jsonb;
  v_slip jsonb;
  v_weather jsonb := '[]'::jsonb;
  v_add int := 0;
  v_pl_corr text;
  v_se_corr text;
  v_prog text;
  v_rem numeric;
  v_total numeric;
  v_from numeric;
  v_start timestamptz;
  v_dh numeric;
  v_items jsonb;
  v_it jsonb;
  v_t timestamptz;
  v_h numeric;
  v_rest jsonb := '[]'::jsonb;
begin
  select c.eta, c.conf_min, c.basis
    into v_eta, v_conf, v_basis
    from public.compute_load_eta_core(p_load, p_now) c;

  -- brak ETA / ścieżki wczesne rdzenia (DONE, AT_SITE, FERRY, pre_load) — bez wiatru i śliskości
  if v_basis is null or v_eta is null or (v_basis->'causes') is null then
    return query select v_eta, v_conf, v_basis;
    return;
  end if;

  v_causes := v_basis->'causes';
  select * into l from loads where id = p_load;
  v_status := l.status::text;

  -- Z4: rdzeń już nie mnoży (patrz wyżej) — causes mówi uczciwie, co weszło do ETA (×1),
  -- a obserwowane spowolnienie korytarza zostaje osobno (Stan systemu czyta corridor_conditions).
  v_obs_se := coalesce(nullif(v_causes->>'slowdown_se', '')::numeric, 1);
  v_obs_pl := coalesce(nullif(v_causes->>'slowdown_pl', '')::numeric, 1);
  if v_obs_se > 1.001 or v_obs_pl > 1.001
     or coalesce(nullif(v_causes->>'weather_slowdown_pct', '')::numeric, 0) > 0 then
    v_causes := v_causes || jsonb_build_object(
      'weather_slowdown_pct', 0,
      'slowdown_se', 1,
      'slowdown_pl', 1,
      'observed_slowdown_se', v_obs_se,
      'observed_slowdown_pl', v_obs_pl
    );
    if (v_basis ? 'segments') then
      select coalesce(jsonb_agg(
               case when s ? 'slowdown_mult' then jsonb_set(s, '{slowdown_mult}', '1'::jsonb) else s end
               order by o), '[]'::jsonb)
        into v_segs
        from jsonb_array_elements(v_basis->'segments') with ordinality as t(s, o);
      v_basis := jsonb_set(v_basis, '{segments}', v_segs);
    end if;
    v_flags := coalesce((
      select jsonb_agg(f)
        from jsonb_array_elements_text(coalesce(v_basis->'flags', '[]'::jsonb)) f
       where f not like 'spowolnienie %'
    ), '[]'::jsonb) || jsonb_build_array('E49 Z4: śliskość tylko lokalnie (bez × całej trasy)');
    v_basis := jsonb_set(v_basis, '{flags}', v_flags);
  end if;

  v_pl_corr := nullif(v_causes->>'pl_corridor', '');
  v_se_corr := nullif(v_causes->>'se_corridor', '');
  v_prog := v_causes->>'progress';
  v_rem := nullif(v_causes->>'remaining_km', '')::numeric;

  -- Z1, odcinek PL (tylko przed promem): od postępu auta, godzina przejazdu = teraz / start z planu załadunku.
  if v_status in ('READY', 'AT_LOADING', 'IN_TRANSIT_PL') and v_pl_corr is not null then
    select cp.total_km into v_total from corridor_polylines cp where cp.code = v_pl_corr;
    if v_total is not null then
      v_from := 0;
      if v_status = 'IN_TRANSIT_PL' and v_prog = 'corridor' and v_rem is not null then
        v_from := greatest(0, v_total - v_rem);
      end if;
      if v_status = 'IN_TRANSIT_PL' then
        v_start := p_now;
      else
        v_start := greatest(p_now, coalesce(
          l.plan_load_to, l.plan_load_from,
          (l.plan_load_date + time '12:00') at time zone 'Europe/Warsaw', p_now));
      end if;
      v_dh := least(24, greatest(0, v_total - v_from) / 70.0);
      v_wind := public.e49_wind_weather_for_corridor(v_pl_corr, v_from, v_start, v_dh, p_now, '[]'::jsonb);
      v_weather := v_weather || coalesce(v_wind->'weather', '[]'::jsonb);
      v_add := v_add + coalesce((v_wind->>'add_min')::int, 0);
    end if;
  end if;

  -- Z1, odcinek SE/FI: po promie od zjazdu z promu (CROSSING.arrival), w SE od teraz;
  -- korytarz = se_corridor tego transportu (z trasy), nie domyślny dla transportów jeszcze w PL.
  if v_status in ('READY', 'AT_LOADING', 'IN_TRANSIT_PL', 'AT_PORT_GDANSK', 'AT_PORT_NYNASHAMN', 'IN_TRANSIT_SE')
     and v_se_corr is not null then
    if v_status in ('AT_PORT_NYNASHAMN', 'IN_TRANSIT_SE') then
      v_start := p_now;
    else
      select (s->>'arrival')::timestamptz into v_start
        from jsonb_array_elements(coalesce(v_basis->'segments', '[]'::jsonb)) s
       where s->>'code' = 'CROSSING' and nullif(s->>'arrival', '') is not null
       limit 1;
    end if;
    select cp.total_km into v_total from corridor_polylines cp where cp.code = v_se_corr;
    if v_start is not null and v_total is not null then
      v_from := 0;
      if v_status = 'IN_TRANSIT_SE' and v_prog = 'corridor' and v_rem is not null then
        v_from := greatest(0, v_total - v_rem);
      end if;
      -- okna odpoczynku / przerw H-4 z rdzenia (sekwencja liczona od v_start)
      select s->'items' into v_items
        from jsonb_array_elements(coalesce(v_basis->'segments', '[]'::jsonb)) s
       where s->>'code' = 'H4_SEGMENTS'
       limit 1;
      v_t := v_start;
      for v_it in select e from jsonb_array_elements(coalesce(v_items, '[]'::jsonb)) as t(e)
      loop
        v_h := coalesce(nullif(v_it->>'hours', '')::numeric, 0);
        if v_it->>'code' in ('EU_DAILY_REST', 'EU_BREAK_45') then
          v_rest := v_rest || jsonb_build_array(jsonb_build_object(
            'from', v_t, 'to', v_t + make_interval(secs => (v_h * 3600)::int)));
        end if;
        v_t := v_t + make_interval(secs => (v_h * 3600)::int);
      end loop;
      v_dh := least(24, greatest(0, v_total - v_from) / 70.0);
      v_wind := public.e49_wind_weather_for_corridor(v_se_corr, v_from, v_start, v_dh, p_now, v_rest);
      v_weather := v_weather || coalesce(v_wind->'weather', '[]'::jsonb);
      v_add := v_add + coalesce((v_wind->>'add_min')::int, 0);
    end if;
  end if;

  -- Z4 lokalnie (tylko jazda drogą, świeża pozycja, przed autem)
  if v_status = 'IN_TRANSIT_PL' then
    v_slip := public.e49_slip_weather_local(p_load, v_pl_corr, p_now);
  elsif v_status = 'IN_TRANSIT_SE' then
    v_slip := public.e49_slip_weather_local(p_load, v_se_corr, p_now);
  end if;
  if v_slip is not null then
    v_weather := v_weather || coalesce(v_slip->'weather', '[]'::jsonb);
    v_add := v_add + coalesce((v_slip->>'add_min')::int, 0);
  end if;

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
  'E49-a: wrapper — Z1 wiatr (odcinek przed autem, postój minus H-4) + Z4 śliskość lokalnie; rdzeń = compute_load_eta_core (bez mnożnika całej trasy).';

-- Z2 (F7 #785 r1 pkt 5): jedna otwarta sprawa „Silny wiatr” na transport i korytarz
-- (dedup E49_WIND:{load}:{korytarz}); przy kolejnej prognozie aktualizacja tytułu/szczegółów w miejscu,
-- waga tylko w górę (20–24 → ≥25 = ta sama sprawa, jedno RISK_SEVERITY), bez nowego RISK_OPEN.
-- Reszta funkcji = 0380.
create or replace function raise_integration_risk(
  p_project uuid, p_load uuid, p_kind risk_kind, p_sev risk_severity, p_title text, p_detail jsonb,
  p_dedup text, p_source_url text default null, p_valid_until timestamptz default null
) returns boolean language plpgsql security definer set search_path = public as $$
declare
  n int;
  v_id uuid;
  v_detail jsonb;
  v_title_key text;
  v_title text;
begin
  if p_dedup is null or length(p_dedup) = 0 then
    raise exception 'raise_integration_risk: wymagany klucz deduplikacji';
  end if;

  if exists (
    select 1 from risk_signals
     where dedup_key = p_dedup and resolved_at is null
  ) then
    if p_kind in ('ROAD_SE', 'ROAD_PL', 'ROAD_LT', 'ROAD_LV', 'ROAD_EE', 'ROAD_FI')
       and p_load is null then
      v_title_key := nullif(coalesce(p_detail, '{}'::jsonb)->>'title_key', '');
      v_detail := coalesce(p_detail, '{}'::jsonb) - 'title_key';
      if (v_detail ? 'params') is not true then
        v_detail := v_detail || '{"params":{}}'::jsonb;
      end if;
      v_title := public.tower_public_title(null, p_title, 'CODE');
      update risk_signals
         set severity = p_sev,
             title = v_title,
             title_key = coalesce(v_title_key, title_key),
             detail = v_detail,
             source_url = coalesce(p_source_url, source_url),
             valid_until = coalesce(p_valid_until, valid_until)
       where dedup_key = p_dedup and resolved_at is null
         and (severity, title, title_key, detail, coalesce(source_url, ''), valid_until)
             is distinct from
             (p_sev, v_title, coalesce(v_title_key, title_key), v_detail,
              coalesce(coalesce(p_source_url, source_url), ''),
              coalesce(p_valid_until, valid_until));
    elsif p_kind = 'WEATHER' and p_load is not null and p_dedup like 'E49\_WIND:%' then
      v_title_key := nullif(coalesce(p_detail, '{}'::jsonb)->>'title_key', '');
      v_detail := coalesce(p_detail, '{}'::jsonb) - 'title_key';
      if (v_detail ? 'params') is not true then
        v_detail := v_detail || '{"params":{}}'::jsonb;
      end if;
      v_title := public.tower_public_title(p_load, p_title, 'CODE');
      update risk_signals
         set severity = greatest(severity, p_sev),
             title = v_title,
             title_key = coalesce(v_title_key, title_key),
             detail = v_detail,
             valid_until = coalesce(p_valid_until, valid_until)
       where dedup_key = p_dedup and resolved_at is null
         and (severity, title, title_key, detail, valid_until)
             is distinct from
             (greatest(severity, p_sev), v_title, coalesce(v_title_key, title_key), v_detail,
              coalesce(p_valid_until, valid_until));
    end if;
    return false;
  end if;

  -- Klucze bez daty (np. SOURCE_DOWN:EMTRACK_WEB): miganie open/close nie tworzy nowego wiersza.
  if p_dedup ~ '^SOURCE_DOWN:[A-Z0-9_]+$' then
    select id into v_id
      from risk_signals
     where dedup_key = p_dedup
       and resolved_at is not null
       and resolved_at > now() - interval '60 minutes'
     order by resolved_at desc
     limit 1;
    if v_id is not null then
      update risk_signals
         set resolved_at = null,
             severity = p_sev,
             title = p_title,
             detail = coalesce(p_detail, '{}'::jsonb),
             source_url = coalesce(p_source_url, source_url),
             valid_until = p_valid_until
       where id = v_id;
      return false;
    end if;
  end if;

  insert into risk_signals (project_id, load_id, kind, severity, title, detail, source_url, valid_until, dedup_key)
  values (coalesce((select project_id from loads where id = p_load), p_project), p_load, p_kind, p_sev, p_title,
          coalesce(p_detail, '{}'::jsonb), p_source_url, p_valid_until, p_dedup)
  on conflict (dedup_key) where dedup_key is not null and resolved_at is null do nothing;
  get diagnostics n = row_count;
  return n > 0;
end $$;

revoke execute on function raise_integration_risk(uuid, uuid, risk_kind, risk_severity, text, jsonb, text, text, timestamptz)
  from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function raise_integration_risk(uuid, uuid, risk_kind, risk_severity, text, jsonb, text, text, timestamptz)
      to service_role;
  end if;
end $$;

-- Z2 odbiorcy: „Silny wiatr” / „Postój przez wiatr” (WEATHER + detail.audience=HHL_PRZEWOZNIK) = HHL + SCX,
-- nie KSH (jak 0394 dla FERRY). Reszta = 0394.
create or replace function public.risk_audience_for(p_kind text, p_detail jsonb)
returns risk_audience language plpgsql stable security definer set search_path = public as $$
declare v_dir text; v_inv text;
begin
  if auth.uid() is not null and current_app_user_id() is null then
    raise exception 'Brak aktywnego konta' using errcode = '42501';
  end if;
  -- #398: cisza naczepy emtrack → tylko HHL (bez przewoźnika)
  if p_kind = 'SILENT_VEHICLE' and coalesce(p_detail->>'emtrack_trailer', '') = '1' then
    return 'HHL';
  end if;
  -- DP-121 F7 #782 r2: sygnał HHL (cancelled / cancel-suspect / ERR) — nie dla KSH/SCX
  if p_kind = 'FERRY' and coalesce(p_detail->>'audience', '') = 'HHL' then
    return 'HHL';
  end if;
  -- DP-205 E49-a Z2: wiatr na trasie — HHL + przewoźnik (SCX), bez klienta
  if p_kind = 'WEATHER' and coalesce(p_detail->>'audience', '') = 'HHL_PRZEWOZNIK' then
    return 'HHL_PRZEWOZNIK';
  end if;
  if p_kind in (
    'FERRY', 'ROAD_SE', 'ROAD_PL', 'ROAD_LT', 'ROAD_LV', 'ROAD_EE', 'ROAD_FI',
    'WEATHER', 'ETA_BREACH'
  ) then
    return 'WSZYSCY';
  end if;
  if p_kind = 'RESOURCE_MISSING' and coalesce(p_detail->>'rule', '') = 'ORDER_NO'
     and coalesce(p_detail->>'side', '') = 'HHL' then
    return 'HHL';
  end if;
  -- DP-203 F7 #780 r2: luka słownika Trafikverket — tylko HHL (nie HHL_PRZEWOZNIK)
  if p_kind = 'RESOURCE_MISSING' and coalesce(p_detail->>'rule', '') = 'TV_CODE' then
    return 'HHL';
  end if;
  if p_kind in ('SILENT_VEHICLE', 'AUTO_STATUS', 'LOADING_UNCONFIRMED', 'RESOURCE_MISSING',
                'DOC_MISSING', 'PERMIT', 'INSURANCE', 'LATE_DATE_CHANGE', 'ROUTE_OBSTACLE') then
    return 'HHL_PRZEWOZNIK';
  end if;
  if p_kind in ('SEQUENCE', 'DATES_UNCONFIRMED') then
    return 'HHL_KLIENT';
  end if;
  if p_kind = 'INVOICE_MISMATCH' then
    v_dir := upper(coalesce(p_detail->>'direction', ''));
    v_inv := p_detail->>'invoice_id';
    if v_dir = '' and v_inv ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      select i.direction::text into v_dir from invoices i where i.id = v_inv::uuid;
    end if;
    return case coalesce(v_dir, '')
             when 'KOSZT' then 'HHL_PRZEWOZNIK'
             when 'PRZYCHOD' then 'HHL_KLIENT'
             else 'HHL' end;
  end if;
  return 'HHL';
end $$;

revoke all on function public.risk_audience_for(text, jsonb) from public, anon;
grant execute on function public.risk_audience_for(text, jsonb) to authenticated;
comment on function public.risk_audience_for(text, jsonb) is
  'BN6 + DP-203 TV_CODE + DP-121 FERRY audience=HHL + DP-205 E49 WEATHER audience=HHL_PRZEWOZNIK.';

-- F7 #785 r2: macierz powiadomień respektuje risk_signals.audience (RLS Ryzyk ≠ dzwonki).
-- HHL → tylko FORWARDER; HHL_PRZEWOZNIK → FORWARDER+CARRIER (bez CLIENT/KSH);
-- HHL_KLIENT → FORWARDER+CLIENT; WSZYSCY → bez filtra org.
create or replace function public.trg_risk_matrix_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_group text;
  v_tpl text;
  v_proj uuid;
  v_n int;
  v_url text;
  v_code text;
  v_payload jsonb;
  v_dedup text;
begin
  if new.load_id is null
     and new.kind::text in ('FERRY', 'WEATHER', 'ROAD_SE', 'ROAD_PL') then
    return null;
  end if;
  if new.load_id is null
     and new.kind::text in ('ROAD_LT', 'ROAD_LV', 'ROAD_EE', 'ROAD_FI')
     and new.severity::text not in ('HIGH', 'CRITICAL') then
    if tg_op = 'UPDATE'
       and old.severity::text in ('HIGH', 'CRITICAL') then
      perform public.notify_mark_case_closed('sprawa zamknięta', null, new.id);
    end if;
    return null;
  end if;
  if new.kind::text in ('ROAD_LT', 'ROAD_LV', 'ROAD_EE', 'ROAD_FI', 'ROAD_SE')
     and coalesce(new.detail->>'obok_trasy', '') = 'true' then
    if tg_op = 'UPDATE'
       and old.severity::text in ('HIGH', 'CRITICAL') then
      perform public.notify_mark_case_closed('sprawa zamknięta', null, new.id);
    end if;
    return null;
  end if;
  if current_setting('tower.escalate_overdue', true) = '1'
     and coalesce(new.dedup_key, '') like 'decision-overdue:%' then
    return null;
  end if;

  v_group := case
    when new.kind::text in ('FERRY', 'WEATHER', 'ETA_BREACH') then 'RISK_FERRY_WEATHER'
    when new.kind::text in ('INVOICE_MISMATCH') then 'MONEY'
    when new.kind::text in ('USAGE_LIMIT', 'JOB_FAILURE') then 'SYSTEM'
    else 'SYSTEM'
  end;

  if tg_op = 'INSERT' then
    v_tpl := 'RISK_OPEN';
  elsif new.severity is distinct from old.severity then
    v_tpl := 'RISK_SEVERITY';
  elsif new.resolved_at is not null and old.resolved_at is null then
    v_n := public.notify_mark_case_closed('sprawa zamknięta', null, new.id);
    insert into public.audit_log (user_id, action, entity, entity_id, old_value, new_value)
    values (
      null, 'C1_RISK_RESOLVE_MARK_READ', 'risk_signals', new.id::text,
      jsonb_build_object('template', 'RISK_RESOLVED_skipped'),
      jsonb_build_object('marked', v_n, 'hotfix', '0256')
    );
    return null;
  else
    return null;
  end if;

  if v_tpl = 'RISK_SEVERITY'
     and new.severity::text = 'CRITICAL'
     and coalesce(new.detail->>'l3_level', '') = 'critical' then
    return null;
  end if;

  v_proj := new.project_id;
  if v_proj is null and new.load_id is not null then
    select project_id into v_proj from loads where id = new.load_id;
  end if;
  if new.load_id is not null then
    select coalesce(nullif(l.order_no, ''), nullif(l.hhl_order_no, ''))
      into v_code from loads l where l.id = new.load_id;
  end if;
  v_payload := jsonb_build_object(
    'risk_id', new.id, 'kind', new.kind, 'severity', new.severity,
    'title', new.title, 'title_key', new.title_key,
    'code', v_code, 'load_id', new.load_id,
    'risk_audience', new.audience::text
  );
  v_url := public.notify_click_url(v_tpl, v_payload, new.load_id);
  v_payload := v_payload || jsonb_build_object('url', v_url);
  v_dedup := 'risk:' || v_tpl || ':' || new.id::text || ':' || new.severity::text;

  if new.audience = 'HHL' then
    perform public.matrix_notify(v_group, v_tpl, new.load_id, v_proj, v_payload, v_dedup, 'FORWARDER');
  elsif new.audience = 'HHL_PRZEWOZNIK' then
    perform public.matrix_notify(v_group, v_tpl, new.load_id, v_proj, v_payload, v_dedup, 'FORWARDER');
    perform public.matrix_notify(v_group, v_tpl, new.load_id, v_proj, v_payload, v_dedup, 'CARRIER');
  elsif new.audience = 'HHL_KLIENT' then
    perform public.matrix_notify(v_group, v_tpl, new.load_id, v_proj, v_payload, v_dedup, 'FORWARDER');
    perform public.matrix_notify(v_group, v_tpl, new.load_id, v_proj, v_payload, v_dedup, 'CLIENT');
  else
    perform public.matrix_notify(v_group, v_tpl, new.load_id, v_proj, v_payload, v_dedup);
  end if;
  return null;
end $$;

revoke all on function public.trg_risk_matrix_notify() from public, anon, authenticated;
comment on function public.trg_risk_matrix_notify() is
  'DP-156/203 + F7 #785 r2: audience HHL/HHL_PRZEWOZNIK/HHL_KLIENT → matrix_notify bez KSH (i bez SCX przy HHL).';

-- Lista kopii: corridor_wind_forecast wchodzi z katalogu automatycznie (I-2B).

notify pgrst, 'reload schema';

commit;
