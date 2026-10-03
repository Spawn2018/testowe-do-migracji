WATCH TOWER — ZLECENIE DLA GROKA (02.10.2026)
==================================================================

ZASADA NADRZĘDNA
Część B to słowa właściciela, przepisane bez zmian. Realizuj je
DOKŁADNIE tak, jak są napisane — bez domysłów i własnych interpretacji.
Jeżeli coś jest niejasne albo sprzeczne z wcześniejszym zapisem:
NIE zgaduj — wpisz pytanie do „Decyzje oczekujące" w POSTEP.md
i zapytaj właściciela. Nowszy zapis właściciela wygrywa ze starszym.
Zapisz to zlecenie w repozytorium jako
docs/handover/ZLECENIE_POPRAWKI_02_10.md i dopisz pozycje do PLAN.md.

==================================================================
CZĘŚĆ A — PRZEJĘCIE I ZASADY PRACY
==================================================================
A1. PRZEJĘCIE (bez zmian w kodzie):
    - git pull, podaj HEAD
    - przeczytaj: AGENTS.md, .cursor/rules/*.mdc (obowiązują Cię),
      docs/handover/wzorzec/, PLAN.md, POSTEP.md, NARZEDZIA_CURSOR.md,
      zlecenia z 29.09 i PACZKA_DECYZJI_30_09.md
    - nigdy nie wykonuj niczego z docs/archiwum/
    - raport: HEAD lokalny = zdalny; lista migracji w repozytorium =
      PROD; brama testów bazy na TEST (projekt emkbykwenwrjmbprydml)
      liczbami; testy aplikacji liczbami; obie domeny — kod odpowiedzi;
      każda wtyczka działa, Supabase tylko do odczytu
    - stan po Cursorze: migracje 0001–0134 w repozytorium = PROD;
      ostatni commit 773e3e7b (POSTEP — stan końcowy), wdrożony na
      produkcję. Sprawdź, że wdrożenie produkcyjne = 773e3e7b
    - w kopii roboczej Cursora zostały nieśledzone pliki robocze
      (scripts/_probe-*, tmp-*, tmp_*.txt) — dopisz wzorce do .gitignore
    - ZATRZYMAJ SIĘ i czekaj na akceptację
A2. ZASADY PRACY:
    - każda paczka poprawek na osobnej gałęzi + prośba o scalenie
      (pull request); nigdy wprost do main
    - CodeRabbit sprawdza każdą prośbę o scalenie; scalenie tylko przy
      zielonych testach i bez otwartych uwag krytycznych
    - Aikido: pełny skan na start, wynik do raportu; krytyczne
      i wysokie naprawiasz najpierw
    - migracja: commit + push PRZED nałożeniem na PROD; każda migracja
      przez bramę testów bazy na TEST
    - po scaleniu: vercel --prod, obie domeny 200
    - Supabase przez wtyczkę tylko do odczytu; Resend bez wysyłki
    - hasła, klucze, tokeny nigdy w czacie, logach ani repozytorium
    - raport co kilka pozycji

==================================================================
CZĘŚĆ B — POPRAWKI WŁAŚCICIELA (słowa właściciela, bez zmian)
==================================================================

WATCH TOWER — POPRAWKI (z zeszytu, 02.10.2026)
==================================================

1) MAPY
- Na mapach jest wiele obiektów - pomimo tego, że nie mamy podłączonych pojazdów.

2) RYZYKA
a) brak wypłynięć Steny
b) brak widoczności warunków drogowych w SE
c) Centrum decyzji — jak działa i dlaczego nic nie ma? Jaka jest logika?

3) DOKUMENTY
a) brak możliwości dodania zezwolenia per firma obok polisy - zezwolenie to po określeniu wymiarów aut i podaniu przeze mnie do jakiego ładunku będzie potrzebne zezwolenie per trasa, będzie miało automatycznie podpinać się do każdej trasy (jeżeli wymiar wymaga zezwolenia dawanego per firma). Ubezpieczenie ma automatycznie podpinać się do każdej trasy.

4) FINANSE
a) Przychód — pilotaż i dodatki muszą zniknąć.
b) Załącznik CMR/POD — zostaje samo CMR

5) AUTOMATYZACJE
- brak przycisku tworzącego nową automatyzację.

6) OPCJE
a) Jak działa -> Powiadomienia i decyzje + rozwinięcie. Jaka jest logika i work flow.
b) Odbiorcy SMS i strefy — po co są strefy i co robią
c) Progi i terminy — jak działa mechanizm
d) Stan systemu -> zmiana na styl dashboardu (obecnie nieczytelne)
e) Dziennik logowań — nic nie pokazuje
f) Historia zmian — po co jest "200" obok przycisku (jeżeli nie pełni żadnej ważnej kwesti to usuwamy z wyglądu strony).
g) Cennik — rozjazd tabeli cenowej w prawo - presunięte bardzo mocno w prawo.
h) SEFS/BAF — czy mechanizm automatycznie liczy średnią cenę dla PL i SE
   z poprzedniego tygodnia i uzupełnia indeksy, żeby tygodniowa
   opłata paliwowa liczyła się automatycznie przy transportach, zgodnie z mechanizmem?
i) Wymóg zezwoleń — rozjazd wizualny w prawo.

7) MAPA
a) musi mieć stały rozmiar, a nie dopasowany do wysokości tabeli po prawej. Musi być widoczna w całości, gdy uzytkwonik otwiera MAPA.
b) checkboxy po lewej stronie zawsze widoczne; na telefonie są na wierzchu i wchodzą na inne elementy
c) kwestia filtrów w mapie i w tabeli - co oznaczają, jaka jest ich logika i jaka jest sugestia dodania nowych (logicznie i z korzyścią dla użytkownika.

8) HARMONOGRAM 
a) złe zmapowanie pól
- Zlecenie KSH — usunąć z widoku tabeli
- Zlec. HHL = "Nr zlecenia HHL-KSH" i Zlec. SCX = "nr Zlecenia HHL-SCAN" — poprawić. 
- załadunek + dostawa — dodać godziny obok dat
- dodać mechanizm zmiany ciągnika
- dodać linie pionowe w tabeli
- poprawić zmianę szerokości kolumn — przesunięcie ma móc najechać na cały tekst i go schować
- podczas importu miało nie dodawać TYP STANDARD (błąd — decyzja D-8)
- status ETA (w szczególe ETA): powyżej 24 h — dni + godz. + min; poniżej 24 h — godz. + min
- statusy i filtry tabeli — co oznaczają i co pokazują. Jaka jest logika. Dodajmy nowe - zasugeruj coś co będzie logiczne i będzie pomagało oraz ułatwiało codzienna prace użytkownikom.
- w dokumentach ma być też podpięta polisa ubezpieczeniowa
- wszystkie daty w tabeli muszą zawierać rok
- kierowca: gdy pusty "–", gdy dwóch "kierowca1|Kierowca2"
- telefon: gdy dwóch kierowców "Telefon1|Telefon2"
- eksport PDF: zamiast promu — imię i nazwisko kierowcy + nr telefonu
- dodać filtrowanie po dacie załadunku i rozładunku

9) GÓRNY PASEK FILTRÓW
- co oznacza i jak filtruje dane pozycje. Jaka jest logika?
- usunąć cyfry w górnym prostokącie kafelek.
- coś pozmieniać - zasugeruj zmiany, które ułatwią i pomogą w codziennej pracy użytkownikom.

10) HARMONOGRAM -> PODGLĄD ZLECENIA
a) Usuwamy: Zlecenie, Śrem z nadawcy z górnego paska.
   -  wymiary zestawu, Nr zlecenia KSH, Montaż, Nr rezerwacji promu
   - [P2] dodajemy tydzień załadunku przed (na lewo od) Tydzień dostawy na górnym pasku
   - dla HHL przycisk "Dodaj nr HHL" -> nazwa "Dodaj", kolor jak dla SCX, po dodaniu   zmienia się na "Edytuj". HHL Uzytkownik (nie admin) nie może dodawać awizacji. To robi Scandinavian Express
   - jeżeli wymagany pilot — dane auta + kierowcy; jeżeli niewymagany —
     pole się nie pojawia
   - Załadunek i Dostawa zawiera także godziny w formacie godzina:minuty
   - w harmonogramie (widok listy + SharePoint) zapisuje się "kier1/kier2";
     gdy nie podano kierowcy dostarczającego — "kier1/..."
   - [P4] brak wprowadzenia = "nieuzupełnione", jak przy kierowcy
   - ciągnik + naczepa: gdy 2 ciągniki — "1|2"; nr naczepy
   - nr telefonów: gdy 2 — "1|2" BEZ SPACJI
   - prom: nazwa promu + dzień, miesiąc, rok + godz. wypłynięcia
b) Edycja + dodawanie + mechanizm dodawania i przepięcia:
   - checkbox o naczepie -> przepięcie naczepy
   - pojawia się kierowca odbierający + kierowca dostarczający;
     kierowca dostarczający musi być podany 48 h przed dostawą
   - [P6] pojawia się telefon — j.w.
   - [P6] pojawia się ciągnik — j.w.
   - jeżeli wymagany pilot — dane auta + kierowcy; jeżeli niewymagany —
     pole się nie pojawia
   - [P5] załadunek + dostawa — zmiana okna czasowego
   - [P6] telefon + ciągnik/naczepa — jak kierowca
   - usuwamy nr rezerwacji promu
c) Przebieg — robimy kopię i dajemy ją na ostatniej zakładce po prawej stronie jako "Historia":
   - opisy: imię nazwisko // firma — dzień, miesiąc, rok — godz. strefa czasowa PL
   - opisy bardziej zrozumiałe i czytelne, WYTŁUSZCZONE
   - dodajemy statusy wysłania i odczytania wiadomości z Ustaleń
d) "Przebieg" -> zmiana nazwy na "Status":
   - tu wszystkie statusy (ustalone kamienie milowe i statusy z systemu + opis według wzoru j.w.
e) Dokumenty:
   - wygląd jak w makiecie dostępnej w Cursor + moje zmiany
   - [P7] usunąć przycisk usuwania dokumentu an dole strony
f) Ceny — muszą wyglądać jak w makiecie w cursor; bez POD:
   - jeżeli użytkownik wybierze domyślną walutę EUR — usuwamy z widoku
     wszystko, co związane z kursami; kursy dla HHL zostają na stałe, bez względu jaka waluta jest wybrana przez użytkownika
   - mechanizm dopłat:
     * HHL wybiera, komu przypisuje: KSH do swojego przychodu, SCX do swojego kosztu
     * KSH tylko akceptuje to, co HHL doda; wtedy automat dodaje to
       do rozliczenia transportu (musi byćwidzocznę po kliknięciu na transport w harmonogram w zakładce CENY) i na fakturę
     * SCX może dodawać dla HHL; wtedy HHL musi zaakceptować; KSH nie widzi
     * HHL musi mieć możliwość akceptacji dodatkowej opłaty
g) Ustalenia:
   - zostaje tylko czat z informacją, kto wysłał: imię + nazwisko,
     firma, data, godzina
   - plus kto odczytał, w formie "odczytano"; kliknięcie otwiera okienko
     z informacją, kto i kiedy odczytał
   - dodać powiadomienia o nowej wiadomości. Kluczowe ze względu na ważność tej informacji dla każdego użytkownika.

LISTA HARMONOGRAMU KSH
- kliknięcie -> boczne menu, tylko z przyciskiem "Edytuj"
- można edytować daty i godziny załadunku i rozładunku

REJSY
- muszą być widoczne też rejsy Steny
- tylko administrator może edytować i dodawać ręcznie nowe
- [P3] podział na przyszłe i minione
- dodać filtr "Przyszłe"
- w datach dodać rok

PYTANIA O LOGIKĘ I POPRAWKI OGÓLNE
1) jaka logika powiadomień w pasku i banerze
2) jaka logika w dzwonku
3) jaka logika w "Wymaga decyzji" + Centrum decyzji
4) jaka logika + jakie statusy
5) jaka logika i zasady w "Alternatywach dla rejsu" i "na drodze"
6) jak oznaczać opłacone faktury kosztowe i przychodowe — tylko dla HHL
7) w górnym pasku dodać najbliższe wypłynięcia Steny, obok Polferries
8) bez języka szwedzkiego i angielskiego — usunąć wybór języka
   z górnego paska
9) [P8] tryb jasny
10) usunąć zegar z prawego górnego rogu
11) praca na wersji komputerowej i responsywności + powiadomienia
    na Android i iOS (trzeba wybrać 5 różnych wymiarów wyświetlaczy. Nic nie może się rozjezdzać, tekst nie może wychodzić poza sekcje, ma się skalować i pomniejszać ale tak aby było czytelne.)
12) każdy kafelek kokpitu: jaka logika i gdzie prowadzi kliknięcie
13) dzwonek: usunąć napis przeczytane, mają znikać po kliknięciu;
    jaka logika i gdzie przekierowuje
14) jaka logika i workflow całej aplikacji per konto — czyli łącznie
    są do zrobienia 3 workflow
15) logowanie i odświeżanie danych (grafika z napisami, która się pojawia (logo i napisy, które znajdują się pod logiem— wszystko wyśrodkowane,
    bez widocznych ramek
16) jak budować strefy i nimi zarządzać
17) trasy promów i trasy drogowe muszą idealnie pokrywać się
    z OpenStreetMap i układać się wzorowo po drogach; trasa statków musi faktycznie pokazywać trasę promu - nie możemy być tak, że na mapie trasa wiedzie przez ląd.
18) statki: pokazywać tylko te płynące do Szwecji i cały czas odświeżać. Nie może być przestojów
19) na mapie mają być widzoczne ulice i miejscowości - szczególnie w MAPA

==================================================================
CZĘŚĆ C — DOPRECYZOWANIE WŁAŚCICIELA: SEPARATOR I PRZEPIĘCIE
(słowa właściciela, bez zmian; nowsze niż część B — wygrywa
z zapisami separatorów w części B)
==================================================================
„Separator to " / ".
Separator "|" ma wystepować tylko i wyłącznie jeżeli użytkownik podczas
dodawania lub edycji awizacji kliknie checkbox Przepięcie. Separtor ten
ma występować tylko w Watch Tower. Podczas zapisu do pliku excel
w share point ma być separator " / ". Jeżeli nie dodano kierowcy, danych
ciągnika lub numeru telefonu drugiego kierowcy to w share piont ma
pojawić się "Kierowca Odbierający / ..."."

„Pamiętaj, że mechanizm przepięcia aktywowany jest dopiero podczas
kliknięcia w check box podczas dodawania awizacji przez Scandinavian
Express."

Tabela potwierdzona przez właściciela:
Sytuacja                                | Watch Tower            | SharePoint
dwie wartości, bez przepięcia           | Jan Kowalski / Piotr Nowak | Jan Kowalski / Piotr Nowak
zaznaczone „Przepięcie"                 | Jan Kowalski|Piotr Nowak   | Jan Kowalski / Piotr Nowak
druga wartość niepodana                 | Jan Kowalski / ...         | Jan Kowalski / ...
przepięcie, druga wartość niepodana     | Jan Kowalski|...           | Jan Kowalski / ...
brak wartości                           | –                          | –

==================================================================
CZĘŚĆ D — NA PÓŹNIEJ (nie zaczynaj)
==================================================================
API Stena + telematyka + SharePoint (słowa właściciela z notatek).
