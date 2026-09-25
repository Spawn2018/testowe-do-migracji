-- 0006_auth.sql (w BK2: 0005_auth.sql; przenumerowano w AN1) — BK2 Uwierzytelnianie (ZLECENIE_FINAL §7 Etap 3).
-- Logowanie linkiem e-mail (Supabase magic link). Konta WYŁĄCZNIE na zaproszenie:
-- HHL_ADMIN zaprasza (email + organizacja + rola z 0001), a przy pierwszym
-- logowaniu wyzwalacz na auth.users tworzy wiersz app_users. Adres bez
-- zaproszenia nie może założyć konta (wyzwalacz odrzuca INSERT).
-- Zmiany ról / aktywności tylko przez funkcje HHL_ADMIN — brak polityk zapisu
-- na app_users i user_invites; wszystko w audit_log.

-- 1. Zaproszenia -------------------------------------------------------
create table if not exists user_invites (
  id           uuid primary key default gen_random_uuid(),
  email        citext unique not null,
  org_id       uuid not null references organizations(id),
  role         user_role not null,
  full_name    text,
  locale       char(2) not null default 'pl',
  invited_by   uuid references app_users(id),
  created_at   timestamptz not null default now(),
  accepted_at  timestamptz
);
alter table user_invites enable row level security;
drop policy if exists invites_admin_read on user_invites;
create policy invites_admin_read on user_invites for select to authenticated
  using (current_app_role() = 'HHL_ADMIN');
revoke insert, update, delete, truncate on user_invites from anon, authenticated;
revoke all on user_invites from anon;

-- app_users: brak bezpośrednich zapisów z API (tylko funkcje niżej).
revoke insert, update, delete, truncate on app_users from anon, authenticated;

-- 2. Zgodność roli z rodzajem organizacji (role z 0001) -------------------
create or replace function role_matches_org(p_role user_role, p_kind org_kind)
returns boolean language sql immutable as $$
  select case
    when p_role in ('HHL_ADMIN','HHL_OPS')               then p_kind = 'FORWARDER'
    when p_role in ('CLIENT_ADMIN','CLIENT_USER')         then p_kind = 'CLIENT'
    when p_role in ('CARRIER_DISPATCH','CARRIER_USER')    then p_kind = 'CARRIER'
    when p_role = 'SITE_VIEWER'                           then p_kind = 'SITE'
    else false end
$$;

-- 3. Wyzwalacz: nowe konto auth → app_users z zaproszenia ----------------
create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare inv public.user_invites%rowtype;
begin
  select * into inv from public.user_invites
   where email = lower(new.email)::citext and accepted_at is null
   for update;
  if not found then
    raise exception 'TOWER_NO_INVITE: konto tylko na zaproszenie administratora HHL'
      using errcode = '42501';
  end if;
  insert into public.app_users (auth_id, org_id, email, full_name, role, locale)
  values (new.id, inv.org_id, lower(new.email), inv.full_name, inv.role, inv.locale);
  update public.user_invites set accepted_at = now() where id = inv.id;
  insert into public.audit_log (user_id, action, entity, entity_id, new_value)
  values (inv.invited_by, 'USER_ACCEPTED_INVITE', 'app_users', new.id::text,
          jsonb_build_object('org_id', inv.org_id, 'role', inv.role));
  return new;
end $$;

-- Warunkowo: na Supabase auth.users istnieje zawsze; w lokalnym teście
-- (tests/db/supabase_stub.sql z pakietu) tabeli nie ma — wtedy pomijamy.
do $trg$
begin
  if to_regclass('auth.users') is not null then
    drop trigger if exists tower_on_auth_user_created on auth.users;
    create trigger tower_on_auth_user_created
      after insert on auth.users
      for each row execute function public.handle_new_auth_user();
  else
    raise notice 'auth.users brak (środowisko testowe) — wyzwalacz pominięty';
  end if;
end $trg$;

-- 4. Funkcje administratora HHL -----------------------------------------
create or replace function admin_invite_user(
  p_email text, p_org_code text, p_role user_role,
  p_full_name text default null, p_locale text default 'pl')
returns uuid language plpgsql security definer set search_path = public as $$
declare v_org organizations%rowtype; v_id uuid; v_me uuid;
begin
  if current_app_role() is distinct from 'HHL_ADMIN' then
    raise exception 'Zapraszać może wyłącznie administrator HHL' using errcode = '42501';
  end if;
  if p_email is null or p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Nieprawidłowy adres e-mail';
  end if;
  select * into v_org from organizations where code = upper(p_org_code);
  if not found then raise exception 'Nieznana organizacja: %', p_org_code; end if;
  if not role_matches_org(p_role, v_org.kind) then
    raise exception 'Rola % nie pasuje do organizacji %', p_role, v_org.code;
  end if;
  if exists (select 1 from app_users where email = lower(p_email)::citext) then
    raise exception 'Użytkownik już istnieje — zmień rolę zamiast zapraszać';
  end if;
  if coalesce(p_locale,'pl') not in ('pl','en','sv') then raise exception 'Nieznany język'; end if;
  select id into v_me from app_users where auth_id = auth.uid();
  insert into user_invites (email, org_id, role, full_name, locale, invited_by)
  values (lower(p_email), v_org.id, p_role, p_full_name, coalesce(p_locale,'pl'), v_me)
  on conflict (email) do update
     set org_id = excluded.org_id, role = excluded.role, full_name = excluded.full_name,
         locale = excluded.locale, invited_by = excluded.invited_by, created_at = now()
   where user_invites.accepted_at is null
  returning id into v_id;
  if v_id is null then raise exception 'Zaproszenie już przyjęte'; end if;
  insert into audit_log (user_id, action, entity, entity_id, new_value)
  values (v_me, 'USER_INVITED', 'user_invites', v_id::text,
          jsonb_build_object('org', v_org.code, 'role', p_role));
  return v_id;
end $$;

create or replace function admin_revoke_invite(p_invite uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if current_app_role() is distinct from 'HHL_ADMIN' then
    raise exception 'Wyłącznie administrator HHL' using errcode = '42501';
  end if;
  delete from user_invites where id = p_invite and accepted_at is null;
  insert into audit_log (user_id, action, entity, entity_id)
  values ((select id from app_users where auth_id = auth.uid()),
          'USER_INVITE_REVOKED', 'user_invites', p_invite::text);
end $$;

create or replace function admin_set_user_role(p_user uuid, p_role user_role)
returns void language plpgsql security definer set search_path = public as $$
declare v_old user_role; v_kind org_kind; v_auth uuid;
begin
  if current_app_role() is distinct from 'HHL_ADMIN' then
    raise exception 'Role nadaje wyłącznie administrator HHL' using errcode = '42501';
  end if;
  select u.role, o.kind, u.auth_id into v_old, v_kind, v_auth
    from app_users u join organizations o on o.id = u.org_id where u.id = p_user;
  if not found then raise exception 'Nieznany użytkownik'; end if;
  if v_auth = auth.uid() and p_role <> 'HHL_ADMIN' then
    raise exception 'Nie możesz odebrać sobie roli administratora';
  end if;
  if not role_matches_org(p_role, v_kind) then
    raise exception 'Rola % nie pasuje do organizacji użytkownika', p_role;
  end if;
  update app_users set role = p_role where id = p_user;
  insert into audit_log (user_id, action, entity, entity_id, old_value, new_value)
  values ((select id from app_users where auth_id = auth.uid()), 'USER_ROLE_SET',
          'app_users', p_user::text, jsonb_build_object('role', v_old),
          jsonb_build_object('role', p_role));
end $$;

create or replace function admin_set_user_active(p_user uuid, p_active boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_auth uuid;
begin
  if current_app_role() is distinct from 'HHL_ADMIN' then
    raise exception 'Wyłącznie administrator HHL' using errcode = '42501';
  end if;
  select auth_id into v_auth from app_users where id = p_user;
  if not found then raise exception 'Nieznany użytkownik'; end if;
  if v_auth = auth.uid() and not p_active then
    raise exception 'Nie możesz dezaktywować własnego konta';
  end if;
  update app_users set active = p_active where id = p_user;
  insert into audit_log (user_id, action, entity, entity_id, new_value)
  values ((select id from app_users where auth_id = auth.uid()), 'USER_ACTIVE_SET',
          'app_users', p_user::text, jsonb_build_object('active', p_active));
end $$;

-- Profil zalogowanego (rola + kod organizacji) dla interfejsu.
create or replace function my_profile()
returns table (user_id uuid, email text, full_name text, role user_role,
               org_code text, org_name text, locale text, active boolean)
language sql stable security definer set search_path = public as $$
  select u.id, u.email::text, u.full_name, u.role, o.code, o.name, u.locale::text, u.active
    from app_users u join organizations o on o.id = u.org_id
   where u.auth_id = auth.uid()
$$;

revoke execute on function handle_new_auth_user()                                   from public, anon, authenticated;
revoke execute on function admin_invite_user(text, text, user_role, text, text)     from public, anon;
revoke execute on function admin_revoke_invite(uuid)                                from public, anon;
revoke execute on function admin_set_user_role(uuid, user_role)                     from public, anon;
revoke execute on function admin_set_user_active(uuid, boolean)                     from public, anon;
revoke execute on function my_profile()                                             from public, anon;
grant  execute on function admin_invite_user(text, text, user_role, text, text)     to authenticated;
grant  execute on function admin_revoke_invite(uuid)                                to authenticated;
grant  execute on function admin_set_user_role(uuid, user_role)                     to authenticated;
grant  execute on function admin_set_user_active(uuid, boolean)                     to authenticated;
grant  execute on function my_profile()                                             to authenticated;
