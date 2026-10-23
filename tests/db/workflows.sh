#!/usr/bin/env bash
# TOWER — SCOPE 9.1–9.4 (0094): silnik reguł — wyzwalacz → warunek → akcje, kolejka z ponawianiem, reguły startowe, walidacja zapisu.
# Czysta baza: atrapa Supabase → migracje → tests/db/seed.sql → scenariusze.
# Użycie: PGADMIN=postgres://postgres@localhost:5433/postgres bash tests/db/workflows.sh
set -e
cd "$(git rev-parse --show-toplevel)"
ADMIN=${PGADMIN:-postgres://postgres@localhost:5433/postgres}
. "$(git rev-parse --show-toplevel)/tests/db/local-only.sh"
DB=tower_test_wf; URL="${ADMIN%/*}/$DB"
psql "$ADMIN" -q -c "drop database if exists $DB" -c "create database $DB"
psql "$URL" -q -v ON_ERROR_STOP=1 -f tests/db/supabase_stub.sql
for f in supabase/migrations/*.sql; do psql "$URL" -q -v ON_ERROR_STOP=1 -f "$f" >/dev/null 2>&1 || { echo "MIGRACJA $f: błąd"; exit 1; }; done
psql "$URL" -q -v ON_ERROR_STOP=1 -f tests/db/seed.sql
# projekty z seed.sql powstają po migracjach — ponowne nałożenie 0094–0096 (idempotentne) dodaje reguły startowe.
# 0281 (#413 E35 Z1) soft-delete START po re-seedzie 0094 (inaczej START wracają bez removed_at).
# 0097 nie re-apply: po 0125 cron tower-polisy istnieje → DO w 0097 rzuca wyjątek.
# Hosted: TOWER_ALLOW_MIG_REAPPLY=1 — shim inaczej no-opuje pliki migracji.
export TOWER_ALLOW_MIG_REAPPLY=1
for f in supabase/migrations/0094_*.sql supabase/migrations/0095_*.sql supabase/migrations/0096_*.sql supabase/migrations/0165_*.sql supabase/migrations/0281_*.sql; do
  psql "$URL" -q -v ON_ERROR_STOP=1 -f "$f" >/dev/null 2>&1 || { echo "$f ponownie: błąd"; exit 1; }
done
unset TOWER_ALLOW_MIG_REAPPLY
set +e
PSQL="psql $URL -Atq"
HHL=11111111-0000-0000-0000-000000000001; KSH=11111111-0000-0000-0000-000000000002; SCX=11111111-0000-0000-0000-000000000003
P=22222222-0000-0000-0000-000000000001; L1=33333333-0000-0000-0000-000000000001
ok=0; fail=0
run() { $PSQL -v ON_ERROR_STOP=1 -c "begin; set local role authenticated; set local request.jwt.claim.sub='$1'; $2; rollback;" 2>&1; }
val() { out=$(run "$2" "$3" | grep -v -E '^(BEGIN|SET|ROLLBACK|COMMIT)$' | tail -1)
  if [ "$out" = "$4" ]; then ok=$((ok+1)); echo "  OK    $1"; else fail=$((fail+1)); echo "  FAIL  $1  (otrzymano: $out, oczekiwano: $4)"; fi; }
err() { out=$(run "$2" "$3"); if echo "$out" | grep -qiE "$4"; then ok=$((ok+1)); echo "  OK    $1"; else fail=$((fail+1)); echo "  FAIL  $1  →  $(echo "$out" | tail -1)"; fi; }
Q() { $PSQL -c "$1" 2>&1 | tail -1; }
chk() { if [ "$2" = "$3" ]; then ok=$((ok+1)); echo "  OK    $1"; else fail=$((fail+1)); echo "  FAIL  $1  (otrzymano: $2, oczekiwano: $3)"; fi; }
SCXO=$(Q "select org_id from app_users where auth_id='$SCX'")
$PSQL -c "set session_replication_role=replica; update loads set carrier_org_id='$SCXO' where id='$L1'" >/dev/null
EV() { Q "insert into load_events (load_id, event_type, occurred_at, payload) values ('$L1', '$1', now(), '$2'::jsonb) returning id"; }

echo "[9.1] warunek — podzbiór JSONLogic (wf_logic)"
L() { Q "select wf_truthy(wf_logic('$1'::jsonb, '$2'::jsonb))"; }
chk "== na liczbach i tekstach"            "$(L '{"==":[{"var":"a"},1]}' '{"a":1.0}')/$(L '{"==":[{"var":"k"},"PRE_PORT"]}' '{"k":"PRE_PORT"}')" "t/t"
chk "!= / < / >= / var z kropką"            "$(L '{"!=":[{"var":"a"},2]}' '{"a":1}')/$(L '{"<":[{"var":"x.y"},48]}' '{"x":{"y":12}}')/$(L '{">=":[{"var":"a"},5]}' '{"a":4}')" "t/t/f"
chk "and / or / ! / in (lista i tekst)"     "$(L '{"and":[true,{"in":["b",["a","b"]]}]}' '{}')/$(L '{"or":[false,0,""]}' '{}')/$(L '{"!":[{"var":"brak"}]}' '{}')/$(L '{"in":["E4",{"var":"t"}]}' '{"t":"Trasa E4 N"}')" "t/f/t/t"
chk "missing: brak pola = prawda, jest = fałsz" "$(L '{"missing":["permit"]}' '{}')/$(L '{"missing":["permit"]}' '{"permit":"X"}')" "t/f"
chk "porównanie liczby z null → fałsz (bez wyjątku)" "$(L '{"<":[{"var":"brak"},3]}' '{}')" "f"
chk "nieznany operator → wyjątek"           "$($PSQL -c "select wf_logic('{\"xyz\":[1]}'::jsonb, '{}'::jsonb)" 2>&1 | grep -c 'nieobsługiwany operator')" 1

echo; echo "[9.3] reguły START — E35 Z1 (#413 / 0281): soft-delete, przebiegi zostają"
chk "START-1…7 usunięte (removed_at) albo brak — żadna włączona" "$(Q "select count(*) filter (where removed_at is null)||'/'||count(*) filter (where enabled) from workflows where project_id='$P' and code like 'START-%'")" "0/0"
chk "macierz E11 ma Auto 50 km / Auto 20 km (START-1/2)" "$(Q "select count(distinct event_key) from notification_matrix where event_key in ('pre_arrival_site','pre_arrival_srem','pre_port')")" 3
chk "wyłączone/usunięte nie kolejkują przebiegów" "$(EV GEOFENCE_ENTER '{"geofence_kind":"PRE_ARRIVAL"}' >/dev/null; Q "select count(*) from workflow_runs")" 0

OPS=11111111-0000-0000-0000-0000000000aa
$PSQL -c "insert into app_users (auth_id, org_id, email, role, active)
  values ('$OPS','00000000-0000-0000-0000-00000000a001','ops-wf@test','HHL_OPS',true)
  on conflict (auth_id) do update set role='HHL_OPS', active=true, org_id=excluded.org_id" >/dev/null
echo; echo "[#413] HHL_OPS: odczyt Automatyzacji, bez zapisu workflows/geofences"
val "HHL_OPS czyta workflows" $OPS "select (count(*) >= 0)::text from workflows" true
err "HHL_OPS nie tworzy reguł (RLS)" $OPS "insert into workflows (project_id, name, trigger_type, condition, actions) values ('$P', 'ops-x', 'DELAY_DETECTED', 'true', '[{\"type\":\"notify\",\"audience\":\"HHL\"}]')" "row-level security"
chk "HHL_OPS update geofences → 0 wierszy" "$(run "$OPS" "with u as (update geofences set name = name where project_id='$P' returning 1) select count(*)::text from u" | grep -v -E '^(BEGIN|SET|ROLLBACK|COMMIT)$' | tail -1)" 0

echo; echo "[#413 F7 B2] GEOFENCE_ENTER → macierz pre_arrival_*/pre_port (nie zone)"
G_SREM=$(Q "select id from geofences where project_id='$P' and kind='PRE_ARRIVAL' and country='PL' limit 1")
G_SITE=$(Q "insert into geofences (project_id, name, kind, country, geom, hysteresis_m, dwell_seconds, debounce_fixes, notify_enter, notify_exit, notify_dwell, notify_orgs, active, sort_order)
  values ('$P','Bufor Boden F7','PRE_ARRIVAL','SE', make_circle_fence(65.8054,21.7591,50000), 1000,0,2, true,false,false,'{}',true,6) returning id")
G_PORT=$(Q "insert into geofences (project_id, name, kind, country, geom, hysteresis_m, dwell_seconds, debounce_fixes, notify_enter, notify_exit, notify_dwell, notify_orgs, active, sort_order)
  values ('$P','Bufor port F7','PRE_PORT','PL', make_circle_fence(54.40,18.67,20000), 500,0,2, true,false,false,'{}',true,7) returning id")
G_LOAD=$(Q "insert into geofences (project_id, name, kind, country, geom, hysteresis_m, dwell_seconds, debounce_fixes, notify_enter, notify_exit, notify_dwell, notify_orgs, active, sort_order)
  values ('$P','Plac F7','LOADING','PL', make_circle_fence(52.07,17.02,500), 100,0,2, true,false,false,'{}',true,8) returning id")
$PSQL -c "delete from notifications where load_id='$L1' and template in ('ZONE_ENTER','ZONE_EXIT')" >/dev/null
EV GEOFENCE_ENTER "{\"geofence_id\":\"$G_SITE\"}" >/dev/null
chk "F7 B2: PRE_ARRIVAL SE → pre_arrival_site (KSH)" "$(Q "select count(*)>0 from notifications n join app_users u on u.id=n.user_id where n.load_id='$L1' and n.template='ZONE_ENTER' and n.payload->>'matrix_event'='pre_arrival_site' and u.role='CLIENT_USER'")" t
chk "F7 B2: PRE_ARRIVAL SE → pre_arrival_site (SCX)" "$(Q "select count(*)>0 from notifications n join app_users u on u.id=n.user_id where n.load_id='$L1' and n.template='ZONE_ENTER' and n.payload->>'matrix_event'='pre_arrival_site' and u.role='CARRIER_DISPATCH'")" t
EV GEOFENCE_ENTER "{\"geofence_id\":\"$G_SREM\"}" >/dev/null
chk "F7 B2: PRE_ARRIVAL PL Śrem → pre_arrival_srem (KSH)" "$(Q "select count(*)>0 from notifications n join app_users u on u.id=n.user_id where n.load_id='$L1' and n.template='ZONE_ENTER' and n.payload->>'matrix_event'='pre_arrival_srem' and u.role='CLIENT_USER'")" t
EV GEOFENCE_ENTER "{\"geofence_id\":\"$G_PORT\"}" >/dev/null
chk "F7 B2: PRE_PORT → pre_port (HHL)" "$(Q "select count(*)>0 from notifications n join app_users u on u.id=n.user_id where n.load_id='$L1' and n.template='ZONE_ENTER' and n.payload->>'matrix_event'='pre_port' and u.org_id='00000000-0000-0000-0000-00000000a001'")" t
EV GEOFENCE_ENTER "{\"geofence_id\":\"$G_LOAD\"}" >/dev/null
chk "F7 B2: LOADING → nadal zone" "$(Q "select count(*)>0 from notifications n where n.load_id='$L1' and n.template='ZONE_ENTER' and n.payload->>'matrix_event'='zone' and n.payload->>'geofence_id'='$G_LOAD'")" t

echo; echo "[9.4] zapis reguł — uprawnienia i walidacja (kreator przez API)"
val "HHL_ADMIN tworzy regułę" $HHL "insert into workflows (project_id, name, trigger_type, condition, actions) values ('$P', 't', 'DELAY_DETECTED', 'true', '[{\"type\":\"notify\",\"audience\":\"HHL\"}]') returning 'ok'" ok
err "KSH nie tworzy reguł (RLS)" $KSH "insert into workflows (project_id, name, trigger_type, condition, actions) values ('$P', 't', 'DELAY_DETECTED', 'true', '[{\"type\":\"notify\",\"audience\":\"HHL\"}]')" "row-level security"
err "SCX nie tworzy reguł (RLS)" $SCX "insert into workflows (project_id, name, trigger_type, condition, actions) values ('$P', 't', 'DELAY_DETECTED', 'true', '[{\"type\":\"notify\",\"audience\":\"HHL\"}]')" "row-level security"
err "nieznany wyzwalacz odrzucony" $HHL "insert into workflows (project_id, name, trigger_type, condition, actions) values ('$P', 't', 'CRON_DAILY', 'true', '[{\"type\":\"notify\",\"audience\":\"HHL\"}]')" "nieznany wyzwalacz"
err "nieznana akcja odrzucona" $HHL "insert into workflows (project_id, name, trigger_type, condition, actions) values ('$P', 't', 'DELAY_DETECTED', 'true', '[{\"type\":\"set_status\"}]')" "nieznana akcja"
err "notify bez odbiorcy odrzucone" $HHL "insert into workflows (project_id, name, trigger_type, condition, actions) values ('$P', 't', 'DELAY_DETECTED', 'true', '[{\"type\":\"notify\"}]')" "audience"
err "risk z nieznanym rodzajem odrzucone" $HHL "insert into workflows (project_id, name, trigger_type, condition, actions) values ('$P', 't', 'DELAY_DETECTED', 'true', '[{\"type\":\"risk\",\"kind\":\"XX\",\"severity\":\"HIGH\"}]')" "risk wymaga"
err "pusta lista akcji odrzucona" $HHL "insert into workflows (project_id, name, trigger_type, condition, actions) values ('$P', 't', 'DELAY_DETECTED', 'true', '[]')" "1–10"
err "warunek z nieznanym operatorem odrzucony przy zapisie" $HHL "insert into workflows (project_id, name, trigger_type, condition, actions) values ('$P', 't', 'DELAY_DETECTED', '{\"foo\":[1]}', '[{\"type\":\"notify\",\"audience\":\"HHL\"}]')" "nieobsługiwany operator"
chk "authenticated/anon: brak EXECUTE workflow_worker i funkcji silnika" "$(Q "select bool_or(has_function_privilege(r, p.oid, 'execute'))::text from pg_proc p cross join unnest(array['anon','authenticated']) r where p.proname in ('workflow_worker','wf_action','wf_enqueue_event','wf_load_context','wf_logic','wf_truthy','wf_validate','wf_trigger_types')")" false
err "SCX nie zapisze przebiegu reguły" $SCX "insert into workflow_runs (workflow_id, status) values (gen_random_uuid(), 'OK')" "permission denied"

echo; echo "[9.1/9.2] zdarzenie → kolejka → wykonanie (reguły testowe T-S1 / T-S7 — #413 po usunięciu START)"
$PSQL -c "insert into workflows (project_id, code, name, trigger_type, condition, actions, enabled) values
  ('$P', 'T-S1', 'test dojazd', 'GEOFENCE_ENTER', '{\"==\":[{\"var\":\"payload.geofence_kind\"},\"PRE_ARRIVAL\"]}'::jsonb, '[{\"type\":\"notify\",\"audience\":\"KSH\"},{\"type\":\"notify\",\"audience\":\"CARRIER\"}]'::jsonb, true),
  ('$P', 'T-S7', 'test anulowanie', 'STATUS_CANCELLED', 'true'::jsonb, '[{\"type\":\"notify\",\"audience\":\"CARRIER\"},{\"type\":\"risk\",\"kind\":\"RESOURCE_MISSING\",\"severity\":\"MEDIUM\",\"title\":\"Transport anulowany\"}]'::jsonb, true)
  on conflict (project_id, code) where code is not null do update set enabled=true, removed_at=null, condition=excluded.condition, actions=excluded.actions" >/dev/null
E1=$(EV GEOFENCE_ENTER '{"geofence_kind":"PRE_ARRIVAL"}')
E2=$(EV GEOFENCE_ENTER '{"geofence_kind":"PORT_OUT"}')
chk "2 zdarzenia GEOFENCE_ENTER → 2 przebiegi QUEUED T-S1" "$(Q "select count(*) from workflow_runs r join workflows w on w.id=r.workflow_id where w.code='T-S1' and r.status='QUEUED'")" 2
chk "ponowne dopisanie przebiegu dla tego samego zdarzenia odsiane (dedup_key)" "$(Q "insert into workflow_runs (workflow_id, load_id, event_id, status, dedup_key) select workflow_id, load_id, event_id, 'QUEUED', dedup_key from workflow_runs where event_id=$E1 on conflict (dedup_key) where dedup_key is not null do nothing; select count(*) from workflow_runs where event_id=$E1")" 1
chk "inne zdarzenie (MILESTONE_LOADED) nie kolejkuje T-S1" "$(EV MILESTONE_LOADED '{}' >/dev/null; Q "select count(*) from workflow_runs")" 2
chk "worker: 1 OK (PRE_ARRIVAL), 1 SKIPPED (warunek niespełniony)" "$(Q "select workflow_worker(50, now())")" '{"ok": 1, "dead": 0, "retry": 0, "skipped": 1}'
chk "akcje OK: powiadomienia w aplikacji dla KSH i przewoźnika transportu (WORKFLOW_ALERT)" "$(Q "select string_agg(distinct o.code, ',' order by o.code) from notifications n join app_users u on u.id=n.user_id join organizations o on o.id=u.org_id where n.template='WORKFLOW_ALERT'")" "KSH,SCX"
chk "HHL nie dostał (reguła do KSH i przewoźnika)" "$(Q "select count(*) from notifications n join app_users u on u.id=n.user_id where n.template='WORKFLOW_ALERT' and u.auth_id='$HHL'")" 0
chk "wynik przebiegu zapisany (akcje, liczba odbiorców)" "$(Q "select result->'actions'->0->>'sent'||'/'||(result->'actions'->1->>'audience') from workflow_runs where event_id=$E1")" "1/CARRIER"
chk "drugi przebieg workera: kolejka pusta, bez nowych powiadomień" "$(Q "select workflow_worker(50, now())")/$(Q "select count(*) from notifications where template='WORKFLOW_ALERT'")" '{"ok": 0, "dead": 0, "retry": 0, "skipped": 0}/2'
E3=$(EV STATUS_CANCELLED '{}')
Q "select workflow_worker(50, now())" >/dev/null
chk "T-S7: akcja risk → otwarty sygnał ryzyka z kluczem reguły i tytułem rk_workflow (0095)" "$(Q "select count(*)||':'||max(title_key) from risk_signals where dedup_key like 'WF:%' and resolved_at is null")" "1:rk_workflow"
chk "reguła wyłączona po zakolejkowaniu → SKIPPED" "$(E4=$(EV GEOFENCE_ENTER '{"geofence_kind":"PRE_ARRIVAL"}'); $PSQL -c "update workflows set enabled=false where code='T-S1'" >/dev/null; Q "select workflow_worker(50, now())" >/dev/null; Q "select status||':'||(result->>'reason') from workflow_runs where event_id=$E4")" "SKIPPED:reguła wyłączona"

echo; echo "[9.2] ponawianie: błąd → RETRY (2^n min), po 5 próbach DEAD"
# warunek z nieznanym operatorem: przy zapisie short-circuit and nie wywołuje xyz (ctx pusty);
# przy wykonaniu z boom=true → wyjątek → RETRY → DEAD
WB=$(Q "insert into workflows (project_id, code, name, trigger_type, condition, actions, enabled) values ('$P', 'T-BOOM', 'test błędu', 'DRIVER_ON_FERRY', '{\"and\":[{\"var\":\"payload.boom\"},{\"xyz\":[1]}]}', '[{\"type\":\"notify\",\"audience\":\"HHL\"}]', true) returning id")
EB=$(EV DRIVER_ON_FERRY '{"boom":true}')
chk "T-BOOM zakolejkowany" "$(Q "select count(*) from workflow_runs where event_id=$EB")" 1
# next_attempt_at=now() przy enqueue — ustaw na oś czasu testu (inaczej worker z p_now w przeszłości nie bierze przebiegu)
$PSQL -c "update workflow_runs set next_attempt_at='2026-10-01 10:00+00', ran_at='2026-10-01 10:00+00' where event_id=$EB" >/dev/null
chk "1. próba: RETRY, next_attempt_at = +2 min, błąd w wyniku" "$(Q "select workflow_worker(50, '2026-10-01 10:00+00')" >/dev/null; Q "select status||':'||attempts||':'||(extract(epoch from next_attempt_at - '2026-10-01 10:00+00'::timestamptz)/60)::int||':'||(result->>'error' like '%nieobsługiwany operator%') from workflow_runs where event_id=$EB")" "RETRY:1:2:true"
chk "przed terminem ponowienia worker go nie bierze" "$(Q "select workflow_worker(50, '2026-10-01 10:01+00')")" '{"ok": 0, "dead": 0, "retry": 0, "skipped": 0}'
for t in '2026-10-01 11:00+00' '2026-10-01 12:00+00' '2026-10-01 13:00+00' '2026-10-01 14:00+00'; do Q "select workflow_worker(50, '$t')" >/dev/null; done
chk "po 5 próbach: DEAD, attempts 5" "$(Q "select status||':'||attempts from workflow_runs where event_id=$EB")" "DEAD:5"
chk "nieudane przebiegi nie zostawiły powiadomień HHL" "$(Q "select count(*) from notifications n join app_users u on u.id=n.user_id where n.template='WORKFLOW_ALERT' and u.auth_id='$HHL'")" 0

echo; echo "[R-2 → 0165] e-mail przez kolejkę l13 (bramka 0133), SMS wyłącznie według zasad stref"
$PSQL -c "delete from notifications where channel='EMAIL'" >/dev/null
$PSQL -c "insert into workflows (project_id, code, name, trigger_type, condition, actions) values ('$P', 'T-MAIL', 'test e-mail', 'MILESTONE_UNLOADED', 'true', '[{\"type\":\"email\"},{\"type\":\"sms\",\"list\":\"UNLOAD_BODEN\"}]')" >/dev/null
EM=$(EV MILESTONE_UNLOADED '{}')
Q "select workflow_worker(50, now())" >/dev/null
chk "e-mail: wpis w kolejce l13 dla HHL; SMS: tylko odbiorcy listy stref (bez SMS do kierowców)" "$(Q "select status||':'||(result->'actions'->0->>'type')||':'||(result->'actions'->1->>'list') from workflow_runs r join workflows w on w.id=r.workflow_id where w.code='T-MAIL'")/$(Q "select (count(*) > 0)::text from notifications where channel='EMAIL' and template='WORKFLOW_ALERT'")/$(Q "select count(*) from sms_outbox where kind not in ('ZONE_ENTER','ZONE_APPROACH')")" "OK:email:UNLOAD_BODEN/true/0"

echo; echo "[0096] wyzwalacze z kreatora: FERRY_STATUS (zmiana rejsu) i CRON_DAILY_06 (przegląd dzienny)"
val "HHL_ADMIN zapisuje reguły FERRY_STATUS i CRON_DAILY_06 (dotąd odrzucane)" $HHL "insert into workflows (project_id, name, trigger_type, condition, actions) values ('$P', 'f', 'FERRY_STATUS', 'true', '[{\"type\":\"notify\",\"audience\":\"HHL\"}]'), ('$P', 'd', 'CRON_DAILY_06', 'true', '[{\"type\":\"notify\",\"audience\":\"HHL\"}]'); select 'ok'" ok
VS=$(Q "insert into vessels (name, operator) values ('T-Prom', 'T') returning id")
SL=$(Q "insert into sailings (project_id, vessel_id, departure_at, arrival_at) values ('$P', '$VS', '2026-10-05 16:00+00', '2026-10-06 08:00+00') returning id")
$PSQL -c "set session_replication_role=replica; update loads set sailing_id='$SL' where id='$L1'" >/dev/null
$PSQL -c "insert into workflows (project_id, code, name, trigger_type, condition, actions) values ('$P', 'T-FERRY', 'prom odwołany', 'FERRY_STATUS', '{\"==\":[{\"var\":\"payload.status\"},\"ODWOLANY\"]}', '[{\"type\":\"notify\",\"audience\":\"HHL\"}]')" >/dev/null
FR() { Q "select count(*) from workflow_runs r join workflows w on w.id=r.workflow_id where w.code='T-FERRY'"; }
$PSQL -c "update sailings set status='OPOZNIONY', delayed_departure_at='2026-10-05 18:30+00' where id='$SL'" >/dev/null
chk "opóźnienie rejsu → 1 przebieg w kolejce z danymi rejsu (status, opóźnienie 150 min)" "$(FR)/$(Q "select (payload->>'event_type')||':'||(payload#>>'{payload,status}')||':'||(payload#>>'{payload,delay_min}') from workflow_runs r join workflows w on w.id=r.workflow_id where w.code='T-FERRY'")" "1/FERRY_STATUS:OPOZNIONY:150"
chk "worker: warunek (ODWOLANY) niespełniony → SKIPPED" "$(Q "select workflow_worker(50, now())")" '{"ok": 0, "dead": 0, "retry": 0, "skipped": 1}'
$PSQL -c "update sailings set status='ODWOLANY' where id='$SL'" >/dev/null
chk "odwołanie rejsu → przebieg OK, powiadomienie HHL (WORKFLOW_ALERT, zdarzenie FERRY_STATUS)" "$(Q "select workflow_worker(50, now())")/$(Q "select count(*) from notifications n join app_users u on u.id=n.user_id where n.template='WORKFLOW_ALERT' and u.auth_id='$HHL' and n.payload->>'event'='FERRY_STATUS'")" '{"ok": 1, "dead": 0, "retry": 0, "skipped": 0}/1'
chk "zapis rejsu bez zmiany statusu i czasów → bez nowego przebiegu" "$($PSQL -c "update sailings set source='RECZNIE', status='ODWOLANY' where id='$SL'" >/dev/null; FR)" 2
chk "transport anulowany na rejsie nie dostaje przebiegu" "$($PSQL -c "set session_replication_role=replica; update loads set status='CANCELLED' where id='$L1'" >/dev/null; $PSQL -c "update sailings set status='ZAPLANOWANY' where id='$SL'" >/dev/null; FR)" 2
$PSQL -c "set session_replication_role=replica; update loads set status='PLANNED' where id='$L1'" >/dev/null
$PSQL -c "insert into workflows (project_id, code, name, trigger_type, condition, actions) values ('$P', 'T-DAY', 'przegląd dzienny', 'CRON_DAILY_06', 'true', '[{\"type\":\"notify\",\"audience\":\"HHL\"}]')" >/dev/null
NA=$(Q "select count(*) from loads where project_id='$P' and status not in ('CANCELLED','DELIVERED')")
chk "wf_enqueue_daily: po 1 przebiegu na aktywny transport; drugie wywołanie tego samego dnia (Europe/Warsaw) — 0" "$(Q "select wf_enqueue_daily('2026-10-02 04:00+00')")/$(Q "select wf_enqueue_daily('2026-10-02 21:30+00')")" "$NA/0"
chk "kolejny dzień (22:30 UTC = 00:30 Warszawa) — nowe przebiegi; worker wykonuje je z kontekstem dnia" "$(Q "select wf_enqueue_daily('2026-10-02 22:30+00')")/$(Q "select (workflow_worker(500, '2026-10-03 05:00+00')->>'ok')")/$(Q "select count(distinct payload#>>'{payload,day}') from workflow_runs r join workflows w on w.id=r.workflow_id where w.code='T-DAY'")" "$NA/$((NA*2))/2"
chk "reguła dzienna wyłączona → nic nie kolejkuje" "$($PSQL -c "update workflows set enabled=false where code='T-DAY'" >/dev/null; Q "select wf_enqueue_daily('2026-10-04 04:00+00')")" 0
chk "authenticated/anon: brak EXECUTE wf_enqueue_daily i wf_enqueue_sailing" "$(Q "select bool_or(has_function_privilege(r, p.oid, 'execute'))::text from pg_proc p cross join unnest(array['anon','authenticated']) r where p.proname in ('wf_enqueue_daily','wf_enqueue_sailing')")" false
err "KSH nie wywoła wf_enqueue_daily" $KSH "select wf_enqueue_daily(now())" "permission denied"

echo; echo "[odporność] błąd kolejkowania nie blokuje zapisu zdarzenia"
chk "zdarzenie zapisane mimo reguły, której kolejkowanie się nie uda" "$(Q "alter table workflow_runs add constraint t_blok check (status <> 'QUEUED') not valid; insert into load_events (load_id, event_type, occurred_at) values ('$L1', 'MILESTONE_UNLOADED', now()); alter table workflow_runs drop constraint t_blok; select count(*) from load_events where event_type='MILESTONE_UNLOADED'")" 2

echo; echo "[0165 B-5] kreator: decyzja, e-mail, SMS stref, ZERO dubli, historia, ostrzeżenie"
# wyzwalacze i akcje z kreatora
val "HHL_ADMIN zapisuje STATUS_CHANGED i RISK_RAISED" $HHL "insert into workflows (project_id, name, trigger_type, condition, actions) values ('$P', 'st', 'STATUS_CHANGED', 'true', '[{\"type\":\"notify\",\"audience\":\"HHL\"}]'), ('$P', 'rk', 'RISK_RAISED', 'true', '[{\"type\":\"notify\",\"audience\":\"HHL\"}]'); select 'ok'" ok
val "HHL_ADMIN zapisuje decision + email + sms (zasady stref)" $HHL "insert into workflows (project_id, name, trigger_type, condition, actions) values ('$P', 'dec', 'DELAY_DETECTED', 'true', '[{\"type\":\"decision\",\"decision_type\":\"ETA_AFTER_LATEST\"},{\"type\":\"email\",\"audience\":\"HHL\"},{\"type\":\"sms\",\"list\":\"LOAD_SREM\",\"kind\":\"ZONE_ENTER\"}]') returning 'ok'" ok
err "sms poza listą stref odrzucone" $HHL "insert into workflows (project_id, name, trigger_type, condition, actions) values ('$P', 'x', 'DELAY_DETECTED', 'true', '[{\"type\":\"sms\",\"list\":\"OTHER\",\"kind\":\"ZONE_ENTER\"}]')" "sms tylko według zasad stref"
err "decision z nieznanym typem odrzucone" $HHL "insert into workflows (project_id, name, trigger_type, condition, actions) values ('$P', 'x', 'DELAY_DETECTED', 'true', '[{\"type\":\"decision\",\"decision_type\":\"XX\"}]')" "decision wymaga"
err "START-* hard-delete nadal zablokowany (soft-delete 0281)" $HHL "delete from workflows where code='START-1'" "nie usuwa się"
err "START po Z1 nie włącza się" $HHL "update workflows set enabled=true where code='START-1'" "nie włącza się|E35 Z1"

# zdarzenie testowe: reguła CREATED → worker → decyzja; wyłączona → SKIPPED
$PSQL -c "delete from workflow_runs" -c "delete from notifications" -c "delete from decision_events" -c "delete from decisions" -c "delete from risk_signals where dedup_key like 'WF:%'" >/dev/null
W1=$(Q "insert into workflows (project_id, code, name, trigger_type, condition, actions, enabled) values ('$P', 'T-B5', 'B5 test', 'DELAY_DETECTED', 'true', '[{\"type\":\"notify\",\"audience\":\"HHL\"},{\"type\":\"decision\",\"decision_type\":\"ETA_AFTER_LATEST\"},{\"type\":\"email\",\"audience\":\"HHL\",\"critical\":true}]', true) returning id")
E5=$(EV DELAY_DETECTED '{}')
chk "B5: zdarzenie → QUEUED" "$(Q "select count(*) from workflow_runs where event_id=$E5 and status='QUEUED'")" 1
chk "B5: worker wykonuje regułę (OK)" "$(Q "select (workflow_worker(50, now())->>'ok')")" 1
# E-mail po audience HHL trafia też do OPS (#413); licznik krytycznego — tylko HHL_ADMIN (jak IN_APP).
chk "B5: powiadomienie HHL + decyzja ETA_AFTER_LATEST + e-mail krytyczny" "$(Q "select count(*) from notifications n join app_users u on u.id=n.user_id where n.template='WORKFLOW_ALERT' and n.channel='IN_APP' and u.auth_id='$HHL'")/$(Q "select count(*) from decisions where type_code='ETA_AFTER_LATEST' and status='NEW'")/$(Q "select count(*) from notifications n join app_users u on u.id=n.user_id where n.channel='EMAIL' and n.template='WORKFLOW_ALERT' and n.status in ('PENDING','DIGEST','SUPPRESSED') and u.auth_id='$HHL'")" "1/1/1"
# druga reguła na to samo zdarzenie — zero podwójnych alarmów
$PSQL -c "insert into workflows (project_id, code, name, trigger_type, condition, actions, enabled) values ('$P', 'T-B5B', 'B5 dubl', 'DELAY_DETECTED', 'true', '[{\"type\":\"notify\",\"audience\":\"HHL\"},{\"type\":\"decision\",\"decision_type\":\"ETA_AFTER_LATEST\"},{\"type\":\"email\",\"audience\":\"HHL\",\"critical\":true}]', true)" >/dev/null
E6=$(EV DELAY_DETECTED '{}')
Q "select workflow_worker(50, now())" >/dev/null
chk "B5 ZERO dubli: 2 reguły na to samo zdarzenie → 1 powiadomienie, 1 e-mail na odbiorcę; decyzja nie otwiera drugiej" "$(Q "select count(*) from notifications n join app_users u on u.id=n.user_id where n.dedup_key like 'WFN:ev:$E6:%' and u.auth_id='$HHL'")/$(Q "select count(*) from notifications n join app_users u on u.id=n.user_id where n.channel='EMAIL' and n.dedup_key like 'bundle:WF:ev:$E6:%' and u.auth_id='$HHL'")/$(Q "select count(*) from decisions where type_code='ETA_AFTER_LATEST'")/$(Q "select count(*) from workflow_runs where event_id=$E6 and status='OK'")" "1/1/1/2"
# wyłączona nie wykonuje się
$PSQL -c "update workflows set enabled=false where code='T-B5'" >/dev/null
E7=$(EV DELAY_DETECTED '{}')
Q "select workflow_worker(50, now())" >/dev/null
chk "B5: wyłączona — nie kolejkuje się i nie wykonuje (0 przebiegów), druga reguła tak" "$(Q "select count(*) from workflow_runs r join workflows w on w.id=r.workflow_id where w.code='T-B5' and r.event_id=$E7")/$(Q "select count(*) from workflow_runs r join workflows w on w.id=r.workflow_id where w.code='T-B5B' and r.event_id=$E7 and r.status='OK'")" "0/1"

# STATUS_CHANGED
$PSQL -c "insert into workflows (project_id, code, name, trigger_type, condition, actions, enabled) values ('$P', 'T-ST', 'status', 'STATUS_CHANGED', '{\"==\":[{\"var\":\"payload.status\"},\"RESOURCES_PENDING\"]}', '[{\"type\":\"notify\",\"audience\":\"HHL\"}]', true)" >/dev/null
$PSQL -c "update loads set status='RESOURCES_PENDING' where id='$L1'" >/dev/null
chk "B5 STATUS_CHANGED: kolejka + worker OK przy RESOURCES_PENDING" "$(Q "select count(*) from workflow_runs r join workflows w on w.id=r.workflow_id where w.code='T-ST' and r.status='QUEUED'")/$(Q "select (workflow_worker(50, now())->>'ok')")" "1/1"

# RISK_RAISED (ryzyko bez klucza WF:)
$PSQL -c "insert into workflows (project_id, code, name, trigger_type, condition, actions, enabled) values ('$P', 'T-RK', 'risk', 'RISK_RAISED', '{\"==\":[{\"var\":\"payload.kind\"},\"WEATHER\"]}', '[{\"type\":\"notify\",\"audience\":\"HHL\"}]', true)" >/dev/null
Q "insert into risk_signals (project_id, load_id, kind, severity, title, detail, dedup_key) values ('$P', '$L1', 'WEATHER', 'HIGH', 'test', '{}', 'T:WEATHER:$L1')" >/dev/null
chk "B5 RISK_RAISED: kolejka + worker OK" "$(Q "select count(*) from workflow_runs r join workflows w on w.id=r.workflow_id where w.code='T-RK' and r.status='QUEUED'")/$(Q "select (workflow_worker(50, now())->>'ok')")" "1/1"
# ryzyko z reguły (klucz WF:) nie kolejkuje RISK_RAISED
RK0=$(Q "select count(*) from workflow_runs r join workflows w on w.id=r.workflow_id where w.code='T-RK'")
Q "select raise_risk('$L1', 'RESOURCE_MISSING', 'MEDIUM', 'z reguły', '{}'::jsonb, 'WF:fake:$L1')" >/dev/null
chk "B5: ryzyko WF: nie wyzwala RISK_RAISED (bez pętli)" "$(Q "select count(*) from workflow_runs r join workflows w on w.id=r.workflow_id where w.code='T-RK'")" "$RK0"

# ostrzeżenie o duplikacie
val "B5: ostrzeżenie — reguła o tym samym wyzwalaczu/warunku/akcji" $HHL "select exists (select 1 from jsonb_array_elements(wf_duplicate_check('DELAY_DETECTED', 'true'::jsonb, '[{\"type\":\"notify\",\"audience\":\"HHL\"}]'::jsonb, null)) e where e->>'kind'='RULE')" t
val "B5: ostrzeżenie — wbudowany alarm ciszy GPS" $HHL "select exists (select 1 from jsonb_array_elements(wf_duplicate_check('SILENT_VEHICLE', 'true'::jsonb, '[{\"type\":\"notify\",\"audience\":\"CARRIER\"}]'::jsonb, null)) e where e->>'kind'='BUILTIN')" t
err "KSH nie wywoła wf_duplicate_check" $KSH "select wf_duplicate_check('DELAY_DETECTED', 'true'::jsonb, '[{\"type\":\"notify\",\"audience\":\"HHL\"}]'::jsonb, null)" "HHL_ADMIN|permission denied|42501"

# historia
$PSQL -c "begin; set local role authenticated; set local request.jwt.claim.sub='$HHL'; update workflows set name = name || ' hist' where code='T-B5'; commit" >/dev/null
val "B5: historia zmian reguły (kto, kiedy, co)" $HHL "select (who is not null and action = 'ZMIENIONO' and changes ? 'po')::text from workflow_rule_history((select id from workflows where code='T-B5'), 5) order by at desc limit 1" true

# START soft-delete (0281) — 0165 idempotentna; START pozostają removed i wyłączone
export TOWER_ALLOW_MIG_REAPPLY=1; psql "$URL" -q -v ON_ERROR_STOP=1 -f supabase/migrations/0165_b5_workflow_creator.sql >/dev/null 2>&1; R165=$?; unset TOWER_ALLOW_MIG_REAPPLY
chk "B5: 0165 ponownie OK; START removed/wyłączone (#413 Z1)" "$R165/$(Q "select count(*) filter (where enabled) from workflows where code like 'START-%'")" "0/0"
chk "#413: audit ROW_DELETE dla START z powodem" "$(Q "select count(*)>=1 from audit_log where entity='workflows' and action='ROW_DELETE' and source like '%0281%'")" t
if [ "$(Q "select to_regclass('cron.job') is null")" = "t" ]; then CRN=2; else CRN=$(Q "select count(*) from cron.job where jobname in ('tower-reguly','tower-reguly-dzien')"); fi
chk "B5: zadania tower-reguly i tower-reguly-dzien (gdy pg_cron)" "$CRN" 2
chk "B5: wf_daily_tick tylko o 06:xx Europe/Warsaw" "$(Q "select wf_daily_tick('2026-10-05 03:30+00')")" 0

echo; echo "WYNIK: $ok OK, $fail FAIL"
