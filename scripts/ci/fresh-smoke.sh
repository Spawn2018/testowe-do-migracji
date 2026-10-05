#!/usr/bin/env bash
# chore(BK6): smoke na ŚWIEŻYM buildzie HEAD (nie na dist/ podglądu :4177).
# 1) git archive HEAD → katalog tymczasowy (+ symlink node_modules),
# 2) vite build (tryb demo, VITE_AUTH_MODE=demo) → <tmp>/dist; paczka musi być bez kodu Supabase,
# 3) vite preview na dedykowanym porcie (domyślnie 4179, --strictPort),
# 3b) budżet pierwszego wczytania: scripts/bundle-size.mjs (≤ 400 kB gzip, D15),
# 4) PW_BASE_URL=http://127.0.0.1:<port> → test:visual, test:deur, test:etap4, test:etap5, test:etap6,
# 5) sprzątanie (kill podglądu, rm tmp) przy każdym wyjściu.
# Nigdy nie dotyka dist/ repo ani podglądu :4177.
# Użycie: bash scripts/ci/fresh-smoke.sh   (PORT=4179 domyślnie; KEEP=1 zostawia tmp)
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"
PORT="${FRESH_PORT:-4179}"
if [ "$PORT" = "4177" ]; then echo "[fresh] port 4177 zarezerwowany dla podglądu właściciela" >&2; exit 2; fi
TMP="$(mktemp -d /tmp/wt-fresh-XXXXXX)"
PREVIEW_PID=""
cleanup() {
  if [ -n "$PREVIEW_PID" ]; then kill "$PREVIEW_PID" 2>/dev/null || true; wait "$PREVIEW_PID" 2>/dev/null || true; fi
  [ "${KEEP:-0}" = "1" ] || rm -rf "$TMP"
}
trap cleanup EXIT INT TERM

if (echo >/dev/tcp/127.0.0.1/"$PORT") 2>/dev/null; then
  echo "[fresh] port $PORT zajęty — zwolnij go lub ustaw FRESH_PORT" >&2; exit 2
fi

echo "[fresh] HEAD $(git rev-parse --short HEAD) → $TMP"
git archive HEAD | tar -x -C "$TMP"
ln -s "$ROOT/node_modules" "$TMP/node_modules"
( cd "$TMP" && VITE_AUTH_MODE=demo "$ROOT/node_modules/.bin/vite" build --outDir "$TMP/dist" --logLevel warn )
if grep -l -i "supabase" "$TMP"/dist/assets/*.js >/dev/null 2>&1; then
  echo "[fresh] BŁĄD: paczka demo zawiera kod Supabase" >&2; exit 4
fi
# D15: budżet pierwszego wczytania (gzip) — 400 kB
node "$ROOT/scripts/bundle-size.mjs" "$TMP/dist" --budget-kb=400 || { echo "[fresh] BŁĄD: pierwsze wczytanie ponad budżet" >&2; exit 6; }
( cd "$TMP" && exec "$ROOT/node_modules/.bin/vite" preview --outDir "$TMP/dist" --host 127.0.0.1 --port "$PORT" --strictPort >"$TMP/preview.log" 2>&1 ) &
PREVIEW_PID=$!
for _ in $(seq 1 60); do
  if curl -fsS -o /dev/null "http://127.0.0.1:$PORT/"; then break; fi
  sleep 0.5
done
curl -fsS -o /dev/null "http://127.0.0.1:$PORT/" || { echo "[fresh] podgląd nie wstał" >&2; cat "$TMP/preview.log" >&2; exit 5; }

export PW_BASE_URL="http://127.0.0.1:$PORT"
echo "[fresh] PW_BASE_URL=$PW_BASE_URL"
npm run test:visual
# III-2: zrzuty stanów (najechanie, fokus, wciśnięty, zablokowany, ładowanie, pusty, błąd, walidacja) — próg 0,1%
npx playwright test tests/visual-states.spec.ts
# B-SMOKE-LANG: test:d19 wyłączony (brak #langSeg / PL-only)
npm run test:deur
npm run test:etap4
npm run test:etap5
npm run test:etap6
echo "[fresh] OK"
