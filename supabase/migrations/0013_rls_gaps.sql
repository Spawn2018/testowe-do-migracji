-- =====================================================================
-- 0013 — luki RLS od 0001: tabele bez RLS czytelne (i zapisywalne) dla anon/authenticated
-- przez domyślne uprawnienia Supabase. Idempotentna, niedestrukcyjna (tylko uprawnienia).
--   geofence_states  — stan silnika stref (pisze process_position, security definer)
--   load_permits     — powiązanie transport ↔ zezwolenie
--   schedule_imports — historia importów harmonogramu (HHL)
--   workflow_runs    — dziennik reguł (system)
-- =====================================================================
alter table geofence_states  enable row level security;
alter table load_permits     enable row level security;
alter table schedule_imports enable row level security;
alter table workflow_runs    enable row level security;

revoke all on geofence_states, load_permits, schedule_imports, workflow_runs from anon;
revoke insert, update, delete, truncate on geofence_states, workflow_runs from authenticated;
grant select on geofence_states, load_permits, schedule_imports, workflow_runs to authenticated;

drop policy if exists geofence_states_read on geofence_states;
create policy geofence_states_read on geofence_states for select to authenticated
  using (is_hhl() or exists (select 1 from loads l where l.id = geofence_states.load_id));

drop policy if exists load_permits_read on load_permits;
create policy load_permits_read on load_permits for select to authenticated
  using (is_hhl() or exists (select 1 from loads l where l.id = load_permits.load_id));
drop policy if exists load_permits_write_hhl on load_permits;
create policy load_permits_write_hhl on load_permits for all to authenticated
  using (is_hhl()) with check (is_hhl());

drop policy if exists schedule_imports_hhl on schedule_imports;
create policy schedule_imports_hhl on schedule_imports for all to authenticated
  using (is_hhl()) with check (is_hhl());

drop policy if exists workflow_runs_read_hhl on workflow_runs;
create policy workflow_runs_read_hhl on workflow_runs for select to authenticated
  using (is_hhl());
