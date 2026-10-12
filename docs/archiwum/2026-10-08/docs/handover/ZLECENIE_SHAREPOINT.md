# ZLECENIE — INTEGRACJA Z HARMONOGRAMEM KSH W SHAREPOINT (II-10)

> **Aktualizacja 29.09 po spotkaniu:** KSH wpisuje **datę i godzinę**; „Potwierdź daty"
> usunąć; **mechanizmu wycofania zgody nie budujemy**; „Nr zlecenia" = **numer przewoźnika**,
> „Nr zlecenia HHL" = numer HHL. Szczegóły: `ZLECENIE_PO_SPOTKANIU_SCX.md`.

> 30.09.2026. **Decyzja właściciela:** KSH prowadzi harmonogram w Excelu
> na SharePoint — to jest źródło. Integracja **w obie strony**:
> zmiany KSH → TOWER automatycznie, z historią „co i kiedy się zmieniło";
> dane z TOWER → harmonogram KSH.
> Plik: witryna `STEGRABODEN` na `hyzykspzoo.sharepoint.com` (link u właściciela).
> Przykładowy plik: `haromogram.xlsx` (arkusz `STEGRA`, 17 kolumn,
> nowa kolumna **„Przewoźnik"**). **Zawiera dane osobowe kierowców —
> nie kopiuj ich do repozytorium ani testów; w testach dane zmyślone.**

---

## 0. WZÓR PLIKU — AKTUALNY (`SCRAP_transporty_2026_09_23_REV_01.xlsx`, w `D:\Watch Tower\dane`)

Arkusz `STEGRA`, nagłówek w wierszu 1, **20 kolumn**. Kolejność zmieniła się względem
`haromogram.xlsx` — **mapowanie wyłącznie po nazwach kolumn**, nigdy po pozycji;
nieznana nowa kolumna = ostrzeżenie, nie błąd.

| Kolumna | Znaczenie | Kierunek |
|---|---|---|
| Lp., Typ, Wysyłka, Rozmiar L x W x H, Waga elementu, Ilość elementów, Waga transport [t] | dane ładunku | KSH → TOWER |
| Data załadunku, Godzina (załadunek) | plan załadunku | KSH → TOWER |
| Data dostawy na budowę, Godzina (rozładunek) | plan dostawy — **godzina = „najpóźniej do"** | KSH → TOWER |
| Przewoźnik | `HH` = nasze, `NTG` = nie dotykamy | KSH → TOWER |
| Dzień (załadunek), Dzień (rozładunek) | wyliczane w Excelu, PL albo EN — **ignorować** | — |
| Imię i nazwisko kierowcy, Nr tel. kierowcy | awizacja | **TOWER → KSH** |
| Nr rej. ciągnika, Nr rej. naczepy | awizacja | **TOWER → KSH** |
| **Nr zlecenia** | **numer zlecenia przewoźnika (SCX)** | **TOWER → KSH** |
| **Nr zlecenia HHL** | numer zlecenia HHL | w obie strony — komórka wypełniona w pliku wygrywa |

**Formaty kolumn — ustawione przez właściciela 29.09:**
| Kolumna | Format w Excelu | Odczyt | Zapis przez TOWER |
|---|---|---|---|
| Imię i nazwisko kierowcy, Nr rej. ciągnika, Nr rej. naczepy, **Nr zlecenia**, **Nr zlecenia HHL** | **Tekst** | jako tekst, bez zmian | jako tekst — np. `0002/09/S/2026` nie może stać się datą ani liczbą |
| **Nr tel. kierowcy** | **Liczba** | liczba → same cyfry, bez `.0` i zapisu wykładniczego | **numer krajowy bez kierunkowego** — `ZLECENIE_DECYZJE_POWIADOMIENIA.md` §1 |
**Telefony zawsze bez kierunkowego** (decyzja właściciela 29.09) — szczegóły i testy:
`ZLECENIE_DECYZJE_POWIADOMIENIA.md` §1.

**Pułapki w prawdziwym pliku (sprawdzone 29.09):**
- komórka telefonu sformatowana jako data — Excel zwraca liczbę-serię zamiast numeru.
  Czytaj **tekst komórki**, nie wartość z formatem daty; niepoprawny numer = ostrzeżenie
- data dostawy wpisana tekstem (`14/12/2026` przy KR-07) — rozpoznaj `dd/mm/rrrr`,
  oznacz ostrzeżeniem „data jako tekst"
- „Waga elementu" bywa `-`, „Ilość elementów" bywa tekstem — puste, nie błąd
- wiersz `Lp. 0` (`W-00`, NTG) — pomijany regułą przewoźnika

**TEST ODBIORU — porównanie `haromogram.xlsx` → `SCRAP_…_REV_01.xlsx`** (oba w `D:\Watch Tower\dane`).
TOWER musi pokazać **dokładnie 10 zmian komórek**, nic więcej:
- T-01: Data załadunku 2026-09-29 → 2026-09-30; Godzina (załadunek) 12:00 → 10:00
- SG-02: Godzina (załadunek) 07:00 → 06:00
- SG-03, SG-05, SG-07: Godzina (załadunek) puste → 06:00
- SG-04, SG-06, SG-08: Godzina (załadunek) puste → 08:00
- T-02: Godzina (załadunek) puste → 11:00
Plus: nowe kolumny w pliku (3) jako informacja; 0 nowych i 0 usuniętych wysyłek;
95 transportów HH, 42 NTG pominięte.

**Transporty z załadunkiem przed uruchomieniem systemu** (pierwsze: 29–30.09) —
import jako historyczne: bez alarmów, bez powiadomień, bez SMS.

## 1. CO JEST NASZE — REGUŁA WŁAŚCICIELA

- **Importujemy wyłącznie wiersze: Przewoźnik = `HH` ORAZ wymiary podane**
  (nie „Standard")
- **Przewoźnik = `NTG` i rozmiar „Standard" → inna firma, nie dotykamy.**
  Nie zapisujemy tych wierszy w bazie w ogóle
- każdy inny przypadek (HH + Standard, inny przewoźnik, puste pole) →
  wiersz pominięty + ryzyko HHL „wiersz poza regułą"
- stan pliku z 30.09: 137 wysyłek = **95 HH z wymiarami** + 42 NTG Standard,
  zero przypadków mieszanych
- **klasa STANDARD i D-8 — nieaktualne:** transporty „Standard" nie są nasze.
  Klasę zostaw tylko jako obronę (HH + Standard = ostrzeżenie)

## 1a. DANE KIEROWCY DLA KSH — ZMIANA ZASAD (właściciel)

**KSH widzi na stałe wszystkie dane kierowcy: imię i nazwisko, telefon,
numer rejestracyjny auta.** Właściciel ma zgody RODO wszystkich stron,
bezterminowe do wycofania.
- `load_driver_contacts`: gałąź KSH — pełne dane, bez okna ±24 h,
  tylko transporty swojego projektu; eksport KSH — z danymi kierowcy
- retencja danych kierowcy: zamiast kasowania po 90 dniach — **do wycofania
  zgody**. Mechanizm wycofania: HHL oznacza osobę → dane usunięte lub
  zanonimizowane we wszystkich tabelach i kopiach od następnej nocy,
  wpis w dzienniku
- pozycje GPS — bez zmian (30 dni po rozładunku)
- testy: KSH widzi pełne dane swojego projektu, nie widzi innego projektu;
  wycofanie zgody usuwa dane

## 2. KIERUNEK KSH → TOWER

1. **Dostęp:** Microsoft Graph, aplikacja zarejestrowana w **tenancie KSH**
   z uprawnieniem **`Sites.Selected`** — tylko ta jedna witryna, odczyt
   i zapis. Wymaga zgody administratora IT KSH (**D-32**). Poświadczenia
   wyłącznie w sekretach funkcji Edge. Logowanie kodem na e-mail
   właściciela nie nadaje się do automatu
2. **Wykrywanie zmian co 10 min:** data modyfikacji pliku; zmiana →
   pobranie arkusza → porównanie z poprzednią wersją
3. **Historia zmian:** każda wersja w archiwum (`schedule_imports`,
   tylko dopisywanie — już jest); **różnica na poziomie komórki**: wysyłka,
   kolumna, stara wartość, nowa wartość, czas wersji, autor wersji z SharePoint
   (Graph podaje autora wersji pliku, nie pojedynczej komórki — napisz to
   w interfejsie uczciwie). Widok „Zmiany w harmonogramie KSH" dla HHL
4. **Stosowanie zmian:**
   - nowy wiersz HH → nowy transport
   - zmiana daty → aktualizacja + powiadomienie (I-10); zmiana w ciągu
     N dni przed załadunkiem → ryzyko „późna zmiana"
   - **usunięcie wiersza → NIGDY automatyczne anulowanie** — anulowanie
     kosztuje (15–100% frachtu). Propozycja anulowania do decyzji HHL
   - transport w drodze lub zafakturowany → zmiana nie nadpisuje,
     tylko ryzyko HHL
5. **Kontrola jakości przy każdym odczycie** — nie importuj po cichu:
   dostawa przed załadunkiem, dostawa w dniu załadunku, więcej niż 10 dni
   między załadunkiem a dostawą, brak daty, wymiary poza cennikiem →
   ryzyko HHL z listą wierszy
6. **I-18 do przeglądu:** skoro KSH prowadzi daty w pliku, osobne
   „Potwierdź daty" w TOWER może być zbędne. Zaproponuj, jak połączyć
   status dat z plikiem

## 3. KIERUNEK TOWER → KSH

TOWER wpisuje do pliku KSH dane z awizacji (kolumny już są w pliku):
**Imię i nazwisko kierowcy · Nr tel. kierowcy · Nr rej. ciągnika · Nr rej. naczepy ·
Nr zlecenia (numer przewoźnika) · Nr zlecenia HHL** (ten ostatni tylko do pustej komórki).
- **Godziny załadunku i rozładunku — nigdy**: to pola planu KSH
- nie nadpisuj komórki wypełnionej ręcznie inną wartością — konflikt = ryzyko HHL
- **edycja awizacji w TOWER** → aktualizacja tych samych komórek, które TOWER wcześniej zapisał
- zapis pojedynczych komórek, nie całego arkusza; własny zapis nie wraca jako „zmiana KSH"

## 4. DO CZASU ZGODY IT KSH

Buduj i testuj na **kopii pliku** z danymi zmyślonymi: parser, reguła HH,
różnice na poziomie komórki, kontrola jakości, zapis zwrotny do kolumn,
pętla. Połączenie z Graph — gdy przyjdzie D-32.

## TEST NA PRAWDZIWYCH DANYCH

Daty kratownic w pliku są błędne (KR-01…03 wątpliwe, KR-04…06 dostawa
w dniu załadunku, KR-08…15 bez daty). **Nie poprawiamy — KSH poprawi.**
To test: po poprawce TOWER musi pokazać każdą zmienioną komórkę
(wysyłka, kolumna, było → jest, kiedy), przeliczyć konwój i cenę KR
i powiadomić HHL i przewoźnika.

## Kryterium odbioru

- zmiana daty w kopii pliku → w TOWER w ciągu 10 min, z wpisem różnicy
- NTG nie istnieje w bazie; 95 HH z pliku wczytane
- usunięty wiersz → propozycja, nie anulowanie
- zapis zwrotny wypełnia tylko pustą uzgodnioną komórkę; własny zapis
  nie tworzy zmiany KSH
