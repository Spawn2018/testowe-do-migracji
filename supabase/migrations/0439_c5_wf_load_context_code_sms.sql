-- C5 (D-20261015-0300-01): wf_load_context + wf_action
-- kod transportu = load_sms_code; bez fallbacku order_no / UUID. Po 0438.

begin;

-- ---------------------------------------------------------------------------
-- 1. wf_load_context — code = load_sms_code (nigdy order_no)
-- ---------------------------------------------------------------------------
create or replace function public.wf_load_context(p_load uuid) returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', l.id,
    /* C5: kod wysyłki — nigdy order_no / UUID (KSH nigdy numeru zlecenia). */
    'code', nullif(nullif(btrim(public.load_sms_code(l.id)), ''), '—'),
    'status', l.status,
    'plan_load_date', l.plan_load_date, 'plan_delivery_date', l.plan_delivery_date,
    'plan_dates_status', l.plan_dates_status, 'has_carrier', l.carrier_org_id is not null,
    'hours_to_load', case when l.plan_load_date is null then null else
      round(extract(epoch from ((l.plan_load_date::timestamp at time zone 'Europe/Warsaw') - now())) / 3600) end,
    'hours_to_delivery', case when l.plan_delivery_date is null then null else
      round(extract(epoch from ((l.plan_delivery_date::timestamp at time zone 'Europe/Warsaw') - now())) / 3600) end)
    from loads l where l.id = p_load
$$;
revoke all on function public.wf_load_context(uuid) from public, anon, authenticated;
comment on function public.wf_load_context(uuid) is
  'C5 0439: load.code = load_sms_code; bez order_no / UUID.';

-- ---------------------------------------------------------------------------
-- 2. wf_action — payload.code / skrót e-mail = load_sms_code (wszystkie audience)
-- ---------------------------------------------------------------------------
create or replace function public.wf_action(
  p_wf workflows, p_run workflow_runs, p_act jsonb, p_ctx jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n int;
  v_client uuid;
  v_carrier uuid;
  v_project uuid;
  /* C5: zawsze kod wysyłki — nie order_no z kontekstu. */
  v_sms text := nullif(public.load_sms_code(p_run.load_id), '—');
  v_head text := v_sms;
  v_show text;
  v_ev text := wf_event_key(p_run);
  v_aud text;
  v_id uuid;
  v_st text;
  v_crit boolean;
  r record;
  v_stats jsonb := '{}'::jsonb;
begin
  select l.project_id, p.client_org_id, l.carrier_org_id
    into v_project, v_client, v_carrier
    from loads l
    join projects p on p.id = l.project_id
   where l.id = p_run.load_id;
  if p_act ->> 'type' = 'notify' then
    insert into notifications (channel, recipient, user_id, load_id, template, payload, dedup_key)
    select 'IN_APP', coalesce(u.email::text, u.id::text), u.id, p_run.load_id, 'WORKFLOW_ALERT',
           jsonb_build_object(
             'code', v_sms,
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
    if exists (
      select 1 from risk_signals s
       where s.load_id = p_run.load_id
         and s.kind::text = p_act ->> 'kind'
         and s.resolved_at is null
    ) then
      return jsonb_build_object('type', 'risk', 'kind', p_act ->> 'kind', 'status', 'JUZ_OTWARTE');
    end if;
    perform raise_risk(
      p_run.load_id, (p_act ->> 'kind')::risk_kind, (p_act ->> 'severity')::risk_severity,
      public.l3_headed(v_head, coalesce(nullif(p_act ->> 'title', ''), p_wf.name)),
      jsonb_build_object(
        'rule', p_wf.name, 'rule_code', p_wf.code, 'event', p_ctx ->> 'event_type',
        'title_key', 'rk_workflow',
        'params', jsonb_build_object(
          'rule', p_wf.name, 'code', v_head,
          'title', coalesce(nullif(p_act ->> 'title', ''), p_wf.name))),
      'WF:' || p_wf.id || ':' || p_run.load_id);
    return jsonb_build_object('type', 'risk', 'kind', p_act ->> 'kind');
  elsif p_act ->> 'type' = 'decision' then
    if p_run.load_id is null then raise exception 'wf_action decision: brak transportu'; end if;
    if exists (
      select 1 from decisions d
       where d.load_id = p_run.load_id
         and d.type_code = p_act ->> 'decision_type'
         and d.status in ('NEW', 'ASSIGNED', 'SNOOZED')
    ) then
      return jsonb_build_object(
        'type', 'decision', 'decision_type', p_act ->> 'decision_type', 'status', 'JUZ_OTWARTA');
    end if;
    v_id := decision_open_from_event(
      v_project, p_act ->> 'decision_type',
      left('WF:' || v_ev || ':' || (p_act ->> 'decision_type'), 200),
      public.l3_headed(v_head, coalesce(nullif(p_act ->> 'title', ''), p_wf.name)),
      jsonb_build_object('rule', p_wf.name, 'rule_id', p_wf.id, 'event', p_ctx ->> 'event_type'),
      p_run.load_id, null);
    return jsonb_build_object(
      'type', 'decision', 'decision_type', p_act ->> 'decision_type', 'decision_id', v_id);
  elsif p_act ->> 'type' = 'email' then
    v_aud := coalesce(p_act ->> 'audience', 'HHL');
    v_crit := coalesce((p_act ->> 'critical')::boolean, false);
    /* C5: skrót e-mail = load_sms_code także dla HHL/KSH. */
    v_show := v_sms;
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
      v_st := l13_queue_email(
        case when v_crit then 'critical' else 'digest' end, 'WORKFLOW_ALERT', r.id, r.email,
        p_run.load_id, v_show,
        jsonb_build_object(
          'code', v_show, 'rule', p_wf.name, 'rule_code', p_wf.code,
          'event', p_ctx ->> 'event_type', 'text', p_act ->> 'text', 'locale', r.locale),
        left('WFE:' || v_ev || ':' || r.id, 200),
        case when v_crit then left('WF:' || v_ev, 120) end);
      v_stats := jsonb_set(
        v_stats, array[coalesce(v_st, 'skip')],
        to_jsonb(coalesce((v_stats ->> coalesce(v_st, 'skip'))::int, 0) + 1));
    end loop;
    return jsonb_build_object('type', 'email', 'audience', v_aud, 'queued', v_stats);
  elsif p_act ->> 'type' = 'sms' then
    if p_run.load_id is null then raise exception 'wf_action sms: brak transportu'; end if;
    v_n := sms_zone_enqueue_for_event(
      p_run.load_id, p_act ->> 'list', coalesce(p_act ->> 'kind', 'ZONE_ENTER'),
      case when p_act ->> 'list' = 'LOAD_SREM' then 'zaladunek Srem' else 'plac Stegra Boden' end,
      null);
    return jsonb_build_object(
      'type', 'sms', 'list', p_act ->> 'list',
      'kind', coalesce(p_act ->> 'kind', 'ZONE_ENTER'), 'queued', v_n);
  end if;
  raise exception 'wf_action: nieznana akcja %', p_act ->> 'type';
end;
$$;
revoke all on function public.wf_action(workflows, workflow_runs, jsonb, jsonb)
  from public, anon, authenticated;
comment on function public.wf_action(workflows, workflow_runs, jsonb, jsonb) is
  'C5 0439: payload.code / e-mail = load_sms_code; bez order_no dla HHL/KSH.';

commit;
