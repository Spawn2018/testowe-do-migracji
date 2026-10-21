-- Atrapa środowiska Supabase do testów na czystym Postgresie.
-- auth.uid() czyta identyfikator z ustawienia sesji, co pozwala
-- podszyć się pod dowolnego użytkownika w teście.
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
end $$;
create schema if not exists auth;
-- Jak produkcja (PostgREST): coalesce(claim.sub, claims->>'sub').
create or replace function auth.uid() returns uuid language sql stable as
  $$ select nullif(coalesce(
       nullif(current_setting('request.jwt.claim.sub', true), ''),
       nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
     ), '')::uuid $$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
grant usage on schema public to anon, authenticated;
-- jak w Supabase: nowe obiekty dostępne dla ról API, o wierszach decyduje RLS
alter default privileges in schema public grant all on tables    to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;
alter default privileges in schema public grant execute on functions to anon, authenticated;

-- ANEKS 5 §4: atrapa auth.sessions (kolumny jak w GoTrue) — testy sesji rocznej i odwoływania.
create table if not exists auth.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  not_after timestamptz,
  refreshed_at timestamp,
  user_agent text,
  ip inet
);
