# wyglad/P10b-c — Opcje › System › Stan systemu: źródła danych, błędy aplikacji, bezpieczeństwo, wydajność (16.10.2026, 08:45)

Podstawa:
- E23 pkt 1–3, 5, 8 (zdecydowane 08.10, decyzja 27 A) — źródła danych:
  - jeden wiersz na źródło: nazwa po polsku, co zasila, wiek danych, stan, od kiedy, przyczyna i skutek, „Sprawdź teraz”;
  - najpierw to, co wymaga uwagi; pozostałe zadania zwinięte; bez kodów (E21); Administrator i Operacje HHL, także telefon;
  - progi „Nie działa” (10 min, 15 min, 30 min, 45 min, 3 h, 26 h, 8 dni), zmiana w Opcjach (E12);
- E47 (`UZGODNIENIE_08_10.md` pkt 5) — Błędy aplikacji według makiety `makiety_html/E46/bledy.html`;
- E19 pkt 7 — kafelek Bezpieczeństwo (Administrator HHL, tylko odczyt);
- E46 — wyniki testu wydajności;
- E44 pkt 7 — źródło RIO na liście;
- makiety `makiety_html/E23/zrodla.html`, `makiety_html/E46/bledy.html`, `raport/img/e19-after`;
- PLAN §4 P10b („E23 i E47 (ekrany)”).

Wygląd, teksty i obliczenia widoku (F8), bez zapisów. **Złożone na #252 (`wyglad/P10b-b`)** — scalasz po #252.

| Miejsce | Było | Jest |
|---|---|---|
| Opcje › System › Stan systemu (demo) | „Wkrótce” | ekran z 4 zakładkami: Źródła danych · Błędy aplikacji · Bezpieczeństwo (tylko Administrator HHL) · Wydajność; oznaczenie „Demonstracyjne” |
| Opcje › System › Stan systemu (produkcja) | kafelek „Integracje 12 z 14 OK”, lista z kodami zadań, „Odśwież” | bez zmian do podłączenia danych (D-20261016-0845-01); potem ten sam ekran co w demo |
| Źródła danych — komputer | — | podsumowanie „1 nie działa · 3 częściowo albo bez pomiaru · 8 działa · 1 bez źródła”, „na żywo”; tabela Źródło · zasila / Ostatnie dane / Stan / Przyczyna i skutek; wiersze „Nie działa” na czerwonym tle, „Częściowo” i „Brak pomiaru” na bursztynowym; „Sprawdź teraz” przy wierszach wymagających uwagi, wynik w wierszu („Sprawdzone 16:32: nie działa”) |
| Pozostałe zadania | — | zwinięte „Pozostałe zadania · 6”: wysyłka powiadomień, push, przypomnienia, porządki, zużycie limitów, strażnik zadań |
| Progi „Nie działa” | — | 7 progów E23 pkt 3 z opisem reguły (5 prób z rzędu, jedna sprawa na źródło, zamknięcie po 15 min, alarm A); „Zmień” tylko Administrator HHL, Operacje — do odczytu |
| Źródła danych — telefon 390 | — | „4 wymagają uwagi”: lista z kropką stanu, „od kiedy” i wiekiem danych; dotknięcie → „Zasila: …”, przyczyna, „Sprawdź teraz”; „+ 8 działa · 1 bez źródła” rozwija resztę |
| Błędy aplikacji | — | 4 kafelki (rodzaje błędów, wystąpienia w 7 dni, nowe od wdrożenia, strony); tabela jak w makiecie; kliknięcie wiersza → stos, strony, role; stany: nowy, powrócił, obserwacja, ustąpił po naprawie, przyczyna znana; reguła alarmu pod tabelą |
| Bezpieczeństwo | — | 5 wierszy: doradca bezpieczeństwa bazy, funkcje bez logowania, test bezpieczeństwa (data i commit), weryfikacja dwuetapowa, hasła; tylko odczyt |
| Wydajność | — | wyniki testu E46 z progami (LCP ≤ 2,5 s · CLS ≤ 0,1 · TBT ≤ 300 ms; p95 ≤ 500 ms; 20 sesji / 10 min), „zaliczony” / „ponad próg” |
| Zakładki na telefonie | — | „Źródła · Błędy · Bezpieczeństwo · Wydajność” w jednym wierszu (krótsze nazwy), cele ≥ 44 px |

**Różnice wobec makiety (z powodu):**
- źródło „Linki RIO podwykonawców” dopisane (E44 pkt 7, PLAN P10a — RIO na liście źródeł E23);
- stan błędu „powrócił” dopisany (E47: „nowe i powracające”);
- w Bezpieczeństwie „Doradca bezpieczeństwa bazy” zamiast nazwy dostawcy (strażnik I-2 w paczce demo).

**Bez zmian:** stary panel produkcji (`SystemStatusPanel`) i jego klasy `.sys-table`, `.sys-tile` w `index.css` — nowy ekran ma osobne klasy (`.sys-tbl`, `.sys-kpi`), żeby nie zmieniać wyglądu starego panelu przed podłączeniem.

**Porządek bez zmiany wyglądu:** style Pomocy (P10b-b) przeniesione z `index.css` do `src/components/shell/help.css`, ładowanego razem z panelem Pomocy — budżet pierwszego wczytania.

**Demo:** dane zmyślone (G-09). **Produkcja:** dane z D-20261016-0845-01 pkt 1–6.

**Sprawdzone:**
- unit `sys-status` (4): 5 stanów, nazwy i przyczyny bez kodów zadań, przyczyna przy każdym stanie wymagającym uwagi; progi E23 pkt 3; stany błędów; Bezpieczeństwo — 5 wierszy, test z datą i commitem; progi E46; produkcja przed podłączeniem pokazuje dzisiejszy panel (warunek trybu wpisany wprost, I-0);
- e2e blok P10b-c (2):
  - komputer 1440: kolejność zakładek, podsumowanie, kolejność stanów (Nie działa → Częściowo → Brak pomiaru … Bez źródła), „Sprawdź teraz” tylko przy wierszach wymagających uwagi, wynik w wierszu, tabela bez przewijania w bok, 6 pozostałych zadań, 7 progów, bez kodów zadań; Błędy (4 kafelki, 3 grupy, rozwinięcie, stan, reguła alarmu); Bezpieczeństwo 5; Wydajność 5;
  - telefon 390: zakładki w jednym wierszu bez przewijania, „4 wymagają uwagi”, rozwinięcie z „Sprawdź teraz”, cała lista 13, wiersze ≥ 44 px, strona bez przewijania w bok;
- cała specyfikacja e8-phone-gate + AUD-01e + B-7;
- cały zestaw unit zielony;
- pierwsze wczytanie 396,9 kB gzip (ekran i style ładowane z Opcjami).

**Zrzuty:** `zrodla-1440.webp`, `bledy-1440.webp`, `bezpieczenstwo-1440.webp`, `wydajnosc-1440.webp`, `zrodla-390.webp`, `zrodla-390-rozwiniete.webp`.
