-- C5 (D-20261015-0300-01): payload.code / tytuł czatu = load_sms_code;
-- matrix_notify bez fallbacku do order_no. Po 0436 (RISK_OPEN + E49).

begin;

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
  select l.project_id into v_project from loads l where l.id = new.load_id;
  /* C5 / Cz14: kod wysyłki w tytule — nie hhl_order_no / order_no / UUID. */
  v_code := nullif(nullif(btrim(public.load_sms_code(new.load_id)), ''), '—');
  v_preview := left(regexp_replace(coalesce(new.body, ''), '\s+', ' ', 'g'), 120);
  v_who := coalesce(nullif(trim(new.author_display), ''), nullif(trim(new.author_org), ''), 'osoba');
  v_firm := coalesce(nullif(trim(new.author_org), ''), 'firma');
  v_title := case
    when v_code is not null then v_code || ' — ' || v_who || ' // ' || v_firm
    else v_who || ' // ' || v_firm
  end;
  v_body := left(regexp_replace(coalesce(new.body, ''), '\s+', ' ', 'g'), 500);
  perform public.matrix_notify(
    'LOAD_STATUS',
    'LOAD_CHAT_MESSAGE',
    new.load_id,
    v_project,
    jsonb_build_object(
      'code', v_code,
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

revoke all on function public.notify_load_chat_message() from public, anon, authenticated;
comment on function public.notify_load_chat_message() is
  'C3-p + C5 0437: title/body na telefon; code = load_sms_code; visible_to.';


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
  v_code text;
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
    -- DP-156 F7: ROAD_LT/LV/EE/FI HIGH/CRITICAL bez transportu → risk_crit
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

  /* C5: kod wysyłki — nigdy order_no / hhl_order_no (KSH nigdy numeru zlecenia). */
  if p_load_id is not null then
    v_code := nullif(nullif(btrim(public.load_sms_code(p_load_id)), ''), '—');
  end if;
  if nullif(v_payload->>'url', '') is null then
    v_url := public.notify_click_url(
      p_template,
      v_payload || jsonb_build_object('code', coalesce(nullif(v_payload->>'code', ''), v_code)),
      p_load_id
    );
    if v_url is distinct from '/' then
      v_payload := v_payload || jsonb_build_object('url', v_url);
    end if;
  end if;
  if nullif(v_payload->>'code', '') is null and v_code is not null then
    v_payload := v_payload || jsonb_build_object('code', v_code);
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
      v_code,  /* C5: skrót e-mail = shipment; transport_label przy wysyłce */
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
  '#411 + DP-156 + C5 0437: payload.code = load_sms_code; bez order_no.';

commit;
