"""Czy zmiana PR dotyczy wyłącznie dokumentów (workflow visual, krok „zmiany”).

Wejście: lista zmienionych plików (po jednym w wierszu, jak `git diff --name-only`).
Wyjście: `false` — same dokumenty (części testów wizualnych można pominąć); `true` — pełne testy.

Dokument = plik w `docs/` albo plik `.md` poza katalogami, z których korzysta aplikacja lub testy
(`src/`, `tests/`, `public/`, `supabase/`, `scripts/`, `android/`, `.github/`).
Wszystko inne, pusta lista albo cokolwiek nietypowego → `true` (lepiej uruchomić testy niepotrzebnie
niż pominąć potrzebne).
"""

from __future__ import annotations

import sys

KATALOGI_KODU = ("src/", "tests/", "public/", "supabase/", "scripts/", "android/", ".github/")


def dokument(sciezka: str) -> bool:
    if sciezka.startswith("docs/"):
        return True
    return sciezka.endswith(".md") and not sciezka.startswith(KATALOGI_KODU)


def kod(pliki: list[str]) -> bool:
    pliki = [p.strip() for p in pliki if p.strip()]
    if not pliki:
        return True
    return not all(dokument(p) for p in pliki)


if __name__ == "__main__":
    print("true" if kod(sys.stdin.read().splitlines()) else "false")
