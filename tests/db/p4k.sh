#!/usr/bin/env bash
# #581 P4-k cz.1 — pomiar odcinków ETA z GPS / stref (0319, F7 r1).
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
  "select count(*)::text from pg_proc where proname='eta_record_segment_observations' and pronargs=1" "1"

val "eta_route_segments zasilone (≥8)" \
  "select (count(*) >= 8)::text from eta_route_segments" "true"

val "corridor CHECK constraint istnieje" \
  "select (conname is not null)::text from pg_constraint
    where conrelid='public.eta_segment_observations'::regclass
      and conname='eta_segment_observations_corridor_check'" "true"

# Fixture: projekt STEGRA / STEGRA_BODEN (seed bramki = STEGRA)
sys "begin;
delete from eta_segment_observations where load_id = 'a581a581-0000-4000-8000-000000000581';
delete from positions where load_id = 'a581a581-0000-4000-8000-000000000581';
delete from load_events where load_id = 'a581a581-0000-4000-8000-000000000581';
delete from geofence_states where geofence_id in (select id from geofences where name like 'P4K %');
delete from loads where id = 'a581a581-0000-4000-8000-000000000581';
delete from geofences where name like 'P4K %';
insert into loads (id, project_id, order_no, hhl_order_no, carrier_order_no, status,
                   plan_load_date, plan_delivery_date, actual_delivery_at)
select 'a581a581-0000-4000-8000-000000000581', id, 'P4K-01', 'HHL-P4K-01', 'SCX-P4K-01',
       'DELIVERED', current_date - 3, current_date - 1, timestamptz '2026-10-20 18:00+02'
  from projects
 where code in ('STEGRA_BODEN', 'STEGRA')
 order by case code when 'STEGRA_BODEN' then 0 else 1 end
 limit 1;
insert into geofences (project_id, name, kind, geom, country, route)
select p.id, 'P4K ' || k, k::geofence_kind, make_circle_fence(50 + n, 15, 500),
       case when k in ('PORT_IN','SITE') then 'SE' else 'PL' end,
       case when k in ('PORT_OUT','PORT_IN') then 'POLFERRIES' else null end
  from projects p,
       (values ('LOADING',1),('PORT_OUT',2),('PORT_IN',3),('SITE',4)) v(k,n)
 where p.id = (select project_id from loads where id = 'a581a581-0000-4000-8000-000000000581');
commit;" >/dev/null

val "fixture: 1 load" \
  "select count(*)::text from loads where id='a581a581-0000-4000-8000-000000000581'" "1"

val "fixture: 4 geofences P4K" \
  "select count(*)::text from geofences where name like 'P4K %'" "4"

# Realny insert CHECK + rollback (F7 pkt 15)
val "insert SE_ROAD_KAA OK (rollback)" \
  "begin;
   insert into eta_segment_observations (load_id, corridor, hours_observed, features)
   values ('a581a581-0000-4000-8000-000000000581', 'SE_ROAD_KAA', 1, '{\"chk\":true}'::jsonb)
   returning corridor;
   rollback;" "SE_ROAD_KAA"

sys "begin;
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
-- ślad PL 06–13:30 (co 30); bez nakładania z check-in (unique load_id,ts,source)
insert into positions (load_id, ts, geom_raw, source, raw)
select 'a581a581-0000-4000-8000-000000000581',
       timestamptz '2026-10-18 06:00+02' + (g || ' minutes')::interval,
       st_setsrid(st_makepoint(17.0 + g/60.0*0.05, 52.0 + g/60.0*0.02), 4326),
       'TELEMATICS_API', '{}'::jsonb
  from generate_series(0, 450, 30) g;
-- check-in od 14:30
insert into positions (load_id, ts, geom_raw, source, raw)
select 'a581a581-0000-4000-8000-000000000581',
       timestamptz '2026-10-18 14:00+02' + (g || ' minutes')::interval,
       st_setsrid(st_makepoint(18.6, 54.4), 4326),
       'TELEMATICS_API', '{}'::jsonb
  from generate_series(30, 180, 30) g;
-- crossing od 17:30
insert into positions (load_id, ts, geom_raw, source, raw) values
 ('a581a581-0000-4000-8000-000000000581', '2026-10-18 17:30+02', st_setsrid(st_makepoint(18.7,54.4),4326),'TELEMATICS_API','{}'),
 ('a581a581-0000-4000-8000-000000000581', '2026-10-19 02:00+02', st_setsrid(st_makepoint(18.0,56.0),4326),'TELEMATICS_API','{}'),
 ('a581a581-0000-4000-8000-000000000581', '2026-10-19 10:30+02', st_setsrid(st_makepoint(17.9,58.9),4326),'TELEMATICS_API','{}');
-- SE 12–06
insert into positions (load_id, ts, geom_raw, source, raw)
select 'a581a581-0000-4000-8000-000000000581',
       timestamptz '2026-10-19 12:00+02' + (g || ' minutes')::interval,
       st_setsrid(st_makepoint(17.9 + g/60.0*0.02, 58.9 + g/60.0*0.05), 4326),
       'TELEMATICS_API', '{}'::jsonb
  from generate_series(0, 1080, 30) g;
commit;" >/dev/null

val "load_events = 6" \
  "select count(*)::text from load_events where load_id='a581a581-0000-4000-8000-000000000581'" "6"

val "pomiar: 4 odcinki" \
  "select eta_record_segment_observations('a581a581-0000-4000-8000-000000000581')::text" "4"

val "PL_ROAD hours ≈ 8" \
  "select round(hours_observed)::text from eta_segment_observations
    where load_id='a581a581-0000-4000-8000-000000000581' and corridor='PL_ROAD'
      and (features->>'p4k')='true'" "8"

approx "PL_ROAD km ≈ 31" \
  "select km_observed::text from eta_segment_observations
    where load_id='a581a581-0000-4000-8000-000000000581' and corridor='PL_ROAD'
      and (features->>'p4k')='true'" \
  31 3

val "PL_ROAD bez exclude" \
  "select (exclude_reason is null)::text from eta_segment_observations
    where load_id='a581a581-0000-4000-8000-000000000581' and corridor='PL_ROAD'
      and (features->>'p4k')='true'" "true"

val "PORT_CHECKIN hours = 3" \
  "select round(hours_observed)::text from eta_segment_observations
    where load_id='a581a581-0000-4000-8000-000000000581' and corridor='PORT_CHECKIN'" "3"

val "PORT_CHECKIN km NULL" \
  "select (km_observed is null)::text from eta_segment_observations
    where load_id='a581a581-0000-4000-8000-000000000581' and corridor='PORT_CHECKIN'" "true"

val "CROSSING_GDN_NYN hours = 18" \
  "select round(hours_observed)::text from eta_segment_observations
    where load_id='a581a581-0000-4000-8000-000000000581' and corridor='CROSSING_GDN_NYN'" "18"

val "CROSSING bez LUKA_GPS" \
  "select (exclude_reason is null)::text from eta_segment_observations
    where load_id='a581a581-0000-4000-8000-000000000581' and corridor='CROSSING_GDN_NYN'" "true"

val "SE_ROAD hours = 18" \
  "select round(hours_observed)::text from eta_segment_observations
    where load_id='a581a581-0000-4000-8000-000000000581' and corridor='SE_ROAD'" "18"

val "SE_ROAD bez exclude" \
  "select (exclude_reason is null)::text from eta_segment_observations
    where load_id='a581a581-0000-4000-8000-000000000581' and corridor='SE_ROAD'" "true"

val "ponowny pomiar: nadal 4" \
  "select eta_record_segment_observations('a581a581-0000-4000-8000-000000000581')::text" "4"

val "po ponownym: 4 wiersze p4k" \
  "select count(*)::text from eta_segment_observations
    where load_id='a581a581-0000-4000-8000-000000000581'
      and (features->>'p4k')='true'" "4"

sys "update eta_segment_observations
        set exclude_reason = 'H4_BLEDNY_POMIAR'
      where load_id='a581a581-0000-4000-8000-000000000581' and corridor='PL_ROAD'
        and (features->>'p4k')='true';
     select eta_record_segment_observations('a581a581-0000-4000-8000-000000000581');" >/dev/null

val "ręczne exclude PL_ROAD zachowane" \
  "select exclude_reason from eta_segment_observations
    where load_id='a581a581-0000-4000-8000-000000000581' and corridor='PL_ROAD'
      and (features->>'p4k')='true'" "H4_BLEDNY_POMIAR"

sys "delete from eta_segment_observations
      where load_id='a581a581-0000-4000-8000-000000000581' and corridor='PL_ROAD';
     select eta_record_segment_observations('a581a581-0000-4000-8000-000000000581');" >/dev/null

sys "begin;
update geofences set route = 'STENA' where name like 'P4K %' and kind in ('PORT_OUT','PORT_IN');
select eta_record_segment_observations('a581a581-0000-4000-8000-000000000581');
commit;" >/dev/null

val "STENA → SE_ROAD_KAA" \
  "select count(*)::text from eta_segment_observations
    where load_id='a581a581-0000-4000-8000-000000000581' and corridor='SE_ROAD_KAA'" "1"

val "STENA → PL_ROAD_GDY" \
  "select count(*)::text from eta_segment_observations
    where load_id='a581a581-0000-4000-8000-000000000581' and corridor='PL_ROAD_GDY'" "1"

val "STENA → CROSSING_GDY_KAA" \
  "select count(*)::text from eta_segment_observations
    where load_id='a581a581-0000-4000-8000-000000000581' and corridor='CROSSING_GDY_KAA'" "1"

sys "update geofences set route = 'POLFERRIES' where name like 'P4K %' and kind in ('PORT_OUT','PORT_IN');
     select eta_record_segment_observations('a581a581-0000-4000-8000-000000000581');" >/dev/null

val "eta_rebuild zwraca jsonb" \
  "select (jsonb_typeof(eta_rebuild_segment_observations(now() - interval '60 days')) = 'object')::text" "true"

val "rebuild prosrc ma REMOVED" \
  "select (prosrc like '%REMOVED%')::text from pg_proc
    where proname='eta_rebuild_segment_observations'
      and oid = (
        select p.oid from pg_proc p
         where p.proname='eta_rebuild_segment_observations'
         order by p.pronargs desc limit 1
      )" "true"

# Błąd w h4 → integration_runs z triggera (po wycofaniu podtransakcji)
sys "
create or replace function public.h4_record_eta_observation(p_load uuid)
returns bigint language plpgsql security definer set search_path = public, pg_temp as \$\$
begin
  raise exception 'p4k_forced_error' using errcode = 'P0001';
end;
\$\$;
delete from integration_runs where job = 'eta_calib_obs'
  and result->>'load_id' = 'a581a581-0000-4000-8000-000000000581';
update loads set actual_delivery_at = actual_delivery_at + interval '1 second'
 where id = 'a581a581-0000-4000-8000-000000000581';
create or replace function public.h4_record_eta_observation(p_load uuid)
returns bigint language plpgsql security definer set search_path = public, pg_temp as \$\$
declare n int;
begin
  n := eta_record_segment_observations(p_load);
  return n;
end;
\$\$;
revoke all on function public.h4_record_eta_observation(uuid) from public, anon, authenticated;
grant execute on function public.h4_record_eta_observation(uuid) to service_role;
" >/dev/null

val "integration_runs eta_calib_obs po błędzie" \
  "select count(*)::text from integration_runs
    where job='eta_calib_obs' and ok is false
      and result->>'load_id' = 'a581a581-0000-4000-8000-000000000581'" "1"

val "authenticated bez EXECUTE eta_record" \
  "select has_function_privilege('authenticated','eta_record_segment_observations(uuid)','execute')::text" "false"

val "authenticated bez EXECUTE eta_rebuild()" \
  "select has_function_privilege('authenticated','eta_rebuild_segment_observations()','execute')::text" "false"

val "anon bez EXECUTE eta_obs_position_rows" \
  "select has_function_privilege('anon','eta_obs_position_rows(uuid,timestamptz,timestamptz)','execute')::text" "false"

val "anon bez EXECUTE eta_upsert" \
  "select has_function_privilege('anon','eta_upsert_segment_observation(uuid,text,timestamptz,timestamptz)','execute')::text" "false"

val "search_path pg_temp na eta_record" \
  "select (prosecdef and coalesce(array_to_string(proconfig, ','), '') like '%pg_temp%')::text from pg_proc
    where proname='eta_record_segment_observations' and pronargs=1" "true"

echo "WYNIK: $ok OK, $fail FAIL"
[ "$fail" -eq 0 ]
