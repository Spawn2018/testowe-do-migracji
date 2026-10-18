# W-bramy-P11 — P11 pkt 3 „Bramy na stałe”: E20 szerokości, E21 strażnik tekstów, E10 kontrast

Koordynator (Claude), 18.10.2026 (13:10; druga runda po F7: 15:20; trzecia runda po F7: 17:00). Gałąź `wyglad/W-bramy-P11` (od `main` a2eb2d4, z #300). F8: testy wyglądu i kolory (tokeny), bez danych, bazy i tekstów.

## Podstawa
- PLAN §4 P11 pkt 3 „Bramy na stałe”:
  - strażnik tekstów E21 blokujący na ekranach (0 trafień, E21 pkt 8);
  - axe kontrast E10;
  - szerokości 1280 / 1366 / 1440 / 1920 bez nakładania (E20);
  - elementy poza ekranem telefonu E8 (jest już: `e8-phone-gate`).
- E20 pkt 1, 2 i 5; E21 pkt 7 i 8; E10.
- Polecenie właściciela 18.10, 12:28: praca w trybie ciągłym nad planem.

## Gdzie są bramy
Osobny plik `tests/p11-bramy.spec.ts` (F7 P5): testy biegną równolegle i nie wchodzą w konflikt z PR-ami dopisującymi do `etap6-ui.spec.ts` (jak przy #300). CI uruchamia go w `scripts/ci/fresh-smoke.sh` zaraz po `test:aud03`, w 4 wątkach; lokalnie (2 procesory) w 2. `tests/etap6-ui.spec.ts` jest taki sam jak na `main`.

Kiedy brama patrzy (F7 r2 B3, D10, D12):
- przed każdą stroną kursor wraca w róg okna (`mouse.move(0, 0)`), więc nic nie jest przypadkiem najechane;
- strona, zakładka panelu i rozwinięta karta Ryzyk są sprawdzane dopiero po dorysowaniu: obszar ma tekst, a potem przez 400 ms (karta: 250 ms) nie zmienia się w nim nic — ani węzły, ani tekst (obserwator zmian w DOM); najwyżej 8 s;
- zakładka panelu wczytuje się osobno, więc brama czeka, aż w niej pojawi się tekst, i dopiero wtedy liczy ciszę;
- E21 czyta tekst dwa razy: zaraz po dorysowaniu i po pobycie na ekranie (strona 3 s, panel, Opcje i dzwonek 1,6 s); do tego obserwator zmian w DOM zbiera cały widoczny tekst dodany albo zmieniony od wejścia na ekran do wyjścia z niego, także taki, który zdążył zniknąć — tekst, który przyszedł już po odczycie, jest sprawdzany przy wyjściu z ekranu z nazwą i wyjątkami tego ekranu, a na końcu testu jeszcze raz (F7 r3 B1, r4 B1). Kokpit jest sprawdzany jeszcze raz w całości przed dzwonkiem — późny komunikat „Nie udało się wczytać podkładu” (ok. 2,5 s, gdy kafelki są zablokowane) trafia do strażnika;
- E10 bada stronę dopiero 3 s po wejściu.

Panel zawsze otwiera się od zakładki Przegląd, a brak zakładki oblewa test (bez cichego pominięcia).

## Co sprawdzają
1. **E20 — szerokości komputera.** 3 firmy × zegar 23.09 (12 stron) i 20.11 (Kokpit, Harmonogram, Finanse, Faktury) × 1280 / 1366 / 1440 / 1920. Do tego panel SG-03, SG-32 i T-01, 6 zakładek, przy 1280. Jedno wejście na stronę i 4 zmiany rozmiaru okna. Wymagane 0:
   - treść szersza od `main` albo od panelu (F7 B1 — `main` ucina nadmiar, więc liczy się sam `main` i jego potomkowie), dokument szerszy od okna;
   - przewijanie w bok w obszarze, który nie jest tabelą (F7 r2 B1 — np. treść zakładki panelu `.dbody` szersza od panelu); zwolnione jest tylko opakowanie, w którym tabela stoi bezpośrednio (F7 r3 P1 — np. Harmonogram w układzie pliku KSH, E38), a nie każdy obszar z tabelą gdzieś w środku;
   - pasek górny: treść wyższa od paska, dziecko paska wyższe niż pasek albo napis w więcej niż jednej linii (F7 B2, r2 D11 — „WATCH TOWER” w dwóch liniach mieści się w 51 px, więc liczone są linie tekstu, nie wysokość);
   - kolumny tabeli na sobie, tekst wylany z komórki, ucięty widoczny tekst;
   - kafelki i panele w siatce lub rzędzie nachodzące na siebie (F7 P1).
   
   Osobno: Harmonogram „Widok skrócony” (8 kolumn) bez przewijania w bok przy 1280 i 1366 (HHL, KSH, SCX; F7 D7 — domyślny układ pliku KSH przewija się w bok z założenia, E38).
2. **E21 — strażnik tekstów.**
   - Zakres: 5 rodzajów kont × zegar 23.09 i 20.11 × 12 stron, każdy ekran Opcji, dzwonek, Ryzyka z rozwiniętą listą i każdą kartą rozwiniętą po kolei (F7 r2 B4: karty działają jak akordeon, więc „kliknij wszystkie” otwierało 2 z 21). Panel: 13 transportów przy 23.09 i 3 przy 20.11, każdy po 6 zakładek (Operacje HHL bez panelu — ten sam widok co Administrator).
   - Reguły (F7 P3): kody z podkreśleniem; klucze małymi literami („sail_src_STENA”, „risk.kind.…”); numery wewnętrzne (8 znaków, małe i wielkie litery); daty ISO, także z „T”; sekundy; daty bez zera; data przeglądarki po angielsku („Mon Oct 12 2026 … GMT+0200”); kropka dziesiętna (także „12.10 PLN”); kwota bez odstępu tysięcy („8239,15”, także po minusie i twardej spacji, oraz „4500 PLN” — 4 cyfry przed walutą; przy km i kg od 5 cyfr: „12345 km”, „40000 kg”; „1050 km” przechodzi, bo w liczbie czterocyfrowej odstęp nie jest wymagany); szwedzkie słowa; zła odmiana („22 pojazdów”, „5 pojazdy”); puste wartości; „Nieznany kod” poza Stanem systemu.
   - Wyjątki (F7 D3, r2 P3): nazwy plików z rozszerzeniem (wielkość liter dowolna, także z łącznikiem), licencja „CC BY 4.0”, adresy e-mail i nazwy domen; kolor „#1a2b3c4d” to nie numer wewnętrzny; odmiana po słowach z dopełniaczem („z”, „dla”, „bez”, „brak”, „brakuje”, „dotyczy”, „w ciągu”, „sprzed” …) nie jest sprawdzana. Kody w Stanie systemu są dozwolone (E21 pkt 3, F7 D6).
   - Osobny test reguł: przykłady z audytu i z F7 muszą zostać złapane, a daty, pliki, licencja, domeny, e-maile i dopełniacz przepuszczone.
3. **E10 — kontrast (axe-core, `color-contrast`, WCAG AA).**
   - Komputer: 3 firmy × motyw jasny i ciemny × 12 stron, Ryzyka z każdą kartą rozwiniętą po kolei (także opcja „Objazd”), najechany wiersz Mapy, najechany wiersz Harmonogramu — zwykły i dostarczony (F7 r2 D10), każdy ekran Opcji, dzwonek, panel (3 transporty × 6 zakładek, axe tylko na panelu) i okna Dopłata, Awizacja, Daty KSH — axe na samym oknie (`aria-modal`), nie na panelu pod nim (F7 r2 B4).
   - Telefon 390: 3 firmy × 2 motywy, strony i panel SG-32 (F7 P4).
   - Operacje HHL i Użytkownik SCX: każdy ekran Opcji w obu motywach.
   - axe wstrzykiwany raz na stronę (F7 P5).
   - Węzły, których axe nie ocenia („incomplete”: zasłonięte przez przyklejone kolumny, nakryte, poza oknem — sam Harmonogram ma ich ok. 430), brama mierzy sama: kolor tekstu z przezroczystością na złożonym tle przodków, próg 4,5 (duży tekst 3). Pomijane są: mapa (podkład i dymki — Leaflet, np. Strefy), pojedyncze znaki i ikony oraz węzły bez nieprzezroczystego tła w drzewie albo z kolorem, którego pomiar nie odczyta (np. podpisy wykresu SVG na Kokpicie). Liczby zmierzonych i pominiętych są w adnotacji testu (F7 r2 P6; F7 r3 sprawdził zgodność z axe wycinkowo). Tło z gradientem dałoby fałszywe trafienie — gradientów w aplikacji nie ma (tokeny).
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
| Mapa, najechany lub wybrany wiersz — czerwone „+1 h 35 min po oknie” (F7 P2) | 4,32 (ciemny) | pole w kolorze tła strony (`--surface`: jasny biały, ciemny #101C25) pod napisem, ≥ 4,5 w obu motywach |
| Mapa, najechany lub wybrany wiersz — szary opis pod kodem (numer zlecenia, ostatnia pozycja; runda 3, pomiar własny) | 3,88 (ciemny) | ink-2 |
| Dokumenty na telefonie, plik niezgodny (np. zezwolenie SG-07 na inny zestaw) — nazwa pliku (runda 3, pomiar własny) | 2,65 (jasny) | bursztynowy tekst (`--amber-ink`) na bursztynowym polu (`--amber-bg`), ≥ 4,5 w obu motywach |
| Ryzyka, rozwinięta karta „objazd czy postój”, opcja „Objazd” (tło zielone) — „Ryzyka” (F7 P2) | 4,31 (ciemny) | 7,20 |
| Harmonogram, najechany wiersz (ciemny motyw) — cały szary tekst wiersza: data, status, ETA, kwota, marża | 3,99 | ink-2 |
| Harmonogram, podświetlony wiersz (tło bursztynowe) — „Dokumenty”, marża | 3,88 (ciemny) | ink-2 |

Pliki: `src/components/options/sys.css`, `options.css`, `src/components/ui/DocFileRow.tsx` (klasa zamiast koloru w stylu), `src/components/drawer/p6b.css`, `src/components/zones/zones.css`, `src/components/risks/risks.css`, `src/components/schedule/sched7.css`, `src/index.css`. Pozostałe kolory, układ i teksty bez zmian.

F7 D2 (jedna reguła dla wszystkich teł `*-bg` zamiast poprawek miejsce po miejscu): zostaje miejsce po miejscu. Zmiana tokenu `--ink-3` zmieniłaby szary tekst w całej aplikacji. Bramy pilnują każdego nowego miejsca.

F7 r2 D9 (zamiana `--ink-3` na całym najechanym wierszu Harmonogramu): zostaje i jest opisana. Skutki:
- wiersz dostarczony i anulowany przy najechaniu traci przygaszenie — szary tekst staje się ciemniejszy (ciemny motyw: `rgb(120,140,154)` → `rgb(164,182,194)`); po zjechaniu wraca;
- kreska `.s7-wt1` przy najechaniu ma ten sam ciemniejszy szary.

Powód: przygaszony tekst przy najechaniu ma 3,99 w ciemnym motywie, czyli za mało (E10); najechany wiersz to ten, który użytkownik właśnie czyta. Zawężenie do kilku komórek zostawiłoby inne szare teksty wiersza poniżej 4,5 i każda nowa kolumna wymagałaby osobnej poprawki.

## Układ — poprawka z CI (F7 r2 B-CI)
Harmonogram, układ pliku KSH (szerokie kolumny), kolumna „Kwota i marża”: przy 250 px na Chromium 153 w CI kwota z marżą w jednej linii wychodziła poza komórkę (E20 oblał w CI, lokalnie na Chromium 141 nie). Teraz kolumna ma 270 px (`schedLayout.ts`), więc tekst mieści się w jednej linii także przy szerszych literach; tabela jest o 20 px szersza (w tym układzie i tak przewija się w bok, E38). Gdyby kwota była jeszcze dłuższa, komórka zawija tekst zamiast wylewać (`sched7.css`); liczby i waluta stoją na twardej spacji. F7 r3: dwie wcześniejsze wersje zmieniały wysokość wierszy — kwota zawsze w dwóch liniach (każdy wiersz 32 → 48 px) i samo zawijanie przy 250 px (w CI wiersze SG-10 i SG-13 o 16 px wyższe); obie zastąpione. Treść, teksty i dane bez zmian.

## Wynik lokalnie (build gałęzi, 2 wątki, Chromium 141; CI ma Chromium 153)
- Runda 2: cały plik 32 testy w 7,5 min; pierwszy przebieg 28 z 32 — znalazł wiersze Harmonogramu (tabela wyżej) i lukę w regule kwot. Po poprawce E21 (11 testów) i E10 ciemny komputer (3): 14 z 14 w 4,0 min.
- Runda 3: cały plik 32 testy w 13,9 min (2 wątki). Pierwszy przebieg: E21 8 z 10 czerwonych przez nową regułę „4 cyfry przed jednostką” („1050 km do placu”) — reguła zawężona do walut; E10 z pomiarem własnym znalazł 2 nowe miejsca (tabela wyżej: szary opis w najechanym wierszu Mapy, nazwa pliku niezgodnego w Dokumentach na telefonie). Po poprawkach: E21 11 z 11, E10 14 z 14, E20 7 z 7. Pomiar własny objął 6 980 węzłów „incomplete”, pominięte 1 186 (podkład mapy, pojedyncze znaki i ikony).
- Runda 4 (po F7 r3: późna treść, opakowanie tabeli, km/kg): cały plik 32 z 32 w 22,4 min (2 wątki na zajętej maszynie; w CI 4 wątki). Próba: tekst z kodem dodany na Kokpicie po 2,2 s i usunięty po 0,3 s oraz kod w czacie po 1,3 s — oba złapane.
- `tsc -b`, `stylelint`, `oxlint` bez uwag.
- Wersje przeglądarki różnią się (lokalnie 141, w CI 153), więc rozstrzyga wynik w CI — lokalny przebieg jest próbą przed wysłaniem.

## Odłożone (z terminem)
- **Wejście na stronę od razu przy 1280** (F7 r2 P5): E20 otwiera stronę raz i zmienia rozmiar okna. Komponenty, które wybierają układ przy montażu, są badane po zmianie rozmiaru, nie przy wejściu. Do P11 pkt 6 (zrzuty 4 szerokości otwierają każdą szerokość osobno).
- **„07.10 h”** (F7 r2 P3) liczy się jako kropka dziesiętna — zostawiam: po dacie nie stoi jednostka czasu, a „12.10 h” może być złą liczbą godzin. Dziś nie występuje na żadnym ekranie.
- **E21 — treści e-maili próbnych** (E21 pkt 7): do P11 pkt 6, przed wydaniem 28.10.
- **E20 — zrzuty 4 szerokości w bramie wizualnej** (`scripts/baseline.mjs` ma `1920, 1440, 1280, 768, 390`, bez 1366): do P11 pkt 6.
- **Nowe reguły E21** — kody etapów w tekstach („(E42)”, „jak w E41”) i procent ze spacją („14,27 %” zamiast „14,27%”): wchodzą razem z poprawkami tekstów w `wyglad/W-przed-wydaniem-3` (P11 pkt 7). Dodane tutaj oblałyby `main`.

## Dalej (P11 pkt 7, ten sam koordynator)
Końcowe porównanie każdego miejsca z „Mapy aplikacji” z raportem — `docs/handover/odbior/P11-zgodnosc/` (w toku).
