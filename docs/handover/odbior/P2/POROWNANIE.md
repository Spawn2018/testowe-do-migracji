# Odbiór P2 — wygląd (V4)

Dopisek D-20261013-1535-01 V4, dowód według Z10 i Z11 z D-20261013-1550-01.
Zrzuty z trybu demo, zamrożony czas 2026-09-23 14:32 UTC, motyw ciemny.
Obrazy raportu: `docs/handover/audyt_claude_2026-10-08/raport/img/`.

## Konta (Z11)

Przełącznik demo ma trzy strony. Piątka rodzajów kont z E9:

| konto | zrzut | dopisek |
|---|---|---|
| HHL Administrator | `*__hhl__*` | — |
| HHL Operacje | jak HHL Administrator | te ekrany nie dzielą Opcji; podział jest w P3 |
| KSH Użytkownik | `*__ksh__*` | bez kolumn numerów |
| SCX Dyspozytor | `*__scx__*` | swój numer, numer HHL tylko do odczytu |
| SCX Użytkownik | jak SCX Dyspozytor | marżę widzi tylko HHL; rozdział cen jest w P3 |

## Ekrany

| ekran | szerokości | obraz raportu | wzór Z10 | zostaje |
|---|---|---|---|---|
| Kokpit | 390, 1440 | `e8-after.webp` | punkt 1 (kafelki telefonu) i 3 (komputer: dotychczasowy układ) | kafelki 2×2 i liczba w jednej linii — P3, V5 |
| Harmonogram | 390, 1440 | decyzja E38 1A wygrywa z obrazem E41 „jedna kolumna Transport” | punkt 2 (treść etapu) | układ pliku, przyklejone kolumny, pasek narzędzi telefonu, zasłonięty kierowca — P7, V6 |
| Dokumenty | 390, 1440 | `e8-after.webp` | punkt 1 | na telefonie tabela wymagań jest kartą „etykieta: wartość”; lista plików zostaje pod spodem |
| Finanse | 390, 1440 | `e8-after.webp` (marża według typu) | punkt 1 | na telefonie tabela marży jest kartą; zestawienie nad nią bez zmiany treści |
| Panel | 390, 1440 | `e41-after.webp` | punkt 1 | nazwa „kod · numer” w nagłówku; reszta panelu bez przebudowy |

## Co ta paczka zamyka

- Kolumna „Wysyłka” na komputerze to sam kod. Numery stoją w swoich kolumnach. Na karcie telefonu zostaje „kod · numer”.
- Przy 1440 px status ma pełny napis (Dostarczony, Rozładowany).
- Dolny pasek telefonu: liczba tylko przy Ryzykach. W menu bocznym komputera liczba przy Harmonogramie zostaje.
- Brama E8 lokalnie: 9 widoków, 360 / 390 / 430 px, trzy liczby = 0 (wyjątki w `tests/fixtures/e8-exceptions.txt`: ukryte pole pliku i kafel mapy ucięty przez ramkę).

## Pliki

`kokpit`, `harmonogram`, `dokumenty`, `finanse`, `panel` × `hhl`, `scx`, `ksh` × `390`, `1440`.
