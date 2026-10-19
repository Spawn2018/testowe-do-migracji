# Zasady ciągłej pracy (D-20261019-1050-01)

Stała instrukcja dla każdego przebiegu pętli `agent -p --force`. Bez pytań do człowieka.

Źródło: `docs/handover/dopiski/D-20261019-1050-01.md`. Plan: `docs/handover/PLAN.md`.

## Każdy przebieg (kolejno)

1. **Git:** `git fetch`; gałąź bieżącej pozycji z PLAN §4 (albo `main` gdy nic otwartego); `git pull`.
2. **Skrzynka:** `gh issue list --label dla-cursora --state open --json number,title,body,createdAt`.
   - Nowe zgłoszenie → wpisz do PLAN §4 / §8 / `POSTEP.md` (+ plik w `docs/handover/dopiski/` gdy trzeba); skomentuj „wpisane do planu: \<miejsce\>, commit \<sha\>”; zamknij gdy pozycja zrobiona (albo od razu, jeśli wystarczyło samo wpisanie).
   - **Nie przerywaj** bieżącej pozycji — wyjątek: etykieta `pilne`.
   - Czytaj skrzynkę też po każdej pozycji, przed przejściem i co najmniej co 30 min.
3. **Scalanie (§2):** PR z komentarzem „F7: gotowe do scalenia”, zielone CI, bez konfliktu → `gh pr merge --merge` (sam). „niegotowe” → popraw w tym samym PR. Wdrożenie: do czasu sekretów GitHub — ręcznie z `main` (D-1110); potem workflow `deploy-main.yml`.
4. **Jeden krok:** następny niezakończony fragment bieżącej pozycji z PLAN §4 → commit i push na gałąź PR. Koniec przebiegu.

## Decyzje bez czekania na właściciela

- Niejasność → issue `pytanie-do-koordynatora` (pytanie, opcje, rekomendacja) → **od razu** następna pozycja.
- Bez odpowiedzi 60 min → przyjmij rekomendację, wpisz „przyjęta domyślna, bez odpowiedzi”, działaj dalej.

## Wyjątki — tylko właściciel (czekaj, rób resztę)

- usuwanie danych na produkcji (poza jednorazowymi z dopisków);
- sekrety i klucze;
- płatności / pieniądze wychodzące;
- cięcie zakresu;
- zmiana daty wydania (28.10.2026, 20:00).

## Zakazy pętli

- bez `git push` na `main`;
- bez wdrożeń spoza `main`;
- bez zmian sekretów.
