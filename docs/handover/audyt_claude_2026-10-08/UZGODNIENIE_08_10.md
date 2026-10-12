# Uzgodnienie repozytorium z decyzjami audytu 07–08.10.2026

> **08.10.2026 (po 14:43): numeracja paczek P0–P10 w całym tym pliku jest historyczna.** Obowiązuje `docs/handover/PLAN.md` §4 (P0a, P0b, P1–P9, P10a, P10b, P11), ułożony według zależności. Przykłady: E31, E33, E16, E40 → P5; E7, E17 → P6; E38, E32 → P7; E42, E43 → P8; mapy → P9; E37 → P3 (pasek) i P10b; E46–E48 → P10a / P10b / P11. Pkt 3: 8.4 → E7 w P6 (`ROZSTRZYGNIECIA_LUK.md` E7-5, poprawione 09.10).

Stan: **08.10.2026, 14:00 — opracowane przez Claude, do akceptacji właściciela (3 punkty na końcu); 14:20 — zakres P1 według zależności (E18 P12, P14, P15, P16 i wartości startowe przeniesione do P5, P9, P2, P6)**. Niezależne sprawdzenie (osobny agent, 13:58–14:05): 206 twierdzeń, 204 zgodne, 2 poprawione (data rozładunku SG-01, brak wpisu D-57).
Źródła: rejestr decyzji w repozytorium `docs/handover/wzorzec/03_REJESTR_DECYZJI.md` (ostatnia zmiana 07.10 01:00, commit 9c4fa33), `docs/handover/PLAN.md` (1091 linii; inwentarz otwartych pozycji w załączniku A `PLAN_OTWARTE_08_10.md`), raport „Audyt Watch Tower” v62, plan audytu v60, `DECYZJE_08_10.md`, polecenie właściciela 08.10 13:26, dokumenty od właściciela (zezwolenie, polisy), baza produkcyjna (tylko odczyt, 08.10 13:0x–13:4x).

## 0. Zasada nadrzędna (właściciel, 08.10 13:26)
„Najświeższe ustalenia poczynione w tym czacie od samego początku są obowiązujące i nadpisują wszelkie starsze decyzje i rozwiązania.”
Czat audytu trwa od 07.10.2026. Jego decyzje (etapy E1–E45, `DECYZJE_08_10.md`, ten dokument) **mają pierwszeństwo** przed starszymi wpisami w rejestrze decyzji, PLAN.md, POSTEP.md i przed makietą `design/claude-v2.0/` tam, gdzie etap audytu ma własną makietę. Zasady pracy z AGENTS.md (brama, TEST, wdrożenie z `main`, lista STOP) zostają bez zmian.

## 1. Dane od właściciela (08.10 13:26)
| Sprawa | Stan | Skutek |
|---|---|---|
| Zezwolenie „na firmę” | **jest**: GDDKiA, kategoria IV, nr 13/GD/2026, 24 miesiące, ważne 25.01.2026–25.01.2028, dla Scandinavian Express Poland Sp. z o.o., druk AF 0082620, opłata 4 800 zł | w bazie `permits` = 0 → wgrywa SCX po paczce E31; podpina się samo do każdego transportu „Firma” (E31) |
| Zakres kategorii IV | druk odsyła do pozycji 4 tabeli ustawy; tabela GDDKiA: szer. 3,4 m (4 m na drogach dwujezdniowych A i S), dł. zespołu 23 m (30 m przy osiach skrętnych), wys. 4,3 m, masa rzeczywista 60 t, drogi publiczne | wszystkie rodzaje „Firma” z tabeli wymiarów (BS-A/B/C, PL-A, PL-B, SG, SS, T, TS) mieszczą się w szerokości, długości i wysokości (PL-B ma szerokość równo 3,40 m — bez zapasu); KR (23,69 × 3,52 × 3,9) przekracza → „Trasa”, zgodnie z tabelą. **Masy zestawu nie sprawdzono** (brak masy własnej pojazdów) |
| Polisa SCX | **już w systemie** od 07.10 10:54 UTC: nr 436000430439, 500 000 EUR, 30.03.2026–29.03.2027, zatwierdzona, z plikiem; certyfikat ERGO Hestia zgodny | literówka ubezpieczyciela „Hstia” → poprawić na „ERGO Hestia” |
| Polisa HHL | PZU, nr 1106707356, **OC przewoźnika drogowego** w ruchu krajowym i międzynarodowym, 23.04.2026–22.04.2027, 300 000 EUR na zdarzenie, klauzula 30 „ładunki ponadgabarytowe” — podlimit 100 000 EUR, franszyza 500 EUR | w bazie brak → wgrywa HHL po paczce E31. Dokument to OC **przewoźnika**, nie OC spedytora (E31 pisał „OCS HHL”) → nazwa w aplikacji według dokumentu |
| Polisa testowa | „OCP-SCX-2026-WT”, 5 mln EUR, zatwierdzona | usuwa E18 P6 (paczka 1) |
| Lista użytkowników (D-16) | właściciel wprowadza sam w działającym programie | D-16 zamknięte |
| Limity ponadnormatywności (D-15) | potwierdzone tabelą wymiarów 07.10 (`WYMIARY_PILOT_ZEZWOLENIA.md`) | D-15 zamknięte |
| KPD GDDKiA (D-17, II-6 PL) | **rezygnacja** | zamknięte; drogi PL z HERE (E2) |
| Numery SMS (Śrem, Boden) | właściciel wprowadza sam | — |
| Adresy księgowości (E40) | HHL: ksiegowosc@hhlogistics.pl; KSH: faktury@ksh.pl | wartości startowe w Opcjach (zmienia Administrator HHL) — paczka P6; dziś w bazie nie ma na nie miejsca |
| E18 porządki | „jeżeli trzeba — wykonaj” | potrzebne (faktura testowa blokuje fakturę SCX za BS-01, polisa testowa obok prawdziwej, SG-24) → **paczka 1**, sposobem z decyzji 32 (kopia, skrypt w repozytorium, brama, TEST, produkcja przy wdrożeniu); P12, P14, P15, P16 razem z paczkami P5, P9, P2 (najpierw zmiana w kodzie) |
| Spoza audytu | test wydajności, monitoring błędów, testy OWASP po budowie | etapy E46, E47, E48 (punkt 5) |

Wszystkie ważności (zezwolenie do 25.01.2028, SCX do 29.03.2027, HHL do 22.04.2027) obejmują projekt do końca 2026.

## 2. Rejestr decyzji w repozytorium — wpisy zastąpione albo zamknięte
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
| D-30 (l. 53) | polisy tak | E31 3B: KSH widzi tylko polisę HHL, SCX tylko swoją, HHL obie *[09.10 13:09: polisy SCX i HHL dodaje się raz, podpinają się same do dokumentów każdego transportu — `ROZSTRZYGNIECIA_LUK.md` G-21]* |
| D-32 (l. 55) | zgoda IT KSH ⏳ | bez zmian — czeka (dostęp nada dział IT KSH); zakres według E38 |
| D-33 (l. 56) | do pliku KSH: kierowca, telefon, nr zlecenia, nr rejestracyjny | E38: kierowcy, telefony, ciągniki (PL / SE jako „A / B”), naczepa, numer SCX („HHL-Scan”), numer HHL („HHL-KSH”); bez nowej kolumny; planu i komórek z formułą nie zmienia *[09.10 13:09: zastąpione w części „planu … nie zmienia” — daty i godziny zmienione przez KSH w Watch Tower trafiają do pliku; formuł nie zmienia poza komórką „Data załadunku” zmienioną przez KSH (W31) — G-20]* |
| D-37, D-64 (l. 76, 103) | SMS 1 h przed przyjazdem, 2 + 2 osoby | E42: 4 rodzaje A–D, cisza nocna 20:00–06:00, raz na numer, tryb testowy (3 transporty); E35: kreator może wysyłać SMS tylko z tymi zasadami |
| D-42 (l. 81) | opłaty dodatkowe wyłącznie ręcznie | E33: system liczy i podpowiada kwotę, HHL dodaje i zatwierdza (część przychodową akceptuje KSH); postój 750 EUR/doba albo 75 EUR/h (6 h / 4 h wolne); anulowanie % frachtu bez opłaty paliwowej, 2 dni = 25 % *[09.10 13:09: zastąpione w części „HHL dodaje i zatwierdza” — system liczy i podpowiada, HHL i SCX same decydują, czy dodać; dopłatę SCX akceptuje HHL; część przychodową akceptuje KSH — G-22]* |
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

## 3. PLAN.md — 110 otwartych pozycji (załącznik A)
- **Objęte audytem: 54** → wchodzą do paczek z punktu 6 według przypisanego etapu.
- **Sprzeczne: 6** → obowiązuje audyt: II-3 (terminy CMR po załadunku, POD, zdjęcia, kierowca 48/12 h) → E31 + E32; D-11 → E37; H-8 → E17 + E18 P16; 12.5 faktoring „poza 1.0” → E4b (faktoring w zakresie: 1 % netto, wypłata 48 h po akceptacji); AUD-06 częściowo → E16; AUD-12 częściowo → E17 (profil trasy); reszta E9 i E30.
- **Zamknięte danymi z 13:26:** D-15, D-16, D-17 (z II-6 KPD), oraz D-7 i D-14 (07.10).
- **R-0 (czyszczenie wszystkich 94 transportów przed R-1) → NIEAKTUALNE.** Od 01.10 transporty są prawdziwe (SG-01 rozładowany 06.10, 21:05; SG-03 na placu od 07.10; pozycje, ceny, numery). E38 aktualizuje transporty po kodzie, a E18 usuwa tylko dane testowe. **R-1** = ręczne wgranie pliku z 08.10 według E38 (synchronizacja z SharePoint później). R-2: użytkowników wprowadza właściciel. R-3, R-4 zostają.
- **Poza audytem: 48** → zostają w PLAN; najważniejsze do produkcji: przejście CSP na enforce, pełny skan ZAP na TEST, P3-SW i P3-ZIP (SSRF), P3-AND (eksportowane komponenty bramki SMS), GATE-WEEKLY, PR1 (podtrzymanie), PR2 (kopie do R2 — sprawdzić, czy cron działa), PR7, potwierdzenie wdrożenia retencji D-3 (bez POD i zdjęć), AUD-01d (klucz HERE do przeglądarki), AUD-01e (jedna mapa na sesję — scalić albo zamknąć), I-0b, 17.13 (współrzędne terminali). Trzy z nich (wydajność, błędy, bezpieczeństwo) porządkują E46–E48.
- **Nie wiadomo: 2** → 8.4 (panel alternatywnych przepraw) przypisać do E7 („Sytuacja na trasie”, alternatywa L-9); „pozycje D4–D12 audytu” bez treści w PLAN → sprawdzić w POSTEP, bez treści zamknąć.
- **PLAN nie zgadza się ze stanem repozytorium** (do poprawy statusów w paczce 0): AUD-04 (scalony PR #150), L-1b / L-12 / SMS-KSH-1H (migracje 0145, 0152, 0158 są w repozytorium), L-13 (POSTEP l. 1775: „na produkcji”), P1-FONT (czcionki w `public/fonts`), H-2-PL (w PLAN DONE, audyt E2: do dodania), ZEZW-13 / B-3a / H-6 / D-83 (wymiary są od 07.10 w `WYMIARY_PILOT_ZEZWOLENIA.md`, niewprowadzone).

## 4. Fakty z bazy (08.10, tylko odczyt)
- Konta „+tower-sec” 3 (nadal aktywne, choć 07.10 13:21 miały być wyłączone — usuwa je E18 P2), „+tower-test” 3, zaproszenia „+tower-test” 3 (1 przyjęte, 2 oczekujące); polisy 2 (testowa + SCX), faktura testowa 1, wiadomości testowe 4 (id 29, 31, 32, 33), SG-24 „Tx/1/2026 · GGH666 · Gotowy”, zezwolenia 0, dokumenty 1, otwarte sprawy 217.
- Do P1 (08.10, 14:10–14:17): konta „+tower-*” wskazuje dziennik bezpieczeństwa (11 wpisów, klucz bez kaskady) — konta tracą logowanie, zaproszenia i powiadomienia, a wiersze zostają nieaktywne *[09.10 13:09: zmienione — wiersze usuwane z odpięciem 11 wpisów dziennika, `ROZSTRZYGNIECIA_LUK.md` E18-1, W22]*; powiadomień tych kont 1362; SG-24 ma stan strefy „w środku” z testu 01.10 22:33 (prawdziwy wjazd nie dałby zdarzenia ani SMS) — do usunięcia; SG-03: 103 pozycje po wyjeździe z placu (ostatnia 07.10 21:23); ETA przed wyjazdem w 91 transportach, opóźnienie w 5, otwarte ETA_BREACH 4 (KR-04, KR-05, KR-06, SG-24). Zamknięcie sprawy i zmiana statusu wysyłają dziś powiadomienia w aplikacji i push, więc P1 wyłącza te wyzwalacze tylko na czas porządków. Niezależne sprawdzenie zakresu P1 (osobny agent, 14:19–14:27): 32 punkty, poprawki wpisane do promptu.
- Ceny: 86 z 94 transportów ma cenę, marża 4,76–4,77 %, poniżej progu 4 % — 0.
- Błędy przeglądarki (`client_errors`): 99 odcisków, 179 wystąpień. W 7 dni z przeglądarek nietestowych 79 odcisków i 146 wystąpień — odcisk zależy od buildu, więc po zgrupowaniu po treści to **3 rodzaje**: „appendChild” 95 (5 osób, 15 buildów, ostatnio 06.10 17:31 — po naprawie B11 brak), „stara wersja po wdrożeniu” (Failed to fetch dynamically imported module) 39 (3 osoby, ostatnio 06.10 18:12; E22), Leaflet „_leaflet_pos” 12 (2 osoby, ostatnio 05.10 07:53).

## 5. Nowe etapy spoza audytu (do akceptacji)
### E46 · Test wydajności
- **Gdzie:** TEST i lokalnie; na produkcji tylko lekki pomiar stron (bez obciążania).
- **Dane:** na TEST 3 × skala projektu: 420 transportów, pozycje 140 transportów z 5 dni w rzeczywistej częstotliwości, rejsy, sprawy, powiadomienia; usunięte po teście.
- **Strony** (Lighthouse, skrypt `lh:resp14` już jest): Kokpit, Mapa, Harmonogram (układ pliku, 420 wierszy), Finanse, panel transportu; komputer i telefon. Progi: LCP ≤ 2,5 s, CLS ≤ 0,1, TBT ≤ 300 ms na telefonie.
- **Baza:** czas funkcji list (Harmonogram, Mapa, Finanse, Do zrobienia, dzwonek) p95 ≤ 500 ms przy 420 transportach; zadania pg_cron bez nakładania się; doradca Supabase „performance” bez błędów; brakujące indeksy dodane.
- **Równoczesność:** 20 sesji Playwright przez 10 min (konta testowe 5 ról) — 0 błędów, p95 jak wyżej.
- **Kiedy:** po paczkach z punktu 6, przed pilotażem; potem co tydzień w GATE-WEEKLY (bez danych 3×).
### E47 · Monitoring błędów aplikacji
- **Jest:** `client_errors` (0058; tylko build produkcyjny, limit 10 na kartę, ten sam komunikat raz na 60 s), skrót dzienny administratora (0129, 0130), sprawy JOB_FAILURE.
- **Propozycja:** w Stanie systemu (E23) kafelek „Błędy aplikacji”: grupowanie po treści błędu (nie po buildzie), nowe i powracające, ile osób, pierwsze i ostatnie wystąpienie, build, strona. Bez przeglądarek testowych (headless, agenci) i starych buildów.
- **Alarm** (ten sam kanał co E23, decyzja 27 A — Administratorzy HHL, e-mail i push): nowy błąd ≥ 3 wystąpienia albo ≥ 2 osoby w 1 h; każdy błąd na ścieżce krytycznej (logowanie, zapis Awizacji, numery zleceń, import, faktury, paczka tygodnia); błędy funkcji Edge i zadań pg_cron (E23). Raport tygodniowy w GATE-WEEKLY.
- **Test:** wymuszony błąd na TEST → wpis i alarm ≤ 5 min; ten sam błąd 10 razy = 1 grupa; zero alarmów z przeglądarek testowych.
- **Bez płatnych narzędzi** i bez wysyłania danych do firm trzecich.
### E48 · Testy bezpieczeństwa OWASP po budowie
- **Jest (05.10):** ASVS L2 82 pass / 12 partial / 0 fail / 18 N/A; ZAP pasywny produkcji: High 0, Medium 2, Low 1; npm audit high/critical 0; CSP Report-Only do 12.10; aktywny ZAP planowany na TEST.
- **Po zbudowaniu wszystkich paczek, przed pilotażem:** zamknąć P3-SW, P3-ZIP, P3-AND; CSP enforce po akceptacji listy źródeł; aktywny ZAP na TEST + pasywny na produkcji: 0 High, Medium opisane; ASVS L2 ponownie — 12 partial do pass albo pisemna akceptacja; testy ról przez API dla 5 rodzajów kont (dostęp do danych innych firm — także nowe zasady: KSH bez numerów zleceń, KSH tylko polisa HHL, SCX bez ceny KSH) jako testy bramy bazy; gitleaks i zależności; doradca Supabase „security” bez błędów; ochrona przed wyciekniętymi hasłami włączona (Pro, E19). Raport „przed / po”.
- **Nigdy** aktywnego skanu produkcji (ZAP-NODE).

## 6. Paczki dla Cursora (kolejność proponowana — HISTORYCZNE)
> **08.10.2026: zastąpione.** Obowiązuje kolejność i zakres paczek w `docs/handover/PLAN.md` (P0a–P11, paczki po kolei — §3), ułożone według zależności między etapami. Tabela niżej zostaje jako historia.
Każda paczka: prompt z numerami decyzji, makietą z raportu, dosłownymi tekstami i testami odbioru z sekcji „Test” etapu; brama według AGENTS.md; po wdrożeniu niezależne sprawdzenie Claude na produkcji; paczka zamknięta przy 0 rozbieżności.
| Paczka | Zakres | Uwagi |
|---|---|---|
| P0 | Dokumentacja w repozytorium: folder `docs/handover/audyt_claude_2026-10-08/` (raport, makiety, etapy, decyzje, to uzgodnienie), nowe wpisy rejestru, PLAN.md, AGENTS.md (kolejność czytania), inwentarz plików | bez kodu |
| P1 | E18 porządki: P2, P3, P6–P11, P13 (konta i dane testowe, SG-24, pozycje SG-03 po wyjeździe z placu, stare ETA przed wyjazdem, 10 spraw) + poprawka „Hstia” → „ERGO Hestia” | jedna migracja danych + kopia, brama, TEST, produkcja; prompt P1 gotowy 08.10 |
| P2 | E41 nazwa transportu (jedna funkcja, „·”) + E21 formaty (jeden moduł) + E10 kontrast + E18 P15 (tytuły otwartych spraw, jednorazowo) | fundament ekranów |
| P3 | E9 prawa ról + E12 Opcje (prawa, 0 × 403) + E19 bezpieczeństwo bazy + E6 konta (imię, nazwisko, telefon) | fundament uprawnień |
| P4 | E25 / E26 statusy + E28 pasek etapów + E27 śledzenie + E15 ETA | |
| P5 | E38 import ręczny (mapowanie, reguły, KR-03) + Harmonogram w układzie pliku (E38 1A, E30, E20) + E32 panel i Awizacja + E17 Status / Historia / Czat + E18 P12 (30 starych spraw zasobów) i P16 (profil trasy) | pierwsze wgranie pliku: TEST + raport, potem produkcja |
| P6 | E31 dokumenty, zezwolenia, polisy + E33 ceny i dopłaty + E3 / E39 opłata paliwowa + E16 finanse + E4 / E4b faktury i faktoring + E40 paczka tygodnia; wartości startowe: próg marży 4 % (E16), adresy księgowości HHL i KSH (E40) | po P6 właściciel / SCX / HHL wgrywają zezwolenie i polisę HHL |
| P7 | E7 Do zrobienia i ryzyka + E5 / E13 dzwonek + E42 SMS + E43 szablony + E35 automatyzacje + E34 strefy | wysyłka do prawdziwych odbiorców = decyzja właściciela (tryb testowy E42) |
| P8 | E1 / E29 / E45 / E24 / E2 mapy | |
| P9 | E37 pasek, pomoc, logowanie, zaproszenia + E11 Opcje (6 grup) + E8 telefon + E22 przeładowania + E23 źródła danych + E18 P14 (duplikat emtrack) | |
| P10 | E47 monitoring + E46 wydajność + E48 OWASP + pozycje PLAN „poza audytem” (CSP, ZAP, P3-*, PR1/PR2/PR7, retencja, AUD-01d/01e, I-0b, 17.13) | przed pilotażem |
| R | R-3 pierwszy prawdziwy transport od importu do faktury, R-4 raport i `release-1.0` | |
Czekają na dane (nie odłożone decyzją właściciela; poprawka 09.10): API emtrack (`PLAN.md` §5 W15), linki podwykonawców E44 (W14) *[09.10: zamknięte — link RIO jest, E44 w P4 (`ROZSTRZYGNIECIA_LUK.md` G-24)]*, synchronizacja z SharePoint (E38, po dostępie od działu IT KSH — W13).

## 7. Do akceptacji właściciela (stan 08.10)
> Pkt 1 — rozstrzygnięty poleceniem właściciela 14:43 („Wszystko co jest starsze jest nieaktualne”). Pkt 2 i 3 — obowiązują jako rozstrzygnięcia K (`ROZSTRZYGNIECIA_LUK.md` L58, L25, G-04), dopóki właściciel ich nie zmieni dopiskiem.
1. Zastąpienia w rejestrze i PLAN (punkty 2–3), w tym **R-0 nieaktualne** (nie czyścimy 94 transportów).
2. E46, E47, E48 z progami z punktu 5.
3. Kolejność paczek P0–P10 i nazwa polisy HHL według dokumentu („OC przewoźnika — PZU”).
