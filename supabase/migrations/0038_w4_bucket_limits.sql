-- 0038 — W4 (NISKA): limity rozmiaru zasobników. zdjecia 15 → 2 MB (kompresja daje ok. 0,24 MB; limit chroni
-- przed starą wersją aplikacji), dokumenty 20 → 10 MB (reguła PDF z aneksu 4). faktury bez zmian (20 MB).
-- Idempotentna; bez schematu storage (środowisko testowe) — pominięta.
do $$
begin
  if to_regclass('storage.buckets') is null then return; end if;
  update storage.buckets set file_size_limit = 2097152  where id = 'zdjecia'   and file_size_limit is distinct from 2097152;
  update storage.buckets set file_size_limit = 10485760 where id = 'dokumenty' and file_size_limit is distinct from 10485760;
end $$;
