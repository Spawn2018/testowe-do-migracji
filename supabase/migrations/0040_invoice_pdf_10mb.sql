-- 0040 — FAKTURY-10MB (decyzja właściciela 26.09.2026 18:30): zasobnik faktury 20 → 10 MB, jak wszystkie PDF
-- (aneks 4 PR7). create_document odrzuca PDF > 10 MB od 0029; aplikacja sprawdza rozmiar przed wysłaniem
-- (checkBill → PDF_SIZE). Idempotentna; bez schematu storage (środowisko testowe) — pominięta.
do $$
begin
  if to_regclass('storage.buckets') is null then return; end if;
  update storage.buckets set file_size_limit = 10485760 where id = 'faktury' and file_size_limit is distinct from 10485760;
end $$;
