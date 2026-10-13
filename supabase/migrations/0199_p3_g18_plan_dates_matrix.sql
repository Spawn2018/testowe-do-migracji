-- TOWER — Migracja 0199: P3 G-18 — PLAN_DATES_CHANGED: dzwonek (IN_APP) zawsze
-- dla HHL_ADMIN, HHL_OPS, CARRIER_DISPATCH, CARRIER_USER; e-mail/push wg macierzy.
-- Idempotentna. Bez zmian wyglądu.

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

  -- G-18: IN_APP dla zmiany dat — zawsze (bez wyłączenia w macierzy) dla 4 ról
  insert into notifications (channel, recipient, user_id, load_id, template, payload, dedup_key)
  select 'IN_APP', coalesce(u.email::text, u.id::text), u.id, p_load_id, p_template,
         coalesce(p_payload, '{}'::jsonb) || jsonb_build_object('locale', u.locale, 'event_group', p_event_group),
         left(p_dedup_prefix || ':IN:' || u.id::text, 200)
    from app_users u
    join organizations o on o.id = u.org_id
    left join notification_matrix m
      on m.event_group = p_event_group and m.org_kind = o.kind::text
   where u.active
     and (p_only_org_kind is null or o.kind::text = p_only_org_kind)
     and (
       (v_plan_dates and u.role in ('HHL_ADMIN','HHL_OPS','CARRIER_DISPATCH','CARRIER_USER'))
       or (v_plan_dates is not true and m.in_app is true)
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
  get diagnostics n = row_count;

  insert into notifications (channel, recipient, user_id, load_id, template, payload, dedup_key)
  select 'EMAIL', coalesce(u.email::text, u.id::text), u.id, p_load_id, p_template,
         coalesce(p_payload, '{}'::jsonb) || jsonb_build_object('locale', u.locale, 'event_group', p_event_group),
         left(p_dedup_prefix || ':EM:' || u.id::text, 200)
    from app_users u
    join organizations o on o.id = u.org_id
    join notification_matrix m
      on m.event_group = p_event_group and m.org_kind = o.kind::text and m.email
   where u.active and u.email is not null
     and (p_only_org_kind is null or o.kind::text = p_only_org_kind)
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

  -- Q-11b A: Web Push — ta sama widoczność co IN_APP (DEC-4); PLAN_DATES wg macierzy (nie zawsze)
  v_critical := (
    coalesce(p_payload->>'severity', '') = 'CRITICAL'
    or p_template ilike '%CRITICAL%'
    or p_template in ('FERRY_CANCELLED', 'SCHEDULE_DATE_CRITICAL')
  );
  insert into notifications (channel, recipient, user_id, load_id, template, payload, dedup_key, status)
  select 'WEB_PUSH', coalesce(u.email::text, u.id::text), u.id, p_load_id, p_template,
         coalesce(p_payload, '{}'::jsonb) || jsonb_build_object('locale', u.locale, 'event_group', p_event_group, 'critical', v_critical),
         left(p_dedup_prefix || ':WP:' || u.id::text, 200),
         case when v_critical then 'PENDING' else 'DIGEST' end
    from app_users u
    join organizations o on o.id = u.org_id
    join notification_matrix m
      on m.event_group = p_event_group and m.org_kind = o.kind::text and m.in_app
    left join user_preferences pref on pref.user_id = u.id
   where u.active
     and coalesce(pref.web_push_enabled, true) is true
     and exists (select 1 from push_subscriptions ps where ps.user_id = u.id)
     and (p_only_org_kind is null or o.kind::text = p_only_org_kind)
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

  return n;
end $$;

comment on function public.matrix_notify(text, text, uuid, uuid, jsonb, text, text) is
  'DEC-4 + Q-11b + G-18: IN_APP/EMAIL + WEB_PUSH; PLAN_DATES_CHANGED IN_APP zawsze dla 4 ról.';
