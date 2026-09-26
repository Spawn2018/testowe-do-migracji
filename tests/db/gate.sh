#!/usr/bin/env bash
# TOWER — brama bazy (BK6): tests/db/run.sh (security + status) + tests/db/storage.sh (BK4) + tests/db/money.sh (Etap 4)
# + tests/db/release.sh (wydanie 1.0: ANEKS 3 §2.1–2.4, ANEKS 4 PR1–PR7)
# z kontrolą wyniku liczbami. run.sh sam nie zwraca błędu przy FAIL (grep zawsze trafia
# w WYNIK) — ten skrypt sprawdza "0 FAIL" i oczekiwane liczby przypadków.
# Użycie: PGADMIN=postgres://postgres@localhost:5433/postgres bash tests/db/gate.sh
# Oczekiwane (brama G3/G4): security 52/52, status 44/44, storage 33/33, money (Etap 4) — liczba niżej.
set -u
cd "$(git rev-parse --show-toplevel)"
ADMIN=${PGADMIN:-postgres://postgres@localhost:5433/postgres}
export PGADMIN="$ADMIN"
# Debian z kilkoma klastrami: bez PGCLUSTER wrapper psql wypisuje ostrzeżenie i psuje porównania.
if [ -z "${PGCLUSTER:-}" ] && command -v pg_lsclusters >/dev/null 2>&1; then
  port=$(printf '%s' "$ADMIN" | sed -nE 's#.*:([0-9]+)/[^/]*$#\1#p'); port=${port:-5432}
  PGCLUSTER=$(pg_lsclusters -h 2>/dev/null | awk -v p="$port" '$3==p {print $1"/"$2; exit}')
  [ -n "$PGCLUSTER" ] && export PGCLUSTER
fi
out=$(bash tests/db/run.sh 2>/dev/null; bash tests/db/storage.sh 2>/dev/null | grep -E "FAIL|WYNIK" | sed '1i === storage'; bash tests/db/money.sh 2>/dev/null | grep -E "FAIL|WYNIK" | sed '1i === money'; bash tests/db/release.sh 2>/dev/null | grep -E "FAIL|WYNIK" | sed '1i === release')
echo "$out" | grep -E "===|WYNIK|FAIL"
ok=1
check() { # suite, expected
  local line; line=$(echo "$out" | awk -v s="=== $1" '$0==s{f=1;next} f&&/WYNIK/{print;exit}')
  if [ "$line" = "WYNIK: $2 OK, 0 FAIL" ]; then echo "[db] $1 $2/$2 OK"; else echo "[db] $1: oczekiwano $2/$2, jest: ${line:-brak}"; ok=0; fi
}
check security 52
check status 44
check storage 33
check money 130
check release 108
[ $ok -eq 1 ]
