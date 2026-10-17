# PLAN PRACY WATCH TOWER — jedyna lista pracy

**Wersja: 08.10.2026, 16:05 (koordynator Claude, na polecenie właściciela 08.10 14:43); zmiana 16:46: jeden folder, jeden wykonawca, paczki po kolei (§3, dopisek D-20261008-1646-01); zmiana 09.10.2026, 01:20: audyt kompletu — termin liczony od startu, brama niedzielna, przywrócone decyzje właściciela, nowe pozycje §5 i §6, treści „Jak pracuję” (§8); zmiana 09.10.2026, 14:11: decyzje właściciela z 09.10 (E44 link RIO 10:34–11:19, piloci 12:33, konwój KR, W20, W22 i aktualizacje 1–5 z 13:09) — E44 w P4, zmiany w P1, P3, P5, P6, P7, P9, P10a, P10b, W14 i W20 zamknięte, W22 rozstrzygnięte, nowe W26–W31; dopiski D-20261009-1233-01 i D-20261009-1309-01 (§8); zmiana 11.10.2026, 21:35: praca na Windows bez WSL — D-86, D-87, P0-CI, zasady Windows (dopiski D-20261011-2135-01, D-20261011-2254-01, D-20261012-0105-01); zmiana 13.10.2026, 15:50: wzorzec wyglądu = raport audytu (WYGLAD-RAPORT, dopiski D-20261013-1535-01 i D-20261013-1550-01); zmiana 13.10.2026, 18:35: wygląd robi koordynator na `wyglad/*`, Cursor — dane, logika, baza, scalenie i wdrożenie (FRONT-KOORDYNATOR, D-20261013-1835-01).** Zastępuje cały poprzedni `PLAN.md` (przeniesiony do `docs/archiwum/2026-10-08/docs/handover/PLAN.md`). Nic z poprzedniego planu nie obowiązuje, jeśli nie jest wpisane tutaj.

Właściciel, 08.10.2026 14:43: „nasze postanowienia i plik audyt watch tower są nadrzędne. Wszystko co jest starsze jest nieaktualne i nie może obowiązywać.” Właściciel, 13:26: „Najświeższe ustalenia … nadpisują wszelkie starsze decyzje i rozwiązania.”

---

## §0. Cel, termin, źródła

- **Cel:** kompletna aplikacja Watch Tower według audytu 07–08.10.2026, na produkcji `tower.log-mar.pl`, gotowa do pierwszego prawdziwego transportu od importu do faktury (R-3) i wydania `release-1.0`.
- **Termin:** wydanie `release-1.0` w środę **28.10.2026, 20:00**; granica 23:59 (decyzja właściciela 17.10.2026, 07:20, 2C — D-20261017-0730-01; zastępuje czwartek 22.10.2026, 20:00 / W35). Bez cięcia zakresu. Dzień 1 = 12.10.2026 (Zmiany 11.10). Punkty kontrolne w §3.
- **Źródła, w tej kolejności przy sprzeczności:**
  1. `docs/handover/wzorzec/01_KONSTYTUCJA.md` (ze zmianami z 08.10.2026 i 13.10.2026);
  2. `docs/handover/audyt_claude_2026-10-08/`:
     - `DECYZJE_08_10.md` — decyzje właściciela;
     - `ROZSTRZYGNIECIA_LUK.md` — wiążące rozstrzygnięcia 156 luk;
     - `etapy/E<nr>.md` — co zbudować;
     - `raport/img/` i decyzje w `raport/index.html` — wygląd (`makiety_html/` pomocniczo);
     - `paczki/` — szczegółowe zlecenia paczek;
     - razem z dopiskami włączonymi do planu (`docs/handover/dopiski/`: m.in. D-20261008-1646-01 … D-20261015-0300-01, D-20261015-0330-01, D-20261015-0400-01) — przy sprzeczności ze starszym zapisem obowiązuje nowsza decyzja właściciela (08.10 13:26, 14:43; 11.10 21:35; 15.10 03:12);
  3. ten plik — kolejność pracy, zakres paczek, sposób;
  4. `docs/handover/wzorzec/03_REJESTR_DECYZJI.md` — starsze decyzje, tylko tam, gdzie audyt milczy;
  5. kod w repozytorium — opis stanu dzisiejszego, nie wzór docelowy.
- **Nigdy jako polecenie:** `docs/archiwum/**` (w tym wszystko przeniesione 08.10), stare zlecenia, plany, prompty, raporty.

## §1. Zasady wykonania (szczegóły w `AGENTS.md`)

1. **Pracujesz paczkami z §4, w kolejności z §3.** Po zamknięciu paczki bierzesz następną z kolejności, bez pytania.
2. **Jedna paczka = jedna gałąź `pakiet/P<n>-<nazwa>`, jedna brama, jedno wdrożenie.** Commity w trakcie mogą być małe; pełna brama tylko na końcu paczki.
3. **Brama paczki (kolejno):**
   1. szybkie testy przy każdym pushu (hak);
   2. zestawy bazy dotknięte zmianą (`gh workflow run db.yml --ref <gałąź> -f suites=…` po P0b);
   3. przed scaleniem:
      - rebase na `main`;
      - numer migracji = następny wolny w chwili rebase;
      - check `db` (GitHub Actions) zielony na głowie PR, jeśli jest migracja;
      - check `visual` (GitHub Actions) zielony;
      - od P3, gdy paczka ma migrację: doradca Supabase „security” na TEST po potwierdzeniu TEST bez nowych zgłoszeń spoza `tests/db/advisor-exceptions.txt` (E19 pkt 6 — nowe zgłoszenie blokuje wdrożenie); ostrzeżenie o ochronie przed wyciekniętymi hasłami na TEST (plan darmowy, funkcja planu Pro) jest wyjątkiem tylko dla TEST; po wdrożeniu ten sam doradca na produkcji (odczyt);
      - potwierdzenie na TEST, gdy paczka ma migrację (zestawy `security`, `status`, `nullguard` i dotknięte migracją). **Jedna brama TEST naraz** — przed startem wpis w `POSTEP.md` „TEST zajęte: P<n>, od GG:MM”, po końcu „TEST wolne” (ślad dla koordynatora);
      - gitleaks 0;
      - `npm audit --omit=dev --audit-level=high` bez high i critical;
   4. PR → `gh pr checks --watch` → `gh pr merge --merge` (merge commit, autor Sebastian Bożek); nigdy `git push` na `main` z komputera wykonawcy (D-86, D-87);
   5. wdrożenie z `main`;
   6. migracja na produkcji (najpierw próba w transakcji z ROLLBACK, potem `supabase db push`, lista migracji = `schema_migrations`);
   7. `tower.log-mar.pl` i `watch-tower-makieta.vercel.app` zwracają 200;
   8. wpis w `POSTEP.md`.
4. **Testy idą za decyzjami.** Test sprzeczny z decyzją etapu bieżącej paczki przepisujesz w tej paczce według decyzji; w komentarzu podajesz numer etapu i decyzji. Nigdy nie zmieniasz aplikacji po to, żeby przeszedł stary test. Lista testów do przepisania jest przy każdej paczce.
5. **Wygląd według raportu audytu.** Wygląd = raport audytu (`raport/index.html` + `raport/img/`), najnowsza decyzja wygrywa; `makiety_html/` pomocniczo; dowód w `docs/handover/odbior/P<n>/` (konstytucja VIII, WYGLAD-RAPORT, D-20261013-1535-01 Z). Wygląd robi koordynator na gałęziach `wyglad/*` (FRONT-KOORDYNATOR, D-20261013-1835-01 F1–F3); tabelę Z3 i dowód Z4 / Z11 robi koordynator w PR `wyglad/*`; PR Cursora potwierdza brak zmian wyglądu (F3 pkt 4). Cursor nie zmienia klas, znaczników, stylów ani tekstów elementów koordynatora. **Wygląd koordynatora sprawdza przed scaleniem osobny agent kontrolny, który nie robił tej pracy (F7, E10; D-20261015-0300-01 E).** Nocnej bramy wizualnej nie ma (W32) — W11 i P11 pkt 6: odświeżenie 280 ujęć w GitHub Actions. Zmiana wyglądu ekranu z listy paczki jest przewidziana i nie jest powodem do zatrzymania. Z1–Z6 (D-20261013-1535-01); Z8–Z12 z D-20261013-1550-01 mają pierwszeństwo przed Z7 i przed słowem „ról” w Z4:
   - **Z1.** Wzorzec: `docs/handover/audyt_claude_2026-10-08/raport/index.html` i obrazy `raport/img/` (ta sama treść co artefakt „Audyt Watch Tower”); etapy `etapy/E*.md`; `makiety_html/` tylko pomocniczo — przy różnicy z `raport/img/` wygrywa `raport/img/`.
   - **Z2.** Gdy źródła mówią co innego, wygrywa najnowsza decyzja właściciela (zielone ramki „Twoje decyzje”, „Zmiana 09.10”, sekcje „Zmiany 09.10 / 11.10”, dopiski), potem obraz „po zmianie”, potem tekst propozycji. Różnicę zapisujesz w opisie PR.
   - **Z3.** Przed pierwszym commitem paczki, która zmienia ekran, w opisie PR jest tabela: ekran, etap, obraz z `raport/img/`, decyzje z datą, co robi ta paczka, co zostaje innej paczce (której). Ekran innej paczki zostaje bez zmian, chyba że PLAN mówi inaczej. Przy miejscu bez własnego obrazu wpisujesz punkt Z10.
   - **Z4.** Przed scaleniem paczki, która zmienia ekran: zrzuty według Z11; zapis w `docs/handover/odbior/P<n>/` z listą różnic, które zostają, i paczką, która je zamyka; brama E8 z V3 zielona (od `pakiet/P2-wyglad`); check `visual` zielony. Odświeżenie migawek nie jest dowodem zgodności. Dowodem jest porównanie z `raport/img/`.
   - **Z5.** Różnica między ekranem a raportem, której nie zamyka ani ta, ani żadna późniejsza paczka → STOP i raport do koordynatora.
   - **Z6.** Po „P<n> NA PRODUKCJI” właściciel pisze „Sprawdź P<n>”. Koordynator porównuje `docs/handover/odbior/P<n>/` i zrzuty produkcji z raportem. Rozbieżności wracają jako „Poprawki P<n>” (§2 pkt 7).
   - **Z10.** Miejsca i stany bez własnego obrazu, po kolei: (1) ten sam element na innym obrazie raportu; (2) etapy bez obrazu (E2, E14, E36, E44) — treść etapu i wygląd ekranu, na którym element stoi; (3) tylko obraz komputera → telefon według zasad E8, tylko obraz telefonu → komputer w dotychczasowym układzie z treścią etapu; (4) okna, puste listy, komunikaty i stany ładowania z elementów obrazów i tokenów `design/claude-v2.0/`. Żaden punkt nie daje wzoru → STOP.
   - **Z11.** Zrzuty dla każdego z 5 rodzajów kont, który widzi ekran inaczej (HHL Administrator, HHL Operacje, KSH Użytkownik, SCX Dyspozytor, SCX Użytkownik). Gdy konto widzi ekran tak samo, wystarczy jeden zrzut z dopiskiem „jak <konto>”. Porównanie z obrazem przy 390 i 1440 px. Brama telefonu: 360 / 390 / 430 px (V3). Od paczki z E20 brama komputera: 1280 / 1366 / 1440 / 1920 px, bez nakładania się kolumn.
   Wzorce zrzutów:
   - 15 migawek Playwright (`tests/__screenshots__/`) odświeżasz w tej samej paczce w GitHub Actions (`visual.yml`, wejście `update`); wpis do `G4_WZORZEC.md`: „P<n> — E<nr>, ekrany: …”;
   - 280 ujęć matrycy (`shots-baseline/`) odświeża środowisko bramy wizualnej raz, w P11, z tagiem `baseline-audyt-<data P11 w formacie RRRR-MM-DD>`. Do tego czasu nocna brama wizualna tylko raportuje; jej różnice nie są powodem zatrzymania ani odświeżania.
   Akceptacja planu przez właściciela (08.10) = zgoda na te odświeżenia.
6. **CSS:** zmiana według makiety etapu → wpis w `ODSTEPSTWA` w `tests/stylesheet-mockup.test.ts`: `'<selektor>|<właściwość>': 'AUDYT 08.10 E<nr> (P<n>)'`. Pliku `docs/claude/referencje/tower.css` i `SUMA_REF` nie zmieniasz. Cień i zaokrąglenie tylko przez tokeny w `:root`; reguł stylelint nie zmieniasz.
7. **Uchwyty testów zostają:** `#roleSeg button[data-role]`, `#themeBtn`, `nav button[data-view]`, `[data-panel="ferry"]`, `[data-bill-section]`, także gdy element zmienia miejsce (menu konta, dolny pasek, „Podgląd”). Jeśli etap usuwa widok albo uchwyt, w tej samej paczce zmieniasz `scripts/baseline.mjs` (VIEWS, `SCRIPT_VERSION`) i specyfikacje Playwright.
8. **Zawsze w tym samym commicie:**
   - nowa albo usunięta tabela → lista w `supabase/functions/_shared/backup/core.ts` i liczba w bramie;
   - nowa funkcja dla `authenticated` → wpisy w `tests/db/function-allowlist.txt` i `null-guard-calls.txt`;
   - nowe słowo spoza słownika → `tests/fixtures/pl-t-exceptions.txt`;
   - zmiana liczby testów bazy → `tests/db/gate.sh` i `scripts/lib/gate-suites.mjs` (po P0b jedno źródło).
9. **Teksty:** tylko po polsku (bez EN/SV); formaty z jednego modułu (E21); nazwa transportu z jednej funkcji (E41); w produkcji bez przykładów z danych demo (`ROZSTRZYGNIECIA_LUK.md` G-09).
10. **Nowe moduły ładowane leniwie** (budżet pierwszego wczytania 400 kB gzip; budżetu nie podnosisz).
11. **Pliki poufne** (polisy, zezwolenia, plik KSH, cenniki) poza repozytorium; kwoty cennika tylko z bazy.
12. **STOP — wyłącznie gdy:**
    1. zmiana prawdziwych danych na produkcji, której nie opisuje bieżąca paczka (opisane: porządki P1, faza z pozycji P4, wgranie pliku R-1 w P7, wpisy jednorazowe z etapów — zawsze z kopią, bramą i TEST);
    2. wydatek ponad decyzje (wyjątki: Supabase Pro, HERE ≤ 100 USD/mies.);
    3. wysyłka do prawdziwych odbiorców, której nie przewiduje etap (testowo tylko adres i numer właściciela);
    4. zmiana wyglądu ekranu, którego nie ma na liście bieżącej paczki (wspólne elementy z E8, E10, E37, E41 są przewidziane wszędzie);
    5. potrzebne dane, które zna tylko właściciel;
    6. regulamin usługi wyklucza użycie.

    Przy STOP: wpis w §5 „Czeka na właściciela” i **dalej następna pozycja**. Nie czekasz.

## §2. Wprowadzanie zmian i poprawek do planu (obowiązkowe)

Cel: każda zmiana trafia do planu, a plan jest wykonywany dalej. Poprawki nie mogą zastąpić realizacji planu.

1. **Jedno wejście.** Każda zmiana, poprawka, nowe polecenie właściciela albo uwaga koordynatora trafia do planu jako **dopisek**: plik `docs/handover/dopiski/D-RRRRMMDD-GGMM-<nr>.md`.
2. **Format dopisku:**
   - numer, data i godzina, autor (właściciel / koordynator / wykonawca);
   - rodzaj: **BLOKER** · **DO PACZKI P<n>** · **NOWA POZYCJA** · **PO 1.0** (tylko gdy przeniesienie zdecydował właściciel — §6 część 3);
   - powód;
   - dokładna zmiana (co, gdzie, dosłowne teksty);
   - przykład liczbowy (dla reguł warunkowych);
   - test odbioru;
   - szacowany czas;
   - co zastępuje (jeśli zmienia decyzję albo rozstrzygnięcie).
3. **Kto pisze:**
   - koordynator przekazuje dopiski plikami;
   - polecenie właściciela wydane wprost wykonawcy: wykonawca najpierw zapisuje je jako dopisek, z dosłownymi słowami właściciela i godziną, a potem je wykonuje;
   - błąd zauważony przez wykonawcę poza bieżącą paczką: wykonawca pisze dopisek i **nie** naprawia go od razu.
4. **Kiedy wykonawca włącza dopisek:**
   - po zakończeniu bieżącego commita, nigdy w połowie pozycji;
   - wpisuje go do §4 (do wskazanej paczki jako pozycję `D<nr>`) albo do §6 (część 1, 3 albo 4) i do §8 (dziennik planu);
   - commit `plan: dopisek D-…`. Commit tylko w `docs/**` nie unieważnia zielonej bramy gałęzi.
5. **BLOKER przerywa kolejkę, ale tylko gdy:** produkcja nie działa; ryzyko utraty danych; luka bezpieczeństwa; wysyłka do złych odbiorców; zła kwota na fakturze. Wszystko inne czeka na swoją paczkę.
6. **Poprawki do zamkniętej paczki:**
   - trafiają jako pozycja „Poprawki P<n>” na początek **następnej** paczki z kolejności §3, z limitem 1 h;
   - większa poprawka = osobna pozycja w planie z czasem, ustawiona przez koordynatora;
   - wykonawca nie otwiera zamkniętej paczki sam.
7. **Sprawdzenie koordynatora:**
   - po każdym wdrożeniu koordynator sprawdza produkcję niezależnie;
   - wynik przychodzi jako **jeden** zbiorczy dopisek na paczkę, nie seria uwag;
   - sprawdzenie nie wstrzymuje następnej paczki.
8. **Pilnowanie proporcji:** w `POSTEP.md` przy każdej paczce wpisujesz czas na pracę z planu i czas na poprawki. Gdy poprawki przekroczą 25 % czasu w ciągu doby, koordynator zmienia plan dopiskiem (zwykle przesuwa poprawki do P11; do PO 1.0 tylko po decyzji właściciela).
9. **Decyzje rozstrzygnięte nie wracają.** Pytanie, które ma rozstrzygnięcie w `ROZSTRZYGNIECIA_LUK.md`, nie jest dopiskiem; stosujesz rozstrzygnięcie.

## §3. Kolejność pracy i harmonogram

Jeden wykonawca, jeden folder, jeden czat agenta naraz (decyzja właściciela 08.10.2026 16:44: „Budujemy z 1 folderu w cursor”; dopisek D-20261008-1646-01). Wyjątek: wygląd robi koordynator na gałęziach `wyglad/*` w swojej kopii repozytorium; Cursor scala te PR i wdraża (FRONT-KOORDYNATOR, D-20261013-1835-01 F2). Paczki po kolei, w kolejności poniżej. Przed bramą końcową rebase na `main`.

**Kolejność:** P0-CI → P0a → P0b → P1 → P2 → Poprawki P2 — wygląd → Poprawki P2 — wygląd 2 → P3 → Poprawki P3 → P4 → **Poprawki P2–P3 (audyt 15.10)** (C1–C3, C12, C14, C16, C16-H, C17 na produkcji; C3-p i dalej w Naprawach) → **Naprawy audytu 17.10** (BLOKER przed C4; D-20261017-0730-01): ~~C3-p~~ → ~~B1~~ → **B2 → B6 → A8 → A1 → A2 → A3 → A7 → A9 → A4 → A5 → B4 → B5 → B7 → B8 → B9 → A6** → C4 → C5 → C6 → C7 → C8 → C9 → C10 → C11 → C13 → **P4-u** → **P3-d** → P5 → P6 → P7 → P8 → P10a → P9 → P10b → P11 (P0-CI przed Dniem 1; P0-CI i P0a już scalone; decyzje 17.10 07:20: 1A, 2C, 3A, 4B, 5B, 6A, 7A, 8A)

- Każda paczka: gałąź `pakiet/P<n>-<nazwa>` → brama (§1 pkt 3) → scalenie → wdrożenie → wpis w `POSTEP.md` (czas pracy i czas poprawek); potem od razu następna.
- Bez drugiego czatu agenta w tym folderze, bez trybu worktree i bez równoległych agentów Cursora.
- Gdy paczka czeka na dane właściciela (§5): część, która tych danych nie wymaga, przechodzi pełny cykl (brama, scalenie, wdrożenie); status w §4: „NA PRODUKCJI — bez <pozycja>, czeka W<nr>”; wpis w §5; bierzesz następną paczkę z kolejności, której zależności są spełnione. Gdy właściciel napisze „W<nr> gotowe”, brakująca pozycja wchodzi po bieżącym commicie jako osobna pozycja „P<n> — uzupełnienie W<nr>” z własną bramą i wdrożeniem (wyjątek od §2 pkt 6), a potem wracasz do przerwanej paczki.

Zależności (kolejność je spełnia; lista do kontroli): wszystkie paczki po P0a; bramę końcową P1, P2 i P3 robisz po scaleniu P0b (kodować możesz wcześniej) · P3 scalasz po P2, po Poprawkach P2 — wygląd i po Poprawkach P2 — wygląd 2 (`wyglad/P2-2`; wspólne pliki paska, nazwy E41 i formatów E21 — rebase przed bramą końcową) · P4 po P2 i P3 · P5 po P4 · P6 po P3 i P4 · P7 po P5 i P6 · P8 po P3 i P4 · P9 po P2 i P4 · P10a po P0b (push alarmów podłączasz po scaleniu P3) · P10b po P3 i P10a · P11 po wszystkich.

**Punkty kontrolne (czas polski)** (D-20261017-0730-01, decyzja 2C / 3A):
| Kiedy | Na produkcji |
|---|---|
| sob 17.10, 23:59 | C3-p, B1, B2, B6, A8, A1, A2 |
| nd 18.10, 23:59 | A3, A7, A9, A4, A5; brama niedzielna |
| pn 19.10, 23:59 | B4, B5, B7, B8, B9; A6 pkt 1–3 |
| wt 20.10, 23:59 | A6 pkt 4 (odczyt SharePoint); C4–C11, C13 |
| śr 21.10, 23:59 | P4-u; P3-d |
| czw 22.10, 23:59 | P5 |
| pt 23.10, 23:59 | P6 |
| sob 24.10, 23:59 | P7 (reszta); P8 |
| nd 25.10, 23:59 | P10a; brama niedzielna |
| pn 26.10, 23:59 | P9 |
| wt 27.10, 23:59 | P10b; P11 w toku |
| śr 28.10, 20:00 | P11: pełna brama TEST, 280 ujęć, `release-1.0` |

  Test E22 („tydzień bez nowych błędów”) kończy się 7 dni po wdrożeniu P10a. Wynik dopisuje koordynator.

- Wygląd koordynatora (`wyglad/*`) do danej paczki jest gotowy przed jej punktem kontrolnym; scalasz go jak dotąd.
- Test E22 („tydzień bez nowych błędów »stara wersja«”) kończy się 7 dni po wdrożeniu P10a — wynik dopisuje koordynator (D-20261017-0730-01).

**Punkt kontrolny spóźniony:** gdy punkt kontrolny jest spóźniony o ponad 4 h → wpis w `POSTEP.md` i sygnał w raporcie; koordynator przedstawia właścicielowi **nowy termin** — nie cięcie zakresu (D-20261017-0730-01, 3A; reguła cięcia i „Rezerwa” z §6 część 4 usunięte).

**Brama niedzielna (GATE-WEEKLY, zasada z 04.10 — obowiązuje):**
- W każdą niedzielę, na `main`, pełna brama TEST w częściach: `scripts/test-db-gate-step.mjs` (jedno zadanie max 40 min) + `scripts/test-db-gate-summary.mjs`, wyniki w `tmp-gate/wyniki.json`; zielone tylko przy jednym commicie i jednej wersji migracji.
- W tej samej bramie:
  - `npm audit` zależności deweloperskich — czy wyszła poprawka (P3-BRACES i każda nowa pozycja z §6 część 2);
  - E-MAIL-TYG: liczba e-maili produkcji z ostatnich 7 dni w `POSTEP.md` wobec szacunku 34 tygodniowo; strażnik limitu poczty 80 % (`email-budget`);
  - od ich wdrożenia: raport tygodniowy błędów aplikacji (E47, P10a) i pomiar wydajności w skali 1× (E46, P11; `UZGODNIENIE_08_10.md` pkt 5);
  - od P3: doradca Supabase „security” wobec listy wyjątków (E19 pkt 6).
- **Gdy w niedzielę agent nie pracuje** (np. po wydaniu): właściciel otwiera nowy czat i wkleja blok „Brama niedzielna” z `PROMPT_START_CURSOR.md`.
- Gdy agent pracuje nad paczką: przed bramą niedzielną zapisujesz bieżącą pracę commitem na gałęzi paczki i przechodzisz na `main`; po bramie wracasz na gałąź paczki, a wynik bramy wpisujesz w `POSTEP.md` w następnym commicie paczki.
- **Przy starcie 11.10:** bramą niedzielną 11.10 jest pełna brama TEST z odbioru P0b (na `main` po scaleniu P0b), także gdy skończy się po północy. **Następna: niedziela 18.10** i dalej co tydzień, także po wydaniu.
- Bramę niedzielną zaczynasz po bieżącym commicie, przed następną pozycją; przez czas jej trwania obowiązuje G-15 (`ROZSTRZYGNIECIA_LUK.md`): bez zmiany gałęzi i plików.

**Brama a jeden folder (G-15):** gdy brama TEST albo przebieg w GitHub Actions (`unit` / `visual` / `db`) się kręci, nie zmieniasz gałęzi ani plików i nie pushujesz nowych commitów na tę gałąź (zasada Windows pkt 4, D-20261011-2135-01). W tym czasie czytasz materiały następnej paczki i spisujesz w czacie listę zmian. Gałąź następnej paczki zakładasz po końcu bramy / po scaleniu.

## §4. Paczki

Każda paczka:
- **zakres** = wymienione etapy w całości (punkty „Rozwiązanie / Propozycja / Do wykonania” w `etapy/E<nr>.md`), z decyzjami i rozstrzygnięciami — **chyba że przy etapie podano część** (wtedy reszta etapu jest w paczce wskazanej przy nim);
- **wygląd** = obraz etapu z `raport/img/` i najnowsze decyzje z `raport/index.html`; telefon: obraz telefonu, gdzie jest, inaczej zasady E8; komputer: obraz komputera, gdzie jest, inaczej układ ekranu bez zmian poza treścią etapu; miejsca bez obrazu — Z10;
- **odbiór** = sekcja „Test” etapu + punkty „Odbiór” paczki + brama.

Status paczki wpisujesz tu: `DO ZROBIENIA` → `W TOKU (gałąź)` → `NA PRODUKCJI (commit, godzina)` → `SPRAWDZONE (dopisek koordynatora)`.

**Kolejka wyglądu (D-20261016-2130-01):** `wyglad/W-dane` PR #274 — scalone i wdrożone 17.10.2026 00:38 po skończonym C3 (`7db7282f`, `dpl_CaHR42SHedxQesLr1Q6W6hXPusA1`). Wygląd bez bazy (F8): „Inne pliki” z „+ Dodaj” (produkcja: `otherDocsOn()` = false do P5), przerywana linia objazdu (produkcja: `detourLinesOf()` = [] do P9), przeprawy z HERE z `map_display_state.ferries` (bez danych zostaje stały tor). Plik dopisku wszedł z PR.

**Kolejka wyglądu (D-20261017-0800-01 / 0930-01 / 0915-01 / 1100-01):** scalasz **#277 → #279 → #280 → #282** w przerwach między pozycjami, każdy po zielonych `unit` i `visual`; wdrożenie po scaleniu. Wzorce `visual` odświeża koordynator; gdy `visual` czerwony przed jego commitem z wzorcami — sygnał „VISUAL #<numer>”.
- **#277 `wyglad/W-audyt` (D-20261017-0800-01):** `serverRuleOn(key)` (`TRACKING_WINDOW` → A1, `SITE_EXIT_DELIVERED` → A2, `WIND_E49` / `DETOUR_E49` → P6 E49 Z1/Z3, `ROAD_PL_HERE` → P6 E2, `ROAD_SITUATIONS_MAP` → P9 E29 pkt 3 — przy wdrożeniu przestawiasz tylko swój klucz na `true`, test: tekst na produkcji bez „włączamy wkrótce”); 6A bez wielkich liter; 5B „Opłata paliwowa” KSH/SCX tylko do odczytu w demo; domyślnie EUR (`STORE_SCHEMA_VERSION` 2→3); przepięcie w Harmonogramie; liczby po polsku; dzwonek; `lazyRetry`. **SCALONE I WDROŻONE.**
- **#279 `wyglad/W-demo` (D-20261017-0930-01, na #277):** daty demo zgodne z 23.09; ETA w demo (`demoEta.ts` w `PROD_DEMO_SWAP`); `STORE_SCHEMA_VERSION` 3→4; „po oknie” tylko za oknem dostawy; `fxForDate(…, unloaded)` kurs bieżący przed rozładunkiem. **SCALONE I WDROŻONE.**
- **#280 `wyglad/W-pl` (D-20261017-0915-01, na #279):** panel tylko po polsku (8A); EN/SV tylko w aplikacji kierowcy; N20 w aplikacji; pierwsze wczytanie 317,6 kB gzip. **SCALONE I WDROŻONE.**
- **#282 `wyglad/W-eta` (D-20261017-1100-01, na #280):** `etaDuration` — czasy „X d Y h Z min” (pigułka, Mapa, blok ETA, pasek śledzenia, PDF, sprawy ETA w demo); minus „−”; „przyjazd nocą” na Mapie i w Harmonogramie; Opcje › Zasady transportu › Kalibracja ETA (produkcja: „Brak źródła danych.” do podłączenia w P4-u); „Ten telefon / komputer”: „Wiadomości z Czatu nie przychodzą e-mailem.” (C3-p).

P0a i bramy niedzielne zmieniają tylko dokumenty: status P0a `NA PRODUKCJI — dokumenty, bez wdrożenia aplikacji`, a hash scalenia P0a wpisujesz w pierwszym wpisie P0b w `POSTEP.md`.

### P0-CI · Narzędzia na Windows (D-86, D-87) — NA PRODUKCJI — narzędzia, bez wdrożenia aplikacji
- Według dopisku `D-20261011-2135-01`; dokończenia: `D-20261011-2254-01` (R1–R3), `D-20261012-0105-01` (R4–R6; R7–R9 do dokumentów).
- **R1–R6:** R1 `service_role` w `db.yml`; R2 regresja D14 („wstecz zamyka szufladę”); R3 `maxWorkers` tylko na Windows; R4 `TZ`/`PGTZ=Europe/Warsaw` w `db.yml`; R5 `baf` niezależne od daty; R6 `bmapa` niezależne od miesiąca.
- **Hash scalenia:** `9b0f3dc8` (PR #152, merge 12.10.2026).
- Workflows: `.github/workflows/db.yml`, `.github/workflows/visual.yml`. Bez wdrożenia aplikacji w zakresie narzędzi; po R2 wdrożenie aplikacji z `main` (POSTEP P0-CI).

### P0a · Wgranie kompletu dokumentów — NA PRODUKCJI — dokumenty, bez wdrożenia aplikacji
- Według `docs/handover/audyt_claude_2026-10-08/paczki/P0a_WGRANIE.md`: pliki z kompletu na swoje miejsca, przeniesienie starych dokumentów do `docs/archiwum/2026-10-08/` skryptem `paczki/P0a_przeniesienia.sh`, wpis w `POSTEP.md`.
- Tylko dokumenty. Bez zmian w `src/`, `supabase/`, `scripts/`, `tests/`.
- **Hash scalenia:** `0aaf412b` (PR #153, merge 12.10.2026).
- **Odbiór:** zmiany tylko w `AGENTS.md`, `.cursor/rules/**`, `docs/**` oraz przeniesienia plików z katalogu głównego i `design/claude-v2.0/CLAUDE_V2_SOT.md` do `docs/archiwum/2026-10-08/`; w `AGENTS.md` i `.cursor/rules/` nazwy starych plików (`SCOPE.md`, `ZLECENIE_*`) występują tylko w zdaniach, które nazywają je archiwalnymi.

### P3-APK — uzupełnienie W21 · Pin SHA w workflow APK — NA PRODUKCJI — scalenie e8351fc3 (PR #154), build APK zielony
- Po W21 (dostarczone 12.10.2026, 02:38): w `.github/workflows/sms-gateway-apk.yml` akcje przypięte do pełnego SHA (lista koordynatora 12.10); `packages: platform-tools`; CI `TOWER_APK_KEYSTORE_PROPS` bez lokalnej ścieżki Windows.
- PR #154 → merge `e8351fc3`. Odbiór: `sms-gateway-apk` zielony (run 38190237518), artefakt `sms-gateway-debug` (5,7 MB); `unit` i `visual` zielone. Bez wdrożenia aplikacji.

### P0b · Narzędzia bramy — NA PRODUKCJI — narzędzia, bez wdrożenia aplikacji (scalenie `832cca5a`, 12.10.2026 21:43)
Tylko `tests/`, `scripts/`, `.githooks/`; bez aplikacji i bez migracji. Pierwszy commit: włączenie dopisków D-20261011-2135-01, D-20261011-2254-01, D-20261012-0105-01 (PLAN §2).
1. `scripts/lib/gate-suites.mjs`: oczekiwane liczby zgodne z `tests/db/gate.sh`. **Jedno źródło liczb:** `gate.sh` czyta oczekiwane z `gate-suites.mjs`; dla TEST osobna kolumna z udokumentowanymi różnicami (security −4, risks −2, **dec6 −4**: SKIP wstawek `auth.sessions` dla kont seeda — FK `sessions_user_id_fkey` na hosted; lokalnie/CI stub bez FK; **backup −8**: SKIP eksportu/odtworzenia wymagającego CREATE DATABASE / harness — pełne 29 w CI `db.yml`, D-86); `session` i `l13` — znany dług, jak dziś.
2. `tests/db/gate.sh`: zmienna `SUITES=a,b` uruchamia tylko wskazane zestawy (z szablonem `tower`); bez zmiennej — wszystkie.
3. Konta testowe 5 rodzajów (HHL Administrator, HHL Operacje, KSH Użytkownik, SCX Dyspozytor, SCX Użytkownik) na bazie TEST `emkbykwenwrjmbprydml`; skrypt odmawia uruchomienia dla `nglnnrmzmhusvxslousq` i jest wywoływany po każdym kroku `prep` bramy TEST (krok czyści schemat).
4. Sprawdzić `git lfs version` i `git config core.hooksPath` (= `.githooks`). Brak = wpis w §5, bez `--no-verify`.
5. Pomiar i wpis w `POSTEP.md`: czas haka gałęzi, przebiegów `unit`, `visual` i `db` w GitHub Actions, potwierdzenia TEST.
- **Odbiór:** pełna brama TEST (w częściach) zielona na `main` z oczekiwanymi liczbami TEST; check `db` zielony na `main` po scaleniu P0b; `gh workflow run db.yml --ref main -f suites=security` daje zielony przebieg tylko z zestawem security; konta testowe istnieją na TEST po kroku `prep` (każdy następny krok czyści schemat; zestaw testów ról z 5 kontami zakłada je sam). — **spełnione 12.10.2026 21:42** (TEST `832cca5a`, BRAMA ZIELONA; `db` na main po #162).

### P1 · E18 porządki danych testowych + „ERGO Hestia” — NA PRODUKCJI (13.10.2026 04:32, merge `08c18747`, migracja 0193)
- **D-105 (D-20261017-0730-01):** SELECT — konta `+tower-o3-*` mają nie istnieć; literówka „scandimavian” w nazwach i adresach — poprawić z kopią. Wynik (liczby, bez adresów) w `POSTEP.md`.
- Według `paczki/P1_E18.md` (sprawdzone na produkcji 08.10 14:19–14:27). Warunek startu: P0a scalone (akceptacja planu = akceptacja P1).
- Zakres: E18 P2, P3, P6–P11, P13, token kierowcy SG-01 + nazwa ubezpieczyciela SCX. Poza P1: E18 P12 → P7, E18 P16 → P6, E18 P14 → P10a, E18 P15 → P2.
- **W22 rozstrzygnięte (właściciel 09.10.2026, 13:09: „usunąć z odpięciem 11 wpisów dziennika”):** wiersze `app_users` 6 kont „+tower-*” usuwasz, a 11 wpisów `audit_log`, które na nie wskazują, odpinasz (nie kasujesz) — kolejność, progi i STOP w `paczki/P1_E18.md` („Wspólne dla kont E18 P2 i P3”) i w dopisku D-20261009-1309-01 R3.
- **D-20261012-2210-01 (pozycje w P1):**
  - **D1 (R2)** — brama TEST zawsze we własnej kopii roboczej (`/d/Watch Tower/brama-test`, detach na SHA potwierdzenia); pętla kończy się sama na „komplet”; w `repo` praca nad następną pozycją; obowiązuje od potwierdzenia P1.
  - **D2 (R3)** — parytet `schema_migrations` na produkcji przed migracją P1: `scripts/mig-registry-parity.mjs` (dry-run-prod → apply-prod → verify-prod); wzór MIG-0159-REG; potem `_check-mig-parity.mjs` (`missing_on_prod` = tylko 0193).
  - **D3 (R4)** — poprawka R8 (D-20261012-0105-01): nakładanie migracji wyłącznie `db push` po parytecie; STOP przy `migration repair` / MCP / SQL Editor; skill `tower-migracja-bazy` pkt 1, 6, 9.
  - **D4 (R5)** — słowo w odbiorze P0b (konta po `prep`) — zrobione przy włączeniu dopisku.
  - **R1** — zatrzymanie pętli bramy TEST — wykonane 12.10 22:32 (POSTEP); nie jest pozycją kodową.
  - **D5 (D-20261012-2335-01, K1–K9)** — okna i próg 5 dla P13; `auth.users` bez cichego pomijania (brak tabeli tylko w CI); zaproszenia tylko po e-mailu `+tower-test`; progi SG-24 (1 / 2 / 2); wyjazd SG-03 po `geofence_kind` i nazwie; kontrola powiadomień i `raise notice`; kopia wierszy P11, sporów i dokumentów faktury; zestaw `e18` z brakującymi sprawdzeniami (liczba w `gate-suites.mjs`); `computed_at` w `eta_basis`. Bez potwierdzenia na TEST i bez scalenia #164, dopóki check `db` nie jest zielony na nowej głowie.
  - **D6 (D-20261013-0345-01, L1–L6)** — cofnięcie zmiany aplikacji z `1eca3a01` (`src/data/supabaseProvider.ts` = `main`); testy na żywo zielone na TEST (BK3 14/14, PKCE 8/8, przeglądarka, BK5 8/8): fixture M10/M12 w BK3, polityka hasła TEST = produkcja, e2e logowania hasłem, BK5 na kontach 5 ról; ważność potwierdzenia bazy na `a24c05e0` tylko gdy `git diff --stat a24c05e0 HEAD -- supabase tests/db scripts/lib scripts/e18 src` puste. **Bez scalenia PR #164, dopóki L1–L6 nie są spełnione.**
- **Odbiór:** „Odbiór” w `paczki/P1_E18.md` + D1–D3 z dopisku D-20261012-2210-01 + „Test odbioru” z dopisku D-20261012-2335-01 (D5) + test odbioru D6 (dopisek D-20261013-0345-01).

### P2 · Fundament ekranów — NA PRODUKCJI (13.10.2026 14:08, merge `35abe70b`, migracja 0194, wdrożenie `dpl_CqK5DSotFYHT8QyeFwLzMUixdBCs`)
- **E41** nazwa transportu:
  - jedna funkcja „kod · numer HHL” dla HHL i SCX; KSH widzi tylko kod, a baza nie wysyła KSH numerów;
  - tytuł sprawy: „nazwa — co się stało”;
  - SMS sam kod.
- **E21** jeden moduł formatów (daty „01.10, 12:00”, liczby, „4,8%”, waluty). Strażnik tekstów według `ROZSTRZYGNIECIA` E21-1: od P2 blokuje na ekranach i kategoriach poprawionych przez E21 i przez zamknięte paczki; reszta w raporcie do swojej paczki.
- **E10** kontrast: `--amber-ink`, biała liczba w dzwonku; ta sama zasada na wszystkich ekranach. Axe w obu motywach jako raport.
- **E8** telefon:
  - dolny pasek 5 przycisków (Kokpit, Harmonogram, Ryzyka z liczbą, Dokumenty, Więcej) zamiast ☰;
  - tabele → karty; cele ≥ 44 px; tekst ≥ 12 px;
  - od P2 każda paczka spełnia te zasady.
- **E18 P15** nowe tytuły otwartych spraw, jednorazowo, migracją danych z kopią: numery wewnętrzne → nazwa E41; szwedzkie tytuły ROAD_SE → po polsku. 16 spraw „Nieznany kod źródła drogowego” zostaje do P10a (Stan systemu).
- **Testy do przepisania:** `etap4-ui.spec.ts` l.71–86 i 135–136; `aud03-ksh-panel.spec.ts` l.64; `etap5-ui.spec.ts` (`.wb-code`); `aud02-dzwonek.test.ts`; `order-numbers.test.ts`; `stylesheet-mockup.test.ts` (ODSTEPSTWA E10); migawki `visual.spec.ts`, `visual-states.spec.ts`; zestawy `security`, `aud03`.
- **Ekrany:** wszystkie (nazwa, formaty, dzwonek, dolny pasek telefonu).
- **Odbiór:** KSH przez API nie dostaje żadnego numeru (test bazy na TEST); 0 „●” w aplikacji; strażnik tekstów: 0 trafień w zakresie blokującym (E21-1), raport reszty w PR; zrzuty 1440 i 390 Kokpitu, Harmonogramu i panelu porównane z makietami E41, E21, E10, E8.
- **Poprawki P2 (D-20261013-1400-01):**
  - Q1 wdrożenie aplikacji z `main` według R7 — wykonane 13.10.2026 14:08, `dpl_CqK5DSotFYHT8QyeFwLzMUixdBCs`; plik JS przed `assets/index-DtP8UgG7.js`, po `assets/index-h0t0ItfK.js`.
  - Q2 trzynaście tytułów „Zakaz ruchu ciężarówek w Szwecji” (roboty drogowe) — NA PRODUKCJI (13.10.2026 15:35, merge `c410799a`, migracja 0195, wdrożenie `dpl_6FkHhuRasJEFybtjDRbLY72P8kvv`).
  - Q3 zasada „NA PRODUKCJI” w `tower-wdrozenie` — obowiązuje od 13.10.2026 14:00.

### Poprawki P2 — wygląd · NA PRODUKCJI (13.10.2026 17:56, merge `4627c8f5`, wdrożenie `dpl_F55udKq2cMiUWyM1CXdY9Kh4sz8r`)
Gałąź `pakiet/P2-wyglad`. Tylko aplikacja, bez migracji. D-20261013-1535-01 V1–V4; dowód według Z10 i Z11 (D-20261013-1550-01).
- **V1.** Harmonogram: kolumna „Wysyłka” = sam kod (E38 1A). Numery w swoich kolumnach (HHL: obie; SCX: swój numer, numer HHL tylko do odczytu; KSH: bez kolumn numerów). Nazwa „kod · numer” zostaje w nagłówku panelu, na Mapie, w dzwonku, e-mailach, listach spraw, Kokpicie i na kartach telefonu. Reszta Harmonogramu bez zmian — to P7.
- **V2.** Dolny pasek telefonu: liczba tylko przy „Ryzyka”. Menu boczne na komputerze bez zmian.
- **V3.** Zasady E8 na telefonie (≤ 768 px) dla wszystkich ekranów: nic uciętego, karty zamiast tabel, cele ≥ 44 px, tekst ≥ 12 px. Brama Playwright: 9 widoków (HHL; Kokpit, Mapa, Harmonogram, Ryzyka, Dokumenty, Finanse, Faktury, Strefy, Opcje) przy 360, 390 i 430 px — elementy poza ekranem, cele < 44 px i tekst < 12 px = 0; blokuje scalenie. Wyjątki tylko w `tests/fixtures/e8-exceptions.txt`.
- **V4.** Dowód w `docs/handover/odbior/P2/`: Kokpit, Harmonogram, Dokumenty, Finanse, panel transportu; 390 i 1440 px; konta według Z11; obok obrazu z `raport/img/` albo wzoru z Z10. Migawki przez `visual.yml` (`update=true`) i wpis w `G4_WZORZEC.md`.

### Poprawki P2 — wygląd 2 · NA PRODUKCJI (13.10.2026 19:53, merge `770960fd` PR #177 `wyglad/P2-2-popr`, wdrożenie `dpl_ESWeHnmtc375vwNpyZMZsH7CSCCH`; wcześniej #176 `b9ae3d37` / `dpl_2S9uAEnAqEdv2sgTCUQWC3gDqtaL`)
Gałęzie `wyglad/P2-2` i `wyglad/P2-2-popr` (koordynator; D-20261013-1815-01 W1–W7; D-20261013-1835-01 F2/F3 pkt 5). Tylko wygląd, bez migracji. Cursor scalał i wdrażał według F2 pkt 3.
- **W1.** Kokpit na telefonie: 2 kolumny, liczby w jednej linii.
- **W2.** Karty: jedna kolumna etykiet (`td::before` left).
- **W3.** Finanse „Marża według typu elementu” jak `e8-after`.
- **W4.** Dokumenty jak `e8-after`.
- **W5.** Pola wyboru zwykłe; wiersz ≥ 44 px.
- **W6.** Brama E8 szczelna (`main` nie zwalnia).
- **W7.** Dowód w `docs/handover/odbior/P2/`.

### P3 · Uprawnienia, konta, Opcje, pasek górny — NA PRODUKCJI (logika/baza: scalenie `d3cbe4d8` + `567fcc5a`, wdrożenie `dpl_9tAM8dDaeXZ2awdpHD6RCNwdkLPP`, 13.10.2026 23:32); P3-a wygląd: scalenie `25b71bca` (PR #178), wdrożenie `dpl_FBYjeG86cptLjWvXiRmURHH5kKkt`, 14.10.2026 00:12; P3-b Kokpit: scalenie `50b23eb0` (PR #185), wdrożenie `dpl_Go31sqkke7v66cur6AxKfkuDwDWj`, 14.10.2026 02:53
- **Ekrany — wygląd:** P3-a pasek górny + E13 — `wyglad/P3` (PR #178, D-20261013-2255-01); P3-b Kokpit (E9, V5) — `wyglad/P3-b` (PR #185, D-20261014-0215-01) **NA PRODUKCJI**; P3-c Opcje i Ustawienia (E11, E12, E37, E6) — `wyglad/P3-c` (PR #190, D-20261014-0700-01) **NA PRODUKCJI**. Cursor: logika, baza, uprawnienia, Podgląd — bez przebudowy wyglądu ekranów koordynatora (F1).
- **Podłączenie danych ekranów Opcji** (D-20261014-0700-01 J3; bez zmiany wyglądu — F1):
  1. **Moje konto** (`AccountScreen`: `my_profile`, `admin_user_profile_set`, 2FA z `Mfa`, `my_sessions` / `revoke_user_sessions`) — zaraz po scaleniu P3-c (G4 pkt 2); HHL zamiast trzech formularzy; KSH/SCX; w Podglądzie tylko odczyt; poprawka 2FA R1–R5 — D-20261014-1420-01; **P3-d:** urządzenia 2FA i wymaganie 2FA — wygląd `wyglad/2fa` (#243); dane D-20261016-0405-01 pkt 1–2; po podłączeniu usuwasz `MyMfa` (R2 D-20261014-1420-01).
  2–11. Użytkownicy, Logowania, Kto co dostaje, Co dostaję, Komunikat, Progi, Przełączniki, Historia, Eksport, stany przy menu — **P3-d** (zaraz po P4; D-20261014-1420-01 R7; funkcje bazy już na produkcji; propsy z dopisku wyglądu); pkt 8 (Przełączniki): urządzenia 2FA i wymaganie 2FA — wygląd `wyglad/2fa` (#243); dane D-20261016-0405-01 pkt 1–2; po podłączeniu usuwasz `MyMfa` (R2 D-20261014-1420-01).
  12. przełącznik strefy dla Operacji HHL (E12 1A) → **P8** (E42).
- **Pytanie (J4) — odpowiedź (D-20261014-1420-01 R7):** ocena przewoźnika według raportu (E9) w **Kokpicie**. Element wyglądu robi koordynator; do tego czasu ocena zostaje w „Dla mnie › Wygląd i waluta”.
- **E9** prawa ról (z E36, zamkniętym w E9):
  - 5 rodzajów kont, bez CLIENT_ADMIN i SITE_VIEWER;
  - menu według roli; „Moje zadania” SCX znika;
  - tabela uprawnień z poprawkami E9-1 do E9-4;
  - „Podgląd” według E9-7 i G-07;
  - **daty i godziny załadunku i rozładunku (decyzja 09.10 13:09 pkt 3, G-20):** zmienia i potwierdza tylko KSH Użytkownik; HHL Administrator, HHL Operacje, SCX Dyspozytor i SCX Użytkownik — tylko odczyt (przyciski zmiany i potwierdzenia dat tylko u KSH); baza odrzuca zapis tych pól z innych ról; ścieżka wgrania pliku KSH (E38) nadal zmienia daty; „Działaj jako” konto KSH — zapis dozwolony jako konto KSH, z prawdziwym wykonawcą w dzienniku i Historii (konstytucja VI.5; pytanie W30; D-20261009-1309-01 R6 pkt 3).
- **E14** lista zmiany rodzaju konta (błąd `UsersAdmin.tsx` l. 84).
- **E6** konta: imię i nazwisko (2 pola), telefon E.164, „Zadzwoń”.
- **E12** Opcje: 6 grup, prawa, 0 × 403; Operacje HHL tylko odczyt + „Dla mnie” + eksport; Historia zmian; przełączniki.
- **E11** Opcje: menu boczne, ekrany według E12 pkt 1 i G-11, „Dla mnie”, „Kto co dostaje” (zdarzenie × 5 rodzajów kont × kanał). Wiersz rodzaju `PLAN_DATES_CHANGED` dla HHL Administrator, HHL Operacje, SCX Dyspozytor i SCX Użytkownik: w aplikacji (dzwonek) stały, nie do wyłączenia, opis „zawsze — decyzja właściciela 09.10”; e-mail i push według matrycy (G-18, D-20261009-1309-01 R4).
- **E5** logika powiadomień:
  - matryca, cele kliknięć, push tylko dla krytycznych;
  - wartości startowe = dzisiejsze, e-mail wyłączony (E5-1).
- **E19** bezpieczeństwo bazy:
  - `security_invoker` dla 3 widoków;
  - `admin_security_flag_set`;
  - zadanie zapisujące raz dziennie wynik doradcy „security” i stan ustawień (E19-4); kafelek „Bezpieczeństwo” na ekranie Stanu systemu — w P10b;
  - **bez** zawężenia `events_insert` (to P6).
  - Instrukcja ustawień logowania dla właściciela → §5.
- **E37 (część: pasek górny; reszta E37 w P10b)** konto, „Moje konto” i „Wyloguj” po prawej; „Podgląd: HHL · KSH · SCX”; motyw w menu konta.
- **E13** dzwonek na telefonie (`.bell-pop` fixed, `.topbar` overflow).
- **Testy do przepisania:**
  - `auth-config.test.ts` l.17, 22;
  - `d-eur-t.spec.ts` (`tasks`, `settings`); `scripts/baseline.mjs` VIEWS (moje-zadania);
  - `persist-toast.spec.ts`; `permissions-phone.test.ts`, `decision-access.test.ts`, `historyActor.test.ts`;
  - `etap4-ui.spec.ts` l.292–300, `etap6-ui.spec.ts` l.35–42 (akordeon → menu boczne); `etap5-ui.spec.ts` l.53–75;
  - `i5-mfa.test.ts`, `theme-role.test.ts`;
  - migawki;
  - zestawy `security`, `invite`, `adm10`, `hist11`, `nullguard`.
- **Ekrany:** pasek górny (wszystkie), Opcje (wszystkie), Kokpit i menu według roli — wygląd dostarcza koordynator na `wyglad/P3`; Cursor podłącza dane i uprawnienia.
- **Odbiór:**
  - test ról na TEST: 5 kont × tabela E9 przez API i przez ekran;
  - 0 odpowiedzi 403 w konsoli dla każdej roli;
  - Operacje HHL nie mogą zapisać ustawień (odmowa w bazie);
  - zapis daty albo godziny załadunku / rozładunku przez API: HHL Administrator, HHL Operacje, SCX Dyspozytor, SCX Użytkownik → odmowa bazy; KSH Użytkownik → przyjęty, wpis w Historii; wgranie pliku przez Administratora HHL nadal zmienia daty; „Działaj jako” KSH → zapis przyjęty, w dzienniku prawdziwy wykonawca (W30);
  - zrzuty porównane z makietami E9, E11, E12, E37 (pasek), E6, E13;
  - Kokpit na telefonie według E8 pkt 6 i `img/e8-after.webp` (D-20261013-1535-01 V5): kafelki 2 × 2 o równej szerokości; liczby się nie łamią („54 / 72” w jednej linii); 3 najpilniejsze sprawy; treść kafelków według E9;
  - P3-d odbiór D-20261016-0405-01 pkt 3: konto bez 2FA → „Wyłączona” i „Włącz 2FA”; po włączeniu → lista z 1 urządzeniem i „Dodaj drugie urządzenie”; drugie urządzenie → „Usuń” przy obu; HHL Administrator w `aal2` z 2 urządzeniami włącza i wyłącza wymaganie (wpis w dzienniku); przełącznik nieaktywny z powodem przy 1 urządzeniu; Podgląd KSH na „Moje konto” — 0 aktywnych pól i przycisków; blok e2e `wyglad/2fa` (2 testy) zielony na demo.

### Poprawki P3 · NA PRODUKCJI (14.10.2026 02:40, merge `38711bd7` PR #184, migracja 0204, wdrożenie `dpl_DHp28HQMcy6D5PHZmMWCcvRcqKUF`)
- **D1 / R1–R4** (D-20261014-0015-01): G-20 baza + `g20`, WEB_PUSH tylko krytyczne, DECISION×CLIENT_USER `push=false`, wyjątki doradcy, instrukcja W1.
- TEST przed scaleniem: security 84, status 44, nullguard 622, g20 15/15; doradca TEST 0 nowych. CI unit/visual/db zielone na `dcb2d28e`. Edge `web-push-send` wdrożona.

### P4 · Statusy, śledzenie, ETA — **CZĘŚCIOWO** (commit `3c676d96`, 15.10.2026 15:38; migracje 0214–0216; D-20261017-0730-01)
- **Brakuje (przeniesione):** E26 reguły stref → **A2**; E27 okno na serwerze → **A1**; „Gotowy” w bazie → **A9**; E15 pkt 1–3, E44 pkt 2–8, L17 → **P4-u**. Zrobione były m.in. kolumny i maskowanie RIO — nie pełne E44 ani pełne E15/E26/E27 w bazie.
- **E25** statusy (automat „Gotowe do fakturowania” opierasz na dzisiejszym dokumencie CMR po dostawie; P5 podmienia na wymóg z E31):
  - status aplikacji `AT_PORT_SE` dla Port SE z listami statusów (D-20261014-0315-01 H1);
  - Kokpit i liczba „Faktury” ze statusu `READY_TO_INVOICE` (`src/lib/cockpitE9.ts`, D-20261014-0215-01 H3);
  - pomiar morza na kafelku „Najbliższy prom” (`DashboardView.tsx`, `sea` — B7 / D-20261014-0215-01 H3);
  - nowe kody „Gotowe do fakturowania”, „Zafakturowano”; UNLOADED scalony z DELIVERED;
  - typy zdarzeń `STATUS_READY_TO_INVOICE` / `STATUS_INVOICED` w `load_events_event_type_known` (D-20261014-0640-01 H1); autor w `load_status_set` i jedno zdarzenie na zmianę; warunek „nie wcześniej niż poprzedni status” w bazie (H2);
  - okno „Zmień status” (role według decyzji 17:46); jedna funkcja w bazie;
  - poprawka −2 h dla nowych zapisów;
  - oznaczenia Opóźniony / Brak GPS / Brak dokumentów obok statusu (L7);
  - „Gotowy” według L6 (awizacja kompletna z pilotami, gdy wymagani — L29) i L9; powiadomienia według L8.
- **E26** reguły stref: wyjazd ze Śremu, wjazd i wyjazd z placu, sprawa „czy dostarczono” (L14), lista reguł w Opcjach według L13 (zmienia Administrator HHL przez E34 i E35).
- **E28** pasek etapów: 10 kafelków, tylko liczba, jeden filtr, kliknięcie (Harmonogram filtruje, inne strony → Mapa).
- **E27** okno śledzenia:
  - 03:00 w dniu załadunku (dzień z planu KSH — L15; godzina — L16) do „Dostarczone”; zmiana daty przed startem przesuwa start;
  - pasek w panelu (E1-2); poza oknem brak przypisania pozycji;
  - bezpiecznik według L17.
- **E44** odczyt pozycji z linku RIO (decyzje właściciela 09.10 10:34, 10:54, 11:19; `etapy/E44.md` w całości — pkt 1–9; G-24):
  - **najpierw regulamin RIO** (`AGENTS.md` §6 „Nowa usługa zewnętrzna”): strona `public.position-sharing.rio.cloud` w robots.txt zakazuje automatów, API nie ma publicznej dokumentacji (E44 „Fakty”); zgoda SCX i podwykonawcy na automatyczny odczyt jest na piśmie (11:19). Wynik sprawdzenia (adres warunków, data, cytat punktu o automatycznym dostępie) wpisujesz w PR. Jeśli warunki RIO wykluczają automatyczny odczyt — STOP §1 pkt 12.6: wpis w §5, sygnał w czacie i dalej następna pozycja P4 (bez E44);
  - klucz RIO tylko po stronie serwera, `trackingRef` bez `secret` (D-20261014-0640-01 H4.1); `trackerOn` / `trackerPlate` (H4.2);
  - rozpoznanie linku w polu „Link śledzenia” w dzisiejszym oknie awizacji (`AwizacjaModal.tsx`), `rio_tracking_id` i `rio_secret` tylko po stronie serwera, zapytanie testowe po zapisie (pkt 1); P7 przenosi to działanie do nowego okna Awizacja bez zmian;
  - adapter `_shared/telematics/rioPositionSharing.ts`, cron `tower-rio-links` co 2 min — tylko transporty w oknie śledzenia E27 i tylko w czasie `start`–`end` linku (pkt 2);
  - zapis pozycji do tej samej tabeli co emtrack, `position_source = SUBCONTRACTOR_LINK`, bez duplikatów, prędkość z odległości i czasu (pkt 3); dalej jak dla emtrack (pkt 4) — SMS Śrem / Boden z E42 działają po P8 na tych samych pozycjach;
  - ważność linku i nowy link na każdy przejazd (pkt 5), rozpoznanie ciągnik / naczepa (pkt 6), bezpieczeństwo `secret` (pkt 8);
  - testy na TEST na zmyślonym identyfikatorze, kluczu i rejestracji (G-17), nie na linku i rejestracji z przykładu w E44; adres zapytania w dzienniku `integration_runs` bez `secret` (pkt 8);
  - błędy (pkt 7): „Link RIO nieprawidłowy” — sprawa dla SCX; 3 błędy pod rząd — wpis w `integration_runs` (`rio-links`) i sprawa „Źródło danych nie działa · RIO” dla HHL, tak jak dziś dla emtrack (`SOURCE_DOWN`, E23 „Fakty”); e-mail i push do Administratorów HHL — od P10a (RIO na liście źródeł E23);
  - pole „Link śledzenia” a kompletność awizacji: L19 (nie blokuje) i pytanie W27.
- **E15** ETA:
  - `Load.etaDetail` z `eta_basis` (D-20261014-0640-01 H3.1); progi słowa pewności 30 / 120 min (H3.2);
  - poprawka odpoczynku, „czeka przed placem” (E15-2), przeliczanie co 5 min;
  - cisza GPS 30 min w ruchu / 3 h na postoju; geometria HERE (E15-1);
  - „–” przed wyjazdem, słowa pewności (E15-3), **kalibracja po 5 dostawach** (z dawnej „Rezerwy”, 3A): wygląd — `wyglad/W-eta` (Opcje › Kalibracja ETA); dane — D-20261017-1100-01 §3 (P4-u).
- **H-10** wiatr na drodze — **przeniesione do P6 E49** (D-20261016-0230-01; W19 zamknięte 16.10.2026, 02:08; D-84 = 20 m/s).
- **Dane jednorazowe** (migracja danych z kopią):
  - faza z pozycji: SG-03 → „Dostarczone” 07.10 12:19:54 i usunięcie pozycji po dostawie (L11);
  - SG-01 UNLOADED → DELIVERED; datę potwierdza Administrator HHL (§5).
- **Testy do przepisania:**
  - `etap4-ui.spec.ts` l.88–116 („Oznacz jako gotowy”); `visual-states.spec.ts` (`mark-ready`, chipy);
  - `status-label.test.ts`, `status-pill.test.ts`, `money-v2.test.ts` l.63, `telm2-sim.test.ts`, `l11-spine.test.ts`, `eta-*.test.ts`, `i15-eta-band.test.ts`, `corridor-eta.test.ts`;
  - zestawy `status`, `release`, `i2`, `h4`, `dwell`.
- **Ekrany — wygląd:** P4-a — `wyglad/P4` (PR #188, na produkcji; pasek E28, Harmonogram, Mapa E27, oznaczenia L7); P4-b — panel transportu (E25 Status i okno, E27 pasek w panelu, E15 ETA, E44) — `wyglad/P4-b` (PR #189) **NA PRODUKCJI**; P4-c — pole „Link śledzenia”, „Gotowy” (L6, L9, L29), sprawa L14, „Działa samo” — `wyglad/P4-c` (PR #193) **NA PRODUKCJI**. Kolejność #181 → #189 → #193 (D-20261014-1320-01 K1; D-20261014-1145-01 nie powstanie).
- **Dane wyglądu P4-c (K2, D-20261014-1320-01):** po scaleniu #193 — `trackingLink`, `readyGaps`, `deliveredCheck`, `autoMetaOf` (bez zmiany wyglądu, F1); razem z H3/H4 (0640) i R6 (1420 — usuń wyjątek `load_status_rank`).
- **Odbiór:**
  - sekcje „Test” E25, E26, E27, E28, E15 i E44 (pkt 9; `secret` w żadnym logu ani eksporcie — grep po testach);
  - test odbioru D-20261014-1320-01 (awizacja RIO, „Gotowy” z brakami, sprawa L14, Automatyzacje, telefon E8 P4-c);
  - na TEST przejazd SG-03 kończy się „Dostarczone 12:19” — na śladzie zmyślonym (G-17), a po zgodzie W25 także na prawdziwych pozycjach;
  - pełna trasa Śrem → Boden z symulowanymi pozycjami: każdy status raz, właściwy kafelek, prawdziwa godzina.

### Poprawki P2–P3 (audyt 15.10) — W TOKU (C1/C2/C3/C12/C14/C16/C16-H/C17 na produkcji; C3 `2938ae96` / `dpl_4iugo2qyvCYt9gNgHUpmjjH3hivi`, wygląd #274 `7db7282f` / `dpl_CaHR42SHedxQesLr1Q6W6hXPusA1`; potem Naprawy audytu 17.10 przed C4)
Po zamknięciu P4, przed P3-d (D-20261015-0300-01 C, D-20261015-0330-01, D-20261015-1955-01 C16). Gałąź `pakiet/poprawki-p2-p3-audyt-15`.
- **C1** ✅ zalew dzwonka E5 — ryzyko bez `load_id` bez IN_APP/EMAIL/WEB_PUSH; bez nowych RISK_RESOLVED; cel `/transport/brak` nie powstaje; WEB_PUSH tylko krytyczne z transportem (+ E5-5 źródła); jednorazowo nieprzeczytane RISK_* bez transportu → przeczytane. **Przed** `tower-road-pl` (P6 E2).
- **C2** ✅ `sw.js` push/notificationclick; `web-push-send` z celem; przełącznik z `push_subscriptions`; „Wyślij powiadomienie testowe”. **Odbiór C2 nie przeszedł** (BLOKER 15.10 — tylko OPTIONS 405, zero POST) → **C16** przed C3.
- **C16** ✅ (D-20261015-1955-01, BLOKER): **N1** CORS (`2b9c3679` / #226). **N2–N8** PR #229 → `456a7a14` / `dpl_7ngsrbV8JXwDHvDCEBRjdWVS2dLw` (0219, ack HMAC `nid\|sid`, `verify_jwt=false`, openWindow). Odbiór S24 z `delivered_at` — po teście właściciela; iPhone = W43.
- **C17** ✅ (D-20261015-2110-01, BLOKER): PR #235 → `e7595541` / `dpl_HRCPmDoD3Ghiumi6tXDkaxcSzRfs` (0220); 15048 READY_TO_INVOICE, 15060 INVOICED, 0× UNLOADED.
- **C16-H** ✅ (D-20261016-0100-01, BLOKER): PR #238 → `8bae03be` (0221); `send-notifications` v26; `APP_URL=https://tower.log-mar.pl`; tick starych WEB_PUSH = 0.
- **C3** ✅ macierz powiadomień po zdarzeniu; **poprawki C3-p** w Naprawach audytu 17.10 (nie 5 grup); jeśli `LOAD_STATUS × HHL_ADMIN` `email=true` → `false` (W39); **+ Cz13** (D-20261016-0310-01): wiersz „Wiadomość w czacie” — dzwonek i telefon włączone dla 5 rodzajów kont, e-mail wyłączony, wyjątek od C1 pkt 4; odbiorcy z `visible_to`, bez autora; **+ Cz25** (D-20261016-0315-01): odbiorców zawęża zawsze `visible_to`; ustawienie macierzy nie da KSH rozmów „tylko HHL i SCX”; **+ wartości startowe (D-20261016-0330-01 pkt 5):** wiersz „Nowa wiadomość w czacie” — dzwonek i telefon dla 5 rodzajów kont, bez e-maila; opis „tylko do firm, które widzą wiadomość · „tylko HHL i SCX” nigdy do KSH, niezależnie od ustawień”. **NA PRODUKCJI 17.10.2026 00:34** — scalenie `2938ae96` (PR #273), migracja 0222, `send-notifications`, wdrożenie `dpl_4iugo2qyvCYt9gNgHUpmjjH3hivi` (`index-B_buB0CA.js`). Bieżąca produkcja po #274: `7db7282f` / `dpl_CaHR42SHedxQesLr1Q6W6hXPusA1` (`index-Bv_J4hjW.js`).
- **C4** ustawienia z „było → jest” (`old_value`); alerty stref/ryzyk → profil lub usunięte.
- **C5** nazwa transportu w funkcjach bazy = `shipment_code` / `transport_label`; KSH bez numeru zlecenia.
- **C6** teksty spraw z serwera (E21): daty, pogoda, AUTO_STATUS bez UUID.
- **C7** role E9 w bazie; zestaw `e9-role`.
- **C8** Opcje HHL_OPS: pola nieaktywne, 0 × 403; `security_flags_list()`.
- **C9** testy bezpieczeństwa E19 pkt 6 (Przeczytali, anon, v_load_price_client, …).
- **C10** `my_profile`: `real_full_name`, `last_sign_in_at`.
- **C11** warunek „konto bez telefonu E.164” (pasek — koordynator).
- **C12** ✅ `KshDatesModal`: `DOC_MISSING` jak `preLoading`.
- **C13** lista kluczy starej Instrukcji do POSTEP (teksty — koordynator).
- **C14** ✅ (D-0330): `security-advisor-snapshot` czyta `ADVISOR_MGMT_TOKEN`; `advisor_ok=false` → `integration_runs.ok=false`.
- **C15** — **przeniesione do A8** (D-20261017-0730-01): po 3× `login_failed` emtrack → 1 próba / 6 h; jedna sprawa `SOURCE_DOWN:EMTRACK_WEB`.
- **Odbiór:** brama `db`, TEST (`risks`, `security`, `e41`, `e9-role`, `nullguard`, dotknięte), doradca TEST i produkcja.

### Naprawy audytu 17.10 — BLOKER przed C4 (D-20261017-0730-01) — W TOKU (C3-p i B1 NA PRODUKCJI; dalej B2…)
Decyzje właściciela 17.10.2026, 07:20: **1A, 2C, 3A, 4B, 5B, 6A, 7A, 8A**. Gałąź: `pakiet/audyt-17` (osobny commit na pozycję; można dzielić PR po 2–4 pozycje). Każda pozycja: test z odbioru → `POSTEP.md` → wdrożenie. Migracje z kopią. Pozycja czekająca na dane właściciela → „NA PRODUKCJI — bez …, czeka W…” i dalej.
**Kolejność:** ~~C3-p~~ → ~~B1~~ → **B2** → B6 → A8 → A1 → A2 → A3 → A7 → A9 → A4 → A5 → B4 → B5 → B7 → B8 → B9 → A6.
Po A6: C4–C11, C13 (zakres bez zmian; C11 = hasło min. 12 znaków **z literami i cyframi** — `passwordOk` dziś sprawdza tylko długość; test `auth-password.test.ts`) → P4-u → P3-d → …
Przed C4: przejazd testowy SG-03 na TEST (zmyślony ślad) od importu do faktury — wynik w `POSTEP.md` jako „próba R-3 na TEST” (dopisek §6).

### C3-p · Poprawki C3 — NA PRODUKCJI (17.10.2026 11:18; merge `17be0998` / PR #278; migracja 0223; `dpl_2xXvmtEXdvCnUp8WWW6DzNodae9G`)
1. **Czat bez e-maila zapasowego:**
   - `matrix_notify`: wiersz WEB_PUSH dla zdarzenia `chat` **bez** `payload.critical = true`;
   - `web_push_enqueue_fallback` i obie pętle `web_push_fallback_tick`: dodatkowo `template <> 'LOAD_CHAT_MESSAGE'`.
   - Test (`c16-push` / `c3`): wiadomość czatu bez potwierdzenia na telefonie po 5 min → 0 e-maili.
2. **Treść czatu na telefonie:** payload czatu ma `title` = „<transport_label> — <Imię Nazwisko> // <firma>” i `body` = treść wiadomości. Możesz też zrobić tak, że `web-push-send` składa tytuł i treść tym samym renderem co dzwonek. Pełna Cz14 (szablony E43) zostaje w P6.
   - Test na TEST: push czatu → na telefonie tytuł i treść, nigdzie „LOAD_CHAT_MESSAGE”.
3. **Kopia macierzy sprzed 0222:**
   - do `audit_log` (`action = 'C3_MATRIX_KOPIA'`) wpisujesz 25 wierszy `notification_matrix` sprzed 0222, odtworzone z Twojego skryptu wycofania (te same wartości co próba z ROLLBACK);
   - Historia zmian w „Kto co dostaje” pokazuje stan „było”.
4. **Osobne wiersze macierzy** (dopisek 1345 pkt 3.8):
   - „Auto 50 km przed placem” i „Auto 50 km przed Śremem” osobno;
   - „Źródło danych nie działa” i „Źródło danych wróciło” osobno;
   - `ZONE_ENTER` ze strefy `PRE_ARRIVAL` / `PRE_PORT` mapujesz na właściwy wiersz. Payload wyzwalacza stref niesie `geofence_kind`.
   - Test: wjazd do strefy 50 km przed placem → wiersz „50 km przed placem”, nie „Strefy”.
5. **Ukryty przełącznik znika (E5/E11, decyzja 07.10 12:52):**
   - `l13_decision_email` zależy tylko od wiersza macierzy „Nowa decyzja” (`dec_new`);
   - flagę `AUTOMATIC_DECISION_EMAIL` usuwasz z `security_flags` z kopią.
   - Test: wiersz e-mail wyłączony → 0 e-maili decyzji; włączony → e-mail.
6. **Sprawdzenie na produkcji (SELECT)**, wynik w `POSTEP.md`:
   - `SYSTEM` / „Źródło danych nie działa” × Administrator HHL: e-mail i telefon włączone;
   - KSH nie dostaje Stref ani zadań innych firm.
7. **Teksty z serwera bez `upper(` w funkcjach treści** (D-20261017-0800-01 §3 pkt 3 / 6A) — w C3-p albo C6; kody (`SG-03`, tablice) bez zmian.

### B1 · `security_flags` bez 403 — NA PRODUKCJI (`92117abd`, 0224, `dpl_2mB55evGPQh5RUT4LUCLsP31kFRv`, 17.10.2026 13:08)
- Polityka SELECT dla kont HHL i grant.
- `security_flags_list()` dla Operacji HHL (część C8).
- Test: Operacje HHL i Administrator HHL — wszystkie ekrany Opcji, 0 × 403 w konsoli; KSH i SCX — odmowa.

### B2 · Doradca bezpieczeństwa (W36 — właściciel wpisał sekret 17.10, 07:28)
- Sekret był wcześniej tylko w `.env.local`, a funkcja na serwerze go nie widzi. Teraz `ADVISOR_MGMT_TOKEN` jest w Supabase › Edge Functions › Secrets produkcji.
- Jedno ręczne wywołanie `security-advisor-snapshot` na produkcji. Ponowne wdrożenie funkcji tylko wtedy, gdy wywołanie dalej mówi „brak ADVISOR_MGMT_TOKEN”.
- Wynik: `advisor_ok = true`, liczba zgłoszeń w `POSTEP.md`, porównanie z `tests/db/advisor-exceptions.txt`.
- **W1 (właściciel zrobił 17.10, 07:28):** zgłoszenie `auth_leaked_password_protection` ma zniknąć. Wynik w `POSTEP.md`.

### B6 · Bezpieczniki i uprawnienia (małe)
1. **Bezpiecznik dzienny e-maili** (po 140 e-mailach z 15/16.10):
   - limit na osobę na dobę (20) i na rodzaj (np. 5);
   - po przekroczeniu jedna wiadomość zbiorcza, licznik w `email_budget_day` na użytkownika.
   - Test: 25 zdarzeń dla jednej osoby → 20 e-maili + 1 zbiorczy.
2. **`guard_invoice_update`:** `payment_status`, `paid_at` i `paid_marked_*` zmienia tylko HHL. Test: SCX i KSH → odmowa.
3. **`rio_secret`:** `revoke update (rio_secret) on loads from authenticated`; zapis tylko przez funkcję awizacji i sanitizer. Najpierw sprawdzasz, czy RPC awizacji nie pisze kolumny wprost.
4. **Funkcje bez logowania** (`keep_alive`, `report_client_error`, `report_csp_violation`): limit na IP i przeglądarkę (60 / 15 min).
5. **Polityka `loads_read`:** usuwasz martwą ścieżkę `OR current_org_kind() = 'SITE'`. Test w `security.sh`.

### A8 · emtrack: koniec 717 błędów na dobę (C15 — przeniesione tutaj)
- Po 3× `login_failed` → 1 próba / 6 h (`skipped_until`), aż do zmiany sekretu.
- Jedna sprawa `SOURCE_DOWN:EMTRACK_WEB` z „od kiedy”, klucz bez daty; 10 starych duplikatów zamykasz z kopią.
- Reset po udanym logowaniu.
- **W37:** właściciel wpisze nowe `EMTRACK_LOGIN` i `EMTRACK_PASSWORD` w Secrets i napisze „W37 wpisane”. Po tym jedno wywołanie, wynik w `POSTEP.md`.

### A1 · Okno śledzenia na serwerze (E27, D-134 — dziś brak)
- `emtrack-web` (`store.ts listActiveLoadsForTelematics`, `matchTrailer.ts`):
  - dopasowanie pozycji tylko dla transportów w oknie: 03:00 Europe/Warsaw w dniu załadunku (dzień z planu KSH / awizacji — L15, L16) → „Dostarczone”;
  - wykluczone `READY_TO_INVOICE`, `INVOICED`, `CANCELLED`;
  - przy nakładających się oknach — wcześniejszy niedostarczony.
- `telm_infer_phase_from_position` tylko w oknie.
- `detect_silent_vehicles`: tylko transporty w oknie, dowolne źródło pozycji.
- Bezpiecznik L17 jako cron dzienny.
- Zmiana daty załadunku przed startem przesuwa start.
- Test E27: 02:59 → pozycja nie przypisana, 03:00 → przypisana; po „Dostarczone” → nie przypisana; transport z przyszłego tygodnia → nie przypisana.
- **Przy wdrożeniu:** przestaw `serverRuleOn('TRACKING_WINDOW')` na `true` (D-20261017-0800-01 §2 pkt 1). Test: tekst na produkcji bez „włączamy wkrótce” (Pomoc › Mapa / pasek śledzenia).

### A2 · Reguły stref (E26, D-136, L14 — dziś brak w bazie)
- `apply_geofence_status` (nowa migracja):
  - wyjazd ze strefy załadunku (Śrem) po postoju ≥ 5 min → „Droga PL” i `actual_load_at`, **bez** warunku `loaded_confirmed()`;
  - wyjazd z placu (`SITE`, status `AT_SITE`) po postoju ≥ 10 min (`dwell_seconds` 600) → `auto_set_status(... 'DELIVERED', ...)` z czasem wyjazdu, w payloadzie `dwell_min`;
  - krócej niż 10 min → sprawa „Czy dostarczono?” (L14, nowy rodzaj w `decision_types`, `payload.dwell_min`) dla SCX i HHL;
  - nazwa portu z `geofence.name` w payloadzie.
- Odpowiedź na sprawę L14 w produkcji — funkcja `delivered_check_resolve(load, yes, note)`:
  - „Tak” → „Dostarczone” z czasem wyjazdu i wpisem w Historii;
  - „Nie” → zamknięcie sprawy z notatką.
- Podłączasz `onYes` i `onNo` w `TodoPanel.tsx` i `LoadDrawer.tsx` (dane, bez zmiany wyglądu, F1).
- Test (`dwell`, `status`): odtworzenie SG-03 na zmyślonym śladzie (G-17) → „Dostarczone 12:19”, śledzenie gaśnie; postój 6 min → sprawa L14; „Tak” → „Dostarczone”.
- **Przy wdrożeniu:** przestaw `serverRuleOn('SITE_EXIT_DELIVERED')` na `true` (D-20261017-0800-01 §2 pkt 1). Test: tekst na produkcji bez „włączamy wkrótce” („Działa samo” › Status ze stref / tabela stref).

### A3 · CMR z rozładunku i zadanie „Wgraj CMR” (E31, L26 — przeniesione z P5)
- `doc_requirements`:
  - CMR → `anchor = AFTER_UNLOAD` (po „Dostarczone”), `offset_hours` z Opcji (dziś 24), odpowiada przewoźnik;
  - usuwasz regułę „CMR 2 h po załadunku”, wymagania POD, SPEC i LASHING oraz PERMIT_SE dla wszystkich.
- Po „Dostarczone” bez CMR → sprawa SCX „Wgraj CMR”. Zamyka ją C17 po wgraniu.
- Zamykasz stare DOC_MISSING ze starego wymagania (dziś 21 fałszywych „po terminie”), z kopią.
- `doc_requirement_set`: zmienia tylko Administrator HHL (E9), sprawdzenie roli w funkcji.
- Test: SG-03 po „Dostarczone” → sprawa „Wgraj CMR” u SCX; wgranie CMR → sprawa znika, transport „Gotowe do fakturowania” (C17); Operacje HHL nie zmienią terminów.

### A7 · Tabela symboli, polisa PZU i zezwolenie firmowe (D1, D2 — przeniesione z P5; pliki W44 są w `D:\Watch Tower\dane\`)
- Tabela symboli w bazie (`symbol_specs`) i `symbol_spec_of(load)`:
  - wymiary zestawu, piloci PL/SE (PL-A / PL-B po szerokości), rodzaj zezwolenia „Firma” / „Trasa”;
  - uzupełnianie `loads.combo_*` przy imporcie.
- Wpis jednorazowy skryptem z plików `D:\Watch Tower\dane\` (dane z plików, nie z czatu):
  - zezwolenie firmowe 13/GD/2026;
  - polisa HHL (PZU).
- `doc_requirements_status` liczy PERMIT_PL / PERMIT_SE tylko dla „Trasa”; „Firma” podpina się sama.
- `documents.visible_to` polisy SCX bez KSH.
- `p5Source.ts` `permitsOf` / `policiesOf` / `permitScopeOf` → produkcja z bazy.
- Test: `permits = 1`, `insurance_policies = 2`; każdy transport ma wymiary, pilota i rodzaj zezwolenia; KSH widzi polisę HHL, nie widzi polisy SCX; „Zezwolenie SE” brakuje tylko przy KR.

### A9 · „Gotowy” w bazie (E25 L6/L9/L29, B4)
- Jedna funkcja kompletu awizacji `awiz_missing(load)`:
  - kierowca PL i SE (przy przepięciu) z telefonem, ciągnik, naczepa;
  - rejs przy trasie promowej;
  - piloci, gdy wymagani (z A7);
  - numery HHL i SCX;
  - polisa SCX z `insurance_policies` (nie z `documents.load_id`);
  - zezwolenie według rodzaju.
  Link śledzenia **nie** blokuje (4B).
- Z tej funkcji korzystają L3 (0143), `readyGaps`, `resourcesComplete` i Kokpit.
- `READY` nadawany w bazie po każdej zmianie.
- Wyłączasz `tower-zasoby` i zamykasz 93 RESOURCE_MISSING z kopią (E18 P12).
- Test: komplet → „Gotowy” sam; brak telefonu kierowcy SE → brak „Gotowy” i jedna pozycja w brakach; koniec fałszywego braku „POLICY_SCX”; jedna liczba „Do zrobienia” w menu, Kokpicie i dzwonku.

### A4 · Faktura tylko z CMR, co do grosza, z VAT (E4, B7 — przeniesione z P5)
- Kreator (`invoices3.ts` `billCandidates`, `pendingWeekLoads`) daje tylko transporty `READY_TO_INVOICE`. Reszta szara, z opisem „czeka na CMR”.
- `register_invoice`:
  - tolerancja 0: każda różnica ≥ 0,01 w walucie faktury → flaga KWOTA, bez „ZGODNA”; przy PLN porównanie po kursie NBP z faktury, do grosza;
  - VAT liczony w bazie: `vat = round(net × 0,23, 2)`, `gross = net + vat`; inny VAT lub brutto → odmowa z komunikatem po polsku;
  - `due_date ≥ issue_date`;
  - INVOICE_NEW także dla faktury kosztowej (odbiorca HHL).
- Usuwasz tekst „system nie liczy VAT”.
- Po terminie płatności → ryzyko `INVOICE_OVERDUE` dla HHL, raz na fakturę (dzwonek i e-mail według macierzy).
- Test „co do grosza” na TEST; transport bez CMR niedostępny w kreatorze; po rejestracji „Zafakturowano” samo.

### A5 · Rejs w awizacji → statusy „Prom” i „Port SE” same (B8, C8)
- Okno Awizacja zapisuje `sailing_id`: wybór rejsu i armatora z `sailings` do Szwecji według daty. Wymagany do „Gotowy” przy trasie promowej (A9).
- `promote_ferry_departures` dla obu przepraw (Gdańsk–Nynäshamn i Gdynia–Karlskrona). Statusy portów według `geofences.route`.
- `compute_load_eta`:
  - `PORT_IN` według trasy rejsu;
  - jeden zestaw kluczy `eta_basis` zgodny z `etaDetail.ts` (`ferry_eta_at`, `wait_ais`);
  - `READY_TO_INVOICE` i `INVOICED` jak `DELIVERED`.
- Test: rejs Stena → „Prom” i ETA do Karlskrony; rejs Polferries → „Prom” i ETA do Nynäshamn; dziś `sailing_id` 0/94.

### B4 · `visible_to` na serwerze (Cz1–Cz3, Cz25)
- Zapis `visible_to` przy wiadomości czatu i dokumencie oraz sprawdzenie w RLS i w odbiorcach powiadomień.
- Rozmowa „tylko HHL i SCX” nigdy nie trafia do KSH: ani w czacie, ani w „Przeczytali”, dzwonku, e-mailu, telefonie czy eksporcie.
- Test `security`: KSH czyta czat transportu → bez wiadomości „tylko HHL i SCX”; macierz z włączonym KSH → 0 powiadomień KSH dla tych wiadomości.

### B5 · Podgląd (W38 — przeniesione z P6)
- Według D-20261015-0330-01 pkt 6:
  - `impersonation_state.read_only`;
  - start na pierwszym aktywnym koncie KSH Użytkownik / SCX Dyspozytor;
  - `assert_not_preview()` w każdej funkcji zapisu i w `guard_*`;
  - dziennik start i koniec.
- Przy impersonacji Historia zapisuje „<admin> (HHL) jako <osoba>”.
- Test `e9-role`: „Podgląd KSH: zapis → odmowa”; HHL widzi to, co KSH — bez numerów, kosztu i marży.

### B7 · Nagłówki
- `Permissions-Policy`: `geolocation=(self)` (dziś `geolocation=()` blokuje aplikację kierowcy). Uzasadnienie w `SEC_OWASP_ASVS_L2.md`.
- Komunikat `POSITION_SHARE_DENIED` rozróżnia odmowę od braku API.
- CSP (Report-Only): `frame-src 'self' blob: https://*.supabase.co` (podgląd PDF z Storage). Włączenie wymuszenia — W8.
- Test: Playwright z nagłówkiem — kierowca udostępnia pozycję.

### B8 · Stare nieprzeczytane (7A)
- `notifications` `IN_APP`, nieprzeczytane, starsze niż 7 dni → przeczytane.
- Kopia identyfikatorów w `audit_log` (`action = 'AUDYT17_MARK_READ'`); liczby przed i po w `POSTEP.md`.

### B9 · Bez EN/SV w bazie (8A) — + D-20261017-0915-01 §3 pkt 1
- `translation_queue`, `translation_memory`, `deepl_usage`, a także funkcje, crony i wywołania DeepL z nich korzystające: migracja z kopią (liczba wierszy i zrzut do `audit_log`), potem `drop`.
- Aktualizacja `_shared/backup/core.ts`, `gate-suites.mjs` i `advisor-exceptions.txt`.
- Klucz DeepL w Secrets usunie właściciel po Twoim sygnale „B9 — klucz DeepL do usunięcia”.
- Jeśli `user_preferences` / `app_users` ma pole języka: zostaje `pl` dla wszystkich, a pole usuwasz z kopią.
- **W tym samym commicie (0915 §3 pkt 1 — jedyny wyjątek od F1 w B9):**
  - usuwasz **kafelek DeepL w Stanie systemu** (`SystemStatusPanel.tsx`, `deepl_usage_view`) i klucze `b6_sys_deepl`, `b6_sys_deepl_d`, `pl_deepl_warn`, `pl_deepl_full`, `pl_show_original`, `rk_deepl_usage` — żeby panel nie wołał usuniętej funkcji;
  - przy usuwaniu kolumny języka zmieniasz też `select` w `supabaseProvider.ts` (`loadPreferences`: `display_currency,locale,theme`) i `prefs.save`.
  - Test: Stan systemu bez kafelka DeepL i bez błędu w konsoli; konto z zapisanym „en” widzi panel po polsku.

### A6 · Plik KSH = Harmonogram (E38, L31, C23 — przeniesione z P7; W13: sekrety są)
1. **Import (ręczny i automatyczny na tym samym rdzeniu):**
   - jedno mapowanie 21 kolumn (`importColumnMap.ts`, `importMapping.ts`, `scheduleParse.ts`, `import_schedule`):
     - dodajesz `carrier`, `tractorPlate`, `trailerPlate`, `scxOrderNo` (HHL-Scan), `hhlOrderNo` (HHL-KSH), `comment`, `loadDay`, `delivDay`;
     - `lp` pomijasz, `orderNo` usuwasz, `assemblySeq` jest opcjonalne;
   - filtr przewoźnika HH / HHL;
   - puste wiersze pominięte i policzone; „...” i „-” = puste; „A / B” → pola PL / SE.
2. **Nic nie pada na datach (L31):** zamiast `raise exception` wiersz wchodzi, a gdy dostawa < załadunek, = załadunek albo > 14 dni → sprawa „Daty KSH do sprawdzenia” dla HHL i KSH. Dotyczy np. KR-03.
3. **Zasoby i numery z pliku** zapisane w bazie. Komentarz „Wcześniej to był SG-…” → ten sam transport, nowy kod, `renumbered_from`, „było → jest” w Historii.
4. **Synchronizacja SharePoint — odczyt** (funkcja Edge `ksh-sharepoint-sync`, `pg_cron` co 5 min):
   - tabela stanu `ksh_sync_state`, wiersz w Stanie systemu;
   - `SOURCE_DOWN` po 30 min; ostrzeżenie 30 dni przed wygaśnięciem sekretu;
   - „Transport zniknął z pliku” → sprawa HHL „Anuluj / Zostaw” (nic nie znika samo);
   - zapis WT → plik zostaje wyłączony, aż przyjdzie plik testowy od IT KSH (P7).
5. Test:
   - plik z 08.10 na TEST z danymi zmyślonymi (G-17) → 95 HH, 43 NTG i 15 pustych policzone, 0 błędów, KR-03 ze sprawą;
   - próba z ROLLBACK na produkcji w oknie wdrożenia (jak R-1 w P7);
   - linia „zsynchronizowano …” w Harmonogramie; zmiana w pliku → „było → jest” w dzwonku.

### C4–C13 bez zmian zakresu
Zostają jak w planie, po A6.
- C11 = hasło min. 12 znaków **z literami i cyframi** (`passwordOk` dziś sprawdza tylko długość). Test `auth-password.test.ts`.

Także (D-20261017-0730-01 §4, nie wygląd):
- w bazie wiersz `user_preferences` z walutą `EUR` przy pierwszym logowaniu (dziś 10 kont bez wpisu). Test: konto bez wpisu widzi EUR;
- `npm run lint:css` w CI — do `unit.yml` albo nowego `quality.yml` (P11 pkt 3), od razu przy B-pozycjach.

### P4-u · Uzupełnienie P4 — DO ZROBIENIA (po C13, przed P3-d; D-20261017-0730-01)
P4 jest na produkcji **częściowo**. Robisz brakujące punkty, każdy z testem z odbioru P4.
1. **E15 ETA:**
   - odpoczynek: `h4_driver_state_from_gps` nie zeruje postoju przy przerwie; odpoczynek = start postoju + 11 h (9 h skrócony); `last_rest_end` z GPS;
   - przeliczanie co 5 min także bez nowej pozycji (`tower-eta-refresh`, `refresh_load_eta_window()`), po zmianie okna dostawy i po pozycji AIS statku;
   - „czeka przed placem / przed Śremem” (`segment = 'WAIT_SITE'`, `causes.wait_since`);
   - geometria tras z `here_road_geometry` w `corridor_polylines` (SE-NYN, SE-KAA, PL-GDN, PL-GDY + dojazd do placu) → 0 fałszywych zjazdów z trasy;
   - **kalibracja po 5 dostawach** (3A, z dawnej „Rezerwy”): wygląd — `wyglad/W-eta` (Opcje › Kalibracja ETA); dane — D-20261017-1100-01 §3 (pkt 1–9): ETA zapamiętane przed przyjazdem i błąd w 3 punktach (24 h / 6 h / 1 h; nie z ETA w chwili dostawy); wjazd na plac z GPS (strefa SITE); czasy odcinków według kodów `eta_segment_params`; `exclude_reason` zdaniem dla człowieka (także dwa błędne pomiary SG-03); propozycja w `eta_calibration_versions` (n ≥ 5, odchylenie > 10 %, mediana, rozrzut, błąd przed i po); zatwierdzenie `apply_eta_calibration_version`; odczyt `etaCalibrationOf` / `etaCalibrationApproveOf` (`src/lib/etaCalibSource.ts`); testy SQL i e2e na TEST (G-09); teksty i układ ekranu zostają (F1); widok po podłączeniu sprawdza koordynator;
   - test SG-03: brak skoku > 1 h, błąd przy wyjeździe ≤ 30 min.
2. **ETA-MARK (D-101, 05.10 — nie było w planie):** znaczniki „w oknie / przed terminem / po terminie / przyjazd nocą 22–06” z danych ETA i okna dostawy (pole dla widoku; **wygląd: `wyglad/W-eta`**; dane — znaczniki z ETA i okna (jest)). Serwer: „przyjazd nocą” 22:00–06:00 w e-mailu i SMS o ETA (D-20261017-1100-01 §2).
3. **Format ETA (D-071):** „X d Y h Z min” powyżej 24 h, „Y h Z min” poniżej — w tekstach z serwera. **Widok: `wyglad/W-eta`**; serwer — `fmt_eta_duration(min)` zgodna z `etaDuration` (e-maile E43, SMS E42, tytuły spraw ETA_BREACH, powiadomienia). Test: 95 → „1 h 35 min”, 1 707 → „1 d 4 h 27 min”, 1 440 → „1 d” (D-20261017-1100-01 §2).
4. **E44 RIO pkt 2–8** w całości według PLAN P4: regulamin RIO najpierw (STOP §1 pkt 12.6, jeśli zakaz), adapter, cron `tower-rio-links`, zapis `SUBCONTRACTOR_LINK`, błędy i sprawy.
5. **E27 L17** — jeśli nie weszło w A1.
6. **`delayed` / `delay_minutes` (D-20261017-0930-01 §3):** serwer ustawia je zgodnie z ETA wobec okna dostawy (jak widok: „po oknie” tylko gdy ETA jest za oknem; opóźniony o 4 h, ale przed oknem — bez „po oknie”). Test z odbioru P4-u.

### P5 · Pieniądze i dokumenty — DO ZROBIENIA
- **D1** — **zrobione w Naprawach audytu 17.10 (A7)** (D-20261015-0300-01 D; doprecyzowanie D-20261016-0200-01 Z1): wymiary zestawu, pilot i rodzaj zezwolenia z tabeli właściciela (`WYMIARY_PILOT_ZEZWOLENIA.md`) — **same**, dla każdego transportu i przy każdym imporcie; nie ma stanu „czeka na wymiary”; D-83, B-3a, ZEZW-13 **zamknięte 16.10.2026** (dane z tabeli 07.10); D-21 zastąpione przez E31 i L6. Odbiór Z1 pkt 8 (TEST: 94 transporty vs tabela).
- **D2** — **zrobione w Naprawach audytu 17.10 (A7)** (D-20261016-0200-01 Z2; W44 potwierdzone 17.10, 07:20): polisa HHL PZU `1106707356` i zezwolenie GDDKiA `13/GD/2026` — wpis jednorazowy skryptem z plików w `D:\Watch Tower\dane\` (kopia R2, najpierw TEST); podpinają się same (E31 / G-21). Brak plików → W44; P5 idzie dalej („P5 — uzupełnienie W44”). Odbiór Z2 pkt 6.
- **E31** dokumenty, zezwolenia, polisy — **CMR / „Wgraj CMR” zrobione w Naprawach audytu 17.10 (A3)**:
  - CMR tylko z rozładunku, usunięcie wymogu CMR z załadunku i jego alarmów;
  - „Firma” podpięte samo, „Trasa” (KR) ręcznie;
  - polisy: KSH widzi tylko polisę HHL, SCX tylko swoją, HHL obie; nazwa polisy HHL „OC przewoźnika — PZU”;
  - termin CMR z podpisem odbiorcy (L26); przypomnienie o polisie HHL (L27);
  - **polisy SCX i HHL dodawane raz** — podpinają się same do dokumentów każdego transportu, przy którym polisa jest ważna w dniu transportu (E31; polisa SCX od zatwierdzenia przez HHL); bez wgrywania polisy przy pojedynczym transporcie (decyzja 09.10 13:09 pkt 4, G-21, D-20261009-1309-01 R7).
  - **S4 pkt 7 / pkt 3.1 (D-20261016-2130-01):** rodzaj „Inne” (`OTHER`). `documentFromRow`: `DOC_CAT.OTHER = 'OTHER'` (pliki `OTHER` z bazy nie są pomijane). `attachDocumentFile` i `addStoredDocument`: rodzaj `OTHER` — wiele plików, bez wersji i bez `supersedes` (jak `LASHING_PHOTOS`). Baza: wgrywa HHL i SCX przewoźnika transportu; KSH — odmowa; `visible_to` jak inne dokumenty transportu; Storage jak dziś (PDF i zdjęcia). `DOC_CAT_TO_DB.OTHER` jest w PR #274, więc odczyt wymagań (`docRequirementsServer`, `FROM_DB`) przyjmie wiersz `OTHER` z `doc_requirements`. Domyślnie takiego wiersza nie ma — „Inne” nie jest wymaganym dokumentem. Na końcu `otherDocsOn()` zwraca `true` także w produkcji — zmieniasz tylko ten warunek. Przycisk ma już warunek Podglądu (W38): w Podglądzie go nie ma. Test: SCX dodaje 2 pliki „Inne” do jednego transportu → oba w panelu, na stronie Dokumenty (filtr „Inne”) i w ZIP; KSH: brak przycisku i odmowa zapisu w bazie; Podgląd SCX (W38): brak przycisku, zapis → odmowa; zezwolenia i CMR nadal z wersją.
- **E33** ceny i dopłaty:
  - **system liczy, nie wprowadza** (decyzja 09.10 13:09 pkt 5, G-22, D-20261009-1309-01 R8): podpowiedź po stronie HHL (część przychodowa) i SCX (część kosztowa) w oknie „Dopłata” z przyciskami „Dodaj” i „Nie dodaję”; dopłata dodana przez SCX → „czeka na HHL” → HHL „Akceptuję” / „Odrzucam”; dopłata dodana przez HHL → „czeka na KSH” → akceptuje KSH; do ceny trafia tylko dopłata dodana i zaakceptowana (pozycje „Do zrobienia” tych podpowiedzi — P6);
  - postój 750 EUR za dobę albo 75 EUR za godzinę (wolne: 6 h na załadunku, 4 h na rozładunku);
  - anulowanie: % frachtu bez opłaty paliwowej, 2 dni przed załadunkiem = 25 %;
  - Kratownice bez daty = stawka dla 1 auta.
- **E3, E3b, E39** opłata paliwowa: źródła, godziny czasu polskiego (E3-2), wpis Orlen z 06.10 (E3-4); KSH i SCX widzą to samo co HHL. **5B (D-20261017-0730-01):** KSH i SCX widzą „Pieniądze › Opłata paliwowa” **tylko do odczytu**; Ty: test, że KSH i SCX nie zapiszą nic w tej części (odmowa w bazie). Demo wyrównuje koordynator.
- **E16** Finanse:
  - marża, **próg 4 %** (wartość startowa), kurs NBP i „kurs bieżący”;
  - waluta w bazie; próg w „Cennik i opłaty” (E12-2);
  - sprawdzić regułę koloru marży (E16 „jedna marża wszędzie”): w tabeli „Marża według typu” dodatnia marża (np. 15,3 %) ma klasę `neg` i jest czerwona (D-20261013-1815-01, do planu bez działania w 1815-01).
  - **Kurs bieżący w produkcji (D-20261017-0930-01 §3 / sekcja 02 N8):** z ostatniej tabeli `fx_rates` opublikowanej do dziś włącznie — nigdy z późniejszej; także dla transportu spóźnionego bez rozładunku (ta sama zasada co `fxForDate(…, unloaded)` w widoku). Test: transport przed rozładunkiem → tabela z dziś albo wcześniejsza, nigdy późniejsza.
  - **Stary model faktur demo (`invoices`, bez widoku):** usuwasz przy przejściu pieniędzy na `bills` (D-20261017-0930-01 §3).
- **E4** faktury — **zrobione w Naprawach audytu 17.10 (A4)**: zakładki według firmy, VAT 23 %, akceptacja, kwoty „co do grosza” (E4-3), spóźniony CMR (E4-1).
- **E4b** faktoring: 1 % netto, wypłata 48 h kalendarzowych po akceptacji, ekran „Faktoring” w grupie „Pieniądze” (E4b-1, E4b-2).
- **E40** paczka tygodnia:
  - adresy startowe: HHL `ksiegowosc@hhlogistics.pl`, KSH `faktury@ksh.pl`;
  - wysyłka dopiero po akceptacji; pierwsza wysyłka na produkcji — właściciel (L47).
- **Testy do przepisania:**
  - `etap4-ui.spec.ts` l.144–308 (M6 VAT, M8, M11); `d-eur-t.spec.ts` l.213; `etap6-ui.spec.ts` (O4 → G-08); `etap5-ui.spec.ts` l.88–90;
  - `doc-requirements.test.ts` l.17–18;
  - `money*`, `invoices3`, `invoice-*`, `payment-reminders`, `b32-insurance-cover`, `i2k-doc-week`, `paliwo-auto-b`, `i31-sefs`, `i30-*`, `b4b-cmr-only`;
  - zestawy `money`, `insurance`, `storage`, `baf`, `i30`, `i31`.
- **Ekrany — wygląd:** `wyglad/P5` (PR #201; Finanse E16/E39 + paczka E40, Faktury E4/E4b, Dokumenty E31, Opcje › Faktoring, Opcje › Zezwolenia i dokumenty, panel › „Ceny”/„Dokumenty”/okno „Dopłata” E33); `wyglad/W-dane` (PR #274; „Inne pliki” z „+ Dodaj”, E31 pkt 5 — D-20261016-2130-01). Dane pod wygląd: `src/lib/p5Source.ts` według D-20261014-2005-01 S1–S5 (bez zmiany klas i tekstów wyglądu, F1); rodzaj `OTHER` i `otherDocsOn()` = true — pkt 3.1.

- **D-109 (P5 E16, D-20261017-0730-01):** przy EUR bez kursów; HHL widzi kursy zawsze; KSH widzi kurs przy PLN.
- **D-100 (P5):** parametr `DOC_RETENTION_CMR_POD_YEARS` → `DOC_RETENTION_CMR_YEARS` (POD nie istnieje), z kopią.
- **Odbiór:** sekcje „Test” E31, E33, E39, E16, E40; testy R7 i R8 z D-20261009-1309-01; faktura testowa na TEST zgodna z wyliczeniem co do grosza; KSH nie widzi kosztu ani marży, SCX nie widzi ceny KSH (test na TEST); test odbioru S1–S5 z D-20261014-2005-01; odbiór D1 (Z1 pkt 8) i D2 (Z2 pkt 6) z D-20261016-0200-01.

### P6 · Do zrobienia, ryzyka, panel i historia — DO ZROBIENIA
- **E7** „Do zrobienia”:
  - liczba przy dzwonku = „Do zrobienia” (`todoQueue`), E9 (D-20261014-0215-01 H3); pełna lista w `todoRisks()` (`src/lib/cockpitE9.ts`);
  - karta na transport, sprawy z firmą i osobą, przyciski;
  - filtry „Moje / Moja firma / Wszystkie”, jedna liczba (E7-2), samozamykanie;
  - „Sytuacja na trasie”; zakazy jako informacja; sprawy techniczne → Stan systemu (E7-3);
  - nazwy spraw (E7-4); kliknięcie rozwija kartę w miejscu;
  - Ryzyka: karta sprawy L14 — `DeliveredCheckCard` (D-20261014-1320-01 K2 pkt 3);
  - **podpowiedzi dopłat** (G-22, D-20261009-1309-01 R8): pozycja „Do zrobienia” dla HHL (część przychodowa) i dla SCX (część kosztowa) otwiera okno „Dopłata” z P5; „Nie dodaję” zamyka pozycję tej firmy z wpisem w Historii; dopłata dodana przez SCX → pozycja HHL „Akceptuję / Odrzucam”.
- **8.4 alternatywne przeprawy** w „Sytuacji na trasie” według `ROZSTRZYGNIECIA` E7-5 (D-45, L-9, FERRY-STATUS). Najpierw sprawdzasz, co z L-9 już działa (`RisksView`, `sailings`); brakującą część budujesz.
- **E6 (karta decyzji):** „Biorę tę sprawę”, „Oddaj”, „Przejmij” (E6-5), „Zadzwoń”.
- **E2 drogi PL z HERE** (decyzja 07.10, 12:23; D-20261015-0400-01):
  - zadanie `tower-road-pl` co 15 minut, jak `tower-road-se` — **dopiero po wdrożeniu C1** („Poprawki P2–P3 (audyt 15.10)”, zalew dzwonka); ok. 3 000 zapytań HERE Traffic w miesiącu, w darmowej puli;
  - `road-pl` tylko z HERE, bez KPD (E2-1); **D-214 (D-20261017-0730-01, KPD zamknięte 16.10):** usuwasz wywołania KPD z `road-pl` i `_shared/integrations`; stan źródła i próg w Stanie systemu jak dla dróg SE (E2-2, E23-2);
  - `roadPlOf()` w produkcji czyta otwarte sytuacje HERE z `risk_signals` (`kind = 'ROAD_PL'`, źródło `HERE_TRAFFIC_PL`), w tym samym kształcie co drogi SE; zakazy ruchu (`TIME_BAN:PL:…`) zostają osobno jako informacja (decyzja 07.10, 15:55);
  - kategoria drogowa, nie `OPS` (E2 „Kategoria”): `ROAD_PL` w `mappers.ts` jak `ROAD_SE`; filtry i liczby na stronie Ryzyka liczą drogi PL razem z drogami;
  - zasady E5 (13:21): sytuacja bez przypisanego transportu — tylko strona Ryzyka, bez dzwonka, e-maila i telefonu; przy transporcie — tylko sytuacje jeszcze przed pojazdem;
  - odbiór (E2 „Sprawdzenie”): po wdrożeniu w `integration_runs` przebiegi `road-pl` co 15 minut, licznik HERE Traffic rośnie, panel „Drogi PL” pokazuje dane albo „brak utrudnień”; test w zestawie `risks`: sytuacja PL bez transportu → 0 wpisów w dzwonku;
  - teksty i wygląd panelu bez zmian (koordynator). Gdy dane wymagają innego układu, wpis w `POSTEP.md` — poprawka w `wyglad/*`.
  - **Przy wdrożeniu:** przestaw `serverRuleOn('ROAD_PL_HERE')` na `true` (D-20261017-0800-01 §2 pkt 1). Test: dopisek pod mapą z „HERE (PL)” — bez „włączamy wkrótce”.
- **W38 Podgląd z prawdziwymi uprawnieniami** — **zrobione w Naprawach audytu 17.10 (B5)** (decyzja właściciela 15.10.2026, 03:12; D-20261015-0330-01; przeniesione z P6):
  - Podgląd = „Działaj jako” w trybie tylko do odczytu: `impersonation_state.read_only`; przełącznik „HHL · KSH · SCX” tylko HHL (Administrator i Operacje); start: pierwsze aktywne konto KSH Użytkownik / SCX Dyspozytor; HHL Operacje tylko `read_only`;
  - `current_app_*` = konto docelowe (RLS jak to konto); każdy zapis w `read_only` → odmowa `assert_not_preview()` („Podgląd — nic tu nie zapiszesz”);
  - „Wróć do HHL” kończy impersonację; po odświeżeniu Podgląd trwa; dziennik bezpieczeństwa start/koniec; stary przełącznik tylko ukrywający elementy znika;
  - testy: `e9-role` + „Podgląd KSH: odczyt jak KSH, zapis → odmowa”; P11 pkt 2: w Podglądzie KSH API bez numerów, kosztu i marży.
- **E17** panel transportu (Historia dopłat — wyzwalacz na `load_agreed_fees` buduje P5 z E33; P6 tylko wyświetla):
  - Status / Historia / Czat (Czat HHL–SCX; KSH pisze do wszystkich);
  - profil trasy ukryty; nazwy zdarzeń (E17-2);
  - zawężenie `events_insert` (E17-1, E19-1).
- **E17 Czat — dane** (D-20261016-0250-01; wiadomość właściciela 16.10, 02:39): Cz1 zapis wyboru odbiorców `visible_to` (serwer pilnuje: KSH zawsze do wszystkich, tylko dwie wartości); Cz2 odczyt `visible_to`; Cz3 powiadomienia bez KSH dla „tylko HHL i SCX”, bez autora; Cz4 odczyt tylko po otwarciu Czatu (bez 40 ostatnich, bez własnych, bez Podglądu; porządek starych odczytów z kopią); Cz5 `reads[]`: osoba (bez nazwiska — e-mail), kod firmy, godzina; Cz6 nowe wiadomości i odczyty przy otwartym Czacie ≤ 15 s bez przeładowania; Cz7 nieprzeczytane z bazy; Cz8 „moje” po osobie (`author_id`); Cz9 autor „Imię Nazwisko”; Cz10 `chatVisibilityOn()` i `chatReadsOn()` → `true` w tym samym wdrożeniu; Cz11 wygląd `wyglad/P6-d`; odbiór Cz12 (13 punktów); **Cz13–Cz24 (D-20261016-0310-01; wiadomość właściciela 16.10, 02:57):** Cz13 w C3; Cz14 (D-20261016-0330-01 pkt 3; zastępuje „SG-03 · Imię Nazwisko // firma” z 0310): dzwonek „<nazwa transportu według firmy> — Imię Nazwisko // pełna nazwa firmy”, treść w drugiej linii; telefon „SG-03 — Imię Nazwisko // HHL”, z pauzą zamiast „·”; Cz15 jedno powiadomienie na transport (3 ostatnie); Cz16 przyciski „Oznacz jako odczytane” i „Odpowiedz” (pole tekstu w powiadomieniu); Cz17 odczyt z powiadomienia bez otwierania aplikacji; Cz18 odpowiedź z powiadomienia, odbiorcy jak w wiadomości, błąd → Czat z tekstem; Cz19 dotknięcie otwiera zainstalowaną aplikację, nie Chrome (okno `standalone`, manifest `id` / `scope` / `launch_handler`, diagnoza S24); Cz20 token akcji HMAC 7 dni, `chat-push-action`, dziennik, limit; Cz21 bez powiadomienia przy otwartym Czacie; Cz22 porządek po odczytaniu; Cz23 wygląd `wyglad/P6-e`; odbiór Cz24 (12 punktów); **Cz25–Cz33 (D-20261016-0315-01; wiadomość właściciela 16.10, 03:06) — powiadomienia tylko do osób, które widzą wiadomość:** Cz26 powiadomienia tylko dla kont spełniających `msgs_read`; Cz27 drugi bezpiecznik w bazie na `notifications` + `CHAT_NOTIFY_BLOCKED`; Cz28 sprawdzenie przed wysyłką web push, grupa i licznik tylko z widocznych; Cz29 akcje z powiadomienia tylko dla widocznych, odpowiedź zachowuje odbiorców; Cz30 e-mail, e-mail zapasowy, podsumowanie dzienne, SMS — ta sama zasada, czat bez e-maila zapasowego i bez SMS; Cz31 Realtime, odczyty i licznik tylko z widocznych; Cz32 zdanie o ekranie blokady w Pomocy; Cz33 testy (14 punktów) zielone przed włączeniem wyboru odbiorców (Cz10). **Miejsca w kodzie — D-20261016-0330-01 pkt 1–6:** `chatReadView` i `reads[]` / `visibleTo`; wejście z powiadomienia (`sw.js` → `?zakladka=czat&odpowiedz=1` / `&tekst=`); `title` i `body` z `LOAD_CHAT_MESSAGE`; `Notification.chatOnly` w `notificationFromRow`; `chatBellAutoReadOn()` razem z Cz4.
- **E49** — wiatr w ETA, ostrzeżenia 20 / 25 m/s, zamknięty most lub droga: sprawa SCX „Objazd czy postój?”, śliskość lokalnie (D-20261016-0230-01 Z1–Z6); wygląd `wyglad/E49` (#240); dane podłączasz w P6 według Z1–Z4. Odbiór Z6 (10 punktów + Z3). Miejsca w kodzie i kształt danych — D-20261016-0305-01 pkt 1–5: `e49Source.ts` — `detourCasesOf`, `detourDecideOf`, `etaWxOf`; `DetourCase` i ryzyka; `eta_basis.causes.weather`; 8 progów wiatru i śliskości; po podłączeniu zapisu decyzji lokalny `appendEvent` w `TodoPanel.tsx` znika (wpis w PR).
  - **Przy wdrożeniu Z1:** przestaw `serverRuleOn('WIND_E49')` na `true`; **przy Z3:** `serverRuleOn('DETOUR_E49')` na `true` (D-20261017-0800-01 §2 pkt 1). Testy: teksty na produkcji bez „włączamy wkrótce” („Działa samo” › Cisza GPS… — wiatr / objazd).
- **E18 P16** usunięcie `route-profile` i `load_route_profiles` (0 wierszy) z listą kopii.
- **Testy do przepisania:**
  - matryca `ryzyka` (uchwyt `[data-panel="ferry"]` zostaje); `etap6-ui.spec.ts` l.29–33;
  - `notify-dedup`, `click-targets`, `risk-keys`, `l8-cockpit-tiles`, `decision-access`, `i2-facade`;
  - zestawy `risks`, `dec2`, `dec3`, `dec5`, `dec6`, `dec-auto`, `backup`.
- **Z D-20261015-0300-01 D (P6):** przydział „Biorę / Oddaj / Przejmij” dla każdej sprawy z zapisem; zezwolenie wygasające przed załadunkiem → Do zrobienia SCX; „Działaj jako” w `load_events`/`audit_log` (`real_actor` / `acting_as`); komunikaty spraw zamkniętych / innej firmy; status w panelu (plan, kamienie, źródło) — dane Twoje, wygląd `wyglad/P6-c`.
- **Ekrany — wygląd:** `wyglad/P6-a` (PR #205; Ryzyka E7 — „Do zrobienia” / karta sprawy E6 / „Sytuacja na trasie”; telefon z zakładkami); `wyglad/P6-b` (PR #207; panel transportu — Historia i Czat E17, Przegląd: profil trasy ukryty, piloci, prom i stan awizacji); `wyglad/P6-d` (Czat › „Przeczytali”: kto i kiedy — Cz11); `wyglad/P6-e` (#241; Cz23: odpowiedź z powiadomienia, wpis w dzwonku, Pomoc — razem z listą „Przeczytali”); `wyglad/P6-f` (#242 — „Ten telefon”, Cz23 pkt 4–5, Cz32); `wyglad/E49` (#240). Dane pod wygląd: `src/lib/p6Source.ts` według D-20261014-2145-01 T1–T6; `src/lib/p6bSource.ts` według D-20261014-2300-01 H1, H3, H4 i D-20261016-0250-01 Cz1–Cz12 (Czat — zamiast H2) — w P6 razem z E17 (bez zmiany klas i tekstów wyglądu, F1).
- **Odbiór:**
  - sekcja „Test” E17; testy z punktów E7 (G-02);
  - liczba „Do zrobienia” z reguł E7 na danych testowych; ta sama liczba w menu, Kokpicie i na dzwonku (E7-2);
  - pozycje dopłat według testu R8 (D-20261009-1309-01): postój 8 h 10 min → pozycja u HHL i u SCX; SCX „Dodaj” → pozycja HHL;
  - 8.4: odwołany rejs na jednej przeprawie → propozycja najbliższych rejsów drugiej; przy sztormie na obu → brak propozycji; brak rozkładów → „Brak danych” (test na TEST);
  - wszystko, co dziś zapisuje przeglądarka, działa po zawężeniu `events_insert` (test e2e);
  - test odbioru T1–T6 z D-20261014-2145-01;
  - test odbioru H1, H3, H4 z D-20261014-2300-01 i Cz12 z D-20261016-0250-01 i Cz24 z D-20261016-0310-01 i Cz33 z D-20261016-0315-01;
  - odbiór E49 Z6 (D-20261016-0230-01).

### P7 · Harmonogram, import pliku KSH, panel i Awizacja — DO ZROBIENIA
- **E38** import ręczny pliku SharePoint — **rdzeń importu i odczyt SharePoint zrobione w Naprawach audytu 17.10 (A6)**; w P7 zostaje reszta (m.in. zapis WT→plik po W13, R-1, Awizacja):
  - mapowanie 21 kolumn; filtr „Przewoźnik = HH”; „Standard” → sprawa;
  - KR-03 nie odrzucany, sprawa „Daty KSH do sprawdzenia” (L31);
  - aktualizacja po kodzie; zmiana z panelu KSH według E9-6 (do synchronizacji W13); daty i godziny zmienia i potwierdza tylko KSH i plik (G-20; prawa i ochrona w bazie — P3);
  - **zmiana dat lub godzin przy wgraniu pliku** (decyzja 09.10 13:09 pkt 1, G-18, D-20261009-1309-01 R4): porównanie 4 pól („Data załadunku”, „Godzina (załadunek)”, „Data dostawy na budowę”, „Godzina (rozładunek)”) → powiadomienie `PLAN_DATES_CHANGED` do HHL Administrator, HHL Operacje, SCX Dyspozytor, SCX Użytkownik, jedno na transport na wgranie, z „było → jest”, wpis w Historii; to samo przy zmianie KSH w Watch Tower; sprawy D-12 i L31, przesunięcie startu śledzenia (E27 pkt 1), E39, E16 i workflow E9 bez zmian;
  - Harmonogram domyślnie w układzie pliku (nazwy kolumn z makiety, L42); 8 kolumn jako „Widok skrócony”; wygląd `wyglad/P7-c`; dane D-20261016-1020-01 pkt 1–5.
  - Synchronizacja z SharePoint w obie strony i zapis do pliku — po dostępie od działu IT KSH (§5 W13, L41) jako pozycja „P7 — uzupełnienie W13”; w niej także zapis dat i godzin zmienionych przez KSH w Watch Tower do pliku (do 1 min), plik → Watch Tower co 5 min, komórki i konflikt według D-20261009-1309-01 R6 pkt 4–6 (G-20, W29, W31).
- **E30** Harmonogram: filtry E28 + tydzień; zmiana zestawu tylko w oknie Awizacja. Harmonogram — wygląd `wyglad/P7-c` (D-20261016-1020-01).
- **E20** pełny zakres poza paskiem górnym (pasek w P3): szerokości, przyklejone kolumny (E20-1, E20-2). Harmonogram — wygląd `wyglad/P7-c` (D-20261016-1020-01).
- **E32** panel i okno Awizacja (mapa Przeglądu w panelu — z P9 / E1; P7 jej nie zmienia):
  - SCX robi, Administrator HHL poprawia;
  - **piloci według D-20261009-1233-01** (decyzja 09.10 12:33, G-23, L29): wpisuje SCX w oknie Awizacja (HHL Administrator może poprawić; HHL Operacje i KSH bez zapisu); sekcja „Piloci” tylko przy „PL + SE” (KR, PL-B): pilot PL i pilot SE, pola tylko numer rejestracyjny oraz imię i nazwisko; przy „BRAK” piloci nie pojawiają się w transporcie w żadnej roli i na żadnym ekranie, a baza odrzuca zapis; kompletna awizacja z obydwoma pilotami; brak = pozycja „Do zrobienia” **SCX** w sprawie awizacji; zmiana symbolu po wpisaniu pilotów — W26;
  - **konwój KR** (decyzja 09.10 13:09, D-20261009-1309-01 R1): transporty KR z tą samą datą załadunku — piloci wpisani raz, obowiązują dla całego konwoju, zmiana przy jednym zmienia przy wszystkich, linia „Konwój …” w oknie Awizacja;
  - pole „Link śledzenia” z działaniem z E44 (P4) w nowym oknie Awizacja bez zmian (rozpoznanie RIO, test linku, ostrzeżenia, „RIO · … · ••••”, „Otwórz w RIO”);
  - kierowcy PL / SE (E6, dwa numery, przepięcie naczepy);
  - „Do zrobienia przy transporcie” = lista E7; kwoty z E16; dokumenty z E31.
- **E18 P12** zamknięcie 30 starych spraw zasobów (`RES:DRIVER`, `RES:VEHICLE`) po wyłączeniu starego mechanizmu.
- **R-1** pierwsze wgranie pliku KSH z 08.10 (od właściciela, poza repozytorium):
  - najpierw na TEST: plik z zamienionymi danymi osobowymi, raport według testu E38 pkt 6 (G-17 pkt 1);
  - w oknie wdrożenia P7: próba na produkcji w transakcji zakończonej ROLLBACK z prawdziwym plikiem i raportem „ile nowych, zmienionych, pominiętych, spraw” (G-17 pkt 2);
  - potem wgranie na produkcji (zmiana danych opisana w planie, z kopią).
- **Testy do przepisania:**
  - `etap4-ui.spec.ts` l.60–86, 355–382, 392–433; `aud03-ksh-panel.spec.ts` l.108–119; `visual-states.spec.ts` l.113–137;
  - `c-sep`, `historyActor`, `schedule-import*`, `import-mapping`, `i18-plan-dates`, `b8-imp`, `xlsx-export-roles`, `pdf-export`;
  - `stylesheet-mockup.test.ts` (`th.stick`, `td.stick`);
  - zestawy `import`, `aud03`;
  - z pomiaru 13.10 (D-20261013-1535-01 V6), zamyka P7 według E30 „Telefon” i E20-1 / E20-2: Harmonogram na telefonie — pierwsza karta ok. 820 px z 844 (25 elementów nad nią); przy 1440 px kolumna z kwotą i marżą zasłania „Kierowca” (HHL) i „Nr rej.” (KSH);
  - D-20261016-1020-01 pkt 6: `etap4-ui.spec.ts`, `aud03-ksh-panel.spec.ts` l. 108–119, `visual-states.spec.ts` — według nowego układu (`[data-sched-layout]`, `td[data-col]`, „Więcej ▾” zamiast osobnych przycisków, bez „Zmień ciągnik”); `src/lib/scheduleColumns.ts` nie jest już używany przez ekran (został tylko w `tests/order-numbers.test.ts`) — usuwasz go razem z tym testem albo przepisujesz test na `schedLayout.ts`.
- **Ekrany:** Harmonogram (oba układy), panel transportu, okno Awizacja, wgrywanie pliku.

- **D-072 (P7, eksport PDF Harmonogramu — D-20261017-0730-01):** kierowca (imię i nazwisko) z telefonem zamiast promu, z regułą E6 dla KSH.
- **Odbiór:** sekcje „Test” E38, E30, E20, E32; test odbioru D-20261009-1233-01; testy R1, R4 i R6 (bez części po W13) z D-20261009-1309-01; raport z TEST zgodny z testem E38 pkt 6 (plik z 08.10: 95 HH, 43 NTG, 15 pustych pominiętych, 0 błędów); raport próby z ROLLBACK na produkcji: 94 transporty z bazy + KR-03 nowy ze sprawą, różnice wyjaśnione.

### P8 · Komunikacja i automatyzacje — DO ZROBIENIA
- **E42** SMS:
  - 4 rodzaje A–D (treść A według L50), cisza nocna 20:00–06:00, raz na transport × miejsce × rodzaj × numer;
  - tryb testowy przez 3 transporty; odbiorcy 2 + 2 bez wyboru języka;
  - e-mail zastępczy, wpis w Historii.
  - Przełącznik „Wysyłka do odbiorców” włącza właściciel (§5).
  - **D-20261014-0700-01 J3 pkt 12:** przełącznik strefy SMS dla Operacji HHL — wyłączenie w UI (baza i tak odmawia `geofences_write` = HHL_ADMIN); E12 1A.
  - **N20 na serwerze (D-20261017-0915-01 §3 pkt 2):** `sms_render` z 3 języków do 1 (tylko PL, bez polskich znaków według E43). E-maile i powiadomienia z serwera — tylko PL.
- **E43** „Treści wiadomości”: tylko PL; edytor; 28 rodzajów (L53); link 24 h (L37). E-maile logowania według L54 (§5).
- **E35** Automatyzacje (D-20261016-0220-01; wygląd `wyglad/P8-d` #239): kreator z akcją SMS (L35); „Działa samo” według E35 pkt 1 i L13; **Z1** porządki START-1…7 (przeniesienie do E11 / usunięcie z historią); **Z2** dane — `rules`/`check`/`runs`/`history`/`zones` z silnika `workflows` (ONE-MECH), przebiegi i historia zdaniami; **Z3** zapis z powodem (`save`/`setEnabled`/`remove`), tylko Administrator HHL, Operacje HHL — podgląd bez zapisu; odbiór sekcja „Test” E35 + punkty z dopisku.
- **H-7** mapa w e-mailach i PDF (zlecenie HERE z 04.10; w starym planie „do decyzji koordynatora” — koordynator 09.10: P8). Najpierw stan (B-10 z 05.10: „PDF+mapa H-7”). Brakującą część budujesz przy treściach wiadomości (E43): mapa trasy transportu (droga i prom jak na Przeglądzie — E1, E45) jako obraz w e-mailu o transporcie i w PDF; HERE w limicie 100 USD/mies.
- **E34** strefy: edycja; po zmianie od razu sprawdzenie ostatniej pozycji transportów w oknie śledzenia, wpis „zmiana strefy”, statusy jak przy zwykłym wjeździe i wyjeździe, bez SMS (E34 pyt. 1 B, L33).
- Stare pozycje „SMS 6, 7, 10, 11” zamknięte (L51).
- **Testy do przepisania:** `b5-workflow-creator`, `workflow-map`, `l12-geofence`; zestawy `smsksh`, `workflows`, `l12`, `dec-auto`.
- **Ekrany:** Opcje › Powiadomienia (SMS przy miejscach, Treści wiadomości), Automatyzacje, Strefy.
- **Odbiór:** sekcje „Test” E42, E43, E35, E34; e-mail próbny o transporcie i PDF z mapą trasy (H-7) na TEST, wysłany tylko na adres właściciela (G-14); na TEST odtworzenie SG-03 daje SMS 11:45 B, 13:05 C, 06:00 C, 08:35 D i nic po 12:19 — na śladzie zmyślonym (G-17), a po zgodzie W25 także na prawdziwych pozycjach; tryb testowy wysyła tylko na numer właściciela.

### P9 · Mapy — DO ZROBIENIA
- **H-1 i H-3 — usunięcie** (D-20261016-0200-01 Z3): „Kontrola trasy” i „Przeszkody wzdłuż korytarza” usunięte na stałe (nie wracają); panel, warstwa map, Edge `route-check` / `corridor-obstacles`, puste tabele `route_checks` / `corridor_obstacles` / `corridor_fetches` (kopia 0 wierszy); zestawy `h1`/`h3` usunięte; zostają `corridor_polylines` i `corridor_conditions`. Odbiór Z3 pkt 7.
- **E45 (uzupełnienie E49 Z3 pkt 8) — pkt 3.2 (D-20261016-2130-01), razem z P6 E49 Z3:** linia objazdu na mapie po decyzji SCX „Jedziemy objazdem”. Przy liczeniu objazdu zapisujesz geometrię trasy HERE Routing (od zjazdu z trasy do powrotu, uproszczona do ok. 200 punktów, `[szer., dł.]`) przy sprawie. Dla każdej obowiązującej decyzji „objazd” serwer daje `{ loadId, line, via, addKm, addMin }`. Gałąź produkcyjna `detourLinesOf()` czyta to pole. Decyzja przestaje obowiązywać, gdy zamknięcie jest odwołane albo auto wróciło na trasę — linia znika. Test: „Jedziemy objazdem” → linia na Mapie, w Kokpicie i w Przeglądzie; „Stoimy” → bez linii; zamknięcie odwołane → linia znika; „Trasa” odznaczona → linia schowana. Wygląd linii jest w `wyglad/W-dane` (PR #274); do P9 produkcja zostaje `detourLinesOf()` = [].
- **E1** Kokpit i Mapa: kadr całej trasy (fitBounds), bez zapamiętywania przesunięcia; Przegląd: zoom 11 na pojeździe, co 60 s. Zrobione w wyglądzie — `wyglad/P9-d` (D-20261016-0635-01).
- **E29** Mapa: wygląd `wyglad/P9-c`; dane D-20261016-0615-01 pkt 1–4.
  - tabela = transporty w oknie śledzenia; filtry „Opóźnione”, „Brak GPS”, „Bez pozycji” (L22);
  - kafelek zmienia zakres; bez deklaracji częstotliwości (L20).
  - **pkt 3 — warstwa „Utrudnienia drogowe” z danych produkcji:** przy wdrożeniu przestaw `serverRuleOn('ROAD_SITUATIONS_MAP')` na `true` (D-20261017-0800-01 §2 pkt 1). Test: dopisek pod mapą z utrudnieniami — bez „włączamy wkrótce”.
- **E45** trasy:
  - promy z HERE — **pkt 3.3 (D-20261016-2130-01, L56):** najpierw sprawdzenie na TEST, czy HERE Routing zwraca odcinek promowy (`sections[].transport.mode = 'ferry'`) dla Gdańsk–Nynäshamn i Gdynia–Karlskrona. Jeśli tak — `map_display_state` dostaje `ferries: [{ leg: 'FERRY-GDN-NYN' | 'FERRY-GDY-KAA', points: [[szer., dł.], …] }]`, z tego samego odczytu co `roads`. Jeśli HERE nie ma odcinka promowego — wpis W w §5 (jak w L56) i zostają stałe tory. Element mapy ma `data-ferries` ze skrótem sprawdzenia, np. „FERRY-GDN-NYN: HERE · FERRY-GDY-KAA: tor — końce dalej niż 10 km od portów”. Wynik z TEST wpisujesz do `POSTEP.md`. Test: poprawny odcinek → rysowany zamiast toru; zła geometria → stały tor; jedna przeprawa z HERE → druga ze stałego toru. Bez kropek. Wygląd odczytu `ferries` jest w `wyglad/W-dane` (PR #274); bez danych zostaje stały tor;
  - checkbox „Trasa” chowa drogę i prom; statki AIS pod „Pojazdy”;
  - ostatni odcinek SE jak SG-03, z geometrią zapisaną w bazie (L57);
  - grupowanie aut na promie — wygląd `wyglad/P9-e`; dane D-20261016-0715-01 pkt 1–2;
  - **grupowanie aut w jednej lokalizacji** (decyzja 09.10 13:09 pkt 2, G-19, D-20261009-1309-01 R5): tak samo jak na promie, na Mapie i w Kokpicie; lokalizacja = strefa E34 (załadunek, port PL, port SE, plac), bez buforów; auta na promie grupuje rejs; poza strefami — W28; wygląd `wyglad/P9-e`; dane D-20261016-0715-01 pkt 1–2.
- **E24** (decyzja 07.10 17:46):
  - każdy adres `tower-hhl.pages.dev` → 301 na `tower.log-mar.pl` z tą samą ścieżką — plik przekierowań tylko w buildzie Cloudflare Pages (Vercel go nie dostaje);
  - rejestr: wpis „zapas `tower-hhl.pages.dev`” → „przekierowuje na tower.log-mar.pl (07.10)”; `PRZELACZENIE_HOSTINGU.md` zaczyna się od zdjęcia przekierowania;
  - procedura wdrożenia: `tower-hhl.pages.dev` → 301;
  - usunięcie pages.dev z Redirect URLs Supabase — właściciel (§5 W12);
  - komunikat zamiast szarej mapy (E24-1): wygląd `wyglad/P9-a`; zapis zgłoszenia dla HHL — D-20261016-0445-01 pkt 1–4.
- **Testy do przepisania:** migawki mapy i Kokpitu; `aud01-mapa`, `aud01e-*`, `map-declutter`, `b1-vehicle-markers`, `bmapa`; zestawy `bmapa`, `h1`, `h3`.
- **Ekrany — wygląd:** Kokpit (mapa), Mapa, Przegląd w panelu — `wyglad/P9-f`; dane D-20261016-0740-01 pkt 1–2. Linia objazdu i przeprawy z HERE — `wyglad/W-dane` (PR #274, D-20261016-2130-01); dane pkt 3.2 i 3.3 w P9.
- **Odbiór:** sekcje „Test” E29, E45, E24; test R5 z D-20261009-1309-01; zrzuty 1440 i 390 porównane z makietami E1, E29, E45; pkt 4 (test na TEST) D-20261016-0445-01; pkt 4 D-20261016-0715-01; pkt 4 D-20261016-0740-01; pkt 6 D-20261016-0615-01.

### P10a · Przeładowania, stan źródeł i błędy aplikacji — część bazy i funkcji — DO ZROBIENIA
Bez ekranów Opcji (te w P10b, po P3).
- **D-083 (D-20261017-0730-01):** sprawdzenie, że dane HERE są przechowywane najwyżej 30 dni (cron retencji). Wynik w `POSTEP.md`.
- **E22** przeładowania: pasek „Jest nowa wersja”, brak błędów „stara wersja”; kryterium „tydzień bez nowych błędów” liczone od wdrożenia P10a (E22-2). Wygląd `wyglad/P10a-a` (#244: pasek nowej wersji, „Na żywo · HH:MM”, komunikat zamiast pustej strony); dane D-20261016-0430-01 pkt 1–3.
- **E23 (baza i funkcje):** ekran `wyglad/P10b-c`; dane D-20261016-0845-01 pkt 1–6.
  - źródło „Wiatr — SMHI” (D-20261016-0230-01 Z5) + zdanie w Pomocy;
  - stan źródeł danych i progi (E23-1, E23-2);
  - alarm do Administratorów HHL (e-mail i push — decyzja 27 A), przypomnienie po 2 h, „Wróciło”; wysyłka tylko na konta HHL_ADMIN;
  - źródło RIO (E44 pkt 7, z P4) na liście źródeł: 3 błędy pod rząd → alarm „Źródło danych nie działa · RIO” e-mailem i push;
  - **E18 P14** klucz emtrack bez daty UTC i zamknięcie duplikatu;
  - **ferry-weather** (E23-4): przyczyna 8/24 przebiegów bez wyniku i odmów DMI z dziennika funkcji, opis w PR, poprawka według E23 pkt 2–4;
  - **AIS-SRC** (rejestr, stary plan: „zbudowane — pomiar 24 h nie zrobiony”): pomiar 24 h świeżości pozycji 5 promów (cel ≤ 5 min na mapie) z wynikiem w PR; odstępstwa jako źródło „Częściowo” według E23;
  - 16 spraw „Nieznany kod źródła drogowego” przeniesione do Stanu systemu (dane jednorazowe z kopią).
- **E47 (baza i funkcje):** grupowanie błędów po treści (nie po buildzie), bez przeglądarek testowych, reguła alarmu (`UZGODNIENIE_08_10.md` pkt 5), raport tygodniowy. Ekran `wyglad/P10b-c`; dane D-20261016-0845-01 pkt 1–6.
- **Testy do przepisania:** zestaw `watchdog`; testy przeładowań (`routes`, `session-year` — jeśli dotknięte).
- **Odbiór:** sekcje „Test” E22 (bez punktu „tydzień” — E22-2) i E23 (część bazy); ferry-weather: każdy przebieg z doby ma wynik w `integration_runs` albo stan „Częściowo” z przyczyną; E47 na TEST: wymuszony błąd → wpis i alarm ≤ 5 min; ten sam błąd 10 razy = 1 grupa; zero alarmów z przeglądarek testowych; pkt 4 D-20261016-0430-01 (E22 pkt 5 i blok e2e `wyglad/P10a-a`).

### P10b · Konto, pomoc, ekrany Stanu systemu — DO ZROBIENIA
- **E37 (reszta; pasek górny w P3):**
  - zaproszenie czyta treść z „Treści wiadomości” (E43, klucz zaproszenia), a gdy jej nie ma — domyślną z E37; P8 dodaje ją do E43 (kolejność scalenia dowolna);
  - logowanie: komunikaty, „Nie pamiętam hasła”, link 24 h;
  - zaproszenia: lista stanów, „Wyślij ponownie”, „Cofnij”;
  - Pomoc „Jak pracuję” w 5 wersjach — treści i test odbioru z dopisku `D-20261009-0015-01` (L38; z poprawkami z 09.10 naniesionymi w tym pliku: piloci — D-20261009-1233-01, daty, grupowanie, polisy, dopłaty, konwój — D-20261009-1309-01) — i „Co nowego”; wygląd i treść `wyglad/P10b-b`; dane D-20261016-0810-01 pkt 1–2;
  - komunikat HHL tylko jako baner; 2FA dobrowolne;
  - Komunikat HHL: „Zamknij” dla osoby, w ciągu minuty; logowanie: „Link wygasł” z „Wyślij nowy link” — wygląd `wyglad/P10b-a`, dane D-20261016-0530-01 pkt 1–4;
  - pierwsze wejście (E37 pkt 9) — wygląd `wyglad/P10b-d`; dane D-20261016-0930-01 pkt 1–4.
- **E23 i E47 (ekrany):** Opcje › System › Stan systemu (źródła danych, „Sprawdź teraz”, kafelek Bezpieczeństwo z E19) i „Błędy aplikacji” według makiet E23 i E46. Wygląd `wyglad/P10b-c`; włączenie na produkcji po pkt 1 D-20261016-0845-01.
- **Testy do przepisania:** `i4-guide`, `auth-password`, `resp14-phone.spec.ts`, `e2e-core.spec.ts`; zestawy `dec6`, `adm10`.
- **Ekrany:** logowanie, Pomoc, Opcje › Ludzie i dostęp, Opcje › System.
- **Odbiór:** sekcja „Test” E37; „Test odbioru (w P10b)” z dopisku `D-20261009-0015-01`; ekrany E23 i E47 zgodne z makietami; zrzuty 1440 i 390; testy z pkt 1–4 D-20261016-0530-01; pkt 4 D-20261016-0810-01; pkt 6 D-20261016-0930-01.

### P11 · Jakość, bezpieczeństwo, wydanie (koniec Dnia 4 albo data z W17) — DO ZROBIENIA
1. **E46** wydajność (`UZGODNIENIE` pkt 5): wyniki do `perfResults()` — D-20261016-0845-01 pkt 5.
   - Lighthouse: LCP ≤ 2,5 s, CLS ≤ 0,1, TBT ≤ 300 ms na telefonie;
   - baza: p95 ≤ 500 ms przy 420 transportach na TEST;
   - 20 sesji przez 10 min.
2. **E48** OWASP:
   - naprawa P3-SW, P3-ZIP (SSRF), P3-AND;
   - ZAP aktywny na TEST i pasywny na produkcji (0 High);
   - ASVS L2 ponownie;
   - testy ról przez API dla 5 kont jako zestaw bramy bazy;
   - doradca Supabase „security” bez błędów;
   - CSP enforce po akceptacji listy źródeł (§5).
3. **Bramy na stałe:**
   - strażnik tekstów E21 blokujący na wszystkich ekranach (0 trafień, E21 pkt 8);
   - axe kontrast E10;
   - szerokości 1280 / 1366 / 1440 / 1920 bez nakładania kolumn (E20, brama wizualna robi zrzuty 4 szerokości);
   - elementy poza ekranem E8.
4. **Pozycje produkcyjne spoza audytu:**
   - PR2 kopie do R2 (sprawdzić, czy cron działa; włączyć);
   - PR1 podtrzymanie;
   - retencja D-3 (CMR 3 lata, PDF faktur 5 lat, bez POD i zdjęć);
   - AUD-01d (klucz przeglądarkowy HERE — §5); AUD-01e — wdrożone 06.10 (PR #144), tylko status w `POSTEP.md`;
   - I-0b; 17.13 (współrzędne terminali);
   - **PR7** kompresja i archiwizacja plików, gdy zajętość miejsca na pliki przekroczy 70 % (stary plan: „do decyzji koordynatora”, czekało na R2) — po PR2, archiwum w R2;
   - **P2-TILES** (gałąź `feat/p2-tiles-06-10`, commit `3deb252`, bez scalenia): kafelki zapisane w repozytorium dla testów wizualnych; rebase, brama, scalenie — **przed** regeneracją 280 ujęć (pkt 6); na produkcji bez zmian;
   - **B-VERIFY-17.3**: jeden kanon wyglądu poza audytem = `design/claude-v2.0/`. Kopie z `docs/watch-tower/` (`claude-v2.0/`, `claude-makieta.html`, `claude-visual-ref/`) przeniósł już P0a do archiwum. Zostaje `public/claude-makieta.html` (w produkcji 404) — usunąć albo oznaczyć jako archiwum; najpierw `grep`, czy używa go test, brama wizualna, build (`build/prodStrip.ts`) albo `watch-tower-makieta.vercel.app`; używanego nie usuwasz, tylko oznaczasz;
   - **KOPIA-D**: kopia `usuniete_standard_2026-10-03` z R2 do `D:\Watch Tower\dane\` (poza repozytorium) i suma SHA-256 zgodna z kopią w R2. Brak dostępu do R2 z komputera = wpis w §5.
5. **Pełna brama TEST** na commicie wydania (niezależnie od bram niedzielnych, §3).
6. **Regeneracja 280 ujęć** w środowisku bramy wizualnej (cron właściciela), tag `baseline-audyt-<data P11, RRRR-MM-DD>` — §5 W11.
   - **Ujęcia z TEST (D-20261017-0930-01 §2 pkt 6 / §3):** logowanie, zaproszenie, „Nie pamiętam hasła”, „Link wygasł”, 2FA (ustawienie i kod), pasek „Działasz jako”, pasek Podglądu, komunikat HHL, „Jest nowa wersja”. Zapis w `docs/handover/odbior/P11/`. (Ekrany AuthGate nie idą do demo — odbiór na TEST z kontem.)
7. **Końcowy przegląd zgodności całej aplikacji** (D-20261013-1550-01 Z12), przed R-4 i przed `release-1.0`:
   - zrzuty każdego miejsca z „Mapy aplikacji”: dla każdego rodzaju konta, który je widzi; przy 1440 i 390 px; w trybie demo; obok obrazu z `raport/img/` albo wzoru z Z10;
   - zapis w `docs/handover/odbior/P11-zgodnosc/` z tabelą: miejsce | konto | szerokość | obraz | zgodne / różnica | decyzja, która uzasadnia różnicę;
   - koordynator sprawdza całość; właściciel ogląda aplikację na swoim telefonie i komputerze;
   - `release-1.0` tylko przy 0 różnic bez decyzji.
8. **R-4** raport końcowy (co zbudowane, liczby testów, co czeka na właściciela — §5, co odłożył właściciel — §6 część 3), tag `release-1.0`.
9. **R-3** pierwszy prawdziwy transport od importu do faktury — z właścicielem, po wpisaniu użytkowników (§5). W R-3 także 11.3 (testy ścieżek użytkownika; stary plan: „do decyzji koordynatora → R-3”): przejście ścieżki każdej z 5 ról według workflow E9, wynik w R-4.

## §5. Czeka na właściciela (wykonawca wpisuje i idzie dalej)
| Nr | Co | Kiedy potrzebne | Stan |
|---|---|---|---|
| W1 | Ustawienia logowania Supabase: ochrona przed wyciekniętymi hasłami, minimum 12 znaków, „litery i cyfry” — instrukcja: `docs/handover/INSTRUKCJA_W1_USTAWIENIA_LOGOWANIA.md` (D-20261014-0015-01 R4) | po P3 | **zrobione 17.10.2026, 07:28** (dowód: B2 — zgłoszenie `auth_leaked_password_protection` ma zniknąć; D-20261017-0730-01) |
| W2 | Użytkownicy (imię, nazwisko, telefon) i numery SMS Śrem / Boden — wpisuje właściciel w programie | po P3 i P8 | czeka |
| W3 | SG-01: potwierdzenie daty rozładunku w oknie „Zmień status” | po P4 | czeka |
| W4 | SCX wgrywa zezwolenie 13/GD/2026; HHL wgrywa polisę PZU 1106707356 | po P5 | **ZAMKNIĘTE 16.10.2026, 01:13**: polisę HHL i zezwolenie 13/GD/2026 wpisuje wykonawca w P5 D2 z plików właściciela (D-20261016-0200-01 Z2) |
| W5 | Plik KSH z 08.10 (`SCRAP_transporty_2026.09.23_REV.01_3.xlsx`, wiadomość właściciela 08.10 12:14) do wgrania (R-1) — przekazanie wykonawcy poza repozytorium, w `D:\Watch Tower\dane\`. Inny (nowszy) plik tylko dopiskiem koordynatora | przed P7 | czeka |
| W6 | Włączenie wysyłki: SMS do odbiorców (po 3 transportach w trybie testowym), e-maile w „Kto co dostaje”, pierwsza paczka tygodnia na adresy księgowości (alarmy E23 i E47 do Administratorów HHL działają od razu — decyzja 27 A) | po P8 / P5 | czeka |
| W7 | Klucz Management API dla „Send Email Hook” albo wklejenie treści e-maili logowania w panelu Supabase (L54) | po P8 | czeka |
| W8 | Akceptacja listy źródeł CSP i 12 wyników ASVS „częściowo” (E48) | P11 | czeka |
| W9 | Klucz przeglądarkowy HERE ograniczony do domeny (AUD-01d) | P11 | **zamknięte 06.10** (D-20261012-0105-01 R9); P11 sprawdza (Referer `tower.log-mar.pl` → 200; obcy → odmowa) |
| W10 | Konto testowe Claude (interia.pl) — usunięcie po wszystkich pracach (E18 P1) | po R-4 | czeka |
| W11 | Regeneracja 280 ujęć i tag `baseline-audyt-<data P11>` na maszynie z nocną bramą wizualną (cron właściciela, `scripts/visual/gate.sh`) — wykonawca przygotowuje polecenie w P11 | P11 | czeka |
| W12 | Usunięcie `tower-hhl.pages.dev` z Redirect URLs w panelu Supabase (E24 pkt 3) | po P9 | czeka — właściciel po wdrożeniu przekierowania 301 w P9 (E24); gdy 301 działa → w raporcie „W12 TERAZ” (D-20261017-0730-01) |
| W13 | Dostęp do pliku harmonogramu KSH na SharePoint od działu IT KSH (decyzja 12:50 „czekamy”) — potem synchronizacja w obie strony według E38 (L41) i według decyzji 09.10 13:09: daty i godziny zmienione przez KSH w Watch Tower trafiają do pliku (G-20) | gdy będzie | czeka |
| W14 | Linki śledzenia od podwykonawców SCX (E44, L55) | — | **ZAMKNIĘTE 09.10.2026**: link RIO jest (10:34), dane automatycznie (10:54), zgody na piśmie i nowy link na każdy przejazd (11:19) — E44 w P4 (G-24) |
| W15 | Oficjalne API emtrack (TELM-2, II-4, D-TELM-ETA) i API Stena (D-LATER); do tego czasu odczyt jak dziś (`emtrack-web`, źródło STENA) | gdy będzie | czeka |
| W16 | Kody opóźnień uzgodnione z SCX (II-2) — po spotkaniu z SCX | gdy będą | czeka |
| W17 | Data wydania `release-1.0` | przed P11 | **zamknięte 15.10.2026, 03:12 — zastąpione przez W35, potem 2C (28.10, 20:00)** |
| W18 | Decyzja: e-CMR (6.9), kanał zespołowy Slack/Teams (9.9), kalendarz do subskrypcji (9.10), raport śladu węglowego (10.9), retencja `files/` w R2 (lista „Etap III” starego planu) — w 1.0 czy po 1.0. Od 27.09 „do decyzji właściciela”, decyzji nie było; do decyzji nie są budowane | gdy zdecydujesz | czeka |
| W19 | H-10 (D-84: porywy 15 m/s, silny wiatr wydłuża ETA): o ile wydłużać ETA i które źródło serii wiatru drogowego przyjąć (wykonawca w P4 wpisuje tu, co sprawdził) | po P4 | **ZAMKNIĘTE 16.10.2026, 02:08** — E49 zaakceptowane z odpowiedzią 3 (sprawa SCX z objazdem) — P6 (D-20261016-0230-01; zastępuje „czeka na akceptację” z D-20261016-0200-01 Z5) |
| W20 | D-18: czy wysłać armatorom e-mail z prośbą o zgodę na odczyt komunikatów (odczyt działa bez zgody od 29.09) | — | **ZAMKNIĘTE 09.10.2026, 13:09**: „mamy wszystkie zgody każdego z armatorów” — nic nie przygotowujesz i nie wysyłasz (D-18 ✅, D-20261009-1309-01 R2) |
| W21 | P3-APK: uprawnienie `workflow` dla tokenu GitHub — potem wykonawca przypina akcje (SHA) w workflow APK | gdy będzie | **dostarczone 12.10.2026, 02:38** (token ma `workflow` — sprawdzone 11.10 w P0-CI; pin SHA = pozycja „P3-APK — uzupełnienie W21”) |
| W22 | E18 P3 (decyzja „A: usunąć konta +tower-test z zaproszeniami”) i P2: wiersze 6 kont „+tower-*” wskazuje 11 wpisów dziennika bezpieczeństwa (klucz bez kaskady) | — | **ROZSTRZYGNIĘTE 09.10.2026, 13:09**: „usunąć z odpięciem 11 wpisów dziennika” — robi P1 (`paczki/P1_E18.md`, D-20261009-1309-01 R3) |
| W23 | Kwoty w dokumentach audytu (E3, E16, E33, E40, `DECYZJE_08_10.md`): zostają w repozytorium (prywatnym) czy usunąć je z dokumentów (G-16) | gdy zdecydujesz | czeka |
| W24 | Sprawdzenie na iPhonie i Androidzie (E8 pkt 8, E13): dolny pasek, karty, dzwonek, instalacja — wynik do koordynatora; odbiór C16 na S24 (D-20261015-1955-01) | po P2 i po P3; po C16 | **dostarczone 15.10.2026, 20:50 (Android S24)** — powiadomienie odebrane w telefonie (N1); pełny odbiór C16 po N3; iPhone = W43 |
| W25 | Zgoda na jednorazową kopię prawdziwych pozycji SG-03 (czas, współrzędne, prędkość, zapłon; bez nazwisk i tablic) z produkcji na TEST na czas testów P4 i P8, z usunięciem po teście (G-17 pkt 3). Bez zgody testy idą na śladzie zmyślonym | przed P4 | czeka |
| W26 | Piloci: zmiana symbolu ładunku z „PL + SE” na „BRAK” po wpisaniu pilotów — usunąć zapisane wiersze pilotów czy zostawić je ukryte w bazie (D-20261009-1233-01 pyt. 2). Do odpowiedzi: wiersze zostają w bazie, niewyświetlane | przed P7 | czeka |
| W27 | Link śledzenia: brak linku od SCX **nie blokuje** kompletnej awizacji ani „Gotowy”; zostaje ostrzeżenie jak dziś (L19). Decyzja 4B (17.10.2026, 07:20) | przed P4 | **ZAMKNIĘTE 17.10.2026, 07:20 (4B, D-20261017-0730-01)** |
| W28 | Grupowanie na mapie: czy także auta blisko siebie poza strefami E34 (np. parking), a jeśli tak — w jakiej odległości. Do odpowiedzi: tylko strefy (D-20261009-1309-01 R5) | przed P9 | czeka |
| W29 | Ta sama data lub godzina zmieniona w pliku KSH i w Watch Tower między synchronizacjami — co wygrywa. Do odpowiedzi: plik; KSH dostaje informację w dzwonku (D-20261009-1309-01 R6 pkt 6) | przed „P7 — uzupełnienie W13” | czeka |
| W30 | Czy zablokować Administratorowi HHL zmianę dat i godzin w „Działaj jako” konto KSH (decyzja 13:09 „tylko KSH” a konstytucja VI.5 „może wykonać każdą czynność za każde konto”). Do odpowiedzi: nie blokujemy — zapis jako konto KSH, w dzienniku prawdziwy wykonawca (D-20261009-1309-01 R6 pkt 3) | przed P3 | czeka |
| W31 | „Data załadunku” w pliku KSH jest w 28 wierszach formułą „dostawa − 5 dni” (plik z 08.10). Gdy KSH zmieni w Watch Tower datę załadunku takiego transportu: nadpisać formułę wartością czy zostawić formułę (wtedy zmiana nie trafi do pliku). Do odpowiedzi: wartość zastępuje formułę — decyzja 13:09 jest nowsza niż „formuł nie zmienia” z 12:50 (D-20261009-1309-01 R6 pkt 5) | przed „P7 — uzupełnienie W13” | czeka |
| W32 | Nocna brama wizualna nie działa na tym komputerze (P0-CI pkt 8) | — | **zamknięte 15.10.2026** (D-20261015-0300-01 E): bez nocnej bramy; 280 ujęć w GitHub Actions (W11 / P11 pkt 6); zrzuty przed scaleniem = `visual` (D-87) |
| W33 | Windows na komputerze wykonawcy nie instaluje aktualizacji od 11.11.2025 (26100.7171; najnowsza dla 24H2: 26100.9550 z 22.09.2026) — komputer z kluczami produkcji. Naprawa wymaga ok. 25 GB wolnego na C:. Kiedy? | po wydaniu (P11) | czeka — do odpowiedzi: po wydaniu (P11) (D-20261011-2135-01) |
| W34 | GitHub Actions: joby nie startują — „recent account payments have failed or your spending limit needs to be increased” (Billing & plans). Blokuje checki PR #184 (Poprawki P3) i dalsze bramy. STOP §1 pkt 12.2 (wydatek / limit poza decyzjami planu). | przed scaleniem Poprawek P3 | **dostarczone 14.10.2026, 01:55** (właściciel: GitHub Actions działa) |
| W35 | Termin wydania `release-1.0` | — | **zastąpione 17.10.2026, 07:20 (2C)**: środa 28.10.2026, 20:00 (D-20261017-0730-01); wcześniej 22.10 (D-20261015-0330-01) |
| W36 | Token do odczytu doradcy „security” — sekret Edge `ADVISOR_MGMT_TOKEN` (nie `SUPABASE_*`) | przed C14 / P10a / B2 | **sekret wpisany w Supabase 17.10.2026, 07:28** (wcześniej był tylko w `.env.local`; „W36 wpisane”) → B2: jedno wywołanie, `advisor_ok = true` (D-20261017-0730-01) |
| W37 | emtrack: nowe dane logowania od SCX — właściciel wpisze `EMTRACK_LOGIN` / `EMTRACK_PASSWORD` w Secrets i napisze „W37 wpisane” | przed pierwszym transportem ze śledzeniem / po A8 | czeka — dane od SCX w drodze (D-20261017-0730-01); A8 robisz bez czekania |
| W38 | „Podgląd” z prawdziwymi uprawnieniami firmy | przed P6 | **rozstrzygnięte 15.10.2026, 03:12: TAK** — P6 (D-20261015-0330-01) |
| W39 | `LOAD_STATUS × HHL_ADMIN` e-mail w „Kto co dostaje” | teraz | **rozstrzygnięte 15.10.2026, 03:12: cofnąć**; stan 15.10 ~06:11: `email=false` (już wyłączone) |
| W40 | Uzgodnienie pkt 2–3 i E46–E48 | — | **zaakceptowane 15.10.2026, 03:12** (D-20261015-0330-01) |
| W42 | Kanał zapasowy, gdy telefon nie potwierdzi pilnego WEB_PUSH w 5 min albo konto bez urządzenia | C16 N4 | **rozstrzygnięte 15.10.2026, 19:57: e-mail** na adres konta (bez SMS; D-20261015-1955-01) |
| W43 | iPhone do odbioru C16 (właściciel nie ma) + Cz24 pkt 12 (dzwonek i otwarcie aplikacji na iPhonie, D-20261016-0310-01) | C16 odbiór krok 3; P6 Cz24 | czeka na pierwsze konto z iPhone’em — dowód: `push_subscriptions` z `web.push.apple.com` + `last_ack_at`; nie blokuje zamknięcia C16 (D-20261015-1955-01) |
| W44 | Pliki polisy HHL i zezwolenia 13/GD/2026 w `D:\Watch Tower\dane\` | A7 / P5 D2 | **pliki potwierdzone 17.10.2026, 07:20** (D-20261017-0730-01) |
| W45 | SCX: czy zezwolenia SE i PL mają warunek pogodowy (wiatr)? Jeśli tak — próg z dokumentu zastępuje 25 m/s | przed pierwszym transportem KR | czeka — do odpowiedzi: 25 m/s; nie blokuje (D-20261016-0230-01 Z7) |

## §6. Czeka na dane albo decyzję, przeniesione do paczek, PO 1.0 (rezerwa usunięta 17.10)
**Część 1 — Czeka na dane albo decyzję właściciela (zaczynasz po „W<nr> gotowe”, §3):**
- synchronizacja SharePoint w obie strony (E38, L41) — W13;
- oficjalne API emtrack: TELM-2, II-4, D-TELM-ETA; API Stena (D-LATER) — W15;
- II-2 kody opóźnień z SCX — W16;
- 6.9 e-CMR, 9.9 kanał zespołowy, 9.10 kalendarz, 10.9 ślad węglowy, retencja `files/` w R2 — W18;
- P3-APK — W21 (**dostarczone 12.10.2026, 02:38** → pozycja „P3-APK — uzupełnienie W21”);
- kwoty w dokumentach — W23;
- prawdziwy ślad SG-03 na TEST — W25;
- W26–W31 (pytania z 09.10, D-20261009-1309-01): praca idzie według „Do odpowiedzi” z §5; odpowiedź właściciela zmienia pozycję dopiskiem koordynatora.
Zamknięte 09.10.2026: E44 (link RIO jest — E44 w P4), W20 / D-18 (zgody armatorów są), W22 (rozstrzygnięte — P1).

**Część 2 — Przeniesione do paczek 09.10 (dawna lista „PO 1.0”, której właściciel nie zdecydował):**
- 8.4 alternatywne przeprawy → P6 (E7-5);
- H-7 mapa w e-mailach i PDF → P8;
- ferry-weather → P10a (E23-4);
- PR7, P2-TILES, B-VERIFY-17.3, KOPIA-D → P11 pkt 4;
- E-MAIL-TYG, P3-BRACES i zależności deweloperskie z lukami (nie blokują scalenia) → brama niedzielna (§3).

**Część 3 — PO 1.0:** dalej pusta. Tylko pozycje, które właściciel przeniósł swoją decyzją (W18). Stan 17.10: brak.

**Część 4 — Rezerwa:** **usunięta** (D-20261017-0730-01, 3A i 2C). Kalibracja ETA po 5 dostawach (E15), akcja SMS w kreatorze (E35), test wydajności w skali 3× (E46), E37 „Co nowego” i E24 komunikat — robisz normalnie w swoich paczkach (P4-u / P8 / P11 / P10b / P9).

## §7. Stary plan — co się z nim stało
- Wszystkie pozycje starego `PLAN.md` (do 07.10) są zamknięte jako „zastąpione planem z 08.10” albo wpisane wyżej. Pełny inwentarz 110 pozycji: `docs/handover/audyt_claude_2026-10-08/PLAN_OTWARTE_08_10.md`.
- **Objęte audytem (54):** w paczkach P1–P10b według etapu.
- **Sprzeczne (6):** obowiązuje audyt.
- **R-0:** NIEAKTUALNE (transporty są prawdziwe od 01.10).
- **Spoza audytu potrzebne do produkcji:** P11 pkt 4. Reszta w §6 (części 1 i 2).
- **Pozostałe pozycje inwentarza (przypisanie 09.10, po niezależnym przeglądzie):**
  - TELM-EMTRACK-WEB kroki 5–6 (monitoring 72 h; link do transportu i mapa) → objęte E23 (P10a: stan źródła emtrack) i E27 / E32 (P4, P7); stan sprawdzasz w P0a;
  - P1-LINT (9 błędów stylelint w `src/index.css`, gałąź `fix/p1-font`) → stan w P0a; jeśli `npm run lint:css` nie jest zielone, poprawka w P2 (E10);
  - D-LATER (API Stena, telematyka, SharePoint) → §5 W15 i W13;
  - AIS-SRC pomiar 24 h → P10a;
  - 11.3 testy ścieżek użytkownika → P11 pkt 8 (R-3);
  - retencja `files/` w R2 → §5 W18;
  - SG-03 raport po rozładunku (polecenie 05.10 13:53) → objęty sekcjami „Test” E15, E26 i E42 dla SG-03 (P4, P8); w P0a wpis „zastąpione audytem” z odesłaniem.
- **Kolejka L-1b, L-4, L-5, L-13 z dawnego `AGENTS.md`:**
  - stan sprawdzasz w P0a (migracje, scalone PR-y, `POSTEP.md`);
  - zrobione oznaczasz z dowodem w `POSTEP.md`;
  - niezrobione wchodzą do paczki etapu, który obejmuje temat: decyzje i „Do zrobienia” → P6, powiadomienia i cele kliknięć → P3, SMS → P8;
  - jeśli nie da się ustalić, co to jest, piszesz dopisek do koordynatora.
- **Usunięcie pozycji SG-01 `driver_token` (z dawnego `AGENTS.md`):** robisz w P1 razem z porządkami, tym samym sposobem (kopia R2, tylko ten wiersz). Jeśli już zrobione, wpisujesz dowód.

## §8. Dziennik planu
| Data | Zmiana | Źródło |
|---|---|---|
| 08.10.2026 16:05 | Nowy plan: paczki P0a–P11, linie A–C, protokół dopisków, rozstrzygnięcia luk | polecenie właściciela 14:43; koordynator |
| 08.10.2026 16:46 | D-20261008-1646-01 (włączony do kompletu przez koordynatora przed P0a): jeden folder, jeden wykonawca, kolejność P0a → P0b → P1 → P2 → P3 → P4 → P5 → P6 → P7 → P8 → P10a → P9 → P10b → P11; punkty kontrolne po P2; przy włączaniu doprecyzowane: część paczki bez danych właściciela przechodzi pełny cykl, sygnały dla właściciela w czacie, potwierdzenie na TEST przy migracji | właściciel 16:44; koordynator |
| 09.10.2026 01:20 | Audyt kompletu (koordynator): termin liczony od Dnia 1 (start 11.10), data wydania — W17; punkty kontrolne od Dnia 1; brama niedzielna przywrócona (11.10 = brama TEST z P0b, potem 18.10); G-15 (brama w jednym folderze); decyzje właściciela przywrócone w E7-2, E7-5, E21-1, E22-2, E23-4, L6, L13, L29, L41, L55, L56; L15 doprecyzowane; G-13 (bez POD), G-14 (adres testowy); §6 przebudowany: W13–W22, pozycje dawnego „PO 1.0” w P4 (H-10 sprawdzenie), P6, P8, P10a, P11 i w bramie niedzielnej | właściciel 08.10 13:26, 14:43, 16:44; 09.10 00:45; koordynator |
| 09.10.2026 01:20 | D-20261009-0015-01 (treści „Jak pracuję”, 5 wersji) włączony do kompletu przez koordynatora przed P0a: pozycja i odbiór w P10b, L38 | właściciel 09.10 00:12; koordynator |
| 09.10.2026 02:00 | Po niezależnym przeglądzie kompletu: L33 przywrócone do decyzji E34 B; G-16 (kwoty w dokumentach, W23), G-17 (dane z produkcji na TEST bez danych osobowych, próba R-1 z ROLLBACK, 95 HH); W24 (sprawdzenie na iPhonie i Androidzie); doradca „security” w bramie (E19 pkt 6); szerokości E20; AIS-SRC 24 h → P10a; 11.3 → R-3; D-LATER → W15; retencja `files/` → W18; §7 pozostałe pozycje; godzina wydania 20:00 w §0; blok „Brama niedzielna” | właściciel 09.10 00:45; koordynator |
| 09.10.2026 02:10 | Po drugim przeglądzie: G-17 przepisane (TEST bez danych z produkcji; R-1: TEST na pliku ze zmyślonymi danymi osobowymi, próba z ROLLBACK w oknie wdrożenia P7; ślad SG-03 zmyślony, prawdziwy po W25); W25; doradca „security” na TEST i po wdrożeniu na produkcji, wyjątek TEST dla ochrony haseł; brama niedzielna w czasie paczki (commit, `main`, powrót); status P0a; W5 z nazwą pliku; W15 i W18 w §6; tekst pomocy „Strefy” zgodny z L33 | właściciel 09.10 00:45; koordynator |
| 09.10.2026 14:11 | D-20261009-1233-01 (piloci, 12:33) i D-20261009-1309-01 (decyzje 13:09) włączone do kompletu `komplet_2026-10-09_v2` przez koordynatora przed P0a; E44 (link RIO, 10:34–11:19) w P4 po E27; P1: W22 (usunięcie z odpięciem); P3: daty tylko KSH (G-20), wiersz stały `PLAN_DATES_CHANGED` (G-18); P5: polisy raz (G-21), dopłaty — decyzja HHL i SCX (G-22); P6: pozycje dopłat; P7: powiadomienia o zmianie dat (G-18), piloci SCX i konwój (G-23), link RIO w nowym oknie Awizacja, zapis dat do pliku po W13 (G-20); P9: grupowanie w lokalizacji (G-19); P10a: RIO w E23; P10b: poprawione teksty „Jak pracuję”; §5: W14 i W20 zamknięte, W22 rozstrzygnięte, nowe W26–W31; §6 część 1; konstytucja III.5; rejestr „Zmiany 09.10.2026” (i D-18, D-22); `ROZSTRZYGNIECIA_LUK.md` E9-2, E9-6, E18-1, L19, L29, L41, L55, G-18–G-24; `DECYZJE_08_10.md` sekcje 09.10; `UZGODNIENIE_08_10.md` D-30, D-33, D-42, konta „+tower-*” i W14 (pkt 6); `PLAN_OTWARTE_08_10.md` TELM-2, D-18, D-TELM-ETA; etapy E9, E11, E27, E31, E32, E33, E37, E38, E44, E45; `paczki/P1_E18.md`, `paczki/P0a_WGRANIE.md`; makiety E32, E33, E38, E45 poprawione i ich obrazy w raporcie; raport „Zmiany 09.10” i sekcja E44 | właściciel 09.10 10:34, 10:54, 11:19, 12:33, 13:09; koordynator |
| 11.10.2026 21:35 | D-20261011-2135-01: praca na Windows bez WSL; D-86 brama bazy w GitHub Actions; D-87 test wizualny przed scaleniem w GitHub Actions; P0-CI przed P0a; zasady pracy na Windows; W32, W33 | właściciel 11.10 21:22, 21:35; koordynator |
| 11.10.2026 23:2x | D-20261011-2254-01: dokończenie P0-CI — R1 `service_role` w `db.yml`, R2 regresja D14, R3 `maxWorkers` Windows; W32 zmienione (nocna brama wizualna nie na tym komputerze) | koordynator (STOP 22:54 PR #152) |
| 12.10.2026 01:40 | D-20261012-0105-01: dokończenie P0-CI (2) — R4 TZ/PGTZ, R5 baf, R6 bmapa; R7 wdrożenie z Windows, R8 migracje/funkcje z Windows; W9 zamknięte (R9); hash scalenia P0-CI `9b0f3dc8` | koordynator |
| 12.10.2026 02:38 | W21 dostarczone (token GitHub `workflow`); pozycja „P3-APK — uzupełnienie W21”: pin SHA w `sms-gateway-apk.yml` → merge `e8351fc3` | właściciel; wykonawca |
| 12.10.2026 22:10 | D-20261012-2210-01: R1 zatrzymanie pętli TEST; R2 brama TEST w worktree; R3 parytet `schema_migrations` (registry); R4 poprawka R8 nakładania; R5 słowo w odbiorze P0b — pozycje D1–D4 w P1 | koordynator; wykonawca |
| 12.10.2026 23:35 | D-20261012-2335-01: poprawki P1 K1–K9 (0193, `kopia.mjs`, zestaw `e18`) przed potwierdzeniem na TEST i scaleniem #164 — pozycja D5 w P1 | koordynator; wykonawca |
| 13.10.2026 03:45 | D-20261013-0345-01: P1 L1–L6 — bez zmiany aplikacji pod testy na żywo; testy na żywo zielone na TEST; ważność potwierdzenia bazy na `a24c05e0` — pozycja D6 w P1; bez scalenia #164 do spełnienia L1–L6 | koordynator; wykonawca |
| 13.10.2026 14:00 | D-20261013-1400-01: poprawki P2 — Q1 wdrożenie aplikacji (R7), Q2 trzynaście tytułów ROAD_SE, Q3 zasada „NA PRODUKCJI”. Q2 przed scaleniem P3 | koordynator |
| 13.10.2026 15:50 | D-20261013-1535-01 i D-20261013-1550-01: wzorzec wyglądu = raport audytu (WYGLAD-RAPORT). Konstytucja VIII pkt 1–2; rejestr; `AGENTS.md` i `.cursor/rules`; PLAN §0, §1 pkt 5, nagłówek §4; Poprawki P2 — wygląd (V1–V4) przed P3; P3 V5 (Kokpit, E8 pkt 6); P7 V6; P11 Z12 przed R-4. Z8–Z12 przed Z7 i przed „ról” w Z4. D-20261013-1525-01 i D-20261013-1615-01 bez wykonania | właściciel 13.10 15:31 i 15:43; koordynator |
| 13.10.2026 18:35 | D-20261013-1835-01: FRONT-KOORDYNATOR — wygląd na `wyglad/*` robi koordynator; Cursor: dane, logika, baza, scalenie i wdrożenie (F1–F8). Rejestr; `AGENTS.md` §3 i §4; `.cursor/rules/front.mdc`; PLAN §1 pkt 5, §3, §4 P2 (Poprawki P2 — wygląd 2), P3, P5 (kolor marży), §8. D-20261013-1815-01 (W1–W7) przejmuje koordynator na `wyglad/P2-2` (F4); Cursor scala i wdraża gdy zielony. P3: najpierw logika i baza (F5) | właściciel 13.10 18:27; koordynator |
| 13.10.2026 21:30 | D-20261013-2130-01: do `wyglad/P3` — E13 CSS dzwonek (Cursor nie zmienia CSS); uchwyty Moje konto / Użytkownicy / matryca 5 ról / Podgląd; scalenie logiki P3 bez czekania na wygląd | wykonawca (Cursor) |
| 13.10.2026 22:55 | D-20261013-2255-01: wyglad/P3-a — kolejność scalenia PR #178, uchwyty G3, logika profilu G4 (`last_sign_in_at`, `real_full_name`); PLAN §4 P3: P3-a / P3-b / P3-c | koordynator; wykonawca |
| 14.10.2026 00:15 | D-20261014-0015-01: Poprawki P3 (R1 G-20 baza, R2 push krytyczne + DECISION×CLIENT_USER, R3 doradca prod, R4 instrukcja W1) — przed P4 z migracją | koordynator |
| 14.10.2026 01:39 | STOP Poprawki P3: GitHub Actions — płatność / limit wydatków (W34); TEST i doradca TEST OK na `10d21b5b`; dalej P4 (bez wdrożenia migracji P4 do po Poprawkach P3) | wykonawca |
| 14.10.2026 01:55 | W34 dostarczone (GitHub Actions działa); Poprawki P3 scalone i wdrożone | właściciel; wykonawca |
| 14.10.2026 02:15 | D-20261014-0215-01: wyglad/P3-b — kolejność scalenia po #184, uchwyty Kokpitu/menu, logika H3 w P4/P6 | koordynator |
| 14.10.2026 03:15 | D-20261014-0315-01: wyglad/P4-a — kolejność #188→#181, H1 `AT_PORT_SE`, naprawa 0205/visual; P4 Ekrany P4-a/P4-b | koordynator |
| 14.10.2026 06:40 | D-20261014-0640-01: wyglad/P4-b (#189) — H1 CHECK `STATUS_READY_TO_INVOICE`/`STATUS_INVOICED` w #181 przed scaleniem; H2 actor + jedno zdarzenie + czas ≥ poprzedni; H3 etaDetail/progi 30/120; H4 RIO secret tylko serwer; kolejność #181→#189 | koordynator |
| 14.10.2026 07:00 | D-20261014-0700-01: wyglad/P3-c — scalenie PR #190, podłączenie danych Opcji (J3), testy lokalne (J5), pytanie J4 (ocena przewoźnika); PLAN §4 P3 / P8, §8 | koordynator; wykonawca |
| 14.10.2026 13:20 | D-20261014-1320-01: wyglad/P4-c — kolejność scalenia #181→#189→#193 (K1; D-20261014-1145-01 nie powstanie), dane K2 (`trackingLink`, `readyGaps`, `deliveredCheck`, `autoMetaOf`), uchwyty K3; PLAN §4 P4 Ekrany P4-a/b/c, P6 E7 DeliveredCheckCard | koordynator |
| 14.10.2026 14:20 | D-20261014-1420-01: poprawka P3-c J3.1 (R1 2FA=verified TOTP, R2 MyMfa, R3 my_session_revoke, R4 hasło, R5 I-17, R6 wyjątek load_status_rank w P4, R7 P3-d + J4 Kokpit) | koordynator |
| 14.10.2026 20:05 | D-20261014-2005-01: wyglad/P5 (PR #201) — scalenie i wdrożenie wyglądu; dane S1–S5 w P5 (`p5Source.ts`: Finanse, Faktury, paczka E40, Dokumenty, Ceny/dopłaty); PLAN §4 P5 Ekrany | koordynator; wykonawca |
| 14.10.2026 21:45 | D-20261014-2145-01: wyglad/P6-a (PR #205) — scalenie i wdrożenie wyglądu Ryzyk; dane T1–T6 w P6 (`p6Source.ts`: jedna liczba, reguły E7, osoby/przydział E6, sytuacja na trasie, dopłaty/L14, porządki); PLAN §4 P6 Ekrany | koordynator; wykonawca |
| 14.10.2026 23:00 | D-20261014-2300-01: wyglad/P6-b (PR #207) — scalenie i wdrożenie wyglądu Historii i Czatu (E17); dane H1–H4 w P6 razem z E17 (`p6bSource.ts`: historia z bazy, czat widoczność/odczyty, piloci/wymiary, porządki E18); PLAN §4 P6 Ekrany + Odbiór | koordynator; wykonawca |
| 15.10.2026 03:00 | D-20261015-0300-01: blokery A1–A6; B (domknięcie P4); Poprawki P2–P3 C1–C13; D/E do §4 przyszłych paczek; §5 (numery potem W35–W40 wg D-0330) | koordynator; wykonawca |
| 15.10.2026 03:30 | D-20261015-0330-01: W35 wydanie 22.10 20:00; W36–W40; C14/C15; Podgląd → P6; PR #210 | właściciel 03:12; koordynator |
| 15.10.2026 04:00 | D-20261015-0400-01: P6 E2 drogi PL z HERE — `tower-road-pl` dopiero po C1 | właściciel 03:52; koordynator |
| 15.10.2026 19:55 | D-20261015-1955-01: BLOKER C2 → C16 przed C3 (powiadomienia na każdym telefonie); W42 e-mail; W43 iPhone; W24 czeka do odbioru C16 na S24 | właściciel 19:43 / 19:57; koordynator |
| 16.10.2026 01:00 | D-20261016-0100-01: BLOKER C16-H — e-mail zapasowy tylko po granicy 0219; tematy PL; APP_URL tower.log-mar.pl; migracja 0221 | właściciel 00:45; koordynator |
| 16.10.2026 02:00 | D-20261016-0200-01: P5 D1 wymiary/pilot/zezwolenie z tabeli; P5 D2 polisa+zezwolenie wpisuje wykonawca; P9 usunięcie H-1/H-3; W4 zamknięte; D-83/B-3a/ZEZW-13 zamknięte | właściciel 01:13; koordynator |
| 16.10.2026 02:30 | D-20261016-0230-01: E49 zaakceptowane — wiatr ETA, D-84=20 m/s, sprawa SCX objazd/postój, śliskość lokalnie; W19 zamknięte; W45 | właściciel 02:08; koordynator |
| 16.10.2026 02:50 | D-20261016-0250-01: Czat E17 — wybór odbiorców i „Przeczytali” (kto i kiedy) rozpisane w P6 jako Cz1–Cz12 (zastępuje D-20261014-2300-01 H2); odświeżanie przy otwartym Czacie (luka); wygląd `wyglad/P6-d` | koordynator; wykonawca |
| 16.10.2026 03:10 | D-20261016-0310-01: czat w dzwonku i w telefonie („SG-03 · kto · treść”), przyciski „Oznacz jako odczytane” / „Odpowiedz” w powiadomieniu, otwieranie zainstalowanej aplikacji zamiast Chrome — C3 (Cz13), P6 (Cz14–Cz24) | właściciel 02:57; koordynator; wykonawca |
| 16.10.2026 03:15 | D-20261016-0315-01: czat — powiadomienia tylko do osób, które widzą wiadomość; rozmowa HHL ↔ SCX nigdy do KSH (Cz25 w C3, Cz26–Cz33 w P6) | właściciel 03:06; koordynator; wykonawca |
| 16.10.2026 02:20 | D-20261016-0220-01: P8 E35 Automatyzacje — Z1–Z3 (reguły START, dane, zapis z powodem); wygląd `wyglad/P8-d` #239 | koordynator; wykonawca |
| 16.10.2026 03:05 | D-20261016-0305-01: E49 miejsca w kodzie (`e49Source.ts`, DetourCase, eta_basis.weather, 8 progów) → P6 | koordynator; wykonawca |
| 16.10.2026 03:30 | D-20261016-0330-01: Czat — miejsca w kodzie, Cz14 (pauza, nazwa według firmy); wygląd `wyglad/P6-e` #241 i `wyglad/P6-f` #242 → P6; wartości startowe wiersza czatu w C3 | koordynator; wykonawca |
| 16.10.2026 04:05 | D-20261016-0405-01: urządzenia 2FA i wymaganie 2FA — wygląd `wyglad/2fa` #243; dane w P3-d; po podłączeniu usuwasz MyMfa | koordynator; wykonawca |
| 16.10.2026 04:30 | D-20261016-0430-01: E22 pasek nowej wersji, „Na żywo”, komunikat zamiast pustej strony — wygląd `wyglad/P10a-a` #244; dane P10a | koordynator; wykonawca |
| 16.10.2026 04:45 | D-20261016-0445-01: E24-1 komunikat zamiast szarej mapy — wygląd `wyglad/P9-a` #245; zapis zgłoszenia dla HHL w P9 | koordynator; wykonawca |
| 16.10.2026 05:30 | D-20261016-0530-01: E37 „Zamknij” i „Link wygasł” — wygląd `wyglad/P10b-a` #246; dane P10b | koordynator; wykonawca |
| 16.10.2026 06:15 | D-20261016-0615-01: E29 dane mapy — wygląd `wyglad/P9-c` #248; dane P9 | koordynator; wykonawca |
| 16.10.2026 06:35 | D-20261016-0635-01: E1 zrobione w wyglądzie `wyglad/P9-d` #249 | koordynator; wykonawca |
| 16.10.2026 07:15 | D-20261016-0715-01: E45 grupowanie — wygląd `wyglad/P9-e` #250; dane P9 | koordynator; wykonawca |
| 16.10.2026 07:40 | D-20261016-0740-01: Przegląd w panelu — wygląd `wyglad/P9-f` #251; dane P9 | koordynator; wykonawca |
| 16.10.2026 08:10 | D-20261016-0810-01: Pomoc „Jak pracuję” i „Co nowego” — wygląd `wyglad/P10b-b` #252; dane P10b | koordynator; wykonawca |
| 16.10.2026 08:45 | D-20261016-0845-01: E23/E47 dane w P10a, ekrany `wyglad/P10b-c` #253 w P10b, E46 `perfResults()` w P11 | koordynator; wykonawca |
| 16.10.2026 09:30 | D-20261016-0930-01: pierwsze wejście E37 — wygląd `wyglad/P10b-d` #254; dane P10b | koordynator; wykonawca |
| 16.10.2026 10:20 | D-20261016-1020-01: Harmonogram w układzie pliku (E38 1A, E30, E20) — wygląd `wyglad/P7-c` #256; dane P7 pkt 1–6 | koordynator; wykonawca |
| 16.10.2026 21:30 | D-20261016-2130-01: `wyglad/W-dane` PR #274 — „Inne pliki” z „+ Dodaj”, linia objazdu, przeprawy z HERE (wygląd bez bazy, F8). Scalenie po skończonym C3 (#273), gdy unit i visual zielone. Dane: P5 pkt 3.1 (rodzaj OTHER, na końcu `otherDocsOn()` = true); P9 pkt 3.2 (geometria objazdu, `detourLinesOf()`); P9 pkt 3.3 (najpierw TEST — odcinek promowy HERE, inaczej W). Podgląd W38 bez zmian w planie | właściciel 16.10 21:13 i 21:22; koordynator |
| 14.10.2026 10:55 | D-20261014-1055-01 (Cursor robi UI/UX reszty P4) — **unieważniony** przez D-20261014-1320-01 K1; zapis porządkowy (D-20261017-0730-01) | koordynator |
| 17.10.2026 07:30 | D-20261017-0730-01: audyt 17.10 przyjęty; decyzje 1A/2C/3A/4B/5B/6A/7A/8A; termin `release-1.0` = środa 28.10.2026 20:00; bez cięcia zakresu; Naprawy audytu 17.10 przed C4 (C3-p→…→A6); P4 → CZĘŚCIOWO; P4-u; W1/W27/W36/W44; W37 w drodze; kolejka `wyglad/W-audyt` | właściciel 07:01 / 07:20 / 07:28; koordynator |
| 17.10.2026 08:00 | D-20261017-0800-01: PR #277 `wyglad/W-audyt` — `serverRuleOn`, 6A, 5B demo Opłata paliwowa, EUR, przepięcie, liczby, dzwonek, `lazyRetry`; klucze przy A1/A2/P6 E49/P6 E2/P9 E29 pkt 3; EUR w bazie przy pierwszym logowaniu; teksty serwera bez `upper(` (C3-p/C6) | właściciel 07:20 (5B, 6A); koordynator |
| 17.10.2026 09:15 | D-20261017-0915-01: PR #280 `wyglad/W-pl` (po #279) — panel tylko PL (8A), EN/SV tylko kierowca, N20 w aplikacji; B9: kafelek DeepL + kolumna języka + `supabaseProvider`; P8: `sms_render` tylko PL | właściciel 07:20 (8A); koordynator |
| 17.10.2026 09:30 | D-20261017-0930-01: PR #279 `wyglad/W-demo` (po #277) — daty demo 23.09, ETA demo, `STORE_SCHEMA_VERSION` 4, kurs bieżący przed rozładunkiem; P5 kurs `fx_rates` + usunięcie `invoices` demo przy `bills`; P4-u `delayed`; P11 pkt 6 ujęcia z TEST | właściciel 07:01; koordynator |
| 17.10.2026 11:00 | D-20261017-1100-01: PR #282 `wyglad/W-eta` (po #280) — `etaDuration` D-071, „przyjazd nocą” D-101, Opcje › Kalibracja ETA (E15 pkt 7 / 3A); P4-u: `fmt_eta_duration`, dane kalibracji §3; C3-p zdanie o Czacie; sprawdzenia APP_URL OK / push poza testem czeka | właściciel 07:20 (3A); koordynator |
