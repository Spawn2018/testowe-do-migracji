-- #413 / D-20261021-2057-01 — Automatyzacje i Strefy: podgląd HHL_OPS (E35 pkt 5, E34 pkt 6).
-- Migracja 0278: HHL_OPS czyta workflows (dotąd tylko HHL_ADMIN przez wf_all).
-- Usunięcie START-1…7 (E35 Z1) — osobny commit w tej samej pozycji (testy workflows/e25/import).
-- Strefy: zapis już tylko HHL_ADMIN (geofences_write); UI canEditGeofence — front.

select set_config('tower.audit_source', 'migracja 0278 (#413 Automatyzacje HHL_OPS)', true);

drop policy if exists workflows_read_ops on public.workflows;
create policy workflows_read_ops on public.workflows
  for select to authenticated
  using (current_app_role() = 'HHL_OPS');

do $g$
begin
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'workflows' and policyname = 'workflows_read_ops'
  ) then
    raise exception '0278: brak workflows_read_ops';
  end if;
  if (select polcmd from pg_policy p
        join pg_class c on c.oid = p.polrelid
       where c.relname = 'workflows' and p.polname = 'workflows_read_ops') is distinct from 'r' then
    raise exception '0278: workflows_read_ops musi być SELECT';
  end if;
end $g$;

comment on policy workflows_read_ops on public.workflows is
  '#413 E35 pkt 5: Operacje HHL — podgląd Automatyzacji; zapis zostaje wf_all (HHL_ADMIN).';
