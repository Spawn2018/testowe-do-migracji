#!/usr/bin/env bash
# AUD-01c — dowód kafelków curl (bez logowania, bez ciasteczek). Użycie: aud01c-tiles.sh <domena> <styl> <z> <x0> <y0> [kolumny] [wiersze]
# Każdy kafelek: dwa świeże curl (osobne procesy, bez ciasteczek) → status, typ, bajty magiczne, x-vercel-cache, X-Sb-Edge-Region, czasy.
set -u
D=$1; S=$2; Z=$3; X0=$4; Y0=$5; C=${6:-6}; R=${7:-4}
REF="https://$D/"
row() {
  local url=$1 h b
  h=$(mktemp); b=$(mktemp)
  local w; w=$(curl -s -o "$b" -D "$h" -H "Referer: $REF" -w "%{http_code} %{content_type} ttfb=%{time_starttransfer} total=%{time_total}" "$url")
  local magic; magic=$(od -An -tx1 -N4 "$b" | tr -d ' \n')
  local cache region origin
  cache=$(grep -i '^x-vercel-cache:' "$h" | awk '{print $2}' | tr -d '\r')
  region=$(grep -i '^x-sb-edge-region:' "$h" | awk '{print $2}' | tr -d '\r')
  origin=$(grep -i '^x-wt-origin-ms:' "$h" | awk '{print $2}' | tr -d '\r')
  echo "$w magic=$magic cache=${cache:-?} sb_region=${region:--} origin_ms=${origin:--}"
  rm -f "$h" "$b"
}
for ((j=0;j<R;j++)); do for ((i=0;i<C;i++)); do
  u="https://$D/tiles/$S/$Z/$((X0+i))/$((Y0+j))"
  echo "$S/$Z/$((X0+i))/$((Y0+j)) #1 $(row "$u")"
  echo "$S/$Z/$((X0+i))/$((Y0+j)) #2 $(row "$u")"
done; done
