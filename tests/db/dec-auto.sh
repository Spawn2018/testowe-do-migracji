#!/usr/bin/env bash
# L-1 — zdarzenie otwiera decyzję, drugie wykrycie nie dubluje, brak danych nie otwiera.
. "$(git rev-parse --show-toplevel)/tests/db/refuse-prod.sh"
PSQL="psql ${PGURL:-postgres://postgres@localhost:5433/tower} -v ON_ERROR_STOP=1 -Atq"
P=22222222-0000-0000-0000-000000000001
L=33333333-0000-0000-0000-00000000da01
LA=33333333-0000-0000-0000-00000000da02
LB=33333333-0000-0000-0000-00000000da03
ok=0; fail=0
val() {
  out=$($PSQL -c "$2" | tail -1 | tr -d '\r')
  if [ "$out" = "$3" ]; then ok=$((ok+1)); echo "  OK    $1"; else fail=$((fail+1)); echo "  FAIL  $1 (otrzymano: $out, oczekiwano: $3)"; fi
}
risk() {
  # $1 kind  $2 title_key  $3 dedup  $4 load
  $PSQL -c "insert into risk_signals (project_id, load_id, kind, severity, title, title_key, detail, dedup_key)
    values ('$P', '$4', '$1', 'HIGH', 'dec-auto $1', '$2', '{\"source\":\"dec-auto\"}'::jsonb, '$3')
    on conflict (dedup_key) where dedup_key is not null and resolved_at is null do nothing" >/dev/null
}
echo; echo "[dec-auto] otwarcie i brak duplikatu"
$PSQL -c "insert into loads (id, project_id, order_no, status) values
  ('$L','$P','DEC-AUTO','PLANNED'),
  ('$LA','$P','DEC-AUTO-A','PLANNED'),
  ('$LB','$P','DEC-AUTO-B','PLANNED')
  on conflict (id) do nothing" >/dev/null
$PSQL -c "set session_replication_role=replica; update loads set status='READY' where id='$LA'; set session_replication_role=origin;" >/dev/null

risk DOC_MISSING rk_res_docs decauto:doc "$L"
val "DOC_MISSING → decyzja" "select count(*) from decisions where detail->>'event_key' = 'decauto:doc'" 1
risk DOC_MISSING rk_res_docs decauto:doc "$L"
val "DOC_MISSING drugie wykrycie → jedna" "select count(*) from decisions where detail->>'event_key' = 'decauto:doc'" 1

risk INSURANCE rk_generic decauto:ins "$L"
val "INSURANCE → decyzja" "select count(*) from decisions where detail->>'event_key' = 'decauto:ins'" 1
risk INSURANCE rk_generic decauto:ins "$L"
val "INSURANCE drugie wykrycie → jedna" "select count(*) from decisions where detail->>'event_key' = 'decauto:ins'" 1

risk ETA_BREACH rk_eta_breach decauto:eta "$LA"
val "ETA przy awizacji (READY) → decyzja" "select count(*) from decisions where detail->>'event_key' = 'decauto:eta'" 1
risk ETA_BREACH rk_eta_breach decauto:eta "$LA"
val "ETA drugie wykrycie → jedna" "select count(*) from decisions where detail->>'event_key' = 'decauto:eta'" 1

risk ETA_BREACH rk_eta_breach decauto:eta-bare "$LB"
val "ETA bez pozycji i bez awizacji → bez decyzji" "select count(*) from decisions where detail->>'event_key' = 'decauto:eta-bare'" 0

risk LATE_DATE_CHANGE rk_late_date_change decauto:date "$L"
val "LATE_DATE_CHANGE → decyzja" "select count(*) from decisions where detail->>'event_key' = 'decauto:date'" 1
risk LATE_DATE_CHANGE rk_late_date_change decauto:date "$L"
val "data drugie wykrycie → jedna" "select count(*) from decisions where detail->>'event_key' = 'decauto:date'" 1

risk SILENT_VEHICLE rk_silent_vehicle decauto:silent "$L"
val "SILENT_VEHICLE → decyzja" "select count(*) from decisions where detail->>'event_key' = 'decauto:silent'" 1
risk SILENT_VEHICLE rk_silent_vehicle decauto:silent "$L"
val "cisza drugie wykrycie → jedna" "select count(*) from decisions where detail->>'event_key' = 'decauto:silent'" 1

risk INVOICE_MISMATCH rk_generic decauto:inv "$L"
val "INVOICE_MISMATCH → decyzja" "select count(*) from decisions where detail->>'event_key' = 'decauto:inv'" 1
risk INVOICE_MISMATCH rk_generic decauto:inv "$L"
val "faktura drugie wykrycie → jedna" "select count(*) from decisions where detail->>'event_key' = 'decauto:inv'" 1

risk WEATHER rk_generic decauto:wx "$L"
val "WEATHER → decyzja rejsu" "select count(*) from decisions where detail->>'event_key' = 'decauto:wx'" 1
risk WEATHER rk_generic decauto:wx "$L"
val "pogoda drugie wykrycie → jedna" "select count(*) from decisions where detail->>'event_key' = 'decauto:wx'" 1

risk FERRY rk_generic decauto:ferry-plain "$L"
val "FERRY bez odwołania rejsu → bez decyzji" "select count(*) from decisions where detail->>'event_key' = 'decauto:ferry-plain'" 0

risk ROAD_PL rk_off_corridor decauto:off "$L"
val "zjazd z trasy → decyzja" "select count(*) from decisions where detail->>'event_key' = 'decauto:off'" 1
risk ROAD_PL rk_off_corridor decauto:off "$L"
val "zjazd drugie wykrycie → jedna" "select count(*) from decisions where detail->>'event_key' = 'decauto:off'" 1

risk ROAD_PL rk_generic decauto:road-plain "$L"
val "droga bez zjazdu → bez decyzji" "select count(*) from decisions where detail->>'event_key' = 'decauto:road-plain'" 0

risk SEQUENCE rk_generic decauto:seq "$L"
val "SEQUENCE (grupa C) → bez decyzji" "select count(*) from decisions where detail->>'event_key' = 'decauto:seq'" 0

risk JOB_FAILURE rk_generic decauto:job "$L"
val "JOB_FAILURE poza kopią → bez decyzji" "select count(*) from decisions where detail->>'event_key' = 'decauto:job'" 0

echo; echo "[dec-auto] kopia"
BID=$($PSQL -c "insert into backup_runs (status) values ('RUNNING') returning id")
$PSQL -c "update backup_runs set status='ERROR', error='dec-auto' where id=$BID" >/dev/null
val "kopia ERROR → decyzja" "select count(*) from decisions where detail->>'event_key' = 'backup-run:$BID'" 1
$PSQL -c "update backup_runs set status='OK' where id=$BID" >/dev/null
$PSQL -c "update backup_runs set status='ERROR', error='dec-auto drugi' where id=$BID" >/dev/null
val "kopia drugi ERROR → jedna decyzja" "select count(*) from decisions where detail->>'event_key' = 'backup-run:$BID'" 1

val "powiadomienia decyzji tylko w aplikacji" "select count(*) from notifications where template='DECISION_OPEN' and channel <> 'IN_APP'" 0

echo; echo "[dec-auto] L-3 moment progu zależy od Opcji"
ANCHOR="2026-12-10 12:00:00+01"
val "awizacja 48 h" "select l3_moment(timestamptz '$ANCHOR', 'AWIZ_EARLY_H') = timestamptz '$ANCHOR' - interval '48 hours'" t
$PSQL -c "update ops_thresholds set value_num = 36 where key = 'AWIZ_EARLY_H'" >/dev/null
val "zmiana AWIZ_EARLY_H przesuwa moment" "select l3_moment(timestamptz '$ANCHOR', 'AWIZ_EARLY_H') = timestamptz '$ANCHOR' - interval '36 hours'" t
$PSQL -c "update ops_thresholds set value_num = 48 where key = 'AWIZ_EARLY_H'" >/dev/null
val "brak daty = brak momentu" "select l3_moment(null, 'AWIZ_EARLY_H') is null" t
val "ETA bez danych = bez alarmu" "select l3_eta_alarm(now(), now() - interval '2 hours', false)" f
val "ETA po progu 30 min" "select l3_eta_alarm(timestamptz '2026-12-10 15:00+01', timestamptz '2026-12-10 14:00+01', true)" t
$PSQL -c "update ops_thresholds set value_num = 120 where key = 'DELAY_MIN'" >/dev/null
val "większy próg ETA gasi alarm" "select l3_eta_alarm(timestamptz '2026-12-10 15:00+01', timestamptz '2026-12-10 14:00+01', true)" f
$PSQL -c "update ops_thresholds set value_num = 30 where key = 'DELAY_MIN'" >/dev/null
val "KSH mniej niż 5 dni" "select l3_lead_alarm(now() + interval '4 days', now())" t
$PSQL -c "update ops_thresholds set value_num = 3 where key = 'LEAD_DAYS'" >/dev/null
val "krótsze wyprzedzenie KSH gasi alarm" "select l3_lead_alarm(now() + interval '4 days', now())" f
$PSQL -c "update ops_thresholds set value_num = 5 where key = 'LEAD_DAYS'" >/dev/null
val "cisza GPS tylko przy źródle i ruchu" "select l3_silent_alarm(now() - interval '30 minutes', now(), false, true)" f
val "cisza 30 min przy progu 15" "select l3_silent_alarm(now() - interval '30 minutes', now(), true, true)" t
$PSQL -c "update ops_thresholds set value_num = 60 where key = 'SILENT_MIN'" >/dev/null
val "dłuższy próg ciszy gasi alarm" "select l3_silent_alarm(now() - interval '30 minutes', now(), true, true)" f
$PSQL -c "update ops_thresholds set value_num = 15 where key = 'SILENT_MIN'" >/dev/null
val "zjazd: jedna pozycja nie alarmuje" "select l3_deviation_alarm(5000, 1, 20, false)" f
val "zjazd: dwie pozycje, 10 min, ponad 2 km" "select l3_deviation_alarm(5000, 2, 10, false)" t
$PSQL -c "update ops_thresholds set value_num = 9 where key = 'OFFROUTE_KM'" >/dev/null
val "większy próg zjazdu gasi alarm" "select l3_deviation_alarm(5000, 2, 10, false)" f
$PSQL -c "update ops_thresholds set value_num = 2 where key = 'OFFROUTE_KM'" >/dev/null
val "prom i port bez zjazdu" "select l3_deviation_alarm(5000, 2, 10, true)" f

echo; echo "[dec-auto] L-1b"
$PSQL -c "insert into risk_signals (project_id, load_id, kind, severity, title, title_key, detail, dedup_key)
  values ('$P', '$L', 'RESOURCE_MISSING', 'HIGH', 'dec-auto awiz', 'rk_res_awiz', '{\"rule\":\"L3_AWIZ\"}'::jsonb, 'decauto:awiz')
  on conflict (dedup_key) where dedup_key is not null and resolved_at is null do nothing" >/dev/null
val "NO_AWIZACJA → decyzja" "select count(*) from decisions where type_code='NO_AWIZACJA' and detail->>'event_key'='decauto:awiz'" 1
$PSQL -c "insert into risk_signals (project_id, load_id, kind, severity, title, title_key, detail, dedup_key)
  values ('$P', '$L', 'RESOURCE_MISSING', 'HIGH', 'dec-auto awiz', 'rk_res_awiz', '{\"rule\":\"L3_AWIZ\"}'::jsonb, 'decauto:awiz')
  on conflict (dedup_key) where dedup_key is not null and resolved_at is null do nothing" >/dev/null
val "NO_AWIZACJA drugie wykrycie → jedna" "select count(*) from decisions where type_code='NO_AWIZACJA' and detail->>'event_key'='decauto:awiz'" 1

val "zniknięcie wiersza → decyzja" "select (l1b_note_row_gone('$P','$L','SG-GONE') is not null)::text" t
$PSQL -c "select l1b_note_row_gone('$P','$L','SG-GONE')" >/dev/null
val "zniknięcie drugie → jedna" "select count(*) from decisions where detail->>'event_key'='l1b:row-gone:$P:SG-GONE'" 1
val "import woła zniknięcie wiersza" "select (position('l1b_note_row_gone' in pg_get_functiondef('import_schedule(uuid,jsonb,text[],jsonb,boolean)'::regprocedure)) > 0)::text" t

val "konflikt numeru HHL → decyzja" "select (l1b_note_conflict('$P','$L','SG-C','HHL/1','KSH/2') is not null)::text" t
$PSQL -c "select l1b_note_conflict('$P','$L','SG-C','HHL/1','KSH/2')" >/dev/null
val "konflikt drugie → jedna" "select count(*) from decisions where detail->>'event_key'='l1b:conflict:$P:SG-C:hhl_order_no'" 1
val "ten sam numer → bez decyzji" "select (l1b_note_conflict('$P','$L','SG-C2','HHL/1','HHL/1') is null)::text" t
val "import woła konflikt" "select (position('l1b_note_conflict' in pg_get_functiondef('import_schedule(uuid,jsonb,text[],jsonb,boolean)'::regprocedure)) > 0)::text" t

val "plik nieczytelny → decyzja" "select (l1b_ksh_file_unreadable('$P','zly.xlsx') is not null)::text" t
$PSQL -c "select l1b_ksh_file_unreadable('$P','zly.xlsx')" >/dev/null
val "plik drugi → jedna" "select count(*) from decisions where detail->>'event_key'='l1b:file:$P:zly.xlsx'" 1

val "SEFS brak źródła → decyzja" "select l1b_sefs_note('$P','2026-11-16')" SOURCE
$PSQL -c "select l1b_sefs_note('$P','2026-11-16')" >/dev/null
val "SEFS brak źródła drugie → jedna" "select count(*) from decisions where detail->>'event_key' like 'l1b:sefs:$P:%:SOURCE'" 1
$PSQL -c "insert into sefs_parameters (project_id, version, valid_from, base_sek, base_pln, index_sek, index_pln, source_url_sek, source_url_pln, cycle, tiers_sek, tiers_pln)
  values ('$P', 91, '2026-01-01', 1, 1, 'OKQ8', 'ORLEN', 'https://example.com/sek', 'https://example.com/pln', 'WEEKLY',
          '[{\"lte\":100,\"mult\":1}]'::jsonb, '[{\"lte\":100,\"mult\":1}]'::jsonb)" >/dev/null
$PSQL -c "insert into fuel_index_readings (project_id, index_code, period, reading_date, value, source_url)
  values ('$P','SEK','2026-10-06','2026-10-06',10,'https://example.com/sek'),
         ('$P','PLN','2026-10-06','2026-10-06',10,'https://example.com/pln')" >/dev/null
val "SEFS w tabeli → bez decyzji" "select l1b_sefs_note('$P','2026-10-12')" OK
val "SEFS w tabeli nie otwiera" "select count(*) from decisions where detail->>'event_key' like 'l1b:sefs:$P:2026-10-05:%'" 0
$PSQL -c "insert into fuel_index_readings (project_id, index_code, period, reading_date, value, source_url)
  values ('$P','SEK','2026-10-13','2026-10-13',150,'https://example.com/sek'),
         ('$P','PLN','2026-10-13','2026-10-13',150,'https://example.com/pln')" >/dev/null
val "SEFS ponad tabelę → decyzja" "select l1b_sefs_note('$P','2026-10-19')" OVER
$PSQL -c "select l1b_sefs_note('$P','2026-10-19')" >/dev/null
val "SEFS ponad tabelę drugie → jedna" "select count(*) from decisions where detail->>'event_key'='l1b:sefs:$P:2026-10-12:OVER'" 1

$PSQL -c "insert into loads (id, project_id, order_no, status, plan_load_date) values
  ('33333333-0000-0000-0000-00000000kr01','$P','KR-1','PLANNED','2026-12-01'),
  ('33333333-0000-0000-0000-00000000kr02','$P','KR-2','PLANNED','2026-12-01'),
  ('33333333-0000-0000-0000-00000000kr03','$P','KR-3','PLANNED','2026-12-01')" >/dev/null
$PSQL -c "insert into shipment_items (project_id, load_id, shipment_code, length_m, width_m, height_m) values
  ('$P','33333333-0000-0000-0000-00000000kr01','KR-01',1,1,1),
  ('$P','33333333-0000-0000-0000-00000000kr02','KR-02',1,1,1),
  ('$P','33333333-0000-0000-0000-00000000kr03','KR-03',1,1,1)" >/dev/null
val "3 ładunki KR → bez decyzji" "select l1b_kr_check('$P','2026-12-01')" 3
val "3 KR nie otwiera" "select count(*) from decisions where detail->>'event_key'='l1b:kr:$P:2026-12-01'" 0
$PSQL -c "insert into loads (id, project_id, order_no, status, plan_load_date) values
  ('33333333-0000-0000-0000-00000000kr04','$P','KR-4','PLANNED','2026-12-01')" >/dev/null
$PSQL -c "insert into shipment_items (project_id, load_id, shipment_code, length_m, width_m, height_m) values
  ('$P','33333333-0000-0000-0000-00000000kr04','KR-04',1,1,1)" >/dev/null
val "4 ładunki KR → decyzja" "select l1b_kr_check('$P','2026-12-01')" 4
$PSQL -c "select l1b_kr_check('$P','2026-12-01')" >/dev/null
val "KR drugie → jedna" "select count(*) from decisions where detail->>'event_key'='l1b:kr:$P:2026-12-01'" 1
val "import woła próg KR" "select (position('l1b_kr_check' in pg_get_functiondef('import_schedule(uuid,jsonb,text[],jsonb,boolean)'::regprocedure)) > 0)::text" t

LD=33333333-0000-0000-0000-00000000dw01
$PSQL -c "insert into loads (id, project_id, order_no, status) values ('$LD','$P','DW-1','PLANNED')" >/dev/null
val "postój bez pozycji → bez alarmu" "select l1b_dwell_check('$LD')" 0
$PSQL -c "insert into positions (load_id, ts, geom_raw, source) values
  ('$LD', now(), ST_SetSRID(ST_MakePoint(18.6,54.3),4326), 'DRIVER_PWA')" >/dev/null
$PSQL -c "insert into load_events (load_id, event_type, occurred_at, payload) values
  ('$LD','GEOFENCE_ENTER', now() - interval '3 hours', '{\"geofence_kind\":\"LOADING\"}'::jsonb),
  ('$LD','GEOFENCE_EXIT', now() - interval '1 hour', '{\"geofence_kind\":\"LOADING\"}'::jsonb)" >/dev/null
val "postój w czasie wolnym → bez decyzji" "select l1b_dwell_check('$LD')" 0
$PSQL -c "insert into load_events (load_id, event_type, occurred_at, payload) values
  ('$LD','GEOFENCE_ENTER', now() - interval '20 hours', '{\"geofence_kind\":\"SITE\"}'::jsonb),
  ('$LD','GEOFENCE_EXIT', now() - interval '10 hours', '{\"geofence_kind\":\"SITE\"}'::jsonb)" >/dev/null
val "postój ponad czas wolny → decyzja" "select l1b_dwell_check('$LD')" 1
$PSQL -c "select l1b_dwell_check('$LD')" >/dev/null
val "postój drugie → jedna" "select count(*) from decisions where type_code='DWELL_OVER_FREE' and load_id='$LD'" 1

echo; echo "WYNIK: $ok OK, $fail FAIL"
[ "$fail" -eq 0 ]
