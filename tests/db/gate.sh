#!/usr/bin/env bash
# TOWER — brama bazy (BK6): tests/db/run.sh (security + status) + tests/db/storage.sh (BK4) + tests/db/money.sh (Etap 4)
# + tests/db/release.sh (wydanie 1.0: ANEKS 3 §2.1–2.4, ANEKS 4 PR1–PR7) + tests/db/backup.sh (PR2, bez R2)
# + tests/db/risks.sh (A6-T1: title_key, po run.sh) + tests/db/import.sh (I-1: import_schedule) + tests/db/nullguard.sh (I-2A: NULL = odmowa) + tests/db/i2.sh (I-2d ETA v1, I-2f SEFS) z kontrolą wyniku liczbami. run.sh sam nie zwraca błędu przy FAIL (grep zawsze trafia
# w WYNIK) — ten skrypt sprawdza "0 FAIL" i oczekiwane liczby przypadków.
# Użycie: PGADMIN=postgres://postgres@localhost:5433/postgres bash tests/db/gate.sh
# Oczekiwane (brama G3/G4): security 52/52, status 44/44, storage 33/33, money (Etap 4) — liczba niżej.
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
# Zestawy dec5/dec6/adm10/hist11/dec-auto łączą się z bazą o nazwie tower i same jej nie tworzą.
# Brama robi jeden szablon (migracje + seed), potem świeżą kopię przed każdym z nich, i kasuje obie po przebiegu.
tower_drop() {
  psql "$ADMIN" -q -c "select pg_terminate_backend(pid) from pg_stat_activity where datname in ('tower','tower_boot') and pid <> pg_backend_pid()" >/dev/null 2>&1 || true
  psql "$ADMIN" -q -c "drop database if exists tower" -c "drop database if exists tower_boot" >/dev/null 2>&1 || true
}
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
run_on_tower() { # $1 = plik zestawu
  if ! tower_clone; then
    echo "WYNIK: 0 OK, 1 FAIL"
    return
  fi
  bash "tests/db/$1" || true
  psql "$ADMIN" -q -c "select pg_terminate_backend(pid) from pg_stat_activity where datname='tower' and pid <> pg_backend_pid()" >/dev/null 2>&1 || true
  psql "$ADMIN" -q -c "drop database if exists tower" >/dev/null 2>&1 || true
}
trap tower_drop EXIT
if ! tower_template; then
  echo "[db] szablon tower_boot: migracja nie weszła" >&2
  exit 1
fi
out=$(bash tests/db/run.sh 2>/dev/null; bash tests/db/storage.sh 2>/dev/null | grep -E "FAIL|WYNIK" | sed '1i === storage'; bash tests/db/money.sh 2>/dev/null | grep -E "FAIL|WYNIK" | sed '1i === money'; bash tests/db/release.sh 2>/dev/null | grep -E "FAIL|WYNIK" | sed '1i === release'; BACKUP_HOSTED= bash tests/db/backup.sh 2>/dev/null | grep -E "FAIL|WYNIK" | sed '1i === backup'; bash tests/db/session.sh 2>/dev/null | grep -E "FAIL|WYNIK" | sed '1i === session'; bash tests/db/archive.sh 2>/dev/null | grep -E "FAIL|WYNIK" | sed '1i === archive'; bash tests/db/watchdog.sh 2>/dev/null | grep -E "FAIL|WYNIK" | sed '1i === watchdog'; bash tests/db/invite.sh 2>/dev/null | grep -E "FAIL|WYNIK" | sed '1i === invite'; bash tests/db/risks.sh 2>/dev/null | grep -E "FAIL|WYNIK" | sed '1i === risks'; bash tests/db/import.sh 2>/dev/null | grep -E "FAIL|WYNIK" | sed '1i === import'; bash tests/db/nullguard.sh 2>/dev/null | grep -E "FAIL|WYNIK" | sed '1i === nullguard'; bash tests/db/i2.sh 2>/dev/null | grep -E "FAIL|WYNIK" | sed '1i === i2'; bash tests/db/i30.sh 2>/dev/null | grep -E "FAIL|WYNIK" | sed '1i === i30'; bash tests/db/i31.sh 2>/dev/null | grep -E "FAIL|WYNIK" | sed '1i === i31'; bash tests/db/dec2.sh 2>/dev/null | grep -E "FAIL|WYNIK" | sed '1i === dec2'; bash tests/db/dec3.sh 2>/dev/null | grep -E "FAIL|WYNIK" | sed '1i === dec3'; run_on_tower dec5.sh | grep -E "FAIL|WYNIK" | sed '1i === dec5'; run_on_tower dec6.sh | grep -E "FAIL|WYNIK" | sed '1i === dec6'; run_on_tower adm10.sh | grep -E "FAIL|WYNIK" | sed '1i === adm10'; run_on_tower hist11.sh | grep -E "FAIL|WYNIK" | sed '1i === hist11'; bash tests/db/workflows.sh 2>/dev/null | grep -E "FAIL|WYNIK" | sed '1i === workflows'; bash tests/db/insurance.sh 2>/dev/null | grep -E "FAIL|WYNIK" | sed '1i === insurance'; run_on_tower dec-auto.sh | grep -E "FAIL|WYNIK" | sed '1i === dec-auto'; run_on_tower dwell.sh | grep -E "FAIL|WYNIK" | sed '1i === dwell'; run_on_tower l13.sh | grep -E "FAIL|WYNIK|RAPORT" | sed '1i === l13'; run_on_tower l12.sh | grep -E "FAIL|WYNIK" | sed '1i === l12'; run_on_tower h1.sh | grep -E "FAIL|WYNIK" | sed '1i === h1'; run_on_tower h3.sh | grep -E "FAIL|WYNIK" | sed '1i === h3'; run_on_tower smsksh.sh | grep -E "FAIL|WYNIK" | sed '1i === smsksh')
echo "$out" | grep -E "===|WYNIK|FAIL"
ok=1
check() { # suite, expected
  local line; line=$(echo "$out" | awk -v s="=== $1" '$0==s{f=1;next} f&&/WYNIK/{print;exit}')
  if [ "$line" = "WYNIK: $2 OK, 0 FAIL" ]; then echo "[db] $1 $2/$2 OK"; else echo "[db] $1: oczekiwano $2/$2, jest: ${line:-brak}"; ok=0; fi
}
check security 88
check status 44
check storage 37
check money 135
check release 146
check backup 29
check session 27
check archive 18
check watchdog 27
check invite 48
check risks 23
check import 66
check nullguard 563
check i2 527
check i30 10
check i31 6
check dec2 26
check dec3 13
check dec5 11
check dec6 15
check adm10 8
check hist11 11
check workflows 47
check insurance 42
check dec-auto 64
check dwell 17
check l13 34
check l12 12
check h1 14
check h3 20
check smsksh 16
[ $ok -eq 1 ]
