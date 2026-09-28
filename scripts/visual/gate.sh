#!/usr/bin/env bash
# III-2 (SCOPE 0.3) — PEŁNA brama wizualna, lokalnie (GitHub Actions odrzucone w III-3):
# 1) git archive HEAD → katalog tymczasowy, build demo (nie dist/ repo),
# 2) vite preview na własnym porcie (domyślnie 4188; 4177 = podgląd właściciela — odmowa),
# 3) smoke 4 ujęć (tests/visual.spec.ts) + 11 zrzutów stanów (tests/visual-states.spec.ts, próg 0,1%),
# 4) pełna matryca 840 ujęć (scripts/baseline.mjs) → porównanie z shots-baseline/ (scripts/compare-baseline.mjs),
#    próg 0,1% pikseli na ujęcie (RATIO_THR=0.001, tolerancja koloru 0.28 jak smoke); każde ujęcie ponad próg = błąd.
# Czas: ~45–50 min (matryca ~20 ujęć/min) — dlatego osobno od pre-push (tam smoke + stany, ~1,5 min).
# Użycie: npm run gate:visual   (VIS_PORT=4188, KEEP=1 zostawia katalog, SKIP_MATRIX=1 tylko kroki 1–3)
# Raport: test-results/visual-gate-report.json; ujęcia kandydujące: $TMP/shots
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"
PORT="${VIS_PORT:-4188}"
if [ "$PORT" = "4177" ]; then echo "[gate:visual] port 4177 zarezerwowany dla podglądu właściciela" >&2; exit 2; fi
if (echo >/dev/tcp/127.0.0.1/"$PORT") 2>/dev/null; then echo "[gate:visual] port $PORT zajęty — ustaw VIS_PORT" >&2; exit 2; fi
TMP="$(mktemp -d /tmp/wt-visgate-XXXXXX)"
PREVIEW_PID=""
cleanup() {
  if [ -n "$PREVIEW_PID" ]; then kill "$PREVIEW_PID" 2>/dev/null || true; wait "$PREVIEW_PID" 2>/dev/null || true; fi
  [ "${KEEP:-0}" = "1" ] || rm -rf "$TMP"
}
trap cleanup EXIT INT TERM

echo "[gate:visual] HEAD $(git rev-parse --short HEAD) → $TMP (port $PORT)"
git archive HEAD | tar -x -C "$TMP"
ln -s "$ROOT/node_modules" "$TMP/node_modules"
( cd "$TMP" && VITE_AUTH_MODE=demo "$ROOT/node_modules/.bin/vite" build --outDir "$TMP/dist" --logLevel error )
( cd "$TMP" && exec "$ROOT/node_modules/.bin/vite" preview --outDir "$TMP/dist" --host 127.0.0.1 --port "$PORT" --strictPort >"$TMP/preview.log" 2>&1 ) &
PREVIEW_PID=$!
for _ in $(seq 1 60); do curl -fsS -o /dev/null "http://127.0.0.1:$PORT/" && break; sleep 0.5; done
curl -fsS -o /dev/null "http://127.0.0.1:$PORT/" || { echo "[gate:visual] podgląd nie wstał" >&2; cat "$TMP/preview.log" >&2; exit 5; }

export PW_BASE_URL="http://127.0.0.1:$PORT"
npx playwright test tests/visual.spec.ts tests/visual-states.spec.ts
[ "${SKIP_MATRIX:-0}" = "1" ] && { echo "[gate:visual] OK (bez matrycy)"; exit 0; }

BASE_URL="$PW_BASE_URL/" OUT="$(realpath --relative-to="$ROOT" "$TMP/shots")" node scripts/baseline.mjs > "$TMP/matrix.log" 2>&1 \
  || { echo "[gate:visual] matryca: błędy ujęć" >&2; grep FAIL "$TMP/matrix.log" | head -20 >&2; exit 3; }
CANDIDATE="$(realpath --relative-to="$ROOT" "$TMP/shots")" BASELINE=shots-baseline REPORT=test-results/visual-gate-report.json \
  RATIO_THR=0.001 MAX_DIFF_PX=999999999 STRICT=1 node scripts/compare-baseline.mjs
echo "[gate:visual] OK — 840 ujęć w progu 0,1%"
