-- 0263 — #446 pkt 1 / F7: tylko nowe wartości enum sailing_status.
-- Użycie (funkcja, trigger, backfill) w 0264 — Postgres nie pozwala użyć
-- nowej wartości enum w tej samej transakcji co ALTER TYPE (55P04;
-- komentarz w 0205_p4_e25_status_codes.sql). supabase db push = jedna
-- transakcja na plik.

alter type public.sailing_status add value if not exists 'W_REJSIE';
alter type public.sailing_status add value if not exists 'DOPLYNAL';
