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
