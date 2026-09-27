-- 0062 — I-15 (właściciel 27.09.2026): pasmo ETA v1.
--   Odcinek SE rozbity: SE_ROAD 17 h ±20% (bez zmian), SE_DAILY_REST 11 h ±0% (odpoczynek dobowy 561/2006 — osobny odcinek, stały),
--   SE_BREAKS 2 h ±50% (przerwy; było 13 h ±30% razem z odpoczynkiem). Suma SE bez zmian (30 h) — ETA bez zmian.
--   Składniki pasma (odcinki i niepewność rejsu) łączone pierwiastkiem z sumy kwadratów (RSS), nie sumą.
--   basis.band: metoda, pasmo RSS, dawna suma liniowa (porównanie „przed/po”) i składniki.
-- Idempotentna, niedestrukcyjna: parametry odcinków (UPDATE/INSERT do stałych wartości) + nowa definicja funkcji + przeliczenie ETA w toku.
alter table eta_segment_params drop constraint if exists eta_segment_params_code_check;
alter table eta_segment_params add constraint eta_segment_params_code_check
  check (code in ('PL_ROAD', 'PORT_CHECKIN', 'CROSSING_DEFAULT', 'SE_ROAD', 'SE_DAILY_REST', 'SE_BREAKS', 'GPS_FRESH_MIN'));
update eta_segment_params set hours = 2, spread_pct = 50,
       label = 'Przerwy w jeździe (561/2006) na odcinku SE',
       source = 'właściciel 27.09 (I-15): przerwy 2 h ±50%', updated_at = now()
 where code = 'SE_BREAKS' and (hours, spread_pct, source) is distinct from (2::numeric, 50::numeric, 'właściciel 27.09 (I-15): przerwy 2 h ±50%');
insert into eta_segment_params (code, label, hours, spread_pct, source)
values ('SE_DAILY_REST', 'Odpoczynek dobowy kierowcy (561/2006) na odcinku SE — osobny odcinek', 11, 0,
        'właściciel 27.09 (I-15): odpoczynek dobowy 11 h ±0%')
on conflict (code) do update set hours = excluded.hours, spread_pct = excluded.spread_pct, label = excluded.label, source = excluded.source, updated_at = now()
 where (eta_segment_params.hours, eta_segment_params.spread_pct, eta_segment_params.source) is distinct from (excluded.hours, excluded.spread_pct, excluded.source);

create or replace function public.compute_load_eta(p_load uuid, p_now timestamp with time zone DEFAULT now())
 RETURNS TABLE(eta timestamp with time zone, conf_min integer, basis jsonb)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  v_var      numeric := 0;   -- I-15: wariancja pasma [min²] — składniki niezależne, łączone pierwiastkiem z sumy kwadratów
  v_sum      numeric := 0;   -- dla porównania: dawna suma liniowa [min]
  v_comp     jsonb := '[]'::jsonb;
  h_road numeric; sp_road numeric; h_rest numeric; sp_rest numeric; h_brk numeric; sp_brk numeric;
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
  h_se := h_road + h_rest + h_brk;
  select hours into fresh_h from eta_segment_params where code = 'GPS_FRESH_MIN';
  h_pl := coalesce(h_pl, 4.5); sp_pl := coalesce(sp_pl, 0.2); h_ci := coalesce(h_ci, 2);
  h_cross := coalesce(h_cross, 18); sp_cross := coalesce(sp_cross, 0.15);
  fresh_h := coalesce(fresh_h, 1.5);

  -- punkty odniesienia: centra stref projektu (LOADING, PORT_OUT, PORT_IN, SITE)
  select st_centroid(geom) into g_load from geofences where project_id = l.project_id and kind = 'LOADING' and active order by sort_order limit 1;
  select st_centroid(geom) into g_pout from geofences where project_id = l.project_id and kind = 'PORT_OUT' and active order by sort_order limit 1;
  select st_centroid(geom) into g_pin  from geofences where project_id = l.project_id and kind = 'PORT_IN'  and active order by sort_order limit 1;
  select st_centroid(geom) into g_site from geofences where project_id = l.project_id and kind = 'SITE'     and active order by sort_order limit 1;
  select ts, coalesce(geom_snapped, geom_raw) as g into p from positions where load_id = p_load order by ts desc limit 1;

  -- 1) stany końcowe
  if v_status = 'CANCELLED' then
    return query select null::timestamptz, null::int, jsonb_build_object('method','ETA v1 (baza)','segment','CANCELLED','flags',jsonb_build_array('anulowany'),'computed_at',p_now);
    return;
  end if;
  if v_status in ('UNLOADED','DELIVERED') then
    return query select coalesce(l.actual_delivery_at, p_now), 0, jsonb_build_object('method','ETA v1 (baza)','segment','DONE','flags',jsonb_build_array('rozładowany — data rozładunku'),'computed_at',p_now);
    return;
  end if;
  if v_status = 'AT_SITE' then
    select max(occurred_at) into v_eta from load_events where load_id = p_load and payload->>'to' = 'AT_SITE';
    return query select coalesce(v_eta, p_now), 0, jsonb_build_object('method','ETA v1 (baza)','segment','AT_SITE','flags',jsonb_build_array('na placu budowy'),'computed_at',p_now);
    return;
  end if;

  -- 2) odcinek SE (po przypłynięciu)
  if v_status in ('AT_PORT_NYNASHAMN','IN_TRANSIT_SE') then
    v_frac := 1;
    if v_status = 'IN_TRANSIT_SE' then
      if p.ts is not null and p.ts >= p_now - make_interval(mins => (fresh_h * 60)::int) and g_site is not null and g_pin is not null
         and st_distance(g_pin::geography, g_site::geography) > 0 then
        v_frac := least(1, greatest(0, st_distance(p.g::geography, g_site::geography) / st_distance(g_pin::geography, g_site::geography)));
        v_flags := array_append(v_flags, 'pozycja GPS — odległość do placu w linii prostej'::text);
      else
        v_frac := 0.5; v_var := v_var + (h_se * 60 * 0.25)^2; v_sum := v_sum + (h_se * 60 * 0.25); v_comp := v_comp || jsonb_build_object('code','SE_NO_GPS','min',round(h_se * 60 * 0.25));
        v_flags := array_append(v_flags, 'brak świeżej pozycji — połowa odcinka SE'::text);
      end if;
    end if;
    v_rem := h_se * v_frac;
    v_eta := p_now + make_interval(secs => (v_rem * 3600)::int);
    v_var := v_var + (h_road * v_frac * 60 * sp_road)^2; v_sum := v_sum + (h_road * v_frac * 60 * sp_road); v_comp := v_comp || jsonb_build_object('code','SE_ROAD','min',round(h_road * v_frac * 60 * sp_road));
    v_var := v_var + (h_rest * v_frac * 60 * sp_rest)^2; v_sum := v_sum + (h_rest * v_frac * 60 * sp_rest); v_comp := v_comp || jsonb_build_object('code','SE_DAILY_REST','min',round(h_rest * v_frac * 60 * sp_rest));
    v_var := v_var + (h_brk * v_frac * 60 * sp_brk)^2; v_sum := v_sum + (h_brk * v_frac * 60 * sp_brk); v_comp := v_comp || jsonb_build_object('code','SE_BREAKS','min',round(h_brk * v_frac * 60 * sp_brk));
    v_segs := v_segs || jsonb_build_object('code','SE_ROAD','hours',round(h_road * v_frac, 1),'spread_pct',round(sp_road * 100))
                     || jsonb_build_object('code','SE_DAILY_REST','hours',round(h_rest * v_frac, 1),'spread_pct',round(sp_rest * 100))
                     || jsonb_build_object('code','SE_BREAKS','hours',round(h_brk * v_frac, 1),'spread_pct',round(sp_brk * 100));
    v_seg := v_status::text;
  else
    -- 3) przed promem albo na promie: rejs przypisany z `sailings`
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
        v_var := v_var + (h_cross * 60 * 0.5)^2; v_sum := v_sum + (h_cross * 60 * 0.5); v_comp := v_comp || jsonb_build_object('code','FERRY_NO_SAILING','min',round(h_cross * 60 * 0.5));
        v_flags := array_append(v_flags, 'na promie bez rejsu w rozkładzie — połowa przeprawy'::text);
      end if;
      v_seg := 'FERRY';
    else
      -- czas dojazdu do check-inu w Gdańsku
      v_start := greatest(p_now, coalesce(l.plan_load_to, l.plan_load_from, (l.plan_load_date + time '12:00') at time zone 'Europe/Warsaw', p_now));
      v_frac := case when v_status = 'AT_PORT_GDANSK' then 0 when v_status = 'IN_TRANSIT_PL' then 0.5 else 1 end;
      if v_status = 'IN_TRANSIT_PL' then
        if p.ts is not null and p.ts >= p_now - make_interval(mins => (fresh_h * 60)::int) and g_pout is not null and g_load is not null
           and st_distance(g_load::geography, g_pout::geography) > 0 then
          v_frac := least(1, greatest(0, st_distance(p.g::geography, g_pout::geography) / st_distance(g_load::geography, g_pout::geography)));
          v_flags := array_append(v_flags, 'pozycja GPS — odległość do portu w linii prostej'::text);
        else
          v_flags := array_append(v_flags, 'brak świeżej pozycji — połowa odcinka PL'::text);
          v_var := v_var + (h_pl * 60 * 0.25)^2; v_sum := v_sum + (h_pl * 60 * 0.25); v_comp := v_comp || jsonb_build_object('code','PL_NO_GPS','min',round(h_pl * 60 * 0.25));
        end if;
      end if;
      if v_status < 'IN_TRANSIT_PL' and v_start > p_now then v_flags := array_append(v_flags, 'przed załadunkiem — start z planu załadunku'::text); end if;
      v_segs := v_segs || jsonb_build_object('code','PL_ROAD','hours',round(h_pl * v_frac, 1),'spread_pct',round(sp_pl * 100));
      v_start := v_start + make_interval(secs => ((h_pl * v_frac + (case when v_status = 'AT_PORT_GDANSK' then 0 else h_ci end)) * 3600)::int);
      if v_has then
        v_dep := s.dep; v_arr := s.arr; v_sail_src := 'przypisany';
        v_var := v_var + (30)^2; v_sum := v_sum + (30); v_comp := v_comp || jsonb_build_object('code','SAILING','min',round(30));
        if s.delayed then v_var := v_var + (60)^2; v_sum := v_sum + (60); v_comp := v_comp || jsonb_build_object('code','SAILING_DELAYED','min',round(60)); end if;
        if v_start > v_dep then
          v_flags := array_append(v_flags, 'rejs zagrożony — dojazd i check-in po odejściu'::text);
          v_var := v_var + (12 * 60)^2; v_sum := v_sum + (12 * 60); v_comp := v_comp || jsonb_build_object('code','SAILING_AT_RISK','min',round(12 * 60));
        end if;
      else
        -- bez przypisanego rejsu: najbliższy rejs GDN-NYN po dojeździe i check-inie — ZAŁOŻENIE
        select coalesce(x.delayed_departure_at, x.departure_at), coalesce(x.delayed_arrival_at, x.arrival_at)
          into v_dep, v_arr
          from sailings x
         where x.project_id = l.project_id and x.route = 'GDN-NYN' and x.status <> 'ODWOLANY'
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
          v_var := v_var + (h_cross * 60 * sp_cross)^2; v_sum := v_sum + (h_cross * 60 * sp_cross); v_comp := v_comp || jsonb_build_object('code','CROSSING','min',round(h_cross * 60 * sp_cross));
        end if;
      end if;
      v_seg := v_status::text;
    end if;
    v_segs := v_segs || jsonb_build_object('code','CROSSING','departure',v_dep,'arrival',v_arr,'source',coalesce(v_sail_src,'założenie'));
    v_segs := v_segs || jsonb_build_object('code','SE_ROAD','hours',round(h_road, 1),'spread_pct',round(sp_road * 100))
                     || jsonb_build_object('code','SE_DAILY_REST','hours',round(h_rest, 1),'spread_pct',round(sp_rest * 100))
                     || jsonb_build_object('code','SE_BREAKS','hours',round(h_brk, 1),'spread_pct',round(sp_brk * 100));
    v_eta := v_arr + make_interval(secs => (h_se * 3600)::int);
    v_var := v_var + (h_road * 60 * sp_road)^2; v_sum := v_sum + (h_road * 60 * sp_road); v_comp := v_comp || jsonb_build_object('code','SE_ROAD','min',round(h_road * 60 * sp_road));
    v_var := v_var + (h_rest * 60 * sp_rest)^2; v_sum := v_sum + (h_rest * 60 * sp_rest); v_comp := v_comp || jsonb_build_object('code','SE_DAILY_REST','min',round(h_rest * 60 * sp_rest));
    v_var := v_var + (h_brk * 60 * sp_brk)^2; v_sum := v_sum + (h_brk * 60 * sp_brk); v_comp := v_comp || jsonb_build_object('code','SE_BREAKS','min',round(h_brk * 60 * sp_brk));
    if v_status < 'FERRY' then v_var := v_var + (h_pl * 60 * sp_pl)^2; v_sum := v_sum + (h_pl * 60 * sp_pl); v_comp := v_comp || jsonb_build_object('code','PL_ROAD','min',round(h_pl * 60 * sp_pl)); end if;
  end if;

  return query select v_eta, round(sqrt(v_var))::int, jsonb_build_object(
    'method', 'ETA v1 (baza)', 'segment', v_seg, 'segments', v_segs,
    'band', jsonb_build_object('method', 'RSS', 'min', round(sqrt(v_var)), 'linear_sum_min', round(v_sum),
                               'components', (select coalesce(jsonb_agg(c), '[]'::jsonb) from jsonb_array_elements(v_comp) c where (c->>'min')::numeric > 0)),
    'flags', to_jsonb(v_flags), 'sailing', v_sail_src, 'computed_at', p_now);
end $function$;

revoke execute on function public.compute_load_eta(uuid, timestamptz) from public, anon, authenticated;

comment on table eta_segment_params is
  'ETA v1 — czasy odcinków. D-9 (27.09.2026): obsada jednoosobowa, przeprawa = dobowy odpoczynek. I-15: SE = jazda + odpoczynek dobowy 11 h (±0%) + przerwy 2 h (±50%); pasmo = RSS składników. Zmiana wartości = nowa migracja albo decyzja HHL.';

do $$
declare r record;
begin
  for r in select id from loads where status not in ('CANCELLED','UNLOADED','DELIVERED') loop
    perform refresh_load_eta(r.id);
  end loop;
end $$;
