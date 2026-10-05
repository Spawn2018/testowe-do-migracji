# Lista kontrolna — Twoje poprawki z zeszytu (02.10) na produkcji

Przejdź w aplikacji tower.log-mar.pl. Odpisz tylko numery, które **NIE działają albo wyglądają inaczej**, np. „8.5, 10a.3, P10”. Pomijasz to, czego nie da się dziś sprawdzić (oznaczone ⛔).

## 1. Mapy
- **1.1** Na mapach nie ma obiektów bez prawdziwych pojazdów (tylko naczepa z SG-03 i promy)

## 2. Ryzyka
- **2.1** Widać wypłynięcia Steny
- **2.2** Widać warunki drogowe w Szwecji
- **2.3** Centrum decyzji — widać, jak działa (opis logiki)

## 3. Dokumenty
- **3.1** ⛔ Zezwolenie per firma obok polisy, automatycznie według wymiarów (czeka na wymiary)
- **3.2** Ubezpieczenie podpina się automatycznie do każdej trasy

## 4. Finanse
- **4.1** W przychodzie nie ma pilotażu ani dodatków
- **4.2** Załącznik: samo CMR, bez POD

## 5. Automatyzacje
- **5.1** Jest przycisk „Nowa automatyzacja” i da się utworzyć regułę

## 6. Opcje
- **6.1** „Jak działa” przy Powiadomieniach i decyzjach (logika i przebieg)
- **6.2** Odbiorcy SMS i strefy — opis, po co są strefy
- **6.3** Progi i terminy — opis mechanizmu
- **6.4** Stan systemu wygląda jak czytelny pulpit
- **6.5** Dziennik logowań pokazuje wpisy
- **6.6** Historia zmian — nie ma „200” obok przycisku
- **6.7** Cennik — tabela nie jest przesunięta w prawo
- **6.8** SEFS/BAF — średnie PL i SE z poprzedniego tygodnia uzupełniają się same
- **6.9** Wymóg zezwoleń — nie jest przesunięty w prawo

## 7. Mapa
- **7.1** Stały rozmiar, cała widoczna po otwarciu MAPA
- **7.2** Checkboxy zawsze widoczne; na telefonie nie wchodzą na inne elementy
- **7.3** Filtry mapy i tabeli — są nowe (brak GPS, ryzyko) i opis znaczenia

## 8. Harmonogram (tabela)
- **8.1** Nie ma kolumny „Zlecenie KSH”
- **8.2** Kolumny: „Nr zlecenia HHL-KSH” i „Nr zlecenia HHL-SCAN”
- **8.3** Przy datach załadunku i dostawy są godziny
- **8.4** Jest mechanizm zmiany ciągnika („Zmień ciągnik”)
- **8.5** Są linie pionowe w tabeli
- **8.6** Zmiana szerokości kolumn — da się zwęzić tak, że tekst się chowa
- **8.7** Brak transportów typu STANDARD
- **8.8** ETA: powyżej 24 h — dni + godz. + min; poniżej — godz. + min
- **8.9** Statusy i filtry — opis znaczenia + nowe filtry (zakres dat, bez kierowcy/ciągnika)
- **8.10** W dokumentach podpięta polisa ubezpieczeniowa
- **8.11** Wszystkie daty w tabeli z rokiem
- **8.12** Kierowca: pusty „–”; dwóch „kierowca1|kierowca2”
- **8.13** Telefon: dwóch „telefon1|telefon2”
- **8.14** Eksport PDF: zamiast promu imię i nazwisko kierowcy + telefon
- **8.15** Filtr po dacie załadunku i rozładunku

## 9. Górny pasek filtrów
- **9.1** Opis, co oznaczają i jak filtrują kafelki
- **9.2** Brak cyfr w górnym prostokącie kafelków
- **9.3** Aktywny filtr z „×” do zdjęcia + kafelek Prom

## 10. Podgląd zlecenia (kliknięcie w transport)
**10a. Górny pasek i dane**
- **10a.1** Nie ma: „Zlecenie”, „Śrem” z nadawcy, wymiarów zestawu, Nr zlecenia KSH, Montażu, Nr rezerwacji promu
- **10a.2** Jest tydzień załadunku na lewo od tygodnia dostawy
- **10a.3** HHL: przycisk „Dodaj” (kolor jak u SCX), po dodaniu „Edytuj”
- **10a.4** Użytkownik HHL (nie admin) nie może dodać awizacji
- **10a.5** Pilot: dane auta i kierowcy tylko gdy wymagany; inaczej pola nie ma
- **10a.6** Załadunek i dostawa z godzinami gg:mm
- **10a.7** Kierowcy „kier1/kier2”; bez dostarczającego „kier1/...”
- **10a.8** Brak wpisu = „nieuzupełnione”
- **10a.9** Ciągniki „1|2”; numer naczepy widoczny
- **10a.10** Telefony „1|2” bez spacji
- **10a.11** Prom: nazwa + dzień, miesiąc, rok + godzina wypłynięcia

**10b. Edycja, awizacja, przepięcie**
- **10b.1** Checkbox naczepy → przepięcie
- **10b.2** Kierowca odbierający + dostarczający; dostarczający wymagany 48 h przed dostawą
- **10b.3** Telefon i ciągnik/naczepa pojawiają się jak kierowca
- **10b.4** Pilot tylko gdy wymagany
- **10b.5** Zmiana okna czasowego załadunku i dostawy
- **10b.6** Brak pola Nr rezerwacji promu

**10c. Zakładka „Historia” (ostatnia po prawej)**
- **10c.1** Opisy: imię nazwisko // firma — dzień, miesiąc, rok — godzina (czas polski)
- **10c.2** Opisy czytelne, wytłuszczone
- **10c.3** Statusy wysłania i odczytania wiadomości z Ustaleń

**10d. Zakładka „Status” (dawniej „Przebieg”)**
- **10d.1** Wszystkie statusy i kamienie milowe z opisem jak w Historii

**10e. Dokumenty**
- **10e.1** Wygląd jak w makiecie + Twoje zmiany
- **10e.2** Brak przycisku usuwania dokumentu na dole strony

**10f. Ceny**
- **10f.1** Wygląd jak w makiecie, bez POD
- **10f.2** Waluta domyślna EUR → brak kursów w widoku (HHL widzi kursy zawsze)
- **10f.3** Dopłaty: HHL przypisuje KSH (przychód) albo SCX (koszt)
- **10f.4** KSH tylko akceptuje dopłatę HHL; po akceptacji w rozliczeniu (zakładka Ceny) i na fakturze
- **10f.5** SCX może dodać dopłatę dla HHL; HHL akceptuje; KSH nie widzi

**10g. Ustalenia**
- **10g.1** Tylko czat: kto (imię, nazwisko, firma), data, godzina
- **10g.2** „Odczytano” — kliknięcie pokazuje, kto i kiedy
- **10g.3** Powiadomienie o nowej wiadomości

## Lista harmonogramu KSH (zaloguj się jako KSH albo „Działaj jako”)
- **K.1** Kliknięcie → boczne menu tylko z „Edytuj”
- **K.2** Edycja dat i godzin załadunku i rozładunku

## Rejsy
- **R.1** Widać rejsy Steny
- **R.2** Tylko administrator dodaje i edytuje
- **R.3** Podział na przyszłe i minione + filtr „Przyszłe”
- **R.4** Daty z rokiem

## Pytania i poprawki ogólne
- **P6** Oznaczanie opłaconych faktur — tylko HHL
- **P7** W górnym pasku najbliższe wypłynięcia Steny obok Polferries
- **P8** Brak wyboru języka (nigdzie)
- **P9** Tryb jasny / według systemu, zmiana w ustawieniach
- **P10** Brak zegara w prawym górnym rogu
- **P11** Nic się nie rozjeżdża na telefonie i komputerze; tekst nie wychodzi poza sekcje
- **P11b** Powiadomienia na telefonie (Preferencje → włącz)
- **P13** Dzwonek bez „przeczytane”; pozycja znika po kliknięciu i prowadzi do celu
- **P15** Ekran logowania i ładowania: logo i napisy wyśrodkowane, bez widocznych ramek
- **P16** Kreator stref z mapą
- **P17** Trasy po drogach; trasa promu po morzu, nie przez ląd
- **P18** Promy widoczne: w porcie PL, w rejsie do SE, w porcie SE; znikają w drodze do PL
- **P19** Na mapie ulice i miejscowości

## Separator (część C)
- **C.1** Domyślnie „ / ”; „|” tylko po zaznaczeniu „Przepięcie” w awizacji, tylko w Watch Tower
