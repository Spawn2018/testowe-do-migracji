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

echo; echo "[I-2d] bez rozkładu: przeprawa z założenia, szerokie pasmo"
chk "ETA wyliczona przy wstawieniu (seed): basis + pasmo" "$(Q "select (eta_site is not null)::text||'/'||(eta_confidence_min>=720)::text||'/'||(eta_basis->'flags'->>0) from loads where id='$L2'")" "true/true/brak rejsu w rozkładzie — przeprawa z założenia"
chk "ETA = teraz + 4,5 (PL) + 2 (check-in) + 18 (przeprawa) + 18,5 (SE) = 43 h" "$(H $L2 "eta_computed_at")" "43.0"

echo; echo "[I-2d] rozkład w sailings: bez przypisania — najbliższy rejs jako założenie"
$PSQL -c "insert into sailings (id, project_id, vessel_id, departure_at, arrival_at, source) values
 ('66666666-0000-0000-0000-000000000001','$P','55555555-0000-0000-0000-000000000001', now()+interval '30 hours', now()+interval '48 hours','RECZNIE'),
 ('66666666-0000-0000-0000-000000000002','$P','55555555-0000-0000-0000-000000000001', now()+interval '54 hours', now()+interval '72 hours','RECZNIE')" >/dev/null
$PSQL -c "insert into load_events (load_id, event_type, occurred_at) values ('$L2','NOTE',now())" >/dev/null
chk "zdarzenie → przeliczenie: rejs założony (najbliższy po dojeździe), ETA = przypłynięcie + 18,5 h" "$(Q "select eta_basis->>'sailing' from loads where id='$L2'")/$(H $L2 "(now()+interval '48 hours')")" "założony (najbliższy w rozkładzie)/18.5"
chk "pasmo: rejs założony +6 h" "$(Q "select eta_confidence_min from loads where id='$L2'")" "747"

echo; echo "[I-2d] przypisanie rejsu (HHL) → ETA z przypisanego rejsu"
val "HHL przypisuje rejs 2" $HHL "update loads set sailing_id='66666666-0000-0000-0000-000000000002' where id='$L2' returning 1" 1 commit
chk "źródło: przypisany; ETA = przypłynięcie rejsu 2 + 18,5 h" "$(Q "select eta_basis->>'sailing' from loads where id='$L2'")/$(H $L2 "(now()+interval '72 hours')")" "przypisany/18.5"
chk "pasmo = rozkład ±30 + SE 30% (333) + PL 20% (54) = 417 min" "$(Q "select eta_confidence_min from loads where id='$L2'")" 417
$PSQL -c "update sailings set delayed_departure_at=departure_at+interval '3 hours', delayed_arrival_at=arrival_at+interval '3 hours', status='OPOZNIONY' where id='66666666-0000-0000-0000-000000000002'" >/dev/null
chk "opóźnienie rejsu w rozkładzie → ETA +3 h, pasmo +60 min (bez zdarzenia transportu)" "$(H $L2 "(now()+interval '72 hours')")/$(Q "select eta_confidence_min from loads where id='$L2'")" "21.5/477"

$PSQL -c "set session_replication_role=replica; update loads set hhl_order_no='HHL/2026/1', carrier_order_no='SCX/1', plan_delivery_date=current_date-1, plan_delivery_to=null where id='$L2'; set session_replication_role=origin;" >/dev/null
echo; echo "[I-2d] przewoźnik zmienia status (strażnik nie blokuje przeliczenia), prom"
val "SCX: status FERRY" $SCX "update loads set status='FERRY' where id='$L2' returning status" FERRY commit
chk "FERRY: segment FERRY, ETA = przypłynięcie po opóźnieniu + 18,5 h, pasmo 30+60+333" "$(Q "select eta_basis->>'segment' from loads where id='$L2'")/$(H $L2 "(now()+interval '75 hours')")/$(Q "select eta_confidence_min from loads where id='$L2'")" "FERRY/18.5/423"

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

echo; echo "WYNIK: $ok OK, $fail FAIL"
