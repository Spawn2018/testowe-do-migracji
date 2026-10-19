-- D-20261019-0930-01: kod transportu w L-3 i E41 (bez left(id,8) i samotnego order_no).
-- D-20261019-2315-01 (#338): bieżący wpis statusu = ostatni niezastąpiony (ta sama migracja).

create or replace function public.sefs_source_expire_once()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_reason text;
  n int := 0;
begin
  for r in
    select d.id, d.project_id, d.detail
      from decisions d
     where d.type_code = 'SEFS_OUT_OF_TABLE'
       and d.status in ('NEW', 'ASSIGNED', 'SNOOZED')
       and coalesce(d.detail->>'reason', '') = 'SOURCE'
  loop
    v_reason := public.sefs_source_expire_reason(r.project_id, r.detail);
    if v_reason is not null then
      if coalesce(r.detail->>'event_key', '') <> ''
         and r.detail->>'event_key' not like '%:expired-0230' then
        update decisions
           set detail = coalesce(detail, '{}'::jsonb)
               || jsonb_build_object(
                    'event_key', (detail->>'event_key') || ':expired-0230',
                    'event_key_0230', detail->>'event_key'
                  ),
               updated_at = now()
         where id = r.id;
      end if;
      perform public.decision_expire(r.id, v_reason);
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;
revoke all on function public.sefs_source_expire_once() from public, anon, authenticated;

select public.sefs_source_expire_once();

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
  v_code text;
  v_kept text;
  v_in text;
  v_bad boolean;
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
  select id, severity::text, detail#>>'{params,code}' into v_id, v_old, v_kept
    from risk_signals
   where dedup_key = v_key and resolved_at is null;
  v_code := case when p_load is null then null else public.load_sms_code(p_load) end;
  v_in := v_detail #>> '{params,code}';
  v_bad := p_load is not null and v_in is not null and (
    lower(v_in) = lower(left(p_load::text, 8))
    or exists (
      select 1 from loads l
       where l.id = p_load and nullif(btrim(l.order_no), '') is not null and l.order_no = v_in
    )
  );
  if v_kept is not null
     and (p_load is null or lower(v_kept) is distinct from lower(left(p_load::text, 8)))
     and not exists (
       select 1 from loads l
        where l.id = p_load and nullif(btrim(l.order_no), '') is not null and l.order_no = v_kept
     )
     and (v_bad is true or v_code is null or v_code = '—')
     and v_detail ? 'params' then
    v_detail := jsonb_set(v_detail, '{params,code}', to_jsonb(v_kept), true);
  elsif v_code is not null and v_code is distinct from '—' and v_detail ? 'params'
        and (v_bad is true or v_in is not null) then
    v_detail := jsonb_set(v_detail, '{params,code}', to_jsonb(v_code), true);
  end if;
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
    v_code := public.load_sms_code(r.id);
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
  v_code := public.load_sms_code(p_load.id);
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
    select l.id, l.project_id, public.load_sms_code(l.id) as code, l.plan_load_date, (l.plan_load_date - v_today) as days
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
           public.load_sms_code(l.id) as code
      from loads l
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

create or replace function public.trg_plan_dates_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := current_app_user_id();
  v_by text;
  v_payload jsonb;
  v_client uuid;
  v_stamp text := to_char(clock_timestamp(), 'YYYYMMDDHH24MISSUS');
  v_code text := public.load_sms_code(new.id);
begin
  if (new.plan_load_date, new.plan_load_from, new.plan_load_to, new.plan_delivery_date, new.plan_delivery_from, new.plan_delivery_to)
     is not distinct from (old.plan_load_date, old.plan_load_from, old.plan_load_to, old.plan_delivery_date, old.plan_delivery_from, old.plan_delivery_to) then
    return null;
  end if;
  v_by := case
    when current_setting('tower.dates_ctx', true) = 'on'
      and current_app_role() = 'HHL_ADMIN' then 'HHL_ADMIN'
    when current_setting('tower.dates_ctx', true) = 'on' then 'KSH'
    when auth.uid() is null then 'SYSTEM'
    else 'HHL'
  end;
  select client_org_id into v_client from projects where id = new.project_id;
  insert into load_events (load_id, event_type, occurred_at, actor_id, payload)
  values (new.id, 'PLAN_DATES_CHANGED', now(), v_actor, jsonb_build_object(
    'code', v_code, 'by', v_by, 'status', new.plan_dates_status,
    'load_date', new.plan_load_date, 'delivery_date', new.plan_delivery_date,
    'before_load_date', old.plan_load_date, 'before_delivery_date', old.plan_delivery_date,
    'before_load_from', old.plan_load_from, 'before_load_to', old.plan_load_to,
    'before_delivery_from', old.plan_delivery_from, 'before_delivery_to', old.plan_delivery_to,
    'load_from', new.plan_load_from, 'load_to', new.plan_load_to,
    'delivery_from', new.plan_delivery_from, 'delivery_to', new.plan_delivery_to)
    || case when v_by in ('KSH', 'HHL_ADMIN') and nullif(current_setting('tower.dates_actor', true), '') is not null
            then jsonb_build_object('actor', current_setting('tower.dates_actor', true)) else '{}'::jsonb end);
  v_payload := jsonb_build_object(
    'code', v_code, 'by', v_by, 'status', new.plan_dates_status,
    'load_date', new.plan_load_date, 'delivery_date', new.plan_delivery_date,
    'before_load_date', old.plan_load_date, 'before_delivery_date', old.plan_delivery_date,
    'before_load_from', old.plan_load_from, 'before_load_to', old.plan_load_to,
    'before_delivery_from', old.plan_delivery_from, 'before_delivery_to', old.plan_delivery_to);
  if v_by not in ('KSH', 'HHL_ADMIN') then
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
  end if;
  if (new.plan_load_date, new.plan_load_from) is distinct from (old.plan_load_date, old.plan_load_from)
     or old.plan_load_date is null then
    perform l3_ksh_lead(new, old.plan_load_date, old.plan_load_from, now());
  end if;
  return null;
end $$;
revoke all on function public.trg_plan_dates_notify() from public, anon, authenticated;

-- Jednorazowo, bez nowych powiadomień: numer KSH i 8 hex w otwartych ryzykach oraz w payload SCX.
update risk_signals s
   set detail = jsonb_set(
         coalesce(s.detail, '{}'::jsonb),
         '{params,code}',
         to_jsonb(public.load_sms_code(s.load_id)),
         true
       )
 where s.resolved_at is null
   and s.load_id is not null
   and public.load_sms_code(s.load_id) is distinct from '—'
   and (
     (
       coalesce(s.detail#>>'{params,code}', '') ~* '^[0-9a-f]{8}$'
       and lower(left(s.load_id::text, 8)) = lower(s.detail#>>'{params,code}')
     )
     or exists (
       select 1 from loads l
        where l.id = s.load_id
          and nullif(btrim(l.order_no), '') is not null
          and l.order_no = s.detail#>>'{params,code}'
     )
   );

update risk_signals s
   set title = replace(s.title, l.order_no, public.load_sms_code(s.load_id)),
       detail = replace(s.detail::text, l.order_no, public.load_sms_code(s.load_id))::jsonb
  from loads l
 where s.load_id = l.id
   and s.resolved_at is null
   and nullif(btrim(l.order_no), '') is not null
   and public.load_sms_code(s.load_id) is distinct from l.order_no
   and public.load_sms_code(s.load_id) is distinct from '—'
   and position(l.order_no in s.detail::text) > 0;

update notifications n
   set payload = replace(n.payload::text, l.order_no, public.load_sms_code(n.load_id))::jsonb
  from loads l, app_users u, organizations o
 where n.load_id = l.id
   and n.user_id = u.id
   and u.org_id = o.id
   and o.kind = 'CARRIER'
   and nullif(btrim(l.order_no), '') is not null
   and public.load_sms_code(n.load_id) is distinct from l.order_no
   and public.load_sms_code(n.load_id) is distinct from '—'
   and position(l.order_no in n.payload::text) > 0;

create or replace function public.load_status_set(
  p_load uuid,
  p_status text,
  p_occurred_at timestamptz,
  p_note text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := current_app_user_id();
  v_role text;
  v_org uuid;
  v_load loads%rowtype;
  v_new load_status;
  v_when timestamptz;
  v_note text := nullif(trim(coalesce(p_note, '')), '');
  v_actor text;
  v_prev_at timestamptz;
  v_missing text;
  v_ev_id bigint;
  v_ev_old timestamptz;
  v_old_load_at timestamptz;
  v_old_del_at timestamptz;
begin
  if (v_me is not null) is not true then
    raise exception 'Brak aktywnego konta' using errcode = '42501';
  end if;
  v_role := current_app_role()::text;
  select org_id into v_org from app_users where id = v_me;
  if (v_role in ('HHL_ADMIN', 'CARRIER_DISPATCH', 'CARRIER_USER')) is not true then
    raise exception 'Zmiana statusu — tylko Administrator HHL albo SCX' using errcode = '42501';
  end if;

  if (p_load is not null) is not true then
    raise exception 'Brak transportu' using errcode = '22023';
  end if;
  if (p_status is not null and length(trim(p_status)) > 0) is not true then
    raise exception 'Brak statusu' using errcode = '22023';
  end if;

  begin
    v_new := trim(p_status)::load_status;
  exception when others then
    raise exception 'Nieznany status' using errcode = '22023';
  end;

  if v_new = 'UNLOADED' then
    v_new := 'DELIVERED';
  end if;

  v_when := coalesce(p_occurred_at, now());
  if v_when > now() + interval '1 minute' and v_role is distinct from 'HHL_ADMIN' then
    raise exception 'Czas statusu nie może być w przyszłości' using errcode = '22023';
  end if;

  select * into v_load from loads where id = p_load for update;
  if not found then
    raise exception 'Nieznany transport' using errcode = 'P0002';
  end if;

  if v_role in ('CARRIER_DISPATCH', 'CARRIER_USER') then
    if (v_load.carrier_org_id is not null and v_load.carrier_org_id = v_org) is not true then
      raise exception 'Status — tylko własny transport SCX' using errcode = '42501';
    end if;
    if v_new = 'CANCELLED' then
      raise exception 'Anulowanie — tylko Administrator HHL' using errcode = '42501';
    end if;
    if public.load_status_rank(v_new) < public.load_status_rank(v_load.status) then
      raise exception 'SCX zmienia status tylko do przodu' using errcode = '22023';
    end if;
  end if;

  if v_new = 'CANCELLED' and (v_note is not null) is not true then
    raise exception 'Anulowanie wymaga powodu' using errcode = '22023';
  end if;

  if public.load_status_rank(v_new) < public.load_status_rank(v_load.status)
     and v_role = 'HHL_ADMIN'
     and (v_note is not null) is not true then
    raise exception 'Cofnięcie statusu wymaga powodu' using errcode = '22023';
  end if;

  if v_new = 'READY_TO_INVOICE' then
    if (
      exists (
        select 1 from documents d
         where d.load_id = p_load
           and d.category = 'CMR'
           and d.superseded_at is null
      )
    ) is not true then
      raise exception 'Gotowe do fakturowania wymaga pliku CMR z podpisem odbiorcy'
        using errcode = '22023';
    end if;
  end if;

  if v_new = 'INVOICED' then
    v_missing := null;
    if (
      exists (select 1 from invoice_lines il where il.load_id = p_load and il.direction = 'KOSZT')
    ) is not true then
      v_missing := 'brak faktury SCX → HHL';
    end if;
    if (
      exists (select 1 from invoice_lines il where il.load_id = p_load and il.direction = 'PRZYCHOD')
    ) is not true then
      v_missing := case
        when v_missing is null then 'brak faktury HHL → KSH'
        else v_missing || ' i brak faktury HHL → KSH'
      end;
    end if;
    if v_missing is not null then
      raise exception 'Zafakturowano — %', v_missing using errcode = '22023';
    end if;
  end if;

  select coalesce(nullif(btrim(u.full_name), ''), split_part(u.email::text, '@', 1), '—')
         || ' // ' || coalesce(nullif(btrim(o.name), ''), nullif(btrim(o.code), ''), '—')
    into v_actor
    from app_users u
    left join organizations o on o.id = u.org_id
   where u.id = v_me;

  if v_load.status is not distinct from v_new and v_role = 'HHL_ADMIN' then
    select e.id, e.occurred_at into v_ev_id, v_ev_old
      from load_events e
     where e.load_id = p_load
       and e.event_type = 'STATUS_' || v_new::text
       and not exists (
         select 1 from load_events z
          where z.load_id = e.load_id
            and z.payload->>'zastepuje' = e.id::text
       )
     order by e.id desc
     limit 1;
    v_old_load_at := v_load.actual_load_at;
    v_old_del_at := v_load.actual_delivery_at;
    if v_ev_id is not null and v_ev_old is distinct from v_when then
      insert into load_events (load_id, event_type, occurred_at, payload)
      values (
        p_load,
        'STATUS_' || v_new::text,
        v_when,
        jsonb_build_object(
          'korekta', true,
          'zastepuje', v_ev_id,
          'poprzednio', v_ev_old,
          'przez', 'HHL_ADMIN',
          'actor', v_actor,
          'actor_id', v_me
        )
      );
    end if;
    perform set_config('tower.status_ctx', 'on', true);
    update loads
       set actual_delivery_at = case when v_new = 'DELIVERED' then v_when else actual_delivery_at end,
           actual_load_at = case
             when v_new in ('AT_LOADING', 'IN_TRANSIT_PL') then v_when
             else actual_load_at
           end,
           updated_at = now()
     where id = p_load;
    insert into audit_log (user_id, action, entity, entity_id, old_value, new_value)
    values (
      v_me,
      'LOAD_STATUS_SET',
      'loads',
      p_load::text,
      jsonb_build_object(
        'status', v_load.status::text,
        'occurred_at', v_ev_old,
        'actual_load_at', v_old_load_at,
        'actual_delivery_at', v_old_del_at
      ),
      jsonb_build_object(
        'status', v_new::text,
        'occurred_at', v_when,
        'note', v_note,
        'time_only', true
      )
    );
    return;
  end if;

  if v_load.status is not distinct from v_new then
    if (
      v_role in ('CARRIER_DISPATCH', 'CARRIER_USER')
      and v_new = 'DELIVERED'
      and v_load.actual_delivery_at is distinct from v_when
    ) is not true then
      select e.occurred_at into v_ev_old
        from load_events e
       where e.load_id = p_load
         and e.event_type = 'STATUS_' || v_new::text
         and not exists (
           select 1 from load_events z
            where z.load_id = e.load_id
              and z.payload->>'zastepuje' = e.id::text
         )
       order by e.id desc
       limit 1;
      if (v_ev_old is not null and v_when is distinct from v_ev_old)
         or (v_new = 'DELIVERED' and v_load.actual_delivery_at is distinct from v_when) then
        raise exception 'Korektę czasu statusu robi wyłącznie Administrator HHL'
          using errcode = '42501';
      end if;
      return;
    end if;
  end if;

  if v_new is distinct from 'DELIVERED' then
    select max(e.occurred_at) into v_prev_at
      from load_events e
     where e.load_id = p_load
       and e.event_type like 'STATUS_%'
       and not exists (
         select 1 from load_events z
          where z.load_id = e.load_id
            and z.payload->>'zastepuje' = e.id::text
       );
    if v_prev_at is not null and v_when < v_prev_at and v_role is distinct from 'HHL_ADMIN' then
      raise exception 'Czas statusu nie wcześniej niż poprzedni status' using errcode = '22023';
    end if;
  end if;

  if v_new = 'CANCELLED' then
    perform set_config('tower.cancel_ctx', 'MANUAL', true);
  end if;
  perform set_config('tower.status_ctx', 'on', true);

  update loads
     set status = v_new,
         actual_delivery_at = case
           when v_new = 'DELIVERED' then v_when
           else actual_delivery_at
         end,
         actual_load_at = case
           when v_new in ('AT_LOADING', 'IN_TRANSIT_PL') and actual_load_at is null then v_when
           else actual_load_at
         end,
         updated_at = now()
   where id = p_load;

  if v_load.status is distinct from v_new then
    insert into load_events (load_id, event_type, occurred_at, payload)
    values (
      p_load,
      'STATUS_' || v_new::text,
      v_when,
      jsonb_build_object(
        'actor', v_actor,
        'actor_user_id', v_me,
        'from', v_load.status::text,
        'to', v_new::text,
        'note', v_note,
        'manual', true
      )
    );
  end if;

  insert into audit_log (user_id, action, entity, entity_id, old_value, new_value)
  values (
    v_me,
    'LOAD_STATUS_SET',
    'loads',
    p_load::text,
    jsonb_build_object('status', v_load.status::text, 'actual_delivery_at', v_load.actual_delivery_at),
    jsonb_build_object('status', v_new::text, 'occurred_at', v_when, 'note', v_note)
  );
end $$;

revoke all on function public.load_status_set(uuid, text, timestamptz, text) from public, anon;
grant execute on function public.load_status_set(uuid, text, timestamptz, text) to authenticated;
comment on function public.load_status_set(uuid, text, timestamptz, text) is
  'A5 E25 + D-0005 + D-2315: bieżący wpis = ostatni niezastąpiony; korekta ma actor i actor_id; SCX nadpisuje godzinę DELIVERED.';
