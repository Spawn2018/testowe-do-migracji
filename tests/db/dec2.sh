#!/usr/bin/env bash
# DEC-2 — centrum decyzji (0102): katalog 16 typów + open/resolve/expire/assign/snooze.
set -e
ADMIN=${PGADMIN:-postgres://postgres@localhost:5433/postgres}
. "$(git rev-parse --show-toplevel)/tests/db/local-only.sh"
if [ "${TOWER_HOSTED_READY:-}" = "1" ]; then URL="$ADMIN"
else
  DB=tower_test_dec2; URL="${ADMIN%/*}/$DB"
  psql "$ADMIN" -q -c "drop database if exists $DB" -c "create database $DB"
  psql "$URL" -q -v ON_ERROR_STOP=1 -f tests/db/supabase_stub.sql
  for f in supabase/migrations/*.sql; do psql "$URL" -q -v ON_ERROR_STOP=1 -f "$f" >/dev/null 2>&1 || { echo "MIGRACJA $f"; exit 1; }; done
  psql "$URL" -q -v ON_ERROR_STOP=1 -f tests/db/seed.sql
fi
set +e
PSQL="psql $URL -Atq"
HHL=11111111-0000-0000-0000-000000000001
KSH=11111111-0000-0000-0000-000000000002
SCX=11111111-0000-0000-0000-000000000003
P=22222222-0000-0000-0000-000000000001
ok=0; fail=0
run() { local end="rollback"; [ "$3" = "commit" ] && end="commit"
  $PSQL -v ON_ERROR_STOP=1 -c "begin; set local role authenticated; set local request.jwt.claim.sub='$1'; $2; $end;" 2>&1; }
val() { out=$(run "$2" "$3" "$5" | grep -v -E '^(BEGIN|SET|ROLLBACK|COMMIT)$' | tail -1 | tr -d '\r')
  if [ "$out" = "$4" ]; then ok=$((ok+1)); echo "  OK    $1"; else fail=$((fail+1)); echo "  FAIL  $1  (otrzymano: $out, oczekiwano: $4)"; fi; }
err() { out=$(run "$2" "$3"); if echo "$out" | grep -qiE "$4"; then ok=$((ok+1)); echo "  OK    $1"; else fail=$((fail+1)); echo "  FAIL  $1  →  $(echo "$out" | tail -1)"; fi; }

echo; echo "[DEC-2] katalog + proces decyzji"
val "katalog 16 typów" $HHL "select count(*) from decision_types where active" 16

D=$(run "$HHL" "select decision_open('$P','SEFS_INVOICE_DIFF','SEFS na fakturze', '{}'::jsonb)" commit | grep -vE '^(BEGIN|SET|COMMIT)$' | tail -1 | tr -d '\r')
val "open → NEW" $HHL "select status::text from decisions where id='$D'" NEW
err "resolve bez komentarza gdy wymagany" $HHL "select decision_resolve('$D','ACCEPT')" "wymaga komentarza"
val "resolve z komentarzem" $HHL "select decision_resolve('$D','ACCEPT','akceptacja testowa'); select status::text from decisions where id='$D'" RESOLVED commit
val "historia RESOLVE" $HHL "select count(*) filter (where action='RESOLVE') from decision_events where decision_id='$D'" 1

D2=$(run "$HHL" "select decision_open('$P','BACKUP_FAILED','kopia', '{}'::jsonb)" commit | grep -vE '^(BEGIN|SET|COMMIT)$' | tail -1 | tr -d '\r')
val "assign" $HHL "select decision_assign('$D2', (select id from app_users where auth_id='$HHL')); select status::text from decisions where id='$D2'" ASSIGNED commit
val "snooze" $HHL "select decision_snooze('$D2', now() + interval '2 hours'); select status::text from decisions where id='$D2'" SNOOZED commit
val "expire z powodem" $HHL "select decision_expire('$D2','warunek ustapil sam'); select status::text from decisions where id='$D2'" EXPIRED commit

D3=$(run "$HHL" "select decision_open('$P','SEFS_OUT_OF_TABLE','SEFS poza tabela', '{}'::jsonb)" commit | grep -vE '^(BEGIN|SET|COMMIT)$' | tail -1 | tr -d '\r')
err "KSH nie rozstrzyga" $KSH "select decision_resolve('$D3','LAST_MULT')" "HHL lub przewo|Rozstrzyg"
val "SCX widzi decyzje CARRIER/HHL (count)" $SCX "select count(*)::int > 0 from decisions where id='$D3'" t
val "KSH nie listuje decyzji" $KSH "select count(*) from decisions where id='$D3'" 0
# eskalacja: sztucznie przeszły termin (funkcja tylko dla postgres/cron — bez EXECUTE dla authenticated)
sys() { $PSQL -v ON_ERROR_STOP=1 -c "$1" 2>&1; }
sys "update decisions set due_at = now() - interval '1 hour', escalated_at = null where id='$D3'" >/dev/null
out=$(sys "select decision_escalate_overdue()" | grep -vE '^(BEGIN|SET|ROLLBACK|COMMIT)$' | tail -1 | tr -d '\r')
if [ "${out:-0}" -ge 1 ] 2>/dev/null; then ok=$((ok+1)); echo "  OK    escalate overdue ($out)"; else fail=$((fail+1)); echo "  FAIL  escalate overdue (otrzymano: $out)"; fi
val "escalated_at ustawione" $HHL "select escalated_at is not null from decisions where id='$D3'" t
val "historia ESCALATE" $HHL "select count(*) filter (where action='ESCALATE') from decision_events where decision_id='$D3'" 1

# skutki opcji (0126)
L=33333333-0000-0000-0000-000000000001
D4=$(run "$HHL" "select decision_open('$P','ETA_AFTER_LATEST','ETA po terminie', jsonb_build_object('eta','2026-10-02T12:00:00Z'), '$L')" commit | grep -vE '^(BEGIN|SET|COMMIT)$' | tail -1 | tr -d '\r')
val "NOTIFY_KSH → applied" $HHL "select (decision_resolve('$D4','NOTIFY_KSH')->>'applied')" true commit
val "NOTIFY → powiadomienie KSH IN_APP" $KSH "select count(*) from notifications where template='ETA_NOTIFY_KSH' and load_id='$L'" 1

D5=$(run "$HHL" "select decision_open('$P','BACKUP_FAILED','kopia retry', '{}'::jsonb)" commit | grep -vE '^(BEGIN|SET|COMMIT)$' | tail -1 | tr -d '\r')
val "BACKUP_RETRY → ui_hint" $HHL "select decision_resolve('$D5','RETRY_NOW')->>'ui_hint'" BACKUP_RETRY commit
val "BACKUP_RETRY → audit" $HHL "select count(*) from audit_log where action='BACKUP_RETRY_REQUESTED' and entity_id='$D5'" 1
val "BACKUP_RETRY zostawia wynik kopii" $HHL "select (count(*) >= 1) from backup_runs where status = 'ERROR' and error like 'Kopia nie wystartowała%'" t
def=$(sys "select (position('functions/v1/backup-export' in pg_get_functiondef('public.request_backup_export()'::regprocedure)) > 0)" | grep -vE '^(BEGIN|SET|ROLLBACK|COMMIT)$' | tail -1 | tr -d '\r')
if [ "$def" = "t" ]; then ok=$((ok+1)); echo "  OK    BACKUP_RETRY woła backup-export"; else fail=$((fail+1)); echo "  FAIL  BACKUP_RETRY woła backup-export (otrzymano: $def)"; fi


# L-2: firma z katalogu albo administrator. Odmowa z bazy.
OPS=11111111-0000-0000-0000-000000000004
sys "insert into app_users (auth_id, org_id, email, role) values ('$OPS','00000000-0000-0000-0000-00000000a001','ops@test','HHL_OPS')" >/dev/null

DC=$(run "$HHL" "select decision_open('$P','KSH_DATE_LT_5D','data KSH', '{}'::jsonb)" commit | grep -vE '^(BEGIN|SET|COMMIT)$' | tail -1 | tr -d '\r')
val "przewoźnik rozstrzyga typ CARRIER" $SCX "select (decision_resolve('$DC','ACCEPT')->>'applied'); select status::text from decisions where id='$DC'" RESOLVED commit
DH=$(run "$HHL" "select decision_open('$P','SEFS_INVOICE_DIFF','faktura obca', '{}'::jsonb)" commit | grep -vE '^(BEGIN|SET|COMMIT)$' | tail -1 | tr -d '\r')
err "przewoźnik nie rozstrzyga typu HHL" $SCX "select decision_resolve('$DH','ACCEPT','nie moja decyzja')" "wskazana firma|Rozstrzyg"
val "operacje HHL rozstrzygają typ HHL" $OPS "select (decision_resolve('$DH','ACCEPT','akceptacja operacji')->>'applied'); select status::text from decisions where id='$DH'" RESOLVED commit
DCar=$(run "$HHL" "select decision_open('$P','NO_POSITION','brak pozycji', '{}'::jsonb)" commit | grep -vE '^(BEGIN|SET|COMMIT)$' | tail -1 | tr -d '\r')
err "operacje HHL nie rozstrzygają typu CARRIER" $OPS "select decision_resolve('$DCar','MANUAL_STATUS','proba operacji')" "wskazana firma|Rozstrzyg"
DAd=$(run "$HHL" "select decision_open('$P','BACKUP_FAILED','kopia ops', '{}'::jsonb)" commit | grep -vE '^(BEGIN|SET|COMMIT)$' | tail -1 | tr -d '\r')
err "operacje HHL nie rozstrzygają typu ADMIN" $OPS "select decision_resolve('$DAd','RETRY_NOW')" "wskazana firma|Rozstrzyg"
val "administrator rozstrzyga typ ADMIN" $HHL "select decision_resolve('$DAd','RETRY_NOW')->>'ui_hint'" BACKUP_RETRY commit

echo; echo "WYNIK: $ok OK, $fail FAIL"
[ "$fail" -eq 0 ]
