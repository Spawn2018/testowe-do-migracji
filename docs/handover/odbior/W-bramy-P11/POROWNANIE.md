# W-bramy-P11 — P11 pkt 3 „Bramy na stałe”: E20 szerokości, E21 strażnik tekstów, E10 kontrast

Koordynator (Claude), 18.10.2026 (13:10, druga runda po F7: 15:20). Gałąź `wyglad/W-bramy-P11` (od `main` a2eb2d4, z #300). F8: testy wyglądu i kolory (tokeny), bez danych, bazy i tekstów.

## Podstawa
- PLAN §4 P11 pkt 3 „Bramy na stałe”:
  - strażnik tekstów E21 blokujący na ekranach (0 trafień, E21 pkt 8);
  - axe kontrast E10;
  - szerokości 1280 / 1366 / 1440 / 1920 bez nakładania (E20);
  - elementy poza ekranem telefonu E8 (jest już: `e8-phone-gate`).
- E20 pkt 1, 2 i 5; E21 pkt 7 i 8; E10.
- Polecenie właściciela 18.10, 12:28: praca w trybie ciągłym nad planem.

## Gdzie są bramy
Osobny plik `tests/p11-bramy.spec.ts` (F7 P5): testy biegną równolegle w 2 wątkach i nie wchodzą w konflikt z PR-ami dopisującymi do `etap6-ui.spec.ts` (jak przy #300). CI uruchamia go w `scripts/ci/fresh-smoke.sh` zaraz po `test:aud03`. `tests/etap6-ui.spec.ts` jest taki sam jak na `main`.

Każda strona i zakładka jest sprawdzana dopiero po dorysowaniu: tekst obszaru niepusty i bez zmian przez 300 ms, najwyżej 6 s (F7 B3). Panel zawsze otwiera się od zakładki Przegląd, a brak zakładki oblewa test (bez cichego pominięcia).

## Co sprawdzają
1. **E20 — szerokości komputera.** 3 firmy × zegar 23.09 (12 stron) i 20.11 (Kokpit, Harmonogram, Finanse, Faktury) × 1280 / 1366 / 1440 / 1920. Do tego panel SG-03, SG-32 i T-01, 6 zakładek, przy 1280. Jedno wejście na stronę i 4 zmiany rozmiaru okna. Wymagane 0:
   - treść szersza od `main` albo od panelu (F7 B1 — `main` ucina nadmiar, więc liczy się sam `main` i jego potomkowie), dokument szerszy od okna;
   - pasek górny: treść wyższa od paska albo dziecko paska wyższe niż pasek (F7 B2 — „WATCH TOWER” w dwóch liniach);
   - kolumny tabeli na sobie, tekst wylany z komórki, ucięty widoczny tekst;
   - kafelki i panele w siatce lub rzędzie nachodzące na siebie (F7 P1).
   
   Osobno: Harmonogram „Widok skrócony” (8 kolumn) bez przewijania w bok przy 1280 i 1366 (HHL, KSH, SCX; F7 D7 — domyślny układ pliku KSH przewija się w bok z założenia, E38).
2. **E21 — strażnik tekstów.**
   - Zakres: 5 rodzajów kont × zegar 23.09 i 20.11 × 12 stron, każdy ekran Opcji, dzwonek, Ryzyka z rozwiniętą listą i wszystkimi kartami. Panel: 13 transportów przy 23.09 i 3 przy 20.11, każdy po 6 zakładek (Operacje HHL bez panelu — ten sam widok co Administrator).
   - Reguły (F7 P3): kody z podkreśleniem; klucze małymi literami („sail_src_STENA”, „risk.kind.…”); numery wewnętrzne (8 znaków, małe i wielkie litery); daty ISO, także z „T”; sekundy; daty bez zera; kropka dziesiętna (także „12.10 PLN”); kwota bez odstępu tysięcy („8239,15”); szwedzkie słowa; zła odmiana („22 pojazdów”, „5 pojazdy”, z wyjątkiem po przyimkach z dopełniaczem); puste wartości; „Nieznany kod” poza Stanem systemu.
   - Wyjątki (F7 D3): nazwy plików z rozszerzeniem (wielkość liter dowolna, także z łącznikiem), licencja „CC BY 4.0”. Kody w Stanie systemu są dozwolone (E21 pkt 3, F7 D6).
   - Osobny test reguł: przykłady z audytu muszą zostać złapane, a daty, pliki i licencja przepuszczone.
3. **E10 — kontrast (axe-core, `color-contrast`, WCAG AA).**
   - Komputer: 3 firmy × motyw jasny i ciemny × 12 stron, Ryzyka z rozwiniętymi kartami, najechany wiersz Mapy, każdy ekran Opcji, dzwonek, panel (3 transporty × 6 zakładek, axe tylko na panelu) i okna Dopłata, Awizacja, Daty KSH.
   - Telefon 390: 3 firmy × 2 motywy, strony i panel SG-32 (F7 P4).
   - Operacje HHL i Użytkownik SCX: każdy ekran Opcji w obu motywach.
   - axe wstrzykiwany raz na stronę (F7 P5); węzły „incomplete” są wypisywane w adnotacji testu (F7 D8).
   - Wymagane 0 węzłów.

Kafelki mapy są blokowane tylko po hostach podkładu (F7 D4).

## Co bramy znalazły i co poprawiam (tylko tokeny: tekst pomocniczy na barwnym tle = `--ink-2` zamiast `--ink-3`)

| miejsce | było | jest |
|---|---|---|
| Opcje › Stan systemu, wiersz źródła „nie działa” (tło czerwone) — opis, „następna próba”, kanały | 4,34 (jasny) | 6,79 |
| to samo, wiersz „częściowo” / „bez pomiaru” (tło bursztynowe) | 3,88 (ciemny) | 6,49 (ciemny), 7,57 (jasny) |
| Opcje › Kto co dostaje, zaznaczony wiersz — sam opis zdarzenia (F7 D1: kanały bez zmian) | 4,42 (jasny) | 6,92 |
| Panel › Czat, moja wiadomość (tło morskie) — „Nikt jeszcze nie przeczytał” | 4,42 (jasny), 4,32 (ciemny) | 6,92 / 7,23 |
| Panel › Czat, moja wiadomość — znacznik „tylko HHL i SCX” | 4,14 (jasny) | 5,17 — tło znacznika białe, bursztynowa ramka i tekst zostają |
| Strefy, wybrana strefa (tło zielone, ciemny motyw) — „ostatnia zmiana”, liczby | 4,31 | 7,20 |
| Mapa, najechany lub wybrany wiersz — czerwone „+1 h 35 min po oknie” (F7 P2) | 4,32 (ciemny) | białe pole pod napisem, ≥ 4,5 w obu motywach |
| Ryzyka, rozwinięta karta „objazd czy postój”, opcja „Objazd” (tło zielone) — „Ryzyka” (F7 P2) | 4,31 (ciemny) | 7,20 |
| Harmonogram, najechany wiersz (ciemny motyw) — status, ETA, kwota, marża | 3,99 | ink-2 |
| Harmonogram, podświetlony wiersz (tło bursztynowe) — „Dokumenty”, marża | 3,88 (ciemny) | ink-2 |

Pliki: `src/components/options/sys.css`, `options.css`, `src/components/drawer/p6b.css`, `src/components/zones/zones.css`, `src/components/risks/risks.css`, `src/components/schedule/sched7.css`, `src/index.css`. Pozostałe kolory, układ i teksty bez zmian.

F7 D2 (jedna reguła dla wszystkich teł `*-bg` zamiast poprawek miejsce po miejscu): zostaje miejsce po miejscu. Zmiana tokenu `--ink-3` zmieniłaby szary tekst w całej aplikacji. Bramy pilnują każdego nowego miejsca.

## Wynik lokalnie (build gałęzi, 2 wątki)
- Cały plik: 32 testy w 7,5 min. Pierwszy przebieg: 28 z 32 — znalazł wiersze Harmonogramu (tabela wyżej) i lukę w regule kwot. Po poprawce E21 (11 testów) i E10 ciemny komputer (3): 14 z 14 w 4,0 min.
- `tsc -b`, `stylelint`, `oxlint` bez uwag.

## Odłożone (z terminem)
- **E21 — treści e-maili próbnych** (E21 pkt 7): do P11 pkt 6, przed wydaniem 28.10.
- **E20 — zrzuty 4 szerokości w bramie wizualnej** (`scripts/baseline.mjs` ma `1920, 1440, 1280, 768, 390`, bez 1366): do P11 pkt 6.
- **Nowe reguły E21** — kody etapów w tekstach („(E42)”, „jak w E41”) i procent ze spacją („14,27 %” zamiast „14,27%”): wchodzą razem z poprawkami tekstów w `wyglad/W-przed-wydaniem-3` (P11 pkt 7). Dodane tutaj oblałyby `main`.

## Dalej (P11 pkt 7, ten sam koordynator)
Końcowe porównanie każdego miejsca z „Mapy aplikacji” z raportem — `docs/handover/odbior/P11-zgodnosc/` (w toku).
