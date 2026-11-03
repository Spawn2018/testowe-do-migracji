-- 0389 DP-193 + DP-194 (#762 C2; F7 #770 decyzja 97)
-- DP-193: eta_basis.flags — zwinąć powtórzenia (np. przerwy z GPS ×N), maks. 12 pozycji (+N przy obcięciu).
-- DP-194: SE_E4 alarm OFF_CORRIDOR zostaje OSM; corridor_geom=here tylko obserwacja przy świeżym HERE.
--         Alarm HERE SE-NYN → DP-197 (kontrola przebiegu / via).

select set_config('tower.audit_source', 'migracja 0389 (DP-193 flags + DP-194 SE_E4 HERE)', true);

create or replace function public.eta_flags_collapse(p_flags text[])
returns text[]
language plpgsql
immutable
set search_path = public
as $$
declare
  v_seen text[] := '{}';
  v_cnt int[] := '{}';
  v_out text[] := '{}';
  f text;
  i int;
  idx int;
  n int;
  label text;
  max_n constant int := 12;
begin
  if p_flags is null then
    return '{}'::text[];
  end if;
  foreach f in array p_flags loop
    if f is null or btrim(f) = '' then
      continue;
    end if;
    idx := array_position(v_seen, f);
    if idx is null then
      v_seen := array_append(v_seen, f);
      v_cnt := array_append(v_cnt, 1);
    else
      v_cnt[idx] := v_cnt[idx] + 1;
    end if;
  end loop;
  n := coalesce(array_length(v_seen, 1), 0);
  -- F7 #770 opcjonalnie: przy obcięciu zostaw miejsce na „+N” (H-4 nie znikają bez śladu).
  if n > max_n then
    n := max_n - 1;
  end if;
  for i in 1..n loop
    if v_cnt[i] > 1 then
      if v_seen[i] = 'przerwa z GPS' then
        label := format('przerwy z GPS ×%s', v_cnt[i]);
      else
        label := format('%s ×%s', v_seen[i], v_cnt[i]);
      end if;
    else
      label := v_seen[i];
    end if;
    v_out := array_append(v_out, label);
  end loop;
  if coalesce(array_length(v_seen, 1), 0) > max_n then
    v_out := array_append(v_out, format('+%s', coalesce(array_length(v_seen, 1), 0) - n));
  end if;
  return v_out;
end;
$$;

revoke all on function public.eta_flags_collapse(text[]) from public, anon, authenticated;
grant execute on function public.eta_flags_collapse(text[]) to service_role;
comment on function public.eta_flags_collapse(text[]) is
  'DP-193: unikalne flagi ETA w kolejności pierwszego wystąpienia; powtórzenia jako ×N; maks. 12 (+N).';


create or replace function public.h4_driver_state_from_gps(
  p_load uuid,
  p_now timestamptz default now()
)
returns table (
  driven_since_rest_h numeric,
  driven_today_h numeric,
  since_break_h numeric,
  extended_used int,
  last_rest_end timestamptz,
  cautious boolean,
  flags text[],
  source text
)
language plpgsql stable security definer set search_path = public as $$
declare
  v_swap timestamptz;
  v_ferry_arr timestamptz;
  v_since timestamptz;
  r record;
  prev_ts timestamptz;
  prev_g geometry;
  dt_h numeric;
  dist_km numeric;
  avg_spd numeric;
  stop_h numeric := 0;
  drive_acc numeric := 0;
  today_acc numeric := 0;
  since_brk numeric := 0;
  last_rest timestamptz := null;
  ext_used int := 0;
  v_flags text[] := '{}';
  v_cautious boolean := false;
  day_start timestamptz;
  n_pos int := 0;
  short15 numeric := 0;
begin
  select trailer_swap_at into v_swap from loads where id = p_load;

  -- przyjazd promu (D-9: odpoczynek na promie) — reset zegara
  select max(occurred_at) into v_ferry_arr
    from load_events
   where load_id = p_load
     and event_type in ('GEOFENCE_EXIT','FERRY_ARRIVAL','STATUS')
     and (
       coalesce(payload->>'status','') in ('IN_TRANSIT_SE','APPROACHING_SITE')
       or coalesce(payload->>'geofence_kind','') in ('PORT_SE','PORT_NYN','PORT_KAA')
       or coalesce(payload->>'code','') in ('FERRY_ARRIVED','LEFT_FERRY')
     );

  v_since := p_now - interval '14 days';
  if v_swap is not null and v_swap > v_since then
    v_since := v_swap;
    v_flags := array_append(v_flags, 'przepięcie — zegar od trailer_swap_at'::text);
  end if;
  if v_ferry_arr is not null and v_ferry_arr > v_since then
    v_since := v_ferry_arr;
    last_rest := v_ferry_arr;
    v_flags := array_append(v_flags, 'odpoczynek na promie (D-9) — reset po przybyciu'::text);
  end if;

  day_start := date_trunc('day', p_now at time zone 'Europe/Warsaw') at time zone 'Europe/Warsaw';

  for r in
    select ts, geom_raw as g, speed_kmh
      from positions
     where load_id = p_load and ts >= v_since and ts <= p_now
     order by ts
  loop
    n_pos := n_pos + 1;
    if prev_ts is not null then
      dt_h := extract(epoch from (r.ts - prev_ts)) / 3600.0;
      if dt_h > 0 and dt_h < 48 then
        dist_km := st_distance(prev_g::geography, r.g::geography) / 1000.0;
        avg_spd := case when dt_h > 0 then dist_km / dt_h else 0 end;
        if coalesce(r.speed_kmh, avg_spd) < 5 or (dist_km < 0.8 and dt_h >= 0.25) then
          -- postój
          stop_h := stop_h + dt_h;
          if dt_h >= 0.25 and dt_h < 0.5 then
            short15 := short15 + dt_h;
          end if;
          if stop_h >= 11 then
            last_rest := r.ts;
            drive_acc := 0; since_brk := 0; stop_h := 0; short15 := 0;
            v_flags := array_append(v_flags, 'odpoczynek dobowy regularny (≥11 h) z GPS'::text);
          elsif stop_h >= 9 then
            last_rest := r.ts;
            drive_acc := 0; since_brk := 0; stop_h := 0; short15 := 0;
            v_flags := array_append(v_flags, 'odpoczynek dobowy skrócony (≥9 h) z GPS'::text);
          elsif stop_h >= 0.75 or (short15 >= 0.25 and stop_h >= 0.5) then
            -- przerwa 45 min albo 15+30
            since_brk := 0; stop_h := 0; short15 := 0;
            v_flags := array_append(v_flags, 'przerwa z GPS'::text);
          end if;
        else
          -- jazda
          stop_h := 0; short15 := 0;
          drive_acc := drive_acc + dt_h;
          since_brk := since_brk + dt_h;
          if r.ts >= day_start then
            today_acc := today_acc + dt_h;
          end if;
        end if;
      end if;
    end if;
    prev_ts := r.ts;
    prev_g := r.g;
  end loop;

  if n_pos < 2 then
    v_cautious := true;
    -- założenie ostrożne: blisko limitu dnia, bez historii odpoczynku
    drive_acc := 8.5;
    today_acc := 8.5;
    since_brk := 4.0;
    v_flags := array_append(v_flags, 'brak historii GPS — założenie ostrożne (8,5 h jazdy)'::text);
  elsif last_rest is null then
    -- Pozycje są, ale system NIE zna ostatniego odpoczynku dobowego
    -- (historia zaczyna się w trasie / emtrack włączony mid-trip) → NIE jak świeży kierowca.
    -- Limit jazdy może się kończyć; odpoczynek wstawiony najpóźniej wg UE (schedule z 8,5 h).
    v_cautious := true;
    drive_acc := 8.5;
    today_acc := 8.5;
    since_brk := 4.0;
    v_flags := array_append(v_flags,
      'brak wykrytego odpoczynku dobowego — założenie ostrożne (limit jazdy może się kończyć)'::text);
  end if;

  -- dni 10 h w tygodniu: przybliżenie z długich dni jazdy (bez tachografu)
  select count(*)::int into ext_used
    from (
      select date_trunc('day', ts at time zone 'Europe/Warsaw') as d,
             sum(greatest(0, coalesce(speed_kmh, 0))) as dummy
        from positions
       where load_id = p_load and ts >= p_now - interval '7 days'
       group by 1
    ) x;
  ext_used := 0; -- bez tachografu nie zgadujemy; 0 = ostrożniej (limit 9 h)

  -- DP-193: zwinąć powtórzenia (przerwa z GPS ×N) przed zwrotem
  v_flags := public.eta_flags_collapse(v_flags);

  return query select
    round(drive_acc, 2),
    round(today_acc, 2),
    round(since_brk, 2),
    ext_used,
    last_rest,
    v_cautious,
    v_flags,
    case when v_cautious then 'cautious' else 'gps' end;
end $$;;

create or replace function public.compute_load_eta(p_load uuid, p_now timestamp with time zone DEFAULT now())
 returns table(eta timestamp with time zone, conf_min integer, basis jsonb)
 language plpgsql
 stable security definer
 set search_path = public, pg_temp
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
  h_pl_eff numeric;
  v_slow_pl numeric := 1.00;
  v_slow_se numeric := 1.00;
  v_slow_reason_pl text;
  v_slow_reason_se text;
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
  v_load_route text;
  v_family text;           -- BN8b: rodzina trasy (load_route_family)
  v_pl_corr text;          -- BN8b: korytarz przed promem
  v_se_corr text;          -- korytarz po promie / SE (SE_E22 / inland / SE_E4 / BN7)
  v_pl_leg text;           -- BN8b F7: leg HERE przed promem (nie corridor_code)
  v_se_leg text;           -- BN8b F7: leg HERE po promie
  v_se_road_code text;     -- kod godzin SE_ROAD(_KAA[_INLAND]) / FI_ROAD
  v_is_kaa boolean := false;
  v_corridor_geom text := null;
  v_here_fetched timestamptz := null;
  v_method text := 'ETA v2 (OSM)';
begin
  select * into l from loads where id = p_load;
  if not found then return; end if;
  v_status := l.status;
  -- BN8b/#720: rodzina z load_route_family; null = regresja GDN-NYN (jak dotąd).
  v_load_route := public.load_route_family(p_load);
  v_family := coalesce(public.eta_obs_route_family(v_load_route), 'GDN-NYN');
  v_op := public.eta_obs_operator_key(v_load_route);

  select hours, spread_pct / 100 into h_pl, sp_pl
    from eta_segment_params
   where code = public.eta_obs_segment_code(v_family, 'PL_ROAD');
  -- PORT_CHECKIN per port (EE 2 h — 82-C); fallback ogólny.
  select hours into h_ci from eta_segment_params
   where code = coalesce(
     public.eta_obs_segment_code(v_family, 'PORT_CHECKIN'),
     'PORT_CHECKIN'
   );
  select hours, spread_pct / 100 into h_cross, sp_cross
    from eta_segment_params
   where code = public.eta_obs_segment_code(v_family, 'CROSSING');
  select hours, spread_pct / 100 into h_road, sp_road
    from eta_segment_params
   where code = public.eta_obs_segment_code(v_family, 'SE_ROAD');
  select hours, spread_pct / 100 into h_rest, sp_rest from eta_segment_params where code = 'SE_DAILY_REST';
  select hours, spread_pct / 100 into h_brk, sp_brk from eta_segment_params where code = 'SE_BREAKS';
  -- F7 r4: bez ogólnego coalesce(h_road,17)/(h_pl,4.5) — zasłaniały warianty ze słownika
  h_rest := coalesce(h_rest, 11); sp_rest := coalesce(sp_rest, 0);
  h_brk := coalesce(h_brk, 2); sp_brk := coalesce(sp_brk, 0.5);
  select hours into fresh_h from eta_segment_params where code = 'GPS_FRESH_MIN';
  h_ci := coalesce(h_ci, 2);
  h_cross := coalesce(h_cross, 18); sp_cross := coalesce(sp_cross, 0.15);
  fresh_h := coalesce(fresh_h, 1.5);

  -- BN8b F7 W2: leg trasy z ferry_routes.road_corridor_* (najpierw dokładny kod, nie family+limit 1).
  v_se_road_code := public.eta_obs_segment_code(v_family, 'SE_ROAD');
  v_is_kaa := coalesce(v_se_road_code, '') like '%KAA%';
  select ts, coalesce(geom_snapped, geom_raw) as g into p from positions where load_id = p_load order by ts desc limit 1;

  if v_load_route is not null then
    select fr.road_corridor_pre, h.corridor_code
      into v_pl_leg, v_pl_corr
      from public.ferry_routes fr
      join public.here_road_legs h on h.leg = fr.road_corridor_pre
     where fr.active and fr.code = upper(btrim(v_load_route))
     limit 1;
    select fr.road_corridor_post, h.corridor_code
      into v_se_leg, v_se_corr
      from public.ferry_routes fr
      join public.here_road_legs h on h.leg = fr.road_corridor_post
     where fr.active and fr.code = upper(btrim(v_load_route))
     limit 1;
  end if;
  v_pl_corr := coalesce(v_pl_corr, 'PL_ROAD');

  if v_is_kaa then
    v_se_corr := public.stena_se_eta_corridor(p.g);
    if v_se_corr in ('SE_KAA_INLAND', 'SE_KAA_TRACK') then
      v_se_road_code := 'SE_ROAD_KAA_INLAND';
      if exists (select 1 from eta_segment_params where code = 'SE_ROAD_KAA_INLAND') then
        select hours, spread_pct / 100 into h_road, sp_road
          from eta_segment_params where code = 'SE_ROAD_KAA_INLAND';
      end if;
    else
      v_se_corr := coalesce(v_se_corr, 'SE_E22');
    end if;
  else
    v_se_corr := coalesce(v_se_corr, 'SE_E4');
  end if;

  -- F7 W1/N1: v_slow_pl (ROAD_LT/LV/EE) tylko przy PL_EE_E67 i status < FERRY;
  -- inaczej 1.00 (rdzeń GDN-NYN/GDY-KAA bez zmian; po promie nie mnoży h_pl).
  -- v_slow_se (ROAD_FI / SE_*) × h_road.
  select max(slowdown_mult), string_agg(reason, '; ' order by corridor)
    into v_slow_pl, v_slow_reason_pl
    from corridor_conditions
   where corridor in ('ROAD_LT', 'ROAD_LV', 'ROAD_EE');
  v_slow_pl := coalesce(v_slow_pl, 1.00);
  if v_pl_corr is distinct from 'PL_EE_E67' or v_status >= 'FERRY' then
    v_slow_pl := 1.00;
    v_slow_reason_pl := null;
  end if;

  select slowdown_mult, reason into v_slow_se, v_slow_reason_se
    from corridor_conditions where corridor = v_se_corr;
  if v_slow_se is null and v_se_corr = 'FI_E75' then
    select slowdown_mult, reason into v_slow_se, v_slow_reason_se
      from corridor_conditions where corridor = 'ROAD_FI';
  end if;
  -- N4: 'SE_E4' martwy w IN — pierwszy SELECT już trafia przy v_se_corr=SE_E4.
  if v_slow_se is null and v_se_corr in ('SE_E4_STO', 'SE_E18_KPS') then
    select slowdown_mult, reason into v_slow_se, v_slow_reason_se
      from corridor_conditions where corridor = 'SE_E4';
  end if;
  if v_slow_se is null and v_is_kaa and v_se_corr is distinct from 'SE_E22' then
    select slowdown_mult, reason into v_slow_se, v_slow_reason_se
      from corridor_conditions where corridor = 'SE_E22';
  end if;
  v_slow_se := coalesce(v_slow_se, 1.00);

  if v_slow_pl > 1.00 then
    v_flags := array_append(v_flags, format('spowolnienie PL ×%s (%s)', v_slow_pl, coalesce(v_slow_reason_pl, 'BN6')));
  end if;
  if v_slow_se > 1.00 then
    v_flags := array_append(v_flags, format('spowolnienie SE ×%s (%s)', v_slow_se, coalesce(v_slow_reason_se, 'BN6/BN7')));
  end if;
  v_weather_pct := round((greatest(v_slow_pl, v_slow_se) - 1) * 100);
  h_pl_eff := h_pl * v_slow_pl;
  h_road_eff := h_road * v_slow_se;
  h_se := h_road_eff + h_rest + h_brk;

  -- F7 W5/N3: corridor_geom = here|brak (alarm BN7); postęp ETA nadal OSM — method uczciwie.
  -- SE_E4: F7 #770 decyzja 97 — bez 'brak' (alarm działa po OSM); świeży HERE = obserwacja.
  if v_status = 'IN_TRANSIT_SE' and v_se_corr in ('FI_E75', 'SE_E4_STO', 'SE_E18_KPS') then
    if public.bn8b_here_leg_fresh(v_se_leg) then
      v_corridor_geom := 'here';
      select g.fetched_at into v_here_fetched from public.here_road_geometry g where g.leg = v_se_leg;
      v_method := 'ETA v2 (OSM; HERE tylko alarm)';
    else
      v_corridor_geom := 'brak';
    end if;
  elsif v_status = 'IN_TRANSIT_SE' and v_se_corr = 'SE_E4' then
    if public.bn8b_here_leg_fresh(v_se_leg) then
      v_corridor_geom := 'here';
      select g.fetched_at into v_here_fetched from public.here_road_geometry g where g.leg = v_se_leg;
      -- method bez „HERE tylko alarm” — alarm SE_E4 = OSM do DP-197
    end if;
  elsif v_status in ('IN_TRANSIT_PL', 'AT_PORT_GDANSK', 'READY', 'AT_LOADING')
        and v_pl_corr = 'PL_EE_E67' then
    if public.bn8b_here_leg_fresh(v_pl_leg) then
      v_corridor_geom := 'here';
      select g.fetched_at into v_here_fetched from public.here_road_geometry g where g.leg = v_pl_leg;
      v_method := 'ETA v2 (OSM; HERE tylko alarm)';
    else
      v_corridor_geom := 'brak';
    end if;
  end if;

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
     and public.ferry_geofence_matches_route(route, v_load_route)
   order by sort_order limit 1;
  if g_pout is null then
    select st_centroid(geom) into g_pout from geofences
     where project_id = l.project_id and kind = 'PORT_OUT' and active
     order by sort_order limit 1;
  end if;
  select st_centroid(geom) into g_pin from geofences
   where project_id = l.project_id and kind = 'PORT_IN' and active
     and public.ferry_geofence_matches_route(route, v_load_route)
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

  -- pozycja p pobrana wyżej (27B:C wybór korytarza SE)

  -- F7 #638: REMOVED jak CANCELLED (regresja vs 0315/0320).
  if v_status in ('CANCELLED','REMOVED') then
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
        select * into cp from corridor_progress(coalesce(v_se_corr, 'SE_E4'), p.g);
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
    -- F7 #638: v_comp.code = ten sam kod co v_segs (SE_ROAD_KAA*).
    v_comp := v_comp || jsonb_build_object('code',coalesce(v_se_road_code,'SE_ROAD'),'min',round(sch.drive_h * 60 * sp_road));
    v_var := v_var + (sch.break_h * 60 * sp_brk)^2; v_sum := v_sum + (sch.break_h * 60 * sp_brk);
    v_comp := v_comp || jsonb_build_object('code','SE_BREAKS','min',round(sch.break_h * 60 * sp_brk));
    -- H-4: niepewność odpoczynku > 0 (earlier/later); I-15 ±0% nie dotyczy rest z GPS
    v_var := v_var + (sch.rest_h * 60 * v_h4_rest_spread)^2; v_sum := v_sum + (sch.rest_h * 60 * v_h4_rest_spread);
    v_comp := v_comp || jsonb_build_object('code','H4_EU_REST','min',round(sch.rest_h * 60 * v_h4_rest_spread));
    v_segs := v_segs || jsonb_build_object('code',coalesce(v_se_road_code,'SE_ROAD'),'hours',round(sch.drive_h, 1),'spread_pct',round(sp_road * 100),'slowdown_mult',v_slow_se,'corridor',v_se_corr)
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
          select * into cp from corridor_progress(coalesce(v_pl_corr, 'PL_ROAD'), p.g);
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
            v_var := v_var + (h_pl_eff * 60 * 0.25)^2; v_sum := v_sum + (h_pl_eff * 60 * 0.25);
            v_comp := v_comp || jsonb_build_object('code','PL_NO_GPS','min',round(h_pl_eff * 60 * 0.25));
          end if;
        else
          v_flags := array_append(v_flags, 'brak świeżej pozycji — połowa odcinka PL'::text);
          v_var := v_var + (h_pl_eff * 60 * 0.25)^2; v_sum := v_sum + (h_pl_eff * 60 * 0.25);
          v_comp := v_comp || jsonb_build_object('code','PL_NO_GPS','min',round(h_pl_eff * 60 * 0.25));
        end if;
      end if;
      if v_status < 'IN_TRANSIT_PL' and v_start > p_now then v_flags := array_append(v_flags, 'przed załadunkiem — start z planu załadunku'::text); end if;
      v_drive_h := round(h_pl_eff * v_frac, 2);
      v_checkin_h := case when v_status = 'AT_PORT_GDANSK' then 0 else h_ci end;
      v_segs := v_segs || jsonb_build_object('code','PL_ROAD','hours',round(h_pl_eff * v_frac, 1),'spread_pct',round(sp_pl * 100),'slowdown_mult',v_slow_pl,'corridor',v_pl_corr);
      v_start := v_start + make_interval(secs => ((h_pl_eff * v_frac + v_checkin_h) * 3600)::int);
      if v_has then
        v_dep := v_sail.dep; v_arr := v_sail.arr; v_sail_src := 'przypisany';
        v_var := v_var + (30)^2; v_sum := v_sum + (30); v_comp := v_comp || jsonb_build_object('code','SAILING','min',round(30));
        if v_sail.delayed then v_var := v_var + (60)^2; v_sum := v_sum + (60); v_comp := v_comp || jsonb_build_object('code','SAILING_DELAYED','min',round(60)); end if;
        if v_start > v_dep then
          v_flags := array_append(v_flags, 'rejs zagrożony — dojazd i check-in po odejściu'::text);
          v_var := v_var + (12 * 60)^2; v_sum := v_sum + (12 * 60); v_comp := v_comp || jsonb_build_object('code','SAILING_AT_RISK','min',round(12 * 60));
        end if;
      else
        -- BN8b: założony rejs tylko z rodziny transportu (null → GDN-NYN jak Ś1).
        select coalesce(x.delayed_departure_at, x.departure_at), coalesce(x.delayed_arrival_at, x.arrival_at)
          into v_dep, v_arr
          from sailings x
         where x.project_id = l.project_id
           and public.eta_obs_route_family(x.route) = v_family
           and public.ferry_route_is_outbound(x.route)
           and x.status <> 'ODWOLANY'
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
    v_segs := v_segs || jsonb_build_object('code',coalesce(v_se_road_code,'SE_ROAD'),'hours',round(sch.drive_h, 1),'spread_pct',round(sp_road * 100),'slowdown_mult',v_slow_se,'corridor',v_se_corr)
                     || jsonb_build_object('code','H4_EU_REST','hours',round(sch.rest_h, 1),'spread_pct',round(v_h4_rest_spread * 100))
                     || jsonb_build_object('code','H4_EU_BREAKS','hours',round(sch.break_h, 1),'spread_pct',round(sp_brk * 100))
                     || jsonb_build_object('code','H4_SEGMENTS','items',sch.segments);
    v_var := v_var + (sch.drive_h * 60 * sp_road)^2; v_sum := v_sum + (sch.drive_h * 60 * sp_road);
    -- F7 #638: v_comp.code = ten sam kod co v_segs (SE_ROAD_KAA*).
    v_comp := v_comp || jsonb_build_object('code',coalesce(v_se_road_code,'SE_ROAD'),'min',round(sch.drive_h * 60 * sp_road));
    v_var := v_var + (sch.break_h * 60 * sp_brk)^2; v_sum := v_sum + (sch.break_h * 60 * sp_brk);
    v_comp := v_comp || jsonb_build_object('code','SE_BREAKS','min',round(sch.break_h * 60 * sp_brk));
    v_var := v_var + (sch.rest_h * 60 * v_h4_rest_spread)^2; v_sum := v_sum + (sch.rest_h * 60 * v_h4_rest_spread);
    v_comp := v_comp || jsonb_build_object('code','H4_EU_REST','min',round(sch.rest_h * 60 * v_h4_rest_spread));
    if v_status < 'FERRY' then
      v_var := v_var + (h_pl_eff * 60 * sp_pl)^2; v_sum := v_sum + (h_pl_eff * 60 * sp_pl);
      v_comp := v_comp || jsonb_build_object('code','PL_ROAD','min',round(h_pl_eff * 60 * sp_pl));
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
    'slowdown_pl', v_slow_pl,
    'slowdown_se', v_slow_se,
    'progress', v_progress,
    'remaining_km', v_rem_km,
    'off_corridor_m', v_off,
    'pl_corridor', v_pl_corr,
    'pl_leg', v_pl_leg,
    'se_corridor', v_se_corr,
    'se_leg', v_se_leg,
    'se_road_code', v_se_road_code,
    'corridor_geom', v_corridor_geom,
    'here_fetched_at', v_here_fetched,
    'h4', true,
    'h4_source', coalesce(st.source, 'n/a'),
    'h4_cautious', coalesce(st.cautious, false),
    'tachograph', 'none'
  );

  return query select v_eta, round(sqrt(v_var))::int, jsonb_build_object(
    'method', v_method, 'segment', v_seg, 'segments', v_segs,
    'band', jsonb_build_object('method', 'RSS', 'min', round(sqrt(v_var)), 'linear_sum_min', round(v_sum),
                               'components', (select coalesce(jsonb_agg(c), '[]'::jsonb) from jsonb_array_elements(v_comp) c where (c->>'min')::numeric > 0)),
    'flags', to_jsonb(public.eta_flags_collapse(v_flags)), 'sailing', v_sail_src,
    'attribution', v_attr, 'causes', v_causes,
    'corridor_geom', v_corridor_geom,
    'here_leg', coalesce(v_se_leg, v_pl_leg),
    'here_fetched_at', v_here_fetched,
    'computed_at', p_now);
end $function$;;

create or replace function public.refresh_load_eta(p_load uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  r record;
  l record;
  v_end timestamptz;
  v_delay int;
  v_has boolean;
  v_kind risk_kind;
  v_off numeric;
  v_max_off numeric := null;
  v_span numeric := 0;
  v_samples int := 0;
  v_blocked boolean := false;
  v_corr text;
  v_leg text;
  v_eta_ok boolean;
  v_op text;
  v_route text;
  v_stena_dual boolean := false;
  v_bn7 boolean := false;
  v_bn7_no_here boolean := false;
  v_here_fresh boolean := false;
  v_here_fetched timestamptz;
  v_here_line geometry; -- F7 N2: jedna LineString na refresh
  v_src_label text := 'OSM';
begin
  select * into r from compute_load_eta(p_load);
  select * into l from loads where id = p_load;
  if not found then return; end if;

  select load_delivery_deadline(l.plan_delivery_date, l.plan_delivery_to) into v_end;
  v_delay := case when r.eta is null or v_end is null then null
                  else greatest(0, round(extract(epoch from (r.eta - v_end)) / 60))::int end;

  v_blocked := l.status = 'FERRY' or l.status not in ('IN_TRANSIT_PL', 'IN_TRANSIT_SE');
  v_route := public.load_route_family(p_load);
  v_op := public.eta_obs_operator_key(v_route);

  -- F7 B2: leg z dokładnego kodu trasy (nie family + order by code limit 1).
  if l.status = 'IN_TRANSIT_SE' then
    v_kind := 'ROAD_SE'::risk_kind;
    if v_route is not null then
      select fr.road_corridor_post, h.corridor_code into v_leg, v_corr
        from public.ferry_routes fr
        join public.here_road_legs h on h.leg = fr.road_corridor_post
       where fr.active and fr.code = upper(btrim(v_route))
       limit 1;
    end if;
    if v_corr in ('SE_E22', 'SE_KAA_INLAND') or v_op = 'STENA' then
      v_stena_dual := true;
      v_corr := coalesce(nullif(v_corr, 'SE_KAA_INLAND'), 'SE_E22');
    end if;
  elsif l.status = 'IN_TRANSIT_PL' then
    v_kind := 'ROAD_PL'::risk_kind;
    if v_route is not null then
      select fr.road_corridor_pre, h.corridor_code into v_leg, v_corr
        from public.ferry_routes fr
        join public.here_road_legs h on h.leg = fr.road_corridor_pre
       where fr.active and fr.code = upper(btrim(v_route))
       limit 1;
    end if;
  else
    v_kind := 'ROAD_PL'::risk_kind;
    v_corr := null;
    v_leg := null;
  end if;

  -- W1/F7 r4: bez trasy — PL_ROAD tylko gdy oba ostatnie punkty w bbox PL.
  if v_corr is null and v_route is null and l.status = 'IN_TRANSIT_PL' then
    select case
             when count(*) >= 1
              and bool_and(
                    st_x(s.g::geometry) between 14.0 and 24.2
                    and st_y(s.g::geometry) between 49.0 and 54.45
                  )
             then 'PL_ROAD'
           end
      into v_corr
      from (
        select coalesce(geom_snapped, geom_raw) as g
          from public.positions
         where load_id = p_load
         order by ts desc
         limit 2
      ) s;
  end if;

  -- BN8b F7 B1/B2/B3: BN7 po legu HERE (bez kopiowania do corridor_polylines);
  -- corridor_geom dołączamy do r.basis PRZED pierwszym UPDATE.
  -- DP-194 F7 #770 decyzja 97: SE_E4 NIE w v_bn7 — alarm OSM; HERE alarm → DP-197.
  v_bn7 := v_corr in ('PL_EE_E67', 'FI_E75', 'SE_E4_STO', 'SE_E18_KPS');
  v_bn7_no_here := false;
  if v_bn7 then
    v_here_fresh := public.bn8b_here_leg_fresh(v_leg);
    if v_here_fresh is not true then
      v_bn7_no_here := true;
      r.basis := coalesce(r.basis, '{}'::jsonb)
                 || jsonb_build_object('corridor_geom', 'brak', 'here_leg', v_leg);
      if v_blocked is not true then
        v_blocked := true;
        v_samples := 0;
        v_max_off := 0;
        v_span := 0;
      end if;
    else
      select g.fetched_at into v_here_fetched
        from public.here_road_geometry g where g.leg = v_leg;
      r.basis := coalesce(r.basis, '{}'::jsonb)
                 || jsonb_build_object(
                      'corridor_geom', 'here',
                      'here_leg', v_leg,
                      'here_fetched_at', v_here_fetched
                    );
      v_src_label := 'HERE';
    end if;
  end if;

  perform set_config('tower.eta_ctx', 'on', true);
  update loads set eta_site = r.eta, eta_confidence_min = r.conf_min, eta_basis = r.basis, eta_computed_at = now(),
         delay_minutes = v_delay
   where id = p_load
     and (eta_site is distinct from r.eta or eta_confidence_min is distinct from r.conf_min
          or (eta_basis - 'computed_at') is distinct from (r.basis - 'computed_at')
          or delay_minutes is distinct from v_delay);
  perform set_config('tower.eta_ctx', '', true);

  v_has := exists (select 1 from positions p where p.load_id = p_load)
    or l.status in (
      'READY','AT_LOADING','IN_TRANSIT_PL','AT_PORT_GDANSK',
      'FERRY','AT_PORT_NYNASHAMN','IN_TRANSIT_SE','AT_SITE'
    );
  v_eta_ok := l3_eta_alarm(r.eta, v_end, v_has)
    and l.actual_delivery_at is null
    and l.status::text not in ('CANCELLED', 'REMOVED')
    and public.load_status_rank(l.status) < public.load_status_rank('AT_SITE'::public.load_status);

  if v_eta_ok then
    perform l3_upsert_alarm(l.project_id, p_load, 'ETA_BREACH', 'ETA_BREACH:' || p_load,
      format('Opóźnienie %s min wobec planu dostawy (próg %s)', v_delay, l3_ops('DELAY_MIN')),
      'rk_eta_breach', true, true, now() + interval '2 hours',
      jsonb_build_object('params', jsonb_build_object('minutes', v_delay, 'threshold', l3_ops('DELAY_MIN'))),
      now());
  else
    perform l3_upsert_alarm(l.project_id, p_load, 'ETA_BREACH', 'ETA_BREACH:' || p_load,
      'ETA', 'rk_eta_breach', false, false, null, '{}'::jsonb, now());
    update risk_signals set resolved_at = now()
     where load_id = p_load and kind = 'ETA_BREACH' and resolved_at is null
       and dedup_key = 'ETA_BREACH:' || p_load and coalesce(detail->>'l3', '') <> '1';
  end if;

  if v_bn7_no_here then
    null; -- bez pomiaru na przybliżeniu OSM; corridor_polylines zostaje OSM (D-81)
  elsif v_bn7 and v_blocked is not true then
    -- F7 B1/N2: dystans z here_road_geometry legu — linia raz, potem 2 próbki.
    v_here_line := public.bn8b_here_leg_line(v_leg);
    select count(*)::int,
           max(hp.off_m),
           min(hp.off_m),
           coalesce(extract(epoch from (max(s.ts) - min(s.ts))) / 60.0, 0),
           coalesce(bool_or(
             l3_in_port_or_yard(s.g)
             or public.bn8b_near_muu_pld_terminal(s.g)
           ), false)
      into v_samples, v_max_off, v_off, v_span, v_has
      from (
        select ts, coalesce(geom_snapped, geom_raw) as g
          from positions
         where load_id = p_load
         order by ts desc
         limit 2
      ) s
      cross join lateral public.bn8b_here_leg_progress_on_line(
        v_here_line, s.g, v_here_fetched
      ) hp;
    if coalesce(v_off, 0) <= l3_ops('OFFROUTE_KM') * 1000 then
      v_max_off := 0;
    end if;
    v_blocked := v_blocked or coalesce(v_has, false);
  elsif v_stena_dual is not true
     and (v_corr is null
          or not exists (
            select 1 from corridor_polylines cp
             where cp.code = v_corr and coalesce(cp.total_km, 0) > 0
          )) then
    v_blocked := true;
    v_samples := 0;
    v_max_off := 0;
    v_span := 0;
  elsif v_stena_dual is true
        and not exists (
          select 1 from corridor_polylines cp
           where cp.code = 'SE_E22' and coalesce(cp.total_km, 0) > 0
        )
        and not exists (
          select 1 from corridor_polylines cp
           where cp.code = public.stena_se_inland_corridor_code()
             and coalesce(cp.total_km, 0) > 0
        ) then
    v_blocked := true;
    v_samples := 0;
    v_max_off := 0;
    v_span := 0;
  else
    if v_stena_dual is true then
      select count(*)::int,
             max(n.off_m),
             min(n.off_m),
             coalesce(extract(epoch from (max(s.ts) - min(s.ts))) / 60.0, 0),
             coalesce(bool_or(l3_in_port_or_yard(s.g)), false),
             (array_agg(n.corridor_code order by s.ts desc))[1]
        into v_samples, v_max_off, v_off, v_span, v_has, v_corr
        from (
          select ts, coalesce(geom_snapped, geom_raw) as g
            from positions
           where load_id = p_load
           order by ts desc
           limit 2
        ) s
        cross join lateral stena_se_corridor_nearest(s.g) n;
    else
      select count(*)::int,
             max(cp.off_m),
             min(cp.off_m),
             coalesce(extract(epoch from (max(s.ts) - min(s.ts))) / 60.0, 0),
             coalesce(bool_or(
               l3_in_port_or_yard(s.g)
               or public.bn8b_near_muu_pld_terminal(s.g)
             ), false)
        into v_samples, v_max_off, v_off, v_span, v_has
        from (
          select ts, coalesce(geom_snapped, geom_raw) as g
            from positions
           where load_id = p_load
           order by ts desc
           limit 2
        ) s
        cross join lateral corridor_progress(v_corr, s.g) cp;
    end if;
    if coalesce(v_off, 0) <= l3_ops('OFFROUTE_KM') * 1000 then
      v_max_off := 0;
    end if;
    v_blocked := v_blocked or coalesce(v_has, false);
  end if;

  if l3_deviation_alarm(v_max_off, v_samples, v_span, v_blocked) then
    perform l3_upsert_alarm(l.project_id, p_load, v_kind, 'OFF_CORRIDOR:' || p_load,
      format('Zjazd z trasy z zezwolenia: %s m od korytarza %s (próg %s m)',
             round(v_max_off), v_src_label, l3_ops('OFFROUTE_KM') * 1000),
      'rk_off_corridor', true, true, now() + interval '1 hour',
      jsonb_build_object('params', jsonb_build_object(
        'meters', round(v_max_off), 'threshold', l3_ops('OFFROUTE_KM') * 1000,
        'corridor', v_corr, 'leg', v_leg, 'source', v_src_label)),
      now());
  else
    update risk_signals set resolved_at = now()
     where load_id = p_load and resolved_at is null and dedup_key = 'OFF_CORRIDOR:' || p_load;
    perform l3_lapse('OFF_CORRIDOR:' || p_load, now());
  end if;
end $$;;

revoke all on function public.h4_driver_state_from_gps(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.h4_driver_state_from_gps(uuid, timestamptz) to service_role;

revoke all on function public.compute_load_eta(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.compute_load_eta(uuid, timestamptz) to service_role;
comment on function public.compute_load_eta(uuid, timestamptz) is
  'DP-193 flags collapse; DP-194 SE_E4 corridor_geom=here tylko obserwacja; BN8b OSM postęp.';

revoke all on function public.refresh_load_eta(uuid) from public, anon, authenticated;
grant execute on function public.refresh_load_eta(uuid) to service_role;
comment on function public.refresh_load_eta(uuid) is
  'DP-194 F7 #770: SE_E4 OFF_CORRIDOR = OSM (HERE alarm → DP-197); Stena dual OSM bez zmian.';
