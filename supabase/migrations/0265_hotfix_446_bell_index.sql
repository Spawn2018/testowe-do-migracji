-- #446 pkt 2 — indeks dzwonka (user_id, channel, created_at desc).
-- Zapytanie frontu (supabaseProvider notificationsQuery): channel='IN_APP'
-- + RLS user_id, order created_at desc, limit 200.
--
-- Zgłoszenie prosi o CREATE INDEX CONCURRENTLY. `supabase db push` (deploy-main)
-- owija plik w transakcję/pipeline → SQLSTATE 25001 na CONCURRENTLY.
-- gate.sh używa psql -f (bez transakcji), ale produkcja idzie przez db push.
-- Dlatego: zwykły CREATE INDEX IF NOT EXISTS (krótka blokada SHARE).
-- Na TEST indeks zbudowano concurrently poza migracją (EXPLAIN w POSTEP).

create index if not exists notifications_bell_user_channel_created_idx
  on public.notifications (user_id, channel, created_at desc);

comment on index public.notifications_bell_user_channel_created_idx is
  '#446: dzwonek IN_APP po user_id + created_at desc.';
