#!/usr/bin/env bash
# I-8 — czasy zapytań w bazie (LOKALNY Supabase, po scripts/i8/seed.sql). Mediana z 7 powtórzeń, ms.
set -euo pipefail
DB=${DB_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}
case "$DB" in *127.0.0.1*|*localhost*) ;; *) echo "I-8 STOP: tylko lokalna baza" >&2; exit 2;; esac
med() { sort -n | awk '{a[NR]=$1} END {print a[int((NR+1)/2)]}'; }
t_ms() { # $1 = auth uid (albo pusty = postgres), $2 = SQL
  for i in 1 2 3 4 5 6 7; do
    if [ -n "$1" ]; then pre="set local role authenticated; set local request.jwt.claims = '{\"sub\":\"$1\",\"role\":\"authenticated\",\"aal\":\"aal2\"}';"; else pre=""; fi
    psql "$DB" -Atq -c "begin; $pre select set_config('i8.t0', clock_timestamp()::text, true); $2; select round(extract(epoch from clock_timestamp() - current_setting('i8.t0')::timestamptz) * 1000, 1); rollback;" 2>/dev/null | tail -1
  done | med; }
SNAP="select count(*) from (select l.*, (select json_agg(s) from shipment_items s where s.load_id = l.id) si, (select row_to_json(x) from sailings x where x.id = l.sailing_id) sa from loads l where l.status <> 'CANCELLED' order by plan_load_date) q"
for r in hhl ksh scx; do
  uid=$(psql "$DB" -Atc "select auth_id from app_users where email='$r@bk5.local'")
  n=$(psql "$DB" -Atq -c "begin; set local role authenticated; set local request.jwt.claims = '{\"sub\":\"$uid\",\"role\":\"authenticated\",\"aal\":\"aal2\"}'; select count(*) from loads where status <> 'CANCELLED'; rollback;" | tail -1)
  echo "harmonogram $r: transportów=$n; loads+ładunki+rejs ms=$(t_ms "$uid" "$SNAP"); ryzyka ms=$(t_ms "$uid" "select count(*) from risk_signals where resolved_at is null"); ceny ms=$(t_ms "$uid" "select count(*) from v_load_price_carrier; select count(*) from v_load_price_client")"
done
A=$(psql "$DB" -Atc "select id from loads where order_no like 'PERF/%' and status='IN_TRANSIT_SE' limit 1")
echo "GPS: pozycji=$(psql "$DB" -Atc "select count(*) from positions"), rozmiar=$(psql "$DB" -Atc "select pg_size_pretty(pg_total_relation_size('positions'))")"
echo "process_position (1 punkt + strefy + ETA) ms=$(t_ms "" "select process_position('$A', 60.5, 17.5, now() + interval '1 hour', 'DRIVER_PWA', 70, 10, true, '{}')")"
echo "ostatnia pozycja 20 aut ms=$(t_ms "" "select count(*) from (select distinct on (load_id) load_id, ts from positions where load_id in (select id from loads where status between 'IN_TRANSIT_PL' and 'IN_TRANSIT_SE') order by load_id, ts desc) q")"
echo "compute_load_eta ×300 ms=$(t_ms "" "select count(*) from loads l, compute_load_eta(l.id) e where l.order_no like 'PERF/%'")"
echo "detect_silent_vehicles ms=$(t_ms "" "select detect_silent_vehicles()")"
echo "purge_personal_data ms=$(t_ms "" "select purge_personal_data()")"
