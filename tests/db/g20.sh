#!/usr/bin/env bash
# D-20261014-0015-01 R1 — G-20: daty planu tylko KSH / import / system (nie HHL PATCH, nie SCX).
. "$(git rev-parse --show-toplevel)/tests/db/refuse-prod.sh"
PSQL="psql ${PGURL:-postgres://postgres@localhost:5433/tower} -Atq"
HHL=11111111-0000-0000-0000-000000000001
KSH=11111111-0000-0000-0000-000000000002
SCX=11111111-0000-0000-0000-000000000003
OPS=11111111-0000-0000-0000-0000000000a1
CU=11111111-0000-0000-0000-0000000000a2
# L2 — bez faktury (L1 jest na fakturze → import dat zablokowany)
L2=33333333-0000-0000-0000-000000000002
P=22222222-0000-0000-0000-000000000001
ok=0; fail=0
run() { local end="rollback"; [ "$3" = "commit" ] && end="commit"
  $PSQL -v ON_ERROR_STOP=1 -c "begin; set local role authenticated; set local request.jwt.claim.sub='$1'; $2; $end;" 2>&1; }
val()  { out=$(run "$2" "$3" "$5" | grep -v -E '^(BEGIN|SET|ROLLBACK|COMMIT)$' | tail -1 | tr -d '\r')
         if [ "$out" = "$4" ]; then ok=$((ok+1)); echo "  OK    $1"; else fail=$((fail+1)); echo "  FAIL  $1  (otrzymano: $out, oczekiwano: $4)"; fi; }
err()  { out=$(run "$2" "$3"); if echo "$out" | grep -qiE "$4"; then ok=$((ok+1)); echo "  OK    $1"; else fail=$((fail+1)); echo "  FAIL  $1  →  $(echo "$out" | tail -1)"; fi; }
sys()  { $PSQL -v ON_ERROR_STOP=1 -c "$1" 2>&1; }
sval() { out=$(sys "$2" | tail -1 | tr -d '\r'); if [ "$out" = "$3" ]; then ok=$((ok+1)); echo "  OK    $1"; else fail=$((fail+1)); echo "  FAIL  $1  (otrzymano: $out, oczekiwano: $3)"; fi; }

HHLORG=$(sys "select org_id from app_users where auth_id='$HHL'" | tr -d '\r')
SCXORG=$(sys "select org_id from app_users where auth_id='$SCX'" | tr -d '\r')
KSHID=$(sys "select id from app_users where auth_id='$KSH'" | tr -d '\r')

sys "insert into app_users (auth_id, org_id, email, role, active)
     values ('$OPS','$HHLORG','ops-g20@test','HHL_OPS',true)
     on conflict (auth_id) do update set role='HHL_OPS', active=true, org_id=excluded.org_id" >/dev/null
sys "insert into app_users (auth_id, org_id, email, role, active)
     values ('$CU','$SCXORG','cu-g20@test','CARRIER_USER',true)
     on conflict (auth_id) do update set role='CARRIER_USER', active=true, org_id=excluded.org_id" >/dev/null

sys "update loads set plan_load_date='2026-12-01', plan_delivery_date='2026-12-05',
       plan_load_from='2026-12-01 07:00+01', plan_load_to='2026-12-01 15:00+01',
       plan_delivery_from='2026-12-05 07:00+01', plan_delivery_to='2026-12-05 15:00+01',
       status='PLANNED', carrier_org_id='$SCXORG'
     where id='$L2'" >/dev/null

echo; echo "[g20] HHL_ADMIN może daty (0234); HHL_OPS / SCX nadal odmowa"
val "HHL_ADMIN zmieni plan_load_date (0234)" $HHL "with u as (update loads set plan_load_date='2026-12-02' where id='$L2' returning plan_load_date) select plan_load_date::text from u" "2026-12-02" commit
val "HHL_ADMIN zmieni plan_load_from (0234)" $HHL "with u as (update loads set plan_load_from='2026-12-01 08:00+01' where id='$L2' returning 1) select count(*) from u" 1 commit
err "HHL_OPS nie zmieni plan_delivery_date" $OPS "update loads set plan_delivery_date='2026-12-06' where id='$L2'" "KSH Użytkownik|G-20"
err "CARRIER_DISPATCH nie zmieni plan_load_date" $SCX "update loads set plan_load_date='2026-12-09' where id='$L2'" "nie może zmieniać|Przewoźnik"
err "CARRIER_USER nie zmieni plan_delivery_to" $CU "update loads set plan_delivery_to='2026-12-05 16:00+01' where id='$L2'" "nie może zmieniać|Przewoźnik|Brak uprawnień"
val "HHL nadal zmienia hhl_order_no" $HHL "with u as (update loads set hhl_order_no='HHL/G20' where id='$L2' returning 1) select count(*) from u" 1

echo; echo "[g20] KSH i Działaj jako"
val "ksh_confirm_dates przez CLIENT_USER" $KSH "select (ksh_confirm_dates('$L2','2026-12-03','2026-12-07')->>'changed')" true commit
sval "daty po KSH" "select plan_load_date||'|'||plan_delivery_date from loads where id='$L2'" "2026-12-03|2026-12-07"
sval "Historia PLAN_DATES_CHANGED z by=KSH" "select count(*) from load_events where load_id='$L2' and event_type='PLAN_DATES_CHANGED' and payload->>'by'='KSH'" "1"

sys "begin; select set_config('request.jwt.claim.sub','$HHL',true); set local role authenticated;
     select admin_impersonate_start('$KSHID'::uuid); commit;" >/dev/null
val "Działaj jako KSH: ksh_confirm_dates przyjęte" $HHL "select (ksh_confirm_dates('$L2','2026-12-04','2026-12-08')->>'changed')" true commit
sval "po impersonacji daty 04/08" "select plan_load_date||'|'||plan_delivery_date from loads where id='$L2'" "2026-12-04|2026-12-08"
sys "begin; select set_config('request.jwt.claim.sub','$HHL',true); set local role authenticated;
     select admin_impersonate_stop(); commit;" >/dev/null

echo; echo "[g20] import_schedule — kontekst i zmiana daty"
sval "import_schedule ustawia tower.import_ctx" "select (prosrc like '%tower.import_ctx%')::text from pg_proc where proname='import_schedule_impl' and pronargs=6" "true"
# A6 N9: zaległy pending (np. po ksh_confirm_dates przy write_enabled) blokuje daty z pliku —
# ten test sprawdza sam import, nie konflikt z kolejką zapisu.
sys "delete from ksh_sync_outbound where load_id='$L2'" >/dev/null
sys "delete from shipment_items where shipment_code='SG-G20'" >/dev/null
sys "insert into shipment_items (project_id, load_id, shipment_code, cargo_class, length_m, width_m, height_m, qty, total_weight_t, schedule_row)
     values ('$P','$L2','SG-G20','DIMENSIONED',10,2.5,2.5,1,10,
       '{\"code\":\"SG-G20\",\"item_type\":\"x\",\"cargo_class\":\"DIMENSIONED\",\"length_m\":10,\"width_m\":2.5,\"height_m\":2.5,\"qty\":1,\"total_weight_t\":10,\"load_date\":\"2026-12-04\",\"delivery_date\":\"2026-12-08\"}'::jsonb)" >/dev/null
ROW='[{"code":"SG-G20","item_type":"x","cargo_class":"DIMENSIONED","length_m":10,"width_m":2.5,"height_m":2.5,"qty":1,"total_weight_t":10,"load_date":"2026-12-10","delivery_date":"2026-12-14"}]'
val "import zmienia datę L2" $HHL "select (jsonb_array_length(import_schedule('$P', '$ROW'::jsonb, '{}'::text[], '{\"name\":\"g20.xlsx\",\"hash\":\"g20\",\"path\":\"x/g20.xlsx\"}'::jsonb, false)->'changed') > 0)::text" true commit
sval "po imporcie plan_load_date=2026-12-10" "select plan_load_date::text from loads where id='$L2'" "2026-12-10"

echo; echo "[g20] macierz DECISION × CLIENT_USER push=false"
sval "DECISION CLIENT_USER push=false" "select push::text from notification_matrix where event_group='DECISION' and role='CLIENT_USER'" "false"

echo; echo "WYNIK: $ok OK, $fail FAIL"
[ "$fail" -eq 0 ]
