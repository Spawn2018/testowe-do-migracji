#!/usr/bin/env bash
# H-4: czas pracy kierowcy z GPS / reguły UE (bez tachografu).
. "$(git rev-parse --show-toplevel)/tests/db/refuse-prod.sh"
PSQL="psql ${PGURL:-postgres://postgres@localhost:5433/tower} -Atq"
ok=0; fail=0
sys() { $PSQL -v ON_ERROR_STOP=1 -c "$1" 2>&1; }
val() {
  out=$(sys "$2" | grep -v -E '^(BEGIN|SET|ROLLBACK|COMMIT)$' | tail -1)
  if [ "$out" = "$3" ]; then ok=$((ok+1)); echo "  OK    $1"; else fail=$((fail+1)); echo "  FAIL  $1 (otrzymano: $out, oczekiwano: $3)"; fi
}
approx() {
  # $1 label $2 sql returning numeric $3 expected $4 tolerance
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

echo; echo "[h4] H-4 UE schedule + ostrożne GPS"

val "h4_schedule_remaining istnieje" \
  "select count(*)::text from pg_proc where proname='h4_schedule_remaining'" "1"

# 8,5 h już przejechane + 3 h jazdy → odpoczynek 11 h, nie proporcja
approx "8.5h+3h jazdy → total ~14h (0.5+11+2.5)" \
  "select total_h::text from h4_schedule_remaining(3.0, 8.5, 0, 8.5)" \
  14.0 0.3

approx "8.5h+3h: rest_h = 11" \
  "select rest_h::text from h4_schedule_remaining(3.0, 8.5, 0, 8.5)" \
  11.0 0.01

# przerwa po 4,5 h
approx "0+8h: break_h >= 0.75" \
  "select break_h::text from h4_schedule_remaining(8.0, 0, 0, 0)" \
  0.75 0.01

approx "0+8h: total = drive+break (~8.75)" \
  "select total_h::text from h4_schedule_remaining(8.0, 0, 0, 0)" \
  8.75 0.2

# brak GPS → ostrożne
L1=33333333-0000-0000-0000-000000000001
val "brak GPS: cautious=true" \
  "select cautious::text from h4_driver_state_from_gps('$L1', now())" "true"

val "brak GPS: flaga ostrożna" \
  "select (flags::text like '%ostrożne%')::text from h4_driver_state_from_gps('$L1', now())" "true"

# compute_load_eta H-4 na odcinku SE ze świeżą pozycją (po wyjeździe z placu)
sys "update loads set hhl_order_no='HHL-H4-1', status='IN_TRANSIT_SE' where id='$L1'" >/dev/null
sys "insert into load_events (load_id, event_type, occurred_at, payload) values ('$L1','GEOFENCE_EXIT', now()-interval '1 day', '{\"geofence_kind\":\"LOADING\"}')" >/dev/null
sys "insert into positions (load_id, ts, geom_raw, source, raw) values ('$L1', now()-interval '5 minutes', st_setsrid(st_makepoint(18.0, 62.0), 4326), 'TELEMATICS_API', '{}'::jsonb)" >/dev/null
val "compute_load_eta: causes.h4=true" \
  "select coalesce(basis->'causes'->>'h4','') from compute_load_eta('$L1', now()) limit 1" "true"

val "compute_load_eta: causes.tachograph=none" \
  "select coalesce(basis->'causes'->>'tachograph','') from compute_load_eta('$L1', now()) limit 1" "none"


# auth: brak execute dla authenticated
val "authenticated bez EXECUTE h4_schedule" \
  "select has_function_privilege('authenticated','h4_schedule_remaining(numeric,numeric,int,numeric)','execute')::text" "false"

val "authenticated bez EXECUTE h4_state" \
  "select has_function_privilege('authenticated','h4_driver_state_from_gps(uuid,timestamptz)','execute')::text" "false"

# przepięcie: trailer_swap_at resetuje okno
sys "update loads set trailer_swap=true, trailer_swap_at=now()-interval '1 hour', driver_delivery_name='Adam Nowak' where id='$L1'" >/dev/null
val "po przepięciu: flaga przepięcia w state" \
  "select (flags::text like '%przepięcie%')::text from h4_driver_state_from_gps('$L1', now())" "true"

echo "WYNIK: $ok OK, $fail FAIL"
