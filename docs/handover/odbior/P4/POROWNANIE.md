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
| Harmonogram — telefon | pasek przewijany nad listą; Opóźnione 5 · Bez dokumentów · Filtry ▾; z filtrem: „Etap: Plac Boden ✕” · Filtry ▾ | to samo; nad paskiem „Transporty 72 \| Rejsy” i szukajka z „⋯” (E8); pod „Filtry ▾”: Bez kierowcy, Bez ciągnika, daty, „Jak działa”; włączony filtr stanu zawsze widać w rzędzie | tak | „⋯” = Wgraj aktualizacje, Zapisz widok, Eksport XLSX, Eksport PDF (E8); zamyka się po działaniu, Escape i dotknięciu obok; „Kolumny” tylko na komputerze (na telefonie lista to karty); linia wersji pliku tylko na komputerze |
| Mapa — chipy | W trasie · 0 · Opóźnione · 0 · Brak GPS · 0 | to samo, pod mapą nad tabelą; z filtrem etapu chip „Etap: … ✕” zamiast „W trasie”; liczby = to, co pokaże kliknięcie | tak | „Wszystkie”, „Terminowe” i „Ryzyko” znikają; „Brak GPS” jak oznaczenie (tylko w trasie, 30 min ciszy) |
| Mapa — znaczniki | auta w trasie; „Przygotowanie” → mapa bez znaczników („W trasie: 0”), tabela: transporty w przygotowaniu (e28-after) | to samo: znaczniki i „W trasie” = Załadunek … Plac Boden (ta sama suma co grupa paska i Kokpit); tabela bez filtra etapu = w trasie, z filtrem = ten etap | tak | transport w przygotowaniu po 03:00 dnia załadunku (okno E27) dostaje znacznik, gdy baza przypisze mu pozycję i zmieni status na Załadunek — logika wykonawcy |
| Mapa — pusto | „W trasie: 0 · nikt nie jest teraz w trasie” na środku mapy | to samo; przy filtrze albo szukaniu: „żaden z wybranych transportów nie jest teraz w trasie” | tak | — |
| Mapa — najbliższe włączenia | „08.10, 03:00 · SG-15, SG-16 — brak naczepy → „Do zrobienia” SCX”; „21.10, 03:00 · SG-24 — naczepa TGGG1111” | to samo, 3 najbliższe dni | tak | „→ „Do zrobienia” SCX” przy pierwszym dniu z brakiem naczepy |
| Mapa — nagłówek | „pozycje co 2 min w ruchu, co 15 min na postoju” | to samo | tak | — |
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
  - telefon 360 / 390 / 430: pasek tylko w Harmonogramie i na Mapie, przewijany, kafelki ≥ 44 px.
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
- `harmonogram-*`, `mapa-*`, `kokpit-klik-droga-se-mapa-1440-hhl.png`, `telefon-390-*`.
