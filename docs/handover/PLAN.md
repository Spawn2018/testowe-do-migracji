# PLAN PRACY WATCH TOWER — jedyna lista pracy

**Wersja: 08.10.2026, 16:05 (koordynator Claude, na polecenie właściciela 08.10 14:43); zmiana 16:46: jeden folder, jeden wykonawca, paczki po kolei (§3, dopisek D-20261008-1646-01); zmiana 09.10.2026, 01:20: audyt kompletu — termin liczony od startu, brama niedzielna, przywrócone decyzje właściciela, nowe pozycje §5 i §6, treści „Jak pracuję” (§8); zmiana 09.10.2026, 14:11: decyzje właściciela z 09.10 (E44 link RIO 10:34–11:19, piloci 12:33, konwój KR, W20, W22 i aktualizacje 1–5 z 13:09) — E44 w P4, zmiany w P1, P3, P5, P6, P7, P9, P10a, P10b, W14 i W20 zamknięte, W22 rozstrzygnięte, nowe W26–W31; dopiski D-20261009-1233-01 i D-20261009-1309-01 (§8); zmiana 11.10.2026, 21:35: praca na Windows bez WSL — D-86, D-87, P0-CI, zasady Windows (dopiski D-20261011-2135-01, D-20261011-2254-01, D-20261012-0105-01); zmiana 13.10.2026, 15:50: wzorzec wyglądu = raport audytu (WYGLAD-RAPORT, dopiski D-20261013-1535-01 i D-20261013-1550-01).** Zastępuje cały poprzedni `PLAN.md` (przeniesiony do `docs/archiwum/2026-10-08/docs/handover/PLAN.md`). Nic z poprzedniego planu nie obowiązuje, jeśli nie jest wpisane tutaj.

Właściciel, 08.10.2026 14:43: „nasze postanowienia i plik audyt watch tower są nadrzędne. Wszystko co jest starsze jest nieaktualne i nie może obowiązywać.” Właściciel, 13:26: „Najświeższe ustalenia … nadpisują wszelkie starsze decyzje i rozwiązania.”

---

## §0. Cel, termin, źródła

- **Cel:** kompletna aplikacja Watch Tower według audytu 07–08.10.2026, na produkcji `tower.log-mar.pl`, gotowa do pierwszego prawdziwego transportu od importu do faktury (R-3) i wydania `release-1.0`.
- **Termin: 4 dni pracy** (właściciel 08.10 14:43: 4 dni na zbudowanie kompletnej aplikacji). **Dzień 1 = dzień, w którym właściciel uruchamia sesję 0** (zapowiedziany start: niedziela 11.10.2026). Przy starcie 11.10: Dzień 1 = niedziela 11.10, Dzień 2 = poniedziałek 12.10, Dzień 3 = wtorek 13.10, Dzień 4 = środa 14.10. **Wydanie `release-1.0`: koniec Dnia 4, 20:00** (przy starcie 11.10: 14.10.2026, 20:00); granica terminu: koniec Dnia 4, 23:59 (4 h zapasu). Datę wydania potwierdza właściciel (§5 W17); do jego odpowiedzi obowiązuje koniec Dnia 4, 20:00. Punkty kontrolne w §3.
- **Źródła, w tej kolejności przy sprzeczności:**
  1. `docs/handover/wzorzec/01_KONSTYTUCJA.md` (ze zmianami z 08.10.2026 i 13.10.2026);
  2. `docs/handover/audyt_claude_2026-10-08/`:
     - `DECYZJE_08_10.md` — decyzje właściciela;
     - `ROZSTRZYGNIECIA_LUK.md` — wiążące rozstrzygnięcia 156 luk;
     - `etapy/E<nr>.md` — co zbudować;
     - `raport/img/` i decyzje w `raport/index.html` — wygląd (`makiety_html/` pomocniczo);
     - `paczki/` — szczegółowe zlecenia paczek;
     - razem z dopiskami włączonymi do planu (`docs/handover/dopiski/`: D-20261008-1646-01, D-20261009-0015-01, D-20261009-1233-01, D-20261009-1309-01, D-20261011-2135-01, D-20261011-2254-01, D-20261012-0105-01) — przy sprzeczności ze starszym zapisem obowiązuje nowsza decyzja właściciela (08.10 13:26, 14:43; 11.10 21:35);
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
5. **Wygląd według raportu audytu.** Wygląd = raport audytu (`raport/index.html` + `raport/img/`), najnowsza decyzja wygrywa; `makiety_html/` pomocniczo; dowód w `docs/handover/odbior/P<n>/` (konstytucja VIII, WYGLAD-RAPORT, D-20261013-1535-01 Z). Zmiana wyglądu ekranu z listy paczki jest przewidziana i nie jest powodem do zatrzymania. Z1–Z6 (D-20261013-1535-01); Z8–Z12 z D-20261013-1550-01 mają pierwszeństwo przed Z7 i przed słowem „ról” w Z4:
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

Jeden wykonawca, jeden folder, jeden czat agenta naraz (decyzja właściciela 08.10.2026 16:44: „Budujemy z 1 folderu w cursor”; dopisek D-20261008-1646-01). Paczki po kolei, w kolejności poniżej. Przed bramą końcową rebase na `main`.

**Kolejność:** P0-CI → P0a → P0b → P1 → P2 → Poprawki P2 — wygląd → P3 → P4 → P5 → P6 → P7 → P8 → P10a → P9 → P10b → P11 (P0-CI przed Dniem 1; P0-CI i P0a już scalone; Poprawki P2 — wygląd: `pakiet/P2-wyglad`, D-20261013-1535-01 V1–V4, przed scaleniem P3)

- Każda paczka: gałąź `pakiet/P<n>-<nazwa>` → brama (§1 pkt 3) → scalenie → wdrożenie → wpis w `POSTEP.md` (czas pracy i czas poprawek); potem od razu następna.
- Bez drugiego czatu agenta w tym folderze, bez trybu worktree i bez równoległych agentów Cursora.
- Gdy paczka czeka na dane właściciela (§5): część, która tych danych nie wymaga, przechodzi pełny cykl (brama, scalenie, wdrożenie); status w §4: „NA PRODUKCJI — bez <pozycja>, czeka W<nr>”; wpis w §5; bierzesz następną paczkę z kolejności, której zależności są spełnione. Gdy właściciel napisze „W<nr> gotowe”, brakująca pozycja wchodzi po bieżącym commicie jako osobna pozycja „P<n> — uzupełnienie W<nr>” z własną bramą i wdrożeniem (wyjątek od §2 pkt 6), a potem wracasz do przerwanej paczki.

Zależności (kolejność je spełnia; lista do kontroli): wszystkie paczki po P0a; bramę końcową P1, P2 i P3 robisz po scaleniu P0b (kodować możesz wcześniej) · P3 scalasz po P2 i po Poprawkach P2 — wygląd (wspólne pliki paska, nazwy E41 i formatów E21 — rebase przed bramą końcową) · P4 po P2 i P3 · P5 po P4 · P6 po P3 i P4 · P7 po P5 i P6 · P8 po P3 i P4 · P9 po P2 i P4 · P10a po P0b (push alarmów podłączasz po scaleniu P3) · P10b po P3 i P10a · P11 po wszystkich.

**Punkty kontrolne (czas polski; Dzień 1 według §0):**
| Kiedy | Ma być |
|---|---|
| koniec Dnia 1, 23:59 (przy starcie 11.10: niedziela 11.10) | P0a i P0b scalone; pełna brama TEST z odbioru P0b zielona (= brama niedzielna 11.10); P1 z zielonym checkiem `db` (D-86) |
| po wdrożeniu P2 | koordynator liczy z czasów w `POSTEP.md` prognozę dla P3–P11 i ustala dopiskiem kolejne punkty kontrolne |
| koniec Dnia 4, 20:00 (przy starcie 11.10: środa 14.10) | P11, pełna brama TEST, regeneracja 280 ujęć, `release-1.0` (data według W17) |

**Reguła cięcia:** gdy punkt kontrolny jest spóźniony o ponad 4 h albo prognoza po P2 pokazuje, że P11 nie zmieści się do końca Dnia 4, 20:00 (albo do daty z W17), koordynator przedstawia właścicielowi pozycje do przeniesienia do PO 1.0 (najpierw lista „Rezerwa”, §6 część 4). Decyduje właściciel; po jego decyzji koordynator wysyła dopisek. Wykonawca sam nie tnie zakresu.

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

Status paczki wpisujesz tu: `DO ZROBIENIA` → `W TOKU (gałąź)` → `NA PRODUKCJI (commit, godzina)` → `SPRAWDZONE (dopisek koordynatora)`. P0a i bramy niedzielne zmieniają tylko dokumenty: status P0a `NA PRODUKCJI — dokumenty, bez wdrożenia aplikacji`, a hash scalenia P0a wpisujesz w pierwszym wpisie P0b w `POSTEP.md`.

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

### P3 · Uprawnienia, konta, Opcje, pasek górny — DO ZROBIENIA
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
- **Ekrany:** pasek górny (wszystkie), Opcje (wszystkie), Kokpit i menu według roli.
- **Odbiór:**
  - test ról na TEST: 5 kont × tabela E9 przez API i przez ekran;
  - 0 odpowiedzi 403 w konsoli dla każdej roli;
  - Operacje HHL nie mogą zapisać ustawień (odmowa w bazie);
  - zapis daty albo godziny załadunku / rozładunku przez API: HHL Administrator, HHL Operacje, SCX Dyspozytor, SCX Użytkownik → odmowa bazy; KSH Użytkownik → przyjęty, wpis w Historii; wgranie pliku przez Administratora HHL nadal zmienia daty; „Działaj jako” KSH → zapis przyjęty, w dzienniku prawdziwy wykonawca (W30);
  - zrzuty porównane z makietami E9, E11, E12, E37 (pasek), E6, E13;
  - Kokpit na telefonie według E8 pkt 6 i `img/e8-after.webp` (D-20261013-1535-01 V5): kafelki 2 × 2 o równej szerokości; liczby się nie łamią („54 / 72” w jednej linii); 3 najpilniejsze sprawy; treść kafelków według E9.

### P4 · Statusy, śledzenie, ETA — DO ZROBIENIA
- **E25** statusy (automat „Gotowe do fakturowania” opierasz na dzisiejszym dokumencie CMR po dostawie; P5 podmienia na wymóg z E31):
  - nowe kody „Gotowe do fakturowania”, „Zafakturowano”; UNLOADED scalony z DELIVERED;
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
  - rozpoznanie linku w polu „Link śledzenia” w dzisiejszym oknie awizacji (`AwizacjaModal.tsx`), `rio_tracking_id` i `rio_secret` tylko po stronie serwera, zapytanie testowe po zapisie (pkt 1); P7 przenosi to działanie do nowego okna Awizacja bez zmian;
  - adapter `_shared/telematics/rioPositionSharing.ts`, cron `tower-rio-links` co 2 min — tylko transporty w oknie śledzenia E27 i tylko w czasie `start`–`end` linku (pkt 2);
  - zapis pozycji do tej samej tabeli co emtrack, `position_source = SUBCONTRACTOR_LINK`, bez duplikatów, prędkość z odległości i czasu (pkt 3); dalej jak dla emtrack (pkt 4) — SMS Śrem / Boden z E42 działają po P8 na tych samych pozycjach;
  - ważność linku i nowy link na każdy przejazd (pkt 5), rozpoznanie ciągnik / naczepa (pkt 6), bezpieczeństwo `secret` (pkt 8);
  - testy na TEST na zmyślonym identyfikatorze, kluczu i rejestracji (G-17), nie na linku i rejestracji z przykładu w E44; adres zapytania w dzienniku `integration_runs` bez `secret` (pkt 8);
  - błędy (pkt 7): „Link RIO nieprawidłowy” — sprawa dla SCX; 3 błędy pod rząd — wpis w `integration_runs` (`rio-links`) i sprawa „Źródło danych nie działa · RIO” dla HHL, tak jak dziś dla emtrack (`SOURCE_DOWN`, E23 „Fakty”); e-mail i push do Administratorów HHL — od P10a (RIO na liście źródeł E23);
  - pole „Link śledzenia” a kompletność awizacji: L19 (nie blokuje) i pytanie W27.
- **E15** ETA:
  - poprawka odpoczynku, „czeka przed placem” (E15-2), przeliczanie co 5 min;
  - cisza GPS 30 min w ruchu / 3 h na postoju; geometria HERE (E15-1);
  - „–” przed wyjazdem, słowa pewności (E15-3), kalibracja po 5 dostawach.
- **H-10** wiatr na drodze (D-84: porywy 15 m/s, silny wiatr na trasie wydłuża ETA): sprawdzasz, skąd wziąć żywą serię porywów na trasie (od 05.10 `route-hazards` pisze „H-10: brak żywej serii wiatru drogowego”) — HERE w limicie 100 USD/mies. albo źródło darmowe, po sprawdzeniu regulaminu (`AGENTS.md` §6). Wynik i propozycję wpisujesz w §5 W19. Wydłużenia ETA nie włączasz, dopóki właściciel nie poda, o ile wydłużać (W19).
- **Dane jednorazowe** (migracja danych z kopią):
  - faza z pozycji: SG-03 → „Dostarczone” 07.10 12:19:54 i usunięcie pozycji po dostawie (L11);
  - SG-01 UNLOADED → DELIVERED; datę potwierdza Administrator HHL (§5).
- **Testy do przepisania:**
  - `etap4-ui.spec.ts` l.88–116 („Oznacz jako gotowy”); `visual-states.spec.ts` (`mark-ready`, chipy);
  - `status-label.test.ts`, `status-pill.test.ts`, `money-v2.test.ts` l.63, `telm2-sim.test.ts`, `l11-spine.test.ts`, `eta-*.test.ts`, `i15-eta-band.test.ts`, `corridor-eta.test.ts`;
  - zestawy `status`, `release`, `i2`, `h4`, `dwell`.
- **Ekrany:** panel transportu (Status), pasek etapów (Kokpit, Harmonogram, Mapa), znaczniki statusów; pole „Link śledzenia” w oknie awizacji i opis lokalizatora w panelu (E44).
- **Odbiór:**
  - sekcje „Test” E25, E26, E27, E28, E15 i E44 (pkt 9; `secret` w żadnym logu ani eksporcie — grep po testach);
  - na TEST przejazd SG-03 kończy się „Dostarczone 12:19” — na śladzie zmyślonym (G-17), a po zgodzie W25 także na prawdziwych pozycjach;
  - pełna trasa Śrem → Boden z symulowanymi pozycjami: każdy status raz, właściwy kafelek, prawdziwa godzina.

### P5 · Pieniądze i dokumenty — DO ZROBIENIA
- **E31** dokumenty, zezwolenia, polisy:
  - CMR tylko z rozładunku, usunięcie wymogu CMR z załadunku i jego alarmów;
  - „Firma” podpięte samo, „Trasa” (KR) ręcznie;
  - polisy: KSH widzi tylko polisę HHL, SCX tylko swoją, HHL obie; nazwa polisy HHL „OC przewoźnika — PZU”;
  - termin CMR z podpisem odbiorcy (L26); przypomnienie o polisie HHL (L27);
  - **polisy SCX i HHL dodawane raz** — podpinają się same do dokumentów każdego transportu, przy którym polisa jest ważna w dniu transportu (E31; polisa SCX od zatwierdzenia przez HHL); bez wgrywania polisy przy pojedynczym transporcie (decyzja 09.10 13:09 pkt 4, G-21, D-20261009-1309-01 R7).
- **E33** ceny i dopłaty:
  - **system liczy, nie wprowadza** (decyzja 09.10 13:09 pkt 5, G-22, D-20261009-1309-01 R8): podpowiedź po stronie HHL (część przychodowa) i SCX (część kosztowa) w oknie „Dopłata” z przyciskami „Dodaj” i „Nie dodaję”; dopłata dodana przez SCX → „czeka na HHL” → HHL „Akceptuję” / „Odrzucam”; dopłata dodana przez HHL → „czeka na KSH” → akceptuje KSH; do ceny trafia tylko dopłata dodana i zaakceptowana (pozycje „Do zrobienia” tych podpowiedzi — P6);
  - postój 750 EUR za dobę albo 75 EUR za godzinę (wolne: 6 h na załadunku, 4 h na rozładunku);
  - anulowanie: % frachtu bez opłaty paliwowej, 2 dni przed załadunkiem = 25 %;
  - Kratownice bez daty = stawka dla 1 auta.
- **E3, E3b, E39** opłata paliwowa: źródła, godziny czasu polskiego (E3-2), wpis Orlen z 06.10 (E3-4); KSH i SCX widzą to samo co HHL.
- **E16** Finanse:
  - marża, **próg 4 %** (wartość startowa), kurs NBP i „kurs bieżący”;
  - waluta w bazie; próg w „Cennik i opłaty” (E12-2).
- **E4** faktury: zakładki według firmy, VAT 23 %, akceptacja, kwoty „co do grosza” (E4-3), spóźniony CMR (E4-1).
- **E4b** faktoring: 1 % netto, wypłata 48 h kalendarzowych po akceptacji, ekran „Faktoring” w grupie „Pieniądze” (E4b-1, E4b-2).
- **E40** paczka tygodnia:
  - adresy startowe: HHL `ksiegowosc@hhlogistics.pl`, KSH `faktury@ksh.pl`;
  - wysyłka dopiero po akceptacji; pierwsza wysyłka na produkcji — właściciel (L47).
- **Testy do przepisania:**
  - `etap4-ui.spec.ts` l.144–308 (M6 VAT, M8, M11); `d-eur-t.spec.ts` l.213; `etap6-ui.spec.ts` (O4 → G-08); `etap5-ui.spec.ts` l.88–90;
  - `doc-requirements.test.ts` l.17–18;
  - `money*`, `invoices3`, `invoice-*`, `payment-reminders`, `b32-insurance-cover`, `i2k-doc-week`, `paliwo-auto-b`, `i31-sefs`, `i30-*`, `b4b-cmr-only`;
  - zestawy `money`, `insurance`, `storage`, `baf`, `i30`, `i31`.
- **Ekrany:** Finanse, Faktury, Dokumenty, Opcje › Pieniądze, panel (dokumenty, kwoty, okno „Dopłata”).
- **Odbiór:** sekcje „Test” E31, E33, E39, E16, E40; testy R7 i R8 z D-20261009-1309-01; faktura testowa na TEST zgodna z wyliczeniem co do grosza; KSH nie widzi kosztu ani marży, SCX nie widzi ceny KSH (test na TEST).
- **Po wdrożeniu (§5):** SCX wgrywa zezwolenie 13/GD/2026, HHL wgrywa polisę PZU 1106707356 (raz — podpina się sama, G-21).

### P6 · Do zrobienia, ryzyka, panel i historia — DO ZROBIENIA
- **E7** „Do zrobienia”:
  - karta na transport, sprawy z firmą i osobą, przyciski;
  - filtry „Moje / Moja firma / Wszystkie”, jedna liczba (E7-2), samozamykanie;
  - „Sytuacja na trasie”; zakazy jako informacja; sprawy techniczne → Stan systemu (E7-3);
  - nazwy spraw (E7-4); kliknięcie rozwija kartę w miejscu;
  - **podpowiedzi dopłat** (G-22, D-20261009-1309-01 R8): pozycja „Do zrobienia” dla HHL (część przychodowa) i dla SCX (część kosztowa) otwiera okno „Dopłata” z P5; „Nie dodaję” zamyka pozycję tej firmy z wpisem w Historii; dopłata dodana przez SCX → pozycja HHL „Akceptuję / Odrzucam”.
- **8.4 alternatywne przeprawy** w „Sytuacji na trasie” według `ROZSTRZYGNIECIA` E7-5 (D-45, L-9, FERRY-STATUS). Najpierw sprawdzasz, co z L-9 już działa (`RisksView`, `sailings`); brakującą część budujesz.
- **E6 (karta decyzji):** „Biorę tę sprawę”, „Oddaj”, „Przejmij” (E6-5), „Zadzwoń”.
- **E2** drogi PL z HERE:
  - panel PL w „Sytuacji na trasie”, odświeżanie co 15 min;
  - usunięcie KPD (E2-1); próg jak dla dróg SE (E2-2).
- **E17** panel transportu (Historia dopłat — wyzwalacz na `load_agreed_fees` buduje P5 z E33; P6 tylko wyświetla):
  - Status / Historia / Czat (Czat HHL–SCX; KSH pisze do wszystkich);
  - profil trasy ukryty; nazwy zdarzeń (E17-2);
  - zawężenie `events_insert` (E17-1, E19-1).
- **E18 P16** usunięcie `route-profile` i `load_route_profiles` (0 wierszy) z listą kopii.
- **Testy do przepisania:**
  - matryca `ryzyka` (uchwyt `[data-panel="ferry"]` zostaje); `etap6-ui.spec.ts` l.29–33;
  - `notify-dedup`, `click-targets`, `risk-keys`, `l8-cockpit-tiles`, `decision-access`, `i2-facade`;
  - zestawy `risks`, `dec2`, `dec3`, `dec5`, `dec6`, `dec-auto`, `backup`.
- **Ekrany:** Ryzyka / Do zrobienia (komputer i telefon), panel transportu (Historia, Czat), Kokpit (liczba).
- **Odbiór:**
  - sekcja „Test” E17; testy z punktów E7 (G-02);
  - liczba „Do zrobienia” z reguł E7 na danych testowych; ta sama liczba w menu, Kokpicie i na dzwonku (E7-2);
  - pozycje dopłat według testu R8 (D-20261009-1309-01): postój 8 h 10 min → pozycja u HHL i u SCX; SCX „Dodaj” → pozycja HHL;
  - 8.4: odwołany rejs na jednej przeprawie → propozycja najbliższych rejsów drugiej; przy sztormie na obu → brak propozycji; brak rozkładów → „Brak danych” (test na TEST);
  - wszystko, co dziś zapisuje przeglądarka, działa po zawężeniu `events_insert` (test e2e).

### P7 · Harmonogram, import pliku KSH, panel i Awizacja — DO ZROBIENIA
- **E38** import ręczny pliku SharePoint:
  - mapowanie 21 kolumn; filtr „Przewoźnik = HH”; „Standard” → sprawa;
  - KR-03 nie odrzucany, sprawa „Daty KSH do sprawdzenia” (L31);
  - aktualizacja po kodzie; zmiana z panelu KSH według E9-6 (do synchronizacji W13); daty i godziny zmienia i potwierdza tylko KSH i plik (G-20; prawa i ochrona w bazie — P3);
  - **zmiana dat lub godzin przy wgraniu pliku** (decyzja 09.10 13:09 pkt 1, G-18, D-20261009-1309-01 R4): porównanie 4 pól („Data załadunku”, „Godzina (załadunek)”, „Data dostawy na budowę”, „Godzina (rozładunek)”) → powiadomienie `PLAN_DATES_CHANGED` do HHL Administrator, HHL Operacje, SCX Dyspozytor, SCX Użytkownik, jedno na transport na wgranie, z „było → jest”, wpis w Historii; to samo przy zmianie KSH w Watch Tower; sprawy D-12 i L31, przesunięcie startu śledzenia (E27 pkt 1), E39, E16 i workflow E9 bez zmian;
  - Harmonogram domyślnie w układzie pliku (nazwy kolumn z makiety, L42); 8 kolumn jako „Widok skrócony”.
  - Synchronizacja z SharePoint w obie strony i zapis do pliku — po dostępie od działu IT KSH (§5 W13, L41) jako pozycja „P7 — uzupełnienie W13”; w niej także zapis dat i godzin zmienionych przez KSH w Watch Tower do pliku (do 1 min), plik → Watch Tower co 5 min, komórki i konflikt według D-20261009-1309-01 R6 pkt 4–6 (G-20, W29, W31).
- **E30** Harmonogram: filtry E28 + tydzień; zmiana zestawu tylko w oknie Awizacja.
- **E20** pełny zakres poza paskiem górnym (pasek w P3): szerokości, przyklejone kolumny (E20-1, E20-2).
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
  - z pomiaru 13.10 (D-20261013-1535-01 V6), zamyka P7 według E30 „Telefon” i E20-1 / E20-2: Harmonogram na telefonie — pierwsza karta ok. 820 px z 844 (25 elementów nad nią); przy 1440 px kolumna z kwotą i marżą zasłania „Kierowca” (HHL) i „Nr rej.” (KSH).
- **Ekrany:** Harmonogram (oba układy), panel transportu, okno Awizacja, wgrywanie pliku.
- **Odbiór:** sekcje „Test” E38, E30, E20, E32; test odbioru D-20261009-1233-01; testy R1, R4 i R6 (bez części po W13) z D-20261009-1309-01; raport z TEST zgodny z testem E38 pkt 6 (plik z 08.10: 95 HH, 43 NTG, 15 pustych pominiętych, 0 błędów); raport próby z ROLLBACK na produkcji: 94 transporty z bazy + KR-03 nowy ze sprawą, różnice wyjaśnione.

### P8 · Komunikacja i automatyzacje — DO ZROBIENIA
- **E42** SMS:
  - 4 rodzaje A–D (treść A według L50), cisza nocna 20:00–06:00, raz na transport × miejsce × rodzaj × numer;
  - tryb testowy przez 3 transporty; odbiorcy 2 + 2 bez wyboru języka;
  - e-mail zastępczy, wpis w Historii.
  - Przełącznik „Wysyłka do odbiorców” włącza właściciel (§5).
- **E43** „Treści wiadomości”: tylko PL; edytor; 28 rodzajów (L53); link 24 h (L37). E-maile logowania według L54 (§5).
- **E35** Automatyzacje: kreator z akcją SMS (L35); „Działa samo” według E35 pkt 1 i L13.
- **H-7** mapa w e-mailach i PDF (zlecenie HERE z 04.10; w starym planie „do decyzji koordynatora” — koordynator 09.10: P8). Najpierw stan (B-10 z 05.10: „PDF+mapa H-7”). Brakującą część budujesz przy treściach wiadomości (E43): mapa trasy transportu (droga i prom jak na Przeglądzie — E1, E45) jako obraz w e-mailu o transporcie i w PDF; HERE w limicie 100 USD/mies.
- **E34** strefy: edycja; po zmianie od razu sprawdzenie ostatniej pozycji transportów w oknie śledzenia, wpis „zmiana strefy”, statusy jak przy zwykłym wjeździe i wyjeździe, bez SMS (E34 pyt. 1 B, L33).
- Stare pozycje „SMS 6, 7, 10, 11” zamknięte (L51).
- **Testy do przepisania:** `b5-workflow-creator`, `workflow-map`, `l12-geofence`; zestawy `smsksh`, `workflows`, `l12`, `dec-auto`.
- **Ekrany:** Opcje › Powiadomienia (SMS przy miejscach, Treści wiadomości), Automatyzacje, Strefy.
- **Odbiór:** sekcje „Test” E42, E43, E35, E34; e-mail próbny o transporcie i PDF z mapą trasy (H-7) na TEST, wysłany tylko na adres właściciela (G-14); na TEST odtworzenie SG-03 daje SMS 11:45 B, 13:05 C, 06:00 C, 08:35 D i nic po 12:19 — na śladzie zmyślonym (G-17), a po zgodzie W25 także na prawdziwych pozycjach; tryb testowy wysyła tylko na numer właściciela.

### P9 · Mapy — DO ZROBIENIA
- **E1** Kokpit i Mapa: kadr całej trasy (fitBounds), bez zapamiętywania przesunięcia; Przegląd: zoom 11 na pojeździe, co 60 s.
- **E29** Mapa:
  - tabela = transporty w oknie śledzenia; filtry „Opóźnione”, „Brak GPS”, „Bez pozycji” (L22);
  - kafelek zmienia zakres; bez deklaracji częstotliwości (L20).
- **E45** trasy:
  - promy z HERE (L56: najpierw sprawdzenie na TEST; brak odcinka promowego = wpis W, pkt 1 czeka na właściciela, pkt 2–5 idą dalej); bez kropek;
  - checkbox „Trasa” chowa drogę i prom; statki AIS pod „Pojazdy”;
  - ostatni odcinek SE jak SG-03, z geometrią zapisaną w bazie (L57);
  - grupowanie aut na promie;
  - **grupowanie aut w jednej lokalizacji** (decyzja 09.10 13:09 pkt 2, G-19, D-20261009-1309-01 R5): tak samo jak na promie, na Mapie i w Kokpicie; lokalizacja = strefa E34 (załadunek, port PL, port SE, plac), bez buforów; auta na promie grupuje rejs; poza strefami — W28.
- **E24** (decyzja 07.10 17:46):
  - każdy adres `tower-hhl.pages.dev` → 301 na `tower.log-mar.pl` z tą samą ścieżką — plik przekierowań tylko w buildzie Cloudflare Pages (Vercel go nie dostaje);
  - rejestr: wpis „zapas `tower-hhl.pages.dev`” → „przekierowuje na tower.log-mar.pl (07.10)”; `PRZELACZENIE_HOSTINGU.md` zaczyna się od zdjęcia przekierowania;
  - procedura wdrożenia: `tower-hhl.pages.dev` → 301;
  - usunięcie pages.dev z Redirect URLs Supabase — właściciel (§5 W12);
  - komunikat zamiast szarej mapy (E24-1, rezerwa).
- **Testy do przepisania:** migawki mapy i Kokpitu; `aud01-mapa`, `aud01e-*`, `map-declutter`, `b1-vehicle-markers`, `bmapa`; zestawy `bmapa`, `h1`, `h3`.
- **Ekrany:** Kokpit (mapa), Mapa, Przegląd w panelu.
- **Odbiór:** sekcje „Test” E29, E45, E24; test R5 z D-20261009-1309-01; zrzuty 1440 i 390 porównane z makietami E1, E29, E45.

### P10a · Przeładowania, stan źródeł i błędy aplikacji — część bazy i funkcji — DO ZROBIENIA
Bez ekranów Opcji (te w P10b, po P3).
- **E22** przeładowania: pasek „Jest nowa wersja”, brak błędów „stara wersja”; kryterium „tydzień bez nowych błędów” liczone od wdrożenia P10a (E22-2).
- **E23 (baza i funkcje):**
  - stan źródeł danych i progi (E23-1, E23-2);
  - alarm do Administratorów HHL (e-mail i push — decyzja 27 A), przypomnienie po 2 h, „Wróciło”; wysyłka tylko na konta HHL_ADMIN;
  - źródło RIO (E44 pkt 7, z P4) na liście źródeł: 3 błędy pod rząd → alarm „Źródło danych nie działa · RIO” e-mailem i push;
  - **E18 P14** klucz emtrack bez daty UTC i zamknięcie duplikatu;
  - **ferry-weather** (E23-4): przyczyna 8/24 przebiegów bez wyniku i odmów DMI z dziennika funkcji, opis w PR, poprawka według E23 pkt 2–4;
  - **AIS-SRC** (rejestr, stary plan: „zbudowane — pomiar 24 h nie zrobiony”): pomiar 24 h świeżości pozycji 5 promów (cel ≤ 5 min na mapie) z wynikiem w PR; odstępstwa jako źródło „Częściowo” według E23;
  - 16 spraw „Nieznany kod źródła drogowego” przeniesione do Stanu systemu (dane jednorazowe z kopią).
- **E47 (baza i funkcje):** grupowanie błędów po treści (nie po buildzie), bez przeglądarek testowych, reguła alarmu (`UZGODNIENIE_08_10.md` pkt 5), raport tygodniowy.
- **Testy do przepisania:** zestaw `watchdog`; testy przeładowań (`routes`, `session-year` — jeśli dotknięte).
- **Odbiór:** sekcje „Test” E22 (bez punktu „tydzień” — E22-2) i E23 (część bazy); ferry-weather: każdy przebieg z doby ma wynik w `integration_runs` albo stan „Częściowo” z przyczyną; E47 na TEST: wymuszony błąd → wpis i alarm ≤ 5 min; ten sam błąd 10 razy = 1 grupa; zero alarmów z przeglądarek testowych.

### P10b · Konto, pomoc, ekrany Stanu systemu — DO ZROBIENIA
- **E37 (reszta; pasek górny w P3):**
  - zaproszenie czyta treść z „Treści wiadomości” (E43, klucz zaproszenia), a gdy jej nie ma — domyślną z E37; P8 dodaje ją do E43 (kolejność scalenia dowolna);
  - logowanie: komunikaty, „Nie pamiętam hasła”, link 24 h;
  - zaproszenia: lista stanów, „Wyślij ponownie”, „Cofnij”;
  - Pomoc „Jak pracuję” w 5 wersjach — treści i test odbioru z dopisku `D-20261009-0015-01` (L38; z poprawkami z 09.10 naniesionymi w tym pliku: piloci — D-20261009-1233-01, daty, grupowanie, polisy, dopłaty, konwój — D-20261009-1309-01) — i „Co nowego”;
  - komunikat HHL tylko jako baner; 2FA dobrowolne.
- **E23 i E47 (ekrany):** Opcje › System › Stan systemu (źródła danych, „Sprawdź teraz”, kafelek Bezpieczeństwo z E19) i „Błędy aplikacji” według makiet E23 i E46.
- **Testy do przepisania:** `i4-guide`, `auth-password`, `resp14-phone.spec.ts`, `e2e-core.spec.ts`; zestawy `dec6`, `adm10`.
- **Ekrany:** logowanie, Pomoc, Opcje › Ludzie i dostęp, Opcje › System.
- **Odbiór:** sekcja „Test” E37; „Test odbioru (w P10b)” z dopisku `D-20261009-0015-01`; ekrany E23 i E47 zgodne z makietami; zrzuty 1440 i 390.

### P11 · Jakość, bezpieczeństwo, wydanie (koniec Dnia 4 albo data z W17) — DO ZROBIENIA
1. **E46** wydajność (`UZGODNIENIE` pkt 5):
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
| W1 | Ustawienia logowania Supabase: ochrona przed wyciekniętymi hasłami, minimum 12 znaków, „litery i cyfry” (instrukcja od wykonawcy w P3) | po P3 | czeka |
| W2 | Użytkownicy (imię, nazwisko, telefon) i numery SMS Śrem / Boden — wpisuje właściciel w programie | po P3 i P8 | czeka |
| W3 | SG-01: potwierdzenie daty rozładunku w oknie „Zmień status” | po P4 | czeka |
| W4 | SCX wgrywa zezwolenie 13/GD/2026; HHL wgrywa polisę PZU 1106707356 | po P5 | czeka |
| W5 | Plik KSH z 08.10 (`SCRAP_transporty_2026.09.23_REV.01_3.xlsx`, wiadomość właściciela 08.10 12:14) do wgrania (R-1) — przekazanie wykonawcy poza repozytorium, w `D:\Watch Tower\dane\`. Inny (nowszy) plik tylko dopiskiem koordynatora | przed P7 | czeka |
| W6 | Włączenie wysyłki: SMS do odbiorców (po 3 transportach w trybie testowym), e-maile w „Kto co dostaje”, pierwsza paczka tygodnia na adresy księgowości (alarmy E23 i E47 do Administratorów HHL działają od razu — decyzja 27 A) | po P8 / P5 | czeka |
| W7 | Klucz Management API dla „Send Email Hook” albo wklejenie treści e-maili logowania w panelu Supabase (L54) | po P8 | czeka |
| W8 | Akceptacja listy źródeł CSP i 12 wyników ASVS „częściowo” (E48) | P11 | czeka |
| W9 | Klucz przeglądarkowy HERE ograniczony do domeny (AUD-01d) | P11 | **zamknięte 06.10** (D-20261012-0105-01 R9); P11 sprawdza (Referer `tower.log-mar.pl` → 200; obcy → odmowa) |
| W10 | Konto testowe Claude (interia.pl) — usunięcie po wszystkich pracach (E18 P1) | po R-4 | czeka |
| W11 | Regeneracja 280 ujęć i tag `baseline-audyt-<data P11>` na maszynie z nocną bramą wizualną (cron właściciela, `scripts/visual/gate.sh`) — wykonawca przygotowuje polecenie w P11 | P11 | czeka |
| W12 | Usunięcie `tower-hhl.pages.dev` z Redirect URLs w panelu Supabase (E24 pkt 3) | po P9 | czeka |
| W13 | Dostęp do pliku harmonogramu KSH na SharePoint od działu IT KSH (decyzja 12:50 „czekamy”) — potem synchronizacja w obie strony według E38 (L41) i według decyzji 09.10 13:09: daty i godziny zmienione przez KSH w Watch Tower trafiają do pliku (G-20) | gdy będzie | czeka |
| W14 | Linki śledzenia od podwykonawców SCX (E44, L55) | — | **ZAMKNIĘTE 09.10.2026**: link RIO jest (10:34), dane automatycznie (10:54), zgody na piśmie i nowy link na każdy przejazd (11:19) — E44 w P4 (G-24) |
| W15 | Oficjalne API emtrack (TELM-2, II-4, D-TELM-ETA) i API Stena (D-LATER); do tego czasu odczyt jak dziś (`emtrack-web`, źródło STENA) | gdy będzie | czeka |
| W16 | Kody opóźnień uzgodnione z SCX (II-2) — po spotkaniu z SCX | gdy będą | czeka |
| W17 | Data wydania `release-1.0`: koniec Dnia 4 (przy starcie 11.10 — 14.10.2026) czy inna. Test E22 („tydzień bez nowych błędów »stara wersja«”) kończy się 7 dni po wdrożeniu P10a; przy wcześniejszym wydaniu jego wynik koordynator dopisuje do R-4 po 7 dniach (E22-2) | przed P11 | czeka |
| W18 | Decyzja: e-CMR (6.9), kanał zespołowy Slack/Teams (9.9), kalendarz do subskrypcji (9.10), raport śladu węglowego (10.9), retencja `files/` w R2 (lista „Etap III” starego planu) — w 1.0 czy po 1.0. Od 27.09 „do decyzji właściciela”, decyzji nie było; do decyzji nie są budowane | gdy zdecydujesz | czeka |
| W19 | H-10 (D-84: porywy 15 m/s, silny wiatr wydłuża ETA): o ile wydłużać ETA i które źródło serii wiatru drogowego przyjąć (wykonawca w P4 wpisuje tu, co sprawdził) | po P4 | czeka |
| W20 | D-18: czy wysłać armatorom e-mail z prośbą o zgodę na odczyt komunikatów (odczyt działa bez zgody od 29.09) | — | **ZAMKNIĘTE 09.10.2026, 13:09**: „mamy wszystkie zgody każdego z armatorów” — nic nie przygotowujesz i nie wysyłasz (D-18 ✅, D-20261009-1309-01 R2) |
| W21 | P3-APK: uprawnienie `workflow` dla tokenu GitHub — potem wykonawca przypina akcje (SHA) w workflow APK | gdy będzie | **dostarczone 12.10.2026, 02:38** (token ma `workflow` — sprawdzone 11.10 w P0-CI; pin SHA = pozycja „P3-APK — uzupełnienie W21”) |
| W22 | E18 P3 (decyzja „A: usunąć konta +tower-test z zaproszeniami”) i P2: wiersze 6 kont „+tower-*” wskazuje 11 wpisów dziennika bezpieczeństwa (klucz bez kaskady) | — | **ROZSTRZYGNIĘTE 09.10.2026, 13:09**: „usunąć z odpięciem 11 wpisów dziennika” — robi P1 (`paczki/P1_E18.md`, D-20261009-1309-01 R3) |
| W23 | Kwoty w dokumentach audytu (E3, E16, E33, E40, `DECYZJE_08_10.md`): zostają w repozytorium (prywatnym) czy usunąć je z dokumentów (G-16) | gdy zdecydujesz | czeka |
| W24 | Sprawdzenie na iPhonie i Androidzie (E8 pkt 8, E13): dolny pasek, karty, dzwonek, instalacja — wynik do koordynatora | po P2 i po P3 | czeka |
| W25 | Zgoda na jednorazową kopię prawdziwych pozycji SG-03 (czas, współrzędne, prędkość, zapłon; bez nazwisk i tablic) z produkcji na TEST na czas testów P4 i P8, z usunięciem po teście (G-17 pkt 3). Bez zgody testy idą na śladzie zmyślonym | przed P4 | czeka |
| W26 | Piloci: zmiana symbolu ładunku z „PL + SE” na „BRAK” po wpisaniu pilotów — usunąć zapisane wiersze pilotów czy zostawić je ukryte w bazie (D-20261009-1233-01 pyt. 2). Do odpowiedzi: wiersze zostają w bazie, niewyświetlane | przed P7 | czeka |
| W27 | Link śledzenia: decyzja 07.10 20:57 „SCX zawsze musi dodać link”, E44 pkt 5 „pole wymagane przy każdej awizacji transportu podwykonawcy”, a kompletna awizacja w E32 pkt 6 (akceptacja 08.10 12:14) nie zawiera linku. Czy brak linku ma blokować kompletną awizację i „Gotowy”; jeśli tylko u podwykonawcy — po czym rozpoznać transport podwykonawcy SCX. Do odpowiedzi: według E32 pkt 6 nie blokuje; sprawa „Dodaj link śledzenia” dla SCX otwarta do wklejenia linku (L19) | przed P4 | czeka |
| W28 | Grupowanie na mapie: czy także auta blisko siebie poza strefami E34 (np. parking), a jeśli tak — w jakiej odległości. Do odpowiedzi: tylko strefy (D-20261009-1309-01 R5) | przed P9 | czeka |
| W29 | Ta sama data lub godzina zmieniona w pliku KSH i w Watch Tower między synchronizacjami — co wygrywa. Do odpowiedzi: plik; KSH dostaje informację w dzwonku (D-20261009-1309-01 R6 pkt 6) | przed „P7 — uzupełnienie W13” | czeka |
| W30 | Czy zablokować Administratorowi HHL zmianę dat i godzin w „Działaj jako” konto KSH (decyzja 13:09 „tylko KSH” a konstytucja VI.5 „może wykonać każdą czynność za każde konto”). Do odpowiedzi: nie blokujemy — zapis jako konto KSH, w dzienniku prawdziwy wykonawca (D-20261009-1309-01 R6 pkt 3) | przed P3 | czeka |
| W31 | „Data załadunku” w pliku KSH jest w 28 wierszach formułą „dostawa − 5 dni” (plik z 08.10). Gdy KSH zmieni w Watch Tower datę załadunku takiego transportu: nadpisać formułę wartością czy zostawić formułę (wtedy zmiana nie trafi do pliku). Do odpowiedzi: wartość zastępuje formułę — decyzja 13:09 jest nowsza niż „formuł nie zmienia” z 12:50 (D-20261009-1309-01 R6 pkt 5) | przed „P7 — uzupełnienie W13” | czeka |
| W32 | Nocna brama wizualna nie działa na tym komputerze (P0-CI pkt 8). Na czym działa — inny komputer, agent w chmurze (np. Cursor, Codex, Claude), coś innego? Czy dalej ma co noc działać? | gdy zdecydujesz | czeka — do odpowiedzi: bez zmian, tylko raportuje; jej brak nie wstrzymuje pracy (zrzuty przed scaleniem sprawdza `visual`, D-87; D-20261011-2254-01) |
| W33 | Windows na komputerze wykonawcy nie instaluje aktualizacji od 11.11.2025 (26100.7171; najnowsza dla 24H2: 26100.9550 z 22.09.2026) — komputer z kluczami produkcji. Naprawa wymaga ok. 25 GB wolnego na C:. Kiedy? | po wydaniu (P11) | czeka — do odpowiedzi: po wydaniu (P11) (D-20261011-2135-01) |

## §6. Czeka na dane albo decyzję, przeniesione do paczek, PO 1.0, rezerwa
**Część 1 — Czeka na dane albo decyzję właściciela (zaczynasz po „W<nr> gotowe”, §3):**
- synchronizacja SharePoint w obie strony (E38, L41) — W13;
- oficjalne API emtrack: TELM-2, II-4, D-TELM-ETA; API Stena (D-LATER) — W15;
- II-2 kody opóźnień z SCX — W16;
- 6.9 e-CMR, 9.9 kanał zespołowy, 9.10 kalendarz, 10.9 ślad węglowy, retencja `files/` w R2 — W18;
- H-10 wydłużenie ETA przy wietrze — W19 (sprawdzenie źródeł w P4);
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

**Część 3 — PO 1.0:** tylko pozycje, które właściciel przeniósł swoją decyzją (reguła cięcia §3, W18). Stan 09.10: brak.

**Część 4 — Rezerwa (pierwsze propozycje przy regule cięcia; przenosi się do części 3 tylko decyzją właściciela, §3):**
- E46 obciążenie w skali 3× (zostaje Lighthouse i pomiar bazy w skali 1×);
- E35 akcja SMS w kreatorze;
- E37 „Co nowego”;
- E24 komunikat zamiast szarej mapy;
- E15 kalibracja po 5 dostawach (zostaje sam zapis pomiarów).

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
