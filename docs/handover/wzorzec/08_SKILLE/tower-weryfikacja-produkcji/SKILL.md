---
name: tower-weryfikacja-produkcji
description: Niezależne sprawdzenie produkcji TOWER zapytaniami do bazy. Użyj po każdym raporcie wykonawcy i przed przekazaniem pracy — raport nie jest dowodem.
---

# tower-weryfikacja-produkcji

Zapytania (tylko odczyt):
- migracje: liczba, ostatnia, zgodność z raportem
- tabele bez RLS (dopuszczalna tylko `spatial_ref_sys`); uprawnienia `anon` do tabel = 0
- zadania cykliczne: lista, aktywność, **ostatnie przebiegi i wynik**
- **kopie zapasowe: ostatnie 7, status, `finished_at`; w toku > 30 min = alarm**
- konta aktywne: role, domeny, czy logowane
- dla zmiany z raportu: kod funkcji (fragment), kolumny, reguły dostępu
Porównaj z raportem punkt po punkcie. Rozbieżność = pozycja P0/P1 w planie
z pełnym warunkiem i przykładem liczbowym.
