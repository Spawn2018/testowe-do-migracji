-- C3-p (D-20261017-0730-01): czat bez e-maila zapasowego; treść push; kopia macierzy sprzed 0222;
-- osobne wiersze 50 km / źródło; usunięcie AUTOMATIC_DECISION_EMAIL.

-- 1) Kopia 25 wierszy macierzy sprzed 0222 (stan po 0201+0202: 5 grup × 5 ról) → Historia „było”.
do $kopia$
declare
  v_rows jsonb;
begin
  select jsonb_agg(row_to_json(t) order by t.event_group, t.role)
    into v_rows
    from (
      select g.g as event_group, r.r as role,
             case
               when g.g = 'SYSTEM' then (r.r in ('HHL_ADMIN','HHL_OPS'))
               when g.g = 'DECISION' and r.r = 'CLIENT_USER' then false
               else true
             end as in_app,
             false as email,
             case
               when g.g in ('RISK_FERRY_WEATHER', 'DECISION') then true
               else false
             end as push
        from (values
          ('LOAD_STATUS'),('RISK_FERRY_WEATHER'),('DECISION'),('MONEY'),('SYSTEM')
        ) as g(g)
        cross join (values
          ('HHL_ADMIN'),('HHL_OPS'),('CLIENT_USER'),('CARRIER_DISPATCH'),('CARRIER_USER')
        ) as r(r)
    ) t;
  if (jsonb_array_length(v_rows) = 25) is not true then
    raise exception 'C3-p: oczekiwano 25 wierszy kopii macierzy, jest %', jsonb_array_length(v_rows);
  end if;
  insert into public.audit_log (user_id, action, entity, entity_id, new_value)
  values (
    null,
    'C3_MATRIX_KOPIA',
    'notification_matrix',
    'pre_0222',
    jsonb_build_object('rows', v_rows, 'count', 25, 'note', 'stan sprzed migracji 0222 (5 grup × 5 ról, push wg 0202)')
  );
end;
$kopia$;

-- 2) Osobne wiersze: 50 km plac / Śrem; źródło nie działa / wróciło.
delete from public.notification_matrix where event_key = 'pre_arrival';

insert into public.notification_matrix (
  event_key, event_group, role, in_app, email, push,
  fixed_in_app, fixed_email, fixed_push, risks_only, label_pl
) values
('pre_arrival_site','LOAD_STATUS','HHL_ADMIN',false,false,false,false,false,false,false,'Auto 50 km przed placem'),
('pre_arrival_site','LOAD_STATUS','HHL_OPS',false,false,false,false,false,false,false,'Auto 50 km przed placem'),
('pre_arrival_site','LOAD_STATUS','CLIENT_USER',true,false,false,false,false,false,false,'Auto 50 km przed placem'),
('pre_arrival_site','LOAD_STATUS','CARRIER_DISPATCH',true,false,false,false,false,false,false,'Auto 50 km przed placem'),
('pre_arrival_site','LOAD_STATUS','CARRIER_USER',false,false,false,false,false,false,false,'Auto 50 km przed placem'),
('pre_arrival_srem','LOAD_STATUS','HHL_ADMIN',false,false,false,false,false,false,false,'Auto 50 km przed Śremem'),
('pre_arrival_srem','LOAD_STATUS','HHL_OPS',false,false,false,false,false,false,false,'Auto 50 km przed Śremem'),
('pre_arrival_srem','LOAD_STATUS','CLIENT_USER',true,false,false,false,false,false,false,'Auto 50 km przed Śremem'),
('pre_arrival_srem','LOAD_STATUS','CARRIER_DISPATCH',true,false,false,false,false,false,false,'Auto 50 km przed Śremem'),
('pre_arrival_srem','LOAD_STATUS','CARRIER_USER',false,false,false,false,false,false,false,'Auto 50 km przed Śremem')
on conflict (event_key, role) do update
  set label_pl = excluded.label_pl,
      in_app = excluded.in_app,
      email = excluded.email,
      push = excluded.push;

update public.notification_matrix
   set label_pl = 'Źródło danych nie działa'
 where event_key = 'src_down';

insert into public.notification_matrix (
  event_key, event_group, role, in_app, email, push,
  fixed_in_app, fixed_email, fixed_push, risks_only, label_pl
) values
('src_back','SYSTEM','HHL_ADMIN',true,true,true,false,true,true,false,'Źródło danych wróciło'),
('src_back','SYSTEM','HHL_OPS',false,false,false,false,false,false,false,'Źródło danych wróciło')
on conflict (event_key, role) do update
  set label_pl = excluded.label_pl,
      in_app = excluded.in_app,
      email = excluded.email,
      push = excluded.push,
      fixed_email = excluded.fixed_email,
      fixed_push = excluded.fixed_push;

insert into public.notification_copy (id, subject_pl, body_pl) values
  ('PRE_ARRIVAL_SITE', '{{code}}: auto 50 km przed placem — {{site}}',
   'Auto {{trailer}} jest ok. 50 km przed placem: {{site}} (o {{time}}). Przyjazd ok. {{arrival}}.'),
  ('PRE_ARRIVAL_SREM', '{{code}}: auto 50 km przed Śremem',
   'Auto {{trailer}} jest ok. 50 km przed Śremem (o {{time}}).')
on conflict (id) do update
  set subject_pl = excluded.subject_pl, body_pl = excluded.body_pl;

-- 3) Usunięcie AUTOMATIC_DECISION_EMAIL z kopią.
do $flag$
declare
  v_enabled boolean;
begin
  select enabled into v_enabled from public.security_flags where key = 'AUTOMATIC_DECISION_EMAIL';
  if found then
    insert into public.audit_log (user_id, action, entity, entity_id, old_value, new_value)
    values (
      null,
      'C3P_REMOVE_FLAG',
      'security_flags',
      'AUTOMATIC_DECISION_EMAIL',
      jsonb_build_object('enabled', v_enabled),
      jsonb_build_object('removed', true, 'reason', 'E5/E11: tylko wiersz macierzy dec_new')
    );
    delete from public.security_flags where key = 'AUTOMATIC_DECISION_EMAIL';
  end if;
end;
$flag$;

create or replace function public.notify_event_key(p_template text, p_payload jsonb)
returns text
language sql
immutable
as $$
  select case
    when p_template = 'LOAD_CHAT_MESSAGE' then 'chat'
    when p_template = 'PLAN_DATES_CHANGED' then 'dates'
    when p_template in ('LOAD_STATUS_CHANGED', 'STATUS_CHANGE') then 'status'
    when p_template in ('ZONE_ENTER', 'GEOFENCE_ENTER')
         and coalesce(p_payload->>'geofence_kind', '') = 'PRE_PORT' then 'pre_port'
    when p_template in ('ZONE_ENTER', 'GEOFENCE_ENTER')
         and coalesce(p_payload->>'geofence_kind', '') = 'PRE_ARRIVAL'
         and (
           upper(coalesce(p_payload->>'geofence_country', p_payload->>'country', '')) = 'PL'
           or coalesce(p_payload->>'geofence_name', '') ilike '%srem%'
           or coalesce(p_payload->>'geofence_name', '') ilike '%śrem%'
         ) then 'pre_arrival_srem'
    when p_template in ('ZONE_ENTER', 'GEOFENCE_ENTER')
         and coalesce(p_payload->>'geofence_kind', '') = 'PRE_ARRIVAL' then 'pre_arrival_site'
    when p_template in ('ZONE_EXIT', 'GEOFENCE_EXIT', 'GEOFENCE_DWELL') then 'zone'
    when p_template in ('ZONE_ENTER', 'GEOFENCE_ENTER') then 'zone'
    when p_template = 'PRE_ARRIVAL_PL' then 'pre_arrival_srem'
    when p_template in ('PRE_ARRIVAL', 'PRE_ARRIVAL_SE') then 'pre_arrival_site'
    when p_template = 'PRE_PORT' then 'pre_port'
    when p_template = 'SCX_DETOUR_CHOICE' then 'scx_detour'
    when p_template = 'DECISION_ESCALATED' then 'dec_late'
    when p_template in ('DECISION_OPEN', 'DECISION_RESOLVED') then 'dec_new'
    when p_template in ('RESOURCE_DEADLINE', 'RESOURCE_MISSING') then 'res_missing'
    when p_template in ('ORDER_NO_MISSING', 'HHL_ORDER_MISSING', 'CARRIER_ORDER_MISSING') then 'order_no'
    when p_template in ('DOC_MISSING', 'CMR_MISSING') then 'cmr'
    when p_template in ('RISK_OPEN', 'RISK_SEVERITY')
         and coalesce(p_payload->>'kind', '') in ('DOC_MISSING', 'PERMIT', 'INSURANCE') then 'cmr'
    when p_template in ('RISK_OPEN', 'RISK_SEVERITY')
         and coalesce(p_payload->>'kind', '') = 'RESOURCE_MISSING' then 'res_missing'
    when p_template in ('RISK_OPEN', 'RISK_SEVERITY')
         and (
           coalesce(p_payload->>'title_key', '') in ('rk_order_no', 'rk_test_orderno')
           or coalesce(p_payload->>'kind', '') in ('ORDER_NO', 'HHL_ORDER_MISSING', 'CARRIER_ORDER_MISSING')
         ) then 'order_no'
    when p_template = 'SOURCE_BACK' then 'src_back'
    when coalesce(p_payload->>'kind', '') in ('USAGE_LIMIT', 'JOB_FAILURE')
         or p_template in ('JOB_FAILURE', 'SOURCE_DOWN') then 'src_down'
    when p_template = 'APP_ERROR' then 'app_err'
    when p_template in ('SMS_GATEWAY_SILENT', 'SMS_UNDELIVERED', 'SMS_FALLBACK', 'ZONE_LIMIT') then 'sms_gw'
    when p_template in ('DAILY_DIGEST', 'ADMIN_DIGEST') then 'daily'
    when p_template = 'INVOICE_NEW' then 'inv_check'
    when p_template in ('INVOICE_DISPUTED', 'INVOICE_DISPUTE_REPLY', 'INVOICE_DISPUTE_RESOLVED') then 'inv_dispute'
    when p_template in ('WEEK_CLOSED', 'INVOICE_WEEK') then 'week'
    when p_template like 'FACTOR%' then 'factoring'
    when p_template in ('RISK_OPEN', 'RISK_SEVERITY')
         and coalesce(p_payload->>'kind', '') in ('FERRY', 'WEATHER', 'ROAD_SE', 'ROAD_PL', 'ETA_BREACH')
         and coalesce(p_payload->>'severity', '') = 'CRITICAL' then 'risk_crit'
    when p_template in ('RISK_OPEN', 'RISK_SEVERITY')
         and coalesce(p_payload->>'kind', '') in ('FERRY', 'WEATHER', 'ROAD_SE', 'ROAD_PL', 'ETA_BREACH') then 'risk_route'
    when p_template in ('ROAD_RISK', 'FERRY_CANCELLED', 'FERRY_OVERDUE')
         and coalesce(p_payload->>'severity', '') = 'CRITICAL' then 'risk_crit'
    when p_template in ('ROAD_RISK', 'FERRY_CANCELLED', 'FERRY_OVERDUE') then 'risk_route'
    when p_template in ('FERRY', 'WEATHER', 'ROAD_SE', 'ROAD_PL')
         and nullif(coalesce(p_payload->>'load_id', ''), '') is null then 'risk_general'
    else null
  end
$$;

alter function public.notify_event_key(text, jsonb) set search_path = public;

revoke all on function public.notify_event_key(text, jsonb) from public, anon, authenticated;

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
    select u.id as user_id, u.email::text as recipient, u.locale
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
      v_kind, p_template, r.user_id, r.recipient, p_load_id, v_order,
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
  'C3: macierz po zdarzeniu + ustawienie osoby; czat na telefon bez e-maila; KSH bez stref i zadań innych firm.';

create or replace function public.notify_load_chat_message()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_project uuid;
  v_code text;
  v_preview text;
begin
  select l.project_id,
         coalesce(nullif(trim(l.hhl_order_no), ''), nullif(trim(l.order_no), ''), left(l.id::text, 8))
    into v_project, v_code
    from loads l
   where l.id = new.load_id;
  v_preview := left(regexp_replace(coalesce(new.body, ''), '\s+', ' ', 'g'), 120);
  perform public.matrix_notify(
    'LOAD_STATUS',
    'LOAD_CHAT_MESSAGE',
    new.load_id,
    v_project,
    jsonb_build_object(
      'load_code', v_code,
      'preview', v_preview,
      'author_org', new.author_org,
      'author_display', coalesce(new.author_display, new.author_org),
      'author_id', new.author_id,
      'visible_to', to_jsonb(new.visible_to)
    ),
    'CHAT:' || new.id::text
  );
  delete from notifications
   where load_id = new.load_id
     and template = 'LOAD_CHAT_MESSAGE'
     and user_id = new.author_id
     and dedup_key like 'CHAT:' || new.id::text || ':%';
  return new;
end $$;

comment on function public.notify_load_chat_message() is
  'C3 Cz13/Cz25: czat według macierzy chat; odbiorcy z visible_to, bez autora.';

-- Otwarcie decyzji: e-mail z wiersza „Nowa decyzja”, nie z dowolnego wiersza grupy DECISION.
create or replace function public.l13_decision_email(p_decision uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  d decisions%rowtype;
  v_role text;
  v_sev text;
  v_kind text;
  v_bundle text;
  v_order text;
  v_payload jsonb;
  r record;
begin
  if public.l13_automatic_decision_email() is not true then
    return;
  end if;
  select * into d from decisions where id = p_decision;
  if not found then
    return;
  end if;
  select decider_role, severity_default into v_role, v_sev
    from decision_types where code = d.type_code;
  v_kind := case when v_sev = 'CRITICAL' or d.type_code = 'FERRY_CANCELLED' then 'critical' else 'digest' end;
  v_bundle := coalesce(
    nullif(d.detail->>'bundle_key', ''),
    nullif(d.detail->>'sailing_id', ''),
    d.type_code || ':' || coalesce(d.detail->>'event_key', d.id::text)
  );
  select order_no into v_order from loads where id = d.load_id;
  v_payload := jsonb_build_object(
    'decision_id', d.id, 'type', d.type_code, 'title', d.title,
    'status', d.status, 'event', 'OPEN', 'severity', v_sev,
    'bundle_key', v_bundle, 'level', case when v_kind = 'critical' then 'critical' else 'info' end
  );
  for r in
    select distinct u.id as user_id, u.email::text as recipient, u.locale
      from app_users u
      join organizations o on o.id = u.org_id
      join notification_matrix m
        on m.event_key = 'dec_new' and m.role = u.role and m.email
     where u.active and u.email is not null
       and (
         o.kind = 'FORWARDER'
         or (o.kind = 'CARRIER' and v_role = 'CARRIER' and (
              d.load_id is null
              or exists (select 1 from loads l where l.id = d.load_id and l.carrier_org_id = o.id)))
         or (o.kind = 'CLIENT' and (
              d.project_id is null
              or exists (select 1 from projects pr where pr.id = d.project_id and pr.client_org_id = o.id)))
       )
  loop
    perform public.l13_queue_email(
      v_kind, 'DECISION_OPEN', r.user_id, r.recipient, d.load_id, v_order,
      v_payload || jsonb_build_object('locale', r.locale),
      left('dec:OPEN:' || d.id::text || ':EM:' || r.user_id::text, 200),
      case when v_kind = 'critical' then v_bundle else null end
    );
  end loop;
  perform public.l13_email_guard_note(now());
end $$;

revoke all on function public.matrix_notify(text, text, uuid, uuid, jsonb, text, text) from public, anon, authenticated;
grant execute on function public.matrix_notify(text, text, uuid, uuid, jsonb, text, text) to service_role;

comment on function public.matrix_notify(text, text, uuid, uuid, jsonb, text, text) is
  'C3-p: macierz po zdarzeniu; czat WEB_PUSH bez critical (bez e-maila zapasowego); ZONE PRE_* → osobne wiersze.';

create or replace function public.notify_load_chat_message()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_project uuid;
  v_code text;
  v_preview text;
  v_who text;
  v_firm text;
  v_title text;
  v_body text;
begin
  select l.project_id,
         coalesce(nullif(trim(l.hhl_order_no), ''), nullif(trim(l.order_no), ''), left(l.id::text, 8))
    into v_project, v_code
    from loads l
   where l.id = new.load_id;
  v_preview := left(regexp_replace(coalesce(new.body, ''), '\s+', ' ', 'g'), 120);
  v_who := coalesce(nullif(trim(new.author_display), ''), nullif(trim(new.author_org), ''), 'osoba');
  v_firm := coalesce(nullif(trim(new.author_org), ''), 'firma');
  v_title := v_code || ' — ' || v_who || ' // ' || v_firm;
  v_body := left(regexp_replace(coalesce(new.body, ''), '\s+', ' ', 'g'), 500);
  perform public.matrix_notify(
    'LOAD_STATUS',
    'LOAD_CHAT_MESSAGE',
    new.load_id,
    v_project,
    jsonb_build_object(
      'load_code', v_code,
      'preview', v_preview,
      'title', v_title,
      'body', v_body,
      'author_org', new.author_org,
      'author_display', coalesce(new.author_display, new.author_org),
      'author_id', new.author_id,
      'visible_to', to_jsonb(new.visible_to)
    ),
    'CHAT:' || new.id::text
  );
  delete from notifications
   where load_id = new.load_id
     and template = 'LOAD_CHAT_MESSAGE'
     and user_id = new.author_id
     and dedup_key like 'CHAT:' || new.id::text || ':%';
  return new;
end $$;

comment on function public.notify_load_chat_message() is
  'C3 Cz13/Cz25: czat według macierzy chat; odbiorcy z visible_to, bez autora.';

-- Otwarcie decyzji: e-mail z wiersza „Nowa decyzja”, nie z dowolnego wiersza grupy DECISION.
create or replace function public.l13_decision_email(p_decision uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  d decisions%rowtype;
  v_role text;
  v_sev text;
  v_kind text;
  v_bundle text;
  v_order text;
  v_payload jsonb;
  r record;
begin
  if public.l13_automatic_decision_email() is not true then
    return;
  end if;
  select * into d from decisions where id = p_decision;
  if not found then
    return;
  end if;
  select decider_role, severity_default into v_role, v_sev
    from decision_types where code = d.type_code;
  v_kind := case when v_sev = 'CRITICAL' or d.type_code = 'FERRY_CANCELLED' then 'critical' else 'digest' end;
  v_bundle := coalesce(
    nullif(d.detail->>'bundle_key', ''),
    nullif(d.detail->>'sailing_id', ''),
    d.type_code || ':' || coalesce(d.detail->>'event_key', d.id::text)
  );
  select order_no into v_order from loads where id = d.load_id;
  v_payload := jsonb_build_object(
    'decision_id', d.id, 'type', d.type_code, 'title', d.title,
    'status', d.status, 'event', 'OPEN', 'severity', v_sev,
    'bundle_key', v_bundle, 'level', case when v_kind = 'critical' then 'critical' else 'info' end
  );
  for r in
    select distinct u.id as user_id, u.email::text as recipient, u.locale
      from app_users u
      join organizations o on o.id = u.org_id
      join notification_matrix m
        on m.event_key = 'dec_new' and m.role = u.role and m.email
     where u.active and u.email is not null
       and (
         o.kind = 'FORWARDER'
         or (o.kind = 'CARRIER' and v_role = 'CARRIER' and (
              d.load_id is null
              or exists (select 1 from loads l where l.id = d.load_id and l.carrier_org_id = o.id)))
         or (o.kind = 'CLIENT' and (
              d.project_id is null
              or exists (select 1 from projects pr where pr.id = d.project_id and pr.client_org_id = o.id)))
       )
  loop
    perform public.l13_queue_email(
      v_kind, 'DECISION_OPEN', r.user_id, r.recipient, d.load_id, v_order,
      v_payload || jsonb_build_object('locale', r.locale),
      left('dec:OPEN:' || d.id::text || ':EM:' || r.user_id::text, 200),
      case when v_kind = 'critical' then v_bundle else null end
    );
  end loop;
  perform public.l13_email_guard_note(now());
end $$;

revoke all on function public.notify_load_chat_message() from public, anon, authenticated;
comment on function public.notify_load_chat_message() is
  'C3-p: czat — title/body na telefon; bez critical; visible_to.';

create or replace function public.l13_decision_email(p_decision uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  d decisions%rowtype;
  v_role text;
  v_sev text;
  v_kind text;
  v_bundle text;
  v_order text;
  v_payload jsonb;
  r record;
begin
  -- C3-p / E5: tylko wiersz macierzy „Nowa decyzja” (dec_new); flaga AUTOMATIC_DECISION_EMAIL usunięta.
  select * into d from decisions where id = p_decision;
  if not found then
    return;
  end if;
  select decider_role, severity_default into v_role, v_sev
    from decision_types where code = d.type_code;
  v_kind := case when v_sev = 'CRITICAL' or d.type_code = 'FERRY_CANCELLED' then 'critical' else 'digest' end;
  v_bundle := coalesce(
    nullif(d.detail->>'bundle_key', ''),
    nullif(d.detail->>'sailing_id', ''),
    d.type_code || ':' || coalesce(d.detail->>'event_key', d.id::text)
  );
  select order_no into v_order from loads where id = d.load_id;
  v_payload := jsonb_build_object(
    'decision_id', d.id, 'type', d.type_code, 'title', d.title,
    'status', d.status, 'event', 'OPEN', 'severity', v_sev,
    'bundle_key', v_bundle, 'level', case when v_kind = 'critical' then 'critical' else 'info' end
  );
  for r in
    select distinct u.id as user_id, u.email::text as recipient, u.locale
      from app_users u
      join organizations o on o.id = u.org_id
      join notification_matrix m
        on m.event_key = 'dec_new' and m.role = u.role and m.email
     where u.active and u.email is not null
       and (
         o.kind = 'FORWARDER'
         or (o.kind = 'CARRIER' and v_role = 'CARRIER' and (
              d.load_id is null
              or exists (select 1 from loads l where l.id = d.load_id and l.carrier_org_id = o.id)))
         or (o.kind = 'CLIENT' and (
              d.project_id is null
              or exists (select 1 from projects pr where pr.id = d.project_id and pr.client_org_id = o.id)))
       )
  loop
    perform public.l13_queue_email(
      v_kind, 'DECISION_OPEN', r.user_id, r.recipient, d.load_id, v_order,
      v_payload || jsonb_build_object('locale', r.locale),
      left('dec:OPEN:' || d.id::text || ':EM:' || r.user_id::text, 200),
      case when v_kind = 'critical' then v_bundle else null end
    );
  end loop;
  perform public.l13_email_guard_note(now());
end $$;

revoke all on function public.l13_decision_email(uuid) from public, anon, authenticated;
comment on function public.l13_decision_email(uuid) is
  'C3-p: e-mail decyzji tylko z wiersza macierzy dec_new (bez AUTOMATIC_DECISION_EMAIL).';

create or replace function public.web_push_enqueue_fallback(p_notification_id bigint)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_dedup text;
  v_url text;
  v_title text;
  v_body text;
  v_ins int;
begin
  select n.id, n.user_id, n.recipient, n.load_id, n.template, n.payload, n.status, n.delivered_at, n.created_at
    into r
    from notifications n
   where n.id = p_notification_id
     and n.channel = 'WEB_PUSH';
  if not found then
    return false;
  end if;
  -- H1: tylko po granicy potwierdzeń
  if r.created_at < public.c16h_web_push_ack_boundary() then
    return false;
  end if;
  -- H1: tylko pilne (C1); RISK_RESOLVED nie jest pilne
  if r.template = 'RISK_RESOLVED' then
    return false;
  end if;
  if r.template = 'LOAD_CHAT_MESSAGE' then
    return false;
  end if;
  if coalesce(r.payload->>'critical', '') is distinct from 'true'
     and r.template not in ('FERRY_CANCELLED', 'SCHEDULE_DATE_CRITICAL', 'SOURCE_DOWN', 'JOB_FAILURE')
     and r.template not ilike '%CRITICAL%' then
    return false;
  end if;
  if r.delivered_at is not null then
    return false;
  end if;
  if (r.user_id is not null) is not true
     or (r.recipient is not null and length(trim(r.recipient)) >= 3) is not true then
    return false;
  end if;
  if r.status is distinct from 'ERROR' and r.status is distinct from 'SENT' then
    return false;
  end if;

  v_dedup := left('push_fallback:' || r.id::text, 200);
  v_title := coalesce(r.payload->>'title', 'Watch Tower');
  v_body := coalesce(r.payload->>'body', r.template);
  v_url := coalesce(nullif(r.payload->>'url', ''), nullif(r.payload->>'href', ''), '/');
  if v_url like '%/brak' then
    v_url := '/';
  end if;

  insert into notifications (channel, recipient, user_id, load_id, template, payload, dedup_key, status)
  values (
    'EMAIL',
    trim(r.recipient),
    r.user_id,
    r.load_id,
    r.template,
    coalesce(r.payload, '{}'::jsonb) || jsonb_build_object(
      'title', v_title,
      'body', v_body,
      'url', v_url,
      'push_fallback', true
    ),
    v_dedup,
    'PENDING'
  )
  on conflict (dedup_key) where dedup_key is not null do nothing;
  get diagnostics v_ins = row_count;
  return v_ins > 0;
end $$;

revoke all on function public.web_push_enqueue_fallback(bigint) from public, anon, authenticated;
grant execute on function public.web_push_enqueue_fallback(bigint) to service_role;
comment on function public.web_push_enqueue_fallback(bigint) is
  'C16-H / C3-p: EMAIL zapasowy bez LOAD_CHAT_MESSAGE i bez RISK_RESOLVED.';

create or replace function public.web_push_fallback_tick()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  n int := 0;
  rec record;
  ok boolean;
  v_bound timestamptz := public.c16h_web_push_ack_boundary();
begin
  for rec in
    select id from notifications n
     where channel = 'WEB_PUSH'
       and status = 'ERROR'
       and (error = 'no_sub' or error like 'push_%')
       and delivered_at is null
       and created_at >= v_bound
       and created_at > now() - interval '7 days'
       and template is distinct from 'RISK_RESOLVED'
       and template is distinct from 'LOAD_CHAT_MESSAGE'
       and (
         coalesce(payload->>'critical', '') = 'true'
         or template in ('FERRY_CANCELLED', 'SCHEDULE_DATE_CRITICAL', 'SOURCE_DOWN', 'JOB_FAILURE')
         or template ilike '%CRITICAL%'
       )
       and not exists (
         select 1 from notifications f
          where f.dedup_key = 'push_fallback:' || n.id::text
       )
     order by id
     limit 80
  loop
    ok := web_push_enqueue_fallback(rec.id);
    if ok then n := n + 1; end if;
  end loop;

  for rec in
    select id from notifications n
     where channel = 'WEB_PUSH'
       and status = 'SENT'
       and delivered_at is null
       and sent_at is not null
       and sent_at <= now() - interval '5 minutes'
       and sent_at > now() - interval '7 days'
       and created_at >= v_bound
       and template is distinct from 'RISK_RESOLVED'
       and template is distinct from 'LOAD_CHAT_MESSAGE'
       and (
         coalesce(payload->>'critical', '') = 'true'
         or template in ('FERRY_CANCELLED', 'SCHEDULE_DATE_CRITICAL', 'SOURCE_DOWN', 'JOB_FAILURE')
         or template ilike '%CRITICAL%'
       )
       and not exists (
         select 1 from notifications f
          where f.dedup_key = 'push_fallback:' || n.id::text
       )
     order by id
     limit 80
  loop
    ok := web_push_enqueue_fallback(rec.id);
    if ok then n := n + 1; end if;
  end loop;

  return n;
end $$;

revoke all on function public.web_push_fallback_tick() from public, anon, authenticated;
grant execute on function public.web_push_fallback_tick() to service_role;
comment on function public.web_push_fallback_tick() is
  'C16-H / C3-p: tick zapasu; wyklucza LOAD_CHAT_MESSAGE.';

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
  if (
    p_event_group = 'SYSTEM'
    or p_event_group in ('sms_gw', 'src_down', 'src_back', 'app_err', 'daily')
  ) and p_role not in ('HHL_ADMIN', 'HHL_OPS') then
    raise exception 'Zdarzenia systemowe — tylko HHL' using errcode = '22023';
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

-- l13_automatic_decision_email zostaje jako stub (false) dla starych wywołań.
create or replace function public.l13_automatic_decision_email()
returns boolean
language sql
stable
set search_path = public
as $$
  select false;
$$;
revoke all on function public.l13_automatic_decision_email() from public, anon, authenticated;
comment on function public.l13_automatic_decision_email() is
  'C3-p: zawsze false — decyzje e-mail tylko z macierzy dec_new.';
