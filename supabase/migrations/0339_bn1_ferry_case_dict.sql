-- BN1 (#573/#640): CASE-y ETA/AIS → słownik ferry_*; ferry_sailings_map z portów;
-- apply_geofence_status: REMOVED we wczesnym return (#648 F7); front RPC osobno.
-- Regresja Stena/Polferries bez zmian zachowania.

begin;

-- ---------------------------------------------------------------------------
-- 1) Wyjazdowy kierunek trasy (PL/EE → SE/FI) ze słownika
-- ---------------------------------------------------------------------------
create or replace function public.ferry_route_is_outbound(p_route text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from ferry_routes fr
      join ferry_ports pf on pf.code = fr.port_from
      join ferry_ports pt on pt.code = fr.port_to
     where fr.active
       and fr.code = upper(btrim(p_route))
       and pf.country in ('PL', 'EE')
       and pt.country in ('SE', 'FI')
  );
$$;

comment on function public.ferry_route_is_outbound(text) is
  'BN1: trasa wyjazdowa (PL/EE → SE/FI) ze słownika ferry_ports.country.';

revoke all on function public.ferry_route_is_outbound(text) from public, anon, authenticated;
grant execute on function public.ferry_route_is_outbound(text) to service_role;


-- 2) apply_geofence_status — REMOVED
create or replace function public.apply_geofence_status()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_kind    geofence_kind;
  v_gid     uuid;
  v_country char(2);
  v_name    text;
  v_status  load_status;
  v_detail  jsonb;
  v_entered timestamptz;
  v_dwell_min numeric;
  v_project uuid;
  v_title   text;
  v_code    text;
  v_route   text;
  v_op      text;
  v_load_route text;
  v_gaps    jsonb;
  v_gaps_txt text;
  v_dep     timestamptz;
  v_prev    text;
begin
  select status, project_id into v_status, v_project from loads where id = new.load_id;
  if v_status in ('CANCELLED','REMOVED','UNLOADED','DELIVERED','READY_TO_INVOICE','INVOICED') then
    return null;
  end if;
  begin
    v_gid := (new.payload->>'geofence_id')::uuid;
  exception when others then
    return null;
  end;
  select g.kind, g.country, g.name, g.route into v_kind, v_country, v_name, v_route
    from geofences g where g.id = v_gid;
  if v_kind is null then return null; end if;
  v_op := 'POLFERRIES';
  v_load_route := null;
  select public.eta_obs_operator_key(s.route), s.route
    into v_op, v_load_route from loads l left join sailings s on s.id = l.sailing_id
   where l.id = new.load_id;
  v_op := coalesce(v_op, 'POLFERRIES');

  if coalesce(new.payload->>'synthetic', '') = 'true'
     or coalesce((new.payload->>'actual_load')::boolean, true) is false then
    return null;
  end if;

  v_detail := jsonb_build_object(
    'geofence_id', new.payload->>'geofence_id',
    'geofence_kind', v_kind,
    'geofence_name', coalesce(nullif(new.payload->>'geofence_name', ''), v_name),
    'zdarzenie', new.event_type,
    'source', 'GPS'
  );

  if new.event_type = 'GEOFENCE_ENTER' then

    if v_kind = 'LOADING'
       and v_status in ('PLANNED','RESOURCES_PENDING','DOCS_PENDING','READY') then
      v_gaps := public.awiz_missing(new.load_id);
      if v_status is distinct from 'READY'
         or exists (
           select 1
             from jsonb_array_elements(coalesce(v_gaps, '[]'::jsonb)) g
            where g->>'kind' in ('ORDER_SCX', 'ORDER_HHL')
         ) then
        v_gaps_txt := public.a10_prep_gaps_text(v_gaps);
        perform raise_risk(new.load_id, 'AUTO_STATUS', 'HIGH',
          case when coalesce(v_gaps_txt, '') = '' then
            format('Załadunek bez gotowości (status %s)', v_status)
          else
            format('Załadunek bez gotowości: %s', v_gaps_txt)
          end,
          v_detail || jsonb_build_object(
            'title_key', 'rk_loading_not_ready',
            'params', jsonb_build_object('status', v_status, 'gaps', coalesce(v_gaps_txt, '')),
            'gaps', v_gaps
          ),
          'LOADING_NOT_READY:' || new.load_id);
      end if;
      perform auto_set_status(new.load_id, v_status, 'AT_LOADING',
        'wjazd w strefę załadunku', new.occurred_at, v_detail);

    elsif v_kind = 'PORT_OUT'
          and public.load_status_rank(v_status) >= public.load_status_rank('READY')
          and public.load_status_rank(v_status) <= public.load_status_rank('IN_TRANSIT_PL')
          and public.ferry_geofence_matches_route(v_route, v_load_route) then
      if auto_set_status(new.load_id, v_status, 'AT_PORT_GDANSK',
           format('wjazd w strefę portu PL (%s)', coalesce(v_name, v_op)),
           new.occurred_at, v_detail)
         and loaded_confirmed(new.load_id) is not true then
        perform raise_risk(new.load_id, 'LOADING_UNCONFIRMED', 'MEDIUM',
          format('Pojazd w porcie PL (%s) bez potwierdzenia załadunku', coalesce(v_name, v_op)),
          v_detail || jsonb_build_object('title_key', 'rk_port_no_loaded', 'params', '{}'::jsonb),
          'PORT_NO_LOADED:' || new.load_id);
      end if;

    elsif v_kind = 'PORT_IN'
          and public.load_status_rank(v_status) < public.load_status_rank('AT_PORT_NYNASHAMN')
          and public.load_status_rank(v_status) >= public.load_status_rank('AT_LOADING')
          and public.ferry_geofence_matches_route(v_route, v_load_route) then
      if v_status is distinct from 'FERRY' then
        select coalesce(s.delayed_departure_at, s.departure_at) into v_dep
          from loads l left join sailings s on s.id = l.sailing_id
         where l.id = new.load_id;
        v_prev := current_setting('tower.bulk_quiet', true);
        perform set_config('tower.bulk_quiet', 'on', true);
        perform auto_set_status(
          new.load_id, v_status, 'FERRY',
          'wjazd do portu SE — uzupełniony status Na promie',
          least(coalesce(v_dep, new.occurred_at), new.occurred_at),
          v_detail || jsonb_build_object(
            'source', 'SCHEDULE',
            'synthetic_ferry', true
          )
        );
        perform set_config('tower.bulk_quiet', coalesce(v_prev, ''), true);
        select status into v_status from loads where id = new.load_id;
      end if;
      if v_status = 'FERRY' then
        perform auto_set_status(new.load_id, v_status, 'AT_PORT_NYNASHAMN',
          format('wjazd w strefę portu SE (%s)', coalesce(v_name, v_op)),
          new.occurred_at, v_detail);
      end if;

    elsif v_kind = 'SITE'
          and public.load_status_rank(v_status) >= public.load_status_rank('AT_LOADING')
          and public.load_status_rank(v_status) < public.load_status_rank('AT_SITE') then
      perform auto_set_status(new.load_id, v_status, 'AT_SITE',
        'wjazd na plac budowy', new.occurred_at, v_detail);

    -- Awaryjnie: GPS zgubił wyjazd z portu SE albo cały pobyt w porcie
    -- (sygnał wraca dopiero na lądzie). Auto na drogach SE nie może być na promie.
    elsif v_kind in ('CHECKPOINT','PRE_ARRIVAL') and v_country = 'SE'
          and v_status in ('FERRY','AT_PORT_NYNASHAMN') then
      perform auto_set_status(new.load_id, v_status, 'IN_TRANSIT_SE',
        'pozycja na trasie SE — wyjazd z portu niezarejestrowany', new.occurred_at, v_detail);
    end if;

  elsif new.event_type = 'GEOFENCE_EXIT' then

    select s.entered_at into v_entered
      from geofence_states s
     where s.load_id = new.load_id and s.geofence_id = v_gid;
    if v_entered is null and new.payload ? 'entered_at' then
      begin
        v_entered := (new.payload->>'entered_at')::timestamptz;
      exception when others then
        v_entered := null;
      end;
    end if;
    if v_entered is not null then
      v_dwell_min := round(extract(epoch from (new.occurred_at - v_entered)) / 60.0);
    elsif new.payload ? 'dwell_min' then
      v_dwell_min := (new.payload->>'dwell_min')::numeric;
    else
      v_dwell_min := null;
    end if;
    if v_dwell_min is not null then
      v_detail := v_detail || jsonb_build_object('dwell_min', v_dwell_min, 'entered_at', v_entered);
    end if;

    if v_kind = 'LOADING' and v_status = 'AT_LOADING' then
      if v_entered is null then
        null;
      elsif v_dwell_min is not null and v_dwell_min >= 5 then
        if auto_set_status(
             new.load_id, v_status, 'IN_TRANSIT_PL',
             'wyjazd ze strefy załadunku po postoju ≥ 5 min',
             new.occurred_at,
             v_detail
           ) then
          perform set_config('tower.status_ctx', 'on', true);
          update loads
             set actual_load_at = coalesce(actual_load_at, new.occurred_at),
                 updated_at = now()
           where id = new.load_id;
        end if;
      end if;

    elsif v_kind = 'SITE' and v_status = 'AT_SITE' then
      if v_dwell_min is not null and v_dwell_min >= 10 then
        if auto_set_status(
             new.load_id, v_status, 'DELIVERED',
             format('wyjazd z placu po %s min', v_dwell_min::int),
             new.occurred_at,
             v_detail
           ) then
          perform set_config('tower.status_ctx', 'on', true);
          update loads
             set actual_delivery_at = coalesce(actual_delivery_at, new.occurred_at),
                 updated_at = now()
           where id = new.load_id;
        end if;
      elsif v_dwell_min is not null and v_dwell_min < 10 then
        select public.load_sms_code(new.load_id) into v_code;
        v_title := format(
          '%s: wyjazd z placu po %s min — czy dostarczono?',
          coalesce(nullif(v_code, ''), 'transport'),
          v_dwell_min::int
        );
        perform decision_open_from_event(
          v_project,
          'DELIVERED_CHECK',
          'L14:' || new.load_id::text || ':' || v_gid::text || ':'
            || to_char(new.occurred_at at time zone 'UTC', 'YYYYMMDDHH24MI'),
          v_title,
          v_detail || jsonb_build_object(
            'exit_at', new.occurred_at,
            'threshold_min', 10,
            'zone', coalesce(nullif(new.payload->>'geofence_name', ''), v_name)
          ),
          new.load_id,
          null
        );
      end if;

    elsif v_kind = 'PORT_IN' and v_status = 'AT_PORT_NYNASHAMN'
          and public.ferry_geofence_matches_route(v_route, v_load_route) then
      perform auto_set_status(new.load_id, v_status, 'IN_TRANSIT_SE',
        format('wyjazd ze strefy portu SE (%s)', coalesce(v_name, v_op)),
        new.occurred_at, v_detail);
    end if;
    -- Wyjazd ze strefy portu Gdańsk po przełączeniu na PROM (statek
    -- odpływa) celowo niczego nie zmienia.
  end if;
  return null;
end $function$;


-- 3) promote_ferry_departures
create or replace function public.promote_ferry_departures(p_now timestamp with time zone default now())
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  r record;
  v_op text;
  v_dep timestamptz;
  v_src text;
  v_reason text;
  v_prev text;
  v_ev bigint;
  v_ev_at timestamptz;
  v_ev_src text;
  n int := 0;
begin
  /* Odwołany rejs — jak dotąd, względem planu (nie AIS). */
  for r in
    select l.id as load_id, l.project_id, l.status, s.id as sailing_id,
           s.route as sailing_route, v.name as vessel,
           coalesce(s.delayed_departure_at, s.departure_at) as plan_dep
      from loads l
      join sailings s on s.id = l.sailing_id and public.ferry_route_is_outbound(s.route)
      join vessels  v on v.id = s.vessel_id
     where s.status = 'ODWOLANY'
       and coalesce(s.delayed_departure_at, s.departure_at) <= p_now
       and l.status in ('PLANNED','RESOURCES_PENDING','DOCS_PENDING','READY',
                        'AT_LOADING','IN_TRANSIT_PL','AT_PORT_GDANSK')
  loop
    perform raise_risk(r.load_id, 'FERRY', 'HIGH',
      format('Rejs %s z %s odwołany — transport wymaga nowego rejsu', r.vessel,
             to_char(r.plan_dep at time zone 'Europe/Warsaw', 'DD.MM HH24:MI')),
      jsonb_build_object(
        'sailing_id', r.sailing_id,
        'title_key', 'rk_sailing_cancelled',
        'params', jsonb_build_object(
          'vessel', r.vessel,
          'dep', to_char(r.plan_dep at time zone 'Europe/Warsaw', 'DD.MM HH24:MI'))),
      'SAILING_CANCELLED:' || r.load_id || ':' || r.sailing_id);
  end loop;

  /* Prom: AIS albo plan+1 h (brak odwołania). Bez spraw MISSED/NO_DEPARTURE.
     F7: tylko READY…AT_PORT_GDANSK (+ FERRY do korekty AIS) — nie PLANNED/DOCS/RESOURCES. */
  for r in
    select l.id as load_id, l.project_id, l.status, s.id as sailing_id,
           s.route as sailing_route, v.name as vessel,
           s.actual_departure_at as actual_dep,
           coalesce(s.delayed_departure_at, s.departure_at) as plan_dep
      from loads l
      join sailings s on s.id = l.sailing_id and public.ferry_route_is_outbound(s.route)
      join vessels  v on v.id = s.vessel_id
     where s.status is distinct from 'ODWOLANY'
       and l.status in ('READY','AT_LOADING','IN_TRANSIT_PL','AT_PORT_GDANSK','FERRY')
  loop
    v_dep := null;
    v_src := null;
    v_reason := null;
    v_ev := null;
    v_ev_at := null;
    v_ev_src := null;

    if r.actual_dep is not null and r.actual_dep <= p_now then
      v_dep := r.actual_dep;
      v_src := 'AIS';
      v_reason := 'wypłynięcie rejsu (AIS)';
    elsif r.plan_dep is not null
          and r.plan_dep + interval '1 hour' <= p_now
          and r.actual_dep is null then
      v_dep := r.plan_dep + interval '1 hour';
      v_src := 'SCHEDULE_ASSUMED';
      v_reason := 'wypłynięcie przyjęte z rozkładu (brak AIS, brak odwołania)';
    end if;

    if v_dep is null then
      continue;
    end if;

    v_op := coalesce(public.eta_obs_operator_key(r.sailing_route), 'POLFERRIES');

    /* Już Prom — AIS koryguje godzinę osi (bez powiadomień, jak 0235). */
    if r.status = 'FERRY' and v_src = 'AIS' then
      begin
        select e.id, e.occurred_at, e.payload->>'source'
          into v_ev, v_ev_at, v_ev_src
          from load_events e
         where e.load_id = r.load_id
           and (
             e.event_type = 'STATUS_FERRY'
             or (e.event_type = 'STATUS_AUTO' and e.payload->>'to' = 'FERRY')
           )
           and not exists (
             select 1 from load_events z
              where z.load_id = e.load_id
                and z.payload->>'zastepuje' = e.id::text
           )
         order by e.id desc
         limit 1;
        if v_ev is not null
           and (v_ev_at is distinct from v_dep or coalesce(v_ev_src, '') is distinct from 'AIS') then
          v_prev := current_setting('tower.bulk_quiet', true);
          perform set_config('tower.bulk_quiet', 'on', true);
          insert into load_events (load_id, event_type, occurred_at, payload)
          values (
            r.load_id,
            'STATUS_AUTO',
            v_dep,
            jsonb_build_object(
              'from', 'FERRY',
              'to', 'FERRY',
              'reason', v_reason,
              'sailing_id', r.sailing_id,
              'statek', r.vessel,
              'odejscie', v_dep,
              'route', r.sailing_route,
              'operator', v_op,
              'source', 'AIS',
              'korekta', true,
              'zastepuje', v_ev,
              'poprzednio', v_ev_at,
              'actor', 'system'
            )
          );
          perform set_config('tower.bulk_quiet', coalesce(v_prev, ''), true);
        end if;
      exception when others then
        raise exception 'promote_ferry_departures AIS korekta load=%: %', r.load_id, sqlerrm;
      end;
      continue;
    end if;

    if r.status = 'FERRY' then
      continue;
    end if;

    /* #461: bez dzwonka przy AIS / SCHEDULE_ASSUMED (trg_load_status_matrix_notify × bulk_quiet). */
    v_prev := current_setting('tower.bulk_quiet', true);
    perform set_config('tower.bulk_quiet', 'on', true);
    if public.auto_set_status(
         r.load_id, r.status, 'FERRY', v_reason, v_dep,
         jsonb_build_object(
           'sailing_id', r.sailing_id,
           'statek', r.vessel,
           'odejscie', v_dep,
           'route', r.sailing_route,
           'operator', v_op,
           'source', v_src,
           'actor', 'system'
         )
       ) then
      n := n + 1;
    end if;
    perform set_config('tower.bulk_quiet', coalesce(v_prev, ''), true);
  end loop;
  return n;
end $function$;


-- 4) apply_ferry_ais_arrival_backup
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
  v_status     load_status;
  v_project    uuid;
  v_arr        timestamptz;
  v_route      text;
  v_op         text;
  v_pt         geometry(Point, 4326);
  v_port       record;
  v_in_port    boolean := false;
  v_port_m     double precision;
  v_on_land_se boolean := false;
  v_prev       text;
  v_detail     jsonb;
  v_ok         boolean := false;
begin
  if p_lat is null or p_lon is null then
    return false;
  end if;

  select l.status, l.project_id, s.actual_arrival_at, s.route
    into v_status, v_project, v_arr, v_route
    from public.loads l
    left join public.sailings s on s.id = l.sailing_id
   where l.id = p_load_id;

  if v_status is null or v_status not in ('FERRY', 'AT_PORT_NYNASHAMN') then
    return false;
  end if;
  if v_status = 'FERRY'
     and (v_arr is not null and coalesce(p_ts, now()) > v_arr) is not true then
    return false;
  end if;

  -- BN1 F7 #649: martwy strażnik eta_obs_route_family('OTHER')≠null — sprawdzaj ferry_routes.
  -- Nieznana / nieaktywna trasa: bez syntetycznego AT_PORT (dawniej return false).
  if v_route is not null
     and not exists (
       select 1 from public.ferry_routes fr
        where fr.code = upper(btrim(v_route)) and fr.active
     ) then
    return false;
  end if;
  -- Przyjazd: false tylko gdy żadna aktywna trasa rodziny nie przypływa do SE
  -- (NYN-GDN/KAA-GDY mają port_to PL, ale rodzina GDN-NYN/GDY-KAA ma SE — F7 #649 r2).
  if v_route is not null
     and not exists (
       select 1
         from public.ferry_routes fr
         join public.ferry_ports pt on pt.code = fr.port_to
        where fr.family_key = public.eta_obs_route_family(v_route)
          and fr.active
          and pt.country = 'SE'
     ) then
    return false;
  end if;

  v_op := coalesce(public.eta_obs_operator_key(v_route), 'POLFERRIES');

  -- Aktywna PORT_IN → 0298 (histereza); backup tylko gdy strefa wyłączona.
  -- BN1: dopasowanie po rodzinie trasy (nie primary operator).
  if exists (
    select 1 from public.geofences g
     where g.project_id = v_project
       and g.active
       and g.kind = 'PORT_IN'
       and g.country = 'SE'
       and public.ferry_geofence_matches_route(g.route, v_route)
  ) then
    return false;
  end if;

  v_pt := st_setsrid(st_makepoint(p_lon, p_lat), 4326);

  -- Geometria PORT_IN bez g.active (najbliższa). „W porcie” przed lądem SE (F7 r3).
  select g.id, g.name, g.geom
    into v_port
    from public.geofences g
   where g.project_id = v_project
     and g.kind = 'PORT_IN'
     and g.country = 'SE'
     and public.ferry_geofence_matches_route(g.route, v_route)
   order by st_distance(g.geom::geography, v_pt::geography)
   limit 1;

  v_detail := jsonb_build_object(
    'geofence_id', v_port.id,
    'geofence_name', v_port.name,
    'geofence_kind', 'PORT_IN',
    'source', 'AIS_ARRIVAL_BACKUP',
    'zdarzenie', 'POSITION',
    'without_geofence', true
  );

  if v_port.id is not null then
    v_in_port := st_contains(v_port.geom, v_pt);
    v_port_m := st_distance(v_port.geom::geography, v_pt::geography);
  end if;

  if v_status = 'FERRY' and v_in_port then
    v_ok := public.auto_set_status(
      p_load_id, 'FERRY', 'AT_PORT_NYNASHAMN',
      format('pozycja w strefie portu SE (%s)', coalesce(v_port.name, v_op)),
      coalesce(p_ts, now()),
      v_detail
    );
    if v_ok then
      update public.risk_signals
         set resolved_at = now()
       where load_id = p_load_id
         and dedup_key like 'FERRY_OVERDUE:' || p_load_id::text || '%'
         and resolved_at is null;
    end if;
    return coalesce(v_ok, false);
  end if;

  v_on_land_se := st_covers(public.sweden_land_geom(), v_pt);
  if v_on_land_se is not true then
    return false;
  end if;

  if v_port.id is not null and (v_port_m >= 2000) is not true then
    return false;
  end if;

  -- AT_PORT_NYNASHAMN + ≥2 km → Droga SE (F7 r3 pkt 1).
  if v_status = 'AT_PORT_NYNASHAMN' then
    v_ok := public.auto_set_status(
      p_load_id, 'AT_PORT_NYNASHAMN', 'IN_TRANSIT_SE',
      'pozycja na trasie SE po promie',
      coalesce(p_ts, now()),
      v_detail || jsonb_build_object('powod', 'pozycja na trasie SE po promie')
    );
    if coalesce(v_ok, false) then
      update public.risk_signals
         set resolved_at = now()
       where load_id = p_load_id
         and dedup_key like 'FERRY_OVERDUE:' || p_load_id::text || '%'
         and resolved_at is null;
    end if;
    return coalesce(v_ok, false);
  end if;

  -- FERRY + ≥2 km: jak 0298 — syntetyczny Port SE (quiet) + Droga SE.
  v_prev := current_setting('tower.bulk_quiet', true);
  perform set_config('tower.bulk_quiet', 'on', true);
  v_ok := public.auto_set_status(
    p_load_id, 'FERRY', 'AT_PORT_NYNASHAMN',
    'pozycja na trasie SE po promie — uzupełniony Port SE',
    least(coalesce(v_arr, p_ts), coalesce(p_ts, now())),
    v_detail || jsonb_build_object(
      'synthetic', true,
      'synthetic_port_se', true,
      'powod', 'pozycja na trasie SE po promie'
    )
  );
  perform set_config('tower.bulk_quiet', coalesce(v_prev, ''), true);

  select status into v_status from public.loads where id = p_load_id;
  if v_status = 'AT_PORT_NYNASHAMN' then
    v_ok := public.auto_set_status(
      p_load_id, 'AT_PORT_NYNASHAMN', 'IN_TRANSIT_SE',
      'pozycja na trasie SE po promie',
      coalesce(p_ts, now()),
      v_detail || jsonb_build_object('powod', 'pozycja na trasie SE po promie')
    );
  end if;

  if coalesce(v_ok, false) then
    update public.risk_signals
       set resolved_at = now()
     where load_id = p_load_id
       and dedup_key like 'FERRY_OVERDUE:' || p_load_id::text || '%'
       and resolved_at is null;
  end if;
  return coalesce(v_ok, false);
end $function$;


-- 5) refresh_load_eta
create or replace function public.refresh_load_eta(p_load uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  r record;
  l record;
  v_end timestamptz;
  v_delay int;
  v_has boolean;
  v_kind risk_kind;
  v_off numeric;
  v_max_off numeric := null;
  v_span numeric := 0;
  v_samples int := 0;
  v_blocked boolean := false;
  v_corr text;
  v_eta_ok boolean;
  v_op text;
  v_route text;
  v_stena_dual boolean := false;
begin
  select * into r from compute_load_eta(p_load);
  select * into l from loads where id = p_load;
  if not found then return; end if;

  select load_delivery_deadline(l.plan_delivery_date, l.plan_delivery_to) into v_end;
  v_delay := case when r.eta is null or v_end is null then null
                  else greatest(0, round(extract(epoch from (r.eta - v_end)) / 60))::int end;

  perform set_config('tower.eta_ctx', 'on', true);
  update loads set eta_site = r.eta, eta_confidence_min = r.conf_min, eta_basis = r.basis, eta_computed_at = now(),
         delay_minutes = v_delay
   where id = p_load
     and (eta_site is distinct from r.eta or eta_confidence_min is distinct from r.conf_min
          or (eta_basis - 'computed_at') is distinct from (r.basis - 'computed_at')
          or delay_minutes is distinct from v_delay);
  perform set_config('tower.eta_ctx', '', true);

  v_has := exists (select 1 from positions p where p.load_id = p_load)
    or l.status in (
      'READY','AT_LOADING','IN_TRANSIT_PL','AT_PORT_GDANSK',
      'FERRY','AT_PORT_NYNASHAMN','IN_TRANSIT_SE','AT_SITE'
    );
  -- #590: wyklucz CANCELLED i REMOVED (strażnik import.sh; 0315 przepisało 0298 — nie zgub przy replace)
  v_eta_ok := l3_eta_alarm(r.eta, v_end, v_has)
    and l.actual_delivery_at is null
    and l.status::text not in ('CANCELLED', 'REMOVED')
    and public.load_status_rank(l.status) < public.load_status_rank('AT_SITE'::public.load_status);

  if v_eta_ok then
    perform l3_upsert_alarm(l.project_id, p_load, 'ETA_BREACH', 'ETA_BREACH:' || p_load,
      format('Opóźnienie %s min wobec planu dostawy (próg %s)', v_delay, l3_ops('DELAY_MIN')),
      'rk_eta_breach', true, true, now() + interval '2 hours',
      jsonb_build_object('params', jsonb_build_object('minutes', v_delay, 'threshold', l3_ops('DELAY_MIN'))),
      now());
  else
    perform l3_upsert_alarm(l.project_id, p_load, 'ETA_BREACH', 'ETA_BREACH:' || p_load,
      'ETA', 'rk_eta_breach', false, false, null, '{}'::jsonb, now());
    update risk_signals set resolved_at = now()
     where load_id = p_load and kind = 'ETA_BREACH' and resolved_at is null
       and dedup_key = 'ETA_BREACH:' || p_load and coalesce(detail->>'l3', '') <> '1';
  end if;

  v_blocked := l.status = 'FERRY' or l.status not in ('IN_TRANSIT_PL', 'IN_TRANSIT_SE');
  v_op := null;
  v_route := null;
  if l.sailing_id is not null then
    select sa.route into v_route from sailings sa where sa.id = l.sailing_id;
  end if;
  v_op := public.eta_obs_operator_key(v_route);

  if l.status = 'IN_TRANSIT_SE' then
    v_kind := 'ROAD_SE'::risk_kind;
    if v_op = 'STENA' then
      v_stena_dual := true;
      v_corr := 'SE_E22'; -- etykieta domyślna; faktyczny kod z nearest
    elsif v_op = 'POLFERRIES' then
      v_corr := 'SE_E4';
    else
      v_corr := null;
    end if;
  else
    v_kind := 'ROAD_PL'::risk_kind;
    v_corr := 'PL_ROAD';
  end if;

  if v_stena_dual is not true
     and (v_corr is null
          or not exists (
            select 1 from corridor_polylines cp
             where cp.code = v_corr and coalesce(cp.total_km, 0) > 0
          )) then
    v_blocked := true;
    v_samples := 0;
    v_max_off := 0;
    v_span := 0;
  elsif v_stena_dual is true
        and not exists (
          select 1 from corridor_polylines cp
           where cp.code = 'SE_E22' and coalesce(cp.total_km, 0) > 0
        )
        and not exists (
          select 1 from corridor_polylines cp
           where cp.code = public.stena_se_inland_corridor_code()
             and coalesce(cp.total_km, 0) > 0
        ) then
    v_blocked := true;
    v_samples := 0;
    v_max_off := 0;
    v_span := 0;
  else
    if v_stena_dual is true then
      select count(*)::int,
             max(n.off_m),
             min(n.off_m),
             coalesce(extract(epoch from (max(s.ts) - min(s.ts))) / 60.0, 0),
             coalesce(bool_or(l3_in_port_or_yard(s.g)), false),
             (array_agg(n.corridor_code order by s.ts desc))[1]
        into v_samples, v_max_off, v_off, v_span, v_has, v_corr
        from (
          select ts, coalesce(geom_snapped, geom_raw) as g
            from positions
           where load_id = p_load
           order by ts desc
           limit 2
        ) s
        cross join lateral stena_se_corridor_nearest(s.g) n;
    else
      select count(*)::int,
             max(cp.off_m),
             min(cp.off_m),
             coalesce(extract(epoch from (max(s.ts) - min(s.ts))) / 60.0, 0),
             coalesce(bool_or(l3_in_port_or_yard(s.g)), false)
        into v_samples, v_max_off, v_off, v_span, v_has
        from (
          select ts, coalesce(geom_snapped, geom_raw) as g
            from positions
           where load_id = p_load
           order by ts desc
           limit 2
        ) s
        cross join lateral corridor_progress(v_corr, s.g) cp;
    end if;
    if coalesce(v_off, 0) <= l3_ops('OFFROUTE_KM') * 1000 then
      v_max_off := 0;
    end if;
    v_blocked := v_blocked or coalesce(v_has, false);
  end if;

  if l3_deviation_alarm(v_max_off, v_samples, v_span, v_blocked) then
    perform l3_upsert_alarm(l.project_id, p_load, v_kind, 'OFF_CORRIDOR:' || p_load,
      format('Zjazd z trasy z zezwolenia: %s m od korytarza OSM (próg %s m)', round(v_max_off), l3_ops('OFFROUTE_KM') * 1000),
      'rk_off_corridor', true, true, now() + interval '1 hour',
      jsonb_build_object('params', jsonb_build_object(
        'meters', round(v_max_off), 'threshold', l3_ops('OFFROUTE_KM') * 1000, 'corridor', v_corr)),
      now());
  else
    update risk_signals set resolved_at = now()
     where load_id = p_load and resolved_at is null and dedup_key = 'OFF_CORRIDOR:' || p_load;
    perform l3_lapse('OFF_CORRIDOR:' || p_load, now());
  end if;
end $$;


-- 6) ferry_sailings_map
create or replace function public.ferry_sailings_map()
returns table (
  sailing_id uuid,
  vessel_id uuid,
  vessel_name text,
  mmsi bigint,
  route text,
  status text,
  departure_at timestamptz,
  arrival_at timestamptz,
  departed_at timestamptz,
  arrived_at timestamptz,
  dep_port text,
  arr_port text,
  dep_lat double precision,
  dep_lon double precision,
  arr_lat double precision,
  arr_lon double precision,
  ais_lat double precision,
  ais_lon double precision,
  ais_observed_at timestamptz,
  ais_source text,
  ais_sog_kn real
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if (public.current_app_user_id() is null) then
    raise exception 'Brak aktywnego konta' using errcode = '42501';
  end if;
  return query
  with base as (
    select
      s.id as sailing_id,
      s.vessel_id,
      ves.name as vessel_name,
      ves.mmsi,
      s.route,
      s.status::text as status,
      s.departure_at,
      s.arrival_at,
      s.actual_departure_at as departed_at,
      s.actual_arrival_at as arrived_at,
      coalesce(fr.port_from, 'GDN') as dep_port,
      coalesce(fr.port_to, 'NYN') as arr_port
    from sailings s
    join vessels ves on ves.id = s.vessel_id
    left join ferry_routes fr on fr.code = s.route and fr.active
    where s.status is distinct from 'ODWOLANY'
      and coalesce(s.actual_departure_at, s.delayed_departure_at, s.departure_at) <= now() + interval '6 hours'
      and coalesce(s.actual_arrival_at, s.delayed_arrival_at, s.arrival_at) >= now() - interval '6 hours'
  ),
  latest_ais as (
    select distinct on (vp.vessel_id)
      vp.vessel_id,
      vp.lat,
      vp.lon,
      vp.observed_at,
      vp.source::text as source,
      vp.sog_kn
    from vessel_positions vp
    where vp.vessel_id in (select b.vessel_id from base b)
    order by vp.vessel_id, vp.observed_at desc, vp.id desc
  )
  select
    b.sailing_id,
    b.vessel_id,
    b.vessel_name,
    b.mmsi,
    b.route,
    b.status,
    b.departure_at,
    b.arrival_at,
    b.departed_at,
    b.arrived_at,
    b.dep_port,
    b.arr_port,
    pd.lat,
    pd.lon,
    pa.lat,
    pa.lon,
    la.lat,
    la.lon,
    la.observed_at,
    la.source,
    la.sog_kn
  from base b
  join ferry_ports pd on pd.code = b.dep_port
  join ferry_ports pa on pa.code = b.arr_port
  left join latest_ais la on la.vessel_id = b.vessel_id
  order by coalesce(b.departed_at, b.departure_at);
end
$$;


revoke all on function public.apply_geofence_status() from public, anon, authenticated;

revoke all on function public.promote_ferry_departures(timestamptz) from public, anon, authenticated;
grant execute on function public.promote_ferry_departures(timestamptz) to service_role;
comment on function public.promote_ferry_departures(timestamptz) is
  'BN1: FERRY po AIS/plan+1h; trasy outbound ze słownika; operator = eta_obs_operator_key.';

revoke all on function public.apply_ferry_ais_arrival_backup(uuid, double precision, double precision, timestamptz)
  from public, anon, authenticated;
grant execute on function public.apply_ferry_ais_arrival_backup(uuid, double precision, double precision, timestamptz)
  to service_role;
comment on function public.apply_ferry_ais_arrival_backup(uuid, double precision, double precision, timestamptz) is
  'BN1: Port SE/Droga SE; operator i strefa z ferry_* (rodzina trasy).';

revoke all on function public.refresh_load_eta(uuid) from public, anon, authenticated;
grant execute on function public.refresh_load_eta(uuid) to service_role;
comment on function public.refresh_load_eta(uuid) is
  'BN1: OFF_CORRIDOR — operator ze słownika; Stena dual / Polferries SE_E4 jak 0331.';

revoke all on function public.ferry_sailings_map() from public, anon;
grant execute on function public.ferry_sailings_map() to authenticated;
comment on function public.ferry_sailings_map() is
  'BN1: rejsy do mapy — porty lat/lon z ferry_ports / ferry_routes.';

commit;
