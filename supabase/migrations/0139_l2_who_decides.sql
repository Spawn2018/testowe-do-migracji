-- =====================================================================
-- TOWER — Migracja 0139: L-2 — kto rozstrzyga decyzję
--
-- Katalog (decision_types.decider_role) mówi, która firma rozstrzyga.
-- Administrator HHL może rozstrzygnąć każdy typ. Odmowa jest w funkcji,
-- nie tylko w ukrytym przycisku. KSH i zła firma dostają błąd bazy.
-- =====================================================================

alter function public.l1_decision_type(text, jsonb) set search_path = public;

create or replace function public.l2_may_resolve(p_role text)
returns boolean
language sql
stable
set search_path = public
as $$
  select case
    when current_app_role() = 'HHL_ADMIN' then true
    when p_role = 'HHL' and current_org_kind() = 'FORWARDER' then true
    when p_role = 'CARRIER' and current_org_kind() = 'CARRIER' then true
    else false
  end;
$$;
comment on function public.l2_may_resolve(text) is
  'L-2: true, gdy bieżące konto jest firmą z katalogu albo administratorem HHL.';
revoke all on function public.l2_may_resolve(text) from public, anon, authenticated;

create or replace function decision_resolve(p_decision uuid, p_option text, p_note text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid; d decisions%rowtype; v_opt jsonb; v_need boolean;
  v_role text;
  v_fx jsonb;
begin
  if (current_app_user_id() is not null) is not true then
    raise exception 'Rozstrzygnięcie — tylko wskazana firma albo administrator' using errcode = '42501';
  end if;
  select id into v_me from app_users where id = current_app_user_id() and active;
  select * into d from decisions where id = p_decision for update;
  if not found then raise exception 'Brak decyzji' using errcode = '22023'; end if;
  if (d.status in ('NEW','ASSIGNED','SNOOZED')) is not true then
    raise exception 'Decyzja już zamknięta' using errcode = '22023';
  end if;
  select decider_role into v_role from decision_types where code = d.type_code;
  if (public.l2_may_resolve(v_role)) is not true then
    raise exception 'Rozstrzygnięcie — tylko wskazana firma albo administrator' using errcode = '42501';
  end if;
  select o into v_opt
    from decision_types t, jsonb_array_elements(t.options) o
   where t.code = d.type_code and o->>'code' = p_option;
  if v_opt is null then
    raise exception 'Nieznana opcja %', p_option using errcode = '22023';
  end if;
  v_need := coalesce((v_opt->>'requires_comment')::boolean, false);
  if v_need and length(coalesce(nullif(trim(p_note), ''), '')) < 3 then
    raise exception 'Ta opcja wymaga komentarza' using errcode = '22023';
  end if;
  update decisions set status = 'RESOLVED', resolved_at = now(), resolved_by = v_me,
    resolution_code = p_option, resolution_note = nullif(trim(p_note), ''),
    snooze_until = null, updated_at = now()
   where id = p_decision;
  v_fx := public.decision_apply_effect(p_decision, coalesce(v_opt->>'effect', 'ACCEPT'), p_option, p_note);
  insert into decision_events (decision_id, actor_id, action, payload)
  values (p_decision, v_me, 'RESOLVE',
          jsonb_build_object('option', p_option, 'effect', v_opt->>'effect', 'note', p_note, 'result', v_fx));
  insert into audit_log (user_id, action, entity, entity_id, new_value)
  values (v_me, 'DECISION_RESOLVE', 'decisions', p_decision::text,
          jsonb_build_object('option', p_option, 'effect', v_opt->>'effect', 'type', d.type_code, 'result', v_fx));
  perform decision_notify(p_decision, 'RESOLVE');
  return v_fx;
end $$;
revoke all on function decision_resolve(uuid, text, text) from public, anon;
grant execute on function decision_resolve(uuid, text, text) to authenticated;
