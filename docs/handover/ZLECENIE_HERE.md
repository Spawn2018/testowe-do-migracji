# Zlecenie: integracja HERE — transport ponadnormatywny

Zapisz w repozytorium: `docs/handover/ZLECENIE_HERE.md`. Dopisz do
`POLECENIA_KOORDYNATORA.md` i `PLAN.md` przed rozpoczęciem pracy.
Data: 04.10.2026 · Decyzje właściciela.

**Zasada nadrzędna:** to zlecenie dodaje wyłącznie funkcje oparte na HERE.
Nie zmienia innych mechanizmów aplikacji. Tam, gdzie HERE potrzebuje danych
z istniejących mechanizmów (wymiary, zezwolenia, ryzyka, decyzje, Opcje),
korzysta z nich w obecnej postaci.

---

## 1. Decyzje (dopisz do rejestru decyzji)

| ID | Decyzja |
|---|---|
| **D-77** | HERE wchodzi do systemu. Zastępuje zapis „bez HERE" z D-28. Własny silnik zostaje jako zapas, gdy HERE jest niedostępne albo budżet wyczerpany. |
| **D-78** | Budżet HERE: **do 100 USD miesięcznie**. Ostrzeżenia w Stanie systemu przy 50%, 80% i 100%. Po przekroczeniu 100% system przestaje odpytywać HERE i przechodzi na darmowe wyliczenia — **nigdy nie płaci ponad budżet**. |
| **D-79** | **Zero aplikacji dla kierowców** — decyzja Scandinavian Express. HERE WeGo Pro i pakiet nawigacyjny HERE SDK są wykluczone. Nic nie jest instalowane u przewoźnika ani kierowców. |
| **D-80** | ETA nadal **wyłącznie z pozycji GPS i AIS** (decyzja z 04.10). HERE liczy czas przejazdu **z bieżącej pozycji** — nigdy z planu. |
| **D-81** | Licencja HERE: wyniki przechowujemy **najwyżej 30 dni**. Na stałe zapisujemy wyłącznie własne podsumowania (np. „Kontrola trasy: 2 przeszkody — most X 30 t / zestaw 52 t"). Geometria i surowe dane HERE kasowane automatycznie po 30 dniach. Przed startem sprawdź warunki usługi w koncie HERE właściciela i zapisz wnioski w `POSTEP.md`. |
| **D-82** | Opłaty drogowe (myto) — **poza zakresem**. Nie liczymy i nie pokazujemy. |
| **D-83** | Wymiary zestawów **dla każdego transportu** poda właściciel na etapie budowy aplikacji — Watch Tower będzie je mieć. Kontrola trasy **nie bierze niczego z dokumentów** (zezwoleń). **Przewoźnik nie wprowadza żadnych wymiarów.** |
| **D-84** | Próg wiatru **zatwierdzony: porywy 15 m/s**. Silny wiatr na trasie **wydłuża ETA** — zgodnie z logiką i faktami (sekcja H-10). |
| **D-85** | ETA **w pełni automatyczne**: zero ręcznego wpisu, także prędkości. H-4 po emtrack. Opis i plan testu w sekcji H-4. **20:10:** droga SE z Trafikverket w pełnym zakresie (sytuacje, nawierzchnia, pomiary stacji), nie tylko utrudnienia. Linia ETA „nawierzchnia”. |

---

## 2. Wymiary zestawów — źródło danych

- Wymiary zestawu **dla każdego transportu** poda właściciel na etapie budowy
  aplikacji (D-83). Watch Tower będzie je mieć przy każdym transporcie.
- HERE korzysta **wyłącznie z tych danych**. Nie bierze wymiarów ani tras
  z dokumentów (zezwoleń).
- Przewoźnik **nie wprowadza żadnych wymiarów**. HERE nie dodaje pól wymiarów
  do awizacji ani własnego sposobu ich wprowadzania.
- Do czasu danych od właściciela: H-0 na przykładowych wymiarach; H-1, H-3
  i H-6 gotowe technicznie, uruchamiają się, gdy transport ma wymiary.

---

## 3. Klucze i bezpieczeństwo

- **Klucz serwerowy** `HERE_API_KEY` — właściciel wpisze do sekretów Supabase
  i `.env.local`. Wyłącznie w funkcjach serwerowych. Nigdy z przedrostkiem
  `VITE_`, nigdy w przeglądarce.
- **Klucz do mapy w przeglądarce** (tylko jeśli H-6 go wymaga) — osobny klucz,
  ograniczony w koncie HERE do domen `tower.log-mar.pl`
  i `watch-tower-makieta.vercel.app`. Zapisz instrukcję dla właściciela.
- **Licznik zapytań** dla każdej usługi HERE: liczba, szacowany koszt, budżet.
  Kafelek „HERE" w Stanie systemu.
- Każda funkcja HERE ma **zapas**: brak klucza, błąd albo wyczerpany budżet →
  obecne wyliczenie z informacją „bez danych HERE".

---

## 4. Pozycje

### H-0 · Test na koncie właściciela (najpierw, ok. 1 dzień)
- Trzy prawdziwe odcinki: **Śrem → Gdańsk**, **Nynäshamn → Boden**,
  **Karlskrona → Boden**.
- Wymiary: prawdziwe z Watch Tower, jeśli właściciel już je podał; inaczej
  przykładowe wymiary typowego zestawu ponadnormatywnego.
- Sprawdź: czy HERE znajduje trasę, jakie przeszkody zgłasza (komunikaty
  o naruszeniach ograniczeń z wartościami), czy rozpoznaje szwedzkie klasy
  nośności **BK1–BK4**, ile zapytań zużyto, ile to kosztowało.
- Raport z porównaniem do trasy korytarza OpenStreetMap. **Bez zmian
  w aplikacji.**

### H-1 · Kontrola trasy
- Kontrola **dla każdego transportu**, z wymiarów zestawu tego transportu
  zapisanych w Watch Tower (§2): wysokość, szerokość, długość, masa całkowita,
  nacisk na oś, liczba osi, a w Szwecji klasa drogi BK.
- **Nic z dokumentów** — ani wymiarów, ani tras z zezwoleń (D-83).
- Trasa: korytarz transportu (przez Gdańsk–Nynäshamn albo Gdynię–Karlskronę).
- Wynik w podglądzie transportu: **lista przeszkód** — miejsce, limit,
  wartość zestawu.
- Przeszkoda krytyczna → ryzyko widoczne dla HHL i przewoźnika (cel kliknięcia
  dopisz do `CELE_KLIKNIEC.md`).
- Ponowna kontrola przy zmianie wymiarów transportu i co najwyżej co 30 dni
  (licencja).
- Komunikat HERE o **ogólnym limicie wysokości województwa** (400 cm, H-0)
  to **przepis** („wymaga zezwolenia”), nie przeszkoda. Przeszkoda to
  konkretny wiadukt, most albo tunel, z miejscem. Ryzyko tylko dla
  przeszkody fizycznej.

### H-2 · Utrudnienia drogowe w Polsce (i uzupełnienie Szwecji)
- Utrudnienia i natężenie ruchu wzdłuż korytarza: Śrem–Gdańsk/Gdynia oraz
  Nynäshamn/Karlskrona–Boden.
- Polska: **jedyne źródło** (dziś brak). Szwecja: uzupełnienie Trafikverket —
  bez duplikatów tego samego zdarzenia.
- Zasilają istniejące ryzyka ROAD_PL i ROAD_SE oraz panel „Warunki drogowe".
- Częstotliwość: co 15 min dla odcinków z transportem w drodze; co 60 min,
  gdy nikogo nie ma.

### H-3 · Przeszkody wzdłuż korytarza
- Pełna lista ograniczeń dla ciężarówek w pasie wzdłuż korytarza (także drogi
  objazdowe): mosty, wiadukty, tunele, ograniczenia masy i wysokości.
- W podglądzie transportu podświetlone tylko przeszkody dla wymiarów tego
  transportu.
- Odświeżanie co najwyżej co 30 dni (licencja).

### H-6 · Mapa przeszkód
- Na mapie warstwa ograniczeń HERE dla wymiarów wybranego transportu.
- Realizuj razem z pozycjami Q-17 i Q-19 z planu — jedna praca, bez dublowania.
- Zmierz zużycie przy kilku użytkownikach i podaj szacunek miesięczny. Jeśli
  zagraża budżetowi — mapa HERE tylko w widoku „Mapa".

### H-7 · Mapa w e-mailach i w eksporcie PDF
- Statyczny obraz mapy z pozycją pojazdu i trasą w e-mailach z powiadomieniami
  oraz w eksporcie PDF transportu. Generowany przy wysyłce, nie przechowywany
  dłużej niż 30 dni.

### H-8 · Profil trasy
- Podsumowanie trasy dla transportu: **nachylenia**, **miejsca niebezpieczne**
  (punkty wypadków), **nawierzchnia** (szczególnie dojazd do placu budowy
  w Boden). Informacja w podglądzie transportu.

### H-10 · Pogoda i wiatr na trasie
- Prognoza godzinowa i ostrzeżenia o groźnych zjawiskach dla punktów na trasie
  pojazdu w drodze. Uzupełnia FMI, SMHI i DMI — bez duplikatów.
- **Próg wiatru zatwierdzony: porywy 15 m/s** (D-84). Przekroczenie na trasie
  → ryzyko dla HHL i przewoźnika.
- **Wiatr wydłuża ETA** — zgodnie z logiką i faktami:
  - liczy się prognoza wiatru **na odcinkach przed pojazdem, w godzinie,
    w której pojazd tam będzie** — nie wiatr w miejscu, gdzie stoi teraz
  - porywy ≥ próg → na tych odcinkach niższa prędkość zestawu; przy wietrze
    tak silnym, że zestaw nie powinien jechać (np. zamknięcie mostu dla
    wysokich pojazdów) → doliczony postój do czasu, aż prognoza spadnie
    poniżej progu
  - wartości (obniżenie prędkości, granica postoju) oprzyj na **oficjalnych
    wytycznych** dla wysokich i ponadnormatywnych pojazdów (m.in. Trafikverket,
    zasady dla mostów na trasie, np. na E4) — źródła zapisz
    w `LOGIKA_SYSTEMU.md`; wartości w Opcjach jako **wstępne**, raport
    do właściciela
  - ETA nadal tylko z pozycji GPS (D-80): wiatr koryguje ETA liczone
    z bieżącej pozycji; bez GPS nie ma ETA, więc nie ma też korekty
  - przy ETA podpowiedź „wydłużone o X min przez wiatr na odcinku …"
- Test: ten sam przejazd z wiatrem poniżej i powyżej progu daje różne ETA,
  a różnica wynika z odcinków i godzin przejazdu.

### H-12 · Zakazy czasowe
- Sprawdzenie, czy planowany przejazd nie wypada w zakazie ruchu ciężarówek
  (weekendy, święta, pory dnia). Kolizja → ryzyko i informacja w podglądzie
  transportu.

### Po podłączeniu emtrack (etap 4 planu)
- **H-4 · ETA z GPS, w pełni automatyczne (D-85)** — zero ręcznego wpisu,
  także prędkości. Propozycja limitu km/h w Opcjach (04.10, po H-0) jest
  **nieaktualna**. H-4 budować dopiero po emtrack. Do tego czasu tylko opis
  i plan testu.

  Łańcuch, wszystko z bieżącej pozycji GPS (D-80). Bez GPS nie ma ETA.

  1. **Droga PL i SE.** Trasa ciężarówki HERE z wymiarami transportu (D-83),
     ruch na żywo (PL i SE), utrudnienia (HERE i Trafikverket), wiatr (H-10)
     i zakazy czasowe (H-12).

     **Droga SE, Trafikverket, pełny zakres, nie tylko utrudnienia**
     (właściciel 2026-10-04 20:10). H-4 nadal bez budowy.

     - Sytuacje na drodze: wypadki, zamknięcia, roboty, ograniczenia dla
       ciężarówek.
     - Stan nawierzchni: śnieg, lód, gołoledź. Na tych odcinkach zestaw
       jedzie wolniej.
     - Pomiary ze stacji przy drodze: wiatr i temperatura nawierzchni.
       Na odcinku, na którym pojazd jest teraz, pomiar wygrywa z prognozą
       (H-10). Na dalszych odcinkach zostaje prognoza.
     - Wpływ nawierzchni na prędkość: start z oficjalnych wytycznych, potem
       kalibracja uczona z GPS (II-7b). Żadnych ręcznych wartości.
     - W rozbiciu ETA osobna linia **nawierzchnia**.

     Co II-6 już bierze, a czego nie ma (kod `road-se`, bez zmiany aplikacji):

     - **Jest.** `RoadCondition` na E4 w länach korytarza: tekst i kod stanu,
       w tym śnieg, lód i błoto pośniegowe. Z tego powstaje ryzyko ROAD_SE
       i jeden współczynnik na cały korytarz (+15%, parametr wstępny w kodzie,
       nie wytyczna i nie odcinek).
     - **Jest.** `WeatherMeasurepoint`: wiatr, temperatura nawierzchni,
       temperatura powietrza, deszcz i śnieg. Idzie do ryzyka ROAD_SE.
       Nie rozstrzyga jeszcze „pomiar na bieżącym odcinku, prognoza dalej”.
     - **Nie ma, do dodania przy H-4.** Sytuacje: wypadki, zamknięcia, roboty,
       ograniczenia dla ciężarówek. Zapytanie `Situation` jest w kodzie, ale
       zadanie go nie woła. Od 01.10.2026 obiekt `Situation` nie istnieje
       w Open API (D-34). Trzeba znaleźć zastępcze źródło Trafikverket.
       Nie włączać starego zapytania na ślepo.
     - **Nie ma, do dodania przy H-4.** Spowolnienie na konkretnym odcinku
       według wytycznych, potem nauka z GPS. Linia „nawierzchnia” w rozbiciu
       ETA. Dziś jest tylko jeden współczynnik na cały korytarz.
  2. **Współczynnik zestawu, bez ręcznej prędkości.** Kalibracja uczona
     z planu (II-7b, D-28). Start: czasy D-9 wobec HERE (PL 7,5 h / 4,61 h,
     SE 17 h / 12,78 h). Potem nauka z prawdziwego GPS, osobno dla PL i SE
     oraz dla typu zestawu.
  3. **Prom.** Rejs i armator z awizacji przewoźnika (dodanie albo zmiana).
     Odjazd i przyjazd z rozkładu oraz statusu na żywo (opóźnienia, sztorm,
     odwołania, ferry-status). W trakcie przeprawy pozycja statku z AIS.
     Przyjazd po granicy odprawy → następny rejs tego armatora i ryzyko.
     Odwołany rejs → decyzja `FERRY_CANCELLED`, ETA z następnego rejsu.
  4. **Port.** Odprawa przed odjazdem i zjazd z promu: na start czasy D-9,
     potem nauka z GPS i AIS.
  5. **Godziny kierowcy (UE), z GPS.** Przerwa 45 min po 4,5 h jazdy,
     odpoczynek dobowy po limicie jazdy. Odpoczynek jest na promie. Po
     promie licznik zaczyna się od nowa. Przy zmianie kierowcy godziny
     są osobno dla każdego.
  6. **Rozbicie ETA:** jazda, prom, port, przerwy, wiatr, ruch, nawierzchnia.

  Plan testu (gdy H-4 powstanie, nie teraz): ten sam GPS daje rozbicie na
  siedem składników, w tym osobna linia nawierzchnia; brak pola prędkości w Opcjach; start współczynnika to
  stosunek D-9 do HERE, a nie wpisana liczba km/h; odwołany rejs otwiera
  `FERRY_CANCELLED` i liczy ETA z następnego rejsu tego armatora; przyjazd
  po odprawie bierze następny rejs; odpoczynek dobowy nie dolicza się drugi
  raz na promie, a po zjeździe licznik jazdy jest pusty; zmiana kierowcy
  nie przenosi godzin; brak GPS → brak ETA. Testy i brama nie wołają Resend.
- **H-5 · Kontrola po przejeździe** — rzeczywisty ślad GPS sprawdzony w HERE:
  czy pojazd trzymał się trasy z zezwolenia i czy naruszył ograniczenia.
  Raport przy zamknięciu transportu.

---

## 5. Kolejność w planie

| Kiedy | Pozycje |
|---|---|
| zaraz po L-13 | **H-0** (test) — raport do właściciela |
| po etapie 1 (po L-12) | **H-1, H-2, H-3** |
| razem z Q-17 i Q-19 | **H-6** |
| po etapie 2 | **H-7, H-8, H-10** (ryzyko wiatru), **H-12** |
| etap 4 (po emtrack) | **H-4, H-5**, wydłużanie ETA przez wiatr (H-10) |

---

## 6. Gotowe, gdy

- każda pozycja ma test; brak klucza, błąd albo wyczerpany budżet = poprawne
  działanie zapasowe
- kafelek „HERE" w Stanie systemu pokazuje zużycie i szacowany koszt per usługa
- w repozytorium nie ma żadnego klucza HERE; w paczce przeglądarki nie ma
  klucza serwerowego (test strażnika)
- dane HERE starsze niż 30 dni są kasowane automatycznie (test)

## 7. Czeka na właściciela

- `HERE_API_KEY` w sekretach Supabase i `.env.local`
- wymiary zestawów dla każdego transportu (właściciel, D-83)
- trasy z zezwoleń, jeśli są — tylko do kontroli po przejeździe (H-5)
- akceptacja wstępnych wartości wpływu wiatru na ETA (H-10)
