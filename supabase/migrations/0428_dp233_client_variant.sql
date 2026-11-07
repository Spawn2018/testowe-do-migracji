-- DP-233 (#861): wariant KSH (załadunki / rozładunki) przy roli CLIENT_USER.
-- RLS i RPC bez zmian — rola zostaje CLIENT_USER; filtr Harmonogramu czyta wariant z profilu.

alter table public.app_users
  add column if not exists client_variant text;

alter table public.app_users
  drop constraint if exists app_users_client_variant_chk;

alter table public.app_users
  add constraint app_users_client_variant_chk
  check (
    client_variant is null
    or client_variant in ('LOADING', 'UNLOADING')
  );

comment on column public.app_users.client_variant is
  'DP-233: wariant KSH — LOADING/UNLOADING (domyślny filtr Harmonogramu); null = zwykły CLIENT_USER.';

-- Wariant tylko przy CLIENT_USER (pozostałe role → null).
create or replace function public.app_users_client_variant_guard()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if (new.role is distinct from 'CLIENT_USER') then
    new.client_variant := null;
  elsif (new.client_variant is not null)
    and (new.client_variant in ('LOADING', 'UNLOADING')) is not true then
    raise exception 'client_variant musi być null, LOADING albo UNLOADING'
      using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_app_users_client_variant on public.app_users;
create trigger trg_app_users_client_variant
  before insert or update of role, client_variant on public.app_users
  for each row execute function public.app_users_client_variant_guard();

-- Profil: dorzuć client_variant (efektywny użytkownik przy impersonacji).
drop function if exists public.my_profile();
create function public.my_profile()
returns table (
  user_id uuid,
  email text,
  full_name text,
  first_name text,
  last_name text,
  phone text,
  role user_role,
  org_code text,
  org_name text,
  locale text,
  active boolean,
  must_set_password boolean,
  real_user_id uuid,
  real_email text,
  real_role user_role,
  acting_as boolean,
  preview_read_only boolean,
  client_variant text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with me as (
    select u.* from app_users u where u.auth_id = auth.uid()
  ),
  tgt as (
    select t.*, i.read_only as i_read_only, i.started_at as i_started_at
      from me
      join impersonation_state i on i.admin_user_id = me.id
      join app_users t on t.id = i.target_user_id and t.active is true
     where me.role = 'HHL_ADMIN' and me.active is true
       and mfa_satisfied(me.role)
       and i.started_at > now() - interval '8 hours'
  ),
  eff as (
    select id, email, full_name, first_name, last_name, phone, role, org_id, locale, active, client_variant
      from tgt
    union all
    select me.id, me.email, me.full_name, me.first_name, me.last_name, me.phone,
           me.role, me.org_id, me.locale, me.active, me.client_variant
      from me where not exists (select 1 from tgt)
  )
  select
    e.id,
    e.email::text,
    e.full_name,
    e.first_name,
    e.last_name,
    e.phone,
    e.role,
    o.code,
    o.name,
    e.locale::text,
    e.active,
    coalesce(m.must_set_password, false),
    m.id,
    m.email::text,
    m.role,
    exists (select 1 from tgt),
    exists (select 1 from tgt where i_read_only is true),
    case when e.role = 'CLIENT_USER' then e.client_variant else null end
  from eff e
  join organizations o on o.id = e.org_id
  cross join me m
$$;

revoke all on function public.my_profile() from public, anon;
grant execute on function public.my_profile() to authenticated;

-- Ustawienie wariantu (HHL_ADMIN); rola bez zmian gdy już CLIENT_USER.
create or replace function public.admin_set_client_variant(
  p_user uuid,
  p_variant text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role user_role;
  v_old text;
begin
  perform public.assert_not_preview();
  if (current_app_role() is distinct from 'HHL_ADMIN') then
    raise exception 'Wariant KSH ustawia wyłącznie administrator HHL' using errcode = '42501';
  end if;
  if (p_variant is not null) and (p_variant in ('LOADING', 'UNLOADING')) is not true then
    raise exception 'client_variant musi być null, LOADING albo UNLOADING' using errcode = '22023';
  end if;
  select role, client_variant into v_role, v_old
    from public.app_users where id = p_user;
  if not found then
    raise exception 'Nieznany użytkownik';
  end if;
  if (v_role is distinct from 'CLIENT_USER') then
    raise exception 'Wariant tylko dla konta KSH (CLIENT_USER)' using errcode = '22023';
  end if;
  if (v_old is not distinct from p_variant) then
    return;
  end if;
  update public.app_users set client_variant = p_variant where id = p_user;
  insert into public.audit_log (user_id, action, entity, entity_id, old_value, new_value)
  values (
    public.current_app_user_id(),
    'USER_CLIENT_VARIANT_SET',
    'app_users',
    p_user::text,
    jsonb_build_object('client_variant', v_old),
    jsonb_build_object('client_variant', p_variant)
  );
end;
$$;

revoke all on function public.admin_set_client_variant(uuid, text) from public, anon;
grant execute on function public.admin_set_client_variant(uuid, text) to authenticated;

-- Przy zmianie roli na nie-KSH wariant czyści trigger; przy ustawieniu CLIENT_USER zostaje.
-- admin_set_user_role: po zmianie na CLIENT_USER wariant bez zmian (null domyślnie).
