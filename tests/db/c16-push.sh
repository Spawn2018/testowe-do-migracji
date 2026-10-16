#!/usr/bin/env bash
# C16 N8 — zapas e-mail WEB_PUSH (D-20261015-1955-01 N4 / W42)
. "$(git rev-parse --show-toplevel)/tests/db/refuse-prod.sh"
PSQL="psql ${PGURL:-postgres://postgres@localhost:5433/tower} -Atq"
ok=0; fail=0
sys() { $PSQL -v ON_ERROR_STOP=1 -c "$1" 2>&1; }
val() {
  out=$(sys "$2" | grep -v -E '^(BEGIN|SET|ROLLBACK|COMMIT)$' | tail -1)
  if [ "$out" = "$3" ]; then ok=$((ok+1)); echo "  OK    $1"; else fail=$((fail+1)); echo "  FAIL  $1 (otrzymano: $out, oczekiwano: $3)"; fi
}

HHL=$(sys "select id from app_users where email='hhl@test'" | tail -1)
P=22222222-0000-0000-0000-000000000001
L=33333333-0000-0000-0000-00000000c16a

sys "set session_replication_role=replica;
 delete from notifications where dedup_key like 'c16-%' or dedup_key like 'push_fallback:%';
 delete from load_events where load_id='$L';
 delete from loads where id='$L';
 set session_replication_role=origin;" >/dev/null

sys "insert into loads (id, project_id, carrier_org_id, order_no, hhl_order_no, carrier_order_no, status)
 values ('$L','$P','00000000-0000-0000-0000-00000000a003','KSH/C16','HHL/C16','SCX/C16','PLANNED')" >/dev/null

# 1) ERROR no_sub → wpis zapasowy od razu
sys "insert into notifications (channel, recipient, user_id, load_id, template, payload, dedup_key, status, error)
 values ('WEB_PUSH','hhl@test','$HHL','$L','SCHEDULE_DATE_CRITICAL',
  '{\"title\":\"C16\",\"body\":\"brak urzadzenia\",\"url\":\"/#/transport/SG-99\"}'::jsonb,
  'c16-nosub:$HHL','ERROR','no_sub')" >/dev/null
NID=$(sys "select id from notifications where dedup_key='c16-nosub:$HHL'" | tail -1)
val "no_sub → enqueue fallback" "select public.web_push_enqueue_fallback($NID)::text" true
val "fallback EMAIL istnieje" "select count(*) from notifications where dedup_key='push_fallback:$NID' and channel='EMAIL'" 1
val "drugi przebieg nie dubluje" "select public.web_push_enqueue_fallback($NID)::text" false
val "nadal jeden EMAIL" "select count(*) from notifications where dedup_key='push_fallback:$NID'" 1

# 2) SENT bez delivered_at po 5 min → tick
sys "insert into notifications (channel, recipient, user_id, load_id, template, payload, dedup_key, status, sent_at)
 values ('WEB_PUSH','hhl@test','$HHL','$L','SCHEDULE_DATE_CRITICAL',
  '{\"title\":\"C16\",\"body\":\"po 5 min\",\"url\":\"/\"}'::jsonb,
  'c16-late:$HHL','SENT', now() - interval '6 minutes')" >/dev/null
NID2=$(sys "select id from notifications where dedup_key='c16-late:$HHL'" | tail -1)
val "tick tworzy fallback po 5 min" "select public.web_push_fallback_tick() >= 1" t
val "EMAIL po ticku" "select count(*) from notifications where dedup_key='push_fallback:$NID2' and channel='EMAIL'" 1
val "tick drugi raz nie dubluje" "select count(*) from notifications where dedup_key='push_fallback:$NID2'" 1

# 3) delivered_at blokuje zapas
sys "insert into notifications (channel, recipient, user_id, load_id, template, payload, dedup_key, status, sent_at, delivered_at)
 values ('WEB_PUSH','hhl@test','$HHL','$L','SCHEDULE_DATE_CRITICAL',
  '{\"title\":\"C16\",\"body\":\"doszlo\"}'::jsonb,
  'c16-ack:$HHL','SENT', now() - interval '10 minutes', now() - interval '9 minutes')" >/dev/null
NID3=$(sys "select id from notifications where dedup_key='c16-ack:$HHL'" | tail -1)
val "z delivered_at bez fallbacku" "select public.web_push_enqueue_fallback($NID3)::text" false

# 4) kolumny stanu urządzenia
val "last_ack_at istnieje" "select count(*) from information_schema.columns where table_schema='public' and table_name='push_subscriptions' and column_name='last_ack_at'" 1
val "delivered_at istnieje" "select count(*) from information_schema.columns where table_schema='public' and table_name='notifications' and column_name='delivered_at'" 1

echo "WYNIK: $ok OK, $fail FAIL"
[ "$fail" -eq 0 ]
