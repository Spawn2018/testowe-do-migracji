#!/usr/bin/env bash
# Baseline PASYWNY na PROD (lub wskazanym URL).
# Spider + passive scan ONLY — bez Active Scan.
# Użycie: scripts/zap-baseline-passive.sh [URL]
# Domyślnie: https://tower.log-mar.pl
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ZAP_HOME="${ZAP_HOME:-/workspace/tools/ZAP_2.16.0}"
TARGET="${1:-https://tower.log-mar.pl}"
PORT="${ZAP_PORT:-8090}"
OUT_DIR="${OUT_DIR:-$ROOT/docs/evidence/zap}"
STAMP="$(TZ=Europe/Warsaw date +%Y-%m-%d_%H%M)"
REPORT_HTML="$OUT_DIR/baseline-passive-${STAMP}.html"
API="http://127.0.0.1:${PORT}"
mkdir -p "$OUT_DIR"

if [[ ! -x "$ZAP_HOME/zap.sh" ]]; then
  echo "Brak ZAP: $ZAP_HOME/zap.sh" >&2
  exit 1
fi

# Guard: ten skrypt NIGDY nie uruchamia Active Scan
export ZAP_MODE=passive

echo "[zap-passive] target=$TARGET port=$PORT"
"$ZAP_HOME/zap.sh" -daemon -host 127.0.0.1 -port "$PORT" \
  -config api.disablekey=true \
  -config api.addrs.addr.name=.* \
  -config api.addrs.addr.regex=true \
  -config spider.maxDuration=2 \
  >/tmp/zap-passive-daemon.log 2>&1 &
ZAP_PID=$!
cleanup() {
  curl -fsS "$API/JSON/core/action/shutdown/" >/dev/null 2>&1 || true
  wait "$ZAP_PID" 2>/dev/null || true
}
trap cleanup EXIT

echo -n "[zap-passive] czekam na API"
for i in $(seq 1 90); do
  if curl -fsS "$API/JSON/core/view/version/" >/dev/null 2>&1; then
    echo " OK"
    break
  fi
  echo -n .
  sleep 2
  if [[ $i -eq 90 ]]; then echo " TIMEOUT"; exit 1; fi
done

enc() { python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1], safe=''))" "$1"; }
TENC="$(enc "$TARGET")"

curl -fsS "$API/JSON/core/action/accessUrl/?url=${TENC}&followRedirects=true" >/dev/null
SCAN_ID="$(curl -fsS "$API/JSON/spider/action/scan/?url=${TENC}&maxChildren=20&recurse=true" | python3 -c "import sys,json; print(json.load(sys.stdin).get('scan',0))")"
echo "[zap-passive] spider id=$SCAN_ID"
for i in $(seq 1 120); do
  ST="$(curl -fsS "$API/JSON/spider/view/status/?scanId=${SCAN_ID}" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status','0'))")"
  [[ "$ST" == "100" ]] && break
  sleep 2
done

# Czekaj aż kolejka passive się opróżni
for i in $(seq 1 120); do
  LEFT="$(curl -fsS "$API/JSON/pscan/view/recordsToScan/" | python3 -c "import sys,json; print(json.load(sys.stdin).get('recordsToScan','0'))")"
  [[ "$LEFT" == "0" ]] && break
  sleep 1
done

# Twarde sprawdzenie: Active Scan NIE może być uruchomiony
AS="$(curl -fsS "$API/JSON/ascan/view/scans/" 2>/dev/null || echo '{}')"
if echo "$AS" | grep -qiE '"progress"[[:space:]]*:[[:space:]]*"[1-9]|"state"[[:space:]]*:[[:space:]]*"RUNNING"'; then
  echo "BŁĄD: wykryto Active Scan — abort" >&2
  exit 2
fi

curl -fsS "$API/OTHER/core/other/htmlreport/" -o "$REPORT_HTML"
echo "[zap-passive] raport: $REPORT_HTML"
echo "[zap-passive] UWAGA: nie używaj zap.sh -quickurl na prod (uruchamia Active Scan)."
