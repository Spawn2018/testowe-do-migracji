# TRIAGE REJESTRU — DECYZJA KOORDYNATORA (04.10.2026)

Dotyczy: `REJESTR_CALOSCI.md`, sekcja „Drugie przejście”, 303 pozycje „do zrobienia”.

Zasada: pozycja ma jeden z czterech statusów. Status „zrobione przez X” wymaga
pozycji X oznaczonej w rejestrze jako „zrobione” z dowodem. Jeśli X nie ma
dowodu, pozycja wraca do „do zrobienia” i trafia do raportu. Wykonawca wpisuje
wynik do rejestru i do `PLAN.md`. Kodu nie zmienia.

Statusy:
- **ZROBIONE PRZEZ X** — zrobione pod inną nazwą
- **ZASTĄPIONE** — późniejsza decyzja zmieniła sens; podana jest decyzja
- **HISTORIA** — ustalenie albo zadanie z etapów 0–6, zamknięte; nie jest pracą
- **DUPLIKAT** — ta sama treść ma inne ID w planie; liczy się tylko ID z planu
- **ODŁOŻONE PO 1.0** — wpis do dziennika odłożeń w SCOPE
- **ZOSTAJE** — prawdziwa praca, z miejscem w planie

## 1. Duplikaty i artefakty numeracji

| Pozycje | Status | Uwaga |
|---|---|---|
| POPRAWKI-Q-1…Q-19 | DUPLIKAT POPRAWKI-B-1…B-19 | jedno pytanie, dwa ID |
| POPRAWKI-B-1…B-19, B-2a…B-10g | DUPLIKAT pozycji PLAN B-1…B-10, B-Q, B-KSH, B-REJSY, Q-11a/b, Q-17…Q-19, C-SEP | w rejestrze zostają tylko ID z PLAN |
| POPRAWKI-D | DUPLIKAT D-LATER | |
| POPRAWKI-A1 | HISTORIA | przejęcie 02.10 zrobione |
| POPRAWKI-A2 | HISTORIA | zasady pracy; CodeRabbit i Aikido zastąpione przez U-43 |
| ETAP_I/I-0…I-9 | DUPLIKAT I-0…I-9 | wszystkie I-0…I-9 mają w rejestrze „zrobione” |
| BRAK-PLIKU-ZLECENIE_ETAP_I, BRAK-PLIKU-ZLECENIE_DLA_GROKA | HISTORIA | pliki są już w repozytorium (PR #39) |
| F2.4., P0.1. (z kropką) | DUPLIKAT F2.4, P0.1 | błąd parsowania |
| D-n w sekcji 2 (D-1…D-85 jako pozycje) | DUPLIKAT sekcji 1 | decyzje mają status w sekcji 1. Pracę z nich niesie pozycja planu, patrz punkt 6 |
| DECPOW-§0 | HISTORIA | spis tego, co przestaje obowiązywać |
| DECPOW-§1…§6 | ZROBIONE PRZEZ TEL-1, DEC-2, DEC-3, DEC-4, DEC-5, DEC-6 | |
| SCX-§0 | HISTORIA | |
| SCX-§1, §3, §4, §6, §7, §8, §10, §11, §14, §15 | ZROBIONE PRZEZ AUTH-1, STENA-3, AWIZ-4, DATY-67, DATY-67, OPL-8, ADM-10, HIST-11, RESP-14, BRAND-15 | |
| SCX-§2, §13 | DUPLIKAT TELM-2, ZEZW-13 | czekają na dane |
| SCX-§4a, §9, §12 | DUPLIKAT HHL-4a, FAK-9, UI-12 | zostają jako HHL-4a, FAK-9, UI-12 |
| SCX-§5 | ZROBIONE PRZEZ DEC-5 | sprawdź, czy SMS do KSH idzie 1 h przed przyjazdem na załadunek (D-37). Jeśli nie, pozycja SMS-KSH-1H do planu |
| O3 | ZASTĄPIONE przez R-3 | |
| O5 | DUPLIKAT R-4 | |

## 2. SCOPE §12–§28: ustalenia i defekty z etapów 0–6 (23–26.09)

| Pozycje | Status |
|---|---|
| 12.1–12.14 (funkcje znalezione we wdrożeniu 23.09) | HISTORIA — to inwentarz starej aplikacji, a nie zadania. 12.5 (faktoring) i 12.13 (72 transporty demo): ZASTĄPIONE (zero danych demo, B-1); faktoring poza zakresem 1.0 |
| 13.1, 13.2 | ZROBIONE PRZEZ D2 (Tailwind usunięty) |
| 13.3 | ZROBIONE PRZEZ D9 + brama stylelint |
| 13.4 | ZASTĄPIONE — `/api/trafikverket` zastąpione funkcją Edge (II-6, H-2) |
| 13.5, 13.6 | ZASTĄPIONE — sprzeczności danych demo; demo usunięte (I-0, B-1) |
| 13.7 | ZROBIONE PRZEZ D10 |
| 13.8, 13.9 | ZROBIONE PRZEZ F2.6 i D17 |
| 13.10 | ZROBIONE PRZEZ D12 i I-2h |
| 13.11 | ZROBIONE PRZEZ D11 |
| 13.12 | ZROBIONE PRZEZ D6 i SEC-1 |
| 13.13 | ZROBIONE PRZEZ M4 |
| 13.14 | ZROBIONE PRZEZ M1 i I-31 |
| 13.15 | ZROBIONE PRZEZ D13 |
| 13.16 | ZROBIONE PRZEZ D15 |
| 14.1–14.11 | HISTORIA — ustalenia etapu 0. Repozytorium, CI i klucze powstały w etapach 0.5–3 i II-6 |
| 15.1–15.7 | HISTORIA — zrobione 23.09 (tag `baseline-2026-09-23`, repozytorium prywatne) |
| 16.1 | ZROBIONE PRZEZ D-24 (Stegra to strefa, nie rola) |
| 16.2 | ZASTĄPIONE — motyw rozstrzyga Q-9 (tryb jasny, część B) |
| 16.3 | ZASTĄPIONE przez I-18 i I-2a (import tylko HHL) |
| 16.4 | ZROBIONE PRZEZ SEC-1 i testy ról. Sprawdź dowód |
| 16.5–16.8 | HISTORIA |
| 17.1 | ZROBIONE PRZEZ D23 i D23-S |
| 17.2, 17.5 | ZASTĄPIONE — pamięć przeglądarki zastąpiona bazą (etap 3); aplikacja kierowcy ukryta (D-38, D-79) |
| 17.3 | ZROBIONE PRZEZ P0.2 (jeden kanon wizualny) |
| 17.4 | ZROBIONE PRZEZ O1 |
| 17.6 | ZASTĄPIONE — pozycje tylko z telematyki (D-36), link kierowcy zamykany (DRV-CLOSE) |
| 17.7 | ZOSTAJE jako CLEAN-MAPLIBRE (P3): usunąć martwy MapLibre, jeśli nadal jest w zależnościach |
| 17.8 | ZROBIONE PRZEZ 0.3 |
| 17.10 | ZROBIONE PRZEZ P1-FONT (03.10) |
| 17.11 | ZROBIONE PRZEZ II-7 (`corridor_polylines`, 0122) |
| 17.12 | ZROBIONE PRZEZ H-2 (schemat 1.6) |
| 17.13 | ZOSTAJE jako sprawdzenie: współrzędne terminali Gdańsk i Nynäshamn względem mapy (Gdynia i Karlskrona potwierdzone w D-STENA-COORDS) |
| 17.14 | DUPLIKAT II-3 |
| 17.15, 17.16 | HISTORIA |
| 20.1–20.10, 23.2–23.6, 26.2–26.4, 28.2–28.5 | HISTORIA — sprawy etapu C i fali 1. CI na GitHub zastąpiła brama lokalna (decyzja 03.10) |

## 3. SCOPE §0–§11: pozycje „do zrobienia”

| Pozycja | Status |
|---|---|
| 0.7 | ZROBIONE — dowód `DESIGN_SYSTEM.md` §7a + stylelint (sprzeczność w sekcji 3) |
| 0.10 | DUPLIKAT Q-9 (tryb jasny, część B) |
| 1.4 | ZASTĄPIONE przez D-49 (hasło); 2FA zrobione (I-5, I-17) |
| 1.5 | ZROBIONE — tower.log-mar.pl (U-42) |
| 1.6 | ZASTĄPIONE przez D-13 |
| 1.7 | ZROBIONE PRZEZ I-6 |
| 2.7 | ZROBIONE PRZEZ I-7; dokumenty: D-3 otwarte |
| 2.8 | ZASTĄPIONE przez D-5 (zgody i umowy załatwione) |
| 3.8 | DUPLIKAT D-15 |
| 3.10 | DUPLIKAT II-10-E1, II-10-E2 |
| 5.1, 5.2, 5.3 | DUPLIKAT TELM-2 |
| 6.8 | ZROBIONE PRZEZ I-2k |
| 6.9, 9.10, 10.9 | ODŁOŻONE PO 1.0 (e-CMR, kalendarz, ślad węglowy; rekomendacja koordynatora 27.09, bez sprzeciwu) |
| 9.9 | ODŁOŻONE PO 1.0 (Slack/Teams) |
| 7.1 | ZROBIONE PRZEZ I-19 i I-30 |
| 7.3 | ZROBIONE PRZEZ I-2f i I-31 |
| 7.5 | ZROBIONE PRZEZ M3 (NBP tabela A, dzień roboczy przed rozładunkiem, U-6); potwierdzenie księgowej: D-14 otwarte |
| 7.11 | ZASTĄPIONE — KSeF poza Watch Tower na stałe (właściciel 27.09). Faktury wystawiane w systemach HHL i SCX |
| 8.1 | ZROBIONE PRZEZ II-8 |
| 8.2 | ZROBIONE PRZEZ II-5 |
| 8.5 | ZROBIONE PRZEZ H-2 |
| 8.6 | ZOSTAJE jako H-2-PL (utrudnienia w Polsce z HERE; H-2 zrobiło tylko Szwecję) |
| 8.10 | DUPLIKAT II-2 |
| 9.6 | ZROBIONE PRZEZ I-3 i I-3-APK |
| 10.4 | ZASTĄPIONE przez D-24 |
| 10.7 | ZROBIONE PRZEZ I-2l |
| 11.5 | ZOSTAJE w D-27 (kontrast) + III-12 (dostępność 54 widoki, zrobione) |
| 11.6 | ZROBIONE PRZEZ I-8 i LOAD-1 |
| 11.8 | ZROBIONE PRZEZ I-4 i DOC-ROLE |

## 4. SCOPE §32–§33 (mechanizm pieniędzy, 24.09)

32.1–32.5 i 33.1–33.6 wchodzą do kryteriów odbioru **U-3-PALIWO**. Przy
naprawie tygodnia paliwa sprawdź i wpisz dowód dla każdej:
- 32.3 — ta sama data mnożnika dla kosztu i przychodu, migawka przy transporcie
- 32.4 — test niezmiennika (M8)
- 33.1 — trzy wartości ze źródłem i migawką (M2)
- 33.2 — faktura nadpisuje, ale nie kasuje wartości wyliczonej
- 33.3 — tydzień liczony w czasie lokalnym (Europe/Warsaw), nie w UTC
- 33.5 — testy granicy tygodnia i zmiany czasu
- 33.6 — ZROBIONE PRZEZ M11 (U-12)
- 32.1, 32.2, 32.5, 33.4 — dokumentacja; uzupełnij w tym samym PR

## 5. Pozycje L*, O-V, inne z POSTEP

| Pozycja | Status |
|---|---|
| L5 | ZASTĄPIONE przez DEC-4 (administrator wybiera firmy) |
| L9 | ZROBIONE PRZEZ 9.1 (silnik reguł, 0094) |
| L16 | DUPLIKAT ONE-MECH |
| O-V | HISTORIA (stare wdrożenie) |
| SMS-ZONE-ON | ZROBIONE PRZEZ SMS-DELIV (0116) |
| AUTH-MAIL | ZOSTAJE (P3): szablony e-mail logowania z nazwą Watch Tower — sprawdź i zgłoś |
| AUDIT-PROD | HISTORIA — to zasada pracy, nie pozycja |
| II-7a | ZASTĄPIONE przez D-78 (budżet 100 USD) |
| I-29 | ZOSTAJE (P2): budżety darmowych planów — sprawdź, co pokrył L-13 |
| D-TELM-ETA | DUPLIKAT TELM-2 i II-7b |
| DEC-CLICK | ZROBIONE PRZEZ L-4 |

## 6. ZOSTAJE — pełna lista pracy przed R-1

Wszystko inne z 303 jest zamknięte przez punkty 1–5.

**Kolejka bieżąca (w tej kolejności):** H-3 → U-3-PALIWO (z punktem 4) → DRV-CLOSE → STD-CLEAN

**Część B (po akceptacji tej tabeli):** B-1 (do scalenia), B-2a, B-2c, B-3a
(po wymiarach), B-4a, B-4b, B-5, B-6a…B-6i, B-7a…B-7c, B-8, B-9, B-10,
B-KSH, B-REJSY, B-Q (bez pytań zrobionych w L-*), Q-11a, Q-11b, Q-17,
Q-18, Q-19, C-SEP, HHL-4a, FAK-9, UI-12, D-31, D-27

**Do sprawdzenia przez wykonawcę (raport, bez budowania):** ONE-MECH i D-29t
(czy L-1 i L-13 domknęły jeden przepływ i 7 reguł startowych), SCX-§5
(SMS do KSH 1 h przed), 16.4, 17.13, AUTH-MAIL, I-29

**HERE i ETA:** H-2-PL, H-6, H-7, H-8, H-10, H-12, H-4/H-5 po emtrack, II-7b

**Na dane z zewnątrz:** TELM-2, II-2, II-3, II-4, II-10-E1/E2, ZEZW-13, D-15

**Sprawy właściciela (nie blokują B):** D-3, D-7, D-14, D-16, D-17, D-21, wymiary (D-83)

**Stałe:** GATE-WEEKLY, SEC-OWASP (przed pilotażem), CLEAN-MAPLIBRE (P3)

**Pilotaż:** R-0 → R-1 → R-2 → R-3 → R-4


## Raport wykonawcy (04.10, bez budowania)

Punkt 6. Nic nie zostało zbudowane.

| Pozycja | Wynik |
|---|---|
| ONE-MECH | Nie domknięte. PLAN: seed zrobiony, silnik START i cron poza zakresem. Ten sam plan: START-1…7 nadal 0/7. L-1 to migracja `0138_l1_open_decisions.sql` (otwieranie decyzji). L-13 to `0148_l13_notify_dedup.sql` (łączenie powiadomień). Żadna nie domyka siedmiu reguł startowych. |
| D-29t | Tabela nakładania jest w PLAN i jest zaakceptowana 01.10. Status planu: zastąpiona przez ONE-MECH. Scalenie reguł START nie jest zrobione (0/7). |
| SCX-§5 | Spełnione jako SMS przy strefach, nie jako timer 1 h. Zlecenie z 29.09 zastąpiło „SMS do KSH 1 h przed załadunkiem” wejściem w strefę zbliżania i wjazdem (`ZLECENIE_DECYZJE_POWIADOMIENIA.md` §5, `ZLECENIE_PO_SPOTKANIU_SCX.md` §5). Kod: `0106_dec5_sms_zones.sql`, `0116_sms_zone_triggers_on.sql`. Dlatego SMS-KSH-1H nie wchodzi do planu. |
| 16.4 | Nie oznaczone zrobione. `tests/xlsx-export-roles.test.ts` sprawdza eksport XLSX (KSH: cena, kierowca, telefon, bez kosztu i marży). Nie ma tu dowodu, że ceny znikają z DOM. SEC-1 w rejestrze ma tylko „DONE”, bez pliku. |
| 17.13 | Współrzędne są w `0017_driver_positions.sql`: Gdańsk 54.40372, 18.68130; Nynäshamn 58.90453, 17.95621. Komentarz mówi o korekcie względem starszych punktów. Potwierdzenia na mapie w tym przebiegu nie ma. Gdynia i Karlskrona są osobno, w `0119_stena3_dictionaries.sql` (D-STENA-COORDS). Bez budowy. |
| AUTH-MAIL | Zostaje. W repozytorium nie ma szablonów Supabase Auth. `POSTEP.md` podaje DONE 02.10 przez Management API. Z plików tego nie widać. |
| I-29 | L-13 budżetów nie pokrywa. Dokument `docs/handover/I29_BUDGETY_140.md` jest. L-13 to zalew powiadomień (0148), nie limity darmowych planów. |

„Zrobione przez X” bez dowodu (zostawione „do zrobienia”, nie oznaczone zrobione):

- 13.1 i 13.2 — D2: brak wiersza i brak pliku
- 13.3 — D9: brak wiersza z plikiem
- 13.8 i 13.9 — F2.6 i D17: w rejestrze tylko DONE
- 13.10 — D12 i I-2h: DONE albo hash, bez pliku
- 13.11 — D11: tylko DONE
- 13.12 — D6 i SEC-1: tylko DONE
- 13.13 — M4: tylko DONE
- 13.15 — D13: tylko DONE
- 13.16 — D15 (podział paczki): tylko DONE
- 16.1 — D-24: drugie przejście bez pliku
- 16.4 — jak wyżej
- 17.1 — D23 i D23-S: brak pliku
- 17.3 — P0.2: hash w POSTEP, bez pliku kanonu
- 17.4 — O1: tylko DONE
- 17.8 — 0.3: opis bramy, bez pliku wyniku
- 11.6 — I-8 i LOAD-1: hash albo liczby w POSTEP, bez pliku testu

ETAP_I/I-2 jest duplikatem I-2, ale I-2 (zero fasady) nie ma w rejestrze statusu „zrobione” z plikiem. Nie jest oznaczone zrobione.

T1, T2 i T3 nie są nazwane w punktach 1–5 ani na liście „zostaje”. Zostały „do zrobienia”.

Sekcja U-1–U-50: w historii git nie było jej wewnątrz `REJESTR_CALOSCI.md`. Treść jest w `docs/handover/USTALENIA_Z_ROZMOW.md` (commit `8d28b6a`, PR #39). Przepisana dosłownie jako sekcja 6, bo sekcja 5 to drugie przejście.
