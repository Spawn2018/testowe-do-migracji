#!/usr/bin/env bash
# TOWER — test bazy wydania 1.0 (ANEKS 3 §2.1–§2.4, ANEKS 4 PR1–PR7).
# Własna, czysta baza: atrapa Supabase (+ rola service_role jak w Supabase) → migracje → seed testowy.
# Użycie: PGADMIN=postgres://postgres@localhost:5433/postgres bash tests/db/release.sh
# UWAGA: supabase_stub.sql NIGDY nie uruchamiaj na Supabase.
set -e
ADMIN=${PGADMIN:-postgres://postgres@localhost:5433/postgres}
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

echo; echo "WYNIK: $ok OK, $fail FAIL"
