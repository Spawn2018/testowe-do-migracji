-- 0104 — DEC-3: powiadomienia o decyzjach (OPEN / RESOLVE / ESCALATE) + szkic macierzy widoczności (DEC-4).
--   decision_notify: IN_APP do aktywnych użytkowników HHL; gdy decyduje CARRIER — także przewoźnik.
--   KSH dostaje decyzje dopiero gdy macierz (§4) na to zezwoli (domyślnie: gdy decyduje — brak typów CLIENT).
--   Idempotentna. Bez wysyłki e-mail/SMS (kanał EMAIL wg macierzy — osobny job send-notifications).

create table if not exists notification_matrix (
  event_group   text not null,
  org_kind      text not null check (org_kind in ('FORWARDER','CARRIER','CLIENT')),
  in_app        boolean not null default true,
  email         boolean not null default false,
  primary key (event_group, org_kind)
);

alter table notification_matrix enable row level security;
revoke all on notification_matrix from anon;
revoke insert, update, delete, truncate on notification_matrix from authenticated;
grant select on notification_matrix to authenticated;

drop policy if exists notification_matrix_read on notification_matrix;
create policy notification_matrix_read on notification_matrix for select to authenticated using (
  current_app_user_id() is not null and is_hhl()
);

insert into notification_matrix (event_group, org_kind, in_app, email) values
  ('LOAD_STATUS', 'FORWARDER', true, false),
  ('LOAD_STATUS', 'CARRIER', true, false),
  ('LOAD_STATUS', 'CLIENT', true, false),
  ('RISK_FERRY_WEATHER', 'FORWARDER', true, false),
  ('RISK_FERRY_WEATHER', 'CARRIER', true, false),
  ('RISK_FERRY_WEATHER', 'CLIENT', true, false),
  ('DECISION', 'FORWARDER', true, true),
  ('DECISION', 'CARRIER', true, false),
  ('DECISION', 'CLIENT', false, false),
  ('MONEY', 'FORWARDER', true, false),
  ('MONEY', 'CARRIER', true, false),
  ('MONEY', 'CLIENT', true, false),
  ('SYSTEM', 'FORWARDER', true, true),
  ('SYSTEM', 'CARRIER', false, false),
  ('SYSTEM', 'CLIENT', false, false)
on conflict (event_group, org_kind) do nothing;

create or replace function public.decision_notify(p_decision uuid, p_event text)
returns int
language plpgsql security definer set search_path = public as $$
declare
  d decisions%rowtype;
  v_role text;
  n int := 0;
  v_tpl text;
begin
  select * into d from decisions where id = p_decision;
  if not found then return 0; end if;
  select decider_role into v_role from decision_types where code = d.type_code;
  v_tpl := case p_event
    when 'OPEN' then 'DECISION_OPEN'
    when 'RESOLVE' then 'DECISION_RESOLVED'
    when 'ESCALATE' then 'DECISION_ESCALATED'
    else 'DECISION_EVENT'
  end;
  insert into notifications (channel, recipient, user_id, load_id, template, payload, dedup_key)
  select 'IN_APP', coalesce(u.email::text, u.id::text), u.id, d.load_id, v_tpl,
         jsonb_build_object(
           'decision_id', d.id, 'type', d.type_code, 'title', d.title,
           'status', d.status, 'event', p_event, 'resolution', d.resolution_code,
           'locale', u.locale
         ),
         'dec:' || p_event || ':' || d.id::text || ':' || u.id::text
    from app_users u
    join organizations o on o.id = u.org_id
   where u.active
     and (
       (o.kind = 'FORWARDER' and exists (
          select 1 from notification_matrix m
           where m.event_group = 'DECISION' and m.org_kind = 'FORWARDER' and m.in_app))
       or (o.kind = 'CARRIER' and v_role = 'CARRIER' and exists (
          select 1 from notification_matrix m
           where m.event_group = 'DECISION' and m.org_kind = 'CARRIER' and m.in_app))
       or (o.kind = 'CLIENT' and v_role = 'ADMIN' and false)  -- rezerwa; KSH przez macierz później
     )
  on conflict (dedup_key) where dedup_key is not null do nothing;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.decision_notify(uuid, text) from public, anon, authenticated;

-- Przepisz open/resolve/expire/escalate: powiadomienie + audit przy resolve.
create or replace function decision_open(p_project uuid, p_type text, p_title text, p_detail jsonb default '{}'::jsonb,
                                         p_load uuid default null, p_risk uuid default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid; v_id uuid; v_due timestamptz; v_hours numeric; v_role text;
begin
  if (auth.uid() is not null) is not true then
    raise exception 'Decyzję otwiera zalogowany użytkownik lub job systemowy' using errcode = '42501';
  end if;
  select id into v_me from app_users where auth_id = auth.uid() and active;
  if (v_me is not null) is not true then
    raise exception 'Brak aktywnego konta' using errcode = '42501';
  end if;
  select due_hours, decider_role into v_hours, v_role from decision_types where code = p_type and active;
  if (v_role is not null) is not true then
    raise exception 'Nieznany typ decyzji %', p_type using errcode = '22023';
  end if;
  if v_hours is not null then v_due := now() + (v_hours::text || ' hours')::interval; end if;
  insert into decisions (project_id, type_code, title, detail, load_id, risk_id, due_at)
  values (p_project, p_type, p_title, coalesce(p_detail, '{}'::jsonb), p_load, p_risk, v_due)
  returning id into v_id;
  insert into decision_events (decision_id, actor_id, action, payload)
  values (v_id, v_me, 'OPEN', jsonb_build_object('type', p_type));
  perform decision_notify(v_id, 'OPEN');
  return v_id;
end $$;

create or replace function decision_resolve(p_decision uuid, p_option text, p_note text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid; d decisions%rowtype; v_opt jsonb; v_need boolean;
begin
  if (is_hhl() or current_org_kind() = 'CARRIER') is not true then
    raise exception 'Rozstrzygnięcie — HHL lub przewoźnik' using errcode = '42501';
  end if;
  select id into v_me from app_users where auth_id = auth.uid() and active;
  select * into d from decisions where id = p_decision for update;
  if not found then raise exception 'Brak decyzji' using errcode = '22023'; end if;
  if (d.status in ('NEW','ASSIGNED','SNOOZED')) is not true then
    raise exception 'Decyzja już zamknięta' using errcode = '22023';
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
  insert into decision_events (decision_id, actor_id, action, payload)
  values (p_decision, v_me, 'RESOLVE', jsonb_build_object('option', p_option, 'effect', v_opt->>'effect', 'note', p_note));
  insert into audit_log (user_id, action, entity, entity_id, new_value)
  values (v_me, 'DECISION_RESOLVE', 'decisions', p_decision::text,
          jsonb_build_object('option', p_option, 'effect', v_opt->>'effect', 'type', d.type_code));
  perform decision_notify(p_decision, 'RESOLVE');
end $$;

create or replace function public.decision_escalate_overdue()
returns int
language plpgsql security definer set search_path = public as $$
declare
  r record;
  n int := 0;
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
    if not exists (
      select 1 from risk_signals where dedup_key = 'decision-overdue:' || r.id::text and resolved_at is null
    ) then
      insert into risk_signals (project_id, load_id, kind, severity, title, title_key, detail, dedup_key, audience)
      values (
        r.project_id, r.load_id, 'JOB_FAILURE', 'HIGH',
        'Decyzja po terminie: ' || r.title,
        'rk_decision_overdue',
        jsonb_build_object('decision_id', r.id, 'type', r.type_code, 'params', jsonb_build_object('title', r.title)),
        'decision-overdue:' || r.id::text,
        'HHL'
      );
    end if;
    perform decision_notify(r.id, 'ESCALATE');
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.decision_escalate_overdue() from public, anon, authenticated;

revoke all on function decision_open(uuid, text, text, jsonb, uuid, uuid) from public, anon;
grant execute on function decision_open(uuid, text, text, jsonb, uuid, uuid) to authenticated;
revoke all on function decision_resolve(uuid, text, text) from public, anon;
grant execute on function decision_resolve(uuid, text, text) to authenticated;
