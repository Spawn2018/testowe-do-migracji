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
| I-2c | moduł Workflows ukryty w produkcji | niewidoczny poza trybem demo | DONE 16638cb |
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
| I-3 | bramka SMS według `PROPOZYCJA_SMS.md` + decyzje z `ZLECENIE_ETAP_I.md` | testy z propozycji; 24 h pracy telefonu | CZEKA NA: telefon i SIM (część bazowa i aplikacja — DO ZROBIENIA) |
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
| I-20 | (P2, z I-11: SCOPE 2.6) ogólny dziennik audytu: wyzwalacz na tabelach biznesowych (loads, shipment_items, invoices, rate_*, sefs_*) — kto, kiedy, stara/nowa wartość | test bazy: zmiana każdej tabeli = wiersz w audit_log | DO ZROBIENIA |
| I-21 | (P2, z I-11: SCOPE 4.3) terminy uzupełnienia zasobów (kierowca, pojazd, dokumenty) przed załadunkiem i eskalacja (ryzyko + powiadomienie) | test bazy: brak zasobów N h przed załadunkiem → ryzyko | DO ZROBIENIA |
| I-22 | (P2, z I-11: SCOPE 3.2) kreator mapowania kolumn importu z zapisem szablonu w bazie (HHL) | nowy układ pliku zmapowany i zapamiętany; import 50/50 | DO ZROBIENIA |
| I-23 | (P2, z I-11: SCOPE 9.8) test odsiewania duplikatów powiadomień (dedup_key) dla wszystkich szablonów | test bazy | DO ZROBIENIA |
| I-24 | (P2, z I-11: SCOPE 10.8) eksport raportów do PDF (obok XLSX) | plik PDF z harmonogramu | DO ZROBIENIA |

## PILOTAŻ I WYDANIE

| ID | Opis | Status |
|---|---|---|
| R-1 | import prawdziwego harmonogramu na produkcję | CZEKA NA: I-1b, stawki (D-1) |
| R-2 | zaproszenie pracowników HHL, potem KSH, potem przewoźnika | CZEKA NA: etap I |
| R-3 | O3b — pierwszy prawdziwy transport od importu do faktury | CZEKA NA: R-2 |
| R-4 | raport końcowy, tag `release-1.0` | CZEKA NA: R-3 |

## ETAP II — po spotkaniu z przewoźnikiem

| ID | Opis | Status |
|---|---|---|
| II-1 | wartości SEFS i ich wprowadzenie | CZEKA NA: D-2 |
| II-2 | kody opóźnień uzgodnione — włączenie w interfejsie | CZEKA NA: spotkanie |
| II-3 | parametry operacyjne: cutoff promu, progi fal, prędkość; potwierdzenie z SCX czasów odcinków D-9 (PL 7,5 h, check-in 3 h, SE 17 h — „szacunek koordynatora”) oraz najpóźniejszej godziny końca załadunku (model: 07:30 dla rejsu 18:00 — POSTEP I-D9-a); odpoczynek na promie NIE jest do potwierdzenia — zamknięty decyzją właściciela (D-9) | CZEKA NA: spotkanie |
| II-4 | adapter telematyki przewoźnika | CZEKA NA: spotkanie |
| II-5 | komunikaty armatora w harmonogramie | CZEKA NA: zgoda armatora |
| II-6 | Trafikverket, TomTom, KPD — zadania i klucze | CZEKA NA: klucze (każdy osobno — rusza, gdy jego klucz dotrze) |

## ETAP III — po pilotażu

**III-1** (P2) kalibracja czasów odcinków ETA po 5 transportach — mediana i rozrzut każdego odcinka z wjazdów/wyjazdów stref; PROPOZYCJA zmian do zatwierdzenia przez HHL, nigdy cicha zmiana (odbiór: raport odcinków z liczbami i propozycją) — SZKIELET GOTOWY (ten commit): `scripts/iii1/calibration.sql` (tylko odczyt, produkcja: n = 0), samotest `scripts/iii1/selftest.sql`, szablon `RAPORT_KALIBRACJI_ETA.md`; dane — po 5 transportach ·
**III-2** (P2, z I-11: SCOPE 0.1, 0.3, 0.7–0.10, 11.4) domknięcie wierności wizualnej: suma kontrolna arkusza wobec makiety, próg 0,1% i pełne 840 ujęć w CI, procedura nowej klasy (3 warunki) w `DESIGN_SYSTEM.md`, zrzuty stanów (najechanie, fokus, wciśnięty, zablokowany, ładowanie, błąd, walidacja) i trybu „systemowy” — DO ZROBIENIA ·
**III-3** (P2, z I-11: SCOPE 1.1) osobne środowisko testowe Supabase i testy bazy w GitHub Actions (dziś tylko lokalny hook) — DO ZROBIENIA ·
**III-4** (P2, z I-11: SCOPE 4.5) pojazdy pilotujące: dane i awizacja — DO ZROBIENIA ·
**III-5** (P2, z I-11: SCOPE 5.10, 5.13) mapa: unikanie kolizji etykiet, odtwarzanie przebiegu w czasie — DO ZROBIENIA ·
**III-6** (P2, z I-11: SCOPE 6.1, 6.2) dokumenty: wymagalność i terminy per kategoria w bazie, wersjonowanie dokumentu — DO ZROBIENIA ·
**III-7** (P2, z I-11: SCOPE 7.10) pełna ścieżka sporu i akceptacji faktury — DO ZROBIENIA ·
**III-8** — (numer zarezerwowany, nieużyty) ·
**III-9** (P2, z I-11: SCOPE 10.4, 10.6) widok placu budowy tylko do odczytu (opcjonalny), ocena przewoźnika — DO ZROBIENIA ·
Silnik Workflows · źródło pogody morskiej · walidator zezwoleń i wymiarów ·
pozycje D4–D12 audytu · integracja SharePoint (zgoda IT KSH) · kalendarz ·
e-CMR · ślad węglowy · SMS 6, 7, 10, 11 · retencja `files/` w R2 ·
audyt dostępności · przekazanie Cursorowi.

---

# 4. DECYZJE OCZEKUJĄCE — WŁAŚCICIEL

Wpisujesz tu każde pytanie i idziesz dalej.

| ID | Sprawa | Blokuje |
|---|---|---|
| D-1 | stawki — koszt przewoźnika, przychód od KSH | R-1, faktury |
| D-2 | parametry SEFS — po spotkaniu z przewoźnikiem | II-1 |
| D-3 | retencja zdjęć, CMR, POD | część I-7 |
| D-4 | telefon z Androidem i firmowa karta SIM z SMS na +46 | test I-3 |
| D-5 | umowy RODO z KSH i przewoźnikiem | R-2 |
| D-6 | spotkanie ze Scandinavian Express | etap II |
| D-7 | Vercel: wyłączenie trenowania modeli (panel) | — |
| D-8 | ~~wycena ładunków STANDARD~~ — **ROZSTRZYGNIĘTE 27.09:** wariant A, osobna stała stawka → I-12 (kwoty w D-1) | I-12 |
| D-9 | ~~parametry odcinków ETA v1~~ — **ROZSTRZYGNIĘTE 27.09:** wartości wpisane (I-D9, 0054); obsada jednoosobowa, przeprawa = dobowy odpoczynek na promie (potwierdzone przez właściciela, bez postoju w Nynäshamn); czasy PL/check-in/SE do potwierdzenia z SCX w II-3. Wartości 0054 zostają; opóźnienie 390 → 1080 min wynika z nowych czasów (+3 h jazdy + 8,5 h odpoczynku = 690 min) — NIE błąd (POSTEP I-D9-a) | — |
| D-10 | ~~widoczność SEFS dla przewoźnika~~ — **ROZSTRZYGNIĘTE 27.09:** przewoźnik widzi parametry tylko do odczytu, wyłącznie wersje uzgodnione (`agreed_with_carrier = true`) → **I-13** (właściciel 27.09; pierwotnie I-15) | I-13 |
| D-11 | **ROZSTRZYGNIĘTE 27.09:** właściciel włącza wymaganie dopiero po I-17 (drugie urządzenie). 2FA (I-5): właściciel zapisuje TOTP (Opcje → „Weryfikacja dwuetapowa” → kod QR → kod) i klika „Włącz wymaganie”; do tego czasu egzekwowanie `aal2` dla HHL_ADMIN jest wyłączone (`security_flags.MFA_HHL_ADMIN = false`) | I-5 |
| D-12 | **ROZSTRZYGNIĘTE 27.09:** ostateczne daty załadunku i rozładunku podaje KSH (→ I-18). Termin potwierdzenia N — do uzgodnienia, domyślnie 5 dni. INFO: plan KSH = 5 dni od odbioru do dostawy | I-18 |
| D-13 | (z I-11: SCOPE 1.6) podglądy wdrożeń: zamiast hasła podglądy działają w trybie demo (A5-PODGLADY `e87c24f`) — zatwierdzić jako zamknięte albo wymagać hasła | SCOPE 1.6 |
| D-14 | (z I-11: SCOPE 7.5) konwencja kursu NBP (tabela A z dnia roboczego przed rozładunkiem) — potwierdzenie przez księgowość | SCOPE 7.5 |
| D-15 | (z I-11: SCOPE 3.8) limity ponadnormatywności per kraj (PL, SE) do potwierdzenia | SCOPE 3.8 |
