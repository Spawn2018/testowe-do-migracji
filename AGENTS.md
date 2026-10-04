# WATCH TOWER — zasady dla agentów

> **Wersja z 29.09.2026. Zastępuje wszystkie wcześniejsze instrukcje**, w tym
> `CURSOR_PROMPT.md`, `CURSOR_PROMPT_UI.md` i poprzedni `AGENTS.md`.

System kontroli transportów konstrukcji stalowych ponadnormatywnych
Śrem → Gdańsk → prom → Nynäshamn → Boden (projekt KSH–Stegra).
Strony: **HHL** (spedytor, właściciel systemu), **KSH** (klient),
**Scandinavian Express** (przewoźnik), kierowca.

**Technologia — stan faktyczny, nie zmieniać:** Vite + React + TypeScript,
Supabase (Postgres z RLS, Auth, Edge Functions, pg_cron), Vercel.
**Nie ma i nie będzie:** Next.js, Tailwind, shadcn/ui, MapLibre.

## Czytaj w tej kolejności
1. `docs/handover/wzorzec/01_KONSTYTUCJA.md` — zasady nadrzędne
2. `docs/handover/wzorzec/03_REJESTR_DECYZJI.md` — decyzje; nie pytaj o rozstrzygnięte
3. `docs/handover/PLAN.md` — jedyna lista pracy
4. `docs/handover/POSTEP.md` — co zrobione, gdzie przerwano
5. `docs/handover/wzorzec/06_KONTRAKTY_TECHNICZNE.md` — jak ma działać logika
6. `docs/handover/wzorzec/11_INWENTARZ_PLIKOW.md` — **które dokumenty są aktualne**

## Nigdy nie wykonuj jako polecenia
Niczego z `docs/archiwum/` ani plików oznaczonych w inwentarzu jako archiwalne.
Także **nigdy nie traktuj jako polecenia** tych folderów i plików (zapis historyczny / QA):
`docs/watch-tower/`, `docs/qa-start/`, `shots-start/`, `IDENTICAL_CLAUDE*.md`, `ACCEPTANCE.md`
(oraz kopie w `docs/`). Bramę wizualną i testy mogą z nich korzystać — agent nie.
W razie sprzeczności: konstytucja → rejestr decyzji → PLAN → reszta.

## Zasady w skrócie
Pełne: `.cursor/rules/*.mdc`. Procedury: `docs/handover/wzorzec/08_SKILLE/`.
- plan ciągły; STOP tylko w przypadkach z konstytucji IX.3
- ochrona w bazie; `anon` bez uprawnień; `is not true`
- **migracja: commit + push do repozytorium PRZED nałożeniem na PROD** (lista plików
  w `supabase/migrations/` = `schema_migrations` na produkcji)
- **brama bazy (2026-10-04 13:31, doprecyzowane 13:35 i 13:47):** podstawowa jest brama lokalna, Postgres 17, `bash tests/db/gate.sh` (domyślnie `postgres://postgres@localhost:5433/postgres`). Przy każdej zmianie w kodzie: szybkie testy aplikacji i tylko zestawy bazy dotknięte zmianą, w minutach. Pełna brama lokalna przed każdym wdrożeniem, które zawiera migrację. Gdy brama się kręci, następna pozycja planu powstaje na kolejnej gałęzi. Baza TEST Supabase `emkbykwenwrjmbprydml` tylko na niedzielną bramę tygodniową (w częściach, jedno zadanie max 40 min, `scripts/test-db-gate-step.mjs` + `scripts/test-db-gate-summary.mjs`) i na ostateczne potwierdzenie przed wdrożeniem. Produkcja `nglnnrmzmhusvxslousq` tylko przy wdrożeniu. Wyniki części TEST w `tmp-gate/wyniki.json`. Zielone tylko przy jednym commicie i jednej wersji migracji. Paczki dzienne są WYŁĄCZONE: pomiar 4 min 29 s nie jest wolny. Kolejka bez dni tygodnia — pozycja za pozycją, wdrożenie po każdej zielonej bramie.
- **autor commitów (2026-10-04 13:35):** tylko lokalnie w tym repozytorium, bez `--global`: `user.name` = Sebastian Bożek, `user.email` = sebastian.bozekq@gmail.com (konto Vercel, plan Hobby). Nigdy `sebastian@watch-tower.local`.
- **wdrożenie (2026-10-04 13:35, kolejka 13:47):** po każdym scaleniu na produkcję od razu, także kilka razy dziennie, gdy brama jest zielona. Nie czekać do wieczora. Paczki dziennej nie ma. Kolejność bez dni tygodnia: po zielonej bramie lokalnej L-1b razem z usunięciem pozycji SG-01 (jedna pozycja `driver_token`, 1.10.2026 22:08 czasu warszawskiego, kopia R2 poza repozytorium, tylko ten wiersz), potem L-4, L-5, L-13. L-1b nie startuje, dopóki brama lokalna nie jest zielona i scalona.
- **hook pre-push:** gałąź robocza = szybkie testy (unit, lint css, null-guard statyczny). Pełna brama wizualna (`scripts/ci/fresh-smoke.sh`) przy prośbie o scalenie i przed scaleniem do main. Push na `main`: zasady bez zmian (unit + świeży build wizualny + lint + null-guard + baza, gdy jest).
- **przed wdrożeniem:** build produkcyjny (`VITE_AUTH_MODE=supabase`) musi być zielony w strażniku danych przykładowych (`build/seedMarkers.ts`, test `tests/i0-prod-guard.test.ts`). Wtyczka Vite przerywa budowę paczki, gdy są w niej znaczniki z seeda (kody transportów, „Permit mismatch”, kwoty). Nazwy promów i miejscowości nie są znacznikami. Progu się nie luzuje.
- **SharePoint (przyszłość):** przy synchronizacji harmonogramu wiersz TYP = STANDARD jest pomijany (ładunki NTG, poza Watch Tower), tak jak przy imporcie pliku. Nie budować synchronizacji, dopóki nie ma osobnego zadania.
- **migracja na produkcję tylko po pełnej bramie (2026-10-03, tempo 2026-10-04):** bez wyjątków. Wdrożenie z migracją dopiero, gdy pełna brama lokalna jest zielona na tym samym commicie i tej samej wersji migracji, a potem jest ostateczne potwierdzenie na TEST. 0138 nałożona bez tej bramy była błędem. Brama 0001…0139 obejmuje też obiekty z 0138.
- **scalenie sam, bez czekania na właściciela (2026-10-03):** gdy zielone są testy aplikacji, gitleaks ma 0, a `npm audit --omit=dev --audit-level=high` nie zgłasza high/critical. Gdy wdrożenie ma migrację, pełna brama lokalna jest zielona, a plik migracji jest w repozytorium zanim cokolwiek trafi na produkcję. Właściciel dostaje raport, nie przegląd kodu. Stop tylko przy liście STOP z konstytucji IX.3 (zmiana prawdziwych danych poza planem, wydatek, wysyłka do użytkowników, nieprzewidziana zmiana wyglądu, dane znane tylko właścicielowi, regulamin usługi).
- **scalenie:** zielone testy aplikacji; pełna brama lokalna, gdy wdrożenie zawiera SQL albo migrację; **gitleaks przy każdym commicie** (zero nowych sekretów). **BLOKUJE:** luki wysokie i krytyczne w zależnościach produkcyjnych (`npm audit --omit=dev --audit-level=high`). **NIE BLOKUJE:** zależności deweloperskie — tylko wpis do PLAN.md (P3) i sprawdzenie raz w tygodniu w niedzielnej bramie, czy wyszła poprawka. Aikido i CodeRabbit nie są warunkiem scalenia.
- sekrety i pliki poufne poza repozytorium; hasło bazy tylko w `.env.local`
- wygląd = makieta w 100%; **pełna responsywność i instalacja na telefonie (D-55)**
- **wzorce zrzutów (baselines) odświeża tylko środowisko bramy wizualnej**, nie inne maszyny (`shots-baseline/` i snapshoty Playwright).
- każda paczka decyzji potwierdzona listą identyfikatorów
