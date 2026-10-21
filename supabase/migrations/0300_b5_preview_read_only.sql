-- 0300 — B5 / W38: Podgląd = impersonacja tylko do odczytu (D-20261015-0330-01,
-- D-20261019-1525-01; F7 #382). Tylko HHL_ADMIN + mfa_satisfied. HHL_OPS → 42501.
-- TTL 8 h; stop własnego wiersza; assert_not_preview we wszystkich zapisujących RPC;
-- wyzwalacze aaa_b5_preview na tabelach z polityką zapisu. Idempotentna.

-- 1) Kolumna read_only
alter table public.impersonation_state
  add column if not exists read_only boolean not null default false;

comment on column public.impersonation_state.read_only is
  'B5/W38: true = Podgląd (tylko odczyt); false = Działaj jako (zapis).';

-- 2) Odczyt stanu — te same warunki co current_* (0117) + TTL 8 h
create or replace function public.is_preview_read_only()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from impersonation_state i
      join app_users a on a.id = i.admin_user_id
      join app_users t on t.id = i.target_user_id
     where a.auth_id = auth.uid()
       and a.active is true
       and a.role = 'HHL_ADMIN'
       and mfa_satisfied(a.role)
       and t.active is true
       and i.read_only is true
       and i.started_at > now() - interval '8 hours'
  );
$$;

create or replace function public.assert_not_preview()
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if public.is_preview_read_only() is true then
    raise exception 'Podgląd — nic tu nie zapiszesz' using errcode = '42501';
  end if;
end $$;

revoke all on function public.is_preview_read_only() from public, anon;
revoke all on function public.assert_not_preview() from public, anon;
grant execute on function public.is_preview_read_only() to authenticated;
grant execute on function public.assert_not_preview() to authenticated;

comment on function public.assert_not_preview() is
  'B5: odmowa zapisu w Podglądzie (impersonation_state.read_only, warunki jak current_*).';

-- 3) Sprzątanie wygasłych wierszy (TTL)
create or replace function public.b5_preview_cleanup_expired()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  delete from impersonation_state
   where started_at <= now() - interval '8 hours';
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function public.b5_preview_cleanup_expired() from public, anon, authenticated;

-- 3b) current_* i dziennik — ten sam TTL 8 h (F7: po TTL nie „Działaj jako” bez blokady)
create or replace function public.current_app_user_id() returns uuid
language sql stable security definer set search_path = public, extensions as $$
  select coalesce(
    (select i.target_user_id
       from impersonation_state i
       join app_users a on a.id = i.admin_user_id
       join app_users t on t.id = i.target_user_id
      where a.auth_id = auth.uid()
        and a.active and a.role = 'HHL_ADMIN' and mfa_satisfied(a.role)
        and t.active
        and i.started_at > now() - interval '8 hours'),
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
        and t.active
        and i.started_at > now() - interval '8 hours'),
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
        and t.active
        and i.started_at > now() - interval '8 hours'),
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
        and t.active
        and i.started_at > now() - interval '8 hours'),
    (select o.kind from app_users u join organizations o on o.id = u.org_id
      where u.auth_id = auth.uid() and u.active and mfa_satisfied(u.role))
  )
$$;

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
     and i.started_at > now() - interval '8 hours'
   limit 1;
  if v_admin is not null and v_target is not null then
    if new.user_id is null or new.user_id = v_target then
      new.user_id := v_admin;
    end if;
    new.acting_as_user_id := coalesce(new.acting_as_user_id, v_target);
  end if;
  return new;
end $$;

-- 4) Wyzwalacz DML — przed innymi guardami (nazwa aaa_…)
create or replace function public.guard_preview_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  /* Konteksty systemowe ETA / śledzenie / automat statusu — bez blokady Podglądu. */
  if coalesce(current_setting('tower.eta_ctx', true), '') = 'on'
     or coalesce(current_setting('tower.track_ctx', true), '') = 'on'
     or coalesce(current_setting('tower.auto_status', true), '') = 'on'
  then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  if auth.uid() is not null then
    perform public.assert_not_preview();
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

revoke all on function public.guard_preview_write() from public, anon, authenticated;

-- Tabele z polityką zapisu (INSERT/UPDATE/DELETE/ALL) — poza dziennikiem i stanem Podglądu.
-- Najpierw zdejmij stare nazwy aaa_b5_preview_* z wcześniejszej wersji 0249.
do $$
declare
  r record;
begin
  for r in
    select t.tgname, n.nspname as sch, c.relname as tbl
      from pg_trigger t
      join pg_class c on c.oid = t.tgrelid
      join pg_namespace n on n.oid = c.relnamespace
     where t.tgname like 'aaa\_b5\_preview%' escape '\'
       and not t.tgisinternal
  loop
    execute format('drop trigger if exists %I on %I.%I', r.tgname, r.sch, r.tbl);
  end loop;

  for r in
    select distinct n.nspname as sch, c.relname as tbl
      from pg_policy p
      join pg_class c on c.oid = p.polrelid
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname in ('public', 'storage')
       and p.polcmd in ('a', 'w', 'd', '*')
       and c.relkind = 'r'
       and c.relname not in ('audit_log', 'impersonation_state')
  loop
    execute format(
      'create trigger aaa_b5_preview before insert or update or delete on %I.%I
         for each row execute function public.guard_preview_write()',
      r.sch, r.tbl
    );
  end loop;
end $$;

-- 5) Działaj jako — zawsze read_only = false; TTL cleanup
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
  perform public.b5_preview_cleanup_expired();
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
  insert into impersonation_state (admin_user_id, target_user_id, started_at, read_only)
  values (v_admin, p_user, now(), false)
  on conflict (admin_user_id) do update
    set target_user_id = excluded.target_user_id,
        started_at = excluded.started_at,
        read_only = false;
  insert into audit_log (user_id, action, entity, entity_id, new_value, acting_as_user_id)
  values (v_admin, 'IMPERSONATE_START', 'app_users', p_user::text,
          jsonb_build_object('target_email', v_target.email, 'target_role', v_target.role, 'read_only', false),
          p_user);
end $$;

-- 6) Podgląd — start na pierwszym aktywnym KSH Użytkownik / SCX Dyspozytor
create or replace function public.admin_preview_start(p_side text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid;
  v_admin_role user_role;
  v_side text := upper(btrim(coalesce(p_side, '')));
  v_target uuid;
  v_target_row app_users%rowtype;
  v_org_kind org_kind;
  v_role user_role;
  v_label text;
begin
  perform public.b5_preview_cleanup_expired();
  select id, role into v_admin, v_admin_role
    from app_users
   where auth_id = auth.uid() and active is true;
  if (v_admin is not null and v_admin_role = 'HHL_ADMIN' and mfa_satisfied(v_admin_role)) is not true then
    raise exception 'Tylko administrator HHL (z 2FA gdy wymagane)' using errcode = '42501';
  end if;

  if v_side in ('KSH', 'CLIENT') then
    v_org_kind := 'CLIENT';
    v_role := 'CLIENT_USER';
    v_label := 'KSH';
  elsif v_side in ('SCX', 'CARRIER') then
    v_org_kind := 'CARRIER';
    v_role := 'CARRIER_DISPATCH';
    v_label := 'SCX';
  else
    raise exception 'Podgląd: podaj KSH albo SCX' using errcode = '22023';
  end if;

  select u.id into v_target
    from app_users u
    join organizations o on o.id = u.org_id
   where u.active is true
     and u.role = v_role
     and o.kind = v_org_kind
     and (
       (v_label = 'KSH' and o.code = 'KSH')
       or (v_label = 'SCX' and o.code = 'SCX')
     )
   order by u.created_at nulls last, u.email
   limit 1;

  if v_target is null then
    raise exception 'Brak aktywnego konta % do Podglądu', v_label using errcode = '22023';
  end if;

  select * into v_target_row from app_users where id = v_target;

  insert into impersonation_state (admin_user_id, target_user_id, started_at, read_only)
  values (v_admin, v_target, now(), true)
  on conflict (admin_user_id) do update
    set target_user_id = excluded.target_user_id,
        started_at = excluded.started_at,
        read_only = true;

  insert into audit_log (user_id, action, entity, entity_id, new_value, acting_as_user_id)
  values (v_admin, 'PREVIEW_START', 'app_users', v_target::text,
          jsonb_build_object(
            'side', v_label,
            'target_email', v_target_row.email,
            'target_role', v_target_row.role,
            'read_only', true
          ),
          v_target);

  return v_target;
end $$;

-- Stop: każde aktywne konto ze swoim wierszem; bez wiersza = no-op (idempotentne).
create or replace function public.admin_preview_stop()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid;
  v_target uuid;
  v_ro boolean;
begin
  perform public.b5_preview_cleanup_expired();
  select id into v_admin
    from app_users
   where auth_id = auth.uid() and active is true;
  if (v_admin is not null) is not true then
    raise exception 'Brak aktywnego konta' using errcode = '42501';
  end if;

  select target_user_id, read_only into v_target, v_ro
    from impersonation_state where admin_user_id = v_admin;
  delete from impersonation_state where admin_user_id = v_admin;

  if v_target is not null then
    insert into audit_log (user_id, action, entity, entity_id, old_value)
    values (v_admin, 'PREVIEW_STOP', 'app_users', v_target::text,
            jsonb_build_object('target_user_id', v_target, 'read_only', coalesce(v_ro, true)));
  end if;
end $$;

-- Stop „Działaj jako”: też własne wiersze (bez wymogu HHL_ADMIN — jak F7 sticky).
create or replace function public.admin_impersonate_stop()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid;
  v_target uuid;
begin
  perform public.b5_preview_cleanup_expired();
  select id into v_admin
    from app_users
   where auth_id = auth.uid() and active is true;
  if (v_admin is not null) is not true then
    raise exception 'Brak aktywnego konta' using errcode = '42501';
  end if;
  select target_user_id into v_target from impersonation_state where admin_user_id = v_admin;
  delete from impersonation_state where admin_user_id = v_admin;
  if v_target is not null then
    insert into audit_log (user_id, action, entity, entity_id, old_value)
    values (v_admin, 'IMPERSONATE_STOP', 'app_users', v_target::text,
            jsonb_build_object('target_user_id', v_target));
  end if;
end $$;

revoke all on function public.admin_preview_start(text) from public, anon;
revoke all on function public.admin_preview_stop() from public, anon;
revoke all on function public.admin_impersonate_start(uuid) from public, anon;
revoke all on function public.admin_impersonate_stop() from public, anon;
grant execute on function public.admin_preview_start(text) to authenticated;
grant execute on function public.admin_preview_stop() to authenticated;
grant execute on function public.admin_impersonate_start(uuid) to authenticated;
grant execute on function public.admin_impersonate_stop() to authenticated;

comment on function public.admin_preview_start(text) is
  'B5: Podgląd KSH/SCX — pierwsze aktywne CLIENT_USER / CARRIER_DISPATCH; tylko HHL_ADMIN.';
comment on function public.admin_preview_stop() is
  'B5: koniec Podglądu; własne wiersze; bez wiersza = no-op; PREVIEW_STOP w audit_log.';

-- 7) Czyszczenie stanu przy zmianie roli / aktywności
create or replace function public.admin_set_user_role(p_user uuid, p_role user_role)
returns void
language plpgsql security definer set search_path = public as $$
declare v_old user_role; v_kind org_kind; v_auth uuid;
begin
  perform public.assert_not_preview();
  if current_app_role() is distinct from 'HHL_ADMIN' then
    raise exception 'Role nadaje wyłącznie administrator HHL' using errcode = '42501';
  end if;
  if p_role in ('CLIENT_ADMIN', 'SITE_VIEWER') then
    raise exception 'Rola % nie jest w użyciu — wybierz jeden z 5 rodzajów kont (E9)', p_role
      using errcode = '22023';
  end if;
  select u.role, o.kind, u.auth_id into v_old, v_kind, v_auth
    from app_users u join organizations o on o.id = u.org_id where u.id = p_user;
  if not found then raise exception 'Nieznany użytkownik'; end if;
  if v_auth = auth.uid() and p_role <> 'HHL_ADMIN' then
    raise exception 'Nie możesz odebrać sobie roli administratora';
  end if;
  if role_matches_org(p_role, v_kind) is not true then
    raise exception 'Rola % nie pasuje do organizacji użytkownika', p_role;
  end if;
  if v_old is not distinct from p_role then
    return;
  end if;
  update app_users set role = p_role where id = p_user;
  delete from impersonation_state
   where admin_user_id = p_user or target_user_id = p_user;
  insert into audit_log (user_id, action, entity, entity_id, old_value, new_value)
  values ((select id from app_users where auth_id = auth.uid()), 'USER_ROLE_SET',
          'app_users', p_user::text, jsonb_build_object('role', v_old),
          jsonb_build_object('role', p_role));
end $$;

create or replace function public.admin_set_user_active(p_user uuid, p_active boolean)
returns void
language plpgsql security definer set search_path = public as $$
declare v_auth uuid;
begin
  perform public.assert_not_preview();
  if current_app_role() is distinct from 'HHL_ADMIN' then
    raise exception 'Wyłącznie administrator HHL' using errcode = '42501';
  end if;
  select auth_id into v_auth from app_users where id = p_user;
  if not found then raise exception 'Nieznany użytkownik'; end if;
  if v_auth = auth.uid() and not p_active then
    raise exception 'Nie możesz dezaktywować własnego konta';
  end if;
  update app_users set active = p_active where id = p_user;
  delete from impersonation_state
   where admin_user_id = p_user or target_user_id = p_user;
  insert into audit_log (user_id, action, entity, entity_id, new_value)
  values ((select id from app_users where auth_id = auth.uid()), 'USER_ACTIVE_SET',
          'app_users', p_user::text, jsonb_build_object('active', p_active));
end $$;

revoke all on function public.admin_set_user_role(uuid, user_role) from public, anon;
revoke all on function public.admin_set_user_active(uuid, boolean) from public, anon;
grant execute on function public.admin_set_user_role(uuid, user_role) to authenticated;
grant execute on function public.admin_set_user_active(uuid, boolean) to authenticated;

-- 8) my_profile — preview_read_only (F7 uzupełnienie #383)
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
  preview_read_only boolean
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
    select t.*, i.read_only as i_read_only, i.started_at as i_started_at
      from me
      join impersonation_state i on i.admin_user_id = me.id
      join app_users t on t.id = i.target_user_id and t.active is true
     where me.role = 'HHL_ADMIN' and me.active is true
       and mfa_satisfied(me.role)
       and i.started_at > now() - interval '8 hours'
  ),
  eff as (
    select id, email, full_name, first_name, last_name, phone, role, org_id, locale, active
      from tgt
    union all
    select me.id, me.email, me.full_name, me.first_name, me.last_name, me.phone,
           me.role, me.org_id, me.locale, me.active
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
    exists (select 1 from tgt where i_read_only is true)
  from eff e
  join organizations o on o.id = e.org_id
  cross join me m
$$;

revoke all on function public.my_profile() from public, anon;
grant execute on function public.my_profile() to authenticated;

-- 9) assert_not_preview na początku każdego zapisującego RPC (plpgsql, authenticated)
-- F7: pierwszy kwantyfikator leniwy (*?) — inaczej PG łapie zagnieżdżony BEGIN
-- (update_invoice / register_invoice / import_schedule / load_status_set).
-- Dodatkowo: zapis przez helperów (report_position, delivered_check_resolve).
do $$
declare
  r record;
  def text;
  new_def text;
  skip text[] := array[
    'admin_preview_stop', 'admin_impersonate_stop', 'keep_alive',
    'report_client_error', 'report_csp_violation',
    'assert_not_preview', 'is_preview_read_only', 'guard_preview_write',
    'b5_preview_cleanup_expired',
    'admin_preview_start', 'admin_impersonate_start',
    -- odczytowe / bez zapisu własnego (F7 lista wyjątków strażnika)
    'map_display_state', 'rio_tracking_open', 'email_budget_status', 'my_notify_get'
  ];
  force_helpers text[] := array['report_position', 'delivered_check_resolve'];
  -- Pierwszy BEGIN po AS $tag$ [DECLARE …] — leniwy tag, DECLARE bez BEGIN w środku.
  re_first_begin text :=
    E'(\\$[A-Za-z0-9_]*?\\$(?:\\s*declare(?:(?!\\ybegin\\y)[\\s\\S])*?)?)(\\s*)begin(\\s+)';
  re_inject text :=
    E'\\1\\2begin\\3  perform public.assert_not_preview();\\3';
begin
  for r in
    select p.oid, p.proname, p.prosrc
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.prosecdef is true
       and p.prolang = (select oid from pg_language where lanname = 'plpgsql')
       and has_function_privilege('authenticated', p.oid, 'EXECUTE')
       and not (p.proname = any (skip))
       and p.proname !~ '^driver_'
       and p.prosrc !~* 'assert_not_preview'
       and (
         p.proname = any (force_helpers)
         or p.prosrc ~* 'insert[[:space:]]+into'
         or p.prosrc ~* 'update[[:space:]]+[a-z_][a-z0-9_.]*[[:space:]]+set'
         or p.prosrc ~* 'delete[[:space:]]+from'
       )
  loop
    def := pg_get_functiondef(r.oid);
    new_def := regexp_replace(def, re_first_begin, re_inject, 'i');
    if new_def is distinct from def and new_def ~ 'assert_not_preview' then
      execute new_def;
    end if;
  end loop;

  -- Naprawa: assert był, ale nie jako pierwsza instrukcja po pierwszym BEGIN.
  for r in
    select p.oid, p.proname, p.prosrc
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.prosecdef is true
       and p.prolang = (select oid from pg_language where lanname = 'plpgsql')
       and has_function_privilege('authenticated', p.oid, 'EXECUTE')
       and not (p.proname = any (skip))
       and p.proname !~ '^driver_'
       and p.prosrc ~* 'assert_not_preview'
       and regexp_replace(p.prosrc, E'^[\\s\\S]*?\\ybegin\\y', '', 'i')
             !~* '^\\s*perform\\s+public\\.assert_not_preview\\s*\\(\\s*\\)\\s*;'
  loop
    def := pg_get_functiondef(r.oid);
    def := regexp_replace(
      def,
      E'\\n\\s*perform\\s+public\\.assert_not_preview\\s*\\(\\s*\\)\\s*;',
      '',
      'gi'
    );
    new_def := regexp_replace(def, re_first_begin, re_inject, 'i');
    if new_def is distinct from def and new_def ~ 'assert_not_preview' then
      execute new_def;
    elsif regexp_replace(
            (select prosrc from pg_proc where oid = r.oid),
            E'^[\\s\\S]*?\\ybegin\\y', '', 'i'
          ) !~* '^\\s*perform\\s+public\\.assert_not_preview\\s*\\(\\s*\\)\\s*;'
    then
      raise exception 'B5: nie udało się wstawić assert_not_preview na początek %', r.proname;
    end if;
  end loop;
end $$;
