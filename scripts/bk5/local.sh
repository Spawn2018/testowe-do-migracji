#!/usr/bin/env bash
# ANEKS 5 §2.2 — BK5 (test API) WYŁĄCZNIE na lokalnym Supabase (CLI + Docker). Nigdy na produkcji.
# Wymaga: `supabase start` (np. --workdir /tmp/sblocal z kopią supabase/), Docker.
# Nadpisuje zmienne z .env.local lokalnymi (process.env ma pierwszeństwo w loadEnvLocal i w Vite)
# i PRZERYWA, jeśli adres API nie jest lokalny.
# Użycie: SB_WORKDIR=/tmp/sblocal bash scripts/bk5/local.sh
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
WD=${SB_WORKDIR:-/tmp/sblocal}
DOCKER_SG=${DOCKER_SG:-sg docker -c}
eval "$($DOCKER_SG "npx supabase status --workdir $WD -o env" 2>/dev/null | grep -E '^(API_URL|ANON_KEY|SERVICE_ROLE_KEY|DB_URL|MAILPIT_URL)=')"
case "$API_URL" in http://127.0.0.1:*|http://localhost:*) ;; *) echo "BK5 STOP: API_URL nie jest lokalny" >&2; exit 2 ;; esac
export VITE_SUPABASE_URL="$API_URL" VITE_SUPABASE_ANON_KEY="$ANON_KEY" SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY"
export TEST_USER_HHL_EMAIL=hhl@bk5.local TEST_USER_KSH_EMAIL=ksh@bk5.local TEST_USER_SCX_EMAIL=scx@bk5.local
export SUPABASE_DB_URL="$DB_URL" SUPABASE_DB_POOLER_URL="$DB_URL" MAILPIT_URL
psql "$DB_URL" -q -v ON_ERROR_STOP=1 -f supabase/seed/stegra.sql >/dev/null
node scripts/auth/seed-test-users.mjs
SUPABASE_LIVE=1 npx vitest run tests/supabase-provider.live.test.ts 2>&1 | grep -E 'Tests |FAIL' || true   # fixture TEST-BK3-A/B
BK5_LOCAL=1 npx vitest run tests/session-year.local.test.ts 2>&1 | grep -E 'Tests |FAIL|✓|×' || true   # A5 §4.5 na prawdziwym GoTrue
OUT=/tmp/wt-sb-local
VITE_AUTH_MODE=supabase npx vite build --outDir "$OUT" --emptyOutDir >/dev/null
PORT=${BK5_PORT:-4178}
setsid npx vite preview --outDir "$OUT" --host 127.0.0.1 --port "$PORT" --strictPort >/tmp/bk5-local-preview.log 2>&1 &
PREV=$!
trap 'kill -- -$PREV 2>/dev/null || kill $PREV 2>/dev/null || true' EXIT
for i in $(seq 1 30); do curl -sf "http://127.0.0.1:$PORT/" >/dev/null && break; sleep 1; done
SUPABASE_LIVE=1 BK5_BASE="http://127.0.0.1:$PORT/" npx playwright test tests/bk5-api.live.spec.ts ${BK5_EXTRA:-} --reporter=line
