#!/usr/bin/env bash
# FERRY-STATUS — E22, obie pogody, plan trasy bez ostrzeżenia o zezwoleniu, komunikat armatora.
. "$(git rev-parse --show-toplevel)/tests/db/refuse-prod.sh"
PSQL="psql ${PGURL:-postgres://postgres@localhost:5433/tower} -Atq"
HHL=11111111-0000-0000-0000-000000000001
KSH=11111111-0000-0000-0000-000000000002
SID=66666666-0000-0000-0000-00000000f160
SID2=66666666-0000-0000-0000-00000000f161
SID3=66666666-0000-0000-0000-00000000f162
SID4=66666666-0000-0000-0000-00000000f163
LID=33333333-0000-0000-0000-00000000f160
ok=0; fail=0
sys() { $PSQL -v ON_ERROR_STOP=1 -c "$1" 2>&1; }
val() {
  out=$(sys "$2" | grep -v -E '^(BEGIN|SET|ROLLBACK|COMMIT)$' | tail -1)
  if [ "$out" = "$3" ]; then ok=$((ok+1)); echo "  OK    $1"; else fail=$((fail+1)); echo "  FAIL  $1 (otrzymano: $out, oczekiwano: $3)"; fi
}
asuser() {
  $PSQL -v ON_ERROR_STOP=1 -c "begin; select set_config('request.jwt.claim.sub','$1',true); set local role authenticated; $2; commit;" 2>&1 \
    | grep -v -E '^(BEGIN|SET|COMMIT)$' | tr '\n' ' '
}

echo; echo "[ferry-status] rozkład, pogoda, E22, komunikat armatora"
val "flaga H-1 zostaje wyłączona" "select enabled::text from security_flags where key='H1_ROUTE_CHECK'" "false"
val "flaga H-3 zostaje wyłączona" "select enabled::text from security_flags where key = 'H3_' || 'CORRIDOR_OBSTACLES'" "false"
val "korytarz SE_E22 jest dłuższy niż sam E4 z Nynäshamn" \
  "select (select total_km from corridor_polylines where code='SE_E22') > (select total_km from corridor_polylines where code='SE_E4')" "t"
val "pogoda obu tras jest w bazie" \
  "select string_agg(corridor, ',' order by corridor) from marine_conditions" "BALTIC_GDN_NYN,BALTIC_GDY_KAA"

plan() {
  local route="$1" dep="$2" arr="$3"
  echo "select round((p->>'pl_h')::numeric,1)::text||'/'||round((p->>'se_h')::numeric,1)::text||'/'||round((p->>'crossing_h')::numeric,1)::text||'/'||(p->>'permit_warning') from crossing_route_plan('$route','$dep','$arr') p"
}
val "plan Gdańsk–Nynäshamn: dojazd 7,5 h, droga SE 17 h, rejs 18 h, bez ostrzeżenia o zezwoleniu" \
  "$(plan GDN-NYN '2026-10-06 16:00+00' '2026-10-07 10:00+00')" "7.5/17.0/18.0/false"
val "plan Gdynia–Karlskrona różni się dojazdem, rejsem i drogą SE" \
  "$(plan GDY-KAA '2026-10-06 18:00+00' '2026-10-07 06:00+00')" "8.2/21.5/12.0/false"

ksh=$(asuser "$KSH" "select operator_notice_apply('$SID','ODWOLANY',null,'sztorm')")
if echo "$ksh" | grep -q "wyłącznie administrator"; then ok=$((ok+1)); echo "  OK    dyspozytor klienta nie zapisuje komunikatu"; else fail=$((fail+1)); echo "  FAIL  dyspozytor klienta nie zapisuje komunikatu ($ksh)"; fi

setup=$(sys "
insert into vessels (id, name, operator) values
  ('55555555-0000-0000-0000-0000000000f1','FS Wawel','Polferries'),
  ('55555555-0000-0000-0000-0000000000f2','FS Ebba','Stena Line'),
  ('55555555-0000-0000-0000-0000000000f3','Megastar BN3','Tallink'),
  ('55555555-0000-0000-0000-0000000000f4','Viking XPRS BN3','Viking Line')
  on conflict (id) do nothing;
delete from decisions where load_id = '$LID';
delete from risk_signals where load_id = '$LID';
delete from operator_notices where sailing_id in ('$SID','$SID2','$SID3','$SID4');
delete from positions where load_id = '$LID';
delete from loads where id = '$LID';
delete from sailings where id in ('$SID','$SID2','$SID3','$SID4');
insert into sailings (id, project_id, vessel_id, route, departure_at, arrival_at, status, source) values
  ('$SID','22222222-0000-0000-0000-000000000001','55555555-0000-0000-0000-0000000000f1','GDN-NYN', now() + interval '2 days', now() + interval '3 days', 'ZAPLANOWANY', 'POLFERRIES'),
  ('$SID2','22222222-0000-0000-0000-000000000001','55555555-0000-0000-0000-0000000000f2','GDY-KAA', now() + interval '6 days', now() + interval '7 days', 'ZAPLANOWANY', 'STENA'),
  ('$SID3','22222222-0000-0000-0000-000000000001','55555555-0000-0000-0000-0000000000f3','TLL-HEL', now() + interval '4 days', now() + interval '4 days 3 hours', 'ZAPLANOWANY', 'TALLINK'),
  ('$SID4','22222222-0000-0000-0000-000000000001','55555555-0000-0000-0000-0000000000f4','TLLA-HEL', now() + interval '5 days', now() + interval '5 days 3 hours', 'ZAPLANOWANY', 'DANE_STARTOWE');
insert into loads (id, project_id, carrier_org_id, order_no, hhl_order_no, carrier_order_no, sailing_id, status) values
  ('$LID','22222222-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000a003','FS-160','HHL/FS-160','SCX/FS-160','$SID','IN_TRANSIT_PL');
insert into positions (load_id, ts, geom_raw, source)
values ('$LID', now(), st_setsrid(st_makepoint(17.0, 52.1), 4326), 'DRIVER_PWA');
")
if echo "$setup" | grep -q ERROR; then echo "  setup: $setup"; fi

hhl=$(asuser "$HHL" "select operator_notice_apply('$SID','ODWOLANY',null,'komunikat POLSCA')")
dec=$(sys "select coalesce((select type_code from decisions where load_id='$LID' and type_code='FERRY_CANCELLED' limit 1),'brak')||'/'||(select status from sailings where id='$SID')||'/'||(select count(*) from operator_notices where sailing_id='$SID')")
if [ "$dec" = "FERRY_CANCELLED/ODWOLANY/1" ]; then ok=$((ok+1)); echo "  OK    komunikat ręczny odwołuje rejs i otwiera FERRY_CANCELLED"; else fail=$((fail+1)); echo "  FAIL  komunikat ręczny ($dec) rpc:$hhl"; fi

# BN3 (#573 / F7 #680 B5): operator z notice, nie CASE GDY→STENA.
pf=$(sys "select operator from operator_notices where sailing_id='$SID' order by created_at desc limit 1")
if [ "$pf" = "POLFERRIES" ]; then ok=$((ok+1)); echo "  OK    komunikat GDN-NYN zapisuje operator=POLFERRIES"; else fail=$((fail+1)); echo "  FAIL  POLFERRIES ($pf) rpc:$hhl"; fi

stena=$(asuser "$HHL" "select operator_notice_apply('$SID2','ODWOLANY',null,'BN3 Stena')")
stenaop=$(sys "select operator||'/'||status from sailings s join operator_notices n on n.sailing_id=s.id where s.id='$SID2' order by n.created_at desc limit 1")
if [ "$stenaop" = "STENA/ODWOLANY" ]; then ok=$((ok+1)); echo "  OK    komunikat Stena GDY-KAA zapisuje operator=STENA"; else fail=$((fail+1)); echo "  FAIL  Stena ($stenaop) rpc:$stena"; fi

bn3=$(asuser "$HHL" "select operator_notice_apply('$SID3','ODWOLANY',null,'BN3 Tallink')")
bn3op=$(sys "select operator||'/'||status from sailings s join operator_notices n on n.sailing_id=s.id where s.id='$SID3' order by n.created_at desc limit 1")
if [ "$bn3op" = "TALLINK/ODWOLANY" ]; then ok=$((ok+1)); echo "  OK    BN3 komunikat Tallink TLL-HEL zapisuje operator=TALLINK"; else fail=$((fail+1)); echo "  FAIL  BN3 Tallink ($bn3op) rpc:$bn3"; fi

# TLLA-HEL: główny armator VIKING (ferry_route_operators); vessel=Viking Line.
vik=$(asuser "$HHL" "select operator_notice_apply('$SID4','ODWOLANY',null,'BN3 Viking TLLA')")
vikop=$(sys "select operator||'/'||status from sailings s join operator_notices n on n.sailing_id=s.id where s.id='$SID4' order by n.created_at desc limit 1")
if [ "$vikop" = "VIKING/ODWOLANY" ]; then ok=$((ok+1)); echo "  OK    BN3 TLLA-HEL z Vikingiem → operator=VIKING"; else fail=$((fail+1)); echo "  FAIL  BN3 Viking TLLA ($vikop) rpc:$vik"; fi

# Zły p_operator (DFDS na GDN-NYN) → 22023.
# SID już ODWOLANY — używamy SID3 po resecie statusu albo nowego wywołania na SID2 z DFDS.
bad=$(asuser "$HHL" "select operator_notice_apply('$SID2','OPOZNIONY', now() + interval '6 days 2 hours','zly', 'DFDS')")
if echo "$bad" | grep -qiE 'Armator nie obsługuje|22023'; then ok=$((ok+1)); echo "  OK    zły p_operator → odmowa"; else fail=$((fail+1)); echo "  FAIL  zły p_operator ($bad)"; fi

# Podgląd blokuje zapis (assert_not_preview).
asuser "$HHL" "select admin_preview_start('KSH')" >/dev/null
prev=$(asuser "$HHL" "select operator_notice_apply('$SID3','ODWOLANY',null,'podglad')")
asuser "$HHL" "select admin_preview_stop()" >/dev/null
if echo "$prev" | grep -qi 'Podgląd'; then ok=$((ok+1)); echo "  OK    Podgląd → odmowa komunikatu armatora"; else fail=$((fail+1)); echo "  FAIL  Podgląd ($prev)"; fi

echo; echo "WYNIK: $ok OK, $fail FAIL"
