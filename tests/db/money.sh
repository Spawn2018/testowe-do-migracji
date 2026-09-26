#!/usr/bin/env bash
# TOWER — test pieniędzy (Etap 4: M2+): widoki finansowe v2, Z1, kurs, faktury, terminy.
# Własna, czysta baza: atrapa Supabase → migracje → seed testowy.
# Użycie: PGADMIN=postgres://postgres@localhost:5433/postgres bash tests/db/money.sh
# UWAGA: supabase_stub.sql NIGDY nie uruchamiaj na Supabase.
set -e
ADMIN=${PGADMIN:-postgres://postgres@localhost:5433/postgres}
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
err "KSH nadal nie odczyta tabeli kosztów"          $KSH "select * from load_cost" "permission denied"
err "anon nie odczyta widoku"                       $KSH "set local role anon; select * from v_load_price_client" "permission denied"
sys "update app_users set role='CARRIER_USER' where auth_id='$SCX'"
val "SCX bez roli dyspozytora (CARRIER_USER) nie widzi kosztu"        $SCX "select count(*) from v_load_price_carrier" 0
sys "update app_users set role='CARRIER_DISPATCH' where auth_id='$SCX'"

echo; echo "[M2] Z1 — faktura nie nadpisuje wyliczonej wartości"
sys "update load_cost set invoiced_total_eur=2100 where load_id='$L1'"
val "po fakturze: obie wartości zachowane"         $HHL "select cost_computed_eur||'/'||cost_invoiced_eur||'/'||cost_effective_eur from v_load_financials_hhl where load_id='$L1'" "2000.00/2100.00/2100.00"
val "po fakturze: marża z fakturowanej"            $HHL "select margin_eur from v_load_financials_hhl where load_id='$L1'" 400.00
val "po fakturze: poziom strony = FAKTURA"         $HHL "select cost_tier from v_load_financials_hhl where load_id='$L1'" FAKTURA
out=$($PSQL -c "update load_cost set computed_total_eur=2100 where load_id='$L1'" 2>&1)
if echo "$out" | grep -q "Z1"; then ok=$((ok+1)); echo "  OK    wyliczenie po zafakturowaniu niezmienne (wyzwalacz Z1)"; else fail=$((fail+1)); echo "  FAIL  Z1 → $out"; fi


echo; echo "[M3] Kurs NBP: fx_rates, reguła W3, migawka przy rozładunku"
FIX=$(python3 -c "import json;print(json.dumps(json.load(open('tests/fixtures/nbp-eur-2025-12.json'))))")
val "parser zapisuje tabele z odpowiedzi API (przedział)" $HHL "set local role postgres; select fx_ingest_nbp('$FIX'::jsonb, 'fixture') > 5" t commit
val "29.12.2025 → 248/A z 23.12 (5 dni bez tabel)"   $KSH "select table_no||' '||rate_date from fx_rate_before('2025-12-29')" "248/A/NBP/2025 2025-12-23"
val "2.01.2026 → tabela z 31.12 (dzień roboczy przed)" $KSH "select rate_date from fx_rate_before('2026-01-02')" "2025-12-31"
err "brak tabeli w przedziale → błąd, nie zgadywanie" $KSH "select * from fx_rate_before('2025-11-01')" "Brak tabeli A NBP"
val "zalogowany odczyta fx_rates (dane publiczne)"   $SCX "select count(*) > 0 from fx_rates" t
err "SCX nie zapisze kursu"                          $SCX "insert into fx_rates (currency, rate_date, rate_pln) values ('EUR','2025-12-27',9.99)" "permission denied"
err "SCX nie wywoła parsera"                         $SCX "select fx_ingest_nbp('{}'::jsonb)" "permission denied"
err "KSH nie wywoła pobierania"                      $KSH "select fx_sync_nbp()" "permission denied"
sys "insert into load_cost (load_id, base_amount, computed_total_eur) values ('$L2', 1000, 1000); insert into load_revenue (load_id, base_amount, computed_total_eur) values ('$L2', 1300, 1300)"
sys "update loads set actual_delivery_at='2025-12-29T23:30:00Z' where id='$L2'"
val "migawka: pułapka UTC — 29.12 23:30Z = 30.12 lokalnie → 249/A z 29.12" $HHL "select cost_fx_table_no||' '||cost_fx_date||' '||fuel_ref_date from v_load_financials_hhl where load_id='$L2'" "249/A/NBP/2025 2025-12-29 2025-12-30"
val "migawka po obu stronach ta sama, poziom REALIZACJA" $HHL "select (cost_fx_table_no = rev_fx_table_no and pricing_tier='REALIZACJA' and not cost_fx_provisional)::text from v_load_financials_hhl where load_id='$L2'" true
sys "update loads set plan_delivery_from='2026-01-15T08:00:00Z', plan_delivery_to='2026-01-15T16:00:00Z' where id='$L2'"
sys "insert into fx_rates (currency, rate_date, rate_pln, table_no) values ('EUR','2025-12-30',9.9999,'999/A/TEST') on conflict do nothing"
val "migawka niezmienna po zmianie planu i nowych tabelach" $HHL "select cost_fx_table_no||' '||cost_fx_mid from v_load_financials_hhl where load_id='$L2'" "249/A/NBP/2025 4.227400"
sys "delete from fx_rates where table_no='999/A/TEST'"
sys "update loads set actual_delivery_at='2026-03-10T10:00:00Z' where id='$L2'"
val "brak tabeli przed rozładunkiem → migawka prowizoryczna (nie zgadywana)" $HHL "select cost_fx_provisional::text||' '||fuel_ref_date from v_load_financials_hhl where load_id='$L2'" "true 2026-03-10"
sys "insert into fx_rates (currency, rate_date, rate_pln, table_no) values ('EUR','2026-03-09',4.3000,'047/A/NBP/2026')"
val "fx_apply_pending uzupełnia migawkę po pobraniu tabeli" $HHL "set local role postgres; select fx_apply_pending()" 1 commit
val "po uzupełnieniu: tabela z dnia roboczego przed rozładunkiem" $HHL "select cost_fx_table_no||' '||cost_fx_provisional from v_load_financials_hhl where load_id='$L2'" "047/A/NBP/2026 false"

echo; echo "[M5] Numery zleceń: wymuszenie z bazy, każda strona swój, brak przed terminem → ryzyko + przypomnienie"
L3=33333333-0000-0000-0000-000000000003; L4=33333333-0000-0000-0000-000000000004
err "GOTOWY bez numeru HHL → zrozumiały komunikat bazy"    $HHL "update loads set status='READY' where id='$L1'" "bez numeru zlecenia HHL"
val "HHL wpisuje swój numer"                               $HHL "update loads set hhl_order_no='HHL/T/1' where id='$L1' returning hhl_order_no" "HHL/T/1"
err "HHL nie zmieni numeru przewoźnika (W12)"              $HHL "update loads set carrier_order_no='X' where id='$L1'" "wpisuje wy..cznie przewo"
err "przewoźnik nie zmieni numeru HHL"                     $SCX "update loads set hhl_order_no='X' where id='$L1'" "nie mo.e zmienia.: hhl_order_no"
err "przewoźnik nie zmieni numeru KSH"                     $SCX "update loads set order_no='X' where id='$L1'" "nie mo.e zmienia.: order_no"
val "przewoźnik wpisuje swój numer"                        $SCX "update loads set carrier_order_no='SCX/T/1' where id='$L1' returning carrier_order_no" "SCX/T/1"
err "przewoźnik nie zmieni okna planowego (AN2)"           $SCX "update loads set plan_load_from=now() where id='$L1'" "plan_load_from"
err "załadunek bez numeru przewoźnika → błąd"              $HHL "update loads set hhl_order_no='HHL/T/2', status='AT_LOADING' where id='$L2'" "bez numeru zlecenia przewo"
sys "insert into loads (id, project_id, carrier_org_id, order_no, plan_load_date) values ('$L3','$P','00000000-0000-0000-0000-00000000a003','KSH/3', current_date + 1), ('$L4','$P','00000000-0000-0000-0000-00000000a003','KSH/4', current_date + 5)"
err "wykrywanie: zwykły użytkownik nie wywoła"             $HHL "select detect_missing_order_numbers()" "permission denied"
val "wykrywanie: 2 ryzyka (HHL + przewoźnik) tylko dla terminu < 48 h" $HHL "set local role postgres; select detect_missing_order_numbers()" 2 commit
val "ponowne wykrywanie nie dubluje"                       $HHL "set local role postgres; select detect_missing_order_numbers()" 0 commit
val "ryzyka w kolejce (L3: HHL + przewoźnik)"              $HHL "select string_agg(detail->>'side', ',' order by detail->>'side') from risk_signals where load_id='$L3' and resolved_at is null" "CARRIER,HHL"
val "L4 (termin za 5 dni) bez ryzyka"                      $HHL "select count(*) from risk_signals where load_id='$L4'" 0
val "przypomnienie dla HHL: tylko HHL-owe"                 $HHL "select string_agg(payload->>'side', ',') from notifications where template='ORDER_NO_MISSING'" "HHL"
val "przypomnienie dla przewoźnika: tylko przewoźnika"     $SCX "select string_agg(payload->>'side', ',') from notifications where template='ORDER_NO_MISSING'" "CARRIER"
val "KSH nie dostaje przypomnień o numerach"               $KSH "select count(*) from notifications" 0
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

echo; echo "[M6] Faktury — model trzech stron: rejestracja z PDF, kontrole w bazie, dwa statusy, Z1, Z4, Q13"
L5=33333333-0000-0000-0000-000000000005; L6=33333333-0000-0000-0000-000000000006; L7=33333333-0000-0000-0000-000000000007
CAR=00000000-0000-0000-0000-00000000a003
sys "insert into loads (id, project_id, carrier_org_id, order_no, hhl_order_no, carrier_order_no) values ('$L5','$P','$CAR','KSH/5','HHL/5','SCX/5'), ('$L6','$P','$CAR','KSH/6','HHL/6','SCX/6'), ('$L7','$P','$CAR','KSH/7','HHL/7','SCX/7')"
sys "insert into fx_rates (currency, rate_date, rate_pln, table_no) values ('EUR','2026-09-21',4.2500,'183/A/NBP/2026') on conflict do nothing"
sys "insert into load_cost (load_id, base_amount, computed_total_eur) values ('$L5',1000,1000),('$L6',800,800),('$L7',500,500); insert into load_revenue (load_id, base_amount, computed_total_eur) values ('$L5',1300,1300),('$L6',1100,1100),('$L7',700,700)"
sys "update loads set actual_delivery_at='2026-09-22T10:00:00Z' where id in ('$L5','$L6')"
DOC="(select id from create_document(null,'INVOICE','f.pdf','application/pdf',100,'$P'))"
REGK="select register_invoice(jsonb_build_object('direction','KOSZT','invoice_number','SCX/FV/39/1','issue_date','2026-09-25','week_key','2026-W39','currency','EUR','net_total',1500,'vat_total',0,'gross_total',1500,'document_id',$DOC,'lines',jsonb_build_array(jsonb_build_object('load_id','$L5','invoiced_net',1000),jsonb_build_object('load_id','$L7','invoiced_net',500)))) is not null"
val "SCX rejestruje fakturę kosztową EUR z PDF"                 $SCX "$REGK" t commit
val "kontrole pozycji w bazie: L5 bez flag, L7 NIEZREALIZOWANY"   $HHL "select string_agg(coalesce(array_to_string(flags,'+'),'')||'', ',' order by load_id) from invoice_lines where direction='KOSZT' and load_id in ('$L5','$L7')" ",NIEZREALIZOWANY"
val "nagłówek: BRAK_NA_FAKTURZE (L6 z tygodnia pominięty)"      $HHL "select array_to_string(check_flags,',')||' '||('$L6'=any(missing_load_ids))::text from invoices where invoice_number='SCX/FV/39/1'" "BRAK_NA_FAKTURZE true"
val "termin KOSZT: wystawienie + 35 dni"                          $HHL "select due_date from invoices where invoice_number='SCX/FV/39/1'" 2026-10-30
val "Z1: kwota z faktury obok wyliczenia; poziom = mniej pewna strona" $HHL "select cost_invoiced_eur||' '||cost_computed_eur||' '||pricing_tier from v_load_financials_hhl where load_id='$L5'" "1000.00 1000.00 REALIZACJA"
val "KSH nie widzi faktury kosztowej"                             $KSH "select count(*) from invoices where invoice_number='SCX/FV/39/1'" 0
err "podwójne fakturowanie zablokowane w bazie"                   $SCX "select register_invoice(jsonb_build_object('direction','KOSZT','invoice_number','SCX/FV/39/2','issue_date','2026-09-25','week_key','2026-W39','currency','EUR','net_total',1,'vat_total',0,'gross_total',1,'document_id',$DOC,'lines',jsonb_build_array(jsonb_build_object('load_id','$L5','invoiced_net',1000))))" "podw.jne fakturowanie"
err "SCX nie zarejestruje faktury przychodowej"                   $SCX "select register_invoice(jsonb_build_object('direction','PRZYCHOD','invoice_number','X','issue_date','2026-09-25','week_key','2026-W39','currency','EUR','net_total',1,'vat_total',0,'gross_total',1,'document_id',$DOC,'lines',jsonb_build_array(jsonb_build_object('load_id','$L5','invoiced_net',1))))" "rejestruje HHL"
err "bez PDF — odrzucone"                                         $SCX "select register_invoice(jsonb_build_object('direction','KOSZT','invoice_number','X2','issue_date','2026-09-25','week_key','2026-W39','currency','EUR','net_total',1,'vat_total',0,'gross_total',1,'lines',jsonb_build_array(jsonb_build_object('load_id','$L6','invoiced_net',1))))" "PDF faktury jest wymagany"
err "bez VAT z dokumentu — odrzucone (system nie liczy VAT)"      $SCX "select register_invoice(jsonb_build_object('direction','KOSZT','invoice_number','X3','issue_date','2026-09-25','week_key','2026-W39','currency','EUR','net_total',1,'gross_total',1,'document_id',$DOC,'lines',jsonb_build_array(jsonb_build_object('load_id','$L6','invoiced_net',1))))" "nie liczy VAT"
REGP="select register_invoice(jsonb_build_object('direction','PRZYCHOD','invoice_number','HHL/FV/39/1','issue_date','2026-09-25','week_key','2026-W39','currency','PLN','net_total',10200,'vat_total',0,'gross_total',10200,'document_id',$DOC,'lines',jsonb_build_array(jsonb_build_object('load_id','$L5','invoiced_net',5525.00,'fx_table_no','183/A/NBP/2026','fx_mid',4.25,'fx_effective_date','2026-09-21'),jsonb_build_object('load_id','$L6','invoiced_net',4700,'fx_table_no','999/A/X','fx_mid',4.30,'fx_effective_date','2026-09-21')))) is not null"
val "HHL rejestruje fakturę przychodową PLN z kursem per pozycja" $HHL "$REGP" t commit
val "kurs podpowiadany z reguły W3 zgodny → bez flag; zły kurs → TABELA+KURS+KWOTA" $HHL "select string_agg(array_to_string(flags,'+'), ',' order by load_id) from invoice_lines where direction='PRZYCHOD' and load_id in ('$L5','$L6')" ",TABELA_NBP+KURS_NBP+KWOTA"
val "termin PRZYCHOD: wystawienie + 30 dni"                       $HHL "select due_date from invoices where invoice_number='HHL/FV/39/1'" 2026-10-25
val "Z1 po stronie przychodu: 5525 PLN / 4,25 = 1300 EUR"         $HHL "select rev_invoiced_eur from v_load_financials_hhl where load_id='$L5'" 1300.00
val "KSH widzi fakturę HHL, SCX nie"                              $KSH "select count(*) from invoices where invoice_number='HHL/FV/39/1'" 1
val "SCX nie widzi faktury przychodowej"                          $SCX "select count(*) from invoices where invoice_number='HHL/FV/39/1'" 0
val "Q13: KSH dostał powiadomienie o nowej fakturze HHL"          $KSH "select count(*) from notifications where template='INVOICE_NEW'" 1
val "KSH w module faktur: PDF + CMR/POD, nic więcej"              $KSH "select string_agg(distinct role, ',') from invoice_documents x join invoices i on i.id=x.invoice_id where i.invoice_number='HHL/FV/39/1'" FAKTURA_PDF
err "KSH: SPORNA bez uzasadnienia — odrzucone"                    $KSH "update invoices set verification_status='SPORNA' where invoice_number='HHL/FV/39/1'" "wymaga uzasadnienia"
val "KSH: SPORNA z uzasadnieniem"                                 $KSH "update invoices set verification_status='SPORNA', dispute_note='kurs pozycji 2' where invoice_number='HHL/FV/39/1' returning verification_status" SPORNA
err "KSH nie zmieni treści faktury"                               $KSH "update invoices set net_total=1 where invoice_number='HHL/FV/39/1'" "nie zmienia|weryfikowa"
err "HHL (wystawca) nie zmieni statusu sporu KSH (Q14)"           $HHL "update invoices set verification_status='ZGODNA' where invoice_number='HHL/FV/39/1'" "Wystawca nie weryfikuje"
err "SCX nie weryfikuje własnej faktury"                          $SCX "update invoices set verification_status='ZGODNA' where invoice_number='SCX/FV/39/1'" "Wystawca nie weryfikuje"
val "HHL weryfikuje fakturę SCX: ZGODNA"                          $HHL "update invoices set verification_status='ZGODNA' where invoice_number='SCX/FV/39/1' returning verification_status" ZGODNA
err "SCX nie oznaczy „Opłacona”"                                  $SCX "select mark_invoice_paid((select id from invoices where invoice_number='SCX/FV/39/1'), '2026-10-01')" "wy..cznie HHL|wyłącznie HHL"
val "HHL oznacza „Opłacona” z datą (dziennik audytu)"             $HHL "select mark_invoice_paid((select id from invoices where invoice_number='SCX/FV/39/1'), '2026-10-01'); select payment_status||' '||paid_at from invoices where invoice_number='SCX/FV/39/1'" "OPLACONA 2026-10-01"
err "cofnięcie „Opłacona” bez powodu — odrzucone"                 $HHL "select unmark_invoice_paid((select id from invoices where invoice_number='SCX/FV/39/1'), '')" "Wymagany pow"
err "Z4: przewoźnik nie zmieni daty rozładunku zafakturowanego"   $SCX "update loads set actual_delivery_at='2026-09-23T10:00:00Z' where id='$L5'" "zamro"
L8=33333333-0000-0000-0000-000000000008
sys "insert into loads (id, project_id, carrier_org_id, order_no, hhl_order_no, carrier_order_no) values ('$L8','$P','$CAR','KSH/8','HHL/8','SCX/8')"
val "0015: pierwsza pozycja bez migawki i bez rozładunku (reguła nieustalona) — rejestracja działa, flaga NIEZREALIZOWANY" $SCX "select register_invoice(jsonb_build_object('direction','KOSZT','invoice_number','SCX/FV/39/8','issue_date','2026-09-25','week_key','2026-W39','currency','EUR','net_total',10,'vat_total',0,'gross_total',10,'document_id',$DOC,'lines',jsonb_build_array(jsonb_build_object('load_id','$L8','invoiced_net',10)))) is not null; select array_to_string(flags,'+') from invoice_lines where load_id='$L8'" NIEZREALIZOWANY commit

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

#@@NEXT@@

echo
echo "WYNIK: $ok OK, $fail FAIL"
