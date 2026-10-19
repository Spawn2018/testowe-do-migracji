#!/usr/bin/env bash
# AUD-03 — KSH — PANEL ZLECENIA: KSH zmienia WYŁĄCZNIE daty i godziny załadunku/rozładunku (ksh_confirm_dates);
# „Zmień ciągnik” i inne pola przewoźnika/HHL zablokowane w bazie (odmowa przez API = PostgREST jako authenticated).
. "$(git rev-parse --show-toplevel)/tests/db/refuse-prod.sh"
PSQL="psql ${PGURL:-postgres://postgres@localhost:5433/tower} -Atq"
HHL=11111111-0000-0000-0000-000000000001; KSH=11111111-0000-0000-0000-000000000002; SCX=11111111-0000-0000-0000-000000000003
L1=33333333-0000-0000-0000-000000000001; L2=33333333-0000-0000-0000-000000000002
ok=0; fail=0
run() { local end="rollback"; [ "$3" = "commit" ] && end="commit"
  $PSQL -v ON_ERROR_STOP=1 -c "begin; set local role authenticated; set local request.jwt.claim.sub='$1'; $2; $end;" 2>&1; }
val()  { out=$(run "$2" "$3" "$5" | grep -v -E '^(BEGIN|SET|ROLLBACK|COMMIT)$' | tail -1)
         if [ "$out" = "$4" ]; then ok=$((ok+1)); echo "  OK    $1"; else fail=$((fail+1)); echo "  FAIL  $1  (otrzymano: $out, oczekiwano: $4)"; fi; }
err()  { out=$(run "$2" "$3"); if echo "$out" | grep -qiE "$4"; then ok=$((ok+1)); echo "  OK    $1"; else fail=$((fail+1)); echo "  FAIL  $1  →  $(echo "$out" | tail -1)"; fi; }
sys()  { $PSQL -v ON_ERROR_STOP=1 -c "$1" 2>&1; }
sval() { out=$(sys "$2" | tail -1); if [ "$out" = "$3" ]; then ok=$((ok+1)); echo "  OK    $1"; else fail=$((fail+1)); echo "  FAIL  $1  (otrzymano: $out, oczekiwano: $3)"; fi; }

sys "update app_users set full_name='Anna Testowa' where auth_id='$KSH'" >/dev/null
sys "update loads set plan_load_date='2026-11-10', plan_delivery_date='2026-11-14',
       plan_load_from='2026-11-10 07:00+01', plan_load_to='2026-11-10 15:00+01',
       plan_delivery_from='2026-11-14 07:00+01', plan_delivery_to='2026-11-14 15:00+01', tractor_plate='PO1111A'
     where id in ('$L1','$L2')" >/dev/null

echo; echo "[aud03-1] „Zmień ciągnik” i inne pola — KSH zablokowany w bazie (API)"
val "KSH nie zmieni ciągnika (UPDATE loads → 0 wierszy)"   $KSH "with u as (update loads set tractor_plate='X1' where id='$L1' returning 1) select count(*) from u" 0
val "KSH nie zmieni naczepy ani kierowcy"                  $KSH "with u as (update loads set trailer_plate='X2', driver_name='X' where id='$L1' returning 1) select count(*) from u" 0
val "KSH nie zmieni statusu"                               $KSH "with u as (update loads set status='READY' where id='$L1' returning 1) select count(*) from u" 0
val "KSH nie zmieni dat bezpośrednio (bez RPC)"            $KSH "with u as (update loads set plan_load_date='2026-11-11' where id='$L1' returning 1) select count(*) from u" 0
val "KSH nie wpisze numeru HHL"                            $KSH "with u as (update loads set hhl_order_no='HHL/X' where id='$L1' returning 1) select count(*) from u" 0
sval "ciągnik bez zmian po próbach KSH"                    "select tractor_plate from loads where id='$L1'" "PO1111A"
val "przewoźnik (SCX) zmienia ciągnik na swoim transporcie" $SCX "with u as (update loads set tractor_plate='PO2222B' where id='$L1' returning 1) select count(*) from u" 1
val "HHL zmienia ciągnik"                                  $HHL "with u as (update loads set tractor_plate='PO3333C' where id='$L1' returning 1) select count(*) from u" 1

echo; echo "[aud03-2] Edycja dat przez KSH (ksh_confirm_dates)"
err "przewoźnik nie wywoła edycji dat KSH"                 $SCX "select ksh_confirm_dates('$L1','2026-11-11','2026-11-15')" "KSH Użytkownik|wyłącznie KSH"
val "HHL_ADMIN wywoła edycję dat (0234)"                   $HHL "select (ksh_confirm_dates('$L1','2026-11-11','2026-11-15')->>'changed')" true commit
err "rozładunek przed załadunkiem odrzucony (KSH)"         $KSH "select ksh_confirm_dates('$L1','2026-11-12','2026-11-11')" "przed datą załadunku"
val "HHL_ADMIN: rozładunek przed załadunkiem → sprawa"     $HHL "select (ksh_confirm_dates('$L1','2026-11-20','2026-11-10')->>'dates_check')" true commit
sval "sprawa KSH_DATES_CHECK otwarta" "select count(*) from decisions where load_id='$L1' and type_code='KSH_DATES_CHECK' and status in ('NEW','ASSIGNED','SNOOZED')" 1
err "okno odwrócone odrzucone"                             $KSH "select ksh_confirm_dates('$L1',null,null,'2026-11-10 16:00+01','2026-11-10 08:00+01')" "Początek okna"
val "KSH zmienia datę i godziny"                           $KSH "select (ksh_confirm_dates('$L1','2026-11-12','2026-11-16','2026-11-12 08:00+01','2026-11-12 14:00+01','2026-11-16 09:00+01','2026-11-16 13:00+01')->>'changed')" true commit
sval "daty i okna zapisane"                                "select plan_load_date||'|'||plan_delivery_date||'|'||to_char(plan_load_from at time zone 'Europe/Warsaw','HH24:MI')||'|'||to_char(plan_delivery_to at time zone 'Europe/Warsaw','HH24:MI') from loads where id='$L1'" "2026-11-12|2026-11-16|08:00|13:00"
sval "inne pola bez zmian (ciągnik, status)"               "select tractor_plate||'|'||status from loads where id='$L1'" "PO1111A|PLANNED"
sval "status dat POTWIERDZONA, autor KSH"                  "select l.plan_dates_status||'|'||(l.plan_dates_confirmed_by = u.id)::text from loads l, app_users u where l.id='$L1' and u.auth_id='$KSH'" "POTWIERDZONA|true"
sval "Historia: jeden wpis PLAN_DATES_CHANGED „Anna Testowa // KSH”" "select count(*)||'|'||max(payload->>'actor')||'|'||max(payload->>'by') from load_events where load_id='$L1' and event_type='PLAN_DATES_CHANGED' and payload->>'by'='KSH'" "1|Anna Testowa // KSH|KSH"
sval "DEC-4: powiadomienie HHL i przewoźnika (IN_APP), autor bez" "select string_agg(distinct o.code, ',' order by o.code) from notifications n join app_users u on u.id=n.user_id join organizations o on o.id=u.org_id where n.load_id='$L1' and n.template='PLAN_DATES_CHANGED' and n.channel='IN_APP' and n.payload->>'by'='KSH'" "HHL,SCX"
sval "I-10: transport nieawizowany → bez SCHEDULE_DATE_CRITICAL" "select count(*) from load_events where load_id='$L1' and event_type='SCHEDULE_DATE_CRITICAL'" "0"
sys "update loads set driver_name='Jan Kierowca' where id='$L2'" >/dev/null
val "awizowany: KSH zmienia datę"                          $KSH "select (ksh_confirm_dates('$L2','2026-11-11','2026-11-15')->>'awizowany')" true commit
sval "I-10: awizowany → SCHEDULE_DATE_CRITICAL + IN_APP HHL i przewoźnik" "select (select count(*) from load_events where load_id='$L2' and event_type='SCHEDULE_DATE_CRITICAL')||'|'||(select count(*) from notifications where load_id='$L2' and template='SCHEDULE_DATE_CRITICAL' and channel='IN_APP')" "1|2"
val "bez zmiany → changed=false, bez wpisu"                $KSH "select (ksh_confirm_dates('$L2','2026-11-11','2026-11-15')->>'changed')" false commit
sval "nadal jeden wpis PLAN_DATES_CHANGED na L2"           "select count(*) from load_events where load_id='$L2' and event_type='PLAN_DATES_CHANGED' and payload->>'by'='KSH'" "1"
sys "update loads set status='AT_LOADING', hhl_order_no='HHL/T/1', carrier_order_no='SCX/T/1' where id='$L2'" >/dev/null 2>&1
err "po wjeździe na załadunek KSH nie zmienia dat"         $KSH "select ksh_confirm_dates('$L2','2026-11-12','2026-11-16')" "Po wjeździe na załadunek|wyłącznie HHL|Brak"
val "HHL_ADMIN po załadunku zmienia daty (0234)"           $HHL "select (ksh_confirm_dates('$L2','2026-11-13','2026-11-17')->>'changed')" true commit
val "anon nie wywoła RPC"                                  $KSH "select has_function_privilege('anon','ksh_confirm_dates(uuid,date,date,timestamptz,timestamptz,timestamptz,timestamptz)','execute')::text" false

echo; echo "WYNIK: $ok OK, $fail FAIL"
[ "$fail" -eq 0 ]
