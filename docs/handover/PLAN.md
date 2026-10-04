# PLAN CIĄGŁY — TOWER

> Zapisz jako `docs/handover/PLAN.md`. **Od teraz to jedyna lista pracy.**
> `POSTEP.md` zostaje dziennikiem wykonanego. `SCOPE.md` — rejestrem zakresu.

---

# 1. ZASADY PRACY CIĄGŁEJ

1. **Realizujesz kolejkę z sekcji 3 od góry, bez przerw.** Po zakończeniu
   pozycji: wpis w `POSTEP.md` z liczbami, status w tym pliku, **od razu
   następna pozycja**. Nie pytasz, czy iść dalej. Nie czekasz na akceptację.
2. **Zmiany tylko dopisujemy.** Koordynator przysyła bloki `DOPISZ` (sekcja 2).
   Istniejących pozycji nie przepisujemy — najwyżej oznaczamy
   `ZASTĄPIONA PRZEZ <ID>`.
3. **Pytanie do właściciela nie zatrzymuje kolejki.** Wpisujesz je do
   sekcji 4 (Decyzje oczekujące) i **przechodzisz do następnej pozycji,
   która od niego nie zależy**. Kolejka nigdy nie stoi przez jedno pytanie.
4. **STOP — wyłącznie w tych sytuacjach:**
   - usunięcie albo zmiana prawdziwych danych na produkcji
   - wydanie pieniędzy albo zmiana planu usług
   - wysłanie czegokolwiek do prawdziwych użytkowników z zewnątrz
   - wzorzec zrzutów zmienia się poza zakresem przewidzianym w pozycji
   - dane, które może dać tylko właściciel (stawki, umowy)
5. **Znaleziona luka bezpieczeństwa wysokiej wagi:** naprawiasz od razu,
   jako następną pozycję, bez pytania — i zgłaszasz w raporcie.
6. **Raport:** jeden krótki po każdej zakończonej pozycji (ID, wynik
   liczbami, commit). Właściciel przekazuje raporty koordynatorowi
   w dogodnym momencie — nie po każdym.
7. **Nic nie ginie:** każda pozycja z `SCOPE.md` o statusie innym niż
   DONE musi mieć swoje miejsce w kolejce albo w dzienniku odłożeń.

---

# 2. PROTOKÓŁ DOPISYWANIA

Koordynator przysyła wyłącznie bloki w tej formie:

```
DOPISZ
ID: <etap>-<numer>
Priorytet: P0 | P1 | P2
Opis: …
Kryterium odbioru: …
```

- **P0** — bezpieczeństwo albo bloker: wchodzi jako następna pozycja
  po bieżącej; bieżącej nie przerywasz
- **P1** — bieżący etap, na koniec jego listy
- **P2** — etap późniejszy, na koniec tamtego etapu

---

# 3. KOLEJKA

Statusy: `W TOKU` · `DO ZROBIENIA` · `CZEKA NA: <co>` · `DONE <commit>`

## ETAP I — przed pilotażem (w tej kolejności)

| ID | Opis | Kryterium | Status |
|---|---|---|---|
| I-0 | wyciek plików | stare wdrożenia usunięte, ocena ekspozycji | DONE |
| I-0b | usunięcie poprzednich wdrożeń Pages przy najbliższym logowaniu | lista wdrożeń = 1 | DO ZROBIENIA (przy okazji) |
| I-1 | import w produkcji zapisuje transporty | 41/41 lokalnie, powtórka 0 zmian | DONE |
| I-SEC | strażniki odporne na NULL (`is not true`), `is_hhl()`/`can_see_margin()` tylko true/false | nieaktywne konto każdej roli × każda funkcja z listy dozwolonych = odmowa; test statyczny migracji | DONE 5d375f5 |
| I-BK | kopia zapasowa: tabele wyliczane z katalogu, jawne wykluczenia | tabela spoza kopii i spoza wykluczeń = test czerwony | DONE d2a8219 |
| I-1b | klasa STANDARD dla 9 transportów | import 50/50 | DONE 0c247b3 |
| I-2a | przełącznik ról tylko dla HHL | KSH i SCX go nie widzą | DONE 16638cb |
| I-2c | moduł Workflows ukryty w produkcji | niewidoczny poza trybem demo | DONE 16638cb; od 28.09 (9.4) w produkcji widoczny dla HHL_ADMIN na danych z bazy |
| I-2d | ETA v1 w bazie: odcinek + czasy odcinków + rejs z `sailings`, przeliczana przy zdarzeniu | test na symulacji 11 transportów ze `status.sh` | DONE 16638cb (tests/db/i2.sh 51/51) |
| I-2e | pogoda, przeprawy alternatywne, objazdy SE — ukryte albo „brak źródła danych" | zero danych statycznych w produkcji | DONE a4ff639 |
| I-2f | Opcje BAF — prawdziwy formularz parametrów SEFS i odczytów indeksu, ze źródłem, datą i dziennikiem | zapis i odczyt w produkcji | DONE d912df7 (0052 na produkcji, weryfikacja w wycofanej transakcji) |
| I-2g | kody opóźnień ukryte do uzgodnienia z przewoźnikiem | — | DONE 16638cb |
| I-2h | telefony demo: pula PTS (SE), nieprzydzielalne (PL, LT); SMS i e-mail nigdy w trybie demo | test | DONE 16638cb |
| I-2i | przegląd 37 pozycji „częściowo" — każda działająca tylko w demo trafia tu jako nowa pozycja I-2* | lista w raporcie | DONE (POSTEP § I-2i) |
| I-2j | pozycje promów z bazy (AIS z `ferry-ais`) na mapie zamiast pozycji przykładowych — z I-2i (5.10) | mapa w produkcji pokazuje pozycję z bazy z czasem odczytu albo „brak źródła danych” | DONE 5ed7dd0 |
| I-D9 | (P0, decyzja D-9) nowe wartości `eta_segment_params`: PL 7,5 h ±25%, check-in 3 h, SE 17 h ±20%, przerwy SE 13 h ±30%, przeprawa 18 h bez zmian; odpoczynek dobowy na promie | pasmo i opóźnienie transportu wzorcowego przed/po (transakcja wycofana) | DONE 8d69a40 (±747 → ±1013 min, opóźnienie 390 → 1080 min) |
| I-2k | paczka dokumentów „tydzień” — tylko dokumenty transportów z wybranego tygodnia ISO — z I-2i (6.8) | test: paczka zawiera wyłącznie dokumenty tygodnia | DONE e4b393d |
| I-2l | czas wykrycia odchylenia liczony z `risk_signals` (wykrycie − zdarzenie) zamiast „8 min” — z I-2i (10.7) | kafelek z bazy albo „—” | DONE 825da20 |
| I-10 | e-mail o zmianie daty awizowanego transportu | dostarczenie na adres z plusem | DONE a0d21bc (SENT 21:20) |
| I-3 | bramka SMS według `PROPOZYCJA_SMS.md` + decyzje z `ZLECENIE_ETAP_I.md` | testy z propozycji; 24 h pracy telefonu | CZĘŚĆ BAZOWA DONE (0067–0069) + DEC-5 (0106). **D-4 ZAMKNIĘTE 01.10** (telefon+SIM są). DO ZROBIENIA: aplikacja Android → **I-3-APK** |
| I-5 | 2FA TOTP, wymagane dla HHL_ADMIN (`aal2`) | administrator bez drugiego składnika = odmowa | DONE a548eba (wymaganie wyłączone do D-11) |
| I-4 | instrukcje: kierowca PL/EN/SV, KSH, przewoźnik | dostępne w aplikacji | DONE 3dac401 |
| I-6 | monitoring błędów przeglądarki do własnej tabeli, alarm | błąd testowy widoczny w tabeli | DONE 642d68f |
| I-7 | retencja: dane kierowcy 90 dni | test | DONE 642d68f; dokumenty — decyzja D-3 |
| I-8 | wydajność: cały harmonogram + GPS według PR5, trzy role | czasy liczbami | DONE 642d68f |
| I-9 | `SCOPE.md` koordynatora w repo; Twoje statusy jako §53 | jeden rejestr | DONE (ten commit) — SCOPE = plik koordynatora §0–55 bez zmian + §56 (statusy wykonawcy; §53–55 zajęte przez koordynatora) |
| I-11 | każda pozycja SCOPE 0–11 inna niż DONE ma miejsce w tej kolejce albo w dzienniku odłożeń | zasada 7 spełniona | DONE (ten commit) — SCOPE §56.1: 65 pozycji → miejsce w PLAN albo dzienniku; nowe I-20…I-24, III-2…III-9, D-13…D-15 |
| I-19 | (P1, właściciel 27.09 — luka z I-12) formularz cennika dla HHL w aplikacji: stawki koszt (przewoźnik) i przychód (KSH), przedziały wymiarów i pozycja STANDARD, wersjonowanie (nowa wersja zamiast nadpisania) z dziennikiem zmian, interfejs po polsku; dziś cennik da się zapisać tylko SQL, a od niego zależy R-1. Kwot nie wpisujemy (D-1) | HHL zapisuje wersję cennika w aplikacji, dziennik pokazuje kto/co; KSH i przewoźnik nie zapisują; test bazy + e2e | DONE (ten commit) — 0065: rate_card_save (tylko HHL, nowa wersja per strona+organizacja, walidacja nakładania przedziałów, powód od v2), rate_card_change_log, tylko dopisywanie, RLS odczytu tylko HHL; Opcje → „Cennik HHL” (build produkcyjny); kwot nie wpisano (D-1) |
| I-12 | (P1, D-8, blok właściciela 27.09) cennik — pozycja STANDARD: stała stawka, koszt i przychód osobno, ten sam mechanizm paliwa i kursu; `cargo_class = STANDARD` → pozycja STANDARD; brak stawki = wyraźne ostrzeżenie, nie zero; kwot nie wymyślamy (D-1) | brak stawki → ostrzeżenie; test mechanizmu na stawce testowej | DONE a14a2ac — 0064; kwoty STANDARD czekają na D-1 |
| I-13 | (P1, kolejność P1: 5.; obejmuje D-10) `sefs_parameters.applies_to` (COST / REVENUE / BOTH, domyślnie BOTH); RLS: przewoźnik COST+BOTH, KSH REVENUE+BOTH, HHL wszystko | test bazy: przewoźnik nie widzi wiersza REVENUE, KSH nie widzi wiersza COST | DONE 1d05ea4 — 0063; D-10 zrealizowane tutaj |
| I-15 (stara, D-10) | (P1, decyzja D-10) przewoźnik widzi parametry SEFS tylko do odczytu, wyłącznie wersje `agreed_with_carrier = true` | RLS + test bazy | ZASTĄPIONA PRZEZ I-13 (właściciel 27.09: D-10 w I-13; ID I-15 przejęte przez pasmo ETA niżej) |
| I-17 | (P1, kolejność P1: 1.) 2FA: drugie urządzenie uwierzytelniające w „Weryfikacja dwuetapowa” | dwa składniki, każdy działa niezależnie | DONE 642d68f |
| I-18 | (P1, kolejność P1: 2.; D-12) status daty planu: WSTĘPNA \| POTWIERDZONA (autor, czas). KSH: „Potwierdź daty” na transporcie, z możliwością zmiany; zmiana daty potwierdzonej = zdarzenie + powiadomienie HHL i przewoźnika. Import HHL nie nadpisuje daty potwierdzonej bez osobnego ostrzeżenia i zgody. Ryzyko: brak potwierdzenia N dni przed załadunkiem (N w tabeli parametrów, domyślnie 5). Interfejs odróżnia datę wstępną od potwierdzonej. ANEKS 2 bez zmian (przewoźnik nadal nie zmienia okien KSH) | test bazy + widoki trzech ról | DONE cdbb696 — 0061; SCOPE 16.3 ZASTĄPIONA PRZEZ I-18 |
| I-16 | (P1, kolejność P1: 3.) walidacja ETA na 50 prawdziwych transportach: zapas w godzinach względem planu 5 dni (min, mediana, maks.) + rozbicie transportu testowego D-9 (planowany załadunek, planowana dostawa, rejs, ETA na odcinek); ujemny zapas = najpierw sprawdzić model i rejs | liczby min/mediana/maks. + rozbicie | DONE 4e40ca5 — 30 / 54 / 55 h, 0 ujemnych |
| I-15 | (P1, kolejność P1: 4.) pasmo ETA: odpoczynek dobowy 11 h jako osobny odcinek ±0%, przerwy 2 h ±50%; łączenie niepewności pierwiastkiem z sumy kwadratów zamiast sumy | pasmo przed i po | DONE bfbc974 — 0062; rejs założony 1013 → 433 min |
| I-14 | (P2) `baf_definitions` + `baf_index_values` (0 wierszy) obok `sefs_parameters`/`fuel_index_readings` = dwa źródła prawdy dopłaty paliwowej — wybrać jedno, drugie usunąć (tylko przy 0 wierszy na produkcji) albo opisać | jedno miejsce na parametry, jedno na odczyty | DONE (ten commit) — 0066: jedyne źródło = `sefs_parameters` (parametry) + `fuel_index_readings` (odczyty); `baf_definitions`, `baf_index_values` i `rate_cards.baf_id` usunięte (produkcja: 0/0/0 wierszy; strażnik przerywa migrację przy danych) |
| I-20 | (P2, z I-11: SCOPE 2.6) ogólny dziennik audytu: wyzwalacz na tabelach biznesowych (loads, shipment_items, invoices, rate_*, sefs_*) — kto, kiedy, stara/nowa wartość | test bazy: zmiana każdej tabeli = wiersz w audit_log | DONE 28.09 (0072) — wyzwalacz `trg_audit_row` na 7 tabelach: ROW_INSERT/UPDATE/DELETE, kto, stara/nowa wartość tylko zmienionych kolumn; bez wpisu przy przeliczeniu ETA; dane osobowe kierowcy jako „[dane osobowe]”; odczyt tylko HHL_ADMIN |
| I-21 | (P2, z I-11: SCOPE 4.3) terminy uzupełnienia zasobów (kierowca, pojazd, dokumenty) przed załadunkiem i eskalacja (ryzyko + powiadomienie) | test bazy: brak zasobów N h przed załadunkiem → ryzyko | DONE 28.09 (0073) — `resource_deadlines` (kierowca 48/12 h, pojazd 48/12 h, dokumenty 24/6 h — propozycja do potwierdzenia z SCX, II-3), `detect_resource_deadlines` co 15 min: RESOURCE_MISSING HIGH → CRITICAL, IN_APP przewoźnik (+ HHL przy CRITICAL), auto-zamknięcie po uzupełnieniu |
| I-22 | (P2, z I-11: SCOPE 3.2) kreator mapowania kolumn importu z zapisem szablonu w bazie (HHL) | nowy układ pliku zmapowany i zapamiętany; import 50/50 | **DONE** 28.09 (0077) |
| I-23 | (P2, z I-11: SCOPE 9.8) test odsiewania duplikatów powiadomień (dedup_key) dla wszystkich szablonów | test bazy | DONE 28.09 — `tests/notify-dedup.test.ts` (każdy INSERT do notifications w bazie: dedup_key + on conflict do nothing; 8 szablonów z własnym tekstem PL/EN/SV) + i2 „[I-23]” (unikalny indeks, duplikat odrzucony) |
| I-24 | (P2, z I-11: SCOPE 10.8) eksport raportów do PDF (obok XLSX) | plik PDF z harmonogramu | DONE 28.09 — przycisk „Eksport PDF” obok XLSX w harmonogramie (`src/lib/pdfExport.ts`, pdf-lib + Liberation Sans OFL, ładowane leniwie); A4 poziomo, stronicowanie, bez danych kierowcy i kwot |
| I-25 | (P0, właściciel 28.09) cofnięcie reguły opóźnienia z 0070 (błąd w komunikacie koordynatora): opóźnienie od końca okna dostawy (`plan_delivery_to`, tylko od KSH), a bez okna — od końca dnia dostawy (Europe/Stockholm); import nie ustawia okna | okno 08–12, ETA 18:00 → 360; bez okna ETA 18:00 → 0; bez okna ETA 06:00 nast. dnia → 360; import bez godzin → okno puste (baza i UI identycznie) | **DONE** 28.09 (0080) |
| I-26 | (P1, właściciel 28.09) anon ma INSERT/UPDATE/DELETE na ~20 tabelach `public` (m.in. loads, invoices, invoice_lines, organizations, projects, documents) — blokuje tylko RLS (wzorzec jak `permits` przed 0081): odebrać anon wszystkie uprawnienia tabel (i sekwencji) w `public` + `ALTER DEFAULT PRIVILEGES`; aplikacja kierowcy działa przez funkcje — sprawdzić; przegląd TRUNCATE/REFERENCES/TRIGGER dla authenticated | anon: 0 uprawnień do tabel w `public` (poza `spatial_ref_sys` — chroni wyzwalacz); przebieg kierowcy z linku przechodzi; test w zestawie security | **DONE** 28.09 (0083) |
| I-27 | (P1, właściciel 28.09, przed R-3) brak zezwolenia dla transportu o klasie innej niż STANDARD blokuje przejście do READY („Gotowy”) — przełącznik w tabeli parametrów; włącza właściciel przed pierwszym prawdziwym transportem (D-21). STANDARD bez zezwolenia przechodzi | test: DIMENSIONED bez zezwolenia nie osiąga READY przy włączonym przełączniku | **DONE** 28.09 (0084; przełącznik WYŁĄCZONY — włącza właściciel, D-21) |
| I-28 | (P2, właściciel 28.09) usunąć `load_delivery_day_end` — nieużywana, ignoruje okno dostawy (najpierw sprawdzić brak odwołań) | funkcja usunięta, brama bazy zielona | **DONE** 28.09 (0085) |
| SEC-OWASP | (P1) Na końcu, przed pilotażem. OWASP ASVS poziom 2: lista z wynikiem każdego punktu. OWASP ZAP: skan pasywny produkcji; skan aktywny wyłącznie na teście, nigdy aktywnie na produkcji. Zależności wg OWASP (Dependency-Check albo odpowiednik). Przegląd OWASP Top 10 dla bazy (uprawnienia, RLS, funkcje). Raport z wynikami i planem napraw do właściciela. Nie zaczynać przed kolejką P1-FONT, B-1, B-8-IMP, L-1. | raport u właściciela | NIEZACZĘTE |

## PILOTAŻ I WYDANIE

| ID | Opis | Status |
|---|---|---|
| R-1 | import prawdziwego harmonogramu na produkcję | **otwarte** — RODO/zgody OK; import + stawki (D-1 SYMBOL w bazie) — właściciel |
| R-2 | zaproszenie pracowników HHL, potem KSH, potem przewoźnika | **CZĘŚCIOWO** — właściciel sam dodaje użytkowników w aplikacji; zaproszenia/e-maile do tych kont mogą wychodzić (0133). Lista D-16 nadal u właściciela |
| R-3 | O3b — pierwszy prawdziwy transport od importu do faktury | CZEKA NA: R-2 |
| R-4 | raport końcowy, tag `release-1.0` | CZEKA NA: R-3 |

## ETAP II — po spotkaniu z przewoźnikiem

| ID | Opis | Status |
|---|---|---|
| II-1 | wartości SEFS i ich wprowadzenie | CZEKA NA: D-2 |
| II-2 | kody opóźnień uzgodnione — włączenie w interfejsie | CZEKA NA: spotkanie |
| II-3 | parametry operacyjne: cutoff promu, progi fal, prędkość; potwierdzenie z SCX czasów odcinków D-9 (PL 7,5 h, check-in 3 h, SE 17 h — „szacunek koordynatora”) oraz najpóźniejszej godziny końca załadunku (model: 07:30 dla rejsu 18:00 — POSTEP I-D9-a); odpoczynek na promie NIE jest do potwierdzenia — zamknięty decyzją właściciela (D-9); **pytania do SCX/KSH (propozycje w bazie, HHL zmienia w UI):** (a) terminy zasobów z I-21 — kierowca 48/12 h, pojazd 48/12 h, dokumenty 24/6 h przed załadunkiem; (b) terminy dokumentów z III-6 (`doc_requirements`, widok Dokumenty) — zezwolenie PL 24 h przed załadunkiem, zezwolenie SE 24 h przed promem, CMR i zdjęcia mocowania do 2 h po załadunku, POD do 24 h po rozładunku, rysunek KSH 72 h przed załadunkiem (KSH), polisa — dokument organizacyjny przewoźnika; czy któryś dokument jest nieobowiązkowy; (c) termin awizacji pojazdów pilotujących z III-4 — 48 h przed załadunkiem, alarm krytyczny 12 h (liczba wymagana = maks. z powiązanych zezwoleń) | CZEKA NA: spotkanie |
| II-4 | adapter telematyki przewoźnika | CZEKA NA: spotkanie |
| II-5 | komunikaty armatora w harmonogramie | **DONE** 01.10 (parser + 403=NIEZNANY; D-18 e-mail informacyjny zostaje) |
| II-6 | Trafikverket, ~~TomTom~~ (zastąpiony przez HERE — II-7), KPD — zadania i klucze | **DONE** Trafikverket (01.10); TomTom/KPD nadal bez kluczy/cert |
| II-7 | (decyzja właściciela 28.09 — zmiana) serwis tras = **HERE Routing API v8** zamiast TomTom: `transportMode=truck`, trasa przez punkty pośrednie z zezwolenia | **ZABLOKOWANE przez D-28** (regulamin HERE — `RAPORT_HERE_REGULAMIN.md`); nic z HERE nie implementujemy |
| II-7a | (P1, decyzja właściciela 28.09) **warunek włączenia II-7:** twardy limit w kodzie **25 000 transakcji HERE / miesiąc** — po limicie zero zapytań do końca miesiąca, ETA v1, ryzyko dla HHL + e-mail; alarm przy 80%; przeliczenie najwyżej co 15 min i tylko dla jadących transportów. Przed podpięciem GPS — sprawdzenie dosłownego regulaminu HERE: (a) czy plan podstawowy wyklucza śledzenie pojazdów / telematykę, (b) zakaz przechowywania wyników — zapisujemy tylko ETA, bez trasy, (c) podanie źródła w szczegółach ETA; cytaty klauzul w raporcie; **jeśli (a) wyklucza użycie — STOP i do właściciela.** Klucz HERE wyłącznie w sekretach funkcji Edge. Analiza regulaminu — osobny wątek (`RAPORT_HERE_REGULAMIN.md`); implementacji nie zaczynać przed tym raportem | **ZABLOKOWANE przez D-28** — wynik regulaminu 28.09: STOP, plan podstawowy HERE wyklucza „Asset Management” (śledzenie + wyznaczanie tras dla pojazdu); potrzebny plan Enterprise lub asset-based ([RAPORT_HERE_REGULAMIN.md](RAPORT_HERE_REGULAMIN.md)) |

## ETAP III — po pilotażu

**III-1** (P2) kalibracja czasów odcinków ETA po 5 transportach — mediana i rozrzut każdego odcinka z wjazdów/wyjazdów stref; PROPOZYCJA zmian do zatwierdzenia przez HHL, nigdy cicha zmiana (odbiór: raport odcinków z liczbami i propozycją) — SZKIELET GOTOWY (ten commit): `scripts/iii1/calibration.sql` (tylko odczyt, produkcja: n = 0), samotest `scripts/iii1/selftest.sql`, szablon `RAPORT_KALIBRACJI_ETA.md`; dane — po 5 transportach ·
**III-2** (P2, z I-11: SCOPE 0.1, 0.3, 0.7–0.10, 11.4) domknięcie wierności wizualnej — 0.1, 0.7 DONE 28.09 (`tests/stylesheet-mockup.test.ts`, naprawiony dryf `kbd`, DESIGN_SYSTEM §7a); 0.8–0.10 DONE 28.09 (`tests/visual-states.spec.ts`: 11 zrzutów stanów, próg 0,1%, w pre-push; szkielet i stan pusty harmonogramu jak w makiecie; tryb systemowy = motyw roli wg 17.9); 0.3/11.4 **DONE 28.09 (wariant lokalny)**: pełna brama `OK 840/840 kod 0` na `42a72c7` (po naprawie `gate.sh`, uodpornieniu narzędzia i klasyfikacji 162 ujęć — `G4_WZORZEC.md`); historia: `npm run gate:visual` (własny build i port 4188, 840 ujęć, próg 0,1%, ~70 min — poza pre-push) = 665/840, 175 ujęć Dokumenty + Harmonogram to dryf funkcji dodanych po wzorcu 27.09 (III-6, I-22/I-24), nie III-2 → D-25 wykonane (139), 36 ujęć → III-13 ·
**III-3** (P2, z I-11: SCOPE 1.1) osobne środowisko testowe Supabase i testy bazy w GitHub Actions (dziś tylko lokalny hook) — DONE 28.09 (wariant lokalny): pełna brama `tests/db/gate.sh` w hooku pre-push na lokalnym Postgresie + bezpiecznik `local-only.sh`; drugi projekt Supabase i Actions odrzucone (slot/usypianie, PLAN §1.4, rozliczenia) — decyzja w POSTEP; `docs/ci/db.yml` gotowy, gdyby właściciel włączył Actions ·
**III-4** (P2, z I-11: SCOPE 4.5) pojazdy pilotujące: dane i awizacja — DONE 28.09 (0087: `load_escorts` + `load_escorts_set` / `load_escort_status`, termin ESCORT 48/12 h w awizacji — PROPOZYCJA do II-3; dane osobowe pilota — D-22) ·
**III-5** (P2, z I-11: SCOPE 5.10, 5.13) mapa: unikanie kolizji etykiet, odtwarzanie przebiegu w czasie — DONE 28.09 (0088 `load_track`; rozkładanie nakładających się znaczników ≥ 22 px w buildzie produkcyjnym; warstwa „Ślad” = odtwarzanie przebiegu GPS z bazy) ·
**III-6** (P2, z I-11: SCOPE 6.1, 6.2) dokumenty: wymagalność i terminy per kategoria w bazie, wersjonowanie dokumentu — DONE 28.09 (0078; terminy startowe = PROPOZYCJA do potwierdzenia z SCX/KSH) ·
**III-7** (P2, z I-11: SCOPE 7.10) pełna ścieżka sporu i akceptacji faktury — DONE 28.09 (0079; korekta z załączonym PDF w UI — 0082) ·
**III-8** — (numer zarezerwowany, nieużyty) ·
**III-9** (P2, z I-11: SCOPE 10.4, 10.6) widok placu budowy tylko do odczytu (opcjonalny), ocena przewoźnika — 10.6 DONE 28.09 (0089: `carrier_ratings`, `carrier_rate_load` tylko HHL po rozładunku 1–5, `carrier_scorecard` — karta w Opcjach, ocena w szufladzie; widoczność dla przewoźnika — D-23); 10.4 (widok placu budowy, opcjonalny) → D-24 ·
**III-10** (P2, decyzja właściciela 28.09) pobieranie odczytów EU Weekly Oil Bulletin (publiczne, bezpłatne) do `fuel_index_readings` — gotowe, ale WYŁĄCZONE do D-2 (który indeks wybierze przewoźnik) — **ZROBIONE 28.09** (0092, funkcja Edge `fuel-wob`, przełącznik `FUEL_WOB_INGEST` wyłączony; włączenie po D-2 — patrz POSTEP III-10) ·
**III-11** (P2, decyzja właściciela 28.09) źródło pogody morskiej dla trasy Gdańsk–Nynäshamn: porównanie otwartych danych (np. FMI, SMHI) — licencja do użytku komercyjnego, zasięg, częstotliwość. Tylko raport, nic w UI — **ZROBIONE 28.09** (`RAPORT_POGODA_MORSKA.md`: propozycja FMI WAM + DMI WAM, CC BY 4.0, bez klucza; Open-Meteo i IMGW odpadają — komercyjnie płatne) ·
**III-12** (P2, decyzja właściciela 28.09) lista otwartych pozycji Etapu III niezależnych od właściciela; jeśli istnieje audyt dostępności — wykonać — **ZROBIONE 28.09** (lista: `III12_LISTA_ETAP_III.md`; audyt: `RAPORT_DOSTEPNOSC.md` — pola bez nazw 36 → 0, klawiatura 1402 → 362, kontrast → D-27) ·
**III-13** (P2, korekta właściciela 28.09 — NIE decyzja właściciela, pozycja robocza) 36 ujęć wypisanych w D-25 (12 × Harmonogram 1920, 18 × Dokumenty HHL 1280–1920, 6 × Harmonogram HHL sv 390/768/1280): dla każdego ujęcia znaleźć commit, który wprowadził różnicę; pogrupować; każdą grupę zaklasyfikować jako zamierzoną (opis w `G4_WZORZEC.md`: ujęcia, commit, powód) albo regresję (naprawa w kodzie + test); dopiero potem odświeżyć wzorzec tych ujęć — tak jak 13 ujęć kokpitu — **ZROBIONE 28.09** (3 grupy, commity `16638cb`, `f7bda8b`, `bc31ac1`, `db3d5e3`; wszystkie zamierzone, regresji 0; wzorzec 36 ujęć odświeżony — `G4_WZORZEC.md` §III-13) ·
Silnik Workflows · źródło pogody morskiej · polisy z przypomnieniem o wygaśnięciu (SCOPE 6.6 — część bazowa DONE 28.09, 0097; harmonogram, formularz i notka → D-30) · walidator zezwoleń i wymiarów (DONE 28.09, 0081 — SCOPE 6.5; formularz zezwoleń w UI = SCOPE 6.4 — **DONE 28.09 (0086)**: szuflada → Dokumenty → „Zezwolenia transportu”, HHL i przewoźnik transportu, KSH tylko odczyt) ·
pozycje D4–D12 audytu · integracja SharePoint (zgoda IT KSH) · kalendarz ·
e-CMR · ślad węglowy · SMS 6, 7, 10, 11 · retencja `files/` w R2 ·
audyt dostępności (**wykonany 28.09**, kontrast → D-27) · przekazanie Cursorowi.

---


## PACZKA 30.09 — kolejka (dopisana 29.09, rozszerzona 30.09 po odbiorze zleceń)

Źródła w `docs/handover/`: `PACZKA_DECYZJI_30_09.md`, `ZLECENIE_CENNIK_SEFS.md`,
`ZLECENIE_SHAREPOINT.md`, `ZLECENIE_POGODA_DROGI_ETA.md`,
`ZLECENIE_PO_SPOTKANIU_SCX.md`, `ZLECENIE_DECYZJE_POWIADOMIENIA.md`.
Pliki cen / SEFS / harmonogram: `D:\Watch Tower\dane\` (poza gitem).
**Nowsze wygrywa** ze sprzecznymi wcześniejszymi (§0 każdego zlecenia).

### Potwierdzenie odbioru (30.09) — lista identyfikatorów

**PACZKA_DECYZJI_30_09:** D-1, D-2, D-8 (nieaktualne), D-27, D-28, D-29, D-29t,
D-30, D-31, D-32, D-33, D-34 (SEFS=załadunek — zamknięte w PO_SPOTKANIU §0),
D-35, I-29, I-30, I-31, I-32, I-33, I-7a, II-5, II-6, II-7, II-7b, II-8, II-9, II-10.

**ZLECENIE_PO_SPOTKANIU_SCX:** §0 (zastąpienia), §1 logowanie hasłem, §2 telematyka,
§3 Stena Line, §4 awizacja Dodaj/Edytuj, §4a numer HHL, §5 powiadomienia KSH,
§6 opóźnienie/czas, §7 daty z pliku KSH, §8 opłaty ręczne (zastępuje auto I-32),
§9 faktury EUR/PLN, §10 administrator, §11 historia zmian, §12 interfejs,
§13 zezwolenia (czeka na dane), §14 telefon/instalacja, §15 nazwa i logo.

**ZLECENIE_DECYZJE_POWIADOMIENIA:** §0, §1 telefony bez kierunkowego, §2 centrum
decyzji, §3 powiadomienia, §4 widoczność, §5 SMS strefy, §6 ustawienia admina.

**ZLECENIE_CENNIK_SEFS:** I-30, I-31, I-32 (auto → zastąpione przez §8 ręczne).

**ZLECENIE_SHAREPOINT:** II-10, I-7a, D-32, D-33.

**ZLECENIE_POGODA_DROGI_ETA:** II-5, II-6, II-7, II-7b, II-8, II-9, I-29.

### Potwierdzenie uzupełnienia (01.10) — od koordynatora

Przyjęte identyfikatory: **II-10-E1**, **II-10-E2**, **ONE-MECH** (D-29 + D-29t),
**I-7a** (SHAREPOINT §1a — bez mechanizmu wycofania zgody), **CLEAN-TT-HERE** (P2).

1. **II-10 — dwa etapy.** Etap 1: witryna STEGRABODEN **tylko ODCZYT**; wszystkie
   testy zapisu wyłącznie na kopii `harmonogram_TEST_WatchTower.xlsx` w osobnej
   witrynie/bibliotece testowej; identyfikator pliku testowego **na sztywno**
   w konfiguracji — zapis do innego pliku = błąd. Etap 2 (zapis do pliku
   produkcyjnego) **dopiero po pisemnej akceptacji właściciela**. Dane dostępu
   (Tenant ID, Client ID, sekret) — właściciel wpisze do `.env.local` po
   odpowiedzi IT KSH (D-32).
2. **ONE-MECH.** Centrum decyzji (DECYZJE §2), ryzyka, reguły automatyzacji
   i powiadomienia (§3) — **jeden przepływ**, zero podwójnych alarmów.
   Tabela D-29 pokazuje, co zastępuje co (D-29t = treść tabeli w planie).
3. **I-7a (P1).** Pełne dane kierowcy i auta dla KSH **na stałe**
   (SHAREPOINT §1a). Mechanizmu wycofania zgody **nie budujemy**.
4. **CLEAN-TT-HERE (P2).** Usunąć martwy kod i zmienne TomTom i HERE
   (`TOMTOM_API_KEY` itd.) — silnik ETA jest własny (II-7 / D-28).

| ID | Opis | Kryterium | Status |
|---|---|---|---|
| I-33 | P0. Kopia 29.09 zawieszona (RUNNING, finished_at puste). Przyczyna, ponowienie, strażnik RUNNING > 30 min → ERROR + e-mail. Sprawdź nocną | strażnik w cronie; test; nocna OK | DONE (ten commit, 0098) |
| ENV-0a | .gitattributes `* text=auto eol=lf` + renormalize | commit | DONE a2b38f18 |
| ENV-0b | vitest: CRLF / suma makiety / hunspell skip Windows | 0 failed | DONE a2b38f18 (530 passed / 36 skip) |
| ENV-0c | baza testowa watch-tower-test (emkbykwenwrjmbprydml) | brama hosted zielona | DONE 894a684e — pominięte w tej sesji |
| ENV-0e | usuń VITE_TRAFIKVERKET_API_KEY — tylko TRAFIKVERKET_API_KEY | brak VITE_ w vite/env | DONE a2b38f18 |
| AUTH-1 | P0. Logowanie hasłem (PO_SPOTKANIU §1): zaproszenie→ustaw hasło; e-mail+hasło; reset; strona pośrednia „Dalej”; bez zaproszenia zero e-maili | 20 kont / 5 min bez e-maila; skaner nie zużywa tokenu | DONE (ten commit, 0099) — live 20 kont przy R-2 |
| I-30 | P0. Cennik według symboli (zastępuje I-12/I-19). Transkrypcja vs JSON — różnica=STOP. Kwoty skryptem z `D:\Watch Tower\dane` | test pozycji; strażnik kwot; 95 HH | **DONE** (ten commit) — 0100 SYMBOL; verify OK; map HH 87/95 (8× KR bez daty=NO_CONVOY); load TEST+PROD |
| I-31 | P0. SEFS: OKQ8 + Orlen; mnożnik=niższy; tydzień 28.09–04.10 = **1,14** | test 1,14; progi; awaria | **DONE** (ten commit) — 0101; unit+db 1,14; load tabel TEST+PROD |
| DEC-2 | P0. Centrum decyzji — pełny proces (DECYZJE §2) | katalog decyzji + akcje + eskalacja | **DONE** (ten commit) — 0102/0103 + **0126** skutki opcji (`decision_apply_effect`); UI hint → szuflada |
| DEC-3 | P0. Powiadomienia — każde zdarzenie/status/ryzyko/decyzja (DECYZJE §3) | macierz + kanały | **DONE** (ten commit) — 0104 decyzje; **0126** status/ryzyko/strefy przez `matrix_notify`; **0127** mapowanie kind→grupa (RESOURCE_MISSING ≠ RISK_FERRY_WEATHER) |
| DEC-4 | P0. Widoczność — admin wybiera firmy (DECYZJE §4) | macierz per typ | **DONE** (ten commit) — 0105 UI + egzekwowanie w `matrix_notify` (IN_APP/EMAIL × firma) |
| BRAND-15 | P1. Nazwa i logo Watch Tower (PO_SPOTKANIU §15, `public/brand`) | favicon, splash, manifest, zero „TOWER” w UI | **DONE** 57527034 — e-mail Auth (nadawca) = dashboard Supabase |
| AWIZ-4 | P1. Awizacja „Dodaj"/„Edytuj" + okno (PO_SPOTKANIU §4) | przebieg HHL/SCX | **DONE** (ten commit) — modal; Ustalenia bez formularza awizacji; rejsy „zdąży”; tracking→telematics_vehicle_id; zapis zwrotny KSH = II-10 |
| HHL-4a | P1. Numer HHL — dodawanie/edycja przez HHL (§4a) | test bazy + UI | **DONE** — Dodaj/Edytuj + pole w awizacji/szufladzie; zapis SharePoint = II-10-E2 / D-33 |
| RESP-14 | P1. Telefon i instalacja PWA (§14) | ujęcia 390/768; Lighthouse | **DONE** — SW+offline+menu; brama `tests/resp14-phone.spec.ts` 390/768 OK; LH viewport+a11y; §12 user w menu (UI-12). Pełny installable = HTTPS prod |
| DEC-5 | P1. SMS przy strefach — 2+2 osoby (DECYZJE §5); brak SMS do kierowców | test bramki | **DONE** (ten commit) — 0106; dec5 **11/11**; UI Opcje; bufor Śrem; wyzwalacze |
| DEC-6 | P1. Ustawienia administratora (DECYZJE §6) | sekcje zwijane | **DONE** — układ + **0107** progi + **0110** dziennik Auth + baner + eksport CSV/XLSX; stan systemu (kopie/integracje/bramka SMS) |
| I-3-APK | P0 (akceptacja 01.10). Aplikacja bramki Android: PULL `sms_pull`/`sms_report`/`sms_heartbeat`, APK + instrukcja instalacji; token parowania w Opcjach (nigdy w repo/logach); numer SIM w ustawieniach app; SMS test → właściciel → potem wyzwalacze §5; stan w „Stanie systemu” | APK + instrukcja; parowanie; test SMS; cisza >15 min w UI | **DONE** — APK 1.0.3; burst **10/10 DELIVERED**; strefy ON (**0116**). Zamknięte decyzją koordynatora 02.10 |
| SMS-DELIV | P0. Burst 10/10 DELIVERED → włączenie wyzwalaczy stref §5 | 10/10 DELIVERED; SMS_ZONE_APPROACH+ENTER = true | **DONE** — burst 10/10; migracja **0116** PROD+TEST: strefy **ON** |
| TEL-1 | P1. Telefony zawsze bez kierunkowego (DECYZJE §1) | zapis/odczyt | **DONE** — `toNationalPhone` + awizacja + import + eksport + SMS (E.164 dopiero przy enqueue); **0111** `driver_phone_country` |
| DATY-67 | P1. Daty z pliku KSH + opóźnienie (§6–7); usunąć „Potwierdź daty" (I-18) | UI + powiadomienia | **DONE** (ten commit) — 0113 |
| II-10-E1 | P1. SharePoint etap 1: STEGRABODEN **tylko odczyt**; zapis testowy wyłącznie do `harmonogram_TEST_WatchTower.xlsx` (ID pliku na sztywno — inny plik = błąd). Tylko HH; NTG nie. Creds po D-32 → `.env.local` | 95 HH odczyt; zapis tylko test; strażnik ID | DO ZROBIENIA — **zastępuje** wcześniejszy wiersz II-10 do czasu E2 |
| II-10-E2 | P1. SharePoint etap 2: zapis do pliku produkcyjnego — **tylko po pisemnej akceptacji właściciela** | akceptacja na piśmie + test pętli | CZEKA NA: akceptację właściciela po E1 |
| I-7a | P1. KSH widzi na stałe pełne dane kierowcy i auta (SHAREPOINT §1a). **Bez** mechanizmu wycofania zgody | test widoczności KSH + eksport | **DONE** (ten commit) — 0114 |
| ONE-MECH | P1. Jeden przepływ: decyzje (§2) + ryzyka + reguły + powiadomienia (§3); zero podwójnych alarmów. Tabela D-29t **zaakceptowana 01.10** (warunek: żaden alarm bez zastępnika — lista było→jest w POSTEP) | tabela zaakceptowana; brak dubli w testach | **DONE** (seed) — wf-1…12 wyłączone z mapowaniem D-29t (MONEY/SYSTEM dla 7/10–12); auto-run usunięty; klik strefy→Transport; wf w prod = podgląd. Silnik START/cron — poza zakresem (macierz) |
| OPL-8 | P1. Opłaty wyłącznie ręcznie (§8; zastępuje auto I-32) | brak auto-dopłat | **DONE** (ten commit) — 0115 |
| FAK-9 | P1. Faktury EUR lub PLN przy wystawieniu (§9) | wybór waluty | **DONE** (ten commit) — weryfikacja M6/invoices3 |
| ADM-10 | P1. Administrator może wszystko (§10) | impersonacja/override z audytem | **DONE** (ten commit) — **0117**; adm10 **8/8**; „Działaj jako” + pasek + audit acting_as |
| HIST-11 | P1. Pełna historia zmian (§11) | UI historii | **DONE** (ten commit) — **0118**; hist11 **11/11**; Opcje „Historia zmian” |
| STENA-3 | P1. Stena Line Gdynia–Karlskrona jak Polferries (§3) | słowniki, strefy, ETA | **DONE** (ten commit) — 0119/0120 + rozkład/status JSON AEM w `ferry-schedule`/`ferry-status` (źródło `STENA`); AIS Digitraffic z portem Karlskrona. **Luki → II-7/8/9:** ETA odcinki, pogoda, opóźnienie AIS; Digitraffic 01.10: 0 pozycji Spirit/Estelle/Ebba (brak ≠ opóźnienie); współrzędne terminali do potwierdzenia mapą |
| II-5 | P1. Komunikaty armatorów — włączyć odczyt teraz | parser; 403=NIEZNANY | **DONE** (ten commit) — Polferries 403→NIEZNANY+ryzyko; Stena status z JSON; testy ferry+integrations |
| II-6 | P1. Trafikverket — LIVE (klucz w sekretach Edge; RoadCondition+WeatherMeasurepoint; Situation usunięty z Open API) | `corridor_conditions.SE_E4.slowdown_mult` (+15% śnieg/śliskość → II-7) | **DONE** — **0121** + cron **0131** `tower-road-se` `*/15`; panel SE czyta bazę (nie fasadę) |
| II-7 | P1. Własny silnik ETA na OSM (ODbL). HERE nie | postęp GPS, odpoczynek, prom | **DONE** (ten commit) — **0122** PROD+TEST; `corridor_polylines` + `compute_load_eta` v2 (OSM locate, SE×II-6, rejs GDN-NYN/GDY-KAA, odpoczynek I-15); ryzyko OFF_CORRIDOR + ETA_BREACH; UI attribution ODbL |
| II-7b | P1. Kalibracja ucząca się (zastępuje III-1) | symulacja 30 transportów | **SZKIELET** (ten commit) — **0123** tabele obserwacji/wersji + freeze HHL_ADMIN; pełna nauka **CZEKA NA TELM-2** (GPS po rozładunku) |
| II-8 | P1. Pogoda FMI+DMI+SMHI; progi 3,8 m / 40 kn potwierdzone | źródło w UI | **DONE** — **0124**; cron **0131** `tower-ferry-weather` `15 * * * *` (co 1 h; było co 6 h) |
| II-9 | P1. Opóźnienie wypłynięcia z AIS; brak pozycji ≠ opóźnienie | test | **DONE** (ten commit) — `aisDepartureDelayMin` + ferry-ais przed odejściem; brak pozycji = brak wniosku; Edge wdrożony; ferry testy +3 |
| TELM-2 | P1. Szkielet telematyki (§2) — czeka na API emtrack i linki | adapter + GPS z telematyki | CZEKA NA: docs API emtrack, przykłady linków |
| I-29 | P1. Budżety darmowych planów na 140 transportów | tabela szczyt vs limit | **DONE** (ten commit) — `I29_BUDGETY_140.md`; wszystkie limity OK (Edge ~5%, baza ~14%, Resend ~40%) |
| UI-12 | P2. Interfejs (§12) | użytkownik/rola/Wyloguj w menu; bez POD/mocowania | **DONE** (ten commit) — Nav session; Docs/Schedule bez POD/LASHING; Driver tylko CMR |
| D-27 | P2. Kontrast ≥ 4,5:1; ewentualnie #7C909E | tylko kolory tekstu | **DONE** (ten commit) — --ink-3 #5A6B78/#788C9A; --amber-ink; bell #0E1A24; kursor default na thead/tr |
| D-30 | P2. Polisy: cron + formularz HHL/przewoźnik (bazowa 0097 DONE) | UI + detect dzienny | **DONE** (ten commit) — **0125**; formularz Dokumenty; cron `tower-polisy` |
| D-31 | P2. Pasek górny 390 px — naprawa | wzorzec tylko 390 | **DONE** (ten commit) — CSS ≤430: bez lang/roleswitch, overflow clip; test RESP-14 390 OK. **Wzorzec 390 → G4-WZORZEC (decyzja właściciela)** |
| D-29t | P2. Tabela nakładania reguł START → **część ONE-MECH / D-29** (nie osobny tor) | tabela w planie przed włączaniem | ZASTĄPIONA PRZEZ ONE-MECH |
| CLEAN-TT-HERE | P2. Usunąć martwy kod/zmienne TomTom i HERE (TOMTOM_API_KEY, job traffic-flow TomTom, i18n źródła itd.). ETA = II-7 | zero aktywnego TOMTOM/HERE w kodzie i env | **DONE** (ten commit) — traffic-flow DEMO; parsery TomTom usunięte; i18n wycofane; ZRODLA §2.3 |
| ZEZW-13 | P2. Zezwolenia (§13) | — | CZEKA NA: wymiary aut |
| GATE-WEEKLY | P1. Co niedzielę: brama TEST (`emkbykwenwrjmbprydml`) w częściach, nie jednym procesem. Podstawowa brama na co dzień jest lokalna (`tests/db/gate.sh`, Postgres 17). TEST także jako ostateczne potwierdzenie przed wdrożeniem. | exit 0; wynik liczbami w POSTEP.md | **RYTM** — najbliższa niedziela: **11.10.2026** (4.10 brama TEST poszła przy 0143) |
| GATE-I30-I31 | P0. EXPECTED i30=10, i31=6 w `test-db-gate.mjs` + subset — brama kończy kodem 0 | subset i30+i31 exit 0 | **DONE** `b34a2236` (potwierdzenie exit 0: 02.10) |

### Przed pilotażem (P1, kolejność 02.10) — dopisane zleceniem właściciela

| ID | Opis | Kryterium | Status |
|---|---|---|---|
| DR-TEST | Odtworzenie ostatniej kopii z R2 na projekt TEST (`emkbykwenwrjmbprydml`). Klucz age tylko lokalnie na czas próby (nigdy repo/logi) | wiersze tabel = kopia; czas odtworzenia w POSTEP | **DONE** — 67 tabel / 4920 wierszy / 20 s (`restore_20261002`) |
| SIM-1 | Symulacja pełnego transportu na TEST — zmyślony GPS Śrem→Gdańsk→prom→Nynäshamn→Boden: statusy, ETA, decyzje, powiadomienia; SMS tylko na numer właściciela | raport krok po kroku w POSTEP | **DONE** — pełny tor → AT_SITE; SMS OWNER; e-mail BLOCKED_R2 (oczekiwane) |
| LOAD-1 | Test obciążenia na TEST — 140 transportów, 20 jednoczesnych użytkowników (3 role); czasy kokpitu, harmonogramu, mapy | liczby w POSTEP | **DONE** — seed 140/570 ms; kokpit p50 386 ms, harmonogram 319, mapa 88 |
| DOC-ROLE | 1-stronicowe instrukcje dla KSH, przewoźnika i HHL (PL); także w aplikacji (panel „Instrukcja”) | 3 PDF/teksty + panel UI | **DONE** — `docs/handover/instrukcje/{HHL,KSH,SCX}.md`; panel Guide (`i4_*`) w Opcjach/Ustawieniach |
| DAILY-1 | Codzienny e-mail o 7:00 tylko do administratora — kopie, integracje, bramka SMS, błędy z ostatniej doby | cron + treść; test na adres właściciela | **DONE** — 0129+0130; okno 24 h OK; sms_failed=seria anulowana 01.10; Leaflet+lazyRetry |

### Stan kolejki (02.10)

Aktywna kolejka przed pilotażem: **DR-TEST → SIM-1 → LOAD-1 → DOC-ROLE → DAILY-1**.
Bez nowych funkcji poza tą listą. Blokery danych (IT KSH, emtrack, wymiary, OCP) zostają w sekcji 4.

### Kolejność po PR #2 (03.10)

Po scaleniu PR #2: **P1-FONT → B-1 → B-8-IMP → L-1**. **SEC-OWASP** jest na końcu planu, przed pilotażem (nie zaczynać wcześniej). Aikido i CodeRabbit nie blokują scalenia.

### Potwierdzenie akceptacji koordynatora (01.10 — popołudnie)

Przyjęte identyfikatory: **DEC-CLICK** (a/b/c), **D-29t** (z warunkiem zastępników),
**D-4** (telefon+SIM — zamknięte), **PUSH+PROD** (0105–0107 + brama + vercel --prod),
**I-3-APK** (dokończenie bramki Android).

1. **DEC-CLICK — zaakceptowana.** (a) LOADING_UNCONFIRMED, SEQUENCE,
   DATES_UNCONFIRMED, USAGE_LIMIT, JOB_FAILURE (poza kopią) → grupa C, bez nowych
   typów decyzji. (b) klik w czyste zdarzenie statusu/strefy → zawsze Transport,
   bez mini-akcji. (c) grupa D: usunąć odwołania do „driver PWA” (D-38 — ukryta).
2. **D-29t — zaakceptowana** pod warunkiem: żaden obecny alarm nie znika bez
   zastępnika; lista „było → jest” w POSTEP.md.
3. **I-3 / D-4:** telefon Android + SIM są — dokończyć APK, token parowania,
   numer w ustawieniach app, SMS test na numer właściciela, stan w SystemStatus.

### ONE-MECH / D-29t — tabela nakładania (**zaakceptowana 01.10**, warunek zastępników)

Cel: **jeden przepływ** (decyzja ↔ ryzyko ↔ powiadomienie). Reguły seed `wf-*`
i crony DB nie mogą dublować centrum decyzji / macierzy / SMS.
Silnik START / cron reguł — dopiero po scaleniu ONE-MECH (lista było→jest w POSTEP).

| Reguła / mechanizm | Warunek → akcja dziś | Nakłada się z | Propozycja |
|---|---|---|---|
| START/wf-3 „Cichy pojazd” + `detect_silent_vehicles` | brak GPS > N min → ryzyko + mail | ryzyko `SILENT` + powiadomienia RISK + ewentualnie decyzja | **zostawić DB** `detect_silent_vehicles` jako źródło ryzyka; **wyłączyć** wf-3; decyzja tylko gdy eskalacja (katalog DEC) |
| START/wf-1 Bufor 50 km Boden | wejście PRE_ARRIVAL → status + notify | geofence engine + DEC-5 SMS stref + macierz LOAD_STATUS | **zostawić silnik stref**; powiadomienia tylko przez macierz §3/§4; **nie** osobny wf-1 |
| START/wf-8 Bufor przed portem / Plan B | PRE_PORT + cutoff → ryzyko prom | ryzyko FERRY + decyzja plan B + powiadomienia | **ryzyko + decyzja**; wyłączyć osobny wf-8 jako drugi alarm |
| START/wf-4 Ryzyko promowe | status rejsu ≠ ON_TIME → notify | to samo ryzyko FERRY + DEC | **jedno** zdarzenie ryzyka → macierz + decyzja; wf-4 wyłączyć |
| START/wf-5 Zmiana daty awizowanej | import zmienia datę → mail + ack | I-10/I-18 / DATY-67 + decyzja potwierdzenia dat | **DATY-67 + decyzja**; wf-5 wyłączyć |
| START/wf-2 Brak zezwolenia 48 h | cron → mail SCX + eskalacja HHL | I-27 wymóg zezwoleń + decyzja / powiadomienie | **decyzja + macierz**; wf-2 wyłączyć po podpięciu DEC |
| START/wf-6 POD po rozładunku | UNLOADED → task 24 h | dokumenty + SMS 9 + decyzja | **jedna** ścieżka dokumentów/SMS 9; wf-6 nie dubluje |
| SMS 5 / 9 (DEC-5 + D-19) | strefy / brak GPS / POD | ryzyka + decyzje | SMS **tylko** z macierzy/wyzwalaczy §5; bez drugiego toru z wf |
| Opóźnienie z ETA (II-7) | ETA > plan + próg | ryzyko DELAY + decyzja opóźnienia | **ryzyko → decyzja**; bez osobnego maila z wf |
| START/wf-9 Trafikverket | sytuacja HIGH/CRIT na SE | ryzyko ROAD_SE + powiadomienia | ryzyko + macierz; wf-9 wyłączyć |
| START/wf-7…12 (faktury, factoring, PERIOD, marża) | crony / snapshoty | MONEY / SYSTEM w macierzy | po ONE-MECH: albo macierz SYSTEM/MONEY, albo zostawić wyłączone do osobnej decyzji |

Po akceptacji: kod scala ścieżki (ONE-MECH), `canSeeWorkflows` / fasada wf → tylko podgląd historyczny lub usunięcie UI kreatora do SCOPE 9.4.

**Czeka na dane właściciela:** API emtrack, linki podwykonawców, wymiary aut, polisy OCP (dane od przewoźnika), zgoda IT KSH (D-32) + wpis creds SharePoint do `.env.local`; certyfikat KPD GDDKiA (D-17).

Pliki cen, umowa i harmonogram: `D:\Watch Tower\dane\` (poza gitem).
Przekazanie 29.09 przerwało pracę **przed pierwszym commitem** I-30; kolejka niżej = obowiązująca.

| ID | Opis | Kryterium | Status |
|---|---|---|---|
| I-30 | P0. Cennik według symboli (zastępuje model I-12/I-19). Niezależna transkrypcja xlsx/docx vs `CENNIK_STEGRA.json` — każda różnica = STOP. Kwoty skryptem z pliku lokalnego, nie migracją. PL-1/PL-10.1/PL-17.1 jak PL-B. Konwój = liczba KR z tą samą datą załadunku | test każdej pozycji; strażnik: żadnej kwoty cennika we froncie; mapowanie 95 HH | ZASTĄPIONA PRZEZ tabelę powyżej (ta sama treść, status DO ZROBIENIA) |
| I-31 | P0. SEFS … | … | ZASTĄPIONA PRZEZ tabelę powyżej |
| I-7a | P1. KSH widzi… | … | ZASTĄPIONA PRZEZ tabelę powyżej (uzupełnienie 01.10: bez wycofania zgody) |
| II-5 | P1. Odczyt komunikatów… | … | ZASTĄPIONA PRZEZ tabelę powyżej |
| II-10 | P1. SharePoint… | … | ZASTĄPIONA PRZEZ II-10-E1 / II-10-E2 |
| II-7 | P1. Własny silnik ETA… | … | ZASTĄPIONA PRZEZ tabelę powyżej |
| II-7b | P1. Kalibracja… | … | ZASTĄPIONA PRZEZ tabelę powyżej |
| II-8 | P1. Pogoda… | … | ZASTĄPIONA PRZEZ tabelę powyżej |
| II-9 | P1. Opóźnienie AIS… | … | ZASTĄPIONA PRZEZ tabelę powyżej |
| I-32 | P1. Opłaty auto… | … | ZASTĄPIONA PRZEZ OPL-8 (ręczne §8) |
| I-29 | P1. Budżety… | … | ZASTĄPIONA PRZEZ tabelę powyżej |
| D-29t | P1. Tabela START… | … | ZASTĄPIONA PRZEZ ONE-MECH |
| II-6 | P1. Trafikverket | — | ZASTĄPIONA PRZEZ tabelę powyżej |

# 4. DECYZJE OCZEKUJĄCE — WŁAŚCICIEL

Wpisujesz tu każde pytanie i idziesz dalej.

| ID | Sprawa | Blokuje |
|---|---|---|
| D-1 | **ZREALIZOWANE** (I-30): cennik SYMBOL w bazie (TEST+PROD), kwoty wyłącznie skryptem z `D:\Watch Tower\dane` | R-1, I-30 |
| D-2 | **ZREALIZOWANE** (I-31): SEFS hybrid_min w bazie; III-10 WOB wyłączone (niezgodne z umową). Potwierdzenie SCX (pyt. 9) nie blokuje | I-31 |
| D-3 | retencja zdjęć, CMR, POD | część I-7 |
| D-4 | ~~telefon i SIM~~ — **ZAMKNIĘTE 01.10:** telefon Android + karta SIM są (koordynator). Dokończenie = I-3-APK | I-3-APK |
| D-5 | **DONE 02.10** (właściciel): umowy RODO / zgody załatwione — odblokowanie zaproszeń i e-maili do kont dodanych w aplikacji (0133); pełne EXTERNAL_MESSAGING nadal osobna decyzja | R-2 |
| D-6 | spotkanie ze Scandinavian Express | etap II |
| D-7 | Vercel: wyłączenie trenowania modeli (panel) | — |
| D-8 | ~~wycena ładunków STANDARD~~ — **ROZSTRZYGNIĘTE 27.09**, potem **NIEAKTUALNE 30.09:** transporty „Standard” należą do NTG (inna firma) i nie są importowane. Osobna stawka STANDARD niepotrzebna. Klasa zostaje tylko jako obrona (HH + Standard = ostrzeżenie) | — |
| D-9 | ~~parametry odcinków ETA v1~~ — **ROZSTRZYGNIĘTE 27.09:** wartości wpisane (I-D9, 0054); obsada jednoosobowa, przeprawa = dobowy odpoczynek na promie (potwierdzone przez właściciela, bez postoju w Nynäshamn); czasy PL/check-in/SE do potwierdzenia z SCX w II-3. Wartości 0054 zostają; opóźnienie 390 → 1080 min wynika z nowych czasów (+3 h jazdy + 8,5 h odpoczynku = 690 min) — NIE błąd (POSTEP I-D9-a) | — |
| D-10 | ~~widoczność SEFS dla przewoźnika~~ — **ROZSTRZYGNIĘTE 27.09:** przewoźnik widzi parametry tylko do odczytu, wyłącznie wersje uzgodnione (`agreed_with_carrier = true`) → **I-13** (właściciel 27.09; pierwotnie I-15) | I-13 |
| D-11 | **ROZSTRZYGNIĘTE 27.09:** właściciel włącza wymaganie dopiero po I-17 (drugie urządzenie). 2FA (I-5): właściciel zapisuje TOTP (Opcje → „Weryfikacja dwuetapowa” → kod QR → kod) i klika „Włącz wymaganie”; do tego czasu egzekwowanie `aal2` dla HHL_ADMIN jest wyłączone (`security_flags.MFA_HHL_ADMIN = false`) | I-5 |
| D-12 | **ROZSTRZYGNIĘTE 27.09:** ostateczne daty załadunku i rozładunku podaje KSH (→ I-18). Termin potwierdzenia N — do uzgodnienia, domyślnie 5 dni. INFO: plan KSH = 5 dni od odbioru do dostawy | I-18 |
| D-13 | ~~podglądy wdrożeń~~ — **ZAMKNIĘTE 28.09 (zastąpione):** podglądy Vercel za Vercel Authentication i wyłącznie na danych demo; podglądy Pages wyłączone. SCOPE 1.6 = zamknięte przez zastąpienie (stan paneli: POSTEP, wpis D-13) | SCOPE 1.6 |
| D-14 | (z I-11: SCOPE 7.5) konwencja kursu NBP (tabela A z dnia roboczego przed rozładunkiem) — **CZEKA:** właściciel pyta księgowość | SCOPE 7.5 |
| D-15 | (z I-11: SCOPE 3.8) limity ponadnormatywności PL i SE — zebrane z podstawą prawną w [LIMITY_PONADNORMATYWNOSC.md](LIMITY_PONADNORMATYWNOSC.md) (zebrane 28.09), **do potwierdzenia z przewoźnikiem** | SCOPE 3.8 |
| D-16 | lista użytkowników do zaproszenia: imię i nazwisko, e-mail, firma, rola | R-2 |
| D-17 | rejestracja w KPD GDDKiA: najpierw firma, potem użytkownik z certyfikatem | II-6 (Polska) |
| D-18 | e-mail do armatora z prośbą o zgodę na odczyt komunikatów (informacja — odczyt II-5 już włączony) | II-5 DONE; oficjalny kanał |
| D-34 | **ROZSTRZYGNIĘTE 01.10:** klucz Trafikverket w sekretach Edge + `.env.local` — II-6 LIVE (RoadCondition + WeatherMeasurepoint). Situation usunięty z Open API dostawcy | II-6 DONE |
| D-STENA-COORDS | **DONE 02.10** (właściciel potwierdził terminale). Współrzędne: Gdynia 54.53321, 18.54425; Karlskrona 56.16460, 15.63080 — obowiązują w geofence STENA-3 | STENA-3 geofence |
| D-20 | **CZĘŚCIOWO 02.10:** RODO/zgody załatwione (R-1/R-2). **0133:** e-mail do kont `app_users` + aktywnych zaproszeń `user_invites` = PENDING (nie BLOCKED_R2); SMS do kierowców nadal zablokowane (`EXTERNAL_MESSAGING` = false). Pełne włączenie: `admin_set_external_messaging(true)` gdy HHL zdecyduje | R-2 |
| D-21 | **POTWIERDZONE 28.09 (właściciel): właściciel włącza przed pierwszym transportem.** **DZIAŁANIE WŁAŚCICIELA przed pierwszym prawdziwym transportem (R-3):** włączyć przełącznik I-27 „brak zezwolenia blokuje Gotowy” dla klas innych niż STANDARD — Opcje → „Wymóg zezwoleń (transporty ponadnormatywne)” → „Włącz wymóg” (konto HHL_ADMIN; wpis w audit_log). Stan na 28.09: przełącznik jest, **WYŁĄCZONY** (produkcja nie ma jeszcze zezwoleń w bazie) | R-3 |
| D-22 | ~~dane kierowcy pojazdu pilotującego~~ — **ROZSTRZYGNIĘTE 28.09 (właściciel): TAK** imię i telefon, te same zasady co kierowca: retencja 90 dni, dostęp przez funkcję danych kontaktowych, KSH nie widzi, nie ma w eksporcie KSH | III-4 → **DONE 28.09 (0090)** |
| D-23 | ~~widoczność ocen dla przewoźnika~~ — **ROZSTRZYGNIĘTE 28.09 (właściciel): TAK** przewoźnik widzi swoje oceny i punktualność; wewnętrzne notatki HHL (komentarz) niewidoczne | III-9 → **DONE 28.09 (0091)** |
| D-24 | ~~widok placu budowy~~ — **ZAMKNIĘTE 28.09 (właściciel) przez SCOPE 16.1:** Stegra nie jest rolą, tylko strefą/POI. Bez nowej roli; SCOPE 10.4 nie będzie realizowany | — |
| D-25 | ~~odświeżenie wzorca Dokumenty/Harmonogram~~ — **ZATWIERDZONE WARUNKOWO 28.09 (właściciel):** każde ze 175 ujęć sprawdzić — różnica wyłącznie w miejscu nowych elementów (terminy, „Zmień”, wybór tygodnia, „Wgraj aktualizację”, „Eksport PDF”) → do wzorca; różnica poza tymi obszarami → wypisać, NIE aktualizować. `gate:visual` ma działać bez nadzoru (jeden skrypt, kod wyjścia, linia podsumowania w `/workspace/wt-gate-visual/last.txt`), właściciel uruchamia go co noc, wynik trafia do POSTEP | III-2 (0.3) → **WYKONANE 28.09:** 139 ujęć odświeżonych, 36 wypisanych (niezaktualizowanych); `gate:visual` bez nadzoru → `last.txt` |
| D-27 | **ZATWIERDZONE 30.09 · DONE (ten commit):** każdy kolor tekstu na każdym tle obu motywów ≥ 4,5:1; jeśli #788C9A nie przejdzie na panelu ciemnym — #7C909E. Wzorzec: zmieniają się wyłącznie kolory tekstu, zero przesunięć. Reszta z audytu 28.09 (`RAPORT_DOSTEPNOSC.md`): `--ink-3`, ostrzeżenia, kursor bez akcji | SCOPE 11.5 |
| D-28 | **ROZSTRZYGNIĘTE 30.09: HERE — nie**. II-7 DONE (0122, OSM). II-7b szkielet 0123; nauka CZEKA NA TELM-2 | II-7 DONE; II-7b częściowo |
| D-TELM-ETA | **CZEKA.** API emtrack + przykłady linków podwykonawców (TELM-2) — bez GPS po rozładunku nie domykamy II-7b (symulacja 30 / uczenie tempa) | II-7b, TELM-2 |
| D-29 | **AKCEPTACJA 01.10 (D-29t + warunek zastępników).** Tabela w PLAN zaakceptowana; żaden alarm bez zastępnika (lista w POSTEP). Scalenie kodu = pozycja ONE-MECH. START-1…7 nadal 0/7 do scalenia | ONE-MECH |
| D-30 | **DONE (ten commit).** Część bazowa 0097 + **0125**: cron `tower-polisy` 04:10 UTC, zatwierdzanie HHL (`insurance_policy_approve`), formularz w Dokumentach (HHL/SCX), notka z bazy. Dane polisy od przewoźnika — po spotkaniu | 6.6 |
| D-31 | **DONE (ten commit).** Pasek górny ≤430 px: bez wystawania (ukryty lang+roleswitch, brand ściśnięty, overflow clip). Test `resp14-phone` 390 OK. **Odświeżenie ujęć 390 w shots-baseline — tylko po G4_WZORZEC + zgodzie właściciela (G4-D27-D31)** | wygląd 390 px |
| D-32 | **CZEKA.** Zgoda IT KSH (Graph, `Sites.Selected`, witryna STEGRABODEN). Po odpowiedzi IT: właściciel wpisuje Tenant ID / Client ID / sekret do `.env.local`. Do E2: odczyt STEGRABODEN + zapis tylko do pliku testowego (II-10-E1) | II-10-E1 |
| G4-D27-D31 | **DONE** 02.10 (zgoda koordynatora). Odświeżono: 11× `stan-*` + 4× smoke Playwright oraz **840/840** `shots-baseline` — wyłącznie przyczyny D-27/D-31/BRAND-15/RESP-14/UI-12; bez przyczyny = 0. Opis: `G4_WZORZEC.md` | gate:visual |

| D-33 | **ROZSTRZYGNIĘTE 30.09, NIE ZROBIONE.** TOWER wpisuje do pliku KSH: kierowca, telefon, nr zlecenia, nr rejestracyjny (nowa kolumna „Nr rejestracyjny (TOWER)”). Godzin załadunku i rozładunku nie wpisuje. Realizacja w II-10-E2 (po akceptacji) | II-10-E2 |
| DEC-CLICK | **AKCEPTACJA 01.10.** (a) grupy C bez nowych typów: LOADING_UNCONFIRMED, SEQUENCE, DATES_UNCONFIRMED, USAGE_LIMIT, JOB_FAILURE (poza kopią). (b) status/strefa → zawsze Transport, bez mini-akcji. (c) grupa D bez „driver PWA” (D-38). Routing klików w ONE-MECH / DEC-3 | ONE-MECH / DEC-3 |

# 5. ZLECENIE 02.10 — POPRAWKI (NIEZACZĘTE)

Źródło: `docs/handover/ZLECENIE_POPRAWKI_02_10.md`. Dopisane przy przejęciu (część A). **Nie realizować**, dopóki właściciel nie zaakceptuje. Część C wygrywa z zapisami separatorów w części B.

## Część B — NIEZACZĘTE

| ID | Opis | Status |
|---|---|---|
| B-1 | Mapy: pojazdy tylko z prawdziwych pozycji GPS (brak pozycji = brak znacznika). Warstwy stref, portów, korytarza, promów i sytuacji drogowych zostają. Na produkcji brak danych przykładowych. | **DO SCALENIA** — `fix/b-1` |
| B-2a | Ryzyka: brak wypłynięć Steny | NIEZACZĘTE |
| B-2b | Ryzyka: brak widoczności warunków drogowych w SE | NIEZACZĘTE |
| B-2c | Centrum decyzji: jak działa i dlaczego puste — opisać logikę, nie zgadywać | NIEZACZĘTE |
| B-3a | Dokumenty: zezwolenie per firma obok polisy; auto-podpięcie do trasy wg wymiarów; polisa auto do każdej trasy | NIEZACZĘTE |
| B-4a | Finanse: przychód — pilotaż i dodatki mają zniknąć | NIEZACZĘTE |
| B-4b | Załącznik: zostaje samo CMR (bez POD) | NIEZACZĘTE |
| B-5 | Automatyzacje: brak przycisku nowej automatyzacji | NIEZACZĘTE |
| B-6a | Opcje: logika i workflow „Powiadomienia i decyzje” | NIEZACZĘTE |
| B-6b | Odbiorcy SMS i strefy: po co strefy i co robią | NIEZACZĘTE |
| B-6c | Progi i terminy: jak działa mechanizm | NIEZACZĘTE |
| B-6d | Stan systemu: styl dashboardu (teraz nieczytelne) | NIEZACZĘTE |
| B-6e | Dziennik logowań nic nie pokazuje | NIEZACZĘTE |
| B-6f | Historia zmian: „200” obok przycisku — usunąć z wyglądu, jeśli nie pełni roli | NIEZACZĘTE |
| B-6g | Cennik: rozjazd tabeli w prawo | NIEZACZĘTE |
| B-6h | SEFS/BAF: czy średnia PL i SE z poprzedniego tygodnia uzupełnia indeksy i liczy opłatę | NIEZACZĘTE |
| B-6i | Wymóg zezwoleń: rozjazd wizualny w prawo | NIEZACZĘTE |
| B-7a | Mapa: stały rozmiar, całość widoczna przy otwarciu (nie wysokość tabeli) | NIEZACZĘTE |
| B-7b | Checkboxy mapy zawsze widoczne; na telefonie nie nachodzą | NIEZACZĘTE |
| B-7c | Filtry mapy i tabeli: znaczenie, logika, propozycja nowych | NIEZACZĘTE |
| B-8 | Harmonogram: mapowanie pól, godziny, ciągnik, linie, szerokość kolumn, ETA, statusy, polisa, rok w datach, kierowca/telefon, PDF, filtr dat | NIEZACZĘTE |
| B-8-IMP | Wydzielone z B-8 (D-8, decyzja A). Import: wiersz TYP = STANDARD (kolumna Typ albo „Standard” w wymiarach) jest pomijany, reszta wchodzi. To nie błąd. Komunikat informacyjny: „Zaimportowano X transportów. Pominięto Y wierszy typu STANDARD (ładunki NTG — poza zakresem Watch Tower).” Y w historii importu (`stats.skipped_standard`). Ta sama zasada przy przyszłej synchronizacji SharePoint — nie budować jej teraz. Decyzja właściciela 03.10 (D-8): zapisane STANDARD usunąć. Robi to wyłącznie migracja 0137 — 42 kody i tylko gdy typ = STANDARD, razem z wierszami zależnymi. Innych transportów nie rusza. Import pomijania zostaje (PR #5). | USUNIĘCIE — migracja 0137, po bramie na teście |
| B-9 | Górny pasek filtrów: logika; usunąć cyfry w kafelku; propozycje ułatwień | NIEZACZĘTE |
| B-10 | Podgląd zlecenia, edycja/awizacja, przepięcie, Status/Historia, dokumenty, ceny, ustalenia, lista KSH, rejsy Steny | NIEZACZĘTE |
| B-Q | Pytania o logikę 1–19 (powiadomienia, dzwonek, decyzje, statusy, alternatywy, faktury opłacone, Stena w pasku, bez EN/SV, tryb jasny, zegar, responsywność, kokpit, workflow 3 kont, logowanie, strefy, trasy OSM, statki, ulice) | NIEZACZĘTE |

Szczegół punktów B-8, B-10 i B-Q jest w zleceniu, słowo w słowo. Tu tylko pozycje kolejki — bez realizacji.


### P3 — średnie z lokalnego skanu 03.10 (nie blokują kolejki)

Feed Aikido wyłączony (400). Pięć średnich, bez numerów CVE. Nie krytyczne i nie wysokie.

| ID | Opis | Status |
|---|---|---|
| P1-FONT | Czcionki z repozytorium (Barlow 400/500/600/700, Barlow Condensed 500/600/700, woff2 + OFL), zero fonts.googleapis.com i fonts.gstatic.com, także w CSP. W tej samej gałęzi P1-LINT. Wzorce odświeżone w środowisku bramy. | **DO SCALENIA** — `fix/p1-font` |
| P1-LINT | 9 błędów stylelint w `src/index.css` (`clip`, `#brandSub`, `#roleLbl`, siedem `!important`) naprawione bez wyłączania reguł. Ta sama gałąź co P1-FONT. | **DO SCALENIA** — `fix/p1-font` |
| P2-TILES | W testach wizualnych mapa korzysta z kafelków zapisanych lokalnie w repozytorium (bez pobierania z sieci), żeby aktualizacje u dostawcy nie psuły bramy. Na produkcji bez zmian. | NIEZACZĘTE |
| P3-AND | Dwa eksportowane komponenty Androida w manifeście bramki SMS (score 60) | NIEZACZĘTE |
| P3-SW | Dwa trafienia SSRF w `public/sw.js` | NIEZACZĘTE |
| P3-ZIP | Trafienie SSRF w `src/lib/zipDocs.ts` | NIEZACZĘTE |
| P3-BRACES | Osiem high w devDependencies łańcucha stylelint: braces, fast-glob, globby, micromatch, stylelint, stylelint-config-recommended, stylelint-config-standard, stylelint-declaration-strict-value. GHSA-vfj7-8cjw-p6xm. Nie trafiają do aplikacji. Najnowszy braces na npm to 3.0.3, poprawka niewydana. | czeka na wydanie poprawki; sprawdzenie w niedzielnej bramie |
| P3-APK | Pin akcji w `.github/workflows/sms-gateway-apk.yml` (SHA zamiast @v3/@v4). Czy w ogóle potrzebny, skoro APK budujemy lokalnie. Dobra zmiana bezpieczeństwa. Zostaje. Wraca, gdy token dostanie uprawnienie workflow. | ZOSTAJE |


## Część C — NIEZACZĘTE (wygrywa z separatorami w B)

| ID | Opis | Status |
|---|---|---|
| C-SEP | Separator „ / ” domyślnie. „\|” tylko w Watch Tower, gdy przy dodawaniu lub edycji awizacji SCX zaznaczy checkbox Przepięcie. Zapis do Excela SharePoint zawsze „ / ”. Brak drugiej wartości: „Kierowca Odbierający / ...” (SharePoint) oraz tabela pięciu sytuacji ze zlecenia | NIEZACZĘTE |

## Część D — na później, nie zaczynać

| ID | Opis | Status |
|---|---|---|
| D-LATER | API Stena + telematyka + SharePoint (notatki właściciela) | na później, nie zaczynać |


## Kolejka L i pozostałe polecenia koordynatora (03.10)

Źródło: `docs/handover/POLECENIA_KOORDYNATORA.md` i `docs/handover/LOGIKA_SYSTEMU.md`. Istniejących wierszy nie ruszano. P2-TILES, P3-APK i SEC-OWASP już są w planie — tu tylko odesłanie, bez drugiej kopii.

Kolejność od 03.10 21:02: L-1 (domknięcie: 9 typów, 0140) → L-2 → L-3 → L-1b → L-4 → L-5 → L-13 → L-6 → L-7 → L-8 → L-9 → L-10 → L-11 → L-12 → część B od początku (pozycje zrobione w L oznacz „zrobione w ramach L-x”) → SEC-OWASP → część D po danych od właściciela. SEC-OWASP, P2-TILES, P3-APK i część D nie startują w tym przebiegu.

| ID | Opis | Kryterium | Status |
|---|---|---|---|
| L-1 | P1. Automatyczne otwieranie decyzji. Każde ryzyko, które w tabeli DEC-CLICK (część B) ma typ decyzji, otwiera decyzję z katalogu 16 typów. Jedno zdarzenie = jedna decyzja (bez duplikatu przy ponownym wykryciu tego samego ryzyka). Zamknięcie ryzyka nie kasuje decyzji — decyzja ma własny status. ETA po terminie nie otwiera się z samego planu: potrzebna pozycja albo awizacja. Źródło: B 2c, pytanie 3; LOGIKA §1. | Test dla typów, które mają zdarzenie w kodzie: zdarzenie → decyzja otwarta, drugie wykrycie → brak drugiej decyzji; brak danych → bez decyzji. Na TEST centrum decyzji pokazuje decyzje z symulacji SIM-1. | **DOMKNIĘCIE** — 9 typów ze zdarzeniem w kodzie działa (0138 + 0140, zestaw `dec-auto` 24/24 na 1a3a96f). Nie blokuje reszty. Siedem typów bez zdarzenia w kodzie nie jest wymyślonych: pozycja L-1b, zaraz po L-3. Scalenie i wdrożenie 0140 w tym poleceniu. |
| L-2 | P1. Kto decyduje. Rozstrzygnąć decyzję może tylko firma wskazana w katalogu (kolumna „kto decyduje”) oraz administrator. Odmowa w bazie (funkcja), nie tylko ukryty przycisk. Źródło: B 2c; LOGIKA §1. | Test: właściwa firma może, inna dostaje odmowę z bazy. | **ZROBIONE** — migracja 0139. Przewoźnik rozstrzyga typ CARRIER, operacje HHL typ HHL, administrator HHL każdy typ. Inna firma i KSH dostają odmowę z `decision_resolve`. |
| L-3 | P1. Osiem progów podłączonych do alarmów: próg opóźnienia, wyprzedzenie dat KSH, awizacja ostrzeżenie/krytyczne, dokumenty ostrzeżenie/krytyczne, brak pozycji GPS, zjazd z trasy. Źródło: B 6c; LOGIKA §4. NO_AWIZACJA (próg awizacji 48/12 h) jest w tym zakresie i zasila L-1b. Wzory właściciela 2026-10-04 00:07 są w LOGIKA §4 i poniżej tej tabeli (w PLAN nie ma sekcji 5; L-3 jest w kolejce L). | Dla każdego wzoru: zmiana wartości w Opcjach zmienia moment alarmu; brak danych = brak alarmu; ostrzeżenie → krytyczne = ta sama decyzja. | **NA PRODUKCJI** — migracja 0143. Wzór A dla dostawy nadal bez alarmu (brak kolumny kierowcy dostarczającego, C-SEP). Reszta wzorów A (załadunek), B–F jest w 0143. |
| L-1b | P1, zaraz po L-3. Siedem typów decyzji z katalogu (ZLECENIE_DECYZJE_POWIADOMIENIA.md §2, tabela DEC-CLICK), których wyzwalacze nie były w kodzie. Nie wymyślać alarmów spoza katalogu. NO_AWIZACJA → w ramach L-3 (próg awizacji 48/12 h). KSH_ROW_GONE, TOWER_KSH_CONFLICT, KSH_FILE_ERROR → przy obecnym imporcie Excela: wiersz zniknął względem poprzedniego importu; pole zmienione w Watch Tower różni się od pliku; pliku nie da się odczytać. SharePoint później użyje tego samego. SEFS_OUT_OF_TABLE → indeks poza tabelą 51 progów albo brak źródła. KR_OVER_3 → więcej niż 3 ładunki KR jednego dnia. DWELL_OVER_FREE → postój w strefie ponad czas wolny (gdy będą prawdziwe pozycje GPS). | Zestaw bramy `dec-auto`: test dla każdego z tych siedmiu typów (zdarzenie → decyzja, drugie wykrycie → bez duplikatu). | **W TRAKCIE TEJ PACZKI** — 0144 usuwa jedną pozycję testową SG-01. 0145 otwiera KSH_ROW_GONE, TOWER_KSH_CONFLICT (tylko numer HHL), KSH_FILE_ERROR (plik nieczytelny), SEFS_OUT_OF_TABLE, KR_OVER_3. NO_AWIZACJA zostaje w 0143. DWELL_OVER_FREE: parametry w Opcjach (sekcja „Czas wolny i przestój", WSTĘPNE), decyzja 15 z podpowiedzią, bez automatycznej dopłaty (0147). |
| L-4 | P1. Cele kliknięć i link w e-mailu. | Test: ten sam cel z kokpitu, listy ryzyk, dzwonka i e-maila; typ bez celu odrzucony. | **DOMKNIĘTE** — `CELE_KLIKNIEC.md` sekcja E (15:47): SMS_FALLBACK → wpis bramki SMS (tylko HHL i administrator); WORKFLOW_ALERT → Status transportu albo podgląd reguły. Typ spoza tabeli nadal Szczegóły wpisu i błąd testu. |
| L-5 | P1. Dzwonek. Bez napisu „przeczytane”. Pozycja znika z listy po kliknięciu i prowadzi do celu z L-4. Źródło: pytanie 13. | Test: klik → pozycja znika, licznik maleje, otwiera cel. | **ZROBIONE** — bez napisu „przeczytane”; klik oznacza pozycję i zdejmuje ją z listy; licznik to długość listy; cel z L-4. |
| L-6 | P1. „Ponów kopię” uruchamia kopię zapasową (dziś tylko zapisuje prośbę, LOGIKA §1). | Klik uruchamia kopię, a wynik (udana/nieudana) widać w Stanie systemu. | NIEZACZĘTE |
| L-7 | P1. Nazwy statusów „opóźniony” i „cichy”. Na liście harmonogramu oba mają własną polską nazwę. Źródło: B 8, pytanie 4; LOGIKA §5. | Na liście harmonogramu oba statusy mają własną polską nazwę. | NIEZACZĘTE |
| L-8 | P1. Kafelki kokpitu. Kafelek KSH „Wymaga decyzji” liczy tylko to, co KSH widzi. Kafelek przewoźnika pokazuje bieżący tydzień zamiast stałego „tydzień 38”. Źródło: pytanie 12; LOGIKA §11. | Test liczb dla każdej firmy. | NIEZACZĘTE |
| L-9 | P1. Alternatywy dla rejsu. Na produkcji lista z prawdziwych rozkładów w bazie — najbliższe rejsy Polferries i Stena. Bez danych zmyślonych. Objazdy w Szwecji zostają ukryte. Źródło: pytanie 5; LOGIKA §9. | Lista z bazy; brak rozkładów = komunikat „Brak danych”. | NIEZACZĘTE |
| L-10 | P1. Opis trzech ścieżek pracy. Plik `docs/handover/WORKFLOW_FIRM.md`: trzy schematy krok po kroku (HHL, KSH, Scandinavian Express), od zaproszenia do zamknięcia transportu, prostym językiem, ze schematami Mermaid. To opis, nie automat. Źródło: pytanie 14. | Plik w repozytorium. | NIEZACZĘTE |
| L-11 | P1. Górny pasek bez numeru etapu. Usunąć numer etapu (1–9) z kafelków; liczba transportów zostaje. Źródło: B 9, decyzja właściciela 03.10. | Numer etapu znika z kafelka, liczba transportów zostaje. | NIEZACZĘTE |
| L-12 | P1. Kreator stref z mapą, tylko HHL: ustawianie i przesuwanie środka na mapie, podgląd koła i zapasu, kraj, kogo powiadomić, usuwanie. Nowa strefa nie startuje na środku Bałtyku. Źródło: B 6b, pytanie 16, decyzja właściciela 03.10; LOGIKA §14. | HHL tworzy, przesuwa, edytuje i usuwa strefę na mapie; SMS ze strefy działa według kraju i rodzaju (test). | NIEZACZĘTE |
| L-13 | P1, po L-5. Zalew powiadomień. Symulacja SIM-1 dała 155 powiadomień dla jednego transportu. Rozbicie według typu, odbiorcy i firmy; łączenie duplikatów. | Ponowna symulacja SIM-1: liczba powiadomień na transport i firmę w raporcie, bez duplikatów tego samego zdarzenia. | **W TEJ PACZCE** — 0148. Ten sam klucz zdarzenia bez zegara. Szacunek poczty przy 94 i przy 10 w ruchu. Skrót niekrytycznych (DIGEST, bez wysyłki). Strażnik 80/95/100. E-mail decyzji automatycznych NIE włączony. |
| B-KSH | P2. Lista harmonogramu KSH: klik otwiera boczny panel tylko z „Edytuj”. KSH edytuje daty i godziny załadunku i rozładunku. | Klik → panel tylko z Edytuj; zapis dat i godzin. | NIEZACZĘTE |
| B-REJSY | P2. Rejsy — część B zlecenia, sekcja REJSY, jako osobna pozycja. | Osobna pozycja planu zrealizowana według sekcji REJSY. | NIEZACZĘTE |
| Q-11a | P2. Pięć rozmiarów ekranu. | Pięć rozmiarów sprawdzonych. | NIEZACZĘTE |
| Q-11b | P2. Powiadomienia na Android i iOS. | Powiadomienia działają na Androidzie i iOS. | NIEZACZĘTE |
| KOPIA-D | P3. Dograć kopię `usuniete_standard_2026-10-03` na `D:\Watch Tower\dane\`, gdy komputer domowy będzie włączony. | Plik na dysku D: i suma SHA-256 zgodna z kopią. | NIEZACZĘTE — komputer Domowy był offline 03.10; kopia jest w R2 |
| AUDIT-PROD | Zasada: blokują tylko luki wysokie i krytyczne w zależnościach produkcyjnych (`npm audit --omit=dev --audit-level=high`). Zależności deweloperskie to P3, sprawdzane w niedzielnej bramie. | Brama odrzuca tylko high/critical w prod. | OBOWIĄZUJE |



### Tempo i kolejka (polecenia 13:31, 13:35 i 13:47)

Wdrożenie idzie od razu po scaleniu, także kilka razy dziennie, gdy brama jest zielona. Paczki dzienne są WYŁĄCZONE. Pomiar 4.10.2026: jeden pełny przebieg `tests/db/gate.sh` na Postgres 17 trwał 4 min 29 s (269 s) i skończył się kodem 1. 4,5 min nie jest wolne — nie zbieramy dnia w jedną paczkę.

Kolejka bez dni tygodnia. Pozycja za pozycją, wdrożenie po każdej zielonej bramie lokalnej. Najpierw domknięcie bramy (age, baza `tower`, liczby z wyjaśnieniem). Dopiero gdy ta brama jest zielona i scalona: L-1b razem z usunięciem pozycji SG-01 (jedna pozycja `driver_token`, 1.10.2026 22:08 czasu warszawskiego, kopia w R2 poza repozytorium: ścieżka i sha256, tylko ten wiersz, warunek po źródle i czasie, przelicz ETA). Potem L-4, L-5, L-13. Nowa migracja = pełna brama lokalna przed produkcją. Supabase TEST `emkbykwenwrjmbprydml` tylko w niedzielę i jako ostateczne potwierdzenie przed wdrożeniem.

Nie zaczynać SEC-OWASP, P2-TILES ani części D.

### Wzory progów L-3 (polecenie 2026-10-04 00:07, czas warszawski)

Sekcja 5 planu nie zawiera L-3. Wzory są przy kolejce L, dosłownie jak w poleceniu. Pełny opis: LOGIKA §4.

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

## Zlecenie HERE (04.10.2026) — kolejność z sekcji 5

Źródło: `docs/handover/ZLECENIE_HERE.md`. Zasada: wyłącznie funkcje oparte na HERE. Innych mechanizmów nie zmieniamy. II-7 i II-7a zostają w historii; zapis „bez HERE" z D-28 zastępuje D-77. Q-17 i Q-19 nie są jeszcze w tym planie — H-6 startuje dopiero razem z nimi, gdy zostaną dopisane.

| Kiedy | ID | Opis | Status |
|---|---|---|---|
| zaraz po L-13 | H-0 | Test na koncie właściciela, bez zmian w aplikacji. Odcinki Śrem → Gdańsk, Nynäshamn → Boden, Karlskrona → Boden. Raport do właściciela. | DONE 2026-10-04 — uzupełnienie limitów, BK i propozycji H-4 w POSTEP. Kodu aplikacji nie ruszano. |
| po etapie 1 (po L-12) | H-1, H-2, H-3 | Kontrola trasy z wymiarów właściciela, utrudnienia PL/SE, przeszkody wzdłuż korytarza. | NIEZACZĘTE |
| razem z Q-17 i Q-19 | H-6 | Mapa przeszkód. Jedna praca z Q-17 i Q-19, bez dublowania. | NIEZACZĘTE — Q-17 i Q-19 nie są w planie |
| po etapie 2 | H-7, H-8, H-10, H-12 | Mapa w e-mailu i PDF, profil trasy, pogoda i wiatr (ryzyko), zakazy czasowe. | NIEZACZĘTE |
| etap 4 (po emtrack) | H-4, H-5, H-10 ETA | ETA z GPS przez HERE, kontrola po przejeździe, wydłużanie ETA przez wiatr. | NIEZACZĘTE — propozycja H-4 (limit prędkości i przerwy UE) w POSTEP 2026-10-04, bez budowy, do akceptacji właściciela |

## Polecenie 2026-10-04 17:06 — e-mail decyzji automatycznych

L-13 przyjęte. `automatic_decision_email` = true. Niekrytyczne w skrócie (szacunek szczytu 34 na dobę). Krytyczne: jedno zdarzenie = jeden e-mail na odbiorcę, lista transportów. Limit: najpierw krytyczne, potem skróty; 10 na dobę zostaje na zaproszenia i reset hasła. Po wyczerpaniu limitu aplikacja i dzwonek bez zmiany. Stan systemu: ile e-maili nie wyszło i do kogo. Co tydzień liczby produkcji w `POSTEP.md` obok szacunku 34; strażnik 80 więcej niż dwa razy w tygodniu → raport do właściciela.

