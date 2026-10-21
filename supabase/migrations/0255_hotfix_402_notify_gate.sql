-- HOTFIX #402 / D-20261021-1952-01 — jedna bramka powiadomień (bez wyjątków „krytyczne zawsze”).
-- 1) prefs osoby wygrywają nad fixed_*; 2) bez push_fallback→EMAIL; 3) l13_queue_email + sms_watchdog
--    przez macierz; 4) ponowna kontrola przy wysyłce (notify_email_still_allowed).

-- Kreator reguł (WORKFLOW_ALERT) — wiersz macierzy, da się wyłączyć w Opcjach.
insert into public.notification_matrix (
  event_key, event_group, role, in_app, email, push,
  fixed_in_app, fixed_email, fixed_push, risks_only, label_pl
) values
('workflow','SYSTEM','HHL_ADMIN',true,true,false,false,false,false,false,'Alert z reguły (kreator)'),
('workflow','SYSTEM','HHL_OPS',true,true,false,false,false,false,false,'Alert z reguły (kreator)'),
('workflow','SYSTEM','CLIENT_USER',true,true,false,false,false,false,false,'Alert z reguły (kreator)'),
('workflow','SYSTEM','CARRIER_DISPATCH',true,true,false,false,false,false,false,'Alert z reguły (kreator)'),
('workflow','SYSTEM','CARRIER_USER',false,false,false,false,false,false,false,'Alert z reguły (kreator)')
on conflict (event_key, role) do update
  set event_group = excluded.event_group,
      label_pl = excluded.label_pl,
      in_app = excluded.in_app,
      email = excluded.email,
      push = excluded.push;

-- Pref zawsze wygrywa; fixed_* = tylko domyślna wartość macierzy, gdy brak wpisu w „Co dostaję”.
create or replace function public.notify_person_on(
  p_user uuid, p_event text, p_channel text, p_matrix boolean, p_fixed boolean
) returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select on_value from public.user_notify_pref
      where user_id = p_user and event_key = p_event and channel = p_channel),
    coalesce(p_matrix, false)
  )
$$;

revoke all on function public.notify_person_on(uuid, text, text, boolean, boolean) from public, anon, authenticated;
comment on function public.notify_person_on(uuid, text, text, boolean, boolean) is
  '#402: kanał = pref osoby, inaczej macierz; fixed_* nie omija „Co dostaję”.';

-- Domyślnie włączone w macierzy, ale da się wyłączyć w Opcjach / „Co dostaję”.
update public.notification_matrix
   set fixed_email = false, fixed_push = false, fixed_in_app = false
 where fixed_email is true or fixed_push is true or fixed_in_app is true;

-- Jak 0237 + SCHEDULE_DATE_CRITICAL → dates; DECISION_ESCALATED_BATCH → dec_late.
create or replace function public.notify_event_key(p_template text, p_payload jsonb)
returns text
language sql
immutable
as $$
  select case
    when p_template = 'LOAD_CHAT_MESSAGE' then 'chat'
    when p_template in ('PLAN_DATES_CHANGED', 'SCHEDULE_DATE_CRITICAL') then 'dates'
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
    when p_template = 'INVOICE_OVERDUE' then 'inv_overdue'
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

-- Bramka: czy użytkownik może dostać kanał dla szablonu (macierz + pref).
create or replace function public.notify_channel_allowed(
  p_user uuid, p_template text, p_payload jsonb, p_channel text
) returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_event text;
  v_role user_role;
  v_matrix boolean;
  v_fixed boolean;
begin
  if (p_user is not null) is not true then
    return false;
  end if;
  if (p_channel in ('bell', 'mail', 'push')) is not true then
    return false;
  end if;
  -- Auth / systemowe poza Opcjami (nie w macierzy zdarzeń C3).
  if p_template in ('AUTH_INVITE', 'AUTH_PASSWORD_RESET', 'EMAIL_BUDGET') then
    return true;
  end if;
  v_event := public.notify_event_key(p_template, coalesce(p_payload, '{}'::jsonb));
  if (v_event is not null) is not true then
    return false;
  end if;
  select u.role into v_role from public.app_users u where u.id = p_user and u.active;
  if (v_role is not null) is not true then
    return false;
  end if;
  select
    case p_channel when 'bell' then m.in_app when 'mail' then m.email when 'push' then m.push end,
    case p_channel when 'bell' then m.fixed_in_app when 'mail' then m.fixed_email when 'push' then m.fixed_push end
    into v_matrix, v_fixed
    from public.notification_matrix m
   where m.event_key = v_event and m.role = v_role and m.risks_only is not true;
  if not found then
    return false;
  end if;
  return public.notify_person_on(p_user, v_event, p_channel, v_matrix, v_fixed) is true;
end $$;

revoke all on function public.notify_channel_allowed(uuid, text, jsonb, text) from public, anon, authenticated;
comment on function public.notify_channel_allowed(uuid, text, jsonb, text) is
  '#402: jedna bramka — macierz × pref; AUTH_* poza Opcjami.';

-- Ponowna kontrola w chwili wysyłki (kolejka mogła powstać przed wyłączeniem).
create or replace function public.notify_email_still_allowed(p_id bigint)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  n public.notifications%rowtype;
begin
  select * into n from public.notifications where id = p_id;
  if not found then
    return false;
  end if;
  if n.channel is distinct from 'EMAIL' then
    return false;
  end if;
  if n.status is distinct from 'PENDING' and n.status is distinct from 'DIGEST' then
    return n.status = 'SENT';
  end if;
  if public.notify_channel_allowed(n.user_id, n.template, n.payload, 'mail') is true then
    return true;
  end if;
  update public.notifications
     set status = 'SUPPRESSED',
         error = left(coalesce(error || '; ', '') || 'gate:mail_off', 500)
   where id = p_id
     and status in ('PENDING', 'DIGEST');
  return false;
end $$;

revoke all on function public.notify_email_still_allowed(bigint) from public, anon, authenticated;
grant execute on function public.notify_email_still_allowed(bigint) to service_role;
comment on function public.notify_email_still_allowed(bigint) is
  '#402: przed Resend — jeśli mail wyłączony → SUPPRESSED.';

-- l13_queue_email: bramka przed wstawieniem EMAIL (poza AUTH_*).
create or replace function public.l13_queue_email(
  p_kind text,
  p_template text,
  p_user uuid,
  p_recipient text,
  p_load uuid,
  p_order text,
  p_payload jsonb,
  p_dedup text,
  p_bundle text
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slot text;
  v_status text;
  v_id bigint;
  v_payload jsonb;
  v_key text;
  v_day date;
  v_item jsonb;
begin
  if p_user is null or coalesce(p_recipient, '') = '' then
    return 'skip';
  end if;
  if p_template is distinct from 'AUTH_INVITE'
     and p_template is distinct from 'AUTH_PASSWORD_RESET'
     and p_template is distinct from 'EMAIL_BUDGET'
     and public.notify_channel_allowed(p_user, p_template, coalesce(p_payload, '{}'::jsonb), 'mail') is not true then
    v_key := left(coalesce(p_dedup, 'gate:' || p_template || ':' || p_user::text), 200);
    insert into notifications (channel, recipient, user_id, load_id, template, payload, dedup_key, status, error)
    values (
      'EMAIL', p_recipient, p_user, p_load, p_template,
      coalesce(p_payload, '{}'::jsonb) || jsonb_build_object('gate', 'mail_off'),
      v_key, 'SUPPRESSED', 'gate:mail_off'
    )
    on conflict (dedup_key) where dedup_key is not null do nothing;
    return 'SUPPRESSED';
  end if;
  v_slot := public.l13_email_slot_kind(p_kind, now());
  v_status := case v_slot
    when 'immediate' then 'PENDING'
    when 'digest' then 'DIGEST'
    else 'SUPPRESSED'
  end;
  v_day := (now() at time zone 'Europe/Warsaw')::date;
  v_item := jsonb_build_object('load_id', p_load, 'order_no', p_order, 'template', p_template);

  if p_kind = 'critical' and coalesce(p_bundle, '') <> '' then
    v_key := left('bundle:' || p_bundle || ':EM:' || p_user::text, 200);
    select id, payload into v_id, v_payload from notifications where dedup_key = v_key;
    if v_id is not null then
      if not exists (
        select 1
          from jsonb_array_elements(coalesce(v_payload->'transports', '[]'::jsonb)) e
         where e->>'load_id' is not distinct from p_load::text
      ) then
        update notifications
           set payload = jsonb_set(
             payload,
             '{transports}',
             coalesce(payload->'transports', '[]'::jsonb) || jsonb_build_array(v_item),
             true
           )
         where id = v_id;
      end if;
      return (select status from notifications where id = v_id);
    end if;
    insert into notifications (channel, recipient, user_id, load_id, template, payload, dedup_key, status)
    values (
      'EMAIL', p_recipient, p_user, p_load, p_template,
      coalesce(p_payload, '{}'::jsonb) || jsonb_build_object(
        'l13_slot', v_slot, 'bundle_key', p_bundle, 'transports', jsonb_build_array(v_item)
      ),
      v_key, v_status
    )
    on conflict (dedup_key) where dedup_key is not null do nothing;
    return v_status;
  end if;

  if p_kind = 'digest' then
    v_key := left('digest:' || v_day::text || ':EM:' || p_user::text, 200);
    select id, payload into v_id, v_payload from notifications where dedup_key = v_key;
    if v_id is not null then
      if not exists (
        select 1
          from jsonb_array_elements(coalesce(v_payload->'events', '[]'::jsonb)) e
         where e->>'dedup' is not distinct from p_dedup
      ) then
        update notifications
           set payload = jsonb_set(
             payload,
             '{events}',
             coalesce(payload->'events', '[]'::jsonb) || jsonb_build_array(v_item || jsonb_build_object('dedup', p_dedup)),
             true
           )
         where id = v_id;
      end if;
      return (select status from notifications where id = v_id);
    end if;
    insert into notifications (channel, recipient, user_id, load_id, template, payload, dedup_key, status)
    values (
      'EMAIL', p_recipient, p_user, p_load, p_template,
      coalesce(p_payload, '{}'::jsonb) || jsonb_build_object(
        'l13_slot', v_slot,
        'events', jsonb_build_array(v_item || jsonb_build_object('dedup', p_dedup))
      ),
      v_key, v_status
    )
    on conflict (dedup_key) where dedup_key is not null do nothing;
    return v_status;
  end if;

  v_key := left(coalesce(p_dedup, 'auth:' || p_template || ':' || p_user::text), 200);
  insert into notifications (channel, recipient, user_id, load_id, template, payload, dedup_key, status)
  values (
    'EMAIL', p_recipient, p_user, p_load, p_template,
    coalesce(p_payload, '{}'::jsonb) || jsonb_build_object('l13_slot', v_slot),
    v_key, v_status
  )
  on conflict (dedup_key) where dedup_key is not null do nothing;
  return v_status;
end $$;

revoke all on function public.l13_queue_email(text, text, uuid, text, uuid, text, jsonb, text, text)
  from public, anon, authenticated;

-- matrix_notify: bez push_fallback→EMAIL; WEB_PUSH tylko przy push.
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
  v_legacy_job := coalesce(v_payload->>'kind', '') in ('JOB_FAILURE', 'USAGE_LIMIT')
    and p_template in ('RISK_OPEN', 'RISK_SEVERITY');
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
  -- #402: bez e-maila zapasowego z push (push_fallback) — mail tylko gdy kanał mail włączony.
  end if;

  return n;
end $$;

revoke all on function public.matrix_notify(text, text, uuid, uuid, jsonb, text, text) from public, anon, authenticated;
comment on function public.matrix_notify(text, text, uuid, uuid, jsonb, text, text) is
  '#402: macierz bez push_fallback EMAIL; prefs wygrywają nad fixed_*.';

-- sms_watchdog: e-maile tylko przez bramkę sms_gw.
create or replace function public.sms_watchdog(p_now timestamptz default now()) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_seen timestamptz; v_hb timestamptz; v_active int; v_queued int; v_silent boolean;
  v_proj record; v_key text; v_new int := 0;
  o record; r record; v_fb int := 0; v_exp int; v_scrub int; v_purge int; v_undel int := 0;
  v_proj_id uuid; v_cooldown boolean;
begin
  select max(last_seen_at), count(*) into v_seen, v_active from sms_devices where revoked_at is null;
  select max(at) into v_hb from sms_heartbeats;
  if v_hb is not null and (v_seen is null or v_hb > v_seen) then
    v_seen := v_hb;
  end if;
  select count(*) into v_queued from sms_outbox where status in ('QUEUED', 'CLAIMED');
  v_silent := (v_active > 0 and (v_seen is null or v_seen < p_now - interval '30 minutes'))
           or (v_active = 0 and v_queued > 0);
  for v_proj in select id from projects loop
    v_key := 'sms-gateway:' || v_proj.id;
    if v_silent then
      select exists (
        select 1 from risk_signals
         where dedup_key = v_key
           and resolved_at is not null
           and resolved_at > p_now - interval '60 minutes'
      ) into v_cooldown;
      if (v_cooldown) is not true
         and (exists (select 1 from risk_signals where dedup_key = v_key and resolved_at is null)) is not true then
        insert into risk_signals (project_id, kind, severity, title, title_key, detail, dedup_key, detected_at)
        values (v_proj.id, 'JOB_FAILURE', 'HIGH', 'Bramka SMS milczy', 'rk_job_failure',
          jsonb_build_object('job', 'sms-gateway', 'ostatni_sygnal', v_seen, 'kolejka', v_queued,
            'text', 'Brak sygnału telefonu-bramki od ' || coalesce(to_char(v_seen at time zone 'Europe/Warsaw', 'DD.MM.YYYY HH24:MI'), 'początku') || ' (próg 30 min); SMS w kolejce: ' || v_queued,
            'next_action', 'Sprawdź telefon-bramkę (zasilanie, Wi-Fi, aplikacja TOWER SMS). SMS starsze niż 10 min idą e-mailem zastępczym.',
            'params', jsonb_build_object('label', 'bramka SMS', 'label_key', 'job_label_sms_gateway',
              'since', coalesce(to_char(v_seen at time zone 'Europe/Warsaw', 'DD.MM.YYYY HH24:MI'), ''), 'window', '30 minutes'),
            'text_key', case when v_seen is null then 'rk_job_failure_text_never' else 'rk_job_failure_text' end,
            'next_action_key', 'rk_job_failure_next'),
          v_key, p_now);
        v_new := v_new + 1;
        perform public.matrix_notify(
          'SYSTEM', 'SMS_GATEWAY_SILENT', null, v_proj.id,
          jsonb_build_object(
            'since', to_char(v_seen at time zone 'Europe/Warsaw', 'DD.MM.YYYY HH24:MI'),
            'queued', v_queued, 'kind', 'JOB_FAILURE', 'title_key', 'rk_job_failure'
          ),
          'smsgw:' || v_proj.id || ':' || to_char(date_trunc('hour', p_now at time zone 'Europe/Warsaw'), 'YYYYMMDDHH24'),
          'FORWARDER'
        );
      end if;
    else
      update risk_signals set resolved_at = p_now where dedup_key = v_key and resolved_at is null;
    end if;
  end loop;

  update sms_outbox set status = 'EXPIRED' where status in ('QUEUED', 'CLAIMED') and expires_at <= p_now;
  get diagnostics v_exp = row_count;

  for o in select s.*, l.order_no, l.carrier_org_id from sms_outbox s left join loads l on l.id = s.load_id
            where s.fallback_at is null
              and ((s.status in ('QUEUED', 'CLAIMED') and s.created_at < p_now - interval '10 minutes') or s.status = 'FAILED')
            for update of s skip locked loop
    for r in
      select u.id, u.email from app_users u where u.active and u.email is not null and u.id = o.created_by
      union
      select u.id, u.email from app_users u
       where o.created_by is null and u.active and u.email is not null
         and (u.role in ('HHL_ADMIN', 'HHL_OPS') or (o.carrier_org_id is not null and u.org_id = o.carrier_org_id and u.role = 'CARRIER_DISPATCH'))
    loop
      perform public.l13_queue_email(
        'critical', 'SMS_FALLBACK', r.id, r.email, o.load_id, coalesce(o.order_no, '—'),
        jsonb_build_object('kind', o.kind, 'code', coalesce(o.order_no, '—'), 'to_tail', right(o.to_e164, 3),
                           'status', o.status, 'error', o.error, 'text', o.body),
        'smsfb:' || o.id || ':' || r.id, null
      );
    end loop;
    update sms_outbox set fallback_at = p_now where id = o.id;
    v_fb := v_fb + 1;
  end loop;

  for o in select s.* from sms_outbox s
            where s.status = 'SENT'
              and s.delivered_at is null
              and s.sent_at is not null
              and s.sent_at < p_now - interval '10 minutes'
              and s.fallback_at is null
            for update of s skip locked loop
    select id into v_proj_id from projects order by created_at nulls last limit 1;
    if v_proj_id is not null then
      v_key := 'sms-undelivered:' || o.id;
      if not exists (select 1 from risk_signals where dedup_key = v_key and resolved_at is null) then
        insert into risk_signals (project_id, kind, severity, title, title_key, detail, dedup_key, detected_at, load_id)
        values (v_proj_id, 'JOB_FAILURE', 'HIGH', 'SMS bez potwierdzenia doręczenia', 'rk_job_failure',
          jsonb_build_object('job', 'sms-delivery', 'sms_id', o.id, 'kind', o.kind,
            'to_tail', right(o.to_e164, 3), 'sent_at', o.sent_at,
            'text', 'SMS wysłany, brak DELIVERED > 10 min (…' || right(o.to_e164, 3) || ').',
            'next_action', 'Sprawdź telefon odbiorcy i bramkę; treść w e-mailu zastępczym.',
            'params', jsonb_build_object('label', 'doręczenie SMS', 'label_key', 'job_label_sms_gateway', 'window', '10 minutes'),
            'text_key', 'rk_job_failure_text', 'next_action_key', 'rk_job_failure_next'),
          v_key, p_now, o.load_id);
        v_undel := v_undel + 1;
      end if;
    end if;
    for r in select u.id, u.email from app_users u
              where u.active and u.email is not null and u.role in ('HHL_ADMIN', 'HHL_OPS')
    loop
      perform public.l13_queue_email(
        'critical', 'SMS_UNDELIVERED', r.id, r.email, o.load_id, null,
        jsonb_build_object('kind', o.kind, 'to_tail', right(o.to_e164, 3), 'sent_at', o.sent_at,
                           'status', 'SENT', 'text', o.body),
        'smsud:' || o.id || ':' || r.id, null
      );
    end loop;
    update sms_outbox set fallback_at = p_now where id = o.id;
    v_fb := v_fb + 1;
  end loop;

  update sms_outbox set body = '[link usunięty]'
   where contains_secret and body <> '[link usunięty]'
     and ((status in ('SENT', 'DELIVERED') and sent_at < p_now - interval '24 hours')
          or (status in ('FAILED', 'EXPIRED', 'CANCELLED') and coalesce(fallback_at, created_at) < p_now - interval '24 hours'));
  get diagnostics v_scrub = row_count;
  delete from sms_heartbeats where at < p_now - interval '7 days';
  delete from sms_outbox where created_at < p_now - interval '90 days';
  get diagnostics v_purge = row_count;
  return jsonb_build_object('cisza', v_silent, 'nowe_ryzyka', v_new, 'kolejka', v_queued, 'fallback', v_fb,
                            'bez_doręczenia', v_undel, 'przeterminowane', v_exp,
                            'wyczyszczone_linki', v_scrub, 'usuniete_90d', v_purge);
end $$;
revoke all on function public.sms_watchdog(timestamptz) from public, anon, authenticated;
comment on function public.sms_watchdog(timestamptz) is
  '#402: SMS_FALLBACK / SILENT / UNDELIVERED przez bramkę (sms_gw).';

-- C16 push→email zapasowy: tylko gdy mail włączony (bez omijania Opcji).
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
  v_st text;
begin
  select n.id, n.user_id, n.recipient, n.load_id, n.template, n.payload, n.status, n.delivered_at, n.created_at
    into r
    from notifications n
   where n.id = p_notification_id
     and n.channel = 'WEB_PUSH';
  if not found then
    return false;
  end if;
  if r.created_at < public.c16h_web_push_ack_boundary() then
    return false;
  end if;
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
  -- #402: zapasowy e-mail tylko przy włączonym kanale mail (nie przy samym push).
  if public.notify_channel_allowed(r.user_id, r.template, coalesce(r.payload, '{}'::jsonb), 'mail') is not true then
    return false;
  end if;

  v_dedup := left('push_fallback:' || r.id::text, 200);
  v_title := coalesce(r.payload->>'title', 'Watch Tower');
  v_body := coalesce(r.payload->>'body', r.template);
  v_url := coalesce(nullif(r.payload->>'url', ''), nullif(r.payload->>'href', ''), '/');
  if v_url like '%/brak' then
    v_url := '/';
  end if;

  v_st := public.l13_queue_email(
    'critical', r.template, r.user_id, trim(r.recipient), r.load_id, null,
    coalesce(r.payload, '{}'::jsonb) || jsonb_build_object(
      'title', v_title, 'body', v_body, 'url', v_url, 'push_fallback', true
    ),
    v_dedup, null
  );
  return v_st is distinct from 'SUPPRESSED' and v_st is distinct from 'skip';
end $$;

revoke all on function public.web_push_enqueue_fallback(bigint) from public, anon, authenticated;
grant execute on function public.web_push_enqueue_fallback(bigint) to service_role;
comment on function public.web_push_enqueue_fallback(bigint) is
  '#402: EMAIL zapasowy z push tylko gdy mail włączony w Opcjach / „Co dostaję”.';

-- Jednorazowo: kolejka PENDING/DIGEST, która dziś nie przejdzie bramki → SUPPRESSED.
update public.notifications n
   set status = 'SUPPRESSED',
       error = left(coalesce(n.error || '; ', '') || 'gate:mail_off_bulk', 500)
 where n.channel = 'EMAIL'
   and n.status in ('PENDING', 'DIGEST')
   and n.template not in ('AUTH_INVITE', 'AUTH_PASSWORD_RESET', 'EMAIL_BUDGET')
   and public.notify_channel_allowed(n.user_id, n.template, n.payload, 'mail') is not true;
