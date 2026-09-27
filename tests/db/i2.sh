#!/usr/bin/env bash
# TOWER — I-2d (0051) ETA v1 w bazie + I-2f (0052) formularz SEFS/BAF dla HHL.
# Czysta baza: atrapa Supabase → migracje → tests/db/seed.sql → scenariusze.
# Użycie: PGADMIN=postgres://postgres@localhost:5433/postgres bash tests/db/i2.sh
set -e
cd "$(git rev-parse --show-toplevel)"
ADMIN=${PGADMIN:-postgres://postgres@localhost:5433/postgres}
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

# strefy projektu: załadunek Śrem, terminal Gdańsk, terminal Nynäshamn, plac Boden
$PSQL -c "insert into geofences (project_id, name, kind, geom, country) values
 ('$P','KSH Śrem','LOADING', make_circle_fence(52.087,17.015,600),'PL'),
 ('$P','Terminal Gdańsk','PORT_OUT', make_circle_fence(54.395,18.668,800),'PL'),
 ('$P','Terminal Nynäshamn','PORT_IN', make_circle_fence(58.9,17.95,800),'SE'),
 ('$P','Plac Boden','SITE', make_circle_fence(65.83,21.69,2000),'SE')" >/dev/null
$PSQL -c "insert into vessels (id, name, operator) values ('55555555-0000-0000-0000-000000000001','Nova Star','Polferries')" >/dev/null

echo; echo "[I-2d] ETA v1 — uprawnienia i dostęp"
chk "authenticated/anon: brak EXECUTE compute_load_eta i refresh_load_eta" "$(Q "select has_function_privilege('authenticated','compute_load_eta(uuid,timestamptz)','execute')::text||has_function_privilege('anon','refresh_load_eta(uuid)','execute')::text")" "falsefalse"
chk "parametry odcinków: 6, każdy ze źródłem" "$(Q "select count(*) filter (where length(source)>10) from eta_segment_params")" 6
err "KSH nie zmienia parametrów odcinków" $KSH "update eta_segment_params set hours=1 where code='SE_ROAD'" "permission denied"
val "KSH czyta parametry odcinków" $KSH "select count(*) from eta_segment_params" 6

echo; echo "[D-9] parametry odcinków (0054)"
chk "wartości D-9: PL 7,5±25, check-in 3, przeprawa 18, SE 17±20, przerwy SE 13±30" "$(Q "select string_agg(code||'='||hours::float||'/'||spread_pct::float, ',' order by code) from eta_segment_params where code<>'GPS_FRESH_MIN'")" "CROSSING_DEFAULT=18/15,PL_ROAD=7.5/25,PORT_CHECKIN=3/0,SE_BREAKS=13/30,SE_ROAD=17/20"
chk "źródła D-9 (koordynator ×3, właściciel ×1)" "$(Q "select count(*) filter (where source='szacunek koordynatora 27.09 — do potwierdzenia z SCX (II-3)')||'/'||count(*) filter (where source='właściciel 27.09: obsada jednoosobowa, odpoczynek na promie') from eta_segment_params")" "3/1"

echo; echo "[I-2d] bez rozkładu: przeprawa z założenia, szerokie pasmo"
chk "ETA wyliczona przy wstawieniu (seed): basis + pasmo" "$(Q "select (eta_site is not null)::text||'/'||(eta_confidence_min>=720)::text||'/'||(eta_basis->'flags'->>0) from loads where id='$L2'")" "true/true/brak rejsu w rozkładzie — przeprawa z założenia"
chk "ETA = teraz + 7,5 (PL) + 3 (check-in) + 18 (przeprawa) + 17+13 (SE, D-9) = 58,5 h" "$(H $L2 "eta_computed_at")" "58.5"

echo; echo "[I-2d] rozkład w sailings: bez przypisania — najbliższy rejs jako założenie"
$PSQL -c "insert into sailings (id, project_id, vessel_id, departure_at, arrival_at, source) values
 ('66666666-0000-0000-0000-000000000001','$P','55555555-0000-0000-0000-000000000001', now()+interval '30 hours', now()+interval '48 hours','RECZNIE'),
 ('66666666-0000-0000-0000-000000000002','$P','55555555-0000-0000-0000-000000000001', now()+interval '54 hours', now()+interval '72 hours','RECZNIE')" >/dev/null
$PSQL -c "insert into load_events (load_id, event_type, occurred_at) values ('$L2','NOTE',now())" >/dev/null
chk "zdarzenie → przeliczenie: rejs założony (najbliższy po dojeździe), ETA = przypłynięcie + 30 h (D-9)" "$(Q "select eta_basis->>'sailing' from loads where id='$L2'")/$(H $L2 "(now()+interval '48 hours')")" "założony (najbliższy w rozkładzie)/30.0"
chk "pasmo: rejs założony 360 + PL 25% (112,5) + SE 30% z 30 h (540) = 1013 min (D-9; było 747)" "$(Q "select eta_confidence_min from loads where id='$L2'")" "1013"

echo; echo "[I-2d] przypisanie rejsu (HHL) → ETA z przypisanego rejsu"
val "HHL przypisuje rejs 2" $HHL "update loads set sailing_id='66666666-0000-0000-0000-000000000002' where id='$L2' returning 1" 1 commit
chk "źródło: przypisany; ETA = przypłynięcie rejsu 2 + 30 h" "$(Q "select eta_basis->>'sailing' from loads where id='$L2'")/$(H $L2 "(now()+interval '72 hours')")" "przypisany/30.0"
chk "pasmo = rozkład ±30 + SE 30% (540) + PL 25% (112,5) = 683 min" "$(Q "select eta_confidence_min from loads where id='$L2'")" 683
$PSQL -c "update sailings set delayed_departure_at=departure_at+interval '3 hours', delayed_arrival_at=arrival_at+interval '3 hours', status='OPOZNIONY' where id='66666666-0000-0000-0000-000000000002'" >/dev/null
chk "opóźnienie rejsu w rozkładzie → ETA +3 h, pasmo +60 min (bez zdarzenia transportu)" "$(H $L2 "(now()+interval '72 hours')")/$(Q "select eta_confidence_min from loads where id='$L2'")" "33.0/743"

$PSQL -c "set session_replication_role=replica; update loads set hhl_order_no='HHL/2026/1', carrier_order_no='SCX/1', plan_delivery_date=current_date-1, plan_delivery_to=null where id='$L2'; set session_replication_role=origin;" >/dev/null
echo; echo "[I-2d] przewoźnik zmienia status (strażnik nie blokuje przeliczenia), prom"
val "SCX: status FERRY" $SCX "update loads set status='FERRY' where id='$L2' returning status" FERRY commit
chk "FERRY: segment FERRY, ETA = przypłynięcie po opóźnieniu + 30 h, pasmo 30+60+540" "$(Q "select eta_basis->>'segment' from loads where id='$L2'")/$(H $L2 "(now()+interval '75 hours')")/$(Q "select eta_confidence_min from loads where id='$L2'")" "FERRY/30.0/630"

echo; echo "[I-2d] odcinek SE: pozycja GPS"
$PSQL -c "set session_replication_role=replica; update loads set status='IN_TRANSIT_SE' where id='$L2'; set session_replication_role=origin;" >/dev/null
$PSQL -c "insert into positions (load_id, ts, geom_raw, source) values ('$L2', now(), st_setsrid(st_makepoint(21.0, 63.5),4326), 'DRIVER_APP')" >/dev/null 2>&1 || $PSQL -c "insert into positions (load_id, ts, geom_raw, source) values ('$L2', now(), st_setsrid(st_makepoint(21.0, 63.5),4326), (enum_range(null::position_source))[1])" >/dev/null
chk "świeża pozycja: flaga GPS, pozostało < 18,5 h" "$(Q "select eta_basis->'flags'->>0 from loads where id='$L2'")/$(Q "select (eta_site < now()+interval '18 hours')::text from loads where id='$L2'")" "pozycja GPS — odległość do placu w linii prostej/true"
$PSQL -c "insert into positions (load_id, ts, geom_raw, source) select '$L2', now()-interval '5 hours', st_setsrid(st_makepoint(20.0, 62.0),4326), source from positions where load_id='$L2' limit 1" >/dev/null
chk "starsza pozycja nie zmienia wyniku (liczy się najnowsza)" "$(Q "select eta_basis->'flags'->>0 from loads where id='$L2'")" "pozycja GPS — odległość do placu w linii prostej"

echo; echo "[I-2d] na placu, rozładunek, anulowanie"
$PSQL -c "insert into load_events (load_id, event_type, occurred_at, payload) values ('$L2','STATUS_AUTO', now()-interval '10 minutes', '{\"to\":\"AT_SITE\"}')" >/dev/null
val "HHL: AT_SITE" $HHL "update loads set status='AT_SITE' where id='$L2' returning status" AT_SITE commit
chk "AT_SITE: ETA = czas wjazdu na plac, pasmo 0" "$(Q "select (abs(extract(epoch from eta_site-(now()-interval '10 minutes')))<120)::text||'/'||eta_confidence_min from loads where id='$L2'")" "true/0"
chk "delay_minutes = max(0, ETA − koniec okna planu)" "$(Q "select (delay_minutes is not distinct from greatest(0, round(extract(epoch from eta_site - coalesce(plan_delivery_to, ((plan_delivery_date+1)::timestamp at time zone 'Europe/Stockholm')))/60))::int)::text||'/'||(plan_delivery_date is not null)::text from loads where id='$L2'")" "true/true"
val "HHL: UNLOADED z datą" $HHL "update loads set status='UNLOADED', actual_delivery_at='2026-10-05 10:00+02' where id='$L2' returning status" UNLOADED commit
chk "UNLOADED: ETA = data rozładunku" "$(Q "select eta_site||'/'||eta_confidence_min from loads where id='$L2'")" "2026-10-05 10:00:00+02/0"
val "HHL anuluje L1 (cancel_load)" $HHL "select cancel_load('$L1','test ETA') is not null" t commit
chk "CANCELLED: ETA NULL, flaga" "$(Q "select coalesce(eta_site::text,'∅')||'/'||(eta_basis->'flags'->>0) from loads where id='$L1'")" "∅/anulowany"

echo; echo "[I-2d] strażnik kontekstu ETA"
err "w kontekście ETA zmiana innej kolumny = wyjątek" $HHL "select set_config('tower.eta_ctx','on',true); update loads set order_no='X' where id='$L1'" "wyłącznie kolumny eta_"
chk "KSH widzi ETA i podstawę (RLS loads)" "$(run $KSH "select count(*) from loads where eta_basis is not null" | grep -E '^[0-9]+$')" 2
chk "rejs odwołany → flaga i rejs założony" "$($PSQL -c "insert into loads (id, project_id, carrier_org_id, order_no, sailing_id) values ('33333333-0000-0000-0000-000000000009','$P','00000000-0000-0000-0000-00000000a003','KSH/9','66666666-0000-0000-0000-000000000001')" >/dev/null; $PSQL -c "update sailings set status='ODWOLANY' where id='66666666-0000-0000-0000-000000000001'" >/dev/null; Q "select eta_basis->'flags'->>0 from loads where id='33333333-0000-0000-0000-000000000009'")" "przypisany rejs odwołany"

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
chk "migracja nie wstawia wartości (poza testem): baf_definitions 0" "$(Q "select count(*) from baf_definitions")" 0

echo; echo "[I-2j] pozycje promów z AIS (vessel_positions, 0053)"
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
chk "cichy pojazd: occurred_at = ostatnia pozycja + 90 min → wykrycie po 90 min" "$(Q "select detect_silent_vehicles(90) >= 1")/$(Q "select round(extract(epoch from detected_at-occurred_at)/60) from risk_signals where load_id='$L7' and kind='SILENT_VEHICLE'")" "t/90"
$PSQL -c "insert into load_events (load_id, event_type, occurred_at, payload) values ('$L7','GEOFENCE_ENTER', now()-interval '7 minutes', '{\"geofence_id\":\"g-test\"}')" >/dev/null
$PSQL -c "insert into risk_signals (project_id, load_id, kind, severity, title, detail, dedup_key) values ('$P','$L7','LOADING_UNCONFIRMED','MEDIUM','test strefy','{\"geofence_id\":\"g-test\",\"zdarzenie\":\"GEOFENCE_ENTER\"}','T-I2L-G')" >/dev/null 2>&1
chk "ryzyko strefy: occurred_at = czas zdarzenia strefy z load_events (7 min)" "$(Q "select round(extract(epoch from detected_at-occurred_at)/60) from risk_signals where dedup_key='T-I2L-G'")" 7
$PSQL -c "insert into risk_signals (project_id, load_id, kind, severity, title, detail, dedup_key) values ('$P','$L7','AUTO_STATUS','HIGH','test jawny',jsonb_build_object('occurred_at', now()-interval '20 minutes'),'T-I2L-J'), ('$P','$L7','AUTO_STATUS','LOW','bez czasu','{}','T-I2L-N'), ('$P','$L7','AUTO_STATUS','LOW','zły czas','{\"occurred_at\":\"jutro\"}','T-I2L-Z')" >/dev/null 2>&1
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

echo; echo "WYNIK: $ok OK, $fail FAIL"
