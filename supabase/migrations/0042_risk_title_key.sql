-- 0042 — A6-T1 (ANEKS 6, 26.09.2026): ryzyka z kluczem tłumaczenia. risk_signals.title_key + parametry w
-- detail->'params' (opcjonalnie detail->>'text_key' / 'meta_key' / 'next_action_key'). title zostaje po polsku
-- (dziennik). Każda funkcja tworząca ryzyko zapisuje klucz; funkcje Edge przekazują 'title_key' w p_detail
-- (raise_integration_risk), wyzwalacz przenosi go do kolumny. Brak klucza → 'rk_generic' + ostrzeżenie (nigdy
-- błąd — ryzyko ważniejsze niż tłumaczenie). Słowniki PL/EN/SV: src/i18n/risks.ts (test statyczny kluczy).
-- Idempotentna, niedestrukcyjna (istniejące wiersze bez klucza → rk_generic z parametrem title).

alter table risk_signals add column if not exists title_key text;

create or replace function public.risk_signals_title_key() returns trigger
language plpgsql set search_path = public as $$
begin
  new.detail := coalesce(new.detail, '{}'::jsonb);
  if new.detail ? 'title_key' then
    new.title_key := coalesce(nullif(new.title_key, ''), nullif(new.detail->>'title_key', ''));
    new.detail := new.detail - 'title_key';
  end if;
  if new.title_key is null or new.title_key = '' then
    raise warning 'risk_signals bez title_key (%, %)', new.kind, new.title;
    new.title_key := 'rk_generic';
    new.detail := new.detail || jsonb_build_object('params',
      coalesce(new.detail->'params', '{}'::jsonb) || jsonb_build_object('title', new.title));
  end if;
  if not (new.detail ? 'params') then
    new.detail := new.detail || jsonb_build_object('params', '{}'::jsonb);
  end if;
  return new;
end $$;
revoke all on function public.risk_signals_title_key() from public, anon, authenticated;
drop trigger if exists risk_signals_title_key on risk_signals;
create trigger risk_signals_title_key before insert or update on risk_signals
  for each row execute function public.risk_signals_title_key();

-- istniejące wiersze: klucz ogólny, tekst polski jako parametr (niedestrukcyjne)
update risk_signals set title_key = 'rk_generic',
       detail = detail || jsonb_build_object('params', coalesce(detail->'params', '{}'::jsonb) || jsonb_build_object('title', title))
 where title_key is null;

CREATE OR REPLACE FUNCTION public.auto_set_status(p_load uuid, p_from load_status, p_to load_status, p_reason text, p_ts timestamp with time zone, p_detail jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  begin
    update loads set status = p_to where id = p_load and status = p_from;
    if not found then return false; end if;
  exception when others then
    perform raise_risk(p_load, 'AUTO_STATUS', 'HIGH',
      format('Automatyczna zmiana statusu %s → %s zablokowana: %s', p_from, p_to, sqlerrm),
      coalesce(p_detail, '{}'::jsonb) || jsonb_build_object('from', p_from, 'to', p_to, 'blad', sqlerrm,
        'title_key', 'rk_auto_status_blocked', 'params', jsonb_build_object('from', p_from, 'to', p_to, 'error', sqlerrm)),
      'AUTOSTATUS:' || p_load || ':' || p_to);
    return false;
  end;
  insert into load_events (load_id, event_type, occurred_at, payload, dedup_key)
  values (p_load, 'STATUS_AUTO', p_ts,
          coalesce(p_detail, '{}'::jsonb) || jsonb_build_object('from', p_from, 'to', p_to, 'powod', p_reason),
          'STATUS_AUTO:' || p_load || ':' || p_to)
  on conflict (dedup_key) where dedup_key is not null do nothing;
  return true;
end $function$;

CREATE OR REPLACE FUNCTION public.apply_geofence_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_kind    geofence_kind;
  v_gid     uuid;
  v_country char(2);
  v_status  load_status;
  v_detail  jsonb;
begin
  select status into v_status from loads where id = new.load_id;
  if v_status in ('CANCELLED','UNLOADED','DELIVERED') then return null; end if;
  begin
    v_gid := (new.payload->>'geofence_id')::uuid;
  exception when others then
    return null;
  end;
  select g.kind, g.country into v_kind, v_country from geofences g where g.id = v_gid;
  if v_kind is null then return null; end if;
  v_detail := jsonb_build_object('geofence_id', new.payload->>'geofence_id',
                                 'geofence_kind', v_kind, 'zdarzenie', new.event_type);

  if new.event_type = 'GEOFENCE_ENTER' then

    if v_kind = 'LOADING' then
      if v_status = 'READY' then
        perform auto_set_status(new.load_id, v_status, 'AT_LOADING', 'wjazd w strefę załadunku', new.occurred_at, v_detail);
      elsif v_status in ('PLANNED','RESOURCES_PENDING','DOCS_PENDING') then
        perform raise_risk(new.load_id, 'AUTO_STATUS', 'HIGH',
          format('Pojazd w strefie załadunku, a transport niegotowy (status %s)', v_status),
          v_detail || jsonb_build_object('title_key', 'rk_loading_not_ready', 'params', jsonb_build_object('status', v_status)),
          'LOADING_NOT_READY:' || new.load_id);
      end if;

    elsif v_kind = 'PORT_OUT' and v_status in ('READY','AT_LOADING','IN_TRANSIT_PL') then
      if auto_set_status(new.load_id, v_status, 'AT_PORT_GDANSK', 'wjazd w strefę portu Gdańsk', new.occurred_at, v_detail)
         and not loaded_confirmed(new.load_id) then
        perform raise_risk(new.load_id, 'LOADING_UNCONFIRMED', 'MEDIUM',
          'Pojazd w porcie Gdańsk bez potwierdzenia załadunku',
          v_detail || jsonb_build_object('title_key', 'rk_port_no_loaded', 'params', '{}'::jsonb), 'PORT_NO_LOADED:' || new.load_id);
      end if;

    elsif v_kind = 'PORT_IN' and v_status = 'FERRY' then
      perform auto_set_status(new.load_id, v_status, 'AT_PORT_NYNASHAMN', 'wjazd w strefę portu Nynäshamn', new.occurred_at, v_detail);

    elsif v_kind = 'SITE' and v_status in ('FERRY','AT_PORT_NYNASHAMN','IN_TRANSIT_SE') then
      perform auto_set_status(new.load_id, v_status, 'AT_SITE', 'wjazd na plac budowy', new.occurred_at, v_detail);

    -- Awaryjnie: GPS zgubił wyjazd z portu SE albo cały pobyt w porcie
    -- (sygnał wraca dopiero na lądzie). Auto na drogach SE nie może być na promie.
    elsif v_kind in ('CHECKPOINT','PRE_ARRIVAL') and v_country = 'SE'
          and v_status in ('FERRY','AT_PORT_NYNASHAMN') then
      perform auto_set_status(new.load_id, v_status, 'IN_TRANSIT_SE',
        'pozycja na trasie SE — wyjazd z portu niezarejestrowany', new.occurred_at, v_detail);
    end if;

  elsif new.event_type = 'GEOFENCE_EXIT' then

    if v_kind = 'LOADING' and v_status = 'AT_LOADING' then
      if loaded_confirmed(new.load_id) then
        perform auto_set_status(new.load_id, v_status, 'IN_TRANSIT_PL', 'wyjazd ze strefy załadunku', new.occurred_at, v_detail);
      else
        perform raise_risk(new.load_id, 'LOADING_UNCONFIRMED', 'HIGH',
          'Pojazd opuścił strefę załadunku bez potwierdzenia załadunku — status bez zmian',
          v_detail || jsonb_build_object('title_key', 'rk_left_loading_unconfirmed', 'params', '{}'::jsonb), 'LEFT_LOADING_UNCONFIRMED:' || new.load_id);
      end if;

    elsif v_kind = 'PORT_IN' and v_status = 'AT_PORT_NYNASHAMN' then
      perform auto_set_status(new.load_id, v_status, 'IN_TRANSIT_SE', 'wyjazd ze strefy portu Nynäshamn', new.occurred_at, v_detail);
    end if;
    -- Wyjazd ze strefy portu Gdańsk po przełączeniu na PROM (statek
    -- odpływa) celowo niczego nie zmienia.
  end if;
  return null;
end $function$;

CREATE OR REPLACE FUNCTION public.detect_ferry_overdue(p_now timestamp with time zone DEFAULT now(), p_grace interval DEFAULT '02:00:00'::interval)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r record; n int := 0;
begin
  for r in
    select l.id as load_id, s.id as sailing_id, v.name as vessel,
           coalesce(s.delayed_arrival_at, s.arrival_at) as arr
      from loads l
      join sailings s on s.id = l.sailing_id
      join vessels  v on v.id = s.vessel_id
     where l.status = 'FERRY'
       and coalesce(s.delayed_arrival_at, s.arrival_at) + p_grace < p_now
  loop
    perform raise_risk(r.load_id, 'FERRY', 'MEDIUM',
      format('Transport nadal w statusie PROM, choć %s miał przypłynąć %s', r.vessel,
             to_char(r.arr at time zone 'Europe/Warsaw', 'DD.MM HH24:MI')),
      jsonb_build_object('sailing_id', r.sailing_id, 'title_key', 'rk_ferry_overdue', 'params', jsonb_build_object('vessel', r.vessel,
        'arr', to_char(r.arr at time zone 'Europe/Warsaw', 'DD.MM HH24:MI'))), 'FERRY_OVERDUE:' || r.load_id || ':' || r.sailing_id);
    n := n + 1;
  end loop;
  return n;
end $function$;

CREATE OR REPLACE FUNCTION public.promote_ferry_departures(p_now timestamp with time zone DEFAULT now())
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r record; v_inside boolean; n int := 0;
begin
  for r in
    select l.id as load_id, l.project_id, l.status, s.id as sailing_id,
           s.status as sailing_status, v.name as vessel,
           coalesce(s.delayed_departure_at, s.departure_at) as dep
      from loads l
      join sailings s on s.id = l.sailing_id and s.route = 'GDN-NYN'
      join vessels  v on v.id = s.vessel_id
     where coalesce(s.delayed_departure_at, s.departure_at) <= p_now
       and l.status in ('PLANNED','RESOURCES_PENDING','DOCS_PENDING','READY',
                        'AT_LOADING','IN_TRANSIT_PL','AT_PORT_GDANSK')
  loop
    if r.sailing_status = 'ODWOLANY' then
      perform raise_risk(r.load_id, 'FERRY', 'HIGH',
        format('Rejs %s z %s odwołany — transport wymaga nowego rejsu', r.vessel,
               to_char(r.dep at time zone 'Europe/Warsaw', 'DD.MM HH24:MI')),
        jsonb_build_object('sailing_id', r.sailing_id, 'title_key', 'rk_sailing_cancelled', 'params', jsonb_build_object('vessel', r.vessel,
          'dep', to_char(r.dep at time zone 'Europe/Warsaw', 'DD.MM HH24:MI'))), 'SAILING_CANCELLED:' || r.load_id || ':' || r.sailing_id);
      continue;
    end if;

    select exists (
      select 1 from geofence_states gs
        join geofences g on g.id = gs.geofence_id
       where gs.load_id = r.load_id and g.project_id = r.project_id
         and g.kind = 'PORT_OUT' and g.active
         and gs.entered_at is not null and gs.entered_at <= r.dep
         and (gs.state in ('INSIDE','PENDING_OUT')
              or (gs.exited_at is not null and gs.exited_at >= r.dep))
    ) into v_inside;

    if r.status = 'AT_PORT_GDANSK' and v_inside then
      if auto_set_status(r.load_id, 'AT_PORT_GDANSK', 'FERRY', 'odejście przypisanego rejsu', r.dep,
           jsonb_build_object('sailing_id', r.sailing_id, 'statek', r.vessel, 'odejscie', r.dep)) then
        n := n + 1;
      end if;
    else
      perform raise_risk(r.load_id, 'FERRY', 'HIGH',
        format('Brak potwierdzenia pozycją, że transport był w porcie Gdańsk w chwili odejścia rejsu %s %s',
               r.vessel, to_char(r.dep at time zone 'Europe/Warsaw', 'DD.MM HH24:MI')),
        jsonb_build_object('sailing_id', r.sailing_id, 'status', r.status, 'title_key', 'rk_missed_sailing', 'params', jsonb_build_object('vessel', r.vessel,
          'dep', to_char(r.dep at time zone 'Europe/Warsaw', 'DD.MM HH24:MI'))),
        'MISSED_SAILING:' || r.load_id || ':' || r.sailing_id);
    end if;
  end loop;
  return n;
end $function$;

CREATE OR REPLACE FUNCTION public.detect_silent_vehicles(p_minutes integer DEFAULT 90)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO 'public', 'extensions'
AS $function$
declare n int := 0; r record;
begin
  for r in
    select l.id, l.order_no, l.project_id, l.tractor_plate,
           max(p.ts) as last_fix
    from loads l
    left join positions p on p.load_id = l.id
    where l.status in ('IN_TRANSIT_PL','IN_TRANSIT_SE','AT_PORT_GDANSK','AT_PORT_NYNASHAMN')
    group by l.id
    having max(p.ts) is null or max(p.ts) < now() - make_interval(mins => p_minutes)
  loop
    insert into risk_signals (project_id, load_id, kind, severity, title, title_key, detail, dedup_key)
    values (
      r.project_id, r.id, 'SILENT_VEHICLE', 'MEDIUM',
      format('Brak pozycji pojazdu %s od %s min', coalesce(r.tractor_plate,'?'), p_minutes), 'rk_silent_vehicle',
      jsonb_build_object('last_fix', r.last_fix, 'threshold_min', p_minutes,
        'params', jsonb_build_object('plate', coalesce(r.tractor_plate,'?'), 'minutes', p_minutes)),
      'SILENT:' || r.id || ':' || to_char(now(), 'YYYYMMDDHH24')
    )
    on conflict (dedup_key) where dedup_key is not null and resolved_at is null do nothing;
    n := n + 1;
  end loop;
  return n;
end $function$;

CREATE OR REPLACE FUNCTION public.detect_sequence_risk(p_project uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO 'public', 'extensions'
AS $function$
declare n int := 0; r record;
begin
  for r in
    select a.id as early_id, a.shipment_code as early_code, a.assembly_seq as early_seq,
           b.shipment_code as late_code, b.assembly_seq as late_seq,
           la.plan_delivery_date as early_date, lb.plan_delivery_date as late_date
    from shipment_items a
    join loads la on la.id = a.load_id
    join shipment_items b on b.project_id = a.project_id
    join loads lb on lb.id = b.load_id
    where a.project_id = p_project
      and a.assembly_seq is not null and b.assembly_seq is not null
      and a.assembly_seq < b.assembly_seq
      and la.plan_delivery_date > lb.plan_delivery_date
      and la.status <> 'DELIVERED'
  loop
    insert into risk_signals (project_id, load_id, kind, severity, title, title_key, detail, dedup_key)
    values (
      p_project,
      (select load_id from shipment_items where id = r.early_id),
      'SEQUENCE', 'HIGH',
      format('Rozjazd kolejności montażu: %s (poz. %s) przyjedzie po %s (poz. %s)',
             r.early_code, r.early_seq, r.late_code, r.late_seq), 'rk_sequence',
      jsonb_build_object('early', r.early_code, 'late', r.late_code,
                         'early_date', r.early_date, 'late_date', r.late_date,
                         'params', jsonb_build_object('early', r.early_code, 'early_seq', r.early_seq, 'late', r.late_code, 'late_seq', r.late_seq)),
      'SEQ:' || r.early_code || ':' || r.late_code
    )
    on conflict (dedup_key) where dedup_key is not null and resolved_at is null do nothing;
    n := n + 1;
  end loop;
  return n;
end $function$;
CREATE OR REPLACE FUNCTION public.detect_missing_order_numbers(p_now timestamp with time zone DEFAULT now(), p_lead_h integer DEFAULT 48)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  r record; v_new int := 0; v_due timestamptz; v_key text; v_rows int;
begin
  for r in
    select l.id, l.project_id, l.carrier_org_id, l.status, l.hhl_order_no, l.carrier_order_no,
           coalesce(l.plan_load_from, (l.plan_load_date::timestamp at time zone 'Europe/Warsaw')) as due,
           coalesce(si.shipment_code, l.order_no, left(l.id::text, 8)) as code
      from loads l
      left join lateral (select shipment_code from shipment_items where load_id = l.id order by assembly_seq nulls last limit 1) si on true
     where l.status in ('PLANNED','RESOURCES_PENDING','DOCS_PENDING','READY')
       and coalesce(l.plan_load_from, (l.plan_load_date::timestamp at time zone 'Europe/Warsaw')) is not null
       and coalesce(l.plan_load_from, (l.plan_load_date::timestamp at time zone 'Europe/Warsaw')) <= p_now + make_interval(hours => p_lead_h)
  loop
    v_due := r.due;
    -- HHL: przed READY
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
    -- przewoźnik: przed AT_LOADING
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
end $function$;

CREATE OR REPLACE FUNCTION public.record_usage(p_metric text, p_used bigint, p_quota bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_pct numeric; v_level text; v_sev risk_severity; v_prev_high boolean; v_email boolean := false;
  v_title text; v_proj record; v_key text; v_detail jsonb;
begin
  if p_quota is null or p_quota <= 0 then raise exception 'record_usage: limit musi być dodatni'; end if;
  v_pct := round(p_used * 100.0 / p_quota, 2);
  v_level := case when v_pct >= 85 then 'HIGH' when v_pct >= 70 then 'WARN' else 'OK' end;
  insert into usage_history (metric, used, quota, level) values (p_metric, p_used, p_quota, v_level);

  select exists (select 1 from risk_signals where kind = 'USAGE_LIMIT' and resolved_at is null
                  and severity = 'HIGH' and detail->>'metric' = p_metric) into v_prev_high;

  if v_level = 'OK' then
    update risk_signals set resolved_at = now()
     where kind = 'USAGE_LIMIT' and resolved_at is null and detail->>'metric' = p_metric;
    return jsonb_build_object('metric', p_metric, 'pct', v_pct, 'level', v_level, 'email', false);
  end if;

  v_sev := case v_level when 'HIGH' then 'HIGH' else 'MEDIUM' end::risk_severity;
  v_title := 'Limit planu darmowego: ' || usage_metric_label(p_metric) || ' ' ||
             replace(to_char(v_pct, 'FM990.0'), '.', ',') || '%' ||
             case v_level when 'HIGH' then ' — przekroczone 85%' else ' — przekroczone 70%' end;
  v_detail := jsonb_build_object('metric', p_metric, 'used', p_used, 'quota', p_quota, 'pct', v_pct,
    'text', 'Zajęte ' || p_used || ' z ' || p_quota || ' (' || usage_metric_label(p_metric) || ')',
    'next_action', case p_metric when 'STORAGE_BYTES' then 'Uruchom archiwizację plików (ANEKS 4 PR7) albo podnieś plan'
                                 else 'Sprawdź zużycie w panelu Supabase i trend w usage_history' end);
  v_detail := v_detail || jsonb_build_object(
    'params', jsonb_build_object('metric', usage_metric_label(p_metric), 'metric_key', 'usage_metric_' || p_metric,
                                 'pct', round(v_pct, 1), 'used', p_used, 'quota', p_quota),
    'text_key', 'rk_usage_text',
    'next_action_key', case p_metric when 'STORAGE_BYTES' then 'rk_usage_next_storage' else 'rk_usage_next' end);
  for v_proj in select id from projects loop
    v_key := 'usage:' || p_metric || ':' || v_proj.id;
    update risk_signals set severity = v_sev, title = v_title,
           title_key = case v_level when 'HIGH' then 'rk_usage_high' else 'rk_usage_warn' end,
           detail = v_detail,
           detected_at = case when severity <> v_sev then now() else detected_at end
     where dedup_key = v_key and resolved_at is null;
    if not found then
      insert into risk_signals (project_id, kind, severity, title, title_key, detail, dedup_key)
      values (v_proj.id, 'USAGE_LIMIT', v_sev, v_title,
              case v_level when 'HIGH' then 'rk_usage_high' else 'rk_usage_warn' end, v_detail, v_key);
    end if;
  end loop;
  v_email := v_level = 'HIGH' and not v_prev_high;
  return jsonb_build_object('metric', p_metric, 'pct', v_pct, 'level', v_level, 'email', v_email, 'title', v_title);
end $function$;

CREATE OR REPLACE FUNCTION public.job_watchdog(p_now timestamp with time zone DEFAULT now())
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  w record; v_last timestamptz; v_bad boolean; v_new int; v_out jsonb := '[]'::jsonb;
  v_key text; v_title text; v_detail jsonb; v_proj record; v_mail text; v_from text; v_to text; v_url text;
begin
  for w in select * from (values
      ('ferry-ais',   interval '30 minutes', timestamptz '2026-09-26 16:30+02', false, 'AIS promów (ferry-ais)'),
      ('usage-check', interval '26 hours',   timestamptz '2026-09-27 06:00+02', false, 'kontrola limitów (usage-check)'),
      ('send-notifications', interval '30 minutes', timestamptz '2026-09-26 17:00+02', false, 'wysyłka powiadomień e-mail (send-notifications)'),
      ('backup',      interval '26 hours',   null::timestamptz,                 true,  'kopia zapasowa (backup-export)')
    ) as t(job, win, armed_from, arm_on_first_success, label)
  loop
    v_last := job_last_success(w.job);
    if w.arm_on_first_success and v_last is null then
      v_out := v_out || jsonb_build_object('job', w.job, 'stan', 'NIEUZBROJONY (brak pierwszej udanej kopii)');
      continue;
    end if;
    if w.armed_from is not null and p_now < w.armed_from + w.win and v_last is null then
      v_out := v_out || jsonb_build_object('job', w.job, 'stan', 'OKRES_STARTOWY');
      continue;
    end if;
    v_bad := v_last is null or v_last < p_now - w.win;
    if not v_bad then
      update risk_signals set resolved_at = p_now where kind = 'JOB_FAILURE' and resolved_at is null
         and detail->>'job' = w.job;
      v_out := v_out || jsonb_build_object('job', w.job, 'stan', 'OK', 'ostatni_sukces', v_last);
      continue;
    end if;
    v_title := 'Zadanie systemowe bez udanego przebiegu: ' || w.label;
    v_detail := jsonb_build_object('job', w.job, 'okno', w.win::text, 'ostatni_sukces', v_last,
      'text', 'Brak udanego przebiegu od ' || coalesce(to_char(v_last at time zone 'Europe/Warsaw', 'DD.MM.YYYY HH24:MI'), 'początku')
              || ' (okno ' || w.win::text || ')',
      'next_action', 'Sprawdź integration_runs / backup_runs i net._http_response (kod odpowiedzi funkcji Edge)',
      'params', jsonb_build_object('label', w.label, 'label_key', 'job_label_' || replace(w.job, '-', '_'),
        'since', coalesce(to_char(v_last at time zone 'Europe/Warsaw', 'DD.MM.YYYY HH24:MI'), ''), 'window', w.win::text),
      'text_key', case when v_last is null then 'rk_job_failure_text_never' else 'rk_job_failure_text' end,
      'next_action_key', 'rk_job_failure_next');
    v_new := 0;
    for v_proj in select id from projects loop
      v_key := 'job:' || w.job || ':' || v_proj.id;
      if not exists (select 1 from risk_signals where dedup_key = v_key and resolved_at is null) then
        insert into risk_signals (project_id, kind, severity, title, title_key, detail, dedup_key, detected_at)
        values (v_proj.id, 'JOB_FAILURE', 'HIGH', v_title, 'rk_job_failure', v_detail, v_key, p_now);
        v_new := v_new + 1;
      end if;
    end loop;
    v_mail := 'BEZ_ZMIAN';
    if v_new > 0 then
      v_mail := 'BRAK_SEKRETOW';
      if to_regclass('vault.decrypted_secrets') is not null and to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') is not null then
        execute $q$select max(decrypted_secret) filter (where name = 'resend_api_key'),
                          max(decrypted_secret) filter (where name = 'mail_from'),
                          max(decrypted_secret) filter (where name = 'alert_email_to')
                     from vault.decrypted_secrets$q$ into v_url, v_from, v_to;
        if v_url is not null and v_from is not null and v_to is not null then
          execute $q$select net.http_post(url := 'https://api.resend.com/emails',
                     headers := jsonb_build_object('Authorization', 'Bearer ' || $1, 'Content-Type', 'application/json'),
                     body := jsonb_build_object('from', $2, 'to', to_jsonb(string_to_array($3, ',')),
                                                'subject', '[Watch Tower] ALARM: ' || $4,
                                                'text', $4 || E'\n' || ($5->>'text') || E'\nCo zrobić: ' || ($5->>'next_action')))$q$
            using v_url, v_from, v_to, v_title, v_detail;
          v_mail := 'WYSLANY_DO_KOLEJKI';
        end if;
      end if;
    end if;
    v_out := v_out || jsonb_build_object('job', w.job, 'stan', 'ALARM', 'ostatni_sukces', v_last, 'nowe_ryzyka', v_new, 'email', v_mail);
  end loop;
  return v_out;
end $function$;
