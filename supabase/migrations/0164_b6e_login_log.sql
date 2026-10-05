-- =====================================================================
-- TOWER — Migracja 0164: B-6e — dziennik logowań z własnej tabeli
--
-- Przyczyna (produkcja 05.10.2026): auth.audit_log_entries ma 0 wierszy. Supabase Auth
-- nie zapisuje już dziennika audytu do bazy projektu (trzyma go w logach platformy),
-- więc admin_auth_login_log (0110) zawsze zwracał pustą listę.
--
-- Naprawa:
--   • public.auth_login_events — jeden wiersz na nową sesję Auth (= udane logowanie:
--     link e-mail, hasło, kod). Kto (auth id, e-mail), kiedy, adres IP, przeglądarka.
--   • wyzwalacz AFTER INSERT na auth.sessions (warunkowo — w czystym Postgresie bez Auth
--     pomijany). Błąd zapisu nigdy nie blokuje logowania (wyjątek połknięty).
--   • jednorazowe uzupełnienie: bieżące sesje + ostatnie logowanie każdego konta
--     (auth.users.last_sign_in_at), jeśli nie ma go jeszcze w tabeli.
--   • admin_auth_login_log(p_limit) — ta sama nazwa i uprawnienia (tylko HHL_ADMIN),
--     czyta z nowej tabeli; dodatkowa kolumna user_agent. Gdyby platforma znów pisała
--     auth.audit_log_entries, wpisy nieudanych prób też są dołączane.
--   Nieudanych prób Supabase w bazie nie zapisuje — zostają w dzienniku platformy.
--   Tabela bez dostępu dla anon i authenticated (odczyt tylko funkcją). Idempotentna.
-- =====================================================================

create table if not exists public.auth_login_events (
  id            bigserial primary key,
  auth_user_id  uuid,
  email         text,
  created_at    timestamptz not null default now(),
  ip            text,
  user_agent    text,
  source        text not null default 'SESSION' check (source in ('SESSION', 'LAST_SIGN_IN')),
  session_id    uuid unique
);
create index if not exists auth_login_events_created_idx on public.auth_login_events (created_at desc);
alter table public.auth_login_events enable row level security;
revoke all on table public.auth_login_events from public, anon, authenticated;
revoke all on sequence public.auth_login_events_id_seq from public, anon, authenticated;

create or replace function public.tower_log_auth_session()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
begin
  begin
    if to_regclass('auth.users') is not null then
      execute 'select email::text from auth.users where id = $1' into v_email using new.user_id;
    end if;
    if v_email is null then
      select u.email into v_email from app_users u where u.auth_id = new.user_id limit 1;
    end if;
    insert into auth_login_events (auth_user_id, email, created_at, ip, user_agent, source, session_id)
    values (new.user_id, v_email, coalesce(new.created_at, now()),
            nullif(host(new.ip), ''), left(new.user_agent, 400), 'SESSION', new.id)
    on conflict (session_id) do nothing;
  exception when others then
    -- logowanie ma przejść zawsze; brak wpisu w dzienniku to mniejsze zło
    null;
  end;
  return new;
end $$;
revoke all on function public.tower_log_auth_session() from public, anon, authenticated;

do $$
begin
  if to_regclass('auth.sessions') is not null then
    drop trigger if exists tower_on_auth_session_created on auth.sessions;
    create trigger tower_on_auth_session_created
      after insert on auth.sessions
      for each row execute function public.tower_log_auth_session();

    -- uzupełnienie: sesje, które już są
    execute $q$
      insert into public.auth_login_events (auth_user_id, email, created_at, ip, user_agent, source, session_id)
      select s.user_id,
             coalesce((select u.email from public.app_users u where u.auth_id = s.user_id limit 1), null),
             coalesce(s.created_at, now()), nullif(host(s.ip), ''), left(s.user_agent, 400), 'SESSION', s.id
        from auth.sessions s
      on conflict (session_id) do nothing
    $q$;
  else
    raise notice 'auth.sessions brak (środowisko testowe) — wyzwalacz pominięty';
  end if;

  if to_regclass('auth.users') is not null then
    -- e-mail z Auth tam, gdzie app_users go nie dał
    execute $q$
      update public.auth_login_events e set email = u.email::text
        from auth.users u
       where e.email is null and u.id = e.auth_user_id
    $q$;
    -- ostatnie logowanie konta, jeśli nie ma go już jako sesji
    execute $q$
      insert into public.auth_login_events (auth_user_id, email, created_at, source)
      select u.id, u.email::text, u.last_sign_in_at, 'LAST_SIGN_IN'
        from auth.users u
       where u.last_sign_in_at is not null
         and not exists (
           select 1 from public.auth_login_events e
            where e.auth_user_id = u.id
              and e.created_at between u.last_sign_in_at - interval '2 minutes' and u.last_sign_in_at + interval '2 minutes')
    $q$;
  end if;
end $$;

drop function if exists public.admin_auth_login_log(int);
create function public.admin_auth_login_log(p_limit int default 50)
returns table (
  created_at timestamptz,
  ip_address text,
  action text,
  actor text,
  log_type text,
  email text,
  user_agent text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_lim int;
begin
  if (current_app_role() = 'HHL_ADMIN') is not true then
    raise exception 'Tylko administrator HHL' using errcode = '42501';
  end if;
  v_lim := least(greatest(coalesce(p_limit, 50), 1), 200);
  if to_regclass('auth.audit_log_entries') is not null then
    return query execute $q$
      select * from (
        select e.created_at, e.ip, 'login'::text, coalesce(e.email, ''), e.source, coalesce(e.email, ''), e.user_agent
          from public.auth_login_events e
        union all
        select a.created_at,
               nullif(btrim(coalesce(a.ip_address, '')), '')::text,
               coalesce(a.payload->>'action', a.payload->>'log_type', '')::text,
               coalesce(a.payload->>'actor_username', a.payload->'actor'->>'username', a.payload->>'email', '')::text,
               'AUDIT'::text,
               coalesce(a.payload->>'actor_username', a.payload->'actor'->>'username', a.payload->>'email', '')::text,
               null::text
          from auth.audit_log_entries a
         where coalesce(a.payload->>'action', '') !~* '^(login|token_refreshed|token_revoked)$'
      ) x
      order by 1 desc
      limit $1
    $q$ using v_lim;
  else
    return query
      select e.created_at, e.ip, 'login'::text, coalesce(e.email, ''), e.source, coalesce(e.email, ''), e.user_agent
        from auth_login_events e
       order by e.created_at desc
       limit v_lim;
  end if;
end $$;
revoke all on function public.admin_auth_login_log(int) from public, anon;
grant execute on function public.admin_auth_login_log(int) to authenticated;
