# Raport kalibracji czasów odcinków ETA (III-1) — SZABLON

> Stan: **szkielet**. Prawdziwe dane będą po 5 transportach pilotażu. Do tego czasu raport produkcyjny pokazuje
> n = 0 i „za mało danych” dla każdego odcinka. Wyniki to **propozycja** dla HHL. Nic nie zmienia się samo.

## Jak wygenerować

```bash
psql "$SUPABASE_DB_POOLER_URL" -v min_n=5 -f scripts/iii1/calibration.sql
```

Skrypt tylko czyta dane: `load_events` (GEOFENCE_ENTER/EXIT), `geofences.kind` i `eta_segment_params`.
Samotest na danych syntetycznych, uruchamiany w transakcji wycofanej:
`(echo 'begin;'; cat scripts/iii1/selftest.sql; echo 'rollback;') | psql "$URL"`.
Wynik samotestu: PL_ROAD ma medianę 9,0 h wobec parametru 7,5 h (+20%), więc raport daje PROPOZYCJĘ.
Pozostałe odcinki mają odchylenie ≤ 10%, więc wychodzi „bez zmian”.

## Odcinki

| Odcinek | Początek → koniec | Parametr ETA v1 |
|---|---|---|
| PL_ROAD | wyjazd ze strefy LOADING → wjazd do PORT_OUT | PL_ROAD |
| PORT_CHECKIN | wjazd do PORT_OUT → wyjazd z PORT_OUT (przybliżenie: odprawa + oczekiwanie) | PORT_CHECKIN |
| CROSSING | wyjazd z PORT_OUT → wjazd do PORT_IN | CROSSING_DEFAULT (ETA korzysta z rejsu w `sailings`, jeśli jest) |
| SE_TOTAL | wyjazd z PORT_IN → wjazd do SITE | SE_ROAD + SE_BREAKS + SE_DAILY_REST |

Transporty testowe z I-16 (`order_no` zaczynający się od `I16-`) są pomijane.

## Reguła wniosku

- n < 5 → „za mało danych”, bez propozycji.
- Odchylenie mediany od parametru ≤ 10% → „bez zmian”.
- W pozostałych przypadkach → PROPOZYCJA. Nowa wartość to mediana. Rozrzut to większa z odległości p10 i p90
  od mediany, w procentach mediany.

## Zatwierdzenie

1. HHL przegląda tabelę: n, mediana, p10–p90, min–max, parametr, odchylenie, wniosek.
2. Każdą przyjętą zmianę wpisuje osobna migracja `eta_segment_params`, a jako źródło podaje
   „III-1 <data>, n = …, mediana …”.
3. Odrzucone propozycje trafiają do dziennika w tym pliku razem z powodem.

## Wyniki

| Data | n transportów | Odcinek | Mediana [h] | p10–p90 [h] | Parametr | Wniosek | Decyzja HHL |
|---|---|---|---|---|---|---|---|
| — | 0 | — | — | — | — | czeka na 5 transportów pilotażu | — |
