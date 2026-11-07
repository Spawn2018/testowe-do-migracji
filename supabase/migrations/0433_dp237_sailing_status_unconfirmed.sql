-- DP-237 / decyzja 114 (F7 #885): status rejsu domkniętego dowodem floty
-- bez potwierdzenia ATD/ATA — nie wygląda jak odbyty DOPLYNAL.
-- Użycie (backfill / job) w 0434 — Postgres: nowa wartość enum dopiero
-- w kolejnej transakcji (jak 0263).

alter type public.sailing_status add value if not exists 'ZAMKNIETY_BEZ_POTWIERDZENIA';
