#!/usr/bin/env bash
# I-1 — import harmonogramu na realnej skali, WYŁĄCZNIE lokalny Supabase (CLI + Docker). Nigdy na produkcji.
# Wymaga: npx supabase start --workdir /tmp/sblocal (kopia supabase/ z migracjami do 0050).
# Użycie: SB_WORKDIR=/tmp/sblocal bash scripts/i1/local.sh
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
WD=${SB_WORKDIR:-/tmp/sblocal}
eval "$(npx -y supabase@latest status --workdir "$WD" -o env 2>/dev/null | grep -E '^(API_URL|ANON_KEY|SERVICE_ROLE_KEY|DB_URL)=')"
case "$API_URL" in http://127.0.0.1:*|http://localhost:*) ;; *) echo "I-1 STOP: API_URL nie jest lokalny" >&2; exit 2 ;; esac
export VITE_SUPABASE_URL="$API_URL" VITE_SUPABASE_ANON_KEY="$ANON_KEY" SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY"
export TEST_USER_HHL_EMAIL=hhl@bk5.local TEST_USER_KSH_EMAIL=ksh@bk5.local TEST_USER_SCX_EMAIL=scx@bk5.local
export SUPABASE_DB_URL="$DB_URL" SUPABASE_DB_POOLER_URL="$DB_URL"
psql "$DB_URL" -q -v ON_ERROR_STOP=1 -f supabase/seed/stegra.sql >/dev/null
node scripts/auth/seed-test-users.mjs
I1_LOCAL=1 npx vitest run tests/schedule-import.local.test.ts --reporter=verbose 2>&1 | grep -vE '^\s*$'
