# WATCH TOWER — Elite upgrade checklist (QA gate)

Źródło: oficjalny QA SPA **INCOMPLETE** (50 loads, brak PERMIT_ATTACHMENT_RULES w kodzie, Stegra PII, martwe warstwy mapy) + zakres elite (100–200 loads, predykcje, real API, visual).
Rola QA: **adversarial** — każdy punkt musi mieć dowód klik/kod; `ACCEPTANCE.md` nie jest dowodem.

Status: **STANDBY** — po komendzie START Sebastiana: review każdego sprintu vs ta lista.

---

## 0. Baseline blockers (must-fix zanim „elite”)

| ID | Bloker | Dowód FAIL dziś | Definition of Done |
|---|---|---|---|
| B1 | Loads &lt; 60 | `loads.json` = 50; claim 62 fałszywy | ≥60 w tabeli + mapie; ACCEPTANCE/README zgodne z live |
| B2 | PERMIT_ATTACHMENT_RULES niezaimplementowane | `attachmentKind` inert; brak `cover()` | PERIOD/TRIP/REGULATION działają per reguły |
| B3 | Stegra PII | drawer: driverName/phone; search po kierowcy | Stegra: zero imienia/telefonu/tablic; mapa bez warstwy kierowców |
| B4 | Map layers no-op | trail/ferry/seEvents toggle bez renderu | Render albo usunięcie z UI + claimów |
| B5 | Geofence draw stub | „klik-circle” = banner | Rysowanie/okrąg na mapie zapisuje geometrię |
| B6 | Fake import dry-run | hardcode SG-99 | Dry-run z realnego parse/diff pliku lub uczciwy label „symulacja” + ścieżka danych |
| B7 | SV i18n niepełne | ~73 vs 97 kluczy PL | Parity PL/EN/SV bez fallback EN na krytycznych CTA |
| B8 | themeManual persist | psuje first-paint per rola | HHL+SCX dark / KSH+Stegra light przy świeżej sesji |
| B9 | Sub-role brak | jeden RoleId | KSH User bez Import; SCX User bez faktury; HHL Ops margin 🟡 |
| B10 | sequenceRisk = 0 | brak seed | ≥1 transport z flagą rozjazdu kolejności widoczną u KSH |

---

## 1. Data volume elite (100–200)

| ID | Kryterium | PASS gdy |
|---|---|---|
| D1 | 100–200 loads w seed/SoT | Licznik tabeli = N, N∈[100,200]; mapa nie pada |
| D2 | Mix kodów Wysyłka | SG/T/K/R/P/D (lub uzgodniony kanon) — nie tylko SG/T/SS |
| D3 | ≥1 Kratownice W=3.6 | Seed + klasyfikacja IV/V + SE dispens + pilot |
| D4 | ≥1 PERIOD aktywny pokrywający wiele loads | Auto-OK docs bez re-upload |
| D5 | ≥1 TRIP per-load | Wymagany plik; brak → blokada READY |
| D6 | ≥1 REGULATION/TSFS checklist | Brak PDF; checklista przed READY |
| D7 | Performance | Scroll/filtr/spine &lt; jank przy N=200 (subiektywny FAIL jeśli UI „zamarza”) |
| D8 | Cluster mapy | Przy N≥60 widoczne clustery; klik expand |

---

## 2. M1–M12 elite gates

### M1 Harmonogram
- [ ] Upload → mapowanie (szablon) → dry-run +/~/−/⚠ → commit → wersja + SCHEDULE_IMPORTED
- [ ] Critical date na awizowanym → powiadomienie SCX z diff
- [ ] Historia wersji klikalna

### M2 Lista + drawer
- [ ] Wszystkie taby; ≥1 akcja stanu → `load_event` w timeline
- [ ] Zasoby E.164 walidacja; awizacja okno; rejs promu
- [ ] Ceny hide-not-blur wg roli

### M3 Mapa
- [ ] Split ~60/40; hover sync; focus
- [ ] Warstwy: pojazd, ślad, trasa, geofence, prom, SE events, POI — **każda coś zmienia w DOM/SVG**
- [ ] Cluster + status colors
- [ ] (Elite) MapLibre/tiles opcjonalnie — nie claimować jeśli SVG only

### M4 Geofence
- [ ] ≥12 stref; edytor rysuj/okrąg; hystereza/dwell/notify zapis
- [ ] gf-01 Śrem, SITE Stalverket zgodne z adresami

### M5 PWA
- [ ] `/driver/:token` poza shellem
- [ ] Share GPS + 4 milestone → event w tower
- [ ] Aparat → mock doc w docs (nie tylko UI local)
- [ ] PL/EN/SV

### M6 Dokumenty + permits
- [ ] `cover(PERIOD)` / link TRIP / checklist REGULATION z PERMIT_ATTACHMENT_RULES
- [ ] `permitFitsCheck` użyty (nie hardcode SG-07)
- [ ] T-48 brak pokrycia; PERIOD expiry ≤14d alert
- [ ] Mismatch blokuje READY **przed** statusem READY/UNLOADING

### M7 Cennik / SEFS / marża
- [ ] SEFS hybrid min(mult_sek, mult_pln); ferry eco osobno
- [ ] Waterfall HHL-only; role matrix §5
- [ ] (Elite) kursy/źródła oznaczone; brak zmyślonych % „redukcji”

### M8 Dashboardy
- [ ] HHL/KSH/SCX/Stegra ≤6 KPI + exception queue
- [ ] Stegra: zero finance, zero PII
- [ ] KSH sequence risk widoczny gdy seeded

### M9 Workflow
- [ ] 7+ reguł; formularz; toggle; **Uruchom teraz** → toast + run log
- [ ] (Elite) Run tworzy też task entity u SCX gdy akcja = task

### M10 Ryzyka
- [ ] FERRY/ROAD_SE/DOC/OPS; Plan B; severity
- [ ] (Elite) progi sztormowe konfigurowalne — nie jako „fakt armatora”

### M11 Faktury + factoring
- [ ] MATCHED/DISPUTED; Accept/Dispute zmienia status
- [ ] Factoring: HHL offer → SCX select → Accept → payoutStatus SCHEDULED
- [ ] (Elite) fee%/delay edge cases (disabled offer, 0%, wysoki fee)

### M12 ETA
- [ ] Breakdown segmentów; update przy statusie nie tylko ×0.92
- [ ] (Elite) predykcja / confidence oznaczone jako model vs deterministyczne

---

## 3. Predykcje (elite)

| ID | Gate | FAIL jeśli |
|---|---|---|
| P1 | ETA predictive vs deterministic rozróżnione w UI | Jedna liczba bez źródła |
| P2 | Exception prediction (T-48 risk score) | Magiczne % bez metody |
| P3 | Sequence / montaż risk | Brak seed + brak detekcji |
| P4 | Każda predykcja ma: input, założenie, „nie jest gwarancją” | Marketingowe claimy |

---

## 4. Real API (elite)

| ID | Gate | PASS gdy |
|---|---|---|
| A1 | Telematics adapter | Stub oznaczony `[DO WERYFIKACJI]` albo żywy kontrakt |
| A2 | NBP / SEFS źródła | URL + zapisany snapshot; fail-soft |
| A3 | Trafikverket / Polferries | Parse lub honest mock z labelką |
| A4 | Auth magic link / RLS story | Opisane; makieta nie udaje RLS w samym UI |
| A5 | Idempotent cron/webhook story | Dokument + kod handlery idempotentne jeśli obecne |
| A6 | Żadne zmyślone endpointy | Brak hardcodowanych „udananych” API bez flagi mock |

---

## 5. Visual elite (z VISUAL_BRIEF)

| ID | Gate |
|---|---|
| V1 | Anti-slop: nie Barlow-as-default / nie indigo SaaS blobs |
| V2 | Dense command center; ink + steel + signal accent |
| V3 | Tabular nums; ostre 2–4px; corridor spine operacyjny |
| V4 | Exception gut severity czytelny |
| V5 | Dark HHL/SCX, light KSH/Stegra first paint |
| V6 | Reduced-motion respektowane |

---

## 6. Sprint review protocol (po START)

Na każdy sprint:
1. Diff / URL / co miało wejść
2. Checklist subset PASS/FAIL z dowodem (screenshot lub line)
3. Regresje vs poprzedni sprint
4. Czy `ACCEPTANCE.md` znów kłamie — jeśli tak, **FAIL procesu**
5. Werdykt sprintu: **SHIP** / **FIX** / **BLOCK**

Nie blokować researchu (WT — Research / Visual) — QA recenzuje dowozy, nie wstrzymuje discovery.

---

## 7. Aktualny stan (pre-START)

**Overall makiety: INCOMPLETE**  
Mocne: shell, spine, role nav (bez PII Stegra), SEFS, factoring E2E, PWA→timeline, M9 run, hide-not-blur.  
Słabe: volume, permits engine, Stegra PII, map stubs, fake dry-run, i18n SV, ACCEPTANCE honesty.

---

## 8. Click verification (4174) — deltas vs static

Date: 2026-09-23 · URL: http://127.0.0.1:4174/

| # | Click | Notes |
|---|---|---|
| 1 Nav | PASS | HHL/KSH/SCX/Stegra populated |
| 2 Drawer mutate | PASS | Depart/READY; timeline events |
| 3 Hide prices | **FAIL** | SCX DOM: fuel/cost + „Przychód tyg. 78k”; KSH: „Koszt narast. (rev)” — nie hide-not-blur |
| 4 Import | PASS | upload→map→dry-run→commit (symulacja) |
| 5 Workflow run | PASS | Uruchom teraz + toast |
| 6 Invoice+factoring | PASS | MATCHED/DISPUTED; FACTORING·SCHEDULED |
| 7 Driver→event | **FAIL** | SG-07 link → token `demo-active` = **SG-14**; event na złym loadzie |
| 8 ≥60 | **FAIL** | 50 baseline; po imporcie 52 |
| 9 i18n | PARTIAL | EN/SV residual PL (stref, Nowa klik-circle…) |
| 10 Dead CTAs | PASS* | primary OK; Set READY disabled = permit mismatch |
| 11 Spine | PASS | Prom filtr 6; 2. klik clear |
| 12 Theme | PASS | HHL/SCX dark, KSH/Stegra light |

Dodatkowy regres: **pełna nawigacja resetuje mutacje do seed** (stan nie persistuje w sesji SPA).

Nowe baseline blockers z klików:
- B11 Role pricing leak (KPI/finance copy widoczne poza macierzą)
- B12 Driver token↔load mismatch
- B13 Session state reset on navigation

---

## 9. UX_MAP elite acceptance #13–17 + §6.5 E1–E4 (gate update)

FAIL jeśli:
- brak audytu po exception action
- PERIOD/TRIP/REGULATION źle podpięte
- factoring widoczny poza HHL lub przed MATCHED
- ETA bez confidence band
- LOADING/SITE bez etykiet Śrem/Boden

VISUAL components required: PermitKind · ConfidencePill · FactoringStatus · AuditTrail


---

## 10. START requirements (Sebastian) — post-GO gates

Dodane 2026-09-23 po komendzie START. Każdy sprint buildera jest recenzowany vs §0–§9 **oraz** poniżej.

| ID | Wymaganie | PASS gdy | Sprint-0 (pre-builder) |
|---|---|---|---|
| S1 | **Mapa live** | MapLibre/tiles lub równoważny live basemap + pozycje; nie sam dekoracyjny SVG corridor | **FAIL** — SVG only; MapLibre „optional later” |
| S2 | **Glass** | Glass/morphism per VISUAL (panele/drawer) — nie generyczny flat bez briefu | **FAIL** — brak glass w Topbar/CSS |
| S3 | **No Stegra** | Brak roli/nav Stegra w makiecie (projekt Stegra Boden może zostać w copy) | **FAIL** — `ROLES` zawiera STEGRA; dash/map/sched |
| S4 | **Bell** | Dzwonek powiadomień w topbar; klik → lista; unread badge; deep-link do load/view | **FAIL** — `notifications` w store, **brak UI bell** w Topbar |
| S5 | **DnD import** | Harmonogram: drag-and-drop pliku XLSX (nie tylko file picker) | **FAIL** — brak onDrop/drag w ScheduleView |
| S6 | **KPI deep-links** | Każdy KPI tile klik → filtrowany widok / exception / lista | **FAIL** — KpiTile bez onClick; tylko 2 osobne przyciski w dash |

Sprint protocol unchanged: **SHIP / FIX / BLOCK**.
