"""Czy przebieg deploy-main jest poprawną bazą porównania frontu (DP-224 D F7 #823).

Argumenty: conclusion kroku „Czy wdrażać front”, conclusion „Produkcja Vercel”
(puste stringi, gdy krok nie istniał / nie uruchomił się).

Akceptuj tylko:
  1. Produkcja Vercel == success  — front faktycznie wdrożony, albo
  2. Czy wdrażać front == success AND Produkcja Vercel == skipped
     — celowy skip (same supabase/docs/tests).

Nie akceptuj: Produkcja Vercel == skipped przy braku kroku decyzji
(typowe przy skip=true z braku kluczy) — inaczej następny push z `src/`
porówna się z SHA bez wdrożonego frontu i pominie zmiany.

Wyjście stdout: `accept` / `reject`. Kod: 0 = accept, 1 = reject.
"""

from __future__ import annotations

import sys


def akceptuj_baze(front_concl: str, vercel_concl: str) -> bool:
    front = (front_concl or "").strip().lower()
    vercel = (vercel_concl or "").strip().lower()
    if vercel == "success":
        return True
    if front == "success" and vercel == "skipped":
        return True
    return False


if __name__ == "__main__":
    front_arg = sys.argv[1] if len(sys.argv) > 1 else ""
    vercel_arg = sys.argv[2] if len(sys.argv) > 2 else ""
    ok = akceptuj_baze(front_arg, vercel_arg)
    print("accept" if ok else "reject")
    sys.exit(0 if ok else 1)
