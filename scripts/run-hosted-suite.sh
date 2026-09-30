#!/usr/bin/env bash
# Runner jednego zestawu na TEST_DB_URL (już z migracjami).
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"
SUITE="${1:?podaj zestaw np. security.sh}"

eval "$(node scripts/print-test-db-exports.mjs)"

export LANG="${LANG:-C.UTF-8}"
export LC_ALL="${LC_ALL:-C.UTF-8}"
export PGCLIENTENCODING=UTF8
# Hosted: TimeZone UTC → asercje z +02 (jak lokalne PG) wymagają PGTZ
export PGTZ="${PGTZ:-Europe/Warsaw}"
export TOWER_HOSTED_READY=1
export PATH="/d/OMNIROUTE/tools/pg16/pgsql/bin:$PATH"
export TOWER_REAL_PSQL="$(command -v psql)"
export PGURL="$TEST_DB_URL" ADMIN="$TEST_DB_URL" PGADMIN="$TEST_DB_URL"
export TOWER_PSQL_SHIM="$ROOT/scripts/hosted-bin/psql"
# Zawsze wrapper: -d URI + (dla suite z setupem) no-op drop/create/stub/migracji
psql() { bash "$TOWER_PSQL_SHIM" "$@"; }
export -f psql

bash "tests/db/$SUITE"
