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
# projekty z seed.sql powstają po migracjach — ponowne nałożenie 0094+ (idempotentne) dodaje reguły startowe, jak na produkcji
for f in supabase/migrations/009[4-9]_*.sql; do psql "$URL" -q -v ON_ERROR_STOP=1 -f "$f" >/dev/null 2>&1 || { echo "$f ponownie: błąd"; exit 1; }; done
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

echo; echo "[9.3] reguły startowe"
chk "7 reguł START-1…7 w projekcie, wszystkie wyłączone" "$(Q "select count(*)||'/'||count(*) filter (where enabled) from workflows where project_id='$P' and code like 'START-%'")" "7/0"
chk "wyłączone reguły nie kolejkują przebiegów" "$(EV GEOFENCE_ENTER '{"geofence_kind":"PRE_ARRIVAL"}' >/dev/null; Q "select count(*) from workflow_runs")" 0

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

echo; echo "[9.1/9.2] zdarzenie → kolejka → wykonanie"
$PSQL -c "update workflows set enabled = true where project_id='$P' and code in ('START-1','START-7')" >/dev/null
E1=$(EV GEOFENCE_ENTER '{"geofence_kind":"PRE_ARRIVAL"}')
E2=$(EV GEOFENCE_ENTER '{"geofence_kind":"PORT_OUT"}')
chk "2 zdarzenia GEOFENCE_ENTER → 2 przebiegi QUEUED START-1" "$(Q "select count(*) from workflow_runs r join workflows w on w.id=r.workflow_id where w.code='START-1' and r.status='QUEUED'")" 2
chk "ponowne dopisanie przebiegu dla tego samego zdarzenia odsiane (dedup_key)" "$(Q "insert into workflow_runs (workflow_id, load_id, event_id, status, dedup_key) select workflow_id, load_id, event_id, 'QUEUED', dedup_key from workflow_runs where event_id=$E1 on conflict (dedup_key) where dedup_key is not null do nothing; select count(*) from workflow_runs where event_id=$E1")" 1
chk "inne zdarzenie (MILESTONE_LOADED) nie kolejkuje START-1" "$(EV MILESTONE_LOADED '{}' >/dev/null; Q "select count(*) from workflow_runs")" 2
chk "worker: 1 OK (PRE_ARRIVAL), 1 SKIPPED (warunek niespełniony)" "$(Q "select workflow_worker(50, now())")" '{"ok": 1, "dead": 0, "retry": 0, "skipped": 1}'
chk "akcje OK: powiadomienia w aplikacji dla KSH i przewoźnika transportu (WORKFLOW_ALERT)" "$(Q "select string_agg(distinct o.code, ',' order by o.code) from notifications n join app_users u on u.id=n.user_id join organizations o on o.id=u.org_id where n.template='WORKFLOW_ALERT'")" "KSH,SCX"
chk "HHL nie dostał (reguła do KSH i przewoźnika)" "$(Q "select count(*) from notifications n join app_users u on u.id=n.user_id where n.template='WORKFLOW_ALERT' and u.auth_id='$HHL'")" 0
chk "wynik przebiegu zapisany (akcje, liczba odbiorców)" "$(Q "select result->'actions'->0->>'sent'||'/'||(result->'actions'->1->>'audience') from workflow_runs where event_id=$E1")" "1/CARRIER"
chk "drugi przebieg workera: kolejka pusta, bez nowych powiadomień" "$(Q "select workflow_worker(50, now())")/$(Q "select count(*) from notifications where template='WORKFLOW_ALERT'")" '{"ok": 0, "dead": 0, "retry": 0, "skipped": 0}/2'
E3=$(EV STATUS_CANCELLED '{}')
Q "select workflow_worker(50, now())" >/dev/null
chk "START-7: akcja risk → otwarty sygnał ryzyka z kluczem reguły i tytułem rk_workflow (0095)" "$(Q "select count(*)||':'||max(title_key) from risk_signals where dedup_key like 'WF:%' and resolved_at is null")" "1:rk_workflow"
chk "reguła wyłączona po zakolejkowaniu → SKIPPED" "$(E4=$(EV GEOFENCE_ENTER '{"geofence_kind":"PRE_ARRIVAL"}'); $PSQL -c "update workflows set enabled=false where code='START-1'" >/dev/null; Q "select workflow_worker(50, now())" >/dev/null; Q "select status||':'||(result->>'reason') from workflow_runs where event_id=$E4")" "SKIPPED:reguła wyłączona"

echo; echo "[9.2] ponawianie: błąd → RETRY (2^n min), po 5 próbach DEAD"
WB=$(Q "insert into workflows (project_id, code, name, trigger_type, condition, actions) values ('$P', 'T-BOOM', 'test błędu', 'DRIVER_ON_FERRY', '{\"and\":[{\"var\":\"payload.boom\"},{\"xyz\":[1]}]}', '[{\"type\":\"notify\",\"audience\":\"HHL\"}]') returning id")
EB=$(EV DRIVER_ON_FERRY '{"boom":true}')
chk "1. próba: RETRY, next_attempt_at = +2 min, błąd w wyniku" "$(Q "select workflow_worker(50, '2026-10-01 10:00+00')" >/dev/null; Q "select status||':'||attempts||':'||(extract(epoch from next_attempt_at - '2026-10-01 10:00+00'::timestamptz)/60)::int||':'||(result->>'error' like '%nieobsługiwany operator%') from workflow_runs where event_id=$EB")" "RETRY:1:2:true"
chk "przed terminem ponowienia worker go nie bierze" "$(Q "select workflow_worker(50, '2026-10-01 10:01+00')")" '{"ok": 0, "dead": 0, "retry": 0, "skipped": 0}'
for t in '2026-10-01 11:00+00' '2026-10-01 12:00+00' '2026-10-01 13:00+00' '2026-10-01 14:00+00'; do Q "select workflow_worker(50, '$t')" >/dev/null; done
chk "po 5 próbach: DEAD, attempts 5" "$(Q "select status||':'||attempts from workflow_runs where event_id=$EB")" "DEAD:5"
chk "nieudane przebiegi nie zostawiły powiadomień HHL" "$(Q "select count(*) from notifications n join app_users u on u.id=n.user_id where n.template='WORKFLOW_ALERT' and u.auth_id='$HHL'")" 0

echo; echo "[R-2] akcje zewnętrzne zablokowane (EXTERNAL_MESSAGING wyłączone)"
$PSQL -c "insert into workflows (project_id, code, name, trigger_type, condition, actions) values ('$P', 'T-MAIL', 'test e-mail', 'MILESTONE_UNLOADED', 'true', '[{\"type\":\"email\"},{\"type\":\"sms\"}]')" >/dev/null
EM=$(EV MILESTONE_UNLOADED '{}')
Q "select workflow_worker(50, now())" >/dev/null
chk "e-mail i SMS: ZABLOKOWANE_R2, przebieg OK, 0 wiadomości w kolejkach" "$(Q "select status||':'||(result->'actions'->0->>'status')||':'||(result->'actions'->1->>'status') from workflow_runs r join workflows w on w.id=r.workflow_id where w.code='T-MAIL'")/$(Q "select count(*) from notifications where channel='EMAIL'")/$(Q "select count(*) from sms_outbox")" "OK:ZABLOKOWANE_R2:ZABLOKOWANE_R2/0/0"

echo; echo "[odporność] błąd kolejkowania nie blokuje zapisu zdarzenia"
chk "zdarzenie zapisane mimo reguły, której kolejkowanie się nie uda" "$(Q "alter table workflow_runs add constraint t_blok check (status <> 'QUEUED') not valid; insert into load_events (load_id, event_type, occurred_at) values ('$L1', 'MILESTONE_UNLOADED', now()); alter table workflow_runs drop constraint t_blok; select count(*) from load_events where event_type='MILESTONE_UNLOADED'")" 2
echo; echo "WYNIK: $ok OK, $fail FAIL"
