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

#@@NEXT@@

echo
echo "WYNIK: $ok OK, $fail FAIL"
