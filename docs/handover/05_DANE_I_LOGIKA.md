# 05 · Dane i logika

| Pole | Wartość |
|---|---|
| Data | **2026-09-23** Europe/Warsaw |
| Źródła | `types/` · `seed.ts` · `store` · `lib/{pricing,eta,status,permits,schedule*,permissions}` |
| Bez zmian kodu |

---

## 1. Encje (model)

| Encja | Kluczowe pola | Gdzie żyje |
|---|---|---|
| **Load** | code, dims, status, stage, progress, resources, awizacja, ferry, pricing, permit, eta*, delayed, silentMinutes | `loads[]` w store (+ persist) |
| **LoadEvent** | type, at, actor, note, payload | `events[]` |
| **Document** | category, status, dataUrl?, permitFits | `documents[]` (vault; quota risk) |
| **LoadMessage** | chat Ustalenia | `messages[]` |
| **Risk** | type FERRY\|ROAD_SE\|DOC\|OPS\|FORCE_MAJEURE, severity, ferryPlanB? | `risks[]` |
| **ExceptionItem** | kolejka wyjątków Kokpit/Ryzyka | `exceptions[]` |
| **Invoice** + factoring snapshot | status, lines, weekLabel | `invoices[]` |
| **Geofence** | type LOADING\|PORT_*\|PRE_*\|SITE\|…, radius, hysteresis, dwell | `geofences[]` |
| **Workflow** + **WorkflowRun** | condition/actions tekstowe; runCount | `workflows[]` / `workflowRuns[]` |
| **ScheduleVersion** | po `commitImport` | `scheduleVersions[]` |
| **RateRule** · **BafParams** · **FactoringOffer** | cennik / BAF UI / oferta | store |
| **Notification** | unread, href deep-link | `notifications[]` |
| **Organization / DemoUser** | HHL/KSH/SCX | seed meta |

Statusy load (`LoadStatus`):  
`PLANNED → RESOURCES_PENDING → READY → LOADING → IN_TRANSIT_PL → AT_PORT → ON_FERRY → IN_TRANSIT_SE → APPROACHING_SITE → UNLOADING → DELIVERED` (+ `DELAYED` · `SILENT` · `DOC_MISSING`).

Etapy spine (`CorridorStage`):  
`PLAN · LOADING · TO_PORT · GDANSK · FERRY · APPROACH · SE_ROAD · SITE · DELIVERED` — mapowanie `STATUS_TO_STAGE` w `status.ts`.

---

## 2. Generator danych (seed)

| Krok | Szczegół | Dowód |
|---|---|---|
| Baza | `loads.json` → **62** wiersze | plik |
| Extras | `EXTRA_LOAD_SPECS` → **+10** ≈ **72** łącznie | `seed.ts` komentarz + specs |
| `buildSeedLoads()` | progress z `PROGRESS_OF`, stress marży 9%, SG-34→`DOC_MISSING`, TRIP gaps | `seed.ts:413+` |
| Events / docs / messages / risks / exceptions / invoices / workflows (12) | buildery w `seed.ts` | j.w. |
| Init store | `applyForceMajeureDelays` + ETA | `useTowerStore` initial |
| Harmonogram KSH SoT | `KSH_HARMONOGRAM.xlsx` w `public/` + `docs/watch-tower/` | import QA |
| Corridor | `corridor_ref.json` LineString | mapa / pozycje |

Pozycja floty: `positionAlong(progress)` na corridor_ref; na mapie dodatkowo drift `(tickBump%40)*0.00012` dla statusów en-route (**nie** telematyka).

---

## 3. Role i uprawnienia

| Funkcja | HHL | KSH | SCX | Dowód |
|---|---|---|---|---|
| Nav | dash map sched risk docs fin inv wf geo options | bez inv/wf/geo/options; fin=rozliczenia | +tasks +inv; bez wf/geo/options | `permissions.ts` `NAV_BY_ROLE` |
| Cost | tak | nie | tak | `canSeeCost` |
| Revenue | tak | tak | nie | `canSeeRevenue` |
| Margin | tak | nie | nie | `canSeeMargin` |
| Import XLSX | nie | **tak** | nie | `canImportSchedule` |
| Geofence / WF edit | tak | nie | nie | `canEditGeofence` / `canEditWorkflow` |
| Submit invoice | nie | nie | tak | `canSubmitInvoice` |
| Match invoice | tak | nie | nie | `canMatchInvoice` |
| Edit resources | tak | nie | tak | `canEditResources` |
| Motyw 1. paint | dark | **light** | dark | `defaultThemeForRole` |
| `filterLoadsForRole` | **no-op** (wszystkie loads) | j.w. | j.w. | `permissions.ts:68–73` |

Stegra jako rola UI: **usunięte świadomie** (`00_KONTEKST` A2).

---

## 4. Gdzie żyje stan

| Warstwa | Mechanizm | Uwagi |
|---|---|---|
| Global UI + dane | **Zustand** `useTowerStore` | jedyny store |
| Persist | `persist(…, { name: 'watch-tower-ui-v6-ready-gate', partialize })` | **brak** `version` / `migrate` |
| Partialize | role, locale, theme, themeManual, factoringOffer, loads, events, documents, messages, notifications, prefs, invoices, geofences, workflows, runs, scheduleVersions, rates, baf, risks, exceptions | `useTowerStore.ts:1394–1417` |
| **Nie** persistowane (sesja) | `view`, `stageFilter`, `mapLayers`, selection drawer (wg notatek PUNKT9) | celowe |
| Inne localStorage | kolumny mapy `watch-tower-map-cols-v1`; kolumny sched `scheduleColumns` | poza zustand |
| Poprzednie klucze | `watch-tower-ui-v5-wf12`, `v4-closeout`, … | **osobne** nazwy — nie migrują; bump klucza = fresh seed |
| Stary stan pod **tym samym** kluczem v6 | wczytany bez migracji schematu | ryzyko QA → `07_ZNANE_BLEDY` |

---

## 5. Formuły cen

```
costHit / revHit = matchRate(dims, rules[side])
sefs = sefsForLoadDate(loadDate)          # appliedMult = min(multSek, multPln)
costRoadWithSefs = roadBase * appliedMult
revRoadWithSefs  = roadBase * appliedMult
costTotal = costRoadWithSefs + ferryEco + extras
revTotal  = revRoadWithSefs + round(ferryEco*1.05) + round(extras*0.75)
margin = revTotal - costTotal
marginPct = margin / revTotal
belowThreshold = marginPct < 0.12
```

Źródło: `pricing.ts` `buildPricing`.  
SEFS tables: `sefs-tables.json` + `lookupMult`.  
SCX pozycje z Excela: `scxRates.ts` (EUR baza) — osobna ścieżka od bracketów seed.

Faktura: `matchInvoice(expected, billed, threshold=50)`.

---

## 6. Formuły ETA

| Segment | Bazowe godziny | Uwagi |
|---|---:|---|
| PL_ROAD Śrem→Gdańsk | 4.5 | × `remainingFactor(status)` |
| WAIT_FERRY | 2.0 | +2 h gdy ferry DELAYED |
| CROSSING GDN→NYN | 18.0 | ×0.5 gdy ONBOARD |
| SE_ROAD | 14.0 | |
| BREAK 561/2006 | 4.5 | |

Pasma: `earliest = hours×lo`, `latest = hours×hi` (lo/hi zależne od kind; SILENT/DELAYED poszerza).  
`etaBodenIso = now + totalHours`.  
Metoda: „Szacunek z czasów odcinków (prom + drogi)” — **heurystyka makiety, nie ML** (`eta.ts`).

---

## 7. Strefy (geofence)

Typy: `LOADING · PORT_OUT · PRE_PORT · PORT_IN · CHECKPOINT · PRE_ARRIVAL · SITE · REST`.  
Seed: m.in. Śrem, porty, E4 checkpoints, Boden (`seed.ts` / store init).  
Edycja: HHL `GeofenceView` → `saveGeofence`.  
Trigger demo: `triggerGeofence` w drawerze (ręczny, nie GPS enter).  
ATRAPA UI: kolumna „Próbki”=`2`; częściowy hardcode postój/histereza (`02_FASADA`).

---

## 8. Statusy dokumentów i READY

`DocCategory`: PERMIT_PL · PERMIT_SE · INSURANCE · CMR · POD · LASHING_PHOTOS · INVOICE.  
`Document.status`: MISSING · UPLOADED · EXPIRED · MISMATCH.  

`isReadyBlocked(load, docs)` — blokuje READY / LOADING / IN_TRANSIT_PL gdy braki cover, mismatch, `docMissing`, `permitFits===false` (`permits.ts` · FIX_READY_GATE · SG-34 demo).

Attachment kinds PERIOD · TRIP · REGULATION — SoT `PERMIT_ATTACHMENT_RULES.md`.

---

## 9. Import harmonogramu (logika)

1. ExcelJS `readXlsxRows` — wiersz 1 = nagłówki **po nazwie** (nie indeks kolumny).  
2. `COLUMN_MAP_DEFAULT` PL: `Wysyłka`, `Rozmiar L x W x H`, `Waga elementu`, `Ilość elementów`, `Waga transport [t]`, daty, kierowca, …  
3. `parseSchedule` — walidatory `NO_SHIPMENT_CODE`, `WEIGHT_INCONSISTENT`, `DATE_ORDER`, …  
4. `diffSchedule` liczy removed, ale **`dryRunFromXlsx` zawsze `removedIds: []`** (additive).  
5. `commitImport`: ignoruje removals bez `allowRemovals`; `accepted===0` → return.  

Naturalny klucz = kod **Wysyłka** (nie Lp.).

---

## 10. Formatowanie UI

| Co | Jak | Dowód |
|---|---|---|
| Liczby PL | `toFixed(…).replace('.', ',')` | ScheduleView / LoadDrawer / Finance |
| Kwoty | `fmt` lokalne w widokach · mono | Invoices/Finance |
| Daty | ISO slice / `date-fns` tam gdzie użyte | drawer |
| Status labels | **hardcoded PL** w `StatusPill` | C3 — nie i18n |
| Locale store | `pl\|en\|sv` → `t()` tylko część chrome | `messages.ts` · C3_JEZYKI |
| Motyw | `data-theme` / class via `initTheme` | Topbar |

---

## 11. Progress ↔ status (mapa)

| Status | progress (seed) |
|---|---:|
| PLANNED | 0.00 |
| RESOURCES_PENDING | 0.02 |
| READY | 0.05 |
| LOADING | 0.08 |
| IN_TRANSIT_PL | 0.22 |
| AT_PORT | 0.35 |
| ON_FERRY | 0.48 |
| IN_TRANSIT_SE | 0.68 |
| APPROACHING_SITE | 0.88 |
| UNLOADING | 0.95 |
| DELIVERED | 1.00 |
| DELAYED / SILENT / DOC_MISSING | 0.70 / 0.65 / 0.04 |

Źródło: `status.ts` `PROGRESS_OF`.
