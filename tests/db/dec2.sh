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
val "katalog 28 typów" $HHL "select count(*) from decision_types where active" 28 # #581 +ETA_CALIBRATION_APPROVAL; #563 SEFS_WEEK_CORR; #590 +2

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
raw=$(sys "select decision_escalate_overdue()" | tr -d '\r')
errline=$(printf '%s\n' "$raw" | grep -m1 'ERROR:' || true)
out=$(printf '%s\n' "$raw" | grep -vE '^(BEGIN|SET|ROLLBACK|COMMIT)$' | tail -1)
if [ -n "$errline" ]; then out="$errline | $out"; fi
if [ "${out:-0}" -ge 1 ] 2>/dev/null; then ok=$((ok+1)); echo "  OK    escalate overdue ($out)"; else fail=$((fail+1)); echo "  FAIL  escalate overdue (otrzymano: $out)"; fi
val "escalated_at ustawione" $HHL "select escalated_at is not null from decisions where id='$D3'" t
val "historia ESCALATE" $HHL "select count(*) filter (where action='ESCALATE') from decision_events where decision_id='$D3'" 1
val "SEFS po terminie → 0 wpisów u SCX" $SCX "select count(*) from notifications where template in ('DECISION_ESCALATED','DECISION_ESCALATED_BATCH') and (payload->>'decision_id'='$D3' or coalesce(payload->'decision_ids','[]'::jsonb) ? '$D3')" 0
# Zeruj escalated_at, żeby drugi przebieg naprawdę przeszedł pętlę (dedup po dedup_key).
sys "update decisions set escalated_at = null where id='$D3'" >/dev/null
sys "select decision_escalate_overdue()" >/dev/null
val "druga eskalacja bez drugiego wpisu" $HHL "select count(*) from notifications where dedup_key like 'dec:ESCALATE:$D3:IN:%'" 1
B1=$(run "$HHL" "select decision_open('$P','SEFS_OUT_OF_TABLE','brak cen 1', '{}'::jsonb)" commit | grep -vE '^(BEGIN|SET|COMMIT)$' | tail -1 | tr -d '\r')
B2=$(run "$HHL" "select decision_open('$P','SEFS_OUT_OF_TABLE','brak cen 2', '{}'::jsonb)" commit | grep -vE '^(BEGIN|SET|COMMIT)$' | tail -1 | tr -d '\r')
B3=$(run "$HHL" "select decision_open('$P','SEFS_OUT_OF_TABLE','brak cen 3', '{}'::jsonb)" commit | grep -vE '^(BEGIN|SET|COMMIT)$' | tail -1 | tr -d '\r')
sys "update decisions set due_at = now() - interval '1 hour', escalated_at = null where id in ('$B1','$B2','$B3')" >/dev/null
sys "select decision_escalate_overdue()" >/dev/null
# B-N1 / dopisek §5: 3 eskalacje → 1 zbiorczy (nie osobne).
val "3 eskalacje → jeden wpis" $HHL "select count(*) from notifications n join app_users u on u.id=n.user_id where u.auth_id='$HHL' and n.channel='IN_APP' and n.template='DECISION_ESCALATED_BATCH' and (n.payload->>'n')::int = 3" 1
val "3 eskalacje → jeden e-mail" $HHL "select count(*) from notifications n join app_users u on u.id=n.user_id where u.auth_id='$HHL' and n.channel='EMAIL' and n.template='DECISION_ESCALATED_BATCH' and (n.payload->>'n')::int = 3" 1
val "3 eskalacje bez osobnych" $HHL "select count(*) from notifications n join app_users u on u.id=n.user_id where u.auth_id='$HHL' and n.channel='IN_APP' and n.template='DECISION_ESCALATED' and n.payload->>'decision_id' in ('$B1','$B2','$B3')" 0
val "tytuł zbiorczy 3" $HHL "select (payload->>'title' = 'Po terminie: 3 decyzje · Opłata paliwowa' and payload->>'path' = '/ryzyka') from notifications n join app_users u on u.id=n.user_id where u.auth_id='$HHL' and n.channel='IN_APP' and n.template='DECISION_ESCALATED_BATCH' and (n.payload->>'n')::int = 3" t
sys "update decisions set detail = coalesce(detail,'{}'::jsonb) || jsonb_build_object('event_key','l3:test:$D3') where id='$D3'" >/dev/null
sys "select l3_critical_notify('l3:test:$D3', now())" >/dev/null
val "L-3 po eskalacji bez drugiego wpisu" $HHL "select count(*) from notifications where dedup_key like 'l3crit:$D3:IN:%'" 0
# RISK_SEVERITY przy l3_level=critical nie dokłada osobnego wpisu (P3).
L3R=$(sys "insert into risk_signals (project_id, load_id, kind, severity, title, title_key, detail, dedup_key) values ('$P', null, 'JOB_FAILURE', 'HIGH', 'L-3 test', 'rk_decision_overdue', jsonb_build_object('l3_level','critical','decision_id','$D3'), 'l3sev-test-$D3') returning id" | grep -vE '^(BEGIN|SET|ROLLBACK|COMMIT)$' | tail -1 | tr -d '\r')
sys "update risk_signals set severity = 'CRITICAL' where id='$L3R'" >/dev/null
val "RISK_SEVERITY przy L-3 bez wpisu" $HHL "select count(*) from notifications where template='RISK_SEVERITY' and payload->>'risk_id'='$L3R'" 0
for i in 1 2 3 4 5 6; do
  id=$(run "$HHL" "select decision_open('$P','SEFS_OUT_OF_TABLE','brak cen partia $i', '{}'::jsonb)" commit | grep -vE '^(BEGIN|SET|COMMIT)$' | tail -1 | tr -d '\r')
  sys "update decisions set due_at = now() - interval '1 hour', escalated_at = null where id='$id'" >/dev/null
done
sys "select decision_escalate_overdue()" >/dev/null
val "6 eskalacji → jeden wpis" $HHL "select count(*) from notifications n join app_users u on u.id=n.user_id where u.auth_id='$HHL' and n.channel='IN_APP' and n.template='DECISION_ESCALATED_BATCH' and (n.payload->>'n')::int = 6" 1
val "6 eskalacji → jeden e-mail" $HHL "select count(*) from notifications n join app_users u on u.id=n.user_id where u.auth_id='$HHL' and n.channel='EMAIL' and n.template='DECISION_ESCALATED_BATCH' and (n.payload->>'n')::int = 6" 1
val "6 eskalacji bez limitu poczty" $HHL "select count(*) from notifications n join app_users u on u.id=n.user_id where u.auth_id='$HHL' and n.template='EMAIL_BUDGET'" 0
val "6 eskalacji bez RISK_OPEN" $HHL "select count(*) from notifications where template='RISK_OPEN' and coalesce(payload->>'title','') like 'Decyzja po terminie:%'" 0
val "tytuł zbiorczy" $HHL "select (payload->>'title' = 'Po terminie: 6 decyzji · Opłata paliwowa' and payload->>'path' = '/ryzyka') from notifications n join app_users u on u.id=n.user_id where u.auth_id='$HHL' and n.channel='IN_APP' and n.template='DECISION_ESCALATED_BATCH' and (n.payload->>'n')::int = 6" t

L=33333333-0000-0000-0000-000000000001
sys "update loads set hhl_order_no='HHL/1', carrier_order_no='SCX/1' where id='$L'" >/dev/null
sys "insert into shipment_items (project_id, load_id, shipment_code, length_m, width_m, height_m) select '$P', '$L', 'SG-T', 1, 1, 1 where not exists (select 1 from shipment_items where load_id='$L' and shipment_code='SG-T')" >/dev/null
out=$(sys "select tower_public_title('$L'::uuid, 'aaaaaaaa: brak awizacji', 'HHL') = 'SG-T · HHL/1 — brak awizacji'" | grep -vE '^(BEGIN|SET|ROLLBACK|COMMIT)$' | tail -1 | tr -d '\r')
if [ "$out" = "t" ]; then ok=$((ok+1)); echo "  OK    tytuł HHL z numerem HHL"; else fail=$((fail+1)); echo "  FAIL  tytuł HHL z numerem HHL (otrzymano: $out)"; fi
out=$(sys "select tower_public_title('$L'::uuid, 'aaaaaaaa: brak awizacji', 'SCX') = 'SG-T · SCX/1 — brak awizacji'" | grep -vE '^(BEGIN|SET|ROLLBACK|COMMIT)$' | tail -1 | tr -d '\r')
if [ "$out" = "t" ]; then ok=$((ok+1)); echo "  OK    tytuł SCX z numerem SCX"; else fail=$((fail+1)); echo "  FAIL  tytuł SCX z numerem SCX (otrzymano: $out)"; fi
out=$(sys "select tower_public_title('$L'::uuid, 'aaaaaaaa: brak awizacji', 'KSH') = 'SG-T — brak awizacji'" | grep -vE '^(BEGIN|SET|ROLLBACK|COMMIT)$' | tail -1 | tr -d '\r')
if [ "$out" = "t" ]; then ok=$((ok+1)); echo "  OK    tytuł KSH sam kod"; else fail=$((fail+1)); echo "  FAIL  tytuł KSH sam kod (otrzymano: $out)"; fi

# skutki opcji (0126)
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

# #384 pkt 5–6 + F7 #389: PROPOSE_DATE, licznik, HHL_OPS, od/do, powiadomienie SCX
sys "update loads set plan_load_date = current_date + 3, plan_delivery_date = current_date + 7,
     plan_load_from = ((current_date + 3)::timestamp + time '08:00') at time zone 'Europe/Warsaw',
     plan_load_to = ((current_date + 3)::timestamp + time '12:00') at time zone 'Europe/Warsaw',
     plan_delivery_from = ((current_date + 7)::timestamp + time '12:00') at time zone 'Europe/Stockholm',
     plan_delivery_to = ((current_date + 7)::timestamp + time '16:00') at time zone 'Europe/Stockholm',
     status = 'PLANNED'
     where id='$L'" >/dev/null
DP=$(run "$HHL" "select decision_open('$P','KSH_DATE_LT_5D','późna data', '{}'::jsonb, '$L')" commit | grep -vE '^(BEGIN|SET|COMMIT)$' | tail -1 | tr -d '\r')
err "PROPOSE bez load_date odrzucone" $SCX "select decision_resolve('$DP','PROPOSE_DATE','propozycja SCX', '{}'::jsonb)" "daty załadunku|Propozycja wymaga"
err "PROPOSE zła delivery_date odrzucone" $SCX "select decision_resolve('$DP','PROPOSE_DATE','zla', jsonb_build_object('load_date',(current_date+10)::text,'delivery_date',(current_date+5)::text))" "dostawy przed|załadunku"
LD_PROP=$(sys "select (current_date + 10)::text" | grep -vE '^(BEGIN|SET|ROLLBACK|COMMIT)$' | tail -1 | tr -d '\r')
val "PROPOSE z load_date → KSH_DATE_COUNTER" $SCX "select (decision_resolve('$DP','PROPOSE_DATE','propozycja SCX', jsonb_build_object('load_date','$LD_PROP'))->>'ui_hint')" KSH_DATE_COUNTER commit
DCNT=$(sys "select id from decisions where type_code='KSH_DATE_COUNTER' and detail->>'parent_decision_id'='$DP' and status in ('NEW','ASSIGNED','SNOOZED') limit 1" | grep -vE '^(BEGIN|SET|ROLLBACK|COMMIT)$' | tail -1 | tr -d '\r')
val "KSH widzi KSH_DATE_COUNTER" $KSH "select count(*) from decisions where id='$DCNT'" 1
err "SCX nie rozstrzyga KSH_DATE_COUNTER" $SCX "select decision_resolve('$DCNT','ACCEPT')" "wskazana firma|Rozstrzyg"
err "HHL_OPS przed terminem nie rozstrzyga licznika" $OPS "select decision_resolve('$DCNT','ACCEPT')" "wskazana firma|Rozstrzyg"
val "KSH Przyjmuję → daty z propozycji" $KSH "select (decision_resolve('$DCNT','ACCEPT')->>'dates_applied')::text; select plan_load_date::text from loads where id='$L'" "$LD_PROP" commit
val "ACCEPT: od/do przesunięte na nowy dzień" $HHL "select ((plan_load_from at time zone 'Europe/Warsaw')::date = '$LD_PROP'::date and (plan_load_to at time zone 'Europe/Warsaw')::date = '$LD_PROP'::date and extract(hour from plan_load_from at time zone 'Europe/Warsaw') = 8) from loads where id='$L'" t
val "ACCEPT: powiadomienie SCX (przewoźnik)" $SCX "select count(*) from notifications where template='KSH_DATE_COUNTER_RESULT' and payload->>'decision_id'='$DCNT' and payload->>'effect'='ACCEPT'" 1
val "ACCEPT: PLAN_DATES_CHANGED do SCX" $SCX "select count(*) > 0 from notifications where template='PLAN_DATES_CHANGED' and load_id='$L' and payload->>'by' = 'KSH'" t

# F7: propozycja < 5 dni — bez LATE_DATE_CHANGE po ACCEPT (counter_accept); tylko detected_at po znaczniku
sys "update risk_signals set resolved_at = coalesce(resolved_at, now()) where load_id='$L' and kind='LATE_DATE_CHANGE' and resolved_at is null" >/dev/null
sys "update loads set plan_load_date = current_date + 8, plan_delivery_date = current_date + 12,
     plan_load_from = ((current_date + 8)::timestamp + time '08:00') at time zone 'Europe/Warsaw',
     plan_load_to = ((current_date + 8)::timestamp + time '12:00') at time zone 'Europe/Warsaw',
     plan_delivery_from = ((current_date + 12)::timestamp + time '12:00') at time zone 'Europe/Stockholm',
     plan_delivery_to = ((current_date + 12)::timestamp + time '16:00') at time zone 'Europe/Stockholm',
     status = 'PLANNED'
     where id='$L'" >/dev/null
sys "update risk_signals set resolved_at = coalesce(resolved_at, now()) where load_id='$L' and kind='LATE_DATE_CHANGE' and resolved_at is null" >/dev/null
LD2=$(sys "select (current_date + 2)::text" | grep -vE '^(BEGIN|SET|ROLLBACK|COMMIT)$' | tail -1 | tr -d '\r')
DP_LATE=$(run "$HHL" "select decision_open('$P','KSH_DATE_LT_5D','późna late', '{}'::jsonb, '$L')" commit | grep -vE '^(BEGIN|SET|COMMIT)$' | tail -1 | tr -d '\r')
val "PROPOSE D+2 → counter" $SCX "select (decision_resolve('$DP_LATE','PROPOSE_DATE','prop late', jsonb_build_object('load_date','$LD2'))->>'ui_hint')" KSH_DATE_COUNTER commit
DCNT_LATE=$(sys "select id from decisions where type_code='KSH_DATE_COUNTER' and detail->>'parent_decision_id'='$DP_LATE' and status in ('NEW','ASSIGNED','SNOOZED') limit 1" | grep -vE '^(BEGIN|SET|ROLLBACK|COMMIT)$' | tail -1 | tr -d '\r')
TS_LATE=$(sys "select clock_timestamp()::text" | grep -vE '^(BEGIN|SET|ROLLBACK|COMMIT)$' | tail -1 | tr -d '\r')
val "ACCEPT D+2 → daty" $KSH "select (decision_resolve('$DCNT_LATE','ACCEPT')->>'dates_applied')::text; select plan_load_date::text from loads where id='$L'" "$LD2" commit
val "ACCEPT: bez nowego LATE_DATE_CHANGE" $HHL "select count(*) from risk_signals where load_id='$L' and kind='LATE_DATE_CHANGE' and resolved_at is null and detected_at >= '$TS_LATE'::timestamptz" 0

# REJECT + powiadomienie SCX (przewoźnik)
sys "update loads set plan_load_date = current_date + 3, plan_delivery_date = current_date + 7,
     plan_load_from = ((current_date + 3)::timestamp + time '08:00') at time zone 'Europe/Warsaw',
     plan_delivery_from = ((current_date + 7)::timestamp + time '12:00') at time zone 'Europe/Stockholm'
     where id='$L'" >/dev/null
DP2=$(run "$HHL" "select decision_open('$P','KSH_DATE_LT_5D','późna 2', '{}'::jsonb, '$L')" commit | grep -vE '^(BEGIN|SET|COMMIT)$' | tail -1 | tr -d '\r')
val "PROPOSE 2 → counter" $SCX "select (decision_resolve('$DP2','PROPOSE_DATE','prop2', jsonb_build_object('load_date','$LD_PROP'))->>'ui_hint')" KSH_DATE_COUNTER commit
DCNT2=$(sys "select id from decisions where type_code='KSH_DATE_COUNTER' and detail->>'parent_decision_id'='$DP2' and status in ('NEW','ASSIGNED','SNOOZED') limit 1" | grep -vE '^(BEGIN|SET|ROLLBACK|COMMIT)$' | tail -1 | tr -d '\r')
val "KSH Odrzucam → RESOLVED" $KSH "select (decision_resolve('$DCNT2','REJECT')->>'applied')::text; select status::text from decisions where id='$DCNT2'" RESOLVED commit
val "REJECT: powiadomienie SCX" $SCX "select count(*) from notifications where template='KSH_DATE_COUNTER_RESULT' and payload->>'decision_id'='$DCNT2' and payload->>'effect'='SKIP'" 1
val "REJECT: data planu bez zmian" $HHL "select plan_load_date::text from loads where id='$L'" "$(sys "select (current_date + 3)::text" | grep -vE '^(BEGIN|SET|ROLLBACK|COMMIT)$' | tail -1 | tr -d '\r')"

# ESCALATE_HHL na liczniku
sys "update loads set plan_load_date = current_date + 4 where id='$L'" >/dev/null
DP3=$(run "$HHL" "select decision_open('$P','KSH_DATE_LT_5D','późna 3', '{}'::jsonb, '$L')" commit | grep -vE '^(BEGIN|SET|COMMIT)$' | tail -1 | tr -d '\r')
val "PROPOSE 3 → counter" $SCX "select (decision_resolve('$DP3','PROPOSE_DATE','prop3', jsonb_build_object('load_date','$LD_PROP'))->>'ui_hint')" KSH_DATE_COUNTER commit
DCNT3=$(sys "select id from decisions where type_code='KSH_DATE_COUNTER' and detail->>'parent_decision_id'='$DP3' and status in ('NEW','ASSIGNED','SNOOZED') limit 1" | grep -vE '^(BEGIN|SET|ROLLBACK|COMMIT)$' | tail -1 | tr -d '\r')
val "KSH Eskaluj → RESOLVED" $KSH "select (decision_resolve('$DCNT3','ESCALATE_HHL')->>'applied')::text; select status::text from decisions where id='$DCNT3'" RESOLVED commit

DOps=$(run "$HHL" "select decision_open('$P','NO_POSITION','brak GPS ops', '{}'::jsonb, '$L')" commit | grep -vE '^(BEGIN|SET|COMMIT)$' | tail -1 | tr -d '\r')
err "HHL_OPS bez eskalacji nie rozstrzyga CARRIER" $OPS "select decision_resolve('$DOps','MANUAL_STATUS','ops przed')" "wskazana firma|Rozstrzyg"
sys "update decisions set escalated_at = now(), due_at = now() - interval '1 hour' where id='$DOps'" >/dev/null
val "HHL_OPS po eskalacji rozstrzyga CARRIER" $OPS "select (decision_resolve('$DOps','MANUAL_STATUS','ops po terminie')->>'applied'); select status::text from decisions where id='$DOps'" RESOLVED commit

DAd2=$(run "$HHL" "select decision_open('$P','BACKUP_FAILED','kopia po terminie', '{}'::jsonb)" commit | grep -vE '^(BEGIN|SET|COMMIT)$' | tail -1 | tr -d '\r')
sys "update decisions set escalated_at = now(), due_at = now() - interval '1 hour' where id='$DAd2'" >/dev/null
err "HHL_OPS po terminie nie rozstrzyga ADMIN" $OPS "select decision_resolve('$DAd2','RETRY_NOW')" "wskazana firma|Rozstrzyg"

# #384 zaległe pkt 7–8: decisions_read × carrier_org_id; actor w DECISION_*
echo; echo "[#384 zaległe] decisions_read + actor"
OTH=11111111-0000-0000-0000-000000000099
OTH_ORG=00000000-0000-0000-0000-00000000a099
sys "insert into organizations (id, code, name, kind) values ('$OTH_ORG','OTH','Other Carrier','CARRIER')
     on conflict (id) do nothing" >/dev/null
sys "insert into app_users (auth_id, org_id, email, role, active)
     values ('$OTH','$OTH_ORG','oth@test','CARRIER_DISPATCH', true)
     on conflict (auth_id) do update set org_id=excluded.org_id, role=excluded.role, active=true" >/dev/null
LOTH=$(sys "insert into loads (project_id, carrier_org_id, order_no, status, hhl_order_no, carrier_order_no)
     values ('$P','$OTH_ORG','OTH-1','PLANNED','HHL-OTH-1','OTH/1') returning id" | grep -vE '^(BEGIN|SET|ROLLBACK|COMMIT)$' | tail -1 | tr -d '\r')
DOTH=$(run "$HHL" "select decision_open('$P','NO_POSITION','cudzy transport', '{}'::jsonb, '$LOTH')" commit | grep -vE '^(BEGIN|SET|COMMIT)$' | tail -1 | tr -d '\r')
val "pkt 7: SCX nie widzi decyzji cudzego transportu" $SCX "select count(*) from decisions where id='$DOTH'" 0
val "pkt 7: OTH widzi decyzję własnego transportu" $OTH "select count(*) from decisions where id='$DOTH'" 1
val "pkt 7: SCX nadal widzi decyzję bez load_id" $SCX "select count(*) from decisions where id='$D3'" 1
val "pkt 8: PROPOSE → actor // SCX" $HHL "select ((payload->>'actor') like '% // SCX' and payload->>'decider'='CARRIER' and payload->>'by_org'='CARRIER')::text from load_events where load_id='$L' and event_type='DECISION_EFFECT' and payload->>'option'='PROPOSE_DATE' order by occurred_at desc limit 1" true
# F7 r2/r3 B1: visible_to NULL = wszyscy w projekcie (w tym KSH)
val "pkt 8: visible_to NULL (wszyscy w projekcie)" $HHL "select (visible_to is null)::text from load_events where load_id='$L' and event_type='DECISION_EFFECT' and payload->>'option'='PROPOSE_DATE' order by occurred_at desc limit 1" true
# #455 / F7 r4 P4: KSH widzi tyle samo DECISION_EFFECT CARRIER co HHL (nie „≥ 1”).
N_EFF_HHL=$(run "$HHL" "select count(*) from load_events where load_id='$L' and event_type='DECISION_EFFECT' and payload->>'option'='PROPOSE_DATE'" | grep -vE '^(BEGIN|SET|ROLLBACK|COMMIT)$' | tail -1 | tr -d '\r')
N_EFF_KSH=$(run "$KSH" "select count(*) from load_events where load_id='$L' and event_type='DECISION_EFFECT' and payload->>'option'='PROPOSE_DATE'" | grep -vE '^(BEGIN|SET|ROLLBACK|COMMIT)$' | tail -1 | tr -d '\r')
if [ "$N_EFF_HHL" = "$N_EFF_KSH" ] && [ "${N_EFF_HHL:-0}" -ge 1 ] 2>/dev/null; then
  ok=$((ok+1)); echo "  OK    pkt 8: KSH = HHL DECISION_EFFECT CARRIER ($N_EFF_KSH)"
else
  fail=$((fail+1)); echo "  FAIL  pkt 8: KSH = HHL DECISION_EFFECT CARRIER (KSH=$N_EFF_KSH HHL=$N_EFF_HHL)"
fi
val "pkt 8: HHL_OPS widzi decyzje (is_hhl)" $OPS "select count(*) from decisions where id='$D3'" 1

# #455 / F7 r4 P3: „Działaj jako” → real_app_user_id prawdziwego admina w payload (0267 l. 108–109)
echo; echo "[#455] Działaj jako → real_app_user_id"
HHL_UID=$(sys "select id::text from app_users where auth_id='$HHL'" | grep -vE '^(BEGIN|SET|ROLLBACK|COMMIT)$' | tail -1 | tr -d '\r')
SCX_UID=$(sys "select id::text from app_users where auth_id='$SCX'" | grep -vE '^(BEGIN|SET|ROLLBACK|COMMIT)$' | tail -1 | tr -d '\r')
sys "update loads set plan_load_date = current_date + 6, plan_delivery_date = current_date + 11,
     plan_load_from = ((current_date + 6)::timestamp + time '08:00') at time zone 'Europe/Warsaw',
     plan_load_to = ((current_date + 6)::timestamp + time '12:00') at time zone 'Europe/Warsaw',
     plan_delivery_from = ((current_date + 11)::timestamp + time '12:00') at time zone 'Europe/Stockholm',
     plan_delivery_to = ((current_date + 11)::timestamp + time '16:00') at time zone 'Europe/Stockholm',
     status = 'PLANNED'
     where id='$L'" >/dev/null
DImp=$(run "$HHL" "select decision_open('$P','KSH_DATE_LT_5D','impersonacja 455', '{}'::jsonb, '$L')" commit | grep -vE '^(BEGIN|SET|COMMIT)$' | tail -1 | tr -d '\r')
sys "begin; select set_config('request.jwt.claim.sub','$HHL',true); set local role authenticated;
     select admin_impersonate_start('$SCX_UID'::uuid); commit;" >/dev/null
LD_IMP=$(sys "select (current_date + 14)::text" | grep -vE '^(BEGIN|SET|ROLLBACK|COMMIT)$' | tail -1 | tr -d '\r')
val "#455: PROPOSE jako SCX (impersonacja HHL)" $HHL "select (decision_resolve('$DImp','PROPOSE_DATE','imp 455', jsonb_build_object('load_date','$LD_IMP'))->>'ui_hint')" KSH_DATE_COUNTER commit
val "#455: real_app_user_id = admin HHL" $HHL "select (payload->>'real_app_user_id' = '$HHL_UID')::text from load_events where load_id='$L' and event_type='DECISION_EFFECT' and payload->>'option'='PROPOSE_DATE' and payload->>'real_app_user_id' is not null order by occurred_at desc limit 1" true
sys "begin; select set_config('request.jwt.claim.sub','$HHL',true); set local role authenticated;
     select admin_impersonate_stop(); commit;" >/dev/null
$PSQL -c "delete from impersonation_state" >/dev/null

echo; echo "WYNIK: $ok OK, $fail FAIL"
[ "$fail" -eq 0 ]
