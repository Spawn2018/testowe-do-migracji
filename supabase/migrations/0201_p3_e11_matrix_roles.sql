-- TOWER — Migracja 0201: P3 E11 — macierz powiadomień: zdarzenie × 5 ról × kanał.
-- Stara tabela po org_kind → notification_matrix_org_kind (archiwum). Idempotentna.

-- 1) Nowa tabela --------------------------------------------------------------
create table if not exists public.notification_matrix_by_role (
  event_group text not null,
  role        user_role not null,
  in_app      boolean not null default true,
  email       boolean not null default false,
  primary key (event_group, role),
  check (event_group in ('LOAD_STATUS','RISK_FERRY_WEATHER','DECISION','MONEY','SYSTEM')),
  check (role in ('HHL_ADMIN','HHL_OPS','CLIENT_USER','CARRIER_DISPATCH','CARRIER_USER'))
);

alter table public.notification_matrix_by_role enable row level security;
revoke all on public.notification_matrix_by_role from anon;
revoke insert, update, delete, truncate on public.notification_matrix_by_role from authenticated;
grant select on public.notification_matrix_by_role to authenticated;

drop policy if exists notification_matrix_by_role_read on public.notification_matrix_by_role;
create policy notification_matrix_by_role_read on public.notification_matrix_by_role
  for select to authenticated
  using (current_app_user_id() is not null and is_hhl());

-- 2) Seed z dotychczasowej macierzy org_kind ----------------------------------
insert into public.notification_matrix_by_role (event_group, role, in_app, email)
select m.event_group, x.role::user_role, m.in_app, false
  from public.notification_matrix m
  join (values
    ('FORWARDER', 'HHL_ADMIN'),
    ('FORWARDER', 'HHL_OPS'),
    ('CARRIER', 'CARRIER_DISPATCH'),
    ('CARRIER', 'CARRIER_USER'),
    ('CLIENT', 'CLIENT_USER')
  ) as x(kind, role) on x.kind = m.org_kind
on conflict (event_group, role) do nothing;

insert into public.notification_matrix_by_role (event_group, role, in_app, email)
select g.g, r.r::user_role,
       case when g.g = 'SYSTEM' then (r.r in ('HHL_ADMIN','HHL_OPS'))
            when g.g = 'DECISION' and r.r = 'CLIENT_USER' then false
            else true end,
       false
  from (values ('LOAD_STATUS'),('RISK_FERRY_WEATHER'),('DECISION'),('MONEY'),('SYSTEM')) as g(g)
  cross join (values
    ('HHL_ADMIN'),('HHL_OPS'),('CARRIER_DISPATCH'),('CARRIER_USER'),('CLIENT_USER')
  ) as r(r)
on conflict (event_group, role) do nothing;

update public.notification_matrix_by_role
   set in_app = false, email = false
 where event_group = 'SYSTEM' and role not in ('HHL_ADMIN','HHL_OPS');

-- 3) Podmiana tabel -----------------------------------------------------------
do $$
begin
  if to_regclass('public.notification_matrix') is not null
     and to_regclass('public.notification_matrix_org_kind') is null then
    alter table public.notification_matrix rename to notification_matrix_org_kind;
  end if;
end $$;

alter table if exists public.notification_matrix_by_role rename to notification_matrix;

revoke all on table public.notification_matrix_org_kind from anon, authenticated;
comment on table public.notification_matrix_org_kind is
  'P3 E11: archiwum macierzy po org_kind; obowiązuje notification_matrix (rola).';

drop policy if exists notification_matrix_read on public.notification_matrix;
create policy notification_matrix_read on public.notification_matrix
  for select to authenticated
  using (current_app_user_id() is not null and is_hhl());

-- 4) RPC zapisu (p_role zamiast p_org_kind) — DROP: Postgres nie zmienia nazwy argumentu ---
drop function if exists public.admin_notification_matrix_set(text, text, boolean, boolean);

create function public.admin_notification_matrix_set(
  p_event_group text,
  p_role text,
  p_in_app boolean,
  p_email boolean
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

  insert into notification_matrix (event_group, role, in_app, email)
  values (p_event_group, p_role::user_role, coalesce(p_in_app, false), coalesce(p_email, false))
  on conflict (event_group, role) do update
    set in_app = excluded.in_app, email = excluded.email;

  insert into audit_log (user_id, action, entity, entity_id, new_value)
  values (v_me, 'NOTIFICATION_MATRIX_SET', 'notification_matrix', p_event_group || ':' || p_role,
          jsonb_build_object('in_app', p_in_app, 'email', p_email));
end $$;

revoke all on function public.admin_notification_matrix_set(text, text, boolean, boolean) from public, anon;
grant execute on function public.admin_notification_matrix_set(text, text, boolean, boolean) to authenticated;

-- 5) matrix_notify — join po u.role (G-18 bez zmian) --------------------------
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
      on m.event_group = p_event_group and m.role = u.role and m.in_app
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
  'E11: macierz po roli; G-18 PLAN_DATES_CHANGED IN_APP zawsze dla 4 ról.';

-- 6) Pozostałe funkcje z join po org_kind → po roli ----------------------------
-- Tylko prokind=f: pg_get_functiondef na agregatach (array_agg) rzuca błąd.
do $$
declare
  r record;
  src text;
  nxt text;
begin
  for r in
    select p.oid
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.prokind = 'f'
       and pg_get_functiondef(p.oid) like '%notification_matrix%'
       and pg_get_functiondef(p.oid) like '%org_kind%'
  loop
    src := pg_get_functiondef(r.oid);
    nxt := replace(src, 'm.org_kind = o.kind::text', 'm.role = u.role');
    nxt := replace(nxt, 'm.org_kind = o.kind', 'm.role = u.role');
    if nxt is distinct from src then
      execute nxt;
    end if;
  end loop;
end $$;
