# Logika systemu — zanim cokolwiek zbudujemy

Dokument dla właściciela. Opisuje tylko to, co jest już w kodzie na gałęzi `fix/przejecie-testy-02-10`. Jeśli czegoś nie ma, jest napisane wprost. Ścieżki plików są wskazówką, skąd wzięta jest teza. Nic z tej listy nie zostało zbudowane przy pisaniu tego pliku.

---

## 1. Centrum decyzji i napis „Wymaga decyzji”

To są dwie różne rzeczy. Łatwo je pomylić, bo obie brzmią jak „trzeba coś rozstrzygnąć”.

### Napis „Wymaga decyzji”

Na kokpicie tak nazywa się kolejka wyjątków, nie lista decyzji (`src/i18n/messages.ts`, `src/views/DashboardView.tsx`, `src/lib/prodDash.ts`).

- Po zalogowaniu do prawdziwej bazy kolejka bierze otwarte ryzyka. Najpierw najpoważniejsze, potem najstarsze.
- W podglądzie demonstracyjnym kolejka bierze osobną listę wyjątków z danych przykładowych.
- Kliknięcie wiersza otwiera transport, jeśli ryzyko jest do niego przypisane. Jeśli nie jest — otwiera widok Ryzyka.
- Przycisk obok nagłówka też prowadzi do Ryzyka.
- Gdy lista jest pusta, widać zdanie: „Nic nie wymaga reakcji. Wszystkie transporty idą zgodnie z planem.”

U HHL kafelek o tej samej nazwie liczy tę kolejkę. U KSH kafelek liczy tylko ryzyka, które KSH widzi na liście Ryzyk (nie Centrum decyzji — tej listy KSH nie ma). Kliknięcie i tak idzie do Ryzyk, nie do osobnego ekranu decyzji.

### Centrum decyzji

Panel jest na dole widoku Ryzyka i tylko wtedy, gdy aplikacja pracuje na koncie w bazie. W podglądzie demonstracyjnym tego panelu w ogóle nie ma (`src/views/RisksView.tsx`, `src/components/DecisionCentre.tsx`).

Pokazuje pozycje ze statusem: nowa, przypisana albo odłożona. Najwyżej 50, najbliższy termin na górze. Pusta lista mówi: „Brak otwartych decyzji.”

Kliknięcie pozycji otwiera okno: tytuł, przyciski wyboru, pole komentarza, „Odłóż 2 h”, „Zamknij”, a gdy jest transport — „Otwórz transport”. Po wyborze zapis idzie do bazy. Część wyborów tylko dopisuje ślad. Część naprawdę coś robi (niżej). Odłożenie na dwie godziny nie chowa pozycji: nadal jest „otwarta”, tylko z późniejszym terminem.

### Dlaczego może być puste

Katalog szesnastu typów jest w bazie. Nie ma natomiast niczego, co samo otwiera nową pozycję. Funkcja otwarcia istnieje (`supabase/migrations/0102_dec2_decision_center.sql` i późniejsze poprawki), ale żaden ekran, żaden automat i żaden skrypt jej nie wywołuje. Jedyny zegar w tej okolicy tylko eskaluje pozycje, które już są otwarte i mają przekroczony termin. Skoro nikt ich nie otwiera, eskalować też nie ma czego. Pusty panel jest więc zgodny z kodem, a nie awarią odświeżania.

KSH tej listy w ogóle nie widzi: reguła odczytu dla klienta jest wyłączona. Przewoźnik widzi typy przypisane przewoźnikowi i HHL. HHL widzi wszystkie.

### Szesnaście typów i kto ma decydować

Z katalogu (`supabase/migrations/0102_dec2_decision_center.sql`, polskie nazwy w `src/i18n/decisions.ts`):

| O co chodzi | Kto ma decydować | Termin w katalogu |
| --- | --- | --- |
| Rejs odwołany albo sztorm | przewoźnik | przed odprawą (bez liczby godzin) |
| Przyjazd po godzinie „najpóźniej do” | HHL | 2 godziny |
| KSH zmieniło datę mniej niż 5 dni przed załadunkiem | przewoźnik | 24 godziny |
| Brak awizacji w terminie | przewoźnik | termin awizacji (bez liczby godzin) |
| Brak zezwolenia lub dokumentu przed „gotowy” | przewoźnik | przed załadunkiem |
| Wiersz zniknął z pliku KSH | HHL | 24 godziny |
| Konflikt między Watch Tower a plikiem KSH | HHL | 24 godziny |
| Błąd w pliku KSH | HHL | 48 godzin |
| Brak pozycji auta w drodze | przewoźnik | 1 godzina |
| Zjazd z trasy z zezwolenia | przewoźnik | 1 godzina |
| Opłata paliwowa poza tabelą albo awaria źródła | HHL | 14 dni |
| Kwota opłaty paliwowej na fakturze inna niż wyliczona | HHL | 7 dni |
| Ponad 3 kratownice jednego dnia | HHL | przed fakturą |
| Polisa przewoźnika wygasa | przewoźnik | data wygaśnięcia |
| Postój dłuższy niż czas wolny | HHL | przed fakturą |
| Kopia zapasowa nieudana | administrator | 1 godzina |

Sam wybór nie sprawdza w kodzie, czy klika właściwa firma. Rozstrzygnąć może HHL albo przewoźnik, o ile w ogóle widzi pozycję. KSH nie rozstrzyga, bo listy nie widzi.

Co wybór naprawdę robi (`supabase/migrations/0126_dec234_effects_matrix_notify.sql`):

- „Powiadom KSH”, „zostaw i zapytaj KSH”, „poproś o poprawkę” — wstawia powiadomienie dla klienta, jeśli macierz na to pozwala.
- „Eskaluj” — powiadomienie dla HHL.
- „Anuluj” — anuluje transport, ale tylko gdy klika HHL i jest podany transport.
- „Następny rejs” / „drugi armator” — podmienia rejs tylko wtedy, gdy w szczegółach decyzji jest już konkretny rejs. Jeśli go nie ma, ekran ma otworzyć podgląd transportu, żeby ktoś wybrał rejs ręcznie. Samo kliknięcie rejsu nie wyszukuje.
- „Wartość z pliku” — przepisuje numer zlecenia tylko dla trzech znanych pól i tylko gdy plik podał nową wartość.
- „Wstrzymaj”, „przyjmuję”, „objazd”, „cena ręczna” i podobne — dopisują zdarzenie przy transporcie. Nie zmieniają same daty, ceny ani trasy.
- „Dodaj awizację”, „dodaj zezwolenie”, „dodaj dopłatę” — nie zapisują awizacji, dokumentu ani kwoty. Otwierają odpowiednią zakładkę transportu.
- „Ponów kopię” — uruchamia tę samą kopię co codzienny cron (`backup-export`). Wynik (udana, nieudana albo pominięta) jest w Stanie systemu, na liście kopii. Sam zapis prośby w historii zostaje.

---

## 2. Opcje: Powiadomienia i decyzje

Sekcja jest tylko na koncie HHL (`src/views/OptionsView.tsx`). KSH i Scandinavian Express jej nie mają.

W środku są trzy warstwy, które nie robią tego samego:

1. **Macierz** (`src/auth/NotificationMatrixForm.tsx`). Tabela: pięć grup zdarzeń razy trzy firmy (HHL, przewoźnik, KSH). W każdej kratce dwa ptaszki: w aplikacji i e-mail. Zapisuje tylko administrator HHL. Grupa „integracje, kopie, logowania” jest na sztywno tylko dla HHL — reszcie nie da się jej włączyć. To jest jedyne miejsce, które decyduje, czy baza w ogóle wstawi powiadomienie.

2. **Trzy przełączniki w przeglądarce**: reguły automatyzacji, alerty stref, alerty ryzyka. Gaszą tylko powiadomienia tworzone lokalnie na tym komputerze (`src/store/useTowerStore.ts`). Nie gaszą poczty ani wpisów, które wstawia baza.

3. **Podgląd automatyzacji**. Lista reguł i przycisk do widoku Automatyzacje. W danych przykładowych jest dwanaście reguł i wszystkie są wyłączone, z adnotacją, że zastąpił je jeden mechanizm w bazie (`src/data/seed.ts`). W prawdziwej bazie ten moduł widzi tylko administrator HHL (`src/lib/prodFacade.ts`). Przycisku „nowa automatyzacja” w kodzie widoku nie ma (`src/views/WorkflowsView.tsx` — jest tylko włącznik istniejącej reguły).

Macierz jest używana, gdy (`supabase/migrations/0126_dec234_effects_matrix_notify.sql`):

- zmieni się status transportu,
- pojawi się albo zmieni ryzyko,
- auto wjedzie albo wyjedzie ze strefy,
- otworzy się albo zamknie decyzja.

Przewoźnik dostaje wpis tylko o swoim transporcie. KSH tylko o projekcie, którego jest klientem. HHL dostaje według macierzy bez tego zawężenia.

Od L-13 (2026-10-04) powtórzenie tego samego zdarzenia nie dokłada wpisu: status bez znacznika minuty, ryzyko bez mikrosekundy, strefa bez minuty wjazdu. Raport `notification_flood_report` rozbija wpisy według typu, odbiorcy i firmy i liczy ten sam klucz raz. Ostrzeżenie od 80 widać w Stanie systemu. Od 04.10.2026 17:06 e-mail decyzji automatycznych jest włączony. Niekrytyczne: jeden skrót na odbiorcę na dobę. Krytyczne: jedno zdarzenie, jeden e-mail, lista transportów. Limit operacyjny 90, 10 zostaje na zaproszenia i reset hasła. Po limicie wpis w aplikacji zostaje.


---

## 3. Po co są strefy i co robią

Strefa to koło na mapie: środek, promień w metrach, nazwa i rodzaj. Rodzaje: załadunek, przed portem, port wyjścia, port wejścia, punkt kontrolny, przed przyjazdem, plac, postój (`src/lib/enumLabels.ts`, `src/i18n/d19Extra.ts`).

Silnik w bazie (`supabase/migrations/0002_geofence_engine.sql`) nie krzyczy od jednego punktu GPS. Najpierw czeka na kilka kolejnych próbek w środku (żeby drganie GPS nie robiło alarmu). Dla portu i placu dodatkowo czeka, aż auto postoi zadaną liczbę minut (przejazd obok bramy nie jest przyjazdem). Wyjście liczy się dopiero po oddaleniu o zapas, zwany histerezą — auto na granicy koła nie robi pary „wjazd i wyjazd”.

Skutek wjazdu albo wyjazdu, jeśli macierz na to pozwala: powiadomienie w aplikacji i ewentualnie e-mail. Osobno, tylko dla dwóch miejsc, idzie SMS (`supabase/migrations/0106_dec5_sms_zones.sql`):

- okolica załadunku w Polsce (Śrem): lista dwóch telefonów,
- plac w Boden: druga lista dwóch telefonów.

Ptaszki „zbliżenie” i „wjazd” włączają albo gaszą te SMS-y. Test z opcji tylko kolejkuje próbny SMS, nie jedzie autem.

W opcjach HHL widać też listę stref z przełącznikiem włącz/wyłącz i licznik „aktywne / wszystkie”. To nie jest edytor kształtu. Kształt jest w widoku Strefy.

Kolumna „kogo powiadamia” w tabeli stref jest uproszczona na sztywno według rodzaju, a nie według ptaszków zapisanych przy strefie (`src/views/GeofenceView.tsx`): przed przyjazdem pokazuje KSH, Scandinavian Express i HHL; załadunek pokazuje samo HHL; reszta pokazuje KSH i HHL. To jest opis na ekranie, nie pełna reguła wysyłki.

---

## 4. Progi i terminy

W opcjach HHL jest dziesięć liczb. Zapisuje je tylko administrator HHL, przy wyjściu z pola. Wartość musi być większa od zera. Zmiana ląduje w historii (`src/auth/OpsThresholdsForm.tsx`, `supabase/migrations/0107_dec6_ops_thresholds.sql`).

| Co widać | Startowa wartość |
| --- | --- |
| Fala znacząca | 3,8 m |
| Porywy wiatru | 40 węzłów |
| Próg opóźnienia | 30 min |
| Wyprzedzenie dat KSH | 5 dni |
| Awizacja — ostrzeżenie | 48 h |
| Awizacja — krytyczne | 12 h |
| Dokumenty — ostrzeżenie | 24 h |
| Dokumenty — krytyczne | 6 h |
| Brak pozycji GPS | 15 min |
| Zjazd z trasy | 2 km |

Z tych dziesięciu **tylko fala i porywy są czytane przez automat pogody** (`supabase/functions/_shared/integrations/store.ts`). Stan na 03.10: reszta jest zapisana i da się ją zmienić, ale kod jej nie stosował do opóźnień, awizacji, dokumentów, ciszy GPS albo zjazdu z trasy. Od polecenia 2026-10-04 00:07 (czas warszawski) osiem progów podłącza L-3 według wzorów poniżej. Jedno źródło liczb: tabela Opcji. Kod, który czyta próg z innej tabeli, przepina się migracją, a duplikat znika.

### Wzory progów (polecenie właściciela 2026-10-04 00:07, czas warszawski)

ZASADY OGÓLNE

1. Jedno źródło: wszystkie progi czytane WYŁĄCZNIE z tabeli Opcji. Kod czytający inną tabelę — przepnij migracją, duplikaty usuń.
2. Ostrzeżenie i próg krytyczny to JEDEN alarm, który rośnie (ostrzeżenie → krytyczne), nie dwa osobne. Jedna decyzja: otwiera się przy ostrzeżeniu, termin = moment krytyczny; przy krytycznym ta sama decyzja czerwienieje i idą powiadomienia według macierzy.
3. Warunek ustał (np. awizacja uzupełniona) → alarm zamknięty, decyzja ze statusem „nieaktualna — warunek ustał" (zapis systemu w Historii). To nie jest rozstrzygnięcie — rozstrzyga tylko firma (L-2).
4. Czas: Europe/Warsaw. Brak godziny w pliku KSH → liczymy od 00:00 tego dnia (wcześniejsze ostrzeżenie).
5. Brak prawdziwych danych → brak alarmu (tak jak przy L-1).

WZORY

A. Awizacja (NO_AWIZACJA, w ramach L-3): kierowca odbierający, ciągnik, naczepa, telefon — liczone od planowanego ZAŁADUNKU (data + godzina z pliku KSH). Kierowca dostarczający z telefonem i ciągnikiem — od planowanej DOSTAWY (48 h przed dostawą). Brak na 48 h przed → ostrzeżenie; brak na 12 h przed → krytyczne.
B. Dokumenty (DOC_MISSING): brak wymaganego dokumentu (zezwolenie, gdy wymagane; polisa) na 24 h przed planowanym załadunkiem → ostrzeżenie; na 6 h → krytyczne.
C. Wyprzedzenie KSH (KSH_DATE_LT_5D, D-12): zmiana daty albo nowy transport w pliku KSH, gdy od chwili zmiany do wcześniejszej z dat (stara/nowa data załadunku) zostało mniej niż 5 dni.
D. Opóźnienie (ETA_AFTER_LATEST): ETA > koniec okna dostawy + próg z Opcji. ETA wyłącznie z pozycji: GPS pojazdu na drodze w Szwecji, na promie pozycja statku z AIS (`vessel_positions`). Sam plan, założony rejs i przeprawa „z założenia" nie wypełniają ETA — w interfejsie „–" i podpowiedź „Brak pozycji GPS". Brak świeżego AIS na promie: ETA czeka na AIS, bez powrotu do planu.
E. Brak GPS: ostatnia pozycja starsza niż próg (15 min) — tylko gdy pojazd ma podłączone źródło pozycji i status jest w ruchu (IN_TRANSIT_PL, AT_PORT_*, IN_TRANSIT_SE). Bez alarmu: READY, FERRY (na promie pozycja z AIS), AT_SITE, DELIVERED.
F. Zjazd z trasy (ROUTE_DEVIATION): odległość od trasy korytarza > próg z Opcji przez co najmniej 2 kolejne pozycje i co najmniej 10 min. Bez alarmu na promie i w strefach portów oraz placów.

TESTY: dla każdego wzoru — zmiana wartości w Opcjach zmienia moment alarmu; brak danych = brak alarmu; ostrzeżenie → krytyczne = ta sama decyzja.


---

## 5. Statusy

Są cztery osobne słowniki. Nie wolno ich mieszać.

### Etap na pasku i na mapie

Dziewięć etapów (`src/lib/status.ts`, nazwy w `src/i18n/messages.ts`): przygotowanie, załadunek, droga w Polsce, Gdańsk, prom, Nynäshamn, droga w Szwecji, Boden, dostarczone. Każdy transport ma dokładnie jeden etap. Cyfra na kafelku to liczba transportów w tym etapie.

### Status operacyjny transportu

Na liście harmonogramu widać polską nazwę (`src/lib/statusLabel.ts`, `src/i18n/d19Extra.ts`): planowany, brak auta, brak dokumentów, gotowy, załadunek, w drodze w Polsce, port Gdańsk, na promie, w drodze w Szwecji, na placu, rozładowany, dostarczony.

Dwa statusy — opóźniony i cichy — mają na liście własne nazwy: „Opóźniony” i „Cichy” (`s_delayed`, `s_silent` w `src/lib/statusLabel.ts`). Nie zastępuje ich nazwa etapu.

W bazie jest jeszcze „anulowany” oraz drobniejsze nazwy techniczne (osobno „dokumenty w toku”, „na załadunku”, „port Gdańsk”, „port Nynäshamn”, „na placu”, „rozładowany”). Ekran składa je do nazw powyżej (`src/data/mappers.ts`, `supabase/migrations/0001_core.sql`).

### Status decyzji

Nowa, przypisana, odłożona, rozstrzygnięta, wygasła. Na liście widać tylko trzy pierwsze.

### Status faktury — dwa niezależne

Weryfikacja: do weryfikacji, zgodna, sporna, zaakceptowana. Płatność: nieopłacona, po terminie, opłacona (`src/lib/invoices3.ts`, `src/i18n/ui6.ts`).

### Status rejsu

Zaplanowany, opóźniony, odwołany (`src/lib/sailings.ts`).

---

## 6. Filtry tabeli harmonogramu

Harmonogram **nie** używa górnego paska etapów. Ma własne przyciski (`src/views/ScheduleView.tsx`):

| Przycisk | Co zostaje na liście |
| --- | --- |
| Wszystkie | wszystko, co i tak wolno widzieć, po wyszukiwaniu |
| W drodze | status: załadunek, w drodze w Polsce, port, prom, w drodze w Szwecji, na placu. To **nie** jest ta sama liczba co „transporty w drodze” na kokpicie |
| Opóźnione | oznaczone jako opóźnione albo status opóźniony |
| Bez dokumentów | brak dokumentów |
| Dostarczone | status albo etap „dostarczone” |
| Załadunek, droga w Polsce, Gdańsk, prom, Nynäshamn, droga w Szwecji, Boden | transporty w tym etapie |

Pole szukania tnie po kodzie, kierowcy, tablicy i numerach zleceń. Przycisk czyszczenia zeruje szukanie i wraca do „wszystkie”.

Filtrowania po dacie załadunku i rozładunku w tym widoku nie ma.

---

## 7. Górny pasek filtrów

To pasek dziewięciu kafelków pod nagłówkiem (`src/components/shell/CorridorSpine.tsx`).

- Cyfra to liczba transportów w danym etapie, liczona po etapie, nie po statusie (`src/lib/corridorKpis.ts`).
- Pasek pod cyfrą jest tylko skalą względem najliczniejszego etapu. Nie jest procentem planu.
- Jedynka z lewej to numer kolejny etapu (1–9), nie liczba transportów.
- Kliknięcie przełącza na Mapę i zostawia na niej tylko ten etap.
- Drugie kliknięcie tego samego kafelka zdejmuje filtr.
- Harmonogram, kokpit, ryzyka i faktury tego filtra nie stosują.

„Transporty w drodze” na kokpicie to suma pięciu etapów: droga w Polsce, Gdańsk, prom, droga w Szwecji, Nynäshamn. Nie wchodzi tu przygotowanie, załadunek, Boden ani dostarczone.

---

## 8. Powiadomienia w pasku i banerze

### Baner systemowy

Cienki pasek na górze całej aplikacji (`src/components/shell/SystemBroadcastBanner.tsx`). Tekst bierze z bazy: jeden aktualny komunikat administratora. Nie da się w niego kliknąć. Nie prowadzi nigdzie. Znika, gdy komunikat wygaśnie albo go nie ma. Pisze go formularz w opcjach HHL.

### Baner na kokpicie

Osobny, czerwony albo zwykły, tylko na kokpicie (`src/views/DashboardView.tsx`):

- Po zalogowaniu do bazy: najpoważniejsze otwarte ryzyko (krytyczne albo wysokie) i liczba takich ryzyk. Kliknięcie otwiera Ryzyka. Gdy takiego ryzyka nie ma, banera nie ma. Nie ma wtedy tekstu zastępczego.
- W podglądzie, widok HHL: tekst o rejsie. Kliknięcie też otwiera Ryzyka.
- W podglądzie, widok KSH i Scandinavian Express: stały tekst informacyjny, bez kliknięcia.

Przełączniki z opcji tego banera nie gaszą.

### Dzwonek

Liczba na dzwonku to pozycje jeszcze niekliknięte, widoczne dla bieżącego widoku firmy (`src/components/shell/NotificationBell.tsx`, L-5).

Lista nie ma napisu „przeczytane”. Po kliknięciu pozycja znika, licznik maleje i otwiera cel z `docs/handover/CELE_KLIKNIEC.md`. Najwyżej 40. W bazie kliknięcie zapisuje się jako przeczytane tylko dla pozycji z serwera. Wpis bez obiektu (ogłoszenie, baner, komunikat) też znika po kliknięciu i otwiera Szczegóły wpisu.

Kliknięcie prowadzi do celu (`src/store/useTowerStore.ts`, `supabase/functions/_shared/clickTargets.ts`):

| O czym jest wpis | Dokąd |
| --- | --- |
| Faktura: nowa, termin, spór | Faktury |
| Brak numeru zlecenia, brak zasobu, polisa, milcząca bramka SMS | Ryzyka |
| Zmiana statusu, wjazd i wyjazd ze strefy, nowe ryzyko, decyzja, zmiana dat | cel z tabeli `CELE_KLIKNIEC.md` (transport, decyzja albo stan systemu), nigdy strona główna |
| SMS niewysłany (SMS_FALLBACK) | Stan systemu → Bramka SMS → wpis tego SMS-a. Widzi tylko HHL i administrator |
| Alert reguły (WORKFLOW_ALERT) | transport → zakładka Status; bez transportu → Automatyzacje, podgląd reguły |
| Wpis o strefie, który ma transport | nie idzie do widoku Strefy. Kod świadomie zamienia to na harmonogram i otwiera transport |

E-mail z bazy, jeśli macierz go włączyła, ma link do strony głównej aplikacji, nie do konkretnego transportu (`renderEmail` w tym samym pliku szablonów).

---

## 9. Alternatywy dla rejsu i „na drodze”

### Rejs

Po zalogowaniu do bazy (`src/views/RisksView.tsx`, `src/lib/prodFacade.ts`):

- widać rozkład rejsów z bazy i, jeśli jest odczyt, falę i wiatr,
- obok stoi nagłówek „Alternatywy dla rejsu” i zdanie: „Alternatywne przeprawy: brak źródła danych.” Nie ma listy do kliknięcia.

W podglądzie demonstracyjnym jest na sztywno cztery trasy (Gdańsk–Karlshamn, Gdynia–Karlskrona, Świnoujście–Trelleborg, Świnoujście–Ystad) z kilometrami do Boden. Przycisk „Przelicz” coś zmienia tylko wtedy, gdy istnieje ryzyko promowe z planem awaryjnym: obniża wagę tego ryzyka i dopisuje zdarzenie przy transporcie. Nie rezerwuje promu i nie przelicza trasy na mapie (`src/store/useTowerStore.ts`, funkcja planu awaryjnego).

### Na drodze (Szwecja)

Panel „Warunki drogowe” czyta sytuacje z bazy albo, w podglądzie, przykładową listę. Kliknięcie wiersza otwiera transport powiązany z ryzykiem drogowym, jeśli taki jest.

Cztery „alternatywy trasy” (objazd przez E18, objazd przez drogi 83/84, kolej, pauza) są **ukryte po zalogowaniu do bazy**, bo to stały tekst, nie wyliczenie z mapy (`src/lib/seRouteAlts.ts`). W podglądzie przycisk „Wybierz” oznacza jeden transport jako opóźniony i przesuwa godzinę przyjazdu o czas z tej stałej listy. Nie rysuje nowej drogi.

---

## 10. Opłacone faktury — tylko HHL

Tak jest zrobione i dotyczy obu kierunków, które widzi HHL (`src/views/BillsPanel.tsx`, `src/lib/invoices3.ts`, `supabase/migrations/0003_faktury_zlecenia_ustawienia.sql`, spór w `0079_invoice_dispute_path.sql`).

- HHL widzi faktury kosztowe (płaci Scandinavian Express) i przychodowe (wystawia dla KSH).
- Scandinavian Express widzi tylko kosztowe i **nie** ma przycisku opłacenia.
- KSH widzi tylko przychodowe i też **nie** oznacza płatności. Może weryfikować: zgodna, sporna (z uzasadnieniem), zaakceptowana.

U HHL przy fakturze jest data i przycisk „oznacz jako opłaconą”. Status płatności staje się „opłacona”, zapisuje się kto i kiedy. Cofnięcie wymaga wpisania powodu i wraca do „nieopłacona”.

Jeśli faktura kosztowa jest w sporze, zapłata jest zablokowana do rozstrzygnięcia. Ta blokada w bazie dotyczy faktury, której odbiorcą jest organizacja klikającego, czyli kosztu HHL. Dla faktury przychodowej (odbiorcą jest KSH) tej blokady w funkcji bazy nie ma.

Przypomnienia o terminie milkną, gdy faktura jest opłacona (`src/lib/invoices3.ts`).

---

## 11. Każdy kafelek kokpitu

Wspólne dla trzech widoków: kolejka „Wymaga decyzji” (do siedmiu wierszy), wykres „Postęp dostaw” (sam wykres nigdzie nie prowadzi), mini-mapa i przycisk „Mapa”, który otwiera mapę bez filtra etapu (`src/views/DashboardView.tsx`).

### Widok KSH

| Kafelek | Co liczy | Kliknięcie |
| --- | --- | --- |
| Elementy dostarczone | dostarczone / wszystkie | Harmonogram, bez filtra |
| Tonaż na placu | suma ton dostarczonych; podpis to tonaż wszystkich | Mapa |
| Najbliższa dostawa | najbliższy przyjazd wśród etapów: droga w Szwecji, Nynäshamn, Boden | ten transport, a gdy go nie ma — harmonogram |
| Transporty w drodze | suma pięciu etapów z punktu 7 | Mapa |
| Terminowość | dostarczone / (dostarczone + opóźnione), w procentach. Gdy nic nie dostarczono, jest kreska, nie zero | Harmonogram |
| Wymaga decyzji | liczba ryzyk, które KSH widzi na liście Ryzyk (nie Centrum decyzji). W podglądzie: długość kolejki wyjątków | Ryzyka |

### Widok Scandinavian Express

| Kafelek | Co liczy | Kliknięcie |
| --- | --- | --- |
| Do uzupełnienia | transporty ze statusem „brak auta” albo „brak dokumentów” | Moje zadania |
| Transporty w drodze | jak wyżej | Mapa |
| Terminowość | jak u KSH | Harmonogram |
| Przychód tygodnia | suma kosztów ostatnich sześciu transportów w etapie „dostarczone”, nie przychód klienta. Podpis to bieżący tydzień ISO: „tydzień N, do zafakturowania” | Faktury |
| Ryzyko promowe | liczba ryzyk typu prom o wadze wysokiej albo krytycznej. W podglądzie podpis dokłada pogodę morską; po zalogowaniu, gdy nie ma odczytu, podpis mówi, że nie ma źródła | Ryzyka, przefiltrowane na prom |
| Komplet dokumentów | po zalogowaniu: transporty z wgranym zezwoleniem polskim albo ładunek zwykły, który zezwolenia nie wymaga. W podglądzie: transporty bez flagi „brak dokumentów” | Dokumenty. Jeśli czegoś brakuje, od razu filtr „brakujące” |

### Widok HHL

| Kafelek | Co liczy | Kliknięcie |
| --- | --- | --- |
| Transporty w drodze | jak wyżej; podpis: ile dostarczonych i ile poza drogą | Mapa |
| Wymaga decyzji | długość kolejki wyjątków (ryzyka), **nie** liczba z Centrum decyzji | Ryzyka |
| Terminowość | jak u KSH | Harmonogram |
| Marża narastająco | suma marży; tylko HHL ją widzi | Finanse |
| Komplet dokumentów | jak u przewoźnika | Dokumenty, z filtrem braków gdy są |
| Czas wykrycia odchylenia | po zalogowaniu: mediana z bazy albo kreska. W podglądzie na sztywno „8 min” | Ryzyka |

Gdyby marża była ukryta, w to miejsce wchodzi drugi kafelek „W drodze” i też prowadzi na mapę. Przy zwykłym widoku HHL marża jest widoczna, więc tego zamiennika nie ma.

---

## 12. Dzwonek — dokąd prowadzi

Skrót: patrz tabela w punkcie 8 i `CELE_KLIKNIEC.md`. Kliknięcie zdejmuje pozycję z dzwonka i otwiera ten sam cel co kokpit, lista ryzyk i e-mail. Napisu „przeczytane” nie ma.

---

## 13. Praca per konto — trzy widoki jednej drogi, nie trzy osobne automaty

W kodzie nie ma trzech osobnych „workflow” firm. Jest jeden korytarz: Śrem → Gdańsk → prom → Nynäshamn → droga w Szwecji → Boden. Firma widzi inny zestaw ekranów i inne pieniądze (`src/lib/permissions.ts`).

**HHL (spedytor).** Kokpit, mapa, harmonogram, ryzyka, dokumenty, finanse, faktury, strefy, opcje. Właściwe konto administratora widzi też automatyzacje. Może importować harmonogram, widzi koszt, przychód i marżę, oznacza faktury jako opłacone, edytuje strefy, ustawia macierz, progi i komunikat na banerze. W bazie widzi decyzje.

**KSH (klient).** Kokpit, mapa, harmonogram, ryzyka, dokumenty, rozliczenia, faktury, ustawienia. Nie ma stref, opcji ani automatyzacji. Widzi swoją cenę, nie widzi stawki przewoźnika ani marży. Nie importuje harmonogramu. Nie oznacza płatności. Listy decyzji nie widzi. Na ryzykach odpada część pozycji operacyjnych, które nie są jego.

**Scandinavian Express (przewoźnik).** Kokpit, mapa, harmonogram, ryzyka, dokumenty, moje stawki, faktury, moje zadania, ustawienia. Nie ma stref ani opcji. Widzi swój koszt, nie widzi ceny klienta ani marży. Wystawia fakturę kosztową. Nie oznacza jej jako opłaconej. Na ryzykach zostają pozycje przewoźnika oraz prom, droga w Szwecji i siła wyższa. Może uzupełniać auto i kierowcę.

Dwanaście reguł z podglądu (powiadomienie przed placem, brak zezwolenia, cichy pojazd, ryzyko promowe, zmiana daty, potwierdzenie dostawy, piątkowe fakturowanie, zdążenie na rejs, sytuacja na drodze, faktoring, polisa, niska marża) jest wyłączonych. Nie są opisem tego, co dziś robi produkcja.

---

## 14. Jak budować strefy i nimi zarządzać

Dziś, na koncie HHL, widok Strefy (`src/views/GeofenceView.tsx`):

- przycisk nowej strefy stawia koło o środku 60°N, 18°E (zgrubnie środek Bałtyku), promień 1 km, zapas 200 m, jedna próbka, postój 5 minut, rodzaj „punkt kontrolny”, włączona, wyzwalacz „wjazd”;
- zapis edytuje nazwę, rodzaj, promień, zapas, minuty postoju i liczbę próbek;
- w tym formularzu nie ma przesuwania środka na mapie, nie ma kraju, nie ma wyboru „kogo powiadomić”, nie ma usuwania;
- KSH i przewoźnik tabelę widzą, ale nie mają przycisku edycji.

Włączenie i wyłączenie istniejącej strefy jest też przełącznikiem w opcjach HHL, w sekcji SMS i stref.

Żeby strefa załadunku albo placu wysłała SMS, musi mieć właściwy rodzaj i kraj (Polska przy Śremie, Szwecja przy Boden) oraz włączony wyzwalacz w opcjach. Samo narysowanie koła tego nie robi.

---

## Co z tego wynika — i czego nie budować, zanim właściciel potwierdzi

Można uznać za fakt, bez nowej budowy:

- puste Centrum decyzji jest skutkiem braku automatycznego otwierania, nie błędem listy;
- „Wymaga decyzji” na kokpicie to kolejka ryzyk, nie to centrum;
- opłacenie faktury kosztowej i przychodowej jest już przyciskiem u HHL;
- górny pasek filtruje tylko mapę; cyfra to liczba transportów w etapie;
- fala i wiatr z progów już wchodzą do pogody; osiem pozostałych progów jest tylko zapisanych.

Nie budować, dopóki właściciel nie powie „tak” na konkretny punkt:

- automatycznego otwierania szesnastu typów decyzji (dziś nikt ich nie otwiera; podłączenie zmieni codzienną pracę trzech firm);
- traktowania wyboru w centrum jako pełnej zmiany ceny, trasy albo rejsu — część przycisków tylko otwiera zakładkę albo dopisuje ślad;
- chowania pozycji dzwonka po kliknięciu — zrobione w L-5 (pozycja znika, licznik maleje, otwiera cel);
- nowych celów kliknięcia dla zdarzeń statusu i stref — dziś większość nie ma własnego ekranu;
- listy alternatywnych promów i objazdów w Szwecji na produkcji — kod celowo pisze „brak źródła” albo chowa stałą listę;
- trzech osobnych automatów „workflow HHL / KSH / Scandinavian Express” — takiego bytu w kodzie nie ma;
- podłączenia ośmiu progów (opóźnienie, daty KSH, awizacja, dokumenty, GPS, zjazd) — wzory są w §4 od 2026-10-04 00:07; L-3 je wdraża, zmiana liczby w Opcjach zmienia moment alarmu;
- zdjęcia cyfr z górnego paska — to zmiana wyglądu, nie poprawka błędu liczenia;
- nowego kreatora stref z mapą, krajem i odbiorcami — obecny formularz tego nie umie i nie wolno udawać, że umie.


## ETA i postój (2026-10-04)

ETA na placu nie jest liczona z planu załadunku ani z założonego rejsu. Źródło: pozycja GPS na odcinku szwedzkim albo, na promie, pozycja AIS statku. Brak pozycji zostawia pole puste.

Postój ponad czas wolny (decyzja 15) czyta parametry z Opcji, sekcja „Czas wolny i przestój". Domyślne wartości są WSTĘPNE: czas wolny 6 h / 4 h, 75 EUR/h, 750 EUR/doba, start od późniejszego z wjazdu i planu, rozpoczęta godzina w całości, powyżej 24 h stawka dobowa. Przekroczenie otwiera decyzję z podpowiedzią kwoty. Dopłatę wpisuje HHL ręcznie. Brak parametru w Opcjach nie otwiera decyzji.

Cele kliknięć: `docs/handover/CELE_KLIKNIEC.md`.
