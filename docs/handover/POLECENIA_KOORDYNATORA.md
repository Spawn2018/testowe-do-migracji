# Polecenia koordynatora — pełne opisy pozycji planu

Plik do zapisania w repozytorium: docs/handover/POLECENIA_KOORDYNATORA.md.
Każda pozycja ma: co zrobić, skąd pochodzi i po czym poznać, że jest gotowa.
Kolejne polecenia koordynatora dopisuj NA KOŃCU tego pliku, z datą,
zanim zaczniesz je wykonywać. Plan i polecenia żyją w repozytorium,
nie w rozmowie.

Źródła: ZLECENIE_POPRAWKI_02_10.md (część B — słowa właściciela),
docs/handover/LOGIKA_SYSTEMU.md (opis stanu kodu, 03.10),
decyzje D-61 i tabela DEC-CLICK (zaakceptowana 30.09).

---

## L-1 · Automatyczne otwieranie decyzji · P1
Źródło: B 2c, pytanie 3; LOGIKA §1 („nic nie otwiera decyzji").
Zrobić:
- każde ryzyko, które w tabeli DEC-CLICK (część B) ma typ decyzji,
  automatycznie otwiera decyzję z katalogu 16 typów
- jedno zdarzenie = jedna decyzja (bez duplikatów przy ponownym
  wykryciu tego samego ryzyka)
- zamknięcie ryzyka nie kasuje decyzji — decyzja ma własny status
Gotowe, gdy: test dla każdego z 16 typów — zdarzenie → decyzja otwarta,
drugie wykrycie → brak drugiej decyzji; na TEST centrum decyzji
pokazuje decyzje z symulacji SIM-1.

## L-2 · Kto decyduje · P1
Źródło: B 2c; LOGIKA §1 („wybór nie sprawdza, kto klika").
Zrobić: rozstrzygnąć decyzję może tylko firma wskazana w katalogu
(kolumna „kto decyduje") oraz administrator. Odmowa w bazie (funkcja),
nie tylko ukryty przycisk.
Gotowe, gdy: test — właściwa firma może, inna dostaje odmowę z bazy.

## L-3 · Osiem progów podłączonych do alarmów · P1
Źródło: B 6c; LOGIKA §4 (działają tylko fala i porywy).
Zrobić: progi z Opcji naprawdę sterują alarmami: próg opóźnienia,
wyprzedzenie dat KSH, awizacja ostrzeżenie/krytyczne, dokumenty
ostrzeżenie/krytyczne, brak pozycji GPS, zjazd z trasy.
Gotowe, gdy: dla każdego progu test — zmiana wartości w Opcjach zmienia
moment wywołania alarmu.

## L-4 · Cele kliknięć i link w e-mailu · P1
Źródło: pytania 1, 2, 12, 13; LOGIKA §8 i §12.
Zrobić: każde powiadomienie, ryzyko i kafelek prowadzi tam, gdzie mówi
tabela DEC-CLICK (okno decyzji, transport albo formularz z gotową akcją).
Żadna pozycja nie może prowadzić donikąd. E-mail linkuje do konkretnego
transportu albo decyzji, nie do strony głównej.
Gotowe, gdy: test dla każdego typu powiadomienia — klik otwiera
właściwy cel; link w e-mailu otwiera właściwy obiekt po zalogowaniu.

## L-5 · Dzwonek · P1
Źródło: pytanie 13 (słowa właściciela: „usunąć napis przeczytane,
mają znikać po kliknięciu").
Zrobić: bez napisu „przeczytane"; pozycja znika z listy po kliknięciu
i prowadzi do celu z L-4.
Gotowe, gdy: test — klik → pozycja znika, licznik maleje, otwiera cel.

## L-6 · „Ponów kopię" uruchamia kopię · P1
Źródło: LOGIKA §1 (dziś tylko zapisuje prośbę).
Gotowe, gdy: klik uruchamia kopię zapasową, a wynik (udana/nieudana)
widać w Stanie systemu.

## L-7 · Nazwy statusów „opóźniony" i „cichy" · P1
Źródło: B 8 (statusy), pytanie 4; LOGIKA §5.
Gotowe, gdy: na liście harmonogramu oba statusy mają własną polską nazwę.

## L-8 · Kafelki kokpitu · P1
Źródło: pytanie 12; LOGIKA §11.
Zrobić: kafelek KSH „Wymaga decyzji" liczy tylko to, co KSH widzi;
kafelek przewoźnika pokazuje bieżący tydzień zamiast stałego „tydzień 38".
Gotowe, gdy: test liczb dla każdej firmy.

## L-9 · Alternatywy dla rejsu · P1
Źródło: pytanie 5; LOGIKA §9.
Zrobić: na produkcji „Alternatywy dla rejsu" z prawdziwych rozkładów
w bazie — najbliższe rejsy Polferries i Stena. Bez danych zmyślonych.
Objazdy w Szwecji zostają ukryte.
Gotowe, gdy: lista z bazy; brak rozkładów = komunikat „Brak danych".

## L-10 · Opis trzech ścieżek pracy · P1
Źródło: pytanie 14 („3 workflow" = OPIS, nie automat).
Zrobić: docs/handover/WORKFLOW_FIRM.md — trzy schematy krok po kroku
(HHL, KSH, Scandinavian Express), od zaproszenia do zamknięcia
transportu, prostym językiem, ze schematami Mermaid.
Gotowe, gdy: plik w repozytorium.

## L-11 · Górny pasek bez numeru etapu · P1
Źródło: B 9, decyzja właściciela 03.10.
Zrobić: usunąć numer etapu (1–9) z kafelków; liczba transportów zostaje.

## L-12 · Kreator stref z mapą · P1
Źródło: B 6b, pytanie 16, decyzja właściciela 03.10; LOGIKA §14.
Zrobić (tylko HHL): ustawianie i przesuwanie środka strefy na mapie,
podgląd koła i zapasu na mapie, kraj, kogo powiadomić, usuwanie strefy.
Nowa strefa nie startuje na środku Bałtyku.
Gotowe, gdy: HHL tworzy, przesuwa, edytuje i usuwa strefę na mapie;
SMS ze strefy działa według kraju i rodzaju (test).

## L-13 · Zalew powiadomień · P1 (po L-5)
Źródło: koordynator — symulacja SIM-1 dała 155 powiadomień dla jednego
transportu.
Zrobić: rozbicie według typu, odbiorcy i firmy; łączenie duplikatów.
Gotowe, gdy: ponowna symulacja SIM-1 — liczba powiadomień na transport
i firmę w raporcie, bez duplikatów tego samego zdarzenia.

---

## Pozostałe pozycje koordynatora
- B-KSH (P2): lista harmonogramu KSH — klik → boczny panel tylko
  z „Edytuj"; KSH edytuje daty i godziny załadunku i rozładunku.
- B-REJSY (P2): rejsy — część B, sekcja REJSY, jako osobna pozycja.
- Q-11a (P2): pięć rozmiarów ekranu; Q-11b (P2): powiadomienia
  na Android i iOS.
- P2-TILES (P2): w testach wizualnych kafelki mapy z repozytorium.
- P3-APK (P3): przypięcie akcji workflow do SHA — gdy token dostanie
  uprawnienie workflow.
- npm audit (zasada): blokują tylko luki wysokie i krytyczne
  w zależnościach produkcyjnych; deweloperskie — P3, sprawdzane
  w niedzielnej bramie.
- SEC-OWASP (P1, na końcu planu, przed pilotażem): ASVS poziom 2,
  ZAP (pasywny na produkcji, aktywny tylko na środowisku testowym),
  zależności według OWASP, przegląd OWASP Top 10 dla bazy.
- KOPIA-D (P3): dograć kopię usuniete_standard_2026-10-03 na
  D:\Watch Tower\dane\, gdy komputer domowy będzie włączony.

## Zrobione (03.10)
PB-1–PB-4 (przejęcie), P1-FONT, B-1, B-8-IMP, usunięcie 42 STANDARD
(migracja 0137).

## KOLEJNOŚĆ OD TERAZ
L-1 → L-2 → L-3 → L-4 → L-5 → L-13 → L-6 → L-7 → L-8 → L-9 → L-10 →
L-11 → L-12 → część B od początku (pozycje zrobione w L oznacz
„zrobione w ramach L-x") → SEC-OWASP → część D po danych od właściciela.

---

## Polecenie 2026-10-03

Każde polecenie koordynatora najpierw dopisujesz na końcu tego pliku, z datą, i dopiero potem je wykonujesz. Wszystko o planie ma być w repozytorium, nie tylko w rozmowie.

---

## Polecenie 2026-10-03 — scalanie

Scalasz sam. Nie czekasz na właściciela, gdy zielone są testy aplikacji, gitleaks ma 0, a audyt produkcyjny nie ma luk wysokich ani krytycznych. Gdy prośba o scalenie zawiera migrację, brama bazy jest zielona, a migracja jest w repozytorium, zanim nałożysz ją na produkcję. Właściciel dostaje raport, nie przegląd kodu. Stop tylko przy liście STOP (konstytucja IX.3).

---

## Polecenie 2026-10-03 — start L-2

Start L-2. Rozstrzygnąć decyzję może tylko firma z katalogu (kto decyduje) oraz administrator. Odmowa w funkcji bazy, nie tylko ukryty przycisk.

---

## Polecenie 2026-10-03 — pełna brama przed produkcją

Od teraz bez wyjątków: migracja wchodzi na produkcję dopiero po pełnej bramie w częściach, zielonej na tym samym commicie i tej samej wersji migracji. Nałożenie 0138 na produkcję bez tej bramy było błędem. Bieżąca brama (0001…0139 od zera) obejmuje też zmiany z 0138.


---

## Polecenie 2026-10-03 — domknięcie L-1, stop L-3

Stop L-3. Najpierw domknąć L-1.

KR-07 rozstrzygnął właściciel (administrator) w aplikacji. Sprawdzić tylko, że w historii widać kto i kiedy. Nie szukać w tym błędu.

Dla pięciu decyzji ETA_AFTER_LATEST (KR-04, KR-05, KR-06, KR-07, SG-24) sprawdzić, czy są prawdziwe: data z pliku KSH, okno dostawy, wyliczona ETA i podstawa (GPS, awizacja, sam plan). Brak pozycji i awizacji → ETA nie otwiera decyzji „po terminie”. Fałszywe zamknąć z opisem „otwarta błędnie — brak danych” i poprawić warunek. KR-07: data w pliku była tekstem „14/12/2026”.

Do bramy bazy zestaw dec-auto: dla każdego z 16 typów zdarzenie → decyzja; drugie wykrycie → bez duplikatu; brak danych → bez decyzji. Pełna brama przed migracją na produkcję. Bez tego L-1 nie jest zamknięte. Nie zaczynać L-4 ani L-3.

---

## Polecenie 2026-10-03 21:02 (czas warszawski) — domknięcie L-1, SG-24, link kierowcy, L-1b, potem L-3

L-1 — domknięcie, w tej kolejności:

1. Scal 0140 i wdróż (pełna brama zielona). 9 typów decyzji działa, nie blokujemy reszty.

2. SG-24 — 5 pozycji GPS to TEST WŁAŚCICIELA: wysłał lokalizację swojego telefonu przez stary link dla kierowców. Zgoda właściciela na usunięcie.
   a) kopia tych 5 pozycji (R2, poza repozytorium), potem usunięcie migracją przez pełną bramę — tylko te 5 wierszy SG-24, warunek po źródle i czasie zapisu
   b) przelicz ETA dla SG-24; decyzję ETA_AFTER_LATEST zamknij z opisem „otwarta błędnie — pozycje testowe właściciela"
   c) sprawdź, czy przez ten link nie przyszły pozycje do innych transportów — raport, nic nie usuwaj bez zgody właściciela

3. Stary link dla kierowców — na produkcji wyłącz przyjmowanie pozycji (aplikacja kierowcy ukryta, D-38). Unieważnij wszystkie aktywne linki i tokeny kierowców; wejście na link pokazuje komunikat, że link jest nieaktywny. Test w bramie: pozycja z linku kierowcy = odmowa. Ponowne włączenie tylko decyzją właściciela.

4. Brakujące 7 typów decyzji NIE jest wymyślonych — wyzwalacze są w katalogu (ZLECENIE_DECYZJE_POWIADOMIENIA.md §2, tabela DEC-CLICK). Nowa pozycja L-1b, zaraz po L-3:
   - NO_AWIZACJA → w ramach L-3 (próg awizacji 48/12 h)
   - KSH_ROW_GONE, TOWER_KSH_CONFLICT, KSH_FILE_ERROR → przy obecnym imporcie Excela: wiersz zniknął względem poprzedniego importu; pole zmienione w Watch Tower różni się od pliku; pliku nie da się odczytać. SharePoint później użyje tego samego.
   - SEFS_OUT_OF_TABLE → indeks poza tabelą 51 progów albo brak źródła
   - KR_OVER_3 → więcej niż 3 ładunki KR jednego dnia
   - DWELL_OVER_FREE → postój w strefie ponad czas wolny (zadziała, gdy będą prawdziwe pozycje GPS)
   Do zestawu dec-auto test dla każdego typu.

5. Dopisz wszystko do POLECENIA_KOORDYNATORA.md i PLAN.md, potem L-3.

Nie zaczynać SEC-OWASP, P2-TILES, P3-APK ani części D.
---

## Polecenie 2026-10-04 00:07 (czas warszawski) — wzory progów L-3, SG-01, potem L-1b

L-3 — WZORY PROGÓW (zapisz w POLECENIA_KOORDYNATORA.md i LOGIKA_SYSTEMU.md):

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
D. Opóźnienie (ETA_AFTER_LATEST): ETA > koniec okna dostawy + próg z Opcji. ETA tylko z prawdziwych danych (GPS albo potwierdzony status). Sam plan → bez alarmu.
E. Brak GPS: ostatnia pozycja starsza niż próg (15 min) — tylko gdy pojazd ma podłączone źródło pozycji i status jest w ruchu (IN_TRANSIT_PL, AT_PORT_*, IN_TRANSIT_SE). Bez alarmu: READY, FERRY (na promie pozycja z AIS), AT_SITE, DELIVERED.
F. Zjazd z trasy (ROUTE_DEVIATION): odległość od trasy korytarza > próg z Opcji przez co najmniej 2 kolejne pozycje i co najmniej 10 min. Bez alarmu na promie i w strefach portów oraz placów.

TESTY: dla każdego wzoru — zmiana wartości w Opcjach zmienia moment alarmu; brak danych = brak alarmu; ostrzeżenie → krytyczne = ta sama decyzja.

9. SG-01: jedna pozycja z linku kierowcy (1 października 2026, 22:08 czasu warszawskiego, via=driver_token, wcześniej id 13). Test właściciela. Usuń tak samo jak SG-24: kopia w R2 poza repozytorium (ścieżka + sha256), migracja przez pełną bramę, tylko ten wiersz, warunek po źródle i czasie zapisu. Przelicz ETA. Nic innego nie usuwaj.

Potem L-1b z PLAN.md (zaraz po L-3): NO_AWIZACJA jest w ramach L-3. Reszta: KSH_ROW_GONE, TOWER_KSH_CONFLICT, KSH_FILE_ERROR przy obecnym imporcie Excela; SEFS_OUT_OF_TABLE; KR_OVER_3; DWELL_OVER_FREE. Źródło ZLECENIE_DECYZJE_POWIADOMIENIA.md §2 DEC-CLICK. Do zestawu dec-auto test dla każdego typu. Nowa migracja = pełna brama przed produkcją.

Nie zaczynać SEC-OWASP, P2-TILES, P3-APK ani części D.

## Polecenie 2026-10-04 01:17 (czas warszawski) — nocna brama wizualna

Rutyna WT nocna brama wizualna: `git pull --rebase`, `git lfs pull`, `npm run gate:visual` (bez nadzoru, własne build/port), wpis 1-liniowy w POSTEP.md (ujęć w progu / ponad, HEAD sha), commit+push bez --force. Zielona = cisza. Ponad próg = rano krótki raport PL (ile, które widoki, prawdopodobna przyczyna); wzorca nie odświeżać bez zgody właściciela.


## Polecenie 2026-10-04 13:31 (czas warszawski) — tempo: brama lokalna, paczki

TEMPO — zmiana sposobu pracy (bezpieczeństwo bez zmian):

1. BRAMA LOKALNIE: na komputerze była lokalna brama bazy (tests/db/gate.sh, Postgres 17, z przekazania) — działała w minuty. Sprawdź i przywróć ją jako podstawową. Bezpiecznik produkcji zostaje. Baza TEST w Supabase (emkbykwenwrjmbprydml) — tylko niedzielna brama tygodniowa i ostateczne potwierdzenie przed wdrożeniem paczki. Podaj czas pełnej bramy lokalnie.

2. PACZKI: migracje i zmiany zbierasz w jedną paczkę dziennie. Jedna pełna brama na paczkę, jedno wdrożenie na produkcję dziennie (wieczorem). Drobne poprawki danych (np. pozycja SG-01) — do najbliższej paczki, nie jako osobna migracja z osobną bramą.

3. RÓWNOLEGLE: gdy brama się kręci, piszesz następną pozycję z planu na kolejnej gałęzi. Nie czekasz bezczynnie.

4. Przy każdej zmianie w kodzie — szybkie testy (aplikacja + zestawy bazy dotknięte zmianą) w minutach. Pełna brama — raz na paczkę.

Zapisz w AGENTS.md i POLECENIA_KOORDYNATORA.md. Raport: czas bramy lokalnej i plan paczek na najbliższe 3 dni (które pozycje w której).

Stan z polecenia: L-3 (0143) jest już na produkcji. SG-01 (jedna pozycja driver_token, 1 października 2026, 22:08) nie jest jeszcze usunięta i wchodzi do najbliższej paczki, nie jako osobna migracja. L-1b nie zaczęte. Następne po L-3: L-1b, potem L-4…L-13. Nie zaczynać SEC-OWASP, P2-TILES ani części D.


## Polecenie 2026-10-04 13:35 (czas warszawski) — autor commitów i wdrożenie od razu

Ważniejsze niż dokańczanie samego pomiaru bramy. Zasady:

- Autor commitów TYLKO lokalnie dla tego repozytorium (nie globalnie): git config user.name "Sebastian Bożek" i git config user.email "sebastian.bozekq@gmail.com". To adres konta Vercel właściciela, plan Hobby inaczej blokuje wdrożenie. Nigdy sebastian@watch-tower.local. Nie ustawiaj --global.
- WDROŻENIA: po każdym scaleniu na produkcję od razu (także kilka razy dziennie), gdy brama jest zielona. Migracje: pełna brama lokalna przed każdym wdrożeniem z migracją. Paczki dzienne TYLKO jeśli lokalna brama okaże się wolna. Podaj jej czas.
- Reszta tempa z 13:31 zostaje, o ile nie sprzeczna: brama lokalna (tests/db/gate.sh, Postgres 17) podstawowa; Supabase TEST emkbykwenwrjmbprydml tylko niedziela i ostateczne potwierdzenie przed wdrożeniem; przy zmianie w kodzie szybkie testy; równolegle następna pozycja gdy brama się kręci.

Ponowić wdrożenie bieżącego main (migracja 0143 już na produkcji). Poprzednie wdrożenie dpl_9iuV7tt4g71bpp4USKQ8bmDuP89m jest zablokowane, bo zły autor. Nowy commit i wdrożenie muszą iść z sebastian.bozekq@gmail.com. Potwierdzić, że https://tower.log-mar.pl i https://watch-tower-makieta.vercel.app zwracają 200 i wskazują nowe wdrożenie, nie dpl_5tY7LDTCY9J4wEhdey4QwQYXK7As.

Nie osobna migracja SG-01.

## Polecenie 2026-10-04 13:47 (czas warszawski) — domknięcie bramy lokalnej

Polecenie właściciela Watch Tower z 2026-10-04 13:47 czasu warszawskiego. Najpierw dopisz CAŁE polecenie na końcu docs/handover/POLECENIA_KOORDYNATORA.md z datą, potem wykonaj. Repo /workspace/watch-tower-app. Autor commitów LOKALNIE (nie globalnie): Sebastian Bożek, sebastian.bozekq@gmail.com. Nigdy sebastian@watch-tower.local. Nie pushuj main bezpośrednio, nie --force. Nie drukuj sekretów. Nie używaj cloud agentów. Nie zmieniaj .github/workflows/.

Stan: lokalna brama tests/db/gate.sh na Postgres 17.11 localhost:5433 trwała 4 min 29 s i padła (kod 1). Przeszły m.in. security 88, status 44, storage 37, money 131, release 146, nullguard 528, i2 526, dec2 24, dec3 13. Nie przeszło: backup 17/12 bo brak age i age-keygen; dec5, dec6, adm10, hist11, dec-auto bo szukają bazy tower i same jej nie tworzą. W gate.sh liczby są stare (nullguard 389, i2 521, workflows 46, insurance 42) wobec 528, 526, 47, 42. Tej poprawki NIE scalono. Wdrożenie dpl_5TJ448knWmMVSimAytWMcfmqrFyY READY ~13:42, obie domeny 200. Potwierdź to jeszcze raz (curl) i wpisz w raporcie.

Kolejność:
1. Zainstaluj age i age-keygen (pakiet systemowy). Test kopii zapasowej ma przejść lokalnie.
2. Skrypt bramy sam tworzy bazę tower przed zestawami, które jej potrzebują, i usuwa ją po przebiegu.
3. Oczekiwane liczby w skrypcie zaktualizuj DOPIERO po punktach 1 i 2. Dla każdego zestawu w POSTEP.md: było → jest i który commit dodał te testy. Liczba bez wyjaśnienia = NIE zmieniaj, zgłoś w raporcie.
4. Pełna brama lokalna zielona. Podaj wynik i czas. Scal czekające (PR, nie push main).
5. Wdrożenie z autorem sebastian.bozekq@gmail.com już przeszło jako dpl_5TJ448knWmMVSimAytWMcfmqrFyY. Potwierdź identyfikator i że https://tower.log-mar.pl oraz https://watch-tower-makieta.vercel.app zwracają 200 na TYM wdrożeniu. Nie rób nowego wdrożenia, jeśli to się zgadza. Jeśli scalenie bramy zmieni main, wdrożenie od razu po zielonej bramie (nowy autor).
6. KOLEJKA BEZ DNI TYGODNIA: pracujesz ciągle, pozycja za pozycją, wdrożenie po każdej zielonej bramie. Zapisz to w AGENTS.md i POLECENIA (paczki dzienne OFF, bo 4:29 nie jest wolne). Następne po zielonej bramie: L-1b + usunięcie pozycji SG-01 (jedna pozycja driver_token, 1 października 2026 22:08 czasu warszawskiego, kopia R2 poza repo ścieżka+sha256, tylko ten wiersz, warunek po źródle i czasie, przelicz ETA), potem L-4, L-5, L-13. Nie zaczynaj L-1b zanim brama lokalna nie jest zielona i scalona. Nowa migracja = pełna brama lokalna przed produkcją. Supabase TEST emkbykwenwrjmbprydml tylko niedziela i ostateczne potwierdzenie przed wdrożeniem.

Raport: czas i wynik bramy, które liczby zmienione (było→jest, commit) a które zgłoszone bez zmiany, PR, deploy id i obie domeny, czy L-1b ruszyło.

## Polecenie 2026-10-04 14:14 (czas warszawski) — L-1b i pozycja SG-01

Polecenie właściciela po zielonej bramie lokalnej (4 min 56 s, kod 0). Kolejka ciągła, bez dni tygodnia. Wdrożenie po każdej zielonej bramie lokalnej.

Następne: L-1b razem z usunięciem pozycji SG-01, potem L-4, L-5, L-13. Nie zaczynać L-4 w tej paczce. Nie SEC-OWASP, nie kafelki mapy, nie część D.

L-1b (PLAN, zaraz po L-3). NO_AWIZACJA jest już w L-3, drugi raz jej nie robić. Reszta z ZLECENIE_DECYZJE_POWIADOMIENIA.md §2:
- KSH_ROW_GONE, TOWER_KSH_CONFLICT, KSH_FILE_ERROR przy obecnym imporcie Excela: wiersz zniknął względem poprzedniego importu; pole zmienione w Watch Tower różni się od pliku; pliku nie da się odczytać. SharePoint później użyje tego samego.
- SEFS_OUT_OF_TABLE: indeks poza tabelą 51 progów albo brak źródła.
- KR_OVER_3: więcej niż 3 ładunki KR jednego dnia.
- DWELL_OVER_FREE: postój w strefie ponad czas wolny (gdy będą prawdziwe pozycje GPS).
Do zestawu dec-auto test dla każdego typu, który wchodzi. Zasady L-3: progi tylko z tabeli Opcji, jeden alarm rośnie, brak danych = brak alarmu, czas Europe/Warsaw. Gdy opis typu jest niejednoznaczny — STOP na tym typie, resztę zrobić.

SG-01 w tej samej paczce: jedna pozycja driver_token z 1 października 2026, 22:08 czasu warszawskiego. Kopia R2 poza repozytorium (ścieżka i sha256). Usunięcie migracją tylko tego wiersza, warunek po źródle i czasie. Przeliczyć ETA. Nic innego nie usuwać.

Brama: tests/db/gate.sh, Postgres 17, localhost:5433, pełna brama lokalna raz przed scaleniem. Supabase TEST emkbykwenwrjmbprydml tylko niedziela i ostateczne potwierdzenie przed wdrożeniem. Po scaleniu wdrożyć od razu. Obie domeny mają zwracać 200 na nowym wdrożeniu.


## Polecenie 2026-10-04 14:40 (czas warszawski) — kolejka po L-1b

Po L-1b idzie L-4, potem L-5, L-13. DWELL_OVER_FREE jest STOP i nie ruszaj go.

## Polecenie 2026-10-04 14:43 (czas warszawski) — ETA tylko z pozycji i postój ponad czas wolny

Polecenie właściciela Watch Tower z 2026-10-04 14:43 czasu warszawskiego. Najpierw dopis na końcu docs/handover/POLECENIA_KOORDYNATORA.md z datą, potem wykonaj.

1. ETA wyłącznie z lokalizacji (GPS pojazdu; na promie pozycja statku z AIS). Liczenie ETA z planu usunąć z całej aplikacji. Brak pozycji → „–" z podpowiedzią „Brak pozycji GPS". SG-01 i inne nieodebrane transporty — bez ETA. Poprawić LOGIKA_SYSTEMU.md. Przeliczenie, które dotąd brało ETA z planu, zostawia ETA puste. Nie wymyślać AIS: jeśli źródła AIS nie ma, ETA promu czeka na AIS i nie wraca do planu.

2. DWELL_OVER_FREE jest ustalone (ZLECENIE_PO_SPOTKANIU_SCX §8 i decyzja nr 15). Czas wolny: załadunek 6 h, rozładunek 4 h; każda kolejna godzina 75 EUR; przestój 750 EUR/doba. Czas postoju ze zdarzeń stref (wjazd–wyjazd) — informacja dla HHL. Przekroczenie → decyzja nr 15: „dodaj dopłatę uzgodnioną" albo „nie dotyczy"; dopłata ręcznie (część B 10f), cennik tylko podpowiedź. Wszystkie parametry w Opcjach, sekcja „Czas wolny i przestój", wartości domyślne WSTĘPNE: (a) start = późniejsze z wjazdu i planowanej godziny, (b) rozpoczęta godzina w całości, (c) postój > 24 h → 750 EUR za rozpoczętą dobę zamiast stawki godzinowej. Test dla każdego parametru. Nie wpisywać 360/240 poza domyślnymi wartościami Opcji.

3. Potem L-4. Gdy opis L-4 jest niejednoznaczny — STOP, bez L-5, SEC-OWASP, kafelków mapy i części D.

## Polecenie 2026-10-04 14:48 (czas warszawski) — cele kliknięć, L-4

Właściciel podał cele kliknięć. Plik zapisany bez zmian jako docs/handover/CELE_KLIKNIEC.md. L-4 wykonać według sekcji „Gotowe, gdy" w tym pliku.

Każde powiadomienie, ryzyko i decyzja w kodzie ma cel z tabeli (test bramy odrzuca typ bez celu). Dla każdego typu test: klik z kokpitu, listy ryzyk, dzwonka i link w e-mailu otwiera ten sam cel. Żadne kliknięcie nie prowadzi na stronę główną. Typ nieznany → Szczegóły wpisu i błąd w teście. Brak uprawnień → „Brak dostępu", nigdy strona główna. Zdarzenie statusu albo strefy → zawsze Transport, bez mini-akcji. Linki e-mail: decyzja /decyzje/{id}, transport /transport/{kod}?zakladka=…, faktura /finanse/faktury/{id}, stan systemu /opcje/stan-systemu#{sekcja}. Nie wymyślać celów spoza pliku. Typ w kodzie, którego nie ma w tabeli — STOP na tym typie i raport, bez zgadywania. Pozycje oznaczone L-5, L-6, L-12 to cele linku, nie budowa tych pozycji teraz. Nie zaczynać L-5, SEC-OWASP, kafelków mapy ani części D.

Najpierw domknąć ETA i DWELL_OVER_FREE z polecenia 14:43, potem L-4.

## Polecenie 2026-10-04 15:47 (czas warszawski) — SMS_FALLBACK, WORKFLOW_ALERT, potem L-5

Polecenie właściciela Watch Tower z 2026-10-04 15:47 czasu warszawskiego. Najpierw dopis na końcu docs/handover/POLECENIA_KOORDYNATORA.md z datą, potem wykonaj.

1. Dopisać do docs/handover/CELE_KLIKNIEC.md sekcję E (reszty pliku nie przepisywać):
- SMS_FALLBACK → Stan systemu → Bramka SMS → wpis tego SMS-a (status, odbiorca, wysłany e-mail zastępczy) z linkiem do transportu. Widzi tylko HHL i administrator.
- WORKFLOW_ALERT → gdy dotyczy transportu: Transport → zakładka Status; gdy nie: Automatyzacje → reguła, która wywołała alert (podgląd reguły). Widzi według macierzy.

2. Zrealizować te dwa cele. Zdjąć je z zapasu „brak celu / Szczegóły wpisu”. Test dla każdego typu: kokpit, lista ryzyk, dzwonek i link w e-mailu otwierają ten sam cel; nigdy strona główna; brak uprawnień → „Brak dostępu”. SMS_FALLBACK ukryty poza HHL. WORKFLOW_ALERT bez transportu otwiera regułę automatyzacji, nie transport. Test bramy nadal odrzuca typ bez celu.

3. Potem L-5. Czytać L-5 z PLAN.md, docs/handover/LOGIKA_SYSTEMU.md i kryterium „Gotowe, gdy” oraz z CELE_KLIKNIEC.md (wpis bez obiektu znika z dzwonka po kliknięciu). Gdy opis L-5 jest niejednoznaczny — STOP i raport, bez wymyślania. Nie zaczynać L-6, L-12, L-13, SEC-OWASP, kafelków mapy ani części D.

## Polecenie 2026-10-04 15:57 (czas warszawski) — L-13

Polecenie właściciela Watch Tower z 2026-10-04 15:57 czasu warszawskiego. Najpierw dopis na końcu docs/handover/POLECENIA_KOORDYNATORA.md z datą, potem wykonaj. Tylko L-13.

L-13 z PLAN.md i LOGIKA_SYSTEMU.md, kryterium „Gotowe, gdy”: zalew powiadomień po SIM-1 (155 na jeden transport). Rozbicie według typu, odbiorcy i firmy. Łączenie duplikatów tego samego zdarzenia. Ponowna symulacja na fixture, bez prawdziwego e-maila i SMS. Raport: liczba powiadomień na transport i firmę, bez duplikatu tego samego zdarzenia.

Reguła „do L-13 tylko aplikacja” kończy się tylko tak, jak plan to pisze. Plan nie wymienia odbiorców, typów ani dostawcy e-maila ani SMS dla decyzji automatycznych. Tego nie włączać. Decyzje automatyczne zostają IN_APP.

Nie zaczynać L-6, L-12, SEC-OWASP, kafelków mapy ani części D. Celów w CELE_KLIKNIEC.md nie zmieniać.

## Polecenie 2026-10-04 16:02 (czas warszawski) — L-13, bez włączania e-maili

STOP przed włączeniem e-maila dla decyzji automatycznych. Najpierw dopis na końcu tego pliku, potem dalsza praca nad L-13.

Zanim e-mail decyzji automatycznych wolno włączyć:
1. Po odsieaniu duplikatów oszacować e-maile na dobę (na firmę i łącznie) przy obecnych 94 transportach i przy szczycie (około 10 transportów dziennie w ruchu). Limit Resend: 100 e-maili na dobę na wszystko.
2. Gdy szacunek przekracza 60 na dobę, zdarzenia niekrytyczne idą w skrót (na przykład co 2 godziny albo raz rano), a nie jako osobny e-mail. Krytyczne (czerwone decyzje, odwołany prom) wychodzą od razu.
3. Strażnik: przy 80 na dobę ostrzeżenie w Stanie systemu; przy 95 tylko e-maile krytyczne.
4. Podać liczby. E-maili nie włączać. Włączenie po L-13 czeka na wyraźne OK właściciela. Żadnego prawdziwego e-maila. Testy tylko na fixture.

Nie zaczynać L-6, L-12, SEC-OWASP, kafelków mapy ani części D.

## Polecenie 2026-10-04 17:03 (czas warszawski) — zlecenie HERE

Polecenie właściciela Watch Tower z 2026-10-04 17:03 czasu warszawskiego. Najpierw dopis na końcu tego pliku, potem reszta.

Plik zapisany bez zmian jako `docs/handover/ZLECENIE_HERE.md`. Kolejność w planie według sekcji 5 tego pliku. Decyzje D-77–D-84 w rejestrze `docs/handover/wzorzec/03_REJESTR_DECYZJI.md`.

Zasada nadrzędna: dodajemy wyłącznie funkcje oparte na HERE. Innych mechanizmów aplikacji nie zmieniamy. Wymiary zestawu dla każdego transportu poda właściciel (D-83). Kontrola trasy nie bierze niczego z dokumentów. Przewoźnik nie wprowadza żadnych wymiarów.

H-0 to test na koncie właściciela, bez zmian w aplikacji. Klucz `HERE_API_KEY` wpisuje właściciel do sekretów Supabase i `.env.local`. Gdy klucza nie ma, H-0 czeka. O klucz nie pytamy w rozmowie.

## Polecenie 2026-10-04 17:06 (czas warszawski) — e-mail decyzji automatycznych

L-13 przyjęte. Właściciel włącza e-mail decyzji automatycznych (`automatic_decision_email` = true). Niekrytyczne idą w skrót, jak w szacunku (szczyt 34 e-maile na dobę).

Zanim przełącznik jest true, w kodzie i w teście:
1. Krytyczne e-maile grupowane po zdarzeniu i po odbiorcy. Jedno zdarzenie (na przykład odwołany prom) = jeden e-mail do osoby, z listą wszystkich transportów, nie jeden e-mail na transport. Test: zdarzenie na 5 transportach → 1 e-mail na odbiorcę.
2. Gdy limit doby jest wyczerpany, powiadomienia w aplikacji i dzwonek działają bez zmiany. Stan systemu pokazuje, ile e-maili nie wyszło i do kogo.
3. Przy limicie najpierw krytyczne, potem skróty. Zaproszenia i reset hasła mają zawsze 10 e-maili na dobę w rezerwie.
4. Co tydzień `POSTEP.md` dostaje prawdziwe liczby produkcji: e-maile na dobę (średnia, maksimum, krytyczne, skróty) zestawione ze szacunkiem 34. Gdy strażnik 80 zapali się więcej niż dwa razy w tygodniu, raport do właściciela. Nie wpisywać liczb z tego tygodnia, jeśli nie da się ich odczytać.

Bez prawdziwego e-maila do osoby. Testy na fixture.

## Polecenie 2026-10-04 17:37 (czas warszawski) — gitleaks, P0

Polecenie właściciela Watch Tower z 2026-10-04 17:37 czasu warszawskiego. Najpierw dopis na końcu tego pliku, potem sprawdzenie. Bez commitu, scalenia i wdrożenia. Żadnego klucza nie wymieniamy. Bieżącej funkcji i H-0 nie ruszamy.

Poprzedni skan podał gitleaks = 3, nie klucz HERE: generic-api-key dwa razy w supabase/migrations/0102_dec2_decision_center.sql oraz jwt w tests/db/i2.sh. Sprawdzić samemu, nie ufać tej liczbie w ciemno.

1. Dla każdego trafienia: plik, linia, identyfikator reguły, SHA commitu i data wejścia do repozytorium (git log -S albo git blame). Wartości nie wypisywać. Najwyżej pierwsze 4 znaki i długość.
2. Ocena każdego: (a) prawdziwy sekret produkcyjny (klucz Supabase, zwłaszcza service_role, token, hasło, Resend, R2, Trafikverket, HERE) albo (b) wartość testowa, przykładowa albo publiczna. Uzasadnienie z otaczającego kodu, nie z tego, że ciąg wygląda losowo.
3. Gdy którekolwiek jest (a): STOP. Nie podmieniać, nie usuwać wartości z historii gita, nie rotować. Raport: który sekret, jakie uprawnienia daje, plan wymiany (nowy klucz, podmiana w sekretach, unieważnienie starego). Usunięcie żywej wartości z kodu bez OK właściciela jest zabronione, jeśli zatrzymałoby produkcję. Plan wolno opisać. Nie wykonywać go.
4. Gdy (b): wpis w .gitleaksignore z komentarzem, dlaczego to nie sekret, oraz zmiana fixture testowego tak, żeby nie wyglądał jak prawdziwy klucz (oczywista podróbka, na przykład przedrostek tylko do testu). Nie używać kształtu prawdziwego JWT ani klucza API.
5. Skan całej historii repozytorium, nie tylko drzewa roboczego (gitleaks git albo detect --log-opts). Podać sumę i każde trafienie poza obecnymi trzema tak samo (plik, reguła, commit, data, klasa a/b, pierwsze 4 znaki i długość). Wartości nie wypisywać.
6. Koniec: gitleaks 0 albo tylko udokumentowane wyjątki. Powtórzyć skan i podać liczbę. Jeśli historia nadal zawiera prawdziwy sekret, napisać to wprost i nie przepisywać historii.

Commit autora, jeśli wolno commitować wyłącznie ignore i zmianę fixture: Sebastian Bożek / sebastian.bozekq@gmail.com, lokalnie. Nie stage'ować .env.local. Nie stage'ować obcej brudnej pracy (migracja 0149 należy do innego przebiegu). Gdy drzewo jest za brudne, żeby commitować bezpiecznie, zostawić pliki gitleaks bez commitu i napisać to wprost.

## Polecenie 2026-10-04 17:46 (czas warszawski) — niespójność: flaga włączona, wdrożenie nie weszło

PILNE. E-maile decyzji włączone w bazie (migracja 0149), nowa wersja aplikacji nie wdrożona.

1. Najpierw sprawdzić, czy grupowanie e-maili krytycznych (jedno zdarzenie, jeden e-mail na odbiorcę z listą transportów), skróty i rezerwa 10 e-maili na dobę na zaproszenia i reset hasła są w funkcjach serwerowych już na produkcji (migracja 0149 i wcześniejsze), a nie tylko w niewdrożonym kodzie aplikacji. Czytać zastosowany SQL. Gdy tego nie ma w funkcjach bazy, albo nie ma pewności — ustawić AUTOMATIC_DECISION_EMAIL = false do czasu udanego wdrożenia (zgoda właściciela na to tymczasowe wyłączenie). Nic innego nie zmieniać. Policzyć, ile e-maili decyzji wyszło od włączenia flagi. Nie wysyłać żadnego e-maila.
2. Logi wdrożenia dpl_BfKMFMpswppKUcJhiqDZCFUhacQ4 — przyczyna błędu. Czy to strażnik gitleaks w procesie budowania?
3. Dokończyć wyjaśnianie 3 trafień gitleaks według polecenia 17:37. Tego przebiegu nie ruszać: inny przebieg klasyfikuje gitleaks. Nie przepisywać .gitleaksignore.
4. Gdy gitleaks jest wyjaśniony: wdrożenie, obie domeny 200 na nowym wdrożeniu, dopiero wtedy AUTOMATIC_DECISION_EMAIL = true, potem jeden testowy e-mail decyzji wyłącznie na adres właściciela. Tego przebiegu nie wdrażać i nie włączać flagi z powrotem.

## Polecenie 2026-10-04 18:52 (czas warszawski) — wdrożenie z main, wyjątki gitleaks, test e-mail, H-0

Właściciel zatwierdził wdrożenie. Dwa trafienia w paczce to klucze tłumaczeń opcji decyzji (prefiks dec_, długość 18), nie sekrety.

1. Dopisać do `.gitleaksignore` te dwa klucze (generic-api-key w `supabase/migrations/0102_dec2_decision_center.sql` i `src/i18n/decisions.ts`) z komentarzem: klucze tłumaczeń opcji decyzji — nie sekrety. Zostawić wcześniejszy wyjątek atrapy JWT z b40ff9c, jeśli już jest. W raporcie nie wypisywać pełnych napisów.
2. W AGENTS.md: wdrożenie produkcyjne zawsze z `main` po scaleniu, nigdy z gałęzi roboczej.
3. Commit lokalny: Sebastian Bożek / sebastian.bozekq@gmail.com. PR, bez pusha wprost na main, bez `--force`, bez `.env.local`. Scalenie, gdy gitleaks na śledzonym drzewie daje 0.
4. Wdrożenie produkcji wyłącznie z `main` po tym scaleniu. Obie domeny (tower.log-mar.pl i watch-tower-makieta.vercel.app) mają zwrócić 200 i wskazywać nowe wdrożenie. `AUTOMATIC_DECISION_EMAIL` zostaje true.
5. Po 200 na obu: dokładnie jeden testowy e-mail decyzji, tylko do właściciela (jeden z Sebastian@log-mar.pl albo sebastian.bozek@hhlogistics.pl, ten który produkt traktuje jako właściciela). Nie oba. Nie do przewoźników. Ścieżka powiadomień aplikacji. Po polsku, wyraźnie test, bez sekretów. Gdy nie da się wskazać jednego odbiorcy — nie wysyłać.
6. Potem H-0 z `docs/handover/ZLECENIE_HERE.md`: test na koncie właściciela, bez zmian w aplikacji. Klucza HERE nie wypisywać. Gdy H-0 wymaga zmiany aplikacji — stop. Pozycji po H-0 nie zaczynać.

## Polecenie 2026-10-04 19:29 (czas warszawski) — uzupełnienie H-0

Polecenie właściciela Watch Tower z 2026-10-04 19:29 czasu warszawskiego. Najpierw dopis na końcu tego pliku, potem odpowiedź. Bez zmian w kodzie aplikacji. Klucza HERE nie wypisywać i nie zapisywać.

Uzupełnić H-0, ten sam zestaw próbny (wysokość 4,2 m, szerokość 3,0 m, długość 25 m, masa 52 t, 6 osi), bo w 94 transportach wymiary są puste:

1. Śrem–Gdańsk, trzy limity wysokości 400 cm. Dla każdego: droga, miejscowość, współrzędne, rodzaj (wiadukt, most, tunel). Czy HERE ma objazd bez naruszeń. Różnica w km i czasie wobec 346,7 km / 4,7 h.
2. Karlskrona–Boden: jakie ograniczenie czasowe, gdzie i kiedy obowiązuje.
3. Nynäshamn–Boden: czy kontrola objęła szwedzkie klasy BK1–BK4. Wynik wprost dla każdej klasy.
4. Czasy HERE 4,7 / 13,2 / 18,6 h są dla zwykłej ciężarówki. Porównać z czasami z D-9. Propozycja, jak H-4 (ETA z GPS) uwzględni limit prędkości zestawu ponadnormatywnego (parametr HERE) oraz przerwy i odpoczynki kierowcy według przepisów UE o czasie pracy. Tylko propozycja, do akceptacji przed budową H-4. H-4 nie budować.
5. Wynik w `POSTEP.md`. Potem następna pozycja z `PLAN.md`, która realnie jest następna po H-0. Gdy jest niejednoznaczna albo wymaga akceptacji, zatrzymać się. Nie zmieniać innych mechanizmów aplikacji.

## Polecenie 2026-10-04 19:40 (czas warszawski) — limity Resend, status z odpowiedzi, testy bez wysyłki

Bez płatnego planu Resend. Bez nowych mechanizmów. Tylko odczyt Resend. Żadnego e-maila.

1. Z Resend (odczyt): kiedy odnawia się limit dzienny i miesięczny (data i godzina) oraz rzeczywisty status testowego e-maila wysłanego 2026-10-04 o 19:01 czasu warszawskiego na sebastian@log-mar.pl. Nie wysyłać.
2. L-13 punkt 2: Stan systemu ma pokazywać, ile e-maili nie wyszło. Test pokazał „wysłany” dla e-maila, który Resend odrzucił. Poprawka błędu L-13: status wyłącznie z odpowiedzi Resend.
3. Według NARZEDZIA_CURSOR.md sprawdzić, czy jakikolwiek test, symulacja albo brama wysyła przez Resend. Jeśli tak — to naruszenie zasady. Poprawić tak, żeby testy nie wysyłały.

Potem L-6 według polecenia z 19:38: „Ponów kopię” uruchamia istniejącą kopię, wynik w Stanie systemu. Bez H-4 i bez H-1. Nie zaczynać pozycji po L-6.

## Polecenie 2026-10-04 20:04 (czas warszawski) — POCZTA-3

Nie przerywać L-6. Żadnego e-maila.

Limit dzienny Resend odnawia się **5 października 2026 o 01:00** (właściciel, z panelu). Wtyczka tej daty dziennej nie podaje.

Limit miesięczny Resend odnawia się **25 października 2026 o 01:00** (właściciel, 2026-10-04 20:06). Obok daty dziennej. Zegar z odczytu użycia nie zastępuje tej godziny.

Testy, symulacje (w tym SIM-1) i bramy nie wysyłają przez Resend. Potwierdzone w kodzie: brama lokalna to Postgres na localhost, SIM-1 nie woła Resend, testy statusu są czyste, a test żywy keep-alive zeruje klucz i nie wysyła.

## Polecenie 2026-10-04 20:05 (czas warszawski) — wdrożenie z main bez kolejnej zgody

Po zielonej bramie i scaleniu na `main` wdrażać produkcję od razu, z `main`. Nie czekać na kolejną zgodę. Bez wysyłki e-mail. `AUTOMATIC_DECISION_EMAIL` bez zmian.

## Decyzja D-85 (2026-10-04) — ETA w pełni automatyczne

H-4 nie budować (czeka na emtrack). Propozycja limitu km/h w Opcjach jest nieaktualna.

ETA z bieżącej pozycji GPS, zero ręcznego wpisu, także prędkości. Łańcuch: droga PL i SE (HERE, wymiary D-83, ruch, utrudnienia, wiatr H-10, zakazy H-12), współczynnik zestawu uczona z planu (start: czasy D-9 wobec HERE), prom (rozkład, status, AIS, następny rejs tego armatora), port, godziny kierowcy (przerwa 45 min po 4,5 h, odpoczynek na promie, licznik od nowa po promie, osobno przy zmianie kierowcy). Rozbicie: jazda, prom, port, przerwy, wiatr, ruch.

Komunikat HERE o ogólnym limicie wysokości województwa (400 cm) to przepis, nie przeszkoda. Ryzyko tylko dla konkretnego wiaduktu, mostu albo tunelu.

## Polecenie 2026-10-04 20:10 (czas warszawski) — D-85, droga SE

Nie przerywać L-6. H-4 nie budować. Żadnego e-maila.

Punkt 1 decyzji D-85, droga w Szwecji, z Trafikverket, pełny zakres, nie tylko utrudnienia:

- sytuacje na drodze: wypadki, zamknięcia, roboty, ograniczenia dla ciężarówek
- stan nawierzchni: śnieg, lód, gołoledź — zestaw na tych odcinkach jedzie wolniej
- pomiary ze stacji przy drodze: wiatr i temperatura nawierzchni; na bieżącym odcinku pomiar wygrywa z prognozą (H-10), na dalszych zostaje prognoza

Wpływ nawierzchni na prędkość: start z oficjalnych wytycznych, potem kalibracja uczona z GPS (II-7b). Bez ręcznych wartości. W rozbiciu ETA osobna linia „nawierzchnia”.

II-6 już bierze `RoadCondition` i `WeatherMeasurepoint` (nawierzchnia E4 oraz wiatr i temperatura nawierzchni) i składa z tego jeden współczynnik na cały korytarz oraz ryzyko ROAD_SE. Nie bierze sytuacji: obiekt `Situation` wypadł z Open API (D-34, 01.10.2026), a zadanie `road-se` i tak go nie woła. Do dodania przy H-4: zastępcze źródło sytuacji, spowolnienie na odcinku oraz linia „nawierzchnia”. Zapis w `ZLECENIE_HERE.md` i w rejestrze (D-85).

