#!/usr/bin/env bash
# Pełny Active Scan — WYŁĄCZNIE na URL TEST.
# Prod (tower.log-mar.pl, watch-tower-makieta.vercel.app) = twarde odrzucenie.
# Użycie: scripts/zap-full-active.sh <TEST_URL>
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ZAP_HOME="${ZAP_HOME:-/workspace/tools/ZAP_2.16.0}"
TARGET="${1:-}"
PORT="${ZAP_PORT:-8091}"
OUT_DIR="${OUT_DIR:-$ROOT/docs/evidence/zap}"
STAMP="$(TZ=Europe/Warsaw date +%Y-%m-%d_%H%M)"
mkdir -p "$OUT_DIR"

if [[ -z "$TARGET" ]]; then
  echo "Użycie: $0 <TEST_URL>" >&2
  echo "Prod jest zabroniony. Podaj URL środowiska TEST." >&2
  exit 1
fi

# Guard — wspólna logika z testem jednostkowym
node "$ROOT/scripts/zap/assert-not-prod-url.mjs" "$TARGET" || exit $?

API="http://127.0.0.1:${PORT}"
REPORT_HTML="$OUT_DIR/full-active-test-${STAMP}.html"

"$ZAP_HOME/zap.sh" -daemon -host 127.0.0.1 -port "$PORT" \
  -config api.disablekey=true \
  -config api.addrs.addr.name=.* \
  -config api.addrs.addr.regex=true \
  >/tmp/zap-active-daemon.log 2>&1 &
ZAP_PID=$!
cleanup() {
  curl -fsS "$API/JSON/core/action/shutdown/" >/dev/null 2>&1 || true
  wait "$ZAP_PID" 2>/dev/null || true
}
trap cleanup EXIT

for i in $(seq 1 90); do
  curl -fsS "$API/JSON/core/view/version/" >/dev/null 2>&1 && break
  sleep 2
  [[ $i -eq 90 ]] && exit 1
done

enc() { python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1], safe=''))" "$1"; }
TENC="$(enc "$TARGET")"
curl -fsS "$API/JSON/core/action/accessUrl/?url=${TENC}&followRedirects=true" >/dev/null
SP="$(curl -fsS "$API/JSON/spider/action/scan/?url=${TENC}" | python3 -c "import sys,json; print(json.load(sys.stdin).get('scan',0))")"
for i in $(seq 1 180); do
  ST="$(curl -fsS "$API/JSON/spider/view/status/?scanId=${SP}" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status','0'))")"
  [[ "$ST" == "100" ]] && break
  sleep 2
done
# Active Scan — tylko po guardzie URL
AS="$(curl -fsS "$API/JSON/ascan/action/scan/?url=${TENC}&recurse=true" | python3 -c "import sys,json; print(json.load(sys.stdin).get('scan',0))")"
echo "[zap-active] ascan id=$AS on $TARGET"
for i in $(seq 1 600); do
  ST="$(curl -fsS "$API/JSON/ascan/view/status/?scanId=${AS}" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status','0'))")"
  [[ "$ST" == "100" ]] && break
  sleep 3
done
curl -fsS "$API/OTHER/core/other/htmlreport/" -o "$REPORT_HTML"
echo "[zap-active] raport: $REPORT_HTML"
