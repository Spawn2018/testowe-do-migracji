-- D-20261020-0040-01 (#343): numer KSH nie trafia do SCX z l13_decision_email ani z reguły workflow.
-- A3: CMR_UPLOAD / seed wymagań. A9: awiz_missing, READY, tower-zasoby. Jedno F7 na parę.

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
  -- F7 P5: jednorazowe A3/A9 bez e-maila L-13.
  if current_setting('tower.bulk_quiet', true) = 'on' then
    return;
  end if;
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
        /* F7 P2 runda 2: tylko kod SMS — bez order_no (tytuł WSZYSCY/CARRIER). Bez kodu = bez dopisku (jak l3_headed). */
        v_head text := v_sms;
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
                       public.l3_headed(v_head, coalesce(nullif(p_act ->> 'title', ''), p_wf.name)),
                       jsonb_build_object('rule', p_wf.name, 'rule_code', p_wf.code, 'event', p_ctx ->> 'event_type',
                                          'title_key', 'rk_workflow',
                                          'params', jsonb_build_object('rule', p_wf.name, 'code', v_head,
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
                                     public.l3_headed(v_head, coalesce(nullif(p_act ->> 'title', ''), p_wf.name)),
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

-- =====================================================================
-- A3 · CMR z rozładunku i sprawa „Wgraj CMR” (E31 / L26; PLAN §4 A3)
-- =====================================================================

-- Seed: tylko PERMIT_PL, CMR (AFTER_UNLOAD), INSURANCE. Bez POD / SPEC / LASHING / PERMIT_SE.
create or replace function public.doc_requirements_seed(p_project uuid) returns void
language sql security definer set search_path = public as $$
  insert into doc_requirements (project_id, category, required, responsible, anchor, offset_hours)
  select p_project, v.category::doc_category, true, v.responsible::org_kind, v.anchor, v.offset_hours
    from (values
      ('PERMIT_PL', 'CARRIER', 'BEFORE_LOAD',  24),
      ('CMR',       'CARRIER', 'AFTER_UNLOAD', 24),
      ('INSURANCE', 'CARRIER', 'ORG',           0)
    ) as v(category, responsible, anchor, offset_hours)
  on conflict (project_id, category) do nothing
$$;
revoke all on function public.doc_requirements_seed(uuid) from public, anon, authenticated;

-- Zapis: wyłącznie Administrator HHL (E9 / A3).
create or replace function public.doc_requirement_set(
  p_project uuid, p_category doc_category, p_required boolean, p_responsible org_kind, p_anchor text, p_offset_hours integer
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_user uuid; v_old jsonb;
begin
  if (is_hhl_admin()) is not true then
    raise exception 'Wymagalność dokumentów ustawia wyłącznie HHL' using errcode = '42501';
  end if;
  if (p_anchor in ('BEFORE_LOAD', 'AT_LOAD', 'BEFORE_FERRY', 'AFTER_UNLOAD', 'ORG')) is not true then
    raise exception 'Nieznane zdarzenie odniesienia: %', coalesce(p_anchor, '—') using errcode = '22023';
  end if;
  if p_category = 'CMR' and p_anchor is distinct from 'AFTER_UNLOAD' then
    raise exception 'CMR tylko po rozładunku (AFTER_UNLOAD)' using errcode = '22023';
  end if;
  if (p_offset_hours between 0 and 720) is not true then
    raise exception 'Przesunięcie terminu 0–720 h' using errcode = '22023';
  end if;
  if (p_required is not null and p_responsible is not null and p_category is not null) is not true then
    raise exception 'Brak kategorii, wymagalności albo strony odpowiedzialnej' using errcode = '22023';
  end if;
  if (exists (select 1 from projects where id = p_project)) is not true then raise exception 'Nieznany projekt'; end if;
  v_user := current_app_user_id();
  select to_jsonb(r) - 'id' - 'updated_at' - 'updated_by' into v_old from doc_requirements r
    where project_id = p_project and category = p_category;
  insert into doc_requirements (project_id, category, required, responsible, anchor, offset_hours, updated_by, updated_at)
  values (p_project, p_category, p_required, p_responsible, p_anchor, p_offset_hours, v_user, now())
  on conflict (project_id, category) do update
    set required = excluded.required, responsible = excluded.responsible, anchor = excluded.anchor,
        offset_hours = excluded.offset_hours, updated_by = excluded.updated_by, updated_at = now()
  returning id into v_id;
  insert into audit_log (user_id, action, entity, entity_id, old_value, new_value)
  values (v_user, 'DOC_REQUIREMENT_SET', 'doc_requirements', v_id::text, v_old,
          jsonb_build_object('category', p_category, 'required', p_required, 'responsible', p_responsible,
                             'anchor', p_anchor, 'offset_hours', p_offset_hours));
  return v_id;
end $$;
revoke all on function public.doc_requirement_set(uuid, doc_category, boolean, org_kind, text, integer) from public, anon;
grant execute on function public.doc_requirement_set(uuid, doc_category, boolean, org_kind, text, integer) to authenticated;

-- Jednorazowo: usuń POD / SPEC / LASHING_PHOTO / PERMIT_SE z wymagań (kopia w audit_log).
do $a3req$
declare
  r record;
  n int := 0;
begin
  for r in
    select id, project_id, category, required, responsible, anchor, offset_hours
      from doc_requirements
     where category in ('POD', 'SPEC', 'LASHING_PHOTO', 'PERMIT_SE')
  loop
    insert into audit_log (user_id, action, entity, entity_id, old_value, new_value)
    values (
      null, 'DOC_REQUIREMENT_SET', 'doc_requirements', r.id::text,
      jsonb_build_object(
        'category', r.category, 'required', r.required, 'responsible', r.responsible,
        'anchor', r.anchor, 'offset_hours', r.offset_hours, 'via', '0236-A3'
      ),
      jsonb_build_object('removed', true, 'via', '0236-A3', 'reason', 'A3: bez POD/SPEC/LASHING/PERMIT_SE')
    );
    delete from doc_requirements where id = r.id;
    n := n + 1;
  end loop;
  if n > 200 then
    raise exception '0236-A3: zbyt wiele wymagań do usunięcia (%) — przerwane', n;
  end if;
end
$a3req$;

insert into decision_types (code, title_key, decider_role, options, due_hours, due_note, severity_default, sort_order)
values (
  'CMR_UPLOAD',
  'dec_type_CMR_UPLOAD',
  'CARRIER',
  '[{"code":"UPLOAD_CMR","label_key":"dec_opt_UPLOAD_CMR","requires_comment":false,"effect":"OPEN_DOC"}]'::jsonb,
  /* F7 P9 / D runda 2: offset z Opcji; minimum 1 h (0 = „teraz” odpada). */
  (select greatest(coalesce(max(offset_hours), 24), 1) from doc_requirements where category = 'CMR' and required is true),
  'po Dostarczone bez CMR z podpisem',
  'WARNING',
  36
)
on conflict (code) do update set
  title_key = excluded.title_key,
  decider_role = excluded.decider_role,
  options = excluded.options,
  due_hours = excluded.due_hours,
  due_note = excluded.due_note,
  severity_default = excluded.severity_default,
  active = true;

-- F7 P4: UPLOAD_CMR tylko otwiera okno wgrywania — bez zamykania sprawy (zamyka C17).
create or replace function decision_resolve(p_decision uuid, p_option text, p_note text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid; d decisions%rowtype; v_opt jsonb; v_need boolean;
  v_role text;
  v_fx jsonb;
begin
  if (current_app_user_id() is not null) is not true then
    raise exception 'Rozstrzygnięcie — tylko wskazana firma albo administrator' using errcode = '42501';
  end if;
  select id into v_me from app_users where id = current_app_user_id() and active;
  select * into d from decisions where id = p_decision for update;
  if not found then raise exception 'Brak decyzji' using errcode = '22023'; end if;
  if (d.status in ('NEW','ASSIGNED','SNOOZED')) is not true then
    raise exception 'Decyzja już zamknięta' using errcode = '22023';
  end if;
  select decider_role into v_role from decision_types where code = d.type_code;
  if (public.l2_may_resolve(v_role)) is not true then
    raise exception 'Rozstrzygnięcie — tylko wskazana firma albo administrator' using errcode = '42501';
  end if;
  select o into v_opt
    from decision_types t, jsonb_array_elements(t.options) o
   where t.code = d.type_code and o->>'code' = p_option;
  if v_opt is null then
    raise exception 'Nieznana opcja %', p_option using errcode = '22023';
  end if;
  v_need := coalesce((v_opt->>'requires_comment')::boolean, false);
  if v_need and length(coalesce(nullif(trim(p_note), ''), '')) < 3 then
    raise exception 'Ta opcja wymaga komentarza' using errcode = '22023';
  end if;
  if d.type_code = 'DELIVERED_CHECK' then
    return public.delivered_check_apply(d.id, p_option = 'DELIVERED_YES', p_note);
  end if;
  /* A3: klik „Wgraj CMR” nie zamyka — tylko ui_hint OPEN_DOC; C17 zamyka po pliku. */
  if d.type_code = 'CMR_UPLOAD' and p_option = 'UPLOAD_CMR' then
    v_fx := jsonb_build_object('ui_hint', 'OPEN_DOC', 'applied', false, 'kept_open', true);
    insert into decision_events (decision_id, actor_id, action, payload)
    values (p_decision, v_me, 'HINT',
            jsonb_build_object('option', p_option, 'effect', 'OPEN_DOC', 'note', p_note, 'result', v_fx));
    return v_fx;
  end if;
  update decisions set status = 'RESOLVED', resolved_at = now(), resolved_by = v_me,
    resolution_code = p_option, resolution_note = nullif(trim(p_note), ''),
    snooze_until = null, updated_at = now()
   where id = p_decision;
  v_fx := public.decision_apply_effect(p_decision, coalesce(v_opt->>'effect', 'ACCEPT'), p_option, p_note);
  insert into decision_events (decision_id, actor_id, action, payload)
  values (p_decision, v_me, 'RESOLVE',
          jsonb_build_object('option', p_option, 'effect', v_opt->>'effect', 'note', p_note, 'result', v_fx));
  insert into audit_log (user_id, action, entity, entity_id, new_value)
  values (v_me, 'DECISION_RESOLVE', 'decisions', p_decision::text,
          jsonb_build_object('option', p_option, 'effect', v_opt->>'effect', 'type', d.type_code, 'result', v_fx));
  perform decision_notify(p_decision, 'RESOLVE');
  return v_fx;
end $$;
revoke all on function decision_resolve(uuid, text, text) from public, anon;
grant execute on function decision_resolve(uuid, text, text) to authenticated;

create or replace function public.a3_resolve_cmr_upload(p_load uuid, p_via text default 'C17')
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  n int := 0;
begin
  for r in
    update decisions
       set status = 'RESOLVED',
           resolved_at = now(),
           resolution_code = 'UPLOAD_CMR',
           updated_at = now()
     where load_id = p_load
       and type_code = 'CMR_UPLOAD'
       and status in ('NEW', 'ASSIGNED', 'SNOOZED')
    returning id
  loop
    insert into decision_events (decision_id, actor_id, action, payload)
    values (
      r.id,
      current_app_user_id(),
      'RESOLVE',
      jsonb_build_object('option', 'UPLOAD_CMR', 'via', coalesce(p_via, 'C17'))
    );
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.a3_resolve_cmr_upload(uuid, text) from public, anon, authenticated;

create or replace function public.a3_ensure_cmr_upload(p_load uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_load loads%rowtype;
  v_code text;
  v_title text;
  v_id uuid;
  v_st text;
  v_off int;
  v_key text := 'cmr-upload:' || p_load::text;
begin
  select * into v_load from loads where id = p_load;
  if not found then
    return null;
  end if;
  if v_load.status in ('READY_TO_INVOICE', 'INVOICED', 'CANCELLED') then
    perform public.a3_resolve_cmr_upload(p_load, 'STATUS');
    return null;
  end if;
  if v_load.status is distinct from 'DELIVERED' then
    return null;
  end if;
  if public.c17_cmr_after_delivery(p_load) is not null then
    perform public.a3_resolve_cmr_upload(p_load, 'C17');
    return null;
  end if;
  /* F7 P1: nigdy left(id,8) — l3_headed + load_sms_code. */
  v_code := nullif(public.load_sms_code(p_load), '—');
  v_title := public.l3_headed(v_code, 'Wgraj CMR');
  select greatest(coalesce(max(offset_hours), 24), 1) into v_off
    from doc_requirements
   where project_id = v_load.project_id and category = 'CMR' and required is true;
  select id, status::text into v_id, v_st
    from decisions
   where detail->>'event_key' = v_key
   order by created_at desc
   limit 1;
  /* F7 D runda 2: już otwarta — null (nie licz jako opened w backfillu). */
  if v_id is not null and v_st in ('NEW', 'ASSIGNED', 'SNOOZED') then
    return null;
  end if;
  /* F7 B1: EXPIRED/RESOLVED → NEW z expired_reason = null (CHECK). */
  if v_id is not null and v_st in ('RESOLVED', 'EXPIRED') then
    update decisions
       set status = 'NEW',
           resolved_at = null,
           resolution_code = null,
           resolution_note = null,
           expired_reason = null,
           snooze_until = null,
           title = v_title,
           due_at = now() + make_interval(hours => v_off),
           updated_at = now()
     where id = v_id
       and status in ('RESOLVED', 'EXPIRED');
    if not found then
      raise exception 'A3: reopen CMR_UPLOAD % status % — UPDATE 0 wierszy', v_id, v_st
        using errcode = 'P0001';
    end if;
    insert into decision_events (decision_id, actor_id, action, payload)
    values (v_id, null, 'OPEN', jsonb_build_object('type', 'CMR_UPLOAD', 'event_key', v_key, 'via', 'A3_REOPEN'));
    return v_id;
  end if;
  /* F7 P5: jednorazowy przebieg — sprawa bez dzwonka i e-maila L-13. */
  if current_setting('tower.bulk_quiet', true) = 'on' then
    insert into decisions (project_id, type_code, title, detail, load_id, due_at)
    values (
      v_load.project_id, 'CMR_UPLOAD', v_title,
      jsonb_build_object(
        'event_key', v_key, 'category', 'CMR',
        'params', jsonb_build_object('code', v_code),
        'via', 'A3', 'opened_by', 'A3_BULK'
      ),
      p_load, now() + make_interval(hours => v_off)
    )
    returning id into v_id;
    insert into decision_events (decision_id, actor_id, action, payload)
    values (v_id, null, 'OPEN', jsonb_build_object('type', 'CMR_UPLOAD', 'event_key', v_key, 'via', 'A3_BULK'));
    return v_id;
  end if;
  v_id := public.decision_open_from_event(
    v_load.project_id,
    'CMR_UPLOAD',
    v_key,
    v_title,
    jsonb_build_object(
      'category', 'CMR',
      'params', jsonb_build_object('code', v_code),
      'via', 'A3'
    ),
    p_load,
    null
  );
  /* F7 P9: due_at z offset_hours projektu (Opcje), nie sztywne 24.
     Gdy open_from_event zwróci zamkniętą sprawę (ten sam event_key) — reopen. */
  if v_id is not null then
    update decisions
       set status = 'NEW',
           resolved_at = null,
           resolution_code = null,
           resolution_note = null,
           expired_reason = null,
           snooze_until = null,
           due_at = now() + make_interval(hours => v_off),
           title = v_title,
           updated_at = now()
     where id = v_id
       and status in ('RESOLVED', 'EXPIRED');
    if found then
      insert into decision_events (decision_id, actor_id, action, payload)
      values (v_id, null, 'OPEN', jsonb_build_object('type', 'CMR_UPLOAD', 'event_key', v_key, 'via', 'A3_REOPEN'));
    else
      update decisions
         set due_at = now() + make_interval(hours => v_off),
             title = v_title,
             updated_at = now()
       where id = v_id
         and status in ('NEW', 'ASSIGNED', 'SNOOZED');
    end if;
  end if;
  return v_id;
end $$;
revoke all on function public.a3_ensure_cmr_upload(uuid) from public, anon, authenticated;

create or replace function public.a3_trg_loads_cmr_upload()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    perform public.a3_ensure_cmr_upload(new.id);
  end if;
  return new;
end $$;
revoke all on function public.a3_trg_loads_cmr_upload() from public, anon, authenticated;

drop trigger if exists trg_a3_loads_cmr_upload on public.loads;
create trigger trg_a3_loads_cmr_upload
  after insert or update of status
  on public.loads
  for each row
  execute function public.a3_trg_loads_cmr_upload();

-- C17 po wgraniu CMR zamyka sprawę CMR_UPLOAD.
create or replace function public.c17_try_ready_to_invoice(p_load uuid, p_extra jsonb default '{}'::jsonb)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_status load_status;
  v_doc uuid;
  v_ts timestamptz;
  v_ok boolean;
begin
  select status into v_status from loads where id = p_load for update;
  if v_status is distinct from 'DELIVERED' then
    return false;
  end if;
  v_doc := public.c17_cmr_after_delivery(p_load);
  if v_doc is null then
    return false;
  end if;
  select d.uploaded_at into v_ts from documents d where d.id = v_doc;
  v_ok := public.auto_set_status(
    p_load,
    'DELIVERED'::load_status,
    'READY_TO_INVOICE'::load_status,
    'CMR z podpisem odbiorcy wgrany',
    coalesce(v_ts, now()),
    coalesce(p_extra, '{}'::jsonb) || jsonb_build_object(
      'actor', 'system',
      'source', 'DOC',
      'document_id', v_doc
    )
  );
  if v_ok is true then
    perform public.a3_resolve_cmr_upload(p_load, 'C17');
  end if;
  return v_ok;
end $$;
revoke all on function public.c17_try_ready_to_invoice(uuid, jsonb) from public, anon, authenticated;

-- Jednorazowo: otwórz CMR_UPLOAD dla Dostarczonych bez CMR; zamknij stare DOC_MISSING ze starego wymagania.
-- F7 B1: nie ruszaj EXPIRED (zamknięta historia / CHECK expired_reason).
-- F7 P5: bez powiadomień. F7 D: \y…\y przy POD/SPEC/CMR (nie polskie „pod…”).
do $a3close$
declare
  r record;
  n_open int := 0;
  n_close int := 0;
  n_batch int := 0;
  /* F7 D runda 2: POD/SPEC/CMR z wielkością liter (~); LASHING/mocowan/zezwolenie — ~*. */
  v_title_re_cs text := '(\yPOD\y|\ySPEC\y|\yCMR\y)';
  v_title_re_ci text := '(\yLASHING\y|mocowan|zezwolenie SE)';
begin
  perform set_config('tower.bulk_quiet', 'on', true);

  for r in
    select id from loads
     where status = 'DELIVERED'
       and public.c17_cmr_after_delivery(id) is null
  loop
    if public.a3_ensure_cmr_upload(r.id) is not null then
      n_open := n_open + 1;
    end if;
  end loop;

  insert into audit_log (action, entity, entity_id, old_value)
  select 'A3_STALE_DOC_MISSING_CLOSE', 'decisions', d.id::text,
         jsonb_build_object(
           'type_code', d.type_code,
           'title', d.title,
           'status', d.status,
           'load_id', d.load_id,
           'detail', d.detail,
           'via', '0236-A3'
         )
    from decisions d
    left join loads l on l.id = d.load_id
   where d.type_code = 'DOC_MISSING'
     and d.status in ('NEW', 'ASSIGNED', 'SNOOZED')
     and (
       coalesce(d.detail->>'category', '') in ('POD', 'SPEC', 'LASHING_PHOTO', 'PERMIT_SE', 'CMR')
       or coalesce(d.title, '') ~ v_title_re_cs
       or coalesce(d.title, '') ~* v_title_re_ci
       or (l.status in ('DELIVERED', 'READY_TO_INVOICE', 'INVOICED', 'CANCELLED'))
     );

  update decisions d
     set status = 'RESOLVED',
         resolved_at = now(),
         resolution_code = 'A3_STALE_REQ',
         expired_reason = null,
         updated_at = now()
    from loads l
   where d.load_id = l.id
     and d.type_code = 'DOC_MISSING'
     and d.status in ('NEW', 'ASSIGNED', 'SNOOZED')
     and (
       coalesce(d.detail->>'category', '') in ('POD', 'SPEC', 'LASHING_PHOTO', 'PERMIT_SE', 'CMR')
       or coalesce(d.title, '') ~ v_title_re_cs
       or coalesce(d.title, '') ~* v_title_re_ci
       or l.status in ('DELIVERED', 'READY_TO_INVOICE', 'INVOICED', 'CANCELLED')
     );
  get diagnostics n_batch = row_count;
  n_close := n_close + n_batch;

  update decisions d
     set status = 'RESOLVED',
         resolved_at = now(),
         resolution_code = 'A3_STALE_REQ',
         expired_reason = null,
         updated_at = now()
   where d.load_id is null
     and d.type_code = 'DOC_MISSING'
     and d.status in ('NEW', 'ASSIGNED', 'SNOOZED')
     and (
       coalesce(d.detail->>'category', '') in ('POD', 'SPEC', 'LASHING_PHOTO', 'PERMIT_SE', 'CMR')
       or coalesce(d.title, '') ~ v_title_re_cs
       or coalesce(d.title, '') ~* v_title_re_ci
     );
  get diagnostics n_batch = row_count;
  n_close := n_close + n_batch;

  insert into audit_log (action, entity, entity_id, old_value)
  select 'A3_STALE_DOC_MISSING_CLOSE', 'risk_signals', id::text,
         jsonb_build_object(
           'kind', kind,
           'dedup_key', dedup_key,
           'title', title,
           'detail', detail,
           'via', '0236-A3'
         )
    from risk_signals
   where kind = 'DOC_MISSING'
     and resolved_at is null
     and (
       coalesce(detail->>'category', '') in ('POD', 'SPEC', 'LASHING_PHOTO', 'PERMIT_SE', 'CMR')
       or coalesce(title, '') ~ v_title_re_cs
       or coalesce(title, '') ~* v_title_re_ci
     );

  update risk_signals
     set resolved_at = now()
   where kind = 'DOC_MISSING'
     and resolved_at is null
     and (
       coalesce(detail->>'category', '') in ('POD', 'SPEC', 'LASHING_PHOTO', 'PERMIT_SE', 'CMR')
       or coalesce(title, '') ~ v_title_re_cs
       or coalesce(title, '') ~* v_title_re_ci
     );

  /* Limit: tylko decyzje (F7 D) — ryzyka poza limitem 80. */
  if n_close > 80 then
    raise exception '0236-A3: zbyt wiele DOC_MISSING do zamknięcia (%) — przerwane', n_close;
  end if;

  insert into audit_log (user_id, action, entity, entity_id, new_value)
  values (
    null, 'A3_CMR_UPLOAD_BACKFILL', 'decisions', 'batch',
    jsonb_build_object('opened_cmr_upload', n_open, 'closed_doc_missing', n_close, 'via', '0236-A3')
  );

  perform set_config('tower.bulk_quiet', '', true);
end
$a3close$;

-- =============================================================================
-- A9 · „Gotowy” w bazie (E25 L6/L9/L29; D-20261017-1715-01 §2 pkt 2)
-- awiz_missing → load.readyGaps; READY po komplecie; wyłączenie tower-zasoby.
-- =============================================================================

create or replace function public.awiz_missing(p_load uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  l public.loads%rowtype;
  gaps jsonb := '[]'::jsonb;
  awiz text[] := '{}';
  v_pilots int := 0;
  v_escorts int := 0;
  v_anchor date;
  v_has_policy boolean;
  v_permit_missing boolean;
  v_items jsonb;
begin
  select * into l from public.loads where id = p_load;
  if not found then
    return '[]'::jsonb;
  end if;
  if l.status::text not in ('PLANNED', 'RESOURCES_PENDING', 'DOCS_PENDING') then
    return '[]'::jsonb;
  end if;

  /* F7 P3 runda 2: bez przewoźnika → CARRIER (nie READY z pustą listą). */
  if l.carrier_org_id is null then
    gaps := gaps || jsonb_build_array(jsonb_build_object(
      'kind', 'CARRIER', 'items', jsonb_build_array('Brak przewoźnika'), 'who', 'HHL'
    ));
  end if;

  if coalesce(btrim(l.driver_name), '') = '' then awiz := array_append(awiz, 'kierowca'); end if;
  if coalesce(btrim(l.driver_phone), '') = '' then awiz := array_append(awiz, 'telefon'); end if;
  if coalesce(btrim(l.tractor_plate), '') = '' then awiz := array_append(awiz, 'ciągnik'); end if;
  if coalesce(btrim(l.trailer_plate), '') = '' then awiz := array_append(awiz, 'naczepa'); end if;
  if l.trailer_swap is true then
    if coalesce(btrim(l.driver_delivery_name), '') = '' then awiz := array_append(awiz, 'kierowca SE'); end if;
    if coalesce(btrim(l.driver_delivery_phone), '') = '' then awiz := array_append(awiz, 'telefon SE'); end if;
    if coalesce(btrim(l.tractor_delivery_plate), '') = '' then awiz := array_append(awiz, 'ciągnik SE'); end if;
  end if;
  if coalesce(array_length(awiz, 1), 0) > 0 then
    gaps := gaps || jsonb_build_array(jsonb_build_object(
      'kind', 'AWIZ', 'items', to_jsonb(awiz), 'who', 'SCX'
    ));
  end if;

  /* Trasa Śrem → Boden zawsze z przeprawą — brak rejsu = SAILING (A5/A9). */
  if l.sailing_id is null then
    gaps := gaps || jsonb_build_array(jsonb_build_object('kind', 'SAILING', 'who', 'SCX'));
  end if;

  select coalesce(max(p.escort_required), 0) into v_pilots
    from public.load_permits lp
    join public.permits p on p.id = lp.permit_id
   where lp.load_id = l.id;
  select count(*)::int into v_escorts from public.load_escorts e where e.load_id = l.id;
  if v_pilots < coalesce(l.escort_vehicles, 0) then
    v_pilots := coalesce(l.escort_vehicles, 0);
  end if;
  if v_pilots > 0 and v_escorts < v_pilots then
    v_items := case
      when v_pilots > 1 then jsonb_build_array('pilot ×' || v_pilots::text)
      else jsonb_build_array('pilot')
    end;
    gaps := gaps || jsonb_build_array(jsonb_build_object(
      'kind', 'PILOTS', 'items', v_items, 'who', 'SCX'
    ));
  end if;

  if coalesce(btrim(l.carrier_order_no), '') = '' then
    gaps := gaps || jsonb_build_array(jsonb_build_object('kind', 'ORDER_SCX', 'who', 'SCX'));
  end if;
  if coalesce(btrim(l.hhl_order_no), '') = '' then
    gaps := gaps || jsonb_build_array(jsonb_build_object('kind', 'ORDER_HHL', 'who', 'HHL'));
  end if;

  /* Polisa SCX z insurance_policies. F7 P3: bez POLICY_SCX gdy brak przewoźnika. */
  v_anchor := coalesce(l.plan_load_date, (now() at time zone 'Europe/Warsaw')::date);
  if l.carrier_org_id is not null then
    v_has_policy := exists (
      select 1 from public.insurance_policies ip
       where ip.org_id = l.carrier_org_id
         and ip.approval_status = 'APPROVED'
         and ip.valid_from <= v_anchor
         and ip.valid_until >= v_anchor
    );
    if v_has_policy is not true then
      gaps := gaps || jsonb_build_array(jsonb_build_object('kind', 'POLICY_SCX', 'who', 'SCX'));
    end if;
  end if;

  /* Do A7: Trasa = brak PL lub SE; Firma podpięta w A7. */
  v_permit_missing := public.permit_required_enabled()
    and public.load_needs_permit(l.id)
    and exists (
      select 1 from unnest(array['PL', 'SE']) c
       where not exists (
         select 1
           from public.load_permits lp
           join public.permits p on p.id = lp.permit_id
          where lp.load_id = l.id and p.country = c
       )
    );
  if v_permit_missing is true then
    gaps := gaps || jsonb_build_array(jsonb_build_object('kind', 'PERMIT', 'who', 'SCX'));
  end if;

  return gaps;
end $$;

revoke all on function public.awiz_missing(uuid) from public, anon, authenticated;
comment on function public.awiz_missing(uuid) is
  'A9: braki do Gotowy (CARRIER/AWIZ/SAILING/PILOTS/ORDER_*/POLICY_SCX/PERMIT). Mapowanie D-20261017-1715-01.';

create or replace function public.load_ready_gaps()
returns table (load_id uuid, gaps jsonb)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if current_app_user_id() is null then
    return;
  end if;
  if is_hhl() is true then
    return query
    select l.id, public.awiz_missing(l.id)
      from public.loads l;
    return;
  end if;
  if current_org_kind() = 'CARRIER' then
    return query
    select l.id, public.awiz_missing(l.id)
      from public.loads l
     where l.carrier_org_id = current_org_id();
    return;
  end if;
  if current_org_kind() = 'CLIENT' then
    return query
    select l.id, public.awiz_missing(l.id)
      from public.loads l
     where exists (
       select 1 from public.projects p
        where p.id = l.project_id and p.client_org_id = current_org_id()
     );
  end if;
end $$;

revoke all on function public.load_ready_gaps() from public, anon;
grant execute on function public.load_ready_gaps() to authenticated;
comment on function public.load_ready_gaps() is
  'A9: lista readyGaps dla widoku (load.readyGaps). Pusta = komplet; poza przygotowaniem [].';

create or replace function public.a9_try_ready(p_load uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status public.load_status;
  v_gaps jsonb;
begin
  /* F7 P3: w dates_ctx (ksh_confirm_dates) nie zmieniaj statusu — guard_load_update / fałszywe AUTO_STATUS. */
  if current_setting('tower.dates_ctx', true) = 'on' then
    return false;
  end if;
  select status into v_status from public.loads where id = p_load for update;
  if not found then
    return false;
  end if;
  if v_status::text not in ('PLANNED', 'RESOURCES_PENDING', 'DOCS_PENDING') then
    return false;
  end if;
  v_gaps := public.awiz_missing(p_load);
  if coalesce(jsonb_array_length(v_gaps), 0) > 0 then
    return false;
  end if;
  return public.auto_set_status(
    p_load,
    v_status,
    'READY'::public.load_status,
    'Awizacja kompletna',
    now(),
    jsonb_build_object('actor', 'system', 'source', 'A9', 'gaps', v_gaps)
  );
end $$;

revoke all on function public.a9_try_ready(uuid) from public, anon, authenticated;
comment on function public.a9_try_ready(uuid) is
  'A9: PLANNED/RESOURCES_PENDING/DOCS_PENDING → READY gdy awiz_missing puste. Demotion w A10.';

create or replace function public.a9_trg_loads_ready()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  /* F7 P3: daty KSH — bez przeliczania READY w tym samym UPDATE. */
  if current_setting('tower.dates_ctx', true) = 'on' then
    return new;
  end if;
  perform public.a9_try_ready(new.id);
  return new;
end $$;
revoke all on function public.a9_trg_loads_ready() from public, anon, authenticated;

-- F7 P5 runda 2: wycisz kolejkę workflow przy jednorazowym READY.
create or replace function public.wf_enqueue_status() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if current_setting('tower.bulk_quiet', true) = 'on' then
    return null;
  end if;
  if new.status is not distinct from old.status then return null; end if;
  insert into workflow_runs (workflow_id, load_id, status, attempts, next_attempt_at, dedup_key, payload)
  select w.id, new.id, 'QUEUED', 0, now(),
         'wf:' || w.id || ':st:' || new.id || ':' || new.status || ':' || (extract(epoch from clock_timestamp()) * 1000)::bigint,
         jsonb_build_object('event_type', 'STATUS_CHANGED', 'occurred_at', now(),
                            'payload', jsonb_build_object('status', new.status, 'old_status', old.status))
    from workflows w
   where w.enabled and w.trigger_type = 'STATUS_CHANGED' and w.project_id = new.project_id
  on conflict (dedup_key) where dedup_key is not null do nothing;
  return null;
exception when others then
  raise warning 'wf_enqueue_status: %', sqlerrm;
  return null;
end $$;
revoke all on function public.wf_enqueue_status() from public, anon, authenticated;

-- F7 P5: wycisz LOAD_STATUS_CHANGED przy jednorazowym READY.
create or replace function public.trg_load_status_matrix_notify() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if current_setting('tower.bulk_quiet', true) = 'on' then
    return null;
  end if;
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

drop trigger if exists trg_a9_loads_ready on public.loads;
create trigger trg_a9_loads_ready
  after insert or update of
    driver_name, driver_phone, tractor_plate, trailer_plate,
    trailer_swap, driver_delivery_name, driver_delivery_phone, tractor_delivery_plate,
    sailing_id, hhl_order_no, carrier_order_no, escort_vehicles, carrier_org_id, status,
    plan_load_date
  on public.loads
  for each row
  execute function public.a9_trg_loads_ready();

create or replace function public.a9_trg_related_ready()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_load uuid;
  r record;
begin
  if tg_table_name = 'load_permits' or tg_table_name = 'load_escorts' then
    v_load := coalesce(new.load_id, old.load_id);
    if v_load is not null then
      perform public.a9_try_ready(v_load);
    end if;
  elsif tg_table_name = 'insurance_policies' then
    for r in
      select id from public.loads
       where carrier_org_id = coalesce(new.org_id, old.org_id)
         and status::text in ('PLANNED', 'RESOURCES_PENDING', 'DOCS_PENDING')
    loop
      perform public.a9_try_ready(r.id);
    end loop;
  end if;
  return coalesce(new, old);
end $$;
revoke all on function public.a9_trg_related_ready() from public, anon, authenticated;

drop trigger if exists trg_a9_load_permits_ready on public.load_permits;
create trigger trg_a9_load_permits_ready
  after insert or update or delete on public.load_permits
  for each row execute function public.a9_trg_related_ready();

drop trigger if exists trg_a9_load_escorts_ready on public.load_escorts;
create trigger trg_a9_load_escorts_ready
  after insert or update or delete on public.load_escorts
  for each row execute function public.a9_trg_related_ready();

drop trigger if exists trg_a9_insurance_ready on public.insurance_policies;
create trigger trg_a9_insurance_ready
  after insert or update or delete on public.insurance_policies
  for each row execute function public.a9_trg_related_ready();

-- L3: braki awizacji z awiz_missing (AWIZ), nie osobna lista pól.
create or replace function public.l3_scan(p_now timestamptz default now())
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  n int := 0;
  v_code text;
  v_anchor timestamptz;
  v_missing boolean;
  v_permit boolean;
  v_policy boolean;
  v_warn timestamptz;
  v_crit timestamptz;
  v_gaps jsonb;
begin
  if p_now is null or l3_ops('AWIZ_EARLY_H') is null or l3_ops('DOC_WARN_H') is null then
    return 0;
  end if;
  for r in
    select l.*
      from public.loads l
     where l.status not in ('CANCELLED', 'DELIVERED', 'UNLOADED', 'READY_TO_INVOICE', 'INVOICED')
  loop
    v_code := public.load_sms_code(r.id);
    v_anchor := l3_anchor(r.plan_load_date, r.plan_load_from);
    v_gaps := public.awiz_missing(r.id);
    /* F7 B runda 2: brak pilotów też alarm awizacji (PLAN:841). */
    v_missing := exists (
      select 1 from jsonb_array_elements(v_gaps) g
       where g ->> 'kind' in ('AWIZ', 'PILOTS')
    );
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

    v_permit := exists (
      select 1 from jsonb_array_elements(v_gaps) g where g ->> 'kind' = 'PERMIT'
    );
    v_policy := exists (
      select 1 from jsonb_array_elements(v_gaps) g where g ->> 'kind' = 'POLICY_SCX'
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
comment on function public.l3_scan(timestamptz) is
  'L3 + A9: NO_AWIZACJA / DOC_MISSING z awiz_missing (POLICY_SCX z insurance_policies).';

-- Wyłączenie tower-zasoby (E18 P12 / A9).
create or replace function public.detect_resource_deadlines(p_now timestamptz default now())
returns int
language plpgsql
security definer
set search_path = public
as $$
begin
  /* A9: braki awizacji = readyGaps / L3; cron tower-zasoby wyłączony. */
  return 0;
end $$;
revoke all on function public.detect_resource_deadlines(timestamptz) from public, anon, authenticated;
comment on function public.detect_resource_deadlines(timestamptz) is
  'A9: no-op — RESOURCE_MISSING z terminów zasobów zamknięte; braki w awiz_missing.';

do $a9cron$
begin
  /* Stary cron RESOURCE_MISSING z terminów zasobów — wyłączony (A9 / E18 P12). */
  perform cron.unschedule(jobid) from cron.job where jobname = 'tower-zasoby';
  /* L3 (awiz_missing) nadal co 15 min — ten sam rytm, nowa nazwa. */
  perform cron.unschedule(jobid) from cron.job where jobname = 'tower-l3';
  perform cron.schedule('tower-l3', '7,22,37,52 * * * *', 'select public.l3_scan()');
exception when undefined_table then
  null;
when others then
  if sqlstate not in ('42703', '42P01') then
    raise;
  end if;
end
$a9cron$;

do $a9close$
declare
  n_close int := 0;
  n_dec int := 0;
  n_ready int := 0;
  r record;
begin
  /* F7 P5: bez dzwonka / e-maila / LOAD_STATUS_CHANGED. */
  perform set_config('tower.bulk_quiet', 'on', true);

  insert into audit_log (action, entity, entity_id, old_value)
  select 'A9_RESOURCE_MISSING_CLOSE', 'risk_signals', id::text,
         jsonb_build_object(
           'kind', kind,
           'dedup_key', dedup_key,
           'title', title,
           'title_key', title_key,
           'detail', detail,
           'via', '0236-A9'
         )
    from risk_signals
   where kind = 'RESOURCE_MISSING'
     and resolved_at is null
     and coalesce(dedup_key, '') not like 'l3:NO_AWIZACJA:%';

  update risk_signals
     set resolved_at = now()
   where kind = 'RESOURCE_MISSING'
     and resolved_at is null
     and coalesce(dedup_key, '') not like 'l3:NO_AWIZACJA:%';
  get diagnostics n_close = row_count;

  /* F7 P6: zamknij sprawy L-1 RES:* (nie NO_AWIZACJA). „Do zrobienia” = jedna liczba. */
  insert into audit_log (action, entity, entity_id, old_value)
  select 'A9_RES_DECISION_CLOSE', 'decisions', d.id::text,
         jsonb_build_object(
           'type_code', d.type_code, 'title', d.title, 'status', d.status,
           'event_key', d.detail->>'event_key', 'via', '0236-A9'
         )
    from decisions d
   where d.status in ('NEW', 'ASSIGNED', 'SNOOZED')
     and (
       coalesce(d.detail->>'event_key', '') like 'RES:%'
       or coalesce(d.detail->>'event_key', '') like 'l3:RES:%'
     );

  update decisions d
     set status = 'RESOLVED',
         resolved_at = now(),
         resolution_code = 'A9_STALE_RES',
         expired_reason = null,
         updated_at = now()
   where d.status in ('NEW', 'ASSIGNED', 'SNOOZED')
     and (
       coalesce(d.detail->>'event_key', '') like 'RES:%'
       or coalesce(d.detail->>'event_key', '') like 'l3:RES:%'
     );
  get diagnostics n_dec = row_count;

  if n_close > 150 then
    raise exception '0236-A9: zbyt wiele RESOURCE_MISSING do zamknięcia (%) — przerwane', n_close;
  end if;

  /* Jednorazowo: READY na przygotowaniu z kompletem — po cichu. */
  for r in
    select id from loads
     where status::text in ('PLANNED', 'RESOURCES_PENDING', 'DOCS_PENDING')
  loop
    if public.a9_try_ready(r.id) is true then
      n_ready := n_ready + 1;
    end if;
  end loop;

  insert into audit_log (user_id, action, entity, entity_id, new_value)
  values (
    null, 'A9_READY_BACKFILL', 'risk_signals', 'batch',
    jsonb_build_object(
      'closed_resource_missing', n_close,
      'closed_res_decisions', n_dec,
      'ready_set', n_ready,
      'via', '0236-A9'
    )
  );

  perform set_config('tower.bulk_quiet', '', true);
end
$a9close$;
