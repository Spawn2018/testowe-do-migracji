#!/usr/bin/env bash
# TOWER — BAF 0187+0189: GoEasy + publikacje + OSTATECZNY/PROGNOZA + wersja parametrów + ceny z wymiarów ładunku.
# Wzorce koordynatora (05.10): tydzień 21–27.09 → tydz. 40 = 1,14; tydzień 28.09–04.10 → tydz. 41 = 1,13.
# Progi = fragment tabeli z załącznika nr 1 (te same wartości co w bazie produkcyjnej).
set -e
ADMIN=${PGADMIN:-postgres://postgres@localhost:5433/postgres}
. "$(git rev-parse --show-toplevel)/tests/db/local-only.sh"
DB=tower_test_baf; URL="${ADMIN%/*}/$DB"
psql "$ADMIN" -q -c "drop database if exists $DB" -c "create database $DB"
psql "$URL" -q -v ON_ERROR_STOP=1 -f tests/db/supabase_stub.sql
for f in supabase/migrations/*.sql; do psql "$URL" -q -v ON_ERROR_STOP=1 -f "$f" >/dev/null 2>&1 || { echo "MIGRACJA $f"; exit 1; }; done
psql "$URL" -q -v ON_ERROR_STOP=1 -f tests/db/seed.sql
set +e

PSQL="psql $URL -Atq"
P=22222222-0000-0000-0000-000000000001
CAR=00000000-0000-0000-0000-00000000a003
CLI=00000000-0000-0000-0000-00000000a002
ok=0; fail=0
Q() { $PSQL -v ON_ERROR_STOP=1 -c "$1" 2>&1 | tail -1 | tr -d '\r'; }
sys() { $PSQL -v ON_ERROR_STOP=1 -c "$1" >/dev/null 2>&1 || { echo "  (sys błąd) $1" | head -c 300; echo; }; }
chk() { if [ "$2" = "$3" ]; then ok=$((ok+1)); echo "  OK    $1"; else fail=$((fail+1)); echo "  FAIL  $1  (otrzymano: $2, oczekiwano: $3)"; fi; }
# Triggery cen (trg_loads_price, trg_shipment_items_price) i sefs_refresh_prognoza liczą z PRAWDZIWĄ datą (Europe/Warsaw).
# Zestaw symuluje „dziś” jawnym p_today, więc przed pierwszym przeliczeniem z datą testu kasuje wycenę zapisaną z prawdziwej daty
# (inaczej migawka OSTATECZNY z prawdziwej daty zostaje i wynik zależy od dnia uruchomienia).
fresh_price() { local id; for id in "$@"; do sys "delete from load_cost where load_id='$id'"; sys "delete from load_revenue where load_id='$id'"; done; }

echo; echo "[BAF 0187+0189] GoEasy + publikacje + OSTATECZNY/PROGNOZA + ceny"

TS='[{"lte":21.9,"mult":1.09},{"lte":22.2,"mult":1.11},{"lte":22.5,"mult":1.12},{"lte":22.8,"mult":1.13},{"lte":23.1,"mult":1.14},{"lte":23.4,"mult":1.15},{"lte":23.7,"mult":1.16}]'
TP='[{"lte":6.9,"mult":1.11},{"lte":7.0,"mult":1.12},{"lte":7.1,"mult":1.13},{"lte":7.2,"mult":1.14},{"lte":7.3,"mult":1.15},{"lte":7.4,"mult":1.16},{"lte":7.5,"mult":1.17}]'
sys "insert into sefs_parameters (project_id, version, valid_from, rule, base_sek, base_pln, index_sek, index_pln, source_url_sek, source_url_pln, cycle, tiers_sek, tiers_pln, agreed_with_carrier, note, applies_to)
  values ('$P', 1, '2026-09-28', 'hybrid_min', 19.47, 5.698, 'OKQ8 GoEasy Diesel firmowa', 'ORLEN_EKODIESEL',
          'https://www.okq8.se/foretag/priser/', 'https://www.orlen.pl/pl/dla-biznesu/hurtowe-ceny-paliw', 'WEEKLY', '$TS', '$TP', true, 'baf test', 'BOTH')"

# Dzienne odczyty (kopie w dni bez publikacji) — data publikacji ustala trigger (zmiana ceny = publikacja).
sys "insert into fuel_index_readings (project_id, index_code, period, reading_date, value, source_url, source_note)
  select '$P', 'SEK', d, d::date, v, 'https://www.okq8.se/foretag/priser/', 'GoEasy test' from (values
   ('2026-09-21',23.34),('2026-09-22',22.54),('2026-09-23',22.54),('2026-09-24',22.94),('2026-09-25',23.34),('2026-09-26',23.34),('2026-09-27',23.34),
   ('2026-09-28',22.74),('2026-09-29',22.54),('2026-09-30',22.09),('2026-10-01',23.14),('2026-10-02',23.14),('2026-10-03',23.14),('2026-10-04',23.14),
   ('2026-10-05',22.29)) t(d, v) order by t.d"
# Orlen: data publikacji z cennika (effective date) — podana jawnie, jak z automatu
sys "insert into fuel_index_readings (project_id, index_code, period, reading_date, value, source_url, source_note, published_on)
  select '$P', 'PLN', d, d::date, v, 'https://www.orlen.pl/pl/dla-biznesu/hurtowe-ceny-paliw', 'Orlen test', pub::date from (values
   ('2026-09-22',7.440,'2026-09-22'),('2026-09-23',7.347,'2026-09-23'),('2026-09-24',7.342,'2026-09-24'),('2026-09-25',7.483,'2026-09-25'),
   ('2026-09-26',7.442,'2026-09-26'),('2026-09-27',7.442,'2026-09-26'),('2026-09-28',7.442,'2026-09-26'),
   ('2026-09-29',7.363,'2026-09-29'),('2026-09-30',7.255,'2026-09-30'),('2026-10-01',7.272,'2026-10-01'),('2026-10-02',7.280,'2026-10-02'),
   ('2026-10-03',6.943,'2026-10-03'),('2026-10-04',6.943,'2026-10-03'),('2026-10-05',6.943,'2026-10-03')) t(d, v, pub) order by t.d"

chk "data publikacji przy każdym odczycie" "$(Q "select count(*) filter (where published_on is null) from fuel_index_readings where project_id='$P'")" "0"
chk "kopia 03.10 SEK → publikacja 01.10" "$(Q "select published_on from fuel_index_readings where project_id='$P' and index_code='SEK' and period='2026-10-03'")" "2026-10-01"

W41="sefs_week_calc('$P','2026-10-06','2026-10-05')"
chk "tydz. 41: SEK publikacje 22,74/22,54/22,09/23,14 → 22,63 → 1,13" "$(Q "select ($W41->>'n_sek')||'/'||($W41->>'avg_sek')||'/'||($W41->>'mult_sek')")" "4/22.63/1.13"
chk "tydz. 41: PLN 5 publikacji → 7,22 → 1,15" "$(Q "select ($W41->>'n_pln')||'/'||($W41->>'avg_pln')||'/'||($W41->>'mult_pln')")" "5/7.22/1.15"
chk "tydz. 41: wynik 1,13 OSTATECZNY" "$(Q "select ($W41->>'applied_mult')||'/'||($W41->>'status')")" "1.13/OSTATECZNY"
W40="sefs_week_calc('$P','2026-10-01','2026-10-05')"
chk "tydz. 40: SEK 23,34/22,54/22,94/23,34 → 23,04 → 1,14" "$(Q "select ($W40->>'n_sek')||'/'||($W40->>'avg_sek')||'/'||($W40->>'mult_sek')")" "4/23.04/1.14"
chk "tydz. 40: PLN 7,440/7,347/7,342/7,483/7,442 → 7,41 → 1,17" "$(Q "select ($W40->>'n_pln')||'/'||($W40->>'avg_pln')||'/'||($W40->>'mult_pln')")" "5/7.41/1.17"
chk "tydz. 40: wynik 1,14" "$(Q "select $W40->>'applied_mult'")" "1.14"

# Tydzień bez publikacji: odczyty 12–18.10 to kopie (cena bez zmian) → ostatnia opublikowana
sys "insert into fuel_index_readings (project_id, index_code, period, reading_date, value, source_url, source_note)
  select '$P', 'SEK', to_char(d,'YYYY-MM-DD'), d, 22.29, 'https://www.okq8.se/foretag/priser/', 'kopia' from generate_series('2026-10-06'::date,'2026-10-18'::date,'1 day') d"
sys "insert into fuel_index_readings (project_id, index_code, period, reading_date, value, source_url, source_note)
  select '$P', 'PLN', to_char(d,'YYYY-MM-DD'), d, 6.943, 'https://www.orlen.pl/pl/dla-biznesu/hurtowe-ceny-paliw', 'kopia' from generate_series('2026-10-06'::date,'2026-10-18'::date,'1 day') d"
W43="sefs_week_calc('$P','2026-10-19','2026-10-19')"
chk "tydzień bez publikacji → ostatnia opublikowana (22,29 z 05.10)" "$(Q "select ($W43->>'n_sek')||'/'||($W43->>'fallback_last_sek')||'/'||($W43->>'avg_sek')||'/'||($W43->'pubs_sek'->0->>'published_on')")" "0/true/22.29/2026-10-05"
chk "brak odczytów w tygodniu → SOURCE_FAILURE (bez zgadywania)" "$(Q "select sefs_week_calc('$P','2026-12-07','2026-12-07')->>'reason'")" "SOURCE_FAILURE"

# Niepełny tydzień → wstępny; po niedzieli → ostateczny
chk "tydzień niepełny (dziś 08.10, załadunek 12.10) → PROGNOZA" "$(Q "select sefs_week_calc('$P','2026-10-12','2026-10-08')->>'status'")" "PROGNOZA"
chk "PROGNOZA = ostatni OSTATECZNY 1,13 (nie częściowa średnia)" "$(Q "select sefs_week_calc('$P','2026-10-12','2026-10-08')->>'applied_mult'")" "1.13"
chk "po niedzieli (dziś 12.10) → OSTATECZNY" "$(Q "select sefs_week_calc('$P','2026-10-12','2026-10-12')->>'status'")" "OSTATECZNY"

chk "tydzień przyszły → PROGNOZA 1,13 (ostatni OSTATECZNY)" "$(Q "select (sefs_week_calc('$P','2026-11-16','2026-10-06')->>'status')||'/'||(sefs_week_calc('$P','2026-11-16','2026-10-06')->>'applied_mult')")" "PROGNOZA/1.13"

# Cenniki SYMBOL (stawki z cennika produkcyjnego), transporty bez wymiarów zestawu (combo_* puste)
sys "insert into rate_cards (id, project_id, side, org_id, currency, valid_from, version, note) values
  ('44444444-0000-0000-0000-0000000bafc1','$P','COST','$CAR','EUR','2026-09-28',1,'baf test'),
  ('44444444-0000-0000-0000-0000000bafc2','$P','REVENUE','$CLI','EUR','2026-09-28',1,'baf test')"
sys "insert into rate_rules (rate_card_id, cargo_class, symbol, family, convoy_cars, length_from, length_to, width_from, width_to, height_from, height_to, weight_from, weight_to, base_rate)
  select c, 'SYMBOL', s, f, cv, 0, l, 0, w, 0, h, 0, t, case c when '44444444-0000-0000-0000-0000000bafc1' then rc else rr end
  from (values ('SG','SG',null::int,18.21,2.45,2.45,20.8,6900.00,7245.00),('PL-A','PL',null,14.70,2.45,2.45,22.1,5510.00,5785.50),
               ('PL-B','PL',null,14.70,3.40,2.45,14.6,9690.00,10174.50),('KR','KR',1,20.20,3.52,2.60,28.4,12745.00,13382.25),
               ('KR','KR',2,20.20,3.52,2.60,28.4,12290.00,12904.50),('KR','KR',3,20.20,3.52,2.60,28.4,11380.00,11949.00)) v(s,f,cv,l,w,h,t,rc,rr)
  cross join (values ('44444444-0000-0000-0000-0000000bafc1'::uuid),('44444444-0000-0000-0000-0000000bafc2'::uuid)) x(c)"
LSG=33333333-0000-0000-0000-0000000baf01; LPL=33333333-0000-0000-0000-0000000baf02
LK1=33333333-0000-0000-0000-0000000baf03; LK2=33333333-0000-0000-0000-0000000baf04
LCX=33333333-0000-0000-0000-0000000baf05; LNX=33333333-0000-0000-0000-0000000baf06
sys "insert into loads (id, project_id, carrier_org_id, order_no, plan_load_date) values
  ('$LSG','$P','$CAR','BAF/SG','2026-10-06'),('$LPL','$P','$CAR','BAF/PL','2026-10-06'),
  ('$LK1','$P','$CAR','BAF/K1','2026-10-07'),('$LK2','$P','$CAR','BAF/K2','2026-10-07'),
  ('$LCX','$P','$CAR','BAF/CX','2026-10-06'),('$LNX','$P','$CAR','BAF/NX','2026-10-12')"
sys "insert into shipment_items (project_id, load_id, shipment_code, cargo_class, length_m, width_m, height_m, total_weight_t) values
  ('$P','$LSG','SG-B1','DIMENSIONED',18.21,2.45,2.45,20.0), ('$P','$LPL','PL-1','DIMENSIONED',14.7,3.4,2.6,14.0),
  ('$P','$LK1','KR-B1','DIMENSIONED',20.0,3.5,2.5,28.0), ('$P','$LK2','KR-B2','DIMENSIONED',20.0,3.5,2.5,28.0),
  ('$P','$LCX','SG-B2','DIMENSIONED',18.0,2.4,2.4,19.0), ('$P','$LNX','SG-B3','DIMENSIONED',18.0,2.4,2.4,19.0)"
# A7 trigger wypełnia combo_* z symbol_specs — ten zestaw sprawdza ścieżkę CARGO (wymiary ładunku).
sys "update loads set combo_length_m=null, combo_width_m=null, combo_height_m=null, escort_vehicles=null
     where id in ('$LSG','$LPL','$LK1','$LK2','$LCX','$LNX')"
fresh_price "$LSG" "$LPL" "$LK1" "$LK2" "$LCX" "$LNX"

chk "combo_* puste — stawka z wymiarów ładunku" "$(Q "select count(*) from loads where id in ('$LSG','$LPL','$LK1','$LK2') and combo_length_m is null")" "4"
sys "select load_price_compute(id, '2026-10-05') from loads where id in ('$LSG','$LPL','$LK1','$LK2','$LCX')"
chk "SG: koszt 6900 + 6900×0,13 = 7797,00 (1,13)" "$(Q "select base_amount||'/'||fuel_applied_mult::numeric(4,2)||'/'||baf_amount||'/'||total_amount from load_cost where load_id='$LSG'")" "6900.00/1.13/897.00/7797.00"
chk "SG: przychód 7245 → 8186,85" "$(Q "select base_amount||'/'||baf_amount||'/'||total_amount from load_revenue where load_id='$LSG'")" "7245.00/941.85/8186.85"
chk "SG: źródło wymiarów = ładunek" "$(Q "select rate_basis->>'dims_source' from load_cost where load_id='$LSG'")" "CARGO"
chk "PL-1 @2,60 → PL-B 9690 (jak 2,45)" "$(Q "select (rate_basis->>'symbol')||'/'||base_amount||'/'||baf_amount from load_cost where load_id='$LPL'")" "PL-B/9690.00/1259.70"
chk "KR konwój 2 → 12290 koszt / 12904,50 przychód" "$(Q "select c.base_amount||'/'||r.base_amount||'/'||c.baf_amount from load_cost c join load_revenue r using (load_id) where load_id='$LK1'")" "12290.00/12904.50/1597.70"
# Anulowanie i postój: opłaty uzgodnione bez dopłaty paliwowej
sys "update load_cost set extras_amount = 500, extras = '[{\"code\":\"AGREED_POSTOJOWE\",\"amountEur\":500}]' where load_id='$LSG'"
sys "select load_price_compute('$LSG', '2026-10-05')"
chk "postojowe 500 bez dopłaty: 6900+897+500" "$(Q "select baf_amount||'/'||total_amount from load_cost where load_id='$LSG'")" "897.00/8297.00"
sys "update loads set status='CANCELLED' where id='$LCX'"
sys "select load_price_compute('$LCX', '2026-10-05')"
chk "anulowany: brak dopłaty paliwowej" "$(Q "select coalesce(baf_amount::text,'∅')||'/'||baf_pct::numeric(6,2) from load_cost where load_id='$LCX'")" "0.00/0.00"

LND=33333333-0000-0000-0000-0000000baf07
sys "insert into loads (id, project_id, carrier_org_id, order_no) values ('$LND','$P','$CAR','BAF/ND')"
sys "insert into shipment_items (project_id, load_id, shipment_code, cargo_class, length_m, width_m, height_m, total_weight_t) values ('$P','$LND','SG-B4','DIMENSIONED',18.0,2.4,2.4,19.0)"
sys "update loads set combo_length_m=null, combo_width_m=null, combo_height_m=null, escort_vehicles=null where id='$LND'"
sys "select load_price_compute('$LND', '2026-10-08')"
chk "bez daty załadunku → cena z mnożnikiem PROGNOZA" "$(Q "select base_amount||'/'||fuel_status||'/'||coalesce(fuel_ref_date::text,'∅') from load_cost where load_id='$LND'")" "6900.00/PROGNOZA/∅"

# Wstępny → ostateczny + migawka
sys "select load_price_compute('$LNX', '2026-10-08')"
chk "załadunek 12.10, dziś 08.10 → PROGNOZA" "$(Q "select fuel_status||'/'||fuel_applied_mult::numeric(4,2) from load_cost where load_id='$LNX'")" "PROGNOZA/1.13"
sys "select load_price_compute('$LNX', '2026-10-12')"
M1=$(Q "select fuel_applied_mult from load_cost where load_id='$LNX'")
chk "po niedzieli → OSTATECZNY (migawka)" "$(Q "select fuel_status from load_cost where load_id='$LNX'")" "OSTATECZNY"
sys "insert into fuel_index_readings (project_id, index_code, period, reading_date, value, source_url, source_note, corrects_id, correction_reason)
  select project_id, index_code, period, reading_date, 30.00, source_url, 'korekta po zamknięciu', id, 'test 0166'
    from fuel_index_readings where project_id='$P' and index_code='SEK' and period='2026-10-05' and corrects_id is null"
sys "select load_price_compute('$LNX', '2026-10-13')"
chk "korekta po zamknięciu nie zmienia migawki" "$(Q "select fuel_applied_mult||'/'||fuel_status from load_cost where load_id='$LNX'")" "$M1/OSTATECZNY"

# Nowa wersja tabeli od 12.10 → stare transporty bez zmian
sys "insert into sefs_parameters (project_id, version, valid_from, rule, base_sek, base_pln, index_sek, index_pln, source_url_sek, source_url_pln, cycle, tiers_sek, tiers_pln, agreed_with_carrier, note, applies_to)
  values ('$P', 2, '2026-10-12', 'hybrid_min', 19.47, 5.698, 'OKQ8 GoEasy Diesel firmowa', 'ORLEN_EKODIESEL',
          'https://www.okq8.se/foretag/priser/', 'https://www.orlen.pl/pl/dla-biznesu/hurtowe-ceny-paliw', 'WEEKLY',
          '[{\"lte\":99,\"mult\":1.25}]', '[{\"lte\":99,\"mult\":1.25}]', true, 'baf test v2', 'BOTH')"
chk "tydz. 41 nadal z wersji 1 (valid_from)" "$(Q "select ($W41->>'params_version')||'/'||($W41->>'applied_mult')")" "1/1.13"
chk "załadunek od 12.10 bierze wersję 2" "$(Q "select sefs_week_calc('$P','2026-10-13','2026-10-13')->>'params_version'")" "2"
sys "select load_price_compute('$LSG', '2026-10-13')"
chk "stary transport (06.10) bez zmian po nowej wersji" "$(Q "select fuel_applied_mult::numeric(4,2)||'/'||baf_amount from load_cost where load_id='$LSG'")" "1.13/897.00"

# 0189 PROGNOZA: dziś 06.10 — przyszłe załadunki = 1,13 prognoza; po zamknięciu tyg. 41 → tyg. 42 ostateczny
chk "dziś 06.10 załadunek 16.10 → 1,13 PROGNOZA" "$(Q "select (sefs_week_calc('$P','2026-10-16','2026-10-06')->>'applied_mult')||'/'||(sefs_week_calc('$P','2026-10-16','2026-10-06')->>'status')")" "1.13/PROGNOZA"
chk "dziś 06.10 załadunek 15.12 → 1,13 PROGNOZA" "$(Q "select (sefs_week_calc('$P','2026-12-15','2026-10-06')->>'applied_mult')||'/'||(sefs_week_calc('$P','2026-12-15','2026-10-06')->>'status')")" "1.13/PROGNOZA"
# niepełny tydzień 41 NIE daje 1,12 z jednego GoEasy 05.10
chk "niepełny tydzień nie daje częściowej średniej 1,12" "$(Q "select sefs_week_calc('$P','2026-10-16','2026-10-06')->>'applied_mult'")" "1.13"
W42C="sefs_week_calc('$P','2026-10-13','2026-10-12')"
chk "po zamknięciu tyg. 41: załadunek tyg. 42 → OSTATECZNY" "$(Q "select $W42C->>'status'")" "OSTATECZNY"
M42=$(Q "select $W42C->>'applied_mult'")
chk "po zamknięciu: późniejszy tydzień → PROGNOZA = ostatni OSTATECZNY (tyg. 42)" "$(Q "select (sefs_week_calc('$P','2026-10-20','2026-10-12')->>'status')||'/'||(sefs_week_calc('$P','2026-10-20','2026-10-12')->>'applied_mult')")" "PROGNOZA/$M42"
LF1=33333333-0000-0000-0000-0000000baf09
sys "insert into loads (id, project_id, carrier_org_id, order_no, plan_load_date) values ('$LF1','$P','$CAR','BAF/F1','2026-10-16')"
sys "insert into shipment_items (project_id, load_id, shipment_code, cargo_class, length_m, width_m, height_m, total_weight_t) values ('$P','$LF1','SG-F1','DIMENSIONED',18.21,2.45,2.45,20.0)"
fresh_price "$LF1"
sys "select load_price_compute('$LF1', '2026-10-06')"
chk "transport przyszły: 1,13 PROGNOZA w load_cost" "$(Q "select fuel_applied_mult::numeric(4,2)||'/'||fuel_status from load_cost where load_id='$LF1'")" "1.13/PROGNOZA"
sys "select load_price_compute('$LF1', '2026-10-12')"
chk "po zamknięciu tyg. 41: ten sam transport → OSTATECZNY" "$(Q "select fuel_status from load_cost where load_id='$LF1'")" "OSTATECZNY"
LF2=33333333-0000-0000-0000-0000000baf0a
sys "insert into loads (id, project_id, carrier_org_id, order_no, plan_load_date) values ('$LF2','$P','$CAR','BAF/F2','2026-10-20')"
sys "insert into shipment_items (project_id, load_id, shipment_code, cargo_class, length_m, width_m, height_m, total_weight_t) values ('$P','$LF2','SG-F2','DIMENSIONED',18.21,2.45,2.45,20.0)"
fresh_price "$LF2"
sys "select load_price_compute('$LF2', '2026-10-06')"
chk "F2 przed zamknięciem: PROGNOZA 1,13" "$(Q "select fuel_applied_mult::numeric(4,2)||'/'||fuel_status from load_cost where load_id='$LF2'")" "1.13/PROGNOZA"
sys "select sefs_refresh_prognoza('$P')" >/dev/null
fresh_price "$LF2"
# po „zamknięciu" — ręcznie przelicz z dziś=12.10
sys "select load_price_compute('$LF2', '2026-10-12')"
M42L=$(Q "select fuel_applied_mult from load_cost where load_id='$LF1'")
chk "F2 po zamknięciu: PROGNOZA = OSTATECZNY z tyg. 42" "$(Q "select fuel_status||'/'||fuel_applied_mult from load_cost where load_id='$LF2'")" "PROGNOZA/$M42L"

# TELM 0188: podłączenie w trasie 05.10, plan załadunku 01.10 → actual pusty, tydzień paliwa 40, 1,14
LTM=33333333-0000-0000-0000-0000000baf08
sys "insert into loads (id, project_id, carrier_org_id, order_no, plan_load_date) values ('$LTM','$P','$CAR','BAF/TM','2026-10-01')"
sys "insert into shipment_items (project_id, load_id, shipment_code, cargo_class, length_m, width_m, height_m, total_weight_t) values ('$P','$LTM','SG-B5','DIMENSIONED',18.21,2.45,2.45,20.0)"
chk "TELM: faza z pozycji SE przy podłączeniu" "$(Q "select telm_infer_phase_from_position('$LTM', 60.5, 17.2, '2026-10-05 13:21+02')")" "IN_TRANSIT_SE"
chk "TELM: rzeczywisty załadunek pusty po podłączeniu" "$(Q "select coalesce(actual_load_at::text,'∅') from loads where id='$LTM'")" "∅"
chk "TELM: faza zapisana osobno z adnotacją" "$(Q "select phase||'/'||note from telm_attach_phase where load_id='$LTM'")" "IN_TRANSIT_SE/faza z pozycji przy podłączeniu"
chk "TELM: data paliwa = plan KSH 01.10 (tydz. 40)" "$(Q "select fuel_load_date('$LTM')")" "2026-10-01"
sys "select load_price_compute('$LTM', '2026-10-05')"
chk "TELM: mnożnik 1,14 OSTATECZNY" "$(Q "select fuel_applied_mult::numeric(4,2)||'/'||fuel_status from load_cost where load_id='$LTM'")" "1.14/OSTATECZNY"
# Stara ścieżka 0176 (actual = chwila podłączenia) → korekta
sys "update loads set actual_load_at = '2026-10-05 13:21+02' where id='$LTM'"
chk "korekta: poprawiono 1 transport (BAF/TM)" "$(Q "select string_agg(order_no, ',') from telm_fix_attach_actual_load()")" "BAF/TM"
chk "korekta: actual pusty, mnożnik 1,14" "$(Q "select coalesce(l.actual_load_at::text,'∅')||'/'||c.fuel_applied_mult::numeric(4,2) from loads l join load_cost c on c.load_id=l.id where l.id='$LTM'")" "∅/1.14"
# Rzeczywisty wyjazd ze strefy (niesyntetyczny) nie jest kasowany
sys "update loads set actual_load_at = '2026-10-05 13:21+02' where id='$LTM'"
sys "insert into load_events (load_id, event_type, occurred_at, payload) values ('$LTM','GEOFENCE_EXIT','2026-10-01 18:00+02','{\"geofence_kind\":\"LOADING\"}')"
chk "korekta: rzeczywisty wyjazd GPS zostaje" "$(Q "select count(*) from telm_fix_attach_actual_load()")" "0"

echo; echo "WYNIK: $ok OK, $fail FAIL"
[ "$fail" -eq 0 ]
