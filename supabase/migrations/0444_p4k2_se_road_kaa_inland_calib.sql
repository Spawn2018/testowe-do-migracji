-- P4-k2 (#581 / #608): kalibracja dwóch SE_ROAD po BN10 —
-- pomiar GDY-KAA zapisuje SE_ROAD_KAA (E22) albo SE_ROAD_KAA_INLAND (śródląd)
-- według stena_se_eta_corridor na GPS w oknie drogi SE (nie mieszać czasów).

begin;

create or replace function public.eta_obs_se_road_code_for_load(
  p_load uuid,
  p_from timestamptz,
  p_to timestamptz,
  p_fallback text
)
returns table (code text, se_corridor text)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_fb text := coalesce(nullif(trim(p_fallback), ''), 'SE_ROAD_KAA');
  v_inland int := 0;
  v_e22 int := 0;
  v_corr text;
  r record;
begin
  code := v_fb;
  se_corridor := null;
  if p_load is null or p_from is null or p_to is null or p_to <= p_from then
    return next;
    return;
  end if;

  for r in
    select st_setsrid(p.geom_raw, 4326) as g
      from positions p
     where p.load_id = p_load
       and p.ts >= p_from
       and p.ts <= p_to
       and p.geom_raw is not null
       and st_y(st_setsrid(p.geom_raw, 4326)) >= 58.55
     order by p.ts
     limit 40
  loop
    v_corr := public.stena_se_eta_corridor(r.g);
    if v_corr in ('SE_KAA_INLAND', 'SE_KAA_TRACK') then
      v_inland := v_inland + 1;
    else
      v_e22 := v_e22 + 1;
    end if;
  end loop;

  if v_inland + v_e22 = 0 then
    return next;
    return;
  end if;

  if v_inland > v_e22 then
    code := 'SE_ROAD_KAA_INLAND';
    se_corridor := 'SE_KAA_INLAND';
  else
    code := 'SE_ROAD_KAA';
    se_corridor := 'SE_E22';
  end if;
  return next;
end;
$$;

revoke all on function public.eta_obs_se_road_code_for_load(uuid, timestamptz, timestamptz, text)
  from public, anon, authenticated;
grant execute on function public.eta_obs_se_road_code_for_load(uuid, timestamptz, timestamptz, text)
  to service_role;

comment on function public.eta_obs_se_road_code_for_load(uuid, timestamptz, timestamptz, text) is
  'P4-k2: kod SE_ROAD_KAA / SE_ROAD_KAA_INLAND z większości stena_se_eta_corridor (lat≥58.55).';


create or replace function public.eta_record_segment_observations(p_load uuid)
returns int
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  t_load_exit timestamptz;
  t_port_in timestamptz;
  t_port_out timestamptz;
  t_pin_enter timestamptz;
  t_pin_exit timestamptz;
  t_site timestamptz;
  t_site_bound timestamptz;
  t_delivery timestamptz;
  t_exit_before timestamptz;
  t_cross_end timestamptz;
  t_window_end timestamptz;
  n int := 0;
  v_route text;
  v_op text;
  c_pl text;
  c_ci text;
  c_cross text;
  c_se text;
  v_id bigint;
  v_port_out_src text;
  v_pin_src text;
  v_pin_late_h numeric;
  v_actual timestamptz;
  v_delayed timestamptz;
  v_arrival timestamptz;
  v_eff_dep timestamptz;
  v_feat jsonb;
  v_sailing_ok boolean := false;
  v_sailing_mismatch boolean := false;
  v_se_from timestamptz;
  v_se_corridor text;
begin
  if not exists (select 1 from loads where id = p_load) then
    return 0;
  end if;

  delete from eta_segment_observations
   where load_id = p_load
     and (features->>'p4k') = 'true'
     and (
       exclude_reason is null
       or exclude_reason in (
         'LUKA_GPS', 'POKRYCIE_GPS', 'BRAK_GPS', 'TRASA_NIEZNANA', 'BRAK_ZDARZENIA'
       )
     );

  v_route := eta_obs_route_key(p_load);
  if v_route is null then
    v_id := eta_upsert_segment_observation(
      p_load, 'PL_ROAD', null, null, false, 'TRASA_NIEZNANA'
    );
    return case when v_id is null then 0 else 1 end;
  end if;

  c_pl := eta_obs_segment_code(v_route, 'PL_ROAD');
  c_ci := eta_obs_segment_code(v_route, 'PORT_CHECKIN');
  c_cross := eta_obs_segment_code(v_route, 'CROSSING');
  c_se := eta_obs_segment_code(v_route, 'SE_ROAD');

  v_op := public.eta_record_v_op(v_route);

  t_load_exit := eta_seg_event_at(p_load, 'GEOFENCE_EXIT', 'LOADING', null, null, null);
  -- BN8a: filtr zdarzeń portowych po trasie (nie operatorze) — TLL-STO itd.
  t_port_in := eta_seg_event_at(p_load, 'GEOFENCE_ENTER', 'PORT_OUT', t_load_exit, null, v_route);
  t_pin_enter := eta_seg_event_at(p_load, 'GEOFENCE_ENTER', 'PORT_IN', t_port_in, null, v_route);

  t_site_bound := eta_seg_event_at(p_load, 'GEOFENCE_ENTER', 'SITE', t_port_in, null, null);
  select l.actual_delivery_at into t_delivery from loads l where l.id = p_load;

  select s.actual_departure_at, s.delayed_departure_at, s.actual_arrival_at
    into v_actual, v_delayed, v_arrival
    from loads l
    left join sailings s on s.id = l.sailing_id
   where l.id = p_load;

  v_eff_dep := coalesce(v_actual, v_delayed);

  -- F7 r2 P2: EXIT w [ENTER, PIN−1µs] — bez górnej granicy z rejsu
  if t_pin_enter is not null then
    t_exit_before := t_pin_enter - interval '1 microsecond';
  else
    t_exit_before := coalesce(t_site_bound, t_delivery);
  end if;

  t_port_out := eta_seg_event_at(
    p_load, 'GEOFENCE_EXIT', 'PORT_OUT', t_port_in, t_exit_before, v_route
  );
  v_port_out_src := case when t_port_out is not null then 'EVENT' else null end;

  -- #626 pkt 1: EXIT ≥ PIN → odrzuć
  if t_port_out is not null
     and t_pin_enter is not null
     and t_port_out >= t_pin_enter then
    t_port_out := null;
    v_port_out_src := null;
  end if;

  -- F7 r2: 1) jest EVENT EXIT < PIN → pasuje ⇔ abs(EXIT−eff_dep) ≤ 1 h
  if t_port_out is not null then
    if v_eff_dep is not null
       and abs(extract(epoch from (t_port_out - v_eff_dep))) <= 3600 then
      v_sailing_ok := true;
    else
      v_sailing_ok := false;
      if v_eff_dep is not null then
        v_sailing_mismatch := true;
      end if;
    end if;
  else
    -- 2) brak EVENT EXIT < PIN: eff_dep w oknie ENTER < dep < coalesce(PIN,SITE,delivery)
    -- actual poza oknem → BRAK bez fallbacku na delayed (#624)
    t_window_end := coalesce(t_pin_enter, t_site_bound, t_delivery);
    if t_port_in is not null and v_actual is not null then
      if v_actual > t_port_in
         and (t_window_end is null or v_actual < t_window_end) then
        t_port_out := v_actual;
        v_port_out_src := 'SAILING_ACTUAL';
        v_sailing_ok := true;
      end if;
    elsif t_port_in is not null and v_delayed is not null then
      if v_delayed > t_port_in
         and (t_window_end is null or v_delayed < t_window_end) then
        t_port_out := v_delayed;
        v_port_out_src := 'SAILING_DELAYED';
        v_sailing_ok := true;
      end if;
    end if;
  end if;

  t_site := eta_seg_event_at(p_load, 'GEOFENCE_ENTER', 'SITE', coalesce(t_pin_enter, t_port_out), null, null);
  t_pin_exit := eta_seg_event_at(p_load, 'GEOFENCE_EXIT', 'PORT_IN', t_pin_enter, t_site, v_route);

  if t_load_exit is not null and t_port_in is not null then
    v_id := eta_upsert_segment_observation(p_load, c_pl, t_load_exit, t_port_in, true, null);
    if v_id is not null then
      n := n + 1;
    end if;
  end if;

  if t_port_in is not null and t_port_out is not null and t_port_out > t_port_in then
    v_id := eta_upsert_segment_observation(p_load, c_ci, t_port_in, t_port_out, false, null);
    if v_id is not null then
      n := n + 1;
      v_feat := jsonb_build_object();
      if v_port_out_src is not null then
        v_feat := v_feat || jsonb_build_object('port_out_src', v_port_out_src);
      end if;
      if v_sailing_mismatch is true then
        v_feat := v_feat || jsonb_build_object('sailing_mismatch', true);
      end if;
      if v_feat <> '{}'::jsonb then
        update eta_segment_observations
           set features = features || v_feat
         where id = v_id;
      end if;
    end if;
  elsif t_port_in is not null then
    v_id := eta_upsert_segment_observation(
      p_load, c_ci, t_port_in, coalesce(t_pin_enter, t_port_in), false, 'BRAK_ZDARZENIA'
    );
    if v_id is not null then
      n := n + 1;
    end if;
  end if;

  -- F7 r2 pkt 3: CROSSING trim tylko gdy rejs pasuje
  t_cross_end := t_pin_enter;
  v_pin_src := case when t_pin_enter is not null then 'EVENT' else null end;
  v_pin_late_h := null;
  if v_sailing_ok is true and t_pin_enter is not null and v_arrival is not null then
    if t_pin_enter > v_arrival + interval '1 hour' then
      t_cross_end := v_arrival + interval '1 hour';
      v_pin_src := 'SAILING_ACTUAL_ARR';
    end if;
    if t_pin_enter > v_arrival + interval '6 hours' then
      v_pin_late_h := round(
        (extract(epoch from (t_pin_enter - v_arrival)) / 3600.0)::numeric, 2
      );
    end if;
  end if;

  -- actual_arrival < EXIT → CROSSING BRAK (tylko gdy rejs pasuje; F7 r3)
  if t_port_out is not null
     and v_sailing_ok is true
     and v_arrival is not null
     and v_arrival < t_port_out then
    v_id := eta_upsert_segment_observation(
      p_load, c_cross, t_port_out, t_port_out, false, 'BRAK_ZDARZENIA'
    );
    if v_id is not null then
      n := n + 1;
    end if;
  elsif t_port_out is not null
     and t_cross_end is not null
     and t_cross_end > t_port_out
     and t_port_out > t_port_in then
    v_id := eta_upsert_segment_observation(p_load, c_cross, t_port_out, t_cross_end, false, null);
    if v_id is not null then
      n := n + 1;
      v_feat := jsonb_build_object();
      if v_port_out_src is not null then
        v_feat := v_feat || jsonb_build_object('port_out_src', v_port_out_src);
      end if;
      if v_pin_src is not null then
        v_feat := v_feat || jsonb_build_object('pin_src', v_pin_src);
      end if;
      if v_pin_late_h is not null then
        v_feat := v_feat || jsonb_build_object('pin_late_h', v_pin_late_h);
      end if;
      if v_sailing_mismatch is true then
        v_feat := v_feat || jsonb_build_object('sailing_mismatch', true);
      end if;
      if v_feat <> '{}'::jsonb then
        update eta_segment_observations
           set features = features || v_feat
         where id = v_id;
      end if;
    end if;
  elsif t_port_out is not null then
    v_id := eta_upsert_segment_observation(
      p_load, c_cross, t_port_out, t_port_out, false, 'BRAK_ZDARZENIA'
    );
    if v_id is not null then
      n := n + 1;
    end if;
  end if;

  -- SE_ROAD / P4-k2: Stena GDY-KAA → SE_ROAD_KAA vs SE_ROAD_KAA_INLAND ze śladu GPS
  v_se_from := coalesce(t_pin_exit, t_pin_enter);
  if v_route in ('GDY-KAA', 'KAA-GDY', 'STENA')
     or c_se in ('SE_ROAD_KAA', 'SE_ROAD_KAA_INLAND') then
    select code, se_corridor
      into c_se, v_se_corridor
      from public.eta_obs_se_road_code_for_load(
        p_load, v_se_from, t_site, coalesce(c_se, 'SE_ROAD_KAA')
      );
  end if;

  if t_pin_exit is not null and t_site is not null then
    v_id := eta_upsert_segment_observation(p_load, c_se, t_pin_exit, t_site, true, null);
    if v_id is not null then
      n := n + 1;
      v_feat := jsonb_build_object();
      if v_pin_late_h is not null then
        v_feat := v_feat || jsonb_build_object('pin_late_h', v_pin_late_h);
      end if;
      if v_se_corridor is not null then
        v_feat := v_feat || jsonb_build_object(
          'se_corridor', v_se_corridor,
          'se_road_code', c_se
        );
      end if;
      if v_feat <> '{}'::jsonb then
        update eta_segment_observations
           set features = features || v_feat
         where id = v_id;
      end if;
    end if;
  elsif t_pin_enter is not null and t_site is not null and t_pin_exit is null then
    v_id := eta_upsert_segment_observation(
      p_load, c_se, t_pin_enter, t_site, true, 'BRAK_ZDARZENIA'
    );
    if v_id is not null then
      n := n + 1;
      v_feat := jsonb_build_object();
      if v_pin_late_h is not null then
        v_feat := v_feat || jsonb_build_object('pin_late_h', v_pin_late_h);
      end if;
      if v_se_corridor is not null then
        v_feat := v_feat || jsonb_build_object(
          'se_corridor', v_se_corridor,
          'se_road_code', c_se
        );
      end if;
      if v_feat <> '{}'::jsonb then
        update eta_segment_observations
           set features = features || v_feat
         where id = v_id;
      end if;
    end if;
  end if;

  return n;
end;
$$;
revoke all on function public.eta_record_segment_observations(uuid)
  from public, anon, authenticated;
grant execute on function public.eta_record_segment_observations(uuid) to service_role;
comment on function public.eta_record_segment_observations(uuid) is
  'P4-k2/#581: Stena SE_ROAD_KAA vs INLAND ze śladu; BN8a filtr v_route.';

commit;
