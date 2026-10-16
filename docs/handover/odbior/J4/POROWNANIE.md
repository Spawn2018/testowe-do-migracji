# wyglad/J4 — „Ocena przewoźników” w Kokpicie (16.10.2026, 20:30)

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
| Kokpit HHL | — | panel „Ocena przewoźników” pod listą „Najpilniejsze” i mapą, z kolumnami:<br>• Przewoźnik;<br>• Rozładowane;<br>• Na czas (liczba i %);<br>• Opóźnienia z winy przewoźnika;<br>• Śr. spóźnienie („45 min”, „2 h 10 min”, „1 d 3 h”);<br>• Ocena HHL („4,17 / 5 (12)”).<br>Okres: „Całość” (domyślnie) albo „4 tygodnie”. |
| Kokpit SCX | — | panel „Twoja ocena i punktualność”: swój wiersz i „Ostatnie oceny transportów” (5, potem „Pokaż wszystkie (n)”), data DD.MM.RRRR, bez notatki HHL |
| Kokpit KSH | — | bez panelu (E9) |
| Telefon 390 | — | karty z parami „nazwa — wartość”, przyciski okresu i „Pokaż wszystkie” ≥ 44 px, tekst ≥ 12 px, bez przewijania w bok |

**Różnice wobec makiety:** raport nie ma makiety tego panelu.
- Układ i kolumny są jak w dotychczasowej karcie III-9.
- Pola dat zastąpiły przyciski okresu: „Całość” i „4 tygodnie”. W Kokpicie to raport na pierwszy rzut oka, a pola dat przeglądarki nie dają DD.MM.RRRR.

**Demo:** liczby z transportów demo.
- Spóźnienia i oceny 1–5 są wymyślone i stałe dla transportu (G-09).
- Panel ma znak „DEMONSTRACYJNE”.

**Sprawdzone:**
- unit `carrier-rating` (7): okres, koniec okna dostawy (lato i zima), teksty, demo HHL i SCX, miejsce w aplikacji (Kokpit tak; Opcje i Ustawienia nie);
- cały unit 1478 zielonych;
- telefon 390 HHL i SCX: 0 tekstu < 12 px, 0 uciętego, przyciski ≥ 44 px, szerokość 390;
- pierwsze wczytanie 373,4 kB gzip;
- pakiet demo bez `sms:`, `mailto:`, `supabase`.

Test lokalny `iii9-rating.local` przepisany na Kokpit.

**Zrzuty:** `ocena-hhl-1440.webp`, `ocena-scx-1440.webp`, `ocena-hhl-390.webp`, `ocena-scx-390.webp`.
