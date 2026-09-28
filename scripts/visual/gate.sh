#!/usr/bin/env bash
# III-2 (SCOPE 0.3) / D-25 — PEŁNA brama wizualna, lokalnie i BEZ NADZORU (np. co noc z crona właściciela):
# 1) git archive HEAD → katalog tymczasowy, build demo (nie dist/ repo),
# 2) vite preview na własnym porcie (domyślnie 4188; 4177 = podgląd właściciela — odmowa),
# 3) smoke 4 ujęć (tests/visual.spec.ts) + zrzuty stanów (tests/visual-states.spec.ts, próg 0,1%),
# 4) pełna matryca 840 ujęć (scripts/baseline.mjs) → porównanie z shots-baseline/ (scripts/compare-baseline.mjs),
#    próg 0,1% pikseli na ujęcie (RATIO_THR=0.001, tolerancja koloru 0.28 jak smoke).
# Wynik ZAWSZE (także przy błędzie) jako jedna linia w $GATE_OUT/last.txt (domyślnie /workspace/wt-gate-visual/last.txt)
# i dopisana do $GATE_OUT/history.log; raport JSON: $GATE_OUT/last-report.json; log: $GATE_OUT/last.log.
# Linia: „<czas ISO> <OK|FAIL> HEAD=<sha> smoke=<ok|fail> stany=<ok|fail> matryca=<zgodne>/<ogółem> zmienione=<n> [powód=…] czas=<s>s”
# Kod wyjścia: 0 OK · 1 różnice ponad próg · 2 port zajęty/zarezerwowany albo trwa inny przebieg · 3 błąd ujęć matrycy ·
#              4 smoke/stany czerwone · 5 podgląd nie wstał / build nieudany.
# Czas: ~70 min (matryca ~12–20 ujęć/min). Użycie: npm run gate:visual  (VIS_PORT, GATE_OUT, KEEP=1, SKIP_MATRIX=1)
set -uo pipefail
ROOT="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
cd "$ROOT"
PORT="${VIS_PORT:-4188}"
OUTD="${GATE_OUT:-/workspace/wt-gate-visual}"
mkdir -p "$OUTD"
T0=$(date +%s)
HEAD_SHA=$(git rev-parse --short HEAD)
SMOKE=nie-uruchomiony; MATRIX=-; CHANGED=-; REASON=""
TMP=""; PREVIEW_PID=""
finish() {
  local code=$1
  [ -n "$PREVIEW_PID" ] && { kill "$PREVIEW_PID" 2>/dev/null; wait "$PREVIEW_PID" 2>/dev/null; }
  [ -n "$TMP" ] && [ "${KEEP:-0}" != "1" ] && rm -rf "$TMP"
  local res=OK; [ "$code" = 0 ] || res=FAIL
  local line="$(date -Iseconds) $res HEAD=$HEAD_SHA smoke+stany=$SMOKE matryca=$MATRIX zmienione=$CHANGED${REASON:+ powód=$REASON} czas=$(( $(date +%s) - T0 ))s kod=$code"
  echo "$line" > "$OUTD/last.txt"; echo "$line" >> "$OUTD/history.log"; echo "[gate:visual] $line"
  rm -f "$OUTD/.lock"
  exit "$code"
}
trap 'REASON=przerwany; finish 2' INT TERM
if [ -e "$OUTD/.lock" ] && kill -0 "$(cat "$OUTD/.lock" 2>/dev/null)" 2>/dev/null; then
  echo "$(date -Iseconds) FAIL HEAD=$HEAD_SHA powód=trwa-inny-przebieg kod=2" >> "$OUTD/history.log"; exit 2
fi
echo $$ > "$OUTD/.lock"
exec > >(tee "$OUTD/last.log") 2>&1
if [ "$PORT" = "4177" ]; then REASON=port-4177-zarezerwowany; finish 2; fi
if (echo >/dev/tcp/127.0.0.1/"$PORT") 2>/dev/null; then REASON=port-$PORT-zajęty; finish 2; fi
TMP="$(mktemp -d /tmp/wt-visgate-XXXXXX)"

echo "[gate:visual] HEAD $HEAD_SHA → $TMP (port $PORT)"
git archive HEAD | tar -x -C "$TMP" || { REASON=archive; finish 5; }
ln -s "$ROOT/node_modules" "$TMP/node_modules"
( cd "$TMP" && VITE_AUTH_MODE=demo "$ROOT/node_modules/.bin/vite" build --outDir "$TMP/dist" --logLevel error ) || { REASON=build; finish 5; }
( cd "$TMP" && exec "$ROOT/node_modules/.bin/vite" preview --outDir "$TMP/dist" --host 127.0.0.1 --port "$PORT" --strictPort >"$TMP/preview.log" 2>&1 ) &
PREVIEW_PID=$!
for _ in $(seq 1 60); do curl -fsS -o /dev/null "http://127.0.0.1:$PORT/" && break; sleep 0.5; done
curl -fsS -o /dev/null "http://127.0.0.1:$PORT/" || { REASON=podgląd-nie-wstał; finish 5; }

export PW_BASE_URL="http://127.0.0.1:$PORT"
if npx playwright test tests/visual.spec.ts tests/visual-states.spec.ts --output "$TMP/pw-results"; then SMOKE=ok; else SMOKE=fail; fi
if [ "${SKIP_MATRIX:-0}" = "1" ]; then [ "$SMOKE" = ok ] && finish 0 || finish 4; fi

mkdir -p "$TMP/gate-shots"   # nie "$TMP/shots": git archive rozpakowuje tam 17 śledzonych zrzutów z 23.09 (shots/), co psuło porównanie (missingInBaseline=17 → kod 2)
REL="$(realpath --relative-to="$ROOT" "$TMP/gate-shots")"
if ! BASE_URL="$PW_BASE_URL/" OUT="$REL" node scripts/baseline.mjs > "$TMP/matrix.log" 2>&1; then
  grep FAIL "$TMP/matrix.log" | head -20; REASON=błędy-ujęć-matrycy; finish 3
fi
REPORT_REL="$(realpath --relative-to="$ROOT" "$OUTD/last-report.json")"
CANDIDATE="$REL" BASELINE=shots-baseline REPORT="$REPORT_REL" RATIO_THR=0.001 MAX_DIFF_PX=999999999 STRICT=1 node scripts/compare-baseline.mjs
CMP=$?
read -r IDENT TOTAL CHG < <(node -e "const r=require('$OUTD/last-report.json').totals;console.log(r.identical, r.compared, r.changed)")
MATRIX="$IDENT/$TOTAL"; CHANGED="$CHG"
if [ "$CMP" != 0 ]; then REASON=różnice-ponad-0,1%; finish 1; fi
[ "$SMOKE" = ok ] || { REASON=smoke-lub-stany; finish 4; }
finish 0
