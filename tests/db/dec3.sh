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
val "macierz DECISION HHL in_app" $HHL "select in_app::text from notification_matrix where event_group='DECISION' and org_kind='FORWARDER'" true
val "macierz DECISION KSH in_app=false" $HHL "select in_app::text from notification_matrix where event_group='DECISION' and org_kind='CLIENT'" false
val "KSH nie czyta macierzy" $KSH "select count(*) from notification_matrix" 0
# open → powiadomienie HHL
D=$(run "$HHL" "select decision_open('$P','BACKUP_FAILED','test powiadomienia', '{}'::jsonb)" commit | grep -vE '^(BEGIN|SET|COMMIT)$' | tail -1 | tr -d '\r')
val "OPEN → powiadomienie IN_APP HHL" $HHL "select count(*) from notifications where template='DECISION_OPEN' and payload->>'decision_id'='$D'" 1
val "resolve → audit DECISION_RESOLVE" $HHL "select decision_resolve('$D','RETRY_NOW'); select count(*) from audit_log where action='DECISION_RESOLVE' and entity_id='$D'" 1 commit
val "RESOLVE → powiadomienie" $HHL "select count(*) from notifications where template='DECISION_RESOLVED' and payload->>'decision_id'='$D'" 1
# DEC-4 admin macierz
val "admin ustawia e-mail DECISION HHL" $HHL "select admin_notification_matrix_set('DECISION','FORWARDER',true,true); select email::text from notification_matrix where event_group='DECISION' and org_kind='FORWARDER'" true commit
err "SYSTEM nie dla KSH" $HHL "select admin_notification_matrix_set('SYSTEM','CLIENT',true,false)" "tylko HHL|systemowe"

echo; echo "WYNIK: $ok OK, $fail FAIL"
[ "$fail" -eq 0 ]
