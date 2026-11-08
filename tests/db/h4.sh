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
sys "update loads set hhl_order_no='HHL-H4-1', status='IN_TRANSIT_SE', plan_load_date=current_date - 2, telematics_vehicle_id='TEL-H4-1' where id='$L1'" >/dev/null
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


# --- 0186: ostrożne gdy brak last_rest + niepewność + dzień od odpoczynku ---

# (a) brak historii odpoczynku → ostrożne, rest wstawiony, Wysoka niedostępna (conf>60)
L2=33333333-0000-0000-0000-000000000002
sys "update loads set hhl_order_no='HHL-H4-2', status='IN_TRANSIT_SE', plan_load_date=current_date - 2, telematics_vehicle_id='TEL-H4-2', trailer_swap=false, trailer_swap_at=null where id='$L2'" >/dev/null
sys "delete from positions where load_id='$L2'" >/dev/null
sys "delete from load_events where load_id='$L2'" >/dev/null
sys "insert into load_events (load_id, event_type, occurred_at, payload) values ('$L2','GEOFENCE_EXIT', now()-interval '1 day', '{\"geofence_kind\":\"LOADING\"}')" >/dev/null
# pozycje w ruchu bez postoju ≥9 h (mid-trip, jak emtrack od 13:25) — NIE świeży kierowca
sys "insert into positions (load_id, ts, geom_raw, speed_kmh, source, raw) values
  ('$L2', now()-interval '3 hours', st_setsrid(st_makepoint(17.5, 62.5), 4326), 70, 'TELEMATICS_API', '{}'::jsonb),
  ('$L2', now()-interval '2 hours', st_setsrid(st_makepoint(17.7, 62.7), 4326), 72, 'TELEMATICS_API', '{}'::jsonb),
  ('$L2', now()-interval '5 minutes', st_setsrid(st_makepoint(18.0, 63.0), 4326), 68, 'TELEMATICS_API', '{}'::jsonb)" >/dev/null
val "0186 brak last_rest: cautious=true" \
  "select cautious::text from h4_driver_state_from_gps('$L2', now())" "true"
approx "0186 brak last_rest: schedule wstawia rest (rest_h=11 przy 8.5+3)" \
  "select rest_h::text from h4_schedule_remaining(3.0, 8.5, 0, 4.0)" \
  11.0 0.01
val "0186 brak historii: Wysoka niedostępna (conf_min>60)" \
  "select (coalesce(conf_min,0) > 60)::text from compute_load_eta('$L2', now()) limit 1" "true"

# (c) niepewność odpoczynku > 0 w paśmie — na L2 mid-trip (ostrożne) zanim nadpiszemy GPS
val "0186 rest uncertainty > 0 w band (H4_EU_REST lub H4_CAUTIOUS)" \
  "select (exists (
     select 1 from compute_load_eta('$L2', now()) e,
     lateral jsonb_array_elements(e.basis->'band'->'components') c
     where c->>'code' in ('H4_EU_REST','H4_CAUTIOUS') and (c->>'min')::numeric > 0
   ))::text" "true"

# (b) pełna historia: odpoczynek 11 h rano → dzień jazdy od jego końca (nie ostrożne)
sys "delete from positions where load_id='$L2'" >/dev/null
sys "insert into positions (load_id, ts, geom_raw, speed_kmh, source, raw) values
  ('$L2', date_trunc('day', now() at time zone 'Europe/Warsaw') at time zone 'Europe/Warsaw' - interval '2 hours', st_setsrid(st_makepoint(17.0, 59.0), 4326), 0, 'TELEMATICS_API', '{}'::jsonb),
  ('$L2', date_trunc('day', now() at time zone 'Europe/Warsaw') at time zone 'Europe/Warsaw' + interval '9 hours', st_setsrid(st_makepoint(17.0, 59.0), 4326), 0, 'TELEMATICS_API', '{}'::jsonb),
  ('$L2', date_trunc('day', now() at time zone 'Europe/Warsaw') at time zone 'Europe/Warsaw' + interval '10 hours', st_setsrid(st_makepoint(17.3, 59.5), 4326), 75, 'TELEMATICS_API', '{}'::jsonb),
  ('$L2', date_trunc('day', now() at time zone 'Europe/Warsaw') at time zone 'Europe/Warsaw' + interval '11 hours', st_setsrid(st_makepoint(17.6, 60.0), 4326), 70, 'TELEMATICS_API', '{}'::jsonb)" >/dev/null
NOW3="(date_trunc('day', now() at time zone 'Europe/Warsaw') at time zone 'Europe/Warsaw' + interval '11 hours 5 minutes')"
val "0186 z rest 11h: cautious=false" \
  "select cautious::text from h4_driver_state_from_gps('$L2', $NOW3)" "false"
val "0186 z rest 11h: last_rest not null" \
  "select (last_rest_end is not null)::text from h4_driver_state_from_gps('$L2', $NOW3)" "true"
approx "0186 z rest 11h: driven_since_rest ~2h (dzień od końca rest)" \
  "select driven_since_rest_h::text from h4_driver_state_from_gps('$L2', $NOW3)" \
  2.0 0.5

# DP-193 (#762 C2 / F7 #770): zwinąć powtórzenia w eta_basis.flags (przerwy z GPS ×N), maks. 12 (+N).
val "DP-193: 60× przerwa + odpoczynek → 2 flagi" \
  "select array_length(public.eta_flags_collapse(
     (select array_agg('przerwa z GPS'::text) from generate_series(1,60))
     || array['odpoczynek dobowy regularny (≥11 h) z GPS'::text]
   ), 1)::text" "2"
val "DP-193: etykieta przerwy ×60" \
  "select (public.eta_flags_collapse(
     (select array_agg('przerwa z GPS'::text) from generate_series(1,60))
     || array['odpoczynek dobowy regularny (≥11 h) z GPS'::text]
   ))[1]" "przerwy z GPS ×60"
val "DP-193: maks. 12 pozycji (11 + +N)" \
  "select array_length(public.eta_flags_collapse(
     (select array_agg(('flaga-'||g::text)) from generate_series(1,20) g)
   ), 1)::text" "12"
val "DP-193: obcięcie kończy się +N" \
  "select (public.eta_flags_collapse(
     (select array_agg(('flaga-'||g::text)) from generate_series(1,20) g)
   ))[12]" "+9"
val "DP-193: null → pusta tablica" \
  "select coalesce(array_length(public.eta_flags_collapse(null), 1), 0)::text" "0"
val "DP-193: pusta tablica → pusta" \
  "select coalesce(array_length(public.eta_flags_collapse('{}'::text[]), 1), 0)::text" "0"
val "DP-193: authenticated bez EXECUTE eta_flags_collapse" \
  "select has_function_privilege('authenticated','eta_flags_collapse(text[])','execute')::text" "false"

# DP-199 (decyzja 111 / F7 #895): krótki prom TLL-HEL (~2 h) — bez flagi D-9;
# własny load (#713); sailing_id=null → rodzina z ferry_route; pozycja ląd EE (Tallinn).
# GPS z odpoczynkiem 11 h + ~4 h jazdy (nie 1 punkt → ostrożne 8,5 h): since≈4, driven≈4;
# po krótkim promie since=0 → pierwszy EU_DRIVE ≥4 h (przy since=4 byłoby ~0,5 h).
# carrier_order_no wymagane przy IN_TRANSIT_* (enforce_order_numbers — CI db h4).
L199=a1990000-0000-4000-8000-000000000199
sys "insert into loads (id, project_id, carrier_org_id, order_no, hhl_order_no, carrier_order_no, ferry_route, sailing_id, status, plan_load_date, telematics_vehicle_id, trailer_swap, trailer_swap_at)
  values ('$L199','22222222-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000a003','KSH/D199','HHL-D199','SCX-D199','TLL-HEL',null,'IN_TRANSIT_PL', current_date - 1, 'TEL-H4-199', false, null)
  on conflict (id) do update set ferry_route='TLL-HEL', sailing_id=null, status='IN_TRANSIT_PL',
    hhl_order_no=excluded.hhl_order_no, carrier_order_no=excluded.carrier_order_no,
    plan_load_date=excluded.plan_load_date, telematics_vehicle_id=excluded.telematics_vehicle_id,
    trailer_swap=false, trailer_swap_at=null" >/dev/null
val "DP-199 fixture: 1 load TLL-HEL" \
  "select count(*)::text from loads where id='$L199' and ferry_route='TLL-HEL' and sailing_id is null" "1"
val "DP-199 fixture: rodzina TLL-HEL" \
  "select public.load_route_family('$L199')" "TLL-HEL"
val "DP-199 fixture: CROSSING ~2 h" \
  "select round(hours, 2)::text from eta_segment_params where code = public.eta_obs_segment_code(public.load_route_family('$L199'), 'CROSSING')" "2.00"
val "DP-199 0442: rdzeń ma warunek ≥9 h" \
  "select (pg_get_functiondef('public.compute_load_eta_core(uuid, timestamptz)'::regprocedure) like '%DP-199 / F7 #895%')::text" "true"
sys "delete from positions where load_id='$L199'" >/dev/null
sys "delete from load_events where load_id='$L199'" >/dev/null
sys "insert into load_events (load_id, event_type, occurred_at, payload) values ('$L199','GEOFENCE_EXIT', now()-interval '1 day', '{\"geofence_kind\":\"LOADING\"}')" >/dev/null
# Tallinn ląd: odpoczynek 11 h, potem ~4 h jazdy (since≈4) — przed promem TLL-HEL
sys "insert into positions (load_id, ts, geom_raw, speed_kmh, source, raw) values
  ('$L199', now()-interval '15 hours 30 minutes', st_setsrid(st_makepoint(24.753, 59.437), 4326), 0, 'TELEMATICS_API', '{}'::jsonb),
  ('$L199', now()-interval '4 hours 30 minutes', st_setsrid(st_makepoint(24.753, 59.437), 4326), 0, 'TELEMATICS_API', '{}'::jsonb),
  ('$L199', now()-interval '2 hours', st_setsrid(st_makepoint(24.70, 59.40), 4326), 72, 'TELEMATICS_API', '{}'::jsonb),
  ('$L199', now()-interval '5 minutes', st_setsrid(st_makepoint(24.75, 59.44), 4326), 68, 'TELEMATICS_API', '{}'::jsonb)" >/dev/null
val "DP-199 TLL-HEL GPS: since_break ~4 (nie ostrożne 8,5)" \
  "select (since_break_h between 3.5 and 4.6 and driven_today_h between 3.5 and 5.0 and cautious is false)::text
     from h4_driver_state_from_gps('$L199', now())" "true"
val "DP-199 TLL-HEL przed promem: bez flagi H-4 po promie" \
  "select (coalesce(basis->'flags','[]'::jsonb)::text not like '%H-4 po promie%')::text from compute_load_eta('$L199', now()) limit 1" "true"
val "DP-199 TLL-HEL: po krótkim promie pierwszy EU_DRIVE ≥4 h (since=0)" \
  "select (coalesce((
     select (t.elem->>'hours')::numeric
     from compute_load_eta('$L199', now()) e
     cross join lateral jsonb_array_elements(coalesce(e.basis->'segments','[]'::jsonb)) s(seg)
     cross join lateral jsonb_array_elements(coalesce(s.seg->'items','[]'::jsonb))
       with ordinality t(elem, ord)
     where s.seg->>'code' = 'H4_SEGMENTS'
       and t.elem->>'code' = 'EU_DRIVE'
     order by t.ord
     limit 1
   ), 0) >= 4.0)::text" "true"

sys "update loads set ferry_route='GDN-NYN', sailing_id=null, status='IN_TRANSIT_PL' where id='$L199'" >/dev/null
sys "delete from positions where load_id='$L199'" >/dev/null
sys "insert into positions (load_id, ts, geom_raw, source, raw) values ('$L199', now()-interval '5 minutes', st_setsrid(st_makepoint(18.65, 54.35), 4326), 'TELEMATICS_API', '{}'::jsonb)" >/dev/null
val "DP-199 GDN-NYN przed promem: flaga H-4 po promie (D-9)" \
  "select (coalesce(basis->'flags','[]'::jsonb)::text like '%H-4 po promie%')::text from compute_load_eta('$L199', now()) limit 1" "true"

echo "WYNIK: $ok OK, $fail FAIL"
