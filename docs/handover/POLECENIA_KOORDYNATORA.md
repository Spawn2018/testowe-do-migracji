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
