-- BN4 pkt 8: apply_ferry_ais_arrival_backup dla FI (HEL/VUO) i nowych SE (STO/KPS).
-- 1) Kraj przypłynięcia: outbound (ferry_route_is_outbound) + wyjątek PL↔SE (NYN-GDN).
-- 2) Strefy PORT_IN i ląd wg kraju przypłynięcia.
-- 3) finland_land_geom (linia brzegowa) + Kapellskär w sweden_land_geom.
-- F7 #708 r1: B1 powroty HEL-TLL… false; B2 zatoka poza lądem.

-- ---------------------------------------------------------------------------
-- 1. finland_land_geom — brzeg ~60.14–60.17 z wcięciami terminali; zatoka poza
-- ---------------------------------------------------------------------------
create or replace function public.finland_land_geom()
returns geometry
language sql
immutable
parallel safe
set search_path to 'public', 'extensions'
as $f$
  -- South shore ~60.15; West Harbour / Katajanokka / Vuosaari notches.
  -- Poza: 60.05/25.0, tor 24.90/60.10, Suomenlinna S 24.98/60.13, VUO approach 25.20/60.15.
  select st_setsrid(st_geomfromtext(
    'POLYGON((24.30 60.22, 24.50 60.17, 24.70 60.155, 24.85 60.150,'
    ' 24.90 60.152, 24.91 60.157, 24.925 60.153, 24.94 60.155,'
    ' 24.96 60.160, 24.99 60.165, 25.05 60.170, 25.12 60.175,'
    ' 25.17 60.185, 25.19 60.200, 25.21 60.212, 25.25 60.230,'
    ' 25.35 60.28, 25.40 60.35, 25.20 60.42, 24.85 60.45,'
    ' 24.50 60.38, 24.30 60.30, 24.30 60.22))'
  ), 4326);
$f$;

revoke all on function public.finland_land_geom() from public, anon, authenticated;
grant execute on function public.finland_land_geom() to service_role;
comment on function public.finland_land_geom() is
  'BN4 0368 F7 r1: ląd FI — brzeg Helsinek/Vuosaari; Zatoka Fińska poza.';

-- ---------------------------------------------------------------------------
-- 2. sweden_land_geom — Kapellskär przycięty (~19.10); woda na wschód poza
-- ---------------------------------------------------------------------------
create or replace function public.sweden_land_geom()
returns geometry
language sql
immutable
parallel safe
set search_path to 'public', 'extensions'
as $f$
  -- Jak 0298 + BN4 F7 r1: Kapellskär (19.07/59.72) w; 19.15/59.74 i wschód poza.
  select st_setsrid(st_geomfromtext(
    'POLYGON((10.95 55.90, 12.70 55.20, 14.50 55.30, 15.20 55.90, 15.45 56.05,'
    ' 15.55 56.14, 15.60 56.152, 15.625 56.150, 15.66 56.155, 15.75 56.163,'
    ' 15.84 56.17, 15.96 56.22, 16.06 56.28, 16.10 56.38, 16.20 56.45,'
    ' 16.45 56.66, 16.55 56.90, 17.00 57.50, 17.30 58.20,'
    ' 17.55 58.70, 17.80 58.85, 17.99 58.89, 18.20 59.10, 18.25 59.20,'
    ' 18.40 59.70, 18.85 59.68, 19.02 59.71, 19.07 59.72, 19.10 59.73,'
    ' 19.09 59.75, 19.02 59.82, 18.90 60.00, 18.70 60.30, 19.00 60.50,'
    ' 21.00 63.00, 21.50 65.00,'
    ' 24.20 65.60, 24.00 69.06, 17.50 68.50, 11.50 63.00, 11.00 59.00,'
    ' 10.95 55.90))'
  ), 4326);
$f$;

revoke all on function public.sweden_land_geom() from public, anon, authenticated;
grant execute on function public.sweden_land_geom() to service_role;
comment on function public.sweden_land_geom() is
  '#485+#496 F7 + BN4 0368 F7 r1: ląd SE — Kapellskär ~19.10, morze E poza.';

-- ---------------------------------------------------------------------------
-- 3. apply_ferry_ais_arrival_backup — SE + FI (tylko outbound / wyjątek PL↔SE)
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
  v_status      load_status;
  v_project     uuid;
  v_arr         timestamptz;
  v_route       text;
  v_op          text;
  v_pt          geometry(Point, 4326);
  v_port        record;
  v_in_port     boolean := false;
  v_port_m      double precision;
  v_on_land     boolean := false;
  v_prev        text;
  v_detail      jsonb;
  v_ok          boolean := false;
  v_arr_country text;
  v_land_label  text;
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

  -- Aktywna PORT_IN w kraju przypłynięcia → histereza geofence; backup tylko gdy wyłączona.
  if exists (
    select 1 from public.geofences g
     where g.project_id = v_project
       and g.active
       and g.kind = 'PORT_IN'
       and g.country = v_arr_country
       and public.ferry_geofence_matches_route(g.route, v_route)
  ) then
    return false;
  end if;

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

  if v_port.id is not null and (v_port_m >= 2000) is not true then
    return false;
  end if;

  -- AT_PORT_NYNASHAMN + ≥2 km → Droga SE (enum = droga do placu, decyzja 25A).
  if v_status = 'AT_PORT_NYNASHAMN' then
    v_ok := public.auto_set_status(
      p_load_id, 'AT_PORT_NYNASHAMN', 'IN_TRANSIT_SE',
      format('pozycja na trasie %s po promie', v_land_label),
      coalesce(p_ts, now()),
      v_detail || jsonb_build_object(
        'powod', format('pozycja na trasie %s po promie', v_land_label)
      )
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

  -- FERRY + ≥2 km: syntetyczny Port przypłynięcia (quiet) + Droga SE.
  v_prev := current_setting('tower.bulk_quiet', true);
  perform set_config('tower.bulk_quiet', 'on', true);
  v_ok := public.auto_set_status(
    p_load_id, 'FERRY', 'AT_PORT_NYNASHAMN',
    format('pozycja na trasie %s po promie — uzupełniony Port %s', v_land_label, v_land_label),
    least(coalesce(v_arr, p_ts), coalesce(p_ts, now())),
    v_detail || jsonb_build_object(
      'synthetic', true,
      'synthetic_port_se', true,
      'powod', format('pozycja na trasie %s po promie', v_land_label)
    )
  );
  perform set_config('tower.bulk_quiet', coalesce(v_prev, ''), true);

  select status into v_status from public.loads where id = p_load_id;
  if v_status = 'AT_PORT_NYNASHAMN' then
    v_ok := public.auto_set_status(
      p_load_id, 'AT_PORT_NYNASHAMN', 'IN_TRANSIT_SE',
      format('pozycja na trasie %s po promie', v_land_label),
      coalesce(p_ts, now()),
      v_detail || jsonb_build_object(
        'powod', format('pozycja na trasie %s po promie', v_land_label)
      )
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

revoke all on function public.apply_ferry_ais_arrival_backup(uuid, double precision, double precision, timestamptz)
  from public, anon, authenticated;
grant execute on function public.apply_ferry_ais_arrival_backup(uuid, double precision, double precision, timestamptz)
  to service_role;
comment on function public.apply_ferry_ais_arrival_backup(uuid, double precision, double precision, timestamptz) is
  'BN4 0368 F7 r1: FERRY/AT_PORT → Port/Droga; outbound SE/FI + wyjątek PL↔SE.';
