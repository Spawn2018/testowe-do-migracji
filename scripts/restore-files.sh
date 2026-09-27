#!/usr/bin/env bash
# TOWER PR2-B — odtworzenie plików (Storage) z kopii R2: files/<kubeł>/<ścieżka>.age.
#
# Użycie:
#   AGE_IDENTITY=~/klucz.txt scripts/restore-files.sh <katalog-files> <katalog-wyjściowy> [manifest.json.age …]
#     <katalog-files>  kopia prefiksu files/ z R2 (struktura <kubeł>/<ścieżka>.age),
#     manifest.json.age z katalogów daily/… — w nich SHA-256 i rozmiar każdego pliku sprzed szyfrowania
#     (pliki są przyrostowe: każdy plik jest w manifeście przebiegu, który go zapisał).
#   Opcjonalnie wgranie do Storage NOWEGO projektu (u właściciela, klucz tylko w zmiennej środowiska):
#     RESTORE_STORAGE_URL=https://<projekt>.supabase.co RESTORE_SERVICE_KEY=… (bez nadpisywania istniejących).
# Wyjście: „FILES OK plikow=N bajtow=B sha256_zgodne=K/N [wgrane=U]” albo „FILES FAIL …” (kod ≠ 0).
set -euo pipefail
SRC=${1:?katalog-files}; OUT=${2:?katalog-wyjściowy}; shift 2
: "${AGE_IDENTITY:?AGE_IDENTITY — plik klucza prywatnego age}"
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
: > "$TMP/expected.tsv"
for m in "$@"; do
  age -d -i "$AGE_IDENTITY" "$m" | python3 -c '
import json,sys
for f in json.load(sys.stdin).get("files", []):
    if f.get("sha256"): print(f["key"], f["sha256"], f.get("size", ""), sep="\t")' >> "$TMP/expected.tsv"
done
n=0; bytes=0; okc=0; bad=""; up=0
while IFS= read -r -d '' f; do
  rel=${f#"$SRC"/}; rel=${rel%.age}
  [[ "$rel" != *..* ]] || { echo "FILES FAIL: ścieżka $rel" >&2; exit 2; }
  mkdir -p "$OUT/$(dirname "$rel")"
  age -d -i "$AGE_IDENTITY" -o "$OUT/$rel" "$f"
  sum=$(sha256sum "$OUT/$rel" | cut -d' ' -f1); size=$(stat -c %s "$OUT/$rel")
  exp=$(awk -F'\t' -v k="files/$rel.age" '$1==k {print $2}' "$TMP/expected.tsv" | tail -1)
  if [ -n "$exp" ]; then
    if [ "$exp" = "$sum" ]; then okc=$((okc+1)); else bad="$bad $rel"; fi
  fi
  if [ -n "${RESTORE_STORAGE_URL:-}" ] && [ -n "${RESTORE_SERVICE_KEY:-}" ]; then
    code=$(curl -s -o "$TMP/up.out" -w '%{http_code}' -X POST \
      -H "Authorization: Bearer $RESTORE_SERVICE_KEY" -H "apikey: $RESTORE_SERVICE_KEY" \
      -H "Content-Type: $(python3 -c "import mimetypes,sys;print(mimetypes.guess_type(sys.argv[1])[0] or 'application/octet-stream')" "$OUT/$rel")" -H 'x-upsert: false' \
      --data-binary @"$OUT/$rel" "${RESTORE_STORAGE_URL%/}/storage/v1/object/$rel")
    [ "$code" = 200 ] && up=$((up+1)) || bad="$bad upload:$rel($code)"
  fi
  n=$((n+1)); bytes=$((bytes+size))
done < <(find "$SRC" -type f -name '*.age' -print0 | sort -z)
[ -z "$bad" ] || { echo "FILES FAIL:$bad"; exit 1; }
echo "FILES OK plikow=$n bajtow=$bytes sha256_zgodne=$okc/$n${RESTORE_STORAGE_URL:+ wgrane=$up}"
