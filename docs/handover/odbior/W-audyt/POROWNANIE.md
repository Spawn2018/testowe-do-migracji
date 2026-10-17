# wyglad/W-audyt — poprawki wyglądu z audytu 17.10 (17.10.2026, 08:00)

Podstawa:
- audyt koordynatora 16/17.10.2026, przyjęty przez właściciela 17.10.2026 o 07:01;
- decyzje właściciela z 17.10.2026, 07:20: **5B** (KSH i SCX widzą „Opłata paliwowa” tylko do odczytu) i **6A** (bez wielkich liter wymuszanych w kodzie);
- dopisek D-20261017-0730-01 §4 (kontrakt `serverRuleOn`) i D-20261017-0800-01 (ten PR).

Zakres F8: wygląd, teksty, obliczenia widoku i dane demo. Bez bazy.

| Miejsce | Było | Jest |
|---|---|---|
| Pomoc „Jak pracuję” › Mapa (produkcja) | „od 03:00 w dniu załadunku do „Dostarczone”” jako działające | do wdrożenia A1: „… do „Dostarczone” (włączamy wkrótce)”. W demo bez zmian. |
| Automatyzacje › „Działa samo” (produkcja) | „wyjazd z placu → Dostarczone”, wiatr 20/25 m/s i „Objazd czy postój?” jako działające | części, które jeszcze nie działają na serwerze, idą na koniec z „— włączamy wkrótce”: wyjazd z placu do A2, wiatr i objazd do P6 E49. W demo bez zmian. |
| Mapa — dopisek pod mapą (produkcja) | „utrudnienia: Trafikverket (SE), HERE (PL)” | bez utrudnień, dopóki warstwa nie pokazuje danych produkcji (P9 E29 pkt 3). HERE (PL) dopiero po P6 E2. |
| Wszystkie ekrany (6A) | etykiety, nagłówki tabel, znaczniki i grupy WIELKIMI LITERAMI (`toLocaleUpperCase` i `up()` w 39 plikach — 262 miejsca — oraz stałe teksty, np. „STATUSY”, „DLACZEGO TYLE”, „NA PLACU”) | zwykły zapis („Statusy”, „Dlaczego tyle”, „Na placu”). Rozstrzelenie liter z wersalików (`letter-spacing` .04–.11em) → .02em. Logo, kod transportu i tablice — bez zmian. |
| Ustawienia KSH i SCX (5B) | demo: tylko „Dla mnie”; produkcja: „Pieniądze › Opłata paliwowa” tylko do odczytu | demo jak produkcja: „Pieniądze › Opłata paliwowa”, ten sam ekran co w Opcjach HHL, bez przycisków i pól. |
| Waluta widoku (E16) | domyślnie PLN | domyślnie **EUR**, jak faktury i cennik. Zapis przeglądarki v2 → v3 wraca do EUR. Wybór zapisany na koncie wraca przy logowaniu. |
| Harmonogram, układ pliku — przepięcie (E20) | „Tomasz Wójcik → Henrik Lund” wjeżdżało na kolumnę telefonu | dwie linie, łamanie tylko przy „→” (Kierowca, Ciągnik, Naczepa). |
| Liczby (E21) | „max 1417 t”, „150.50 EUR”, promień „0.8 km”, kursy z kropką | „max 1 417 t”, „150,50 EUR”, „0,8 km”, przecinek dziesiętny (`formatPlNumber`, `formatPlMoney`). |
| Dzwonek | liczba przy dzwonku = pozycje po ucięciu listy do 40 | liczba ze wszystkich pozycji (99+), lista nadal 40. |
| Okno „Zmień status” (E41) | „Zmień status · T-17” | „Zmień status · T-17 · HHL/2026/1305” (pełna nazwa transportu dla firmy). |
| Leniwe części aplikacji (E22) | 31 importów bez ponowienia | każdy przez `lazyRetry`. Udane wczytanie zdejmuje znacznik odświeżenia, więc po kolejnym wdrożeniu znów jest jedno ponowienie. |

Obrazy: `przed-*` = `main` 7db7282, `po-*` = ta gałąź; demo, `now=2026-09-23T14:32`.
- `*-dziala-samo-1440`;
- `*-opcje-kto-co-dostaje-1440`;
- `*-opcje-cennik-1440`;
- `*-ustawienia-ksh-oplata-1440`;
- `*-ustawienia-ksh-390`;
- `*-harmonogram-przepiecie-1440`;
- `*-panel-t17-1440`.

Testy:
- `tests/w-audyt.test.ts` (12, po F7 — 14) — teksty w demo i w produkcji, brak wersalików w komponentach, `letter-spacing`, EUR i migracja v3, dzwonek, `lazyRetry`, tytuł okna, liczby, przepięcie;
- poprawione oczekiwania: `audyt-e-opcje`, `p5b-money`, `data-layer`, `i13-sefs-scope`, `i4-guide`, `i5-mfa`, `money-v2`.

Unit: 1508 zielonych. Pierwsze wczytanie: 371,7 kB gzip (budżet 400 kB).

**Wzorce `visual` zmieniają się na wielu ekranach** (wielkie litery i odstępy liter). Odświeżam je workflow `visual.yml` z `update=true`.

**Poprawki po niezależnym sprawdzeniu (F7, 17.10):**
1. **(blokowało)** Ustawienia KSH › Opłata paliwowa pokazywały przykład na stawce przewoźnika (6 900 EUR, koszt HHL). Teraz przykład liczy się na własnej stawce strony: KSH 7 245 EUR (stawka KSH), SCX 6 900 EUR (stawka SCX).
2. KSH i SCX nie widzą spraw HHL na tym ekranie:
   - alarmu braku ceny i „Ponowienia … potem powiadomienie do HHL”;
   - kafelka „Pobieranie cen”;
   - kolumny „Pobrane”;
   - znacznika „Uzgodnione z przewoźnikiem”.

   Zostają tygodnie, ceny, mnożniki i „Jak liczymy” (E39: KSH i SCX widzą to samo co HHL przy opłacie).
3. Instrukcja kierowcy: „Załadowany”, „Na promie”, „Rozładowany”, „Problem” — tak jak na przyciskach (PL, EN, SV).
4. Pasek śledzenia w panelu (produkcja, do A1): „wyłączy się samo przy „Dostarczone” — włączamy wkrótce”, a przed startem „· start o 03:00 — włączamy wkrótce”.
5. Kwoty „W PLN” w panelu › Ceny nie łamią się w środku liczby (spacja niełamliwa).
6. Pozostałe słowa wersalikami w tekstach polskich:
   - „Prom”, „Gotowy”, „Sporna” w cudzysłowie;
   - „System — tylko HHL”;
   - lista „Stop”;
   - klasa „Standard”.

   Kody zostają: TEST (nazwa środowiska), START-1…7 (kody reguł), READY w EN/SV.
7. Etykieta stanu błędu w Stanie systemu z wielkiej litery („Ustąpił po naprawie”).

Bez zmian (do wiadomości): grupa „Pieniądze” na stronie „Dla mnie” u KSH i SCX — tak jak dziś na produkcji (`SefsReadOnly`).

**Testy po F7:**
- `tests/w-audyt.test.ts` (14);
- `e8-phone-gate.spec.ts` — oczekiwania zwykłym zapisem i Ustawienia KSH/SCX z grupą „Pieniądze”;
- `i4-guide`, `i19-rate-card.local`.
