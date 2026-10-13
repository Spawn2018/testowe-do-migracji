-- TOWER — Migracja 0197: P3 E6 — imię, nazwisko (2 pola), telefon E.164 (E6-3, E6-4).
-- full_name wyliczane z first_name + last_name. Idempotentna. Bez zmian wyglądu.

-- 1) Kolumny -----------------------------------------------------------------
alter table public.app_users
  add column if not exists first_name text,
  add column if not exists last_name text;

alter table public.user_invites
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists phone text;

-- Backfill z full_name (pierwszy token = imię, reszta = nazwisko)
update public.app_users
   set first_name = nullif(btrim(split_part(coalesce(full_name, ''), ' ', 1)), ''),
       last_name = nullif(btrim(regexp_replace(coalesce(full_name, ''), '^\S+\s*', '')), '')
 where first_name is null and last_name is null
   and nullif(btrim(coalesce(full_name, '')), '') is not null;

update public.user_invites
   set first_name = nullif(btrim(split_part(coalesce(full_name, ''), ' ', 1)), ''),
       last_name = nullif(btrim(regexp_replace(coalesce(full_name, ''), '^\S+\s*', '')), '')
 where first_name is null and last_name is null
   and nullif(btrim(coalesce(full_name, '')), '') is not null;

-- Telefon konta: E.164 gdy podany (E6-4); kolumna phone jest od 0001_core
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'app_users_phone_e164_chk'
  ) then
    alter table public.app_users
      add constraint app_users_phone_e164_chk
      check (phone is null or phone ~ '^\+[1-9][0-9]{7,14}$');
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'user_invites_phone_e164_chk'
  ) then
    alter table public.user_invites
      add constraint user_invites_phone_e164_chk
      check (phone is null or phone ~ '^\+[1-9][0-9]{7,14}$');
  end if;
end $$;

-- 2) Synchronizacja full_name = „Imię Nazwisko” --------------------------------
create or replace function public.app_users_sync_full_name()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.full_name := nullif(btrim(concat_ws(' ', nullif(btrim(new.first_name), ''), nullif(btrim(new.last_name), ''))), '');
  return new;
end $$;

drop trigger if exists trg_app_users_sync_full_name on public.app_users;
create trigger trg_app_users_sync_full_name
  before insert or update of first_name, last_name
  on public.app_users
  for each row execute function public.app_users_sync_full_name();

-- 3) Zapis profilu: admin HHL dowolnego; każdy swoje (E6) ----------------------
create or replace function public.admin_user_profile_set(
  p_user uuid,
  p_first_name text,
  p_last_name text,
  p_phone text
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid;
  v_role user_role;
  v_self boolean;
  v_old jsonb;
  v_phone text;
begin
  select id, role into v_me, v_role from app_users where auth_id = auth.uid() and active;
  if (v_me is not null) is not true then
    raise exception 'Brak aktywnego konta' using errcode = '42501';
  end if;
  v_self := (p_user = v_me);
  if (v_self or v_role = 'HHL_ADMIN') is not true then
    raise exception 'Profil zmienia wyłącznie właściciel konta albo administrator HHL' using errcode = '42501';
  end if;
  if (nullif(btrim(p_first_name), '') is not null
      and nullif(btrim(p_last_name), '') is not null) is not true then
    raise exception 'Imię i nazwisko są wymagane' using errcode = '22023';
  end if;
  v_phone := nullif(btrim(p_phone), '');
  if (v_phone is not null and v_phone ~ '^\+[1-9][0-9]{7,14}$') is not true then
    raise exception 'Telefon jest wymagany w formacie E.164 (+…)' using errcode = '22023';
  end if;
  if not exists (select 1 from app_users where id = p_user) then
    raise exception 'Nieznany użytkownik' using errcode = '22023';
  end if;
  select jsonb_build_object('first_name', first_name, 'last_name', last_name, 'phone', phone)
    into v_old from app_users where id = p_user;
  update app_users
     set first_name = btrim(p_first_name),
         last_name = btrim(p_last_name),
         phone = v_phone
   where id = p_user;
  insert into audit_log (user_id, action, entity, entity_id, old_value, new_value)
  values (v_me, 'USER_PROFILE_SET', 'app_users', p_user::text, v_old,
          jsonb_build_object('first_name', btrim(p_first_name), 'last_name', btrim(p_last_name),
                             'phone', v_phone));
end $$;

revoke all on function public.admin_user_profile_set(uuid, text, text, text) from public, anon;
grant execute on function public.admin_user_profile_set(uuid, text, text, text) to authenticated;

-- 4) Zaproszenie: imię, nazwisko, telefon wymagane (E6) -----------------------
create or replace function public.admin_invite_user(
  p_email text, p_org_code text, p_role user_role,
  p_full_name text default null, p_locale text default 'pl',
  p_first_name text default null, p_last_name text default null, p_phone text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_org organizations%rowtype; v_id uuid; v_me uuid; v_user app_users%rowtype;
        v_signed boolean; v_reinvite boolean := false;
        v_fn text; v_ln text; v_phone text;
begin
  if current_app_role() is distinct from 'HHL_ADMIN' then
    raise exception 'Zapraszać może wyłącznie administrator HHL' using errcode = '42501';
  end if;
  if p_email is null or p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Nieprawidłowy adres e-mail';
  end if;
  if p_role in ('CLIENT_ADMIN', 'SITE_VIEWER') then
    raise exception 'Rola % nie jest w użyciu — wybierz jeden z 5 rodzajów kont (E9)', p_role
      using errcode = '22023';
  end if;
  select * into v_org from organizations where code = upper(p_org_code);
  if not found then raise exception 'Nieznana organizacja: %', p_org_code; end if;
  if role_matches_org(p_role, v_org.kind) is not true then
    raise exception 'Rola % nie pasuje do organizacji %', p_role, v_org.code;
  end if;
  if coalesce(p_locale,'pl') not in ('pl','en','sv') then raise exception 'Nieznany język'; end if;

  v_fn := nullif(btrim(p_first_name), '');
  v_ln := nullif(btrim(p_last_name), '');
  if v_fn is null and v_ln is null and nullif(btrim(p_full_name), '') is not null then
    v_fn := nullif(btrim(split_part(p_full_name, ' ', 1)), '');
    v_ln := nullif(btrim(regexp_replace(p_full_name, '^\S+\s*', '')), '');
  end if;
  if (v_fn is not null and v_ln is not null) is not true then
    raise exception 'Imię i nazwisko są wymagane' using errcode = '22023';
  end if;
  v_phone := nullif(btrim(p_phone), '');
  if (v_phone is not null and v_phone ~ '^\+[1-9][0-9]{7,14}$') is not true then
    raise exception 'Telefon jest wymagany w formacie E.164 (+…)' using errcode = '22023';
  end if;

  select * into v_user from app_users where email = lower(p_email)::citext;
  if found then
    v_signed := true;
    if to_regclass('auth.users') is not null then
      execute 'select last_sign_in_at is not null from auth.users where id = $1' into v_signed using v_user.auth_id;
    end if;
    if coalesce(v_signed, false) then
      raise exception 'Użytkownik już istnieje — zmień rolę zamiast zapraszać';
    end if;
    v_reinvite := true;
  end if;
  select id into v_me from app_users where auth_id = auth.uid();
  insert into user_invites (email, org_id, role, full_name, first_name, last_name, phone, locale, invited_by)
  values (lower(p_email), v_org.id, p_role,
          nullif(btrim(concat_ws(' ', v_fn, v_ln)), ''),
          v_fn, v_ln, v_phone, coalesce(p_locale,'pl'), v_me)
  on conflict (email) do update
     set org_id = excluded.org_id, role = excluded.role,
         full_name = excluded.full_name, first_name = excluded.first_name,
         last_name = excluded.last_name, phone = excluded.phone,
         locale = excluded.locale, invited_by = excluded.invited_by, created_at = now()
   where user_invites.accepted_at is null
  returning id into v_id;
  if v_id is null then raise exception 'Zaproszenie już przyjęte'; end if;
  if v_reinvite then
    update app_users set active = true, org_id = v_org.id, role = p_role,
           first_name = v_fn,
           last_name = v_ln,
           phone = v_phone,
           locale = coalesce(p_locale, locale)
     where id = v_user.id;
  end if;
  insert into audit_log (user_id, action, entity, entity_id, new_value)
  values (v_me, case when v_reinvite then 'USER_REINVITED' else 'USER_INVITED' end, 'user_invites', v_id::text,
          jsonb_build_object('org', v_org.code, 'role', p_role, 'first_name', v_fn, 'last_name', v_ln));
  return v_id;
end $$;

revoke all on function public.admin_invite_user(text, text, user_role, text, text, text, text, text) from public, anon;
grant execute on function public.admin_invite_user(text, text, user_role, text, text, text, text, text) to authenticated;

-- Stara sygnatura 5-arg (0196) — drop, żeby nie było dwóch przeciążeń
do $$
begin
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'admin_invite_user'
       and pg_get_function_identity_arguments(p.oid) = 'text, text, user_role, text, text'
  ) then
    execute 'drop function public.admin_invite_user(text, text, user_role, text, text)';
  end if;
end $$;

-- handle_new_auth_user: jak 0046 + first/last/phone; przyjęcie dopiero przy pierwszym logowaniu (0039)
create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare inv public.user_invites%rowtype; p public.account_relink_pending%rowtype;
begin
  -- PR2-B: konto z odtworzonej kopii → połączenie po adresie e-mail
  select * into p from public.account_relink_pending
   where email = lower(new.email)::citext
     and marked_at >= now() - make_interval(days => public.relink_valid_days())
   for update;
  if found then
    update public.app_users u set auth_id = new.id
     where u.id = p.app_user_id and u.auth_id = p.old_auth_id
       and not exists (select 1 from auth.users a where a.id = p.old_auth_id);
    if found then
      delete from public.account_relink_pending where email = p.email;
      insert into public.audit_log (user_id, action, entity, entity_id, new_value)
      values (null, 'USER_RELINKED_AFTER_RESTORE', 'app_users', p.app_user_id::text,
              jsonb_build_object('old_auth_id', p.old_auth_id, 'new_auth_id', new.id));
      return new;
    end if;
  end if;
  select * into inv from public.user_invites
   where email = lower(new.email)::citext and accepted_at is null
   for update;
  if not found then
    raise exception 'TOWER_NO_INVITE: konto tylko na zaproszenie administratora HHL'
      using errcode = '42501';
  end if;
  if inv.created_at < now() - make_interval(days => public.invite_valid_days()) then
    raise exception 'TOWER_INVITE_EXPIRED: zaproszenie wygasło (ważne % dni) — poproś administratora HHL o nowe',
      public.invite_valid_days() using errcode = '42501';
  end if;
  insert into public.app_users (auth_id, org_id, email, first_name, last_name, phone, role, locale)
  values (new.id, inv.org_id, lower(new.email), inv.first_name, inv.last_name, inv.phone, inv.role, inv.locale);
  -- przyjęcie zaproszenia dopiero przy pierwszym logowaniu (handle_auth_first_sign_in)
  return new;
end $$;

-- 5) my_profile — first_name, last_name, phone --------------------------------
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
    exists (select 1 from tgt)
  from eff e
  join organizations o on o.id = e.org_id
  cross join me m
$$;

revoke all on function public.my_profile() from public, anon;
grant execute on function public.my_profile() to authenticated;
