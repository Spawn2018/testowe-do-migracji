> **Nieaktualne (etap makiety, 23.09).** Aktualny punkt wejścia: [`PRZEKAZANIE_CURSOR.md`](./PRZEKAZANIE_CURSOR.md) (28.09).

# 01 · Handover — architektura i uruchomienie

| Pole | Wartość |
|---|---|
| Data | **2026-09-23** Europe/Warsaw (UTC+2) |
| App | `/workspace/watch-tower-app` |
| Baseline | commit `305da3e` · tag `baseline-2026-09-23` |
| Zakres | Etap C — baza wiedzy; **bez** zmian kodu produktu; **bez commit** |
| Języki (C3) | szczegóły → [`C3_JEZYKI.md`](./C3_JEZYKI.md) |

---

## 1. Co to jest

**WATCH TOWER / TOWER** — klikalna makieta SPA (control tower, nie TMS) dla korytarza ponadgabarytowego PL→SE:

**KSH Śrem (Grunwaldzka 27C)** → droga PL → **Polferries Gdańsk** → prom → **Nynäshamn** → E4 → **Stegra · Stalverket 20, Boden**.

Role UI: **HHL | KSH | SCX** (Stegra = SITE/POI, nie login). Stan w **Zustand + localStorage**. Brak backendu produkcyjnego w makiecie.

Stack faktyczny ≠ plan Claude (`CURSOR_PROMPT`): tu **Vite + React 19 + TS + Tailwind 4 + Zustand + Leaflet + HashRouter**. MapLibre w `public/` = leftover (PORZUCONE). Docelowy Next/Supabase — poza makietą.

---

## 2. Architektura runtime

```
Browser (HashRouter)
├── #/              → TowerShell (Zustand `view`)
│   ├── Topbar / Nav / CorridorSpine / Toasts / LoadDrawer
│   └── views/*     (dash|map|sched|risk|docs|fin|inv|tasks|wf|geo|options)
└── #/driver/:token → DriverPwa

Zustand store (persist partial → localStorage)
├── seed: loads/events/docs/risks/… z `src/data/seed.ts` + JSON
├── mutacje: import, READY, Plan B, faktury, WF, geofence, …
└── lib/*: pricing, SEFS, ETA, permits, schedule*, ferry, ais, TV

Opcjonalne wywołania zewnętrzne (dev middleware / proxy)
├── POST /api/trafikverket  → TV Situation (klucz serwerowy) lub seed
├── ws://host:4175/ais      → AISStream proxy (klucz serwerowy) lub seed
└── Esri tile CDN           → basemap Leaflet (bez klucza)
```

**Przepływ danych (skrót):**

1. `main.tsx` → `App.tsx` montuje shell + store.  
2. `buildSeedLoads()` (62 z `loads.json` + 10 extras ≈ **72**) + ryzyka/docs/invoices.  
3. UI czyta selektory/`useTowerStore`; klik → mutacja store → re-render (+ toast/bell).  
4. Import KSH: XLSX → `xlsxRead` → `parseSchedule` → `dryRunFromXlsx` → UI diff → `commitImport` (additive).  
5. Ceny: wymiary → `matchRate` + `sefsForLoadDate` → `buildPricing` (próg marży 12%).  
6. Mapa: `progress` + Turf `along(corridor_ref)` (+ sztuczny drift); AIS/TV osobno.

Zamrożenie zegara (C2.1): `?now=` / `VITE_FROZEN_NOW` → `src/lib/frozenNow.ts`.

---

## 3. Drzewo plików (istotne)

| Ścieżka | Opis |
|---|---|
| `src/main.tsx` · `App.tsx` | Bootstrap, HashRouter, skróty klawiszowe |
| `src/store/useTowerStore.ts` | Jedyny store (~1420 LOC); persist `watch-tower-ui-v6-ready-gate` |
| `src/types/index.ts` | Encje: Load, Risk, Document, Invoice, Geofence, … |
| `src/data/seed.ts` | Generator seedu + RATE_*/BAF_PARAMS + workflows |
| `src/data/loads.json` | 62 ładunki bazowe (KSH) |
| `src/data/corridor_ref.json` | LineString referencyjny (≠ ORS legal) |
| `src/data/scx-rates-base.json` · `sefs-tables.json` | Cennik SCX EUR + tabele SEFS |
| `src/data/ferry-sailings.json` · `permits-*.json` | Seed promu / zezwoleń |
| `src/lib/pricing.ts` · `sefs.ts` · `scxRates.ts` | Wycena + SEFS hybrid |
| `src/lib/eta.ts` | ETA odcinkowe (heurystyka godzin) |
| `src/lib/scheduleParse.ts` · `scheduleDryRun.ts` · `xlsxRead.ts` · `xlsxExport.ts` | Import/eksport harmonogramu |
| `src/lib/permits.ts` | READY gate / klasyfikacja PL·SE |
| `src/lib/ais.ts` · `trafikverket.ts` · `ferry.ts` | Integracje live\|seed |
| `src/lib/permissions.ts` | Nav + cost/rev/margin + can* |
| `src/lib/frozenNow.ts` | Clock freeze screenshotów |
| `src/i18n/messages.ts` | Słownik PL/EN/SV (patrz C3) |
| `src/components/shell/*` | Topbar, Nav, Spine, Bell, Toasts, KeyboardHelp |
| `src/components/map/CorridorMap.tsx` | **Aktywna** mapa Leaflet + Esri |
| `src/components/map/CorridorMap.leaflet.tsx` | Duplikat **nieimportowany** (PORZUCONE) |
| `src/components/drawer/LoadDrawer.tsx` | Szuflada 5 zakładek |
| `src/views/*` | 12 widoków + DriverPwa |
| `scripts/baseline.mjs` | C2.2 generator zrzutów (narzędzie) |
| `scripts/ais-proxy.mjs` · `start-ais-proxy.sh` | Proxy AIS :4175 |
| `vite.config.ts` | Middleware TV + proxy `/map-proxy/carto` |
| `docs/handover/*` | Baza wiedzy Etap A–C |
| `docs/watch-tower/` | SoT design/research (kopia) |
| `docs/evidence/UTRACONE.md` | C6 — utracone `/tmp/wt-*.png` |
| `design/claude-v2.0/` | Kanoniczny visual SoT (koordynator; C5 w `06_WYGLAD`) |
| `public/maplibre-*` · `map-styles/` | Leftover MapLibre |

---

## 4. Uruchomienie lokalne

```bash
cd /workspace/watch-tower-app
npm i
npm run dev          # Vite — domyślnie http://127.0.0.1:5173/
npm run build && npm run preview   # często :4173; QA/docs używają :4177
npm run ais-proxy    # ws://localhost:4175/ais (wymaga AISSTREAM_API_KEY)
npm run baseline     # C2.2 zrzuty (Puppeteer); preferuj DRY_RUN=1
npm run lint         # oxlint
```

| Port / URL | Rola |
|---|---|
| **5173** | `vite` dev (domyślny; brak `server.port` w config) |
| **4173 / 4177** | `vite preview` — w raportach QA często wymuszony **4177** |
| **4175** | AIS WebSocket proxy |
| Vercel | `https://watch-tower-makieta.vercel.app/` (`00_KONTEKST`) |

Zamrożony zegar (reprodukowalne UI):

```
http://127.0.0.1:5173/#/?now=2026-09-23T14:32:00Z
# lub VITE_FROZEN_NOW=2026-09-23T14:32:00Z
```

Driver demo: `#/driver/demo-active` · `#/driver/demo-sg14` (SG-14 / load-020).

---

## 5. Env / klucze

| Zmienna | Gdzie | Efekt braku |
|---|---|---|
| `TRAFIKVERKET_API_KEY` lub `VITE_TRAFIKVERKET_API_KEY` | serwer (middleware `/api/trafikverket`) | JSON `{mode:'seed', demo:true}` |
| `AISSTREAM_API_KEY` | **tylko** `scripts/ais-proxy.mjs` | pozycje seed (MMSI Wawel/Nova Star) |
| `VITE_AIS_WS_URL` | klient opcjonalnie | domyślnie `ws://<host>:4175/ais` |
| `VITE_MAPTILER_KEY` | docs/README (MapLibre) | **stale względem runtime** — aktywna mapa = Esri, nie MapTiler |
| `ORS_API_KEY` | research/START_API_NOTES | nieużywane w SPA jako SoT trasy |
| `VITE_FROZEN_NOW` | klient | wall clock |

**Nie** umieszczać `AISSTREAM_API_KEY` w bundlu klienta. Szczegóły API → [`04_INTEGRACJE.md`](./04_INTEGRACJE.md) + `docs/watch-tower/START_API_NOTES.md`.

---

## 6. Powiązane pliki handover

| Plik | Treść |
|---|---|
| `00_KONTEKST.md` | Etap A — intencja, decyzje, integracje |
| `02_FASADA.md` | C1 — DZIAŁA / ATRAPA / PORZUCONE |
| `C3_JEZYKI.md` | **C3** — 124 klucze, 47 nieużywanych, hardcoded PL |
| `03_PARAMETRY_BIZNESOWE.md` | Stawki, SEFS, factoring, progi |
| `04_INTEGRACJE.md` | Wywołania zewnętrzne |
| `05_DANE_I_LOGIKA.md` | Encje, formuły, stan |
| `07_ZNANE_BLEDY.md` | Ryzyka QA (import wipe, persist, 14 prób) |
| `08_MANIFEST.md` · `09_INDEKS_WIEDZY.md` | Etap B / C4 |

