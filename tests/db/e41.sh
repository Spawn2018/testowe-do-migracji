#!/usr/bin/env bash
# E41 + E18 P15 (P2) — KSH nie dostaje numerów; nazwa; SMS = kod; tytuły spraw.
. "$(git rev-parse --show-toplevel)/tests/db/refuse-prod.sh"
PSQL="psql ${PGURL:-postgres://postgres@localhost:5433/tower} -Atq"
HHL=11111111-0000-0000-0000-000000000001; KSH=11111111-0000-0000-0000-000000000002; SCX=11111111-0000-0000-0000-000000000003
L1=33333333-0000-0000-0000-000000000001
P=22222222-0000-0000-0000-000000000001
ok=0; fail=0; bad=""
run() { local end="rollback"; [ "$3" = "commit" ] && end="commit"
  $PSQL -v ON_ERROR_STOP=1 -c "begin; set local role authenticated; set local request.jwt.claim.sub='$1'; $2; $end;" 2>&1; }
val()  { out=$(run "$2" "$3" "$5" | grep -v -E '^(BEGIN|SET|ROLLBACK|COMMIT)$' | tail -1)
         if [ "$out" = "$4" ]; then ok=$((ok+1)); echo "  OK    $1"; else fail=$((fail+1)); bad="${bad} [$1 => ${out}]"; echo "  FAIL  $1  (otrzymano: $out, oczekiwano: $4)"; fi; }
sys()  { $PSQL -v ON_ERROR_STOP=1 -c "$1" 2>&1; }
sval() { out=$(sys "$2" | tail -1); if [ "$out" = "$3" ]; then ok=$((ok+1)); echo "  OK    $1"; else fail=$((fail+1)); bad="${bad} [$1 => ${out}]"; echo "  FAIL  $1  (otrzymano: $out, oczekiwano: $3)"; fi; }

sys "update loads set hhl_order_no='0005/09/S/2026', carrier_order_no='15062/2026/OSL/GDA/P', order_no='KSH/1' where id='$L1'" >/dev/null
sys "insert into shipment_items (project_id, load_id, shipment_code, item_type, length_m, width_m, height_m)
     values ('$P','$L1','SG-03','slup',1,1,1)
     on conflict (project_id, shipment_code) do update set load_id=excluded.load_id" >/dev/null

echo; echo "[e41] nazwa"
sval "HHL z numerem" "select transport_label('SG-03','0005/09/S/2026','15062/2026/OSL/GDA/P','HHL','plain')" "SG-03 · 0005/09/S/2026"
sval "SCX z numerem" "select transport_label('SG-03','0005/09/S/2026','15062/2026/OSL/GDA/P','SCX','plain')" "SG-03 · 15062/2026/OSL/GDA/P"
sval "KSH sam kod" "select transport_label('SG-03','0005/09/S/2026','15062/2026/OSL/GDA/P','KSH','panel')" "SG-03"
sval "HHL brak numeru w panelu" "select transport_label('SG-07',null,null,'HHL','panel')" "SG-07 brak nr HHL"
sval "SCX brak numeru poza panelem = sam kod" "select transport_label('SG-07','',' ','SCX','plain')" "SG-07"

echo; echo "[e41] API numerów"
val "anon nie wywoła load_order_numbers" $KSH "select has_function_privilege('anon','load_order_numbers()','execute')::text" false
val "KSH nie dostaje żadnego numeru" $KSH "select count(*) from load_order_numbers() where hhl_order_no is not null or carrier_order_no is not null" 0
val "KSH widzi transport, pola puste" $KSH "select coalesce(hhl_order_no,'')||'|'||coalesce(carrier_order_no,'') from load_order_numbers() where load_id='$L1'" "|"
val "HHL dostaje oba numery" $HHL "select hhl_order_no||'|'||carrier_order_no from load_order_numbers() where load_id='$L1'" "0005/09/S/2026|15062/2026/OSL/GDA/P"
val "SCX dostaje numer HHL do odczytu i swój" $SCX "select hhl_order_no||'|'||carrier_order_no from load_order_numbers() where load_id='$L1'" "0005/09/S/2026|15062/2026/OSL/GDA/P"
sval "SMS = kod wysyłki, nie numer z pliku" "select load_sms_code('$L1')" "SG-03"

echo; echo "[e41] E18 P15 tytuły"
sys "insert into risk_signals (project_id, load_id, kind, severity, title) values
 ('$P','$L1','ROAD_SE','LOW','E4: trasa riktningarna test'),
 ('$P','$L1','ROAD_SE','LOW','Nieznany kod źródła drogowego — w panelu: zdarzenie drogowe'),
 ('$P','$L1','DOC_MISSING','HIGH','5c77d4d7: brak awizacji przed załadunkiem')" >/dev/null
sval "przepisanie" "select e18_p15_apply() >= 2" t
sval "szwedzki opis po polsku" "select count(*) from risk_signals where resolved_at is null and title like '%Zakaz ruchu ciężarówek w Szwecji:%riktningarna%'" 1
sval "nieznany kod bez zmiany" "select count(*) from risk_signals where title like 'Nieznany kod źródła drogowego%'" 1
sval "osiem znaków → kod wysyłki" "select count(*) from risk_signals where title like 'SG-03 %brak awizacji przed załadunkiem'" 1
sval "kopia w dzienniku" "select (count(*) >= 2)::text from audit_log where action = 'E18_P15_KOPIA'" true

echo; echo "WYNIK: $ok OK, $fail FAIL${bad}"
[ "$fail" -eq 0 ]
