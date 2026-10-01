#!/usr/bin/env bash
# DEC-6 — progi ops_thresholds + admin_ops_threshold_set + audit.
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
val "10 progów domyślnych" "select count(*) from ops_thresholds" 10
val "fala 3.8" "select value_num::text from ops_thresholds where key='WAVE_M'" "3.8"
val "porywy 40" "select value_num::text from ops_thresholds where key='GUST_KN'" "40"
val "silent 15" "select value_num::text from ops_thresholds where key='SILENT_MIN'" "15"

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

echo; echo "WYNIK: $ok OK, $fail FAIL"
[ "$fail" -eq 0 ]
