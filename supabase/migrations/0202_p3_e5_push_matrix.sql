-- TOWER — Migracja 0202: P3 E5-2 — kolumna „Telefon” (push) w macierzy; domyślnie tylko krytyczne.
-- Krytyczne grupy startowe: RISK_FERRY_WEATHER, DECISION. Reszta push=false.
-- matrix_notify: WEB_PUSH wymaga m.push (nie m.in_app).

alter table public.notification_matrix
  add column if not exists push boolean not null default false;

update public.notification_matrix
   set push = true
 where event_group in ('RISK_FERRY_WEATHER', 'DECISION')
   and role in ('HHL_ADMIN', 'HHL_OPS', 'CARRIER_DISPATCH', 'CARRIER_USER', 'CLIENT_USER');

update public.notification_matrix
   set push = false
 where event_group = 'SYSTEM' and role not in ('HHL_ADMIN', 'HHL_OPS');

update public.notification_matrix
   set push = false
 where event_group in ('LOAD_STATUS', 'MONEY', 'SYSTEM');

drop function if exists public.admin_notification_matrix_set(text, text, boolean, boolean);
drop function if exists public.admin_notification_matrix_set(text, text, boolean, boolean, boolean);

create function public.admin_notification_matrix_set(
  p_event_group text,
  p_role text,
  p_in_app boolean,
  p_email boolean,
  p_push boolean default false
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid;
  v_role text;
begin
  select id, role::text into v_me, v_role from app_users where auth_id = auth.uid() and active;
  if (v_me is not null and v_role = 'HHL_ADMIN') is not true then
    raise exception 'Macierz powiadomień — wyłącznie administrator HHL' using errcode = '42501';
  end if;
  if (p_role in ('HHL_ADMIN','HHL_OPS','CLIENT_USER','CARRIER_DISPATCH','CARRIER_USER')) is not true then
    raise exception 'Nieznana rola macierzy' using errcode = '22023';
  end if;
  if (p_event_group in ('LOAD_STATUS','RISK_FERRY_WEATHER','DECISION','MONEY','SYSTEM')) is not true then
    raise exception 'Nieznana grupa zdarzeń' using errcode = '22023';
  end if;
  if p_event_group = 'SYSTEM' and p_role not in ('HHL_ADMIN','HHL_OPS') then
    raise exception 'Zdarzenia systemowe — tylko HHL' using errcode = '22023';
  end if;

  insert into notification_matrix (event_group, role, in_app, email, push)
  values (
    p_event_group,
    p_role::user_role,
    coalesce(p_in_app, false),
    coalesce(p_email, false),
    coalesce(p_push, false)
  )
  on conflict (event_group, role) do update
    set in_app = excluded.in_app,
        email = excluded.email,
        push = excluded.push;

  insert into audit_log (user_id, action, entity, entity_id, new_value)
  values (
    v_me,
    'NOTIFICATION_MATRIX_SET',
    'notification_matrix',
    p_event_group || ':' || p_role,
    jsonb_build_object('in_app', p_in_app, 'email', p_email, 'push', p_push)
  );
end $$;

revoke all on function public.admin_notification_matrix_set(text, text, boolean, boolean, boolean) from public, anon;
grant execute on function public.admin_notification_matrix_set(text, text, boolean, boolean, boolean) to authenticated;

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

  insert into notifications (channel, recipient, user_id, load_id, template, payload, dedup_key)
  select 'IN_APP', coalesce(u.email::text, u.id::text), u.id, p_load_id, p_template,
         coalesce(p_payload, '{}'::jsonb) || jsonb_build_object('locale', u.locale, 'event_group', p_event_group),
         left(p_dedup_prefix || ':IN:' || u.id::text, 200)
    from app_users u
    join organizations o on o.id = u.org_id
    left join notification_matrix m
      on m.event_group = p_event_group and m.role = u.role
   where u.active
     and u.role in ('HHL_ADMIN','HHL_OPS','CLIENT_USER','CARRIER_DISPATCH','CARRIER_USER')
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
      on m.event_group = p_event_group and m.role = u.role and m.email
   where u.active and u.email is not null
     and u.role in ('HHL_ADMIN','HHL_OPS','CLIENT_USER','CARRIER_DISPATCH','CARRIER_USER')
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
      on m.event_group = p_event_group and m.role = u.role and m.push is true
    left join user_preferences pref on pref.user_id = u.id
   where u.active
     and u.role in ('HHL_ADMIN','HHL_OPS','CLIENT_USER','CARRIER_DISPATCH','CARRIER_USER')
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
  'E11/E5-2: macierz po roli; WEB_PUSH wg kolumny push; G-18 PLAN_DATES_CHANGED IN_APP zawsze dla 4 ról.';

comment on column public.notification_matrix.push is
  'E5-2: kanał telefon (web push); start tylko RISK_FERRY_WEATHER i DECISION.';
