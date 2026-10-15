#!/usr/bin/env bash
# TOWER — brama bazy lokalnej. Oczekiwane OK z scripts/lib/gate-suites.mjs (EXPECTED_LOCAL).
# P1: zestaw e18 jest na liście LOCAL_ORDER; liczba OK tylko w EXPECTED_LOCAL (gate-suites.mjs).
# Użycie: PGADMIN=postgres://postgres@localhost:5433/postgres bash tests/db/gate.sh
#         SUITES=security,status bash tests/db/gate.sh   # tylko wskazane (P0b)
set -u
cd "$(git rev-parse --show-toplevel)"
ADMIN=${PGADMIN:-postgres://postgres@localhost:5433/postgres}
. "$(git rev-parse --show-toplevel)/tests/db/refuse-prod.sh"
. "$(git rev-parse --show-toplevel)/tests/db/local-only.sh"
export PGADMIN="$ADMIN"
# Debian z kilkoma klastrami: bez PGCLUSTER wrapper psql wypisuje ostrzeżenie i psuje porównania.
if [ -z "${PGCLUSTER:-}" ] && command -v pg_lsclusters >/dev/null 2>&1; then
  port=$(printf '%s' "$ADMIN" | sed -nE 's#.*:([0-9]+)/[^/]*$#\1#p'); port=${port:-5432}
  PGCLUSTER=$(pg_lsclusters -h 2>/dev/null | awk -v p="$port" '$3==p {print $1"/"$2; exit}')
  [ -n "$PGCLUSTER" ] && export PGCLUSTER
fi

ROOT="$(git rev-parse --show-toplevel)"
GS=(node "$ROOT/scripts/lib/gate-suites.mjs")
EXPECTED_FILE=$(mktemp)
DEBT_FILE=$(mktemp)
tower_drop() {
  psql "$ADMIN" -q -c "select pg_terminate_backend(pid) from pg_stat_activity where datname in ('tower','tower_boot') and pid <> pg_backend_pid()" >/dev/null 2>&1 || true
  psql "$ADMIN" -q -c "drop database if exists tower" -c "drop database if exists tower_boot" >/dev/null 2>&1 || true
}
trap 'rm -f "$EXPECTED_FILE" "$DEBT_FILE"; tower_drop' EXIT
"${GS[@]}" --local-expected >"$EXPECTED_FILE"
"${GS[@]}" --debt >"$DEBT_FILE"

expected_ok() { awk -F= -v s="$1" '$1==s {print $2; exit}' "$EXPECTED_FILE"; }
is_debt() { grep -qx "$1" "$DEBT_FILE"; }

tower_template() {
  local url="${ADMIN%/*}/tower_boot" f err
  tower_drop
  psql "$ADMIN" -q -c "create database tower_boot" >/dev/null
  psql "$url" -q -v ON_ERROR_STOP=1 -f tests/db/supabase_stub.sql >/dev/null
  for f in supabase/migrations/*.sql; do
    if ! err=$(psql "$url" -q -v ON_ERROR_STOP=1 -f "$f" 2>&1 >/dev/null); then
      echo "FAIL migracja szablonu tower_boot $f"
      printf '%s\n' "$err" | tail -5
      return 1
    fi
  done
  psql "$url" -q -v ON_ERROR_STOP=1 -f tests/db/seed.sql >/dev/null
}
tower_clone() {
  psql "$ADMIN" -q -c "select pg_terminate_backend(pid) from pg_stat_activity where datname in ('tower','tower_boot') and pid <> pg_backend_pid()" >/dev/null 2>&1 || true
  psql "$ADMIN" -q -c "drop database if exists tower" >/dev/null || return 1
  psql "$ADMIN" -q -c "create database tower template tower_boot" >/dev/null || return 1
}
run_on_tower() {
  if ! tower_clone; then
    echo "WYNIK: 0 OK, 1 FAIL"
    return
  fi
  bash "tests/db/$1" || true
  psql "$ADMIN" -q -c "select pg_terminate_backend(pid) from pg_stat_activity where datname='tower' and pid <> pg_backend_pid()" >/dev/null 2>&1 || true
  psql "$ADMIN" -q -c "drop database if exists tower" >/dev/null 2>&1 || true
}

mapfile -t ALL_SUITES < <("${GS[@]}" --local-order)
if [ -n "${SUITES:-}" ]; then
  IFS=',' read -r -a WANT <<< "$SUITES"
  SUITE_LIST=()
  for s in "${WANT[@]}"; do
    s=$(echo "$s" | tr -d ' ')
    [ -z "$s" ] && continue
    found=0
    for a in "${ALL_SUITES[@]}"; do
      if [ "$a" = "$s" ]; then found=1; break; fi
    done
    if [ "$found" -ne 1 ]; then
      echo "SUITES: nieznany zestaw \"$s\"" >&2
      exit 2
    fi
    SUITE_LIST+=("$s")
  done
else
  SUITE_LIST=("${ALL_SUITES[@]}")
fi

need_tower=0
for s in "${SUITE_LIST[@]}"; do
  mode=$("${GS[@]}" --run "$s")
  [ "$mode" = "tower" ] && need_tower=1
done

if [ "$need_tower" -eq 1 ]; then
  if ! tower_template; then
    echo "[db] szablon tower_boot: migracja nie weszła" >&2
    exit 1
  fi
fi

want_suite() {
  local x
  for x in "${SUITE_LIST[@]}"; do [ "$x" = "$1" ] && return 0; done
  return 1
}

declare -A WYNIK_LINE

# security+status: run.sh (wspólny boot) — gdy którykolwiek w filtrze
if want_suite security || want_suite status; then
  run_out=$(bash tests/db/run.sh 2>/dev/null || true)
  if want_suite security; then
    WYNIK_LINE[security]=$(echo "$run_out" | awk '/^=== security$/{f=1;next} f&&/WYNIK/{print;exit}')
    echo "=== security"
    echo "$run_out" | awk '/^=== security$/{f=1;next} f&&/^=== /{exit} f&&/FAIL/{print}'
    echo "${WYNIK_LINE[security]:-WYNIK: brak}"
  fi
  if want_suite status; then
    WYNIK_LINE[status]=$(echo "$run_out" | awk '/^=== status$/{f=1;next} f&&/WYNIK/{print;exit}')
    echo "=== status"
    echo "$run_out" | awk '/^=== status$/{f=1;next} f&&/^=== /{exit} f&&/FAIL/{print}'
    echo "${WYNIK_LINE[status]:-WYNIK: brak}"
  fi
fi

for s in "${SUITE_LIST[@]}"; do
  case "$s" in
    security|status) continue ;;
  esac
  mode=$("${GS[@]}" --run "$s")
  file=$("${GS[@]}" --file "$s")
  if [ "$mode" = "tower" ]; then
    suite_out=$(run_on_tower "$file" || true)
  elif [ "$s" = "backup" ]; then
    suite_out=$(BACKUP_HOSTED= bash "tests/db/$file" 2>/dev/null || true)
  else
    suite_out=$(bash "tests/db/$file" 2>/dev/null || true)
  fi
  line=$(echo "$suite_out" | grep -E "WYNIK|RAPORT" | tail -1 || true)
  WYNIK_LINE["$s"]=$line
  echo "=== $s"
  echo "$suite_out" | grep -E "FAIL" | head -40 || true
  echo "${line:-WYNIK: brak}"
done

ok=1
check() {
  local name="$1" exp line
  if is_debt "$name"; then
    echo "[db] $name: KNOWN-DEBT (bez asercji liczby)"
    return
  fi
  exp=$(expected_ok "$name")
  if [ -z "$exp" ]; then echo "[db] $name: brak EXPECTED_LOCAL"; ok=0; return; fi
  line=${WYNIK_LINE[$name]:-}
  if [ "$line" = "WYNIK: $exp OK, 0 FAIL" ]; then
    echo "[db] $name $exp/$exp OK"
  else
    echo "[db] $name: oczekiwano $exp/$exp, jest: ${line:-brak}"
    ok=0
  fi
}

for s in "${SUITE_LIST[@]}"; do
  check "$s"
done
[ "$ok" -eq 1 ]
