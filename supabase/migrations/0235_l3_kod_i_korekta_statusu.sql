-- D-20261019-0930-01: kod transportu w L-3 i E41 (bez left(id,8) i samotnego order_no).
-- D-20261019-2315-01 (#338): bieżący wpis statusu = ostatni niezastąpiony (ta sama migracja).
-- F7 #340: ksh_confirm_dates i postój biorą load_sms_code; korekta powstaje też po STATUS_AUTO.

create or replace function public.l3_headed(p_code text, p_body text) returns text
language sql immutable set search_path = public as $$
  select case
    when p_code is null or btrim(p_code) = '' or p_code = '—' then p_body
    else p_code || ': ' || p_body
  end
$$;
revoke all on function public.l3_headed(text, text) from public, anon, authenticated;

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
      public.l3_headed(v_code, 'brak awizacji przed załadunkiem'),
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
      public.l3_headed(v_code, 'brak wymaganego dokumentu przed załadunkiem'),
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
    public.l3_headed(v_code, 'późna zmiana daty — załadunek ' || coalesce(to_char(p_load.plan_load_date, 'DD.MM.YYYY'), to_char(v_earlier at time zone 'Europe/Warsaw', 'DD.MM.YYYY HH24:MI'))),
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
            public.l3_headed(r.code, 'daty niepotwierdzone przez KSH — załadunek ' || to_char(r.plan_load_date, 'DD.MM.YYYY')),
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
              public.l3_headed(v_code, 'brak pojazdów pilotujących wymaganych zezwoleniem'),
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
   and length(l.order_no) >= 8
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
   and length(l.order_no) >= 8
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
       and (
         e.event_type = 'STATUS_' || v_new::text
         or (e.event_type = 'STATUS_AUTO' and e.payload->>'to' = v_new::text)
       )
       and not exists (
         select 1 from load_events z
          where z.load_id = e.load_id
            and z.payload->>'zastepuje' = e.id::text
       )
     order by e.id desc
     limit 1;
    v_old_load_at := v_load.actual_load_at;
    v_old_del_at := v_load.actual_delivery_at;
    if v_ev_id is null then
      v_ev_old := case
        when v_new = 'DELIVERED' then v_load.actual_delivery_at
        when v_new in ('AT_LOADING', 'IN_TRANSIT_PL') then v_load.actual_load_at
        else null
      end;
    end if;
    if v_ev_old is distinct from v_when then
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
          'actor_id', v_me,
          'note', v_note
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
  'A5 E25 + D-0005: HHL_ADMIN bez limitu czasu; current_app_*; korekta osi dopiskiem; SCX nadpisuje godzinę DELIVERED; READY_TO_INVOICE=CMR; INVOICED=obie faktury. #338: ostatni niezastąpiony wpis, także STATUS_AUTO; actor, actor_id i note.';


-- F7 #340 P1: potwierdzenie dat niesie kod transportu, nie numer KSH.
create or replace function public.ksh_confirm_dates(
  p_load uuid,
  p_load_date date default null,
  p_delivery_date date default null,
  p_load_from timestamptz default null,
  p_load_to timestamptz default null,
  p_delivery_from timestamptz default null,
  p_delivery_to timestamptz default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  l loads%rowtype;
  v_client uuid;
  v_ld date; v_dd date;
  v_lf timestamptz; v_lt timestamptz; v_df timestamptz; v_dt timestamptz;
  v_changed boolean;
  v_actor uuid := current_app_user_id();
  v_label text;
  v_code text;
  v_awiz boolean;
  v_stamp text := to_char(clock_timestamp(), 'YYYYMMDDHH24MISSUS');
  v_payload jsonb;
  v_admin boolean := (current_app_role() = 'HHL_ADMIN');
  v_dates_odd boolean := false;
  v_by text;
begin
  if (v_actor is not null) is not true then
    raise exception 'Brak aktywnego konta' using errcode = '42501';
  end if;
  -- G-20: CLIENT_USER albo Administrator HHL (D-20261019-0005-01)
  if (v_admin or current_app_role() = 'CLIENT_USER') is not true then
    raise exception 'Daty i godziny zmienia wyłącznie KSH Użytkownik' using errcode = '42501';
  end if;
  if v_admin is not true then
    if (current_org_kind() = 'CLIENT') is not true then
      raise exception 'Daty i godziny w tym oknie zmienia wyłącznie KSH (zamawiający)' using errcode = '42501';
    end if;
  end if;
  if p_load is null then raise exception 'Brak transportu' using errcode = '22023'; end if;
  select * into l from loads where id = p_load for update;
  if not found then raise exception 'Transport nie istnieje' using errcode = '42501'; end if;
  select client_org_id into v_client from projects where id = l.project_id;
  if v_admin is not true and (v_client = current_org_id()) is not true then
    raise exception 'Daty i godziny w tym oknie zmienia wyłącznie KSH (zamawiający)' using errcode = '42501';
  end if;
  if v_admin is not true
     and (l.status in ('PLANNED','RESOURCES_PENDING','DOCS_PENDING','READY')) is not true then
    raise exception 'Po wjeździe na załadunek (albo po anulowaniu) daty planu nie zmienia się w tym oknie' using errcode = '42501';
  end if;
  v_ld := coalesce(p_load_date, (p_load_from at time zone 'Europe/Warsaw')::date, l.plan_load_date);
  v_dd := coalesce(p_delivery_date, (p_delivery_from at time zone 'Europe/Stockholm')::date, l.plan_delivery_date);
  v_lf := coalesce(p_load_from, l.plan_load_from);
  v_lt := coalesce(p_load_to, l.plan_load_to);
  v_df := coalesce(p_delivery_from, l.plan_delivery_from);
  v_dt := coalesce(p_delivery_to, l.plan_delivery_to);
  if (v_ld is not null and v_dd is not null) is not true then
    raise exception 'Brak daty załadunku albo rozładunku' using errcode = '22023';
  end if;
  if (v_dd >= v_ld) is not true
     or (v_lf <= v_lt) is false
     or (v_df <= v_dt) is false
     or (v_df >= v_lf) is false then
    v_dates_odd := true;
  end if;
  if v_dates_odd and v_admin is not true then
    if (v_dd >= v_ld) is not true then
      raise exception 'Data rozładunku przed datą załadunku' using errcode = '22023';
    end if;
    if (v_lf <= v_lt) is false or (v_df <= v_dt) is false then
      raise exception 'Początek okna po jego końcu' using errcode = '22023';
    end if;
    if (v_df >= v_lf) is false then
      raise exception 'Rozładunek przed załadunkiem' using errcode = '22023';
    end if;
  end if;
  v_changed := (v_ld, v_dd, v_lf, v_lt, v_df, v_dt)
               is distinct from (l.plan_load_date, l.plan_delivery_date, l.plan_load_from, l.plan_load_to, l.plan_delivery_from, l.plan_delivery_to);
  if v_changed is not true then
    return jsonb_build_object('changed', false);
  end if;

  v_by := case when v_admin then 'HHL_ADMIN' else 'KSH' end;
  if v_admin then
    select coalesce(nullif(btrim(u.full_name), ''), split_part(u.email::text, '@', 1), '—') || ' // HHL'
      into v_label from app_users u where u.id = v_actor;
  else
    select coalesce(nullif(btrim(u.full_name), ''), split_part(u.email::text, '@', 1), '—') || ' // KSH'
      into v_label from app_users u where u.id = v_actor;
  end if;
  perform set_config('tower.dates_actor', v_label, true);
  perform set_config('tower.dates_ctx', 'on', true);
  update loads set plan_load_date = v_ld, plan_delivery_date = v_dd,
         plan_load_from = v_lf, plan_load_to = v_lt, plan_delivery_from = v_df, plan_delivery_to = v_dt,
         plan_dates_status = 'POTWIERDZONA', plan_dates_confirmed_by = v_actor, plan_dates_confirmed_at = now(),
         updated_at = now()
   where id = p_load;
  perform set_config('tower.dates_ctx', '', true);
  perform set_config('tower.dates_actor', '', true);

  v_code := public.load_sms_code(p_load);
  v_payload := jsonb_build_object(
    'code', v_code, 'by', v_by, 'status', 'POTWIERDZONA',
    'load_date', v_ld, 'delivery_date', v_dd,
    'before_load_date', l.plan_load_date, 'before_delivery_date', l.plan_delivery_date,
    'before_load_from', l.plan_load_from, 'before_load_to', l.plan_load_to,
    'before_delivery_from', l.plan_delivery_from, 'before_delivery_to', l.plan_delivery_to);
  -- P2: admin bez powiadamiania KSH (tylko HHL/SCX z macierzy — usuń odbiorców CLIENT).
  perform matrix_notify('LOAD_STATUS', 'PLAN_DATES_CHANGED', p_load, l.project_id, v_payload,
                        'PLAN_DATES:' || p_load || ':' || v_stamp);
  delete from notifications
   where user_id = v_actor and load_id = p_load and dedup_key like 'PLAN_DATES:' || p_load || ':' || v_stamp || ':%';
  if v_admin then
    delete from notifications n
     using app_users u, organizations o
     where n.user_id = u.id and u.org_id = o.id and o.kind = 'CLIENT'
       and n.load_id = p_load
       and n.dedup_key like 'PLAN_DATES:' || p_load || ':' || v_stamp || ':%';
  end if;

  -- P2: sprawa KSH_DATES_CHECK tylko z importu (A6) albo ze zmiany KSH — nie z edycji admina.
  if v_dates_odd and v_admin is not true then
    perform decision_open_from_event(
      l.project_id,
      'KSH_DATES_CHECK',
      'ksh-dates:' || p_load::text || ':' || v_stamp,
      public.l3_headed(v_code, 'daty KSH do sprawdzenia'),
      jsonb_build_object(
        'rule', 'D_0005', 'code', v_code,
        'load_date', v_ld, 'delivery_date', v_dd,
        'by', v_by
      ),
      p_load,
      null
    );
  end if;

  v_awiz := l.status = 'READY' or l.sailing_id is not null
            or nullif(btrim(l.ferry_booking_ref), '') is not null
            or (nullif(btrim(l.driver_name), '') is not null and nullif(btrim(l.tractor_plate), '') is not null);
  if v_awiz and (v_ld, v_dd, v_lf, v_df) is distinct from (l.plan_load_date, l.plan_delivery_date, l.plan_load_from, l.plan_delivery_from) then
    insert into load_events (load_id, event_type, occurred_at, actor_id, payload)
    values (p_load, 'SCHEDULE_DATE_CRITICAL', now(), v_actor,
            jsonb_build_object('code', v_code, 'by', v_by, 'actor', v_label,
                               'fields', to_jsonb(array['load_date','delivery_date']),
                               'before', jsonb_build_object('load_date', l.plan_load_date, 'delivery_date', l.plan_delivery_date),
                               'after', jsonb_build_object('load_date', v_ld, 'delivery_date', v_dd)));
    insert into notifications (channel, recipient, user_id, load_id, template, payload, dedup_key)
    select 'IN_APP', coalesce(u.email::text, u.id::text), u.id, p_load, 'SCHEDULE_DATE_CRITICAL',
           jsonb_build_object('code', v_code, 'fields', to_jsonb(array['load_date','delivery_date']),
                              'load_date', v_ld, 'delivery_date', v_dd, 'locale', u.locale),
           'SCHED_CRIT:KSH:' || p_load || ':' || v_stamp || ':' || u.id
      from app_users u join organizations o on o.id = u.org_id
     where u.active and (o.kind = 'FORWARDER' or (l.carrier_org_id is not null and u.org_id = l.carrier_org_id))
    on conflict (dedup_key) where dedup_key is not null do nothing;
  end if;

  return jsonb_build_object('changed', true, 'awizowany', v_awiz, 'load_date', v_ld, 'delivery_date', v_dd,
                            'dates_check', v_dates_odd);
end $$;

revoke all on function public.ksh_confirm_dates(uuid, date, date, timestamptz, timestamptz, timestamptz, timestamptz) from public, anon;
grant execute on function public.ksh_confirm_dates(uuid, date, date, timestamptz, timestamptz, timestamptz, timestamptz) to authenticated;
comment on function public.ksh_confirm_dates(uuid, date, date, timestamptz, timestamptz, timestamptz, timestamptz) is
  'G-20 + D-0005 + D-0930: kod w powiadomieniu to load_sms_code; sprawa KSH_DATES_CHECK nie z edycji admina.';

-- F7 #340: postoj sklada code z load_sms_code.

create or replace function public.dwell_scan(p_load uuid default null, p_now timestamptz default now())
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  d record;
  n int := 0;
  v_id uuid;
begin
  for r in
    select l.id, l.project_id, public.load_sms_code(l.id) as code
      from loads l
     where l.status is distinct from 'CANCELLED'
       and (p_load is null or l.id = p_load)
  loop
    for d in
      select * from dwell_measure(r.id, p_now) m
       where m.mode in ('HOURLY', 'DAILY') and m.hint_eur > 0
    loop
      v_id := decision_open_from_event(
        r.project_id, 'DWELL_OVER_FREE',
        'dwell:' || r.id::text || ':' || d.zone_kind || ':' || d.entered_at::text,
        public.l3_headed(r.code, 'Postój ponad czas wolny'),
        jsonb_build_object(
          'code', r.code,
          'zone', d.zone_kind,
          'entered_at', d.entered_at,
          'start_at', d.start_at,
          'exited_at', d.exited_at,
          'dwell_minutes', d.dwell_minutes,
          'free_minutes', d.free_minutes,
          'over_minutes', d.over_minutes,
          'mode', d.mode,
          'hint_eur', d.hint_eur,
          'preliminary', true,
          'note', 'Podpowiedź z Opcji (WSTĘPNE). Dopłatę wpisuje HHL ręcznie.'
        ),
        r.id, null
      );
      if v_id is not null then
        n := n + 1;
      end if;
    end loop;
  end loop;
  return n;
end $$;
revoke all on function public.dwell_scan(uuid, timestamptz) from public, anon, authenticated;

-- Status: payload ma kod transportu. Macierz daily jest tylko dla HHL.
-- Skrot L-13 dla CARRIER dostaje load_sms_code zamiast order_no.

create or replace function public.trg_load_status_matrix_notify() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status is not distinct from old.status then
    return null;
  end if;
  perform public.matrix_notify(
    'LOAD_STATUS', 'LOAD_STATUS_CHANGED', new.id, new.project_id,
    jsonb_build_object(
      'load_id', new.id, 'from', old.status, 'to', new.status,
      'code', public.load_sms_code(new.id), 'hhl_order_no', new.hhl_order_no
    ),
    'load-st:' || new.id::text || ':' || coalesce(old.status::text, '-') || '>' || new.status::text
  );
  return null;
end $$;
revoke all on function public.trg_load_status_matrix_notify() from public, anon, authenticated;

create or replace function public.matrix_notify(
  p_event_group text,
  p_template text,
  p_load_id uuid,
  p_project_id uuid,
  p_payload jsonb,
  p_dedup_prefix text,
  p_only_org_kind text default null
) returns int
language plpgsql security definer set search_path = public as $$
declare
  n int := 0;
  v_critical boolean;
  v_plan_dates boolean := (p_template = 'PLAN_DATES_CHANGED');
  v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
  v_decision text := coalesce(nullif(v_payload->>'decision_id', ''), nullif(v_payload->>'decisionId', ''));
  v_needs_transport boolean;
  v_source_alarm boolean;
  v_has_push_target boolean;
  v_kind text;
  v_order text;
  v_bundle text;
  v_event text;
  v_push_ok boolean;
  v_legacy_job boolean;
  v_src_bell_only boolean;
  r record;
begin
  if (p_event_group in ('LOAD_STATUS','RISK_FERRY_WEATHER','DECISION','MONEY','SYSTEM')) is not true then
    return 0;
  end if;
  if (p_template is not null and length(trim(p_template)) > 0) is not true then
    return 0;
  end if;
  if p_only_org_kind is not null
     and (p_only_org_kind in ('FORWARDER','CARRIER','CLIENT')) is not true then
    return 0;
  end if;

  if p_template = 'RISK_RESOLVED' then
    return 0;
  end if;

  if p_load_id is null and p_template in ('RISK_OPEN', 'RISK_SEVERITY') then
    if coalesce(v_payload->>'kind', '') not in ('USAGE_LIMIT', 'JOB_FAILURE')
       and coalesce(v_payload->>'title_key', '') is distinct from 'rk_source_down'
       and p_dedup_prefix not like 'SOURCE_DOWN%' then
      return 0;
    end if;
  end if;
  v_needs_transport := p_template in (
    'ZONE_ENTER', 'ZONE_EXIT', 'LOAD_STATUS_CHANGED',
    'PLAN_DATES_CHANGED', 'STATUS_CHANGE', 'LOAD_CHAT_MESSAGE', 'FEE_PROPOSED', 'FEE_DECIDED',
    'RESOURCE_MISSING', 'RESOURCE_DEADLINE', 'ORDER_NO_MISSING', 'HHL_ORDER_MISSING',
    'CARRIER_ORDER_MISSING', 'LOADING_UNCONFIRMED', 'AUTO_STATUS', 'DATES_UNCONFIRMED', 'SEQUENCE'
  );
  if v_needs_transport and p_load_id is null then
    return 0;
  end if;
  if (p_event_group = 'DECISION' or p_template like 'DECISION%')
     and v_decision is null and p_load_id is null then
    return 0;
  end if;

  v_event := coalesce(
    public.notify_event_key(p_template, v_payload),
    case p_event_group
      when 'LOAD_STATUS' then 'status'
      when 'DECISION' then 'dec_new'
      when 'RISK_FERRY_WEATHER' then 'risk_route'
      when 'MONEY' then 'inv_check'
      when 'SYSTEM' then 'src_down'
      else null
    end
  );
  if (v_event is not null and v_event is distinct from 'risk_general') is not true then
    return 0;
  end if;
  -- JOB_FAILURE / USAGE_LIMIT zostają w dzwonku HHL (jak dawna grupa SYSTEM).
  -- E-mail i telefon „źródło nie działa” tylko dla prawdziwego SOURCE_DOWN.
  v_legacy_job := coalesce(v_payload->>'kind', '') in ('JOB_FAILURE', 'USAGE_LIMIT')
    and p_template in ('RISK_OPEN', 'RISK_SEVERITY');
  -- Zwykłe RISK_OPEN grupy SYSTEM (cisza, kolejność, zadanie) — tylko dzwonek HHL, jak przed C3.
  -- E-mail i telefon zostają przy prawdziwym „źródło nie działa”.
  v_src_bell_only := v_event = 'src_down'
    and p_template in ('RISK_OPEN', 'RISK_SEVERITY')
    and coalesce(v_payload->>'title_key', '') is distinct from 'rk_source_down'
    and coalesce(p_dedup_prefix, '') not like 'SOURCE_DOWN%';

  v_payload := v_payload
    || jsonb_build_object('event_group', p_event_group, 'event_key', p_dedup_prefix, 'matrix_event', v_event);
  select order_no into v_order from loads where id = p_load_id;
  v_bundle := nullif(v_payload->>'bundle_key', '');
  v_kind := case
    when public.l13_email_is_critical(p_template, v_payload) then 'critical'
    else 'digest'
  end;

  insert into notifications (channel, recipient, user_id, load_id, template, payload, dedup_key)
  select 'IN_APP', coalesce(u.email::text, u.id::text), u.id, p_load_id, p_template,
         v_payload || jsonb_build_object('locale', u.locale),
         left(p_dedup_prefix || ':IN:' || u.id::text, 200)
    from app_users u
    join organizations o on o.id = u.org_id
    join notification_matrix m
      on m.event_key = v_event and m.role = u.role and m.risks_only is not true
   where u.active
     and u.role in ('HHL_ADMIN','HHL_OPS','CLIENT_USER','CARRIER_DISPATCH','CARRIER_USER')
     and (p_only_org_kind is null or o.kind::text = p_only_org_kind)
     and public.notify_person_on(u.id, v_event, 'bell', m.in_app, m.fixed_in_app) is true
     and public.notify_audience_ok(u.id, u.role::text, o.kind::text, p_template, v_payload)
     and (
       o.kind = 'FORWARDER'
       or (o.kind = 'CARRIER' and (
            p_load_id is null
            or exists (select 1 from loads l where l.id = p_load_id and l.carrier_org_id = o.id)))
       or (o.kind = 'CLIENT' and (
            p_project_id is null
            or exists (select 1 from projects p where p.id = p_project_id and p.client_org_id = o.id)
            or exists (select 1 from loads l join projects p on p.id = l.project_id
                        where l.id = p_load_id and p.client_org_id = o.id)))
     )
  on conflict (dedup_key) where dedup_key is not null do nothing;
  get diagnostics n = row_count;

  for r in
    select u.id as user_id, u.email::text as recipient, u.locale, o.kind as org_kind
      from app_users u
      join organizations o on o.id = u.org_id
      join notification_matrix m
        on m.event_key = v_event and m.role = u.role and m.risks_only is not true
       and public.notify_person_on(u.id, v_event, 'mail', m.email, m.fixed_email) is true
     where u.active and u.email is not null
       and u.role in ('HHL_ADMIN','HHL_OPS','CLIENT_USER','CARRIER_DISPATCH','CARRIER_USER')
       and (p_only_org_kind is null or o.kind::text = p_only_org_kind)
       and public.notify_audience_ok(u.id, u.role::text, o.kind::text, p_template, v_payload)
       and v_legacy_job is not true
       and v_src_bell_only is not true
       and (
         o.kind = 'FORWARDER'
         or (o.kind = 'CARRIER' and (
              p_load_id is null
              or exists (select 1 from loads l where l.id = p_load_id and l.carrier_org_id = o.id)))
         or (o.kind = 'CLIENT' and (
              p_project_id is null
              or exists (select 1 from projects p where p.id = p_project_id and p.client_org_id = o.id)
              or exists (select 1 from loads l join projects p on p.id = l.project_id
                          where l.id = p_load_id and p.client_org_id = o.id)))
       )
  loop
    perform public.l13_queue_email(
      v_kind, p_template, r.user_id, r.recipient, p_load_id,
      case when r.org_kind = 'CARRIER' then public.load_sms_code(p_load_id) else v_order end,
      v_payload || jsonb_build_object('locale', r.locale),
      left(p_dedup_prefix || ':EM:' || r.user_id::text, 200),
      case when v_kind = 'critical' then v_bundle else null end
    );
  end loop;
  perform public.l13_email_guard_note(now());

  v_critical := (
    coalesce(v_payload->>'severity', '') = 'CRITICAL'
    or p_template ilike '%CRITICAL%'
    or p_template in ('FERRY_CANCELLED', 'SCHEDULE_DATE_CRITICAL')
  );
  v_source_alarm := (
    p_dedup_prefix like 'SOURCE_DOWN%'
    or coalesce(v_payload->>'title_key', '') = 'rk_source_down'
    or coalesce(v_payload->>'kind', '') in ('JOB_FAILURE', 'SOURCE_DOWN')
    or p_template in ('SOURCE_DOWN', 'JOB_FAILURE')
  );
  v_has_push_target := p_load_id is not null or v_decision is not null or v_source_alarm;
  v_push_ok := v_legacy_job is not true and v_src_bell_only is not true
    and ((v_critical is true and v_has_push_target is true) or v_event = 'chat' or v_event = 'app_err');
  if v_push_ok is true then
  insert into notifications (channel, recipient, user_id, load_id, template, payload, dedup_key, status)
  select 'WEB_PUSH', coalesce(u.email::text, u.id::text), u.id, p_load_id, p_template,
         v_payload || jsonb_build_object('locale', u.locale)
           || case when v_event = 'chat' then '{}'::jsonb
                   else jsonb_build_object('critical', true) end,
         left(p_dedup_prefix || ':WP:' || u.id::text, 200),
         'PENDING'
    from app_users u
    join organizations o on o.id = u.org_id
    join notification_matrix m
      on m.event_key = v_event and m.role = u.role and m.risks_only is not true
     and public.notify_person_on(u.id, v_event, 'push', m.push, m.fixed_push) is true
    left join user_preferences pref on pref.user_id = u.id
   where u.active
     and u.role in ('HHL_ADMIN','HHL_OPS','CLIENT_USER','CARRIER_DISPATCH','CARRIER_USER')
     and public.notify_audience_ok(u.id, u.role::text, o.kind::text, p_template, v_payload)
     and coalesce(pref.web_push_enabled, true) is true
     and exists (select 1 from push_subscriptions ps where ps.user_id = u.id)
     and (p_only_org_kind is null or o.kind::text = p_only_org_kind)
     and (
       v_source_alarm is not true
       or (o.kind = 'FORWARDER' and u.role in ('HHL_ADMIN', 'HHL_OPS'))
     )
     and (
       o.kind = 'FORWARDER'
       or (o.kind = 'CARRIER' and (
            p_load_id is null
            or exists (select 1 from loads l where l.id = p_load_id and l.carrier_org_id = o.id)))
       or (o.kind = 'CLIENT' and (
            p_project_id is null
            or exists (select 1 from projects p where p.id = p_project_id and p.client_org_id = o.id)
            or exists (select 1 from loads l join projects p on p.id = l.project_id
                        where l.id = p_load_id and p.client_org_id = o.id)))
     )
  on conflict (dedup_key) where dedup_key is not null do nothing;

  -- C16 N4 / W42: bez urządzenia → EMAIL zapasowy (czat zostaje bez e-maila — C3)
  if v_event is distinct from 'chat' then
  insert into notifications (channel, recipient, user_id, load_id, template, payload, dedup_key, status)
  select 'EMAIL', coalesce(u.email::text, u.id::text), u.id, p_load_id, p_template,
         v_payload || jsonb_build_object('locale', u.locale, 'critical', true, 'push_fallback', true),
         left('push_fallback:nosub:' || p_dedup_prefix || ':' || u.id::text, 200),
         'PENDING'
    from app_users u
    join organizations o on o.id = u.org_id
    join notification_matrix m
      on m.event_key = v_event and m.role = u.role and m.risks_only is not true
     and public.notify_person_on(u.id, v_event, 'push', m.push, m.fixed_push) is true
    left join user_preferences pref on pref.user_id = u.id
   where u.active and u.email is not null
     and u.role in ('HHL_ADMIN','HHL_OPS','CLIENT_USER','CARRIER_DISPATCH','CARRIER_USER')
     and public.notify_audience_ok(u.id, u.role::text, o.kind::text, p_template, v_payload)
     and coalesce(pref.web_push_enabled, true) is true
     and not exists (select 1 from push_subscriptions ps where ps.user_id = u.id)
     and (p_only_org_kind is null or o.kind::text = p_only_org_kind)
     and (
       v_source_alarm is not true
       or (o.kind = 'FORWARDER' and u.role in ('HHL_ADMIN', 'HHL_OPS'))
     )
     and (
       o.kind = 'FORWARDER'
       or (o.kind = 'CARRIER' and (
            p_load_id is null
            or exists (select 1 from loads l where l.id = p_load_id and l.carrier_org_id = o.id)))
       or (o.kind = 'CLIENT' and (
            p_project_id is null
            or exists (select 1 from projects p where p.id = p_project_id and p.client_org_id = o.id)
            or exists (select 1 from loads l join projects p on p.id = l.project_id
                        where l.id = p_load_id and p.client_org_id = o.id)))
     )
  on conflict (dedup_key) where dedup_key is not null do nothing;
  end if;
  end if;

  return n;
end $$;


comment on function public.matrix_notify(text, text, uuid, uuid, jsonb, text, text) is
  'C3 + D-0930: skrot L-13 dla CARRIER ma kod transportu, nie numer KSH.';
