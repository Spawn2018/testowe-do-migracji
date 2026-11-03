-- DP-156 F7 r1 / #766: wolumen bałtycki — ROAD_LT/LV/EE/FI
-- • z load_id: jak SE (risk_crit / risk_route)
-- • bez load_id: tylko HIGH/CRITICAL → risk_crit; MEDIUM/LOW → null
-- Payload RISK_OPEN: dopisane load_id; trigger + bramka matrix_notify.


create or replace function public.notify_event_key(p_template text, p_payload jsonb)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when p_template = 'LOAD_CHAT_MESSAGE' then 'chat'
    when p_template in ('PLAN_DATES_CHANGED', 'SCHEDULE_DATE_CRITICAL') then 'dates'
    when p_template = 'KSH_IMPORT_SUMMARY' then 'ksh_import'
    when p_template = 'ETA_CALIBRATION_AUTO' then 'eta_calib'
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
    when p_template in ('DECISION_ESCALATED', 'DECISION_ESCALATED_BATCH') then 'dec_late'
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
    when p_template in ('RISK_OPEN', 'RISK_SEVERITY')
         and coalesce(p_payload->>'kind', '') = 'LATE_DATE_CHANGE' then 'dates'
    when p_template in ('RISK_OPEN', 'RISK_SEVERITY')
         and coalesce(p_payload->>'kind', '') in (
           'SILENT_VEHICLE', 'LOADING_UNCONFIRMED', 'AUTO_STATUS'
         ) then 'status'
    when p_template = 'SOURCE_BACK' then 'src_back'
    when coalesce(p_payload->>'kind', '') in ('USAGE_LIMIT', 'JOB_FAILURE')
         or p_template in ('JOB_FAILURE', 'SOURCE_DOWN') then 'src_down'
    when p_template = 'APP_ERROR' then 'app_err'
    when p_template in ('SMS_GATEWAY_SILENT', 'SMS_UNDELIVERED', 'SMS_FALLBACK', 'ZONE_LIMIT') then 'sms_gw'
    when p_template = 'WORKFLOW_ALERT' then 'workflow'
    when p_template in ('DAILY_DIGEST', 'ADMIN_DIGEST') then 'daily'
    when p_template = 'INVOICE_NEW' then 'inv_check'
    when p_template = 'INVOICE_UPDATED' then 'inv_updated'
    when p_template = 'INVOICE_CORRECTED' then 'inv_corrected'
    when p_template in ('INVOICE_DISPUTED', 'INVOICE_DISPUTE_REPLY', 'INVOICE_DISPUTE_RESOLVED') then 'inv_dispute'
    when p_template in ('INVOICE_OVERDUE', 'PAYMENT_REMINDER') then 'inv_overdue'
    when p_template = 'FUEL_READING_MISSING' then 'fuel_miss'
    when p_template = 'EMAIL_BUDGET' then 'email_budget'
    when p_template = 'INSURANCE_EXPIRY' then 'cmr'
    when p_template = 'L17_BACKLOG' then 'status'
    when p_template in ('ETA_NOTIFY_KSH', 'DECISION_EMAIL_KSH') then 'status'
    when p_template = 'KSH_DATE_COUNTER_RESULT' then 'dec_new'
    when p_template in ('WEEK_CLOSED', 'INVOICE_WEEK') then 'week'
    when p_template like 'FACTOR%' then 'factoring'
    -- DP-156 F7: bałtyk bez transportu — tylko HIGH/CRITICAL
    when p_template in ('RISK_OPEN', 'RISK_SEVERITY')
         and coalesce(p_payload->>'kind', '') in ('ROAD_LT', 'ROAD_LV', 'ROAD_EE', 'ROAD_FI')
         and nullif(coalesce(p_payload->>'load_id', ''), '') is null
         and coalesce(p_payload->>'severity', '') in ('HIGH', 'CRITICAL') then 'risk_crit'
    -- bałtyk z transportem — jak SE
    when p_template in ('RISK_OPEN', 'RISK_SEVERITY')
         and coalesce(p_payload->>'kind', '') in ('ROAD_LT', 'ROAD_LV', 'ROAD_EE', 'ROAD_FI')
         and nullif(coalesce(p_payload->>'load_id', ''), '') is not null
         and coalesce(p_payload->>'severity', '') = 'CRITICAL' then 'risk_crit'
    when p_template in ('RISK_OPEN', 'RISK_SEVERITY')
         and coalesce(p_payload->>'kind', '') in ('ROAD_LT', 'ROAD_LV', 'ROAD_EE', 'ROAD_FI')
         and nullif(coalesce(p_payload->>'load_id', ''), '') is not null then 'risk_route'
    -- SE/PL/FERRY/WEATHER/ETA (bez bałtyku — bałtyk MEDIUM/LOW bez load → null wyżej)
    when p_template in ('RISK_OPEN', 'RISK_SEVERITY')
         and coalesce(p_payload->>'kind', '') in (
           'FERRY', 'WEATHER', 'ROAD_SE', 'ROAD_PL', 'ETA_BREACH'
         )
         and coalesce(p_payload->>'severity', '') = 'CRITICAL' then 'risk_crit'
    when p_template in ('RISK_OPEN', 'RISK_SEVERITY')
         and coalesce(p_payload->>'kind', '') in (
           'FERRY', 'WEATHER', 'ROAD_SE', 'ROAD_PL', 'ETA_BREACH'
         ) then 'risk_route'
    when p_template in ('ROAD_RISK', 'FERRY_CANCELLED', 'FERRY_OVERDUE')
         and coalesce(p_payload->>'severity', '') = 'CRITICAL' then 'risk_crit'
    when p_template in ('ROAD_RISK', 'FERRY_CANCELLED', 'FERRY_OVERDUE') then 'risk_route'
    when p_template in (
           'FERRY', 'WEATHER', 'ROAD_SE', 'ROAD_PL',
           'ROAD_LT', 'ROAD_LV', 'ROAD_EE', 'ROAD_FI'
         )
         and nullif(coalesce(p_payload->>'load_id', ''), '') is null then 'risk_general'
    else null
  end
$$;

comment on function public.notify_event_key(text, jsonb) is
  'DP-156 F7/#766: bałtyk z load jak SE; bez load tylko HIGH/CRIT → risk_crit.';

revoke all on function public.notify_event_key(text, jsonb) from public, anon, authenticated;


-- Trigger: bałtyk bez load — MEDIUM/LOW pomijaj; HIGH/CRIT idą dalej. Payload z load_id.
create or replace function public.trg_risk_matrix_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_group text;
  v_tpl text;
  v_proj uuid;
  v_n int;
  v_url text;
  v_code text;
  v_payload jsonb;
begin
  if new.load_id is null
     and new.kind::text in ('FERRY', 'WEATHER', 'ROAD_SE', 'ROAD_PL') then
    return null;
  end if;
  -- DP-156 F7: bałtyk bez transportu — tylko HIGH/CRITICAL do macierzy
  if new.load_id is null
     and new.kind::text in ('ROAD_LT', 'ROAD_LV', 'ROAD_EE', 'ROAD_FI')
     and new.severity::text not in ('HIGH', 'CRITICAL') then
    return null;
  end if;
  if current_setting('tower.escalate_overdue', true) = '1'
     and coalesce(new.dedup_key, '') like 'decision-overdue:%' then
    return null;
  end if;

  v_group := case
    when new.kind::text in ('FERRY', 'WEATHER', 'ETA_BREACH') then 'RISK_FERRY_WEATHER'
    when new.kind::text in ('INVOICE_MISMATCH') then 'MONEY'
    when new.kind::text in ('USAGE_LIMIT', 'JOB_FAILURE') then 'SYSTEM'
    else 'SYSTEM'
  end;

  if tg_op = 'INSERT' then
    v_tpl := 'RISK_OPEN';
  elsif new.severity is distinct from old.severity then
    v_tpl := 'RISK_SEVERITY';
  elsif new.resolved_at is not null and old.resolved_at is null then
    v_n := public.notify_mark_case_closed('sprawa zamknięta', null, new.id);
    insert into public.audit_log (user_id, action, entity, entity_id, old_value, new_value)
    values (
      null, 'C1_RISK_RESOLVE_MARK_READ', 'risk_signals', new.id::text,
      jsonb_build_object('template', 'RISK_RESOLVED_skipped'),
      jsonb_build_object('marked', v_n, 'hotfix', '0256')
    );
    return null;
  else
    return null;
  end if;

  if v_tpl = 'RISK_SEVERITY'
     and new.severity::text = 'CRITICAL'
     and coalesce(new.detail->>'l3_level', '') = 'critical' then
    return null;
  end if;

  v_proj := new.project_id;
  if v_proj is null and new.load_id is not null then
    select project_id into v_proj from loads where id = new.load_id;
  end if;
  if new.load_id is not null then
    select coalesce(nullif(l.order_no, ''), nullif(l.hhl_order_no, ''))
      into v_code from loads l where l.id = new.load_id;
  end if;
  v_payload := jsonb_build_object(
    'risk_id', new.id, 'kind', new.kind, 'severity', new.severity,
    'title', new.title, 'title_key', new.title_key,
    'code', v_code, 'load_id', new.load_id
  );
  v_url := public.notify_click_url(v_tpl, v_payload, new.load_id);
  v_payload := v_payload || jsonb_build_object('url', v_url);
  perform public.matrix_notify(
    v_group, v_tpl, new.load_id, v_proj,
    v_payload,
    'risk:' || v_tpl || ':' || new.id::text || ':' || new.severity::text
  );
  return null;
end $$;
revoke all on function public.trg_risk_matrix_notify() from public, anon, authenticated;
comment on function public.trg_risk_matrix_notify() is
  'DP-156 F7/#766: bałtyk bez load tylko HIGH/CRIT; payload z load_id.';


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
  v_url text;
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

  -- #411: nigdy DECISION_RESOLVED / RISK_RESOLVED
  if p_template in ('RISK_RESOLVED', 'DECISION_RESOLVED') then
    return 0;
  end if;

  if p_load_id is null and p_template in ('RISK_OPEN', 'RISK_SEVERITY') then
    -- DP-156 F7: ROAD_LT/LV/EE/FI HIGH/CRITICAL bez transportu → risk_crit (0389)
    if coalesce(v_payload->>'kind', '') not in ('USAGE_LIMIT', 'JOB_FAILURE')
       and coalesce(v_payload->>'title_key', '') is distinct from 'rk_source_down'
       and p_dedup_prefix not like 'SOURCE_DOWN%'
       and not (
         coalesce(v_payload->>'kind', '') in ('ROAD_LT', 'ROAD_LV', 'ROAD_EE', 'ROAD_FI')
         and coalesce(v_payload->>'severity', '') in ('HIGH', 'CRITICAL')
       ) then
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
  v_legacy_job := coalesce(v_payload->>'kind', '') in ('JOB_FAILURE', 'USAGE_LIMIT')
    and p_template in ('RISK_OPEN', 'RISK_SEVERITY');
  v_src_bell_only := v_event = 'src_down'
    and p_template in ('RISK_OPEN', 'RISK_SEVERITY')
    and coalesce(v_payload->>'title_key', '') is distinct from 'rk_source_down'
    and coalesce(p_dedup_prefix, '') not like 'SOURCE_DOWN%';

  select order_no into v_order from loads where id = p_load_id;
  if nullif(v_payload->>'url', '') is null then
    v_url := public.notify_click_url(
      p_template,
      v_payload || jsonb_build_object('code', coalesce(v_payload->>'code', v_order)),
      p_load_id
    );
    if v_url is distinct from '/' then
      v_payload := v_payload || jsonb_build_object('url', v_url);
    end if;
  end if;
  if nullif(v_payload->>'code', '') is null and v_order is not null then
    v_payload := v_payload || jsonb_build_object('code', v_order);
  end if;

  v_payload := v_payload
    || jsonb_build_object('event_group', p_event_group, 'event_key', p_dedup_prefix, 'matrix_event', v_event);
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
     and public.notify_channel_allowed(u.id, p_template, v_payload, 'bell') is true
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
     where u.active and u.email is not null
       and u.role in ('HHL_ADMIN','HHL_OPS','CLIENT_USER','CARRIER_DISPATCH','CARRIER_USER')
       and (p_only_org_kind is null or o.kind::text = p_only_org_kind)
       and public.notify_channel_allowed(u.id, p_template, v_payload, 'mail') is true
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
  v_has_push_target := p_load_id is not null or v_decision is not null or v_source_alarm or v_event in ('chat', 'app_err', 'daily', 'risk_crit');
  v_push_ok := v_legacy_job is not true and v_src_bell_only is not true
    and (v_has_push_target is true or v_critical is true);
  if v_push_ok is true then
  insert into notifications (channel, recipient, user_id, load_id, template, payload, dedup_key, status)
  select 'WEB_PUSH', coalesce(u.email::text, u.id::text), u.id, p_load_id, p_template,
         v_payload || jsonb_build_object('locale', u.locale)
           || case when v_critical is true or v_event in ('chat', 'app_err') then
                   case when v_event = 'chat' then '{}'::jsonb
                        else jsonb_build_object('critical', true) end
                   else '{}'::jsonb end,
         left(p_dedup_prefix || ':WP:' || u.id::text, 200),
         'PENDING'
    from app_users u
    join organizations o on o.id = u.org_id
    join notification_matrix m
      on m.event_key = v_event and m.role = u.role and m.risks_only is not true
    left join user_preferences pref on pref.user_id = u.id
   where u.active
     and u.role in ('HHL_ADMIN','HHL_OPS','CLIENT_USER','CARRIER_DISPATCH','CARRIER_USER')
     and public.notify_channel_allowed(u.id, p_template, v_payload, 'push') is true
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
  end if;

  return n;
end $$;


revoke all on function public.matrix_notify(text, text, uuid, uuid, jsonb, text, text) from public, anon, authenticated;
comment on function public.matrix_notify(text, text, uuid, uuid, jsonb, text, text) is
  '#411 + DP-156 F7/#766: bałtyk HIGH/CRIT bez load; push risk_crit.';
