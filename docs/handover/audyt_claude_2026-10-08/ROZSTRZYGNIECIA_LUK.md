# Rozstrzygnięcia luk w etapach audytu — wiążące dla wykonawcy

Stan: **08.10.2026, 16:05, Claude (koordynator)**, na podstawie przeglądu wszystkich etapów E1–E48 (156 luk: niejasności, sprzeczności między etapami, treści sprzed decyzji, brakujące teksty i wartości).

**Zmiana 09.10.2026, 14:11 (decyzje właściciela 09.10: E44 RIO 10:34–11:19, piloci 12:33, 13:09 — dopiski D-20261009-1233-01 i D-20261009-1309-01):** zmienione E9-2, E9-6, E18-1, L19, L29, L41, L55; nowe G-18 do G-24. Najświeższe postanowienia są nadrzędne (08.10 13:26, 14:43).

**Zmiana 09.10.2026, 01:20 (audyt kompletu, koordynator):** rozstrzygnięcia K, które zmieniały decyzje właściciela, mają z powrotem brzmienie decyzji: E7-2, E7-5, E21-1, E22-2, E23-4, L6, L13, L29, L41, L55, L56. Doprecyzowane: L15, L38. Nowe: G-13 (POD), G-14 (adres i numer testowy właściciela), G-15 (brama w jednym folderze). **Uzupełnienie 09.10.2026, 02:00 (po niezależnym przeglądzie):** L33 przywrócone do decyzji E34 B; nowe G-16 (kwoty w dokumentach) i G-17 (dane z produkcji na TEST; przepisane 02:10 po drugim przeglądzie: TEST bez danych z produkcji, próba R-1 z ROLLBACK w oknie wdrożenia, prawdziwy ślad SG-03 tylko po W25).

## Jak to działa
- **Każda luka ma rozstrzygnięcie, które wykonawca stosuje bez pytania.** Pytanie do właściciela nie zatrzymuje pracy.
- Typ rozstrzygnięcia:
  - **D** — wynika z decyzji właściciela albo z innego etapu (podane źródło);
  - **K** — domyślne rozstrzygnięcie koordynatora. Obowiązuje, dopóki właściciel go nie zmieni. Zmiana trafia do planu jako dopisek (`PLAN.md` §2), nigdy bezpośrednio do kodu. **K nie zmienia decyzji właściciela.** K rozstrzyga tylko to, czego decyzje nie mówią, albo sprzeczność między dwiema decyzjami — wtedy wiersz nazywa obie. Gdy K i decyzja się różnią, obowiązuje decyzja;
  - **W** — krok, który może zrobić tylko właściciel (dane, które zna tylko on, klucz, ustawienie w panelu usługi, pierwsza wysyłka do prawdziwych ludzi). Wykonawca przygotowuje wszystko i wpisuje pozycję do sekcji „Czeka na właściciela” w `PLAN.md`, a potem idzie dalej.
- Kolejność ważności: decyzje właściciela (`DECYZJE_08_10.md`, decyzje w raporcie) → ten plik → plik etapu → makieta etapu. **Treść etapu sprzed decyzji przegrywa z decyzją**, nawet jeśli jest w makiecie.

## A. Zasady ogólne (dotyczą wszystkich etapów)
| Nr | Luka | Rozstrzygnięcie | Typ |
|---|---|---|---|
| G-01 | Makiety w raporcie są obrazami | Źródła HTML makiet są w `makiety_html/E<nr>/`. Wymiary, kolory i teksty bierzesz z HTML; obraz `raport/img/e<nr>-after.webp` pokazuje to samo. Teksty oznaczone „Przykład” to przykłady, nie dane | K |
| G-01a (L1) | Separator „●” w makietach E25–E43 | Wszędzie „·” (U+00B7) w nazwie transportu: „SG-03 · 0005/09/S/2026”; tytuł sprawy po nazwie oddziela „—”. W `makiety_html/` separator jest już poprawiony; gdzie zostanie „●” w nazwie transportu, obowiązuje „·” | D (12:14) |
| G-01b (L12) | Zakładka „Ustalenia” w makietach i tekstach | Nazwa „Czat” we wszystkich makietach i tekstach (w `makiety_html/` poprawione) | D (E17, 07.10 20:57) |
| G-01c | CMR z załadunku, zezwolenie SE dla „Firma” w makietach E25, E30, E31, E32 | Nie ma wymogu CMR z załadunku ani jego alarmów. „Firma” = jedno zezwolenie firmowe podpięte samo; zezwolenie SE obowiązkowe tylko „na trasę” (KR) | D (12:14 pkt 8, 11) |
| G-02 | Etapy bez sekcji „Test” (E1–E7, E11) | Test odbioru = każdy punkt „Do wykonania / Propozycja” etapu ma test automatyczny (vitest albo Playwright na demo, albo zestaw bazy) + zrzut 1440 i 390 porównany z makietą. Lista testów idzie do opisu PR | K |
| G-03 | Linie „Stan: do akceptacji” w E12, E18–E23, „Otwarte” w E16 | Nieaktualne. Wszystkie etapy E1–E45 poza E44 są zdecydowane (`DECYZJE_08_10.md`, decyzje w raporcie). E44 czeka na linki podwykonawców | D *[09.10: E44 nie czeka — link RIO jest, E44 w P4 (L55, G-24)]* |
| G-04 | Kolejność paczek z `UZGODNIENIE_08_10.md` pkt 6 łamie zależności | Obowiązuje kolejność z `docs/handover/PLAN.md` (08.10 16:05). Tabela w UZGODNIENIE pkt 6 jest historyczna | K |
| G-05 | Po P1 brak aktywnych kont testowych na produkcji | Testy ról i testy na żywo tylko na bazie TEST `emkbykwenwrjmbprydml`, na kontach testowych 5 rodzajów zakładanych tam w paczce P0b. Nowe konto testowe na produkcji = STOP | D (P1) |
| G-06 | Szczegóły E18 | `paczki/P1_E18.md` (sprawdzony na produkcji 08.10 14:19–14:27) | D |
| G-07 | Tryb demo a „Podgląd bez zapisu” (E9, E37) | W buildzie demo (`VITE_AUTH_MODE=demo`, testy, podglądy) przełącznik ról działa jak dziś — pełne prawa wybranej roli na danych demo. „Podgląd: tak widzi … Nic tu nie zapiszesz” dotyczy tylko trybu supabase | K |
| G-08 | Oznaczenia demo w Opcjach i Finansach (test `etap6` O4) | Zostają tylko w buildzie demo; w produkcji nie ma danych demo (strażnik paczki) | K |
| G-09 | Przykłady z makiet w tekstach produkcji | W Pomocy, podglądach szablonów i podpowiedziach pól nie używasz kodów z `src/data/loads.json`, numerów „+48/+46” z cyframi ani daty „23.09”. Przykład: „XX-00 · 0000/00/S/2026”, „+48 …”. Strażnika paczki nie luzujesz | K |
| G-10 | Język interfejsu | Interfejs, SMS, e-maile i szablony tylko po polsku (UI tylko PL od 05.10, E43 decyzja 1). Nowe teksty bez wersji EN/SV. Polskie SMS bez ogonków | D |
| G-11 | Nazwy ekranów Opcji różnią się między E12 a etapami (L3) | Nazwy z makiet etapów merytorycznych: „Cennik i opłaty” (E16, E33), „Terminy płatności i adresy księgowości” (E40), „SMS przy miejscach” (E42), „Treści wiadomości” (E43). Grupy i kolejność z E12 pkt 1 | K |
| G-12 | Etykieta kwoty SCX: „Moja stawka” czy „Twoja stawka” (L4) | „Twoja stawka” (para z KSH „Twoja cena”) we wszystkich miejscach | K |
| G-13 | POD w E9 (prawa SCX: „CMR, POD”) i w E25 („CMR i POD dołączane do faktury”) | **POD nie ma** (decyzja 07.10 19:51, D-38; `UZGODNIENIE_08_10.md` pkt 2, wiersz D-3). Dokumenty SCX: zezwolenia, polisa, CMR z podpisem odbiorcy. Do faktury dołączany jest CMR. Słowa „POD” nie ma w aplikacji | D |
| G-14 | „Adres i numer właściciela” do testów wysyłki (L47, tryb testowy E42, `AGENTS.md` §6) | Adres e-mail `sebastian@log-mar.pl` i numer właściciela z tabeli `sms_test_numbers` — oba zapisane migracją 0176 (na produkcji także w `pilot_notify_redirect`; na TEST ta tabela może być pusta, bo dotyczy jednego transportu z produkcji). Numeru nie przepisujesz do kodu ani dokumentów — czytasz go z `sms_test_numbers`. Innych adresów ani numerów nie wpisujesz. Zmiana tylko dopiskiem | K |
| G-15 | Reguła 04.10 „gdy brama się kręci, następna pozycja planu powstaje na kolejnej gałęzi” a jeden folder (16:44) | **Na czas bramy TEST albo przebiegu w GitHub Actions (`unit` / `visual` / `db`) nie zmieniasz gałęzi ani plików i nie pushujesz nowych commitów na tę gałąź** (zielony wynik starego SHA nie liczy się dla nowego — D-86, D-87, zasada Windows pkt 4). W tym czasie czytasz etapy, makiety i testy następnej paczki i spisujesz w czacie listę zmian. Gałąź następnej paczki zakładasz po końcu bramy / po scaleniu. Bez `git worktree` i bez drugiej kopii repozytorium. (Lokalny `fresh-smoke` i lokalna pełna brama bazy zastąpione przez D-86/D-87.) | D (16:44) + K + D-86/D-87 |
| G-16 | Kwoty w dokumentach audytu (E3, E16, E33, E40, `DECYZJE_08_10.md`) a zasada „pliki poufne poza repozytorium” (konstytucja VI.4, `AGENTS.md` §5) | Kwoty w dokumentach audytu są zapisem decyzji. Do kodu aplikacji, migracji ani danych przykładowych ich nie przepisujesz — kwoty cennika tylko z bazy, wpisywane skryptem czytającym plik lokalny (`AGENTS.md` §5). Czy usunąć kwoty z dokumentów w repozytorium — decyzja właściciela (`PLAN.md` §5 W23); do niej dokumenty zostają bez zmian | K + W |
| G-17 | Testy na TEST a dane z produkcji (R-1 w P7: „TEST + raport”, „plik z 08.10 na kopii” — E38 pkt 5–6; przejazd SG-03 w P4; odtworzenie SG-03 w P8) wobec zasad: produkcja tylko przy wdrożeniu (`AGENTS.md` §3), dane osobowe w testach tylko zmyślone (`AGENTS.md` §5), pozycje GPS są danymi osobowymi (konstytucja VII) | (1) **R-1 na TEST:** kopia pliku z 08.10, w której kolumny „Imię i nazwisko kierowcy”, „Nr tel. kierowcy”, „Nr rej. ciągnika” i „Nr rej. naczepy” są zamienione na zmyślone (stała, jednoznaczna tabela zamian w skrypcie; prawdziwe wartości nie trafiają do repozytorium); zamieniony plik leży w `D:\Watch Tower\dane\`. Baza TEST nie ma transportów z produkcji, więc wszystkie wiersze HH są tam nowe; raport z TEST sprawdza test E38 pkt 6 (95 HH, 43 NTG i 15 pustych pominiętych, 0 błędów, KR-03 ze sprawą, SG-11…14 jak w pliku, 20 transportów z zasobami i numerami). Bazy TEST nie zasilasz danymi z produkcji. (2) **„Ile przed, ile po” wobec produkcji** — w oknie wdrożenia P7: próba z prawdziwym plikiem w transakcji zakończonej ROLLBACK i raport (nowe, zmienione, pominięte, sprawy; dla pliku z 08.10: 94 transporty z bazy zaktualizowane albo bez zmian + KR-03 nowy ze sprawą); potem wgranie z kopią (`PLAN.md` §1 pkt 12.1). (3) **Ślad SG-03 (P4, P8):** test na śladzie zmyślonym, który przechodzi przez te same strefy w tych samych godzinach (punkty i czasy zapisane w etapach E26, E34, E42, E45); wynik oznaczony „ślad zmyślony”. Powtórka na prawdziwych pozycjach SG-03 tylko po zgodzie właściciela (`PLAN.md` §5 W25): jednorazowa kopia czasu, współrzędnych, prędkości i zapłonu SG-03 (bez nazwisk i tablic) odczytem SELECT z produkcji na TEST tuż przed testem paczki, usunięta z TEST po teście. Kopii nie uruchamiasz w bramie ani po każdym `prep`; skrypt leży poza `tests/db/`, a połączenie z produkcją ma `default_transaction_read_only=on` | K + W (sprzeczność E38 pkt 5–6 z `AGENTS.md` §3 i §5) |
| G-18 | Zmiana dat i godzin z pliku KSH (decyzja 09.10 13:09 pkt 1) | Każda zmiana daty lub godziny załadunku albo rozładunku przy wgraniu / synchronizacji pliku → powiadomienie `PLAN_DATES_CHANGED` do HHL Administrator, HHL Operacje, SCX Dyspozytor, SCX Użytkownik (dzwonek zawsze; e-mail i push według matrycy), jedno na transport na wgranie, z „było → jest”; wpis w Historii. To samo przy zmianie KSH w Watch Tower (K). Logika i workflow bez zmian (D-12, L31, E27 pkt 1, E39, E16). Szczegóły: D-20261009-1309-01 R4 | D + K |
| G-19 | Grupowanie aut w jednej lokalizacji na mapie (decyzja 09.10 13:09 pkt 2) | Jak przy promach (E45 pkt 5): jeden znacznik z liczbą, najechanie — miejsce i nazwy transportów, kliknięcie — lista; Mapa i Kokpit. Lokalizacja = strefa E34 (załadunek, port PL, port SE, plac), bez buforów; poza strefami — W28. Szczegóły: D-20261009-1309-01 R5 | D + K |
| G-20 | Kto zmienia daty i godziny załadunku i rozładunku (decyzja 09.10 13:09 pkt 3) | Tylko KSH Użytkownik w Watch Tower i plik KSH; HHL i SCX tylko odczyt, baza odrzuca zapis innych ról; „Działaj jako” KSH — dozwolone według konstytucji VI.5, z prawdziwym wykonawcą w dzienniku (W30). Zmiana KSH w WT → plik (do 1 min), zmiana w pliku → WT (co 5 min) — po dostępie W13; do tego czasu E9-6. Komórki pliku: Data załadunku, Godzina (załadunek), Data dostawy na budowę, Godzina (rozładunek); „Dzień” z formułą bez zmian, z wartością — dzień tygodnia po angielsku. Konflikt — plik wygrywa (W29). „Data załadunku” z formułą (28 wierszy) — wartość zmieniona przez KSH zastępuje formułę, bo decyzja 13:09 jest nowsza niż „formuł nie zmienia” z 12:50 (W31). Zastępuje E38 pkt 3 „planu w pliku nie nadpisuje” i UZGODNIENIE D-33 „planu … nie zmienia”. Szczegóły: D-20261009-1309-01 R6 | D + K |
| G-21 | Polisy SCX i HHL (decyzja 09.10 13:09 pkt 4) | Dodawane raz; podpinają się same do dokumentów każdego transportu, przy którym polisa jest ważna w dniu transportu (E31; polisa SCX od zatwierdzenia przez HHL). Widoczność według E31 pyt. 3 B. Potwierdza E31 pkt 4. Szczegóły: D-20261009-1309-01 R7 | D + K |
| G-22 | Dopłaty (decyzja 09.10 13:09 pkt 5) | System liczy, nie wprowadza. HHL (część przychodowa) i SCX (część kosztowa) same decydują, czy dodać: podpowiedź w „Do zrobienia” i okno „Dopłata” z przyciskami „Dodaj” / „Nie dodaję”. Dopłata SCX wymaga akceptacji HHL; część przychodową nadal akceptuje KSH (E33). Zastępuje E33 pkt 3–4 „HHL dodaje i zatwierdza” i konstytucję III.5 w tej części. Szczegóły: D-20261009-1309-01 R8 | D + K |
| G-23 | Piloci (decyzja 09.10 12:33) i konwój KR (13:09) | D-20261009-1233-01 w całości (L29, E9-2); konwój: ci sami piloci dla wszystkich transportów KR z tą samą datą załadunku, wpisani raz (D-20261009-1309-01 R1); zmiana symbolu po wpisaniu — W26 | D + K |
| G-24 | Linki podwykonawców — RIO (decyzje 09.10 10:34, 10:54, 11:19) | E44 w całości w P4 (po E27). Przed budową regulamin RIO (`AGENTS.md` §6): robots.txt strony publicznej zakazuje automatów (E44 „Fakty”); jeśli warunki RIO wykluczają automatyczny odczyt — STOP pkt 6 (`PLAN.md` §1 pkt 12): wpis W i następna pozycja. Alarm „Źródło danych nie działa · RIO” w P4 przez dzisiejszy mechanizm (`integration_runs` + sprawa dla Administratorów HHL); w P10a RIO wchodzi na listę źródeł E23. Pole „Link śledzenia” a kompletność — L19, W27 | D + K |

## B. Etapy E1–E24
| Nr | Luka | Rozstrzygnięcie | Typ |
|---|---|---|---|
| E1-1 | Punkty trasy na makiecie a E45 bez kropek | Punkty Śrem, Gdańsk, Nynäshamn, Boden służą tylko do kadru (fitBounds); na mapie bez kropek | D (E45) |
| E1-2 | Tekst Przeglądu przed oknem śledzenia i po „Dostarczone” | Cała trasa + pasek E27 pkt 5: „Śledzenie włączy się DD.MM o 03:00 · naczepa …”; po dostawie: „Śledzenie zakończone DD.MM, GG:MM” i ślad przejazdu | K |
| E2-1 | Ścieżka KPD w `road-pl` | KPD wyłączone (D-17, rezygnacja 13:26): usuń wywołania KPD z funkcji i harmonogramu zadań; drogi PL tylko z HERE | D + K |
| E2-2 | Brak progu E23 dla dróg PL | Ten sam próg co dla dróg SE w E23 | K |
| E2-3 | ROAD_PL: zakazy czasowe a sytuacje HERE | Zakazy jako informacja przy transporcie (E7 pkt 6), sytuacje w „Sytuacji na trasie” (E7 pkt 4) | D |
| E3-1 | „Cennik i opłaty” a grupa „Pieniądze” | Ekran „Cennik i opłaty” w grupie „Pieniądze” (E12) | D |
| E3-2 | Godziny 07:15 / 09:15 / 13:15 a cron w UTC i zmiana czasu 25.10 | Godziny czasu polskiego. Zadanie uruchamiane co 15 min sprawdza godzinę Europe/Warsaw i działa tylko o wskazanych godzinach | K |
| E3-3 | Kto może „Uzupełnij” | Administrator HHL | D (E12 1A) |
| E3-4 | Termin wpisu ceny Orlen z 06.10 | Wpis jednorazowy w paczce z E3 (migracja danych z kopią), przed rozładunkiem pierwszego transportu t42 | D (07.10) |
| E4-1 | Spóźniony CMR po zamknięciu tygodnia | Faktura tygodnia obejmuje transporty zrealizowane w tym tygodniu (konstytucja IV.3). Brak CMR z podpisem blokuje wysyłkę paczki tygodnia (E40) — HHL widzi „Brak CMR: <kod>” i wysyła paczkę po uzupełnieniu | D (konst. IV.3, E40) |
| E4-2 | Stan wypłaty faktoringu | Osobne pole przy fakturze SCX: „Faktoring: zgłoszony DD.MM / wypłacony DD.MM, kwota, prowizja” obok stanu płatności | K |
| E4-3 | Zaokrąglenia „co do grosza” | Kwota pozycji (transportu) zaokrąglona do 0,01 EUR; PLN pozycji = EUR × kurs NBP tej pozycji, zaokrąglone do 0,01; netto faktury = suma pozycji; VAT 23 % od netto faktury, zaokrąglony do 0,01; brutto = netto + VAT | K |
| E4b-1 | Brak ekranu „Faktoring” w menu E12 | Ekran „Faktoring” w grupie „Pieniądze” | K |
| E4b-2 | Kto dostaje „Wypłać faktoring” | Administrator i Operacje HHL | D (E9) |
| E4b-3 | 48 h kalendarzowe czy robocze | Kalendarzowe | K |
| E5-1 | Wartości startowe „Kto co dostaje” | Start = dzisiejsze zachowanie (`notification_matrix`), **e-mail wyłączony wszędzie** (stan 08.10), dzwonek jak dziś. Włączenie e-maili i push dla prawdziwych odbiorców robi właściciel w Opcjach po wdrożeniu | K + W |
| E5-2 | Push tylko krytyczne a kanał „telefon” | Kolumna „Telefon” w matrycy = push; domyślnie włączony tylko dla zdarzeń krytycznych | K |
| E5-3 | Matryca w innej paczce niż ekran E11 | Matryca i ekran w tej samej paczce (P3 w nowym planie) | K |
| E5-4 | Definicja „Moje transporty” | Transporty, przy których użytkownik ma sprawę wziętą przez siebie („Biorę tę sprawę”) albo jest wskazany jako osoba w awizacji; jeśli takich brak — filtr pokazuje transporty firmy | K |
| E5-5 | „Wróciło” (E23) a „bez nowego wpisu” (E5) | E23 jest wyjątkiem dla alarmów źródeł danych | D |
| E6-1 | „Moje · Wszystkie” a „Moje / Moja firma / Wszystkie” | Trzy filtry z E7 | D (E7 nowszy) |
| E6-2 | Karta decyzji i wiersze kierowców PL/SE bez paczki | Karta decyzji w paczce z E7; kierowcy PL/SE w paczce z E32 | K |
| E6-3 | Imię i nazwisko: jedno pole czy dwa | Dwa pola w formularzu i w bazie (`first_name`, `last_name`); wyświetlanie „Imię Nazwisko”; `full_name` wyliczane | K |
| E6-4 | Wzór telefonu „z odstępami” | Zapis E.164; wyświetlanie PL „+48 600 000 000”, SE „+46 70 000 00 00”; przycisk „Zadzwoń” = `tel:` | K |
| E6-5 | Oddanie / przejęcie „Biorę tę sprawę” | Biorący widzi „Oddaj”; inni z tej samej firmy widzą „Przejmij” (z potwierdzeniem). Każda zmiana z wpisem w historii sprawy | K |
| E6-6 | „Moje konto” a „Dla mnie › Moje dane” | Jeden ekran „Moje konto”, otwierany z menu konta (E37); w „Dla mnie” odnośnik do niego | K |
| E7-1 | ETA_BREACH w „Do zrobienia” | Tylko dla transportów po wyjeździe (E15: przed wyjazdem „–”), jako sprawa „Opóźnienie” dla HHL i SCX | K |
| E7-2 | Zakres liczby w menu, Kokpicie i dzwonku | **Jedna liczba w menu, Kokpicie, karcie „Do zrobienia” i na dzwonku** (E7 pkt 2, decyzja 07.10 15:55): liczba otwartych spraw do zrobienia w filtrze „Moja firma” (K). Lista w dzwonku według E13 (w grupach) i E7 pkt 5. Inne wpisy na liście dzwonka nie dają osobnej liczby (K) | D + K |
| E7-3 | Zakładka „System” na Ryzykach a Stan systemu | Sprawy techniczne tylko w Opcje › System › Stan systemu (HHL). Zakładka „System” na telefonie tylko dla HHL i prowadzi tam | D (E7 pkt 7) + K |
| E7-4 | Nazwy rodzajów spraw | Z makiety E7; brakujące: RESOURCE_MISSING „Brak danych do awizacji”, ETA_BREACH „Opóźnienie”, FERRY „Prom”, ROAD_SE „Droga SE”, ROAD_PL „Droga PL”, AUTO_STATUS „Status zablokowany”, SILENT „Brak GPS”, OFF_CORRIDOR „Zjazd z trasy”, decyzje — nazwa z katalogu 16 typów po polsku. Kodu nigdy nie pokazujesz | K |
| E7-5 | PLAN 8.4 (panel alternatywnych przepraw z przeliczeniem) | W P6, przy E7 „Sytuacja na trasie” (`UZGODNIENIE_08_10.md` pkt 3). Treść z decyzji D-45 (spotkanie z SCX 29.09, pkt 19) i L-9: przy odwołaniu rejsu albo sztormie (progi pogody morskiej z Opcji › Progi alarmów, D-39) na jednej przeprawie — propozycja rejsów drugiej przeprawy (Polferries Gdańsk–Nynäshamn ↔ Stena Gdynia–Karlskrona), **tylko jeśli** na niej nie ma odwołań ani sztormu. Do trzech najbliższych odejść do Szwecji z `sailings`, liczone na żywo z bazy, bez danych stałych; brak rozkładów = „Brak danych”. Zmiana przeprawy nie wymaga nowego zezwolenia (FERRY-STATUS). Rezerwację promu robi SCX — w aplikacji bez przycisku rezerwacji | D |
| E7-6 | Stare linki `/#/decyzje/<id>` | Otwierają kartę w „Do zrobienia”; sprawa zamknięta → tekst z E37 | D |
| E7-7 | Liczba 23 to stan z 07.10 | Test liczy z reguł E7 na danych testowych | D |
| E8-1 | E8 w późnej paczce, a ekrany wcześniej | Zasady telefonu E8 (dolny pasek, karty zamiast tabel, cele ≥ 44 px) w paczce P2; każda następna paczka spełnia je od razu (D-55) | K |
| E8-2 | „9 etapów” | 10 kafelków z E28 | D |
| E8-3 | Dolny pasek i Kokpit dla KSH | Bez liczby i bez „Do zrobienia” | D (E9) |
| E9-1 | KSH widzi numery zleceń | Nie widzi żadnego numeru; baza mu ich nie wysyła | D (E41 1A) |
| E9-2 | Piloci: kto zmienia | Wpisuje SCX w awizacji (SCX Dyspozytor i SCX Użytkownik); HHL Administrator może poprawić; HHL Operacje i KSH bez zapisu; HHL, SCX i KSH widzą — tylko przy wymogu „PL + SE” (decyzja 09.10 12:33, D-20261009-1233-01). Zastępuje „Wpisuje HHL, SCX widzi” | D (09.10 12:33) |
| E9-3 | Awizacja: kto robi | SCX robi, Administrator HHL poprawia | D (E32) |
| E9-4 | Opcje dla Operacji HHL | Tylko odczyt + „Dla mnie” + eksport | D (E12 1A) |
| E9-5 | Nazwa polisy HHL | „OC przewoźnika — PZU” (według dokumentu polisy) | K |
| E9-6 | KSH zmienia daty w panelu, a plik KSH jest źródłem | **Do czasu synchronizacji z SharePoint (W13):** oba źródła działają; import zmienia datę tylko wtedy, gdy komórka w pliku zmieniła się od poprzedniego importu; zmiana z panelu KSH zostaje do następnej zmiany tej komórki w pliku. **Od synchronizacji:** zmiana KSH w Watch Tower → plik, zmiana w pliku → Watch Tower (G-20). Daty i godziny zmienia i potwierdza tylko KSH i plik (G-20). Każda zmiana z autorem i źródłem w Historii i z powiadomieniem HHL i SCX (G-18) | D (09.10 13:09) + K |
| E9-7 | Mechanizm „Podglądu” | Admin HHL wybiera konto w „Podgląd: HHL · KSH · SCX”; ekran liczy prawa tej roli, ukrywa i blokuje przyciski zapisu („Podgląd — bez zapisu”); w bazie zapisuje się zawsze jako admin. Zob. G-07 | K |
| E9-8 | Kafelek „Zezwolenia na 7 dni” po E31 | Liczy transporty „Trasa” z załadunkiem w 7 dni bez zezwolenia na trasę; „Firma” nie liczy się (zezwolenie podpięte samo) | K |
| E9-9 | Liczniki Kokpitu zależne od innych paczek | Każdy licznik powstaje w paczce, która buduje jego dane; do tego czasu zostaje dzisiejszy | K |
| E9-10 | Lista przypadków testu ról | Tabela E9 po poprawkach z E9-1 do E9-4 × 5 rodzajów kont, na TEST | D |
| E9-11 | „Ustalenia” w tabeli E9 | „Czat” | D |
| E10-1 | Zakres poprawek przy 0 trafień axe | Ta sama zasada kolorów (`--amber-ink` itd.) na wszystkich ekranach, w P2 | D |
| E11-1 | Podział E11 / E12 / E5 między paczki | Wszystkie trzy w P3 | K |
| E11-2 | Waluta w przeglądarce a w bazie | Ustawienie w bazie (profil użytkownika) | D (E16) |
| E11-3 | Nieaktywne konto z CLIENT_ADMIN | Zmienić rolę na KSH Użytkownik przed wyłączeniem roli | D |
| E12-1 | Eksport Historii zmian dla Operacji | Bez Historii zmian | D (1A) |
| E12-2 | Miejsce w menu: próg marży, kalibracja ETA, Moje konto | Próg marży: Pieniądze › Cennik i opłaty. Kalibracja ETA: Zasady transportu › Progi alarmów. Moje konto: menu konta (E37) | K |
| E12-3 | Brak pozycji 15 min w makiecie | Cisza GPS: 30 min w ruchu, 3 h na postoju | D (E15) |
| E12-4 | „Sprawdź teraz” dla Operacji | Dozwolone (nie zmienia ustawień) | K |
| E13-1 | Brak formalnej akceptacji E13 | Polecenie właściciela 07.10 14:19 + README pakietu — zdecydowane | D |
| E13-2 | Pasek telefonu przebudowany później | E13 i pasek górny E37 w tej samej paczce (P3) | K |
| E14-1 | E14 bez paczki | P3 (z E9 i E12) | K |
| E14-2 | Konto testowe KSH po P1 | Test na TEST | D |
| E15-1 | Korytarz OSM czy HERE | Geometria HERE (`here_road_geometry`), zgodnie z decyzją „prawdziwy przebieg dróg” (07.10 22:15) | D |
| E15-2 | Próg „na skraju strefy” | Do 300 m od granicy strefy; wartość w Opcjach › Progi alarmów | K |
| E15-3 | Progi słowa pewności ETA | Słowa z makiety E15: „Wysoka” — pasmo ≤ 30 min; „Średnia” — ≤ 120 min; „Niska” — powyżej (± 46 min → „Średnia”, jak w makiecie); wartości w Progach alarmów | K |
| E15-4 | Odległość 9 m w teście | Od dzisiejszego kształtu strefy (poprawka 01:28) | D |
| E15-5 | „Inne luki” wymienione przez agenta | Poza zakresem, jeśli nie ma ich w punktach „Propozycja” etapu | K |
| E15-6 | Kalibracja po 5 dostawach | Test na danych symulowanych | D |
| E15-7 | Czyszczenie starego ETA | Dane w P1; w P4 tylko kod, który nie liczy ETA przed wyjazdem | D |
| E16-1 | Makieta i test sprzed progu 4 % | Próg 4 %: dziś lista „Poniżej progu marży” jest pusta (marże 4,76–4,77 %); test: przy progu 5 % na liście są wszystkie transporty z ceną | D (12:58) |
| E16-2 | Liczby testu zmienią się po E33 | Liczyć po wdrożeniu E33 (ta sama paczka) | D |
| E17-1 | `events_insert`: zamknąć czy zawęzić | Zawęzić w paczce z E17 (nie wcześniej): przeglądarka dopisuje tylko notatki i statusy ręczne przez nową funkcję; resztę piszą funkcje bazy. Lista dozwolonych rodzajów = to, co dziś zapisuje przeglądarka (wypisz z kodu w PR). Nic, co dziś działa, nie może przestać działać — test e2e | K |
| E17-2 | Nazwy 15 rodzajów zdarzeń | Z makiety E17; brakujące — opis po polsku tego, co się stało (bez kodu); lista w PR do sprawdzenia przez koordynatora | K |
| E18-1 | „Usunąć konta” a dziennik bezpieczeństwa | Konta bez logowania, zaproszeń i powiadomień; **wiersze `app_users` 6 kont „+tower-*” usuwane z odpięciem 11 wpisów dziennika** (decyzja właściciela 09.10 13:09, W22; `paczki/P1_E18.md`, D-20261009-1309-01 R3). Zastępuje „wiersze nieaktywne” | D (P1; 09.10 13:09) |
| E18-2 | Rozbieżne liczby | Reguła progów z P1 | D |
| E18-3 | Status SG-24 | PLANNED | D (P1) |
| E19-1 | Zawężenie STATUS_* przed nowymi funkcjami statusów | Ta część razem z E17 (zob. E17-1) | K |
| E19-2 | Słabe hasła a ekran zmiany hasła | Ochrona przed wyciekniętymi hasłami i minimum 12 znaków działa przy nadaniu lub zmianie hasła; istniejących logowań nie blokuje | K |
| E19-3 | Kto włącza ustawienia logowania Supabase | Właściciel w panelu Supabase (Authentication): ochrona przed wyciekniętymi hasłami, minimum 12 znaków, „litery i cyfry”. Wykonawca przygotowuje instrukcję krok po kroku | W |
| E19-4 | Źródło kafelka „Bezpieczeństwo” | Zadanie raz dziennie zapisuje wynik doradcy Supabase „security” i stan ustawień; kafelek czyta ten zapis | K |
| E20-1 | Przyklejona 1 kolumna a „Typ” + „Wysyłka” | Układ pliku: „Typ” i „Wysyłka” (E38); widok skrócony: „Transport” (E20) | D |
| E20-2 | Test 0 px przewijania tylko dla 8 kolumn | Układ pliku: bez nakładania kolumn (E38 pkt 6); 0 px tylko w widoku skróconym | D |
| E20-3 | Pasek górny E20 a E37 | Jeden pasek według E37, w P3 | K |
| E20-4 | Zdanie o progu marży | Nieaktualne — próg 4 % | D |
| E21-1 | Od kiedy strażnik tekstów blokuje (E21 pkt 7: „wymagane 0 trafień”) | Od P2 strażnik blokuje scalenie na ekranach i kategoriach, które E21 poprawia sam („poprawki miejsc, których nie ma w innych etapach”), oraz na każdym ekranie przebudowanym w już zamkniętej paczce. Ekran, który poprawia późniejsza paczka (podział w E21: Ryzyka — E7, Finanse — E16, Dokumenty — E31 itd.), jest do jej scalenia w raporcie strażnika, a od jej scalenia blokuje. W P11 0 trafień na wszystkich ekranach (E21 pkt 8: 606 → 0). Wyjątki według E21 pkt 7 i E21-3 | D + K |
| E21-2 | „4,8%” czy „4,8 %” | „4,8%” | D (E21) |
| E21-3 | Wyjątki strażnika a numery zleceń | Dopisać numery zleceń (E41) do wyjątków | D |
| E21-4 | Liczba `toFixed` w makiecie | Według E10 (63 / 22) | D |
| E21-5 | Data UTC w Kokpicie | W zakresie pkt 1 E21 | D |
| E22-1 | Teksty: plik etapu a makieta | Makieta | D |
| E22-2 | Kryterium „tydzień bez nowych »Failed to fetch dynamically imported module«” (E22 pkt 5) | Kryterium bez zmian: 7 dni od wdrożenia P10a bez nowego wpisu tego błędu w `client_errors` (bez przeglądarek testowych). Liczy koordynator na produkcji (tylko odczyt) i zapisuje w dopisku. Odbiór P10a nie czeka 7 dni — zamyka go reszta sekcji „Test” E22; ten punkt zamyka E22 po 7 dniach. Nowy wpis w tym czasie = dopisek koordynatora z poprawką (`PLAN.md` §2 pkt 6). Data wydania a koniec tygodnia — `PLAN.md` §5 W17 | D + K |
| E22-3 | Czat poza Realtime | Mechanizm czatu bez zmian; po powrocie do karty i co 30 s odświeżenie listy | K |
| E22-4 | Makieta bez telefonu | Zasady E8 | D |
| E23-1 | Wiek danych telematyki | Źródło emtrack „nie działa”, gdy ostatni udany przebieg odczytu jest starszy niż 10 min (E23 pkt 3). Brak pozycji transportu w ruchu > 30 min to „Brak GPS” przy transporcie (E15), nie awaria źródła | D + K |
| E23-2 | Brak progów części źródeł | Tylko dla źródeł bez progu w E23 pkt 3 (kopie, bramka SMS, kurs NBP, usage-check): brak udanego odczytu dłużej niż 2 × jego okres albo 5 nieudanych prób z rzędu; drogi PL — jak drogi SE (E2-2) | K |
| E23-3 | Adresy Administratorów HHL | Konta HHL_ADMIN | D (decyzja 27 A) |
| E23-4 | ferry-weather: 8 z 24 przebiegów bez wyniku, DMI HTTP 429 | W P10a, według E23 „Dla Cursora”: najpierw dziennik funkcji Edge `ferry-weather` i `integration_runs` — przyczyna braku wyniku i odmów DMI, opis w PR; potem poprawka zgodna z E23 pkt 2–4 (odmowa DMI = „Częściowo”, jedna sprawa na źródło, próg „pogoda 3 h”). Bez nowego płatnego źródła (STOP pkt 2) | D |
| E24-1 | Komunikat zamiast szarej mapy | Tak: „Mapa się nie wczytała · Odśwież” | K |
| E24-2 | Przekierowanie pages.dev i Redirect URLs | Według decyzji 07.10 17:46 (E24 pkt 1–3) w paczce P9: 301 z `tower-hhl.pages.dev` na `tower.log-mar.pl` z tą samą ścieżką (plik przekierowań tylko w buildzie Cloudflare Pages), wpis w rejestrze, krok w procedurze wdrożenia. Usunięcie pages.dev z Redirect URLs Supabase — właściciel (W12) | D + W |
| E24-3 | „decyzja” czy „sprawa” zamknięta | Tekst z E37 | D |

## C. Etapy E25–E48
| Nr | Luka | Rozstrzygnięcie | Typ |
|---|---|---|---|
| L2 | Paczki wcześniejsze zależą od późniejszych | Nowa kolejka w `PLAN.md` (zależności rozwiązane) | K |
| L5 | E25: „CMR z załadunku zostaje wymogiem” | Brak wymogu | D (12:14 pkt 8) |
| L6 | Warunek „Gotowy” a awizacja, polisy i zezwolenia | „Gotowy” (E25: awizacja, numery HHL i SCX, zezwolenia, polisa): awizacja kompletna według E32 pkt 6 — **z pilotami, gdy wymagani** (L29). „Firma”: zezwolenie firmowe (podpięte samo) + ważna polisa OCP SCX. „Trasa” (KR): zezwolenia PL i SE na trasę + polisa SCX. Polisa HHL **nie** blokuje „Gotowy” — jej brak lub wygaśnięcie to sprawa „Do zrobienia” dla Administratora HHL | D + K |
| L7 | „Brak dokumentów” jako status i jako oznaczenie | Status 3 tylko w Przygotowaniu; po starcie przewozu — oznaczenie obok statusu | K |
| L8 | Domyślne powiadomienia o statusach | Tabela z raportu (decyzja 17:46) | D |
| L9 | „Gotowy” wymaga numerów HHL i SCX | Decyzja E25 nadpisuje dzisiejszą bramkę numerów | D |
| L10 | 71 zdarzeń z godziną o 2 h za wcześnie (01–06.10) | Historii nie poprawiamy (zmiana prawdziwych danych poza decyzją). Poprawka −2 h dotyczy nowych zapisów. SG-01: UNLOADED scalony z DELIVERED w migracji P4; datę rozładunku potwierdza Administrator HHL w nowym oknie „Zmień status” (E25 „Zasady”) | D + W |
| L11 | SG-03 po wdrożeniu P4 nadal „Na placu” | W P4 jednorazowe ustalenie fazy z pozycji (E25 „faza z pozycji jednorazowo”, test E26 pkt 7) w migracji danych z kopią: SG-03 → „Dostarczone”, czas 07.10 12:19:54 (wyjazd ze strefy „Plac budowy Stegra Boden”, źródło GPS); w tej samej migracji usunięte pozycje zapisane po dostawie (E27 pkt 4) | D + K |
| L13 | Reguły „strefa × wjazd × wyjazd” — gdzie i kto zmienia | Lista reguł po polsku w Opcjach › Automatyzacje › „Działa samo” (E35 pkt 1), z ostatnim użyciem i odnośnikiem do ustawień; na karcie strefy te same reguły. Zmienia je tylko Administrator HHL (E26 pkt 5): przez edycję strefy (E34) i własne reguły w kreatorze (E35). Lista „Działa samo” opisuje wbudowane automaty i prowadzi do ustawień (E35 pkt 1); wierszy tej listy nie edytuje się w niej samej | D |
| L14 | „Wyjazd z placu po X min — czy dostarczono?” | „Tak, dostarczono” → status „Dostarczone” z czasem wyjazdu ze strefy; „Nie” → sprawa zamknięta, status bez zmian, wpis w Historii | K |
| L15 | Dzień startu śledzenia (E27 pkt 1: „Dzień z awizacji SCX; bez awizacji — z harmonogramu KSH”) | Awizacja według E32 pkt 6 nie ma pola daty (pola: odcinki, naczepa, przepięcie, link, armator i rejs, nr SCX). Dlatego dzień załadunku bierzesz z planu KSH (`plan_load_date`, ze zmianami z panelu KSH — E9-6 — i z importu — E38). Zmiana daty przed startem przesuwa start (E27 pkt 1). Nowego pola daty w awizacji nie dodajesz. Właściciel może to zmienić dopiskiem | K (sprzeczność E27 pkt 1 i E32 pkt 6) |
| L16 | Godzina 03:00 | Stała 03:00 czasu polskiego (decyzja A, 21:43), bez ustawienia w Opcjach | K |
| L17 | Bezpiecznik „24 h po planowanej dostawie” | Liczony od godziny dostawy z pliku KSH; bez godziny — od 23:59 dnia dostawy (czas szwedzki) | K |
| L19 | Brak linku śledzenia | Sprawa „Do zrobienia” dla SCX („Dodaj link śledzenia”), otwarta do wklejenia linku („SCX zawsze musi dodać link śledzenia” — właściciel 07.10 20:57). Nie blokuje kompletności awizacji, bo kompletna awizacja według E32 pkt 6 (akceptacja właściciela 08.10 12:14) nie zawiera linku; naczepy SCX dopasowują się po rejestracji (21:51), a u podwykonawcy bez linku pozycji nie ma. Link RIO: rozpoznanie, odczyt, ważność i sprawy według E44 (G-24). E44 pkt 5 („pole wymagane przy każdej awizacji transportu podwykonawcy”) — czy brak linku ma blokować awizację i jak rozpoznać podwykonawcę: pytanie W27 (`PLAN.md` §5); do odpowiedzi obowiązuje to zdanie | K |
| L20 | Częstotliwość w nagłówku mapy | Bez deklaracji częstotliwości; godzina ostatniej pozycji w tabeli | D (E29) |
| L21 | Dymek kafelka „Prom” | Jak makieta E28 — bez dymku | K |
| L22 | Postój bez sygnału a filtr „Brak GPS” | „Brak GPS” = tylko alarm (cisza 30 min po jeździe); postój = informacja w wierszu, poza filtrem | K |
| L23 | E30: „8 kolumn domyślnie”, test 1366 px | Domyślnie układ pliku (E38 1A); test 1366 px dotyczy widoku skróconego | D |
| L24 | Makieta E30: dwa zezwolenia dla SG | SG = „Firma” → jedno zezwolenie firmowe | D |
| L25 | Nazwa polisy HHL | „OC przewoźnika — PZU” | K |
| L26 | Termin „CMR z podpisem odbiorcy” | 48 h od „Dostarczone”; wartość w Opcjach › Zasady transportu › Zezwolenia i dokumenty | K |
| L27 | Przypomnienie o polisie HHL | 14 dni przed końcem ważności do Administratorów HHL; niczego nie blokuje | K |
| L29 | Piloci a kompletna awizacja | Według D-20261009-1233-01 (decyzja 09.10 12:33): piloci są częścią awizacji SCX; sekcja tylko przy „PL + SE” (KR, PL-B), przy „BRAK” piloci nie pojawiają się w transporcie w żadnej roli i na żadnym ekranie, baza odrzuca zapis; pola: numer rejestracyjny oraz imię i nazwisko — osobno pilot PL i pilot SE; kompletna awizacja = E32 pkt 6 z obydwoma pilotami; brak = pozycja „Do zrobienia” **SCX** w sprawie awizacji („Brakuje: pilot SE — imię i nazwisko”); termin 48/12 h. Konwój KR z tego samego dnia — ci sami piloci (D-20261009-1309-01 R1). Zmiana symbolu po wpisaniu pilotów — W26. Zastępuje „Pilotów wpisuje HHL … pozycja dla HHL” | D (09.10 12:33, 13:09) + K |
| L30 | Makieta E32: CMR z załadunku, dwa zezwolenia | Bez CMR z załadunku, jedno zezwolenie firmowe | D |
| L31 | Reguła „Daty KSH do sprawdzenia” w dwóch etapach | Jedna reguła = suma warunków E32 i E38 (ten sam dzień, > 14 dni, dostawa przed załadunkiem), w imporcie i w panelu | D |
| L32 | „2 dni — pytanie 1” w makiecie cennika | 25 % | D (12:14 pkt 14) |
| L33 | Zmiana kształtu strefy a statusy | Według decyzji E34 pyt. 1 B: od razu sprawdzenie ostatniej pozycji transportów w oknie śledzenia; wjazd albo wyjazd zapisany z dopiskiem „zmiana strefy”; **statusy jak przy zwykłym wjeździe i wyjeździe** (także reguły placu E26 i L14), **bez SMS**. Test E34 pkt 8 | D |
| L35 | SMS z kreatora | Odbiorcy tylko z list „SMS przy miejscach”; treść = nowa pozycja w „Treściach wiadomości”; limit = limit bramki (150 na dobę); cisza nocna i raz na numer jak E42 | K |
| L36 | Makieta E35 bez akcji SMS | Kreator ma akcję SMS z zasadami E42 | D (12:14 pkt 19 B) |
| L37 | Ważność linku z e-maila | 24 h (E37, Supabase max 86 400 s); zaproszenie 7 dni; tekst czyta wartość z ustawień | D (E37) |
| L38 | Treści „Jak pracuję” (5 wersji) i „Co nowego” | Treści 5 wersji: `docs/handover/dopiski/D-20261009-0015-01.md` (włączony do kompletu 09.10; budujesz w P10b). „Co nowego” z opisu wdrożenia. Do wdrożenia P10b ekran ma treść z E37 pkt 1–3 bez przykładów z danymi | D (00:12) + K |
| L39 | Makieta E37: e-mail w komunikacie, 2FA | Bez e-maila w komunikacie; ekran kodu tylko dla kont z dobrowolnie włączonym 2FA | D (12:14 pkt 21, 22) |
| L40 | Pusta lista kontaktów w Pomocy | „Brak kontaktów — dane uzupełnia Administrator HHL” | K |
| L41 | Synchronizacja SharePoint | Czeka na dostęp do pliku od działu IT KSH (decyzja 12:50: „czekamy”; „automatyczna synchronizacja startuje po dostępie”) — `PLAN.md` §5 W13. Do tego czasu import ręczny, mapowanie, reguły i układ pliku (E38). Po „W13 gotowe” synchronizacja w obie strony według E38 (pyt. 2 A: Watch Tower wpisuje numery zleceń SCX i HHL do pliku) **i według decyzji 09.10 13:09: zmiana dat i godzin przez KSH w Watch Tower trafia do pliku** (G-20); bez nowej kolumny; formuł nie zmienia poza „Data załadunku” zmienioną przez KSH (W31, G-20); jako pozycja „P7 — uzupełnienie W13” (`PLAN.md` §3). Wiersze spoza filtru „Przewoźnik = HH” pomijane jak przy imporcie (L43) | D |
| L42 | Nazwy kolumn Harmonogramu | Z makiety E38 | K |
| L43 | „Wiersz TYP = STANDARD pomijany” (stare AGENTS) | Reguła E38: filtr „Przewoźnik = HH”; HH ze „Standard” w kolumnie Rozmiar → sprawa | D |
| L46 | Testy zależne od daty (t41/t42) | Testy na zamrożonych danych z datą symulowaną 07.10 | K |
| L47 | Wysyłka paczki tygodnia na prawdziwe adresy | Wykonawca testuje tylko na TEST z adresem właściciela. Pierwsza wysyłka na produkcji — właściciel | D + W |
| L49 | Kolumna języka przy odbiorcach SMS | Bez wyboru języka | D (22:42) |
| L50 | Treść SMS A i korekty | A: „{kod}: auto {rej} bedzie przy {miejsce} ok. {godzina}.” Korekta: „{kod}: korekta - auto {rej} bedzie przy {miejsce} ok. {godzina}.” (wzór jak B z E42) | K |
| L51 | Stare pozycje PLAN „SMS 6, 7, 10, 11” | Zamknięte — zastąpione przez E42 (SMS do kierowców martwe, link kierowcy wyłączony) | K |
| L53 | Treści domyślne 28 rodzajów wiadomości | Obecne polskie treści z `notifyTemplates.ts` z nazwą E41 i formatami E21; nowe teksty tam, gdzie etap je podaje | D (E43 pkt 10) |
| L54 | „Send Email Hook” wymaga klucza Management API | Krok właściciela. Do tego czasu e-maile logowania z ustawień Supabase z polskimi treściami wklejonymi przez właściciela według instrukcji wykonawcy | W |
| L55 | E44 linki podwykonawców | **09.10: link RIO jest (10:34), dane mają wchodzić automatycznie (10:54), zgody na piśmie są, nowy link na każdy przejazd (11:19).** E44 w całości w paczce P4, po E27 (`PLAN.md` §4, G-24). W14 zamknięte. Dwa linki PL/SE — zawieszone (E44) | D (09.10) |
| L56 | HERE bez odcinka promowego | Pierwszy krok E45 (P9): sprawdzenie odpowiedzi HERE na TEST dla obu przepraw. Brak odcinka „ferry” = E45 pkt 1: „powrót do właściciela przed budową” — wpis w `PLAN.md` §5 (następny wolny numer W) z odpowiedzią HERE; pkt 1 czeka na właściciela, trasa promu zostaje jak dziś. Punkty 2–5 E45 nie zależą od pkt 1 i idą dalej (`PLAN.md` §1 pkt 12: wpis i następna pozycja) | D |
| L57 | Ostatni odcinek trasy SG-03 a usuwanie pozycji po 30 dniach | Geometrię ostatnich km zapisać w bazie w paczce z E45, zanim pozycje znikną | K |
| L58 | E46–E48 i progi | Obowiązują w brzmieniu z `UZGODNIENIE_08_10.md` pkt 5 (zlecone przez właściciela 13:26) | K |
| L59 | CSP enforce i 12 częściowych wyników ASVS | Lista źródeł CSP i lista 12 pozycji do akceptacji właściciela w paczce P11 (jedna wiadomość) | W |
| L60 | Konta testowe 5 rodzajów | Zakładane na TEST w paczce P0b | K |
