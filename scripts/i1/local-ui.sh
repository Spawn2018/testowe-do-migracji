#!/usr/bin/env bash
# I-1 — import w interfejsie buildu produkcyjnego na LOKALNYM Supabase (nigdy produkcja). Port 4180 (nie 4177/4179).
# Użycie: SB_WORKDIR=/tmp/sblocal bash scripts/i1/local-ui.sh   (po scripts/i1/local.sh — konta testowe)
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
WD=${SB_WORKDIR:-/tmp/sblocal}
eval "$(npx -y supabase@latest status --workdir "$WD" -o env 2>/dev/null | grep -E '^(API_URL|ANON_KEY|SERVICE_ROLE_KEY|DB_URL)=')"
case "$API_URL" in http://127.0.0.1:*|http://localhost:*) ;; *) echo "I-1 STOP: API_URL nie jest lokalny" >&2; exit 2 ;; esac
export VITE_SUPABASE_URL="$API_URL" VITE_SUPABASE_ANON_KEY="$ANON_KEY" SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY" SUPABASE_DB_URL="$DB_URL"
OUT=/tmp/wt-i1-ui
VITE_AUTH_MODE=supabase npx vite build --outDir "$OUT" --emptyOutDir --logLevel warn
PORT=${I1_PORT:-4180}
setsid npx vite preview --outDir "$OUT" --host 127.0.0.1 --port "$PORT" --strictPort >/tmp/i1-ui-preview.log 2>&1 &
PREV=$!
trap 'kill -- -$PREV 2>/dev/null || kill $PREV 2>/dev/null || true' EXIT
for i in $(seq 1 30); do curl -sf "http://127.0.0.1:$PORT/" >/dev/null && break; sleep 1; done
I1_UI_BASE="http://127.0.0.1:$PORT/" npx playwright test tests/i1-import-ui.local.spec.ts --reporter=line
