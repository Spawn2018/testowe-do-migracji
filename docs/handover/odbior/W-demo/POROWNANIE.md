# wyglad/W-demo — dane demo zgodne z dniem demo i ETA jak z serwera (17.10.2026)

Podstawa: audyt 17.10, przyjęty przez właściciela o 07:01. Sekcje audytu:
- 15 — N2 (pozycje i ETA), N6 (spójne daty demo);
- 08 — N11 (blok ETA E15 w demo);
- 01 — N18 (kolumna „ETA Boden” na Mapie).

Po niezależnym sprawdzeniu F7 (17.10, 09:45) — poprawki B1, B2, P1–P7 i uwagi, opisane niżej.

Dopisek: D-20261017-0930-01. Dane demo i obliczenia widoku (F8). Produkcja: zmiany tylko w obliczeniach widoku (pkt „Widok” niżej).

Zegar demo: środa 23.09.2026, 16:32.

| Miejsce | Było | Jest |
|---|---|---|
| Daty transportów demo | 44 transporty w drodze, na placu i dostarczone miały załadunek po dniu demo: 40 w październiku, 3 z 30.09, 1 z 01.11. Np. „Śledzenie trwa od 01.10” przy statusie „Prom”, Kokpit KSH „Wykonanie” 0 t. | Załadunek liczony wstecz od 23.09 według etapu, tylko w dni robocze. Dostawa z planu KSH: + 5 dni (dostarczone: + 4), a sobota i niedziela przechodzą na piątek. Szczegóły w tabeli „Daty” niżej. |
| Rozładunek | „Dostarczone 24.09, 12:00” przy zegarze 23.09, 16:32 (B1) | rozładunek dziś o 13:50; dostarczone 08.09–22.09, co trzeci następnego dnia rano, po terminie (terminowość w Kokpicie KSH) |
| Historia transportu | import 10.09 po załadunku 06.09; „Zasoby przypisane 18.09” po „Dostarczone 14.09” (P5) | import pliku KSH 01.09 (wersja 1); zasoby 2 dni przed załadunkiem; rejs wieczorem w dniu załadunku; rozładunek z godziny rozładunku; „brak pingu” 90 min po ostatniej pozycji. Wszystko przed zegarem i po kolei. |
| Czat demo | wiadomość „Proszę potwierdzić awizację” 21.09 przy transporcie dostarczonym 15.09 (P5) | te same transporty co dotąd; rozmowa o awizacji 2 dni przed załadunkiem (najpóźniej 21.09) |
| Kolejność w Harmonogramie | jak w pliku | po dacie załadunku, jak plik KSH; przy tej samej dacie — pozycja w pliku. Sprawy demo zostają przy tych samych transportach co przed sortowaniem — liczba „Do zrobienia” w menu = liczba kart (E7-2). |
| Panel › Przegląd › blok ETA (E15) | „ETA: –” i „Brak pozycji GPS”, choć Mapa miała pozycję | ETA Boden, pasmo ± minut, pewność, wiek pozycji, km i jazda. Zasada: **ETA = ostatnia pozycja + jazda + odpoczynek** (+ postój, rejs). Szczegóły w tabeli „ETA” niżej. |
| Mapa — kolumna „ETA Boden” | pusta | ta sama ETA co w panelu; na placu „od 15:10” (przed zegarem, P2); w czasie załadunku „–” |
| „Po oknie” i pigułka opóźnienia | stałe „+1 h 35 min” przy każdym opóźnionym, także z ETA w oknie (P1) | tylko gdy ETA jest za końcem okna dostawy i z prawdziwą różnicą (np. SG-35 „po oknie”, T-01 opóźniony o 4 h, ale przed oknem — bez pigułki) |
| Brak GPS | trzy różne godziny ostatniej pozycji: panel, Mapa i sprawa (P4) | jedna: zegar minus czas ciszy (T-05: 14:57, „Brak pozycji od 1 h 35 min”; SG-33: 13:18, „bez pingu od 3 h 14 min”) |
| Teksty spraw | „Brak zezwolenia — załadunek za 46 h” przy załadunku 05.10 | z tych samych liczb co transport: „załadunek za 12 dni”, SG-34 „za 13 h”; „poza oknem o 1 h 35 min” = ETA − koniec okna |
| Zmiana statusu w demo | kasowała ETA („ETA: –”, „Brak pozycji GPS”) | ETA demo liczona od nowa dla nowego etapu |
| Zapis w przeglądarce | stare dane demo (październikowe daty, bez ETA) przykrywały nowe (B2) | wersja zapisu 4: stare dane startowe odrzucone, zostaje rola, motyw i ustawienia |
| Kurs NBP przed rozładunkiem (E16) | tabela z przyszłości wobec „dziś” (187/A z 25.09 przy dniu demo 23.09) | kurs bieżący: ostatnia tabela opublikowana do dziś włącznie; także dla spóźnionego bez rozładunku. Po rozładunku — dzień roboczy przed rozładunkiem (bez zmian). |

**Daty** (dzień załadunku → dostawa z planu):

| Etap | Załadunek | Dostawa |
|---|---|---|
| Załadunek, Droga PL | dziś, śr 23.09 | pn 28.09 |
| Port PL, Prom (rejs dziś 18:00) | wt 22.09 | pt 25.09 |
| Droga SE, brak GPS | pn 21.09 | pt 25.09 |
| Opóźnione, Plac Boden, Rozładunek | pt 18.09 | dziś, okno do 17:00 |
| Dostarczone | 04.09–18.09 | 08.09–22.09 |
| Dodatkowe transporty | wpisane wprost: SG-31, SG-33, T-18 — pn 21.09; T-17 — wt 22.09; SG-35 — pt 18.09; R-03 — pn 28.09 | dni robocze |

**ETA** (zegar 16:32, ostatnia pozycja 16:27):

| Etap | Przykład | ETA |
|---|---|---|
| Droga PL | T-08 | rejs jutro 18:00 → Nynäshamn 25.09 12:00 → sob 26.09, 14:00 (przed oknem) |
| Port PL, Prom | SG-16, SG-06 | rejs dziś 18:00 → Nynäshamn jutro 12:00, 15 h jazdy, 11 h odpoczynku → pt 25.09, 14:00 (w oknie). Na promie blok pokazuje wpłynięcie z AIS (E15 pkt 8), Mapa — ETA Boden. |
| Droga SE | SG-08 | 520 km, 7 h 30 min jazdy, 11 h odpoczynku → 24.09, 10:57 (przed oknem) |
| Droga SE, makieta E15 | T-17, SS-08 | T-17: postój przy zamkniętym Högakustenbron do 22:02, 8 h 40 min jazdy, 11 h odpoczynku, wiatr + 14 min, śliskość + 9 min → 24.09, 18:05. SS-08: odpoczynek do 01:05, potem 6 h 50 min → 24.09, 07:55. |
| Brak GPS | T-05, SG-33 | z ostatniej pozycji: 14:57 → 24.09, 10:37; SG-33: 13:18 → 24.09, 09:18 |
| Opóźnione | SG-10, SS-01, SG-21, SS-07 | dziś wieczorem, po oknie do 17:00 (18:35, 19:15, 19:55, 19:00) |
| Opóźnione, makieta E15 | SG-35 | okno minęło dziś o 15:00, 560 km → 24.09, 11:47, „po oknie”, pewność niska |
| Siła wyższa | T-01, SG-31, SG-14, SG-03 | ETA z etapu plus godziny siły wyższej (T-01 + 4 h — nadal przed oknem; SG-14 Port SE + 3 h — po oknie) |
| Plac Boden | T-12, D-01, T-18 | czeka przed placem od 15:10 (T-18 od 11:40, przed oknem 25.09) |
| Załadunek | SG-17 | „–” przed wyjazdem, z pozycją na placu KSH |

**Widok (obliczenia, dotyczy też produkcji):**
- „po oknie” w bloku ETA tylko, gdy ETA jest za oknem dostawy; bez ETA — znacznik opóźnienia z bazy (`EtaBlock`);
- minuty opóźnienia w demo liczone wobec końca okna dostawy (`planDates.deliveryTo`, a bez niego `awizacja.unloadWindowEnd`), bez zastępczych 95 min. Na produkcji pigułka bierze dalej `loads.delay_minutes`.

Obrazy: `przed-*` = `main` 7db7282 (bez #277), `po-*` = ta gałąź (z #277); demo, `now=2026-09-23T14:32Z`.
- `*-eta-t-17-1440`, `*-eta-ss-08-1440`, `*-eta-t-18-1440`, `*-eta-sg-35-1440`;
- `*-hhl-sched`, `*-ksh-dash`, `*-hhl-fin`, `*-hhl-map`.

**Nie robione w tym PR — i dlaczego:**
- **Podgląd ekranów logowania, „Link wygasł”, 2FA i „Działaj jako” w demo** (audyt 15 N7, „albo odebrać je na TEST z kontem”). Te ekrany siedzą w `AuthGate` razem z wywołaniami Supabase. Wyjęcie ich do demo grozi zepsuciem logowania na produkcji. Odbiór: ujęcia na TEST w P11 (pkt 6, 280 ujęć). W demo są już `#/?nowa-wersja=1`, `#/?komunikat-hhl=1` i `#/?pierwsze-wejscie=1` (oraz `=telefon`).
- **Stare faktury demo** (`invoices`, model sprzed bills; w interfejsie ich nie ma). Daty i pozycje się nie zgadzają, tak jak przed PR. Znikną, gdy P5 przełączy pieniądze na `bills`.
- **Nazwy na podkładzie mapy** po angielsku (SWEDEN) i **waluta przy kwotach EUR w Fakturach** — poza zakresem; zgłoszone do przeglądu tekstów (P11).
- **Zegar demo bez `?now=`** — dane demo mają stały dzień 23.09, tak jak dotąd.

**Testy:**
- `tests/w-demo.test.ts` (15) — daty, dni robocze, rozładunek przed zegarem, kolejność zdarzeń, czat, ETA = pozycja + jazda + odpoczynek, „po oknie” tylko za oknem, brak GPS, teksty spraw, kurs bieżący (także spóźniony), zapis v4, sprawy przy tych samych transportach;
- zmienione: `carrier-rating`, `store-persist`, `money-v2`, `w-audyt` (wersja zapisu 4), `i2-facade` (bez 95 min w demo), `p6-history` (czat), `e8-phone-gate` (P9-f: T-12 „Na placu od 23.09.2026, 15:10”);
- e2e `e8-phone-gate` + `persist-toast` lokalnie: 130 zielonych.

Unit: 1525 zielonych. **Wzorce `visual` zmieniają się na wielu ekranach (daty) — odświeżam je.**
