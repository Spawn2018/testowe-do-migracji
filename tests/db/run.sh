#!/usr/bin/env bash
# TOWER — pełny sprawdzian bazy. Każdy zestaw na własnej, czystej bazie:
# atrapa Supabase → migracje 0001–000N → dane testowe → test.
#   security.sh — kto co widzi i zmienia (podszywanie pod HHL, KSH, SCX)
#   status.sh   — automatyka statusów: podróże ciężarówek pozycjami GPS
# UWAGA: supabase_stub.sql NIGDY nie uruchamiaj na prawdziwym Supabase.
set -e
ADMIN=${PGADMIN:-postgres://postgres@localhost:5433/postgres}
. "$(git rev-parse --show-toplevel)/tests/db/local-only.sh"
suma=0
for t in security status; do
  DB="tower_test_$t"; URL="${ADMIN%/*}/$DB"
  psql "$ADMIN" -q -c "drop database if exists $DB" -c "create database $DB"
  psql "$URL" -q -v ON_ERROR_STOP=1 -f tests/db/supabase_stub.sql
  for f in supabase/migrations/*.sql; do psql "$URL" -q -v ON_ERROR_STOP=1 -f "$f" >/dev/null; done
  psql "$URL" -q -v ON_ERROR_STOP=1 -f tests/db/seed.sql
  echo "=== $t"
  PGURL="$URL" bash "tests/db/$t.sh" | grep -E "FAIL|WYNIK" || suma=1
done
exit $suma
