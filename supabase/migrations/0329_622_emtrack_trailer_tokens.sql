-- =====================================================================
-- #622 PILNE: dopasowanie naczepy emtrack po tokenach + odzyskanie sierot
-- + alarm HHL gdy pozycje w sierotach, a transport bez GPS > 2 h.
-- process_position: bypass budżetu 60 s przy tower.pos_budget_bypass=on (reclaim).
-- Bez numerów rejestracyjnych produkcyjnych w testach.
-- =====================================================================

alter type risk_kind add value if not exists 'EMTRACK_ORPHAN';

-- Tokeny tablicy (jak matchTrailer.plateTokens): separatory między nr: - / ,
-- Kolejność jak w wejściu; DISTINCT bez ORDER BY mieszał AA/BB w CI.
create or replace function public.telm_plate_tokens(p text)
returns text[]
language sql immutable parallel safe set search_path = public as $$
  select coalesce(
    array(
      select x.tok
        from (
          select upper(regexp_replace(t.tok, '[^A-Z0-9]', '', 'g')) as tok,
                 min(t.ord) as ord
            from unnest(regexp_split_to_array(coalesce(p, ''), E'\\s*[-/,]\\s*'))
                 with ordinality as t(tok, ord)
           where upper(regexp_replace(t.tok, '[^A-Z0-9]', '', 'g')) <> ''
           group by 1
        ) x
       order by x.ord
    ),
    '{}'::text[]
  );
$$;

comment on function public.telm_plate_tokens(text) is
  '#622: tokeny nr rej. (separatory -/,/; spacje w nr → normalize); bez fragmentów.';

revoke all on function public.telm_plate_tokens(text) from public, anon, authenticated;
grant execute on function public.telm_plate_tokens(text) to service_role;

create or replace function public.telm_trailer_tokens_match(p_trailer text, p_text_id text)
returns boolean
language plpgsql immutable parallel safe set search_path = public as $$
declare
  v_wt text[] := public.telm_plate_tokens(p_trailer);
  v_em text[] := public.telm_plate_tokens(p_text_id);
begin
  if cardinality(v_wt) is null or cardinality(v_wt) = 0
     or cardinality(v_em) is null or cardinality(v_em) = 0 then
    return false;
  end if;
  if v_em @> array[v_wt[1]] then
    return true;
  end if;
  if cardinality(v_em) = 1 and v_wt @> array[v_em[1]] then
    return true;
  end if;
  return false;
end;
$$;

comment on function public.telm_trailer_tokens_match(text, text) is
  '#622: primary WT ∈ tokenów textId albo textId (1 token) = token WT.';

revoke all on function public.telm_trailer_tokens_match(text, text) from public, anon, authenticated;
grant execute on function public.telm_trailer_tokens_match(text, text) to service_role;

-- Orphan.plate jest znormalizowany (bez separatorów). Dodatkowo raw->>'textId'.
create or replace function public.telm_orphan_matches_trailer(p_orphan_plate text, p_raw jsonb, p_trailer text)
returns boolean
language plpgsql stable set search_path = public as $$
declare
  v_wt text[] := public.telm_plate_tokens(p_trailer);
  v_plate text := upper(regexp_replace(coalesce(p_orphan_plate, ''), '[^A-Z0-9]', '', 'g'));
  v_raw_id text := coalesce(p_raw->>'textId', p_raw->>'text_id', '');
begin
  if cardinality(v_wt) is null or cardinality(v_wt) = 0 then
    return false;
  end if;
  if v_plate <> '' and v_plate = any (v_wt) then
    return true;
  end if;
  if v_raw_id <> '' and public.telm_trailer_tokens_match(p_trailer, v_raw_id) then
    return true;
  end if;
  return false;
end;
$$;

revoke all on function public.telm_orphan_matches_trailer(text, jsonb, text) from public, anon, authenticated;
grant execute on function public.telm_orphan_matches_trailer(text, jsonb, text) to service_role;

create or replace function public.telm_reclaim_orphan_positions(
  p_load_id uuid,
  p_since timestamptz default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_trailer text;
  v_link text;
  v_opened timestamptz;
  v_delivered timestamptz;
  v_win_end timestamptz;
  v_since timestamptz;
  r record;
  v_n int := 0;
  v_skip int := 0;
  v_last_ts timestamptz;
  v_last_lat float8;
  v_last_lon float8;
begin
  if p_load_id is null then
    return jsonb_build_object('ok', false, 'error', 'load_id');
  end if;

  select l.trailer_plate, l.telematics_vehicle_id, l.tracking_opened_at,
         l.actual_delivery_at
    into v_trailer, v_link, v_opened, v_delivered
    from loads l where l.id = p_load_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if v_link is null or btrim(v_link) = '' or v_link !~* 'emtrack\.eu' then
    return jsonb_build_object('ok', false, 'error', 'no_emtrack_link');
  end if;
  if v_trailer is null or btrim(v_trailer) = '' then
    return jsonb_build_object('ok', false, 'error', 'no_trailer');
  end if;

  v_win_end := coalesce(v_delivered, now() + interval '1 day');
  v_since := coalesce(
    p_since,
    v_opened,
    (select public.tracking_window_start(plan_load_date) from loads where id = p_load_id)
  );

  perform set_config('tower.pos_budget_bypass', 'on', true);

  for r in
    select o.id, o.plate, o.lat, o.lon, o.ts, o.source, o.speed_kmh, o.heading_deg, o.ignition, o.raw
      from telematics_orphan_positions o
     where o.ts >= coalesce(v_since, '-infinity'::timestamptz)
       and o.ts <= v_win_end
       and public.telm_orphan_matches_trailer(o.plate, o.raw, v_trailer)
     order by o.ts asc
  loop
    if public.load_in_tracking_window(p_load_id, r.ts) is not true then
      v_skip := v_skip + 1;
      continue;
    end if;
    perform public.process_position(
      p_load_id, r.lat, r.lon, r.ts, r.source,
      r.speed_kmh, r.heading_deg, r.ignition, coalesce(r.raw, '{}'::jsonb)
    );
    if exists (
      select 1 from positions p
       where p.load_id = p_load_id and p.ts = r.ts and p.source = r.source
    ) then
      delete from telematics_orphan_positions where id = r.id;
      v_n := v_n + 1;
      v_last_ts := r.ts;
      v_last_lat := r.lat;
      v_last_lon := r.lon;
    else
      v_skip := v_skip + 1;
    end if;
  end loop;

  perform set_config('tower.pos_budget_bypass', 'off', true);

  if v_last_lat is not null then
    begin
      perform public.telm_infer_phase_from_position(p_load_id, v_last_lat, v_last_lon, v_last_ts);
    exception when others then
      raise warning '#622 infer_phase: %', sqlerrm;
    end;
    begin
      perform public.refresh_load_eta(p_load_id);
    exception when others then
      raise warning '#622 refresh_load_eta: %', sqlerrm;
    end;
  end if;

  insert into audit_log (user_id, action, entity, entity_id, new_value)
  values (
    null, 'TELM_ORPHAN_RECLAIM', 'loads', p_load_id::text,
    jsonb_build_object('reclaimed', v_n, 'skipped', v_skip, 'since', v_since, 'last_ts', v_last_ts)
  );

  return jsonb_build_object(
    'ok', true,
    'reclaimed', v_n,
    'skipped', v_skip,
    'last_ts', v_last_ts,
    'status', (select status::text from loads where id = p_load_id)
  );
end;
$$;

comment on function public.telm_reclaim_orphan_positions(uuid, timestamptz) is
  '#622: sieroty → positions (tokeny naczepy), idempotentnie; geofence/ETA po kolei.';

revoke all on function public.telm_reclaim_orphan_positions(uuid, timestamptz)
  from public, anon, authenticated;
grant execute on function public.telm_reclaim_orphan_positions(uuid, timestamptz) to service_role;

-- Alarm HHL: w oknie, link emtrack, brak pozycji > 2 h, a w sierotach jest token naczepy.
create or replace function public.telm_scan_orphan_trailer_alerts(p_now timestamptz default now())
returns integer
language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_code text;
  v_n int := 0;
  v_last timestamptz;
begin
  for r in
    select l.id, l.trailer_plate, l.telematics_vehicle_id, l.tracking_opened_at, l.plan_load_date,
           coalesce(
             (select si.shipment_code from shipment_items si where si.load_id = l.id order by si.assembly_seq nulls last limit 1),
             l.order_no,
             left(l.id::text, 8)
           ) as code
      from loads l
     where l.telematics_vehicle_id ~* 'emtrack\.eu'
       and coalesce(l.trailer_plate, '') <> ''
       and public.load_in_tracking_window(l.id, p_now)
  loop
    select max(p.ts) into v_last from positions p where p.load_id = r.id;
    if v_last is not null and v_last > p_now - interval '2 hours' then
      continue;
    end if;
    if not exists (
      select 1 from telematics_orphan_positions o
       where o.ts > p_now - interval '24 hours'
         and public.telm_orphan_matches_trailer(o.plate, o.raw, r.trailer_plate)
    ) then
      continue;
    end if;
    v_code := coalesce(nullif(btrim(r.code), ''), 'transport');
    perform public.raise_risk(
      r.id,
      'EMTRACK_ORPHAN'::risk_kind,
      'MEDIUM'::risk_severity,
      format('Pozycje naczepy nie trafiają do transportu %s — sprawdź nr naczepy', v_code),
      jsonb_build_object(
        'title_key', 'rk_emtrack_orphan',
        'reason', 'EMTRACK_ORPHAN_MISMATCH',
        'last_pos', v_last,
        'code', v_code,
        'params', jsonb_build_object('code', v_code)
      ),
      'EMTRACK_ORPHAN:' || r.id::text
    );
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;

comment on function public.telm_scan_orphan_trailer_alerts(timestamptz) is
  '#622: 1 ryzyko HHL (EMTRACK_ORPHAN) gdy GPS>2h brak, a sieroty mają token naczepy.';

revoke all on function public.telm_scan_orphan_trailer_alerts(timestamptz)
  from public, anon, authenticated;
grant execute on function public.telm_scan_orphan_trailer_alerts(timestamptz) to service_role;

-- process_position z #571 + bypass budżetu 60 s (#622 reclaim):

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

  if current_setting('tower.pos_budget_bypass', true) is distinct from 'on'
     and exists (select 1 from positions
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
                       /* OUTSIDE→PENDING_IN / OUTSIDE→INSIDE: czas tej wizyty. */
                       when v_new_state = 'PENDING_IN' and v_state.state = 'OUTSIDE' then p_ts
                       when v_emit = 'GEOFENCE_ENTER' and v_state.state = 'OUTSIDE' then p_ts
                       /* PENDING_IN→INSIDE: czas pierwszej pozycji (entered_at). */
                       when v_emit = 'GEOFENCE_ENTER' then coalesce(v_state.entered_at, p_ts)
                       /* Wyjazd / powrót do OUTSIDE — zeruj (F7 #574: dwell_min, GEOFENCE_DWELL). */
                       when v_emit = 'GEOFENCE_EXIT' then null
                       when v_new_state = 'OUTSIDE' then null
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
  'Zapis pozycji + geofence. #622: tower.pos_budget_bypass=on pomija limit 60 s (reclaim sierot).';
