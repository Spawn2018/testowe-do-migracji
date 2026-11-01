#!/usr/bin/env bash
# TOWER — test automatyki statusów: podróże ciężarówek prawdziwymi pozycjami
# GPS przez silnik stref (0002) i automat PROM (0004). Uruchamiany po seed.sql.
. "$(git rev-parse --show-toplevel)/tests/db/refuse-prod.sh"
PSQL="psql ${PGURL:-postgres://postgres@localhost:5433/tower} -Atq -v ON_ERROR_STOP=1"
P=22222222-0000-0000-0000-000000000001; SCXO=00000000-0000-0000-0000-00000000a003
SCX=11111111-0000-0000-0000-000000000003; KSH=11111111-0000-0000-0000-000000000002
ok=0; fail=0
q()   { $PSQL -c "$1" 2>&1; }
pos() { q "select count(*) from process_position('$1', $2, $3, '$4')" >/dev/null; }   # ładunek, szer., dł., czas
chk() {
  out=$(q "$2")
  got=$(printf '%s\n' "$out" | grep -E '^ERROR:' | head -1)
  if [ -z "$got" ]; then got=$(printf '%s\n' "$out" | tail -1); fi
  if [ "$got" = "$3" ]; then ok=$((ok+1)); echo "  OK    $1"
  else fail=$((fail+1)); echo "  FAIL  $1  (otrzymano: $got, oczekiwano: $3)"; fi
}
st()  { echo "select status from loads where id='$1'"; }
rk()  { echo "select count(*) from risk_signals where load_id='$1' and dedup_key like '$2%'"; }

L() { printf '55555555-0000-0000-0000-0000000000%s' "$1"; }
A=$(L 0a); B=$(L 0b); C=$(L 0c); D=$(L 0d); E=$(L 0e); F=$(L 0f); G=$(L 1a); Hh=$(L 1b); I=$(L 1c); J=$(L 1d); K=$(L 1e)

q "
insert into geofences (project_id, name, kind, geom, hysteresis_m, dwell_seconds, debounce_fixes, country, route) values
 ('$P','Załadunek test','LOADING',     make_circle_fence(52.0900,17.0200,  800), 200,   0, 2,'PL', null),
 ('$P','Bufor Gdańsk',  'PRE_PORT',    make_circle_fence(54.4030,18.6800,20000), 500,   0, 2,'PL', 'POLFERRIES'),
 ('$P','Port Gdańsk',   'PORT_OUT',    make_circle_fence(54.4030,18.6800,  800), 200, 900, 2,'PL', 'POLFERRIES'),
 ('$P','Port Nynäshamn','PORT_IN',     make_circle_fence(58.9350,17.9500,  800), 200, 600, 2,'SE', 'POLFERRIES'),
 ('$P','Bufor Boden',   'PRE_ARRIVAL', make_circle_fence(65.8054,21.7591,50000),1000,   0, 2,'SE', null),
 ('$P','Plac Stegra',   'SITE',        make_circle_fence(65.8054,21.7591, 1500), 300, 600, 2,'SE', null);
insert into vessels (id,name,operator) values
 ('66666666-0000-0000-0000-000000000001','M/F Wawel','Polferries'),
 ('66666666-0000-0000-0000-000000000002','M/F Nova Star','Polferries');
insert into sailings (id,project_id,vessel_id,departure_at,arrival_at,delayed_departure_at,delayed_arrival_at,status) values
 ('77777777-0000-0000-0000-000000000001','$P','66666666-0000-0000-0000-000000000001','2026-10-01 12:00+00','2026-10-02 06:00+00',null,null,'ZAPLANOWANY'),
 ('77777777-0000-0000-0000-000000000002','$P','66666666-0000-0000-0000-000000000002','2026-10-01 20:00+00','2026-10-02 14:00+00',null,null,'ODWOLANY'),
 ('77777777-0000-0000-0000-000000000003','$P','66666666-0000-0000-0000-000000000001','2026-10-01 16:00+00','2026-10-02 10:00+00','2026-10-01 19:00+00','2026-10-02 13:00+00','OPOZNIONY'),
 ('77777777-0000-0000-0000-000000000004','$P','66666666-0000-0000-0000-000000000002','2026-10-01 14:00+00','2026-10-02 08:00+00',null,null,'ZAPLANOWANY'),
 ('77777777-0000-0000-0000-000000000005','$P','66666666-0000-0000-0000-000000000001', now() + interval '7 days', now() + interval '7 days 18 hours',null,null,'ZAPLANOWANY');
" >/dev/null
S1=77777777-0000-0000-0000-000000000001; S2=77777777-0000-0000-0000-000000000002; S3=77777777-0000-0000-0000-000000000003; S4=77777777-0000-0000-0000-000000000004
S5=77777777-0000-0000-0000-000000000005
# D-1710: process_position wymaga linku śledzenia (telematics_vehicle_id).
mk() { q "insert into loads (id,project_id,carrier_org_id,order_no,hhl_order_no,carrier_order_no,status,sailing_id,plan_load_date,telematics_vehicle_id)
          values ('$1','$P','$SCXO','KSH/$2',$3,$4,'$5',$6,'2026-09-30','TEL-$2')" >/dev/null; }
mk $A A "'HHL/A'" "'SCX/A'" IN_TRANSIT_PL "'$S1'";  mk $B B "'HHL/B'" "'SCX/B'" IN_TRANSIT_PL "'$S1'"
mk $C C "'HHL/C'" "'SCX/C'" IN_TRANSIT_PL "'$S2'";  mk $D D "'HHL/D'" null        READY         null
mk $E E null      null      DOCS_PENDING  null;      mk $F F "'HHL/F'" "'SCX/F'" READY         null
mk $G G "'HHL/G'" "'SCX/G'" READY         null;      mk $Hh H "'HHL/H'" "'SCX/H'" IN_TRANSIT_PL "'$S4'"
mk $I I "'HHL/I'" "'SCX/I'" IN_TRANSIT_PL "'$S1'";  mk $J J "'HHL/J'" "'SCX/J'" IN_TRANSIT_PL "'$S1'"
mk $K K "'HHL/K'" "'SCX/K'" IN_TRANSIT_PL "'$S3'"
for x in $A $B $C $Hh $I $K; do q "insert into load_events (load_id,event_type,occurred_at) values ('$x','MILESTONE_LOADED','2026-09-30 08:00+00')" >/dev/null; done

echo; echo "[1] Strefa załadunku"
for x in $D $E $F $G; do pos $x 52.0900 17.0200 "2026-09-30 09:00+00"; pos $x 52.0901 17.0201 "2026-09-30 09:05+00"; done
chk "READY + wjazd → AT_LOADING"                            "$(st $F)" AT_LOADING
chk "A10 niegotowy + wjazd → AT_LOADING"                     "$(st $E)" AT_LOADING
chk "A10 niegotowy: ryzyko Załadunek bez gotowości"          "$(rk $E LOADING_NOT_READY)" 1
# A10 (#324): załadunek bez gotowości / bez numeru SCX — ryzyko, bez blokady (nie zostaje READY).
chk "A10 bez numeru SCX: AT_LOADING (bez blokady)"           "$(st $D)" AT_LOADING
chk "A10 bez numeru SCX: ryzyko Załadunek bez gotowości"     "$(rk $D LOADING_NOT_READY)" 1
chk "blokada statusu NIE przerwała zapisu pozycji"           "select count(*) from positions where load_id='$D'" 2
# A10 F7: READY bez numeru HHL nadal zablokowane dla automatu (W12) → rk_auto_status_blocked (risks.sh).
Lblk=$(L 9b)
mk $Lblk W12 null null RESOURCES_PENDING null
q "select auto_set_status('$Lblk','RESOURCES_PENDING'::load_status,'READY'::load_status,'test W12',now(),'{}'::jsonb)" >/dev/null
chk "A10 W12: auto READY bez HHL — status bez zmian"         "$(st $Lblk)" RESOURCES_PENDING
chk "A10 W12: ryzyko rk_auto_status_blocked"                 "select count(*) from risk_signals where load_id='$Lblk' and title_key='rk_auto_status_blocked'" 1
# A2: wyjazd LOADING po ≥ 5 min → Droga PL + actual_load_at, bez loaded_confirmed / LEFT_LOADING_UNCONFIRMED
for x in $F; do pos $x 52.30 17.30 "2026-09-30 11:00+00"; pos $x 52.31 17.31 "2026-09-30 11:05+00"; done
chk "A2 wyjazd załadunku bez MILESTONE → IN_TRANSIT_PL"      "$(st $F)" IN_TRANSIT_PL
chk "A2 wyjazd załadunku: actual_load_at ustawione"          "select (actual_load_at is not null)::text from loads where id='$F'" true
chk "A2 wyjazd załadunku: brak LEFT_LOADING_UNCONFIRMED"     "$(rk $F LEFT_LOADING_UNCONFIRMED)" 0
q "insert into load_events (load_id,event_type,occurred_at) values ('$G','MILESTONE_LOADED','2026-09-30 10:30+00')" >/dev/null
pos $G 52.30 17.30 "2026-09-30 11:00+00"; pos $G 52.31 17.31 "2026-09-30 11:05+00"
chk "wyjazd po potwierdzeniu załadunku → IN_TRANSIT_PL"      "$(st $G)" IN_TRANSIT_PL
# krótki postój < 5 min — status bez zmian
Lshort=$(L 5a)
mk $Lshort A2S "'HHL/A2S'" "'SCX/A2S'" READY null
pos $Lshort 52.0900 17.0200 "2026-09-30 12:00+00"; pos $Lshort 52.0901 17.0201 "2026-09-30 12:01+00"
pos $Lshort 52.30 17.30 "2026-09-30 12:03+00"; pos $Lshort 52.31 17.31 "2026-09-30 12:04+00"
chk "A2 wyjazd załadunku < 5 min: status AT_LOADING"         "$(st $Lshort)" AT_LOADING
# D-20261018-1100-01: syntetyczny wyjazd (faza z pozycji) nie rusza statusu ani actual_load_at
GID=$($PSQL -c "select id from geofences where project_id='$P' and kind='LOADING' order by name limit 1")
q "insert into load_events (load_id, event_type, occurred_at, payload) values ('$Lshort','GEOFENCE_EXIT','2026-09-30 12:10+00', jsonb_build_object('synthetic', true, 'geofence_id', '$GID', 'geofence_kind', 'LOADING'))" >/dev/null
chk "A2 syntetyczny wyjazd załadunku: status bez zmian"      "$(st $Lshort)" AT_LOADING
chk "A2 syntetyczny wyjazd załadunku: actual_load_at puste"  "select (actual_load_at is null)::text from loads where id='$Lshort'" true

echo; echo "[2] Port Gdańsk — wjazd w strefę"
for x in $A $I $J; do pos $x 54.4030 18.6800 "2026-10-01 10:00+00"; pos $x 54.4031 18.6801 "2026-10-01 10:05+00"; done
chk "wjazd w strefę portu → AT_PORT_GDANSK"                   "$(st $A)" AT_PORT_GDANSK
chk "port bez potwierdzenia załadunku: ryzyko, status się zmienia" "$(rk $J PORT_NO_LOADED)" 1
# #398: actual_load_at (GPS) = potwierdzony załadunek → brak PORT_NO_LOADED
# bez sailing_id — inaczej Lgps wchodzi w promote_ferry_departures (S1) i psuje licznik 3→4
# L 98 — nie 2a: C17A=L 2a (kolizja ID → C17A zostawał AT_PORT_GDANSK)
Lgps=$(L 98)
mk $Lgps GPS "'HHL/GPS'" "'SCX/GPS'" IN_TRANSIT_PL null
q "set session_replication_role=replica; update loads set actual_load_at='2026-09-30 11:10+00' where id='$Lgps'; set session_replication_role=origin" >/dev/null
pos $Lgps 54.4030 18.6800 "2026-10-01 10:00+00"; pos $Lgps 54.4031 18.6801 "2026-10-01 10:05+00"
chk "398: port z actual_load_at → AT_PORT_GDANSK"           "$(st $Lgps)" AT_PORT_GDANSK
chk "398: port z actual_load_at → 0 PORT_NO_LOADED"         "$(rk $Lgps PORT_NO_LOADED)" 0
chk "strefa bufora 20 km nie zmienia statusu"                 "select count(*) from load_events where load_id='$A' and event_type='STATUS_AUTO'" 1

echo; echo "[3] PROM — #461: AIS albo plan+1h (SCHEDULE_ASSUMED); bez MISSED/NO_DEPARTURE"
chk "minuta przed odejściem: nic"                             "select promote_ferry_departures('2026-10-01 11:59+00')" 0
chk "#461: plan minął, brak actual, przed +1h → bez FERRY"   "select promote_ferry_departures('2026-10-01 12:01+00')" 0
chk "#461: status A nadal AT_PORT_GDANSK"                     "$(st $A)" AT_PORT_GDANSK
# SCHEDULE_ASSUMED: plan 12:00 + 1 h → FERRY o 13:00, bez spraw i bez powiadomień
Nbell=$(q "select count(*) from notifications")
chk "#461: plan+1h bez AIS → FERRY (SCHEDULE_ASSUMED)"       "select promote_ferry_departures('2026-10-01 13:01+00')" 4
chk "#461: status A = FERRY (rozkład)"                        "$(st $A)" FERRY
chk "#461: source=SCHEDULE_ASSUMED" \
  "select payload->>'source' from load_events where load_id='$A' and event_type='STATUS_AUTO' and payload->>'to'='FERRY' and not exists (select 1 from load_events z where z.load_id=load_events.load_id and z.payload->>'zastepuje'=load_events.id::text) order by id desc limit 1" SCHEDULE_ASSUMED
chk "#461: auto poza strefą też FERRY (bez MISSED)"           "$(st $B)" FERRY
chk "#461: 0 MISSED_SAILING przy nieodwołanym"                "$(rk $B MISSED_SAILING)" 0
chk "#461: 0 NO_DEPARTURE"                                    "$(rk $A NO_DEPARTURE)" 0
chk "#461: SCHEDULE_ASSUMED bez nowych powiadomień" \
  "select (count(*) = $Nbell)::text from notifications" true
# AIS później → korekta godziny na actual (bez nowych powiadomień)
Nbell2=$(q "select count(*) from notifications")
q "update sailings set actual_departure_at = '2026-10-01 12:15+00' where id='$S1'" >/dev/null
chk "#461: AIS po SCHEDULE_ASSUMED → 0 nowych FERRY (korekta)" "select promote_ferry_departures('2026-10-01 13:05+00')" 0
chk "#461: po AIS source=AIS i godzina 12:15" \
  "select (payload->>'source')||'/'||to_char(occurred_at at time zone 'UTC','HH24:MI') from load_events where load_id='$A' and event_type='STATUS_AUTO' and payload->>'to'='FERRY' and not exists (select 1 from load_events z where z.load_id=load_events.load_id and z.payload->>'zastepuje'=load_events.id::text) order by id desc limit 1" "AIS/12:15"
chk "#461: korekta AIS bez nowych powiadomień" \
  "select (count(*) = $Nbell2)::text from notifications" true
pos $A 55.50 18.90 "2026-10-01 12:30+00"; pos $A 55.51 18.91 "2026-10-01 12:35+00"
chk "statek odpływa, auto opuszcza strefę: status nadal PROM" "$(st $A)" FERRY

echo; echo "[4] PROM — zadanie uruchomione z opóźnieniem, statek już na morzu"
pos $Hh 54.4030 18.6800 "2026-10-01 13:00+00"; pos $Hh 54.4031 18.6801 "2026-10-01 13:05+00"
pos $Hh 55.50 18.90 "2026-10-01 14:30+00";    pos $Hh 55.51 18.91 "2026-10-01 14:35+00"
q "update sailings set actual_departure_at = '2026-10-01 14:00+00' where id='$S4'" >/dev/null
chk "auto było w strefie w chwili odejścia — przełączone mimo opóźnienia zadania" "select promote_ferry_departures('2026-10-01 16:30+00')" 1
chk "status H = FERRY"                                        "$(st $Hh)" FERRY
chk "brak fałszywego ryzyka przegapionego rejsu"             "$(rk $Hh MISSED_SAILING)" 0

echo; echo "[5] PROM — rejs opóźniony (SCHEDULE_ASSUMED od delayed+1h) i odwołany"
pos $K 54.4030 18.6800 "2026-10-01 15:00+00"; pos $K 54.4031 18.6801 "2026-10-01 15:05+00"
q "select promote_ferry_departures('2026-10-01 16:30+00')" >/dev/null
chk "rozkładowa godzina minęła, rejs opóźniony: auto czeka w porcie" "$(st $K)" AT_PORT_GDANSK
chk "brak fałszywego ryzyka przy opóźnieniu"                  "$(rk $K MISSED_SAILING)" 0
q "select promote_ferry_departures('2026-10-01 19:01+00')" >/dev/null
chk "#461: delayed minął, przed +1h → bez FERRY"              "$(st $K)" AT_PORT_GDANSK
chk "#461: delayed+1h → FERRY SCHEDULE_ASSUMED"               "select promote_ferry_departures('2026-10-01 20:01+00')" 1
chk "status K = FERRY"                                        "$(st $K)" FERRY
chk "#461: K source=SCHEDULE_ASSUMED" \
  "select payload->>'source' from load_events where load_id='$K' and event_type='STATUS_AUTO' and payload->>'to'='FERRY' and not exists (select 1 from load_events z where z.load_id=load_events.load_id and z.payload->>'zastepuje'=load_events.id::text) order by id desc limit 1" SCHEDULE_ASSUMED
chk "#461: 0 NO_DEPARTURE przy delayed"                       "$(rk $K NO_DEPARTURE)" 0
q "select promote_ferry_departures('2026-10-01 20:01+00')" >/dev/null
chk "rejs odwołany: status bez zmian"                        "$(st $C)" IN_TRANSIT_PL
chk "rejs odwołany: ryzyko"                                  "$(rk $C SAILING_CANCELLED)" 1

echo; echo "[6] Port Nynäshamn i trasa SE"
pos $A 58.9350 17.9500 "2026-10-02 06:10+00"; pos $A 58.9351 17.9501 "2026-10-02 06:15+00"
chk "wjazd w strefę portu SE → AT_PORT_NYNASHAMN"            "$(st $A)" AT_PORT_NYNASHAMN
pos $A 59.3300 18.0600 "2026-10-02 06:40+00"; pos $A 59.3301 18.0601 "2026-10-02 06:45+00"
chk "wyjazd ze strefy portu SE → IN_TRANSIT_SE"              "$(st $A)" IN_TRANSIT_SE
pos $I 65.5000 21.7000 "2026-10-02 07:00+00"; pos $I 65.5001 21.7001 "2026-10-02 07:05+00"
chk "GPS zgubił port SE, auto już na trasie → IN_TRANSIT_SE" "$(st $I)" IN_TRANSIT_SE
# #461: SCHEDULE_ASSUMED stawia FERRY także poza strefą (B i J na S1) — 2× FERRY_OVERDUE zamiast 1.
chk "przeterminowany PROM: B+J bez sygnału po przypłynięciu" "select detect_ferry_overdue('2026-10-02 09:00+00')" 2
chk "ryzyko przeterminowanego PROMU dla właściwego auta"     "$(rk $J FERRY_OVERDUE)" 1

echo; echo "[7] Plac budowy — A2: wyjazd ≥ 10 min → Dostarczone (nigdy UNLOADED)"
pos $A 65.5000 21.7000 "2026-10-03 08:00+00"; pos $A 65.5001 21.7001 "2026-10-03 08:05+00"
pos $A 65.8054 21.7591 "2026-10-03 10:00+00"; pos $A 65.8055 21.7592 "2026-10-03 10:05+00"
chk "wjazd na plac → AT_SITE"                                "$(st $A)" AT_SITE
pos $A 65.8054 21.7591 "2026-10-03 10:30+00"
chk "postój na placu: nadal AT_SITE, NIGDY UNLOADED"         "$(st $A)" AT_SITE
# wyjazd po długim postoju (od 10:00) → DELIVERED
pos $A 58.9350 17.9500 "2026-10-04 06:00+00"; pos $A 58.9351 17.9501 "2026-10-04 06:05+00"
chk "A2 wyjazd z placu ≥ 10 min → DELIVERED"                 "$(st $A)" DELIVERED
chk "A2 actual_delivery_at = czas wyjazdu"                   "select to_char(actual_delivery_at at time zone 'UTC','YYYY-MM-DD HH24:MI') from loads where id='$A'" "2026-10-04 06:05"
# #461: korekta AIS zostawia stare FERRY z zastepuje — oś bez zastąpionych
chk "pełna ścieżka A w dzienniku zdarzeń" \
  "select string_agg(payload->>'to', ' → ' order by occurred_at) from load_events e where e.load_id='$A' and e.event_type='STATUS_AUTO' and not exists (select 1 from load_events z where z.load_id=e.load_id and z.payload->>'zastepuje'=e.id::text)" \
  "AT_PORT_GDANSK → FERRY → AT_PORT_NYNASHAMN → IN_TRANSIT_SE → AT_SITE → DELIVERED"

echo; echo "[8] Uprawnienia"
as() { $PSQL -c "begin; set local role authenticated; set local request.jwt.claim.sub='$1'; $2; rollback;" 2>&1 | grep -vE '^(BEGIN|SET|ROLLBACK)$' | tail -1; }
out=$(as $SCX "select promote_ferry_departures('2099-01-01')"); echo "$out" | grep -q "permission denied" && { ok=$((ok+1)); echo "  OK    użytkownik nie wywoła przełączania PROMU"; } || { fail=$((fail+1)); echo "  FAIL  $out"; }
chk "KSH widzi rozkład rejsów"  "select 5" "$(as $KSH "select count(*) from sailings")"
# D-1501 / F7 B2: SCX przypisuje przyszły (S5) na transport bez wypłyniętego rejsu.
# UUID 63 — nie 5b (5b = SG-03 w [12] A2).
Lfut=$(L 63)
mk $Lfut FUT "'HHL/FUT'" "'SCX/FUT'" READY null
chk "SCX przypisuje przyszły rejs do swojego transportu" "select 1" "$(as $SCX "with u as (update loads set sailing_id='$S5' where id='$Lfut' returning 1) select count(*) from u")"
chk "KSH nie przypisze rejsu"   "select 0" "$(as $KSH "with u as (update loads set sailing_id='$S5' where id='$Lfut' returning 1) select count(*) from u")"
out=$($PSQL -c "begin; set local role authenticated; set local request.jwt.claim.sub='$SCX'; update loads set sailing_id='$S4' where id='$Lfut'; rollback;" 2>&1)
echo "$out" | grep -q "jeszcze nie wypłynął" && { ok=$((ok+1)); echo "  OK    SCX nie przypisze rejsu wypłyniętego"; } || { fail=$((fail+1)); echo "  FAIL  wypłynięty: $out"; }
# F7 B3: B ma S1 wypłynięty — SCX nie przepnie nawet na przyszły S5.
out=$($PSQL -c "begin; set local role authenticated; set local request.jwt.claim.sub='$SCX'; update loads set sailing_id='$S5' where id='$B'; rollback;" 2>&1)
echo "$out" | grep -q "po wypłynięciu" && { ok=$((ok+1)); echo "  OK    SCX nie zmieni rejsu gdy stary wypłynął"; } || { fail=$((fail+1)); echo "  FAIL  stary rejs: $out"; }
out=$($PSQL -c "begin; set local role authenticated; set local request.jwt.claim.sub='$SCX'; update loads set sailing_id='$S4' where id='$A'; rollback;" 2>&1); echo "$out" | grep -q "po wypłynięciu" && { ok=$((ok+1)); echo "  OK    przewoźnik nie zmieni rejsu po wypłynięciu"; } || { fail=$((fail+1)); echo "  FAIL  $out"; }
# F7 N2: SCX przepina z odwołanego (godzina minęła) na przyszły.
Lcan=$(L 64)
mk $Lcan CAN "'HHL/CAN'" "'SCX/CAN'" READY "'$S2'"
chk "SCX przepina z odwołanego na przyszły" "select 1" "$(as $SCX "with u as (update loads set sailing_id='$S5' where id='$Lcan' returning 1) select count(*) from u")"

echo; echo "[9] Strefy w prawdziwych metrach — różnica od zadanego promienia poniżej 1%"
chk "port Gdańsk: 800 m"   "select abs(round(st_distance(st_centroid(geom)::geography, st_exteriorring(geom)::geography)::numeric) - 800) < 8   from geofences where name='Port Gdańsk'"   t
chk "plac Stegra: 1500 m"  "select abs(round(st_distance(st_centroid(geom)::geography, st_exteriorring(geom)::geography)::numeric) - 1500) < 15 from geofences where name='Plac Stegra'"   t
chk "bufor Boden: 50 km"   "select abs(round(st_distance(st_centroid(geom)::geography, st_exteriorring(geom)::geography)::numeric) - 50000) < 500 from geofences where name='Bufor Boden'" t
chk "auto 600 m od środka portu jest w strefie" "select st_contains(geom, st_setsrid(st_makepoint(18.6800 + 600/(111320*cos(radians(54.403))), 54.4030),4326)) from geofences where name='Port Gdańsk'" t

# C17 (D-20261015-2110-01): CMR → READY_TO_INVOICE, obie faktury → INVOICED, UNLOADED nie powstaje
echo; echo "[10] C17 — automat rozliczenia (CMR / faktury)"
HHLO=00000000-0000-0000-0000-00000000a001
KSHO=00000000-0000-0000-0000-00000000a002
C17A=$(L 2a); C17B=$(L 2b); C17C=$(L 2c); C17D=$(L 2d)
mk $C17A C17A "'HHL/C17A'" "'SCX/C17A'" DELIVERED null
mk $C17B C17B "'HHL/C17B'" "'SCX/C17B'" DELIVERED null
mk $C17C C17C "'HHL/C17C'" "'SCX/C17C'" DELIVERED null
mk $C17D C17D "'HHL/C17D'" "'SCX/C17D'" AT_SITE null
q "update loads set actual_delivery_at='2026-10-10 12:00+00' where id in ('$C17A','$C17B','$C17C')" >/dev/null
# CMR przed dostawą — bez zmiany
q "insert into documents (project_id, load_id, category, storage_path, file_name, mime_type, size_bytes, uploaded_at)
    values ('$P','$C17A','CMR','test/c17-early.pdf','cmr.pdf','application/pdf',100,'2026-10-09 08:00+00')" >/dev/null
chk "C17 CMR przed dostawą: status DELIVERED" "$(st $C17A)" DELIVERED
# CMR po dostawie → READY_TO_INVOICE, jedno STATUS_AUTO
q "insert into documents (project_id, load_id, category, storage_path, file_name, mime_type, size_bytes, uploaded_at)
    values ('$P','$C17A','CMR','test/c17-ok.pdf','cmr2.pdf','application/pdf',100,'2026-10-10 14:00+00')" >/dev/null
chk "C17 CMR po dostawie → READY_TO_INVOICE" "$(st $C17A)" READY_TO_INVOICE
chk "C17 jedno zdarzenie STATUS_AUTO READY_TO_INVOICE" \
  "select count(*) from load_events where load_id='$C17A' and event_type='STATUS_AUTO' and payload->>'to'='READY_TO_INVOICE'" 1
# drugi CMR nie dubluje
q "insert into documents (project_id, load_id, category, storage_path, file_name, mime_type, size_bytes, uploaded_at)
    values ('$P','$C17A','CMR','test/c17-ok2.pdf','cmr3.pdf','application/pdf',100,'2026-10-10 15:00+00')" >/dev/null
chk "C17 drugi CMR nie dubluje zdarzenia" \
  "select count(*) from load_events where load_id='$C17A' and event_type='STATUS_AUTO' and payload->>'to'='READY_TO_INVOICE'" 1
# faktury: najpierw obie na C17B (jeszcze bez CMR) — potem CMR → dwa zdarzenia
DOC_K=aaaaaaaa-0000-4000-8000-00000000c171
DOC_P=aaaaaaaa-0000-4000-8000-00000000c172
INV_K=aaaaaaaa-0000-4000-8000-00000000c173
INV_P=aaaaaaaa-0000-4000-8000-00000000c174
INV_BAD=aaaaaaaa-0000-4000-8000-00000000c175
q "insert into documents (id, project_id, load_id, category, storage_path, file_name, mime_type, size_bytes)
    values ('$DOC_K','$P','$C17B','INVOICE','test/c17-fk.pdf','fk.pdf','application/pdf',100),
           ('$DOC_P','$P','$C17B','INVOICE','test/c17-fp.pdf','fp.pdf','application/pdf',100)
    on conflict (id) do nothing" >/dev/null
q "insert into invoices (id, project_id, carrier_org_id, period_start, period_end, currency, direction,
                         issuer_org_id, recipient_org_id, invoice_number, issue_date, week_key, document_id, status)
    values ('$INV_K','$P','$SCXO','2026-10-06','2026-10-12','EUR','KOSZT','$SCXO','$HHLO','C17/K/1','2026-10-13','2026-W41','$DOC_K','SUBMITTED'),
           ('$INV_P','$P','$SCXO','2026-10-06','2026-10-12','EUR','PRZYCHOD','$HHLO','$KSHO','C17/P/1','2026-10-13','2026-W41','$DOC_P','SUBMITTED')
    on conflict (id) do nothing" >/dev/null
q "insert into invoice_lines (invoice_id, load_id, direction, expected_amount, invoiced_amount)
    values ('$INV_K','$C17B','KOSZT',1,1), ('$INV_P','$C17B','PRZYCHOD',1,1)
    on conflict (invoice_id, load_id) do nothing" >/dev/null
chk "C17 faktury przed CMR: nadal DELIVERED" "$(st $C17B)" DELIVERED
q "insert into documents (project_id, load_id, category, storage_path, file_name, mime_type, size_bytes, uploaded_at)
    values ('$P','$C17B','CMR','test/c17-b.pdf','cmr.pdf','application/pdf',100,'2026-10-10 16:00+00')" >/dev/null
chk "C17 faktury+CMR → INVOICED" "$(st $C17B)" INVOICED
chk "C17 dwa STATUS_AUTO (READY + INVOICED)" \
  "select count(*) from load_events where load_id='$C17B' and event_type='STATUS_AUTO' and payload->>'to' in ('READY_TO_INVOICE','INVOICED')" 2
# faktura DISPUTED nie liczy się — C17C
q "insert into documents (project_id, load_id, category, storage_path, file_name, mime_type, size_bytes, uploaded_at)
    values ('$P','$C17C','CMR','test/c17-c.pdf','cmr.pdf','application/pdf',100,'2026-10-10 16:00+00')" >/dev/null
chk "C17 C → READY_TO_INVOICE po CMR" "$(st $C17C)" READY_TO_INVOICE
DOC_BAD=aaaaaaaa-0000-4000-8000-00000000c176
q "insert into documents (id, project_id, load_id, category, storage_path, file_name, mime_type, size_bytes)
    values ('$DOC_BAD','$P','$C17C','INVOICE','test/c17-bad.pdf','bad.pdf','application/pdf',100) on conflict (id) do nothing" >/dev/null
q "insert into invoices (id, project_id, carrier_org_id, period_start, period_end, currency, direction,
                         issuer_org_id, recipient_org_id, invoice_number, issue_date, week_key, document_id, status)
    values ('$INV_BAD','$P','$SCXO','2026-10-06','2026-10-12','EUR','KOSZT','$SCXO','$HHLO','C17/K/BAD','2026-10-13','2026-W41','$DOC_BAD','DISPUTED')
    on conflict (id) do nothing" >/dev/null
q "insert into invoice_lines (invoice_id, load_id, direction, expected_amount, invoiced_amount)
    values ('$INV_BAD','$C17C','KOSZT',1,1) on conflict (invoice_id, load_id) do nothing" >/dev/null
# druga strona SUBMITTED — nadal brak pary ważnej
DOC_P2=aaaaaaaa-0000-4000-8000-00000000c177
INV_P2=aaaaaaaa-0000-4000-8000-00000000c178
q "insert into documents (id, project_id, load_id, category, storage_path, file_name, mime_type, size_bytes)
    values ('$DOC_P2','$P','$C17C','INVOICE','test/c17-p2.pdf','p2.pdf','application/pdf',100) on conflict (id) do nothing" >/dev/null
q "insert into invoices (id, project_id, carrier_org_id, period_start, period_end, currency, direction,
                         issuer_org_id, recipient_org_id, invoice_number, issue_date, week_key, document_id, status)
    values ('$INV_P2','$P','$SCXO','2026-10-06','2026-10-12','EUR','PRZYCHOD','$HHLO','$KSHO','C17/P/2','2026-10-13','2026-W41','$DOC_P2','SUBMITTED')
    on conflict (id) do nothing" >/dev/null
q "insert into invoice_lines (invoice_id, load_id, direction, expected_amount, invoiced_amount)
    values ('$INV_P2','$C17C','PRZYCHOD',1,1) on conflict (invoice_id, load_id) do nothing" >/dev/null
chk "C17 faktura DISPUTED: bez INVOICED" "$(st $C17C)" READY_TO_INVOICE
# UNLOADED nie powstaje przy zapisie statusu (API)
q "update loads set status='DELIVERED', actual_delivery_at='2026-10-10 12:00+00' where id='$C17D'" >/dev/null
# bezpośredni zapis UNLOADED przez status_ctx — wyzwalacz/guard; sprawdzamy funkcję rangi + brak UNLOADED po load_status_set ścieżce jest w e25;
# tu: auto_set_status z UNLOADED nie jest wołany z GPS; assert że po C17 brak ścieżki GPS do UNLOADED (już [7]) + enum zapisany jako DELIVERED w driver — sprawdzamy helper:
chk "C17 UNLOADED i DELIVERED ta sama ranga" "select (load_status_rank('UNLOADED'::load_status)=load_status_rank('DELIVERED'::load_status))" t
chk "C17 0 transportów UNLOADED w zestawie" "select count(*) from loads where status='UNLOADED' and id in ('$C17A','$C17B','$C17C','$C17D')" 0

# A1 / E27 / L17 (D-20261017-2130-01 §5, D-20261017-2205-01): okno 03:00 i bezpiecznik.
# D-1710 (#368): okno i pozycje tylko przy telematics_vehicle_id.
echo; echo "[11] A1 — okno śledzenia i bezpiecznik L17"
W1=$(L 3a); W2=$(L 3b); W3=$(L 3c); W4=$(L 3d); W5=$(L 3e); W6=$(L 3f); W7=$(L 4a)
# W3/W4 = poza oknem: plan w przyszłości (nie sztywne daty — w dniu planu „cisza poza oknem” / T05 padają).
W3_PLAN=$(q "select (current_date + 14)::text")
W4_PLAN=$(q "select (current_date + 21)::text")
W4_PLAN2=$(q "select (current_date + 23)::text")
# Data od razu docelowa: mk() wstawia 30.09, a zmiana daty po starcie okna zamraża śledzenie.
q "insert into loads (id,project_id,carrier_org_id,order_no,hhl_order_no,carrier_order_no,status,plan_load_date,telematics_vehicle_id) values
 ('$W1','$P','$SCXO','KSH/A1W1','HHL/A1W1','SCX/A1W1','IN_TRANSIT_PL','2026-10-05','TEL-A1W1'),
 ('$W2','$P','$SCXO','KSH/A1W2','HHL/A1W2','SCX/A1W2','DELIVERED','2026-10-05','TEL-A1W2'),
 ('$W3','$P','$SCXO','KSH/A1W3','HHL/A1W3','SCX/A1W3','IN_TRANSIT_PL','$W3_PLAN','TEL-A1W3'),
 ('$W4','$P','$SCXO','KSH/A1W4','HHL/A1W4','SCX/A1W4','IN_TRANSIT_PL','$W4_PLAN','TEL-A1W4'),
 ('$W5','$P','$SCXO','KSH/A1W5','HHL/A1W5','SCX/A1W5','IN_TRANSIT_PL','2026-10-05','TEL-A1W5'),
 ('$W6','$P','$SCXO','KSH/A1W6','HHL/A1W6','SCX/A1W6','IN_TRANSIT_SE','2026-10-01','TEL-A1W6')" >/dev/null
T59=$(q "select public.tracking_window_start('2026-10-05'::date) - interval '1 minute'")
T00=$(q "select public.tracking_window_start('2026-10-05'::date)")
# W4: daty w przyszłości (nie „dziś”) — po 03:00 w dniu planu okno już startuje i zamraża tracking_opened_at.
T05=$(q "select public.tracking_window_start('$W4_PLAN'::date)")
T07=$(q "select public.tracking_window_start('$W4_PLAN2'::date)")
pos $W1 52.09 17.02 "$T59"
chk "A1 02:59 bez pozycji" "select count(*) from positions where load_id='$W1'" 0
pos $W1 52.09 17.02 "$T00"
chk "A1 03:00 zapis pozycji" "select count(*) from positions where load_id='$W1'" 1
pos $W2 52.09 17.02 "$T00"
chk "A1 Dostarczone bez pozycji" "select count(*) from positions where load_id='$W2'" 0
pos $W3 52.09 17.02 "2026-10-17 12:00:00+00"
chk "A1 przyszły tydzień bez pozycji" "select count(*) from positions where load_id='$W3'" 0
q "update loads set plan_load_date='$W4_PLAN2' where id='$W4'" >/dev/null
pos $W4 52.09 17.02 "$T05"
chk "A1 zmiana daty przed startem nie otwiera starego dnia" "select count(*) from positions where load_id='$W4'" 0
pos $W4 52.09 17.02 "$T07"
chk "A1 nowy dzień załadunku otwiera okno" "select count(*) from positions where load_id='$W4'" 1
pos $W5 52.09 17.02 "$T00"
q "update loads set plan_load_date='2026-12-01' where id='$W5'" >/dev/null
pos $W5 52.09 17.02 "2026-10-06 08:00:00+00"
chk "A1 po starcie późniejsza data nie zamyka śledzenia" "select count(*) from positions where load_id='$W5'" 2
chk "A1 tracking_opened_at zamrożone" "select (tracking_opened_at = public.tracking_window_start('2026-10-05'::date))::text from loads where id='$W5'" true
chk "A1 L17 17 zaległych transportów" "with ins as (insert into loads (id, project_id, carrier_org_id, order_no, hhl_order_no, carrier_order_no, status, plan_load_date, plan_delivery_date, telematics_vehicle_id)
   select ('55555555-0000-0000-0000-00000000a1'||lpad(g::text,2,'0'))::uuid, '$P', '$SCXO', 'KSH/L17/'||g, 'HHL/L17/'||g, 'SCX/L17/'||g, 'IN_TRANSIT_PL', current_date - 10, current_date - 5, 'TEL-L17-'||g
   from generate_series(1,17) g returning 1) select count(*) from ins" 17
chk "A1 L17 zaległości: 17 spraw" "select public.tracking_delivery_guard(); select count(*) from decisions where type_code='DELIVERY_UNCONFIRMED' and load_id in (select id from loads where order_no like 'KSH/L17/%')" 17
chk "A1 L17 zaległości: 0 powiadomień SCX" "select count(*) from notifications n join app_users u on u.id=n.user_id join organizations o on o.id=u.org_id where n.template='DECISION_OPEN' and n.load_id in (select id from loads where order_no like 'KSH/L17/%') and o.kind='CARRIER'" 0
chk "A1 L17 zaległości: jeden wpis zbiorczy u administratora" "select count(*)||'/'||min(payload->>'title') from notifications n join app_users u on u.id=n.user_id where n.template='L17_BACKLOG' and u.role='HHL_ADMIN'" "1/Potwierdź dostawę: 17 transportów bez „Dostarczone” po planowanej dostawie — lista w „Do zrobienia”"
chk "A1 L17 drugi przebieg zaległości bez nowych powiadomień" "select public.tracking_delivery_guard(); select count(*) from notifications where template='L17_BACKLOG'" 1
q "update loads set plan_load_date='2026-10-01', plan_delivery_date='2026-10-01', order_no=null where id='$W6'" >/dev/null
q "insert into shipment_items (project_id, load_id, shipment_code, length_m, width_m, height_m) values ('$P','$W6','SG-A1',10,3,3)" >/dev/null
pos $W6 50.00 10.00 "2026-10-17 12:00:00+00"
chk "A1 L17 tytuł z kodu wysyłki i pozycji bez strefy" "select public.tracking_delivery_guard(); select title from decisions where load_id='$W6' and type_code='DELIVERY_UNCONFIRMED'" "SG-A1: brak „Dostarczone” dobę po planowanej dostawie 01.10.2026 · ostatnia pozycja 17.10.2026, 14:00, pozycja 50.00, 10.00"
chk "A1 L17 jedna sprawa na transport" "select count(*) from decisions where type_code='DELIVERY_UNCONFIRMED' and load_id='$W6'" 1
chk "A1 L17 śledzenie trwa do potwierdzenia" "select count(*) from positions where load_id='$W6'" 1
q "update decisions set status='RESOLVED', resolution_code='STILL_EN_ROUTE', resolved_at=now()-interval '1 hour' where load_id='$W6' and type_code='DELIVERY_UNCONFIRMED'" >/dev/null
chk "A1 L17 przypomnienie czeka 24 h" "select public.tracking_delivery_guard(); select status from decisions where load_id='$W6' and type_code='DELIVERY_UNCONFIRMED'" RESOLVED
q "update decisions set resolved_at=now()-interval '25 hours' where load_id='$W6' and type_code='DELIVERY_UNCONFIRMED'" >/dev/null
chk "A1 L17 po dobie sprawa wraca, jeden wiersz" "select public.tracking_delivery_guard(); select status||'/'||count(*) from decisions where load_id='$W6' and type_code='DELIVERY_UNCONFIRMED' group by status" "NEW/1"
q "update decisions set status='RESOLVED', resolution_code='MANUAL_STATUS', resolved_at=now()-interval '25 hours' where load_id='$W6' and type_code='DELIVERY_UNCONFIRMED'" >/dev/null
chk "A1 L17 ręczny status bez Dostarczone wraca po dobie" "select public.tracking_delivery_guard(); select status from decisions where load_id='$W6' and type_code='DELIVERY_UNCONFIRMED'" NEW
q "update loads set status='DELIVERED' where id='$W6'" >/dev/null
chk "A1 L17 Dostarczone zamyka sprawę" "select status from decisions where load_id='$W6' and type_code='DELIVERY_UNCONFIRMED'" RESOLVED
q "update app_parameters set label=((current_date - 2)::timestamp at time zone 'Europe/Warsaw')::text where key='A1_DEPLOYED_AT'" >/dev/null
mk $W7 A1W7 "'HHL/A1W7'" "'SCX/A1W7'" IN_TRANSIT_PL null
q "update loads set plan_load_date=current_date - 10, plan_delivery_date=current_date - 2 where id='$W7'" >/dev/null
chk "A1 L17 nowy po terminie: sprawa z powiadomieniem" "select public.tracking_delivery_guard(); select (count(*) > 0)::text from notifications where template='DECISION_OPEN' and load_id='$W7'" true
q "insert into risk_signals (project_id, load_id, kind, severity, title, title_key, detail, dedup_key) values ('$P','$W3','SILENT_VEHICLE','HIGH','cisza','rk_silent_vehicle','{\"l3\":\"1\"}','SILENT:$W3')" >/dev/null
chk "A1 cisza poza oknem się zamyka" "select public.detect_silent_vehicles(90); select (resolved_at is not null)::text from risk_signals where dedup_key='SILENT:$W3'" true
chk "A1 po teście brak klucza ciszy w bazie statusów" "delete from decision_events where decision_id in (select d.id from decisions d join risk_signals s on s.id=d.risk_id where s.title_key='rk_silent_vehicle' or s.kind='SILENT_VEHICLE' or s.dedup_key like 'SILENT:%'); delete from decisions where risk_id in (select id from risk_signals where title_key='rk_silent_vehicle' or kind='SILENT_VEHICLE' or dedup_key like 'SILENT:%'); delete from risk_signals where title_key='rk_silent_vehicle' or kind='SILENT_VEHICLE' or dedup_key like 'SILENT:%'; select count(*) from risk_signals where title_key='rk_silent_vehicle'" 0
chk "A1 process_position ma bramę okna" "select strpos(pg_get_functiondef(p.oid), 'load_in_tracking_window') > 0 from pg_proc p where p.proname='process_position'" t
chk "A1 cisza bez twardego źródła TELEMATICS_API" "select strpos(pg_get_functiondef(p.oid), 'TELEMATICS_API') = 0 from pg_proc p where p.proname='detect_silent_vehicles'" t
chk "A1 strażnik: anulowanie z cancel_ctx nadal dozwolone" "select (pg_get_functiondef('guard_load_update()'::regprocedure) like '%v_ctx not in (''MANUAL'', ''IMPORT'')%')::text" true
# D-1710: bez linku brak pozycji; przesunięcie daty w przygotowaniu czyści tracking_opened_at.
Wnl=$(L 4c); Wprep=$(L 4d)
q "insert into loads (id,project_id,carrier_org_id,order_no,hhl_order_no,carrier_order_no,status,plan_load_date,telematics_vehicle_id,tracking_opened_at) values
 ('$Wnl','$P','$SCXO','KSH/A1NL','HHL/A1NL','SCX/A1NL','READY','2026-10-05',null,null),
 ('$Wprep','$P','$SCXO','KSH/A1PR','HHL/A1PR','SCX/A1PR','READY','2026-10-05','TEL-A1PR', public.tracking_window_start('2026-10-01'::date))" >/dev/null
pos $Wnl 52.09 17.02 "$T00"
chk "D-1710 bez linku: brak pozycji mimo 03:00" "select count(*) from positions where load_id='$Wnl'" 0
q "update loads set plan_load_date='2026-11-07' where id='$Wprep'" >/dev/null
chk "D-1710 przesunięcie daty w przygotowaniu czyści tracking_opened_at" "select (tracking_opened_at is null)::text from loads where id='$Wprep'" true
q "update loads set telematics_vehicle_id='TEL-A1NL' where id='$Wnl'" >/dev/null
pos $Wnl 52.09 17.02 "$T00"
chk "D-1710 po dodaniu linku: pozycja w oknie" "select count(*) from positions where load_id='$Wnl'" 1
chk "D-1710 load_in_tracking_window wymaga linku" "select strpos(pg_get_functiondef(p.oid), 'telematics_vehicle_id') > 0 from pg_proc p where p.proname='load_in_tracking_window'" t
# F7 #373 pkt 6+8: TELM nie rusza READY; SCX zmienia link — tracking_opened_at z freeze nie blokuje.
Wscx=$(L 4e)
q "insert into loads (id,project_id,carrier_org_id,order_no,hhl_order_no,carrier_order_no,status,plan_load_date,telematics_vehicle_id) values
 ('$Wscx','$P','$SCXO','KSH/A1SCX','HHL/A1SCX','SCX/A1SCX','READY','2026-10-05','TEL-SCX-1')" >/dev/null
chk "D-1710 TELM: READY bez fazy z pozycji" "select coalesce(telm_infer_phase_from_position('$Wscx', 52.1, 17.0, public.tracking_window_start('2026-10-05'))::text,'∅')" "∅"
chk "D-1710 SCX: usunięcie linku OK (tracking_opened_at)" "begin; set local role authenticated; set local request.jwt.claim.sub='$SCX'; update loads set telematics_vehicle_id=null where id='$Wscx'; select (telematics_vehicle_id is null)::text from loads where id='$Wscx'; commit" true
# F7 #373: d1710_repair — SG-17 (TELM przed oknem), SG-15 (bez linku), nietknięty w trasie z linkiem.
R17=$(L 6a); R15=$(L 6b); Rok=$(L 6c); Rdel=$(L 6d)
TW17=$(q "select public.tracking_window_start('2026-10-22'::date)")
q "insert into loads (id,project_id,carrier_org_id,order_no,hhl_order_no,carrier_order_no,status,plan_load_date,telematics_vehicle_id,tracking_opened_at) values
 ('$R17','$P','$SCXO','KSH/R17','HHL/R17','SCX/R17','IN_TRANSIT_PL','2026-10-22','https://emtrack.eu/app/', ('$TW17'::timestamptz - interval '1 day')),
 ('$R15','$P','$SCXO','KSH/R15','HHL/R15','SCX/R15','READY','2026-10-22',null,null),
 ('$Rok','$P','$SCXO','KSH/ROK','HHL/ROK','SCX/ROK','IN_TRANSIT_SE','2026-10-05','TEL-ROK', public.tracking_window_start('2026-10-05'::date)),
 ('$Rdel','$P','$SCXO','KSH/RDEL','HHL/RDEL','SCX/RDEL','DELIVERED','2026-09-01','https://emtrack.eu/app/',null)" >/dev/null
# STATUS_AUTO:<id>:IN_TRANSIT_PL jak z auto_set_status w telm_infer — bez :d1710 blokuje prawdziwy wyjazd.
q "insert into load_events (load_id,event_type,occurred_at,payload,dedup_key) values
 ('$R17','STATUS_AUTO',('$TW17'::timestamptz - interval '2 hours'), jsonb_build_object('from','READY','to','IN_TRANSIT_PL','zrodlo','TELM_PHASE_INFER'),'STATUS_AUTO:$R17:IN_TRANSIT_PL'),
 ('$R17','STATUS_AUTO',('$TW17'::timestamptz - interval '2 hours'), jsonb_build_object('from','READY','to','IN_TRANSIT_PL','zrodlo','TELM_PHASE_INFER'),'TELM_PHASE_INFER:$R17:IN_TRANSIT_PL'),
 ('$R17','GEOFENCE_EXIT',('$TW17'::timestamptz - interval '2 hours'), jsonb_build_object('geofence_kind','LOADING','synthetic',true,'zrodlo','TELM_PHASE_INFER'),'TELM_PHASE_EXIT_LOAD:$R17'),
 ('$Rok','STATUS_AUTO','2026-10-04 12:00+00', jsonb_build_object('from','DOCS_PENDING','to','READY','zrodlo','A9'),'STATUS_AUTO:$Rok:READY')" >/dev/null
q "insert into positions (load_id, ts, geom_raw, source) values
 ('$R17', ('$TW17'::timestamptz - interval '90 minutes'), st_setsrid(st_makepoint(18.65, 54.35), 4326), 'TELEMATICS_API'),
 ('$R15', '2026-10-20 10:00+00', st_setsrid(st_makepoint(17.02, 52.09), 4326), 'TELEMATICS_API'),
 ('$Rok', '2026-10-06 10:00+00', st_setsrid(st_makepoint(17.2, 60.5), 4326), 'TELEMATICS_API'),
 ('$Rdel', '2026-09-02 10:00+00', st_setsrid(st_makepoint(17.2, 60.5), 4326), 'TELEMATICS_API')" >/dev/null
q "insert into risk_signals (project_id, load_id, kind, severity, title, title_key, detail, dedup_key, detected_at) values
 ('$P','$R17','ETA_BREACH','HIGH','Opóźnienie','rk_eta_after_latest','{\"l3\":\"1\"}','ETA:$R17', ('$TW17'::timestamptz - interval '80 minutes'))" >/dev/null
q "insert into telm_attach_phase (load_id, phase, observed_at, lat, lon) values ('$R17','IN_TRANSIT_PL',('$TW17'::timestamptz - interval '2 hours'), 54.35, 18.65)" >/dev/null
# Prawidłowa sprawa NO_AWIZACJA na R15 — naprawa nie może jej zamknąć (F7).
q "select decision_open_from_event('$P','NO_AWIZACJA','AWIZ:$R15','R15: brak awizacji', '{}'::jsonb, '$R15', null)" >/dev/null
Nbef=$(q "select count(*) from notifications")
Wbef=$(q "select count(*) from workflow_runs")
q "select public.d1710_repair()" >/dev/null
chk "D-1710 repair: SG-17 → READY" "select status from loads where id='$R17'" READY
chk "D-1710 repair: pozycja SG-17 odłączona" "select count(*) from positions where detached_load_id='$R17'" 1
chk "D-1710 repair: pozycje bez linku = 0" "select count(*) from positions p join loads l on l.id=p.load_id where nullif(btrim(l.telematics_vehicle_id),'') is null" 0
chk "D-1710 repair: ryzyko ETA zamknięte" "select (resolved_at is not null)::text from risk_signals where dedup_key='ETA:$R17'" true
chk "D-1710 repair: w trasie z linkiem nietknięty" "select status||'/'||count(*) from loads l join positions p on p.load_id=l.id where l.id='$Rok' group by status" "IN_TRANSIT_SE/1"
chk "D-1710 repair: DELIVERED z linkiem nietknięty" "select status||'/'||count(*) from loads l join positions p on p.load_id=l.id where l.id='$Rdel' group by status" "DELIVERED/1"
chk "D-1710 repair: STATUS_AUTO→READY zostaje na osi" "select count(*) from load_events where load_id='$Rok' and payload->>'to'='READY'" 1
chk "D-1710 repair: telm_attach_phase zresetowany" "select source from telm_attach_phase where load_id='$R17'" D1710_RESET
chk "D-1710 repair: dedup_key odłączonych z :d1710" "select count(*) from load_events where detached_load_id='$R17' and dedup_key like '%:d1710'" 3
chk "D-1710 repair: NO_AWIZACJA nietknięta" "select status from decisions where load_id='$R15' and type_code='NO_AWIZACJA' order by created_at desc limit 1" NEW
chk "D-1710 repair: bez nowych notifications" "select (count(*)=$Nbef)::text from notifications" true
chk "D-1710 repair: bez nowych workflow_runs" "select (count(*)=$Wbef)::text from workflow_runs" true
# Po naprawie prawdziwy wyjazd musi trafić na oś (dedup STATUS_AUTO:<id>:IN_TRANSIT_PL wolny).
q "select auto_set_status('$R17','READY','IN_TRANSIT_PL','wyjazd ze strefy załadunku', now(), jsonb_build_object('powod','test D-1710'))" >/dev/null
# A10: dedup_key STATUS_AUTO ma czas (ponowny automat po cofnięciu) — like, nie stały klucz.
chk "D-1710 repair: prawdziwy STATUS_AUTO po wyjeździe" "select count(*) from load_events where load_id='$R17' and event_type='STATUS_AUTO' and payload->>'to'='IN_TRANSIT_PL' and dedup_key like 'STATUS_AUTO:$R17:IN_TRANSIT_PL%'" 1
chk "D-1710 repair: status po prawdziwym wyjeździe" "select status from loads where id='$R17'" IN_TRANSIT_PL
# F7: sprzątanie LATE_DATE + ETA z D-1710 (risks.sh liczy klucze automatu w tower_test_status).
# decisions.risk_id → risk_signals bez CASCADE — najpierw decision_events/decisions.
q "delete from decision_events where decision_id in (
      select d.id from decisions d join risk_signals s on s.id=d.risk_id
       where s.title_key in ('rk_late_date_change','rk_eta_after_latest')
          or s.dedup_key like 'LATE_DATE%' or s.dedup_key like 'ETA:%');
    delete from decisions where risk_id in (
      select id from risk_signals
       where title_key in ('rk_late_date_change','rk_eta_after_latest')
          or dedup_key like 'LATE_DATE%' or dedup_key like 'ETA:%');
    delete from risk_signals
     where title_key in ('rk_late_date_change','rk_eta_after_latest')
        or dedup_key like 'LATE_DATE%' or dedup_key like 'ETA:%'" >/dev/null
HHL=11111111-0000-0000-0000-000000000001
W8=$(L 4b)
q "insert into loads (id,project_id,carrier_org_id,order_no,status,plan_load_date,telematics_vehicle_id) values ('$W8','$P','$SCXO','KSH/A1W8','PLANNED','2026-11-20','TEL-A1W8')" >/dev/null
q "insert into shipment_items (project_id, load_id, shipment_code, length_m, width_m, height_m, cargo_class) values ('$P','$W8','SG-ZOST',10,3,3,'DIMENSIONED')" >/dev/null
chk "A1 HHL w sesji: cancel_load z powodem → CANCELLED" "begin; set local role authenticated; set local request.jwt.claim.sub='$HHL'; select cancel_load('$W3','Test A1 — anulowanie'); commit" CANCELLED
chk "A1 import w sesji HHL anuluje PLANNED spoza pliku" "begin; set local role authenticated; set local request.jwt.claim.sub='$HHL'; select import_schedule('$P', '[{\"code\":\"SG-KEEP\",\"length_m\":10,\"width_m\":3,\"height_m\":3,\"qty\":1,\"total_weight_t\":10,\"load_date\":\"2026-11-01\",\"delivery_date\":\"2026-11-05\"}]'::jsonb, '{SG-ZOST}'::text[], '{\"name\":\"a1.xlsx\",\"hash\":\"a1\",\"path\":\"x/a1.xlsx\"}'::jsonb, false); select status from loads where id='$W8'; commit" CANCELLED
# Po A1 imporcie (daty w LEAD_DAYS) może powstać LATE_DATE — risks.sh liczy klucze w tower_test_status.
q "delete from decision_events where decision_id in (
      select d.id from decisions d join risk_signals s on s.id=d.risk_id
       where s.title_key in ('rk_late_date_change','rk_eta_after_latest')
          or s.dedup_key like 'LATE_DATE%' or s.dedup_key like 'ETA:%');
    delete from decisions where risk_id in (
      select id from risk_signals
       where title_key in ('rk_late_date_change','rk_eta_after_latest')
          or dedup_key like 'LATE_DATE%' or dedup_key like 'ETA:%');
    delete from risk_signals
     where title_key in ('rk_late_date_change','rk_eta_after_latest')
        or dedup_key like 'LATE_DATE%' or dedup_key like 'ETA:%'" >/dev/null

# A2 / E26 / L14 — SG-03 (zmyślony ślad G-17) i sprawa DELIVERED_CHECK
echo; echo "[12] A2 — wyjazd z placu i L14"
SG=$(L 5b); SG2=$(L 5c)
q "insert into loads (id,project_id,carrier_org_id,order_no,hhl_order_no,carrier_order_no,status,plan_load_date,telematics_vehicle_id) values
 ('$SG','$P','$SCXO','KSH/SG03','HHL/SG03','SCX/SG03','IN_TRANSIT_SE','2026-10-05','TEL-SG03'),
 ('$SG2','$P','$SCXO','KSH/SG06','HHL/SG06','SCX/SG06','IN_TRANSIT_SE','2026-10-05','TEL-SG06')" >/dev/null
q "insert into shipment_items (project_id, load_id, shipment_code, length_m, width_m, height_m) values ('$P','$SG','SG-03',10,3,3)" >/dev/null
# SG-03: wjazd ~08:35, wyjazd 12:19 → Dostarczone
pos $SG 65.8054 21.7591 "2026-10-07 08:35:00+00"; pos $SG 65.8055 21.7592 "2026-10-07 08:36:00+00"
chk "A2 SG-03 wjazd → AT_SITE" "$(st $SG)" AT_SITE
pos $SG 65.8054 21.7591 "2026-10-07 10:00:00+00"
pos $SG 65.50 21.70 "2026-10-07 12:19:00+00"; pos $SG 65.50 21.71 "2026-10-07 12:20:00+00"
chk "A2 SG-03 wyjazd 12:19 → DELIVERED" "$(st $SG)" DELIVERED
chk "A2 SG-03 actual_delivery_at po wyjeździe" "select to_char(actual_delivery_at at time zone 'UTC','HH24:MI') from loads where id='$SG'" "12:20"
chk "A2 SG-03 STATUS_AUTO ma dwell_min" "select (payload ? 'dwell_min')::text from load_events where load_id='$SG' and event_type='STATUS_AUTO' and payload->>'to'='DELIVERED'" true
chk "A2 SG-03 śledzenie gaśnie (pozycja po Dostarczone = 0 nowych)" "select count(*) from process_position('$SG', 65.40, 21.60, '2026-10-07 13:00:00+00'); select count(*) from positions where load_id='$SG' and ts='2026-10-07 13:00:00+00'" 0
# L14: postój ~6 min → sprawa
pos $SG2 65.8054 21.7591 "2026-10-08 10:00:00+00"; pos $SG2 65.8055 21.7592 "2026-10-08 10:01:00+00"
chk "A2 L14 wjazd → AT_SITE" "$(st $SG2)" AT_SITE
pos $SG2 65.50 21.70 "2026-10-08 10:06:00+00"; pos $SG2 65.50 21.71 "2026-10-08 10:07:00+00"
chk "A2 L14 postój 6 min: status AT_SITE" "$(st $SG2)" AT_SITE
chk "A2 L14 jedna sprawa DELIVERED_CHECK" "select count(*) from decisions where load_id='$SG2' and type_code='DELIVERED_CHECK' and status='NEW'" 1
chk "A2 L14 detail.dwell_min ≈ 6" "select (abs((detail->>'dwell_min')::numeric - 6) <= 1)::text from decisions where load_id='$SG2' and type_code='DELIVERED_CHECK'" true
HHL=11111111-0000-0000-0000-000000000001
chk "A2 L14 SCX Tak → DELIVERED" "begin; set local role authenticated; set local request.jwt.claim.sub='$SCX'; select (delivered_check_resolve('$SG2', true, null)->>'status'); commit" DELIVERED
chk "A2 L14 po Tak sprawa RESOLVED YES" "select status||'/'||resolution_code from decisions where load_id='$SG2' and type_code='DELIVERED_CHECK'" "RESOLVED/DELIVERED_YES"
# druga sprawa L14 → Nie
SG3=$(L 5d)
q "insert into loads (id,project_id,carrier_org_id,order_no,hhl_order_no,carrier_order_no,status,plan_load_date,telematics_vehicle_id) values
 ('$SG3','$P','$SCXO','KSH/SG07','HHL/SG07','SCX/SG07','IN_TRANSIT_SE','2026-10-05','TEL-SG07')" >/dev/null
pos $SG3 65.8054 21.7591 "2026-10-09 11:00:00+00"; pos $SG3 65.8055 21.7592 "2026-10-09 11:01:00+00"
pos $SG3 65.50 21.70 "2026-10-09 11:06:00+00"; pos $SG3 65.50 21.71 "2026-10-09 11:07:00+00"
chk "A2 L14 Nie: status zostaje AT_SITE" "begin; set local role authenticated; set local request.jwt.claim.sub='$SCX'; select delivered_check_resolve('$SG3', false, 'jeszcze nie'); select status from loads where id='$SG3'; commit" AT_SITE
chk "A2 L14 Nie: resolution DELIVERED_NO" "select resolution_code from decisions where load_id='$SG3' and type_code='DELIVERED_CHECK'" DELIVERED_NO
out=$($PSQL -c "begin; set local role authenticated; set local request.jwt.claim.sub='$KSH'; select delivered_check_resolve('$SG3', true, null); rollback;" 2>&1)
echo "$out" | grep -qiE 'wskazana firma|Rozstrzygnięcie|42501' && { ok=$((ok+1)); echo "  OK    A2 L14 KSH odmowa"; } || { fail=$((fail+1)); echo "  FAIL  A2 L14 KSH odmowa: $out"; }
chk "A2 anon bez EXECUTE delivered_check_resolve" "select has_function_privilege('anon','delivered_check_resolve(uuid,boolean,text)','execute')::text" false
chk "A2 komentarz Awaryjnie w apply_geofence_status" "select (strpos(pg_get_functiondef('apply_geofence_status()'::regprocedure), 'Awaryjnie: GPS') > 0)::text" true
chk "A2 komentarz portu Gdańsk w apply_geofence_status" "select (strpos(pg_get_functiondef('apply_geofence_status()'::regprocedure), 'celowo niczego nie zmienia') > 0)::text" true
chk "A2 komentarz POPRAWKA 24.09 w process_position" "select (strpos(pg_get_functiondef('process_position(uuid,double precision,double precision,timestamptz,position_source,numeric,numeric,boolean,jsonb)'::regprocedure), 'POPRAWKA 24.09.2026') > 0)::text" true
chk "A2 p_ts bez default" "select (pg_get_function_arguments(p.oid) not like '%p_ts timestamp with time zone default%')::text from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='process_position'" true
chk "A2 delivered_check_apply woła decision_notify RESOLVE" "select (strpos(pg_get_functiondef('delivered_check_apply(uuid,boolean,text)'::regprocedure), 'decision_notify') > 0)::text" true
# decision_resolve — ta sama ścieżka co karta
SG4=$(L 5e); SG5=$(L 5f)
q "insert into loads (id,project_id,carrier_org_id,order_no,hhl_order_no,carrier_order_no,status,plan_load_date,telematics_vehicle_id) values
 ('$SG4','$P','$SCXO','KSH/SG08','HHL/SG08','SCX/SG08','AT_SITE','2026-10-05','TEL-SG08'),
 ('$SG5','$P','$SCXO','KSH/SG09','HHL/SG09','SCX/SG09','AT_SITE','2026-10-05','TEL-SG09')" >/dev/null
q "select decision_open_from_event('$P','DELIVERED_CHECK','L14:$SG4','SG-08: wyjazd z placu po 6 min — czy dostarczono?', '{\"exit_at\":\"2026-10-10 12:00:00+00\",\"dwell_min\":6,\"zone\":\"Plac Stegra\",\"threshold_min\":10}'::jsonb, '$SG4', null)" >/dev/null
q "select decision_open_from_event('$P','DELIVERED_CHECK','L14:$SG5','SG-09: wyjazd z placu po 6 min — czy dostarczono?', '{\"exit_at\":\"2026-10-10 13:00:00+00\",\"dwell_min\":6,\"zone\":\"Plac Stegra\",\"threshold_min\":10}'::jsonb, '$SG5', null)" >/dev/null
D4=$($PSQL -c "select id from decisions where load_id='$SG4' and type_code='DELIVERED_CHECK' and status='NEW'")
D5=$($PSQL -c "select id from decisions where load_id='$SG5' and type_code='DELIVERED_CHECK' and status='NEW'")
chk "A2 decision_resolve TAK → DELIVERED" "begin; set local role authenticated; set local request.jwt.claim.sub='$SCX'; select (decision_resolve('$D4','DELIVERED_YES',null)->>'status'); commit" DELIVERED
chk "A2 decision_resolve TAK: RESOLVED/DELIVERED_YES" "select status||'/'||resolution_code from decisions where id='$D4'" "RESOLVED/DELIVERED_YES"
chk "A2 decision_resolve NIE: status AT_SITE" "begin; set local role authenticated; set local request.jwt.claim.sub='$SCX'; select decision_resolve('$D5','DELIVERED_NO','jeszcze nie'); select status from loads where id='$SG5'; commit" AT_SITE
chk "A2 decision_resolve NIE: DELIVERED_NO" "select resolution_code from decisions where id='$D5'" DELIVERED_NO
# Tak przy statusie innym niż AT_SITE — sprawa zostaje otwarta
SG6=$(L 60)
q "insert into loads (id,project_id,carrier_org_id,order_no,hhl_order_no,carrier_order_no,status,plan_load_date,telematics_vehicle_id) values
 ('$SG6','$P','$SCXO','KSH/SG10','HHL/SG10','SCX/SG10','AT_SITE','2026-10-05','TEL-SG10')" >/dev/null
q "select decision_open_from_event('$P','DELIVERED_CHECK','L14:$SG6','SG-10: wyjazd z placu po 6 min — czy dostarczono?', '{\"exit_at\":\"2026-10-10 14:00:00+00\",\"dwell_min\":6,\"zone\":\"Plac Stegra\",\"threshold_min\":10}'::jsonb, '$SG6', null)" >/dev/null
q "select set_config('tower.status_ctx','on',true); update loads set status='IN_TRANSIT_SE' where id='$SG6'" >/dev/null
D6=$($PSQL -c "select id from decisions where load_id='$SG6' and type_code='DELIVERED_CHECK' and status='NEW'")
out=$($PSQL -c "begin; set local role authenticated; set local request.jwt.claim.sub='$SCX'; select decision_resolve('$D6','DELIVERED_YES',null); rollback;" 2>&1)
echo "$out" | grep -q 'Zmień status' && { ok=$((ok+1)); echo "  OK    A2 Tak poza AT_SITE: odmowa 22023"; } || { fail=$((fail+1)); echo "  FAIL  A2 Tak poza AT_SITE: odmowa 22023: $out"; }
chk "A2 Tak poza AT_SITE: status bez zmian" "$(st $SG6)" IN_TRANSIT_SE
chk "A2 Tak poza AT_SITE: sprawa nadal NEW" "select status from decisions where id='$D6'" NEW
OPS=11111111-0000-0000-0000-0000000000aa
q "insert into app_users (auth_id, org_id, email, role) values ('$OPS','00000000-0000-0000-0000-00000000a001','ops-a2@test','HHL_OPS')" >/dev/null
out=$($PSQL -c "begin; set local role authenticated; set local request.jwt.claim.sub='$OPS'; select delivered_check_resolve('$SG3', false, null); rollback;" 2>&1)
echo "$out" | grep -qiE 'Rozstrzygnięcie|42501' && { ok=$((ok+1)); echo "  OK    A2 Operacje HHL: odmowa L14"; } || { fail=$((fail+1)); echo "  FAIL  A2 Operacje HHL: odmowa L14: $out"; }
# D-20261018-1130-01: „Zmień status” na Dostarczone zamyka niewidoczną sprawę L14
SG7=$(L 61)
q "insert into loads (id,project_id,carrier_org_id,order_no,hhl_order_no,carrier_order_no,status,plan_load_date,telematics_vehicle_id) values
 ('$SG7','$P','$SCXO','KSH/SG11','HHL/SG11','SCX/SG11','AT_SITE','2026-10-05','TEL-SG11')" >/dev/null
q "select decision_open_from_event('$P','DELIVERED_CHECK','L14:$SG7','SG-11: wyjazd z placu po 6 min — czy dostarczono?', '{\"exit_at\":\"2026-10-10 15:00:00+00\",\"dwell_min\":6,\"zone\":\"Plac Stegra\",\"threshold_min\":10}'::jsonb, '$SG7', null)" >/dev/null
chk "A2 L14 przed Zmień status: 1 otwarta" "select count(*) from decisions where load_id='$SG7' and type_code='DELIVERED_CHECK' and status in ('NEW','ASSIGNED','SNOOZED')" 1
chk "A2 L14 + load_status_set DELIVERED: 0 otwartych" "begin; set local role authenticated; set local request.jwt.claim.sub='$HHL'; select load_status_set('$SG7','DELIVERED','2026-10-18 08:00+00',null); select count(*) from decisions where load_id='$SG7' and type_code='DELIVERED_CHECK' and status in ('NEW','ASSIGNED','SNOOZED'); commit" 0
chk "A2 L14 po Zmień status: RESOLVED/DELIVERED" "select status||'/'||resolution_code from decisions where load_id='$SG7' and type_code='DELIVERED_CHECK'" "RESOLVED/DELIVERED"
chk "A2 L14 po Zmień status: wpis decision_events" "select count(*) from decision_events e join decisions d on d.id=e.decision_id where d.load_id='$SG7' and d.type_code='DELIVERED_CHECK' and e.action='RESOLVE'" 1
SG8=$(L 62)
q "insert into loads (id,project_id,carrier_org_id,order_no,hhl_order_no,carrier_order_no,status,plan_load_date,telematics_vehicle_id) values
 ('$SG8','$P','$SCXO','KSH/SG12','HHL/SG12','SCX/SG12','AT_SITE','2026-10-05','TEL-SG12')" >/dev/null
q "select decision_open_from_event('$P','DELIVERED_CHECK','L14:$SG8','SG-12: wyjazd z placu po 6 min — czy dostarczono?', '{\"exit_at\":\"2026-10-10 16:00:00+00\",\"dwell_min\":6,\"zone\":\"Plac Stegra\",\"threshold_min\":10}'::jsonb, '$SG8', null)" >/dev/null
chk "A2 L14 + anulowanie: RESOLVED/CANCELLED i 0 otwartych" "begin; set local role authenticated; set local request.jwt.claim.sub='$HHL'; select load_status_set('$SG8','CANCELLED','2026-10-18 08:00+00','test A2'); select status||'/'||resolution_code||'/'||(select count(*) from decisions where load_id='$SG8' and type_code='DELIVERED_CHECK' and status in ('NEW','ASSIGNED','SNOOZED')) from decisions where load_id='$SG8' and type_code='DELIVERED_CHECK'; commit" "RESOLVED/CANCELLED/0"

# A5 (PLAN §4): Stena Gdynia–Karlskrona — prom i port SE z geofences.route
echo; echo "[A5] Stena Gdynia–Karlskrona — prom i ETA portu SE"
q "
insert into vessels (id,name,operator) values
 ('66666666-0000-0000-0000-0000000000a5','Stena Spirit','Stena Line')
 on conflict (id) do nothing;
insert into sailings (id,project_id,vessel_id,route,departure_at,arrival_at,status,source) values
 ('77777777-0000-0000-0000-0000000000a5','$P','66666666-0000-0000-0000-0000000000a5','GDY-KAA',
  '2026-10-05 12:00+00','2026-10-05 22:00+00','ZAPLANOWANY','STENA');
insert into geofences (project_id, name, kind, geom, hysteresis_m, dwell_seconds, debounce_fixes, country, route) values
 ('$P','Port Gdynia A5',   'PORT_OUT', make_circle_fence(54.53321,18.54425, 800), 200, 900, 2,'PL','STENA'),
 ('$P','Port Karlskrona A5','PORT_IN',  make_circle_fence(56.16460,15.63080, 800), 200, 600, 2,'SE','STENA');
" >/dev/null
S_A5=77777777-0000-0000-0000-0000000000a5
L_A5=$(L 70)
mk $L_A5 A5S "'HHL/A5S'" "'SCX/A5S'" IN_TRANSIT_PL "'$S_A5'"
q "insert into load_events (load_id,event_type,occurred_at) values ('$L_A5','MILESTONE_LOADED','2026-10-04 08:00+00')" >/dev/null
# Obcy port Polferries nie zmienia statusu przy rejsie Stena
pos $L_A5 54.4030 18.6800 "2026-10-05 10:00+00"; pos $L_A5 54.4031 18.6801 "2026-10-05 10:05+00"
chk "A5 Stena: wjazd Gdańsk (POLFERRIES) bez zmiany statusu" "$(st $L_A5)" IN_TRANSIT_PL
# Własny port Gdynia → AT_PORT_GDANSK
pos $L_A5 54.53321 18.54425 "2026-10-05 11:00+00"; pos $L_A5 54.5333 18.5443 "2026-10-05 11:05+00"
chk "A5 Stena: wjazd Gdynia → AT_PORT_GDANSK" "$(st $L_A5)" AT_PORT_GDANSK
q "update sailings set actual_departure_at = '2026-10-05 12:00+00' where id='$S_A5'" >/dev/null
chk "A5 Stena: odejście rejsu (AIS) → FERRY" "select promote_ferry_departures('2026-10-05 12:01+00')" 1
chk "A5 Stena: status FERRY" "$(st $L_A5)" FERRY
pos $L_A5 56.16460 15.63080 "2026-10-05 22:10+00"; pos $L_A5 56.1647 15.6309 "2026-10-05 22:15+00"
chk "A5 Stena: wjazd Karlskrona → AT_PORT_NYNASHAMN" "$(st $L_A5)" AT_PORT_NYNASHAMN
# ETA: PORT_IN z trasy rejsu (Karlskrona ≈ 56.16, nie Nynäshamn ≈ 58.94)
q "select set_config('tower.status_ctx','on',true); update loads set status='FERRY' where id='$L_A5'" >/dev/null
q "insert into vessel_positions (vessel_id, lat, lon, sog_kn, observed_at, source) values
 ('66666666-0000-0000-0000-0000000000a5', 55.5, 17.0, 16, now(), 'DIGITRAFFIC')" >/dev/null
q "select refresh_load_eta('$L_A5')" >/dev/null
chk "A5 Stena: eta_basis port_route=STENA" "select eta_basis->>'port_route' from loads where id='$L_A5'" STENA
chk "A5 Stena: wait_ais=false i ferry_eta_at ustawione" \
  "select (eta_basis->>'wait_ais')||'/'||(eta_basis ? 'ferry_eta_at')::text from loads where id='$L_A5'" "false/true"
# Polferries nadal Nynäshamn
L_PF=$(L 71)
mk $L_PF A5P "'HHL/A5P'" "'SCX/A5P'" FERRY "'$S1'"
q "insert into vessel_positions (vessel_id, lat, lon, sog_kn, observed_at, source) values
 ('66666666-0000-0000-0000-000000000001', 56.5, 18.2, 16, now(), 'DIGITRAFFIC')" >/dev/null
q "select refresh_load_eta('$L_PF')" >/dev/null
chk "A5 Polferries: eta_basis port_route=POLFERRIES" "select eta_basis->>'port_route' from loads where id='$L_PF'" POLFERRIES
chk "A5 READY_TO_INVOICE: ETA jak DELIVERED (segment DONE)" \
  "select basis->>'segment' from compute_load_eta('$C17A')" DONE
# F7: source w STATUS_AUTO (kontrakt A10); ETA plac Stena > Polferries
chk "A5 Stena STATUS_AUTO FERRY source=AIS" \
  "select payload->>'source' from load_events where load_id='$L_A5' and event_type='STATUS_AUTO' and payload->>'to'='FERRY' order by occurred_at desc limit 1" AIS
chk "A5 Stena STATUS_AUTO AT_PORT_NYNASHAMN source=GPS" \
  "select payload->>'source' from load_events where load_id='$L_A5' and event_type='STATUS_AUTO' and payload->>'to'='AT_PORT_NYNASHAMN' order by occurred_at desc limit 1" GPS
q "select set_config('tower.status_ctx','on',true); update loads set status='AT_PORT_NYNASHAMN' where id in ('$L_A5','$L_PF')" >/dev/null
# Świeże GPS (compute_load_eta: GPS_FRESH_MIN) — stałe daty z października były martwe w CI
q "select process_position('$L_A5', 56.16460, 15.63080, now() - interval '5 minutes');
    select process_position('$L_A5', 56.1647, 15.6309, now() - interval '1 minute');
    select process_position('$L_PF', 58.9044, 17.9480, now() - interval '5 minutes');
    select process_position('$L_PF', 58.9045, 17.9481, now() - interval '1 minute')" >/dev/null
q "select refresh_load_eta('$L_A5'); select refresh_load_eta('$L_PF')" >/dev/null
chk "A5 Stena: eta_site nie null w porcie SE" "select (eta_site is not null)::text from loads where id='$L_A5'" true
chk "A5 Polferries: eta_site nie null w porcie SE" "select (eta_site is not null)::text from loads where id='$L_PF'" true
chk "A5 ETA plac Stena > Polferries (SE_ROAD_KAA 21,5 > SE_ROAD 17)" \
  "select (s.eta_site > p.eta_site)::text from loads s join loads p on true where s.id='$L_A5' and p.id='$L_PF'" true

# #445 / D-20261022-1235-01: A10_b FERRY tylko po odejściu rejsu (nie przy zbieżności AIS w porcie)
echo; echo "[#445] A10_b — FERRY tylko po odejściu rejsu"
q "
insert into vessels (id,name,operator) values
 ('66666666-0000-0000-0000-000000000445','M/F Wawel 445','Polferries')
 on conflict (id) do nothing;
insert into sailings (id,project_id,vessel_id,route,departure_at,arrival_at,status,source) values
 ('77777777-0000-0000-0000-000000000445','$P','66666666-0000-0000-0000-000000000445','GDN-NYN',
  now() + interval '6 hours', now() + interval '24 hours','ZAPLANOWANY','RECZNIE');
" >/dev/null
S445=77777777-0000-0000-0000-000000000445
V445=66666666-0000-0000-0000-000000000445
L445=$(L 72)
mk $L445 A445 "'HHL/A445'" "'SCX/A445'" AT_PORT_GDANSK "'$S445'"
q "insert into load_events (load_id,event_type,occurred_at) values ('$L445','MILESTONE_LOADED', now() - interval '1 day')" >/dev/null
# auto i statek w PORT_OUT (≤ 2 km), rejs za 6 h
q "select process_position('$L445', 54.4030, 18.6800, now() - interval '10 minutes');
    select process_position('$L445', 54.4031, 18.6801, now() - interval '5 minutes');
    insert into vessel_positions (vessel_id, lat, lon, sog_kn, observed_at, source) values
     ('$V445', 54.4032, 18.6802, 0, now() - interval '2 minutes', 'DIGITRAFFIC')" >/dev/null
chk "#445: PORT_OUT + AIS ≤2 km, rejs za 6 h → bez FERRY" \
  "select a10_try_ferry_backup('$L445', now()); select status from loads where id='$L445'" AT_PORT_GDANSK
# po actual_departure_at + GPS na morzu (wyjazd PORT_OUT) → FERRY
q "update sailings set actual_departure_at = now() - interval '5 minutes' where id='$S445';
    insert into vessel_positions (vessel_id, lat, lon, sog_kn, observed_at, source) values
     ('$V445', 54.4930, 18.6800, 12, now() - interval '1 minute', 'DIGITRAFFIC');
    insert into load_events (load_id, event_type, occurred_at, payload) values
     ('$L445','GEOFENCE_EXIT', now() - interval '20 minutes',
      jsonb_build_object('geofence_kind','PORT_OUT'));
    select process_position('$L445', 55.00, 18.90, now() - interval '3 minutes');
    select process_position('$L445', 55.01, 18.91, now() - interval '1 minute')" >/dev/null
chk "#445: po actual_departure_at + GPS morze → FERRY" \
  "select a10_try_ferry_backup('$L445', now()); select status from loads where id='$L445'" FERRY

# departure_at minął, AIS w porcie (opóźnienie) → bez FERRY
L445b=$(L 73)
q "
insert into sailings (id,project_id,vessel_id,route,departure_at,arrival_at,status,source) values
 ('77777777-0000-0000-0000-000000000446','$P','$V445','GDN-NYN',
  now() - interval '2 hours', now() + interval '16 hours','ZAPLANOWANY','RECZNIE');
" >/dev/null
S445b=77777777-0000-0000-0000-000000000446
mk $L445b A445b "'HHL/A445b'" "'SCX/A445b'" AT_PORT_GDANSK "'$S445b'"
q "insert into load_events (load_id,event_type,occurred_at) values ('$L445b','MILESTONE_LOADED', now() - interval '1 day');
    select process_position('$L445b', 54.4030, 18.6800, now() - interval '10 minutes');
    select process_position('$L445b', 54.4031, 18.6801, now() - interval '5 minutes');
    insert into vessel_positions (vessel_id, lat, lon, sog_kn, observed_at, source) values
     ('$V445', 54.4030, 18.6800, 0, now() - interval '1 minute', 'DIGITRAFFIC')" >/dev/null
chk "#445: departure minął, AIS w porcie → bez FERRY" \
  "select a10_try_ferry_backup('$L445b', now()); select status from loads where id='$L445b'" AT_PORT_GDANSK

# departure_at minął, AIS 10 km, auto ≤ 2 km od AIS → FERRY
L445c=$(L 74)
q "
insert into sailings (id,project_id,vessel_id,route,departure_at,arrival_at,status,source) values
 ('77777777-0000-0000-0000-000000000447','$P','$V445','GDN-NYN',
  now() - interval '3 hours', now() + interval '15 hours','ZAPLANOWANY','RECZNIE');
" >/dev/null
S445c=77777777-0000-0000-0000-000000000447
mk $L445c A445c "'HHL/A445c'" "'SCX/A445c'" AT_PORT_GDANSK "'$S445c'"
q "insert into load_events (load_id,event_type,occurred_at) values ('$L445c','MILESTONE_LOADED', now() - interval '1 day');
    insert into vessel_positions (vessel_id, lat, lon, sog_kn, observed_at, source) values
     ('$V445', 54.4930, 18.6800, 10, now() - interval '1 minute', 'DIGITRAFFIC');
    select process_position('$L445c', 54.4925, 18.6805, now() - interval '3 minutes');
    select process_position('$L445c', 54.4928, 18.6802, now() - interval '1 minute')" >/dev/null
chk "#445: departure minął, AIS 10 km sog>3, auto ≤2 km → FERRY" \
  "select a10_try_ferry_backup('$L445c', now()); select status from loads where id='$L445c'" FERRY

# #502: A10_b tylko gdy statek płynie; FERRY bez powiadomień status
echo; echo "[#502] A10_b — W_PORCIE/ZAPLANOWANY v=0 bez FERRY; po actual_dep FERRY 0 notif"
L502=$(L 76)
q "
insert into sailings (id,project_id,vessel_id,route,departure_at,arrival_at,status,source) values
 ('77777777-0000-0000-0000-000000000502','$P','$V445','GDN-NYN',
  now() - interval '30 minutes', now() + interval '18 hours','ZAPLANOWANY','RECZNIE');
" >/dev/null
S502=77777777-0000-0000-0000-000000000502
mk $L502 A502 "'HHL/A502'" "'SCX/A502'" AT_PORT_GDANSK "'$S502'"
q "insert into load_events (load_id,event_type,occurred_at) values ('$L502','MILESTONE_LOADED', now() - interval '1 day');
    select process_position('$L502', 54.4030, 18.6800, now() - interval '10 minutes');
    select process_position('$L502', 54.4031, 18.6801, now() - interval '5 minutes');
    insert into vessel_positions (vessel_id, lat, lon, sog_kn, observed_at, source) values
     ('$V445', 54.4032, 18.6802, 0, now() - interval '1 minute', 'DIGITRAFFIC')" >/dev/null
chk "#502: PORT_OUT + ZAPLANOWANY sog=0 (plan minął) → bez FERRY" \
  "select a10_try_ferry_backup('$L502', now()); select status from loads where id='$L502'" AT_PORT_GDANSK
N502=$(q "select count(*) from notifications where load_id='$L502' and template='LOAD_STATUS_CHANGED'")
q "update sailings set actual_departure_at = now() - interval '5 minutes' where id='$S502';
    insert into vessel_positions (vessel_id, lat, lon, sog_kn, observed_at, source) values
     ('$V445', 54.4930, 18.6800, 12, now() - interval '1 minute', 'DIGITRAFFIC');
    insert into load_events (load_id, event_type, occurred_at, payload) values
     ('$L502','GEOFENCE_EXIT', now() - interval '20 minutes',
      jsonb_build_object('geofence_kind','PORT_OUT'));
    select process_position('$L502', 55.00, 18.90, now() - interval '3 minutes');
    select process_position('$L502', 55.01, 18.91, now() - interval '1 minute')" >/dev/null
chk "#502: po actual_departure_at + GPS morze → FERRY" \
  "select a10_try_ferry_backup('$L502', now()); select status from loads where id='$L502'" FERRY
chk "#502: FERRY A10_b bez nowych LOAD_STATUS_CHANGED" \
  "select (count(*)=$N502)::text from notifications where load_id='$L502' and template='LOAD_STATUS_CHANGED'" true

# #502 F7 B4: T-11 — stary GPS naczepy + statek płynący → bez FERRY (czas GPS↔AIS)
echo; echo "[#502 F7] B4 — stary GPS / wpływający / SCHEDULE cicho"
L502a=$(L 95)
q "
insert into sailings (id,project_id,vessel_id,route,departure_at,arrival_at,status,source) values
 ('77777777-0000-0000-0000-000000000503','$P','$V445','GDN-NYN',
  now() - interval '1 hour', now() + interval '17 hours','ZAPLANOWANY','RECZNIE');
" >/dev/null
S502a=77777777-0000-0000-0000-000000000503
mk $L502a A502a "'HHL/A502a'" "'SCX/A502a'" AT_PORT_GDANSK "'$S502a'"
q "insert into load_events (load_id,event_type,occurred_at) values ('$L502a','MILESTONE_LOADED', now() - interval '1 day');
    select process_position('$L502a', 54.4030, 18.6800, now() - interval '2 hours 5 minutes');
    select process_position('$L502a', 54.4031, 18.6801, now() - interval '2 hours');
    insert into vessel_positions (vessel_id, lat, lon, sog_kn, observed_at, source) values
     ('$V445', 54.4140, 18.6800, 6.9, now() - interval '1 minute', 'DIGITRAFFIC')" >/dev/null
chk "#502 F7: GPS sprzed 2 h + AIS 6,9 kn 1,2 km → bez FERRY" \
  "select a10_try_ferry_backup('$L502a', now()); select status from loads where id='$L502a'" AT_PORT_GDANSK

# B4(2): statek wpływający — plan w przyszłości, sog>3, 1–2 km → bez FERRY
L502b=$(L 96)
q "
insert into sailings (id,project_id,vessel_id,route,departure_at,arrival_at,status,source) values
 ('77777777-0000-0000-0000-000000000504','$P','$V445','GDN-NYN',
  now() + interval '6 hours', now() + interval '24 hours','ZAPLANOWANY','RECZNIE');
" >/dev/null
S502b=77777777-0000-0000-0000-000000000504
mk $L502b A502b "'HHL/A502b'" "'SCX/A502b'" AT_PORT_GDANSK "'$S502b'"
q "insert into load_events (load_id,event_type,occurred_at) values ('$L502b','MILESTONE_LOADED', now() - interval '1 day');
    select process_position('$L502b', 54.4030, 18.6800, now() - interval '10 minutes');
    select process_position('$L502b', 54.4031, 18.6801, now() - interval '5 minutes');
    insert into vessel_positions (vessel_id, lat, lon, sog_kn, observed_at, source) values
     ('$V445', 54.4140, 18.6900, 6.8, now() - interval '1 minute', 'DIGITRAFFIC')" >/dev/null
chk "#502 F7: wpływający (plan +6 h, sog>3, 1–2 km) → bez FERRY" \
  "select a10_try_ferry_backup('$L502b', now()); select status from loads where id='$L502b'" AT_PORT_GDANSK

# B4(3): syntetyczny SCHEDULE przy PORT_IN → 0 LOAD_STATUS_CHANGED dla FERRY
L502c=$(L 97)
G502c=$(q "select id from geofences where project_id='$P' and kind='PORT_IN' and name='Port Nynäshamn' order by id limit 1")
mk $L502c A502c "'HHL/A502c'" "'SCX/A502c'" IN_TRANSIT_PL "'$S1'"
q "insert into load_events (load_id,event_type,occurred_at) values ('$L502c','MILESTONE_LOADED', now() - interval '1 day')" >/dev/null
N502c=$(q "select count(*) from notifications where load_id='$L502c' and template='LOAD_STATUS_CHANGED' and coalesce(payload->>'to','')='FERRY'")
q "insert into load_events (load_id, event_type, occurred_at, payload) values
 ('$L502c','GEOFENCE_ENTER', now(),
  jsonb_build_object('geofence_id','$G502c','geofence_kind','PORT_IN','geofence_name','Port Nynäshamn'))" >/dev/null
chk "#502 F7: SCHEDULE synthetic_ferry → AT_PORT_NYNASHAMN" "$(st $L502c)" AT_PORT_NYNASHAMN
chk "#502 F7: SCHEDULE FERRY bez LOAD_STATUS_CHANGED" \
  "select (count(*)=$N502c)::text from notifications where load_id='$L502c' and template='LOAD_STATUS_CHANGED' and coalesce(payload->>'to','')='FERRY'" true
chk "#502 F7: synthetic_ferry w osi" \
  "select (count(*)>0)::text from load_events where load_id='$L502c' and event_type='STATUS_AUTO' and coalesce((payload->>'synthetic_ferry')::boolean,false)" true

# #461: ścieżka (c) bez actual_departure_at → bez FERRY (plan minął, brak pozycji w porcie)
echo; echo "[#461] A10_c — tylko po actual_departure_at"
L461c=$(L 75)
q "
insert into sailings (id,project_id,vessel_id,route,departure_at,arrival_at,status,source) values
 ('77777777-0000-0000-0000-000000000461','$P','$V445','GDN-NYN',
  now() - interval '4 hours', now() + interval '14 hours','ZAPLANOWANY','RECZNIE');
" >/dev/null
S461c=77777777-0000-0000-0000-000000000461
mk $L461c A461c "'HHL/A461c'" "'SCX/A461c'" AT_PORT_GDANSK "'$S461c'"
q "insert into load_events (load_id,event_type,occurred_at) values ('$L461c','MILESTONE_LOADED', now() - interval '1 day');
    select process_position('$L461c', 54.4030, 18.6800, now() - interval '2 hours');
    select process_position('$L461c', 54.4031, 18.6801, now() - interval '90 minutes')" >/dev/null
chk "#461: A10_c bez actual_departure → bez FERRY" \
  "select a10_try_ferry_backup('$L461c', now()); select status from loads where id='$L461c'" AT_PORT_GDANSK
# F7: wyjazd ze strefy PORT_OUT (v_in_port jak na produkcji) — pozycje w porcie zostawiają INSIDE.
q "update sailings set actual_departure_at = now() - interval '45 minutes' where id='$S461c';
    update geofence_states gs set state = 'OUTSIDE', exited_at = now() - interval '40 minutes'
      from geofences g
     where g.id = gs.geofence_id and gs.load_id = '$L461c' and g.kind = 'PORT_OUT';
    insert into load_events (load_id, event_type, occurred_at, payload) values
     ('$L461c','GEOFENCE_EXIT', now() - interval '40 minutes',
      jsonb_build_object('geofence_kind','PORT_OUT'))" >/dev/null
chk "#461: A10_c po actual_departure + 30 min bez portu → FERRY" \
  "select a10_try_ferry_backup('$L461c', now()); select status from loads where id='$L461c'" FERRY

# #446 pkt 1: actual_departure_at → W_REJSIE; actual_arrival_at → DOPLYNAL; ODWOLANY bez zmian
# ID 448/449 — nie 446/447 (#445 S445b/S445c już je zajmuje; INSERT cichy → fałszywy W_REJSIE)
echo; echo "[#446] sailings.status po actual_departure/arrival"
S446=77777777-0000-0000-0000-000000000448
S446b=77777777-0000-0000-0000-000000000449
q "insert into sailings (id,project_id,vessel_id,route,departure_at,arrival_at,status,source) values
 ('$S446','$P','66666666-0000-0000-0000-000000000001','GDN-NYN', now() - interval '2 hours', now() + interval '16 hours','ZAPLANOWANY','POLFERRIES'),
 ('$S446b','$P','66666666-0000-0000-0000-000000000002','GDN-NYN', now() - interval '2 hours', now() + interval '16 hours','ODWOLANY','POLFERRIES')" >/dev/null
q "update sailings set actual_departure_at = now() - interval '30 minutes' where id='$S446'" >/dev/null
chk "#446: actual_departure_at → W_REJSIE" \
  "select status from sailings where id='$S446'" W_REJSIE
q "update sailings set actual_arrival_at = now() - interval '5 minutes' where id='$S446'" >/dev/null
chk "#446: actual_arrival_at → DOPLYNAL" \
  "select status from sailings where id='$S446'" DOPLYNAL
q "update sailings set actual_departure_at = now() - interval '30 minutes' where id='$S446b'" >/dev/null
chk "#446: ODWOLANY + actual_departure → bez zmiany statusu" \
  "select status from sailings where id='$S446b'" ODWOLANY
# F7: actual_* chroni W_REJSIE przed OPOZNIONY (operator_notice_apply / sync)
q "update sailings set status = 'OPOZNIONY' where id='$S446'" >/dev/null
chk "#446 F7: OPOZNIONY przy actual_* → zostaje DOPLYNAL" \
  "select status from sailings where id='$S446'" DOPLYNAL

# DP-130: jawny DOPLYNAL przy ATA null (closeStale) — trigger nie cofa do W_REJSIE
# ID 704/705; source TALLINK — DIGITRAFFIC nie w sailings_source_check 0338 (INSERT cichy → pusty SELECT)
echo; echo "[DP-130] jawny DOPLYNAL bez ATA zostaje"
S130=77777777-0000-0000-0000-000000000704
S130b=77777777-0000-0000-0000-000000000705
q "insert into sailings (id,project_id,vessel_id,route,departure_at,arrival_at,actual_departure_at,actual_arrival_at,status,source) values
 ('$S130','$P','66666666-0000-0000-0000-000000000001','HEL-TLL',
  now() - interval '8 hours', now() - interval '5 hours',
  now() - interval '7 hours', null, 'W_REJSIE','TALLINK')" >/dev/null
q "update sailings set status = 'DOPLYNAL' where id='$S130'" >/dev/null
chk "DP-130: UPDATE status=DOPLYNAL przy ATA null → zostaje DOPLYNAL" \
  "select status from sailings where id='$S130'" DOPLYNAL
chk "DP-130: ATA nadal null po jawnym DOPLYNAL" \
  "select (actual_arrival_at is null)::text from sailings where id='$S130'" true
# ATD bez jawnego DOPLYNAL nadal → W_REJSIE
q "insert into sailings (id,project_id,vessel_id,route,departure_at,arrival_at,status,source) values
 ('$S130b','$P','66666666-0000-0000-0000-000000000002','HELA-TLL',
  now() - interval '2 hours', now() + interval '1 hour','ZAPLANOWANY','TALLINK')" >/dev/null
q "update sailings set actual_departure_at = now() - interval '30 minutes' where id='$S130b'" >/dev/null
chk "DP-130: actual_departure_at bez jawnego DOPLYNAL → W_REJSIE" \
  "select status from sailings where id='$S130b'" W_REJSIE

# #461 F7: Prom tylko z READY…AT_PORT_GDANSK — PLANNED nie „wypływa”
echo; echo "[#461] zakres statusów + RIO_NO_POSITION"
L461p=$(L 77)
S461p=77777777-0000-0000-0000-000000000477
q "insert into sailings (id,project_id,vessel_id,route,departure_at,arrival_at,actual_departure_at,status,source) values
 ('$S461p','$P','$V445','GDN-NYN',
  now() - interval '3 hours', now() + interval '15 hours', now() - interval '2 hours','W_REJSIE','RECZNIE')" >/dev/null
mk $L461p P461 "'HHL/P461'" "'SCX/P461'" PLANNED "'$S461p'"
chk "#461: PLANNED + rejs odpłynął → bez FERRY" \
  "select promote_ferry_departures(now()); select status from loads where id='$L461p'" PLANNED

# RIO_NO_POSITION: blokuje SILENT; escalate tylko NO_POSITION/SILENT (nie SEFS)
L461r=$(L 78)
mk $L461r R461 "'HHL/R461'" "'SCX/R461'" IN_TRANSIT_PL null
q "update loads set plan_load_date = current_date, plan_delivery_date = current_date + 5,
       tracking_opened_at = public.tracking_window_start(current_date)
     where id='$L461r'" >/dev/null
q "insert into positions (load_id, ts, geom_raw, source) values
     ('$L461r', now() - interval '3 hours', ST_SetSRID(ST_MakePoint(17.02, 52.09), 4326), 'TELEMATICS_API')" >/dev/null
q "insert into risk_signals (project_id, load_id, kind, severity, title, title_key, detail, dedup_key) values
     ('$P','$L461r','RESOURCE_MISSING','HIGH','RIO brak pozycji','rk_rio_no_position','{}'::jsonb,'RIO_NO_POSITION:$L461r'),
     ('$P','$L461r','SILENT_VEHICLE','HIGH','cisza','rk_silent_vehicle','{\"l3\":\"1\"}'::jsonb,'SILENT:$L461r')" >/dev/null
chk "#461: RIO_NO_POSITION zamyka istniejące SILENT" \
  "select detect_silent_vehicles(90); select (resolved_at is not null)::text from risk_signals where dedup_key='SILENT:$L461r'" true
chk "#461: RIO_NO_POSITION blokuje nowe SILENT" \
  "select count(*) from risk_signals where dedup_key='SILENT:$L461r' and resolved_at is null" 0
# Bez event_key SILENT:… — trigger przy SILENT już zajął decisions_event_key_uidx.
D461np=$(q "insert into decisions (project_id, type_code, status, title, load_id, due_at, detail)
  values ('$P','NO_POSITION','NEW','461 RIO block escalate','$L461r', now() - interval '1 hour',
          '{}'::jsonb) returning id" | grep -E '^[0-9a-f-]{36}$' | tail -1)
D461sf=$(q "insert into decisions (project_id, type_code, status, title, load_id, due_at, detail)
  values ('$P','SEFS_OUT_OF_TABLE','NEW','461 SEFS escalate','$L461r', now() - interval '1 hour', '{}'::jsonb) returning id" | grep -E '^[0-9a-f-]{36}$' | tail -1)
q "select decision_escalate_overdue()" >/dev/null
chk "#461: RIO blokuje escalate tylko NO_POSITION" \
  "select (escalated_at is null)::text from decisions where id='$D461np'" true
chk "#461: RIO nie blokuje escalate SEFS" \
  "select (escalated_at is not null)::text from decisions where id='$D461sf'" true
# F7: sprzątanie globalne jak A1 — detect_silent_vehicles(90) i escalate zostawiają
# klucze poza L461r; risks.sh liczy title_key w całej tower_test_status (baseline 5).
chk "#461 po teście brak kluczy RIO/SILENT/overdue" \
  "delete from decision_events where decision_id in (
      select d.id from decisions d
       where d.load_id='$L461r'
          or d.risk_id in (select id from risk_signals
            where title_key in ('rk_rio_no_position','rk_silent_vehicle','rk_decision_overdue')
               or kind in ('SILENT_VEHICLE','RESOURCE_MISSING')
               or dedup_key like 'SILENT:%' or dedup_key like 'RIO_NO_POSITION:%'
               or dedup_key like 'decision-overdue:%'));
   delete from decisions where load_id='$L461r'
      or risk_id in (select id from risk_signals
        where title_key in ('rk_rio_no_position','rk_silent_vehicle','rk_decision_overdue')
           or kind='SILENT_VEHICLE' or dedup_key like 'SILENT:%'
           or dedup_key like 'RIO_NO_POSITION:%' or dedup_key like 'decision-overdue:%');
   delete from risk_signals
    where title_key in ('rk_rio_no_position','rk_silent_vehicle','rk_decision_overdue')
       or kind='SILENT_VEHICLE' or dedup_key like 'SILENT:%'
       or dedup_key like 'RIO_NO_POSITION:%' or dedup_key like 'decision-overdue:%';
   select count(*) from risk_signals
    where title_key in ('rk_rio_no_position','rk_silent_vehicle','rk_decision_overdue')" 0

# #485 / F7 #486: po promie — status z pozycji (ład SE, nie GEOFENCE_ENTER)
echo; echo "[#485] Port SE / Droga SE z pozycji po promie"
q "
insert into vessels (id,name,operator) values
 ('66666666-0000-0000-0000-000000000485','Stena Ebba 485','Stena Line')
 on conflict (id) do nothing;
insert into sailings (id,project_id,vessel_id,route,departure_at,arrival_at,actual_departure_at,actual_arrival_at,status,source) values
 ('77777777-0000-0000-0000-000000000485','$P','66666666-0000-0000-0000-000000000485','GDY-KAA',
  '2026-10-06 12:00+00','2026-10-06 22:00+00','2026-10-06 12:00+00','2026-10-06 22:00+00','DOPLYNAL','STENA');
insert into geofences (project_id, name, kind, geom, hysteresis_m, dwell_seconds, debounce_fixes, country, route) values
 ('$P','Port Karlskrona 485','PORT_IN', make_circle_fence(56.16460,15.63080, 800), 200, 600, 1,'SE','STENA');
" >/dev/null
S485=77777777-0000-0000-0000-000000000485
# (3) DOPLYNAL + E22 (~25 km ląd SE) → IN_TRANSIT_SE z godziną pozycji
L485a=$(L 85)
mk $L485a A485 "'HHL/A485'" "'SCX/A485'" FERRY "'$S485'"
q "insert into load_events (load_id,event_type,occurred_at) values ('$L485a','MILESTONE_LOADED','2026-10-05 08:00+00')" >/dev/null
pos $L485a 56.3949 16.0673 "2026-10-06 22:30+00"
chk "#485: DOPLYNAL + pozycja poza portem SE → IN_TRANSIT_SE" "$(st $L485a)" IN_TRANSIT_SE
chk "#485: uzupełniony AT_PORT_NYNASHAMN (synthetic)" \
  "select count(*) from load_events where load_id='$L485a' and event_type='STATUS_AUTO' and payload->>'to'='AT_PORT_NYNASHAMN' and payload->>'synthetic'='true'" 1
chk "#485: source=GPS na Drodze SE" \
  "select payload->>'source' from load_events where load_id='$L485a' and event_type='STATUS_AUTO' and payload->>'to'='IN_TRANSIT_SE' order by occurred_at desc limit 1" GPS
chk "#485: Droga SE z godziną pozycji" \
  "select to_char(occurred_at at time zone 'UTC','HH24:MI') from load_events where load_id='$L485a' and event_type='STATUS_AUTO' and payload->>'to'='IN_TRANSIT_SE' order by occurred_at desc limit 1" "22:30"
chk "#485: Port SE synthetic = dopłynięcie (actual)" \
  "select to_char(occurred_at at time zone 'UTC','HH24:MI') from load_events where load_id='$L485a' and event_type='STATUS_AUTO' and payload->>'to'='AT_PORT_NYNASHAMN' and payload->>'synthetic'='true' order by occurred_at limit 1" "22:00"
# (5) W strefie portu SE
L485b=$(L 86)
mk $L485b B485 "'HHL/B485'" "'SCX/B485'" FERRY "'$S485'"
q "insert into load_events (load_id,event_type,occurred_at) values ('$L485b','MILESTONE_LOADED','2026-10-05 08:00+00')" >/dev/null
pos $L485b 56.16460 15.63080 "2026-10-06 22:10+00"
chk "#485: pozycja w porcie SE → AT_PORT_NYNASHAMN" "$(st $L485b)" AT_PORT_NYNASHAMN
# (1) DOPLYNAL + Warszawa → FERRY (B1: nie zgadywać odległością)
L485w=$(L 89)
mk $L485w W485 "'HHL/W485'" "'SCX/W485'" FERRY "'$S485'"
q "insert into load_events (load_id,event_type,occurred_at) values ('$L485w','MILESTONE_LOADED','2026-10-05 08:00+00')" >/dev/null
pos $L485w 52.4535 20.9018 "2026-10-06 22:40+00"
chk "#485: DOPLYNAL + pozycja w PL (Warszawa) → FERRY" "$(st $L485w)" FERRY
# W_REJSIE
q "
insert into sailings (id,project_id,vessel_id,route,departure_at,arrival_at,actual_departure_at,status,source) values
 ('77777777-0000-0000-0000-000000000486','$P','66666666-0000-0000-0000-000000000485','GDY-KAA',
  '2026-10-07 12:00+00','2026-10-07 22:00+00','2026-10-07 12:00+00','W_REJSIE','STENA');
" >/dev/null
S486=77777777-0000-0000-0000-000000000486
# (2) W_REJSIE przed planowym przypłynięciem + morze → FERRY (F7 r2)
L485c=$(L 87)
mk $L485c C485 "'HHL/C485'" "'SCX/C485'" FERRY "'$S486'"
q "insert into load_events (load_id,event_type,occurred_at) values ('$L485c','MILESTONE_LOADED','2026-10-06 08:00+00')" >/dev/null
pos $L485c 55.90 15.90 "2026-10-07 14:00+00"
chk "#485: W_REJSIE + morze 40 km od PORT_IN → FERRY" "$(st $L485c)" FERRY
L485n=$(L 8b)
mk $L485n N485 "'HHL/N485'" "'SCX/N485'" FERRY "'$S486'"
q "insert into load_events (load_id,event_type,occurred_at) values ('$L485n','MILESTONE_LOADED','2026-10-06 08:00+00')" >/dev/null
pos $L485n 58.60 18.00 "2026-10-07 14:00+00"
chk "#485: W_REJSIE przed planem + morze Nynäshamn → FERRY" "$(st $L485n)" FERRY
L485k=$(L 8c)
mk $L485k K485 "'HHL/K485'" "'SCX/K485'" FERRY "'$S486'"
q "insert into load_events (load_id,event_type,occurred_at) values ('$L485k','MILESTONE_LOADED','2026-10-06 08:00+00')" >/dev/null
pos $L485k 56.138 15.635 "2026-10-07 14:00+00"
chk "#485: W_REJSIE przed planem + morze Karlskrona → FERRY" "$(st $L485k)" FERRY
# #496 F7: w PORT_IN przed planem → AT_PORT_* (wjazd = dowód wcześniejszego przypłynięcia;
# silnik stref bez warunku godziny — decyzja koordynatora F7 #536).
# L 79 — nie 95: #502 F7 B4 = L 95 (kolizja → mk cicho, stary AT_PORT_GDANSK).
L485p=$(L 79)
mk $L485p P485 "'HHL/P485'" "'SCX/P485'" FERRY "'$S486'"
q "insert into load_events (load_id,event_type,occurred_at) values ('$L485p','MILESTONE_LOADED','2026-10-06 08:00+00')" >/dev/null
pos $L485p 56.16460 15.63080 "2026-10-07 14:00+00"
chk "#496: PORT_IN przed planem → AT_PORT_NYNASHAMN" "$(st $L485p)" AT_PORT_NYNASHAMN
# PL (Gdańsk) przy FERRY
L485d=$(L 88)
mk $L485d D485 "'HHL/D485'" "'SCX/D485'" FERRY "'$S486'"
q "insert into load_events (load_id,event_type,occurred_at) values ('$L485d','MILESTONE_LOADED','2026-10-06 08:00+00')" >/dev/null
pos $L485d 54.4030 18.6800 "2026-10-07 13:00+00"
chk "#485: pozycja w PL przy FERRY → bez zmiany" "$(st $L485d)" FERRY
# (4) po planowym przypłynięciu bez actual + ląd SE (E4) → IN_TRANSIT_SE (F7 r2)
L485e=$(L 8a)
mk $L485e E485 "'HHL/E485'" "'SCX/E485'" FERRY "'$S486'"
q "insert into load_events (load_id,event_type,occurred_at) values ('$L485e','MILESTONE_LOADED','2026-10-06 08:00+00')" >/dev/null
pos $L485e 57.7826 14.1618 "2026-10-07 22:30+00"
chk "#485: po planie bez actual + E4 → IN_TRANSIT_SE" "$(st $L485e)" IN_TRANSIT_SE
chk "#496: Port SE synthetic arr_source=plan" \
  "select payload->>'arr_source' from load_events where load_id='$L485e' and event_type='STATUS_AUTO' and payload->>'to'='AT_PORT_NYNASHAMN' and payload->>'synthetic'='true' order by occurred_at limit 1" plan
# #496: po planie + morze Nynäshamn (nie ląd) → FERRY (wielokąt bez Bałtyku)
# L 7a — nie 96: #502 F7 B4 = L 96.
L485s=$(L 7a)
mk $L485s S496 "'HHL/S496'" "'SCX/S496'" FERRY "'$S486'"
q "insert into load_events (load_id,event_type,occurred_at) values ('$L485s','MILESTONE_LOADED','2026-10-06 08:00+00')" >/dev/null
pos $L485s 58.60 18.00 "2026-10-07 22:30+00"
chk "#496: po planie + morze Nynäshamn → FERRY" "$(st $L485s)" FERRY
# #496 F7: po planie + morze Karlskrona (15.635/56.138) → FERRY (zawężony wielokąt)
L485m=$(L 7c)
mk $L485m M496 "'HHL/M496'" "'SCX/M496'" FERRY "'$S486'"
q "insert into load_events (load_id,event_type,occurred_at) values ('$L485m','MILESTONE_LOADED','2026-10-06 08:00+00')" >/dev/null
pos $L485m 56.138 15.635 "2026-10-07 22:30+00"
chk "#496: po planie + morze Karlskrona → FERRY" "$(st $L485m)" FERRY
# #496 F7 r3: Ösmo na rejsie GDN-NYN DOPŁYNĄŁ (nie GDY-KAA — scenariusz rundy 1)
q "
insert into vessels (id,name,operator) values
 ('66666666-0000-0000-0000-000000000496','M/F Wawel 496','Polferries')
 on conflict (id) do nothing;
insert into sailings (id,project_id,vessel_id,route,departure_at,arrival_at,actual_departure_at,actual_arrival_at,status,source) values
 ('77777777-0000-0000-0000-000000000496','$P','66666666-0000-0000-0000-000000000496','GDN-NYN',
  '2026-10-05 16:00+00','2026-10-06 10:00+00','2026-10-05 16:00+00','2026-10-06 10:00+00','DOPLYNAL','POLFERRIES');
" >/dev/null
S496n=77777777-0000-0000-0000-000000000496
L485o=$(L 7d)
mk $L485o O496 "'HHL/O496'" "'SCX/O496'" FERRY "'$S496n'"
q "insert into load_events (load_id,event_type,occurred_at) values ('$L485o','MILESTONE_LOADED','2026-10-05 08:00+00')" >/dev/null
pos $L485o 59.00 17.90 "2026-10-06 10:30+00"
chk "#496: DOPLYNAL GDN-NYN + Ösmo → IN_TRANSIT_SE" "$(st $L485o)" IN_TRANSIT_SE
# #496 F7 r3 BLOKER: GDY-KAA DOPŁYNĄŁ + Jämjö (ląd po poprawce Karlskrona) → IN_TRANSIT_SE
L485j=$(L 7e)
mk $L485j J496 "'HHL/J496'" "'SCX/J496'" FERRY "'$S485'"
q "insert into load_events (load_id,event_type,occurred_at) values ('$L485j','MILESTONE_LOADED','2026-10-05 08:00+00')" >/dev/null
pos $L485j 56.19 15.84 "2026-10-06 22:30+00"
chk "#496: DOPLYNAL + Jämjö → IN_TRANSIT_SE" "$(st $L485j)" IN_TRANSIT_SE

# #487: OFF_CORRIDOR po Karlskronie = SE_E22 (nie SE_E4)
# F7 r3/r4: Jämjö; Söderköping 16.3186/58.4792; OFFROUTE_KM przywrócone (nie sztywne 2).
echo; echo "[#487] korytarz E22 po Karlskronie (OFF_CORRIDOR)"
# #496: bez ::int — ułamki OFFROUTE_KM
PREV_OFFROUTE=$(q "select value_num::text from ops_thresholds where key='OFFROUTE_KM'")
L487a=$(L 8d)
mk $L487a A487 "'HHL/A487'" "'SCX/A487'" FERRY "'$S485'"
q "set session_replication_role=replica;
   update loads set status='IN_TRANSIT_SE' where id='$L487a';
   delete from positions where load_id='$L487a';
   update ops_thresholds set value_num = 20 where key = 'OFFROUTE_KM';
   set session_replication_role=origin;" >/dev/null
# F7 r3: prawdziwy Jämjö 15.84/56.19 (stary 15.95/56.25 leżał w Kalmarsundzie)
q "insert into positions (load_id, ts, geom_raw, source) values
  ('$L487a', now() - interval '15 minutes', st_setsrid(st_makepoint(15.84, 56.19),4326), 'TELEMATICS_API'),
  ('$L487a', now(), st_setsrid(st_makepoint(15.84, 56.19),4326), 'TELEMATICS_API')" >/dev/null
q "select refresh_load_eta('$L487a')" >/dev/null
chk "#487: Jämjö 15.84/56.19 (OFFROUTE_KM=20) → brak OFF_CORRIDOR" "$(rk $L487a OFF_CORRIDOR)" 0
# SG-23 12:02 UTC — Söderköping (wcześniej 33,5 km bez wierzchołków 0160)
q "delete from positions where load_id='$L487a'" >/dev/null
q "insert into positions (load_id, ts, geom_raw, source) values
  ('$L487a', now() - interval '15 minutes', st_setsrid(st_makepoint(16.3186, 58.4792),4326), 'TELEMATICS_API'),
  ('$L487a', now(), st_setsrid(st_makepoint(16.3186, 58.4792),4326), 'TELEMATICS_API')" >/dev/null
q "select refresh_load_eta('$L487a')" >/dev/null
chk "#487: Söderköping 16.3186/58.4792 (OFFROUTE_KM=20) → brak OFF_CORRIDOR" "$(rk $L487a OFF_CORRIDOR)" 0
# #496 / F7 #585 N8: SE_E22 bez nadpisania GPS — Vagnhärad/E4 znowu w korytarzu
q "update ops_thresholds set value_num = ${PREV_OFFROUTE:-2} where key = 'OFFROUTE_KM'" >/dev/null
q "delete from positions where load_id='$L487a'" >/dev/null
q "insert into positions (load_id, ts, geom_raw, source) values
  ('$L487a', now() - interval '15 minutes', st_setsrid(st_makepoint(17.50, 58.95),4326), 'TELEMATICS_API'),
  ('$L487a', now(), st_setsrid(st_makepoint(17.50, 58.95),4326), 'TELEMATICS_API')" >/dev/null
q "select refresh_load_eta('$L487a')" >/dev/null
chk "#496: Vagnhärad 17.50/58.95 → brak OFF_CORRIDOR" "$(rk $L487a OFF_CORRIDOR)" 0
L487b=$(L 8e)
mk $L487b B487 "'HHL/B487'" "'SCX/B487'" FERRY "'$S485'"
q "set session_replication_role=replica;
   update loads set status='IN_TRANSIT_SE' where id='$L487b';
   delete from positions where load_id='$L487b';
   set session_replication_role=origin;" >/dev/null
# ~50 km od E22 w Smålandzie (zachód od Västervik 16.637/57.758; nie Kattegat)
q "insert into positions (load_id, ts, geom_raw, source) values
  ('$L487b', now() - interval '15 minutes', st_setsrid(st_makepoint(15.79, 57.76),4326), 'TELEMATICS_API'),
  ('$L487b', now(), st_setsrid(st_makepoint(15.79, 57.76),4326), 'TELEMATICS_API')" >/dev/null
q "select refresh_load_eta('$L487b')" >/dev/null
chk "#487: ~50 km od E22 (Småland) → OFF_CORRIDOR" "$(rk $L487b OFF_CORRIDOR)" 1
chk "#487: OFF_CORRIDOR z korytarzem SE_E22" \
  "select detail->'params'->>'corridor' from risk_signals where load_id='$L487b' and dedup_key='OFF_CORRIDOR:$L487b' and resolved_at is null" SE_E22

# 27B:C — obie trasy Karlskrona→Boden: OFF do najbliższego z SE_E22 / śródlądowy (F7 r1)
echo; echo "[27B] dual corridor OFF_CORRIDOR (E4 + inland)"
chk "27B: SE_KAA_INLAND w słowniku korytarzy" \
  "select count(*) from corridor_polylines where code='SE_KAA_INLAND' and coalesce(total_km,0)>0" 1
chk "27B: bez TRACK → inland = SE_KAA_INLAND" \
  "select public.stena_se_inland_corridor_code()" SE_KAA_INLAND
chk "27B: eta_corridor pień (Kalmar lat<58.55) → SE_E22" \
  "select public.stena_se_eta_corridor(st_setsrid(st_makepoint(16.356, 56.663),4326))" SE_E22
chk "27B: eta_corridor Västerås → SE_KAA_INLAND" \
  "select public.stena_se_eta_corridor(st_setsrid(st_makepoint(16.5448, 59.6099),4326))" SE_KAA_INLAND
chk "27B: nearest Västerås → SE_KAA_INLAND" \
  "select corridor_code from public.stena_se_corridor_nearest(st_setsrid(st_makepoint(16.5448, 59.6099),4326))" SE_KAA_INLAND

# L cc — nie c8: #622 F7 r3 (L622g) zajmuje c8 niżej (kolizja → false refresh)
L27Ba=$(L cc)
mk $L27Ba A27B "'HHL/A27B'" "'SCX/A27B'" FERRY "'$S485'"
q "set session_replication_role=replica;
   update loads set status='IN_TRANSIT_SE' where id='$L27Ba';
   delete from positions where load_id='$L27Ba';
   set session_replication_role=origin;" >/dev/null
# Västerås — na wariancie śródlądowym; wcześniej fałszywy OFF względem samego SE_E22
q "insert into positions (load_id, ts, geom_raw, source) values
  ('$L27Ba', now() - interval '15 minutes', st_setsrid(st_makepoint(16.5448, 59.6099),4326), 'TELEMATICS_API'),
  ('$L27Ba', now(), st_setsrid(st_makepoint(16.5448, 59.6099),4326), 'TELEMATICS_API')" >/dev/null
q "select refresh_load_eta('$L27Ba')" >/dev/null
chk "27B: Västerås (śródlądowy) → brak OFF_CORRIDOR" "$(rk $L27Ba OFF_CORRIDOR)" 0
# 27B:C ETA — postęp/godziny wg stena_se_eta_corridor (0334)
chk "27B ETA: Västerås → se_corridor inland" \
  "select basis->'causes'->>'se_corridor' from compute_load_eta('$L27Ba', now())" SE_KAA_INLAND
chk "27B ETA: Västerås → se_road_code INLAND" \
  "select basis->'causes'->>'se_road_code' from compute_load_eta('$L27Ba', now())" SE_ROAD_KAA_INLAND
chk "27B ETA: Västerås → progress corridor" \
  "select basis->'causes'->>'progress' from compute_load_eta('$L27Ba', now())" corridor

# Pień E22 przed Norrköping (Oskarshamn) — bez OFF
L27Bc=$(L ca)
mk $L27Bc C27B "'HHL/C27B'" "'SCX/C27B'" FERRY "'$S485'"
q "set session_replication_role=replica;
   update loads set status='IN_TRANSIT_SE' where id='$L27Bc';
   delete from positions where load_id='$L27Bc';
   set session_replication_role=origin;" >/dev/null
q "insert into positions (load_id, ts, geom_raw, source) values
  ('$L27Bc', now() - interval '15 minutes', st_setsrid(st_makepoint(16.45, 57.26),4326), 'TELEMATICS_API'),
  ('$L27Bc', now(), st_setsrid(st_makepoint(16.45, 57.26),4326), 'TELEMATICS_API')" >/dev/null
q "select refresh_load_eta('$L27Bc')" >/dev/null
chk "27B: pień E22 przed Norrköping → brak OFF_CORRIDOR" "$(rk $L27Bc OFF_CORRIDOR)" 0
chk "27B ETA: pień → se_corridor SE_E22" \
  "select basis->'causes'->>'se_corridor' from compute_load_eta('$L27Bc', now())" SE_E22
chk "27B ETA: pień → se_road_code KAA (E4)" \
  "select basis->'causes'->>'se_road_code' from compute_load_eta('$L27Bc', now())" SE_ROAD_KAA

L27Bb=$(L c9)
mk $L27Bb B27B "'HHL/B27B'" "'SCX/B27B'" FERRY "'$S485'"
q "set session_replication_role=replica;
   update loads set status='IN_TRANSIT_SE' where id='$L27Bb';
   delete from positions where load_id='$L27Bb';
   set session_replication_role=origin;" >/dev/null
# Karlstad — daleko od E4 i od śródlądowego; kod = wynik nearest (nie ∈ zbioru)
q "insert into positions (load_id, ts, geom_raw, source) values
  ('$L27Bb', now() - interval '15 minutes', st_setsrid(st_makepoint(13.51, 59.38),4326), 'TELEMATICS_API'),
  ('$L27Bb', now(), st_setsrid(st_makepoint(13.51, 59.38),4326), 'TELEMATICS_API')" >/dev/null
q "select refresh_load_eta('$L27Bb')" >/dev/null
chk "27B: Karlstad (daleko od obu) → OFF_CORRIDOR" "$(rk $L27Bb OFF_CORRIDOR)" 1
chk "27B: Karlstad OFF corridor = nearest()" \
  "select case when detail->'params'->>'corridor' =
      (select corridor_code from public.stena_se_corridor_nearest(
         st_setsrid(st_makepoint(13.51, 59.38),4326)))
     then 1 else 0 end
     from risk_signals where load_id='$L27Bb' and dedup_key='OFF_CORRIDOR:$L27Bb' and resolved_at is null" 1

# Preferuj SE_KAA_TRACK gdy ślad przechodzi koło Västerås (≠ kopia SE_E22)
q "insert into corridor_polylines (code, geom, total_km, attribution, source, updated_at)
   select 'SE_KAA_TRACK',
          st_setsrid(st_makeline(array[
            st_makepoint(16.183, 58.594),
            st_makepoint(16.5448, 59.6099),
            st_makepoint(16.6066, 59.9079),
            st_makepoint(17.1413, 60.6749),
            st_makepoint(21.7591, 65.8054)
          ]), 4326),
          1,
          'test',
          '27B F7 TRACK fixture',
          now()
   on conflict (code) do update
     set geom = excluded.geom, total_km = excluded.total_km,
         attribution = excluded.attribution, source = excluded.source, updated_at = now();
   update corridor_polylines
      set total_km = round((st_length(geom::geography)/1000.0)::numeric, 2)
    where code = 'SE_KAA_TRACK';" >/dev/null
chk "27B: z TRACK koło Västerås → inland = SE_KAA_TRACK" \
  "select public.stena_se_inland_corridor_code()" SE_KAA_TRACK
chk "27B: nearest Västerås przy TRACK → SE_KAA_TRACK" \
  "select corridor_code from public.stena_se_corridor_nearest(st_setsrid(st_makepoint(16.5448, 59.6099),4326))" SE_KAA_TRACK
q "delete from corridor_polylines where code='SE_KAA_TRACK' and source='27B F7 TRACK fixture';" >/dev/null
chk "27B: po usunięciu TRACK → z powrotem SE_KAA_INLAND" \
  "select public.stena_se_inland_corridor_code()" SE_KAA_INLAND

# Brak obu korytarzy Stena → v_blocked (F7 r2: nie total_km=0 — CHECK >0; delete w transakcji;
# rk() bez resolved_at i L27Bb ma już OFF z Karlstad → licz unresolved w tej samej transakcji)
chk "27B: brak obu korytarzy → bez OFF_CORRIDOR (v_blocked)" \
  "begin;
   delete from corridor_polylines where code in ('SE_E22','SE_KAA_INLAND','SE_KAA_TRACK');
   select refresh_load_eta('$L27Bb');
   select count(*) from risk_signals
     where load_id='$L27Bb' and dedup_key like 'OFF_CORRIDOR%' and resolved_at is null;
   rollback" 0

# Regresja Polferries / SE_E4 (Nynäshamn) — nie dual Stena
S27Be4=77777777-0000-0000-0000-00000000027e
L27Be4=$(L cb)
q "insert into sailings (id, project_id, vessel_id, route, departure_at, arrival_at, status, source)
   values ('$S27Be4', '$P', '66666666-0000-0000-0000-000000000001', 'GDN-NYN',
           now() - interval '20 hours', now() - interval '2 hours', 'ZAPLANOWANY', 'POLFERRIES')
   on conflict (id) do nothing;" >/dev/null
mk $L27Be4 E27B "'HHL/E27B'" "'SCX/E27B'" FERRY "'$S27Be4'"
q "set session_replication_role=replica;
   update loads set status='IN_TRANSIT_SE', sailing_id='$S27Be4' where id='$L27Be4';
   delete from positions where load_id='$L27Be4';
   set session_replication_role=origin;" >/dev/null
# F7 r2: wierzchołek SE_E4 (Sztokholm) — Nyköping (17.0,58.75) jest tylko w SE_E22 (~55 km od E4)
q "insert into positions (load_id, ts, geom_raw, source) values
  ('$L27Be4', now() - interval '15 minutes', st_setsrid(st_makepoint(18.0686, 59.3293),4326), 'TELEMATICS_API'),
  ('$L27Be4', now(), st_setsrid(st_makepoint(18.0686, 59.3293),4326), 'TELEMATICS_API')" >/dev/null
q "select refresh_load_eta('$L27Be4')" >/dev/null
chk "27B: Polferries na E4 (Sztokholm) → brak OFF_CORRIDOR" "$(rk $L27Be4 OFF_CORRIDOR)" 0
# F7 #638: Polferries ETA causes (SE_E4 / SE_ROAD)
chk "27B ETA: Polferries → se_corridor SE_E4" \
  "select basis->'causes'->>'se_corridor' from compute_load_eta('$L27Be4', now())" SE_E4
chk "27B ETA: Polferries → se_road_code SE_ROAD" \
  "select basis->'causes'->>'se_road_code' from compute_load_eta('$L27Be4', now())" SE_ROAD
q "delete from positions where load_id='$L27Be4';
   insert into positions (load_id, ts, geom_raw, source) values
  ('$L27Be4', now() - interval '15 minutes', st_setsrid(st_makepoint(13.51, 59.38),4326), 'TELEMATICS_API'),
  ('$L27Be4', now(), st_setsrid(st_makepoint(13.51, 59.38),4326), 'TELEMATICS_API');
   select refresh_load_eta('$L27Be4');" >/dev/null
chk "27B: Polferries Karlstad → OFF_CORRIDOR SE_E4" \
  "select detail->'params'->>'corridor' from risk_signals
    where load_id='$L27Be4' and dedup_key='OFF_CORRIDOR:$L27Be4' and resolved_at is null" SE_E4

# F7 #638: REMOVED → ETA null, segment CANCELLED (jak 0315) — 1 asercja (+2 Polferries = +3)
# REMOVED tylko przez decision_resolve / remove_ctx; w teście: replica + removed_at (check 0315).
L27Brm=$(L cd)
mk $L27Brm R27B "'HHL/R27B'" "'SCX/R27B'" IN_TRANSIT_SE null
q "set session_replication_role=replica;
   update loads
      set status='REMOVED',
          removed_at=now(),
          removed_prev_status='IN_TRANSIT_SE'
    where id='$L27Brm';
   set session_replication_role=origin;" >/dev/null
chk "27B ETA: REMOVED → eta null + segment CANCELLED" \
  "select case when eta is null and basis->>'segment'='CANCELLED' then 'ok' else 'bad' end from compute_load_eta('$L27Brm', now())" ok

# sprzątanie ryzyk 27B (jak #487)
q "delete from decision_events where decision_id in (
      select d.id from decisions d
       where d.risk_id in (select id from risk_signals
         where load_id in ('$L27Ba','$L27Bb','$L27Bc','$L27Be4')
           and (title_key='rk_off_corridor' or dedup_key like 'OFF_CORRIDOR:%')));
   delete from decisions where risk_id in (
      select id from risk_signals
       where load_id in ('$L27Ba','$L27Bb','$L27Bc','$L27Be4')
         and (title_key='rk_off_corridor' or dedup_key like 'OFF_CORRIDOR:%'));
   delete from risk_signals
    where load_id in ('$L27Ba','$L27Bb','$L27Bc','$L27Be4')
      and (title_key='rk_off_corridor' or dedup_key like 'OFF_CORRIDOR:%');" >/dev/null

# #496: nieznana trasa promu → bez OFF_CORRIDOR (nie SE_E4). CHECK zdejmujemy tylko na czas wstawki.
# L 7b — nie 97: #502 F7 B4 = L 97 (kolizja → stary rejs GDN-NYN → SE_E4 + OFF_CORRIDOR).
# Sailing …49a — nie …496: Ösmo F7 r3 już zajmuje …496 (GDN-NYN); INSERT OTHER cicho padał → fałszywy FAIL.
S496u=77777777-0000-0000-0000-00000000049a
L496u=$(L 7b)
q "alter table public.sailings drop constraint if exists sailings_route_check;
   insert into sailings (id,project_id,vessel_id,route,departure_at,arrival_at,actual_departure_at,actual_arrival_at,status,source) values
    ('$S496u','$P','66666666-0000-0000-0000-000000000485','OTHER',
     '2026-10-06 12:00+00','2026-10-06 22:00+00','2026-10-06 12:00+00','2026-10-06 22:00+00','DOPLYNAL','STENA');" >/dev/null
mk $L496u U496 "'HHL/U496'" "'SCX/U496'" IN_TRANSIT_SE "'$S496u'"
q "set session_replication_role=replica;
   update loads set status='IN_TRANSIT_SE', sailing_id='$S496u' where id='$L496u';
   delete from positions where load_id='$L496u';
   set session_replication_role=origin;" >/dev/null
q "insert into positions (load_id, ts, geom_raw, source) values
  ('$L496u', now() - interval '15 minutes', st_setsrid(st_makepoint(15.79, 57.76),4326), 'TELEMATICS_API'),
  ('$L496u', now(), st_setsrid(st_makepoint(15.79, 57.76),4326), 'TELEMATICS_API')" >/dev/null
q "select refresh_load_eta('$L496u')" >/dev/null
chk "#496: nieznana trasa → brak OFF_CORRIDOR" "$(rk $L496u OFF_CORRIDOR)" 0
# BN1 (0338): przywróć regex tras (nie starą listę GDN/GDY — psuje TLL-HEL / TALLINK).
q "update loads set sailing_id=null where id='$L496u';
   delete from sailings where id='$S496u';
   alter table public.sailings drop constraint if exists sailings_route_check;
   alter table public.sailings add constraint sailings_route_check
     check (route ~ '^[A-Z][A-Z0-9_-]{0,62}$');" >/dev/null
# F7: sprzątanie L487a/b + L496u (nie globalne DELETE) — risks.sh baseline title_key.
chk "#487/#496 po teście brak rk_off_corridor L487a/b/L496u" \
  "delete from decision_events where decision_id in (
      select d.id from decisions d
       where d.risk_id in (select id from risk_signals
         where load_id in ('$L487a','$L487b','$L496u')
           and (title_key='rk_off_corridor' or dedup_key like 'OFF_CORRIDOR:%')));
   delete from decisions where risk_id in (
      select id from risk_signals
       where load_id in ('$L487a','$L487b','$L496u')
         and (title_key='rk_off_corridor' or dedup_key like 'OFF_CORRIDOR:%'));
   delete from risk_signals
    where load_id in ('$L487a','$L487b','$L496u')
      and (title_key='rk_off_corridor' or dedup_key like 'OFF_CORRIDOR:%');
   select count(*) from risk_signals
    where load_id in ('$L487a','$L487b','$L496u') and title_key='rk_off_corridor'" 0

echo; echo "[#489] Odpięcie rejsu → powrót statusu (SAILING_REMOVED)"
L489a=$(L 8f)
L489b=$(L 90)
L489c=$(L 91)
L489d=$(L 92)
L489e=$(L 93)
L489f=$(L 94)
S489b=77777777-0000-0000-0000-000000000489
S489e=77777777-0000-0000-0000-00000000049e
q "insert into sailings (id,project_id,vessel_id,departure_at,arrival_at,actual_departure_at,status,route) values
 ('$S489b','$P','66666666-0000-0000-0000-000000000001','2026-10-01 18:00+00','2026-10-02 12:00+00','2026-10-01 18:05+00','ZAPLANOWANY','GDN-NYN'),
 ('$S489e','$P','66666666-0000-0000-0000-000000000001','2026-10-01 10:00+00','2026-10-02 04:00+00',null,'ZAPLANOWANY','GDN-NYN')" >/dev/null
# a) FERRY z AIS → odpięcie → IN_TRANSIT_PL; 0 powiadomień; FERRY z zastepuje
mk $L489a A489 "'HHL/A489'" "'SCX/A489'" IN_TRANSIT_PL "'$S1'"
q "update sailings set actual_departure_at = '2026-10-01 12:00+00' where id='$S1'" >/dev/null
Nbell489=$(q "select count(*) from notifications")
chk "#489: promote → FERRY (AIS)" "select promote_ferry_departures('2026-10-01 12:30+00'); select status from loads where id='$L489a'" FERRY
chk "#489: odpięcie rejsu przy FERRY AIS → IN_TRANSIT_PL" \
  "update loads set sailing_id = null where id='$L489a'; select status from loads where id='$L489a'" IN_TRANSIT_PL
chk "#489: source=SAILING_REMOVED" \
  "select payload->>'source' from load_events where load_id='$L489a' and event_type='STATUS_AUTO' and payload->>'to'='IN_TRANSIT_PL' order by id desc limit 1" SAILING_REMOVED
chk "#489: FERRY z osi zastąpione (zastepuje)" \
  "select count(*) from load_events e where e.load_id='$L489a' and e.event_type='STATUS_AUTO' and e.payload->>'to'='FERRY' and not exists (select 1 from load_events z where z.load_id=e.load_id and z.payload->>'zastepuje'=e.id::text)" 0
chk "#489: odpięcie bez nowych powiadomień" \
  "select (count(*) = $Nbell489)::text from notifications" true
# b) FERRY ręczny → odpięcie bez zmian
mk $L489b B489 "'HHL/B489'" "'SCX/B489'" IN_TRANSIT_PL "'$S1'"
HHL=11111111-0000-0000-0000-000000000001
q "begin; set local role authenticated; set local request.jwt.claim.sub='$HHL';
   select load_status_set('$L489b','AT_PORT_GDANSK','2026-10-01 11:00+00',null);
   select load_status_set('$L489b','FERRY','2026-10-01 12:00+00',null);
   commit" >/dev/null
chk "#489: ręczny FERRY przed odpięciem" "$(st $L489b)" FERRY
chk "#489: odpięcie przy FERRY ręcznym → bez zmian" \
  "update loads set sailing_id = null where id='$L489b'; select status from loads where id='$L489b'" FERRY
# b') FERRY z AIS, potem ręczna godzina FERRY → odpięcie bez zmian (F7)
mk $L489f F489 "'HHL/F489'" "'SCX/F489'" IN_TRANSIT_PL "'$S1'"
q "update sailings set actual_departure_at = '2026-10-01 12:00+00' where id='$S1'" >/dev/null
chk "#489: b' promote → FERRY (AIS)" \
  "select promote_ferry_departures('2026-10-01 12:30+00'); select status from loads where id='$L489f'" FERRY
q "begin; set local role authenticated; set local request.jwt.claim.sub='$HHL';
   select load_status_set('$L489f','FERRY','2026-10-01 13:00+00',null);
   commit" >/dev/null
chk "#489: b' po load_status_set nadal FERRY" "$(st $L489f)" FERRY
chk "#489: b' odpięcie po ręcznej godzinie → bez zmian" \
  "update loads set sailing_id = null where id='$L489f'; select status from loads where id='$L489f'" FERRY
# c) zmiana rejsu → cofnięcie, potem nowy rejs ustawia FERRY
mk $L489c C489 "'HHL/C489'" "'SCX/C489'" IN_TRANSIT_PL "'$S1'"
q "update sailings set actual_departure_at = '2026-10-01 12:00+00' where id='$S1'" >/dev/null
q "select promote_ferry_departures('2026-10-01 12:30+00')" >/dev/null
chk "#489: C przed zmianą rejsu = FERRY" "$(st $L489c)" FERRY
chk "#489: zmiana rejsu → cofnięcie do IN_TRANSIT_PL" \
  "update loads set sailing_id = '$S489b' where id='$L489c'; select status from loads where id='$L489c'" IN_TRANSIT_PL
chk "#489: po promote nowego rejsu → FERRY" \
  "select promote_ferry_departures('2026-10-01 18:30+00'); select status from loads where id='$L489c'" FERRY
chk "#489: nowy FERRY ma sailing_id S489b" \
  "select payload->>'sailing_id' from load_events where load_id='$L489c' and event_type='STATUS_AUTO' and payload->>'to'='FERRY' and not exists (select 1 from load_events z where z.load_id=load_events.load_id and z.payload->>'zastepuje'=load_events.id::text) order by id desc limit 1" "$S489b"
# d) FERRY z AIS, potem AT_PORT_NYNASHAMN z GPS → odpięcie bez zmian (F7)
mk $L489d D489 "'HHL/D489'" "'SCX/D489'" IN_TRANSIT_PL "'$S1'"
q "update sailings set actual_departure_at = '2026-10-01 12:00+00' where id='$S1'" >/dev/null
chk "#489: d promote → FERRY (AIS)" \
  "select promote_ferry_departures('2026-10-01 12:30+00'); select status from loads where id='$L489d'" FERRY
pos $L489d 58.9350 17.9500 "2026-10-02 06:10+00"; pos $L489d 58.9351 17.9501 "2026-10-02 06:15+00"
chk "#489: d GPS → AT_PORT_NYNASHAMN" "$(st $L489d)" AT_PORT_NYNASHAMN
chk "#489: d odpięcie przy porcie SE GPS → bez zmian" \
  "update loads set sailing_id = null where id='$L489d'; select status from loads where id='$L489d'" AT_PORT_NYNASHAMN
# e) SCHEDULE_ASSUMED → korekta AIS → odpięcie → AT_PORT_GDANSK (F7 B1)
mk $L489e E489 "'HHL/E489'" "'SCX/E489'" AT_PORT_GDANSK "'$S489e'"
chk "#489: e SCHEDULE_ASSUMED → FERRY" \
  "select promote_ferry_departures('2026-10-01 11:00+00'); select status from loads where id='$L489e'" FERRY
chk "#489: e source=SCHEDULE_ASSUMED" \
  "select payload->>'source' from load_events where load_id='$L489e' and event_type='STATUS_AUTO' and payload->>'to'='FERRY' and not exists (select 1 from load_events z where z.load_id=load_events.load_id and z.payload->>'zastepuje'=load_events.id::text) order by id desc limit 1" SCHEDULE_ASSUMED
q "update sailings set actual_departure_at = '2026-10-01 10:15+00' where id='$S489e'" >/dev/null
chk "#489: e AIS korekta (korekta=true)" \
  "select promote_ferry_departures('2026-10-01 11:30+00'); select (payload->>'korekta') from load_events where load_id='$L489e' and event_type='STATUS_AUTO' and payload->>'to'='FERRY' and not exists (select 1 from load_events z where z.load_id=load_events.load_id and z.payload->>'zastepuje'=load_events.id::text) order by id desc limit 1" true
chk "#489: e odpięcie po korekcie → AT_PORT_GDANSK" \
  "update loads set sailing_id = null where id='$L489e'; select status from loads where id='$L489e'" AT_PORT_GDANSK
chk "#489: e cofniete_ids ma 2 (korzeń + korekta)" \
  "select jsonb_array_length(payload->'cofniete_ids') from load_events where load_id='$L489e' and event_type='STATUS_AUTO' and payload->>'source'='SAILING_REMOVED' order by id desc limit 1" 2
chk "#489: e cofnięcie bez korekta:true" \
  "select coalesce(payload->>'korekta','') from load_events where load_id='$L489e' and event_type='STATUS_AUTO' and payload->>'source'='SAILING_REMOVED' order by id desc limit 1" ""

echo; echo "[#540] a10 FOR NO KEY UPDATE — bez deadlocka z INSERT load_events"
L540=$(L a0)
mk $L540 A540 "'HHL/A540'" "'SCX/A540'" RESOURCES_PENDING null
# Odbiór: definicja bez „for update” („for no key update” nie zawiera tej frazy).
chk "#540: a10_try_prep_status bez FOR UPDATE" \
  "select (pg_get_functiondef('public.a10_try_prep_status(uuid)'::regprocedure) !~* 'for update')::text" true
chk "#540: c17_try_ready_to_invoice bez FOR UPDATE" \
  "select (pg_get_functiondef('public.c17_try_ready_to_invoice(uuid,jsonb)'::regprocedure) !~* 'for update')::text" true
chk "#540: c17_try_invoiced bez FOR UPDATE" \
  "select (pg_get_functiondef('public.c17_try_invoiced(uuid,jsonb)'::regprocedure) !~* 'for update')::text" true
# Sesja A trzyma wiersz przez UPDATE+a9 (NO KEY UPDATE) + sleep; sesja B INSERT z lock_timeout 1 s.
# F7: bez podpowłoki `( … & )` — inaczej `wait` nie czeka na psql (sieroty, wyścig w grep).
TMP540=$(mktemp -d)
$PSQL -c "begin; update loads set driver_name = 'Kierowca540A' where id='$L540'; select pg_sleep(2); commit;" >"$TMP540/A" 2>&1 &
PID540A=$!
sleep 0.4
GOT540=fail
if $PSQL -c "set lock_timeout = '1s'; insert into load_events (load_id, event_type, occurred_at, payload) values ('$L540','NOTE',now(),'{\"src\":\"#540\"}'::jsonb); select 'ok';" >"$TMP540/B" 2>&1; then
  grep -q '^ok$' "$TMP540/B" && GOT540=ok
fi
wait "$PID540A" || true
chk "#540: INSERT zdarzenia w trakcie UPDATE (lock_timeout 1s) → ok" "select '$GOT540'" ok
# Równoległy UPDATE + INSERT tego samego ładunku — 0 deadlocków (40 rund).
for i in $(seq 1 40); do
  $PSQL -c "begin; update loads set driver_name = 'A$i' where id='$L540'; select pg_sleep(0.05); commit;" >/dev/null 2>"$TMP540/da$i" &
  PID540DA=$!
  $PSQL -c "begin; insert into load_events (load_id, event_type, occurred_at) values ('$L540','NOTE',now()); update loads set driver_phone = '+48000000$i' where id='$L540'; commit;" >/dev/null 2>"$TMP540/db$i" &
  PID540DB=$!
  wait "$PID540DA" "$PID540DB" || true
done
DL540=$(grep -ci 'deadlock' "$TMP540"/d* 2>/dev/null | awk -F: '{s+=$NF} END {print s+0}')
chk "#540: 40× równoległy UPDATE+INSERT → 0 deadlocków" "select $DL540" 0
rm -rf "$TMP540"

# #557 F7: hotfix_557_apply — CI bez T-12 = no-op; tu fikstury wykonują wszystkie gałęzie.
echo; echo "[#557] hotfix_557_apply T-12 / SG-21"
LT12=55555555-0000-0000-0000-000000005571
LSG=55555555-0000-0000-0000-000000005572
SW=77777777-0000-0000-0000-000000005571
SF=77777777-0000-0000-0000-000000005572
V557=66666666-0000-0000-0000-000000000557
q "
update geofences set active = true
 where project_id = '$P' and kind = 'PORT_IN' and country = 'SE'
   and coalesce(route, 'POLFERRIES') = 'POLFERRIES';
delete from decision_events where decision_id in (
  select id from decisions where load_id in ('$LT12','$LSG'));
delete from decisions where load_id in ('$LT12','$LSG');
delete from risk_signals where load_id in ('$LT12','$LSG');
delete from positions where load_id in ('$LT12','$LSG');
delete from load_events where load_id in ('$LT12','$LSG');
delete from shipment_items where shipment_code in ('T-12','SG-21') and project_id = '$P';
delete from loads where id in ('$LT12','$LSG');
delete from sailings where id in ('$SW','$SF');
insert into vessels (id, name, operator) values
 ('$V557', 'M/F Wawel 557', 'Polferries')
 on conflict (id) do nothing;
insert into sailings (id, project_id, vessel_id, route, departure_at, arrival_at,
  actual_departure_at, actual_arrival_at, status, source) values
 ('$SW', '$P', '$V557', 'GDN-NYN',
  '2026-10-24 12:00+00', '2026-10-25 06:00+00',
  '2026-10-24 12:00+00', '2026-10-25 06:00+00', 'DOPLYNAL', 'POLFERRIES'),
 ('$SF', '$P', '$V557', 'GDN-NYN',
  now() + interval '2 days', now() + interval '2 days 18 hours',
  null, null, 'ZAPLANOWANY', 'POLFERRIES');
insert into loads (id, project_id, carrier_org_id, order_no, hhl_order_no, carrier_order_no,
  status, sailing_id, plan_load_date, telematics_vehicle_id) values
 ('$LT12', '$P', '$SCXO', 'KSH/T12', 'HHL/T12', 'SCX/T12', 'FERRY', '$SW', '2026-10-23', 'TEL-T12'),
 ('$LSG', '$P', '$SCXO', 'KSH/SG21', 'HHL/SG21', 'SCX/SG21', 'AT_PORT_GDANSK', '$SF', '2026-10-23', 'TEL-SG21');
insert into shipment_items (project_id, load_id, shipment_code, cargo_class) values
 ('$P', '$LT12', 'T-12', 'STANDARD'),
 ('$P', '$LSG', 'SG-21', 'STANDARD');
insert into load_events (load_id, event_type, occurred_at) values
 ('$LT12', 'MILESTONE_LOADED', '2026-10-23 08:00+00'),
 ('$LSG', 'MILESTONE_LOADED', '2026-10-23 08:00+00');
insert into positions (load_id, ts, geom_raw, source) values
 ('$LT12', '2026-10-24 14:00+00', st_setsrid(st_makepoint(18.6800, 54.4030), 4326), 'TELEMATICS_API'),
 ('$LT12', '2026-10-25 07:00+00', st_setsrid(st_makepoint(17.9500, 58.9350), 4326), 'TELEMATICS_API'),
 ('$LSG', '2026-10-24 14:00+00', st_setsrid(st_makepoint(18.6800, 54.4030), 4326), 'TELEMATICS_API'),
 ('$LSG', '2026-10-25 07:00+00', st_setsrid(st_makepoint(17.9500, 58.9350), 4326), 'TELEMATICS_API');
delete from audit_log where action like 'HOTFIX_557%';
" >/dev/null
N557=$(q "select public.hotfix_557_apply()")
chk "#557: hotfix_557_apply → n_fix > 0" "select ($N557 > 0)" t
chk "#557: SG-21 na rejsie Wawel (jak T-12)" \
  "select (l.sailing_id = '$SW') from loads l join shipment_items si on si.load_id=l.id where si.shipment_code='SG-21'" t
chk "#557: T-12 status ≥ AT_PORT_NYNASHAMN" \
  "select (public.load_status_rank(status) >= public.load_status_rank('AT_PORT_NYNASHAMN')) from loads where id='$LT12'" t
chk "#557: SG-21 status ≥ AT_PORT_NYNASHAMN" \
  "select (public.load_status_rank(status) >= public.load_status_rank('AT_PORT_NYNASHAMN')) from loads where id='$LSG'" t
chk "#557: audit HOTFIX_557_*" \
  "select (count(*) filter (where action like 'HOTFIX_557%') >= 3) from audit_log" t
N_SAIL=$(q "select count(*) from load_events where load_id='$LSG' and event_type='SAILING_ASSIGNED'")
chk "#557: jedno SAILING_ASSIGNED po pierwszym przebiegu" "select $N_SAIL" 1
q "select public.hotfix_557_apply()" >/dev/null
chk "#557: ponowne wywołanie idempotentne (bez nowego SAILING_ASSIGNED)" \
  "select count(*) from load_events where load_id='$LSG' and event_type='SAILING_ASSIGNED'" 1

# #557 PR2 F7 r2: AIS backup Port SE; stale; mismatch; overdue w detect_ferry_overdue
# S557c ≠ S557a (inny departure) — unique (vessel, departure).
echo; echo "[#557 PR2] reguły AIS / stale / mismatch"
L557a=55555555-0000-0000-0000-00000000557a
L557b=55555555-0000-0000-0000-00000000557b
L557c=55555555-0000-0000-0000-00000000557c
L557d=55555555-0000-0000-0000-00000000557d
L557e=55555555-0000-0000-0000-00000000557e
S557a=77777777-0000-0000-0000-000000005573
S557b=77777777-0000-0000-0000-000000005574
S557c=77777777-0000-0000-0000-000000005575
S557d=77777777-0000-0000-0000-000000005576
V557b=66666666-0000-0000-0000-000000000558
V557s=66666666-0000-0000-0000-000000000559
q "
insert into vessels (id, name, operator) values
 ('$V557b', 'M/F Wawel 557b', 'Polferries'),
 ('$V557s', 'Stena Vision 557', 'Stena')
 on conflict (id) do nothing;
insert into sailings (id, project_id, vessel_id, route, departure_at, arrival_at,
  actual_departure_at, actual_arrival_at, status, source) values
 ('$S557a', '$P', '$V557b', 'GDN-NYN',
  '2026-10-10 12:00+00', '2026-10-11 06:00+00',
  '2026-10-10 12:00+00', '2026-10-11 06:00+00', 'DOPLYNAL', 'POLFERRIES'),
 ('$S557b', '$P', '$V557b', 'GDN-NYN',
  '2026-10-20 17:00+00', '2026-10-21 11:00+00',
  null, null, 'ZAPLANOWANY', 'POLFERRIES'),
 ('$S557c', '$P', '$V557b', 'GDN-NYN',
  '2026-10-09 12:00+00', '2026-10-10 06:00+00',
  '2026-10-09 12:00+00', '2026-10-10 06:00+00', 'DOPLYNAL', 'POLFERRIES'),
 ('$S557d', '$P', '$V557s', 'GDY-KAA',
  '2026-10-10 14:00+00', '2026-10-11 04:00+00',
  '2026-10-10 14:00+00', '2026-10-11 04:00+00', 'DOPLYNAL', 'STENA');
insert into geofences (project_id, name, kind, geom, hysteresis_m, dwell_seconds, debounce_fixes, country, route, active) values
 ('$P','Port Karlskrona 557','PORT_IN', make_circle_fence(56.1600,15.5900, 800), 200, 600, 2,'SE','STENA', false);
update geofences set active = false
 where project_id = '$P' and kind = 'PORT_IN' and country = 'SE'
   and coalesce(route, 'POLFERRIES') = 'POLFERRIES';
" >/dev/null
# F7 pkt 6: w porcie (strefa OFF) → AT_PORT_NYNASHAMN
mk $L557a A557 "'HHL/A557'" "'SCX/A557'" FERRY "'$S557a'"
q "insert into load_events (load_id, event_type, occurred_at) values ('$L557a','MILESTONE_LOADED','2026-10-09 08:00+00')" >/dev/null
pos $L557a 58.9350 17.9500 "2026-10-11 07:00+00"
chk "#557 PR2: w porcie SE, strefa OFF → AT_PORT_NYNASHAMN" "$(st $L557a)" AT_PORT_NYNASHAMN
chk "#557 PR2: source AIS_ARRIVAL_BACKUP (Port SE)" \
  "select payload->>'source' from load_events where load_id='$L557a' and event_type='STATUS_AUTO' and payload->>'to'='AT_PORT_NYNASHAMN' order by occurred_at desc limit 1" AIS_ARRIVAL_BACKUP
# ≥2 km od krawędzi PORT_IN (Ösmo jak #496; 58.96 od środka − 800 m ≈ 1,98 km < 2 km)
mk $L557d D557 "'HHL/D557'" "'SCX/D557'" FERRY "'$S557a'"
q "insert into load_events (load_id, event_type, occurred_at) values ('$L557d','MILESTONE_LOADED','2026-10-09 08:00+00')" >/dev/null
pos $L557d 59.00 17.90 "2026-10-11 07:30+00"
chk "#557 PR2: ≥2 km SE, strefa OFF → IN_TRANSIT_SE" "$(st $L557d)" IN_TRANSIT_SE
# F7 r3 pkt 1: Port SE + ≥2 km (strefa OFF) → Droga SE
pos $L557a 59.00 17.90 "2026-10-11 07:45+00"
chk "#557 PR2: Port SE + ≥2 km OFF → IN_TRANSIT_SE" "$(st $L557a)" IN_TRANSIT_SE
# strefa ON: pas 0,8–2 km bez zmian (0298 histereza) — backup return
q "update geofences set active = true
 where project_id = '$P' and kind = 'PORT_IN' and country = 'SE'
   and coalesce(route, 'POLFERRIES') = 'POLFERRIES'" >/dev/null
mk $L557e E557 "'HHL/E557'" "'SCX/E557'" FERRY "'$S557a'"
q "insert into load_events (load_id, event_type, occurred_at) values ('$L557e','MILESTONE_LOADED','2026-10-09 08:00+00')" >/dev/null
pos $L557e 58.9480 17.9500 "2026-10-11 08:00+00"
chk "#557 PR2: strefa ON pas 0,8–2 km → nadal FERRY" "$(st $L557e)" FERRY

# mismatch: przyszły rejs + pozycja SE
mk $L557b B557 "'HHL/B557'" "'SCX/B557'" AT_PORT_GDANSK "'$S557b'"
q "
insert into load_events (load_id, event_type, occurred_at) values ('$L557b','MILESTONE_LOADED','2026-10-09 08:00+00');
insert into positions (load_id, ts, geom_raw, source) values
 ('$L557b', '2026-10-10 11:00+00', st_setsrid(st_makepoint(18.6800, 54.4030), 4326), 'TELEMATICS_API');
" >/dev/null
pos $L557b 58.9350 17.9500 "2026-10-11 08:00+00"
chk "#557 PR2: przyszły rejs + SE → ryzyko mismatch" "$(rk $L557b SAILING_MISMATCH)" 1
chk "#557 PR2: propose = rejs z actual_dep w oknie" \
  "select (public.sailing_mismatch_propose_id('$L557b') = '$S557a')" t
pos $L557b 58.9360 17.9510 "2026-10-11 08:05+00"
chk "#557 PR2: druga pozycja SE — jedno ryzyko mismatch" "$(rk $L557b SAILING_MISMATCH)" 1

# stary punkt PL nie cofa FERRY (prev ts ≤ odejście; S557c: inny dzień niż S557a)
mk $L557c C557 "'HHL/C557'" "'SCX/C557'" FERRY "'$S557c'"
q "
insert into load_events (load_id, event_type, occurred_at) values ('$L557c','MILESTONE_LOADED','2026-10-08 08:00+00');
insert into positions (load_id, ts, geom_raw, source) values
 ('$L557c', '2026-10-09 11:00+00', st_setsrid(st_makepoint(18.6800, 54.4030), 4326), 'TELEMATICS_API');
" >/dev/null
pos $L557c 54.4030 18.6800 "2026-10-10 09:00+00"
chk "#557 PR2: stary punkt PL → status FERRY" "$(st $L557c)" FERRY
chk "#557 PR2: stary punkt ma stale_point" \
  "select (raw->>'stale_point') from positions where load_id='$L557c' order by ts desc limit 1" true
# postój Gdańsk przed odejściem — nie stale (osobny rejs: odejście tuż po punktach)
S557e=77777777-0000-0000-0000-000000005577
L557f=55555555-0000-0000-0000-00000000557f
chk "#557 PR2: fikstura S557e (Gdańsk przed odejściem)" \
  "insert into sailings (id, project_id, vessel_id, route, departure_at, arrival_at,
    actual_departure_at, actual_arrival_at, status, source) values
   ('$S557e', '$P', '$V557b', 'GDN-NYN',
    '2026-10-10 11:00+00', '2026-10-11 05:00+00',
    '2026-10-10 11:00+00', '2026-10-11 05:00+00', 'DOPLYNAL', 'POLFERRIES')
   returning (id is not null)" t
mk $L557f F557 "'HHL/F557'" "'SCX/F557'" AT_PORT_GDANSK "'$S557e'"
chk "#557 PR2: fikstura L557f MILESTONE + prev" \
  "insert into load_events (load_id, event_type, occurred_at) values ('$L557f','MILESTONE_LOADED','2026-10-09 08:00+00');
   insert into positions (load_id, ts, geom_raw, source) values
    ('$L557f', '2026-10-10 10:00+00', st_setsrid(st_makepoint(18.6800, 54.4030), 4326), 'TELEMATICS_API');
   select count(*) from positions where load_id='$L557f'" 1
pos $L557f 54.4030 18.6800 "2026-10-10 10:30+00"
chk "#557 PR2: postój Gdańsk przed odejściem bez stale" \
  "select coalesce(raw->>'stale_point','false') from positions where load_id='$L557f' order by ts desc limit 1" false

# overdue +2h bez pozycji SE → detect_ferry_overdue (FERRY_OVERDUE + sailing_id)
q "select public.detect_ferry_overdue('2026-10-10 09:00+00')" >/dev/null
chk "#557 PR2: +2h bez SE → FERRY_OVERDUE" "$(rk $L557c FERRY_OVERDUE)" 1
q "select public.detect_ferry_overdue('2026-10-10 09:15+00')" >/dev/null
chk "#557 PR2: drugi cron — jedno FERRY_OVERDUE" "$(rk $L557c FERRY_OVERDUE)" 1

# Stena GDY-KAA: wyłącz STENA PORT_IN (A5/485), inaczej backup return; UUID hex
L557g=55555555-0000-0000-0000-000000005570
q "update geofences set active = false
 where project_id = '$P' and kind = 'PORT_IN' and country = 'SE'
   and coalesce(route, 'POLFERRIES') = 'STENA'" >/dev/null
mk $L557g G557 "'HHL/G557'" "'SCX/G557'" FERRY "'$S557d'"
q "insert into load_events (load_id, event_type, occurred_at) values ('$L557g','MILESTONE_LOADED','2026-10-09 08:00+00')" >/dev/null
pos $L557g 56.1600 15.5900 "2026-10-11 05:00+00"
chk "#557 PR2: Stena GDY-KAA w porcie → AT_PORT_NYNASHAMN" "$(st $L557g)" AT_PORT_NYNASHAMN

# F7 r3 pkt 5: suggest / assign (HHL_ADMIN OK; OPS/KSH/SCX/Podgląd odmowa)
HHL=11111111-0000-0000-0000-000000000001
OPS557=11111111-0000-0000-0000-0000000000ab
q "insert into app_users (auth_id, org_id, email, role, active) values
 ('$OPS557','00000000-0000-0000-0000-00000000a001','ops-557@test','HHL_OPS',true)
 on conflict (auth_id) do update set role='HHL_OPS', active=true" >/dev/null
chk "#557 PR2: suggest proponuje S557a" \
  "begin; set local role authenticated; set local request.jwt.claim.sub='$HHL';
   select (sailing_mismatch_suggest('$L557b')->>'proposed_sailing_id') = '$S557a'; commit" t
out=$(q "begin; set local role authenticated; set local request.jwt.claim.sub='$KSH';
 select sailing_mismatch_suggest('$L557b'); rollback;" 2>&1)
echo "$out" | grep -qiE '42501|Brak|odmow|HHL|uprawn' \
  && { ok=$((ok+1)); echo "  OK    #557 PR2: suggest KSH odmowa"; } \
  || { fail=$((fail+1)); echo "  FAIL  #557 PR2: suggest KSH odmowa: $out"; }
out=$(q "begin; set local role authenticated; set local request.jwt.claim.sub='$SCX';
 select sailing_mismatch_suggest('$L557b'); rollback;" 2>&1)
echo "$out" | grep -qiE '42501|Brak|odmow|HHL|uprawn' \
  && { ok=$((ok+1)); echo "  OK    #557 PR2: suggest SCX odmowa"; } \
  || { fail=$((fail+1)); echo "  FAIL  #557 PR2: suggest SCX odmowa: $out"; }
out=$(q "begin; set local role authenticated; set local request.jwt.claim.sub='$OPS557';
 select sailing_mismatch_assign('$L557b','$S557a'); rollback;" 2>&1)
echo "$out" | grep -qiE 'Administrator HHL|42501' \
  && { ok=$((ok+1)); echo "  OK    #557 PR2: assign HHL_OPS odmowa"; } \
  || { fail=$((fail+1)); echo "  FAIL  #557 PR2: assign HHL_OPS odmowa: $out"; }
out=$(q "begin; set local role authenticated; set local request.jwt.claim.sub='$KSH';
 select sailing_mismatch_assign('$L557b','$S557a'); rollback;" 2>&1)
echo "$out" | grep -qiE 'Administrator HHL|42501' \
  && { ok=$((ok+1)); echo "  OK    #557 PR2: assign KSH odmowa"; } \
  || { fail=$((fail+1)); echo "  FAIL  #557 PR2: assign KSH odmowa: $out"; }
out=$(q "begin; set local role authenticated; set local request.jwt.claim.sub='$SCX';
 select sailing_mismatch_assign('$L557b','$S557a'); rollback;" 2>&1)
echo "$out" | grep -qiE 'Administrator HHL|42501' \
  && { ok=$((ok+1)); echo "  OK    #557 PR2: assign SCX odmowa"; } \
  || { fail=$((fail+1)); echo "  FAIL  #557 PR2: assign SCX odmowa: $out"; }
out=$(q "begin; set local role authenticated; set local request.jwt.claim.sub='$HHL';
 select admin_preview_start('KSH');
 select sailing_mismatch_assign('$L557b','$S557a'); rollback;" 2>&1)
echo "$out" | grep -qiE 'Podgląd|42501' \
  && { ok=$((ok+1)); echo "  OK    #557 PR2: assign Podgląd odmowa"; } \
  || { fail=$((fail+1)); echo "  FAIL  #557 PR2: assign Podgląd odmowa: $out"; }
# Assign OK: IN_TRANSIT_PL + przyszły rejs → pin S557a → FERRY → Port SE
# PORT_IN OFF + pozycja w porcie (jak L557b) — fikstury głośne (F7 r3).
L557h=55555555-0000-0000-0000-000000005581
q "update geofences set active = false
 where project_id = '$P' and kind = 'PORT_IN' and country = 'SE'
   and coalesce(route, 'POLFERRIES') = 'POLFERRIES'" >/dev/null
chk "#557 PR2: fikstura L557h load" \
  "insert into loads (id,project_id,carrier_org_id,order_no,hhl_order_no,carrier_order_no,status,sailing_id,plan_load_date,telematics_vehicle_id)
   values ('$L557h','$P','$SCXO','KSH/H557','HHL/H557','SCX/H557','IN_TRANSIT_PL','$S557b','2026-09-30','TEL-H557')
   returning (id is not null)" t
chk "#557 PR2: fikstura L557h MILESTONE + prev PL" \
  "insert into load_events (load_id, event_type, occurred_at) values ('$L557h','MILESTONE_LOADED','2026-10-09 08:00+00');
   insert into positions (load_id, ts, geom_raw, source) values
    ('$L557h', '2026-10-10 11:00+00', st_setsrid(st_makepoint(18.6800, 54.4030), 4326), 'TELEMATICS_API');
   select count(*) from load_events where load_id='$L557h' and event_type='MILESTONE_LOADED'" 1
pos $L557h 58.9350 17.9500 "2026-10-11 09:00+00"
chk "#557 PR2: mismatch przed assign" "$(rk $L557h SAILING_MISMATCH)" 1
q "begin; set local role authenticated; set local request.jwt.claim.sub='$HHL';
   select sailing_mismatch_assign('$L557h','$S557a'); commit" >/dev/null
chk "#557 PR2: assign → sailing S557a" \
  "select (sailing_id = '$S557a') from loads where id='$L557h'" t
chk "#557 PR2: assign → SAILING_ASSIGNED" \
  "select count(*) from load_events where load_id='$L557h' and event_type='SAILING_ASSIGNED'" 1
chk "#557 PR2: assign → audit" \
  "select count(*) from audit_log where action='SAILING_MISMATCH_ASSIGN' and entity_id='$L557h'" 1
chk "#557 PR2: assign → ryzyko zamknięte z resolved_by" \
  "select (resolved_at is not null and resolved_by is not null) from risk_signals
    where load_id='$L557h' and dedup_key like 'SAILING_MISMATCH:%' order by detected_at desc limit 1" t
chk "#557 PR2: assign → source AIS (actual_dep)" \
  "select payload->>'source' from load_events
    where load_id='$L557h' and event_type='STATUS_AUTO' and payload->>'to'='FERRY'
    order by occurred_at desc limit 1" AIS
chk "#557 PR2: assign IN_TRANSIT_PL → FERRY → Port SE" \
  "$(st $L557h)" AT_PORT_NYNASHAMN
# Pozycja SE po dopłynięciu (S557c) — ts po starym PL (09:00), po arrival (06:00)
pos $L557c 58.9350 17.9500 "2026-10-10 10:00+00"
chk "#557 PR2: pozycja SE po dopłynięciu bez stale" \
  "select coalesce(raw->>'stale_point','false') from positions
    where load_id='$L557c' and ts = '2026-10-10 10:00+00'" false

# --- #571 F7: SITE od 1. pozycji; dwell dla portu; parking poza promieniem; backdate ---
# L a1–a7 — nie 71–76 (#445/#502/#461: kolizja UUID → mk cicho, stary FERRY).
echo; echo "[#571] SITE 1 fix + dwell port + backdate"
L571a=$(L a1); L571b=$(L a2); L571c=$(L a3); L571d=$(L a4); L571e=$(L a5); L571f=$(L a6); L571g=$(L a7)
# #557 zostawiło POLFERRIES PORT_IN active=false — włącz przed dwell portu.
q "update geofences set active = true
 where project_id = '$P' and kind = 'PORT_IN' and country = 'SE'
   and coalesce(route, 'POLFERRIES') = 'POLFERRIES'" >/dev/null
G571p=$(q "select id from geofences where project_id='$P' and name='Port Nynäshamn' order by id limit 1")
# Plac testowy r=1010 m (jak Boden) — parking 1019 m poza; 779 m w środku
# Wyłącz Plac Stegra (r=1500, ten sam środek) — inaczej 2× SITE ENTER.
q "update geofences set active = false where project_id='$P' and name='Plac Stegra' and kind='SITE'" >/dev/null
q "insert into geofences (project_id, name, kind, geom, hysteresis_m, dwell_seconds, debounce_fixes, country, route)
   values ('$P','Plac 571 r1010','SITE', make_circle_fence(65.8054,21.7591,1010), 300, 600, 2,'SE', null)" >/dev/null
G571r=$(q "select id from geofences where project_id='$P' and name='Plac 571 r1010' order by id limit 1")
# ~779 m / ~1019 m na północ od środka (azymut 0)
LAT779=65.812401; LON779=21.759100
LAT1019=65.814554; LON1019=21.759100
mk $L571a 571a "'HHL/571a'" "'SCX/571a'" IN_TRANSIT_SE null
mk $L571b 571b "'HHL/571b'" "'SCX/571b'" IN_TRANSIT_SE null
mk $L571c 571c "'HHL/571c'" "'SCX/571c'" IN_TRANSIT_SE null
mk $L571d 571d "'HHL/571d'" "'SCX/571d'" IN_TRANSIT_SE null
mk $L571e 571e "'HHL/571e'" "'SCX/571e'" IN_TRANSIT_SE null
q "insert into load_events (load_id,event_type,occurred_at) values
 ('$L571a','MILESTONE_LOADED','2026-10-20 08:00+00'),
 ('$L571b','MILESTONE_LOADED','2026-10-20 08:00+00'),
 ('$L571c','MILESTONE_LOADED','2026-10-20 08:00+00'),
 ('$L571d','MILESTONE_LOADED','2026-10-20 08:00+00'),
 ('$L571e','MILESTONE_LOADED','2026-10-20 08:00+00')" >/dev/null
# (a) SITE: 1 pozycja 779 m przy r=1010 → ENTER + AT_SITE od razu
pos $L571a $LAT779 $LON779 "2026-10-26 10:22:00+00"
chk "#571a: 1 fix SITE 779 m → INSIDE" \
  "select state from geofence_states where load_id='$L571a' and geofence_id='$G571r'" INSIDE
chk "#571a: 1 fix SITE → ENTER" \
  "select count(*) from load_events where load_id='$L571a' and event_type='GEOFENCE_ENTER'
     and (payload->>'geofence_id')='$G571r'" 1
chk "#571a: status AT_SITE" "$(st $L571a)" AT_SITE
# (b) parking 1019 m / r=1010 — kilka pozycji przez > dwell; bez globalnego zerowania PENDING_IN
pos $L571b $LAT1019 $LON1019 "2026-10-26 11:00:00+00"
pos $L571b $LAT1019 $LON1019 "2026-10-26 11:05:00+00"
pos $L571b $LAT1019 $LON1019 "2026-10-26 11:12:00+00"
chk "#571b: parking poza r → brak ENTER" \
  "select count(*) from load_events where load_id='$L571b' and event_type='GEOFENCE_ENTER'
     and (payload->>'geofence_id')='$G571r'" 0
chk "#571b: parking → OUTSIDE (nie PENDING_IN)" \
  "select coalesce((select state from geofence_states where load_id='$L571b' and geofence_id='$G571r'),'OUTSIDE')" OUTSIDE
chk "#571b: parking + dwell cron → nadal 0" \
  "select geofence_confirm_pending_dwell('2026-10-26 11:20:00+00');
   select count(*) from load_events where load_id='$L571b' and event_type='GEOFENCE_ENTER'
     and (payload->>'geofence_id')='$G571r'" 0
# (c) stale_point w SITE → brak ENTER
q "select count(*) from process_position('$L571c', $LAT779, $LON779, '2026-10-26 12:00:00+00',
     'TELEMATICS_API', null, null, null, '{\"stale_point\":true}'::jsonb)" >/dev/null
chk "#571c: stale SITE → brak ENTER" \
  "select count(*) from load_events where load_id='$L571c' and event_type='GEOFENCE_ENTER'" 0
chk "#571c: stale → status bez AT_SITE" "$(st $L571c)" IN_TRANSIT_SE
# (d) port: 1 pozycja + dwell → ENTER (SITE pomijane w cron)
pos $L571d 58.9350 17.9500 "2026-10-26 13:00:00+00"
chk "#571d: 1 fix port → PENDING_IN" \
  "select state from geofence_states where load_id='$L571d' and geofence_id='$G571p'" PENDING_IN
chk "#571d: za wcześnie (5 min) → brak ENTER tego ładunku" \
  "select geofence_confirm_pending_dwell('2026-10-26 13:05:00+00');
   select count(*) from load_events where load_id='$L571d' and event_type='GEOFENCE_ENTER'" 0
chk "#571d: po 10 min → ENTER" \
  "select geofence_confirm_pending_dwell('2026-10-26 13:10:00+00');
   select count(*) from load_events where load_id='$L571d' and event_type='GEOFENCE_ENTER'" 1
chk "#571d: ENTER z czasem pierwszej" \
  "select to_char(occurred_at at time zone 'UTC','YYYY-MM-DD HH24:MI') from load_events
    where load_id='$L571d' and event_type='GEOFENCE_ENTER' order by occurred_at limit 1" "2026-10-26 13:00"
# (e) wyjście i ponowny wjazd SITE — ENTER×2, entered_at=nowy wjazd, bez 2. AT_SITE
# F7: EXIT < 10 min (bez auto DELIVERED) — inaczej okno śledzenia gaśnie i brak 2. ENTER.
# F7 #574-nast: filtr powiadomień = LOAD_STATUS_CHANGED + to=AT_SITE (nie template like '%AT_SITE%').
pos $L571e $LAT779 $LON779 "2026-10-26 14:00:00+00"
chk "#571e: pierwszy wjazd AT_SITE" "$(st $L571e)" AT_SITE
N571=$(q "select count(*) from load_events where load_id='$L571e' and event_type='STATUS_AUTO' and payload->>'to'='AT_SITE'")
N571n=$(q "select count(*) from notifications where load_id='$L571e' and template='LOAD_STATUS_CHANGED' and payload->>'to'='AT_SITE'")
chk "#571e: pierwszy wjazd dał LOAD_STATUS_CHANGED AT_SITE" \
  "select (count(*) >= 1)::text from notifications where load_id='$L571e' and template='LOAD_STATUS_CHANGED' and payload->>'to'='AT_SITE'" true
# poza SITE+histereza (nie tylko poza Bufor Boden); dwell ~5 min < 10
pos $L571e 65.90 22.10 "2026-10-26 14:03:00+00"
pos $L571e 65.91 22.12 "2026-10-26 14:05:00+00"
chk "#571e: po EXIT entered_at null" \
  "select (entered_at is null)::text from geofence_states where load_id='$L571e' and geofence_id='$G571r'" true
chk "#571e: EXIT < 10 min → bez DELIVERED" "$(st $L571e)" AT_SITE
pos $L571e $LAT779 $LON779 "2026-10-26 14:20:00+00"
chk "#571e: 2× GEOFENCE_ENTER" \
  "select count(*) from load_events where load_id='$L571e' and event_type='GEOFENCE_ENTER'
     and (payload->>'geofence_id')='$G571r'" 2
chk "#571e: entered_at = nowy wjazd" \
  "select to_char(entered_at at time zone 'UTC','YYYY-MM-DD HH24:MI') from geofence_states
    where load_id='$L571e' and geofence_id='$G571r'" "2026-10-26 14:20"
chk "#571e: ponowny wjazd bez 2. STATUS_AUTO AT_SITE" \
  "select count(*) from load_events where load_id='$L571e' and event_type='STATUS_AUTO' and payload->>'to'='AT_SITE'" "$N571"
chk "#571e: bez nowych powiadomień AT_SITE" \
  "select count(*) from notifications where load_id='$L571e' and template='LOAD_STATUS_CHANGED' and payload->>'to'='AT_SITE'" "$N571n"
# Funkcja usuwana na końcu 0309 — odtwórz na czas testu korekty (F7 r3).
$PSQL -f "$(git rev-parse --show-toplevel)/tests/db/sql/hotfix_571_site_enter_backdate.sql" >/dev/null
q "revoke all on function public.hotfix_571_site_enter_backdate() from public, anon, authenticated;
   grant execute on function public.hotfix_571_site_enter_backdate() to service_role" >/dev/null
# (f) backdate jak SG-23: order_no NULL, kod w shipment_items, ENTER z 2. pozycji → pierwsza
q "insert into loads (id,project_id,carrier_org_id,order_no,hhl_order_no,carrier_order_no,status,plan_load_date,telematics_vehicle_id)
   values ('$L571f','$P','$SCXO',null,'HHL/571f','SCX/571f','AT_SITE','2026-09-30','TEL-571f')" >/dev/null
q "insert into shipment_items (project_id, load_id, shipment_code, length_m, width_m, height_m)
   values ('$P','$L571f','SG-23',10,3,3)" >/dev/null
q "insert into load_events (load_id,event_type,occurred_at) values ('$L571f','MILESTONE_LOADED','2026-10-20 08:00+00')" >/dev/null
q "insert into positions (load_id, ts, geom_raw, source, raw) values
  ('$L571f','2026-10-26 10:22:00+00', st_setsrid(st_makepoint($LON779,$LAT779),4326),'TELEMATICS_API','{}'),
  ('$L571f','2026-10-26 11:21:00+00', st_setsrid(st_makepoint($LON779,$LAT779),4326),'TELEMATICS_API','{}')" >/dev/null
q "insert into geofence_states (load_id, geofence_id, state, consec_fixes, entered_at, last_eval_at)
   values ('$L571f','$G571r','INSIDE',0,'2026-10-26 11:21:00+00','2026-10-26 11:21:00+00')" >/dev/null
# replica: bez AFTER INSERT (notify/status); source = position_source (bez SYSTEM — enum)
q "set session_replication_role=replica;
   insert into load_events (load_id, event_type, occurred_at, source, geom, payload, dedup_key) values
  ('$L571f','GEOFENCE_ENTER','2026-10-26 11:21:00+00','TELEMATICS_API',
   st_setsrid(st_makepoint($LON779,$LAT779),4326),
   jsonb_build_object('geofence_id','$G571r','geofence_kind','SITE','geofence_name','Plac 571 r1010'),
   'GEOFENCE_ENTER:$L571f:$G571r:202610261121'),
  ('$L571f','STATUS_AUTO','2026-10-26 11:21:00+00',null,null,
   jsonb_build_object('to','AT_SITE','from','IN_TRANSIT_SE'),
   'STATUS_AUTO:AT_SITE:$L571f:202610261121');
   set session_replication_role=origin" >/dev/null
N571f=$(q "select count(*) from notifications where load_id='$L571f'")
q "select public.hotfix_571_site_enter_backdate()" >/dev/null
chk "#571f: ENTER backdate na 10:22" \
  "select to_char(occurred_at at time zone 'UTC','YYYY-MM-DD HH24:MI') from load_events
    where load_id='$L571f' and event_type='GEOFENCE_ENTER' order by id limit 1" "2026-10-26 10:22"
chk "#571f: STATUS_AUTO AT_SITE na 10:22" \
  "select to_char(occurred_at at time zone 'UTC','YYYY-MM-DD HH24:MI') from load_events
    where load_id='$L571f' and event_type='STATUS_AUTO' and payload->>'to'='AT_SITE'" "2026-10-26 10:22"
chk "#571f: entered_at 10:22" \
  "select to_char(entered_at at time zone 'UTC','YYYY-MM-DD HH24:MI') from geofence_states
    where load_id='$L571f' and geofence_id='$G571r'" "2026-10-26 10:22"
chk "#571f: 0 nowych powiadomień" \
  "select count(*) from notifications where load_id='$L571f'" "$N571f"
chk "#571f: trg_load_events_immutable włączony (O)" \
  "select tgenabled::text from pg_trigger where tgname='trg_load_events_immutable' limit 1" O
# idempotencja: drugie wywołanie nic nie zmienia
ENT571=$(q "select occurred_at::text from load_events where load_id='$L571f' and event_type='GEOFENCE_ENTER' order by id limit 1")
q "select public.hotfix_571_site_enter_backdate()" >/dev/null
chk "#571f: 2. wywołanie — ten sam ENTER" \
  "select occurred_at::text from load_events where load_id='$L571f' and event_type='GEOFENCE_ENTER' order by id limit 1" "$ENT571"
# (g) F7 r3: OUTSIDE po EXIT — korekta nie wraca na plac; EXIT bez zmian
q "insert into loads (id,project_id,carrier_org_id,order_no,hhl_order_no,carrier_order_no,status,plan_load_date,telematics_vehicle_id)
   values ('$L571g','$P','$SCXO',null,'HHL/571g','SCX/571g','IN_TRANSIT_SE','2026-09-30','TEL-571g')" >/dev/null
q "delete from shipment_items where shipment_code='SG-23' and load_id='$L571f'" >/dev/null
q "insert into shipment_items (project_id, load_id, shipment_code, length_m, width_m, height_m)
   values ('$P','$L571g','SG-23',10,3,3)" >/dev/null
q "insert into load_events (load_id,event_type,occurred_at) values ('$L571g','MILESTONE_LOADED','2026-10-20 08:00+00')" >/dev/null
q "insert into positions (load_id, ts, geom_raw, source, raw) values
  ('$L571g','2026-10-26 10:22:00+00', st_setsrid(st_makepoint($LON779,$LAT779),4326),'TELEMATICS_API','{}')" >/dev/null
q "insert into geofence_states (load_id, geofence_id, state, consec_fixes, entered_at, last_eval_at)
   values ('$L571g','$G571r','OUTSIDE',0,null,'2026-10-26 15:00:00+00')" >/dev/null
q "insert into load_events (load_id, event_type, occurred_at, source, geom, payload, dedup_key) values
  ('$L571g','GEOFENCE_ENTER','2026-10-26 11:21:00+00','TELEMATICS_API',
   st_setsrid(st_makepoint($LON779,$LAT779),4326),
   jsonb_build_object('geofence_id','$G571r','geofence_kind','SITE','geofence_name','Plac 571 r1010'),
   'GEOFENCE_ENTER:$L571g:$G571r:202610261121'),
  ('$L571g','GEOFENCE_EXIT','2026-10-26 15:00:00+00','TELEMATICS_API',
   st_setsrid(st_makepoint(22.10,65.90),4326),
   jsonb_build_object('geofence_id','$G571r','geofence_kind','SITE'),
   'GEOFENCE_EXIT:$L571g:$G571r:202610261500')" >/dev/null
N571x=$(q "select count(*) from load_events where load_id='$L571g' and event_type='GEOFENCE_EXIT'")
q "select public.hotfix_571_site_enter_backdate()" >/dev/null
chk "#571g: OUTSIDE bez zmiany stanu" \
  "select state from geofence_states where load_id='$L571g' and geofence_id='$G571r'" OUTSIDE
chk "#571g: liczba EXIT bez zmian" \
  "select count(*) from load_events where load_id='$L571g' and event_type='GEOFENCE_EXIT'" "$N571x"
chk "#571g: ENTER backdate (czas zdarzeń) na 10:22" \
  "select to_char(occurred_at at time zone 'UTC','YYYY-MM-DD HH24:MI') from load_events
    where load_id='$L571g' and event_type='GEOFENCE_ENTER' order by id limit 1" "2026-10-26 10:22"
q "drop function if exists public.hotfix_571_site_enter_backdate()" >/dev/null
q "update geofences set active = true where project_id='$P' and name='Plac Stegra' and kind='SITE'" >/dev/null
chk "#571: dwell tylko service_role" \
  "select has_function_privilege('authenticated', 'geofence_confirm_pending_dwell(timestamptz)', 'execute')" f

# --- #574-nast (F7 #582 r3): cron lower bound + DWELL per strefa + N1/N2 ---
# UUID b1–b6 — unikaj kolizji z a1–a7 (#571).
echo; echo "[#574-nast] cron lower bound + DWELL payload + N1/N2"
ROOT574=$(git rev-parse --show-toplevel)
MIG574="$ROOT574/supabase/migrations/0312_574_dwell_min_followup.sql"
REF574="$ROOT574/tests/db/sql/hotfix_574_dwell_recalc.sql"
EXT574=$(mktemp)
sed -n '/^-- BEGIN SG23$/,/^-- END SG23$/p' "$MIG574" | sed '1d;$d' > "$EXT574"
if diff -q "$REF574" "$EXT574" >/dev/null; then
  ok=$((ok+1)); echo "  OK    #574N1: blok BEGIN/END SG23 = hotfix_574_dwell_recalc.sql"
else
  fail=$((fail+1)); echo "  FAIL  #574N1: blok BEGIN/END SG23 ≠ hotfix_574_dwell_recalc.sql"
  diff -u "$REF574" "$EXT574" | head -40 || true
fi
rm -f "$EXT574"
L574h=$(L b1); L574i=$(L b2); L574k=$(L b4); L574m=$(L b5); L574n=$(L b6)
L574j='95ab7218-69cc-490d-8b68-b379c3ed9aae'
mk $L574h 574h "'HHL/574h'" "'SCX/574h'" IN_TRANSIT_SE null
mk $L574i 574i "'HHL/574i'" "'SCX/574i'" IN_TRANSIT_SE null
mk $L574k 574k "'HHL/574k'" "'SCX/574k'" IN_TRANSIT_SE null
mk $L574m 574m "'HHL/574m'" "'SCX/574m'" IN_TRANSIT_SE null
mk $L574n 574n "'HHL/574n'" "'SCX/574n'" DELIVERED null
q "update loads set actual_delivery_at='2026-10-05 12:00:00+00' where id='$L574n'" >/dev/null
q "insert into load_events (load_id,event_type,occurred_at) values
 ('$L574h','MILESTONE_LOADED','2026-10-20 08:00+00'),
 ('$L574i','MILESTONE_LOADED','2026-10-20 08:00+00'),
 ('$L574k','MILESTONE_LOADED','2026-10-20 08:00+00'),
 ('$L574m','MILESTONE_LOADED','2026-10-20 08:00+00'),
 ('$L574n','MILESTONE_LOADED','2026-09-20 08:00+00')" >/dev/null
# (h) F7 pkt 4: pos 09:00 w → 09:05 poza → 16:00 w; bez ręcznego UPDATE entered_at
pos $L574h 58.9350 17.9500 "2026-10-26 09:00:00+00"
pos $L574h 58.9600 17.9500 "2026-10-26 09:05:00+00"
pos $L574h 58.9350 17.9500 "2026-10-26 16:00:00+00"
chk "#574h: 2. wizyta → PENDING_IN" \
  "select state from geofence_states where load_id='$L574h' and geofence_id='$G571p'" PENDING_IN
chk "#574h: entered_at z process_position = 16:00" \
  "select to_char(entered_at at time zone 'UTC','YYYY-MM-DD HH24:MI') from geofence_states
    where load_id='$L574h' and geofence_id='$G571p'" "2026-10-26 16:00"
chk "#574h: cron po dwell → ENTER z 16:00 (nie 09:00)" \
  "select geofence_confirm_pending_dwell('2026-10-26 16:15:00+00');
   select to_char(occurred_at at time zone 'UTC','YYYY-MM-DD HH24:MI') from load_events
    where load_id='$L574h' and event_type='GEOFENCE_ENTER' and (payload->>'geofence_id')='$G571p'
    order by occurred_at desc limit 1" "2026-10-26 16:00"
# (h2) F7 r3 N2: consec_fixes=0, bez UPDATE; surowa poz. 11:30 (przed EXIT) + 13:00
q "insert into load_events (load_id,event_type,occurred_at,source,geom,payload,dedup_key) values
  ('$L574k','GEOFENCE_EXIT','2026-10-26 12:00:00+00','TELEMATICS_API',
   st_setsrid(st_makepoint(17.90,58.90),4326),
   jsonb_build_object('geofence_id','$G571p','geofence_kind','PORT_IN'),
   'GEOFENCE_EXIT:$L574k:$G571p:202610261200')" >/dev/null
q "insert into geofence_states (load_id,geofence_id,state,consec_fixes,entered_at,last_eval_at)
   values ('$L574k','$G571p','PENDING_IN',0,'2026-10-26 11:00:00+00','2026-10-26 13:00:00+00')
   on conflict (load_id, geofence_id) do update
     set state='PENDING_IN', consec_fixes=0, entered_at='2026-10-26 11:00:00+00',
         last_eval_at='2026-10-26 13:00:00+00'" >/dev/null
q "insert into positions (load_id, ts, geom_raw, source, raw) values
  ('$L574k','2026-10-26 11:30:00+00', st_setsrid(st_makepoint(17.9500,58.9350),4326),'TELEMATICS_API','{}'),
  ('$L574k','2026-10-26 13:00:00+00', st_setsrid(st_makepoint(17.9500,58.9350),4326),'TELEMATICS_API','{}')" >/dev/null
chk "#574h2: cron EXIT>entered_at → 1" \
  "select geofence_confirm_pending_dwell('2026-10-26 13:15:00+00')" 1
chk "#574h2: dokładnie 1 ENTER" \
  "select count(*) from load_events where load_id='$L574k' and event_type='GEOFENCE_ENTER'
     and (payload->>'geofence_id')='$G571p'" 1
chk "#574h2: ENTER z 13:00 (nie 11:30)" \
  "select to_char(occurred_at at time zone 'UTC','YYYY-MM-DD HH24:MI') from load_events
    where load_id='$L574k' and event_type='GEOFENCE_ENTER' and (payload->>'geofence_id')='$G571p'
    order by occurred_at desc limit 1" "2026-10-26 13:00"
# (i) bulk_quiet ≥ 2 h: ENTER bez nowych powiadomień strefy
pos $L574i 58.9350 17.9500 "2026-10-26 08:00:00+00"
N574i=$(q "select count(*) from notifications where load_id='$L574i'")
chk "#574i: cron stale >2h → ENTER" \
  "select geofence_confirm_pending_dwell('2026-10-26 10:30:00+00');
   select count(*) from load_events where load_id='$L574i' and event_type='GEOFENCE_ENTER'
     and (payload->>'geofence_id')='$G571p'" 1
chk "#574i: bulk_quiet — bez nowych powiadomień" \
  "select count(*) from notifications where load_id='$L574i'" "$N574i"
# (i2) kontrola: bez bulk_quiet (<2 h) → ZONE_ENTER przychodzi
pos $L574m 58.9350 17.9500 "2026-10-26 14:00:00+00"
N574m=$(q "select count(*) from notifications where load_id='$L574m' and template='ZONE_ENTER'")
chk "#574i2: cron fresh <2h → ENTER" \
  "select geofence_confirm_pending_dwell('2026-10-26 14:15:00+00');
   select count(*) from load_events where load_id='$L574m' and event_type='GEOFENCE_ENTER'
     and (payload->>'geofence_id')='$G571p'" 1
chk "#574i2: bez bulk_quiet — ZONE_ENTER > 0" \
  "select (count(*) > $N574m)::text from notifications where load_id='$L574m' and template='ZONE_ENTER'" true
# (N2) zakończony: PENDING_IN + entered_at NULL — cron pomija; wspólny SQL → OUTSIDE
q "insert into geofence_states (load_id,geofence_id,state,consec_fixes,entered_at,last_eval_at)
   values ('$L574n','$G571p','PENDING_IN',0,null,'2026-10-01 08:00:00+00')
   on conflict (load_id, geofence_id) do update
     set state='PENDING_IN', entered_at=null, last_eval_at='2026-10-01 08:00:00+00'" >/dev/null
q "insert into positions (load_id, ts, geom_raw, source, raw) values
  ('$L574n','2026-09-28 10:00:00+00', st_setsrid(st_makepoint(17.9500,58.9350),4326),'TELEMATICS_API','{}')" >/dev/null
chk "#574N2: cron pomija DELIVERED → 0 ENTER" \
  "select geofence_confirm_pending_dwell('2026-10-26 12:00:00+00');
   select count(*) from load_events where load_id='$L574n' and event_type='GEOFENCE_ENTER'" 0
$PSQL -f "$REF574" >/dev/null
q "revoke all on function public.hotfix_574_dwell_recalc() from public, anon, authenticated;
   grant execute on function public.hotfix_574_dwell_recalc() to service_role" >/dev/null
chk "#574N2: wspólny SQL zamyka PENDING_IN NULL → OUTSIDE" \
  "select state from geofence_states where load_id='$L574n' and geofence_id='$G571p'" OUTSIDE
# (j) DWELL per geofence_id — pinned SG-23 UUID; dwie strefy SITE
q "insert into geofences (project_id, name, kind, geom, hysteresis_m, dwell_seconds, debounce_fixes, country, route)
   values ('$P','Plac 574 LOADING','SITE', make_circle_fence(52.0833,17.0167,500), 100, 600, 2,'PL', null)" >/dev/null
G574s=$(q "select id from geofences where project_id='$P' and name='Plac 574 LOADING' order by id limit 1")
q "delete from shipment_items where shipment_code='SG-23'" >/dev/null
q "delete from shipment_items where load_id='$L574j'" >/dev/null
q "delete from loads where id='$L574j'" >/dev/null
q "insert into loads (id,project_id,carrier_org_id,order_no,hhl_order_no,carrier_order_no,status,plan_load_date,telematics_vehicle_id)
   values ('$L574j','$P','$SCXO',null,'HHL/574j','SCX/574j','AT_SITE','2026-09-30','TEL-574j')" >/dev/null
q "insert into shipment_items (project_id, load_id, shipment_code, length_m, width_m, height_m)
   values ('$P','$L574j','SG-23',10,3,3)" >/dev/null
q "insert into load_events (load_id,event_type,occurred_at) values ('$L574j','MILESTONE_LOADED','2026-10-20 08:00+00')" >/dev/null
q "set session_replication_role=replica;
   insert into load_events (load_id, event_type, occurred_at, source, geom, payload, dedup_key) values
  ('$L574j','GEOFENCE_ENTER','2026-10-21 07:55:00+00','TELEMATICS_API',
   st_setsrid(st_makepoint(17.0167,52.0833),4326),
   jsonb_build_object('geofence_id','$G574s','geofence_kind','SITE','geofence_name','Plac 574 LOADING'),
   'GEOFENCE_ENTER:$L574j:$G574s:202610210755'),
  ('$L574j','GEOFENCE_DWELL','2026-10-21 08:05:00+00','TELEMATICS_API',
   st_setsrid(st_makepoint(17.0167,52.0833),4326),
   jsonb_build_object('geofence_id','$G574s','geofence_kind','SITE','geofence_name','Plac 574 LOADING',
     'entered_at','2026-10-21 07:55:00+00','dwell_min',99,'minutes',99),
   'GEOFENCE_DWELL:$L574j:$G574s:202610210805'),
  ('$L574j','GEOFENCE_ENTER','2026-10-26 10:22:00+00','TELEMATICS_API',
   st_setsrid(st_makepoint($LON779,$LAT779),4326),
   jsonb_build_object('geofence_id','$G571r','geofence_kind','SITE','geofence_name','Plac 571'),
   'GEOFENCE_ENTER:$L574j:$G571r:202610261022'),
  ('$L574j','GEOFENCE_DWELL','2026-10-26 11:50:00+00','TELEMATICS_API',
   st_setsrid(st_makepoint($LON779,$LAT779),4326),
   jsonb_build_object('geofence_id','$G571r','geofence_kind','SITE','geofence_name','Plac 571',
     'entered_at','2026-10-26 11:21:00+00','dwell_min',29,'minutes',29),
   'GEOFENCE_DWELL:$L574j:$G571r:202610261150');
   set session_replication_role=origin" >/dev/null
q "select public.hotfix_574_dwell_recalc()" >/dev/null
chk "#574j: DWELL SITE Boden dwell_min ≈ 88" \
  "select (payload->>'dwell_min')::int from load_events
    where load_id='$L574j' and event_type='GEOFENCE_DWELL'
      and (payload->>'geofence_id')='$G571r'" 88
chk "#574j: DWELL SITE Boden entered_at = 10:22" \
  "select to_char((payload->>'entered_at')::timestamptz at time zone 'UTC','YYYY-MM-DD HH24:MI')
    from load_events where load_id='$L574j' and event_type='GEOFENCE_DWELL'
      and (payload->>'geofence_id')='$G571r'" "2026-10-26 10:22"
chk "#574j: DWELL LOADING dwell_min ≈ 10 (nie od Boden)" \
  "select (payload->>'dwell_min')::int from load_events
    where load_id='$L574j' and event_type='GEOFENCE_DWELL'
      and (payload->>'geofence_id')='$G574s'" 10
D574j=$(q "select payload->>'dwell_min' from load_events where load_id='$L574j' and event_type='GEOFENCE_DWELL' and (payload->>'geofence_id')='$G571r'")
q "select public.hotfix_574_dwell_recalc()" >/dev/null
chk "#574j: 2. uruchomienie — ten sam dwell_min Boden" \
  "select payload->>'dwell_min' from load_events where load_id='$L574j' and event_type='GEOFENCE_DWELL'
     and (payload->>'geofence_id')='$G571r'" "$D574j"
chk "#574j: trg_load_events_immutable włączony (O)" \
  "select tgenabled::text from pg_trigger where tgname='trg_load_events_immutable' limit 1" O
q "drop function if exists public.hotfix_574_dwell_recalc()" >/dev/null

# #613 F7 r1: hotfix_613_apply — CI bez BS-01 = no-op; fikstura BS-B → BS-A + wycena.
# Funkcja dropnięta w migracji — odtwarzamy z BEGIN/END HOTFIX613 (jak #574 SG23).
echo; echo "[#613] hotfix_613_apply BS-01 wymiary → BS-A"
ROOT613=$(git rev-parse --show-toplevel)
MIG613="$ROOT613/supabase/migrations/0324_hotfix_613_bs01_dims.sql"
EXT613=$(mktemp)
sed -n '/^-- BEGIN HOTFIX613$/,/^-- END HOTFIX613$/p' "$MIG613" | sed '1d;$d' > "$EXT613"
$PSQL -f "$EXT613" >/dev/null
q "revoke all on function public.hotfix_613_apply() from public, anon, authenticated;
   grant execute on function public.hotfix_613_apply() to service_role" >/dev/null
rm -f "$EXT613"
L613=55555555-0000-0000-0000-000000006131
RC613C=44444444-0000-0000-0000-0000000613c1
RC613R=44444444-0000-0000-0000-0000000613c2
q "
delete from audit_log where action like 'HOTFIX_613%';
delete from load_events where load_id = '$L613';
delete from load_revenue where load_id = '$L613';
delete from load_cost where load_id = '$L613';
delete from shipment_items where shipment_code = 'BS-01' and project_id = '$P';
delete from loads where id = '$L613';
delete from rate_rules where rate_card_id in ('$RC613C','$RC613R');
delete from rate_cards where id in ('$RC613C','$RC613R');
insert into rate_cards (id, project_id, side, org_id, currency, valid_from, version, note) values
 ('$RC613C','$P','COST','$SCXO','EUR','2026-10-29',99,'#613 test'),
 ('$RC613R','$P','REVENUE','$KSHO','EUR','2026-10-29',99,'#613 test');
insert into rate_rules (rate_card_id, cargo_class, symbol, family, convoy_cars,
  length_from, length_to, width_from, width_to, height_from, height_to, weight_from, weight_to, base_rate)
 values
 ('$RC613C','SYMBOL','BS-A','BS',null,0,12.50,0,2.45,0,1.30,0,23.0,5090.00),
 ('$RC613C','SYMBOL','BS-B','BS',null,0,14.95,0,2.45,0,1.80,0,31.1,6030.00),
 ('$RC613R','SYMBOL','BS-A','BS',null,0,12.50,0,2.45,0,1.30,0,23.0,5345.00),
 ('$RC613R','SYMBOL','BS-B','BS',null,0,14.95,0,2.45,0,1.80,0,31.1,6332.00);
insert into loads (id, project_id, carrier_org_id, order_no, hhl_order_no, carrier_order_no,
  status, plan_load_date, symbol, combo_length_m, combo_width_m, combo_height_m) values
 ('$L613','$P','$SCXO','KSH/BS01','HHL/BS01','SCX/BS01','RESOURCES_PENDING','2026-10-30',
  'BS-B',18.19,2.45,3.10);
insert into shipment_items (project_id, load_id, shipment_code, cargo_class,
  length_m, width_m, height_m, qty, unit_weight_t, total_weight_t) values
 ('$P','$L613','BS-01','DIMENSIONED',14.95,2.45,1.80,2,15.510,31.020);
insert into load_revenue (load_id, base_amount, baf_amount, extras_amount, computed_total_eur,
  fuel_status, fuel_ref_date, fuel_applied_mult, fuel_mult_sek, fuel_mult_pln) values
 ('$L613',6332.00,886.48,0,7218.48,'OSTATECZNY','2026-10-30',1.14,1.14,1.14);
insert into load_cost (load_id, base_amount, baf_amount, extras_amount, computed_total_eur,
  fuel_status, fuel_ref_date, fuel_applied_mult, fuel_mult_sek, fuel_mult_pln) values
 ('$L613',6030.00,844.20,0,6874.20,'OSTATECZNY','2026-10-30',1.14,1.14,1.14);
" >/dev/null
N613oth=$(q "select coalesce(sum(total_weight_t),0)::text from shipment_items where project_id='$P' and shipment_code is distinct from 'BS-01'")
N613bell=$(q "select count(*) from notifications")
N613out=$(q "select count(*) from ksh_sync_outbound where load_id='$L613'")
chk "#613: przed hotfixem symbol BS-B" \
  "select symbol from loads where id='$L613'" BS-B
chk "#613: przed — przychód BS-B 6332" \
  "select base_amount::text from load_revenue where load_id='$L613'" "6332.00"
N613=$(q "select public.hotfix_613_apply()")
chk "#613: hotfix_613_apply → n_fix=1" "select ($N613 = 1)" t
chk "#613: wymiary 11,95×2,45×1,30 / 21,37 t" \
  "select format('%s/%s/%s/%s', length_m, width_m, height_m, round(total_weight_t, 2)) from shipment_items where load_id='$L613'" \
  "11.95/2.45/1.30/21.37"
chk "#613: qty=2 unit_weight 10.685" \
  "select format('%s/%s', qty, unit_weight_t) from shipment_items where load_id='$L613'" "2/10.685"
chk "#613: symbol BS-A" "select symbol from loads where id='$L613'" BS-A
chk "#613: combo BS-A 18.19/2.45/2.60" \
  "select format('%s/%s/%s', combo_length_m, combo_width_m, combo_height_m) from loads where id='$L613'" \
  "18.19/2.45/2.60"
chk "#613: przychód 5345 / BAF 748.30 / 6093.30" \
  "select format('%s/%s/%s', base_amount, baf_amount, total_amount) from load_revenue where load_id='$L613'" \
  "5345.00/748.30/6093.30"
chk "#613: koszt 5090 / BAF 712.60 / 5802.60" \
  "select format('%s/%s/%s', base_amount, baf_amount, total_amount) from load_cost where load_id='$L613'" \
  "5090.00/712.60/5802.60"
chk "#613: audit HOTFIX_613_* ≥3" \
  "select (count(*) filter (where action like 'HOTFIX_613%') >= 3) from audit_log" t
chk "#613: NOTE publiczna bez revenue|cost" \
  "select count(*) from load_events where load_id='$L613' and event_type='NOTE'
     and visible_to is null and (payload->>'hotfix')='0324'
     and payload::text !~ 'revenue|cost'" 1
chk "#613: NOTE koszt FORWARDER+CARRIER" \
  "select count(*) from load_events where load_id='$L613' and event_type='NOTE'
     and visible_to = array['FORWARDER','CARRIER']::org_kind[]
     and (payload->>'kind')='cost'" 1
chk "#613: inne transporty bez zmian (suma wag)" \
  "select coalesce(sum(total_weight_t),0)::text from shipment_items where project_id='$P' and shipment_code is distinct from 'BS-01'" \
  "$N613oth"
chk "#613: 0 nowych notifications" \
  "select (count(*) = $N613bell)::text from notifications" true
chk "#613: 0 nowych ksh_sync_outbound" \
  "select (count(*) = $N613out)::text from ksh_sync_outbound where load_id='$L613'" true
q "select public.hotfix_613_apply()" >/dev/null
chk "#613: ponowne wywołanie idempotentne (n_fix=0)" \
  "select public.hotfix_613_apply()" 0
# Strażnik: inne wymiary → 0, bez zmian, HOTFIX_613_SKIPPED
q "
delete from audit_log where action = 'HOTFIX_613_SKIPPED' and entity_id = '$L613';
update shipment_items set length_m=10.00, width_m=2.00, height_m=1.00, qty=2, unit_weight_t=10, total_weight_t=20.00
 where load_id='$L613';
update loads set symbol='BS-B', combo_height_m=3.10 where id='$L613';
" >/dev/null
chk "#613: inne wymiary → n_fix=0" "select public.hotfix_613_apply()" 0
chk "#613: inne wymiary — bez zmiany (10/2/1/20)" \
  "select format('%s/%s/%s/%s', length_m, width_m, height_m, round(total_weight_t,0)) from shipment_items where load_id='$L613'" \
  "10.00/2.00/1.00/20"
chk "#613: inne wymiary → HOTFIX_613_SKIPPED" \
  "select count(*) from audit_log where action='HOTFIX_613_SKIPPED' and entity_id='$L613'" 1
q "drop function if exists public.hotfix_613_apply()" >/dev/null

# --- #622 F7: tokeny naczepy + reclaim + EMTRACK_ORPHAN (fikcyjne tablice ≥5+cyfra) ---
# UUID c2/c3 — nie 62/63 (SG8 L14 / Lfut D-1501). mk() jak reszta status.sh.
echo; echo "[#622] emtrack trailer tokens / orphan reclaim"
L622=$(L c2)
mk $L622 622 "'HHL/622'" "'SCX/622'" IN_TRANSIT_SE null
q "
update loads set
  telematics_vehicle_id = 'https://emtrack.eu/app/',
  trailer_plate = 'AA 11 AA - BB 22 BB',
  tracking_opened_at = public.tracking_window_start(plan_load_date)
 where id = '$L622';
insert into shipment_items (project_id, load_id, shipment_code, length_m, width_m, height_m)
values ('$P','$L622','T-622',10,3,3);
insert into load_events (load_id, event_type, occurred_at)
values ('$L622','MILESTONE_LOADED','2026-10-20 08:00+00');
" >/dev/null
chk "#622: load istnieje" "select count(*) from loads where id='$L622' and telematics_vehicle_id ~* 'emtrack'" 1
chk "#622: tokeny WT dwuczłonowe" \
  "select array_to_string(public.telm_plate_tokens('AA 11 AA - BB 22 BB'), ',')" "AA11AA,BB22BB"
chk "#622: B1 textId ze spacją = pełna równość" \
  "select public.telm_trailer_tokens_match('AA 11 AA - BB 22 BB','AA 11 AA BB 22 BB')" t
chk "#622: match textId=primary (SG-21)" \
  "select public.telm_trailer_tokens_match('AA 11 AA - BB 22 BB','AA11AA')" t
chk "#622: match textId z dwoma vs WT z jednym" \
  "select public.telm_trailer_tokens_match('AA11AA','AA11AA - BB22BB')" t
chk "#622: B2 myślnik bez spacji nie tnie" \
  "select array_to_string(public.telm_plate_tokens('HH-AB 123'), ',')" "HHAB123"
chk "#622: brak fałszywego dopasowania / fragment" \
  "select public.telm_trailer_tokens_match('AA11AA','AA11')::text||'/'||public.telm_trailer_tokens_match('AA11AA','ZZ99ZZ')::text" "false/false"
chk "#622: spacje w jednym nr nie rozbijają" \
  "select array_to_string(public.telm_plate_tokens('AA 11 AA'), ',')" "AA11AA"
# additional (3) vs primary (2) na tym samym WT; 'BB 22 BB'≡'BB22BB' to pełna równość (1), nie primary
chk "#622: ranking primary vs additional" \
  "select public.telm_trailer_match_rank('AA 11 AA - BB 22 BB','BB22BB')::text||'/'||public.telm_trailer_match_rank('AA 11 AA - BB 22 BB','AA11AA')::text" "3/2"
# F7 r2 B1-bis: WT bez tokenu z samych cyfr; EM bez środkowego fragmentu
chk "#622: B1-bis WT bez cyfr-only" \
  "select array_to_string(public.telm_plate_tokens('XX 12345'), ',')" "XX12345"
chk "#622: B1-bis EM prefiks od 1. frag" \
  "select array_to_string(public.telm_plate_tokens_em('YY 12345'), ',')" "YY12345"
chk "#622: B1-bis XX≠YY te same cyfry" \
  "select public.telm_trailer_tokens_match('XX 12345','YY 12345')" f
chk "#622: B1-bis primary członu przy dwóch" \
  "select public.telm_trailer_match_rank('XX 12345 - ZZ1 2345','XX 12345')" 2
chk "#622: B1-bis A-B vs A B = pełna równość" \
  "select public.telm_trailer_match_rank('A - B','A B')" 1
# F7 r3: upper przed [^A-Z0-9] (sync: tests/fixtures/trailerMatchCases.json)
chk "#622: F7 r3 lower xx≠yy" \
  "select public.telm_trailer_tokens_match('xx 12345','yy 12345')" f
chk "#622: F7 r3 lower ab→AB12345" \
  "select array_to_string(public.telm_plate_tokens('ab 12345'), ',')" "AB12345"
chk "#622: shared lower rank null" \
  "select coalesce(public.telm_trailer_match_rank('xx 12345','yy 12345')::text,'∅')" "∅"
chk "#622: shared lower full rank1" \
  "select public.telm_trailer_match_rank('ab 12345','AB12345')" 1
chk "#622: shared XX≠YY" \
  "select coalesce(public.telm_trailer_match_rank('XX 12345','YY 12345')::text,'∅')" "∅"
chk "#622: shared primary 2" \
  "select public.telm_trailer_match_rank('XX 12345 - ZZ1 2345','XX 12345')" 2
chk "#622: shared A-B=1" \
  "select public.telm_trailer_match_rank('A - B','A B')" 1
chk "#622: shared additional 3" \
  "select public.telm_trailer_match_rank('AA 11 AA - BB 22 BB','BB22BB')" 3
chk "#622: shared primary AA 2" \
  "select public.telm_trailer_match_rank('AA 11 AA - BB 22 BB','AA11AA')" 2
chk "#622: shared full space 1" \
  "select public.telm_trailer_match_rank('AA 11 AA - BB 22 BB','AA 11 AA BB 22 BB')" 1
chk "#622: shared HHXX≠HH-AB" \
  "select coalesce(public.telm_trailer_match_rank('HHXX01','HH-AB 123')::text,'∅')" "∅"
# Sierota: plate = primary (jak po zmianie nazwy w emtrack); raw.textId też.
# Pozycje z dala od SITE (żeby reclaim nie zamykał okna).
q "
select public.telm_save_orphan_position(
  'AA11AA', '999001', 58.90, 17.90, '2026-10-27 12:00:00+00'::timestamptz,
  'EMTRACK_WEB', 40, 10, true,
  jsonb_build_object('textId','AA11AA','provider','EMTRACK_WEB'));
select public.telm_save_orphan_position(
  'AA11AA', '999001', 58.91, 17.91, '2026-10-27 12:10:00+00'::timestamptz,
  'EMTRACK_WEB', 35, 12, true,
  jsonb_build_object('textId','AA11AA','provider','EMTRACK_WEB'));
" >/dev/null
chk "#622: reclaim ok + 2" \
  "select coalesce(j->>'ok','?')||'|'||coalesce(j->>'reclaimed', j->>'error', '?') from (select public.telm_reclaim_orphan_positions('$L622'::uuid, '2026-10-27 00:00:00+00'::timestamptz) j) s" "true|2"
chk "#622: positions po reclaim" "select count(*) from positions where load_id='$L622' and source='EMTRACK_WEB'" 2
chk "#622: sieroty skasowane" "select count(*) from telematics_orphan_positions where plate='AA11AA'" 0
chk "#622: reclaim idempotentne (0)" \
  "select coalesce(public.telm_reclaim_orphan_positions('$L622'::uuid, '2026-10-27 00:00:00+00'::timestamptz)->>'reclaimed','?')" 0
# Alarm: inny load bez pozycji, sierota z tokenem
L622b=$(L c3)
mk $L622b 622b "'HHL/622b'" "'SCX/622b'" IN_TRANSIT_SE null
q "
update loads set
  telematics_vehicle_id = 'https://emtrack.eu/app/',
  trailer_plate = 'CC 33 CC',
  tracking_opened_at = public.tracking_window_start(plan_load_date)
 where id = '$L622b';
insert into shipment_items (project_id, load_id, shipment_code, length_m, width_m, height_m)
values ('$P','$L622b','T-622B',10,3,3);
select public.telm_save_orphan_position(
  'CC33CC', '999002', 60.1, 18.1, (now() - interval '30 minutes'),
  'EMTRACK_WEB', 10, 0, true, jsonb_build_object('textId','CC33CC'));
" >/dev/null
chk "#622: scan orphan alert ≥1" "select (public.telm_scan_orphan_trailer_alerts(now()) >= 1)" t
chk "#622: ryzyko EMTRACK_ORPHAN dedup" \
  "select count(*) from risk_signals where load_id='$L622b' and dedup_key='EMTRACK_ORPHAN:$L622b' and resolved_at is null" 1
q "select public.telm_scan_orphan_trailer_alerts(now())" >/dev/null
chk "#622: ponowny scan nie duplikuje" \
  "select count(*) from risk_signals where load_id='$L622b' and dedup_key='EMTRACK_ORPHAN:$L622b' and resolved_at is null" 1
# P4: świeża pozycja zamyka alarm
q "
select public.process_position(
  '$L622b'::uuid, 60.2, 18.2, now(), 'EMTRACK_WEB'::position_source,
  10, 0, true, '{}'::jsonb);
select public.telm_scan_orphan_trailer_alerts(now());
" >/dev/null
chk "#622: P4 alarm zamknięty po GPS" \
  "select count(*) from risk_signals where load_id='$L622b' and dedup_key='EMTRACK_ORPHAN:$L622b' and resolved_at is null" 0
# F7 r2 P4-bis: reclaim=0 nie zamyka alarmu
L622c=$(L c4)
mk $L622c 622c "'HHL/622c'" "'SCX/622c'" IN_TRANSIT_SE null
q "
update loads set
  telematics_vehicle_id = 'https://emtrack.eu/app/',
  trailer_plate = 'DD 44 DD',
  tracking_opened_at = public.tracking_window_start(plan_load_date)
 where id = '$L622c';
insert into shipment_items (project_id, load_id, shipment_code, length_m, width_m, height_m)
values ('$P','$L622c','T-622C',10,3,3);
select public.telm_save_orphan_position(
  'DD44DD', '999003', 61.1, 19.1, (now() - interval '40 minutes'),
  'EMTRACK_WEB', 10, 0, true, jsonb_build_object('textId','DD44DD'));
select public.telm_scan_orphan_trailer_alerts(now());
" >/dev/null
chk "#622: P4-bis alarm otwarty przed reclaim0" \
  "select count(*) from risk_signals where load_id='$L622c' and dedup_key='EMTRACK_ORPHAN:$L622c' and resolved_at is null" 1
chk "#622: P4-bis reclaim0 nie zamyka" \
  "select (public.telm_reclaim_orphan_positions('$L622c'::uuid, '2099-01-01'::timestamptz)->>'reclaimed')||'|'||(select count(*)::text from risk_signals where load_id='$L622c' and dedup_key='EMTRACK_ORPHAN:$L622c' and resolved_at is null)" "0|1"
# F7 r2 P3-bis: insert-only gdy sierota starsza niż ostatnia pozycja; bez podwójnego geofence
L622d=$(L c5)
mk $L622d 622d "'HHL/622d'" "'SCX/622d'" IN_TRANSIT_SE null
q "
update loads set
  telematics_vehicle_id = 'https://emtrack.eu/app/',
  trailer_plate = 'EE 55 EE',
  tracking_opened_at = public.tracking_window_start(plan_load_date)
 where id = '$L622d';
insert into shipment_items (project_id, load_id, shipment_code, length_m, width_m, height_m)
values ('$P','$L622d','T-622D',10,3,3);
select public.process_position(
  '$L622d'::uuid, 59.0, 18.0, '2026-10-27 14:00:00+00'::timestamptz,
  'EMTRACK_WEB'::position_source, 20, 0, true, '{}'::jsonb);
select public.telm_save_orphan_position(
  'EE55EE', '999004', 58.95, 17.95, '2026-10-27 13:00:00+00'::timestamptz,
  'EMTRACK_WEB', 15, 0, true, jsonb_build_object('textId','EE55EE'));
" >/dev/null
chk "#622: P3-bis reclaim insert-only bez refresh (nowszy już jest)" \
  "select coalesce(j->>'ok','?')||'|'||coalesce(j->>'reclaimed','?')||'|'||coalesce(j->>'refresh','?') from (select public.telm_reclaim_orphan_positions('$L622d'::uuid, '2026-10-27 00:00:00+00'::timestamptz) j) s" "true|1|false"
chk "#622: P3-bis pozycje 2 (stara+nowa)" \
  "select count(*) from positions where load_id='$L622d' and source='EMTRACK_WEB'" 2
# F7 r2: remis w reclaim (dwa WT z tym samym tokenem dodatkowym) → skip
L622e=$(L c6)
L622f=$(L c7)
mk $L622e 622e "'HHL/622e'" "'SCX/622e'" IN_TRANSIT_SE null
mk $L622f 622f "'HHL/622f'" "'SCX/622f'" IN_TRANSIT_SE null
q "
update loads set
  telematics_vehicle_id = 'https://emtrack.eu/app/',
  trailer_plate = 'FF 11 FF - GG 22 GG',
  tracking_opened_at = public.tracking_window_start(plan_load_date)
 where id = '$L622e';
update loads set
  telematics_vehicle_id = 'https://emtrack.eu/app/',
  trailer_plate = 'HH 33 HH - GG 22 GG',
  tracking_opened_at = public.tracking_window_start(plan_load_date)
 where id = '$L622f';
select public.telm_save_orphan_position(
  'GG22GG', '999005', 57.5, 16.5, '2026-10-27 15:00:00+00'::timestamptz,
  'EMTRACK_WEB', 10, 0, true, jsonb_build_object('textId','GG22GG'));
" >/dev/null
chk "#622: remis reclaim → 0" \
  "select public.telm_reclaim_orphan_positions('$L622e'::uuid, '2026-10-27 00:00:00+00'::timestamptz)->>'reclaimed'" 0
chk "#622: remis sierota zostaje" \
  "select count(*) from telematics_orphan_positions where plate='GG22GG'" 1
# F7 r3: refresh=true przy reclaim insert-only po dostawie (faza/ETA pomijane; flaga w JSON)
L622g=$(L c8)
mk $L622g 622g "'HHL/622g'" "'SCX/622g'" DELIVERED null
q "
update loads set
  telematics_vehicle_id = 'https://emtrack.eu/app/',
  trailer_plate = 'JJ 66 JJ',
  tracking_opened_at = '2026-10-20 00:00:00+00'::timestamptz,
  actual_delivery_at = '2026-10-28 12:00:00+00'::timestamptz
 where id = '$L622g';
insert into shipment_items (project_id, load_id, shipment_code, length_m, width_m, height_m)
values ('$P','$L622g','T-622G',10,3,3);
select public.telm_save_orphan_position(
  'JJ66JJ', '999006', 58.9, 17.9, '2026-10-27 16:00:00+00'::timestamptz,
  'EMTRACK_WEB', 10, 0, true, jsonb_build_object('textId','JJ66JJ'));
" >/dev/null
chk "#622: F7 r3 refresh=true po dostawie (insert-only)" \
  "select coalesce(j->>'ok','?')||'|'||coalesce(j->>'reclaimed','?')||'|'||coalesce(j->>'refresh','?') from (select public.telm_reclaim_orphan_positions('$L622g'::uuid, '2026-10-20 00:00:00+00'::timestamptz) j) s" "true|1|true"

# BN1 (#573/#640) — słowniki ferry_* + strefy bałtyckie (0338); regresja Stena/Polferries
HHL=11111111-0000-0000-0000-000000000001
chk "BN1: ferry_operators ≥6" \
  "select count(*) from ferry_operators where active" 6
chk "BN1: ferry_ports Tallinn A+D + Muuga + Paldiski" \
  "select count(*) from ferry_ports where code in ('TLL_A','TLL_D','MUU','PLD')" 4
# F7: rodzina TLL-HEL = 4 (Tallink D↔T2 + Viking/Eckerö A↔Katajanokka, oba kierunki)
chk "BN1: ferry_routes TLL-HEL family" \
  "select count(*) from ferry_routes where family_key='TLL-HEL' and active" 4
chk "BN1: operator GDY-KAA = STENA" \
  "select public.ferry_route_primary_operator('GDY-KAA')" STENA
chk "BN1: operator GDN-NYN = POLFERRIES" \
  "select public.ferry_route_primary_operator('GDN-NYN')" POLFERRIES
chk "BN1: operator TLL-HEL = TALLINK" \
  "select public.ferry_route_primary_operator('TLL-HEL')" TALLINK
chk "BN1: operator TLLA-HEL = VIKING" \
  "select public.ferry_route_primary_operator('TLLA-HEL')" VIKING
chk "BN1: TLL-HEL port_from = TLL_D" \
  "select port_from from ferry_routes where code='TLL-HEL'" TLL_D
chk "BN1: TLLA-HEL port_from = TLL_A" \
  "select port_from from ferry_routes where code='TLLA-HEL'" TLL_A
# RPC z GUARD (nullguard) — sesja authenticated jak front
chk "BN1: kraje TLL-HEL EE→FI" \
  "begin; set local role authenticated; set local request.jwt.claim.sub='$HHL';
   select country_from||'-'||country_to from public.ferry_route_port_countries('TLL-HEL');
   rollback" EE-FI
chk "BN1: kraje GDN-NYN PL→SE" \
  "begin; set local role authenticated; set local request.jwt.claim.sub='$HHL';
   select country_from||'-'||country_to from public.ferry_route_port_countries('GDN-NYN');
   rollback" PL-SE
chk "BN1: snapshot ma trasy bałtyckie" \
  "begin; set local role authenticated; set local request.jwt.claim.sub='$HHL';
   select (ferry_dict_snapshot()->'routes') @> '[{\"code\":\"PLD-KPS\"}]'::jsonb;
   rollback" t
chk "BN1: strefa Terminal Tallinn A" \
  "select count(*) from geofences where name='Terminal Tallinn A' and kind='PORT_OUT'" 1
chk "BN1: strefa Terminal Tallinn D HEL" \
  "select count(*) from geofences where name='Terminal Tallinn D HEL' and kind='PORT_OUT'" 1
chk "BN1: strefa Terminal Kapellskär" \
  "select count(*) from geofences where name='Terminal Kapellskär' and kind='PORT_IN'" 1
chk "BN1: sailings source TALLINK dozwolone (rollback)" \
  "begin; insert into sailings (id, project_id, vessel_id, route, departure_at, arrival_at, status, source)
     values ('77777777-0000-0000-0000-00000000b001', '$P',
             '66666666-0000-0000-0000-000000000001', 'TLL-HEL',
             now(), now() + interval '2 hours', 'ZAPLANOWANY', 'TALLINK');
   select source from sailings where id='77777777-0000-0000-0000-00000000b001';
   rollback" TALLINK
# F7 B5: bałtyckie self-aliasy nie w eta_route_aliases (założony rejs = tylko PL→SE)
chk "BN1: brak self-alias TLL-HEL w eta_route_aliases" \
  "select count(*) from eta_route_aliases where alias_key=route_key and alias_key='TLL-HEL'" 0
chk "BN1: brak self-alias PLD-KPS w eta_route_aliases" \
  "select count(*) from eta_route_aliases where alias_key=route_key and alias_key='PLD-KPS'" 0
chk "BN1: założony rejs tylko PL (GDN-NYN/GDY-KAA)" \
  "select count(*) from eta_route_aliases where alias_key=route_key and alias_key in ('GDN-NYN','GDY-KAA')" 2
# F7: eta_obs_operator_key = upper(btrim) przez ferry_route_primary_operator
chk "BN1: eta_obs_operator_key NYN-GDN" \
  "select public.eta_obs_operator_key('NYN-GDN')" POLFERRIES
chk "BN1: eta_obs_operator_key KAA-GDY" \
  "select public.eta_obs_operator_key('kaa-gdy')" STENA
chk "BN1: eta_obs_operator_key POLFERRIES" \
  "select public.eta_obs_operator_key('POLFERRIES')" POLFERRIES
chk "BN1: eta_obs_operator_key STENA" \
  "select public.eta_obs_operator_key('STENA')" STENA
chk "BN1: eta_obs_operator_key NULL" \
  "select coalesce(public.eta_obs_operator_key(null), '')" ""
chk "BN1: port NYN współrzędne 0017" \
  "select round(lat::numeric,5)||'/'||round(lon::numeric,5) from ferry_ports where code='NYN'" "58.90453/17.95621"
chk "BN1: port PLD South Harbour" \
  "select round(lat::numeric,5)||'/'||round(lon::numeric,5) from ferry_ports where code='PLD'" "59.33300/24.08300"
chk "BN1: port TLL_D F7 wschód" \
  "select round(lat::numeric,5)||'/'||round(lon::numeric,5) from ferry_ports where code='TLL_D'" "59.44000/24.77500"
# PORT_OUT A/D rozłączne (środki ~590 m, r=250 → suma 500)
chk "BN1: Tallinn A/D rozłączne (>500 m)" \
  "select ((111320*sqrt(power(a.lat-d.lat,2)+power((a.lon-d.lon)*cos(radians((a.lat+d.lat)/2)),2)))::int > 500)
     from ferry_ports a, ferry_ports d where a.code='TLL_A' and d.code='TLL_D'" t
# Strefy po rodzinie trasy (nie primary operator) — Viking/Eckerö ↔ TLL-HEL; Tallink STO ≠ HEL
chk "BN1: family TLLA-HEL → TLL-HEL" \
  "select public.eta_obs_route_family('TLLA-HEL')" TLL-HEL
chk "BN1: family HELA-TLL → TLL-HEL" \
  "select public.eta_obs_route_family('HELA-TLL')" TLL-HEL
chk "BN1: family TLL-STO" \
  "select public.eta_obs_route_family('TLL-STO')" TLL-STO
chk "BN1: match strefa TLL-HEL × TLLA-HEL" \
  "select public.ferry_geofence_matches_route('TLL-HEL','TLLA-HEL')" t
chk "BN1: brak match TLL-HEL × TLL-STO" \
  "select public.ferry_geofence_matches_route('TLL-HEL','TLL-STO')" f
chk "BN1: match POLFERRIES × GDN-NYN" \
  "select public.ferry_geofence_matches_route('POLFERRIES','GDN-NYN')" t
chk "BN1: match STENA × GDY-KAA" \
  "select public.ferry_geofence_matches_route('STENA','GDY-KAA')" t
chk "BN1: brak match TLL-HEL × GDN-NYN" \
  "select public.ferry_geofence_matches_route('TLL-HEL','GDN-NYN')" f
# BN1 0339: CASE → słownik; outbound; REMOVED; mapa z ferry_ports
chk "BN1: outbound GDY-KAA" \
  "select public.ferry_route_is_outbound('GDY-KAA')" t
chk "BN1: outbound GDN-NYN" \
  "select public.ferry_route_is_outbound('GDN-NYN')" t
chk "BN1: brak outbound NYN-GDN" \
  "select public.ferry_route_is_outbound('NYN-GDN')" f
chk "BN1: outbound TLL-HEL" \
  "select public.ferry_route_is_outbound('TLL-HEL')" t
chk "BN1: outbound TLLA-HEL" \
  "select public.ferry_route_is_outbound('TLLA-HEL')" t
chk "BN1: brak outbound HEL-TLL" \
  "select public.ferry_route_is_outbound('HEL-TLL')" f
chk "BN1: ferry_sailings_map z ferry_ports" \
  "select pg_get_functiondef('public.ferry_sailings_map()'::regprocedure) like '%ferry_ports%'" t
# BN4 pkt 8 / 0366: bez coalesce do GDN/NYN — tylko join ferry_routes
chk "BN4: ferry_sailings_map bez domyslnego GDN" \
  "select pg_get_functiondef('public.ferry_sailings_map()'::regprocedure) not like '%coalesce(fr.port_from%'" t
# DP-134/135 (F7 #706 r1): mapa bez fr.active + test behawioralny (nie sam grep)
# F7 #711 r1: bez ::text — psql zwraca t/f dla boolean (nie true/false)
chk "DP-134: ferry_sailings_map join bez fr.active" \
  "select (pg_get_functiondef('public.ferry_sailings_map()'::regprocedure) like '%join ferry_routes fr on fr.code = s.route%'
     and pg_get_functiondef('public.ferry_sailings_map()'::regprocedure) not like '%join ferry_routes fr on fr.code = s.route and fr.active%')" t
S134=77777777-0000-0000-0000-00000000134a
# departure_at unikalne vs inne rejsy Wawel w oknie ±6 h (unique vessel+departure)
q "insert into sailings (id,project_id,vessel_id,route,departure_at,arrival_at,status,source) values
    ('$S134','$P','66666666-0000-0000-0000-000000000001','GDN-NYN',
     now() - interval '73 minutes', now() + interval '5 hours 17 minutes','W_REJSIE','POLFERRIES');" >/dev/null
chk "DP-135: mapa widzi rejs przy active=true" \
  "begin; set local role authenticated; set local request.jwt.claim.sub='$HHL';
   select count(*)::text from ferry_sailings_map() where sailing_id='$S134'; commit" 1
q "update ferry_routes set active=false where code='GDN-NYN'" >/dev/null
chk "DP-134: mapa widzi rejs po active=false" \
  "begin; set local role authenticated; set local request.jwt.claim.sub='$HHL';
   select count(*)::text from ferry_sailings_map() where sailing_id='$S134'; commit" 1
q "update ferry_routes set active=true where code='GDN-NYN';
   delete from sailings where id='$S134'" >/dev/null
chk "DP-134: GDN-NYN przywrócone active" \
  "select active from ferry_routes where code='GDN-NYN'" t
chk "BN1: promote outbound ze słownika" \
  "select pg_get_functiondef('public.promote_ferry_departures(timestamptz)'::regprocedure) like '%ferry_route_is_outbound%'" t
chk "BN1: apply_geofence_status pomija REMOVED" \
  "select pg_get_functiondef('public.apply_geofence_status()'::regprocedure) ilike '%REMOVED%'" t

# F7 #649 r2: AIS backup — OTHER/TLL-HEL false; NYN-GDN/GDN-NYN true (rodzina z SE).
# PORT_IN wyłączony tylko na backup (inaczej early-return „strefa aktywna”).
# Jak #496: CHECK zdjęty na OTHER; osobne INSERT; UUID fa–fd (nie e8/e9).
S649o=77777777-0000-0000-0000-00000000649a
S649t=77777777-0000-0000-0000-00000000649b
S649n=77777777-0000-0000-0000-00000000649c
S649g=77777777-0000-0000-0000-00000000649d
L649o=$(L fa)
L649t=$(L fb)
L649n=$(L fc)
L649g=$(L fd)
q "alter table public.sailings drop constraint if exists sailings_route_check;
   insert into sailings (id,project_id,vessel_id,route,departure_at,arrival_at,actual_departure_at,actual_arrival_at,status,source) values
    ('$S649o','$P','66666666-0000-0000-0000-000000000001','OTHER',
     '2026-10-12 12:00+00','2026-10-13 06:00+00','2026-10-12 12:00+00','2026-10-13 06:00+00','DOPLYNAL','POLFERRIES');" >/dev/null
q "insert into sailings (id,project_id,vessel_id,route,departure_at,arrival_at,actual_departure_at,actual_arrival_at,status,source) values
    ('$S649t','$P','66666666-0000-0000-0000-000000000001','TLL-HEL',
     '2026-10-12 14:00+00','2026-10-13 08:00+00','2026-10-12 14:00+00','2026-10-13 08:00+00','DOPLYNAL','TALLINK');" >/dev/null
q "insert into sailings (id,project_id,vessel_id,route,departure_at,arrival_at,actual_departure_at,actual_arrival_at,status,source) values
    ('$S649n','$P','66666666-0000-0000-0000-000000000001','NYN-GDN',
     '2026-10-12 16:00+00','2026-10-13 10:00+00','2026-10-12 16:00+00','2026-10-13 10:00+00','DOPLYNAL','POLFERRIES');" >/dev/null
q "insert into sailings (id,project_id,vessel_id,route,departure_at,arrival_at,actual_departure_at,actual_arrival_at,status,source) values
    ('$S649g','$P','66666666-0000-0000-0000-000000000001','GDN-NYN',
     '2026-10-12 18:00+00','2026-10-13 12:00+00','2026-10-12 18:00+00','2026-10-13 12:00+00','DOPLYNAL','POLFERRIES');" >/dev/null
mk $L649o O649 "'HHL/O649'" "'SCX/O649'" FERRY "'$S649o'"
mk $L649t T649 "'HHL/T649'" "'SCX/T649'" FERRY "'$S649t'"
mk $L649n N649 "'HHL/N649'" "'SCX/N649'" FERRY "'$S649n'"
mk $L649g G649 "'HHL/G649'" "'SCX/G649'" FERRY "'$S649g'"
q "insert into load_events (load_id, event_type, occurred_at) values
    ('$L649o','MILESTONE_LOADED','2026-10-11 08:00+00'),
    ('$L649t','MILESTONE_LOADED','2026-10-11 08:00+00'),
    ('$L649n','MILESTONE_LOADED','2026-10-11 08:00+00'),
    ('$L649g','MILESTONE_LOADED','2026-10-11 08:00+00')" >/dev/null
chk "BN1 F7: OTHER założony FERRY" "$(st $L649o)" FERRY
chk "BN1 F7: TLL-HEL założony FERRY" "$(st $L649t)" FERRY
chk "BN1 F7: NYN-GDN założony FERRY" "$(st $L649n)" FERRY
chk "BN1 F7: GDN-NYN założony FERRY" "$(st $L649g)" FERRY
q "update public.geofences set active = false
    where project_id = '$P' and kind = 'PORT_IN' and country = 'SE'" >/dev/null
chk "BN1 F7: OTHER + ląd SE → AIS backup false" \
  "select public.apply_ferry_ais_arrival_backup('$L649o', 59.00, 17.90, '2026-10-13 07:00+00')" f
chk "BN1 F7: OTHER status bez zmian (FERRY)" "$(st $L649o)" FERRY
chk "BN1 F7: TLL-HEL + ląd SE → AIS backup false" \
  "select public.apply_ferry_ais_arrival_backup('$L649t', 59.00, 17.90, '2026-10-13 09:00+00')" f
chk "BN1 F7: TLL-HEL status bez zmian (FERRY)" "$(st $L649t)" FERRY
chk "BN1 F7: NYN-GDN + ląd SE → AIS backup true" \
  "select public.apply_ferry_ais_arrival_backup('$L649n', 59.00, 17.90, '2026-10-13 11:00+00')" t
chk "BN1 F7: GDN-NYN + ląd SE → AIS backup true" \
  "select public.apply_ferry_ais_arrival_backup('$L649g', 59.00, 17.90, '2026-10-13 13:00+00')" t
q "update public.geofences set active = true
    where project_id = '$P' and kind = 'PORT_IN' and country = 'SE'" >/dev/null
q "alter table public.sailings drop constraint if exists sailings_route_check;
   alter table public.sailings add constraint sailings_route_check
     check (route ~ '^[A-Z][A-Z0-9_-]{0,62}$');" >/dev/null

# BN4 0368 F7 r1: AIS arrival backup FI/STO/KPS + B1 powroty + B2 zatoka.
# PORT_IN wyłączony na czas backupu (jak #649).
S367h=77777777-0000-0000-0000-00000000367a
S367s=77777777-0000-0000-0000-00000000367b
S367k=77777777-0000-0000-0000-00000000367c
S367r1=77777777-0000-0000-0000-00000000367d
S367r2=77777777-0000-0000-0000-00000000367e
S367r3=77777777-0000-0000-0000-00000000367f
S367r4=77777777-0000-0000-0000-000000003680
S367r5=77777777-0000-0000-0000-000000003681
S367n=77777777-0000-0000-0000-000000003682
L367h=$(L e7)
L367s=$(L e8)
L367k=$(L e9)
L367r1=$(L ea)
L367r2=$(L eb)
L367r3=$(L ec)
L367r4=$(L ed)
L367r5=$(L ee)
L367n=$(L ef)
q "alter table public.sailings drop constraint if exists sailings_route_check;
   insert into sailings (id,project_id,vessel_id,route,departure_at,arrival_at,actual_departure_at,actual_arrival_at,status,source) values
    ('$S367h','$P','66666666-0000-0000-0000-000000000001','TLL-HEL',
     '2026-10-14 06:00+00','2026-10-14 08:30+00','2026-10-14 06:00+00','2026-10-14 08:30+00','DOPLYNAL','TALLINK'),
    ('$S367s','$P','66666666-0000-0000-0000-000000000001','TLL-STO',
     '2026-10-14 16:20+00','2026-10-15 06:20+00','2026-10-14 16:20+00','2026-10-15 06:20+00','DOPLYNAL','TALLINK'),
    ('$S367k','$P','66666666-0000-0000-0000-000000000001','PLD-KPS',
     '2026-10-14 18:20+00','2026-10-15 04:20+00','2026-10-14 18:20+00','2026-10-15 04:20+00','DOPLYNAL','DFDS'),
    ('$S367r1','$P','66666666-0000-0000-0000-000000000001','HEL-TLL',
     '2026-10-14 06:10+00','2026-10-14 08:40+00','2026-10-14 06:10+00','2026-10-14 08:40+00','DOPLYNAL','TALLINK'),
    ('$S367r2','$P','66666666-0000-0000-0000-000000000001','HELA-TLL',
     '2026-10-14 07:00+00','2026-10-14 09:30+00','2026-10-14 07:00+00','2026-10-14 09:30+00','DOPLYNAL','VIKING'),
    ('$S367r3','$P','66666666-0000-0000-0000-000000000001','VUO-MUU',
     '2026-10-14 08:00+00','2026-10-14 10:00+00','2026-10-14 08:00+00','2026-10-14 10:00+00','DOPLYNAL','ECKERO'),
    ('$S367r4','$P','66666666-0000-0000-0000-000000000001','STO-TLL',
     '2026-10-14 16:10+00','2026-10-15 06:10+00','2026-10-14 16:10+00','2026-10-15 06:10+00','DOPLYNAL','TALLINK'),
    ('$S367r5','$P','66666666-0000-0000-0000-000000000001','KPS-PLD',
     '2026-10-14 18:10+00','2026-10-15 04:10+00','2026-10-14 18:10+00','2026-10-15 04:10+00','DOPLYNAL','DFDS'),
    ('$S367n','$P','66666666-0000-0000-0000-000000000001','TLL-HEL',
     '2026-10-16 06:00+00','2026-10-16 08:30+00','2026-10-16 06:00+00',null,'W_REJSIE','TALLINK');" >/dev/null
mk $L367h H367 "'HHL/H367'" "'SCX/H367'" FERRY "'$S367h'"
mk $L367s S367 "'HHL/S367'" "'SCX/S367'" FERRY "'$S367s'"
mk $L367k K367 "'HHL/K367'" "'SCX/K367'" FERRY "'$S367k'"
mk $L367r1 R367a "'HHL/R367a'" "'SCX/R367a'" FERRY "'$S367r1'"
mk $L367r2 R367b "'HHL/R367b'" "'SCX/R367b'" FERRY "'$S367r2'"
mk $L367r3 R367c "'HHL/R367c'" "'SCX/R367c'" FERRY "'$S367r3'"
mk $L367r4 R367d "'HHL/R367d'" "'SCX/R367d'" FERRY "'$S367r4'"
mk $L367r5 R367e "'HHL/R367e'" "'SCX/R367e'" FERRY "'$S367r5'"
mk $L367n N367 "'HHL/N367'" "'SCX/N367'" FERRY "'$S367n'"
q "insert into load_events (load_id, event_type, occurred_at) values
    ('$L367h','MILESTONE_LOADED','2026-10-13 08:00+00'),
    ('$L367s','MILESTONE_LOADED','2026-10-13 08:00+00'),
    ('$L367k','MILESTONE_LOADED','2026-10-13 08:00+00'),
    ('$L367r1','MILESTONE_LOADED','2026-10-13 08:00+00'),
    ('$L367r2','MILESTONE_LOADED','2026-10-13 08:00+00'),
    ('$L367r3','MILESTONE_LOADED','2026-10-13 08:00+00'),
    ('$L367r4','MILESTONE_LOADED','2026-10-13 08:00+00'),
    ('$L367r5','MILESTONE_LOADED','2026-10-13 08:00+00'),
    ('$L367n','MILESTONE_LOADED','2026-10-13 08:00+00')" >/dev/null
chk "BN4: finland_land_geom istnieje" \
  "select to_regprocedure('public.finland_land_geom()') is not null" t
chk "BN4: Kapellskär w sweden_land_geom" \
  "select st_covers(public.sweden_land_geom(), st_setsrid(st_makepoint(19.066, 59.723), 4326))" t
# B2: otwarta zatoka / tory podejścia poza lądem FI
chk "BN4 B2: zatoka 60.05/25.0 poza FI" \
  "select st_covers(public.finland_land_geom(), st_setsrid(st_makepoint(25.0, 60.05), 4326))" f
chk "BN4 B2: tor West Harbour 24.90/60.10 poza FI" \
  "select st_covers(public.finland_land_geom(), st_setsrid(st_makepoint(24.90, 60.10), 4326))" f
chk "BN4 B2: Suomenlinna S 24.98/60.13 poza FI" \
  "select st_covers(public.finland_land_geom(), st_setsrid(st_makepoint(24.98, 60.13), 4326))" f
chk "BN4 B2: podejście VUO 25.20/60.15 poza FI" \
  "select st_covers(public.finland_land_geom(), st_setsrid(st_makepoint(25.20, 60.15), 4326))" f
# Kapellskär: woda na wschód poza lądem
chk "BN4: Kapellskär woda 19.15/59.74 poza SE" \
  "select st_covers(public.sweden_land_geom(), st_setsrid(st_makepoint(19.15, 59.74), 4326))" f
chk "BN4: Kapellskär woda 19.18/59.77 poza SE" \
  "select st_covers(public.sweden_land_geom(), st_setsrid(st_makepoint(19.18, 59.77), 4326))" f
q "update public.geofences set active = false
    where project_id = '$P' and kind = 'PORT_IN' and country in ('SE', 'FI')" >/dev/null
# Helsinki West Harbour — środek PORT_IN FI
chk "BN4: TLL-HEL w porcie HEL → AIS backup true" \
  "select public.apply_ferry_ais_arrival_backup('$L367h', 60.15400, 24.91400, '2026-10-14 08:45+00')" t
chk "BN4: TLL-HEL w porcie → AT_PORT_NYNASHAMN" "$(st $L367h)" AT_PORT_NYNASHAMN
# Inland FI ≥2 km (na północ od portu) → Droga SE (enum)
q "select set_config('tower.status_ctx','on',true); update loads set status='FERRY' where id='$L367h'" >/dev/null
chk "BN4: TLL-HEL ląd FI ≥2 km → AIS backup true" \
  "select public.apply_ferry_ais_arrival_backup('$L367h', 60.28, 24.95, '2026-10-14 09:30+00')" t
chk "BN4: TLL-HEL ląd FI → IN_TRANSIT_SE" "$(st $L367h)" IN_TRANSIT_SE
# Regresja: TLL-HEL nie reaguje na ląd SE (kraj przypłynięcia = FI)
q "select set_config('tower.status_ctx','on',true); update loads set status='FERRY' where id='$L367h'" >/dev/null
chk "BN4: TLL-HEL + ląd SE → nadal false" \
  "select public.apply_ferry_ais_arrival_backup('$L367h', 59.00, 17.90, '2026-10-14 10:00+00')" f
# p_ts < ATA / ATA null → false (FERRY)
chk "BN4: TLL-HEL p_ts < ATA → false" \
  "select public.apply_ferry_ais_arrival_backup('$L367h', 60.28, 24.95, '2026-10-14 08:00+00')" f
chk "BN4: TLL-HEL ATA null → false" \
  "select public.apply_ferry_ais_arrival_backup('$L367n', 60.28, 24.95, '2026-10-16 09:00+00')" f
# Nowe SE: Stockholm (TLL-STO) i Kapellskär (PLD-KPS) ≥2 km od PORT_IN
chk "BN4: TLL-STO ląd SE → AIS backup true" \
  "select public.apply_ferry_ais_arrival_backup('$L367s', 59.40, 18.00, '2026-10-15 07:00+00')" t
chk "BN4: TLL-STO → IN_TRANSIT_SE" "$(st $L367s)" IN_TRANSIT_SE
chk "BN4: PLD-KPS Kapellskär → AIS backup true" \
  "select public.apply_ferry_ais_arrival_backup('$L367k', 59.75, 18.95, '2026-10-15 05:00+00')" t
chk "BN4: PLD-KPS → IN_TRANSIT_SE" "$(st $L367k)" IN_TRANSIT_SE
# B1: trasy powrotne (port_to poza SE/FI) — ląd i port wyjścia → false
chk "BN4 B1: HEL-TLL ląd HEL → false" \
  "select public.apply_ferry_ais_arrival_backup('$L367r1', 60.28, 24.95, '2026-10-14 09:00+00')" f
chk "BN4 B1: HEL-TLL port HEL → false" \
  "select public.apply_ferry_ais_arrival_backup('$L367r1', 60.15400, 24.91400, '2026-10-14 09:00+00')" f
chk "BN4 B1: HELA-TLL ląd HEL → false" \
  "select public.apply_ferry_ais_arrival_backup('$L367r2', 60.28, 24.95, '2026-10-14 10:00+00')" f
chk "BN4 B1: HELA-TLL port HEL → false" \
  "select public.apply_ferry_ais_arrival_backup('$L367r2', 60.15400, 24.91400, '2026-10-14 10:00+00')" f
chk "BN4 B1: VUO-MUU ląd VUO → false" \
  "select public.apply_ferry_ais_arrival_backup('$L367r3', 60.28, 25.20, '2026-10-14 10:30+00')" f
chk "BN4 B1: VUO-MUU port VUO → false" \
  "select public.apply_ferry_ais_arrival_backup('$L367r3', 60.21200, 25.19500, '2026-10-14 10:30+00')" f
chk "BN4 B1: STO-TLL ląd STO → false" \
  "select public.apply_ferry_ais_arrival_backup('$L367r4', 59.40, 18.00, '2026-10-15 07:00+00')" f
chk "BN4 B1: STO-TLL port STO → false" \
  "select public.apply_ferry_ais_arrival_backup('$L367r4', 59.35000, 18.10000, '2026-10-15 07:00+00')" f
chk "BN4 B1: KPS-PLD ląd KPS → false" \
  "select public.apply_ferry_ais_arrival_backup('$L367r5', 59.75, 18.95, '2026-10-15 05:00+00')" f
chk "BN4 B1: KPS-PLD port KPS → false" \
  "select public.apply_ferry_ais_arrival_backup('$L367r5', 59.72300, 19.06600, '2026-10-15 05:00+00')" f
chk "BN4 B1: HEL-TLL status bez zmian" "$(st $L367r1)" FERRY
chk "BN4 B1: STO-TLL status bez zmian" "$(st $L367r4)" FERRY
q "update public.geofences set active = true
    where project_id = '$P' and kind = 'PORT_IN' and country in ('SE', 'FI')" >/dev/null
q "alter table public.sailings drop constraint if exists sailings_route_check;
   alter table public.sailings add constraint sailings_route_check
     check (route ~ '^[A-Z][A-Z0-9_-]{0,62}$');" >/dev/null

# BN1 0344 F7: apply_ferry_se + mismatch — e2e (bez pg_get_functiondef like)
# e2e SE: OTHER/TLL-HEL bez zmiany; GDN-NYN / NYN-GDN / GDY-KAA → Droga SE
S640o=77777777-0000-0000-0000-00000000640a
S640t=77777777-0000-0000-0000-00000000640b
S640g=77777777-0000-0000-0000-00000000640c
S640n=77777777-0000-0000-0000-00000000640d
S640k=77777777-0000-0000-0000-00000000640e
L640o=$(L fe)
L640t=$(L ff)
L640g=$(L f0)
L640n=$(L e1)
L640k=$(L e2)
q "update public.geofences set active = true
    where project_id = '$P' and kind = 'PORT_IN' and country = 'SE'" >/dev/null
q "alter table public.sailings drop constraint if exists sailings_route_check;
   insert into sailings (id,project_id,vessel_id,route,departure_at,arrival_at,actual_departure_at,actual_arrival_at,status,source) values
    ('$S640o','$P','66666666-0000-0000-0000-000000000001','OTHER',
     '2026-10-14 12:00+00','2026-10-15 06:00+00','2026-10-14 12:00+00','2026-10-15 06:00+00','DOPLYNAL','POLFERRIES');" >/dev/null
q "insert into sailings (id,project_id,vessel_id,route,departure_at,arrival_at,actual_departure_at,actual_arrival_at,status,source) values
    ('$S640t','$P','66666666-0000-0000-0000-000000000001','TLL-HEL',
     '2026-10-14 14:00+00','2026-10-15 08:00+00','2026-10-14 14:00+00','2026-10-15 08:00+00','DOPLYNAL','TALLINK');" >/dev/null
q "insert into sailings (id,project_id,vessel_id,route,departure_at,arrival_at,actual_departure_at,actual_arrival_at,status,source) values
    ('$S640g','$P','66666666-0000-0000-0000-000000000001','GDN-NYN',
     '2026-10-14 18:00+00','2026-10-15 12:00+00','2026-10-14 18:00+00','2026-10-15 12:00+00','DOPLYNAL','POLFERRIES');" >/dev/null
q "insert into sailings (id,project_id,vessel_id,route,departure_at,arrival_at,actual_departure_at,actual_arrival_at,status,source) values
    ('$S640n','$P','66666666-0000-0000-0000-000000000001','NYN-GDN',
     '2026-10-14 16:00+00','2026-10-15 10:00+00','2026-10-14 16:00+00','2026-10-15 10:00+00','DOPLYNAL','POLFERRIES');" >/dev/null
q "insert into sailings (id,project_id,vessel_id,route,departure_at,arrival_at,actual_departure_at,actual_arrival_at,status,source) values
    ('$S640k','$P','66666666-0000-0000-0000-000000000001','GDY-KAA',
     '2026-10-14 20:00+00','2026-10-15 14:00+00','2026-10-14 20:00+00','2026-10-15 14:00+00','DOPLYNAL','STENA');" >/dev/null
mk $L640o O640 "'HHL/O640'" "'SCX/O640'" FERRY "'$S640o'"
mk $L640t T640 "'HHL/T640'" "'SCX/T640'" FERRY "'$S640t'"
mk $L640g G640 "'HHL/G640'" "'SCX/G640'" FERRY "'$S640g'"
mk $L640n N640 "'HHL/N640'" "'SCX/N640'" FERRY "'$S640n'"
mk $L640k K640 "'HHL/K640'" "'SCX/K640'" FERRY "'$S640k'"
q "insert into load_events (load_id, event_type, occurred_at) values
    ('$L640o','MILESTONE_LOADED','2026-10-13 08:00+00'),
    ('$L640t','MILESTONE_LOADED','2026-10-13 08:00+00'),
    ('$L640g','MILESTONE_LOADED','2026-10-13 08:00+00'),
    ('$L640n','MILESTONE_LOADED','2026-10-13 08:00+00'),
    ('$L640k','MILESTONE_LOADED','2026-10-13 08:00+00')" >/dev/null
chk "BN1 0344: OTHER założony FERRY" "$(st $L640o)" FERRY
chk "BN1 0344: TLL-HEL założony FERRY" "$(st $L640t)" FERRY
chk "BN1 0344: GDN-NYN założony FERRY" "$(st $L640g)" FERRY
chk "BN1 0344: NYN-GDN założony FERRY" "$(st $L640n)" FERRY
chk "BN1 0344: GDY-KAA założony FERRY" "$(st $L640k)" FERRY
q "select public.apply_ferry_se_from_position('$L640o', 59.00, 17.90, '2026-10-15 07:00+00')" >/dev/null
chk "BN1 0344: OTHER + ląd SE → bez zmiany (FERRY)" "$(st $L640o)" FERRY
q "select public.apply_ferry_se_from_position('$L640t', 59.00, 17.90, '2026-10-15 09:00+00')" >/dev/null
chk "BN1 0344: TLL-HEL + ląd SE → bez zmiany (FERRY)" "$(st $L640t)" FERRY
q "select public.apply_ferry_se_from_position('$L640g', 59.00, 17.90, '2026-10-15 13:00+00')" >/dev/null
chk "BN1 0344: GDN-NYN + ląd SE ≥2 km → IN_TRANSIT_SE" "$(st $L640g)" IN_TRANSIT_SE
q "select public.apply_ferry_se_from_position('$L640n', 59.00, 17.90, '2026-10-15 11:00+00')" >/dev/null
chk "BN1 0344: NYN-GDN + ląd SE ≥2 km → IN_TRANSIT_SE" "$(st $L640n)" IN_TRANSIT_SE
q "select public.apply_ferry_se_from_position('$L640k', 59.00, 17.90, '2026-10-15 15:00+00')" >/dev/null
chk "BN1 0344: GDY-KAA + ląd SE ≥2 km → IN_TRANSIT_SE" "$(st $L640k)" IN_TRANSIT_SE

# Behawioralne propose/assign (F7): TLL-HEL odmowa; GDN-NYN OK
L640p=$(L e3)
mk $L640p P640 "'HHL/P640'" "'SCX/P640'" AT_PORT_GDANSK "'$S640t'"
q "insert into load_events (load_id, event_type, occurred_at) values
    ('$L640p','MILESTONE_LOADED','2026-10-13 08:00+00');
   insert into positions (load_id, ts, geom_raw, source) values
    ('$L640p', '2026-10-14 11:00+00', st_setsrid(st_makepoint(18.6800, 54.4030), 4326), 'TELEMATICS_API'),
    ('$L640p', '2026-10-15 09:30+00', st_setsrid(st_makepoint(17.90, 59.00), 4326), 'TELEMATICS_API');" >/dev/null
chk "BN1 0344: propose nie bierze TLL-HEL (port EE)" \
  "select (public.sailing_mismatch_propose_id('$L640p') is distinct from '$S640t')" t
out=$(q "begin; set local role authenticated; set local request.jwt.claim.sub='$HHL';
 select sailing_mismatch_assign('$L640p','$S640t'); rollback;" 2>&1)
echo "$out" | grep -qiE 'portem w PL|Tylko trasa|ferry_routes|22023|P0001' \
  && { ok=$((ok+1)); echo "  OK    BN1 0344: assign TLL-HEL odmowa"; } \
  || { fail=$((fail+1)); echo "  FAIL  BN1 0344: assign TLL-HEL odmowa: $out"; }
L640q=$(L e4)
# bez rejsu = filtr rodziny wyłączony; w oknie tylko S640g (PL outbound; TLL/EE i KAA poza arrival)
mk $L640q Q640 "'HHL/Q640'" "'SCX/Q640'" AT_PORT_GDANSK null
q "insert into load_events (load_id, event_type, occurred_at) values
    ('$L640q','MILESTONE_LOADED','2026-10-13 08:00+00');
   insert into positions (load_id, ts, geom_raw, source) values
    ('$L640q', '2026-10-14 11:30+00', st_setsrid(st_makepoint(18.6800, 54.4030), 4326), 'TELEMATICS_API'),
    ('$L640q', '2026-10-15 12:30+00', st_setsrid(st_makepoint(17.90, 59.00), 4326), 'TELEMATICS_API');" >/dev/null
chk "BN1 0344: propose = GDN-NYN (PL outbound)" \
  "select (public.sailing_mismatch_propose_id('$L640q') = '$S640g')" t
q "begin; set local role authenticated; set local request.jwt.claim.sub='$HHL';
   select sailing_mismatch_assign('$L640q','$S640g'); commit" >/dev/null
chk "BN1 0344: assign GDN-NYN → sailing" \
  "select (sailing_id = '$S640g') from loads where id='$L640q'" t

q "alter table public.sailings drop constraint if exists sailings_route_check;
   alter table public.sailings add constraint sailings_route_check
     check (route ~ '^[A-Z][A-Z0-9_-]{0,62}$');" >/dev/null
# BN1/#648: seed jedną funkcją; e2e TLLA-HEL → Tallinn A; active=false wyłącza promote (HHL_ADMIN)
echo; echo "[BN1/#648] seed + TLLA-HEL e2e + ferry_route_set_active"
HHL=11111111-0000-0000-0000-000000000001
chk "BN1 648: seed idempotentny (0 nowych)" \
  "select public.bn1_seed_baltic_geofences('$P')" 0
chk "BN1 648: 15 stref bałtyckich po seed" \
  "select count(*) from geofences where project_id='$P' and name in (
     'Bufor 20 km przed Tallinn A','Terminal Tallinn A',
     'Bufor 20 km przed Tallinn D HEL','Terminal Tallinn D HEL',
     'Bufor 20 km przed Tallinn D','Terminal Tallinn D',
     'Bufor 20 km przed Muuga','Terminal Muuga HHLA',
     'Bufor 20 km przed Paldiski','Terminal Paldiski',
     'Terminal Helsinki West Harbour T2','Terminal Helsinki Katajanokka',
     'Terminal Vuosaari','Terminal Stockholm Värtahamnen','Terminal Kapellskär')" 15

S648v=77777777-0000-0000-0000-00000000648a
L648v=$(L e5)
q "insert into sailings (id,project_id,vessel_id,route,departure_at,arrival_at,status,source) values
    ('$S648v','$P','66666666-0000-0000-0000-000000000001','TLLA-HEL',
     '2026-10-16 12:00+00','2026-10-16 14:00+00','ZAPLANOWANY','VIKING');" >/dev/null
mk $L648v V648 "'HHL/V648'" "'SCX/V648'" IN_TRANSIT_PL "'$S648v'"
q "insert into load_events (load_id, event_type, occurred_at) values
    ('$L648v','MILESTONE_LOADED','2026-10-15 08:00+00');" >/dev/null
# Tallinn A (Viking) — rodzina TLL-HEL; 2 fixy w strefie PORT_OUT
pos $L648v 59.44400 24.76800 "2026-10-16 10:00+00"
pos $L648v 59.44410 24.76810 "2026-10-16 10:05+00"
chk "BN1 648 e2e: TLLA-HEL + Tallinn A → AT_PORT_GDANSK" "$(st $L648v)" AT_PORT_GDANSK

S648p=77777777-0000-0000-0000-00000000648b
L648p=$(L e6)
q "insert into sailings (id,project_id,vessel_id,route,departure_at,arrival_at,status,source) values
    ('$S648p','$P','66666666-0000-0000-0000-000000000001','TLLA-HEL',
     '2026-10-16 08:00+00','2026-10-16 10:00+00','ZAPLANOWANY','VIKING');" >/dev/null
mk $L648p P648 "'HHL/P648'" "'SCX/P648'" AT_PORT_GDANSK "'$S648p'"
q "insert into load_events (load_id, event_type, occurred_at) values
    ('$L648p','MILESTONE_LOADED','2026-10-15 08:00+00');" >/dev/null
# HHL_ADMIN wyłącza trasę → promote pomija (ferry_route_is_outbound = false)
q "begin; set local role authenticated; set local request.jwt.claim.sub='$HHL';
   select ferry_route_set_active('TLLA-HEL', false); commit" >/dev/null
# Bez ::text — boolean z psql = t/f (nie true/false)
chk "BN1 648: TLLA-HEL active=false" \
  "select active from ferry_routes where code='TLLA-HEL'" f
chk "BN1 648: outbound TLLA-HEL po wyłączeniu = false" \
  "select public.ferry_route_is_outbound('TLLA-HEL')" f
chk "BN1 648: promote nie rusza ładunku na wyłączonej trasie" \
  "select promote_ferry_departures('2026-10-16 10:00+00'); select status from loads where id='$L648p'" AT_PORT_GDANSK
# SCX nie może zmieniać active
out=$(q "begin; set local role authenticated; set local request.jwt.claim.sub='$SCX';
 select ferry_route_set_active('TLLA-HEL', true); rollback;" 2>&1)
echo "$out" | grep -qiE 'Administrator HHL|42501' \
  && { ok=$((ok+1)); echo "  OK    BN1 648: SCX odmowa ferry_route_set_active"; } \
  || { fail=$((fail+1)); echo "  FAIL  BN1 648: SCX odmowa ferry_route_set_active: $out"; }
q "begin; set local role authenticated; set local request.jwt.claim.sub='$HHL';
   select ferry_route_set_active('TLLA-HEL', true); commit" >/dev/null
chk "BN1 648: TLLA-HEL przywrócone active" \
  "select active from ferry_routes where code='TLLA-HEL'" t
# F7 #654 nieblokujące: kontrola pozytywna — promote przy active=true nie przechodzi pusto
chk "BN1 648: promote przy active=true → FERRY" \
  "select promote_ferry_departures('2026-10-16 10:00+00'); select status from loads where id='$L648p'" FERRY
# F7 #659: HHL_ADMIN bez 2FA → odmowa; aal2 false→f, potem true→t (nie true→true — wczesny return)
q "update security_flags set enabled=true where key='MFA_HHL_ADMIN'" >/dev/null
out=$(q "begin; set local role authenticated; set local request.jwt.claim.sub='$HHL';
 select ferry_route_set_active('TLLA-HEL', true); rollback;" 2>&1)
echo "$out" | grep -qiE '2FA|42501' \
  && { ok=$((ok+1)); echo "  OK    BN1 648: HHL_ADMIN aal1 odmowa ferry_route_set_active"; } \
  || { fail=$((fail+1)); echo "  FAIL  BN1 648: HHL_ADMIN aal1 odmowa ferry_route_set_active: $out"; }
q "begin; set local role authenticated; set local request.jwt.claim.sub='$HHL';
   set local request.jwt.claim.aal='aal2';
   select ferry_route_set_active('TLLA-HEL', false); commit" >/dev/null
chk "BN1 648: HHL_ADMIN aal2 ferry_route_set_active false → f" \
  "select active from ferry_routes where code='TLLA-HEL'" f
q "begin; set local role authenticated; set local request.jwt.claim.sub='$HHL';
   set local request.jwt.claim.aal='aal2';
   select ferry_route_set_active('TLLA-HEL', true); commit" >/dev/null
chk "BN1 648: HHL_ADMIN aal2 ferry_route_set_active true → t" \
  "select active from ferry_routes where code='TLLA-HEL'" t
q "update security_flags set enabled=false where key='MFA_HHL_ADMIN'" >/dev/null

# ---------------------------------------------------------------------------
# DP-131: FERRY + GPS ≤3 km port wyjścia po ATD/ATA → HIGH (bez zmiany statusu)
# Przypadek 01.11: GDN-NYN ATA 10:45Z, GPS ~0,2 km Gdańsk do 12:12Z.
# ---------------------------------------------------------------------------
S131=77777777-0000-0000-0000-00000000131a
L131=55555555-0000-0000-0000-00000000131a
L131b=55555555-0000-0000-0000-00000000131b
V131=66666666-0000-0000-0000-00000000131a
q "insert into vessels (id, name, operator) values
 ('$V131', 'M/F Wawel 131', 'Polferries')
 on conflict (id) do nothing" >/dev/null
chk "DP-131: fikstura rejsu GDN-NYN (ATA 10:45Z)" \
  "insert into sailings (id, project_id, vessel_id, route, departure_at, arrival_at,
    actual_departure_at, actual_arrival_at, status, source) values
   ('$S131', '$P', '$V131', 'GDN-NYN',
    '2026-11-01 08:00+00', '2026-11-01 10:45+00',
    '2026-11-01 08:05+00', '2026-11-01 10:45+00', 'DOPLYNAL', 'POLFERRIES')
   returning (id is not null)" t
mk $L131 A131 "'HHL/A131'" "'SCX/A131'" FERRY "'$S131'"
q "insert into load_events (load_id, event_type, occurred_at) values
 ('$L131','MILESTONE_LOADED','2026-10-31 08:00+00')" >/dev/null
# ~0,2 km od GDN (54.40372, 18.68130) — lekki offset szerokości
q "insert into positions (load_id, ts, geom_raw, source) values
 ('$L131', '2026-11-01 12:12+00',
  st_setsrid(st_makepoint(18.68130, 54.40550), 4326), 'TELEMATICS_API')" >/dev/null
q "select public.detect_ferry_gps_stuck_at_departure('2026-11-01 12:15+00')" >/dev/null
chk "DP-131: GPS 0,2 km Gdańsk po ATA → FERRY_STUCK_DEP HIGH" \
  "select count(*)||'/'||max(severity::text)||'/'||max(title_key)
     from risk_signals
    where load_id='$L131' and dedup_key like 'FERRY_STUCK_DEP:%' and resolved_at is null" \
  "1/HIGH/rk_ferry_not_departed"
chk "DP-131: status nadal FERRY (bez zmiany)" "$(st $L131)" FERRY
q "select public.detect_ferry_gps_stuck_at_departure('2026-11-01 12:20+00')" >/dev/null
chk "DP-131: drugi przebieg — jedno ryzyko (dedup)" \
  "$(rk $L131 FERRY_STUCK_DEP)" 1
# Pozycja >3 km od GDN → zamknięcie
q "insert into positions (load_id, ts, geom_raw, source) values
 ('$L131', '2026-11-01 13:00+00',
  st_setsrid(st_makepoint(18.68130, 54.45000), 4326), 'TELEMATICS_API')" >/dev/null
q "select public.detect_ferry_gps_stuck_at_departure('2026-11-01 13:05+00')" >/dev/null
chk "DP-131: GPS >3 km → ryzyko zamknięte" \
  "select count(*) from risk_signals
    where load_id='$L131' and dedup_key like 'FERRY_STUCK_DEP:%' and resolved_at is null" 0
# Przed ATD/ATA — bez alarmu
S131b=77777777-0000-0000-0000-00000000131b
chk "DP-131: fikstura bez ATD/ATA" \
  "insert into sailings (id, project_id, vessel_id, route, departure_at, arrival_at,
    actual_departure_at, actual_arrival_at, status, source) values
   ('$S131b', '$P', '$V131', 'GDN-NYN',
    '2026-11-02 08:00+00', '2026-11-02 10:45+00',
    null, null, 'W_REJSIE', 'POLFERRIES')
   returning (id is not null)" t
mk $L131b B131 "'HHL/B131'" "'SCX/B131'" FERRY "'$S131b'"
q "insert into load_events (load_id, event_type, occurred_at) values
 ('$L131b','MILESTONE_LOADED','2026-11-01 08:00+00');
 insert into positions (load_id, ts, geom_raw, source) values
 ('$L131b', '2026-11-02 09:00+00',
  st_setsrid(st_makepoint(18.68130, 54.40550), 4326), 'TELEMATICS_API')" >/dev/null
q "select public.detect_ferry_gps_stuck_at_departure('2026-11-02 09:15+00')" >/dev/null
chk "DP-131: bez ATD/ATA → 0 FERRY_STUCK_DEP" \
  "$(rk $L131b FERRY_STUCK_DEP)" 0

# DP-133: osobny cron GPS stuck (nie w tym samym poleceniu co overdue)
if [ "$(q "select to_regclass('cron.job') is not null")" = "t" ]; then
  chk "DP-133: cron tower-prom-opoznienie tylko overdue" \
    "select count(*) from cron.job where jobname='tower-prom-opoznienie' and command not ilike '%gps_stuck%' and command ilike '%detect_ferry_overdue%'" 1
  chk "DP-133: cron tower-prom-gps-port osobno" \
    "select count(*) from cron.job where jobname='tower-prom-gps-port' and command ilike '%detect_ferry_gps_stuck_at_departure%'" 1
else
  chk "DP-133: brak cron.job (stub) — overdue OK" "select 1" 1
  chk "DP-133: brak cron.job (stub) — gps-port OK" "select 1" 1
fi

# DP-136 (F7 #708 r1 / F7 #712 r1): przepięcie — ląd SE|FI.
# Osobny vessel — …0001+2026-10-12 12:00 już zajęte przez S649o (unique vessel+departure).
# nie L f0 — zajęte przez L640g (BN1 0344); d0/d1 wolne
chk "DP-136: assign widzi finland_land_geom" \
  "select pg_get_functiondef('public.sailing_mismatch_assign(uuid,uuid)'::regprocedure) like '%finland_land_geom%'" t
chk "DP-136: propose widzi finland_land_geom" \
  "select pg_get_functiondef('public.sailing_mismatch_propose_id(uuid)'::regprocedure) like '%finland_land_geom%'" t
S136a=77777777-0000-0000-0000-00000000136a
S136b=77777777-0000-0000-0000-00000000136b
L136=$(L d0)
L136w=$(L d1)
V136=66666666-0000-0000-0000-000000000136
q "insert into vessels (id, name, operator) values
    ('$V136', 'M/F Wawel 136', 'Polferries')
   on conflict (id) do nothing;
   insert into sailings (id, project_id, vessel_id, route, departure_at, arrival_at,
    actual_departure_at, actual_arrival_at, status, source) values
   ('$S136a', '$P', '$V136', 'GDN-NYN',
    '2026-10-12 12:00+00', '2026-10-13 06:00+00',
    '2026-10-12 12:00+00', '2026-10-13 06:00+00', 'DOPLYNAL', 'POLFERRIES'),
   ('$S136b', '$P', '$V136', 'GDN-NYN',
    '2026-10-22 17:00+00', '2026-10-23 11:00+00',
    null, null, 'ZAPLANOWANY', 'POLFERRIES')" >/dev/null
chk "DP-136: fixture sailings S136a/b" \
  "select count(*) from sailings where id in ('$S136a','$S136b')" 2
mk $L136 A136 "'HHL/A136'" "'SCX/A136'" AT_PORT_GDANSK "'$S136b'"
q "insert into load_events (load_id, event_type, occurred_at) values
    ('$L136','MILESTONE_LOADED','2026-10-11 08:00+00');
   insert into positions (load_id, ts, geom_raw, source) values
    ('$L136', '2026-10-12 11:00+00', st_setsrid(st_makepoint(18.6800, 54.4030), 4326), 'TELEMATICS_API'),
    ('$L136', '2026-10-13 08:00+00', st_setsrid(st_makepoint(24.95, 60.28), 4326), 'TELEMATICS_API')" >/dev/null
chk "DP-136: fixture positions L136" \
  "select count(*) from positions where load_id='$L136'" 2
chk "DP-136: propose z samym lądem FI (bez SE)" \
  "select (public.sailing_mismatch_propose_id('$L136') = '$S136a')" t
mk $L136w W136 "'HHL/W136'" "'SCX/W136'" AT_PORT_GDANSK "'$S136b'"
q "insert into load_events (load_id, event_type, occurred_at) values
    ('$L136w','MILESTONE_LOADED','2026-10-11 08:00+00');
   insert into positions (load_id, ts, geom_raw, source) values
    ('$L136w', '2026-10-12 11:00+00', st_setsrid(st_makepoint(18.6800, 54.4030), 4326), 'TELEMATICS_API'),
    ('$L136w', '2026-10-13 08:00+00', st_setsrid(st_makepoint(25.0, 60.05), 4326), 'TELEMATICS_API')" >/dev/null
chk "DP-136: zatoka FI nie liczy się jako ląd (propose null)" \
  "select (public.sailing_mismatch_propose_id('$L136w') is null)" t

echo; echo "WYNIK: $ok OK, $fail FAIL"
[ "$fail" -eq 0 ]
