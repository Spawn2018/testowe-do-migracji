-- 0095 — SCOPE 9.1 (poprawka do 0094): akcja „risk” reguły automatyzacji przekazuje jawny klucz tytułu rk_workflow
-- z parametrami (reguła, transport), zamiast bezpiecznika rk_generic — tytuł sygnału w języku odbiorcy (A6, test rk-generic).
-- Idempotentna: create or replace tej samej funkcji; bez zmian danych.

-- jedna akcja; zwraca opis wyniku
create or replace function wf_action(p_wf workflows, p_run workflow_runs, p_act jsonb, p_ctx jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_n int; v_client uuid; v_carrier uuid; v_code text := coalesce(p_ctx #>> '{load,code}', '');
begin
  if p_act ->> 'type' = 'notify' then
    select p.client_org_id, l.carrier_org_id into v_client, v_carrier
      from loads l join projects p on p.id = l.project_id where l.id = p_run.load_id;
    insert into notifications (channel, recipient, user_id, load_id, template, payload, dedup_key)
    select 'IN_APP', coalesce(u.email::text, u.id::text), u.id, p_run.load_id, 'WORKFLOW_ALERT',
           jsonb_build_object('code', v_code, 'rule', p_wf.name, 'rule_code', p_wf.code,
                              'event', p_ctx ->> 'event_type', 'text', p_act ->> 'text', 'locale', u.locale),
           'WF:' || p_run.id || ':' || u.id
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
    perform raise_risk(p_run.load_id, (p_act ->> 'kind')::risk_kind, (p_act ->> 'severity')::risk_severity,
                       coalesce(nullif(p_act ->> 'title', ''), p_wf.name) || ' · ' || v_code,
                       jsonb_build_object('rule', p_wf.name, 'rule_code', p_wf.code, 'event', p_ctx ->> 'event_type',
                                          'title_key', 'rk_workflow',
                                          'params', jsonb_build_object('rule', p_wf.name, 'code', v_code,
                                                                       'title', coalesce(nullif(p_act ->> 'title', ''), p_wf.name))),
                       'WF:' || p_wf.id || ':' || p_run.load_id);
    return jsonb_build_object('type', 'risk', 'kind', p_act ->> 'kind');
  elsif p_act ->> 'type' in ('email', 'sms') then
    if external_messaging_enabled() is not true then
      return jsonb_build_object('type', p_act ->> 'type', 'status', 'ZABLOKOWANE_R2');
    end if;
    return jsonb_build_object('type', p_act ->> 'type', 'status', 'BRAK_OBSLUGI');   -- kanały zewnętrzne: osobna pozycja po R-2
  end if;
  raise exception 'wf_action: nieznana akcja %', p_act ->> 'type';
end $$;
revoke all on function wf_action(workflows, workflow_runs, jsonb, jsonb) from public, anon, authenticated;

do $g$
begin
  if (select prosecdef and pg_get_functiondef(oid) like '%rk_workflow%' from pg_proc where proname = 'wf_action') is not true then
    raise exception '0095: wf_action bez klucza rk_workflow albo bez SECURITY DEFINER';
  end if;
end $g$;
