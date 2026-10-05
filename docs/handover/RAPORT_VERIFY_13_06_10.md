# VERIFY-13 — raport weryfikacji (06.10.2026)

Data: **2026-10-06 00:50–01:15** Europe/Warsaw · `main` = `e5d4eba` (po BAF PROGNOZA, PR #131, 0189).
Zastępuje wstępny raport `RAPORT_VERIFY_13_05_10.md` (05.10, bez zrzutów i bez testu ról w DOM).
Zasada: **bez zmian w kodzie**. Każdy punkt, który nie przechodzi, trafia do części B w `PLAN.md`.

## Metoda
- `npm run build` (produkcyjny, exit 0) → skan `dist/assets/*` (CSS i JS); dodatkowo skan paczki **produkcji** `watch-tower-makieta.vercel.app` (CSS ten sam hash `index-QRaSZu-M.css`).
- `npm run lint:css`, `npm run size`, vitest (9 plików, 66/66: `permissions-phone`, `xlsx-export-roles`, `schedule-import` (D23-S), `i0-prod-guard`, `o2-prod-strip`, `theme-role`, `i18-plan-dates`, `time`, `stylesheet-mockup`).
- Playwright na buildzie demo (`VITE_AUTH_MODE=demo`, podgląd :4183, `now=2026-10-06T08:00Z`): role HHL / KSH / SCX, **każdy widok z menu** danej roli → skan tekstu strony, kolumny harmonogramu w DOM, zrzuty. Strefy przeglądarki: Europe/Warsaw, UTC, America/New_York. Skrypt: `tmp/verify13/v13.spec.ts` (poza repo, `tmp/` w .gitignore).
- Baza: odczyt (SELECT) produkcji przez pooler i TEST — enum ról, użytkownicy, organizacje, uprawnienia kolumn `loads.driver_*`, funkcja `load_driver_contacts()`.

## Wyniki

| ID | Wynik | Dowód | Do B? |
|---|---|---|---|
| **13.1** `--tw-` | **PASS** | 0 w `dist/**/*.css` i `*.js`; 0 w CSS produkcji | — |
| **13.2** systemowy stack czcionek | **PASS** | brak `system-ui` / `-apple-system` / `Segoe UI` / `BlinkMacSystemFont` / `ui-sans-serif` w CSS i JS. Jest tylko zapas `"Barlow","Helvetica Neue",Arial,sans-serif` (tokeny `--font-sans`, `--wt-font-ui`) oraz `.leaflet-container` z CSS biblioteki Leaflet (nadpisane na Barlow) | — |
| **13.3** box-shadow / promienie / `!important` | **PASS (liczby)** | `box-shadow`: 17 deklaracji, z czego 13× `none`; 4 cienie wyłącznie w kontrolkach Leaflet (`.leaflet-bar`, `-control-layers`, `-popup`, `-tooltip`). Promień > 2 px: 4 (`4px`, `5px`, `12px` — Leaflet; `3px` — Leaflet tooltip) + 10× `50%` (kropki statusu / przełączniki — koła, nie zaokrąglone karty). `!important`: 6 — wszystkie z CSS Leaflet. **Kod aplikacji: 0 cieni, 0 promieni > 2 px poza kołami, 0 `!important`** (SCOPE 05.10: 10 / 5 / 1) | — |
| **13.8** godzina załadunku | **PASS** | harmonogram: godziny 08:00 / 07:00 / 06:00 (z okien), nie „02:00 wszędzie”; **identyczne** w Europe/Warsaw, UTC i America/New_York → konwersja przez `TZ_LOAD_PL`, niezależna od strefy przeglądarki. Brak okna → „–” (B-8.11, bez zgadywania). Zrzuty: `zrzuty_verify13/harmonogram_{HHL,KSH,SCX}_Europe_Warsaw.png` | — |
| **13.9** format daty | **PASS (wg późniejszej decyzji)** | tabela: `30.09.2026 08:00` — bez przecinka. SCOPE 13.9 chciał „30.09 06:00”, ale **B-8.3 (05.10)**: „data w harmonogramie zawsze z rokiem” (`formatSchedTableDay`) — decyzja właściciela zastępuje wzór bez roku | — |
| **13.10** dane zastępcze | **PASS** | 0× „Driver 1”, „+48 600 000 000” (też `600-000-000`), „PSE 1000” w paczce lokalnej, w paczce produkcji i w tekście **wszystkich widoków** 3 ról | — |
| **13.11** ciągi debug | **PASS** | 0× `permitFits`, `E4 CLOSED`, `CANCELLED`, `undefined`, `NaN`, `[object Object]`, `null`, `TODO/FIXME/DEBUG` w tekście widoków (HHL 10 widoków, KSH 8, SCX 9). **Korekta raportu 05.10:** jego „FAIL” to fałszywy alarm — `permitFits=` w JS to porównanie `o.permitFits===!1` w kodzie, nie tekst w UI; `E4 CLOSED` już nie występuje | — |
| **13.12** telefon kierowcy per rola | **PASS** | UI: HHL / KSH / SCX widzą telefon (decyzja I-7a; test `permissions-phone` 5/5). Role **bez** uprawnienia — w bazie produkcji: `authenticated` nie ma SELECT na `loads.driver_name/driver_phone/driver_delivery_*` (uprawnienia kolumnowe), `anon` bez SELECT na `loads`; `load_driver_contacts()` zwraca 0 wierszy dla `SITE_VIEWER` i kont nieaktywnych | — |
| **13.13** `data-theme` w `<html>` | **PASS** | `index.html` i HTML produkcji: `<html lang="pl">` bez `data-theme`; po starcie: system jasny → `light`, ciemny → `dark` (Q-9 B). **Korekta raportu 05.10** (wtedy FAIL — naprawione w Q-9) | — |
| **13.15** stylelint | **PASS** | `npm run lint:css` exit 0 | — |
| **13.16** paczka JS | **PASS / INFO** | pierwsze wczytanie **369,3 kB gzip** (budżet 400; 05.10: 362,9) — surowo 1 411,8 kB (główny `index` 1 337 kB vs „2,0 MB” w SCOPE). Leniwe: PDF 499,5 kB gz, exceljs 253,9 kB gz. Zapas do budżetu 30,7 kB — monitorować | monitor |
| **16.1** rola Stegra | **PASS** | enum `user_role` (PROD = TEST): HHL_ADMIN, HHL_OPS, CLIENT_ADMIN, CLIENT_USER, CARRIER_DISPATCH, CARRIER_USER, SITE_VIEWER. Użytkownicy PROD: HHL 7, KSH 4, SCX 3; 0 z rolą/organizacją „Stegra”; organizacje: HHL, KSH, SCX | — |
| **16.4** ceny usuwane z DOM per rola | **PASS** | DOM harmonogramu (73 wiersze): HHL `cost/rev/margin` = 73/73/73; KSH = 0/73/0 (sama cena); SCX = 73/0/0 (sam koszt). Elementy z `filter: blur` = 0. Eksport XLSX: `xlsx-export-roles` 7/7 | — |
| **17.1** import XLSX (D23-S) | **PASS** | `tests/schedule-import.test.ts` (D23-S) zielony w tym przebiegu | — |
| **17.3** jeden kanon w `design/` | **PASS (uwaga)** | `design/` zawiera tylko `claude-v2.0/` (`CLAUDE_V2_SOT.md`). Poza `design/`: identyczna kopia `docs/watch-tower/claude-v2.0/` oraz stara `claude-makieta.html` w `public/` i `docs/watch-tower/` (na produkcji 404) | B-VERIFY-17.3 (P3) |
| **17.4** pełny przebieg (O1) | **WSKAZANIE / FAIL obecnie** | O1 `1742b03` (26.09) — pełny komplet. **Dziś** zestaw smoke Playwright nie przechodzi: wszystkie 8 specyfikacji (`visual`, `visual-states`, `e2e-core`, `etap4/5/6-ui`, `d19-i18n`, `d-eur-t`) klikają `#langSeg`, a przełącznik języka usunięto w `8322d02` (05.10 16:03, „bez języka i zegara”). `scripts/ci/fresh-smoke.sh` → exit 1 (pierwszy test: „lang btn not found: PL”); `e2e-core` 5/5 ✘ (timeout na `#langSeg`) | **B-SMOKE-LANG (P1)** |
| **17.8** brama pikselowa (gate:visual) | **WSKAZANIE / FAIL obecnie** | mechanizm jest: `scripts/visual/gate.sh` (smoke + stany + matryca 840, próg 0,1 %). Ostatnie przebiegi nocne: 04.10 **OK 840/840**, 05.10 **FAIL 720/840** (120 zmienionych, przed `8322d02`). Do czasu B-SMOKE-LANG brama zawsze czerwona | **B-SMOKE-LANG** + klasyfikacja 120 ujęć |
| **11.6** wydajność (LOAD-1) | **PASS (wskazanie)** | `scripts/load1-stress.mjs`, POSTEP: 140 transportów, 20 użytkowników / 3 role — kokpit p50 386 ms, harmonogram 319 ms, mapa 88 ms; I-8 `642d68f` (350 transportów) | — |

## Uwagi do zrzutów
- Zrzuty są z buildu **demo** (dane przykładowe, zamrożony zegar), nie z bazy TEST — w TEST nie ma kont (`app_users` = 0), a logowanie na produkcji nie jest częścią weryfikacji bez zmian. Formatowanie idzie przez tę samą funkcję (`formatSchedTableDay`, `TZ_LOAD_PL`) co na produkcji.
- Pola filtra dat w nagłówku harmonogramu pokazują w headless Chromium `mm/dd/yyyy` — to natywne `<input type="date">` w ustawieniach regionalnych przeglądarki, nie format aplikacji (w przeglądarce PL: `dd.mm.rrrr`). Bez pozycji B; do potwierdzenia na telefonie/PC właściciela przy B-SMOKE-LANG.

## Podsumowanie
- **PASS:** 13.1, 13.2, 13.3, 13.8, 13.9 (wg B-8.3), 13.10, 13.11, 13.12, 13.13, 13.15, 13.16 (budżet), 16.1, 16.4, 17.1, 17.3 (z uwagą), 11.6.
- **FAIL (obecny stan) → część B:**
  - **B-SMOKE-LANG (P1)** — 8 specyfikacji Playwright i `fresh-smoke` / `gate:visual` czerwone po usunięciu `#langSeg` (`8322d02`). Naprawa po stronie testów: boot bez klikania języka (PL jedyny), usunąć lub wyłączyć `d19-i18n` / warianty `sv`/`en` w matrycy 840, odświeżyć wzorzec tylko z przyczyną (G4). Potem nocna brama i jeden pełny przebieg (17.4/17.8).
  - **B-VERIFY-17.3 (P3)** — usunąć kopie poza `design/` (`docs/watch-tower/claude-v2.0/`, `claude-makieta.html` w `public/` i `docs/watch-tower/`) albo opisać je jako archiwum.
- **Monitor:** 13.16 — zapas 30,7 kB do budżetu 400 kB gz.
- **Zmian w kodzie: 0.** PR tylko z dokumentami.
