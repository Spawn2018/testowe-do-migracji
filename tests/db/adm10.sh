#!/usr/bin/env bash
# ADM-10 — „Działaj jako” (0117): start/stop, current_* vs real_*, audit acting_as.
. "$(git rev-parse --show-toplevel)/tests/db/refuse-prod.sh"
PSQL="psql ${PGURL:-postgres://postgres@localhost:5433/tower} -Atq"
HHL=11111111-0000-0000-0000-000000000001
KSH=11111111-0000-0000-0000-000000000002
ok=0; fail=0
sys() { $PSQL -v ON_ERROR_STOP=1 -c "$1" 2>&1; }
val() {
  out=$(sys "$2" | grep -v -E '^(BEGIN|SET|ROLLBACK|COMMIT)$' | tail -1 | tr -d '\r')
  exp=$(printf '%s' "$3" | tr -d '\r')
  if [ "$out" = "$exp" ] || echo "$out" | grep -qE "^($exp)$"; then ok=$((ok+1)); echo "  OK    $1"; else fail=$((fail+1)); echo "  FAIL  $1 (otrzymano: $out, oczekiwano: $exp)"; fi
}
err() {
  out=$(sys "$2")
  if echo "$out" | grep -qiE "$3"; then ok=$((ok+1)); echo "  OK    $1"; else fail=$((fail+1)); echo "  FAIL  $1 → $(echo "$out" | tail -1)"; fi
}

KSHID=$(sys "select id from app_users where auth_id='$KSH'" | tr -d '\r')
HHLID=$(sys "select id from app_users where auth_id='$HHL'" | tr -d '\r')

echo; echo "[adm10] impersonacja"
sys "begin; select set_config('request.jwt.claim.sub','$HHL',true); set local role authenticated;
     select admin_impersonate_start('$KSHID'::uuid); commit;" >/dev/null

val "current_role = rola KSH" \
  "begin; select set_config('request.jwt.claim.sub','$HHL',true); set local role authenticated;
   select current_app_role()::text; rollback;" \
  "CLIENT_USER|CLIENT_ADMIN"

val "current_user = KSH" \
  "begin; select set_config('request.jwt.claim.sub','$HHL',true); set local role authenticated;
   select current_app_user_id()::text; rollback;" \
  "$KSHID"

val "real_user = HHL" \
  "begin; select set_config('request.jwt.claim.sub','$HHL',true); set local role authenticated;
   select real_app_user_id()::text; rollback;" \
  "$HHLID"

val "my_profile.acting_as" \
  "begin; select set_config('request.jwt.claim.sub','$HHL',true); set local role authenticated;
   select acting_as::text from my_profile(); rollback;" \
  "true"

# INSERT jako właściciel tabeli (RLS: authenticated nie ma INSERT na audit_log);
# JWT ustawione → wyzwalacz widzi impersonację.
sys "begin; select set_config('request.jwt.claim.sub','$HHL',true);
     insert into audit_log (user_id, action, entity, entity_id)
     values ('$KSHID'::uuid, 'ADM10_PROBE', 'test', 'x');
     commit;" >/dev/null
val "audit admin|acting_as" \
  "select user_id::text || '|' || coalesce(acting_as_user_id::text,'x') from audit_log where action='ADM10_PROBE' order by id desc limit 1" \
  "${HHLID}|${KSHID}"

sys "begin; select set_config('request.jwt.claim.sub','$HHL',true); set local role authenticated;
     select admin_impersonate_stop(); commit;" >/dev/null

val "po stop role HHL_ADMIN" \
  "begin; select set_config('request.jwt.claim.sub','$HHL',true); set local role authenticated;
   select current_app_role()::text; rollback;" \
  "HHL_ADMIN"

val "po stop acting_as = f" \
  "begin; select set_config('request.jwt.claim.sub','$HHL',true); set local role authenticated;
   select acting_as::text from my_profile(); rollback;" \
  "false"

err "KSH nie startuje" \
  "begin; select set_config('request.jwt.claim.sub','$KSH',true); set local role authenticated;
   select admin_impersonate_start('$HHLID'::uuid); rollback;" \
  "Tylko administrator HHL|administrator"

echo; echo "WYNIK: $ok OK, $fail FAIL"
[ "$fail" -eq 0 ]
