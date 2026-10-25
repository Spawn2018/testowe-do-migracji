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
# #384 pkt 4: daty od current_date — stałe 11.2026 padną po 16.11; hist → bulk_quiet.
D1=$(Q "select (current_date + 20)::text")
D2=$(Q "select (current_date + 25)::text")
D1b=$(Q "select (current_date + 21)::text")
D2b=$(Q "select (current_date + 26)::text")
D1c=$(Q "select (current_date + 22)::text")
D2c=$(Q "select (current_date + 27)::text")
DH1=$(Q "select (current_date - 20)::text")
DH2=$(Q "select (current_date - 15)::text")
DH1b=$(Q "select (current_date - 19)::text")
DH2b=$(Q "select (current_date - 14)::text")
R3="[{\"code\":\"SG-01\",\"length_m\":18.21,\"width_m\":2.45,\"height_m\":2.45,\"qty\":7,\"total_weight_t\":20.74,\"load_date\":\"$D1\",\"delivery_date\":\"$D2\"},
     {\"code\":\"SG-02\",\"length_m\":\"18.21\",\"width_m\":2.45,\"height_m\":2.45,\"qty\":7,\"total_weight_t\":20.74,\"load_date\":\"$D1\",\"delivery_date\":\"$D2\",\"order_no\":\"KSH/77\"},
     {\"code\":\"T-01\",\"length_m\":14.62,\"width_m\":2.45,\"height_m\":2.45,\"qty\":55,\"total_weight_t\":20.17,\"load_date\":\"$D1\",\"delivery_date\":\"$D2\"}]"
IMP() { echo "select import_schedule('$P', '$1'::jsonb, ${3:-'{}'}::text[], '{\"name\":\"h.xlsx\",\"hash\":\"abc\",\"path\":\"harmonogramy/x/abc.xlsx\"}'::jsonb, $2)"; }

echo; echo "[I-1] uprawnienia"
err "KSH nie importuje"                    $KSH "$(IMP "$R3" false)" "wyłącznie HHL"
err "SCX nie importuje"                    $SCX "$(IMP "$R3" true)"  "wyłącznie HHL"
err "konto bez wiersza app_users (is_hhl() = NULL) nie importuje" 99999999-0000-0000-0000-000000000009 "$(IMP "$R3" true)" "wyłącznie HHL"
$PSQL -c "update app_users set active=false where auth_id='$HHL'" >/dev/null
err "HHL nieaktywny (is_hhl() = NULL) nie importuje" $HHL "$(IMP "$R3" true)" "wyłącznie HHL"
$PSQL -c "update app_users set active=true where auth_id='$HHL'" >/dev/null
chk "anon: brak EXECUTE import_schedule"   "$(Q "select has_function_privilege('anon','import_schedule(uuid,jsonb,text[],jsonb,boolean,boolean)','execute')")" f
chk "authenticated: brak EXECUTE schedule_row_canon" "$(Q "select has_function_privilege('authenticated','schedule_row_canon(jsonb)','execute')")" f
chk "funkcja SECURITY DEFINER z search_path" "$(Q "select prosecdef||':'||array_to_string(proconfig,',') from pg_proc where proname='import_schedule'")" "true:search_path=public"
# #426: p_quiet tylko HHL_ADMIN
$PSQL -c "update app_users set role='HHL_OPS' where auth_id='$HHL'" >/dev/null
err "HHL_OPS: p_quiet=true odrzucone" $HHL "select import_schedule('$P', '[]'::jsonb, '{}'::text[], '{}'::jsonb, true, true)" "Administratora HHL"
$PSQL -c "update app_users set role='HHL_ADMIN' where auth_id='$HHL'" >/dev/null

echo; echo "[I-1] podgląd bez zapisu"
val "podgląd: 3 nowe, 0 zmian, kandydat SG-00 zablokowany (faktura)" $HHL "select (r->'added')::text is not null and jsonb_array_length(r->'added')=3 and jsonb_array_length(r->'changed')=0 and jsonb_array_length(r->'blocked')=1 and r->'blocked'->0->>'reason'='INVOICED' from ($(IMP "$R3" true)) s(r)" t
chk "podgląd nic nie zapisał" "$(Q "select count(*) from loads")/$(Q "select count(*) from schedule_imports")/$(Q "select count(*) from load_events")" "2/0/0"

echo; echo "[I-1] zapis"
val "import: 3 transporty, wersja 1" $HHL "select jsonb_array_length(r->'added')||'/'||(r->>'version') from ($(IMP "$R3" false)) s(r)" "3/1" commit
chk "loads +3 (PLANNED, przewoźnik SCX), pozycje 3 z wierszem kanonicznym" "$(Q "select count(*) filter (where status='PLANNED' and carrier_org_id='00000000-0000-0000-0000-00000000a003') from loads l join shipment_items si on si.load_id=l.id where si.shipment_code in ('SG-01','SG-02','T-01') and si.schedule_row is not null")" 3
chk "numer zlecenia KSH i daty planu" "$(Q "select l.order_no||' '||l.plan_load_date||' '||l.plan_delivery_date from loads l join shipment_items si on si.load_id=l.id where si.shipment_code='SG-02'")" "KSH/77 $D1 $D2"
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
# #402 F7: migracja nie włącza dates.email — test włącza jak c16-push (I-10: e-mail HHL+SCX).
$PSQL -c "update notification_matrix set email=true where event_key='dates' and role in ('HHL_ADMIN','CARRIER_DISPATCH')" >/dev/null
$PSQL -c "update loads set plan_load_from=('$D1 08:00'::timestamp at time zone 'Europe/Warsaw'), plan_load_to=('$D1 12:00'::timestamp at time zone 'Europe/Warsaw') where id='$SG1'" >/dev/null
R2="[{\"code\":\"SG-01\",\"length_m\":18.21,\"width_m\":2.45,\"height_m\":2.45,\"qty\":7,\"total_weight_t\":20.74,\"load_date\":\"$D1b\",\"delivery_date\":\"$D2b\"},
     {\"code\":\"SG-02\",\"length_m\":18.5,\"width_m\":2.45,\"height_m\":2.45,\"qty\":7,\"total_weight_t\":20.74,\"load_date\":\"$D1\",\"delivery_date\":\"$D2\",\"order_no\":\"KSH/77\"},
     {\"code\":\"SG-03\",\"length_m\":12,\"width_m\":2.45,\"height_m\":2.45,\"qty\":1,\"total_weight_t\":10,\"load_date\":\"$D1c\",\"delivery_date\":\"$D2c\"}]"
val "podgląd: +1 ~2, krytyczna SG-01, kandydat T-01" $HHL "select jsonb_array_length(r->'added')||'/'||jsonb_array_length(r->'changed')||'/'||(r->'critical'->0->>'code')||'/'||(r->'cancel_candidates'->0->>'code') from ($(IMP "$R2" true)) s(r)" "1/2/SG-01/T-01"
val "zapis bez zgody na anulowanie: T-01 zostaje" $HHL "select jsonb_array_length(r->'cancelled')||'/'||(r->>'version') from ($(IMP "$R2" false)) s(r)" "0/2" commit
# #384 zaległe: zmiana daty bez godziny → okno przesunięte na nowy dzień (nie null, nie stary dzień)
chk "SG-01: nowe daty + okno przesunięte (#384)" "$(Q "select plan_load_date||' '||plan_delivery_date||' '||((plan_load_from at time zone 'Europe/Warsaw')::date = plan_load_date and (plan_load_to at time zone 'Europe/Warsaw')::date = plan_load_date) from loads where id='$SG1'")" "$D1b $D2b true"
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
# A6 L31 (etap A6): dostawa przed załadunkiem nie odrzuca — sprawa KSH_DATES_CHECK
val "A6 L31: dostawa przed załadunkiem wchodzi" $HHL "select jsonb_array_length(r->'added') from ($(IMP '[{"code":"KR-03","length_m":1,"width_m":1,"height_m":1,"qty":1,"load_date":"2026-10-05","delivery_date":"2026-10-01","dates_to_check":true}]' false)) s(r)" 1 commit
chk "A6 L31: KR-03 w bazie" "$(Q "select count(*) from shipment_items where shipment_code='KR-03'")" 1
chk "A6 L31: sprawa KSH_DATES_CHECK" "$(Q "select count(*) from decisions where type_code='KSH_DATES_CHECK' and status in ('NEW','ASSIGNED','SNOOZED') and detail->>'code'='KR-03'")" 1
err "wymiar nieliczbowy"     $HHL "$(IMP '[{"code":"X","length_m":"Standard","width_m":1,"height_m":1}]' false)" "nieprawidłowa"
chk "po błędach: bez nowych transportów X" "$(Q "select count(*) from shipment_items where shipment_code='X'")" 0
val "pusty plik: 0 kandydatów do anulowania" $HHL "select jsonb_array_length(r->'cancel_candidates') from ($(IMP '[]' true)) s(r)" 0

echo; echo "[B-8-IMP] TYP STANDARD pomijany (ładunek NTG, nie błąd)"
RS="[{\"code\":\"T-03\",\"cargo_class\":\"STANDARD\",\"length_m\":null,\"width_m\":null,\"height_m\":null,\"qty\":27,\"total_weight_t\":20.81,\"load_date\":\"$D1\",\"delivery_date\":\"$D2\"}]"
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
R36="[{\"code\":\"SG-36-1\",\"length_m\":12.0,\"width_m\":2.45,\"height_m\":2.45,\"qty\":1,\"total_weight_t\":9.5,\"load_date\":\"$D1\",\"delivery_date\":\"$D2\"}]"
val "HHL: import_schedule (SECURITY DEFINER) nadal dopisuje kolejną wersję z plikiem i skrótem" $HHL "$(IMP "$R36" false); select version||':'||file_name||':'||file_hash from schedule_imports where project_id='$P' order by version desc limit 1" "$((V36+1)):h.xlsx:abc"

echo; echo "[#384 pkt 4b] import historyczny → quiet_hist, bez critical"
RH1="[{\"code\":\"IH-IMP\",\"length_m\":18,\"width_m\":2.4,\"height_m\":2.4,\"qty\":1,\"total_weight_t\":20,\"load_date\":\"$DH1\",\"delivery_date\":\"$DH2\"}]"
RH2="[{\"code\":\"IH-IMP\",\"length_m\":18,\"width_m\":2.4,\"height_m\":2.4,\"qty\":1,\"total_weight_t\":20,\"load_date\":\"$DH1b\",\"delivery_date\":\"$DH2b\"}]"
val "IH-IMP: dodanie historycznego" $HHL "select jsonb_array_length(r->'added') from ($(IMP "$RH1" false)) s(r)" 1 commit
LIH=$(Q "select load_id from shipment_items where shipment_code='IH-IMP'")
$PSQL -c "update loads set status='DELIVERED', carrier_org_id='00000000-0000-0000-0000-00000000a003' where id='$LIH'" >/dev/null
$PSQL -c "delete from notifications where load_id='$LIH'; delete from load_events where load_id='$LIH' and event_type in ('PLAN_DATES_CHANGED','SCHEDULE_DATE_CRITICAL')" >/dev/null
val "IH-IMP: zmiana daty → quiet_hist + critical false" $HHL "select coalesce(r->'changed'->0->>'quiet_hist','false')||'/'||coalesce(r->'changed'->0->>'critical','true') from ($(IMP "$RH2" false)) s(r)" "true/false" commit
chk "IH-IMP: bez PLAN_DATES_CHANGED" "$(Q "select count(*)::text from load_events where load_id='$LIH' and event_type='PLAN_DATES_CHANGED'")" "0"
chk "IH-IMP: bez SCHEDULE_DATE_CRITICAL" "$(Q "select count(*)::text from load_events where load_id='$LIH' and event_type='SCHEDULE_DATE_CRITICAL'")" "0"
# zmiana istniejącego (regresja SELECT plan_*_date) — tylko IH-IMP w pliku + SG-36-1 żeby nie kasować
RCHG="[{\"code\":\"IH-IMP\",\"length_m\":18.1,\"width_m\":2.4,\"height_m\":2.4,\"qty\":1,\"total_weight_t\":20,\"load_date\":\"$DH1b\",\"delivery_date\":\"$DH2b\"},
       {\"code\":\"SG-36-1\",\"length_m\":12.0,\"width_m\":2.45,\"height_m\":2.45,\"qty\":1,\"total_weight_t\":9.5,\"load_date\":\"$D1\",\"delivery_date\":\"$D2\"}]"
val "IH-IMP: zmiana długości na istniejącym → changed" $HHL "select (r->'changed'->0->>'code')||'/'||coalesce(r->'changed'->0->>'quiet_hist','false') from ($(IMP "$RCHG" false)) s(r)" "IH-IMP/true" commit
chk "IH-IMP: długość 18.10 po zmianie" "$(Q "select length_m::text from shipment_items where shipment_code='IH-IMP'")" "18.10"

echo; echo "[#426] import p_quiet — F7: 0 powiadomień / decyzji / SMS / ryzyk / workflow"
# F7#1: działanie SMS nie da się tu sprawdzić — trg_loads_sms wyłączony w 0257; tylko prosrc (e164 + quiet).
chk "F7#1: trg_sms_load_changes ma driver_phone_e164" "$(Q "select (prosrc like '%driver_phone_e164%')::text from pg_proc where proname='trg_sms_load_changes'")" "true"
chk "F7#1: trg_sms_load_changes ma bulk_quiet" "$(Q "select (prosrc like '%bulk_quiet%')::text from pg_proc where proname='trg_sms_load_changes'")" "true"
chk "F7#3: l3_ksh_lead ma bulk_quiet" "$(Q "select (prosrc like '%bulk_quiet%')::text from pg_proc where proname='l3_ksh_lead'")" "true"
chk "F7#4: wf_enqueue_event ma bulk_quiet" "$(Q "select (prosrc like '%bulk_quiet%')::text from pg_proc where proname='wf_enqueue_event'")" "true"

# Działaj jako HHL_OPS → odmowa p_quiet (current_app_role = OPS)
OPS_AUTH=11111111-0000-0000-0000-00000000d426
$PSQL -c "insert into app_users (auth_id, org_id, email, role, active)
  values ('$OPS_AUTH','00000000-0000-0000-0000-00000000a001','ops-426@test','HHL_OPS',true)
  on conflict (auth_id) do update set role='HHL_OPS', active=true, org_id=excluded.org_id" >/dev/null
OPS_ID=$(Q "select id::text from app_users where auth_id='$OPS_AUTH'")
err "F7: Działaj jako HHL_OPS → p_quiet odmowa" $HHL "select admin_impersonate_start('$OPS_ID'::uuid); select import_schedule('$P', '[]'::jsonb, '{}'::text[], '{}'::jsonb, true, true)" "Administratora HHL"
$PSQL -c "delete from impersonation_state" >/dev/null

DQ1=$(Q "select (current_date + 30)::text")
DQ2=$(Q "select (current_date + 35)::text")
DQ1b=$(Q "select (current_date + 31)::text")
DQ2b=$(Q "select (current_date + 36)::text")
# Bloker 3: data w LEAD_DAYS (domyślnie 5) — quiet add nie tworzy LATE_DATE_CHANGE
DN1=$(Q "select (current_date + 2)::text")
DN2=$(Q "select (current_date + 7)::text")
RQ1="[{\"code\":\"IQ-426A\",\"length_m\":18,\"width_m\":2.4,\"height_m\":2.4,\"qty\":1,\"total_weight_t\":20,\"load_date\":\"$DQ1\",\"delivery_date\":\"$DQ2\"}]"
RQ2="[{\"code\":\"IQ-426A\",\"length_m\":18,\"width_m\":2.4,\"height_m\":2.4,\"qty\":1,\"total_weight_t\":20,\"load_date\":\"$DQ1b\",\"delivery_date\":\"$DQ2b\"}]"
RQN="[{\"code\":\"IQ-426N\",\"length_m\":18,\"width_m\":2.4,\"height_m\":2.4,\"qty\":1,\"total_weight_t\":20,\"load_date\":\"$DN1\",\"delivery_date\":\"$DN2\"}]"
IMPQ() { echo "select import_schedule('$P', '$1'::jsonb, ${3:-'{}'}::text[], '{\"name\":\"q426.xlsx\",\"hash\":\"q426\",\"path\":\"harmonogramy/x/q426.xlsx\"}'::jsonb, $2, true)"; }

# F7#7: dry_run quiet pokazuje critical (awizowany + zmiana daty)
val "IQ-426: dodanie (bez quiet, dalekie daty)" $HHL "select jsonb_array_length(r->'added') from ($(IMP "$RQ1" false)) s(r)" 1 commit
LIQ=$(Q "select load_id from shipment_items where shipment_code='IQ-426A'")
$PSQL -c "update loads set plan_load_from=('$DQ1 08:00'::timestamp at time zone 'Europe/Warsaw'), plan_load_to=('$DQ1 12:00'::timestamp at time zone 'Europe/Warsaw'), carrier_org_id='00000000-0000-0000-0000-00000000a003' where id='$LIQ'" >/dev/null
$PSQL -c "update notification_matrix set email=true where event_key='dates' and role in ('HHL_ADMIN','CARRIER_DISPATCH')" >/dev/null
val "F7#7: dry_run quiet → critical widoczne" $HHL "select jsonb_array_length(r->'critical')||'/'||(r->>'quiet') from ($(IMPQ "$RQ2" true)) s(r)" "1/true"

N0=$(Q "select count(*) from notifications")
D0=$(Q "select count(*) from decisions")
S0=$(Q "select count(*) from sms_outbox")
C0=$(Q "select count(*) from load_events where load_id='$LIQ' and event_type='SCHEDULE_DATE_CRITICAL'")
# zapis quiet: critical w odpowiedzi (jak w dry_run), ale 0 zdarzeń/powiadomień
val "IQ-426: p_quiet zapis → quiet + critical w odpowiedzi + changed" $HHL "select (r->>'quiet')||'/'||jsonb_array_length(r->'critical')||'/'||jsonb_array_length(r->'changed') from ($(IMPQ "$RQ2" false)) s(r)" "true/1/1" commit
chk "IQ-426: 0 nowych SCHEDULE_DATE_CRITICAL" "$(Q "select (count(*) - $C0)::text from load_events where load_id='$LIQ' and event_type='SCHEDULE_DATE_CRITICAL'")" "0"
chk "IQ-426: 0 nowych notifications" "$(Q "select (count(*) - $N0)::text from notifications")" "0"
chk "IQ-426: 0 nowych decisions" "$(Q "select (count(*) - $D0)::text from decisions")" "0"
chk "IQ-426: 0 nowych sms_outbox" "$(Q "select (count(*) - $S0)::text from sms_outbox")" "0"
chk "IQ-426: audit import bez powiadomień" "$(Q "select count(*)::text from audit_log where action='SCHEDULE_IMPORT_QUIET' and new_value->>'note'='import bez powiadomień' and new_value ? 'import_id'")" "1"
chk "IQ-426: stats.quiet + payload.quiet" "$(Q "select (s.stats->>'quiet')||'/'||(e.payload->>'quiet') from schedule_imports s join load_events e on e.payload->>'code'='IQ-426A' and e.event_type='SCHEDULE_IMPORTED' and e.payload->>'action'='CHANGED' where s.file_hash='q426' order by e.occurred_at desc limit 1")" "true/true"
chk "IQ-426: data planu zmieniona mimo quiet" "$(Q "select plan_load_date||' '||plan_delivery_date from loads where id='$LIQ'")" "$DQ1b $DQ2b"
val "F7: bulk_quiet nie zostaje on po imporcie" $HHL "select import_schedule('$P', '$RQ2'::jsonb, '{}'::text[], '{\"name\":\"q426b.xlsx\",\"hash\":\"q426b\"}'::jsonb, true, true); select coalesce(nullif(current_setting('tower.bulk_quiet', true), ''), '-')" "-" 

# F7#3: kontrola dodatnia — ten sam bliski termin bez quiet → LATE_DATE_CHANGE; quiet → 0
RQN_POS="[{\"code\":\"IQ-426P\",\"length_m\":18,\"width_m\":2.4,\"height_m\":2.4,\"qty\":1,\"total_weight_t\":20,\"load_date\":\"$DN1\",\"delivery_date\":\"$DN2\"}]"
R0=$(Q "select count(*) from risk_signals where kind='LATE_DATE_CHANGE'")
val "F7#3+: add blisko bez quiet → 1 added" $HHL "select jsonb_array_length(r->'added') from ($(IMP "$RQN_POS" false)) s(r)" 1 commit
chk "F7#3+: ≥1 LATE_DATE_CHANGE bez quiet" "$(Q "select (count(*) - $R0 >= 1)::text from risk_signals where kind='LATE_DATE_CHANGE'")" "true"
N1=$(Q "select count(*) from notifications"); DecB3=$(Q "select count(*) from decisions"); R1=$(Q "select count(*) from risk_signals where kind='LATE_DATE_CHANGE'")
val "F7#3: quiet add blisko → 1 added" $HHL "select jsonb_array_length(r->'added') from ($(IMPQ "$RQN" false)) s(r)" 1 commit
chk "F7#3: 0 nowych LATE_DATE_CHANGE" "$(Q "select (count(*) - $R1)::text from risk_signals where kind='LATE_DATE_CHANGE'")" "0"
chk "F7#3: 0 nowych notifications po add" "$(Q "select (count(*) - $N1)::text from notifications")" "0"
chk "F7#3: 0 nowych decisions po add" "$(Q "select (count(*) - $DecB3)::text from decisions")" "0"

# F7 drobne: cichy import z innym numerem HHL → 0 TOWER_KSH_CONFLICT (wymaga column_map hhlOrderNo)
$PSQL -c "update loads set hhl_order_no='HHL/426-OLD' where id='$LIQ'" >/dev/null
RQCONF="[{\"code\":\"IQ-426A\",\"length_m\":18.01,\"width_m\":2.4,\"height_m\":2.4,\"qty\":1,\"total_weight_t\":20,\"load_date\":\"$DQ1b\",\"delivery_date\":\"$DQ2b\",\"hhlOrderNo\":\"HHL/426-NEW\"}]"
IMPQMAP() { echo "select import_schedule('$P', '$1'::jsonb, '{}'::text[], '{\"name\":\"q426c.xlsx\",\"hash\":\"q426c\",\"path\":\"harmonogramy/x/q426c.xlsx\",\"column_map\":{\"hhlOrderNo\":\"Nr HHL\"}}'::jsonb, $2, true)"; }
DecConf=$(Q "select count(*) from decisions where detail->>'event_key' like 'l1b:conflict:%:hhl_order_no'")
val "F7: quiet + inny hhlOrderNo → changed" $HHL "select jsonb_array_length(r->'changed') from ($(IMPQMAP "$RQCONF" false)) s(r)" 1 commit
chk "F7: 0 TOWER_KSH_CONFLICT przy quiet" "$(Q "select (count(*) - $DecConf)::text from decisions where detail->>'event_key' like 'l1b:conflict:%:hhl_order_no'")" "0"

# F7#2+#4 / #413: START-7 usunięte (E35 Z1) — reguła testowa T-CANCEL na STATUS_CANCELLED
$PSQL -c "insert into workflows (project_id, code, name, description, trigger_type, condition, actions, enabled)
  select '$P', 'T-CANCEL', 'Transport anulowany (test)', 'test #426', 'STATUS_CANCELLED', 'true'::jsonb,
         '[{\"type\":\"notify\",\"audience\":\"CARRIER\"}]'::jsonb, true
   where not exists (select 1 from workflows where project_id='$P' and code='T-CANCEL' and removed_at is null)" >/dev/null
$PSQL -c "update workflows set enabled=true, removed_at=null where code='T-CANCEL' and project_id='$P'" >/dev/null
RQC0="[{\"code\":\"IQ-426C\",\"length_m\":18,\"width_m\":2.4,\"height_m\":2.4,\"qty\":1,\"total_weight_t\":20,\"load_date\":\"$DQ1\",\"delivery_date\":\"$DQ2\"}]"
RQD0="[{\"code\":\"IQ-426D\",\"length_m\":18,\"width_m\":2.4,\"height_m\":2.4,\"qty\":1,\"total_weight_t\":20,\"load_date\":\"$DQ1\",\"delivery_date\":\"$DQ2\"}]"
val "F7#4: dodanie IQ-426C (quiet)" $HHL "select jsonb_array_length(r->'added') from ($(IMPQ "$RQC0" false)) s(r)" 1 commit
val "F7#4+: dodanie IQ-426D (bez quiet)" $HHL "select jsonb_array_length(r->'added') from ($(IMP "$RQD0" false)) s(r)" 1 commit
LIC=$(Q "select load_id from shipment_items where shipment_code='IQ-426C'")
LID=$(Q "select load_id from shipment_items where shipment_code='IQ-426D'")
# plik z dotychczasowymi kodami (bez IQ-426C/D) — brakujące = kandydat
RQKEEP="[{\"code\":\"IQ-426A\",\"length_m\":18.01,\"width_m\":2.4,\"height_m\":2.4,\"qty\":1,\"total_weight_t\":20,\"load_date\":\"$DQ1b\",\"delivery_date\":\"$DQ2b\"},
         {\"code\":\"IQ-426N\",\"length_m\":18,\"width_m\":2.4,\"height_m\":2.4,\"qty\":1,\"total_weight_t\":20,\"load_date\":\"$DN1\",\"delivery_date\":\"$DN2\"},
         {\"code\":\"IQ-426P\",\"length_m\":18,\"width_m\":2.4,\"height_m\":2.4,\"qty\":1,\"total_weight_t\":20,\"load_date\":\"$DN1\",\"delivery_date\":\"$DN2\"},
         {\"code\":\"SG-36-1\",\"length_m\":12.0,\"width_m\":2.45,\"height_m\":2.45,\"qty\":1,\"total_weight_t\":9.5,\"load_date\":\"$D1\",\"delivery_date\":\"$D2\"},
         {\"code\":\"SG-01\",\"length_m\":18.21,\"width_m\":2.45,\"height_m\":2.45,\"qty\":7,\"total_weight_t\":20.74,\"load_date\":\"$D1b\",\"delivery_date\":\"$D2b\"},
         {\"code\":\"SG-02\",\"length_m\":18.5,\"width_m\":2.45,\"height_m\":2.45,\"qty\":7,\"total_weight_t\":20.74,\"load_date\":\"$D1\",\"delivery_date\":\"$D2\",\"order_no\":\"KSH/77\"},
         {\"code\":\"SG-03\",\"length_m\":12,\"width_m\":2.45,\"height_m\":2.45,\"qty\":1,\"total_weight_t\":10,\"load_date\":\"$D1c\",\"delivery_date\":\"$D2c\"},
         {\"code\":\"IH-IMP\",\"length_m\":18.1,\"width_m\":2.4,\"height_m\":2.4,\"qty\":1,\"total_weight_t\":20,\"load_date\":\"$DH1b\",\"delivery_date\":\"$DH2b\"},
         {\"code\":\"SG-00\",\"length_m\":10,\"width_m\":2.5,\"height_m\":2.5,\"qty\":1,\"total_weight_t\":10,\"load_date\":\"$D1\",\"delivery_date\":\"$D2\"}]"
W0=$(Q "select count(*) from workflow_runs where payload->>'event_type'='STATUS_CANCELLED'")
val "F7#4+: cancel IQ-426D bez quiet → 1 cancelled" $HHL "select jsonb_array_length(r->'cancelled') from ($(IMP "$RQKEEP" false "'{IQ-426D}'")) s(r)" 1 commit
chk "F7#4+: +1 workflow STATUS_CANCELLED bez quiet" "$(Q "select (count(*) - $W0)::text from workflow_runs where payload->>'event_type'='STATUS_CANCELLED'")" "1"
chk "F7#4+: IQ-426D CANCELLED" "$(Q "select status from loads where id='$LID'")" "CANCELLED"
DecB4=$(Q "select count(*) from decisions"); W1=$(Q "select count(*) from workflow_runs where payload->>'event_type'='STATUS_CANCELLED'")
val "F7#2+#4: quiet cancel IQ-426C → 0 spraw / 0 wf" $HHL "select jsonb_array_length(r->'cancelled') from ($(IMPQ "$RQKEEP" false "'{IQ-426C}'")) s(r)" 1 commit
chk "F7#2: 0 nowych decisions po quiet cancel" "$(Q "select (count(*) - $DecB4)::text from decisions")" "0"
chk "F7#4: 0 nowych workflow STATUS_CANCELLED" "$(Q "select (count(*) - $W1)::text from workflow_runs where payload->>'event_type'='STATUS_CANCELLED'")" "0"
chk "F7#4: IQ-426C CANCELLED" "$(Q "select status from loads where id='$LIC'")" "CANCELLED"

# cofnij email=true z testu (jak F7 drobne)
$PSQL -c "update notification_matrix set email=false where event_key='dates' and role in ('HHL_ADMIN','CARRIER_DISPATCH')" >/dev/null

echo; echo "[#384 F7] przywrócenie okien (d) — hotfix_384_restore_windows"
# Pozytywne: SG-01 w STEGRA z null to/from + PLAN_DATES_CHANGED before_*; confirmed_* zostaje
SG_R=$(Q "select load_id from shipment_items where shipment_code='SG-01' and project_id='$P' limit 1")
KSH_UID=$(Q "select id::text from app_users where auth_id='$KSH'")
# dates_ctx + bulk_quiet: bez skasowania confirmed_* i bez zbędnego PLAN_DATES_CHANGED z UPDATE
$PSQL -v ON_ERROR_STOP=1 -c "
begin;
select set_config('tower.dates_ctx', 'on', true);
select set_config('tower.bulk_quiet', 'on', true);
update loads set
  plan_load_date = '$D1b'::date,
  plan_delivery_date = '$D2b'::date,
  plan_load_from = ('$D1b 08:00'::timestamp at time zone 'Europe/Warsaw'),
  plan_load_to = null,
  plan_delivery_to = ('$D2b 16:00'::timestamp at time zone 'Europe/Stockholm'),
  plan_delivery_from = null,
  plan_dates_status = 'POTWIERDZONA',
  plan_dates_confirmed_by = '$KSH_UID'::uuid,
  plan_dates_confirmed_at = '2026-10-01 12:00:00+00'::timestamptz
 where id='$SG_R';
insert into load_events (load_id, event_type, occurred_at, actor_id, payload)
values (
  '$SG_R', 'PLAN_DATES_CHANGED', now() + interval '1 second', null,
  jsonb_build_object(
    'before_load_to', ('$D1b 12:00'::timestamp at time zone 'Europe/Warsaw'),
    'before_delivery_from', ('$D2b 10:00'::timestamp at time zone 'Europe/Stockholm'),
    'before_load_from', ('$D1b 08:00'::timestamp at time zone 'Europe/Warsaw'),
    'before_delivery_to', ('$D2b 16:00'::timestamp at time zone 'Europe/Stockholm')
  )
);
commit;" >/dev/null
N_REST=$(Q "select public.hotfix_384_restore_windows()")
if [ "${N_REST:-0}" -ge 1 ] 2>/dev/null; then ok=$((ok+1)); echo "  OK    F7 (d)+: przywrócono ≥1 (SG-01)"; else fail=$((fail+1)); echo "  FAIL  F7 (d)+: przywrócono ≥1 (otrzymano: $N_REST)"; fi
chk "F7 (d)+: SG-01 ma plan_load_to i plan_delivery_from" "$(Q "select (plan_load_to is not null and plan_delivery_from is not null)::text from loads where id='$SG_R'")" "true"
chk "F7 (d)+: potwierdzenie KSH zachowane" "$(Q "select (plan_dates_confirmed_by = '$KSH_UID'::uuid and plan_dates_status = 'POTWIERDZONA')::text from loads where id='$SG_R'")" "true"

# Ujemne: inny projekt, ten sam kod SG-01 — nie przywracaj
P2=22222222-0000-0000-0000-000000000099
$PSQL -c "
  insert into projects (id, code, name, client_org_id)
  values ('$P2', 'OTHER_P', 'Inny projekt', '00000000-0000-0000-0000-00000000a002')
  on conflict (id) do nothing" >/dev/null
L_OTH=$(Q "insert into loads (project_id, carrier_org_id, order_no, status, plan_load_date, plan_delivery_date,
    plan_load_from, plan_load_to, plan_delivery_to, plan_delivery_from)
  values ('$P2', '00000000-0000-0000-0000-00000000a003', 'OTH-SG01', 'PLANNED',
    '$D1b'::date, '$D2b'::date,
    ('$D1b 08:00'::timestamp at time zone 'Europe/Warsaw'), null,
    ('$D2b 16:00'::timestamp at time zone 'Europe/Stockholm'), null)
  returning id")
$PSQL -c "insert into shipment_items (project_id, load_id, shipment_code, length_m, width_m, height_m)
  values ('$P2', '$L_OTH', 'SG-01', 18, 2.4, 2.4)" >/dev/null
$PSQL -c "
  insert into load_events (load_id, event_type, occurred_at, payload)
  values (
    '$L_OTH', 'PLAN_DATES_CHANGED', now() - interval '30 minutes',
    jsonb_build_object(
      'before_load_to', ('$D1b 12:00'::timestamp at time zone 'Europe/Warsaw'),
      'before_delivery_from', ('$D2b 10:00'::timestamp at time zone 'Europe/Stockholm')
    )
  )" >/dev/null
$PSQL -c "select public.hotfix_384_restore_windows()" >/dev/null
chk "F7 (d)-: inny projekt SG-01 bez przywrócenia" "$(Q "select (plan_load_to is null and plan_delivery_from is null)::text from loads where id='$L_OTH'")" "true"

# #455 / F7 r4: ujemne hotfix_384_restore_windows — before_* innej daty; do <= od; >3 dopasowań
echo; echo "[#455] ujemne hotfix_384_restore_windows"
SG_R2=$(Q "select load_id from shipment_items where shipment_code='SG-02' and project_id='$P' limit 1")
# (1) before_* z innym dniem niż bieżący plan → pominięty
$PSQL -v ON_ERROR_STOP=1 -c "
begin;
select set_config('tower.dates_ctx', 'on', true);
select set_config('tower.bulk_quiet', 'on', true);
update loads set
  plan_load_date = '$D1b'::date,
  plan_delivery_date = '$D2b'::date,
  plan_load_from = ('$D1b 08:00'::timestamp at time zone 'Europe/Warsaw'),
  plan_load_to = null,
  plan_delivery_to = ('$D2b 16:00'::timestamp at time zone 'Europe/Stockholm'),
  plan_delivery_from = null
 where id='$SG_R2';
insert into load_events (load_id, event_type, occurred_at, payload)
values (
  '$SG_R2', 'PLAN_DATES_CHANGED', now() + interval '2 seconds',
  jsonb_build_object(
    'before_load_to', (('$D1b'::date + 5) + time '12:00') at time zone 'Europe/Warsaw',
    'before_delivery_from', (('$D2b'::date + 5) + time '10:00') at time zone 'Europe/Stockholm'
  )
);
commit;" >/dev/null
$PSQL -c "select public.hotfix_384_restore_windows()" >/dev/null
chk "#455: before_* innej daty → bez przywrócenia" "$(Q "select (plan_load_to is null and plan_delivery_from is null)::text from loads where id='$SG_R2'")" "true"

# (2) do <= od (before_load_to <= plan_load_from, ta sama data) → pominięty
$PSQL -v ON_ERROR_STOP=1 -c "
begin;
select set_config('tower.dates_ctx', 'on', true);
select set_config('tower.bulk_quiet', 'on', true);
update loads set
  plan_load_from = ('$D1b 12:00'::timestamp at time zone 'Europe/Warsaw'),
  plan_load_to = null,
  plan_delivery_from = null
 where id='$SG_R2';
insert into load_events (load_id, event_type, occurred_at, payload)
values (
  '$SG_R2', 'PLAN_DATES_CHANGED', now() + interval '3 seconds',
  jsonb_build_object(
    'before_load_to', ('$D1b 10:00'::timestamp at time zone 'Europe/Warsaw'),
    'before_delivery_from', ('$D2b 18:00'::timestamp at time zone 'Europe/Stockholm')
  )
);
commit;" >/dev/null
$PSQL -c "select public.hotfix_384_restore_windows()" >/dev/null
chk "#455: do <= od → plan_load_to bez przywrócenia" "$(Q "select (plan_load_to is null)::text from loads where id='$SG_R2'")" "true"

# (3) >3 dopasowań SG-01/02/T-01 w STEGRA → wyjątek (strażnik 0267 l. 957).
# UNIQUE(project_id, shipment_code) blokuje drugi SG-01 w $P — wiersz si z innym
# project_id (strażnik liczy po l.project_id + si.shipment_code, join po load_id).
P3=22222222-0000-0000-0000-000000000097
$PSQL -c "
  insert into projects (id, code, name, client_org_id)
  values ('$P3', 'GUARD_455', 'Strażnik 455', '00000000-0000-0000-0000-00000000a002')
  on conflict (id) do nothing" >/dev/null
L_EXTRA=$(Q "insert into loads (project_id, carrier_org_id, order_no, status, plan_load_date, plan_delivery_date,
    plan_load_from, plan_load_to, plan_delivery_to, plan_delivery_from)
  values ('$P', '00000000-0000-0000-0000-00000000a003', 'EXTRA-SG', 'PLANNED',
    '$D1b'::date, '$D2b'::date,
    ('$D1b 08:00'::timestamp at time zone 'Europe/Warsaw'), null,
    ('$D2b 16:00'::timestamp at time zone 'Europe/Stockholm'), null)
  returning id")
$PSQL -c "insert into shipment_items (project_id, load_id, shipment_code, length_m, width_m, height_m)
  values ('$P3', '$L_EXTRA', 'SG-01', 18, 2.4, 2.4)" >/dev/null
OUT_GT3=$($PSQL -c "select public.hotfix_384_restore_windows()" 2>&1)
if echo "$OUT_GT3" | grep -qiE 'za dużo dopasowań|P0001'; then
  ok=$((ok+1)); echo "  OK    #455: >3 dopasowań → wyjątek"
else
  fail=$((fail+1)); echo "  FAIL  #455: >3 dopasowań → wyjątek (otrzymano: $(echo "$OUT_GT3" | tail -1))"
fi
$PSQL -c "delete from shipment_items where load_id='$L_EXTRA'; delete from loads where id='$L_EXTRA'" >/dev/null

echo; echo "[A6] zasoby/numery + renumeracja (0303)"
RA6="[{\"code\":\"SG-02\",\"length_m\":18.5,\"width_m\":2.45,\"height_m\":2.45,\"qty\":7,\"total_weight_t\":20.74,\"load_date\":\"$D1\",\"delivery_date\":\"$D2\",\"hhl_order_no\":\"0002/10/S/2026\",\"carrier_order_no\":\"15002/2026/OSL/GDA/P\",\"driver_name\":\"Jan Test\",\"tractor_plate\":\"WGM1A6\",\"trailer_plate\":\"WWW1A6\"}]"
val "A6: zasoby i numery z pliku" $HHL "select import_schedule('$P', '$RA6'::jsonb, '{}'::text[], '{\"name\":\"a6.xlsx\",\"hash\":\"a6\",\"path\":\"harmonogramy/x/a6.xlsx\"}'::jsonb, false); select coalesce(hhl_order_no,'')||'|'||coalesce(carrier_order_no,'')||'|'||coalesce(driver_name,'')||'|'||coalesce(tractor_plate,'')||'|'||coalesce(trailer_plate,'') from loads l join shipment_items si on si.load_id=l.id where si.shipment_code='SG-02'" "0002/10/S/2026|15002/2026/OSL/GDA/P|Jan Test|WGM1A6|WWW1A6" commit
# Renumeracja: SG-A6OLD → SG-A6NEW przez komentarz
L_REN=$(Q "insert into loads (project_id, carrier_org_id, status, plan_load_date, plan_delivery_date)
  values ('$P', '00000000-0000-0000-0000-00000000a003', 'PLANNED', '$D1'::date, '$D2'::date) returning id")
$PSQL -c "insert into shipment_items (project_id, load_id, shipment_code, length_m, width_m, height_m, qty)
  values ('$P', '$L_REN', 'SG-A6OLD', 18, 2.4, 2.4, 1)" >/dev/null
RREN="[{\"code\":\"SG-A6NEW\",\"length_m\":18,\"width_m\":2.4,\"height_m\":2.4,\"qty\":1,\"load_date\":\"$D1\",\"delivery_date\":\"$D2\",\"comment\":\"Wcześniej to był SG-A6OLD\"}]"
val "A6: renumeracja kodu" $HHL "select import_schedule('$P', '$RREN'::jsonb, '{}'::text[], '{\"name\":\"a6r.xlsx\",\"hash\":\"a6r\"}'::jsonb, false); select shipment_code||'|'||coalesce(renumbered_from,'') from shipment_items where load_id='$L_REN'" "SG-A6NEW|SG-A6OLD" commit
chk "A6: stary kod zniknął" "$(Q "select count(*) from shipment_items where project_id='$P' and shipment_code='SG-A6OLD'")" 0
chk "A6: helper komentarza" "$(Q "select public.a6_renumber_from_comment('Wcześniej to był SG-11')")" "SG-11"

echo; echo "WYNIK: $ok OK, $fail FAIL"
