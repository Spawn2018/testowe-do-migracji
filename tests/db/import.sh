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
# A6 L31 (etap A6): dostawa przed / w dniu / >14 dni nie odrzuca — sprawa KSH_DATES_CHECK
chk "A6 helper: dostawa przed" "$(Q "select public.a6_import_dates_odd('2026-10-05'::date,'2026-10-01'::date)")" t
chk "A6 helper: w dniu" "$(Q "select public.a6_import_dates_odd('2026-10-05'::date,'2026-10-05'::date)")" t
chk "A6 helper: >14 dni" "$(Q "select public.a6_import_dates_odd('2026-10-05'::date,'2026-10-25'::date)")" t
chk "A6 helper: OK 5 dni" "$(Q "select public.a6_import_dates_odd('2026-10-05'::date,'2026-10-10'::date)")" f
val "A6 L31: dostawa przed załadunkiem wchodzi" $HHL "select jsonb_array_length(r->'added') from ($(IMP '[{"code":"KR-03","length_m":1,"width_m":1,"height_m":1,"qty":1,"load_date":"2026-10-05","delivery_date":"2026-10-01"}]' false)) s(r)" 1 commit
chk "A6 L31: KR-03 w bazie" "$(Q "select count(*) from shipment_items where shipment_code='KR-03'")" 1
chk "A6 L31: sprawa KSH_DATES_CHECK" "$(Q "select count(*) from decisions where type_code='KSH_DATES_CHECK' and status in ('NEW','ASSIGNED','SNOOZED') and detail->>'code'='KR-03'")" 1
val "A6 L31: w dniu załadunku — dry_run dates_check bez wyjątku" $HHL "select r->>'dates_check' from ($(IMP '[{"code":"KR-DAY","length_m":1,"width_m":1,"height_m":1,"qty":1,"load_date":"2026-10-05","delivery_date":"2026-10-05"}]' true)) s(r)" 1
val "A6 L31: >14 dni — dry_run dates_check" $HHL "select r->>'dates_check' from ($(IMP '[{"code":"KR-FAR","length_m":1,"width_m":1,"height_m":1,"qty":1,"load_date":"2026-10-05","delivery_date":"2026-10-25"}]' true)) s(r)" 1
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

# F7 drobne: cichy import z innym numerem HHL → 0 sprawy NUMERU (l1b_note_conflict).
# Bez pending w kolejce (#426); klucze z :pending: (file-changed) nie liczą się (F7 05:37/06:08).
$PSQL -c "update loads set hhl_order_no='HHL/426-OLD' where id='$LIQ'" >/dev/null
$PSQL -c "delete from ksh_sync_outbound where load_id='$LIQ'" >/dev/null
RQCONF="[{\"code\":\"IQ-426A\",\"length_m\":18.01,\"width_m\":2.4,\"height_m\":2.4,\"qty\":1,\"total_weight_t\":20,\"load_date\":\"$DQ1b\",\"delivery_date\":\"$DQ2b\",\"hhlOrderNo\":\"HHL/426-NEW\"}]"
IMPQMAP() { echo "select import_schedule('$P', '$1'::jsonb, '{}'::text[], '{\"name\":\"q426c.xlsx\",\"hash\":\"q426c\",\"path\":\"harmonogramy/x/q426c.xlsx\",\"column_map\":{\"hhlOrderNo\":\"Nr HHL\"}}'::jsonb, $2, true)"; }
DecConf=$(Q "select count(*) from decisions where detail->>'event_key' ~ 'l1b:conflict:.*:hhl_order_no$' and detail->>'event_key' !~ ':pending:'")
val "F7: quiet + inny hhlOrderNo → changed" $HHL "select jsonb_array_length(r->'changed') from ($(IMPQMAP "$RQCONF" false)) s(r)" 1 commit
chk "F7: 0 TOWER_KSH_CONFLICT przy quiet" "$(Q "select (count(*) - $DecConf)::text from decisions where detail->>'event_key' ~ 'l1b:conflict:.*:hhl_order_no$' and detail->>'event_key' !~ ':pending:'")" "0"
# F7 r8 BLOKER 1: nie-cichy + inny HHL + brak kolejki → 1 sprawa bez :pending:
$PSQL -c "update loads set hhl_order_no='HHL/426-OLD2' where id='$LIQ'" >/dev/null
$PSQL -c "delete from ksh_sync_outbound where load_id='$LIQ'" >/dev/null
RQCONF2="[{\"code\":\"IQ-426A\",\"length_m\":18.02,\"width_m\":2.4,\"height_m\":2.4,\"qty\":1,\"total_weight_t\":20,\"load_date\":\"$DQ1b\",\"delivery_date\":\"$DQ2b\",\"hhlOrderNo\":\"HHL/426-NEW2\"}]"
IMPMAP() { echo "select import_schedule('$P', '$1'::jsonb, '{}'::text[], '{\"name\":\"q426n.xlsx\",\"hash\":\"q426n\",\"path\":\"harmonogramy/x/q426n.xlsx\",\"column_map\":{\"hhlOrderNo\":\"Nr HHL\"}}'::jsonb, $2, false)"; }
DecConf2=$(Q "select count(*) from decisions where detail->>'event_key' ~ 'l1b:conflict:.*:hhl_order_no$' and detail->>'event_key' !~ ':pending:' and status in ('NEW','ASSIGNED','SNOOZED')")
val "F7 r8: nie-cichy + inny hhl → changed" $HHL "select jsonb_array_length(r->'changed') from ($(IMPMAP "$RQCONF2" false)) s(r)" 1 commit
chk "F7 r8: 1 sprawa HHL bez :pending:" "$(Q "select (count(*) - $DecConf2)::text from decisions where detail->>'event_key' ~ 'l1b:conflict:.*:hhl_order_no$' and detail->>'event_key' !~ ':pending:' and status in ('NEW','ASSIGNED','SNOOZED')")" "1"

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
val "A6: import zasobów (RPC)" $HHL "select (import_schedule('$P', '$RA6'::jsonb, '{}'::text[], '{\"name\":\"a6.xlsx\",\"hash\":\"a6\",\"path\":\"harmonogramy/x/a6.xlsx\"}'::jsonb, false)->>'changed') is not null" t commit
chk "A6: zasoby i numery z pliku" "$(Q "select coalesce(hhl_order_no,'')||'|'||coalesce(carrier_order_no,'')||'|'||coalesce(driver_name,'')||'|'||coalesce(tractor_plate,'')||'|'||coalesce(trailer_plate,'') from loads l join shipment_items si on si.load_id=l.id where si.shipment_code='SG-02'")" "0002/10/S/2026|15002/2026/OSL/GDA/P|Jan Test|WGM1A6|WWW1A6"
# Renumeracja: SG-A6OLD → SG-A6NEW przez komentarz
L_REN=$(Q "insert into loads (project_id, carrier_org_id, status, plan_load_date, plan_delivery_date)
  values ('$P', '00000000-0000-0000-0000-00000000a003', 'PLANNED', '$D1'::date, '$D2'::date) returning id")
$PSQL -c "insert into shipment_items (project_id, load_id, shipment_code, length_m, width_m, height_m, qty)
  values ('$P', '$L_REN', 'SG-A6OLD', 18, 2.4, 2.4, 1)" >/dev/null
RREN="[{\"code\":\"SG-A6NEW\",\"length_m\":18,\"width_m\":2.4,\"height_m\":2.4,\"qty\":1,\"load_date\":\"$D1\",\"delivery_date\":\"$D2\",\"comment\":\"Wcześniej to był SG-A6OLD\"}]"
val "A6: renumeracja kodu (RPC)" $HHL "select import_schedule('$P', '$RREN'::jsonb, '{}'::text[], '{\"name\":\"a6r.xlsx\",\"hash\":\"a6r\"}'::jsonb, false) is not null" t commit
chk "A6: renumeracja kodu" "$(Q "select shipment_code||'|'||coalesce(renumbered_from,'') from shipment_items where load_id='$L_REN'")" "SG-A6NEW|SG-A6OLD"
chk "A6: stary kod zniknął" "$(Q "select count(*) from shipment_items where project_id='$P' and shipment_code='SG-A6OLD'")" 0
chk "A6: helper komentarza" "$(Q "select public.a6_renumber_from_comment('Wcześniej to był SG-11')")" "SG-11"
# B5: Podgląd blokuje import (assert_not_preview jako pierwsza instrukcja)
run $HHL "select admin_preview_start('KSH')" commit >/dev/null
err "A6 B5: Podgląd — import_schedule odmowa" $HHL "$(IMP '[]' true)" "Podgląd"
run $HHL "select admin_preview_stop()" commit >/dev/null
# skipped_carrier / skipped_empty w stats (p_file)
val "A6: skipped_carrier/empty w stats" $HHL "select (r->>'skipped_carrier')||'/'||(r->>'skipped_empty') from (select import_schedule('$P', '[]'::jsonb, '{}'::text[], '{\"name\":\"sk.xlsx\",\"skipped_carrier\":3,\"skipped_empty\":2,\"skipped_standard\":0}'::jsonb, true) as r) s" "3/2"

# A6/0305: service_role (SharePoint Edge) woła ten sam import_schedule
RSRV="[{\"code\":\"SG-SRV\",\"length_m\":12,\"width_m\":2.5,\"height_m\":2.5,\"qty\":1,\"total_weight_t\":10,\"load_date\":\"$D1\",\"delivery_date\":\"$D2\"}]"
out=$($PSQL -c "begin; set local role service_role; set local request.jwt.claim.role='service_role'; select (import_schedule('$P', '$RSRV'::jsonb, '{}'::text[], '{\"name\":\"sp.xlsx\",\"hash\":\"sp\",\"source\":\"SHAREPOINT\"}'::jsonb, true)->>'rows'); rollback;" 2>&1 | grep -v -E '^(BEGIN|SET|ROLLBACK)$' | tail -1)
if [ "$out" = "1" ]; then ok=$((ok+1)); echo "  OK    A6: service_role dry_run import_schedule"; else fail=$((fail+1)); echo "  FAIL  A6: service_role dry_run → $out"; fi
chk "A6: service_role ma EXECUTE import_schedule" "$(Q "select has_function_privilege('service_role','import_schedule(uuid,jsonb,text[],jsonb,boolean,boolean)','execute')")" t

# A6 F7 #556: uprawnienia sync + source + dedup hash
echo; echo "[A6 F7] ksh_sync + SharePoint source/hash"
chk "A6: authenticated bez EXECUTE ksh_sync_state_upsert" "$(Q "select has_function_privilege('authenticated','ksh_sync_state_upsert(uuid,boolean,timestamptz,timestamptz,jsonb,text,jsonb)','execute')")" f
val "A6: SCX widzi 0 wierszy ksh_sync_state" $SCX "select count(*) from ksh_sync_state" 0
val "A6: KSH widzi 0 wierszy ksh_sync_state" $KSH "select count(*) from ksh_sync_state" 0
$PSQL -c "update app_users set role='HHL_OPS' where auth_id='$HHL'" >/dev/null
err "A6: HHL_OPS ksh_sync_import_set odmowa" $HHL "select ksh_sync_import_set(true)" "Administrator HHL"
err "A6: HHL_OPS ksh_sync_write_set odmowa" $HHL "select ksh_sync_write_set(true)" "Administrator HHL"
$PSQL -c "update app_users set role='HHL_ADMIN' where auth_id='$HHL'" >/dev/null
val "A6: HHL_ADMIN ksh_sync_import_set" $HHL "select ksh_sync_import_set(true); select import_enabled from ksh_sync_state where project_id='$P'" t commit
chk "A6: audit KSH_SYNC_IMPORT_SET" "$(Q "select count(*)>0 from audit_log where action='KSH_SYNC_IMPORT_SET' and entity_id='$P'")" t
val "A6: HHL_ADMIN wyłącza import_enabled" $HHL "select ksh_sync_import_set(false); select import_enabled from ksh_sync_state where project_id='$P'" f commit
run $HHL "select admin_preview_start('KSH')" commit >/dev/null
err "A6: Podgląd — ksh_sync_import_set odmowa" $HHL "select ksh_sync_import_set(true)" "Podgląd"
run $HHL "select admin_preview_stop()" commit >/dev/null
# claim.role=authenticated (nie service) — nadal brama HHL
err "A6: claim authenticated bez HHL — odmowa import" $KSH "set local request.jwt.claim.role='authenticated'; $(IMP '[]' true)" "wyłącznie HHL"
# source SHAREPOINT w schedule_imports + dedup hash po realnym imporcie
RH="[{\"code\":\"SG-HASH\",\"length_m\":12,\"width_m\":2.5,\"height_m\":2.5,\"qty\":1,\"total_weight_t\":10,\"load_date\":\"$D1\",\"delivery_date\":\"$D2\"}]"
SI_BEFORE=$(Q "select count(*) from schedule_imports where project_id='$P'")
out=$($PSQL -c "begin; set local role service_role; set local request.jwt.claim.role='service_role'; select (import_schedule('$P', '$RH'::jsonb, '{}'::text[], '{\"name\":\"h1.xlsx\",\"hash\":\"hash-a6-f7\",\"source\":\"SHAREPOINT\"}'::jsonb, false)->>'version'); commit;" 2>&1 | grep -v -E '^(BEGIN|SET|COMMIT)$' | tail -1)
if [ -n "$out" ] && [ "$out" != "" ]; then ok=$((ok+1)); echo "  OK    A6: service_role zapis SHAREPOINT"; else fail=$((fail+1)); echo "  FAIL  A6: service_role zapis → $out"; fi
chk "A6: source SHAREPOINT w schedule_imports" "$(Q "select source from schedule_imports where file_hash='hash-a6-f7' order by version desc limit 1")" "SHAREPOINT"
$PSQL -c "update ksh_sync_state set source_ok=true, last_run=jsonb_build_object('hash','hash-a6-f7','dry_run',false) where project_id='$P'" >/dev/null
SI_MID=$(Q "select count(*) from schedule_imports where project_id='$P'")
out=$($PSQL -c "begin; set local role service_role; set local request.jwt.claim.role='service_role'; select (import_schedule('$P', '$RH'::jsonb, '{}'::text[], '{\"name\":\"h1.xlsx\",\"hash\":\"hash-a6-f7\",\"source\":\"SHAREPOINT\"}'::jsonb, false)->>'unchanged_file'); commit;" 2>&1 | grep -v -E '^(BEGIN|SET|COMMIT)$' | tail -1)
if [ "$out" = "true" ]; then ok=$((ok+1)); echo "  OK    A6: dedup hash → unchanged_file"; else fail=$((fail+1)); echo "  FAIL  A6: dedup hash → $out"; fi
chk "A6: dedup — bez nowego schedule_imports" "$(Q "select count(*) from schedule_imports where project_id='$P'")" "$SI_MID"
# sanity: przed pierwszym zapisem SharePoint było mniej wierszy
chk "A6: pierwszy SHAREPOINT dodał wersję" "$(Q "select ($SI_MID > $SI_BEFORE)")" t

# A6/0308: kolejka WT→plik (dates_ctx / numery; nie przy import_ctx); F7 5 blokerów
echo; echo "[A6 0308] ksh_sync_outbound"
chk "A6: authenticated bez EXECUTE outbound_enqueue" "$(Q "select has_function_privilege('authenticated','ksh_sync_outbound_enqueue(uuid,jsonb,jsonb)','execute')")" f
chk "A6: authenticated bez EXECUTE outbound_list" "$(Q "select has_function_privilege('authenticated','ksh_sync_outbound_list(uuid,int)','execute')")" f
chk "A6: authenticated bez EXECUTE outbound_ack" "$(Q "select has_function_privilege('authenticated','ksh_sync_outbound_ack(jsonb,text,text)','execute')")" f
chk "A6: authenticated bez EXECUTE l1b_note_file_changed" "$(Q "select has_function_privilege('authenticated','l1b_note_file_changed(uuid,uuid,text,text,int)','execute')")" f
val "A6: SCX widzi 0 outbound" $SCX "select count(*) from ksh_sync_outbound" 0
val "A6: KSH widzi 0 outbound" $KSH "select count(*) from ksh_sync_outbound" 0
$PSQL -c "update app_users set role='HHL_ADMIN' where auth_id='$HHL'" >/dev/null
# F7 r8: kolejka tylko przy write_enabled — najpierw import+write, potem pending → write_set(true) czyści backlog.
SG_OUT=$(Q "select load_id from shipment_items where shipment_code='SG-01' and project_id='$P' limit 1")
CODE_OUT=$(Q "select public.load_sms_code('$SG_OUT')")
$PSQL -c "update ksh_sync_state set snapshot=jsonb_build_object('$CODE_OUT', jsonb_build_object('ld','$D1b','lt',null,'dd','$D2b','dt',null,'co',null,'ho',null)) where project_id='$P'" >/dev/null
$PSQL -c "delete from ksh_sync_outbound where project_id='$P'" >/dev/null
# F7 r2: write_set wymaga import_enabled (tu import wyłączony od testów wyżej)
err "A6: write_set bez importu odmowa" $HHL "select ksh_sync_write_set(true)" "import z pliku"
val "A6: HHL_ADMIN import_set przed write" $HHL "select ksh_sync_import_set(true); select import_enabled from ksh_sync_state where project_id='$P'" t commit
val "A6: HHL_ADMIN write_set true (włącz)" $HHL "select ksh_sync_write_set(true); select write_enabled from ksh_sync_state where project_id='$P'" t commit
$PSQL -c "begin; set local role authenticated; set local request.jwt.claim.sub='$HHL'; update loads set carrier_order_no='PRE-SKIP' where id='$SG_OUT'; commit;" >/dev/null
chk "A6: PRE-SKIP → 1 pending" "$(Q "select count(*) from ksh_sync_outbound where load_id='$SG_OUT' and status='pending'")" 1
val "A6: HHL_ADMIN write_set true (skip pending)" $HHL "select ksh_sync_write_set(true); select write_enabled from ksh_sync_state where project_id='$P'" t commit
chk "A6: write_set true → pending skipped" "$(Q "select count(*) from ksh_sync_outbound where load_id='$SG_OUT' and status='skipped' and last_error='write_enabled_on'")" 1
chk "A6: audit KSH_SYNC_WRITE_SET" "$(Q "select count(*)>0 from audit_log where action='KSH_SYNC_WRITE_SET' and entity_id='$P'")" t
# F7 r8 BLOKER 2: przygotuj pending, potem write_set(false) → skipped write_disabled
$PSQL -c "delete from ksh_sync_outbound where project_id='$P'" >/dev/null
$PSQL -c "begin; set local role authenticated; set local request.jwt.claim.sub='$HHL';
  select ksh_sync_write_set(true);
  update loads set carrier_order_no='WD-PEND' where id='$SG_OUT';
commit;" >/dev/null
val "A6: HHL_ADMIN write_set false" $HHL "select ksh_sync_write_set(false); select write_enabled from ksh_sync_state where project_id='$P'" f commit
chk "A6: write_set false → pending skipped write_disabled" "$(Q "select count(*) from ksh_sync_outbound where load_id='$SG_OUT' and status='skipped' and last_error='write_disabled'")" 1
# F7 r8: write_enabled=false → 0 kolejki; import bierze datę z pliku
$PSQL -c "delete from ksh_sync_outbound where project_id='$P'" >/dev/null
out=$($PSQL -c "begin; set local role authenticated; set local request.jwt.claim.sub='$HHL'; select set_config('tower.dates_ctx','on',true); update loads set plan_load_date=(plan_load_date + 1) where id='$SG_OUT'; select count(*) from ksh_sync_outbound where load_id='$SG_OUT' and status='pending'; rollback;" 2>&1 | grep -v -E '^(BEGIN|SET|ROLLBACK)$' | tail -1)
if [ "$out" = "0" ]; then ok=$((ok+1)); echo "  OK    A6: r8 write off → 0 outbound"; else fail=$((fail+1)); echo "  FAIL  A6: r8 write off → $out"; fi
# F7 r8: write off + WT≠plik (schedule_row też WT) → import bierze datę z pliku
LD_WO=$(Q "select plan_load_date::text from loads where id='$SG_OUT'")
LD_WOF=$(Q "select (plan_load_date + 3)::text from loads where id='$SG_OUT'")
$PSQL -c "begin; set local role authenticated; set local request.jwt.claim.sub='$HHL';
  select set_config('tower.dates_ctx','on',true);
  update loads set plan_load_date='$LD_WOF'::date where id='$SG_OUT';
commit;" >/dev/null 2>&1
# bez write: trigger nie rusza schedule_row — ustaw ręcznie, żeby import widział różnicę vs plik
$PSQL -c "update shipment_items set schedule_row = coalesce(schedule_row,'{}'::jsonb) || jsonb_build_object('load_date','$LD_WOF') where load_id='$SG_OUT' and shipment_code='SG-01'" >/dev/null
chk "A6: r8 write off → nadal 0 pending" "$(Q "select count(*) from ksh_sync_outbound where load_id='$SG_OUT' and status='pending'")" 0
IMP_WO=$(Q "select jsonb_agg(jsonb_build_object(
  'code','SG-01','item_type','Belka','length_m',12,'width_m',2,'height_m',2,
  'unit_weight_t',1,'qty',1,'total_weight_t',1,
  'load_date','$LD_WO','delivery_date',l.plan_delivery_date::text,
  'carrier_order_no',coalesce(l.carrier_order_no,''),'hhl_order_no',coalesce(l.hhl_order_no,''),
  'dates_to_check',false
)) from loads l where l.id='$SG_OUT'")
out=$($PSQL -c "begin; set local role authenticated; set local request.jwt.claim.sub='$HHL';
  select import_schedule('$P','$IMP_WO'::jsonb,'{}'::text[],'{\"source\":\"UPLOAD\"}'::jsonb,false,true);
  reset role;
  select plan_load_date::text from loads where id='$SG_OUT';
commit;" 2>&1 | grep -v -E '^(BEGIN|SET|RESET|COMMIT)$' | tail -1)
if [ "$out" = "$LD_WO" ]; then ok=$((ok+1)); echo "  OK    A6: r8 write off → import bierze datę z pliku"; else fail=$((fail+1)); echo "  FAIL  A6: r8 write off import → $out (oczekiwano $LD_WO)"; fi
chk "A6: r8 write off import → 0 spraw :pending:" "$(Q "select count(*) from decisions where load_id='$SG_OUT' and type_code='TOWER_KSH_CONFLICT' and status in ('NEW','ASSIGNED','SNOOZED') and detail->>'event_key' like '%:pending:%'")" 0
# przywróć write do dalszych testów kolejki
val "A6: HHL_ADMIN write_set true (kolejka)" $HHL "select ksh_sync_write_set(true); select write_enabled from ksh_sync_state where project_id='$P'" t commit
$PSQL -c "delete from ksh_sync_outbound where project_id='$P'" >/dev/null
# dates_ctx → pending; historia dopiero przy done (F7)
out=$($PSQL -c "begin; set local role authenticated; set local request.jwt.claim.sub='$HHL'; select set_config('tower.dates_ctx','on',true); update loads set plan_load_date=(plan_load_date + 1) where id='$SG_OUT'; select count(*) from ksh_sync_outbound where load_id='$SG_OUT' and status='pending'; rollback;" 2>&1 | grep -v -E '^(BEGIN|SET|ROLLBACK)$' | tail -1)
if [ "$out" = "1" ]; then ok=$((ok+1)); echo "  OK    A6: dates_ctx → outbound pending"; else fail=$((fail+1)); echo "  FAIL  A6: dates_ctx → outbound → $out"; fi
out=$($PSQL -c "begin; set local role authenticated; set local request.jwt.claim.sub='$HHL'; create temp table _ev0 as select count(*)::int as n from load_events where load_id='$SG_OUT' and event_type='KSH_FILE_OUTBOUND'; select set_config('tower.dates_ctx','on',true); update loads set plan_load_date=(plan_load_date + 1) where id='$SG_OUT'; select (select count(*) from load_events where load_id='$SG_OUT' and event_type='KSH_FILE_OUTBOUND') - (select n from _ev0); rollback;" 2>&1 | grep -v -E '^(BEGIN|SET|ROLLBACK)$' | tail -1)
if [ "$out" = "0" ]; then ok=$((ok+1)); echo "  OK    A6: dates_ctx → bez KSH_FILE_OUTBOUND"; else fail=$((fail+1)); echo "  FAIL  A6: KSH_FILE_OUTBOUND enqueue → $out"; fi
# delivery_time z plan_delivery_to (Stockholm)
out=$($PSQL -c "begin; set local role authenticated; set local request.jwt.claim.sub='$HHL'; select set_config('tower.dates_ctx','on',true); update loads set plan_delivery_to=('2026-11-05 16:30'::timestamp at time zone 'Europe/Stockholm') where id='$SG_OUT'; select patch->>'delivery_time' from ksh_sync_outbound where load_id='$SG_OUT' and status='pending'; rollback;" 2>&1 | grep -v -E '^(BEGIN|SET|ROLLBACK)$' | tail -1)
if [ "$out" = "16:30" ]; then ok=$((ok+1)); echo "  OK    A6: delivery_time z plan_delivery_to"; else fail=$((fail+1)); echo "  FAIL  A6: delivery_time → $out"; fi
# import_ctx → bez kolejki
out=$($PSQL -c "begin; set local role authenticated; set local request.jwt.claim.sub='$HHL'; select set_config('tower.import_ctx','on',true); update loads set plan_load_date=(plan_load_date + 1), carrier_order_no='IMP-SKIP' where id='$SG_OUT'; select count(*) from ksh_sync_outbound where load_id='$SG_OUT' and status='pending'; rollback;" 2>&1 | grep -v -E '^(BEGIN|SET|ROLLBACK)$' | tail -1)
if [ "$out" = "0" ]; then ok=$((ok+1)); echo "  OK    A6: import_ctx → bez outbound"; else fail=$((fail+1)); echo "  FAIL  A6: import_ctx outbound → $out"; fi
# F7 BLOKER 2: import_schedule zmienia numer → 0 w kolejce
$PSQL -c "delete from ksh_sync_outbound where project_id='$P'" >/dev/null
IMP_NUM=$(Q "select jsonb_agg(jsonb_build_object(
  'code','SG-01','item_type','Belka','length_m',12,'width_m',2,'height_m',2,
  'unit_weight_t',1,'qty',1,'total_weight_t',1,
  'load_date',l.plan_load_date::text,'delivery_date',l.plan_delivery_date::text,
  'carrier_order_no','FROM-FILE','hhl_order_no',coalesce(l.hhl_order_no,''),
  'dates_to_check',false
)) from loads l where l.id='$SG_OUT'")
out=$($PSQL -c "begin; set local role authenticated; set local request.jwt.claim.sub='$HHL'; select (import_schedule('$P','$IMP_NUM'::jsonb,'{}'::text[],'{\"source\":\"UPLOAD\"}'::jsonb,false,true)->>'changed') is not null; select count(*) from ksh_sync_outbound where load_id='$SG_OUT' and status='pending'; rollback;" 2>&1 | grep -v -E '^(BEGIN|SET|ROLLBACK)$' | tail -1)
if [ "$out" = "0" ]; then ok=$((ok+1)); echo "  OK    A6: import numerów → 0 outbound"; else fail=$((fail+1)); echo "  FAIL  A6: import outbound → $out"; fi
# numery bez dates_ctx → pending
out=$($PSQL -c "begin; set local role authenticated; set local request.jwt.claim.sub='$HHL'; update loads set carrier_order_no='HHL-SCAN-1' where id='$SG_OUT'; select count(*) from ksh_sync_outbound where load_id='$SG_OUT' and status='pending' and jsonb_exists(patch,'carrier_order_no'); rollback;" 2>&1 | grep -v -E '^(BEGIN|SET|ROLLBACK)$' | tail -1)
if [ "$out" = "1" ]; then ok=$((ok+1)); echo "  OK    A6: numer → outbound patch"; else fail=$((fail+1)); echo "  FAIL  A6: numer outbound → $out"; fi
# scalanie patch || (dwa UPDATE → jeden pending); bool_and — count(*) + patch bez GROUP BY (Postgres)
out=$($PSQL -c "begin; set local role authenticated; set local request.jwt.claim.sub='$HHL'; update loads set carrier_order_no='A1' where id='$SG_OUT'; update loads set hhl_order_no='B2' where id='$SG_OUT'; select count(*)::text || ':' || coalesce(bool_and(jsonb_exists(patch,'carrier_order_no') and jsonb_exists(patch,'hhl_order_no')), false)::text from ksh_sync_outbound where load_id='$SG_OUT' and status='pending'; rollback;" 2>&1 | grep -v -E '^(BEGIN|SET|ROLLBACK)$' | tail -1)
if [ "$out" = "1:true" ]; then ok=$((ok+1)); echo "  OK    A6: patch|| scalanie pending"; else fail=$((fail+1)); echo "  FAIL  A6: patch|| → $out"; fi
# service_role: sprawa konfliktu + ack
out=$($PSQL -c "begin; set local role service_role; set local request.jwt.claim.role='service_role'; select (l1b_note_file_changed('$P','$SG_OUT','$CODE_OUT','carrier_order_no',1) is not null)::text; rollback;" 2>&1 | grep -v -E '^(BEGIN|SET|ROLLBACK)$' | tail -1)
if [ "$out" = "true" ]; then ok=$((ok+1)); echo "  OK    A6: l1b_note_file_changed"; else fail=$((fail+1)); echo "  FAIL  A6: l1b_note_file_changed → $out"; fi
$PSQL -c "delete from ksh_sync_outbound where project_id='$P'" >/dev/null
OID=$($PSQL -c "begin; set local role authenticated; set local request.jwt.claim.sub='$HHL'; update loads set hhl_order_no='KSH-9' where id='$SG_OUT'; select id from ksh_sync_outbound where load_id='$SG_OUT' and status='pending' order by id desc limit 1; commit;" 2>&1 | grep -v -E '^(BEGIN|SET|COMMIT)$' | tail -1)
OREV=$(Q "select rev from ksh_sync_outbound where id=$OID")
out=$($PSQL -c "begin; set local role service_role; set local request.jwt.claim.role='service_role'; select ksh_sync_outbound_ack(jsonb_build_array(jsonb_build_object('id',$OID,'rev',$OREV)),'conflict','file_changed'); select status from ksh_sync_outbound where id=$OID; commit;" 2>&1 | grep -v -E '^(BEGIN|SET|COMMIT)$' | tail -1)
if [ "$out" = "conflict" ]; then ok=$((ok+1)); echo "  OK    A6: outbound_ack conflict"; else fail=$((fail+1)); echo "  FAIL  A6: outbound_ack → $out"; fi
# F7 BLOKER 4 / N4: ack done → schedule_row z sent + historia
$PSQL -c "delete from ksh_sync_outbound where project_id='$P'" >/dev/null
OID2=$($PSQL -c "begin; set local role authenticated; set local request.jwt.claim.sub='$HHL'; select set_config('tower.dates_ctx','on',true); update loads set plan_load_date=(plan_load_date + 1) where id='$SG_OUT'; select id from ksh_sync_outbound where load_id='$SG_OUT' and status='pending' order by id desc limit 1; commit;" 2>&1 | grep -v -E '^(BEGIN|SET|COMMIT)$' | tail -1)
OREV2=$(Q "select rev from ksh_sync_outbound where id=$OID2")
SENT_LD=$(Q "select patch->>'load_date' from ksh_sync_outbound where id=$OID2")
EV0=$(Q "select count(*) from load_events where load_id='$SG_OUT' and event_type='KSH_FILE_OUTBOUND'")
out=$($PSQL -c "begin; set local role service_role; set local request.jwt.claim.role='service_role'; select ksh_sync_outbound_ack(jsonb_build_array(jsonb_build_object('id',$OID2,'rev',$OREV2,'sent',jsonb_build_object('load_date','$SENT_LD'))),'done',null); select status from ksh_sync_outbound where id=$OID2; commit;" 2>&1 | grep -v -E '^(BEGIN|SET|COMMIT)$' | tail -1)
if [ "$out" = "done" ]; then ok=$((ok+1)); echo "  OK    A6: outbound_ack done"; else fail=$((fail+1)); echo "  FAIL  A6: outbound_ack done → $out"; fi
chk "A6: done → schedule_row load_date" "$(Q "select schedule_row->>'load_date' from shipment_items where load_id='$SG_OUT' and shipment_code='SG-01' limit 1")" "$SENT_LD"
chk "A6: done → KSH_FILE_OUTBOUND" "$(Q "select count(*) - $EV0 from load_events where load_id='$SG_OUT' and event_type='KSH_FILE_OUTBOUND'")" 1
# 42501 / permission denied dla authenticated na ack (brak EXECUTE albo require_service)
out=$($PSQL -c "begin; set local role authenticated; set local request.jwt.claim.sub='$HHL'; select ksh_sync_outbound_ack('[{\"id\":1,\"rev\":1}]'::jsonb,'done',null); rollback;" 2>&1 || true)
if echo "$out" | grep -qiE '42501|permission denied|Tylko synchronizacja'; then ok=$((ok+1)); echo "  OK    A6: ack authenticated → 42501"; else fail=$((fail+1)); echo "  FAIL  A6: ack 42501 → $(echo "$out" | tail -1)"; fi
# F7 r2 BLOKER 4: wartość = migawka pliku → 0 outbound (echo TAKE_FILE)
$PSQL -c "delete from ksh_sync_outbound where project_id='$P'" >/dev/null
CODE_SNAP=$(Q "select public.load_sms_code('$SG_OUT'::uuid)")
$PSQL -c "update ksh_sync_state set snapshot = jsonb_build_object('$CODE_SNAP', jsonb_build_object('ld',null,'lt',null,'dd',null,'dt',null,'co','FROM-FILE','ho','KSH-FILE')) where project_id='$P'" >/dev/null
out=$($PSQL -c "begin; set local role authenticated; set local request.jwt.claim.sub='$HHL'; update loads set carrier_order_no='FROM-FILE', hhl_order_no='KSH-FILE' where id='$SG_OUT'; select count(*) from ksh_sync_outbound where load_id='$SG_OUT' and status='pending'; rollback;" 2>&1 | grep -v -E '^(BEGIN|SET|ROLLBACK)$' | tail -1)
if [ "$out" = "0" ]; then ok=$((ok+1)); echo "  OK    A6: echo migawki → 0 outbound"; else fail=$((fail+1)); echo "  FAIL  A6: echo migawki → $out"; fi
# F7 r2: scalanie zachowuje najstarszą expected_file
$PSQL -c "delete from ksh_sync_outbound where project_id='$P'" >/dev/null
out=$($PSQL -c "begin; set local role service_role; set local request.jwt.claim.role='service_role';
  select ksh_sync_outbound_enqueue('$SG_OUT'::uuid, '{\"carrier_order_no\":\"X1\"}'::jsonb, '{\"co\":\"OLD\"}'::jsonb);
  select ksh_sync_outbound_enqueue('$SG_OUT'::uuid, '{\"hhl_order_no\":\"Y2\"}'::jsonb, '{\"co\":\"NEW\"}'::jsonb);
  select expected_file->>'co' from ksh_sync_outbound where load_id='$SG_OUT' and status='pending';
rollback;" 2>&1 | grep -v -E '^(BEGIN|SET|ROLLBACK)$' | tail -1)
if [ "$out" = "OLD" ]; then ok=$((ok+1)); echo "  OK    A6: expected_file najstarsza"; else fail=$((fail+1)); echo "  FAIL  A6: expected_file → $out"; fi
# F7 r2b N1: A→B→A (powrót do migawki) usuwa klucz z pending
$PSQL -c "delete from ksh_sync_outbound where project_id='$P'" >/dev/null
$PSQL -c "update ksh_sync_state set snapshot = jsonb_build_object('$CODE_SNAP', jsonb_build_object('ld',null,'lt',null,'dd',null,'dt',null,'co','SNAP-A','ho',null)) where project_id='$P'" >/dev/null
$PSQL -c "update loads set carrier_order_no='SNAP-A' where id='$SG_OUT'" >/dev/null
out=$($PSQL -c "begin; set local role authenticated; set local request.jwt.claim.sub='$HHL';
  update loads set carrier_order_no='SNAP-B' where id='$SG_OUT';
  update loads set carrier_order_no='SNAP-A' where id='$SG_OUT';
  select count(*) from ksh_sync_outbound where load_id='$SG_OUT' and status='pending' and jsonb_exists(patch,'carrier_order_no');
rollback;" 2>&1 | grep -v -E '^(BEGIN|SET|ROLLBACK)$' | tail -1)
if [ "$out" = "0" ]; then ok=$((ok+1)); echo "  OK    A6: A→B→A → 0 kluczy pending"; else fail=$((fail+1)); echo "  FAIL  A6: A→B→A → $out"; fi
# kontrola pozytywna A→B → 1 klucz
$PSQL -c "delete from ksh_sync_outbound where project_id='$P'" >/dev/null
out=$($PSQL -c "begin; set local role authenticated; set local request.jwt.claim.sub='$HHL';
  update loads set carrier_order_no='SNAP-B' where id='$SG_OUT';
  select count(*) from ksh_sync_outbound where load_id='$SG_OUT' and status='pending' and jsonb_exists(patch,'carrier_order_no');
rollback;" 2>&1 | grep -v -E '^(BEGIN|SET|ROLLBACK)$' | tail -1)
if [ "$out" = "1" ]; then ok=$((ok+1)); echo "  OK    A6: A→B → 1 klucz pending"; else fail=$((fail+1)); echo "  FAIL  A6: A→B → $out"; fi
# F7 r2b N3: import_set(false) → write_enabled=false + pending skipped
$PSQL -c "delete from ksh_sync_outbound where project_id='$P'" >/dev/null
$PSQL -c "begin; set local role authenticated; set local request.jwt.claim.sub='$HHL';
  select ksh_sync_import_set(true); select ksh_sync_write_set(true);
  update loads set carrier_order_no='PEND-1' where id='$SG_OUT';
commit;" >/dev/null 2>&1
val "A6: import_set false wyłącza write" $HHL "select ksh_sync_import_set(false); select write_enabled from ksh_sync_state where project_id='$P'" f commit
chk "A6: import_set false → pending skipped" "$(Q "select count(*) from ksh_sync_outbound where load_id='$SG_OUT' and status='skipped' and last_error='import_disabled'")" 1
# F7 r8: przywróć import+write — N4+ kolejka tylko przy write_enabled
val "A6: import+write on przed N4" $HHL "select ksh_sync_import_set(true); select ksh_sync_write_set(true); select write_enabled from ksh_sync_state where project_id='$P'" t commit

# F7 r3 N4: list→B→C→ack(stary rev) ⇒ pending C, expected_file.co=B
$PSQL -c "delete from ksh_sync_outbound where project_id='$P'" >/dev/null
$PSQL -c "update ksh_sync_state set snapshot = jsonb_build_object('$CODE_SNAP', jsonb_build_object('ld',null,'lt',null,'dd',null,'dt',null,'co','SNAP-A','ho',null)) where project_id='$P'" >/dev/null
$PSQL -c "update loads set carrier_order_no='SNAP-A' where id='$SG_OUT'" >/dev/null
$PSQL -c "begin; set local role authenticated; set local request.jwt.claim.sub='$HHL';
  update loads set carrier_order_no='SNAP-B' where id='$SG_OUT';
commit;" >/dev/null 2>&1
N4_ID=$(Q "select id from ksh_sync_outbound where load_id='$SG_OUT' and status='pending' order by id desc limit 1")
N4_REV=$(Q "select rev from ksh_sync_outbound where id=$N4_ID")
$PSQL -c "begin; set local role authenticated; set local request.jwt.claim.sub='$HHL';
  update loads set carrier_order_no='SNAP-C' where id='$SG_OUT';
commit;" >/dev/null 2>&1
out=$($PSQL -c "begin; set local role service_role; set local request.jwt.claim.role='service_role';
  select ksh_sync_outbound_ack(jsonb_build_array(jsonb_build_object(
    'id',$N4_ID,'rev',$N4_REV,'sent',jsonb_build_object('carrier_order_no','SNAP-B')
  )),'done',null);
  select status||':'||coalesce(patch->>'carrier_order_no','')||':'||coalesce(expected_file->>'co','')
    from ksh_sync_outbound where id=$N4_ID;
commit;" 2>&1 | grep -v -E '^(BEGIN|SET|COMMIT)$' | tail -1)
if [ "$out" = "pending:SNAP-C:SNAP-B" ]; then ok=$((ok+1)); echo "  OK    A6: N4 B→C ack stary rev → pending C / file B"; else fail=$((fail+1)); echo "  FAIL  A6: N4 B→C → $out"; fi

# F7 r3 N4: list→powrót A (skipped)→ack(stary) ⇒ pending A, expected_file.co=B
$PSQL -c "delete from ksh_sync_outbound where project_id='$P'" >/dev/null
$PSQL -c "update loads set carrier_order_no='SNAP-A' where id='$SG_OUT'" >/dev/null
$PSQL -c "begin; set local role authenticated; set local request.jwt.claim.sub='$HHL';
  update loads set carrier_order_no='SNAP-B' where id='$SG_OUT';
commit;" >/dev/null 2>&1
N4B_ID=$(Q "select id from ksh_sync_outbound where load_id='$SG_OUT' and status='pending' order by id desc limit 1")
N4B_REV=$(Q "select rev from ksh_sync_outbound where id=$N4B_ID")
$PSQL -c "begin; set local role authenticated; set local request.jwt.claim.sub='$HHL';
  update loads set carrier_order_no='SNAP-A' where id='$SG_OUT';
commit;" >/dev/null 2>&1
out=$($PSQL -c "begin; set local role service_role; set local request.jwt.claim.role='service_role';
  select ksh_sync_outbound_ack(jsonb_build_array(jsonb_build_object(
    'id',$N4B_ID,'rev',$N4B_REV,'sent',jsonb_build_object('carrier_order_no','SNAP-B')
  )),'done',null);
  select status||':'||coalesce(patch->>'carrier_order_no','')||':'||coalesce(expected_file->>'co','')
    from ksh_sync_outbound where id=$N4B_ID;
commit;" 2>&1 | grep -v -E '^(BEGIN|SET|COMMIT)$' | tail -1)
if [ "$out" = "pending:SNAP-A:SNAP-B" ]; then ok=$((ok+1)); echo "  OK    A6: N4 powrót A ack → pending A / file B"; else fail=$((fail+1)); echo "  FAIL  A6: N4 powrót A → $out"; fi

# F7 r3 N4: list→bez zmian→ack(zgodny rev) ⇒ done
$PSQL -c "delete from ksh_sync_outbound where project_id='$P'" >/dev/null
$PSQL -c "begin; set local role authenticated; set local request.jwt.claim.sub='$HHL';
  update loads set carrier_order_no='SNAP-OK' where id='$SG_OUT';
commit;" >/dev/null 2>&1
N4C_ID=$(Q "select id from ksh_sync_outbound where load_id='$SG_OUT' and status='pending' order by id desc limit 1")
N4C_REV=$(Q "select rev from ksh_sync_outbound where id=$N4C_ID")
out=$($PSQL -c "begin; set local role service_role; set local request.jwt.claim.role='service_role';
  select ksh_sync_outbound_ack(jsonb_build_array(jsonb_build_object(
    'id',$N4C_ID,'rev',$N4C_REV,'sent',jsonb_build_object('carrier_order_no','SNAP-OK')
  )),'done',null);
  select status from ksh_sync_outbound where id=$N4C_ID;
commit;" 2>&1 | grep -v -E '^(BEGIN|SET|COMMIT)$' | tail -1)
if [ "$out" = "done" ]; then ok=$((ok+1)); echo "  OK    A6: N4 zgodny rev → done"; else fail=$((fail+1)); echo "  FAIL  A6: N4 zgodny rev → $out"; fi

# F7 r4 N5: B→C stary rev → schedule_row=B + historia; import pliku B nie zmienia WT (C)
$PSQL -c "delete from ksh_sync_outbound where project_id='$P'" >/dev/null
$PSQL -c "update ksh_sync_state set snapshot = jsonb_build_object('$CODE_SNAP', jsonb_build_object('ld',null,'lt',null,'dd',null,'dt',null,'co','SNAP-A','ho',null)) where project_id='$P'" >/dev/null
$PSQL -c "update loads set carrier_order_no='SNAP-A' where id='$SG_OUT'" >/dev/null
$PSQL -c "update shipment_items set schedule_row = coalesce(schedule_row,'{}'::jsonb) - 'carrier_order_no' - 'scxOrderNo' where load_id='$SG_OUT'" >/dev/null
$PSQL -c "begin; set local role authenticated; set local request.jwt.claim.sub='$HHL';
  update loads set carrier_order_no='SNAP-B' where id='$SG_OUT';
commit;" >/dev/null 2>&1
N5_ID=$(Q "select id from ksh_sync_outbound where load_id='$SG_OUT' and status='pending' order by id desc limit 1")
N5_REV=$(Q "select rev from ksh_sync_outbound where id=$N5_ID")
$PSQL -c "begin; set local role authenticated; set local request.jwt.claim.sub='$HHL';
  update loads set carrier_order_no='SNAP-C' where id='$SG_OUT';
commit;" >/dev/null 2>&1
EV5=$(Q "select count(*) from load_events where load_id='$SG_OUT' and event_type='KSH_FILE_OUTBOUND'")
# ack jako service_role; odczyt tabel (shipment_items/loads) tylko przez Q (postgres) —
# service_role/authenticated nie mają GRANT SELECT na te tabele.
out=$($PSQL -c "begin; set local role service_role; set local request.jwt.claim.role='service_role';
  select ksh_sync_outbound_ack(jsonb_build_array(jsonb_build_object(
    'id',$N5_ID,'rev',$N5_REV,'sent',jsonb_build_object('carrier_order_no','SNAP-B')
  )),'done',null);
commit;" 2>&1 | grep -v -E '^(BEGIN|SET|COMMIT)$' | tail -1)
out=$(Q "select coalesce((select schedule_row->>'carrier_order_no' from shipment_items where load_id='$SG_OUT' and shipment_code='SG-01' limit 1),'')
  ||':'||(select carrier_order_no from loads where id='$SG_OUT')
  ||':'||coalesce((select patch->>'carrier_order_no' from ksh_sync_outbound where load_id='$SG_OUT' and status='pending' order by id desc limit 1),'')")
if [ "$out" = "SNAP-B:SNAP-C:SNAP-C" ]; then ok=$((ok+1)); echo "  OK    A6: N5 schedule_row B / WT C / pending C"; else fail=$((fail+1)); echo "  FAIL  A6: N5 schedule/WT/pending → $out"; fi
chk "A6: N5 KSH_FILE_OUTBOUND przy rozjeździe" "$(Q "select count(*) - $EV5 from load_events where load_id='$SG_OUT' and event_type='KSH_FILE_OUTBOUND'")" 1
IMP_N5=$(Q "select jsonb_agg(jsonb_build_object(
  'code','SG-01','item_type','Belka','length_m',12,'width_m',2,'height_m',2,
  'unit_weight_t',1,'qty',1,'total_weight_t',1,
  'load_date',l.plan_load_date::text,'delivery_date',l.plan_delivery_date::text,
  'carrier_order_no','SNAP-B','hhl_order_no',coalesce(l.hhl_order_no,''),
  'dates_to_check',false
)) from loads l where l.id='$SG_OUT'")
out=$($PSQL -c "begin; set local role authenticated; set local request.jwt.claim.sub='$HHL';
  select import_schedule('$P','$IMP_N5'::jsonb,'{}'::text[],'{\"source\":\"UPLOAD\"}'::jsonb,false,true);
  reset role;
  select carrier_order_no from loads where id='$SG_OUT';
rollback;" 2>&1 | grep -v -E '^(BEGIN|SET|RESET|ROLLBACK)$' | tail -1)
if [ "$out" = "SNAP-C" ]; then ok=$((ok+1)); echo "  OK    A6: N5 import pliku B nie zmienia WT C"; else fail=$((fail+1)); echo "  FAIL  A6: N5 import → $out"; fi

# F7 r5 N9: N5 stan + driver_name z pliku → driver OK, co zostaje C
$PSQL -c "delete from ksh_sync_outbound where project_id='$P'" >/dev/null
$PSQL -c "update ksh_sync_state set snapshot = jsonb_build_object('$CODE_SNAP', jsonb_build_object('ld',null,'lt',null,'dd',null,'dt',null,'co','SNAP-A','ho',null)) where project_id='$P'" >/dev/null
$PSQL -c "update loads set carrier_order_no='SNAP-A', driver_name='Stary Kierowca' where id='$SG_OUT'" >/dev/null
$PSQL -c "update shipment_items set schedule_row = coalesce(schedule_row,'{}'::jsonb) || jsonb_build_object('carrier_order_no','SNAP-A','driver_name','Stary Kierowca') where load_id='$SG_OUT'" >/dev/null
$PSQL -c "begin; set local role authenticated; set local request.jwt.claim.sub='$HHL';
  update loads set carrier_order_no='SNAP-B' where id='$SG_OUT';
commit;" >/dev/null 2>&1
N9_ID=$(Q "select id from ksh_sync_outbound where load_id='$SG_OUT' and status='pending' order by id desc limit 1")
N9_REV=$(Q "select rev from ksh_sync_outbound where id=$N9_ID")
$PSQL -c "begin; set local role authenticated; set local request.jwt.claim.sub='$HHL';
  update loads set carrier_order_no='SNAP-C' where id='$SG_OUT';
commit;" >/dev/null 2>&1
$PSQL -c "begin; set local role service_role; set local request.jwt.claim.role='service_role';
  select ksh_sync_outbound_ack(jsonb_build_array(jsonb_build_object(
    'id',$N9_ID,'rev',$N9_REV,'sent',jsonb_build_object('carrier_order_no','SNAP-B')
  )),'done',null);
commit;" >/dev/null 2>&1
IMP_N9=$(Q "select jsonb_agg(jsonb_build_object(
  'code','SG-01','item_type','Belka','length_m',12,'width_m',2,'height_m',2,
  'unit_weight_t',1,'qty',1,'total_weight_t',1,
  'load_date',l.plan_load_date::text,'delivery_date',l.plan_delivery_date::text,
  'carrier_order_no','SNAP-B','hhl_order_no',coalesce(l.hhl_order_no,''),
  'driver_name','Nowy Kierowca','dates_to_check',false
)) from loads l where l.id='$SG_OUT'")
out=$($PSQL -c "begin; set local role authenticated; set local request.jwt.claim.sub='$HHL';
  select import_schedule('$P','$IMP_N9'::jsonb,'{}'::text[],'{\"source\":\"UPLOAD\"}'::jsonb,false,true);
  reset role;
  select coalesce(carrier_order_no,'')||'|'||coalesce(driver_name,'') from loads where id='$SG_OUT';
rollback;" 2>&1 | grep -v -E '^(BEGIN|SET|RESET|ROLLBACK)$' | tail -1)
if [ "$out" = "SNAP-C|Nowy Kierowca" ]; then ok=$((ok+1)); echo "  OK    A6: N9 driver z pliku / co zostaje C"; else fail=$((fail+1)); echo "  FAIL  A6: N9 → $out"; fi

# F7 r5 N11: podwójny ack na ścieżce rozjazdu → +1 wpis KSH_FILE_OUTBOUND
# (load_events niemutowalne — bez DELETE; delta jak N5)
$PSQL -c "delete from ksh_sync_outbound where project_id='$P'" >/dev/null
$PSQL -c "update ksh_sync_state set snapshot = jsonb_build_object('$CODE_SNAP', jsonb_build_object('ld',null,'lt',null,'dd',null,'dt',null,'co','SNAP-A','ho',null)) where project_id='$P'" >/dev/null
$PSQL -c "update loads set carrier_order_no='SNAP-A' where id='$SG_OUT'" >/dev/null
$PSQL -c "begin; set local role authenticated; set local request.jwt.claim.sub='$HHL';
  update loads set carrier_order_no='SNAP-B' where id='$SG_OUT';
commit;" >/dev/null 2>&1
N11_ID=$(Q "select id from ksh_sync_outbound where load_id='$SG_OUT' and status='pending' order by id desc limit 1")
N11_REV=$(Q "select rev from ksh_sync_outbound where id=$N11_ID")
$PSQL -c "begin; set local role authenticated; set local request.jwt.claim.sub='$HHL';
  update loads set carrier_order_no='SNAP-C' where id='$SG_OUT';
commit;" >/dev/null 2>&1
EV11=$(Q "select count(*) from load_events where load_id='$SG_OUT' and event_type='KSH_FILE_OUTBOUND'")
$PSQL -c "begin; set local role service_role; set local request.jwt.claim.role='service_role';
  select ksh_sync_outbound_ack(jsonb_build_array(jsonb_build_object(
    'id',$N11_ID,'rev',$N11_REV,'sent',jsonb_build_object('carrier_order_no','SNAP-B')
  )),'done',null);
  select ksh_sync_outbound_ack(jsonb_build_array(jsonb_build_object(
    'id',$N11_ID,'rev',$N11_REV,'sent',jsonb_build_object('carrier_order_no','SNAP-B')
  )),'done',null);
commit;" >/dev/null 2>&1
chk "A6: N11 podwójny ack rozjazd → 1 historia" "$(Q "select count(*) - $EV11 from load_events where load_id='$SG_OUT' and event_type='KSH_FILE_OUTBOUND'")" 1

# F7 r5 N12 + r6 #3: state_upsert nie nadpisuje kluczy z pending patch
$PSQL -c "delete from ksh_sync_outbound where project_id='$P'" >/dev/null
$PSQL -c "update ksh_sync_state set snapshot = jsonb_build_object('$CODE_SNAP', jsonb_build_object('ld',null,'lt',null,'dd',null,'dt',null,'co','SNAP-A','ho',null)) where project_id='$P'" >/dev/null
$PSQL -c "update loads set carrier_order_no='SNAP-A' where id='$SG_OUT'" >/dev/null
$PSQL -c "begin; set local role authenticated; set local request.jwt.claim.sub='$HHL';
  update loads set carrier_order_no='SNAP-C' where id='$SG_OUT';
commit;" >/dev/null 2>&1
# plik=X + ld w snap — co w patch → expected.co zostaje A; ld spoza patch → odświeżone
$PSQL -c "begin; set local role service_role; set local request.jwt.claim.role='service_role';
  select ksh_sync_state_upsert('$P', true, now(), null, '{}'::jsonb, null,
    jsonb_build_object('$CODE_SNAP', jsonb_build_object('ld','2026-11-01','lt',null,'dd',null,'dt',null,'co','SNAP-X','ho',null)));
commit;" >/dev/null 2>&1
chk "A6: N12/r6 expected.co z patch nie nadpisane" "$(Q "select coalesce(expected_file->>'co','')||'|'||coalesce(expected_file->>'ld','') from ksh_sync_outbound where load_id='$SG_OUT' and status='pending' order by id desc limit 1")" "SNAP-A|2026-11-01"
# powrót WT do A przy expected.co=A → reverted (klucz usunięty)
$PSQL -c "begin; set local role authenticated; set local request.jwt.claim.sub='$HHL';
  update loads set carrier_order_no='SNAP-A' where id='$SG_OUT';
commit;" >/dev/null 2>&1
chk "A6: N12 powrót A przy expected A → bez pending co" "$(Q "select count(*) from ksh_sync_outbound where load_id='$SG_OUT' and status='pending' and jsonb_exists(patch,'carrier_order_no')")" 0

# F7 r4 N7: skipped + nowy pending → scal, stary done
# (po N12 snapshot bywa SNAP-X — przywróć A, inaczej B→A nie robi reverted_to_file)
$PSQL -c "delete from ksh_sync_outbound where project_id='$P'" >/dev/null
$PSQL -c "update ksh_sync_state set snapshot = jsonb_build_object('$CODE_SNAP', jsonb_build_object('ld',null,'lt',null,'dd',null,'dt',null,'co','SNAP-A','ho',null)) where project_id='$P'" >/dev/null
$PSQL -c "update loads set carrier_order_no='SNAP-A' where id='$SG_OUT'" >/dev/null
$PSQL -c "begin; set local role authenticated; set local request.jwt.claim.sub='$HHL';
  update loads set carrier_order_no='SNAP-B' where id='$SG_OUT';
commit;" >/dev/null 2>&1
N7_ID=$(Q "select id from ksh_sync_outbound where load_id='$SG_OUT' and status='pending' order by id desc limit 1")
N7_REV=$(Q "select rev from ksh_sync_outbound where id=$N7_ID")
$PSQL -c "begin; set local role authenticated; set local request.jwt.claim.sub='$HHL';
  update loads set carrier_order_no='SNAP-A' where id='$SG_OUT';
commit;" >/dev/null 2>&1
chk "A6: N7 setup skipped reverted" "$(Q "select status||':'||coalesce(last_error,'') from ksh_sync_outbound where id=$N7_ID")" "skipped:reverted_to_file"
$PSQL -c "begin; set local role authenticated; set local request.jwt.claim.sub='$HHL';
  update loads set carrier_order_no='SNAP-D' where id='$SG_OUT';
commit;" >/dev/null 2>&1
N7_NEW=$(Q "select id from ksh_sync_outbound where load_id='$SG_OUT' and status='pending' order by id desc limit 1")
out=$($PSQL -c "begin; set local role service_role; set local request.jwt.claim.role='service_role';
  select ksh_sync_outbound_ack(jsonb_build_array(jsonb_build_object(
    'id',$N7_ID,'rev',$N7_REV,'sent',jsonb_build_object('carrier_order_no','SNAP-B')
  )),'done',null);
  select (select status||':'||coalesce(last_error,'') from ksh_sync_outbound where id=$N7_ID)
    ||'|'||(select status||':'||coalesce(patch->>'carrier_order_no','')||':'||coalesce(expected_file->>'co','') from ksh_sync_outbound where id=$N7_NEW);
commit;" 2>&1 | grep -v -E '^(BEGIN|SET|COMMIT)$' | tail -1)
if [ "$out" = "done:rev_mismatch_merged|pending:SNAP-D:SNAP-B" ]; then ok=$((ok+1)); echo "  OK    A6: N7 scal pending / stary done"; else fail=$((fail+1)); echo "  FAIL  A6: N7 → $out"; fi

# F7 r4 N8: podwójny ack done = no-op (status zostaje done)
$PSQL -c "delete from ksh_sync_outbound where project_id='$P'" >/dev/null
$PSQL -c "begin; set local role authenticated; set local request.jwt.claim.sub='$HHL';
  update loads set carrier_order_no='SNAP-E' where id='$SG_OUT';
commit;" >/dev/null 2>&1
N8_ID=$(Q "select id from ksh_sync_outbound where load_id='$SG_OUT' and status='pending' order by id desc limit 1")
N8_REV=$(Q "select rev from ksh_sync_outbound where id=$N8_ID")
$PSQL -c "begin; set local role service_role; set local request.jwt.claim.role='service_role';
  select ksh_sync_outbound_ack(jsonb_build_array(jsonb_build_object(
    'id',$N8_ID,'rev',$N8_REV,'sent',jsonb_build_object('carrier_order_no','SNAP-E')
  )),'done',null);
commit;" >/dev/null 2>&1
N8_REV2=$(Q "select rev from ksh_sync_outbound where id=$N8_ID")
out=$($PSQL -c "begin; set local role service_role; set local request.jwt.claim.role='service_role';
  select ksh_sync_outbound_ack(jsonb_build_array(jsonb_build_object(
    'id',$N8_ID,'rev',$N8_REV,'sent',jsonb_build_object('carrier_order_no','SNAP-E')
  )),'done',null);
  select status||':'||rev::text from ksh_sync_outbound where id=$N8_ID;
commit;" 2>&1 | grep -v -E '^(BEGIN|SET|COMMIT)$' | tail -1)
if [ "$out" = "done:$N8_REV2" ]; then ok=$((ok+1)); echo "  OK    A6: N8 podwójny ack → done no-op"; else fail=$((fail+1)); echo "  FAIL  A6: N8 → $out (oczekiwano done:$N8_REV2)"; fi

# F7 r6/r7 B1 + 06:08: klucz …:<pole>:pending:<rev>; czyszczenie bez || true; count dokładny.
$PSQL -c "delete from ksh_sync_outbound where project_id='$P'" >/dev/null
$PSQL -c "delete from notifications where load_id='$SG_OUT' and template like 'DECISION%'" >/dev/null
$PSQL -c "delete from decision_events where decision_id in (select id from decisions where type_code='TOWER_KSH_CONFLICT' and load_id='$SG_OUT')" >/dev/null
$PSQL -c "delete from decisions where type_code='TOWER_KSH_CONFLICT' and load_id='$SG_OUT'" >/dev/null
$PSQL -c "update ksh_sync_state set snapshot = jsonb_build_object('$CODE_SNAP', jsonb_build_object('ld',null,'lt',null,'dd',null,'dt',null,'co','SNAP-A','ho',null)) where project_id='$P'" >/dev/null
$PSQL -c "update loads set carrier_order_no='SNAP-A' where id='$SG_OUT'" >/dev/null
$PSQL -c "update shipment_items set schedule_row = coalesce(schedule_row,'{}'::jsonb) || jsonb_build_object('carrier_order_no','SNAP-A') where load_id='$SG_OUT'" >/dev/null
$PSQL -c "begin; set local role authenticated; set local request.jwt.claim.sub='$HHL';
  update loads set carrier_order_no='SNAP-C' where id='$SG_OUT';
commit;" >/dev/null 2>&1
IMP_B1=$(Q "select jsonb_agg(jsonb_build_object(
  'code','SG-01','item_type','Belka','length_m',12,'width_m',2,'height_m',2,
  'unit_weight_t',1,'qty',1,'total_weight_t',1,
  'load_date',l.plan_load_date::text,'delivery_date',l.plan_delivery_date::text,
  'carrier_order_no','SNAP-B','hhl_order_no',coalesce(l.hhl_order_no,''),
  'dates_to_check',false
)) from loads l where l.id='$SG_OUT'")
out=$($PSQL -c "begin; set local role authenticated; set local request.jwt.claim.sub='$HHL';
  select import_schedule('$P','$IMP_B1'::jsonb,'{}'::text[],'{\"source\":\"UPLOAD\"}'::jsonb,false,true);
  reset role;
  select carrier_order_no from loads where id='$SG_OUT';
commit;" 2>&1 | grep -v -E '^(BEGIN|SET|RESET|COMMIT)$' | tail -1)
if [ "$out" = "SNAP-C" ]; then ok=$((ok+1)); echo "  OK    A6: r6 B1 import+konflikt → WT C"; else fail=$((fail+1)); echo "  FAIL  A6: r6 B1 → $out"; fi
chk "A6: r6 B1 sprawa file-changed" "$(Q "select count(*) from decisions where type_code='TOWER_KSH_CONFLICT' and load_id='$SG_OUT' and status in ('NEW','ASSIGNED','SNOOZED') and detail->>'event_key' like '%:pending:%'")" "1"
chk "A6: r6 B1 detail.field=carrier_order_no" "$(Q "select coalesce(detail->>'field','') from decisions where load_id='$SG_OUT' and type_code='TOWER_KSH_CONFLICT' and status in ('NEW','ASSIGNED','SNOOZED') and detail->>'event_key' like '%:pending:%' limit 1")" "carrier_order_no"

# F7 r7: cron SharePoint = p_quiet=false; też 1 sprawa; reset schedule_row (CI 45eeed2c).
$PSQL -c "delete from ksh_sync_outbound where project_id='$P'" >/dev/null
$PSQL -c "delete from notifications where load_id='$SG_OUT' and template like 'DECISION%'" >/dev/null
$PSQL -c "delete from decision_events where decision_id in (select id from decisions where type_code='TOWER_KSH_CONFLICT' and load_id='$SG_OUT')" >/dev/null
$PSQL -c "delete from decisions where type_code='TOWER_KSH_CONFLICT' and load_id='$SG_OUT'" >/dev/null
$PSQL -c "update ksh_sync_state set source_ok=false, last_run='{}'::jsonb,
  snapshot = jsonb_build_object('$CODE_SNAP', jsonb_build_object('ld',null,'lt',null,'dd',null,'dt',null,'co','SNAP-A','ho',null)) where project_id='$P'" >/dev/null
$PSQL -c "update loads set carrier_order_no='SNAP-A' where id='$SG_OUT'" >/dev/null
$PSQL -c "update shipment_items set schedule_row = coalesce(schedule_row,'{}'::jsonb) || jsonb_build_object('carrier_order_no','SNAP-A') where load_id='$SG_OUT'" >/dev/null
$PSQL -c "begin; set local role authenticated; set local request.jwt.claim.sub='$HHL';
  update loads set carrier_order_no='SNAP-C' where id='$SG_OUT';
commit;" >/dev/null 2>&1
IMP_B1S=$(Q "select jsonb_agg(jsonb_build_object(
  'code','SG-01','item_type','Belka','length_m',12,'width_m',2,'height_m',2,
  'unit_weight_t',1,'qty',1,'total_weight_t',1,
  'load_date',l.plan_load_date::text,'delivery_date',l.plan_delivery_date::text,
  'carrier_order_no','SNAP-B','hhl_order_no',coalesce(l.hhl_order_no,''),
  'dates_to_check',false
)) from loads l where l.id='$SG_OUT'")
out=$($PSQL -c "begin; set local role service_role; set local request.jwt.claim.role='service_role';
  select import_schedule('$P','$IMP_B1S'::jsonb,'{}'::text[],'{\"source\":\"SHAREPOINT\",\"name\":\"sp-b1.xlsx\",\"hash\":\"sp-b1-r7b\"}'::jsonb,false,false);
  reset role;
  select carrier_order_no from loads where id='$SG_OUT';
commit;" 2>&1 | grep -v -E '^(BEGIN|SET|RESET|COMMIT)$' | tail -1)
if [ "$out" = "SNAP-C" ]; then ok=$((ok+1)); echo "  OK    A6: r7 B1 SharePoint → WT C"; else fail=$((fail+1)); echo "  FAIL  A6: r7 B1 SharePoint → $out"; fi
chk "A6: r7 B1 SharePoint sprawa file-changed" "$(Q "select count(*) from decisions where type_code='TOWER_KSH_CONFLICT' and load_id='$SG_OUT' and status in ('NEW','ASSIGNED','SNOOZED') and detail->>'event_key' like '%:pending:%'")" "1"
chk "A6: r7 B1 sprawa ma klucz :pending:" "$(Q "select count(*) from decisions where load_id='$SG_OUT' and type_code='TOWER_KSH_CONFLICT' and status in ('NEW','ASSIGNED','SNOOZED') and detail->>'event_key' like '%:pending:%'")" "1"

# F7 06:08: rozwiąż → nowy rev + konflikt → 2. sprawa; ponowny import → nadal 2.
# decision_resolve zwraca wynik efektu (v_fx), nie status — status czytamy z decisions.
DEC_B1R=$(Q "select id from decisions where load_id='$SG_OUT' and type_code='TOWER_KSH_CONFLICT' and status in ('NEW','ASSIGNED','SNOOZED') and detail->>'event_key' like '%:pending:%' limit 1")
out=$($PSQL -c "begin; set local role authenticated; set local request.jwt.claim.sub='$HHL';
  select decision_resolve('$DEC_B1R','KEEP_TOWER',null);
  reset role;
  select status::text from decisions where id='$DEC_B1R';
commit;" 2>&1 | grep -v -E '^(BEGIN|SET|RESET|COMMIT)$' | tail -1)
if [ "$out" = "RESOLVED" ]; then ok=$((ok+1)); echo "  OK    A6: r7 B1 resolve KEEP_TOWER"; else fail=$((fail+1)); echo "  FAIL  A6: r7 B1 resolve → $out"; fi
chk "A6: r7 B1 po resolve 0 otwartych :pending:" "$(Q "select count(*) from decisions where load_id='$SG_OUT' and type_code='TOWER_KSH_CONFLICT' and status in ('NEW','ASSIGNED','SNOOZED') and detail->>'event_key' like '%:pending:%'")" "0"
# nowa zmiana WT (rev++) + plik nadal ≠ expected → 2. sprawa
$PSQL -c "update shipment_items set schedule_row = coalesce(schedule_row,'{}'::jsonb) || jsonb_build_object('carrier_order_no','SNAP-A') where load_id='$SG_OUT'" >/dev/null
$PSQL -c "update ksh_sync_state set snapshot = jsonb_build_object('$CODE_SNAP', jsonb_build_object('ld',null,'lt',null,'dd',null,'dt',null,'co','SNAP-A','ho',null)) where project_id='$P'" >/dev/null
$PSQL -c "begin; set local role authenticated; set local request.jwt.claim.sub='$HHL';
  update loads set carrier_order_no='SNAP-D' where id='$SG_OUT';
commit;" >/dev/null 2>&1
REV_B1=$(Q "select rev from ksh_sync_outbound where load_id='$SG_OUT' and status='pending' order by id desc limit 1")
IMP_B1R=$(Q "select jsonb_agg(jsonb_build_object(
  'code','SG-01','item_type','Belka','length_m',12,'width_m',2,'height_m',2,
  'unit_weight_t',1,'qty',1,'total_weight_t',1,
  'load_date',l.plan_load_date::text,'delivery_date',l.plan_delivery_date::text,
  'carrier_order_no','SNAP-B','hhl_order_no',coalesce(l.hhl_order_no,''),
  'dates_to_check',false
)) from loads l where l.id='$SG_OUT'")
# F7 r8: sam konflikt :pending: nie tworzy schedule_imports (import_id null) — sprawdzaj wynik jsonb + sprawy.
out=$($PSQL -c "begin; set local role authenticated; set local request.jwt.claim.sub='$HHL';
  select (import_schedule('$P','$IMP_B1R'::jsonb,'{}'::text[],'{\"source\":\"UPLOAD\"}'::jsonb,false,true)->>'unchanged') is not null;
commit;" 2>&1 | grep -v -E '^(BEGIN|SET|COMMIT)$' | tail -1)
if [ "$out" = "t" ]; then ok=$((ok+1)); echo "  OK    A6: r7 B1 nowy rev wynik jsonb"; else fail=$((fail+1)); echo "  FAIL  A6: r7 B1 nowy rev → $out"; fi
chk "A6: r7 B1 po nowym rev 2 sprawy :pending:" "$(Q "select count(*) from decisions where load_id='$SG_OUT' and type_code='TOWER_KSH_CONFLICT' and detail->>'event_key' like '%:pending:%'")" "2"
chk "A6: r7 B1 2. sprawa ma rev w kluczu" "$(Q "select count(*) from decisions where load_id='$SG_OUT' and type_code='TOWER_KSH_CONFLICT' and status in ('NEW','ASSIGNED','SNOOZED') and detail->>'event_key' like '%:pending:$REV_B1'")" "1"
# ponowny import bez nowej zmiany WT → nadal 2
$PSQL -c "update shipment_items set schedule_row = coalesce(schedule_row,'{}'::jsonb) || jsonb_build_object('carrier_order_no','SNAP-A') where load_id='$SG_OUT'" >/dev/null
out=$($PSQL -c "begin; set local role authenticated; set local request.jwt.claim.sub='$HHL';
  select (import_schedule('$P','$IMP_B1R'::jsonb,'{}'::text[],'{\"source\":\"UPLOAD\"}'::jsonb,false,true)->>'unchanged') is not null;
commit;" 2>&1 | grep -v -E '^(BEGIN|SET|COMMIT)$' | tail -1)
if [ "$out" = "t" ]; then ok=$((ok+1)); echo "  OK    A6: r7 B1 reimport wynik jsonb"; else fail=$((fail+1)); echo "  FAIL  A6: r7 B1 reimport → $out"; fi
chk "A6: r7 B1 reimport bez zmiany → nadal 2" "$(Q "select count(*) from decisions where load_id='$SG_OUT' and type_code='TOWER_KSH_CONFLICT' and detail->>'event_key' like '%:pending:%'")" "2"

# F7 r6 POPRAWKA 2: pending load_time + data/godzina w pliku → godzina z WT (nie z pliku)
$PSQL -c "delete from ksh_sync_outbound where project_id='$P'" >/dev/null
LD_WT=$(Q "select plan_load_date::text from loads where id='$SG_OUT'")
# ustaw znaną godzinę WT 08:00 Warsaw
$PSQL -c "update loads set plan_load_from = ('$LD_WT 08:00:00'::timestamp at time zone 'Europe/Warsaw'),
  plan_load_to = ('$LD_WT 10:00:00'::timestamp at time zone 'Europe/Warsaw') where id='$SG_OUT'" >/dev/null
$PSQL -c "update ksh_sync_state set snapshot = jsonb_build_object('$CODE_SNAP', jsonb_build_object('ld','$LD_WT','lt','08:00','dd',null,'dt',null,'co',null,'ho',null)) where project_id='$P'" >/dev/null
# load_time w kolejce tylko przy dates_ctx (jak ksh_confirm_dates / edycja dat HHL)
$PSQL -c "begin; set local role authenticated; set local request.jwt.claim.sub='$HHL';
  select set_config('tower.dates_ctx','on',true);
  update loads set plan_load_from = ('$LD_WT 09:00:00'::timestamp at time zone 'Europe/Warsaw') where id='$SG_OUT';
commit;" >/dev/null 2>&1
# plik: nowa data + godzina 14:00 — load_time w pending → nie bierz 14:00; data bez pending → z pliku
LD_NEW=$(Q "select (plan_load_date + 1)::text from loads where id='$SG_OUT'")
IMP_P2=$(Q "select jsonb_agg(jsonb_build_object(
  'code','SG-01','item_type','Belka','length_m',12,'width_m',2,'height_m',2,
  'unit_weight_t',1,'qty',1,'total_weight_t',1,
  'load_date','$LD_NEW','load_time','14:00',
  'delivery_date',l.plan_delivery_date::text,
  'carrier_order_no',coalesce(l.carrier_order_no,''),'hhl_order_no',coalesce(l.hhl_order_no,''),
  'dates_to_check',false
)) from loads l where l.id='$SG_OUT'")
out=$($PSQL -c "begin; set local role authenticated; set local request.jwt.claim.sub='$HHL';
  select import_schedule('$P','$IMP_P2'::jsonb,'{}'::text[],'{\"source\":\"UPLOAD\"}'::jsonb,false,true);
  reset role;
  select plan_load_date::text||'|'||to_char(plan_load_from at time zone 'Europe/Warsaw','HH24:MI')
    from loads where id='$SG_OUT';
rollback;" 2>&1 | grep -v -E '^(BEGIN|SET|RESET|ROLLBACK)$' | tail -1)
if [ "$out" = "$LD_NEW|09:00" ]; then ok=$((ok+1)); echo "  OK    A6: r6 P2 data z pliku / godzina WT"; else fail=$((fail+1)); echo "  FAIL  A6: r6 P2 → $out (oczekiwano $LD_NEW|09:00)"; fi

# F7 r7 N13: pending load_date + inna data w pliku → bez CRITICAL / IN_APP / CHANGED (awizowany).
$PSQL -c "delete from ksh_sync_outbound where project_id='$P'" >/dev/null
LD_N13=$(Q "select plan_load_date::text from loads where id='$SG_OUT'")
LD_N13B=$(Q "select (plan_load_date + 2)::text from loads where id='$SG_OUT'")
# Wyrównaj schedule_row do WT (poza datą), żeby v_fields = tylko load_date.
$PSQL -c "update loads set status='READY',
  plan_load_from = ('$LD_N13 08:00:00'::timestamp at time zone 'Europe/Warsaw'),
  plan_load_to = ('$LD_N13 10:00:00'::timestamp at time zone 'Europe/Warsaw'),
  carrier_org_id=coalesce(carrier_org_id,'00000000-0000-0000-0000-00000000a003'),
  carrier_order_no='N13-CO', hhl_order_no='N13-HO'
  where id='$SG_OUT'" >/dev/null
$PSQL -c "update shipment_items set schedule_row = jsonb_build_object(
  'item_type','Belka','length_m',12,'width_m',2,'height_m',2,'unit_weight_t',1,'qty',1,'total_weight_t',1,
  'load_date','$LD_N13','delivery_date',(select plan_delivery_date::text from loads where id='$SG_OUT'),
  'carrier_order_no','N13-CO','hhl_order_no','N13-HO'
) where load_id='$SG_OUT' and shipment_code='SG-01'" >/dev/null
# snapshot = schedule (żeby update load_date nie mylił echo); potem dopiero dates_ctx → pending
$PSQL -c "delete from ksh_sync_outbound where load_id='$SG_OUT'" >/dev/null
$PSQL -c "update ksh_sync_state set snapshot = jsonb_build_object('$CODE_SNAP', jsonb_build_object('ld','$LD_N13','lt','08:00','dd',null,'dt',null,'co',null,'ho',null)) where project_id='$P'" >/dev/null
$PSQL -c "begin; set local role authenticated; set local request.jwt.claim.sub='$HHL';
  select set_config('tower.dates_ctx','on',true);
  update loads set plan_load_date = '$LD_N13B'::date where id='$SG_OUT';
commit;" >/dev/null 2>&1
N13_CRIT=$(Q "select count(*) from load_events where load_id='$SG_OUT' and event_type='SCHEDULE_DATE_CRITICAL'")
N13_NOTIF=$(Q "select count(*) from notifications where load_id='$SG_OUT' and template='SCHEDULE_DATE_CRITICAL'")
LD_FILE=$(Q "select (plan_load_date + 1)::text from loads where id='$SG_OUT'")
IMP_N13=$(Q "select jsonb_agg(jsonb_build_object(
  'code','SG-01','item_type','Belka','length_m',12,'width_m',2,'height_m',2,
  'unit_weight_t',1,'qty',1,'total_weight_t',1,
  'load_date','$LD_FILE','delivery_date',l.plan_delivery_date::text,
  'carrier_order_no',coalesce(l.carrier_order_no,''),'hhl_order_no',coalesce(l.hhl_order_no,''),
  'dates_to_check',false
)) from loads l where l.id='$SG_OUT'")
out=$($PSQL -c "begin; set local role authenticated; set local request.jwt.claim.sub='$HHL';
  select (r->>'quiet')||'/'||jsonb_array_length(r->'critical')||'/'||jsonb_array_length(r->'changed')
    from import_schedule('$P','$IMP_N13'::jsonb,'{}'::text[],'{\"source\":\"UPLOAD\"}'::jsonb,false,false) r;
rollback;" 2>&1 | grep -v -E '^(BEGIN|SET|ROLLBACK)$' | tail -1)
if [ "$out" = "false/0/0" ]; then ok=$((ok+1)); echo "  OK    A6: r7 N13 brak critical/changed"; else fail=$((fail+1)); echo "  FAIL  A6: r7 N13 → $out (oczekiwano false/0/0)"; fi
chk "A6: r7 N13 0 SCHEDULE_DATE_CRITICAL" "$(Q "select (count(*) - $N13_CRIT)::text from load_events where load_id='$SG_OUT' and event_type='SCHEDULE_DATE_CRITICAL'")" "0"
chk "A6: r7 N13 0 IN_APP CRITICAL" "$(Q "select (count(*) - $N13_NOTIF)::text from notifications where load_id='$SG_OUT' and template='SCHEDULE_DATE_CRITICAL'")" "0"

# F7 r8 POPRAWKA 3: CANCELLED + brak zmian pól → unchanged (nie blocked)
$PSQL -c "delete from ksh_sync_outbound where load_id='$SG_OUT'" >/dev/null
# wyrównaj schedule_row do loads — inaczej v_fields ≠ ∅ → blocked zamiast unchanged
$PSQL -c "update shipment_items si set schedule_row = jsonb_build_object(
  'item_type',coalesce(si.schedule_row->>'item_type','Belka'),
  'length_m',coalesce((si.schedule_row->>'length_m')::numeric,12),
  'width_m',coalesce((si.schedule_row->>'width_m')::numeric,2),
  'height_m',coalesce((si.schedule_row->>'height_m')::numeric,2),
  'unit_weight_t',1,'qty',1,'total_weight_t',1,
  'load_date',l.plan_load_date::text,'delivery_date',l.plan_delivery_date::text,
  'carrier_order_no',coalesce(l.carrier_order_no,''),'hhl_order_no',coalesce(l.hhl_order_no,'')
) from loads l where l.id=si.load_id and si.load_id='$SG_OUT' and si.shipment_code='SG-01'" >/dev/null
$PSQL -c "update loads set status='CANCELLED' where id='$SG_OUT'" >/dev/null
IMP_CAN=$(Q "select jsonb_agg(jsonb_build_object(
  'code','SG-01','item_type',coalesce(si.schedule_row->>'item_type','Belka'),
  'length_m',coalesce((si.schedule_row->>'length_m')::numeric,12),
  'width_m',coalesce((si.schedule_row->>'width_m')::numeric,2),
  'height_m',coalesce((si.schedule_row->>'height_m')::numeric,2),
  'unit_weight_t',1,'qty',1,'total_weight_t',1,
  'load_date',l.plan_load_date::text,'delivery_date',l.plan_delivery_date::text,
  'carrier_order_no',coalesce(l.carrier_order_no,''),'hhl_order_no',coalesce(l.hhl_order_no,''),
  'dates_to_check',false
)) from loads l join shipment_items si on si.load_id=l.id and si.shipment_code='SG-01' where l.id='$SG_OUT'")
# F7 r9 / CI cdc31b6c: inne kody nieobecne w pliku mogą być blocked STATUS — licz tylko SG-01.
out=$($PSQL -c "begin; set local role authenticated; set local request.jwt.claim.sub='$HHL';
  select (r->>'unchanged')||'/'||(
    select count(*)::text from jsonb_array_elements(r->'blocked') b
     where b->>'code'='SG-01' and b->>'reason'='CANCELLED')
    from import_schedule('$P','$IMP_CAN'::jsonb,'{}'::text[],'{\"source\":\"UPLOAD\"}'::jsonb,false,true) r;
rollback;" 2>&1 | grep -v -E '^(BEGIN|SET|ROLLBACK)$' | tail -1)
if [ "$out" = "1/0" ]; then ok=$((ok+1)); echo "  OK    A6: r8 CANCELLED bez zmian → unchanged"; else fail=$((fail+1)); echo "  FAIL  A6: r8 CANCELLED → $out (oczekiwano 1/0)"; fi
$PSQL -c "update loads set status='READY' where id='$SG_OUT'" >/dev/null

# F7 r8 uwagi: pary B1 auth+p_quiet=false oraz service_role+p_quiet=true
val "A6: r8 B1 write on" $HHL "select ksh_sync_write_set(true); select write_enabled from ksh_sync_state where project_id='$P'" t commit
$PSQL -c "delete from ksh_sync_outbound where project_id='$P'" >/dev/null
$PSQL -c "delete from decision_events where decision_id in (select id from decisions where type_code='TOWER_KSH_CONFLICT' and load_id='$SG_OUT')" >/dev/null
$PSQL -c "delete from decisions where type_code='TOWER_KSH_CONFLICT' and load_id='$SG_OUT'" >/dev/null
$PSQL -c "update ksh_sync_state set snapshot = jsonb_build_object('$CODE_SNAP', jsonb_build_object('ld',null,'lt',null,'dd',null,'dt',null,'co','SNAP-A','ho',null)) where project_id='$P'" >/dev/null
$PSQL -c "update loads set carrier_order_no='SNAP-A', status='READY' where id='$SG_OUT'" >/dev/null
$PSQL -c "update shipment_items set schedule_row = coalesce(schedule_row,'{}'::jsonb) || jsonb_build_object('carrier_order_no','SNAP-A') where load_id='$SG_OUT'" >/dev/null
$PSQL -c "begin; set local role authenticated; set local request.jwt.claim.sub='$HHL';
  update loads set carrier_order_no='SNAP-C' where id='$SG_OUT';
commit;" >/dev/null 2>&1
chk "A6: r8 B1 auth setup pending" "$(Q "select count(*) from ksh_sync_outbound where load_id='$SG_OUT' and status='pending' and patch ? 'carrier_order_no'")" 1
IMP_B1P=$(Q "select jsonb_agg(jsonb_build_object(
  'code','SG-01','item_type','Belka','length_m',12,'width_m',2,'height_m',2,
  'unit_weight_t',1,'qty',1,'total_weight_t',1,
  'load_date',l.plan_load_date::text,'delivery_date',l.plan_delivery_date::text,
  'carrier_order_no','SNAP-B','hhl_order_no',coalesce(l.hhl_order_no,''),
  'dates_to_check',false
)) from loads l where l.id='$SG_OUT'")
out=$($PSQL -c "begin; set local role authenticated; set local request.jwt.claim.sub='$HHL';
  select import_schedule('$P','$IMP_B1P'::jsonb,'{}'::text[],'{\"source\":\"UPLOAD\"}'::jsonb,false,false);
  reset role;
  select carrier_order_no from loads where id='$SG_OUT';
commit;" 2>&1 | grep -v -E '^(BEGIN|SET|RESET|COMMIT)$' | tail -1)
if [ "$out" = "SNAP-C" ]; then ok=$((ok+1)); echo "  OK    A6: r8 B1 auth+loud → WT C"; else fail=$((fail+1)); echo "  FAIL  A6: r8 B1 auth+loud → $out"; fi
chk "A6: r8 B1 auth+loud sprawa :pending:" "$(Q "select count(*) from decisions where load_id='$SG_OUT' and type_code='TOWER_KSH_CONFLICT' and status in ('NEW','ASSIGNED','SNOOZED') and detail->>'event_key' like '%:pending:%'")" "1"
$PSQL -c "delete from decision_events where decision_id in (select id from decisions where type_code='TOWER_KSH_CONFLICT' and load_id='$SG_OUT')" >/dev/null
$PSQL -c "delete from decisions where type_code='TOWER_KSH_CONFLICT' and load_id='$SG_OUT'" >/dev/null
$PSQL -c "delete from ksh_sync_outbound where project_id='$P'" >/dev/null
$PSQL -c "update ksh_sync_state set snapshot = jsonb_build_object('$CODE_SNAP', jsonb_build_object('ld',null,'lt',null,'dd',null,'dt',null,'co','SNAP-A','ho',null)), source_ok=false, last_run='{}'::jsonb where project_id='$P'" >/dev/null
$PSQL -c "update loads set carrier_order_no='SNAP-A' where id='$SG_OUT'" >/dev/null
$PSQL -c "update shipment_items set schedule_row = coalesce(schedule_row,'{}'::jsonb) || jsonb_build_object('carrier_order_no','SNAP-A') where load_id='$SG_OUT'" >/dev/null
$PSQL -c "begin; set local role authenticated; set local request.jwt.claim.sub='$HHL';
  update loads set carrier_order_no='SNAP-C' where id='$SG_OUT';
commit;" >/dev/null 2>&1
out=$($PSQL -c "begin; set local role service_role; set local request.jwt.claim.role='service_role';
  select import_schedule('$P','$IMP_B1P'::jsonb,'{}'::text[],'{\"source\":\"SHAREPOINT\"}'::jsonb,false,true);
  reset role;
  select carrier_order_no from loads where id='$SG_OUT';
commit;" 2>&1 | grep -v -E '^(BEGIN|SET|RESET|COMMIT)$' | tail -1)
if [ "$out" = "SNAP-C" ]; then ok=$((ok+1)); echo "  OK    A6: r8 B1 service+quiet → WT C"; else fail=$((fail+1)); echo "  FAIL  A6: r8 B1 service+quiet → $out"; fi
chk "A6: r8 B1 service+quiet sprawa :pending:" "$(Q "select count(*) from decisions where load_id='$SG_OUT' and type_code='TOWER_KSH_CONFLICT' and status in ('NEW','ASSIGNED','SNOOZED') and detail->>'event_key' like '%:pending:%'")" "1"

# #569: 2 kody na jednym loadzie — konflikt w pliku na drugim → 1 sprawa (import + Edge)
echo; echo "[A6 #569] konflikt multi-kod — 1 sprawa"
val "A6: #569 write on" $HHL "select ksh_sync_write_set(true); select write_enabled from ksh_sync_state where project_id='$P'" t commit
$PSQL -c "delete from ksh_sync_outbound where project_id='$P'" >/dev/null
$PSQL -c "delete from decision_events where decision_id in (select id from decisions where type_code='TOWER_KSH_CONFLICT' and load_id='$SG_OUT')" >/dev/null
$PSQL -c "delete from decisions where type_code='TOWER_KSH_CONFLICT' and load_id='$SG_OUT'" >/dev/null
# drugi kod na tym samym transporcie (SG-01 zostaje primary / load_sms_code)
$PSQL -c "insert into shipment_items (project_id, load_id, shipment_code, length_m, width_m, height_m, qty, total_weight_t, item_type, cargo_class, schedule_row)
  select project_id, load_id, 'SG-M2', length_m, width_m, height_m, qty, coalesce(total_weight_t,1), coalesce(item_type,'Belka'), cargo_class,
    coalesce(schedule_row,'{}'::jsonb) || jsonb_build_object('carrier_order_no','SNAP-A')
  from shipment_items where load_id='$SG_OUT' and shipment_code='SG-01'
  on conflict (project_id, shipment_code) do update set
    load_id = excluded.load_id,
    schedule_row = coalesce(shipment_items.schedule_row,'{}'::jsonb) || jsonb_build_object('carrier_order_no','SNAP-A')" >/dev/null
$PSQL -c "update shipment_items set schedule_row = coalesce(schedule_row,'{}'::jsonb) || jsonb_build_object('carrier_order_no','SNAP-A') where load_id='$SG_OUT' and shipment_code in ('SG-01','SG-M2')" >/dev/null
$PSQL -c "update loads set carrier_order_no='SNAP-A', status='READY' where id='$SG_OUT'" >/dev/null
CODE_PRIM=$(Q "select public.load_sms_code('$SG_OUT'::uuid)")
$PSQL -c "update ksh_sync_state set snapshot = jsonb_build_object(
  '$CODE_PRIM', jsonb_build_object('ld',null,'lt',null,'dd',null,'dt',null,'co','SNAP-A','ho',null),
  'SG-M2', jsonb_build_object('ld',null,'lt',null,'dd',null,'dt',null,'co','SNAP-A','ho',null)
) where project_id='$P'" >/dev/null
$PSQL -c "begin; set local role authenticated; set local request.jwt.claim.sub='$HHL';
  update loads set carrier_order_no='SNAP-C' where id='$SG_OUT';
commit;" >/dev/null 2>&1
chk "A6: #569 setup pending + 2 kody" "$(Q "select count(*)||':'||(select count(*) from shipment_items where load_id='$SG_OUT' and shipment_code in ('SG-01','SG-M2')) from ksh_sync_outbound where load_id='$SG_OUT' and status='pending' and patch ? 'carrier_order_no'")" "1:2"
REV569=$(Q "select rev from ksh_sync_outbound where load_id='$SG_OUT' and status='pending' order by id desc limit 1")
# plik: primary bez zmian (SNAP-A); drugi kod zmieniony (SNAP-B) → sprawa z kodem SG-M2
IMP569=$(Q "select jsonb_agg(x.row order by x.ord) from (
  select 1 as ord, jsonb_build_object(
    'code','SG-01','item_type','Belka','length_m',12,'width_m',2,'height_m',2,
    'unit_weight_t',1,'qty',1,'total_weight_t',1,
    'load_date',l.plan_load_date::text,'delivery_date',l.plan_delivery_date::text,
    'carrier_order_no','SNAP-A','hhl_order_no',coalesce(l.hhl_order_no,''),
    'dates_to_check',false
  ) as row from loads l where l.id='$SG_OUT'
  union all
  select 2, jsonb_build_object(
    'code','SG-M2','item_type','Belka','length_m',12,'width_m',2,'height_m',2,
    'unit_weight_t',1,'qty',1,'total_weight_t',1,
    'load_date',l.plan_load_date::text,'delivery_date',l.plan_delivery_date::text,
    'carrier_order_no','SNAP-B','hhl_order_no',coalesce(l.hhl_order_no,''),
    'dates_to_check',false
  ) from loads l where l.id='$SG_OUT'
) x")
out=$($PSQL -c "begin; set local role authenticated; set local request.jwt.claim.sub='$HHL';
  select import_schedule('$P','$IMP569'::jsonb,'{}'::text[],'{\"source\":\"UPLOAD\"}'::jsonb,false,false);
  reset role;
  select carrier_order_no from loads where id='$SG_OUT';
commit;" 2>&1 | grep -v -E '^(BEGIN|SET|RESET|COMMIT)$' | tail -1)
if [ "$out" = "SNAP-C" ]; then ok=$((ok+1)); echo "  OK    A6: #569 import → WT C"; else fail=$((fail+1)); echo "  FAIL  A6: #569 import → $out"; fi
chk "A6: #569 import sprawa kod SG-M2" "$(Q "select count(*)||':'||coalesce(max(detail->>'code'),'') from decisions where load_id='$SG_OUT' and type_code='TOWER_KSH_CONFLICT' and status in ('NEW','ASSIGNED','SNOOZED') and detail->>'event_key' like '%:SG-M2:carrier_order_no:pending:%'")" "1:SG-M2"
chk "A6: #569 import 1 sprawa (nie primary)" "$(Q "select count(*) from decisions where load_id='$SG_OUT' and type_code='TOWER_KSH_CONFLICT' and status in ('NEW','ASSIGNED','SNOOZED') and detail->>'event_key' like '%:pending:%'")" "1"
# Edge: ten sam konflikt → dedup, nadal 1.
# Kod SG-M2 na sztywno: wybór kodu/pola pokrywa test unit pickOutboundConflictNote (#569 / F7 #570).
out=$($PSQL -c "begin; set local role service_role; set local request.jwt.claim.role='service_role';
  select (l1b_note_file_changed('$P','$SG_OUT','SG-M2','carrier_order_no',$REV569) is not null)::text;
commit;" 2>&1 | grep -v -E '^(BEGIN|SET|COMMIT)$' | tail -1)
if [ "$out" = "true" ]; then ok=$((ok+1)); echo "  OK    A6: #569 Edge note SG-M2"; else fail=$((fail+1)); echo "  FAIL  A6: #569 Edge note → $out"; fi
chk "A6: #569 import+Edge → 1 sprawa" "$(Q "select count(*) from decisions where load_id='$SG_OUT' and type_code='TOWER_KSH_CONFLICT' and status in ('NEW','ASSIGNED','SNOOZED') and detail->>'event_key' like '%:pending:%'")" "1"
# stary błąd (primary): osobny klucz — dowód, że Edge musi brać kod z wiersza konfliktu
out=$($PSQL -c "begin; set local role service_role; set local request.jwt.claim.role='service_role';
  select (l1b_note_file_changed('$P','$SG_OUT','$CODE_PRIM','carrier_order_no',$REV569) is not null)::text;
commit;" 2>&1 | grep -v -E '^(BEGIN|SET|COMMIT)$' | tail -1)
if [ "$out" = "true" ]; then ok=$((ok+1)); echo "  OK    A6: #569 primary ≠ konflikt (osobny klucz)"; else fail=$((fail+1)); echo "  FAIL  A6: #569 primary note → $out"; fi
chk "A6: #569 primary dałby 2. sprawę" "$(Q "select count(*) from decisions where load_id='$SG_OUT' and type_code='TOWER_KSH_CONFLICT' and status in ('NEW','ASSIGNED','SNOOZED') and detail->>'event_key' like '%:pending:%'")" "2"

# --- #567 23B F7: lista zmian dry_run (preview) ---
echo; echo "[#567 23B] preview lista zmian"
# F7 pkt 8: prawdziwy import_schedule dry_run → store (changed + added + cancel_candidates).
# Najpierw dry_run z nowym kodem + zmiana daty istniejącego SG-01 (już w bazie po wcześniejszych importach).
SG1=$(Q "select load_id from shipment_items where shipment_code='SG-01' limit 1")
D_NEW=$(Q "select (current_date + 40)::text")
D_DEL=$(Q "select (current_date + 45)::text")
# Wiersz SG-01 ze zmienioną datą + nowy kod PRE-23B + bez SG-02/T-01 → missing; SG-00 zablokowany.
RPRE="[{\"code\":\"SG-01\",\"length_m\":18.21,\"width_m\":2.45,\"height_m\":2.45,\"qty\":7,\"total_weight_t\":20.74,\"load_date\":\"$D_NEW\",\"delivery_date\":\"$D_DEL\"},
       {\"code\":\"PRE-23B\",\"length_m\":10,\"width_m\":2.5,\"height_m\":2.5,\"qty\":1,\"total_weight_t\":5,\"load_date\":\"$D_NEW\",\"delivery_date\":\"$D_DEL\"}]"
out=$($PSQL -c "begin; set local role service_role; set local request.jwt.claim.role='service_role';
  with r as (
    select import_schedule('$P', '$RPRE'::jsonb, '{}'::text[],
      '{\"name\":\"pre23.xlsx\",\"hash\":\"pre23\",\"source\":\"SHAREPOINT\"}'::jsonb, true) as j
  )
  select ksh_sync_preview_store(
    '$P',
    coalesce((select j->'changed' from r), '[]'::jsonb),
    now(), 111, 'pre23',
    coalesce((select j->'added' from r), '[]'::jsonb),
    coalesce((select j->'cancel_candidates' from r), '[]'::jsonb)
  )->>'n';
commit;" 2>&1 | grep -v -E '^(BEGIN|SET|COMMIT)$' | grep -E 'ERROR:|^[0-9]+$' | head -1 | sed 's/^ERROR:  //')
# n >= 1 (changed i/lub added/missing).
if echo "$out" | grep -Eq '^[1-9][0-9]*$'; then ok=$((ok+1)); echo "  OK    #567 23B: preview z import_schedule dry_run n=$out"; else fail=$((fail+1)); echo "  FAIL  #567 23B: preview dry_run → $out"; fi
chk "#567 23B: preview istnieje (bez PII wymaga listy)" \
  "$(Q "select (preview is not null and jsonb_typeof(preview->'changes')='array')::text from ksh_sync_state where project_id='$P'")" "true"
chk "#567 23B: bez PII driver w changes" \
  "$(Q "select (not exists (select 1 from jsonb_array_elements(coalesce(preview->'changes','[]'::jsonb)) e where e->>'field' ~* 'driver|phone|pilot'))::text from ksh_sync_state where project_id='$P'")" "true"
chk "#567 23B: kind added obecny" \
  "$(Q "select bool_or(e->>'kind'='added')::text from jsonb_array_elements(coalesce((select preview->'changes' from ksh_sync_state where project_id='$P'),'[]'::jsonb)) e")" "true"
chk "#567 23B: kind missing obecny" \
  "$(Q "select bool_or(e->>'kind'='missing')::text from jsonb_array_elements(coalesce((select preview->'changes' from ksh_sync_state where project_id='$P'),'[]'::jsonb)) e")" "true"
# F7 r2 pkt 3: konkretny wiersz z prawdziwego dry_run (SG-01 / load_date).
WT_DR=$(Q "select coalesce(plan_load_date::text,'') from loads where id='$SG1'")
chk "#567 23B: dry_run SG-01 load_date wt+file" \
  "$(Q "select (e->>'wt' is not distinct from nullif('$WT_DR','') and e->>'file' = '$D_NEW')::text from jsonb_array_elements(coalesce((select preview->'changes' from ksh_sync_state where project_id='$P'),'[]'::jsonb)) e where e->>'code'='SG-01' and e->>'field'='load_date' limit 1")" "true"
# Pole bez zmian: store z fields=[] → brak wiersza changed dla tego kodu.
out=$($PSQL -c "begin; set local role service_role; set local request.jwt.claim.role='service_role';
  select (ksh_sync_preview_store('$P', '[{\"code\":\"SG-01\",\"load_id\":\"$SG1\",\"fields\":[],\"before\":{},\"after\":{}}]'::jsonb, now(), 1, 'emptyf', '[]'::jsonb, '[]'::jsonb)->'changes')::text;
commit;" 2>&1 | grep -v -E '^(BEGIN|SET|COMMIT)$' | tail -1)
chk "#567 23B: pole bez zmian → brak wiersza" "$out" "[]"
# Ręczny changed: wt z loads (nie before), PII odfiltrowane, pending_write.
WT_LD=$(Q "select coalesce(plan_load_date::text,'') from loads where id='$SG1'")
CHG23='[{"code":"SG-01","load_id":"'"$SG1"'","fields":["load_date","driver_name"],"before":{"load_date":"2099-01-01","driver_name":"X"},"after":{"load_date":"2099-02-02","driver_name":"Y"}}]'
out=$($PSQL -c "begin; set local role service_role; set local request.jwt.claim.role='service_role';
  select ksh_sync_preview_store('$P', '$CHG23'::jsonb, now(), 2, 'wtchk')->>'n';
commit;" 2>&1 | grep -v -E '^(BEGIN|SET|COMMIT)$' | grep -E 'ERROR:|^[0-9]+$' | head -1 | sed 's/^ERROR:  //')
chk "#567 23B: preview_store n=1 (bez PII)" "$out" "1"
chk "#567 23B: wt = bieżące WT (nie before 2099)" \
  "$(Q "select (e->>'wt' is not distinct from nullif('$WT_LD',''))::text from jsonb_array_elements((select preview->'changes' from ksh_sync_state where project_id='$P')) e where e->>'field'='load_date'")" "true"
chk "#567 23B: field_label PL" \
  "$(Q "select bool_or(e->>'field_label'='Data załadunku')::text from jsonb_array_elements(coalesce((select preview->'changes' from ksh_sync_state where project_id='$P'),'[]'::jsonb)) e")" "true"
chk "#567 23B: pending_write false bez kolejki" \
  "$(Q "select bool_and(coalesce(e->>'pending_write','false')='false')::text from jsonb_array_elements(coalesce((select preview->'changes' from ksh_sync_state where project_id='$P'),'[]'::jsonb)) e")" "true"
# Kolejka → pending_write true
$PSQL -c "delete from ksh_sync_outbound where load_id='$SG1' and status='pending';
  insert into ksh_sync_outbound (project_id, load_id, shipment_code, patch, expected_file, status)
  values ('$P', '$SG1', 'SG-01', '{\"load_date\":\"$D_NEW\"}'::jsonb, '{}'::jsonb, 'pending')" >/dev/null
out=$($PSQL -c "begin; set local role service_role; set local request.jwt.claim.role='service_role';
  select (e->>'pending_write') from jsonb_array_elements(
    ksh_sync_preview_store('$P', '$CHG23'::jsonb, now(), 3, 'pend')->'changes'
  ) e where e->>'field'='load_date';
commit;" 2>&1 | grep -v -E '^(BEGIN|SET|COMMIT)$' | tail -1)
chk "#567 23B: pending_write true przy kolejce" "$out" "true"
val "#567 23B: HHL czyta preview" $HHL "select (ksh_sync_preview_get() is not null)" t commit
val "#567 23B: KSH nie czyta preview" $KSH "select ksh_sync_preview_get() is null" "t" commit
chk "#567 23B: authenticated bez EXECUTE preview_store" \
  "$(Q "select has_function_privilege('authenticated','ksh_sync_preview_store(uuid,jsonb,timestamptz,int,text,jsonb,jsonb,jsonb)','execute')")" f
err "#567 23B: authenticated store → 42501" $HHL "select ksh_sync_preview_store('$P','[]'::jsonb)" "42501|Tylko synchronizacja|permission denied"

# F7 r2 pkt 1+5: kilka kodów (#569) — wt z pozycji o tym kodzie; file znormalizowany.
$PSQL -c "update shipment_items set length_m=10 where load_id='$SG1' and shipment_code='SG-01';
  update shipment_items set length_m=20 where load_id='$SG1' and shipment_code='SG-M2'" >/dev/null
CHG_MC='[{"code":"SG-M2","load_id":"'"$SG1"'","fields":["length_m"],"before":{"length_m":"10"},"after":{"length_m":"21"}}]'
out=$($PSQL -c "begin; set local role service_role; set local request.jwt.claim.role='service_role';
  select (e->>'wt')||'|'||(e->>'file') from jsonb_array_elements(
    ksh_sync_preview_store('$P', '$CHG_MC'::jsonb, now(), 4, 'mc')->'changes'
  ) e where e->>'code'='SG-M2' and e->>'field'='length_m';
commit;" 2>&1 | grep -v -E '^(BEGIN|SET|COMMIT)$' | tail -1)
chk "#567 23B: multi-kod wt z SG-M2 + norm file" "$out" "20.00|21.00"

# F7 r2/r3 pkt 2: manual_after_import — użytkownik vs automat (bez user_id).
# audit_log.user_id = app_users.id (FK), nie auth_id.
SI_M2=$(Q "select id::text from shipment_items where load_id='$SG1' and shipment_code='SG-M2' limit 1")
HHL_UID=$(Q "select id::text from app_users where auth_id='$HHL'")
$PSQL -c "insert into audit_log (user_id, action, entity, entity_id, old_value, new_value, created_at)
  values ('$HHL_UID', 'ROW_UPDATE', 'shipment_items', '$SI_M2',
    '{\"length_m\":20}'::jsonb, '{\"length_m\":20.5}'::jsonb, now())" >/dev/null
chk "#567 23B: audit_log user manual powstał" "$(Q "select count(*) from audit_log where entity='shipment_items' and entity_id='$SI_M2' and action='ROW_UPDATE' and user_id='$HHL_UID'")" 1
out=$($PSQL -c "begin; set local role service_role; set local request.jwt.claim.role='service_role';
  select (e->>'manual_after_import') from jsonb_array_elements(
    ksh_sync_preview_store('$P', '$CHG_MC'::jsonb, now(), 5, 'manu')->'changes'
  ) e where e->>'field'='length_m';
commit;" 2>&1 | grep -v -E '^(BEGIN|SET|COMMIT)$' | tail -1)
chk "#567 23B: manual_after_import true (user)" "$out" "true"
$PSQL -c "delete from audit_log where entity='shipment_items' and entity_id='$SI_M2' and action='ROW_UPDATE' and user_id='$HHL_UID';
  insert into audit_log (user_id, action, entity, entity_id, old_value, new_value, created_at)
  values (null, 'ROW_UPDATE', 'shipment_items', '$SI_M2',
    '{\"length_m\":20}'::jsonb, '{\"length_m\":20.5}'::jsonb, now())" >/dev/null
out=$($PSQL -c "begin; set local role service_role; set local request.jwt.claim.role='service_role';
  select (e->>'manual_after_import') from jsonb_array_elements(
    ksh_sync_preview_store('$P', '$CHG_MC'::jsonb, now(), 6, 'auto')->'changes'
  ) e where e->>'field'='length_m';
commit;" 2>&1 | grep -v -E '^(BEGIN|SET|COMMIT)$' | tail -1)
chk "#567 23B: manual_after_import false (automat)" "$out" "false"

# F7 r2 pkt 4: blocked INVOICED → kind missing z etykietą.
BLK='[{"code":"SG-BLK","load_id":"'"$SG1"'","reason":"INVOICED","message":"na fakturze"}]'
out=$($PSQL -c "begin; set local role service_role; set local request.jwt.claim.role='service_role';
  select (e->>'kind')||'|'||(e->>'field_label') from jsonb_array_elements(
    ksh_sync_preview_store('$P', '[]'::jsonb, now(), 7, 'blk', '[]'::jsonb, '[]'::jsonb, '$BLK'::jsonb)->'changes'
  ) e where e->>'code'='SG-BLK';
commit;" 2>&1 | grep -v -E '^(BEGIN|SET|COMMIT)$' | tail -1)
chk "#567 23B: blocked INVOICED → missing" "$out" "missing|Brak w pliku (zablokowany: zafakturowany)"

# --- #583: prev z live WT + tablice PLAT / subset ---
# Fixture jak A6 IMP_N5: Q buduje jsonb z kolumn live (+ patch). Nie wołaj import_live_prev (REVOKE).
# schedule_row=null → prev liczy import_schedule z import_live_prev wewnątrz.
r583_rows() {
  local patch="${1:-{}}"
  Q "select jsonb_build_array(
    jsonb_build_object(
      'code','SG-01',
      'item_type', si.item_type,
      'cargo_class', case when si.cargo_class = 'STANDARD' then 'STANDARD' end,
      'length_m', round(si.length_m, 2),
      'width_m', round(si.width_m, 2),
      'height_m', round(si.height_m, 2),
      'unit_weight_t', round(si.unit_weight_t, 3),
      'qty', si.qty,
      'total_weight_t', round(si.total_weight_t, 3),
      'load_date', l.plan_load_date,
      'load_time', case when l.plan_load_from is null then null
        else to_char(l.plan_load_from at time zone 'Europe/Warsaw', 'HH24:MI') end,
      'delivery_date', l.plan_delivery_date,
      'delivery_time', case when l.plan_delivery_to is null then null
        else to_char(l.plan_delivery_to at time zone 'Europe/Stockholm', 'HH24:MI') end,
      'order_no', l.order_no,
      'assembly_seq', si.assembly_seq,
      'hhl_order_no', l.hhl_order_no,
      'carrier_order_no', l.carrier_order_no,
      'driver_name', l.driver_name,
      'driver_phone', l.driver_phone,
      'driver_delivery_name', l.driver_delivery_name,
      'driver_delivery_phone', l.driver_delivery_phone,
      'tractor_plate', l.tractor_plate,
      'tractor_delivery_plate', l.tractor_delivery_plate,
      'trailer_plate', l.trailer_plate
    ) || ('${patch}')::jsonb
    from loads l
    join shipment_items si on si.load_id = l.id and si.shipment_code = 'SG-01'
   where l.id = '$SG1'
   limit 1" | tr -d '\r'
}
r583_prep() {
  $PSQL -c "update loads set
    hhl_order_no='0035/10/S/2026', carrier_order_no='15035/2026/OSL/GDA/P',
    tractor_plate='WPR6303P', tractor_delivery_plate='ABC123', trailer_plate='WWW999',
    status='READY'
  where id='$SG1';
  update shipment_items set schedule_row = null
  where load_id='$SG1' and shipment_code='SG-01'" >/dev/null
}

r583_prep
R583EQ=$(r583_rows '{}')
out=$($PSQL -v ON_ERROR_STOP=1 -Atq -c "
begin;
set local role authenticated;
set local request.jwt.claim.sub='$HHL';
select jsonb_array_length(r->'changed')||'/'||(r->>'unchanged')
  from (select import_schedule('$P', \$json\$ ${R583EQ} \$json\$::jsonb, '{}'::text[],
        '{\"name\":\"583a.xlsx\",\"hash\":\"583a\"}'::jsonb, true) r) s;
rollback;
" 2>&1 | grep -v -E '^(BEGIN|SET|ROLLBACK)$' | tail -1 | tr -d '\r')
chk "#583: identyczne numery/tablice → changed=0" "$out" "0/1"

r583_prep
R583EQ=$(r583_rows '{}')
out=$($PSQL -v ON_ERROR_STOP=1 -Atq -c "
begin;
set local role authenticated;
set local request.jwt.claim.sub='$HHL';
create temporary table _chg583 as
  select import_schedule('$P', \$json\$ ${R583EQ} \$json\$::jsonb, '{}'::text[],
    '{\"name\":\"583b.xlsx\",\"hash\":\"583b\"}'::jsonb, true)->'changed' as changed;
reset role;
set local role service_role;
set local request.jwt.claim.role='service_role';
select jsonb_array_length(ksh_sync_preview_store('$P', (select changed from _chg583), now(), 8, '583eq')->'changes');
rollback;
" 2>&1 | grep -v -E '^(BEGIN|SET|RESET|ROLLBACK|CREATE)$' | tail -1 | tr -d '\r')
chk "#583: preview bez wierszy gdy WT=plik" "$out" "0"

r583_prep
R583ONE=$(r583_rows '{"trailer_plate":"ZZZ1111"}')
out=$($PSQL -v ON_ERROR_STOP=1 -Atq -c "
begin;
set local role authenticated;
set local request.jwt.claim.sub='$HHL';
select jsonb_array_length(r->'changed')||'/'||coalesce(r->'changed'->0->'fields'->>0,'')
  from (select import_schedule('$P', \$json\$ ${R583ONE} \$json\$::jsonb, '{}'::text[],
        '{\"name\":\"583c.xlsx\",\"hash\":\"583c\"}'::jsonb, true) r) s;
rollback;
" 2>&1 | grep -v -E '^(BEGIN|SET|ROLLBACK)$' | tail -1 | tr -d '\r')
chk "#583: jedna różna tablica → changed=1" "$out" "1/trailer_plate"

r583_prep
R583ONE=$(r583_rows '{"trailer_plate":"ZZZ1111"}')
out=$($PSQL -v ON_ERROR_STOP=1 -Atq -c "
begin;
set local role authenticated;
set local request.jwt.claim.sub='$HHL';
create temporary table _chg583 as
  select import_schedule('$P', \$json\$ ${R583ONE} \$json\$::jsonb, '{}'::text[],
    '{\"name\":\"583d.xlsx\",\"hash\":\"583d\"}'::jsonb, true)->'changed' as changed;
reset role;
set local role service_role;
set local request.jwt.claim.role='service_role';
select jsonb_array_length(ksh_sync_preview_store('$P', (select changed from _chg583), now(), 9, '583one')->'changes');
rollback;
" 2>&1 | grep -v -E '^(BEGIN|SET|RESET|ROLLBACK|CREATE)$' | tail -1 | tr -d '\r')
chk "#583: preview 1 wiersz dla różnej tablicy" "$out" "1"

$PSQL -c "update loads set trailer_plate=null, status='READY' where id='$SG1';
update shipment_items set schedule_row = null where load_id='$SG1' and shipment_code='SG-01'" >/dev/null
R583PLAT=$(r583_rows '{"trailer_plate":"PLAT"}')
out=$($PSQL -v ON_ERROR_STOP=1 -Atq -c "
begin;
set local role authenticated;
set local request.jwt.claim.sub='$HHL';
select coalesce(r->'changed'->0->'skip_reason'->>'trailer_plate','')
  from (select import_schedule('$P', \$json\$ ${R583PLAT} \$json\$::jsonb, '{}'::text[],
        '{\"name\":\"583p.xlsx\",\"hash\":\"583p\"}'::jsonb, true) r) s;
rollback;
" 2>&1 | grep -v -E '^(BEGIN|SET|ROLLBACK)$' | tail -1 | tr -d '\r')
chk "#583: PLAT → skip_reason" "$out" "wartość w pliku nie jest tablicą — pominięta"

$PSQL -c "update loads set trailer_plate=null, status='READY' where id='$SG1';
update shipment_items set schedule_row = null where load_id='$SG1' and shipment_code='SG-01'" >/dev/null
R583PLAT=$(r583_rows '{"trailer_plate":"PLAT"}')
out=$($PSQL -v ON_ERROR_STOP=1 -Atq -c "
begin;
set local role authenticated;
set local request.jwt.claim.sub='$HHL';
select import_schedule('$P', \$json\$ ${R583PLAT} \$json\$::jsonb, '{}'::text[],
  '{\"name\":\"583p2.xlsx\",\"hash\":\"583p2\"}'::jsonb, false);
reset role;
select coalesce(trailer_plate,'∅') from loads where id='$SG1';
rollback;
" 2>&1 | grep -v -E '^(BEGIN|SET|RESET|ROLLBACK)$' | tail -1 | tr -d '\r')
chk "#583: po PLAT trailer_plate nadal null" "$out" "∅"

$PSQL -c "update loads set trailer_plate=null, status='READY' where id='$SG1';
update shipment_items set schedule_row = null where load_id='$SG1' and shipment_code='SG-01'" >/dev/null
R583PLAT=$(r583_rows '{"trailer_plate":"PLAT"}')
out=$($PSQL -v ON_ERROR_STOP=1 -Atq -c "
begin;
set local role authenticated;
set local request.jwt.claim.sub='$HHL';
create temporary table _chg583 as
  select import_schedule('$P', \$json\$ ${R583PLAT} \$json\$::jsonb, '{}'::text[],
    '{\"name\":\"583p3.xlsx\",\"hash\":\"583p3\"}'::jsonb, true)->'changed' as changed;
reset role;
set local role service_role;
set local request.jwt.claim.role='service_role';
select e->>'skip_reason' from jsonb_array_elements(
  ksh_sync_preview_store('$P', (select changed from _chg583), now(), 10, '583plat')->'changes'
) e where e->>'field'='trailer_plate';
rollback;
" 2>&1 | grep -v -E '^(BEGIN|SET|RESET|ROLLBACK|CREATE)$' | tail -1 | tr -d '\r')
chk "#583: preview PLAT ma skip_reason" "$out" "wartość w pliku nie jest tablicą — pominięta"

$PSQL -c "update loads set trailer_plate='WGM 03896 - SEX56N', status='READY' where id='$SG1';
update shipment_items set schedule_row = null where load_id='$SG1' and shipment_code='SG-01'" >/dev/null
R583SUB=$(r583_rows '{"trailer_plate":"WGM03896"}')
out=$($PSQL -v ON_ERROR_STOP=1 -Atq -c "
begin;
set local role authenticated;
set local request.jwt.claim.sub='$HHL';
select jsonb_array_length(r->'changed')
  from (select import_schedule('$P', \$json\$ ${R583SUB} \$json\$::jsonb, '{}'::text[],
        '{\"name\":\"583s.xlsx\",\"hash\":\"583s\"}'::jsonb, true) r) s;
rollback;
" 2>&1 | grep -v -E '^(BEGIN|SET|ROLLBACK)$' | tail -1 | tr -d '\r')
chk "#583: subset tablicy → changed=0" "$out" "0"

$PSQL -c "update loads set trailer_plate='WGM 03896 - SEX56N', status='READY' where id='$SG1';
update shipment_items set schedule_row = null where load_id='$SG1' and shipment_code='SG-01'" >/dev/null
R583SUB=$(r583_rows '{"trailer_plate":"WGM03896"}')
out=$($PSQL -v ON_ERROR_STOP=1 -Atq -c "
begin;
set local role authenticated;
set local request.jwt.claim.sub='$HHL';
select import_schedule('$P', \$json\$ ${R583SUB} \$json\$::jsonb, '{}'::text[],
  '{\"name\":\"583s2.xlsx\",\"hash\":\"583s2\"}'::jsonb, false);
reset role;
select trailer_plate from loads where id='$SG1';
rollback;
" 2>&1 | grep -v -E '^(BEGIN|SET|RESET|ROLLBACK)$' | tail -1 | tr -d '\r')
chk "#583: po subset SEX56N nie skasowane" "$out" "WGM 03896 - SEX56N"

$PSQL -c "update loads set trailer_plate='WGM 03896 - SEX56N', status='READY' where id='$SG1';
update shipment_items set schedule_row = null where load_id='$SG1' and shipment_code='SG-01'" >/dev/null
R583NEW=$(r583_rows '{"trailer_plate":"KR12345"}')
out=$($PSQL -v ON_ERROR_STOP=1 -Atq -c "
begin;
set local role authenticated;
set local request.jwt.claim.sub='$HHL';
select import_schedule('$P', \$json\$ ${R583NEW} \$json\$::jsonb, '{}'::text[],
  '{\"name\":\"583n.xlsx\",\"hash\":\"583n\"}'::jsonb, false);
reset role;
select trailer_plate from loads where id='$SG1';
rollback;
" 2>&1 | grep -v -E '^(BEGIN|SET|RESET|ROLLBACK)$' | tail -1 | tr -d '\r')
chk "#583: nowa tablica zapisana" "$out" "KR12345"

out=$($PSQL -v ON_ERROR_STOP=1 -Atq -c "
begin;
update loads set hhl_order_no='0035/10/S/2026' where id='$SG1';
set local role service_role;
set local request.jwt.claim.role='service_role';
select jsonb_array_length(ksh_sync_preview_store('$P',
  '[{\"code\":\"SG-01\",\"load_id\":\"$SG1\",\"fields\":[\"hhl_order_no\"],\"before\":{\"hhl_order_no\":\"X\"},\"after\":{\"hhl_order_no\":\"0035/10/S/2026\"}}]'::jsonb,
  now(), 11, '583shield')->'changes');
rollback;
" 2>&1 | grep -v -E '^(BEGIN|SET|ROLLBACK|UPDATE)$' | tail -1)
chk "#583: preview_store osłona gdy wt=file" "$out" "0"

chk "#583: anon bez EXECUTE import_live_prev" \
  "$(Q "select has_function_privilege('anon','import_live_prev(uuid,uuid)','execute')")" f
chk "#583: authenticated bez EXECUTE import_live_prev" \
  "$(Q "select has_function_privilege('authenticated','import_live_prev(uuid,uuid)','execute')")" f

echo; echo "WYNIK: $ok OK, $fail FAIL"
