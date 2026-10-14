# Odbiór P4 — wygląd (koordynator, `wyglad/P4`)

Podział pracy: D-20261013-1835-01 (FRONT-KOORDYNATOR). Wzór: raport audytu `docs/handover/audyt_claude_2026-10-08/raport/` (konstytucja VIII, WYGLAD-RAPORT), dowód według Z3, Z4, Z10 i Z11 (D-20261013-1550-01).
Logikę i bazę P4 robi wykonawca w PR #181 (`pakiet/P4-statusy-sledzenie`).

Wygląd P4 ma dwie części:
- **P4-a** (ten dokument): pasek etapów E28, filtry Harmonogramu i Mapy, okno śledzenia na Mapie (E27), oznaczenia obok statusu (L7).
- **P4-b:** panel transportu — zakładka Status z osią i oknem „Zmień status” (E25), pasek śledzenia w panelu (E27), blok ETA (E15), pole „Link śledzenia” i opis lokalizatora (E44). Zrobię go po scaleniu PR #181, bo ten PR zmienia `LoadDrawer.tsx` i dodaje `StatusChangeModal.tsx`.

## wyglad/P4-a — pasek etapów, Harmonogram, Mapa, oznaczenia statusu

Obrazy raportu:
- `raport/img/e28-after.webp` — pasek na komputerze z filtrem „Plac Boden”, tabela kliknięć, telefon;
- `e27-after.webp` — Mapa: „W trasie: 0”, chipy, najbliższe włączenia śledzenia;
- `e8-after.webp` — Harmonogram na telefonie: „Transporty 94 | Rejsy”, szukajka, „⋯”;
- makieta `makiety_html/E28/pasek.html`.

Zakres z `PLAN.md` §4 P4: „E28 pasek etapów: 10 kafelków, tylko liczba, jeden filtr, kliknięcie (Harmonogram filtruje, inne strony → Mapa)”, „oznaczenia Opóźniony / Brak GPS / Brak dokumentów obok statusu (L7)”, E27 (Mapa), ekrany: „pasek etapów (Kokpit, Harmonogram, Mapa), znaczniki statusów”.
Zrzuty z demo, zamrożony czas 07.10.2026, 20:00. Liczby w demo są inne niż na obrazie (obraz: baza 07.10, 20:00); układ, nazwy i zachowanie są te same.

### Z3 — element po elemencie

| element | obraz raportu | po zmianie w aplikacji | zgodne | uwagi |
|---|---|---|---|---|
| pasek — kafelki | 10: Przygotowanie, Załadunek, Droga PL, Port PL, Prom, Port SE, Droga SE, Plac Boden, Dostarczone, Rozliczenie | to samo | tak | dawne 9 kafelków (Gdańsk, Nynäshamn, Boden) znika |
| pasek — grupy | PRZYGOTOWANIE · W TRASIE · ŚLEDZENIE · PO DOSTAWIE nad kafelkami (1 : 7 : 2) | to samo | tak | — |
| pasek — kafelek | nazwa 12,5 px, liczba 28 px, bez linii podpowiedzi; zero wyszarzone | to samo; wysokość 62 px | tak | zero w kolorze `--plan` (#6C7D8A), bo jasnoszary z makiety (#9AAAB6) nie spełnia kontrastu 3 : 1 |
| pasek — kolor nad kafelkiem | Przygotowanie szary, Prom morski, Plac Boden i Dostarczone zielony, Rozliczenie bursztynowy | to samo | tak | pasek 3 px rysowany elementem `::before` (cień jest zabroniony regułą stylów) |
| pasek — włączony | ciemny kafelek, biała liczba, „✕” po prawej | to samo; w ciemnym motywie jasny kafelek z ciemnym tekstem (jak inne przełączniki) | tak | — |
| przypisanie | według statusów E25; „Na placu” → Plac Boden (nie Nynäshamn), „Rozładowany” → Dostarczone | to samo (`src/lib/stageTiles.ts`) | częściowo | Port SE: aplikacja nie ma jeszcze osobnego statusu dla portu SE (baza `AT_PORT_NYNASHAMN` → `IN_TRANSIT_SE`, `src/data/mappers.ts`), więc w produkcji port SE liczy się jako Droga SE — dopisek D-20261014-0315-01 H1; kafelek przyjmie `AT_PORT_SE` bez zmian wyglądu |
| kliknięcie | Harmonogram — na miejscu; Mapa — na miejscu; Kokpit, Ryzyka, Dokumenty, Finanse, Faktury, Strefy, Opcje → Mapa z filtrem | to samo | tak | drugi klik, „✕” albo Escape zdejmuje filtr |
| każda firma | liczy tylko swoje transporty | to samo (`filterLoadsForRole`) | tak | — |
| Harmonogram — filtry (komputer) | „Etap: Plac Boden ✕” · Opóźnione 5 · Bez dokumentów · Bez kierowcy · Bez ciągnika | to samo; licznik „3 z 72” | tak | 7 przycisków etapów, „Wszystkie”, „W drodze” i „Dostarczone” znikają (E28 pkt 2); daty i szukajka zostają |
| Harmonogram — telefon | pasek przewijany nad listą; Opóźnione 5 · Bez dokumentów · Filtry ▾; z filtrem: „Etap: Plac Boden ✕” · Filtry ▾ | to samo; nad paskiem „Transporty 72 \| Rejsy” i szukajka z „⋯” (E8); pod „Filtry ▾”: Bez kierowcy, Bez ciągnika, daty, „Jak działa”; włączony filtr stanu zawsze widać w rzędzie | tak | „⋯” = Wgraj aktualizacje, Zapisz widok, Eksport XLSX, Eksport PDF (E8); zamyka się po działaniu, Escape (tylko menu — filtr etapu zostaje) i dotknięciu obok (dotknięcie tylko zamyka menu); „Kolumny” tylko na komputerze (na telefonie lista to karty); linia wersji pliku tylko na komputerze |
| Mapa — chipy | W trasie · 0 · Opóźnione · 0 · Brak GPS · 0 | to samo, pod mapą nad tabelą; z filtrem etapu chip „Etap: … ✕” zamiast „W trasie”; liczby = to, co pokaże kliknięcie | tak | „Wszystkie”, „Terminowe” i „Ryzyko” znikają; „Brak GPS” jak oznaczenie (tylko w trasie, 30 min ciszy) |
| Mapa — znaczniki | auta w trasie; „Przygotowanie” → mapa bez znaczników („W trasie: 0”), tabela: transporty w przygotowaniu (e28-after) | to samo: „W trasie” i tabela = Załadunek … Plac Boden (ta sama suma co grupa paska i Kokpit); tabela bez filtra etapu = w trasie, z filtrem = ten etap | tak | okno E27: na produkcji znacznik dostaje też transport jeszcze w przygotowaniu po 03:00 w dniu załadunku, gdy baza ma jego pozycję GPS (`trackingWindowPrep`; to samo zapytanie o pozycje co dotąd, te same numery co mapa). Do „W trasie · N” się nie wlicza. Demo nie ma GPS — tam bez zmian |
| Mapa — pusto | „W trasie: 0 · nikt nie jest teraz w trasie” na środku mapy | to samo; przy filtrze albo szukaniu: „żaden z wybranych transportów nie jest teraz w trasie” | tak | — |
| Mapa — najbliższe włączenia | „08.10, 03:00 · SG-15, SG-16 — brak naczepy → „Do zrobienia” SCX”; „21.10, 03:00 · SG-24 — naczepa TGGG1111” | to samo, 3 najbliższe dni | tak | „→ „Do zrobienia” SCX” przy pierwszym dniu z brakiem naczepy |
| Mapa — nagłówek | „pozycje co 2 min w ruchu, co 15 min na postoju” | to samo na komputerze; na telefonie tylko „N pojazdów w ruchu” | tak | na telefonie dłuższy nagłówek zsuwał dół mapy o 17 px poza ekran (B-7a, `tests/b7-map.spec.ts`) |
| oznaczenia obok statusu (L7) | Opóźniony / Brak GPS / Brak dokumentów obok statusu; „+21H05” przy opóźnieniu | „+1h35” (gdy aplikacja zna minuty), inaczej „Opóźniony”; „Brak GPS” po 30 min ciszy w trasie; „Brak dokumentów” po starcie przewozu | tak | pigułki jak inne w aplikacji (wielkość liter jak statusy); „Opóźniony” i „Cichy” jako status pokazują nazwę etapu (np. „W drodze SE”) z oznaczeniem; w Harmonogramie (tabela i karty) i w tabeli Mapy; w panelu transportu — P4-b |

### Konta (Z11)

| konto | zrzut | różnica |
|---|---|---|
| HHL Administrator i Operacje | `harmonogram-1440-hhl-*`, `mapa-1440-hhl*`, `kokpit-klik-droga-se-mapa-1440-hhl.png`, `telefon-390-hhl-*` | — |
| KSH Użytkownik | `harmonogram-1440-ksh-*`, `telefon-390-ksh-harmonogram.png` | liczy tylko swoje transporty |
| SCX Dyspozytor i Użytkownik | `harmonogram-1440-scx-*`, `telefon-390-scx-harmonogram.png` | jw.; nazwa transportu z numerem SCX (E41) |

### Sprawdzenia

- Brama E8 (`tests/e8-phone-gate.spec.ts`): 3 konta × 360 / 390 / 430 px, także z otwartym „⋯” i „Filtry ▾” w Harmonogramie — 0 poza ekranem, 0 uciętych, 0 celów < 44 px, 0 tekstu < 12 px. Pasek etapów na telefonie dopisany do `tests/fixtures/e8-strips.txt` jako pasek przewijany w bok (E28 pkt 4).
- Nowe testy „wyglad/P4” w tym samym pliku:
  - komputer: 10 kafelków z liczbą w 3 grupach; klik z Kokpitu → Mapa z chipem; drugi klik zdejmuje; w Harmonogramie filtr na miejscu, liczba wierszy = liczba na kafelku = „N z M”; tylko 4 filtry stanu; Escape;
  - Mapa: chipy W trasie / Opóźnione / Brak GPS, „W trasie: 0” przy etapie bez aut, „Najbliższe włączenia śledzenia”;
  - Mapa z filtrem etapu, każdy niepusty kafelek: liczba przy „Opóźnione” i „Brak GPS” = wiersze po kliknięciu, bez chipa „W trasie”;
  - telefon 390: filtr spod „Filtry ▾” po włączeniu widać w rzędzie, także z filtrem etapu; „⋯” — Escape zamyka tylko menu (filtr etapu zostaje), dotknięcie karty obok zamyka menu i nie otwiera transportu, następne dotknięcie otwiera;
  - telefon 360 / 390 / 430: pasek tylko w Harmonogramie i na Mapie, przewijany, kafelki ≥ 44 px.
- Po drugim niezależnym sprawdzeniu (14.10, po rebase na `main` z P3-b):
  - Mapa (E27): na produkcji znacznik także dla transportu w przygotowaniu w oknie śledzenia, gdy baza ma jego pozycję (wyżej, Z3);
  - „⋯” w Harmonogramie na telefonie: Escape łapany przed skrótem globalnym, więc nie zdejmuje filtra etapu ani nie zamyka transportu; „dotknięcie obok” liczone poza przyciskiem „⋯” i jego menu (nie całym rzędem szukajki), a samo dotknięcie tylko zamyka menu;
  - pusta lista: „Na etapie … nie ma w tej chwili żadnego transportu” tylko gdy pusty jest sam etap; gdy wiersze etapu odsiał filtr stanu albo daty — „Żaden transport nie pasuje do wybranych warunków”;
  - telefon, Mapa: nagłówek bez opisu częstotliwości (B-7a, wyżej).
- Inne testy na tej gałęzi (lokalnie, podgląd demo): `test:unit` 949 / 37 pominiętych, `lint:css`, `tsc`, brama E8 całości 23 / 23, `b7-map`, `visual-states` (przebieg), `d-eur-t`, `etap4-ui`, `etap5-ui`, `etap6-ui`, `resp14-phone`, `e8-odbiór`, `e2e-core`, `aud01e-map-pool`. Wzorce zrzutów odświeża `visual.yml` (D-87).
- Testy jednostkowe `tests/p4-stage-tiles.test.ts`:
  - 16 statusów (z kodami E25 od wykonawcy) → właściwy kafelek;
  - anulowane poza paskiem;
  - okno śledzenia od 03:00;
  - najbliższe włączenia;
  - oznaczenia L7.
- Pasek na komputerze bez uciętych nazw przy 800, 1024, 1100, 1280, 1366 i 1440 px; poniżej 1000 px przewija się w bok, jak dawny pasek.
- Niezależne sprawdzenie (agent kontrolny koordynatora, 14.10 ok. 02:55–03:25) na pierwszej wersji (`f644268`). Poprawione w drugim commicie:
  - tablice rejestracyjne w „Najbliższych włączeniach” łapał strażnik walut (`d-eur-t.spec.ts`, „KR 5N867” ~ „kr”) — `data-content`;
  - w produkcji lista i znaczniki Mapy przeliczały się przy każdym najechaniu (czas z milisekundami), co dawało dodatkowe zapytania o pozycje — czas zaokrąglony do minuty;
  - „W trasie” i znaczniki liczyły też transporty w przygotowaniu po dacie załadunku (44 zamiast 39 z paska) — teraz tylko w trasie, jak pasek i Kokpit; „Przygotowanie” → „W trasie: 0”, jak na obrazie;
  - liczby chipów Mapy przy filtrze etapu nie zgadzały się z listą; licznik pojazdów w nagłówku liczył tabelę zamiast mapy;
  - na telefonie włączony filtr stanu mógł zostać schowany pod „Filtry ▾” (pusta lista bez wyjaśnienia) — teraz zawsze widać go w rzędzie;
  - „⋯” na telefonie nie zamykało się; „Kolumny” wychodziły pod dolny pasek — na telefonie bez „Kolumn”;
  - „Brak GPS” na chipie i przy statusie miał dwie definicje; z zakładki „Rejsy” kafelek filtrował niewidocznie (teraz wraca do „Transporty”); chip etapu ma czytelną nazwę dla czytnika ekranu; tabela Mapy pokazuje „+1h35” jak Harmonogram.
- Testy przepisane (E28, komentarz w teście):
  - `tests/l11-spine.test.ts`: 10 kafelków z liczbą zamiast 9 bez cyfr;
  - `tests/visual-states.spec.ts` („stan-wciśnięty”): filtry przez `data-quick`.
  - `stan-zablokowany` klika dalej czwarty chip (dziś „Bez ciągnika”). Nie ruszałem tej linii, bo zaraz pod nią zmienia ten test PR #181 — dopisek D-20261014-0315-01 H2.

### Pliki

`wyglad-P4-a/`:
- `porownanie-komputer.png` i `porownanie-telefon.png` — obraz raportu u góry, aplikacja pod spodem;
- `harmonogram-*`, `mapa-*`, `kokpit-klik-droga-se-mapa-1440-hhl.png`, `telefon-390-*` (w tym `telefon-390-hhl-mapa.png` — mapa w całości po otwarciu).

Zrzuty zrobione po rebase na `main` z P3-b, więc menu boczne i dolny pasek mają już liczby z P3-b (E9).

## wyglad/P4-b — panel transportu: zakładka Status, okno „Zmień status”, pasek śledzenia, blok ETA, link śledzenia

Obrazy raportu:
- `raport/img/e25-after.webp` — prawy panel › Status (komputer i telefon), okno „Zmień status” (okno i arkusz od dołu);
- `e27-after.webp` — „Pasek śledzenia w panelu” (przed oknem, w oknie, po „Dostarczone”), telefon: pasek pod nagłówkiem;
- `e15-after.webp` — „Panel transportu › Przegląd · blok ETA” (4 stany) i telefon („ETA Boden”, „Dlaczego tyle”);
- etap E44 (bez obrazu): opis lokalizatora w panelu, link RIO pokazywany jako „RIO · ••••”.

Zakres z `PLAN.md` §4 P4 „Ekrany”: „P4-b panel transportu (E25 Status i okno, E27 pasek w panelu, E15 ETA, E44)” i „pole „Link śledzenia” w oknie awizacji i opis lokalizatora w panelu (E44)”.
Logika i zapis: PR #181 (`load_status_set`, kody E25, `AT_PORT_SE`). Ten PR zmienia tylko wygląd i układ; zapis w oknie bez zmian (`setLoadStatus(…, occurredAt)`).

Zrzuty z demo na serwerze deweloperskim, czas 07.10.2026, 20:30. Do zrzutów osi i okna do transportu T-12 w demo wstrzyknięto zdarzenia jak SG-03 z produkcji (import 01.10 21:43, „Gotowy” ręcznie 05.10 13:10, faza z pozycji naczepy 05.10 13:21, wjazd na plac 07.10 08:35, wyjazd 12:19; naczepa zmyślona TST123). Do bloku ETA wstrzyknięto stany E15 (jazda, odpoczynek, czekanie) z liczbami z obrazu. Nic nie jest zapisywane — to tylko zrzut.

### Z3 — element po elemencie

| element | obraz raportu | po zmianie w aplikacji | zgodne | uwagi |
|---|---|---|---|---|
| Status — grupy | PRZYGOTOWANIE · bez śledzenia; W TRASIE · śledzenie włączone; ROZLICZENIE · bez śledzenia | to samo | tak | — |
| Status — wiersz | kropka, nazwa, AUTO / RĘCZNIE, godzina „05.10, 13:10”, pod spodem przyczyna i autor | to samo; autor „Imię Nazwisko // Firma”, stare wpisy — nazwa firmy („H&H Logistics”); „System // Watch Tower” przy imporcie | tak | godziny z dziennika zdarzeń transportu, bez nowych zapytań |
| Status — pominięte | „Brak zasobów · Brak dokumentów — pominięte — awizacja od razu kompletna”; „Załadunek … Port SE — pominięte — naczepa podłączona dopiero w Szwecji” | to samo (przyczyna z następnego statusu: „Gotowy” → awizacja kompletna; faza z pozycji naczepy → podłączona w Szwecji / Polsce) | tak | inne przeskoki: samo „pominięte” |
| Status — bieżący | zielona kropka z obwódką, nazwa na zielono | to samo | tak | — |
| Status — „Dostarczone” AUTO | „Wyjazd z placu po 3 h 44 min · śledzenie wyłączone · data realizacji usługi” | to samo (czas od wjazdu na plac) | tak | ręcznie: notatka · autor · data realizacji usługi |
| Status — rozliczenie | „Gotowe do fakturowania · czeka · Gdy SCX wgra CMR · zadanie „Wgraj CMR” u przewoźnika”; „Zafakturowano · — · Gdy transport trafi na fakturę” | to samo („czeka” po „Dostarczone”) | tak | brakująca faktura przy „Zafakturowano” — gdy wykonawca poda dane faktur (dopisek K) |
| Status — stopka | „Zmienia: SCX i administrator HHL. KSH i Operacje HHL: podgląd.” + „Zmień status” | to samo; przycisk tylko dla SCX i administratora HHL (`canStatus` z PR #181) | tak | przycisk przeniesiony z Ustaleń (E25: „przyciski z Ustaleń znikają”) |
| Status — telefon | najpierw „W trasie” i „Rozliczenie”, „Przygotowanie · rozwiń ▾”, godzina w dwóch liniach, „Zmień status” na całą szerokość | to samo | tak | panel na telefonie nad dolnym paskiem (przycisk nie chowa się pod paskiem) |
| okno — nagłówek i „Teraz” | „Zmień status · SG-03”, „Teraz: **Na placu** od 07.10, 08:35” | to samo | tak | — |
| okno — pola | Nowy status; Data; Godzina (czas polski); Notatka (opcjonalnie) z przykładem | to samo; data i godzina to dwa pola składane w jedną wartość jak w PR #181 | tak | format daty w polu ustawia przeglądarka (na komputerze właściciela po polsku; zrzut z przeglądarki testowej pokazuje format amerykański) |
| okno — „Z GPS” | „Z GPS: wyjazd z placu 07.10, 12:19 · Użyj” | to samo; „Użyj” wpisuje datę i godzinę | tak | z dziennika stref (wjazd/wyjazd: Śrem, port PL, port SE, plac) |
| okno — informacja | przy „Dostarczone”: data realizacji usługi, kurs NBP, opłata paliwowa, tydzień faktury, śledzenie wyłączy się | to samo; telefon — wersja krótka | tak | — |
| okno — zasady | „Nie wcześniej niż poprzedni status (07.10, 08:35) i nie później niż teraz. Cofnięcie: tylko administrator HHL, z powodem.” | to samo | tak | „nie wcześniej niż poprzedni status” sprawdza baza — dopisek K3 |
| okno — przyciski | „Anuluj” · „Zapisz status”; telefon: arkusz od dołu, „Anuluj” · „Zapisz” | to samo | tak | notatka zostaje też na telefonie (cofnięcie i anulowanie wymagają powodu) |
| pasek śledzenia | nad zakładkami: przed oknem „Śledzenie włączy się 21.10 o 03:00 · naczepa …”, w oknie „Śledzenie trwa od 03:00 · ostatnia pozycja 2 min temu”, po „Śledzenie zakończone 07.10, 12:19 (Dostarczone)” + ślad i usunięcie po 30 dniach | to samo; w drugiej linii opis lokalizatora (E44) | tak | „ostatnia pozycja” — gdy baza poda czas pozycji (dopisek K1); mapa w panelu poza oknem bez kropki pojazdu (E27) |
| blok ETA | „PRZED WYJAZDEM ZE ŚREMU · ETA: – · Plan dostawy KSH: 07.10 …”; „W TRASIE · 06.10, 12:20 · ± 46 MIN · ŚREDNIA · z GPS 2 min temu · 196 km do placu · jazda …”; „ODPOCZYNEK W TOKU”; „CZEKA PRZED PLACEM · Na miejscu od 12:25 · PRZED OKNEM” | to samo, w Przeglądzie nad listą pól (zastępuje wiersz „ETA Boden”) | tak | bez dopisku „(D-80)” z obrazu (numer decyzji, nie tekst dla użytkownika); km, jazda, odpoczynek, czekanie — gdy wykonawca poda `etaDetail` (dopisek K1); dziś: ETA, pasmo, słowo pewności, okno |
| blok ETA — telefon | „ETA BODEN” + „DLACZEGO TYLE” | to samo | tak | — |
| E44 — awizacja | pole „Link śledzenia” | „Link śledzenia” + podpowiedź „emtrack albo link RIO od podwykonawcy SCX — nowy link na każdy przejazd”; po wklejeniu: „Rozpoznano link RIO (podwykonawca SCX)” | tak | zapytanie testowe i wynik „Link RIO działa · …” — wykonawca (E44 pkt 1) |
| E44 — panel | „Lokalizator: ciągnik WPR 8220T (RIO)” / „naczepa …” | „Lokalizator: naczepa TST123 · emtrack”; link RIO: „Lokalizator: RIO · ••••” | częściowo | rodzaj pojazdu i rejestracja z RIO po rozpoznaniu w bazie (E44 pkt 6) — dopisek K5 |
| nazwy statusów | spis E25: Zaplanowany, Brak zasobów, Port PL, Droga PL, Droga SE, Port SE | jeden słownik `statusLabel` z tymi nazwami (także pigułki w Harmonogramie, na Mapie i w Kokpicie); „Rozładowany” → „Dostarczone” | tak | dotąd: Planowany, Brak auta, Port Gdańsk, W drodze PL/SE, Nynäshamn |

### Konta (Z11)

| konto | zrzut | różnica |
|---|---|---|
| HHL Administrator i Operacje | `panel-1440-hhl-*`, `okno-1440-hhl-*`, `telefon-390-hhl-*` | Operacje HHL bez „Zmień status” w produkcji (`canStatus`: rola w bazie `HHL_ADMIN`) |
| KSH Użytkownik | `panel-1440-ksh-status.png` | ta sama oś, bez „Zmień status”, w stopce „kto zmienia” |
| SCX Dyspozytor i Użytkownik | `panel-1440-scx-status.png`, `awizacja-1440-scx-link-rio.png` | z „Zmień status”; nazwa transportu z numerem SCX (E41) |

### Sprawdzenia

- Testy jednostkowe `tests/p4b-status-axis.test.ts`: oś SG-03 (grupy, pominięte z przyczyną, AUTO / RĘCZNIE, bieżący, czeka), ręczne „Dostarczone” z okna, kody bazy na osi, Anulowany, autor, podpowiedź z GPS, rozpoznanie linku RIO / emtrack.
- Brama E8 (`tests/e8-phone-gate.spec.ts`, opis „wyglad/P4-b”): komputer — pasek nad zakładkami, 3 grupy i 14 statusów, jeden bieżący, okno z informacją przy „Dostarczone”; KSH bez przycisku; telefon 360 / 390 / 430 — kolejność grup, „Przygotowanie” zwinięte, „Zmień status” ≥ 44 px i niezasłonięty dolnym paskiem, arkusz na całą szerokość przy dolnej krawędzi, wszystkie pola i przyciski ≥ 44 px, bez przewijania w bok.
- Testy przepisane (E25, komentarz w teście): `tests/etap4-ui.spec.ts` i `tests/visual-states.spec.ts` („stan-zablokowany”) — „Zmień status” w zakładce Status; `tests/aud03-ksh-panel.spec.ts` i `.test.ts` — KSH: oś bez przycisku, przycisk w `StatusAxisTab.tsx`; `tests/aud01e-map-pool.test.ts` — kropka w panelu tylko w oknie śledzenia; `tests/status-label.test.ts` — nazwy ze spisu E25.
- Niezależne sprawdzenie (agent kontrolny koordynatora, 14.10 ok. 06:10–06:25, commit `5731239`). Poprawione:
  - na telefonie pola okna miały 15 px (iOS powiększa stronę) i część tekstów 11–11,5 px — teraz pola 16 px, tekst ≥ 12 px; test telefonu sprawdza to w panelu i w arkuszu;
  - wyczyszczenie daty w oknie zerowało godzinę na 00:00 — data i godzina mają osobny stan, łączone przy zapisie;
  - podpowiedź „Z GPS” brała też strefę „wyjechał ze Śremu” dopisaną przy ustaleniu fazy z pierwszej pozycji (`synthetic`, 0188) — pomijana;
  - czasy porównywane jako tekst („+02:00” z okna i „Z” z bazy) — teraz po czasie;
  - „Dostarczone” w pasku i bloku ETA bierze `actual_delivery_at` (data rozliczenia), a nie późniejszą poprawkę statusu;
  - blok ETA: atrybucja OpenStreetMap przy ETA z OSM, przyczyny ETA, „Na placu” zamiast „W trasie”, bez wymyślonych 11 h odpoczynku;
  - podgląd dokumentu na telefonie przyciemnia panel (nad panelem); mapa w panelu poza oknem śledzenia nie pisze „brak danych pozycji”;
  - nazwa transportu w pasku według E41; „ostatnia pozycja … temu” odświeża się co minutę;
  - okno odrzuca czas wcześniejszy niż bieżący status (tekst zasad); baza ma sprawdzać to samo — dopisek;
  - test lokalny `tests/i2-facade.local.spec.ts` przepisany pod blok ETA (E15).
- Lokalnie (podgląd demo): `tsc -b`, `test:unit` 958 / 37 pominiętych, `lint:css`, `oxlint` bez nowych ostrzeżeń, brama E8 całości, `etap4-ui`, `etap5-ui`, `etap6-ui`, `aud03-ksh-panel`, `visual-states` (przebieg), `b7-map`, `resp14-phone`, `e8-odbiór`, `d-eur-t`, `e2e-core`, `persist-toast`. Wzorce zrzutów odświeża `visual.yml` po rebase na `main` z PR #181.

### Pliki

`wyglad-P4-b/`:
- `porownanie-e25-komputer.png`, `porownanie-e25-telefon.png`, `porownanie-e15.png`, `porownanie-e27-pasek.png` — obraz raportu i aplikacja;
- `panel-1440-*` (Status, Przegląd: przed wyjazdem, w trasie, odpoczynek, czekanie, dostarczone; ciemny motyw), `okno-1440-*`, `telefon-390-*`, `awizacja-1440-scx-link-rio.png`.
