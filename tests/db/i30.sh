#!/usr/bin/env bash
# TOWER — I-30: cennik według symbolu / wariantu / konwoju (migracja 0100).
# Stawki WYŁĄCZNIE testowe (zmyślone). Użycie jak inne zestawy hosted.
set -e
ADMIN=${PGADMIN:-postgres://postgres@localhost:5433/postgres}
. "$(git rev-parse --show-toplevel)/tests/db/local-only.sh"
ROOT=$(git rev-parse --show-toplevel)
if [ "${TOWER_HOSTED_READY:-}" = "1" ]; then
  URL="$ADMIN"
else
  DB=tower_test_i30; URL="${ADMIN%/*}/$DB"
  psql "$ADMIN" -q -c "drop database if exists $DB" -c "create database $DB"
  psql "$URL" -q -v ON_ERROR_STOP=1 -f tests/db/supabase_stub.sql
  for f in supabase/migrations/*.sql; do psql "$URL" -q -v ON_ERROR_STOP=1 -f "$f" >/dev/null 2>&1 || { echo "MIGRACJA $f: błąd"; psql "$URL" -q -v ON_ERROR_STOP=1 -f "$f" 2>&1 | tail -3; exit 1; }; done
  psql "$URL" -q -v ON_ERROR_STOP=1 -f tests/db/seed.sql
fi
set +e

PSQL="psql $URL -Atq"
HHL=11111111-0000-0000-0000-000000000001
KSH=11111111-0000-0000-0000-000000000002
P=22222222-0000-0000-0000-000000000001
CAR=00000000-0000-0000-0000-00000000a003
CLI=00000000-0000-0000-0000-00000000a002
ok=0; fail=0
run() { local end="rollback"; [ "$3" = "commit" ] && end="commit"
  $PSQL -v ON_ERROR_STOP=1 -c "begin; set local role ${ROLE:-authenticated}; set local request.jwt.claim.sub='$1'; $2; $end;" 2>&1; }
val() { out=$(run "$2" "$3" "$5" | grep -v -E '^(BEGIN|SET|ROLLBACK|COMMIT)$' | tail -1 | tr -d '\r')
  if [ "$out" = "$4" ]; then ok=$((ok+1)); echo "  OK    $1"; else fail=$((fail+1)); echo "  FAIL  $1  (otrzymano: $out, oczekiwano: $4)"; fi; }
err() { out=$(run "$2" "$3"); if echo "$out" | grep -qiE "$4"; then ok=$((ok+1)); echo "  OK    $1"; else fail=$((fail+1)); echo "  FAIL  $1  →  $(echo "$out" | tail -1)"; fi; }
sys() { $PSQL -v ON_ERROR_STOP=1 -c "$1" >/dev/null 2>&1 || echo "  (sys błąd)"; }

echo; echo "[I-30] shipment_family + SYMBOL rate_match (stawki TESTOWE)"

val "TS≠T" $HHL "select shipment_family('TS-01')||'/'||shipment_family('T-01')" "TS/T"
val "SS≠SG" $HHL "select shipment_family('SS-01')||'/'||shipment_family('SG-32')" "SS/SG"

# Karty SYMBOL (koszt) — stawki zmyślone 101..112; import w jednej transakcji
sys "begin;
  select set_config('tower.cennik_import','on',true);
  select rate_card_import_symbol('$P','COST','$CAR', jsonb_build_object(
    'valid_from','2026-10-01',
    'note','I-30 test',
    'rules', jsonb_build_array(
      jsonb_build_object('cargo_class','SYMBOL','symbol','BS-A','family','BS','length_to',12.5,'width_to',2.45,'height_to',1.3,'weight_to',23,'base_rate',101),
      jsonb_build_object('cargo_class','SYMBOL','symbol','BS-B','family','BS','length_to',14.95,'width_to',2.45,'height_to',1.8,'weight_to',31.1,'base_rate',102),
      jsonb_build_object('cargo_class','SYMBOL','symbol','BS-C','family','BS','length_to',16.5,'width_to',2.45,'height_to',1.8,'weight_to',33.6,'base_rate',103),
      jsonb_build_object('cargo_class','SYMBOL','symbol','KR','family','KR','convoy_cars',3,'length_to',20.2,'width_to',3.52,'height_to',2.6,'weight_to',28.4,'base_rate',104),
      jsonb_build_object('cargo_class','SYMBOL','symbol','KR','family','KR','convoy_cars',2,'length_to',20.2,'width_to',3.52,'height_to',2.6,'weight_to',28.4,'base_rate',105),
      jsonb_build_object('cargo_class','SYMBOL','symbol','KR','family','KR','convoy_cars',1,'length_to',20.2,'width_to',3.52,'height_to',2.6,'weight_to',28.4,'base_rate',106),
      jsonb_build_object('cargo_class','SYMBOL','symbol','PL-A','family','PL','length_to',14.7,'width_to',2.45,'height_to',2.45,'weight_to',22.1,'base_rate',107),
      jsonb_build_object('cargo_class','SYMBOL','symbol','PL-B','family','PL','length_to',14.7,'width_to',3.4,'height_to',2.45,'weight_to',14.6,'base_rate',108),
      jsonb_build_object('cargo_class','SYMBOL','symbol','SG','family','SG','length_to',18.21,'width_to',2.45,'height_to',2.45,'weight_to',20.8,'base_rate',109),
      jsonb_build_object('cargo_class','SYMBOL','symbol','SS','family','SS','length_to',18.21,'width_to',3,'height_to',2.5,'weight_to',21.3,'base_rate',110),
      jsonb_build_object('cargo_class','SYMBOL','symbol','T','family','T','length_to',14.62,'width_to',2.45,'height_to',2.45,'weight_to',20.2,'base_rate',111),
      jsonb_build_object('cargo_class','SYMBOL','symbol','TS','family','TS','length_to',17.5,'width_to',2.45,'height_to',2.65,'weight_to',22.4,'base_rate',112)
    )
  ));
  commit"

RC=$($PSQL -c "select id from rate_cards where project_id='$P' and side='COST' and org_id='$CAR' order by version desc limit 1" | tr -d '\r')

# Transporty testowe
LBS=aaaaaaaa-0000-0000-0000-0000000000b1
LPL=aaaaaaaa-0000-0000-0000-0000000000b2
LKR1=aaaaaaaa-0000-0000-0000-0000000000b3
LKR2=aaaaaaaa-0000-0000-0000-0000000000b4
LNO=aaaaaaaa-0000-0000-0000-0000000000b5
sys "insert into loads (id, project_id, carrier_org_id, status, plan_load_date, combo_length_m, combo_width_m, combo_height_m, combo_weight_t) values
  ('$LBS','$P','$CAR','PLANNED','2026-10-05',14,2.4,1.5,30),
  ('$LPL','$P','$CAR','PLANNED','2026-10-06',14.7,3.4,2.6,14),
  ('$LKR1','$P','$CAR','PLANNED','2026-10-07',20,3.5,2.5,28),
  ('$LKR2','$P','$CAR','PLANNED','2026-10-07',20,3.5,2.5,28),
  ('$LNO','$P','$CAR','PLANNED','2026-10-08',30,4,3,40)
  on conflict (id) do update set plan_load_date=excluded.plan_load_date,
    combo_length_m=excluded.combo_length_m, combo_width_m=excluded.combo_width_m,
    combo_height_m=excluded.combo_height_m, combo_weight_t=excluded.combo_weight_t"
sys "insert into shipment_items (project_id, load_id, shipment_code, cargo_class, length_m, width_m, height_m, total_weight_t) values
  ('$P','$LBS','BS-02','DIMENSIONED',14,2.4,1.5,30),
  ('$P','$LPL','PL-1','DIMENSIONED',14.7,3.4,2.6,14),
  ('$P','$LKR1','KR-01','DIMENSIONED',20,3.5,2.5,28),
  ('$P','$LKR2','KR-02','DIMENSIONED',20,3.5,2.5,28),
  ('$P','$LNO','BS-99','DIMENSIONED',30,4,3,40)
  on conflict (project_id, shipment_code) do update set load_id=excluded.load_id,
    length_m=excluded.length_m, width_m=excluded.width_m, height_m=excluded.height_m, total_weight_t=excluded.total_weight_t"

val "BS → BS-B (najmniejsza obejmująca)" $HHL "select (rate_match('$RC','$LBS')->>'symbol')||'/'||(rate_match('$RC','$LBS')->>'base_rate')" "BS-B/102.00"
val "PL-1 @2.60 → PL-B + height_adopted" $HHL "select (rate_match('$RC','$LPL')->>'symbol')||'/'||(rate_match('$RC','$LPL')->>'height_adopted')" "PL-B/true"
val "KR konwój 2 → stawka 105" $HHL "select (rate_match('$RC','$LKR1')->>'base_rate')||'/'||(rate_match('$RC','$LKR1')->>'convoy')" "105.00/2"
val "poza cennikiem → NO_PRICE, nie zero" $HHL "select (rate_match('$RC','$LNO')->>'matched')||'/'||(rate_match('$RC','$LNO')->>'reason')||'/'||coalesce(rate_match('$RC','$LNO')->>'base_rate','∅')" "false/NO_PRICE/∅"
err "KSH nie dobiera stawki" $KSH "select rate_match('$RC','$LBS')" "wyłącznie HHL"

err "import bez GRANT dla HHL (tylko skrypt/postgres)" $HHL "select rate_card_import_symbol('$P','COST','$CAR','{\"valid_from\":\"2026-10-01\",\"rules\":[{\"cargo_class\":\"SYMBOL\",\"symbol\":\"T\",\"family\":\"T\",\"length_to\":1,\"width_to\":1,\"height_to\":1,\"weight_to\":1,\"base_rate\":1}]}'::jsonb)" "permission denied|Import cennika wyłączony"

# rate_card_save SYMBOL przez HHL
RSYM='{"valid_from":"2026-10-02","note":"wersja UI test","rules":[{"cargo_class":"SYMBOL","symbol":"T","family":"T","length_to":14.62,"width_to":2.45,"height_to":2.45,"weight_to":20.2,"base_rate":201}]}'
val "HHL zapisuje cennik SYMBOL (v≥1)" $HHL "select rate_card_save('$P','COST','$CAR','$RSYM'::jsonb) >= 1" t
err "SYMBOL+DIMENSIONED odrzucone" $HHL "select rate_card_save('$P','COST','$CAR','{\"valid_from\":\"2026-10-03\",\"note\":\"x\",\"rules\":[{\"cargo_class\":\"SYMBOL\",\"symbol\":\"T\",\"family\":\"T\",\"length_to\":1,\"width_to\":1,\"height_to\":1,\"weight_to\":1,\"base_rate\":1},{\"length_from\":0,\"length_to\":1,\"width_from\":0,\"width_to\":1,\"height_from\":0,\"height_to\":1,\"weight_from\":0,\"weight_to\":1,\"base_rate\":2}]}'::jsonb)" "nie łączy się z przedziałami"

echo; echo "WYNIK: $ok OK, $fail FAIL"
[ "$fail" -eq 0 ]
