-- #626: EXIT ściśle < PIN; EXIT ≤ actual_departure+1h gdy rejs pasuje;
-- CROSSING koniec = min(PIN, arrival+1h); F7 r1: sailing_mismatch + okno EXIT.
-- search_path / REVOKE / GRANT bez zmian względem 0328.
-- Wykluczenia H4_BLEDNY_POMIAR 4 wierszy — ręcznie na prod przed PR (POSTEP).

begin;

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
  v_feat jsonb;
  v_sailing_ok boolean := false;
  v_sailing_mismatch boolean := false;
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
  t_port_in := eta_seg_event_at(p_load, 'GEOFENCE_ENTER', 'PORT_OUT', t_load_exit, null, v_op);
  t_pin_enter := eta_seg_event_at(p_load, 'GEOFENCE_ENTER', 'PORT_IN', t_port_in, null, v_op);

  t_site_bound := eta_seg_event_at(p_load, 'GEOFENCE_ENTER', 'SITE', t_port_in, null, null);
  select l.actual_delivery_at into t_delivery from loads l where l.id = p_load;

  select s.actual_departure_at, s.delayed_departure_at, s.actual_arrival_at
    into v_actual, v_delayed, v_arrival
    from loads l
    left join sailings s on s.id = l.sailing_id
   where l.id = p_load;

  -- F7 P1: dane rejsu tylko gdy rejs pasuje do przyjazdu auta
  if v_arrival is not null and t_pin_enter is not null then
    v_sailing_ok := (t_pin_enter <= v_arrival + interval '6 hours');
  elsif t_pin_enter is null then
    if v_actual is not null
       and t_port_in is not null
       and v_actual > t_port_in
       and (
         coalesce(t_site_bound, t_delivery) is null
         or v_actual < coalesce(t_site_bound, t_delivery)
       ) then
      v_sailing_ok := true;
    end if;
  elsif v_actual is not null
        and t_port_in is not null
        and v_actual > t_port_in
        and v_actual < t_pin_enter then
    -- brak arrival: rejs w oknie (ENTER, PIN)
    v_sailing_ok := true;
  end if;

  -- F7 P2: EXIT w [ENTER, least(PIN−1µs, actual+1h gdy rejs pasuje)]
  if t_pin_enter is not null then
    t_exit_before := t_pin_enter - interval '1 microsecond';
    if v_sailing_ok is true and v_actual is not null then
      t_exit_before := least(t_exit_before, v_actual + interval '1 hour');
    end if;
  else
    t_exit_before := coalesce(t_site_bound, t_delivery);
    if v_sailing_ok is true and v_actual is not null then
      if t_exit_before is null then
        t_exit_before := v_actual + interval '1 hour';
      else
        t_exit_before := least(t_exit_before, v_actual + interval '1 hour');
      end if;
    end if;
  end if;

  t_port_out := eta_seg_event_at(
    p_load, 'GEOFENCE_EXIT', 'PORT_OUT', t_port_in, t_exit_before, v_op
  );
  v_port_out_src := case when t_port_out is not null then 'EVENT' else null end;

  -- #626 pkt 1 (zapas): EXIT ≥ PIN → odrzuć
  if t_port_out is not null
     and t_pin_enter is not null
     and t_port_out >= t_pin_enter then
    t_port_out := null;
    v_port_out_src := null;
  end if;

  -- #626 pkt 2: EXIT po odejściu promu (+1 h) tylko gdy rejs pasuje
  if t_port_out is not null
     and v_sailing_ok is true
     and v_actual is not null
     and t_port_out > v_actual + interval '1 hour' then
    t_port_out := null;
    v_port_out_src := null;
  end if;

  if t_port_out is not null and v_sailing_ok is not true and v_actual is not null then
    v_sailing_mismatch := true;
  end if;

  -- Fallback actual/delayed tylko gdy rejs pasuje (F7 P1)
  if t_port_out is null and t_port_in is not null and v_sailing_ok is true then
    if v_actual is not null then
      if v_actual > t_port_in
         and (t_pin_enter is null or v_actual < t_pin_enter) then
        t_port_out := v_actual;
        v_port_out_src := 'SAILING_ACTUAL';
      end if;
    elsif v_delayed is not null
          and v_delayed > t_port_in
          and (t_pin_enter is null or v_delayed < t_pin_enter) then
      t_port_out := v_delayed;
      v_port_out_src := 'SAILING_DELAYED';
    end if;
  end if;

  t_site := eta_seg_event_at(p_load, 'GEOFENCE_ENTER', 'SITE', coalesce(t_pin_enter, t_port_out), null, null);
  t_pin_exit := eta_seg_event_at(p_load, 'GEOFENCE_EXIT', 'PORT_IN', t_pin_enter, t_site, v_op);

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

  -- #626 pkt 3: CROSSING koniec = min(PIN, actual_arrival+1h); pin_src; pin_late_h
  t_cross_end := t_pin_enter;
  v_pin_src := case when t_pin_enter is not null then 'EVENT' else null end;
  v_pin_late_h := null;
  if t_pin_enter is not null and v_arrival is not null then
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

  -- F7: actual_arrival < EXIT → CROSSING BRAK
  if t_port_out is not null
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

  -- SE_ROAD: start od EXIT PORT_IN (postój w porcie SE ≠ jazda); pin_late_h też tu
  if t_pin_exit is not null and t_site is not null then
    v_id := eta_upsert_segment_observation(p_load, c_se, t_pin_exit, t_site, true, null);
    if v_id is not null then
      n := n + 1;
      if v_pin_late_h is not null then
        update eta_segment_observations
           set features = features || jsonb_build_object('pin_late_h', v_pin_late_h)
         where id = v_id;
      end if;
    end if;
  elsif t_pin_enter is not null and t_site is not null and t_pin_exit is null then
    v_id := eta_upsert_segment_observation(
      p_load, c_se, t_pin_enter, t_site, true, 'BRAK_ZDARZENIA'
    );
    if v_id is not null then
      n := n + 1;
      if v_pin_late_h is not null then
        update eta_segment_observations
           set features = features || jsonb_build_object('pin_late_h', v_pin_late_h)
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
  '#626 F7 r1: EXIT < PIN (ostre); actual+1h gdy sailing_ok; sailing_mismatch; CROSSING min(PIN,arrival+1h).';

commit;
