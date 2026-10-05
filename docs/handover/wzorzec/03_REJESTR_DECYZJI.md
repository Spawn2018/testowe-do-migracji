# REJESTR DECYZJI — STAN KOŃCOWY

> Jedno miejsce z każdą decyzją. Status: ✅ rozstrzygnięta · ⏳ czeka · 🔁 zmieniona.

## Decyzje podstawowe (22–27.09)
| Sprawa | Decyzja | Data |
|---|---|---|
| Wygląd | identyczny z makietą w 100%, bez „AI" | 22.09 |
| Waluta | EUR wszędzie; PLN tylko w ustawieniach użytkownika | 24.09 |
| Kurs | NBP A, dzień roboczy przed rozładunkiem, każdy transport osobno | 24.09 |
| Realizacja usługi | rozładunek | 24.09 |
| Faktury | tygodniowe; HHL→KSH widzą HHL i KSH; SCX→HHL widzą HHL i SCX (wystawca); KSH nie widzi faktur SCX; terminy 30/35 dni od wystawienia. Doprecyzowane 04.10 (U-8). | 24.09 |
| Marża | z daty dostawy w harmonogramie; faktura nadrzędna | 24.09 |
| Statusy | z GPS, strefy portów PL i SE; prom = strefa + czas odejścia rejsu | 24.09 |
| Okna planu | przewoźnik nie zmienia okien planowanych | 25.09 |
| Koszt | wszystko za darmo, nigdy plan płatny | 26.09 |
| Sesja | użytkownik 365 dni, kierowca 14 dni | 26.09 |
| Domena | `tower.log-mar.pl`, zapas `tower-hhl.pages.dev` | 27.09 |
| SMS | własna bramka na telefonie z Androidem | 27.09 |
| KSeF | poza systemem na stałe | 27.09 |

## Decyzje numerowane
| ID | Sprawa | Decyzja | Status |
|---|---|---|---|
| D-1 | stawki | cenniki SCX i HHL przekazane — 12 pozycji (kwoty w plikach poufnych) | ✅ 29.09 |
| D-2 | dopłata paliwowa | załącznik SEFS z 28.09; ceny „tak, jak podaje źródło" | ✅ 29.09 |
| D-3 | retencja dokumentów | CMR, POD, zdjęcia 3 lata; PDF faktur 5 lat — **rekomendacja, czeka na potwierdzenie** | otwarta — czeka na potwierdzenie |
| D-4 | telefon i SIM | **ZAMKNIĘTE 01.10** — telefon Android + SIM są; SMS tylko do KSH (do kierowców — rezygnacja D-37); dokończenie APK = I-3-APK | ✅ 01.10 |
| D-5 | RODO | **zamknięte** — wszystkie zgody są, temat zakończony | ✅ 29.09 |
| D-6 | spotkanie z przewoźnikiem | **odbyte 29.09** — decyzje w `ZLECENIE_PO_SPOTKANIU_SCX.md` | ✅ |
| D-7 | trenowanie modeli Vercel | wyłączyć | ⏳ |
| D-8 | stawka STANDARD | „Standard" = transporty NTG, nie tężniki. Osobna stawka tężników nie obowiązuje. | obowiązuje — «Standard» = transporty NTG (potwierdzenie właściciela 04.10) |
| D-9 | czasy odcinków ETA | 7,5 h / 3 h / 18 h / 17 h / 13 h; obsada jednoosobowa; odpoczynek na promie | czasy = start kalibracji (D-85); ETA z planu usunięte (D-80) |
| D-10 | przewoźnik widzi SEFS | tak, odczyt, tylko wersje uzgodnione | ✅ |
| D-11 | 2FA administratora | włącza właściciel, dwa urządzenia | ⏳ |
| D-12 | źródło dat planu | KSH — **data i godzina** w pliku SharePoint; wyprzedzenie 5 dni | ✅ |
| D-13 | podglądy wdrożeń | zamknięte zamiennikiem | ✅ |
| D-14 | kurs NBP | pytanie do księgowej (tabela A, dzień roboczy przed rozładunkiem) | otwarta — czeka na potwierdzenie |
| D-15 | limity ponadnormatywności | zebrane, do potwierdzenia z przewoźnikiem | otwarta — czeka na potwierdzenie |
| D-16 | konta użytkowników | **zakłada właściciel w aplikacji** (partiami — limit e-maili) | ✅ 29.09 |
| D-17 | rejestracja KPD GDDKiA | rejestracja w KPD GDDKiA: najpierw firma, potem użytkownik z certyfikatem (źródło: PLAN.md §4) | ⏳ |
| D-18 | e-mail do armatora | informacja; odczyt ruszył bez zgody (decyzja 29.09) | ⏳ |
| D-19 | numer nieużyty | W rejestrze decyzji numer nie ma treści. Wzmianki „D-19" przy SMS (DEC-5, zakres pilotażu) to inna, starsza numeracja — nie ta decyzja. | numer nieużyty |
| D-21 | wymóg zezwoleń | włączyć przed pierwszym transportem | ⏳ |
| D-22 | kierowca pilota | tak | ✅ |
| D-23 | przewoźnik widzi oceny | tak, bez uwag HHL | ✅ |
| D-24 | widok placu | zamknięte decyzją 16.1 — Stegra nie jest rolą | ✅ |
| D-25 | wzorzec zrzutów | zatwierdzony z warunkiem | ✅ |
| D-26 | 36 ujęć wzorca | Propozycja z 28.09 (36 ujęć Dokumenty/Harmonogram) nie jest decyzją właściciela. Przeniesiona do pozycji roboczej III-13 i tam zamknięta (POSTEP, PLAN ETAP III). | przeniesiona do III-13, zamknięta |
| D-27 | kontrast | zatwierdzony, test ≥ 4,5:1 | ✅ |
| D-28 | serwis tras | 🔁 TomTom → HERE → własny silnik + kalibracja ucząca się. Zapis „bez HERE" nie obowiązuje. | zmieniona przez D-77 (własny silnik = zapas) |
| D-29 | reguły automatyzacji | ONE-MECH: tabela D-29t **zaakceptowana 01.10** (warunek: każdy alarm ma zastępnik); scalenie kodu w toku | ✅ tabela / ⏳ kod |
| D-30 | polisy | tak | ✅ |
| D-31 | pasek 390 px | naprawić | ✅ |
| D-32 | zgoda IT KSH (SharePoint) | Zgoda IT KSH (Graph, `Sites.Selected`, witryna STEGRABODEN). Po odpowiedzi IT: Tenant ID, Client ID i sekret do `.env.local`. Do E2: odczyt STEGRABODEN i zapis tylko do pliku testowego (źródło: PLAN.md §4) | ⏳ |
| D-33 | zapis do pliku KSH | kierowca, telefon, nr zlecenia, nr rejestracyjny | ✅ |
| D-35 | hasło bazy | **bez zmiany — ryzyko przyjęte**; unieważnienie tokenów Groka | ✅ 29.09 |
| D-34 | tydzień dopłaty paliwowej | **według mechanizmu BAF — data załadunku**. Numer w PLAN.md §4 przy kluczu Trafikverket był inną numeracją i został zmieniony na nazwę opisową. | obowiązuje |

## Ustalenia z 29.09 bez numeru
- import tylko HH z wymiarami; NTG „Standard" pomijany ✅
- konwój = liczba aut z kratownicami z tą samą datą załadunku ✅
- KSH ma identyczną dopłatę paliwową ✅
- PL o wysokości 2,60 m wyceniane jak przy 2,45 m (PL-B) ✅
- błędne daty kratownic zostają — test wykrywania zmian ✅
- odczyt komunikatów armatora — włączyć od razu ✅
- SharePoint — integracja w obie strony ✅
- przejęcie pracy przez Cursora ✅

## Decyzje po spotkaniu z przewoźnikiem (29.09) — szczegóły w `ZLECENIE_PO_SPOTKANIU_SCX.md`
| ID | Sprawa | Decyzja |
|---|---|---|
| D-36 | telematyka | emtrack.eu przez API + linki od podwykonawców; dokumentacja i przykłady — właściciel dostarczy |
| D-37 | SMS | do kierowców — rezygnacja; do KSH — **rozszerzenie 04.10.2026**: dla załadunku (Śrem) i rozładunku (Boden) jeden SMS na transport na każdy koniec trasy, gdy wyliczony czas dojazdu z bieżącej pozycji GPS do placu wynosi ≤ 60 min; HERE, gdy dostępne, w przeciwnym razie własny silnik (0122) przy wyłączonej fladze lub wyczerpanym budżecie; pierwsza pozycja bliżej niż 60 min — SMS od razu; brak GPS — brak SMS i ryzyko „brak pozycji”; SMS „wjazd na plac” bez zmian. |
| D-38 | aplikacja kierowcy | ukryta; CMR wgrywa dyspozytor; POD i zdjęcia mocowania — rezygnacja |
| D-39 | progi sztormowe | fala 3,8 m, porywy 40 węzłów — potwierdzone |
| D-40 | promy | rezerwuje i opłaca przewoźnik |
| D-41 | tranzyt | 4 dni; 5 przy ciężkiej pogodzie w Szwecji |
| D-42 | opłaty dodatkowe | wyłącznie ręcznie po uzgodnieniu; pusty przebieg — nie dotyczy |
| D-43 | faktury | EUR albo PLN, wybór przy wystawieniu; osobny kurs dla każdego transportu |
| D-44 | numery zleceń | plik KSH: **„Nr zlecenia" = przewoźnik**, **„Nr zlecenia HHL" = HHL**; przewoźnik wpisuje swój w awizacji |
| D-45 | Stena Line Gdynia – Karlskrona | pełna obsługa jak Polferries + trasa alternatywna w ryzykach. **Doprecyzowanie FERRY-STATUS 05.10.2026 (decyzja właściciela 04.10):** zezwolenia na transport ponadnormatywny obejmują dwie trasy (Gdańsk–Nynäshamn i Gdynia–Karlskrona). Przesiadka na drugą przeprawę nie wymaga nowego zezwolenia. Szczegóły: wiersz FERRY-STATUS. |
| D-46 | wybór rejsu | przewoźnik: armator → rejs → statek, listy zależne |
| D-47 | awizacja | przycisk „Dodaj" w panelu → osobne okno; **po zapisie „Edytuj"** — to samo okno z danymi |
| D-48 | godzina dostawy KSH | „najpóźniej do" |
| D-49 | logowanie | 🔁 **hasłem** (zmiana decyzji 29.09); e-mail tylko do zaproszenia i odzyskania hasła; bez e-maili dla adresów bez zaproszenia |
| D-55 | telefon | **pełna responsywność + instalacja z Chrome jako aplikacja**; czytelna i wygodna praca na telefonie |
| D-50 | pasek użytkownika | do lewego menu, z „Wyloguj" |
| D-51 | załadunki KSH | powiadomienia i strefy jak dla dostaw do Stegry |
| D-52 | administrator | wykonuje wszystko za każde konto; „Działaj jako" |
| D-53 | historia zmian | każda zmiana zapisana, szybkie śledzenie kto i co |
| D-54 | zezwolenia | automatyczne według wymiarów + ręczne na trasę. Status: część «wymiary od przewoźnika» zastąpiona przez D-83 i D-68. |
| D-56 | wzór pliku KSH | `SCRAP_transporty_…_REV_01.xlsx` — 20 kolumn, mapowanie po nazwach; transporty sprzed uruchomienia jako historyczne |
| D-57 | numer zlecenia HHL | HHL i administrator dodają i edytują samodzielnie; przewoźnik i KSH — odczyt |
| D-58 | formaty kolumn w pliku KSH | kierowca, rejestracje, oba numery zleceń — **tekst**; telefon — **liczba** |
| D-59 | nazwa i logo | **„WATCH TOWER"**; nowe logo na ekranie ładowania, favicon i ikona aplikacji na telefonie |
| D-60 | telefony | 🔁 **zawsze bez kierunkowego** (zastępuje „pełny numer międzynarodowy"); kraj numeru tylko dla bramki SMS |
| D-61 | decyzje | pełny proces: katalog 16 typów, kto decyduje, opcje ze skutkiem, terminy, eskalacja, historia |
| D-62 | powiadomienia | każde zdarzenie, zmiana statusu, ryzyko i decyzja w centrum powiadomień |
| D-63 | widoczność | administrator wybiera firmy (HHL / przewoźnik / KSH — jedna, dwie, trzy) dla każdego typu; blokady danych finansowych |
| D-64 | SMS | 2 osoby na załadunku (Śrem) i 2 na rozładunku (Boden); odbiorców wpisuje administrator. **Rozszerzenie 04.10.2026 (wspólnie z D-37):** strefa zbliżania (koło 50 km) zastąpiona SMS-em 1 h przed przyjazdem; jeden SMS na transport na każdy koniec trasy; treść: kto, nr rejestracyjny, przewidywana godzina przyjazdu. Testy SIM-1 na TEST (nie wykonywać teraz): 120 min → jeden SMS przy ≤ 60, start w 40 min → SMS od razu, brak GPS → brak SMS, powtórne pozycje → bez duplikatu; analogicznie dla Boden. |
| D-65 | ustawienia administratora | sekcje zwijane, domyślnie zwinięte; nowe: widoczność, SMS i strefy, progi, stan systemu, użytkownicy i sesje, dziennik logowań, komunikat, eksport |

## Decyzje HERE (04.10.2026) — szczegóły w `ZLECENIE_HERE.md`
| ID | Sprawa | Decyzja | Status |
|---|---|---|---|
| D-77 | HERE | HERE wchodzi do systemu. Zastępuje zapis „bez HERE" z D-28. Własny silnik zostaje jako zapas, gdy HERE jest niedostępne albo budżet wyczerpany. | ✅ 04.10.2026 |
| D-78 | budżet HERE | Do 100 USD miesięcznie. Ostrzeżenia w Stanie systemu przy 50%, 80% i 100%. Po przekroczeniu 100% system przestaje odpytywać HERE i przechodzi na darmowe wyliczenia. Nigdy nie płaci ponad budżet. **Doprecyzowanie B-MAPA 05.10.2026:** budżet wspólny dla wszystkich usług HERE, w tym kafelków i dopasowania śladów. Przy 80% mapy same przechodzą na zapasowy podkład z etykietami (miejscowości, ulice, numery dróg), nigdy na obecny szary. Powrót na HERE od 1. dnia miesiąca. Zużycie kafelków i dopasowania śladów widoczne w Stanie systemu. | ✅ 04.10.2026 |
| D-79 | aplikacja kierowcy | Zero aplikacji dla kierowców (Scandinavian Express). HERE WeGo Pro i pakiet nawigacyjny HERE SDK wykluczone. Nic nie jest instalowane u przewoźnika ani kierowców. | ✅ 04.10.2026 |
| D-80 | ETA | ETA nadal wyłącznie z pozycji GPS i AIS (decyzja z 04.10). HERE liczy czas przejazdu z bieżącej pozycji, nigdy z planu. **Doprecyzowanie ETA-PRE-LOAD 04.10.2026:** ETA dostawy pokazujemy dopiero po załadunku, czyli po wyjeździe ze strefy placu w Śremie. Przed załadunkiem we wszystkich miejscach (harmonogram, szczegóły, kokpit, eksport, e-maile) jest wyłącznie „–”, bez tekstu. SMS-KSH-1H nadal w tle liczy dojazd do Śremu. | ✅ 04.10.2026 |
| D-81 | licencja HERE | Wyniki przechowujemy najwyżej 30 dni. Na stałe wyłącznie własne podsumowania. Geometria i surowe dane HERE kasowane po 30 dniach. Warunki usługi — w `POSTEP.md` przed startem. | ✅ 04.10.2026 |
| D-82 | myto | Opłaty drogowe poza zakresem. Nie liczymy i nie pokazujemy. | ✅ 04.10.2026 |
| D-83 | wymiary zestawu | Wymiary dla każdego transportu poda właściciel. Kontrola trasy nie bierze niczego z dokumentów. Przewoźnik nie wprowadza żadnych wymiarów. | ✅ 04.10.2026 |
| D-84 | próg wiatru | Porywy 15 m/s. Silny wiatr na trasie wydłuża ETA (H-10). | ✅ 04.10.2026 |
| D-85 | ETA | W pełni automatyczne, zero ręcznego wpisu, także prędkości. Limit km/h w Opcjach nie obowiązuje. H-4 dopiero po emtrack. **20:10:** droga SE z Trafikverket w pełnym zakresie — sytuacje (wypadki, zamknięcia, roboty, ograniczenia dla ciężarówek), nawierzchnia (śnieg, lód, gołoledź), pomiary stacji (wiatr i temperatura nawierzchni; na bieżącym odcinku pomiar, dalej prognoza). Wpływ na prędkość z wytycznych, potem nauka z GPS. Osobna linia ETA „nawierzchnia”. Szczegóły w `ZLECENIE_HERE.md`. | ✅ 04.10.2026 |

## D-66–D-76 — brak w pliku źródłowym (04.10.2026)

Polecenie kazało przepisać D-66–D-76 dosłownie z `ZLECENIE_POPRAWKI_02_10.md`, z części „CZĘŚĆ 2 — NOWE DECYZJE”. W tym pliku nie ma numerów D-66–D-76 ani nagłówka „CZĘŚĆ 2 — NOWE DECYZJE” (są części A, B, C, D). Decyzji nie odtworzono i nie ponumerowano na nowo. Wersja końcowa separatora jest w części C tego zlecenia, bez numeru D-69. Status D-54 wymienia D-68, bo tak brzmi polecenie koordynatora; osobnego wiersza D-68 nie ma, dopóki źródło go nie wskaże.


## Decyzje 05.10.2026 — mapa (B-MAPA), AIS (AIS-SRC, Q-18), FERRY-STATUS i PL-DATA

| ID | Sprawa | Decyzja | Status |
|---|---|---|---|
| B-MAPA | podkład i rysowanie na mapie | Zmienia zakres H-6. Obejmuje Q-17 i Q-19. Stan: podkład Esri „World Light/Dark Gray Base”, bez nazw miast, ulic i numerów dróg, bez klas dróg, zoom max 16, błędny podpis „OpenStreetMap · CARTO”. Podkład: HERE Raster Tile API v3, styl logistyczny, jasny i ciemny z motywem, na wszystkich mapach (Mapa, kokpit, szczegóły transportu, kreator stref, odtwarzanie przebiegu). Zoom tak, by widać było plac w Śremie i w Boden. Podpis: HERE, a w zapasie właściwy dostawca. Trasa planowana z geometrii HERE, na drogach. Pozycja auta: surowy GPS, zapis bez zmian. Ślad przejazdu: HERE Route Matching tylko do rysowania; surowe pozycje nietknięte. Gdy pomiar zagrozi budżetowi — ślad z punktów i informacja w raporcie. Pozycja promu z AIS bez zmian. Trasa promu z historii AIS po torze wodnym, nigdy prosta przez ląd. Warstwa przeszkód HERE (H-6) zbudowana i wyłączona do wymiarów D-83. Przed budową pomiar na TEST i licencja zgodna z D-81 (dane HERE najwyżej 30 dni). Część B, pierwsza praca nad mapami, przed B-7a, B-7b i B-7c. Kolejność przed częścią B tego zapisu nie zmienia. | ✅ decyzja 05.10.2026 / ⏳ budowa |
| AIS-SRC | drugie źródło AIS | Pięć promów: Wawel 311852000, Nova Star 311000787, Stena Spirit, Stena Estelle, Stena Ebba. Stena Vision zeszła w 2023, listy nie rozszerzać. Digitraffic zostaje zapasem. aisstream.io tylko dla MMSI tych pięciu; MMSI Sten z danych aisstream, bez zgadywania. Dwie pozycje tego samego statku: nowsza, z zapisem źródła. Najpierw diagnoza: ostatnia pozycja w bazie wobec źródła oraz czy aisstream widzi wszystkie 5 w portach Gdańsk, Gdynia, Nynäshamn, Karlskrona i na morzu. Brak widoczności: zgłosić i zaproponować inne darmowe źródło, nie zgadywać. Klucz AISSTREAM_API_KEY jest w sekretach Edge produkcji i w .env.local; nie wypisywać. Śledzenie w tle bez zmian (obie strony). Odświeżanie: mapa nie starsza niż 5 min; powyżej 15 min znacznik wyszarzony z godziną; brak ponad 1 h — ryzyko w Stanie systemu. Pozycja w kolejce: po SMS-KSH-1H + ETA-PRE-LOAD, przed FERRY-STATUS. Punkty budowy: źródło, śledzenie, odświeżanie. **Doprecyzowanie 05.10.2026 (znalezione 04.10.2026 23:12 UTC):** trzecie źródło Sten, bez klucza, GET https://irm.stenalinefreight.com/ferries?imos=7907661,9862994,9863003 (Stena Spirit 7907661, Stena Estelle 9862994, Stena Ebba 9863003). Współrzędne wyłącznie z properties.latitude i properties.longitude; geometry.coordinates ma kolejność lat, lon i nie wolno jej używać. Czas: properties.dt_pos_utc (UTC). Odpytywanie co 3 min, jedno zapytanie na trzy statki, User-Agent z nazwą Watch Tower, cache; przy błędzie odczekać, bez pętli ponowień. Priorytet Sten: 1) Stena, 2) aisstream, 3) Digitraffic. Nowsza pozycja wygrywa, źródło jest zapisane. properties.eta (ETA statku do portu) zapisać jako dodatkowe wejście ETA promu (D-85), obok rozkładu i statusu. Adres nieopisany, zmiana formatu albo błąd: ryzyko w Stanie systemu i automatyczne przejście na aisstream oraz Digitraffic, bez błędu aplikacji. Polferries (Wawel, Nova Star) zostają przy aisstream i Digitraffic. Test: trzy Steny z pozycją nie starszą niż 5 min przez 24 h oraz symulacja błędu adresu Steny i przejście na zapas. | ✅ decyzja 05.10.2026 / ⏳ budowa |
| Q-18 | które statki na mapie | Słowa właściciela 04.10: „Na mapach mają być pokazane tylko te statki, które w danym momencie płyną do Szwecji.” Widoczny od wyjścia ze strefy portu w Polsce (Gdańsk, Gdynia) do wejścia w strefę portu w Szwecji (Nynäshamn, Karlskrona). Niewidoczny: postój w porcie i rejs do Polski. Kierunek z wyjścia ze strefy; pole destination z AIS tylko jako potwierdzenie. Mapa, kokpit, szczegóły transportu. Filtr to wyłącznie wyświetlanie. ETA (D-85), opóźnienie wypłynięcia (II-9) i alternatywy rejsu (L-9) biorą pełne dane. Razem z B-MAPA w części B, nie w budowie AIS-SRC. | ✅ decyzja 05.10.2026 / ⏳ budowa z B-MAPA |
| FERRY-STATUS | status przepraw i obie trasy | Przy D-45. Decyzja właściciela 04.10, zapis 05.10.2026: zezwolenia na transport ponadnormatywny obejmują dwie trasy (Gdańsk–Nynäshamn i Gdynia–Karlskrona). Przesiadka na drugą przeprawę nie wymaga nowego zezwolenia. Jedna pozycja planu, bez budowy w paczce SMS. Krok 0 (najpierw, raport bez budowania, wykona następny krok kolejki, nie paczka SMS): (a) pogoda morska II-8 dla Stena (Gdynia, środek, Karlskrona) i Gdańsk–Nynäshamn, ostatni odczyt ze źródłem FMI/DMI/SMHI; (b) alarmy fala 3,8 m i porywy 40 kn (D-39) — jeśli wyłączone od 02.10 „do II-3”, włączyć w kroku 3 (progi potwierdzone 29.09); (c) korytarz 0122, HERE H-1/H-3 i Trafikverket czy obejmują E22 aż do E4, panel Warunki drogowe SE obie trasy; (d) L-9 FERRY_CANCELLED czy ETA liczy całą nową trasę; (e) skąd II-5 bierze status Steny i co zwraca. Krok 1: rozkład Steny żywo. Strona https://stenalinefreight.com/timetable/GDKA, POST https://stenalinefreight.com/wp/wp-admin/admin-ajax.php, action=timetable, data[from], data[to], data[routeCode]=GDKA, security = świeży token z ajax_object na tej stronie przed każdym odczytem. Planowy i rzeczywisty odjazd/przyjazd, statek, status. Porównać z II-5: lepsze główne, drugie zapas. Co 10 min, dziś+6 dni, oba kierunki. User-Agent Watch Tower, cache, przy błędzie odczekać bez pętli. Rzeczywiste godziny → D-85 i II-9. Odwołanie → FERRY_CANCELLED. Błąd formatu → ryzyko w Stanie systemu i zapas. Krok 2: nie obchodzić 403 polferries.pl ani 503 polsca.com. Warstwy: opóźnienie z AIS (II-9), pogoda II-8 jako ostrzeżenie, formularz „Komunikat armatora” (admin i dyspozytor przewoźnika: armator, rejs, typ odwołany/opóźniony/zmiana godziny, nowa godzina, treść) ze skutkami jak status automatyczny i historią kto/kiedy. W raporcie: czy POLSCA ma e-mail dla frachtu albo inne oficjalne źródło. Krok 3: uzupełnienia z kroku 0 — pogoda w trzech punktach każdej trasy, alarmy D-39 włączone, Karlskrona–Boden E22→E4 w korytarzu, ETA, H-1/H-3 i Trafikverket, panel obie trasy, alternatywa L-9 liczy całą trasę (dojazd, rejs, droga SE, czas pracy D-85), bez ostrzeżenia o zezwoleniu przy przesiadce. Testy: odwołany rejs Steny; komunikat ręczny POLSCA; błąd źródła; fala >3,8 m; ETA alternatywy różni się o dojazd, rejs i drogę SE; panel pokazuje E22 i E4. Kolejka: po AIS-SRC, przed PL-DATA. | ✅ decyzja 05.10.2026 / ⏳ budowa |
| PL-DATA | polski wszędzie, gdzie widzi użytkownik | Decyzja 05.10.2026. Panele, ryzyka, powiadomienia, e-maile, SMS i PDF po polsku, także dane z Trafikverket, HERE, Steny, AIS i pogody. 1) HERE: pl-PL tam, gdzie API przyjmuje; brak tłumaczenia idzie do punktu 3. 2) Trafikverket: opis po polsku z pól kodowych, nie ze szwedzkiego tekstu. Pełny słownik kod→polski w repozytorium i test, że każdy kod z API ma tłumaczenie. Nieznany kod: ryzyko w Stanie systemu, w panelu „zdarzenie drogowe” po polsku, nigdy surowy szwedzki. 3) DeepL od razu, bez czekania na pomiar znaków. Klucz DEEPL_API_KEY zapisuje osobny agent (sekrety Edge i .env.local). Nie prosić właściciela. Wartości nie wypisywać. Nazwa DEEPL_API_KEY jest w sekretach Edge produkcji i w .env.local (sprawdzone 05.10.2026; wartości nie wypisywać). Test właściciela 04.10: działa, zużycie 38 / 1 000 000 znaków. Punkt 3 idzie razem z resztą PL-DATA, bez odkładania. Tekst wolny z Trafikverket i HERE, którego nie składa się po polsku z kodów: słownik zwrotów, potem pamięć tłumaczeń, potem DeepL API Free (SV/EN → PL). Każde tłumaczenie z DeepL do pamięci; ten sam tekst nigdy drugi raz. Zużycie w Stanie systemu, ostrzeżenie przy 80% limitu miesięcznego. Przy 100% albo błędzie: opis z kodów, tekst w kolejce, bez szwedzkiego w głównej treści. Oryginał tylko pod „Pokaż oryginał”. Do DeepL wyłącznie publiczne komunikaty drogowe, nigdy dane transportów, kierowców ani firm. 4) Stena i AIS: Arrived → Przypłynął, Departed → Wypłynął, odwołanie → Odwołany. Porty: PLGDY Gdynia, SEKAA Karlskrona, PLGDN Gdańsk, SENYN Nynäshamn. Nazwy statków bez zmian. 5) Pogoda FMI/DMI/SMHI: opisy i jednostki po polsku (m, węzły, m/s, °C), kierunki wiatru po polsku. 6) Przegląd UI i szablonów: lista miejsc bez tłumaczenia w raporcie, poprawki w tym samym PR. Testy: roboty drogowe po polsku bez szwedzkich słów; nieznany kod; HERE pl-PL; Departed → Wypłynął; e-mail i SMS ryzyka drogowego tylko po polsku; szwedzki → polski w panelu; drugi raz z pamięci i 0 zapytań DeepL; błąd DeepL → opis z kodów, bez błędu aplikacji. Kolejka: zaraz po FERRY-STATUS, przed VERIFY-13. Bez budowy w tym zapisie. | ✅ decyzja 05.10.2026 / ⏳ budowa |

## Decyzje 05.10.2026 07:16 — korekta Q-18, AIS dla Polferries, B-7a i B-7b

| ID | Sprawa | Decyzja | Status |
|---|---|---|---|
| Q-18 (korekta) | które statki na mapie | Zastępuje regułę z 04.10. Prom WIDOCZNY w strefie portu w Polsce (Gdańsk, Gdynia), w rejsie z Polski do Szwecji oraz w strefie portu w Szwecji (Nynäshamn, Karlskrona). Prom ZNIKA, gdy wypływa ze Szwecji do Polski (wyjście ze strefy portu w Szwecji); pojawia się ponownie po wejściu w strefę portu w Polsce. Wszystkie mapy. Pozycje w bazie bez zmian, w obie strony. Test: Gdańsk → widoczny; wypływa → widoczny; Nynäshamn → widoczny; wypływa z Nynäshamn do Polski → znika; wchodzi w strefę Gdańska → pojawia się. | ✅ decyzja 05.10.2026 07:16 / ⏳ budowa |
| AIS-SRC (Polferries) | Wawel i Nova Star z aisstream | Wawel i Nova Star nadal na Digitraffic. aisstream widział oba w teście klucza 04.10 22:54–23:04 UTC (Nova Star 54.40469 N 18.67377 E Gdańsk, Wawel 58.90557 N 17.95721 E Nynäshamn). Diagnoza i naprawa; obie jednostki z pozycją AISSTREAM nie starszą niż 5 min. Gdy funkcja Edge nie utrzyma WebSocket: krótki nasłuch co minutę albo inne rozwiązanie bez wydatków. | ✅ decyzja 05.10.2026 07:16 / ⏳ budowa |
| B-7a | rozmiar mapy | Słowa właściciela z części B wystarczą, bez czekania: mapa ma stały rozmiar, niezależny od wysokości tabeli obok; po otwarciu widoku MAPA widoczna w całości. | ✅ decyzja 05.10.2026 07:16 / ⏳ budowa |
| B-7b | checkboxy warstw | Słowa właściciela z części B wystarczą, bez czekania: checkboxy warstw zawsze widoczne; na telefonie nie nachodzą na inne elementy. | ✅ decyzja 05.10.2026 07:16 / ⏳ budowa |
| B-7c, B-8 (filtry i statusy), B-9, Q-9 | — | Czekają na właściciela. Tylko propozycja na piśmie. B-3a czeka na wymiary (D-83). | ⏳ propozycja |
