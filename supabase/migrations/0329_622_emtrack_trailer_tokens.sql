-- =====================================================================
-- #622 PILNE: dopasowanie naczepy emtrack po tokenach + odzyskanie sierot
-- + alarm HHL gdy pozycje w sierotach, a transport bez GPS > 2 h.
-- F7 r1: B1 spacje w textId, B2 myślnik tylko ze spacją + token ≥5 z cyfrą,
-- P1 ranking, P3 reclaim INSERT-only dla starych ts, P4 zamykanie alarmu.
-- F7 r2: B1-bis WT bez sklejeń / EM prefiksy od 1. fragmentu; P3-bis refresh
-- bez geofence + p_until; P4-bis zamknięcie tylko przy reclaim>0 lub GPS<2h;
-- P4-perf plate=any przed raw; TS↔SQL [^A-Z0-9].
-- process_position: bypass budżetu 60 s przy tower.pos_budget_bypass=on (reclaim).
-- Bez numerów rejestracyjnych produkcyjnych w testach.
-- =====================================================================

alter type risk_kind add value if not exists 'EMTRACK_ORPHAN';

-- Transakcja po ADD VALUE (enum nieużywalny w tej samej transakcji co ALTER TYPE).
begin;

-- Normalizacja jak normalizePlate (TS): upper + bez spacji/myślników.
create or replace function public.telm_norm_plate(p text)
returns text
language sql immutable parallel safe set search_path = public as $$
  select upper(regexp_replace(coalesce(p, ''), '[\s\-]+', '', 'g'));
$$;

revoke all on function public.telm_norm_plate(text) from public, anon, authenticated;
grant execute on function public.telm_norm_plate(text) to service_role;

-- Token ważny: ≥5 znaków A-Z0-9 i ≥1 cyfra (F7 B2).
create or replace function public.telm_token_valid(p text)
returns boolean
language sql immutable parallel safe set search_path = public as $$
  select coalesce(p, '') ~ '^[A-Z0-9]{5,}$' and coalesce(p, '') ~ '[0-9]';
$$;

revoke all on function public.telm_token_valid(text) from public, anon, authenticated;
grant execute on function public.telm_token_valid(text) to service_role;

-- Tokeny WT = matchTrailer.plateTokens (F7 r2 B1-bis): tylko pełny człon.
-- Separatory: myślnik/en-dash ze spacją z ≥1 strony; / , ; +
create or replace function public.telm_plate_tokens(p text)
returns text[]
language plpgsql immutable parallel safe set search_path = public as $$
declare
  v_raw text := btrim(coalesce(p, ''));
  v_parts text[];
  v_part text;
  v_out text[] := '{}';
  v_seen text[] := '{}';
  v_cand text;
begin
  if v_raw = '' then
    return '{}';
  end if;
  v_parts := regexp_split_to_array(
    v_raw,
    E'(?:\\s[-–—]\\s?|\\s?[-–—]\\s|\\s*[/,;+]\\s*)'
  );
  foreach v_part in array v_parts loop
    if btrim(coalesce(v_part, '')) = '' then
      continue;
    end if;
    v_cand := upper(regexp_replace(v_part, '[^A-Z0-9]', '', 'g'));
    if public.telm_token_valid(v_cand) and not (v_cand = any (v_seen)) then
      v_seen := v_seen || v_cand;
      v_out := v_out || v_cand;
    end if;
  end loop;
  return v_out;
end;
$$;

comment on function public.telm_plate_tokens(text) is
  '#622 F7 r2: tokeny WT — pełny człon (sep. jak #623; ≥5+cyfra); bez sklejeń.';

revoke all on function public.telm_plate_tokens(text) from public, anon, authenticated;
grant execute on function public.telm_plate_tokens(text) to service_role;

-- Tokeny textId = matchTrailer.plateTokensEm: pełny człon + prefiksy od 1. fragmentu.
create or replace function public.telm_plate_tokens_em(p text)
returns text[]
language plpgsql immutable parallel safe set search_path = public as $$
declare
  v_raw text := btrim(coalesce(p, ''));
  v_parts text[];
  v_part text;
  v_frags text[];
  v_frag text;
  v_j int;
  v_acc text;
  v_out text[] := '{}';
  v_seen text[] := '{}';
  v_cand text;
begin
  if v_raw = '' then
    return '{}';
  end if;
  v_parts := regexp_split_to_array(
    v_raw,
    E'(?:\\s[-–—]\\s?|\\s?[-–—]\\s|\\s*[/,;+]\\s*)'
  );
  foreach v_part in array v_parts loop
    if btrim(coalesce(v_part, '')) = '' then
      continue;
    end if;
    v_frags := regexp_split_to_array(btrim(v_part), E'\\s+');
    v_acc := '';
    for v_j in 1 .. coalesce(cardinality(v_frags), 0) loop
      v_frag := upper(regexp_replace(v_frags[v_j], '[^A-Z0-9]', '', 'g'));
      if v_frag = '' then
        continue;
      end if;
      v_acc := v_acc || v_frag;
      v_cand := v_acc;
      if public.telm_token_valid(v_cand) and not (v_cand = any (v_seen)) then
        v_seen := v_seen || v_cand;
        v_out := v_out || v_cand;
      end if;
    end loop;
  end loop;
  return v_out;
end;
$$;

comment on function public.telm_plate_tokens_em(text) is
  '#622 F7 r2: tokeny textId — człony + prefiksy od 1. fragmentu (nigdy sam środek).';

revoke all on function public.telm_plate_tokens_em(text) from public, anon, authenticated;
grant execute on function public.telm_plate_tokens_em(text) to service_role;

-- Ranking: 1 pełna równość, 2 token główny WT, 3 dodatkowy; null = brak (F7 P1 / B1-bis).
create or replace function public.telm_trailer_match_rank(p_trailer text, p_text_id text)
returns int
language plpgsql immutable parallel safe set search_path = public as $$
declare
  v_full_wt text := upper(regexp_replace(coalesce(p_trailer, ''), '[^A-Z0-9]', '', 'g'));
  v_full_em text := upper(regexp_replace(coalesce(p_text_id, ''), '[^A-Z0-9]', '', 'g'));
  v_wt text[] := public.telm_plate_tokens(p_trailer);
  v_em text[] := public.telm_plate_tokens_em(p_text_id);
  v_t text;
begin
  if v_full_wt <> '' and v_full_em <> '' and v_full_wt = v_full_em then
    return 1;
  end if;
  if cardinality(v_wt) is null or cardinality(v_wt) = 0
     or cardinality(v_em) is null or cardinality(v_em) = 0 then
    return null;
  end if;
  if v_em @> array[v_wt[1]] then
    return 2;
  end if;
  foreach v_t in array v_wt loop
    if v_em @> array[v_t] then
      return 3;
    end if;
  end loop;
  return null;
end;
$$;

revoke all on function public.telm_trailer_match_rank(text, text) from public, anon, authenticated;
grant execute on function public.telm_trailer_match_rank(text, text) to service_role;

create or replace function public.telm_trailer_tokens_match(p_trailer text, p_text_id text)
returns boolean
language sql immutable parallel safe set search_path = public as $$
  select public.telm_trailer_match_rank(p_trailer, p_text_id) is not null;
$$;

comment on function public.telm_trailer_tokens_match(text, text) is
  '#622 F7: pełna równość albo wspólny token (≥5+cyfra).';

revoke all on function public.telm_trailer_tokens_match(text, text) from public, anon, authenticated;
grant execute on function public.telm_trailer_tokens_match(text, text) to service_role;

-- Orphan.plate znormalizowany; najpierw plate = any(tokeny), potem raw textId (F7 P4).
create or replace function public.telm_orphan_matches_trailer(p_orphan_plate text, p_raw jsonb, p_trailer text)
returns boolean
language plpgsql stable set search_path = public as $$
declare
  v_wt text[] := public.telm_plate_tokens(p_trailer);
  v_plate text := upper(regexp_replace(coalesce(p_orphan_plate, ''), '[^A-Z0-9]', '', 'g'));
  v_raw_id text := coalesce(p_raw->>'textId', p_raw->>'text_id', '');
begin
  if v_plate <> '' and public.telm_trailer_tokens_match(p_trailer, v_plate) then
    return true;
  end if;
  if v_plate <> '' and cardinality(v_wt) > 0 and v_plate = any (v_wt) then
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

-- Czy p_load jest jedynym najlepszym kandydatem dla sieroty (F7 P1 reclaim).
create or replace function public.telm_orphan_unique_best_load(
  p_load_id uuid, p_plate text, p_raw jsonb, p_ts timestamptz
) returns boolean
language plpgsql stable set search_path = public as $$
declare
  v_text text := coalesce(nullif(btrim(coalesce(p_raw->>'textId', p_raw->>'text_id', '')), ''), p_plate);
  v_best int;
  v_my int;
  v_r int;
  v_n int := 0;
  r record;
begin
  v_my := public.telm_trailer_match_rank(
    (select trailer_plate from loads where id = p_load_id), v_text
  );
  if v_my is null then
    return false;
  end if;
  v_best := v_my;
  for r in
    select l.id, l.trailer_plate
      from loads l
     where l.id <> p_load_id
       and l.telematics_vehicle_id ~* 'emtrack\.eu'
       and coalesce(l.trailer_plate, '') <> ''
       and public.load_in_tracking_window(l.id, p_ts)
  loop
    v_r := public.telm_trailer_match_rank(r.trailer_plate, v_text);
    if v_r is null then
      continue;
    end if;
    if v_r < v_best then
      return false;
    end if;
    if v_r = v_best then
      v_n := v_n + 1;
    end if;
  end loop;
  return v_n = 0;
end;
$$;

revoke all on function public.telm_orphan_unique_best_load(uuid, text, jsonb, timestamptz)
  from public, anon, authenticated;
grant execute on function public.telm_orphan_unique_best_load(uuid, text, jsonb, timestamptz)
  to service_role;

drop function if exists public.telm_reclaim_orphan_positions(uuid, timestamptz);

create or replace function public.telm_reclaim_orphan_positions(
  p_load_id uuid,
  p_since timestamptz default null,
  p_until timestamptz default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_trailer text;
  v_link text;
  v_opened timestamptz;
  v_delivered timestamptz;
  v_win_end timestamptz;
  v_since timestamptz;
  v_cursor timestamptz;
  v_batch int;
  r record;
  v_n int := 0;
  v_skip int := 0;
  v_last_ts timestamptz;
  v_last_lat float8;
  v_last_lon float8;
  v_max_pos timestamptz;
  v_pt geometry(Point, 4326);
  v_insert_only boolean;
  v_delivered_mode boolean;
  v_refresh_needed boolean := false;
begin
  if p_load_id is null then
    return jsonb_build_object('ok', false, 'error', 'load_id', 'reclaimed', 0);
  end if;

  select l.trailer_plate, l.telematics_vehicle_id, l.tracking_opened_at,
         l.actual_delivery_at
    into v_trailer, v_link, v_opened, v_delivered
    from loads l where l.id = p_load_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found', 'reclaimed', 0);
  end if;
  if v_link is null or btrim(v_link) = '' or v_link !~* 'emtrack\.eu' then
    return jsonb_build_object('ok', false, 'error', 'no_emtrack_link', 'reclaimed', 0);
  end if;
  if v_trailer is null or btrim(v_trailer) = '' then
    return jsonb_build_object('ok', false, 'error', 'no_trailer', 'reclaimed', 0);
  end if;

  v_delivered_mode := v_delivered is not null;
  v_win_end := coalesce(p_until, v_delivered, now() + interval '1 day');
  v_since := coalesce(
    p_since,
    v_opened,
    (select public.tracking_window_start(plan_load_date) from loads where id = p_load_id)
  );
  v_cursor := coalesce(v_since, '-infinity'::timestamptz);

  perform set_config('tower.pos_budget_bypass', 'on', true);

  loop
    v_batch := 0;
    for r in
      select o.id, o.plate, o.lat, o.lon, o.ts, o.source, o.speed_kmh, o.heading_deg, o.ignition, o.raw
        from telematics_orphan_positions o
       where o.ts >= v_cursor
         and o.ts <= v_win_end
         and public.telm_orphan_matches_trailer(o.plate, o.raw, v_trailer)
       order by o.ts asc
       limit 800
    loop
      v_batch := v_batch + 1;
      v_cursor := r.ts;

      if v_delivered_mode then
        if r.ts < coalesce(v_opened, v_since, '-infinity'::timestamptz)
           or r.ts > v_delivered then
          v_skip := v_skip + 1;
          continue;
        end if;
        v_insert_only := true;
      elsif public.load_in_tracking_window(p_load_id, r.ts) is not true then
        v_skip := v_skip + 1;
        continue;
      else
        select max(p.ts) into v_max_pos from positions p where p.load_id = p_load_id;
        v_insert_only := (v_max_pos is not null and r.ts < v_max_pos);
      end if;

      if public.telm_orphan_unique_best_load(p_load_id, r.plate, r.raw, r.ts) is not true then
        v_skip := v_skip + 1;
        continue;
      end if;

      if v_insert_only then
        v_pt := st_setsrid(st_makepoint(r.lon, r.lat), 4326);
        insert into positions (load_id, ts, geom_raw, speed_kmh, heading_deg, ignition, source, raw)
        values (
          p_load_id, r.ts, v_pt, r.speed_kmh, r.heading_deg, r.ignition, r.source,
          coalesce(r.raw, '{}'::jsonb) || jsonb_build_object('reclaim_insert_only', true)
        )
        on conflict (load_id, ts, source) do nothing;
      else
        perform public.process_position(
          p_load_id, r.lat, r.lon, r.ts, r.source,
          r.speed_kmh, r.heading_deg, r.ignition, coalesce(r.raw, '{}'::jsonb)
        );
      end if;

      if exists (
        select 1 from positions p
         where p.load_id = p_load_id and p.ts = r.ts and p.source = r.source
      ) then
        delete from telematics_orphan_positions where id = r.id;
        v_n := v_n + 1;
        if v_insert_only then
          -- P3-bis: refresh tylko gdy ten insert-only jest najnowszym punktem transportu
          if not exists (
            select 1 from positions p
             where p.load_id = p_load_id and p.ts > r.ts
          ) then
            v_refresh_needed := true;
            v_last_ts := r.ts;
            v_last_lat := r.lat;
            v_last_lon := r.lon;
          end if;
        else
          v_refresh_needed := false;
          v_last_ts := r.ts;
          v_last_lat := r.lat;
          v_last_lon := r.lon;
        end if;
      else
        v_skip := v_skip + 1;
      end if;
    end loop;

    exit when v_batch < 800;
    v_cursor := v_cursor + interval '1 microsecond';
  end loop;

  -- P3-bis: bez process_position (unikaj podwójnego geofence); tylko faza + ETA.
  if v_refresh_needed and v_last_lat is not null and v_delivered_mode is not true then
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

  perform set_config('tower.pos_budget_bypass', 'off', true);

  -- P4-bis: zamknij alarm tylko gdy reclaim > 0 albo jest GPS < 2 h
  if v_n > 0 or exists (
    select 1 from positions p
     where p.load_id = p_load_id and p.ts > now() - interval '2 hours'
  ) then
    update risk_signals
       set resolved_at = now()
     where load_id = p_load_id
       and dedup_key = 'EMTRACK_ORPHAN:' || p_load_id::text
       and resolved_at is null;
  end if;

  insert into audit_log (user_id, action, entity, entity_id, new_value)
  values (
    null, 'TELM_ORPHAN_RECLAIM', 'loads', p_load_id::text,
    jsonb_build_object(
      'reclaimed', v_n, 'skipped', v_skip, 'since', v_since,
      'until', p_until, 'last_ts', v_last_ts, 'refresh', v_refresh_needed
    )
  );

  return jsonb_build_object(
    'ok', true,
    'reclaimed', v_n,
    'skipped', v_skip,
    'last_ts', v_last_ts,
    'refresh', v_refresh_needed,
    'status', (select status::text from loads where id = p_load_id)
  );
end;
$$;

comment on function public.telm_reclaim_orphan_positions(uuid, timestamptz, timestamptz) is
  '#622 F7 r2: sieroty→positions; INSERT-only; p_until; refresh bez geofence; P4-bis.';

revoke all on function public.telm_reclaim_orphan_positions(uuid, timestamptz, timestamptz)
  from public, anon, authenticated;
grant execute on function public.telm_reclaim_orphan_positions(uuid, timestamptz, timestamptz)
  to service_role;

-- Alarm HHL + zamykanie przy świeżej pozycji < 2 h (F7 P4).
create or replace function public.telm_scan_orphan_trailer_alerts(p_now timestamptz default now())
returns integer
language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_code text;
  v_n int := 0;
  v_last timestamptz;
  v_tok text[];
begin
  -- Zamknij otwarte, gdy jest świeża pozycja.
  update risk_signals rs
     set resolved_at = p_now
   where rs.kind = 'EMTRACK_ORPHAN'
     and rs.resolved_at is null
     and exists (
       select 1 from positions p
        where p.load_id = rs.load_id and p.ts > p_now - interval '2 hours'
     );

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
    -- P4-perf: najpierw plate = any(tokeny); raw textId tylko gdy pierwszy nic nie znalazł.
    v_tok := public.telm_plate_tokens(r.trailer_plate);
    if (
      (cardinality(v_tok) > 0 and exists (
        select 1 from telematics_orphan_positions o
         where o.ts > p_now - interval '24 hours' and o.plate = any (v_tok)
      ))
      or exists (
        select 1 from telematics_orphan_positions o
         where o.ts > p_now - interval '24 hours'
           and public.telm_trailer_tokens_match(
             r.trailer_plate,
             coalesce(o.raw->>'textId', o.raw->>'text_id', '')
           )
      )
    ) is not true then
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
  '#622 F7: EMTRACK_ORPHAN HHL; zamyka przy GPS<2h; plate=any(tokeny) przed raw.';

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

commit;
