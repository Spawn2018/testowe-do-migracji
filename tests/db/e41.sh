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

echo; echo "[e41] A4 — kolumny numerów bez SELECT dla KSH"
# PostgREST/psql: SELECT kolumny bez uprawnienia → błąd; HHL/SCX też bez SELECT (numery tylko RPC).
err_col() { out=$(run "$2" "$3" | grep -v -E '^(BEGIN|SET|ROLLBACK|COMMIT)$' | tr '\n' ' ')
  if echo "$out" | grep -qiE 'permission denied|42501|must be owner'; then ok=$((ok+1)); echo "  OK    $1"; else fail=$((fail+1)); bad="${bad} [$1 => ${out}]"; echo "  FAIL  $1  (brak odmowy kolumny; było: $out)"; fi; }
err_col "KSH bez hhl_order_no" $KSH "select hhl_order_no from loads where id='$L1'"
err_col "KSH bez carrier_order_no" $KSH "select carrier_order_no from loads where id='$L1'"
err_col "KSH bez order_no" $KSH "select order_no from loads where id='$L1'"
sval "authenticated bez SELECT hhl_order_no" "select has_column_privilege('authenticated','loads','hhl_order_no','select')::text" false
sval "authenticated bez SELECT carrier_order_no" "select has_column_privilege('authenticated','loads','carrier_order_no','select')::text" false
sval "authenticated bez SELECT order_no" "select has_column_privilege('authenticated','loads','order_no','select')::text" false

echo; echo "[e41] A2 — Przeczytali tylko dla widocznej wiadomości (decyzja 15.10 03:12 / D-0330)"
# Wiadomość tylko HHL+CARRIER (bez CLIENT): KSH nie dostaje listy czytających.
sys "insert into load_messages (id, load_id, author_id, body, visible_to)
     select 900041, '$L1', u.id, 'a2-hhl-scx', array['FORWARDER','CARRIER']::org_kind[]
       from app_users u where u.auth_id='$HHL'
     on conflict (id) do update set visible_to=excluded.visible_to, body=excluded.body" >/dev/null
sys "insert into load_message_reads (message_id, user_id, read_at)
     select 900041, u.id, now() from app_users u where u.auth_id='$HHL'
     on conflict (message_id, user_id) do nothing" >/dev/null
val "KSH bez listy dla wiadomości HHL–SCX" $KSH "select count(*) from load_message_read_list(900041)" 0
val "HHL widzi listę dla tej wiadomości" $HHL "select (count(*) >= 1)::text from load_message_read_list(900041)" t
val "SCX widzi listę dla tej wiadomości" $SCX "select (count(*) >= 1)::text from load_message_read_list(900041)" t
# Security definer omija RLS loads — warunek jak loads_read: drugi przewoźnik nie widzi cudzego transportu.
CAR2O=00000000-0000-0000-0000-00000000a004
CAR2=11111111-0000-0000-0000-0000000000c2
sys "insert into organizations (id, code, name, kind) values ('$CAR2O','CAR2','Drugi przewoznik','CARRIER')
     on conflict (id) do nothing;
     insert into app_users (auth_id, org_id, email, role, active)
     values ('$CAR2','$CAR2O','car2-e41@test','CARRIER_DISPATCH',true)
     on conflict (auth_id) do update set org_id=excluded.org_id, role='CARRIER_DISPATCH', active=true" >/dev/null
val "drugi przewoźnik bez listy cudzego transportu" $CAR2 "select count(*) from load_message_read_list(900041)" 0

echo; echo "[e41] E18 P15 tytuły"
sys "insert into risk_signals (project_id, load_id, kind, severity, title) values
 ('$P','$L1','ROAD_SE','LOW','E4: trasa riktningarna test'),
 ('$P','$L1','ROAD_SE','LOW','Nieznany kod źródła drogowego — w panelu: zdarzenie drogowe'),
 ('$P','$L1','DOC_MISSING','HIGH','5c77d4d7: brak awizacji przed załadunkiem')" >/dev/null
sval "przepisanie" "select e18_p15_apply() >= 2" t
sval "szwedzki opis po polsku" "select (count(*) >= 1)::text from risk_signals where resolved_at is null and title like '%Zakaz ruchu ciężarówek w Szwecji:%riktningarna%'" true
sval "nieznany kod bez zmiany" "select count(*) from risk_signals where title like 'Nieznany kod źródła drogowego%'" 1
sval "osiem znaków → kod wysyłki" "select count(*) from risk_signals where title like 'SG-03 %brak awizacji przed załadunkiem'" 1
sval "kopia w dzienniku" "select (count(*) >= 2)::text from audit_log where action = 'E18_P15_KOPIA'" true

echo; echo "[e41] P2-poprawki — roboty drogowe"
sval "bez id z listy funkcja zmienia 0" "select e18_p15_poprawka()" 0
sys "insert into risk_signals (id, project_id, kind, severity, title, title_key, detail) values
 ('0f692878-7193-40f1-88c7-1bd395e8bd7b','$P','ROAD_SE','LOW',
  'Zakaz ruchu ciężarówek w Szwecji: E4: od Trafikplats Piteå S do Trafikplats Bergsviken i riktning mot Sundsvall w regionie Norrbottens (BD)',
  'rk_road_se','{\"rodzaj\":\"roboty\"}'::jsonb)" >/dev/null
sys "insert into audit_log (action, entity, entity_id, old_value, new_value, source) values
 ('E18_P15_KOPIA','risk_signals','0f692878-7193-40f1-88c7-1bd395e8bd7b','{}','{}','e18-p15')" >/dev/null
sys "insert into risk_signals (id, project_id, kind, severity, title, title_key) values
 ('0195aaaa-0000-4000-8000-000000000001','$P','ROAD_SE','LOW',
  'Zakaz ruchu ciężarówek w Szwecji: spoza listy','rk_road_se')" >/dev/null
n0=$(sys "select count(*) from notifications" | tail -1)
s0=$(sys "select count(*) from sms_outbox" | tail -1)
sval "jedna sprawa z listy" "select e18_p15_poprawka()" 1
sval "tytuł roboty po polsku" "select title from risk_signals where id='0f692878-7193-40f1-88c7-1bd395e8bd7b'" "Warunki drogowe E4: roboty drogowe, od węzła Piteå S do węzła Bergsviken, w kierunku Sundsvall, region Norrbotten, od 18.08, 06:51 do 31.12, 16:00"
sval "title_key bez zmian" "select title_key from risk_signals where id='0f692878-7193-40f1-88c7-1bd395e8bd7b'" "rk_road_se"
sval "severity bez zmian" "select severity::text from risk_signals where id='0f692878-7193-40f1-88c7-1bd395e8bd7b'" "LOW"
sval "spoza listy bez zmian" "select title from risk_signals where id='0195aaaa-0000-4000-8000-000000000001'" "Zakaz ruchu ciężarówek w Szwecji: spoza listy"
sval "drugi raz 0" "select e18_p15_poprawka()" 0
sval "wpis E18_P15_POPRAWKA" "select count(*) from audit_log where action='E18_P15_POPRAWKA' and entity_id='0f692878-7193-40f1-88c7-1bd395e8bd7b'" 1
sval "powiadomienia bez zmian" "select count(*) from notifications" "$n0"
sval "sms bez zmian" "select count(*) from sms_outbox" "$s0"

echo; echo "WYNIK: $ok OK, $fail FAIL${bad}"
[ "$fail" -eq 0 ]
