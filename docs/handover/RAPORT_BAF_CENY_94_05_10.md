# Raport BAF 0187 — 94 transporty: stawka, mnożnik, koszt, przychód

Źródło: produkcja `nglnnrmzmhusvxslousq` po migracjach 0187 + 0188 (`scripts/m0187-migrate.mjs report-prod`), czas Europe/Warsaw.

- Mnożnik tygodnia **40** (załadunki 28.09–04.10, średnia z publikacji 21–27.09): **1,14** (SEK 23,04 → 1,14; PLN 7,41 → 1,17)
- Mnożnik tygodnia **41** (załadunki 05–11.10, średnia z publikacji 28.09–04.10): **1,13** (SEK 22,63 → 1,13; PLN 7,22 → 1,15)
- Dopłata = stawka drogowa × (mnożnik − 1); bez dopłaty na anulowaniu i postojach. Stawka z wymiarów **ładunku** (shipment_items).
- OSTATECZNY = tydzień poprzedni zamknięty (migawka); WSTEPNY = szacunek z ostatniej publikacji, przeliczany co 6 h do zamknięcia tygodnia.

- **SG-03** (15062/2026/OSL/GDA/P): rzeczywisty załadunek **01.10** (decyzja A, 05.10 ~22:31) → tydzień **40** → **1,14**. Migracja 0188: podłączenie śledzenia w trasie (05.10 13:21) nie jest rzeczywistym załadunkiem — `actual_load_at` wyczyszczony, data paliwa = plan KSH (D-12); faza IN_TRANSIT_SE zapisana osobno („faza z pozycji przy podłączeniu”). Ta sama ścieżka na PROD: tylko SG-03.

Wycenione: **86/94**; koszt razem **652 807,40 EUR**, przychód razem **685 447,78 EUR**.

| # | Zlecenie | Wysyłka | Wymiary ładunku L×W×H m / t | Załadunek | Symbol | Stawka koszt | Stawka przychód | Mnożnik | Status | Koszt (z BAF) | Przychód (z BAF) | Uwagi |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 15048/2026/OSL/GDA/P | SG-01 | 18,21×2,45×2,45 / 20,7 | 2026-09-29 | SG | 6 900,00 | 7 245,00 | 1,14 | OSTATECZNY | 7 866,00 | 8 259,30 |  |
| 2 | 15060/2026/OSL/GDA/P | SG-02 | 18,21×2,45×2,45 / 20,7 | 2026-09-30 | SG | 6 900,00 | 7 245,00 | 1,14 | OSTATECZNY | 7 866,00 | 8 259,30 |  |
| 3 | 15061/2026/OSL/GDA/P | T-01 | 14,62×2,45×2,45 / 20,2 | 2026-09-30 | T | 5 510,00 | 5 785,50 | 1,14 | OSTATECZNY | 6 281,40 | 6 595,47 |  |
| 4 | 15062/2026/OSL/GDA/P | SG-03 | 18,21×2,45×2,45 / 19,1 | 2026-10-01 | SG | 6 900,00 | 7 245,00 | 1,14 | OSTATECZNY | 7 866,00 | 8 259,30 |  |
| 5 | 15063/2026/OSL/GDA/P | SG-04 | 18,21×2,45×2,45 / 19,1 | 2026-10-01 | SG | 6 900,00 | 7 245,00 | 1,14 | OSTATECZNY | 7 866,00 | 8 259,30 |  |
| 6 | 15064/2026/OSL/GDA/P | T-02 | 14,62×2,45×2,45 / 19,7 | 2026-10-02 | T | 5 510,00 | 5 785,50 | 1,14 | OSTATECZNY | 6 281,40 | 6 595,47 |  |
| 7 | 15065/2026/OSL/GDA/P | SG-05 | 18,21×2,45×2,45 / 20,4 | 2026-10-02 | SG | 6 900,00 | 7 245,00 | 1,14 | OSTATECZNY | 7 866,00 | 8 259,30 |  |
| 8 | 15066/2026/OSL/GDA/P | SG-06 | 18,21×2,45×2,45 / 19,1 | 2026-10-02 | SG | 6 900,00 | 7 245,00 | 1,14 | OSTATECZNY | 7 866,00 | 8 259,30 |  |
| 9 | — | SG-07 | 18,21×2,45×2,45 / 19,1 | 2026-10-03 | SG | 6 900,00 | 7 245,00 | 1,14 | OSTATECZNY | 7 866,00 | 8 259,30 |  |
| 10 | — | SG-08 | 18,21×2,45×2,45 / 19,1 | 2026-10-03 | SG | 6 900,00 | 7 245,00 | 1,14 | OSTATECZNY | 7 866,00 | 8 259,30 |  |
| 11 | 15069/2026/OSL/GDA/P | SG-09 | 18,21×2,45×2,45 / 20,4 | 2026-10-05 | SG | 6 900,00 | 7 245,00 | 1,13 | OSTATECZNY | 7 797,00 | 8 186,85 |  |
| 12 | 15071/2026/OSL/GDA/P | SG-10 | 18,21×2,45×2,45 / 19,1 | 2026-10-05 | SG | 6 900,00 | 7 245,00 | 1,13 | OSTATECZNY | 7 797,00 | 8 186,85 |  |
| 13 | — | SG-11 | 18,21×2,45×2,45 / 20,7 | 2026-10-06 | SG | 6 900,00 | 7 245,00 | 1,13 | OSTATECZNY | 7 797,00 | 8 186,85 |  |
| 14 | — | SG-12 | 18,21×2,45×2,45 / 20,7 | 2026-10-06 | SG | 6 900,00 | 7 245,00 | 1,13 | OSTATECZNY | 7 797,00 | 8 186,85 |  |
| 15 | — | T-06 | 14,62×2,45×2,45 / 20,2 | 2026-10-06 | T | 5 510,00 | 5 785,50 | 1,13 | OSTATECZNY | 6 226,30 | 6 537,62 |  |
| 16 | — | SG-14 | 18,21×2,45×2,45 / 19,1 | 2026-10-07 | SG | 6 900,00 | 7 245,00 | 1,13 | OSTATECZNY | 7 797,00 | 8 186,85 |  |
| 17 | — | SG-13 | 18,21×2,45×2,45 / 19,1 | 2026-10-07 | SG | 6 900,00 | 7 245,00 | 1,13 | OSTATECZNY | 7 797,00 | 8 186,85 |  |
| 18 | — | T-07 | 14,62×2,45×2,45 / 19,7 | 2026-10-07 | T | 5 510,00 | 5 785,50 | 1,13 | OSTATECZNY | 6 226,30 | 6 537,62 |  |
| 19 | — | SG-16 | 18,21×2,45×2,45 / 19,1 | 2026-10-08 | SG | 6 900,00 | 7 245,00 | 1,13 | OSTATECZNY | 7 797,00 | 8 186,85 |  |
| 20 | — | SG-15 | 18,21×2,45×2,45 / 20,4 | 2026-10-08 | SG | 6 900,00 | 7 245,00 | 1,13 | OSTATECZNY | 7 797,00 | 8 186,85 |  |
| 21 | — | SG-18 | 18,21×2,45×2,45 / 19,1 | 2026-10-16 | SG | 6 900,00 | 7 245,00 | 1,12 | WSTEPNY | 7 728,00 | 8 114,40 |  |
| 22 | — | SG-17 | 18,21×2,45×2,45 / 19,1 | 2026-10-16 | SG | 6 900,00 | 7 245,00 | 1,12 | WSTEPNY | 7 728,00 | 8 114,40 |  |
| 23 | — | SG-19 | 18,21×2,45×2,45 / 20,4 | 2026-10-16 | SG | 6 900,00 | 7 245,00 | 1,12 | WSTEPNY | 7 728,00 | 8 114,40 |  |
| 24 | — | SG-20 | 18,21×2,45×2,45 / 19,1 | 2026-10-17 | SG | 6 900,00 | 7 245,00 | 1,12 | WSTEPNY | 7 728,00 | 8 114,40 |  |
| 25 | — | SG-21 | 18,21×2,45×2,45 / 20,7 | 2026-10-19 | SG | 6 900,00 | 7 245,00 | 1,12 | WSTEPNY | 7 728,00 | 8 114,40 |  |
| 26 | — | SG-22 | 18,21×2,45×2,45 / 20,7 | 2026-10-19 | SG | 6 900,00 | 7 245,00 | 1,12 | WSTEPNY | 7 728,00 | 8 114,40 |  |
| 27 | — | T-11 | 14,62×2,45×2,45 / 20,2 | 2026-10-20 | T | 5 510,00 | 5 785,50 | 1,12 | WSTEPNY | 6 171,20 | 6 479,76 |  |
| 28 | — | SG-23 | 18,21×2,45×2,45 / 19,1 | 2026-10-21 | SG | 6 900,00 | 7 245,00 | 1,12 | WSTEPNY | 7 728,00 | 8 114,40 |  |
| 29 | Tx/1/2026 | SG-24 | 18,21×2,45×2,45 / 19,1 | 2026-10-21 | SG | 6 900,00 | 7 245,00 | 1,12 | WSTEPNY | 7 728,00 | 8 114,40 |  |
| 30 | — | T-12 | 14,62×2,45×2,45 / 19,7 | 2026-10-21 | T | 5 510,00 | 5 785,50 | 1,12 | WSTEPNY | 6 171,20 | 6 479,76 |  |
| 31 | — | SG-25 | 18,21×2,45×2,45 / 20,4 | 2026-10-22 | SG | 6 900,00 | 7 245,00 | 1,12 | WSTEPNY | 7 728,00 | 8 114,40 |  |
| 32 | — | KR-01 | 20,20×3,52×2,60 / 28,3 | 2026-10-22 | KR | 12 745,00 | 13 382,25 | 1,12 | WSTEPNY | 14 274,40 | 14 988,12 | konwój KR 1 |
| 33 | — | SG-26 | 18,21×2,45×2,45 / 19,1 | 2026-10-22 | SG | 6 900,00 | 7 245,00 | 1,12 | WSTEPNY | 7 728,00 | 8 114,40 |  |
| 34 | — | SG-27 | 18,21×2,45×2,45 / 19,1 | 2026-10-23 | SG | 6 900,00 | 7 245,00 | 1,12 | WSTEPNY | 7 728,00 | 8 114,40 |  |
| 35 | — | SG-28 | 18,21×2,45×2,45 / 19,1 | 2026-10-23 | SG | 6 900,00 | 7 245,00 | 1,12 | WSTEPNY | 7 728,00 | 8 114,40 |  |
| 36 | — | SG-30 | 18,21×2,45×2,45 / 19,1 | 2026-10-24 | SG | 6 900,00 | 7 245,00 | 1,12 | WSTEPNY | 7 728,00 | 8 114,40 |  |
| 37 | — | SG-29 | 18,21×2,45×2,45 / 20,4 | 2026-10-24 | SG | 6 900,00 | 7 245,00 | 1,12 | WSTEPNY | 7 728,00 | 8 114,40 |  |
| 38 | — | KR-02 | 20,20×3,52×2,60 / 25,3 | 2026-10-25 | KR | 12 745,00 | 13 382,25 | 1,12 | WSTEPNY | 14 274,40 | 14 988,12 | konwój KR 1 |
| 39 | — | SS-01 | 18,21×3,00×2,50 / 21,2 | 2026-10-28 | SS | 7 950,00 | 8 347,50 | 1,12 | WSTEPNY | 8 904,00 | 9 349,20 |  |
| 40 | — | BS-01 | 14,95×2,45×1,80 / 31,0 | 2026-10-29 | BS-B | 6 030,00 | 6 331,50 | 1,12 | WSTEPNY | 6 753,60 | 7 091,28 |  |
| 41 | — | TS-02 | 17,50×2,45×2,65 / 19,6 | 2026-10-29 | TS | 6 590,00 | 6 919,50 | 1,12 | WSTEPNY | 7 380,80 | 7 749,84 |  |
| 42 | — | BS-02 | 11,95×2,45×1,30 / 21,4 | 2026-10-29 | BS-A | 5 090,00 | 5 344,50 | 1,12 | WSTEPNY | 5 700,80 | 5 985,84 |  |
| 43 | — | BS-03 | 11,95×2,45×1,30 / 21,4 | 2026-10-30 | BS-A | 5 090,00 | 5 344,50 | 1,12 | WSTEPNY | 5 700,80 | 5 985,84 |  |
| 44 | — | SS-02 | 18,21×3,00×2,50 / 20,9 | 2026-10-31 | SS | 7 950,00 | 8 347,50 | 1,12 | WSTEPNY | 8 904,00 | 9 349,20 |  |
| 45 | — | BS-04 | 11,95×2,45×1,30 / 21,4 | 2026-10-31 | BS-A | 5 090,00 | 5 344,50 | 1,12 | WSTEPNY | 5 700,80 | 5 985,84 |  |
| 46 | — | SS-03 | 18,21×3,00×2,50 / 20,9 | 2026-11-02 | SS | 7 950,00 | 8 347,50 | 1,12 | WSTEPNY | 8 904,00 | 9 349,20 |  |
| 47 | — | BS-06 | 11,95×2,45×1,30 / 21,4 | 2026-11-02 | BS-A | 5 090,00 | 5 344,50 | 1,12 | WSTEPNY | 5 700,80 | 5 985,84 |  |
| 48 | — | BS-05 | 16,50×2,45×1,80 / 33,6 | 2026-11-02 | BS-C | 6 280,00 | 6 594,00 | 1,12 | WSTEPNY | 7 033,60 | 7 385,28 |  |
| 49 | — | TS-04 | 17,50×2,45×2,65 / 19,4 | 2026-11-03 | TS | 6 590,00 | 6 919,50 | 1,12 | WSTEPNY | 7 380,80 | 7 749,84 |  |
| 50 | — | BS-07 | 11,95×2,45×1,30 / 21,4 | 2026-11-03 | BS-A | 5 090,00 | 5 344,50 | 1,12 | WSTEPNY | 5 700,80 | 5 985,84 |  |
| 51 | — | BS-09 | 12,50×2,45×1,30 / 22,9 | 2026-11-04 | BS-A | 5 090,00 | 5 344,50 | 1,12 | WSTEPNY | 5 700,80 | 5 985,84 |  |
| 52 | — | BS-08 | 11,95×2,45×1,30 / 21,4 | 2026-11-04 | BS-A | 5 090,00 | 5 344,50 | 1,12 | WSTEPNY | 5 700,80 | 5 985,84 |  |
| 53 | — | BS-11 | 11,95×2,45×1,30 / 21,4 | 2026-11-05 | BS-A | 5 090,00 | 5 344,50 | 1,12 | WSTEPNY | 5 700,80 | 5 985,84 |  |
| 54 | — | TS-08 | 17,50×2,45×2,65 / 22,3 | 2026-11-05 | TS | 6 590,00 | 6 919,50 | 1,12 | WSTEPNY | 7 380,80 | 7 749,84 |  |
| 55 | — | BS-10 | 14,95×2,45×1,80 / 31,0 | 2026-11-05 | BS-B | 6 030,00 | 6 331,50 | 1,12 | WSTEPNY | 6 753,60 | 7 091,28 |  |
| 56 | — | BS-12 | 11,95×2,45×1,30 / 21,4 | 2026-11-06 | BS-A | 5 090,00 | 5 344,50 | 1,12 | WSTEPNY | 5 700,80 | 5 985,84 |  |
| 57 | — | BS-13 | 11,95×2,45×1,30 / 21,4 | 2026-11-06 | BS-A | 5 090,00 | 5 344,50 | 1,12 | WSTEPNY | 5 700,80 | 5 985,84 |  |
| 58 | — | BS-14 | 16,50×2,45×1,80 / 33,6 | 2026-11-07 | BS-C | 6 280,00 | 6 594,00 | 1,12 | WSTEPNY | 7 033,60 | 7 385,28 |  |
| 59 | — | SS-04 | 18,21×3,00×2,50 / 20,9 | 2026-11-07 | SS | 7 950,00 | 8 347,50 | 1,12 | WSTEPNY | 8 904,00 | 9 349,20 |  |
| 60 | — | BS-16 | 11,95×2,45×1,30 / 21,4 | 2026-11-12 | BS-A | 5 090,00 | 5 344,50 | 1,12 | WSTEPNY | 5 700,80 | 5 985,84 |  |
| 61 | — | BS-15 | 11,95×2,45×1,30 / 21,4 | 2026-11-12 | BS-A | 5 090,00 | 5 344,50 | 1,12 | WSTEPNY | 5 700,80 | 5 985,84 |  |
| 62 | — | SS-05 | 18,21×3,00×2,50 / 20,9 | 2026-11-13 | SS | 7 950,00 | 8 347,50 | 1,12 | WSTEPNY | 8 904,00 | 9 349,20 |  |
| 63 | — | BS-18 | 12,50×2,45×1,30 / 22,9 | 2026-11-13 | BS-A | 5 090,00 | 5 344,50 | 1,12 | WSTEPNY | 5 700,80 | 5 985,84 |  |
| 64 | — | BS-17 | 11,95×2,45×1,30 / 21,4 | 2026-11-13 | BS-A | 5 090,00 | 5 344,50 | 1,12 | WSTEPNY | 5 700,80 | 5 985,84 |  |
| 65 | — | BS-20 | 11,95×2,45×1,30 / 21,4 | 2026-11-19 | BS-A | 5 090,00 | 5 344,50 | 1,12 | WSTEPNY | 5 700,80 | 5 985,84 |  |
| 66 | — | BS-19 | 14,95×2,45×1,80 / 31,0 | 2026-11-19 | BS-B | 6 030,00 | 6 331,50 | 1,12 | WSTEPNY | 6 753,60 | 7 091,28 |  |
| 67 | — | BS-22 | 11,95×2,45×1,30 / 21,4 | 2026-11-20 | BS-A | 5 090,00 | 5 344,50 | 1,12 | WSTEPNY | 5 700,80 | 5 985,84 |  |
| 68 | — | BS-21 | 11,95×2,45×1,30 / 21,4 | 2026-11-20 | BS-A | 5 090,00 | 5 344,50 | 1,12 | WSTEPNY | 5 700,80 | 5 985,84 |  |
| 69 | — | PL-1.1 | 14,70×2,45×2,45 / 15,2 | 2026-11-22 | PL-A | 5 510,00 | 5 785,50 | 1,12 | WSTEPNY | 6 171,20 | 6 479,76 |  |
| 70 | — | PL-1 | 14,70×3,40×2,60 / 14,5 | 2026-11-22 | PL-B | 9 690,00 | 10 174,50 | 1,12 | WSTEPNY | 10 852,80 | 11 395,44 | wys. przyjęta 2,45 (decyzja właściciela) |
| 71 | — | BS-23 | 16,50×2,45×1,80 / 33,6 | 2026-11-23 | BS-C | 6 280,00 | 6 594,00 | 1,12 | WSTEPNY | 7 033,60 | 7 385,28 |  |
| 72 | — | BS-25 | 11,95×2,45×1,30 / 21,4 | 2026-11-27 | BS-A | 5 090,00 | 5 344,50 | 1,12 | WSTEPNY | 5 700,80 | 5 985,84 |  |
| 73 | — | BS-24 | 11,95×2,45×1,30 / 21,4 | 2026-11-27 | BS-A | 5 090,00 | 5 344,50 | 1,12 | WSTEPNY | 5 700,80 | 5 985,84 |  |
| 74 | — | BS-27 | 12,50×2,45×1,30 / 22,9 | 2026-11-30 | BS-A | 5 090,00 | 5 344,50 | 1,12 | WSTEPNY | 5 700,80 | 5 985,84 |  |
| 75 | — | BS-26 | 11,95×2,45×1,30 / 21,4 | 2026-11-30 | BS-A | 5 090,00 | 5 344,50 | 1,12 | WSTEPNY | 5 700,80 | 5 985,84 |  |
| 76 | — | PL-5 | 14,70×2,45×2,45 / 22,1 | 2026-12-07 | PL-A | 5 510,00 | 5 785,50 | 1,12 | WSTEPNY | 6 171,20 | 6 479,76 |  |
| 77 | — | PL-9 | 14,70×2,45×2,45 / 18,4 | 2026-12-10 | PL-A | 5 510,00 | 5 785,50 | 1,12 | WSTEPNY | 6 171,20 | 6 479,76 |  |
| 78 | — | KR-04 | 20,20×3,52×2,60 / 25,3 | 2026-12-10 | KR | 12 290,00 | 12 904,50 | 1,12 | WSTEPNY | 13 764,80 | 14 453,04 | konwój KR 2 |
| 79 | — | PL-10.1 | 14,70×3,40×2,60 / 14,6 | 2026-12-10 | PL-B | 9 690,00 | 10 174,50 | 1,12 | WSTEPNY | 10 852,80 | 11 395,44 | wys. przyjęta 2,45 (decyzja właściciela) |
| 80 | — | KR-06 | 20,20×3,52×2,60 / 27,9 | 2026-12-10 | KR | 12 290,00 | 12 904,50 | 1,12 | WSTEPNY | 13 764,80 | 14 453,04 | konwój KR 2 |
| 81 | — | KR-07 | 20,20×3,52×2,60 / 24,9 | 2026-12-14 | KR | 12 745,00 | 13 382,25 | 1,12 | WSTEPNY | 14 274,40 | 14 988,12 | konwój KR 1 |
| 82 | — | KR-05 | 20,20×3,52×2,60 / 25,3 | 2026-12-15 | KR | 12 745,00 | 13 382,25 | 1,12 | WSTEPNY | 14 274,40 | 14 988,12 | konwój KR 1 |
| 83 | — | PL-17.1 | 14,70×3,40×2,60 / 14,5 | — | PL-B | 9 690,00 | 10 174,50 | 1,12 | WSTEPNY | 10 852,80 | 11 395,44 | wys. przyjęta 2,45 (decyzja właściciela) |
| 84 | — | KR-12 | 20,20×3,52×2,60 / 24,9 | — | — | — | — | — | — | — | — | wycena wstrzymana: KR bez daty załadunku → brak liczby konwoju (stawka 1/2/3 auta) |
| 85 | — | KR-11 | 20,20×3,52×2,60 / 27,9 | — | — | — | — | — | — | — | — | wycena wstrzymana: KR bez daty załadunku → brak liczby konwoju (stawka 1/2/3 auta) |
| 86 | — | KR-10 | 20,20×3,52×2,60 / 24,9 | — | — | — | — | — | — | — | — | wycena wstrzymana: KR bez daty załadunku → brak liczby konwoju (stawka 1/2/3 auta) |
| 87 | — | KR-09 | 20,20×3,52×2,60 / 24,9 | — | — | — | — | — | — | — | — | wycena wstrzymana: KR bez daty załadunku → brak liczby konwoju (stawka 1/2/3 auta) |
| 88 | — | KR-13 | 20,20×3,52×2,60 / 26,4 | — | — | — | — | — | — | — | — | wycena wstrzymana: KR bez daty załadunku → brak liczby konwoju (stawka 1/2/3 auta) |
| 89 | — | KR-14 | 20,20×3,52×2,60 / 24,9 | — | — | — | — | — | — | — | — | wycena wstrzymana: KR bez daty załadunku → brak liczby konwoju (stawka 1/2/3 auta) |
| 90 | — | KR-08 | 20,20×3,52×2,60 / 26,4 | — | — | — | — | — | — | — | — | wycena wstrzymana: KR bez daty załadunku → brak liczby konwoju (stawka 1/2/3 auta) |
| 91 | — | KR-15 | 20,20×3,52×2,60 / 24,9 | — | — | — | — | — | — | — | — | wycena wstrzymana: KR bez daty załadunku → brak liczby konwoju (stawka 1/2/3 auta) |
| 92 | — | PL-21 | 14,70×2,45×2,45 / 21,7 | — | PL-A | 5 510,00 | 5 785,50 | 1,12 | WSTEPNY | 6 171,20 | 6 479,76 |  |
| 93 | — | PL-13 | 14,70×2,45×2,45 / 21,7 | — | PL-A | 5 510,00 | 5 785,50 | 1,12 | WSTEPNY | 6 171,20 | 6 479,76 |  |
| 94 | — | PL-17 | 14,70×2,45×2,45 / 17,8 | — | PL-A | 5 510,00 | 5 785,50 | 1,12 | WSTEPNY | 6 171,20 | 6 479,76 |  |

## Transporty bez ceny: 8/94

| # | Zlecenie | Wysyłka | Rodzina | Wymiary ładunku L×W×H m / t | Kod przyczyny | Przyczyna | Co odblokuje |
|---|---|---|---|---|---|---|---|
| 1 | — (bez nr zlecenia) | KR-12 | KR | 20,20×3,52×2,60 / 24,9 | NO_CONVOY | brak daty załadunku w pliku KSH (plan_load_date pusty) | stawka KR zależy od liczby aut w konwoju tego samego dnia załadunku (1 auto 12 745 / 2 auta 12 290 / 3 auta 11 380 EUR koszt) — bez daty nie da się ustalić konwoju; wycena wstrzymana, nie zero. Odblokuje się sama po wpisaniu daty załadunku (import KSH / dyspozytor), trigger przelicza. |
| 2 | — (bez nr zlecenia) | KR-11 | KR | 20,20×3,52×2,60 / 27,9 | NO_CONVOY | brak daty załadunku w pliku KSH (plan_load_date pusty) | stawka KR zależy od liczby aut w konwoju tego samego dnia załadunku (1 auto 12 745 / 2 auta 12 290 / 3 auta 11 380 EUR koszt) — bez daty nie da się ustalić konwoju; wycena wstrzymana, nie zero. Odblokuje się sama po wpisaniu daty załadunku (import KSH / dyspozytor), trigger przelicza. |
| 3 | — (bez nr zlecenia) | KR-10 | KR | 20,20×3,52×2,60 / 24,9 | NO_CONVOY | brak daty załadunku w pliku KSH (plan_load_date pusty) | stawka KR zależy od liczby aut w konwoju tego samego dnia załadunku (1 auto 12 745 / 2 auta 12 290 / 3 auta 11 380 EUR koszt) — bez daty nie da się ustalić konwoju; wycena wstrzymana, nie zero. Odblokuje się sama po wpisaniu daty załadunku (import KSH / dyspozytor), trigger przelicza. |
| 4 | — (bez nr zlecenia) | KR-09 | KR | 20,20×3,52×2,60 / 24,9 | NO_CONVOY | brak daty załadunku w pliku KSH (plan_load_date pusty) | stawka KR zależy od liczby aut w konwoju tego samego dnia załadunku (1 auto 12 745 / 2 auta 12 290 / 3 auta 11 380 EUR koszt) — bez daty nie da się ustalić konwoju; wycena wstrzymana, nie zero. Odblokuje się sama po wpisaniu daty załadunku (import KSH / dyspozytor), trigger przelicza. |
| 5 | — (bez nr zlecenia) | KR-13 | KR | 20,20×3,52×2,60 / 26,4 | NO_CONVOY | brak daty załadunku w pliku KSH (plan_load_date pusty) | stawka KR zależy od liczby aut w konwoju tego samego dnia załadunku (1 auto 12 745 / 2 auta 12 290 / 3 auta 11 380 EUR koszt) — bez daty nie da się ustalić konwoju; wycena wstrzymana, nie zero. Odblokuje się sama po wpisaniu daty załadunku (import KSH / dyspozytor), trigger przelicza. |
| 6 | — (bez nr zlecenia) | KR-14 | KR | 20,20×3,52×2,60 / 24,9 | NO_CONVOY | brak daty załadunku w pliku KSH (plan_load_date pusty) | stawka KR zależy od liczby aut w konwoju tego samego dnia załadunku (1 auto 12 745 / 2 auta 12 290 / 3 auta 11 380 EUR koszt) — bez daty nie da się ustalić konwoju; wycena wstrzymana, nie zero. Odblokuje się sama po wpisaniu daty załadunku (import KSH / dyspozytor), trigger przelicza. |
| 7 | — (bez nr zlecenia) | KR-08 | KR | 20,20×3,52×2,60 / 26,4 | NO_CONVOY | brak daty załadunku w pliku KSH (plan_load_date pusty) | stawka KR zależy od liczby aut w konwoju tego samego dnia załadunku (1 auto 12 745 / 2 auta 12 290 / 3 auta 11 380 EUR koszt) — bez daty nie da się ustalić konwoju; wycena wstrzymana, nie zero. Odblokuje się sama po wpisaniu daty załadunku (import KSH / dyspozytor), trigger przelicza. |
| 8 | — (bez nr zlecenia) | KR-15 | KR | 20,20×3,52×2,60 / 24,9 | NO_CONVOY | brak daty załadunku w pliku KSH (plan_load_date pusty) | stawka KR zależy od liczby aut w konwoju tego samego dnia załadunku (1 auto 12 745 / 2 auta 12 290 / 3 auta 11 380 EUR koszt) — bez daty nie da się ustalić konwoju; wycena wstrzymana, nie zero. Odblokuje się sama po wpisaniu daty załadunku (import KSH / dyspozytor), trigger przelicza. |
