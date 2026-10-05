-- 0165 — B-5 (decyzja właściciela 05.10, ostateczna): przycisk „Nowa automatyzacja” i kreator reguł w aplikacji.
--   Ten sam silnik co 0094 (tabela workflows, kolejka workflow_runs, workflow_worker) — bez drugiego mechanizmu (ONE-MECH).
--   1) Wyzwalacze kreatora w czterech grupach: zdarzenie (load_events, FERRY_STATUS), status (STATUS_CHANGED — nowy),
--      ryzyko (RISK_RAISED — nowy), termin (SCHEDULE_DATE_CRITICAL, PLAN_DATES_*, CRON_DAILY_06).
--   2) Akcje: notify (powiadomienie), decision (decyzja z katalogu decision_types — nowa), email (kolejka l13 z limitami
--      i bramką 0133), sms (wyłącznie zasady stref: listy LOAD_SREM / UNLOAD_BODEN, flagi SMS_ZONE_*, limit 150/dobę,
--      klucz odsiewu wspólny z SMS stref), risk (bez zmian).
--   3) Zero podwójnych alarmów w wykonaniu: powiadomienie i e-mail jeden na zdarzenie i odbiorcę (także gdy kilka reguł),
--      decyzja nie otwiera się, gdy ten sam typ jest już otwarty dla transportu, ryzyko nie dubluje otwartego tego samego
--      rodzaju, SMS stref ma wspólny klucz z automatem stref. Ryzyko z reguły nie wyzwala reguł RISK_RAISED (bez pętli).
--   4) Ostrzeżenie przed zapisem: wf_duplicate_check() — inna reguła o tym samym wyzwalaczu, warunku i akcji albo
--      wbudowany alarm (katalog D-29t / L-1 / SMS stref).
--   5) Historia zmian reguły: workflow_rule_history() z audit_log (kto, kiedy, co) — także reguł usuniętych.
--   6) Reguły START-1…7 wyłączone (D-29t zaakceptowana 01.10: każda dubluje wbudowany alarm). Włączenie z kreatora
--      jest możliwe, z ostrzeżeniem. Przebiegi z kolejki z 01.10 pominie worker („reguła wyłączona”).
--   7) Zadania cykliczne: tower-reguly (co minutę workflow_worker) i tower-reguly-dzien (co godzinę; kolejkuje
--      CRON_DAILY_06 tylko o 06:xx Europe/Warsaw). Bez nich reguła z kreatora nigdy by się nie wykonała.
--   Usuwanie: tylko HHL_ADMIN (RLS wf_all); reguł START-* nie usuwa się (można je wyłączyć).
--   Idempotentna: create or replace, drop/create wyzwalaczy, cron unschedule+schedule.

select set_config('tower.audit_source', 'migracja 0165 (B-5, ONE-MECH D-29t)', true);

-- ── 1) katalog wyzwalaczy ──────────────────────────────────────────────────
create or replace function wf_trigger_types() returns text[]
language sql immutable set search_path = public as $$
  select array['GEOFENCE_ENTER','GEOFENCE_EXIT','GEOFENCE_DWELL','MILESTONE_LOADED','MILESTONE_UNLOADED','STATUS_AUTO',
               'STATUS_AT_SITE','SILENT_VEHICLE','DELAY_DETECTED','DRIVER_ON_FERRY','SCHEDULE_IMPORTED',
               'SCHEDULE_DATE_CRITICAL','STATUS_CANCELLED','PLAN_DATES_CONFIRMED','PLAN_DATES_CHANGED',
               'FERRY_STATUS','CRON_DAILY_06','STATUS_CHANGED','RISK_RAISED']
$$;
revoke all on function wf_trigger_types() from public, anon, authenticated;

-- ── 2) walidacja zapisu ────────────────────────────────────────────────────
create or replace function wf_validate() returns trigger
language plpgsql security definer set search_path = public as $$
declare act jsonb;
begin
  if (length(btrim(coalesce(new.name, ''))) between 1 and 120) is not true then
    raise exception 'workflows: nazwa reguły wymagana (1–120 znaków)';
  end if;
  if (new.trigger_type = any (wf_trigger_types())) is not true then
    raise exception 'workflows: nieznany wyzwalacz % (dozwolone: %)', new.trigger_type, array_to_string(wf_trigger_types(), ', ');
  end if;
  if (jsonb_typeof(new.actions) = 'array' and jsonb_array_length(new.actions) between 1 and 10) is not true then
    raise exception 'workflows: akcje muszą być listą 1–10 elementów';
  end if;
  for act in select * from jsonb_array_elements(new.actions) loop
    if (act ->> 'type' in ('notify', 'risk', 'decision', 'email', 'sms')) is not true then
      raise exception 'workflows: nieznana akcja % (dozwolone: notify, risk, decision, email, sms)', coalesce(act ->> 'type', 'null');
    end if;
    if act ->> 'type' in ('notify', 'email') and (coalesce(act ->> 'audience', case when act ->> 'type' = 'email' then 'HHL' end) in ('HHL', 'KSH', 'CARRIER')) is not true then
      raise exception 'workflows: % wymaga audience HHL | KSH | CARRIER', act ->> 'type';
    end if;
    if act ->> 'type' = 'risk' and ((act ->> 'severity') in ('INFO','LOW','MEDIUM','HIGH','CRITICAL')
        and exists (select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid where t.typname = 'risk_kind' and e.enumlabel = act ->> 'kind')) is not true then
      raise exception 'workflows: risk wymaga kind z risk_kind i severity INFO…CRITICAL';
    end if;
    if act ->> 'type' = 'decision' and (exists (select 1 from decision_types d where d.code = act ->> 'decision_type' and d.active)) is not true then
      raise exception 'workflows: decision wymaga decision_type z katalogu decyzji (aktywny)';
    end if;
    if act ->> 'type' = 'sms' and ((act ->> 'list') in ('LOAD_SREM', 'UNLOAD_BODEN')
        and coalesce(act ->> 'kind', 'ZONE_ENTER') in ('ZONE_APPROACH', 'ZONE_ENTER')) is not true then
      raise exception 'workflows: sms tylko według zasad stref — list LOAD_SREM | UNLOAD_BODEN, kind ZONE_APPROACH | ZONE_ENTER';
    end if;
  end loop;
  perform wf_logic(new.condition, '{}'::jsonb);   -- nieznany operator → wyjątek już przy zapisie
  return new;
end $$;
revoke all on function wf_validate() from public, anon, authenticated;

-- reguł startowych (seed 0094) nie usuwa się — tylko wyłącza
create or replace function wf_guard_delete() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.code like 'START-%' then
    raise exception 'workflows: reguły startowej % nie usuwa się — można ją wyłączyć', old.code;
  end if;
  return old;
end $$;
revoke all on function wf_guard_delete() from public, anon, authenticated;
drop trigger if exists workflows_guard_delete on workflows;
create trigger workflows_guard_delete before delete on workflows for each row execute function wf_guard_delete();

-- autor reguły z kreatora
create or replace function wf_set_creator() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.created_by is null then
    begin new.created_by := current_app_user_id(); exception when others then new.created_by := null; end;
  end if;
  return new;
end $$;
revoke all on function wf_set_creator() from public, anon, authenticated;
drop trigger if exists workflows_set_creator on workflows;
create trigger workflows_set_creator before insert on workflows for each row execute function wf_set_creator();

-- ── 3) nowe wyzwalacze: status transportu i ryzyko ─────────────────────────
create or replace function wf_enqueue_status() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status is not distinct from old.status then return null; end if;
  insert into workflow_runs (workflow_id, load_id, status, attempts, next_attempt_at, dedup_key, payload)
  select w.id, new.id, 'QUEUED', 0, now(),
         'wf:' || w.id || ':st:' || new.id || ':' || new.status || ':' || (extract(epoch from clock_timestamp()) * 1000)::bigint,
         jsonb_build_object('event_type', 'STATUS_CHANGED', 'occurred_at', now(),
                            'payload', jsonb_build_object('status', new.status, 'old_status', old.status))
    from workflows w
   where w.enabled and w.trigger_type = 'STATUS_CHANGED' and w.project_id = new.project_id
  on conflict (dedup_key) where dedup_key is not null do nothing;
  return null;
exception when others then
  raise warning 'wf_enqueue_status: %', sqlerrm;
  return null;
end $$;
revoke all on function wf_enqueue_status() from public, anon, authenticated;
drop trigger if exists loads_workflows_status on loads;
create trigger loads_workflows_status after update of status on loads for each row execute function wf_enqueue_status();

create or replace function wf_enqueue_risk() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- ryzyko otwarte przez regułę (klucz WF:) nie wyzwala reguł — bez pętli
  if new.load_id is null or coalesce(new.dedup_key, '') like 'WF:%' then return null; end if;
  insert into workflow_runs (workflow_id, load_id, status, attempts, next_attempt_at, dedup_key, payload)
  select w.id, new.load_id, 'QUEUED', 0, now(), 'wf:' || w.id || ':risk:' || new.id,
         jsonb_build_object('event_type', 'RISK_RAISED', 'occurred_at', now(),
                            'payload', jsonb_build_object('risk_id', new.id, 'kind', new.kind, 'severity', new.severity,
                                                          'title_key', new.title_key))
    from workflows w
   where w.enabled and w.trigger_type = 'RISK_RAISED' and w.project_id = new.project_id
  on conflict (dedup_key) where dedup_key is not null do nothing;
  return null;
exception when others then
  raise warning 'wf_enqueue_risk: %', sqlerrm;
  return null;
end $$;
revoke all on function wf_enqueue_risk() from public, anon, authenticated;
drop trigger if exists risk_signals_workflows on risk_signals;
create trigger risk_signals_workflows after insert on risk_signals for each row execute function wf_enqueue_risk();

-- kontekst transportu: + godziny do załadunku / dostawy (warunki „termin”), bez danych kierowcy i kwot
create or replace function wf_load_context(p_load uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', l.id, 'code', coalesce(l.order_no, left(l.id::text, 8)), 'status', l.status,
                            'plan_load_date', l.plan_load_date, 'plan_delivery_date', l.plan_delivery_date,
                            'plan_dates_status', l.plan_dates_status, 'has_carrier', l.carrier_org_id is not null,
                            'hours_to_load', case when l.plan_load_date is null then null else
                              round(extract(epoch from ((l.plan_load_date::timestamp at time zone 'Europe/Warsaw') - now())) / 3600) end,
                            'hours_to_delivery', case when l.plan_delivery_date is null then null else
                              round(extract(epoch from ((l.plan_delivery_date::timestamp at time zone 'Europe/Warsaw') - now())) / 3600) end)
    from loads l where l.id = p_load
$$;
revoke all on function wf_load_context(uuid) from public, anon, authenticated;

-- ── 4) akcje (jedno zdarzenie = jeden alarm na odbiorcę) ───────────────────
create or replace function wf_event_key(p_run workflow_runs) returns text
language sql immutable set search_path = public as $$
  select regexp_replace(coalesce(p_run.dedup_key, 'run:' || p_run.id), '^wf:[^:]+:', '')
$$;
revoke all on function wf_event_key(workflow_runs) from public, anon, authenticated;

create or replace function wf_action(p_wf workflows, p_run workflow_runs, p_act jsonb, p_ctx jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_n int; v_client uuid; v_carrier uuid; v_project uuid; v_code text := coalesce(p_ctx #>> '{load,code}', '');
        v_ev text := wf_event_key(p_run); v_aud text; v_id uuid; v_st text; v_crit boolean; r record; v_stats jsonb := '{}'::jsonb;
begin
  select l.project_id, p.client_org_id, l.carrier_org_id into v_project, v_client, v_carrier
    from loads l join projects p on p.id = l.project_id where l.id = p_run.load_id;
  if p_act ->> 'type' = 'notify' then
    insert into notifications (channel, recipient, user_id, load_id, template, payload, dedup_key)
    select 'IN_APP', coalesce(u.email::text, u.id::text), u.id, p_run.load_id, 'WORKFLOW_ALERT',
           jsonb_build_object('code', v_code, 'rule', p_wf.name, 'rule_code', p_wf.code,
                              'event', p_ctx ->> 'event_type', 'text', p_act ->> 'text', 'locale', u.locale),
           left('WFN:' || v_ev || ':' || u.id, 200)
      from app_users u join organizations o on o.id = u.org_id
     where u.active
       and case p_act ->> 'audience'
             when 'HHL' then o.kind = 'FORWARDER'
             when 'KSH' then v_client is not null and u.org_id = v_client
             when 'CARRIER' then v_carrier is not null and u.org_id = v_carrier
             else false end
    on conflict (dedup_key) where dedup_key is not null do nothing;
    get diagnostics v_n = row_count;
    return jsonb_build_object('type', 'notify', 'audience', p_act ->> 'audience', 'sent', v_n);
  elsif p_act ->> 'type' = 'risk' then
    if p_run.load_id is null then raise exception 'wf_action risk: brak transportu'; end if;
    if exists (select 1 from risk_signals s where s.load_id = p_run.load_id and s.kind::text = p_act ->> 'kind' and s.resolved_at is null) then
      return jsonb_build_object('type', 'risk', 'kind', p_act ->> 'kind', 'status', 'JUZ_OTWARTE');
    end if;
    perform raise_risk(p_run.load_id, (p_act ->> 'kind')::risk_kind, (p_act ->> 'severity')::risk_severity,
                       coalesce(nullif(p_act ->> 'title', ''), p_wf.name) || ' · ' || v_code,
                       jsonb_build_object('rule', p_wf.name, 'rule_code', p_wf.code, 'event', p_ctx ->> 'event_type',
                                          'title_key', 'rk_workflow',
                                          'params', jsonb_build_object('rule', p_wf.name, 'code', v_code,
                                                                       'title', coalesce(nullif(p_act ->> 'title', ''), p_wf.name))),
                       'WF:' || p_wf.id || ':' || p_run.load_id);
    return jsonb_build_object('type', 'risk', 'kind', p_act ->> 'kind');
  elsif p_act ->> 'type' = 'decision' then
    if p_run.load_id is null then raise exception 'wf_action decision: brak transportu'; end if;
    if exists (select 1 from decisions d where d.load_id = p_run.load_id and d.type_code = p_act ->> 'decision_type'
                                          and d.status in ('NEW', 'ASSIGNED', 'SNOOZED')) then
      return jsonb_build_object('type', 'decision', 'decision_type', p_act ->> 'decision_type', 'status', 'JUZ_OTWARTA');
    end if;
    v_id := decision_open_from_event(v_project, p_act ->> 'decision_type', left('WF:' || v_ev || ':' || (p_act ->> 'decision_type'), 200),
                                     coalesce(nullif(p_act ->> 'title', ''), p_wf.name) || ' · ' || v_code,
                                     jsonb_build_object('rule', p_wf.name, 'rule_id', p_wf.id, 'event', p_ctx ->> 'event_type'),
                                     p_run.load_id, null);
    return jsonb_build_object('type', 'decision', 'decision_type', p_act ->> 'decision_type', 'decision_id', v_id);
  elsif p_act ->> 'type' = 'email' then
    v_aud := coalesce(p_act ->> 'audience', 'HHL');
    v_crit := coalesce((p_act ->> 'critical')::boolean, false);
    for r in
      select u.id, u.email::text as email, u.locale
        from app_users u join organizations o on o.id = u.org_id
       where u.active and u.email is not null
         and case v_aud
               when 'HHL' then o.kind = 'FORWARDER'
               when 'KSH' then v_client is not null and u.org_id = v_client
               when 'CARRIER' then v_carrier is not null and u.org_id = v_carrier
               else false end
    loop
      v_st := l13_queue_email(case when v_crit then 'critical' else 'digest' end, 'WORKFLOW_ALERT', r.id, r.email,
                              p_run.load_id, v_code,
                              jsonb_build_object('code', v_code, 'rule', p_wf.name, 'rule_code', p_wf.code,
                                                 'event', p_ctx ->> 'event_type', 'text', p_act ->> 'text', 'locale', r.locale),
                              left('WFE:' || v_ev || ':' || r.id, 200),
                              case when v_crit then left('WF:' || v_ev, 120) end);
      v_stats := jsonb_set(v_stats, array[coalesce(v_st, 'skip')], to_jsonb(coalesce((v_stats ->> coalesce(v_st, 'skip'))::int, 0) + 1));
    end loop;
    return jsonb_build_object('type', 'email', 'audience', v_aud, 'queued', v_stats);
  elsif p_act ->> 'type' = 'sms' then
    if p_run.load_id is null then raise exception 'wf_action sms: brak transportu'; end if;
    v_n := sms_zone_enqueue_for_event(p_run.load_id, p_act ->> 'list', coalesce(p_act ->> 'kind', 'ZONE_ENTER'),
                                      case when p_act ->> 'list' = 'LOAD_SREM' then 'zaladunek Srem' else 'plac Stegra Boden' end, null);
    return jsonb_build_object('type', 'sms', 'list', p_act ->> 'list', 'kind', coalesce(p_act ->> 'kind', 'ZONE_ENTER'), 'queued', v_n);
  end if;
  raise exception 'wf_action: nieznana akcja %', p_act ->> 'type';
end $$;
revoke all on function wf_action(workflows, workflow_runs, jsonb, jsonb) from public, anon, authenticated;

-- ── 5) ostrzeżenie o duplikacie przed zapisem ──────────────────────────────
create or replace function wf_builtin_alarms()
returns table (trigger_type text, action_type text, label text)
language sql immutable set search_path = public as $$
  select * from (values
    ('SILENT_VEHICLE', 'notify', 'Cisza GPS — automat detect_silent_vehicles: ryzyko SILENT_VEHICLE i decyzja NO_POSITION'),
    ('SILENT_VEHICLE', 'risk', 'Cisza GPS — automat detect_silent_vehicles otwiera ryzyko SILENT_VEHICLE'),
    ('SILENT_VEHICLE', 'decision', 'Cisza GPS — ryzyko otwiera decyzję NO_POSITION (L-1)'),
    ('SILENT_VEHICLE', 'email', 'Cisza GPS — e-mail decyzji automatycznej NO_POSITION'),
    ('SILENT_VEHICLE', 'sms', 'Cisza GPS — SMS GPS_SILENT (D-19)'),
    ('DELAY_DETECTED', 'notify', 'Opóźnienie — ryzyko ETA_BREACH i decyzja ETA_AFTER_LATEST (II-7, L-1)'),
    ('DELAY_DETECTED', 'risk', 'Opóźnienie — automat otwiera ryzyko ETA_BREACH'),
    ('DELAY_DETECTED', 'decision', 'Opóźnienie — decyzja ETA_AFTER_LATEST (L-1)'),
    ('DELAY_DETECTED', 'email', 'Opóźnienie — e-mail decyzji automatycznej ETA_AFTER_LATEST'),
    ('GEOFENCE_ENTER', 'sms', 'Wjazd na plac Śrem / Boden — SMS stref (0106, SMS-KSH-1H 0158)'),
    ('GEOFENCE_ENTER', 'notify', 'Wjazd w strefę — statusy automatyczne i powiadomienia LOAD_STATUS (macierz)'),
    ('GEOFENCE_EXIT', 'notify', 'Wyjazd ze strefy — statusy automatyczne i powiadomienia LOAD_STATUS (macierz)'),
    ('STATUS_AUTO', 'notify', 'Zmiana statusu — powiadomienia LOAD_STATUS (macierz)'),
    ('STATUS_AT_SITE', 'notify', 'Zmiana statusu — powiadomienia LOAD_STATUS (macierz)'),
    ('STATUS_CHANGED', 'notify', 'Zmiana statusu — powiadomienia LOAD_STATUS (macierz)'),
    ('STATUS_CHANGED', 'email', 'Zmiana statusu — e-mail LOAD_STATUS (macierz)'),
    ('FERRY_STATUS', 'notify', 'Status promu — ryzyko FERRY i decyzja FERRY_CANCELLED (FERRY-STATUS, L-9)'),
    ('FERRY_STATUS', 'risk', 'Status promu — automat otwiera ryzyko FERRY'),
    ('FERRY_STATUS', 'decision', 'Status promu — decyzja FERRY_CANCELLED (L-1)'),
    ('FERRY_STATUS', 'email', 'Status promu — e-mail decyzji automatycznej FERRY_CANCELLED'),
    ('SCHEDULE_DATE_CRITICAL', 'notify', 'Zmiana daty — ryzyko LATE_DATE_CHANGE i decyzja KSH_DATE_LT_5D (DATY-67)'),
    ('SCHEDULE_DATE_CRITICAL', 'risk', 'Zmiana daty — automat otwiera ryzyko LATE_DATE_CHANGE'),
    ('SCHEDULE_DATE_CRITICAL', 'decision', 'Zmiana daty — decyzja KSH_DATE_LT_5D (L-1)'),
    ('PLAN_DATES_CHANGED', 'notify', 'Zmiana dat planu — ryzyko DATES_UNCONFIRMED / decyzja potwierdzenia dat (DATY-67)'),
    ('PLAN_DATES_CHANGED', 'decision', 'Zmiana dat planu — decyzja potwierdzenia dat (DATY-67)'),
    ('MILESTONE_UNLOADED', 'sms', 'Rozładunek — SMS potwierdzenia rozładunku (tower-sms-rozladunek)'),
    ('MILESTONE_UNLOADED', 'notify', 'Rozładunek — status UNLOADED i powiadomienia LOAD_STATUS (macierz)'),
    ('STATUS_CANCELLED', 'notify', 'Anulowanie — import harmonogramu powiadamia o anulowaniu (import_cancel_loads)'),
    ('RISK_RAISED', 'decision', 'Ryzyko — automat L-1 otwiera decyzję dla rodzajów z katalogu (l1_decision_type)')
  ) as t(trigger_type, action_type, label)
$$;
revoke all on function wf_builtin_alarms() from public, anon, authenticated;

create or replace function wf_action_key(a jsonb) returns text
language sql immutable set search_path = public as $$
  select (a ->> 'type') || ':' || case a ->> 'type'
    when 'notify' then coalesce(a ->> 'audience', '')
    when 'email' then coalesce(a ->> 'audience', 'HHL')
    when 'risk' then coalesce(a ->> 'kind', '')
    when 'decision' then coalesce(a ->> 'decision_type', '')
    when 'sms' then coalesce(a ->> 'list', '') || ':' || coalesce(a ->> 'kind', 'ZONE_ENTER')
    else '' end
$$;
revoke all on function wf_action_key(jsonb) from public, anon, authenticated;

create or replace function public.wf_duplicate_check(p_trigger text, p_condition jsonb, p_actions jsonb, p_exclude uuid default null)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_out jsonb := '[]'::jsonb; r record; a jsonb;
begin
  if (current_app_role() = 'HHL_ADMIN') is not true then
    raise exception 'Kreator reguł — tylko HHL_ADMIN' using errcode = '42501';
  end if;
  -- inna reguła: ten sam wyzwalacz, ten sam warunek (albo któryś „zawsze”) i wspólna akcja
  for r in
    select w.id, w.name, w.code, w.enabled, w.actions from workflows w
     where w.trigger_type = p_trigger and w.id is distinct from p_exclude
       and (w.condition = coalesce(p_condition, 'true'::jsonb) or w.condition = 'true'::jsonb or coalesce(p_condition, 'true'::jsonb) = 'true'::jsonb)
  loop
    if exists (select 1 from jsonb_array_elements(r.actions) x, jsonb_array_elements(coalesce(p_actions, '[]'::jsonb)) y
                where wf_action_key(x) = wf_action_key(y)) then
      v_out := v_out || jsonb_build_array(jsonb_build_object('kind', 'RULE', 'rule_id', r.id, 'rule', r.name,
        'enabled', r.enabled, 'text', 'Reguła „' || r.name || '”' || case when r.enabled then '' else ' (wyłączona)' end
                                        || ' ma ten sam wyzwalacz, warunek i akcję'));
    end if;
  end loop;
  -- wbudowany alarm (D-29t, L-1, SMS stref)
  for a in select * from jsonb_array_elements(coalesce(p_actions, '[]'::jsonb)) loop
    for r in select b.label from wf_builtin_alarms() b where b.trigger_type = p_trigger and b.action_type = a ->> 'type' loop
      v_out := v_out || jsonb_build_array(jsonb_build_object('kind', 'BUILTIN', 'action', a ->> 'type', 'text', r.label));
    end loop;
    if a ->> 'type' = 'decision' and exists (select 1 from decision_types d where d.code = a ->> 'decision_type') then
      v_out := v_out || jsonb_build_array(jsonb_build_object('kind', 'BUILTIN', 'action', 'decision',
        'text', 'Decyzję ' || (a ->> 'decision_type') || ' otwiera też automat (L-1) — reguła nie otworzy drugiej, gdy ta jest otwarta'));
    end if;
  end loop;
  return (select coalesce(jsonb_agg(distinct e), '[]'::jsonb) from jsonb_array_elements(v_out) e);
end $$;
revoke all on function public.wf_duplicate_check(text, jsonb, jsonb, uuid) from public, anon;
grant execute on function public.wf_duplicate_check(text, jsonb, jsonb, uuid) to authenticated;

-- ── 6) historia zmian reguły (kto, kiedy, co) ──────────────────────────────
create or replace function public.workflow_rule_history(p_workflow uuid default null, p_limit int default 100)
returns table (at timestamptz, who text, action text, workflow_id text, rule_name text, changes jsonb, source text)
language plpgsql stable security definer set search_path = public as $$
begin
  if (current_app_role() = 'HHL_ADMIN') is not true then
    raise exception 'Historia reguł — tylko HHL_ADMIN' using errcode = '42501';
  end if;
  return query
    select a.created_at, coalesce(nullif(u.full_name, ''), u.email::text, a.source, 'system'),
           case a.action when 'ROW_INSERT' then 'UTWORZONO' when 'ROW_UPDATE' then 'ZMIENIONO' when 'ROW_DELETE' then 'USUNIĘTO' else a.action end,
           a.entity_id, coalesce(a.new_value ->> 'name', a.old_value ->> 'name',
                                 (select w.name from workflows w where w.id::text = a.entity_id)),
           case when a.action = 'ROW_UPDATE' then jsonb_build_object('przed', a.old_value, 'po', a.new_value)
                when a.action = 'ROW_DELETE' then jsonb_build_object('przed', a.old_value)
                else jsonb_build_object('po', a.new_value) end,
           a.source
      from audit_log a left join app_users u on u.id = a.user_id
     where a.entity = 'workflows' and (p_workflow is null or a.entity_id = p_workflow::text)
     order by a.created_at desc, a.id desc
     limit greatest(1, least(coalesce(p_limit, 100), 500));
end $$;
revoke all on function public.workflow_rule_history(uuid, int) from public, anon;
grant execute on function public.workflow_rule_history(uuid, int) to authenticated;

-- audyt tabeli workflows (0118) — upewnij się, że jest
do $$
begin
  if to_regprocedure('public.audit_row_change()') is not null then
    drop trigger if exists trg_audit_row on public.workflows;
    create trigger trg_audit_row after insert or update or delete on public.workflows for each row execute function public.audit_row_change();
  end if;
end $$;

-- ── 7) ONE-MECH: reguły START dublują wbudowane alarmy (D-29t) → wyłączone ──
update workflows set enabled = false where code like 'START-%' and enabled;

-- ── 8) zadania cykliczne silnika ───────────────────────────────────────────
create or replace function public.wf_daily_tick(p_now timestamptz default now()) returns int
language plpgsql security definer set search_path = public as $$
begin
  if extract(hour from (p_now at time zone 'Europe/Warsaw')) <> 6 then return 0; end if;
  return wf_enqueue_daily(p_now);
end $$;
revoke all on function public.wf_daily_tick(timestamptz) from public, anon, authenticated;

do $$
begin
  if to_regclass('cron.job') is not null then
    perform cron.unschedule(jobid) from cron.job where jobname in ('tower-reguly', 'tower-reguly-dzien');
    perform cron.schedule('tower-reguly', '* * * * *', 'select public.workflow_worker(50, now())');
    perform cron.schedule('tower-reguly-dzien', '2 * * * *', 'select public.wf_daily_tick(now())');
  end if;
end $$;

do $g$
begin
  if (array['STATUS_CHANGED', 'RISK_RAISED'] <@ wf_trigger_types()) is not true then
    raise exception '0165: katalog wyzwalaczy bez STATUS_CHANGED / RISK_RAISED';
  end if;
  if (select count(*) from pg_trigger where tgname in ('loads_workflows_status', 'risk_signals_workflows', 'workflows_guard_delete', 'workflows_set_creator') and not tgisinternal) <> 4 then
    raise exception '0165: brak wyzwalaczy kreatora';
  end if;
  if (select bool_and(prosecdef) from pg_proc where proname in ('wf_action', 'wf_enqueue_status', 'wf_enqueue_risk', 'wf_duplicate_check', 'workflow_rule_history', 'wf_daily_tick')) is not true then
    raise exception '0165: funkcje muszą być SECURITY DEFINER';
  end if;
  if (select bool_or(has_function_privilege(r, p.oid, 'execute')) from pg_proc p cross join unnest(array['anon', 'authenticated']) r
       where p.proname in ('workflow_worker', 'wf_action', 'wf_enqueue_status', 'wf_enqueue_risk', 'wf_daily_tick', 'wf_builtin_alarms')) is not false then
    raise exception '0165: funkcje silnika tylko dla service_role';
  end if;
  if (select count(*) from workflows where code like 'START-%' and enabled) <> 0 then
    raise exception '0165: reguły START muszą być wyłączone (ONE-MECH)';
  end if;
end $g$;
