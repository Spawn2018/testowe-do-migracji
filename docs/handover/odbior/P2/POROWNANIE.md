# Odbiór P2 — wygląd (V4)

Dopisek D-20261013-1535-01 V4, dowód według Z10 i Z11 z D-20261013-1550-01.
Zrzuty z trybu demo, zamrożony czas 2026-09-23 14:32 UTC, motyw ciemny.
Obrazy raportu: `docs/handover/audyt_claude_2026-10-08/raport/img/`.

## Konta (Z11)

Przełącznik demo ma trzy strony. Piątka rodzajów kont z E9:

| konto | zrzut | dopisek |
|---|---|---|
| HHL Administrator | `*__hhl__*` | — |
| HHL Operacje | jak HHL Administrator | te ekrany nie dzielą Opcji; podział jest w P3 |
| KSH Użytkownik | `*__ksh__*` | bez kolumn numerów |
| SCX Dyspozytor | `*__scx__*` | swój numer, numer HHL tylko do odczytu |
| SCX Użytkownik | jak SCX Dyspozytor | marżę widzi tylko HHL; rozdział cen jest w P3 |

## Ekrany

| ekran | szerokości | obraz raportu | wzór Z10 | zostaje |
|---|---|---|---|---|
| Kokpit | 390, 1440 | `e8-after.webp` | punkt 1 (kafelki telefonu) i 3 (komputer: dotychczasowy układ) | kafelki 2×2 i liczba w jednej linii — P3, V5 |
| Harmonogram | 390, 1440 | decyzja E38 1A wygrywa z obrazem E41 „jedna kolumna Transport” | punkt 2 (treść etapu) | układ pliku, przyklejone kolumny, pasek narzędzi telefonu, zasłonięty kierowca — P7, V6 |
| Dokumenty | 390, 1440 | `e8-after.webp` | punkt 1 | na telefonie tabela wymagań jest kartą „etykieta: wartość”; lista plików zostaje pod spodem |
| Finanse | 390, 1440 | `e8-after.webp` (marża według typu) | punkt 1 | na telefonie tabela marży jest kartą; zestawienie nad nią bez zmiany treści |
| Panel | 390, 1440 | `e41-after.webp` | punkt 1 | nazwa „kod · numer” w nagłówku; reszta panelu bez przebudowy |

## Co ta paczka zamyka

- Kolumna „Wysyłka” na komputerze to sam kod. Numery stoją w swoich kolumnach. Na karcie telefonu zostaje „kod · numer”.
- Przy 1440 px status ma pełny napis (Dostarczony, Rozładowany).
- Dolny pasek telefonu: liczba tylko przy Ryzykach. W menu bocznym komputera liczba przy Harmonogramie zostaje.
- Brama E8 lokalnie: 9 widoków, 360 / 390 / 430 px, trzy liczby = 0 (wyjątki w `tests/fixtures/e8-exceptions.txt`: ukryte pole pliku i kafel mapy ucięty przez ramkę).

## Pliki

`kokpit`, `harmonogram`, `dokumenty`, `finanse`, `panel` × `hhl`, `scx`, `ksh` × `390`, `1440`.

## wyglad/P2-2 — koordynator (D-20261013-1815-01 W1–W7, podział pracy D-20261013-1835-01)

Zrzuty: `docs/handover/odbior/P2/wyglad-P2-2/`, tryb demo, zamrożony czas 2026-09-23 14:32 UTC, motyw jasny (jak obrazy raportu), telefon 390 × 844 z dotykiem, konto HHL. Po lewej wycinek `raport/img/e8-after.webp`, po prawej aplikacja.

| ekran | obraz raportu | co zmienia wyglad/P2-2 | różnica, która zostaje | kto zamyka |
|---|---|---|---|---|
| Kokpit | `e8-after` (Kokpit) | 2 kolumny; liczba nie łamie się (30 px jak w makiecie); kwota na cały rząd i na końcu; samotny ostatni kafelek na cały rząd | kafelki w jednym panelu z liniami (obraz: osobne kafelki z odstępem); treść 6 kafelków zamiast „Do zrobienia / W drodze / Komplet / Terminowość / Marża”; nagłówek „H&H Logistics”; baner rejsu; brak „Najpilniejsze” | P3 (V5, E9, E7) |
| Finanse · marża według typu | `e8-after` (Finanse) | karta na typ: nazwa i „N szt.”, Przychód, Koszt, Marża (pogrubiona); licznik „N typów”; bez wykresu | w danych demo typ to kod („SG”), na produkcji nazwa („Słupy główne”, sprawdzone w bazie 13.10); kolor marży na komputerze (czerwony poniżej 18 %) | P5 (E16) |
| Dokumenty | `e8-after` (Dokumenty) | „Wgraj dokument” na całą szerokość; „Tydzień N (RRRR-WNN)” i „Pobierz paczkę” w jednym rzędzie; karta kategorii: nazwa + „N PO TERMINIE” / „KOMPLET”, „kto · termin”, „Komplet X z Y” + „Zmień”; edycja terminu w karcie | tytuł strony „Dokumenty” zostaje (obraz to wycinek bez tytułu, E8 nie zmienia tytułów) | — |
| Faktury, Strefy, lista na Mapie, tabele w Opcjach | brak własnego obrazu telefonu | etykiety kart w jednej kolumnie przy lewej krawędzi (Z10 pkt 1: karta E8) | — | — |
| Mapa · warstwy | brak własnego obrazu telefonu | pole wyboru 22 px, cały wiersz z napisem ≥ 44 px (zamiast kwadratu 44 × 44) | — | — |

- Komputer (1440 px, HHL / SCX / KSH × Kokpit, Finanse, Dokumenty, Faktury, Strefy, Opcje): 18 zrzutów identycznych piksel w piksel z `main` `05eb67e` (E8 pkt 9).
- Brama E8 (`tests/e8-phone-gate.spec.ts`), uszczelniona w W6: `main`, `body` i `.app` nie są paskiem przewijanym; nowe sprawdzenia „liczba-lamana” (kafelek Kokpitu) i „etykieta” (karty). Na `main` `05eb67e`: błąd (Kokpit 2 liczby, etykiety: Dokumenty 10, Finanse 68, Faktury 36, Strefy 52 przy każdej szerokości). Na `wyglad/P2-2`: 0 przy 360 / 390 / 430.
- Pomiar koordynatora (9 widoków × 360 / 390 / 430): 0 poza ekranem, 0 celów < 44 px, 0 tekstu < 12 px, `main` i strona bez przewijania w bok.
- Uwaga poza zakresem: `tests/resp14-phone.spec.ts` „menu telefon” pada już na `main` (szuka ☰, który P2 zastąpił dolnym paskiem; test nie jest w `visual.yml`). Do przepisania w P3 razem z E37 (konto w pasku górnym).

## wyglad/P2-2-popr — koordynator, po niezależnym sprawdzeniu (13.10, ok. 19:00)

Osobny agent kontrolny koordynatora (bez udziału w pracy) sprawdził `wyglad/P2-2` (PR #176, scalony 19:00) i znalazł usterki, których opis wyżej nie wymienia. Poprawki na `wyglad/P2-2-popr`. Zrzuty: `docs/handover/odbior/P2/wyglad-P2-2-popr/` (motyw jasny, demo, 360 i 390 px).

**Poprawione:**
- Dokumenty: wybór tygodnia był ucięty (HHL przy 360 px: „Tydzień 42 (2026-W”; KSH i SCX bez „Wgraj”: pole ściśnięte obok tytułu). Teraz: rząd tytułu; „Wgraj dokument” na całą szerokość; tydzień i „Pobierz paczkę” w jednym rzędzie od ok. 375 px, przy 360 px każde w swoim rzędzie. Przyciski 14 px, „Zmień” i „Pobierz paczkę” z ciemną ramką jak w makiecie.
- Kokpit: etykiety kafelków w pierwszym rzędzie stały nierówno (11 i 20 px od góry), bo przycisk centrował treść. Teraz treść od góry, wszystkie 11 px.
- Mapa (lista) i Dokumenty (nazwy plików): wielokropek ucinał nazwy („Element konstrukcji · missing …”, „LASHING_PHOTOS_SG-01.pdf” przy 360 px). Teraz zawijają się.
- Brama E8 (`tests/e8-phone-gate.spec.ts`) przepisana:
  - pasek przewijany zwalnia tylko z listy `tests/fixtures/e8-strips.txt` (dziś pusta), strona, `main` i `.app` nigdy;
  - nowe „uciete”: `overflow:hidden|clip`, wielokropek i ucięcie w pionie (scrollWidth / scrollHeight), wartość kafelka szersza od kafelka, tekst wybranej opcji pola wyboru szerszy od pola;
  - tekst < 12 px liczony także w `::before` / `::after`;
  - „etykieta”: kolejność, kierunek i przesunięcie etykiety karty; etykiety kafelków Kokpitu równo od góry;
  - przebieg dla HHL, SCX i KSH (nie tylko HHL).
  - Agent kontrolny wstrzyknął 6 usterek, które stara brama przepuszczała; nowa łapie wszystkie 6 (ucięte kwoty, karty w pasku przewijanym, ucięta liczba, etykiety po prawej, etykiety 9 px, wielokropek). Nie sprawdza `transform: scale` ani `clip-path`.
  - Na `main` `b9ae3d3` brama pada (pole tygodnia 157 > 129 px przy 360, nazwy plików, Mapa, etykiety kafelków); na `wyglad/P2-2-popr` 5/5 zielone.

**Odstępstwo od tekstu W1:** zamiast `clamp()` kafelek ma stałe 30 px jak `.tile .v` w makiecie (`makiety_html/E8/telefon.html`), a długa wartość dostaje cały rząd jak `.tile.wide`. Brama sprawdza, że wartość mieści się w kafelku i jest w jednej linii.

**Różnice, które zostają (drobne):**
- Finanse: nagłówek „Marża według typu elementu” to podtytuł w panelu (15 px), na obrazie osobny pasek 18 px; karty stoją w panelu (podwójna ramka).
- Dokumenty: przy 360 px tydzień i „Pobierz paczkę” w dwóch rzędach (makieta nie ma marginesów panelu); u KSH i SCX bez „Zmień” (prawa: tylko HHL).
- Kokpit: treść i układ kafelków, „Najpilniejsze”, baner — P3 (V5).

**Poza zakresem, do paczek wyglądu koordynatora:** Ryzyka — karty rejsów bez etykiet (P6); Opcje — tekst 1–2 px od krawędzi (P3); `tests/resp14-phone.spec.ts` „menu telefon” (P3, E37).

Komputer: 18 zrzutów 1440 px (3 konta × 6 widoków) identycznych z `main` `b9ae3d3`; agent kontrolny potwierdził też 800 i 769 px.
