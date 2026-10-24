-- #496 / D-20261024 — drobne F7 23.10 (#478, #486, #488) przed B5 / 28.10.
-- 1) SYSTEM odmowa w admin_notification_matrix_set → 42501 (jak my_notify_set).
-- 2) sweden_land_geom: bez Bałtyku przy Nynäshamn / wschód od Gotlandii.
-- 3) apply_ferry: nieznana trasa → bez zgadywania POLFERRIES; PORT_IN najbliższy.
-- 4) refresh_load_eta: tylko GDY-KAA/KAA-GDY→SE_E22, GDN-NYN/NYN-GDN→SE_E4; inaczej bez korytarza.
-- 5) SE_E22: Söderåkra + Södertälje.
-- Numer 0298: 0292–0297 zarezerwowane (#528/#530/B5/#516/#519/#525).

select set_config('tower.audit_source', 'migracja 0298 (#496 F7 drobne 23.10)', true);

-- ---------------------------------------------------------------------------
-- 1. admin_notification_matrix_set — SYSTEM → 42501
-- ---------------------------------------------------------------------------
create or replace function public.admin_notification_matrix_set(
  p_event_group text,
  p_role text,
  p_in_app boolean,
  p_email boolean,
  p_push boolean default false
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid;
  v_role text;
  v_old jsonb;
  n int;
  v_sms_gw_orphan boolean;
begin
  select id, role::text into v_me, v_role from app_users where auth_id = auth.uid() and active;
  if (v_me is not null and v_role = 'HHL_ADMIN') is not true then
    raise exception 'Macierz powiadomień — wyłącznie administrator HHL' using errcode = '42501';
  end if;
  if (p_role in ('HHL_ADMIN','HHL_OPS','CLIENT_USER','CARRIER_DISPATCH','CARRIER_USER')) is not true then
    raise exception 'Nieznana rola macierzy' using errcode = '22023';
  end if;
  if (p_event_group is not null and length(trim(p_event_group)) > 0) is not true then
    raise exception 'Nieznane zdarzenie' using errcode = '22023';
  end if;
  v_sms_gw_orphan := (
    p_event_group = 'sms_gw'
    and p_role in ('CARRIER_DISPATCH', 'CARRIER_USER', 'CLIENT_USER')
  );
  if (
    p_event_group = 'SYSTEM'
    or p_event_group in (
      'sms_gw', 'src_down', 'src_back', 'app_err', 'daily',
      'email_budget', 'fuel_miss', 'ext_mail'
    )
  ) and p_role not in ('HHL_ADMIN', 'HHL_OPS')
    and v_sms_gw_orphan is not true then
    -- #496: ten sam SQLSTATE co my_notify_set (42501), nie 22023.
    raise exception 'Zdarzenia systemowe — tylko HHL' using errcode = '42501';
  end if;

  select jsonb_agg(jsonb_build_object(
           'event_key', m.event_key, 'in_app', m.in_app, 'email', m.email, 'push', m.push
         ))
    into v_old
    from notification_matrix m
   where m.role = p_role::user_role
     and (m.event_key = p_event_group or m.event_group = p_event_group);

  update notification_matrix m
     set in_app = case when m.fixed_in_app then m.in_app else coalesce(p_in_app, false) end,
         email = case when m.fixed_email then m.email else coalesce(p_email, false) end,
         push = case when m.fixed_push then m.push else coalesce(p_push, false) end
   where m.role = p_role::user_role
     and (m.event_key = p_event_group or m.event_group = p_event_group)
     and m.risks_only is not true;
  get diagnostics n = row_count;
  if (n > 0) is not true then
    raise exception 'Nieznane zdarzenie' using errcode = '22023';
  end if;

  insert into audit_log (user_id, action, entity, entity_id, old_value, new_value)
  values (
    v_me, 'NOTIFICATION_MATRIX_SET', 'notification_matrix', p_event_group || ':' || p_role,
    v_old,
    jsonb_build_object('in_app', p_in_app, 'email', p_email, 'push', p_push)
  );
end $$;

revoke all on function public.admin_notification_matrix_set(text, text, boolean, boolean, boolean) from public, anon;
grant execute on function public.admin_notification_matrix_set(text, text, boolean, boolean, boolean) to authenticated;
comment on function public.admin_notification_matrix_set(text, text, boolean, boolean, boolean) is
  '#467+#496: SYSTEM (+fuel_miss/ext_mail) tylko HHL (42501); wyjątek sms_gw × CARRIER_*/CLIENT_USER.';

-- ---------------------------------------------------------------------------
-- 2. sweden_land_geom — bez morza przy Nynäshamn / Gotlandii
-- ---------------------------------------------------------------------------
create or replace function public.sweden_land_geom()
returns geometry
language sql
immutable
parallel safe
set search_path to 'public', 'extensions'
as $f$
  -- Karlskrona: morze 15.635/56.138 poza (krawędź ~56.145); port 15.63/56.16 w środku.
  -- Södertörn (Ösmo/Västerhaninge) w lądzie; Mysingen / 18.0/58.6 poza.
  -- Kalmar centrum (16.36/56.66) w lądzie.
  select st_setsrid(st_geomfromtext(
    'POLYGON((10.95 55.90, 12.70 55.20, 14.50 55.30, 15.20 55.90, 15.45 56.05,'
    ' 15.55 56.12, 15.62 56.145, 15.58 56.16, 15.65 56.20, 15.85 56.25,'
    ' 16.20 56.40, 16.45 56.66, 16.55 56.90, 17.00 57.50, 17.30 58.20,'
    ' 17.55 58.70, 17.80 58.85, 17.99 58.89, 18.20 59.10, 18.25 59.20,'
    ' 18.40 59.70, 18.70 60.30, 19.00 60.50, 21.00 63.00, 21.50 65.00,'
    ' 24.20 65.60, 24.00 69.06, 17.50 68.50, 11.50 63.00, 11.00 59.00,'
    ' 10.95 55.90))'
  ), 4326);
$f$;

revoke all on function public.sweden_land_geom() from public, anon, authenticated;
grant execute on function public.sweden_land_geom() to service_role;
comment on function public.sweden_land_geom() is
  '#485+#496 F7: ląd SE — Södertörn w, Mysingen/Karlskrona-morze poza.';

-- ---------------------------------------------------------------------------
-- 3. apply_ferry_se_from_position — znane trasy; bez coalesce→POLFERRIES
-- ---------------------------------------------------------------------------
create or replace function public.apply_ferry_se_from_position(
  p_load_id uuid,
  p_lat double precision,
  p_lon double precision,
  p_ts timestamptz
) returns void
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_status     load_status;
  v_project    uuid;
  v_op         text;
  v_pt         geometry(Point, 4326);
  v_port       record;
  v_in_port    boolean := false;
  v_port_m     double precision;
  v_on_land_se boolean := false;
  v_arr_at     timestamptz;
  v_arr_src    text;
  v_dep_at     timestamptz;
  v_plan_arr   timestamptz;
  v_plan_dep   timestamptz;
  v_voyage     interval;
  v_prev       text;
  v_detail     jsonb;
  v_route      text;
begin
  if p_lat is null or p_lon is null then
    return;
  end if;

  select l.status, l.project_id into v_status, v_project
    from loads l where l.id = p_load_id;
  if v_status is null or v_status not in ('FERRY', 'AT_PORT_NYNASHAMN') then
    return;
  end if;

  v_op := null;
  v_route := null;
  select s.route,
         s.actual_arrival_at,
         coalesce(s.actual_departure_at, s.delayed_departure_at, s.departure_at),
         coalesce(s.delayed_arrival_at, s.arrival_at),
         coalesce(s.delayed_departure_at, s.departure_at)
    into v_route, v_arr_at, v_dep_at, v_plan_arr, v_plan_dep
    from loads l
    left join sailings s on s.id = l.sailing_id
   where l.id = p_load_id;

  -- #496: tylko znane trasy; nieznana → bez zmiany statusu (nie zgaduj SE_E4).
  if v_route in ('GDY-KAA', 'KAA-GDY') then
    v_op := 'STENA';
  elsif v_route in ('GDN-NYN', 'NYN-GDN') then
    v_op := 'POLFERRIES';
  elsif v_route is null then
    v_op := 'POLFERRIES'; -- brak rejsu: legacy jak 0274
  else
    return;
  end if;

  if v_arr_at is not null then
    v_arr_src := 'actual';
  elsif v_dep_at is not null and v_plan_arr is not null and v_plan_dep is not null then
    v_voyage := v_plan_arr - v_plan_dep;
    if (v_voyage > interval '0') is not true then
      v_voyage := interval '10 hours';
    end if;
    v_arr_at := v_dep_at + v_voyage;
    v_arr_src := 'plan';
  else
    v_arr_at := v_plan_arr;
    v_arr_src := 'plan';
  end if;

  if (v_arr_at is not null and p_ts >= v_arr_at) is not true then
    return;
  end if;

  v_pt := st_setsrid(st_makepoint(p_lon, p_lat), 4326);
  v_on_land_se := st_covers(public.sweden_land_geom(), v_pt);

  select g.id, g.name, g.geom
    into v_port
    from geofences g
   where g.project_id = v_project
     and g.active
     and g.kind = 'PORT_IN'
     and g.country = 'SE'
     and coalesce(g.route, 'POLFERRIES') = v_op
   order by st_distance(g.geom::geography, v_pt::geography)
   limit 1;

  if v_port.id is null then
    return;
  end if;

  v_in_port := st_contains(v_port.geom, v_pt);
  v_port_m := st_distance(v_port.geom::geography, v_pt::geography);

  v_detail := jsonb_build_object(
    'geofence_id', v_port.id,
    'geofence_name', v_port.name,
    'geofence_kind', 'PORT_IN',
    'source', 'GPS',
    'zdarzenie', 'POSITION'
  );

  if v_in_port then
    if v_status = 'FERRY' then
      perform public.auto_set_status(
        p_load_id, v_status, 'AT_PORT_NYNASHAMN',
        format('pozycja w strefie portu SE (%s)', coalesce(v_port.name, v_op)),
        p_ts,
        v_detail
      );
    end if;
    return;
  end if;

  if v_on_land_se is not true then
    return;
  end if;
  if (v_port_m >= 2000) is not true then
    return;
  end if;

  if v_status = 'FERRY' then
    v_prev := current_setting('tower.bulk_quiet', true);
    perform set_config('tower.bulk_quiet', 'on', true);
    perform public.auto_set_status(
      p_load_id, 'FERRY', 'AT_PORT_NYNASHAMN',
      'pozycja na trasie SE po promie — uzupełniony Port SE',
      least(coalesce(v_arr_at, p_ts), p_ts),
      v_detail || jsonb_build_object(
        'synthetic', true,
        'synthetic_port_se', true,
        'powod', 'pozycja na trasie SE po promie',
        'arr_source', coalesce(v_arr_src, 'plan')
      )
    );
    perform set_config('tower.bulk_quiet', coalesce(v_prev, ''), true);
    select status into v_status from loads where id = p_load_id;
  end if;

  if v_status = 'AT_PORT_NYNASHAMN' then
    perform public.auto_set_status(
      p_load_id, 'AT_PORT_NYNASHAMN', 'IN_TRANSIT_SE',
      'pozycja na trasie SE po promie',
      p_ts,
      v_detail || jsonb_build_object('powod', 'pozycja na trasie SE po promie')
    );
  end if;
end $function$;

revoke all on function public.apply_ferry_se_from_position(uuid, double precision, double precision, timestamptz)
  from public, anon, authenticated;
grant execute on function public.apply_ferry_se_from_position(uuid, double precision, double precision, timestamptz)
  to service_role;
comment on function public.apply_ferry_se_from_position(uuid, double precision, double precision, timestamptz) is
  '#485+#496: Port SE / Droga SE; znane trasy; ląd SE bez Bałtyku; PORT_IN najbliższy.';

-- ---------------------------------------------------------------------------
-- 4. refresh_load_eta — nieznana trasa → bez korytarza (bez OFF_CORRIDOR)
-- ---------------------------------------------------------------------------
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
  v_eta_ok := l3_eta_alarm(r.eta, v_end, v_has)
    and l.actual_delivery_at is null
    and l.status is distinct from 'CANCELLED'
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
  -- #496: nieznana trasa → null (wcześniej else POLFERRIES → SE_E4).
  if v_route in ('GDY-KAA', 'KAA-GDY') then
    v_op := 'STENA';
  elsif v_route in ('GDN-NYN', 'NYN-GDN') then
    v_op := 'POLFERRIES';
  end if;

  if l.status = 'IN_TRANSIT_SE' then
    v_kind := 'ROAD_SE'::risk_kind;
    if v_op = 'STENA' then
      v_corr := 'SE_E22';
    elsif v_op = 'POLFERRIES' then
      v_corr := 'SE_E4';
    else
      v_corr := null;
    end if;
  else
    v_kind := 'ROAD_PL'::risk_kind;
    v_corr := 'PL_ROAD';
  end if;

  if v_corr is null
     or not exists (
       select 1 from corridor_polylines cp
        where cp.code = v_corr and coalesce(cp.total_km, 0) > 0
     ) then
    v_blocked := true;
    v_samples := 0;
    v_max_off := 0;
    v_span := 0;
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

revoke all on function public.refresh_load_eta(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. SE_E22 — Söderåkra + E4 Nyköping→Södertälje (Vagnhärad/Hölö/Järna) + Småland
-- ---------------------------------------------------------------------------
update public.corridor_polylines
   set geom = st_setsrid(st_makeline(array[
         st_makepoint(15.5866, 56.1616),  -- Karlskrona
         st_makepoint(15.95,   56.25),    -- Jämjö (E22)
         st_makepoint(16.10,   56.30),    -- Brömsebro (E22)
         st_makepoint(16.06,   56.47),    -- Söderåkra (E22) #496
         st_makepoint(16.17,   56.63),    -- Ljungbyholm (E22) F7
         st_makepoint(16.366,  56.663),   -- Kalmar
         st_makepoint(16.32,   56.87),    -- Rockneby (E22) F7
         st_makepoint(16.45,   57.26),    -- Oskarshamn (E22) F7
         st_makepoint(16.637,  57.758),   -- Västervik (E22)
         st_makepoint(16.40,   57.89),    -- Gamleby (E22)
         st_makepoint(16.32,   58.48),    -- Söderköping (E22)
         st_makepoint(16.183,  58.594),   -- Norrköping → E4
         st_makepoint(17.008,  58.753),   -- Nyköping (E4)
         st_makepoint(17.50,   58.95),    -- Vagnhärad (E4) F7
         st_makepoint(17.54,   59.03),    -- Hölö (E4) F7
         st_makepoint(17.57,   59.09),    -- Järna (E4) F7
         st_makepoint(17.628,  59.195),   -- Södertälje (E4) #496
         st_makepoint(18.0686, 59.3293),
         st_makepoint(17.6389, 59.8586),
         st_makepoint(17.1413, 60.6749),
         st_makepoint(17.1056, 61.7274),
         st_makepoint(17.3069, 62.3908),
         st_makepoint(17.9379, 62.6323),
         st_makepoint(18.7153, 63.2909),
         st_makepoint(20.2630, 63.8258),
         st_makepoint(20.9528, 64.7507),
         st_makepoint(21.4794, 65.3172),
         st_makepoint(22.1547, 65.5848),
         st_makepoint(21.7591, 65.8054)   -- Boden
       ]), 4326),
       source = 'OSM / ODbL — Karlskrona → E22 → E4 (Vagnhärad…Södertälje) → Boden (#496 F7)',
       updated_at = now()
 where code = 'SE_E22';

update public.corridor_polylines
   set total_km = round((st_length(geom::geography) / 1000.0)::numeric, 2),
       updated_at = now()
 where code = 'SE_E22';
