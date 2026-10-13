#!/usr/bin/env bash
# DEC-3 — powiadomienia o decyzjach (0104).
set -e
ADMIN=${PGADMIN:-postgres://postgres@localhost:5433/postgres}
. "$(git rev-parse --show-toplevel)/tests/db/local-only.sh"
if [ "${TOWER_HOSTED_READY:-}" = "1" ]; then URL="$ADMIN"
else
  DB=tower_test_dec3; URL="${ADMIN%/*}/$DB"
  psql "$ADMIN" -q -c "drop database if exists $DB" -c "create database $DB"
  psql "$URL" -q -v ON_ERROR_STOP=1 -f tests/db/supabase_stub.sql
  for f in supabase/migrations/*.sql; do psql "$URL" -q -v ON_ERROR_STOP=1 -f "$f" >/dev/null 2>&1 || { echo "MIGRACJA $f"; exit 1; }; done
  psql "$URL" -q -v ON_ERROR_STOP=1 -f tests/db/seed.sql
fi
set +e
PSQL="psql $URL -Atq"
HHL=11111111-0000-0000-0000-000000000001
KSH=11111111-0000-0000-0000-000000000002
P=22222222-0000-0000-0000-000000000001
ok=0; fail=0
run() { local end="rollback"; [ "$3" = "commit" ] && end="commit"
  $PSQL -v ON_ERROR_STOP=1 -c "begin; set local role authenticated; set local request.jwt.claim.sub='$1'; $2; $end;" 2>&1; }
val() { out=$(run "$2" "$3" "$5" | grep -v -E '^(BEGIN|SET|ROLLBACK|COMMIT)$' | tail -1 | tr -d '\r')
  if [ "$out" = "$4" ]; then ok=$((ok+1)); echo "  OK    $1"; else fail=$((fail+1)); echo "  FAIL  $1  (otrzymano: $out, oczekiwano: $4)"; fi; }
err() { out=$(run "$2" "$3"); if echo "$out" | grep -qiE "$4"; then ok=$((ok+1)); echo "  OK    $1"; else fail=$((fail+1)); echo "  FAIL  $1  →  $(echo "$out" | tail -1)"; fi; }

echo; echo "[DEC-3] powiadomienia decyzji"
val "macierz DECISION HHL_ADMIN in_app" $HHL "select in_app::text from notification_matrix where event_group='DECISION' and role='HHL_ADMIN'" true
val "macierz DECISION CLIENT_USER in_app=false" $HHL "select in_app::text from notification_matrix where event_group='DECISION' and role='CLIENT_USER'" false
val "KSH nie czyta macierzy" $KSH "select count(*) from notification_matrix" 0
# open → powiadomienie HHL
D=$(run "$HHL" "select decision_open('$P','BACKUP_FAILED','test powiadomienia', '{}'::jsonb)" commit | grep -vE '^(BEGIN|SET|COMMIT)$' | tail -1 | tr -d '\r')
val "OPEN → powiadomienie IN_APP HHL" $HHL "select count(*) from notifications where channel='IN_APP' and template='DECISION_OPEN' and payload->>'decision_id'='$D'" 1
val "resolve → audit DECISION_RESOLVE" $HHL "select decision_resolve('$D','RETRY_NOW'); select count(*) from audit_log where action='DECISION_RESOLVE' and entity_id='$D'" 1 commit
val "RESOLVE → powiadomienie" $HHL "select count(*) from notifications where channel='IN_APP' and template='DECISION_RESOLVED' and payload->>'decision_id'='$D'" 1
# DEC-4 / E11 admin macierz (po roli)
val "admin ustawia e-mail DECISION HHL_ADMIN" $HHL "select admin_notification_matrix_set('DECISION','HHL_ADMIN',true,true); select email::text from notification_matrix where event_group='DECISION' and role='HHL_ADMIN'" true commit
err "SYSTEM nie dla CLIENT_USER" $HHL "select admin_notification_matrix_set('SYSTEM','CLIENT_USER',true,false)" "tylko HHL|systemowe"

# DEC-3 reszta: status + ryzyko przez macierz (0126)
L=33333333-0000-0000-0000-000000000001
# zmiana statusu jako postgres (wyzwalacz AFTER) — bez reguł przejść UI
$PSQL -c "update loads set status = case when status = 'PLANNED' then 'RESOURCES_PENDING'::load_status when status = 'RESOURCES_PENDING' then 'DOCS_PENDING'::load_status else status end where id='$L'" >/dev/null
val "status → powiadomienie HHL" $HHL "select count(*) > 0 from notifications where template='LOAD_STATUS_CHANGED' and load_id='$L'" t
val "KSH widzi status IN_APP" $KSH "select count(*) > 0 from notifications where template='LOAD_STATUS_CHANGED' and load_id='$L'" t

# 0127: RISK_FERRY_WEATHER tylko FERRY/WEATHER/ETA_BREACH — nie RESOURCE_MISSING
$PSQL -c "delete from notifications where template like 'RISK_%' and load_id='$L'" >/dev/null
$PSQL -c "insert into risk_signals (project_id, load_id, kind, severity, title, title_key, detail, dedup_key)
  values ('$P','$L','RESOURCE_MISSING','HIGH','test numer','rk_test_orderno',
          jsonb_build_object('rule','ORDER_NO','side','HHL'),'TEST:ORDERNO:'||gen_random_uuid()::text)" >/dev/null
val "RESOURCE_MISSING → KSH bez RISK_OPEN (0127)" $KSH "select count(*) from notifications where template='RISK_OPEN' and load_id='$L'" 0
val "RESOURCE_MISSING → HHL RISK_OPEN (SYSTEM)" $HHL "select count(*) > 0 from notifications where template='RISK_OPEN' and payload->>'kind'='RESOURCE_MISSING'" t
$PSQL -c "insert into risk_signals (project_id, load_id, kind, severity, title, title_key, detail, dedup_key)
  values ('$P','$L','FERRY','HIGH','test prom','rk_test_ferry',
          jsonb_build_object('rule','FERRY'),'TEST:FERRY:'||gen_random_uuid()::text)" >/dev/null
val "FERRY → KSH RISK_OPEN (macierz)" $KSH "select count(*) > 0 from notifications where template='RISK_OPEN' and payload->>'kind'='FERRY'" t

echo; echo "WYNIK: $ok OK, $fail FAIL"
[ "$fail" -eq 0 ]
