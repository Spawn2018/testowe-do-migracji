#!/usr/bin/env bash
# P0a — wgranie kompletu dokumentów z 08.10.2026 (tylko dokumenty).
# Użycie (z katalogu głównego repozytorium, na gałęzi pakiet/P0a-komplet):
#   bash <KOMPLET>/docs/handover/audyt_claude_2026-10-08/paczki/P0a_przeniesienia.sh <KOMPLET>
# <KOMPLET> = rozpakowany komplet POZA repozytorium.
set -euo pipefail
K="${1:?Podaj ścieżkę do rozpakowanego kompletu (poza repozytorium)}"
K="$(cd "$K" && pwd)"
cd "$(git rev-parse --show-toplevel)"
ROOT="$(pwd -P)"
K="$(cd "$K" && pwd -P)"
case "$K" in "$ROOT"|"$ROOT"/*) echo "Komplet musi leżeć poza repozytorium" >&2; exit 2;; esac
if [ "$(git rev-parse --abbrev-ref HEAD)" = "main" ]; then echo "Uruchom na gałęzi pakiet/P0a-komplet, nie na main" >&2; exit 2; fi
if [ -n "$(git status --porcelain)" ]; then echo "Drzewo robocze nie jest czyste" >&2; exit 2; fi
if [ -e docs/archiwum/2026-10-08 ]; then echo "P0a było już wykonane (jest docs/archiwum/2026-10-08) — przerwane, nic nie zmieniono" >&2; exit 2; fi
LIST="$K/docs/handover/audyt_claude_2026-10-08/paczki/P0a_lista_archiwum.txt"
[ -f "$LIST" ] || { echo "Brak listy $LIST" >&2; exit 2; }

# 1. Pliki z kwotami cenników — poza repozytorium (zasada: pliki poufne poza repo)
SAFE="$(dirname "$ROOT")/dane/archiwum-2026-10-08"   # D:\Watch Tower\dane\ obok D:\Watch Tower\repo\
for f in docs/handover/RAPORT_BAF_CENY_94_05_10.md docs/handover/WIP_BAF_CENY_05_10.md docs/watch-tower/BAF_SPEC.txt; do
  if [ -e "$f" ]; then
    mkdir -p "$SAFE/$(dirname "$f")"
    cp -p "$f" "$SAFE/$f"
    git rm -q "$f"
    echo "[P0a] poza repozytorium: $f -> $SAFE/$f"
  fi
done

# 2. Stare dokumenty do archiwum, z zachowaniem ścieżek
n=0; brak=0
while IFS= read -r f || [ -n "$f" ]; do
  f="${f%$'\r'}"
  [ -z "$f" ] && continue
  if [ -e "$f" ]; then
    mkdir -p "docs/archiwum/2026-10-08/$(dirname "$f")"
    git mv "$f" "docs/archiwum/2026-10-08/$f"
    n=$((n+1))
  else
    echo "[P0a] brak (pomijam): $f"; brak=$((brak+1))
  fi
done < "$LIST"

# 3. Stare AGENTS.md i reguły Cursora do archiwum jako .txt (żeby Cursor ich nie wczytał jako reguł)
SI="docs/archiwum/2026-10-08/stare-instrukcje"
mkdir -p "$SI/cursor-rules"
git mv AGENTS.md "$SI/AGENTS.md.txt"
for r in .cursor/rules/*.mdc; do
  [ -e "$r" ] || continue
  git mv "$r" "$SI/cursor-rules/$(basename "$r").txt"
done

# 4. Pliki z kompletu na swoje miejsca
( cd "$K" && find . -type f ! -name 'PROMPT_START_CURSOR.md' ! -name '.DS_Store' ! -name 'Thumbs.db' ! -path '*/__MACOSX/*' -print ) | while IFS= read -r f; do
  f="${f#./}"
  mkdir -p "$(dirname "$f")"
  cp -p "$K/$f" "$f"
done
git add -A AGENTS.md .cursor docs

echo "[P0a] przeniesiono do archiwum: $n, brakujących: $brak"
echo "[P0a] zmiany:"; git status --short | awk '{print $1}' | sort | uniq -c
