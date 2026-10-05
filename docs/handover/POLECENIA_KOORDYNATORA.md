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

II-6 już bierze `RoadCondition` i `WeatherMeasurepoint` (nawierzchnia E4 oraz wiatr i temperatura nawierzchni) i składa z tego jeden współczynnik na cały korytarz oraz ryzyko ROAD_SE. Nie bierze sytuacji: obiekt `Situation` wypadł z Open API (D-34, 01.10.2026), a zadanie `road-se` i tak go nie woła. Sytuacje (wypadki, zamknięcia, roboty) wchodzą w H-2 jako B-2b, zaraz po L-12, nie w H-4. Przy H-4 zostaje spowolnienie na odcinku i linia „nawierzchnia”.

## Polecenie 2026-10-04 20:15 (czas warszawski) — L-7

Tylko L-7. H-4 nie budować. H-1 nie zaczynać. L-8 nie zaczynać. Bez e-maila. Testy nie wołają Resend.

Źródło: część B 8, pytanie 4; LOGIKA §5. Na liście harmonogramu statusy „opóźniony” i „cichy” mają własną polską nazwę. Dziś zamiast nich widać nazwę etapu (albo „w drodze w Polsce”, gdy etapu brak).

Gotowe, gdy: na liście harmonogramu oba statusy mają własną polską nazwę. Język interfejsu polski. Bez nowych angielskich napisów w widoku polskim.

Po zielonej bramie: PR, scalenie, wdrożenie z main od razu, bez pytania. Obie domeny 200 na nowym wdrożeniu.

## Polecenie 2026-10-04 20:22 (czas warszawski) — L-8

Tylko L-8. H-4 nie budować. H-1 nie zaczynać. L-9 nie zaczynać. Bez e-maila. Testy nie wołają Resend.

Źródło: pytanie 12; LOGIKA §11. Kafelek KSH „Wymaga decyzji” liczy tylko to, co KSH widzi (ryzyka z listy Ryzyk, nie Centrum decyzji). Kafelek przewoźnika pokazuje bieżący tydzień zamiast stałego „tydzień 38”.

Gotowe, gdy: test liczb dla każdej firmy. Język interfejsu polski. Bez nowych angielskich napisów w widoku polskim.

Po zielonej bramie: PR, scalenie, wdrożenie z main od razu, bez pytania. Obie domeny 200 na nowym wdrożeniu.

## Polecenie 2026-10-04 20:23 (czas warszawski) — kolejka, pytania 17–19, R-0

L-8 nie przerywać. Po L-8 tylko dokumenty. Nic nie kasować. H-1 i H-2 nie startują. Status R-1 bez zmiany.

1. Po L-12: H-1, H-2, H-3, dopiero potem część B. H-2 i H-3 od razu, gdy przyjdzie kolej. H-1 zbudować i zostawić wyłączone do wymiarów (D-83).
2. Q-17, Q-18 i Q-19 są w planie (pytania 17–19 z części B). Dopisane jako własne wiersze. Reszta części B i C już była (B-1–B-10, B-KSH, B-REJSY, C-SEP, pytania 1–16 w L albo w B-Q).
3. P2-TILES i P3-APK zostają w tle. Tygodniowy raport poczty, niedzielna brama i luki narzędzi deweloperskich bez zmian.
4. Resend, sam odczyt, bez wysyłki. Miesiąc: 429 z 3000, limit miesięczny nie jest wyczerpany. Reset miesięczny według API: 25.10.2026 02:03 czasu warszawskiego. Dzień: 203 z 100, wyczerpany. Reset dzienny według API: 05.10.2026 01:59 czasu warszawskiego. Właściciel podał 05.10.2026 01:00 i 25.10.2026 01:00. Zaproszenia i e-maile od 5 października, gdy dzienny limit wróci.
5. Drugie polecenie R-0 (lista do potwierdzania punkt po punkcie) jest nieważne. Nie zapisane. Obowiązuje trzecie: R-0 to plan. Kasowane tylko transporty i wiersze na kluczu obcym. Reszta zostaje. Wykonanie dopiero tuż przed R-1, po pisemnej akceptacji. 94 transporty zostają.

Sytuacje drogowe Trafikverket nie czekają na H-4. To B-2b i część H-2, zaraz po L-12.

## Polecenie 2026-10-04 20:35 (czas warszawski) — L-9

Tylko L-9. L-10, H-1 i H-2 nie startują. Nic nie usuwać. Bez e-maila. Testy nie wołają Resend.

Źródło: pytanie 5; LOGIKA §9. Na produkcji „Alternatywy dla rejsu” biorą się z prawdziwego rozkładu w bazie (`sailings`): najbliższe rejsy Polferries i Stena. Bez danych zmyślonych. Objazdy w Szwecji zostają ukryte.

Gotowe, gdy: lista jest z bazy; brak rozkładu = komunikat „Brak danych”. Język interfejsu polski.

Po zielonej bramie: PR, scalenie, wdrożenie z main od razu, bez pytania. Obie domeny 200 na nowym wdrożeniu. Migracji nie ma, więc pełna brama bazy nie jest warunkiem.

## Polecenie 2026-10-04 20:52 (czas warszawski) — L-10

Rozstrzygnięcia L-10 z istniejących ustaleń. Nowsze wygrywa. Najpierw ten zapis, potem opis trzech ścieżek. Bez zmiany logiki aplikacji i bez migracji. Nic nie kasować. Status R-1 bez zmiany.

1. Trzy różne momenty, nie trzy wersje:
   - ROZŁADUNEK (UNLOADED) = data realizacji usługi (faktura, kurs NBP, opłata paliwowa — W5). Wyjazd ze strefy placu z telematyki, bez niej potwierdzenie dyspozytora (ZLECENIE_PO_SPOTKANIU_SCX §2). Zastępuje starszy zapis „rozładunek nigdy automatycznie".
   - DOSTARCZONY (DELIVERED) = zamknięcie transportu: HHL po komplecie dokumentów — samo CMR, wgrywa dyspozytor przewoźnika albo HHL (§0).
   - FAKTURA OPŁACONA = status finansowy, tylko HHL (Q-6).
2. Do czasu telematyki statusy, w tym załadunek i rozładunek, ustawiane ręcznie przez dyspozytora przewoźnika i HHL (przycisk + dziennik, §2). Z pozycjami — strefy automatycznie. Kierowca nic (D-38, D-79).
3. Opis = stan dzisiejszy. Zaplanowane zmiany oznaczone wprost, np. „planowane: KSH edytuje daty i godziny (B-KSH)", „docelowo harmonogram z SharePoint (D-12, D-SP)".
4. Import: tylko HHL (I-2a). Instrukcję KSH popraw zgodnie z macierzą widoczności — KSH nie rozstrzyga żadnej z 16 decyzji.

## Polecenie 2026-10-04 22:32 (czas warszawski) — REJESTR_CALOSCI, poprawki

Osobny PR, tylko docs. Nie wchodzić na gałąź H-2. Nie zaczynać części B. Nie robić H-2 ani H-3.

1. D-66–D-76 to decyzje właściciela z 02.10 (`ZLECENIE_POPRAWKI_02_10.md`, „CZĘŚĆ 2 — NOWE DECYZJE”). Sprawdzić `grep` D-66–D-76. Dopisać do `03_REJESTR_DECYZJI.md` dosłownie z tego pliku. D-69 w wersji końcowej („ / ” podstawowy; „|” tylko przy przepięciu i tylko w Watch Tower; SharePoint zawsze „ / ”). Jeśli w pliku ich nie ma — zgłosić, nie odtwarzać.
2. D-26: status „przeniesiona do III-13, zamknięta”. D-19: „numer nieużyty”. D-20 i D-34 w PLAN.md §4 to inna numeracja — zmienić na nazwy opisowe albo numery z rejestru. Jedna numeracja D-n w projekcie.
3. Statusy: D-8 obowiązuje — „Standard” = transporty NTG (potwierdzenie właściciela 04.10). Zapis w `PACZKA_DECYZJI_30_09.md` („tężniki T, bez osobnej stawki”) nieaktualny — adnotacja „zastąpione 04.10”. Kod, import, cennik i UI: jeśli opisują STANDARD jako tężniki, zgłosić, nie zmieniać logiki. D-28 zmieniona przez D-77 (własny silnik = zapas). D-54: część „wymiary od przewoźnika” zastąpiona przez D-83 i D-68. D-9: czasy = start kalibracji (D-85); ETA z planu usunięte (D-80). D-3, D-14, D-15: otwarta — czeka na potwierdzenie. D-17, D-32: treść ze źródła albo „treść utracona”. D-34: obowiązuje (kolizja numeru z PLAN.md).
4. Sprzeczności rozstrzygnąć, nie pytać: D-8 jak w punkcie 3; kopia `wzorzec/STAN` przegrywa z PLAN.md; II-7 zrobione (blokada dotyczyła starego planu HERE); SCOPE 56.1 wygrywa z 56.2, z wyjątkiem późniejszego datowanego „zrobione” tylko z dowodem z punktu 5.
5. Drugie przejście pozycji NIEZNANY. „Zrobione” wyłącznie z dowodem (plik, migracja albo test). Brak dowodu = „do zrobienia”. Tabela ID | status | dowód. Osobno powtórzenia i pozycje bez sensu — do decyzji koordynatora.
6. Pozycje bez miejsca w PLAN.md, które są „do zrobienia”: przypisać do etapu w PLAN.md albo „do decyzji koordynatora”.

## Polecenie 2026-10-04 (czas warszawski) — REJESTR — przyjęte

Rejestr z PR #38 przyjęty. Osobny PR, tylko dokumenty. Bez wdrożenia. Nie wchodzić na gałąź H-3. Części B nie zaczynać. DRV-CLOSE nie wykonywać.

1. Zacommitować `REJESTR_CALOSCI.md` i trzy niezacommitowane pliki z `docs/handover`, jeśli leżą poza `main`. Osobny PR, tylko docs, scalenie, bez wdrożenia. Jeśli pliki już są na `main` — nie robić pustego PR.
2. U-36: w `ZLECENIE_HERE.md` dopisać „H-9 — usunięte 04.10 (U-36)”.
3. Rozjazdy U-3, U-5, U-8, U-32 i pozostałe z sekcji 3: dla każdego podać, czy rozjazd jest tylko w dokumentach, czy także w kodzie. U-3: jeśli kod liczy tydzień opłaty paliwowej od rozładunku zamiast od daty załadunku (D-34) — pozycja planu jako błąd P1, bez naprawy kodu. U-32: czy kod używa 5 dni zamiast D-41 (4; 5 przy ciężkiej pogodzie w SE). Rozjazd tylko w dokumentach — poprawić dokument z adnotacją „poprawione 04.10”. W kodzie — pozycja w `PLAN.md`, bez naprawiania teraz.
4. U-17: w `PLAN.md` pozycja STD-CLEAN — usunięcie resztek klasy STANDARD (cennik 0100 i `rateCard.ts`, typ wiersza, szuflada ładunku, pomijanie zezwolenia). Bez wykonania teraz.
5. REJESTR — DOWODY: drugie szukanie dla pozycji „do zrobienia”. „zrobione” wyłącznie z dowodem (plik, migracja albo test). Brak dowodu = „do zrobienia”. Wynik w `REJESTR_CALOSCI.md`. Część B dopiero po akceptacji koordynatora tego wyniku.

U-38: zamknąć stary link kierowcy. Pozycja w `PLAN.md`: DRV-CLOSE (P1, po REJESTR — DOWODY, przed częścią B). Zakres, bez wykonania teraz: odebrać anonimowi dostęp do `driver_post_position` (migracja); unieważnić wszystkie wydane tokeny kierowców; trasa `#/driver/:token` pokazuje „Link nieaktywny”; kod zostaje w repozytorium, bez usuwania; test: anonim z ważnym tokenem dostaje odmowę, pozycja się nie zapisuje; pozycje mają przychodzić wyłącznie z telematyki (D-36).

U-8: obowiązuje „fakturę SCX widzą HHL i SCX (wystawca); KSH nie widzi”. Kod bez zmian. Poprawić zapis w dokumentach z adnotacją „doprecyzowane 04.10” i zamknąć rozjazd U-8 w sekcji 3 rejestru.

## Polecenie 2026-10-04 (czas warszawski) — TRIAGE REJESTRU, akceptacja koordynatora

Osobny PR, tylko dokumenty. Bez wdrożenia. Nie wchodzić na gałąź H-3. Kodu nie zmieniać. Części B nie zaczynać.

1. Zapisać `TRIAGE_REJESTRU.md` w `docs/handover/` (treść decyzji). Wpisać statusy do `REJESTR_CALOSCI.md` (sekcja drugiego przejścia) i do `PLAN.md`. „Zrobione przez X” tylko gdy X ma dowód: plik, migracja albo test. Brak dowodu: nie oznaczać zrobione, zgłosić listę.
2. Przywrócić w `REJESTR_CALOSCI.md` sekcję „USTALENIA Z ROZMÓW” (U-1–U-50) ze źródła w gicie. Jeśli w gicie jej nie ma, zgłosić i nie wymyślać.
3. Do `PLAN.md`: H-2-PL (utrudnienia PL z HERE), CLEAN-MAPLIBRE (P3). SMS-KSH-1H tylko gdy SCX-§5 nie jest spełnione. Kryteria U-3-PALIWO rozszerzyć o punkt 4 pliku (32.x/33.x). Pozycji nie wykonywać.
4. Pozycje „do sprawdzenia” z punktu 6: jeden raport, bez budowania.
5. Kolejność: H-3, potem U-3-PALIWO, potem DRV-CLOSE, potem STD-CLEAN. Część B rusza po tych czterech. Tabela dowodów jest przyjęta.

## Polecenie 2026-10-04 (czas warszawski) — SMS-KSH-1H, sprawdzenie D-37

Osobny PR, tylko dokumenty. Bez wdrożenia. Nie wchodzić na gałąź U-3-PALIWO. Kodu nie zmieniać. DRV-CLOSE, STD-CLEAN, VERIFY-13 i części B nie zaczynać.

D-37: jeden SMS do KSH około 1 h przed przyjazdem auta na załadunek. To nie jest SMS co godzinę.

Sprawdzić w kodzie i migracjach (0106, 0116, L-12, strefa zbliżania w Śremie), czy SMS przychodzi około 1 h przed wjazdem (promień albo czas dojazdu), czy liczy samą odległość albo sam fakt wejścia w strefę.

Jeśli nie spełnia: dopisać do `PLAN.md` pozycję SMS-KSH-1H z tym kryterium. Jeśli spełnia: żadnej pozycji.

Kolejność bez zmian: U-3-PALIWO, potem DRV-CLOSE, potem STD-CLEAN, potem VERIFY-13, potem część B. VERIFY-13 tylko zapamiętać, nie wykonywać.

## Polecenie 2026-10-04 (czas warszawski) — SMS-KSH-1H, rozszerzenie D-37 i D-64

Osobny PR, tylko dokumenty. Bez budowy funkcji i bez wdrożenia. Nie wchodzić na gałąź U-3-PALIWO. Najpierw U-3-PALIWO, potem DRV-CLOSE, STD-CLEAN, SMS-KSH-1H, VERIFY-13, a dopiero potem część B.

Decyzja właściciela 04.10.2026:

- Załadunek (Śrem) i rozładunek (Boden) podlegają tej samej zasadzie.
- SMS „strefa zbliżania” (koło 50 km) jest ZASTĄPIONY SMS-em „1 h przed przyjazdem”: wysyłka następuje, gdy wyliczony czas dojazdu do placu wynosi ≤ 60 min.
- Czas dojazdu jest liczony z bieżącej pozycji GPS tym samym mechanizmem co ETA (D-80): HERE, gdy dostępne; własny silnik (0122), gdy flaga jest wyłączona albo budżet HERE wyczerpany.
- Jeden SMS na transport na każdy koniec trasy; pierwsza pozycja już bliżej niż 60 min oznacza SMS od razu.
- Brak pozycji GPS oznacza brak SMS i ryzyko „brak pozycji” jak dziś.
- SMS „wjazd na plac” pozostaje bez zmian.
- Odbiorcy bez zmian: 2 osoby na załadunku i 2 osoby na rozładunku (D-64); odbiorców wpisuje administrator.
- Treść SMS: kto, nr rejestracyjny, przewidywana godzina przyjazdu.

Testy (SIM-1 na TEST, numer właściciela), nie wykonywać teraz: dojazd z 120 min → jeden SMS przy ≤ 60; start w 40 min → SMS od razu; brak GPS → brak SMS; powtórne pozycje → bez duplikatu; to samo dla Boden.

## Polecenie 2026-10-04 (czas warszawski) — U-3-PALIWO, wykonanie

Osobny PR. Nie włączać H-1 ani H-3. Nie ruszać DRV-CLOSE, STD-CLEAN ani części B.

Tydzień opłaty paliwowej od daty załadunku (D-34), nie od rozładunku. Kurs NBP zostaje od rozładunku. Test: załadunek w tygodniu N i rozładunek w N+1 dostaje stawkę z tygodnia N. Kryteria SCOPE 32.x i 33.x tak, jak w PLAN.md. Nie zgadywać stawek. Brama lokalna zielona przed scaleniem.


## Polecenie 2026-10-04 (czas warszawski) — ETA-PRE-LOAD i diagnoza ETA

Osobny PR, tylko dokumenty. Bez zmian w kodzie, bez diagnozy teraz, bez wdrożenia. Nie wchodzić na gałąź U-3-PALIWO.

1. ETA dostawy pokazujemy dopiero po załadunku (wyjazd ze strefy placu w Śremie). Przed załadunkiem w polu ETA tylko kreska „–”, bez tekstu — wszędzie: harmonogram, szczegóły, kokpit, eksport, e-maile. SMS-KSH-1H liczy czas dojazdu do Śremu w tle i dalej działa. Test: auto z pozycją GPS przed załadunkiem → ETA „–”; po wyjeździe ze strefy placu → ETA się pojawia.
2. Diagnoza (nie teraz w kodzie): właściciel widzi ETA dla SG-01, SG-24, KR-04, KR-05, KR-06, KR-07. Dla każdego podać, skąd wartość: ostatnia pozycja GPS i jej data / wartość zapisana przed 0146 / wartość liczona z planu. Wartość liczona z planu = błąd P1, zgłosić miejsce w kodzie. Wartości sprzed 0146 tylko zgłosić; posprząta R-0.

Kolejność: U-3-PALIWO → diagnoza ETA (SG-01, SG-24, KR-04, KR-05, KR-06, KR-07, bez zmian w kodzie) → DRV-CLOSE → STD-CLEAN → SMS-KSH-1H + ETA-PRE-LOAD (jeden PR, ten sam mechanizm) → VERIFY-13 → część B.

## Polecenie 2026-10-05 (czas warszawski) — DRV-CLOSE, wykonanie

Osobny PR. Nie robić STD-CLEAN, SMS-KSH-1H, ETA-PRE-LOAD, VERIFY-13 ani części B. Nie włączać H-1 ani H-3. Nie kasować transportów.

U-38: odebrać anonimowi dostęp do `driver_post_position` (migracja). Unieważnić wszystkie wydane tokeny kierowców. Trasa `#/driver/:token` pokazuje „Link nieaktywny”. Kodu nie usuwać. Test: anonim z ważnym tokenem dostaje odmowę, pozycja się nie zapisuje. Pozycje wyłącznie z telematyki (D-36). Brama lokalna zielona na tym samym commicie przed scaleniem i produkcją.

## Polecenie 2026-10-05 (czas warszawski) — dowody U-3-PALIWO, 32.x i 33.x

Osobny PR, tylko dokumenty. Bez zmian w kodzie, bez migracji i bez wdrożenia.

Raport dowodów dla punktu 4 w TRIAGE_REJESTRU.md (32.1–32.5, 33.1–33.6). Brak testu zmiany czasu 25.10.2026 przy tygodniu paliwa (Europe/Warsaw) zamyka 33.3 jako brak, mimo granicy niedziela/poniedziałek lato/zima. Pozycja PALIWO-33.3 w PLAN.md: po VERIFY-13, przed częścią B. Bez wykonania teraz.

## Polecenie 2026-10-05 (czas warszawski) — PALIWO-33.3, termin i test

PALIWO-33.3 przyjęte. Termin realizacji: najpóźniej 23.10.2026, niezależnie od postępu części B.

Test (nie wykonywać teraz): transport z załadunkiem w niedzielę 25.10.2026 przed 03:00 i po 03:00 oraz w poniedziałek 26.10.2026 — przypisanie do właściwego tygodnia w czasie `Europe/Warsaw`.

Nie wykonywać testu w tym przebiegu. Tylko dokumentacja; bez zmian w kodzie, bez wdrożenia.

## Polecenie 2026-10-05 (czas warszawski) — STD-CLEAN, wykonanie

Osobny PR. Nie robić SMS-KSH-1H, ETA-PRE-LOAD, VERIFY-13, PALIWO-33.3 ani części B. Nie włączać H-1 ani H-3. Nie kasować transportów. Nie wołać Resend.

U-17: usunąć resztki klasy STANDARD. Cennik: migracja po 0100 i `src/lib/rateCard.ts` — bez pozycji STANDARD i bez nowej stawki. Typ wiersza i szuflada ładunku nie pokazują klasy STANDARD. Pomijanie zezwolenia dla STANDARD schodzi (klient i `load_needs_permit`). Import nadal pomija wiersze TYP = STANDARD (B-8-IMP, ładunki NTG). Nie wymyślać cennika. Brama lokalna zielona na tym samym commicie przed scaleniem i produkcją.

## Polecenie 2026-10-05 (czas warszawski) — B-MAPA, podkład i rysowanie

Osobny zapis decyzji. Bez budowy w tym poleceniu. Kolejność przed częścią B zostaje taka, jak przed tym zapisem. Późniejsze polecenie AIS-SRC wstawia AIS-SRC między SMS-KSH-1H a VERIFY-13.

Decyzja właściciela 2026-10-05. Zmienia zakres H-6. Obejmuje Q-17 i Q-19.

Stan: wszystkie mapy mają podkład Esri „World Light/Dark Gray Base”. Brak nazw miast, ulic i numerów dróg, brak klas dróg, zoom max 16. Podpis „OpenStreetMap · CARTO” jest błędny — kafelki są z Esri.

1. Podkład: HERE Raster Tile API v3, styl logistyczny, wersja jasna i ciemna zgodnie z motywem. Na wszystkich mapach: widok Mapa, kokpit, szczegóły transportu, kreator stref, odtwarzanie przebiegu. Zoom do poziomu, na którym widać plac w Śremie i w Boden. Podpis źródeł: HERE (w trybie zapasowym — właściwy dostawca). Usunąć podpis „OpenStreetMap · CARTO” przy kafelkach Esri.
2. Budżet D-78, 100 USD miesięcznie, wspólny dla wszystkich usług HERE. Przy 80% mapy same przechodzą na zapasowy podkład z etykietami (miejscowości, ulice, numery dróg), nigdy na obecny szary. Powrót na HERE od 1. dnia miesiąca. Zużycie kafelków i dopasowania śladów widoczne w Stanie systemu.
3. Trasa planowana z geometrii trasy HERE, dokładnie na drogach. Pozycja auta: surowy punkt GPS, bez przesuwania; zapis w bazie bez zmian. Przejechany ślad: HERE Route Matching wyłącznie do rysowania; surowe pozycje nietknięte. Jeśli pomiar pokaże zagrożenie budżetu — ślad z samych punktów i informacja w raporcie. Pozycja promu z AIS bez zmian. Trasa promu z historii AIS, po torze wodnym, nigdy prosta przez ląd. Warstwa przeszkód HERE dla wymiarów (H-6): zbudować, zostawić wyłączoną do wymiarów (D-83).
4. Przed budową pomiar na TEST: kilku użytkowników, typowy dzień. Szacunek miesięczny w USD razem z resztą wydatków HERE. Warunki licencji kafelków i dopasowania zgodne z D-81 (dane HERE najwyżej 30 dni).
5. Testy: każda mapa ładuje podkład HERE, jasny i ciemny; symulacja 80% budżetu — podkład zapasowy z etykietami, zero zapytań o kafelki HERE do końca miesiąca; trasy Śrem–Gdańsk i Nynäshamn–Boden leżą na drogach; ślad przejazdu przez rondo leży na drodze; trasy promów Gdańsk–Nynäshamn i Gdynia–Karlskrona nie przecinają lądu; pozycja auta w bazie = surowy GPS; wzorce zrzutów odświeżone raz, z opisem przyczyny.
6. Część B, pozycja B-MAPA, pierwsza z prac nad mapami, przed B-7a, B-7b i B-7c. Bez budowy teraz.

## Polecenie 2026-10-05 (czas warszawski) — AIS-SRC i Q-18

Osobny zapis decyzji. Bez budowy w tym poleceniu. Klucz AISSTREAM_API_KEY już jest w sekretach Edge produkcji i w .env.local. Nie prosić o niego i nie wypisywać go.

Stan: aplikacja zna 5 promów. Wawel (311852000) i Nova Star (311000787) — Polferries Gdańsk–Nynäshamn. Stena Spirit, Stena Estelle, Stena Ebba — Stena Line Gdynia–Karlskrona. Lista jest kompletna. Stena Vision zeszła z trasy w 2023, listy nie rozszerzać. Jedyne źródło dziś: Digitraffic (Finlandia). Na południowym Bałtyku jest ślepe.

1. AIS-SRC. Dodać aisstream.io do funkcji pobierającej pozycje promów. Filtr wyłącznie na MMSI pięciu promów. MMSI Sten ustalić z danych aisstream, nie zgadywać. Digitraffic zostaje zapasem. Przy dwóch pozycjach tego samego statku nowsza wygrywa. Zapis źródła przy każdej pozycji. Najpierw diagnoza: (a) dla każdego promu data ostatniej pozycji w bazie wobec ostatniej w źródle — czy obecne odświeżanie w ogóle działa; (b) czy aisstream widzi wszystkie 5 promów, w portach Gdańsk, Gdynia, Nynäshamn, Karlskrona i na morzu. Jeśli któregoś nie widzi — zgłosić i zaproponować inne darmowe źródło, nie zgadywać.
2. Q-18. Słowa właściciela 04.10: „Na mapach mają być pokazane tylko te statki, które w danym momencie płyną do Szwecji.” Prom widoczny od wyjścia ze strefy portu w Polsce (Gdańsk, Gdynia) do wejścia w strefę portu w Szwecji (Nynäshamn, Karlskrona). Niewidoczny: postój w porcie i rejs do Polski. Kierunek z wyjścia ze strefy portu. Pole „destination” z AIS tylko jako potwierdzenie. Dotyczy wszystkich map: Mapa, kokpit, szczegóły transportu.
3. Śledzenie w tle bez zmian. Baza zapisuje pozycje wszystkich 5 promów w obie strony. Filtr z punktu 2 to wyłącznie warstwa wyświetlania. ETA (D-85), opóźnienie wypłynięcia (II-9) i alternatywy rejsu (L-9) korzystają z pełnych danych.
4. Odświeżanie bez przestojów. Pozycja promu na mapie nie starsza niż 5 minut. Starsza niż 15 minut — znacznik wyszarzony z godziną ostatniej pozycji. Brak danych o promie ponad 1 h — ryzyko w Stanie systemu.
5. Testy: prom wychodzi z Gdańska → pojawia się, wchodzi do Nynäshamn → znika; prom w drodze do Polski → niewidoczny na mapie, pozycja zapisana w bazie; dwie pozycje z dwóch źródeł → zapisana nowsza, ze źródłem; awaria aisstream → pozycje z Digitraffic, bez błędu aplikacji; pozycja starsza niż 15 min → znacznik wyszarzony; ETA transportu na promie liczy się także, gdy prom jest niewidoczny; gitleaks 0 w śledzonych plikach.
6. Kolejka: STD-CLEAN (zrobione) → SMS-KSH-1H + ETA-PRE-LOAD → AIS-SRC (punkty 1, 3 i 4) → VERIFY-13 → PALIWO-33.3 (najpóźniej 23.10.2026) → część B zaczyna od B-MAPA razem z Q-18. Q-18 nie wchodzi do budowy AIS-SRC. Bez budowy teraz.

## Polecenie 2026-10-05 (czas warszawski) — PL-PLURAL

Tylko dokument. Bez budowy. Nie przerywa SMS-KSH-1H + ETA-PRE-LOAD. To pozycja planu, nie decyzja właściciela.

Część B, priorytet P3, ID PL-PLURAL, za B-MAPA i za kolejką nocną.

Komunikat importu „Pominięto 2 wierszy” ma brzmieć „2 wiersze”. Sprawdzić odmianę przez liczby we wszystkich komunikatach PL (1 / 2–4 / 5+, także 22–24 = wiersze, 12–14 = wierszy). Jedna funkcja odmiany. Test na wartościach 1, 2, 5, 12, 22, 25. Źródło błędu: `tests/b8-imp.test.ts` i `standardSkipMessage`.

## Polecenie 2026-10-05 (czas warszawski) — SMS-KSH-1H + ETA-PRE-LOAD, wykonanie

Osobny PR kodu, po zapisie dokumentów. Nie robić VERIFY-13, PALIWO-33.3, AIS-SRC, B-MAPA, Q-18 ani części B. Nie włączać H-1 ani H-3. Nie kasować transportów. Nie wołać Resend. Nie wysyłać prawdziwego SMS.

D-37 i D-64: koło 50 km nie spełnia decyzji. Jeden SMS, gdy czas jazdy z bieżącego GPS do placu wynosi ≤ 60 min, dla Śremu i dla Boden. HERE, gdy flaga jest włączona i budżet nie jest wyczerpany; inaczej własny silnik (0122). Ta paczka flagi nie włącza i sieci nie woła. Jeden SMS na transport i koniec trasy. Pierwsza pozycja poniżej 60 min — SMS od razu. Brak GPS — brak SMS. Wjazd na plac bez zmian. Treść: kto, rejestracja, przewidywana godzina przyjazdu.

ETA-PRE-LOAD: przed opuszczeniem strefy placu w Śremie pole ETA to tylko „–”, bez tekstu (harmonogram, szczegóły, kokpit, eksport). Po wyjeździe ETA pojawia się z pozycji, nie z planu. SMS do Śremu liczy się w tle także przed załadunkiem.

Testy w bazie, bez telefonu właściciela. Brama lokalna zielona na tym samym commicie przed scaleniem i produkcją.

## Polecenie 2026-10-05 (czas warszawski) — AIS-SRC, trzecie źródło Sten

Dopisek do decyzji AIS-SRC. Bez budowy. Nie przerywa SMS-KSH-1H + ETA-PRE-LOAD.

Trzecie źródło dla Sten, znalezione 04.10.2026 23:12 UTC: GET https://irm.stenalinefreight.com/ferries?imos=7907661,9862994,9863003 (Stena Spirit, Stena Estelle, Stena Ebba). Bez klucza. Wtedy pozycje wszystkich trzech sprzed 1–10 min, źródło TER.

1. Współrzędne wyłącznie z properties.latitude i properties.longitude. geometry.coordinates ma zamienioną kolejność (lat, lon) — nie używać.
2. Czas pozycji: properties.dt_pos_utc (UTC).
3. Odpytywanie co 3 min, jedno zapytanie na 3 statki. Nagłówek User-Agent z nazwą Watch Tower. Cache. Przy błędzie odczekać, bez ponawiania w pętli.
4. Priorytet dla Sten: 1) Stena, 2) aisstream, 3) Digitraffic. Nowsza pozycja wygrywa. Źródło zapisane przy każdej pozycji.
5. Pole properties.eta (ETA statku do portu) zapisywać. Dodatkowe wejście do ETA promu (D-85), obok rozkładu i statusu.
6. Adres nieopisany: zmiana formatu albo błąd → ryzyko w Stanie systemu, automatyczne przejście na aisstream i Digitraffic, bez błędu aplikacji.
7. Polferries (Wawel, Nova Star): aisstream i Digitraffic jak dotąd.
8. Test, nie teraz: 3 Steny mają pozycje nie starsze niż 5 min przez 24 h pomiaru. Symulacja błędu adresu Steny → przejście na zapas.

## Polecenie 2026-10-05 (czas warszawski) — FERRY-STATUS

Dopisek przy D-45. Bez budowy. Nie przerywa SMS-KSH-1H + ETA-PRE-LOAD. Krok 0 wykona następny krok kolejki, nie to polecenie.

Decyzja właściciela 04.10 przy D-45: zezwolenia na transport ponadnormatywny obejmują dwie trasy (Gdańsk–Nynäshamn i Gdynia–Karlskrona). Przesiadka na drugą przeprawę nie wymaga nowego zezwolenia.

Jedna pozycja planu: FERRY-STATUS.

Krok 0 (najpierw, raport bez budowania): a) pogoda morska II-8 dla Stena (Gdynia, środek, Karlskrona) i Gdańsk–Nynäshamn, ostatni odczyt ze źródłem FMI/DMI/SMHI; b) alarmy fala 3,8 m i porywy 40 kn (D-39) — jeśli wyłączone od 02.10 „do II-3”, włączyć w kroku 3 (progi potwierdzone 29.09); c) korytarz 0122, HERE H-1/H-3 i Trafikverket czy obejmują E22 aż do E4, panel Warunki drogowe SE obie trasy; d) L-9 FERRY_CANCELLED czy ETA liczy całą nową trasę; e) skąd II-5 bierze status Steny i co zwraca.

Krok 1: rozkład Steny żywo. Strona https://stenalinefreight.com/timetable/GDKA, POST https://stenalinefreight.com/wp/wp-admin/admin-ajax.php action=timetable, data[from], data[to], data[routeCode]=GDKA, security = świeży token z ajax_object na tej stronie przed każdym odczytem. Planowy i rzeczywisty odjazd/przyjazd, statek, status. Porównać z II-5: lepsze główne, drugie zapas. Co 10 min, dziś+6 dni, oba kierunki. User-Agent Watch Tower, cache, przy błędzie odczekać bez pętli. Rzeczywiste godziny → D-85 i II-9. Odwołanie → FERRY_CANCELLED. Błąd formatu → ryzyko w Stanie systemu i zapas.

Krok 2: nie obchodzić 403 polferries.pl ani 503 polsca.com. Warstwy: opóźnienie z AIS (II-9), pogoda II-8 jako ostrzeżenie, formularz „Komunikat armatora” (admin i dyspozytor przewoźnika: armator, rejs, typ odwołany/opóźniony/zmiana godziny, nowa godzina, treść) ze skutkami jak status automatyczny i historią kto/kiedy. W raporcie: czy POLSCA ma e-mail dla frachtu albo inne oficjalne źródło.

Krok 3: uzupełnienia z kroku 0 — pogoda w trzech punktach każdej trasy, alarmy D-39 włączone, Karlskrona–Boden E22→E4 w korytarzu, ETA, H-1/H-3 i Trafikverket, panel obie trasy, alternatywa L-9 liczy całą trasę (dojazd, rejs, droga SE, czas pracy D-85), bez ostrzeżenia o zezwoleniu przy przesiadce.

Testy: odwołany rejs Steny; komunikat ręczny POLSCA; błąd źródła; fala >3,8 m; ETA alternatywy różni się o dojazd, rejs i drogę SE; panel pokazuje E22 i E4.

Kolejka: STD-CLEAN zrobione → SMS-KSH-1H + ETA-PRE-LOAD → AIS-SRC → FERRY-STATUS → VERIFY-13 → PALIWO-33.3 (do 23.10) → część B od B-MAPA z Q-18. FERRY-STATUS nie budować w tym zapisie dokumentów. Zbudowane następnym krokiem (migracja 0160).

## Polecenie 2026-10-05 (czas warszawski) — PL-DATA

Dopisek decyzji. Bez budowy. Nie przerywa AIS-SRC.

Zasada: tylko język polski tam, gdzie widzi użytkownik (panele, ryzyka, powiadomienia, e-maile, SMS, PDF), także dane z Trafikverket, HERE, Steny, AIS i pogody.

1. HERE: język pl-PL tam, gdzie API przyjmuje. Brak tłumaczenia idzie do punktu 3.
2. Trafikverket: opis po polsku z pól kodowych, nie ze szwedzkiego tekstu. Pełny słownik kod→polski w repozytorium. Test: każdy kod z API ma tłumaczenie. Nieznany kod → ryzyko w Stanie systemu, w panelu „zdarzenie drogowe” po polsku, nigdy surowy szwedzki.
3. DeepL od razu, bez czekania na pomiar znaków. Klucz DEEPL_API_KEY zapisuje osobny agent (sekrety Edge i .env.local). Nie prosić właściciela. Wartości nie wypisywać. Nazwa DEEPL_API_KEY jest w sekretach Edge produkcji i w .env.local (sprawdzone 05.10.2026; wartości nie wypisywać). Test właściciela 04.10: działa, zużycie 38 / 1 000 000 znaków. Punkt 3 idzie razem z resztą PL-DATA, bez odkładania. Tekst wolny z Trafikverket i HERE, którego nie da się złożyć po polsku z kodów: najpierw słownik zwrotów, potem pamięć tłumaczeń, potem DeepL API Free (SV/EN → PL). Każde tłumaczenie z DeepL trafia do pamięci. Ten sam tekst nigdy drugi raz. Zużycie w Stanie systemu, ostrzeżenie przy 80% limitu miesięcznego. Przy 100% albo błędzie: opis z kodów, tekst w kolejce, bez szwedzkiego w głównej treści. Oryginał tylko pod „Pokaż oryginał”. Do DeepL wyłącznie publiczne komunikaty drogowe, nigdy dane transportów, kierowców ani firm.
4. Stena i AIS: Arrived → Przypłynął, Departed → Wypłynął, odwołanie → Odwołany. Porty: PLGDY Gdynia, SEKAA Karlskrona, PLGDN Gdańsk, SENYN Nynäshamn. Nazwy statków bez zmian.
5. Pogoda FMI/DMI/SMHI: opisy i jednostki po polsku (m, węzły, m/s, °C), kierunki wiatru po polsku.
6. Przegląd UI i szablonów: lista miejsc bez tłumaczenia w raporcie, poprawki w tym samym PR.

Testy: roboty drogowe po polsku bez szwedzkich słów; nieznany kod; HERE pl-PL; Departed → Wypłynął; e-mail i SMS ryzyka drogowego tylko po polsku; szwedzki → polski w panelu; drugi raz z pamięci (0 zapytań DeepL); błąd DeepL → opis z kodów, bez błędu aplikacji.

Kolejka: zaraz po FERRY-STATUS, przed VERIFY-13. STD-CLEAN zrobione → SMS-KSH-1H + ETA-PRE-LOAD → AIS-SRC → FERRY-STATUS → PL-DATA → VERIFY-13 → PALIWO-33.3 (do 23.10) → część B od B-MAPA z Q-18. PL-DATA nie budować w tym zadaniu.

## Polecenie 2026-10-05 (czas warszawski) — PL-DATA, klucz DeepL jest

Dopisek do punktu 3. Bez budowy. Nie przerywa AIS-SRC.

Nazwa DEEPL_API_KEY jest już w sekretach Edge produkcji i w .env.local. Wartości nie wypisywać. Test właściciela 04.10: działa, zużycie 38 / 1 000 000 znaków. Punkt 3 realizuje się razem z resztą PL-DATA, bez odkładania. Budowa PL-DATA czeka, aż skończy się AIS-SRC.

## Polecenie 2026-10-05 07:16 (czas warszawski) — KOREKTA Q-18, AIS DLA POLFERRIES I DALSZA CZĘŚĆ B

Zgoda właściciela na wszystkie kroki poniżej bez pytania: scalenia, migracje przez bramę, wdrożenia. Obie domeny 200 po każdym wdrożeniu.

KOREKTA Q-18, AIS DLA POLFERRIES I DALSZA CZĘŚĆ B (właściciel 05.10)
1. Q-18 — POPRAWIONA REGUŁA WIDOCZNOŚCI PROMÓW (zastępuje poprzednią): prom WIDOCZNY w strefie portu w Polsce (Gdańsk, Gdynia), w rejsie z Polski do Szwecji oraz w strefie portu w Szwecji (Nynäshamn, Karlskrona). Prom ZNIKA, gdy wypływa ze Szwecji do Polski (wyjście ze strefy portu w Szwecji); pojawia się ponownie po wejściu w strefę portu w Polsce. Wszystkie mapy; pozycje w bazie bez zmian, w obie strony. Test: prom w Gdańsku → widoczny; wypływa → widoczny; w Nynäshamn → widoczny; wypływa z Nynäshamn do Polski → znika; wchodzi w strefę portu w Gdańsku → pojawia się.
2. AIS-SRC — DOKOŃCZENIE DLA POLFERRIES: Wawel i Nova Star nadal na starym sygnale z Digitraffic. W teście klucza (04.10 22:54–23:04 UTC) aisstream widział oba: Nova Star 54.40469 N 18.67377 E (Gdańsk), Wawel 58.90557 N 17.95721 E (Nynäshamn). Diagnoza: dlaczego funkcja nie zapisuje pozycji z aisstream (połączenie, subskrypcja MMSI 311852000 i 311000787, zapis, czas działania funkcji przy WebSocket). Napraw i potwierdź: obie jednostki mają w bazie pozycję z aisstream nie starszą niż 5 minut. Jeśli funkcja Edge nie utrzyma WebSocket — krótki nasłuch co minutę albo inne rozwiązanie bez wydatków; opisz w raporcie.
3. DIAGNOZA PUSTEJ MAPY: dla każdego z 5 promów: ostatnia pozycja w bazie (czas UTC, źródło), strefa, w której jest, i czy według reguły z punktu 1 powinien być widoczny. Po punktach 1–2 mapa musi pokazywać każdy prom zgodnie z regułą.
4. CZĘŚĆ B — KONTYNUACJA (po punktach 1–3): kontynuuj część B w kolejności z PLAN.md, bez zmian kolejności. B-7a i B-7b NIE czekają na decyzję: B-7a: mapa ma stały rozmiar, niezależny od wysokości tabeli obok; po otwarciu widoku MAPA widoczna w całości. B-7b: checkboxy warstw zawsze widoczne; na telefonie nie nachodzą na inne elementy. Czekają na właściciela (tylko propozycja na piśmie): B-7c, filtry i statusy z B-8, B-9, Q-9. Czeka na wymiary: B-3a.

## Polecenie 2026-10-05 07:57 (czas warszawski) — D, potem B; odśwież wzorce map

D, potem B. Najpierw odśwież wzorce 90 ujęć map — zmiana zamierzona (podkład HERE z B-MAPA, stały rozmiar mapy B-7a, warstwy na telefonie B-7b), z opisem przyczyny w commicie. Inaczej brama wizualna będzie czerwona przy każdej kolejnej pozycji. Potem część B od B-1 według PLAN.md, bez zmian kolejności.

## Polecenie 2026-10-05 ~08:35 (czas warszawski) — część B od B-5

Kontynuacja części B od B-5 według PLAN.md (po B-4b). B-3a nadal stop — czeka na wymiary (D-83). B-5: przycisku nowej automatyzacji ma nie być (tylko historia); jeśli już ukryty — potwierdzić testem. Potem B-6a…B-6i w kolejności PLAN.md. Pomijane (tylko propozycja na piśmie): B-7c, filtry i statusy z B-8, B-9, Q-9. B-7a i B-7b już zrobione. Wzorce wizualne odświeżać tylko dla ujęć zmienionych przez B-6, z przyczyną w commicie.

## Polecenie 2026-10-05 ~09:10 (czas warszawski) — kontynuacja części B (B-8…)

Kontynuacja części B. B-7c skip (propozycja na piśmie). B-8 bez filtrów i statusów (te czekają na właściciela — `PROPOZYCJE_B_05_10.md`). B-9 skip (propozycja). Potem B-10… według PLAN.md. Skip Q-9. B-3a nadal stop — wymiary D-83. B-5 i B-6a…B-6i na prod (PR #74, migracja 0164, dpl_GDQUstA58xFQ1gKxTeKmshnKHeBk). B-7a/B-7b zrobione.

B-8 do zrobienia (zlecenie §8, bez filtrów/statusów i bez zmiany ciągnika bez specyfikacji): mapowanie pól (KSH poza tabelą; HHL/SCX etykiety), godziny przy załadunku/dostawie, linie pionowe, szerokość kolumn, ETA (dni+godz+min / godz+min), polisa w dokumentach, rok w datach, kierowca/telefon (format), PDF (kierowca+telefon zamiast promu). Filtr dat — jeśli część filtrów z propozycji, zostawić. Zmiana ciągnika — STOP podpozycji bez specyfikacji.

## Polecenie 2026-10-05 ~09:15 (czas warszawski) — DECYZJE WŁAŚCICIELA 05.10 (ostateczne): B-5 przycisk i kreator, ceny paliw krok A/B, korekta SEFS

Zatrzymuje bieżącą pracę nad B-8/B-10 (WIP odłożony na lokalnej gałęzi `feat/b8-harmonogram`, niescalony). Odwraca wcześniejsze „B-5: przycisku ma nie być” (polecenie ~08:35).

1. B-5 — PRZYCISK „NOWA AUTOMATYZACJA” I KREATOR REGUŁ
Przycisku nie ma — ma być. Razem z pełną możliwością tworzenia nowych reguł w aplikacji (dziś kreator działa tylko przez API, 9.4).
- przycisk „Nowa automatyzacja” w widoku Automatyzacje, tylko HHL_ADMIN
- kreator w oknie: nazwa, wyzwalacz (zdarzenie / status / ryzyko / termin), warunki, akcje (powiadomienie, decyzja, e-mail, SMS według zasad stref), włącz/wyłącz, edycja i usuwanie reguły
- reguła zapisuje się w tym samym silniku co dziś (0094), bez drugiego mechanizmu; zero podwójnych alarmów (ONE-MECH)
- historia zmian reguły: kto, kiedy, co
- test: nowa reguła z kreatora wykonuje się na zdarzeniu testowym; wyłączona — nie wykonuje się; duplikat istniejącego alarmu — ostrzeżenie przed zapisem

2. CENY PALIW — PEŁNY AUTOMAT ZGODNY Z MECHANIZMEM OPŁATY PALIWOWEJ (U-14, D-34, I-31, SEFS)
KROK A — PRÓBKA DO AKCEPTACJI (najpierw, bez zapisu do bazy produkcyjnej). Dla OKQ8 i Orlen osobno pokaż właścicielowi:
- dokładny adres strony / narzędzia, z którego pobierasz
- nazwę produktu dokładnie tak, jak jest na stronie (rodzaj paliwa)
- pobraną wartość, jednostkę i walutę (np. SEK/l, PLN/m³), netto czy brutto
- datę i godzinę obowiązywania ceny według źródła
- odczyty z ostatnich 7 dni, jeśli źródło je udostępnia
- obok: co w tej samej chwili pokazuje strona w przeglądarce (zrzut albo cytat), żeby właściciel mógł porównać
Jeśli w regulaminie którejś strony jest KONKRETNY zakaz pobierania — zacytuj zapis i nie pobieraj z tej strony. Właściciel potwierdza rodzaj paliwa i miejsce pobierania na piśmie. Do czasu akceptacji — punkt 1, potem część B według PLAN.md.
KROK B — AUTOMAT (dopiero po pisemnej akceptacji kroku A)
- pobieranie codziennie z zaakceptowanych miejsc; User-Agent z nazwą Watch Tower, źródło i czas przy każdym odczycie
- dalej bez udziału człowieka, według mechanizmu SEFS: średnia PL i SE z poprzedniego tygodnia → indeksy → mnożnik (zasada „niższy”, I-31) → opłata dla transportów według tygodnia daty załadunku (D-34, 0155), czas Europe/Warsaw (33.3)
- formularz ręczny HHL (I-2f) tylko awaryjnie: brak odczytu w danym dniu → ryzyko w Stanie systemu i e-mail do administratora
- test: tydzień z pełnymi odczytami → mnożnik zgodny z ręcznym wyliczeniem (wzorzec: 28.09–04.10 = 1,14); brak odczytu jednego dnia → ryzyko, średnia z dostępnych dni zgodnie z mechanizmem
- cel: odczyty na produkcji przed R-3

3. KOREKTA CENY OD DOSTAWCY (zgoda właściciela)
Korekta wchodzi do średniej SEFS, dopóki tydzień nie jest zamknięty. Po zamknięciu tygodnia wartość zamrożona (migawka, 32.3) — późniejsza korekta nie zmienia policzonych transportów ani faktur; zapis korekty w historii.

KOLEJNOŚĆ I ZASADY
Najpierw punkt 1 i krok 2A (próbka do właściciela). Potem część B dalej według PLAN.md. Krok 2B po akceptacji próbki, przed R-3. Migracje przez lokalną bramę, obie domeny 200 po każdym wdrożeniu. Zapisz decyzje w rejestrze decyzji, w PLAN.md i w POLECENIA_KOORDYNATORA.md.

Kolejność wykonania: (1) B-5 kreator → (2) krok 2A próbka paliw do właściciela → (3) korekta SEFS w średniej → część B dalej według PLAN.md (od B-8 bez filtrów/statusów). Krok 2B nie budować do pisemnej akceptacji próbki.

## Polecenie 2026-10-05 ~10:37 (czas warszawski) — ODPOWIEDZI WŁAŚCICIELA 05.10

ODPOWIEDZI WŁAŚCICIELA 05.10

---------------------------------------------------------------
1. PALIWA — krok A zaakceptowany z poprawką, buduj krok B
---------------------------------------------------------------
- ORLEN: zaakceptowany — ONEkodiesel / Olej Napędowy Ekodiesel,
  PLN/m³ netto, ze strony hurtowe ceny paliw. Klauzula regulaminu
  nie blokuje (decyzja właściciela).
- OKQ8: BŁĄD w próbce. Cena z sekcji „Q8 Trucks", produkt „Diesel".
  Wzorzec od właściciela: 05.10 = 22,90. Wartość wprost ze strony,
  bez przeliczania VAT (U-14).
  Przed włączeniem automatu potwierdź w raporcie: odczyt z Q8 Trucks /
  Diesel = 22,90 (05.10).
- Krok B bez zmian: pobieranie codziennie, mechanizm SEFS (średnia PL
  i SE z poprzedniego tygodnia → indeksy → mnożnik „niższy", I-31),
  tydzień według daty załadunku (D-34), czas Europe/Warsaw (33.3),
  korekta do zamknięcia tygodnia, potem migawka (0166). Formularz
  ręczny HHL tylko awaryjnie: brak odczytu → ryzyko w Stanie systemu
  i e-mail do administratora.

---------------------------------------------------------------
2. BRAMKA SMS — FAŁSZYWE ALARMY (przed dalszą częścią B)
---------------------------------------------------------------
Właściciel: telefon bramki jest włączony, a bramka działała cały czas.
8 alarmów SMS_GATEWAY_SILENT w nocy to więc fałszywe alarmy albo
heartbeat nie dociera do bazy.
- diagnoza: ostatnie heartbeaty bramki z bazy (czas, wynik) w nocy
  4/5.10; próg ciszy, który wywołał alarm; czy aplikacja wysyła
  heartbeat, a baza go odrzuca lub nie zapisuje (token, uprawnienia,
  funkcja sms_heartbeat, zmiany z ostatnich migracji)
- napraw przyczynę; test: heartbeat co ustalony interwał → zero alarmów;
  brak heartbeatu dłużej niż próg → jeden alarm, bez powtórek co cykl
- błąd zapisu statusu powiadomienia: Resend zwraca 200, a status
  w bazie „błąd" — napraw, test na e-mailu testowym
- nie wysyłaj prawdziwego SMS bez zgody właściciela; test bramki tylko
  przez heartbeat i tryb testowy

---------------------------------------------------------------
3. PORZĄDKI
---------------------------------------------------------------
- migracja 0159: dopisz do ewidencji migracji na produkcji (bez
  ponownego wykonania); sprawdź, że lista PROD = repozytorium
- smoke wizualny: napraw ładowanie barlow.css, potem odśwież wzorce
  Automatyzacji (zmiana zamierzona: B-5, przycisk i kreator)

---------------------------------------------------------------
4. PROPOZYCJE CZĘŚCI B — wybór właściciela
---------------------------------------------------------------
- B-7c: A (nowe filtry: brak GPS, ryzyko)
- B-8: wszystkie trzy (zakres dat, filtr bez kierowcy/ciągnika,
  „Zmień ciągnik")
- B-9: C (aktywny filtr z „×" + kafelek Prom)
- Q-9: B (motyw według ustawień systemu + zmiana w ustawieniach
  użytkownika)
Buduj w kolejności z PLAN.md.

---------------------------------------------------------------
KOLEJNOŚĆ I ZASADY
---------------------------------------------------------------
Punkty 2 i 3 najpierw. Potem krok B paliw (punkt 1) i część B
według PLAN.md, z wyborami z punktu 4.
Migracje przez lokalną bramę, obie domeny 200 po każdym wdrożeniu.
Bez kasowania danych, bez wydatków.
Zapisz decyzje w rejestrze decyzji, w PLAN.md i w POLECENIA_KOORDYNATORA.md.

Kolejność wykonania: (2) SMS fałszywe + (3) porządki → (1) paliwa krok B → (4) część B według PLAN z wyborami (B-7c A, B-8 zakres dat + bez kierowcy/ciągnika + Zmień ciągnik, B-9 C, Q-9 B). B-3a nadal stop na D-83.

## Polecenie 2026-10-05 ~11:43 (czas warszawski) — STATUS PLANU I DALSZA PRACA

STATUS PLANU I DALSZA PRACA (koordynator 05.10)

1. RAPORT STANU — tabela dla KAŻDEJ pozycji części B, C i pozostałych
   pozycji przed pilotażem z PLAN.md: ID | status | dowód (PR, migracja,
   test) | na co czeka. Szczególnie: B-1, B-10, B-KSH, B-REJSY, C-SEP,
   HHL-4a, FAK-9, UI-12, D-31, D-27, Q-11a, Q-11b, Q-17, B-Q.
   Pozycja bez dowodu = „do zrobienia".

2. DALEJ BEZ CZEKANIA — według kolejności PLAN.md:
   - wszystkie pozycje z punktu 1 „do zrobienia", które nie czekają
     na właściciela ani dane zewnętrzne
   - następnie pozycje po części B z PLAN.md: H-2-PL, H-7, H-8, H-10,
     H-12, CLEAN-MAPLIBRE, AUTH-MAIL, I-29, GATE-WEEKLY
   - SEC-OWASP (ASVS poziom 2) jako ostatnia przed pilotażem
   Nie stajesz, dopóki w PLAN.md jest pozycja, która nie czeka
   na właściciela.

3. CZEKA NA WŁAŚCICIELA (tylko lista w raporcie, bez budowy):
   D-83 (wymiary → B-3a, H-1, H-3, H-6), plan czyszczenia R-0
   do akceptacji, sprawy D-3, D-7, D-14, D-16, D-17, D-21.
   Czeka na dane zewnętrzne: TELM-2 (emtrack), II-10-E1 (IT KSH).

Migracje przez lokalną bramę, obie domeny 200. Bez kasowania danych,
bez wydatków, bez prawdziwych SMS bez zgody.

## Polecenie 2026-10-05 ~12:11 (czas warszawski) — D-78 pule HERE + przebudowa H-3

STOP bieżącej kolejności PLAN. Natychmiast priorytet właściciela 05.10 ~12:11:

1) D-78 HERE: koszt = max(0, queries−free_pool)×rate ponad pulę; budżet 100 USD i 50/80/100% TYLKO od kosztu ponad pule. Kafelki→zapas przy 80%, reszta stop przy 100%. Pule/stawki w tabeli parametrów (usuń TILE_USD, HERE_TRUCK_TX_USD, HERE_ATTRIBUTES_TX_USD z kodu). Przyjmij niższe do potwierdzenia: tiles 30000/mies, routes 5000/mies. Jedna stawka trasy z tabeli. Miesiąc Europe/Warsaw, reset 1. dnia. Przelicz here_usage październik. Stan systemu: per usługa zużycie/pula/koszt ponad/%; suma miesiąca.

2) H-3: usuń Map Attributes; Routing v8 truck+wymiary D-83, alternatives, notices/violations; przepis≠przeszkoda jak H-1. Liczone w puli tras. ZOSTAJE WYŁĄCZONE do D-83. Sprawdź H-6 — ta sama przebudowa jeśli Attributes. Raport: szacunek zapytań tras/transport i /miesiąc dla 94.

Testy jak w poleceniu. Migracja przez bramę, obie domeny 200. Dopisz polecenie do POLECENIA, PLAN, rejestr decyzji.

Dopiero PO tym wróć do raportu stanu + budowy pozycji bez czekania.

## Polecenie 2026-10-05 ~12:27 (czas warszawski) — uzupełnienie raportu D-78/H-3 + H-2-PL

D-78/H-3 przyjęte, ale BRAKUJE w raporcie:

1) Zgodność z HERE: skąd różnica tras (HERE 26 vs system 4) i źródło 7 zapytań geokodowania. Czy po poprawce KAŻDE wywołanie HERE trafia do licznika? Czy „Advanced Raster Tile" ma pulę 30 000 w cenniku konta HERE?
2) H-6: czy warstwa przeszkód używała Map Attributes — jeśli tak, czy przebudowana.
3) H-2-PL (sytuacje drogowe PL): stan — GDDKiA, HERE Traffic, pula Traffic i koszt. Jeśli niezaczęte — WYKONAJ TERAZ według PLAN (punkt 3 poprzedniego: H-2-PL…).

Dopisz polecenie do POLECENIA. Odpowiedź w docs + krótki raport. Potem kontynuuj STATUS/budowę.

## Polecenie 2026-10-05 ~12:44 (czas warszawski) — TELM-EMTRACK-WEB (zapas do oficjalnego API)

STOP bieżącej kolejności PLAN. Priorytet właściciela — warstwa zapasowa emtrack (web), zanim dalszy PLAN.

Sekrety: `EMTRACK_LOGIN`, `EMTRACK_PASSWORD` (nigdy w kodzie / logach / raportach).
Fakty: emtrack.eu/app v6.32.0 AngularJS; `wss://emtrack.eu:443/ws/`; `X-Mtrack-SessionId`; REST `webclient-rest`; reCAPTCHA tylko reset hasła; pozycja **naczepy**.

1) **RAPORT PRZED BUDOWĄ** z publicznego kodu klienta: komunikaty login + lista obiektów z pozycjami. Zaloguj raz, **TYLKO ODCZYT**: lista (nazwa, rejestracja, typ), ostatnia pozycja, czas, częstotliwość. Porównaj z emtrack.eu/app w tej samej chwili.
2) Zasady: tylko odczyt; jedna sesja; PR5 2 min ruch / 15 min postój; backoff; UA przeglądarki; captcha = stop + alarm; meta version change → ryzyko + e-mail, stop przy niezgodnym formacie.
3) Warstwy D-36: API → TELM-EMTRACK-WEB → linki podwykonawców; źródło przy pozycji; awaria → następne.
4) Dopasowanie naczepa→transport jak TELM-2 (awizacja, strefy, przepięcie, prom=AIS, próg postoju).
5) Testy jak w poleceniu; zero zapisu w emtrack; log wysłanych komunikatów.

Kolejność: **PRZED** dalszym PLAN. Dopisz POLECENIA / PLAN / rejestr D-36. Bramy, obie domeny 200, H1/H3/H6 false, 94, bez wydatków/SMS.

## Polecenie 2026-10-05 ~12:49 (czas warszawski) — D-78 pule potwierdzone

Priorytet właściciela 05.10 — potwierdzone pule HERE:
- `HERE_TILES_FREE=30000` Advanced Raster Tile
- `HERE_ROUTES_FREE=5000` Routing Truck
Źródło obu: „konto HERE właściciela, 05.10". Bez „wstępna".
**NIE** edytuj 0170. Nowa migracja (0172) ustawia oba wiersze (wartość, opis, źródło) — prod = repo.
Sprawdź seed/inne migracje czy nie nadpisują. Brama, obie domeny 200. Dopisz POLECENIA / PLAN / rejestr.
Potem dalej TELM-EMTRACK-WEB (rozpoznanie → budowa jak poprzednie polecenie).

---

## Polecenie — TELM build dopisek (05.10 ~12:55)

### Dopisek 05.10 ~12:55 — build + 0174
- Fix pre-push: `runEmtrackWeb` version-risk → `sourceDownRisk` / `rk_source_down` (nie `rk_generic`).
- Migracja **0174**: cron `tower-emtrack-web` `*/2 * * * *` (prod=OK). Flaga `TELM_EMTRACK_WEB` nadal **false**.
- H1/H3/H6 false. Pule HERE 0172 bez zmian.

---

## Polecenie 2026-10-05 ~13:12 (czas warszawski) — TELM-EMTRACK-WEB WŁĄCZENIE I TEST NA ŻYWO

SYTUACJA: właściciel przypisał naczepę GD035YX do transportu w harmonogramie,
razem z linkiem śledzenia od przewoźnika. Naczepa jest już w Szwecji i jedzie
na rozładunek. Transport załadował się, zanim system zaczął śledzić naczepę.

### 0. BLOKADA BEZPIECZEŃSTWA (najpierw, przed włączeniem flagi)
To test na produkcji przed pilotażem (R-0 wyczyści transporty przed R-1).
Dla TEGO transportu i do odwołania przez właściciela:
- SMS (w tym SMS-KSH-1H) i e-maile WYŁĄCZNIE na numer i adres właściciela;
  zero wysyłek do KSH, przewoźnika ani innych odbiorców
- powiadomienia w aplikacji — normalnie
Potwierdź w raporcie, że blokada działa (test na sucho), zanim włączysz flagę.

### 1. ALARMY BEZ DOPASOWANIA
Naczepa bez aktywnej awizacji → pozycje zapisane, ZERO alarmów
„brak dopasowania" i zero powiadomień. Alarm tylko dla naczepy
przypisanej do aktywnego transportu. Jeśli trzeba — popraw, test, wdrożenie.

### 2. WŁĄCZENIE
TELM_EMTRACK_WEB=true na produkcji, po punktach 0 i 1.

### 3. TRANSPORT JUŻ W TRASIE — ROZPOZNANIE FAZY
Transport podłączony w trakcie jazdy nie ma zarejestrowanego wyjazdu
ze strefy załadunku. Faza ma wynikać z pozycji naczepy:
- pozycja w Szwecji albo na morzu → załadunek i przeprawa już były:
  status zgodny z fazą, ETA dostawy LICZONE (nie „–" z ETA-PRE-LOAD),
  wpis w historii „faza ustalona z pozycji naczepy przy podłączeniu"
- ta sama zasada dla każdego przyszłego transportu podłączonego w trasie

### 4. TEST NA ŻYWO — DO RAPORTU
Dla transportu z GD035YX:
- dopasowanie naczepa → transport: działa, źródło pozycji zapisane
- link śledzenia od przewoźnika (warstwa 3, linki podwykonawców):
  czy da się z niego odczytać pozycję; porównanie z emtrack (aplikacja)
- ETA do miejsca rozładunku: wartość, składniki (HERE SE, D-85),
  aktualizacja wraz z pozycją
- SMS-KSH-1H przy ETA ≤ 60 min do rozładunku — tylko na numer właściciela
- wjazd w strefę rozładunku → status; wyjazd ze strefy → UNLOADED
  (data realizacji: faktura, kurs NBP, opłata paliwowa — zapis widoczny)
- mapa: naczepa na podkładzie HERE, ślad z punktów GPS
- przerwy w odczytach, ponowne logowania, błędy

### 5. MONITORING 72 h
Liczba odczytów, przerwy, ponowne logowania, błędy, zgodność pozycji
z aplikacją emtrack (próbka 3× dziennie). Każdy problem z logowaniem
albo formatem → stop źródła, alarm w Stanie systemu, e-mail do
administratora. Raport: po rozładunku tego transportu, po 24 h i po 72 h.

### 6. DOPISEK WŁAŚCICIELA (~13:14)
Po włączeniu flagi TELM_EMTRACK_WEB podaj właścicielowi bezpośredni link
do szczegółów tego transportu (GD035YX) i potwierdź, że naczepa jest
widoczna na mapie (widok Mapa i szczegóły transportu) z czasem ostatniej pozycji.

Migracje przez bramę, obie domeny 200. Zapisz decyzje w rejestrze
decyzji i w POLECENIA_KOORDYNATORA.md. Potem wróć do pozostałych
pozycji PLAN.md.

## Polecenie 2026-10-05 ~13:37 (czas warszawski) — propozycje Q-11b i H-8 do akceptacji literami

Właściciel nie dostał treści. Przedstaw obie w jednej wiadomości, bez budowy.
Do odpowiedzi: dalej B-10 ceny/dopłaty, H-7, SEC. D-83 później.

## Polecenie 2026-10-05 ~13:42 (czas warszawski) — Q-11b A + H-8 A (decyzje właściciela)

Właściciel wybrał litery:

### Q-11b = **A** (Web Push VAPID, 0 zł)
- Krytyczne: natychmiast na telefon (jak e-mail krytyczny).
- Niekrytyczne: jeden skrót dziennie (L-13 DIGEST).
- Włącz/wyłącz w Preferencjach.
- Widoczność firm: DEC-4 (macierz).
- iPhone: w Preferencjach instrukcja „Dodaj do ekranu głównego” (iOS 16.4+).

### H-8 = **A** z doprecyzowaniem — **budować TERAZ**
- Profil wysokości / nachylenia: Routing v8 `return=elevation` dla **standardowego profilu ciężarówki**.
- **Bez D-83** na start (same elevation + truck default).
- Naruszenia wymiarów zestawu (jak H-1/H-3) włączają się **automatycznie po D-83** (gdy flagi H1/H3).
- Koszt: pula tras D-78 → 0 USD ponad przy zużyciu w limicie.
- H1/H3/H6 zostają **false**; TELM_EMTRACK_WEB **true**; blokada SMS/e-mail właściciela zostaje.

Kontynuować też B-10 / H-7 / SEC z poprzedniej paczki.

## Polecenie właściciela 2026-10-05 ~13:53 (czas warszawski) — CSP, ZAP, D-3, raport stanu, nie stój

DECYZJE WŁAŚCICIELA (05.10) I DALSZA PRACA

1. CSP: tryb Report-Only przez 7 dni, zbieranie naruszeń do tabeli
   w Stanie systemu; potem lista dozwolonych źródeł do akceptacji
   właściciela i włączenie wymuszania PRZED SEC-OWASP i pilotażem.
2. ZAP: nie czekaj na Dockera — instalacja ZAP bez Dockera (pakiet
   z Javą); Baseline pasywny na produkcji, pełny tylko na TEST. Wynik
   do SEC-OWASP.
3. D-3: zatwierdzone — CMR, POD i zdjęcia 3 lata, PDF faktur 5 lat;
   wdroż retencję (I-7 dla danych kierowcy bez zmian).

4. NIE STAJESZ. Najpierw raport stanu (tabela ID | status | dowód)
   dla: B-KSH, HHL-4a, C-SEP, B-REJSY, FAK-9, Q-7, Q-8, Q-10, Q-15,
   Q-17, UI-12, D-31, D-27, CLEAN-MAPLIBRE, AUTH-MAIL, I-29, TELM-2
   (symulacje naczepy), B-10, H-7. Każda pozycja bez dowodu = do
   zrobienia — budujesz w kolejności PLAN.md.
   Czekają na właściciela tylko: D-83 (B-3a, H-1, H-3), R-0, D-7, D-14,
   D-16, D-17, D-21. GATE-WEEKLY 11.10 bez zmian.
5. SG-03: raport po rozładunku jak ustalono (SMS 1 h przed — tylko
   do właściciela).

Migracje przez lokalną bramę, obie domeny 200. Bez kasowania danych,
bez wydatków, bez prawdziwych SMS bez zgody.
TELM true; H1/H3/H6 false; blokada SMS właściciela zostaje.

## Polecenie właściciela 2026-10-05 ~14:12 (czas warszawski) — audyt ZAP Active na PROD + dowody + B-10/TELM-2

1. **AUDYT** skutków ZAP Active Scan na PROD (okno ~13:58 Europe/Warsaw, `-quickurl`):
   - nowe/zmienione wiersze **wszystkich** tabel;
   - e-maile / SMS / push;
   - logowania / blokady / konta / resety;
   - limity Resend / HERE / DeepL.
   Wynik: tabela. Śmieci — **LISTA do akceptacji, NIC nie kasuj**.
   Blokady kont — **zdejmij**.
   Popraw skrypt: prod **TYLKO pasywny**; aktywny tylko TEST + test że prod odrzuca aktywny.

2. **DOWODY** (tabela): każdy wiersz = PR+migracja lub nazwa testu —
   HHL-4a, FAK-9 (EUR/PLN przy wystawieniu + kurs D-43; brak=buduj),
   Q-7, Q-8, Q-10, Q-15, Q-17 osobno, UI-12, D-31, D-27 (kontrast ≥4.5),
   CLEAN-MAPLIBRE, AUTH-MAIL, I-29. Bez dowodu = buduj wg PLAN.md.

3. Potem kontynuuj **B-10** i **TELM-2** (jak wcześniej).
Nie buduj: D-83/B-3a/H-1/H-3/H-6, R-0, D-7/14/16/17/21.
TELM true; blokada SMS właściciela; bramy; domeny 200.

## Polecenie właściciela 2026-10-05 ~14:29 (czas warszawski) — WERYFIKACJA ZESZYT B/C (lista kontrolna + zrzuty prod)

WERYFIKACJA I DOKOŃCZENIE CAŁEJ CZĘŚCI B I C — WEDŁUG LISTY KONTROLNEJ
(decyzja właściciela 05.10; plik LISTA_KONTROLNA_ZESZYT.md w załączniku)

Właściciel widzi na produkcji, że wiele pozycji z zeszytu nie jest
zrobionych, mimo statusów DONE w raportach. Od teraz obowiązuje zasada:
pozycja jest zrobiona TYLKO wtedy, gdy na produkcji wygląda i działa
dokładnie tak, jak w słowach właściciela — z dowodem w postaci zrzutu
ekranu z produkcji.

1. Zapisz LISTA_KONTROLNA_ZESZYT.md w docs/handover/.

2. Dla KAŻDEGO punktu listy (1.1 … C.1):
   - sprawdź na PRODUKCJI (Playwright, konto właściwej roli: HHL admin,
     HHL użytkownik, KSH, przewoźnik — przez „Działaj jako"), na
     komputerze i na telefonie (390 px), gdy punkt dotyczy wyglądu
   - porównaj z DOSŁOWNYM zdaniem właściciela z części B i C
     ZLECENIE_POPRAWKI_02_10.md, nie z własną interpretacją
   - zgodne → zrzut ekranu jako dowód
   - niezgodne albo brak → zbuduj, wdroż, potem zrzut
   - punkty ⛔ (3.1 zezwolenia — wymiary D-83) pomiń z adnotacją

3. Szczególnie (dotychczasowe dowody nie odpowiadały słowom właściciela):
   P7 Stena w górnym pasku obok Polferries; P8 brak wyboru języka nigdzie;
   P10 brak zegara w prawym górnym rogu; P15 ekran logowania i ładowania
   wyśrodkowany, bez ramek; cała sekcja 10 (podgląd zlecenia) i 8
   (harmonogram) punkt po punkcie.

4. Zrzuty zapisz w docs/evidence/zeszyt/<numer>.png. Tabela wyników
   w docs/handover/WERYFIKACJA_ZESZYT_05_10.md:
   numer | słowa właściciela | wynik (zgodne / poprawione / ⛔) |
   zrzut | PR / migracja.
   Bez zrzutu = niezrobione.

5. KONTA (decyzja właściciela):
   - sebastian+tower-o3-* (3 konta testowe O3a): usuń z kopią w R2
     i wpisem w historii; najpierw sprawdź, że nic na nie nie wskazuje
   - marek@hyzyk.pl, p.duks@…, s.hotowczyc@…: zostają WYŁĄCZONE do R-2;
     popraw literówkę „scandimavian" → „scandinavian" (przed/po w raporcie);
     bez wysyłania zaproszeń

6. Kolejność: punkty listy po kolei, sekcja po sekcji. Wdrożenie po
   każdej zamkniętej sekcji (brama, obie domeny 200). Raport po każdej
   sekcji: ile zgodnych, ile poprawionych, link do tabeli.
   TELM-2 i test SG-03 (SMS tylko do właściciela) — bez zmian, w tle.
   Nie przechodzisz do SEC-OWASP, dopóki cała lista nie ma zrzutów.

Zasady bez zmian: migracje przez lokalną bramę, bez kasowania danych
poza punktem 5, bez wydatków, bez prawdziwych SMS bez zgody.
Zapisz polecenie w POLECENIA_KOORDYNATORA.md.

Zasada dowodu: DONE tylko gdy na PRODUKCJI wygląda i działa dokładnie jak DOSŁOWNE słowa właściciela z ZLECENIE_POPRAWKI_02_10.md części B i C — zrzut ekranu. Bez zrzutu = niezrobione.
TELM/SG-03 bez zmian w tle; SMS tylko właściciel. Bramy; domeny 200; H1/H3/H6 false; bez wydatków/kasowania poza pkt 5.

## Uzupełnienie 2026-10-05 ~14:31 (czas warszawski) — DYSCYPLINA do końca listy kontrolnej

Pracuj **WYŁĄCZNIE** nad listą sekcja po sekcji.
Nowa uwaga właściciela/koordynatora → dopisz `docs/handover/POCZEKALNIA.md` (data, treść, kto) i **WRÓĆ** do bieżącej pozycji; **NIE** zaczynaj jej.
Poczekalnię po zamknięciu sekcji; decyzje po całej liście.
Przerwanie **TYLKO**: awaria prod, bezpieczeństwo, utrata danych, SMS/email do niepowołanych.
Raporty krótkie; wątpliwość = dosłowne słowa właściciela, pytanie do poczekalni.

## Decyzje właściciela 2026-10-05 ~16:22 (czas warszawski) — POCZEKALNIA A–F

POCZEKALNIA — decyzje właściciela:
A 10a.1: dosłownie — z GÓRNEGO PASKA podglądu usuwamy: „Zlecenie",
  „Śrem" jako nadawcę, wymiary zestawu, Nr zlecenia KSH, Montaż,
  Nr rezerwacji promu. Śrem zostaje w sekcji Załadunek; wymiary
  ładunku zostają w szczegółach.
B 10c.1: „imię nazwisko // firma"; zdarzenia automatyczne:
  „System // Watch Tower".
C 8.3: brak godziny od KSH → przy dacie „–", bez zgadywania godziny.
D 8.9: przycisk „Jak działa" przy filtrach (jak w Opcjach), krótki
  opis każdego filtra.
E: licznik „N pojazdów" = tylko pojazdy z prawdziwą pozycją GPS.
F: napisz, czego brakuje do zapisu kopii w R2 (dostęp/klucz/konfiguracja)
  — bez zgadywania; konta były testowe.
Każda pozycja ze zrzutem z produkcji, jak na liście kontrolnej.
Potem: raport, które pozycje PLAN.md NIE czekają na właściciela —
jeśli żadne, napisz wprost.

## Polecenie właściciela 2026-10-05 ~16:44 (czas warszawski) — A SEC-OWASP + przedtem F/PLAN/D-1

A — **SEC-OWASP** (ASVS poziom 2), teraz. Zasady:
- ZAP: pasywny na produkcji, aktywny tylko na TEST
- CSP: Report-Only trwa do 12.10; wymuszanie dopiero po przeglądzie
  zebranych naruszeń — lista dozwolonych źródeł do akceptacji
  właściciela; do tego czasu reszta ASVS
- wynik: lista punktów ASVS z wynikiem i dowodem; luki wysokie
  i krytyczne naprawiasz od razu, średnie i niskie — lista do akceptacji

Przy okazji (krótko, przed SEC-OWASP):
1. F: token R2 działa — wgraj kopię kont O3 (`konta/`) do `tower-backup`,
   potwierdź listą obiektów.
2. PLAN.md: Q-11a, Q-11b (PR #91/#94) i I-3-APK są zrobione — popraw
   statusy z dowodem; jeśli czegoś faktycznie brakuje, napisz co.
3. „D-1" na liście czekających — wyjaśnij jednym zdaniem, czego dotyczy
   (cennik D-1 jest zrealizowany w I-30).

TELM-2 i test SG-03 w tle bez zmian. GATE-WEEKLY 11.10.

## Decyzje właściciela 2026-10-05 ~16:55 (czas warszawski) — SEC-OWASP C/D/PKCE/deps

SEC-OWASP — decyzje właściciela:
C: hasło minimum 12 znaków (ASVS L2); obowiązuje przy nowym haśle
   i zmianie, istniejące konto właściciela bez wymuszonej zmiany.
D: CORS zawężony do https://tower.log-mar.pl (funkcje Edge); test,
   że aplikacja i bramka SMS działają.
OAuth implicit → PKCE; PRZED wdrożeniem test od początku do końca:
   zaproszenie (nowe konto testowe), ustawienie hasła, logowanie,
   reset hasła — bez wysyłki do prawdziwych osób.
exceljs/uuid: aktualizacja; test importu harmonogramu i eksportu
   XLSX/PDF.
B: CSP enforce — decyzja 12.10 po przeglądzie naruszeń.
Wynik: zaktualizowana tabela ASVS (fail → pass) z dowodami.

Zasady: TELM-2 / SG-03 bez zmian; chmura off; CSP Report-Only bez enforce;
brama + merge + deploy po zielonym e2e PKCE. Autor: Sebastian Bożek /
sebastian.bozekq@gmail.com.

## Poczekalnia koordynatora 2026-10-05 ~18:23 (czas warszawski) — SG-03 ETA

POCZEKALNIA (koordynator, SG-03):
1. Potwierdź znaczenie etykiet przy ETA: „Wysoka" (pewność prognozy?)
   i „w oknie" (definicja). Wyjaśnienie w „Jak działa".
2. „w oknie" przy ETA 06.10 01:02, gdy dostawa zaplanowana 07.10 —
   czy przyjazd wyraźnie PRZED terminem (inny dzień, noc) ma osobny
   znacznik albo ostrzeżenie? Jeśli nie — propozycja.
3. ETA zmieniło się z 06.10 07:03 na 06.10 01:02. Rozbij składniki:
   jazda, odpoczynek kierowcy (D-85), postoje. Czy zapis
   „kierowca1|kierowca2" (przepięcie, C-SEP) nie jest traktowany jak
   obsada dwuosobowa? Obsada jest jednoosobowa (U-31).

Zakres: analiza + ewentualna mała poprawka „Jak działa" (braki definicji);
propozycja early-arrival bez implementacji przed decyzją; bug C-SEP vs U-31 →
fix + test + deploy.

## Decyzje właściciela 2026-10-05 ~18:40 (czas warszawski) — SG-03 / ETA A, B, C

SG-03 / ETA — DECYZJE WŁAŚCICIELA (05.10): A, B, C

---------------------------------------------------------------
A. PR #118 — opis „Jak działa" przy ETA
---------------------------------------------------------------
Scal i wdroż.

---------------------------------------------------------------
B. ZNACZNIKI PRZY ETA — trzy kolory, jedna zasada
---------------------------------------------------------------
- zielony „w oknie" — ETA między początkiem a końcem okna dostawy
- bursztynowy „przed terminem" — ETA przed początkiem okna dostawy
  (inny dzień albo przed godziną „od"); tylko informacja
- czerwony „po terminie" — ETA po końcu okna dostawy (godzina „do",
  a bez niej koniec dnia dostawy); spójny z istniejącym ryzykiem ETA
  po terminie i progiem opóźnienia z L-3 — ten sam warunek, bez
  drugiego alarmu
- dodatkowo „przyjazd nocą", gdy ETA między 22:00 a 6:00 (czas polski);
  tylko informacja
- znaczniki „przed terminem" i „przyjazd nocą": bez decyzji w Centrum
  decyzji i bez SMS
- opis wszystkich znaczników w „Jak działa"

---------------------------------------------------------------
C. H-4 — ETA Z CZASEM PRACY KIEROWCY WEDŁUG PRZEPISÓW UE (D-85), TERAZ
---------------------------------------------------------------
Dostępu do danych z tachografu NIE BĘDZIE nigdy — ani z emtrack, ani
z innego źródła. Czas jazdy i odpoczynku liczony wyłącznie z pozycji
GPS naczepy. To rozwiązanie docelowe, nie przejściowe.

Zasady:
- obsada jednoosobowa (U-31); zapis „A|B" to przepięcie, nie załoga
- z pozycji GPS: postój ≥ 9 h = odpoczynek dobowy skrócony, ≥ 11 h =
  regularny; postój ≥ 45 min (albo 15 + 30 min) = przerwa; czas jazdy
  liczony od końca ostatniego odpoczynku dobowego
- reguły: przerwa 45 min po 4,5 h jazdy; maks. 9 h jazdy dziennie
  (10 h dwa razy w tygodniu); odpoczynek dobowy 11 h (skrócony 9 h)
  wstawiany w ETA tam, gdzie wypada; odpoczynek na promie (D-9)
- brak historii GPS od ostatniego odpoczynku → założenie ostrożne,
  oznaczone w „Jak działa"
- przepięcie: nowy kierowca od momentu przepięcia z awizacji
- SMS-KSH-1H liczony z tego ETA
- kalibracja ucząca się (II-7b): po każdym rozładunku porównanie ETA
  z rzeczywistym przyjazdem, dostrajanie prędkości, czasu przerw
  i odpoczynku
- „Jak działa": rozbicie ETA na jazdę, przerwy, odpoczynek, prom oraz
  zdanie „czas pracy kierowcy szacowany z ruchu i postojów pojazdu,
  bez danych z tachografu"

Kolejność: A → B → C. Migracje przez lokalną bramę, obie domeny 200.
SMS i e-maile SG-03 nadal tylko do właściciela.
Zapisz decyzje w rejestrze decyzji (przy D-85: brak tachografu na
stałe, GPS jako źródło czasu pracy), w PLAN.md
i w POLECENIA_KOORDYNATORA.md.


## 2026-10-05 ~20:33 Europe/Warsaw — H-4 / SG-03 poprawki (w ramach C)

Opis „Jak działa” przy ETA — potwierdzony, NIE zmieniać.

1. ZAŁOŻENIE OSTROŻNE przy braku historii GPS: gdy system nie zna ostatniego odpoczynku dobowego — przyjmij, że limit jazdy może się kończyć; odpoczynek dobowy wstaw najpóźniej tam, gdzie wypada wg przepisów. Popraw jeśli dziś „świeży kierowca”. Historia GPS SG-03 od 05.10 13:25 (emtrack).
2. HISTORIA SPRZED PODŁĄCZENIA: sprawdź czy klient emtrack daje historię naczepy sprzed 13:25 (tylko odczyt). Jeśli tak — przy podłączeniu transportu w trasie użyj do ostatniego odpoczynku i czasu jazdy.
3. NIEPEWNOŚĆ PROGNOZY: odpoczynek/przerwy z GPS → niepewność NIE może być 0%. Pasmo ± uwzględnia wcześniejszy/późniejszy odpoczynek. „Wysoka” tylko gdy cały rozrzut ≤ 60 min. Zrzut ETA SG-03 po zmianie.
4. TESTY: (a) brak historii → odpoczynek wstawiony, „Wysoka” niedostępna; (b) pełna historia z odpoczynkiem 11 h rano → dzień jazdy od jego końca; (c) niepewność odpoczynku > 0 w paśmie.
5. RAPORT PO PRZYJEŹDZIE SG-03: ETA przed H-4 / po H-4 / po tej poprawce vs rzeczywisty wjazd Boden; godzina SMS „1 h przed” (tylko właściciel). Wnioski II-7b.

Migracje: lokalna brama. Obie domeny 200. SMS/e-mail SG-03 tylko do właściciela.

## 2026-10-05 ~21:48 Europe/Warsaw — CENY I OPŁATA PALIWOWA BAF (po H-4/SG-03)

Właściciel: mnożnik tydzień 41 (załadunki 05–11.10) = **1,13**.

1. BAF SEK = OKQ8 **GoEasy Diesel** firmowa (nie Q8 Trucks). Kontrola 05.10 = **22,29**. Decyzja Q8 Trucks z 05.10 rano — zastąpiona.
2. Średnia z cen **opublikowanych** w pełnym poprzednim tygodniu (pon–niedz), nie z każdego dnia; tydzień bez publikacji → ostatnia opublikowana. Wzorzec 28.09–04.10 → tydzień 41: SEK 22,63→1,13; PLN Orlen 7,22→1,15; wynik **1,13**. Przelicz SEK od 21.09 z GoEasy; data publikacji przy odczycie.
3. Mnożnik ostateczny dopiero po zamknięciu poprzedniego tygodnia (po niedzieli PL); wcześniej „wstępny” w Cenach; ostateczny jako migawka (0166).
4. `sefs_compute_hybrid_sys`: wersja tabeli wg `valid_from` tygodnia załadunku; nazwa indeksu SEK = GoEasy Diesel firmowa.
5. **KRYTYCZNE:** 94 transporty bez ceny — `rate_match` z wymiarów **ładunku** (shipment_items), nie combo_* (D-83). Przelicz koszt/przychód ×94. Komunikat SG-03 18,21 m = długość ładunku.
6. Testy: tydz.41→1,13; bez publikacji; niepełny→wstępny; wersja tabeli; SG/PL/KR + dopłata; raport 94.

Migracje: lokalna brama. Domeny 200. Decyzja GoEasy+średnia z publikacji → rejestr D-2/D-34, PLAN.md, tu.

## 2026-10-05 ~21:51 Europe/Warsaw — UZUPEŁNIENIE BAF pkt 2

Zamiast „Przelicz odczyty SEK od 21.09 z historii GoEasy":
- uzupełnij odczyty od 21.09 dla **OBU** źródeł (GoEasy z historii OKQ8, Orlen z archiwum cennika); data publikacji przy każdym;
- drugi wzorzec (tydzień 21–27.09 → załadunki tygodnia 40):
  SEK 23,34 / 22,54 / 22,94 / 23,34 → 23,04 → 1,14
  PLN 7,440 / 7,347 / 7,342 / 7,483 / 7,442 → 7,41 → 1,17
  wynik **1,14** (m.in. SG-03, załadunek 01.10)
W raporcie: mnożnik tygodnia **40 = 1,14** i **41 = 1,13**.

> Zapis decyzji (05.10 ~22:05): GoEasy Diesel firmowa + średnia z cen opublikowanych → `wzorzec/03_REJESTR_DECYZJI.md` (wiersz D-2 / D-34), `PLAN.md` (BAF-CENY-05-10). Realizacja: migracja **0187**, testy `tests/db/baf.sh`.

## 2026-10-05 ~22:31 Europe/Warsaw — SG-03 BAF A + zasada TELM mid-trip

SG-03: A — rzeczywisty załadunek **01.10** → tydzień **40** → mnożnik **1,14**.

ZASADA NA STAŁE (poprawka „transport już w trasie" TELM):
- podłączenie śledzenia w trakcie jazdy NIE ustawia rzeczywistego załadunku na godzinę podłączenia
- faza z pozycji (np. IN_TRANSIT_SE) osobno, adnotacja „faza z pozycji przy podłączeniu"
- rzeczywisty załadunek: tylko wyjazd ze strefy załadunku (GPS) albo ręcznie dyspozytor; gdy nieznany — BAF/daty z planu KSH (D-12, fuel_load_date bierze plan gdy brak actual)
- sprawdź inne transporty z tą samą ścieżką; popraw + lista
Test: podłączony 05.10, plan 01.10 → actual pusty, tydzień paliwa 40, mnożnik 1,14.
Raport BAF: lista 8 bez ceny (86/94) + przyczyna każdego.

> Realizacja (05.10 ~22:50): migracja **0188** `0188_telm_faza_bez_zaladunku.sql` — `telm_infer_phase_from_position` nie ustawia `actual_load_at`; faza w `telm_attach_phase` (adnotacja „faza z pozycji przy podłączeniu”); korekta `telm_fix_attach_actual_load()`. Audyt PROD: ta sama ścieżka tylko **SG-03** (actual 05.10 13:21 → pusty; paliwo tydz. 40 = 1,14). Testy `tests/db/baf.sh` (36).

## 2026-10-06 ~00:12 Europe/Warsaw — BAF prognoza dla przyszłych tygodni

66 transportów z załadunkiem 16.10–15.12 ma mnożnik 1,12 — wynik z niepełnego tygodnia (1 odczyt GoEasy 05.10). Zasada:
- tydzień załadunku, którego poprzedni tydzień nie jest zamknięty → PROGNOZA = ostatni OSTATECZNY mnożnik (dziś 1,13), oznaczona „prognoza" w Cenach i Finansach
- po zamknięciu poprzedniego tygodnia → mnożnik ostateczny, migawka
- każde zamknięcie tygodnia przelicza prognozy pozostałych przyszłych transportów
Test: dziś przyszłe transporty = 1,13 „prognoza"; symulacja zamknięcia tygodnia 41 → załadunki tygodnia 42 dostają ostateczny, reszta prognozę.
Potem dalej według PLAN.md.
