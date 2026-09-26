#!/usr/bin/env bash
# TOWER — test plików (BK4): koszyki Storage + widoczność dokumentów.
# Własna, czysta baza: atrapa Supabase + atrapa storage → migracje → dane testowe.
# Użycie: PGADMIN=postgres://postgres@localhost:5433/postgres bash tests/db/storage.sh
# UWAGA: supabase_stub.sql i storage_stub.sql NIGDY nie uruchamiaj na Supabase.
set -e
ADMIN=${PGADMIN:-postgres://postgres@localhost:5433/postgres}
DB=tower_test_storage; URL="${ADMIN%/*}/$DB"
psql "$ADMIN" -q -c "drop database if exists $DB" -c "create database $DB"
psql "$URL" -q -v ON_ERROR_STOP=1 -f tests/db/supabase_stub.sql
psql "$URL" -q -v ON_ERROR_STOP=1 -f tests/db/storage_stub.sql
for f in supabase/migrations/*.sql; do psql "$URL" -q -v ON_ERROR_STOP=1 -f "$f" >/dev/null 2>&1; done
psql "$URL" -q -v ON_ERROR_STOP=1 -f tests/db/seed.sql
set +e

PSQL="psql $URL -Atq"
HHL=11111111-0000-0000-0000-000000000001; KSH=11111111-0000-0000-0000-000000000002; SCX=11111111-0000-0000-0000-000000000003
P=22222222-0000-0000-0000-000000000001; INVK=44444444-0000-0000-0000-00000000000c; INVP=44444444-0000-0000-0000-0000000000ee
L1=33333333-0000-0000-0000-000000000001; L3=33333333-0000-0000-0000-000000000003
ok=0; fail=0
run() { local end="rollback"; [ "$3" = "commit" ] && end="commit"
  $PSQL -v ON_ERROR_STOP=1 -c "begin; set local role ${ROLE:-authenticated}; set local request.jwt.claim.sub='$1'; $2; $end;" 2>&1; }
val() { out=$(run "$2" "$3" "$5" | grep -v -E '^(BEGIN|SET|ROLLBACK|COMMIT)$' | tail -1)
  if [ "$out" = "$4" ]; then ok=$((ok+1)); echo "  OK    $1"; else fail=$((fail+1)); echo "  FAIL  $1  (otrzymano: $out, oczekiwano: $4)"; fi; }
err() { out=$(run "$2" "$3"); if echo "$out" | grep -qiE "$4"; then ok=$((ok+1)); echo "  OK    $1"; else fail=$((fail+1)); echo "  FAIL  $1  →  $(echo "$out" | tail -1)"; fi; }
sys() { $PSQL -v ON_ERROR_STOP=1 -c "$1" >/dev/null 2>&1; }
# transport bez przewoźnika (niewidoczny dla SCX)
sys "insert into loads (id, project_id, order_no) values ('$L3','$P','KSH/3')"

echo; echo "[1] Koszyki"
val "trzy koszyki prywatne"                        $HHL "select count(*) from storage.buckets where id in ('dokumenty','zdjecia','faktury') and not public" 3
val "W4: limit zdjecia 2 MB"                         $HHL "select file_size_limit from storage.buckets where id='zdjecia'" 2097152
val "W4: limit dokumenty 10 MB"                      $HHL "select file_size_limit from storage.buckets where id='dokumenty'" 10485760
val "0040: limit faktury 10 MB (jak wszystkie PDF)"  $HHL "select file_size_limit from storage.buckets where id='faktury'" 10485760
err "0040: PDF faktury 10 MB + 1 B odrzucony"        $SCX "select * from create_document(null,'INVOICE','f.pdf','application/pdf',10485761,'$P')" "za duży"

echo; echo "[2] Rejestracja dokumentu i ścieżka nadawana przez serwer"
val "SCX rejestruje CMR swojego transportu → koszyk dokumenty" $SCX "select bucket from create_document('$L1','CMR','cmr ąę.pdf','application/pdf',1000)" dokumenty
val "ścieżka = koszyk/projekt/transport/id/nazwa"  $SCX "select storage_path ~ ('^dokumenty/$P/$L1/[0-9a-f-]{36}/cmr_ae\.pdf$') from create_document('$L1','CMR','cmr ąę.pdf','application/pdf',1000)" t
val "zdjęcie mocowania → koszyk zdjecia"           $SCX "select bucket from create_document('$L1','LASHING_PHOTO','m.jpg','image/jpeg',1000)" zdjecia
val "ścieżka podana przez klienta ignorowana"      $SCX "insert into documents (project_id, load_id, category, storage_path, file_name) values ('$P','$L1','POD','dokumenty/cudzy/plik.pdf','p.pdf'); select count(*) from documents where storage_path='dokumenty/cudzy/plik.pdf'" 0
err "SCX nie zarejestruje dokumentu cudzego transportu" $SCX "select * from create_document('$L3','CMR','x.pdf','application/pdf',10)" "niewidoczny"
err "SCX nie wstawi dokumentu do cudzego transportu (REST)" $SCX "insert into documents (project_id, load_id, category, storage_path, file_name) values ('$P','$L3','CMR','-','x.pdf')" "row-level security"
err "zły typ pliku odrzucony"                       $SCX "select * from create_document('$L1','CMR','x.exe','application/x-msdownload',10)" "Nieobsługiwany typ"
err "plik za duży odrzucony"                        $SCX "select * from create_document('$L1','LASHING_PHOTO','x.jpg','image/jpeg',99999999)" "za duży"
err "KSH nie doda polisy bez transportu"            $KSH "select * from create_document(null,'INSURANCE','p.pdf','application/pdf',10,'$P')" "row-level security"

echo; echo "[3] Wgranie obiektu"
D1=$(run $SCX "select object_path from create_document('$L1','CMR','cmr.pdf','application/pdf',1000)" commit | grep -E '^[0-9a-f]{8}-' | head -1)
val "SCX wgrywa plik pod zarejestrowaną ścieżkę"    $SCX "insert into storage.objects (bucket_id, name) values ('dokumenty','$D1') returning 1" 1 commit
err "SCX nie wgra pliku pod dowolną ścieżkę"        $SCX "insert into storage.objects (bucket_id, name) values ('dokumenty','$P/$L1/x/y.pdf')" "row-level security"
err "SCX nie wgra pliku do innego koszyka niż kategoria" $SCX "insert into storage.objects (bucket_id, name) values ('zdjecia','$D1')" "row-level security"
D2=$(run $KSH "select object_path from create_document('$L1','SPEC','rys.pdf','application/pdf',1000)" commit | grep -E '^[0-9a-f]{8}-' | head -1)
err "SCX nie wgra pliku pod dokument zarejestrowany przez KSH" $SCX "insert into storage.objects (bucket_id, name) values ('dokumenty','$D2')" "row-level security"
val "SCX nie nadpisze obiektu (brak UPDATE)"        $SCX "with u as (update storage.objects set name=name||'x' where bucket_id='dokumenty' returning 1) select count(*) from u" 0
val "SCX nie usunie obiektu (brak DELETE)"          $SCX "with u as (delete from storage.objects where bucket_id='dokumenty' returning 1) select count(*) from u" 0

echo; echo "[4] Odczyt obiektu = widoczność dokumentu"
val "HHL widzi plik"                                $HHL "select count(*) from storage.objects where name='$D1'" 1
val "KSH widzi CMR transportu swojego projektu"     $KSH "select count(*) from storage.objects where name='$D1'" 1
val "SCX widzi swój plik"                           $SCX "select count(*) from storage.objects where name='$D1'" 1
sys "insert into storage.objects (bucket_id, name) values ('dokumenty','$P/$L3/obcy/o.pdf'); insert into documents (project_id, load_id, category, storage_path, file_name) values ('$P','$L3','CMR','dokumenty/$P/$L3/obcy/o.pdf','o.pdf')"
val "SCX nie widzi dokumentu cudzego transportu"    $SCX "select count(*) from documents where load_id='$L3'" 0
val "SCX nie widzi pliku cudzego transportu"        $SCX "select count(*) from storage.objects where name like '$P/$L3/%'" 0
ROLE=anon val "anon nie widzi plików"               "" "select count(*) from storage.objects" 0

echo; echo "[5] PDF faktur — tylko strony faktury"
FK=$(run $SCX "select object_path from create_document(null,'INVOICE','SCX-9.pdf','application/pdf',1000,'$P')" commit | grep -E '^[0-9a-f]{8}-' | head -1)
val "SCX wgrywa PDF faktury kosztowej"              $SCX "insert into storage.objects (bucket_id, name) values ('faktury','$FK') returning 1" 1 commit
val "KSH nie widzi niepodpiętego PDF SCX"           $KSH "select count(*) from storage.objects where bucket_id='faktury'" 0
sys "insert into invoice_documents (invoice_id, document_id, role) select '$INVK', id, 'FAKTURA_PDF' from documents where storage_path='faktury/$FK'"
val "HHL widzi PDF faktury kosztowej"               $HHL "select count(*) from storage.objects where bucket_id='faktury'" 1
val "SCX widzi PDF własnej faktury"                 $SCX "select count(*) from storage.objects where bucket_id='faktury'" 1
val "KSH nie widzi PDF faktury kosztowej"           $KSH "select count(*) from storage.objects where bucket_id='faktury'" 0
val "KSH nie widzi metadanych PDF faktury kosztowej" $KSH "select count(*) from documents where category='INVOICE'" 0
sys "insert into documents (id, project_id, category, storage_path, file_name) values ('55555555-0000-0000-0000-000000000001','$P','INVOICE','faktury/$P/org/hhl/HHL-9.pdf','HHL-9.pdf'); insert into storage.objects (bucket_id, name) values ('faktury','$P/org/hhl/HHL-9.pdf'); insert into invoice_documents (invoice_id, document_id, role) values ('$INVP','55555555-0000-0000-0000-000000000001','FAKTURA_PDF')"
val "KSH widzi PDF faktury HHL dla KSH"             $KSH "select count(*) from storage.objects where bucket_id='faktury'" 1
val "SCX nie widzi PDF faktury HHL dla KSH"         $SCX "select count(*) from storage.objects where name='$P/org/hhl/HHL-9.pdf'" 0

echo; echo "[6] Wycofanie rejestracji"
DX=$(run $SCX "select id from create_document('$L1','POD','pod.pdf','application/pdf',1000)" commit | grep -E '^[0-9a-f]{8}-' | head -1)
val "KSH nie wycofa cudzej rejestracji"             $KSH "select discard_document('$DX')" f
val "autor wycofuje rejestrację bez pliku"          $SCX "select discard_document('$DX')" t
D1ID=$(run $SCX "select id from documents where storage_path='dokumenty/$D1'" | grep -E '^[0-9a-f]{8}-' | head -1)
val "nie wycofa dokumentu z wgranym plikiem"        $SCX "select discard_document('$D1ID')" f

echo; echo "WYNIK: $ok OK, $fail FAIL"
[ $fail -eq 0 ]
