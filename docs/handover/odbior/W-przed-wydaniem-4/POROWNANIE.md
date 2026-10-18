# W-przed-wydaniem-4 — 39 usterek z niezależnego przeglądu całej aplikacji + daty Administratora HHL

Koordynator (Claude), 19.10.2026. Gałąź `wyglad/W-przed-wydaniem-4`, odchodzi od #304 (e71a406) — **scalić po #304**.

Zakres (F8): dane demo, obliczenia widoku, teksty, wygląd i testy. Bez bazy. Część bazy decyzji 19.10, 00:01 jest dla wykonawcy w D-20261019-0005-01 §2.

## Podstawa
- **Przegląd całej aplikacji demo** przez niezależnego agenta (18.10, 22:45):
  - 3 firmy × 1440 i 390, motyw ciemny, 22 ekrany Opcji, panel SG-23, T-12, D-01 i SG-09;
  - 39 znalezisk: 5 B, 23 P, 11 D.
- **Polecenie właściciela 18.10, 23:13:** „poprawisz wszystkie 39”.
- **Decyzja właściciela 19.10, 00:01:** Administrator HHL zmienia każdą datę bez ograniczeń (D-20261019-0005-01).
- **F7 #304 runda 3** — dwa punkty P (test przez `deliveredCheckOf`, zdanie o T-18 w POROWNANIE W-demo-strefy).

## Wynik — 39 znalezisk

| # | było | jest |
|---|---|---|
| 1 B | SG-09: sprawy „Brak kierowcy i numerów”, dzwonek „Brak naczepy”, a panel ma kompletny zestaw | SG-09 i SG-18: status „Brak dokumentów” (brakuje tylko zezwolenia). „Brak kierowcy i numerów” tylko przy transportach bez zestawu (SG-19, SG-30). Dzwonek „Brak kierowcy i zestawu” i decyzja „Brak awizacji” przy SG-19. Sprawa po terminie przy SG-34 (załadunek jutro, brak zezwolenia). Zezwolenia firmowe SG (PL, SE) ważne do 24.09 — podpięte same do 28 transportów; SG z załadunkiem od 25.09 (SG-36, SG-09, SG-18 …) czekają na nowe zezwolenie, stąd „Brak zezwolenia” (F7 P1) |
| 2 B | ten sam kierowca, ciągnik albo naczepa w 2–3 transportach naraz (ok. 30 par) | `deconflictResources`: okres zajęcia = załadunek … rozładunek + 3 dni powrotu. Transporty w drodze i na placu zachowują zestaw, pozostałe dostają wolny z puli (numery fikcyjne, I-2). 0 nakładań |
| 3 B | Strefy: plac „teraz w strefie: 0”, Kokpit „3 na placu” | T-12 i T-18 stoją w strefie placu. D-01 po wyjeździe 16:07 stoi tuż za strefą („czy dostarczono?”). Strefy: „teraz w strefie: 2” |
| 4 B | prom Nova Star 23.09, 18:00: Kokpit „fala 1,4 m · niskie”, Ryzyka „3,2 m · możliwe odwołanie” | jedna prognoza: 3,2 m, ryzyko wysokie (Kokpit, pasek, Ryzyka). |
| 5 B | Strefy i Automatyzacje: zdarzenia z października (SG-03 dostarczony 07.10) | daty przed zegarem demo. Zdarzenia z T-11 (dostarczony 22.09) i SG-24, ostatnie zdarzenia stref jak Mapa (D-01 16:07, SG-32 13:40, SG-28 07:42) |
| 6 P | Opcje: logowania, zaproszenia, Dopłaty — daty z października | przed 23.09, 16:32 (zaproszenie ważne do 29.09, szkic komunikatu na 24.09) |
| 7 P | Ryzyka: „ta sama liczba … w dzwonku” (23 vs 16) | „ta sama liczba w menu i w Kokpicie”. Dzwonek liczy powiadomienia, nie sprawy |
| 8 P | dzwonek „Faktura w sporze · t38 — SG-04” | „Faktura do sprawdzenia · t38 — różnica 180,00 PLN” (stan z Faktur) |
| 9 P | dzwonek „Marża poniżej progu SG-15”, Finanse „0 poniżej progu” | 4 transporty „poniżej progu” z marżą ok. 3 % (próg demo 4 %). Finanse: 4 |
| 10 P | T-01, SG-31 „Opóźniony” z ETA przed oknem | „Opóźniony” tylko gdy ETA po sile wyższej wypada po oknie dostawy |
| 11 P | SG-14 „+3 h” obok „+1 d 4 h 27 min po oknie” | tytuły sił wyższych „… · dolicza 3 h do przyjazdu” |
| 12 P | „do zafakturowania” 0 / 1 / „nic do wystawienia” | SCX Kokpit = kafel „Czeka na wystawienie” w Fakturach (zamknięte tygodnie) |
| 13 P | zafakturowane i opłacone dalej „Dostarczone”, „Rozliczenie 0” | transport na obu fakturach: „Zafakturowano”. Widoki pytające o „Dostarczone” liczą też „Gotowe do fakturowania” i „Zafakturowano” (`isAfterDelivery`; dotyczy też produkcji) |
| 14 P | Harmonogram vs Finanse: marża Tężników różna o 41,48 EUR | Harmonogram: przychód i marża po fakturze, gdy jest (jak Finanse). Tężniki 21 063,46 EUR w obu |
| 15 P | Mapa „bez pozycji 0” obok „Brak GPS 5” | „bez żadnej pozycji 0” — inna rzecz niż „Brak GPS” (pozycja była, przestała przychodzić) |
| 16 P | Ryzyka „na pokładzie: 1”, Mapa „Prom 6” | „na pokładzie” = transporty w etapie Prom, także opóźnione na statku (SG-03) — 6 jak Mapa |
| 17 P | D-01 „Na placu od 15:10” obok wyjazdu 16:07 | #304: wjazd 16:01, wyjazd 16:07 |
| 18 P | oś „Na placu — plan”, SG-23 „pominięte” | #304: zdarzenia strefy placu |
| 19 P | 300 km w 50 min (Śrem 09:40 → bufor Gdańsk 10:30) | bufor 13:40 |
| 20 P | Ceny „śledzenie od Szwecji”, a oś ma GPS w Polsce | „w czasie wolnym — bez dopłaty (wyjazd ze strefy 09:40)” |
| 21 P | zakaz ruchu 25.09 przy SG-09 (załadunek 05.10) | zakaz tylko przy transportach w drodze w ten dzień |
| 22 P | „Rejs: Wawel · rejs niewybrany” | „Wawel · dzień i godzina rejsu jeszcze niewybrane — wybiera SCX w awizacji” |
| 23 P | zezwolenia firmowe od 01.10 przy wrześniowych transportach | ważne 01.09–24.09.2026 (patrz #1) |
| 24 P | autor „workflow:wf-2” | „System // Watch Tower” (także produkcja) |
| 25 P | Użytkownicy „0 z telefonem” | liczniki z tej samej listy (5 z telefonem) |
| 26 P | Ryzyka: „seed makiety … (D18)”, „Po podłączeniu…” | „— to przykład w wersji pokazowej…”, „Brak komunikatów o utrudnieniach na drogach w Polsce. Źródło: HERE…” |
| 27 P | Faktury: EUR bez waluty obok PLN | kwota zawsze z walutą (lista, karta, szczegóły) |
| 28 P | „OCP-0000-PRZYKLAD” | numery demo jak prawdziwe (G-09: zmyślone) |
| 29 D | „usunięty 22.10.2026” (data w przyszłości) | „zostanie usunięty …” |
| 30 D | „+180-⏎240 min”, „50⏎km”, „225,00⏎EUR”, „12 h” | twarda spacja między liczbą a jednostką (km, h, min, m/s, EUR, PLN) w tekstach. Zakresy połączone |
| 31 D | „1 — faktury HHL czekają” | „1 faktura HHL czeka” (odmiana) |
| 32 D | „Rozmiar L × W × H” | **bez zmian (N)**: Harmonogram w układzie pliku KSH (E38 1A), nagłówek kolumny z pliku |
| 33 D | Strefy: „(dziś „Histereza”)”, „powód: — (wtedy pola nie było)” | bez tekstów roboczych, „bez podanego powodu”. „Auto 50 km przed placem / przed Śremem” — **N**: to nazwa jednego zdarzenia w „Kto co dostaje” |
| 34 D | „Opcje › Progi”, „Przeglądzie i awizacji” | „Opcje › Progi alarmów”, „W zakładce »Przegląd«”. Telefon „Polferries 18:00” — **N**: na telefonie dwie linie (Stena, Polferries) obok siebie |
| 35 D | „kurs tymczasowy · 60” | „kurs tymczasowy · 60 transportów” |
| 36 D | „bez pingu”, „ostatni ping” | „bez nowej pozycji”, „ostatnia pozycja” |
| 37 D | „+37 000 000 002” | „+370 000 000 02” — długość kodu kraju według E.164: 1 cyfra (+1, +7), 3 cyfry (+370, +358, +420, +972 …), reszta 2 (także produkcja) |
| 38 D | edytor terminu CMR: „24” + „h · po „Dostarczone”, do 24 h” | „24” + „h · po „Dostarczone”” |
| 39 D | D-01 „Ładunek: D · 7 szt.” | „Stężenia międzysłupowe · D · 7 szt.” |

Opcje › Opłata paliwowa: data „dziś 14.10.2026” była tylko w teście jednostkowym. W aplikacji ekran bierze zegar demo, więc bez zmian.

## Daty bez ograniczeń dla Administratora HHL (decyzja 19.10, 00:01)
- **„Zmień status”**: Administrator HHL wpisuje dowolną datę i godzinę.
  - Nie obowiązują blokady „nie wcześniej niż poprzedni status” ani „nie w przyszłości”.
  - Tekst zasad jest osobny dla Administratora HHL.
- **„Daty KSH”**: „Edytuj” także u Administratora HHL. Zapis działa po każdym etapie i w dowolnej kolejności.
- KSH, SCX i Operacje HHL — bez zmian.
- Na produkcji zadziała po części bazy (D-20261019-0005-01 §2).

## F7 runda 1 (niezależny przegląd 19.10, 00:58) — niegotowe, 0 B, 5 P; poprawione
- P1: zezwolenia firmowe a „Brak zezwolenia” przy SG — patrz #1 i #23.
- P2: „na pokładzie” po etapie Prom — patrz #16.
- P3: bez dat po zegarze demo: Automatyzacje › Historia („decyzja właściciela”), Opcje › Kto co dostaje „zawsze — decyzja właściciela” (tekst także na produkcji).
- P4: opis PR uzupełniony o #12, #14, #29, #31, #38, #39.
- P5: e2e i zrzuty powtórzone na buildzie z HEAD.
- D1: kody kraju 1 i 3 cyfry (test `phone-display`). D2: twarde spacje w 4 tekstach i łączniki w zakresach objazdów. D6: po zapisie dat przez Administratora HHL „Zapisano daty i godziny — zmiana jest w Historii transportu.”. D7: T-11 — wyjazd z bufora 40 min po placu, sprawa postoju w trakcie postoju.
- Bez zmian (N): D4 — Kokpit liczy etap „Plac” (D-01 po wyjeździe czeka na „czy dostarczono?”), Strefy liczą auta w strefie; D8 — karta „czy dostarczono?” dotyczy tylko transportów przed „Dostarczone”; D9 — do czasu części bazy D-20261019-0005-01 §2 zapis Administratora HHL po załadunku odrzuci baza dzisiejszym komunikatem (w kolejce Cursora tuż po D-1740).

## F7 runda 2 (19.10, 01:50) — 0 B, 1 P; poprawione
- P-A: SG-29 (załadunek 24.10) był „Gotowy” bez ważnego zezwolenia — teraz „Brak dokumentów”, jak SG-09 i SG-18.
- D-A: numery z 10 cyframi po kodzie kraju bez pojedynczej cyfry na końcu („+1 202 555 01 00”).
- D-C: T-11 — wjazd do bufora 50 min przed placem (granica bufora ok. 60 km drogą).
- D-F: liczba testów w opisie PR. D-G: „zdjęty po 5 s” z twardą spacją.
- Bez zmian (N): D-B — „28 · podpięte samo” liczy też SG-07 i SG-34: zezwolenie jest podpięte, ale nie obejmuje zestawu („niezgodne z zestawem”), stan sprzed PR; D-D — ważność w `attachmentDocForLoad` to osobna ścieżka sprawdzania „Gotowy”, w demo zablokowana wcześniej przez brak dokumentów; D-E — „Firma — podpina się samo” opisuje rodzaj zezwolenia, stan „brak” stoi obok.

## Testy
- Unit: 1637 przechodzi, 35 pominiętych (199 plików). Nowe testy: `tests/admin-dates.test.ts` i rozszerzony `tests/p11-demo-strefa-placu.test.ts` (8 przypadków).
- Zmienione oczekiwania — każda zmiana wynika z poprawki:
  - `voyage` (fokus 23.09);
  - `audyt-af`, `audyt-c`, `p11-demo-spojne`, `p3b-cockpit-e9`, `p8d-rules`, `p5b-money`, `audyt-e-opcje`, `w-eta-calib`, `p9c-map`;
  - teksty z twardą spacją porównywane po normalizacji.
- e2e (etap4/5/6, aud03, e8, d-eur-t, persist-toast, aud01e) — wynik lokalny w PR.
- Bramy z #301 (E20, E21, E10) na scaleniu z `wyglad/W-bramy-reguly` — wynik w PR.
