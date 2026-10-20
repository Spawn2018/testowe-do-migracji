#!/usr/bin/env bash
# C3 — macierz po zdarzeniu, czat (Cz13/Cz25), KSH bez stref i „Brak CMR” (D-20261016-1750 pkt 3.5).
set -e
ADMIN=${PGADMIN:-postgres://postgres@localhost:5433/postgres}
. "$(git rev-parse --show-toplevel)/tests/db/local-only.sh"
if [ "${TOWER_HOSTED_READY:-}" = "1" ]; then URL="$ADMIN"
else
  DB=tower_test_c3; URL="${ADMIN%/*}/$DB"
  psql "$ADMIN" -q -c "drop database if exists $DB" -c "create database $DB"
  psql "$URL" -q -v ON_ERROR_STOP=1 -f tests/db/supabase_stub.sql
  for f in supabase/migrations/*.sql; do psql "$URL" -q -v ON_ERROR_STOP=1 -f "$f" >/dev/null 2>&1 || { echo "MIGRACJA $f"; exit 1; }; done
  psql "$URL" -q -v ON_ERROR_STOP=1 -f tests/db/seed.sql
fi
set +e
PSQL="psql $URL -Atq"
HHL=11111111-0000-0000-0000-000000000001
KSH=11111111-0000-0000-0000-000000000002
SCX=11111111-0000-0000-0000-000000000003
P=22222222-0000-0000-0000-000000000001
L=33333333-0000-0000-0000-000000000001
ok=0; fail=0
run() { local end="rollback"; [ "$3" = "commit" ] && end="commit"
  $PSQL -v ON_ERROR_STOP=1 -c "begin; set local role authenticated; set local request.jwt.claim.sub='$1'; $2; $end;" 2>&1; }
val() { out=$(run "$2" "$3" "$5" | grep -v -E '^(BEGIN|SET|ROLLBACK|COMMIT)$' | tail -1 | tr -d '\r')
  if [ "$out" = "$4" ]; then ok=$((ok+1)); echo "  OK    $1"; else fail=$((fail+1)); echo "  FAIL  $1  (otrzymano: $out, oczekiwano: $4)"; fi; }
err() { out=$(run "$2" "$3"); if echo "$out" | grep -qiE "$4"; then ok=$((ok+1)); echo "  OK    $1"; else fail=$((fail+1)); echo "  FAIL  $1  →  $(echo "$out" | tail -1)"; fi; }
sys() { $PSQL -v ON_ERROR_STOP=1 -c "$1" 2>&1; }
sval() { out=$(sys "$2" | tail -1 | tr -d '\r'); if [ "$out" = "$3" ]; then ok=$((ok+1)); echo "  OK    $1"; else fail=$((fail+1)); echo "  FAIL  $1  (otrzymano: $out, oczekiwano: $3)"; fi; }

echo; echo "[C3] macierz po zdarzeniu"
sval "26 zdarzeń w katalogu" "select count(distinct event_key) from notification_matrix" 26
sval "czat: 5 ról, telefon, bez e-maila" "select count(*) from notification_matrix where event_key='chat' and in_app and push and email is false" 5
sval "W39 status HHL_ADMIN bez e-maila" "select email::text from notification_matrix where event_key='status' and role='HHL_ADMIN'" false
sval "strefa KSH wyłączona" "select in_app::text from notification_matrix where event_key='zone' and role='CLIENT_USER'" false
sval "Brak CMR KSH wyłączony" "select in_app::text from notification_matrix where event_key='cmr' and role='CLIENT_USER'" false
sval "treści po polsku (C3+C3-p + EMAIL_BUDGET)" "select count(*) from notification_copy" 9
sval "sytuacja ogólna tylko Ryzyka" "select bool_and(risks_only)::text from notification_matrix where event_key='risk_general'" true
sval "50 km plac i Śrem osobno" "select count(distinct event_key) from notification_matrix where event_key in ('pre_arrival_site','pre_arrival_srem')" 2
sval "źródło down/back osobno" "select count(distinct event_key) from notification_matrix where event_key in ('src_down','src_back')" 2
sval "kopia macierzy w audit_log" "select count(*) > 0 from audit_log where action='C3_MATRIX_KOPIA'" t
sval "bez AUTOMATIC_DECISION_EMAIL" "select count(*) from security_flags where key='AUTOMATIC_DECISION_EMAIL'" 0

HHLU=$(sys "select id from app_users where auth_id='$HHL'" | tail -1 | tr -d '\r')
KSHU=$(sys "select id from app_users where auth_id='$KSH'" | tail -1 | tr -d '\r')
SCXU=$(sys "select id from app_users where auth_id='$SCX'" | tail -1 | tr -d '\r')

# C3-p pkt 5: e-mail decyzji tylko z wiersza dec_new (wyłączony → 0; włączony → e-mail).
sys "update notification_matrix set email=false where event_key='dec_new'" >/dev/null
sys "delete from notifications where channel='EMAIL' and dedup_key like 'dec:OPEN:%'" >/dev/null
DEC_C3=$(sys "select public.decision_open_from_event('$P','FERRY_CANCELLED','c3p-dec-mail','C3-p dec mail','{\"bundle_key\":\"c3p-dec\"}'::jsonb,'$L',null)" | tail -1 | tr -d '\r')
sval "dec_new email off → 0 e-maili" "select count(*) from notifications where channel='EMAIL' and payload->>'decision_id' = '$DEC_C3'" 0
run "$HHL" "select admin_notification_matrix_set('dec_new','HHL_ADMIN',true,true,false)" commit >/dev/null
sys "select public.l13_decision_email('$DEC_C3'::uuid)" >/dev/null
# krytyczne idą pod dedup_key bundle:… (nie dec:OPEN:…); identyfikacja po decision_id w payload
sval "dec_new email on → e-mail" "select (count(*) > 0)::text from notifications where channel='EMAIL' and payload->>'decision_id' = '$DEC_C3'" true
sys "update notification_matrix set email=false where event_key='dec_new'" >/dev/null


sys "select admin_notification_matrix_set('zone','CLIENT_USER',true,true,true)" >/dev/null || true
# ustawienie macierzy jako administrator
run "$HHL" "select admin_notification_matrix_set('zone','CLIENT_USER',true,true,true)" commit >/dev/null
sys "select public.matrix_notify('LOAD_STATUS','ZONE_ENTER','$L','$P','{}'::jsonb,'c3-zone-1', null)" >/dev/null
sval "strefa: HHL dostaje" "select count(*) > 0 from notifications where template='ZONE_ENTER' and user_id='$HHLU' and dedup_key like 'c3-zone-1:%'" t
sval "strefa: KSH nic, choć macierz włączona" "select count(*) from notifications where template='ZONE_ENTER' and user_id='$KSHU' and dedup_key like 'c3-zone-1:%'" 0

sys "insert into risk_signals (project_id, load_id, kind, severity, title, title_key, detail, dedup_key)
  values ('$P','$L','DOC_MISSING','HIGH','Brak CMR','rk_cmr', '{}'::jsonb, 'c3-cmr-'||gen_random_uuid()::text)" >/dev/null
sval "Brak CMR: HHL" "select count(*) > 0 from notifications where template='RISK_OPEN' and user_id='$HHLU' and payload->>'kind'='DOC_MISSING'" t
sval "Brak CMR: KSH nic" "select count(*) from notifications where template='RISK_OPEN' and user_id='$KSHU' and payload->>'kind'='DOC_MISSING'" 0

# C3-p: subskrypcja push dla SCX — żeby powstał WEB_PUSH czatu (bez critical).
sys "insert into push_subscriptions (user_id, endpoint, p256dh, auth)
  values ('$SCXU', 'https://example.test/c3p-push', 'dGVzdA', 'dGVzdA')
  on conflict (endpoint) do nothing" >/dev/null
sys "insert into load_messages (load_id, author_id, body, visible_to)
  values ('$L','$HHLU','tylko hhl i scx','{FORWARDER,CARRIER}')" >/dev/null
sval "czat HHL+SCX: KSH nic" "select count(*) from notifications n join load_messages m on n.dedup_key like 'CHAT:'||m.id::text||':%' where m.body='tylko hhl i scx' and n.user_id='$KSHU'" 0
sval "czat HHL+SCX: SCX dostaje, autor HHL nie" "select (count(*) filter (where n.user_id='$SCXU'))::text||'/'||(count(*) filter (where n.user_id='$HHLU'))::text from notifications n join load_messages m on n.dedup_key like 'CHAT:'||m.id::text||':%' where m.body='tylko hhl i scx' and n.channel='IN_APP'" "1/0"
# C3-p: czat bez critical (bez e-maila zapasowego); tytuł i treść, nie kod LOAD_CHAT_MESSAGE
sval "czat IN_APP title i body" "select (bool_and(n.payload->>'title' is not null and n.payload->>'body' = 'tylko hhl i scx' and position('LOAD_CHAT_MESSAGE' in coalesce(n.payload->>'title','')) = 0))::text from notifications n join load_messages m on n.dedup_key like 'CHAT:'||m.id::text||':%' where m.body='tylko hhl i scx' and n.channel='IN_APP' and n.user_id='$SCXU'" true
sval "czat WEB_PUSH bez critical" "select (count(*) > 0 and bool_and(coalesce(n.payload->>'critical','') is distinct from 'true'))::text from notifications n join load_messages m on n.dedup_key like 'CHAT:'||m.id::text||':%' where m.body='tylko hhl i scx' and n.channel='WEB_PUSH' and n.user_id='$SCXU'" true
# fallback: ustaw SENT bez delivered_at, jak po 5 min — enqueue musi zwrócić false
sys "update notifications n set status='SENT', sent_at=now()-interval '6 minutes', delivered_at=null, payload=n.payload||'{\"critical\":\"true\"}'::jsonb from load_messages m where n.dedup_key like 'CHAT:'||m.id::text||':WP:%' and m.body='tylko hhl i scx' and n.channel='WEB_PUSH'" >/dev/null
sval "czat: enqueue_fallback odmawia" "select public.web_push_enqueue_fallback(n.id)::text from notifications n join load_messages m on n.dedup_key like 'CHAT:'||m.id::text||':WP:%' where m.body='tylko hhl i scx' and n.channel='WEB_PUSH' limit 1" false

# C3-p: ZONE_ENTER PRE_ARRIVAL → wiersz 50 km przed placem (nie „Strefy”)
sys "select public.matrix_notify('LOAD_STATUS','ZONE_ENTER','$L','$P', jsonb_build_object('geofence_kind','PRE_ARRIVAL','geofence_country','SE','geofence_name','Bufor 50 km przed Boden'), 'c3p-site-1', null)" >/dev/null
sval "50 km plac: matrix_event" "select payload->>'matrix_event' from notifications where dedup_key like 'c3p-site-1:IN:%' limit 1" pre_arrival_site
sys "select public.matrix_notify('LOAD_STATUS','ZONE_ENTER','$L','$P', jsonb_build_object('geofence_kind','PRE_ARRIVAL','geofence_country','PL','geofence_name','Bufor przed Sremem'), 'c3p-srem-1', null)" >/dev/null
sval "50 km Śrem: matrix_event" "select payload->>'matrix_event' from notifications where dedup_key like 'c3p-srem-1:IN:%' limit 1" pre_arrival_srem

run "$KSH" "select my_notify_set('status','mail',false)" commit >/dev/null
sval "osoba KSH: e-mail statusu wyłączony, było puste" "select (p.on_value is false)::text||'/'||(a.old_value->>'on' is null)::text from user_notify_pref p join audit_log a on a.entity='user_notify_pref' and a.user_id=p.user_id where p.user_id='$KSHU' and p.event_key='status' and p.channel='mail' order by a.id desc limit 1" "true/true"
err "kanał zawsze: src_down mail" $HHL "select my_notify_set('src_down','mail',false)" "zawsze"

echo; echo "WYNIK: $ok OK, $fail FAIL"
[ "$fail" -eq 0 ]
