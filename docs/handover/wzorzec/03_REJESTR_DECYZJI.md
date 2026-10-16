# REJESTR DECYZJI — STAN KOŃCOWY

## Decyzje audytu 07–08.10.2026 — nadrzędne (dopisane 08.10.2026)
Właściciel, 08.10.2026 13:26: „Najświeższe ustalenia poczynione w tym czacie od samego początku są obowiązujące i nadpisują wszelkie starsze decyzje i rozwiązania.” Właściciel, 14:43: „nasze postanowienia i plik audyt watch tower są nadrzędne. Wszystko co jest starsze jest nieaktualne i nie może obowiązywać.”

- Decyzje: `docs/handover/audyt_claude_2026-10-08/DECYZJE_08_10.md` i pola „Twoje decyzje” w raporcie (`raport/index.html`); rozstrzygnięcia luk: `ROZSTRZYGNIECIA_LUK.md`; etapy: `etapy/E<nr>.md`.
- Poniższe wpisy rejestru obowiązują **tylko tam, gdzie audyt ich nie zmienia**. Wpisy zmienione mają w pierwszej kolumnie „🔁 zastąpione 08.10.2026”, zamknięte — „✅ zamknięte 08.10.2026”. Treść historyczna zostaje bez zmian.
- Odesłania w starszych wpisach do plików `ZLECENIE_*`, `SCOPE.md` i innych przeniesionych 08.10.2026 do `docs/archiwum/2026-10-08/` — tylko wiedza historyczna, nie polecenie.
- Dodatkowo od 08.10.2026: Supabase Pro (12:50), próg marży 4 % (12:58), VAT 23 % (07.10), interfejs i wiadomości tylko po polsku (E43), weryfikacja dwuetapowa dobrowolna (E37), KPD GDDKiA — rezygnacja (13:26), adresy księgowości HHL `ksiegowosc@hhlogistics.pl` i KSH `faktury@ksh.pl` (13:26).

### Zmiany 09.10.2026 (decyzje właściciela 10:34–11:19, 12:33, 13:09; nadrzędne wobec wierszy niżej)
| Wpis | Było | Obowiązuje od 09.10.2026 |
|---|---|---|
| D-12, D-33 | daty KSH z pliku; do pliku tylko zasoby i numery („planu … nie zmienia”) | daty i godziny załadunku i rozładunku zmienia i potwierdza tylko KSH (w Watch Tower) i plik; synchronizacja w obie strony po dostępie W13 (`ROZSTRZYGNIECIA_LUK.md` G-20); każda zmiana z pliku → powiadomienie HHL i SCX (G-18) |
| D-18 | e-mail do armatora ⏳ | ✅ zamknięte 09.10.2026: właściciel ma zgody wszystkich armatorów |
| D-30 | polisy (E31 3B) | + dodawane raz, podpinają się same do dokumentów każdego transportu, przy którym są ważne w dniu transportu (G-21) |
| D-42 | E33: system liczy, HHL dodaje i zatwierdza | system liczy i podpowiada; HHL i SCX same decydują, czy dodać; dopłatę SCX akceptuje HHL; część przychodową akceptuje KSH (G-22) |
| piloci (E32, E9), D-22 | wpisuje HHL; pola: firma, rejestracja, kierowca, telefon; D-22 „kierowca pilota: tak” | wpisuje SCX w awizacji; pola: numer rejestracyjny, imię i nazwisko; tylko przy „PL + SE”; konwój KR — ci sami piloci (G-23) |
| E44 / D-TELM-ETA — część „linki podwykonawców” | czeka na linki | link RIO jest; odczyt automatyczny według E44 w P4 (G-24). Część D-TELM-ETA „oficjalne API emtrack” nadal czeka (`PLAN.md` §5 W15) |
| grupowanie na mapie | tylko auta na promie (E45) | także auta w jednej lokalizacji (G-19) |

### Decyzja właściciela 13.10.2026, 15:31 i 15:43 — wzorzec wyglądu
| ID | Sprawa | Decyzja | Status |
|---|---|---|---|
| WYGLAD-RAPORT | wzorzec wyglądu całej aplikacji | Wygląd całej aplikacji, na komputerze i na telefonie = raport audytu (`raport/index.html` + `raport/img/`) z najnowszymi decyzjami właściciela. Każda paczka pokazuje to dowodem, koordynator sprawdza | ✅ |

### Decyzja właściciela 13.10.2026, 18:27 — podział pracy
| ID | Sprawa | Decyzja | Status |
|---|---|---|---|
| FRONT-KOORDYNATOR | kto robi wygląd (frontend) | Wygląd (frontend) robi koordynator na gałęziach `wyglad/*`; Cursor podłącza dane, logikę i bazę, scala i wdraża (D-20261013-1835-01) | ✅ |

### Wpisy zastąpione albo zamknięte (z `UZGODNIENIE_08_10.md` pkt 2; numery linii dotyczą wersji rejestru z 07.10.2026)
| Wpis (linia) | Dziś w rejestrze | Obowiązuje |
|---|---|---|
| Wygląd (l. 8) | identyczny z makietą w 100% | makieta etapu audytu (raport v62) ma pierwszeństwo przed `claude-v2.0`; wzorce bramy wizualnej odświeżane po akceptacji właściciela |
| Koszt (l. 16) | wszystko za darmo, nigdy plan płatny | wyjątki: HERE do 100 USD/mies. (D-77, D-78), **Supabase Pro** (08.10 12:50) |
| Marża (l. 13) | z daty dostawy; faktura nadrzędna | + flaga zbyt niskiej marży: **próg 4 %** w Opcjach (E16, 08.10 12:58); progi 12 % i 18 % z kodu znikają |
| D-3 (l. 27, 178) | CMR, POD, zdjęcia 3 lata; PDF faktur 5 lat | CMR 3 lata, PDF faktur 5 lat; **POD i zdjęć nie ma** (07.10 19:51, D-38) |
| D-7 (l. 31) | ⏳ wyłączyć trening Vercel | **zamknięte** — wyłączone (właściciel 07.10) |
| D-11 (l. 35) | 2FA administratora ⏳ | **dobrowolne** dla wszystkich (E37 1C) |
| D-12 (l. 36) | daty KSH, wyprzedzenie 5 dni | bez zmian; próg nazywa się „Potwierdzenie daty — 5 dni przed załadunkiem” (E12) |
| D-14 (l. 38) | kurs NBP — otwarta | **zamknięte**: NBP tabela A z dnia roboczego przed rozładunkiem (07.10); przed rozładunkiem ostatni kurs z dopiskiem „kurs bieżący” (E16) |
| D-15 (l. 39) | limity — otwarta | **zamknięte** (tabela wymiarów 07.10) |
| D-17 (l. 41) | KPD GDDKiA ⏳ | **rezygnacja** (08.10 13:26) |
| D-21 (l. 44) | włączyć wymóg zezwoleń przed pierwszym transportem | E31: zezwolenie „Firma” podpina się samo do każdego transportu i nie ma dalszych wymagań; zezwolenie SE obowiązkowe tylko „na trasę” (KR) |
| D-30 (l. 53) | polisy tak | E31 3B: KSH widzi tylko polisę HHL, SCX tylko swoją, HHL obie |
| D-32 (l. 55) | zgoda IT KSH ⏳ | bez zmian — czeka (dostęp nada dział IT KSH); zakres według E38 |
| D-33 (l. 56) | do pliku KSH: kierowca, telefon, nr zlecenia, nr rejestracyjny | E38: kierowcy, telefony, ciągniki (PL / SE jako „A / B”), naczepa, numer SCX („HHL-Scan”), numer HHL („HHL-KSH”); bez nowej kolumny; planu i komórek z formułą nie zmienia |
| D-37, D-64 (l. 76, 103) | SMS 1 h przed przyjazdem, 2 + 2 osoby | E42: 4 rodzaje A–D, cisza nocna 20:00–06:00, raz na numer, tryb testowy (3 transporty); E35: kreator może wysyłać SMS tylko z tymi zasadami |
| D-42 (l. 81) | opłaty dodatkowe wyłącznie ręcznie | E33: system liczy i podpowiada kwotę, HHL dodaje i zatwierdza (część przychodową akceptuje KSH); postój 750 EUR/doba albo 75 EUR/h (6 h / 4 h wolne); anulowanie % frachtu bez opłaty paliwowej, 2 dni = 25 % |
| D-44 (l. 83) | „Nr zlecenia” = przewoźnik, „Nr zlecenia HHL” = HHL | E38: „Nr zlecenia HHL-Scan” = SCX, „Nr zlecenia HHL-KSH” = HHL; E41: KSH bez numerów, SCX widzi numer HHL tylko do odczytu, nazwa „kod · numer” |
| D-50 (l. 90) | pasek użytkownika w lewym menu z „Wyloguj” | E37: konto, Moje konto i Wyloguj po prawej w pasku górnym |
| D-54 (l. 94) | zezwolenia automatyczne według wymiarów + ręczne na trasę | E31: rodzaj według tabeli wymiarów (Firma / Trasa); zezwolenie na firmę podpina się samo do każdego transportu; zezwolenie SE obowiązkowe tylko wtedy, gdy wydawane jest na trasę |
| D-57 (l. 96) | numer zlecenia HHL: dodaje HHL; przewoźnik i KSH — odczyt | E41: KSH nie widzi żadnego numeru (baza nic mu nie wysyła); SCX widzi numer HHL tylko do odczytu; edytuje HHL |
| D-56 (l. 95) | wzór pliku KSH, 20 kolumn | E38: plik z SharePoint 08.10, 21 kolumn, mapowanie i kierunki według E38 |
| D-58 (l. 97) | telefon w pliku jako liczba | E38: zapis w formacie pliku; przy przepięciu dwa numery jako „A / B” |
| D-60 (l. 99) | telefony zawsze bez kierunkowego | konta użytkowników: format międzynarodowy (E6); kierowcy: numer + kraj jak dziś w Awizacji |
| D-61 (l. 100) | proces decyzji, 16 typów | E7: jedna lista „Do zrobienia”, katalog po polsku, „Decyzja po terminie” nie jako awaria techniczna (E7 pkt 10); E6: karta decyzji, „Biorę tę sprawę”, „Zadzwoń” |
| D-62 (l. 101) | każde zdarzenie i ryzyko w centrum powiadomień | E5 (07.10 13:21) i E7 pkt 5: promy i drogi bez transportu tylko na stronie Ryzyka, bez dzwonka; przy transporcie tylko to, co przed pojazdem |
| D-63 (l. 102) | administrator wybiera firmy dla każdego typu | doprecyzowane E11 („Kto co dostaje”: zdarzenie × 5 rodzajów kont × kanał) i E31 3B (polisy) |
| D-65 (l. 104) | ustawienia: sekcje zwijane | E11/E12: 6 grup, menu boczne, 13 ekranów; Operacje HHL tylko odczyt + „Dla mnie” + eksport |
| B-7c (l. 142, 163) | filtry mapy: brak GPS, ryzyko | E29: Opóźnione, Brak GPS, Bez pozycji; tabela pod mapą = transporty w oknie śledzenia |
| B-8 (l. 142, 164) | zakres dat, bez kierowcy/ciągnika, „Zmień ciągnik” | E30: filtry E28 + tydzień; zmiana zestawu **tylko w oknie Awizacja** (E32); Harmonogram w układzie pliku (E38 1A) |
| B-9 (l. 142, 165) | pasek filtrów, kafelek Prom | E28: 10 kafelków według statusów E25, jeden filtr |
| B-5 (l. 148) | kreator, SMS według zasad stref | E35 1B: SMS z zasadami E42 |
| H-8 (l. 170) | profil trasy teraz | E17: profil ukryty; E18 P16: `route-profile` i `load_route_profiles` do usunięcia |
| PALIWO-AUTO krok A (l. 149, 158) | OKQ8 „Q8 Trucks” 22,90 | już zastąpione w samym rejestrze (l. 59: OKQ8 GoEasy Diesel firmowa) → usunąć sprzeczne wiersze; E39 bez zmian |
| Ustalenia 29.09 (l. 63, 67) | import tylko HH; błędne daty kratownic zostają | E38: filtr „Przewoźnik = HH”; transport z dostawą przed załadunkiem (KR-03) **nie jest odrzucany**, dostaje sprawę „Daty KSH do sprawdzenia” (12:50) |

Wpisy nie wymienione obowiązują bez zmian (m.in. D-9, D-34 z doprecyzowaniami, D-36, D-38–D-41, D-43, D-45–D-49, D-52, D-53, D-55, D-59, D-77–D-85, AIS-SRC, FERRY-STATUS, PL-DATA, Q-18 korekta, Q-9, Q-11b, CSP-RO, ZAP-NODE, ETA-MARK, H-4).

---


> Jedno miejsce z każdą decyzją. Status: ✅ rozstrzygnięta · ⏳ czeka · 🔁 zmieniona.

## Decyzje podstawowe (22–27.09)
| Sprawa | Decyzja | Data |
|---|---|---|
| Wygląd — 🔁 zastąpione 08.10.2026, zob. decyzje audytu | identyczny z makietą w 100%, bez „AI" | 22.09 |
| Waluta | EUR wszędzie; PLN tylko w ustawieniach użytkownika | 24.09 |
| Kurs | NBP A, dzień roboczy przed rozładunkiem, każdy transport osobno | 24.09 |
| Realizacja usługi | rozładunek | 24.09 |
| Faktury | tygodniowe; HHL→KSH widzą HHL i KSH; SCX→HHL widzą HHL i SCX (wystawca); KSH nie widzi faktur SCX; terminy 30/35 dni od wystawienia. Doprecyzowane 04.10 (U-8). | 24.09 |
| Marża — 🔁 zastąpione 08.10.2026, zob. decyzje audytu | z daty dostawy w harmonogramie; faktura nadrzędna | 24.09 |
| Statusy | z GPS, strefy portów PL i SE; prom = strefa + czas odejścia rejsu | 24.09 |
| Okna planu | przewoźnik nie zmienia okien planowanych | 25.09 |
| Koszt — 🔁 zastąpione 08.10.2026, zob. decyzje audytu | wszystko za darmo, nigdy plan płatny | 26.09 |
| Sesja | użytkownik 365 dni, kierowca 14 dni | 26.09 |
| Domena — 🔁 zastąpione 08.10.2026 (E24, 07.10 17:46: `tower-hhl.pages.dev` przekierowuje na `tower.log-mar.pl`) | `tower.log-mar.pl`, zapas `tower-hhl.pages.dev` | 27.09 |
| SMS | własna bramka na telefonie z Androidem | 27.09 |
| KSeF | poza systemem na stałe | 27.09 |

## Decyzje numerowane
| ID | Sprawa | Decyzja | Status |
|---|---|---|---|
| D-1 | stawki | cenniki SCX i HHL przekazane — 12 pozycji (kwoty w plikach poufnych) | ✅ 29.09 |
| D-2 | dopłata paliwowa | załącznik SEFS z 28.09; ceny „tak, jak podaje źródło" | ✅ 29.09 |
| D-3 — 🔁 zastąpione 08.10.2026, zob. decyzje audytu | retencja dokumentów | CMR, POD, zdjęcia **3 lata**; PDF faktur **5 lat** — **zatwierdzone właściciel 05.10 ~13:53**; I-7 kierowca bez zmian | ✅ 05.10.2026 |
| D-4 | telefon i SIM | **ZAMKNIĘTE 01.10** — telefon Android + SIM są; SMS tylko do KSH (do kierowców — rezygnacja D-37); dokończenie APK = I-3-APK | ✅ 01.10 |
| D-5 | RODO | **zamknięte** — wszystkie zgody są, temat zakończony | ✅ 29.09 |
| D-6 | spotkanie z przewoźnikiem | **odbyte 29.09** — decyzje w `ZLECENIE_PO_SPOTKANIU_SCX.md` | ✅ |
| D-7 — ✅ zamknięte 08.10.2026 | trenowanie modeli Vercel | wyłączyć | ⏳ |
| D-8 | stawka STANDARD | „Standard" = transporty NTG, nie tężniki. Osobna stawka tężników nie obowiązuje. | obowiązuje — «Standard» = transporty NTG (potwierdzenie właściciela 04.10) |
| D-9 | czasy odcinków ETA | 7,5 h / 3 h / 18 h / 17 h / 13 h; obsada jednoosobowa; odpoczynek na promie | czasy = start kalibracji (D-85); ETA z planu usunięte (D-80) |
| D-10 | przewoźnik widzi SEFS | tak, odczyt, tylko wersje uzgodnione | ✅ |
| D-11 — 🔁 zastąpione 08.10.2026, zob. decyzje audytu | 2FA administratora | włącza właściciel, dwa urządzenia | ⏳ |
| D-12 — 🔁 zastąpione 08.10.2026, zob. decyzje audytu | źródło dat planu | KSH — **data i godzina** w pliku SharePoint; wyprzedzenie 5 dni | ✅ |
| D-13 | podglądy wdrożeń | zamknięte zamiennikiem | ✅ |
| D-14 — ✅ zamknięte 08.10.2026 | kurs NBP | pytanie do księgowej (tabela A, dzień roboczy przed rozładunkiem) | otwarta — czeka na potwierdzenie |
| D-15 — ✅ zamknięte 08.10.2026 | limity ponadnormatywności | zebrane, do potwierdzenia z przewoźnikiem | otwarta — czeka na potwierdzenie |
| D-16 | konta użytkowników | **zakłada właściciel w aplikacji** (partiami — limit e-maili) | ✅ 29.09 |
| D-17 — ✅ zamknięte 08.10.2026 | rejestracja KPD GDDKiA | rejestracja w KPD GDDKiA: najpierw firma, potem użytkownik z certyfikatem (źródło: PLAN.md §4) | ⏳ |
| D-18 — ✅ zamknięte 09.10.2026 (zgody wszystkich armatorów są) | e-mail do armatora | informacja; odczyt ruszył bez zgody (decyzja 29.09) | ✅ |
| D-19 | numer nieużyty | W rejestrze decyzji numer nie ma treści. Wzmianki „D-19" przy SMS (DEC-5, zakres pilotażu) to inna, starsza numeracja — nie ta decyzja. | numer nieużyty |
| D-21 — 🔁 zastąpione 08.10.2026, zob. decyzje audytu | wymóg zezwoleń | włączyć przed pierwszym transportem | ⏳ |
| D-22 | kierowca pilota | tak *[09.10.2026: pola pilota tylko numer rejestracyjny oraz imię i nazwisko — D-20261009-1233-01; wyżej „Zmiany 09.10.2026”]* | ✅ |
| D-23 | przewoźnik widzi oceny | tak, bez uwag HHL | ✅ |
| D-24 | widok placu | zamknięte decyzją 16.1 — Stegra nie jest rolą | ✅ |
| D-25 | wzorzec zrzutów | zatwierdzony z warunkiem | ✅ |
| D-26 | 36 ujęć wzorca | Propozycja z 28.09 (36 ujęć Dokumenty/Harmonogram) nie jest decyzją właściciela. Przeniesiona do pozycji roboczej III-13 i tam zamknięta (POSTEP, PLAN ETAP III). | przeniesiona do III-13, zamknięta |
| D-27 | kontrast | zatwierdzony, test ≥ 4,5:1 | ✅ |
| D-28 | serwis tras | 🔁 TomTom → HERE → własny silnik + kalibracja ucząca się. Zapis „bez HERE" nie obowiązuje. | zmieniona przez D-77 (własny silnik = zapas) |
| D-29 | reguły automatyzacji | ONE-MECH: tabela D-29t **zaakceptowana 01.10** (warunek: każdy alarm ma zastępnik); scalenie kodu w toku | ✅ tabela / ⏳ kod |
| D-30 — 🔁 zastąpione 08.10.2026, zob. decyzje audytu | polisy | tak | ✅ |
| D-31 | pasek 390 px | naprawić | ✅ |
| D-32 — 🔁 zastąpione 08.10.2026, zob. decyzje audytu | zgoda IT KSH (SharePoint) | Zgoda IT KSH (Graph, `Sites.Selected`, witryna STEGRABODEN). Po odpowiedzi IT: Tenant ID, Client ID i sekret do `.env.local`. Do E2: odczyt STEGRABODEN i zapis tylko do pliku testowego (źródło: PLAN.md §4) | ⏳ |
| D-33 — 🔁 zastąpione 08.10.2026, zob. decyzje audytu | zapis do pliku KSH | kierowca, telefon, nr zlecenia, nr rejestracyjny | ✅ |
| D-35 | hasło bazy | **bez zmiany — ryzyko przyjęte**; unieważnienie tokenów Groka | ✅ 29.09 |
| D-34 | tydzień dopłaty paliwowej | **według mechanizmu BAF — data załadunku**. Numer w PLAN.md §4 przy kluczu Trafikverket był inną numeracją i został zmieniony na nazwę opisową. | obowiązuje |
| D-2 / D-34 (05.10 ~21:48, uzup. ~21:51) | BAF — produkt i średnia (zał. 1 pkt 3 SEFS_KSH_Stegra_v2) | **SEK = OKQ8 GoEasy Diesel, cena listowa dla klientów firmowych** (kolumna „Diesel” w foretagspriser-RRRR-MM-DD.xlsx, okq8.se/foretag/priser/; wartość wprost; kontrola 05.10 = 22,29). **NIE Q8 Trucks** — decyzja z 05.10 rano zastąpiona. **Średnia = średnia arytmetyczna z cen OPUBLIKOWANYCH** w pełnym poprzednim tygodniu pn–nd (każda publikacja raz; kopie z dni bez publikacji nie wchodzą); tydzień bez publikacji → ostatnia opublikowana cena; zaokrąglenie 2 miejsca, „do X” włącznie, niższy z dwóch. Data publikacji przy każdym odczycie (SEK i PLN od 21.09). Mnożnik **ostateczny** dopiero po zamknięciu poprzedniego tygodnia (po niedzieli, Europe/Warsaw), wcześniej **wstępny**; ostateczny = migawka przy transporcie (0166). Parametry z wersji obowiązującej w tygodniu załadunku (valid_from). Wzorce: tydz. 40 (21–27.09) = **1,14**, tydz. 41 (28.09–04.10) = **1,13** (właściciel). Migracja 0187. | obowiązuje |
| D-2 / D-34 (06.10 ~00:12) | BAF — PROGNOZA przyszłych tygodni | Gdy poprzedni tydzień załadunku **nie jest zamknięty** (po niedzieli Europe/Warsaw): mnożnik = **ostatni OSTATECZNY** (nie średnia z niepełnych publikacji), status **PROGNOZA**, etykieta „prognoza” w Cenach i Finansach. Po zamknięciu → OSTATECZNY + migawka (0166). Każde zamknięcie/odświeżenie przelicza PROGNOZA. Migracja **0189**. | obowiązuje |

## Ustalenia z 29.09 bez numeru
- 🔁 zastąpione 08.10.2026 (E38): import tylko HH z wymiarami; NTG „Standard" pomijany ✅
- konwój = liczba aut z kratownicami z tą samą datą załadunku ✅
- KSH ma identyczną dopłatę paliwową ✅
- PL o wysokości 2,60 m wyceniane jak przy 2,45 m (PL-B) ✅
- 🔁 zastąpione 08.10.2026 (E38): błędne daty kratownic zostają — test wykrywania zmian ✅
- odczyt komunikatów armatora — włączyć od razu ✅
- SharePoint — integracja w obie strony ✅
- przejęcie pracy przez Cursora ✅

## Decyzje po spotkaniu z przewoźnikiem (29.09) — szczegóły w `ZLECENIE_PO_SPOTKANIU_SCX.md`
| ID | Sprawa | Decyzja |
|---|---|---|
| D-36 | telematyka | Warstwy: API → **TELM-EMTRACK-WEB** (zapas, LIVE 05.10 GD035YX) → linki podwykonawców. Blokada SMS/e-mail tylko właściciel do odwołania (test prod przed R-0). Dokumentacja oficjalnego API — właściciel | ✅ zapas web 05.10 / ⏳ oficjalne API |
| D-37 — 🔁 zastąpione 08.10.2026, zob. decyzje audytu | SMS | do kierowców — rezygnacja; do KSH — **rozszerzenie 04.10.2026**: dla załadunku (Śrem) i rozładunku (Boden) jeden SMS na transport na każdy koniec trasy, gdy wyliczony czas dojazdu z bieżącej pozycji GPS do placu wynosi ≤ 60 min; HERE, gdy dostępne, w przeciwnym razie własny silnik (0122) przy wyłączonej fladze lub wyczerpanym budżecie; pierwsza pozycja bliżej niż 60 min — SMS od razu; brak GPS — brak SMS i ryzyko „brak pozycji”; SMS „wjazd na plac” bez zmian. |
| D-38 | aplikacja kierowcy | ukryta; CMR wgrywa dyspozytor; POD i zdjęcia mocowania — rezygnacja |
| D-39 | progi sztormowe | fala 3,8 m, porywy 40 węzłów — potwierdzone |
| D-40 | promy | rezerwuje i opłaca przewoźnik |
| D-41 | tranzyt | 4 dni; 5 przy ciężkiej pogodzie w Szwecji |
| D-42 — 🔁 zastąpione 08.10.2026, zob. decyzje audytu | opłaty dodatkowe | wyłącznie ręcznie po uzgodnieniu; pusty przebieg — nie dotyczy |
| D-43 | faktury | EUR albo PLN, wybór przy wystawieniu; osobny kurs dla każdego transportu |
| D-44 — 🔁 zastąpione 08.10.2026, zob. decyzje audytu | numery zleceń | plik KSH: **„Nr zlecenia" = przewoźnik**, **„Nr zlecenia HHL" = HHL**; przewoźnik wpisuje swój w awizacji |
| D-45 | Stena Line Gdynia – Karlskrona | pełna obsługa jak Polferries + trasa alternatywna w ryzykach. **Doprecyzowanie FERRY-STATUS 05.10.2026 (decyzja właściciela 04.10):** zezwolenia na transport ponadnormatywny obejmują dwie trasy (Gdańsk–Nynäshamn i Gdynia–Karlskrona). Przesiadka na drugą przeprawę nie wymaga nowego zezwolenia. Szczegóły: wiersz FERRY-STATUS. |
| D-46 | wybór rejsu | przewoźnik: armator → rejs → statek, listy zależne |
| D-47 | awizacja | przycisk „Dodaj" w panelu → osobne okno; **po zapisie „Edytuj"** — to samo okno z danymi |
| D-48 | godzina dostawy KSH | „najpóźniej do" |
| D-49 | logowanie | 🔁 **hasłem** (zmiana decyzji 29.09); e-mail tylko do zaproszenia i odzyskania hasła; bez e-maili dla adresów bez zaproszenia |
| D-55 | telefon | **pełna responsywność + instalacja z Chrome jako aplikacja**; czytelna i wygodna praca na telefonie |
| D-50 — 🔁 zastąpione 08.10.2026, zob. decyzje audytu | pasek użytkownika | do lewego menu, z „Wyloguj" |
| D-51 | załadunki KSH | powiadomienia i strefy jak dla dostaw do Stegry |
| D-52 | administrator | wykonuje wszystko za każde konto; „Działaj jako" |
| D-53 | historia zmian | każda zmiana zapisana, szybkie śledzenie kto i co |
| D-54 — 🔁 zastąpione 08.10.2026, zob. decyzje audytu | zezwolenia | automatyczne według wymiarów + ręczne na trasę. Status: część «wymiary od przewoźnika» zastąpiona przez D-83 i D-68. |
| D-56 — 🔁 zastąpione 08.10.2026, zob. decyzje audytu | wzór pliku KSH | `SCRAP_transporty_…_REV_01.xlsx` — 20 kolumn, mapowanie po nazwach; transporty sprzed uruchomienia jako historyczne |
| D-57 — 🔁 zastąpione 08.10.2026, zob. decyzje audytu | numer zlecenia HHL | HHL i administrator dodają i edytują samodzielnie; przewoźnik i KSH — odczyt |
| D-58 — 🔁 zastąpione 08.10.2026, zob. decyzje audytu | formaty kolumn w pliku KSH | kierowca, rejestracje, oba numery zleceń — **tekst**; telefon — **liczba** |
| D-59 | nazwa i logo | **„WATCH TOWER"**; nowe logo na ekranie ładowania, favicon i ikona aplikacji na telefonie |
| D-60 — 🔁 zastąpione 08.10.2026, zob. decyzje audytu | telefony | 🔁 **zawsze bez kierunkowego** (zastępuje „pełny numer międzynarodowy"); kraj numeru tylko dla bramki SMS |
| D-61 — 🔁 zastąpione 08.10.2026, zob. decyzje audytu | decyzje | pełny proces: katalog 16 typów, kto decyduje, opcje ze skutkiem, terminy, eskalacja, historia |
| D-62 — 🔁 zastąpione 08.10.2026, zob. decyzje audytu | powiadomienia | każde zdarzenie, zmiana statusu, ryzyko i decyzja w centrum powiadomień |
| D-63 — 🔁 zastąpione 08.10.2026, zob. decyzje audytu | widoczność | administrator wybiera firmy (HHL / przewoźnik / KSH — jedna, dwie, trzy) dla każdego typu; blokady danych finansowych |
| D-64 — 🔁 zastąpione 08.10.2026, zob. decyzje audytu | SMS | 2 osoby na załadunku (Śrem) i 2 na rozładunku (Boden); odbiorców wpisuje administrator. **Rozszerzenie 04.10.2026 (wspólnie z D-37):** strefa zbliżania (koło 50 km) zastąpiona SMS-em 1 h przed przyjazdem; jeden SMS na transport na każdy koniec trasy; treść: kto, nr rejestracyjny, przewidywana godzina przyjazdu. Testy SIM-1 na TEST (nie wykonywać teraz): 120 min → jeden SMS przy ≤ 60, start w 40 min → SMS od razu, brak GPS → brak SMS, powtórne pozycje → bez duplikatu; analogicznie dla Boden. |
| D-65 — 🔁 zastąpione 08.10.2026, zob. decyzje audytu | ustawienia administratora | sekcje zwijane, domyślnie zwinięte; nowe: widoczność, SMS i strefy, progi, stan systemu, użytkownicy i sesje, dziennik logowań, komunikat, eksport |

## Decyzje HERE (04.10.2026) — szczegóły w `ZLECENIE_HERE.md`
| ID | Sprawa | Decyzja | Status |
|---|---|---|---|
| D-77 | HERE | HERE wchodzi do systemu. Zastępuje zapis „bez HERE" z D-28. Własny silnik zostaje jako zapas, gdy HERE jest niedostępne albo budżet wyczerpany. | ✅ 04.10.2026 |
| D-78 | budżet HERE | Do 100 USD miesięcznie. Ostrzeżenia w Stanie systemu przy 50%, 80% i 100%. Po przekroczeniu 100% system przestaje odpytywać HERE i przechodzi na darmowe wyliczenia. Nigdy nie płaci ponad budżet. **Doprecyzowanie B-MAPA 05.10.2026:** budżet wspólny dla wszystkich usług HERE, w tym kafelków i dopasowania śladów. Przy 80% mapy same przechodzą na zapasowy podkład z etykietami (miejscowości, ulice, numery dróg), nigdy na obecny szary. Powrót na HERE od 1. dnia miesiąca. Zużycie kafelków i dopasowania śladów widoczne w Stanie systemu. **Doprecyzowanie 05.10.2026 ~12:11:** koszt = max(0, zapytania−pula)×stawka; 50/80/100% i limit 100 USD tylko od kosztu ponad pule; pule/stawki w tabeli parametrów (wstępnie tiles 30000/mies., routes 5000/mies.); jedna stawka trasy; miesiąc Europe/Warsaw. | ✅ 04.10.2026 |
| D-79 | aplikacja kierowcy | Zero aplikacji dla kierowców (Scandinavian Express). HERE WeGo Pro i pakiet nawigacyjny HERE SDK wykluczone. Nic nie jest instalowane u przewoźnika ani kierowców. | ✅ 04.10.2026 |
| D-80 | ETA | ETA nadal wyłącznie z pozycji GPS i AIS (decyzja z 04.10). HERE liczy czas przejazdu z bieżącej pozycji, nigdy z planu. **Doprecyzowanie ETA-PRE-LOAD 04.10.2026:** ETA dostawy pokazujemy dopiero po załadunku, czyli po wyjeździe ze strefy placu w Śremie. Przed załadunkiem we wszystkich miejscach (harmonogram, szczegóły, kokpit, eksport, e-maile) jest wyłącznie „–”, bez tekstu. SMS-KSH-1H nadal w tle liczy dojazd do Śremu. | ✅ 04.10.2026 |
| D-81 | licencja HERE | Wyniki przechowujemy najwyżej 30 dni. Na stałe wyłącznie własne podsumowania. Geometria i surowe dane HERE kasowane po 30 dniach. Warunki usługi — w `POSTEP.md` przed startem. | ✅ 04.10.2026 |
| D-82 | myto | Opłaty drogowe poza zakresem. Nie liczymy i nie pokazujemy. | ✅ 04.10.2026 |
| D-83 | wymiary zestawu | Wymiary dla każdego transportu poda właściciel. Kontrola trasy nie bierze niczego z dokumentów. Przewoźnik nie wprowadza żadnych wymiarów. | ✅ 04.10.2026; **zamknięte 16.10.2026** — dane z tabeli 07.10, wpis automatyczny w P5 D1 (D-20261016-0200-01 Z1); „Kontrola trasy” usunięta (Z3) |
| D-84 | próg wiatru | Porywy 15 m/s. Silny wiatr na trasie wydłuża ETA (H-10). | ✅ 04.10.2026; **zmiana 16.10.2026, 02:08: 20 m/s** (E49, D-20261016-0230-01) |
| D-85 | ETA | W pełni automatyczne, zero ręcznego wpisu, także prędkości. Limit km/h w Opcjach nie obowiązuje. **05.10 ~18:40 (właściciel):** dostępu do tachografu **NIE BĘDZIE nigdy** (ani emtrack, ani inne źródło) — rozwiązanie docelowe. Czas jazdy i odpoczynku liczony **wyłącznie z pozycji GPS naczepy**. H-4 budować teraz (nie po emtrack). **20:10:** droga SE z Trafikverket w pełnym zakresie — sytuacje, nawierzchnia, pomiary stacji. Wpływ na prędkość z wytycznych, potem nauka z GPS. Osobna linia ETA „nawierzchnia". Szczegóły w `ZLECENIE_HERE.md`. | ✅ 04.10.2026 / uzupełnienie 05.10 |
| D-86 | brama bazy w GitHub Actions | Brama `tests/db/gate.sh` (Postgres 17 + PostGIS, port 5433) działa w GitHub Actions — `.github/workflows/db.yml` — nie na komputerze wykonawcy. Uruchamia się dla zmian z SQL lub migracją i przed każdym wdrożeniem z migracją; scalenie i wdrożenie z migracją tylko przy zielonym wyniku na tym samym SHA. Potwierdzenie na TEST, pełna brama TEST w P0b / niedzielę / P11 — z komputera wykonawcy (hasło tylko w `.env.local`). Zastępuje wymóg lokalnego Postgresa 17 / WSL. Szczegóły: `docs/handover/dopiski/D-20261011-2135-01.md`. | ✅ 11.10.2026 |
| D-87 | test wizualny przed scaleniem w GitHub Actions | `scripts/ci/fresh-smoke.sh` przed scaleniem działa w GitHub Actions — `.github/workflows/visual.yml` — na każdym PR; zielony check `visual` zastępuje lokalny `fresh-smoke`. Progów, `playwright.config.ts` i wzorców nie zmieniasz. 15 migawek odświeżasz w paczce zmieniającej ekran przez `gh workflow run visual.yml --ref <gałąź> -f update=true` → `gh run download` → commit. Szczegóły: `docs/handover/dopiski/D-20261011-2135-01.md`. | ✅ 11.10.2026 |

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
| B-7c, B-8 (filtry i statusy), B-9, Q-9 — 🔁 zastąpione 08.10.2026, zob. decyzje audytu | wybór właściciela 05.10 ~10:37 | B-7c: A (brak GPS, ryzyko). B-8: zakres dat + bez kierowcy/ciągnika + „Zmień ciągnik”. B-9: C (filtr z „×” + kafelek Prom). Q-9: B (motyw systemu + zmiana w ustawieniach). B-3a nadal na wymiarach (D-83). | ✅ decyzja 05.10.2026 ~10:37 / ⏳ budowa |

## Decyzje właściciela 05.10.2026 (ostateczne) — B-5 kreator, ceny paliw, korekta SEFS

| ID | Sprawa | Decyzja | Status |
|---|---|---|---|
| B-5 (odwrócenie) — 🔁 zastąpione 08.10.2026, zob. decyzje audytu | przycisk i kreator automatyzacji | Przycisku nie ma — ma być. Zastępuje zapis z ~08:35 („przycisku ma nie być”). Przycisk „Nowa automatyzacja” w widoku Automatyzacje, tylko HHL_ADMIN. Kreator w oknie: nazwa, wyzwalacz (zdarzenie / status / ryzyko / termin), warunki, akcje (powiadomienie, decyzja, e-mail, SMS według zasad stref), włącz/wyłącz, edycja i usuwanie. Reguła w tym samym silniku co 0094, bez drugiego mechanizmu; zero podwójnych alarmów (ONE-MECH). Historia zmian reguły: kto, kiedy, co. Test: reguła z kreatora wykonuje się na zdarzeniu testowym; wyłączona — nie; duplikat istniejącego alarmu → ostrzeżenie przed zapisem. | ✅ decyzja 05.10.2026 / ⏳ budowa |
| PALIWO-AUTO (krok A) — 🔁 zastąpione 08.10.2026, zob. decyzje audytu | próbka cen OKQ8 i Orlen | Orlen: ONEkodiesel / Olej Napędowy Ekodiesel, PLN/m³ netto, hurtowe ceny paliw; klauzula regulaminu nie blokuje (decyzja właściciela). OKQ8: sekcja „Q8 Trucks”, produkt „Diesel”, wartość wprost ze strony bez przeliczania VAT (U-14); wzorzec 05.10 = 22,90. | ✅ zaakceptowane 05.10.2026 ~10:37 (OKQ8 z poprawką) |
| PALIWO-AUTO (krok B) | automat cen paliw (U-14, D-34, I-31, SEFS) | ~~Q8 Trucks/Diesel = 22,90 (05.10 rano)~~ → **zastąpione 05.10 ~21:48: OKQ8 GoEasy Diesel firmowa** (D-2/D-34, 0187). Codziennie; User-Agent Watch Tower; źródło i czas. Średnia PL i SE z poprzedniego tygodnia → indeksy → mnożnik „niższy” (I-31) → opłata wg tygodnia daty załadunku (D-34, 0155), Europe/Warsaw (33.3). Korekta do zamknięcia tygodnia, potem migawka (0166). Formularz I-2f tylko awaryjnie. Cel: odczyty na produkcji przed R-3. | ⏳ budowa |
| SEFS-KOREKTA | korekta ceny od dostawcy | Korekta wchodzi do średniej SEFS, dopóki tydzień nie jest zamknięty. Po zamknięciu tygodnia wartość zamrożona (migawka, 32.3) — późniejsza korekta nie zmienia policzonych transportów ani faktur; zapis korekty w historii. Odpowiada na pytanie z B-6h („czy średnia ma brać korektę zamiast oryginału”). | ✅ decyzja 05.10.2026 / **ZROBIONE** 0166 |
| Kolejność 05.10 | — | B-5 i krok 2A najpierw; potem część B według PLAN.md (B-8 wznowione po nich); krok 2B po akceptacji próbki, przed R-3. Migracje przez lokalną bramę, obie domeny 200 po każdym wdrożeniu. | ✅ 05.10.2026 |

## Odpowiedzi właściciela 05.10.2026 ~10:37 — paliwa B, SMS, porządki, wybory B

| ID | Sprawa | Decyzja | Status |
|---|---|---|---|
| PALIWO-AUTO-A — 🔁 zastąpione 08.10.2026, zob. decyzje audytu | akceptacja próbki | Orlen OK (ONEkodiesel netto). OKQ8: Q8 Trucks / Diesel = 22,90 wprost, bez VAT. | ✅ 05.10 ~10:37 |
| PALIWO-AUTO-B | automat | Budować po potwierdzeniu 22,90; mechanizm SEFS bez zmian; korekta 0166. | 🔁 zastąpione 05.10.2026 (D-2/D-34, OKQ8 GoEasy) |
| W40 / Uzgodnienie pkt 2–3 i E46–E48 | akceptacja | Progi E46–E48 jak w artefakcie; Uzgodnienie pkt 2–3 obowiązują. | ✅ zaakceptowane 15.10.2026, 03:12 (W40, D-20261015-0330-01) |
| SMS-SILENT-FIX | fałszywe SMS_GATEWAY_SILENT | Diagnoza + naprawa; jeden alarm bez powtórek; Resend 200≠ERROR; zero prawdziwych SMS. | ⏳ |
| MIG-0159-REG | ewidencja 0159 | Dopisać do schema_migrations bez ponownego wykonania; PROD = repo. | ✅ PROD = repo po D-20261012-2210-01 R3 (13.10.2026 04:31) |
| BARLOW+WZ | smoke + wzorce Automatyzacji | Napraw barlow.css; odśwież automatyzacje__* (przyczyna: B-5). | ⏳ |
| B-7c — 🔁 zastąpione 08.10.2026, zob. decyzje audytu | filtry mapy | Wariant A | ✅ / ⏳ |
| B-8 — 🔁 zastąpione 08.10.2026, zob. decyzje audytu | filtry/ciągnik | Zakres dat + bez kierowcy/ciągnika + Zmień ciągnik | ✅ / ⏳ |
| B-9 — 🔁 zastąpione 08.10.2026, zob. decyzje audytu | pasek filtrów | Wariant C | ✅ / ⏳ |
| Q-9 | motyw | Wariant B | ✅ / ⏳ |
| Kolejność ~10:37 | — | (2)+(3) najpierw, potem (1) paliwa B, potem (4) część B. | ✅ |

| Q-11b | push telefon | **A** Web Push VAPID; krytyczne od razu; skrót 1×/dzień; Preferencje; iOS „Dodaj do ekranu głównego” | ✅ 05.10 |
| H-8 — 🔁 zastąpione 08.10.2026, zob. decyzje audytu | profil trasy | **A** elevation truck standard teraz; naruszenia wymiarów auto po D-83; pula tras | ✅ 05.10 |

## Decyzje właściciela 2026-10-05 ~13:53 — CSP, ZAP, D-3, kolejka

| ID | Sprawa | Decyzja | Status |
|---|---|---|---|
| CSP-RO | Content-Security-Policy | Report-Only **7 dni**; naruszenia → tabela w Stanie systemu; potem lista źródeł do akceptacji; **enforce przed SEC-OWASP i pilotażem** | ✅ decyzja / ⏳ wdrożenie |
| ZAP-NODE | OWASP ZAP bez Dockera | Instalacja ZAP + Java; Baseline pasywny na **produkcji**; skan pełny tylko na **TEST**; wynik do SEC-OWASP | ✅ decyzja / ⏳ uruchomienie |
| D-3 — 🔁 zastąpione 08.10.2026, zob. decyzje audytu | retencja dokumentów | CMR/POD/zdjęcia 3 lata; PDF faktur 5 lat; I-7 bez zmian | ✅ 05.10.2026 |
| KOLEJKA-1353 | nie stój | Buduj pozycje bez czekania na właściciela; czeka tylko D-83→B-3a/H-1/H-3, R-0, D-7/14/16/17/21; GATE-WEEKLY 11.10; SG-03 raport po rozładunku | ✅ |

## Decyzje 05.10.2026 ~18:40 — ETA znaczniki (B) i H-4 z GPS (C)

| ID | Sprawa | Decyzja | Status |
|---|---|---|---|
| ETA-MARK | znaczniki przy ETA | zielony „w oknie" (między początkiem a końcem okna); bursztynowy „przed terminem" (przed początkiem — info); czerwony „po terminie" (po końcu — **ten sam warunek** co ryzyko ETA po terminie / L-3, bez drugiego alarmu); „przyjazd nocą" 22:00–06:00 Europe/Warsaw (info). Przed terminem i noc: bez Centrum decyzji i bez SMS. Opis w „Jak działa". | ✅ 05.10 |
| H-4 | ETA + czas pracy kierowcy UE | **Zrobione 05.10** (0185). Brak tachografu na stałe (D-85). Czas jazdy/odpoczynku tylko z GPS naczepy. U-31; A\|B = przepięcie. Reguły UE w ETA; prom = odpoczynek; ostrożne bez GPS; SMS-KSH-1H z tego ETA; II-7b obserwacja po rozładunku. | ✅ 05.10 |

## Decyzje 16.10.2026

| ID | Sprawa | Decyzja | Status |
|---|---|---|---|
| 16.10.2026 01:13 | wymiary, polisa, zezwolenie, H-1/H-3 | Wymiary/pilot/zezwolenie z tabeli 07.10 (P5 D1); polisa HHL i zezwolenie 13/GD/2026 wpisuje wykonawca (P5 D2, W4 zamknięte); bez kontroli trasy i przeszkód (P9); D-21 → E31/L6 | ✅ D-20261016-0200-01 |
| E49 | wiatr a ETA, objazd | E49 zaakceptowane: SMHI, progi 20/25 m/s, sprawa SCX „Objazd czy postój?”, śliskość lokalnie; D-84 = 20 m/s; W19 zamknięte | ✅ 16.10.2026, 02:08 (D-20261016-0230-01) |
| E17 (07.10, 20:57) | Czat | wykonanie: D-20261016-0250-01 + 0310-01 + 0315-01 (P6 Cz1–Cz33; C3 Cz13/Cz25) | ⏳ P6 / C3 |
| D-21 | wymóg zezwoleń | zastąpione przez E31 i L6 (D-20261016-0200-01 Z1 pkt 7) | 🔁 16.10.2026 |

