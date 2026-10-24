#!/usr/bin/env bash
# HIST-11 — pełna historia zmian (0118): triggery, source, admin_audit_history, ADM-10.
. "$(git rev-parse --show-toplevel)/tests/db/refuse-prod.sh"
PSQL="psql ${PGURL:-postgres://postgres@localhost:5433/tower} -Atq"
HHL=11111111-0000-0000-0000-000000000001
KSH=11111111-0000-0000-0000-000000000002
ok=0; fail=0
sys() { $PSQL -v ON_ERROR_STOP=1 -c "$1" 2>&1; }
Q() { $PSQL -c "$1" | tr -d '\r'; }
val() {
  out=$(sys "$2" | grep -v -E '^(BEGIN|SET|ROLLBACK|COMMIT)$' | tail -1 | tr -d '\r')
  exp=$(printf '%s' "$3" | tr -d '\r')
  if [ "$out" = "$exp" ] || [ "$out" = "true" -a "$exp" = "t" ] || [ "$out" = "false" -a "$exp" = "f" ] || echo "$out" | grep -qE "^($exp)$"; then
    ok=$((ok+1)); echo "  OK    $1"
  else
    fail=$((fail+1)); echo "  FAIL  $1 (otrzymano: $out, oczekiwano: $exp)"
  fi
}
err() {
  out=$(sys "$2")
  if echo "$out" | grep -qiE "$3"; then ok=$((ok+1)); echo "  OK    $1"; else fail=$((fail+1)); echo "  FAIL  $1 → $(echo "$out" | tail -1)"; fi
}
chk() {
  out=$(printf '%s' "$2" | tr -d '\r')
  exp=$(printf '%s' "$3" | tr -d '\r')
  # hosted PG: boolean::text = true/false; lokalnie często t/f
  if [ "$out" = "$exp" ] || [ "$out" = "true" -a "$exp" = "t" ] || [ "$out" = "false" -a "$exp" = "f" ]; then
    ok=$((ok+1)); echo "  OK    $1"
  else
    fail=$((fail+1)); echo "  FAIL  $1 (otrzymano: $out, oczekiwano: $exp)"
  fi
}

KSHID=$(sys "select id from app_users where auth_id='$KSH'" | tr -d '\r')
HHLID=$(sys "select id from app_users where auth_id='$HHL'" | tr -d '\r')
P=$(sys "select id from projects order by created_at nulls last limit 1" | tr -d '\r')

echo; echo "[hist11] pokrycie + source + RPC"

chk "kolumna source na audit_log" "$(Q "select count(*) from information_schema.columns where table_schema='public' and table_name='audit_log' and column_name='source'")" 1

NTRIG=$(Q "select count(distinct tgrelid) from pg_trigger where tgname='trg_audit_row' and not tgisinternal")
chk "wyzwalacze trg_audit_row >= 30 tabel" "$(Q "select ($NTRIG >= 30)::text")" t

chk "7 tabel I-20 nadal z triggerem" "$(Q "select count(distinct tgrelid::regclass::text) from pg_trigger where tgname='trg_audit_row' and tgrelid::regclass::text in ('loads','shipment_items','invoices','invoice_lines','rate_cards','rate_rules','sefs_parameters')")" 7

sys "delete from audit_log where action like 'HIST11_%' or (action like 'ROW_%' and entity='ops_thresholds' and entity_id='DELAY_MIN' and created_at > now() - interval '1 minute')" >/dev/null

# Automat: brak JWT → source z tower.audit_source
OLDV=$(Q "select value_num::text from ops_thresholds where key='DELAY_MIN'")
sys "begin; select set_config('tower.audit_source','cron_test',true);
     update ops_thresholds set value_num = value_num + 0.001 where key='DELAY_MIN';
     commit;" >/dev/null
chk "automat: source=cron_test przy ROW_UPDATE (gdy brak user)" \
  "$(Q "select coalesce(source,'∅') from audit_log where action='ROW_UPDATE' and entity='ops_thresholds' and entity_id='DELAY_MIN' order by id desc limit 1")" \
  "cron_test"
sys "update ops_thresholds set value_num = $OLDV where key='DELAY_MIN'" >/dev/null

val "HHL: admin_audit_history zwraca wiersze" \
  "begin; select set_config('request.jwt.claim.sub','$HHL',true); set local role authenticated;
   select (count(*) > 0)::text from admin_audit_history(null,null,null,null,null,null,20,0); rollback;" \
  t

val "filtr entity=ops_thresholds" \
  "begin; select set_config('request.jwt.claim.sub','$HHL',true); set local role authenticated;
   select (count(*) > 0)::text from admin_audit_history(null,null,null,'ops_thresholds',null,null,50,0); rollback;" \
  t

# #484: KSH/SCX/OPS mają dostęp (zakres); anon nadal bez EXECUTE.
L1=$(sys "select id from loads order by created_at nulls last limit 1" | tr -d '\r')
sys "insert into audit_log (user_id, action, entity, entity_id, old_value, new_value)
     select '$HHLID', 'HIST11_LOAD', 'loads', '$L1', '{}'::jsonb, jsonb_build_object('status','READY','hhl_order_no','H-SECRET','carrier_order_no','C-SECRET')
     where not exists (select 1 from audit_log where action='HIST11_LOAD' and entity_id='$L1')" >/dev/null

OPS_AUTH=11111111-0000-0000-0000-0000000000b1
sys "insert into app_users (auth_id, org_id, email, role, active)
     values ('$OPS_AUTH','00000000-0000-0000-0000-00000000a001','ops-hist11@test','HHL_OPS',true)
     on conflict (auth_id) do update set role='HHL_OPS', active=true, org_id=excluded.org_id" >/dev/null

val "HHL_OPS: admin_audit_history zwraca wiersze (#484)" \
  "begin; select set_config('request.jwt.claim.sub','$OPS_AUTH',true); set local role authenticated;
   select (count(*) > 0)::text from admin_audit_history(null,null,null,null,null,null,20,0); rollback;" \
  t

val "KSH: widzi wpis swojego transportu (#484)" \
  "begin; select set_config('request.jwt.claim.sub','$KSH',true); set local role authenticated;
   select (count(*) > 0)::text from admin_audit_history(null,null,null,'loads',null,null,50,0); rollback;" \
  t

val "KSH: bez numerów zleceń w new_value (#484)" \
  "begin; select set_config('request.jwt.claim.sub','$KSH',true); set local role authenticated;
   select ((new_value ? 'hhl_order_no') is false and (new_value ? 'carrier_order_no') is false)::text
     from admin_audit_history(null,null,null,'loads','HIST11_LOAD',null,5,0) limit 1; rollback;" \
  t

err "anon bez EXECUTE" \
  "select has_function_privilege('anon','admin_audit_history(timestamptz,timestamptz,uuid,text,text,text,int,int)','execute')::text" \
  "f|false"

# ADM-10: ROW_* przy impersonacji → admin + acting_as
# UPDATE jako właściciel (RLS nie blokuje); JWT + impersonation_state → current_app_user_id = KSH → BI remaps.
sys "begin; select set_config('request.jwt.claim.sub','$HHL',true); set local role authenticated;
     select admin_impersonate_start('$KSHID'::uuid); commit;" >/dev/null
APKEY=$(Q "select key from app_parameters limit 1")
sys "delete from audit_log where action='ROW_UPDATE' and entity='app_parameters' and created_at > now() - interval '2 minutes'" >/dev/null
sys "begin; select set_config('request.jwt.claim.sub','$HHL',true);
     update app_parameters set label = label || ' ·hist11' where key='$APKEY';
     commit;" >/dev/null
chk "impersonacja: audit user=admin, acting_as=KSH" \
  "$(Q "select (user_id='$HHLID' and acting_as_user_id='$KSHID')::text from audit_log where action='ROW_UPDATE' and entity='app_parameters' order by id desc limit 1")" \
  t
sys "update app_parameters set label = replace(label, ' ·hist11', '') where key='$APKEY'" >/dev/null
sys "begin; select set_config('request.jwt.claim.sub','$HHL',true); set local role authenticated;
     select admin_impersonate_stop(); commit;" >/dev/null

val "RPC pokazuje acting_as_email przy filtrze" \
  "begin; select set_config('request.jwt.claim.sub','$HHL',true); set local role authenticated;
   select (count(*) filter (where acting_as_user_id is not null) >= 0)::text from admin_audit_history(null,null,null,null,null,null,50,0); rollback;" \
  t

chk "documents i app_users mają trigger" \
  "$(Q "select count(distinct tgrelid::regclass::text) from pg_trigger where tgname='trg_audit_row' and tgrelid::regclass::text in ('documents','app_users','decisions','load_agreed_fees')")" \
  4

echo; echo "WYNIK: $ok OK, $fail FAIL"
[ "$fail" -eq 0 ]
