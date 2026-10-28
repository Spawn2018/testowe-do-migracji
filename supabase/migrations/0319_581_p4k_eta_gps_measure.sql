-- =====================================================================
-- #581 P4-k cz.1 — pomiar odcinków ETA z GPS / stref (F7 r1)
--
--   1) corridor: kody jak eta_segment_params
--   2) stare błędne wiersze H4 → H4_BLEDNY_POMIAR
--   3) eta_route_segments — trasy/przeprawy bez kodu w funkcji
--   4) eta_record_segment_observations(load): odcinki z GEOFENCE_* + GPS
--   5) h4 / trigger: błąd → integration_runs (po wycofaniu podtransakcji)
--   6) eta_rebuild_segment_observations(p_since): okno 30 dni, bez REMOVED
-- =====================================================================

-- 1. Szerszy CHECK na corridor
alter table public.eta_segment_observations
  drop constraint if exists eta_segment_observations_corridor_check;

alter table public.eta_segment_observations
  add constraint eta_segment_observations_corridor_check
  check (corridor ~ '^[A-Z][A-Z0-9_]{1,62}$');

comment on column public.eta_segment_observations.corridor is
  '#581 P4-k: kod odcinka jak eta_segment_params (PL_ROAD, PORT_CHECKIN, CROSSING_*, SE_ROAD_*, …).';

-- 2. Stare bezużyteczne pomiary H4
update public.eta_segment_observations
   set exclude_reason = 'H4_BLEDNY_POMIAR'
 where exclude_reason is null
   and (
     corridor = 'SE_E4'
     or coalesce(hours_observed, 0) = 0
     or coalesce(features->>'h4', '') in ('true', 't', '1')
   );

-- 3. Nowe kody przepraw + mapa trasa → odcinek (bez hardcode w funkcji)
alter table public.eta_segment_params
  drop constraint if exists eta_segment_params_code_check;

alter table public.eta_segment_params
  add constraint eta_segment_params_code_check
  check (code in (
    'PL_ROAD', 'PL_ROAD_GDY', 'PORT_CHECKIN',
    'CROSSING_DEFAULT', 'CROSSING_GDN_NYN', 'CROSSING_GDY_KAA',
    'SE_ROAD', 'SE_ROAD_KAA', 'SE_DAILY_REST', 'SE_BREAKS', 'GPS_FRESH_MIN'
  ));

insert into public.eta_segment_params (code, label, hours, spread_pct, source)
select v.code, v.label, p.hours, p.spread_pct, '#581 P4-k: kod per przeprawa (z CROSSING_DEFAULT)'
  from public.eta_segment_params p
  cross join (values
    ('CROSSING_GDN_NYN', 'Przeprawa Gdańsk → Nynäshamn'),
    ('CROSSING_GDY_KAA', 'Przeprawa Gdynia → Karlskrona')
  ) as v(code, label)
 where p.code = 'CROSSING_DEFAULT'
on conflict (code) do update set
  label = excluded.label,
  hours = excluded.hours,
  spread_pct = excluded.spread_pct,
  source = excluded.source,
  updated_at = now();

create table if not exists public.eta_route_segments (
  route_key     text not null,
  segment_role  text not null
    check (segment_role in ('PL_ROAD', 'PORT_CHECKIN', 'CROSSING', 'SE_ROAD')),
  segment_code  text not null references public.eta_segment_params(code),
  primary key (route_key, segment_role)
);

comment on table public.eta_route_segments is
  '#581: mapa trasy rejsu/operatora → kody odcinków ETA; nowe przeprawy bez zmiany funkcji.';

alter table public.eta_route_segments enable row level security;
revoke all on public.eta_route_segments from public, anon, authenticated;
grant select on public.eta_route_segments to authenticated;
grant select, insert, update, delete on public.eta_route_segments to service_role;

drop policy if exists eta_route_segments_hhl on public.eta_route_segments;
create policy eta_route_segments_hhl on public.eta_route_segments
  for select to authenticated using (is_hhl() is true);

insert into public.eta_route_segments (route_key, segment_role, segment_code) values
  ('GDN-NYN',    'PL_ROAD',       'PL_ROAD'),
  ('GDN-NYN',    'PORT_CHECKIN',  'PORT_CHECKIN'),
  ('GDN-NYN',    'CROSSING',      'CROSSING_GDN_NYN'),
  ('GDN-NYN',    'SE_ROAD',       'SE_ROAD'),
  ('NYN-GDN',    'PL_ROAD',       'PL_ROAD'),
  ('NYN-GDN',    'PORT_CHECKIN',  'PORT_CHECKIN'),
  ('NYN-GDN',    'CROSSING',      'CROSSING_GDN_NYN'),
  ('NYN-GDN',    'SE_ROAD',       'SE_ROAD'),
  ('POLFERRIES', 'PL_ROAD',       'PL_ROAD'),
  ('POLFERRIES', 'PORT_CHECKIN',  'PORT_CHECKIN'),
  ('POLFERRIES', 'CROSSING',      'CROSSING_GDN_NYN'),
  ('POLFERRIES', 'SE_ROAD',       'SE_ROAD'),
  ('GDY-KAA',    'PL_ROAD',       'PL_ROAD_GDY'),
  ('GDY-KAA',    'PORT_CHECKIN',  'PORT_CHECKIN'),
  ('GDY-KAA',    'CROSSING',      'CROSSING_GDY_KAA'),
  ('GDY-KAA',    'SE_ROAD',       'SE_ROAD_KAA'),
  ('KAA-GDY',    'PL_ROAD',       'PL_ROAD_GDY'),
  ('KAA-GDY',    'PORT_CHECKIN',  'PORT_CHECKIN'),
  ('KAA-GDY',    'CROSSING',      'CROSSING_GDY_KAA'),
  ('KAA-GDY',    'SE_ROAD',       'SE_ROAD_KAA'),
  ('STENA',      'PL_ROAD',       'PL_ROAD_GDY'),
  ('STENA',      'PORT_CHECKIN',  'PORT_CHECKIN'),
  ('STENA',      'CROSSING',      'CROSSING_GDY_KAA'),
  ('STENA',      'SE_ROAD',       'SE_ROAD_KAA')
on conflict (route_key, segment_role) do update
  set segment_code = excluded.segment_code;

-- Unikalność aktywnych pomiarów P4-k (jeden wiersz na odcinek)
create unique index if not exists eta_seg_obs_p4k_load_corridor_uidx
  on public.eta_segment_observations (load_id, corridor)
  where (features->>'p4k') = 'true';

-- Indeksy detached (unikamy pełnego skanu positions / load_events)
create index if not exists positions_detached_load_ts_idx
  on public.positions (detached_load_id, ts)
  where detached_load_id is not null;

create index if not exists load_events_detached_load_occurred_idx
  on public.load_events (detached_load_id, occurred_at)
  where detached_load_id is not null;

-- ---------------------------------------------------------------------------
-- Pozycje: geom_raw, dedup po ts (priorytet źródła), orphan w oknie
-- ---------------------------------------------------------------------------
create or replace function public.eta_obs_position_rows(p_load uuid, p_from timestamptz, p_to timestamptz)
returns table (ts timestamptz, g geometry, ignition boolean)
language sql stable security definer set search_path = public, pg_temp as $$
  with l as (
    select id,
           upper(regexp_replace(coalesce(tractor_plate, ''), '[^A-Z0-9]', '', 'g')) as plate_tr,
           upper(regexp_replace(coalesce(trailer_plate, ''), '[^A-Z0-9]', '', 'g')) as plate_tl,
           coalesce(actual_load_at, plan_load_date::timestamptz) as win_from,
           coalesce(actual_delivery_at, now()) as win_to
      from loads where id = p_load
  ),
  raw as (
    select p.ts,
           p.geom_raw as g,
           p.ignition,
           case p.source::text
             when 'TELEMATICS_API' then 1
             when 'RFMS' then 2
             when 'EMTRACK_WEB' then 3
             when 'SUBCONTRACTOR_LINK' then 4
             when 'DRIVER_PWA' then 5
             when 'MANUAL' then 6
             else 9
           end as prio
      from positions p
     where (p.load_id = p_load or p.detached_load_id = p_load)
       and p.ts >= p_from and p.ts <= p_to
       and p.geom_raw is not null
    union all
    select o.ts,
           st_setsrid(st_makepoint(o.lon, o.lat), 4326) as g,
           o.ignition,
           8 as prio
      from telematics_orphan_positions o
      join l on (
             (l.plate_tr <> '' and o.plate = l.plate_tr)
             or (l.plate_tl <> '' and o.plate = l.plate_tl)
           )
           and o.ts >= greatest(p_from, l.win_from)
           and o.ts <= least(p_to, l.win_to)
  )
  select distinct on (r.ts) r.ts, r.g, r.ignition
    from raw r
   order by r.ts, r.prio;
$$;

revoke all on function public.eta_obs_position_rows(uuid, timestamptz, timestamptz)
  from public, anon, authenticated;
grant execute on function public.eta_obs_position_rows(uuid, timestamptz, timestamptz) to service_role;

comment on function public.eta_obs_position_rows(uuid, timestamptz, timestamptz) is
  '#581: punkty GPS (geom_raw; 1 na ts wg priorytetu źródła; + orphan pojazdu).';

-- ---------------------------------------------------------------------------
-- Km + pokrycie: luki brzegowe w gap_max; skoki >150 km/h i dt≤0 pomijane
-- pokrycie = suma odcinków ≤60 min / span (luki brzegowe obniżają % przez brak w covered)
-- ---------------------------------------------------------------------------
create or replace function public.eta_track_km_coverage(p_load uuid, p_from timestamptz, p_to timestamptz)
returns table (km numeric, coverage_pct numeric, gap_max_min numeric, n_points int)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_km double precision := 0;
  v_gap_max double precision := 0;
  v_span double precision;
  v_covered double precision := 0;
  v_prev_ts timestamptz;
  v_prev_g geometry;
  v_first_ts timestamptz;
  r record;
  v_n int := 0;
  v_dt double precision;
  v_dist_km double precision;
  v_edge double precision;
begin
  if p_from is null or p_to is null or p_to <= p_from then
    return query select null::numeric, null::numeric, null::numeric, 0;
    return;
  end if;
  v_span := extract(epoch from (p_to - p_from));
  for r in
    select * from eta_obs_position_rows(p_load, p_from, p_to)
  loop
    if v_first_ts is null then
      v_first_ts := r.ts;
    end if;
    if v_prev_ts is not null then
      v_dt := extract(epoch from (r.ts - v_prev_ts));
      if v_dt <= 0 then
        continue;
      end if;
      if v_prev_g is not null and r.g is not null then
        v_dist_km := st_distance(v_prev_g::geography, r.g::geography) / 1000.0;
        if (v_dist_km / (v_dt / 3600.0)) > 150 then
          continue; -- skok: pomijamy punkt
        end if;
        v_km := v_km + v_dist_km;
      end if;
      if v_dt > v_gap_max then v_gap_max := v_dt; end if;
      if v_dt <= 3600 then
        v_covered := v_covered + v_dt;
      end if;
    end if;
    v_n := v_n + 1;
    v_prev_ts := r.ts;
    v_prev_g := r.g;
  end loop;
  if v_first_ts is not null then
    v_edge := extract(epoch from (v_first_ts - p_from));
    if v_edge > v_gap_max then v_gap_max := v_edge; end if;
  end if;
  if v_prev_ts is not null then
    v_edge := extract(epoch from (p_to - v_prev_ts));
    if v_edge > v_gap_max then v_gap_max := v_edge; end if;
  elsif v_span > v_gap_max then
    v_gap_max := v_span; -- brak punktów = cała luka
  end if;
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
-- Zdarzenia stref (ENTER = pierwszy po after; EXIT = ostatni w (after, before))
-- filtr geofences.route gdy p_route podany
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
     and (p_after is null or e.occurred_at > p_after)
     and (p_before is null or e.occurred_at < p_before)
     and (
       p_route is null
       or p_kind not in ('PORT_OUT', 'PORT_IN', 'PRE_PORT')
       or coalesce(g.route, e.payload->>'route') is null
       or coalesce(g.route, e.payload->>'route') = p_route
       or (p_route in ('GDN-NYN', 'NYN-GDN', 'POLFERRIES')
           and coalesce(g.route, e.payload->>'route') in ('POLFERRIES', 'GDN-NYN', 'NYN-GDN'))
       or (p_route in ('GDY-KAA', 'KAA-GDY', 'STENA')
           and coalesce(g.route, e.payload->>'route') in ('STENA', 'GDY-KAA', 'KAA-GDY'))
     );
$$;

revoke all on function public.eta_seg_event_at(uuid, text, text, timestamptz, timestamptz, text)
  from public, anon, authenticated;
grant execute on function public.eta_seg_event_at(uuid, text, text, timestamptz, timestamptz, text) to service_role;

-- kompatybilność: stara sygnatura 4-arg → nowa
create or replace function public.eta_seg_event_at(
  p_load uuid, p_event text, p_kind text, p_after timestamptz
) returns timestamptz
language sql stable security definer set search_path = public, pg_temp as $$
  select public.eta_seg_event_at(p_load, p_event, p_kind, p_after, null::timestamptz, null::text);
$$;

revoke all on function public.eta_seg_event_at(uuid, text, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.eta_seg_event_at(uuid, text, text, timestamptz) to service_role;

-- ---------------------------------------------------------------------------
-- Trasa transportu: sailing.route → geofences.route zdarzeń portowych
-- ---------------------------------------------------------------------------
create or replace function public.eta_obs_route_key(p_load uuid)
returns text
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v text;
begin
  select s.route into v
    from loads l
    left join sailings s on s.id = l.sailing_id
   where l.id = p_load;
  if v is not null and exists (
    select 1 from eta_route_segments where route_key = v
  ) then
    return v;
  end if;

  select coalesce(g.route, e.payload->>'route') into v
    from load_events e
    left join geofences g on g.id = nullif(e.payload->>'geofence_id', '')::uuid
   where (e.load_id = p_load or e.detached_load_id = p_load)
     and e.event_type in ('GEOFENCE_ENTER', 'GEOFENCE_EXIT')
     and coalesce(g.kind::text, e.payload->>'geofence_kind') in ('PORT_OUT', 'PORT_IN')
     and coalesce(g.route, e.payload->>'route') is not null
   order by e.occurred_at
   limit 1;

  if v is not null and exists (
    select 1 from eta_route_segments where route_key = v
  ) then
    return v;
  end if;
  return null;
end;
$$;

revoke all on function public.eta_obs_route_key(uuid)
  from public, anon, authenticated;
grant execute on function public.eta_obs_route_key(uuid) to service_role;

create or replace function public.eta_obs_segment_code(p_route text, p_role text)
returns text
language sql stable security definer set search_path = public, pg_temp as $$
  select segment_code
    from eta_route_segments
   where route_key = p_route and segment_role = p_role;
$$;

revoke all on function public.eta_obs_segment_code(text, text)
  from public, anon, authenticated;
grant execute on function public.eta_obs_segment_code(text, text) to service_role;

-- ---------------------------------------------------------------------------
-- Zapis jednego odcinka
-- p_gps_quality: true tylko dla odcinków drogowych (PL/SE)
-- ---------------------------------------------------------------------------
create or replace function public.eta_upsert_segment_observation(
  p_load uuid,
  p_corridor text,
  p_from timestamptz,
  p_to timestamptz,
  p_gps_quality boolean default true,
  p_force_exclude text default null
) returns bigint
language plpgsql security definer set search_path = public, pg_temp as $$
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
  if p_corridor is null then
    return null;
  end if;
  -- ręczne wykluczenie HHL zostaje (nie nadpisujemy)
  if exists (
    select 1 from eta_segment_observations
     where load_id = p_load
       and corridor = p_corridor
       and (features->>'p4k') = 'true'
       and exclude_reason is not null
       and exclude_reason not in (
         'LUKA_GPS', 'POKRYCIE_GPS', 'BRAK_GPS', 'TRASA_NIEZNANA', 'BRAK_ZDARZENIA'
       )
  ) then
    return null;
  end if;

  if p_from is null or p_to is null or p_to <= p_from then
    if p_force_exclude is null then
      return null;
    end if;
  end if;

  if p_from is not null and p_to is not null and p_to > p_from then
    v_hours := extract(epoch from (p_to - p_from)) / 3600.0;
  else
    v_hours := 0;
  end if;

  if p_gps_quality and p_from is not null and p_to is not null and p_to > p_from then
    select km, coverage_pct, gap_max_min, n_points
      into v_km, v_cov, v_gap, v_n
      from eta_track_km_coverage(p_load, p_from, p_to);
  else
    v_km := null;
    v_cov := null;
    v_gap := null;
    v_n := 0;
    if p_gps_quality is not true and p_from is not null and p_to is not null then
      select n_points into v_n from eta_track_km_coverage(p_load, p_from, p_to);
    end if;
  end if;

  v_excl := p_force_exclude;
  if v_excl is null and p_gps_quality then
    if coalesce(v_n, 0) < 2 then
      v_excl := 'BRAK_GPS';
    elsif coalesce(v_gap, 0) > 60 then
      v_excl := 'LUKA_GPS';
    elsif coalesce(v_cov, 0) < 80 then
      v_excl := 'POKRYCIE_GPS';
    end if;
  end if;

  if p_gps_quality and v_km is not null and v_km > 0 and v_hours > 0 then
    v_tempo := round((v_hours / (v_km / 100.0))::numeric, 4);
  else
    v_tempo := null;
    if p_gps_quality is not true then
      v_km := null;
    end if;
  end if;

  delete from eta_segment_observations
   where load_id = p_load
     and corridor = p_corridor
     and (features->>'p4k') = 'true'
     and (
       exclude_reason is null
       or exclude_reason in (
         'LUKA_GPS', 'POKRYCIE_GPS', 'BRAK_GPS', 'TRASA_NIEZNANA', 'BRAK_ZDARZENIA'
       )
     );

  insert into eta_segment_observations (
    load_id, corridor, hours_observed, km_observed, tempo_h_per_100km,
    features, exclude_reason, observed_at
  ) values (
    p_load, p_corridor, round(coalesce(v_hours, 0), 3), v_km, v_tempo,
    jsonb_build_object(
      'from', p_from, 'to', p_to,
      'coverage_pct', v_cov, 'gap_max_min', v_gap, 'n_points', v_n,
      'p4k', true,
      'gps_quality', p_gps_quality
    ),
    v_excl, coalesce(p_to, now())
  )
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.eta_upsert_segment_observation(uuid, text, timestamptz, timestamptz, boolean, text)
  from public, anon, authenticated;
grant execute on function public.eta_upsert_segment_observation(uuid, text, timestamptz, timestamptz, boolean, text) to service_role;

-- stara 4-arg
create or replace function public.eta_upsert_segment_observation(
  p_load uuid, p_corridor text, p_from timestamptz, p_to timestamptz
) returns bigint
language sql security definer set search_path = public, pg_temp as $$
  select public.eta_upsert_segment_observation(p_load, p_corridor, p_from, p_to, true, null);
$$;

revoke all on function public.eta_upsert_segment_observation(uuid, text, timestamptz, timestamptz)
  from public, anon, authenticated;
grant execute on function public.eta_upsert_segment_observation(uuid, text, timestamptz, timestamptz) to service_role;

-- ---------------------------------------------------------------------------
-- Pełny pomiar odcinków transportu
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
  n int := 0;
  v_route text;
  v_op text;
  c_pl text;
  c_ci text;
  c_cross text;
  c_se text;
  v_id bigint;
begin
  if not exists (select 1 from loads where id = p_load) then
    return 0;
  end if;

  -- kasuj poprzednie auto-pomiary P4-k (wszystkie korytarze); ręczne exclude zostaje
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
    -- bez znanej trasy: jeden wiersz diagnostyczny
    v_id := eta_upsert_segment_observation(
      p_load, 'PL_ROAD', null, null, false, 'TRASA_NIEZNANA'
    );
    return case when v_id is null then 0 else 1 end;
  end if;

  c_pl := eta_obs_segment_code(v_route, 'PL_ROAD');
  c_ci := eta_obs_segment_code(v_route, 'PORT_CHECKIN');
  c_cross := eta_obs_segment_code(v_route, 'CROSSING');
  c_se := eta_obs_segment_code(v_route, 'SE_ROAD');

  v_op := case
    when v_route in ('GDY-KAA', 'KAA-GDY', 'STENA') then 'STENA'
    else 'POLFERRIES'
  end;

  t_load_exit := eta_seg_event_at(p_load, 'GEOFENCE_EXIT', 'LOADING', null, null, null);
  t_port_in := eta_seg_event_at(p_load, 'GEOFENCE_ENTER', 'PORT_OUT', t_load_exit, null, v_op);
  t_pin_enter := eta_seg_event_at(p_load, 'GEOFENCE_ENTER', 'PORT_IN', t_port_in, null, v_op);
  -- ostatni EXIT przed kolejnym kamieniem
  t_port_out := eta_seg_event_at(p_load, 'GEOFENCE_EXIT', 'PORT_OUT', t_port_in, t_pin_enter, v_op);
  t_site := eta_seg_event_at(p_load, 'GEOFENCE_ENTER', 'SITE', coalesce(t_pin_enter, t_port_out), null, null);
  t_pin_exit := eta_seg_event_at(p_load, 'GEOFENCE_EXIT', 'PORT_IN', t_pin_enter, t_site, v_op);

  -- PL_ROAD
  if t_load_exit is not null and t_port_in is not null then
    if eta_upsert_segment_observation(p_load, c_pl, t_load_exit, t_port_in, true, null) is not null then
      n := n + 1;
    end if;
  end if;

  -- PORT_CHECKIN (bez kryteriów luki GPS; km/tempo NULL)
  if t_port_in is not null and t_port_out is not null then
    if eta_upsert_segment_observation(p_load, c_ci, t_port_in, t_port_out, false, null) is not null then
      n := n + 1;
    end if;
  elsif t_port_in is not null then
    if eta_upsert_segment_observation(
         p_load, c_ci, t_port_in, coalesce(t_pin_enter, t_port_in), false, 'BRAK_ZDARZENIA'
       ) is not null then
      n := n + 1;
    end if;
  end if;

  -- CROSSING
  if t_port_out is not null and t_pin_enter is not null then
    if eta_upsert_segment_observation(p_load, c_cross, t_port_out, t_pin_enter, false, null) is not null then
      n := n + 1;
    end if;
  elsif t_port_out is not null then
    if eta_upsert_segment_observation(
         p_load, c_cross, t_port_out, t_port_out, false, 'BRAK_ZDARZENIA'
       ) is not null then
      n := n + 1;
    end if;
  end if;

  -- SE_ROAD
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
  '#581 P4-k: pomiar z GEOFENCE + GPS; luka/pokrycie tylko PL/SE; trasa z eta_route_segments.';

-- ---------------------------------------------------------------------------
-- H4: bez insertu w exception (wycofany z błędem) — log w triggerze
-- ---------------------------------------------------------------------------
create or replace function public.h4_record_eta_observation(p_load uuid)
returns bigint
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  n int;
begin
  n := eta_record_segment_observations(p_load);
  return n;
end;
$$;

revoke all on function public.h4_record_eta_observation(uuid)
  from public, anon, authenticated;
grant execute on function public.h4_record_eta_observation(uuid) to service_role;

create or replace function public.trg_h4_eta_observation()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.actual_delivery_at is not null
     and (old.actual_delivery_at is null
          or old.actual_delivery_at is distinct from new.actual_delivery_at) then
    begin
      perform h4_record_eta_observation(new.id);
    exception when others then
      -- po wycofaniu podtransakcji — wpis zostaje (F7 #598 pkt 4)
      insert into integration_runs (job, ok, result)
      values (
        'eta_calib_obs',
        false,
        jsonb_build_object(
          'load_id', new.id,
          'sqlstate', SQLSTATE,
          'msg', left(SQLERRM, 200)
        )
      );
    end;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Odbudowa: p_since (domyślnie 30 dni); bez CANCELLED/REMOVED
-- tryb ciągły (cron 48 h + pomiar przy dostawie) — cz.2 / PLAN; tu okno retencji
-- ---------------------------------------------------------------------------
create or replace function public.eta_rebuild_segment_observations(
  p_since timestamptz default null
)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  r record;
  n_ok int := 0;
  n_fail int := 0;
  n_seg int := 0;
  v int;
  v_since timestamptz := coalesce(p_since, now() - interval '30 days');
begin
  for r in
    select l.id
      from loads l
     where l.actual_delivery_at is not null
       and l.actual_delivery_at >= v_since
       and l.status::text not in ('CANCELLED', 'REMOVED')
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
    jsonb_build_object(
      'loads_ok', n_ok, 'loads_fail', n_fail, 'segments', n_seg,
      'since', v_since
    )
  );
  return jsonb_build_object('loads_ok', n_ok, 'loads_fail', n_fail, 'segments', n_seg, 'since', v_since);
end;
$$;

revoke all on function public.eta_rebuild_segment_observations(timestamptz)
  from public, anon, authenticated;
grant execute on function public.eta_rebuild_segment_observations(timestamptz) to service_role;

-- bezargumentowe (cron / ręczne)
create or replace function public.eta_rebuild_segment_observations()
returns jsonb
language sql security definer set search_path = public, pg_temp as $$
  select public.eta_rebuild_segment_observations(null::timestamptz);
$$;

revoke all on function public.eta_rebuild_segment_observations()
  from public, anon, authenticated;
grant execute on function public.eta_rebuild_segment_observations() to service_role;

comment on function public.eta_rebuild_segment_observations() is
  '#581 P4-k: odbudowa pomiarów GPS dla dostaw w oknie 30 dni (p_since); bez CANCELLED/REMOVED. Ciągły cron 48 h — cz.2.';
