#!/usr/bin/env bash
# SMS-KSH-1H + ETA-PRE-LOAD. Bez bramki SMS i bez Resend — tylko kolejka w bazie.
. "$(git rev-parse --show-toplevel)/tests/db/refuse-prod.sh"
PSQL="psql ${PGURL:-postgres://postgres@localhost:5433/tower} -Atq"
HHL=11111111-0000-0000-0000-000000000001
P=22222222-0000-0000-0000-000000000001
L1=33333333-0000-0000-0000-000000000001
L2=33333333-0000-0000-0000-000000000002
ok=0; fail=0
sys() { $PSQL -v ON_ERROR_STOP=1 -c "$1" 2>&1; }
val() {
  out=$(sys "$2" | grep -v -E '^(BEGIN|SET|ROLLBACK|COMMIT)$' | tail -1)
  if [ "$out" = "$3" ]; then ok=$((ok+1)); echo "  OK    $1"; else fail=$((fail+1)); echo "  FAIL  $1 (otrzymano: $out, oczekiwano: $3)"; fi
}
hhl() {
  $PSQL -v ON_ERROR_STOP=1 -c "begin; select set_config('request.jwt.claim.sub','$HHL',true); set local role authenticated; $1; commit;" >/dev/null
}

echo; echo "[smsksh] SMS godzina przed i ETA przed załadunkiem"
val "H1 zostaje wylaczone" "select enabled::text from security_flags where key='H1_ROUTE_CHECK'" "false"
val "H3 zostaje wylaczone" "select enabled::text from security_flags where key='H3_CORRIDOR_OBSTACLES'" "false"

hhl "select admin_sms_zone_recipient_set('LOAD_SREM',1,'Anna Test','601111222','PL',true)"
hhl "select admin_sms_zone_recipient_set('LOAD_SREM',2,'Bartek Test','601333444','PL',true)"
hhl "select admin_sms_zone_recipient_set('UNLOAD_BODEN',1,'Carla SE','0701112233','SE',true)"
hhl "select admin_sms_zone_recipient_set('UNLOAD_BODEN',2,'David SE','0704445566','SE',true)"
sys "update loads set tractor_plate='PO 1234', driver_name='Jan Kowalski', plan_load_date=current_date - 1, telematics_vehicle_id='TEL-SMS-L1' where id='$L1'" >/dev/null
sys "update loads set tractor_plate='WX 999', driver_name='Eva Nilsson', plan_load_date=current_date - 1, telematics_vehicle_id='TEL-SMS-L2' where id='$L2'" >/dev/null

val "brak GPS: brak SMS" "select sms_ksh_1h_consider('$L2')" "0"
val "brak GPS: zero wierszy" "select count(*) from sms_outbox where load_id='$L2' and kind='ZONE_APPROACH'" "0"

place() {
  # $1 load  $2 SREM|BODEN  $3 minuty  $4 unikalny znacznik czasu
  sys "with yard as (
      select case when '$2' = 'SREM' then coalesce(
        (select st_centroid(geom) from geofences g where g.project_id='$P' and g.kind='LOADING' and g.country='PL' and g.active order by g.sort_order limit 1),
        st_setsrid(st_makepoint(17.0246, 52.07391), 4326))
      else coalesce(
        (select st_centroid(geom) from geofences g where g.project_id='$P' and g.kind='SITE' and g.country='SE' and g.active order by g.sort_order limit 1),
        st_setsrid(st_makepoint(21.7591, 65.8054), 4326))
      end as g
    ), spd as (
      select (c.total_km / (e.hours * case when '$2' = 'BODEN' then coalesce((select slowdown_mult from corridor_conditions where corridor='SE_E4'), 1) else 1 end)) as kmh
      from corridor_polylines c
      join eta_segment_params e on e.code = case when '$2' = 'BODEN' then 'SE_ROAD' else 'PL_ROAD' end
      where c.code = case when '$2' = 'BODEN' then 'SE_E4' else 'PL_ROAD' end
    )
    insert into positions (load_id, ts, geom_raw, source, raw)
    select '$1', timestamptz '$4',
      st_setsrid(st_project((select g from yard)::geography, (select kmh from spd) * 1000.0 * ($3 / 60.0), radians(90))::geometry, 4326),
      'TELEMATICS_API', jsonb_build_object('t', '$3')" >/dev/null
}

place "$L1" SREM 120 "$(date -u -d '30 minutes ago' +%Y-%m-%dT%H:%M:%SZ)"
val "120 min do Sremu: czas wlasnego silnika" "select (minutes between 119 and 121 and engine='wlasny')::text from yard_drive_quote('$L1','SREM')" "true"
val "120 min do Sremu: zero SMS" "select count(*) from sms_outbox where load_id='$L1' and kind='ZONE_APPROACH'" "0"

place "$L1" SREM 40 "$(date -u -d '25 minutes ago' +%Y-%m-%dT%H:%M:%SZ)"
val "40 min do Sremu: SMS od razu, dwa numery" "select count(*) from sms_outbox where load_id='$L1' and kind='ZONE_APPROACH' and to_e164 like '+48%'" "2"
val "tresc: kto, rejestracja, godzina" "select (bool_and(body like '%Jan Kowalski%' and body like '%PO 1234%' and body like '%przyjazd%'))::text from sms_outbox where load_id='$L1' and kind='ZONE_APPROACH'" "true"

place "$L1" SREM 30 "$(date -u -d '20 minutes ago' +%Y-%m-%dT%H:%M:%SZ)"
val "kolejna pozycja: bez duplikatu" "select count(*) from sms_outbox where load_id='$L1' and kind='ZONE_APPROACH'" "2"

place "$L2" BODEN 120 "$(date -u -d '15 minutes ago' +%Y-%m-%dT%H:%M:%SZ)"
val "120 min do Boden: zero SMS" "select count(*) from sms_outbox where load_id='$L2' and kind='ZONE_APPROACH'" "0"
val "GPS przed wyjazdem ze Sremu: ETA pusta" "select (eta_site is null)::text||'/'||(eta_basis->>'pre_load') from loads where id='$L2'" "true/true"

place "$L2" BODEN 40 "$(date -u -d '10 minutes ago' +%Y-%m-%dT%H:%M:%SZ)"
val "40 min do Boden: dwa SMS" "select count(*) from sms_outbox where load_id='$L2' and kind='ZONE_APPROACH' and to_e164 like '+46%'" "2"
val "Boden: kto i rejestracja" "select (bool_and(body like '%Eva Nilsson%' and body like '%WX 999%'))::text from sms_outbox where load_id='$L2' and kind='ZONE_APPROACH'" "true"

place "$L2" BODEN 20 "$(date -u -d '5 minutes ago' +%Y-%m-%dT%H:%M:%SZ)"
val "Boden: powtorzona pozycja bez duplikatu" "select count(*) from sms_outbox where load_id='$L2' and kind='ZONE_APPROACH'" "2"

sys "insert into load_events (load_id, event_type, occurred_at, payload) values ('$L2','GEOFENCE_EXIT', now(), '{\"geofence_kind\":\"LOADING\"}')" >/dev/null
sys "select refresh_load_eta('$L2')" >/dev/null
val "po wyjezdzie ze strefy placu ETA sie pojawia" "select (eta_site is not null)::text||'/'||coalesce(eta_basis->>'pre_load','false') from loads where id='$L2'" "true/false"
val "flagi H1 i H3 nadal wylaczone" "select count(*) from security_flags where key in ('H1_ROUTE_CHECK','H3_CORRIDOR_OBSTACLES') and enabled" "0"

echo; echo "WYNIK: $ok OK, $fail FAIL"
[ "$fail" -eq 0 ]
