-- 0102 — DEC-2: centrum decyzji (katalog typów + proces Nowa→…→Rozstrzygnięta/Wygasła).
--   decision_types — 16 typów z ZLECENIE_DECYZJE_POWIADOMIENIA §2 (opcje w jsonb, bez kwot).
--   decisions — instancje powiązane z ryzykiem/transportem; append-only historii w decision_events.
--   RPC: decision_open, decision_assign, decision_snooze, decision_resolve, decision_expire.
--   Idempotentna, niedestrukcyjna. Migracja NIE wstawia danych osobowych.

do $$ begin
  if not exists (select 1 from pg_type where typname = 'decision_status') then
    create type decision_status as enum (
      'NEW', 'ASSIGNED', 'SNOOZED', 'RESOLVED', 'EXPIRED'
    );
  end if;
end $$;

create table if not exists decision_types (
  code            text primary key,
  title_key       text not null,
  decider_role    text not null check (decider_role in ('HHL','CARRIER','ADMIN')),
  options         jsonb not null,  -- [{code, label_key, requires_comment, effect}]
  due_hours       numeric(8,2),    -- null = przed zdarzeniem biznesowym (opis w note)
  due_note        text,
  severity_default text not null default 'WARNING' check (severity_default in ('INFO','WARNING','CRITICAL')),
  active          boolean not null default true,
  sort_order      int not null default 0
);

create table if not exists decisions (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references projects(id),
  type_code       text not null references decision_types(code),
  status          decision_status not null default 'NEW',
  risk_id         uuid references risk_signals(id),
  load_id         uuid references loads(id),
  title           text not null,
  detail          jsonb not null default '{}'::jsonb,
  assignee_id     uuid references app_users(id),
  due_at          timestamptz,
  snooze_until    timestamptz,
  resolved_at     timestamptz,
  resolved_by     uuid references app_users(id),
  resolution_code text,
  resolution_note text,
  expired_reason  text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check ((status = 'RESOLVED') = (resolved_at is not null)),
  check ((status = 'EXPIRED') = (expired_reason is not null))
);
create index if not exists decisions_open_idx on decisions (project_id, status, due_at)
  where status in ('NEW','ASSIGNED','SNOOZED');
create index if not exists decisions_load_idx on decisions (load_id) where load_id is not null;
create index if not exists decisions_risk_idx on decisions (risk_id) where risk_id is not null;

create table if not exists decision_events (
  id           bigserial primary key,
  decision_id  uuid not null references decisions(id),
  at           timestamptz not null default now(),
  actor_id     uuid references app_users(id),
  action       text not null,  -- OPEN|ASSIGN|SNOOZE|RESOLVE|EXPIRE|ESCALATE
  payload      jsonb not null default '{}'::jsonb
);
create index if not exists decision_events_decision_idx on decision_events (decision_id, at desc);

alter table decision_types enable row level security;
alter table decisions enable row level security;
alter table decision_events enable row level security;
revoke all on decision_types, decisions, decision_events from anon;
revoke insert, update, delete, truncate on decision_types, decisions, decision_events from authenticated;
grant select on decision_types, decisions, decision_events to authenticated;

drop policy if exists decision_types_read on decision_types;
create policy decision_types_read on decision_types for select to authenticated using (active);

drop policy if exists decisions_read on decisions;
create policy decisions_read on decisions for select to authenticated using (
  is_hhl()
  or (current_org_kind() = 'CARRIER' and exists (
        select 1 from decision_types t where t.code = decisions.type_code and t.decider_role in ('CARRIER','HHL')))
  or (current_org_kind() = 'CLIENT' and false)  -- KSH widzi przez powiadomienia (DEC-3/4); nie listę decyzji
);

drop policy if exists decision_events_read on decision_events;
create policy decision_events_read on decision_events for select to authenticated using (
  exists (select 1 from decisions d where d.id = decision_events.decision_id)
);

-- Katalog minimum (16 typów) — upsert po code
insert into decision_types (code, title_key, decider_role, options, due_hours, due_note, severity_default, sort_order) values
 ('FERRY_CANCELLED', 'dec_type_FERRY_CANCELLED', 'CARRIER',
  '[{"code":"NEXT_SAME","label_key":"dec_opt_NEXT_SAME","requires_comment":false,"effect":"CHANGE_SAILING"},{"code":"OTHER_OPERATOR","label_key":"dec_opt_OTHER_OPERATOR","requires_comment":false,"effect":"CHANGE_SAILING"},{"code":"HOLD","label_key":"dec_opt_HOLD","requires_comment":true,"effect":"HOLD"}]'::jsonb,
  null, 'przed odprawą', 'CRITICAL', 1),
 ('ETA_AFTER_LATEST', 'dec_type_ETA_AFTER_LATEST', 'HHL',
  '[{"code":"NOTIFY_KSH","label_key":"dec_opt_NOTIFY_KSH","requires_comment":false,"effect":"NOTIFY"},{"code":"ACCEPT_SILENT","label_key":"dec_opt_ACCEPT_SILENT","requires_comment":true,"effect":"ACCEPT"},{"code":"ESCALATE_CARRIER","label_key":"dec_opt_ESCALATE_CARRIER","requires_comment":false,"effect":"ESCALATE"}]'::jsonb,
  2, null, 'WARNING', 2),
 ('KSH_DATE_LT_5D', 'dec_type_KSH_DATE_LT_5D', 'CARRIER',
  '[{"code":"ACCEPT","label_key":"dec_opt_ACCEPT","requires_comment":false,"effect":"ACCEPT"},{"code":"PROPOSE_DATE","label_key":"dec_opt_PROPOSE_DATE","requires_comment":true,"effect":"PROPOSE"},{"code":"ESCALATE_HHL","label_key":"dec_opt_ESCALATE_HHL","requires_comment":false,"effect":"ESCALATE"}]'::jsonb,
  24, null, 'WARNING', 3),
 ('NO_AWIZACJA', 'dec_type_NO_AWIZACJA', 'CARRIER',
  '[{"code":"ADD_AWIZACJA","label_key":"dec_opt_ADD_AWIZACJA","requires_comment":false,"effect":"OPEN_AWIZACJA"},{"code":"REPORT_PROBLEM","label_key":"dec_opt_REPORT_PROBLEM","requires_comment":true,"effect":"ESCALATE"}]'::jsonb,
  null, 'termin awizacji', 'WARNING', 4),
 ('DOC_MISSING', 'dec_type_DOC_MISSING', 'CARRIER',
  '[{"code":"ADD_PERMIT","label_key":"dec_opt_ADD_PERMIT","requires_comment":false,"effect":"OPEN_DOC"},{"code":"HOLD","label_key":"dec_opt_HOLD","requires_comment":true,"effect":"HOLD"}]'::jsonb,
  null, 'przed załadunkiem', 'CRITICAL', 5),
 ('KSH_ROW_GONE', 'dec_type_KSH_ROW_GONE', 'HHL',
  '[{"code":"CANCEL_WARN_FEE","label_key":"dec_opt_CANCEL_WARN_FEE","requires_comment":true,"effect":"CANCEL"},{"code":"KEEP_ASK_KSH","label_key":"dec_opt_KEEP_ASK_KSH","requires_comment":false,"effect":"EMAIL_KSH"}]'::jsonb,
  24, null, 'WARNING', 6),
 ('TOWER_KSH_CONFLICT', 'dec_type_TOWER_KSH_CONFLICT', 'HHL',
  '[{"code":"KEEP_TOWER","label_key":"dec_opt_KEEP_TOWER","requires_comment":false,"effect":"KEEP_TOWER"},{"code":"TAKE_FILE","label_key":"dec_opt_TAKE_FILE","requires_comment":false,"effect":"TAKE_FILE"}]'::jsonb,
  24, null, 'WARNING', 7),
 ('KSH_FILE_ERROR', 'dec_type_KSH_FILE_ERROR', 'HHL',
  '[{"code":"ASK_FIX","label_key":"dec_opt_ASK_FIX","requires_comment":false,"effect":"EMAIL_KSH"},{"code":"SKIP_ROW","label_key":"dec_opt_SKIP_ROW","requires_comment":true,"effect":"SKIP"}]'::jsonb,
  48, null, 'INFO', 8),
 ('NO_POSITION', 'dec_type_NO_POSITION', 'CARRIER',
  '[{"code":"MANUAL_STATUS","label_key":"dec_opt_MANUAL_STATUS","requires_comment":true,"effect":"MANUAL_STATUS"},{"code":"REPORT_PROBLEM","label_key":"dec_opt_REPORT_PROBLEM","requires_comment":true,"effect":"ESCALATE"}]'::jsonb,
  1, null, 'WARNING', 9),
 ('ROUTE_DEVIATION', 'dec_type_ROUTE_DEVIATION', 'CARRIER',
  '[{"code":"DETOUR_OK","label_key":"dec_opt_DETOUR_OK","requires_comment":true,"effect":"DETOUR"},{"code":"REPORT_PROBLEM","label_key":"dec_opt_REPORT_PROBLEM","requires_comment":true,"effect":"ESCALATE"}]'::jsonb,
  1, null, 'CRITICAL', 10),
 ('SEFS_OUT_OF_TABLE', 'dec_type_SEFS_OUT_OF_TABLE', 'HHL',
  '[{"code":"EXTEND_14D","label_key":"dec_opt_EXTEND_14D","requires_comment":false,"effect":"SEFS_EXTEND"},{"code":"LAST_MULT","label_key":"dec_opt_LAST_MULT","requires_comment":false,"effect":"SEFS_LAST"}]'::jsonb,
  336, null, 'WARNING', 11),
 ('SEFS_INVOICE_DIFF', 'dec_type_SEFS_INVOICE_DIFF', 'HHL',
  '[{"code":"ACCEPT","label_key":"dec_opt_ACCEPT","requires_comment":true,"effect":"ACCEPT"},{"code":"DISPUTE","label_key":"dec_opt_DISPUTE","requires_comment":true,"effect":"DISPUTE"}]'::jsonb,
  168, null, 'WARNING', 12),
 ('KR_OVER_3', 'dec_type_KR_OVER_3', 'HHL',
  '[{"code":"PRICE_AS_3","label_key":"dec_opt_PRICE_AS_3","requires_comment":false,"effect":"PRICE_CAP3"},{"code":"MANUAL_PRICE","label_key":"dec_opt_MANUAL_PRICE","requires_comment":true,"effect":"MANUAL_PRICE"}]'::jsonb,
  null, 'przed fakturą', 'WARNING', 13),
 ('INSURANCE_EXPIRING', 'dec_type_INSURANCE_EXPIRING', 'CARRIER',
  '[{"code":"UPLOAD_POLICY","label_key":"dec_opt_UPLOAD_POLICY","requires_comment":false,"effect":"OPEN_DOC"}]'::jsonb,
  null, 'data wygaśnięcia', 'WARNING', 14),
 ('DWELL_OVER_FREE', 'dec_type_DWELL_OVER_FREE', 'HHL',
  '[{"code":"ADD_FEE","label_key":"dec_opt_ADD_FEE","requires_comment":true,"effect":"ADD_FEE"},{"code":"NOT_APPLICABLE","label_key":"dec_opt_NOT_APPLICABLE","requires_comment":true,"effect":"SKIP"}]'::jsonb,
  null, 'przed fakturą', 'INFO', 15),
 ('BACKUP_FAILED', 'dec_type_BACKUP_FAILED', 'ADMIN',
  '[{"code":"RETRY_NOW","label_key":"dec_opt_RETRY_NOW","requires_comment":false,"effect":"BACKUP_RETRY"},{"code":"REPORT","label_key":"dec_opt_REPORT","requires_comment":true,"effect":"ESCALATE"}]'::jsonb,
  1, null, 'CRITICAL', 16)
on conflict (code) do update set
  title_key = excluded.title_key,
  decider_role = excluded.decider_role,
  options = excluded.options,
  due_hours = excluded.due_hours,
  due_note = excluded.due_note,
  severity_default = excluded.severity_default,
  sort_order = excluded.sort_order,
  active = true;

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
  return v_id;
end $$;

create or replace function decision_assign(p_decision uuid, p_assignee uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare v_me uuid; v_st decision_status;
begin
  if (is_hhl() or current_org_kind() = 'CARRIER') is not true then
    raise exception 'Przypisanie decyzji — HHL lub przewoźnik' using errcode = '42501';
  end if;
  select id into v_me from app_users where auth_id = auth.uid() and active;
  select status into v_st from decisions where id = p_decision for update;
  if (v_st in ('NEW','ASSIGNED','SNOOZED')) is not true then
    raise exception 'Decyzja nie jest otwarta' using errcode = '22023';
  end if;
  update decisions set status = 'ASSIGNED', assignee_id = p_assignee, updated_at = now() where id = p_decision;
  insert into decision_events (decision_id, actor_id, action, payload)
  values (p_decision, v_me, 'ASSIGN', jsonb_build_object('assignee', p_assignee));
end $$;

create or replace function decision_snooze(p_decision uuid, p_until timestamptz)
returns void
language plpgsql security definer set search_path = public as $$
declare v_me uuid; v_st decision_status;
begin
  if (is_hhl() or current_org_kind() = 'CARRIER') is not true then
    raise exception 'Odłożenie decyzji — HHL lub przewoźnik' using errcode = '42501';
  end if;
  if (p_until > now()) is not true then
    raise exception 'Odłóż do przyszłości' using errcode = '22023';
  end if;
  select id into v_me from app_users where auth_id = auth.uid() and active;
  select status into v_st from decisions where id = p_decision for update;
  if (v_st in ('NEW','ASSIGNED','SNOOZED')) is not true then
    raise exception 'Decyzja nie jest otwarta' using errcode = '22023';
  end if;
  update decisions set status = 'SNOOZED', snooze_until = p_until, updated_at = now() where id = p_decision;
  insert into decision_events (decision_id, actor_id, action, payload)
  values (p_decision, v_me, 'SNOOZE', jsonb_build_object('until', p_until));
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
end $$;

create or replace function decision_expire(p_decision uuid, p_reason text)
returns void
language plpgsql security definer set search_path = public as $$
declare v_me uuid; v_st decision_status;
begin
  -- wygaszenie: HHL albo job (brak JWT → system)
  if auth.uid() is not null and (is_hhl()) is not true then
    raise exception 'Wygaszenie — HHL lub system' using errcode = '42501';
  end if;
  select id into v_me from app_users where auth_id = auth.uid() and active;
  select status into v_st from decisions where id = p_decision for update;
  if (v_st in ('NEW','ASSIGNED','SNOOZED')) is not true then
    raise exception 'Decyzja nie jest otwarta' using errcode = '22023';
  end if;
  if length(coalesce(nullif(trim(p_reason), ''), '')) < 3 then
    raise exception 'Powód wygaśnięcia wymagany' using errcode = '22023';
  end if;
  update decisions set status = 'EXPIRED', expired_reason = trim(p_reason), updated_at = now() where id = p_decision;
  insert into decision_events (decision_id, actor_id, action, payload)
  values (p_decision, v_me, 'EXPIRE', jsonb_build_object('reason', p_reason));
end $$;

revoke all on function decision_open(uuid, text, text, jsonb, uuid, uuid) from public, anon;
grant execute on function decision_open(uuid, text, text, jsonb, uuid, uuid) to authenticated;
revoke all on function decision_assign(uuid, uuid) from public, anon;
grant execute on function decision_assign(uuid, uuid) to authenticated;
revoke all on function decision_snooze(uuid, timestamptz) from public, anon;
grant execute on function decision_snooze(uuid, timestamptz) to authenticated;
revoke all on function decision_resolve(uuid, text, text) from public, anon;
grant execute on function decision_resolve(uuid, text, text) to authenticated;
revoke all on function decision_expire(uuid, text) from public, anon;
grant execute on function decision_expire(uuid, text) to authenticated;

-- I-30 helper: konwój KR tylko dla HHL (wcześniej bez strażnika — nullguard + allowlist)
create or replace function public.kr_convoy_count(p_load uuid) returns int
language plpgsql stable security definer set search_path = public as $$
declare
  v_project uuid;
  v_day date;
  v_n int;
begin
  if (is_hhl()) is not true then
    raise exception 'Liczba konwoju KR — wyłącznie HHL' using errcode = '42501';
  end if;
  select project_id, plan_load_date into v_project, v_day from loads where id = p_load;
  if (v_project is not null and v_day is not null) is not true then
    return null;
  end if;
  select count(distinct l.id)::int into v_n
    from loads l
    join shipment_items si on si.load_id = l.id
   where l.project_id = v_project
     and l.plan_load_date = v_day
     and l.status is distinct from 'CANCELLED'
     and shipment_family(si.shipment_code) = 'KR';
  return v_n;
end $$;
revoke all on function public.kr_convoy_count(uuid) from public, anon, authenticated;
grant execute on function public.kr_convoy_count(uuid) to authenticated;

-- Eskalacja po terminie (cron): jedna ESCALATE na decyzję, ryzyko JOB_FAILURE/DECISION_OVERDUE.
alter table decisions add column if not exists escalated_at timestamptz;

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
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.decision_escalate_overdue() from public, anon, authenticated;

do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'tower-decision-escalate';
    perform cron.schedule('tower-decision-escalate', '*/10 * * * *',
      $cron$select public.decision_escalate_overdue()$cron$);
  end if;
exception when others then
  raise notice 'cron tower-decision-escalate: %', sqlerrm;
end $$;
