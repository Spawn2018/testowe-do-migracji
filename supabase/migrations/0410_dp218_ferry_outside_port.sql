-- DP-218 / #807 PILNE: FERRY + ATA + pierwsza pozycja poza PORT_IN (ląd ≥1 km)
-- → syntetyczny AT_PORT_NYNASHAMN → IN_TRANSIT_SE (przerwa GPS na promie).
-- Dotąd apply_ferry_ais_arrival_backup wracał false przy aktywnej PORT_IN —
-- FI (i SE w paśmie 1–2 km) zostawały „Prom” bez ETA (SG 0040).
-- Backfill stuck FERRY; detect_ferry_overdue actual → audience HHL.

begin;

-- ---------------------------------------------------------------------------
-- 1) apply_ferry_ais_arrival_backup — PORT_IN ON + ląd ≥1 km poza strefą
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
  v_status         load_status;
  v_project        uuid;
  v_arr            timestamptz;
  v_route          text;
  v_op             text;
  v_pt             geometry(Point, 4326);
  v_port           record;
  v_in_port        boolean := false;
  v_port_m         double precision;
  v_on_land        boolean := false;
  v_prev           text;
  v_detail         jsonb;
  v_ok             boolean := false;
  v_arr_country    text;
  v_land_label     text;
  v_ref            timestamptz;
  v_port_in_active boolean := false;
  v_min_m          double precision;
  v_gap_reason     text := 'pozycja po przypłynięciu poza portem (przerwa GPS na promie)';
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
  -- DP-138 / F7 #715 r2 B1:
  -- FERRY: wymaga ATA i p_ts > ATA (jak wcześniej).
  -- AT_PORT: ref = coalesce(ATA, max(occurred_at) STATUS*→AT_PORT); p_ts > ref.
  -- Brak ref → false.
  if v_status = 'FERRY' then
    if (v_arr is not null and coalesce(p_ts, now()) > v_arr) is not true then
      return false;
    end if;
  else
    v_ref := v_arr;
    if v_ref is null then
      select max(e.occurred_at) into v_ref
        from public.load_events e
       where e.load_id = p_load_id
         and e.event_type like 'STATUS%'
         and e.payload->>'to' = 'AT_PORT_NYNASHAMN';
    end if;
    if (v_ref is not null and coalesce(p_ts, now()) > v_ref) is not true then
      return false;
    end if;
  end if;

  -- Nieznana / nieaktywna trasa: bez syntetycznego AT_PORT.
  if v_route is not null
     and not exists (
       select 1 from public.ferry_routes fr
        where fr.code = upper(btrim(v_route)) and fr.active
     ) then
    return false;
  end if;

  -- B1 F7 #708: kraj tylko z outbound (0339) albo wyjątek powrotu PL↔SE (#649 r2).
  -- Powroty HEL-TLL / HELA-TLL / VUO-MUU / STO-TLL / KPS-PLD → false (bez FI/SE z rodziny).
  if v_route is null then
    v_arr_country := 'SE';
  elsif public.ferry_route_is_outbound(v_route) is true then
    select pt.country into v_arr_country
      from public.ferry_routes fr
      join public.ferry_ports pt on pt.code = fr.port_to
     where fr.code = upper(btrim(v_route))
       and fr.active
       and pt.country in ('SE', 'FI')
     limit 1;
  elsif exists (
    select 1
      from public.ferry_routes fr
      join public.ferry_ports pf on pf.code = fr.port_from
      join public.ferry_ports pt on pt.code = fr.port_to
     where fr.family_key = public.eta_obs_route_family(v_route)
       and fr.active
       and pf.country = 'PL'
       and pt.country = 'SE'
  ) then
    v_arr_country := 'SE';
  else
    return false;
  end if;

  if v_arr_country is null then
    return false;
  end if;

  v_op := coalesce(public.eta_obs_operator_key(v_route), 'POLFERRIES');
  v_land_label := case v_arr_country when 'FI' then 'FI' else 'SE' end;

  -- DP-218: aktywna PORT_IN nie blokuje już całej funkcji — tylko wejście w strefę
  -- zostaje geofence'owi; ląd ≥1 km poza PORT_IN = awaryjne FERRY→Port→Droga.
  v_port_in_active := exists (
    select 1 from public.geofences g
     where g.project_id = v_project
       and g.active
       and g.kind = 'PORT_IN'
       and g.country = v_arr_country
       and public.ferry_geofence_matches_route(g.route, v_route)
  );

  v_pt := st_setsrid(st_makepoint(p_lon, p_lat), 4326);

  select g.id, g.name, g.geom
    into v_port
    from public.geofences g
   where g.project_id = v_project
     and g.kind = 'PORT_IN'
     and g.country = v_arr_country
     and public.ferry_geofence_matches_route(g.route, v_route)
   order by st_distance(g.geom::geography, v_pt::geography)
   limit 1;

  v_detail := jsonb_build_object(
    'geofence_id', v_port.id,
    'geofence_name', v_port.name,
    'geofence_kind', 'PORT_IN',
    'source', 'AIS_ARRIVAL_BACKUP',
    'zdarzenie', 'POSITION',
    'without_geofence', true,
    'arrival_country', v_arr_country
  );

  if v_port.id is not null then
    v_in_port := st_contains(v_port.geom, v_pt);
    v_port_m := st_distance(v_port.geom::geography, v_pt::geography);
  end if;

  -- W strefie + aktywna PORT_IN → histereza geofence (GEOFENCE_ENTER).
  if v_port_in_active and v_in_port then
    return false;
  end if;

  if v_status = 'FERRY' and v_in_port then
    v_ok := public.auto_set_status(
      p_load_id, 'FERRY', 'AT_PORT_NYNASHAMN',
      format('pozycja w strefie portu %s (%s)', v_land_label, coalesce(v_port.name, v_op)),
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

  if v_arr_country = 'FI' then
    v_on_land := st_covers(public.finland_land_geom(), v_pt);
  else
    v_on_land := st_covers(public.sweden_land_geom(), v_pt);
  end if;
  if v_on_land is not true then
    return false;
  end if;

  -- DP-218: przy aktywnej PORT_IN próg 1 km; bez strefy — dotychczasowe 2 km.
  v_min_m := case when v_port_in_active then 1000 else 2000 end;
  if v_port.id is not null and (v_port_m >= v_min_m) is not true then
    return false;
  end if;

  if v_port_in_active then
    v_detail := v_detail || jsonb_build_object(
      'dp218', true,
      'source', 'GPS_FERRY_GAP',
      'powod', v_gap_reason
    );
  end if;

  -- AT_PORT_NYNASHAMN + poza portem → Droga SE (enum = droga do placu).
  if v_status = 'AT_PORT_NYNASHAMN' then
    v_ok := public.auto_set_status(
      p_load_id, 'AT_PORT_NYNASHAMN', 'IN_TRANSIT_SE',
      case when v_port_in_active then v_gap_reason
           else format('pozycja na trasie %s po promie', v_land_label) end,
      coalesce(p_ts, now()),
      v_detail || jsonb_build_object(
        'powod', case when v_port_in_active then v_gap_reason
                      else format('pozycja na trasie %s po promie', v_land_label) end
      )
    );
    if coalesce(v_ok, false) then
      update public.risk_signals
         set resolved_at = now()
       where load_id = p_load_id
         and dedup_key like 'FERRY_OVERDUE:' || p_load_id::text || '%'
         and resolved_at is null;
      begin
        perform public.refresh_load_eta(p_load_id);
      exception when others then
        raise warning 'DP-218 refresh_load_eta: %', sqlerrm;
      end;
    end if;
    return coalesce(v_ok, false);
  end if;

  -- FERRY + poza portem: syntetyczny Port przypłynięcia (quiet) + Droga SE.
  v_prev := current_setting('tower.bulk_quiet', true);
  perform set_config('tower.bulk_quiet', 'on', true);
  v_ok := public.auto_set_status(
    p_load_id, 'FERRY', 'AT_PORT_NYNASHAMN',
    case when v_port_in_active then v_gap_reason
         else format('pozycja na trasie %s po promie — uzupełniony Port %s', v_land_label, v_land_label) end,
    least(coalesce(v_arr, p_ts), coalesce(p_ts, now())),
    v_detail || jsonb_build_object(
      'synthetic', true,
      'synthetic_port_se', true,
      'powod', case when v_port_in_active then v_gap_reason
                   else format('pozycja na trasie %s po promie', v_land_label) end
    )
  );
  perform set_config('tower.bulk_quiet', coalesce(v_prev, ''), true);

  select status into v_status from public.loads where id = p_load_id;
  if v_status = 'AT_PORT_NYNASHAMN' then
    v_ok := public.auto_set_status(
      p_load_id, 'AT_PORT_NYNASHAMN', 'IN_TRANSIT_SE',
      case when v_port_in_active then v_gap_reason
           else format('pozycja na trasie %s po promie', v_land_label) end,
      coalesce(p_ts, now()),
      v_detail || jsonb_build_object(
        'powod', case when v_port_in_active then v_gap_reason
                      else format('pozycja na trasie %s po promie', v_land_label) end
      )
    );
  end if;

  if coalesce(v_ok, false) then
    update public.risk_signals
       set resolved_at = now()
     where load_id = p_load_id
       and dedup_key like 'FERRY_OVERDUE:' || p_load_id::text || '%'
       and resolved_at is null;
    begin
      perform public.refresh_load_eta(p_load_id);
    exception when others then
      raise warning 'DP-218 refresh_load_eta: %', sqlerrm;
    end;
  end if;
  return coalesce(v_ok, false);
end $function$;

revoke all on function public.apply_ferry_ais_arrival_backup(uuid, double precision, double precision, timestamptz)
  from public, anon, authenticated;
grant execute on function public.apply_ferry_ais_arrival_backup(uuid, double precision, double precision, timestamptz)
  to service_role;
comment on function public.apply_ferry_ais_arrival_backup(uuid, double precision, double precision, timestamptz) is
  'BN4/DP-138 + DP-218: FERRY+ATA; PORT_IN ON + ląd ≥1 km poza strefą → Port→Droga (luka GPS).';

-- ---------------------------------------------------------------------------
-- 2) detect_ferry_overdue — ostrzeżenie HHL po ATA+2 h nadal FERRY
-- ---------------------------------------------------------------------------
create or replace function public.detect_ferry_overdue(
  p_now timestamptz default now(),
  p_grace interval default interval '2 hours'
) returns integer
-- p_grace przestarzały: tolerancja z ferry_routes.overdue_tolerance_min (BN8b §7.3).
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  r record;
  n int := 0;
  v_code text;
  v_title text;
  v_params jsonb;
begin
  -- Zamknij overdue po przejściu do SE.
  update public.risk_signals rs
     set resolved_at = coalesce(p_now, now())
   where rs.resolved_at is null
     and rs.dedup_key like 'FERRY_OVERDUE:%'
     and exists (
       select 1 from public.loads l
        where l.id = rs.load_id
          and public.load_status_rank(l.status)
              >= public.load_status_rank('AT_PORT_NYNASHAMN'::public.load_status)
     );

  for r in
    select x.load_id, x.project_id, x.sailing_id, x.vessel,
           x.plan_arr, x.act_arr, x.tol_min, x.arr_country,
           case
             -- Ląd SE|FI po ATA → bez alarmu (ani actual, ani plan — F7 W5d / §7.3).
             when x.act_arr is not null
                  and x.arr_country in ('SE', 'FI')
                  and exists (
                    select 1 from public.positions p
                     where p.load_id = x.load_id
                       and p.ts > x.act_arr
                       and coalesce((p.raw->>'stale_point')::boolean, false) is not true
                       and (
                         (x.arr_country = 'FI'
                          and st_covers(public.finland_land_geom(), p.geom_raw::geometry))
                         or (x.arr_country = 'SE'
                             and st_covers(public.sweden_land_geom(), p.geom_raw::geometry))
                       )
                  )
             then null
             -- Powrót (arrival PL/EE): bez gałęzi „actual” — świadomie tylko SE|FI.
             when x.act_arr is not null
                  and x.arr_country in ('SE', 'FI')
                  and x.act_arr
                      + make_interval(mins => greatest(coalesce(x.tol_min, 120), 1))
                      < coalesce(p_now, now())
             then 'actual'
             when x.plan_arr
                  + make_interval(mins => greatest(coalesce(x.tol_min, 120), 1))
                  < coalesce(p_now, now())
             then 'plan'
             else null
           end as why
      from (
        select l.id as load_id, l.project_id, s.id as sailing_id, v.name as vessel,
               coalesce(s.delayed_arrival_at, s.arrival_at) as plan_arr,
               s.actual_arrival_at as act_arr,
               coalesce(fr.overdue_tolerance_min, 120) as tol_min,
               public.ferry_route_arrival_country(s.route) as arr_country
          from public.loads l
          join public.sailings s on s.id = l.sailing_id
          join public.vessels v on v.id = s.vessel_id
          left join public.ferry_routes fr on fr.code = upper(btrim(s.route)) and fr.active
         where l.status = 'FERRY'
      ) x
  loop
    if r.why is null then
      continue;
    end if;
    -- F7 r3: po ręcznym zamknięciu nie wraca.
    if exists (
      select 1 from public.risk_signals
       where dedup_key = 'FERRY_OVERDUE:' || r.load_id || ':' || r.sailing_id
         and resolved_at is not null
    ) then
      continue;
    end if;
    v_code := coalesce(
      nullif(nullif(btrim(public.load_sms_code(r.load_id)), ''), '—'),
      'transport'
    );
    if r.why = 'actual' then
      v_title := format('Sprawdź %s po dopłynięciu', v_code);
      v_params := jsonb_build_object('code', v_code, 'vessel', r.vessel,
        'arr', to_char(r.act_arr at time zone 'Europe/Warsaw', 'DD.MM HH24:MI'));
      perform public.raise_risk(
        r.load_id, 'FERRY', 'MEDIUM', v_title,
        jsonb_build_object(
          'sailing_id', r.sailing_id,
          'title_key', 'rk_ferry_check_after_arrival',
          'params', v_params,
          'why', r.why,
          'actual_arrival_at', r.act_arr,
          'audience', 'HHL'
        ),
        'FERRY_OVERDUE:' || r.load_id || ':' || r.sailing_id
      );
    else
      v_title := format(
        'Transport nadal w statusie PROM, choć %s miał przypłynąć %s',
        r.vessel,
        to_char(r.plan_arr at time zone 'Europe/Warsaw', 'DD.MM HH24:MI')
      );
      v_params := jsonb_build_object('vessel', r.vessel,
        'arr', to_char(r.plan_arr at time zone 'Europe/Warsaw', 'DD.MM HH24:MI'));
      perform public.raise_risk(
        r.load_id, 'FERRY', 'MEDIUM', v_title,
        jsonb_build_object(
          'sailing_id', r.sailing_id,
          'title_key', 'rk_ferry_overdue',
          'params', v_params,
          'why', r.why,
          'actual_arrival_at', r.act_arr
        ),
        'FERRY_OVERDUE:' || r.load_id || ':' || r.sailing_id
      );
    end if;
    n := n + 1;
  end loop;
  return n;
end $function$;
revoke all on function public.detect_ferry_overdue(timestamptz, interval)
  from public, anon, authenticated;
grant execute on function public.detect_ferry_overdue(timestamptz, interval)
  to service_role;
comment on function public.detect_ferry_overdue(timestamptz, interval) is
  'BN8b/#720 + DP-218: overdue_tolerance_min; actual → audience HHL (rk_ferry_check_after_arrival).';

-- ---------------------------------------------------------------------------
-- 3) Backfill: FERRY + ATA + ostatnia pozycja po ATA poza portem
-- ---------------------------------------------------------------------------
do $bf$
declare
  r record;
  v_lat double precision;
  v_lon double precision;
  v_ts timestamptz;
  n int := 0;
begin
  for r in
    select l.id as load_id, s.actual_arrival_at as ata
      from public.loads l
      join public.sailings s on s.id = l.sailing_id
     where l.status = 'FERRY'
       and s.actual_arrival_at is not null
  loop
    select st_y(p.geom_raw::geometry), st_x(p.geom_raw::geometry), p.ts
      into v_lat, v_lon, v_ts
      from public.positions p
     where p.load_id = r.load_id
       and p.ts > r.ata
       and coalesce((p.raw->>'stale_point')::boolean, false) is not true
     order by p.ts desc
     limit 1;

    if v_lat is null or v_lon is null then
      continue;
    end if;

    if public.apply_ferry_ais_arrival_backup(r.load_id, v_lat, v_lon, v_ts) then
      n := n + 1;
    end if;
  end loop;

  raise notice '#807 DP-218 backfill FERRY→Droga: % transportów', n;
end;
$bf$;

commit;
