-- HOTFIX #411 / D-20261021-2038-01: zamknięta sprawa znika z dzwonka i telefonu;
-- bez powiadomień DECISION_RESOLVED / RISK_RESOLVED; WEB_PUSH z url celu.
-- Po 0255 (#402), przed #405 (0257).

-- ---------------------------------------------------------------------------
-- Cel kliknięcia push (jak dzwonek / clickTargets): #/decyzje/<id>, #/transport/<kod>
-- ---------------------------------------------------------------------------
create or replace function public.notify_click_url(
  p_template text,
  p_payload jsonb,
  p_load_id uuid
) returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_dec text;
  v_code text;
  v_tab text;
begin
  if p_template = 'DECISION_ESCALATED_BATCH' then
    return '/#/ryzyka';
  end if;
  v_dec := coalesce(
    nullif(p_payload->>'decision_id', ''),
    nullif(p_payload->>'decisionId', '')
  );
  if v_dec is not null
     and (
       p_template like 'DECISION%'
       or p_template in ('FERRY_CANCELLED', 'ETA_AFTER_LATEST', 'NO_POSITION',
                         'SCHEDULE_DATE_CRITICAL', 'SILENT_VEHICLE', 'RISK_OPEN',
                         'RISK_SEVERITY', 'INSURANCE_EXPIRY', 'INSURANCE')
     ) then
    return '/#/decyzje/' || v_dec;
  end if;
  v_code := coalesce(
    nullif(p_payload->>'code', ''),
    nullif(p_payload->>'load_code', ''),
    nullif(p_payload->>'order_no', ''),
    nullif(p_payload->>'hhl_order_no', '')
  );
  if v_code is null and p_load_id is not null then
    select coalesce(nullif(l.order_no, ''), nullif(l.hhl_order_no, ''))
      into v_code
      from loads l where l.id = p_load_id;
  end if;
  if v_code is not null then
    v_tab := coalesce(nullif(p_payload->>'tab', ''), 'status');
    return '/#/transport/' || replace(v_code, '/', '%2F')
           || '?zakladka=' || replace(v_tab, ' ', '%20');
  end if;
  if v_dec is not null then
    return '/#/decyzje/' || v_dec;
  end if;
  return '/';
end $$;
revoke all on function public.notify_click_url(text, jsonb, uuid) from public, anon, authenticated;
comment on function public.notify_click_url(text, jsonb, uuid) is
  '#411: url push = ten sam cel co dzwonek (#/decyzje, #/transport).';

-- ---------------------------------------------------------------------------
-- Zamknięcie sprawy → przeczytane / SUPPRESSED powiązane wpisy
-- ---------------------------------------------------------------------------
create or replace function public.notify_mark_case_closed(
  p_reason text,
  p_decision_id uuid default null,
  p_risk_id uuid default null
) returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n int := 0;
  v_now timestamptz := now();
  v_reason text := left(coalesce(nullif(trim(p_reason), ''), 'sprawa zamknięta'), 200);
begin
  if p_decision_id is null and p_risk_id is null then
    return 0;
  end if;

  with touched as (
    update public.notifications n
       set read_at = coalesce(n.read_at, v_now),
           status = case
             when n.channel in ('WEB_PUSH', 'EMAIL')
              and n.status in ('PENDING', 'DIGEST', 'QUEUED')
             then 'SUPPRESSED'
             else n.status
           end,
           error = case
             when n.channel in ('WEB_PUSH', 'EMAIL')
              and n.status in ('PENDING', 'DIGEST', 'QUEUED')
             then left(coalesce(nullif(n.error, '') || '; ', '') || 'gate:' || v_reason, 500)
             else n.error
           end,
           payload = coalesce(n.payload, '{}'::jsonb)
                     || jsonb_build_object(
                          'case_closed_at', v_now,
                          'case_closed_reason', v_reason,
                          'c1_resolved', true
                        )
                     || case when p_risk_id is not null
                             then jsonb_build_object('risk_resolved_at', v_now)
                             else '{}'::jsonb end
     where n.read_at is null
       and n.template in (
         'DECISION_OPEN', 'DECISION_ESCALATED', 'DECISION_ESCALATED_BATCH',
         'DECISION_RESOLVED',
         'RISK_OPEN', 'RISK_SEVERITY', 'RISK_RESOLVED'
       )
       and (
         (p_decision_id is not null and (
           n.payload->>'decision_id' = p_decision_id::text
           or n.payload->>'decisionId' = p_decision_id::text
           or coalesce(n.payload->'decision_ids', '[]'::jsonb) ? p_decision_id::text
           or n.dedup_key like '%:' || p_decision_id::text || '%'
           or n.dedup_key like 'decision-overdue:' || p_decision_id::text || '%'
           or n.dedup_key like 'dec:%:' || p_decision_id::text || '%'
         ))
         or (p_risk_id is not null and (
           n.payload->>'risk_id' = p_risk_id::text
           or n.dedup_key like '%:' || p_risk_id::text || '%'
           or n.dedup_key like 'risk:%:' || p_risk_id::text || '%'
         ))
       )
    returning n.id
  )
  select count(*)::int into v_n from touched;

  if v_n > 0 then
    insert into public.audit_log (user_id, action, entity, entity_id, new_value)
    values (
      null, 'AUDYT17_MARK_READ', 'notifications',
      coalesce(p_decision_id::text, p_risk_id::text),
      jsonb_build_object(
        'count', v_n,
        'reason', v_reason,
        'decision_id', p_decision_id,
        'risk_id', p_risk_id,
        'hotfix', '0256'
      )
    );
  end if;
  return v_n;
end $$;
revoke all on function public.notify_mark_case_closed(text, uuid, uuid) from public, anon, authenticated;
comment on function public.notify_mark_case_closed(text, uuid, uuid) is
  '#411: zamknięcie decyzji/ryzyka → read_at + SUPPRESSED oczekujących.';

-- ---------------------------------------------------------------------------
-- mark_notifications_read: dowolny kanał + bliźniak :WP: ↔ :IN: (F7 B3).
-- Front (dzwonek / ?pn=) woła tę funkcję — bez filtra channel=IN_APP.
-- ---------------------------------------------------------------------------
create or replace function public.mark_notifications_read(p_ids bigint[])
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.current_app_user_id();
  v_n int := 0;
  v_k int := 0;
  r record;
  v_twin text;
begin
  if v_uid is null or p_ids is null then
    return 0;
  end if;

  update public.notifications
     set read_at = coalesce(read_at, now())
   where id = any(p_ids)
     and user_id = v_uid;
  get diagnostics v_n = row_count;

  for r in
    select n.id, n.dedup_key
      from public.notifications n
     where n.id = any(p_ids)
       and n.user_id = v_uid
       and n.dedup_key is not null
       and (
         position(':WP:' in n.dedup_key) > 0
         or position(':IN:' in n.dedup_key) > 0
       )
  loop
    if position(':WP:' in r.dedup_key) > 0 then
      v_twin := replace(r.dedup_key, ':WP:', ':IN:');
    else
      v_twin := replace(r.dedup_key, ':IN:', ':WP:');
    end if;
    update public.notifications
       set read_at = coalesce(read_at, now())
     where user_id = v_uid
       and dedup_key = v_twin
       and id is distinct from r.id
       and read_at is null;
    get diagnostics v_k = row_count;
    v_n := v_n + v_k;
  end loop;

  return v_n;
end $$;
revoke all on function public.mark_notifications_read(bigint[]) from public, anon;
grant execute on function public.mark_notifications_read(bigint[]) to authenticated;
comment on function public.mark_notifications_read(bigint[]) is
  '#411 F7: własne wpisy (wszystkie kanały) + bliźniak :WP:↔:IN:.';

create or replace function public.mark_notification_read_any(p_id bigint)
returns int
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_id is null then
    return 0;
  end if;
  return public.mark_notifications_read(array[p_id]::bigint[]);
end $$;
revoke all on function public.mark_notification_read_any(bigint) from public, anon;
grant execute on function public.mark_notification_read_any(bigint) to authenticated;
comment on function public.mark_notification_read_any(bigint) is
  '#411: alias — mark_notifications_read(array[id]) z bliźniakiem :WP:↔:IN:.';

-- Indeks pod sprzątanie / bliźniaki przy rosnącej tabeli (F7 drobne)
create index if not exists notifications_unread_dedup_idx
  on public.notifications (dedup_key)
  where read_at is null and dedup_key is not null;

-- ---------------------------------------------------------------------------
-- decision_notify: RESOLVE nie tworzy DECISION_RESOLVED — oznacza powiązane
-- ---------------------------------------------------------------------------
create or replace function public.decision_notify(p_decision uuid, p_event text)
returns int
language plpgsql security definer set search_path = public as $$
declare
  d decisions%rowtype;
  v_role text;
  v_tpl text;
  n int := 0;
  v_dedup text;
begin
  select * into d from decisions where id = p_decision;
  if not found then return 0; end if;

  -- #411: zamknięcie → 0× DECISION_RESOLVED; dzwonek/push/mail powiązane przeczytane
  if p_event = 'RESOLVE' then
    return public.notify_mark_case_closed('sprawa zamknięta', p_decision, d.risk_id);
  end if;

  select decider_role into v_role from decision_types where code = d.type_code;
  v_tpl := case p_event
    when 'OPEN' then 'DECISION_OPEN'
    when 'ESCALATE' then 'DECISION_ESCALATED'
    else 'DECISION_EVENT'
  end;
  v_dedup := 'dec:' || p_event || ':' || d.id::text;

  n := n + public.matrix_notify(
    'DECISION', v_tpl, d.load_id, d.project_id,
    jsonb_build_object(
      'decision_id', d.id, 'type', d.type_code, 'title', d.title,
      'status', d.status, 'event', p_event, 'resolution', d.resolution_code,
      'url', public.notify_click_url(v_tpl,
        jsonb_build_object('decision_id', d.id, 'type', d.type_code), d.load_id)
    ),
    v_dedup, 'FORWARDER'
  );

  if v_role = 'CARRIER' then
    n := n + public.matrix_notify(
      'DECISION', v_tpl, d.load_id, d.project_id,
      jsonb_build_object(
        'decision_id', d.id, 'type', d.type_code, 'title', d.title,
        'status', d.status, 'event', p_event, 'resolution', d.resolution_code,
        'url', public.notify_click_url(v_tpl,
          jsonb_build_object('decision_id', d.id, 'type', d.type_code), d.load_id)
      ),
      v_dedup, 'CARRIER'
    );
  end if;

  n := n + public.matrix_notify(
    'DECISION', v_tpl, d.load_id, d.project_id,
    jsonb_build_object(
      'decision_id', d.id, 'type', d.type_code, 'title', d.title,
      'status', d.status, 'event', p_event, 'resolution', d.resolution_code,
      'url', public.notify_click_url(v_tpl,
        jsonb_build_object('decision_id', d.id, 'type', d.type_code), d.load_id)
    ),
    v_dedup, 'CLIENT'
  );

  return n;
end $$;
revoke all on function public.decision_notify(uuid, text) from public, anon, authenticated;
comment on function public.decision_notify(uuid, text) is
  '#411: RESOLVE bez DECISION_RESOLVED; OPEN/ESCALATE z url w payload.';

-- ---------------------------------------------------------------------------
-- F7 B1: zamknięcie decyzji bezpośrednim UPDATE (bez decision_notify)
-- → też czyści dzwonek. Enum: NEW/ASSIGNED/SNOOZED/RESOLVED/EXPIRED (bez CANCELLED).
-- ---------------------------------------------------------------------------
create or replace function public.trg_decision_mark_case_closed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status
     and new.status in ('RESOLVED', 'EXPIRED')
     and old.status is distinct from new.status then
    perform public.notify_mark_case_closed('sprawa zamknięta', new.id, new.risk_id);
  end if;
  return new;
end $$;
revoke all on function public.trg_decision_mark_case_closed() from public, anon, authenticated;

drop trigger if exists trg_decision_mark_case_closed on public.decisions;
create trigger trg_decision_mark_case_closed
  after update of status on public.decisions
  for each row
  execute function public.trg_decision_mark_case_closed();

-- ---------------------------------------------------------------------------
-- Ryzyko: resolve → wszystkie kanały (nie tylko IN_APP RISK_OPEN)
-- ---------------------------------------------------------------------------
create or replace function public.trg_risk_matrix_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_group text;
  v_tpl text;
  v_proj uuid;
  v_n int;
  v_url text;
  v_code text;
begin
  if new.load_id is null
     and new.kind::text in ('FERRY', 'WEATHER', 'ROAD_SE', 'ROAD_PL') then
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
    -- #411: bez RISK_RESOLVED; oznacz powiązane IN_APP/WEB_PUSH/EMAIL
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
  v_url := public.notify_click_url(
    v_tpl,
    jsonb_build_object(
      'risk_id', new.id, 'kind', new.kind, 'severity', new.severity,
      'title', new.title, 'title_key', new.title_key,
      'code', v_code
    ),
    new.load_id
  );
  perform public.matrix_notify(
    v_group, v_tpl, new.load_id, v_proj,
    jsonb_build_object(
      'risk_id', new.id, 'kind', new.kind, 'severity', new.severity,
      'title', new.title, 'title_key', new.title_key,
      'code', v_code, 'url', v_url
    ),
    'risk:' || v_tpl || ':' || new.id::text || ':' || new.severity::text
  );
  return null;
end $$;
revoke all on function public.trg_risk_matrix_notify() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- matrix_notify: blokuj też DECISION_RESOLVED; dopisz url do WEB_PUSH
-- (pełna kopia 0255 + dwie zmiany)
-- ---------------------------------------------------------------------------
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
  v_has_push_target := p_load_id is not null or v_decision is not null or v_source_alarm or v_event in ('chat', 'app_err', 'daily');
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
  '#411: bez *_RESOLVED; WEB_PUSH/IN_APP z url celu; #402 bramka firma→rola→osoba.';

-- ---------------------------------------------------------------------------
-- Jednorazowe sprzątanie: nieprzeczytane *_RESOLVED + wpisy zamkniętych spraw
-- ---------------------------------------------------------------------------
do $cleanup$
declare
  v_now timestamptz := now();
  v_n int;
  v_prev text;
begin
  insert into audit_log (user_id, action, entity, entity_id, new_value)
  select null, 'HOTFIX_411_BEFORE', 'notifications', '0256',
         jsonb_build_object(
           'unread_decision_resolved',
           (select count(*) from notifications
             where template = 'DECISION_RESOLVED' and read_at is null),
           'unread_risk_resolved',
           (select count(*) from notifications
             where template = 'RISK_RESOLVED' and read_at is null),
           'unread_closed_decision',
           (select count(*) from notifications n
             where n.read_at is null
               and n.template in ('DECISION_OPEN','DECISION_ESCALATED','DECISION_ESCALATED_BATCH')
               and exists (
                 select 1 from decisions d
                  where d.id::text = coalesce(n.payload->>'decision_id', n.payload->>'decisionId')
                    and d.status in ('RESOLVED','EXPIRED')
               )),
           'unread_closed_risk',
           (select count(*) from notifications n
             where n.read_at is null
               and n.template in ('RISK_OPEN','RISK_SEVERITY')
               and exists (
                 select 1 from risk_signals s
                  where s.id::text = n.payload->>'risk_id'
                    and s.resolved_at is not null
               ))
         );

  v_prev := current_setting('tower.bulk_quiet', true);
  perform set_config('tower.bulk_quiet', 'on', true);

  with marked as (
    update notifications n
       set read_at = coalesce(n.read_at, v_now),
           status = case
             when n.channel in ('WEB_PUSH', 'EMAIL')
              and n.status in ('PENDING', 'DIGEST', 'QUEUED')
             then 'SUPPRESSED' else n.status end,
           error = case
             when n.channel in ('WEB_PUSH', 'EMAIL')
              and n.status in ('PENDING', 'DIGEST', 'QUEUED')
             then left(coalesce(nullif(n.error, '') || '; ', '') || 'gate:sprawa zamknięta', 500)
             else n.error end,
           payload = coalesce(n.payload, '{}'::jsonb)
                     || jsonb_build_object('case_closed_at', v_now, 'case_closed_reason', '0256_bulk')
     where n.read_at is null
       and (
         n.template in ('DECISION_RESOLVED', 'RISK_RESOLVED')
         or (
           n.template in ('DECISION_OPEN', 'DECISION_ESCALATED', 'DECISION_ESCALATED_BATCH')
           and exists (
             select 1 from decisions d
              where (
                d.id::text = coalesce(n.payload->>'decision_id', n.payload->>'decisionId')
                or coalesce(n.payload->'decision_ids', '[]'::jsonb) ? d.id::text
              )
                and d.status in ('RESOLVED', 'EXPIRED')
           )
         )
         or (
           n.template in ('RISK_OPEN', 'RISK_SEVERITY')
           and exists (
             select 1 from risk_signals s
              where s.id::text = n.payload->>'risk_id'
                and s.resolved_at is not null
           )
         )
       )
    returning n.id
  )
  select count(*)::int into v_n from marked;

  insert into audit_log (user_id, action, entity, entity_id, new_value)
  values (null, 'AUDYT17_MARK_READ', 'notifications', 'hotfix-0256',
          jsonb_build_object('count', v_n, 'hotfix', '0256', 'reason', 'closed_case_bulk'));

  perform set_config('tower.bulk_quiet', coalesce(v_prev, ''), true);

  insert into audit_log (user_id, action, entity, entity_id, new_value)
  values (null, 'HOTFIX_411_AFTER', 'notifications', '0256',
          jsonb_build_object('marked', v_n, 'hotfix', '0256'));
end $cleanup$;
