#!/usr/bin/env bash
# TOWER — pełny sprawdzian bazy. Każdy zestaw na własnej, czystej bazie:
# atrapa Supabase → migracje 0001–000N → dane testowe → test.
#   security.sh — kto co widzi i zmienia (podszywanie pod HHL, KSH, SCX)
#   status.sh   — automatyka statusów: podróże ciężarówek pozycjami GPS
# UWAGA: supabase_stub.sql NIGDY nie uruchamiaj na prawdziwym Supabase.
# Hosted: TOWER_HOSTED_READY=1 PGURL=… (schemat przygotowany przez test-db-gate.mjs).
set -e
cd "$(git rev-parse --show-toplevel)"
ADMIN=${PGADMIN:-postgres://postgres@localhost:5433/postgres}
suma=0
for t in security status; do
  DB="tower_test_$t"
  # shellcheck source=boot.sh
  . "$(git rev-parse --show-toplevel)/tests/db/boot.sh"
  echo "=== $t"
  PGURL="$URL" bash "tests/db/$t.sh" | grep -E "FAIL|WYNIK" || suma=1
done
exit $suma
