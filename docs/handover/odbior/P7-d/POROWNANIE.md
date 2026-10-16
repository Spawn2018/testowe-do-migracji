# wyglad/P7-d — Harmonogram › Rejsy według E30 pkt 7 (16.10.2026, 11:50)

Podstawa:
- E30 pkt 7 („Rejsy: nagłówek »Gdańsk → Nynäshamn i Gdynia → Karlskrona«; domyślnie tylko do Szwecji, »Pokaż powroty«; »Stena Line«; kolumna »Transporty« z kodami (klik filtruje Harmonogram); zasięg rozkładów pod tabelą; edycja tylko Administrator HHL”) i pkt 9 („Rejsy nie pokazują »sail_src_«”);
- makieta `makiety_html/E30/harm.html` (sekcja „Po zmianie · telefon i Rejsy”), raport `img/e30-after`;
- E9 19:11 (rejsy zmienia tylko Administrator HHL), E8 (telefon: tabela → karty);
- PLAN §4 P7, E30.

Wygląd, teksty i obliczenia widoku (F8), bez zapisów. **Złożone na #256 (`wyglad/P7-c`)** — scalasz po #256.

| Miejsce | Było | Jest |
|---|---|---|
| Nagłówek | „Rozkład Gdańsk ⇄ Nynäshamn” (a lista ma też Gdynię i Karlskronę) | „Gdańsk → Nynäshamn i Gdynia → Karlskrona” |
| Filtry | „Przyszłe”, „pokaż minione” | „Przyszłe” (domyślnie) i „Pokaż powroty”; domyślnie tylko rejsy do Szwecji (GDN → NYN, GDY → KAA) |
| Kolumny | Statek · Trasa · Odejście · Przypłynięcie · Status · Źródło · Transporty (liczba) | Odejście · Statek · Trasa · Przypłynięcie · Źródło · Transporty (jak makieta); status tylko gdy inny niż planowy — „odwołany”, „opóźniony”, „wypłynął” przy godzinie |
| Godziny | „08.10.2026 08:00” | „08.10, 08:00”; rok tylko, gdy inny niż bieżący („09.01.2027, 18:00”) |
| Źródło | „sail_src_STENA” (brak tłumaczenia) | „Stena Line”, „Polferries”, „HHL ręcznie”, „dane startowe” |
| Transporty | liczba (wszędzie 0) | kody transportów rejsu, np. „SG-15, SG-16”; kliknięcie → zakładka Transporty z filtrem „Rejs: Wawel · 08.10, 18:00 ✕” (liczony w „Filtry · n” i w „Wyczyść”) |
| Pod tabelą | zdanie o źródle Polferries | „Rozkład w bazie: Stena Line do 18.10, Polferries do 09.01.2027.” (ostatnie odejście na armatora, bez odwołanych) + zdanie o edycji + licencja Polferries |
| Edycja | Administrator HHL: Dodaj rejs, Opóźnienie, Odwołaj | bez zmian (te same uchwyty `data-sail-*`); inni: „Rejsy zmienia tylko Administrator HHL.” |
| Telefon | ta sama tabela | karty: godzina · statek, trasa i przypłynięcie, źródło i transporty; przyciski ≥ 44 px |

**Różnice wobec makiety (z powodu):**
- dane demo mają tylko rozkład Polferries Gdańsk → Nynäshamn („dane startowe”) — Stenę i powroty dodaje test przez „Dodaj rejs”; na produkcji tabela czyta 250 rejsów z bazy (Polferries i Stena, oba kierunki);
- kolumna z przyciskami „Opóźnienie” / „Odwołaj” tylko u Administratora HHL (makieta pokazuje podgląd).

**Produkcja:** działa od razu na dzisiejszych danych (`sailings` z `vessels.operator`, `loads.sailing_id`) — nic do podłączenia (D-20261016-1150-01).

**Sprawdzone:**
- unit `sail-view` (8): tylko do Szwecji i „Pokaż powroty”, „Przyszłe” po godzinie po opóźnieniu, kody rosnąco, armator z trasy i operatora, „Stena Line”, zasięg z rokiem tylko przy innym roku, format godzin, bez starych kluczy; `sailings` bez zmian;
- e2e blok `wyglad/P7-d` (3): HHL 1366 — kolumny, tylko do Szwecji, „Pokaż powroty”, zasięg, „Przyszłe”, kod odwołanego rejsu → Harmonogram z filtrem i zdjęcie filtra; KSH 1440 — tylko podgląd; telefon 390 — karty, cele ≥ 44 px, bez przewijania w bok;
- `etap4-ui` M10 (dodanie, opóźnienie, odwołanie, KSH bez przycisków) — zielony bez zmian;
- pierwsze wczytanie 389,1 kB gzip (Rejsy w części Harmonogramu, ładowanej osobno).

**Zrzuty:** `rejsy-1366-hhl.webp`, `rejsy-1366-hhl-powroty.webp`, `rejsy-kody-filtr-1366.webp`, `rejsy-1440-ksh.webp`, `rejsy-telefon-390.webp`.
