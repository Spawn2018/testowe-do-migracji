# P0a · Wgranie kompletu dokumentów z 08–09.10.2026

Tylko dokumenty: bez zmian w `src/`, `supabase/`, `scripts/`, `tests/`, `shots-baseline/`. Bez bramy bazy i bez wdrożenia aplikacji.

## Kroki
1. Przygotuj gałąź:
   ```
   git checkout main
   git pull
   git checkout -b pakiet/P0a-komplet
   ```
   Autor commitów lokalnie według `AGENTS.md` §3.
2. Archiwum kompletu (pliki `watch_tower_komplet_2026-10-09_v2_cz*.zip`, wersja z 09.10.2026 z decyzjami do 13:09) właściciel rozpakował **poza repozytorium**, do `D:\Watch Tower\komplet_2026-10-09_v2\`; ścieżkę podaje w poleceniu sesji 0. Komplet to podfolder `komplet/` tego folderu — dalej `<KOMPLET>`. W Git Bash: `"/d/Watch Tower/komplet_2026-10-09_v2/komplet"` — zawsze w cudzysłowie, bo ścieżka ma spację. Sprawdź, że istnieją `<KOMPLET>/AGENTS.md`, `<KOMPLET>/docs/handover/audyt_claude_2026-10-08/raport/img/` i `<KOMPLET>/docs/handover/audyt_claude_2026-10-08/makiety_html/`.
3. Z katalogu głównego repozytorium uruchom **w Git Bash** (na Windows nie w PowerShell ani WSL):
   ```
   bash "<KOMPLET>/docs/handover/audyt_claude_2026-10-08/paczki/P0a_przeniesienia.sh" "<KOMPLET>"
   ```
   Skrypt robi cztery rzeczy:
   - przenosi 3 pliki z kwotami cenników do folderu `dane/archiwum-2026-10-08/` obok folderu repozytorium (u właściciela: `D:\Watch Tower\dane\archiwum-2026-10-08\`) i usuwa je z repozytorium;
   - przenosi 279 starych dokumentów do `docs/archiwum/2026-10-08/` z zachowaniem ścieżek;
   - przenosi stary `AGENTS.md` i stare reguły `.mdc` do `docs/archiwum/2026-10-08/stare-instrukcje/` jako `.txt`;
   - kopiuje komplet na miejsca: `AGENTS.md`, `.cursor/rules/`, `docs/handover/PLAN.md`, konstytucja, rejestr, inwentarz, indeks, procedury, folder audytu, `dopiski/`.

   **Jeśli skrypt przerwie:** `git reset --hard HEAD && git clean -fd docs/archiwum/2026-10-08 docs/handover/audyt_claude_2026-10-08 docs/handover/dopiski` i uruchom go ponownie (kopie plików z kwotami zostają w `D:\Watch Tower\dane\archiwum-2026-10-08\`).
4. Sprawdź:
   - `git status --short`: zmiany tylko w `AGENTS.md`, `.cursor/rules/`, `docs/**` oraz przeniesienia z katalogu głównego i `design/claude-v2.0/CLAUDE_V2_SOT.md` do `docs/archiwum/2026-10-08/`;
   - `npm run test:unit` i `npm run lint:css` — zielone (żaden test nie czyta przenoszonych dokumentów; sprawdzone 08.10 i 09.10);
   - przed scaleniem jak przy każdym scaleniu (`AGENTS.md` §3): `scripts/ci/fresh-smoke.sh`, gitleaks 0, `npm audit --omit=dev --audit-level=high` bez high i critical;
   - `grep -rln "SCOPE.md\|ZLECENIE_\|POLECENIA_KOORDYNATORA\|06_KONTRAKTY" AGENTS.md .cursor/rules` — trafienia tylko w zdaniach, które nazywają te pliki archiwalnymi.
5. Stan dawnych pozycji (`PLAN.md` §7): L-1b, L-4, L-5, L-9 (alternatywy rejsu — potrzebne w P6, E7-5), L-13, TELM-EMTRACK-WEB kroki 5–6, P1-LINT, SG-03 raport po rozładunku, AUD-04, L-12, SMS-KSH-1H, P1-FONT, H-2-PL, ZEZW-13, B-3a, H-6, D-83 oraz „pozycje D4–D12 audytu” (bez treści w starym planie → zamknięte: brak treści).
   - Sprawdź w repozytorium: migracje, scalone PR-y, `public/fonts`, `POSTEP.md`.
   - Wpisz do `POSTEP.md`: zrobione / niezrobione i do której paczki — z dowodem w nawiasie. Bez dowodu: „do sprawdzenia przy paczce P..”.
6. `POSTEP.md`: wpis „P0a — komplet dokumentów z 08–09.10.2026” z liczbą przeniesionych plików, listą zmienionych plików i wynikiem punktu 5. W `PLAN.md` §4 status P0a: „NA PRODUKCJI — dokumenty, bez wdrożenia aplikacji”. Hash scalenia P0a wpisze następny czat w pierwszym wpisie P0b (po scaleniu niczego już nie zmieniasz w plikach — drzewo ma zostać czyste).
7. Commit „docs(P0a): komplet z 08–09.10.2026 — AGENTS, reguły, konstytucja, PLAN, archiwum”, push (hak: szybkie testy), PR, scalenie do `main` (merge commit).
8. Potwierdzenie odbioru (konstytucja IX.6) — w opisie PR lista przyjętych plików:
   - `AGENTS.md`;
   - 4 reguły `.mdc`;
   - `01_KONSTYTUCJA.md`, `03_REJESTR_DECYZJI.md`, `11_INWENTARZ_PLIKOW.md`, `00_INDEKS.md`;
   - 7 procedur (`docs/handover/wzorzec/08_SKILLE/`);
   - `PLAN.md`;
   - folder audytu z `ROZSTRZYGNIECIA_LUK.md`, `makiety_html/`, `paczki/`;
   - 4 dopiski w `docs/handover/dopiski/` (D-20261008-1646-01, D-20261009-0015-01, D-20261009-1233-01, D-20261009-1309-01 — wszystkie już włączone do planu).

## Odbiór
- PR scalony; w zmianach brak `src/`, `supabase/`, `scripts/`, `tests/`.
- **Po scaleniu zamknij tę sesję Cursora i otwórz nową** (sesja startowała ze starymi regułami `.cursor/rules`).
- `docs/archiwum/2026-10-08/` ma 279 plików z listy + `stare-instrukcje/` (5 plików); 3 pliki z kwotami w `D:\Watch Tower\dane\archiwum-2026-10-08\`.
- Następne: P0b, potem kolejność z `PLAN.md` §3 (dopisek D-20261008-1646-01).
