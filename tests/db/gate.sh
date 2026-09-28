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
. "$(git rev-parse --show-toplevel)/tests/db/local-only.sh"
export PGADMIN="$ADMIN"
# Debian z kilkoma klastrami: bez PGCLUSTER wrapper psql wypisuje ostrzeżenie i psuje porównania.
if [ -z "${PGCLUSTER:-}" ] && command -v pg_lsclusters >/dev/null 2>&1; then
  port=$(printf '%s' "$ADMIN" | sed -nE 's#.*:([0-9]+)/[^/]*$#\1#p'); port=${port:-5432}
  PGCLUSTER=$(pg_lsclusters -h 2>/dev/null | awk -v p="$port" '$3==p {print $1"/"$2; exit}')
  [ -n "$PGCLUSTER" ] && export PGCLUSTER
fi
out=$(bash tests/db/run.sh 2>/dev/null; bash tests/db/storage.sh 2>/dev/null | grep -E "FAIL|WYNIK" | sed '1i === storage'; bash tests/db/money.sh 2>/dev/null | grep -E "FAIL|WYNIK" | sed '1i === money'; bash tests/db/release.sh 2>/dev/null | grep -E "FAIL|WYNIK" | sed '1i === release'; BACKUP_HOSTED= bash tests/db/backup.sh 2>/dev/null | grep -E "FAIL|WYNIK" | sed '1i === backup'; bash tests/db/session.sh 2>/dev/null | grep -E "FAIL|WYNIK" | sed '1i === session'; bash tests/db/archive.sh 2>/dev/null | grep -E "FAIL|WYNIK" | sed '1i === archive'; bash tests/db/watchdog.sh 2>/dev/null | grep -E "FAIL|WYNIK" | sed '1i === watchdog'; bash tests/db/invite.sh 2>/dev/null | grep -E "FAIL|WYNIK" | sed '1i === invite'; bash tests/db/risks.sh 2>/dev/null | grep -E "FAIL|WYNIK" | sed '1i === risks'; bash tests/db/import.sh 2>/dev/null | grep -E "FAIL|WYNIK" | sed '1i === import'; bash tests/db/nullguard.sh 2>/dev/null | grep -E "FAIL|WYNIK" | sed '1i === nullguard'; bash tests/db/i2.sh 2>/dev/null | grep -E "FAIL|WYNIK" | sed '1i === i2')
echo "$out" | grep -E "===|WYNIK|FAIL"
ok=1
check() { # suite, expected
  local line; line=$(echo "$out" | awk -v s="=== $1" '$0==s{f=1;next} f&&/WYNIK/{print;exit}')
  if [ "$line" = "WYNIK: $2 OK, 0 FAIL" ]; then echo "[db] $1 $2/$2 OK"; else echo "[db] $1: oczekiwano $2/$2, jest: ${line:-brak}"; ok=0; fi
}
check security 83
check status 44
check storage 37
check money 130
check release 145
check backup 23
check session 27
check archive 18
check watchdog 27
check invite 48
check risks 23
check import 48
check nullguard 280
check i2 333
[ $ok -eq 1 ]
