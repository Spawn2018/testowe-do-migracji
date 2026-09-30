-- =====================================================================
-- TOWER — Migracja 0099: AUTH-1 — logowanie hasłem (PO_SPOTKANIU §1).
--   • auth_email_allowed(email): true gdy aktywne konto ALBO ważne zaproszenie
--     — anon sprawdza PRZED wysyłką e-maila (reset); bez zaproszenia → zero e-maili.
--   • app_users.must_set_password: po zaproszeniu / magic linku wymusza ustawienie
--     hasła (≥ 12 zn.) przy następnym wejściu.
--   • app_user_mark_password_set(): SECURITY DEFINER, tylko własne konto.
--   • my_profile() + must_set_password (reszta kolumn bez zmian).
--   Idempotentna.
-- =====================================================================

alter table public.app_users
  add column if not exists must_set_password boolean not null default true;

update public.app_users set must_set_password = true where must_set_password is distinct from true;

create or replace function public.auth_email_allowed(p_email text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
begin
  if (v_email <> '') is not true or position('@' in v_email) < 2 then
    return false;
  end if;
  if exists (
    select 1 from app_users
     where lower(email) = v_email and active is true
  ) then
    return true;
  end if;
  if exists (
    select 1 from user_invites
     where lower(email) = v_email
       and accepted_at is null
       and created_at > now() - interval '7 days'
  ) then
    return true;
  end if;
  return false;
end;
$$;

revoke all on function public.auth_email_allowed(text) from public;
grant execute on function public.auth_email_allowed(text) to anon, authenticated;

create or replace function public.app_user_mark_password_set()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_user uuid;
begin
  if (v_uid is null) is not false then
    raise exception 'TOWER_AUTH: brak sesji';
  end if;
  select id into v_user from app_users where auth_id = v_uid and active is true;
  if (v_user is null) is not false then
    raise exception 'TOWER_AUTH: konto nieaktywne lub brak profilu';
  end if;
  update app_users set must_set_password = false where id = v_user;
  insert into audit_log (user_id, action, entity, entity_id, new_value)
  values (v_user, 'PASSWORD_SET', 'app_users', v_user::text, jsonb_build_object('must_set_password', false, 'at', now()));
end;
$$;

revoke all on function public.app_user_mark_password_set() from public, anon;
grant execute on function public.app_user_mark_password_set() to authenticated;

-- DROP wymagany przy zmianie OUT (Postgres nie pozwala REPLACE ze zmienioną listą kolumn).
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
  must_set_password boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select u.id, u.email::text, u.full_name, u.role, o.code, o.name, u.locale::text, u.active, u.must_set_password
    from app_users u
    join organizations o on o.id = u.org_id
   where u.auth_id = auth.uid()
$$;

revoke all on function public.my_profile() from public, anon;
grant execute on function public.my_profile() to authenticated;
