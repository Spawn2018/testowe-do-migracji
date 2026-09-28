#!/usr/bin/env bash
# TOWER — SCOPE 6.6 (0097): polisy przewoźnika — zapis i odczyt przez funkcje, przypomnienie o wygaśnięciu (ryzyko + IN_APP).
# Czysta baza: atrapa Supabase → migracje → tests/db/seed.sql → scenariusze.
# Użycie: PGADMIN=postgres://postgres@localhost:5433/postgres bash tests/db/insurance.sh
set -e
cd "$(git rev-parse --show-toplevel)"
ADMIN=${PGADMIN:-postgres://postgres@localhost:5433/postgres}
. "$(git rev-parse --show-toplevel)/tests/db/local-only.sh"
DB=tower_test_ins; URL="${ADMIN%/*}/$DB"
psql "$ADMIN" -q -c "drop database if exists $DB" -c "create database $DB"
psql "$URL" -q -v ON_ERROR_STOP=1 -f tests/db/supabase_stub.sql
for f in supabase/migrations/*.sql; do psql "$URL" -q -v ON_ERROR_STOP=1 -f "$f" >/dev/null 2>&1 || { echo "MIGRACJA $f: błąd"; exit 1; }; done
psql "$URL" -q -v ON_ERROR_STOP=1 -f tests/db/seed.sql
set +e
PSQL="psql $URL -Atq"
HHL=11111111-0000-0000-0000-000000000001; KSH=11111111-0000-0000-0000-000000000002; SCX=11111111-0000-0000-0000-000000000003
P=22222222-0000-0000-0000-000000000001; L1=33333333-0000-0000-0000-000000000001
HHLO=00000000-0000-0000-0000-00000000a001; KSHO=00000000-0000-0000-0000-00000000a002; SCXO=00000000-0000-0000-0000-00000000a003
SCX2O=00000000-0000-0000-0000-00000000a004
ok=0; fail=0
run() { local end="rollback"; [ "$3" = "commit" ] && end="commit"
  $PSQL -v ON_ERROR_STOP=1 -c "begin; set local role authenticated; set local request.jwt.claim.sub='$1'; $2; $end;" 2>&1; }
val() { out=$(run "$2" "$3" "$5" | grep -v -E '^(BEGIN|SET|ROLLBACK|COMMIT)$' | tail -1)
  if [ "$out" = "$4" ]; then ok=$((ok+1)); echo "  OK    $1"; else fail=$((fail+1)); echo "  FAIL  $1  (otrzymano: $out, oczekiwano: $4)"; fi; }
err() { out=$(run "$2" "$3"); if echo "$out" | grep -qiE "$4"; then ok=$((ok+1)); echo "  OK    $1"; else fail=$((fail+1)); echo "  FAIL  $1  →  $(echo "$out" | tail -1)"; fi; }
Q() { $PSQL -c "$1" 2>&1 | tail -1; }
chk() { if [ "$2" = "$3" ]; then ok=$((ok+1)); echo "  OK    $1"; else fail=$((fail+1)); echo "  FAIL  $1  (otrzymano: $2, oczekiwano: $3)"; fi; }
$PSQL -c "insert into organizations (id, code, name, kind) values ('$SCX2O','SC2','Inny Przewoźnik','CARRIER');
  set session_replication_role=replica; update loads set carrier_org_id='$SCXO', status='PLANNED' where id='$L1'" >/dev/null
DOCCMR=$($PSQL -c "insert into documents (project_id, load_id, category, storage_path, file_name) values ('$P','$L1','CMR','dokumenty/t/cmr.pdf','cmr.pdf') returning id" | head -1)
SAVE() { echo "insurance_policy_save('$1', '$2', current_date - 300, current_date + $3)"; }

echo "[6.6] uprawnienia i zapis polis"
chk "tabela insurance_policies: anon i authenticated bez SELECT/INSERT/UPDATE/DELETE" "$(Q "select bool_or(has_table_privilege(r, 'public.insurance_policies', 'select,insert,update,delete')) from unnest(array['anon','authenticated']) r")" f
chk "funkcje SECURITY DEFINER z search_path=public" "$(Q "select count(*) from pg_proc where proname in ('insurance_policy_save','insurance_policies_list','detect_insurance_expiry') and prosecdef and proconfig @> array['search_path=public']")" 3
chk "detect_insurance_expiry: brak EXECUTE dla anon i authenticated" "$(Q "select has_function_privilege('anon','detect_insurance_expiry(timestamptz,int)','execute')::text||':'||has_function_privilege('authenticated','detect_insurance_expiry(timestamptz,int)','execute')::text")" "false:false"
chk "zapis i lista: anon bez EXECUTE" "$(Q "select has_function_privilege('anon','insurance_policies_list()','execute')::text||':'||has_function_privilege('anon','insurance_policy_save(uuid,text,date,date,text,boolean,boolean,numeric,text,uuid)','execute')::text")" "false:false"
val "przewoźnik zapisuje polisę własnej organizacji" $SCX "select (select $(SAVE $SCXO OCP/1 30)) is not null" t
err "przewoźnik nie zapisze polisy innego przewoźnika" $SCX "select $(SAVE $SCX2O OCP/X 30)" "dla własnej organizacji"
err "KSH nie zapisuje polisy" $KSH "select $(SAVE $SCXO OCP/K 30)" "Polisę zapisuje HHL albo przewoźnik"
err "HHL: polisa tylko dla organizacji przewoźnika" $HHL "select $(SAVE $KSHO OCP/K 30)" "wyłącznie przewoźnika"
err "brak numeru polisy" $HHL "select $(SAVE $SCXO '' 30)" "Brak numeru polisy"
err "koniec przed początkiem" $HHL "select insurance_policy_save('$SCXO', 'OCP/2', current_date, current_date - 1)" "okres ważności"
err "NULL w dacie = odmowa" $HHL "select insurance_policy_save('$SCXO', 'OCP/2', null, current_date)" "okres ważności"
err "waluta spoza EUR/PLN/SEK" $HHL "select insurance_policy_save('$SCXO', 'OCP/2', current_date, current_date + 1, null, false, false, 1, 'USD')" "Waluta polisy"
err "ujemna suma" $HHL "select insurance_policy_save('$SCXO', 'OCP/2', current_date, current_date + 1, null, false, false, -1)" "ujemna"
err "dokument spoza kategorii INSURANCE odrzucony" $HHL "select insurance_policy_save('$SCXO', 'OCP/2', current_date, current_date + 1, null, false, false, null, 'EUR', '$DOCCMR')" "nie jest polisą"
val "HHL zapisuje polisę innego przewoźnika (commit)" $HHL "select (select $(SAVE $SCX2O OCP/9 200)) is not null" t commit
chk "audit_log INSURANCE_SAVE z numerem i datą, bez sumy" "$(Q "select count(*)||':'||bool_and(new_value ? 'valid_until')::text||':'||bool_and(not new_value ? 'sum_insured')::text from audit_log where action='INSURANCE_SAVE'")" "1:true:true"
val "HHL: lista — wszystkie polisy" $HHL "select count(*) from insurance_policies_list()" 1
val "przewoźnik: lista — tylko własne (0)" $SCX "select count(*) from insurance_policies_list()" 0
val "KSH: lista pusta" $KSH "select count(*) from insurance_policies_list()" 0
err "HHL: wprost z tabeli → permission denied" $HHL "select count(*) from insurance_policies" "permission denied"

echo; echo "[6.6] przypomnienie o wygaśnięciu (detect_insurance_expiry, bez zadania cyklicznego)"
CRONN=0; [ "$(Q "select to_regclass('cron.job') is not null")" = t ] && CRONN=$(Q "select count(*) from cron.job where command ilike '%detect_insurance_expiry%'")
chk "brak zadania cyklicznego polis" "$CRONN" 0
run $SCX "select $(SAVE $SCXO OCP/SCX 30)" commit >/dev/null
val "przewoźnik: lista — własna polisa, dni do końca 30" $SCX "select string_agg(policy_no||'/'||days_left, ',') from insurance_policies_list()" "OCP/SCX/30"
chk "30 dni przed końcem: bez ryzyka i bez powiadomień" "$(Q "select detect_insurance_expiry(now())")/$(Q "select count(*) from notifications where template='INSURANCE_EXPIRY'")" "0/0"
chk "14 dni przed końcem: ryzyko INSURANCE HIGH w projekcie transportu" "$(Q "select detect_insurance_expiry(now() + interval '16 days')")/$(Q "select string_agg(kind||':'||severity||':'||title_key||':'||(load_id is null)::text, ',') from risk_signals where dedup_key like 'INS:%' and resolved_at is null")" "1/INSURANCE:HIGH:rk_insurance_expiry:true"
chk "powiadomienia IN_APP: przewoźnik + HHL (bez KSH), 2" "$(Q "select count(*)||':'||string_agg(distinct u.role::text, ',' order by u.role::text) from notifications n join app_users u on u.id=n.user_id where n.template='INSURANCE_EXPIRY'")" "2:CARRIER_DISPATCH,HHL_ADMIN"
chk "drugie wywołanie tego dnia: bez dubli" "$(Q "select detect_insurance_expiry(now() + interval '16 days')")/$(Q "select count(*) from notifications where template='INSURANCE_EXPIRY'")/$(Q "select count(*) from risk_signals where dedup_key like 'INS:%'")" "0/2/1"
val "przewoźnik widzi ryzyko swojej polisy" $SCX "select count(*) from risk_signals where kind='INSURANCE' and resolved_at is null" 1
val "KSH nie widzi ryzyka polisy przewoźnika" $KSH "select count(*) from risk_signals where kind='INSURANCE'" 0
chk "inny przewoźnik bez transportów: polisa za 200 dni — bez ryzyka" "$(Q "select count(*) from risk_signals where detail->>'carrier_org_id'='$SCX2O'")" 0
chk "po terminie: eskalacja do CRITICAL (to samo ryzyko) + nowe powiadomienia" "$(Q "select detect_insurance_expiry(now() + interval '32 days')")/$(Q "select string_agg(severity::text, ',') from risk_signals where dedup_key like 'INS:%' and resolved_at is null")/$(Q "select count(*) from notifications where template='INSURANCE_EXPIRY'")" "1/CRITICAL/4"
run $SCX "select $(SAVE $SCXO OCP/SCX-2 400)" commit >/dev/null
chk "nowa polisa poza oknem: ryzyko zamknięte automatycznie" "$(Q "select detect_insurance_expiry(now() + interval '32 days')")/$(Q "select count(*) from risk_signals where dedup_key like 'INS:%' and resolved_at is null")" "0/0"
$PSQL -c "set session_replication_role=replica; update loads set status='CANCELLED' where carrier_org_id='$SCXO'" >/dev/null
chk "transporty anulowane: polisa kończy się, ale bez ryzyka (nic nie jest zagrożone)" "$(Q "select detect_insurance_expiry(now() + interval '420 days')")" 0
chk "NULL w p_now = wyjątek" "$($PSQL -c "select detect_insurance_expiry(null)" 2>&1 | grep -c 'p_now wymagane')" 1
echo; echo "WYNIK: $ok OK, $fail FAIL"
