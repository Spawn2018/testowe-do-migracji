-- =====================================================================
-- TOWER — Migracja 0044: PR2-B — blokada współbieżności kopii zapasowej (backup-export).
--   27.09.2026: przebiegi id 3 i 4 wystartowały w odstępie 1 s (równolegle).
--   backup_run_begin(): pg_try_advisory_xact_lock + sprawdzenie trwającego przebiegu w JEDNEJ transakcji:
--     • blokada zajęta (dwa starty w tej samej chwili) → wiersz SKIPPED, funkcja kończy się od razu;
--     • trwa inny przebieg (RUNNING młodszy niż p_stale) → wiersz SKIPPED;
--     • inaczej → wiersz RUNNING (id przebiegu).
--   Blokada transakcyjna, nie sesyjna: połączenie funkcji Edge może iść przez pooler w trybie transakcji,
--   gdzie blokada sesyjna trafiłaby na przypadkowe połączenie serwera. „Trzymanie” blokady przez cały
--   przebieg = wiersz RUNNING; przebieg przerwany przez platformę (np. 546) po p_stale (30 min) → ERROR.
--   Idempotentna, niedestrukcyjna (rozszerza listę statusów, nie usuwa danych).
-- =====================================================================
alter table backup_runs drop constraint if exists backup_runs_status_check;
alter table backup_runs add constraint backup_runs_status_check
  check (status in ('RUNNING', 'OK', 'ERROR', 'SKIPPED'));

create or replace function public.backup_run_begin(p_stale interval default interval '30 minutes')
returns table (run_id bigint, run_status text)
language plpgsql security definer set search_path = public as $$
declare v_id bigint; v_other bigint;
begin
  if not pg_try_advisory_xact_lock(hashtext('tower-backup-export')) then
    insert into backup_runs (status, finished_at, error)
    values ('SKIPPED', now(), 'równoległy start — blokada zajęta przez inny przebieg')
    returning id into v_id;
    return query select v_id, 'SKIPPED'::text;
    return;
  end if;
  update backup_runs
     set status = 'ERROR', finished_at = now(),
         error = coalesce(error || ' · ', '') || 'przerwany: brak zakończenia w ' || p_stale::text
   where status = 'RUNNING' and started_at < now() - p_stale;
  select id into v_other from backup_runs where status = 'RUNNING' order by started_at desc limit 1;
  if v_other is not null then
    insert into backup_runs (status, finished_at, error)
    values ('SKIPPED', now(), 'trwa przebieg id=' || v_other)
    returning id into v_id;
    return query select v_id, 'SKIPPED'::text;
    return;
  end if;
  insert into backup_runs (status) values ('RUNNING') returning id into v_id;
  return query select v_id, 'RUNNING'::text;
end $$;
revoke all on function public.backup_run_begin(interval) from public, anon, authenticated;
