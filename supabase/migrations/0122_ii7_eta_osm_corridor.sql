-- =====================================================================
-- TOWER — Migracja 0122: II-7 własny silnik ETA na korytarzu OSM (ODbL)
--
--   D-28: bez HERE/TomTom. Trasa stała (zezwolenie) ≈ polyline OSM.
--   • corridor_polylines — linia PL (Śrem→Gdańsk) i SE (Nynäshamn→Boden)
--   • compute_load_eta v2: postęp = ST_LineLocatePoint; tempo z eta_segment_params;
--     SE × corridor_conditions.SE_E4.slowdown_mult (II-6); rejs z sailings
--     (GDN-NYN + GDY-KAA); odpoczynek/przerwy jak I-15; attribution ODbL
--   • >2 km od korytarza → ryzyko ROAD_* (rk_off_corridor)
--   • delay > DELAY_MIN → ETA_BREACH (rk_eta_breach)
--   Bez GPS: zachowanie jak v1 (ułamki ze statusu) — testy I-2d bez pozycji bez zmian.
-- =====================================================================

create table if not exists public.corridor_polylines (
  code          text primary key check (code in ('PL_ROAD', 'SE_E4')),
  geom          geometry(LineString, 4326) not null,
  total_km      numeric(8,2) not null check (total_km > 0),
  attribution   text not null default '© OpenStreetMap contributors',
  source        text not null default 'OSM / ODbL — przybliżenie korytarza zezwolenia (II-7)',
  updated_at    timestamptz not null default now()
);

comment on table public.corridor_polylines is
  'II-7: korytarz OSM (LineString) do rzutu GPS. Gdy przyjdzie trasa z zezwolenia (17.11) — podmiana linii.';

alter table public.corridor_polylines enable row level security;
revoke all on public.corridor_polylines from public, anon, authenticated;
grant select on public.corridor_polylines to authenticated;
grant select, insert, update, delete on public.corridor_polylines to service_role;

drop policy if exists corridor_polylines_read on public.corridor_polylines;
create policy corridor_polylines_read on public.corridor_polylines
  for select to authenticated
  using (current_app_user_id() is not null);

insert into public.app_parameters (key, value, label, source)
values (
  'OFF_CORRIDOR_M',
  2000,
  'Odległość GPS od korytarza OSM [m] → ryzyko zjazd z trasy (II-7)',
  'II-7 / ZLECENIE_POGODA_DROGI_ETA'
)
on conflict (key) do nothing;

-- Seed: te same punkty węzłowe co Edge road.ts (CORRIDOR_PL / CORRIDOR_SE) — OSM.
insert into public.corridor_polylines (code, geom, total_km, source)
values (
  'PL_ROAD',
  st_setsrid(st_makeline(array[
    st_makepoint(17.0246, 52.0739), st_makepoint(16.9252, 52.4064), st_makepoint(17.6, 52.8),
    st_makepoint(18.0084, 53.1235), st_makepoint(18.4400, 53.4000), st_makepoint(18.7536, 53.4837),
    st_makepoint(18.75, 54.0), st_makepoint(18.6466, 54.3520), st_makepoint(18.6813, 54.4037)
  ]), 4326),
  round((st_length(st_setsrid(st_makeline(array[
    st_makepoint(17.0246, 52.0739), st_makepoint(16.9252, 52.4064), st_makepoint(17.6, 52.8),
    st_makepoint(18.0084, 53.1235), st_makepoint(18.4400, 53.4000), st_makepoint(18.7536, 53.4837),
    st_makepoint(18.75, 54.0), st_makepoint(18.6466, 54.3520), st_makepoint(18.6813, 54.4037)
  ]), 4326)::geography) / 1000.0)::numeric, 2),
  'OSM / ODbL — Śrem → Poznań → S5 → A1 → Gdańsk (II-7)'
)
on conflict (code) do update set
  geom = excluded.geom,
  total_km = excluded.total_km,
  source = excluded.source,
  updated_at = now();

insert into public.corridor_polylines (code, geom, total_km, source)
values (
  'SE_E4',
  st_setsrid(st_makeline(array[
    st_makepoint(17.9562, 58.9045), st_makepoint(18.0686, 59.3293), st_makepoint(17.6389, 59.8586),
    st_makepoint(17.1413, 60.6749), st_makepoint(17.1056, 61.7274), st_makepoint(17.3069, 62.3908),
    st_makepoint(17.9379, 62.6323), st_makepoint(18.7153, 63.2909), st_makepoint(20.2630, 63.8258),
    st_makepoint(20.9528, 64.7507), st_makepoint(21.4794, 65.3172), st_makepoint(22.1547, 65.5848),
    st_makepoint(21.7591, 65.8054)
  ]), 4326),
  round((st_length(st_setsrid(st_makeline(array[
    st_makepoint(17.9562, 58.9045), st_makepoint(18.0686, 59.3293), st_makepoint(17.6389, 59.8586),
    st_makepoint(17.1413, 60.6749), st_makepoint(17.1056, 61.7274), st_makepoint(17.3069, 62.3908),
    st_makepoint(17.9379, 62.6323), st_makepoint(18.7153, 63.2909), st_makepoint(20.2630, 63.8258),
    st_makepoint(20.9528, 64.7507), st_makepoint(21.4794, 65.3172), st_makepoint(22.1547, 65.5848),
    st_makepoint(21.7591, 65.8054)
  ]), 4326)::geography) / 1000.0)::numeric, 2),
  'OSM / ODbL — Nynäshamn → E4 → Boden (II-7)'
)
on conflict (code) do update set
  geom = excluded.geom,
  total_km = excluded.total_km,
  source = excluded.source,
  updated_at = now();

-- ---------------------------------------------------------------------
-- Postęp na korytarzu: remaining_frac 0..1, odległość od linii [m]
-- ---------------------------------------------------------------------
create or replace function public.corridor_progress(
  p_code text, p_geom geometry
) returns table (remaining_frac numeric, off_m numeric, remaining_km numeric, total_km numeric)
language plpgsql stable security definer set search_path = public as $$
declare
  c record;
  v_loc double precision;
begin
  if p_geom is null then return; end if;
  select * into c from corridor_polylines where code = p_code;
  if not found then return; end if;
  v_loc := st_linelocatepoint(c.geom, st_setsrid(p_geom, 4326));
  remaining_frac := least(1, greatest(0, 1.0 - v_loc));
  off_m := st_distance(st_setsrid(p_geom, 4326)::geography, c.geom::geography);
  remaining_km := round((remaining_frac * c.total_km)::numeric, 2);
  total_km := c.total_km;
  return next;
end $$;
revoke all on function public.corridor_progress(text, geometry) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- compute_load_eta — ETA v2 (OSM); bez GPS = jak v1
-- ---------------------------------------------------------------------
create or replace function public.compute_load_eta(p_load uuid, p_now timestamp with time zone DEFAULT now())
 returns table(eta timestamp with time zone, conf_min integer, basis jsonb)
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  l          record;
  s          record;
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
  v_break_h numeric := 0;
  v_weather_pct numeric := 0;
begin
  select * into l from loads where id = p_load;
  if not found then return; end if;
  v_status := l.status;

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

  select slowdown_mult, reason into v_slow, v_slow_reason
    from corridor_conditions where corridor = 'SE_E4';
  v_slow := coalesce(v_slow, 1.00);
  if v_slow > 1.00 then
    v_weather_pct := round((v_slow - 1) * 100);
    v_flags := array_append(v_flags, format('spowolnienie SE ×%s (%s)', v_slow, coalesce(v_slow_reason, 'II-6')));
  end if;
  h_road_eff := h_road * v_slow;
  h_se := h_road_eff + h_rest + h_brk;

  select attribution into v_attr from corridor_polylines where code = 'PL_ROAD' limit 1;
  v_attr := coalesce(v_attr, '© OpenStreetMap contributors');

  select st_centroid(geom) into g_load from geofences where project_id = l.project_id and kind = 'LOADING' and active order by sort_order limit 1;
  select st_centroid(geom) into g_pout from geofences where project_id = l.project_id and kind = 'PORT_OUT' and active order by sort_order limit 1;
  select st_centroid(geom) into g_pin  from geofences where project_id = l.project_id and kind = 'PORT_IN'  and active order by sort_order limit 1;
  select st_centroid(geom) into g_site from geofences where project_id = l.project_id and kind = 'SITE'     and active order by sort_order limit 1;
  select ts, coalesce(geom_snapped, geom_raw) as g into p from positions where load_id = p_load order by ts desc limit 1;

  if v_status = 'CANCELLED' then
    return query select null::timestamptz, null::int, jsonb_build_object(
      'method','ETA v2 (OSM)','segment','CANCELLED','flags',jsonb_build_array('anulowany'),
      'attribution', v_attr, 'computed_at', p_now);
    return;
  end if;
  if v_status in ('UNLOADED','DELIVERED') then
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

  -- 2) odcinek SE
  if v_status in ('AT_PORT_NYNASHAMN','IN_TRANSIT_SE') then
    v_frac := 1;
    if v_status = 'IN_TRANSIT_SE' then
      if p.ts is not null and p.ts >= p_now - make_interval(mins => (fresh_h * 60)::int) then
        select * into cp from corridor_progress('SE_E4', p.g);
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
    v_rem := h_se * v_frac;
    v_eta := p_now + make_interval(secs => (v_rem * 3600)::int);
    v_drive_h := round(h_road_eff * v_frac, 2);
    v_rest_h := round(h_rest * v_frac, 2);
    v_break_h := round(h_brk * v_frac, 2);
    v_var := v_var + (h_road_eff * v_frac * 60 * sp_road)^2; v_sum := v_sum + (h_road_eff * v_frac * 60 * sp_road);
    v_comp := v_comp || jsonb_build_object('code','SE_ROAD','min',round(h_road_eff * v_frac * 60 * sp_road));
    v_var := v_var + (h_rest * v_frac * 60 * sp_rest)^2; v_sum := v_sum + (h_rest * v_frac * 60 * sp_rest);
    v_comp := v_comp || jsonb_build_object('code','SE_DAILY_REST','min',round(h_rest * v_frac * 60 * sp_rest));
    v_var := v_var + (h_brk * v_frac * 60 * sp_brk)^2; v_sum := v_sum + (h_brk * v_frac * 60 * sp_brk);
    v_comp := v_comp || jsonb_build_object('code','SE_BREAKS','min',round(h_brk * v_frac * 60 * sp_brk));
    v_segs := v_segs || jsonb_build_object('code','SE_ROAD','hours',round(h_road_eff * v_frac, 1),'spread_pct',round(sp_road * 100),'slowdown_mult',v_slow)
                     || jsonb_build_object('code','SE_DAILY_REST','hours',round(h_rest * v_frac, 1),'spread_pct',round(sp_rest * 100))
                     || jsonb_build_object('code','SE_BREAKS','hours',round(h_brk * v_frac, 1),'spread_pct',round(sp_brk * 100));
    v_seg := v_status::text;
  else
    select coalesce(x.delayed_departure_at, x.departure_at) as dep, coalesce(x.delayed_arrival_at, x.arrival_at) as arr,
           x.status, x.id, (x.delayed_departure_at is not null or x.status = 'OPOZNIONY') as delayed
      into s from sailings x where x.id = l.sailing_id;
    v_has := found;
    if v_has and s.status = 'ODWOLANY' then
      v_flags := array_append(v_flags, 'przypisany rejs odwołany'::text); v_has := false;
    elsif v_has and v_status < 'FERRY' and s.dep < p_now then
      v_flags := array_append(v_flags, 'przypisany rejs odpłynął bez transportu'::text); v_has := false;
    end if;

    if v_status = 'FERRY' then
      if v_has then
        v_arr := s.arr; v_sail_src := 'przypisany';
        v_var := v_var + (30)^2; v_sum := v_sum + (30); v_comp := v_comp || jsonb_build_object('code','SAILING','min',round(30));
        if s.delayed then v_var := v_var + (60)^2; v_sum := v_sum + (60); v_comp := v_comp || jsonb_build_object('code','SAILING_DELAYED','min',round(60)); end if;
      else
        v_arr := p_now + make_interval(secs => (h_cross * 0.5 * 3600)::int);
        v_var := v_var + (h_cross * 60 * 0.5)^2; v_sum := v_sum + (h_cross * 60 * 0.5);
        v_comp := v_comp || jsonb_build_object('code','FERRY_NO_SAILING','min',round(h_cross * 60 * 0.5));
        v_flags := array_append(v_flags, 'na promie bez rejsu w rozkładzie — połowa przeprawy'::text);
      end if;
      v_seg := 'FERRY';
    else
      v_start := greatest(p_now, coalesce(l.plan_load_to, l.plan_load_from, (l.plan_load_date + time '12:00') at time zone 'Europe/Warsaw', p_now));
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
        v_dep := s.dep; v_arr := s.arr; v_sail_src := 'przypisany';
        v_var := v_var + (30)^2; v_sum := v_sum + (30); v_comp := v_comp || jsonb_build_object('code','SAILING','min',round(30));
        if s.delayed then v_var := v_var + (60)^2; v_sum := v_sum + (60); v_comp := v_comp || jsonb_build_object('code','SAILING_DELAYED','min',round(60)); end if;
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
    v_segs := v_segs || jsonb_build_object('code','SE_ROAD','hours',round(h_road_eff, 1),'spread_pct',round(sp_road * 100),'slowdown_mult',v_slow)
                     || jsonb_build_object('code','SE_DAILY_REST','hours',round(h_rest, 1),'spread_pct',round(sp_rest * 100))
                     || jsonb_build_object('code','SE_BREAKS','hours',round(h_brk, 1),'spread_pct',round(sp_brk * 100));
    v_drive_h := coalesce(v_drive_h, 0) + h_road_eff;
    v_rest_h := h_rest;
    v_break_h := h_brk;
    v_eta := v_arr + make_interval(secs => (h_se * 3600)::int);
    v_var := v_var + (h_road_eff * 60 * sp_road)^2; v_sum := v_sum + (h_road_eff * 60 * sp_road);
    v_comp := v_comp || jsonb_build_object('code','SE_ROAD','min',round(h_road_eff * 60 * sp_road));
    v_var := v_var + (h_rest * 60 * sp_rest)^2; v_sum := v_sum + (h_rest * 60 * sp_rest);
    v_comp := v_comp || jsonb_build_object('code','SE_DAILY_REST','min',round(h_rest * 60 * sp_rest));
    v_var := v_var + (h_brk * 60 * sp_brk)^2; v_sum := v_sum + (h_brk * 60 * sp_brk);
    v_comp := v_comp || jsonb_build_object('code','SE_BREAKS','min',round(h_brk * 60 * sp_brk));
    if v_status < 'FERRY' then
      v_var := v_var + (h_pl * 60 * sp_pl)^2; v_sum := v_sum + (h_pl * 60 * sp_pl);
      v_comp := v_comp || jsonb_build_object('code','PL_ROAD','min',round(h_pl * 60 * sp_pl));
    end if;
  end if;

  v_causes := jsonb_build_object(
    'drive_h', v_drive_h,
    'checkin_h', v_checkin_h,
    'rest_h', v_rest_h,
    'breaks_h', v_break_h,
    'weather_slowdown_pct', v_weather_pct,
    'progress', v_progress,
    'remaining_km', v_rem_km,
    'off_corridor_m', v_off
  );

  return query select v_eta, round(sqrt(v_var))::int, jsonb_build_object(
    'method', 'ETA v2 (OSM)', 'segment', v_seg, 'segments', v_segs,
    'band', jsonb_build_object('method', 'RSS', 'min', round(sqrt(v_var)), 'linear_sum_min', round(v_sum),
                               'components', (select coalesce(jsonb_agg(c), '[]'::jsonb) from jsonb_array_elements(v_comp) c where (c->>'min')::numeric > 0)),
    'flags', to_jsonb(v_flags), 'sailing', v_sail_src,
    'attribution', v_attr, 'causes', v_causes, 'computed_at', p_now);
end $function$;

revoke execute on function public.compute_load_eta(uuid, timestamptz) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- refresh_load_eta: opóźnienie + ryzyka (ETA_BREACH, zjazd z korytarza)
-- ---------------------------------------------------------------------
create or replace function public.refresh_load_eta(p_load uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  r record;
  l record;
  v_end timestamptz;
  v_delay int;
  v_thr numeric := 30;
  v_off_m numeric := 2000;
  p record;
  fresh_h numeric := 1.5;
  cp record;
  v_kind risk_kind;
  v_title text;
begin
  select * into r from compute_load_eta(p_load);
  select * into l from loads where id = p_load;
  if not found then return; end if;

  select load_delivery_deadline(l.plan_delivery_date, l.plan_delivery_to) into v_end;
  v_delay := case when r.eta is null or v_end is null then null
                  else greatest(0, round(extract(epoch from (r.eta - v_end)) / 60))::int end;

  perform set_config('tower.eta_ctx', 'on', true);
  update loads set eta_site = r.eta, eta_confidence_min = r.conf_min, eta_basis = r.basis, eta_computed_at = now(),
         delay_minutes = v_delay
   where id = p_load
     and (eta_site is distinct from r.eta or eta_confidence_min is distinct from r.conf_min
          or (eta_basis - 'computed_at') is distinct from (r.basis - 'computed_at')
          or delay_minutes is distinct from v_delay);
  perform set_config('tower.eta_ctx', '', true);

  -- próg opóźnienia (DEC-6 / DELAY_MIN)
  select value into v_thr from app_parameters where key = 'DELAY_MIN';
  v_thr := coalesce(v_thr, 30);
  if v_delay is not null and v_delay > v_thr
     and l.status is distinct from 'CANCELLED'
     and l.status is distinct from 'UNLOADED'
     and l.status is distinct from 'DELIVERED'
     and l.status is distinct from 'AT_SITE' then
    perform raise_risk(p_load, 'ETA_BREACH', 'MEDIUM',
      format('Opóźnienie %s min wobec planu dostawy (próg %s)', v_delay, v_thr),
      jsonb_build_object('title_key', 'rk_eta_breach', 'params', jsonb_build_object(
        'minutes', v_delay, 'threshold', v_thr)),
      'ETA_BREACH:' || p_load);
  else
    update risk_signals set resolved_at = now()
     where load_id = p_load and kind = 'ETA_BREACH' and resolved_at is null
       and dedup_key = 'ETA_BREACH:' || p_load;
  end if;

  -- zjazd z korytarza (> OFF_CORRIDOR_M) przy świeżej pozycji na odcinku drogowym
  select value into v_off_m from app_parameters where key = 'OFF_CORRIDOR_M';
  v_off_m := coalesce(v_off_m, 2000);
  select hours into fresh_h from eta_segment_params where code = 'GPS_FRESH_MIN';
  fresh_h := coalesce(fresh_h, 1.5);
  select ts, coalesce(geom_snapped, geom_raw) as g into p from positions where load_id = p_load order by ts desc limit 1;
  if p.ts is not null and p.ts >= now() - make_interval(mins => (fresh_h * 60)::int)
     and l.status in ('IN_TRANSIT_PL', 'IN_TRANSIT_SE') then
    if l.status = 'IN_TRANSIT_PL' then
      select * into cp from corridor_progress('PL_ROAD', p.g);
      v_kind := 'ROAD_PL';
    else
      select * into cp from corridor_progress('SE_E4', p.g);
      v_kind := 'ROAD_SE';
    end if;
    if found and cp.off_m is not null and cp.off_m > v_off_m then
      v_title := format('Zjazd z trasy z zezwolenia: %s m od korytarza OSM (próg %s m)', round(cp.off_m), v_off_m);
      perform raise_risk(p_load, v_kind, 'HIGH', v_title,
        jsonb_build_object('title_key', 'rk_off_corridor', 'params', jsonb_build_object(
          'meters', round(cp.off_m), 'threshold', v_off_m, 'corridor', case when v_kind = 'ROAD_PL' then 'PL_ROAD' else 'SE_E4' end)),
        'OFF_CORRIDOR:' || p_load);
    else
      update risk_signals set resolved_at = now()
       where load_id = p_load and resolved_at is null and dedup_key = 'OFF_CORRIDOR:' || p_load;
    end if;
  end if;
end $$;
revoke all on function public.refresh_load_eta(uuid) from public, anon, authenticated;

comment on table eta_segment_params is
  'ETA v2 (II-7 OSM): czasy odcinków. D-9/I-15: obsada 1-os., odpoczynek na promie + SE. Tempo × km z corridor_polylines; SE × corridor_conditions.';

-- przeliczenie transportów w toku
do $$
declare r record;
begin
  for r in select id from loads where status not in ('CANCELLED','UNLOADED','DELIVERED') loop
    perform refresh_load_eta(r.id);
  end loop;
end $$;
