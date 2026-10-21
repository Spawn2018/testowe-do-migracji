#!/usr/bin/env bash
# DEC-6 — progi ops_thresholds + admin_ops_threshold_set + audit + Auth log + baner.
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

echo; echo "[dec6] progi ops_thresholds"
# B7 / E15 (D-0300): +4 progi ETA/ciszy; SILENT_MIN 15 → 30
# #356: +1 import_quiet_hours (D-20261020-1157-01)
# #398: +SILENT_MIN_EMTRACK (720)
val "23 progów domyślnych (10 + 7 postój + 4 E15 + import_quiet_hours + SILENT_MIN_EMTRACK)" "select count(*) from ops_thresholds" 23
val "fala 3.8" "select value_num::text from ops_thresholds where key='WAVE_M'" "3.8"
val "porywy 40" "select value_num::text from ops_thresholds where key='GUST_KN'" "40"
val "silent 30 (E15 / B7)" "select value_num::text from ops_thresholds where key='SILENT_MIN'" "30"
val "ETA_CONF_HIGH_MIN 30" "select value_num::text from ops_thresholds where key='ETA_CONF_HIGH_MIN'" "30"
val "ETA_CONF_MED_MIN 120" "select value_num::text from ops_thresholds where key='ETA_CONF_MED_MIN'" "120"

sys "begin; select set_config('request.jwt.claim.sub','$HHL',true); set local role authenticated;
     select admin_ops_threshold_set('DELAY_MIN', 45); commit;" >/dev/null
val "DELAY_MIN=45 po RPC" "select value_num::text from ops_thresholds where key='DELAY_MIN'" "45"
val "audit OPS_THRESHOLD_SET" "select count(*)>0 from audit_log where action='OPS_THRESHOLD_SET' and entity_id='DELAY_MIN'" t

err "wartość 0 odrzucona" "begin; select set_config('request.jwt.claim.sub','$HHL',true); set local role authenticated;
     select admin_ops_threshold_set('WAVE_M', 0); rollback;" "musi być > 0|Wartość progu"
err "nieznany klucz" "begin; select set_config('request.jwt.claim.sub','$HHL',true); set local role authenticated;
     select admin_ops_threshold_set('NOPE', 1); rollback;" "Nieznany próg"

# przywróć 30
sys "begin; select set_config('request.jwt.claim.sub','$HHL',true); set local role authenticated;
     select admin_ops_threshold_set('DELAY_MIN', 30); commit;" >/dev/null

echo; echo "[dec6] Auth login log + baner"
val "funkcja admin_auth_login_log istnieje" "select count(*)>0 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='admin_auth_login_log'" t
sys "begin; select set_config('request.jwt.claim.sub','$HHL',true); set local role authenticated;
     select count(*) from admin_auth_login_log(5); commit;" >/dev/null
ok=$((ok+1)); echo "  OK    admin_auth_login_log wywołanie HHL"

echo; echo "[dec6] B-6e dziennik logowań z auth_login_events (0164)"
val "wyzwalacz na auth.sessions" "select count(*) from pg_trigger where tgname='tower_on_auth_session_created' and tgrelid='auth.sessions'::regclass" 1
# Hosted TEST: auth.sessions → auth.users (FK). Kont seeda (11111111-…, 99999999-…) nie ma w auth.users
# (w przeciwieństwie do lokalnego supabase_stub). Wstawka pada → 0 w auth_login_events. SKIP asercji
# zależnych od wstawki (P0b, decyzja koordynatora 12.10). Wyzwalacz sprawdzany wyżej — bez SKIP.
if [ -n "${TOWER_HOSTED_READY:-}" ]; then
  echo "  SKIP  nowa sesja = wpis w auth_login_events (hosted: FK sessions_user_id_fkey, brak konta seed w auth.users)"
  echo "  SKIP  wpis ma e-mail z app_users i IP (hosted: j.w. — wstawka sesji niemożliwa)"
  echo "  SKIP  HHL_ADMIN widzi logowanie w dzienniku (hosted: j.w. — brak wpisu z wstawki)"
else
  sys "insert into auth.sessions (id, user_id, created_at, user_agent, ip) values ('55555555-0000-0000-0000-0000000000e1', '$HHL', now() - interval '1 minute', 'Mozilla/5.0 (Windows NT 10.0) Chrome/129', '203.0.113.7')" >/dev/null
  val "nowa sesja = wpis w auth_login_events" "select count(*) from auth_login_events where session_id='55555555-0000-0000-0000-0000000000e1'" 1
  val "wpis ma e-mail z app_users i IP" "select email||' '||ip from auth_login_events where session_id='55555555-0000-0000-0000-0000000000e1'" "hhl@test 203.0.113.7"
  val "HHL_ADMIN widzi logowanie w dzienniku" "begin; select set_config('request.jwt.claim.sub','$HHL',true); set local role authenticated;
       select email||'|'||ip_address||'|'||log_type||'|'||(user_agent like '%Chrome%')::text from admin_auth_login_log(5) limit 1; rollback;" "hhl@test|203.0.113.7|SESSION|true"
fi
err "KSH nie widzi dziennika" "begin; select set_config('request.jwt.claim.sub','11111111-0000-0000-0000-000000000002',true); set local role authenticated;
     select count(*) from admin_auth_login_log(5); rollback;" "Tylko administrator HHL"
err "tabela bez dostępu dla authenticated" "begin; select set_config('request.jwt.claim.sub','$HHL',true); set local role authenticated;
     select count(*) from auth_login_events; rollback;" "permission denied"
val "funkcja wyzwalacza bez EXECUTE dla authenticated" "select has_function_privilege('authenticated','public.tower_log_auth_session()','EXECUTE')" f
if [ -n "${TOWER_HOSTED_READY:-}" ]; then
  echo "  SKIP  nieznane konto nie blokuje sesji (hosted: FK sessions_user_id_fkey, brak 99999999-… w auth.users)"
else
  sys "insert into auth.sessions (id, user_id) values ('55555555-0000-0000-0000-0000000000e2', '99999999-0000-0000-0000-000000000009')" >/dev/null
  val "nieznane konto nie blokuje sesji" "select count(*) from auth.sessions where id='55555555-0000-0000-0000-0000000000e2'" 1
fi

sys "begin; select set_config('request.jwt.claim.sub','$HHL',true); set local role authenticated;
     select admin_broadcast_set('Test DEC-6', now() + interval '2 hours', true, true, false); commit;" >/dev/null
val "baner aktywny" "select count(*) from system_broadcast where cleared_at is null and expires_at > now()" 1
val "audit BROADCAST_SET" "select count(*)>0 from audit_log where action='BROADCAST_SET'" t

sys "begin; select set_config('request.jwt.claim.sub','$HHL',true); set local role authenticated;
     select count(*) from system_broadcast_current(); commit;" >/dev/null
ok=$((ok+1)); echo "  OK    system_broadcast_current HHL"

err "baner bez firm" "begin; select set_config('request.jwt.claim.sub','$HHL',true); set local role authenticated;
     select admin_broadcast_set('x', now() + interval '1 hour', false, false, false); rollback;" "co najmniej jedną firmę"

sys "begin; select set_config('request.jwt.claim.sub','$HHL',true); set local role authenticated;
     select admin_broadcast_clear(); commit;" >/dev/null
val "baner wycofany" "select count(*) from system_broadcast where cleared_at is null and expires_at > now()" 0

echo; echo "WYNIK: $ok OK, $fail FAIL"
[ "$fail" -eq 0 ]
