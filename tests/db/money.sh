#!/usr/bin/env bash
# TOWER — test pieniędzy (Etap 4: M2+): widoki finansowe v2, Z1, kurs, faktury, terminy; M9: pozycje kierowcy; M12: integracje.
# Własna, czysta baza: atrapa Supabase → migracje → seed testowy.
# Użycie: PGADMIN=postgres://postgres@localhost:5433/postgres bash tests/db/money.sh
# UWAGA: supabase_stub.sql NIGDY nie uruchamiaj na Supabase.
set -e
ADMIN=${PGADMIN:-postgres://postgres@localhost:5433/postgres}
. "$(git rev-parse --show-toplevel)/tests/db/local-only.sh"
DB=tower_test_money; URL="${ADMIN%/*}/$DB"
psql "$ADMIN" -q -c "drop database if exists $DB" -c "create database $DB"
psql "$URL" -q -v ON_ERROR_STOP=1 -f tests/db/supabase_stub.sql
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

echo; echo "[M2] Widoki finansowe v2 (jedyna droga do cen; tabele bazowe zamknięte)"
sys "update load_cost set pricing_tier='REALIZACJA', computed_total_eur=2000, fuel_ref_date='2026-09-24', fuel_applied_mult=1.02, fx_table_no='186/A/NBP/2026', fx_effective_date='2026-09-24', fx_rate_pln=4.39 where load_id='$L1'"
sys "update load_revenue set pricing_tier='REALIZACJA', computed_total_eur=2500, fuel_ref_date='2026-09-24', fuel_applied_mult=1.02, fx_table_no='186/A/NBP/2026', fx_effective_date='2026-09-24', fx_rate_pln=4.39 where load_id='$L1'"
val "HHL widzi marżę w EUR z widoku"               $HHL "select margin_eur from v_load_financials_hhl where load_id='$L1'" 500.00
val "HHL: poziom = mniej pewna strona"             $HHL "select pricing_tier from v_load_financials_hhl where load_id='$L1'" REALIZACJA
val "HHL: migawka kursu z numerem tabeli"          $HHL "select cost_fx_table_no||' '||cost_fx_mid from v_load_financials_hhl where load_id='$L1'" "186/A/NBP/2026 4.390000"
val "HHL: migawka mnożnika z datą"                 $HHL "select fuel_ref_date||' '||cost_fuel_mult from v_load_financials_hhl where load_id='$L1'" "2026-09-24 1.020000"
val "KSH nie widzi widoku marży (0 wierszy)"       $KSH "select count(*) from v_load_financials_hhl" 0
val "SCX nie widzi widoku marży (0 wierszy)"       $SCX "select count(*) from v_load_financials_hhl" 0
val "SCX widzi koszt swojego transportu"           $SCX "select effective_total_eur from v_load_price_carrier where load_id='$L1'" 2000.00
val "KSH nie widzi kosztu (0 wierszy)"             $KSH "select count(*) from v_load_price_carrier" 0
val "KSH widzi przychód swojego projektu"          $KSH "select effective_total_eur from v_load_price_client where load_id='$L1'" 2500.00
val "SCX nie widzi przychodu (0 wierszy)"          $SCX "select count(*) from v_load_price_client" 0
# E19 (P3, 0196): SELECT na load_cost z RLS — KSH 0 wierszy (nie permission denied)
val "KSH nie widzi wierszy w load_cost (RLS)"       $KSH "select count(*) from load_cost" 0
err "anon nie odczyta widoku"                       $KSH "set local role anon; select * from v_load_price_client" "permission denied"
sys "update app_users set role='CARRIER_USER' where auth_id='$SCX'"
# E9 (P3, 0196): SCX Użytkownik widzi koszty jak Dyspozytor
val "SCX Użytkownik (CARRIER_USER) widzi koszt swojego transportu" $SCX "select count(*) from v_load_price_carrier where load_id='$L1'" 1
sys "update app_users set role='CARRIER_DISPATCH' where auth_id='$SCX'"

echo; echo "[M2] Z1 — faktura nie nadpisuje wyliczonej wartości"
sys "update load_cost set invoiced_total_eur=2100 where load_id='$L1'"
val "po fakturze: obie wartości zachowane"         $HHL "select cost_computed_eur||'/'||cost_invoiced_eur||'/'||cost_effective_eur from v_load_financials_hhl where load_id='$L1'" "2000.00/2100.00/2100.00"
val "po fakturze: marża z fakturowanej"            $HHL "select margin_eur from v_load_financials_hhl where load_id='$L1'" 400.00
val "po fakturze: poziom strony = FAKTURA"         $HHL "select cost_tier from v_load_financials_hhl where load_id='$L1'" FAKTURA
out=$($PSQL -c "update load_cost set computed_total_eur=2100 where load_id='$L1'" 2>&1)
if echo "$out" | grep -q "Z1"; then ok=$((ok+1)); echo "  OK    wyliczenie po zafakturowaniu niezmienne (wyzwalacz Z1)"; else fail=$((fail+1)); echo "  FAIL  Z1 → $out"; fi


echo; echo "[M3] Kurs NBP: fx_rates, reguła W3, migawka przy rozładunku"
# Hosted Windows: `python3` bywa atrapą Sklepu (pusty stdout) — bierzemy Node.
if command -v node >/dev/null 2>&1; then
  FIX=$(node -e "const fs=require('fs');process.stdout.write(JSON.stringify(JSON.parse(fs.readFileSync('tests/fixtures/nbp-eur-2025-12.json','utf8'))))")
else
  FIX=$(python3 -c "import json;print(json.dumps(json.load(open('tests/fixtures/nbp-eur-2025-12.json'))))")
fi
# Ingest jako właściciel połączenia (postgres). Na hosted `set local role postgres` z authenticated jest zabronione.
ing=$($PSQL -c "select fx_ingest_nbp('$FIX'::jsonb, 'fixture') > 5" 2>&1 | grep -vE '^(SELECT|)$' | tail -1 | tr -d '\r')
if [ "$ing" = "t" ]; then ok=$((ok+1)); echo "  OK    parser zapisuje tabele z odpowiedzi API (przedział)"; else fail=$((fail+1)); echo "  FAIL  parser zapisuje tabele z odpowiedzi API (przedział)  (otrzymano: $ing, oczekiwano: t)"; fi
val "29.12.2025 → 248/A z 23.12 (5 dni bez tabel)"   $KSH "select table_no||' '||rate_date from fx_rate_before('2025-12-29')" "248/A/NBP/2025 2025-12-23"
val "2.01.2026 → tabela z 31.12 (dzień roboczy przed)" $KSH "select rate_date from fx_rate_before('2026-01-02')" "2025-12-31"
err "brak tabeli w przedziale → błąd, nie zgadywanie" $KSH "select * from fx_rate_before('2025-11-01')" "Brak tabeli A NBP"
val "zalogowany odczyta fx_rates (dane publiczne)"   $SCX "select count(*) > 0 from fx_rates" t
err "SCX nie zapisze kursu"                          $SCX "insert into fx_rates (currency, rate_date, rate_pln) values ('EUR','2025-12-27',9.99)" "permission denied"
err "SCX nie wywoła parsera"                         $SCX "select fx_ingest_nbp('{}'::jsonb)" "permission denied"
err "KSH nie wywoła pobierania"                      $KSH "select fx_sync_nbp()" "permission denied"
sys "insert into load_cost (load_id, base_amount, computed_total_eur) values ('$L2', 1000, 1000); insert into load_revenue (load_id, base_amount, computed_total_eur) values ('$L2', 1300, 1300)"
sys "update loads set actual_delivery_at='2025-12-29T23:30:00Z' where id='$L2'"
val "migawka: pułapka UTC — 29.12 23:30Z = 30.12 lokalnie → 249/A z 29.12" $HHL "select cost_fx_table_no||' '||cost_fx_date from v_load_financials_hhl where load_id='$L2'" "249/A/NBP/2025 2025-12-29"
val "opłata paliwowa bez daty załadunku nie bierze rozładunku" $HHL "select coalesce(fuel_ref_date::text,'brak') from v_load_financials_hhl where load_id='$L2'" brak
val "migawka po obu stronach ta sama, poziom REALIZACJA" $HHL "select (cost_fx_table_no = rev_fx_table_no and pricing_tier='REALIZACJA' and not cost_fx_provisional)::text from v_load_financials_hhl where load_id='$L2'" true
sys "update loads set plan_delivery_from='2026-01-15T08:00:00Z', plan_delivery_to='2026-01-15T16:00:00Z' where id='$L2'"
sys "insert into fx_rates (currency, rate_date, rate_pln, table_no) values ('EUR','2025-12-30',9.9999,'999/A/TEST') on conflict do nothing"
val "migawka niezmienna po zmianie planu i nowych tabelach" $HHL "select cost_fx_table_no||' '||cost_fx_mid from v_load_financials_hhl where load_id='$L2'" "249/A/NBP/2025 4.227400"
sys "delete from fx_rates where table_no='999/A/TEST'"
sys "update loads set actual_delivery_at='2026-03-10T10:00:00Z' where id='$L2'"
val "brak tabeli przed rozładunkiem → migawka prowizoryczna (nie zgadywana)" $HHL "select cost_fx_provisional::text||' '||coalesce(fuel_ref_date::text,'brak') from v_load_financials_hhl where load_id='$L2'" "true brak"
sys "insert into fx_rates (currency, rate_date, rate_pln, table_no) values ('EUR','2026-03-09',4.3000,'047/A/NBP/2026')"
# fx_apply_pending: tylko service_role / właściciel — nie przez set role z authenticated
app=$($PSQL -c "select fx_apply_pending()" 2>&1 | grep -vE '^(SELECT|)$' | tail -1 | tr -d '\r')
if [ "$app" = "1" ]; then ok=$((ok+1)); echo "  OK    fx_apply_pending uzupełnia migawkę po pobraniu tabeli"; else fail=$((fail+1)); echo "  FAIL  fx_apply_pending uzupełnia migawkę po pobraniu tabeli  (otrzymano: $app, oczekiwano: 1)"; fi
val "po uzupełnieniu: tabela z dnia roboczego przed rozładunkiem" $HHL "select cost_fx_table_no||' '||cost_fx_provisional from v_load_financials_hhl where load_id='$L2'" "047/A/NBP/2026 false"

echo; echo "[M5] Numery zleceń: wymuszenie z bazy, każda strona swój, brak przed terminem → ryzyko + przypomnienie"
L3=33333333-0000-0000-0000-000000000003; L4=33333333-0000-0000-0000-000000000004
# A5/E25: status tylko load_status_set; A4: numery w RETURNING → load_order_numbers()
err "GOTOWY bez numeru HHL → zrozumiały komunikat bazy"    $HHL "select load_status_set('$L1','READY',now(),null)" "bez numeru zlecenia HHL"
val "HHL wpisuje swój numer"                               $HHL "update loads set hhl_order_no='HHL/T/1' where id='$L1'; select hhl_order_no from load_order_numbers() where load_id='$L1'" "HHL/T/1"
err "HHL nie zmieni numeru przewoźnika (W12)"              $HHL "update loads set carrier_order_no='X' where id='$L1'" "wpisuje wy..cznie przewo"
err "przewoźnik nie zmieni numeru HHL"                     $SCX "update loads set hhl_order_no='X' where id='$L1'" "nie mo.e zmienia.: hhl_order_no"
err "przewoźnik nie zmieni numeru KSH"                     $SCX "update loads set order_no='X' where id='$L1'" "nie mo.e zmienia.: order_no"
val "przewoźnik wpisuje swój numer"                        $SCX "update loads set carrier_order_no='SCX/T/1' where id='$L1'; select carrier_order_no from load_order_numbers() where load_id='$L1'" "SCX/T/1"
err "przewoźnik nie zmieni okna planowego (AN2)"           $SCX "update loads set plan_load_from=now() where id='$L1'" "plan_load_from"
err "załadunek bez numeru przewoźnika → błąd"              $HHL "update loads set hhl_order_no='HHL/T/2' where id='$L2'; select load_status_set('$L2','AT_LOADING',now(),null)" "bez numeru zlecenia przewo"
sys "insert into loads (id, project_id, carrier_org_id, order_no, plan_load_date) values ('$L3','$P','00000000-0000-0000-0000-00000000a003','KSH/3', current_date + 1), ('$L4','$P','00000000-0000-0000-0000-00000000a003','KSH/4', current_date + 5)"
err "wykrywanie: zwykły użytkownik nie wywoła"             $HHL "select detect_missing_order_numbers()" "permission denied"
d1=$($PSQL -c "select detect_missing_order_numbers()" 2>&1 | grep -vE '^(SELECT|)$' | tail -1 | tr -d '\r')
if [ "$d1" = "2" ]; then ok=$((ok+1)); echo "  OK    wykrywanie: 2 ryzyka (HHL + przewoźnik) tylko dla terminu < 48 h"; else fail=$((fail+1)); echo "  FAIL  wykrywanie: 2 ryzyka…  (otrzymano: $d1, oczekiwano: 2)"; fi
d2=$($PSQL -c "select detect_missing_order_numbers()" 2>&1 | grep -vE '^(SELECT|)$' | tail -1 | tr -d '\r')
if [ "$d2" = "0" ]; then ok=$((ok+1)); echo "  OK    ponowne wykrywanie nie dubluje"; else fail=$((fail+1)); echo "  FAIL  ponowne wykrywanie nie dubluje  (otrzymano: $d2, oczekiwano: 0)"; fi
val "ryzyka w kolejce (L3: HHL + przewoźnik)"              $HHL "select string_agg(detail->>'side', ',' order by detail->>'side') from risk_signals where load_id='$L3' and resolved_at is null" "CARRIER,HHL"
val "L4 (termin za 5 dni) bez ryzyka"                      $HHL "select count(*) from risk_signals where load_id='$L4'" 0
val "przypomnienie dla HHL: tylko HHL-owe"                 $HHL "select string_agg(payload->>'side', ',') from notifications where template='ORDER_NO_MISSING'" "HHL"
val "przypomnienie dla przewoźnika: tylko przewoźnika"     $SCX "select string_agg(payload->>'side', ',') from notifications where template='ORDER_NO_MISSING'" "CARRIER"
# M5 = numery zleceń (nie cisza całkowita): po DATY-67 zmiana planu w M3 daje KSH PLAN_DATES_CHANGED
val "KSH nie dostaje przypomnień o numerach"               $KSH "select count(*) from notifications where template='ORDER_NO_MISSING'" 0
val "KSH bez RISK_OPEN dla RESOURCE_MISSING (0127)"        $KSH "select count(*) from notifications where template='RISK_OPEN' and payload->>'kind'='RESOURCE_MISSING'" 0
err "zalogowany nie wstawi powiadomienia"                  $SCX "insert into notifications (channel, recipient, template) values ('IN_APP','x','X')" "permission denied"
val "uzupełnienie numeru HHL zamyka ryzyko HHL"            $HHL "update loads set hhl_order_no='HHL/T/3' where id='$L3'; select string_agg(detail->>'side', ',') from risk_signals where load_id='$L3' and resolved_at is null" "CARRIER" commit
val "uzupełnienie numeru przewoźnika zamyka ryzyko"        $SCX "update loads set carrier_order_no='SCX/T/3' where id='$L3'; select count(*) from risk_signals where load_id='$L3' and resolved_at is null" 0 commit

echo; echo "[RLS 0013] Luki od 0001: geofence_states, load_permits, schedule_imports, workflow_runs"
sys "insert into schedule_imports (project_id, version, source, column_map, stats) values ('$P', 999, 'UPLOAD', '{}'::jsonb, '{}'::jsonb)"
for t in geofence_states load_permits schedule_imports workflow_runs; do
  ROLE=anon err "anon nie czyta $t" $SCX "select count(*) from $t" "permission denied"
done
val "SCX nie widzi historii importów"                 $SCX "select count(*) from schedule_imports" 0
val "HHL widzi historię importów"                     $HHL "select count(*) > 0 from schedule_imports" t
err "SCX nie wstawi przebiegu reguły"                 $SCX "insert into workflow_runs (workflow_id, status) values (gen_random_uuid(), 'OK')" "permission denied|row-level security"
err "SCX nie zmieni stanu strefy"                     $SCX "update geofence_states set consec_fixes = 99" "permission denied"
err "KSH nie powiąże zezwolenia"                      $KSH "insert into load_permits (load_id, permit_id) values ('$L1', gen_random_uuid())" "row-level security|permission denied|violates"

echo; echo "[M6] Faktury — A4: READY_TO_INVOICE + CMR po dostawie, VAT 23%, tolerancja 0"
L5=33333333-0000-0000-0000-000000000005; L6=33333333-0000-0000-0000-000000000006; L7=33333333-0000-0000-0000-000000000007
CAR=00000000-0000-0000-0000-00000000a003
sys "insert into loads (id, project_id, carrier_org_id, order_no, hhl_order_no, carrier_order_no, status, actual_delivery_at) values
  ('$L5','$P','$CAR','KSH/5','HHL/5','SCX/5','READY_TO_INVOICE','2026-09-22T10:00:00Z'),
  ('$L6','$P','$CAR','KSH/6','HHL/6','SCX/6','READY_TO_INVOICE','2026-09-22T12:00:00Z'),
  ('$L7','$P','$CAR','KSH/7','HHL/7','SCX/7','READY_TO_INVOICE','2026-09-23T10:00:00Z')"
sys "insert into fx_rates (currency, rate_date, rate_pln, table_no) values ('EUR','2026-09-21',4.2500,'183/A/NBP/2026') on conflict do nothing"
sys "insert into load_cost (load_id, base_amount, computed_total_eur) values ('$L5',1000,1000),('$L6',800,800),('$L7',500,500); insert into load_revenue (load_id, base_amount, computed_total_eur) values ('$L5',1300,1300),('$L6',1100,1100),('$L7',700,700)"
sys "insert into documents (project_id, load_id, category, storage_path, file_name, mime_type, size_bytes, uploaded_at)
     values ('$P','$L5','CMR','test/m6-cmr5.pdf','cmr.pdf','application/pdf',100,'2026-09-22T11:00:00Z'),
            ('$P','$L6','CMR','test/m6-cmr6.pdf','cmr.pdf','application/pdf',100,'2026-09-22T13:00:00Z'),
            ('$P','$L7','CMR','test/m6-cmr7.pdf','cmr.pdf','application/pdf',100,'2026-09-23T11:00:00Z')"
DOC="(select id from create_document(null,'INVOICE','f.pdf','application/pdf',100,'$P'))"
# net 1500 → VAT 345, brutto 1845
REGK="select register_invoice(jsonb_build_object('direction','KOSZT','invoice_number','SCX/FV/39/1','issue_date','2026-09-25','week_key','2026-W39','currency','EUR','net_total',1500,'vat_total',345,'gross_total',1845,'document_id',$DOC,'lines',jsonb_build_array(jsonb_build_object('load_id','$L5','invoiced_net',1000),jsonb_build_object('load_id','$L7','invoiced_net',500)))) is not null"
val "SCX rejestruje fakturę kosztową EUR z PDF"                 $SCX "$REGK" t commit
val "A4: VAT 23% zapisany w nagłówku"                           $HHL "select vat_total||' '||gross_total from invoices where invoice_number='SCX/FV/39/1'" "345.00 1845.00"
val "kontrole pozycji: L5 i L7 bez flag kwoty"                  $HHL "select string_agg(coalesce(array_to_string(flags,'+'),'')||'', ',' order by load_id) from invoice_lines where direction='KOSZT' and load_id in ('$L5','$L7')" ","
val "nagłówek: BRAK_NA_FAKTURZE (L6 READY pominięty)"           $HHL "select array_to_string(check_flags,',')||' '||('$L6'=any(missing_load_ids))::text from invoices where invoice_number='SCX/FV/39/1'" "BRAK_NA_FAKTURZE true"
val "termin KOSZT: wystawienie + 35 dni"                          $HHL "select due_date from invoices where invoice_number='SCX/FV/39/1'" 2026-10-30
val "Z1: kwota z faktury obok wyliczenia; poziom = mniej pewna strona" $HHL "select cost_invoiced_eur||' '||cost_computed_eur||' '||pricing_tier from v_load_financials_hhl where load_id='$L5'" "1000.00 1000.00 REALIZACJA"
val "KSH nie widzi faktury kosztowej"                             $KSH "select count(*) from invoices where invoice_number='SCX/FV/39/1'" 0
val "A4: INVOICE_NEW także dla kosztowej (odbiorca HHL)"         $HHL "select count(*) from notifications where template='INVOICE_NEW' and payload->>'number'='SCX/FV/39/1'" 1
err "podwójne fakturowanie zablokowane w bazie"                   $SCX "select register_invoice(jsonb_build_object('direction','KOSZT','invoice_number','SCX/FV/39/2','issue_date','2026-09-25','week_key','2026-W39','currency','EUR','net_total',1000,'vat_total',230,'gross_total',1230,'document_id',$DOC,'lines',jsonb_build_array(jsonb_build_object('load_id','$L5','invoiced_net',1000))))" "podw.jne fakturowanie"
err "SCX nie zarejestruje faktury przychodowej"                   $SCX "select register_invoice(jsonb_build_object('direction','PRZYCHOD','invoice_number','X','issue_date','2026-09-25','week_key','2026-W39','currency','EUR','net_total',1,'vat_total',0.23,'gross_total',1.23,'document_id',$DOC,'lines',jsonb_build_array(jsonb_build_object('load_id','$L5','invoiced_net',1))))" "rejestruje HHL"
err "bez PDF — odrzucone"                                         $SCX "select register_invoice(jsonb_build_object('direction','KOSZT','invoice_number','X2','issue_date','2026-09-25','week_key','2026-W39','currency','EUR','net_total',800,'vat_total',184,'gross_total',984,'lines',jsonb_build_array(jsonb_build_object('load_id','$L6','invoiced_net',800))))" "PDF faktury jest wymagany"
err "A4: zły VAT → odmowa (baza liczy 23%)"                        $SCX "select register_invoice(jsonb_build_object('direction','KOSZT','invoice_number','X3','issue_date','2026-09-25','week_key','2026-W39','currency','EUR','net_total',800,'vat_total',0,'gross_total',800,'document_id',$DOC,'lines',jsonb_build_array(jsonb_build_object('load_id','$L6','invoiced_net',800))))" "VAT liczy baza"
# net 10225 → VAT 2351.75, brutto 12576.75 (L5 5525 + L6 4700)
REGP="select register_invoice(jsonb_build_object('direction','PRZYCHOD','invoice_number','HHL/FV/39/1','issue_date','2026-09-25','week_key','2026-W39','currency','PLN','net_total',10225,'vat_total',2351.75,'gross_total',12576.75,'document_id',$DOC,'lines',jsonb_build_array(jsonb_build_object('load_id','$L5','invoiced_net',5525.00,'fx_table_no','183/A/NBP/2026','fx_mid',4.25,'fx_effective_date','2026-09-21'),jsonb_build_object('load_id','$L6','invoiced_net',4700,'fx_table_no','999/A/X','fx_mid',4.30,'fx_effective_date','2026-09-21')))) is not null"
val "HHL rejestruje fakturę przychodową PLN z kursem per pozycja" $HHL "$REGP" t commit
val "kurs: L5 OK; L6 TABELA+KURS+KWOTA (tolerancja 0)"            $HHL "select string_agg(array_to_string(flags,'+'), ',' order by load_id) from invoice_lines where direction='PRZYCHOD' and load_id in ('$L5','$L6')" ",TABELA_NBP+KURS_NBP+KWOTA"
val "termin PRZYCHOD: wystawienie + 30 dni"                       $HHL "select due_date from invoices where invoice_number='HHL/FV/39/1'" 2026-10-25
val "Z1 po stronie przychodu: 5525 PLN / 4,25 = 1300 EUR"         $HHL "select rev_invoiced_eur from v_load_financials_hhl where load_id='$L5'" 1300.00
val "KSH widzi fakturę HHL, SCX nie"                              $KSH "select count(*) from invoices where invoice_number='HHL/FV/39/1'" 1
val "SCX nie widzi faktury przychodowej"                          $SCX "select count(*) from invoices where invoice_number='HHL/FV/39/1'" 0
val "Q13: KSH dostał powiadomienie o nowej fakturze HHL"          $KSH "select count(*) from notifications where template='INVOICE_NEW' and payload->>'number'='HHL/FV/39/1'" 1
val "KSH w module faktur: PDF + CMR"                              $KSH "select string_agg(distinct role, ',' order by role) from invoice_documents x join invoices i on i.id=x.invoice_id where i.invoice_number='HHL/FV/39/1'" "CMR,FAKTURA_PDF"
err "KSH: SPORNA bez uzasadnienia — odrzucone"                    $KSH "update invoices set verification_status='SPORNA' where invoice_number='HHL/FV/39/1'" "wymaga uzasadnienia"
val "KSH: SPORNA z uzasadnieniem"                                 $KSH "update invoices set verification_status='SPORNA', dispute_note='kurs pozycji 2' where invoice_number='HHL/FV/39/1' returning verification_status" SPORNA
err "KSH nie zmieni treści faktury"                               $KSH "update invoices set net_total=1 where invoice_number='HHL/FV/39/1'" "nie zmienia|KSH nie"
err "HHL (wystawca) nie zmieni statusu sporu KSH (Q14)"           $HHL "update invoices set verification_status='ZGODNA' where invoice_number='HHL/FV/39/1'" "Wystawca nie weryfikuje"
err "SCX nie weryfikuje własnej faktury"                          $SCX "update invoices set verification_status='ZGODNA' where invoice_number='SCX/FV/39/1'" "Wystawca nie weryfikuje"
val "HHL weryfikuje fakturę SCX: ZGODNA"                          $HHL "update invoices set verification_status='ZGODNA' where invoice_number='SCX/FV/39/1' returning verification_status" ZGODNA
err "SCX nie oznaczy „Opłacona”"                                  $SCX "select mark_invoice_paid((select id from invoices where invoice_number='SCX/FV/39/1'), '2026-10-01')" "wy..cznie HHL|wyłącznie HHL"
val "HHL oznacza „Opłacona” z datą (dziennik audytu)"             $HHL "select mark_invoice_paid((select id from invoices where invoice_number='SCX/FV/39/1'), '2026-10-01'); select payment_status||' '||paid_at from invoices where invoice_number='SCX/FV/39/1'" "OPLACONA 2026-10-01"
err "cofnięcie „Opłacona” bez powodu — odrzucone"                 $HHL "select unmark_invoice_paid((select id from invoices where invoice_number='SCX/FV/39/1'), '')" "Wymagany pow"
err "Z4: przewoźnik nie zmieni daty rozładunku zafakturowanego"   $SCX "update loads set actual_delivery_at='2026-09-23T10:00:00Z' where id='$L5'" "zamro"
L8=33333333-0000-0000-0000-000000000008
sys "insert into loads (id, project_id, carrier_org_id, order_no, hhl_order_no, carrier_order_no, status) values ('$L8','$P','$CAR','KSH/8','HHL/8','SCX/8','DELIVERED')"
err "A4: transport bez READY_TO_INVOICE / CMR → odmowa"           $SCX "select register_invoice(jsonb_build_object('direction','KOSZT','invoice_number','SCX/FV/39/8','issue_date','2026-09-25','week_key','2026-W39','currency','EUR','net_total',10,'vat_total',2.30,'gross_total',12.30,'document_id',$DOC,'lines',jsonb_build_array(jsonb_build_object('load_id','$L8','invoiced_net',10))))" "czeka na CMR"
# L8 pod M7 (przypomnienia): osobna faktura kosztowa na L7 już jest; zakładamy drugą na L6
sys "update loads set status='READY_TO_INVOICE', actual_delivery_at='2026-09-22T14:00:00Z' where id='$L8'"
sys "insert into documents (project_id, load_id, category, storage_path, file_name, mime_type, size_bytes, uploaded_at)
     values ('$P','$L8','CMR','test/m6-cmr8.pdf','cmr.pdf','application/pdf',100,'2026-09-22T15:00:00Z')"
val "A4: rejestracja L8 READY z CMR" $SCX "select register_invoice(jsonb_build_object('direction','KOSZT','invoice_number','SCX/FV/39/8','issue_date','2026-09-25','week_key','2026-W39','currency','EUR','net_total',10,'vat_total',2.30,'gross_total',12.30,'document_id',$DOC,'lines',jsonb_build_array(jsonb_build_object('load_id','$L8','invoiced_net',10)))) is not null" t commit

echo; echo "[M7] Terminy i przypomnienia: kadencja −3/0/+1/+7/+14, tylko płatnik i wierzyciel, opłacona → cisza"
Q() { $PSQL -c "$1" 2>&1 | tail -1; }
chk() { if [ "$2" = "$3" ]; then ok=$((ok+1)); echo "  OK    $1"; else fail=$((fail+1)); echo "  FAIL  $1  (otrzymano: $2, oczekiwano: $3)"; fi; }
sys "update app_users set locale='sv' where email='scx@test'"
val "HHL: SCX/FV/39/1 „Opłacona” (utrwalone dla M7)"                 $HHL "select mark_invoice_paid((select id from invoices where invoice_number='SCX/FV/39/1'), '2026-10-01'); select payment_status from invoices where invoice_number='SCX/FV/39/1'" OPLACONA commit
NPR="from notifications n join app_users u on u.id=n.user_id where n.template='PAYMENT_REMINDER'"
INV8="(select id::text from invoices where invoice_number='SCX/FV/39/8')"
chk "−3 dni (27.10, termin 30.10): przypomnienia utworzone"         "$(Q "select send_payment_reminders('2026-10-27') > 0")" t
chk "KSH nie dostaje przypomnień o fakturze SCX"                     "$(Q "select count(*) $NPR and u.email='ksh@test' and n.payload->>'invoice_id'=$INV8")" 0
chk "płatnik HHL + wierzyciel SCX, IN_APP i EMAIL (4 wiersze)"       "$(Q "select string_agg(u.email||':'||(n.payload->>'party')||':'||n.channel, ',' order by u.email, n.channel) $NPR and n.payload->>'invoice_id'=$INV8")" "hhl@test:PAYER:EMAIL,hhl@test:PAYER:IN_APP,scx@test:PAYEE:EMAIL,scx@test:PAYEE:IN_APP"
chk "język odbiorcy i kwota w walucie faktury w treści"              "$(Q "select (n.payload->>'locale')||' '||(n.payload->>'currency')||' '||(n.payload->>'offset') $NPR and u.email='scx@test' and n.channel='EMAIL' and n.payload->>'invoice_id'=$INV8")" "sv EUR -3"
chk "opłacona (SCX/FV/39/1, ten sam termin) → brak przypomnień"      "$(Q "select count(*) $NPR and n.payload->>'invoice_id'=(select id::text from invoices where invoice_number='SCX/FV/39/1')")" 0
chk "ponowne uruchomienie tego dnia — bez duplikatów"                "$(Q "select send_payment_reminders('2026-10-27')")" 0
chk "dzień spoza kadencji (28.10) — nic"                             "$(Q "select count(*) from (select send_payment_reminders('2026-10-28')) x; select count(*) $NPR and (n.payload->>'offset')::int=-2")" 0
val "HHL oznacza SCX/FV/39/8 „Opłacona”"                             $HHL "select mark_invoice_paid((select id from invoices where invoice_number='SCX/FV/39/8'), '2026-10-28'); select payment_status from invoices where invoice_number='SCX/FV/39/8'" OPLACONA commit
chk "opłacona → niewysłane e-maile przypomnień anulowane"            "$(Q "select string_agg(distinct n.status, ',') $NPR and n.channel='EMAIL' and n.payload->>'invoice_id'=$INV8")" CANCELLED
chk "opłacona → w dniu terminu (30.10) przypomnienie nie wychodzi"   "$(Q "select count(*) from (select send_payment_reminders('2026-10-30')) x; select count(*) $NPR and n.payload->>'invoice_id'=$INV8 and (n.payload->>'offset')::int=0")" 0
chk "przychodowa +1 dzień (26.10 dla terminu 25.10): KSH płatnik, HHL wierzyciel, SCX nic" "$(Q "select count(*) from (select send_payment_reminders('2026-10-26')) x; select string_agg(distinct u.email||':'||(n.payload->>'party'), ',' order by u.email||':'||(n.payload->>'party')) $NPR and n.payload->>'invoice_id'=(select id::text from invoices where invoice_number='HHL/FV/39/1')")" "hhl@test:PAYEE,ksh@test:PAYER"
chk "refresh w obie strony: po terminie → PO_TERMINIE"                "$(Q "select payment_status from invoices where invoice_number='HHL/FV/39/1'")" PO_TERMINIE
err "użytkownik nie uruchomi przypomnień (zadanie systemowe)"         $HHL "select send_payment_reminders('2027-01-01')" "permission denied"
val "KSH oznacza przeczytane własne powiadomienia (IN_APP)"           $KSH "select mark_notifications_read(array(select id from notifications where template='PAYMENT_REMINDER')) = (select count(*) from notifications where template='PAYMENT_REMINDER' and channel='IN_APP')::int" t
val "KSH nie oznaczy cudzych (HHL) powiadomień"                        $KSH "select mark_notifications_read(array(select id from notifications where user_id=(select id from app_users where email='hhl@test')))" 0

echo; echo "[M9] Aplikacja kierowcy: report_position (przewoźnik/HHL), process_position zamknięty, MILESTONE_LOADED, strefy"
L9=33333333-0000-0000-0000-000000000009
sys "insert into loads (id, project_id, carrier_org_id, order_no, hhl_order_no, carrier_order_no, status, plan_load_date) values ('$L9','$P','$CAR','KSH/9','HHL/9','SCX/9','READY', current_date - 1)"
sys "insert into geofences (project_id, name, kind, geom, hysteresis_m, dwell_seconds, debounce_fixes, country) values ('$P','KSH Śrem · Grunwaldzka 27C','LOADING',make_circle_fence(52.07391,17.02460,600),150,0,2,'PL')"
NOW="now() - interval '1 minute'"
err "anon nie wywoła process_position (usterka: domyślne EXECUTE)"   $KSH "set local role anon; select * from process_position('$L9',52.07391,17.0246,now())" "permission denied"
err "zalogowany nie wywoła process_position wprost"                    $SCX "select * from process_position('$L9',52.07391,17.0246,now())" "permission denied"
err "anon nie wywoła report_position"                                  $KSH "set local role anon; select * from report_position('$L9',52.07391,17.0246,now())" "permission denied"
err "KSH nie zgłosi pozycji transportu"                                $KSH "select * from report_position('$L9',52.07391,17.0246,now())" "wyłącznie jego przewoźnik"
err "czas pozycji z przyszłości odrzucony"                             $SCX "select * from report_position('$L9',52.07391,17.0246,now() + interval '1 hour')" "z przyszłości"
val "słaby fix (dokładność 400 m) nie zapisuje pozycji ani stref"      $SCX "select count(*) from report_position('$L9',52.07391,17.0246,$NOW,400); select count(*) from positions where load_id='$L9'" 0
val "SCX: dwa fixy w strefie załadunku → AT_LOADING (źródło DRIVER_PWA)" $SCX "select count(*) from report_position('$L9',52.07391,17.0246,now() - interval '2 minutes',15); select count(*) from report_position('$L9',52.07395,17.0247,$NOW,15); select status||' '||(select string_agg(distinct source::text, ',') from positions where load_id='$L9') from loads where id='$L9'" "AT_LOADING DRIVER_PWA" commit
err "KSH nie zapisze MILESTONE_LOADED (warunek wyjazdu z załadunku)"   $KSH "insert into load_events (load_id, event_type, occurred_at) values ('$L9','MILESTONE_LOADED',now())" "row-level security"
val "SCX (przewoźnik transportu) zapisuje MILESTONE_LOADED"            $SCX "insert into load_events (load_id, event_type, occurred_at, source) values ('$L9','MILESTONE_LOADED',now(),'DRIVER_PWA'); select count(*) from load_events where load_id='$L9' and event_type='MILESTONE_LOADED'" 1 commit
# A5: bezpośredni UPDATE statusu → load_status_set; UNLOADED mapuje na DELIVERED (E25)
err "„Rozładowany” bezpośrednim UPDATE odrzucony (A5)"               $SCX "update loads set status='UNLOADED' where id='$L9'" "load_status_set|wymaga daty rozładunku"
val "„Rozładowany” przez load_status_set → DELIVERED"                 $SCX "select load_status_set('$L9','UNLOADED',now(),null); select status from loads where id='$L9'" DELIVERED
sys "insert into geofences (project_id, name, kind, geom, country) values ('$P','Terminal Nynäshamn','PORT_IN',make_circle_fence(58.9350,17.9500,800),'SE')"
if [ -n "${TOWER_HOSTED_READY:-}" ]; then
  # Hosted: shim no-opuje ponowne -f migracji; stosujemy ten sam UPDATE co 0017.
  $PSQL -c "update geofences set geom = make_circle_fence(58.90453, 17.95621, 800)
    where name = 'Terminal Nynäshamn'
      and st_dwithin(st_centroid(geom)::geography, st_setsrid(st_makepoint(17.9500, 58.9350), 4326)::geography, 30)" >/dev/null
else
  psql "$URL" -q -v ON_ERROR_STOP=1 -f supabase/migrations/0017_driver_positions.sql >/dev/null 2>&1 && psql "$URL" -q -v ON_ERROR_STOP=1 -f supabase/migrations/0017_driver_positions.sql >/dev/null 2>&1
fi
chk "0017 ponownie (2×): terminal Nynäshamn przesunięty na zweryfikowane współrzędne" "$(Q "select round(st_y(st_centroid(geom))::numeric,3)||' '||round(st_x(st_centroid(geom))::numeric,3) from geofences where name='Terminal Nynäshamn' and project_id='$P'")" "58.905 17.956"

echo; echo "[M12] Integracje: ryzyka z funkcji Edge, pozycje dla TomTom, pierwszeństwo źródeł rejsu"
sys "insert into vessels (name, operator) values ('M/F Test M12','test') on conflict (name) do nothing"
V12=$(Q "select id from vessels where name='M/F Test M12'")
sys "insert into sailings (project_id, vessel_id, route, departure_at, arrival_at, source) values ('$P','$V12','GDN-NYN','2026-10-01 16:00+00','2026-10-02 10:00+00','POLFERRIES')"
S12=$(Q "select id from sailings where vessel_id='$V12'")
err "zalogowany nie wywoła raise_integration_risk (tylko service_role)"  $HHL "select raise_integration_risk('$P',null,'FERRY','HIGH','x','{}','T12:1')" "permission denied"
err "anon nie wywoła latest_vehicle_positions"                          $KSH "set local role anon; select * from latest_vehicle_positions(30)" "permission denied"
err "zalogowany nie wywoła latest_vehicle_positions"                    $SCX "select * from latest_vehicle_positions(30)" "permission denied"
chk "system: ryzyko projektowe (bez transportu) zapisane"               "$(Q "select raise_integration_risk('$P',null,'FERRY','HIGH','Źródło niedostępne','{}','SOURCE_DOWN:T12:2026-09-26')")" t
chk "system: ten sam klucz → bez duplikatu (false)"                     "$(Q "select raise_integration_risk('$P',null,'FERRY','HIGH','Źródło niedostępne','{}','SOURCE_DOWN:T12:2026-09-26')")" f
chk "system: ryzyko transportu bierze projekt z transportu"             "$(Q "select raise_integration_risk(null,'$L1','ROAD_PL','MEDIUM','ruch','{}','TRAFFIC_FLOW:T12'); select (project_id='$P')::text||' '||kind from risk_signals where dedup_key='TRAFFIC_FLOW:T12'")" "true ROAD_PL"
chk "system (bez sesji): zapis rejsu zostaje POLFERRIES"                "$(Q "update sailings set status='OPOZNIONY' where id='$S12'; select source from sailings where id='$S12'")" POLFERRIES
val "HHL: zmiana rejsu w aplikacji → źródło RECZNIE (baza)"             $HHL "update sailings set status='ODWOLANY', source='POLFERRIES' where id='$S12'; select source||' '||status from sailings where id='$S12'" "RECZNIE ODWOLANY" commit
chk "HHL: autor zmiany rejsu zapisany przez serwer"                     "$(Q "select (updated_by = (select id from app_users where auth_id='$HHL'))::text from sailings where id='$S12'")" true
val "HHL: nowy rejs zawsze RECZNIE, nawet gdy podano inne źródło"      $HHL "insert into sailings (project_id, vessel_id, route, departure_at, arrival_at, source) values ('$P','$V12','GDN-NYN','2026-10-03 16:00+00','2026-10-04 10:00+00','POLFERRIES'); select source from sailings where vessel_id='$V12' and departure_at='2026-10-03 16:00+00'" RECZNIE
sys "insert into integration_runs (job, ok, result) values ('ferry-status', true, '{}')"
val "HHL widzi dziennik przebiegów integracji"                          $HHL "select count(*) from integration_runs" 1
val "KSH nie widzi dziennika (0 wierszy)"                               $KSH "select count(*) from integration_runs" 0
err "zalogowany nie zapisze dziennika"                                  $HHL "insert into integration_runs (job, ok) values ('x', true)" "row-level security"
psql "$URL" -q -v ON_ERROR_STOP=1 -f supabase/migrations/0018_integrations.sql >/dev/null 2>&1 && psql "$URL" -q -v ON_ERROR_STOP=1 -f supabase/migrations/0018_integrations.sql >/dev/null 2>&1
chk "0018 ponownie (2×): bez błędu, dziennik zachowany"                 "$(Q "select count(*) from integration_runs")" 1

#@@NEXT@@

echo; echo "[U-3-PALIWO] tydzień opłaty od daty załadunku (D-34), nie od rozładunku"
LF=33333333-0000-0000-0000-0000000000f1
LW=33333333-0000-0000-0000-0000000000f2
CAR=00000000-0000-0000-0000-00000000a003
sys "begin; set local request.jwt.claim.sub='$HHL'; set local role authenticated;
  select sefs_save_parameters('$P', jsonb_build_object(
    'valid_from','2026-09-28',
    'base_sek',19.47,'base_pln',5.698,
    'index_sek','OKQ8_TEST','index_pln','ORLEN_TEST',
    'source_url_sek','https://www.okq8.se/foretag/priser/',
    'source_url_pln','https://www.orlen.pl/pl/dla-biznesu/hurtowe-ceny-paliw',
    'cycle','WEEKLY',
    'tiers_sek', jsonb_build_array(
      jsonb_build_object('lte',19.47,'mult',1.00),
      jsonb_build_object('lte',23.0,'mult',1.13),
      jsonb_build_object('lte',23.1,'mult',1.14),
      jsonb_build_object('lte',30.0,'mult',1.20)
    ),
    'tiers_pln', jsonb_build_array(
      jsonb_build_object('lte',5.698,'mult',1.00),
      jsonb_build_object('lte',7.40,'mult',1.16),
      jsonb_build_object('lte',7.50,'mult',1.17),
      jsonb_build_object('lte',10.0,'mult',1.30)
    ),
    'note','U-3 test progi, nie cennik'
  )); commit"
# Poprzedni tydzień załadunku 2026-10-05 (pon) = 28.09–04.10. Poprzedni tydzień rozładunku 13.10 = 05.10–11.10.
sys "insert into fuel_index_readings (project_id, index_code, period, reading_date, value, source_url, source_note)
  select '$P', 'SEK', to_char(d,'YYYY-MM-DD'), d, 23.05, 'https://www.okq8.se/foretag/priser/', 'U-3 test'
    from generate_series('2026-09-28'::date, '2026-10-04'::date, '1 day') d"
sys "insert into fuel_index_readings (project_id, index_code, period, reading_date, value, source_url, source_note)
  select '$P', 'PLN', to_char(d,'YYYY-MM-DD'), d, 7.41, 'https://www.orlen.pl/pl/dla-biznesu/hurtowe-ceny-paliw', 'U-3 test'
    from generate_series('2026-09-28'::date, '2026-10-04'::date, '1 day') d"
sys "insert into fuel_index_readings (project_id, index_code, period, reading_date, value, source_url, source_note)
  select '$P', 'SEK', to_char(d,'YYYY-MM-DD'), d, 19.00, 'https://www.okq8.se/foretag/priser/', 'U-3 test N+1'
    from generate_series('2026-10-05'::date, '2026-10-11'::date, '1 day') d"
sys "insert into fuel_index_readings (project_id, index_code, period, reading_date, value, source_url, source_note)
  select '$P', 'PLN', to_char(d,'YYYY-MM-DD'), d, 5.50, 'https://www.orlen.pl/pl/dla-biznesu/hurtowe-ceny-paliw', 'U-3 test N+1'
    from generate_series('2026-10-05'::date, '2026-10-11'::date, '1 day') d"
sys "insert into loads (id, project_id, carrier_org_id, order_no, plan_load_date) values ('$LF','$P','$CAR','KSH/PAL', date '2026-10-04')"
sys "insert into load_cost (load_id, base_amount, computed_total_eur) values ('$LF', 1000, 1000); insert into load_revenue (load_id, base_amount, computed_total_eur) values ('$LF', 1300, 1300)"
# 04.10 22:30Z = 05.10 00:30 czasu Warszawy (lato). Plan 04.10 nie wygrywa.
sys "update loads set actual_load_at='2026-10-04T22:30:00Z', actual_delivery_at='2026-10-13T08:00:00Z' where id='$LF'"
val "załadunek 22:30Z to poniedziałek lokalnie, nie data planu" $HHL "select fuel_ref_date::text from v_load_financials_hhl where load_id='$LF'" "2026-10-05"
val "stawka z tygodnia załadunku N, nie z tygodnia rozładunku N+1; obie strony" $HHL "select (
  (sefs_week_for_load('$P','2026-10-05')->>'ok') = 'true'
  and (sefs_week_for_load('$P','2026-10-13')->>'ok') = 'true'
  and fuel_ref_date = date '2026-10-05'
  and cost_fuel_mult = rev_fuel_mult
  and cost_fuel_mult = (sefs_week_for_load('$P','2026-10-05')->>'applied_mult')::numeric
  and cost_fuel_mult <> (sefs_week_for_load('$P','2026-10-13','2026-10-12')->>'applied_mult')::numeric
)::text from v_load_financials_hhl where load_id='$LF'" true
sys "insert into loads (id, project_id, carrier_org_id, order_no, plan_load_date) values ('$LW','$P','$CAR','KSH/ZIMA', date '2026-11-29')"
sys "insert into load_cost (load_id, base_amount, computed_total_eur) values ('$LW', 1000, 1000); insert into load_revenue (load_id, base_amount, computed_total_eur) values ('$LW', 1300, 1300)"
sys "update loads set actual_load_at='2026-11-29T23:30:00Z', actual_delivery_at='2026-12-07T10:00:00Z' where id='$LW'"
# 0189: tydzień niezamknięty → PROGNOZA (ostatni OSTATECZNY), nie częściowa średnia
val "zima: 29.11 23:30Z = 30.11 lokalnie; tydzień niezamknięty → mnożnik PROGNOZA" $HHL "select v.fuel_ref_date::text||' '||c.fuel_status from v_load_financials_hhl v join v_load_price_carrier c using (load_id) where load_id='$LW'" "2026-11-30 PROGNOZA"

echo
echo "WYNIK: $ok OK, $fail FAIL"
