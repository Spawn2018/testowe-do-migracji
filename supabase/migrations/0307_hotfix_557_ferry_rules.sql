-- #557 PR2 — reguły po dopłynięciu (D-20261025-1630-01):
-- 1) AIS-dopłynięcie + pozycja w SE → IN_TRANSIT_SE bez zależności od geofences.active
-- 2) po actual_arrival + 2 h bez pozycji SE → ryzyko „sprawdź po dopłynięciu”
-- 3) stary punkt emtrack (identyczne współrzędne PL) — flaga stale_point, bez faz
-- 4) zły rejs: ryzyko + propozycja; przypięcie RPC (HHL)

-- ---------------------------------------------------------------------------
-- 1. Awaryjne: FERRY → IN_TRANSIT_SE po actual_arrival + ląd SE (bez g.active)
-- ---------------------------------------------------------------------------
create or replace function public.apply_ferry_ais_arrival_backup(
  p_load_id uuid,
  p_lat double precision,
  p_lon double precision,
  p_ts timestamptz
) returns boolean
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_status load_status;
  v_arr    timestamptz;
  v_route  text;
  v_pt     geometry(Point, 4326);
  v_prev   text;
  v_ok     boolean := false;
begin
  if p_lat is null or p_lon is null then
    return false;
  end if;

  select l.status, s.actual_arrival_at, s.route
    into v_status, v_arr, v_route
    from public.loads l
    left join public.sailings s on s.id = l.sailing_id
   where l.id = p_load_id;

  if (v_status = 'FERRY') is not true then
    return false;
  end if;
  -- Tylko prawdziwe dopłynięcie AIS (nie plan).
  if (v_arr is not null and coalesce(p_ts, now()) > v_arr) is not true then
    return false;
  end if;
  -- Znane trasy (jak #496); brak rejsu = POLFERRIES legacy.
  if v_route is not null
     and v_route not in ('GDN-NYN', 'NYN-GDN', 'GDY-KAA', 'KAA-GDY') then
    return false;
  end if;

  v_pt := st_setsrid(st_makepoint(p_lon, p_lat), 4326);
  if st_covers(public.sweden_land_geom(), v_pt) is not true then
    return false;
  end if;

  v_prev := current_setting('tower.bulk_quiet', true);
  perform set_config('tower.bulk_quiet', 'on', true);
  v_ok := public.auto_set_status(
    p_load_id, 'FERRY', 'IN_TRANSIT_SE',
    'dopłynięcie rejsu (AIS) + pozycja w SE',
    coalesce(p_ts, now()),
    jsonb_build_object(
      'source', 'AIS_ARRIVAL_BACKUP',
      'powod', 'dopłynięcie rejsu (AIS) + pozycja w SE',
      'without_geofence', true
    )
  );
  perform set_config('tower.bulk_quiet', coalesce(v_prev, ''), true);
  return coalesce(v_ok, false);
end $function$;

revoke all on function public.apply_ferry_ais_arrival_backup(uuid, double precision, double precision, timestamptz)
  from public, anon, authenticated;
grant execute on function public.apply_ferry_ais_arrival_backup(uuid, double precision, double precision, timestamptz)
  to service_role;
comment on function public.apply_ferry_ais_arrival_backup(uuid, double precision, double precision, timestamptz) is
  '#557: FERRY→IN_TRANSIT_SE po actual_arrival + ląd SE; bez geofences.active.';

-- ---------------------------------------------------------------------------
-- 2. +2 h po dopłynięciu bez pozycji SE → ryzyko (bez zmiany statusu)
-- ---------------------------------------------------------------------------
create or replace function public.ferry_check_arrival_overdue(p_now timestamptz default now())
returns integer
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  r record;
  v_n int := 0;
  v_code text;
  v_key text;
begin
  for r in
    select l.id as load_id, l.project_id, s.actual_arrival_at
      from public.loads l
      join public.sailings s on s.id = l.sailing_id
     where l.status = 'FERRY'
       and s.actual_arrival_at is not null
       and s.actual_arrival_at + interval '2 hours' < coalesce(p_now, now())
       and not exists (
         select 1 from public.positions p
          where p.load_id = l.id
            and p.ts > s.actual_arrival_at
            and coalesce((p.raw->>'stale_point')::boolean, false) is not true
            and st_covers(public.sweden_land_geom(), p.geom_raw::geometry)
       )
  loop
    v_code := public.load_sms_code(r.load_id);
    v_key := 'FERRY_ARRIVAL_CHECK:' || r.load_id::text;
    if exists (
      select 1 from public.risk_signals
       where dedup_key = v_key and resolved_at is null
    ) then
      continue;
    end if;
    insert into public.risk_signals (
      project_id, load_id, kind, severity, title, title_key, detail, dedup_key, audience
    ) values (
      r.project_id, r.load_id, 'FERRY', 'HIGH',
      format('Sprawdź %s po dopłynięciu', coalesce(nullif(v_code, '—'), 'transport')),
      'rk_ferry_arrival_check',
      jsonb_build_object(
        'title_key', 'rk_ferry_arrival_check',
        'params', jsonb_build_object('code', v_code),
        'actual_arrival_at', r.actual_arrival_at
      ),
      v_key,
      'HHL'
    );
    v_n := v_n + 1;
  end loop;
  return v_n;
end $function$;

revoke all on function public.ferry_check_arrival_overdue(timestamptz)
  from public, anon, authenticated;
grant execute on function public.ferry_check_arrival_overdue(timestamptz)
  to service_role;
comment on function public.ferry_check_arrival_overdue(timestamptz) is
  '#557: FERRY + actual_arrival+2h bez pozycji SE → ryzyko rk_ferry_arrival_check.';

do $cron557$
begin
  if to_regclass('cron.job') is not null
     and to_regprocedure('cron.schedule(text,text,text)') is not null then
    perform cron.unschedule(j.jobid)
      from cron.job j where j.jobname = 'tower-ferry-arrival-check';
    perform cron.schedule(
      'tower-ferry-arrival-check',
      '*/15 * * * *',
      $c$select public.ferry_check_arrival_overdue(now());$c$
    );
  end if;
exception when others then
  raise warning '#557 cron ferry-arrival-check: %', sqlerrm;
end $cron557$;

-- ---------------------------------------------------------------------------
-- 3. Propozycja / wykrywanie złego rejsu
-- ---------------------------------------------------------------------------
create or replace function public.sailing_mismatch_propose_id(p_load_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_project uuid;
  v_route   text;
  v_last_pl timestamptz;
  v_first_se timestamptz;
  v_prop    uuid;
begin
  select l.project_id, s.route
    into v_project, v_route
    from public.loads l
    left join public.sailings s on s.id = l.sailing_id
   where l.id = p_load_id;
  if v_project is null then
    return null;
  end if;

  select max(p.ts) into v_last_pl
    from public.positions p
   where p.load_id = p_load_id
     and coalesce((p.raw->>'stale_point')::boolean, false) is not true
     and st_covers(public.sweden_land_geom(), p.geom_raw::geometry) is not true
     and p.ts is not null;

  select min(p.ts) into v_first_se
    from public.positions p
   where p.load_id = p_load_id
     and coalesce((p.raw->>'stale_point')::boolean, false) is not true
     and st_covers(public.sweden_land_geom(), p.geom_raw::geometry);

  if v_first_se is null then
    return null;
  end if;

  select s.id into v_prop
    from public.sailings s
   where s.project_id = v_project
     and s.actual_departure_at is not null
     and (v_route is null or s.route = v_route
          or (v_route in ('GDN-NYN','NYN-GDN') and s.route in ('GDN-NYN','NYN-GDN'))
          or (v_route in ('GDY-KAA','KAA-GDY') and s.route in ('GDY-KAA','KAA-GDY')))
     and (v_last_pl is null or s.actual_departure_at >= v_last_pl)
     and s.actual_departure_at <= v_first_se
   order by s.actual_departure_at desc
   limit 1;

  return v_prop;
end $function$;

revoke all on function public.sailing_mismatch_propose_id(uuid)
  from public, anon, authenticated;
grant execute on function public.sailing_mismatch_propose_id(uuid) to service_role;
comment on function public.sailing_mismatch_propose_id(uuid) is
  '#557: rejs z actual_departure między ostatnią PL a pierwszą SE.';

create or replace function public.detect_sailing_mismatch(
  p_load_id uuid,
  p_ts timestamptz default now()
) returns boolean
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_project uuid;
  v_sail    uuid;
  v_dep     timestamptz;
  v_act_dep timestamptz;
  v_status  text;
  v_prop    uuid;
  v_code    text;
  v_key     text;
begin
  select l.project_id, l.sailing_id, s.departure_at, s.actual_departure_at, s.status::text
    into v_project, v_sail, v_dep, v_act_dep, v_status
    from public.loads l
    left join public.sailings s on s.id = l.sailing_id
   where l.id = p_load_id;

  if v_project is null or v_sail is null then
    return false;
  end if;

  -- OK tylko gdy rejs faktycznie wypłynął ≤ pozycja w SE; inaczej mismatch.
  if v_act_dep is not null and v_act_dep <= coalesce(p_ts, now()) then
    return false;
  end if;

  v_prop := public.sailing_mismatch_propose_id(p_load_id);
  v_code := public.load_sms_code(p_load_id);
  v_key := 'SAILING_MISMATCH:' || p_load_id::text;

  insert into public.risk_signals (
    project_id, load_id, kind, severity, title, title_key, detail, dedup_key, audience
  ) values (
    v_project, p_load_id, 'FERRY', 'HIGH',
    'Auto w SE, a przypisany rejs jeszcze nie wypłynął',
    'rk_sailing_mismatch',
    jsonb_build_object(
      'title_key', 'rk_sailing_mismatch',
      'params', jsonb_build_object('code', v_code),
      'assigned_sailing_id', v_sail,
      'proposed_sailing_id', v_prop,
      'pos_at', coalesce(p_ts, now())
    ),
    v_key,
    'HHL'
  )
  on conflict (dedup_key) where dedup_key is not null and resolved_at is null do nothing;

  return true;
end $function$;

revoke all on function public.detect_sailing_mismatch(uuid, timestamptz)
  from public, anon, authenticated;
grant execute on function public.detect_sailing_mismatch(uuid, timestamptz) to service_role;
comment on function public.detect_sailing_mismatch(uuid, timestamptz) is
  '#557: pozycja SE + rejs niewypłynięty → ryzyko rk_sailing_mismatch + proposed_sailing_id.';

-- ---------------------------------------------------------------------------
-- 4. RPC front: podgląd propozycji + przypięcie (HHL)
-- ---------------------------------------------------------------------------
create or replace function public.sailing_mismatch_suggest(p_load_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_sail uuid;
  v_prop uuid;
  v_label text;
  v_open boolean;
begin
  -- B5: assert jako pierwsza instrukcja po begin (strażnik RPC).
  perform public.assert_not_preview();
  if auth.uid() is null or public.current_app_user_id() is null then
    raise exception 'Brak aktywnego konta' using errcode = '42501';
  end if;
  if (public.is_hhl()) is not true then
    raise exception 'wyłącznie HHL' using errcode = '42501';
  end if;

  select l.sailing_id into v_sail from public.loads l where l.id = p_load_id;
  if v_sail is null and not exists (select 1 from public.loads where id = p_load_id) then
    return jsonb_build_object('ok', false, 'reason', 'unknown_load');
  end if;

  v_open := exists (
    select 1 from public.risk_signals r
     where r.load_id = p_load_id
       and r.dedup_key = 'SAILING_MISMATCH:' || p_load_id::text
       and r.resolved_at is null
  );
  v_prop := public.sailing_mismatch_propose_id(p_load_id);
  if v_prop is not null then
    select coalesce(v.name, '') || ' ' || to_char(s.departure_at at time zone 'UTC', 'DD.MM HH24:MI')
      into v_label
      from public.sailings s
      left join public.vessels v on v.id = s.vessel_id
     where s.id = v_prop;
  end if;

  return jsonb_build_object(
    'ok', true,
    'mismatch', v_open,
    'assigned_sailing_id', v_sail,
    'proposed_sailing_id', v_prop,
    'proposed_label', v_label
  );
end $function$;

revoke all on function public.sailing_mismatch_suggest(uuid) from public, anon;
grant execute on function public.sailing_mismatch_suggest(uuid) to authenticated;
comment on function public.sailing_mismatch_suggest(uuid) is
  '#557 RPC: HHL — propozycja rejsu przy rk_sailing_mismatch (front „Przypnij rejs”).';

create or replace function public.sailing_mismatch_assign(p_load_id uuid, p_sailing_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_old uuid;
  v_actor uuid;
begin
  -- B5: assert jako pierwsza instrukcja po begin (strażnik RPC).
  perform public.assert_not_preview();
  if auth.uid() is null or public.current_app_user_id() is null then
    raise exception 'Brak aktywnego konta' using errcode = '42501';
  end if;
  if (public.is_hhl()) is not true then
    raise exception 'wyłącznie HHL' using errcode = '42501';
  end if;
  if p_load_id is null or p_sailing_id is null then
    raise exception 'load i sailing wymagane';
  end if;

  select sailing_id into v_old from public.loads where id = p_load_id for update;
  if not found then
    raise exception 'Nieznany ładunek';
  end if;
  if not exists (
    select 1 from public.sailings s
     where s.id = p_sailing_id
       and s.project_id = (select project_id from public.loads where id = p_load_id)
  ) then
    raise exception 'Rejs spoza projektu';
  end if;

  v_actor := public.current_app_user_id();
  update public.loads
     set sailing_id = p_sailing_id, updated_at = now()
   where id = p_load_id;

  insert into public.load_events (load_id, event_type, occurred_at, actor_id, payload)
  values (
    p_load_id, 'SAILING_ASSIGNED', now(), v_actor,
    jsonb_build_object(
      'sailing_id', p_sailing_id,
      'from_sailing_id', v_old,
      'powod', 'przypięcie rejsu (korekta mismatch #557)',
      'source', 'SAILING_MISMATCH_ASSIGN'
    )
  );

  update public.risk_signals
     set resolved_at = now()
   where load_id = p_load_id
     and dedup_key = 'SAILING_MISMATCH:' || p_load_id::text
     and resolved_at is null;

  return jsonb_build_object(
    'ok', true,
    'from_sailing_id', v_old,
    'to_sailing_id', p_sailing_id
  );
end $function$;

revoke all on function public.sailing_mismatch_assign(uuid, uuid) from public, anon;
grant execute on function public.sailing_mismatch_assign(uuid, uuid) to authenticated;
comment on function public.sailing_mismatch_assign(uuid, uuid) is
  '#557 RPC: HHL przypina zaproponowany rejs; zamyka rk_sailing_mismatch.';

-- ---------------------------------------------------------------------------
-- 5. process_position — stary punkt + backup AIS + mismatch
-- ---------------------------------------------------------------------------
create or replace function public.process_position(
  p_load_id  uuid,
  p_lat      double precision,
  p_lon      double precision,
  p_ts       timestamptz,
  p_source   position_source default 'TELEMATICS_API',
  p_speed    numeric default null,
  p_heading  numeric default null,
  p_ignition boolean default null,
  p_raw      jsonb default '{}'::jsonb
) returns table (event_type text, geofence_id uuid, geofence_name text)
language plpgsql security definer set search_path = public as $$
-- POPRAWKA 24.09.2026: kolumny wyniku (event_type, geofence_id) mają te same
-- nazwy co kolumny tabel geofence_states i load_events. Bez tej dyrektywy
-- każde wywołanie ze strefą w zasięgu kończyło się błędem „column reference
-- is ambiguous", a cała transakcja — razem z pozycją — była wycofywana.
-- Funkcja w tej postaci nigdy nie przetworzyła punktu w strefie.
#variable_conflict use_column
declare
  v_pt        geometry(Point, 4326);
  v_project   uuid;
  v_fence     record;
  v_state     record;
  v_inside    boolean;
  v_outside_h boolean;
  v_new_state geofence_state_kind;
  v_emit      text;
  v_dedup     text;
  v_payload   jsonb;
  v_dwell_min numeric;
  v_status    load_status;
  v_sail_st   text;
  v_act_dep   timestamptz;
  v_stale     boolean := false;
  v_raw       jsonb;
  v_on_se     boolean;
begin
  if p_lat is null or p_lon is null then return; end if;
  if abs(p_lat) < 0.001 and abs(p_lon) < 0.001 then return; end if;
  if p_speed is not null and p_speed > 130 then return; end if;

  if public.load_in_tracking_window(p_load_id, coalesce(p_ts, now())) is not true then
    return;
  end if;
  perform set_config('tower.track_ctx', 'on', true);
  update loads
     set tracking_opened_at = public.tracking_window_start(plan_load_date)
   where id = p_load_id
     and tracking_opened_at is null
     and plan_load_date is not null;
  perform set_config('tower.track_ctx', 'off', true);

  if exists (select 1 from positions
              where load_id = p_load_id and ts <= p_ts and ts > p_ts - interval '60 seconds') then
    return;
  end if;

  v_pt := st_setsrid(st_makepoint(p_lon, p_lat), 4326);
  select project_id, status into v_project, v_status from loads where id = p_load_id;
  if v_project is null then
    raise exception 'Nieznany load_id: %', p_load_id;
  end if;

  select s.status::text, s.actual_departure_at
    into v_sail_st, v_act_dep
    from loads l
    left join sailings s on s.id = l.sailing_id
   where l.id = p_load_id;

  v_on_se := st_covers(public.sweden_land_geom(), v_pt);

  /* #557: stary punkt emtrack — te same współrzędne PL przy FERRY / po wypłynięciu. */
  if v_on_se is not true
     and (
       v_status = 'FERRY'
       or v_sail_st = 'DOPLYNAL'
       or v_act_dep is not null
     )
     and exists (
       select 1 from positions prev
        where prev.load_id = p_load_id
          and prev.ts < coalesce(p_ts, now())
          and coalesce((prev.raw->>'stale_point')::boolean, false) is not true
          and st_dwithin(prev.geom_raw::geography, v_pt::geography, 5)
     ) then
    v_stale := true;
  end if;

  v_raw := coalesce(p_raw, '{}'::jsonb);
  if v_stale then
    v_raw := v_raw || jsonb_build_object('stale_point', true, 'stale_reason', 'identical_pl_after_ferry');
  end if;

  insert into positions (load_id, ts, geom_raw, speed_kmh, heading_deg, ignition, source, raw)
  values (p_load_id, p_ts, v_pt, p_speed, p_heading, p_ignition, p_source, v_raw)
  on conflict (load_id, ts, source) do nothing;

  if v_stale then
    return;
  end if;

  for v_fence in
    select g.* from geofences g
    where g.project_id = v_project and g.active
      and st_dwithin(g.geom::geography, v_pt::geography, g.hysteresis_m + 50)
    union
    select g.* from geofences g
    join geofence_states s on s.geofence_id = g.id and s.load_id = p_load_id
    where g.project_id = v_project and g.active and s.state <> 'OUTSIDE'
  loop
    v_inside    := st_contains(v_fence.geom, v_pt);
    v_outside_h := not st_dwithin(v_fence.geom::geography, v_pt::geography, v_fence.hysteresis_m);

    insert into geofence_states (load_id, geofence_id, state, consec_fixes, last_eval_at)
    values (p_load_id, v_fence.id, 'OUTSIDE', 0, p_ts)
    on conflict (load_id, geofence_id) do nothing;

    select * into v_state from geofence_states
      where load_id = p_load_id and geofence_id = v_fence.id for update;

    v_new_state := v_state.state;
    v_emit := null;

    if v_state.state = 'OUTSIDE' then
      if v_inside then
        if v_state.consec_fixes + 1 >= v_fence.debounce_fixes then
          v_new_state := 'INSIDE';
          v_emit := 'GEOFENCE_ENTER';
        else
          v_new_state := 'PENDING_IN';
        end if;
      end if;

    elsif v_state.state = 'PENDING_IN' then
      if v_inside then
        if v_state.consec_fixes + 1 >= v_fence.debounce_fixes then
          v_new_state := 'INSIDE';
          v_emit := 'GEOFENCE_ENTER';
        end if;
      else
        v_new_state := 'OUTSIDE';
      end if;

    elsif v_state.state = 'INSIDE' then
      if v_outside_h then
        v_new_state := 'PENDING_OUT';
      elsif v_fence.dwell_seconds > 0
            and v_state.entered_at is not null
            and p_ts - v_state.entered_at >= make_interval(secs => v_fence.dwell_seconds)
            and not exists (
              select 1 from load_events e
              where e.load_id = p_load_id
                and e.event_type = 'GEOFENCE_DWELL'
                and (e.payload->>'geofence_id')::uuid = v_fence.id
                and e.occurred_at >= v_state.entered_at
            ) then
        v_emit := 'GEOFENCE_DWELL';
      end if;

    elsif v_state.state = 'PENDING_OUT' then
      if v_inside then
        v_new_state := 'INSIDE';
      elsif v_outside_h then
        v_new_state := 'OUTSIDE';
        v_emit := 'GEOFENCE_EXIT';
      end if;
    end if;

    update geofence_states set
      state        = v_new_state,
      consec_fixes = case
                       when v_new_state in ('PENDING_IN') then v_state.consec_fixes + 1
                       when v_new_state = 'INSIDE' and v_state.state <> 'INSIDE' then 0
                       when v_new_state = 'OUTSIDE' then 0
                       else v_state.consec_fixes
                     end,
      entered_at   = case when v_emit = 'GEOFENCE_ENTER' then p_ts else v_state.entered_at end,
      exited_at    = case when v_emit = 'GEOFENCE_EXIT'  then p_ts else v_state.exited_at end,
      last_eval_at = p_ts
    where load_id = p_load_id and geofence_id = v_fence.id;

    if v_emit is not null then
      v_dedup := v_emit || ':' || p_load_id || ':' || v_fence.id || ':'
                 || to_char(p_ts at time zone 'UTC', 'YYYYMMDDHH24MI');
      v_payload := jsonb_build_object(
        'geofence_id',   v_fence.id,
        'geofence_name', v_fence.name,
        'geofence_kind', v_fence.kind,
        'notify_orgs',   to_jsonb(v_fence.notify_orgs),
        'message_tpl',   v_fence.message_tpl
      );
      if v_emit in ('GEOFENCE_EXIT', 'GEOFENCE_DWELL') and v_state.entered_at is not null then
        v_dwell_min := round(extract(epoch from (p_ts - v_state.entered_at)) / 60.0);
        v_payload := v_payload || jsonb_build_object(
          'dwell_min', v_dwell_min,
          'entered_at', v_state.entered_at,
          'minutes', v_dwell_min
        );
      end if;

      insert into load_events (load_id, event_type, occurred_at, source, geom, payload, dedup_key)
      values (
        p_load_id, v_emit, p_ts, p_source, v_pt,
        v_payload,
        v_dedup
      )
      -- POPRAWKA 24.09.2026: indeks unikalny na dedup_key jest częściowy
      -- (where dedup_key is not null) — bez tego warunku Postgres odrzucał
      -- zapis i żadne zdarzenie wjazdu ani wyjazdu nie mogło powstać.
      on conflict (dedup_key) where dedup_key is not null do nothing;

      event_type    := v_emit;
      geofence_id   := v_fence.id;
      geofence_name := v_fence.name;
      return next;
    end if;
  end loop;

  /* #485: Port SE / Droga SE z pozycji (gdy strefa aktywna). */
  perform public.apply_ferry_se_from_position(p_load_id, p_lat, p_lon, coalesce(p_ts, now()));
  /* #557: awaryjne AIS — także gdy PORT_IN nieaktywny. */
  perform public.apply_ferry_ais_arrival_backup(p_load_id, p_lat, p_lon, coalesce(p_ts, now()));

  if v_on_se then
    perform public.detect_sailing_mismatch(p_load_id, coalesce(p_ts, now()));
  end if;

  return;
end $$;

revoke all on function public.process_position(uuid, double precision, double precision, timestamptz, position_source, numeric, numeric, boolean, jsonb)
  from public, anon, authenticated;
grant execute on function public.process_position(uuid, double precision, double precision, timestamptz, position_source, numeric, numeric, boolean, jsonb)
  to service_role;
comment on function public.process_position(uuid, double precision, double precision, timestamptz, position_source, numeric, numeric, boolean, jsonb) is
  '#485+#557: strefy; Port SE; AIS backup bez g.active; stale_point PL; sailing mismatch.';
