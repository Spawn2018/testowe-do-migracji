# SEFS — Scandinavian Express Fuel Surcharge (SoT z umowy)

Źródło: załącznik Word od Sebastiana (`BAF_SPEC.docx`).

## Zasady
1. Cotygodniowa korekta: mnożnik × stawka frachtowa (bezwymiarowy, niezależny od waluty).
2. **Model hybrydowy:** osobny odczyt SEK (OKQ8) i PLN (ORLEN); do rozliczenia **niższy z dwóch mnożników**.
3. Cena aktualna = średnia arytmetyczna cen ON z poprzedniego tygodnia kalendarzowego (pon–niedz), zaokrąglenie 2 miejsca.
4. Ceny bazowe (mnożnik 1,00): **OKQ8 GoEasy Diesel 19,47 SEK/l**; **ORLEN Ekodiesel 5,698 PLN/l**.
5. Mnożnik obowiązuje dla zleceń z datą załadunku w danym tygodniu (pon–niedz). Symetryczny (↑/↓).
6. Korekcie podlega **tylko stawka transportu drogowego** — nie anulowanie załadunku ani przestoje.
7. „do X” = cena aktualna ≤ X. Poniżej pierwszego progu → pierwszy wiersz. Powyżej ostatniego → ostatni wiersz do uzgodnienia rozszerzenia (14 dni).
8. Brak źródła → ostatni ustalony mnożnik do uzgodnienia zastępczego.

## Źródła
- ORLEN Ekodiesel: https://www.orlen.pl/pl/dla-biznesu/hurtowe-ceny-paliw#paliwa
- OKQ8 GoEasy Diesel (listowa B2B): https://www.okq8.se/foretag/priser/

## UI makiety (M7)
- Pokazuj oba odczyty (SEK i PLN), oba mnożniki, i **wybrany = min(SEK, PLN)**.
- Snapshot na load: `baf_multiplier`, `baf_source_week`, `price_sek`, `price_pln`, `mult_sek`, `mult_pln`.
- SCX/HHL widzą SEFS na koszcie drogowym; osobno (jeśli jest) dodatek promowy — NIE mieszać z SEFS.
- Edytor HHL: aktualne ceny tygodnia + tabela progów (read-only z seedu umowy).

## Tabela SEK (OKQ8) — cena do (włącznie) → mnożnik
| SEK/l ≤ | mnożnik |
|---|---|
| 17.4 | 0.92 |
| 17.7 | 0.93 |
| 18.0 | 0.94 |
| 18.3 | 0.95 |
| 18.6 | 0.97 |
| 18.9 | 0.98 |
| 19.2 | 0.99 |
| 19.5 | 1.00 |
| 19.8 | 1.01 |
| 20.1 | 1.02 |
| 20.4 | 1.04 |
| 20.7 | 1.05 |
| 21.0 | 1.06 |
| 21.3 | 1.07 |
| 21.6 | 1.08 |
| 21.9 | 1.09 |
| 22.2 | 1.11 |
| 22.5 | 1.12 |
| 22.8 | 1.13 |
| 23.1 | 1.14 |
| 23.4 | 1.15 |
| 23.7 | 1.16 |
| 24.0 | 1.18 |
| 24.3 | 1.19 |
| 24.6 | 1.20 |
| 24.9 | 1.21 |
| 25.2 | 1.22 |
| 25.5 | 1.23 |
| 25.8 | 1.25 |
| 26.1 | 1.26 |
| 26.4 | 1.27 |
| 26.7 | 1.28 |
| 27.0 | 1.29 |
| 27.3 | 1.30 |
| 27.6 | 1.32 |
| 27.9 | 1.33 |
| 28.2 | 1.34 |
| 28.5 | 1.35 |
| 28.8 | 1.36 |
| 29.1 | 1.37 |
| 29.4 | 1.39 |
| 29.7 | 1.40 |
| 30.0 | 1.41 |
| 30.3 | 1.42 |
| 30.6 | 1.43 |
| 30.9 | 1.44 |
| 31.2 | 1.46 |
| 31.5 | 1.47 |
| 31.8 | 1.48 |
| 32.1 | 1.49 |
| 32.4 | 1.50 |

## Tabela PLN (ORLEN) — cena do (włącznie) → mnożnik
| PLN/l ≤ | mnożnik |
|---|---|
| 5.0 | 0.93 |
| 5.1 | 0.94 |
| 5.2 | 0.95 |
| 5.3 | 0.96 |
| 5.4 | 0.97 |
| 5.5 | 0.98 |
| 5.6 | 0.99 |
| 5.7 | 1.00 |
| 5.8 | 1.01 |
| 5.9 | 1.02 |
| 6.0 | 1.03 |
| 6.1 | 1.04 |
| 6.2 | 1.05 |
| 6.3 | 1.06 |
| 6.4 | 1.07 |
| 6.5 | 1.08 |
| 6.6 | 1.09 |
| 6.7 | 1.10 |
| 6.8 | 1.10 |
| 6.9 | 1.11 |
| 7.0 | 1.12 |
| 7.1 | 1.13 |
| 7.2 | 1.14 |
| 7.3 | 1.15 |
| 7.4 | 1.16 |
| 7.5 | 1.17 |
| 7.6 | 1.18 |
| 7.7 | 1.19 |
| 7.8 | 1.20 |
| 7.9 | 1.21 |
| 8.0 | 1.22 |
| 8.1 | 1.23 |
| 8.2 | 1.24 |
| 8.3 | 1.25 |
| 8.4 | 1.26 |
| 8.5 | 1.27 |
| 8.6 | 1.28 |
| 8.7 | 1.29 |
| 8.8 | 1.30 |
| 8.9 | 1.30 |
| 9.0 | 1.31 |
| 9.1 | 1.32 |
| 9.2 | 1.33 |
| 9.3 | 1.34 |
| 9.4 | 1.35 |
| 9.5 | 1.36 |
| 9.6 | 1.37 |
| 9.7 | 1.38 |
| 9.8 | 1.39 |
| 9.9 | 1.40 |
| 10.0 | 1.41 |