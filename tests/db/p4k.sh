#!/usr/bin/env bash
# #581 P4-k cz.1 — pomiar odcinków ETA z GPS / stref (0317).
. "$(git rev-parse --show-toplevel)/tests/db/refuse-prod.sh"
PSQL="psql ${PGURL:-postgres://postgres@localhost:5433/tower} -Atq"
ok=0; fail=0
sys() { $PSQL -v ON_ERROR_STOP=1 -c "$1" 2>&1; }
val() {
  out=$(sys "$2" | grep -v -E '^(BEGIN|SET|ROLLBACK|COMMIT)$' | tail -1)
  if [ "$out" = "$3" ]; then ok=$((ok+1)); echo "  OK    $1"; else fail=$((fail+1)); echo "  FAIL  $1 (otrzymano: $out, oczekiwano: $3)"; fi
}
approx() {
  out=$(sys "$2" | grep -v -E '^(BEGIN|SET|ROLLBACK|COMMIT)$' | tail -1)
  python3 - "$out" "$3" "$4" "$1" <<'PY'
import sys
got, exp, tol, label = sys.argv[1], float(sys.argv[2]), float(sys.argv[3]), sys.argv[4]
try:
  g = float(got)
except Exception:
  print(f"  FAIL  {label} (nie-liczba: {got})")
  sys.exit(2)
if abs(g - exp) <= tol:
  print(f"  OK    {label}")
  sys.exit(0)
print(f"  FAIL  {label} (otrzymano: {g}, oczekiwano: {exp}±{tol})")
sys.exit(1)
PY
  rc=$?
  if [ $rc -eq 0 ]; then ok=$((ok+1)); else fail=$((fail+1)); fi
}

echo; echo "[p4k] #581 pomiar odcinków z GPS"

val "eta_record_segment_observations istnieje" \
  "select count(*)::text from pg_proc where proname='eta_record_segment_observations'" "1"

val "corridor CHECK dopuszcza SE_ROAD_KAA" \
  "select (conname is not null)::text from pg_constraint
    where conrelid='public.eta_segment_observations'::regclass
      and conname='eta_segment_observations_corridor_check'" "true"

# Fixture: 1 transport, strefy, ślad GPS bez luk
sys "begin; set local session_replication_role = replica;
delete from eta_segment_observations where load_id = 'a581a581-0000-4000-8000-000000000581';
delete from positions where load_id = 'a581a581-0000-4000-8000-000000000581';
delete from load_events where load_id = 'a581a581-0000-4000-8000-000000000581';
delete from loads where id = 'a581a581-0000-4000-8000-000000000581';
delete from geofences where name like 'P4K %';
insert into loads (id, project_id, order_no, hhl_order_no, carrier_order_no, status,
                   plan_load_date, plan_delivery_date, actual_delivery_at)
select 'a581a581-0000-4000-8000-000000000581', id, 'P4K-01', 'HHL-P4K-01', 'SCX-P4K-01',
       'DELIVERED', current_date - 3, current_date - 1, timestamptz '2026-10-20 18:00+02'
  from projects where code = 'STEGRA_BODEN';
insert into geofences (project_id, name, kind, geom, country)
select p.id, 'P4K ' || k, k::geofence_kind, make_circle_fence(50 + n, 15, 500),
       case when k in ('PORT_IN','SITE') then 'SE' else 'PL' end
  from projects p,
       (values ('LOADING',1),('PORT_OUT',2),('PORT_IN',3),('SITE',4)) v(k,n)
 where p.code = 'STEGRA_BODEN';
commit;" >/dev/null

sys "begin; set local session_replication_role = replica;
with f as (select kind::text k, id from geofences where name like 'P4K %'),
t(ev, k, ts) as (values
  ('GEOFENCE_EXIT','LOADING',  timestamptz '2026-10-18 06:00+02'),
  ('GEOFENCE_ENTER','PORT_OUT', timestamptz '2026-10-18 14:00+02'),
  ('GEOFENCE_EXIT','PORT_OUT',  timestamptz '2026-10-18 17:00+02'),
  ('GEOFENCE_ENTER','PORT_IN',  timestamptz '2026-10-19 11:00+02'),
  ('GEOFENCE_EXIT','PORT_IN',   timestamptz '2026-10-19 12:00+02'),
  ('GEOFENCE_ENTER','SITE',     timestamptz '2026-10-20 06:00+02')
)
insert into load_events (load_id, event_type, occurred_at, payload)
select 'a581a581-0000-4000-8000-000000000581', t.ev, t.ts,
       jsonb_build_object('geofence_id', f.id, 'geofence_kind', f.k)
  from t join f on f.k = t.k;
-- ślad PL 06–14 (co 30 min, ~8 h, bez luki >60)
insert into positions (load_id, ts, geom_raw, source, raw)
select 'a581a581-0000-4000-8000-000000000581',
       timestamptz '2026-10-18 06:00+02' + (g || ' minutes')::interval,
       st_setsrid(st_makepoint(17.0 + g/60.0*0.05, 52.0 + g/60.0*0.02), 4326),
       'TELEMATICS_API', '{}'::jsonb
  from generate_series(0, 480, 30) g;
-- check-in 14–17
insert into positions (load_id, ts, geom_raw, source, raw)
select 'a581a581-0000-4000-8000-000000000581',
       timestamptz '2026-10-18 14:00+02' + (g || ' minutes')::interval,
       st_setsrid(st_makepoint(18.6, 54.4), 4326),
       'TELEMATICS_API', '{}'::jsonb
  from generate_series(0, 180, 30) g;
-- crossing 17–11 next day (~18 h) — gęsty ślad na morzu niepotrzebny; punkty brzegowe + mid
insert into positions (load_id, ts, geom_raw, source, raw) values
 ('a581a581-0000-4000-8000-000000000581', '2026-10-18 17:00+02', st_setsrid(st_makepoint(18.7,54.4),4326),'TELEMATICS_API','{}'),
 ('a581a581-0000-4000-8000-000000000581', '2026-10-19 02:00+02', st_setsrid(st_makepoint(18.0,56.0),4326),'TELEMATICS_API','{}'),
 ('a581a581-0000-4000-8000-000000000581', '2026-10-19 11:00+02', st_setsrid(st_makepoint(17.9,58.9),4326),'TELEMATICS_API','{}');
-- SE 12–06 (~18 h) co 30 min
insert into positions (load_id, ts, geom_raw, source, raw)
select 'a581a581-0000-4000-8000-000000000581',
       timestamptz '2026-10-19 12:00+02' + (g || ' minutes')::interval,
       st_setsrid(st_makepoint(17.9 + g/60.0*0.02, 58.9 + g/60.0*0.05), 4326),
       'TELEMATICS_API', '{}'::jsonb
  from generate_series(0, 1080, 30) g;
commit;" >/dev/null

val "pomiar: 4 odcinki" \
  "select eta_record_segment_observations('a581a581-0000-4000-8000-000000000581')::text" "4"

val "PL_ROAD hours ≈ 8" \
  "select round(hours_observed)::text from eta_segment_observations
    where load_id='a581a581-0000-4000-8000-000000000581' and corridor='PL_ROAD'" "8"

approx "PL_ROAD km > 0" \
  "select km_observed::text from eta_segment_observations
    where load_id='a581a581-0000-4000-8000-000000000581' and corridor='PL_ROAD'" \
  50 50

val "PL_ROAD bez exclude" \
  "select (exclude_reason is null)::text from eta_segment_observations
    where load_id='a581a581-0000-4000-8000-000000000581' and corridor='PL_ROAD'" "true"

val "PORT_CHECKIN hours = 3" \
  "select round(hours_observed)::text from eta_segment_observations
    where load_id='a581a581-0000-4000-8000-000000000581' and corridor='PORT_CHECKIN'" "3"

val "CROSSING_DEFAULT hours = 18" \
  "select round(hours_observed)::text from eta_segment_observations
    where load_id='a581a581-0000-4000-8000-000000000581' and corridor='CROSSING_DEFAULT'" "18"

# Crossing ma lukę 9 h między punktami → exclude LUKA_GPS
val "CROSSING exclude LUKA_GPS" \
  "select coalesce(exclude_reason,'') from eta_segment_observations
    where load_id='a581a581-0000-4000-8000-000000000581' and corridor='CROSSING_DEFAULT'" "LUKA_GPS"

val "SE_ROAD hours = 18" \
  "select round(hours_observed)::text from eta_segment_observations
    where load_id='a581a581-0000-4000-8000-000000000581' and corridor='SE_ROAD'" "18"

val "SE_ROAD bez exclude (gęsty ślad)" \
  "select (exclude_reason is null)::text from eta_segment_observations
    where load_id='a581a581-0000-4000-8000-000000000581' and corridor='SE_ROAD'" "true"

# Idempotencja
val "ponowny pomiar: nadal 4" \
  "select eta_record_segment_observations('a581a581-0000-4000-8000-000000000581')::text" "4"

val "po ponownym: 4 aktywne wiersze (bez exclude H4)" \
  "select count(*)::text from eta_segment_observations
    where load_id='a581a581-0000-4000-8000-000000000581'
      and coalesce(exclude_reason,'') <> 'H4_BLEDNY_POMIAR'" "4"

# authenticated bez EXECUTE
val "authenticated bez EXECUTE eta_record" \
  "select has_function_privilege('authenticated','eta_record_segment_observations(uuid)','execute')::text" "false"

val "authenticated bez EXECUTE eta_rebuild" \
  "select has_function_privilege('authenticated','eta_rebuild_segment_observations()','execute')::text" "false"

echo "WYNIK: $ok OK, $fail FAIL"
[ "$fail" -eq 0 ]
