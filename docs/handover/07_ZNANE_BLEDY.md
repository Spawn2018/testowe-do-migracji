# 07 · Znane błędy, QA, ryzyka

| Pole | Wartość |
|---|---|
| Data | **2026-09-23** Europe/Warsaw |
| Metoda | `rg`/`Read` src + `docs/qa-start/*` + `PUNKT9*` + `FIX_*` + C1/C3 |
| C6 | dowody utracone → **`docs/evidence/UTRACONE.md`** (nie odtwarzać PNG z `/tmp`) |
| Bez zmian kodu · bez commit |

---

## 1. Trzy ryzyka QA — potwierdzenie (obowiązkowe)

### 1.1 Import harmonogramu kasował tabelę (P9: 72→1, potem 72→73)

| Pytanie | Odpowiedź z dowodem |
|---|---|
| **Czy było 72→1?** | **Tak.** `docs/qa-start/P9_V2_EYE_CLICK.md` #6 **FAIL**: dry-run `+1/−0`, `Zatwierdź` zastąpił 72 wiersze jednym `QA-SCHEDULE-742` (`1/1`). |
| **Czy po naprawie 72→73?** | **Tak.** `P9_RECLICK.md` §1 **PASS**: przed export 72; dry-run `+11/~62/−0`; po commit UI `73/73`, `QA-RECLICK-923` dodany, SG-01 zachowany. `PUNKT9_FULL_QA.md` §additive: one-row smoke `added=1, removed=0`, zachowane 72 + 1. |
| **Naprawa w kodzie?** | `scheduleDryRun.ts`: zawsze `removedIds: []`. `commitImport`: domyślnie ignoruje removals (toast „tryb dopisywania”); `accepted===0` → return; UI `Zatwierdź` **disabled** gdy `accepted===0` (`ScheduleView` · store ~967–997). Także `FIX_FN3B_HOLLOWS.md` FAIL 4. |
| **Czy jest test automatyczny?** | **Nie.** Brak `tests/` · brak `*.spec.ts` / vitest / playwright w `package.json` dla importu. Tylko skrypty QA/Puppeteer ad-hoc (`scripts/punkt9-*.mjs`, smoke) + raporty markdown. |
| **Plik pusty?** | `PUNKT9_FULL_QA` #9: empty XLSX → toast reject, **loads 72 unchanged**. `FINAL_FN3_CLICK` #4: fixture `0/0 OK`, `Zatwierdź` disabled, title „Brak poprawnych wierszy — … baza nietknięta”, liczniki spine nietknięte. Uwaga: toast empty bywa `Nie udało się odczytać XLSX` (PUNKT9 notes) — inny string niż FN3B, baza OK. |
| **Inna kolejność kolumn?** | Parser mapuje **po nazwie nagłówka** (`COLUMN_MAP_DEFAULT` / `readXlsxRows` buduje `obj[header]`), nie po indeksie A/B/C. Przestawienie kolumn przy **tych samych** nagłówkach PL = OK. Przestawione *wartości* bez zmiany nagłówków łapie `WEIGHT_INCONSISTENT` / `IMPLAUSIBLE_QTY` (`scheduleParse.ts`). |
| **Zmienione nagłówki?** | Brak synonimów/aliasów. Inne nazwy kolumn → brak `Wysyłka` → `NO_SHIPMENT_CODE` / accepted↓ → commit zablokowany lub puste added. **Regresja łatwa** przy nowym szablonie KSH — brak testów wariantów nagłówków. |
| **Etap D** | Dodać unit/e2e: empty · +1 merge · złe nagłówki · WEIGHT_INCONSISTENT · disabled commit; golden XLSX w repo. |

**One-liner:** Wipe 72→1 potwierdzony P9_V2_EYE; po fix merge 72→73 (P9_RECLICK/PUNKT9); **brak testów automatycznych**; empty=blocked; kolumny po nazwie; obce nagłówki → reject/0 accepted.

---

### 1.2 Magazyn trwały bez wersjonowania schematu

| Pytanie | Odpowiedź z dowodem |
|---|---|
| **Obecny „numer wersji”?** | Klucz localStorage: **`watch-tower-ui-v6-ready-gate`**. To **nazwa bucketa**, nie pole `version` middleware. |
| **Gdzie sprawdzany?** | Tylko jako `name` w `persist({…})` (`useTowerStore.ts:1394`). **Brak** `version:`, **brak** `migrate:`, **brak** porównywania schematu przy hydracji. |
| **Historia bumpów** | v4-closeout → v5-wf12 → **v6-ready-gate** (`FIX_READY_GATE.md`, `AUDIT_FULL_CHAT`, `FUNCTIONS_UNDER_CLAUDE`) — bump = nowy klucz → stary bucket **ignorowany** → fresh seed. |
| **Użytkownik ze starym stanem pod v6?** | Zustand wczyta JSON z partialize **bez migracji**. Po zmianie kształtu pól (np. nowe wymagane na Load) → możliwy stan „sprzed schematu”: brakujące pola, stare SG-34 READY, stare workflows count, spuchnięty vault `dataUrl`. Objaw: „dziwne” READY/import/docs do wyczyszczenia storage. |
| **Użytkownik z v5 w przeglądarce?** | Stary klucz nieczytany → wygląda jak pierwszy start (seed). Bezpieczniejsze niż partial stale v6. |
| **Etap D** | Dodać `version` + `migrate` (lub bump klucza przy breaking change + dokumentacja „wyczyść localStorage”). |

**One-liner:** Persist name=`watch-tower-ui-v6-ready-gate`, **bez** version/migrate; stary v6 schema = ciche wczytanie; bump nazwy = jedyny reset.

---

### 1.3 Brak pełnego przebiegu 14 prób po P9

| Pytanie | Odpowiedź z dowodem |
|---|---|
| **Co było „14”?** | Macierz `FUNCTIONAL_REQA_STATIC_FN2.md` — **14/14 PASS wiring** (static src under Claude), oraz lista #1–#14 w `PUNKT9_FULL_QA.md` (część szerszej 18). |
| **Chronologia P9** | P9_V2_EYE: wipe FAIL → fix additive → `P9_RECLICK` import PASS / READY FAIL → `P9_RECLICK2_READY` READY SHIP (skupione) → `PUNKT9_FULL_QA` 04:26 CEST **18 obszarów SHIP** (obejmuje import #9 + READY #11 + notę additive). |
| **Czy po dacie napraw był pełny re-run 14 klików na „aktualnej paczce”?** | **Nie jako osobna, powtórzona macierz 14 adversarial click.** Po P9_RECLICK/RECLICK2 kolejne bramy to **skupione** przebiegi: `FINAL_FN3_CLICK` (import no-wipe, camera, …), `FINAL_FN4_CLICK` (eksport XLSX, ZIP, spine, READY spot) — nie pełne 14. `FUNCTIONAL_REQA_STATIC_FN2` 14/14 = **static**, nie pełny click re-run post-fix. |
| **Najbliższy „pełny”** | `PUNKT9_FULL_QA.md` (18) — równoległy/obejmujący naprawy READY + import; **nie** zastępuje jawnego re-run 14 po zamknięciu obu blockerów na finalnym bundlu FN4 (`index-DrIIYTnq.js` vs PUNKT9 `index-D00ZV9dP.js`). |
| **Etap D** | **Tak — pozycja Etap D:** pełny przebieg 14 (lub aktualna lista acceptance) klikami na bieżącej paczce po P9+FN4; zautomatyzować. |

**One-liner:** Po P9 tylko skupione retesty (RECLICK2/FN3/FN4); pełne 14 click na final bundle **nie** udokumentowane → **Etap D**.

---

## 2. C3 — języki (skrót)

Pełny audyt: [`C3_JEZYKI.md`](./C3_JEZYKI.md).

| Metryka | Wartość |
|---|---|
| Klucze PL/EN/SV efektywne | **124** / 124 / 124 |
| Nieużywane w `src` | **47** (m.in. `doc_*`, `sev_*`, część factoring/tab_*) |
| Używane | **77** |
| Hardcoded PL | ~104+ linii z diakrytykami w views/components; StatusPill PL-only; toasty store PL |
| Luki tłumaczeń | EN: brand/clock; SV: 9 EN + 2 PL bez own |

**Priorytet D:** hardcode ≫ toasty ≫ SV overrides ≫ cleanup martwych kluczy.

---

## 3. Top ATRAPA z `02_FASADA.md` (priorytet D)

1. Alternatywy SE ×4 „Wybierz” — toast only (`RisksView`)  
2. Pill `+1h 35 min` — stały string (`LoadDrawer`)  
3. Delty faktury +1240/+600 (`InvoicesView`)  
4. Tasks deadline `18+i*9` (`TasksView`)  
5. Prefs powiadomień — zapis bez filtra (`OptionsView`)  
6. `SAIL_ROWS` pogoda — hardcode (`RisksView`)  
7. DRAWING 100% kompletności (`DocsView`)  
8. Geofence „Próbki”=2  
9. `CorridorMap.leaflet.tsx` + MapLibre public — PORZUCONE  
10. JSONLogic/akcje workflow w runtime — semantyczna atrapa  

Liczniki C1: DZIAŁA 73 · CZĘŚCIOWO 11 · ATRAPA 8 · PORZUCONE 6.

---

## 4. Testy

| Rodzaj | Stan |
|---|---|
| Unit / integration w repo | **brak** katalogu `tests/`; brak vitest/jest/playwright w dependencies |
| Lint | `npm run lint` → oxlint |
| Build | `tsc -b && vite build` — brama CI lokalna |
| Visual baseline | `scripts/baseline.mjs` (C2.2 tooling); pełna matryca C2.3 / pixeldiff C2.4 — wg ETAP_C (Playwright `tests/visual.spec.ts` **jeszcze nie** w repo przy tym audycie) |
| QA click | markdown w `docs/qa-start/` + skrypty Puppeteer w `scripts/` |

---

## 5. Dostępność (a11y)

- Częściowe `aria-label` / `aria-pressed` (spine, topbar, help).  
- Skróty klawiszowe Claude v2 (`App.tsx` · `KeyboardHelp`).  
- **Brak** pełnego audytu WCAG; wiele kontrolek bez nazw dostępnych.  
- Statusy i KPI — kontrast zależny od motywu Claude; nie mierzony formalnie.  
- `prefers-reduced-motion` wymagane w C2.2 baseline — nie jest globalnym defaultem app.

---

## 6. Obsługa błędów

| Obszar | Zachowanie |
|---|---|
| Import XLSX | toast + disabled commit; baza chroniona po P9 |
| TV / AIS | fallback seed + label w UI |
| Vault / ZIP | brak `dataUrl` → stub `.txt` w ZIP (`zipDocs.ts`) |
| Driver token zły | toast HIGH/CRITICAL (`FIX_FN3B`) |
| Workflow run | zawsze notyfikacja; **nie** ewaluuje warunków |
| localStorage quota | residual HOLLOW_* — duże zdjęcia mogą wywalić persist |

Brak globalnego Error Boundary raportującego do Sentry/Axiom (poza MVP CURSOR).

---

## 7. Monitoring / telemetria

**Brak** w makiecie (analytics, APM, log aggregation). Bell = in-app tylko.

---

## 8. Przeglądarki

- QA: Chrome / Chromium (Puppeteer paths `/usr/bin/google-chrome*`).  
- Target: nowoczesny evergreen; **brak** macierzy Safari/Firefox w raportach.  
- HashRouter — OK dla static host (Vercel).

---

## 9. Wydajność

- Seed ~72 loads + vault base64 w localStorage — ryzyko kwoty i wolnej hydracji.  
- Mapa: tick drift ~1.5 s; Leaflet rasters.  
- ExcelJS w main bundle — ciężki parse przy dużym XLSX.  
- Brak oficjalnych pomiarów LCP/INP w docs.

---

## 10. C6 — dowody

`docs/evidence/UTRACONE.md`: `/tmp/wt-*.png` count **0** w dniu 2026-09-23 — **nie odtwarzać**. Zachowane dowody: `docs/qa-start/` (+ mirror `docs/watch-tower/qa-start/`), `docs/evidence/README.md`.

---

## 11. Backlog Etap D (z tego pliku)

1. Pełny re-run **14** klików na final bundle.  
2. Testy importu (empty / merge / nagłówki).  
3. Persist `version`+`migrate` (lub polityka bump).  
4. Domknięcie Top ATRAPA + C3 hardcode.  
5. C2.4 pixeldiff gdy Playwright dostępny.  
