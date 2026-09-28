-- 0094 — SCOPE 9.1–9.3 (audyt C1): silnik reguł w bazie.
--   9.1  wyzwalacz (typ zdarzenia z load_events) → warunek (podzbiór JSONLogic) → akcje (lista {type, …}).
--   9.2  wykonanie trwałe: zdarzenie dopisuje przebieg do kolejki workflow_runs (QUEUED, klucz odsiewu),
--        workflow_worker() wykonuje go w podtransakcji; błąd → RETRY z odstępem 2^n min, po 5 próbach DEAD.
--   9.3  siedem reguł startowych START-1…7 w każdym projekcie — WYŁĄCZONE (włączenie = decyzja HHL_ADMIN).
--   Akcje wewnętrzne: notify (powiadomienie w aplikacji: HHL / KSH / przewoźnik transportu), risk (sygnał ryzyka).
--   Akcje zewnętrzne (email, sms) zablokowane do R-2 przez security_flags.EXTERNAL_MESSAGING — przebieg zapisuje
--   „ZABLOKOWANE_R2”, nic nie wychodzi. Zdarzenia CRON — poza zakresem (reguły tylko na zdarzeniach transportu).
--   Bez crona: workflow_worker() wywołuje tylko service_role; uruchomienie zadania = osobna decyzja (jak 0092).
--   Idempotentna i nieniszcząca: tylko nowe kolumny, funkcje, wyzwalacze i reguły startowe (on conflict do nothing).

alter table workflows add column if not exists code text;
alter table workflows add column if not exists description text;
create unique index if not exists workflows_project_code on workflows (project_id, code) where code is not null;

alter table workflow_runs add column if not exists attempts int not null default 0;
alter table workflow_runs add column if not exists next_attempt_at timestamptz;
alter table workflow_runs add column if not exists dedup_key text;
alter table workflow_runs add column if not exists payload jsonb;
alter table workflow_runs add column if not exists finished_at timestamptz;
create unique index if not exists workflow_runs_dedup on workflow_runs (dedup_key) where dedup_key is not null;
create index if not exists workflow_runs_queue on workflow_runs (next_attempt_at) where status in ('QUEUED', 'RETRY');

-- prawdziwość wg JSONLogic: false, null, 0, "", [] → fałsz
create or replace function wf_truthy(v jsonb) returns boolean
language sql immutable set search_path = public as $$
  select case
    when v is null or v = 'null'::jsonb or v = 'false'::jsonb or v = '""'::jsonb or v = '[]'::jsonb then false
    when jsonb_typeof(v) = 'number' then (v #>> '{}')::numeric <> 0
    else true end
$$;

-- podzbiór JSONLogic: var, missing, and, or, !, !!, ==, !=, <, <=, >, >=, in; inny operator → wyjątek
create or replace function wf_logic(r jsonb, d jsonb) returns jsonb
language plpgsql immutable set search_path = public as $$
declare op text; a jsonb; x jsonb; y jsonb; v jsonb; i int;
begin
  if r is null then return 'null'::jsonb; end if;
  if jsonb_typeof(r) = 'array' then
    return (select coalesce(jsonb_agg(wf_logic(e, d) order by n), '[]'::jsonb) from jsonb_array_elements(r) with ordinality t(e, n));
  end if;
  if jsonb_typeof(r) <> 'object' then return r; end if;
  if (select count(*) from jsonb_object_keys(r)) <> 1 then
    raise exception 'wf_logic: obiekt warunku musi mieć dokładnie jeden operator';
  end if;
  select k into op from jsonb_object_keys(r) k;
  a := r -> op;
  if jsonb_typeof(a) <> 'array' then a := jsonb_build_array(a); end if;
  if op = 'var' then
    v := d #> string_to_array(coalesce(a ->> 0, ''), '.');
    return coalesce(v, a -> 1, 'null'::jsonb);
  elsif op = 'missing' then
    return (select coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb) from jsonb_array_elements_text(a) p
             where coalesce(d #> string_to_array(p, '.'), 'null'::jsonb) in ('null'::jsonb, '""'::jsonb));
  elsif op in ('and', 'or') then
    v := 'null'::jsonb;
    for i in 0 .. jsonb_array_length(a) - 1 loop
      v := wf_logic(a -> i, d);
      if (op = 'and' and not wf_truthy(v)) or (op = 'or' and wf_truthy(v)) then return v; end if;
    end loop;
    return v;
  elsif op = '!' then
    return to_jsonb(not wf_truthy(wf_logic(a -> 0, d)));
  elsif op = '!!' then
    return to_jsonb(wf_truthy(wf_logic(a -> 0, d)));
  elsif op in ('==', '!=', '<', '<=', '>', '>=') then
    x := wf_logic(a -> 0, d); y := wf_logic(a -> 1, d);
    if op in ('==', '!=') then
      if jsonb_typeof(x) = 'number' and jsonb_typeof(y) = 'number' then
        return to_jsonb(((x #>> '{}')::numeric = (y #>> '{}')::numeric) = (op = '=='));
      end if;
      return to_jsonb((x = y) = (op = '=='));
    end if;
    if jsonb_typeof(x) <> 'number' or jsonb_typeof(y) <> 'number' then return 'false'::jsonb; end if;
    return to_jsonb(case op when '<' then (x #>> '{}')::numeric < (y #>> '{}')::numeric
                            when '<=' then (x #>> '{}')::numeric <= (y #>> '{}')::numeric
                            when '>' then (x #>> '{}')::numeric > (y #>> '{}')::numeric
                            else (x #>> '{}')::numeric >= (y #>> '{}')::numeric end);
  elsif op = 'in' then
    x := wf_logic(a -> 0, d); y := wf_logic(a -> 1, d);
    if jsonb_typeof(y) = 'array' then return to_jsonb(y @> jsonb_build_array(x)); end if;
    if jsonb_typeof(y) = 'string' and jsonb_typeof(x) = 'string' then return to_jsonb(position(x #>> '{}' in y #>> '{}') > 0); end if;
    return 'false'::jsonb;
  end if;
  raise exception 'wf_logic: nieobsługiwany operator %', op;
end $$;

-- katalog: dozwolone wyzwalacze i akcje
create or replace function wf_trigger_types() returns text[]
language sql immutable set search_path = public as $$
  select array['GEOFENCE_ENTER','GEOFENCE_EXIT','GEOFENCE_DWELL','MILESTONE_LOADED','MILESTONE_UNLOADED','STATUS_AUTO',
               'STATUS_AT_SITE','SILENT_VEHICLE','DELAY_DETECTED','DRIVER_ON_FERRY','SCHEDULE_IMPORTED',
               'SCHEDULE_DATE_CRITICAL','STATUS_CANCELLED','PLAN_DATES_CONFIRMED','PLAN_DATES_CHANGED']
$$;

-- walidacja reguły przy zapisie (także z kreatora 9.4 przez API — polityka wf_all: HHL_ADMIN)
create or replace function wf_validate() returns trigger
language plpgsql security definer set search_path = public as $$
declare act jsonb;
begin
  if (new.trigger_type = any (wf_trigger_types())) is not true then
    raise exception 'workflows: nieznany wyzwalacz % (dozwolone: %)', new.trigger_type, array_to_string(wf_trigger_types(), ', ');
  end if;
  if (jsonb_typeof(new.actions) = 'array' and jsonb_array_length(new.actions) between 1 and 10) is not true then
    raise exception 'workflows: akcje muszą być listą 1–10 elementów';
  end if;
  for act in select * from jsonb_array_elements(new.actions) loop
    if (act ->> 'type' in ('notify', 'risk', 'email', 'sms')) is not true then
      raise exception 'workflows: nieznana akcja % (dozwolone: notify, risk, email, sms)', coalesce(act ->> 'type', 'null');
    end if;
    if act ->> 'type' = 'notify' and (act ->> 'audience' in ('HHL', 'KSH', 'CARRIER')) is not true then
      raise exception 'workflows: notify wymaga audience HHL | KSH | CARRIER';
    end if;
    if act ->> 'type' = 'risk' and ((act ->> 'severity') in ('INFO','LOW','MEDIUM','HIGH','CRITICAL')
        and exists (select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid where t.typname = 'risk_kind' and e.enumlabel = act ->> 'kind')) is not true then
      raise exception 'workflows: risk wymaga kind z risk_kind i severity INFO…CRITICAL';
    end if;
  end loop;
  perform wf_logic(new.condition, '{}'::jsonb);   -- nieznany operator → wyjątek już przy zapisie
  return new;
end $$;
revoke all on function wf_validate() from public, anon, authenticated;
revoke all on function wf_truthy(jsonb) from public, anon, authenticated;
revoke all on function wf_logic(jsonb, jsonb) from public, anon, authenticated;
revoke all on function wf_trigger_types() from public, anon, authenticated;
drop trigger if exists workflows_validate on workflows;
create trigger workflows_validate before insert or update on workflows for each row execute function wf_validate();

-- 9.2: zdarzenie → kolejka (bez blokowania zapisu zdarzenia, gdy coś pójdzie nie tak)
create or replace function wf_enqueue_event() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into workflow_runs (workflow_id, load_id, event_id, status, attempts, next_attempt_at, dedup_key, payload)
  select w.id, new.load_id, new.id, 'QUEUED', 0, now(), 'wf:' || w.id || ':ev:' || new.id,
         jsonb_build_object('event_type', new.event_type, 'occurred_at', new.occurred_at, 'payload', new.payload)
    from workflows w join loads l on l.id = new.load_id
   where w.enabled and w.trigger_type = new.event_type and w.project_id = l.project_id
  on conflict (dedup_key) where dedup_key is not null do nothing;
  return null;
exception when others then
  raise warning 'wf_enqueue_event: %', sqlerrm;
  return null;
end $$;
revoke all on function wf_enqueue_event() from public, anon, authenticated;
drop trigger if exists load_events_workflows on load_events;
create trigger load_events_workflows after insert on load_events for each row execute function wf_enqueue_event();

-- kontekst transportu dla warunku — bez danych kierowcy i kwot
create or replace function wf_load_context(p_load uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', l.id, 'code', coalesce(l.order_no, left(l.id::text, 8)), 'status', l.status,
                            'plan_load_date', l.plan_load_date, 'plan_delivery_date', l.plan_delivery_date,
                            'plan_dates_status', l.plan_dates_status, 'has_carrier', l.carrier_org_id is not null)
    from loads l where l.id = p_load
$$;
revoke all on function wf_load_context(uuid) from public, anon, authenticated;

-- jedna akcja; zwraca opis wyniku
create or replace function wf_action(p_wf workflows, p_run workflow_runs, p_act jsonb, p_ctx jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_n int; v_client uuid; v_carrier uuid; v_code text := coalesce(p_ctx #>> '{load,code}', '');
begin
  if p_act ->> 'type' = 'notify' then
    select p.client_org_id, l.carrier_org_id into v_client, v_carrier
      from loads l join projects p on p.id = l.project_id where l.id = p_run.load_id;
    insert into notifications (channel, recipient, user_id, load_id, template, payload, dedup_key)
    select 'IN_APP', coalesce(u.email::text, u.id::text), u.id, p_run.load_id, 'WORKFLOW_ALERT',
           jsonb_build_object('code', v_code, 'rule', p_wf.name, 'rule_code', p_wf.code,
                              'event', p_ctx ->> 'event_type', 'text', p_act ->> 'text', 'locale', u.locale),
           'WF:' || p_run.id || ':' || u.id
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
    perform raise_risk(p_run.load_id, (p_act ->> 'kind')::risk_kind, (p_act ->> 'severity')::risk_severity,
                       coalesce(nullif(p_act ->> 'title', ''), p_wf.name) || ' · ' || v_code,
                       jsonb_build_object('rule', p_wf.name, 'rule_code', p_wf.code, 'event', p_ctx ->> 'event_type'),
                       'WF:' || p_wf.id || ':' || p_run.load_id);
    return jsonb_build_object('type', 'risk', 'kind', p_act ->> 'kind');
  elsif p_act ->> 'type' in ('email', 'sms') then
    if external_messaging_enabled() is not true then
      return jsonb_build_object('type', p_act ->> 'type', 'status', 'ZABLOKOWANE_R2');
    end if;
    return jsonb_build_object('type', p_act ->> 'type', 'status', 'BRAK_OBSLUGI');   -- kanały zewnętrzne: osobna pozycja po R-2
  end if;
  raise exception 'wf_action: nieznana akcja %', p_act ->> 'type';
end $$;
revoke all on function wf_action(workflows, workflow_runs, jsonb, jsonb) from public, anon, authenticated;

-- 9.2: wykonawca kolejki (service_role; każdy przebieg w podtransakcji — błąd cofa jego akcje)
create or replace function workflow_worker(p_limit int default 50, p_now timestamptz default now()) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r workflow_runs; w workflows; v_ctx jsonb; v_out jsonb; v_act jsonb;
        n_ok int := 0; n_skip int := 0; n_retry int := 0; n_dead int := 0;
begin
  if (p_limit between 1 and 500) is not true then raise exception 'workflow_worker: p_limit 1–500'; end if;
  if p_now is null then raise exception 'workflow_worker: p_now wymagane'; end if;
  for r in select * from workflow_runs
            where status in ('QUEUED', 'RETRY') and coalesce(next_attempt_at, ran_at) <= p_now
            order by id limit p_limit for update skip locked loop
    select * into w from workflows where id = r.workflow_id;
    if w.id is null or w.enabled is not true then
      update workflow_runs set status = 'SKIPPED', finished_at = p_now, result = jsonb_build_object('reason', 'reguła wyłączona') where id = r.id;
      n_skip := n_skip + 1; continue;
    end if;
    begin
      v_ctx := coalesce(r.payload, '{}'::jsonb) || jsonb_build_object('load', coalesce(wf_load_context(r.load_id), '{}'::jsonb));
      if wf_truthy(wf_logic(w.condition, v_ctx)) is not true then
        update workflow_runs set status = 'SKIPPED', attempts = r.attempts + 1, finished_at = p_now,
               result = jsonb_build_object('reason', 'warunek niespełniony') where id = r.id;
        n_skip := n_skip + 1; continue;
      end if;
      v_out := '[]'::jsonb;
      for v_act in select * from jsonb_array_elements(w.actions) loop
        v_out := v_out || jsonb_build_array(wf_action(w, r, v_act, v_ctx));
      end loop;
      update workflow_runs set status = 'OK', attempts = r.attempts + 1, finished_at = p_now,
             result = jsonb_build_object('actions', v_out) where id = r.id;
      n_ok := n_ok + 1;
    exception when others then
      if r.attempts + 1 >= 5 then
        update workflow_runs set status = 'DEAD', attempts = r.attempts + 1, finished_at = p_now,
               result = jsonb_build_object('error', sqlerrm) where id = r.id;
        n_dead := n_dead + 1;
      else
        update workflow_runs set status = 'RETRY', attempts = r.attempts + 1,
               next_attempt_at = p_now + make_interval(mins => (2 ^ (r.attempts + 1))::int),
               result = jsonb_build_object('error', sqlerrm) where id = r.id;
        n_retry := n_retry + 1;
      end if;
    end;
  end loop;
  return jsonb_build_object('ok', n_ok, 'skipped', n_skip, 'retry', n_retry, 'dead', n_dead);
end $$;
revoke all on function workflow_worker(int, timestamptz) from public, anon, authenticated;

-- 9.3: siedem reguł startowych, wyłączonych, w każdym projekcie
insert into workflows (project_id, code, name, description, trigger_type, condition, actions, enabled)
select p.id, s.code, s.name, s.description, s.trigger_type, s.condition::jsonb, s.actions::jsonb, false
  from projects p
 cross join (values
  ('START-1', 'Dojazd na plac', 'Wjazd w strefę przed placem (PRE_ARRIVAL) → powiadomienie KSH i przewoźnika',
   'GEOFENCE_ENTER', '{"==":[{"var":"payload.geofence_kind"},"PRE_ARRIVAL"]}', '[{"type":"notify","audience":"KSH"},{"type":"notify","audience":"CARRIER"}]'),
  ('START-2', 'Wjazd przed port', 'Wjazd w strefę przed portem (PRE_PORT) → powiadomienie HHL',
   'GEOFENCE_ENTER', '{"==":[{"var":"payload.geofence_kind"},"PRE_PORT"]}', '[{"type":"notify","audience":"HHL"}]'),
  ('START-3', 'Rozładunek — wgraj POD', 'Rozładunek potwierdzony → przypomnienie przewoźnikowi o dokumencie POD',
   'MILESTONE_UNLOADED', 'true', '[{"type":"notify","audience":"CARRIER","text":"Wgraj POD w ciągu 24 h"}]'),
  ('START-4', 'Opóźnienie transportu', 'Wykryte opóźnienie → powiadomienie HHL i KSH',
   'DELAY_DETECTED', 'true', '[{"type":"notify","audience":"HHL"},{"type":"notify","audience":"KSH"}]'),
  ('START-5', 'Krytyczna zmiana daty w harmonogramie', 'Import zmienia datę na awizowanym transporcie → powiadomienie przewoźnika',
   'SCHEDULE_DATE_CRITICAL', 'true', '[{"type":"notify","audience":"CARRIER"}]'),
  ('START-6', 'Cichy pojazd', 'Brak pozycji pojazdu → powiadomienie przewoźnika',
   'SILENT_VEHICLE', 'true', '[{"type":"notify","audience":"CARRIER"}]'),
  ('START-7', 'Transport anulowany', 'Transport usunięty z harmonogramu → powiadomienie przewoźnika i sygnał ryzyka dla HHL',
   'STATUS_CANCELLED', 'true', '[{"type":"notify","audience":"CARRIER"},{"type":"risk","kind":"RESOURCE_MISSING","severity":"MEDIUM","title":"Transport anulowany"}]')
 ) as s(code, name, description, trigger_type, condition, actions)
on conflict (project_id, code) where code is not null do nothing;

do $g$
begin
  if (select count(*) from pg_trigger where tgname in ('load_events_workflows', 'workflows_validate') and not tgisinternal) <> 2 then
    raise exception '0094: brak wyzwalaczy silnika reguł';
  end if;
  if (select bool_and(prosecdef) from pg_proc where proname in ('workflow_worker', 'wf_action', 'wf_enqueue_event', 'wf_load_context')) is not true then
    raise exception '0094: funkcje silnika muszą być SECURITY DEFINER';
  end if;
  if (select not has_function_privilege('authenticated', 'workflow_worker(int, timestamptz)', 'execute')
          and not has_function_privilege('anon', 'workflow_worker(int, timestamptz)', 'execute')) is not true then
    raise exception '0094: workflow_worker tylko dla service_role';
  end if;
  if (select count(*) from workflows where code like 'START-%' and enabled) <> 0 then
    raise exception '0094: reguły startowe muszą być wyłączone';
  end if;
  if (wf_truthy(wf_logic('{"and":[{"==":[{"var":"a"},1]},{"in":["x",["x","y"]]}]}', '{"a":1}'))) is not true then
    raise exception '0094: wf_logic — autotest nieudany';
  end if;
end $g$;
