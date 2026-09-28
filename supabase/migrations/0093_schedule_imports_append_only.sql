-- 0093 — SCOPE 3.6 (audyt D4): historia wersji harmonogramu tylko do dopisywania.
-- Do tej pory polityka schedule_imports_hhl (0013) była FOR ALL, a authenticated miał INSERT/UPDATE/DELETE:
-- HHL mógł przez API poprawić lub usunąć wpis wersji (plik, skrót, statystyki) z pominięciem import_schedule.
-- Wersje zapisuje wyłącznie import_schedule (SECURITY DEFINER, search_path=public, tylko HHL), więc rolom API
-- zostaje sam odczyt (HHL). Archiwum plików (koszyk „harmonogramy”, 0047) już dziś ma tylko SELECT i INSERT dla HHL,
-- bez UPDATE/DELETE, a nazwa obiektu to skrót SHA-256 treści (upload bez upsert) — plik wersji jest niezmienny.
-- Idempotentna i nieniszcząca: bez zmian danych.

revoke insert, update, delete, truncate on schedule_imports from authenticated, anon;
grant select on schedule_imports to authenticated;

drop policy if exists schedule_imports_hhl on schedule_imports;
drop policy if exists schedule_imports_hhl_read on schedule_imports;
create policy schedule_imports_hhl_read on schedule_imports for select to authenticated using (is_hhl());

do $g$
begin
  if (select not (has_table_privilege('authenticated', 'schedule_imports', 'update')
          or has_table_privilege('authenticated', 'schedule_imports', 'delete')
          or has_table_privilege('authenticated', 'schedule_imports', 'insert'))) is not true then
    raise exception '0093: authenticated nadal może zmieniać schedule_imports';
  end if;
  if (select count(*) from pg_policy where polrelid = 'schedule_imports'::regclass and polcmd <> 'r') <> 0 then
    raise exception '0093: została polityka zapisu na schedule_imports';
  end if;
  if (select prosecdef from pg_proc where proname = 'import_schedule' limit 1) is not true then
    raise exception '0093: import_schedule musi być SECURITY DEFINER (zapis wersji po odebraniu uprawnień)';
  end if;
end $g$;
