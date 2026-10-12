# WZÓR NOWEGO PROJEKTU — METODA Z TOWER

> Jak zbudować kolejny system (np. ERP spedycyjny) tą samą metodą — z tym, co
> zadziałało, i bez błędów, które kosztowały czas.

## Role
| Rola | Kto | Robi | Nie robi |
|---|---|---|---|
| Właściciel | człowiek | decyduje, dostarcza dane i dostępy, rozmawia z kontrahentami | nie pisze kodu |
| Koordynator | Claude, projekt z pamięcią | makieta, zakres, zlecenia, **niezależna weryfikacja produkcji**, rekomendacje | nie decyduje za właściciela, nie wdraża |
| Wykonawca | agent w repozytorium (Grok, Cursor) | kod, migracje, wdrożenia, testy, raporty | nie decyduje, nie pomija planu |

## Kolejność
1. **Makieta klikalna z prawdziwym wolumenem danych** (TOWER: 50 transportów) —
   pokazywana kontrahentom, potem wzorzec wyglądu 1:1
2. **Rejestr zakresu** — każda funkcja z numerem; nic poza rejestrem
3. **Konstytucja** — zasady nadrzędne, zanim powstanie kod (`01_KONSTYTUCJA.md`)
4. **Etapy z bramami**: testy jednostkowe, testy bazy, testy bezpieczeństwa,
   brama wizualna zrzutów
5. **Produkcja wcześnie, na darmowych planach**, z kopią zapasową od pierwszego dnia
6. **Audyt zakresu przed pilotażem** — co naprawdę działa, co jest fasadą
7. **Dane kontrahentów** (cenniki, umowy, harmonogramy) → weryfikacja liczbowa → system
8. **Pilotaż** na jednym prawdziwym przebiegu od początku do faktury

## Dokumenty
| Dokument | Rola |
|---|---|
| `PLAN.md` | jedyna lista pracy, tylko dopisywana |
| `POSTEP.md` | dziennik wykonawcy |
| `SCOPE.md` | rejestr zakresu + decyzje z datami |
| `03_REJESTR_DECYZJI.md` | stan końcowy każdej decyzji |
| `MOJE_ZADANIA.md` | lista właściciela krok po kroku |
| `ZLECENIE_*.md` | zadanie dla wykonawcy z kryterium odbioru |
| `PACZKA_DECYZJI_*.md` | zbiorcza paczka + lista załączników |
| `.cursor/rules/*.mdc` + `SKILL.md` | zasady i procedury wykonawcy |

## Rytm
- wykonawca pracuje bez przerw; pytania trafiają do „Decyzji oczekujących"
- każdy raport → koordynator sprawdza produkcję → rozbieżności jako nowe pozycje
- właściciel zbiera decyzje i wysyła **jedną paczkę**; wykonawca potwierdza odbiór listą ID
- przekazanie między wykonawcami na 10% limitu, z pakietem przekazania

## Pułapki z TOWER — do uniknięcia od pierwszego dnia
1. **Skrócona reguła** → wykonawca przerobił działający kod. Zawsze pełny warunek i przykład liczbowy
2. **Twierdzenia innych modeli o cenach i licencjach** były nieprawdziwe (Open-Meteo, HERE) — sprawdzać u źródła
3. **Ochrona tylko w interfejsie** → wycieki (eksport, telefon kierowcy). Ochrona w bazie
4. **Sukces zadania = uruchomienie** → zawieszona kopia niezauważona. Sukces = zakończony wynik
5. **Paczki niedostarczone** — dwie rundy straty. Potwierdzenie odbioru
6. **Pliki poufne w publicznym katalogu** (wyciek harmonogramu 23–27.09). Strażnik paczki od pierwszego wdrożenia
7. **Limit wykonawcy do zera** — przerwana praca w połowie. Przekazanie wcześniej
8. **Stare dokumenty obok aktualnych** — inwentarz ze statusem od początku

## Szablon wpisu decyzji
```
D-NN · <sprawa> · <data>
Decyzja: <pełne brzmienie>
Zastępuje: <poprzedni wpis albo „—">
Skutek w systemie: <co wykonawca zmienia>
```
