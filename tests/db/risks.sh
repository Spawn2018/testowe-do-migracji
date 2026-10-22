#!/usr/bin/env bash
# TOWER — A6-T1 (0042): każda funkcja bazy zapisująca ryzyko zapisuje niepusty, nie-generyczny `title_key`
# i parametry w detail.params (tekst w języku odbiorcy po stronie aplikacji). Wyzwalacz: brak klucza → rk_generic.
# Funkcje automatu geofence/promów (auto_set_status, apply_geofence_status, detect_ferry_overdue,
# promote_ferry_departures) sprawdzane na bazie tower_test_status po tests/db/run.sh (gate uruchamia ten skrypt po nim).
# Użycie: PGADMIN=postgres://postgres@localhost:5433/postgres bash tests/db/risks.sh
set -e
cd "$(git rev-parse --show-toplevel)"
ADMIN=${PGADMIN:-postgres://postgres@localhost:5433/postgres}
. "$(git rev-parse --show-toplevel)/tests/db/local-only.sh"
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

fx "update loads set status='IN_TRANSIT_PL', tractor_plate='WGM 1234', plan_load_date=current_date - 1, telematics_vehicle_id='TEL-SILENT-1' where id='$L1'"
$PSQL -c "insert into positions (load_id, ts, geom_raw, source) values ('$L1', now() - interval '3 hours', st_setsrid(st_makepoint(18.0,53.0),4326), 'TELEMATICS_API')" >/dev/null
Q "select detect_silent_vehicles(90)" >/dev/null
chk "detect_silent_vehicles → rk_silent_vehicle" "$(key "kind='SILENT_VEHICLE'")" rk_silent_vehicle
# B7 / E15: SILENT_MIN = 30
chk "detect_silent_vehicles: params plate i minutes" "$(Q "select (detail->'params'->>'plate')||'/'||(detail->'params'->>'minutes') from risk_signals where kind='SILENT_VEHICLE'")" "WGM 1234/30"
chk "tytuł PL bez zmian (dziennik)" "$(Q "select title from risk_signals where kind='SILENT_VEHICLE'")" "Brak pozycji pojazdu WGM 1234 od 30 min"

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
if [ -n "${TOWER_HOSTED_READY:-}" ]; then
  # Hosted: brak CREATE DATABASE / osobnej bazy po status.sh — SKIP (nie luzujemy asercji lokalnej).
  echo "  SKIP  automat statusów/promów (tower_test_status) — wymaga osobnej bazy (CREATE DATABASE), niedostępne na hosted"
  echo "  SKIP  automat: klucze funkcji — j.w."
elif psql "$ST" -Atqc "select 1" >/dev/null 2>&1; then
  # A2 (E26): brak LEFT_LOADING_UNCONFIRMED — wyjazd ze Śremu bez loaded_confirmed
  # #461 F7: bez rk_no_departure / rk_missed_sailing przy nieodwołanym — 5 kluczy (było 7)
  chk "automat statusów/promów (tower_test_status): 5 kluczy, 0 generycznych" \
    "$(psql "$ST" -Atqc "select count(distinct title_key)||'/'||count(*) filter (where title_key is null or title_key='rk_generic') from risk_signals")" "5/0"
  chk "automat: klucze funkcji" "$(psql "$ST" -Atqc "select string_agg(distinct title_key, ',' order by title_key) from risk_signals")" \
    "rk_auto_status_blocked,rk_ferry_overdue,rk_loading_not_ready,rk_port_no_loaded,rk_sailing_cancelled"
else
  fail=$((fail+2)); echo "  FAIL  brak bazy tower_test_status — uruchom najpierw tests/db/run.sh"
fi

echo; echo "[C1] zalew dzwonka — E5 (D-20261015-0300-01)"
# #402: bramka czyta risk_route/risk_crit; org + macierz + bez pref wyłączających dzwonek.
$PSQL -c "update notification_matrix_org_kind set in_app = true where event_group = 'RISK_FERRY_WEATHER'" >/dev/null
$PSQL -c "update notification_matrix set in_app = true where event_key in ('risk_route','risk_crit')" >/dev/null
$PSQL -c "delete from user_notify_pref where event_key in ('risk_route','risk_crit') and channel = 'bell'" >/dev/null
# (1) FERRY bez load_id → 0 nowych IN_APP RISK_OPEN
N0=$(Q "select count(*) from notifications where channel='IN_APP' and template='RISK_OPEN'")
$PSQL -c "insert into risk_signals (project_id, kind, severity, title, title_key, detail)
  values ('$P','FERRY','HIGH','C1 ferry','rk_c1_ferry','{\"title_key\":\"rk_c1_ferry\"}'::jsonb)" >/dev/null 2>&1
chk "C1: FERRY bez load_id → 0 nowych RISK_OPEN IN_APP" \
  "$(Q "select count(*) - $N0 from notifications where channel='IN_APP' and template='RISK_OPEN'")" 0
# (1b) FERRY z transportem → RISK_OPEN IN_APP (macierz RISK_FERRY_WEATHER; para do C1 bez load_id)
RID=$(Q "insert into risk_signals (project_id, load_id, kind, severity, title, title_key, detail)
  values ('$P','$L1','FERRY','HIGH','C1 ferry load','rk_c1_ferry_load','{\"title_key\":\"rk_c1_ferry_load\",\"kind\":\"FERRY\"}'::jsonb)
  returning id" | tr -d '\r')
chk "C1: ryzyko z load_id → RISK_OPEN IN_APP" \
  "$(Q "select case when count(*) >= 1 then 1 else 0 end from notifications where channel='IN_APP' and template='RISK_OPEN' and load_id='$L1' and (payload->>'risk_id')='$RID'")" 1
# (2) resolve → 0 RISK_RESOLVED; istniejący RISK_OPEN przeczytany
$PSQL -c "update risk_signals set resolved_at = now() where id = '$RID'" >/dev/null
chk "C1: resolve → 0 RISK_RESOLVED" \
  "$(Q "select count(*) from notifications where template='RISK_RESOLVED' and (payload->>'risk_id')='$RID'")" 0
chk "C1: resolve → RISK_OPEN oznaczony przeczytany" \
  "$(Q "select count(*) from notifications where template='RISK_OPEN' and (payload->>'risk_id')='$RID' and read_at is not null and payload->>'c1_resolved' = 'true'")" \
  "$(Q "select count(*) from notifications where template='RISK_OPEN' and (payload->>'risk_id')='$RID'")"
# #411: matrix_notify('RISK_RESOLVED') → 0; OPEN z url
chk "#411: matrix RISK_RESOLVED → 0" \
  "$(Q "select matrix_notify('RISK_FERRY_WEATHER','RISK_RESOLVED','$L1','$P',jsonb_build_object('risk_id','$RID'),'411-rr')")" 0
chk "#411: matrix DECISION_RESOLVED → 0" \
  "$(Q "select matrix_notify('DECISION','DECISION_RESOLVED','$L1','$P',jsonb_build_object('decision_id',gen_random_uuid()),'411-dr')")" 0
chk "#411: RISK_OPEN ma url" \
  "$(Q "select case when coalesce(payload->>'url','') like '%/#/%' then 1 else 0 end from notifications where template='RISK_OPEN' and (payload->>'risk_id')='$RID' and channel='IN_APP' limit 1")" 1

echo; echo "[1215] zamknięcie alarmów panelu (D-20261018-1215-01)"
DID=$(Q "insert into decisions (project_id, type_code, status, title) values ('$P','FERRY_CANCELLED','NEW','1215-overdue') returning id")
DID2=$(Q "insert into decisions (project_id, type_code, status, title) values ('$P','FERRY_CANCELLED','NEW','1215-resolved') returning id")
$PSQL -c "insert into risk_signals (project_id, load_id, kind, severity, title, title_key, dedup_key)
  values ('$P','$L1','DOC_MISSING','HIGH','Decyzja po terminie','rk_decision_overdue','decision-overdue:$DID'),
         ('$P',null,'DOC_MISSING','HIGH','Decyzja po terminie','rk_decision_overdue','decision-overdue:$DID2')" >/dev/null
NDEC=$(Q "select count(*) from notifications")
# EXPIRED wymaga expired_reason (0102). Sam status zostaje NEW i sygnał się nie zamyka.
$PSQL -v ON_ERROR_STOP=1 -c "update decisions set status='EXPIRED', expired_reason='1215' where id='$DID'" >/dev/null
$PSQL -v ON_ERROR_STOP=1 -c "update decisions set status='RESOLVED', resolved_at=now() where id='$DID2'" >/dev/null
chk "1215: NEW→EXPIRED zamyka decision-overdue" \
  "$(Q "select count(*) from risk_signals where dedup_key='decision-overdue:$DID' and resolved_at is not null")" 1
chk "1215: NEW→RESOLVED zamyka decision-overdue" \
  "$(Q "select count(*) from risk_signals where dedup_key='decision-overdue:$DID2' and resolved_at is not null")" 1
chk "1215: zamknięcie decyzji → 0 nowych powiadomień" \
  "$(Q "select count(*) - $NDEC from notifications")" 0
# Osobny transport: L1 ma już otwartą ciszę; zamykanie jej razem ze statusem nie jest przedmiotem testu.
$PSQL -v ON_ERROR_STOP=1 -c "insert into risk_signals (project_id, load_id, kind, severity, title, title_key, dedup_key)
  values ('$P','$L2','RESOURCE_MISSING','HIGH','Brak awizacji','rk_res_docs','l3:NO_AWIZACJA:$L2'),
         ('$P','$L2','RESOURCE_MISSING','HIGH','Brak kierowcy','rk_res_driver','RES:DRIVER:$L2'),
         ('$P','$L2','RESOURCE_MISSING','HIGH','Brak rejsu','rk_no_sailing','l3:NO_SAILING:$L2'),
         ('$P','$L2','RESOURCE_MISSING','HIGH','Brak linku','rk_no_tracking','l3:NO_TRACKING:$L2'),
         ('$P','$L2','RESOURCE_MISSING','HIGH','Brak SE','rk_no_awiz_se','l3:NO_AWIZ_SE:$L2')" >/dev/null
# DELIVERED wymaga numerów zleceń (0003). L2 w tym zestawie jest bez nich.
$PSQL -v ON_ERROR_STOP=1 -c "update loads set hhl_order_no='HHL/1215', carrier_order_no='SCX/1215' where id='$L2'" >/dev/null
$PSQL -v ON_ERROR_STOP=1 -c "update loads set status='DELIVERED' where id='$L2'" >/dev/null
chk "1215: l3:NO_AWIZACJA znika przy DELIVERED" \
  "$(Q "select count(*) from risk_signals where dedup_key='l3:NO_AWIZACJA:$L2' and resolved_at is not null")" 1
chk "D-1501: l3:NO_SAILING/TRACKING/AWIZ_SE znikają przy DELIVERED" \
  "$(Q "select count(*) from risk_signals where dedup_key in ('l3:NO_SAILING:$L2','l3:NO_TRACKING:$L2','l3:NO_AWIZ_SE:$L2') and resolved_at is not null")" 3
chk "1215: RES:DRIVER znika przy DELIVERED" \
  "$(Q "select count(*) from risk_signals where dedup_key='RES:DRIVER:$L2' and resolved_at is not null")" 1
$PSQL -c "insert into risk_signals (project_id, load_id, kind, severity, title, title_key, dedup_key)
  values ('$P','$L2','INVOICE_MISMATCH','HIGH','Faktura po terminie','rk_invoice_overdue','invoice-overdue:$L2')" >/dev/null
$PSQL -c "update loads set status='INVOICED' where id='$L2'" >/dev/null
chk "1215: faktura po terminie zostaje przy INVOICED" \
  "$(Q "select count(*) from risk_signals where dedup_key='invoice-overdue:$L2' and resolved_at is null")" 1

echo; echo "[398] szum ryzyk — loaded_confirmed / emtrack / ETA / ORDERNO (D-20261021-1820-01)"
chk "398: SILENT_MIN_EMTRACK = 720" \
  "$(Q "select value_num::int from ops_thresholds where key='SILENT_MIN_EMTRACK'")" 720
fx "update loads set actual_load_at = now() - interval '2 hours' where id='$L1'"
chk "398: loaded_confirmed true (GPS actual_load_at)" "$(Q "select loaded_confirmed('$L1')::text")" true
fx "update loads set actual_load_at = null where id='$L1'"
# emtrack < 12 h: cisza 3 h, źródło EMTRACK_WEB → 0 SILENT / 0 NO_POSITION
$PSQL -c "update risk_signals set resolved_at=now() where dedup_key='SILENT:$L1' and resolved_at is null" >/dev/null
$PSQL -c "update decisions set status='EXPIRED', expired_reason='398 test cleanup', updated_at=now()
  where status in ('NEW','ASSIGNED','SNOOZED')
    and (detail->>'event_key'='SILENT:$L1'
         or risk_id in (select id from risk_signals where dedup_key='SILENT:$L1'))" >/dev/null 2>&1
fx "update loads set status='IN_TRANSIT_PL', tractor_plate='EMT 1', telematics_vehicle_id='TEL-EMT-1', plan_load_date=current_date - 1, actual_load_at=now()-interval '1 day' where id='$L1'"
$PSQL -c "delete from positions where load_id='$L1'" >/dev/null
$PSQL -c "insert into positions (load_id, ts, geom_raw, source) values ('$L1', now() - interval '3 hours', st_setsrid(st_makepoint(18.0,53.0),4326), 'EMTRACK_WEB')" >/dev/null
NDEC0=$(Q "select count(*) from decisions where type_code='NO_POSITION' and status in ('NEW','ASSIGNED','SNOOZED') and load_id='$L1'")
Q "select detect_silent_vehicles(90)" >/dev/null
chk "398: emtrack <12h → 0 otwartych SILENT" \
  "$(Q "select count(*) from risk_signals where dedup_key='SILENT:$L1' and resolved_at is null")" 0
chk "398: emtrack <12h → 0 nowych NO_POSITION" \
  "$(Q "select count(*) - $NDEC0 from decisions where type_code='NO_POSITION' and status in ('NEW','ASSIGNED','SNOOZED') and load_id='$L1'")" 0
# emtrack ≥ 12 h → 1× LOW, bez decyzji, bez SMS (nawet przy telefonie + linku kierowcy)
fx "update loads set driver_phone='600111222', driver_phone_country='PL', driver_locale='pl' where id='$L1'"
$PSQL -c "insert into driver_tokens (load_id, token_hash, expires_at)
  values ('$L1', driver_token_hash('wt_398emtrack'), now() + interval '1 day')
  on conflict do nothing" >/dev/null
$PSQL -c "delete from sms_outbox where kind='GPS_SILENT' and load_id='$L1'" >/dev/null
$PSQL -c "delete from positions where load_id='$L1'" >/dev/null
$PSQL -c "insert into positions (load_id, ts, geom_raw, source) values ('$L1', now() - interval '13 hours', st_setsrid(st_makepoint(18.0,53.0),4326), 'EMTRACK_WEB')" >/dev/null
Q "select detect_silent_vehicles(90)" >/dev/null
chk "398: emtrack ≥12h → 1 SILENT LOW" \
  "$(Q "select count(*)||'/'||max(severity::text)||'/'||max(audience::text)||'/'||max(detail->>'emtrack_trailer') from risk_signals where dedup_key='SILENT:$L1' and resolved_at is null")" "1/LOW/HHL/1"
chk "398: emtrack ≥12h → 0 decyzji NO_POSITION" \
  "$(Q "select count(*) from decisions where type_code='NO_POSITION' and status in ('NEW','ASSIGNED','SNOOZED') and (detail->>'event_key')='SILENT:$L1'")" 0
chk "398: emtrack ≥12h → 0 SMS GPS_SILENT" \
  "$(Q "select count(*) from sms_outbox where kind='GPS_SILENT' and load_id='$L1'")" 0
$PSQL -c "delete from driver_tokens where load_id='$L1' and token_hash = driver_token_hash('wt_398emtrack')" >/dev/null
fx "update loads set driver_phone=null, driver_phone_country='PL', driver_locale=null where id='$L1'"
# ETA po dostawie
fx "update loads set status='READY_TO_INVOICE', actual_delivery_at=now()-interval '1 day', plan_delivery_date=current_date-2 where id='$L1'"
$PSQL -c "insert into risk_signals (project_id, load_id, kind, severity, title, title_key, detail, dedup_key)
  values ('$P','$L1','ETA_BREACH','CRITICAL','Opóźnienie test','rk_eta_breach','{\"l3\":\"1\"}','ETA_BREACH:$L1')
  on conflict do nothing" >/dev/null 2>&1
$PSQL -c "update risk_signals set resolved_at=null, detected_at=now() where dedup_key='ETA_BREACH:$L1'" >/dev/null 2>&1
Q "select refresh_load_eta('$L1')" >/dev/null
chk "398: ETA_BREACH zamknięte po READY_TO_INVOICE" \
  "$(Q "select count(*) from risk_signals where dedup_key='ETA_BREACH:$L1' and resolved_at is null")" 0
# ORDERNO poza oknem
fx "update loads set status='PLANNED', plan_load_date=current_date + 30, plan_load_from=null, hhl_order_no=null, carrier_order_no=null, actual_delivery_at=null where id='$L2'"
$PSQL -c "insert into risk_signals (project_id, load_id, kind, severity, title, title_key, detail, dedup_key)
  values ('$P','$L2','RESOURCE_MISSING','HIGH','brak HHL','rk_order_no_hhl',
    '{\"rule\":\"ORDER_NO\",\"side\":\"HHL\"}','ORDERNO:HHL:$L2')
  on conflict (dedup_key) where dedup_key is not null and resolved_at is null do nothing" >/dev/null
Q "select detect_missing_order_numbers(now(), 48)" >/dev/null
chk "398: ORDERNO zamknięte gdy załadunek za >48 h" \
  "$(Q "select count(*) from risk_signals where dedup_key='ORDERNO:HHL:$L2' and resolved_at is null")" 0

echo; echo "WYNIK: $ok OK, $fail FAIL"
