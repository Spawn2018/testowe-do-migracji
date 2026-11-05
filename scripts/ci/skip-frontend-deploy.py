"""Czy pomijać wdrożenie frontu Vercel (DP-224 D / #817).

Wejście: lista zmienionych plików (po jednym w wierszu, jak `git diff --name-only`).
Wyjście stdout: `skip` albo `build`.

Kod wyjścia (dla `vercel.json` → `ignoreCommand`):
  0 = pomiń build (Vercel: Ignored Build Step),
  1 = buduj / wdrażaj.

Pomiń tylko gdy **każda** zmiana leży w `supabase/`, `docs/` albo `tests/`.
Wtedy baza i Edge nadal mogą iść w `deploy-main`, a hash assetów frontu się nie zmienia —
mniej cichych odświeżeń otwartych kart (DP-224 B1/C).
Pusta lista albo brak poprzedniego SHA → `build` (bezpiecznie).
"""

from __future__ import annotations

import sys

# Prefiksy ścieżek, których sama zmiana nie wymaga nowego buildu frontu.
POMIJANE = ("supabase/", "docs/", "tests/")


def tylko_bez_frontu(pliki: list[str]) -> bool:
    pliki = [p.strip().replace("\\", "/") for p in pliki if p.strip()]
    if not pliki:
        return False
    return all(p.startswith(POMIJANE) for p in pliki)


if __name__ == "__main__":
    skip = tylko_bez_frontu(sys.stdin.read().splitlines())
    print("skip" if skip else "build")
    sys.exit(0 if skip else 1)
