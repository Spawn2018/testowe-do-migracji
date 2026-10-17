# wyglad/W-eta — czasy przy ETA „X d Y h Z min” (D-071), „przyjazd nocą” na Mapie i w Harmonogramie (D-101), ekran Opcje › Kalibracja ETA (E15 pkt 7) — 17.10.2026

Podstawa:
- D-071 (zeszyt 8.8, decyzja właściciela 02.10): ETA „X d Y h Z min” powyżej 24 h, „Y h Z min” poniżej;
- D-101 (ETA-MARK, 05.10): znaczniki „w oknie / przed terminem / po terminie / przyjazd nocą 22–06”;
- audyt 17.10, §3.1 pkt 3 i 5 (pominięte w planie); D-20261017-0730-01 §3 pkt 2–3 („wygląd koordynatora, jeśli brak”; „widok sprawdza koordynator”).

Dopisek: D-20261017-1100-01. Tylko wygląd, teksty i obliczenia widoku (F8).

| Miejsce | Było | Jest |
|---|---|---|
| Pigułka opóźnienia (panel, Harmonogram, nagłówek) | „+20h47”, „+1d 18h 00m” | „+20 h 47 min”, „+1 d 18 h” |
| Mapa — „ETA Boden” | „+28 h 27 min po oknie” | „+1 d 4 h 27 min po oknie”; przy ETA 22:00–06:00 dopisek „przyjazd nocą” |
| Harmonogram — „ETA Boden” | sama godzina | pod godziną „przyjazd nocą”, gdy ETA wypada 22:00–06:00 |
| Blok ETA (panel) | czasy powyżej 24 h w samych godzinach: „jazda 26 h 10 min”, „z GPS 26 h 5 min temu” | „jazda 1 d 2 h 10 min”, „z GPS 1 d 2 h 5 min temu”; poniżej 24 h bez zmian („jazda 8 h 20 min”) |

W bloku ETA znaczniki „przed oknem / w oknie / po oknie dostawy” i „przyjazd nocą” już były (P4-b). Teraz D-101 jest też na Mapie i w Harmonogramie.

Jedna funkcja `etaDuration` (`src/lib/etaDuration.ts`) dla bloku ETA, pigułki, Mapy i Harmonogramu (E21: jeden moduł formatów). Części równe zero są pomijane („2 h”, „1 d 18 h”).

Obrazy (demo, `now=2026-09-23T14:32Z`; `przed-*` = `wyglad/W-pl`, `po-*` = ta gałąź):
- `*-eta-sg-35` — pigułka „+20 h 47 min”;
- `*-map-table` — SG-14 „+1 d 4 h 27 min po oknie”;
- `po-sched-night` — SG-03 „26.09.2026, 02:00 · przyjazd nocą”.

## Opcje › Zasady transportu › Kalibracja ETA (E15 pkt 7; audyt 17.10 sekcja 08 N6)

Było: ekranu nie ma. Pomiary po dostawie zapisują się w bazie (`eta_segment_observations`, II-7b), ale HHL ich nie widzi. Zmiana czasów odcinków — tylko migracją.

Jest — nowy ekran w grupie „Zasady transportu” (Administrator HHL zatwierdza, Operacje HHL widzą bez przycisku):
1. **Pomiary dostaw** — jeden wiersz na dostawę z GPS: wjazd na plac, błąd ETA 24 h, 6 h i 1 h przed przyjazdem (minus = auto przyjechało wcześniej, niż mówiło ETA; kolor tylko w kolumnie „1 h przed” — cel E15 ≤ 30 min), Droga PL i odprawa, Droga SE, przerwy i odpoczynek. Pomiar bez danych jest pominięty z powodem (jak dwa błędne pomiary SG-03 na produkcji). Na dole średni błąd.
2. **Propozycja czasów odcinków** — odcinki = kody `eta_segment_params` (PL_ROAD, PL_ROAD_GDY, PORT_CHECKIN, CROSSING_DEFAULT, SE_ROAD, SE_ROAD_KAA, SE_BREAKS, SE_DAILY_REST). Reguła jak `RAPORT_KALIBRACJI_ETA.md`: mniej niż 5 dostaw — „za mało dostaw”; różnica do 10 % — „bez zmian”; inaczej propozycja = mediana z rozrzutem. Rozrzut = większa z odległości p10 i p90 od mediany. Rejs (rozkład armatora) i odpoczynek dobowy (przepisy UE) — bez kalibracji. Zdanie z zyskiem liczone z danych: błąd 24 h przed przeliczony nowymi czasami odcinków, które 24 h przed przyjazdem są jeszcze przed autem (Droga SE, przerwy) — „Na tych samych 6 dostawach nowe czasy dają średni błąd 24 h przed przyjazdem 12 min zamiast 2 h 22 min.”
3. **„Zatwierdź nowe czasy”** — okno z pytaniem w panelu, „Anuluj” / „Tak, zatwierdź”. Bez zatwierdzenia nic się nie zmienia (zdanie przy przycisku).
4. **Wersje czasów** — numer, kiedy, kto, co; znacznik „obowiązuje”. Menu boczne: „propozycja czeka” → po zatwierdzeniu „wersja 2”; bez propozycji „czasy się zgadzają” albo „3 z 5 dostaw”.

Demo: 7 dostaw z Harmonogramu (6 liczonych, SG-04 pominięty — brak GPS na odcinku SE), propozycja dla Drogi PL (7 h 30 min → 6 h 30 min), Drogi SE (17 h → 15 h) i przerw (2 h → 1 h 35 min); odprawa bez zmian (−3 %). Produkcja: „Brak źródła danych.”, dopóki wykonawca nie podłączy danych (dopisek §3). Ekran ładuje się osobno — pierwsze wczytanie ok. 320 kB gzip (było 319,3).

Obrazy (`now=2026-09-23T14:32Z`, Administrator HHL):
- `po-calib-desk` — cały ekran 1440 px;
- `po-calib-zatwierdz` — pytanie przed zatwierdzeniem;
- `po-calib-zatwierdzone` — po „Tak, zatwierdź”: wersja 2 obowiązuje, czasy „Teraz” nowe;
- `po-calib-telefon-pomiary`, `po-calib-telefon-propozycja` — telefon 390 px: karty z liczbami parami.

**Sprawdzenie F7 (osobny agent, 17.10, 11:50)** — 1 bloker, 7 poprawek, 14 uwag; poprawione:
- B1: zdanie o zysku przeczyło znakom błędów → błędy 24 h przed ujemne (auta jadą szybciej niż model), błąd „po” liczony z danych, test kierunku;
- P1 powód pominięcia zgodny z panelem SG-04; P2 stan zatwierdzenia w widoku Opcji (menu i ekran razem, także po przejściu na inny ekran); P3 liczby nie odklejają się od jednostek na telefonie; P4 „ostatnia pozycja … temu” w pasku śledzenia i PDF w D-071; P5 bez podwójnej ramki; P6 czerwone wartości pogrubione jak pozostałe; P7 odprawa w tabeli pomiarów;
- uwagi: rozrzut z p10/p90 od tej samej mediany, rozrzut przez `etaDuration`, kolor tylko „1 h przed”, opis rejsu, godzina wersji z zegara demo, data w jednej linii na telefonie, „Średni błąd” bez łamania, znacznik menu, notatka „po każdej dostawie”, minus „−” także w pigułce opóźnienia, sprawy ETA w demo w D-071 („2 h”, nie „2 h 0 min”), odnośnik do §3.
- Bez zmian: przewijanie tabel 800–1000 px w ich własnym pasku (jak inne ekrany Opcji); wpis w Historii zmian w demo (jak Progi alarmów).

**Testy:**
- `tests/status-pill.test.ts` — przepisany na D-071 (8 przypadków, w tym `etaDuration`);
- `tests/w-eta-calib.test.ts` — 13: pomiary z dostarczonych transportów, pominięty pomiar, reguła 5 dostaw / 10 % / mediana, kody `eta_segment_params`, treść wersji z tych samych median, podgląd bez przycisku dla Operacji, produkcja bez źródła;
- `tests/w-demo.test.ts`, `tests/status-pill.test.ts` — teksty spraw ETA i pigułka w D-071 z minusem „−”;
- unit: 1540 zielonych; e2e telefon (E8) — wszystkie ekrany Opcji, w tym nowy, 0 w bramie, także przy 1280 px.

**Teksty z serwera** (e-maile, SMS, tytuły spraw) z tym samym formatem — wykonawca w P4-u (D-20261017-0730-01 §3 pkt 3).
