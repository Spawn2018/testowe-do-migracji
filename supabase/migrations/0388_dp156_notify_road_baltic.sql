-- DP-156 / #762 C1: notify_event_key — ROAD_LT/LV/EE/FI jak ROAD_SE/PL
-- (risk_crit / risk_route / risk_general). Źródło: F7 #726; C1 #762.

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
    when p_template in ('RISK_OPEN', 'RISK_SEVERITY')
         and coalesce(p_payload->>'kind', '') in (
           'FERRY', 'WEATHER', 'ROAD_SE', 'ROAD_PL',
           'ROAD_LT', 'ROAD_LV', 'ROAD_EE', 'ROAD_FI', 'ETA_BREACH'
         )
         and coalesce(p_payload->>'severity', '') = 'CRITICAL' then 'risk_crit'
    when p_template in ('RISK_OPEN', 'RISK_SEVERITY')
         and coalesce(p_payload->>'kind', '') in (
           'FERRY', 'WEATHER', 'ROAD_SE', 'ROAD_PL',
           'ROAD_LT', 'ROAD_LV', 'ROAD_EE', 'ROAD_FI', 'ETA_BREACH'
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
  'DP-156/#762: event_key macierzy; ROAD_LT/LV/EE/FI jak ROAD_SE/PL (risk_crit/route/general).';

revoke all on function public.notify_event_key(text, jsonb) from public, anon, authenticated;
