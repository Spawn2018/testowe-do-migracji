-- =====================================================================
-- TOWER — Migracja 0143: L-3 progi z tabeli Opcji
--
-- Wzory: polecenie 2026-10-04 00:07 (czas warszawski), LOGIKA §4.
-- Jedno źródło liczb: ops_thresholds. Duplikaty DELAY_MIN, OFF_CORRIDOR_M
-- i DATE_CONFIRM_DAYS z app_parameters oraz godziny DRIVER/VEHICLE/DOCS
-- z resource_deadlines znikają.
-- Ostrzeżenie i próg krytyczny (awizacja, dokumenty) = jedna decyzja.
-- Termin decyzji = moment krytyczny. Poziom krytyczny: ta sama decyzja,
-- powiadomienie tylko w aplikacji (do L-13).
-- Warunek ustał → status EXPIRED, notatka „nieaktualna — warunek ustał",
-- zapis systemu w decision_events. To nie jest rozstrzygnięcie (resolved_by null).
--
-- STOP (nie zgadywać): kierowca dostarczający nie ma kolumny w bazie
-- (osobne pola są w C-SEP, niezaczęte). Wzór A dla dostawy nie otwiera
-- alarmu, żeby nie krzyczeć na każdym transporcie bez miejsca na zapis.
-- Wzór A dla załadunku: kierowca, telefon, ciągnik, naczepa.
-- =====================================================================

create or replace function public.l3_ops(p_key text)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select value_num from ops_thresholds where key = p_key
$$;
revoke all on function public.l3_ops(text) from public, anon, authenticated;

create or replace function public.l3_anchor(p_date date, p_ts timestamptz)
returns timestamptz
language sql
immutable
set search_path = public
as $$
  select coalesce(
    p_ts,
    case when p_date is null then null
         else (p_date::timestamp at time zone 'Europe/Warsaw')
    end
  )
$$;
revoke all on function public.l3_anchor(date, timestamptz) from public, anon, authenticated;

create or replace function public.l3_moment(p_anchor timestamptz, p_key text)
returns timestamptz
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_anchor is null or l3_ops(p_key) is null then null
    else p_anchor - make_interval(hours => l3_ops(p_key)::int)
  end
$$;
revoke all on function public.l3_moment(timestamptz, text) from public, anon, authenticated;

create or replace function public.l3_eta_alarm(p_eta timestamptz, p_end timestamptz, p_has_data boolean)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_has_data is true
     and p_eta is not null
     and p_end is not null
     and l3_ops('DELAY_MIN') is not null
     and p_eta > p_end + make_interval(mins => l3_ops('DELAY_MIN')::int)
$$;
revoke all on function public.l3_eta_alarm(timestamptz, timestamptz, boolean) from public, anon, authenticated;

create or replace function public.l3_lead_alarm(p_earlier timestamptz, p_now timestamptz)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_earlier is not null
     and p_now is not null
     and l3_ops('LEAD_DAYS') is not null
     and p_earlier < p_now + make_interval(days => l3_ops('LEAD_DAYS')::int)
$$;
revoke all on function public.l3_lead_alarm(timestamptz, timestamptz) from public, anon, authenticated;

create or replace function public.l3_silent_alarm(
  p_last timestamptz, p_now timestamptz, p_connected boolean, p_moving boolean
) returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_connected is true
     and p_moving is true
     and p_now is not null
     and l3_ops('SILENT_MIN') is not null
     and (p_last is null or p_last < p_now - make_interval(mins => l3_ops('SILENT_MIN')::int))
$$;
revoke all on function public.l3_silent_alarm(timestamptz, timestamptz, boolean, boolean) from public, anon, authenticated;

create or replace function public.l3_deviation_alarm(
  p_meters numeric, p_samples int, p_span_min numeric, p_blocked boolean
) returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_blocked is not true
     and coalesce(p_samples, 0) >= 2
     and coalesce(p_span_min, 0) >= 10
     and p_meters is not null
     and l3_ops('OFFROUTE_KM') is not null
     and p_meters > l3_ops('OFFROUTE_KM') * 1000
$$;
revoke all on function public.l3_deviation_alarm(numeric, int, numeric, boolean) from public, anon, authenticated;

create or replace function public.l3_in_port_or_yard(p_geom geometry)
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $$
  select p_geom is not null and exists (
    select 1 from geofences g
     where g.active
       and g.kind in ('PORT_OUT', 'PORT_IN', 'SITE')
       and st_intersects(g.geom, p_geom)
  )
$$;
revoke all on function public.l3_in_port_or_yard(geometry) from public, anon, authenticated;

create or replace function public.l3_lapse(p_event_key text, p_now timestamptz)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_note text := 'nieaktualna — warunek ustał';
begin
  for r in
    update decisions
       set status = 'EXPIRED',
           resolved_at = null,
           resolved_by = null,
           resolution_code = null,
           resolution_note = v_note,
           expired_reason = v_note,
           snooze_until = null,
           updated_at = p_now
     where detail->>'event_key' = p_event_key
       and status in ('NEW', 'ASSIGNED', 'SNOOZED')
    returning id
  loop
    insert into decision_events (decision_id, actor_id, action, payload)
    values (r.id, null, 'EXPIRE', jsonb_build_object('note', v_note, 'via', 'L-3'));
  end loop;
end $$;
revoke all on function public.l3_lapse(text, timestamptz) from public, anon, authenticated;

create or replace function public.l3_critical_notify(p_event_key text, p_now timestamptz)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  d decisions%rowtype;
  v_role text;
  v_group text := 'DECISION';
begin
  select * into d from decisions
   where detail->>'event_key' = p_event_key
     and status in ('NEW', 'ASSIGNED', 'SNOOZED')
   limit 1;
  if not found then
    return;
  end if;
  update decisions
     set detail = detail || jsonb_build_object('l3', true, 'level', 'critical'),
         escalated_at = coalesce(escalated_at, p_now),
         updated_at = p_now
   where id = d.id;
  insert into decision_events (decision_id, actor_id, action, payload)
  values (d.id, null, 'ESCALATE', jsonb_build_object('level', 'critical', 'via', 'L-3', 'at', p_now));
  select decider_role into v_role from decision_types where code = d.type_code;
  insert into notifications (channel, recipient, user_id, load_id, template, payload, dedup_key)
  select 'IN_APP', coalesce(u.email::text, u.id::text), u.id, d.load_id, 'DECISION_ESCALATED',
         jsonb_build_object(
           'decision_id', d.id, 'type', d.type_code, 'title', d.title,
           'status', d.status, 'event', 'critical', 'level', 'critical', 'locale', u.locale
         ),
         left('l3crit:' || d.id::text || ':IN:' || u.id::text, 200)
    from app_users u
    join organizations o on o.id = u.org_id
    join notification_matrix m
      on m.event_group = v_group and m.org_kind = o.kind::text and m.in_app
   where u.active
     and (
       o.kind = 'FORWARDER'
       or (o.kind = 'CARRIER' and v_role = 'CARRIER' and (
            d.load_id is null
            or exists (select 1 from loads l where l.id = d.load_id and l.carrier_org_id = o.id)))
       or (o.kind = 'CLIENT' and (
            d.project_id is null
            or exists (select 1 from projects pr where pr.id = d.project_id and pr.client_org_id = o.id)
            or exists (select 1 from loads l join projects pr on pr.id = l.project_id
                        where l.id = d.load_id and pr.client_org_id = o.id)))
     )
  on conflict (dedup_key) where dedup_key is not null do nothing;
end $$;
revoke all on function public.l3_critical_notify(text, timestamptz) from public, anon, authenticated;

create or replace function public.l3_upsert_alarm(
  p_project uuid,
  p_load uuid,
  p_kind risk_kind,
  p_key text,
  p_title text,
  p_title_key text,
  p_active boolean,
  p_critical boolean,
  p_due timestamptz,
  p_detail jsonb,
  p_now timestamptz
) returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_sev text;
  v_old text;
  v_detail jsonb;
  v_level text;
  v_key text;
begin
  if p_active is not true then
    update risk_signals
       set resolved_at = p_now
     where dedup_key = p_key and resolved_at is null and detail->>'l3' = '1';
    if found then
      perform l3_lapse(p_key, p_now);
    end if;
    return 0;
  end if;
  v_level := case when p_critical then 'critical' else 'warning' end;
  v_sev := case when p_critical then 'CRITICAL' else 'HIGH' end;
  v_detail := coalesce(p_detail, '{}'::jsonb) || jsonb_build_object(
    'l3', '1',
    'l3_level', v_level,
    'l3_due', p_due,
    'title_key', p_title_key
  );
  v_key := p_key;
  select id, severity::text into v_id, v_old
    from risk_signals
   where dedup_key = v_key and resolved_at is null;
  if v_id is null then
    insert into risk_signals (project_id, load_id, kind, severity, title, title_key, detail, dedup_key, detected_at)
    values (
      p_project, p_load, p_kind, v_sev::risk_severity, p_title,
      case p_title_key
        when 'rk_res_driver' then 'rk_res_driver'
        when 'rk_res_docs' then 'rk_res_docs'
        when 'rk_silent_vehicle' then 'rk_silent_vehicle'
        when 'rk_eta_breach' then 'rk_eta_breach'
        when 'rk_off_corridor' then 'rk_off_corridor'
        else null
      end,
      v_detail, v_key, p_now
    )
    on conflict (dedup_key) where dedup_key is not null and resolved_at is null do nothing;
    update decisions
       set due_at = coalesce(p_due, due_at),
           detail = detail || jsonb_build_object('l3', true, 'level', v_level)
     where detail->>'event_key' = p_key
       and status in ('NEW', 'ASSIGNED', 'SNOOZED');
    return 1;
  end if;
  if v_old is distinct from v_sev or (select detail->>'l3_level' from risk_signals where id = v_id) is distinct from v_level then
    update risk_signals
       set severity = v_sev::risk_severity,
           detail = detail || v_detail,
           title = p_title
     where id = v_id;
    if p_critical and v_old is distinct from 'CRITICAL' then
      perform l3_critical_notify(p_key, p_now);
      return 1;
    end if;
  end if;
  return 0;
end $$;
revoke all on function public.l3_upsert_alarm(uuid, uuid, risk_kind, text, text, text, boolean, boolean, timestamptz, jsonb, timestamptz) from public, anon, authenticated;

create or replace function public.l1_decision_type(p_kind text, p_detail jsonb)
returns text
language sql
stable
set search_path = public
as $$
  select case
    when p_kind = 'RESOURCE_MISSING' and coalesce(p_detail->>'rule', '') = 'L3_AWIZ' then 'NO_AWIZACJA'
    when p_kind = 'DOC_MISSING' and coalesce(p_detail->>'rule', '') = 'L3_DOC' then 'DOC_MISSING'
    when p_kind = 'DOC_MISSING' then 'DOC_MISSING'
    when p_kind = 'PERMIT' then 'DOC_MISSING'
    when p_kind = 'INSURANCE' then 'INSURANCE_EXPIRING'
    when p_kind = 'ETA_BREACH' then 'ETA_AFTER_LATEST'
    when p_kind = 'LATE_DATE_CHANGE' then 'KSH_DATE_LT_5D'
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

create or replace function public.trg_l1_risk_opens_decision()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type text;
  v_key text;
  v_has_data boolean;
begin
  v_type := l1_decision_type(new.kind::text, coalesce(new.detail, '{}'::jsonb) || jsonb_build_object('title_key', new.title_key));
  if v_type is null then
    return new;
  end if;
  if v_type = 'ETA_AFTER_LATEST' then
    v_has_data := new.load_id is not null
      and (
        exists (select 1 from positions p where p.load_id = new.load_id)
        or exists (
          select 1 from loads l
           where l.id = new.load_id
             and l.status in (
               'READY','AT_LOADING','IN_TRANSIT_PL','AT_PORT_GDANSK',
               'FERRY','AT_PORT_NYNASHAMN','IN_TRANSIT_SE','AT_SITE'
             )
        )
      );
    if (v_has_data) is not true then
      return new;
    end if;
  end if;
  v_key := coalesce(nullif(btrim(new.dedup_key), ''), 'risk:' || new.id::text);
  perform decision_open_from_event(
    new.project_id, v_type, v_key, new.title, new.detail, new.load_id, new.id
  );
  if nullif(new.detail->>'l3_due', '') is not null then
    update decisions
       set due_at = (new.detail->>'l3_due')::timestamptz,
           detail = detail || jsonb_build_object('l3', true, 'level', coalesce(new.detail->>'l3_level', 'warning'))
     where detail->>'event_key' = v_key
       and status in ('NEW', 'ASSIGNED', 'SNOOZED');
  end if;
  return new;
end $$;
revoke all on function public.trg_l1_risk_opens_decision() from public, anon, authenticated;

create or replace function public.l3_scan(p_now timestamptz default now())
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  n int := 0;
  v_anchor timestamptz;
  v_warn timestamptz;
  v_crit timestamptz;
  v_missing boolean;
  v_permit boolean;
  v_policy boolean;
  v_code text;
begin
  if p_now is null or l3_ops('AWIZ_EARLY_H') is null or l3_ops('DOC_WARN_H') is null then
    return 0;
  end if;
  for r in
    select l.*
      from loads l
     where l.status not in ('CANCELLED', 'DELIVERED', 'UNLOADED')
  loop
    v_code := coalesce(r.order_no, left(r.id::text, 8));
    v_anchor := l3_anchor(r.plan_load_date, r.plan_load_from);
    v_missing := coalesce(btrim(r.driver_name), '') = ''
      or coalesce(btrim(r.driver_phone), '') = ''
      or coalesce(btrim(r.tractor_plate), '') = ''
      or coalesce(btrim(r.trailer_plate), '') = '';
    v_warn := l3_moment(v_anchor, 'AWIZ_EARLY_H');
    v_crit := l3_moment(v_anchor, 'AWIZ_LATE_H');
    n := n + l3_upsert_alarm(
      r.project_id, r.id, 'RESOURCE_MISSING', 'l3:NO_AWIZACJA:' || r.id,
      v_code || ': brak awizacji przed załadunkiem',
      'rk_res_driver',
      v_anchor is not null and v_missing and p_now >= v_warn,
      v_crit is not null and p_now >= v_crit,
      v_crit,
      jsonb_build_object('rule', 'L3_AWIZ', 'resource', 'LOAD', 'due', v_anchor,
        'params', jsonb_build_object('code', v_code, 'h', l3_ops('AWIZ_EARLY_H'))),
      p_now
    );

    v_permit := permit_required_enabled() and load_needs_permit(r.id) and exists (
      select 1 from unnest(array['PL', 'SE']) c
       where not exists (
         select 1 from load_permits lp
         join permits p on p.id = lp.permit_id
        where lp.load_id = r.id and p.country = c
       )
    );
    v_policy := r.carrier_org_id is not null and not exists (
      select 1 from insurance_policies ip
       where ip.org_id = r.carrier_org_id
         and ip.approval_status = 'APPROVED'
         and ip.valid_from <= (v_anchor at time zone 'Europe/Warsaw')::date
         and ip.valid_until >= (v_anchor at time zone 'Europe/Warsaw')::date
    );
    v_warn := l3_moment(v_anchor, 'DOC_WARN_H');
    v_crit := l3_moment(v_anchor, 'DOC_CRIT_H');
    n := n + l3_upsert_alarm(
      r.project_id, r.id, 'DOC_MISSING', 'l3:DOC_MISSING:' || r.id,
      v_code || ': brak wymaganego dokumentu przed załadunkiem',
      'rk_res_docs',
      v_anchor is not null and (v_permit or v_policy) and p_now >= v_warn,
      v_crit is not null and p_now >= v_crit,
      v_crit,
      jsonb_build_object('rule', 'L3_DOC', 'permit', v_permit, 'policy', v_policy, 'due', v_anchor,
        'params', jsonb_build_object('code', v_code, 'h', l3_ops('DOC_WARN_H'))),
      p_now
    );
  end loop;
  return n;
end $$;
revoke all on function public.l3_scan(timestamptz) from public, anon, authenticated;

create or replace function public.l3_ksh_lead(p_load loads, p_old_date date, p_old_from timestamptz, p_now timestamptz default now())
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new timestamptz;
  v_old timestamptz;
  v_earlier timestamptz;
  v_days int;
  v_n int;
  v_code text;
begin
  v_new := l3_anchor(p_load.plan_load_date, p_load.plan_load_from);
  v_old := l3_anchor(p_old_date, p_old_from);
  v_earlier := case
    when v_old is null then v_new
    when v_new is null then v_old
    else least(v_old, v_new)
  end;
  if l3_lead_alarm(v_earlier, p_now) is not true then
    return;
  end if;
  if p_load.status not in ('PLANNED', 'RESOURCES_PENDING', 'DOCS_PENDING', 'READY') then
    return;
  end if;
  v_n := l3_ops('LEAD_DAYS')::int;
  v_days := (v_earlier at time zone 'Europe/Warsaw')::date - (p_now at time zone 'Europe/Warsaw')::date;
  v_code := coalesce(p_load.order_no, left(p_load.id::text, 8));
  insert into risk_signals (project_id, load_id, kind, severity, title, title_key, detail, dedup_key, detected_at)
  values (
    p_load.project_id, p_load.id, 'LATE_DATE_CHANGE',
    (case when v_days <= 2 then 'HIGH' else 'MEDIUM' end)::risk_severity,
    v_code || ': późna zmiana daty — załadunek ' || coalesce(to_char(p_load.plan_load_date, 'DD.MM.YYYY'), to_char(v_earlier at time zone 'Europe/Warsaw', 'DD.MM.YYYY HH24:MI')),
    'rk_late_date_change',
    jsonb_build_object(
      'params', jsonb_build_object('code', v_code, 'date', to_char(p_load.plan_load_date, 'DD.MM.YYYY'), 'days', v_n,
                                   'before', to_char(p_old_date, 'DD.MM.YYYY'),
                                   'after', to_char(p_load.plan_load_date, 'DD.MM.YYYY')),
      'text', 'Zmiana daty w pliku KSH, do wcześniejszej daty załadunku zostało mniej niż ' || v_n || ' dni',
      'text_key', 'rk_late_date_change_text',
      'next_action_key', 'rk_late_date_change_next',
      'next_action', 'Przewoźnik: sprawdź awizację i zasoby; HHL: potwierdź z KSH'),
    'late_date:' || p_load.id || ':' || coalesce(p_load.plan_load_date::text, '') || ':' || coalesce(p_load.plan_delivery_date::text, ''),
    p_now)
  on conflict (dedup_key) where dedup_key is not null and resolved_at is null do nothing;
end $$;
revoke all on function public.l3_ksh_lead(loads, date, timestamptz, timestamptz) from public, anon, authenticated;

create or replace function public.trg_plan_dates_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := current_app_user_id();
  v_by text;
  v_payload jsonb;
  v_client uuid;
  v_stamp text := to_char(clock_timestamp(), 'YYYYMMDDHH24MISSUS');
begin
  if (new.plan_load_date, new.plan_load_from, new.plan_load_to, new.plan_delivery_date, new.plan_delivery_from, new.plan_delivery_to)
     is not distinct from (old.plan_load_date, old.plan_load_from, old.plan_load_to, old.plan_delivery_date, old.plan_delivery_from, old.plan_delivery_to) then
    return null;
  end if;
  v_by := case
    when current_setting('tower.dates_ctx', true) = 'on' then 'KSH'
    when auth.uid() is null then 'SYSTEM'
    else 'HHL'
  end;
  select client_org_id into v_client from projects where id = new.project_id;
  insert into load_events (load_id, event_type, occurred_at, actor_id, payload)
  values (new.id, 'PLAN_DATES_CHANGED', now(), v_actor, jsonb_build_object(
    'code', coalesce(new.order_no, left(new.id::text, 8)), 'by', v_by, 'status', new.plan_dates_status,
    'load_date', new.plan_load_date, 'delivery_date', new.plan_delivery_date,
    'before_load_date', old.plan_load_date, 'before_delivery_date', old.plan_delivery_date,
    'load_from', new.plan_load_from, 'load_to', new.plan_load_to,
    'delivery_from', new.plan_delivery_from, 'delivery_to', new.plan_delivery_to));
  v_payload := jsonb_build_object(
    'code', coalesce(new.order_no, left(new.id::text, 8)), 'by', v_by, 'status', new.plan_dates_status,
    'load_date', new.plan_load_date, 'delivery_date', new.plan_delivery_date,
    'before_load_date', old.plan_load_date, 'before_delivery_date', old.plan_delivery_date);
  insert into notifications (channel, recipient, user_id, load_id, template, payload, dedup_key)
  select 'IN_APP', coalesce(u.email::text, u.id::text), u.id, new.id, 'PLAN_DATES_CHANGED',
         v_payload || jsonb_build_object('locale', u.locale),
         'PLAN_DATES:' || new.id || ':' || v_stamp || ':' || u.id
    from app_users u join organizations o on o.id = u.org_id
   where u.active and u.id is distinct from v_actor
     and (o.kind = 'FORWARDER'
          or (new.carrier_org_id is not null and u.org_id = new.carrier_org_id)
          or (v_client is not null and u.org_id = v_client))
  on conflict (dedup_key) where dedup_key is not null do nothing;
  if (new.plan_load_date, new.plan_load_from) is distinct from (old.plan_load_date, old.plan_load_from)
     or old.plan_load_date is null then
    perform l3_ksh_lead(new, old.plan_load_date, old.plan_load_from, now());
  end if;
  return null;
end $$;
revoke all on function public.trg_plan_dates_notify() from public, anon, authenticated;

create or replace function public.trg_l3_ksh_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.plan_dates_status = 'POTWIERDZONA' then
    perform l3_ksh_lead(new, null, null, now());
  end if;
  return null;
end $$;
revoke all on function public.trg_l3_ksh_insert() from public, anon, authenticated;
drop trigger if exists trg_l3_ksh_insert on loads;
create trigger trg_l3_ksh_insert after insert on loads
  for each row execute function public.trg_l3_ksh_insert();

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
  v_connected boolean;
  v_moving boolean;
begin
  v_min := l3_ops('SILENT_MIN')::int;
  if v_min is null then
    return 0;
  end if;
  for r in
    select l.id, l.project_id, l.tractor_plate, l.status, l.telematics_vehicle_id,
           max(p.ts) as last_fix
      from loads l
      left join positions p on p.load_id = l.id
     group by l.id
  loop
    v_moving := r.status in ('IN_TRANSIT_PL', 'AT_PORT_GDANSK', 'AT_PORT_NYNASHAMN', 'IN_TRANSIT_SE');
    v_connected := r.telematics_vehicle_id is not null or exists (
      select 1 from positions p
       where p.load_id = r.id and p.source in ('TELEMATICS_API', 'RFMS', 'DRIVER_PWA')
    );
    if l3_silent_alarm(r.last_fix, now(), v_connected, v_moving) is not true then
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
        'last_fix', r.last_fix, 'threshold_min', v_min,
        'params', jsonb_build_object('plate', coalesce(r.tractor_plate, '?'), 'minutes', v_min)
      ),
      now()
    );
  end loop;
  return n;
end $$;
revoke all on function public.detect_silent_vehicles(integer) from public, anon, authenticated;

-- refresh_load_eta: próg opóźnienia i zjazd wyłącznie z Opcji
create or replace function public.refresh_load_eta(p_load uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  r record;
  l record;
  v_end timestamptz;
  v_delay int;
  v_has boolean;
  p1 record;
  p2 record;
  v_kind risk_kind;
  v_off numeric;
  v_max_off numeric := null;
  v_span numeric := 0;
  v_samples int := 0;
  v_blocked boolean := false;
  v_corr text;
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
  if l3_eta_alarm(r.eta, v_end, v_has)
     and l.status is distinct from 'CANCELLED'
     and l.status is distinct from 'UNLOADED'
     and l.status is distinct from 'DELIVERED'
     and l.status is distinct from 'AT_SITE' then
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

create or replace function public.detect_unconfirmed_dates(p_now timestamptz default now()) returns int
language plpgsql security definer set search_path = public as $$
declare v_n int; v_today date := (p_now at time zone 'Europe/Warsaw')::date; v_new int := 0; r record; v_id uuid;
begin
  v_n := l3_ops('LEAD_DAYS')::int;
  if v_n is null then return 0; end if;
  update risk_signals s set resolved_at = p_now
    from loads l
   where s.kind::text = 'DATES_UNCONFIRMED' and s.resolved_at is null and l.id = s.load_id
     and (l.plan_dates_status = 'POTWIERDZONA' or l.status not in ('PLANNED','RESOURCES_PENDING','DOCS_PENDING','READY'));
  for r in
    select l.id, l.project_id, coalesce(l.order_no, left(l.id::text, 8)) as code, l.plan_load_date, (l.plan_load_date - v_today) as days
      from loads l
     where l.plan_dates_status = 'WSTEPNA' and l.status in ('PLANNED','RESOURCES_PENDING','DOCS_PENDING','READY')
       and l.plan_load_date is not null and l.plan_load_date <= v_today + v_n
  loop
    v_id := null;
    insert into risk_signals (project_id, load_id, kind, severity, title, title_key, detail, dedup_key, detected_at)
    values (r.project_id, r.id, 'DATES_UNCONFIRMED', (case when r.days <= 2 then 'HIGH' else 'MEDIUM' end)::risk_severity,
            r.code || ': daty niepotwierdzone przez KSH — załadunek ' || to_char(r.plan_load_date, 'DD.MM.YYYY'),
            'rk_dates_unconfirmed',
            jsonb_build_object('params', jsonb_build_object('code', r.code, 'date', to_char(r.plan_load_date, 'DD.MM.YYYY'), 'days', v_n),
                               'text', 'Załadunek za ' || r.days || ' dni; próg potwierdzenia: ' || v_n || ' dni',
                               'text_key', 'rk_dates_unconfirmed_text', 'next_action_key', 'rk_dates_unconfirmed_next',
                               'next_action', 'KSH: szuflada transportu → „Potwierdź daty”'),
            'dates:' || r.id, p_now)
    on conflict (dedup_key) where dedup_key is not null and resolved_at is null do nothing
    returning id into v_id;
    if v_id is not null then v_new := v_new + 1; end if;
  end loop;
  return v_new;
end $$;
revoke all on function public.detect_unconfirmed_dates(timestamptz) from public, anon, authenticated;

create or replace function public.detect_resource_deadlines(p_now timestamptz default now()) returns int
language plpgsql security definer set search_path = public as $$
declare
  r record; v_missing boolean; v_sev risk_severity; v_key text; v_rid uuid; v_old risk_severity;
  n int := 0; v_code text; v_lead int; v_crit int; v_res text := 'ESCORT';
begin
  n := l3_scan(p_now);
  v_lead := l3_ops('AWIZ_EARLY_H')::int;
  v_crit := l3_ops('AWIZ_LATE_H')::int;
  if v_lead is null or v_crit is null then
    return n;
  end if;
  for r in
    select l.*, coalesce(l.plan_load_from, (l.plan_load_date::timestamp at time zone 'Europe/Warsaw')) as due,
           coalesce(si.shipment_code, l.order_no, left(l.id::text, 8)) as code
      from loads l
      left join lateral (select shipment_code from shipment_items where load_id = l.id order by assembly_seq nulls last limit 1) si on true
     where l.carrier_org_id is not null
       and coalesce(l.plan_load_from, (l.plan_load_date::timestamp at time zone 'Europe/Warsaw')) is not null
  loop
    v_key := 'RES:ESCORT:' || r.id;
    v_missing := r.status in ('PLANNED', 'RESOURCES_PENDING', 'DOCS_PENDING')
      and (select coalesce(max(p.escort_required), 0) from load_permits lp join permits p on p.id = lp.permit_id where lp.load_id = r.id)
          > (select count(*) from load_escorts e where e.load_id = r.id);
    select id, severity into v_rid, v_old from risk_signals where dedup_key = v_key and resolved_at is null;
    if (v_missing and r.due <= p_now + make_interval(hours => v_lead)) is not true then
      if v_rid is not null and v_missing is not true then
        update risk_signals set resolved_at = p_now where id = v_rid;
      end if;
      continue;
    end if;
    v_sev := case when r.due <= p_now + make_interval(hours => v_crit) then 'CRITICAL' else 'HIGH' end;
    v_code := r.code;
    if v_rid is null then
      insert into risk_signals (project_id, load_id, kind, severity, title, title_key, detail, dedup_key)
      values (r.project_id, r.id, 'RESOURCE_MISSING', v_sev,
              v_code || ': brak pojazdów pilotujących wymaganych zezwoleniem',
              'rk_res_escort',
              jsonb_build_object('rule', 'RESOURCE_DEADLINE', 'resource', 'ESCORT', 'owner', 'SCX', 'due', r.due,
                'lead_h', v_lead, 'critical_h', v_crit, 'params', jsonb_build_object('code', v_code, 'h', v_lead),
                'text_key', 'rk_res_escort_text', 'meta_key', 'risk_meta_carrier', 'next_action_key', 'rk_res_escort_next'),
              v_key);
      n := n + 1;
    elsif v_old = 'HIGH' and v_sev = 'CRITICAL' then
      update risk_signals set severity = 'CRITICAL' where id = v_rid;
      n := n + 1;
    else
      continue;
    end if;
    insert into notifications (channel, recipient, user_id, load_id, template, payload, dedup_key)
    select 'IN_APP', coalesce(u.email::text, u.id::text), u.id, r.id, 'RESOURCE_DEADLINE',
           jsonb_build_object('resource', v_res, 'code', v_code, 'due', r.due, 'severity', v_sev, 'locale', u.locale),
           v_key || ':' || v_sev || ':' || u.id
      from app_users u
     where u.active and ((u.org_id = r.carrier_org_id and u.role in ('CARRIER_DISPATCH', 'CARRIER_USER'))
                         or (v_sev = 'CRITICAL' and u.role in ('HHL_ADMIN', 'HHL_OPS')))
    on conflict (dedup_key) where dedup_key is not null do nothing;
  end loop;
  return n;
end $$;
revoke all on function public.detect_resource_deadlines(timestamptz) from public, anon, authenticated;

delete from app_parameters where key in ('DELAY_MIN', 'OFF_CORRIDOR_M', 'DATE_CONFIRM_DAYS');
delete from resource_deadlines where kind in ('DRIVER', 'VEHICLE', 'DOCS');
