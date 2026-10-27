-- =====================================================================
-- #581 P4-k cz.1 — pomiar odcinków ETA z GPS / stref (nie z nadpisanego eta_site)
--
--   1) corridor: kody jak eta_segment_params (nie tylko PL_ROAD/SE_E4)
--   2) stare błędne wiersze H4 → exclude_reason = H4_BLEDNY_POMIAR
--   3) eta_record_segment_observations(load): PL_ROAD / PORT_CHECKIN /
--      CROSSING_DEFAULT / SE_ROAD z GEOFENCE_* + długość śladu GPS
--   4) h4_record_eta_observation woła (3); błąd → integration_runs (bez połykania)
--   5) eta_rebuild_segment_observations(): dostawy z GPS (retencja 30 dni)
-- =====================================================================

-- 1. Szerszy CHECK na corridor (kody odcinków + przyszłe trasy BN1)
alter table public.eta_segment_observations
  drop constraint if exists eta_segment_observations_corridor_check;

alter table public.eta_segment_observations
  add constraint eta_segment_observations_corridor_check
  check (corridor ~ '^[A-Z][A-Z0-9_]{1,62}$');

comment on column public.eta_segment_observations.corridor is
  '#581 P4-k: kod odcinka jak eta_segment_params (PL_ROAD, PORT_CHECKIN, CROSSING_*, SE_ROAD_*, …), nie SE_E4 na sztywno.';

-- 2. Stare bezużyteczne pomiary H4 (SE_E4, hours=0 / porównanie z nadpisanym eta_site)
update public.eta_segment_observations
   set exclude_reason = 'H4_BLEDNY_POMIAR'
 where exclude_reason is null
   and (
     corridor = 'SE_E4'
     or coalesce(hours_observed, 0) = 0
     or coalesce(features->>'h4', '') in ('true', 't', '1')
   );

-- ---------------------------------------------------------------------------
-- Pozycje transportu: load_id + detached_load_id (+ orphan po tablicy w oknie)
-- ---------------------------------------------------------------------------
create or replace function public.eta_obs_position_rows(p_load uuid, p_from timestamptz, p_to timestamptz)
returns table (ts timestamptz, g geometry, ignition boolean)
language sql stable security definer set search_path = public as $$
  with l as (
    select id,
           upper(regexp_replace(coalesce(tractor_plate, ''), '[^A-Z0-9]', '', 'g')) as plate_tr,
           upper(regexp_replace(coalesce(trailer_plate, ''), '[^A-Z0-9]', '', 'g')) as plate_tl,
           coalesce(actual_load_at, plan_load_date::timestamptz) as win_from,
           coalesce(actual_delivery_at, now()) as win_to
      from loads where id = p_load
  )
  select p.ts, coalesce(p.geom_snapped, p.geom_raw) as g, p.ignition
    from positions p
   where (p.load_id = p_load or p.detached_load_id = p_load)
     and p.ts >= p_from and p.ts <= p_to
  union all
  select o.ts,
         st_setsrid(st_makepoint(o.lon, o.lat), 4326) as g,
         o.ignition
    from telematics_orphan_positions o
    join l on (
           (l.plate_tr <> '' and o.plate = l.plate_tr)
           or (l.plate_tl <> '' and o.plate = l.plate_tl)
         )
         and o.ts >= greatest(p_from, l.win_from)
         and o.ts <= least(p_to, l.win_to)
   order by 1;
$$;

revoke all on function public.eta_obs_position_rows(uuid, timestamptz, timestamptz)
  from public, anon, authenticated;
grant execute on function public.eta_obs_position_rows(uuid, timestamptz, timestamptz) to service_role;

comment on function public.eta_obs_position_rows(uuid, timestamptz, timestamptz) is
  '#581: punkty GPS transportu (positions + detached + orphan pojazdu w oknie).';

-- ---------------------------------------------------------------------------
-- Km śladu + pokrycie czasu (luka > 60 min obniża pokrycie)
-- ---------------------------------------------------------------------------
create or replace function public.eta_track_km_coverage(p_load uuid, p_from timestamptz, p_to timestamptz)
returns table (km numeric, coverage_pct numeric, gap_max_min numeric, n_points int)
language plpgsql stable security definer set search_path = public as $$
declare
  v_km double precision := 0;
  v_gap_max double precision := 0;
  v_span double precision;
  v_covered double precision := 0;
  v_prev_ts timestamptz;
  v_prev_g geometry;
  r record;
  v_n int := 0;
  v_dt double precision;
begin
  if p_from is null or p_to is null or p_to <= p_from then
    return query select null::numeric, null::numeric, null::numeric, 0;
    return;
  end if;
  v_span := extract(epoch from (p_to - p_from));
  for r in
    select * from eta_obs_position_rows(p_load, p_from, p_to)
  loop
    v_n := v_n + 1;
    if v_prev_ts is not null then
      v_dt := extract(epoch from (r.ts - v_prev_ts));
      if v_dt > v_gap_max then v_gap_max := v_dt; end if;
      if v_dt > 0 and v_dt <= 3600 then
        v_covered := v_covered + v_dt;
      end if;
      if v_prev_g is not null and r.g is not null then
        v_km := v_km + st_distance(v_prev_g::geography, r.g::geography) / 1000.0;
      end if;
    end if;
    v_prev_ts := r.ts;
    v_prev_g := r.g;
  end loop;
  return query select
    round(v_km::numeric, 2),
    case when v_span > 0 then round((least(v_covered, v_span) / v_span * 100)::numeric, 1) else null end,
    round((v_gap_max / 60.0)::numeric, 1),
    v_n;
end;
$$;

revoke all on function public.eta_track_km_coverage(uuid, timestamptz, timestamptz)
  from public, anon, authenticated;
grant execute on function public.eta_track_km_coverage(uuid, timestamptz, timestamptz) to service_role;

-- ---------------------------------------------------------------------------
-- Czas zdarzenia strefy (payload.geofence_id → kind, albo payload.geofence_kind)
-- ---------------------------------------------------------------------------
create or replace function public.eta_seg_event_at(
  p_load uuid, p_event text, p_kind text, p_after timestamptz default null
) returns timestamptz
language sql stable security definer set search_path = public as $$
  select min(e.occurred_at)
    from load_events e
    left join geofences g on g.id = nullif(e.payload->>'geofence_id', '')::uuid
   where (e.load_id = p_load or e.detached_load_id = p_load)
     and e.event_type = p_event
     and coalesce(g.kind::text, e.payload->>'geofence_kind') = p_kind
     and (p_after is null or e.occurred_at > p_after);
$$;

revoke all on function public.eta_seg_event_at(uuid, text, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.eta_seg_event_at(uuid, text, text, timestamptz) to service_role;

-- ---------------------------------------------------------------------------
-- Zapis jednego odcinka (idempotentny: kasuje poprzedni bez exclude)
-- ---------------------------------------------------------------------------
create or replace function public.eta_upsert_segment_observation(
  p_load uuid,
  p_corridor text,
  p_from timestamptz,
  p_to timestamptz
) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_hours numeric;
  v_km numeric;
  v_cov numeric;
  v_gap numeric;
  v_n int;
  v_excl text;
  v_tempo numeric;
  v_id bigint;
begin
  if p_from is null or p_to is null or p_to <= p_from then
    return null;
  end if;
  v_hours := extract(epoch from (p_to - p_from)) / 3600.0;
  select km, coverage_pct, gap_max_min, n_points
    into v_km, v_cov, v_gap, v_n
    from eta_track_km_coverage(p_load, p_from, p_to);

  v_excl := null;
  if v_n < 2 then
    v_excl := 'BRAK_GPS';
  elsif coalesce(v_gap, 0) > 60 then
    v_excl := 'LUKA_GPS';
  elsif coalesce(v_cov, 0) < 80 then
    v_excl := 'POKRYCIE_GPS';
  end if;

  if v_km is not null and v_km > 0 and v_hours > 0 then
    v_tempo := round((v_hours / (v_km / 100.0))::numeric, 4);
  end if;

  delete from eta_segment_observations
   where load_id = p_load
     and corridor = p_corridor
     and exclude_reason is null;

  insert into eta_segment_observations (
    load_id, corridor, hours_observed, km_observed, tempo_h_per_100km,
    features, exclude_reason, observed_at
  ) values (
    p_load, p_corridor, round(v_hours, 3), v_km, v_tempo,
    jsonb_build_object(
      'from', p_from, 'to', p_to,
      'coverage_pct', v_cov, 'gap_max_min', v_gap, 'n_points', v_n,
      'p4k', true
    ),
    v_excl, coalesce(p_to, now())
  )
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.eta_upsert_segment_observation(uuid, text, timestamptz, timestamptz)
  from public, anon, authenticated;
grant execute on function public.eta_upsert_segment_observation(uuid, text, timestamptz, timestamptz) to service_role;

-- ---------------------------------------------------------------------------
-- Pełny pomiar odcinków transportu (III-1 + GPS)
-- ---------------------------------------------------------------------------
create or replace function public.eta_record_segment_observations(p_load uuid)
returns int
language plpgsql security definer set search_path = public as $$
declare
  t_load_exit timestamptz;
  t_port_in timestamptz;
  t_port_out timestamptz;
  t_pin_enter timestamptz;
  t_pin_exit timestamptz;
  t_site timestamptz;
  n int := 0;
  v_ferry text;
begin
  if not exists (select 1 from loads where id = p_load) then
    return 0;
  end if;

  -- Karlskrona (KAA) vs Nynäshamn — kod drogi SE z trasy rejsu (#487)
  select case
           when s.route in ('GDY-KAA', 'KAA-GDY') then 'SE_ROAD_KAA'
           else 'SE_ROAD'
         end
    into v_ferry
    from loads l
    left join sailings s on s.id = l.sailing_id
   where l.id = p_load;
  v_ferry := coalesce(v_ferry, 'SE_ROAD');

  t_load_exit := eta_seg_event_at(p_load, 'GEOFENCE_EXIT', 'LOADING', null);
  t_port_in := eta_seg_event_at(p_load, 'GEOFENCE_ENTER', 'PORT_OUT', t_load_exit);
  t_port_out := eta_seg_event_at(p_load, 'GEOFENCE_EXIT', 'PORT_OUT', t_port_in);
  t_pin_enter := eta_seg_event_at(p_load, 'GEOFENCE_ENTER', 'PORT_IN', t_port_out);
  t_pin_exit := eta_seg_event_at(p_load, 'GEOFENCE_EXIT', 'PORT_IN', t_pin_enter);
  t_site := eta_seg_event_at(p_load, 'GEOFENCE_ENTER', 'SITE', coalesce(t_pin_exit, t_pin_enter));

  if t_load_exit is not null and t_port_in is not null then
    if eta_upsert_segment_observation(p_load, 'PL_ROAD', t_load_exit, t_port_in) is not null then
      n := n + 1;
    end if;
  end if;
  if t_port_in is not null and t_port_out is not null then
    if eta_upsert_segment_observation(p_load, 'PORT_CHECKIN', t_port_in, t_port_out) is not null then
      n := n + 1;
    end if;
  end if;
  if t_port_out is not null and t_pin_enter is not null then
    if eta_upsert_segment_observation(p_load, 'CROSSING_DEFAULT', t_port_out, t_pin_enter) is not null then
      n := n + 1;
    end if;
  end if;
  if coalesce(t_pin_exit, t_pin_enter) is not null and t_site is not null then
    if eta_upsert_segment_observation(
         p_load, v_ferry, coalesce(t_pin_exit, t_pin_enter), t_site
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
  '#581 P4-k: pomiar odcinków z GEOFENCE + ślad GPS; exclude przy luce >60 min lub pokryciu <80 %.';

-- ---------------------------------------------------------------------------
-- H4: bez połykania wyjątków — błąd do integration_runs
-- ---------------------------------------------------------------------------
create or replace function public.h4_record_eta_observation(p_load uuid)
returns bigint
language plpgsql security definer set search_path = public as $$
declare
  n int;
begin
  n := eta_record_segment_observations(p_load);
  return n;
exception when others then
  insert into integration_runs (job, ok, result)
  values (
    'eta_calib_obs',
    false,
    jsonb_build_object(
      'load_id', p_load,
      'sqlstate', SQLSTATE,
      'msg', left(SQLERRM, 200)
    )
  );
  raise; -- #581 pkt 6: nie połykaj — trigger łapie i nie blokuje loads
end;
$$;

revoke all on function public.h4_record_eta_observation(uuid)
  from public, anon, authenticated;
grant execute on function public.h4_record_eta_observation(uuid) to service_role;

create or replace function public.trg_h4_eta_observation()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.actual_delivery_at is not null
     and (old.actual_delivery_at is null
          or old.actual_delivery_at is distinct from new.actual_delivery_at) then
    begin
      perform h4_record_eta_observation(new.id);
    exception when others then
      -- loads nie blokujemy; wpis w integration_runs zrobiła h4_record_eta_observation
      null;
    end;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Odbudowa historii (retencja GPS 30 dni — przed 04.11 dla 15062)
-- ---------------------------------------------------------------------------
create or replace function public.eta_rebuild_segment_observations()
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r record;
  n_ok int := 0;
  n_fail int := 0;
  n_seg int := 0;
  v int;
begin
  for r in
    select l.id
      from loads l
     where l.actual_delivery_at is not null
       and l.status is distinct from 'CANCELLED'
       and (
         exists (select 1 from positions p where p.load_id = l.id or p.detached_load_id = l.id)
         or exists (
           select 1 from telematics_orphan_positions o
            where o.plate = upper(regexp_replace(coalesce(l.tractor_plate, ''), '[^A-Z0-9]', '', 'g'))
               or o.plate = upper(regexp_replace(coalesce(l.trailer_plate, ''), '[^A-Z0-9]', '', 'g'))
         )
       )
  loop
    begin
      v := eta_record_segment_observations(r.id);
      n_seg := n_seg + coalesce(v, 0);
      n_ok := n_ok + 1;
    exception when others then
      n_fail := n_fail + 1;
      insert into integration_runs (job, ok, result)
      values (
        'eta_calib_rebuild',
        false,
        jsonb_build_object('load_id', r.id, 'sqlstate', SQLSTATE, 'msg', left(SQLERRM, 200))
      );
    end;
  end loop;
  insert into integration_runs (job, ok, result)
  values (
    'eta_calib_rebuild',
    (n_fail = 0),
    jsonb_build_object('loads_ok', n_ok, 'loads_fail', n_fail, 'segments', n_seg)
  );
  return jsonb_build_object('loads_ok', n_ok, 'loads_fail', n_fail, 'segments', n_seg);
end;
$$;

revoke all on function public.eta_rebuild_segment_observations()
  from public, anon, authenticated;
grant execute on function public.eta_rebuild_segment_observations() to service_role;

comment on function public.eta_rebuild_segment_observations() is
  '#581 P4-k pkt 6: odbudowa pomiarów z GPS dla dostaw (przed retencją 30 dni).';
