# PACZKA DECYZJI — 30.09.2026

> Wszystko, co czekało na właściciela, w jednej wiadomości.
> **Załączniki:** `ZLECENIE_CENNIK_SEFS.md`, `CENNIK_STEGRA.json`,
> trzy oryginały właściciela (`CENY_PODSTAWOWE_-_SCANDINAVIAN_EXPRESS.xlsx`,
> `CENY_PODSTAWOWE_-_hhl.xlsx`, `SEFS_KSH_Stegra_v2.docx`),
> `ZLECENIE_POGODA_DROGI_ETA.md`, **`ZLECENIE_SHAREPOINT.md`**, `haromogram.xlsx`
> (zawiera dane osobowe kierowców — tylko do analizy, nie do repozytorium).
> Dopisz do planu według priorytetów. Pozycje, które już masz — pomiń.

---

## D-1, D-2 — CENNIK I SEFS: PRZEKAZANE

Szczegóły w `ZLECENIE_CENNIK_SEFS.md`: **I-30 P0** cennik według symboli,
wariantów i konwoju · **I-31 P0** dopłata SEFS z pobieraniem Orlen i OKQ8 ·
**I-32 P1** opłaty dodatkowe. Przepisz dane z oryginałów niezależnie
i porównaj z JSON.
- **KSH ma identyczną dopłatę paliwową** (właściciel)
- **konwój = liczba aut z kratownicami z tą samą datą załadunku**, liczona
  automatycznie (właściciel)
- **D-8 zamknięte:** „Standard" = tężniki T, bez osobnej stawki

## D-28 — DECYZJA KOŃCOWA: WŁASNY SILNIK + KALIBRACJA UCZĄCA SIĘ

Dziękuję za STOP i cytaty z regulaminu HERE. **HERE — nie.** Trasa jest stała
i wyznaczona w zezwoleniu, więc serwis tras nie jest potrzebny.
**II-7:** własny silnik na korytarzu z OpenStreetMap.
**II-7b:** automatyczna, ucząca się kalibracja po każdym transporcie,
z zabezpieczeniami (sprawdzenie wsteczne, limit zmian, wycofanie,
zamrożenie przez HHL). **III-1 zastąpione przez II-7b.**
Szczegóły w `ZLECENIE_POGODA_DROGI_ETA.md`.

## II-10 — SHAREPOINT, NOWE, P1

Integracja w obie strony z harmonogramem KSH — `ZLECENIE_SHAREPOINT.md`.
**Import tylko HH z wymiarami; NTG „Standard" — inna firma, nie dotykamy.**
Do zgody IT KSH (D-32) — praca na kopii pliku.

## DANE KIEROWCY, WYCENA PL, KRATOWNICE (właściciel)

- **KSH widzi na stałe pełne dane kierowcy i auta** — zgody RODO bezterminowe
  do wycofania; retencja do wycofania zgody (`ZLECENIE_SHAREPOINT.md` §1a)
- **D-33 rozstrzygnięte:** TOWER wpisuje do pliku KSH kierowcę, telefon,
  nr zlecenia i nr rejestracyjny (§3)
- **PL-1, PL-10.1, PL-17.1 — cena jak przy wysokości 2,45 m (PL-B)**
- **błędne daty kratownic zostają** — test wykrywania zmian po poprawce KSH

## SEFS — ŹRÓDŁA CEN (właściciel)

Bierzemy cenę tak, jak podaje źródło; VAT nas nie interesuje. Szczegóły
i dane testowe w `ZLECENIE_CENNIK_SEFS.md`, I-31.

## POGODA, PROM, DROGI SE — `ZLECENIE_POGODA_DROGI_ETA.md`

II-5 odczyt komunikatów armatora **teraz** · II-8 pogoda FMI/DMI/SMHI
z progami wstępnymi · II-9 opóźnienie z AIS · II-6 Trafikverket (po kluczu) ·
II-7 silnik własny · I-29 budżety dla 140 transportów.

## D-27 — KONTRAST: ZATWIERDZONY z warunkiem

- test: każdy kolor tekstu na każdym tle obu motywów ≥ 4,5:1; jeśli #788C9A
  nie przejdzie na panelu ciemnym — #7C909E
- wzorzec: zmieniają się wyłącznie kolory tekstu, zero przesunięć

## D-29 — REGUŁY STARTOWE: NAJPIERW TABELA

Nie włączaj jeszcze. Tabela: reguła → warunek → akcja → **który istniejący
mechanizm robi to samo** (detect_silent_vehicles, ryzyko opóźnienia z ETA,
I-10/I-18 zmiana daty, SMS 5 i 9, powiadomienia) → propozycja: włączyć /
zostawić wyłączoną / zastąpić mechanizm na sztywno regułą. **Cel: zero
podwójnych alarmów.** Po akceptacji — silnik co minutę.

## D-30 — POLISY: TAK

Zadanie dzienne dla przypomnień + formularz polisy dla HHL i przewoźnika
(przewoźnik wpisuje swoją polisę OCP, HHL zatwierdza). Dane polisy przyjdą
po spotkaniu z przewoźnikiem.

## D-31 — PASEK GÓRNY PRZY 390 px: NAPRAW

Błąd makiety, nie zamysł. Zmiany wzorca wyłącznie w ujęciach 390 px.

## CLOUDFLARE

I-0b i reguły R2: napisz, kiedy chcesz się zalogować — właściciel kliknie
„Allow" w ciągu 2 minut.

## U WŁAŚCICIELA
D-5 umowy RODO · D-16 lista użytkowników · **D-32 zgoda IT KSH na aplikację
w ich tenancie** .
