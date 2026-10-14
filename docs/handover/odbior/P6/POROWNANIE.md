# Odbiór P6 — wygląd, część a: strona Ryzyka (koordynator, `wyglad/P6-a`)

Podział pracy: D-20261013-1835-01 (FRONT-KOORDYNATOR). Wzór: raport audytu `docs/handover/audyt_claude_2026-10-08/raport/` (konstytucja VIII, WYGLAD-RAPORT), dowód według Z3, Z4, Z10 i Z11 (D-20261013-1550-01).
Polecenie właściciela 14.10.2026, 20:48 („opracuj kolejny etap po swojej stronie”). Zakres z `PLAN.md` §4 P6, ekrany: Ryzyka / Do zrobienia (komputer i telefon), Kokpit (liczba). Panel transportu (Historia, Czat — E17) — część b, osobna gałąź `wyglad/P6-b`.

Ten PR zmienia tylko wygląd i nawigację (F8). Nie zmienia migracji, uprawnień ani zapisów. Nie dodaje zapytań:
- decyzje: to samo zapytanie `decisions` i te same funkcje `decision_resolve` i `decision_snooze`, przeniesione z dawnego Centrum decyzji do `src/components/risks/useDecisions.ts`;
- rejsy, morze (`marine_conditions`) i drogi SE (`corridor_conditions`) — jak dotąd;
- komunikat armatora (`OperatorNoticeForm`) — ten sam formularz.

Jedna zmiana w danych aplikacji: przy ryzyku zostaje rodzaj z bazy (`kind`, już pobierany). Potrzebny do nazw spraw (E7-4), zakazów ruchu i spraw technicznych.

Nowe dane biorą się z `src/lib/p6Source.ts`:
- w demo przykłady z `src/lib/p6Demo.ts`, wołane tylko za warunkiem trybu demo (strażnik I-0, test `p6-todo`);
- w produkcji `null` albo pusta lista. Wtedy przycisków i sekcji bez danych nie ma: osoby i telefony, przydział „Biorę tę sprawę”, historia sprawy, drogi PL z HERE.

Co podłącza wykonawca — dopisek D-20261014-2145-01.

Zrzuty z podglądu demo, „teraz” = 14.10.2026, 12:00, folder `wyglad-P6-a/`. Osoby, telefony (pula fikcyjna +48 000 000 0xx), decyzje, rejsy i zakazy w demo są zmyślone (G-09).

## Z3 — element po elemencie

### Do zrobienia (E7 pkt 1–3, 9; E6; E7-2) — `porownanie-e7-ryzyka.png`, `porownanie-e6-sprawa.png`

| element | obraz raportu / decyzja | po zmianie w aplikacji | zgodne | uwagi |
|---|---|---|---|---|
| nagłówek | „Do zrobienia 23 · ta sama liczba w menu, w Kokpicie i w dzwonku” | to samo; liczba z `todoQueue` — ta sama co w menu i w Kokpicie | tak | liczba = karty: jedna na transport, jednakowe sprawy bez transportu razem (E7 pkt 1–3) |
| filtry | Moje · Moja firma · Wszystkie N; „Najpilniejsze najpierw” | to samo; zakres domyślny = ten, który liczy menu (Administrator HHL — Wszystkie, reszta — Moja firma) | tak | „Moje” tylko z podłączonym przydziałem (w produkcji ukryte do podłączenia) |
| karta transportu | pasek koloru, „SG-05 · 15065/2026/OSL/GDA/P”, status i daty, „2 SPRAWY” | to samo; zwinięta — nazwy spraw; rozwinięta — status, załadunek („minął”), dostawa | tak | nazwa według E41 dla firmy |
| sprawa w karcie | nazwa, kto decyduje / uzupełnia, „nikt nie wziął”; „☎ SCX”, „Otwórz awizację”, „Biorę tę sprawę”, „Uzupełnij” | to samo; „Wgraj” przy braku dokumentu, „Otwórz transport” przy sytuacji na trasie | tak | — |
| karta sprawy (E6) | transport, decyduje (firma i rola), przypisana do, „Zadzwoń w tej sprawie” z telefonami, historia | to samo pod „Szczegóły”; Operacje HHL „gdy przewoźnik nie odbiera”; w produkcji opcje rozstrzygnięcia z katalogu decyzji i „Odłóż o 2 h” | tak | osoby, telefony i historia — wykonawca |
| „Biorę tę sprawę” (E6-5) | biorący widzi „Oddaj”, inni z firmy „Przejmij” z potwierdzeniem | to samo; wpis w historii sprawy | tak | zapis (`decision_assign`) — wykonawca |
| zakaz ruchu | „ⓘ Informacja: zakaz ruchu w SE w dniu przejazdu 10.10 (nie liczy się)” | to samo | tak | zakazy bez transportu w bazie (`detail.loadId`) — lista „Zakazy ruchu” w „Sytuacji na trasie” |
| karta bez transportu | „Opłata paliwowa SEFS … 12 jednakowych zgłoszeń z 04.10 połączone w jedno”, „Biorę tę sprawę” | to samo; łączy tylko tę samą treść | tak | — |
| reszta kart | „… 19 kolejnych transportów · ROZWIŃ” | „… jeszcze N kart · ROZWIŃ” | tak | pierwsze 4 karty od razu |
| dopłata (G-22) | pozycja „Do zrobienia” otwiera okno „Dopłata” | to samo (okno z P5) | tak | demo; produkcja — po podłączeniu podpowiedzi (P5) |
| „czy dostarczono?” (L14) | karta sprawy w Ryzykach | ta sama karta co w panelu transportu | tak | — |

### Sytuacja na trasie (E7 pkt 4, 6, 7; PLAN 8.4 / E7-5; E2) — `porownanie-e7-ryzyka.png`

| element | obraz raportu / decyzja | po zmianie w aplikacji | zgodne | uwagi |
|---|---|---|---|---|
| nagłówek | „Sytuacja na trasie · bez dzwonka” | to samo | tak | — |
| promy dziś | wiersz na rejs: port, statek, godzina, trasa, „MOŻLIWE ODWOŁANIE”, fala i porywy z progami, godzina pomiaru; na pokładzie N | to samo z rozkładu (`sailings`) i pomiaru (`marine_conditions`); przy braku dzisiejszego rejsu — najbliższy | tak | atrybucja danych morskich pod listą (CC BY 4.0) |
| druga przeprawa (8.4) | propozycja rejsów drugiej przeprawy przy odwołaniu albo sztormie | do 3 najbliższych odejść z rozkładu; sztorm na obu — „bez propozycji”; brak rozkładu — „Brak danych”; „Rejs rezerwuje Scandinavian Express” | tak | zastępuje statyczną listę przepraw i „Przelicz” |
| ostrzeżenia rejsów, pogoda | — (dawna lista ryzyk) | ryzyka promów i pogody bez transportu jako listy w „Sytuacji na trasie” | tak | nic nie znika ze strony |
| drogi PL | „Drogi PL · HERE”, brak danych do E2 | to samo; dopóki brak HERE — dawne wpisy dróg PL z bazy | tak | E2 — wykonawca |
| drogi SE | najpierw bardzo duży i duży wpływ, po polsku, z miejscem; „Pokaż wszystkie 40” | to samo; „przetłumaczone ze szwedzkiego” z oryginałem; spowolnienie trasy z Trafikverket | tak | godziny od–do — gdy źródło je poda |
| system (tylko HHL) | „4 testowe SMS … Przeniesione do Opcje › Stan systemu” | liczba i lista spraw technicznych, „Otwórz Stan systemu” | tak | — |

### Telefon (E7, E8) — `porownanie-e7-telefon.png`

| element | obraz raportu / decyzja | po zmianie w aplikacji | zgodne | uwagi |
|---|---|---|---|---|
| zakładki | „Do zrobienia 23 · Na trasie · System” | to samo; „System” tylko HHL (E7-3); strzałki, Home, End | tak | — |
| karty | „SG-05 · 15065”, liczba spraw, przyciski pod tekstem | to samo | tak | cele ≥ 44 px |
| KSH | — | bez listy spraw (E9), tylko sytuacja na trasie | tak | — |

## Różnice, które zostają

| różnica | gdzie | zamyka |
|---|---|---|
| liczba w menu bez decyzji, dopłat i spraw L14 — w produkcji karta tylko z decyzją (np. SEFS) podnosi „Wszystkie” ponad nagłówek | menu, Kokpit, dzwonek | wykonawca (E7-2: decyzje w `todoQueue`) |
| osoby, telefony, przydział, historia sprawy — tylko demo | karta sprawy | wykonawca |
| zakazy ruchu z transportem tylko w `detail.loadId` | Ryzyka, panel | wykonawca (mapowanie `detail.loadId`) |
| samozamykanie, „przed pojazdem”, łączenie braków w jedną sprawę awizacji (E7 pkt 3, 5) | Do zrobienia | wykonawca |
| drogi PL z HERE (E2) | Sytuacja na trasie | wykonawca |
| godziny od–do przy drogach SE | Sytuacja na trasie | wykonawca (gdy źródło poda) |

## Ograniczenia w interfejsie (do wiadomości wykonawcy)

| co | gdzie | dlaczego |
|---|---|---|
| bez „Centrum decyzji” jako osobnej listy — decyzje w kartach „Do zrobienia” | Ryzyka | E7 pkt 1 |
| bez statycznych przepraw (TT-Line, Unity Line) i „Przelicz”, bez objazdów SE „Wybierz” | Ryzyka | E7-5 — tylko z rozkładu; rejs rezerwuje SCX |
| KSH bez listy spraw | Ryzyka | E9 |
| komunikat armatora pod „Komunikat armatora (wpis ręczny)” | Promy dziś | to samo prawo co dotąd (`canFileOperatorNotice`) |

## Konta (Z11)

| konto | zrzuty | różnica |
|---|---|---|
| HHL Administrator | `ryzyka-1440-hhl*`, `telefon-390-hhl-*` | wszystkie sprawy, zakładka System |
| HHL Operacje | jak HHL w demo | zakres domyślny „Moja firma” (sprawy HHL) |
| KSH Użytkownik | `ryzyka-1440-ksh`, `telefon-390-ksh-ryzyka` | tylko sytuacja na trasie |
| SCX Dyspozytor i Użytkownik | `ryzyka-1440-scx*`, `telefon-390-scx-*` | sprawy SCX, „Biorę tę sprawę” przy swoich, bez Systemu |

## Sprawdzenia (lokalnie, podgląd demo)

- `tsc -b`: 0 błędów; `lint:css`: 0 błędów.
- `test:unit`: wszystkie przechodzą. Nowy test `p6-todo`: karty, zakazy, łączenie, filtry, liczba = menu na danych demo dla trzech rodzajów kont, druga przeprawa, drogi, strażnik I-0.
- Pierwsze wczytanie: 382,4 kB gzip (budżet 400 kB) — Ryzyka ładują się leniwie.
- Brama E8 (nowy blok P6: komputer HHL i SCX, telefon HHL, SCX, KSH przy 360 / 390 / 430 px) i całe `e8-phone-gate`; `d-eur-t`, `etap6-ui` (O4: oznaczenie demo dróg SE), `etap4-ui`, `etap5-ui`, `e2e-core` i reszta zestawów.
- Niezależne sprawdzenie (osobny agent): wynik i poprawki w opisie PR.
- Przepisane testy:
  - `p3b-cockpit-e9` (liczba = karty, E7);
  - `i2-facade` (bez statycznych przepraw i objazdów, 11 → 9);
  - `e21-guardian` (pliki strony Ryzyka zamiast Centrum decyzji);
  - lokalny `i2-facade.local` (druga przeprawa tylko przy odwołaniu albo sztormie).

---

# Odbiór P6 — wygląd, część b: panel transportu, Historia i Czat (koordynator, `wyglad/P6-b`)

Podział pracy i wzór — jak w części a. Etap E17 (decyzje 07.10, 20:57: „Ustalenia” = „Czat”, rozmowa „tylko HHL i SCX”, KSH pisze do wszystkich i jej nie widzi, profil trasy ukryty), obraz `img/e17-after`. Do tego E41 (KSH bez numerów zleceń), E6 (autor „Imię Nazwisko // Firma”), D-83 (przewoźnik nie wpisuje wymiarów), decyzja 09.10 (piloci w awizacji SCX — P7).

Ten PR zmienia tylko wygląd i nawigację (F8). Nie zmienia migracji, uprawnień ani zapisów:
- wysyłka wiadomości — ten sam zapis (`message.send` z `{loadId, text}`); wybór „tylko HHL i SCX” zostaje w stanie aplikacji (demo);
- lista pilotów (`EscortPanel`) — ten sam komponent i te same zapytania, w Przeglądzie zamiast w „Ustaleniach” (ładuje się przy otwarciu panelu przez SCX i KSH);
- historia — te same zdarzenia, które aplikacja ma dziś.

Nowe dane: `src/lib/p6bSource.ts` (demo: `src/lib/p6bDemo.ts`, za warunkiem trybu demo — strażnik I-0, test `p6-history`). W produkcji wybór „tylko HHL i SCX”, „przeczytali” i liczba nieprzeczytanych są wyłączone do podłączenia (dopisek D-20261014-2300-01 H2). Co podłącza wykonawca — ten dopisek.

Zrzuty z podglądu demo, transport SG-01, „teraz” = 14.10.2026, 12:00, folder `wyglad-P6-b/`. Osoby i wiadomości w demo są zmyślone (G-09).

## Z3 — element po elemencie

### Historia (E17 pkt 2) — `porownanie-e17-komputer.png` (lewa kolumna), `porownanie-e17-telefon.png`

| element | obraz raportu / decyzja | po zmianie w aplikacji | zgodne | uwagi |
|---|---|---|---|---|
| filtry | Wszystko · Statusy i trasa · Zasoby i awizacja · Numery · Dokumenty · Ceny | to samo; KSH bez „Numery” (E41) | tak | telefon: przewijane w bok, „Zasoby” |
| dni | „07.10.2026 · ŚRODA”, najnowsze na górze | to samo | tak | — |
| wpis | godzina, rodzaj (STATUS, TRASA, ZASOBY, NUMER, PRÓBA, IMPORT), „~~było~~ → **jest** · przyczyna” | to samo | tak | telefon bez znacznika rodzaju (jak w raporcie) |
| autor | „Imię Nazwisko // Firma”, „H&H Logistics (zapis bez osoby)”, „System // Watch Tower · GPS emtrack”, „GPS emtrack” | to samo | tak | „AIS” przy pozycji z AIS |
| strefa | „Wjazd w strefę „Bufor 50 km przed Boden”” | to samo (nazwa z wpisu albo z listy stref) | tak | bez nazwy — „(strefa bez nazwy)”, nigdy kod |
| numer zlecenia | „Nr zlecenia SCX: — → 15062/…” | z wartością poprzednią — tak samo; z dzisiejszego zapisu (sama notatka) — „Nr zlecenia SCX: **…**” | tak | wartości poprzedniej, której zdarzenie nie ma, nie zgadujemy (do wyzwalaczy H1) |
| ukryte | „5 dawnych zapisów bez zmiany ukrytych (…)” | to samo, liczba w bieżącym filtrze | tak | ukryte: „było = jest”, „Gotowy → Gotowy”, powtórzenie tego samego zapisu, „rejs usunięty” bez rejsu |
| bez kodów | 15 rodzajów zdarzeń z polską nazwą | każdy rodzaj z ograniczenia bazy (0205) ma polską nazwę; notatki automatów z kodami — po polsku albo bez | tak | test `p6-history` |
| ceny | KSH bez ceny SCX i marży, SCX bez ceny KSH i marży | to samo; cena bez oznaczonej strony — tylko HHL | tak | — |

### Czat (E17, 20:57) — `porownanie-e17-komputer.png` (środek i prawa), `porownanie-e17-telefon.png`

| element | obraz raportu / decyzja | po zmianie w aplikacji | zgodne | uwagi |
|---|---|---|---|---|
| nazwa zakładki | „Czat” (dawniej Ustalenia) | to samo; liczba nieprzeczytanych przy nazwie | tak | w produkcji liczba po podłączeniu odczytów (H2) |
| wiadomości | po dniach; moje po prawej, cudze po lewej; „Imię Nazwisko // Firma · godzina” | to samo | tak | „moje” = mojej firmy do czasu `author_id` (H2 pkt 3) |
| odczyt | „✓✓ przeczytali: SCX, KSH”, „✓ wysłane · nikt z SCX i KSH jeszcze nie otworzył” | to samo; częściowo — „przeczytali: SCX · KSH jeszcze nie” | tak | produkcja — po zmianie oznaczania odczytu (H2 pkt 2) |
| „tylko HHL i SCX” | „Widzą: HHL, SCX, KSH / tylko HHL i SCX”; KSH bez wyboru i bez tych rozmów | to samo; wiadomość ze znacznikiem „tylko HHL i SCX” | tak | produkcja — po podłączeniu `visible_to` (H2 pkt 1) |
| pole pisania | na dole, „Napisz do HHL, SCX i KSH…”, „Wyślij”, podpowiedź „Enter wysyła · Shift+Enter nowa linia …” | to samo; telefon: „Napisz…”, przyklejone na dole | tak | — |
| bez innych przycisków | „Znika z czatu: link dla kierowcy · Przypisz SCX · Oznacz … · Wymiary zestawu u SCX · dane zasobów i awizacji” | to samo — w Czacie tylko wybór odbiorców i „Wyślij” | tak | test E8 i `p6-history` |

### Przegląd (E17 pkt 5; E32 — do P7) — `przeglad-1440-hhl.png`, `przeglad-1440-ksh.png`

| element | obraz raportu / decyzja | po zmianie w aplikacji | zgodne | uwagi |
|---|---|---|---|---|
| profil trasy | ukryty u wszystkich, bez wywołania `route-profile` | to samo | tak | funkcja i tabela — E18 P16 |
| piloci | w awizacji SCX (09.10, P7) | lista pilotów z „Ustaleń” w Przeglądzie (SCX, KSH jak dotąd) | częściowo | do okna awizacji w P7 |
| prom i awizacja | E32 „Awizacja · uzupełnia SCX” | wiersz „Prom” z przypłynięciem i stanem rejsu, wiersz „Awizacja” (okno · potwierdzona / „brak · uzupełnia SCX”) | częściowo | to, co KSH widział w „Ustaleniach”; pełny Przegląd E32 — P7 |

## Z4 — różnice, które zostają

| różnica | gdzie | dlaczego |
|---|---|---|
| wybór „tylko HHL i SCX”, „przeczytali” i liczba nieprzeczytanych tylko w demo | Czat | dane (H2): zapis `visible_to`, odczyt po otwarciu zakładki |
| „moje” = mojej firmy | Czat | brak autora w odczycie (H2 pkt 3) |
| numer z dzisiejszego zapisu bez „było” | Historia | dziś zapis bez wartości poprzedniej (H1) |
| historia z 500 ostatnich zdarzeń wszystkich transportów | Historia | zapytanie po jednym transporcie (H1 pkt 3) |
| nagłówek panelu ze „✕” zamiast strzałki na telefonie | panel | E32 / P7 |

## Konta (Z11)

| konto | zrzuty | różnica |
|---|---|---|
| HHL Administrator i Operacje | `historia-*-hhl`, `czat-*-hhl`, `przeglad-1440-hhl` | wszystkie wpisy; wybór odbiorców |
| SCX Dyspozytor i Użytkownik | `historia-*-scx`, `czat-*-scx` | bez ceny KSH i marży; wybór odbiorców |
| KSH Użytkownik | `historia-*-ksh`, `czat-*-ksh`, `przeglad-1440-ksh` | bez numerów zleceń i „Numery”; bez rozmów HHL ↔ SCX; bez wyboru odbiorców |

## Sprawdzenia (lokalnie, podgląd demo)

- `tsc -b`: 0 błędów; `lint:css`: 0 błędów; gitleaks: 0.
- `test:unit`: 1054 przechodzi, 37 pominiętych. Nowy test `p6-history` (21): wpisy po polsku, każdy rodzaj zdarzenia z 0205, ukryte i powtórzenia, KSH bez numerów, ceny według strony, Czat (widoczność, nieprzeczytane), demo i strażnik I-0.
- Brama E8: nowy blok P6-b (komputer HHL i KSH; telefon HHL, SCX, KSH przy 360 / 390 / 430 / 768 px) — 4 / 4. Cały zestaw Playwright: 113 przechodzi; 3 nie przechodzą tak samo na `main` (lokalne czcionki w zrzutach `visual` i `visual-states`, `d19-i18n` — „lang missing: en”) — w GitHub Actions decyduje `visual`.
- Pierwsze wczytanie: 385,2 kB gzip (budżet 400 kB); Historia i Czat ładują się leniwie.
- Przepisane testy: `aud03-ksh-panel` (test i spec), `etap4-ui` (awizacja z Przeglądu), `iii4-escorts.local` (piloci w Przeglądzie), `bk5-api.live`, `scripts/data/e2e-data.mjs` (zakładka „Czat”).
