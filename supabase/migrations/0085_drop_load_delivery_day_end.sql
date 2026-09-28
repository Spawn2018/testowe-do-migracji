-- =====================================================================
-- 0085 — I-28 (P2): usunięcie load_delivery_day_end (0070).
--   Od 0080 nieużywana (refresh_load_eta liczy od load_delivery_deadline — koniec okna, a bez okna
--   koniec dnia dostawy). Ignorowała okno dostawy, więc jej przypadkowe użycie dałoby błędne opóźnienie.
--   Sprawdzone przed usunięciem: 0 odwołań w funkcjach bazy (prosrc), 0 zależności pg_depend,
--   0 odwołań w kodzie aplikacji, Edge i testach.
--   Idempotentna.
-- =====================================================================
drop function if exists load_delivery_day_end(date, timestamptz);
