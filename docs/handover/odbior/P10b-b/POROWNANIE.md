# wyglad/P10b-b — Pomoc: Jak pracuję (5 wersji), Co nowego, Kontakt, Skróty (16.10.2026, 08:10)

Podstawa:
- E37 pkt 3 (zdecydowane 08.10 12:14) — Pomoc:
  - panel z prawej (na telefonie cały ekran) z zakładkami Jak pracuję, Co nowego, Kontakt, Skróty;
  - „Jak pracuję” w 5 wersjach, kliknięcie kroku otwiera miejsce;
  - „Kontakt”: Operacje HHL z telefonem z kont i „Zadzwoń”;
  - „Skróty” tylko na komputerze, „Zmień widok” tylko HHL;
  - Instrukcja znika z Opcji i Ustawień, Instrukcja kierowcy bez zmian;
- treść „Jak pracuję” — dosłownie z D-20261009-0015-01 (L38, z poprawkami 09.10);
- makieta `makiety_html/E37/pasek.html` („Pomoc · Operacje HHL”);
- PLAN §4 P10b.

Wygląd, teksty i przejścia (F8), bez zapisów. **Złożone na #251 (`wyglad/P9-f`)** — scalasz po #251.

| Miejsce | Było | Jest |
|---|---|---|
| „?” w pasku górnym | lista skrótów klawiszy (KeyboardHelp) | Pomoc: panel z prawej z zakładkami Jak pracuję · Co nowego · Kontakt · Skróty; „?” na klawiaturze otwiera i zamyka |
| Menu konta › Pomoc | lista skrótów | ta sama Pomoc; na telefonie na cały ekran, bez „Skrótów” |
| Jak pracuję | brak (Instrukcja w Opcjach, tylko produkcja, treść sprzeczna z decyzjami) | 5 wersji według rodzaju konta: HHL Administrator 17 kroków, HHL Operacje 13, KSH Użytkownik 10, SCX Dyspozytor i SCX Użytkownik po 11; w Podglądzie — wersja podglądanej firmy; na telefonie + 2 kroki „Na telefonie” |
| Kliknięcie kroku | — | otwiera miejsce: widok z menu, Harmonogram › Rejsy, Ryzyka › Do zrobienia, Finanse › Paczka tygodnia, Opcje › Użytkownicy, menu konta, przełącznik Podglądu (podświetlony); „Panel transportu” → Harmonogram |
| Co nowego | — | zmiany z datą (najnowsze pierwsze) |
| Kontakt | — | Operacje HHL z telefonem i „Zadzwoń” |
| Skróty | lista w osobnym okienku | K, M, H, R, D, F (Finanse / Rozliczenia / Moje stawki), Shift + R „Zmień widok (Podgląd)” tylko HHL, T, Esc, ? |
| Opcje › Dla mnie › Instrukcja; Ustawienia › Instrukcja | zwinięty panel (produkcja) | nie ma; Instrukcja kierowcy w PWA bez zmian |

**Nazwy w tekście = nazwy w aplikacji (dopisek 0015 pkt 1).** Różnice poprawione w tekście:
- „Harmonogram › Rejsy do Szwecji” → „Harmonogram › Rejsy”; to samo w tekstach kroków HHL Operacje 3, KSH 2 i SCX 3 („Rejsy”, „W zakładce »Rejsy«”) — zakładka w aplikacji nazywa się „Rejsy”.

Bez zmian, bo jeszcze tego nie ma w aplikacji:
- „Widok skrócony” (E30, Harmonogram w układzie pliku) — tekst zostaje według decyzji;
- „Treści wiadomości” (P8-a, #232) — w kolejce.

Innych zmian treści nie ma.

**Demo:**
- „Co nowego” i „Kontakt” z oznaczeniem „Demonstracyjne”: przykłady zmian i osoba z puli zmyślonej (G-09).
- Produkcja: oba z danych — D-20261016-0810-01.

**Sprawdzone:**
- unit `help-content` (6): liczba kroków; każda pozycja menu roli ma krok z celem; krok „konto”; KSH bez „marża”, „numer zlecenia HHL”, „Twoja stawka”; SCX bez „marża”, „Twoja cena”; bez kodów, telefonów, kwot i dat (G-09); SCX Użytkownik = SCX Dyspozytor; Opcje i Ustawienia bez Instrukcji;
- `i4-guide` przepisany: Instrukcja tylko w PWA kierowcy;
- e2e blok P10b-b (2); cała specyfikacja e8-phone-gate + AUD-01e + B-7 — 98/98:
  - komputer: HHL, KSH i SCX — wersja i liczba kroków; każdy z 16 celów HHL otwiera swoje miejsce; Kontakt, Co nowego, Skróty („Zmień widok” tylko HHL);
  - telefon 390: menu konta → Pomoc na cały ekran, 3 zakładki, 12 kroków, wiersze ≥ 44 px, krok → Dokumenty;
- cały zestaw unit zielony;
- pierwsze wczytanie 397,3 kB gzip (panel Pomocy ładowany osobno, po otwarciu).

**Zrzuty:** `pomoc-1440-hhl.webp`, `pomoc-1440-ksh.webp`, `pomoc-1440-co-nowego.webp`, `pomoc-1440-kontakt.webp`, `pomoc-1440-skroty.webp`, `pomoc-390-ksh.webp`.
