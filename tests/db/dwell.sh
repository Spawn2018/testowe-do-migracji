#!/usr/bin/env bash
# DWELL_OVER_FREE — każdy parametr z Opcji zmienia wynik. Bez automatycznej dopłaty.
. "$(git rev-parse --show-toplevel)/tests/db/refuse-prod.sh"
PSQL="psql ${PGURL:-postgres://postgres@localhost:5433/tower} -Atq"
P=22222222-0000-0000-0000-000000000001
L=33333333-0000-0000-0000-00000000d411
ok=0; fail=0
sys() { $PSQL -v ON_ERROR_STOP=1 -c "$1" 2>&1; }
val() {
  out=$(sys "$2" | grep -v -E '^(BEGIN|SET|ROLLBACK|COMMIT)$' | tail -1)
  if [ "$out" = "$3" ]; then ok=$((ok+1)); echo "  OK    $1"; else fail=$((fail+1)); echo "  FAIL  $1 (otrzymano: $out, oczekiwano: $3)"; fi
}
sys "set session_replication_role=replica;
 delete from decision_events where decision_id in (select id from decisions where load_id='$L');
 delete from notifications where load_id='$L';
 delete from decisions where load_id='$L';
 delete from load_events where load_id='$L';
 delete from loads where id='$L';
 set session_replication_role=origin;" >/dev/null
sys "insert into loads (id, project_id, carrier_org_id, order_no, status, plan_load_from, plan_delivery_from)
 values ('$L','$P','00000000-0000-0000-0000-00000000a003','KSH/DWELL','PLANNED',
  '2026-10-01 10:00+02','2026-10-05 08:00+02')" >/dev/null

# załadunek: wjazd 08:00, plan 10:00, wyjazd 16:00 → start 10:00, postój 6 h = czas wolny, brak decyzji
sys "insert into load_events (load_id, event_type, occurred_at, payload) values
 ('$L','GEOFENCE_ENTER','2026-10-01 08:00+02','{\"geofence_kind\":\"LOADING\"}'),
 ('$L','GEOFENCE_EXIT','2026-10-01 16:00+02','{\"geofence_kind\":\"LOADING\"}')" >/dev/null
val "6 h od planu = czas wolny, brak decyzji" "select count(*) from decisions where load_id='$L' and type_code='DWELL_OVER_FREE'" 0
val "pomiar: start późniejszy (plan), 360 min, tryb NONE" "select to_char(start_at at time zone 'Europe/Warsaw','HH24:MI')||'/'||dwell_minutes::int||'/'||mode from dwell_measure('$L','2026-10-01 16:00+02') where zone_kind='LOADING'" "10:00/360/NONE"

# +1 min ponad czas wolny → 1 rozpoczęta godzina × 75
sys "set session_replication_role=replica; update load_events set occurred_at='2026-10-01 16:01+02' where load_id='$L' and event_type='GEOFENCE_EXIT' and payload->>'geofence_kind'='LOADING'; set session_replication_role=origin;" >/dev/null
sys "select dwell_scan('$L','2026-10-01 16:01+02')" >/dev/null
val "6 h 1 min → decyzja, podpowiedź 75 EUR" "select (count(*)=1)::text||'/'||(detail->>'hint_eur') from decisions where load_id='$L' and type_code='DWELL_OVER_FREE' group by detail" "true/75"
val "drugi skan nie dubluje decyzji" "select dwell_scan('$L','2026-10-01 16:01+02'); select count(*) from decisions where load_id='$L' and type_code='DWELL_OVER_FREE'" 1
val "brak wiersza dopłaty uzgodnionej" "select count(*) from load_agreed_fees where load_id='$L'" 0
val "powiadomienie tylko w aplikacji" "select coalesce(string_agg(distinct channel, ','),'') from notifications where load_id='$L' and template='DECISION_OPEN'" "IN_APP"

# parametr: czas wolny załadunku 8 h → ten sam postój nie przekracza
sys "update ops_thresholds set value_num=8 where key='DWELL_FREE_LOAD_H'" >/dev/null
sys "set session_replication_role=replica; delete from decision_events where decision_id in (select id from decisions where load_id='$L'); delete from decisions where load_id='$L'; set session_replication_role=origin;" >/dev/null
sys "select dwell_scan('$L','2026-10-01 16:01+02')" >/dev/null
val "DWELL_FREE_LOAD_H=8 gasi decyzję" "select count(*) from decisions where load_id='$L' and type_code='DWELL_OVER_FREE'" 0
sys "update ops_thresholds set value_num=6 where key='DWELL_FREE_LOAD_H'" >/dev/null

# parametr: rozpoczęta godzina. 61 min ponad czas wolny.
sys "set session_replication_role=replica; update load_events set occurred_at='2026-10-01 17:01+02' where load_id='$L' and event_type='GEOFENCE_EXIT' and payload->>'geofence_kind'='LOADING'; set session_replication_role=origin;" >/dev/null
val "pełna godzina: 61 min ponad → 2 × 75" "select hint_eur::int from dwell_measure('$L','2026-10-01 17:01+02') where zone_kind='LOADING'" 150
sys "update ops_thresholds set value_num=2 where key='DWELL_FULL_HOUR'" >/dev/null
val "DWELL_FULL_HOUR=2: ułamek 61/60 × 75" "select round(hint_eur,2)::text from dwell_measure('$L','2026-10-01 17:01+02') where zone_kind='LOADING'" "76.25"
sys "update ops_thresholds set value_num=1 where key='DWELL_FULL_HOUR'" >/dev/null

# parametr stawki godzinowej
sys "update ops_thresholds set value_num=10 where key='DWELL_HOURLY_EUR'" >/dev/null
val "DWELL_HOURLY_EUR=10 zmienia podpowiedź" "select hint_eur::int from dwell_measure('$L','2026-10-01 17:01+02') where zone_kind='LOADING'" 20
sys "update ops_thresholds set value_num=75 where key='DWELL_HOURLY_EUR'" >/dev/null

# parametr startu: 2 = od wjazdu (08:00), nie od planu
sys "update ops_thresholds set value_num=2 where key='DWELL_START_LATER'" >/dev/null
val "DWELL_START_LATER=2 liczy od wjazdu" "select to_char(start_at at time zone 'Europe/Warsaw','HH24:MI')||'/'||dwell_minutes::int from dwell_measure('$L','2026-10-01 17:01+02') where zone_kind='LOADING'" "08:00/541"
sys "update ops_thresholds set value_num=1 where key='DWELL_START_LATER'" >/dev/null

# rozładunek 4 h i zmiana progu
sys "insert into load_events (load_id, event_type, occurred_at, payload) values
 ('$L','GEOFENCE_ENTER','2026-10-05 08:00+02','{\"geofence_kind\":\"SITE\"}'),
 ('$L','GEOFENCE_EXIT','2026-10-05 12:30+02','{\"geofence_kind\":\"SITE\"}')" >/dev/null
val "rozładunek 4,5 h → 1 h × 75" "select mode||'/'||hint_eur::int from dwell_measure('$L','2026-10-05 12:30+02') where zone_kind='SITE'" "HOURLY/75"
sys "update ops_thresholds set value_num=10 where key='DWELL_FREE_UNLOAD_H'" >/dev/null
val "DWELL_FREE_UNLOAD_H=10 gasi przekroczenie rozładunku" "select mode from dwell_measure('$L','2026-10-05 12:30+02') where zone_kind='SITE'" "NONE"
sys "update ops_thresholds set value_num=4 where key='DWELL_FREE_UNLOAD_H'" >/dev/null

# postój > 24 h → doba zamiast godzin
sys "set session_replication_role=replica; update load_events set occurred_at='2026-10-02 12:00+02' where load_id='$L' and event_type='GEOFENCE_EXIT' and payload->>'geofence_kind'='LOADING'" >/dev/null
val "ponad 24 h → DAILY, 2 rozpoczęte doby × 750" "select mode||'/'||hint_eur::int from dwell_measure('$L','2026-10-02 12:00+02') where zone_kind='LOADING'" "DAILY/1500"
sys "update ops_thresholds set value_num=100 where key='DWELL_DAY_AFTER_H'" >/dev/null
val "DWELL_DAY_AFTER_H=100 zostawia stawkę godzinową" "select mode from dwell_measure('$L','2026-10-02 12:00+02') where zone_kind='LOADING'" "HOURLY"
sys "update ops_thresholds set value_num=24 where key='DWELL_DAY_AFTER_H'" >/dev/null
sys "update ops_thresholds set value_num=100 where key='DWELL_DAILY_EUR'" >/dev/null
val "DWELL_DAILY_EUR=100 zmienia podpowiedź dobową" "select hint_eur::int from dwell_measure('$L','2026-10-02 12:00+02') where zone_kind='LOADING'" 200
sys "update ops_thresholds set value_num=750 where key='DWELL_DAILY_EUR'" >/dev/null

# brak parametru = brak decyzji (bez sztywnych 360)
sys "delete from decisions where load_id='$L'" >/dev/null
sys "delete from ops_thresholds where key='DWELL_FREE_LOAD_H'" >/dev/null
val "brak progu w Opcjach = brak wierszy pomiaru" "select count(*) from dwell_measure('$L','2026-10-02 12:00+02')" 0
sys "insert into ops_thresholds (key, value_num, unit, label_pl) values ('DWELL_FREE_LOAD_H',6,'h','Czas wolny załadunek (WSTĘPNE)')" >/dev/null

echo; echo "WYNIK: $ok OK, $fail FAIL"
[ "$fail" -eq 0 ]
