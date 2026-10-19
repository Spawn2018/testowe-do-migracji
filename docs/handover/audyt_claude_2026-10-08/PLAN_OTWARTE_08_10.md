# PLAN.md — inwentarz pozycji otwartych (stan pliku 08.10.2026)

Źródło: `docs/handover/PLAN.md` (1091 linii, przeczytany w całości). Decyzje audytu: `recon/audit_stages.md` (nadrzędne wobec PLAN).
Pomocniczo, tylko do odczytu: `TRIAGE_REJESTRU.md` i `REJESTR_CALOSCI.md` §2/§5 (PLAN l.621 każe brać z nich status ID z §6), dokumenty projektu `claude/audyt/E1-E6_E11-E14.md` (przypisanie punktów audytu 06.10 do E..), `E7`, `E15`, `E18`, `E31`, `E32`, `DECYZJE_08_10.md`, `WYMIARY_PILOT_ZEZWOLENIA.md`; `ls supabase/migrations`, `public/fonts`.

Zasady: wypisane pozycje bez DONE / ZROBIONE / ZAMKNIĘTE / ZASTĄPIONE / NIEAKTUALNE; przy niejasnym statusie dopisek „status niejasny”. Duplikaty ID z §6 są scalone z pozycją główną (kolumna „Linia” podaje wszystkie linie).
Przypisanie: `E..` = audyt to rozstrzyga lub obejmuje · `SPRZECZNE z E..` = treść stoi w sprzeczności z decyzją · `poza audytem` · `nie wiem`.

| ID | Sekcja | Co | Status w PLAN | Linia | Przypisanie | Uwagi |
|---|---|---|---|---|---|---|
| AUD-01e | Audyt pełny 06.10 | Jedna instancja mapy Leaflet na sesję, powrót ≤ 0,3 s | GOTOWE 06.10 18:30 — gałąź `fix/aud-01e-mapa` | 64 | poza audytem (wydajność mapy) | status niejasny: brak wpisu o scaleniu i wdrożeniu; AUD-01d (l.65): „brak w kodzie, do zlecenia” |
| AUD-01d | Audyt pełny 06.10 | Kafelki HERE kluczem przeglądarkowym ograniczonym do domeny; pośrednik tylko zapas | WDROŻONE 06.10 17:25; „Czeka na właściciela: klucz przeglądarkowy HERE” | 65 | poza audytem (podkład, klucz) | status niejasny; temat domeny dotyka E24 (pages.dev → tower.log-mar.pl) |
| AUD-04 | Audyt pełny 06.10 | Tytuły sytuacji Trafikverket po polsku ze słownika; kafelki HERE po polsku | DO ZROBIENIA | 70 | E7 (A4 drogi SE) + E21 (język) | HEAD repo = merge PR #150 `fix/aud-04-pl-data`; audyt 07.10: częściowo, starsze tytuły po szwedzku → E18 P15 |
| AUD-05 | Audyt pełny 06.10 | Wyczyścić stare ETA 93 transportów przed wyjazdem; „–” wszędzie przed wyjazdem | DO ZROBIENIA | 71 | E15 (pkt 6) + E18 (P11) | — |
| AUD-06 | Audyt pełny 06.10 | Finanse: jedno źródło liczb, marża % = marża/przychód, „Kurs NBP” z datą albo „kurs po rozładunku” | DO ZROBIENIA | 72 | SPRZECZNE (częściowo) z E16 · reszta E16 | E16: przed rozładunkiem kurs bieżący NBP z dopiskiem (nie „kurs po rozładunku”); jedna marża, EUR, flaga 4 % |
| AUD-07 | Audyt pełny 06.10 | Domyślnie EUR na każdym koncie, PLN po przełączeniu | DO ZROBIENIA | 73 | E16 | — |
| AUD-08 | Audyt pełny 06.10 | Ustalenia = czat; ręczne statusy w Status; Historia po polsku z autorem | DO ZROBIENIA | 74 | E17 (+E25 ręczna zmiana statusu) | — |
| AUD-09 | Audyt pełny 06.10 | Centrum decyzji: kod transportu, typy PL, jeden licznik, klik → karta decyzji | DO ZROBIENIA | 75 | E7 (+E41 nazwa) | E7 łączy Centrum decyzji i „Wymaga decyzji” w jedną listę „Do zrobienia”; klik rozwija kartę w miejscu |
| AUD-10 | Audyt pełny 06.10 | Odczyt `security_flags` dla HHL_ADMIN, zero 403 w Opcjach | DO ZROBIENIA | 76 | E12 (B4) | E12: odczyt przez funkcję, `admin_security_flag_set` |
| AUD-11 | Audyt pełny 06.10 | Sekcje Opcji ładują dane przy rozwinięciu, „ładowanie…” | DO ZROBIENIA | 77 | E12 (B5) | — |
| AUD-12 | Audyt pełny 06.10 | Czas wykrycia odchylenia, ryzyko promowe, przychód tygodnia, profil trasy H-8, Rejsy „Przyszłe” | DO ZROBIENIA | 78 | SPRZECZNE (częściowo) z E17 · reszta E9 (B6, B7), E30 (Rejsy) | naprawa profilu H-8 sprzeczna z E17 (profil ukryty) i E18 P16 (usunąć `route-profile`) |
| AUD-13 | Audyt pełny 06.10 | Lista danych testowych do akceptacji (polisa Test OCP, faktura WT-TEST-P6, urządzenia, konta) | DO ZROBIENIA | 79 | E18 (P2, P3, P6, P7, P17) | E18 zaakceptowane 08.10 12:14 |
| AUD-14 | Audyt pełny 06.10 | Błąd JS appendChild: przyczyna, naprawa, zero błędów konsoli | DO ZROBIENIA | 80 | poza audytem | status niejasny: audyt 07.10 (dok. E1–E6) — B11 zrobione, 0 w 18 wejściach |
| AUD-15 | Audyt pełny 06.10 | Telefon 390 px: bez obcięć, tabele jako karty, 44 px, czcionka ≥ 12 px | DO ZROBIENIA | 81 | E8 | — |
| AUD-16 | Audyt pełny 06.10 | Komputer 1280/1366: Marża nie zakrywa Statusu, logo, pasek etapów, kontrast logowania | DO ZROBIENIA | 82 | E20 (+E28 pasek, E10 kontrast) | — |
| AUD-17 | Audyt pełny 06.10 | Teksty: JSON w Automatyzacjach, formaty liczb i dat, odmiana, liczniki mapy | DO ZROBIENIA | 83 | E21 (+E35, E34) | — |
| AUD-18 | Audyt pełny 06.10 | Separator kierowców SG-03 („\|” czy „ / ”): przepięcie czy dwóch kierowców | DO ZROBIENIA | 84 | E6 (kierowcy PL/SE, przepięcie) | C-SEP (ZROBIONE, l.480): „\|” tylko przy Przepięciu |
| I-0b | Etap I | Usunąć poprzednie wdrożenia Pages (lista = 1) | DO ZROBIENIA (przy okazji) | 91 | poza audytem (wdrożenia) | E24: pages.dev zawsze przekierowuje na tower.log-mar.pl |
| I-3 | Etap I | Bramka SMS — aplikacja Android | „DO ZROBIENIA: aplikacja Android → I-3-APK” | 109 | poza audytem (infrastruktura SMS) | status niejasny: I-3-APK DONE (l.251) |
| SEC-OWASP › CSP | Etap I + polecenie 05.10 13:53 | CSP Report-Only 7 dni → akceptacja źródeł → enforce przed pilotażem | SEC-OWASP DONE 05.10; „CSP RO do 12.10”; enforce bez statusu | 135; 1086 | poza audytem (CSP) | otwarte przejście na enforce |
| SEC-OWASP › ZAP | Etap I + polecenie 05.10 13:53 | Pełny skan ZAP tylko na TEST | „Active TEST 11.10” | 135; 1087 | poza audytem (OWASP/ZAP) | brak wyniku w PLAN |
| R-0 | Pilotaż i wydanie | Plan czyszczenia 94 transportów przed R-1; wykonanie po pisemnej akceptacji | PLAN — bez kasowania | 141; 593–617 | poza audytem (pilotaż) | E18 porządkuje tylko dane testowe, nie 94 transporty |
| R-1 | Pilotaż i wydanie | Import prawdziwego harmonogramu na produkcję | otwarte | 142 | E38 | E38: teraz mapowanie + ręczne wgranie; automatyczna synchronizacja ⏳ po dostępie IT KSH (odłożone) |
| R-2 | Pilotaż i wydanie | Zaproszenia HHL → KSH → przewoźnik | CZĘŚCIOWO; lista D-16 u właściciela | 143 | E37 (zaproszenie, pierwsze wejście) + E6 | wysłanie zaproszeń do prawdziwych użytkowników = STOP (konstytucja) |
| R-3 | Pilotaż i wydanie | Pierwszy prawdziwy transport od importu do faktury | CZEKA NA: R-2 | 144 | poza audytem (pilotaż) | — |
| R-4 | Pilotaż i wydanie | Raport końcowy, tag `release-1.0` | CZEKA NA: R-3 | 145 | poza audytem (wydanie) | — |
| II-1 | Etap II | Wartości SEFS i ich wprowadzenie | CZEKA NA: D-2 | 151 | E3/E39 | status niejasny: D-2 ZREALIZOWANE (l.369), PALIWO-AUTO-B ZROBIONE (l.423) |
| II-2 | Etap II | Kody opóźnień uzgodnione z SCX — włączenie w interfejsie | CZEKA NA: spotkanie | 152 | poza audytem | — |
| II-3 | Etap II | Parametry operacyjne i terminy (zasoby, dokumenty, piloci) do potwierdzenia z SCX/KSH | CZEKA NA: spotkanie | 153 | SPRZECZNE z E31 i E32 · reszta E15 | (b) CMR i zdjęcia mocowania 2 h po załadunku, POD 24 h, rysunek 72 h — E31: tylko CMR z rozładunku; (a) kierowca/pojazd 48/12 h — E32: RESOURCE_DEADLINE wyłączyć; (c) piloci 48/12 h zgodne z E32 |
| II-4 | Etap II | Adapter telematyki przewoźnika | CZEKA NA: spotkanie | 154 | poza audytem (telematyka/emtrack API — odłożone) | TRIAGE: duplikat TELM-2 |
| II-6 (KPD) | Etap II | KPD GDDKiA (drogi PL) — klucze, certyfikat | „DONE Trafikverket; TomTom/KPD nadal bez kluczy/cert” | 156 | E2 | KPD = zapas w H-2-PL (l.586) |
| II-7 (Etap II) | Etap II | HERE Routing v8 do ETA | ZABLOKOWANE przez D-28 | 157 | poza audytem | status niejasny: II-7 (l.266) DONE na OSM; D-77 dopuszcza HERE |
| II-7a | Etap II | Limit 25 000 transakcji HERE/mies., sprawdzenie regulaminu | ZABLOKOWANE przez D-28 | 158 | poza audytem | status niejasny: TRIAGE — ZASTĄPIONE przez D-78 |
| III-1 | Etap III | Kalibracja czasów odcinków ETA po 5 transportach — propozycja dla HHL | SZKIELET GOTOWY; dane po 5 transportach | 162 | E15 (pkt 7 kalibracja) | II-7b (l.267) „zastępuje III-1” |
| II-10-E1 (+„integracja SharePoint”, §6 3.10) | Paczka 30.09 / Etap III | SharePoint etap 1: odczyt, potem zapis na pliku testowym | DO ZROBIENIA w A6 | 255; 176; 746 | E38 | plik testowy dostępny 19.10; zapis na produkcji po akceptacji właściciela (D-20261019-1420-01) |
| II-10-E2 | Paczka 30.09 | Zapis do pliku produkcyjnego KSH po pisemnej akceptacji | CZEKA NA: akceptację właściciela po teście na pliku testowym | 256 | E38 (2A: WT wpisuje numery SCX i HHL) | plik testowy dostępny 19.10; zapis na produkcji po akceptacji właściciela (D-20261019-1420-01) |
| II-7b | Paczka 30.09 | Kalibracja ETA ucząca się (zastępuje III-1) | SZKIELET; pełna nauka CZEKA NA TELM-2 | 267 | E15 | E15: propozycja po 5 dostawach, zatwierdza administrator HHL |
| TELM-2 (+§6 5.1–5.3, 5.5) | Paczka 30.09 | Szkielet telematyki; oficjalne API emtrack i linki | PARTIAL — CZEKA: oficjalne API emtrack | 270; 768–774 | poza audytem (emtrack API — odłożone) | E44 ⏳ linki podwykonawców *[09.10: link RIO jest — E44 w P4 (`ROZSTRZYGNIECIA_LUK.md` G-24); oficjalne API emtrack nadal czeka (`PLAN.md` §5 W15)]* |
| ZEZW-13 | Paczka 30.09 | Zezwolenia (§13 PO_SPOTKANIU) | CZEKA NA: wymiary aut | 281 | E31 (+E32) | wymiary właściciela z 07.10 w `claude/WYMIARY_PILOT_ZEZWOLENIA.md` — nie wprowadzone |
| GATE-WEEKLY | Paczka 30.09 | Niedzielna brama TEST w częściach | RYTM — najbliższa 11.10.2026 | 282 | poza audytem (brama) | stałe |
| TELM-EMTRACK-WEB (kroki 5–6) | Priorytet 05.10 13:12 | Monitoring 72 h; link do transportu + mapa | brak statusu kroków (wiersz l.273: LIVE 05.10) | 1079; 273 | E23 / E27 | status niejasny |
| ONE-MECH › wf-7…12 | Tabela ONE-MECH / D-29t | Reguły faktur, faktoringu, PERIOD, marży — macierz albo wyłączone do decyzji | „albo zostawić wyłączone do osobnej decyzji” | 337 | E4/E4b (faktoring 1 % netto, 48 h) + E16 (flaga marży 4 %) | — |
| D-29 › START-1…7 (+„Silnik Workflows”) | §4 / Etap III | Scalenie reguł START z jednym przepływem; silnik reguł | „START-1…7 nadal 0/7 do scalenia” | 397; 175; 323; 339 | E35 | ONE-MECH DONE (seed); TRIAGE: nie domknięte |
| D-6 | §4 Decyzje | Spotkanie ze Scandinavian Express | bez statusu (blokuje etap II) | 373 | poza audytem | — |
| D-7 | §4 Decyzje | Vercel: wyłączenie trenowania modeli (panel) | bez statusu | 374 | poza audytem | sprawa właściciela (l.1057, 1072) |
| D-11 | §4 Decyzje | Właściciel włącza wymaganie 2FA dla HHL_ADMIN | ROZSTRZYGNIĘTE 27.09; wymaganie wyłączone do włączenia | 378 | SPRZECZNE z E37 | E37: 2FA dobrowolne (1C) |
| D-14 | §4 Decyzje | Konwencja kursu NBP — potwierdzenie księgowości | CZEKA | 381 | E16 | E16 rozstrzyga kurs przed rozładunkiem; konwencja po rozładunku w audycie — nie wiem |
| D-15 | §4 Decyzje | Limity ponadnormatywności PL i SE — potwierdzić z przewoźnikiem | do potwierdzenia z przewoźnikiem | 382 | poza audytem | — |
| D-16 | §4 Decyzje | Lista użytkowników do zaproszenia | bez statusu (blokuje R-2) | 383 | poza audytem (dane właściciela) | E6 dodaje imię, nazwisko, telefon |
| D-17 | §4 Decyzje | Rejestracja w KPD GDDKiA | bez statusu (blokuje II-6 PL) | 384 | E2 | — |
| D-18 | §4 Decyzje (+§6) | E-mail do armatora z prośbą o zgodę na odczyt komunikatów | bez statusu; §6: do decyzji koordynatora | 385; 625 | poza audytem | *[09.10: zamknięte — zgody wszystkich armatorów są (`PLAN.md` §5 W20, `../dopiski/D-20261009-1309-01.md` R2)]* |
| EXTERNAL_MESSAGING | §4 Decyzje | Pełne włączenie wysyłki zewnętrznej; SMS do kierowców zablokowane | CZĘŚCIOWO 02.10 | 388 | E42 | E42: 3 transporty w trybie testowym |
| D-21 | §4 Decyzje | Właściciel włącza I-27 „brak zezwolenia blokuje Gotowy” przed R-3 | POTWIERDZONE; przełącznik WYŁĄCZONY | 389 | E31 | E31: zezwolenie „Firma” podpina się samo; SE obowiązkowe tylko „Trasa” |
| D-TELM-ETA | §4 Decyzje | API emtrack + linki podwykonawców dla II-7b | CZEKA | 396 | poza audytem (odłożone) | E44 ⏳ *[09.10: linki — link RIO jest, E44 w P4 (G-24); oficjalne API emtrack nadal czeka (W15)]* |
| D-32 | §4 Decyzje | Zgoda IT KSH (Graph, Sites.Selected) + dane w `.env.local` | CZEKA | 400 | E38 | SharePoint/Graph odłożone |
| D-33 | §4 Decyzje | WT wpisuje do pliku KSH kierowcę, telefon, nr zlecenia, nr rejestracyjny | ROZSTRZYGNIĘTE 30.09, NIE ZROBIONE | 403 | E38 | E38 rozszerza: numery SCX i HHL, 21 kolumn |
| D-83 | §6 / §7 / status 05.10 | Wymiary zestawu każdego transportu (odblokowuje B-3a, H-1, H-3, H-6, D-21) | §6: do decyzji koordynatora; „sprawa właściciela” | 849; 1057; 1072 | E31/E32 (+E9) | dane właściciela 07.10; E32: wysokość 3,75 m |
| D-3 (wdrożenie retencji) | §4 / polecenie 05.10 13:53 | CMR/POD/zdjęcia 3 lata, PDF faktur 5 lat — wdrożyć | ZATWIERDZONE; „wdrożyć retencję” bez statusu | 370; 1088 | poza audytem (retencja) | status niejasny: POSTEP — CSP-RO+D-3 DONE 05.10 (0180) |
| B-3a | §5 Część B | Zezwolenie per firma obok polisy; auto-podpięcie | CZĘŚCIOWO — zezwolenia ⛔ D-83 | 418 | E31 | E31: „Firma” wg rodzaju ładunku i ważności (B-3a: „wg wymiarów”) |
| B-VERIFY-17.3 | §5 Część B | Jeden kanon `design/claude-v2.0/`; kopie usunąć albo oznaczyć | NIEZACZĘTE | 427 | poza audytem | kopie nadal w repo: `docs/watch-tower/claude-v2.0/`, `public/claude-makieta.html` |
| B-Q (+§6 POPRAWKI-Q/B, Q-7, Q-8, Q-10, Q-15) | §5 Część B | Pytania 1–19: powiadomienia, dzwonek, decyzje, statusy, faktury, Stena, język, kokpit, workflow, logowanie, strefy, trasy, statki | NIEZACZĘTE | 455; 943–1006; 1089 | E5/E13, E7, E25, E4, E28, E21, E8, E9, E37, E34, E45 | bez pytań zrobionych w L-* (l.1051) |
| P1-FONT | §5 P3 | Czcionki z repozytorium, zero Google Fonts | DO SCALENIA — `fix/p1-font` | 466 | poza audytem (CSP/CI) | status niejasny: fonty są w `public/fonts`; TRIAGE: 17.10 zrobione przez P1-FONT 03.10 |
| P1-LINT | §5 P3 | 9 błędów stylelint w `src/index.css` | DO SCALENIA — `fix/p1-font` | 467 | poza audytem (CI) | status niejasny (gałąź P1-FONT) |
| P2-TILES | §5 P3 | Kafelki z repozytorium w testach wizualnych | ODŁOŻONE — audyt 06.10 | 468 | poza audytem (brama) | gałąź `feat/p2-tiles-06-10` bez scalenia |
| P3-AND | §5 P3 | Dwa eksportowane komponenty Androida (bramka SMS) | NIEZACZĘTE | 469 | poza audytem (bezpieczeństwo) | — |
| P3-SW | §5 P3 | Dwa trafienia SSRF w `public/sw.js` | NIEZACZĘTE | 470 | poza audytem (bezpieczeństwo) | — |
| P3-ZIP | §5 P3 | Trafienie SSRF w `src/lib/zipDocs.ts` | NIEZACZĘTE | 471 | poza audytem (bezpieczeństwo) | — |
| P3-BRACES | §5 P3 | 8 high w devDependencies (stylelint, braces) | czeka na wydanie poprawki | 472 | poza audytem (zależności dev) | sprawdzane w niedzielnej bramie |
| P3-APK | §5 P3 | Pin akcji (SHA) w workflow APK | ZOSTAJE | 473 | poza audytem (CI) | wraca, gdy token dostanie uprawnienie workflow |
| D-LATER | §5 Część D | API Stena + telematyka + SharePoint | na później, nie zaczynać | 486 | poza audytem (odłożone) | — |
| L-1 | Kolejka L | Automatyczne otwieranie decyzji z ryzyk | DOMKNIĘCIE — 9 typów działa | 497 | E7 | status niejasny |
| L-1b | Kolejka L | 7 typów decyzji bez wyzwalaczy + usunięcie pozycji SG-01 | W TRAKCIE TEJ PACZKI | 500; 527 | E7 (+E38 sprawy z importu) | status niejasny: migracja 0145 w repo; E18 P18 |
| L-3 (wzór A dostawy) | Kolejka L | Alarm awizacji kierowcy dostarczającego (48/12 h przed dostawą) | NA PRODUKCJI; „Wzór A dla dostawy nadal bez alarmu” | 499 | E6/E32 (awizacja z odcinkiem SE) | wzór E (brak GPS 15 min) ≠ E15 (alarm w ruchu po 30 min) |
| L-9 | Kolejka L | Alternatywy rejsu z prawdziwych rozkładów | W TEJ PACZCE | 506 | E7 („Sytuacja na trasie”) | status niejasny; FERRY-STATUS (ZROBIONE) rozszerza L-9 |
| L-11 | Kolejka L | Górny pasek bez numeru etapu | W TEJ PACZCE | 508 | E28 | status niejasny; E28: 10 kafelków według E25 |
| L-12 | Kolejka L | Kreator stref na mapie (tylko HHL) | W TEJ PACZCE | 509 | E34 | status niejasny: migracja 0152 w repo |
| L-13 | Kolejka L | Zalew powiadomień: łączenie duplikatów | W TEJ PACZCE | 510; 589–591 | E5 | status niejasny: POSTEP „L-13 na produkcji” |
| KOPIA-D | Kolejka L | Kopia `usuniete_standard_2026-10-03` na dysk D: | NIEZACZĘTE | 518 | poza audytem (kopie) | kopia jest w R2 |
| E-MAIL-TYG (bez ID) | Polecenie 04.10 17:06 | Co tydzień liczby e-maili produkcji w POSTEP vs szacunek 34; strażnik 80 | bez statusu (stałe) | 591 | poza audytem (monitoring) | — |
| H-6 | Zlecenie HERE | Warstwa przeszkód HERE dla wymiarów, wyłączona do D-83 | NIEZACZĘTE | 564 | E32 (przeszkody jedną linią) | dane D-83 z 07.10 |
| H-7 (+§6) | Zlecenie HERE | Mapa w e-mailach i PDF | NIEZACZĘTE | 565; 899 | poza audytem | status niejasny: B-10 (l.454) „PDF+mapa H-7” |
| H-8 (+§6) | Zlecenie HERE | Profil trasy | NIEZACZĘTE (l.1082: „propozycja”) | 565; 900; 1082 | SPRZECZNE z E17 | E17: profil ukryty; E18 P16: usunąć `route-profile`; E32: „Profil trasy” znika |
| H-10 (+§6) | Zlecenie HERE | Pogoda i wiatr na trasie (ryzyko, ETA) | NIEZACZĘTE (l.1082: „propozycja WYŁ.”) | 565; 897; 1082 | E7/E15 (częściowo) | wiatr na drodze w decyzjach audytu — nie wiem |
| H-12 (+§6) | Zlecenie HERE | Zakazy czasowe | NIEZACZĘTE (l.1082: „święta 0177”) | 565; 898; 1082 | E7 (zakazy jako informacja przy transporcie) | status niejasny |
| SMS-KSH-1H + ETA-PRE-LOAD | Po REJESTR | SMS ≤ 60 min do placu (Śrem, Boden); ETA „–” przed załadunkiem | W TEJ PACZCE — migracja 0158 | 580 | E42 (rodzaj A) + E15 | status niejasny: migracja 0158 w repo; E15: bez harmonogramu UE |
| AIS-SRC | Po REJESTR | Drugie źródło AIS promów, świeżość ≤ 5 min | ZBUDOWANE — pomiar 24 h nie zrobiony | 581 | E23 (+E45) | — |
| H-2-PL (+§6 8.6) | Po REJESTR | Utrudnienia drogowe PL z HERE | DONE 05.10 | 586; 797 | E2 | status niejasny: audyt — „do dodania (w planie H-2-PL oznaczone ✅)” |
| 17.13 | §6 | Współrzędne terminali Gdańsk i Nynäshamn — sprawdzenie na mapie | do decyzji koordynatora (REJESTR: zostaje) | 705 | poza audytem | — |
| T1 | §6 | Baza tworzy ryzyka po polsku | do decyzji koordynatora (REJESTR: do zrobienia) | 1033 | E21 (+E7) | status niejasny: POSTEP wspomina „ANEKS 6 T1–T3” |
| T2 | §6 | Napisy na sztywno spoza słownika | do decyzji koordynatora (REJESTR: do zrobienia) | 1034 | E21 | status niejasny (jw.) |
| T3 | §6 | Format liczb według języka | do decyzji koordynatora (REJESTR: do zrobienia) | 1035 | E21 | E21: jeden moduł formatów PL |
| AUTH-MAIL | §6 / status 05.10 | Szablony e-mail logowania „Watch Tower” | do decyzji koordynatora (TRIAGE: ZOSTAJE P3) | 815; 1071; 1089 | E43 (+E37) | status niejasny: POSTEP — DONE 02.10 przez Management API |
| 11.3 | §6 | Testy ścieżek użytkownika | do decyzji koordynatora → R-3 | 641 | poza audytem | — |
| 7.4 | §6 | Pobieranie notowań z zapisem źródła | ETAP II (REJESTR: w kolejce) | 786 | E3/E39 | status niejasny: PALIWO-AUTO-B ZROBIONE |
| 7.7 | §6 | Dodatki: pilotaż, postojowe, prom, zezwolenia | ETAP I (REJESTR: w kolejce) | 788 | E33 | — |
| 8.4 | §6 | Panel alternatywnych przepraw z przeliczeniem | ETAP II (REJESTR: w kolejce) | 795 | nie wiem | L-9 i FERRY-STATUS dotyczą alternatyw; najbliżej E7 |
| PR1 | §6 | Podtrzymanie: `keep_alive`, Worker Cloudflare co 6 h | do decyzji koordynatora (REJESTR: czeka — Worker czeka na Cloudflare) | 1007 | poza audytem (infrastruktura) | — |
| PR2 | §6 | Kopie `backup-export` 02:30 do R2 | do decyzji koordynatora (REJESTR: cron WYŁĄCZONY — czeka na R2) | 1008 | poza audytem (kopie) | status niejasny: DR-TEST (l.289) odtworzył kopię z R2 |
| PR7 | §6 | Kompresja i archiwizacja plików od 70 % | do decyzji koordynatora (REJESTR: czeka na R2) | 1012 | poza audytem (pliki) | — |
| 17.4, 17.7, 17.8 | §6 | Pełny przebieg prób; martwy MapLibre; brama wizualna pikselowa | do decyzji koordynatora (REJESTR: do zrobienia / zostaje) | 711; 714; 715 | poza audytem | status niejasny: VERIFY-13 17.4/17.8 PASS 06.10 (l.584), CLEAN-MAPLIBRE ZROBIONE (l.587) |
| 12.5 | §6 | Faktoring | do decyzji koordynatora (TRIAGE: ZASTĄPIONE, „faktoring poza zakresem 1.0”) | 654 | SPRZECZNE z E4b | E4b: faktoring 1 % netto, 48 h |
| 9.10 (+„kalendarz”) | §6 / Etap III | Kalendarz do subskrypcji | odłożone po 1.0 | 802; 176 | poza audytem (odłożone) | — |
| 6.9 (+„e-CMR”) | §6 / Etap III | Elektroniczny list przewozowy | odłożone po 1.0 | 781; 177 | poza audytem (odłożone) | E31: tylko CMR z rozładunku |
| 10.9 (+„ślad węglowy”) | §6 / Etap III | Raport śladu węglowego | odłożone po 1.0 | 638; 177 | poza audytem (odłożone) | — |
| 9.9 | §6 | Kanał zespołowy (Slack/Teams) | odłożone po 1.0 | 809 | poza audytem (odłożone) | — |
| SMS 6, 7, 10, 11 | Etap III | SMS 6, 7, 10, 11 (numeracja z PROPOZYCJA_SMS) | bez statusu | 177 | E42 | E42: tylko 4 rodzaje A–D; treści SMS 6/7/10/11 w PLAN brak — czy sprzeczne, nie wiem |
| retencja `files/` w R2 | Etap III | Retencja plików w R2 | bez statusu | 177 | poza audytem (retencja) | — |
| przekazanie Cursorowi | Etap III | Przekazanie Cursorowi | bez statusu | 178 | poza audytem | AGENTS.md (29.09) zastępuje `CURSOR_PROMPT*.md` |
| pozycje D4–D12 audytu | Etap III | „pozycje D4–D12 audytu” | bez statusu | 176 | nie wiem | treści w PLAN brak |
| SG-03 raport po rozładunku | Polecenie 05.10 13:53 | Raport SG-03 po rozładunku (SMS 1 h tylko do właściciela) | bez statusu | 1090 | E15 (kalibracja ETA SG-03) + E26 | status niejasny |

## Czego nie wypisano

- Pozycje z DONE / ZROBIONE / ZAMKNIĘTE / ZASTĄPIONE / NIEAKTUALNE w §3–§5 i w kolejkach L, HERE, Po REJESTR.
- §6 (l.619–1040): 415 ID. 390 jest zamkniętych w `REJESTR_CALOSCI.md` §2/§5 i `TRIAGE_REJESTRU.md` (zrobione, historia, duplikat, zastąpione, kryterium U-3-PALIWO). Wypisano 25, które rejestr zostawia otwarte (w tabeli wyżej, część scalona z pozycją główną), oraz 12.5, D-18 i D-83.
- Decyzje D-77…D-85 z §6 (rejestr: „obowiązuje”), poza D-83, który czeka na wprowadzenie danych.

## Pozycje DONE w PLAN, które audyt zmienia (nie liczone w podsumowaniu)

- I-5 / D-11: 2FA wymagane dla HHL_ADMIN (l.110, 378) → E37: dobrowolne.
- I-21 (l.127): RESOURCE_MISSING kierowca/pojazd → E32: RESOURCE_DEADLINE wyłączyć.
- III-6 (l.167): terminy CMR po załadunku, POD, zdjęcia, rysunek → E31: tylko CMR z rozładunku.
- B-7c (l.448): filtry „brak GPS, ryzyko” → E29: bez filtra „Ryzyko”.
- L-3 wzór E (l.549): brak GPS po 15 min → E15: alarm w ruchu po 30 min, postój po 3 h.
- DEC-5 (l.249): SMS przy strefach → E42: 4 rodzaje A–D, cisza nocna, tryb testowy.

## Podsumowanie liczbowe

- Pozycji otwartych (wierszy tabeli): **110**. 28 z nich ma „status niejasny”.
- Przypisanych do audytu (E..), bez sprzeczności: **54**.
- Sprzecznych z audytem: **6**. W całości: II-3 (E31, E32), D-11 (E37), H-8 (E17), 12.5 (E4b). W części: AUD-06 (E16), AUD-12 (E17).
- Poza audytem: **48**.
- Nie wiem: **2** (8.4, „pozycje D4–D12 audytu”).
- Kontrola: 54 + 6 + 48 + 2 = 110.

## Najważniejsze pozycje „poza audytem” potrzebne do produkcji (20)

| # | ID | Linia | Dlaczego |
|---|---|---|---|
| 1 | R-0 | 141; 593–617 | czyszczenie 94 transportów przed importem; wymaga pisemnej akceptacji |
| 2 | R-3 | 144 | pierwszy prawdziwy transport od importu do faktury |
| 3 | R-4 | 145 | raport końcowy i tag `release-1.0` |
| 4 | SEC-OWASP › CSP | 135; 1086 | przejście CSP z Report-Only na enforce (RO do 12.10) |
| 5 | SEC-OWASP › ZAP | 135; 1087 | pełny skan ZAP na TEST (11.10) |
| 6 | P3-SW | 470 | SSRF w `public/sw.js` |
| 7 | P3-ZIP | 471 | SSRF w `src/lib/zipDocs.ts` |
| 8 | P3-AND | 469 | eksportowane komponenty Androida w bramce SMS |
| 9 | GATE-WEEKLY | 282 | niedzielna brama TEST 11.10 — warunek wdrożeń z migracją |
| 10 | PR2 | 1008 | kopie `backup-export` (w rejestrze cron WYŁĄCZONY) — potwierdzić, że działają |
| 11 | PR1 | 1007 | podtrzymanie bazy (`keep_alive`, Worker) |
| 12 | PR7 | 1012 | kompresja i archiwizacja plików (limit miejsca) |
| 13 | D-3 + retencja `files/` w R2 | 370; 1088; 177 | retencja dokumentów 3/5 lat — w PLAN bez potwierdzenia wdrożenia |
| 14 | AUD-01d | 65 | klucz przeglądarkowy HERE; dziś kafelki idą przez pośrednika |
| 15 | AUD-01e | 64 | jedna mapa na sesję — brak wpisu o scaleniu i wdrożeniu |
| 16 | I-0b | 91 | usunięcie starych wdrożeń Pages (po wycieku I-0) |
| 17 | D-16 | 383 | lista użytkowników — warunek R-2 |
| 18 | D-15 | 382 | limity ponadnormatywności PL/SE potwierdzone z przewoźnikiem |
| 19 | 17.13 | 705 | współrzędne terminali Gdańsk i Nynäshamn (strefy portów, statusy, SMS) |
| 20 | D-7 | 374 | Vercel: wyłączenie trenowania modeli na danych |
