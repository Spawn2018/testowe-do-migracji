# wyglad/W-przed-wydaniem-2 — liczba w całości i razem z jednostką, kod transportu w całości — 18.10.2026

Podstawa: odbiór wyglądu przed wydaniem (`ODBIOR_WYGLADU_PRZED_WYDANIEM.md`); uwaga F7 do #297 („SG-13” łamie się na łączniku w Dokumentach); E8 (nic nie łamie się w środku liczby ani numeru); zasada polskiej typografii — liczba i jednostka w jednej linii.
Tylko wygląd i teksty (F8). Dwie rzeczy: (1) zwykły odstęp zamieniony na twardą spację (U+00A0) — między liczbą a jednostką oraz jako separator tysięcy w `formatPlNumber` (jedna funkcja liczb w aplikacji, E21) i między kwotą a walutą w `formatPlMoney`; (2) kody transportów w Dokumenty › Uwagi w osobnych `<span class="doc-code">` bez łamania wiersza (`CodeRun`, `.doc-code{white-space:nowrap}`). Słowa, wartości i dane bez zmian; wygląd liczby ten sam (odstęp tej samej szerokości).
PR stoi na #297 (`wyglad/W-przed-wydaniem-1`), a ten na #295: scalić po nich.

Przegląd całej aplikacji. Ustawienia: zegar 20.11 (i 23.09 przy pierwszym przeglądzie), konta HHL, SCX i KSH, szerokości 1440 / 1280 / 390 / 360, 12 stron. Szukane: liczba złamana na separatorze tysięcy, liczba oderwana od jednostki (h, min, km, dni, %, PLN, EUR, SEK, m/s) i kod transportu złamany w środku. Przed zmianą — 11 miejsc, po zmianie — 0:

| Miejsce | Było (koniec linii) | Jest |
|---|---|---|
| Dokumenty › wymagania › „Termin” (1440, 1280) | „po „Dostarczone”, do 24” / „h” | „do” / „24 h” — także pozostałe terminy z liczbą godzin („{h} h przed załadunkiem”, „do {h} h po załadunku”, „{h} h przed promem”, „do {h} h po rozładunku”) |
| Dokumenty › wymagania › „Uwagi” (1440 u HHL i SCX, 1280 u KSH) | „…, SG-10, SG-” / „13 … (65)” — kod złamany na łączniku | każdy kod w całości (`.doc-code{white-space:nowrap}`); tekst listy bez zmian („…; SG-23, SG-02, … (65)”) |
| Dokumenty › opis pod wymaganiami (telefon 390, wszystkie konta) i opis terminów | „w ciągu 7” / „dni” | „7 dni” razem |
| Finanse › kurs NBP (1280, HHL) | „1 EUR = 4,3588” / „PLN” | „4,3588 PLN” razem |
| Faktury › kafelek „Do Twojej weryfikacji” (1280, HHL i SCX) | „różnica 180,00” / „PLN” | „180,00 PLN” razem |
| Opcje › „Zaproś osobę” — opis e-maila zaproszenia (1440, HHL) | „ważne 7” / „dni” | „7 dni” razem; „24 h” też |
| Opcje › stan systemu › źródło „Wiatr — SMHI” (1280, HHL; dane demo) | „od 25” / „m/s postój” | „25 m/s” razem |
| Opcje › Opłata paliwowa › „Jak liczymy”, krok 4 „Opłata” (1440, KSH) | „= 362,25” / „EUR” | „362,25 EUR” razem |
| Ryzyka › drogi SE (1440; dane demo) | „+90–150” / „min”, „+180–240” / „min” | „+90–150 min”, „+180–240 min” razem (także „+15–25 min”) |
| Faktury › karta faktury, opis pod kwotą (telefon 360, wszystkie konta) | „VAT 18” / „245,92” — kwota złamana na separatorze tysięcy | „18 245,92” w całości — dotyczy każdej liczby z `formatPlNumber` w aplikacji |

Obrazy (zegar 20.11):
- `przed-dokumenty-1440.webp` / `po-dokumenty-1440.webp` — wiersz „CMR z podpisem odbiorcy”: termin i lista kodów;
- `przed-faktury-1280.webp` / `po-faktury-1280.webp` — kafelek „Do Twojej weryfikacji”;
- `przed-faktury-360.webp` / `po-faktury-360.webp` — telefon 360, karta faktury: „VAT 18” / „245,92” → „VAT” / „18 245,92”.

Testy:
- `tests/etap6-ui.spec.ts` › „Przed wydaniem” — nowy test: konta HHL, SCX, KSH × 12 stron × 1440 / 1280 / 390 / 360. Sprawdza, że żaden kod transportu (SG-…, T-…, SCX-…, HHL/RRRR/…), liczba z separatorem tysięcy ani liczba z jednostką nie stoi w dwóch liniach. Na #297 test pada (37–39 wpisów u trzech kont, zależnie od przebiegu — różnią się wpisy z Ryzyk „150 min” / „240 min” przy 1440), na tej gałęzi przechodzi;
- testy jednostkowe porównujące liczby (`format-pl`, `p5b-money`, `audyt-e-opcje`, `w-audyt`) — oczekiwany separator tysięcy i odstęp przed walutą to U+00A0;
- `tests/p5-docs.test.ts` — `codesText` bez zmian, nowy `codesParts` (wspólny dla tekstu i widoku).

Niezależne sprawdzenie wyglądu (F7, 18.10, 02:10): bez blokerów — „gotowe do scalenia”. Każde miejsce z tabeli potwierdzone przed i po; bez skutków ubocznych (3 konta × 1440 / 1280 / 390 / 360 × 12 stron, każda sekcja Opcji, szczegóły faktur, kreator, tydzień w Finansach: dokument nie szerszy od okna, 0 uciętych pól, 0 tekstów wystających z bloku, zrzuty Kokpitu i Finansów przy 360 piksel w piksel); pola kwot w kreatorze faktury liczą się przy zwykłej i twardej spacji; 312 tekstów z liczbami ma tę samą szerokość przed i po, więc wzorce `visual` w CI się nie zmieniają.
Uwaga na później (F7): zwykłą spację między liczbą a jednostką ma jeszcze ok. 69 szablonów tekstów i ok. 7 miejsc w kodzie z kwotą i walutą; dziś żaden się nie łamie (test = 0), przy innych danych może — wpis w `ODBIOR_WYGLADU_PRZED_WYDANIEM.md`.
