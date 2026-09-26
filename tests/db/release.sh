#!/usr/bin/env bash
# TOWER — test bazy wydania 1.0 (ANEKS 3 §2.1–§2.4, ANEKS 4 PR1–PR7).
# Własna, czysta baza: atrapa Supabase (+ rola service_role jak w Supabase) → migracje → seed testowy.
# Użycie: PGADMIN=postgres://postgres@localhost:5433/postgres bash tests/db/release.sh
# UWAGA: supabase_stub.sql NIGDY nie uruchamiaj na Supabase.
set -e
ADMIN=${PGADMIN:-postgres://postgres@localhost:5433/postgres}
DB=tower_test_release; URL="${ADMIN%/*}/$DB"
psql "$ADMIN" -q -c "drop database if exists $DB" -c "create database $DB"
psql "$URL" -q -v ON_ERROR_STOP=1 -f tests/db/supabase_stub.sql
psql "$URL" -q -v ON_ERROR_STOP=1 -c "do \$\$ begin if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if; end \$\$;" \
  -c "grant usage on schema public, auth to service_role" \
  -c "alter default privileges in schema public grant all on tables to service_role" \
  -c "alter default privileges in schema public grant all on sequences to service_role"
for f in supabase/migrations/*.sql; do psql "$URL" -q -v ON_ERROR_STOP=1 -f "$f" >/dev/null 2>&1 || { echo "MIGRACJA $f: błąd"; psql "$URL" -q -v ON_ERROR_STOP=1 -f "$f" 2>&1 | tail -3; exit 1; }; done
psql "$URL" -q -v ON_ERROR_STOP=1 -f tests/db/seed.sql
set +e

PSQL="psql $URL -Atq"
HHL=11111111-0000-0000-0000-000000000001; KSH=11111111-0000-0000-0000-000000000002; SCX=11111111-0000-0000-0000-000000000003
P=22222222-0000-0000-0000-000000000001; INVK=44444444-0000-0000-0000-00000000000c; INVP=44444444-0000-0000-0000-0000000000ee
L1=33333333-0000-0000-0000-000000000001; L2=33333333-0000-0000-0000-000000000002
ok=0; fail=0
run() { local end="rollback"; [ "$3" = "commit" ] && end="commit"
  $PSQL -v ON_ERROR_STOP=1 -c "begin; set local role ${ROLE:-authenticated}; set local request.jwt.claim.sub='$1'; $2; $end;" 2>&1; }
val() { out=$(run "$2" "$3" "$5" | grep -v -E '^(BEGIN|SET|ROLLBACK|COMMIT)$' | tail -1)
  if [ "$out" = "$4" ]; then ok=$((ok+1)); echo "  OK    $1"; else fail=$((fail+1)); echo "  FAIL  $1  (otrzymano: $out, oczekiwano: $4)"; fi; }
err() { out=$(run "$2" "$3"); if echo "$out" | grep -qiE "$4"; then ok=$((ok+1)); echo "  OK    $1"; else fail=$((fail+1)); echo "  FAIL  $1  →  $(echo "$out" | tail -1)"; fi; }
sys() { $PSQL -v ON_ERROR_STOP=1 -c "$1" >/dev/null 2>&1 || echo "  (sys błąd: $1)"; }
Q() { $PSQL -c "$1" 2>&1 | tail -1; }
chk() { if [ "$2" = "$3" ]; then ok=$((ok+1)); echo "  OK    $1"; else fail=$((fail+1)); echo "  FAIL  $1  (otrzymano: $2, oczekiwano: $3)"; fi; }

echo; echo "[2.1] Import nie kasuje transportów — anulowanie, blokada od AT_LOADING i na fakturze"
L3=33333333-0000-0000-0000-000000000003
sys "insert into loads (id, project_id, carrier_org_id, order_no, hhl_order_no) values ('$L3','$P','00000000-0000-0000-0000-00000000a003','KSH/3','HHL/3')"
sys "update loads set status='READY' where id='$L3'"
val "podgląd: READY niezafakturowany → CANCEL"          $HHL "select verdict from import_removal_check(array['$L3']::uuid[])" CANCEL
val "podgląd: zafakturowany → BLOCKED_INVOICED z powodem" $HHL "select verdict||' / '||reason from import_removal_check(array['$L1']::uuid[])" "BLOCKED_INVOICED / Transport jest na fakturze"
val "podgląd niczego nie zmienia"                        $HHL "select count(*) from import_removal_check(array['$L3']::uuid[]); select status from loads where id='$L3'" READY
val "import anuluje transport w READY"                   $HHL "select verdict from import_cancel_loads(array['$L3']::uuid[])" CANCELLED
val "anulowanie w READY zostawia wiersz (CANCELLED)"     $HHL "select count(*) from import_cancel_loads(array['$L3']::uuid[]); select count(*)||':'||max(status::text) from loads where id='$L3'" "1:CANCELLED"
val "import nie anuluje zafakturowanego (L1, PLANNED)"   $HHL "select count(*) from import_cancel_loads(array['$L1']::uuid[]); select status from loads where id='$L1'" PLANNED
sys "update loads set hhl_order_no='HHL/2', carrier_order_no='SCX/2' where id='$L2'"
for st in AT_LOADING IN_TRANSIT_PL AT_PORT_GDANSK FERRY AT_PORT_NYNASHAMN IN_TRANSIT_SE AT_SITE UNLOADED DELIVERED; do
  extra=""; [ "$st" = UNLOADED ] || [ "$st" = DELIVERED ] && extra=", actual_delivery_at=now()"
  sys "update loads set status='$st'$extra where id='$L2'"
  val "import nie anuluje w $st (BLOCKED_STATUS, status bez zmian)" $HHL "select string_agg(verdict,',') from import_cancel_loads(array['$L2']::uuid[]); select status from loads where id='$L2'" $st
done
sys "update loads set status='AT_LOADING', actual_delivery_at=null where id='$L2'"
err "HHL: bezpośredni UPDATE na CANCELLED odrzucony"     $HHL "update loads set status='CANCELLED' where id='$L2'" "cancel_load"
err "HHL: ręczne anulowanie bez powodu odrzucone"        $HHL "select cancel_load('$L2', ' ')" "wymaga powodu"
err "SCX: cancel_load odrzucone"                         $SCX "select cancel_load('$L2', 'awaria')" "wyłącznie HHL"
err "KSH: import_cancel_loads odrzucone"                 $KSH "select * from import_cancel_loads(array['$L2']::uuid[])" "wyłącznie HHL"
val "HHL: ręczne anulowanie w drodze z powodem"          $HHL "select cancel_load('$L2', 'Awaria naczepy — wycofany')" CANCELLED commit
chk "ręczne anulowanie: wpis w audit_log z powodem"      "$(Q "select new_value->>'reason' from audit_log where action='LOAD_CANCEL_MANUAL' and entity_id='$L2'")" "Awaria naczepy — wycofany"
val "import: wpis w audit_log (LOAD_CANCEL_IMPORT)"      $HHL "select count(*) from import_cancel_loads(array['$L3']::uuid[])" 1 commit
chk "import: dziennik ma wpis dla L3"                    "$(Q "select count(*) from audit_log where action='LOAD_CANCEL_IMPORT' and entity_id='$L3'")" 1
err "DELETE loads odrzucony — HHL"                       $HHL "delete from loads where id='$L3'" "permission denied|nie można skasować"
err "DELETE loads odrzucony — KSH"                       $KSH "delete from loads where id='$L3'" "permission denied|nie można skasować"
err "DELETE loads odrzucony — SCX"                       $SCX "delete from loads where id='$L3'" "permission denied|nie można skasować"
err "DELETE loads odrzucony — anon"                      $HHL "set local role anon; delete from loads where id='$L3'" "permission denied|nie można skasować"
err "DELETE loads odrzucony — service_role"              $HHL "set local role service_role; delete from loads where id='$L3'" "permission denied|nie można skasować"
sys "grant delete on loads to service_role"
err "DELETE loads: wyzwalacz blokuje nawet po nadaniu uprawnienia" $HHL "set local role service_role; delete from loads where id='$L3'" "nie można skasować"
sys "revoke delete on loads from service_role"
chk "wiersze transportów zostały (3)"                    "$(Q "select count(*) from loads")" 3

echo; echo "[2.2] Widoczność ryzyk — zamknięte drzwi (audience + RLS)"
CRX=11111111-0000-0000-0000-000000000004; OCRX=00000000-0000-0000-0000-00000000a004; OSCX=00000000-0000-0000-0000-00000000a003
L4=33333333-0000-0000-0000-000000000004
sys "insert into organizations (id, code, name, kind) values ('$OCRX','CRX','Inny przewoźnik','CARRIER')"
sys "insert into app_users (auth_id, org_id, email, role) values ('$CRX','$OCRX','crx@test','CARRIER_DISPATCH')"
sys "insert into loads (id, project_id, carrier_org_id, order_no) values ('$L4','$P','$OCRX','KSH/4')"
sys "alter type risk_kind add value if not exists 'TEST_NOWY'"
R() { sys "insert into risk_signals (project_id, load_id, kind, severity, title, detail) values ('$P', $1, '$2', 'HIGH', 'test', '$3'::jsonb)"; }
R "'$L1'" INVOICE_MISMATCH "{\"t\":\"cost\",\"invoice_id\":\"$INVK\"}"
R "'$L1'" INVOICE_MISMATCH "{\"t\":\"rev\",\"invoice_id\":\"$INVP\"}"
R "'$L1'" INVOICE_MISMATCH "{\"t\":\"revdir\",\"direction\":\"PRZYCHOD\"}"
R "'$L1'" INVOICE_MISMATCH "{\"t\":\"nodir\"}"
R "'$L1'" SEQUENCE '{"t":"seq"}'
R null FERRY '{"t":"ferry"}'
R "'$L1'" SILENT_VEHICLE '{"t":"silent1"}'
R "'$L4'" SILENT_VEHICLE '{"t":"silent4"}'
R "'$L4'" FERRY '{"t":"ferry4"}'
R null PERMIT "{\"t\":\"permcrx\",\"carrier_org_id\":\"$OCRX\"}"
R "'$L1'" TEST_NOWY '{"t":"nowy"}'
A() { Q "select audience from risk_signals where detail->>'t'='$1'"; }
chk "odbiorcy: faktura kosztowa → HHL_PRZEWOZNIK"       "$(A cost)" HHL_PRZEWOZNIK
chk "odbiorcy: faktura przychodowa → HHL_KLIENT"        "$(A rev)" HHL_KLIENT
chk "odbiorcy: kierunek w szczegółach PRZYCHOD → HHL_KLIENT" "$(A revdir)" HHL_KLIENT
chk "odbiorcy: rozbieżność bez kierunku → HHL"          "$(A nodir)" HHL
chk "odbiorcy: SEQUENCE → HHL_KLIENT"                   "$(A seq)" HHL_KLIENT
chk "odbiorcy: FERRY → WSZYSCY"                         "$(A ferry)" WSZYSCY
chk "odbiorcy: SILENT_VEHICLE → HHL_PRZEWOZNIK"         "$(A silent1)" HHL_PRZEWOZNIK
chk "odbiorcy: nowy, nieprzypisany rodzaj → HHL"        "$(A nowy)" HHL
C() { echo "select count(*) from risk_signals where detail->>'t'='$1'"; }
val "KSH nie widzi ryzyka faktury kosztowej"            $KSH "$(C cost)" 0
val "KSH widzi ryzyko faktury przychodowej"             $KSH "$(C rev)" 1
val "KSH widzi kolejność montażu"                        $KSH "$(C seq)" 1
val "KSH nie widzi ryzyka przewoźnika (cichy pojazd)"   $KSH "$(C silent1)" 0
val "SCX widzi ryzyko swojej faktury kosztowej"         $SCX "$(C cost)" 1
val "SCX nie widzi ryzyka faktury przychodowej"         $SCX "$(C rev)" 0
val "SCX nie widzi kolejności montażu"                  $SCX "$(C seq)" 0
val "SCX widzi cichy pojazd swojego transportu"         $SCX "$(C silent1)" 1
val "SCX nie widzi ryzyk transportu innego przewoźnika (cichy)" $SCX "$(C silent4)" 0
val "SCX nie widzi ryzyk transportu innego przewoźnika (prom)"  $SCX "$(C ferry4)" 0
val "SCX nie widzi ryzyka bez transportu innej firmy"   $SCX "$(C permcrx)" 0
val "CRX widzi ryzyko bez transportu swojej firmy"      $CRX "$(C permcrx)" 1
val "CRX widzi cichy pojazd swojego transportu"         $CRX "$(C silent4)" 1
val "SCX widzi ryzyko korytarza bez transportu"         $SCX "$(C ferry)" 1
val "KSH widzi ryzyko korytarza"                         $KSH "$(C ferry)" 1
val "nowy rodzaj: HHL widzi"                             $HHL "$(C nowy)" 1
val "nowy rodzaj: KSH nie widzi"                         $KSH "$(C nowy)" 0
val "nowy rodzaj: SCX nie widzi"                         $SCX "$(C nowy)" 0
val "HHL nie nadpisze odbiorców (SEQUENCE z WSZYSCY → HHL_KLIENT)" $HHL "insert into risk_signals (project_id, load_id, kind, severity, title, detail, audience) values ('$P','$L1','SEQUENCE','LOW','x','{\"t\":\"ovr\"}','WSZYSCY'); select audience from risk_signals where detail->>'t'='ovr'" HHL_KLIENT
err "anon nie czyta ryzyk"                               $HHL "set local role anon; select count(*) from risk_signals" "permission denied|0"

echo; echo "[2.4] Numer zlecenia 48 h przed załadunkiem — ostrzeżenie, bez blokady"
L5=33333333-0000-0000-0000-000000000005
sys "insert into loads (id, project_id, carrier_org_id, order_no, plan_load_from) values ('$L5','$P','$OSCX','KSH/5', now() + interval '47 hours')"
chk "detect_missing_order_numbers: 2 ryzyka (HHL + przewoźnik)" "$(Q "select detect_missing_order_numbers()")" 2
chk "brak numeru HHL → odbiorcy HHL"                     "$(Q "select audience from risk_signals where load_id='$L5' and detail->>'side'='HHL'")" HHL
chk "brak numeru przewoźnika → odbiorcy HHL_PRZEWOZNIK"  "$(Q "select audience from risk_signals where load_id='$L5' and detail->>'side'='CARRIER'")" HHL_PRZEWOZNIK
val "SCX widzi ryzyko swojego numeru"                    $SCX "select count(*) from risk_signals where load_id='$L5' and detail->>'side'='CARRIER'" 1
val "SCX nie widzi ryzyka numeru HHL"                    $SCX "select count(*) from risk_signals where load_id='$L5' and detail->>'side'='HHL'" 0
val "KSH nie widzi żadnego z nich"                       $KSH "select count(*) from risk_signals where load_id='$L5'" 0
chk "przypomnienie do przewoźnika (SCX)"                 "$(Q "select count(*) from notifications where load_id='$L5' and template='ORDER_NO_MISSING' and payload->>'side'='CARRIER' and user_id=(select id from app_users where auth_id='$SCX')")" 1
chk "przypomnienie do HHL"                               "$(Q "select count(*) from notifications where load_id='$L5' and template='ORDER_NO_MISSING' and payload->>'side'='HHL' and user_id=(select id from app_users where auth_id='$HHL')")" 1
chk "przewoźnik bez przypomnienia o numerze HHL"         "$(Q "select count(*) from notifications where load_id='$L5' and payload->>'side'='HHL' and user_id=(select id from app_users where auth_id='$SCX')")" 0
val "brak blokady: HHL przestawia na RESOURCES_PENDING bez numerów (47 h)" $HHL "update loads set status='RESOURCES_PENDING' where id='$L5' returning status" RESOURCES_PENDING
err "blokady Q10 zostają: READY bez numeru HHL odrzucone" $HHL "update loads set status='READY' where id='$L5'" "numeru zlecenia"

echo; echo "WYNIK: $ok OK, $fail FAIL"
