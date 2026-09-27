-- =====================================================================
-- TOWER — Migracja 0075: resource_deadlines (0073) widoczne tylko dla aktywnego konta
--   (test session: zdezaktywowany użytkownik z ważnym tokenem widzi 0 wierszy we wszystkich tabelach). Idempotentna.
-- =====================================================================
drop policy if exists resource_deadlines_read on resource_deadlines;
create policy resource_deadlines_read on resource_deadlines for select to authenticated
  using (current_app_role() is not null);
