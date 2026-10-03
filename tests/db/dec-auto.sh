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

echo; echo "WYNIK: $ok OK, $fail FAIL"
[ "$fail" -eq 0 ]
