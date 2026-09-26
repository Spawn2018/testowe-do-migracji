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

#@@NEXT@@

echo
echo "WYNIK: $ok OK, $fail FAIL"
