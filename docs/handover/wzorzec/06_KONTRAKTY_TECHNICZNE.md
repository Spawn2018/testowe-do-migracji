# KONTRAKTY TECHNICZNE — INTERFEJSY I ALGORYTMY

> Opis logiki, którą system musi spełniać. Dokładne nazwy tabel, funkcji
> i wartości słownikowych — w repozytorium; tu obowiązujące zachowanie.

## 1. Role i widoczność
| Dane | HHL_ADMIN | HHL_OPS | KSH | Przewoźnik | Kierowca (link) |
|---|---|---|---|---|---|
| transporty | wszystkie | wszystkie | swojego projektu | swoje | swój |
| **marża** | ✅ | wg `can_see_margin` | ❌ | ❌ | ❌ |
| koszt (cennik przewoźnika) | ✅ | ✅ | ❌ | swój | ❌ |
| przychód (cennik HHL) | ✅ | ✅ | swój | ❌ | ❌ |
| **dane kierowcy i auta** | ✅ | ✅ | **pełne, na stałe** (29.09) | swoich kierowców | — (aplikacja ukryta) |
| faktury | wszystkie | wszystkie | HHL → KSH | przewoźnik → HHL | ❌ |
| SEFS — wersje | wszystkie | wszystkie | REVENUE, BOTH | COST, BOTH, tylko uzgodnione | ❌ |
| zezwolenia | zapis | zapis | odczyt | zapis przy swoich | ❌ |
| oceny przewoźnika | zapis | — | ❌ | swoje, bez uwag HHL | ❌ |
| dziennik audytu | ✅ | ❌ | ❌ | ❌ | ❌ |
Anonim: **zero** uprawnień do tabel. Wszystko przez reguły wierszy i funkcje.

## 2. Import harmonogramu
- **tylko wiersze: Przewoźnik = `HH` i podane wymiary**; `NTG` + „Standard" —
  nie zapisujemy wcale; inne przypadki → pominięte + ryzyko HHL
- klucz wiersza: numer wysyłki (`SG-32`, `PL-10.1`); rodzina = prefiks
  (`TS` ≠ `T`, `SS` ≠ `SG`)
- kontrola jakości: dostawa przed załadunkiem · w dniu załadunku · > 10 dni ·
  brak daty · wymiary poza cennikiem → ryzyko, nie cichy import
- usunięty wiersz → **propozycja** anulowania, nigdy automat

## 3. Cennik — wybór pozycji
```
rodzina  ← prefiks numeru wysyłki
kandydaci ← pozycje rodziny (KR: tylko wariant = liczba KR z tą samą datą załadunku, max 3)
pozycja  ← najmniejsza, której max długość, szerokość, wysokość i masa ≥ transport
jeśli brak i przekroczona WYŁĄCZNIE wysokość → najmniejsza obejmująca resztę,
          oznaczenie „wycena przy wysokości z cennika (decyzja właściciela)"
jeśli brak → OSTRZEŻENIE „brak ceny"   (nigdy 0)
```
Zmiana konwoju (nowy, anulowany, przesunięty KR) → przeliczenie wszystkich KR
z tego dnia; faktura wystawiona zamraża cenę.

## 4. SEFS — mnożnik paliwowy
```
codziennie: odczyt OKQ8 (plik historii, kolumna „Diesel") i Orlen (API, zł/m³ ÷ 1000)
w poniedziałek: średnia z pon–niedz poprzedniego tygodnia, zaokr. 2 miejsca
mnożnik_SEK ← tabela SEK (pierwszy próg ≥ cena); mnożnik_PLN ← tabela PLN
mnożnik ← min(mnożnik_SEK, mnożnik_PLN)
stosuj do transportów z datą załadunku w bieżącym tygodniu   [D-34]
kwota ← cena z cennika × (mnożnik − 1)       (tylko stawka transportu)
cena > ostatni próg → ostatni wiersz + ryzyko „rozszerzyć tabelę w 14 dni"
awaria źródła → ostatni ustalony mnożnik + ryzyko
porównanie z kwotą na fakturze przewoźnika → różnica = ścieżka sporu
```
Test: tydzień 28.09–04.10 → **1,14**.

## 5. ETA i opóźnienie
```
postęp    ← rzut pozycji GPS na korytarz (OSM); > 2 km od korytarza → ryzyko
pozostało ← Σ odcinków: km × tempo_odcinka (uczone)
          + odprawa + oczekiwanie na następny rejs z `sailings` + rejs
          + odpoczynek dobowy (obsada 1-os.; prom = odpoczynek)
          + korekta pogodowa/drogowa
ETA       ← teraz + pozostało; pasmo z kwantyli błędów
koniec    ← godzina dostawy z pliku KSH („najpóźniej do"); bez godziny — północ po dniu dostawy (Sztokholm)
opóźnienie← max(0, ETA − koniec); > 30 min → ryzyko + powiadomienie
```
Przykład: okno 8–12, ETA 18:00 → 360 min. Bez okna, ETA 18:00 w dniu dostawy → 0.

## 6. Kalibracja ucząca się
- po rozładunku: czasy odcinków zapisane **na stałe** (GPS znika po 30 dniach)
- nowa wartość = średnia ważona obserwacji i wiedzy wstępnej (D-9); waga rośnie
  z liczbą pomiarów; nowsze ważą więcej
- poprawki kontekstowe (weekend, noc, zima, szerokość ≥ 3,1 m, konwój) od 5 pomiarów
- **zabezpieczenia:** odporne statystyki · max ±10%/tydzień · sprawdzenie wsteczne
  przed zmianą · automatyczne wycofanie · zamrożenie i powrót przez HHL_ADMIN ·
  pomiary z błędami danych wykluczone z powodem
- widok „Dokładność ETA"

## 7. SharePoint (II-10)
- odczyt co 10 min; zmiana pliku → porównanie z poprzednią wersją na poziomie komórki
- zapis: wysyłka, kolumna, było, jest, czas, autor wersji pliku
- zapis zwrotny tylko do: kierowca, telefon, nr zlecenia, nr rejestracyjny
  (nowa kolumna); nigdy nie nadpisuje komórki wypełnionej przez KSH
- własny zapis nie wraca jako „zmiana KSH"

## 8. Bramka SMS (zmiana 29.09)
- **SMS do kierowców — brak.** Jedyny odbiorca: KSH — osoby z listy w ustawieniach
- SMS 1 h przed przewidywanym przyjazdem auta na załadunek w Śremie
- model pobierania z telefonu Android bez zmian; 150/dobę; PL bez ogonków

## 8a. Pozycje pojazdów (zmiana 29.09)
- źródło: API emtrack (przewoźnik) + linki śledzenia podwykonawców; aplikacja kierowcy ukryta
- do czasu API: statusy ustawia dyspozytor ręcznie, z dziennikiem
- data rozładunku: wyjazd ze strefy placu z telematyki, bez niej — potwierdzenie dyspozytora

## 9. Kopia zapasowa
- codziennie 00:30 UTC → R2 przez Worker (tylko PUT), szyfrowanie age
- **sukces = zakończony zapis z `finished_at`**, nie samo uruchomienie
- **w toku > 30 min → błąd + e-mail** (do dodania — ustalenie audytu P0)
