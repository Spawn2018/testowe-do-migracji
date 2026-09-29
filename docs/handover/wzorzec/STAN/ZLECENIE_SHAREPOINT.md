# ZLECENIE — INTEGRACJA Z HARMONOGRAMEM KSH W SHAREPOINT (II-10)

> 30.09.2026. **Decyzja właściciela:** KSH prowadzi harmonogram w Excelu
> na SharePoint — to jest źródło. Integracja **w obie strony**:
> zmiany KSH → TOWER automatycznie, z historią „co i kiedy się zmieniło";
> dane z TOWER → harmonogram KSH.
> Plik: witryna `STEGRABODEN` na `hyzykspzoo.sharepoint.com` (link u właściciela).
> Przykładowy plik: `haromogram.xlsx` (arkusz `STEGRA`, 17 kolumn,
> nowa kolumna **„Przewoźnik"**). **Zawiera dane osobowe kierowców —
> nie kopiuj ich do repozytorium ani testów; w testach dane zmyślone.**

---

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

## 3. KIERUNEK TOWER → KSH (D-33 rozstrzygnięte przez właściciela)

TOWER wpisuje do pliku KSH dane, które powstają po stronie HHL i przewoźnika:
- **Imię i nazwisko kierowcy · Nr tel. kierowcy · Nr zlecenia**
- **numer rejestracyjny auta** — w pliku nie ma takiej kolumny: dodaj ją
  na końcu arkusza jako „Nr rejestracyjny (TOWER)", po uzgodnieniu z KSH
- **Godzina (załadunek) i Godzina (rozładunek) — nie**: to pola planu KSH,
  KSH je wypełnia
- nigdy nie nadpisuj komórki wypełnionej ręcznie przez KSH — konflikt =
  ryzyko HHL
- zapis pojedynczych komórek, nie całego arkusza
- **pętla:** własny zapis nie może wrócić jako „zmiana KSH"

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
