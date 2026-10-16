# wyglad/P7-c — Harmonogram w układzie pliku KSH, „Widok skrócony”, filtry tygodniem i stanem, telefon (16.10.2026, 10:20)

Podstawa:
- E38 decyzja 1A (08.10 12:50): Harmonogram domyślnie w układzie pliku — kolejność i nazwy z pliku, po prawej Status, ETA, Dokumenty, kwota; przewijanie w bok z przyklejonymi „Typ” i „Wysyłka”; 8 kolumn E30 jako „Widok skrócony”; KSH bez kolumn numerów (E41 1A), kwota według firmy, telefon według E6;
- E30 pkt 1–5 i 8; E20 (1280–1920 px bez nakładania);
- makiety `makiety_html/E38/plik.html` (sekcja 5, „Telefon 390 px”), `makiety_html/E30/harm.html`;
- PLAN §4 P7.

Wygląd, teksty, obliczenia widoku i przejścia (F8), bez zapisów. **Złożone na #254 (`wyglad/P10b-d`)** — scalasz po #254.

| Miejsce | Było | Jest |
|---|---|---|
| Tabela (komputer) | 17 kolumn w kolejności Watch Tower; przeciąganie, szerokości; kwota przyklejona z prawej zasłaniała „Kierowca” przy 1440 px (E20) | **układ pliku**: Typ · Wysyłka (przyklejone) · Rozmiar L × W × H · Waga elementu · Ilość · Waga [t] · Data załadunku · Dzień · Godzina · Kierowca · Tel. · Ciągnik · Naczepa · Nr zlecenia SCX · Data dostawy · Dzień · Godzina · Nr zlecenia HHL │ Status · ETA Boden · Dokumenty · kwota (kolumny Watch Tower za kreską, tłem odróżnione) |
| Dzień, przepięcie, „...” | — | dzień po polsku („pon.”); „A → B” = odcinek PL → SE; czerwony „?” = w pliku „...”; ☎ = zadzwoń |
| „Widok skrócony” | — | 8 kolumn E30: Transport (nazwa E41, „BRAK NR HHL”), Ładunek, Załadunek → dostawa, Status (z datą dostawy), Kierowca i zestaw (☎, tablice), ETA Boden, Dokumenty (brak i kto wgrywa), kwota z marżą — bez przewijania w 1366 px |
| „Kolumny” | lista 17 kolumn | układ pliku — ukrywanie kolumn pliku; skrócony — dodatkowe: numery osobno, telefon, ciągnik, naczepa, rejs, koszt (koszt tylko HHL) |
| Przyciski nad tabelą | Wgraj plik, Zapisz widok, Kolumny, Eksport XLSX, Eksport PDF | Transporty · Rejsy · Kolumny · Widok skrócony · Więcej ▾ (Eksport XLSX / PDF tego, co widać; Wgraj plik KSH — zapas, tylko HHL; Przywróć kolumny domyślne) |
| Filtry | „Jak działa”, szukaj, daty od–do, 4 filtry stanu (liczba tylko przy „Opóźnione”) | szukaj („kod, nr zlecenia, kierowca, tablice”), „Załadunek: …” i „Dostawa: …” tygodniem (pon–nd) albo własnym zakresem, stan z liczbami: Opóźnione, Bez dokumentów, Bez kierowcy, Bez ciągnika, **Anulowane** (E30 pkt 3), „N z M” |
| Wiersz | „Zmień ciągnik” z oknem przeglądarki | bez — zestaw w oknie Awizacja (E30 pkt 5, E32); kliknięcie otwiera panel |
| Kwota | koszt, przychód, marża (HHL) | HHL „Przychód” + „marża (%)”, KSH „Twoja cena”, SCX „Moja stawka”; marża czerwona tylko poniżej progu z Opcji (E16) |
| Telefon | szukaj, „⋯”, 2 filtry w rzędzie, „Filtry ▾” z datami | pasek etapów w bok, „Szukaj”, „Filtry · n” (arkusz od dołu: tydzień załadunku, tydzień dostawy, stan z liczbami, „Wyczyść”, „Pokaż N”), „⋯” (Więcej); karty: nazwa, status, ładunek · sztuki · masa · daty z dniem, kierowca |

**Różnice wobec makiety (z powodu):**
- karta na telefonie zawsze krótka (jak druga karta w makiecie E38 i karty E30); szczegóły pliku w panelu po dotknięciu — dotknięcie karty otwiera panel (E30 pkt 5);
- Typ w demo to skrót („SG”, „T”) — tak jest w danych przykładowych; w produkcji nazwa z pliku („Słupy główne”).

**Produkcja:** układ działa od razu na dzisiejszych danych. „Waga elementu” i „ZMIANA NUMERACJI” — po zapisie z importu, układ kolumn na koncie, eksport tylko widocznych kolumn, linia „SharePoint: zsynchronizowano” — D-20261016-1020-01.

**Sprawdzone:**
- unit `sched-layout` (11): kolumny pliku w kolejności i z nazwami z pliku; KSH bez numerów; kwota według firmy; 8 kolumn skróconego; dodatkowe kolumny według firmy; daty i dni po polsku; „A → B” i „?”; ETA; Dokumenty; tygodnie pon–nd; filtry stanu; nazwa pliku eksportu; zapis układu; bez „Zmień ciągnik”, „Zapisz widok” i okna przeglądarki;
- `aud03-ksh-panel` przepisany: Harmonogram bez „Zmień ciągnik”, prawa do zestawu bez zmian;
- przepisane do nowego układu (uruchamia je bramka `visual`): `visual-states` (`stan-blad`, `stan-walidacja`: wgranie pliku przez „Więcej ▾”), `etap4-ui` (M5, M8, D26), `etap5-ui` (D14, D15), `aud03-ksh-panel.spec`, `d-eur-t` — lokalnie zielone; wzorce zrzutów Harmonogramu odświeżone w GitHub Actions;
- e2e blok P7-c (3):
  - komputer 1366, HHL: nagłówki pliku; strona bez przewijania w bok; „Wysyłka” na miejscu po przewinięciu; kreska przed „Status”; bez „Zmień ciągnik”; wiersz → panel; „Widok skrócony” bez przewijania; „Kolumny” → „Naczepa”, układ po przeładowaniu, „Przywróć kolumny domyślne”; tydzień załadunku; liczba przy każdym filtrze stanu = wiersze;
  - komputer 1440: KSH bez numerów, „Twoja cena”; SCX „Moja stawka”;
  - telefon 390: pierwsza karta nad dolnym paskiem, arkusz — cele ≥ 44 px, „Pokaż N” = karty, „Filtry · 1”, „Wyczyść”;
- przepisane w bramie E8: arkusz „Filtry” zamiast „Filtry ▾”, filtr „Anulowane”;
- cały zestaw unit zielony; cała specyfikacja e8-phone-gate + AUD-01e + B-7;
- pierwsze wczytanie 389,2 kB gzip (Harmonogram ładowany osobno).

**Zrzuty:** `plik-1366-hhl.webp`, `plik-1366-hhl-w-prawo.webp`, `skrocony-1366-hhl.webp`, `kolumny-1440.webp`, `wiecej-1440.webp`, `plik-1440-ksh.webp`, `skrocony-1440-scx.webp`, `telefon-390.webp`, `telefon-390-filtry.webp`.
