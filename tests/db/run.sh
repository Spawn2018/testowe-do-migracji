#!/usr/bin/env bash
# Pełny przebieg od zera: czysta baza → atrapa Supabase → migracje → dane → test.
set -e
ADMIN=${PGADMIN:-postgres://postgres@localhost:5433/postgres}
DB=${PGDB:-tower_test}
URL=${ADMIN%/*}/$DB
psql "$ADMIN" -q -c "drop database if exists $DB" -c "create database $DB"
psql "$URL" -q -v ON_ERROR_STOP=1 -f tests/db/supabase_stub.sql
for f in supabase/migrations/*.sql; do psql "$URL" -q -v ON_ERROR_STOP=1 -f "$f" >/dev/null && echo "migracja OK  $f"; done
psql "$URL" -q -v ON_ERROR_STOP=1 -f tests/db/seed.sql
PGURL=$URL bash tests/db/security.sh
