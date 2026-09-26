-- =====================================================================
-- TOWER — Migracja 0023: ANEKS 4 PR2 — historia kopii zapasowych (backup-export)
--   backup_runs: każdy przebieg (status, prefiks w R2, liczby wierszy, pliki, bajty, błąd).
--   Dostęp: odczyt HHL (widok stanu kopii), zapis wyłącznie funkcja Edge (service role).
--   Harmonogram 02:30 — supabase/sql/cron_backup.sql (na produkcji, po ustawieniu sekretów).
--   Idempotentna, niedestrukcyjna.
-- =====================================================================
create table if not exists backup_runs (
  id          bigserial primary key,
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  status      text not null default 'RUNNING' check (status in ('RUNNING', 'OK', 'ERROR')),
  prefix      text,
  tables      jsonb,
  files       int,
  bytes       bigint,
  error       text
);
alter table backup_runs enable row level security;
revoke all on backup_runs from anon, authenticated;
grant select on backup_runs to authenticated;
drop policy if exists backup_runs_read on backup_runs;
create policy backup_runs_read on backup_runs for select to authenticated using (is_hhl());
