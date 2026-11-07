-- DP-230 (#852): ostrzeżenia (bez auto-zmiany przypisania rejsu):
-- 1) GPS w geostrefie PORT_OUT innego armatora/trasy niż port wyjścia przypisanego rejsu
--    (okno od dep−6 h, status przed FERRY);
-- 2) ta sama tractor_plate (telm_norm_plate) w ≥2 aktywnych zleceniach z nakładającymi się oknami;
-- 3) flaga ETA „przypisany rejs odpłynął bez transportu” dostaje towarzyszący tekst GPS, gdy
--    otwarte GPS_WRONG_PORT (nie zostaje sama);
-- 4) promote_ferry_departures → FERRY po ATD tylko gdy brak GPS przed odejściem albo GPS
--    w PORT_OUT portu wyjścia rejsu; inaczej ryzyko + bez FERRY (bez podmiany na AIS).

begin;

-- FERRY + detail.audience=HHL_PRZEWOZNIK → HHL+SCX (bez KSH), jak DP-217 / E49 Z2.
create or replace function public.risk_audience_for(p_kind text, p_detail jsonb)
returns risk_audience language plpgsql stable security definer set search_path = public as $$
declare v_dir text; v_inv text;
begin
  if auth.uid() is not null and current_app_user_id() is null then
    raise exception 'Brak aktywnego konta' using errcode = '42501';
  end if;
  if p_kind = 'SILENT_VEHICLE' and coalesce(p_detail->>'emtrack_trailer', '') = '1' then
    return 'HHL';
  end if;
  if p_kind = 'FERRY' and coalesce(p_detail->>'audience', '') = 'HHL' then
    return 'HHL';
  end if;
  -- DP-230: GPS w obcym porcie — HHL + SCX
  if p_kind = 'FERRY' and coalesce(p_detail->>'audience', '') = 'HHL_PRZEWOZNIK' then
    return 'HHL_PRZEWOZNIK';
  end if;
  if p_kind = 'WEATHER' and coalesce(p_detail->>'audience', '') = 'HHL_PRZEWOZNIK' then
    return 'HHL_PRZEWOZNIK';
  end if;
  if p_kind = 'ROAD_FI' and coalesce(p_detail->>'audience', '') = 'HHL_PRZEWOZNIK' then
    return 'HHL_PRZEWOZNIK';
  end if;
  if p_kind in (
    'FERRY', 'ROAD_SE', 'ROAD_PL', 'ROAD_LT', 'ROAD_LV', 'ROAD_EE', 'ROAD_FI',
    'WEATHER', 'ETA_BREACH'
  ) then
    return 'WSZYSCY';
  end if;
  if p_kind = 'RESOURCE_MISSING' and coalesce(p_detail->>'rule', '') = 'ORDER_NO'
     and coalesce(p_detail->>'side', '') = 'HHL' then
    return 'HHL';
  end if;
  if p_kind = 'RESOURCE_MISSING' and coalesce(p_detail->>'rule', '') = 'TV_CODE' then
    return 'HHL';
  end if;
  if p_kind in ('SILENT_VEHICLE', 'AUTO_STATUS', 'LOADING_UNCONFIRMED', 'RESOURCE_MISSING',
                'DOC_MISSING', 'PERMIT', 'INSURANCE', 'LATE_DATE_CHANGE', 'ROUTE_OBSTACLE') then
    return 'HHL_PRZEWOZNIK';
  end if;
  if p_kind in ('SEQUENCE', 'DATES_UNCONFIRMED') then
    return 'HHL_KLIENT';
  end if;
  if p_kind = 'INVOICE_MISMATCH' then
    v_dir := upper(coalesce(p_detail->>'direction', ''));
    v_inv := p_detail->>'invoice_id';
    if v_dir = '' and v_inv ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      select i.direction::text into v_dir from invoices i where i.id = v_inv::uuid;
    end if;
    return case coalesce(v_dir, '')
             when 'KOSZT' then 'HHL_PRZEWOZNIK'
             when 'PRZYCHOD' then 'HHL_KLIENT'
             else 'HHL' end;
  end if;
  return 'HHL';
end $$;

revoke all on function public.risk_audience_for(text, jsonb) from public, anon;
grant execute on function public.risk_audience_for(text, jsonb) to authenticated;
comment on function public.risk_audience_for(text, jsonb) is
  'BN6 + DP-203/121/205/217 + DP-230 FERRY audience=HHL_PRZEWOZNIK (GPS obcy port).';

-- ---------------------------------------------------------------------------
-- 1) GPS w innym porcie niż rejs
-- ---------------------------------------------------------------------------
create or replace function public.detect_gps_wrong_ferry_port(
  p_now timestamptz default now(),
  p_window interval default interval '6 hours'
) returns integer
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  r record;
  n int := 0;
  v_now timestamptz := coalesce(p_now, now());
  v_win interval := coalesce(p_window, interval '6 hours');
  v_code text;
  v_title text;
  v_params jsonb;
  v_dedup text;
  v_gps_port text;
  v_dep_port text;
begin
  -- Zamknij, gdy status ≥ FERRY / brak rejsu / GPS poza obcą strefą / poza oknem.
  update public.risk_signals rs
     set resolved_at = coalesce(v_now, now())
   where rs.resolved_at is null
     and rs.dedup_key like 'GPS_WRONG_PORT:%'
     and (
       not exists (
         select 1
           from public.loads l
           join public.sailings s on s.id = l.sailing_id
          where l.id = rs.load_id
            and l.status < 'FERRY'
            and coalesce(s.delayed_departure_at, s.departure_at) is not null
            and v_now >= coalesce(s.delayed_departure_at, s.departure_at) - v_win
       )
       or not exists (
         select 1
           from public.loads l
           join public.sailings s on s.id = l.sailing_id
           join lateral (
             select p.geom_raw
               from public.positions p
              where p.load_id = l.id
                and coalesce((p.raw->>'stale_point')::boolean, false) is not true
              order by p.ts desc
              limit 1
           ) lp on true
           join public.geofences g
             on g.project_id = l.project_id
            and g.active
            and g.kind = 'PORT_OUT'
            and st_contains(g.geom, lp.geom_raw)
            and public.ferry_geofence_matches_route(g.route, s.route) is not true
          where l.id = rs.load_id
       )
     );

  for r in
    select l.id as load_id,
           s.id as sailing_id,
           s.route as sail_route,
           coalesce(s.delayed_departure_at, s.departure_at) as dep,
           pf.code as dep_port_code,
           pf.name as dep_port_name,
           g.route as gps_route,
           g.name as gps_fence_name,
           g.country as gps_country,
           st_y(lp.geom_raw::geometry) as lat,
           st_x(lp.geom_raw::geometry) as lon,
           lp.ts as pos_ts
      from public.loads l
      join public.sailings s on s.id = l.sailing_id
      left join public.ferry_routes fr on fr.code = upper(btrim(s.route)) and fr.active
      left join public.ferry_ports pf on pf.code = fr.port_from
      join lateral (
        select p.ts, p.geom_raw
          from public.positions p
         where p.load_id = l.id
           and coalesce((p.raw->>'stale_point')::boolean, false) is not true
         order by p.ts desc
         limit 1
      ) lp on true
      join public.geofences g
        on g.project_id = l.project_id
       and g.active
       and g.kind = 'PORT_OUT'
       and st_contains(g.geom, lp.geom_raw)
       and public.ferry_geofence_matches_route(g.route, s.route) is not true
     where l.status < 'FERRY'
       and coalesce(s.delayed_departure_at, s.departure_at) is not null
       and v_now >= coalesce(s.delayed_departure_at, s.departure_at) - v_win
  loop
    v_dedup := 'GPS_WRONG_PORT:' || r.load_id || ':' || r.sailing_id;
    if exists (
      select 1 from public.risk_signals
       where dedup_key = v_dedup
         and resolved_at is not null
    ) then
      continue;
    end if;

    v_dep_port := coalesce(nullif(btrim(r.dep_port_name), ''), nullif(btrim(r.dep_port_code), ''), 'rejsu');
    -- POLFERRIES PORT_OUT PL → Gdańsk; STENA PORT_OUT PL → Gdynia; inaczej nazwa strefy
    v_gps_port := case
      when upper(coalesce(r.gps_route, '')) in ('POLFERRIES', 'GDN-NYN') and r.gps_country = 'PL'
        then 'Gdańsk'
      when upper(coalesce(r.gps_route, '')) in ('STENA', 'GDY-KAA') and r.gps_country = 'PL'
        then 'Gdynia'
      else coalesce(nullif(btrim(r.gps_fence_name), ''), 'innym')
    end;

    v_code := coalesce(
      nullif(nullif(btrim(public.load_sms_code(r.load_id)), ''), '—'),
      'transport'
    );
    v_params := jsonb_build_object(
      'code', v_code,
      'gps_port', v_gps_port,
      'dep_port', v_dep_port
    );
    v_title := format(
      'GPS w porcie %s, rejs z portu %s — sprawdź przydział',
      v_gps_port, v_dep_port
    );
    perform public.raise_risk(
      r.load_id, 'FERRY', 'HIGH', v_title,
      jsonb_build_object(
        'sailing_id', r.sailing_id,
        'title_key', 'rk_gps_wrong_port',
        'params', v_params,
        'audience', 'HHL_PRZEWOZNIK',
        'gps_route', r.gps_route,
        'sail_route', r.sail_route,
        'dep', r.dep,
        'lat', r.lat,
        'lon', r.lon,
        'pos_ts', r.pos_ts
      ),
      v_dedup
    );
    n := n + 1;
  end loop;
  return n;
end $function$;

revoke all on function public.detect_gps_wrong_ferry_port(timestamptz, interval)
  from public, anon, authenticated;
grant execute on function public.detect_gps_wrong_ferry_port(timestamptz, interval)
  to service_role;
comment on function public.detect_gps_wrong_ferry_port(timestamptz, interval) is
  'DP-230: GPS w PORT_OUT obcej trasy vs rejs (od dep−6 h, status < FERRY) → HIGH rk_gps_wrong_port; bez zmiany zlecenia.';

-- ---------------------------------------------------------------------------
-- 2) Ten sam ciągnik w ≥2 aktywnych zleceniach
-- ---------------------------------------------------------------------------
create or replace function public.detect_duplicate_tractor_plate(
  p_now timestamptz default now()
) returns integer
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  r record;
  n int := 0;
  v_now timestamptz := coalesce(p_now, now());
  v_code text;
  v_title text;
  v_params jsonb;
  v_dedup text;
  v_others uuid[];
  v_cnt int;
begin
  -- Zamknij, gdy płyta pusta / status terminalny / brak drugiej aktywnej z nakładką.
  update public.risk_signals rs
     set resolved_at = coalesce(v_now, now())
   where rs.resolved_at is null
     and rs.dedup_key like 'TRACTOR_DUP:%'
     and not exists (
       select 1
         from public.loads a
         join public.loads b on b.id <> a.id
          and public.telm_norm_plate(b.tractor_plate) = public.telm_norm_plate(a.tractor_plate)
          and b.status not in (
            'CANCELLED', 'UNLOADED', 'DELIVERED', 'READY_TO_INVOICE', 'INVOICED'
          )
          and tstzrange(
                coalesce(a.plan_load_from, (a.plan_load_date + time '00:00') at time zone 'Europe/Warsaw'),
                coalesce(a.plan_delivery_to, ((a.plan_delivery_date + 1) + time '00:00') at time zone 'Europe/Warsaw'),
                '[)'
              )
              && tstzrange(
                coalesce(b.plan_load_from, (b.plan_load_date + time '00:00') at time zone 'Europe/Warsaw'),
                coalesce(b.plan_delivery_to, ((b.plan_delivery_date + 1) + time '00:00') at time zone 'Europe/Warsaw'),
                '[)'
              )
        where a.id = rs.load_id
          and nullif(public.telm_norm_plate(a.tractor_plate), '') is not null
          and a.status not in (
            'CANCELLED', 'UNLOADED', 'DELIVERED', 'READY_TO_INVOICE', 'INVOICED'
          )
     );

  for r in
    with active as (
      select l.id,
             l.project_id,
             public.telm_norm_plate(l.tractor_plate) as plate,
             l.tractor_plate as plate_raw,
             tstzrange(
               coalesce(l.plan_load_from, (l.plan_load_date + time '00:00') at time zone 'Europe/Warsaw'),
               coalesce(l.plan_delivery_to, ((l.plan_delivery_date + 1) + time '00:00') at time zone 'Europe/Warsaw'),
               '[)'
             ) as win
        from public.loads l
       where nullif(public.telm_norm_plate(l.tractor_plate), '') is not null
         and l.status not in (
           'CANCELLED', 'UNLOADED', 'DELIVERED', 'READY_TO_INVOICE', 'INVOICED'
         )
         and l.plan_load_date is not null
         and l.plan_delivery_date is not null
    )
    select a.id as load_id,
           a.plate,
           a.plate_raw,
           array_agg(b.id order by b.id) as other_ids,
           count(b.id)::int + 1 as n_loads
      from active a
      join active b on b.id <> a.id
                   and b.plate = a.plate
                   and a.win && b.win
     group by a.id, a.plate, a.plate_raw
  loop
    v_dedup := 'TRACTOR_DUP:' || r.plate || ':' || r.load_id;
    if exists (
      select 1 from public.risk_signals
       where dedup_key = v_dedup
         and resolved_at is not null
    ) then
      continue;
    end if;

    v_others := r.other_ids;
    v_cnt := r.n_loads;
    v_code := coalesce(
      nullif(nullif(btrim(public.load_sms_code(r.load_id)), ''), '—'),
      'transport'
    );
    v_params := jsonb_build_object(
      'code', v_code,
      'plate', coalesce(nullif(btrim(r.plate_raw), ''), r.plate),
      'n', v_cnt
    );
    v_title := format(
      'Ten sam ciągnik %s w %s aktywnych zleceniach — sprawdź przydział',
      coalesce(nullif(btrim(r.plate_raw), ''), r.plate),
      v_cnt
    );
    perform public.raise_risk(
      r.load_id, 'RESOURCE_MISSING', 'HIGH', v_title,
      jsonb_build_object(
        'title_key', 'rk_tractor_duplicate',
        'params', v_params,
        'audience', 'HHL_PRZEWOZNIK',
        'rule', 'TRACTOR_DUP',
        'plate_norm', r.plate,
        'other_load_ids', to_jsonb(v_others),
        'n', v_cnt
      ),
      v_dedup
    );
    n := n + 1;
  end loop;
  return n;
end $function$;

revoke all on function public.detect_duplicate_tractor_plate(timestamptz)
  from public, anon, authenticated;
grant execute on function public.detect_duplicate_tractor_plate(timestamptz)
  to service_role;
comment on function public.detect_duplicate_tractor_plate(timestamptz) is
  'DP-230: ta sama tractor_plate (telm_norm_plate) w ≥2 aktywnych zleceniach z nakładką okien → HIGH rk_tractor_duplicate.';

-- ---------------------------------------------------------------------------
-- 3) ETA: „odpłynął bez transportu” + towarzysz GPS_WRONG_PORT
-- ---------------------------------------------------------------------------
do $$
declare
  v_def text;
  v_new text;
  v_old text := $o$elsif v_has and v_status < 'FERRY' and v_sail.dep < p_now then
      v_flags := array_append(v_flags, 'przypisany rejs odpłynął bez transportu'::text); v_has := false;
    end if;$o$;
  v_rep text := $r$elsif v_has and v_status < 'FERRY' and v_sail.dep < p_now then
      v_flags := array_append(v_flags, 'przypisany rejs odpłynął bez transportu'::text);
      -- DP-230: nie zostawiaj samej flagi „odpłynął”, gdy GPS w obcym porcie
      if exists (
        select 1 from public.risk_signals rs
         where rs.load_id = p_load
           and rs.resolved_at is null
           and rs.dedup_key like 'GPS_WRONG_PORT:%'
      ) then
        v_flags := array_append(v_flags,
          'GPS w innym porcie niż rejs — sprawdź przydział'::text);
      end if;
      v_has := false;
    end if;$r$;
begin
  if to_regprocedure('public.compute_load_eta_core(uuid, timestamptz)') is null then
    raise exception 'DP-230 0429: brak compute_load_eta_core';
  end if;
  v_def := pg_get_functiondef('public.compute_load_eta_core(uuid, timestamptz)'::regprocedure);
  if position('GPS w innym porcie niż rejs — sprawdź przydział' in v_def) > 0 then
    return;
  end if;
  if position(v_old in v_def) = 0 then
    raise exception 'DP-230 0429: nie znaleziono gałęzi „odpłynął bez transportu” w compute_load_eta_core';
  end if;
  v_new := replace(v_def, v_old, v_rep);
  if position('GPS w innym porcie niż rejs — sprawdź przydział' in v_new) = 0 then
    raise exception 'DP-230 0429: podmiana flagi ETA nie weszła';
  end if;
  execute v_new;
end $$;

-- ---------------------------------------------------------------------------
-- 4) FERRY po ATD tylko przy GPS w porcie wyjścia (lub brak GPS przed odejściem)
-- ---------------------------------------------------------------------------
create or replace function public.gps_allows_ferry_promote(
  p_load_id uuid,
  p_sail_route text,
  p_dep timestamptz
) returns boolean
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_project uuid;
  v_sailing uuid;
  v_geom geometry;
  v_in_own boolean;
  v_foreign record;
  v_dep_port text;
  v_gps_port text;
  v_code text;
  v_title text;
  v_params jsonb;
  v_dedup text;
begin
  if p_load_id is null or p_dep is null then
    return true;
  end if;

  select l.project_id, l.sailing_id
    into v_project, v_sailing
    from public.loads l
   where l.id = p_load_id;

  select p.geom_raw::geometry
    into v_geom
    from public.positions p
   where p.load_id = p_load_id
     and p.ts <= p_dep
     and coalesce((p.raw->>'stale_point')::boolean, false) is not true
   order by p.ts desc
   limit 1;

  -- Brak GPS przed odejściem → jak dotąd (AIS / rozkład).
  if v_geom is null then
    return true;
  end if;

  select exists (
    select 1
      from public.geofences g
     where g.project_id = v_project
       and g.active
       and g.kind = 'PORT_OUT'
       and st_contains(g.geom, v_geom)
       and public.ferry_geofence_matches_route(g.route, p_sail_route) is true
  ) into v_in_own;

  if v_in_own is true then
    return true;
  end if;

  -- GPS w obcym PORT_OUT → ryzyko (HHL+SCX); bez FERRY / bez AIS na mapie.
  select g.route as gps_route,
         g.name as gps_fence_name,
         g.country as gps_country,
         pf.code as dep_port_code,
         pf.name as dep_port_name
    into v_foreign
    from public.geofences g
    left join public.ferry_routes fr
      on fr.code = upper(btrim(p_sail_route)) and fr.active
    left join public.ferry_ports pf on pf.code = fr.port_from
   where g.project_id = v_project
     and g.active
     and g.kind = 'PORT_OUT'
     and st_contains(g.geom, v_geom)
     and public.ferry_geofence_matches_route(g.route, p_sail_route) is not true
   order by g.name
   limit 1;

  -- GPS poza PORT_OUT (droga / morze) — bez blokady (jak #461 AIS/SCHEDULE).
  if v_foreign.gps_route is null then
    return true;
  end if;

  if v_sailing is not null then
    v_dedup := 'GPS_WRONG_PORT:' || p_load_id || ':' || v_sailing;
    if not exists (
      select 1 from public.risk_signals
       where dedup_key = v_dedup and resolved_at is not null
    ) then
      v_dep_port := coalesce(
        nullif(btrim(v_foreign.dep_port_name), ''),
        nullif(btrim(v_foreign.dep_port_code), ''),
        'rejsu'
      );
      v_gps_port := case
        when upper(coalesce(v_foreign.gps_route, '')) in ('POLFERRIES', 'GDN-NYN')
             and v_foreign.gps_country = 'PL'
          then 'Gdańsk'
        when upper(coalesce(v_foreign.gps_route, '')) in ('STENA', 'GDY-KAA')
             and v_foreign.gps_country = 'PL'
          then 'Gdynia'
        else coalesce(nullif(btrim(v_foreign.gps_fence_name), ''), 'innym')
      end;
      v_code := coalesce(
        nullif(nullif(btrim(public.load_sms_code(p_load_id)), ''), '—'),
        'transport'
      );
      v_params := jsonb_build_object(
        'code', v_code,
        'gps_port', v_gps_port,
        'dep_port', v_dep_port
      );
      v_title := format(
        'GPS w porcie %s, rejs z portu %s — sprawdź przydział',
        v_gps_port, v_dep_port
      );
      perform public.raise_risk(
        p_load_id, 'FERRY', 'HIGH', v_title,
        jsonb_build_object(
          'sailing_id', v_sailing,
          'title_key', 'rk_gps_wrong_port',
          'params', v_params,
          'audience', 'HHL_PRZEWOZNIK',
          'gps_route', v_foreign.gps_route,
          'sail_route', p_sail_route,
          'dep', p_dep,
          'source', 'promote_ferry_departures'
        ),
        v_dedup
      );
    end if;
  end if;

  return false;
end $function$;

revoke all on function public.gps_allows_ferry_promote(uuid, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.gps_allows_ferry_promote(uuid, text, timestamptz)
  to service_role;
comment on function public.gps_allows_ferry_promote(uuid, text, timestamptz) is
  'DP-230: FERRY po ATD — blokada gdy GPS w obcym PORT_OUT (rk_gps_wrong_port); brak GPS / port własny / poza portem — jak #461.';

do $$
declare
  v_def text;
  v_new text;
  v_old text := $o$    if r.status = 'FERRY' then
      continue;
    end if;

    /* #461: bez dzwonka przy AIS / SCHEDULE_ASSUMED (trg_load_status_matrix_notify × bulk_quiet). */
    v_prev := current_setting('tower.bulk_quiet', true);$o$;
  v_rep text := $r$    if r.status = 'FERRY' then
      continue;
    end if;

    -- DP-230 (#852): bez FERRY gdy ostatni GPS przed odejściem nie jest w porcie wyjścia.
    if public.gps_allows_ferry_promote(r.load_id, r.sailing_route, v_dep) is not true then
      continue;
    end if;

    /* #461: bez dzwonka przy AIS / SCHEDULE_ASSUMED (trg_load_status_matrix_notify × bulk_quiet). */
    v_prev := current_setting('tower.bulk_quiet', true);$r$;
begin
  if to_regprocedure('public.promote_ferry_departures(timestamptz)') is null then
    raise exception 'DP-230 0429: brak promote_ferry_departures';
  end if;
  v_def := pg_get_functiondef('public.promote_ferry_departures(timestamptz)'::regprocedure);
  if position('gps_allows_ferry_promote' in v_def) > 0 then
    return;
  end if;
  if position(v_old in v_def) = 0 then
    raise exception 'DP-230 0429: nie znaleziono miejsca wstawienia gps_allows_ferry_promote';
  end if;
  v_new := replace(v_def, v_old, v_rep);
  if position('gps_allows_ferry_promote' in v_new) = 0 then
    raise exception 'DP-230 0429: podmiana promote_ferry_departures nie weszła';
  end if;
  execute v_new;
end $$;

-- ---------------------------------------------------------------------------
-- 5) Cron — osobne joby (jak DP-133: jedna awaria nie wycofuje drugiej)
-- ---------------------------------------------------------------------------
do $cron230$
begin
  if to_regclass('cron.job') is not null
     and to_regprocedure('cron.schedule(text,text,text)') is not null then
    perform cron.unschedule(j.jobid)
      from cron.job j where j.jobname = 'tower-gps-wrong-port';
    perform cron.schedule(
      'tower-gps-wrong-port',
      '*/10 * * * *',
      $c$select public.detect_gps_wrong_ferry_port();$c$
    );

    perform cron.unschedule(j.jobid)
      from cron.job j where j.jobname = 'tower-tractor-dup';
    perform cron.schedule(
      'tower-tractor-dup',
      '*/10 * * * *',
      $c$select public.detect_duplicate_tractor_plate();$c$
    );
  end if;
exception when others then
  raise warning 'DP-230 cron: %', sqlerrm;
end $cron230$;

commit;
