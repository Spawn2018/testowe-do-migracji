#!/usr/bin/env bash
# TOWER — test automatyki statusów: podróże ciężarówek prawdziwymi pozycjami
# GPS przez silnik stref (0002) i automat PROM (0004). Uruchamiany po seed.sql.
PSQL="psql ${PGURL:-postgres://postgres@localhost:5433/tower} -Atq -v ON_ERROR_STOP=1"
P=22222222-0000-0000-0000-000000000001; SCXO=00000000-0000-0000-0000-00000000a003
SCX=11111111-0000-0000-0000-000000000003; KSH=11111111-0000-0000-0000-000000000002
ok=0; fail=0
q()   { $PSQL -c "$1" 2>&1; }
pos() { q "select count(*) from process_position('$1', $2, $3, '$4')" >/dev/null; }   # ładunek, szer., dł., czas
chk() { got=$(q "$2" | tail -1); if [ "$got" = "$3" ]; then ok=$((ok+1)); echo "  OK    $1"; else fail=$((fail+1)); echo "  FAIL  $1  (otrzymano: $got, oczekiwano: $3)"; fi; }
st()  { echo "select status from loads where id='$1'"; }
rk()  { echo "select count(*) from risk_signals where load_id='$1' and dedup_key like '$2%'"; }

L() { printf '55555555-0000-0000-0000-0000000000%s' "$1"; }
A=$(L 0a); B=$(L 0b); C=$(L 0c); D=$(L 0d); E=$(L 0e); F=$(L 0f); G=$(L 1a); Hh=$(L 1b); I=$(L 1c); J=$(L 1d); K=$(L 1e)

q "
insert into geofences (project_id, name, kind, geom, hysteresis_m, dwell_seconds, debounce_fixes, country) values
 ('$P','Załadunek test','LOADING',     make_circle_fence(52.0900,17.0200,  800), 200,   0, 2,'PL'),
 ('$P','Bufor Gdańsk',  'PRE_PORT',    make_circle_fence(54.4030,18.6800,20000), 500,   0, 2,'PL'),
 ('$P','Port Gdańsk',   'PORT_OUT',    make_circle_fence(54.4030,18.6800,  800), 200, 900, 2,'PL'),
 ('$P','Port Nynäshamn','PORT_IN',     make_circle_fence(58.9350,17.9500,  800), 200, 600, 2,'SE'),
 ('$P','Bufor Boden',   'PRE_ARRIVAL', make_circle_fence(65.8054,21.7591,50000),1000,   0, 2,'SE'),
 ('$P','Plac Stegra',   'SITE',        make_circle_fence(65.8054,21.7591, 1500), 300, 600, 2,'SE');
insert into vessels (id,name,operator) values
 ('66666666-0000-0000-0000-000000000001','M/F Wawel','Polferries'),
 ('66666666-0000-0000-0000-000000000002','M/F Nova Star','Polferries');
insert into sailings (id,project_id,vessel_id,departure_at,arrival_at,delayed_departure_at,delayed_arrival_at,status) values
 ('77777777-0000-0000-0000-000000000001','$P','66666666-0000-0000-0000-000000000001','2026-10-01 12:00+00','2026-10-02 06:00+00',null,null,'ZAPLANOWANY'),
 ('77777777-0000-0000-0000-000000000002','$P','66666666-0000-0000-0000-000000000002','2026-10-01 20:00+00','2026-10-02 14:00+00',null,null,'ODWOLANY'),
 ('77777777-0000-0000-0000-000000000003','$P','66666666-0000-0000-0000-000000000001','2026-10-01 16:00+00','2026-10-02 10:00+00','2026-10-01 19:00+00','2026-10-02 13:00+00','OPOZNIONY'),
 ('77777777-0000-0000-0000-000000000004','$P','66666666-0000-0000-0000-000000000002','2026-10-01 14:00+00','2026-10-02 08:00+00',null,null,'ZAPLANOWANY');
" >/dev/null
S1=77777777-0000-0000-0000-000000000001; S2=77777777-0000-0000-0000-000000000002; S3=77777777-0000-0000-0000-000000000003; S4=77777777-0000-0000-0000-000000000004
mk() { q "insert into loads (id,project_id,carrier_org_id,order_no,hhl_order_no,carrier_order_no,status,sailing_id)
          values ('$1','$P','$SCXO','KSH/$2',$3,$4,'$5',$6)" >/dev/null; }
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
chk "transport niegotowy: status bez zmian"                  "$(st $E)" DOCS_PENDING
chk "transport niegotowy: ryzyko wysokie"                    "$(rk $E LOADING_NOT_READY)" 1
chk "brak numeru przewoźnika: zmiana zablokowana"            "$(st $D)" READY
chk "brak numeru przewoźnika: ryzyko z przyczyną"            "select count(*) from risk_signals where load_id='$D' and title like '%przewoźnika%'" 1
chk "blokada statusu NIE przerwała zapisu pozycji"           "select count(*) from positions where load_id='$D'" 2
for x in $F; do pos $x 52.30 17.30 "2026-09-30 11:00+00"; pos $x 52.31 17.31 "2026-09-30 11:05+00"; done
chk "wyjazd bez potwierdzenia załadunku: status bez zmian"   "$(st $F)" AT_LOADING
chk "wyjazd bez potwierdzenia załadunku: ryzyko"             "$(rk $F LEFT_LOADING_UNCONFIRMED)" 1
q "insert into load_events (load_id,event_type,occurred_at) values ('$G','MILESTONE_LOADED','2026-09-30 10:30+00')" >/dev/null
pos $G 52.30 17.30 "2026-09-30 11:00+00"; pos $G 52.31 17.31 "2026-09-30 11:05+00"
chk "wyjazd po potwierdzeniu załadunku → IN_TRANSIT_PL"      "$(st $G)" IN_TRANSIT_PL

echo; echo "[2] Port Gdańsk — wjazd w strefę"
for x in $A $I $J; do pos $x 54.4030 18.6800 "2026-10-01 10:00+00"; pos $x 54.4031 18.6801 "2026-10-01 10:05+00"; done
chk "wjazd w strefę portu → AT_PORT_GDANSK"                   "$(st $A)" AT_PORT_GDANSK
chk "port bez potwierdzenia załadunku: ryzyko, status się zmienia" "$(rk $J PORT_NO_LOADED)" 1
chk "strefa bufora 20 km nie zmienia statusu"                 "select count(*) from load_events where load_id='$A' and event_type='STATUS_AUTO'" 1

echo; echo "[3] PROM — czas odejścia przypisanego rejsu"
chk "minuta przed odejściem: nic"                             "select promote_ferry_departures('2026-10-01 11:59+00')" 0
chk "odejście rejsu: trzy auta w strefie → PROM"              "select promote_ferry_departures('2026-10-01 12:01+00')" 3
chk "status A = FERRY"                                        "$(st $A)" FERRY
chk "auto poza strefą w chwili odejścia: status bez zmian"    "$(st $B)" IN_TRANSIT_PL
chk "auto poza strefą: ryzyko wysokie"                        "$(rk $B MISSED_SAILING)" 1
pos $A 55.50 18.90 "2026-10-01 12:30+00"; pos $A 55.51 18.91 "2026-10-01 12:35+00"
chk "statek odpływa, auto opuszcza strefę: status nadal PROM" "$(st $A)" FERRY

echo; echo "[4] PROM — zadanie uruchomione z opóźnieniem, statek już na morzu"
pos $Hh 54.4030 18.6800 "2026-10-01 13:00+00"; pos $Hh 54.4031 18.6801 "2026-10-01 13:05+00"
pos $Hh 55.50 18.90 "2026-10-01 14:30+00";    pos $Hh 55.51 18.91 "2026-10-01 14:35+00"
chk "auto było w strefie w chwili odejścia — przełączone mimo opóźnienia zadania" "select promote_ferry_departures('2026-10-01 16:30+00')" 1
chk "status H = FERRY"                                        "$(st $Hh)" FERRY
chk "brak fałszywego ryzyka przegapionego rejsu"             "$(rk $Hh MISSED_SAILING)" 0

echo; echo "[5] PROM — rejs opóźniony i odwołany"
pos $K 54.4030 18.6800 "2026-10-01 15:00+00"; pos $K 54.4031 18.6801 "2026-10-01 15:05+00"
q "select promote_ferry_departures('2026-10-01 16:30+00')" >/dev/null
chk "rozkładowa godzina minęła, rejs opóźniony: auto czeka w porcie" "$(st $K)" AT_PORT_GDANSK
chk "brak fałszywego ryzyka przy opóźnieniu"                  "$(rk $K MISSED_SAILING)" 0
q "select promote_ferry_departures('2026-10-01 19:01+00')" >/dev/null
chk "opóźnione odejście: → PROM"                             "$(st $K)" FERRY
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
chk "przeterminowany PROM: tylko auto bez sygnału po przypłynięciu" "select detect_ferry_overdue('2026-10-02 09:00+00')" 1
chk "ryzyko przeterminowanego PROMU dla właściwego auta"     "$(rk $J FERRY_OVERDUE)" 1

echo; echo "[7] Plac budowy — i nigdy automatycznego rozładunku"
pos $A 65.5000 21.7000 "2026-10-03 08:00+00"; pos $A 65.5001 21.7001 "2026-10-03 08:05+00"
pos $A 65.8054 21.7591 "2026-10-03 10:00+00"; pos $A 65.8055 21.7592 "2026-10-03 10:05+00"
chk "wjazd na plac → AT_SITE"                                "$(st $A)" AT_SITE
pos $A 65.8054 21.7591 "2026-10-03 10:30+00"
chk "postój na placu: nadal AT_SITE, NIGDY UNLOADED"         "$(st $A)" AT_SITE
pos $A 58.9350 17.9500 "2026-10-04 06:00+00"; pos $A 58.9351 17.9501 "2026-10-04 06:05+00"
chk "status nie cofa się przy ponownym wjeździe do portu"   "$(st $A)" AT_SITE
chk "pełna ścieżka A w dzienniku zdarzeń" \
  "select string_agg(payload->>'to', ' → ' order by occurred_at) from load_events where load_id='$A' and event_type='STATUS_AUTO'" \
  "AT_PORT_GDANSK → FERRY → AT_PORT_NYNASHAMN → IN_TRANSIT_SE → AT_SITE"

echo; echo "[8] Uprawnienia"
as() { $PSQL -c "begin; set local role authenticated; set local request.jwt.claim.sub='$1'; $2; rollback;" 2>&1 | grep -vE '^(BEGIN|SET|ROLLBACK)$' | tail -1; }
out=$(as $SCX "select promote_ferry_departures('2099-01-01')"); echo "$out" | grep -q "permission denied" && { ok=$((ok+1)); echo "  OK    użytkownik nie wywoła przełączania PROMU"; } || { fail=$((fail+1)); echo "  FAIL  $out"; }
chk "KSH widzi rozkład rejsów"  "select 4" "$(as $KSH "select count(*) from sailings")"
chk "SCX przypisuje rejs do swojego transportu" "select 1" "$(as $SCX "with u as (update loads set sailing_id='$S4' where id='$B' returning 1) select count(*) from u")"
chk "KSH nie przypisze rejsu"   "select 0" "$(as $KSH "with u as (update loads set sailing_id='$S4' where id='$B' returning 1) select count(*) from u")"
out=$($PSQL -c "begin; set local role authenticated; set local request.jwt.claim.sub='$SCX'; update loads set sailing_id='$S4' where id='$A'; rollback;" 2>&1); echo "$out" | grep -q "po wypłynięciu" && { ok=$((ok+1)); echo "  OK    przewoźnik nie zmieni rejsu po wypłynięciu"; } || { fail=$((fail+1)); echo "  FAIL  $out"; }

echo; echo "[9] Strefy w prawdziwych metrach — różnica od zadanego promienia poniżej 1%"
chk "port Gdańsk: 800 m"   "select abs(round(st_distance(st_centroid(geom)::geography, st_exteriorring(geom)::geography)::numeric) - 800) < 8   from geofences where name='Port Gdańsk'"   t
chk "plac Stegra: 1500 m"  "select abs(round(st_distance(st_centroid(geom)::geography, st_exteriorring(geom)::geography)::numeric) - 1500) < 15 from geofences where name='Plac Stegra'"   t
chk "bufor Boden: 50 km"   "select abs(round(st_distance(st_centroid(geom)::geography, st_exteriorring(geom)::geography)::numeric) - 50000) < 500 from geofences where name='Bufor Boden'" t
chk "auto 600 m od środka portu jest w strefie" "select st_contains(geom, st_setsrid(st_makepoint(18.6800 + 600/(111320*cos(radians(54.403))), 54.4030),4326)) from geofences where name='Port Gdańsk'" t

echo; echo "WYNIK: $ok OK, $fail FAIL"
[ "$fail" -eq 0 ]
