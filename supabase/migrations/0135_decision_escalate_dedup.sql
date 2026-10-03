-- =====================================================================
-- TOWER — Migracja 0135: odsiew duplikatu ryzyka „decyzja po terminie”
--
--   decision_escalate_overdue wstawia risk_signals. Dotychczas tylko
--   sprawdzenie exists z kluczem złożonym w locie. Test 9.8 wymaga
--   v_key oraz on conflict do nothing (unikalny indeks z 0001).
--   Nie nakładać na produkcję w tym kroku — najpierw brama TEST.
-- =====================================================================

create or replace function public.decision_escalate_overdue()
returns int
language plpgsql security definer set search_path = public as $$
declare
  r record;
  n int := 0;
  v_key text;
begin
  for r in
    select d.id, d.project_id, d.type_code, d.title, d.load_id, d.due_at
      from decisions d
     where d.status in ('NEW','ASSIGNED','SNOOZED')
       and d.due_at is not null
       and d.due_at < now()
       and d.escalated_at is null
       and (d.status <> 'SNOOZED' or d.snooze_until is null or d.snooze_until < now())
  loop
    update decisions set escalated_at = now(), updated_at = now() where id = r.id;
    insert into decision_events (decision_id, actor_id, action, payload)
    values (r.id, null, 'ESCALATE', jsonb_build_object('due_at', r.due_at, 'type', r.type_code));
    v_key := 'decision-overdue:' || r.id::text;
    if not exists (
      select 1 from risk_signals where dedup_key = v_key and resolved_at is null
    ) then
      insert into risk_signals (project_id, load_id, kind, severity, title, title_key, detail, dedup_key, audience)
      values (
        r.project_id, r.load_id, 'JOB_FAILURE', 'HIGH',
        'Decyzja po terminie: ' || r.title,
        'rk_decision_overdue',
        jsonb_build_object('decision_id', r.id, 'type', r.type_code, 'params', jsonb_build_object('title', r.title)),
        v_key,
        'HHL'
      )
      on conflict (dedup_key) where dedup_key is not null and resolved_at is null do nothing;
    end if;
    perform decision_notify(r.id, 'ESCALATE');
    n := n + 1;
  end loop;
  return n;
end $$;

revoke all on function public.decision_escalate_overdue() from public, anon, authenticated;
