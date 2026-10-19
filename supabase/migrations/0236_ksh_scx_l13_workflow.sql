-- D-20261020-0040-01 (#343): numer KSH nie trafia do SCX z l13_decision_email ani z reguły workflow.
-- Ta sama migracja 0236 będzie rozszerzona o A3 i A9 (osobne commity, jedno F7).

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
    select distinct u.id as user_id, u.email::text as recipient, u.locale, o.kind as org_kind
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
      v_kind, 'DECISION_OPEN', r.user_id, r.recipient, d.load_id,
      case when r.org_kind = 'CARRIER' then nullif(public.load_sms_code(d.load_id), '—') else v_order end,
      v_payload || jsonb_build_object('locale', r.locale),
      left('dec:OPEN:' || d.id::text || ':EM:' || r.user_id::text, 200),
      case when v_kind = 'critical' then v_bundle else null end
    );
  end loop;
  perform public.l13_email_guard_note(now());
end $$;

revoke all on function public.l13_decision_email(uuid) from public, anon, authenticated;
comment on function public.l13_decision_email(uuid) is
  'C3-p: e-mail decyzji tylko z wiersza macierzy dec_new (bez AUTOMATIC_DECISION_EMAIL). D-20261020-0040: CARRIER dostaje kod transportu.';

-- Kontekst reguly: nigdy left(id, 8). Numer KSH zostaje dla HHL; SCX dostaje kod w wf_action.
create or replace function wf_load_context(p_load uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', l.id,
    'code', coalesce(nullif(btrim(l.order_no), ''), nullif(public.load_sms_code(l.id), '—')),
    'status', l.status,
    'plan_load_date', l.plan_load_date, 'plan_delivery_date', l.plan_delivery_date,
    'plan_dates_status', l.plan_dates_status, 'has_carrier', l.carrier_org_id is not null,
    'hours_to_load', case when l.plan_load_date is null then null else
      round(extract(epoch from ((l.plan_load_date::timestamp at time zone 'Europe/Warsaw') - now())) / 3600) end,
    'hours_to_delivery', case when l.plan_delivery_date is null then null else
      round(extract(epoch from ((l.plan_delivery_date::timestamp at time zone 'Europe/Warsaw') - now())) / 3600) end)
    from loads l where l.id = p_load
$$;
revoke all on function wf_load_context(uuid) from public, anon, authenticated;

create or replace function wf_action(p_wf workflows, p_run workflow_runs, p_act jsonb, p_ctx jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_n int; v_client uuid; v_carrier uuid; v_project uuid; v_code text := coalesce(p_ctx #>> '{load,code}', '');
        v_sms text := nullif(public.load_sms_code(p_run.load_id), '—');
        v_show text;
        v_ev text := wf_event_key(p_run); v_aud text; v_id uuid; v_st text; v_crit boolean; r record; v_stats jsonb := '{}'::jsonb;
begin
  select l.project_id, p.client_org_id, l.carrier_org_id into v_project, v_client, v_carrier
    from loads l join projects p on p.id = l.project_id where l.id = p_run.load_id;
  if p_act ->> 'type' = 'notify' then
    insert into notifications (channel, recipient, user_id, load_id, template, payload, dedup_key)
    select 'IN_APP', coalesce(u.email::text, u.id::text), u.id, p_run.load_id, 'WORKFLOW_ALERT',
           jsonb_build_object(
             'code', case when (p_act ->> 'audience') = 'CARRIER' then v_sms else nullif(v_code, '') end,
             'rule', p_wf.name, 'rule_code', p_wf.code,
             'event', p_ctx ->> 'event_type', 'text', p_act ->> 'text', 'locale', u.locale),
           left('WFN:' || v_ev || ':' || u.id, 200)
      from app_users u join organizations o on o.id = u.org_id
     where u.active
       and case p_act ->> 'audience'
             when 'HHL' then o.kind = 'FORWARDER'
             when 'KSH' then v_client is not null and u.org_id = v_client
             when 'CARRIER' then v_carrier is not null and u.org_id = v_carrier
             else false end
    on conflict (dedup_key) where dedup_key is not null do nothing;
    get diagnostics v_n = row_count;
    return jsonb_build_object('type', 'notify', 'audience', p_act ->> 'audience', 'sent', v_n);
  elsif p_act ->> 'type' = 'risk' then
    if p_run.load_id is null then raise exception 'wf_action risk: brak transportu'; end if;
    if exists (select 1 from risk_signals s where s.load_id = p_run.load_id and s.kind::text = p_act ->> 'kind' and s.resolved_at is null) then
      return jsonb_build_object('type', 'risk', 'kind', p_act ->> 'kind', 'status', 'JUZ_OTWARTE');
    end if;
    perform raise_risk(p_run.load_id, (p_act ->> 'kind')::risk_kind, (p_act ->> 'severity')::risk_severity,
                       coalesce(nullif(p_act ->> 'title', ''), p_wf.name) || ' · ' || v_code,
                       jsonb_build_object('rule', p_wf.name, 'rule_code', p_wf.code, 'event', p_ctx ->> 'event_type',
                                          'title_key', 'rk_workflow',
                                          'params', jsonb_build_object('rule', p_wf.name, 'code', v_code,
                                                                       'title', coalesce(nullif(p_act ->> 'title', ''), p_wf.name))),
                       'WF:' || p_wf.id || ':' || p_run.load_id);
    return jsonb_build_object('type', 'risk', 'kind', p_act ->> 'kind');
  elsif p_act ->> 'type' = 'decision' then
    if p_run.load_id is null then raise exception 'wf_action decision: brak transportu'; end if;
    if exists (select 1 from decisions d where d.load_id = p_run.load_id and d.type_code = p_act ->> 'decision_type'
                                          and d.status in ('NEW', 'ASSIGNED', 'SNOOZED')) then
      return jsonb_build_object('type', 'decision', 'decision_type', p_act ->> 'decision_type', 'status', 'JUZ_OTWARTA');
    end if;
    v_id := decision_open_from_event(v_project, p_act ->> 'decision_type', left('WF:' || v_ev || ':' || (p_act ->> 'decision_type'), 200),
                                     coalesce(nullif(p_act ->> 'title', ''), p_wf.name) || ' · ' || v_code,
                                     jsonb_build_object('rule', p_wf.name, 'rule_id', p_wf.id, 'event', p_ctx ->> 'event_type'),
                                     p_run.load_id, null);
    return jsonb_build_object('type', 'decision', 'decision_type', p_act ->> 'decision_type', 'decision_id', v_id);
  elsif p_act ->> 'type' = 'email' then
    v_aud := coalesce(p_act ->> 'audience', 'HHL');
    v_crit := coalesce((p_act ->> 'critical')::boolean, false);
    v_show := case when v_aud = 'CARRIER' then v_sms else nullif(v_code, '') end;
    for r in
      select u.id, u.email::text as email, u.locale
        from app_users u join organizations o on o.id = u.org_id
       where u.active and u.email is not null
         and case v_aud
               when 'HHL' then o.kind = 'FORWARDER'
               when 'KSH' then v_client is not null and u.org_id = v_client
               when 'CARRIER' then v_carrier is not null and u.org_id = v_carrier
               else false end
    loop
      v_st := l13_queue_email(case when v_crit then 'critical' else 'digest' end, 'WORKFLOW_ALERT', r.id, r.email,
                              p_run.load_id, v_show,
                              jsonb_build_object('code', v_show, 'rule', p_wf.name, 'rule_code', p_wf.code,
                                                 'event', p_ctx ->> 'event_type', 'text', p_act ->> 'text', 'locale', r.locale),
                              left('WFE:' || v_ev || ':' || r.id, 200),
                              case when v_crit then left('WF:' || v_ev, 120) end);
      v_stats := jsonb_set(v_stats, array[coalesce(v_st, 'skip')], to_jsonb(coalesce((v_stats ->> coalesce(v_st, 'skip'))::int, 0) + 1));
    end loop;
    return jsonb_build_object('type', 'email', 'audience', v_aud, 'queued', v_stats);
  elsif p_act ->> 'type' = 'sms' then
    if p_run.load_id is null then raise exception 'wf_action sms: brak transportu'; end if;
    v_n := sms_zone_enqueue_for_event(p_run.load_id, p_act ->> 'list', coalesce(p_act ->> 'kind', 'ZONE_ENTER'),
                                      case when p_act ->> 'list' = 'LOAD_SREM' then 'zaladunek Srem' else 'plac Stegra Boden' end, null);
    return jsonb_build_object('type', 'sms', 'list', p_act ->> 'list', 'kind', coalesce(p_act ->> 'kind', 'ZONE_ENTER'), 'queued', v_n);
  end if;
  raise exception 'wf_action: nieznana akcja %', p_act ->> 'type';
end $$;
revoke all on function wf_action(workflows, workflow_runs, jsonb, jsonb) from public, anon, authenticated;

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
      case when r.org_kind = 'CARRIER' then nullif(public.load_sms_code(p_load_id), '—') else v_order end,
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
  'C3-p: macierz po zdarzeniu; czat WEB_PUSH bez critical (bez e-maila zapasowego); ZONE PRE_* → osobne wiersze. D-0930: skrot L-13 dla CARRIER ma kod transportu, nie numer KSH.';

comment on function public.ksh_confirm_dates(uuid, date, date, timestamptz, timestamptz, timestamptz, timestamptz) is
  'G-20 + D-0005: KSH Użytkownik albo HHL_ADMIN; sprawa KSH_DATES_CHECK nie z edycji admina (A6/KSH). D-0930: kod w powiadomieniu to load_sms_code.';
