-- 0254 — HOTFIX #398 / D-20261021-1820-01: szum ryzyk
-- 1) loaded_confirmed: actual_load_at (GPS) = potwierdzony załadunek
-- 2) emtrack: cisza naczepy bez SILENT/NO_POSITION; ≥ SILENT_MIN_EMTRACK → 1× LOW HHL
-- 3) ETA_BREACH: brak po dostawie / AT_SITE+ / CANCELLED
-- 4) ORDERNO: zamykanie poza oknem / statusem
-- Sprzątanie jednorazowe w tower.bulk_quiet + AUDYT17_MARK_READ.

-- ---------------------------------------------------------------------------
-- Próg SILENT_MIN_EMTRACK (720 min = 12 h)
-- ---------------------------------------------------------------------------
do $$
declare
  c text;
begin
  select con.conname into c
    from pg_constraint con
   where con.conrelid = 'public.ops_thresholds'::regclass
     and con.contype = 'c'
     and pg_get_constraintdef(con.oid) like '%WAVE_M%';
  if c is not null then
    execute format('alter table public.ops_thresholds drop constraint %I', c);
  end if;
end $$;

alter table public.ops_thresholds
  add constraint ops_thresholds_key_check check (key in (
    'WAVE_M','GUST_KN','DELAY_MIN','LEAD_DAYS',
    'AWIZ_EARLY_H','AWIZ_LATE_H','DOC_WARN_H','DOC_CRIT_H',
    'SILENT_MIN','SILENT_MIN_EMTRACK','OFFROUTE_KM',
    'DWELL_FREE_LOAD_H','DWELL_FREE_UNLOAD_H','DWELL_HOURLY_EUR','DWELL_DAILY_EUR',
    'DWELL_START_LATER','DWELL_FULL_HOUR','DWELL_DAY_AFTER_H',
    'ETA_CONF_HIGH_MIN','ETA_CONF_MED_MIN','GEOFENCE_EDGE_M','SILENT_STOP_H',
    'import_quiet_hours'
  ));

insert into public.ops_thresholds (key, value_num, unit, label_pl) values
  ('SILENT_MIN_EMTRACK', 720, 'min', 'Cisza emtrack (naczepa): próg LOW dla HHL bez decyzji')
on conflict (key) do nothing;

create or replace function public.admin_ops_threshold_set(p_key text, p_value numeric)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid;
  v_role text;
  v_old numeric;
begin
  select id, role::text into v_me, v_role from app_users where auth_id = auth.uid() and active;
  if (v_me is not null and v_role = 'HHL_ADMIN') is not true then
    raise exception 'Progi — wyłącznie administrator HHL' using errcode = '42501';
  end if;
  if (p_key in (
    'WAVE_M','GUST_KN','DELAY_MIN','LEAD_DAYS',
    'AWIZ_EARLY_H','AWIZ_LATE_H','DOC_WARN_H','DOC_CRIT_H',
    'SILENT_MIN','SILENT_MIN_EMTRACK','OFFROUTE_KM',
    'DWELL_FREE_LOAD_H','DWELL_FREE_UNLOAD_H','DWELL_HOURLY_EUR','DWELL_DAILY_EUR',
    'DWELL_START_LATER','DWELL_FULL_HOUR','DWELL_DAY_AFTER_H',
    'ETA_CONF_HIGH_MIN','ETA_CONF_MED_MIN','GEOFENCE_EDGE_M','SILENT_STOP_H',
    'import_quiet_hours'
  )) is not true then
    raise exception 'Nieznany próg' using errcode = '22023';
  end if;
  if p_key = 'import_quiet_hours' then
    if (p_value is not null and p_value in (0, 1)) is not true then
      raise exception 'import_quiet_hours: 0 lub 1' using errcode = '22023';
    end if;
  elsif (p_value is not null and p_value > 0) is not true then
    raise exception 'Wartość progu musi być > 0' using errcode = '22023';
  end if;

  select value_num into v_old from ops_thresholds where key = p_key for update;
  if (v_old is not null) is not true then
    raise exception 'Brak wiersza progu' using errcode = 'P0002';
  end if;

  update ops_thresholds
     set value_num = p_value, updated_at = now(), updated_by = v_me
   where key = p_key;

  insert into audit_log (user_id, action, entity, entity_id, new_value)
  values (v_me, 'OPS_THRESHOLD_SET', 'ops_thresholds', p_key,
          jsonb_build_object('from', v_old, 'to', p_value));
end;
$$;

revoke all on function public.admin_ops_threshold_set(text, numeric) from public, anon;
grant execute on function public.admin_ops_threshold_set(text, numeric) to authenticated;

-- ---------------------------------------------------------------------------
-- 1. loaded_confirmed — GPS / actual_load_at
-- ---------------------------------------------------------------------------
create or replace function public.loaded_confirmed(p_load uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from load_events
     where load_id = p_load and event_type = 'MILESTONE_LOADED'
  )
  or exists (
    select 1 from loads
     where id = p_load and actual_load_at is not null
  )
$$;

revoke all on function public.loaded_confirmed(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- audience: emtrack LONG SILENT → tylko HHL
-- ---------------------------------------------------------------------------
create or replace function public.risk_audience_for(p_kind text, p_detail jsonb)
returns risk_audience language plpgsql stable security definer set search_path = public as $$
declare v_dir text; v_inv text;
begin
  if p_kind = 'SILENT_VEHICLE' and coalesce(p_detail->>'emtrack_trailer', '') = '1' then
    return 'HHL';
  end if;
  if p_kind in ('FERRY', 'ROAD_SE', 'ROAD_PL', 'WEATHER', 'ETA_BREACH') then
    return 'WSZYSCY';
  end if;
  if p_kind = 'RESOURCE_MISSING' and coalesce(p_detail->>'rule', '') = 'ORDER_NO'
     and coalesce(p_detail->>'side', '') = 'HHL' then
    return 'HHL';
  end if;
  if p_kind in ('SILENT_VEHICLE', 'AUTO_STATUS', 'LOADING_UNCONFIRMED', 'RESOURCE_MISSING',
                'DOC_MISSING', 'PERMIT', 'INSURANCE') then
    return 'HHL_PRZEWOZNIK';
  end if;
  if p_kind = 'SEQUENCE' then
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

revoke all on function public.risk_audience_for(text, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- l1_decision_type: emtrack LONG SILENT bez NO_POSITION
-- ---------------------------------------------------------------------------
create or replace function public.l1_decision_type(p_kind text, p_detail jsonb)
returns text
language sql
stable
set search_path = public
as $$
  select case
    when p_kind = 'RESOURCE_MISSING' and coalesce(p_detail->>'rule', '') = 'L3_AWIZ' then 'NO_AWIZACJA'
    when p_kind = 'RESOURCE_MISSING' and coalesce(p_detail->>'rule', '') = 'L3_NO_SAILING' then 'NO_SAILING'
    when p_kind = 'RESOURCE_MISSING' and coalesce(p_detail->>'rule', '') = 'L3_NO_TRACKING' then 'NO_TRACKING'
    when p_kind = 'RESOURCE_MISSING' and coalesce(p_detail->>'rule', '') = 'L3_NO_AWIZ_SE' then 'NO_AWIZ_SE'
    when p_kind = 'DOC_MISSING' and coalesce(p_detail->>'rule', '') = 'L3_DOC' then 'DOC_MISSING'
    when p_kind = 'DOC_MISSING' then 'DOC_MISSING'
    when p_kind = 'PERMIT' then 'DOC_MISSING'
    when p_kind = 'INSURANCE' then 'INSURANCE_EXPIRING'
    when p_kind = 'ETA_BREACH' then 'ETA_AFTER_LATEST'
    when p_kind = 'LATE_DATE_CHANGE' then 'KSH_DATE_LT_5D'
    when p_kind = 'SILENT_VEHICLE' and coalesce(p_detail->>'emtrack_trailer', '') = '1' then null
    when p_kind = 'SILENT_VEHICLE' then 'NO_POSITION'
    when p_kind = 'INVOICE_MISMATCH' then 'SEFS_INVOICE_DIFF'
    when p_kind = 'WEATHER' then 'FERRY_CANCELLED'
    when p_kind = 'FERRY' and coalesce(p_detail->>'title_key', '') = 'rk_sailing_cancelled' then 'FERRY_CANCELLED'
    when p_kind in ('ROAD_PL', 'ROAD_SE') and coalesce(p_detail->>'title_key', '') = 'rk_off_corridor' then 'ROUTE_DEVIATION'
    when p_kind = 'JOB_FAILURE' and coalesce(p_detail->>'source', '') = 'backup' then 'BACKUP_FAILED'
    else null
  end;
$$;

revoke all on function public.l1_decision_type(text, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. detect_silent_vehicles — gałąź EMTRACK_WEB
-- ---------------------------------------------------------------------------
create or replace function public.detect_silent_vehicles(p_minutes integer default 90)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n int := 0;
  r record;
  v_min int;
  v_em int;
  v_connected boolean;
  v_moving boolean;
  v_last_ts timestamptz;
  v_src text;
  v_em_due boolean;
  v_rid uuid;
  v_rows int;
begin
  perform l1b_scan();
  perform dwell_scan(null, now());
  v_min := l3_ops('SILENT_MIN')::int;
  v_em := coalesce(l3_ops('SILENT_MIN_EMTRACK')::int, 720);
  if v_min is null then
    return 0;
  end if;

  for r in
    select s.id, s.dedup_key
      from risk_signals s
      join loads l on s.dedup_key = 'SILENT:' || l.id::text
     where s.resolved_at is null
       and public.load_in_tracking_window(l.id, now()) is not true
  loop
    update risk_signals set resolved_at = now() where id = r.id;
    perform l3_lapse(r.dedup_key, now());
  end loop;

  for r in
    select l.id, l.project_id, l.tractor_plate, l.status, l.telematics_vehicle_id
      from loads l
     where public.load_in_tracking_window(l.id, now())
  loop
    v_moving := r.status in ('IN_TRANSIT_PL', 'AT_PORT_GDANSK', 'AT_PORT_NYNASHAMN', 'IN_TRANSIT_SE');
    select p.ts, p.source::text
      into v_last_ts, v_src
      from positions p
     where p.load_id = r.id
     order by p.ts desc
     limit 1;
    v_connected := r.telematics_vehicle_id is not null or v_last_ts is not null;

    if v_src = 'EMTRACK_WEB' then
      v_em_due := v_moving is true
        and v_em is not null
        and (v_last_ts is null or v_last_ts < now() - make_interval(mins => v_em));
      if v_em_due is not true then
        update risk_signals set resolved_at = now()
         where dedup_key = 'SILENT:' || r.id and resolved_at is null;
        if found then
          perform l3_lapse('SILENT:' || r.id, now());
        end if;
        continue;
      end if;
      -- ≥ SILENT_MIN_EMTRACK: jedno LOW dla HHL, bez decyzji (emtrack_trailer=1)
      select id into v_rid
        from risk_signals
       where dedup_key = 'SILENT:' || r.id and resolved_at is null
       limit 1;
      if v_rid is null then
        insert into risk_signals (
          project_id, load_id, kind, severity, title, title_key, detail, dedup_key, detected_at
        ) values (
          r.project_id, r.id, 'SILENT_VEHICLE', 'LOW',
          format('Brak pozycji naczepy (emtrack) %s od %s h',
                 coalesce(r.tractor_plate, '?'), round(v_em / 60.0)::int),
          'rk_silent_vehicle',
          jsonb_build_object(
            'emtrack_trailer', '1',
            'last_fix', v_last_ts,
            'threshold_min', v_em,
            'params', jsonb_build_object(
              'plate', coalesce(r.tractor_plate, '?'),
              'minutes', v_em,
              'source', 'EMTRACK_WEB'
            )
          ),
          'SILENT:' || r.id,
          now()
        )
        on conflict (dedup_key) where dedup_key is not null and resolved_at is null do nothing;
        get diagnostics v_rows = row_count;
        n := n + v_rows;
      else
        update risk_signals
           set severity = 'LOW',
               title = format('Brak pozycji naczepy (emtrack) %s od %s h',
                              coalesce(r.tractor_plate, '?'), round(v_em / 60.0)::int),
               detail = coalesce(detail, '{}'::jsonb) || jsonb_build_object(
                 'emtrack_trailer', '1',
                 'last_fix', v_last_ts,
                 'threshold_min', v_em,
                 'params', jsonb_build_object(
                   'plate', coalesce(r.tractor_plate, '?'),
                   'minutes', v_em,
                   'source', 'EMTRACK_WEB'
                 )
               )
         where id = v_rid;
      end if;
      continue;
    end if;

    if l3_silent_alarm(v_last_ts, now(), v_connected, v_moving) is not true then
      update risk_signals set resolved_at = now()
       where dedup_key = 'SILENT:' || r.id and resolved_at is null and detail->>'l3' = '1';
      if found then
        perform l3_lapse('SILENT:' || r.id, now());
      end if;
      continue;
    end if;
    n := n + l3_upsert_alarm(
      r.project_id, r.id, 'SILENT_VEHICLE', 'SILENT:' || r.id,
      format('Brak pozycji pojazdu %s od %s min', coalesce(r.tractor_plate, '?'), v_min),
      'rk_silent_vehicle',
      true,
      true,
      now() + interval '1 hour',
      jsonb_build_object(
        'last_fix', v_last_ts, 'threshold_min', v_min,
        'params', jsonb_build_object('plate', coalesce(r.tractor_plate, '?'), 'minutes', v_min)
      ),
      now()
    );
  end loop;
  return n;
end $$;

revoke all on function public.detect_silent_vehicles(integer) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. refresh_load_eta — bez alarmu po dostawie / AT_SITE+
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
  v_corr := case when l.status = 'IN_TRANSIT_SE' then 'SE_E4' else 'PL_ROAD' end;
  v_kind := case when l.status = 'IN_TRANSIT_SE' then 'ROAD_SE'::risk_kind else 'ROAD_PL'::risk_kind end;
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
-- 4. detect_missing_order_numbers — zamykanie poza oknem / statusem
-- ---------------------------------------------------------------------------
create or replace function public.detect_missing_order_numbers(
  p_now timestamp with time zone default now(),
  p_lead_h integer default 48
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r record; v_new int := 0; v_due timestamptz; v_key text; v_rows int;
  v_anchor timestamptz;
  v_close boolean;
begin
  -- zamknięcie otwartych poza oknem / statusem
  for r in
    select s.id, s.dedup_key, l.status, l.plan_load_date, l.plan_load_from
      from risk_signals s
      join loads l on l.id = s.load_id
     where s.resolved_at is null
       and s.dedup_key like 'ORDERNO:%'
  loop
    v_anchor := coalesce(r.plan_load_from, (r.plan_load_date::timestamp at time zone 'Europe/Warsaw'));
    v_close := false;
    if v_anchor is null or v_anchor > p_now + make_interval(hours => p_lead_h) then
      v_close := true;
    elsif r.status::text not in ('PLANNED','RESOURCES_PENDING','DOCS_PENDING','READY') then
      v_close := true;
    elsif r.dedup_key like 'ORDERNO:CARRIER:%'
      and public.load_status_rank(r.status) >= public.load_status_rank('AT_LOADING'::public.load_status)
    then
      v_close := true;
    end if;
    if v_close then
      update risk_signals set resolved_at = p_now where id = r.id and resolved_at is null;
    end if;
  end loop;

  for r in
    select l.id, l.project_id, l.carrier_org_id, l.status, l.hhl_order_no, l.carrier_order_no,
           coalesce(l.plan_load_from, (l.plan_load_date::timestamp at time zone 'Europe/Warsaw')) as due,
           coalesce(si.shipment_code, l.order_no, left(l.id::text, 8)) as code
      from loads l
      left join lateral (
        select shipment_code from shipment_items where load_id = l.id
         order by assembly_seq nulls last limit 1
      ) si on true
     where l.status in ('PLANNED','RESOURCES_PENDING','DOCS_PENDING','READY')
       and coalesce(l.plan_load_from, (l.plan_load_date::timestamp at time zone 'Europe/Warsaw')) is not null
       and coalesce(l.plan_load_from, (l.plan_load_date::timestamp at time zone 'Europe/Warsaw'))
           <= p_now + make_interval(hours => p_lead_h)
  loop
    v_due := r.due;
    if r.status <> 'READY' and (r.hhl_order_no is null or btrim(r.hhl_order_no) = '') then
      v_key := 'ORDERNO:HHL:' || r.id;
      insert into risk_signals (project_id, load_id, kind, severity, title, title_key, detail, dedup_key)
      values (r.project_id, r.id, 'RESOURCE_MISSING', case when v_due <= p_now then 'CRITICAL' else 'HIGH' end::risk_severity,
              r.code || ': brak numeru zlecenia HHL', 'rk_order_no_hhl',
              jsonb_build_object('rule', 'ORDER_NO', 'side', 'HHL', 'owner', 'HHL', 'due', v_due,
                'text', 'Numer zlecenia HHL jest obowiązkowy przed statusem GOTOWY (W12).',
                'meta', 'Odpowiada: HHL', 'next_action', 'Wpisz numer zlecenia HHL w szufladzie transportu',
                'params', jsonb_build_object('code', r.code), 'text_key', 'rk_order_no_hhl_text',
                'meta_key', 'risk_meta_hhl', 'next_action_key', 'rk_order_no_hhl_next'),
              v_key)
      on conflict (dedup_key) where dedup_key is not null and resolved_at is null do nothing;
      get diagnostics v_rows = row_count; v_new := v_new + v_rows;
      if v_rows > 0 then
        insert into notifications (channel, recipient, user_id, load_id, template, payload, dedup_key)
        select 'IN_APP', coalesce(u.email::text, u.id::text), u.id, r.id, 'ORDER_NO_MISSING',
               jsonb_build_object('side', 'HHL', 'code', r.code, 'due', v_due, 'locale', u.locale),
               v_key || ':' || u.id || ':' || to_char(v_due, 'YYYYMMDD')
          from app_users u join organizations o on o.id = u.org_id
         where o.kind = 'FORWARDER' and u.active
        on conflict (dedup_key) where dedup_key is not null do nothing;
      end if;
    end if;
    if r.carrier_org_id is not null and (r.carrier_order_no is null or btrim(r.carrier_order_no) = '') then
      v_key := 'ORDERNO:CARRIER:' || r.id;
      insert into risk_signals (project_id, load_id, kind, severity, title, title_key, detail, dedup_key)
      values (r.project_id, r.id, 'RESOURCE_MISSING', case when v_due <= p_now then 'CRITICAL' else 'HIGH' end::risk_severity,
              r.code || ': brak numeru zlecenia przewoźnika', 'rk_order_no_carrier',
              jsonb_build_object('rule', 'ORDER_NO', 'side', 'CARRIER', 'owner', 'SCX', 'due', v_due,
                'text', 'Numer zlecenia przewoźnika jest obowiązkowy przed załadunkiem (W12).',
                'meta', 'Odpowiada: przewoźnik', 'next_action', 'Wpisz numer zlecenia przewoźnika w szufladzie transportu',
                'params', jsonb_build_object('code', r.code), 'text_key', 'rk_order_no_carrier_text',
                'meta_key', 'risk_meta_carrier', 'next_action_key', 'rk_order_no_carrier_next'),
              v_key)
      on conflict (dedup_key) where dedup_key is not null and resolved_at is null do nothing;
      get diagnostics v_rows = row_count; v_new := v_new + v_rows;
      if v_rows > 0 then
        insert into notifications (channel, recipient, user_id, load_id, template, payload, dedup_key)
        select 'IN_APP', coalesce(u.email::text, u.id::text), u.id, r.id, 'ORDER_NO_MISSING',
               jsonb_build_object('side', 'CARRIER', 'code', r.code, 'due', v_due, 'locale', u.locale),
               v_key || ':' || u.id || ':' || to_char(v_due, 'YYYYMMDD')
          from app_users u
         where u.org_id = r.carrier_org_id and u.active
        on conflict (dedup_key) where dedup_key is not null do nothing;
      end if;
    end if;
  end loop;
  return v_new;
end $$;

revoke all on function public.detect_missing_order_numbers(timestamptz, integer) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Jednorazowe sprzątanie produkcji (bulk_quiet) + audyt
-- ---------------------------------------------------------------------------
do $cleanup$
declare
  r record;
  v_now timestamptz := now();
  v_prev text;
  v_risk_ids uuid[] := '{}';
  v_dec_ids uuid[] := '{}';
begin
  insert into audit_log (user_id, action, entity, entity_id, new_value)
  select null, 'HOTFIX_398_BEFORE', 'risk_signals', '0254',
         jsonb_build_object(
           'port_no_loaded_open',
           (select count(*) from risk_signals s
              join loads l on l.id = s.load_id
             where s.resolved_at is null and s.dedup_key like 'PORT_NO_LOADED%'
               and l.actual_load_at is not null),
           'silent_emtrack_open',
           (select count(*) from risk_signals s
             where s.resolved_at is null and s.kind = 'SILENT_VEHICLE'
               and (
                 select p.source::text from positions p
                  where p.load_id = s.load_id
                  order by p.ts desc limit 1
               ) = 'EMTRACK_WEB'),
           'eta_breach_delivered_open',
           (select count(*) from risk_signals s
              join loads l on l.id = s.load_id
             where s.resolved_at is null and s.kind = 'ETA_BREACH'
               and (l.actual_delivery_at is not null
                    or public.load_status_rank(l.status) >= public.load_status_rank('AT_SITE'::public.load_status)
                    or l.status = 'CANCELLED')),
           'orderno_open',
           (select count(*) from risk_signals where resolved_at is null and dedup_key like 'ORDERNO:%')
         );

  v_prev := current_setting('tower.bulk_quiet', true);
  perform set_config('tower.bulk_quiet', 'on', true);

  -- 1) PORT_NO_LOADED przy actual_load_at
  for r in
    select s.id
      from risk_signals s
      join loads l on l.id = s.load_id
     where s.resolved_at is null
       and (s.dedup_key like 'PORT_NO_LOADED%' or s.kind = 'LOADING_UNCONFIRMED')
       and l.actual_load_at is not null
  loop
    update risk_signals set resolved_at = v_now where id = r.id and resolved_at is null;
    v_risk_ids := array_append(v_risk_ids, r.id);
    insert into audit_log (user_id, action, entity, entity_id, new_value)
    values (null, 'RISK_AUTO_CLOSED', 'risk_signals', r.id::text,
            jsonb_build_object('reason', 'PORT_NO_LOADED z actual_load_at', 'hotfix', '0254'));
  end loop;

  -- 2) SILENT + NO_POSITION przy ostatniej pozycji EMTRACK_WEB (i decision-overdue)
  for r in
    select s.id as risk_id, d.id as decision_id, s.load_id
      from risk_signals s
      left join decisions d on d.risk_id = s.id and d.status in ('NEW','ASSIGNED','SNOOZED')
     where s.resolved_at is null
       and s.kind = 'SILENT_VEHICLE'
       and exists (
         select 1 from lateral (
           select p.source::text as src
             from positions p where p.load_id = s.load_id
            order by p.ts desc limit 1
         ) lp where lp.src = 'EMTRACK_WEB'
       )
  loop
    update risk_signals set resolved_at = v_now where id = r.risk_id and resolved_at is null;
    v_risk_ids := array_append(v_risk_ids, r.risk_id);
    perform l3_lapse('SILENT:' || r.load_id, v_now);
    if r.decision_id is not null then
      update decisions
         set status = 'RESOLVED', resolution_code = 'AUTO_CLOSED', resolved_at = v_now, updated_at = v_now
       where id = r.decision_id and status in ('NEW','ASSIGNED','SNOOZED');
      insert into decision_events (decision_id, actor_id, action, payload)
      values (r.decision_id, null, 'RESOLVE',
              jsonb_build_object('option', 'AUTO_CLOSED', 'effect', 'AUTO_CLOSED',
                                 'hotfix', '0254', 'reason', 'emtrack — brak sygnału naczepy'));
      v_dec_ids := array_append(v_dec_ids, r.decision_id);
      insert into audit_log (user_id, action, entity, entity_id, new_value)
      values (null, 'DECISION_AUTO_CLOSED', 'decisions', r.decision_id::text,
              jsonb_build_object('reason', 'emtrack SILENT', 'hotfix', '0254', 'risk_id', r.risk_id));
    else
      insert into audit_log (user_id, action, entity, entity_id, new_value)
      values (null, 'RISK_AUTO_CLOSED', 'risk_signals', r.risk_id::text,
              jsonb_build_object('reason', 'emtrack SILENT', 'hotfix', '0254'));
    end if;
  end loop;

  -- decision-overdue powiązane z zamkniętymi decyzjami NO_POSITION
  for r in
    select s.id
      from risk_signals s
     where s.resolved_at is null
       and (
         s.dedup_key like 'decision-overdue:%'
         or s.title_key = 'rk_decision_overdue'
       )
       and (
         (s.detail->>'decision_id')::uuid = any (v_dec_ids)
         or exists (
           select 1 from unnest(v_dec_ids) x
            where s.dedup_key like '%' || x::text || '%'
         )
       )
  loop
    update risk_signals set resolved_at = v_now where id = r.id and resolved_at is null;
    v_risk_ids := array_append(v_risk_ids, r.id);
  end loop;

  -- 3) ETA_BREACH po dostawie
  for r in
    select s.id
      from risk_signals s
      join loads l on l.id = s.load_id
     where s.resolved_at is null
       and s.kind = 'ETA_BREACH'
       and (
         l.actual_delivery_at is not null
         or l.status = 'CANCELLED'
         or public.load_status_rank(l.status) >= public.load_status_rank('AT_SITE'::public.load_status)
       )
  loop
    update risk_signals set resolved_at = v_now where id = r.id and resolved_at is null;
    perform l3_lapse('ETA_BREACH:' || (select load_id from risk_signals where id = r.id), v_now);
    v_risk_ids := array_append(v_risk_ids, r.id);
    insert into audit_log (user_id, action, entity, entity_id, new_value)
    values (null, 'RISK_AUTO_CLOSED', 'risk_signals', r.id::text,
            jsonb_build_object('reason', 'ETA_BREACH po dostawie', 'hotfix', '0254'));
  end loop;

  -- 4) ORDERNO poza oknem — wywołanie funkcji zamyka
  perform public.detect_missing_order_numbers(v_now, 48);

  if cardinality(v_dec_ids) > 0 then
    with marked as (
      update notifications n
         set read_at = coalesce(n.read_at, v_now)
       where n.read_at is null
         and (
           n.payload->>'decision_id' = any (select x::text from unnest(v_dec_ids) x)
           or n.dedup_key like any (select '%:' || x::text || '%' from unnest(v_dec_ids) x)
         )
      returning n.id
    )
    insert into audit_log (user_id, action, entity, entity_id, new_value)
    select null, 'AUDYT17_MARK_READ', 'notifications', 'hotfix-0254',
           jsonb_build_object(
             'count', count(*),
             'notification_ids', coalesce(jsonb_agg(id), '[]'::jsonb),
             'decision_ids', to_jsonb(v_dec_ids),
             'hotfix', '0254',
             'reason', 'emtrack SILENT AUTO_CLOSED')
      from marked;
  end if;

  perform set_config('tower.bulk_quiet', coalesce(v_prev, ''), true);

  insert into audit_log (user_id, action, entity, entity_id, new_value)
  values (null, 'HOTFIX_398_AFTER', 'risk_signals', '0254',
          jsonb_build_object(
            'risks_closed', cardinality(v_risk_ids),
            'decisions_closed', cardinality(v_dec_ids),
            'hotfix', '0254'
          ));
end
$cleanup$;
