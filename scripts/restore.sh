#!/usr/bin/env bash
# TOWER — odtworzenie kopii zapasowej (ANEKS 4 PR2). Test odtworzenia raz w miesiącu → wynik w POSTEP.md.
#
# Wejście: katalog kopii (pobrany z R2: daily/RRRR-MM-DD/ albo monthly/RRRR-MM/) z plikami
#   <tabela>.csv.gz.age i manifest.json.age; klucz PRYWATNY age (plik tożsamości właściciela, offline).
#
# Użycie:
#   AGE_IDENTITY=~/klucz.txt RESTORE_DB_URL=postgres://… scripts/restore.sh <katalog> [--schema NAZWA]
#       domyślnie: tryb niedestrukcyjny — tabele do osobnego schematu (restore_RRRRMMDD) i porównanie
#       liczby wierszy z manifestem. Tak wygląda comiesięczny test na projekcie TESTOWYM.
#   … scripts/restore.sh <katalog> --into-public    (RESTORE_CONFIRM=TAK)
#       odtworzenie awaryjne do schematu public ŚWIEŻEGO projektu po migracjach: czyści tabele z kopii
#       i ładuje dane z wyłączonymi wyzwalaczami (session_replication_role = replica).
#   --drop-after  (tylko z --schema) usuwa schemat po udanym porównaniu (test automatyczny).
#
# Wyjście: jedna linia „RESTORE OK tabel=N wierszy=M” albo „RESTORE FAIL …” (kod ≠ 0).
# Konta (tylko --into-public): kopia nie zawiera auth.users. Skrypt wpisuje konta z app_users do
#   account_relink_pending (0045); pierwsze logowanie linkiem z e-maila łączy konto po adresie (bez zaproszenia).
# Pliki (files/…age): scripts/restore-files.sh (odszyfrowanie, sumy SHA-256 z manifestu, opcjonalnie wgranie do Storage).
set -euo pipefail
DIR=${1:?katalog kopii}; shift || true
MODE=schema; SCHEMA=""; DROP_AFTER=0
while [ $# -gt 0 ]; do
  case "$1" in
    --schema) SCHEMA=$2; shift 2 ;;
    --into-public) MODE=public; shift ;;
    --drop-after) DROP_AFTER=1; shift ;;
    *) echo "nieznana opcja $1" >&2; exit 2 ;;
  esac
done
: "${AGE_IDENTITY:?AGE_IDENTITY — plik klucza prywatnego age}"
: "${RESTORE_DB_URL:?RESTORE_DB_URL — baza docelowa}"
command -v age >/dev/null || { echo "RESTORE FAIL: brak programu age" >&2; exit 3; }
# Kolejność: opcje, potem -c SQL, na końcu URI (Windows psql).
psql_q() { psql -v ON_ERROR_STOP=1 -A -t -q -c "$1" "$RESTORE_DB_URL"; }
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT

age -d -i "$AGE_IDENTITY" -o "$TMP/manifest.json" "$DIR/manifest.json.age"
TABLES=$(python3 -c "import json,sys;m=json.load(open(sys.argv[1]));print(' '.join(m['tables'].keys()))" "$TMP/manifest.json")
expected() { python3 -c "import json,sys;print(json.load(open(sys.argv[1]))['tables'][sys.argv[2]])" "$TMP/manifest.json" "$1"; }
if [ "$MODE" = schema ]; then
  [ -n "$SCHEMA" ] || SCHEMA="restore_$(python3 -c "import json,sys;print(json.load(open(sys.argv[1]))['created_at'][:10].replace('-',''))" "$TMP/manifest.json")"
  [[ "$SCHEMA" =~ ^restore_[a-z0-9_]+$ ]] || { echo "RESTORE FAIL: schemat musi mieć postać restore_…" >&2; exit 2; }
  psql_q "create schema if not exists $SCHEMA"
else
  [ "${RESTORE_CONFIRM:-}" = TAK ] || { echo "RESTORE FAIL: --into-public wymaga RESTORE_CONFIRM=TAK" >&2; exit 2; }
  psql_q "truncate $(python3 -c "import sys;print(', '.join('public.'+t for t in sys.argv[1:]))" $TABLES) cascade"
fi

n=0; rows=0; bad=""
for t in $TABLES; do
  [[ "$t" =~ ^[a-z_]+$ ]] || { echo "RESTORE FAIL: nazwa tabeli $t" >&2; exit 2; }
  age -d -i "$AGE_IDENTITY" "$DIR/$t.csv.gz.age" | gunzip > "$TMP/$t.csv"
  cols=$(head -1 "$TMP/$t.csv")
  # Ścieżka CSV: na Windows natywny psql wymaga ścieżki Win; cygpath gdy dostępny.
  CSV_PATH=$TMP/$t.csv
  if command -v cygpath >/dev/null 2>&1; then CSV_PATH=$(cygpath -m "$CSV_PATH"); fi
  if [ "$MODE" = schema ]; then
    psql_q "drop table if exists $SCHEMA.$t"
    psql_q "create table $SCHEMA.$t (like public.$t)"
    target="$SCHEMA.$t"
    psql_q "\\copy $target ($cols) from '$CSV_PATH' with (format csv, header true)"
  else
    target="public.$t"
    # psql -c nie wykonuje \copy po SQL (syntax error przy "\"). Jedna sesja: SET, potem \copy.
    {
      echo "set session_replication_role = replica;"
      printf '\copy %s (%s) from '\''%s'\'' with (format csv, header true)\n' "$target" "$cols" "$CSV_PATH"
    } | psql -v ON_ERROR_STOP=1 -q "$RESTORE_DB_URL" >/dev/null
  fi
  got=$(psql_q "select count(*) from $target")
  exp=$(expected "$t")
  [ "$got" = "$exp" ] || bad="$bad $t($got≠$exp)"
  n=$((n+1)); rows=$((rows+got))
done
if [ -n "$bad" ]; then echo "RESTORE FAIL: liczba wierszy:$bad"; exit 1; fi
if [ "$MODE" = schema ] && [ $DROP_AFTER -eq 1 ]; then psql_q "drop schema $SCHEMA cascade"; fi
RELINK=""
if [ "$MODE" = public ]; then
  # kopia zawiera własny przebieg backup_runs w stanie RUNNING (zapisany w trakcie) — inaczej blokowałby kopie (0044)
  psql_q "update public.backup_runs set status = 'ERROR', finished_at = coalesce(finished_at, now()), error = 'przebieg w toku w chwili kopii (odtworzenie)' where status = 'RUNNING'"
  # PR2-B (0045): konta z kopii bez auth.users w nowym projekcie → lista do połączenia po e-mailu przy pierwszym logowaniu
  if [ "$(psql_q "select to_regprocedure('public.restore_mark_relink()') is not null")" = t ]; then
    RELINK=" konta_do_polaczenia=$(psql_q "select public.restore_mark_relink()")"
  fi
fi
echo "RESTORE OK tabel=$n wierszy=$rows tryb=$MODE${SCHEMA:+ schemat=$SCHEMA}$RELINK"
