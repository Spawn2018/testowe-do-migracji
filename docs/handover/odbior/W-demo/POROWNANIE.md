# wyglad/W-demo — dane demo zgodne z dniem demo i ETA jak z serwera (17.10.2026)

Podstawa: audyt 17.10, przyjęty przez właściciela o 07:01. Sekcje audytu:
- 15 — N2 (pozycje i ETA), N6 (spójne daty demo);
- 08 — N11 (blok ETA E15 w demo);
- 01 — N18 (kolumna „ETA Boden” na Mapie).

Dopisek: D-20261017-0930-01. Tylko dane demo i obliczenia widoku (F8). Produkcja bez zmian.

| Miejsce | Było | Jest |
|---|---|---|
| Daty transportów demo | 36 transportów „w drodze”, „na placu” i „dostarczone” miało załadunek w październiku, czyli po dniu demo 23.09. Np. „Śledzenie trwa od 01.10” przy statusie „Prom”, faktury za t41/t42, Kokpit KSH „Wykonanie” 0 t. | Załadunek liczony wstecz od 23.09 według etapu: w drodze PL dziś, prom i port wczoraj, Droga SE 2–3 dni, przed placem 3–4, rozładunek 4, dostarczone 5–17 dni. Dostawa z planu KSH: + 5 dni (dostarczone: + 4). Dostarczone mają godzinę rozładunku (co trzeci — następnego dnia rano, po terminie) — Kokpit KSH liczy terminowość. |
| Kolejność w Harmonogramie | jak w pliku, daty rosły z kolejnością | dalej po dacie załadunku, jak plik KSH; przy tej samej dacie — pozycja w pliku |
| Panel › Przegląd › blok ETA (E15) | „ETA: –” i „Brak pozycji GPS”, choć Mapa miała pozycję | ETA Boden, pasmo ± minut, słowo pewności, wiek pozycji, km i jazda. Przykłady makiety: T-17 w trasie, SS-08 odpoczynek w toku, T-18 czeka przed placem, SG-35 po oknie, SG-33 cisza GPS (ostatnia pozycja 12:58). Pozostałe transporty w trasie: ETA z planu i etapu, a na promie — wpłynięcie z AIS. |
| Mapa — kolumna „ETA Boden” | pusta | wypełniona dla transportów w oknie śledzenia |
| Kurs NBP przed rozładunkiem (E16) | tabela z przyszłości wobec „dziś” (187/A z 25.09 przy dniu demo 23.09) | kurs bieżący: ostatnia tabela opublikowana do dziś włącznie; po rozładunku — dzień roboczy przed rozładunkiem (bez zmian) |

Obrazy: `przed-*` = `main` 7db7282, `po-*` = ta gałąź; demo, `now=2026-09-23T14:32Z`.
- `*-eta-t-17-1440`, `*-eta-ss-08-1440`, `*-eta-t-18-1440`, `*-eta-sg-35-1440`;
- `*-hhl-sched`, `*-ksh-dash`, `*-hhl-fin`, `*-hhl-map`.

**Nie robione w tym PR — i dlaczego:**
- podgląd ekranów logowania, „Link wygasł”, 2FA i „Działaj jako” w demo (audyt 15 N7, „albo odebrać je na TEST z kontem”). Te ekrany siedzą w `AuthGate` razem z wywołaniami Supabase; wyjęcie ich do demo grozi zepsuciem logowania na produkcji.
- Odbiór: ujęcia na TEST w P11 (pkt 6, 280 ujęć).
- W demo są już: `#/?nowa-wersja=1`, `#/?komunikat-hhl=1`, `#/?pierwsze-wejscie=1` (oraz `=telefon`).

**Testy:**
- `tests/w-demo.test.ts` (6) — daty, kolejność, kurs bieżący, ETA;
- `tests/carrier-rating.test.ts` — rozładunków z przyszłości już nie ma.

Unit: 1516 zielonych. **Wzorce `visual` zmieniają się na wielu ekranach (daty) — odświeżam je.**
