# wyglad/J4 — „Ocena przewoźników” w Kokpicie (16.10.2026, 20:30; poprawki po F7 — 21:00)

Podstawa:
- raport audytu, tabela E11/E12 (Preferencje i pozostałe): „Ocena przewoźnika to raport, nie ustawienie. … ocena przewoźnika → Kokpit (E9)”;
- D-20261014-0700-01 J4 i D-20261014-1420-01 R7 pkt 2: „według raportu (E9) w Kokpicie; element wyglądu robi koordynator”;
- karta III-9 i D-23 (te same liczby i zdanie „Na czas = …”);
- E8 (telefon), E10 (tokeny), decyzja 16.10 14:09 (DD.MM.RRRR).

Wygląd, teksty i obliczenia widoku (F8). Produkcja czyta dane jak dotąd — `carrier_scorecard` i `carrier_ratings` (bez nowych funkcji bazy).

| Miejsce | Było | Jest |
|---|---|---|
| Opcje › Dla mnie › Wygląd i waluta (HHL) | karta „Ocena przewoźników” z polami dat | brak — tylko waluta i motyw |
| Ustawienia › Wygląd i waluta (SCX) | karta „Twoja ocena i punktualność” | brak |
| Kokpit HHL | — | panel „Ocena przewoźników” pod listą „Najpilniejsze” i mapą, z kolumnami:<br>• Przewoźnik;<br>• Rozładowane;<br>• Na czas (liczba i %);<br>• Opóźnienia z winy przewoźnika;<br>• Śr. spóźnienie („45 min”, „2 h 10 min”, „1 d 3 h”);<br>• Ocena HHL („4,17 / 5 (12)”).<br>Okres:<br>• „Całość” (domyślnie, do dziś);<br>• „4 tygodnie”;<br>• „Własny okres” — pola „Rozładunek od / do”, jak dotąd w karcie III-9. |
| Kokpit SCX | — | panel „Twoja ocena i punktualność”: swój wiersz i „Ostatnie oceny transportów” (5, potem „Pokaż wszystkie (n)”), data DD.MM.RRRR, bez notatki HHL |
| Kokpit KSH | — | bez panelu (E9) |
| Telefon 390 | — | karty z parami „nazwa — wartość”, przyciski okresu i „Pokaż wszystkie” ≥ 44 px, tekst ≥ 12 px, bez przewijania w bok |

**Różnice wobec makiety:** raport nie ma makiety tego panelu.
- Układ i kolumny są jak w dotychczasowej karcie III-9.
- Do pól dat doszły dwa szybkie okresy.

**Poprawki po niezależnym sprawdzeniu (F7):**
1. Lista ocen SCX w okresie liczona po dniu rozładunku transportu (jak wiersz karty), nie po dacie oceny.
2. Bez rozładunków z przyszłości (demo); „Całość” kończy się dziś.
3. Wrócił własny okres („Rozładunek od / do”).
4. Lista ocen z nagłówkami „Transport · Ocena · Data oceny”.
5. Demo: z winy przewoźnika tylko część spóźnień.
6. Podgląd HHL jako SCX na produkcji: przy kilku przewoźnikach kolumna nazwy wraca.
7. PWA kierowcy: lista dokumentów tylko CMR (dopełnienie C13).

**Demo:** liczby z transportów demo rozładowanych do dziś.
- Spóźnienia i oceny 1–5 są wymyślone i stałe dla transportu (G-09).
- Panel ma znak „DEMONSTRACYJNE”.

**Sprawdzone:**
- unit `carrier-rating` (8):
  - okresy (także własny);
  - oceny SCX po dniu rozładunku;
  - koniec okna dostawy (lato i zima);
  - teksty;
  - demo HHL i SCX bez dat z przyszłości;
  - miejsce w aplikacji;
- cały unit 1481 zielonych;
- telefon 360 i 390, HHL i SCX, także „Własny okres”:
  - 0 tekstu < 12 px;
  - przyciski i pola ≥ 44 px;
  - bez przewijania w bok;
- pierwsze wczytanie 371,0 kB gzip;
- pakiet demo bez `sms:`, `mailto:`, `supabase`.

Test lokalny `iii9-rating.local` przepisany na Kokpit.

**Zrzuty:** `ocena-hhl-1440.webp`, `ocena-scx-1440.webp`, `ocena-hhl-390.webp`, `ocena-scx-390.webp`, `ocena-custom-360.webp`.

Pole daty pokazuje format przeglądarki — w polskiej przeglądarce DD.MM.RRRR (jak wszystkie pola dat w aplikacji); zrzut z przeglądarki testowej ma format angielski.
