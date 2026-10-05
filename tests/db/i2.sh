#!/usr/bin/env bash
# TOWER — I-2d (0051) ETA v1 w bazie + I-2f (0052) formularz SEFS/BAF dla HHL.
# Czysta baza: atrapa Supabase → migracje → tests/db/seed.sql → scenariusze.
# Użycie: PGADMIN=postgres://postgres@localhost:5433/postgres bash tests/db/i2.sh
set -e
cd "$(git rev-parse --show-toplevel)"
ADMIN=${PGADMIN:-postgres://postgres@localhost:5433/postgres}
. "$(git rev-parse --show-toplevel)/tests/db/local-only.sh"
DB=tower_test_i2; URL="${ADMIN%/*}/$DB"
psql "$ADMIN" -q -c "drop database if exists $DB" -c "create database $DB"
psql "$URL" -q -v ON_ERROR_STOP=1 -f tests/db/supabase_stub.sql
for f in supabase/migrations/*.sql; do psql "$URL" -q -v ON_ERROR_STOP=1 -f "$f" >/dev/null 2>&1 || { echo "MIGRACJA $f: błąd"; exit 1; }; done
psql "$URL" -q -v ON_ERROR_STOP=1 -f tests/db/seed.sql
set +e
PSQL="psql $URL -Atq"
HHL=11111111-0000-0000-0000-000000000001; KSH=11111111-0000-0000-0000-000000000002; SCX=11111111-0000-0000-0000-000000000003
P=22222222-0000-0000-0000-000000000001; L1=33333333-0000-0000-0000-000000000001; L2=33333333-0000-0000-0000-000000000002
ok=0; fail=0
run() { local end="rollback"; [ "$3" = "commit" ] && end="commit"
  $PSQL -v ON_ERROR_STOP=1 -c "begin; set local role authenticated; set local request.jwt.claim.sub='$1'; $2; $end;" 2>&1; }
val() { out=$(run "$2" "$3" "$5" | grep -v -E '^(BEGIN|SET|ROLLBACK|COMMIT)$' | tail -1)
  if [ "$out" = "$4" ]; then ok=$((ok+1)); echo "  OK    $1"; else fail=$((fail+1)); echo "  FAIL  $1  (otrzymano: $out, oczekiwano: $4)"; fi; }
err() { out=$(run "$2" "$3"); if echo "$out" | grep -qiE "$4"; then ok=$((ok+1)); echo "  OK    $1"; else fail=$((fail+1)); echo "  FAIL  $1  →  $(echo "$out" | tail -1)"; fi; }
Q() { $PSQL -c "$1" 2>&1 | tail -1; }
chk() { if [ "$2" = "$3" ]; then ok=$((ok+1)); echo "  OK    $1"; else fail=$((fail+1)); echo "  FAIL  $1  (otrzymano: $2, oczekiwano: $3)"; fi; }
H() { Q "select round(extract(epoch from (eta_site - $2))/3600, 1) from loads where id='$1'"; }   # ETA − punkt odniesienia [h]


# Brama hosted: TOWER_I2_PART=1..N (pusto = cały plik, asercje bez zmian).
_i2_part_ok() { [ -z "${TOWER_I2_PART:-}" ] || [ "${TOWER_I2_PART}" = "$1" ]; }

if _i2_part_ok 1; then
# strefy projektu: załadunek Śrem, terminal Gdańsk, terminal Nynäshamn, plac Boden
if [ "$($PSQL -c "select count(*) from geofences where project_id='$P' and name='KSH Śrem'")" = 0 ]; then
$PSQL -c "insert into geofences (project_id, name, kind, geom, country) values
 ('$P','KSH Śrem','LOADING', make_circle_fence(52.087,17.015,600),'PL'),
 ('$P','Terminal Gdańsk','PORT_OUT', make_circle_fence(54.395,18.668,800),'PL'),
 ('$P','Terminal Nynäshamn','PORT_IN', make_circle_fence(58.9,17.95,800),'SE'),
 ('$P','Plac Boden','SITE', make_circle_fence(65.83,21.69,2000),'SE')" >/dev/null
fi
$PSQL -c "insert into vessels (id, name, operator) values ('55555555-0000-0000-0000-000000000001','Nova Star','Polferries') on conflict (id) do nothing" >/dev/null

echo; echo "[I-2d] ETA v1 — uprawnienia i dostęp"
chk "authenticated/anon: brak EXECUTE compute_load_eta i refresh_load_eta" "$(Q "select has_function_privilege('authenticated','compute_load_eta(uuid,timestamptz)','execute')::text||has_function_privilege('anon','refresh_load_eta(uuid)','execute')::text")" "falsefalse"
chk "parametry odcinków: 9 (FERRY-STATUS: + PL_ROAD_GDY, SE_ROAD_KAA), każdy ze źródłem" "$(Q "select count(*) filter (where length(source)>10) from eta_segment_params")" 9
err "KSH nie zmienia parametrów odcinków" $KSH "update eta_segment_params set hours=1 where code='SE_ROAD'" "permission denied"
val "KSH czyta parametry odcinków" $KSH "select count(*) from eta_segment_params" 9

echo; echo "[D-9] parametry odcinków (0054)"
chk "wartości D-9 + I-15 + FERRY-STATUS: PL 7,5, Gdynia 8,2, Karlskrona 21,5" "$(Q "select string_agg(code||'='||hours::float||'/'||spread_pct::float, ',' order by code) from eta_segment_params where code<>'GPS_FRESH_MIN'")" "CROSSING_DEFAULT=18/15,PL_ROAD=7.5/25,PL_ROAD_GDY=8.2/25,PORT_CHECKIN=3/0,SE_BREAKS=2/50,SE_DAILY_REST=11/0,SE_ROAD=17/20,SE_ROAD_KAA=21.5/20"
chk "źródła: koordynator D-9 ×3, właściciel I-15 ×2" "$(Q "select count(*) filter (where source='szacunek koordynatora 27.09 — do potwierdzenia z SCX (II-3)')||'/'||count(*) filter (where source like 'właściciel 27.09 (I-15)%') from eta_segment_params")" "3/2"

echo; echo "[I-2d] bez pozycji: ETA pusta, nie z planu"
chk "ETA przy wstawieniu bez GPS: pusta, flaga brak pozycji" "$(Q "select (eta_site is not null)::text||'/'||coalesce(eta_basis->'flags'->>0,'') from loads where id='$L2'")" "false/brak pozycji GPS"
chk "przeliczenie z planu nie wpisuje godzin" "$(Q "select coalesce(eta_site::text,'∅') from loads where id='$L2'")" "∅"

echo; echo "[I-2d] rozkład w sailings: bez przypisania — najbliższy rejs jako założenie"
$PSQL -c "insert into sailings (id, project_id, vessel_id, departure_at, arrival_at, source) values
 ('66666666-0000-0000-0000-000000000001','$P','55555555-0000-0000-0000-000000000001', now()+interval '30 hours', now()+interval '48 hours','RECZNIE'),
 ('66666666-0000-0000-0000-000000000002','$P','55555555-0000-0000-0000-000000000001', now()+interval '54 hours', now()+interval '72 hours','RECZNIE')" >/dev/null
$PSQL -c "insert into load_events (load_id, event_type, occurred_at) values ('$L2','NOTE',now())" >/dev/null
chk "zdarzenie bez GPS nie bierze rejsu z planu" "$(Q "select coalesce(eta_site::text,'∅')||'/'||coalesce(eta_basis->>'sailing','') from loads where id='$L2'")" "∅/"
chk "bez pozycji pasmo ETA jest puste" "$(Q "select coalesce(eta_confidence_min::text,'∅') from loads where id='$L2'")" "∅"
chk "basis nie niesie pasma z planu" "$(Q "select coalesce(eta_basis->'band'->>'method','∅')||'/'||(eta_basis->>'plan_eta') from loads where id='$L2'")" "∅/false"
chk "bez pozycji nie ma odcinków SE z planu" "$(Q "select coalesce(jsonb_array_length(eta_basis->'segments')::text,'0') from loads where id='$L2'")" "0"

echo; echo "[I-2d] przypisanie rejsu (HHL) → ETA z przypisanego rejsu"
val "HHL przypisuje rejs 2" $HHL "update loads set sailing_id='66666666-0000-0000-0000-000000000002' where id='$L2' returning 1" 1 commit
chk "przypisany rejs bez GPS nie wypełnia ETA" "$(Q "select coalesce(eta_site::text,'∅') from loads where id='$L2'")" "∅"
chk "pasmo po przypisaniu rejsu nadal puste" "$(Q "select coalesce(eta_confidence_min::text,'∅') from loads where id='$L2'")" "∅"
$PSQL -c "update sailings set delayed_departure_at=departure_at+interval '3 hours', delayed_arrival_at=arrival_at+interval '3 hours', status='OPOZNIONY' where id='66666666-0000-0000-0000-000000000002'" >/dev/null
chk "opóźnienie rejsu w rozkładzie nie jest ETA" "$(Q "select coalesce(eta_site::text,'∅') from loads where id='$L2'")" "∅"

$PSQL -c "set session_replication_role=replica; update loads set hhl_order_no='HHL/2026/1', carrier_order_no='SCX/1', plan_delivery_date=current_date-1, plan_delivery_to=null where id='$L2'; set session_replication_role=origin;" >/dev/null
echo; echo "[I-2d] przewoźnik zmienia status (strażnik nie blokuje przeliczenia), prom"
val "SCX: status FERRY" $SCX "update loads set status='FERRY' where id='$L2' returning status" FERRY commit
chk "FERRY bez AIS: ETA pusta, czeka na AIS, nie z rozkładu" "$(Q "select coalesce(eta_site::text,'∅')||'/'||(eta_basis->>'ferry_eta')||'/'||(eta_basis->>'segment') from loads where id='$L2'")" "∅/waits_for_ais/FERRY"

$PSQL -c "insert into vessel_positions (vessel_id, lat, lon, sog_kn, observed_at, source) values ('55555555-0000-0000-0000-000000000001', 58.0, 18.2, 16, now(), 'DIGITRAFFIC')" >/dev/null
$PSQL -c "select refresh_load_eta('$L2')" >/dev/null
chk "FERRY z AIS: ETA z pozycji statku, nie z rozkładu" "$(Q "select (eta_site is not null)::text||'/'||(eta_basis->>'ferry_eta')||'/'||(eta_basis->>'plan_eta') from loads where id='$L2'")" "true/ais/false"
$PSQL -c "delete from vessel_positions where vessel_id='55555555-0000-0000-0000-000000000001' and source='DIGITRAFFIC'" >/dev/null

echo; echo "[I-2d] odcinek SE: pozycja GPS"
$PSQL -c "set session_replication_role=replica; update loads set status='IN_TRANSIT_SE' where id='$L2'; set session_replication_role=origin;" >/dev/null
# Hosted: enum bez DRIVER_APP (jest DRIVER_PWA). Lokalnie stub może mieć inne etykiety — fallback enum_range.
if [ -n "${TOWER_HOSTED_READY:-}" ]; then
  $PSQL -c "insert into positions (load_id, ts, geom_raw, source) values ('$L2', now(), st_setsrid(st_makepoint(21.0, 63.5),4326), 'DRIVER_PWA')" >/dev/null
else
  $PSQL -c "insert into positions (load_id, ts, geom_raw, source) values ('$L2', now(), st_setsrid(st_makepoint(21.0, 63.5),4326), 'DRIVER_APP')" >/dev/null 2>&1 \
    || $PSQL -c "insert into positions (load_id, ts, geom_raw, source) values ('$L2', now(), st_setsrid(st_makepoint(21.0, 63.5),4326), (enum_range(null::position_source))[1])" >/dev/null
fi
chk "świeża pozycja: flaga GPS (korytarz OSM II-7), pozostało < 18,5 h" "$(Q "select eta_basis->'flags'->>0 from loads where id='$L2'")/$(Q "select (eta_site < now()+interval '18 hours')::text from loads where id='$L2'")" "pozycja GPS — postęp na korytarzu OSM/true"
chk "II-7: method ETA v2 (OSM) + attribution ODbL" "$(Q "select (eta_basis->>'method')||'|'||(eta_basis->>'attribution') from loads where id='$L2'")" "ETA v2 (OSM)|© OpenStreetMap contributors"
$PSQL -c "insert into positions (load_id, ts, geom_raw, source) select '$L2', now()-interval '5 hours', st_setsrid(st_makepoint(20.0, 62.0),4326), source from positions where load_id='$L2' limit 1" >/dev/null
chk "starsza pozycja nie zmienia wyniku (liczy się najnowsza)" "$(Q "select eta_basis->'flags'->>0 from loads where id='$L2'")" "pozycja GPS — postęp na korytarzu OSM"

echo; echo "[I-2d] na placu, rozładunek, anulowanie"
$PSQL -c "insert into load_events (load_id, event_type, occurred_at, payload) values ('$L2','STATUS_AUTO', now()-interval '10 minutes', '{\"to\":\"AT_SITE\"}')" >/dev/null
val "HHL: AT_SITE" $HHL "update loads set status='AT_SITE' where id='$L2' returning status" AT_SITE commit
chk "AT_SITE: ETA = czas wjazdu na plac, pasmo 0" "$(Q "select (abs(extract(epoch from eta_site-(now()-interval '10 minutes')))<120)::text||'/'||eta_confidence_min from loads where id='$L2'")" "true/0"
chk "delay_minutes = max(0, ETA − koniec okna dostawy, a bez okna − koniec dnia dostawy Europe/Stockholm) — SCOPE §57 (0080)" "$(Q "select (delay_minutes is not distinct from greatest(0, round(extract(epoch from eta_site - load_delivery_deadline(plan_delivery_date, plan_delivery_to))/60))::int)::text||'/'||(plan_delivery_date is not null)::text from loads where id='$L2'")" "true/true"
chk "I-25 akceptacja: okno 01.10 08–12, ETA 18:00 → 360 | bez okna, ETA 18:00 w dniu dostawy → 0 | bez okna, ETA 06:00 dnia następnego → 360" "$(Q "select greatest(0, round(extract(epoch from ('2026-10-01 18:00 Europe/Stockholm'::timestamptz - load_delivery_deadline('2026-10-01', '2026-10-01 12:00 Europe/Stockholm')))/60))::int||'|'||greatest(0, round(extract(epoch from ('2026-10-01 18:00 Europe/Stockholm'::timestamptz - load_delivery_deadline('2026-10-01', null)))/60))::int||'|'||greatest(0, round(extract(epoch from ('2026-10-02 06:00 Europe/Stockholm'::timestamptz - load_delivery_deadline('2026-10-01', null)))/60))::int")" "360|0|360"
chk "I-25 bez okna: północ Europe/Stockholm (lato +02, zima +01)" "$(Q "select to_char(load_delivery_deadline('2026-09-30', null) at time zone 'UTC', 'YYYY-MM-DD HH24:MI')||'|'||to_char(load_delivery_deadline('2026-12-26', null) at time zone 'UTC', 'YYYY-MM-DD HH24:MI')")" "2026-09-30 22:00|2026-12-26 23:00"
val "HHL: UNLOADED z datą" $HHL "update loads set status='UNLOADED', actual_delivery_at='2026-10-05 10:00+02' where id='$L2' returning status" UNLOADED commit
chk "UNLOADED: ETA = data rozładunku" "$(Q "select eta_site||'/'||eta_confidence_min from loads where id='$L2'")" "2026-10-05 10:00:00+02/0"
val "HHL anuluje L1 (cancel_load)" $HHL "select cancel_load('$L1','test ETA') is not null" t commit
chk "CANCELLED: ETA NULL, flaga" "$(Q "select coalesce(eta_site::text,'∅')||'/'||(eta_basis->'flags'->>0) from loads where id='$L1'")" "∅/anulowany"

echo; echo "[I-2d] strażnik kontekstu ETA"
err "w kontekście ETA zmiana innej kolumny = wyjątek" $HHL "select set_config('tower.eta_ctx','on',true); update loads set order_no='X' where id='$L1'" "wyłącznie kolumny eta_"
chk "KSH widzi ETA i podstawę (RLS loads)" "$(run $KSH "select count(*) from loads where eta_basis is not null" | grep -E '^[0-9]+$')" 2
chk "rejs odwołany bez pozycji: brak ETA z planu" "$($PSQL -c "insert into loads (id, project_id, carrier_org_id, order_no, sailing_id) values ('33333333-0000-0000-0000-000000000009','$P','00000000-0000-0000-0000-00000000a003','KSH/9','66666666-0000-0000-0000-000000000001')" >/dev/null; $PSQL -c "update sailings set status='ODWOLANY' where id='66666666-0000-0000-0000-000000000001'" >/dev/null; Q "select coalesce(eta_site::text,'∅')||'/'||(eta_basis->'flags'->>0) from loads where id='33333333-0000-0000-0000-000000000009'")" "∅/brak pozycji GPS"

echo; echo "[I-2f] SEFS — uprawnienia"
TIERS='[{"lte":17.4,"mult":0.92},{"lte":19.5,"mult":1.0},{"lte":25,"mult":1.1}]'
PAR="{\"valid_from\":\"2026-10-01\",\"base_sek\":19.47,\"base_pln\":5.698,\"index_sek\":\"OKQ8 GoEasy Diesel B2B\",\"index_pln\":\"ORLEN Ekodiesel hurt\",\"source_url_sek\":\"https://www.okq8.se/foretag/priser/\",\"source_url_pln\":\"https://www.orlen.pl/pl/dla-biznesu/hurtowe-ceny-paliw\",\"cycle\":\"MONTHLY\",\"tiers_sek\":$TIERS,\"tiers_pln\":[{\"lte\":5.0,\"mult\":0.93},{\"lte\":6.0,\"mult\":1.0}],\"agreed_with_carrier\":false,\"note\":\"test\"}"
err "KSH nie zapisuje parametrów" $KSH "select sefs_save_parameters('$P', '$PAR'::jsonb)" "wyłącznie HHL"
err "SCX nie wpisuje odczytu" $SCX "select fuel_add_reading('$P','SEK','2026-09',current_date,19.6,'https://www.okq8.se/')" "wyłącznie HHL"
err "KSH nie czyta dziennika" $KSH "select count(*) from baf_change_log('$P')" "wyłącznie HHL"
val "KSH nie widzi tabel SEFS (RLS)" $KSH "select (select count(*) from sefs_parameters)+(select count(*) from fuel_index_readings)" 0
err "bezpośredni INSERT HHL do sefs_parameters odrzucony (tylko RPC)" $HHL "insert into sefs_parameters (project_id, version, valid_from, base_sek, base_pln, index_sek, index_pln, source_url_sek, source_url_pln, tiers_sek, tiers_pln) values ('$P',99,current_date,1,1,'a','b','https://a','https://b','[]','[]')" "permission denied"
chk "anon: brak EXECUTE na RPC SEFS" "$(Q "select has_function_privilege('anon','sefs_save_parameters(uuid,jsonb)','execute')::text||has_function_privilege('anon','fuel_add_reading(uuid,text,text,date,numeric,text,text,bigint,text)','execute')::text")" "falsefalse"

echo; echo "[I-2f] SEFS — parametry (wersje) i walidacja"
val "HHL zapisuje parametry → wersja 1" $HHL "select sefs_save_parameters('$P', '$PAR'::jsonb)" 1 commit
err "tablica z malejącym progiem odrzucona" $HHL "select sefs_save_parameters('$P', jsonb_set('$PAR'::jsonb, '{tiers_sek}', '[{\"lte\":20,\"mult\":1},{\"lte\":19,\"mult\":1.1}]'))" "rosnąco"
err "mnożnik 3,0 odrzucony" $HHL "select sefs_save_parameters('$P', jsonb_set('$PAR'::jsonb, '{tiers_pln}', '[{\"lte\":5,\"mult\":3}]'))" "0,5–2"
err "adres źródła bez http odrzucony" $HHL "select sefs_save_parameters('$P', jsonb_set('$PAR'::jsonb, '{source_url_sek}', '\"okq8.se\"'))" "source_url_sek_check"
val "zmiana bazy → wersja 2 (nowy wiersz)" $HHL "select sefs_save_parameters('$P', jsonb_set('$PAR'::jsonb, '{base_sek}', '19.9'))" 2 commit
chk "wersje 1 i 2 zostają (append-only), UPDATE odrzucony" "$(Q "select string_agg(version||':'||base_sek, ',' order by version) from sefs_parameters")/$($PSQL -c "update sefs_parameters set base_sek=1" 2>&1 | grep -c 'append-only')" "1:19.4700,2:19.9000/1"

echo; echo "[I-2f] odczyty indeksu ze źródłem i datą, korekty"
val "HHL: odczyt SEK 2026-09" $HHL "select fuel_add_reading('$P','SEK','2026-09',current_date,19.68,'https://www.okq8.se/foretag/priser/','cennik B2B') > 0" t commit
err "drugi odczyt SEK 2026-09 bez korekty odrzucony" $HHL "select fuel_add_reading('$P','SEK','2026-09',current_date,19.7,'https://www.okq8.se/')" "już istnieje"
err "odczyt bez źródła odrzucony" $HHL "select fuel_add_reading('$P','PLN','2026-09',current_date,5.74,'')" "adresu źródła"
err "odczyt z przyszłości odrzucony" $HHL "select fuel_add_reading('$P','PLN','2026-09',current_date+1,5.74,'https://www.orlen.pl/')" "przyszłości"
err "korekta bez powodu odrzucona" $HHL "select fuel_add_reading('$P','SEK','2026-09',current_date,19.7,'https://www.okq8.se/',null,(select max(id) from fuel_index_readings),null)" "powodu"
val "korekta z powodem" $HHL "select fuel_add_reading('$P','SEK','2026-09',current_date,19.71,'https://www.okq8.se/foretag/priser/',null,(select max(id) from fuel_index_readings),'literówka w cenie') > 0" t commit
chk "oryginał zostaje, korekta wskazuje oryginał, DELETE odrzucony" "$(Q "select count(*)||'/'||count(corrects_id) from fuel_index_readings")/$($PSQL -c "delete from fuel_index_readings" 2>&1 | grep -c 'append-only')" "2/1/1"
err "drugi odczyt nadal odrzucony (obowiązuje korekta)" $HHL "select fuel_add_reading('$P','SEK','2026-09',current_date,19.8,'https://www.okq8.se/')" "już istnieje"
val "odczyt tygodniowy (2026-W39) przyjęty" $HHL "select fuel_add_reading('$P','PLN','2026-W39',current_date,5.74,'https://www.orlen.pl/pl/dla-biznesu/hurtowe-ceny-paliw') > 0" t commit

echo; echo "[I-2f] dziennik zmian"
val "HHL: dziennik — 2 wersje parametrów, 2 odczyty, 1 korekta" $HHL "select string_agg(action||'×'||n, ',' order by action) from (select action, count(*) n from baf_change_log('$P') group by action) x" "FUEL_READING_ADD×2,FUEL_READING_CORRECT×1,SEFS_PARAMS_VERSION×2"
val "dziennik: kto i co (e-mail, stara/nowa baza)" $HHL "select actor||' '||(old_value->>'base_sek')||'→'||(new_value->>'base_sek') from baf_change_log('$P') where action='SEFS_PARAMS_VERSION' order by at desc limit 1" "hhl@test 19.4700→19.9000"
val "dziennik korekty: stara i nowa wartość" $HHL "select (old_value->>'value')||'→'||(new_value->>'value')||' '||(new_value->>'correction_reason') from baf_change_log('$P') where action='FUEL_READING_CORRECT'" "19.6800→19.7100 literówka w cenie"
chk "I-14 (0066): jedno źródło dopłaty — baf_definitions, baf_index_values i rate_cards.baf_id usunięte" "$(Q "select (to_regclass('public.baf_definitions') is null and to_regclass('public.baf_index_values') is null and not exists (select 1 from information_schema.columns where table_name='rate_cards' and column_name='baf_id'))::text")" true

echo; echo "[I-13] SEFS applies_to COST|REVENUE|BOTH — kto widzi które wersje (0063, D-10)"
chk "istniejące wersje po migracji: BOTH (domyślnie)" "$(Q "select string_agg(version||':'||applies_to, ',' order by version) from sefs_parameters")" "1:BOTH,2:BOTH"
val "HHL: v3 COST uzgodniona z przewoźnikiem" $HHL "select sefs_save_parameters('$P', '$PAR'::jsonb || '{\"applies_to\":\"COST\",\"agreed_with_carrier\":true,\"agreement_ref\":\"ANEKS 2\"}')" 3 commit
val "HHL: v4 REVENUE" $HHL "select sefs_save_parameters('$P', '$PAR'::jsonb || '{\"applies_to\":\"REVENUE\"}')" 4 commit
val "HHL: v5 COST NIEuzgodniona" $HHL "select sefs_save_parameters('$P', '$PAR'::jsonb || '{\"applies_to\":\"COST\"}')" 5 commit
val "HHL: v6 BOTH uzgodniona (brak applies_to = BOTH)" $HHL "select sefs_save_parameters('$P', '$PAR'::jsonb || '{\"agreed_with_carrier\":true}')" 6 commit
err "nieznany zakres odrzucony" $HHL "select sefs_save_parameters('$P', '$PAR'::jsonb || '{\"applies_to\":\"ALL\"}')" "Zakres wersji"
val "HHL widzi wszystkie wersje" $HHL "select string_agg(version::text, ',' order by version) from sefs_parameters" "1,2,3,4,5,6"
val "przewoźnik: COST i BOTH, tylko uzgodnione (v3, v6)" $SCX "select string_agg(version||':'||applies_to, ',' order by version) from sefs_parameters" "3:COST,6:BOTH"
val "KSH: REVENUE i BOTH (v1, v2, v4, v6), bez COST" $KSH "select string_agg(version||':'||applies_to, ',' order by version) from sefs_parameters" "1:BOTH,2:BOTH,4:REVENUE,6:BOTH"
err "przewoźnik: tylko odczyt (INSERT)" $SCX "insert into sefs_parameters (project_id, version, valid_from, base_sek, base_pln, index_sek, index_pln, source_url_sek, source_url_pln, tiers_sek, tiers_pln) values ('$P',99,current_date,1,1,'a','b','https://a','https://b','[]','[]')" "permission denied"
err "przewoźnik: tylko odczyt (UPDATE)" $SCX "update sefs_parameters set agreed_with_carrier=true where version=5" "permission denied"
err "przewoźnik: zapis przez RPC odrzucony" $SCX "select sefs_save_parameters('$P', '$PAR'::jsonb)" "wyłącznie HHL"
val "konto bez app_users: 0 wersji" 11111111-0000-0000-0000-0000000000ee "select count(*) from sefs_parameters" 0
SCXL=$(Q "select string_agg(quote_literal(id), ',') from loads where carrier_org_id='00000000-0000-0000-0000-00000000a003' and project_id='$P'")
chk "przewoźnik bez transportu w projekcie: 0 wersji" "$($PSQL -c "set session_replication_role=replica; update loads set carrier_org_id=null where id in ($SCXL)" >/dev/null; run $SCX "select count(*) from sefs_parameters" | grep -v -E '^(BEGIN|SET|ROLLBACK|COMMIT)$' | tail -1)" 0
$PSQL -c "set session_replication_role=replica; update loads set carrier_org_id='00000000-0000-0000-0000-00000000a003' where id in ($SCXL)" >/dev/null

echo; echo "[I-12] STD-CLEAN — klasa STANDARD bez stawki (0157; bez nowych kwot)"
RC=77777777-0000-0000-0000-00000000c001; RR=77777777-0000-0000-0000-00000000c002
LS=77777777-0000-0000-0000-0000000000a1; LDM=77777777-0000-0000-0000-0000000000a2; LMX=77777777-0000-0000-0000-0000000000a3
$PSQL -c "insert into rate_cards (id, project_id, side, org_id, valid_from) values ('$RC','$P','COST','00000000-0000-0000-0000-00000000a003',current_date), ('$RR','$P','REVENUE','00000000-0000-0000-0000-00000000a002',current_date);
  insert into rate_rules (rate_card_id, length_from, length_to, width_from, width_to, height_from, height_to, weight_from, weight_to, base_rate, note) values
    ('$RC',0,30,0,5,0,5,0,60,2000,'TEST'), ('$RR',0,30,0,5,0,5,0,60,2600,'TEST');
  insert into loads (id, project_id, order_no) values ('$LS','$P','I12-S'), ('$LDM','$P','I12-D'), ('$LMX','$P','I12-M');
  set session_replication_role=replica; update loads set combo_length_m=18, combo_width_m=2.4, combo_height_m=2.4, combo_weight_t=20 where id='$LDM'; set session_replication_role=origin;
  insert into shipment_items (project_id, load_id, shipment_code, cargo_class, length_m, width_m, height_m) values ('$P','$LS','I12-S1','STANDARD',null,null,null), ('$P','$LS','I12-S2','STANDARD',null,null,null),
    ('$P','$LDM','I12-D1','DIMENSIONED',18,2.4,2.4), ('$P','$LMX','I12-M1','STANDARD',null,null,null), ('$P','$LMX','I12-M2','DIMENSIONED',12,2.4,2.4)" >/dev/null
chk "istniejące pozycje cennika: DIMENSIONED (domyślnie)" "$(Q "select string_agg(distinct cargo_class, ',') from rate_rules")" "DIMENSIONED"
val "STANDARD: brak stawki, base_rate NULL (nie zero)" $HHL "select (r->>'matched')||'/'||(r->>'reason')||'/'||coalesce(r->>'base_rate','∅')||'/'||(r->>'message' like 'Klasa STANDARD jest poza Watch Tower%')::text from (select rate_match('$RC','$LS') r) x" "false/NO_STANDARD_RATE/∅/true"
val "STANDARD nie dobiera przedziału wymiarów" $HHL "select rate_match('$RR','$LS')->>'reason'" NO_STANDARD_RATE
chk "zapis pozycji STANDARD w cenniku odrzucony" "$($PSQL -c "insert into rate_rules (rate_card_id, cargo_class, base_rate, note) values ('$RC','STANDARD',1000,'TEST')" 2>&1 | grep -c rate_rules_cargo_class_check)" 1
val "STANDARD po odrzuceniu pozycji: nadal bez kwoty" $HHL "select coalesce(rate_match('$RR','$LS')->>'base_rate','∅')" "∅"
val "wymiarowy: przedział wymiarów zostaje" $HHL "select (r->>'cargo_class')||'/'||(r->>'base_rate') from (select rate_match('$RC','$LDM') r) x" "DIMENSIONED/2000.00"
val "mieszany z pozycją STANDARD: bez stawki" $HHL "select rate_match('$RC','$LMX')->>'reason'" NO_STANDARD_RATE
chk "brak indeksu jednej pozycji STANDARD" "$(Q "select count(*) from pg_indexes where indexname='rate_rules_one_standard'")" 0
chk "nieznana klasa odrzucona (CHECK)" "$($PSQL -c "insert into rate_rules (rate_card_id, cargo_class, base_rate) values ('$RR','XXL',5)" 2>&1 | grep -c rate_rules_cargo_class_check)" 1
err "KSH: dobór stawki odrzucony" $KSH "select rate_match('$RR','$LS')" "wyłącznie HHL"
err "przewoźnik: dobór stawki odrzucony" $SCX "select rate_match('$RC','$LS')" "wyłącznie HHL"
val "KSH nie widzi cennika (RLS, 0065)" $KSH "select count(*) from rate_rules" 0
$PSQL -c "delete from shipment_items where shipment_code like 'I12-%'; delete from loads where id in ('$LS','$LDM','$LMX'); begin; select set_config('tower.rate_purge','on',true); delete from rate_cards where id in ('$RC','$RR'); commit" >/dev/null

echo; echo "[I-19] formularz cennika HHL — wersje, walidacja, dziennik (0065; stawki TESTOWE, D-1)"
CAR=00000000-0000-0000-0000-00000000a003; CLI=00000000-0000-0000-0000-00000000a002
R1='{"valid_from":"2026-10-01","rules":[{"length_from":0,"length_to":20,"width_from":0,"width_to":3,"height_from":0,"height_to":3,"weight_from":0,"weight_to":40,"base_rate":111},{"length_from":20.01,"length_to":40,"width_from":0,"width_to":3,"height_from":0,"height_to":3,"weight_from":0,"weight_to":40,"base_rate":222}]}'
chk "rate_cards/rate_rules: RLS + polityka tylko HHL" "$(Q "select string_agg(policyname||'='||(qual like '%is_hhl()%')::text, ',' order by policyname) from pg_policies where tablename in ('rate_cards','rate_rules')")" "rate_cards_read=true,rate_rules_read=true"
err "KSH: zapis cennika odrzucony" $KSH "select rate_card_save('$P','REVENUE','$CLI','$R1'::jsonb)" "wyłącznie HHL"
err "przewoźnik: zapis cennika odrzucony" $SCX "select rate_card_save('$P','COST','$CAR','$R1'::jsonb)" "wyłącznie HHL"
err "KSH: brak INSERT do rate_cards" $KSH "insert into rate_cards (project_id, side, org_id, valid_from) values ('$P','COST','$CAR',current_date)" "permission denied"
err "strona COST z organizacją klienta odrzucona" $HHL "select rate_card_save('$P','COST','$CLI','$R1'::jsonb)" "dotyczy przewoźnika"
err "nieznana strona odrzucona" $HHL "select rate_card_save('$P','XXX','$CAR','$R1'::jsonb)" "Strona cennika"
err "brak daty obowiązywania odrzucony" $HHL "select rate_card_save('$P','COST','$CAR','{\"rules\":[{\"cargo_class\":\"STANDARD\",\"base_rate\":1}]}'::jsonb)" "datę obowiązywania"
err "pusty cennik odrzucony" $HHL "select rate_card_save('$P','COST','$CAR','{\"valid_from\":\"2026-10-01\",\"rules\":[]}'::jsonb)" "od 1 do 200"
err "pozycja STANDARD odrzucona" $HHL "select rate_card_save('$P','COST','$CAR','{\"valid_from\":\"2026-10-01\",\"rules\":[{\"cargo_class\":\"STANDARD\",\"base_rate\":1},{\"cargo_class\":\"STANDARD\",\"base_rate\":2}]}'::jsonb)" "poza Watch Tower"
err "ujemna stawka odrzucona" $HHL "select rate_card_save('$P','COST','$CAR','{\"valid_from\":\"2026-10-01\",\"rules\":[{\"cargo_class\":\"STANDARD\",\"base_rate\":-1}]}'::jsonb)" "nieujemną"
err "stawka jako tekst odrzucona" $HHL "select rate_card_save('$P','COST','$CAR','{\"valid_from\":\"2026-10-01\",\"rules\":[{\"cargo_class\":\"STANDARD\",\"base_rate\":\"1\"}]}'::jsonb)" "nieujemną"
err "przedział od > do odrzucony" $HHL "select rate_card_save('$P','COST','$CAR','{\"valid_from\":\"2026-10-01\",\"rules\":[{\"length_from\":30,\"length_to\":20,\"width_from\":0,\"width_to\":3,\"height_from\":0,\"height_to\":3,\"weight_from\":0,\"weight_to\":40,\"base_rate\":1}]}'::jsonb)" "niepoprawny przedział \\(length\\)"
err "brak pola przedziału odrzucony" $HHL "select rate_card_save('$P','COST','$CAR','{\"valid_from\":\"2026-10-01\",\"rules\":[{\"length_from\":0,\"length_to\":20,\"width_from\":0,\"height_from\":0,\"height_to\":3,\"weight_from\":0,\"weight_to\":40,\"base_rate\":1}]}'::jsonb)" "niepoprawny przedział \\(width\\)"
err "przedziały stykające się granicą (włącznie) odrzucone" $HHL "select rate_card_save('$P','COST','$CAR','{\"valid_from\":\"2026-10-01\",\"rules\":[{\"length_from\":0,\"length_to\":20,\"width_from\":0,\"width_to\":3,\"height_from\":0,\"height_to\":3,\"weight_from\":0,\"weight_to\":40,\"base_rate\":1},{\"length_from\":20,\"length_to\":40,\"width_from\":0,\"width_to\":3,\"height_from\":0,\"height_to\":3,\"weight_from\":0,\"weight_to\":40,\"base_rate\":2}]}'::jsonb)" "Pozycje 1 i 2 nakładają się"
val "HHL: wersja 1 kosztu (przewoźnik)" $HHL "select rate_card_save('$P','COST','$CAR','$R1'::jsonb)" 1 commit
val "HHL: przychód (klient) numerowany osobno — wersja 1" $HHL "select rate_card_save('$P','REVENUE','$CLI','$R1'::jsonb)" 1 commit
chk "wersja 1: 2 pozycje, bez klasy STANDARD" "$(Q "select count(*)||'/'||count(*) filter (where r.cargo_class='STANDARD') from rate_rules r join rate_cards c on c.id=r.rate_card_id where c.project_id='$P' and c.side='COST' and c.org_id='$CAR' and c.version=1")" "2/0"
err "wersja 2 bez powodu zmiany odrzucona" $HHL "select rate_card_save('$P','COST','$CAR','$R1'::jsonb)" "wymaga powodu"
R2=$(echo "$R1" | sed 's/"base_rate":222}/"base_rate":223}/; s/{"valid_from"/{"note":"TEST korekta przedziału","valid_from"/')
val "HHL: wersja 2 kosztu z powodem" $HHL "select rate_card_save('$P','COST','$CAR','$R2'::jsonb)" 2 commit
chk "wersja 1 bez zmian (222), wersja 2 = 223" "$(Q "select string_agg(c.version||':'||r.base_rate, ',' order by c.version) from rate_rules r join rate_cards c on c.id=r.rate_card_id where c.project_id='$P' and c.side='COST' and c.org_id='$CAR' and r.base_rate in (222,223)")" "1:222.00,2:223.00"
chk "UPDATE rate_rules zablokowany (tylko dopisywanie)" "$($PSQL -c "update rate_rules set base_rate=1" 2>&1 | grep -c 'tylko do dopisywania')" 1
chk "DELETE rate_cards zablokowany bez tower.rate_purge" "$($PSQL -c "delete from rate_cards where project_id='$P'" 2>&1 | grep -c 'tylko do dopisywania')" 1
val "HHL czyta wersje cennika" $HHL "select count(*) from rate_cards where project_id='$P'" 3
val "przewoźnik nie widzi cennika (RLS)" $SCX "select count(*) from rate_cards" 0
val "dziennik: 3 wpisy RATE_CARD_VERSION" $HHL "select count(*) from rate_card_change_log('$P')" 3
val "dziennik v2: stara i nowa wersja z pozycjami + powód" $HHL "select jsonb_array_length(old_value->'rules')||'/'||jsonb_array_length(new_value->'rules')||'/'||(new_value->>'note') from rate_card_change_log('$P') where entity_id like '%:COST:%:v2'" "2/2/TEST korekta przedziału"
chk "autor wpisu w dzienniku = konto HHL" "$(Q "select count(*) from audit_log a join app_users u on u.id=a.user_id where a.action='RATE_CARD_VERSION' and u.auth_id='$HHL'")" 3
err "KSH: dziennik cennika odrzucony" $KSH "select count(*) from rate_card_change_log('$P')" "wyłącznie HHL"
LI19=77777777-0000-0000-0000-0000000000b1
$PSQL -c "insert into loads (id, project_id, order_no) values ('$LI19','$P','I19-S'); insert into shipment_items (project_id, load_id, shipment_code, cargo_class) values ('$P','$LI19','I19-S1','STANDARD')" >/dev/null
val "rate_match: ładunek STANDARD bez stawki" $HHL "select coalesce(rate_match((select id from rate_cards where project_id='$P' and side='COST' and org_id='$CAR' and version=2), '$LI19')->>'base_rate','∅')||'/'||(rate_match((select id from rate_cards where project_id='$P' and side='COST' and org_id='$CAR' and version=2), '$LI19')->>'reason')" "∅/NO_STANDARD_RATE"
$PSQL -c "delete from shipment_items where shipment_code like 'I19-%'; delete from loads where id='$LI19'; delete from audit_log where action='RATE_CARD_VERSION'; begin; select set_config('tower.rate_purge','on',true); delete from rate_cards where project_id='$P'; commit" >/dev/null
chk "sprzątanie testu (tower.rate_purge): 0 cenników" "$(Q "select count(*) from rate_cards")" 0

fi # tower-i2-part 1

if _i2_part_ok 2; then
echo; echo "[I-2j] pozycje promów z AIS (vessel_positions, 0053)"
# Część 2 osobno: statek i pierwszą pozycję GPS wstawia tylko część 1. seed.sql ich nie ma.
# Bez statku insert vessel_positions odpada (FK). Bez wiersza w positions kopia source (limit 1) wstawia 0 wierszy.
$PSQL -c "insert into vessels (id, name, operator) values ('55555555-0000-0000-0000-000000000001','Nova Star','Polferries') on conflict (id) do nothing" >/dev/null
$PSQL -c "set session_replication_role=replica; update loads set status='IN_TRANSIT_SE' where id='$L2'; set session_replication_role=origin;" >/dev/null
if [ -n "${TOWER_HOSTED_READY:-}" ]; then
  $PSQL -c "insert into positions (load_id, ts, geom_raw, source) values ('$L2', now(), st_setsrid(st_makepoint(21.0, 63.5),4326), 'DRIVER_PWA')" >/dev/null
else
  $PSQL -c "insert into positions (load_id, ts, geom_raw, source) values ('$L2', now(), st_setsrid(st_makepoint(21.0, 63.5),4326), 'DRIVER_APP')" >/dev/null 2>&1 \
    || $PSQL -c "insert into positions (load_id, ts, geom_raw, source) values ('$L2', now(), st_setsrid(st_makepoint(21.0, 63.5),4326), (enum_range(null::position_source))[1])" >/dev/null
fi
V=55555555-0000-0000-0000-000000000001
NOAPP=99999999-0000-0000-0000-0000000000aa
chk "tabela z RLS; anon bez SELECT; authenticated bez INSERT/UPDATE/DELETE" "$(Q "select (select relrowsecurity from pg_class where oid='public.vessel_positions'::regclass)::text||has_table_privilege('anon','vessel_positions','select')::text||has_table_privilege('authenticated','vessel_positions','insert')::text||has_table_privilege('authenticated','vessel_positions','update')::text||has_table_privilege('authenticated','vessel_positions','delete')::text")" "truefalsefalsefalsefalse"
$PSQL -c "insert into vessel_positions (vessel_id, lat, lon, sog_kn, cog, observed_at) values ('$V',57.98,17.85,17.1,8, now()-interval '40 days'), ('$V',58.5,17.9,16.0,10, now()-interval '35 days'), ('$V',58.90,17.95,0.2,180, now()-interval '5 minutes')" >/dev/null
err "zapis przez API odrzucony (HHL)" $HHL "insert into vessel_positions (vessel_id, lat, lon, observed_at) values ('$V',1,1,now())" "permission denied"
val "KSH czyta ostatnią pozycję z czasem sygnału" $KSH "select lat||'/'||lon||'/'||(observed_at > now()-interval '10 minutes') from vessel_positions order by observed_at desc limit 1" "58.9/17.95/true"
val "SCX czyta pozycje (3)" $SCX "select count(*) from vessel_positions" 3
val "konto bez app_users widzi 0" $NOAPP "select count(*) from vessel_positions" 0
chk "powtórka tego samego sygnału odrzucona (unikalność statek+czas)" "$($PSQL -c "insert into vessel_positions (vessel_id, lat, lon, observed_at) select vessel_id, lat, lon, observed_at from vessel_positions limit 1" 2>&1 | grep -c 'duplicate key')" 1
chk "retencja: authenticated bez EXECUTE purge_vessel_positions" "$(Q "select has_function_privilege('authenticated','purge_vessel_positions(timestamptz)','execute')::text")" false
chk "retencja 30 dni: usuwa 2 starsze, zostaje świeża" "$(Q "select purge_vessel_positions()")/$(Q "select count(*) from vessel_positions")" "2/1"
$PSQL -c "update vessel_positions set observed_at = now()-interval '60 days'" >/dev/null
chk "retencja: ostatnia pozycja statku zostaje zawsze (także starsza niż 30 dni)" "$(Q "select purge_vessel_positions()")/$(Q "select count(*) from vessel_positions")" "0/1"

echo; echo "[I-2l] czas wykrycia odchylenia z risk_signals (0055)"
L7=33333333-0000-0000-0000-000000000077
$PSQL -c "insert into loads (id, project_id, carrier_org_id, order_no, hhl_order_no, carrier_order_no, status, tractor_plate) values ('$L7','$P','00000000-0000-0000-0000-00000000a003','KSH/77','HHL/2026/77','SCX/77','IN_TRANSIT_PL','GD 7777')" >/dev/null
$PSQL -c "insert into positions (load_id, ts, geom_raw, source) select '$L7', now()-interval '3 hours', st_setsrid(st_makepoint(18.0, 53.0),4326), source from positions limit 1" >/dev/null
chk "anon bez EXECUTE kpi_detection_lag; funkcja SECURITY INVOKER" "$(Q "select has_function_privilege('anon','kpi_detection_lag(uuid,integer)','execute')::text||'/'||(select prosecdef::text from pg_proc where proname='kpi_detection_lag')")" "false/false"
val "brak ryzyk z czasem zdarzenia → 0 próbek, mediana NULL (kafelek „—”)" $HHL "select samples||'/'||coalesce(median_min::text,'∅') from kpi_detection_lag('$P')" "0/∅"
chk "cichy pojazd: próg z Opcji (15 min), pozycja sprzed 3 h → wykrycie po 165 min" "$(Q "select detect_silent_vehicles(90) >= 1")/$(Q "select round(extract(epoch from detected_at-occurred_at)/60) from risk_signals where load_id='$L7' and kind='SILENT_VEHICLE'")" "t/165"
$PSQL -c "insert into load_events (load_id, event_type, occurred_at, payload) values ('$L7','GEOFENCE_ENTER', now()-interval '7 minutes', '{\"geofence_id\":\"g-test\"}')" >/dev/null
$PSQL -c "insert into risk_signals (project_id, load_id, kind, severity, title, title_key, detail, dedup_key) values ('$P','$L7','LOADING_UNCONFIRMED','MEDIUM','test strefy','rk_dates_unconfirmed','{\"geofence_id\":\"g-test\",\"zdarzenie\":\"GEOFENCE_ENTER\"}','T-I2L-G')" >/dev/null 2>&1
chk "ryzyko strefy: occurred_at = czas zdarzenia strefy z load_events (7 min)" "$(Q "select round(extract(epoch from detected_at-occurred_at)/60) from risk_signals where dedup_key='T-I2L-G'")" 7
$PSQL -c "insert into risk_signals (project_id, load_id, kind, severity, title, title_key, detail, dedup_key) values ('$P','$L7','AUTO_STATUS','HIGH','test jawny','rk_auto_status_blocked',jsonb_build_object('occurred_at', now()-interval '20 minutes'),'T-I2L-J'), ('$P','$L7','AUTO_STATUS','LOW','bez czasu','rk_auto_status_blocked','{}','T-I2L-N'), ('$P','$L7','AUTO_STATUS','LOW','zły czas','rk_auto_status_blocked','{\"occurred_at\":\"jutro\"}','T-I2L-Z')" >/dev/null 2>&1
chk "jawny detail.occurred_at przyjęty; brak/nieczytelny czas → NULL (nie zgadujemy)" "$(Q "select string_agg(dedup_key||'='||coalesce(round(extract(epoch from detected_at-occurred_at)/60)::text,'∅'), ',' order by dedup_key) from risk_signals where dedup_key like 'T-I2L-%' and dedup_key<>'T-I2L-G'")" "T-I2L-J=20,T-I2L-N=∅,T-I2L-Z=∅"
val "HHL: mediana z 3 próbek (7, 20, 90) = 20 min" $HHL "select samples||'/'||median_min from kpi_detection_lag('$P')" "3/20"
val "KSH: tylko ryzyka widoczne dla KSH (RLS: odbiorca HHL) → 0 próbek" $KSH "select samples from kpi_detection_lag('$P')" 0
val "SCX: ryzyka swojego transportu widoczne dla przewoźnika (7, 20, 90) → 3/20" $SCX "select samples||'/'||median_min from kpi_detection_lag('$P')" "3/20"
val "konto bez app_users: 0 próbek" $NOAPP "select samples from kpi_detection_lag('$P')" 0
$PSQL -c "update risk_signals set detected_at = now()-interval '40 days' where dedup_key='T-I2L-J'" >/dev/null
val "okno 30 dni: próbka sprzed 40 dni pominięta → 2 próbki" $HHL "select samples from kpi_detection_lag('$P', 30)" 2

echo; echo "[I-10] e-mail o zmianie daty awizowanego (0056)"
$PSQL -c "insert into notifications (channel, recipient, user_id, template, payload, dedup_key) select 'IN_APP', email, id, 'SCHEDULE_DATE_CRITICAL', '{\"code\":\"T-X\"}', 'T-I10-1' from app_users where auth_id='$SCX'" >/dev/null
chk "IN_APP SCHEDULE_DATE_CRITICAL → 1 e-mail na adres konta" "$(Q "select count(*)||'/'||min(recipient) from notifications where dedup_key='EMAIL:T-I10-1'")" "1/$(Q "select email from app_users where auth_id='$SCX'")"
$PSQL -c "insert into notifications (channel, recipient, user_id, template, payload, dedup_key) select 'IN_APP', email, id, 'SCHEDULE_DATE_CRITICAL', '{}', 'T-I10-1' from app_users where auth_id='$SCX' on conflict do nothing" >/dev/null
chk "powtórka (ten sam klucz) → nadal 1 e-mail" "$(Q "select count(*) from notifications where dedup_key like 'EMAIL:T-I10-%'")" 1
$PSQL -c "update app_users set active=false where auth_id='$KSH'; insert into notifications (channel, recipient, user_id, template, payload, dedup_key) select 'IN_APP', email, id, 'SCHEDULE_DATE_CRITICAL', '{}', 'T-I10-2' from app_users where auth_id='$KSH'; update app_users set active=true where auth_id='$KSH'" >/dev/null
chk "konto nieaktywne → bez e-maila" "$(Q "select count(*) from notifications where dedup_key='EMAIL:T-I10-2'")" 0
$PSQL -c "insert into notifications (channel, recipient, user_id, template, payload, dedup_key) select 'IN_APP', email, id, 'INVOICE_NEW', '{}', 'T-I10-3' from app_users where auth_id='$SCX'" >/dev/null
chk "inne szablony IN_APP bez e-maila z tego wyzwalacza" "$(Q "select count(*) from notifications where dedup_key='EMAIL:T-I10-3'")" 0
chk "funkcja wyzwalacza bez EXECUTE dla API" "$(Q "select has_function_privilege('authenticated','notify_schedule_critical_email()','execute')::text")" false

echo; echo "[I-5] 2FA TOTP wymagane dla HHL_ADMIN (aal2, 0057)"
A2="set local request.jwt.claim.aal='aal2'"
OPS=11111111-0000-0000-0000-0000000000b5
$PSQL -c "insert into app_users (auth_id, org_id, email, role) values ('$OPS','00000000-0000-0000-0000-00000000a001','ops@test','HHL_OPS') on conflict do nothing" >/dev/null
chk "przełącznik po migracji w środowisku bez auth.mfa_factors: wyłączony" "$(Q "select enabled from security_flags where key='MFA_HHL_ADMIN'")" f
chk "API bez dostępu do security_flags, current_aal, mfa_satisfied" "$(Q "select has_table_privilege('authenticated','security_flags','select')::text||has_function_privilege('authenticated','mfa_satisfied(user_role)','execute')::text||has_function_privilege('authenticated','current_aal()','execute')::text")" "falsefalsefalse"
val "wymaganie wyłączone: HHL_ADMIN przy aal1 = HHL" $HHL "select is_hhl()" t
$PSQL -c "update security_flags set enabled=true where key='MFA_HHL_ADMIN'" >/dev/null
val "wymaganie włączone: HHL_ADMIN bez drugiego składnika (aal1) — is_hhl() false" $HHL "select is_hhl()::text||'/'||coalesce(current_app_role()::text,'∅')" "false/∅"
val "HHL_ADMIN aal1: 0 transportów (RLS)" $HHL "select count(*) from loads" 0
err "HHL_ADMIN aal1: admin_invite_user odrzucone" $HHL "select admin_invite_user('x@test.pl','KSH','CLIENT_USER')" "wyłącznie administrator HHL"
err "HHL_ADMIN aal1: cancel_load odrzucone" $HHL "select cancel_load('$L2','x')" "wyłącznie HHL"
val "HHL_ADMIN aal1: my_profile nadal zwraca konto (ekran TOTP)" $HHL "select role from my_profile()" HHL_ADMIN
val "HHL_ADMIN aal1: my_mfa_status wymagane, niespełnione" $HHL "select (my_mfa_status()->>'required')||'/'||(my_mfa_status()->>'satisfied')||'/'||(my_mfa_status()->>'aal')" "true/false/aal1"
val "HHL_ADMIN aal2: pełny dostęp" $HHL "$A2; select is_hhl()::text||'/'||can_see_margin()::text||'/'||(select count(*) from loads)" "true/true/$(Q "select count(*) from loads")"
val "HHL_ADMIN aal2: my_mfa_status spełnione" $HHL "$A2; select my_mfa_status()->>'satisfied'" true
val "HHL_OPS przy aal1 bez zmian (wymaganie tylko dla HHL_ADMIN)" $OPS "select is_hhl()" t
val "KSH przy aal1 bez zmian" $KSH "select current_app_role()" CLIENT_ADMIN
err "przełącznik: HHL_ADMIN aal1 odrzucony" $HHL "select admin_set_mfa_enforcement(false)" "wyłącznie administrator HHL"
err "przełącznik: HHL_OPS aal2 odrzucony" $OPS "$A2; select admin_set_mfa_enforcement(false)" "wyłącznie administrator HHL"
val "przełącznik: HHL_ADMIN aal2 wyłącza + audyt" $HHL "$A2; select admin_set_mfa_enforcement(false)" f commit
chk "stan i audyt MFA_ENFORCEMENT_SET" "$(Q "select enabled from security_flags where key='MFA_HHL_ADMIN'")/$(Q "select count(*) from audit_log where action='MFA_ENFORCEMENT_SET'")" "f/1"
err "włączenie przy aal1 niemożliwe nawet po wyłączeniu (wymaga aal2)" $HHL "select admin_set_mfa_enforcement(true)" "aal2"
chk "anon bez EXECUTE my_mfa_status / admin_set_mfa_enforcement" "$(Q "select has_function_privilege('anon','my_mfa_status()','execute')::text||has_function_privilege('anon','admin_set_mfa_enforcement(boolean)','execute')::text")" "falsefalse"

echo; echo "[I-6] błędy przeglądarki → client_errors + alarm (0058)"
AN() { $PSQL -c "begin; set local role anon; $1; commit;" 2>&1 | grep -vE '^(BEGIN|SET|COMMIT)$' | tail -1; }
TOK="wt_$(printf 'ab%.0s' $(seq 32))"
chk "anon (PWA kierowcy): zgłoszenie przyjęte" "$(AN "select report_client_error('error', 'TypeError: x is undefined $TOK', E'TypeError\n    at f (index-abc.js:1:2)', '/#/driver/$TOK', 'abc', 'UA')")" "t"
chk "token kierowcy wycięty z komunikatu i ścieżki; anon bez konta i roli" "$(Q "select (message like '%wt_…%' and message not like '%abab%')::text||'/'||path||'/'||coalesce(user_id::text,'∅')||'/'||coalesce(app_role,'∅') from client_errors")" "true//#/driver/wt_…/∅/∅"
AN "select report_client_error('error', 'TypeError: x is undefined $TOK', E'TypeError\n    at f (index-abc.js:1:2)', '/', 'abc', 'UA')" >/dev/null
chk "ten sam błąd w 10 min: 1 wiersz, hits 2" "$(Q "select count(*)||'/'||max(hits) from client_errors")" "1/2"
val "zalogowany HHL: zgłoszenie z rolą i kontem" $HHL "select report_client_error('rejection', 'Error: fetch failed')" t commit
chk "wiersz HHL: rola HHL_ADMIN, konto ustawione" "$(Q "select app_role||'/'||(user_id is not null)::text from client_errors where kind='rejection'")" "HHL_ADMIN/true"
err "zalogowany bez aktywnego konta: odmowa" 11111111-0000-0000-0000-0000000000ee "select report_client_error('error', 'x')" "Brak aktywnego konta"
err "nieznany rodzaj: odmowa" $HHL "select report_client_error('warn', 'x')" "Nieznany rodzaj"
err "pusty komunikat / NULL: odmowa" $HHL "select report_client_error('error', null)" "Pusty komunikat"
chk "JWT i token w zapytaniu wycięte" "$(Q "select client_error_scrub('a eyJtest-only-fixture.test-only-body.not-a-secret b ?access_token=SEKRET&x=1')")" "a jwt… b ?access_token=…&x=1"
val "odczyt: HHL_ADMIN widzi 2" $HHL "select count(*) from client_errors" 2
val "odczyt: KSH 0 (RLS)" $KSH "select count(*) from client_errors" 0
val "odczyt: SCX 0 (RLS)" $SCX "select count(*) from client_errors" 0
chk "anon bez odczytu i zapisu tabeli; bez EXECUTE watch/scrub" "$(Q "select has_table_privilege('anon','client_errors','select')::text||has_table_privilege('authenticated','client_errors','insert')::text||has_function_privilege('anon','client_error_watch(timestamptz)','execute')::text||has_function_privilege('authenticated','client_error_scrub(text)','execute')::text")" "falsefalsefalsefalse"
chk "alarm: błędy w 15 min → ryzyko HHL rk_client_errors" "$(Q "select client_error_watch()->>'stan'")/$(Q "select count(*)||'/'||max(title_key)||'/'||max(audience::text) from risk_signals where detail->>'job'='client-errors' and resolved_at is null")" "ALARM/1/rk_client_errors/HHL"
chk "alarm drugi raz: bez nowego ryzyka (jeden na incydent)" "$(Q "select client_error_watch()->>'nowe_ryzyka'")" "0"
val "ryzyko alarmu niewidoczne dla KSH" $KSH "select count(*) from risk_signals where detail->>'job'='client-errors'" 0
$PSQL -c "update client_errors set last_seen_at = now() - interval '25 hours', first_seen_at = now() - interval '25 hours'" >/dev/null
chk "24 h bez błędów → alarm zamknięty" "$(Q "select client_error_watch()->>'stan'")/$(Q "select count(*) from risk_signals where detail->>'job'='client-errors' and resolved_at is null")" "OK/0"
$PSQL -c "insert into client_errors (fingerprint, kind, message) select 'f'||g, 'error', 'zalew '||g from generate_series(1,60) g" >/dev/null
chk "zalew: 60 nowych / min → kolejny nowy błąd odrzucony cicho" "$(AN "select report_client_error('error', 'nowy po zalewie')")/$(Q "select count(*) from client_errors where message='nowy po zalewie'")" "f/0"

echo; echo "[I-7] retencja danych kierowcy 90 dni (0059)"
R() { echo "33333333-0000-0000-0000-0000000007$1"; }
SYS() { $PSQL -c "set session_replication_role = replica; $1" >/dev/null; }
# a: rozładowany 91 dni temu · b: rozładowany 89 dni · c: anulowany 91 dni · d: anulowany 10 dni · e: w drodze, plan 200 dni temu
for x in a1 b1 c1 d1 e1; do SYS "insert into loads (id, project_id, carrier_org_id, order_no, driver_name, driver_phone) values ('$(R $x)','$P','00000000-0000-0000-0000-00000000a003','KSH/R$x','Jan Kowalski','+48600100200')"; done
SYS "update loads set status='UNLOADED', actual_delivery_at = now() - interval '91 days' where id='$(R a1)'"
SYS "update loads set status='UNLOADED', actual_delivery_at = now() - interval '89 days' where id='$(R b1)'"
SYS "update loads set status='CANCELLED', updated_at = now() - interval '91 days' where id='$(R c1)'"
SYS "update loads set status='CANCELLED', updated_at = now() - interval '10 days' where id='$(R d1)'"
SYS "update loads set status='IN_TRANSIT_PL', plan_delivery_date = current_date - 200, updated_at = now() - interval '200 days' where id='$(R e1)'"
for x in c1 d1 e1; do SYS "insert into positions (load_id, ts, geom_raw, source) values ('$(R $x)', now() - interval '150 days', st_setsrid(st_makepoint(18,53),4326), 'DRIVER_PWA')"; done
SYS "insert into driver_tokens (load_id, token_hash, expires_at) values ('$(R e1)', 'stary1', now() - interval '91 days'), ('$(R e1)', 'swiezy', now() - interval '89 days')"
SYS "insert into driver_tokens (load_id, token_hash, expires_at, revoked_at) values ('$(R e1)', 'odwolany', now() + interval '1 day', now() - interval '100 days')"
chk "przebieg: anonimizacja 2 (rozładowany 91 d + anulowany 91 d)" "$(Q "select purge_personal_data()")" "2"
chk "rozładowany 91 d: imię i telefon usunięte" "$(Q "select coalesce(driver_name,'∅')||'/'||coalesce(driver_phone,'∅') from loads where id='$(R a1)'")" "∅/∅"
chk "rozładowany 89 d: dane zostają" "$(Q "select driver_name from loads where id='$(R b1)'")" "Jan Kowalski"
chk "anulowany 91 d: dane i pozycje usunięte (NOWE)" "$(Q "select coalesce(driver_phone,'∅') from loads where id='$(R c1)'")/$(Q "select count(*) from positions where load_id='$(R c1)'")" "∅/0"
chk "anulowany 10 d: dane i pozycje zostają" "$(Q "select driver_phone from loads where id='$(R d1)'")/$(Q "select count(*) from positions where load_id='$(R d1)'")" "+48600100200/1"
chk "w drodze po terminie planu: nic nie czyszczone" "$(Q "select driver_name from loads where id='$(R e1)'")/$(Q "select count(*) from positions where load_id='$(R e1)'")" "Jan Kowalski/1"
chk "linki kierowcy: wygasły 91 d i odwołany 100 d usunięte, wygasły 89 d zostaje" "$(Q "select string_agg(convert_from(token_hash,'UTF8'), ',') from driver_tokens where load_id='$(R e1)'")" "swiezy"
chk "przebieg zapisany w integration_runs (job rodo) z liczbami" "$(Q "select result->>'kierowcy_rozladowane'||'/'||(result->>'kierowcy_anulowane')||'/'||(result->>'pozycje_anulowane')||'/'||(result->>'linki_kierowcy') from integration_runs where job='rodo' order by ran_at desc limit 1")" "1/1/1/2"
chk "drugi przebieg: 0 (idempotentny)" "$(Q "select purge_personal_data()")" "0"
chk "p_days NULL/ujemne: odmowa" "$($PSQL -c "select purge_personal_data(-1)" 2>&1 | grep -c 'p_days musi')" "1"
chk "purge_personal_data bez EXECUTE dla anon i authenticated" "$(Q "select has_function_privilege('anon','purge_personal_data(int)','execute')::text||has_function_privilege('authenticated','purge_personal_data(int)','execute')::text")" "falsefalse"

echo; echo "[I-17] drugie urządzenie 2FA (0060)"
if [ -n "${TOWER_HOSTED_READY:-}" ]; then
  # Hosted: prawdziwa auth.mfa_factors — bez CREATE/DROP atrapy; insert z wymaganymi kolumnami.
  # Wymaga kont seed w auth.users (brama: ensureSeedAuthUsers przed i2).
  if [ "$($PSQL -c "select count(*) from auth.users where id='$HHL'" | tr -d '\r')" != "1" ]; then
    fail=$((fail+3)); echo "  FAIL  auth.users bez konta HHL — uruchom bramę z ensureSeedAuthUsers (i2)"
  fi
  $PSQL -c "delete from auth.mfa_factors where user_id in ('$HHL','$KSH') and coalesce(friendly_name,'') like 'tower-db-test%'" >/dev/null
else
  $PSQL -c "create table if not exists auth.mfa_factors (id uuid primary key default gen_random_uuid(), user_id uuid, factor_type text, status text)" >/dev/null
fi
val "brak składników: factors 0" $HHL "$A2; select my_mfa_status()->>'factors'" 0
if [ -n "${TOWER_HOSTED_READY:-}" ]; then
  if ! $PSQL -c "insert into auth.mfa_factors (id, user_id, factor_type, status, friendly_name, created_at, updated_at, secret) values
    (gen_random_uuid(),'$HHL','totp','verified','tower-db-test-1',now(),now(),'t'),
    (gen_random_uuid(),'$HHL','totp','unverified','tower-db-test-u',now(),now(),'t'),
    (gen_random_uuid(),'$KSH','totp','verified','tower-db-test-k',now(),now(),'t')" >/dev/null; then
    fail=$((fail+1)); echo "  FAIL  insert auth.mfa_factors (1) — FK auth.users / uprawnienia hosted"
  fi
else
  $PSQL -c "insert into auth.mfa_factors (user_id, factor_type, status) values ('$HHL','totp','verified'), ('$HHL','totp','unverified'), ('$KSH','totp','verified')" >/dev/null
fi
val "jedno urządzenie (niezweryfikowane i cudze nie liczą się): factors 1" $HHL "$A2; select my_mfa_status()->>'factors'" 1
err "włączenie wymagania z jednym urządzeniem: odmowa" $HHL "$A2; select admin_set_mfa_enforcement(true)" "drugie urządzenie"
if [ -n "${TOWER_HOSTED_READY:-}" ]; then
  $PSQL -c "insert into auth.mfa_factors (id, user_id, factor_type, status, friendly_name, created_at, updated_at, secret) values
    (gen_random_uuid(),'$HHL','totp','verified','tower-db-test-2',now(),now(),'t')" >/dev/null
else
  $PSQL -c "insert into auth.mfa_factors (user_id, factor_type, status) values ('$HHL','totp','verified')" >/dev/null
fi
val "dwa urządzenia: factors 2" $HHL "$A2; select my_mfa_status()->>'factors'" 2
val "dwa urządzenia + aal2: włączenie wymagania" $HHL "$A2; select admin_set_mfa_enforcement(true)" t
val "wyłączenie zawsze możliwe (aal2)" $HHL "$A2; select admin_set_mfa_enforcement(false)" f
chk "mfa_factor_count bez EXECUTE dla API" "$(Q "select has_function_privilege('authenticated','mfa_factor_count()','execute')::text||has_function_privilege('anon','mfa_factor_count()','execute')::text")" "falsefalse"
if [ -n "${TOWER_HOSTED_READY:-}" ]; then
  $PSQL -c "delete from auth.mfa_factors where coalesce(friendly_name,'') like 'tower-db-test%'" >/dev/null
else
  $PSQL -c "drop table auth.mfa_factors" >/dev/null
fi

echo; echo "[DATY-67] daty z pliku KSH + opóźnienie (§6–7); bez „Potwierdź daty”"
# Dni kalendarzowe, nie 24 h × n: w noc zmiany czasu (ostatnia niedziela października)
# `date -d '+21 days'` ląduje w tym samym dniu co '+20 days' i test dat się myli.
_dcal() { date -d "$(date +%F) + $1 days" +%F; }
D1=$(_dcal 20); D2=$(_dcal 25); D3=$(_dcal 21); D4=$(_dcal 26); D5=$(_dcal 22); D6=$(_dcal 27)
DNEAR=$(_dcal 3); DNEAR2=$(_dcal 8)
ROW() { echo "[{\"code\":\"D18-1\",\"length_m\":18,\"width_m\":2.4,\"height_m\":2.4,\"qty\":1,\"total_weight_t\":20,\"load_date\":\"$1\",\"delivery_date\":\"$2\"}]"; }
ROWT() { echo "[{\"code\":\"D18-1\",\"length_m\":18,\"width_m\":2.4,\"height_m\":2.4,\"qty\":1,\"total_weight_t\":20,\"load_date\":\"$1\",\"load_time\":\"08:00\",\"delivery_date\":\"$2\",\"delivery_time\":\"12:00\"}]"; }
IMP18() { echo "select import_schedule('$P', '$(ROW $1 $2)'::jsonb, '{}'::text[], '{\"name\":\"d18.xlsx\"$3}'::jsonb, $4)"; }
IMP18T() { echo "select import_schedule('$P', '$(ROWT $1 $2)'::jsonb, '{}'::text[], '{\"name\":\"d18.xlsx\"}'::jsonb, $3)"; }
val "import HHL: nowy transport D18-1" $HHL "select jsonb_array_length(r->'added') from ($(IMP18 $D1 $D2 '' false)) s(r)" 1 commit
LD=$(Q "select load_id from shipment_items where shipment_code='D18-1'")
$PSQL -c "update loads set carrier_org_id='00000000-0000-0000-0000-00000000a003' where id='$LD'" >/dev/null
chk "nowy transport: POTWIERDZONA z pliku, bez autora KSH" "$(Q "select plan_dates_status||'/'||coalesce(plan_dates_confirmed_by::text,'∅')||'/'||(plan_dates_confirmed_at is not null)::text from loads where id='$LD'")" "POTWIERDZONA/∅/true"
err "ksh_confirm usunięte (KSH)" $KSH "select ksh_confirm_dates('$LD')" "DATY-67"
err "ksh_confirm usunięte (HHL)" $HHL "select ksh_confirm_dates('$LD')" "DATY-67"
err "konto bez app_users: odmowa" 11111111-0000-0000-0000-0000000000ee "select ksh_confirm_dates('$LD')" "Brak aktywnego konta"
err "HHL nie ustawi statusu ręcznie (PATCH)" $HHL "update loads set plan_dates_status='WSTEPNA' where id='$LD'" "Status dat planu"
err "ANEKS 2: przewoźnik nadal nie zmienia okien KSH" $SCX "update loads set plan_load_date='$D3' where id='$LD'" "Przewoźnik nie może zmieniać"
err "przewoźnik nie ustawi statusu dat" $SCX "update loads set plan_dates_status='WSTEPNA' where id='$LD'" "Status dat planu|Przewoźnik nie może"
chk "schedule_cell_ts: załadunek PL / dostawa SE" "$(Q "select to_char(schedule_cell_ts('2026-10-01','08:00','Europe/Warsaw') at time zone 'UTC','HH24:MI')||'/'||to_char(schedule_cell_ts('2026-10-05','12:00','Europe/Stockholm') at time zone 'UTC','HH24:MI')")" "06:00/10:00"
val "import z godzinami: ustawia plan_load_from i plan_delivery_to" $HHL "select (r->'changed'->0->>'critical') from ($(IMP18T $D3 $D4 false)) s(r)" false commit
chk "godziny z pliku = okno (PL / SE)" "$(Q "select (plan_load_from is not null)::text||'/'||(plan_delivery_to is not null)::text||'/'||plan_dates_status from loads where id='$LD'")" "true/true/POTWIERDZONA"
chk "I-25: deadline = plan_delivery_to gdy jest godzina" "$(Q "select (load_delivery_deadline(plan_delivery_date, plan_delivery_to) is not distinct from plan_delivery_to)::text from loads where id='$LD'")" "true"
val "import zmienia datę — zawsze (plik=źródło), overwrite zbędne" $HHL "select (r->'confirmed'->0->>'overwrite')||'/'||jsonb_array_length(r->'confirmed') from ($(IMP18 $D5 $D6 '' false)) s(r)" "true/1" commit
chk "po imporcie: nowe daty, POTWIERDZONA" "$(Q "select plan_dates_status||'/'||plan_load_date||'/'||plan_delivery_date from loads where id='$LD'")" "POTWIERDZONA/$D5/$D6"
chk "zmiana daty: zdarzenie PLAN_DATES_CHANGED" "$(Q "select (count(*) >= 1)::text from load_events where load_id='$LD' and event_type='PLAN_DATES_CHANGED'")" "true"
chk "zmiana daty: powiadomienie IN_APP" "$(Q "select (count(*) >= 1)::text from notifications where template='PLAN_DATES_CHANGED' and channel='IN_APP' and load_id='$LD'")" "true"
chk "próg wyprzedzenia KSH jest w Opcjach (LEAD_DAYS = 5), nie w app_parameters" "$(Q "select value_num::int::text from ops_thresholds where key='LEAD_DAYS'")/$(Q "select count(*) from app_parameters where key='DATE_CONFIRM_DAYS'")" "5/0"
chk "TRANSIT_TARGET_DAYS = 4" "$(Q "select value::int from app_parameters where key='TRANSIT_TARGET_DAYS'")" "4"
val "parametry czytelne dla zalogowanych" $KSH "select count(*) from app_parameters where key in ('DATE_CONFIRM_DAYS','TRANSIT_TARGET_DAYS')" 1
val "app_parameters: konto bez app_users 0" 11111111-0000-0000-0000-0000000000ee "select count(*) from app_parameters" 0
chk "detect_unconfirmed_dates wyłączone (=0)" "$(Q "select detect_unconfirmed_dates()")" 0
val "import blisko załadunku → LATE_DATE_CHANGE" $HHL "select jsonb_array_length(r->'changed') from ($(IMP18 $DNEAR $DNEAR2 '' false)) s(r)" 1 commit
chk "ryzyko LATE_DATE_CHANGE (HHL+przewoźnik)" "$(Q "select audience::text||'/'||severity::text||'/'||title_key from risk_signals where kind='LATE_DATE_CHANGE' and load_id='$LD' and resolved_at is null order by detected_at desc limit 1")" "HHL_PRZEWOZNIK/MEDIUM/rk_late_date_change"
val "SCX widzi ryzyko późnej zmiany" $SCX "select count(*) from risk_signals where kind='LATE_DATE_CHANGE' and load_id='$LD' and resolved_at is null" 1
chk "anon bez EXECUTE ksh_confirm_dates / detect_unconfirmed_dates" "$(Q "select has_function_privilege('anon','ksh_confirm_dates(uuid,date,date,timestamptz,timestamptz,timestamptz,timestamptz)','execute')::text||has_function_privilege('authenticated','detect_unconfirmed_dates(timestamptz)','execute')::text")" "falsefalse"

fi # tower-i2-part 2

if _i2_part_ok 3; then
echo; echo "[I-3] bramka SMS — część bazowa (0067; bez telefonu, D-4)"
chk "EXTERNAL_MESSAGING domyślnie wyłączone (R-2, 0068)" "$(Q "select enabled from security_flags where key='EXTERNAL_MESSAGING'")" f
$PSQL -c "update security_flags set enabled=true where key='EXTERNAL_MESSAGING'" >/dev/null   # testy funkcjonalne I-3 jak po R-2
SL=33333333-0000-0000-0000-000000000001
AN() { local o; o=$($PSQL -v ON_ERROR_STOP=1 -c "begin; set local role anon; $1; commit;" 2>&1 | grep -v -E '^(BEGIN|SET|COMMIT)$'); if echo "$o" | grep -q ERROR; then echo "$o" | grep ERROR; else echo "$o" | tail -1; fi; }
chk "sms_*: RLS na 3 tabelach, anon bez SELECT" "$(Q "select (select count(*) from pg_class where relname in ('sms_devices','sms_heartbeats','sms_outbox') and relrowsecurity)::text || bool_or(has_table_privilege('anon', 'public.'||t, 'select'))::text from unnest(array['sms_devices','sms_heartbeats','sms_outbox']) t")" "3false"
chk "authenticated nie widzi token_hash urządzeń" "$(Q "select has_column_privilege('authenticated','sms_devices','token_hash','select')::text")" false
chk "szablony PL bez polskich znaków (GSM-7), wszystkie ≤ 160 znaków przy nr 9 znaków" "$(Q "with r as (select lc, sms_render(k, lc, jsonb_build_object('nr','SG-01-001','url','https://tower.log-mar.pl/#/driver/wt_'||repeat('a',64),'okno',o,'dt','05.10 08:00','t2','16:00','statek','Nova Star','ref','GDN12345')) b from unnest(array['DRIVER_LINK','WINDOW_CHANGE','SAILING_CHANGE','SAILING_CANCELLED','LOAD_CANCELLED']) k cross join unnest(array['pl','en','sv']) lc cross join unnest(array['LOAD','DELIVERY']) o) select (bool_and(lc <> 'pl' or b !~ '[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]'))::text || (max(char_length(b)) <= 160)::text from r")" "truetrue"
chk "szablon bez wartości odrzucony" "$($PSQL -c "select sms_render('DRIVER_LINK','pl','{\"nr\":\"X\"}')" 2>&1 | grep -c 'bez wartości')" 1
chk "zakaz cen w treści (CHECK)" "$($PSQL -c "insert into sms_outbox (kind, to_e164, locale, body) values ('TEST','+46700000001','sv','Pris 100 EUR')" 2>&1 | grep -c sms_outbox_no_prices)" 1
chk "język z prefiksu: +48 pl, +46 sv, +370 en; kolumna wygrywa" "$(Q "select sms_locale_for('+48600000000',null)||sms_locale_for('+46700000000',null)||sms_locale_for('+37060000000',null)||sms_locale_for('+46700000000','pl')")" "plsvenpl"
err "KSH: wydanie urządzenia odrzucone" $KSH "select sms_issue_device('Telefon KSH')" "wyłącznie HHL"
DEVTOK=$(run $HHL "select sms_issue_device('Pixel HHL test')" commit | grep '^sd_')
chk "HHL: token urządzenia sd_ + 64 hex (jawny raz), w bazie tylko skrót" "$(echo "$DEVTOK" | grep -cE '^sd_[0-9a-f]{64}$')/$(Q "select count(*) from sms_devices where token_hash = driver_token_hash('$DEVTOK')")" "1/1"
chk "anon: zły token urządzenia odrzucony" "$(AN "select count(*) from sms_pull('sd_$(printf 'b%.0s' {1..64})')" | grep -c 'odwołane urządzenie')" 1
chk "anon: brak tokenu odrzucony" "$(AN "select count(*) from sms_pull()" | grep -c 'Brak tokenu')" 1
chk "authenticated: brak EXECUTE sms_pull (tylko anon)" "$(Q "select has_function_privilege('authenticated','sms_pull(text,int)','execute')::text || has_function_privilege('anon','sms_pull(text,int)','execute')::text")" "falsetrue"
$PSQL -c "set session_replication_role=replica; update loads set driver_phone='0701234567', driver_phone_country='SE', driver_locale=null, status='PLANNED', actual_delivery_at=null, sailing_id=null where id='$SL'" >/dev/null
err "link SMS bez numeru kierowcy odrzucony" $HHL "select issue_driver_token_sms('$L2')" "Brak numeru telefonu"
$PSQL -c "update security_flags set enabled = true where key = 'DRIVER_LINK_ACCEPT'" >/dev/null
val "HHL: link kierowcy + SMS w jednej transakcji" $HHL "select (r->>'token' like 'wt_%')::text || (r->>'sms_id' is not null)::text from (select issue_driver_token_sms('$SL') r) x" "truetrue" commit
chk "DRIVER_LINK: sv z prefiksu +46, sekret, priorytet 100; w sms_outbox.body „[link usunięty]”, bez tokenu" "$(Q "select locale||'/'||contains_secret||'/'||priority||'/'||(body like '%forarlank [link usuniety]%')::text||'/'||(body !~ 'wt_|https?://')::text from sms_outbox where kind='DRIVER_LINK' and load_id='$SL'")" "sv/true/100/true/true"
chk "DRIVER_LINK: pełna treść z linkiem tylko w sms_outbox_secret (brak uprawnień ról API)" "$(Q "select count(*)||'/'||bool_and(s.body like '%forarlank https://tower.log-mar.pl/#/driver/wt_%')::text||'/'||has_table_privilege('authenticated','public.sms_outbox_secret','select')::text||has_table_privilege('anon','public.sms_outbox_secret','select')::text from sms_outbox_secret s join sms_outbox o on o.id=s.sms_id where o.kind='DRIVER_LINK'")" "1/true/falsefalse"
val "HHL: select body z kolejki bez tokenu" $HHL "select count(*) from sms_outbox where body ~ 'wt_|https?://'" 0
err "HHL: brak dostępu do sms_outbox_secret" $HHL "select count(*) from sms_outbox_secret" "permission denied"
err "KSH: link SMS odrzucony" $KSH "select issue_driver_token_sms('$SL')" "wyłącznie przewoźnik transportu albo HHL"
chk "telefon pobiera 1 SMS (CLAIMED) z pełnym linkiem" "$(AN "select count(*)||'/'||bool_and(body like '%forarlank https://tower.log-mar.pl/#/driver/wt_%') from sms_pull('$DEVTOK', 5)")/$(Q "select status from sms_outbox where kind='DRIVER_LINK'")" "1/true/CLAIMED"
chk "drugie pobranie: 0 (bez podwójnego wydania)" "$(AN "select count(*) from sms_pull('$DEVTOK', 5)")" 0
SID=$(Q "select id from sms_outbox where kind='DRIVER_LINK'")
chk "raport SENT: status i licznik dzienny" "$(AN "select sms_report('$DEVTOK', '$SID', 'SENT', null, 1)" >/dev/null; Q "select o.status||'/'||d.day_sent from sms_outbox o join sms_devices d on d.id=o.device_id where o.id='$SID'")" "SENT/1"
chk "po SENT: sekret usunięty natychmiast (0 wierszy), body bez tokenu" "$(Q "select (select count(*) from sms_outbox_secret)||'/'||(select count(*) from sms_outbox where body ~ 'wt_')")" "0/0"
chk "powtórzony raport SENT bez błędu i bez podwójnego licznika" "$(AN "select sms_report('$DEVTOK', '$SID', 'SENT')" >/dev/null; Q "select day_sent from sms_devices where revoked_at is null")" 1
chk "przejście wstecz SENT → CLAIMED odrzucone" "$(AN "select sms_report('$DEVTOK', '$SID', 'CLAIMED')" | grep -c 'Niedozwolone przejście')" 1
chk "heartbeat: konfiguracja z bazy (poll 15 s, limit 150)" "$(AN "select (r->>'poll_s')||'/'||(r->>'day_limit')||'/'||(r->>'paused') from (select sms_heartbeat('$DEVTOK', '{\"battery\":80}') r) x")" "15/150/false"
$PSQL -c "update loads set plan_load_from = coalesce(plan_load_from, now() + interval '2 days') + interval '10 minutes', plan_load_to = coalesce(plan_load_to, now() + interval '2 days 8 hours') + interval '10 minutes' where id='$SL'" >/dev/null
chk "zmiana okna < 30 min: bez SMS" "$(Q "select count(*) from sms_outbox where kind='WINDOW_CHANGE' and load_id='$SL'")" 0
$PSQL -c "update loads set plan_load_from = plan_load_from + interval '2 hours', plan_load_to = plan_load_to + interval '2 hours' where id='$SL'" >/dev/null
chk "zmiana okna załadunku ≥ 30 min: WINDOW_CHANGE (sv, lastningsfonster)" "$(Q "select count(*)||'/'||bool_and(body like '%ANDRAT lastningsfonster:%') from sms_outbox where kind='WINDOW_CHANGE' and load_id='$SL'")" "1/true"
$PSQL -c "update loads set plan_load_from = plan_load_from - interval '1 second' + interval '1 second' where id='$SL'" >/dev/null
chk "to samo okno ponownie: bez duplikatu" "$(Q "select count(*) from sms_outbox where kind='WINDOW_CHANGE' and load_id='$SL'")" 1
SA=66666666-0000-0000-0000-0000000000e3
# Część 3 osobno: vessels wstawia tylko część 1. sailings.vessel_id NOT NULL — bez statku rejs (i SMS rejsu) nie powstaje.
$PSQL -c "insert into vessels (id, name, operator) values ('55555555-0000-0000-0000-000000000001','Nova Star','Polferries') on conflict (id) do nothing" >/dev/null
$PSQL -c "insert into sailings (id, project_id, vessel_id, departure_at, arrival_at) values ('$SA','$P','55555555-0000-0000-0000-000000000001', now() + interval '3 days', now() + interval '3 days 18 hours')" >/dev/null
$PSQL -c "update loads set sailing_id='$SA' where id='$SL'" >/dev/null
chk "przypisanie rejsu: SAILING_CHANGE" "$(Q "select count(*) from sms_outbox where kind='SAILING_CHANGE' and load_id='$SL'")" 1
$PSQL -c "update sailings set status='ODWOLANY' where id='$SA'" >/dev/null
chk "rejs odwołany: SAILING_CANCELLED dla transportu z linkiem" "$(Q "select count(*) from sms_outbox where kind='SAILING_CANCELLED' and load_id='$SL'")" 1
$PSQL -c "update sms_devices set paused=true" >/dev/null
chk "pauza urządzenia: pobranie zwraca 0" "$(AN "select count(*) from sms_pull('$DEVTOK', 5)")" 0
$PSQL -c "update sms_devices set paused=false, last_seen_at = now() - interval '35 minutes'; update sms_heartbeats set at = now() - interval '35 minutes'; update sms_outbox set created_at = now() - interval '11 minutes' where status='QUEUED'" >/dev/null
chk "strażnik: cisza > 30 min → ryzyko JOB_FAILURE HIGH (sms-gateway)" "$(Q "select (sms_watchdog()->>'cisza')") $(Q "select count(*) from risk_signals where dedup_key like 'sms-gateway:%' and resolved_at is null and severity='HIGH'")" "true 1"
chk "strażnik: SMS > 10 min → e-mail zastępczy SMS_FALLBACK (bez duplikatu przy drugim przebiegu)" "$(Q "select count(*) filter (where fallback_at is not null) from sms_outbox where status='QUEUED'")/$(Q "select sms_watchdog()->>'fallback'")" "3/0"
chk "e-mail zastępczy: do HHL (zdarzenia automatyczne), bez cen, ostatnie 3 cyfry numeru" "$(Q "select count(*) > 0 and bool_and(payload->>'to_tail' = '567') from notifications where template='SMS_FALLBACK'")" t
chk "sygnał wraca: ryzyko zamknięte" "$($PSQL -c "update sms_devices set last_seen_at = now()" >/dev/null; Q "select sms_watchdog()->>'cisza'")/$(Q "select count(*) from risk_signals where dedup_key like 'sms-gateway:%' and resolved_at is null")" "false/0"
$PSQL -c "update sms_devices set last_seen_at = now() - interval '35 minutes'; update sms_heartbeats set at = now() - interval '35 minutes'" >/dev/null
chk "cooldown 60 min: ponowna cisza zaraz po zamknięciu → bez nowego ryzyka" "$(Q "select (sms_watchdog()->>'cisza')||'/'||(sms_watchdog()->>'nowe_ryzyka')||'/'||(select count(*) from risk_signals where dedup_key like 'sms-gateway:%' and resolved_at is null)")" "true/0/0"
$PSQL -c "update sms_outbox set expires_at = now() - interval '1 minute' where kind='SAILING_CHANGE'; update sms_outbox set sent_at = now() - interval '25 hours' where kind='DRIVER_LINK'" >/dev/null
chk "strażnik: przeterminowany → EXPIRED; body wysłanego SMS bez linku" "$(Q "select (r->>'przeterminowane')||'/'||(r->>'wyczyszczone_linki') from (select sms_watchdog() r) x")/$(Q "select body from sms_outbox where kind='DRIVER_LINK'")" "1/1/[link usunięty]"
val "HHL: kolejka widoczna" $HHL "select count(*) > 0 from sms_outbox" t
val "KSH: kolejka niewidoczna (RLS)" $KSH "select count(*) from sms_outbox" 0
err "przewoźnik: bez dostępu do tabeli urządzeń" $SCX "select count(*) from sms_devices where label is not null" "0|permission denied"
echo "  [I-3 P0] SMS 8 GPS_SILENT i 9 UNLOAD_CONFIRM (0069)"
chk "CHECK kind: GPS_SILENT i UNLOAD_CONFIRM dozwolone, inne odrzucone" "$(Q "select pg_get_constraintdef(oid) ~ 'GPS_SILENT' and pg_get_constraintdef(oid) ~ 'UNLOAD_CONFIRM' from pg_constraint where conname='sms_outbox_kind_check'")/$($PSQL -c "insert into sms_outbox (kind, to_e164, locale, body) values ('ROAD_SE','+46700000001','sv','x')" 2>&1 | grep -c sms_outbox_kind_check)" "t/1"
chk "szablony 8 i 9: PL bez polskich znaków, ≤ 160 znaków (nr 9 znaków, 9999 min)" "$(Q "with r as (select lc, sms_render(k, lc, jsonb_build_object('nr','SG-01-001','min','9999')) b from unnest(array['GPS_SILENT','UNLOAD_CONFIRM']) k cross join unnest(array['pl','en','sv']) lc) select count(*)||'/'||bool_and(lc <> 'pl' or b !~ '[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]')::text || (max(char_length(b)) <= 160)::text from r")" "6/truetrue"
$PSQL -c "set session_replication_role=replica; update loads set status='IN_TRANSIT_PL' where id='$SL'; insert into positions (load_id, ts, geom_raw, source, raw) values ('$SL', now() - interval '47 minutes', st_setsrid(st_makepoint(18.65,54.35),4326), 'DRIVER_PWA', '{\"test\":\"i3p0\"}')" >/dev/null
$PSQL -c "insert into risk_signals (project_id, load_id, kind, severity, title, dedup_key) select project_id, id, 'SILENT_VEHICLE', 'MEDIUM', 'test', 'test-gps-1' from loads where id='$SL'" >/dev/null
chk "ryzyko SILENT_VEHICLE w ruchu: GPS_SILENT (sv, 47 min od ostatniej pozycji)" "$(Q "select count(*)||'/'||bool_and(body ~ '^Watch Tower .*: ingen GPS-position pa 4[78] min')::text from sms_outbox where kind='GPS_SILENT' and load_id='$SL'")" "1/true"
$PSQL -c "update risk_signals set resolved_at=now() where dedup_key='test-gps-1'; insert into risk_signals (project_id, load_id, kind, severity, title, dedup_key) select project_id, id, 'SILENT_VEHICLE', 'MEDIUM', 'test', 'test-gps-2' from loads where id='$SL'" >/dev/null
chk "drugie ryzyko w ciągu 3 h: bez drugiego SMS" "$(Q "select count(*) from sms_outbox where kind='GPS_SILENT' and load_id='$SL'")" 1
$PSQL -c "set session_replication_role=replica; update loads set status='FERRY' where id='$SL'; set session_replication_role=origin; delete from sms_outbox where kind='GPS_SILENT'; update risk_signals set resolved_at=now() where dedup_key='test-gps-2'; insert into risk_signals (project_id, load_id, kind, severity, title, dedup_key) select project_id, id, 'SILENT_VEHICLE', 'MEDIUM', 'test', 'test-gps-3' from loads where id='$SL'" >/dev/null
chk "na promie (FERRY): bez GPS_SILENT" "$(Q "select count(*) from sms_outbox where kind='GPS_SILENT'")" 0
$PSQL -c "set session_replication_role=replica; update loads set status='AT_SITE', updated_at=now() - interval '3 hours' where id='$SL'; insert into load_events (load_id, event_type, occurred_at, payload) values ('$SL', 'STATUS_AUTO', now() - interval '30 minutes', '{\"to\":\"AT_SITE\"}')" >/dev/null
chk "AT_SITE od 30 min: skan bez UNLOAD_CONFIRM" "$(Q "select sms_unload_confirm_scan()")" 0
chk "AT_SITE od ≥ 2 h bez MILESTONE_UNLOADED: UNLOAD_CONFIRM (sv); ponowny skan bez duplikatu" "$(Q "select sms_unload_confirm_scan(now() + interval '2 hours')")/$(Q "select sms_unload_confirm_scan(now() + interval '3 hours')")/$(Q "select count(*)||'/'||bool_and(body like '%du ar pa Stegra Boden. Bekrafta LOSSAD%')::text from sms_outbox where kind='UNLOAD_CONFIRM' and load_id='$SL'")" "1/0/1/true"
$PSQL -c "delete from sms_outbox where kind='UNLOAD_CONFIRM'; insert into load_events (load_id, event_type, occurred_at, payload) values ('$SL', 'MILESTONE_UNLOADED', now(), '{}')" >/dev/null
chk "po MILESTONE_UNLOADED (data usługi, kurs faktury): bez prośby" "$(Q "select sms_unload_confirm_scan(now() + interval '5 hours')")" 0
chk "pg_cron: tower-sms-rozladunek co 10 min (w migracji; atrapa bez pg_cron)" "$(grep -c "cron.schedule('tower-sms-rozladunek', '\*/10 \* \* \* \*'" supabase/migrations/0069_sms_8_9_secret.sql)" 1
$PSQL -c "delete from risk_signals where dedup_key like 'test-gps-%'; set session_replication_role=replica; delete from load_events where load_id='$SL' and (event_type='MILESTONE_UNLOADED' or (event_type='STATUS_AUTO' and payload->>'to'='AT_SITE')); delete from positions where load_id='$SL' and raw->>'test'='i3p0'; set session_replication_role=replica; update loads set status='IN_TRANSIT_PL' where id='$SL'" >/dev/null
val "HHL: anulowanie transportu z linkiem" $HHL "select cancel_load('$SL', 'TEST I-3')::text" CANCELLED commit
chk "anulowanie: LOAD_CANCELLED" "$(Q "select count(*) from sms_outbox where kind='LOAD_CANCELLED' and load_id='$SL'")" 1
DID=$(Q "select id from sms_devices where revoked_at is null")
val "HHL: odwołanie urządzenia" $HHL "select sms_revoke_device('$DID')::text" true commit
chk "odwołane urządzenie: pobranie odrzucone" "$(AN "select count(*) from sms_pull('$DEVTOK')" | grep -c 'odwołane urządzenie')" 1
$PSQL -c "delete from notifications where template in ('SMS_FALLBACK','SMS_GATEWAY_SILENT'); delete from risk_signals where dedup_key like 'sms-gateway:%'; delete from sms_outbox; delete from sms_heartbeats; delete from sms_devices; set session_replication_role=replica; update loads set status='PLANNED', driver_phone=null, driver_phone_country='PL', sailing_id=null where id='$SL'; delete from driver_tokens where load_id='$SL'; delete from sailings where id='$SA'" >/dev/null

echo; echo "[R-2] blokada wiadomości do osób zewnętrznych przed umowami RODO (0068)"
$PSQL -c "update security_flags set enabled=false where key='EXTERNAL_MESSAGING'" >/dev/null
DEV2=$(run $HHL "select sms_issue_device('Pixel R2 test')" commit | grep '^sd_')
$PSQL -c "insert into sms_outbox (kind, to_e164, locale, body, priority) values ('WINDOW_CHANGE','+46701234567','sv','TOWER X: test R2', 100)" >/dev/null
err "SMS testowy na numer spoza listy odrzucony" $HHL "select sms_send_test('+48600000001')" "listy numerów testowych"
err "KSH: numer testowy odrzucony" $KSH "select sms_add_test_number('+48600000001','x')" "wyłącznie HHL"
val "HHL: numer testowy dodany" $HHL "select sms_add_test_number('+48600000001','telefon HHL')::text" true commit
val "HHL: SMS testowy zakolejkowany" $HHL "select (sms_send_test('+48600000001') is not null)::text" true commit
chk "przed R-2 telefon dostaje tylko SMS testowy (SMS do kierowcy zostaje w kolejce)" "$(AN "select string_agg(body, ',') from sms_pull('$DEV2', 5)")/$(Q "select status from sms_outbox where body='TOWER X: test R2'")" "Watch Tower: SMS testowy bramki./QUEUED"
chk "e-mail na adres zewnętrzny (bez konta): BLOCKED_R2 (nie wychodzi)" "$(Q "insert into notifications (channel, recipient, template) values ('EMAIL','dispo@scx.example','SMS_FALLBACK') returning status")" BLOCKED_R2
chk "e-mail na log-mar.pl: PENDING" "$(Q "insert into notifications (channel, recipient, template) values ('EMAIL','ops@log-mar.pl','SMS_FALLBACK') returning status")" PENDING
chk "próba odblokowania (UPDATE na PENDING) nadal BLOCKED_R2" "$(Q "update notifications set status='PENDING' where recipient='dispo@scx.example' returning status")" BLOCKED_R2
chk "0133: e-mail do konta w app_users (nie log-mar): PENDING" "$(Q "insert into notifications (channel, recipient, template) select 'EMAIL', email::text, 'SMS_FALLBACK' from app_users where email='hhl@test' returning status")" PENDING
$PSQL -c "insert into user_invites (email, org_id, role) values ('invitee@example.com','00000000-0000-0000-0000-00000000a001','HHL_OPS') on conflict do nothing" >/dev/null
chk "0133: e-mail do aktywnego zaproszenia: PENDING" "$(Q "insert into notifications (channel, recipient, template) values ('EMAIL','invitee@example.com','SMS_FALLBACK') returning status")" PENDING
chk "centrum powiadomień (IN_APP) bez zmian" "$(Q "insert into notifications (channel, recipient, template) values ('IN_APP','dispo@scx.example','TEST') returning status")" PENDING
err "KSH: włączenie wiadomości zewnętrznych odrzucone" $KSH "select admin_set_external_messaging(true)" "wyłącznie administrator HHL"
val "HHL_ADMIN: włączenie (po R-2) z wpisem w dzienniku" $HHL "select admin_set_external_messaging(true)::text" true commit
chk "po włączeniu: e-mail zewnętrzny PENDING, SMS do kierowcy wydawany" "$(Q "insert into notifications (channel, recipient, template) values ('EMAIL','dispo2@scx.example','SMS_FALLBACK') returning status")/$(AN "select count(*) from sms_pull('$DEV2', 5)")/$(Q "select count(*) from audit_log where action='EXTERNAL_MESSAGING_SET'")" "PENDING/1/1"
$PSQL -c "update security_flags set enabled=false where key='EXTERNAL_MESSAGING'; delete from notifications where recipient in ('dispo@scx.example','dispo2@scx.example','ops@log-mar.pl','invitee@example.com') or recipient in (select email::text from app_users where email='hhl@test'); delete from user_invites where email='invitee@example.com'; delete from sms_outbox; delete from sms_test_numbers; delete from sms_devices; delete from audit_log where action='EXTERNAL_MESSAGING_SET'" >/dev/null
chk "stan końcowy: wiadomości zewnętrzne wyłączone" "$(Q "select enabled from security_flags where key='EXTERNAL_MESSAGING'")" f

echo; echo "[I-20] ogólny dziennik audytu tabel biznesowych (0072 + HIST-11/0118)"
chk "wyzwalacz trg_audit_row na 7 tabelach I-20" "$(Q "select count(distinct tgrelid::regclass::text) from pg_trigger where tgname='trg_audit_row' and tgrelid::regclass::text in ('loads','shipment_items','invoices','invoice_lines','rate_cards','rate_rules','sefs_parameters')")" 7
chk "HIST-11: trg_audit_row >= 30 tabel biznesowych" "$(Q "select (count(distinct tgrelid) >= 30)::text from pg_trigger where tgname='trg_audit_row' and not tgisinternal")" "true"
chk "HIST-11: kolumna audit_log.source" "$(Q "select count(*) from information_schema.columns where table_schema='public' and table_name='audit_log' and column_name='source'")" 1
chk "HIST-11: admin_audit_history EXECUTE tylko authenticated" "$(Q "select has_function_privilege('authenticated','admin_audit_history(timestamptz,timestamptz,uuid,text,text,text,int,int)','execute')::text||has_function_privilege('anon','admin_audit_history(timestamptz,timestamptz,uuid,text,text,text,int,int)','execute')::text")" "truefalse"
$PSQL -c "delete from audit_log where action like 'ROW_%'" >/dev/null
val "HHL: zmiana transportu (numer rezerwacji promu)" $HHL "update loads set ferry_booking_ref='AUD-20' where id='$L1' returning ferry_booking_ref" "AUD-20" commit
chk "ROW_UPDATE loads: kto (HHL), tylko zmieniona kolumna, stara i nowa wartość" "$(Q "select count(*)||'/'||bool_and(u.auth_id='$HHL')::text||'/'||bool_and(a.new_value->>'ferry_booking_ref'='AUD-20' and a.old_value ? 'ferry_booking_ref' and not a.new_value ? 'status')::text from audit_log a join app_users u on u.id=a.user_id where a.action='ROW_UPDATE' and a.entity='loads' and a.entity_id='$L1'")" "1/true/true"
$PSQL -c "select set_config('tower.eta_ctx','on',false); update loads set eta_site=now(), delay_minutes=5, eta_computed_at=now() where id='$L1'" >/dev/null
chk "przeliczenie ETA (tylko eta_*/delay_minutes): bez wiersza w dzienniku" "$(Q "select count(*) from audit_log where action='ROW_UPDATE' and entity='loads' and entity_id='$L1'")" 1
$PSQL -c "set session_replication_role=replica; update loads set driver_phone=null where id='$L1'; set session_replication_role=origin; update loads set driver_phone='+48600111222', driver_name='Jan Test' where id='$L1'" >/dev/null
chk "dane osobowe kierowcy: w dzienniku „[dane osobowe]”, nie numer" "$(Q "select count(*)||'/'||bool_and(new_value->>'driver_phone'='[dane osobowe]' and new_value->>'driver_name'='[dane osobowe]')::text||'/'||(select count(*) from audit_log where new_value::text like '%600111222%' or old_value::text like '%Jan Test%') from audit_log where entity='loads' and new_value ? 'driver_phone'")" "1/true/0"
# Część 3 osobno: shipment_items nie ma w seed.sql. Wstawia je część 1 (i kasuje) oraz część 5.
$PSQL -c "insert into shipment_items (project_id, load_id, shipment_code, cargo_class) values ('$P','$L2','I2P3-S1','STANDARD')" >/dev/null
$PSQL -c "update shipment_items set qty = qty + 1 where id=(select id from shipment_items order by id limit 1); update shipment_items set qty = qty - 1 where id=(select id from shipment_items order by id limit 1)" >/dev/null
chk "zmiana pozycji ładunku: ROW_UPDATE shipment_items (qty stara/nowa)" "$(Q "select (count(*) = 2 and bool_and(new_value ? 'qty' and old_value ? 'qty'))::text from audit_log where action='ROW_UPDATE' and entity='shipment_items'")" true
$PSQL -c "insert into loads (project_id, order_no, status) values ('$P', 'AUD-NEW-1', 'PLANNED')" >/dev/null
chk "nowy transport: ROW_INSERT loads z pełnym wierszem" "$(Q "select count(*)||'/'||bool_and(new_value->>'order_no'='AUD-NEW-1' and old_value is null)::text from audit_log where action='ROW_INSERT' and entity='loads' and new_value->>'order_no'='AUD-NEW-1'")" "1/true"
$PSQL -c "delete from loads where order_no='AUD-NEW-1'" >/dev/null
chk "usunięcie transportu: ROW_DELETE loads (stara wartość, bez nowej)" "$(Q "select count(*)||'/'||bool_and(old_value->>'order_no'='AUD-NEW-1' and new_value is null)::text from audit_log where action='ROW_DELETE' and entity='loads' and old_value->>'order_no'='AUD-NEW-1'")" "1/true"
val "KSH: dziennik audytu niewidoczny (tylko HHL_ADMIN)" $KSH "select count(*) from audit_log where action like 'ROW_%'" 0
err "authenticated: brak EXECUTE audit_row_change" $HHL "select audit_row_change()" "permission denied|trigger functions can only be called"
$PSQL -c "update loads set ferry_booking_ref=null where id='$L1'; set session_replication_role=replica; update loads set driver_phone=null, driver_name=null where id='$L1'" >/dev/null
echo; echo "[I-21] terminy uzupełnienia zasobów przed załadunkiem i eskalacja (0073)"
SCXORG=$(Q "select org_id from app_users where auth_id='$SCX'")
$PSQL -c "set session_replication_role=replica; update loads set carrier_org_id='$SCXORG', status='PLANNED', plan_load_from=now() + interval '30 hours', driver_name=null, driver_phone=null, tractor_plate=null, trailer_plate=null where id='$L2'" >/dev/null
chk "progi awizacji i dokumentów tylko w Opcjach; duplikaty DRIVER/VEHICLE/DOCS usunięte" "$(Q "select (select value_num::int from ops_thresholds where key='AWIZ_EARLY_H')||'/'||(select value_num::int from ops_thresholds where key='AWIZ_LATE_H')||'/'||(select value_num::int from ops_thresholds where key='DOC_WARN_H')||'/'||(select value_num::int from ops_thresholds where key='DOC_CRIT_H')||'/'||(select count(*) from resource_deadlines where kind in ('DRIVER','VEHICLE','DOCS'))")" "48/12/24/6/0"
chk "załadunek za 54 h (poza oknem 48 h): bez ryzyka" "$(Q "select detect_resource_deadlines(now() - interval '24 hours')")" 0
chk "załadunek za 30 h: jeden alarm awizacji (ostrzeżenie)" "$(Q "select detect_resource_deadlines()")/$(Q "select detail->>'rule'||':'||severity||':'||audience from risk_signals where dedup_key='l3:NO_AWIZACJA:$L2' and resolved_at is null")" "1/L3_AWIZ:HIGH:HHL_PRZEWOZNIK"
chk "decyzja awizacji: aplikacja, e-mail tylko jako skrót" "$(Q "select (count(*) filter (where channel='IN_APP') > 0)::text||'/'||count(*) filter (where channel<>'IN_APP' and status is distinct from 'DIGEST') from notifications n where n.template='DECISION_OPEN' and n.load_id='$L2'")" "true/0"
chk "ponowny skan: bez duplikatów" "$(Q "select detect_resource_deadlines()")/$(Q "select count(*) from decisions where detail->>'event_key'='l3:NO_AWIZACJA:$L2'")" "0/1"
val "przewoźnik widzi ryzyko swojego transportu" $SCX "select count(*) from risk_signals where load_id='$L2' and resolved_at is null and detail->>'rule'='L3_AWIZ'" 1
val "KSH (klient) nie widzi ryzyka zasobów przewoźnika" $KSH "select count(*) from risk_signals where load_id='$L2' and detail->>'rule'='L3_AWIZ'" 0
chk "12 h przed załadunkiem: ta sama decyzja, poziom krytyczny" "$(Q "select (detect_resource_deadlines(now() + interval '20 hours') >= 1)::text")/$(Q "select severity::text from risk_signals where dedup_key='l3:NO_AWIZACJA:$L2' and resolved_at is null")/$(Q "select count(*) from decisions where detail->>'event_key'='l3:NO_AWIZACJA:$L2'")/$(Q "select detail->>'level' from decisions where detail->>'event_key'='l3:NO_AWIZACJA:$L2'")" "true/CRITICAL/1/critical"
$PSQL -c "update loads set driver_name='Kierowca Test', driver_phone='+48600000999' where id='$L2'" >/dev/null
chk "sam kierowca nie zamyka alarmu — brakuje ciągnika i naczepy" "$(Q "select detect_resource_deadlines()")/$(Q "select detail->>'rule' from risk_signals where dedup_key='l3:NO_AWIZACJA:$L2' and resolved_at is null")" "0/L3_AWIZ"
$PSQL -c "update loads set tractor_plate='PO 100', trailer_plate='NA 100' where id='$L2'" >/dev/null
chk "awizacja uzupełniona: alarm zamknięty, decyzja nieaktualna" "$(Q "select detect_resource_deadlines()")/$(Q "select count(*) from risk_signals where dedup_key='l3:NO_AWIZACJA:$L2' and resolved_at is null")/$(Q "select resolution_note from decisions where detail->>'event_key'='l3:NO_AWIZACJA:$L2'")" "0/0/nieaktualna — warunek ustał"
$PSQL -c "set session_replication_role=replica; update loads set plan_load_from=now() + interval '10 hours' where id='$L2'" >/dev/null
chk "brak polisy 10 h przed załadunkiem: jeden alarm dokumentów (ostrzeżenie)" "$(Q "select detect_resource_deadlines()")/$(Q "select severity::text from risk_signals where dedup_key='l3:DOC_MISSING:$L2' and resolved_at is null")/$(Q "select count(*) from decisions where detail->>'event_key'='l3:DOC_MISSING:$L2'")" "1/HIGH/1"
chk "pg_cron: tower-zasoby co 15 min (w migracji)" "$(grep -c "cron.schedule('tower-zasoby', '7,22,37,52 \* \* \* \*'" supabase/migrations/0073_resource_deadlines.sql)" 1
err "KSH: zmiana terminów odrzucona" $KSH "update resource_deadlines set lead_h=1 where kind='DRIVER' returning kind" "permission denied"
$PSQL -c "delete from notifications where template='RESOURCE_DEADLINE'; delete from risk_signals where dedup_key like 'RES:%'; set session_replication_role=replica; update loads set status='PLANNED', carrier_org_id=null, driver_name=null, driver_phone=null, plan_load_from=null where id='$L2'" >/dev/null
echo; echo "[I-23] odsiewanie duplikatów powiadomień (unikalny dedup_key)"
chk "unikalny indeks notifications_dedup_key_idx (dedup_key not null)" "$(Q "select count(*) from pg_indexes where tablename='notifications' and indexname='notifications_dedup_key_idx' and indexdef like '%UNIQUE%' and indexdef like '%dedup_key IS NOT NULL%'")" 1
chk "ten sam dedup_key dwa razy: jeden wiersz (on conflict do nothing), drugi zwykły INSERT odrzucony" "$(Q "insert into notifications (channel, recipient, template, dedup_key) values ('IN_APP','ops@log-mar.pl','ORDER_NO_MISSING','i23:test') on conflict (dedup_key) where dedup_key is not null do nothing; insert into notifications (channel, recipient, template, dedup_key) values ('IN_APP','ops@log-mar.pl','ORDER_NO_MISSING','i23:test') on conflict (dedup_key) where dedup_key is not null do nothing; select count(*) from notifications where dedup_key='i23:test'")/$($PSQL -c "insert into notifications (channel, recipient, template, dedup_key) values ('IN_APP','ops@log-mar.pl','ORDER_NO_MISSING','i23:test')" 2>&1 | grep -c notifications_dedup_key_idx)" "1/1"
$PSQL -c "delete from notifications where dedup_key='i23:test'" >/dev/null
echo; echo "[9.8] odsiewanie duplikatów: sygnały ryzyka i kolejka SMS"
chk "unikalny indeks risk_signals(dedup_key) tylko dla otwartych (resolved_at is null)" "$(Q "select count(*) from pg_indexes where tablename='risk_signals' and indexdef like '%UNIQUE%' and indexdef like '%dedup_key IS NOT NULL%' and indexdef like '%resolved_at IS NULL%'")" 1
chk "unikalny dedup_key w sms_outbox" "$(Q "select count(*) from pg_indexes where tablename='sms_outbox' and indexdef like '%UNIQUE%' and indexdef like '%(dedup_key)%'")" 1
chk "raise_risk dwa razy z tym samym kluczem: 1 otwarty sygnał" "$(Q "select raise_risk('$L1','SEQUENCE','HIGH','t98',null,'d98:test'); select raise_risk('$L1','SEQUENCE','HIGH','t98',null,'d98:test'); select count(*) from risk_signals where dedup_key='d98:test'")" 1
chk "po rozwiązaniu sygnału ten sam klucz otwiera nowy (powrót problemu nie jest duplikatem)" "$(Q "update risk_signals set resolved_at=now() where dedup_key='d98:test'; select raise_risk('$L1','SEQUENCE','HIGH','t98',null,'d98:test'); select count(*)||'/'||count(*) filter (where resolved_at is null) from risk_signals where dedup_key='d98:test'")" "2/1"
$PSQL -c "delete from risk_signals where dedup_key='d98:test'" >/dev/null
A98=$(Q "select job_watchdog(); select count(*) from risk_signals where resolved_at is null and kind='JOB_FAILURE'" | tail -1); B98=$(Q "select job_watchdog(); select count(*) from risk_signals where resolved_at is null and kind='JOB_FAILURE'" | tail -1)
chk "job_watchdog dwa razy pod rząd: drugi przebieg nie dokłada sygnałów (>0 za pierwszym)" "$([ "$A98" -gt 0 ] && echo "$B98" || echo "brak:$A98")" "$A98"
echo; echo "[I-7a] dane kierowcy dla KSH na stałe (0114; było §1.5/0076 ±24 h)"
SCXO=$(Q "select org_id from app_users where auth_id='$SCX'")
$PSQL -c "set session_replication_role=replica; update loads set carrier_org_id='$SCXO', driver_name='Jan Probny', driver_phone='600123456', driver_phone_country='PL', plan_delivery_from=now() + interval '10 days' where id='$L1'" >/dev/null
chk "authenticated/anon: brak SELECT kolumn driver_name i driver_phone (reszta kolumn tak)" "$(Q "select has_column_privilege('authenticated','loads','driver_phone','select')::text||has_column_privilege('authenticated','loads','driver_name','select')::text||has_column_privilege('anon','loads','driver_phone','select')::text||has_column_privilege('authenticated','loads','status','select')::text")" "falsefalsefalsetrue"
err "KSH: select driver_phone z loads odrzucony" $KSH "select driver_phone from loads limit 1" "permission denied"
err "przewoźnik: select driver_phone z loads odrzucony (tylko RPC)" $SCX "select driver_phone from loads limit 1" "permission denied"
val "HHL: load_driver_contacts — imię i telefon" $HHL "select driver_name||'/'||driver_phone from load_driver_contacts() where load_id='$L1'" "Jan Probny/600123456"
val "przewoźnik transportu: load_driver_contacts — imię i telefon" $SCX "select driver_name||'/'||driver_phone from load_driver_contacts() where load_id='$L1'" "Jan Probny/600123456"
val "KSH poza dawnym ±24 h: pełne dane (imię + telefon)" $KSH "select driver_name||'/'||driver_phone from load_driver_contacts() where load_id='$L1'" "Jan Probny/600123456"
$PSQL -c "set session_replication_role=replica; update loads set plan_delivery_from=now() + interval '3 hours' where id='$L1'" >/dev/null
val "KSH w oknie dostawy: nadal pełne dane" $KSH "select driver_name||'/'||driver_phone from load_driver_contacts() where load_id='$L1'" "Jan Probny/600123456"
$PSQL -c "set session_replication_role=replica; update loads set carrier_org_id=null, driver_name=null, driver_phone=null, plan_delivery_from=null where id='$L1'" >/dev/null
echo; echo "[I-22] szablony mapowania kolumn importu (0077)"
err "KSH: zapis szablonu odrzucony" $KSH "select import_template_save('$P','x','{\"shipmentCode\":\"A\",\"qty\":\"B\"}','a|b')" "wyłącznie HHL"
err "HHL: nieznane pole odrzucone" $HHL "select import_template_save('$P','x','{\"shipmentCode\":\"A\",\"qty\":\"B\",\"cena\":\"C\"}','a|b|c')" "Nieznane pole"
err "HHL: brak pola wymaganego (ilość) odrzucony" $HHL "select import_template_save('$P','x','{\"shipmentCode\":\"A\"}','a')" "co najmniej pól"
val "HHL: szablon zapisany" $HHL "select (import_template_save('$P','Układ B','{\"shipmentCode\":\"Shipment ID\",\"qty\":\"Qty\"}','qty|shipment id') is not null)::text" true commit
val "HHL: ten sam układ ponownie = aktualizacja, nie duplikat" $HHL "select (import_template_save('$P','Układ B2','{\"shipmentCode\":\"Shipment ID\",\"qty\":\"Qty\"}','qty|shipment id') is not null)::text" true commit
chk "jeden szablon na układ, nazwa zaktualizowana, wpis w audit_log" "$(Q "select count(*)||'/'||max(name)||'/'||((select count(*) from audit_log where action='IMPORT_TEMPLATE_SAVE')>=2) from import_column_templates where header_signature='qty|shipment id'")" "1/Układ B2/true"
val "KSH: szablony niewidoczne (RLS)" $KSH "select count(*) from import_column_templates" 0
err "HHL: bezpośredni INSERT odrzucony (tylko RPC)" $HHL "insert into import_column_templates (project_id, name, column_map, header_signature) values ('$P','x','{}','z')" "permission denied"
$PSQL -c "delete from import_column_templates where header_signature='qty|shipment id'" >/dev/null
fi # tower-i2-part 3

if _i2_part_ok 4; then
echo; echo "[III-6] wymagalność i terminy dokumentów, wersje, widoczność per organizacja (0078)"
chk "projekt ma 7 wymagań startowych (seed przez wyzwalacz projektu)" "$(Q "select count(*) from doc_requirements where project_id='$P'")" "7"
err "KSH: zmiana wymagalności odrzucona" $KSH "select doc_requirement_set('$P','CMR',true,'CARRIER','AT_LOAD',4)" "wyłącznie HHL"
err "HHL: nieznane zdarzenie odniesienia odrzucone" $HHL "select doc_requirement_set('$P','CMR',true,'CARRIER','KIEDYS',4)" "Nieznane zdarzenie"
val "HHL: CMR do 4 h po załadunku zapisane" $HHL "select (doc_requirement_set('$P','CMR',true,'CARRIER','AT_LOAD',4) is not null)::text" true commit
chk "wartość zmieniona + audit_log DOC_REQUIREMENT_SET ze starą wartością" "$(Q "select r.offset_hours||'/'||(select (old_value->>'offset_hours') from audit_log where action='DOC_REQUIREMENT_SET' order by id desc limit 1) from doc_requirements r where project_id='$P' and category='CMR'")" "4/2"
val "KSH i SCX czytają wymagania (konfiguracja)" $SCX "select count(*) from doc_requirements where project_id='$P'" 7
L9=33333333-0000-0000-0000-0000000006c9
$PSQL -c "insert into loads (id, project_id, carrier_org_id, order_no, plan_load_date, plan_delivery_date) values ('$L9','$P','00000000-0000-0000-0000-00000000a003','KSH/9', current_date-3, current_date+2)" >/dev/null
$PSQL -c "update loads set plan_load_date=current_date-3, plan_delivery_date=current_date+2 where id='$L9'" >/dev/null
val "SCX: zezwolenie PL transportu z załadunkiem 3 dni temu = OVERDUE" $SCX "select state from doc_requirements_status('$P') where load_id='$L9' and category='PERMIT_PL'" OVERDUE
val "SCX: POD przed dostawą = MISSING (termin nie minął)" $SCX "select state from doc_requirements_status('$P') where load_id='$L9' and category='POD'" MISSING
val "stan tylko dla kategorii wymaganych per transport (bez polisy): 6 na transport" $SCX "select count(*) from doc_requirements_status('$P') where load_id='$L9'" 6
val "SCX: po wgraniu CMR (create_document) stan OK" $SCX "select count(*) from create_document('$L9','CMR','cmr1.pdf','application/pdf',100)" 1 commit
val "…CMR = OK" $SCX "select state from doc_requirements_status('$P') where load_id='$L9' and category='CMR'" OK
val "SCX: druga rejestracja CMR" $SCX "select count(*) from create_document('$L9','CMR','cmr2.pdf','application/pdf',100)" 1 commit
D1=$(Q "select id from documents where load_id='$L9' and file_name='cmr1.pdf'"); D2=$(Q "select id from documents where load_id='$L9' and file_name='cmr2.pdf'")
err "KSH: oznaczenie cudzego pliku jako nowej wersji odrzucone" $KSH "select document_supersede('$D2','$D1')" "tylko autor"
val "SCX: cmr2 = nowa wersja cmr1 → wersja 2" $SCX "select document_supersede('$D2','$D1')" 2 commit
chk "cmr1 zastąpiony, cmr2 wskazuje poprzednika, wpis audit_log" "$(Q "select (select superseded_at is not null from documents where id='$D1')::text||'/'||(select supersedes='$D1' from documents where id='$D2')::text||'/'||(select count(*)>0 from audit_log where action='DOCUMENT_NEW_VERSION' and entity_id='$D2')::text")" "true/true/true"
err "ponowne zastąpienie tej samej wersji odrzucone" $SCX "select document_supersede('$D2','$D1')" "już"
err "wersja innej kategorii odrzucona" $SCX "select document_supersede((select id from create_document('$L9','POD','pod.pdf','application/pdf',100)),'$D2')" "tego samego transportu i kategorii"
$PSQL -c "insert into organizations (id, code, name, kind) values ('00000000-0000-0000-0000-00000000a009','CX2','Inny przewoźnik','CARRIER') on conflict do nothing;
  insert into app_users (auth_id, org_id, email, role) values ('11111111-0000-0000-0000-000000000009','00000000-0000-0000-0000-00000000a009','cx2@test','CARRIER_DISPATCH') on conflict do nothing;
  insert into documents (project_id, category, storage_path, file_name, uploaded_by) values ('$P','INSURANCE','-','polisa-cx2.pdf',(select id from app_users where email='cx2@test'))" >/dev/null
val "SCX nie widzi polisy innego przewoźnika (dokument bez transportu)" $SCX "select count(*) from documents where file_name='polisa-cx2.pdf'" 0
val "KSH widzi polisę przewoźnika (visible_to: CLIENT)" $KSH "select count(*) from documents where file_name='polisa-cx2.pdf'" 1
val "drugi przewoźnik widzi własną polisę" 11111111-0000-0000-0000-000000000009 "select count(*) from documents where file_name='polisa-cx2.pdf'" 1
$PSQL -c "delete from documents where load_id='$L9' or file_name='polisa-cx2.pdf'; update loads set status='CANCELLED' where id='$L9'; delete from app_users where email='cx2@test'; delete from organizations where code='CX2'" >/dev/null
echo; echo "[III-7] ścieżka sporu i akceptacji faktury (0079)"
IC=44444444-0000-0000-0000-00000000000c; IR=44444444-0000-0000-0000-0000000000ee
$PSQL -c "update invoices set verification_status='DO_WERYFIKACJI', dispute_note=null, payment_status='NIEOPLACONA', paid_at=null where id in ('$IC','$IR')" >/dev/null 2>&1
N0=$(Q "select count(*) from invoice_dispute_events")
val "KSH: spór faktury HHL z uzasadnieniem" $KSH "update invoices set verification_status='SPORNA', dispute_note='stawka poz. 1' where id='$IR' returning verification_status" SPORNA commit
chk "wpis OPENED z uzasadnieniem + powiadomienie HHL (INVOICE_DISPUTED)" "$(Q "select (select kind||'/'||note from invoice_dispute_events where invoice_id='$IR' order by id desc limit 1)||'/'||(select count(*)>0 from notifications where template='INVOICE_DISPUTED' and payload->>'invoice_id'='$IR')")" "OPENED/stawka poz. 1/true"
err "KSH (odbiorca) nie odpowiada jako wystawca" $KSH "select invoice_dispute_reply('$IR','x')" "wyłącznie wystawca"
err "SCX (obca faktura) nie odpowiada" $SCX "select invoice_dispute_reply('$IR','x')" "wyłącznie wystawca"
err "HHL: pusta odpowiedź odrzucona" $HHL "select invoice_dispute_reply('$IR','  ')" "wymaga treści"
val "HHL (wystawca): odpowiedź na spór" $HHL "select (invoice_dispute_reply('$IR','stawka wg aneksu 2') > 0)::text" true commit
chk "wpis REPLY + powiadomienie KSH (INVOICE_DISPUTE_REPLY) + audit_log" "$(Q "select (select kind from invoice_dispute_events where invoice_id='$IR' order by id desc limit 1)||'/'||(select count(*)>0 from notifications n join app_users u on u.id=n.user_id where n.template='INVOICE_DISPUTE_REPLY' and u.auth_id='$KSH')||'/'||(select count(*)>0 from audit_log where action='INVOICE_DISPUTE_REPLY' and entity_id='$IR')")" "REPLY/true/true"
val "KSH widzi historię sporu (2 wpisy)" $KSH "select count(*) from invoice_dispute_events where invoice_id='$IR'" 2
val "SCX nie widzi historii sporu cudzej faktury" $SCX "select count(*) from invoice_dispute_events where invoice_id='$IR'" 0
err "bezpośredni INSERT do historii odrzucony" $KSH "insert into invoice_dispute_events (invoice_id, kind) values ('$IR','RESOLVED')" "permission denied"
val "KSH: akceptacja po odpowiedzi → RESOLVED" $KSH "update invoices set verification_status='ZAAKCEPTOWANA' where id='$IR' returning verification_status" ZAAKCEPTOWANA commit
chk "wpis RESOLVED (ZAAKCEPTOWANA) + powiadomienie HHL" "$(Q "select (select kind||'/'||status_to from invoice_dispute_events where invoice_id='$IR' order by id desc limit 1)||'/'||(select count(*)>0 from notifications where template='INVOICE_DISPUTE_RESOLVED' and payload->>'invoice_id'='$IR')")" "RESOLVED/ZAAKCEPTOWANA/true"
err "odpowiedź po rozstrzygnięciu odrzucona" $HHL "select invoice_dispute_reply('$IR','x')" "nie jest w sporze"
val "HHL: spór faktury kosztowej SCX" $HHL "update invoices set verification_status='SPORNA', dispute_note='brak CMR' where id='$IC' returning verification_status" SPORNA commit
err "HHL: zapłata faktury kosztowej w sporze wstrzymana" $HHL "select mark_invoice_paid('$IC', current_date)" "zapłata wstrzymana"
val "SCX (wystawca) odpowiada na spór" $SCX "select (invoice_dispute_reply('$IC','CMR dosłany') > 0)::text" true commit
echo "  [0082] korekta z dokumentem"
DK=$(run $SCX "select id from create_document(null,'INVOICE','korekta-1.pdf','application/pdf',1000,'$P')" commit | grep -E '^[0-9a-f-]{36}$' | head -1)
DH=$(run $HHL "select id from create_document(null,'INVOICE','korekta-hhl.pdf','application/pdf',1000,'$P')" commit | grep -E '^[0-9a-f-]{36}$' | head -1)
chk "SCX i HHL rejestrują pliki faktur (bez transportu)" "$([ -n "$DK" ] && [ -n "$DH" ] && echo ok)" ok
err "SCX: korekta z cudzym plikiem odrzucona" $SCX "select invoice_dispute_reply('$IC','korekta','$DH')" "Korekta:"
DX=$(run $SCX "select id from create_document(null,'INVOICE','inna.pdf','application/pdf',1000,'$P')" commit | grep -E '^[0-9a-f-]{36}$' | head -1)
$PSQL -c "insert into invoice_documents (invoice_id, document_id, role) values ('$IR','$DX','CMR')" >/dev/null
err "SCX: korekta z plikiem powiązanym z inną fakturą odrzucona" $SCX "select invoice_dispute_reply('$IC','korekta','$DX')" "Korekta:"
$PSQL -c "delete from documents where id='$DX'" >/dev/null
val "SCX: korekta z własnym świeżym plikiem" $SCX "select (invoice_dispute_reply('$IC','faktura korygująca KOR/1','$DK') > 0)::text" true commit
chk "plik korekty powiązany z fakturą jako KOREKTA, wpis ma document_id, audit_log" "$(Q "select (select role from invoice_documents where document_id='$DK')||'/'||(select count(*) from invoice_dispute_events where document_id='$DK')||'/'||(select count(*)>0 from audit_log where action='INVOICE_DISPUTE_CORRECTION' and entity_id='$IC')")" "KOREKTA/1/true"
val "KSH (nie strona faktury kosztowej) nie widzi pliku korekty SCX" $KSH "select count(*) from documents where id='$DK'" 0
err "ten sam plik nie trafi drugi raz jako korekta" $SCX "select invoice_dispute_reply('$IC','jeszcze raz','$DK')" "Korekta:"
$PSQL -c "update invoices set verification_status='SPORNA', dispute_note='stawka poz. 2' where id='$IR'" >/dev/null
val "KSH (odbiorca faktury HHL) nie widzi pliku korekty przed wysłaniem" $KSH "select count(*) from documents where id='$DH'" 0
val "HHL: korekta faktury przychodowej z plikiem" $HHL "select (invoice_dispute_reply('$IR','korekta KOR/2','$DH') > 0)::text" true commit
chk "wpis CORRECTION z plikiem + powiadomienie KSH" "$(Q "select (select kind from invoice_dispute_events where document_id='$DH')||'/'||(select count(*) from notifications n join app_users u on u.id=n.user_id where n.template='INVOICE_DISPUTE_REPLY' and u.auth_id='$KSH')")" "CORRECTION/2"
val "KSH widzi plik korekty po wysłaniu (rola KOREKTA w module faktur)" $KSH "select count(*) from documents where id='$DH'" 1
val "SCX nie widzi pliku korekty faktury HHL → KSH" $SCX "select count(*) from documents where id='$DH'" 0
val "HHL: ZGODNA → zapłata możliwa" $HHL "update invoices set verification_status='ZGODNA' where id='$IC'; select mark_invoice_paid('$IC', current_date); select payment_status from invoices where id='$IC'" OPLACONA commit
chk "liczba wpisów historii: 3+2 (HHL/KSH: ponowny spór + korekta) + 4 (SCX, w tym korekta)" "$(( $(Q "select count(*) from invoice_dispute_events") - N0 ))" "9"
$PSQL -c "update invoices set payment_status='NIEOPLACONA', paid_at=null, verification_status='DO_WERYFIKACJI', dispute_note=null where id in ('$IC','$IR')" >/dev/null 2>&1
echo; echo "[I-25] opóźnienie od końca okna dostawy (0080) — przeliczenie na transporcie"
$PSQL -c "set session_replication_role=replica; update loads set status='IN_TRANSIT_SE', plan_delivery_date='2026-10-01', plan_delivery_from='2026-10-01 08:00 Europe/Stockholm', plan_delivery_to='2026-10-01 12:00 Europe/Stockholm' where id='$L2'; set session_replication_role=origin;" >/dev/null
$PSQL -c "insert into positions (load_id, ts, geom_raw, source) select '$L2', now(), st_setsrid(st_makepoint(21.0, 63.5),4326), source from positions where load_id='$L2' limit 1" >/dev/null
chk "transport z oknem: delay_minutes = ETA z GPS − koniec okna (po refresh_load_eta)" "$(Q "select refresh_load_eta('$L2'); select (eta_site is not null and delay_minutes is not distinct from greatest(0, round(extract(epoch from eta_site - plan_delivery_to)/60))::int)::text from loads where id='$L2'")" "true"
echo; echo "[6.5] walidator zezwoleń i wymiarów zestawu (0081)"
LP=33333333-0000-0000-0000-0000000006d1
$PSQL -c "insert into loads (id, project_id, carrier_org_id, order_no, status) values ('$LP','$P','00000000-0000-0000-0000-00000000a003','KSH/P1','DOCS_PENDING')" >/dev/null
$PSQL -c "update loads set plan_load_date=current_date+3, hhl_order_no='HHL/P1' where id='$LP'" >/dev/null
chk "anon bez uprawnień do permits; authenticated tylko SELECT" "$(Q "select has_table_privilege('anon','permits','select')::text||'/'||has_table_privilege('authenticated','permits','insert')::text||'/'||has_table_privilege('authenticated','permits','select')::text")" "false/false/true"
err "KSH nie zapisuje zezwoleń" $KSH "select permit_save('$P','PL','PL/1',current_date,current_date+30,30,4,4.5,60)" "HHL albo przewoźnik"
err "SCX: kraj spoza PL/SE odrzucony" $SCX "select permit_save('$P','DE','DE/1',current_date,current_date+30,30,4,4.5,60)" "PL albo SE"
val "SCX zapisuje zezwolenie PL (dł. ≤ 30 m, szer. ≤ 4 m, wys. ≤ 4,5 m, masa ≤ 60 t)" $SCX "select (permit_save('$P','PL','PL/7/2026',current_date,current_date+30,30,4,4.5,60) is not null)::text" true commit
PM=$(Q "select id from permits where permit_no='PL/7/2026'")
val "SCX łączy zezwolenie z własnym transportem" $SCX "select load_permit_link('$LP','$PM')::text" true commit
err "KSH nie łączy zezwoleń" $KSH "select load_permit_link('$LP','$PM')" "HHL albo przewoźnik transportu"
val "nieznane wymiary zestawu = naruszenie DIMS_UNKNOWN (nie „pasuje”)" $SCX "select ok::text||'/'||array_to_string(breaches,',') from load_permit_status() where load_id='$LP'" "false/DIMS_UNKNOWN"
err "blokada: DOCS_PENDING → READY przy niezgodnym zezwoleniu" $HHL "update loads set status='READY' where id='$LP'" "transport zablokowany"
$PSQL -c "update loads set combo_length_m=32.5, combo_width_m=3.9, combo_height_m=4.4, combo_weight_t=58 where id='$LP'" >/dev/null
val "zestaw 32,5 m przy limicie 30 m → LENGTH" $KSH "select ok::text||'/'||array_to_string(breaches,',')||'/'||array_to_string(missing_countries,',') from load_permit_status() where load_id='$LP'" "false/LENGTH/SE"
err "blokada nadal: długość ponad limit" $SCX "update loads set status='READY' where id='$LP'" "PL PL/7/2026: LENGTH"
$PSQL -c "update loads set combo_length_m=29.8 where id='$LP'" >/dev/null
val "zestaw w limitach → OK (brak SE sygnalizowany, nie blokuje)" $SCX "select ok::text||'/'||array_to_string(missing_countries,',') from load_permit_status() where load_id='$LP'" "true/SE"
val "zgodne zezwolenie: DOCS_PENDING → READY przechodzi" $HHL "update loads set status='READY' where id='$LP' returning status" READY commit
val "KSH widzi zezwolenie powiązane z transportem projektu" $KSH "select count(*) from permits where id='$PM'" 1
$PSQL -c "insert into organizations (id, code, name, kind) values ('00000000-0000-0000-0000-00000000a00b','CX3','Inny przewoźnik 3','CARRIER') on conflict do nothing; insert into app_users (auth_id, org_id, email, role) values ('11111111-0000-0000-0000-00000000000b','00000000-0000-0000-0000-00000000a00b','cx3@test','CARRIER_DISPATCH') on conflict do nothing" >/dev/null
val "inny przewoźnik nie widzi zezwolenia cudzego transportu" 11111111-0000-0000-0000-00000000000b "select count(*) from permits where id='$PM'" 0
err "inny przewoźnik nie łączy z cudzym transportem" 11111111-0000-0000-0000-00000000000b "select load_permit_link('$LP','$PM')" "przewoźnik transportu"
$PSQL -c "delete from load_permits where load_id='$LP'; update loads set status='CANCELLED' where id='$LP'; delete from app_users where email='cx3@test'; delete from organizations where code='CX3'" >/dev/null
$PSQL -c "insert into organizations (id, code, name, kind) values ('00000000-0000-0000-0000-00000000a00b','CX3','Inny przewoźnik 3','CARRIER') on conflict do nothing; insert into app_users (auth_id, org_id, email, role) values ('11111111-0000-0000-0000-00000000000b','00000000-0000-0000-0000-00000000a00b','cx3@test','CARRIER_DISPATCH') on conflict do nothing" >/dev/null
echo; echo "[6.4] formularz zezwoleń: zapis + powiązanie, odłączenie przed READY (0086)"
LF=33333333-0000-0000-0000-0000000064f1
$PSQL -c "insert into loads (id, project_id, carrier_org_id, order_no, status) values ('$LF','$P','00000000-0000-0000-0000-00000000a003','KSH/F64','PLANNED')" >/dev/null
$PSQL -c "update loads set plan_load_date=current_date+3, hhl_order_no='HHL/F64', carrier_order_no='SCX/F64', combo_length_m=29, combo_width_m=3.9, combo_height_m=4.4, combo_weight_t=58 where id='$LF'" >/dev/null
err "KSH nie zapisuje zezwolenia transportu" $KSH "select load_permit_save('$LF','PL','PL/F1',current_date,current_date+30,30,4,4.5,60)" "HHL albo przewoźnik transportu"
err "inny przewoźnik nie zapisuje zezwolenia cudzego transportu" 11111111-0000-0000-0000-00000000000b "select load_permit_save('$LF','PL','PL/F1',current_date,current_date+30,30,4,4.5,60)" "HHL albo przewoźnik transportu"
err "okres ważności odwrócony → odmowa" $SCX "select load_permit_save('$LF','PL','PL/F1',current_date+5,current_date,30,4,4.5,60)" "okres ważności"
err "pilotaż > 5 → odmowa" $SCX "select load_permit_save('$LF','PL','PL/F1',current_date,current_date+30,30,4,4.5,60,6)" "dodatnie"
val "SCX zapisuje zezwolenie PL z organem, pilotażem i trasą — od razu powiązane" $SCX "select (load_permit_save('$LF','PL','PL/F64/2026',current_date,current_date+30,30,4,4.5,60,1,'A1 Gdańsk – DK91','GDDKiA Gdańsk') is not null)::text" true commit
PF=$(Q "select id from permits where permit_no='PL/F64/2026'")
chk "zapisane pola: organ, pilotaż 1, trasa, projekt transportu" "$(Q "select authority||'/'||escort_required||'/'||route_desc||'/'||(project_id='$P')::text from permits where id='$PF'")" "GDDKiA Gdańsk/1/A1 Gdańsk – DK91/true"
chk "powiązanie + audit_log PERMIT_SAVE i PERMIT_LINK" "$(Q "select (select count(*) from load_permits where load_id='$LF' and permit_id='$PF')||'/'||(select count(*) from audit_log where action in ('PERMIT_SAVE','PERMIT_LINK') and (entity_id='$PF' or entity_id='$LF'))")" "1/2"
val "HHL zapisuje zezwolenie SE dla transportu" $HHL "select (load_permit_save('$LF','SE','SE/F64',current_date,current_date+30,30,4,4.5,60) is not null)::text" true commit
val "stan: 2 zezwolenia, zgodne, brak brakujących krajów" $SCX "select permits_linked||'/'||ok::text||'/'||cardinality(missing_countries) from load_permit_status() where load_id='$LF'" "2/true/0"
val "KSH widzi oba zezwolenia transportu (tylko odczyt)" $KSH "select count(*) from permits p join load_permits lp on lp.permit_id=p.id where lp.load_id='$LF'" 2
err "KSH nie odłącza zezwolenia" $KSH "select load_permit_unlink('$LF','$PF')" "HHL albo przewoźnik transportu"
err "odłączenie niepowiązanego → odmowa" $SCX "select load_permit_unlink('$LF',gen_random_uuid())" "nie jest powiązane"
val "SCX odłącza zezwolenie przed READY (audit_log PERMIT_UNLINK)" $SCX "select load_permit_unlink('$LF','$PF')::text" true commit
chk "po odłączeniu: 1 powiązanie, wpis PERMIT_UNLINK, zezwolenie zostaje w projekcie" "$(Q "select (select count(*) from load_permits where load_id='$LF')||'/'||(select count(*) from audit_log where action='PERMIT_UNLINK' and entity_id='$LF')||'/'||(select count(*) from permits where id='$PF')")" "1/1/1"
val "HHL łączy ponownie istniejące zezwolenie" $HHL "select load_permit_link('$LF','$PF')::text" true commit
val "zgodne zezwolenia: PLANNED → READY" $HHL "update loads set status='READY' where id='$LF' returning status" READY commit
err "po READY odłączenie zablokowane (nie obchodzi blokady)" $HHL "select load_permit_unlink('$LF','$PF')" "przed statusem Gotowy"
err "permit_save: przewoźnik bez transportu w projekcie → odmowa" 11111111-0000-0000-0000-00000000000b "select permit_save('$P','PL','PL/X',current_date,current_date+30,30,4,4.5,60)" "tylko w projekcie, w którym ma transport"
$PSQL -c "update loads set status='CANCELLED' where id='$LF'" >/dev/null 2>&1
err "transport anulowany → zapis zezwolenia odrzucony" $HHL "select load_permit_save('$LF','PL','PL/F2',current_date,current_date+30,30,4,4.5,60)" "anulowany"
$PSQL -c "delete from app_users where email='cx3@test'; delete from organizations where code='CX3'" >/dev/null
echo; echo "[III-4] pojazdy pilotujące: dane i awizacja (0087)"
LE=33333333-0000-0000-0000-0000000034e1
$PSQL -c "insert into loads (id, project_id, carrier_org_id, order_no, status) values ('$LE','$P','00000000-0000-0000-0000-00000000a003','KSH/E34','PLANNED')" >/dev/null
$PSQL -c "update loads set plan_load_date=current_date+1, plan_load_from=now() + interval '30 hours', driver_name='Jan Test', driver_phone='+48500000000', tractor_plate='PO1', trailer_plate='PO2' where id='$LE'" >/dev/null
chk "load_escorts: anon 0 uprawnień, authenticated tylko SELECT (kolumnowo od 0090 — bez danych kierowcy pilota)" "$(Q "select has_table_privilege('anon','load_escorts','select')::text||'/'||has_table_privilege('authenticated','load_escorts','insert')::text||'/'||has_column_privilege('authenticated','load_escorts','plate','select')::text")" "false/false/true"
err "SCX nie wstawia bezpośrednio do load_escorts" $SCX "insert into load_escorts (load_id, seq, company, plate) values ('$LE',1,'X','AB1')" "permission denied"
val "SCX: zezwolenie z 2 pilotami powiązane" $SCX "select (load_permit_save('$LE','PL','PL/E34',current_date,current_date+30,null,null,null,null,2) is not null)::text" true commit
val "stan: wymagane 2, awizowane 0, brak 2" $KSH "select required||'/'||assigned||'/'||missing from load_escort_status() where load_id='$LE'" "2/0/2"
chk "awizacja: brak pilotów 24 h przed załadunkiem → RESOURCE_MISSING ESCORT (rk_res_escort)" "$(Q "select detect_resource_deadlines() >= 1")/$(Q "select severity||':'||title_key from risk_signals where dedup_key='RES:ESCORT:$LE' and resolved_at is null")" "t/HIGH:rk_res_escort"
err "KSH nie awizuje pilotów" $KSH "select load_escorts_set('$LE','[]')" "HHL albo przewoźnik transportu"
$PSQL -c "insert into organizations (id, code, name, kind) values ('00000000-0000-0000-0000-00000000a00b','CX3','Inny przewoźnik 3','CARRIER') on conflict do nothing; insert into app_users (auth_id, org_id, email, role) values ('11111111-0000-0000-0000-00000000000b','00000000-0000-0000-0000-00000000a00b','cx3@test','CARRIER_DISPATCH') on conflict do nothing" >/dev/null
err "inny przewoźnik nie awizuje pilotów cudzego transportu" 11111111-0000-0000-0000-00000000000b "select load_escorts_set('$LE','[]')" "HHL albo przewoźnik transportu"
val "inny przewoźnik nie widzi pilotów cudzego transportu" 11111111-0000-0000-0000-00000000000b "select count(*) from load_escorts where load_id='$LE'" 0
err "zła tablica → odmowa" $SCX "select load_escorts_set('$LE','[{\"company\":\"Pilot\",\"plate\":\"!!\"}]')" "Nieprawidłowa tablica"
err "brak firmy → odmowa" $SCX "select load_escorts_set('$LE','[{\"company\":\" \",\"plate\":\"PO 123\"}]')" "Brak firmy"
err "zły zakres → odmowa" $SCX "select load_escorts_set('$LE','[{\"company\":\"Pilot\",\"plate\":\"PO123\",\"scope\":\"DE\"}]')" "Zakres pilotażu"
err "więcej niż 5 → odmowa" $SCX "select load_escorts_set('$LE',(select jsonb_agg(jsonb_build_object('company','P','plate','PO'||g)) from generate_series(1,6) g))" "maks. 5"
val "SCX awizuje 2 pilotów (tablica wielkimi literami, kolejność 1–2)" $SCX "select load_escorts_set('$LE','[{\"company\":\"Pilot-Trans\",\"plate\":\"po 12345\",\"scope\":\"PL\"},{\"company\":\"Följebil AB\",\"plate\":\"ABC 123\",\"scope\":\"SE\"}]')" 2 commit
chk "zapis: 2 wiersze, loads.escort_vehicles = 2, audit_log ESCORTS_SET" "$(Q "select string_agg(seq||':'||plate||':'||scope, ',' order by seq) from load_escorts where load_id='$LE'")/$(Q "select escort_vehicles from loads where id='$LE'")/$(Q "select count(*) from audit_log where action='ESCORTS_SET' and entity_id='$LE'")" "1:PO 12345:PL,2:ABC 123:SE/2/1"
val "KSH widzi pilotów transportu (tylko odczyt)" $KSH "select count(*) from load_escorts where load_id='$LE'" 2
val "stan: wymagane 2, awizowane 2, brak 0" $SCX "select required||'/'||assigned||'/'||missing from load_escort_status() where load_id='$LE'" "2/2/0"
chk "awizacja kompletna → ryzyko ESCORT zamknięte automatycznie" "$(Q "select detect_resource_deadlines()")/$(Q "select count(*) from risk_signals where dedup_key='RES:ESCORT:$LE' and resolved_at is null")" "0/0"
val "HHL zmienia listę na 1 pilota (zastąpienie, audit_log ze starą listą)" $HHL "select load_escorts_set('$LE','[{\"company\":\"Pilot-Trans\",\"plate\":\"PO 12345\"}]')" 1 commit
chk "po zmianie: 1 wiersz, escort_vehicles 1, stara lista w audit_log (2 pozycje)" "$(Q "select count(*) from load_escorts where load_id='$LE'")/$(Q "select escort_vehicles from loads where id='$LE'")/$(Q "select jsonb_array_length(old_value) from audit_log where action='ESCORTS_SET' and entity_id='$LE' order by id desc limit 1")" "1/1/2"
$PSQL -c "update loads set status='CANCELLED' where id='$LE'" >/dev/null 2>&1
err "transport anulowany → awizacja zamknięta" $HHL "select load_escorts_set('$LE','[]')" "zakończony albo anulowany"
$PSQL -c "delete from app_users where email='cx3@test'; delete from organizations where code='CX3'; update risk_signals set resolved_at=now() where dedup_key like 'RES:%:$LE' and resolved_at is null" >/dev/null
echo; echo "[III-5] odtwarzanie przebiegu: load_track (0088)"
LT=33333333-0000-0000-0000-0000000035a1
$PSQL -c "insert into loads (id, project_id, carrier_org_id, order_no, status) values ('$LT','$P','00000000-0000-0000-0000-00000000a003','KSH/T35','PLANNED')" >/dev/null 2>&1
$PSQL -c "insert into positions (load_id, ts, geom_raw, geom_snapped, speed_kmh, source) values
 ('$LT', now() - interval '3 hours', st_setsrid(st_makepoint(17.0, 52.1), 4326), null, 0, 'DRIVER_PWA'),
 ('$LT', now() - interval '2 hours', st_setsrid(st_makepoint(17.5, 52.9), 4326), st_setsrid(st_makepoint(17.51, 52.91), 4326), 78.5, 'DRIVER_PWA'),
 ('$LT', now() - interval '1 hours', st_setsrid(st_makepoint(18.2, 53.8), 4326), null, 81, 'DRIVER_PWA')" >/dev/null 2>&1
chk "anon bez EXECUTE load_track, authenticated z EXECUTE" "$(Q "select has_function_privilege('anon','load_track(uuid,int)','execute')::text||'/'||has_function_privilege('authenticated','load_track(uuid,int)','execute')::text")" "false/true"
val "SCX (przewoźnik transportu): 3 punkty w kolejności czasu, punkt przyciągnięty ma pierwszeństwo" $SCX "select count(*)||'/'||string_agg(lng::text, ',' order by ts) from load_track('$LT')" "3/17,17.51,18.2"
val "KSH (klient projektu) widzi przebieg transportu projektu" $KSH "select count(*) from load_track('$LT')" 3
val "limit 2 → dwa najnowsze punkty, nadal rosnąco" $HHL "select string_agg(lng::text, ',' order by ts) from load_track('$LT', 2)" "17.51,18.2"
$PSQL -c "insert into organizations (id, code, name, kind) values ('00000000-0000-0000-0000-00000000a00b','CX3','Inny przewoźnik 3','CARRIER') on conflict do nothing; insert into app_users (auth_id, org_id, email, role) values ('11111111-0000-0000-0000-00000000000b','00000000-0000-0000-0000-00000000a00b','cx3@test','CARRIER_DISPATCH') on conflict do nothing" >/dev/null
val "inny przewoźnik: 0 punktów (RLS positions_read)" 11111111-0000-0000-0000-00000000000b "select count(*) from load_track('$LT')" 0
$PSQL -c "delete from app_users where email='cx3@test'; delete from organizations where code='CX3'; update loads set status='CANCELLED' where id='$LT'" >/dev/null 2>&1
fi # tower-i2-part 4

if _i2_part_ok 5; then
echo; echo "[III-9] ocena przewoźnika (0089)"
R1=33333333-0000-0000-0000-0000000039a1; R2=33333333-0000-0000-0000-0000000039a2; R3=33333333-0000-0000-0000-0000000039a3
$PSQL -c "set session_replication_role=replica;
 insert into loads (id, project_id, carrier_org_id, order_no, status, plan_delivery_date, plan_delivery_to, actual_delivery_at, delay_owner) values
 ('$R1','$P','00000000-0000-0000-0000-00000000a003','KSH/R1','UNLOADED','2026-09-10','2026-09-10 12:00 Europe/Stockholm','2026-09-10 11:00 Europe/Stockholm',null),
 ('$R2','$P','00000000-0000-0000-0000-00000000a003','KSH/R2','DELIVERED','2026-09-12',null,'2026-09-13 02:00 Europe/Stockholm','CARRIER'),
 ('$R3','$P','00000000-0000-0000-0000-00000000a003','KSH/R3','PLANNED','2026-10-12',null,null,null)" >/dev/null
chk "carrier_ratings: anon 0, authenticated bez INSERT, SELECT kolumnowo: score tak, comment nie (0091)" "$(Q "select has_table_privilege('anon','carrier_ratings','select')::text||'/'||has_table_privilege('authenticated','carrier_ratings','insert')::text||'/'||has_column_privilege('authenticated','carrier_ratings','score','select')::text||'/'||has_column_privilege('authenticated','carrier_ratings','comment','select')::text")" "false/false/true/false"
err "SCX nie ocenia" $SCX "select carrier_rate_load('$R1', 5)" "wyłącznie HHL"
err "KSH nie ocenia" $KSH "select carrier_rate_load('$R1', 5)" "wyłącznie HHL"
err "przed rozładunkiem → odmowa" $HHL "select carrier_rate_load('$R3', 4)" "po rozładunku"
err "ocena spoza 1–5 → odmowa" $HHL "select carrier_rate_load('$R1', 6)" "Ocena 1–5"
val "HHL ocenia transport rozładowany (5)" $HHL "select carrier_rate_load('$R1', 5, 'Bez uwag')::text" true commit
val "HHL ocenia transport dostarczony (2) i zmienia na 3 (nadpisanie)" $HHL "select carrier_rate_load('$R2', 2)::text; select carrier_rate_load('$R2', 3, 'Spóźnienie 2 h')::text" true commit
chk "2 oceny, audit_log CARRIER_RATING ×3, stara wartość przy zmianie" "$(Q "select count(*) from carrier_ratings where load_id in ('$R1','$R2')")/$(Q "select count(*) from audit_log where action='CARRIER_RATING' and entity_id in ('$R1','$R2')")/$(Q "select old_value->>'score' from audit_log where action='CARRIER_RATING' and entity_id='$R2' and old_value is not null")" "2/3/2"
val "D-23: SCX widzi swoje oceny (2, bez notatki)" $SCX "select count(*)||'/'||sum(score) from carrier_ratings" "2/8"
err "D-23: SCX nie czyta notatki HHL (comment)" $SCX "select comment from carrier_ratings" "permission denied"
err "D-23: SCX nie czyta notatki przez carrier_rating_detail" $SCX "select * from carrier_rating_detail('$R1')" "wyłącznie dla HHL"
val "HHL czyta ocenę z notatką (carrier_rating_detail)" $HHL "select score||':'||comment from carrier_rating_detail('$R2')" "3:Spóźnienie 2 h"
$PSQL -c "insert into organizations (id, code, name, kind) values ('00000000-0000-0000-0000-00000000a00b','CX3','Inny przewoźnik 3','CARRIER') on conflict do nothing; insert into app_users (auth_id, org_id, email, role) values ('11111111-0000-0000-0000-00000000000b','00000000-0000-0000-0000-00000000a00b','cx3@test','CARRIER_DISPATCH') on conflict do nothing" >/dev/null
val "D-23: inny przewoźnik nie widzi cudzych ocen (0) i ma pustą kartę" 11111111-0000-0000-0000-00000000000b "select (select count(*) from carrier_ratings)||'/'||(select count(*) from carrier_scorecard())" "0/0"
$PSQL -c "delete from app_users where email='cx3@test'; delete from organizations where code='CX3'" >/dev/null
val "KSH nie widzi ocen (0 wierszy)" $KSH "select count(*) from carrier_ratings" 0
err "karta przewoźnika: KSH odmowa" $KSH "select * from carrier_scorecard()" "wyłącznie dla HHL"
val "D-23: karta SCX = wyłącznie własny wiersz (zrealizowane 2, na czas 1, z własnej winy 1, śr. ocena 4)" $SCX "select count(*)||'/'||max(delivered)||'/'||max(on_time)||'/'||max(late_carrier)||'/'||max(avg_score) from carrier_scorecard('2026-09-01','2026-09-30')" "1/2/1/1/4.00"
val "karta: zrealizowane 2, na czas 1 (R1 przed końcem okna; R2 po północy dnia dostawy), z winy przewoźnika 1, śr. spóźnienie 120 min, śr. ocena 4, ocen 2" $HHL "select delivered||'/'||on_time||'/'||late_carrier||'/'||avg_late_min||'/'||avg_score||'/'||ratings from carrier_scorecard('2026-09-01','2026-09-30') where carrier_org_id='00000000-0000-0000-0000-00000000a003'" "2/1/1/120/4.00/2"
$PSQL -c "set session_replication_role=replica; update loads set status='CANCELLED' where id in ('$R1','$R2','$R3')" >/dev/null
echo; echo "[D-22] kierowca pojazdu pilotującego: imię i telefon (0090)"
LP=33333333-0000-0000-0000-0000000022d1
$PSQL -c "insert into loads (id, project_id, carrier_org_id, order_no, status) values ('$LP','$P','00000000-0000-0000-0000-00000000a003','KSH/D22','PLANNED')" >/dev/null
chk "kolumny danych osobowych: authenticated bez SELECT driver_name/driver_phone, anon bez EXECUTE load_escort_contacts" "$(Q "select has_column_privilege('authenticated','load_escorts','driver_name','select')::text||'/'||has_column_privilege('authenticated','load_escorts','driver_phone','select')::text||'/'||has_function_privilege('anon','load_escort_contacts()','execute')::text")" "false/false/false"
err "zły telefon pilota → odmowa" $SCX "select load_escorts_set('$LP','[{\"company\":\"Pilot\",\"plate\":\"PO1\",\"driver_phone\":\"12\"}]')" "numer krajowy"
err "imię ponad 120 znaków → odmowa" $SCX "select load_escorts_set('$LP',jsonb_build_array(jsonb_build_object('company','Pilot','plate','PO1','driver_name',repeat('x',121))))" "do 120 znaków"
val "SCX awizuje pilota z kierowcą (telefon ze spacjami → krajowy) i drugiego bez kontaktu" $SCX "select load_escorts_set('$LP','[{\"company\":\"Pilot-Trans\",\"plate\":\"PO 22\",\"driver_name\":\"Adam Pilot\",\"driver_phone\":\"+48 600 100 200\"},{\"company\":\"Följebil AB\",\"plate\":\"SE 22\"}]')" 2 commit
val "SCX (przewoźnik transportu) widzi kontakt przez load_escort_contacts" $SCX "select string_agg(seq||':'||driver_name||':'||driver_phone, ',') from load_escort_contacts() where load_id='$LP'" "1:Adam Pilot:600100200"
val "HHL widzi kontakt" $HHL "select count(*) from load_escort_contacts() where load_id='$LP'" 1
val "KSH: load_escort_contacts → 0 wierszy" $KSH "select count(*) from load_escort_contacts()" 0
err "KSH: bezpośredni odczyt driver_phone → brak uprawnień" $KSH "select driver_phone from load_escorts where load_id='$LP'" "permission denied"
val "KSH nadal widzi pojazdy (firma, tablica) bez danych osobowych" $KSH "select string_agg(plate, ',' order by seq) from load_escorts where load_id='$LP'" "PO 22,SE 22"
$PSQL -c "insert into organizations (id, code, name, kind) values ('00000000-0000-0000-0000-00000000a00b','CX3','Inny przewoźnik 3','CARRIER') on conflict do nothing; insert into app_users (auth_id, org_id, email, role) values ('11111111-0000-0000-0000-00000000000b','00000000-0000-0000-0000-00000000a00b','cx3@test','CARRIER_DISPATCH') on conflict do nothing" >/dev/null
val "inny przewoźnik: 0 kontaktów" 11111111-0000-0000-0000-00000000000b "select count(*) from load_escort_contacts() where load_id='$LP'" 0
$PSQL -c "delete from app_users where email='cx3@test'; delete from organizations where code='CX3'" >/dev/null
chk "audit_log ESCORTS_SET bez danych osobowych (tylko znacznik kontakt)" "$(Q "select (new_value::text not like '%Adam%' and new_value::text not like '%600100200%')::text||'/'||(new_value->0->>'kontakt') from audit_log where action='ESCORTS_SET' and entity_id='$LP' order by id desc limit 1")" "true/true"
$PSQL -c "set session_replication_role=replica; update loads set status='UNLOADED', actual_delivery_at=now()-interval '89 days' where id='$LP'" >/dev/null
chk "retencja: 89 dni po rozładunku — kontakt pilota zostaje" "$(Q "select purge_personal_data() >= 0")/$(Q "select count(*) from load_escorts where load_id='$LP' and driver_phone is not null")" "t/1"
$PSQL -c "set session_replication_role=replica; update loads set actual_delivery_at=now()-interval '91 days' where id='$LP'" >/dev/null
chk "retencja: 91 dni po rozładunku — imię i telefon pilota wyczyszczone, pojazd zostaje, licznik 'piloci' w integration_runs" "$(Q "select purge_personal_data() >= 1")/$(Q "select count(*)||':'||count(driver_name)||':'||count(driver_phone) from load_escorts where load_id='$LP'")/$(Q "select (result->>'piloci')::int >= 1 from integration_runs where job='rodo' order by id desc limit 1")" "t/2:0:0/t"
$PSQL -c "set session_replication_role=replica; update loads set status='CANCELLED' where id='$LP'" >/dev/null
echo; echo "[III-10] EU Weekly Oil Bulletin — pobieranie wyłączone do D-2 (0092)"
SR() { $PSQL -v ON_ERROR_STOP=1 -c "begin; set local role service_role; $1; rollback;" 2>&1 | grep -v -E '^(BEGIN|SET|ROLLBACK)$' | grep -v -E '^(CONTEXT|PL/pgSQL|SQL statement)' | tail -1; }
WROWS="'[{\"index_code\":\"WOB_DIESEL_PL\",\"period\":\"2026-W39\",\"reading_date\":\"2026-09-21\",\"value\":2.0391},{\"index_code\":\"WOB_DIESEL_SE\",\"period\":\"2026-W39\",\"reading_date\":\"2026-09-21\",\"value\":2.0902}]'::jsonb"
WURL="'https://energy.ec.europa.eu/document/download/264c2d0f-f161-4ea3-a777-78faae59bea0_en?filename=x.xlsx'"
chk "przełącznik FUEL_WOB_INGEST istnieje i jest wyłączony" "$(Q "select enabled::text from security_flags where key='FUEL_WOB_INGEST'")" "false"
chk "anon/authenticated: brak EXECUTE fuel_wob_ingest i fuel_wob_enabled; service_role ma" "$(Q "select has_function_privilege('anon','fuel_wob_ingest(uuid,jsonb,text)','execute')::text||has_function_privilege('authenticated','fuel_wob_ingest(uuid,jsonb,text)','execute')::text||has_function_privilege('authenticated','fuel_wob_enabled()','execute')::text||has_function_privilege('service_role','fuel_wob_ingest(uuid,jsonb,text)','execute')::text")" "falsefalsefalsetrue"
err "HHL nie wywołuje fuel_wob_ingest" $HHL "select fuel_wob_ingest('$P',$WROWS,$WURL)" "permission denied"
chk "wyłączony przełącznik: ingest odmawia" "$(SR "select fuel_wob_ingest('$P',$WROWS,$WURL)" | grep -c 'wyłączone')" 1
chk "wyłączony: 0 odczytów WOB w bazie" "$(Q "select count(*) from fuel_index_readings where index_code like 'WOB%'")" 0
$PSQL -c "update security_flags set enabled=true where key='FUEL_WOB_INGEST'" >/dev/null
chk "włączony: 2 odczyty przyjęte" "$(SR "select fuel_wob_ingest('$P',$WROWS,$WURL)->>'inserted'")" 2
chk "włączony: powtórka tego samego tygodnia pomija (idempotentne)" "$($PSQL -c "begin; set local role service_role; select fuel_wob_ingest('$P',$WROWS,$WURL); select fuel_wob_ingest('$P',$WROWS,$WURL)->>'skipped'; rollback;" 2>&1 | grep -v -E '^(BEGIN|SET|ROLLBACK)$' | tail -1)" 2
chk "źródło spoza energy.ec.europa.eu odrzucone" "$(SR "select fuel_wob_ingest('$P',$WROWS,'https://example.com/x.xlsx')" | grep -c 'energy.ec.europa.eu')" 1
chk "kod spoza WOB (SEK) odrzucony" "$(SR "select fuel_wob_ingest('$P','[{\"index_code\":\"SEK\",\"period\":\"2026-W39\",\"reading_date\":\"2026-09-21\",\"value\":19.6}]'::jsonb,$WURL)" | grep -c 'spoza WOB')" 1
chk "data z przyszłości odrzucona" "$(SR "select fuel_wob_ingest('$P',jsonb_build_array(jsonb_build_object('index_code','WOB_DIESEL_PL','period','2026-W39','reading_date',current_date+1,'value',2)),$WURL)" | grep -c 'przyszłości')" 1
chk "pusta tablica odrzucona" "$(SR "select fuel_wob_ingest('$P','[]'::jsonb,$WURL)" | grep -c '1–10')" 1
chk "nieznany projekt odrzucony" "$(SR "select fuel_wob_ingest(gen_random_uuid(),$WROWS,$WURL)" | grep -c 'Nieznany projekt')" 1
chk "wpis w audit_log (system) widoczny w baf_change_log dla HHL" "$($PSQL -c "begin; set local role service_role; select fuel_wob_ingest('$P',$WROWS,$WURL); set local role authenticated; set local request.jwt.claim.sub='$HHL'; select count(*) from baf_change_log('$P') where actor='system' and action='FUEL_READING_ADD'; rollback;" 2>&1 | grep -v -E '^(BEGIN|SET|ROLLBACK)$' | tail -1)" 2
chk "stary kod spoza listy nadal odrzucany przez tabelę" "$($PSQL -c "insert into fuel_index_readings (project_id,index_code,period,reading_date,value,source_url) values ('$P','EUR','2026-W39',current_date,1,'https://x')" 2>&1 | grep -c 'index_code_check')" 1
$PSQL -c "update security_flags set enabled=false where key='FUEL_WOB_INGEST'" >/dev/null

# --- PALIWO-AUTO-B (0168) ---
chk "przełącznik FUEL_SE_PL_INGEST istnieje i jest włączony" "$(Q "select enabled::text from security_flags where key='FUEL_SE_PL_INGEST'")" "true"
chk "anon/authenticated: brak EXECUTE fuel_se_pl_ingest; service_role ma" "$(Q "select has_function_privilege('anon','fuel_se_pl_ingest(uuid,jsonb)','execute')::text||has_function_privilege('authenticated','fuel_se_pl_ingest(uuid,jsonb)','execute')::text||has_function_privilege('service_role','fuel_se_pl_ingest(uuid,jsonb)','execute')::text")" "falsefalsetrue"
SEPL="'[{\"index_code\":\"SEK\",\"period\":\"2026-09-01\",\"reading_date\":\"2026-09-01\",\"value\":22.9,\"source_url\":\"https://www.okq8.se/foretag/priser/\",\"source_note\":\"test\"},{\"index_code\":\"PLN\",\"period\":\"2026-09-01\",\"reading_date\":\"2026-09-01\",\"value\":6.943,\"source_url\":\"https://www.orlen.pl/pl/dla-biznesu/hurtowe-ceny-paliw\",\"source_note\":\"test\"}]'::jsonb"
chk "fuel_se_pl_ingest: 2 odczyty" "$(SR "select fuel_se_pl_ingest('$P',$SEPL)->>'inserted'")" 2
chk "fuel_se_pl_ingest: powtórka pomija" "$($PSQL -c "begin; set local role service_role; select fuel_se_pl_ingest('$P',$SEPL); select fuel_se_pl_ingest('$P',$SEPL)->>'skipped'; rollback;" 2>&1 | grep -v -E '^(BEGIN|SET|ROLLBACK)$' | tail -1)" 2
chk "SEK ze złego hosta odrzucony" "$(SR "select fuel_se_pl_ingest('$P','[{\"index_code\":\"SEK\",\"period\":\"2026-09-02\",\"reading_date\":\"2026-09-02\",\"value\":22.9,\"source_url\":\"https://example.com/x\",\"source_note\":\"t\"}]'::jsonb)" | grep -c 'okq8')" 1
chk "brak odczytu dnia → missing" "$(SR "select fuel_se_pl_missing_watch('$P','2026-09-03'::date)->>'ok'")" false
chk "po odczytach dnia → ok" "$($PSQL -c "begin; set local role service_role; select fuel_se_pl_ingest('$P',$SEPL); select fuel_se_pl_missing_watch('$P','2026-09-01'::date)->>'ok'; rollback;" 2>&1 | grep -v -E '^(BEGIN|SET|ROLLBACK)$' | tail -1)" true
chk "I-28: load_delivery_day_end usunięta (0085), load_delivery_deadline zostaje" "$(Q "select (to_regprocedure('load_delivery_day_end(date,timestamptz)') is null)::text||'/'||(to_regprocedure('load_delivery_deadline(date,timestamptz)') is not null)::text")" "true/true"
echo; echo "[I-27] brak zezwolenia blokuje Gotowy dla klasy ≠ STANDARD (0084, przełącznik)"
LD=33333333-0000-0000-0000-0000000027d1; LS=33333333-0000-0000-0000-0000000027a1
$PSQL -c "insert into loads (id, project_id, carrier_org_id, order_no, status) values ('$LD','$P','00000000-0000-0000-0000-00000000a003','KSH/I27D','DOCS_PENDING'), ('$LS','$P','00000000-0000-0000-0000-00000000a003','KSH/I27S','DOCS_PENDING');
  update loads set plan_load_date=current_date+3, hhl_order_no='HHL/'||order_no, carrier_order_no='SCX/'||order_no where id in ('$LD','$LS');
  insert into shipment_items (project_id, load_id, shipment_code, length_m, width_m, height_m, cargo_class) values ('$P','$LD','I27-D',30,4,4,'DIMENSIONED'), ('$P','$LS','I27-S',null,null,null,'STANDARD')" >/dev/null
chk "przełącznik istnieje, domyślnie wyłączony" "$(Q "select enabled::text from security_flags where key='PERMIT_REQUIRED_NON_STANDARD'")" false
val "wyłączony: DIMENSIONED bez zezwolenia → READY przechodzi (stan przed włączeniem)" $HHL "update loads set status='READY' where id='$LD' returning status" READY
err "KSH nie włącza wymogu" $KSH "select admin_set_permit_requirement(true)" "wyłącznie administrator HHL"
err "SCX nie włącza wymogu" $SCX "select admin_set_permit_requirement(true)" "wyłącznie administrator HHL"
err "KSH nie widzi stanu wymogu" $KSH "select permit_requirement_state()" "wyłącznie HHL"
val "HHL_ADMIN włącza wymóg (audit_log)" $HHL "select admin_set_permit_requirement(true)::text" true commit
chk "flaga włączona + wpis PERMIT_REQUIREMENT_SET" "$(Q "select (select enabled from security_flags where key='PERMIT_REQUIRED_NON_STANDARD')::text||'/'||(select count(*)>0 from audit_log where action='PERMIT_REQUIREMENT_SET')::text")" "true/true"
err "włączony: DIMENSIONED bez zezwolenia NIE osiąga READY" $HHL "update loads set status='READY' where id='$LD'" "Brak zezwolenia \\(PL, SE\\)"
err "włączony: przewoźnik też nie przestawi na READY" $SCX "update loads set status='READY' where id='$LD'" "Brak zezwolenia"
err "włączony: STANDARD bez zezwolenia NIE osiąga READY" $SCX "update loads set status='READY' where id='$LS'" "Brak zezwolenia"
$PSQL -c "update loads set combo_length_m=29, combo_width_m=3.9, combo_height_m=4.4, combo_weight_t=58 where id='$LD'" >/dev/null
val "SCX: zezwolenie PL powiązane" $SCX "select load_permit_link('$LD', permit_save('$P','PL','PL/I27',current_date,current_date+30,30,4,4.5,60))::text" true commit
err "tylko PL: nadal brak SE" $HHL "update loads set status='READY' where id='$LD'" "Brak zezwolenia \\(SE\\)"
val "SCX: zezwolenie SE powiązane" $SCX "select load_permit_link('$LD', permit_save('$P','SE','SE/I27',current_date,current_date+30,30,4,4.5,60))::text" true commit
val "PL + SE zgodne: DIMENSIONED → READY przechodzi" $HHL "update loads set status='READY' where id='$LD' returning status" READY commit
$PSQL -c "update loads set status='DOCS_PENDING' where id='$LD'" >/dev/null 2>&1
$PSQL -c "delete from shipment_items where load_id='$LD'" >/dev/null
$PSQL -c "delete from load_permits where load_id='$LD'" >/dev/null
err "transport bez pozycji (klasa nieznana) traktowany jak ponadnormatywny" $HHL "update loads set status='READY' where id='$LD'" "Brak zezwolenia"
val "HHL_ADMIN wyłącza wymóg" $HHL "select admin_set_permit_requirement(false)::text" false commit
$PSQL -c "delete from shipment_items where load_id in ('$LD','$LS'); update loads set status='CANCELLED' where id in ('$LD','$LS')" >/dev/null 2>&1
echo; echo "[OPL-8] opłaty wyłącznie ręcznie (§8; 0115)"
LF=33333333-0000-0000-0000-00000000fee1
$PSQL -c "insert into loads (id, project_id, carrier_org_id, order_no, status) values ('$LF','$P','00000000-0000-0000-0000-00000000a003','KSH/OPL8','PLANNED') on conflict (id) do nothing" >/dev/null
chk "anon bez EXECUTE load_agreed_fee_add / fee_catalog_hints / load_dwell_info" "$(Q "select has_function_privilege('anon','load_agreed_fee_add(uuid,text,numeric,text,text)','execute')::text||has_function_privilege('anon','fee_catalog_hints()','execute')::text||has_function_privilege('anon','load_dwell_info(uuid)','execute')::text")" "falsefalsefalse"
err "KSH nie dodaje dopłaty" $KSH "select load_agreed_fee_add('$LF','INNE',50,'COST','opis testowy OPL')" "Dopłata — tylko HHL|tylko HHL"
val "SCX dodaje dopłatę COST (B-10)" $SCX "select (load_agreed_fee_add('$LF','INNE',50,'COST','opis testowy OPL SCX') is not null)::text" true commit
err "HHL: kwota 0 odrzucona" $HHL "select load_agreed_fee_add('$LF','INNE',0,'COST','opis testowy OPL')" "dodatnia"
err "HHL: krótki opis odrzucony" $HHL "select load_agreed_fee_add('$LF','INNE',10,'COST','ab')" "3–1000"
val "HHL: podpowiedzi cennika (9 pozycji, bez automatu)" $HHL "select count(*) from fee_catalog_hints()" 9
val "HHL: dopłata COST zapisana" $HHL "select (load_agreed_fee_add('$LF','POSTOJOWE',75.5,'COST','uzgodnione z SCX po postoju') is not null)::text" true commit
chk "extras kosztu += 75.50; audit AGREED_FEE_ADD" "$(Q "select round(extras_amount,2)::text from load_cost where load_id='$LF'")/$(Q "select count(*) from audit_log where action='AGREED_FEE_ADD' and entity_id='$LF'")" "75.50/1"
val "HHL: dopłata BOTH" $HHL "select (load_agreed_fee_add('$LF','ANULOWANIE',100,'BOTH','anulowanie uzgodnione mail') is not null)::text" true commit
chk "BOTH: extras istnieją; brak funkcji auto-naliczania" "$(Q "select ((select coalesce(extras_amount,0) from load_cost where load_id='$LF') > 0 and (select coalesce(extras_amount,0) from load_revenue where load_id='$LF') > 0)::text")/$(Q "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname ~* 'auto.*(fee|surcharge|dophat)|compute.*cancel.*fee'")" "true/0"
val "KSH widzi tylko REVENUE/BOTH (1 aktywna BOTH)" $KSH "select count(*) from load_agreed_fees where load_id='$LF' and voided_at is null" 1
val "SCX widzi własne COST + HHL" $SCX "select (count(*) >= 2)::text from load_agreed_fees where load_id='$LF' and voided_at is null" true
val "dwell_info bez zdarzeń = 0 (bez kwoty)" $HHL "select count(*) from load_dwell_info('$LF')" 0
$PSQL -c "delete from load_agreed_fees where load_id='$LF'; delete from load_cost where load_id='$LF'; delete from load_revenue where load_id='$LF'; update loads set status='CANCELLED' where id='$LF'" >/dev/null 2>&1

echo; echo "[II-7] korytarz OSM + ETA v2"
chk "corridor_polylines: PL_ROAD + SE_E4 + SE_E22" "$(Q "select string_agg(code||'='||(total_km>100)::text, ',' order by code) from corridor_polylines")" "PL_ROAD=true,SE_E22=true,SE_E4=true"
chk "anon bez SELECT corridor_polylines / EXECUTE corridor_progress" "$(Q "select has_table_privilege('anon','corridor_polylines','select')::text||has_function_privilege('anon','corridor_progress(text,geometry)','execute')::text")" "falsefalse"
val "KSH czyta korytarz (3 linie)" $KSH "select count(*) from corridor_polylines" 3
chk "postęp środek SE: remaining_frac w (0,1), off < 30 km" "$(Q "select (remaining_frac between 0.05 and 0.95)::text||'/'||(off_m < 30000)::text from corridor_progress('SE_E4', st_setsrid(st_makepoint(19.5, 63.5),4326))")" "true/true"
chk "zjazd z trasy: próg w Opcjach OFFROUTE_KM = 2" "$(Q "select value_num::int::text from ops_thresholds where key='OFFROUTE_KM'")/$(Q "select count(*) from app_parameters where key='OFF_CORRIDOR_M'")" "2/0"
# spowolnienie SE 1.15 liczone z pozycji (AT_PORT_NYNASHAMN = cały odcinek SE), nie z planu
L7=33333333-0000-0000-0000-00000000a170
$PSQL -c "insert into loads (id, project_id, carrier_org_id, order_no, status, plan_load_date, plan_delivery_date) values ('$L7','$P','00000000-0000-0000-0000-00000000a003','KSH/II7','PLANNED', current_date+1, current_date+5) on conflict (id) do nothing" >/dev/null
$PSQL -c "set session_replication_role=replica; update loads set status='AT_PORT_NYNASHAMN' where id='$L7'; set session_replication_role=origin;" >/dev/null
$PSQL -c "update corridor_conditions set slowdown_mult=1.15, reason='test II-7 snieg' where corridor='SE_E4'" >/dev/null
if [ -n "${TOWER_HOSTED_READY:-}" ]; then
  $PSQL -c "insert into positions (load_id, ts, geom_raw, source) values ('$L7', now(), st_setsrid(st_makepoint(17.95, 58.90),4326), 'DRIVER_PWA')" >/dev/null
else
  $PSQL -c "insert into positions (load_id, ts, geom_raw, source) values ('$L7', now(), st_setsrid(st_makepoint(17.95, 58.90),4326), 'DRIVER_APP')" >/dev/null 2>&1 \
    || $PSQL -c "insert into positions (load_id, ts, geom_raw, source) values ('$L7', now(), st_setsrid(st_makepoint(17.95, 58.90),4326), (enum_range(null::position_source))[1])" >/dev/null
fi
$PSQL -c "select refresh_load_eta('$L7')" >/dev/null
chk "II-6→II-7: SE_ROAD hours ×1.15 przy śniegu" "$(Q "select (s->>'hours') from loads, jsonb_array_elements(eta_basis->'segments') s where id='$L7' and s->>'code'='SE_ROAD' limit 1")" "19.6"
chk "II-7 causes.weather_slowdown_pct=15" "$(Q "select eta_basis->'causes'->>'weather_slowdown_pct' from loads where id='$L7'")" "15"
$PSQL -c "update corridor_conditions set slowdown_mult=1.00, reason='start — normalne warunki' where corridor='SE_E4'" >/dev/null
# zjazd z korytarza: pozycja daleko od PL, status IN_TRANSIT_PL
# pozycja z testu śniegu nie może zostać jedną z dwóch ostatnich próbek
$PSQL -c "set session_replication_role=replica; update loads set status='IN_TRANSIT_PL' where id='$L7'; delete from positions where load_id='$L7'; set session_replication_role=origin;" >/dev/null
if [ -n "${TOWER_HOSTED_READY:-}" ]; then
  $PSQL -c "insert into positions (load_id, ts, geom_raw, source) values
    ('$L7', now() - interval '15 minutes', st_setsrid(st_makepoint(14.0, 52.0),4326), 'DRIVER_PWA'),
    ('$L7', now(), st_setsrid(st_makepoint(14.0, 52.0),4326), 'DRIVER_PWA')" >/dev/null
else
  $PSQL -c "insert into positions (load_id, ts, geom_raw, source) values
    ('$L7', now() - interval '15 minutes', st_setsrid(st_makepoint(14.0, 52.0),4326), 'DRIVER_APP'),
    ('$L7', now(), st_setsrid(st_makepoint(14.0, 52.0),4326), 'DRIVER_APP')" >/dev/null 2>&1 \
    || $PSQL -c "insert into positions (load_id, ts, geom_raw, source) values
    ('$L7', now() - interval '15 minutes', st_setsrid(st_makepoint(14.0, 52.0),4326), (enum_range(null::position_source))[1]),
    ('$L7', now(), st_setsrid(st_makepoint(14.0, 52.0),4326), (enum_range(null::position_source))[1])" >/dev/null
fi
$PSQL -c "select refresh_load_eta('$L7')" >/dev/null
chk "II-7: >2 km od korytarza → ryzyko rk_off_corridor" "$(Q "select title_key from risk_signals where load_id='$L7' and dedup_key='OFF_CORRIDOR:$L7' and resolved_at is null")" "rk_off_corridor"
$PSQL -c "update loads set status='CANCELLED' where id='$L7'" >/dev/null 2>&1

fi # tower-i2-part 5

echo; echo "WYNIK: $ok OK, $fail FAIL"
