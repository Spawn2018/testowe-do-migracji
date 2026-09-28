#!/usr/bin/env bash
# TOWER — I-2A (0049): NULL zawsze oznacza odmowę.
# Każda funkcja public (poza rozszerzeniami) z EXECUTE dla authenticated wywołana przez:
#   nieaktywne konto HHL, nieaktywne konto KSH, nieaktywne konto przewoźnika (SCX) i konto bez wiersza app_users.
# Lista wywołań: tests/db/null-guard-calls.txt — funkcja z katalogu bez wpisu = test czerwony.
# Kontrola pozytywna: to samo wywołanie przez AKTYWNE konto HHL nie daje komunikatu odmowy (strażnik działa selektywnie).
# Użycie: PGADMIN=postgres://postgres@localhost:5433/postgres bash tests/db/nullguard.sh
set -e
cd "$(git rev-parse --show-toplevel)"
ADMIN=${PGADMIN:-postgres://postgres@localhost:5433/postgres}
. "$(git rev-parse --show-toplevel)/tests/db/local-only.sh"
DB=tower_test_nullguard; URL="${ADMIN%/*}/$DB"
psql "$ADMIN" -q -c "drop database if exists $DB" -c "create database $DB"
psql "$URL" -q -v ON_ERROR_STOP=1 -f tests/db/supabase_stub.sql
for f in supabase/migrations/*.sql; do psql "$URL" -q -v ON_ERROR_STOP=1 -f "$f" >/dev/null 2>&1 || { echo "MIGRACJA $f: błąd"; exit 1; }; done
psql "$URL" -q -v ON_ERROR_STOP=1 -f tests/db/seed.sql
set +e
PSQL="psql $URL -Atq"
HHL=11111111-0000-0000-0000-000000000001; KSH=11111111-0000-0000-0000-000000000002; SCX=11111111-0000-0000-0000-000000000003
NOROW=99999999-0000-0000-0000-0000000000ff
P=22222222-0000-0000-0000-000000000001; L1=33333333-0000-0000-0000-000000000001; L2=33333333-0000-0000-0000-000000000002
INV=44444444-0000-0000-0000-0000000000ee
KSHID=$($PSQL -c "select id from app_users where auth_id='$KSH'")
HHLID=$($PSQL -c "select id from app_users where auth_id='$HHL'")
DOC=$($PSQL -c "insert into documents (project_id, load_id, category, storage_path, file_name, mime_type, size_bytes, uploaded_by) values ('$P','$L2','CMR','dokumenty/t/ng.pdf','ng.pdf','application/pdf',100,'$HHLID') returning id" | head -1)
DOCOBJ=t/ng.pdf
NOTIF=$($PSQL -c "insert into notifications (channel, recipient, user_id, template) values ('IN_APP','hhl@test','$HHLID','TEST') returning id" | head -1)
PERMIT=$($PSQL -c "insert into permits (project_id, country, permit_no, valid_from, valid_until) values ('$P','SE','P-1',current_date-1,current_date+30) returning id" | head -1)
ok=0; fail=0; denied=0; total=0; pure=0; posok=0; posna=0
say() { echo "  $1"; }
call() { $PSQL -c "begin; set local role authenticated; set local request.jwt.claim.sub='$1'; $2; rollback;" 2>&1 | grep -vE '^(BEGIN|SET|ROLLBACK)$' | tr '\n' ' ' | sed 's/ *$//'; }

SNAPQ="select (select count(*) from audit_log)||'/'||(select count(*) from import_column_templates)||'/'||(select count(*) from loads)||'/'||(select count(*) from invoices)||'/'||(select count(*) from notifications)"
SNAP0=$($PSQL -c "$SNAPQ")
echo; echo "[I-2A] kompletność listy wywołań"
CAT=$($PSQL -c "select distinct p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind='f' and not exists (select 1 from pg_depend d where d.objid=p.oid and d.deptype='e') and has_function_privilege('authenticated', p.oid, 'execute') order by 1")
LIST=$(grep -vE '^\s*(#|$)' tests/db/null-guard-calls.txt | awk -F' \\| ' '{print $1}' | sort -u)
MISS=$(comm -23 <(echo "$CAT") <(echo "$LIST") | tr '\n' ' ')
NFN=$(echo "$CAT" | grep -c .)
if [ -z "$MISS" ]; then ok=$((ok+1)); say "OK    każda z $NFN funkcji authenticated ma wpis w null-guard-calls.txt"; else fail=$((fail+1)); say "FAIL  funkcje bez wpisu: $MISS"; fi

echo; echo "[I-2A] konta bez aktywnego wiersza app_users: nieaktywny HHL, KSH, SCX + brak app_users"
$PSQL -c "update app_users set active=false where auth_id in ('$HHL','$KSH','$SCX')" >/dev/null
while IFS='|' read -r name kind sql exp; do
  name=$(echo $name); kind=$(echo $kind); exp=$(echo "$exp" | sed 's/^ *//;s/ *$//')
  sql=$(echo "$sql" | sed "s/\$KSHID/$KSHID/g;s/\$L1/$L1/g;s/\$L2/$L2/g;s/\$P\b/$P/g;s/\$INV/$INV/g;s/\$DOCOBJ/${DOCOBJ//\//\\/}/g;s/\$DOC/$DOC/g;s/\$NOTIF/$NOTIF/g;s/\$PERMIT/$PERMIT/g")
  if [ "$kind" = PURE ]; then pure=$((pure+1)); continue; fi
  for acc in HHL:$HHL KSH:$KSH SCX:$SCX BRAK_APP_USERS:$NOROW; do
    who=${acc%%:*}; sub=${acc#*:}; total=$((total+1))
    out=$(call "$sub" "$sql")
    case $kind in
      GUARD|TOKEN) if echo "$out" | grep -q "ERROR" && echo "$out" | grep -qE "$exp"; then good=1; else good=0; fi ;;
      EMPTY) if [ "$out" = "$exp" ]; then good=1; else good=0; fi ;;
    esac
    if [ $good = 1 ]; then denied=$((denied+1)); ok=$((ok+1)); else fail=$((fail+1)); say "FAIL  $name × $who  →  $out"; fi
  done
done < <(grep -vE '^\s*(#|$)' tests/db/null-guard-calls.txt)
say "odmowy: $denied/$total (funkcje z kontrolą: $((total/4)) × 4 konta); czyste obliczeniowe bez dostępu do danych: $pure"

echo; echo "[I-2A] kontrola pozytywna: aktywny HHL nie dostaje komunikatu odmowy"
$PSQL -c "update app_users set active=true where auth_id='$HHL'" >/dev/null
while IFS='|' read -r name kind sql exp; do
  name=$(echo $name); kind=$(echo $kind); exp=$(echo "$exp" | sed 's/^ *//;s/ *$//')
  [ "$kind" = GUARD ] || [ "$kind" = EMPTY ] || continue
  sql=$(echo "$sql" | sed "s/\$KSHID/$KSHID/g;s/\$L1/$L1/g;s/\$L2/$L2/g;s/\$P\b/$P/g;s/\$INV/$INV/g;s/\$DOCOBJ/${DOCOBJ//\//\\/}/g;s/\$DOC/$DOC/g;s/\$NOTIF/$NOTIF/g;s/\$PERMIT/$PERMIT/g")
  out=$(call "$HHL" "$sql")
  if [ "$kind" = GUARD ]; then
    if echo "$out" | grep -qE "$exp"; then fail=$((fail+1)); say "FAIL  $name: aktywny HHL odrzucony → $out"; else ok=$((ok+1)); posok=$((posok+1)); fi
  else
    if [ "$out" != "$exp" ]; then ok=$((ok+1)); posok=$((posok+1)); else posna=$((posna+1)); say "n/d   $name: aktywny HHL też '$out' (dane zamknięte dla interfejsu albo brak danych)"; fi
  fi
done < <(grep -vE '^\s*(#|$)' tests/db/null-guard-calls.txt)
say "kontrola pozytywna: $posok zgodnych, $posna n/d"
SNAP1=$($PSQL -c "$SNAPQ")
if [ "$SNAP0" = "$SNAP1" ]; then ok=$((ok+1)); say "OK    wywołania wycofane (rollback): audit_log/szablony/loads/faktury/powiadomienia bez zmian ($SNAP1)"; else fail=$((fail+1)); say "FAIL  wywołania zmieniły dane: $SNAP0 → $SNAP1"; fi

echo; echo "[I-2A] helpery logiczne ściśle true/false"
chk() { if [ "$2" = "$3" ]; then ok=$((ok+1)); say "OK    $1"; else fail=$((fail+1)); say "FAIL  $1 (otrzymano: $2, oczekiwano: $3)"; fi; }
chk "is_hhl()/can_see_margin() dla braku konta: false/false (nie NULL)" "$(call $NOROW "select is_hhl()::text||'/'||can_see_margin()::text")" "false/false"
chk "aktywny HHL_ADMIN: is_hhl()=true, can_see_margin()=true" "$(call $HHL "select is_hhl()::text||'/'||can_see_margin()::text")" "true/true"
chk "keep_alive dla anon działa dalej (worker)" "$($PSQL -c "begin; set local role anon; select (keep_alive('test')->>'ok'); rollback;" 2>&1 | grep -vE '^(BEGIN|SET|ROLLBACK)$')" "true"

echo; echo "[I-2A] test statyczny definicji (baza po migracjach)"
node tests/db/null-guard-static.mjs --db "$URL" >/tmp/ng_static.out 2>&1; rc=$?
if [ $rc = 0 ]; then ok=$((ok+1)); say "OK    $(tail -1 /tmp/ng_static.out)"; else fail=$((fail+1)); say "FAIL  $(cat /tmp/ng_static.out | tr '\n' ' ')"; fi
echo; echo "WYNIK: $ok OK, $fail FAIL"
