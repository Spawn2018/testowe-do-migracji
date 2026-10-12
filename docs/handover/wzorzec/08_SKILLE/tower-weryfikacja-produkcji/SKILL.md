---
name: tower-weryfikacja-produkcji
description: Niezależne sprawdzenie produkcji Watch Tower zapytaniami do bazy po wdrożeniu paczki. Użyj po każdym raporcie wykonawcy — raport nie jest dowodem.
---

# tower-weryfikacja-produkcji (wersja 08.10.2026)

Zapytania (tylko odczyt):
- migracje: liczba, ostatnia, zgodność z raportem i z repozytorium;
- tabele bez RLS (dopuszczalna tylko `spatial_ref_sys`); uprawnienia `anon` do tabel = 0;
- zadania cykliczne: lista, aktywność, ostatnie przebiegi i wynik;
- kopie zapasowe: ostatnie 7, status, `finished_at`; w toku > 30 min = alarm;
- konta aktywne: role, czy logowane; brak kont testowych na produkcji;
- punkty „Odbiór” paczki z `PLAN.md` §4 — każdy z liczbą.

Porównaj z raportem punkt po punkcie. Wynik: **jeden** zbiorczy dopisek na paczkę (`tower-dopisek-do-planu`), każda rozbieżność z rodzajem (BLOKER / DO PACZKI / PO 1.0 — ten ostatni tylko jako propozycja do decyzji właściciela, `PLAN.md` §6 część 3), pełnym warunkiem i przykładem liczbowym.
