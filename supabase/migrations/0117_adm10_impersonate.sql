-- 0117 — ADM-10 / D-52: „Działaj jako” (impersonacja HHL_ADMIN → inne konto).
-- Idempotentna. Egzekwowanie: current_app_* zwracają konto docelowe;
-- real_app_* / start/stop sprawdzają prawdziwego administratora (auth.uid).
-- Dziennik: audit_log.acting_as_user_id + wyzwalacz BEFORE INSERT.

-- 1) Stan impersonacji (jedno aktywne konto docelowe na administratora)
create table if not exists public.impersonation_state (
  admin_user_id  uuid primary key references public.app_users(id) on delete cascade,
  target_user_id uuid not null references public.app_users(id) on delete cascade,
  started_at     timestamptz not null default now(),
  constraint impersonation_not_self check (admin_user_id <> target_user_id)
);
alter table public.impersonation_state enable row level security;
revoke all on table public.impersonation_state from public, anon, authenticated;

-- 2) audit_log: kto faktycznie + jako kto
alter table public.audit_log
  add column if not exists acting_as_user_id uuid references public.app_users(id);

create or replace function public.audit_log_impersonation_bi()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid;
  v_target uuid;
begin
  select i.admin_user_id, i.target_user_id
    into v_admin, v_target
    from impersonation_state i
    join app_users a on a.id = i.admin_user_id
   where a.auth_id = auth.uid()
     and a.active is true
     and a.role = 'HHL_ADMIN'
   limit 1;
  if v_admin is not null and v_target is not null then
    -- user_id = administrator (faktyczny wykonawca); acting_as = konto docelowe
    if new.user_id is null or new.user_id = v_target then
      new.user_id := v_admin;
    end if;
    new.acting_as_user_id := coalesce(new.acting_as_user_id, v_target);
  end if;
  return new;
end $$;

drop trigger if exists audit_log_impersonation_bi on public.audit_log;
create trigger audit_log_impersonation_bi
  before insert on public.audit_log
  for each row execute function public.audit_log_impersonation_bi();

revoke all on function public.audit_log_impersonation_bi() from public, anon, authenticated;

-- 3) Prawdziwa tożsamość (bez impersonacji) — do start/stop i MFA
create or replace function public.real_app_user_id() returns uuid
language sql stable security definer set search_path = public, extensions as $$
  select id from app_users
   where auth_id = auth.uid() and active and mfa_satisfied(role)
$$;

create or replace function public.real_app_role() returns user_role
language sql stable security definer set search_path = public, extensions as $$
  select role from app_users
   where auth_id = auth.uid() and active and mfa_satisfied(role)
$$;

revoke all on function public.real_app_user_id() from public, anon;
revoke all on function public.real_app_role() from public, anon;
grant execute on function public.real_app_user_id() to authenticated;
grant execute on function public.real_app_role() to authenticated;

-- 4) current_* — konto docelowe gdy aktywna impersonacja
create or replace function public.current_app_user_id() returns uuid
language sql stable security definer set search_path = public, extensions as $$
  select coalesce(
    (select i.target_user_id
       from impersonation_state i
       join app_users a on a.id = i.admin_user_id
       join app_users t on t.id = i.target_user_id
      where a.auth_id = auth.uid()
        and a.active and a.role = 'HHL_ADMIN' and mfa_satisfied(a.role)
        and t.active),
    (select id from app_users where auth_id = auth.uid() and active and mfa_satisfied(role))
  )
$$;

create or replace function public.current_app_role() returns user_role
language sql stable security definer set search_path = public, extensions as $$
  select coalesce(
    (select t.role
       from impersonation_state i
       join app_users a on a.id = i.admin_user_id
       join app_users t on t.id = i.target_user_id
      where a.auth_id = auth.uid()
        and a.active and a.role = 'HHL_ADMIN' and mfa_satisfied(a.role)
        and t.active),
    (select role from app_users where auth_id = auth.uid() and active and mfa_satisfied(role))
  )
$$;

create or replace function public.current_org_id() returns uuid
language sql stable security definer set search_path = public, extensions as $$
  select coalesce(
    (select t.org_id
       from impersonation_state i
       join app_users a on a.id = i.admin_user_id
       join app_users t on t.id = i.target_user_id
      where a.auth_id = auth.uid()
        and a.active and a.role = 'HHL_ADMIN' and mfa_satisfied(a.role)
        and t.active),
    (select org_id from app_users where auth_id = auth.uid() and active and mfa_satisfied(role))
  )
$$;

create or replace function public.current_org_kind() returns org_kind
language sql stable security definer set search_path = public, extensions as $$
  select coalesce(
    (select o.kind
       from impersonation_state i
       join app_users a on a.id = i.admin_user_id
       join app_users t on t.id = i.target_user_id
       join organizations o on o.id = t.org_id
      where a.auth_id = auth.uid()
        and a.active and a.role = 'HHL_ADMIN' and mfa_satisfied(a.role)
        and t.active),
    (select o.kind from app_users u join organizations o on o.id = u.org_id
      where u.auth_id = auth.uid() and u.active and mfa_satisfied(u.role))
  )
$$;

-- 5) Start / stop / status
create or replace function public.admin_impersonate_start(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid;
  v_admin_role user_role;
  v_target app_users%rowtype;
begin
  select id, role into v_admin, v_admin_role
    from app_users
   where auth_id = auth.uid() and active is true;
  if (v_admin is not null and v_admin_role = 'HHL_ADMIN' and mfa_satisfied(v_admin_role)) is not true then
    raise exception 'Tylko administrator HHL (z 2FA gdy wymagane)' using errcode = '42501';
  end if;
  if (p_user is not null) is not true then
    raise exception 'Brak konta docelowego' using errcode = '22023';
  end if;
  if p_user = v_admin then
    raise exception 'Nie można działać jako własne konto' using errcode = '22023';
  end if;
  select * into v_target from app_users where id = p_user;
  if (found and v_target.active is true) is not true then
    raise exception 'Konto nieaktywne lub nie istnieje' using errcode = '22023';
  end if;
  insert into impersonation_state (admin_user_id, target_user_id, started_at)
  values (v_admin, p_user, now())
  on conflict (admin_user_id) do update
    set target_user_id = excluded.target_user_id,
        started_at = excluded.started_at;
  insert into audit_log (user_id, action, entity, entity_id, new_value, acting_as_user_id)
  values (v_admin, 'IMPERSONATE_START', 'app_users', p_user::text,
          jsonb_build_object('target_email', v_target.email, 'target_role', v_target.role),
          p_user);
end $$;

create or replace function public.admin_impersonate_stop()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid;
  v_admin_role user_role;
  v_target uuid;
begin
  select id, role into v_admin, v_admin_role
    from app_users
   where auth_id = auth.uid() and active is true;
  if (v_admin is not null and v_admin_role = 'HHL_ADMIN') is not true then
    raise exception 'Tylko administrator HHL' using errcode = '42501';
  end if;
  select target_user_id into v_target from impersonation_state where admin_user_id = v_admin;
  delete from impersonation_state where admin_user_id = v_admin;
  if v_target is not null then
    insert into audit_log (user_id, action, entity, entity_id, old_value)
    values (v_admin, 'IMPERSONATE_STOP', 'app_users', v_target::text,
            jsonb_build_object('target_user_id', v_target));
  end if;
end $$;

revoke all on function public.admin_impersonate_start(uuid) from public, anon;
revoke all on function public.admin_impersonate_stop() from public, anon;
grant execute on function public.admin_impersonate_start(uuid) to authenticated;
grant execute on function public.admin_impersonate_stop() to authenticated;

-- 6) my_profile — pola efektywne (docelowe przy impersonacji) + real_* / acting_as
drop function if exists public.my_profile();
create function public.my_profile()
returns table (
  user_id uuid,
  email text,
  full_name text,
  role user_role,
  org_code text,
  org_name text,
  locale text,
  active boolean,
  must_set_password boolean,
  real_user_id uuid,
  real_email text,
  real_role user_role,
  acting_as boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select u.* from app_users u where u.auth_id = auth.uid()
  ),
  tgt as (
    select t.*
      from me
      join impersonation_state i on i.admin_user_id = me.id
      join app_users t on t.id = i.target_user_id and t.active is true
     where me.role = 'HHL_ADMIN' and me.active is true
  ),
  eff as (
    select * from tgt
    union all
    select me.* from me where not exists (select 1 from tgt)
  )
  select
    e.id,
    e.email::text,
    e.full_name,
    e.role,
    o.code,
    o.name,
    e.locale::text,
    e.active,
    coalesce(m.must_set_password, false),
    m.id,
    m.email::text,
    m.role,
    exists (select 1 from tgt)
  from eff e
  join organizations o on o.id = e.org_id
  cross join me m
$$;

revoke all on function public.my_profile() from public, anon;
grant execute on function public.my_profile() to authenticated;
