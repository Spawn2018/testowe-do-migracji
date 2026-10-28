-- #603: po pełnej odbudowie pomiarów (od 05.10) — poprawka PORT_CHECKIN/CROSSING
-- F7 #619 r1–r3: EXIT tylko ≤ PIN; po późnym EXIT ważne tylko actual/delayed
--   (nie plan, nie GPS_LAST); features.port_out_src; D1/D3.
-- + słownik SE_ROAD_KAA_INLAND (27B:C; bez mapowania eta_route_segments do 27B).
begin;

-- ---------------------------------------------------------------------------
-- 1) Okno czasu zdarzeń: domknięte (≥ / ≤), żeby równe timestamps nie ginęły
-- ---------------------------------------------------------------------------
create or replace function public.eta_seg_event_at(
  p_load uuid, p_event text, p_kind text,
  p_after timestamptz default null,
  p_before timestamptz default null,
  p_route text default null
) returns timestamptz
language sql stable security definer set search_path = public, pg_temp as $$
  select case
    when p_event = 'GEOFENCE_EXIT' then max(e.occurred_at)
    else min(e.occurred_at)
  end
    from load_events e
    left join geofences g on g.id = nullif(e.payload->>'geofence_id', '')::uuid
   where (e.load_id = p_load or e.detached_load_id = p_load)
     and e.event_type = p_event
     and coalesce(g.kind::text, e.payload->>'geofence_kind') = p_kind
     and (p_after is null or e.occurred_at >= p_after)
     and (p_before is null or e.occurred_at <= p_before)
     and (
       p_route is null
       or p_kind not in ('PORT_OUT', 'PORT_IN', 'PRE_PORT')
       or coalesce(g.route, e.payload->>'route') is null
       or public.eta_obs_route_family(coalesce(g.route, e.payload->>'route'))
            = public.eta_obs_route_family(p_route)
     );
$$;

revoke all on function public.eta_seg_event_at(uuid, text, text, timestamptz, timestamptz, text)
  from public, anon, authenticated;
grant execute on function public.eta_seg_event_at(uuid, text, text, timestamptz, timestamptz, text) to service_role;

comment on function public.eta_seg_event_at(uuid, text, text, timestamptz, timestamptz, text) is
  '#603: okno domknięte (≥/≤); filtr trasy przez eta_obs_route_family.';

-- ---------------------------------------------------------------------------
-- 2) PORT_CHECKIN: EXIT ≤ PIN; fallback tylko actual/delayed; CROSSING: >
-- ---------------------------------------------------------------------------
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
  n int := 0;
  v_route text;
  v_op text;
  c_pl text;
  c_ci text;
  c_cross text;
  c_se text;
  v_id bigint;
  v_port_out_src text;
  v_actual timestamptz;
  v_delayed timestamptz;
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
  -- PIN po ENTER PORT_OUT (jak 0320)
  t_pin_enter := eta_seg_event_at(p_load, 'GEOFENCE_ENTER', 'PORT_IN', t_port_in, null, v_op);

  -- D3: bez PIN — EXIT ograniczony do SITE / actual_delivery_at (nie bez granicy)
  t_site_bound := eta_seg_event_at(p_load, 'GEOFENCE_ENTER', 'SITE', t_port_in, null, null);
  select l.actual_delivery_at into t_delivery from loads l where l.id = p_load;
  t_exit_before := coalesce(t_pin_enter, t_site_bound, t_delivery);

  -- F7 B2/B3: EXIT tylko ≤ PIN (albo SITE/dostawa); późny EXIT / powrót nie wchodzi
  t_port_out := eta_seg_event_at(
    p_load, 'GEOFENCE_EXIT', 'PORT_OUT', t_port_in, t_exit_before, v_op
  );
  v_port_out_src := case when t_port_out is not null then 'EVENT' else null end;

  -- F7 r2/r3: po braku EXIT ≤ PIN — tylko actual, potem delayed (> ENTER, < PIN);
  -- plan i GPS_LAST → BRAK (bez gałęzi GPS).
  -- F7 r3 drobne: actual NOT NULL poza oknem → BRAK, bez delayed (nieaktualny sailing_id).
  if t_port_out is null and t_port_in is not null then
    v_actual := null;
    v_delayed := null;
    select s.actual_departure_at, s.delayed_departure_at
      into v_actual, v_delayed
      from loads l
      join sailings s on s.id = l.sailing_id
     where l.id = p_load;
    if v_actual is not null then
      if v_actual > t_port_in
         and (t_pin_enter is null or v_actual < t_pin_enter) then
        t_port_out := v_actual;
        v_port_out_src := 'SAILING_ACTUAL';
      end if;
      -- actual poza oknem: zostaw null → BRAK; nie bierz delayed
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
    if eta_upsert_segment_observation(p_load, c_pl, t_load_exit, t_port_in, true, null) is not null then
      n := n + 1;
    end if;
  end if;

  -- D1: koniec = ENTER → wiersz BRAK (nie cichy brak); OK tylko gdy t_port_out > t_port_in
  if t_port_in is not null and t_port_out is not null and t_port_out > t_port_in then
    if eta_upsert_segment_observation(p_load, c_ci, t_port_in, t_port_out, false, null) is not null then
      n := n + 1;
      if v_port_out_src is not null then
        update eta_segment_observations
           set features = features || jsonb_build_object('port_out_src', v_port_out_src)
         where load_id = p_load
           and corridor = c_ci
           and (features->>'p4k') = 'true';
      end if;
    end if;
  elsif t_port_in is not null then
    if eta_upsert_segment_observation(
         p_load, c_ci, t_port_in, coalesce(t_pin_enter, t_port_in), false, 'BRAK_ZDARZENIA'
       ) is not null then
      n := n + 1;
    end if;
  end if;

  -- F7 drobne: CROSSING tylko gdy PIN > EXIT i EXIT > ENTER (EXIT=ENTER = BRAK, nie odprawa w rejsie)
  if t_port_out is not null
     and t_pin_enter is not null
     and t_pin_enter > t_port_out
     and t_port_out > t_port_in then
    if eta_upsert_segment_observation(p_load, c_cross, t_port_out, t_pin_enter, false, null) is not null then
      n := n + 1;
      if v_port_out_src is not null then
        update eta_segment_observations
           set features = features || jsonb_build_object('port_out_src', v_port_out_src)
         where load_id = p_load
           and corridor = c_cross
           and (features->>'p4k') = 'true';
      end if;
    end if;
  elsif t_port_out is not null then
    if eta_upsert_segment_observation(
         p_load, c_cross, t_port_out, t_port_out, false, 'BRAK_ZDARZENIA'
       ) is not null then
      n := n + 1;
    end if;
  end if;

  if t_pin_exit is not null and t_site is not null then
    if eta_upsert_segment_observation(p_load, c_se, t_pin_exit, t_site, true, null) is not null then
      n := n + 1;
    end if;
  elsif t_pin_enter is not null and t_site is not null and t_pin_exit is null then
    if eta_upsert_segment_observation(
         p_load, c_se, t_pin_enter, t_site, true, 'BRAK_ZDARZENIA'
       ) is not null then
      n := n + 1;
    end if;
  end if;

  return n;
end;
$$;

revoke all on function public.eta_record_segment_observations(uuid)
  from public, anon, authenticated;
grant execute on function public.eta_record_segment_observations(uuid) to service_role;

comment on function public.eta_record_segment_observations(uuid) is
  '#603 F7 r3: EXIT ≤ PIN; actual poza oknem→BRAK (bez delayed); bez planu/GPS; port_out_src; CROSSING gdy PIN > EXIT > ENTER.';

-- ---------------------------------------------------------------------------
-- 3) SE_ROAD_KAA_INLAND — osobny odcinek kalibracji (27B:C); E4 zostaje SE_ROAD_KAA
--    Bez wpisu w eta_route_segments do 27B (martwy w mapowaniu — celowo).
-- ---------------------------------------------------------------------------
insert into public.eta_segment_params (code, label, hours, spread_pct, source)
select 'SE_ROAD_KAA_INLAND',
       'Droga SE Karlskrona → Boden (wariant śródlądowy)',
       p.hours, p.spread_pct,
       '#603 / 27B:C: osobna kalibracja vs E4 (SE_ROAD_KAA); wybór korytarza w 27B'
  from public.eta_segment_params p
 where p.code = 'SE_ROAD_KAA'
on conflict (code) do update set
  label = excluded.label,
  source = excluded.source,
  updated_at = now();

-- bez wrappera 0-arg (F7 N1 / 0320): wywołanie = eta_rebuild_segment_observations() z DEFAULT

commit;
