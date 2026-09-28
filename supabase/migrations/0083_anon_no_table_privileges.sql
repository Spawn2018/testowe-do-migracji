-- =====================================================================
-- 0083 — I-26 (P1): anon bez żadnych uprawnień do tabel i sekwencji w `public`.
--   Przed 0083 anon miał INSERT/UPDATE/DELETE/TRUNCATE na ~20 tabelach (loads, invoices, invoice_lines,
--   organizations, projects, documents …) — zatrzymywało go tylko RLS (wzorzec `permits` sprzed 0081).
--   anon korzysta wyłącznie z funkcji SECURITY DEFINER z listy (driver_*, keep_alive, sms_*, report_client_error),
--   więc nie potrzebuje żadnego uprawnienia tabelowego.
--   Wyjątek: `spatial_ref_sys` (PostGIS; tylko do odczytu, zapis blokuje wyzwalacz 0031) — bez zmian.
--   Na produkcji widoki PostGIS `geometry_columns` / `geography_columns` należą do supabase_admin (migracje
--   działają jako postgres) — nie da się ich zmienić; to widoki metadanych katalogu, nieaktualizowalne.
--   authenticated: TRUNCATE (omija RLS!), REFERENCES i TRIGGER nie są potrzebne aplikacji — odebrane.
--   Domyślne uprawnienia (ALTER DEFAULT PRIVILEGES) — nowe tabele / sekwencje nie oddadzą ich z powrotem.
--   Idempotentna.
-- =====================================================================
do $$
declare r record;
begin
  for r in
    select c.oid::regclass as rel, c.relkind
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'f', 'S')
       and c.relname <> 'spatial_ref_sys'
       and pg_has_role(current_user, c.relowner, 'USAGE')   -- widoki PostGIS supabase_admin (geometry_columns …) — poza zasięgiem
  loop
    begin
      execute format('revoke all on %s from anon', r.rel);
      if r.relkind <> 'S' then
        execute format('revoke truncate, references, trigger on %s from authenticated', r.rel);
      end if;
    exception when insufficient_privilege then
      raise notice 'I-26: pominięto % (brak uprawnień właściciela)', r.rel;
    end;
  end loop;
end $$;

-- nowe obiekty tworzone przez postgres (migracje) i — jeśli wolno — supabase_admin
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;
alter default privileges for role postgres in schema public revoke truncate, references, trigger on tables from authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'supabase_admin') then
    execute 'alter default privileges for role supabase_admin in schema public revoke all on tables from anon';
    execute 'alter default privileges for role supabase_admin in schema public revoke all on sequences from anon';
    execute 'alter default privileges for role supabase_admin in schema public revoke truncate, references, trigger on tables from authenticated';
  end if;
exception when insufficient_privilege then
  raise notice 'I-26: domyślne uprawnienia supabase_admin bez zmian (brak członkostwa)';
end $$;
