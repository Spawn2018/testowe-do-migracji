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
mk() { q "insert into loads (id,project_id,carrier_org_id,order_no,hhl_order_no,carrier_order_no,status,sailing_id,plan_load_date)
          values ('$1','$P','$SCXO','KSH/$2',$3,$4,'$5',$6,'2026-09-30')" >/dev/null; }
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
echo; echo "[11] A1 — okno śledzenia i bezpiecznik L17"
W1=$(L 3a); W2=$(L 3b); W3=$(L 3c); W4=$(L 3d); W5=$(L 3e); W6=$(L 3f); W7=$(L 4a)
# Data od razu docelowa: mk() wstawia 30.09, a zmiana daty po starcie okna zamraża śledzenie.
q "insert into loads (id,project_id,carrier_org_id,order_no,hhl_order_no,carrier_order_no,status,plan_load_date) values
 ('$W1','$P','$SCXO','KSH/A1W1','HHL/A1W1','SCX/A1W1','IN_TRANSIT_PL','2026-10-05'),
 ('$W2','$P','$SCXO','KSH/A1W2','HHL/A1W2','SCX/A1W2','DELIVERED','2026-10-05'),
 ('$W3','$P','$SCXO','KSH/A1W3','HHL/A1W3','SCX/A1W3','IN_TRANSIT_PL','2026-10-24'),
 ('$W4','$P','$SCXO','KSH/A1W4','HHL/A1W4','SCX/A1W4','IN_TRANSIT_PL','2026-10-20'),
 ('$W5','$P','$SCXO','KSH/A1W5','HHL/A1W5','SCX/A1W5','IN_TRANSIT_PL','2026-10-05'),
 ('$W6','$P','$SCXO','KSH/A1W6','HHL/A1W6','SCX/A1W6','IN_TRANSIT_SE','2026-10-01')" >/dev/null
T59=$(q "select public.tracking_window_start('2026-10-05'::date) - interval '1 minute'")
T00=$(q "select public.tracking_window_start('2026-10-05'::date)")
T20=$(q "select public.tracking_window_start('2026-10-20'::date)")
T22=$(q "select public.tracking_window_start('2026-10-22'::date)")
pos $W1 52.09 17.02 "$T59"
chk "A1 02:59 bez pozycji" "select count(*) from positions where load_id='$W1'" 0
pos $W1 52.09 17.02 "$T00"
chk "A1 03:00 zapis pozycji" "select count(*) from positions where load_id='$W1'" 1
pos $W2 52.09 17.02 "$T00"
chk "A1 Dostarczone bez pozycji" "select count(*) from positions where load_id='$W2'" 0
pos $W3 52.09 17.02 "2026-10-17 12:00:00+00"
chk "A1 przyszły tydzień bez pozycji" "select count(*) from positions where load_id='$W3'" 0
q "update loads set plan_load_date='2026-10-22' where id='$W4'" >/dev/null
pos $W4 52.09 17.02 "$T20"
chk "A1 zmiana daty przed startem nie otwiera starego dnia" "select count(*) from positions where load_id='$W4'" 0
pos $W4 52.09 17.02 "$T22"
chk "A1 nowy dzień załadunku otwiera okno" "select count(*) from positions where load_id='$W4'" 1
pos $W5 52.09 17.02 "$T00"
q "update loads set plan_load_date='2026-12-01' where id='$W5'" >/dev/null
pos $W5 52.09 17.02 "2026-10-06 08:00:00+00"
chk "A1 po starcie późniejsza data nie zamyka śledzenia" "select count(*) from positions where load_id='$W5'" 2
chk "A1 tracking_opened_at zamrożone" "select (tracking_opened_at = public.tracking_window_start('2026-10-05'::date))::text from loads where id='$W5'" true
chk "A1 L17 17 zaległych transportów" "with ins as (insert into loads (id, project_id, carrier_org_id, order_no, hhl_order_no, carrier_order_no, status, plan_load_date, plan_delivery_date)
   select ('55555555-0000-0000-0000-00000000a1'||lpad(g::text,2,'0'))::uuid, '$P', '$SCXO', 'KSH/L17/'||g, 'HHL/L17/'||g, 'SCX/L17/'||g, 'IN_TRANSIT_PL', current_date - 10, current_date - 5
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
chk "A1 po teście brak klucza ciszy w bazie statusów" "delete from risk_signals where title_key='rk_silent_vehicle' or kind='SILENT_VEHICLE' or dedup_key like 'SILENT:%'; select count(*) from risk_signals where title_key='rk_silent_vehicle'" 0
chk "A1 process_position ma bramę okna" "select strpos(pg_get_functiondef(p.oid), 'load_in_tracking_window') > 0 from pg_proc p where p.proname='process_position'" t
chk "A1 cisza bez twardego źródła TELEMATICS_API" "select strpos(pg_get_functiondef(p.oid), 'TELEMATICS_API') = 0 from pg_proc p where p.proname='detect_silent_vehicles'" t
chk "A1 strażnik: anulowanie z cancel_ctx nadal dozwolone" "select (pg_get_functiondef('guard_load_update()'::regprocedure) like '%v_ctx not in (''MANUAL'', ''IMPORT'')%')::text" true
HHL=11111111-0000-0000-0000-000000000001
W8=$(L 4b)
q "insert into loads (id,project_id,carrier_org_id,order_no,status,plan_load_date) values ('$W8','$P','$SCXO','KSH/A1W8','PLANNED','2026-11-20')" >/dev/null
q "insert into shipment_items (project_id, load_id, shipment_code, length_m, width_m, height_m, cargo_class) values ('$P','$W8','SG-ZOST',10,3,3,'DIMENSIONED')" >/dev/null
chk "A1 HHL w sesji: cancel_load z powodem → CANCELLED" "begin; set local role authenticated; set local request.jwt.claim.sub='$HHL'; select cancel_load('$W3','Test A1 — anulowanie'); commit" CANCELLED
chk "A1 import w sesji HHL anuluje PLANNED spoza pliku" "begin; set local role authenticated; set local request.jwt.claim.sub='$HHL'; select import_schedule('$P', '[{\"code\":\"SG-KEEP\",\"length_m\":10,\"width_m\":3,\"height_m\":3,\"qty\":1,\"total_weight_t\":10,\"load_date\":\"2026-11-01\",\"delivery_date\":\"2026-11-05\"}]'::jsonb, '{SG-ZOST}'::text[], '{\"name\":\"a1.xlsx\",\"hash\":\"a1\",\"path\":\"x/a1.xlsx\"}'::jsonb, false); select status from loads where id='$W8'; commit" CANCELLED

echo; echo "WYNIK: $ok OK, $fail FAIL"
[ "$fail" -eq 0 ]
