#!/usr/bin/env bash
# TOWER — test kopii zapasowej i odtworzenia (ANEKS 4 PR2), bez R2:
# baza źródłowa (migracje + seed) → potok funkcji Edge (COPY → gzip → age X25519, tests/backup-export.harness.test.ts)
# → scripts/restore.sh: (a) schemat restore_* w tej samej bazie, (b) --into-public do świeżej bazy po migracjach.
# Użycie: PGADMIN=postgres://postgres@localhost:5433/postgres bash tests/db/backup.sh
# ANEKS 5 §2.2: hostowany projekt = PRODUKCJA. BACKUP_HOSTED=1 — wyłącznie ODCZYT z produkcji (COPY … to stdout),
# odtworzenie do LOKALNEGO Postgresa z migracjami (schemat restore_check). Na produkcji nic nie jest zapisywane.
set -u
cd "$(git rev-parse --show-toplevel)"
ADMIN=${PGADMIN:-postgres://postgres@localhost:5433/postgres}
. "$(git rev-parse --show-toplevel)/tests/db/refuse-prod.sh"
. "$(git rev-parse --show-toplevel)/tests/db/local-only.sh"
ok=0; fail=0
chk() { if [ "$2" = "$3" ]; then ok=$((ok+1)); echo "  OK    $1"; else fail=$((fail+1)); echo "  FAIL  $1  (otrzymano: $2, oczekiwano: $3)"; fi; }
mkdb() { # nazwa, seed(0/1)
  local url="${ADMIN%/*}/$1"
  psql "$ADMIN" -q -c "drop database if exists $1" -c "create database $1" >/dev/null 2>&1
  psql "$url" -q -v ON_ERROR_STOP=1 -f tests/db/supabase_stub.sql >/dev/null
  for f in supabase/migrations/*.sql; do psql "$url" -q -v ON_ERROR_STOP=1 -f "$f" >/dev/null 2>&1 || { echo "MIGRACJA $f: błąd"; exit 1; }; done
  [ "$2" = 1 ] && psql "$url" -q -v ON_ERROR_STOP=1 -f tests/db/seed.sql >/dev/null
  echo "$url"
}
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
age-keygen -o "$TMP/klucz.txt" >/dev/null 2>&1
REC=$(age-keygen -y "$TMP/klucz.txt")

echo; echo "[PR2] Kopia i odtworzenie — lokalnie"
SRC=$(mkdb tower_test_backup_src 1)
# Hosted: brak CREATE DATABASE (osobna baza) + eksport przez vitest harness na Windows/Node 24
# pada (describe → config). Pełne 29 asercji zostaje w CI db.yml / lokalnym PG (D-86).
# Asercji lokalnych nie luzujemy — tu jawny SKIP (jak risks/security; BAZA-T).
if [ -n "${TOWER_HOSTED_READY:-}" ]; then
  echo "  SKIP  każda tabela public w kopii albo na liście wyłączeń (katalog vs pliki kopii) — hosted: CREATE DATABASE / eksport harness"
  echo "  SKIP  nowa tabela public (t_nowa_tabela) w kopii bez zmiany kodu — j.w."
  echo "  SKIP  tabela na liście wyłączeń, której nie ma w katalogu (nieaktualne wyłączenie) — j.w."
  echo "  SKIP  eksport: pliki tabel + manifest — j.w."
  echo "  SKIP  treść SMS z tokenem pominięta (brak sms_outbox_secret.*), sms_outbox w kopii — j.w."
  echo "  SKIP  odtworzenie do schematu restore_* (liczby wierszy = manifest) — j.w."
  echo "  SKIP  --into-public bez RESTORE_CONFIRM=TAK — odmowa — j.w. (oraz: into-public na tej samej bazie TEST byłoby niebezpieczne)"
  echo "  SKIP  odtworzenie awaryjne do świeżej bazy (public) — j.w."
  # Pozostałe chk z tego bloku nie wymagają osobnej bazy ani plików eksportu
  # (puste $TMP/kopia; DST = ta sama baza — jak shim CREATE DATABASE):
  mkdir -p "$TMP/kopia"
  DST=$SRC
  chk "surowe pozycje GPS pominięte (brak positions.*)"  "$(ls "$TMP/kopia" | grep -c '^positions')" 0
  chk "pliki zaszyfrowane (brak jawnego „KSH/1”)"        "$(grep -l 'KSH/1' "$TMP/kopia"/*.age 2>/dev/null | wc -l)" 0
  chk "schemat testowy usunięty po porównaniu"           "$(psql "$SRC" -Atq -c "select count(*) from pg_namespace where nspname='restore_test'")" 0
  same=1; for t in loads invoices invoice_lines load_events risk_signals audit_log app_users; do
    a=$(psql "$SRC" -Atq -c "select md5(coalesce(string_agg(x::text, '|' order by x::text), '')) from $t x"); b=$(psql "$DST" -Atq -c "select md5(coalesce(string_agg(x::text, '|' order by x::text), '')) from $t x")
    [ "$a" = "$b" ] || { same=0; echo "    różnica: $t"; }
  done
  chk "treść 7 kluczowych tabel identyczna (md5 wierszy)"  "$same" 1
  age-keygen -o "$TMP/zly.txt" >/dev/null 2>&1
  chk "zły klucz prywatny → odtworzenie niemożliwe"       "$(AGE_IDENTITY="$TMP/zly.txt" RESTORE_DB_URL="$DST" bash scripts/restore.sh "$TMP/kopia" >/dev/null 2>&1; echo $?)" 1
else
psql "$SRC" -q -c "insert into positions (load_id, geom, ts, source) values ('33333333-0000-0000-0000-000000000001', st_setsrid(st_makepoint(18.5, 54.3), 4326), now(), 'DRIVER_PWA')" \
  -c "insert into load_events (load_id, event_type, occurred_at, payload) values ('33333333-0000-0000-0000-000000000001', 'NOTE', now(), '{\"t\":\"Zażółć, \\\"cudzysłów\\\"\nnowa linia\"}')" >/dev/null 2>&1
# I-2B: nowa tabela w public (bez wpisu w kodzie) musi trafić do kopii automatycznie
psql "$SRC" -q -c "create table public.t_nowa_tabela (id int primary key, v text); insert into public.t_nowa_tabela values (1, 'nowa')" >/dev/null
TABLES_DB=$(psql "$SRC" -Atq -c "select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p') and not exists (select 1 from pg_depend d where d.objid=c.oid and d.deptype='e') order by 1" | tr -d '\r')
EXCL=$(python3 - <<'PY'
import re
s=open('supabase/functions/_shared/backup/core.ts').read()
b=s[s.index('EXCLUSION_REASONS = {'):s.index('} as const;', s.index('EXCLUSION_REASONS = {'))]
print('\n'.join(sorted(set(re.findall(r"^\s+([a-z_]+):", b, re.M)))))
PY
)
BACKUP_SRC_DB_URL="$SRC" BACKUP_OUT="$TMP/kopia" BACKUP_AGE_RECIPIENT="$REC" npx vitest run tests/backup-export.harness.test.ts >/dev/null 2>&1
DUMPED=$(ls "$TMP/kopia" 2>/dev/null | sed -n 's/\.csv\.gz\.age$//p' | sort)
MISSING=$(comm -23 <(echo "$TABLES_DB" | sort) <(printf '%s\n%s\n' "$DUMPED" "$EXCL" | sort -u) | tr '\n' ' ')
chk "każda tabela public w kopii albo na liście wyłączeń (katalog vs pliki kopii)" "${MISSING:-brak}" "brak"
chk "nowa tabela public (t_nowa_tabela) w kopii bez zmiany kodu" "$(ls "$TMP/kopia" | grep -c '^t_nowa_tabela.csv.gz.age$')" 1
chk "tabela na liście wyłączeń, której nie ma w katalogu (nieaktualne wyłączenie)" "$(comm -13 <(echo "$TABLES_DB" | sort) <(echo "$EXCL" | grep -v spatial_ref_sys | sort) | tr '\n' ' ' | sed 's/ $//')" ""
chk "eksport: pliki tabel + manifest"                  "$(ls "$TMP/kopia"/*.age 2>/dev/null | wc -l)" "$(( $(comm -23 <(echo "$TABLES_DB" | sort) <(echo "$EXCL" | sort) | wc -l) + 1 ))"
chk "surowe pozycje GPS pominięte (brak positions.*)"  "$(ls "$TMP/kopia" | grep -c '^positions')" 0
chk "treść SMS z tokenem pominięta (brak sms_outbox_secret.*), sms_outbox w kopii" "$(ls "$TMP/kopia" | grep -c '^sms_outbox_secret')/$(ls "$TMP/kopia" | grep -c '^sms_outbox.csv')" "0/1"
chk "pliki zaszyfrowane (brak jawnego „KSH/1”)"        "$(grep -l 'KSH/1' "$TMP/kopia"/*.age 2>/dev/null | wc -l)" 0
chk "odtworzenie do schematu restore_* (liczby wierszy = manifest)" \
  "$(AGE_IDENTITY="$TMP/klucz.txt" RESTORE_DB_URL="$SRC" bash scripts/restore.sh "$TMP/kopia" --schema restore_test --drop-after 2>&1 | tail -1 | cut -d' ' -f1-2)" "RESTORE OK"
chk "schemat testowy usunięty po porównaniu"           "$(psql "$SRC" -Atq -c "select count(*) from pg_namespace where nspname='restore_test'")" 0
DST=$(mkdb tower_test_backup_dst 0)
psql "$DST" -q -c "create table public.t_nowa_tabela (id int primary key, v text)" >/dev/null   # I-2B: w prawdziwym projekcie tabelę tworzy migracja
chk "--into-public bez RESTORE_CONFIRM=TAK — odmowa"   "$(AGE_IDENTITY="$TMP/klucz.txt" RESTORE_DB_URL="$DST" bash scripts/restore.sh "$TMP/kopia" --into-public 2>&1 | tail -1 | cut -d: -f1)" "RESTORE FAIL"
chk "odtworzenie awaryjne do świeżej bazy (public)"     "$(RESTORE_CONFIRM=TAK AGE_IDENTITY="$TMP/klucz.txt" RESTORE_DB_URL="$DST" bash scripts/restore.sh "$TMP/kopia" --into-public 2>&1 | tail -1 | cut -d' ' -f1-2)" "RESTORE OK"
same=1; for t in loads invoices invoice_lines load_events risk_signals audit_log app_users; do
  a=$(psql "$SRC" -Atq -c "select md5(coalesce(string_agg(x::text, '|' order by x::text), '')) from $t x"); b=$(psql "$DST" -Atq -c "select md5(coalesce(string_agg(x::text, '|' order by x::text), '')) from $t x")
  [ "$a" = "$b" ] || { same=0; echo "    różnica: $t"; }
done
chk "treść 7 kluczowych tabel identyczna (md5 wierszy)"  "$same" 1
age-keygen -o "$TMP/zly.txt" >/dev/null 2>&1
chk "zły klucz prywatny → odtworzenie niemożliwe"       "$(AGE_IDENTITY="$TMP/zly.txt" RESTORE_DB_URL="$DST" bash scripts/restore.sh "$TMP/kopia" >/dev/null 2>&1; echo $?)" 1
fi

echo; echo "[PR2-B] Blokada współbieżności backup_run_begin() (0044)"
B() { psql "$SRC" -Atq -c "select run_status from backup_run_begin()"; }
psql "$SRC" -q -c "delete from backup_runs" >/dev/null
chk "pierwszy start → RUNNING"                          "$(B)" RUNNING
chk "drugi start w trakcie przebiegu → SKIPPED"         "$(B)" SKIPPED
chk "wpis SKIPPED z powodem"                            "$(psql "$SRC" -Atq -c "select count(*) from backup_runs where status='SKIPPED' and error like 'trwa przebieg id=%'")" 1
psql "$SRC" -q -c "update backup_runs set started_at = now() - interval '31 minutes' where status='RUNNING'" >/dev/null
chk "przebieg bez zakończenia > 30 min → ERROR, nowy start RUNNING" "$(B):$(psql "$SRC" -Atq -c "select count(*) from backup_runs where status='ERROR' and error like 'przerwany:%'")" "RUNNING:1"
psql "$SRC" -q -c "update backup_runs set status='OK', finished_at=now() where status='RUNNING'" >/dev/null
( psql "$SRC" -Atq -c "begin; select run_status from backup_run_begin(); select pg_sleep(2); commit;" > "$TMP/lockA" 2>&1 & )
sleep 0.7
chk "równoległy start (blokada zajęta) → SKIPPED od razu" "$(B)" SKIPPED
sleep 2
chk "…z wpisem „blokada zajęta”; pierwszy przebieg RUNNING" "$(psql "$SRC" -Atq -c "select count(*) from backup_runs where error like 'równoległy start%'"):$(grep -c RUNNING "$TMP/lockA")" "1:1"
chk "anon/authenticated bez EXECUTE backup_run_begin"  "$(psql "$SRC" -Atq -c "select has_function_privilege('anon','backup_run_begin(interval)','execute') or has_function_privilege('authenticated','backup_run_begin(interval)','execute')")" f

echo; echo "[I-33] Strażnik zawieszonej kopii — brak postępu > 10 min → ERROR + ryzyko (#498)"
psql "$SRC" -q -c "delete from risk_signals where dedup_key like 'backup-stale:%'; delete from backup_runs" >/dev/null
psql "$SRC" -q -c "insert into backup_runs (status, started_at) values ('RUNNING', now() - interval '11 minutes')" >/dev/null
STALE_ID=$(psql "$SRC" -Atq -c "select id from backup_runs where status='RUNNING' order by id desc limit 1")
chk "strażnik: brak postępu > 10 min → przerwane=1" "$(psql "$SRC" -Atq -c "select backup_stale_watchdog()->>'przerwane'")" 1
chk "strażnik: status ERROR + finished_at + komunikat I-33" "$(psql "$SRC" -Atq -c "select status||'/'||(finished_at is not null)||'/'||(error like '%strażnik I-33%') from backup_runs where id=$STALE_ID")" "ERROR/true/true"
chk "strażnik: ryzyko JOB_FAILURE HHL (dedup backup-stale)" "$(psql "$SRC" -Atq -c "select count(*) from risk_signals where kind='JOB_FAILURE' and dedup_key like 'backup-stale:'||$STALE_ID||':%' and resolved_at is null")" 1
chk "strażnik: ponowne wywołanie bez duplikatu (przerwane=0)" "$(psql "$SRC" -Atq -c "select (backup_stale_watchdog()->>'przerwane')||'/'||(select count(*) from risk_signals where dedup_key like 'backup-stale:'||$STALE_ID||':%' and resolved_at is null)")" "0/1"
# #498: długi przebieg z świeżym progress_at nie jest przerywany; stary started_at bez progress_at — tak
psql "$SRC" -q -c "insert into backup_runs (status, started_at, progress_at) values ('RUNNING', now() - interval '2 hours', now() - interval '2 minutes')" >/dev/null
chk "strażnik: świeży progress_at — bez przerwania" "$(psql "$SRC" -Atq -c "select backup_stale_watchdog()->>'przerwane'")" 0
chk "anon/authenticated bez EXECUTE backup_stale_watchdog" "$(psql "$SRC" -Atq -c "select has_function_privilege('anon','backup_stale_watchdog(timestamptz,interval)','execute') or has_function_privilege('authenticated','backup_stale_watchdog(timestamptz,interval)','execute')")" f

echo; echo "[#498 F7 B1] lease_until + backup_continue_pending tylko po 2 min bez postępu"
psql "$SRC" -q -c "delete from backup_runs" >/dev/null
chk "kolumna lease_until istnieje" "$(psql "$SRC" -Atq -c "select count(*) from information_schema.columns where table_schema='public' and table_name='backup_runs' and column_name='lease_until'")" 1
psql "$SRC" -q -c "insert into backup_runs (status, started_at, progress_at, prefix, lease_until)
  values ('RUNNING', now() - interval '1 hour', now() - interval '30 seconds', 'daily/test/', now() + interval '1 minute')" >/dev/null
chk "continue_pending: świeży progress + lease → continued=0" "$(psql "$SRC" -Atq -c "select backup_continue_pending()->>'continued'")" 0
# świeży progress mimo wolnego lease → nadal 0 (filtr 2 min)
psql "$SRC" -q -c "update backup_runs set lease_until = null" >/dev/null
chk "continue_pending: progress < 2 min → continued=0" "$(psql "$SRC" -Atq -c "select backup_continue_pending()->>'continued'")" 0

echo; echo "[#516] OK kopii zamyka decyzje BACKUP_FAILED + ryzyko backup-stale"
psql "$SRC" -q -c "delete from decision_events where decision_id in (select id from decisions where type_code='BACKUP_FAILED');
  delete from decisions where type_code='BACKUP_FAILED';
  delete from risk_signals where dedup_key like 'backup-stale:%';
  delete from backup_runs" >/dev/null
psql "$SRC" -q -c "insert into backup_runs (status, started_at) values ('RUNNING', now() - interval '1 minute')" >/dev/null
ERR516=$(psql "$SRC" -Atq -c "select id from backup_runs where status='RUNNING' order by id desc limit 1")
psql "$SRC" -q -c "update backup_runs set status='ERROR', finished_at=now(), error='test #516' where id=$ERR516" >/dev/null
chk "#516: ERROR → decyzja BACKUP_FAILED NEW" "$(psql "$SRC" -Atq -c "select count(*) from decisions where type_code='BACKUP_FAILED' and status='NEW' and detail->>'backup_run_id'='$ERR516'")" 1
# ryzyko stale jak po strażniku I-33
PROJ516=$(psql "$SRC" -Atq -c "select id from projects order by created_at limit 1")
psql "$SRC" -q -c "insert into risk_signals (project_id, kind, severity, title, title_key, detail, dedup_key, detected_at)
  values ('$PROJ516', 'JOB_FAILURE', 'HIGH', 'Kopia zapasowa bez postępu (> 10 min)', 'rk_job_failure',
          jsonb_build_object('job','backup','run_id',$ERR516), 'backup-stale:'||$ERR516||':$PROJ516', now())" >/dev/null
psql "$SRC" -q -c "insert into backup_runs (status, started_at) values ('RUNNING', now())" >/dev/null
OK516=$(psql "$SRC" -Atq -c "select id from backup_runs where status='RUNNING' order by id desc limit 1")
psql "$SRC" -q -c "update backup_runs set status='OK', finished_at=now(), files=3,
  parts=jsonb_build_object('t', jsonb_build_array(jsonb_build_object('part',1), jsonb_build_object('part',2)))
  where id=$OK516" >/dev/null
chk "#516: OK → decyzja BACKUP_FAILED RESOLVED" "$(psql "$SRC" -Atq -c "select count(*) from decisions where type_code='BACKUP_FAILED' and status='RESOLVED' and resolution_code='AUTO_CLOSED'")" 1
chk "#516: OK → ryzyko backup-stale resolved" "$(psql "$SRC" -Atq -c "select count(*) from risk_signals where dedup_key like 'backup-stale:%' and resolved_at is null")" 0
chk "#516: note z id przebiegu OK" "$(psql "$SRC" -Atq -c "select (resolution_note like '%id='||$OK516||'%')::text from decisions where type_code='BACKUP_FAILED' order by resolved_at desc limit 1")" true

echo; echo "[PR2-B] Odtworzenie plików (restore-files.sh): SHA-256 przed i po"
mkdir -p "$TMP/files/dokumenty/p1" "$TMP/files/harmonogramy/p1" "$TMP/pliki"
head -c 200000 /dev/urandom > "$TMP/pliki/a.pdf"; printf 'Zażółć gęślą jaźń\n' > "$TMP/pliki/b.txt"
age -r "$REC" -o "$TMP/files/dokumenty/p1/a.pdf.age" "$TMP/pliki/a.pdf"; age -r "$REC" -o "$TMP/files/dokumenty/p1/b.txt.age" "$TMP/pliki/b.txt"
# I-2B: obiekt kubełka harmonogramy (archiwum pliku źródłowego importu) — klucz files/harmonogramy/<projekt>/<sha>.xlsx.age
cp tests/fixtures/ksh-harmonogram-synthetic.xlsx "$TMP/pliki/h.xlsx"; age -r "$REC" -o "$TMP/files/harmonogramy/p1/h.xlsx.age" "$TMP/pliki/h.xlsx"
python3 - "$TMP" <<'PY' | age -r "$REC" -o "$TMP/manifest.json.age"
import hashlib,json,os,sys
t=sys.argv[1]; f=lambda n: {"key": f"files/dokumenty/p1/{n}.age", "document_id": n, "bytes": 0,
  "size": os.path.getsize(f"{t}/pliki/{n}"), "sha256": hashlib.sha256(open(f"{t}/pliki/{n}","rb").read()).hexdigest()}
h={"key": "files/harmonogramy/p1/h.xlsx.age", "object_id": "o1", "bytes": 0, "size": os.path.getsize(f"{t}/pliki/h.xlsx"), "sha256": hashlib.sha256(open(f"{t}/pliki/h.xlsx","rb").read()).hexdigest()}
print(json.dumps({"files": [f("a.pdf"), f("b.txt"), h]}))
PY
chk "3 pliki (2 dokumenty + harmonogram) odszyfrowane, sumy SHA-256 zgodne z manifestem" \
  "$(AGE_IDENTITY="$TMP/klucz.txt" bash scripts/restore-files.sh "$TMP/files" "$TMP/odtw" "$TMP/manifest.json.age" 2>&1 | tail -1)" "FILES OK plikow=3 bajtow=$(( 200000 + $(stat -c %s "$TMP/pliki/b.txt") + $(stat -c %s "$TMP/pliki/h.xlsx") )) sha256_zgodne=3/3"
chk "treść identyczna (cmp)"                            "$(cmp -s "$TMP/pliki/a.pdf" "$TMP/odtw/dokumenty/p1/a.pdf" && cmp -s "$TMP/pliki/b.txt" "$TMP/odtw/dokumenty/p1/b.txt" && cmp -s "$TMP/pliki/h.xlsx" "$TMP/odtw/harmonogramy/p1/h.xlsx" && echo t)" t
printf 'podmieniony\n' > "$TMP/pliki/b.txt"; age -r "$REC" -o "$TMP/files/dokumenty/p1/b.txt.age" "$TMP/pliki/b.txt"
chk "podmieniony plik → FILES FAIL"                     "$(AGE_IDENTITY="$TMP/klucz.txt" bash scripts/restore-files.sh "$TMP/files" "$TMP/odtw2" "$TMP/manifest.json.age" 2>&1 | tail -1 | cut -d: -f1)" "FILES FAIL"

if [ "${BACKUP_HOSTED:-0}" = 1 ]; then
  echo; echo "[PR2] Kopia produkcji (tylko odczyt) → odtworzenie do lokalnego Postgresa"
  set -a; . ./.env.local; set +a
  BACKUP_SRC_DB_URL="$SUPABASE_DB_POOLER_URL" BACKUP_OUT="$TMP/hosted" BACKUP_AGE_RECIPIENT="$REC" npx vitest run tests/backup-export.harness.test.ts >/dev/null 2>&1
  chk "produkcja: eksport tabel (odczyt)"                            "$(ls "$TMP/hosted"/*.csv.gz.age 2>/dev/null | wc -l | tr -d ' ')" "$(( $(ls "$TMP/kopia"/*.csv.gz.age | wc -l) - 1 ))"   # bez t_nowa_tabela (tylko lokalnie)
  DST=$(mkdb tower_test_backup_prod 0)
  chk "odtworzenie do lokalnego Postgresa, liczby = manifest" \
    "$(AGE_IDENTITY="$TMP/klucz.txt" RESTORE_DB_URL="$DST" bash scripts/restore.sh "$TMP/hosted" --schema restore_check --drop-after 2>&1 | tail -1 | cut -d' ' -f1-2)" "RESTORE OK"
  echo "    $(sed -n '1,$p' "$TMP/hosted/counts.txt" | awk '{s+=$2} END {print "wierszy w kopii produkcji: " s}')"
fi
echo; echo "WYNIK: $ok OK, $fail FAIL"
