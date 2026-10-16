# wyglad/P7-e i P7-e2 — stan synchronizacji pliku KSH (SharePoint) (16.10.2026, 18:05 i 19:50)

Podstawa:
- W13 — akceptacja mapowania przez właściciela 16.10, 12:18;
- D-20261016-1230-01: zasada 15 (linia nad Harmonogramem, „Nie działa” po 30 min, alarm), zasada 16 (dziś tylko odczyt, sekret — ostrzeżenie 30 dni wcześniej), pkt 5.6 (wygląd na polu wykonawcy);
- D-20261016-1845-01 pkt 3.1 (kształt pola `kshSharePointSync`);
- właściciel 16.10, 14:09 pkt 4 (DD.MM.RRRR, GG:MM);
- E23 (Stan systemu), E25 / audyt B-03 („Rozładowany” = „Dostarczone”), E8 (telefon).

Wygląd, teksty i obliczenia widoku (F8), bez zapisów.
- #268 (`wyglad/P7-e`) — scalony 16.10, 19:05.
- `wyglad/P7-e2` — poprawki po niezależnym sprawdzeniu (F7).

| Miejsce | Było | Jest |
|---|---|---|
| Harmonogram, nad tabelą | „Plik KSH: wersja 7 z 21.09.2026, 14:08” (B-09) | Z polem wykonawcy: „Plik KSH (SharePoint): zsynchronizowano 16.10.2026, 08:05”. Ponad 30 min bez udanego odczytu: „Plik KSH (SharePoint): nie działa — ostatni odczyt 16.10.2026, 07:23” na czerwono. Bez żadnego odczytu: „… nie działa — brak odczytu”. Bez pola zostaje linia B-09. Zdanie w całości (bez wielokropka); na telefonie linia ukryta jak B-09 (E8). |
| Podpowiedź linii | — | „Ostatnia próba odczytu nieudana — następna za kilka minut” (gdy dotyczy), „Ostatni przebieg: nowe · zmienione · pominięte · NTG · sprawy”, „Zapis do pliku wyłączony — dostęp tylko do odczytu” albo godzina ostatniego zapisu. |
| Opcje › System › Stan systemu | brak wiersza pliku KSH | Wiersz „Plik KSH (SharePoint)”, co 5 min, „Zasila: Harmonogram: transporty HHL z pliku KSH; wiersze NTG pomijane”. Stany:<br>• „Działa” z ostatnim przebiegiem;<br>• „Częściowo”, gdy ostatnia próba odczytu była nieudana, a udany odczyt jest młodszy niż 30 min, albo gdy sekret wygasa w ciągu 30 dni („(dziś)”, „(za 1 dzień)”, „(za 17 dni)”);<br>• „Nie działa od 07:53” (ostatni odczyt + 30 min) z alarmem do Administratorów HHL;<br>• „Nie działa” bez godziny, gdy pliku nigdy nie odczytano;<br>• „Nie działa” od końca dnia ważności, gdy sekret wygasł. |
| Stan systemu na produkcji | dzisiejszy panel (Stan systemu czeka na dane źródeł, D-20261016-0845-01) | wiersz „Plik KSH (SharePoint)” nad dzisiejszym panelem, gdy wykonawca poda pole (`KshSyncSourceBlock`). |
| Kwoty i Awizacja | „Rozładowany” bez daty rozładunku liczony jak w drodze | `unloadedAtOf` i ostrzeżenie o zajętym kierowcy w oknie Awizacja traktują „Rozładowany” jak „Dostarczone” (E25, B-03). Przy prawdziwej dacie rozładunku nic się nie zmienia. |

**Poprawki po niezależnym sprawdzeniu (F7, 16.10, 19:35) — `wyglad/P7-e2`:**
1. „Nie działa” tylko po 30 min bez udanego odczytu albo bez żadnego odczytu. `sourceOk = false` przy świeżym odczycie to „Częściowo” ze zdaniem o nieudanej próbie, bez „od ponad 30 min”.
2. „Od kiedy” = ostatni odczyt + 30 min, nie godzina odczytu.
3. Wygasły sekret = „Nie działa”, nie „Częściowo”.
4. W dniu wygaśnięcia sekretu „(dziś)” zamiast „(za 0 dni)”.
5. Koniec dnia ważności sekretu w czasie polskim także zimą (`zoneOffsetIso`, `TZ_OPS`), nie na sztywno `+02:00`.
6. Na produkcji wiersz stoi nad dzisiejszym panelem stanu — wcześniej pokazałby się dopiero po podłączeniu Stanu systemu (P10a).
7. Kształt pola zapisany w dopisku 1845 pkt 3.1 (wcześniej tylko odsyłacz do `POSTEP.md`).
8. „Sprawdź teraz” w demo zwraca stan wiersza, a nie zawsze „Działa”.

Nieczytelna data odczytu = „brak odczytu”.

**Kontrakt pola** (dla wykonawcy):
- `sourceOk = false` oznacza nieudaną ostatnią próbę odczytu;
- „Nie działa” liczy widok z wieku `lastReadAt` (> 30 min) — ta sama reguła co alarm `SOURCE_DOWN`.

**Sprawdzone:**
- unit `ksh-sync-view` (16):
  - linia, przyczyny stanu, dokładnie 30 min, nieudana próba, brak odczytu i nieczytelna data;
  - „od kiedy”, sekret: 14 dni, dziś, 1 dzień, wygasł, zima;
  - zapis, przebieg, podłączenie ekranów i bloku produkcyjnego;
  - „Rozładowany” w kwotach i Awizacji;
- cały unit: 1475 zielonych;
- `tsc`, `lint:css`, `oxlint`;
- pierwsze wczytanie 370,7 kB gzip;
- telefon 390: wiersz bez tekstu < 12 px i bez przewijania w bok.

**Zrzuty** (dane przykładowe w buildzie lokalnym; demo nie ma jeszcze pola — doda je wykonawca):
- `harmonogram-ok-1440.webp`, `harmonogram-down-1440.webp`;
- `stan-ok-1440.webp`, `stan-retry-1440.webp`, `stan-down-1440.webp`, `stan-down-390.webp`.
