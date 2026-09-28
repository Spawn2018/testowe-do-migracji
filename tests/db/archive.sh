#!/usr/bin/env bash
# TOWER — ANEKS 4 PR7: PDF ≤ 10 MB, kandydaci do archiwizacji (od 70% miejsca), oznaczanie archiwum.
# Użycie: PGADMIN=postgres://postgres@localhost:5433/postgres bash tests/db/archive.sh
set -e
cd "$(git rev-parse --show-toplevel)"
ADMIN=${PGADMIN:-postgres://postgres@localhost:5433/postgres}
. "$(git rev-parse --show-toplevel)/tests/db/local-only.sh"
DB=tower_test_archive; URL="${ADMIN%/*}/$DB"
psql "$ADMIN" -q -c "drop database if exists $DB" -c "create database $DB"
psql "$URL" -q -v ON_ERROR_STOP=1 -f tests/db/supabase_stub.sql
for f in supabase/migrations/*.sql; do psql "$URL" -q -v ON_ERROR_STOP=1 -f "$f" >/dev/null 2>&1 || { echo "MIGRACJA $f: błąd"; exit 1; }; done
psql "$URL" -q -v ON_ERROR_STOP=1 -f tests/db/seed.sql
set +e
PSQL="psql $URL -Atq"
SCX=11111111-0000-0000-0000-000000000003; HHL=11111111-0000-0000-0000-000000000001
L1=33333333-0000-0000-0000-000000000001; L2=33333333-0000-0000-0000-000000000002; P=22222222-0000-0000-0000-000000000001
INV_UNPAID=44444444-0000-0000-0000-00000000000c; INV_PAID=44444444-0000-0000-0000-0000000000ee
ok=0; fail=0
run() { $PSQL -v ON_ERROR_STOP=1 -c "begin; set local role ${ROLE:-authenticated}; set local request.jwt.claim.sub='$1'; $2; rollback;" 2>&1; }
err() { out=$(run "$2" "$3"); if echo "$out" | grep -qiE "$4"; then ok=$((ok+1)); echo "  OK    $1"; else fail=$((fail+1)); echo "  FAIL  $1  →  $(echo "$out" | tail -1)"; fi; }
Q() { $PSQL -c "$1" 2>&1 | tail -1; }
chk() { if [ "$2" = "$3" ]; then ok=$((ok+1)); echo "  OK    $1"; else fail=$((fail+1)); echo "  FAIL  $1  (otrzymano: $2, oczekiwano: $3)"; fi; }
d() { echo "dddddddd-0000-0000-0000-00000000000$1"; }

$PSQL -c "set session_replication_role = replica;
  update loads set actual_delivery_at = now() - interval '100 days' where id = '$L1';
  update loads set actual_delivery_at = now() - interval '30 days'  where id = '$L2';
  update invoices set payment_status = 'OPLACONA' where id = '$INV_PAID';
  insert into documents (id, project_id, load_id, category, storage_path, file_name, size_bytes, uploaded_at, archived_at) values
   ('$(d 1)','$P','$L1','CMR',     'dokumenty/a/1.pdf','cmr.pdf',   300,now()-interval '99 days', null),
   ('$(d 2)','$P','$L2','CMR',     'dokumenty/a/2.pdf','cmr2.pdf',  100,now()-interval '98 days', null),
   ('$(d 3)','$P','$L1','INVOICE', 'faktury/a/3.pdf',  'fv-nz.pdf', 100,now()-interval '97 days', null),
   ('$(d 4)','$P','$L1','POD',     'dokumenty/a/4.pdf','pod.pdf',   100,now()-interval '96 days', null),
   ('$(d 5)','$P','$L1','INVOICE', 'faktury/a/5.pdf',  'fv-ok.pdf', 100,now()-interval '95 days', null),
   ('$(d 6)','$P','$L1','CMR',     'dokumenty/a/6.pdf','stary.pdf', 999,now()-interval '94 days', now()),
   ('$(d 7)','$P','$L1','CMR',     '-',                'rej.pdf',   999,now()-interval '93 days', null);
  insert into invoice_documents (invoice_id, document_id, role) values
   ('$INV_UNPAID','$(d 3)','FAKTURA_PDF'), ('$INV_UNPAID','$(d 4)','POD'), ('$INV_PAID','$(d 5)','FAKTURA_PDF')" >/dev/null
# zajęte (bez zarchiwizowanych i niewgranych): 300+100+100+100+100 = 700 B

echo; echo "[PR7] PDF ≤ 10 MB"
err "PDF 10 MB + 1 B odrzucony („za duży”)"           $SCX "select * from create_document('$L1','CMR','a.pdf','application/pdf',10485761)" "za duży"
err "PDF 10 MB przyjęty"                               $SCX "select count(*) from create_document('$L1','CMR','a.pdf','application/pdf',10485760)" "^1$"
err "zdjęcie 12 MB (przed kompresją) nadal przyjęte"   $SCX "select count(*) from create_document('$L1','LASHING_PHOTO','a.jpg','image/jpeg',12582912)" "^1$"

echo; echo "[PR7] Kandydaci do archiwizacji"
chk "zajęte 700 B z 1001 B (69,9%) → brak kandydatów"  "$(Q "select count(*) from document_archive_candidates(1001)")" 0
chk "zajęte 700 B z 1000 B (70%) → start"             "$(Q "select string_agg(storage_path, ',' order by uploaded_at) from document_archive_candidates(1000)")" "dokumenty/a/1.pdf,faktury/a/5.pdf"
chk "rozładowany 30 dni temu — pomija"                  "$(Q "select count(*) from document_archive_candidates(1000) where id='$(d 2)'")" 0
chk "faktura nieopłacona i dokument przy niej — pomija" "$(Q "select count(*) from document_archive_candidates(1000) where id in ('$(d 3)','$(d 4)')")" 0
chk "zarchiwizowany i niewgrany — pomija"               "$(Q "select count(*) from document_archive_candidates(1000) where id in ('$(d 6)','$(d 7)')")" 0
chk "limit p_max"                                       "$(Q "select count(*) from document_archive_candidates(1000, 1)")" 1
err "zalogowany nie wywoła listy kandydatów"            $HHL "select * from document_archive_candidates()" "permission denied"
err "anon nie wywoła listy kandydatów"                  "" "set local role anon; select * from document_archive_candidates()" "permission denied"
err "zalogowany nie oznaczy archiwum"                   $HHL "select mark_document_archived('$(d 1)','r2://a')" "permission denied"
ROLE=service_role err "service_role: lista kandydatów"  "" "select count(*) from document_archive_candidates(1000)" "^2$"

echo; echo "[PR7] Oznaczenie archiwum"
chk "bez ścieżki — odrzucone"                           "$($PSQL -c "select mark_document_archived('$(d 1)','')" 2>&1 | grep -o 'Brak ścieżki archiwum')" "Brak ścieżki archiwum"
Q "select mark_document_archived('$(d 1)','archiwum/dokumenty/a/1.pdf.age')" >/dev/null
chk "po oznaczeniu: archived_at + archive_path"         "$(Q "select (archived_at is not null)||':'||archive_path from documents where id='$(d 1)'")" "true:archiwum/dokumenty/a/1.pdf.age"
chk "zajęte spada do 400 B → brak kandydatów"           "$(Q "select count(*) from document_archive_candidates(1000)")" 0
chk "drugie oznaczenie — odrzucone"                     "$($PSQL -c "select mark_document_archived('$(d 1)','x')" 2>&1 | grep -o 'już zarchiwizowany')" "już zarchiwizowany"
chk "kopia zapasowa pomija pliki zarchiwizowane"        "$(grep -c 'archived_at is null' supabase/functions/backup-export/index.ts)" 1
echo; echo "WYNIK: $ok OK, $fail FAIL"
psql "$ADMIN" -q -c "drop database if exists $DB"
