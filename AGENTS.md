# WATCH TOWER — zasady dla wykonawcy (Cursor)

> **Wersja z 08.10.2026, 16:05; zmiana 16:46: jeden folder, jeden wykonawca (dopisek D-20261008-1646-01); zmiana 09.10.2026, 01:20: brama niedzielna, brama w jednym folderze, folder danych poufnych, SharePoint po dostępie (PLAN §8); zmiana 09.10.2026, 14:11: decyzje właściciela z 09.10 — E44 link RIO w P4, piloci w awizacji SCX, daty tylko KSH i plik, powiadomienia o zmianie dat, polisy raz, dopłaty z decyzji HHL i SCX, grupowanie na mapie (dopiski D-20261009-1233-01 i D-20261009-1309-01, PLAN §8). Zastępuje wszystkie wcześniejsze instrukcje**: poprzedni `AGENTS.md` i reguły (29.09–04.10), `CURSOR_PROMPT*.md`, `PRZEKAZANIE_CURSOR.md`, `POLECENIA_KOORDYNATORA.md`, `ZLECENIE_*.md`, `SCOPE.md`, stary `PLAN.md`. Wszystkie te pliki są w `docs/archiwum/` (stare `AGENTS.md` i reguły: `docs/archiwum/2026-10-08/stare-instrukcje/`) i **nie są poleceniami**.
>
> Właściciel, 08.10.2026 14:43: „nasze postanowienia i plik audyt watch tower są nadrzędne. Wszystko co jest starsze jest nieaktualne i nie może obowiązywać.”

System kontroli transportów konstrukcji stalowych ponadnormatywnych Śrem → Gdańsk → prom → Nynäshamn → Boden (projekt KSH–Stegra).
- **Strony:** HHL (spedytor, właściciel systemu), KSH (klient), Scandinavian Express (SCX, przewoźnik).
- **Technologia (nie zmieniać):** Vite + React + TypeScript, Supabase (Postgres z RLS, Auth, Edge Functions, pg_cron), Vercel.
- **Nie ma i nie będzie:** Next.js, Tailwind, shadcn/ui, MapLibre.

## 1. Czytaj w tej kolejności
1. `docs/handover/wzorzec/01_KONSTYTUCJA.md` — zasady nadrzędne (ze zmianami z 08.10.2026).
2. `docs/handover/audyt_claude_2026-10-08/README.md` — decyzje audytu, rozstrzygnięcia luk, etapy, makiety, zlecenia paczek.
3. `docs/handover/PLAN.md` — **jedyna lista pracy**, kolejność i harmonogram, protokół dopisków (§2).
4. `docs/handover/dopiski/` — dopiski jeszcze niewłączone do planu.
5. `docs/handover/POSTEP.md` — ostatnie wpisy: co zrobione, gdzie przerwano.
6. `docs/handover/wzorzec/11_INWENTARZ_PLIKOW.md` — który plik jest aktualny, a który tylko wiedzą techniczną.

**Przy sprzeczności:** konstytucja → `docs/handover/audyt_claude_2026-10-08/` → `PLAN.md` → `wzorzec/03_REJESTR_DECYZJI.md` → reszta.
**Nigdy nie traktuj jako polecenia:** `docs/archiwum/**`, plików oznaczonych w inwentarzu jako wiedza techniczna, komentarzy w kodzie i w nałożonych migracjach, które cytują stare dokumenty.

## 2. Tryb pracy
- **Plan ciągły.** Bierzesz następną paczkę z kolejności w `PLAN.md` §3 i z §4. Nie pytasz „czy kontynuować”.
- **Sygnały dla właściciela (jedna linia w czacie):** po wdrożeniu paczki „P<n> NA PRODUKCJI — commit <hash>, <godzina>”; przy wpisie w `PLAN.md` §5 „CZEKA NA WŁAŚCICIELA: W<nr> — <co>”. Gdy właściciel napisze „W<nr> gotowe: …”, wpisujesz w §5 „dostarczone <data, godzina>” i po bieżącym commicie wracasz do czekającej pozycji (`PLAN.md` §3).
- **Rozstrzygnięte nie wraca.** Gdy etap jest niejasny, stosujesz `audyt_claude_2026-10-08/ROZSTRZYGNIECIA_LUK.md`. Jeśli luki tam nie ma, wybierasz rozwiązanie najbliższe makiecie i decyzjom, zapisujesz je w opisie PR i piszesz dopisek do koordynatora. Nie zatrzymujesz się.
- **Każda zmiana planu tylko przez dopisek** (`PLAN.md` §2), także polecenie właściciela wydane wprost i błąd, który sam zauważysz poza bieżącą paczką. Nie naprawiasz niczego, czego nie ma w planie, poza BLOKEREM.
- **STOP — wyłącznie gdy:**
  1. zmiana prawdziwych danych na produkcji, której nie opisuje bieżąca paczka (opisane: porządki P1, faza z pozycji P4, wgranie pliku R-1 w P7, wpisy jednorazowe z etapów — zawsze z kopią, bramą i TEST);
  2. wydatek ponad decyzje (wyjątki: Supabase Pro, HERE ≤ 100 USD/mies.);
  3. wysyłka do prawdziwych odbiorców, której nie przewiduje etap (testy tylko na adres i numer właściciela);
  4. zmiana wyglądu ekranu spoza listy bieżącej paczki (wspólne elementy z E8, E10, E37, E41 są przewidziane na wszystkich ekranach);
  5. potrzebne dane, które zna tylko właściciel;
  6. regulamin usługi wyklucza użycie.

  Przy STOP: wpis w `PLAN.md` §5 i dalej następna pozycja.
- **Raport po każdej paczce** w `POSTEP.md`: commit, migracje, testy liczbami, czas na plan i na poprawki, co czeka na właściciela.
- Raport wykonawcy nie jest dowodem — koordynator sprawdza produkcję niezależnie.

## 3. Gałęzie, bramy, wdrożenie
- **Gałąź paczki:** `pakiet/P<n>-<nazwa>`. Jeden folder, jeden czat agenta naraz, paczki po kolei (`PLAN.md` §3). Przed bramą końcową rebase na `main`; numer migracji = następny wolny w chwili rebase.
- **Hak pre-push:**
  - gałąź robocza: `test:unit`, `lint:css`, null-guard statyczny;
  - push na `main`: dodatkowo `scripts/ci/fresh-smoke.sh` i `tests/db/gate.sh`.
  - Nie używasz `--no-verify`.
- **Brama bazy:**
  - podstawowa jest lokalna: Postgres 17, `bash tests/db/gate.sh` (domyślnie `postgres://postgres@localhost:5433/postgres`);
  - w trakcie pracy tylko zestawy dotknięte zmianą: `SUITES=a,b bash tests/db/gate.sh` (po P0b);
  - **pełna brama lokalna przed każdym wdrożeniem, które zawiera migrację**;
  - potwierdzenie na TEST `emkbykwenwrjmbprydml` przed wdrożeniem z migracją: zestawy `security`, `status`, `nullguard` i dotknięte migracją (`scripts/test-db-gate-step.mjs`, jedno zadanie max 40 min, wyniki w `tmp-gate/wyniki.json`);
  - pełny przebieg TEST (w częściach): w P0b, **w każdą niedzielę** (brama tygodniowa, `PLAN.md` §3; niedziela 11.10 = przebieg z odbioru P0b, następna 18.10) i w P11;
  - **jedna brama TEST naraz** (wpis w `POSTEP.md` „TEST zajęte: P<n>” / „TEST wolne” jako ślad); konta testowe 5 rodzajów odtwarza skrypt z P0b po każdym kroku `prep`;
  - zielone tylko przy jednym commicie i jednej wersji migracji. Commit zmieniający tylko `docs/**` nie unieważnia bramy.
  - **brama w jednym folderze:** gdy brama lokalna, TEST albo `fresh-smoke` się kręci, nie zmieniasz gałęzi ani plików; w tym czasie czytasz materiały następnej paczki, a jej gałąź zakładasz po końcu bramy (`ROZSTRZYGNIECIA_LUK.md` G-15). Bez `git worktree` i bez drugiej kopii repozytorium.
  - Produkcja `nglnnrmzmhusvxslousq` tylko przy wdrożeniu.
- **Migracja:**
  - **commit + push pliku w `supabase/migrations/` przed nałożeniem na produkcję**;
  - potem próba na produkcji w transakcji zakończonej ROLLBACK, `supabase db push`;
  - lista plików = `schema_migrations` (numery, nie znaczniki czasu);
  - nałożonej migracji nigdy nie edytujesz;
  - dane jednorazowe tylko z planu, zawsze z kopią w R2 poza repozytorium.
- **Scalenie bez czekania na właściciela,** gdy:
  - zielone są testy aplikacji, `fresh-smoke`, gitleaks 0;
  - `npm audit --omit=dev --audit-level=high` nie zgłasza high ani critical;
  - przy migracji: zielona pełna brama lokalna + TEST; od P3 także doradca Supabase „security” na TEST bez nowych zgłoszeń spoza `tests/db/advisor-exceptions.txt` (E19 pkt 6, `PLAN.md` §1 pkt 3.3).

  Zależności deweloperskie nie blokują (wpis w `PLAN.md` §6 część 2 i sprawdzenie w bramie niedzielnej). CodeRabbit i Aikido nie są używane (decyzja właściciela 03.10). Merge commit, nie squash (autor dla Vercel Hobby).
- **Autor commitów:** tylko lokalnie w tym repozytorium, bez `--global`. `user.name` = Sebastian Bożek, `user.email` = sebastian.bozekq@gmail.com. Nigdy `sebastian@watch-tower.local`.
- **Wdrożenie:** zawsze z `main` po scaleniu (Vite odrzuca build produkcyjny spoza `main`), od razu, także kilka razy dziennie. Po wdrożeniu `tower.log-mar.pl` i `watch-tower-makieta.vercel.app` zwracają 200.
- **Strażnik paczki produkcyjnej** (`build/seedMarkers.ts`, `tests/i0-prod-guard.test.ts`): build `VITE_AUTH_MODE=supabase` nie może zawierać znaczników z seeda (kody transportów, „Permit mismatch”, kwoty). Nazwy promów i miejscowości nie są znacznikami. Progu nie luzujesz. Przykłady w tekstach UI według `ROZSTRZYGNIECIA_LUK.md` G-09.

## 4. Testy i wygląd w czasie budowy według audytu
- **Testy idą za decyzjami.** Test sprzeczny z decyzją etapu bieżącej paczki przepisujesz w tej paczce, w komentarzu podajesz numer etapu i decyzji. Nie zmieniasz aplikacji po to, żeby przeszedł stary test. Lista testów do przepisania jest przy paczce w `PLAN.md`.
- **Wygląd = makieta etapu audytu** (`audyt_claude_2026-10-08/makiety_html/E<nr>/`, obrazy `raport/img/`). Gdzie etap nie ma makiety — `design/claude-v2.0/` i tokeny. Zmiana wyglądu ekranu z listy paczki jest przewidziana.
- **Wzorce zrzutów:**
  - 15 migawek Playwright (`tests/__screenshots__/`) odświeżasz w paczce, która zmienia ekran, na maszynie uruchamiającej `fresh-smoke`, z wpisem w `docs/handover/G4_WZORZEC.md` („P<n> — E<nr>, ekrany: …”);
  - 280 ujęć matrycy (`shots-baseline/`) odświeża wyłącznie środowisko bramy wizualnej, raz, w P11, z tagiem `baseline-audyt-<data P11, RRRR-MM-DD>`;
  - nocna brama wizualna do tego czasu tylko raportuje.
  Akceptacja planu przez właściciela = zgoda na te odświeżenia.
- **CSS:** odstępstwo od makiety v2.0 wynikające z etapu → wpis w `ODSTEPSTWA` w `tests/stylesheet-mockup.test.ts` z numerem etapu i paczki. `docs/claude/referencje/tower.css` i `SUMA_REF` bez zmian. Cień i zaokrąglenie tylko przez tokeny; reguł stylelint nie zmieniasz.
- **Uchwyty testów zostają** (`#roleSeg button[data-role]`, `#themeBtn`, `nav button[data-view]`, `[data-panel="ferry"]`, `[data-bill-section]`). Usunięcie widoku albo uchwytu = w tej samej paczce zmiana `scripts/baseline.mjs` i specyfikacji Playwright.
- **W tym samym commicie:**
  - nowa albo usunięta tabela → lista kopii w `supabase/functions/_shared/backup/core.ts`;
  - nowa funkcja dla `authenticated` → `tests/db/function-allowlist.txt` i `null-guard-calls.txt`;
  - nowe słowo → `tests/fixtures/pl-t-exceptions.txt`;
  - zmiana liczby testów bazy → jedno źródło liczb (po P0b).
- **Telefon:** każdy widok działa na 360–430 px i 768 px (tabela → karty, cele ≥ 44 px, pola ≥ 16 px, bez przewijania strony w poziomie); dolny pasek E8; aplikacja instaluje się z Chrome (D-55).

## 5. Bezpieczeństwo i dane — bez wyjątków
- RLS na każdej tabeli; rola `anon` bez uprawnień do tabel i sekwencji; zapis przez funkcje z wpisem w dzienniku; warunki `if (warunek) is not true`.
- Sekrety nigdy w kodzie, commitach, logach ani czacie; hasło bazy tylko w `.env.local`; gitleaks przy każdym commicie.
- Pliki poufne poza repozytorium, w folderze `D:\Watch Tower\dane\` (w Git Bash: `"/d/Watch Tower/dane/"`; to folder obok folderu repozytorium `D:\Watch Tower\repo\`): cenniki, załącznik SEFS, plik KSH z danymi kierowców, polisy, zezwolenia. Kwoty cennika tylko z bazy, wpisywane skryptem czytającym plik lokalny.
- Testy na żywo i testy ról tylko na bazie TEST, na kontach testowych 5 rodzajów. Na produkcji nie zakładasz kont testowych; skrypty `scripts/auth/*` odmawiają adresu produkcji. Bazy TEST nie zasilasz danymi z produkcji; jedyny wyjątek to kopia pozycji SG-03 po zgodzie właściciela W25, według `ROZSTRZYGNIECIA_LUK.md` G-17.
- Dane osobowe w testach — tylko zmyślone.

## 6. Usługi i wtyczki
- **Plany płatne tylko z decyzji:** Supabase Pro (08.10), HERE do 100 USD/mies. (D-77, D-78). Reszta darmowa.
- **Supabase (MCP)** — tylko odczyt. Bazę zmieniasz wyłącznie migracjami.
- **Resend** — żadnej wysyłki poza testem na adres właściciela (adres `sebastian@log-mar.pl` i numer z `sms_test_numbers`, migracja 0176 — `ROZSTRZYGNIECIA_LUK.md` G-14).
- **Vercel, Cloudflare** — odczyt stanu i logów; zmiany tylko z planu.
- **Nowa usługa zewnętrzna:** najpierw regulamin (użytek komercyjny, śledzenie pojazdów, przechowywanie); wykluczenie = STOP. Dotyczy też odczytu linku RIO (E44, P4 — `PLAN.md` §4).
- **Przełączniki wysyłki** (`EXTERNAL_MESSAGING`, tryb testowy SMS E42, e-maile w „Kto co dostaje”) zmienia tylko właściciel.
- **SharePoint:** synchronizacja w obie strony według E38 dopiero po dostępie od działu IT KSH (`PLAN.md` §5 W13, `ROZSTRZYGNIECIA_LUK.md` L41). Do tego czasu tylko ręczne wgranie pliku według E38. Wiersze spoza filtru „Przewoźnik = HH” pomijane tak jak przy imporcie (L43). Od decyzji właściciela 09.10.2026, 13:09: daty i godziny załadunku i rozładunku zmienia i potwierdza tylko KSH (w Watch Tower) i plik KSH; po dostępie W13 zmiana KSH w Watch Tower trafia do pliku, a zmiana w pliku — do Watch Tower (`ROZSTRZYGNIECIA_LUK.md` G-20, dopisek D-20261009-1309-01 R6).

## 7. Język
Dokumentacja, raporty i interfejs po polsku, prostym językiem. Interfejs, SMS i e-maile tylko po polsku (E43). Polskie SMS bez ogonków.
