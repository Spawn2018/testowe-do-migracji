#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
export AISSTREAM_API_KEY
AISSTREAM_API_KEY="$(python3 -c "import json; print(json.load(open('/home/box/agent-data/box-secrets.json'))['card']['AISSTREAM_API_KEY'])")"
export AIS_PROXY_PORT="${AIS_PROXY_PORT:-4175}"
# never echo key
echo "[ais] starting proxy port=$AIS_PROXY_PORT key_set=$([ -n "$AISSTREAM_API_KEY" ] && echo yes || echo no)"
exec node scripts/ais-proxy.mjs
