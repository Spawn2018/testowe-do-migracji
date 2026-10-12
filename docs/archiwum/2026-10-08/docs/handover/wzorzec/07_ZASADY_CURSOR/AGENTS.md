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
- sekrety i pliki poufne poza repozytorium; hasło bazy tylko w `.env.local`
- wygląd = makieta w 100%; **pełna responsywność i instalacja na telefonie (D-55)**
- każda paczka decyzji potwierdzona listą identyfikatorów
