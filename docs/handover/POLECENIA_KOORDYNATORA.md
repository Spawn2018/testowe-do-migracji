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
