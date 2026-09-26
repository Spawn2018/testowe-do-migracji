-- =====================================================================
-- TOWER — Migracja 0026: ANEKS 5 §4 — sesja użytkownika 365 dni + odwoływanie
--
--   Plan darmowy nie ma limitu czasu sesji → rok budujemy sami:
--   purge_expired_sessions(): usuwa z auth.sessions sesje utworzone > 365 dni temu
--     (pg_cron raz dziennie, 'tower-sesje-rok'). Przy następnym odświeżeniu tokenu
--     użytkownik trafia na ekran logowania z komunikatem (aplikacja, PL/EN/SV).
--   JWT zostaje 3600 s (config) — rok żyje w sesji, którą da się usunąć.
--   revoke_user_sessions(p_user): „Wyloguj ze wszystkich urządzeń” — sam siebie każdy,
--     innego użytkownika wyłącznie HHL; wpis w audit_log.
--   my_sessions(): „Moje urządzenia” — przeglądarka, logowanie, wygaśnięcie, ostatnia aktywność.
--   Dezaktywacja (app_users.active → false): sesje usuwane od razu (wyzwalacz); funkcje RLS
--     current_app_role()/current_org_id() już zwracają pusto dla nieaktywnego (0001).
--   Kierowca bez zmian (token 2.3: 24 h po rozładunku, max 14 dni) — nie dotyczy.
--   Idempotentna, niedestrukcyjna (bez auth.sessions — np. czysty Postgres — funkcje zwracają 0).
-- =====================================================================

create or replace function purge_expired_sessions(p_days int default 365) returns int
language plpgsql security definer set search_path = public as $$
declare n int := 0;
begin
  if to_regclass('auth.sessions') is null then return 0; end if;
  execute 'delete from auth.sessions where created_at < now() - make_interval(days => $1)' using p_days;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function purge_expired_sessions(int) from public, anon, authenticated;

create or replace function revoke_user_sessions(p_user uuid default null) returns int
language plpgsql security definer set search_path = public as $$
declare v_me app_users; v_target app_users; n int := 0;
begin
  select * into v_me from app_users where auth_id = auth.uid() and active;
  if v_me.id is null then raise exception 'Brak aktywnego konta' using errcode = '42501'; end if;
  select * into v_target from app_users where id = coalesce(p_user, v_me.id);
  if v_target.id is null then raise exception 'Nieznany użytkownik' using errcode = '22023'; end if;
  if v_target.id <> v_me.id and v_me.role not in ('HHL_ADMIN', 'HHL_OPS') then
    raise exception 'Wylogować innego użytkownika może wyłącznie HHL' using errcode = '42501';
  end if;
  if to_regclass('auth.sessions') is not null then
    execute 'delete from auth.sessions where user_id = $1' using v_target.auth_id;
    get diagnostics n = row_count;
  end if;
  insert into audit_log (user_id, action, entity, entity_id, new_value)
  values (v_me.id, 'SESSIONS_REVOKE', 'app_users', v_target.id::text, jsonb_build_object('sessions', n));
  return n;
end $$;
revoke all on function revoke_user_sessions(uuid) from public, anon;
grant execute on function revoke_user_sessions(uuid) to authenticated;

create or replace function my_sessions()
returns table (id uuid, user_agent text, created_at timestamptz, expires_at timestamptz,
               last_active_at timestamptz, is_current boolean)
language plpgsql stable security definer set search_path = public as $$
declare v_sid text := nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'session_id';
begin
  if to_regclass('auth.sessions') is null then return; end if;
  if not exists (select 1 from app_users where auth_id = auth.uid() and active) then return; end if;
  return query execute
    'select s.id, s.user_agent, s.created_at, s.created_at + interval ''365 days'',
            coalesce(s.refreshed_at at time zone ''UTC'', s.updated_at, s.created_at), s.id::text = $2
       from auth.sessions s where s.user_id = $1 order by 5 desc'
    using auth.uid(), coalesce(v_sid, '');
end $$;
revoke all on function my_sessions() from public, anon;
grant execute on function my_sessions() to authenticated;

create or replace function trg_app_user_deactivated() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.active and not new.active and to_regclass('auth.sessions') is not null then
    execute 'delete from auth.sessions where user_id = $1' using new.auth_id;
  end if;
  return new;
end $$;
revoke all on function trg_app_user_deactivated() from public, anon, authenticated;
drop trigger if exists app_user_deactivated on app_users;
create trigger app_user_deactivated after update of active on app_users
  for each row execute function trg_app_user_deactivated();

do $cron$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('tower-sesje-rok', '20 2 * * *', 'select purge_expired_sessions()');
  else
    raise notice 'pg_cron niedostępny — tower-sesje-rok do zaplanowania ręcznie (środowisko testowe)';
  end if;
end $cron$;

-- Dezaktywacja = zero wierszy w każdej tabeli. Dotąd trzy polityki wpuszczały każdego
-- zalogowanego (także nieaktywnego): organizacje, projekty i własny wiersz app_users.
drop policy if exists orgs_read on organizations;
create policy orgs_read on organizations for select to authenticated using (current_app_role() is not null);
drop policy if exists projects_read on projects;
create policy projects_read on projects for select to authenticated using (current_app_role() is not null);
drop policy if exists users_self on app_users;
create policy users_self on app_users for select to authenticated using (
  (auth_id = auth.uid() and active) or is_hhl()
);
