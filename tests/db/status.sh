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
# Data od razu docelowa: mk() wstawia 30.09, a zmiana daty po starcie okna zamraża śledzenie.
q "insert into loads (id,project_id,carrier_org_id,order_no,hhl_order_no,carrier_order_no,status,plan_load_date,telematics_vehicle_id) values
 ('$W1','$P','$SCXO','KSH/A1W1','HHL/A1W1','SCX/A1W1','IN_TRANSIT_PL','2026-10-05','TEL-A1W1'),
 ('$W2','$P','$SCXO','KSH/A1W2','HHL/A1W2','SCX/A1W2','DELIVERED','2026-10-05','TEL-A1W2'),
 ('$W3','$P','$SCXO','KSH/A1W3','HHL/A1W3','SCX/A1W3','IN_TRANSIT_PL','2026-10-24','TEL-A1W3'),
 ('$W4','$P','$SCXO','KSH/A1W4','HHL/A1W4','SCX/A1W4','IN_TRANSIT_PL','2026-11-05','TEL-A1W4'),
 ('$W5','$P','$SCXO','KSH/A1W5','HHL/A1W5','SCX/A1W5','IN_TRANSIT_PL','2026-10-05','TEL-A1W5'),
 ('$W6','$P','$SCXO','KSH/A1W6','HHL/A1W6','SCX/A1W6','IN_TRANSIT_SE','2026-10-01','TEL-A1W6')" >/dev/null
T59=$(q "select public.tracking_window_start('2026-10-05'::date) - interval '1 minute'")
T00=$(q "select public.tracking_window_start('2026-10-05'::date)")
# W4: daty w przyszłości (nie „dziś”) — po 03:00 w dniu planu okno już startuje i zamraża tracking_opened_at.
T05=$(q "select public.tracking_window_start('2026-11-05'::date)")
T07=$(q "select public.tracking_window_start('2026-11-07'::date)")
pos $W1 52.09 17.02 "$T59"
chk "A1 02:59 bez pozycji" "select count(*) from positions where load_id='$W1'" 0
pos $W1 52.09 17.02 "$T00"
chk "A1 03:00 zapis pozycji" "select count(*) from positions where load_id='$W1'" 1
pos $W2 52.09 17.02 "$T00"
chk "A1 Dostarczone bez pozycji" "select count(*) from positions where load_id='$W2'" 0
pos $W3 52.09 17.02 "2026-10-17 12:00:00+00"
chk "A1 przyszły tydzień bez pozycji" "select count(*) from positions where load_id='$W3'" 0
q "update loads set plan_load_date='2026-11-07' where id='$W4'" >/dev/null
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
chk "#445: departure minął, AIS 10 km, auto ≤2 km → FERRY" \
  "select a10_try_ferry_backup('$L445c', now()); select status from loads where id='$L445c'" FERRY

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

echo; echo "WYNIK: $ok OK, $fail FAIL"
[ "$fail" -eq 0 ]
