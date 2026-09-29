---
name: tower-wdrozenie
description: Wdraża front TOWER i sprawdza, że produkcja działa. Użyj po każdej zmianie w src/ po przejściu testów.
---

# tower-wdrozenie

1. `git status` czysty; vitest, testy bazy i szybka brama wizualna zielone
2. Build produkcyjny + strażnik paczki (bez kwot, danych osobowych, xlsx, demo)
3. Push — hak przed pushem musi przejść
4. Wdrożenie na Vercel; odczekaj koniec budowy
5. `tower.log-mar.pl` i `tower-hhl.pages.dev` → kod 200
6. Lokalny HEAD = zdalny HEAD
7. Raport: commit, wersja na Vercel, wynik testów
