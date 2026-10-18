# W-bramy-P11 — P11 pkt 3 „Bramy na stałe”: E20 szerokości, E21 strażnik tekstów, E10 kontrast

Koordynator (Claude), 18.10.2026, 13:10. Gałąź `wyglad/W-bramy-P11` (od `main` a51cf77). F8: testy wyglądu i kolory (tokeny), bez danych, bazy i tekstów.

## Podstawa
- PLAN §4 P11 pkt 3 „Bramy na stałe”:
  - strażnik tekstów E21 blokujący na wszystkich ekranach (0 trafień, E21 pkt 8);
  - axe kontrast E10;
  - szerokości 1280 / 1366 / 1440 / 1920 bez nakładania kolumn (E20);
  - elementy poza ekranem E8 (jest już: `e8-phone-gate`).
- E20 pkt 1, 2 i 5; E21 pkt 7 i 8; E10.
- Polecenie właściciela 18.10, 12:28: praca w trybie ciągłym nad planem.

## Co dochodzi (wszystko w `tests/etap6-ui.spec.ts` — CI uruchamia go w `visual` przez `npm run test:etap6`)
1. **E20 — szerokości komputera.** Zakres: 3 firmy × zegar 23.09 i 20.11 × 1280 / 1366 / 1440 / 1920 × 12 stron. Wymagane 0:
   - kolumn tabeli zachodzących na siebie;
   - widocznych tekstów uciętych (`overflow: hidden` / `clip` / wielokropek);
   - dokumentu szerszego od okna;
   - pasek górny ma najwyżej 53 px (jedna linia; dziś 52 px, E20 pkt 5).
2. **E21 — strażnik tekstów.**
   - Zakres: 5 rodzajów kont × zegar 23.09 i 20.11 × 12 stron, każdy ekran Opcji i dzwonek; do tego 6 zakładek panelu dla SG-03, SG-32, SG-09, T-01 i SG-10.
   - Kategorie z E21 pkt 7: kody z podkreśleniem, numery wewnętrzne (8 znaków), kropka dziesiętna, daty ISO, sekundy, daty bez zera, szwedzkie słowa, zła odmiana, puste wartości („undefined”, „NaN”).
   - Wyjątek: nazwy plików z rozszerzeniem (np. „HHL_FV_2026_0902.pdf” w Finansach).
   - Wynik: **0 trafień**. Przegląd E21 z 08.10 miał 606; ostatnie poprawki weszły w #297 i #298.
3. **E10 — kontrast (axe-core, `color-contrast`, WCAG AA).**
   - Zakres: 3 firmy × motyw jasny i ciemny × 12 stron, każdy ekran Opcji i 6 zakładek panelu dla SG-03, SG-32 i T-01.
   - Wymagane 0 węzłów. Dotychczasowy `scripts/a11y/audit.mjs` sprawdzał tylko strony z menu (0 naruszeń) i nie blokował.

## Co brama znalazła i co poprawiam (tylko tokeny; tekst pomocniczy w podświetlonym wierszu = `--ink-2` zamiast `--ink-3`)

| miejsce | było | jest |
|---|---|---|
| Opcje › Stan systemu, wiersz źródła „nie działa” (tło czerwone) — opis, „następna próba”, kanały | 4,34 (jasny) | 6,79 |
| to samo, wiersz „częściowo” / „bez pomiaru” (tło bursztynowe) | 3,88 (ciemny) | 6,49 (ciemny), 7,57 (jasny) |
| Opcje › Kto co dostaje (macierz), zaznaczony wiersz — opis zdarzenia | 4,42 (jasny) | 6,92 |
| Panel › Czat, moja wiadomość (tło morskie) — „Nikt jeszcze nie przeczytał” | 4,42 (jasny), 4,32 (ciemny) | 6,92 / 7,23 |
| Panel › Czat, moja wiadomość — znacznik „tylko HHL i SCX” | 4,14 (jasny) | 5,17 — tło znacznika białe, bursztynowa ramka i tekst zostają |
| Strefy, wybrana strefa (tło zielone, ciemny motyw) — „ostatnia zmiana”, liczby | 4,31 | 7,20 |

Pliki: `src/components/options/sys.css`, `src/components/options/options.css`, `src/components/drawer/p6b.css`, `src/components/zones/zones.css`. Pozostałe kolory, układ i teksty bez zmian. Wzorce `visual` (Kokpit i Mapa) tych miejsc nie obejmują.

## Wynik lokalnie (build gałęzi)
- E20: 6 z 6 (3,1 min);
- E21: 10 z 10 (3,3 min);
- E10 przed poprawką: 4 z 6 (HHL i SCX, oba motywy — tabela wyżej); po poprawce: 6 z 6 (3,4 min);
- etap4, etap5 i etap6 w całości: 50 z 50 (etap6 trwa teraz 10,8 min — o ok. 10 min dłużej w CI `visual`).

## Dalej (P11 pkt 7, ten sam koordynator)
Końcowe porównanie każdego miejsca z „Mapy aplikacji” z raportem — `docs/handover/odbior/P11-zgodnosc/` (w toku).
