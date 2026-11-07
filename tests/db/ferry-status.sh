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
val "pogoda BN5 — 5 korytarzy morskich w bazie" \
  "select string_agg(corridor, ',' order by corridor) from marine_conditions" "BALTIC_GDN_NYN,BALTIC_GDY_KAA,BALTIC_GULF_FI,BALTIC_PLD_KPS,BALTIC_TLL_STO"

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

# Zły p_operator (DFDS na GDY-KAA / Stena) → 22023. DP-88: nie GDN-NYN.
# SID już ODWOLANY — używamy SID2 (Stena) z DFDS.
bad=$(asuser "$HHL" "select operator_notice_apply('$SID2','OPOZNIONY', now() + interval '6 days 2 hours','zly', 'DFDS')")
if echo "$bad" | grep -qiE 'Armator nie obsługuje|22023'; then ok=$((ok+1)); echo "  OK    zły p_operator → odmowa"; else fail=$((fail+1)); echo "  FAIL  zły p_operator ($bad)"; fi

# Podgląd blokuje zapis (assert_not_preview).
asuser "$HHL" "select admin_preview_start('KSH')" >/dev/null
prev=$(asuser "$HHL" "select operator_notice_apply('$SID3','ODWOLANY',null,'podglad')")
asuser "$HHL" "select admin_preview_stop()" >/dev/null
if echo "$prev" | grep -qi 'Podgląd'; then ok=$((ok+1)); echo "  OK    Podgląd → odmowa komunikatu armatora"; else fail=$((fail+1)); echo "  FAIL  Podgląd ($prev)"; fi

# BN3 F7 #683 B5 / 0358: source AUTO|RECZNIE, created_by null dla AUTO, apply → RECZNIE.
SID5=66666666-0000-0000-0000-00000000f164
sys "delete from operator_notices where sailing_id='$SID5'; delete from sailings where id='$SID5';
insert into sailings (id, project_id, vessel_id, route, departure_at, arrival_at, status, source) values
  ('$SID5','22222222-0000-0000-0000-000000000001','55555555-0000-0000-0000-0000000000f3','TLL-HEL',
   now() + interval '8 days', now() + interval '8 days 3 hours', 'ZAPLANOWANY', 'TALLINK');" >/dev/null

# ::text boolean → true/false (jak i2.sh), nie t/f.
auto=$(sys "
insert into operator_notices (sailing_id, operator, kind, note, created_by, source, source_url)
values ('$SID5','TALLINK','ODWOLANY','AUTO test 0358', null, 'AUTO', 'https://www.tallink.com/')
returning (created_by is null)::text||'/'||source")
if [ "$auto" = "true/AUTO" ]; then ok=$((ok+1)); echo "  OK    0358 AUTO: created_by null + source=AUTO"; else fail=$((fail+1)); echo "  FAIL  0358 AUTO ($auto)"; fi

badsrc=$(sys "
insert into operator_notices (sailing_id, operator, kind, note, created_by, source)
values ('$SID5','TALLINK','OPOZNIONY','zly', null, 'XYZ') returning id" 2>&1 || true)
if echo "$badsrc" | grep -qiE 'operator_notices_source_check|check constraint|violates'; then
  ok=$((ok+1)); echo "  OK    0358 CHECK source odrzuca wartość spoza AUTO/RECZNIE"
else fail=$((fail+1)); echo "  FAIL  0358 CHECK ($badsrc)"; fi

# SID3 już ODWOLANY z wcześniejszego apply — source RECZNIE.
rec=$(sys "select source from operator_notices where sailing_id='$SID3' and created_by is not null order by created_at desc limit 1")
if [ "$rec" = "RECZNIE" ]; then ok=$((ok+1)); echo "  OK    0358 apply → source=RECZNIE"; else fail=$((fail+1)); echo "  FAIL  0358 RECZNIE ($rec)"; fi

# ODWOLANY (ręczny) otworzył FERRY_CANCELLED — już sprawdzone wyżej (dec); tu potwierdzenie łańcucha AUTO→status.
# DP-108: pełna asercja FERRY_CANCELLED jest przy SID108 poniżej (sailing_cancel_auto + transport).
sys "update sailings set status='ZAPLANOWANY', source='TALLINK' where id='$SID5'" >/dev/null
sys "delete from operator_notices where sailing_id='$SID5' and source='AUTO'" >/dev/null
sys "
insert into operator_notices (sailing_id, operator, kind, note, created_by, source, source_url)
values ('$SID5','TALLINK','ODWOLANY','symulacja job AUTO', null, 'AUTO', 'https://www.ts.ee/en/departures/');
update sailings set status='ODWOLANY' where id='$SID5';" >/dev/null
autost=$(sys "select status||'/'||(select count(*)::text from operator_notices where sailing_id='$SID5' and source='AUTO') from sailings where id='$SID5'")
if [ "$autost" = "ODWOLANY/1" ]; then ok=$((ok+1)); echo "  OK    0358 AUTO notice + ODWOLANY (łańcuch jak job)"; else fail=$((fail+1)); echo "  FAIL  0358 łańcuch ($autost)"; fi

# DP-101 / F7 #866: sailing_cancel_auto — atomowy AUTO ODWOLANY + notice.
SID101=66666666-0000-0000-0000-000000010101
SID101b=66666666-0000-0000-0000-000000010102
SID101c=66666666-0000-0000-0000-000000010103
sys "delete from operator_notices where sailing_id in ('$SID101','$SID101b','$SID101c');
delete from sailings where id in ('$SID101','$SID101b','$SID101c');
insert into sailings (id, project_id, vessel_id, route, departure_at, arrival_at, status, source) values
  ('$SID101','22222222-0000-0000-0000-000000000001','55555555-0000-0000-0000-0000000000f3','TLL-HEL',
   now() + interval '9 days', now() + interval '9 days 3 hours', 'ZAPLANOWANY', 'TALLINK'),
  ('$SID101b','22222222-0000-0000-0000-000000000001','55555555-0000-0000-0000-0000000000f3','TLL-HEL',
   now() + interval '10 days', now() + interval '10 days 3 hours', 'ZAPLANOWANY', 'RECZNIE'),
  ('$SID101c','22222222-0000-0000-0000-000000000001','55555555-0000-0000-0000-0000000000f3','TLL-HEL',
   now() + interval '11 days', now() + interval '11 days 3 hours', 'ZAPLANOWANY', 'TALLINK');" >/dev/null

# (a) dwa wywołania → 1 notice
sys "select sailing_cancel_auto('$SID101','TALLINK','DP-101 a1','https://www.tallink.com/')" >/dev/null
sys "select sailing_cancel_auto('$SID101','TALLINK','DP-101 a2','https://www.tallink.com/')" >/dev/null
twice=$(sys "select status||'/'||(select count(*)::text from operator_notices where sailing_id='$SID101' and source='AUTO') from sailings where id='$SID101'")
if [ "$twice" = "ODWOLANY/1" ]; then ok=$((ok+1)); echo "  OK    DP-101: dwa RPC → 1 AUTO notice"; else fail=$((fail+1)); echo "  FAIL  DP-101 dwa RPC ($twice)"; fi

# (b) RECZNIE → false, 0 notice, status bez zmian
recz_ok=$(sys "select sailing_cancel_auto('$SID101b','TALLINK','DP-101 b',null)::text")
recz_st=$(sys "select status||'/'||(select count(*)::text from operator_notices where sailing_id='$SID101b') from sailings where id='$SID101b'")
if { [ "$recz_ok" = "false" ] || [ "$recz_ok" = "f" ]; } && [ "$recz_st" = "ZAPLANOWANY/0" ]; then
  ok=$((ok+1)); echo "  OK    DP-101: RECZNIE → 0 notice, status bez zmian"
else fail=$((fail+1)); echo "  FAIL  DP-101 RECZNIE ($recz_ok / $recz_st)"; fi

# (c) zły operator (FK) → wycofuje także status
sys "
do \$\$
begin
  perform public.sailing_cancel_auto('$SID101c','NO_SUCH_OP','DP-101 c',null);
exception when foreign_key_violation then
  null;
when others then
  if sqlerrm ~* 'operator_notices_operator|foreign key|violates' then null;
  else raise;
  end if;
end \$\$;" >/dev/null
badop=$(sys "select status||'/'||(select count(*)::text from operator_notices where sailing_id='$SID101c') from sailings where id='$SID101c'")
if [ "$badop" = "ZAPLANOWANY/0" ]; then ok=$((ok+1)); echo "  OK    DP-101: błąd insertu wycofuje status"; else fail=$((fail+1)); echo "  FAIL  DP-101 rollback ($badop)"; fi

# authenticated bez EXECUTE
authdeny=$(asuser "$HHL" "select sailing_cancel_auto('$SID101','TALLINK','x',null)")
if echo "$authdeny" | grep -qiE 'permission denied|42501'; then
  ok=$((ok+1)); echo "  OK    DP-101: authenticated bez EXECUTE"
else fail=$((fail+1)); echo "  FAIL  DP-101 authenticated ($authdeny)"; fi

# DP-108 / F7 #683 r2: AUTO ODWOLANY (sailing_cancel_auto) → FERRY_CANCELLED jak ścieżka ręczna.
# Fixture: własny vessel + UUID z numerem DP (ostatnia grupa 12 hex); bez overlapping SID101.
SID108=66666666-0000-0000-0000-000000000108
LID108=33333333-0000-0000-0000-000000000108
V108=55555555-0000-0000-0000-000000000108
sys "delete from decisions where load_id='$LID108';
delete from risk_signals where load_id='$LID108';
delete from operator_notices where sailing_id='$SID108';
delete from positions where load_id='$LID108';
delete from loads where id='$LID108';
delete from sailings where id='$SID108';
delete from vessels where id='$V108';
insert into vessels (id, name, operator) values
  ('$V108','Megastar DP108','Tallink');
insert into sailings (id, project_id, vessel_id, route, departure_at, arrival_at, status, source) values
  ('$SID108','22222222-0000-0000-0000-000000000001','$V108','TLL-HEL',
   now() + interval '12 days', now() + interval '12 days 3 hours', 'ZAPLANOWANY', 'TALLINK');
insert into loads (id, project_id, carrier_org_id, order_no, hhl_order_no, carrier_order_no, sailing_id, status) values
  ('$LID108','22222222-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000a003','FS-108','HHL/FS-108','SCX/FS-108','$SID108','IN_TRANSIT_PL');" >/dev/null
cnt108=$(sys "select count(*)::text from sailings where id='$SID108'")
if [ "$cnt108" = "1" ]; then :; else fail=$((fail+1)); echo "  FAIL  DP-108 fixture sailing count=$cnt108"; fi
sys "select sailing_cancel_auto('$SID108','TALLINK','DP-108 AUTO cancel','https://www.tallink.com/')" >/dev/null
dec108=$(sys "select coalesce((select type_code from decisions where load_id='$LID108' and type_code='FERRY_CANCELLED' limit 1),'brak')||'/'||(select status from sailings where id='$SID108')||'/'||(select count(*)::text from operator_notices where sailing_id='$SID108' and source='AUTO')")
if [ "$dec108" = "FERRY_CANCELLED/ODWOLANY/1" ]; then
  ok=$((ok+1)); echo "  OK    DP-108: AUTO ODWOLANY otwiera FERRY_CANCELLED"
else fail=$((fail+1)); echo "  FAIL  DP-108 AUTO→FERRY_CANCELLED ($dec108)"; fi

echo; echo "WYNIK: $ok OK, $fail FAIL"
