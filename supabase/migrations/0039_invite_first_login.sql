-- 0039 — ZAPR-LOGIN (decyzja właściciela 26.09.2026 18:30). Poprawka 0034: konto auth powstaje już przy
-- wysłaniu zaproszenia (signInWithOtp tworzy niepotwierdzonego użytkownika), więc sprawdzenie 7 dni
-- w handle_new_auth_user zawsze przechodziło, a „przyjęcie” zapisywało się przed kliknięciem.
--   1. handle_new_auth_user tworzy app_users, ale NIE oznacza przyjęcia i NIE pisze USER_ACCEPTED_INVITE.
--   2. Przyjęcie = pierwsze logowanie: auth.users.last_sign_in_at NULL → wartość (wyzwalacz)
--      → user_invites.accepted_at + audit USER_ACCEPTED_INVITE.
--   3. Zadanie dzienne pg_cron 'tower-wygasanie-zaproszen' (02:40 UTC): konto bez logowania, starsze niż
--      7 dni od (ostatniego) zaproszenia → app_users.active = false + audit USER_INVITE_EXPIRED.
--   4. admin_invite_user: konto, które nigdy się nie zalogowało, można zaprosić ponownie — reaktywacja
--      (active = true), odnowienie terminu zaproszenia, audit USER_REINVITED. Zalogowane konto — jak dotąd błąd.
-- Idempotentna, niedestrukcyjna. Bez auth.users (środowisko testowe bez atrapy) wyzwalacz pominięty.

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
  if inv.created_at < now() - make_interval(days => public.invite_valid_days()) then
    raise exception 'TOWER_INVITE_EXPIRED: zaproszenie wygasło (ważne % dni) — poproś administratora HHL o nowe',
      public.invite_valid_days() using errcode = '42501';
  end if;
  insert into public.app_users (auth_id, org_id, email, full_name, role, locale)
  values (new.id, inv.org_id, lower(new.email), inv.full_name, inv.role, inv.locale);
  -- przyjęcie zaproszenia dopiero przy pierwszym logowaniu (handle_auth_first_sign_in)
  return new;
end $$;

create or replace function public.handle_auth_first_sign_in()
returns trigger language plpgsql security definer set search_path = public as $$
declare inv public.user_invites%rowtype; u public.app_users%rowtype;
begin
  select * into u from public.app_users where auth_id = new.id;
  if not found or not u.active then return new; end if;          -- wygasłe konto: bez przyjęcia
  update public.user_invites set accepted_at = new.last_sign_in_at
   where email = lower(new.email)::citext and accepted_at is null
  returning * into inv;
  if found then
    insert into public.audit_log (user_id, action, entity, entity_id, new_value)
    values (inv.invited_by, 'USER_ACCEPTED_INVITE', 'app_users', new.id::text,
            jsonb_build_object('org_id', inv.org_id, 'role', inv.role, 'first_sign_in_at', new.last_sign_in_at));
  end if;
  return new;
end $$;
revoke all on function public.handle_auth_first_sign_in() from public, anon, authenticated;

do $trg$
begin
  if to_regclass('auth.users') is not null then
    drop trigger if exists tower_on_auth_user_first_sign_in on auth.users;
    create trigger tower_on_auth_user_first_sign_in
      after update of last_sign_in_at on auth.users
      for each row when (old.last_sign_in_at is null and new.last_sign_in_at is not null)
      execute function public.handle_auth_first_sign_in();
  else
    raise notice 'auth.users brak (środowisko testowe) — wyzwalacz pierwszego logowania pominięty';
  end if;
end $trg$;

-- Wygaszanie kont bez logowania (> 7 dni od ostatniego zaproszenia). Zadanie systemowe.
create or replace function public.expire_unaccepted_accounts(p_now timestamptz default now())
returns int language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  if to_regclass('auth.users') is null then return 0; end if;
  for r in execute
    'select u.id, u.email, a.created_at as auth_created, i.created_at as invited_at
       from public.app_users u
       join auth.users a on a.id = u.auth_id
       left join public.user_invites i on i.email = u.email::citext and i.accepted_at is null
      where u.active and a.last_sign_in_at is null
        and greatest(a.created_at, coalesce(i.created_at, a.created_at))
            < $1 - make_interval(days => public.invite_valid_days())
      for update of u'
    using p_now
  loop
    update public.app_users set active = false where id = r.id;
    insert into public.audit_log (user_id, action, entity, entity_id, new_value)
    values (null, 'USER_INVITE_EXPIRED', 'app_users', r.id::text,
            jsonb_build_object('active', false, 'invited_at', coalesce(r.invited_at, r.auth_created),
                               'valid_days', public.invite_valid_days()));
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.expire_unaccepted_accounts(timestamptz) from public, anon, authenticated;

-- Ponowne zaproszenie: konto bez logowania → reaktywacja + nowy termin 7 dni.
create or replace function admin_invite_user(
  p_email text, p_org_code text, p_role user_role,
  p_full_name text default null, p_locale text default 'pl')
returns uuid language plpgsql security definer set search_path = public as $$
declare v_org organizations%rowtype; v_id uuid; v_me uuid; v_user app_users%rowtype;
        v_signed boolean; v_reinvite boolean := false;
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
  if coalesce(p_locale,'pl') not in ('pl','en','sv') then raise exception 'Nieznany język'; end if;
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
  insert into user_invites (email, org_id, role, full_name, locale, invited_by)
  values (lower(p_email), v_org.id, p_role, p_full_name, coalesce(p_locale,'pl'), v_me)
  on conflict (email) do update
     set org_id = excluded.org_id, role = excluded.role, full_name = excluded.full_name,
         locale = excluded.locale, invited_by = excluded.invited_by, created_at = now()
   where user_invites.accepted_at is null
  returning id into v_id;
  if v_id is null then raise exception 'Zaproszenie już przyjęte'; end if;
  if v_reinvite then
    update app_users set active = true, org_id = v_org.id, role = p_role,
           full_name = coalesce(p_full_name, full_name), locale = coalesce(p_locale, locale)
     where id = v_user.id;
  end if;
  insert into audit_log (user_id, action, entity, entity_id, new_value)
  values (v_me, case when v_reinvite then 'USER_REINVITED' else 'USER_INVITED' end, 'user_invites', v_id::text,
          jsonb_build_object('org', v_org.code, 'role', p_role));
  return v_id;
end $$;
revoke execute on function admin_invite_user(text, text, user_role, text, text) from public, anon;
grant  execute on function admin_invite_user(text, text, user_role, text, text) to authenticated;

do $cron$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'tower-wygasanie-zaproszen';
    perform cron.schedule('tower-wygasanie-zaproszen', '40 2 * * *', 'select public.expire_unaccepted_accounts()');
  else
    raise notice 'pg_cron niedostępny — tower-wygasanie-zaproszen do zaplanowania ręcznie (środowisko testowe)';
  end if;
end $cron$;
