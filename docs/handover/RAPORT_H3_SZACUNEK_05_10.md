# Raport: szacunek zapytań tras H-3 / H-1 dla 94 transportów

Data: 2026-10-05 · Europe/Warsaw · D-78 pule wstępne: trasy 5000/mies., kafelki 30000/mies.

## H-6 a Map Attributes
H-6 to warstwa UI na danych H-3 (`H6_LAYER_ENABLED = false`, flaga `H6_MAP_OBSTACLES` false).
**Nie woła Map Attributes** i nie wymaga osobnej przebudowy Attributes — źródłem jest H-3 (Routing v8).

## Model zapytań (po przebudowie H-3)
| Pozycja | Zapytania / transport / 30 dni | Uwagi |
|---|---|---|
| H-1 kontrola trasy | **2** (noga PL + noga SE) | 1 request Routing v8 / noga |
| H-3 katalog korytarza | **4** współdzielone / 30 dni | 4 nogi korytarza × 1 request z `alternatives=3` (jedna transakcja z alternatywami) |
| H-6 | **0** API | tylko odczyt katalogu H-3 |

`alternatives=3` w jednym URL = zwykle **1 transakcja** Routing (nie ×3).

## Przy 94 transportach / miesiąc (odświeżenie raz na 30 dni)
- H-1: 94 × 2 = **188** zapytań tras
- H-3: **4** zapytania (katalog wspólny; przy braku wymiarów D-83: 0, flaga wyłączona)
- Razem routing (gdy H-1 i H-3 włączone): **≈ 192 / miesiąc**
- Darmowa pula tras (wstępna): **5000** → zapas ~4800 przed kosztem ponad pulę
- Koszt ponad pulę przy 192: **0 USD** (w puli)

## Gdy H-3 byłoby per transport (wariant ostrożny)
Jeśli kiedyś H-3 liczyłoby 2 nogi × transport jak H-1: 94 × 2 = 188 → łącznie z H-1 **376 / miesiąc**, nadal w puli 5000.

## Kafelki
Poza pulą tras. Próg 80% dotyczy **sumy kosztu ponad pule** (D-78). Pula kafelków wstępna 30000/mies.
