#!/usr/bin/env bash
# #581 P4-k — pomiar GPS (0319) + kalibracja ciągła / auto-apply 27A (0320).
. "$(git rev-parse --show-toplevel)/tests/db/refuse-prod.sh"
PSQL="psql ${PGURL:-postgres://postgres@localhost:5433/tower} -Atq"
ok=0; fail=0
HHL=11111111-0000-0000-0000-000000000001
KSH=11111111-0000-0000-0000-000000000002
sys() { $PSQL -v ON_ERROR_STOP=1 -c "$1" 2>&1; }
# Wywołanie RPC jako rola (F7 D8: undo HHL / odmowa KSH)
as_role() {
  sys "begin; set local role authenticated; set local request.jwt.claim.sub='$1'; $2; commit;"
}
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

val "authenticated bez EXECUTE eta_rebuild(timestamptz)" \
  "select has_function_privilege('authenticated','eta_rebuild_segment_observations(timestamptz)','execute')::text" "false"

val "brak wrappera eta_rebuild()" \
  "select count(*)::text from pg_proc where proname='eta_rebuild_segment_observations' and pronargs=0" "0"

val "eta_rebuild bez arg (DEFAULT) jednoznaczny" \
  "select jsonb_typeof(eta_rebuild_segment_observations())" "object"

val "anon bez EXECUTE eta_obs_position_rows" \
  "select has_function_privilege('anon','eta_obs_position_rows(uuid,timestamptz,timestamptz)','execute')::text" "false"

val "anon bez EXECUTE eta_upsert 6-arg" \
  "select has_function_privilege('anon','eta_upsert_segment_observation(uuid,text,timestamptz,timestamptz,boolean,text)','execute')::text" "false"

val "brak wrappera eta_upsert 4-arg" \
  "select count(*)::text from pg_proc
    where proname='eta_upsert_segment_observation' and pronargs=4" "0"

val "search_path pg_temp na eta_record" \
  "select (prosecdef and coalesce(array_to_string(proconfig, ','), '') like '%pg_temp%')::text from pg_proc
    where proname='eta_record_segment_observations' and pronargs=1" "true"

# --- cz.2: propozycja / auto-apply 27A / undo / freeze (F7 r1 #604) ---
echo; echo "[p4k] #581 cz.2 kalibracja ciągła (0320)"

# D7: zapamiętaj PL_ROAD z seeda (i2: 7.5/25)
PL_H=$(sys "select hours::text from eta_segment_params where code='PL_ROAD'" | grep -v -E '^(BEGIN|SET|ROLLBACK|COMMIT)$' | tail -1 | tr -d '\r')
PL_SP=$(sys "select spread_pct::text from eta_segment_params where code='PL_ROAD'" | grep -v -E '^(BEGIN|SET|ROLLBACK|COMMIT)$' | tail -1 | tr -d '\r')
PL_SRC=$(sys "select source from eta_segment_params where code='PL_ROAD'" | grep -v -E '^(BEGIN|SET|ROLLBACK|COMMIT)$' | tail -1 | tr -d '\r')

sys "begin;
delete from notifications where template = 'ETA_CALIBRATION_AUTO';
delete from eta_segment_observations where coalesce(features->>'p4k_calib','') = 'true';
delete from eta_calibration_versions where note like 'p4k-test%' or note like 'propozycja ciągła%';
delete from decision_events where decision_id in (select id from decisions where type_code='ETA_CALIBRATION_APPROVAL');
delete from decisions where type_code = 'ETA_CALIBRATION_APPROVAL';
-- GPS z cz.1 też ma features.p4k — wyłącz z propose (zostaje p4k_calib)
update eta_segment_observations
   set features = (features - 'p4k') || jsonb_build_object('p4k_gps', true)
 where load_id = 'a581a581-0000-4000-8000-000000000581'
   and coalesce(features->>'p4k','') = 'true';
-- Unikalność p4k(load_id,corridor): osobny transport na każdy pomiar (Ś5 + indeks 0319)
-- D11: auto wymaga n_obs≥10 — 8 fit + 4 test (lpad, nie …059||10)
delete from notifications
 where load_id::text like 'a581a581-0000-4000-8000-0000000005%'
   and load_id <> 'a581a581-0000-4000-8000-000000000581';
delete from risk_signals
 where load_id::text like 'a581a581-0000-4000-8000-0000000005%'
   and load_id <> 'a581a581-0000-4000-8000-000000000581';
delete from loads
 where id::text like 'a581a581-0000-4000-8000-0000000005%'
   and id <> 'a581a581-0000-4000-8000-000000000581';
insert into loads (id, project_id, order_no, hhl_order_no, carrier_order_no, status,
                   plan_load_date, plan_delivery_date, actual_delivery_at)
select ('a581a581-0000-4000-8000-0000000005' || lpad(g::text, 2, '0'))::uuid,
       (select project_id from loads where id='a581a581-0000-4000-8000-000000000581'),
       'P4K-C' || g, 'HHL-P4K-C' || g, 'SCX-P4K-C' || g,
       'DELIVERED', current_date - 25, current_date - 20, now() - interval '20 days'
  from generate_series(1, 12) g;
-- 8 starszych + 4 nowsze PL_ROAD; mediana ~10 h vs seed 7,5 → >10 %
-- Ś5: gps_quality=true dla PL_ROAD
insert into eta_segment_observations (load_id, corridor, hours_observed, km_observed, tempo_h_per_100km, features, observed_at)
select ('a581a581-0000-4000-8000-0000000005' || lpad(ord::text, 2, '0'))::uuid, 'PL_ROAD', h, 300, h/3.0,
       jsonb_build_object('p4k', true, 'p4k_calib', true, 'gps_quality', true),
       now() - interval '20 days' + (ord || ' hours')::interval
  from (values (1,9.5),(2,10.0),(3,10.0),(4,10.5),(5,11.0),(6,9.8),(7,10.0),(8,10.2)) as t(ord,h);
insert into eta_segment_observations (load_id, corridor, hours_observed, km_observed, tempo_h_per_100km, features, observed_at)
select ('a581a581-0000-4000-8000-0000000005' || lpad((8+ord)::text, 2, '0'))::uuid, 'PL_ROAD', h, 300, h/3.0,
       jsonb_build_object('p4k', true, 'p4k_calib', true, 'gps_quality', true),
       now() - interval '2 days' + (ord || ' hours')::interval
  from (values (1,9.8),(2,10.0),(3,10.2),(4,9.9)) as t(ord,h);
commit;" >/dev/null

val "propose: powstaje przy n≥5 i >10%" \
  "select coalesce((eta_propose_calibration()->>'proposal') is not null, false)::text" "true"

val "propose: jedna niezatwierdzona" \
  "select count(*)::text from eta_calibration_versions where applied is not true and note like 'propozycja ciągła%'" "1"

val "Ś1: alias STENA → GDY-KAA" \
  "select route_key from eta_route_aliases where alias_key='STENA'" "GDY-KAA"

# auto ≤15 %, n_obs≥10 (D11); spread bez zmian (F7 r8: Δspread w pp/100 — 15→12 = 0,03)
sys "begin;
update eta_segment_params set hours = 8.9 where code = 'PL_ROAD';
delete from eta_calibration_versions
 where applied is not true
   and created_by is null
   and coalesce(note, '') like 'propozycja ciągła%';
delete from decision_events where decision_id in (select id from decisions where type_code='ETA_CALIBRATION_APPROVAL');
delete from decisions where type_code = 'ETA_CALIBRATION_APPROVAL';
insert into eta_calibration_versions (params_before, params_after, n_obs, error_before_min, error_after_min, applied, note)
values (
  jsonb_build_object('PL_ROAD', jsonb_build_object('hours', 8.9, 'spread_pct', 15)),
  jsonb_build_object('PL_ROAD', jsonb_build_object('hours', 10.0, 'spread_pct', 15)),
  10, 90, 60, false, 'propozycja ciągła #581 p4k-auto-12'
);
commit;" >/dev/null

val "auto 12%: stosuje" \
  "select (eta_auto_apply_pending()->>'applied' is not null)::text" "true"

val "auto 12%: PL_ROAD=10" \
  "select trim_scale(hours)::text from eta_segment_params where code='PL_ROAD'" "10"

val "audyt automat kalibracji" \
  "select (new_value->>'actor' = 'automat kalibracji')::text
     from audit_log where action='ETA_CALIBRATION_APPLY'
     order by created_at desc nulls last, id desc limit 1" "true"

# #603: audyt auto ma policzone max_change_pct (nie 0)
val "#603: audyt max_change_pct > 0" \
  "select ((new_value->>'max_change_pct')::numeric > 0)::text
     from audit_log where action='ETA_CALIBRATION_APPLY'
     order by created_at desc nulls last, id desc limit 1" "true"

HHL_N=$(sys "select count(*)::text from app_users where active is true and role='HHL_ADMIN'" | grep -v -E '^(BEGIN|SET|ROLLBACK|COMMIT)$' | tail -1 | tr -d '\r')
val "B3: powiadomienia = liczba HHL_ADMIN ($HHL_N)" \
  "select count(*)::text from notifications
    where template='ETA_CALIBRATION_AUTO' and payload->>'matrix_event'='eta_calib'" "$HHL_N"

val "B3: payload title+summary" \
  "select (payload ? 'title' and payload ? 'summary' and payload ? 'undo_version')::text
     from notifications where template='ETA_CALIBRATION_AUTO' order by id desc limit 1" "true"

# #603 D7: labels[PL_ROAD] = eta_segment_params.label
val "#603: payload labels PL_ROAD = label" \
  "select (n.payload->'labels'->>'PL_ROAD' = p.label)::text
     from notifications n, eta_segment_params p
    where n.template='ETA_CALIBRATION_AUTO' and p.code='PL_ROAD'
    order by n.id desc limit 1" "true"

val "#603: summary przecinek dziesiętny" \
  "select (payload->>'summary' ~ '[0-9]+,[0-9]+%')::text
     from notifications where template='ETA_CALIBRATION_AUTO' order by id desc limit 1" "true"

# B2: brak wiersza HHL_OPS w macierzy eta_calib
val "#603: brak HHL_OPS w macierzy eta_calib" \
  "select count(*)::text from notification_matrix
    where event_key='eta_calib' and role='HHL_OPS'" "0"

AUTO_VER=$(sys "select id::text from eta_calibration_versions where note like '%p4k-auto-12%' and applied is true order by id desc limit 1" | grep -v -E '^(BEGIN|SET|ROLLBACK|COMMIT)$' | tail -1 | tr -d '\r')

val "B5a: undo_version = zastosowana" \
  "select (payload->>'undo_version' = '$AUTO_VER')::text from notifications
    where template='ETA_CALIBRATION_AUTO' order by id desc limit 1" "true"

# F7 r1/r2 B1–B2: user_id = app_users.id (nie auth_id); pozytyw: applied + drugi admin bez prefu
OPS_AUTH=11111111-0000-0000-0000-000000000004
HHL_UID=$(sys "select id::text from app_users where auth_id='$HHL'" | grep -v -E '^(BEGIN|SET|ROLLBACK|COMMIT)$' | tail -1 | tr -d '\r')
sys "begin;
insert into app_users (auth_id, org_id, email, role, active)
values ('$OPS_AUTH','00000000-0000-0000-0000-00000000a001',
        'ops-p4k@test','HHL_OPS',true)
on conflict (auth_id) do update set role='HHL_OPS', active=true, org_id=excluded.org_id;
insert into app_users (auth_id, org_id, email, role, active)
values ('11111111-0000-0000-0000-0000000000aa','00000000-0000-0000-0000-00000000a001',
        'admin2-p4k@test','HHL_ADMIN',true)
on conflict (auth_id) do update set role='HHL_ADMIN', active=true, org_id=excluded.org_id;
insert into user_notify_pref (user_id, event_key, channel, on_value)
values
  ('$HHL_UID', 'eta_calib', 'bell', false),
  ((select id from app_users where auth_id='$OPS_AUTH'), 'eta_calib', 'bell', true)
on conflict (user_id, event_key, channel) do update set on_value = excluded.on_value;
delete from notifications where template = 'ETA_CALIBRATION_AUTO';
delete from eta_calibration_versions
 where applied is not true
   and created_by is null
   and coalesce(note, '') like 'propozycja ciągła%';
update eta_segment_params set hours = 8.9 where code = 'PL_ROAD';
insert into eta_calibration_versions (params_before, params_after, n_obs, error_before_min, error_after_min, applied, note)
values (
  jsonb_build_object('PL_ROAD', jsonb_build_object('hours', 8.9, 'spread_pct', 15)),
  jsonb_build_object('PL_ROAD', jsonb_build_object('hours', 10.0, 'spread_pct', 15)),
  10, 90, 60, false, 'propozycja ciągła #603 p4k-optout-bell'
);
select eta_auto_apply_pending();
commit;" >/dev/null

OPS_UID=$(sys "select id::text from app_users where auth_id='$OPS_AUTH'" | grep -v -E '^(BEGIN|SET|ROLLBACK|COMMIT)$' | tail -1 | tr -d '\r')
ADMIN2_UID=$(sys "select id::text from app_users where auth_id='11111111-0000-0000-0000-0000000000aa'" | grep -v -E '^(BEGIN|SET|ROLLBACK|COMMIT)$' | tail -1 | tr -d '\r')

val "#603 B1+: p4k-optout-bell applied" \
  "select applied::text from eta_calibration_versions
    where note like '%p4k-optout-bell%' order by id desc limit 1" "true"

val "#603 B1+: drugi HHL_ADMIN bez prefu → 1" \
  "select count(*)::text from notifications
    where template='ETA_CALIBRATION_AUTO' and user_id='$ADMIN2_UID'" "1"

val "#603 B1: HHL_ADMIN bell=false → 0" \
  "select count(*)::text from notifications
    where template='ETA_CALIBRATION_AUTO' and user_id='$HHL_UID'" "0"

val "#603 B2: HHL_OPS bell=true → 0" \
  "select count(*)::text from notifications
    where template='ETA_CALIBRATION_AUTO' and user_id='$OPS_UID'" "0"

sys "begin;
delete from user_notify_pref where event_key='eta_calib'
  and user_id in ('$HHL_UID'::uuid, '$OPS_UID'::uuid);
delete from notifications where template = 'ETA_CALIBRATION_AUTO'
   or user_id = '$ADMIN2_UID'::uuid;
delete from app_users where auth_id = '11111111-0000-0000-0000-0000000000aa';
-- F7 r2+: p4k-optout-bell dostaje note …; auto-applied → Ś3 blokuje PL_ROAD (<7 d)
update eta_calibration_versions
   set created_at = now() - interval '8 days',
       undone_at = now() - interval '8 days'
 where note like '%p4k-optout-bell%'
   and applied is true
   and undone_at is null;
update eta_segment_params set hours = 8.5, spread_pct = 15 where code = 'PL_ROAD';
commit;" >/dev/null

# F7 r8 #605: Δspread w pp/100 — 15→40 = 0,25 → NEEDS_APPROVAL (godziny bez zmian)
sys "begin;
delete from eta_calibration_versions
 where applied is not true
   and created_by is null
   and coalesce(note, '') like 'propozycja ciągła%';
delete from decision_events where decision_id in (select id from decisions where type_code='ETA_CALIBRATION_APPROVAL');
delete from decisions where type_code = 'ETA_CALIBRATION_APPROVAL';
insert into eta_calibration_versions (params_before, params_after, n_obs, error_before_min, error_after_min, applied, note)
values (
  jsonb_build_object('PL_ROAD', jsonb_build_object('hours', 10.0, 'spread_pct', 15)),
  jsonb_build_object('PL_ROAD', jsonb_build_object('hours', 10.0, 'spread_pct', 40)),
  10, 80, 50, false, 'propozycja ciągła #581 p4k-spread-pp'
);
commit;" >/dev/null

val "spread 15→40 pp: NEEDS_APPROVAL" \
  "select eta_auto_apply_pending()->>'reason'" "NEEDS_APPROVAL"

# 18 % godzin — decyzja HHL_ADMIN (B4 ADMIN); spread stały
sys "begin;
update eta_segment_params set hours = 8.5 where code = 'PL_ROAD';
delete from eta_calibration_versions
 where applied is not true
   and created_by is null
   and coalesce(note, '') like 'propozycja ciągła%';
delete from decision_events where decision_id in (select id from decisions where type_code='ETA_CALIBRATION_APPROVAL');
delete from decisions where type_code = 'ETA_CALIBRATION_APPROVAL';
insert into eta_calibration_versions (params_before, params_after, n_obs, error_before_min, error_after_min, applied, note)
values (
  jsonb_build_object('PL_ROAD', jsonb_build_object('hours', 8.5, 'spread_pct', 15)),
  jsonb_build_object('PL_ROAD', jsonb_build_object('hours', 10.0, 'spread_pct', 15)),
  10, 100, 50, false, 'propozycja ciągła #581 p4k-auto-18'
);
commit;" >/dev/null

val "auto 18%: NEEDS_APPROVAL" \
  "select eta_auto_apply_pending()->>'reason'" "NEEDS_APPROVAL"

val "B4: decyzja ETA_CALIBRATION_APPROVAL" \
  "select count(*)::text from decisions
    where type_code='ETA_CALIBRATION_APPROVAL' and status in ('NEW','ASSIGNED')" "1"

val "B4: decider_role=ADMIN" \
  "select decider_role from decision_types where code='ETA_CALIBRATION_APPROVAL'" "ADMIN"

val "auto 18%: PL_ROAD bez zmian (8.5)" \
  "select trim_scale(hours)::text from eta_segment_params where code='PL_ROAD'" "8.5"

val "B4: KSH 0 decyzji APPROVAL" \
  "begin; set local role authenticated; set local request.jwt.claim.sub='$KSH';
   select count(*)::text from decisions where type_code='ETA_CALIBRATION_APPROVAL';
   commit;" "0"

val "B4: SCX 0 decyzji APPROVAL" \
  "begin; set local role authenticated; set local request.jwt.claim.sub='11111111-0000-0000-0000-000000000003';
   select count(*)::text from decisions where type_code='ETA_CALIBRATION_APPROVAL';
   commit;" "0"

# F7 r5 B3: DECISION_OPEN / L-13 tylko HHL_ADMIN (nie HHL_OPS); user_id = app_users.id
sys "insert into app_users (auth_id, org_id, email, role, active)
     values ('11111111-0000-0000-0000-000000000004','00000000-0000-0000-0000-00000000a001',
             'ops-p4k@test','HHL_OPS',true)
     on conflict (auth_id) do update set role='HHL_OPS', active=true, org_id=excluded.org_id;" >/dev/null
OPS_UID=$(sys "select id::text from app_users where auth_id='11111111-0000-0000-0000-000000000004'" | grep -v -E '^(BEGIN|SET|ROLLBACK|COMMIT)$' | tail -1 | tr -d '\r')
HHL_UID=$(sys "select id::text from app_users where auth_id='$HHL'" | grep -v -E '^(BEGIN|SET|ROLLBACK|COMMIT)$' | tail -1 | tr -d '\r')

val "B3: HHL_OPS 0 DECISION_OPEN kalibracji" \
  "select count(*)::text from notifications
    where template='DECISION_OPEN'
      and user_id='$OPS_UID'::uuid
      and payload->>'type'='ETA_CALIBRATION_APPROVAL'" "0"

# #603 B3: APPLY z Opcji zamyka decyzję (count, nie tail true z apply)
sys "begin;
insert into eta_calibration_versions (params_before, params_after, n_obs, error_before_min, error_after_min, applied, note)
values (
  jsonb_build_object('PL_ROAD', jsonb_build_object('hours', 8.5, 'spread_pct', 15)),
  jsonb_build_object('PL_ROAD', jsonb_build_object('hours', 9.0, 'spread_pct', 15)),
  10, 80, 40, false, 'propozycja ciągła #603 p4k-opt-apply'
);
select decision_open_from_event(
  (select project_id from loads where id='a581a581-0000-4000-8000-000000000581'),
  'ETA_CALIBRATION_APPROVAL',
  'ETA_CALIB_VER:' || (select id::text from eta_calibration_versions where note like '%p4k-opt-apply%' order by id desc limit 1),
  'test #603 apply z Opcji',
  jsonb_build_object(
    'version', (select id from eta_calibration_versions where note like '%p4k-opt-apply%' order by id desc limit 1),
    'action', 'apply_eta_calibration_version',
    'max_change_pct', 20,
    'severity_override', 'WARNING'
  ),
  null, null
);
commit;" >/dev/null

OPT_VER=$(sys "select id::text from eta_calibration_versions where note like '%p4k-opt-apply%' order by id desc limit 1" | grep -v -E '^(BEGIN|SET|ROLLBACK|COMMIT)$' | tail -1 | tr -d '\r')

val "#603 B3: APPLY z Opcji → 1 decyzja RESOLVED" \
  "begin; set local role authenticated; set local request.jwt.claim.sub='$HHL';
   select apply_eta_calibration_version($OPT_VER);
   select count(*)::text from decisions
    where detail->>'event_key' = 'ETA_CALIB_VER:$OPT_VER'
      and status = 'RESOLVED' and resolution_code = 'APPLY'
      and resolved_by = '$HHL_UID'::uuid;
   commit;" "1"

val "#603 B3: 1× decision_events RESOLVE (apply_internal)" \
  "select count(*)::text from decision_events e
     join decisions d on d.id = e.decision_id
    where d.detail->>'event_key' = 'ETA_CALIB_VER:$OPT_VER'
      and e.action = 'RESOLVE'
      and e.payload->>'source' = 'eta_apply_calibration_internal'" "1"

val "#603 B3: decyzja innej wersji zostaje NEW" \
  "select count(*)::text from decisions
    where type_code = 'ETA_CALIBRATION_APPROVAL'
      and status in ('NEW', 'ASSIGNED')
      and detail->>'event_key' is distinct from 'ETA_CALIB_VER:$OPT_VER'" "1"

# D2: audyt APPLY ręcznego ma max_change_pct > 0
val "#603 D2: audyt APPLY ręczny max_change > 0" \
  "select ((new_value->>'max_change_pct')::numeric > 0 and (new_value->>'auto')::boolean is false)::text
     from audit_log
    where action='ETA_CALIBRATION_APPLY' and entity_id='$OPT_VER'
    order by created_at desc nulls last, id desc limit 1" "true"

val "#603 D1: audyt DECISION_RESOLVE po APPLY" \
  "select count(*)::text from audit_log
    where action='DECISION_RESOLVE'
      and (new_value->>'version')::bigint = $OPT_VER
      and new_value->>'source' = 'eta_apply_calibration_internal'" "1"

sys "begin;
delete from decision_events where decision_id in (
  select id from decisions where detail->>'event_key' = 'ETA_CALIB_VER:$OPT_VER');
delete from decisions where detail->>'event_key' = 'ETA_CALIB_VER:$OPT_VER';
delete from audit_log where action in ('ETA_CALIBRATION_APPLY','DECISION_RESOLVE')
  and (entity_id = '$OPT_VER' or (new_value->>'version')::text = '$OPT_VER');
delete from eta_calibration_versions where id = $OPT_VER;
update eta_segment_params set hours = 8.5, spread_pct = 15 where code = 'PL_ROAD';
commit;" >/dev/null

# F7 r5/r6 B2: przy otwartej decyzji propose → SUPERSEDED + rejected_at (bez wiecznego BLOCKED)
VER18=$(sys "select id::text from eta_calibration_versions where note like '%p4k-auto-18%' order by id desc limit 1" | grep -v -E '^(BEGIN|SET|ROLLBACK|COMMIT)$' | tail -1 | tr -d '\r')
# Ś3: auto-applied w <7 d blokuje PL_ROAD (<3 nowych obs) → NO_CHANGE; starzej wszystkie (AUTO_VER + ewentualne resztki)
sys "begin;
update eta_calibration_versions
   set created_at = now() - interval '8 days'
 where applied is true
   and undone_at is null
   and coalesce(note, '') like '%auto-applied%'
   and created_at > now() - interval '7 days';
commit;"
sys "begin;
-- fit≈9.6 przy hours=8.5 → Δh≈12.9 % (>10, ≤15); test≈9.5 (po lepsze niż przed) — otwarta decyzja na VER18
-- F7 r8: płaskie godziny → clamp spread 10; przy starym 15 Δ = 5 pp (=0,05) → v_max≈0,129 → auto applied
update eta_segment_params set hours = 8.5, spread_pct = 15 where code = 'PL_ROAD';
update eta_segment_observations set hours_observed = 9.6
 where coalesce(features->>'p4k_calib','') = 'true' and corridor = 'PL_ROAD'
   and observed_at < now() - interval '10 days';
update eta_segment_observations set hours_observed = 9.5
 where coalesce(features->>'p4k_calib','') = 'true' and corridor = 'PL_ROAD'
   and observed_at >= now() - interval '10 days';
commit;"

val "B2: propose ma proposal (nie NO_CHANGE)" \
  "select (eta_propose_calibration()->>'proposal' is not null)::text" "true"

sys "begin; select eta_auto_apply_pending(); commit;"

val "B2: auto-18 rejected_at po SUPERSEDED" \
  "select (rejected_at is not null)::text from eta_calibration_versions where id=$VER18" "true"

val "B2: nowa wersja applied (bez BLOCKED)" \
  "select (count(*) >= 1)::text from eta_calibration_versions
    where applied is true and undone_at is null and id > $VER18
      and note like 'propozycja ciągła%'" "true"

sys "begin;
-- usuń wersje po VER18 (żeby undo AUTO_VER / BT nie widziały nowszej applied ani skip 7 d)
delete from decision_events where decision_id in (select id from decisions where type_code='ETA_CALIBRATION_APPROVAL');
delete from decisions where type_code='ETA_CALIBRATION_APPROVAL';
delete from audit_log
 where action in ('ETA_CALIBRATION_APPLY','ETA_CALIBRATION_UNDO')
   and entity_id in (select id::text from eta_calibration_versions where id >= $VER18);
delete from eta_calibration_versions where id >= $VER18;
update eta_segment_params set hours = 8.5, spread_pct = 15 where code = 'PL_ROAD';
-- przywróć godziny obserwacji calib (mediana ~10 jak na starcie cz.2; 8 fit + 4 test)
update eta_segment_observations set hours_observed = h
 from (values
   (1,9.5),(2,10.0),(3,10.0),(4,10.5),(5,11.0),(6,9.8),(7,10.0),(8,10.2),
   (9,9.8),(10,10.0),(11,10.2),(12,9.9)
 ) as t(ord, h)
 where load_id = ('a581a581-0000-4000-8000-0000000005' || lpad(t.ord::text, 2, '0'))::uuid
   and corridor = 'PL_ROAD';
commit;"

# B7 BACKTEST_WORSE: fit poprawia medianę, test pogarsza.
# Po auto 12% PL_ROAD zablokowany ≥7 dni (Ś3) — cofnij auto (undone_at STARSZE niż 7 dni,
# inaczej skip „po undo <3 nowych obs” wycina kod, bo pomiary BT mają observed_at w przeszłości).
sys "begin;
update eta_calibration_versions
   set undone_at = now() - interval '8 days'
 where applied is true
   and undone_at is null
   and (
     coalesce(note, '') like '%auto-applied%'
     or coalesce(note, '') like '%p4k-auto%'
   );
delete from eta_segment_observations
 where corridor = 'PL_ROAD'
   and coalesce(features->>'p4k', '') = 'true';
delete from eta_segment_observations where coalesce(features->>'p4k_bt','')='true';
delete from notifications where load_id::text like 'a581a581-0000-4000-8000-0000000006%';
delete from risk_signals where load_id::text like 'a581a581-0000-4000-8000-0000000006%';
delete from decision_events where decision_id in (
  select id from decisions where load_id::text like 'a581a581-0000-4000-8000-0000000006%'
);
delete from decisions where load_id::text like 'a581a581-0000-4000-8000-0000000006%';
delete from loads where id::text like 'a581a581-0000-4000-8000-0000000006%';
delete from eta_calibration_versions
 where applied is not true
   and created_by is null
   and coalesce(note, '') like 'propozycja ciągła%';
delete from decision_events where decision_id in (select id from decisions where type_code='ETA_CALIBRATION_APPROVAL');
delete from decisions where type_code = 'ETA_CALIBRATION_APPROVAL';
-- UUID: …0006 || lpad(nn) — nie …060||10 (niepoprawny UUID, transakcja się wycofuje → NO_CHANGE)
insert into loads (id, project_id, order_no, hhl_order_no, carrier_order_no, status,
                   plan_load_date, plan_delivery_date, actual_delivery_at)
select ('a581a581-0000-4000-8000-0000000006' || lpad(g::text, 2, '0'))::uuid,
       (select project_id from loads where id='a581a581-0000-4000-8000-000000000581'),
       'P4K-BT' || g, 'HHL-BT' || g, 'SCX-BT' || g,
       'DELIVERED', current_date - 30, current_date - 25, now() - interval '25 days'
  from generate_series(1, 10) g;
-- fit (7): ~12 h; hours=10 → Δ20 % (>10 %, ≤40 % limitu 30 d); test (3): ~7.5
-- (hours=7.5 dawało Δ60 % → continue limitu → NO_CHANGE zamiast BACKTEST_WORSE)
update eta_segment_params set hours = 10, spread_pct = 15 where code = 'PL_ROAD';
insert into eta_segment_observations (load_id, corridor, hours_observed, features, observed_at)
select ('a581a581-0000-4000-8000-0000000006' || lpad(ord::text, 2, '0'))::uuid, 'PL_ROAD', h,
       jsonb_build_object('p4k', true, 'p4k_calib', true, 'p4k_bt', true, 'gps_quality', true),
       now() - interval '40 days' + (ord || ' days')::interval
  from (values (1,11.5),(2,12.0),(3,12.0),(4,12.0),(5,12.5),(6,12.0),(7,11.8)) as t(ord,h);
insert into eta_segment_observations (load_id, corridor, hours_observed, features, observed_at)
select ('a581a581-0000-4000-8000-0000000006' || lpad((7+ord)::text, 2, '0'))::uuid, 'PL_ROAD', h,
       jsonb_build_object('p4k', true, 'p4k_calib', true, 'p4k_bt', true, 'gps_quality', true),
       now() - interval '3 days' + (ord || ' hours')::interval
  from (values (1,7.4),(2,7.5),(3,7.6)) as t(ord,h);
commit;"

val "B7: BACKTEST_WORSE gdy fit psuje test" \
  "select eta_propose_calibration()->>'reason'" "BACKTEST_WORSE"

# F7 r6: restore AUTO_VER w osobnej transakcji (BT ustawiał undone_at −8 d); sprzątanie BT później.
undo_restore=$(sys "begin;
update eta_calibration_versions
   set undone_at = null,
       applied = true,
       note = regexp_replace(coalesce(note, ''), ';?\s*(undone|superseded)', '', 'g')
 where id = $AUTO_VER;
update eta_segment_params
   set hours = 10, spread_pct = 15
 where code = 'PL_ROAD';
commit;" 2>&1) || true
if echo "$undo_restore" | grep -qiE 'ERROR|FATAL'; then
  fail=$((fail+1)); echo "  FAIL  undo prep restore ERROR ($undo_restore)"
else
  ok=$((ok+1)); echo "  OK    undo prep restore bez ERROR"
fi

undo_clean=$(sys "begin;
delete from decision_events where decision_id in (select id from decisions where type_code='ETA_CALIBRATION_APPROVAL');
delete from decisions where type_code='ETA_CALIBRATION_APPROVAL';
delete from eta_segment_observations where coalesce(features->>'p4k_bt','')='true';
delete from positions where load_id::text like 'a581a581-0000-4000-8000-0000000006%';
delete from load_events where load_id::text like 'a581a581-0000-4000-8000-0000000006%';
delete from notifications where load_id::text like 'a581a581-0000-4000-8000-0000000006%';
delete from risk_signals where load_id::text like 'a581a581-0000-4000-8000-0000000006%';
delete from decision_events where decision_id in (
  select id from decisions where load_id::text like 'a581a581-0000-4000-8000-0000000006%'
);
delete from decisions where load_id::text like 'a581a581-0000-4000-8000-0000000006%';
delete from loads where id::text like 'a581a581-0000-4000-8000-0000000006%';
delete from eta_calibration_versions
 where id > $AUTO_VER
   and coalesce(note, '') like 'propozycja ciągła%';
commit;" 2>&1) || true
if echo "$undo_clean" | grep -qiE 'ERROR|FATAL'; then
  fail=$((fail+1)); echo "  FAIL  undo prep cleanup ERROR ($undo_clean)"
else
  ok=$((ok+1)); echo "  OK    undo prep cleanup bez ERROR"
fi

val "undo prep: AUTO_VER applied+not undone" \
  "select (applied is true and undone_at is null)::text from eta_calibration_versions where id=$AUTO_VER" "true"

# undo po auto 12 % (przywróć params_before); zamrożenie nie blokuje (Ś8)
sys "begin;
update app_parameters set value = 1 where key = 'ETA_CALIBRATION_FROZEN';
commit;"

val "freeze: propose → FROZEN" \
  "select eta_propose_calibration()->>'reason'" "FROZEN"

# D8: KSH odmowa przed undo HHL
ksh_out=$(sys "begin; set local role authenticated; set local request.jwt.claim.sub='$KSH';
  select eta_calibration_undo($AUTO_VER); commit;" 2>&1 || true)
if echo "$ksh_out" | grep -qiE 'ETA_NOT_ADMIN|wyłącznie HHL_ADMIN|42501'; then
  ok=$((ok+1)); echo "  OK    D8: KSH nie cofa"
else
  fail=$((fail+1)); echo "  FAIL  D8: KSH nie cofa ($ksh_out)"
fi

val "Ś8: undo HHL przy zamrożeniu" \
  "begin; set local role authenticated; set local request.jwt.claim.sub='$HHL';
   select eta_calibration_undo($AUTO_VER)::text; commit;" "true"

val "B5: undone_at ustawione" \
  "select (undone_at is not null)::text from eta_calibration_versions where id=$AUTO_VER" "true"

sys "begin;
update app_parameters set value = 0 where key = 'ETA_CALIBRATION_FROZEN';
-- D7: przywróć oryginał PL_ROAD; audyt przed wersjami
delete from audit_log
 where action in ('ETA_CALIBRATION_APPLY','ETA_CALIBRATION_UNDO','ETA_ROUTE_DICT_UPSERT')
   and (
     entity_id in (select id::text from eta_calibration_versions where note like 'propozycja ciągła%')
     or entity_id like 'P4K-DICT%'
   );
delete from notifications where template = 'ETA_CALIBRATION_AUTO';
delete from decision_events where decision_id in (select id from decisions where type_code='ETA_CALIBRATION_APPROVAL');
delete from decisions where type_code = 'ETA_CALIBRATION_APPROVAL';
delete from eta_calibration_versions where note like 'propozycja ciągła%';
delete from eta_segment_observations where coalesce(features->>'p4k_calib','') = 'true';
delete from notifications
 where load_id::text like 'a581a581-0000-4000-8000-0000000005%'
   and load_id <> 'a581a581-0000-4000-8000-000000000581';
delete from risk_signals
 where load_id::text like 'a581a581-0000-4000-8000-0000000005%'
   and load_id <> 'a581a581-0000-4000-8000-000000000581';
delete from loads
 where id::text like 'a581a581-0000-4000-8000-0000000005%'
   and id <> 'a581a581-0000-4000-8000-000000000581';
delete from notifications where load_id::text like 'a581a581-0000-4000-8000-0000000006%';
delete from risk_signals where load_id::text like 'a581a581-0000-4000-8000-0000000006%';
delete from loads where id::text like 'a581a581-0000-4000-8000-0000000006%';
update eta_segment_params
   set hours = ${PL_H}::numeric, spread_pct = ${PL_SP}::numeric, source = \$s\$${PL_SRC}\$s\$
 where code = 'PL_ROAD';
commit;" >/dev/null

val "Ś1: RPC dict upsert HHL" \
  "begin; set local role authenticated; set local request.jwt.claim.sub='$HHL';
   select (eta_route_dict_upsert('P4K-DICT-TEST','GDN-NYN','POLFERRIES', null)->>'ok');
   commit;" "true"

ops_dict=$(sys "begin; set local role authenticated; set local request.jwt.claim.sub='11111111-0000-0000-0000-000000000004';
  select eta_route_dict_upsert('P4K-DICT-OPS','GDN-NYN','POLFERRIES', null); commit;" 2>&1 || true)
if echo "$ops_dict" | grep -qiE 'ETA_DICT_NOT_ADMIN|42501'; then
  ok=$((ok+1)); echo "  OK    Ś1: HHL_OPS odmowa dict"
else
  fail=$((fail+1)); echo "  FAIL  Ś1: HHL_OPS odmowa dict ($ops_dict)"
fi

# F7 r4: alias + audit sprzątaj PO RPC (nie przed)
sys "begin;
delete from eta_route_aliases where alias_key in ('P4K-DICT-TEST','P4K-DICT-OPS');
delete from audit_log where action='ETA_ROUTE_DICT_UPSERT' and entity_id like 'P4K-DICT%';
commit;" >/dev/null

val "tick istnieje" \
  "select count(*)::text from pg_proc where proname='eta_calibration_tick' and pronargs=0" "1"

val "authenticated bez EXECUTE tick" \
  "select has_function_privilege('authenticated','eta_calibration_tick()','execute')::text" "false"

val "authenticated ma EXECUTE undo" \
  "select has_function_privilege('authenticated','eta_calibration_undo(bigint)','execute')::text" "true"

val "tick: integration_runs bez raise" \
  "select (eta_calibration_tick()->>'ok' is not null)::text" "true"

val "tick: ok=true na czystych danych" \
  "select (eta_calibration_tick()->>'ok')" "true"

val "tick: wpis integration_runs" \
  "select (count(*) >= 1)::text from integration_runs where job like 'eta_calib%'" "true"

# F7 r5/r6 B1: filtr PL→SE = alias_key=route_key; powrotny wcześniej nie wygrywa z PL→SE
val "B1: NYN-GDN/KAA-GDY poza filtrem PL→SE" \
  "select (count(*) = 0)::text from eta_route_aliases
    where alias_key in ('NYN-GDN','KAA-GDY') and alias_key = route_key" "true"

val "B1: GDN-NYN i GDY-KAA w filtrze PL→SE" \
  "select (count(*) = 2)::text from eta_route_aliases
    where alias_key in ('GDN-NYN','GDY-KAA') and alias_key = route_key" "true"

val "B1: powrotny wcześniej + PL→SE później → wybrany PL→SE" \
  "begin;
   insert into vessels (id, name, operator) values
     ('a581a581-0000-4000-8000-0000000000b1', 'P4K B1', 'POLFERRIES')
   on conflict (id) do nothing;
   insert into sailings (id, project_id, vessel_id, route, departure_at, arrival_at, status, source)
   values
     ('a581a581-0000-4000-8000-0000000000b2',
      (select project_id from loads where id='a581a581-0000-4000-8000-000000000581'),
      'a581a581-0000-4000-8000-0000000000b1',
      'NYN-GDN', now() + interval '1 day', now() + interval '2 days', 'ZAPLANOWANY', 'RECZNIE'),
     ('a581a581-0000-4000-8000-0000000000b3',
      (select project_id from loads where id='a581a581-0000-4000-8000-000000000581'),
      'a581a581-0000-4000-8000-0000000000b1',
      'GDN-NYN', now() + interval '3 days', now() + interval '4 days', 'ZAPLANOWANY', 'RECZNIE')
   on conflict (id) do nothing;
   update loads set sailing_id = null, status = 'IN_TRANSIT_PL',
                    telematics_vehicle_id = coalesce(telematics_vehicle_id, 'P4K-B1')
    where id = 'a581a581-0000-4000-8000-000000000581';
   insert into positions (load_id, ts, geom_raw, source, raw) values
     ('a581a581-0000-4000-8000-000000000581', now() - interval '3 minutes',
      st_setsrid(st_makepoint(17.0, 54.5), 4326), 'TELEMATICS_API', '{}'::jsonb);
   select (
     (basis->>'sailing') like '%założony%'
     and (basis->'flags')::text like '%założony najbliższy%'
     and exists (
       select 1 from jsonb_array_elements(basis->'segments') s
        where s->>'code' = 'CROSSING'
          and abs(extract(epoch from (s->>'departure')::timestamptz
              - (select departure_at from sailings where id='a581a581-0000-4000-8000-0000000000b3'))) < 2
     )
   )::text
     from compute_load_eta('a581a581-0000-4000-8000-000000000581', now()) limit 1;
   rollback;" "true"

# #603 F7 r3: load a603-… (nie …0006xx — kolizja BT). Trasa w payload + sailing null.
# Pomiar i asercja w OSOBNYCH statementach — w jednym SELECT snapshot PG nie widzi
# wierszy wstawionych przez eta_record_segment_observations (n=3, corridors=none).
# B4: 1 PIN, późny EXIT po PIN → BRAK (bez planu/GPS)
val "#603: późny EXIT po PIN → PORT_CHECKIN BRAK" \
  "begin;
   insert into loads (id, project_id, order_no, hhl_order_no, carrier_order_no, status,
                      plan_load_date, plan_delivery_date, actual_delivery_at, sailing_id)
   select 'a603a603-0000-4000-8000-000000000001', project_id, 'P4K-603A', 'HHL-603A', 'SCX-603A',
          'DELIVERED', current_date - 3, current_date - 1, timestamptz '2026-10-20 18:00+02', null
     from loads where id='a581a581-0000-4000-8000-000000000581';
   with f as (select kind::text k, id, route from geofences where name like 'P4K %'),
   t(ev, k, ts) as (values
     ('GEOFENCE_EXIT','LOADING',   timestamptz '2026-10-18 06:00+02'),
     ('GEOFENCE_ENTER','PORT_OUT', timestamptz '2026-10-18 14:00+02'),
     ('GEOFENCE_ENTER','PORT_IN',  timestamptz '2026-10-19 11:00+02'),
     ('GEOFENCE_EXIT','PORT_OUT',  timestamptz '2026-10-19 11:08+02'),
     ('GEOFENCE_EXIT','PORT_IN',   timestamptz '2026-10-19 12:00+02'),
     ('GEOFENCE_ENTER','SITE',     timestamptz '2026-10-20 06:00+02')
   )
   insert into load_events (load_id, event_type, occurred_at, payload)
   select 'a603a603-0000-4000-8000-000000000001', t.ev, t.ts,
          jsonb_build_object(
            'geofence_id', f.id, 'geofence_kind', f.k,
            'route', coalesce(f.route, 'POLFERRIES')
          )
     from t join f on f.k = t.k;
   select eta_record_segment_observations('a603a603-0000-4000-8000-000000000001');
   select (
     exists (
       select 1 from eta_segment_observations
        where load_id='a603a603-0000-4000-8000-000000000001'
          and corridor='PORT_CHECKIN' and (features->>'p4k')='true'
          and exclude_reason = 'BRAK_ZDARZENIA'
     )
   )::text;
   rollback;" "true"

# B2: późny EXIT + sailing.actual_departure_at → PORT_CHECKIN OK 3 h + port_out_src
val "#603: późny EXIT + sailing → PORT_CHECKIN OK" \
  "begin;
   insert into loads (id, project_id, order_no, hhl_order_no, carrier_order_no, status,
                      plan_load_date, plan_delivery_date, actual_delivery_at)
   select 'a603a603-0000-4000-8000-000000000002', project_id, 'P4K-603B', 'HHL-603B', 'SCX-603B',
          'DELIVERED', current_date - 3, current_date - 1, timestamptz '2026-10-20 18:00+02'
     from loads where id='a581a581-0000-4000-8000-000000000581';
   insert into vessels (id, name, operator) values
     ('a581a581-0000-4000-8000-0000000000c1', 'P4K-Ferry-C', 'POLFERRIES')
   on conflict (id) do nothing;
   insert into sailings (id, project_id, vessel_id, route, departure_at, arrival_at,
                         actual_departure_at, delayed_departure_at, status, source)
   values (
     'a581a581-0000-4000-8000-0000000000c2',
     (select project_id from loads where id='a603a603-0000-4000-8000-000000000002'),
     'a581a581-0000-4000-8000-0000000000c1',
     'GDN-NYN',
     timestamptz '2026-10-18 16:00+02',
     timestamptz '2026-10-19 11:00+02',
     timestamptz '2026-10-18 17:00+02',
     timestamptz '2026-10-18 18:00+02',
     'ZAPLANOWANY', 'RECZNIE'
   ) on conflict (id) do update
     set actual_departure_at = excluded.actual_departure_at,
         delayed_departure_at = excluded.delayed_departure_at,
         departure_at = excluded.departure_at;
   update loads set sailing_id = 'a581a581-0000-4000-8000-0000000000c2'
    where id = 'a603a603-0000-4000-8000-000000000002';
   with f as (select kind::text k, id, route from geofences where name like 'P4K %'),
   t(ev, k, ts) as (values
     ('GEOFENCE_EXIT','LOADING',   timestamptz '2026-10-18 06:00+02'),
     ('GEOFENCE_ENTER','PORT_OUT', timestamptz '2026-10-18 14:00+02'),
     ('GEOFENCE_ENTER','PORT_IN',  timestamptz '2026-10-19 11:00+02'),
     ('GEOFENCE_EXIT','PORT_OUT',  timestamptz '2026-10-19 11:08+02')
   )
   insert into load_events (load_id, event_type, occurred_at, payload)
   select 'a603a603-0000-4000-8000-000000000002', t.ev, t.ts,
          jsonb_build_object('geofence_id', f.id, 'geofence_kind', f.k,
                             'route', coalesce(f.route, 'POLFERRIES'))
     from t join f on f.k = t.k;
   select eta_record_segment_observations('a603a603-0000-4000-8000-000000000002');
   select (
     exists (
       select 1 from eta_segment_observations
        where load_id='a603a603-0000-4000-8000-000000000002'
          and corridor='PORT_CHECKIN' and (features->>'p4k')='true'
          and exclude_reason is null
          and round(hours_observed) = 3
          and features->>'port_out_src' = 'SAILING_ACTUAL'
     )
   )::text;
   rollback;" "true"

# N4: plan bez actual/delayed → BRAK
val "#603: plan bez actual → PORT_CHECKIN BRAK" \
  "begin;
   insert into loads (id, project_id, order_no, hhl_order_no, carrier_order_no, status,
                      plan_load_date, plan_delivery_date, actual_delivery_at)
   select 'a603a603-0000-4000-8000-000000000003', project_id, 'P4K-603P', 'HHL-603P', 'SCX-603P',
          'DELIVERED', current_date - 3, current_date - 1, timestamptz '2026-10-20 18:00+02'
     from loads where id='a581a581-0000-4000-8000-000000000581';
   insert into vessels (id, name, operator) values
     ('a581a581-0000-4000-8000-0000000000c1', 'P4K-Ferry-C', 'POLFERRIES')
   on conflict (id) do nothing;
   insert into sailings (id, project_id, vessel_id, route, departure_at, arrival_at,
                         actual_departure_at, delayed_departure_at, status, source)
   values (
     'a581a581-0000-4000-8000-0000000000c3',
     (select project_id from loads where id='a603a603-0000-4000-8000-000000000003'),
     'a581a581-0000-4000-8000-0000000000c1',
     'GDN-NYN',
     timestamptz '2026-10-18 17:00+02',
     timestamptz '2026-10-19 11:00+02',
     null, null, 'ZAPLANOWANY', 'RECZNIE'
   ) on conflict (id) do update
     set actual_departure_at = null, delayed_departure_at = null,
         departure_at = excluded.departure_at;
   update loads set sailing_id = 'a581a581-0000-4000-8000-0000000000c3'
    where id = 'a603a603-0000-4000-8000-000000000003';
   with f as (select kind::text k, id, route from geofences where name like 'P4K %'),
   t(ev, k, ts) as (values
     ('GEOFENCE_EXIT','LOADING',   timestamptz '2026-10-18 06:00+02'),
     ('GEOFENCE_ENTER','PORT_OUT', timestamptz '2026-10-18 14:00+02'),
     ('GEOFENCE_ENTER','PORT_IN',  timestamptz '2026-10-19 11:00+02'),
     ('GEOFENCE_EXIT','PORT_OUT',  timestamptz '2026-10-19 11:08+02')
   )
   insert into load_events (load_id, event_type, occurred_at, payload)
   select 'a603a603-0000-4000-8000-000000000003', t.ev, t.ts,
          jsonb_build_object('geofence_id', f.id, 'geofence_kind', f.k,
                             'route', coalesce(f.route, 'POLFERRIES'))
     from t join f on f.k = t.k;
   select eta_record_segment_observations('a603a603-0000-4000-8000-000000000003');
   select (
     exists (
       select 1 from eta_segment_observations
        where load_id='a603a603-0000-4000-8000-000000000003'
          and corridor='PORT_CHECKIN' and (features->>'p4k')='true'
          and exclude_reason = 'BRAK_ZDARZENIA'
     )
   )::text;
   rollback;" "true"

# N4: delayed bez actual → OK + SAILING_DELAYED
val "#603: delayed → PORT_CHECKIN OK + SAILING_DELAYED" \
  "begin;
   insert into loads (id, project_id, order_no, hhl_order_no, carrier_order_no, status,
                      plan_load_date, plan_delivery_date, actual_delivery_at)
   select 'a603a603-0000-4000-8000-000000000004', project_id, 'P4K-603Dly', 'HHL-603Dly', 'SCX-603Dly',
          'DELIVERED', current_date - 3, current_date - 1, timestamptz '2026-10-20 18:00+02'
     from loads where id='a581a581-0000-4000-8000-000000000581';
   insert into vessels (id, name, operator) values
     ('a581a581-0000-4000-8000-0000000000c1', 'P4K-Ferry-C', 'POLFERRIES')
   on conflict (id) do nothing;
   insert into sailings (id, project_id, vessel_id, route, departure_at, arrival_at,
                         actual_departure_at, delayed_departure_at, status, source)
   values (
     'a581a581-0000-4000-8000-0000000000c4',
     (select project_id from loads where id='a603a603-0000-4000-8000-000000000004'),
     'a581a581-0000-4000-8000-0000000000c1',
     'GDN-NYN',
     timestamptz '2026-10-18 17:00+02',
     timestamptz '2026-10-19 11:00+02',
     null,
     timestamptz '2026-10-18 21:00+02',
     'OPOZNIONY', 'RECZNIE'
   ) on conflict (id) do update
     set actual_departure_at = null,
         delayed_departure_at = excluded.delayed_departure_at,
         departure_at = excluded.departure_at,
         status = excluded.status;
   update loads set sailing_id = 'a581a581-0000-4000-8000-0000000000c4'
    where id = 'a603a603-0000-4000-8000-000000000004';
   with f as (select kind::text k, id, route from geofences where name like 'P4K %'),
   t(ev, k, ts) as (values
     ('GEOFENCE_EXIT','LOADING',   timestamptz '2026-10-18 06:00+02'),
     ('GEOFENCE_ENTER','PORT_OUT', timestamptz '2026-10-18 14:00+02'),
     ('GEOFENCE_ENTER','PORT_IN',  timestamptz '2026-10-19 11:00+02'),
     ('GEOFENCE_EXIT','PORT_OUT',  timestamptz '2026-10-19 11:08+02')
   )
   insert into load_events (load_id, event_type, occurred_at, payload)
   select 'a603a603-0000-4000-8000-000000000004', t.ev, t.ts,
          jsonb_build_object('geofence_id', f.id, 'geofence_kind', f.k,
                             'route', coalesce(f.route, 'POLFERRIES'))
     from t join f on f.k = t.k;
   select eta_record_segment_observations('a603a603-0000-4000-8000-000000000004');
   select (
     exists (
       select 1 from eta_segment_observations
        where load_id='a603a603-0000-4000-8000-000000000004'
          and corridor='PORT_CHECKIN' and (features->>'p4k')='true'
          and exclude_reason is null
          and round(hours_observed) = 7
          and features->>'port_out_src' = 'SAILING_DELAYED'
     )
   )::text;
   rollback;" "true"

# N4: sailing.departure sprzed ENTER → BRAK (actual poza oknem)
val "#603: rejs sprzed ENTER → PORT_CHECKIN BRAK" \
  "begin;
   insert into loads (id, project_id, order_no, hhl_order_no, carrier_order_no, status,
                      plan_load_date, plan_delivery_date, actual_delivery_at)
   select 'a603a603-0000-4000-8000-000000000005', project_id, 'P4K-603E', 'HHL-603E', 'SCX-603E',
          'DELIVERED', current_date - 3, current_date - 1, timestamptz '2026-10-20 18:00+02'
     from loads where id='a581a581-0000-4000-8000-000000000581';
   insert into vessels (id, name, operator) values
     ('a581a581-0000-4000-8000-0000000000c1', 'P4K-Ferry-C', 'POLFERRIES')
   on conflict (id) do nothing;
   insert into sailings (id, project_id, vessel_id, route, departure_at, arrival_at,
                         actual_departure_at, status, source)
   values (
     'a581a581-0000-4000-8000-0000000000c5',
     (select project_id from loads where id='a603a603-0000-4000-8000-000000000005'),
     'a581a581-0000-4000-8000-0000000000c1',
     'GDN-NYN',
     timestamptz '2026-10-18 10:00+02',
     timestamptz '2026-10-19 11:00+02',
     timestamptz '2026-10-18 10:00+02',
     'ZAPLANOWANY', 'RECZNIE'
   ) on conflict (id) do update set actual_departure_at = excluded.actual_departure_at;
   update loads set sailing_id = 'a581a581-0000-4000-8000-0000000000c5'
    where id = 'a603a603-0000-4000-8000-000000000005';
   with f as (select kind::text k, id, route from geofences where name like 'P4K %'),
   t(ev, k, ts) as (values
     ('GEOFENCE_EXIT','LOADING',   timestamptz '2026-10-18 06:00+02'),
     ('GEOFENCE_ENTER','PORT_OUT', timestamptz '2026-10-18 14:00+02'),
     ('GEOFENCE_ENTER','PORT_IN',  timestamptz '2026-10-19 11:00+02'),
     ('GEOFENCE_EXIT','PORT_OUT',  timestamptz '2026-10-19 11:08+02')
   )
   insert into load_events (load_id, event_type, occurred_at, payload)
   select 'a603a603-0000-4000-8000-000000000005', t.ev, t.ts,
          jsonb_build_object('geofence_id', f.id, 'geofence_kind', f.k,
                             'route', coalesce(f.route, 'POLFERRIES'))
     from t join f on f.k = t.k;
   select eta_record_segment_observations('a603a603-0000-4000-8000-000000000005');
   select (
     exists (
       select 1 from eta_segment_observations
        where load_id='a603a603-0000-4000-8000-000000000005'
          and corridor='PORT_CHECKIN' and (features->>'p4k')='true'
          and exclude_reason = 'BRAK_ZDARZENIA'
     )
   )::text;
   rollback;" "true"

# B3: EXIT powrotu po PIN nie zawyża, gdy jest EXIT ≤ PIN + port_out_src=EVENT
val "#603: EXIT powrotu po PIN → PORT_CHECKIN bez zawyżenia" \
  "begin;
   insert into loads (id, project_id, order_no, hhl_order_no, carrier_order_no, status,
                      plan_load_date, plan_delivery_date, actual_delivery_at, sailing_id)
   select 'a603a603-0000-4000-8000-000000000006', project_id, 'P4K-603C', 'HHL-603C', 'SCX-603C',
          'DELIVERED', current_date - 3, current_date - 1, timestamptz '2026-10-20 18:00+02', null
     from loads where id='a581a581-0000-4000-8000-000000000581';
   with f as (select kind::text k, id, route from geofences where name like 'P4K %'),
   t(ev, k, ts) as (values
     ('GEOFENCE_EXIT','LOADING',   timestamptz '2026-10-18 06:00+02'),
     ('GEOFENCE_ENTER','PORT_OUT', timestamptz '2026-10-18 14:00+02'),
     ('GEOFENCE_EXIT','PORT_OUT',  timestamptz '2026-10-18 17:00+02'),
     ('GEOFENCE_ENTER','PORT_IN',  timestamptz '2026-10-19 11:00+02'),
     ('GEOFENCE_EXIT','PORT_OUT',  timestamptz '2026-10-22 09:00+02'),
     ('GEOFENCE_EXIT','PORT_IN',   timestamptz '2026-10-19 12:00+02'),
     ('GEOFENCE_ENTER','SITE',     timestamptz '2026-10-20 06:00+02')
   )
   insert into load_events (load_id, event_type, occurred_at, payload)
   select 'a603a603-0000-4000-8000-000000000006', t.ev, t.ts,
          jsonb_build_object('geofence_id', f.id, 'geofence_kind', f.k,
                             'route', coalesce(f.route, 'POLFERRIES'))
     from t join f on f.k = t.k;
   select eta_record_segment_observations('a603a603-0000-4000-8000-000000000006');
   select (
     exists (
       select 1 from eta_segment_observations
        where load_id='a603a603-0000-4000-8000-000000000006'
          and corridor='PORT_CHECKIN' and (features->>'p4k')='true'
          and exclude_reason is null
          and round(hours_observed) = 3
          and features->>'port_out_src' = 'EVENT'
     )
   )::text;
   rollback;" "true"

# #626: EXIT = PIN bez rejsu → PORT_CHECKIN BRAK (EXIT poza ostrym oknem); bez cichego OK
val "#603: EXIT=PIN bez rejsu → PORT_CHECKIN BRAK" \
  "begin;
   insert into loads (id, project_id, order_no, hhl_order_no, carrier_order_no, status,
                      plan_load_date, plan_delivery_date, actual_delivery_at, sailing_id)
   select 'a603a603-0000-4000-8000-000000000007', project_id, 'P4K-603D', 'HHL-603D', 'SCX-603D',
          'DELIVERED', current_date - 3, current_date - 1, timestamptz '2026-10-20 18:00+02', null
     from loads where id='a581a581-0000-4000-8000-000000000581';
   with f as (select kind::text k, id, route from geofences where name like 'P4K %'),
   t(ev, k, ts) as (values
     ('GEOFENCE_EXIT','LOADING',   timestamptz '2026-10-18 06:00+02'),
     ('GEOFENCE_ENTER','PORT_OUT', timestamptz '2026-10-18 14:00+02'),
     ('GEOFENCE_EXIT','PORT_OUT',  timestamptz '2026-10-18 17:00+02'),
     ('GEOFENCE_ENTER','PORT_IN',  timestamptz '2026-10-18 17:00+02')
   )
   insert into load_events (load_id, event_type, occurred_at, payload)
   select 'a603a603-0000-4000-8000-000000000007', t.ev, t.ts,
          jsonb_build_object('geofence_id', f.id, 'geofence_kind', f.k,
                             'route', coalesce(f.route, 'POLFERRIES'))
     from t join f on f.k = t.k;
   select eta_record_segment_observations('a603a603-0000-4000-8000-000000000007');
   select (
     exists (
       select 1 from eta_segment_observations
        where load_id='a603a603-0000-4000-8000-000000000007'
          and corridor='PORT_CHECKIN' and (features->>'p4k')='true'
          and exclude_reason = 'BRAK_ZDARZENIA'
     )
     and not exists (
       select 1 from eta_segment_observations
        where load_id='a603a603-0000-4000-8000-000000000007'
          and corridor like 'CROSSING%' and (features->>'p4k')='true'
          and exclude_reason is null
     )
   )::text;
   rollback;" "true"

# F7 r3 drobne: actual poza oknem + delayed w oknie → BRAK (bez delayed)
val "#603: actual poza oknem → BRAK (bez delayed)" \
  "begin;
   insert into loads (id, project_id, order_no, hhl_order_no, carrier_order_no, status,
                      plan_load_date, plan_delivery_date, actual_delivery_at)
   select 'a603a603-0000-4000-8000-000000000008', project_id, 'P4K-603F', 'HHL-603F', 'SCX-603F',
          'DELIVERED', current_date - 3, current_date - 1, timestamptz '2026-10-20 18:00+02'
     from loads where id='a581a581-0000-4000-8000-000000000581';
   insert into vessels (id, name, operator) values
     ('a581a581-0000-4000-8000-0000000000c1', 'P4K-Ferry-C', 'POLFERRIES')
   on conflict (id) do nothing;
   insert into sailings (id, project_id, vessel_id, route, departure_at, arrival_at,
                         actual_departure_at, delayed_departure_at, status, source)
   values (
     'a581a581-0000-4000-8000-0000000000c8',
     (select project_id from loads where id='a603a603-0000-4000-8000-000000000008'),
     'a581a581-0000-4000-8000-0000000000c1',
     'GDN-NYN',
     timestamptz '2026-10-18 17:00+02',
     timestamptz '2026-10-19 11:00+02',
     timestamptz '2026-10-18 10:00+02',
     timestamptz '2026-10-18 17:00+02',
     'OPOZNIONY', 'RECZNIE'
   ) on conflict (id) do update
     set actual_departure_at = excluded.actual_departure_at,
         delayed_departure_at = excluded.delayed_departure_at;
   update loads set sailing_id = 'a581a581-0000-4000-8000-0000000000c8'
    where id = 'a603a603-0000-4000-8000-000000000008';
   with f as (select kind::text k, id, route from geofences where name like 'P4K %'),
   t(ev, k, ts) as (values
     ('GEOFENCE_EXIT','LOADING',   timestamptz '2026-10-18 06:00+02'),
     ('GEOFENCE_ENTER','PORT_OUT', timestamptz '2026-10-18 14:00+02'),
     ('GEOFENCE_ENTER','PORT_IN',  timestamptz '2026-10-19 11:00+02'),
     ('GEOFENCE_EXIT','PORT_OUT',  timestamptz '2026-10-19 11:08+02')
   )
   insert into load_events (load_id, event_type, occurred_at, payload)
   select 'a603a603-0000-4000-8000-000000000008', t.ev, t.ts,
          jsonb_build_object('geofence_id', f.id, 'geofence_kind', f.k,
                             'route', coalesce(f.route, 'POLFERRIES'))
     from t join f on f.k = t.k;
   select eta_record_segment_observations('a603a603-0000-4000-8000-000000000008');
   select (
     exists (
       select 1 from eta_segment_observations
        where load_id='a603a603-0000-4000-8000-000000000008'
          and corridor='PORT_CHECKIN' and (features->>'p4k')='true'
          and exclude_reason = 'BRAK_ZDARZENIA'
     )
   )::text;
   rollback;" "true"

# D1: EXIT = ENTER → wiersz BRAK (nie cichy brak)
val "#603: D1 EXIT=ENTER → PORT_CHECKIN BRAK" \
  "begin;
   insert into loads (id, project_id, order_no, hhl_order_no, carrier_order_no, status,
                      plan_load_date, plan_delivery_date, actual_delivery_at, sailing_id)
   select 'a603a603-0000-4000-8000-000000000009', project_id, 'P4K-603G', 'HHL-603G', 'SCX-603G',
          'DELIVERED', current_date - 3, current_date - 1, timestamptz '2026-10-20 18:00+02', null
     from loads where id='a581a581-0000-4000-8000-000000000581';
   with f as (select kind::text k, id, route from geofences where name like 'P4K %'),
   t(ev, k, ts) as (values
     ('GEOFENCE_EXIT','LOADING',   timestamptz '2026-10-18 06:00+02'),
     ('GEOFENCE_ENTER','PORT_OUT', timestamptz '2026-10-18 14:00+02'),
     ('GEOFENCE_EXIT','PORT_OUT',  timestamptz '2026-10-18 14:00+02'),
     ('GEOFENCE_ENTER','PORT_IN',  timestamptz '2026-10-19 11:00+02')
   )
   insert into load_events (load_id, event_type, occurred_at, payload)
   select 'a603a603-0000-4000-8000-000000000009', t.ev, t.ts,
          jsonb_build_object('geofence_id', f.id, 'geofence_kind', f.k,
                             'route', coalesce(f.route, 'POLFERRIES'))
     from t join f on f.k = t.k;
   select eta_record_segment_observations('a603a603-0000-4000-8000-000000000009');
   select (
     exists (
       select 1 from eta_segment_observations
        where load_id='a603a603-0000-4000-8000-000000000009'
          and corridor='PORT_CHECKIN' and (features->>'p4k')='true'
          and exclude_reason = 'BRAK_ZDARZENIA'
     )
     and exists (
       select 1 from eta_segment_observations
        where load_id='a603a603-0000-4000-8000-000000000009'
          and corridor like 'CROSSING%' and (features->>'p4k')='true'
          and exclude_reason = 'BRAK_ZDARZENIA'
     )
   )::text;
   rollback;" "true"

# D3: bez PIN — EXIT po SITE/dostawie nie wchodzi
val "#603: D3 bez PIN EXIT po SITE → BRAK" \
  "begin;
   insert into loads (id, project_id, order_no, hhl_order_no, carrier_order_no, status,
                      plan_load_date, plan_delivery_date, actual_delivery_at, sailing_id)
   select 'a603a603-0000-4000-8000-00000000000a', project_id, 'P4K-603H', 'HHL-603H', 'SCX-603H',
          'DELIVERED', current_date - 3, current_date - 1, timestamptz '2026-10-20 18:00+02', null
     from loads where id='a581a581-0000-4000-8000-000000000581';
   with f as (select kind::text k, id, route from geofences where name like 'P4K %'),
   t(ev, k, ts) as (values
     ('GEOFENCE_EXIT','LOADING',   timestamptz '2026-10-18 06:00+02'),
     ('GEOFENCE_ENTER','PORT_OUT', timestamptz '2026-10-18 14:00+02'),
     ('GEOFENCE_ENTER','SITE',     timestamptz '2026-10-20 06:00+02'),
     ('GEOFENCE_EXIT','PORT_OUT',  timestamptz '2026-10-20 12:00+02')
   )
   insert into load_events (load_id, event_type, occurred_at, payload)
   select 'a603a603-0000-4000-8000-00000000000a', t.ev, t.ts,
          jsonb_build_object('geofence_id', f.id, 'geofence_kind', f.k,
                             'route', coalesce(f.route, 'POLFERRIES'))
     from t join f on f.k = t.k;
   select eta_record_segment_observations('a603a603-0000-4000-8000-00000000000a');
   select (
     exists (
       select 1 from eta_segment_observations
        where load_id='a603a603-0000-4000-8000-00000000000a'
          and corridor='PORT_CHECKIN' and (features->>'p4k')='true'
          and exclude_reason = 'BRAK_ZDARZENIA'
     )
   )::text;
   rollback;" "true"

# port_out_src na CROSSING (sailing actual)
val "#603: CROSSING port_out_src=SAILING_ACTUAL" \
  "begin;
   insert into loads (id, project_id, order_no, hhl_order_no, carrier_order_no, status,
                      plan_load_date, plan_delivery_date, actual_delivery_at)
   select 'a603a603-0000-4000-8000-00000000000b', project_id, 'P4K-603I', 'HHL-603I', 'SCX-603I',
          'DELIVERED', current_date - 3, current_date - 1, timestamptz '2026-10-20 18:00+02'
     from loads where id='a581a581-0000-4000-8000-000000000581';
   insert into vessels (id, name, operator) values
     ('a581a581-0000-4000-8000-0000000000c1', 'P4K-Ferry-C', 'POLFERRIES')
   on conflict (id) do nothing;
   insert into sailings (id, project_id, vessel_id, route, departure_at, arrival_at,
                         actual_departure_at, status, source)
   values (
     'a581a581-0000-4000-8000-0000000000cb',
     (select project_id from loads where id='a603a603-0000-4000-8000-00000000000b'),
     'a581a581-0000-4000-8000-0000000000c1',
     'GDN-NYN',
     timestamptz '2026-10-18 16:00+02',
     timestamptz '2026-10-19 11:00+02',
     timestamptz '2026-10-18 17:00+02',
     'ZAPLANOWANY', 'RECZNIE'
   ) on conflict (id) do update set actual_departure_at = excluded.actual_departure_at;
   update loads set sailing_id = 'a581a581-0000-4000-8000-0000000000cb'
    where id = 'a603a603-0000-4000-8000-00000000000b';
   with f as (select kind::text k, id, route from geofences where name like 'P4K %'),
   t(ev, k, ts) as (values
     ('GEOFENCE_EXIT','LOADING',   timestamptz '2026-10-18 06:00+02'),
     ('GEOFENCE_ENTER','PORT_OUT', timestamptz '2026-10-18 14:00+02'),
     ('GEOFENCE_ENTER','PORT_IN',  timestamptz '2026-10-19 11:00+02'),
     ('GEOFENCE_EXIT','PORT_OUT',  timestamptz '2026-10-19 11:08+02')
   )
   insert into load_events (load_id, event_type, occurred_at, payload)
   select 'a603a603-0000-4000-8000-00000000000b', t.ev, t.ts,
          jsonb_build_object('geofence_id', f.id, 'geofence_kind', f.k,
                             'route', coalesce(f.route, 'POLFERRIES'))
     from t join f on f.k = t.k;
   select eta_record_segment_observations('a603a603-0000-4000-8000-00000000000b');
   select (
     exists (
       select 1 from eta_segment_observations
        where load_id='a603a603-0000-4000-8000-00000000000b'
          and corridor like 'CROSSING%' and (features->>'p4k')='true'
          and exclude_reason is null
          and features->>'port_out_src' = 'SAILING_ACTUAL'
     )
   )::text;
   rollback;" "true"

val "#603: SE_ROAD_KAA_INLAND w słowniku (27B:C)" \
  "select (count(*) = 1)::text from eta_segment_params where code = 'SE_ROAD_KAA_INLAND'" "true"

# #626: EXIT = PIN → actual; EXIT po odejściu → actual; PIN późny → CROSSING z arrival+1h
val "#626: EXIT=PIN → PORT_CHECKIN z SAILING_ACTUAL" \
  "begin;
   insert into loads (id, project_id, order_no, hhl_order_no, carrier_order_no, status,
                      plan_load_date, plan_delivery_date, actual_delivery_at)
   select 'a626a626-0000-4000-8000-000000000001', project_id, 'P4K-626A', 'HHL-626A', 'SCX-626A',
          'DELIVERED', current_date - 3, current_date - 1, timestamptz '2026-10-20 18:00+02'
     from loads where id='a581a581-0000-4000-8000-000000000581';
   insert into vessels (id, name, operator) values
     ('a626a626-0000-4000-8000-0000000000a1', 'P4K-Ferry-626A', 'POLFERRIES')
   on conflict (id) do nothing;
   insert into sailings (id, project_id, vessel_id, route, departure_at, arrival_at,
                         actual_departure_at, status, source)
   values (
     'a626a626-0000-4000-8000-0000000000b1',
     (select project_id from loads where id='a626a626-0000-4000-8000-000000000001'),
     'a626a626-0000-4000-8000-0000000000a1',
     'GDN-NYN',
     timestamptz '2026-10-18 16:00+02',
     timestamptz '2026-10-19 11:00+02',
     timestamptz '2026-10-18 17:00+02',
     'ZAPLANOWANY', 'RECZNIE'
   ) on conflict (id) do update set actual_departure_at = excluded.actual_departure_at;
   update loads set sailing_id = 'a626a626-0000-4000-8000-0000000000b1'
    where id = 'a626a626-0000-4000-8000-000000000001';
   with f as (select kind::text k, id, route from geofences where name like 'P4K %'),
   t(ev, k, ts) as (values
     ('GEOFENCE_EXIT','LOADING',   timestamptz '2026-10-18 06:00+02'),
     ('GEOFENCE_ENTER','PORT_OUT', timestamptz '2026-10-18 14:00+02'),
     ('GEOFENCE_EXIT','PORT_OUT',  timestamptz '2026-10-19 11:00+02'),
     ('GEOFENCE_ENTER','PORT_IN',  timestamptz '2026-10-19 11:00+02')
   )
   insert into load_events (load_id, event_type, occurred_at, payload)
   select 'a626a626-0000-4000-8000-000000000001', t.ev, t.ts,
          jsonb_build_object('geofence_id', f.id, 'geofence_kind', f.k,
                             'route', coalesce(f.route, 'POLFERRIES'))
     from t join f on f.k = t.k;
   select eta_record_segment_observations('a626a626-0000-4000-8000-000000000001');
   select (
     exists (
       select 1 from eta_segment_observations
        where load_id='a626a626-0000-4000-8000-000000000001'
          and corridor='PORT_CHECKIN' and (features->>'p4k')='true'
          and exclude_reason is null
          and features->>'port_out_src' = 'SAILING_ACTUAL'
          and round(hours_observed) = 3
     )
   )::text;
   rollback;" "true"

# F7 r2: EXIT >1 h po eff_dep → EVENT zostaje + sailing_mismatch (nie ścieżka actual)
val "#626: EXIT po odejściu promu → EVENT + mismatch" \
  "begin;
   insert into loads (id, project_id, order_no, hhl_order_no, carrier_order_no, status,
                      plan_load_date, plan_delivery_date, actual_delivery_at)
   select 'a626a626-0000-4000-8000-000000000002', project_id, 'P4K-626B', 'HHL-626B', 'SCX-626B',
          'DELIVERED', current_date - 3, current_date - 1, timestamptz '2026-10-20 18:00+02'
     from loads where id='a581a581-0000-4000-8000-000000000581';
   insert into vessels (id, name, operator) values
     ('a626a626-0000-4000-8000-0000000000a2', 'P4K-Ferry-626B', 'POLFERRIES')
   on conflict (id) do nothing;
   insert into sailings (id, project_id, vessel_id, route, departure_at, arrival_at,
                         actual_departure_at, status, source)
   values (
     'a626a626-0000-4000-8000-0000000000b2',
     (select project_id from loads where id='a626a626-0000-4000-8000-000000000002'),
     'a626a626-0000-4000-8000-0000000000a2',
     'GDN-NYN',
     timestamptz '2026-10-18 16:00+02',
     timestamptz '2026-10-19 11:00+02',
     timestamptz '2026-10-18 17:00+02',
     'ZAPLANOWANY', 'RECZNIE'
   ) on conflict (id) do update set actual_departure_at = excluded.actual_departure_at;
   update loads set sailing_id = 'a626a626-0000-4000-8000-0000000000b2'
    where id = 'a626a626-0000-4000-8000-000000000002';
   with f as (select kind::text k, id, route from geofences where name like 'P4K %'),
   t(ev, k, ts) as (values
     ('GEOFENCE_EXIT','LOADING',   timestamptz '2026-10-18 06:00+02'),
     ('GEOFENCE_ENTER','PORT_OUT', timestamptz '2026-10-18 14:00+02'),
     ('GEOFENCE_EXIT','PORT_OUT',  timestamptz '2026-10-18 19:00+02'),
     ('GEOFENCE_ENTER','PORT_IN',  timestamptz '2026-10-19 11:00+02')
   )
   insert into load_events (load_id, event_type, occurred_at, payload)
   select 'a626a626-0000-4000-8000-000000000002', t.ev, t.ts,
          jsonb_build_object('geofence_id', f.id, 'geofence_kind', f.k,
                             'route', coalesce(f.route, 'POLFERRIES'))
     from t join f on f.k = t.k;
   select eta_record_segment_observations('a626a626-0000-4000-8000-000000000002');
   select (
     exists (
       select 1 from eta_segment_observations
        where load_id='a626a626-0000-4000-8000-000000000002'
          and corridor='PORT_CHECKIN' and (features->>'p4k')='true'
          and exclude_reason is null
          and features->>'port_out_src' = 'EVENT'
          and (features->>'sailing_mismatch') = 'true'
          and round(hours_observed) = 5
     )
   )::text;
   rollback;" "true"

val "#626: PIN 30 h po przybiciu → CROSSING z arrival+1h" \
  "begin;
   insert into loads (id, project_id, order_no, hhl_order_no, carrier_order_no, status,
                      plan_load_date, plan_delivery_date, actual_delivery_at)
   select 'a626a626-0000-4000-8000-000000000003', project_id, 'P4K-626C', 'HHL-626C', 'SCX-626C',
          'DELIVERED', current_date - 3, current_date - 1, timestamptz '2026-10-21 18:00+02'
     from loads where id='a581a581-0000-4000-8000-000000000581';
   insert into vessels (id, name, operator) values
     ('a626a626-0000-4000-8000-0000000000a3', 'P4K-Ferry-626C', 'POLFERRIES')
   on conflict (id) do nothing;
   insert into sailings (id, project_id, vessel_id, route, departure_at, arrival_at,
                         actual_departure_at, actual_arrival_at, status, source)
   values (
     'a626a626-0000-4000-8000-0000000000b3',
     (select project_id from loads where id='a626a626-0000-4000-8000-000000000003'),
     'a626a626-0000-4000-8000-0000000000a3',
     'GDN-NYN',
     timestamptz '2026-10-18 16:00+02',
     timestamptz '2026-10-19 08:00+02',
     timestamptz '2026-10-18 16:00+02',
     timestamptz '2026-10-19 08:00+02',
     'ZAPLANOWANY', 'RECZNIE'
   ) on conflict (id) do update
     set actual_departure_at = excluded.actual_departure_at,
         actual_arrival_at = excluded.actual_arrival_at;
   update loads set sailing_id = 'a626a626-0000-4000-8000-0000000000b3'
    where id = 'a626a626-0000-4000-8000-000000000003';
   with f as (select kind::text k, id, route from geofences where name like 'P4K %'),
   t(ev, k, ts) as (values
     ('GEOFENCE_EXIT','LOADING',   timestamptz '2026-10-18 06:00+02'),
     ('GEOFENCE_ENTER','PORT_OUT', timestamptz '2026-10-18 12:00+02'),
     ('GEOFENCE_EXIT','PORT_OUT',  timestamptz '2026-10-18 15:00+02'),
     ('GEOFENCE_ENTER','PORT_IN',  timestamptz '2026-10-20 14:00+02')
   )
   insert into load_events (load_id, event_type, occurred_at, payload)
   select 'a626a626-0000-4000-8000-000000000003', t.ev, t.ts,
          jsonb_build_object('geofence_id', f.id, 'geofence_kind', f.k,
                             'route', coalesce(f.route, 'POLFERRIES'))
     from t join f on f.k = t.k;
   select eta_record_segment_observations('a626a626-0000-4000-8000-000000000003');
   select (
     exists (
       select 1 from eta_segment_observations
        where load_id='a626a626-0000-4000-8000-000000000003'
          and corridor like 'CROSSING%' and (features->>'p4k')='true'
          and exclude_reason is null
          and features->>'pin_src' = 'SAILING_ACTUAL_ARR'
          and (features->>'pin_late_h')::numeric >= 6
          and round(hours_observed) = 18
     )
   )::text;
   rollback;" "true"

val "#626: brak actual_arrival → CROSSING jak dziś (PIN)" \
  "begin;
   insert into loads (id, project_id, order_no, hhl_order_no, carrier_order_no, status,
                      plan_load_date, plan_delivery_date, actual_delivery_at)
   select 'a626a626-0000-4000-8000-000000000004', project_id, 'P4K-626D', 'HHL-626D', 'SCX-626D',
          'DELIVERED', current_date - 3, current_date - 1, timestamptz '2026-10-20 18:00+02'
     from loads where id='a581a581-0000-4000-8000-000000000581';
   insert into vessels (id, name, operator) values
     ('a626a626-0000-4000-8000-0000000000a4', 'P4K-Ferry-626D', 'POLFERRIES')
   on conflict (id) do nothing;
   insert into sailings (id, project_id, vessel_id, route, departure_at, arrival_at,
                         actual_departure_at, status, source)
   values (
     'a626a626-0000-4000-8000-0000000000b4',
     (select project_id from loads where id='a626a626-0000-4000-8000-000000000004'),
     'a626a626-0000-4000-8000-0000000000a4',
     'GDN-NYN',
     timestamptz '2026-10-18 16:00+02',
     timestamptz '2026-10-19 11:00+02',
     timestamptz '2026-10-18 16:00+02',
     'ZAPLANOWANY', 'RECZNIE'
   ) on conflict (id) do update set actual_departure_at = excluded.actual_departure_at;
   update loads set sailing_id = 'a626a626-0000-4000-8000-0000000000b4'
    where id = 'a626a626-0000-4000-8000-000000000004';
   with f as (select kind::text k, id, route from geofences where name like 'P4K %'),
   t(ev, k, ts) as (values
     ('GEOFENCE_EXIT','LOADING',   timestamptz '2026-10-18 06:00+02'),
     ('GEOFENCE_ENTER','PORT_OUT', timestamptz '2026-10-18 12:00+02'),
     ('GEOFENCE_EXIT','PORT_OUT',  timestamptz '2026-10-18 15:00+02'),
     ('GEOFENCE_ENTER','PORT_IN',  timestamptz '2026-10-19 11:00+02')
   )
   insert into load_events (load_id, event_type, occurred_at, payload)
   select 'a626a626-0000-4000-8000-000000000004', t.ev, t.ts,
          jsonb_build_object('geofence_id', f.id, 'geofence_kind', f.k,
                             'route', coalesce(f.route, 'POLFERRIES'))
     from t join f on f.k = t.k;
   select eta_record_segment_observations('a626a626-0000-4000-8000-000000000004');
   select (
     exists (
       select 1 from eta_segment_observations
        where load_id='a626a626-0000-4000-8000-000000000004'
          and corridor like 'CROSSING%' and (features->>'p4k')='true'
          and exclude_reason is null
          and features->>'pin_src' = 'EVENT'
          and coalesce(features ? 'pin_late_h', false) is not true
          and round(hours_observed) = 20
     )
   )::text;
   rollback;" "true"

# F7 r2: EXIT 6 h po eff_dep → EVENT + mismatch; CROSSING do PIN (bez trim arrival)
val "#626 F7: sailing_mismatch — EXIT EVENT zostaje" \
  "begin;
   insert into loads (id, project_id, order_no, hhl_order_no, carrier_order_no, status,
                      plan_load_date, plan_delivery_date, actual_delivery_at)
   select 'a626a626-0000-4000-8000-000000000005', project_id, 'P4K-626E', 'HHL-626E', 'SCX-626E',
          'DELIVERED', current_date - 3, current_date - 1, timestamptz '2026-10-21 18:00+02'
     from loads where id='a581a581-0000-4000-8000-000000000581';
   insert into vessels (id, name, operator) values
     ('a626a626-0000-4000-8000-0000000000a5', 'P4K-Ferry-626E', 'POLFERRIES')
   on conflict (id) do nothing;
   insert into sailings (id, project_id, vessel_id, route, departure_at, arrival_at,
                         actual_departure_at, actual_arrival_at, status, source)
   values (
     'a626a626-0000-4000-8000-0000000000b5',
     (select project_id from loads where id='a626a626-0000-4000-8000-000000000005'),
     'a626a626-0000-4000-8000-0000000000a5',
     'GDN-NYN',
     timestamptz '2026-10-18 16:00+02',
     timestamptz '2026-10-19 08:00+02',
     timestamptz '2026-10-18 17:00+02',
     timestamptz '2026-10-19 08:00+02',
     'ZAPLANOWANY', 'RECZNIE'
   ) on conflict (id) do update
     set actual_departure_at = excluded.actual_departure_at,
         actual_arrival_at = excluded.actual_arrival_at;
   update loads set sailing_id = 'a626a626-0000-4000-8000-0000000000b5'
    where id = 'a626a626-0000-4000-8000-000000000005';
   with f as (select kind::text k, id, route from geofences where name like 'P4K %'),
   t(ev, k, ts) as (values
     ('GEOFENCE_EXIT','LOADING',   timestamptz '2026-10-18 06:00+02'),
     ('GEOFENCE_ENTER','PORT_OUT', timestamptz '2026-10-18 14:00+02'),
     ('GEOFENCE_EXIT','PORT_OUT',  timestamptz '2026-10-18 23:05+02'),
     ('GEOFENCE_ENTER','PORT_IN',  timestamptz '2026-10-19 17:00+02')
   )
   insert into load_events (load_id, event_type, occurred_at, payload)
   select 'a626a626-0000-4000-8000-000000000005', t.ev, t.ts,
          jsonb_build_object('geofence_id', f.id, 'geofence_kind', f.k,
                             'route', coalesce(f.route, 'POLFERRIES'))
     from t join f on f.k = t.k;
   select eta_record_segment_observations('a626a626-0000-4000-8000-000000000005');
   select (
     exists (
       select 1 from eta_segment_observations
        where load_id='a626a626-0000-4000-8000-000000000005'
          and corridor='PORT_CHECKIN' and (features->>'p4k')='true'
          and exclude_reason is null
          and features->>'port_out_src' = 'EVENT'
          and (features->>'sailing_mismatch') = 'true'
          and round(hours_observed) = 9
     )
     and exists (
       select 1 from eta_segment_observations
        where load_id='a626a626-0000-4000-8000-000000000005'
          and corridor like 'CROSSING%' and (features->>'p4k')='true'
          and exclude_reason is null
          and features->>'pin_src' = 'EVENT'
          and coalesce(features ? 'pin_late_h', false) is not true
          and round(hours_observed) = 18
     )
   )::text;
   rollback;" "true"

# F7 r3: przesiadka — przybicie A wcześniej niż EXIT B → CROSSING ważny (nie BRAK), mismatch
val "#626 F7: przesiadka — arrival A < EXIT B → CROSSING + mismatch" \
  "begin;
   insert into loads (id, project_id, order_no, hhl_order_no, carrier_order_no, status,
                      plan_load_date, plan_delivery_date, actual_delivery_at)
   select 'a626a626-0000-4000-8000-00000000000a', project_id, 'P4K-626J', 'HHL-626J', 'SCX-626J',
          'DELIVERED', current_date - 3, current_date - 1, timestamptz '2026-10-21 18:00+02'
     from loads where id='a581a581-0000-4000-8000-000000000581';
   insert into vessels (id, name, operator) values
     ('a626a626-0000-4000-8000-0000000000aa', 'P4K-Ferry-626J', 'POLFERRIES')
   on conflict (id) do nothing;
   insert into sailings (id, project_id, vessel_id, route, departure_at, arrival_at,
                         actual_departure_at, actual_arrival_at, status, source)
   values (
     'a626a626-0000-4000-8000-0000000000ba',
     (select project_id from loads where id='a626a626-0000-4000-8000-00000000000a'),
     'a626a626-0000-4000-8000-0000000000aa',
     'GDN-NYN',
     timestamptz '2026-10-18 08:00+02',
     timestamptz '2026-10-18 18:30+02',
     timestamptz '2026-10-18 08:00+02',
     timestamptz '2026-10-18 18:30+02',
     'ZAPLANOWANY', 'RECZNIE'
   ) on conflict (id) do update
     set actual_departure_at = excluded.actual_departure_at,
         actual_arrival_at = excluded.actual_arrival_at;
   update loads set sailing_id = 'a626a626-0000-4000-8000-0000000000ba'
    where id = 'a626a626-0000-4000-8000-00000000000a';
   with f as (select kind::text k, id, route from geofences where name like 'P4K %'),
   t(ev, k, ts) as (values
     ('GEOFENCE_EXIT','LOADING',   timestamptz '2026-10-18 06:00+02'),
     ('GEOFENCE_ENTER','PORT_OUT', timestamptz '2026-10-18 14:00+02'),
     ('GEOFENCE_EXIT','PORT_OUT',  timestamptz '2026-10-18 19:55+02'),
     ('GEOFENCE_ENTER','PORT_IN',  timestamptz '2026-10-19 06:30+02')
   )
   insert into load_events (load_id, event_type, occurred_at, payload)
   select 'a626a626-0000-4000-8000-00000000000a', t.ev, t.ts,
          jsonb_build_object('geofence_id', f.id, 'geofence_kind', f.k,
                             'route', coalesce(f.route, 'POLFERRIES'))
     from t join f on f.k = t.k;
   select eta_record_segment_observations('a626a626-0000-4000-8000-00000000000a');
   select (
     exists (
       select 1 from eta_segment_observations
        where load_id='a626a626-0000-4000-8000-00000000000a'
          and corridor='PORT_CHECKIN' and (features->>'p4k')='true'
          and exclude_reason is null
          and features->>'port_out_src' = 'EVENT'
          and (features->>'sailing_mismatch') = 'true'
          and round(hours_observed) = 6
     )
     and exists (
       select 1 from eta_segment_observations
        where load_id='a626a626-0000-4000-8000-00000000000a'
          and corridor like 'CROSSING%' and (features->>'p4k')='true'
          and exclude_reason is null
          and features->>'pin_src' = 'EVENT'
          and (features->>'sailing_mismatch') = 'true'
          and coalesce(features ? 'pin_late_h', false) is not true
          and round(hours_observed) = 11
     )
   )::text;
   rollback;" "true"

# F7 r2: przesiadka — EXIT 6 h po eff_dep A, PIN w 6 h po przybiciu A → EVENT+mismatch, CROSSING do PIN
val "#626 F7: przesiadka — mismatch, CROSSING do PIN" \
  "begin;
   insert into loads (id, project_id, order_no, hhl_order_no, carrier_order_no, status,
                      plan_load_date, plan_delivery_date, actual_delivery_at)
   select 'a626a626-0000-4000-8000-000000000009', project_id, 'P4K-626I', 'HHL-626I', 'SCX-626I',
          'DELIVERED', current_date - 3, current_date - 1, timestamptz '2026-10-21 18:00+02'
     from loads where id='a581a581-0000-4000-8000-000000000581';
   insert into vessels (id, name, operator) values
     ('a626a626-0000-4000-8000-0000000000a9', 'P4K-Ferry-626I', 'POLFERRIES')
   on conflict (id) do nothing;
   insert into sailings (id, project_id, vessel_id, route, departure_at, arrival_at,
                         actual_departure_at, actual_arrival_at, status, source)
   values (
     'a626a626-0000-4000-8000-0000000000b9',
     (select project_id from loads where id='a626a626-0000-4000-8000-000000000009'),
     'a626a626-0000-4000-8000-0000000000a9',
     'GDN-NYN',
     timestamptz '2026-10-18 16:00+02',
     timestamptz '2026-10-19 08:00+02',
     timestamptz '2026-10-18 17:00+02',
     timestamptz '2026-10-19 08:00+02',
     'ZAPLANOWANY', 'RECZNIE'
   ) on conflict (id) do update
     set actual_departure_at = excluded.actual_departure_at,
         actual_arrival_at = excluded.actual_arrival_at;
   update loads set sailing_id = 'a626a626-0000-4000-8000-0000000000b9'
    where id = 'a626a626-0000-4000-8000-000000000009';
   with f as (select kind::text k, id, route from geofences where name like 'P4K %'),
   t(ev, k, ts) as (values
     ('GEOFENCE_EXIT','LOADING',   timestamptz '2026-10-18 06:00+02'),
     ('GEOFENCE_ENTER','PORT_OUT', timestamptz '2026-10-18 14:00+02'),
     ('GEOFENCE_EXIT','PORT_OUT',  timestamptz '2026-10-18 23:05+02'),
     ('GEOFENCE_ENTER','PORT_IN',  timestamptz '2026-10-19 12:00+02')
   )
   insert into load_events (load_id, event_type, occurred_at, payload)
   select 'a626a626-0000-4000-8000-000000000009', t.ev, t.ts,
          jsonb_build_object('geofence_id', f.id, 'geofence_kind', f.k,
                             'route', coalesce(f.route, 'POLFERRIES'))
     from t join f on f.k = t.k;
   select eta_record_segment_observations('a626a626-0000-4000-8000-000000000009');
   select (
     exists (
       select 1 from eta_segment_observations
        where load_id='a626a626-0000-4000-8000-000000000009'
          and corridor='PORT_CHECKIN' and (features->>'p4k')='true'
          and exclude_reason is null
          and features->>'port_out_src' = 'EVENT'
          and (features->>'sailing_mismatch') = 'true'
          and round(hours_observed) = 9
     )
     and exists (
       select 1 from eta_segment_observations
        where load_id='a626a626-0000-4000-8000-000000000009'
          and corridor like 'CROSSING%' and (features->>'p4k')='true'
          and exclude_reason is null
          and features->>'pin_src' = 'EVENT'
          and (features->>'sailing_mismatch') = 'true'
          and coalesce(features ? 'pin_late_h', false) is not true
          and round(hours_observed) = 13
     )
   )::text;
   rollback;" "true"

# F7 r1 P2: dwa EXIT — prawdziwy 17:00 i drugi = PIN; max bez ostrej granicy brał PIN
val "#626 F7: dwa EXIT — wybór przed PIN (nie = PIN)" \
  "begin;
   insert into loads (id, project_id, order_no, hhl_order_no, carrier_order_no, status,
                      plan_load_date, plan_delivery_date, actual_delivery_at, sailing_id)
   select 'a626a626-0000-4000-8000-000000000006', project_id, 'P4K-626F', 'HHL-626F', 'SCX-626F',
          'DELIVERED', current_date - 3, current_date - 1, timestamptz '2026-10-20 18:00+02', null
     from loads where id='a581a581-0000-4000-8000-000000000581';
   with f as (select kind::text k, id, route from geofences where name like 'P4K %'),
   t(ev, k, ts) as (values
     ('GEOFENCE_EXIT','LOADING',   timestamptz '2026-10-18 06:00+02'),
     ('GEOFENCE_ENTER','PORT_OUT', timestamptz '2026-10-18 14:00+02'),
     ('GEOFENCE_EXIT','PORT_OUT',  timestamptz '2026-10-18 17:00+02'),
     ('GEOFENCE_EXIT','PORT_OUT',  timestamptz '2026-10-19 11:00+02'),
     ('GEOFENCE_ENTER','PORT_IN',  timestamptz '2026-10-19 11:00+02')
   )
   insert into load_events (load_id, event_type, occurred_at, payload)
   select 'a626a626-0000-4000-8000-000000000006', t.ev, t.ts,
          jsonb_build_object('geofence_id', f.id, 'geofence_kind', f.k,
                             'route', coalesce(f.route, 'POLFERRIES'))
     from t join f on f.k = t.k;
   select eta_record_segment_observations('a626a626-0000-4000-8000-000000000006');
   select (
     exists (
       select 1 from eta_segment_observations
        where load_id='a626a626-0000-4000-8000-000000000006'
          and corridor='PORT_CHECKIN' and (features->>'p4k')='true'
          and exclude_reason is null
          and features->>'port_out_src' = 'EVENT'
          and round(hours_observed) = 3
     )
   )::text;
   rollback;" "true"

# F7 r2: EXIT w ±1 h od odejścia → EVENT bez mismatch; PIN 3 h → ARR bez pin_late_h
val "#626 F7: PIN 3 h po przybiciu → SAILING_ACTUAL_ARR bez pin_late_h" \
  "begin;
   insert into loads (id, project_id, order_no, hhl_order_no, carrier_order_no, status,
                      plan_load_date, plan_delivery_date, actual_delivery_at)
   select 'a626a626-0000-4000-8000-000000000007', project_id, 'P4K-626G', 'HHL-626G', 'SCX-626G',
          'DELIVERED', current_date - 3, current_date - 1, timestamptz '2026-10-20 18:00+02'
     from loads where id='a581a581-0000-4000-8000-000000000581';
   insert into vessels (id, name, operator) values
     ('a626a626-0000-4000-8000-0000000000a7', 'P4K-Ferry-626G', 'POLFERRIES')
   on conflict (id) do nothing;
   insert into sailings (id, project_id, vessel_id, route, departure_at, arrival_at,
                         actual_departure_at, actual_arrival_at, status, source)
   values (
     'a626a626-0000-4000-8000-0000000000b7',
     (select project_id from loads where id='a626a626-0000-4000-8000-000000000007'),
     'a626a626-0000-4000-8000-0000000000a7',
     'GDN-NYN',
     timestamptz '2026-10-18 16:00+02',
     timestamptz '2026-10-19 08:00+02',
     timestamptz '2026-10-18 16:00+02',
     timestamptz '2026-10-19 08:00+02',
     'ZAPLANOWANY', 'RECZNIE'
   ) on conflict (id) do update
     set actual_departure_at = excluded.actual_departure_at,
         actual_arrival_at = excluded.actual_arrival_at;
   update loads set sailing_id = 'a626a626-0000-4000-8000-0000000000b7'
    where id = 'a626a626-0000-4000-8000-000000000007';
   with f as (select kind::text k, id, route from geofences where name like 'P4K %'),
   t(ev, k, ts) as (values
     ('GEOFENCE_EXIT','LOADING',   timestamptz '2026-10-18 06:00+02'),
     ('GEOFENCE_ENTER','PORT_OUT', timestamptz '2026-10-18 12:00+02'),
     ('GEOFENCE_EXIT','PORT_OUT',  timestamptz '2026-10-18 15:00+02'),
     ('GEOFENCE_ENTER','PORT_IN',  timestamptz '2026-10-19 11:00+02')
   )
   insert into load_events (load_id, event_type, occurred_at, payload)
   select 'a626a626-0000-4000-8000-000000000007', t.ev, t.ts,
          jsonb_build_object('geofence_id', f.id, 'geofence_kind', f.k,
                             'route', coalesce(f.route, 'POLFERRIES'))
     from t join f on f.k = t.k;
   select eta_record_segment_observations('a626a626-0000-4000-8000-000000000007');
   select (
     exists (
       select 1 from eta_segment_observations
        where load_id='a626a626-0000-4000-8000-000000000007'
          and corridor='PORT_CHECKIN' and (features->>'p4k')='true'
          and exclude_reason is null
          and features->>'port_out_src' = 'EVENT'
          and coalesce(features ? 'sailing_mismatch', false) is not true
          and round(hours_observed) = 3
     )
     and exists (
       select 1 from eta_segment_observations
        where load_id='a626a626-0000-4000-8000-000000000007'
          and corridor like 'CROSSING%' and (features->>'p4k')='true'
          and exclude_reason is null
          and features->>'pin_src' = 'SAILING_ACTUAL_ARR'
          and coalesce(features ? 'pin_late_h', false) is not true
          and round(hours_observed) = 18
     )
   )::text;
   rollback;" "true"

val "#626 F7: actual_arrival < EXIT → CROSSING BRAK" \
  "begin;
   insert into loads (id, project_id, order_no, hhl_order_no, carrier_order_no, status,
                      plan_load_date, plan_delivery_date, actual_delivery_at)
   select 'a626a626-0000-4000-8000-000000000008', project_id, 'P4K-626H', 'HHL-626H', 'SCX-626H',
          'DELIVERED', current_date - 3, current_date - 1, timestamptz '2026-10-20 18:00+02'
     from loads where id='a581a581-0000-4000-8000-000000000581';
   insert into vessels (id, name, operator) values
     ('a626a626-0000-4000-8000-0000000000a8', 'P4K-Ferry-626H', 'POLFERRIES')
   on conflict (id) do nothing;
   insert into sailings (id, project_id, vessel_id, route, departure_at, arrival_at,
                         actual_departure_at, actual_arrival_at, status, source)
   values (
     'a626a626-0000-4000-8000-0000000000b8',
     (select project_id from loads where id='a626a626-0000-4000-8000-000000000008'),
     'a626a626-0000-4000-8000-0000000000a8',
     'GDN-NYN',
     timestamptz '2026-10-18 16:00+02',
     timestamptz '2026-10-19 08:00+02',
     timestamptz '2026-10-18 16:00+02',
     timestamptz '2026-10-18 16:30+02',
     'ZAPLANOWANY', 'RECZNIE'
   ) on conflict (id) do update
     set actual_departure_at = excluded.actual_departure_at,
         actual_arrival_at = excluded.actual_arrival_at;
   update loads set sailing_id = 'a626a626-0000-4000-8000-0000000000b8'
    where id = 'a626a626-0000-4000-8000-000000000008';
   with f as (select kind::text k, id, route from geofences where name like 'P4K %'),
   t(ev, k, ts) as (values
     ('GEOFENCE_EXIT','LOADING',   timestamptz '2026-10-18 06:00+02'),
     ('GEOFENCE_ENTER','PORT_OUT', timestamptz '2026-10-18 12:00+02'),
     ('GEOFENCE_EXIT','PORT_OUT',  timestamptz '2026-10-18 17:00+02'),
     ('GEOFENCE_ENTER','PORT_IN',  timestamptz '2026-10-19 11:00+02')
   )
   insert into load_events (load_id, event_type, occurred_at, payload)
   select 'a626a626-0000-4000-8000-000000000008', t.ev, t.ts,
          jsonb_build_object('geofence_id', f.id, 'geofence_kind', f.k,
                             'route', coalesce(f.route, 'POLFERRIES'))
     from t join f on f.k = t.k;
   select eta_record_segment_observations('a626a626-0000-4000-8000-000000000008');
   select (
     exists (
       select 1 from eta_segment_observations
        where load_id='a626a626-0000-4000-8000-000000000008'
          and corridor like 'CROSSING%' and (features->>'p4k')='true'
          and exclude_reason = 'BRAK_ZDARZENIA'
     )
   )::text;
   rollback;" "true"

# #630: kalibracja pomija rolę PORT_CHECKIN z sailing_mismatch; CROSSING z mismatch zostaje.
# 5× mismatch 100 h (starsze, pomijane) + 5× dobre 10 h; hours=8 → Δ25 % (≤40 % limitu 30 d);
# z filtrem mediana fit ≈ 10 (nie 100).
val "#630: PORT_CHECKIN sailing_mismatch nie w medianie" \
  "begin;
   update app_parameters set value = 0 where key = 'ETA_CALIBRATION_FROZEN';
   delete from decision_events where decision_id in (
     select id from decisions where type_code='ETA_CALIBRATION_APPROVAL');
   delete from decisions where type_code='ETA_CALIBRATION_APPROVAL';
   delete from eta_calibration_versions
    where applied is not true and created_by is null
      and coalesce(note,'') like 'propozycja ciągła%';
   update eta_calibration_versions
      set undone_at = coalesce(undone_at, now() - interval '8 days')
    where applied is true and undone_at is null;
   delete from eta_segment_observations
    where coalesce(features->>'p4k','') = 'true';
   delete from loads where id::text like 'a630a630-0000-4000-8000-0000000000%';
   insert into loads (id, project_id, order_no, hhl_order_no, carrier_order_no, status,
                      plan_load_date, plan_delivery_date, actual_delivery_at)
   select ('a630a630-0000-4000-8000-0000000000' || lpad(g::text, 2, '0'))::uuid,
          (select project_id from loads where id='a581a581-0000-4000-8000-000000000581'),
          'P4K-630-' || g, 'HHL-630-' || g, 'SCX-630-' || g,
          'DELIVERED', current_date - 40, current_date - 35, now() - interval '35 days'
     from generate_series(1, 10) g;
   update eta_segment_params set hours = 8, spread_pct = 0 where code = 'PORT_CHECKIN';
   insert into eta_segment_observations (load_id, corridor, hours_observed, features, observed_at)
   select ('a630a630-0000-4000-8000-0000000000' || lpad(ord::text, 2, '0'))::uuid,
          'PORT_CHECKIN', 100,
          jsonb_build_object('p4k', true, 'sailing_mismatch', true, 'p4k_630', true),
          now() - interval '50 days' + (ord || ' days')::interval
     from generate_series(1, 5) ord;
   insert into eta_segment_observations (load_id, corridor, hours_observed, features, observed_at)
   select ('a630a630-0000-4000-8000-0000000000' || lpad((5+ord)::text, 2, '0'))::uuid,
          'PORT_CHECKIN', 10,
          jsonb_build_object('p4k', true, 'p4k_630', true),
          now() - interval '20 days' + (ord || ' days')::interval
     from generate_series(1, 5) ord;
   with p as (select public.eta_propose_calibration() as j),
        v as (
          select * from eta_calibration_versions
           where id = ((select j->>'proposal' from p)::bigint)
        )
   select (
     (select (j->>'n_skipped_sailing_mismatch')::int from p) = 5
     and (select j->>'proposal' from p) is not null
     and (select (params_after->'PORT_CHECKIN'->>'hours')::numeric from v) between 9 and 11
     and (select n_obs from v) = 5
     and (select (j->>'n_obs')::int from p) = 5
     and (select error_before_min from v) is not null
     and (select error_after_min from v) is not null
     and (select error_after_min from v) < (select error_before_min from v)
   )::text;
   rollback;" "true"

# Po cofnięciu wersji (<7 d): same mismatch nie dają „3 nowych” → kod nadal w skip 7 d.
val "#630: po undo same mismatch nie odblokowują 7 d" \
  "begin;
   update app_parameters set value = 0 where key = 'ETA_CALIBRATION_FROZEN';
   delete from decision_events where decision_id in (
     select id from decisions where type_code='ETA_CALIBRATION_APPROVAL');
   delete from decisions where type_code='ETA_CALIBRATION_APPROVAL';
   delete from eta_calibration_versions
    where applied is not true and created_by is null
      and coalesce(note,'') like 'propozycja ciągła%';
   delete from eta_segment_observations
    where corridor = 'PORT_CHECKIN'
      and coalesce(features->>'p4k','') = 'true';
   delete from loads where id::text like 'a630a630-0000-4000-8000-0000000007%';
   insert into loads (id, project_id, order_no, hhl_order_no, carrier_order_no, status,
                      plan_load_date, plan_delivery_date, actual_delivery_at)
   select ('a630a630-0000-4000-8000-0000000007' || lpad(g::text, 2, '0'))::uuid,
          (select project_id from loads where id='a581a581-0000-4000-8000-000000000581'),
          'P4K-630U-' || g, 'HHL-630U-' || g, 'SCX-630U-' || g,
          'DELIVERED', current_date - 10, current_date - 5, now() - interval '5 days'
     from generate_series(1, 5) g;
   update eta_segment_params set hours = 8, spread_pct = 0 where code = 'PORT_CHECKIN';
   insert into eta_calibration_versions (
     created_by, params_before, params_after, n_obs,
     error_before_min, error_after_min, applied, frozen, note, undone_at, created_at
   ) values (
     null,
     jsonb_build_object('PORT_CHECKIN', jsonb_build_object('hours', 8, 'spread_pct', 0)),
     jsonb_build_object('PORT_CHECKIN', jsonb_build_object('hours', 10, 'spread_pct', 10)),
     5, 120, 60, true, false,
     'p4k-630-undo-7d',
     now() - interval '2 days',
     now() - interval '3 days'
   );
   insert into eta_segment_observations (load_id, corridor, hours_observed, features, observed_at)
   select ('a630a630-0000-4000-8000-0000000007' || lpad(ord::text, 2, '0'))::uuid,
          'PORT_CHECKIN', 100,
          jsonb_build_object('p4k', true, 'sailing_mismatch', true, 'p4k_630u', true),
          now() - interval '1 day' + (ord || ' hours')::interval
     from generate_series(1, 5) ord;
   with p as (select public.eta_propose_calibration() as j)
   select (
     (j->>'n_skipped_sailing_mismatch')::int = 5
     and (
       j->>'proposal' is null
       or not exists (
         select 1 from eta_calibration_versions
          where id = (j->>'proposal')::bigint
            and params_after ? 'PORT_CHECKIN'
       )
     )
   )::text from p;
   rollback;" "true"

# ≥5 CROSSING z mismatch, godziny ≠ parametr (18 → 24); propozycja ≈ mediana, n_obs je liczy.
val "#630: CROSSING sailing_mismatch zostaje w n_obs" \
  "begin;
   update app_parameters set value = 0 where key = 'ETA_CALIBRATION_FROZEN';
   delete from decision_events where decision_id in (
     select id from decisions where type_code='ETA_CALIBRATION_APPROVAL');
   delete from decisions where type_code='ETA_CALIBRATION_APPROVAL';
   delete from eta_calibration_versions
    where applied is not true and created_by is null
      and coalesce(note,'') like 'propozycja ciągła%';
   update eta_calibration_versions
      set undone_at = coalesce(undone_at, now() - interval '8 days')
    where applied is true and undone_at is null;
   delete from eta_segment_observations
    where coalesce(features->>'p4k','') = 'true';
   delete from loads where id::text like 'a630a630-0000-4000-8000-00000000c%';
   insert into loads (id, project_id, order_no, hhl_order_no, carrier_order_no, status,
                      plan_load_date, plan_delivery_date, actual_delivery_at)
   select ('a630a630-0000-4000-8000-00000000c' || lpad(g::text, 3, '0'))::uuid,
          (select project_id from loads where id='a581a581-0000-4000-8000-000000000581'),
          'P4K-630C-' || g, 'HHL-630C-' || g, 'SCX-630C-' || g,
          'DELIVERED', current_date - 40, current_date - 35, now() - interval '35 days'
     from generate_series(1, 5) g;
   update eta_segment_params set hours = 18, spread_pct = 15 where code = 'CROSSING_GDN_NYN';
   insert into eta_segment_observations (load_id, corridor, hours_observed, features, observed_at)
   select ('a630a630-0000-4000-8000-00000000c' || lpad(ord::text, 3, '0'))::uuid,
          'CROSSING_GDN_NYN', 24,
          jsonb_build_object('p4k', true, 'sailing_mismatch', true, 'p4k_630c', true),
          now() - interval '30 days' + (ord || ' days')::interval
     from generate_series(1, 5) ord;
   with p as (select public.eta_propose_calibration() as j),
        v as (
          select * from eta_calibration_versions
           where id = ((select j->>'proposal' from p)::bigint)
        )
   select (
     (select j->>'proposal' from p) is not null
     and (select (params_after->'CROSSING_GDN_NYN'->>'hours')::numeric from v)
         between 23 and 25
     and (select n_obs from v) = 5
     and (select (j->>'n_obs')::int from p) = 5
     and (select (j->>'n_skipped_sailing_mismatch')::int from p) = 0
   )::text;
   rollback;" "true"

echo "WYNIK: $ok OK, $fail FAIL"
[ "$fail" -eq 0 ]
