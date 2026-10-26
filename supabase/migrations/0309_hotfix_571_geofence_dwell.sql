-- #571: SITE — wjazd od 1. pozycji w promieniu (F7 #574, decyzja 26.10 11:48).
-- Pozostale strefy: dwell (cron + process_position) albo debounce_fixes.
-- SG-23: przestaw czas ENTER/AT_SITE na 10:22 UTC (pierwsza pozycja); bez ponownych powiadomien.


-- ---------------------------------------------------------------------------
-- 1. geofence_confirm_pending_dwell — cykl 1–5 min (service_role)
-- ---------------------------------------------------------------------------
create or replace function public.geofence_confirm_pending_dwell(
  p_now timestamptz default now()
) returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row        record;
  v_pos        record;
  v_pending_at timestamptz;
  v_emit_at    timestamptz;
  v_dedup      text;
  v_payload    jsonb;
  v_n          int := 0;
begin
  for v_row in
    select gs.load_id, gs.geofence_id, gs.entered_at, gs.last_eval_at, gs.consec_fixes,
           g.name as geofence_name, g.kind as geofence_kind, g.geom, g.dwell_seconds,
           g.notify_orgs, g.message_tpl, g.hysteresis_m
      from geofence_states gs
      join geofences g on g.id = gs.geofence_id
     where gs.state = 'PENDING_IN'
       and g.active is true
       and g.kind is distinct from 'SITE'
       and g.dwell_seconds > 0
  loop
    v_pending_at := coalesce(v_row.entered_at, v_row.last_eval_at);
    if v_pending_at is null then
      continue;
    end if;
    if p_now - v_pending_at < make_interval(secs => v_row.dwell_seconds) then
      continue;
    end if;

    select p.ts, p.geom_raw, p.source, p.raw
      into v_pos
      from positions p
     where p.load_id = v_row.load_id
       and coalesce((p.raw->>'stale_point')::boolean, false) is not true
     order by p.ts desc
     limit 1;

    if v_pos.ts is null then
      continue;
    end if;

    /* Ostatnia niesprzeczna pozycja musi nadal byc w strefie. */
    if st_contains(v_row.geom, v_pos.geom_raw::geometry) is not true then
      continue;
    end if;

    v_emit_at := v_pending_at;
    v_dedup := 'GEOFENCE_ENTER:' || v_row.load_id || ':' || v_row.geofence_id || ':'
               || to_char(v_emit_at at time zone 'UTC', 'YYYYMMDDHH24MI');
    v_payload := jsonb_build_object(
      'geofence_id',   v_row.geofence_id,
      'geofence_name', v_row.geofence_name,
      'geofence_kind', v_row.geofence_kind,
      'notify_orgs',   to_jsonb(v_row.notify_orgs),
      'message_tpl',   v_row.message_tpl,
      'confirm',       'dwell',
      'dwell_seconds', v_row.dwell_seconds
    );

    update geofence_states set
      state        = 'INSIDE',
      consec_fixes = 0,
      entered_at   = coalesce(entered_at, v_emit_at),
      last_eval_at = p_now
    where load_id = v_row.load_id
      and geofence_id = v_row.geofence_id
      and state = 'PENDING_IN';

    if not found then
      continue;
    end if;

    insert into load_events (load_id, event_type, occurred_at, source, geom, payload, dedup_key)
    values (
      v_row.load_id, 'GEOFENCE_ENTER', v_emit_at, coalesce(v_pos.source, 'TELEMATICS_API'),
      v_pos.geom_raw, v_payload, v_dedup
    )
    on conflict (dedup_key) where dedup_key is not null do nothing;

    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;

revoke all on function public.geofence_confirm_pending_dwell(timestamptz) from public, anon, authenticated;
grant execute on function public.geofence_confirm_pending_dwell(timestamptz) to service_role;
comment on function public.geofence_confirm_pending_dwell(timestamptz) is
  '#571: PENDING_IN (bez SITE) + pozycja w strefie + dwell_seconds → GEOFENCE_ENTER (czas pierwszej); service_role.';

do $cron$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron')
     and to_regprocedure('cron.schedule(text,text,text)') is not null then
    perform cron.unschedule(jobid)
      from cron.job where jobname = 'tower-geofence-dwell';
    perform cron.schedule(
      'tower-geofence-dwell',
      '*/2 * * * *',
      $job$select public.geofence_confirm_pending_dwell()$job$
    );
  end if;
exception when others then
  null;
end $cron$;

-- ---------------------------------------------------------------------------
-- 2. process_position — entered_at przy PENDING_IN + dwell przy nowej pozycji
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
  v_dep_eff   timestamptz;
  v_stale     boolean := false;
  v_emit_at   timestamptz;
  v_raw       jsonb;
  v_on_se     boolean;
  v_prev_geom geometry;
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

  select coalesce(s.actual_departure_at, s.delayed_departure_at, s.departure_at)
    into v_dep_eff
    from loads l
    left join sailings s on s.id = l.sailing_id
   where l.id = p_load_id;

  v_on_se := st_covers(public.sweden_land_geom(), v_pt);

  /* #557 F7 pkt 9: stary punkt — ≥ FERRY albo AT_PORT_GDANSK po odejściu;
     jeden ostatni nie-stary z ts <= odejście. */
  if v_on_se is not true
     and (
       public.load_status_rank(v_status) >= public.load_status_rank('FERRY'::public.load_status)
       or (v_status = 'AT_PORT_GDANSK'
           and v_dep_eff is not null
           and v_dep_eff <= coalesce(p_ts, now()))
     )
  then
    select prev.geom_raw::geometry into v_prev_geom
      from positions prev
     where prev.load_id = p_load_id
       and coalesce((prev.raw->>'stale_point')::boolean, false) is not true
       and (v_dep_eff is null or prev.ts <= v_dep_eff)
     order by prev.ts desc
     limit 1;
    if v_prev_geom is not null
       and st_dwithin(v_prev_geom::geography, v_pt::geography, 5) then
      v_stale := true;
    end if;
  end if;

  v_raw := coalesce(p_raw, '{}'::jsonb);
  if coalesce((v_raw->>'stale_point')::boolean, false) is true then
    v_stale := true;
  end if;
  if v_stale then
    v_raw := v_raw || jsonb_build_object(
      'stale_point', true,
      'stale_reason', coalesce(nullif(v_raw->>'stale_reason', ''), 'identical_pl_after_ferry')
    );
  end if;

  insert into positions (load_id, ts, geom_raw, speed_kmh, heading_deg, ignition, source, raw)
  values (p_load_id, p_ts, v_pt, p_speed, p_heading, p_ignition, p_source, v_raw)
  on conflict (load_id, ts, source) do nothing;

  if v_stale then
    return;
  end if;

  -- #557: mismatch PRZED ENTER (debounce=1 PORT_IN SE w prod / 0274) —
  -- inaczej status skacze do Port SE i wykrycie na końcu nic nie robi.
  if v_on_se then
    begin
      perform public.detect_sailing_mismatch(p_load_id, coalesce(p_ts, now()));
    exception when others then
      raise warning '#557 detect_sailing_mismatch: %', sqlerrm;
    end;
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
    v_emit_at := null;

    if v_state.state = 'OUTSIDE' then
      if v_inside then
        /* #571 F7: SITE — 1. swieza pozycja w promieniu (nie histereza); bez PENDING_IN. */
        if v_fence.kind = 'SITE'
           or v_state.consec_fixes + 1 >= v_fence.debounce_fixes then
          v_new_state := 'INSIDE';
          v_emit := 'GEOFENCE_ENTER';
          v_emit_at := p_ts;
        else
          v_new_state := 'PENDING_IN';
        end if;
      end if;

    elsif v_state.state = 'PENDING_IN' then
      /* #571: SITE (legacy PENDING_IN) od razu; inaczej debounce albo dwell. */
      if v_inside then
        if v_fence.kind = 'SITE' then
          v_new_state := 'INSIDE';
          v_emit := 'GEOFENCE_ENTER';
          v_emit_at := coalesce(v_state.entered_at, p_ts);
        elsif v_state.consec_fixes + 1 >= v_fence.debounce_fixes then
          v_new_state := 'INSIDE';
          v_emit := 'GEOFENCE_ENTER';
          v_emit_at := p_ts;
        elsif v_fence.dwell_seconds > 0
              and v_state.entered_at is not null
              and p_ts - v_state.entered_at >= make_interval(secs => v_fence.dwell_seconds) then
          v_new_state := 'INSIDE';
          v_emit := 'GEOFENCE_ENTER';
          v_emit_at := v_state.entered_at;
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
      entered_at   = case
                       when v_new_state = 'PENDING_IN' and v_state.state = 'OUTSIDE' then p_ts
                       when v_emit = 'GEOFENCE_ENTER' then coalesce(v_state.entered_at, p_ts)
                       when v_new_state = 'OUTSIDE' and v_state.state = 'PENDING_IN' then null
                       else v_state.entered_at
                     end,
      exited_at    = case when v_emit = 'GEOFENCE_EXIT'  then p_ts else v_state.exited_at end,
      last_eval_at = p_ts
    where load_id = p_load_id and geofence_id = v_fence.id;

    if v_emit is not null then
      v_emit_at := coalesce(v_emit_at, p_ts);
      v_dedup := v_emit || ':' || p_load_id || ':' || v_fence.id || ':'
                 || to_char(v_emit_at at time zone 'UTC', 'YYYYMMDDHH24MI');
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
        p_load_id, v_emit, v_emit_at, p_source, v_pt,
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
  begin
    perform public.apply_ferry_se_from_position(p_load_id, p_lat, p_lon, coalesce(p_ts, now()));
  exception when others then
    raise warning '#557 apply_ferry_se_from_position: %', sqlerrm;
  end;
  /* #557: awaryjne AIS — gdy PORT_IN nieaktywny. */
  begin
    perform public.apply_ferry_ais_arrival_backup(p_load_id, p_lat, p_lon, coalesce(p_ts, now()));
  exception when others then
    raise warning '#557 apply_ferry_ais_arrival_backup: %', sqlerrm;
  end;

  return;
end $$;

revoke all on function public.process_position(uuid, double precision, double precision, timestamptz, position_source, numeric, numeric, boolean, jsonb)
  from public, anon, authenticated;
grant execute on function public.process_position(uuid, double precision, double precision, timestamptz, position_source, numeric, numeric, boolean, jsonb)
  to service_role;
comment on function public.process_position(uuid, double precision, double precision, timestamptz, position_source, numeric, numeric, boolean, jsonb) is
  '#485+#557+#571: SITE od 1. pozycji; dwell PENDING_IN (bez SITE); Port SE; AIS; stale_point.';


-- ---------------------------------------------------------------------------
-- 3. Korekta produkcji: SG-23 czas 10:22 UTC + inne PENDING_IN SITE
-- ---------------------------------------------------------------------------
do $sg23$
declare
  v_load   uuid;
  v_enter  timestamptz := timestamptz '2026-10-26 10:22:00+00';
  v_fresh  boolean;
  v_pt     geometry;
  v_row    record;
  v_first  timestamptz;
  v_prev   text;
begin
  /* SG-23: juz AT_SITE / ENTER z 2. pozycji (~11:21) → przestaw na 10:22, bez powiadomien. */
  select l.id into v_load
    from loads l
   where l.order_no = 'SG-23'
   order by l.created_at desc nulls last
   limit 1;

  if v_load is not null then
    v_prev := current_setting('tower.bulk_quiet', true);
    perform set_config('tower.bulk_quiet', 'on', true);

    update load_events e set
      occurred_at = v_enter,
      payload = coalesce(e.payload, '{}'::jsonb)
                || jsonb_build_object('confirm', 'hotfix_571_backdate', 'first_fix_at', v_enter::text)
    where e.load_id = v_load
      and e.event_type = 'GEOFENCE_ENTER'
      and coalesce(e.payload->>'geofence_kind', '') = 'SITE'
      and e.occurred_at is distinct from v_enter;

    update load_events e set
      occurred_at = v_enter,
      payload = coalesce(e.payload, '{}'::jsonb)
                || jsonb_build_object('confirm', 'hotfix_571_backdate')
    where e.load_id = v_load
      and e.event_type = 'STATUS_AUTO'
      and e.payload->>'to' = 'AT_SITE'
      and e.occurred_at is distinct from v_enter
      and not exists (
        select 1 from load_events z
         where z.load_id = e.load_id
           and z.event_type like 'STATUS_%'
           and z.payload->>'zastepuje' = e.id::text
      );

    update geofence_states gs set
      entered_at = v_enter,
      state = case when gs.state in ('PENDING_IN', 'OUTSIDE') then 'INSIDE' else gs.state end,
      consec_fixes = 0,
      last_eval_at = greatest(gs.last_eval_at, v_enter)
    from geofences g
    where gs.load_id = v_load
      and g.id = gs.geofence_id
      and g.kind = 'SITE'
      and (gs.entered_at is distinct from v_enter or gs.state = 'PENDING_IN');

    update load_events e set
      payload = coalesce(e.payload, '{}'::jsonb)
                || jsonb_build_object('entered_at', v_enter)
    where e.load_id = v_load
      and e.event_type = 'GEOFENCE_DWELL'
      and coalesce(e.payload->>'geofence_kind', '') = 'SITE';

    perform set_config('tower.bulk_quiet', coalesce(v_prev, ''), true);
  end if;

  /* Inne transporty: PENDING_IN na SITE → ENTER z czasem pierwszej pozycji. */
  for v_row in
    select gs.load_id, gs.geofence_id, gs.entered_at, gs.last_eval_at,
           g.name as geofence_name, l.status::text as status
      from geofence_states gs
      join geofences g on g.id = gs.geofence_id
      join loads l on l.id = gs.load_id
     where gs.state = 'PENDING_IN'
       and g.kind = 'SITE'
       and g.active is true
       and l.status::text not in ('UNLOADED', 'DELIVERED', 'READY_TO_INVOICE', 'INVOICED', 'CANCELLED')
  loop
    v_first := coalesce(v_row.entered_at, v_row.last_eval_at);
    if v_first is null then
      select p.ts into v_first
        from positions p
       where p.load_id = v_row.load_id
         and coalesce((p.raw->>'stale_point')::boolean, false) is not true
         and st_contains(
               (select geom from geofences where id = v_row.geofence_id),
               p.geom_raw::geometry
             )
       order by p.ts
       limit 1;
    end if;
    if v_first is null then
      continue;
    end if;

    select p.geom_raw into v_pt
      from positions p
     where p.load_id = v_row.load_id
       and coalesce((p.raw->>'stale_point')::boolean, false) is not true
     order by p.ts desc
     limit 1;

    v_fresh := (now() - v_first) < interval '2 hours';
    v_prev := current_setting('tower.bulk_quiet', true);
    if v_fresh is not true then
      perform set_config('tower.bulk_quiet', 'on', true);
    end if;

    update geofence_states set
      state = 'INSIDE',
      consec_fixes = 0,
      entered_at = coalesce(entered_at, v_first),
      last_eval_at = now()
    where load_id = v_row.load_id
      and geofence_id = v_row.geofence_id
      and state = 'PENDING_IN';

    if found then
      insert into load_events (load_id, event_type, occurred_at, source, geom, payload, dedup_key)
      values (
        v_row.load_id, 'GEOFENCE_ENTER', v_first, 'TELEMATICS_API', v_pt,
        jsonb_build_object(
          'geofence_id', v_row.geofence_id,
          'geofence_kind', 'SITE',
          'geofence_name', v_row.geofence_name,
          'confirm', 'hotfix_571_site_pending',
          'notify', v_fresh
        ),
        'GEOFENCE_ENTER:' || v_row.load_id::text || ':' || v_row.geofence_id::text || ':'
          || to_char(v_first at time zone 'UTC', 'YYYYMMDDHH24MI')
      )
      on conflict (dedup_key) where dedup_key is not null do nothing;
    end if;

    perform set_config('tower.bulk_quiet', coalesce(v_prev, ''), true);
  end loop;
exception when others then
  raise warning '#571 SITE hotfix: %', sqlerrm;
end;
$sg23$;
