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
- **brama bazy:** scalenie z migracją = pełna brama w częściach; scalenie bez zmian w bazie = testy aplikacji + tylko dotknięte zestawy; pełna brama co niedzielę i przed migracją na produkcję. Jedno zadanie w tle max 40 min. Wyniki w `tmp-gate/wyniki.json`. Zielone tylko przy jednym commicie i jednej wersji migracji (`scripts/test-db-gate-summary.mjs`)
- **hook pre-push:** gałąź robocza = szybkie testy (unit, lint css, null-guard statyczny). Pełna brama wizualna (`scripts/ci/fresh-smoke.sh`) przy prośbie o scalenie i przed scaleniem do main. Push na `main`: zasady bez zmian (unit + świeży build wizualny + lint + null-guard + baza, gdy jest).
- **przed wdrożeniem:** build produkcyjny (`VITE_AUTH_MODE=supabase`) musi być zielony w strażniku danych przykładowych (`build/seedMarkers.ts`, test `tests/i0-prod-guard.test.ts`). Wtyczka Vite przerywa budowę paczki, gdy są w niej znaczniki z seeda (kody transportów, „Permit mismatch”, kwoty). Nazwy promów i miejscowości nie są znacznikami. Progu się nie luzuje.
- **SharePoint (przyszłość):** przy synchronizacji harmonogramu wiersz TYP = STANDARD jest pomijany (ładunki NTG, poza Watch Tower), tak jak przy imporcie pliku. Nie budować synchronizacji, dopóki nie ma osobnego zadania.
- **migracja na produkcję tylko po pełnej bramie (2026-10-03):** bez wyjątków. Migracja wchodzi na produkcję dopiero, gdy pełna brama w częściach jest zielona na tym samym commicie i tej samej wersji migracji. 0138 nałożona bez tej bramy była błędem. Brama 0001…0139 obejmuje też obiekty z 0138.
- **scalenie sam, bez czekania na właściciela (2026-10-03):** gdy zielone są testy aplikacji, gitleaks ma 0, a `npm audit --omit=dev --audit-level=high` nie zgłasza high/critical. Gdy PR ma migrację, brama bazy jest zielona, a plik migracji jest w repozytorium zanim cokolwiek trafi na produkcję. Właściciel dostaje raport, nie przegląd kodu. Stop tylko przy liście STOP z konstytucji IX.3 (zmiana prawdziwych danych poza planem, wydatek, wysyłka do użytkowników, nieprzewidziana zmiana wyglądu, dane znane tylko właścicielowi, regulamin usługi).
- **scalenie:** zielone testy aplikacji; brama bazy w częściach, gdy jest zmiana SQL albo migracji; **gitleaks przy każdym commicie** (zero nowych sekretów). **BLOKUJE:** luki wysokie i krytyczne w zależnościach produkcyjnych (`npm audit --omit=dev --audit-level=high`). **NIE BLOKUJE:** zależności deweloperskie — tylko wpis do PLAN.md (P3) i sprawdzenie raz w tygodniu w niedzielnej bramie, czy wyszła poprawka. Aikido i CodeRabbit nie są warunkiem scalenia.
- sekrety i pliki poufne poza repozytorium; hasło bazy tylko w `.env.local`
- wygląd = makieta w 100%; **pełna responsywność i instalacja na telefonie (D-55)**
- **wzorce zrzutów (baselines) odświeża tylko środowisko bramy wizualnej**, nie inne maszyny (`shots-baseline/` i snapshoty Playwright).
- każda paczka decyzji potwierdzona listą identyfikatorów
