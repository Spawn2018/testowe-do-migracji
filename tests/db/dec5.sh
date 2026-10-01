#!/usr/bin/env bash
# DEC-5 — SMS strefy (listy 2+2, wyzwalacze, dedup, bufor Śrem).
. "$(git rev-parse --show-toplevel)/tests/db/refuse-prod.sh"
PSQL="psql ${PGURL:-postgres://postgres@localhost:5433/tower} -Atq"
HHL=11111111-0000-0000-0000-000000000001
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

echo; echo "[dec5] SMS strefy"
val "sms_strip_pl usuwa ogonki" "select sms_strip_pl('załadunek Śrem')" "zaladunek Srem"
val "e164 PL" "select sms_zone_e164('601234567','PL')" "+48601234567"
val "e164 SE z 0" "select sms_zone_e164('0701234567','SE')" "+46701234567"
val "wyzwalacze domyslnie ON" "select count(*) from security_flags where key in ('SMS_ZONE_APPROACH','SMS_ZONE_ENTER') and enabled" 2
val "bufor przed Sremem istnieje" "select count(*) from geofences where name='Bufor przed Sremem' and kind='PRE_ARRIVAL' and country='PL'" 1

sys "begin; delete from sms_outbox where kind like 'ZONE%';
     delete from sms_zone_recipients;
     select set_config('request.jwt.claim.sub','$HHL',true);
     set local role authenticated;
     select admin_sms_zone_recipient_set('LOAD_SREM',1,'Anna Test','+48 601 111 222','PL',true);
     select admin_sms_zone_recipient_set('LOAD_SREM',2,'Bartek Test','601333444','PL',true);
     select admin_sms_zone_recipient_set('UNLOAD_BODEN',1,'Carla SE','0701112233','SE',true);
     select admin_sms_zone_recipient_set('UNLOAD_BODEN',2,'David SE','0704445566','SE',true);
     commit;" >/dev/null

val "4 odbiorcow zapisanych" "select count(*) from sms_zone_recipients where active" 4
val "telefon PL bez kierunkowego" "select phone_national from sms_zone_recipients where list_key='LOAD_SREM' and slot=1" "601111222"

L=$(sys "select id from loads limit 1")
sys "select sms_zone_enqueue_for_event('$L','LOAD_SREM','ZONE_APPROACH','Srem',null)" >/dev/null
val "2 SMS APPROACH dla LOAD_SREM" "select count(*) from sms_outbox where kind='ZONE_APPROACH' and load_id='$L'" 2
sys "select sms_zone_enqueue_for_event('$L','LOAD_SREM','ZONE_APPROACH','Srem',null)" >/dev/null
val "dedup — nadal 2 SMS APPROACH" "select count(*) from sms_outbox where kind='ZONE_APPROACH' and load_id='$L'" 2

sys "begin; select set_config('request.jwt.claim.sub','$HHL',true); set local role authenticated;
     select admin_sms_zone_trigger_set('SMS_ZONE_APPROACH', false); commit;" >/dev/null
sys "delete from sms_outbox where kind='ZONE_APPROACH' and load_id='$L'" >/dev/null
sys "select sms_zone_enqueue_for_event('$L','LOAD_SREM','ZONE_APPROACH','Srem',null)" >/dev/null
val "wylaczony wyzwalacz = 0 SMS" "select count(*) from sms_outbox where kind='ZONE_APPROACH' and load_id='$L'" 0
sys "begin; select set_config('request.jwt.claim.sub','$HHL',true); set local role authenticated;
     select admin_sms_zone_trigger_set('SMS_ZONE_APPROACH', true); commit;" >/dev/null

BODY=$(sys "select body from sms_outbox where kind='ZONE_ENTER' limit 1")
# body moze byc puste — sprawdzamy strip na renderze
val "render ZONE_ENTER bez ogonkow" "select sms_render('ZONE_ENTER','pl','{\"rej\":\"ABC\",\"wysylka\":\"SG-01\",\"miejsce\":\"zaladunek Srem\"}'::jsonb) !~ '[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]'" t

echo; echo "WYNIK: $ok OK, $fail FAIL"
[ "$fail" -eq 0 ]
