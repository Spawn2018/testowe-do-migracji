-- 0103 — DEC-2a: decision_types tylko dla aktywnego konta (session.sh: inactive = 0 wierszy).
--   Poprzednia polityka `using (active)` dotyczyła flagi typu, nie użytkownika → 16 wierszy katalogu
--   dla zdezaktywowanego konta. Idempotentna.

drop policy if exists decision_types_read on decision_types;
create policy decision_types_read on decision_types for select to authenticated using (
  active and current_app_user_id() is not null
);

drop policy if exists decisions_read on decisions;
create policy decisions_read on decisions for select to authenticated using (
  current_app_user_id() is not null
  and (
    is_hhl()
    or (current_org_kind() = 'CARRIER' and exists (
          select 1 from decision_types t where t.code = decisions.type_code and t.decider_role in ('CARRIER','HHL')))
  )
);

drop policy if exists decision_events_read on decision_events;
create policy decision_events_read on decision_events for select to authenticated using (
  current_app_user_id() is not null
  and exists (select 1 from decisions d where d.id = decision_events.decision_id)
);
