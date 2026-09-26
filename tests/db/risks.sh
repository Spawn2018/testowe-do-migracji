#!/usr/bin/env bash
# TOWER — A6-T1 (0042): każda funkcja bazy zapisująca ryzyko zapisuje niepusty, nie-generyczny `title_key`
# i parametry w detail.params (tekst w języku odbiorcy po stronie aplikacji). Wyzwalacz: brak klucza → rk_generic.
# Funkcje automatu geofence/promów (auto_set_status, apply_geofence_status, detect_ferry_overdue,
# promote_ferry_departures) sprawdzane na bazie tower_test_status po tests/db/run.sh (gate uruchamia ten skrypt po nim).
# Użycie: PGADMIN=postgres://postgres@localhost:5433/postgres bash tests/db/risks.sh
set -e
cd "$(git rev-parse --show-toplevel)"
ADMIN=${PGADMIN:-postgres://postgres@localhost:5433/postgres}
DB=tower_test_risks; URL="${ADMIN%/*}/$DB"
psql "$ADMIN" -q -c "drop database if exists $DB" -c "create database $DB"
psql "$URL" -q -v ON_ERROR_STOP=1 -f tests/db/supabase_stub.sql
for f in supabase/migrations/*.sql; do psql "$URL" -q -v ON_ERROR_STOP=1 -f "$f" >/dev/null 2>&1 || { echo "MIGRACJA $f: błąd"; exit 1; }; done
psql "$URL" -q -v ON_ERROR_STOP=1 -f tests/db/seed.sql
set +e
PSQL="psql $URL -Atq"
P=22222222-0000-0000-0000-000000000001; L1=33333333-0000-0000-0000-000000000001; L2=33333333-0000-0000-0000-000000000002
ok=0; fail=0
Q() { $PSQL -c "$1" 2>&1 | tail -1; }
chk() { if [ "$2" = "$3" ]; then ok=$((ok+1)); echo "  OK    $1"; else fail=$((fail+1)); echo "  FAIL  $1  (otrzymano: $2, oczekiwano: $3)"; fi; }
key() { Q "select string_agg(distinct title_key, ',' order by title_key) from risk_signals where $1"; }
# przygotowanie danych z pominięciem wyzwalaczy przejść statusu (tylko fixture)
fx() { $PSQL -c "set session_replication_role = replica; $1" >/dev/null 2>&1 || echo "  (fixture błąd: $1)"; }

echo; echo "[0042] title_key w każdej funkcji zapisującej ryzyko"
chk "kolumna risk_signals.title_key istnieje" "$(Q "select count(*) from information_schema.columns where table_name='risk_signals' and column_name='title_key'")" 1

fx "update loads set status='IN_TRANSIT_PL', tractor_plate='WGM 1234' where id='$L1'"
Q "select detect_silent_vehicles(90)" >/dev/null
chk "detect_silent_vehicles → rk_silent_vehicle" "$(key "kind='SILENT_VEHICLE'")" rk_silent_vehicle
chk "detect_silent_vehicles: params plate i minutes" "$(Q "select (detail->'params'->>'plate')||'/'||(detail->'params'->>'minutes') from risk_signals where kind='SILENT_VEHICLE'")" "WGM 1234/90"
chk "tytuł PL bez zmian (dziennik)" "$(Q "select title from risk_signals where kind='SILENT_VEHICLE'")" "Brak pozycji pojazdu WGM 1234 od 90 min"

fx "update loads set plan_delivery_date='2026-10-10' where id='$L1'; update loads set plan_delivery_date='2026-10-01' where id='$L2';
    insert into shipment_items (project_id, load_id, shipment_code, length_m, width_m, height_m, assembly_seq) values
    ('$P','$L1','SG-01',10,3,3,1), ('$P','$L2','SG-02',10,3,3,2)"
Q "select detect_sequence_risk('$P')" >/dev/null
chk "detect_sequence_risk → rk_sequence" "$(key "kind='SEQUENCE'")" rk_sequence
chk "detect_sequence_risk: params early/late" "$(Q "select (detail->'params'->>'early')||'>'||(detail->'params'->>'late') from risk_signals where kind='SEQUENCE'")" "SG-01>SG-02"

fx "update loads set status='PLANNED', plan_load_date=current_date, hhl_order_no=null, carrier_order_no=null where id='$L2'"
Q "select detect_missing_order_numbers(now())" >/dev/null
chk "detect_missing_order_numbers → rk_order_no_carrier, rk_order_no_hhl" "$(key "dedup_key like 'ORDERNO%'")" "rk_order_no_carrier,rk_order_no_hhl"
chk "detect_missing_order_numbers: meta_key i text_key" "$(Q "select string_agg(distinct (detail->>'meta_key')||'+'||(detail->>'text_key'), ',' order by (detail->>'meta_key')||'+'||(detail->>'text_key')) from risk_signals where dedup_key like 'ORDERNO%'")" "risk_meta_carrier+rk_order_no_carrier_text,risk_meta_hhl+rk_order_no_hhl_text"

Q "select record_usage('DB_BYTES', 360000000, 500000000)" >/dev/null
chk "record_usage 72% → rk_usage_warn, metric_key" "$(Q "select title_key||'/'||(detail->'params'->>'metric_key') from risk_signals where kind='USAGE_LIMIT' or dedup_key like 'USAGE%' limit 1")" "rk_usage_warn/usage_metric_DB_BYTES"
Q "select record_usage('DB_BYTES', 430000000, 500000000)" >/dev/null
chk "record_usage 86% → rk_usage_high" "$(Q "select string_agg(distinct title_key, ',') from risk_signals where title_key like 'rk_usage%' and resolved_at is null")" rk_usage_high

Q "select job_watchdog('2026-10-01 12:00+02')" >/dev/null
chk "job_watchdog → rk_job_failure" "$(key "kind='JOB_FAILURE'")" rk_job_failure
chk "job_watchdog: label_key dla 3 zadań" "$(Q "select string_agg(detail->'params'->>'label_key', ',' order by detail->'params'->>'label_key') from risk_signals where kind='JOB_FAILURE'")" "job_label_ferry_ais,job_label_send_notifications,job_label_usage_check"

Q "select raise_integration_risk('$P', null, 'FERRY', 'HIGH', 'Źródło niedostępne: rozkład promów (Polferries) — HHL weryfikuje ręcznie', '{\"title_key\":\"rk_source_down\",\"params\":{\"source\":\"x\",\"source_key\":\"rk_src_POLFERRIES_SCHEDULE\"}}', 'SOURCE_DOWN:A6')" >/dev/null
chk "raise_integration_risk (Edge) → klucz z detail.title_key" "$(key "dedup_key='SOURCE_DOWN:A6'")" rk_source_down

chk "wyzwalacz: brak klucza → rk_generic z params.title" "$($PSQL -c "insert into risk_signals (project_id, kind, severity, title, detail) values ('$P','FERRY','LOW','Stary tekst','{}') returning title_key||'|'||(detail->'params'->>'title')" 2>/dev/null | head -1)" "rk_generic|Stary tekst"
echo; echo "[0043] strażnik rk_generic → ryzyko HHL + e-mail ALERT_EMAIL_TO"
chk "strażnik: 1 ryzyko rk_key_guard (JOB_FAILURE, HIGH, audience HHL)" "$(Q "select count(*)||'/'||string_agg(kind::text||','||severity::text||','||audience::text, ';') from risk_signals where title_key='rk_key_guard'")" "1/JOB_FAILURE,HIGH,HHL"
chk "strażnik: params kind/title, job risk-key-guard" "$(Q "select (detail->'params'->>'kind')||'|'||(detail->'params'->>'title')||'|'||(detail->>'job') from risk_signals where title_key='rk_key_guard'")" "FERRY|Stary tekst|risk-key-guard"
chk "strażnik: e-mail — bez sekretów Vault lokalnie → BRAK_SEKRETOW" "$(Q "select detail->>'mail' from risk_signals where title_key='rk_key_guard'")" BRAK_SEKRETOW
$PSQL -c "insert into risk_signals (project_id, kind, severity, title, detail) values ('$P','FERRY','LOW','Drugi stary','{}')" >/dev/null 2>&1
chk "strażnik: drugie rk_generic tego samego rodzaju → bez duplikatu (i bez drugiego e-maila)" "$(Q "select count(*) from risk_signals where title_key='rk_key_guard'")" 1
chk "strażnik: zapis pierwotnego ryzyka nie jest blokowany" "$(Q "select count(*) from risk_signals where title_key='rk_generic'")" 2
$PSQL -c "insert into risk_signals (project_id, kind, severity, title, detail) values ('$P','ROAD_SE','LOW','Inny rodzaj','{}')" >/dev/null 2>&1
chk "strażnik: inny rodzaj → drugie ryzyko strażnika" "$(Q "select count(*) from risk_signals where title_key='rk_key_guard'")" 2
chk "wszystkie ryzyka funkcji: 0 bez klucza, 0 generycznych" "$(Q "select count(*) from risk_signals where (title_key is null or title_key='rk_generic') and title not in ('Stary tekst','Drugi stary','Inny rodzaj')")" 0

ST="${ADMIN%/*}/tower_test_status"
if psql "$ST" -Atqc "select 1" >/dev/null 2>&1; then
  chk "automat statusów/promów (tower_test_status): 7 kluczy, 0 generycznych" \
    "$(psql "$ST" -Atqc "select count(distinct title_key)||'/'||count(*) filter (where title_key is null or title_key='rk_generic') from risk_signals")" "7/0"
  chk "automat: klucze funkcji" "$(psql "$ST" -Atqc "select string_agg(distinct title_key, ',' order by title_key) from risk_signals")" \
    "rk_auto_status_blocked,rk_ferry_overdue,rk_left_loading_unconfirmed,rk_loading_not_ready,rk_missed_sailing,rk_port_no_loaded,rk_sailing_cancelled"
else
  fail=$((fail+2)); echo "  FAIL  brak bazy tower_test_status — uruchom najpierw tests/db/run.sh"
fi
echo; echo "WYNIK: $ok OK, $fail FAIL"
