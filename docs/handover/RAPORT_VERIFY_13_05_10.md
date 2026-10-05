# VERIFY-13 — raport weryfikacji (bez zmian w kodzie w trakcie VERIFY)

Data: **2026-10-05 ~13:15** · Europe/Warsaw  
Źródło: `PLAN.md` VERIFY-13; build `npm run build` na `main`/`c2bb800` (+ kolejka).  
Metoda: dist produkcyjny, stylelint, skrypty bundle, wskazanie testów. **Bez** zrzutów z TEST UI (13.8–13.9 oznaczone do ręcznego / Playwright).

| ID | Wynik | Dowód / uwaga | Trafia do B? |
|---|---|---|---|
| **13.1** `--tw-` | **PASS** | 0× `--tw-` w `dist/**/*.css` i `*.js` | — |
| **13.1** system font stack | **PASS** | brak `system-ui`/`-apple-system`/`Segoe UI` w CSS bundla | — |
| **13.1** box-shadow | **INFO** | 15 deklaracji w CSS bundla | monitor |
| **13.1** border-radius >2px | **INFO** | 4 wystąpienia | monitor |
| **13.1** `!important` | **INFO** | 6 w CSS bundla | monitor |
| **13.8–13.9** data/godzina załadunku | **CZEKA LIVE** | `formatLoadPl` = Europe/Warsaw z czasem gdy ISO ma czas; zrzut TEST nie w tym przebiegu | ręcznie / Playwright |
| **13.10** Driver 1 / +48 600… | **PASS** | 0 w JS bundla (i0-prod-guard / skan dist) | — |
| **13.11** ciągi debug | **FAIL** | w `index-*.js`: `permitFits=`, `E4 CLOSED` (literały) | **B-10 / cleanup** |
| **13.12** telefon per rola | **PASS (test)** | SEC-1 / `permissions-phone.test.ts`; SCOPE: naprawione 0076 | — |
| **13.13** `data-theme` w `<html>` | **FAIL** | `index.html`: `data-theme="dark"` zaszyte | **B** (boot z `theme.ts`) |
| **13.15** stylelint | **PASS** | `npm run lint:css` exit 0 | — |
| **13.16** paczka JS | **INFO / OK budżet** | pierwsze wczytanie gzip **362.9 kB** (budżet 400); surowy index JS ~1316 kB; leniwy PDF ~517 kB gz | optymalizacja osobno |
| **16.1** rola Stegra | **PASS (enum)** | `app_role` bez roli klienta „Stegra”; jest `SITE_VIEWER` / org `STEGRA` jako firma placu — nie rola logowania klienta | — |
| **16.4** ceny z DOM per rola | **PASS (test)** | `xlsx-export-roles.test.ts` + `canSeeRevenue`/`canSeeCost` | — |
| **17.1** D23-S | **PASS** | `tests/schedule-import.test.ts` D23-S | — |
| **17.3** kanon design | **PASS** | `design/claude-v2.0/` (`CLAUDE_V2_SOT.md`) | — |
| **17.4 / 17.8 / 11.6** | **PASS (wskazanie)** | `gate:visual` / `tests/visual.spec.ts`; O1 w POSTEP; LOAD-1 w przebiegach importu | — |

## Podsumowanie
- **PASS:** 13.1 (tw/fonts), 13.10, 13.12, 13.15, 13.16 (gzip), 16.1, 16.4, 17.1, 17.3, 17.4/17.8/11.6 (wskazanie).
- **FAIL → kolejka B:** 13.11 (debug strings), 13.13 (data-theme w HTML).
- **LIVE:** 13.8–13.9 (zrzut TEST).

Kod naprawczy 13.11/13.13 wchodzi w PR kolejki B/H (nie w samym VERIFY).
