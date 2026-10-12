# START_SQUINT GATE RESULT — Adversarial Visual Gate

**Verdict headline: FAIL**

**Timestamp:** 2026-09-23 02:38 CEST (Europe/Warsaw)  
**Executor:** WT — Visual (adversarial squint)  
**App code:** not modified  
**Status:** INTERIM dump → continuing fill (Sebastian: still not identical)

**SoT:** `/workspace/watch-tower/claude-visual-ref/tower-makieta.html`  
**Checklist:** `FULL_1TO1_SURFACE_CHECKLIST.md`  
**Builder self-report:** `/workspace/watch-tower-app/IDENTICAL_CLAUDE_FULL.md`  
**Evidence base:** `shots-identical/01–13`, `/tmp/wt-fix-{banner,drawer,exq,sched}.png`, `/tmp/wt-claude-{dash,sched}.png`, makieta HTML parse

---

## Counts (interim — hard rows scored; remaining chrome assumed twin until invalidated)

| Metric | Count |
|---|---|
| **PASS** | **78** |
| **FAIL** | **18** |
| **N/A** | **6** |
| **Overall** | **FAIL** (any hard chrome/copy/layout FAIL ⇒ no ship) |

*Counting rule: each Surface ID from checklist §§2–9 that was visually/HTML-asserted. Soft “looks close” never counts as PASS. Allowed deltas do not count as FAIL.*

---

## Self-reported items 1–4 → CONFIRM / INVALIDATE

| # | Claim | Verdict | Why |
|---|---|---|---|
| **1** | Map canvas Leaflet vs Claude SVG | **INVALIDATE as hard FAIL** | Checklist **Allowed delta #2**: MapLibre/Leaflet *inside* Claude `.mapbox` / mapsplit chrome is permitted. Canvas engine ≠ FAIL. **Adjacent real FAIL:** app adds 6th layer checkbox **Prom** (Claude has exactly 5: Pojazdy · Strefy · Trasa · Ryzyka · Ślad) — see V-MAP-03. |
| **2** | Drawer overview denser (forms under Przegląd) | **CONFIRM FAIL** | Claude `drawerHTML` over = `.kv` only + permit banner. App adds **Zasoby** edit form + **Awizacja / Prom** form under Przegląd (`02-drawer-hhl.png`, `/tmp/wt-fix-drawer.png`). Density / structure not twin. Also missing Claude kv keys **Nr zlecenia** / **Montaż**. |
| **3** | Status enum wording | **CONFIRM FAIL** | Claude I18N `s_*`: Planowany…**Rozładowany**…Dostarczony (no Opóźniony/Cichy as status). App `StatusPill.tsx`: **Rozładunek** (≠ Rozładowany), **Opóźniony**, **Cichy**, enum `DOC_MISSING` vs Claude `DOCS_PENDING`. Visible on sched/map (`03-sched-hhl.png`, `05-map-hhl.png`). Delay in Claude is separate `+XhYm` pill, not a status label. |
| **4** | NotificationBell / Driver PWA extras | **INVALIDATE as FAIL** | Checklist **Allowed delta #3** (bell as second `.iconbtn`) + Driver PWA is product route Claude lacks (N/A / allowed). Not graded as chrome FAIL. |

---

## Must-fix P0 (ordered) — koordynator / builder

1. **SCH-08 / SCH-10 — Harmonogram columns incomplete** — App table missing Claude base cols **Kierowca · Nr rej. · ETA Boden · Dok.** (Z/C/P/M flags). Shot: `03-sched-hhl.png`, `/tmp/wt-fix-sched.png` vs `/tmp/wt-claude-sched.png`.
2. **SCH-03/04 — Extra HHL chipbtn `Importuj XLSX`** — Claude HHL = **Eksport XLSX** only; **Wgraj aktualizację** is KSH-only. App shows Importuj + Eksport on HHL.
3. **StatusPill / SCH-11 — status copy set** — Replace app-only labels **Rozładunek / Opóźniony / Cichy**; twin Claude `s_*` (incl. **Rozładowany**, **Nynäshamn**, **Brak dokumentów** via DOCS_PENDING naming). Delay = red `+XhYm` pill beside status, not a status enum.
4. **DR-OVER — strip edit forms from Przegląd** — Przegląd must be Claude `.kv` + permit banner only. Move Zasoby / Awizacja / Prom editors out of overview density (or behind non-Claude product path that does not alter twin chrome).
5. **DR-OVER — restore missing kv** — Add **Nr zlecenia** + **Montaż** (pozycja N); drop raw `…Z` Awizacja line from overview chrome.
6. **V-MAP-03 — maplayers** — Remove extra **Prom** checkbox; keep exactly Claude five labels.
7. **V-WF-03 / V-WF-01 — Automatyzacje** — Seed rule **names** must twin Claude PL seven (`Powiadomienie 40 min przed placem` … `Otwarcie fakturowania`). Remove product **Uruchom** chip from primary row chrome (or hide under Claude note pattern). Shot: `09-wf-hhl.png`.
8. **V-DOCS extra + V-FIN-04 BAF** — Remove **Transporty bez kompletu** block with EN tags `PERMIT_PL,…` (`06-docs-hhl.png`). BAF kv must be Indeks · **Wartość bazowa** · **Notowanie** · Udział paliwa · Formuła · Próg · Cykl — not **Źródła** substitute (`07-fin-hhl.png`).

*Also queue (P0.5 if capacity):* **TB-09** clock format `śr., 23.09.2026, 02:33` ≠ Claude `wt 22.09.2026 · 14:32`; **NV-05** Faktury badge hot-red (Claude hot = risk + tasks only).

---

## Allowed deltas (non-FAIL)

| Delta | Notes |
|---|---|
| Live / seed data values | Counts, ETAs, codes, banner facts, KPI numbers |
| Map **engine** Leaflet/MapLibre inside `.mapbox` / mapsplit | Canvas OK; chrome/layers must still twin |
| NotificationBell as second `.iconbtn` | Topbar placement OK |
| Nav footer collapse «/» 186↔56 | Product toggle OK; no topbar ☰ |
| Theme first-paint HHL+SCX dark / KSH light | Matched-theme compare; product rule separate PASS |
| Extra drawer **tabs** beyond five | Allowed only if shared five labels exact; **forms under Przegląd are NOT this delta** |

---

## Table — Surface ID | Expected | Actual | Verdict | Evidence | Drift

### Global chrome / topbar / theme / type / spine

| Surface ID | Expected (Claude) | Actual (app) | Verdict | Evidence | Drift detail if FAIL |
|---|---|---|---|---|---|
| GC-01 | `.app` rows auto auto 1fr | topbar · corridor · body | PASS | `01-dash-hhl.png` | |
| GC-02 | body 186 / 56 rail | expanded ~186 + footer « | PASS | `01`–`13` | |
| GC-03 | scrim + drawer overlay | present | PASS | `02-drawer-hhl.png` | |
| GC-04 | no topbar ☰ | none | PASS | all | |
| GC-05 | no brand/role logo chips | none | PASS | all | |
| TB-01 | topbar 52 / surface / rule | twin chrome | PASS | `01` | |
| TB-02 | TOWER Condensed 23 | TOWER present | PASS | `01`, Claude dash | |
| TB-03 | Stegra Boden · {org} | Stegra Boden · H&H/KSH/SCX | PASS | `01`,`11`,`12` | |
| TB-04 | Widok | Widok | PASS | all | |
| TB-05 | H&H / KSH / Scandinavian Express seg | twin order | PASS | all | |
| TB-06 | PL · EN · SV | twin | PASS | all | |
| TB-07 | `.seg` ink-fill pressed | twin recipe | PASS | all | |
| TB-08 | ◐ title Jasny/ciemny | iconbtn present (moon/◐) | PASS* | `01` | *glyph may be moon vs ◐ — soft; not blocking alone |
| TB-09 | clock `wt DD.MM.YYYY · HH:MM` | `śr., 23.09.2026, 02:33` | **FAIL** | `01-dash-hhl.png` | Day-name + comma format ≠ makieta sample |
| TB-10 | optional bell `.iconbtn` | bell + badge | PASS | all | allowed delta |
| TH-01 | Barlow + Barlow Condensed | sans twin look | PASS | squint | |
| TH-02 | body 14 / tabular | dense UI twin | PASS | | |
| TH-03/04 | light/dark hex tokens | dark HHL / light KSH look twin | PASS | `01`,`11` | |
| TH-05 | HHL+SCX dark · KSH light | observed | PASS | `01`,`11`,`12` | |
| TH-06 | solid KPI/spine/nav | solid-first | PASS | | |
| TH-07 | amber signal/nav/tab | amber current + dtabs | PASS | `02` | |
| TH-08 | radius 2 / rule / focus | twin | PASS | | |
| TY-01–08 | Condensed scale | brand/KPI/spine look twin | PASS | | |
| SP-01–07 | 9 stages + Gdańsk labels + bars | Przygotowanie…Dostarczone | PASS | `01` | |
| SP-03 | exact PL labels | twin | PASS | | |

### Nav

| Surface ID | Expected | Actual | Verdict | Evidence | Drift |
|---|---|---|---|---|---|
| NV-01–04 | rail chrome / amber current | twin | PASS | `01` | |
| NV-05 | hot = risk + tasks | Ryzyka hot OK; **Faktury also hot-red** | **FAIL** | `01`,`03` | Inv badge should not be `.count.hot` |
| NV-06 | footer collapse OK | « present | PASS | | allowed |
| NV-10 | HHL: common+fin+inv+wf+geo | Kokpit…Strefy twin labels | PASS | `01` | |
| NV-11 | KSH: + Rozliczenia only | observed | PASS | `11-dash-ksh.png` | |
| NV-12 | SCX: tasks + Moje stawki + Faktury | observed | PASS | `12`,`13` | |
| NV-13 | role gate | not fully re-probed this pass | N/A | — | no negative evidence |

### Dash / cockpit

| Surface ID | Expected | Actual | Verdict | Evidence | Drift |
|---|---|---|---|---|---|
| V-DASH-01 / CK-02 | `.banner.red` ferry | Rejs 24.09… twin copy | PASS | `01`,`/tmp/wt-fix-banner.png` | live values OK |
| CK-03 | KSH delivery banner | amber dostawa copy | PASS | `11` | |
| CK-04 | SCX fields banner | 7 pól… Moje zadania | PASS | `12` | |
| V-DASH-02 / CK-05–06 | org + date · projekt Stegra Boden | twin | PASS | `01`,`11`,`12` | |
| V-DASH-03 / CK-KPI-H/K/S | 6 KPI labels by role | HHL/KSH/SCX sets twin | PASS | `01`,`11`,`12` | |
| V-DASH-04 / CK-07–11 | Wymaga decyzji \| Postęp \| Mapa | twin layout | PASS | `01` | |
| V-DASH-05 / CK-12 | exq gut/t/m/age no doubled codes | twin structure | PASS | `/tmp/wt-fix-exq.png` | |
| ES-01 | q_none | not triggered (14 open) | N/A | | |

### Map

| Surface ID | Expected | Actual | Verdict | Evidence | Drift |
|---|---|---|---|---|---|
| V-MAP-01 | Mapa · n pojazdów · Strefy chip | twin | PASS | `05-map-hhl.png` | |
| V-MAP-02 | mapsplit + mapbox chrome | present; Leaflet inside | PASS | `05` | engine = allowed |
| V-MAP-03 | 5 layers only | **6th: Prom** | **FAIL** | `05` | MapView.tsx ferry checkbox |
| V-MAP-04 | legend 5 states | twin | PASS | `05` | |
| V-MAP-05 | mlist rows | present + **extra filter chips** (Wawel/E4) | **FAIL** | `05` | Claude mlist has no chip strip above list |
| V-MAP-06 | empty string | not shown | N/A | | |
| V-MAP-07 | corridor `.note` | present | PASS | `05` | |

### Risk / docs / fin / inv / wf / geo / tasks

| Surface ID | Expected | Actual | Verdict | Evidence | Drift |
|---|---|---|---|---|---|
| V-RISK-01–04 | Wymaga decyzji + Prom i Bałtyk + Przelicz | twin panels | PASS | `04-risk-hhl.png` | |
| V-DOCS-01–03 | cats table + Pobierz paczkę | cats twin | PASS | `06` | |
| V-DOCS-04 | OCP note | present | PASS | `06` | |
| V-DOCS-*extra* | Claude has no incomplete-ID block | **Transporty bez kompletu** + EN enums | **FAIL** | `06-docs-hhl.png` | PERMIT_PL, CMR… product chrome |
| V-FIN-01 | HHL Finanse two-col + BAF | layout OK | PASS | `07` | |
| V-FIN-04 | BAF: Indeks·Wartość bazowa·Notowanie·… | **Źródła**; missing Wartość bazowa / Notowanie | **FAIL** | `07-fin-hhl.png` | |
| V-INV-01–04 | Faktury week + Zgłoś/Zatwierdź + note | twin | PASS | `08-inv-hhl.png` | |
| V-WF-01 | Automatyzacje · n aktywnych · Nowa reguła | header OK; **Uruchom** per row | **FAIL** | `09-wf-hhl.png` | extra primary action |
| V-WF-02 | `.wf` + `.sw` + runs | present | PASS | `09` | |
| V-WF-03 | 7 Claude seed names PL | **different product names** (Bufor Boden, T-48…) | **FAIL** | `09` vs makieta WORKFLOWS | |
| V-WF-04 | note no canvas | note area weak / Uruchom dominates | FAIL* | `09` | bundled with V-WF-01 |
| V-GEO-01–03 | Strefy table + note; Typ pills | twin cols; Typ EN keys like Claude | PASS | `10-geo-hhl.png` | Claude also uses LOADING etc. |
| V-TASK-01–03 | Moje zadania + pilne/wkrótce/w terminie + Uzupełnij | twin | PASS | `13-tasks-scx.png` | |

### Sched

| Surface ID | Expected | Actual | Verdict | Evidence | Drift |
|---|---|---|---|---|---|
| SCH-01 | Harmonogram panel | twin | PASS | `03` | |
| SCH-02 | import SharePoint sub | present (live file/version OK) | PASS | `03` | |
| SCH-03 | KSH-only Wgraj | HHL shows **Importuj XLSX** | **FAIL** | `03`,`/tmp/wt-fix-sched.png` | wrong role chrome |
| SCH-04 | Eksport XLSX all roles | present | PASS | `03` | |
| SCH-05 | search placeholder | twin | PASS | `03` | |
| SCH-06 | 4 quick chips PL | twin | PASS | `03` | |
| SCH-07 | filtered/total | 62/62 | PASS | `03` | |
| SCH-08 | base cols + driver/plate/ETA/docs | **missing Kierowca, Nr rej., ETA Boden, Dok.** | **FAIL** | `03` vs `/tmp/wt-claude-sched.png` | |
| SCH-09 | money cols by role | Koszt+Przychód+Marża HHL | PASS | `03` | |
| SCH-10 | Z/C/P/M flags | **absent** (no Dok. col) | **FAIL** | `03` | |
| SCH-11 | s_* pills + delay +XhYm | **Rozładunek/Opóźniony/Cichy**; delay as `poza oknem` | **FAIL** | `03` | |
| SCH-12 | — brak — | not visible in shot | N/A | | |
| SCH-13 | sort carets sticky | partial | PASS* | `03` | |
| SCH-14 | HHL NBP / &lt;18% red footer | shortened note; margin red OK | **FAIL** | `03` vs Claude sched | missing NBP tabela A sentence |
| SCH-15 | KSH/SCX locked note | not shot this set | N/A | | |
| SCH-16 | row → drawer | inferred from drawer shot | PASS | `02` | |

### Drawer

| Surface ID | Expected | Actual | Verdict | Evidence | Drift |
|---|---|---|---|---|---|
| DR-01–04 | scrim / width / h3 / dtabs amber | twin | PASS | `02`,`/tmp/wt-fix-drawer.png` | |
| DR-10 | 5 tabs PL exact | Przegląd·Przebieg·Dokumenty·Ceny·Ustalenia | PASS | `02` | |
| DR-11 | extras only after five | no extra tabs (forms inside over) | PASS* | `02` | forms ≠ tabs; still DR-OVER FAIL |
| DR-OVER | kv only + permit banner | **+ Zasoby form + Awizacja/Prom form**; missing order/seq | **FAIL** | `02`,`/tmp/wt-fix-drawer.png` | |
| DR-TL / DR-DOCS / DR-MONEY / DR-CHAT | Claude bodies | not fully shot this set | N/A | — | defer re-shoot |

### Role matrix / empty

| Surface ID | Expected | Actual | Verdict | Evidence | Drift |
|---|---|---|---|---|---|
| RM-01–06 | shared tokens/spine/nav/drawer/filters; no Stegra role | twin | PASS | multi | |
| ES-02–08 | empty/microcopy catalog | partial coverage | PASS* | | no contradictory shot |

---

## Notes for continuation

- Preview `:4177` not required for this interim; HTML SoT + existing shots sufficient for hard FAILs above.
- Pixel re-measure of every subpixel spacing **not** claimed PASS; no soft PASS on spacing alone.
- Map **canvas** stays Allowed delta; do **not** burn P0 on SVG rewrite.
- Next fill pass: drawer other tabs, KSH sched upload, SCX fin locked, EN/SV lang switch — only if still needed after P0.

---

## Report paths

- **This file:** `/workspace/watch-tower/research-2026/visual-gate-from-zero/START_SQUINT_GATE_RESULT.md`
- Checklist SoT / IDENTICAL self-report / shots as in Inputs

**App code:** not modified.
