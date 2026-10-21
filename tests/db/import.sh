#!/usr/bin/env bash
# TOWER — I-1 (0047): import harmonogramu w trybie produkcyjnym — import_schedule().
# Czysta baza: atrapa Supabase → migracje → tests/db/seed.sql → scenariusz.
# Użycie: PGADMIN=postgres://postgres@localhost:5433/postgres bash tests/db/import.sh
set -e
cd "$(git rev-parse --show-toplevel)"
ADMIN=${PGADMIN:-postgres://postgres@localhost:5433/postgres}
. "$(git rev-parse --show-toplevel)/tests/db/local-only.sh"
DB=tower_test_import; URL="${ADMIN%/*}/$DB"
psql "$ADMIN" -q -c "drop database if exists $DB" -c "create database $DB"
psql "$URL" -q -v ON_ERROR_STOP=1 -f tests/db/supabase_stub.sql
for f in supabase/migrations/*.sql; do psql "$URL" -q -v ON_ERROR_STOP=1 -f "$f" >/dev/null 2>&1 || { echo "MIGRACJA $f: błąd"; exit 1; }; done
psql "$URL" -q -v ON_ERROR_STOP=1 -f tests/db/seed.sql
set +e
PSQL="psql $URL -Atq"
HHL=11111111-0000-0000-0000-000000000001; KSH=11111111-0000-0000-0000-000000000002; SCX=11111111-0000-0000-0000-000000000003
P=22222222-0000-0000-0000-000000000001; L1=33333333-0000-0000-0000-000000000001
ok=0; fail=0
run() { local end="rollback"; [ "$3" = "commit" ] && end="commit"
  $PSQL -v ON_ERROR_STOP=1 -c "begin; set local role authenticated; set local request.jwt.claim.sub='$1'; $2; $end;" 2>&1; }
val() { out=$(run "$2" "$3" "$5" | grep -v -E '^(BEGIN|SET|ROLLBACK|COMMIT)$' | tail -1)
  if [ "$out" = "$4" ]; then ok=$((ok+1)); echo "  OK    $1"; else fail=$((fail+1)); echo "  FAIL  $1  (otrzymano: $out, oczekiwano: $4)"; fi; }
err() { out=$(run "$2" "$3"); if echo "$out" | grep -qiE "$4"; then ok=$((ok+1)); echo "  OK    $1"; else fail=$((fail+1)); echo "  FAIL  $1  →  $(echo "$out" | tail -1)"; fi; }
Q() { $PSQL -c "$1" 2>&1 | tail -1; }
chk() { if [ "$2" = "$3" ]; then ok=$((ok+1)); echo "  OK    $1"; else fail=$((fail+1)); echo "  FAIL  $1  (otrzymano: $2, oczekiwano: $3)"; fi; }

# trzy wiersze harmonogramu; L1 z seed ma pozycję SG-00 (na fakturze), L2 bez pozycji
$PSQL -c "insert into shipment_items (project_id, load_id, shipment_code, length_m, width_m, height_m) values ('$P','$L1','SG-00',10,2.5,2.5)" >/dev/null
# #384 pkt 4: daty w przyszłości — inaczej import wycisza SCHEDULE_DATE_CRITICAL (bulk_quiet hist).
R3='[{"code":"SG-01","length_m":18.21,"width_m":2.45,"height_m":2.45,"qty":7,"total_weight_t":20.74,"load_date":"2026-11-10","delivery_date":"2026-11-15"},
     {"code":"SG-02","length_m":"18.21","width_m":2.45,"height_m":2.45,"qty":7,"total_weight_t":20.74,"load_date":"2026-11-10","delivery_date":"2026-11-15","order_no":"KSH/77"},
     {"code":"T-01","length_m":14.62,"width_m":2.45,"height_m":2.45,"qty":55,"total_weight_t":20.17,"load_date":"2026-11-10","delivery_date":"2026-11-15"}]'
IMP() { echo "select import_schedule('$P', '$1'::jsonb, ${3:-'{}'}::text[], '{\"name\":\"h.xlsx\",\"hash\":\"abc\",\"path\":\"harmonogramy/x/abc.xlsx\"}'::jsonb, $2)"; }

echo; echo "[I-1] uprawnienia"
err "KSH nie importuje"                    $KSH "$(IMP "$R3" false)" "wyłącznie HHL"
err "SCX nie importuje"                    $SCX "$(IMP "$R3" true)"  "wyłącznie HHL"
err "konto bez wiersza app_users (is_hhl() = NULL) nie importuje" 99999999-0000-0000-0000-000000000009 "$(IMP "$R3" true)" "wyłącznie HHL"
$PSQL -c "update app_users set active=false where auth_id='$HHL'" >/dev/null
err "HHL nieaktywny (is_hhl() = NULL) nie importuje" $HHL "$(IMP "$R3" true)" "wyłącznie HHL"
$PSQL -c "update app_users set active=true where auth_id='$HHL'" >/dev/null
chk "anon: brak EXECUTE import_schedule"   "$(Q "select has_function_privilege('anon','import_schedule(uuid,jsonb,text[],jsonb,boolean)','execute')")" f
chk "authenticated: brak EXECUTE schedule_row_canon" "$(Q "select has_function_privilege('authenticated','schedule_row_canon(jsonb)','execute')")" f
chk "funkcja SECURITY DEFINER z search_path" "$(Q "select prosecdef||':'||array_to_string(proconfig,',') from pg_proc where proname='import_schedule'")" "true:search_path=public"

echo; echo "[I-1] podgląd bez zapisu"
val "podgląd: 3 nowe, 0 zmian, kandydat SG-00 zablokowany (faktura)" $HHL "select (r->'added')::text is not null and jsonb_array_length(r->'added')=3 and jsonb_array_length(r->'changed')=0 and jsonb_array_length(r->'blocked')=1 and r->'blocked'->0->>'reason'='INVOICED' from ($(IMP "$R3" true)) s(r)" t
chk "podgląd nic nie zapisał" "$(Q "select count(*) from loads")/$(Q "select count(*) from schedule_imports")/$(Q "select count(*) from load_events")" "2/0/0"

echo; echo "[I-1] zapis"
val "import: 3 transporty, wersja 1" $HHL "select jsonb_array_length(r->'added')||'/'||(r->>'version') from ($(IMP "$R3" false)) s(r)" "3/1" commit
chk "loads +3 (PLANNED, przewoźnik SCX), pozycje 3 z wierszem kanonicznym" "$(Q "select count(*) filter (where status='PLANNED' and carrier_org_id='00000000-0000-0000-0000-00000000a003') from loads l join shipment_items si on si.load_id=l.id where si.shipment_code in ('SG-01','SG-02','T-01') and si.schedule_row is not null")" 3
chk "numer zlecenia KSH i daty planu" "$(Q "select l.order_no||' '||l.plan_load_date||' '||l.plan_delivery_date from loads l join shipment_items si on si.load_id=l.id where si.shipment_code='SG-02'")" "KSH/77 2026-11-10 2026-11-15"
chk "I-25: import nie ustawia okna dostawy ani załadunku (okno tylko od KSH)" "$(Q "select count(*) from loads l join shipment_items si on si.load_id=l.id where si.shipment_code in ('SG-01','SG-02','T-01') and (l.plan_delivery_from is not null or l.plan_delivery_to is not null or l.plan_load_from is not null or l.plan_load_to is not null)")" 0
chk "wersja w schedule_imports: plik, skrót, statystyki" "$(Q "select version||' '||file_name||' '||file_hash||' '||file_path||' '||(stats->>'added') from schedule_imports")" "1 h.xlsx abc harmonogramy/x/abc.xlsx 3"
chk "zdarzenia SCHEDULE_IMPORTED ×3" "$(Q "select count(*) from load_events where event_type='SCHEDULE_IMPORTED' and payload->>'action'='ADDED'")" 3
chk "KSH widzi nowe transporty (RLS)" "$(run $KSH "select count(*) from loads" | grep -E '^[0-9]+$')" 5
chk "SCX widzi nowe transporty (RLS)" "$(run $SCX "select count(*) from loads" | grep -E '^[0-9]+$')" 5

echo; echo "[I-1] idempotencja"
val "ten sam plik: 0 nowych, 0 zmian, 3 bez zmian, bez wersji" $HHL "select jsonb_array_length(r->'added')||'/'||jsonb_array_length(r->'changed')||'/'||(r->>'unchanged')||'/'||coalesce(r->>'version','-') from ($(IMP "$R3" false)) s(r)" "0/0/3/-" commit
chk "brak nowej wersji i zdarzeń" "$(Q "select count(*) from schedule_imports")/$(Q "select count(*) from load_events")" "1/3"

echo; echo "[I-1] zmiany, awizacja (3.7), anulowanie"
SG1=$(Q "select load_id from shipment_items where shipment_code='SG-01'"); T1=$(Q "select load_id from shipment_items where shipment_code='T-01'")
$PSQL -c "update loads set plan_load_from='2026-11-10 08:00+01', plan_load_to='2026-11-10 12:00+01' where id='$SG1'" >/dev/null
R2='[{"code":"SG-01","length_m":18.21,"width_m":2.45,"height_m":2.45,"qty":7,"total_weight_t":20.74,"load_date":"2026-11-11","delivery_date":"2026-11-16"},
     {"code":"SG-02","length_m":18.5,"width_m":2.45,"height_m":2.45,"qty":7,"total_weight_t":20.74,"load_date":"2026-11-10","delivery_date":"2026-11-15","order_no":"KSH/77"},
     {"code":"SG-03","length_m":12,"width_m":2.45,"height_m":2.45,"qty":1,"total_weight_t":10,"load_date":"2026-11-12","delivery_date":"2026-11-17"}]'
val "podgląd: +1 ~2, krytyczna SG-01, kandydat T-01" $HHL "select jsonb_array_length(r->'added')||'/'||jsonb_array_length(r->'changed')||'/'||(r->'critical'->0->>'code')||'/'||(r->'cancel_candidates'->0->>'code') from ($(IMP "$R2" true)) s(r)" "1/2/SG-01/T-01"
val "zapis bez zgody na anulowanie: T-01 zostaje" $HHL "select jsonb_array_length(r->'cancelled')||'/'||(r->>'version') from ($(IMP "$R2" false)) s(r)" "0/2" commit
chk "SG-01: nowe daty planu, okno awizacji nietknięte (ANEKS 2)" "$(Q "select plan_load_date||' '||plan_delivery_date||' '||(plan_load_from is not null) from loads where id='$SG1'")" "2026-11-11 2026-11-16 true"
chk "SG-02: długość 18.50 w pozycji" "$(Q "select length_m from shipment_items where shipment_code='SG-02'")" "18.50"
chk "SCHEDULE_DATE_CRITICAL dla SG-01" "$(Q "select count(*) from load_events where event_type='SCHEDULE_DATE_CRITICAL' and load_id='$SG1'")" 1
chk "powiadomienia w aplikacji: HHL + SCX" "$(Q "select count(*) from notifications where template='SCHEDULE_DATE_CRITICAL' and channel='IN_APP'")" 2
chk "I-10: e-mail HHL + SCX (bliźniak IN_APP, adres z app_users; 0133: konta właściciela = PENDING)" "$(Q "select count(*)||'/'||count(*) filter (where n.recipient = u.email::text and n.payload->>'code'='SG-01' and n.status = 'PENDING') from notifications n join app_users u on u.id=n.user_id where n.template='SCHEDULE_DATE_CRITICAL' and n.channel='EMAIL'")" "2/2"
chk "I-10: klucz dedup e-maila = EMAIL:<klucz IN_APP>" "$(Q "select count(*) from notifications e join notifications a on e.dedup_key = 'EMAIL:'||a.dedup_key where e.channel='EMAIL' and a.channel='IN_APP' and a.template='SCHEDULE_DATE_CRITICAL'")" 2
chk "T-01 nadal PLANNED" "$(Q "select status from loads where id='$T1'")" PLANNED
val "zapis ze zgodą na T-01: anulowany" $HHL "select r->'cancelled'->0->>'code' from ($(IMP "$R2" false "'{T-01}'")) s(r)" "T-01" commit
chk "T-01 CANCELLED (wiersz zostaje), audit + zdarzenie" "$(Q "select status from loads where id='$T1'")/$(Q "select count(*) from audit_log where action='LOAD_CANCEL_IMPORT'")/$(Q "select count(*) from load_events where event_type='STATUS_CANCELLED'")" "CANCELLED/1/1"
chk "SG-00 (na fakturze) nigdy nieanulowany" "$(Q "select status from loads where id='$L1'")" PLANNED
val "T-01 wraca w pliku → zablokowany (anulowany, tylko ręcznie HHL)" $HHL "select r->'blocked'->0->>'reason' from ($(IMP "$(echo "$R3" | sed 's/"total_weight_t":20.17/"total_weight_t":20.2/')" true)) s(r) " CANCELLED
chk "wersje 1,2,3" "$(Q "select string_agg(version::text, ',' order by version) from schedule_imports")" "1,2,3"
chk "load_events tylko dopisywane (UPDATE odrzucony)" "$($PSQL -c "update load_events set payload='{}'" 2>&1 | grep -c 'append-only')" 1

echo; echo "[I-1] walidacja wejścia (cała transakcja wycofana)"
err "duplikat kodu"          $HHL "$(IMP '[{"code":"X","length_m":1,"width_m":1,"height_m":1,"load_date":"2026-10-01"},{"code":"X","length_m":1,"width_m":1,"height_m":1}]' false)" "więcej niż raz"
err "wymiary niedodatnie"    $HHL "$(IMP '[{"code":"X","length_m":0,"width_m":1,"height_m":1}]' false)" "dodatnie"
err "data dostawy przed załadunkiem" $HHL "$(IMP '[{"code":"X","length_m":1,"width_m":1,"height_m":1,"load_date":"2026-10-05","delivery_date":"2026-10-01"}]' false)" "przed datą"
err "wymiar nieliczbowy"     $HHL "$(IMP '[{"code":"X","length_m":"Standard","width_m":1,"height_m":1}]' false)" "nieprawidłowa"
chk "po błędach: bez nowych transportów" "$(Q "select count(*) from shipment_items where shipment_code='X'")" 0
val "pusty plik: 0 kandydatów do anulowania" $HHL "select jsonb_array_length(r->'cancel_candidates') from ($(IMP '[]' true)) s(r)" 0

echo; echo "[B-8-IMP] TYP STANDARD pomijany (ładunek NTG, nie błąd)"
RS='[{"code":"T-03","cargo_class":"STANDARD","length_m":null,"width_m":null,"height_m":null,"qty":27,"total_weight_t":20.81,"load_date":"2026-10-02","delivery_date":"2026-10-07"}]'
val "STANDARD bez wymiarów: 0 nowych, skipped 1" $HHL "select jsonb_array_length(r->'added')||'/'||(r->>'skipped_standard') from ($(IMP "$RS" true)) s(r)" "0/1"
chk "T-03 nie został zapisany" "$(Q "select count(*) from shipment_items where shipment_code='T-03'")" 0
val "STANDARD z wymiarami — też pominięty, nie błąd" $HHL "select r->>'skipped_standard' from ($(IMP '[{"code":"X","cargo_class":"STANDARD","length_m":10,"width_m":2,"height_m":2}]' true)) s(r)" 1
chk "X (STANDARD z wymiarami) nie został zapisany" "$(Q "select count(*) from shipment_items where shipment_code='X'")" 0
err "bez klasy i bez wymiarów — odrzucony (NULL nie przechodzi)" $HHL "$(IMP '[{"code":"X","qty":1}]' false)" "wymagane dla klasy innej niż STANDARD"
err "nieznana klasa — odrzucona" $HHL "$(IMP '[{"code":"X","cargo_class":"XXL","length_m":1,"width_m":1,"height_m":1}]' false)" "nieznana klasa"
chk "baza: DIMENSIONED bez wymiarów łamie ograniczenie" "$($PSQL -c "insert into shipment_items (project_id, shipment_code, cargo_class, length_m, width_m, height_m) values ('$P','Z1','DIMENSIONED',null,null,null)" 2>&1 | grep -c shipment_items_dims_by_class)" 1
chk "baza: STANDARD z wymiarem łamie ograniczenie" "$($PSQL -c "insert into shipment_items (project_id, shipment_code, cargo_class, length_m, width_m, height_m) values ('$P','Z2','STANDARD',1,null,null)" 2>&1 | grep -c shipment_items_dims_by_class)" 1
$PSQL -c "update shipment_items set schedule_row = schedule_row - 'cargo_class' where shipment_code in ('SG-02','SG-03')" >/dev/null
val "schedule_row sprzed 0050 (bez klucza cargo_class): brak fałszywych zmian" $HHL "select jsonb_array_length(r->'changed') from ($(IMP "$(echo "$R2" | tr -d '\n')" true)) s(r)" 0
echo; echo "[16.3 → I-18] import tylko HHL, KSH potwierdza daty, zapis wprost do tabel zamknięty (RLS)"
chk "anon: brak jakichkolwiek uprawnień do loads/shipment_items/schedule_imports" "$(Q "select (has_table_privilege('anon','loads','select') or has_table_privilege('anon','shipment_items','select') or has_table_privilege('anon','schedule_imports','select'))::text")" false
chk "authenticated: brak DELETE na loads (tylko dopisywanie/zmiana)" "$(Q "select has_table_privilege('authenticated','loads','delete')::text")" false
err "KSH: INSERT do loads wprost odrzucony (RLS loads_insert_hhl)" $KSH "insert into loads (project_id) values ('$P')" "row-level security"
err "SCX: INSERT do loads wprost odrzucony" $SCX "insert into loads (project_id) values ('$P')" "row-level security"
err "KSH: INSERT pozycji harmonogramu wprost odrzucony (items_write)" $KSH "insert into shipment_items (project_id, shipment_code, cargo_class) values ('$P','X-K','STANDARD')" "row-level security"
err "SCX: INSERT do schedule_imports wprost odrzucony" $SCX "insert into schedule_imports (project_id, version, source) values ('$P', 99, 'x')" "permission denied"
val "KSH: UPDATE pozycji harmonogramu zmienia 0 wierszy" $KSH "with u as (update shipment_items set qty = 999 returning 1) select count(*) from u" 0
val "KSH nie widzi historii importów (schedule_imports)" $KSH "select count(*) from schedule_imports" 0
val "SCX nie widzi historii importów (schedule_imports)" $SCX "select count(*) from schedule_imports" 0
val "HHL widzi historię importów" $HHL "select (count(*) > 0)::text from schedule_imports" true
chk "ksh_confirm_dates: SECURITY DEFINER, bez anon" "$(Q "select prosecdef::text||':'||has_function_privilege('anon',oid,'execute')::text from pg_proc where proname='ksh_confirm_dates'")" "true:false"
echo; echo "[3.6] wersje harmonogramu tylko do dopisywania (0093)"
err "HHL: UPDATE wpisu wersji wprost odrzucony" $HHL "update schedule_imports set file_hash = 'x'" "permission denied"
err "HHL: DELETE wpisu wersji wprost odrzucony" $HHL "delete from schedule_imports" "permission denied"
err "HHL: INSERT wersji z pominięciem import_schedule odrzucony" $HHL "insert into schedule_imports (project_id, version, source) values ('$P', 98, 'UPLOAD')" "permission denied"
chk "polityki schedule_imports: tylko odczyt (schedule_imports_hhl_read)" "$(Q "select string_agg(polname||':'||polcmd::text, ',') from pg_policy where polrelid='schedule_imports'::regclass")" "schedule_imports_hhl_read:r"
chk "unikalna para (project_id, version) — dwa importy nie dostaną tej samej wersji" "$(Q "select count(*) from pg_constraint where conrelid='schedule_imports'::regclass and contype='u' and pg_get_constraintdef(oid)='UNIQUE (project_id, version)'")" 1
V36=$(Q "select coalesce(max(version),0) from schedule_imports where project_id='$P'")
R36='[{"code":"SG-36-1","length_m":12.0,"width_m":2.45,"height_m":2.45,"qty":1,"total_weight_t":9.5,"load_date":"2026-11-02","delivery_date":"2026-11-06"}]'
val "HHL: import_schedule (SECURITY DEFINER) nadal dopisuje kolejną wersję z plikiem i skrótem" $HHL "$(IMP "$R36" false); select version||':'||file_name||':'||file_hash from schedule_imports where project_id='$P' order by version desc limit 1" "$((V36+1)):h.xlsx:abc"
echo; echo "WYNIK: $ok OK, $fail FAIL"
