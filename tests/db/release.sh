#!/usr/bin/env bash
# TOWER — test bazy wydania 1.0 (ANEKS 3 §2.1–§2.4, ANEKS 4 PR1–PR7).
# Własna, czysta baza: atrapa Supabase (+ rola service_role jak w Supabase) → migracje → seed testowy.
# Użycie: PGADMIN=postgres://postgres@localhost:5433/postgres bash tests/db/release.sh
# UWAGA: supabase_stub.sql NIGDY nie uruchamiaj na Supabase.
set -e
ADMIN=${PGADMIN:-postgres://postgres@localhost:5433/postgres}
. "$(git rev-parse --show-toplevel)/tests/db/local-only.sh"
DB=tower_test_release; URL="${ADMIN%/*}/$DB"
psql "$ADMIN" -q -c "drop database if exists $DB" -c "create database $DB"
psql "$URL" -q -v ON_ERROR_STOP=1 -f tests/db/supabase_stub.sql
psql "$URL" -q -v ON_ERROR_STOP=1 -c "do \$\$ begin if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if; end \$\$;" \
  -c "grant usage on schema public, auth to service_role" \
  -c "alter default privileges in schema public grant all on tables to service_role" \
  -c "alter default privileges in schema public grant all on sequences to service_role"
for f in supabase/migrations/*.sql; do psql "$URL" -q -v ON_ERROR_STOP=1 -f "$f" >/dev/null 2>&1 || { echo "MIGRACJA $f: błąd"; psql "$URL" -q -v ON_ERROR_STOP=1 -f "$f" 2>&1 | tail -3; exit 1; }; done
psql "$URL" -q -v ON_ERROR_STOP=1 -f tests/db/seed.sql
set +e

PSQL="psql $URL -Atq"
HHL=11111111-0000-0000-0000-000000000001; KSH=11111111-0000-0000-0000-000000000002; SCX=11111111-0000-0000-0000-000000000003
P=22222222-0000-0000-0000-000000000001; INVK=44444444-0000-0000-0000-00000000000c; INVP=44444444-0000-0000-0000-0000000000ee
L1=33333333-0000-0000-0000-000000000001; L2=33333333-0000-0000-0000-000000000002
ok=0; fail=0
run() { local end="rollback"; [ "$3" = "commit" ] && end="commit"
  $PSQL -v ON_ERROR_STOP=1 -c "begin; set local role ${ROLE:-authenticated}; set local request.jwt.claim.sub='$1'; $2; $end;" 2>&1; }
val() { out=$(run "$2" "$3" "$5" | grep -v -E '^(BEGIN|SET|ROLLBACK|COMMIT)$' | tail -1)
  if [ "$out" = "$4" ]; then ok=$((ok+1)); echo "  OK    $1"; else fail=$((fail+1)); echo "  FAIL  $1  (otrzymano: $out, oczekiwano: $4)"; fi; }
err() { out=$(run "$2" "$3"); if echo "$out" | grep -qiE "$4"; then ok=$((ok+1)); echo "  OK    $1"; else fail=$((fail+1)); echo "  FAIL  $1  →  $(echo "$out" | tail -1)"; fi; }
sys() { $PSQL -v ON_ERROR_STOP=1 -c "$1" >/dev/null 2>&1 || echo "  (sys błąd: $1)"; }
Q() { $PSQL -c "$1" 2>&1 | tail -1; }
chk() { if [ "$2" = "$3" ]; then ok=$((ok+1)); echo "  OK    $1"; else fail=$((fail+1)); echo "  FAIL  $1  (otrzymano: $2, oczekiwano: $3)"; fi; }

echo; echo "[2.1] Import nie kasuje transportów — anulowanie, blokada od AT_LOADING i na fakturze"
L3=33333333-0000-0000-0000-000000000003
sys "insert into loads (id, project_id, carrier_org_id, order_no, hhl_order_no) values ('$L3','$P','00000000-0000-0000-0000-00000000a003','KSH/3','HHL/3')"
sys "update loads set status='READY' where id='$L3'"
val "podgląd: READY niezafakturowany → CANCEL"          $HHL "select verdict from import_removal_check(array['$L3']::uuid[])" CANCEL
val "podgląd: zafakturowany → BLOCKED_INVOICED z powodem" $HHL "select verdict||' / '||reason from import_removal_check(array['$L1']::uuid[])" "BLOCKED_INVOICED / Transport jest na fakturze"
val "podgląd niczego nie zmienia"                        $HHL "select count(*) from import_removal_check(array['$L3']::uuid[]); select status from loads where id='$L3'" READY
val "import anuluje transport w READY"                   $HHL "select verdict from import_cancel_loads(array['$L3']::uuid[])" CANCELLED
val "anulowanie w READY zostawia wiersz (CANCELLED)"     $HHL "select count(*) from import_cancel_loads(array['$L3']::uuid[]); select count(*)||':'||max(status::text) from loads where id='$L3'" "1:CANCELLED"
val "import nie anuluje zafakturowanego (L1, PLANNED)"   $HHL "select count(*) from import_cancel_loads(array['$L1']::uuid[]); select status from loads where id='$L1'" PLANNED
sys "update loads set hhl_order_no='HHL/2', carrier_order_no='SCX/2' where id='$L2'"
for st in AT_LOADING IN_TRANSIT_PL AT_PORT_GDANSK FERRY AT_PORT_NYNASHAMN IN_TRANSIT_SE AT_SITE UNLOADED DELIVERED; do
  extra=""; [ "$st" = UNLOADED ] || [ "$st" = DELIVERED ] && extra=", actual_delivery_at=now()"
  sys "update loads set status='$st'$extra where id='$L2'"
  val "import nie anuluje w $st (BLOCKED_STATUS, status bez zmian)" $HHL "select string_agg(verdict,',') from import_cancel_loads(array['$L2']::uuid[]); select status from loads where id='$L2'" $st
done
sys "update loads set status='AT_LOADING', actual_delivery_at=null where id='$L2'"
err "HHL: bezpośredni UPDATE na CANCELLED odrzucony"     $HHL "update loads set status='CANCELLED' where id='$L2'" "cancel_load"
err "HHL: ręczne anulowanie bez powodu odrzucone"        $HHL "select cancel_load('$L2', ' ')" "wymaga powodu"
err "SCX: cancel_load odrzucone"                         $SCX "select cancel_load('$L2', 'awaria')" "wyłącznie HHL"
err "KSH: import_cancel_loads odrzucone"                 $KSH "select * from import_cancel_loads(array['$L2']::uuid[])" "wyłącznie HHL"
val "HHL: ręczne anulowanie w drodze z powodem"          $HHL "select cancel_load('$L2', 'Awaria naczepy — wycofany')" CANCELLED commit
chk "ręczne anulowanie: wpis w audit_log z powodem"      "$(Q "select new_value->>'reason' from audit_log where action='LOAD_CANCEL_MANUAL' and entity_id='$L2'")" "Awaria naczepy — wycofany"
val "import: wpis w audit_log (LOAD_CANCEL_IMPORT)"      $HHL "select count(*) from import_cancel_loads(array['$L3']::uuid[])" 1 commit
chk "import: dziennik ma wpis dla L3"                    "$(Q "select count(*) from audit_log where action='LOAD_CANCEL_IMPORT' and entity_id='$L3'")" 1
err "DELETE loads odrzucony — HHL"                       $HHL "delete from loads where id='$L3'" "permission denied|nie można skasować"
err "DELETE loads odrzucony — KSH"                       $KSH "delete from loads where id='$L3'" "permission denied|nie można skasować"
err "DELETE loads odrzucony — SCX"                       $SCX "delete from loads where id='$L3'" "permission denied|nie można skasować"
err "DELETE loads odrzucony — anon"                      $HHL "set local role anon; delete from loads where id='$L3'" "permission denied|nie można skasować"
err "DELETE loads odrzucony — service_role"              $HHL "set local role service_role; delete from loads where id='$L3'" "permission denied|nie można skasować"
sys "grant delete on loads to service_role"
err "DELETE loads: wyzwalacz blokuje nawet po nadaniu uprawnienia" $HHL "set local role service_role; delete from loads where id='$L3'" "nie można skasować"
sys "revoke delete on loads from service_role"
chk "wiersze transportów zostały (3)"                    "$(Q "select count(*) from loads")" 3

echo; echo "[2.2] Widoczność ryzyk — zamknięte drzwi (audience + RLS)"
CRX=11111111-0000-0000-0000-000000000004; OCRX=00000000-0000-0000-0000-00000000a004; OSCX=00000000-0000-0000-0000-00000000a003
L4=33333333-0000-0000-0000-000000000004
sys "insert into organizations (id, code, name, kind) values ('$OCRX','CRX','Inny przewoźnik','CARRIER')"
sys "insert into app_users (auth_id, org_id, email, role) values ('$CRX','$OCRX','crx@test','CARRIER_DISPATCH')"
sys "insert into loads (id, project_id, carrier_org_id, order_no) values ('$L4','$P','$OCRX','KSH/4')"
sys "alter type risk_kind add value if not exists 'TEST_NOWY'"
R() { sys "insert into risk_signals (project_id, load_id, kind, severity, title, detail) values ('$P', $1, '$2', 'HIGH', 'test', '$3'::jsonb)"; }
R "'$L1'" INVOICE_MISMATCH "{\"t\":\"cost\",\"invoice_id\":\"$INVK\"}"
R "'$L1'" INVOICE_MISMATCH "{\"t\":\"rev\",\"invoice_id\":\"$INVP\"}"
R "'$L1'" INVOICE_MISMATCH "{\"t\":\"revdir\",\"direction\":\"PRZYCHOD\"}"
R "'$L1'" INVOICE_MISMATCH "{\"t\":\"nodir\"}"
R "'$L1'" SEQUENCE '{"t":"seq"}'
R null FERRY '{"t":"ferry"}'
R "'$L1'" SILENT_VEHICLE '{"t":"silent1"}'
R "'$L4'" SILENT_VEHICLE '{"t":"silent4"}'
R "'$L4'" FERRY '{"t":"ferry4"}'
R null PERMIT "{\"t\":\"permcrx\",\"carrier_org_id\":\"$OCRX\"}"
R "'$L1'" TEST_NOWY '{"t":"nowy"}'
A() { Q "select audience from risk_signals where detail->>'t'='$1'"; }
chk "odbiorcy: faktura kosztowa → HHL_PRZEWOZNIK"       "$(A cost)" HHL_PRZEWOZNIK
chk "odbiorcy: faktura przychodowa → HHL_KLIENT"        "$(A rev)" HHL_KLIENT
chk "odbiorcy: kierunek w szczegółach PRZYCHOD → HHL_KLIENT" "$(A revdir)" HHL_KLIENT
chk "odbiorcy: rozbieżność bez kierunku → HHL"          "$(A nodir)" HHL
chk "odbiorcy: SEQUENCE → HHL_KLIENT"                   "$(A seq)" HHL_KLIENT
chk "odbiorcy: FERRY → WSZYSCY"                         "$(A ferry)" WSZYSCY
chk "odbiorcy: SILENT_VEHICLE → HHL_PRZEWOZNIK"         "$(A silent1)" HHL_PRZEWOZNIK
chk "odbiorcy: nowy, nieprzypisany rodzaj → HHL"        "$(A nowy)" HHL
C() { echo "select count(*) from risk_signals where detail->>'t'='$1'"; }
val "KSH nie widzi ryzyka faktury kosztowej"            $KSH "$(C cost)" 0
val "KSH widzi ryzyko faktury przychodowej"             $KSH "$(C rev)" 1
val "KSH widzi kolejność montażu"                        $KSH "$(C seq)" 1
val "KSH nie widzi ryzyka przewoźnika (cichy pojazd)"   $KSH "$(C silent1)" 0
val "SCX widzi ryzyko swojej faktury kosztowej"         $SCX "$(C cost)" 1
val "SCX nie widzi ryzyka faktury przychodowej"         $SCX "$(C rev)" 0
val "SCX nie widzi kolejności montażu"                  $SCX "$(C seq)" 0
val "SCX widzi cichy pojazd swojego transportu"         $SCX "$(C silent1)" 1
val "SCX nie widzi ryzyk transportu innego przewoźnika (cichy)" $SCX "$(C silent4)" 0
val "SCX nie widzi ryzyk transportu innego przewoźnika (prom)"  $SCX "$(C ferry4)" 0
val "SCX nie widzi ryzyka bez transportu innej firmy"   $SCX "$(C permcrx)" 0
val "CRX widzi ryzyko bez transportu swojej firmy"      $CRX "$(C permcrx)" 1
val "CRX widzi cichy pojazd swojego transportu"         $CRX "$(C silent4)" 1
val "SCX widzi ryzyko korytarza bez transportu"         $SCX "$(C ferry)" 1
val "KSH widzi ryzyko korytarza"                         $KSH "$(C ferry)" 1
val "nowy rodzaj: HHL widzi"                             $HHL "$(C nowy)" 1
val "nowy rodzaj: KSH nie widzi"                         $KSH "$(C nowy)" 0
val "nowy rodzaj: SCX nie widzi"                         $SCX "$(C nowy)" 0
val "HHL nie nadpisze odbiorców (SEQUENCE z WSZYSCY → HHL_KLIENT)" $HHL "insert into risk_signals (project_id, load_id, kind, severity, title, detail, audience) values ('$P','$L1','SEQUENCE','LOW','x','{\"t\":\"ovr\"}','WSZYSCY'); select audience from risk_signals where detail->>'t'='ovr'" HHL_KLIENT
err "anon nie czyta ryzyk"                               $HHL "set local role anon; select count(*) from risk_signals" "permission denied|0"

echo; echo "[2.4] Numer zlecenia 48 h przed załadunkiem — ostrzeżenie, bez blokady"
L5=33333333-0000-0000-0000-000000000005
sys "insert into loads (id, project_id, carrier_org_id, order_no, plan_load_from) values ('$L5','$P','$OSCX','KSH/5', now() + interval '47 hours')"
chk "detect_missing_order_numbers: 2 ryzyka (HHL + przewoźnik)" "$(Q "select detect_missing_order_numbers()")" 2
chk "brak numeru HHL → odbiorcy HHL"                     "$(Q "select audience from risk_signals where load_id='$L5' and detail->>'side'='HHL'")" HHL
chk "brak numeru przewoźnika → odbiorcy HHL_PRZEWOZNIK"  "$(Q "select audience from risk_signals where load_id='$L5' and detail->>'side'='CARRIER'")" HHL_PRZEWOZNIK
val "SCX widzi ryzyko swojego numeru"                    $SCX "select count(*) from risk_signals where load_id='$L5' and detail->>'side'='CARRIER'" 1
val "SCX nie widzi ryzyka numeru HHL"                    $SCX "select count(*) from risk_signals where load_id='$L5' and detail->>'side'='HHL'" 0
val "KSH nie widzi żadnego z nich"                       $KSH "select count(*) from risk_signals where load_id='$L5'" 0
chk "przypomnienie do przewoźnika (SCX)"                 "$(Q "select count(*) from notifications where load_id='$L5' and template='ORDER_NO_MISSING' and payload->>'side'='CARRIER' and user_id=(select id from app_users where auth_id='$SCX')")" 1
chk "przypomnienie do HHL"                               "$(Q "select count(*) from notifications where load_id='$L5' and template='ORDER_NO_MISSING' and payload->>'side'='HHL' and user_id=(select id from app_users where auth_id='$HHL')")" 1
chk "przewoźnik bez przypomnienia o numerze HHL"         "$(Q "select count(*) from notifications where load_id='$L5' and payload->>'side'='HHL' and user_id=(select id from app_users where auth_id='$SCX')")" 0
val "brak blokady: HHL przestawia na RESOURCES_PENDING bez numerów (47 h)" $HHL "update loads set status='RESOURCES_PENDING' where id='$L5' returning status" RESOURCES_PENDING
err "blokady Q10 zostają: READY bez numeru HHL odrzucone" $HHL "update loads set status='READY' where id='$L5'" "numeru zlecenia"

echo; echo "[2.3] Token kierowcy — skrót, jeden transport, ważność, odwołanie, limit, bez cen"
L6=33333333-0000-0000-0000-000000000006; L7=33333333-0000-0000-0000-000000000007
for x in 6 7; do sys "insert into loads (id, project_id, carrier_org_id, order_no, hhl_order_no, carrier_order_no) values ('33333333-0000-0000-0000-00000000000$x','$P','$OSCX','KSH/$x','HHL/$x','SCX/$x')"; done
sys "update loads set status='IN_TRANSIT_PL' where id in ('$L6','$L7')"
sys "insert into load_cost (load_id, base_amount) values ('$L6', 3000)"
tok() { $PSQL -c "begin; set local role authenticated; set local request.jwt.claim.sub='$1'; select issue_driver_token('$2'); commit;" 2>&1 | grep '^wt_'; }
err "anon nie wyda tokenu"                               "" "set local role anon; select issue_driver_token('$L6')" "permission denied"
err "KSH nie wyda tokenu"                                $KSH "select issue_driver_token('$L6')" "wyłącznie przewoźnik"
err "inny przewoźnik (CRX) nie wyda tokenu dla SCX"      $CRX "select issue_driver_token('$L6')" "wyłącznie przewoźnik"
TA=$(tok $SCX $L6); TB=$(tok $HHL $L7)
chk "token: 244 bity losowe (wt_ + 64 znaki hex)"        "$(echo -n "$TA" | grep -cE '^wt_[0-9a-f]{64}$')" 1
chk "w bazie wyłącznie skrót SHA-256, nie token"         "$(Q "select count(*) from driver_tokens where token_hash = sha256(convert_to('$TA','UTF8')) and position('${TA#wt_}' in encode(token_hash,'hex')) = 0")" 1
chk "ważność ≤ 14 dni od wydania"                        "$(Q "select bool_and(expires_at <= issued_at + interval '14 days') from driver_tokens")" t
err "anon nie czyta tabeli tokenów"                      "" "set local role anon; select count(*) from driver_tokens" "permission denied"
err "anon nie wywoła sprawdzenia tokenu wprost"          "" "set local role anon; select driver_token_load('$TA')" "permission denied"
ROLE=anon val "kierowca: pozycja do własnego transportu (anon, API bazy)" "" "select count(*) >= 0 from driver_post_position('$TA', '$L6', 54.0, 18.5, now() - interval '1 minute', 10, 60, 90)" t commit
chk "pozycja zapisana (DRIVER_PWA, via driver_token)"    "$(Q "select count(*) from positions where load_id='$L6' and source='DRIVER_PWA'")" 1
ROLE=anon err "token transportu A odrzucony przy pozycji do B" "" "select * from driver_post_position('$TA', '$L7', 54.0, 18.5, now(), 10, 60, 90)" "nie dotyczy tego transportu"
ROLE=anon err "token transportu A odrzucony przy zdarzeniu w B" "" "select driver_post_event('$TA', '$L7', 'MILESTONE_LOADED')" "nie dotyczy tego transportu"
ROLE=anon err "zdarzenie spoza listy odrzucone"         "" "select driver_post_event('$TA', '$L6', 'GEOFENCE_ENTER')" "Niedozwolone"
ROLE=anon val "kierowca: zdarzenie etapu (Załadowany)"  "" "select driver_post_event('$TA', '$L6', 'MILESTONE_LOADED')" MILESTONE_LOADED commit
chk "zdarzenie zapisane w load_events"                   "$(Q "select count(*) from load_events where load_id='$L6' and event_type='MILESTONE_LOADED'")" 1
ROLE=anon val "instrukcje: własny transport"            "" "select driver_get_instructions('$TA')->>'order_no'" KSH/6
ROLE=anon val "instrukcje: żadnego pola cenowego"       "" "select count(*) from jsonb_object_keys(driver_get_instructions('$TA')) k where k ~* '(cost|price|revenue|margin|amount|eur|pln|rate|baf|fuel|total|invoice|kwot|cen)'" 0
ROLE=anon val "instrukcje: żadnej kwoty w wartościach"  "" "select position('3000' in driver_get_instructions('$TA')::text)" 0
ROLE=anon err "losowy token odrzucony"                  "" "select driver_get_instructions('wt_00ff')" "nieważny"
TA2=$(tok $SCX $L6)
ROLE=anon err "nowy token unieważnia poprzedni"         "" "select driver_get_instructions('$TA')" "odwołany"
ROLE=anon val "nowy token działa"                        "" "select driver_get_instructions('$TA2')->>'order_no'" KSH/6
val "przewoźnik odwołuje token swojego transportu"       $SCX "select revoke_driver_token('$L6')" 1 commit
ROLE=anon err "token odwołany odrzucony"                "" "select * from driver_post_position('$TA2', '$L6', 54.0, 18.5, now(), 10, 60, 90)" "odwołany"
err "inny przewoźnik nie odwoła"                         $CRX "select revoke_driver_token('$L7')" "wyłącznie przewoźnik"
TA3=$(tok $SCX $L6)
val "HHL odwołuje token"                                 $HHL "select revoke_driver_token('$L6')" 1 commit
ROLE=anon err "token odwołany przez HHL odrzucony"      "" "select driver_get_instructions('$TA3')" "odwołany"
sys "update driver_tokens set expires_at = now() - interval '1 second' where token_hash = sha256(convert_to('$TB','UTF8'))"
ROLE=anon err "token wygasły odrzucony"                 "" "select driver_get_instructions('$TB')" "wygasł"
TB2=$(tok $HHL $L7)
sys "update loads set status='UNLOADED', actual_delivery_at = now() - interval '25 hours' where id='$L7'"
ROLE=anon err "token ponad 24 h po rozładunku odrzucony" "" "select driver_get_instructions('$TB2')" "24 h po rozładunku"
err "wydanie ponad 24 h po rozładunku odrzucone"         $HHL "select issue_driver_token('$L7')" "24 h po rozładunku"
TA4=$(tok $SCX $L6)
sys "update driver_tokens set window_count = 120, window_start = now() where token_hash = sha256(convert_to('$TA4','UTF8'))"
ROLE=anon err "limit zapytań: 121. wywołanie w godzinie odrzucone" "" "select driver_get_instructions('$TA4')" "Limit zapytań"
sys "update driver_tokens set window_start = now() - interval '61 minutes' where token_hash = sha256(convert_to('$TA4','UTF8'))"
ROLE=anon val "limit zapytań: nowe okno po godzinie"    "" "select driver_get_instructions('$TA4')->>'order_no'" KSH/6
ROLE=anon val "Rozładowany: zdarzenie przyjęte"         "" "select driver_post_event('$TA4', '$L6', 'MILESTONE_UNLOADED', now() - interval '5 minutes')" MILESTONE_UNLOADED commit
chk "Rozładowany: status UNLOADED z datą rozładunku"     "$(Q "select status||':'||(actual_delivery_at is not null) from loads where id='$L6'")" "UNLOADED:true"
chk "wydanie i odwołanie w dzienniku audytu"             "$(Q "select count(*) >= 2 from audit_log where action in ('DRIVER_TOKEN_ISSUE','DRIVER_TOKEN_REVOKE')")" t
TP=$(tok $SCX $L6)
err "zdjęcie: anon nie zarejestruje dokumentu wprost"    "" "set local role anon; select * from driver_create_document('$TP', '$L6', 'CMR', 'a.jpg', 'image/jpeg', 1000)" "permission denied"
ROLE=service_role err "zdjęcie: token A odrzucony dla B" "" "select * from driver_create_document('$TP', '$L7', 'CMR', 'a.jpg', 'image/jpeg', 1000)" "nie dotyczy tego transportu"
ROLE=service_role err "zdjęcie: kategoria spoza listy (faktura) odrzucona" "" "select * from driver_create_document('$TP', '$L6', 'INVOICE', 'a.pdf', 'application/pdf', 1000)" "wyłącznie CMR"
ROLE=service_role err "zdjęcie: PDF > 10 MB odrzucony"  "" "select * from driver_create_document('$TP', '$L6', 'POD', 'a.pdf', 'application/pdf', 10485761)" "10 MB"
ROLE=service_role val "zdjęcie: rejestracja z tokenem (koszyk zdjęć)" "" "select bucket from driver_create_document('$TP', '$L6', 'LASHING_PHOTO', 'mocowanie.jpg', 'image/jpeg', 350000)" zdjecia

echo; echo "[PR1] keep_alive() — znacznik w system_heartbeat"
sys "update system_heartbeat set beat_at = now() - interval '7 hours', beats = 0"
ROLE=anon val "anon (Worker, klucz publiczny) wywołuje keep_alive()" "" "select keep_alive('worker')->>'ok'" true commit
chk "znacznik odświeżony (≤ 5 s temu), licznik 1"        "$(Q "select (beat_at > now() - interval '5 seconds')||':'||beats||':'||source from system_heartbeat")" "true:1:worker"
ROLE=anon val "drugie wywołanie w 60 s: odpowiedź ok, bez zapisu" "" "select keep_alive('worker')->>'beats'" 1 commit
err "anon nie czyta tabeli znacznika wprost"             "" "set local role anon; select * from system_heartbeat" "permission denied"
err "anon nie zmienia tabeli znacznika wprost"           "" "set local role anon; update system_heartbeat set beats = 0" "permission denied"

echo; echo "[PR4] usage-check — historia i progi 70% / 85%"
NP=$(Q "select count(*) from projects")
err "anon nie zapisze pomiaru"                           "" "set local role anon; select record_usage('DB_BYTES', 1, 10)" "permission denied"
err "zalogowany (HHL) nie zapisze pomiaru wprost"        $HHL "select record_usage('DB_BYTES', 1, 10)" "permission denied"
ROLE=service_role val "69,99% → OK, bez ryzyka"          "" "select record_usage('DB_BYTES', 6999, 10000)->>'level'" OK commit
chk "69,99%: 0 ryzyk USAGE_LIMIT"                        "$(Q "select count(*) from risk_signals where kind='USAGE_LIMIT'")" 0
ROLE=service_role val "72% → WARN, bez e-maila"          "" "select (record_usage('DB_BYTES', 360000000, 500000000)->>'level')||':'||(record_usage('DB_BYTES', 360000000, 500000000)->>'email')" WARN:false commit
chk "72%: ryzyko MEDIUM na każdy projekt, odbiorca HHL"  "$(Q "select count(*)||':'||min(severity::text)||':'||min(audience::text) from risk_signals where kind='USAGE_LIMIT' and resolved_at is null")" "$NP:MEDIUM:HHL"
val "KSH nie widzi ryzyka limitu (tylko HHL)"            $KSH "select count(*) from risk_signals where kind='USAGE_LIMIT'" 0
val "HHL widzi ryzyko limitu"                            $HHL "select count(*) > 0 from risk_signals where kind='USAGE_LIMIT'" t
ROLE=service_role val "86% → HIGH i e-mail"              "" "select (r->>'level')||':'||(r->>'email') from record_usage('DB_BYTES', 430000000, 500000000) r" HIGH:true commit
chk "86%: to samo ryzyko podniesione do HIGH (bez duplikatów)" "$(Q "select count(*)||':'||min(severity::text) from risk_signals where kind='USAGE_LIMIT' and resolved_at is null")" "$NP:HIGH"
chk "tytuł po polsku z procentem"                        "$(Q "select min(title) from risk_signals where kind='USAGE_LIMIT' and resolved_at is null")" "Limit planu darmowego: baza danych 86,0% — przekroczone 85%"
ROLE=service_role val "następny dzień 87%: e-mail nie powtarza się" "" "select record_usage('DB_BYTES', 435000000, 500000000)->>'email'" false commit
ROLE=service_role val "inna metryka (pliki) 90%: własny e-mail" "" "select record_usage('STORAGE_BYTES', 900000000, 1000000000)->>'email'" true commit
ROLE=service_role val "spadek do 50% → OK"               "" "select record_usage('DB_BYTES', 250000000, 500000000)->>'level'" OK commit
chk "50%: ryzyko bazy zamknięte, ryzyko plików otwarte"  "$(Q "select count(*) filter (where detail->>'metric'='DB_BYTES')||':'||count(*) filter (where detail->>'metric'='STORAGE_BYTES') from risk_signals where kind='USAGE_LIMIT' and resolved_at is null")" "0:$NP"
chk "historia: 7 pomiarów z procentem (trend)"          "$(Q "select count(*)||':'||max(pct) from usage_history")" "7:90.00"
val "HHL czyta historię"                                 $HHL "select count(*) from usage_history" 7
val "przewoźnik nie czyta historii"                      $SCX "select count(*) from usage_history" 0
ROLE=service_role val "usage_measure: rozmiar bazy > 0"  "" "select (usage_measure()->>'db_bytes')::bigint > 0" t
err "anon nie wywoła usage_measure"                      "" "set local role anon; select usage_measure()" "permission denied"

echo; echo "[PR5] Pozycje GPS — limit 60 s w process_position, retencja 30 dni po rozładunku, bajty na 1000"
L8=33333333-0000-0000-0000-000000000008; L9=33333333-0000-0000-0000-000000000009; L10=33333333-0000-0000-0000-00000000000a
for x in $L8 $L9 $L10; do sys "insert into loads (id, project_id, carrier_org_id, order_no) values ('$x','$P','00000000-0000-0000-0000-00000000a003','KSH/${x: -2}')"; done
T0="2026-09-20 10:00:00+00"
ROLE=service_role val "pierwszy punkt zapisany"          "" "select count(*) from process_position('$L8', 53.0, 18.0, '$T0'); select count(*) from positions where load_id='$L8'" 1 commit
ROLE=service_role val "punkt po 30 s pominięty (bez zapisu)" "" "select count(*) from process_position('$L8', 53.001, 18.0, timestamptz '$T0' + interval '30 seconds'); select count(*) from positions where load_id='$L8'" 1 commit
ROLE=service_role val "punkt po 59 s pominięty"          "" "select count(*) from process_position('$L8', 53.001, 18.0, timestamptz '$T0' + interval '59 seconds'); select count(*) from positions where load_id='$L8'" 1 commit
ROLE=service_role val "punkt po 60 s zapisany"           "" "select count(*) from process_position('$L8', 53.002, 18.0, timestamptz '$T0' + interval '60 seconds'); select count(*) from positions where load_id='$L8'" 2 commit
ROLE=service_role val "inny transport w tej samej sekundzie — niezależny" "" "select count(*) from process_position('$L9', 53.0, 18.0, timestamptz '$T0' + interval '30 seconds'); select count(*) from positions where load_id='$L9'" 1 commit
ROLE=service_role val "powtórka tego samego punktu (retry) — bez duplikatu" "" "select count(*) from process_position('$L8', 53.002, 18.0, timestamptz '$T0' + interval '60 seconds'); select count(*) from positions where load_id='$L8'" 2 commit
sys "set session_replication_role = replica; update loads set status='UNLOADED', actual_delivery_at = now() - interval '31 days' where id='$L8'"
sys "set session_replication_role = replica; update loads set status='UNLOADED', actual_delivery_at = now() - interval '29 days' where id='$L9'"
sys "insert into positions (load_id, ts, geom_raw, source) values ('$L10', now() - interval '200 days', st_setsrid(st_makepoint(18,53),4326), 'TELEMATICS_API')"
err "HHL nie wywoła purge_personal_data (usterka: domyślne EXECUTE)" $HHL "select purge_personal_data(0)" "permission denied"
err "anon nie wywoła purge_personal_data"               "" "set local role anon; select purge_personal_data(0)" "permission denied"
sys "select purge_personal_data()"
chk "rozładowany 31 dni temu: pozycje skasowane"         "$(Q "select count(*) from positions where load_id='$L8'")" 0
chk "rozładowany 29 dni temu: pozycje zostają"           "$(Q "select count(*) from positions where load_id='$L9'")" 1
chk "transport w drodze: stare pozycje zostają"          "$(Q "select count(*) from positions where load_id='$L10'")" 1
B0=$(Q "select pg_total_relation_size('positions')")
sys "insert into positions (load_id, ts, geom_raw, speed_kmh, heading_deg, ignition, source, raw) select '$L10', now() - interval '100 days' + g * interval '2 minutes', st_setsrid(st_makepoint(18 + g*0.001, 53 + g*0.0005),4326), 72.5, 180, true, 'DRIVER_PWA', jsonb_build_object('accuracy', 12, 'via', 'driver_token') from generate_series(1,10000) g"
sys "vacuum analyze positions"
B1=$(Q "select pg_total_relation_size('positions')")
PB=$(( (B1 - B0) / 10 )); echo "    bajty na 1000 pozycji (tabela + 4 indeksy, pomiar na 10 000): $PB"; echo "$PB" > /tmp/pr5_bytes_per_1000
chk "1000 pozycji z indeksami < 500 kB"                  "$([ "$PB" -gt 0 ] && [ "$PB" -lt 512000 ] && echo t || echo f)" t

echo; echo "WYNIK: $ok OK, $fail FAIL"
