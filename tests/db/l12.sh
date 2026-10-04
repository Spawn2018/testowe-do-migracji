#!/usr/bin/env bash
# L-12 — kreator stref: kraj, usuwanie, SMS według kraju i rodzaju.
. "$(git rev-parse --show-toplevel)/tests/db/refuse-prod.sh"
PSQL="psql ${PGURL:-postgres://postgres@localhost:5433/tower} -Atq"
HHL=11111111-0000-0000-0000-000000000001
KSH=11111111-0000-0000-0000-000000000002
P=22222222-0000-0000-0000-000000000001
L=33333333-0000-0000-0000-000000000001
ok=0; fail=0
sys() { $PSQL -v ON_ERROR_STOP=1 -c "$1" 2>&1; }
val() {
  out=$(sys "$2" | grep -v -E '^(BEGIN|SET|ROLLBACK|COMMIT)$' | tail -1)
  if [ "$out" = "$3" ]; then ok=$((ok+1)); echo "  OK    $1"; else fail=$((fail+1)); echo "  FAIL  $1 (otrzymano: $out, oczekiwano: $3)"; fi
}
err() {
  out=$(sys "$2")
  if echo "$out" | grep -qiE "$3"; then ok=$((ok+1)); echo "  OK    $1"; else fail=$((fail+1)); echo "  FAIL  $1 → $(echo "$out" | tail -1)"; fi
}
hhl() {
  $PSQL -v ON_ERROR_STOP=1 -c "begin; select set_config('request.jwt.claim.sub','$HHL',true); set local role authenticated; $1; commit;" 2>&1 \
    | grep -v -E '^(BEGIN|SET|COMMIT)$' | tail -1
}

echo; echo "[l12] kreator stref"
hhl "select admin_sms_zone_recipient_set('LOAD_SREM',1,'Anna Test','601111222','PL',true)" >/dev/null
hhl "select admin_sms_zone_recipient_set('LOAD_SREM',2,'Bartek Test','601333444','PL',true)" >/dev/null
hhl "select admin_sms_zone_recipient_set('UNLOAD_BODEN',1,'Carla SE','0701112233','SE',true)" >/dev/null
hhl "select admin_sms_zone_recipient_set('UNLOAD_BODEN',2,'David SE','0704445566','SE',true)" >/dev/null

G_LOAD_PL=$(hhl "select upsert_geofence_circle(null, '$P', 'L12 zaladunek PL', 'LOADING', 52.07391, 17.0246, 600, 120, 0, 1, true, false, false, '{}', true, 'PL')")
G_SITE_SE=$(hhl "select upsert_geofence_circle(null, '$P', 'L12 plac SE', 'SITE', 65.80539, 21.75914, 800, 200, 0, 1, true, false, false, '{}', true, 'SE')")
G_LOAD_SE=$(hhl "select upsert_geofence_circle(null, '$P', 'L12 zaladunek SE', 'LOADING', 65.80539, 21.75914, 600, 120, 0, 1, true, false, false, '{}', true, 'SE')")
G_SITE_PL=$(hhl "select upsert_geofence_circle(null, '$P', 'L12 plac PL', 'SITE', 52.07391, 17.0246, 800, 200, 0, 1, true, false, false, '{}', true, 'PL')")
G_PRE_PL=$(hhl "select upsert_geofence_circle(null, '$P', 'L12 zblizenie PL', 'PRE_ARRIVAL', 52.07391, 17.0246, 5000, 200, 0, 1, true, false, false, '{}', true, 'PL')")
G_PRE_SE=$(hhl "select upsert_geofence_circle(null, '$P', 'L12 zblizenie SE', 'PRE_ARRIVAL', 65.80, 21.76, 5000, 200, 0, 1, true, false, false, '{}', true, 'SE')")

val "nowa strefa ma kraj PL" "select country from geofences where id='$G_LOAD_PL'" "PL"
val "nowa strefa nie startuje na srodku Baltyku" "select (lat < 55) from v_geofences_circle where id='$G_LOAD_PL'" "t"
val "widok oddaje kraj" "select country from v_geofences_circle where id='$G_SITE_SE'" "SE"

fire() {
  sys "delete from sms_outbox where kind in ('ZONE_ENTER','ZONE_APPROACH');
       insert into load_events (load_id, event_type, occurred_at, payload)
       values ('$L', 'GEOFENCE_ENTER', now(), jsonb_build_object('geofence_id', '$1', 'geofence_kind', '$2', 'geofence_name', 'L12'));" >/dev/null
}

fire "$G_LOAD_PL" LOADING
val "LOADING + PL → 2 SMS wjazdu na Srem" "select count(*) from sms_outbox where kind='ZONE_ENTER' and to_e164 like '+48%' and body like '%zaladunek Srem%'" 2

fire "$G_SITE_SE" SITE
val "SITE + SE → 2 SMS wjazdu na Boden" "select count(*) from sms_outbox where kind='ZONE_ENTER' and to_e164 like '+46%' and body like '%Boden%'" 2

fire "$G_LOAD_SE" LOADING
val "LOADING + SE → brak SMS" "select count(*) from sms_outbox where kind in ('ZONE_ENTER','ZONE_APPROACH')" 0

fire "$G_SITE_PL" SITE
val "SITE + PL → brak SMS" "select count(*) from sms_outbox where kind in ('ZONE_ENTER','ZONE_APPROACH')" 0

fire "$G_PRE_PL" PRE_ARRIVAL
val "PRE_ARRIVAL + PL nie wysyla SMS 1 h (to nie jest czas jazdy)" "select count(*) from sms_outbox where kind='ZONE_APPROACH'" 0

fire "$G_PRE_SE" PRE_ARRIVAL
val "PRE_ARRIVAL + SE nie wysyla SMS 1 h (to nie jest czas jazdy)" "select count(*) from sms_outbox where kind='ZONE_APPROACH'" 0

hhl "select delete_geofence('$G_LOAD_PL')" >/dev/null
val "HHL usuwa strefe" "select count(*) from geofences where id='$G_LOAD_PL'" 0

err "KSH nie usuwa strefy" "begin; select set_config('request.jwt.claim.sub','$KSH',true); set local role authenticated; select delete_geofence('$G_SITE_SE'); rollback;" "Brak uprawnień"
err "KSH nie zapisuje strefy" "begin; select set_config('request.jwt.claim.sub','$KSH',true); set local role authenticated; select upsert_geofence_circle(null, '$P', 'L12 obca', 'CHECKPOINT', 52.07, 17.02, 500, 100, 0, 1, true, false, false, '{}', true, 'PL'); rollback;" "row-level security|Brak uprawnień"

echo; echo "WYNIK: $ok OK, $fail FAIL"
[ "$fail" -eq 0 ]
