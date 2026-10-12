# ZLECENIE — DECYZJE, POWIADOMIENIA, SMS, USTAWIENIA ADMINISTRATORA (29.09.2026)

> Decyzje właściciela. **Wygrywa ze sprzecznymi wcześniejszymi zapisami** (lista w §0).
> Dane osobowe odbiorców SMS wprowadza właściciel w aplikacji — nigdy w repozytorium.

## §0. Co przestaje obowiązywać
| Było | Jest |
|---|---|
| telefon zapisywany z kierunkowym (`48…`) — SHAREPOINT §0 | **zawsze bez kierunkowego** (§1) |
| SMS do KSH 1 h przed załadunkiem | **SMS do 2 osób na załadunku i 2 na rozładunku przy przekroczeniu stref** (§5) |
| pozycje „Wymaga decyzji" — lista bez działania | **pełny proces decyzji** (§2) |
| powiadomienia tylko dla części zdarzeń | **każde zdarzenie, zmiana statusu, ryzyko i decyzja** (§3) |

**Stan produkcji sprawdzony przez koordynatora 29.09:** rodzaje SMS tylko dla kierowców;
brak tabeli odbiorców; 6 stref ma `notify_orgs = []` — powiadomienia ze stref nie trafiają
do nikogo; brak strefy zbliżania przed Śremem; 0 urządzeń SMS.

---

## §1. TELEFONY — ZAWSZE BEZ KIERUNKOWEGO · P1
- zapis, wyświetlanie, eksport i plik KSH: **numer krajowy, bez kierunkowego**
  (np. `601234567`); bez `+`, spacji i myślników
- wpisanie lub wklejenie `+48…`, `0048…`, `+46…` → kierunkowy **usuwany automatycznie**
  (biblioteka numerów, np. libphonenumber), użytkownik widzi wynik przed zapisem
- **kraj numeru** — osobne pole, domyślnie PL, niewyświetlane w tabelach; służy
  wyłącznie bramce SMS do wysyłki na numer zagraniczny. Numer PL wysyłany bez zmian
- plik KSH (kolumna liczbowa): numer krajowy. Uwaga: numer szwedzki zaczyna się od `0`
  (np. `070…`) — kolumna liczbowa go utnie; w TOWER numer zostaje pełny
- zastępuje regułę z `ZLECENIE_SHAREPOINT.md` §0 („pełny numer międzynarodowy")
Test: `+48 601 234 567` → `601234567`; `0046701234567` → `0701234567` (kraj SE);
odczyt z pliku `601234567` → `601234567`.

---

## §2. CENTRUM DECYZJI — PEŁNY PROCES · P0
Dziś „Wymaga decyzji" w kokpicie i w Ryzykach to lista bez działania. Ma być proces:
**zdarzenie → ryzyko → decyzja → skutek w systemie → historia.**

### Model
| Pojęcie | Co to jest |
|---|---|
| **zdarzenie** | fakt: wjazd w strefę, zmiana daty, awizacja, import |
| **ryzyko** | stan wymagający uwagi, z poziomem (info / ostrzeżenie / krytyczne) |
| **decyzja** | ryzyko, które wymaga wyboru człowieka: **kto decyduje, jakie opcje, co robi każda opcja, do kiedy** |
| **powiadomienie** | dostarczenie zdarzenia, ryzyka albo decyzji do ludzi (§3) |

Stany decyzji: **Nowa → Przypisana → Odłożona (do godziny) → Rozstrzygnięta** albo
**Wygasła** (warunek sam ustąpił — z powodem). Nic nie znika bez wpisu w historii.

### Katalog decyzji — minimum
| # | Sytuacja | Decyduje | Opcje → skutek w systemie | Termin |
|---|---|---|---|---|
| 1 | rejs odwołany albo sztorm na trasie | przewoźnik (HHL widzi) | następny rejs tego armatora · rejs drugiego armatora (tylko jeśli bez odwołań i sztormu) · wstrzymaj → zmiana rejsu w awizacji, nowa ETA, powiadomienia | przed odprawą |
| 2 | ETA po godzinie „najpóźniej do" (> próg) | HHL | powiadom KSH z nową ETA · przyjmij bez powiadomienia (z uzasadnieniem) · eskaluj do przewoźnika | 2 h |
| 3 | KSH zmieniło datę < 5 dni przed załadunkiem | przewoźnik | przyjmuję · nie dam rady — proponuję termin · eskaluj do HHL | 24 h |
| 4 | brak awizacji w terminie (48/12 h) | przewoźnik | dodaj awizację (otwiera okno §4 poprzedniego zlecenia) · zgłoś problem → HHL | termin awizacji |
| 5 | brak zezwolenia lub dokumentu przed „Gotowy" | przewoźnik / HHL | dodaj zezwolenie · wstrzymaj transport | przed załadunkiem |
| 6 | wiersz zniknął z pliku KSH | HHL | anuluj transport (**ostrzeżenie o opłacie**) · zostaw i zapytaj KSH (e-mail) | 24 h |
| 7 | konflikt TOWER ↔ plik KSH (np. nr HHL) | HHL | wartość z TOWER · wartość z pliku | 24 h |
| 8 | błąd w pliku KSH (dostawa przed załadunkiem, data tekstem) | HHL | poproś KSH o poprawkę (e-mail z listą) · pomiń wiersz | 48 h |
| 9 | brak pozycji auta w drodze > próg | przewoźnik | podaj status ręcznie · zgłoś problem → HHL | 1 h |
| 10 | zjazd z trasy z zezwolenia > próg | przewoźnik | objazd uzgodniony (opis) · zgłoś problem → HHL | 1 h |
| 11 | SEFS: cena poza tabelą albo awaria źródła | HHL | uzgodnij rozszerzenie (termin 14 dni) · ostatni mnożnik | 14 dni |
| 12 | kwota SEFS na fakturze ≠ wyliczona | HHL | akceptuj · spór | 7 dni |
| 13 | ponad 3 kratownice jednego dnia | HHL | cena dla 3 · cena ręczna | przed fakturą |
| 14 | polisa przewoźnika wygasa | przewoźnik | wgraj nową polisę → HHL zatwierdza | data wygaśnięcia |
| 15 | zmierzony postój ponad czas wolny | HHL | dodaj dopłatę uzgodnioną (§8 poprzedniego zlecenia) · nie dotyczy | przed fakturą |
| 16 | kopia zapasowa nieudana | administrator | ponów teraz · zgłoś | 1 h |
Katalog w tabeli bazy — nowe typy bez zmiany kodu interfejsu.

### UX i UI
- **każda pozycja „Wymaga decyzji" i „Ryzyko" jest klikalna** → okno decyzji
  (na telefonie pełny ekran): co się stało · dlaczego to ważne (transporty, termin, kwota)
  · **opcje jako przyciski z opisem skutku** · komentarz (wymagany przy części opcji)
  · „Przypisz osobie" · „Odłóż" · link do transportu
- po decyzji: potwierdzenie, pozycja znika z listy, wpis w historii transportu i w historii zmian
- **przekroczony termin → eskalacja** (powiadomienie przełożonego roli / HHL), pozycja na czerwono
- licznik decyzji w kokpicie i w menu
- filtry: moje / mojej firmy / wszystkie (administrator); termin; poziom
Kryterium: każdy z 16 typów przetestowany od wystąpienia do rozstrzygnięcia; skutek
w systemie widoczny; eskalacja po terminie; nic nie znika bez historii.

---

## §3. POWIADOMIENIA — KAŻDE ZDARZENIE · P0
- **do centrum powiadomień trafia każde:** zdarzenie, zmiana statusu, nowe ryzyko,
  zmiana poziomu ryzyka, nowa decyzja, rozstrzygnięcie decyzji, awizacja i jej edycja,
  zmiana w pliku KSH, import, wjazd i wyjazd ze strefy
- dzwonek z licznikiem nieprzeczytanych; stan przeczytania **osobno dla każdego użytkownika**;
  „oznacz wszystkie"; grupowanie po transporcie; kliknięcie → obiekt (transport, decyzja)
- kanały: w aplikacji — zawsze (według §4); e-mail — dla typów zaznaczonych przez
  administratora; SMS — §5
- **naprawić strefy:** dziś `notify_orgs = []` — odbiorcy wynikają teraz z §4
Kryterium: każdy typ z listy tworzy powiadomienie u właściwych firm; test dla trzech ról.

---

## §4. WIDOCZNOŚĆ — ADMINISTRATOR WYBIERA FIRMY · P0
Ustawienia → **„Powiadomienia i decyzje"**: macierz **typ × firma** — pola wyboru
**HHL · Przewoźnik · KSH** (jedna, dwie albo trzy firmy) + kanał e-mail.
- **egzekwowane w bazie** (reguły wierszy na powiadomieniach, ryzykach, decyzjach),
  nie tylko w interfejsie
- **blokady ochronne** — kombinacje, które ujawniłyby dane finansowe, są wyszarzone
  z wyjaśnieniem: koszt — tylko HHL i przewoźnik; przychód — tylko HHL i KSH;
  marża — tylko HHL; systemowe (kopie, integracje) — tylko HHL
- firma decydująca zawsze widzi swoje decyzje; HHL widzi wszystko
- każda zmiana macierzy — w historii zmian; podgląd „jak to widzi KSH" przez „Działaj jako"
- ustawienia domyślne (do zmiany przez administratora):
| Grupa | HHL | Przewoźnik | KSH |
|---|---|---|---|
| statusy transportu, strefy, awizacja, zmiany dat | ✓ | ✓ | ✓ |
| ryzyka promów i pogody, opóźnienie ETA | ✓ | ✓ | ✓ |
| decyzje | ✓ | gdy decyduje | gdy decyduje |
| cennik, SEFS, faktury, dopłaty | ✓ | koszt | przychód |
| integracje, kopie, logowania | ✓ | — | — |

---

## §5. SMS — 2 OSOBY NA ZAŁADUNKU, 2 NA ROZŁADUNKU · P1
- **listy odbiorców w ustawieniach:** „Załadunek — KSH Śrem" (2 osoby) i „Rozładunek —
  plac Stegra Boden" (2 osoby): imię, telefon (§1), kraj. **Wprowadza administrator**
- wyzwalacze (każdy do włączenia/wyłączenia w ustawieniach):
  - **wjazd w strefę zbliżania** — „Auto [rej.] z [wysyłka] zbliża się, ok. [ETA]"
  - **wjazd na teren** — „Auto [rej.] z [wysyłka] wjechało na [miejsce]"
- **nowa strefa zbliżania przed Śremem** (jak „Bufor 50 km przed Boden"); dla Boden istnieje
- jeden SMS na transport na zdarzenie (bez powtórzeń przy wahaniu GPS — histereza strefy)
- polskie SMS bez ogonków, ≤ 160 znaków; limit 150/dobę; SMS niewysłany → e-mail do HHL
- przycisk „Wyślij SMS testowy" przy każdej liście
- później także strefy Stena (Gdynia, Karlskrona) — bez SMS, tylko powiadomienia
Kryterium: symulacja przejazdu przez strefy Śrem i Boden → po 2 SMS na każdą osobę
z właściwej listy, bez duplikatów; wyłączony wyzwalacz nie wysyła.

---

## §6. USTAWIENIA ADMINISTRATORA · P1
**Wszystkie sekcje zwijane, domyślnie zwinięte.** Nagłówek sekcji z opisem i licznikiem
elementów; przyciski „Rozwiń wszystkie" / „Zwiń wszystkie"; pole „Szukaj ustawienia";
działa na telefonie.

Nowe sekcje — **w pełni działające**:
| Sekcja | Co robi |
|---|---|
| **Powiadomienia i decyzje** | macierz z §4; katalog decyzji — terminy i osoby do eskalacji |
| **Odbiorcy SMS i strefy** | listy z §5, wyzwalacze, SMS testowy, stan bramki (ostatni kontakt telefonu) |
| **Progi i terminy** | fala 3,8 m, porywy 40 kn, próg opóźnienia 30 min, wyprzedzenie 5 dni, awizacja 48/12 h, dokumenty 24/6 h, brak pozycji 15 min, zjazd z trasy 2 km — edycja z historią zmian |
| **Stan systemu** | każda integracja: ostatni odczyt, ostatni błąd, włącz/wyłącz; SharePoint „Synchronizuj teraz"; kopie zapasowe — ostatnie 7 i „Wykonaj kopię teraz" |
| **Użytkownicy i sesje** | rola, firma, 2FA, ostatnie logowanie; „Wyślij link do zmiany hasła"; „Wyloguj ze wszystkich urządzeń"; dezaktywacja |
| **Dziennik logowań** | kto, kiedy, skąd, wynik (udane i nieudane) — z dziennika Supabase Auth |
| **Komunikat dla wszystkich** | baner z treścią, terminem ważności i wyborem firm |
| **Eksport danych** | transporty, historia zmian, decyzje — CSV/XLSX, z zachowaniem zasad widoczności |
Istniejące sekcje (cennik, SEFS, wymóg zezwoleń, kalibracja ETA, 2FA) — przeniesione do
tego samego układu zwijanego.
Kryterium: każda sekcja wykonuje swoją akcję na produkcji (test), każda zmiana
ustawienia w historii zmian.

## Kolejność
P0: §2 decyzje · §3 powiadomienia · §4 widoczność
P1: §5 SMS przy strefach · §6 ustawienia administratora · §1 telefony
Wpiąć w kolejkę po P0 z `ZLECENIE_PO_SPOTKANIU_SCX.md` (logowanie, cennik, SEFS).
