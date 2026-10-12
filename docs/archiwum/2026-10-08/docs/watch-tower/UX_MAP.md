# WATCH TOWER — mapa UX (makieta klikalna)

> **Split SoT (Sebastian HARD 2026-09-23):**  
> **Visual / layout / menu / shell chrome** = Claude makieta ([`claude-makieta.html`](./claude-makieta.html) + [`VISUAL_BRIEF.md`](./VISUAL_BRIEF.md) + [`VISUAL_ALIGN_CLAUDE.md`](./VISUAL_ALIGN_CLAUDE.md)) — **Barlow + Claude tokens 1:1**.  
> **Modules + workflows + roles + seed + functional acceptance** = **this file**.  
> Prior “don’t copy Barlow / Claude = bar only” is overridden — **do** match Claude look.

Produkt: **WATCH TOWER** (wcześniej TOWER) — multi-party control tower, korytarz do placu **Stegra Boden** (projekt / destination, nie rola app).
Korytarz: **Śrem → Polferries Gdańsk → Nynäshamn → E4 → Stalverket 20 Boden.**
POI (SoT [`ADDRESSES.md`](./ADDRESSES.md)):
- LOADING: `KSH Śrem · Grunwaldzka 27C` (52.07391, 17.02460)
- SITE: `Stegra · Stalverket 20, Boden` (65.80539, 21.75914) — **geofence / miejsce docelowe**, nie persona logowania
Strony (role app): **HHL** (spedytor, pełny dostęp + marża) · **KSH** (klient) · **SCX** (przewoźnik).  
**Stegra NIE jest rolą aplikacji** — brak switchera, nav, dashboardu i first-paint dla Stegra. Podejście/ETA do SITE folduje się w **ograniczony widok dostaw KSH** (approaching/ETA do placu).

Zasada nadrzędna: **management by exception**. Excel = PLAN. Aplikacja = STAN.
Stan transportu = projekcja ze strumienia `load_events` (append-only).

**Visual chrome:** Claude shell (Barlow, tokens, topbar, corridor spine, left nav, panels, KPI grid, drawers) — see VISUAL_BRIEF. Research pack `START_UI_SPEC` / anti-slop notes may still mention Plex; **product override = Claude clone**. This file does not redefine the type system.

---

## 1. Shell aplikacji (zawsze widoczny) — Claude structure

Chrome class names and dimensions match Claude makieta (VISUAL_BRIEF). Functional add-ons (bell, import, collapse toggle) sit **on** that chrome — not a second visual language.

| Strefa | Zawartość (Claude) | Zachowanie |
|---|---|---|
| **`.topbar`** (52 px) | Brand Condensed (`TOWER` / WATCH TOWER) + `#brandSub` (projekt · org), `.roleswitch` + `.seg` **HHL / KSH / SCX**, `.seg` PL/EN/SV, `.iconbtn` theme, **bell + unread** (product), `.clock` Europe/Warsaw | Rola zmienia: nav, KPI, kolumny cen, akcje w drawerze, badge. Bell → **Notification Center** (§1.2) |
| **`.corridor`** spine | Claude stages: `PRE · ZAL · PL · GDA · SEA · NYN · SE · SITE · DONE` (PL: Przygotowanie → … → Boden → Dostarczone); Condensed counts + 3px bars | Klik = filtr listy + mapy; ponowny klik czyści; zero = `.n.zero`. Map to UX spine ids §4.2 |
| **`nav`** (186 px / 56 px) | Glyph + label + `.count` + `.sep`; `aria-current` amber 3px left | Common: `dash` Kokpit · `map` · `sched` · `risk` · `docs`. Money: HHL `fin`+`inv`; KSH `fin` (Rozliczenia); SCX `fin` (Moje stawki)+`inv`. Admin HHL: `wf` · `geo`. SCX: `tasks` (Moje zadania). Hot counts CRITICAL/HIGH / open tasks |
| **`main`** | Aktywny widok Claude (`dash`/`map`/…) | Drawer z prawej (`.scrim` + `.drawer`) |
| **Toast / `.banner`** | Eskalacje workflow, ryzyko promu, brak docs | Klik → transport / Ryzyka / Notification item |

**Drawer** (Claude `.drawer`, width `min(560px,100%)`): zakładki product — Przegląd · Przebieg · Zasoby/Awizacja · Dokumenty · Ceny · Ustalenia · ETA — w `.dtabs` (amber underline). Zakładka **Ceny** wg §5 (ukryta gdy brak uprawnień).

Osobny route poza shellem: **`/driver/:token`** (PWA kierowcy) — bez topbar/nav/spine.

### 1.1 Collapsible nav (Claude responsive + product toggle)

- **Claude:** `@media (max-width:1100px)` → body `56px 1fr`; hide `span.lbl` + `.count`.
- **Product additive:** explicit toggle (nav footer / chevron); `aria-expanded` on nav landmark; persist `sessionStorage.wtNavCollapsed`.
- **Expanded ~186 px** — glyph + label + count. **Collapsed ~56 px** — icon rail; keep badge as count/dot (product: show hot badge even if Claude media-query hid `.count` — prefer visible badges on rail).
- Tooltip / `title` = label when collapsed.
- Body grid: `186px 1fr` ↔ `56px 1fr`.

### 1.2 Bell + Notification Center (functional on Claude chrome)

| Element | Spec |
|---|---|
| **Bell** | Topbar `.iconbtn` (+ unread tabular badge); `aria-haspopup="dialog"` |
| **Panel** | Solid Claude surface panel/drawer ~360–400 px (same language as `.drawer` / `.panel` — **not** a glass redesign) |
| **Lista** | workflow / risk / doc / invoice / system; severity gut opc.; Condensed/tabular ts; unread = stronger ink + surface-2 wash |
| **Klik item** | Deep-link: drawer tab **albo** widok+filtr (Ryzyka CRIT, Faktury DISPUTED, …) |
| **Mark as read** | Klik item **lub** „oznacz jako przeczytane” → badge **−1** |
| **Bulk** | Opc. „Oznacz wszystkie” → unread = 0 |
| **Seed demo** | ≥**5** mixed (§7) |

Typy seed: `workflow` (T-48 docs) · `risk` (CRITICAL ferry) · `doc` (PERIOD expiry) · `invoice` (DISPUTED / MATCHED→factoring) · `system` (SCHEDULE_IMPORTED vN).

---

## 2. Przepływ end-to-end (każdy krok klikalny w makiecie)

```
KSH: Import XLSX (przycisk „Importuj XLSX” LUB drag-drop na drop-zone)
  → mapowanie kolumn → dry-run diff → Zatwierdź
  → SCHEDULE_IMPORTED + wersja + powiadomienia
HHL: Przypisz SCX + cennik → snapshot koszt/przychód/marża
SCX: Zasoby (kierowca E.164, ciągnik, naczepa, pilotaż)
  → Zezwolenie PERIOD / TRIP / REGULATION (permit_fits vs wymiary — blokada mismatch)
  → Awizacja okna + rejs promu
SYSTEM T-48h / T-24h: alert braków (brak pokrycia PERIOD/TRIP) → Notification Center
LOADING geofence (KSH Śrem · Grunwaldzka 27C) → fotki mocowania + CMR
DEPARTED → ETA segmentowe + confidence band
PRE_PORT → alert zdążenia na rejs
FERRY_* → status rejsu / ryzyko fal
PORT_IN Nynäshamn → checkpointy E4
PRE_ARRIVAL (~50 km) → mail KSH ~40 min (mid bandu / conservative — §6.5 E4)
SITE (Stegra · Stalverket 20, Boden — POI) → UNLOADED → zadanie POD 24h
SCX piątek: faktura zbiorcza → 3-way match → HHL Accept/Dispute
  → [HHL only] opcjonalnie factoring po MATCHED (§6.5 E3)
```

---

## 3. Moduły ↔ ekrany (100% zakresu)

| ID | Moduł | Ekrany / interakcje w makiecie |
|---|---|---|
| M1 | Harmonogram | **Primary „Importuj XLSX”** + **drop-zone drag-drop** na tym samym ekranie (oba → ten sam flow); kreator mapowania; dry-run (+/~ /− /⚠); commit; historia wersji |
| M2 | Lista + panel transportu | Tabela ≥60, filtry, search, sort; drawer: timeline events, zasoby, awizacja, czat, docs, pricing |
| M3 | Mapa | Split 60/40, hover sync, focus mode, warstwy (pojazd, ślad, trasa, geofence, prom, SE events, POI), kolory statusu |
| M4 | Geofence | Lista 12+ stref z **nazwanymi POI**: LOADING `KSH Śrem · Grunwaldzka 27C`, SITE `Stegra · Stalverket 20, Boden`, + port Gdańsk, ferry, Nynäshamn, E4 checkpoints, PRE_ARRIVAL ~50 km; edytor (rysuj/okrąg — UI), formularz histerezy/dwell/notify |
| M5 | Pozycje / PWA kierowcy | Osobny route `/driver/:token`: share GPS, 4 milestone, aparat (mock), PL/EN/SV |
| M6 | Dokumenty | Kategorie + deadline; **PermitKind** PERIOD / TRIP / REGULATION; upload PERIOD (valid_from/to, limity, opc. plates/route) → auto-cover; TRIP wymaga `load_id` (+ permit_fits); REGULATION = checklista bez PDF; T-48 brak pokrycia; banner expiry ≤14d; ZIP; mismatch blokuje READY |
| M7 | Cennik / BAF / marża | Macierz przedziałów, BAF/SEFS params, waterfall, flaga poniżej progu; RLS symulowane rolą; **factoring UI nie tu** — po match w M11 (§6.5 E3) |
| M8 | Dashboardy | **HHL / KSH / SCX** — ≤6 KPI + exception queue + panele roli; HHL: audit feed. **Brak dashboardu Stegra.** KSH zawiera panel/KPI approaching/ETA do SITE (fold z dawnego widoku placu) |
| M9 | Workflow | 7 seedowanych reguł, formularz trigger→warunek→akcje, toggle on/off, run log → notifications |
| M10 | Ryzyka | FERRY / ROAD_SE / DOC / OPS; severity; Plan B promów |
| M11 | Faktura zbiorcza + factoring | Kreator tygodnia, expected vs billed, MATCHED/DISPUTED linia po linii; **po MATCHED** (HHL): „Zgłoś do factoringu” — stany NOT_OFFERED→OFFERED→SUBMITTED→FUNDED/REJECTED; fee % + expected payout date; residual tylko HHL; audit na każdej zmianie stanu |
| M12 | ETA | Breakdown segmentów (det. base) + **confidence band** (LOW/MED/HIGH) + ETA point + range earliest–latest + reason chips; odświeżanie przy status/`load_event`; label: heurystyka makiety (nie ML stats) |

### Dashboard — skrót paneli per rola (M8)

| Rola | KPI (max 6) | Panele primary |
|---|---|---|
| **HHL** | Aktywne, ryzyka CRITICAL, OTIF, marża / poniżej progu, docs complete, ryzyko promowe | Exception queue · mapa split · waterfall marży · S-curve · wydajność SCX · audit feed |
| **KSH** | Dostarczone/wszystkie, w drodze, approaching SITE 72 h, opóźnienia, ryzyka dostaw, koszt narastająco (Admin) | Harmonogram ze światłami · mapa · **ETA/approaching do SITE** · timeline montażowy · kalendarz 72 h · docs/POD do pobrania |
| **SCX** | Moje aktywne, zadania wymagane, załadunki 48 h, przychód tyg., status faktur, mój OTIF | Lista zadań · moje transporty+mapa · rejsy · fakturowanie · pogoda/drogi |

> **Uwaga (drop Stegra role):** dawny read-only plac (przyjazdy 72 h / na placu / POD) **nie ma osobnej persony**. Treść ETA→SITE i POD podgląd = część KSH limited delivery view. Zero finansów kierowców u KSH poza macierzą §5.

### 3.1 Reguła: zero dead metrics

**Każdy KPI / tile / spine segment jest actionable.** Klik → filtr listy **albo** otwarcie widoku + konkretny tab/filtr. Brak „ozdobnych” liczb. Mapowanie: §4.2.

---

## 4. Role → nav matrix

W makiecie: przełącznik **3 ról (HHL / KSH / SCX)** — **bez Stegra**. Warianty Admin vs Ops / Dispatch vs User — odzwierciedlone w **akcjach i cenach** (§5), nie w osobnych pozycjach menu (wyjątek: KSH User bez Importu; SCX User bez wystawiania faktury).

| Widok (nav key) | HHL | KSH | SCX | Uwagi |
|---|:--:|:--:|:--:|---|
| Kokpit `dash` | ● | ● | ● | Treść KPI/paneli per rola; wszystkie KPI klikalne (§4.2) |
| Mapa `map` | ● | ● | ● (swoje) | KSH: warstwa approaching SITE OK; bez osobnej „Stegra map” |
| Harmonogram / Lista `sched` | ● | ● | ● (swoje) | KSH Admin: **Importuj XLSX** + drop-zone |
| Ryzyka `risk` | ● | ● (filtrowane) | ● (swoje) | KSH bez szczegółów ops przewoźnika |
| Dokumenty `docs` | ● | ● | ● (swoje) | PERIOD/TRIP/REGULATION wg §6.5 E2; KSH: POD |
| Finanse / Ceny `fin` | ● | ● (przychód) | ● (koszt/„moja stawka”) | HHL: wejście do factoringu po MATCHED |
| Faktury `inv` | ● (Accept/Dispute + factoring) | — | ● (kreator, Dispatch) | Factoring UI tylko HHL |
| Zadania `tasks` | — | — | ● | Primary dla SCX |
| Automatyzacje `wf` | ● | — | — | |
| Strefy `geo` | ● | — | — | Edycja: HHL Admin; Ops = podgląd/🟡 |
| PWA kierowcy | link z drawera | — | link z zasobów | Poza shellem |

**Legenda:** ● = pozycja w nav · — = ukryte.

Badge w nav (widoczne też gdy collapsed):
- `risk` — liczba otwartych CRITICAL+HIGH (hot)
- `tasks` (SCX) — otwarte zadania z deadline
- `inv` — faktury DISPUTED / do akceptacji (+ HHL: SUBMITTED factoring)
- `wf` — reguły ON (informacyjnie)
- Topbar **bell** — unread notifications (nie mylić z nav badges)

### 4.2 KPI / tile / spine → target (actionable map)

Reguła: **no dead metrics.** Builder musi zaimplementować klik dla każdego id poniżej.

#### Corridor spine (wszystkie role z listą+mapą)

| Segment id | Target |
|---|---|
| `spine.plan` | Lista+mapa filter `stage=PLAN` |
| `spine.loading` | filter `stage=LOADING` / geofence LOADING |
| `spine.to_port` | filter `stage=TO_PORT` / PRE_PORT |
| `spine.ferry` | filter `FERRY_*` (status/stage ferry) |
| `spine.se_road` | filter `stage=SE_ROAD` / PORT_IN→checkpoints |
| `spine.approach` | filter `PRE_ARRIVAL` / approaching SITE |
| `spine.site` | filter `SITE` / na placu (`Stegra · Stalverket 20`) |
| `spine.delivered` | filter `DELIVERED` / UNLOADED done |

Ponowny klik segmentu = clear filter. Sync lista ↔ mapa.

#### HHL KPI tiles

| KPI id | Label (PL) | Target |
|---|---|---|
| `hhl.kpi.active` | Aktywne | `sched` lista filter `active=true` |
| `hhl.kpi.risk_crit` | Ryzyka CRITICAL | `risk` severity=`CRIT` (+HIGH jeśli badge hot łączy) |
| `hhl.kpi.otif` | OTIF | `sched` filter `otif_flag` / delivered window |
| `hhl.kpi.margin_below` | Marża poniżej progu | `sched` lista filtered `margin_flag=below` (+ opc. tab Ceny w drawerze po wyborze wiersza) |
| `hhl.kpi.docs_complete` | Docs complete | `docs` lub `sched` filter `docs_incomplete` (klik wartości „braki” → incomplete) |
| `hhl.kpi.ferry_risk` | Ryzyko promowe | `risk` type=`FERRY` |

Exception queue row → drawer loadu (Przegląd); Audit feed row → deep-link event.

#### KSH KPI tiles

| KPI id | Label (PL) | Target |
|---|---|---|
| `ksh.kpi.delivered` | Dostarczone / wszystkie | `sched` filter delivered vs all |
| `ksh.kpi.in_transit` | W drodze | `sched` filter in-transit stages |
| `ksh.kpi.approach_72h` | Approaching SITE 72 h | `sched`+mapa filter `PRE_ARRIVAL`/`approach` w 72 h **do SITE POI** |
| `ksh.kpi.delays` | Opóźnienia | `sched` filter `delay_flag` |
| `ksh.kpi.delivery_risk` | Ryzyka dostaw | `risk` filtrowane do dostaw KSH |
| `ksh.kpi.cost_ytd` | Koszt narastająco (Admin) | `fin` przychód/koszt KSH Admin |

#### SCX KPI tiles

| KPI id | Label (PL) | Target |
|---|---|---|
| `scx.kpi.my_active` | Moje aktywne | `sched` swoje active |
| `scx.kpi.tasks_open` | Zadania wymagane | `tasks` open |
| `scx.kpi.loads_48h` | Załadunki 48 h | `sched` filter loading window ≤48 h |
| `scx.kpi.revenue_week` | Przychód tyg. | `fin` / week filter |
| `scx.kpi.invoice_status` | Status faktur | `inv` |
| `scx.kpi.my_otif` | Mój OTIF | `sched` OTIF własne |

---

## 5. Widoczność cen (summary — RLS w produkcie, w makiecie: hide by role)

| Pole | HHL Admin | HHL Ops | KSH Admin | KSH User | SCX Dispatch | SCX User |
|---|:--:|:--:|:--:|:--:|:--:|:--:|
| Koszt (stawka SCX) | ✅ | ✅ | ❌ | ❌ | ✅ (swoja) | ❌ |
| Przychód (stawka KSH) | ✅ | ✅ | ✅ | 🟡 | ❌ | ❌ |
| Marża / % / waterfall | ✅ | 🟡 konfig. | ❌ | ❌ | ❌ | ❌ |
| BAF (strona kosztowa) | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| BAF (strona przychodowa) | ✅ | ✅ | ✅ | 🟡 | ❌ | ❌ |
| Expected vs billed (faktura) | ✅ | ✅ | ❌ | ❌ | ✅ (swoja) | ❌ |
| Factoring (fee %, residual, payout) | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |

W makiecie: kolumny tabeli + zakładka Ceny + KPI marży/kosztu **znikają**, nie są zamazane. Po przełączeniu roli natychmiastowy re-render bez „flash” wartości. **Factoring residual / fee — wyłącznie HHL** (nigdy KSH / SCX).

---

## 6. Primary user journeys (ścieżki klikalne)

### 6.1 HHL Ops — poranek (exception-first)

1. Login → **Kokpit** (dark default). Banner jeśli krytyczne ryzyko promu; **bell** z unread ≥1.
2. **Exception queue** → sort severity × czas do skutku → klik wiersza (wiersz zawsze pokazuje **next action** — VISUAL_BRIEF ExceptionRow).
3. Otwiera się **drawer** transportu (Przegląd): status, owner, next action, severity gut.
4. Zakładka **Przebieg** — timeline `load_events`; brak zdarzenia = wyjątek nadal otwarty.
5. Jeśli brak docs → **Dokumenty** / banner `permit_fits`.
6. Jeśli marża poniżej progu → KPI `hhl.kpi.margin_below` **lub** flaga na wierszu → lista filtered + zakładka **Ceny** (waterfall).
7. Corridor spine: klik **Prom** → filtr listy tylko FERRY_* → mapa sync.
8. Nav **Ryzyka** → Plan B rejsu → toast „powiadom SCX” (mock) + item w Notification Center.
9. Nav **Faktury** (piątek) → linia DISPUTED → Accept/Dispute.
10. Bell → Notification Center → mark as read → badge −1.

### 6.2 KSH — import harmonogramu

1. Rola KSH Admin → kokpit/lista w **light default** → **Harmonogram**.
2. **Import:** primary button **„Importuj XLSX”** **oraz** **drop-zone** (drag-drop pliku) na tym samym ekranie — oba wchodzą w **ten sam** flow mapowanie → dry-run → commit.
3. Upload (symulacja pliku) → **mapowanie kolumn** (szablon zapamiętany).
4. **Dry-run diff**: dodane / zmienione / usunięte / ⚠ critical date na awizowanym.
5. Zatwierdź → toast „SCHEDULE_IMPORTED vN” + wpis w historii wersji + notification system.
6. Powrót do listy: nowe kody Wysyłka widoczne; transport z critical change ma badge.
7. Kokpit KSH: KPI dostarczone/tonaż; **approaching SITE 72 h**; panel **timeline montażowy** z flagą rozjazdu kolejności.
8. Klik transportu zbliżającego się do SITE → drawer ETA; brak zakładki Ceny z kosztem/marżą.

### 6.3 SCX — uzupełnienie zasobów (T−48 h)

1. Rola SCX → **Zadania** (primary): „SG-14: brak nr naczepy, deadline 6 h”.
2. Klik → drawer **Zasoby**: kierowca, tel E.164, ciągnik, naczepa, pilotaż, wymiary zestawu.
3. Upload zezwolenia → jeśli mismatch wymiarów: **blokada** + banner `permit_fits` (nie da się ustawić READY).
4. Awizacja: okno czasowe + wybór rejsu promu.
5. Zapis → event w timeline; zadanie znika z kolejki / badge−1; opc. notification clear.
6. Nav **Faktury** (Dispatch, piątek): kreator tygodnia → expected vs billed → submit → status W_WERYFIKACJI.

### 6.4 Kierowca — PWA

1. Otwiera `/driver/:token` (mobile viewport w makiecie).
2. Język PL/EN/SV; duże CTA: **Udostępniaj pozycję**.
3. Cztery milestone: ZAŁADOWANY / NA PROMIE / ROZŁADOWANY / PROBLEM (+ opcjonalnie aparat mock).
4. Po milestone → w shellem (inna rola) w timeline pojawia się nowy `load_event` z timestampem.
5. Brak cen, brak listy innych transportów, brak nav control-tower.

---

## 6.5 Elite journeys (ścieżki klikalne — rozszerzenie)

Look: Claude pills/panels in [`VISUAL_BRIEF.md`](./VISUAL_BRIEF.md) (ConfidencePill, PermitKind, FactoringStatus, AuditTrail, NotificationCenter as `.pill` / solid panels — **match Claude**, no new hues, no glass KPI).

### E1 — Exception → Action → Audit

**Cel:** każda primary akcja na wyjątku zostawia niezmienialny ślad. ExceptionRow **zawsze** pokazuje next action (VISUAL_BRIEF).

1. HHL (dark) → Kokpit → **Exception queue** → wiersz z severity gut (np. CRITICAL ferry / DOC) + next action verb.
2. Klik → **drawer** (Przegląd): next action, severity, owner.
3. Primary CTA (jedna z): **Eskaluj SCX** · **Plan B ferry** · **Poproś o docs**.
4. Potwierdzenie (inline / mini-modal) + opcjonalny reason code.
5. System append-only:
   - `load_event` (np. `ESCALATED` / `PLAN_B_SELECTED` / `DOC_REQUESTED`) — actor, ts, reason
   - `audit_log` entry (to samo + payload akcji)
6. **Toast** + **Notification Center** item z deep-linkiem do transportu / zdarzenia.
7. Ponowne otwarcie → zakładka **Przebieg**: event widoczny (AuditTrail row: ts mono · actor · action).
8. Kokpit HHL → panel **audit feed**: ten sam wpis.

**Acceptance:** każda primary exception action → immutable trail w Przebieg + Audit feed; ExceptionRow bez next action = FAIL.

### E2 — Permit PERIOD vs TRIP vs REGULATION

**Źródło reguł:** [`PERMIT_ATTACHMENT_RULES.md`](./PERMIT_ATTACHMENT_RULES.md). Flow: SCX lub HHL → Dokumenty / drawer Docs.

| Kind | UX | READY gate |
|---|---|---|
| **PERIOD** | Upload PDF + `valid_from`/`valid_to` + limity L/W/H/masa + opc. plates/route → status **aktywne**; loads z `load_date` ∈ okna i zestaw ≤ limity = auto-cover (bez ponownego uploadu) | Brak pokrycia PERIOD na T-48 → alert; expiry ≤14d → banner |
| **TRIP** | Upload + **obowiązkowy** link `load_id` (lub multi-window V); `permit_fits` vs set dimensions | Mismatch / brak linku → **blokada READY** |
| **REGULATION** | Brak PDF (TSFS 36/37); checklista (oznakowanie, varningsbil…) przed READY | Checklist incomplete → blokada READY |

**Seed (min.):** ≥1 PERIOD pokrywający kilka loadów · ≥1 TRIP per-load · ≥1 REGULATION checklist · ≥1 PERIOD expiry warning (≤14d) · ≥1 permit mismatch.

**Badge UI:** PermitKind `PERIOD` | `TRIP` | `REGULATION` (VISUAL_BRIEF).

### E3 — Factoring (HHL cash / invoice advance)

**Zakres uczciwy:** mock UI + state machine. **Bez** prawdziwego API factora.

1. HHL → **Faktury** / Finanse: linia lub batch tygodnia w stanie **MATCHED** (lub po Accept sporu) → toggle/flaga **„Zgłoś do factoringu”**.
2. Maszyna stanów: `NOT_OFFERED` → `OFFERED` → `SUBMITTED` → `FUNDED` | `REJECTED`.
3. UI (tylko HHL): expected payout date · fee % (mock) · **residual** (kwota po fee) — **nigdy** widoczne dla KSH / SCX.
4. Każda zmiana stanu → `audit_log` + opc. `load_event` / invoice event; AuditTrail w feedzie HHL.
5. **Nie zastępuje** M11 3-way match — factoring **siedzi po MATCHED** (lub po accepted dispute resolution).

**QA gate:** stany tylko HHL; post-MATCHED; hide residual dla KSH/SCX. Factoring nadal **HHL-only** vs KSH/SCX (bez osobnej roli Stegra).

### E4 — Predictive ETA with confidence

**Drawer → zakładka ETA (M12 elite).**

1. **Base deterministic** (segmenty — jak ROZMOWA): do Gdańska + wait + ferry + clearance + Nynäshamn→Boden + driver rests (561/2006).
2. **Confidence band** per total + per segment: `LOW` / `MED` / `HIGH` (opc. % + band). Heurystyka makiety — **nie** wymyślać accuracy ML.
3. Visual: ETA **point** + range bar earliest–latest (mono tabular) · ConfidencePill · reason chips (`ferry schedule locked` · `GPS fresh` · `weather risk` · `silent vehicle` …).
4. Spadek confidence (ferry risk / silent GPS) → może otworzyć **exception row**.
5. **PRE_ARRIVAL mail do KSH:** przy confidence ≥ MED → **mid bandu**; przy LOW → **latest (conservative edge)**. Udokumentowane tu — builder nie zgaduje.
6. Odświeżanie przy zmianie statusu / nowym `load_event`.

**Label w UI:** „Heurystyka makiety” / „confidence (mock)” — nie „AI accuracy 94%”.

---

## 7. Seed danych (wymagane)

- **≥60 loads** (mix kodów Wysyłka: SG / T / K / R / P / D)
- **3 org** × użytkownicy demo: HHL · KSH · SCX (**bez** konta / tokenu roli Stegra)
- **12+ geofence korytarza** (nazwy z [`ADDRESSES.md`](./ADDRESSES.md) + segmenty):
  1. **LOADING** — `KSH Śrem · Grunwaldzka 27C` (52.07391, 17.02460)
  2. Droga PL → port (segment)
  3. **PORT_OUT** — Terminal Polferries Gdańsk
  4. **FERRY** — leg morski Gdańsk–Nynäshamn
  5. **PORT_IN** — Terminal Nynäshamn
  6–10. **CHECKPOINT E4** — Södertälje · Gävle · Sundsvall · Umeå · Luleå (lub równoważne nazwane)
  11. **PRE_ARRIVAL** — bufor ~50 km przed SITE
  12. **SITE** — `Stegra · Stalverket 20, Boden` (65.80539, 21.75914) — **place only**
- 7 workflow (seed z ROZMOWA §7)
- rate cards + BAF/SEFS (koszt i przychód osobno)
- ryzyka mieszane (CRITICAL / HIGH / MEDIUM) — FERRY, ROAD_SE, DOC, OPS
- dokumenty: mix kompletności + seed E2 (PERIOD multi-cover, TRIP, REGULATION, expiry ≤14d, mismatch)
- ≥1 faktura MATCHED + 1 DISPUTED; ≥1 ścieżka factoring (OFFERED/SUBMITTED/FUNDED) tylko w seed HHL
- ≥1 transport z critical date change po imporcie
- ≥1 load z confidence LOW + reason chips (ferry/silent)
- PWA token dla ≥1 aktywnego loadu
- **≥5 notifications** mixed (workflow / risk / doc / invoice / system); część unread dla demo bell badge

---

## 8. Kryteria akceptacji makiety

1. Każdy punkt nav (dla danej roli) otwiera działający widok — nie stub. Role switcher = **tylko HHL / KSH / SCX** (brak Stegra jako roli).
2. Każdy transport otwiera drawer z zakładkami i ≥1 akcją zmieniającą stan / event.
3. Przełączenie roli ukrywa/pokazuje marżę, koszt, przychód zgodnie z §5 — bez flash.
4. **Import:** zarówno przycisk **„Importuj XLSX”**, jak i **drag-drop** na drop-zone wchodzą w mapowanie → dry-run → commit; commit dodaje wersję i event.
5. Workflow toggle + „Uruchom teraz” generuje notification/task (widoczne w Notification Center).
6. Faktura 3-way match zmienia status linii / nagłówka.
7. PWA driver milestone dopisuje `load_event` widoczny w timeline.
8. ≥60 transportów w tabeli i na mapie (cluster).
9. PL/EN/SV bez śmierci UI (brak uciętych labeli w nav/KPI); nav collapsed ~56 px — label nie wymagany, tooltip OK.
10. Zero martwych przycisków w primary flows (§6 + §6.5).
11. Corridor spine filtruje listę i mapę dwukierunkowo; każdy segment klikalny (§4.2).
12. **Theme first paint:** HHL + SCX = dark; **KSH = light**; **brak** first-paint Stegra. Toggle motywu dostępny dla wszystkich.
13. **Elite E1:** primary exception action → widoczny `load_event` + `audit_log` w Przebieg i Audit feed (actor, ts, reason); ExceptionRow zawsze ma next action.
14. **Elite E2:** PERIOD auto-cover w oknie vs TRIP wymagany link `load_id` vs REGULATION checklista; mismatch/expiry/T-48 zgodnie z seedem.
15. **Elite E3:** factoring tylko HHL; stany NOT_OFFERED→…→FUNDED/REJECTED; wyłącznie post-MATCHED; residual/fee ukryte dla **KSH/SCX** (HHL-only vs inne role app).
16. **Elite E4:** ETA pokazuje point + confidence band + range + reason chips per segment; label heurystyka; PRE_ARRIVAL mail = mid (≥MED) / latest (LOW).
17. **Named POI:** geofence LOADING/SITE etykiety = `KSH Śrem · Grunwaldzka 27C` / `Stegra · Stalverket 20, Boden` (zgodne z ADDRESSES.md); topbar/korytarz: Śrem → Polferries Gdańsk → Nynäshamn → E4 → Stalverket 20 Boden. Stegra = **place/geofence only**.
18. **Collapsible nav:** expanded ~186 px / collapsed ~56 px; persist session; badges widoczne na rail; `aria-expanded` poprawne.
19. **Bell → Notification Center:** unread badge; klik item = deep-link; **mark as read clears** ten item (badge −1); opc. „oznacz wszystkie”; seed ≥5 mixed.
20. **Zero dead tiles:** każdy KPI / tile / spine segment nawiguje lub filtruje per §4.2 — brak ozdobnych metryk.
21. **Visual = Claude makieta:** Barlow + Barlow Condensed; Claude light/dark tokens; shell (topbar 52 · corridor stages · nav glyphs/counts/sep · panels · flush 3-col KPI · drawer); solid-first surfaces; ink-invert `.seg`; squint-match [`claude-makieta.html`](./claude-makieta.html) / VISUAL_BRIEF §0. IBM Plex-as-primary or soft SaaS card KPI = FAIL.

---

## 9. Poza zakresem makiety (nie budować)

- Prawdziwe API telematyki / rFMS (stub OK)
- KSeF, Stripe, dwukierunkowy SharePoint
- OCR dokumentów, React Flow builder workflow
- Osobne konta Auth — wystarczy role switch (**3 role**)
- Osobna persona / login **Stegra** (plac pozostaje POI w ADDRESSES.md)
- **Prawdziwy API factora** — tylko mock state machine (E3)
- Claimy accuracy ML na ETA — tylko heurystyka makiety (E4)
