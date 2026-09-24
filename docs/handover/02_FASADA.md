# C1 · Fasada — co działa, a co jest atrapą

| Pole | Wartość |
|---|---|
| Data audytu | **2026-09-23 ~21:57 CEST** (Europe/Warsaw) |
| Baseline | commit `305da3e` · tag `baseline-2026-09-23` |
| Metoda | `rg` + `Read` na `src/` · cross-check `docs/qa-start/` (+ mirror `docs/watch-tower/qa-start/`) |
| Zakres | interakcje UI (przyciski, pola, zakładki, filtry, mapa, drawer, eksporty, bell, workflow) — **bez** zmian kodu |
| Stany | `DZIAŁA` · `ATRAPA` · `CZĘŚCIOWO` · `ZAKOMENTOWANE` · `PORZUCONE` |

**Legenda Dowód:** nazwa raportu QA + data gdy dostępna; inaczej „static src”.  
**Rozbieżność z QA** oznaczona w kolumnie Uwaga / sekcji §6.

---

## D25 — decyzje (2026-09-25 Europe/Warsaw)

Każda pozycja ATRAPA / PORZUCONE ma decyzję: **ZAIMPLEMENTOWANE** · **USUNIĘTE** · **OZNAKOWANE** (nieaktywne / fasada).

### ATRAPA (8)

| Pozycja | Decyzja | Dowód |
|---|---|---|
| Alternatywy SE ×4 „Wybierz” (L1) | **ZAIMPLEMENTOWANE** | `applySeRouteAlt` · `seRouteAlts.ts` · mutacja risk+load+event |
| Pill opóźnienia `+1h 35 min` (L2) | **ZAIMPLEMENTOWANE** | `formatDelayPill(delayMinutesVsPlan(…))` w `LoadDrawer` |
| Delty faktury +1240/+600 | **ZAIMPLEMENTOWANE** | delty z `buildSeedInvoices` / match (P6); brak hardcode UI |
| Sub „tydzień 38 · …” | **ZAIMPLEMENTOWANE** | `weekSubtitle(weekLabel)` w `InvoicesView` |
| Tasks deadline `18+i*9` (L4) | **ZAIMPLEMENTOWANE** | `hoursUntilLoad(plannedLoadDate)` |
| Prefs powiadomień | **ZAIMPLEMENTOWANE** | `pushNotification` filtruje wg `notificationPrefs` |
| SAIL_ROWS / pogoda prom | **OZNAKOWANE** | SoT `voyageSeaTableRows` (D4) + `DemoMark` — demo, nie live API |
| DRAWING 100% (L7) | **ZAIMPLEMENTOWANE** | kategoria `DRAWING` w vault; licznik z UPLOADED |
| Geofence „Próbki”=2 (L8) | **ZAIMPLEMENTOWANE** | pole `samplesRequired` w modelu + UI |

### PORZUCONE (6)

| Pozycja | Decyzja | Dowód |
|---|---|---|
| `CorridorMap.leaflet.tsx` | **USUNIĘTE** | brak pliku; aktywny `CorridorMap.tsx` (Leaflet) |
| MapLibre `public/maplibre-*` | **USUNIĘTE** | usunięte assety leftover (D25) |
| Legacy `BAF_PARAMS` / Opcje BAF (F2.4-c) | **OZNAKOWANE** | pola `readOnly` + nota fasady; `computeSefs` ← tylko `SEFS_WEEKLY` |
| Stegra jako rola UI | **USUNIĘTE** (wcześniej) | świadomie poza makietą |
| React Flow builder WF | **OZNAKOWANE** / poza scope | makieta = lista+formularz; nota L9 |
| Telematyka SCX adapter | **OZNAKOWANE** / poza SPA | drift mapy demo; adapter poza app |

### F2.4-c
Wszystkie `bafFields` w Opcjach: **fasada** (disabled) — nie zasilają `computeSefs`.

### Poza D25 (Etap 4+)
- L9 JSONLogic runtime — nota w `wf_note`; silnik później  
- F2.4-a / F2.4-b — otwarte  
- L5 pełne centrum powiadomień — filtr push zrobiony w D25; UI centrum → Etap 4  

---

## 1. Tabela główna

| Element | Plik : linia | Stan | Dowód | Uwaga |
|---|---|---|---|---|
| **SHELL** | | | | |
| Nav — przełączanie widoków wg roli | `Nav.tsx:130` · `permissions.ts:16–23` | DZIAŁA | FINAL_SHIP 2026-09-23 · FN2 static #11 | HHL: +wf/geo/options; SCX: +tasks/inv; KSH: bez admin |
| Nav — zwijanie sidebara | `Nav.tsx:144` | DZIAŁA | P9_V2_STATIC_CHROME | `setNavCollapsed` |
| Topbar — przełącznik roli HHL/KSH/SCX | `Topbar.tsx:96–106` | DZIAŁA | FINAL_SHIP PL UI | brak roli Stegra (celowe) |
| Topbar — język PL/EN/SV | `Topbar.tsx:109–114` | DZIAŁA | FUNCTIONAL_REQA_STATIC #10 | słownik i18n; kompletność języków = C3 |
| Topbar — motyw jasny/ciemny | `Topbar.tsx:116–125` | DZIAŁA | static src | `toggleTheme` |
| Topbar — skróty `?` | `Topbar.tsx:126–137` · `KeyboardHelp.tsx` | DZIAŁA | static src | lokalny overlay |
| Topbar — countdown promu + zegar | `Topbar.tsx:139–157` · `ferry.ts` `nextLiveSailing` | CZĘŚCIOWO | CHAT_GAP_AUDIT · FINAL_SHIP residual | rozkład seed Polferries, nie live API |
| Bell — otwórz panel | `NotificationBell.tsx:52` | DZIAŁA | FINAL_FN3 #9 · FN2 #11 | |
| Bell — oznacz jedno / wszystkie | `NotificationBell.tsx:94,134` · store `:321–340` | DZIAŁA | FINAL_FN3 2026-09-23 · FN4 spot | klik: 5→0 unread |
| Bell — klik powiadomienia → nawigacja | `NotificationBell.tsx:120–122` · store `openNotification` | DZIAŁA | FUNCTIONAL_REQA_STATIC_FN2 #11 | |
| Toast — dismiss | `Toasts.tsx:25` | DZIAŁA | static src | |
| CorridorSpine — filtr etapu → mapa | `CorridorSpine.tsx:49–55` | DZIAŁA | FINAL_FN4 · P9 · FN3 #8 | 1. klik: `navigateTo({view:'map', stage})` |
| CorridorSpine — 2. klik czyści filtr | `CorridorSpine.tsx:50–52` | DZIAŁA | FINAL_FN4 · FINAL_FN3 · FUNCTIONAL_REQA_STATIC #7 | **≠** FINAL_FN2 FAIL (unieważniony — zły chrome) |
| **KOKPIT** | | | | |
| Banner krytyczny → Ryzyka | `DashboardView.tsx:54` | DZIAŁA | FN2 KPI | |
| KPI / kafelki → `navigateTo` / `selectLoad` | `DashboardView.tsx:96–242` | DZIAŁA | FINAL_FN2 #13 · FUNCTIONAL_REQA_STATIC_FN2 #11 | deep-link stage/filter |
| Wyjątki — klik wiersza | `DashboardView.tsx:270–272` | DZIAŁA | static src | loadId → drawer / risk |
| Mapa embed Kokpit | `DashboardView.tsx:302` · `CorridorMap.tsx:171` | DZIAŁA | FINAL_SHIP Leaflet · CHAT_GAP 360px | ten sam silnik co Mapa |
| Progress dostaw (wykres) | `DeliveryProgress.tsx` | DZIAŁA | static src | liczone z `loads` |
| **MAPA** | | | | |
| Leaflet `L.map` + kafelki Esri | `CorridorMap.tsx:171–175` · TILE_*:23–26 | DZIAŁA | FINAL_SHIP · MAP_TILES_FIX · FUNCTIONAL_REQA_STATIC #1 | CARTO URL zadeklarowane, aktywne = Esri |
| Warstwy (5 checkboxów) | `MapView.tsx:143–153` · `CorridorMap.tsx:261–267` | DZIAŁA | FN2 #9 | route/ferry/geofence/poi/vehicles(+seEvents/AIS) |
| Filtr Terminowe / Spóźnione / Wszystkie | `MapView.tsx:166–191` | DZIAŁA | CHAT_GAP_AUDIT | lokalny state `timing` |
| Szukaj + klik wiersza → drawer | `MapView.tsx:160–164,233` | DZIAŁA | static src | |
| Resize kolumn listy | `MapView.tsx:206+` · localStorage | DZIAŁA | static src | klucz `watch-tower-map-cols-v1` |
| Chip → Strefy | `MapView.tsx:136` | DZIAŁA | static src | HHL-only widok; inne role: nawigacja może być pusta wg Nav |
| Markery floty (ciężarówki) | `CorridorMap.tsx:41–47,300–323` | CZĘŚCIOWO | FINAL_SHIP residual GPS | pozycja = `progress` + **sztuczny drift** `tickBump` (nie telematyka) |
| Warstwa AIS promu | `CorridorMap.tsx:362–372` · `ais.ts` | CZĘŚCIOWO | FINAL_SHIP residual · FN2 #9 | live gdy klucz/proxy; inaczej **seed labeled** |
| Sytuacje Trafikverket na mapie | `CorridorMap.tsx:327–358` · `trafikverket.ts` | CZĘŚCIOWO | FN2 #9 · CHAT_GAP C3/C8 | live\|seed labeled |
| Klik markera → `selectLoad` | `CorridorMap.tsx` (popup/marker) | DZIAŁA | FINAL_SHIP | |
| **HARMONOGRAM** | | | | |
| Wgraj XLSX (KSH) dry-run | `ScheduleView.tsx:224,153–168` · `scheduleDryRun.ts` · `xlsxRead.ts` | DZIAŁA | FINAL_SHIP · FN3 #4 · FN2 #6 | ExcelJS real parse |
| Zatwierdź commit (KSH) | `ScheduleView.tsx:381–395` · store `commitImport` | DZIAŁA | FINAL_SHIP · FN3 no-wipe | `accepted===0` → disabled + baza nietknięta |
| Anuluj / wróć z dry-run | `ScheduleView.tsx:405,420` | DZIAŁA | static src | |
| Eksport XLSX (wszystkie role) | `ScheduleView.tsx:270–287` · `xlsxExport.ts` | DZIAŁA | **FINAL_FN4** 2026-09-23 · 13 265 B | **≠** FINAL_FN3 FAIL (naprawione przed FN4) |
| Zapisz widok kolumn | `ScheduleView.tsx:228–238` · `scheduleColumns.ts:85` | DZIAŁA | CHAT_GAP | localStorage |
| Menu Kolumny (checkboxy) | `ScheduleView.tsx:241–267` | DZIAŁA | static src | role-gated cost/rev/margin |
| Quick-filtry stage chips | `ScheduleView.tsx:448–449` | DZIAŁA | static src | lokalny `quick` |
| Szukaj + klik wiersza | `ScheduleView.tsx:436–438,542` | DZIAŁA | static src | |
| Tel. kierowcy `tel:` | `ScheduleView.tsx:608` | DZIAŁA | static src | stopPropagation |
| Nr zlecenia fallback `HHL/2026/1240+seq` | `ScheduleView.tsx:33` · `LoadDrawer.tsx:146,208` | CZĘŚCIOWO | static src | gdy brak `permit.pozycja` — wzór zaszyty |
| **SZUFLADA TRANSPORTU** | | | | |
| Zakładki 5× (Przegląd…Ustalenia) | `LoadDrawer.tsx:122–126,177` | DZIAŁA | FN3 Ustalenia · Claude SoT | `chat` = Ustalenia |
| Zamknij / scrim | `LoadDrawer.tsx:131,139` | DZIAŁA | static src | |
| Przegląd — dane load + ETA bands | `LoadDrawer.tsx:184–241` · `eta.ts` | DZIAŁA | FUNCTIONAL_REQA_STATIC #9 | pasmo earliest–latest z modelu |
| Przegląd — pill opóźnienia | `LoadDrawer` · `formatDelayPill` | **DZIAŁA** (D25/L2) | `delayMinutesVsPlan` | z ETA vs plan |
| Przebieg (timeline) | `LoadDrawer.tsx:298+` | DZIAŁA | FINAL_SHIP driver timeline | eventy ze store |
| Docs — Podgląd / Wgraj / ZIP | `LoadDrawer.tsx:323–390` · `zipDocs.ts` · `uploadDocument` | DZIAŁA | FINAL_FN4 ZIP 86 250 B · FN3 camera | KSH bez Wgraj |
| Ceny — cost/rev/margin wg roli | `LoadDrawer.tsx:395–420` · `permissions.ts` | DZIAŁA | FUNCTIONAL_REQA_STATIC_FN2 #13 | locked copy gdy brak uprawnień |
| Ustalenia — Zapisz zasoby | `LoadDrawer.tsx:527–613` · store `updateResources` | DZIAŁA | FN3 #3 · FUNCTIONAL_REQA_STATIC_FN2 #4 | **≠** FINAL_FN2 FAIL (void chrome) |
| Ustalenia — Zapisz awizację/prom | `LoadDrawer.tsx:619–712` | DZIAŁA | FN3 #3 | KSH: note read-only (`!canEdit`) |
| Ustaw READY (gate cover) | `LoadDrawer.tsx:728–738` · `permits.ts` `isReadyBlocked` | DZIAŁA | P9_RECLICK2_READY · FN3 #5 · FN4 | disabled + title reason |
| Wyjazd / Rozładowany / Przypisz SCX | `LoadDrawer.tsx:719–767` | DZIAŁA | static src | mutują status / pricing |
| Zdarzenie strefy (symulacja) | `LoadDrawer.tsx:752–760` · `triggerGeofence` | CZĘŚCIOWO | static src | ręczny trigger demo, nie GPS enter |
| Chat — Wyślij wiadomość | `LoadDrawer.tsx:779–791` · `sendMessage` | DZIAŁA | static src | in-memory messages |
| **RYZYKA** | | | | |
| Lista wyjątków / filtr roli | `RisksView.tsx:35–49,110` | DZIAŁA | static src | |
| Plan B ferry — Przelicz → `applyPlanB` | `RisksView.tsx:166–176` · store `:1308–1390` | DZIAŁA | FINAL_SHIP · FN3 #6 · FUNCTIONAL_REQA_STATIC #4 | mutuje ferry + `PLAN_B_ACTIVATED` |
| Tabela fal / wiatru `SAIL_ROWS` | `RisksView.tsx:16–21,133` | ATRAPA | static src | **4 wiersze hardcode**, nie API pogody |
| Alternatywy trasy SE — Wybierz ×4 | `RisksView` · `applySeRouteAlt` | **DZIAŁA** (D25) | store mutacja | wybrane: risk+load+event |
| Sytuacje E4 (TV) klik | `RisksView.tsx:220–224` | CZĘŚCIOWO | CHAT_GAP · FN2 #9 | seed\|live; link do load gdy `situationId` |
| **DOKUMENTY** | | | | |
| Tabela kompletności kategorii | `DocsView.tsx:32–41,102–123` | CZĘŚCIOWO | FINAL_SHIP | liczone z vault; **DRAWING = zawsze nLoads** (100% fake) |
| Filtr kategorii + vault rows | `DocsView.tsx:129–172` | DZIAŁA | static src | slice 40 |
| Wgraj dokument | `DocsView.tsx:65–75,194` | DZIAŁA | FN3 upload | trafia w `loads[0]` gdy brak targetu — ograniczenie UX |
| Pobierz paczkę tygodnia ZIP | `DocsView.tsx:77–86` · `zipDocs.ts` | DZIAŁA | FINAL_FN4 · FN3 #7 | bez `dataUrl` → `.txt` stub w ZIP (`zipDocs.ts:50–61`) |
| DocPreview / Podgląd | `DocPreview.tsx` · `DocFileRow.tsx:26–28` | DZIAŁA | HOLLOW_VERIFY #3 · HOLLOW_FIX | |
| **FINANSE** | | | | |
| Agregaty cost/rev/margin z DELIVERED | `FinanceView.tsx:23–48` | DZIAŁA | FN2 spot-check | **brak przycisków** — widok read-only |
| SEFS hybrid ORLEN/OKQ8 | `FinanceView.tsx:60–102` · `sefs.ts:50–90` | DZIAŁA | FUNCTIONAL_REQA_STATIC_FN2 #10 | z `SEFS_WEEKLY` seed snapshots |
| Próg marży 12% (flaga) | `pricing.ts:73` · UI Finance | DZIAŁA | static src | reguła stała 0.12 — biznesowo OK, nie „wymyślona per load” |
| **FAKTURY** | | | | |
| Złóż fakturę (SCX) | `InvoicesView.tsx:64–79` · `submitInvoice` | DZIAŁA | FN2 #7 | mutuje invoices + factoring snapshot |
| Zgłoś spór / Zatwierdź (HHL) | `InvoicesView.tsx:83–96` | DZIAŁA | FN2 #7 | `resolveInvoice` |
| Factoring HHL configure | `InvoicesView.tsx:174–223` · Options | DZIAŁA | FN2 #7 · FN3 factoring | |
| Factoring SCX choose (checkbox) | `InvoicesView.tsx:24,75` | DZIAŁA | FN2 | |
| Różnice faktury | `buildSeedInvoices` / match | **DZIAŁA** (D25) | seed diffs | nie hardcode UI |
| Sub tygodnia faktury | `InvoicesView` · `weekSubtitle` | **DZIAŁA** (D25) | `weekLabel` | z faktury |
| Załącz CMR/POD do faktury | `InvoicesView.tsx:332,395` | DZIAŁA | static src | `uploadDocument` |
| **AUTOMATYZACJE** | | | | |
| Toggle reguły ON/OFF | `WorkflowsView.tsx:53` · `toggleWorkflow` | DZIAŁA | FN2 #8 | |
| Uruchom teraz | `WorkflowsView.tsx:56` · `runWorkflowNow` `:920–951` | CZĘŚCIOWO | FN2 #8 · FUNCTIONAL_REQA_STATIC #8 | zapisuje run + notyfikację; **nie ewaluuje JSONLogic / nie wykonuje akcji** |
| Nowa reguła — formularz Zapisz | `WorkflowsView.tsx:48,65–71` · `createWorkflow` | CZĘŚCIOWO | CHAT_GAP «Nowa reguła» DONE | zapis do store OK; condition/actions = **metadane tekstowe** |
| 12 seed workflows | `seed.ts` wf-1…12 | DZIAŁA | FUNCTIONAL_REQA_STATIC #8 | |
| **STREFY** | | | | |
| Nowa strefa / edycja / Zapisz | `GeofenceView.tsx:33–56,117–172` · `saveGeofence` | DZIAŁA | FUNCTIONAL_REQA_STATIC_FN2 #7 | HHL only |
| Kolumna „Próbki” | `GeofenceView` · `samplesRequired` | **DZIAŁA** (D25/L8) | model | z geofence |
| Postój/histereza częściowo hardcode UI | `GeofenceView.tsx:81–84` | CZĘŚCIOWO | static src | override wizualny vs `g.hysteresisM` |
| Options — mini-toggle aktywna strefa | `OptionsView.tsx:137` | DZIAŁA | CHAT_GAP Strefy scroll | |
| **OPCJE** | | | | |
| Cennik COST/REV edycja | `OptionsView.tsx:96–97` · `updateRate` | DZIAŁA | static src | |
| BAF pola | `OptionsView.tsx:107–108` · `updateBaf` | DZIAŁA | static src | blur → toast „zapisano” |
| Język / motyw | `OptionsView.tsx:117–118` | DZIAŁA | static src | |
| Factoring offer | `OptionsView.tsx:126–130` | DZIAŁA | FN2 | |
| Prefs powiadomień (3 checkboxy) | `OptionsView` · `pushNotification` | **DZIAŁA** (D25) | store filter | filtruje push |
| Oznacz wszystkie jako przeczytane | `OptionsView.tsx:144` | DZIAŁA | static src | hardcode role `'HHL'` |
| Skrót → Automatyzacje | `OptionsView.tsx:148–149` | DZIAŁA | static src | |
| **ZADANIA (SCX)** | | | | |
| Lista + otwórz drawer | `TasksView.tsx:46,60` | DZIAŁA | static src | |
| Termin zadań / pill | `TasksView` · `hoursUntilLoad` | **DZIAŁA** (D25/L4) | `plannedLoadDate` | do załadunku |
| **DRIVER PWA** | | | | |
| Udostępnij pozycję GPS | `DriverPwa.tsx:57` · store `driverSharePosition` | DZIAŁA | HOLLOW_FIX · HOLLOW_VERIFY #4 · FINAL_SHIP residual | real `getCurrentPosition`; **one-shot** (nie watch) |
| Kamera → vault `documents[]` | `DriverPwa.tsx:104–137` · `driverAttachDoc` | DZIAŁA | HOLLOW_FIX · FN3 #2 · FINAL_SHIP | |
| Milestones LOADED/FERRY/… | `DriverPwa.tsx:68–84` · `driverMilestone` | DZIAŁA | static src | |
| Locale lokalny PL/EN/SV | `DriverPwa.tsx:41` | DZIAŁA | static src | niezależny od store locale |
| **PORZUCONE / MARTWE ŚCIEŻKI** | | | | |
| `CorridorMap.leaflet.tsx` (duplikat) | `components/map/CorridorMap.leaflet.tsx` (367 linii) | PORZUCONE | FINAL_SHIP residual MapLibre/Leaflet | **zero importów** z `src/`; aktywny = `CorridorMap.tsx` |
| MapLibre worker + `public/map-styles` | `public/maplibre-gl-*` · `corridor.ts:61–82` | PORZUCONE | FINAL_SHIP · FUNCTIONAL_REQA_STATIC #1 residual | CSS `.maplibregl-*` leftover; mapa nie ładuje MapLibre |
| Legacy fuel stub w seed | `seed.ts:200` | PORZUCONE | static src | komentarz: real = SEFS |
| Stegra jako rola UI | — | PORZUCONE | 00_KONTEKST A2 · permissions | usunięte świadomie |
| React Flow builder WF | — | PORZUCONE | 00_KONTEKST A2 / CURSOR | makieta = lista+formularz |
| Telematyka SCX (adapter) | `/workspace/watch-tower/…/adapter.ts` (poza app) | PORZUCONE | 00_KONTEKST A3 | nie w SPA · ATRAPA poza makietą |

---

## 2. Wartości zaszyte zamiast liczonych

| Co | Gdzie | Powinno być |
|---|---|---|
| `+1h 35 min` przy `load.delayed` | `LoadDrawer.tsx:137,221` | `formatDelayPill(delayMinutes(load))` (`StatusPill.tsx:52–55` już istnieje) |
| Fallback nr zlecenia `HHL/2026/${1240 + sequenceOrder}` | `ScheduleView.tsx:33` · `LoadDrawer.tsx:146,208` | wyłącznie `permit.pozycja` / import |
| Kolumna Próbki geofence = `"2"` | `GeofenceView.tsx:98` | pole modelu (brak w typie → dodać lub ukryć) |
| Postój PORT/SITE = `'15 min'` hardcode UI | `GeofenceView.tsx:81–82` | `g.dwellMin` |
| Histereza PRE_ARRIVAL/SITE = `'1000 m'` | `GeofenceView.tsx:83–84` | `g.hysteresisM` (dla innych typów już z modelu) |
| Invoices sub „tydzień 38 · 14–20.09.2026” | `InvoicesView.tsx:62` | ISO week z `getNow()` / seed |
| Options „Oznacz wszystkie” zawsze `markAll…('HHL')` | `OptionsView.tsx:144` | bieżąca `role` |
| Drift floty `(tickBump % 40) * 0.00012` | `CorridorMap.tsx:43–46` | telematyka / ostatnie GPS |
| `runWorkflowNow` zawsze `loads[0]` jako `loadId` | `useTowerStore.ts:929` | load z warunku / kontekstu triggera |
| Docs upload bez wyboru load → `loads[0]` | `DocsView.tsx:56,69–70` | picker transportu |

---

## 3. Liczby wymyślone vs liczone z danych

| Liczba / wskaźnik | Źródło | Werdykt |
|---|---|---|
| Liczniki spine (etapy) | `CorridorSpine` + filtry statusu | **Liczone** |
| KPI Kokpit (risks, docs missing, arrivals…) | `DashboardView` reduce na store | **Liczone** |
| SEFS mult / notowania tygodnia | `SEFS_WEEKLY` + `computeSefs` | **Liczone z seedu** (nie live ORLEN/OKQ8) |
| Agregaty Finanse DELIVERED | `FinanceView.tsx:23–31` | **Liczone** |
| Kompletność docs (CMR/POD/…) | `DocsView` count UPLOADED | **Liczone** |
| DRAWING kompletność = `nLoads` | `DocsView.tsx:34–35` | **Wymyślone** (zawsze 100%) |
| `SAIL_ROWS` fala/wiatr 1,4–3,4 m | `RisksView.tsx:16–21` | **Wymyślone** (demo makiety) |
| ALT km (`+310`, `+265`…) | `RisksView.tsx:9–14` | **Wymyślone** stałe copy; Plan B i tak bierze `ferryPlanB` z risk |
| Delty faktury `+1240` / `+600` | `InvoicesView.tsx:37,73` | **Wymyślone** (demo DISPUTED) |
| Tasks deadline `18+i*9` | `TasksView.tsx:42` | **Wymyślone** |
| Próg marży `0.12` / match invoice `±50` | `pricing.ts:73,77` | **Stała reguła biznesowa** (nie per-wiersz random) |
| 62 loads | `loads.json` | **Seed realny** (FUNCTIONAL_REQA_STATIC #12) |

---

## 4. Funkcje zaczęte i porzucone / niedokończone

| Funkcja | Stan | Ślad |
|---|---|---|
| MapLibre jako silnik mapy | PORZUCONE | `public/maplibre-*`, `corridor.ts` MAP_STYLE, CSS leftover; aktywny Leaflet |
| Duplikat `CorridorMap.leaflet.tsx` | PORZUCONE | nieimportowany |
| JSONLogic / realne akcje workflow | CZĘŚCIOWO→porzucone w runtime | UI zbiera `condition`/`actions`; `runWorkflowNow` tylko notif+runCount |
| Prefs powiadomień (Options) | ATRAPA | zapis bez konsumenta |
| Alternatywy drogowe SE (Wybierz) | ATRAPA | toast-only; kontrast do działającego Plan B ferry |
| Pogoda morska / MET-Norway | niepodpięta | `SAIL_ROWS` zastępuje |
| Telematyka floty OEM | poza SPA | drift na mapie |
| `watchPosition` ciągły GPS | nie | one-shot (FINAL_SHIP residual) |
| Vault durable poza localStorage | nie | quota risk (HOLLOW_*) |
| Next/Supabase / SharePoint sync | poza makietą | 00_KONTEKST A2–A3 |

---

## 5. Residual QA (przepuszczone przez bramę, niedomknięte)

Źródła: `FINAL_SHIP.md` (~01:51 CEST), `FUNCTIONAL_REQA_STATIC.md`, `HOLLOW_VERIFY.md`, `CHAT_GAP_AUDIT.md`, `FUNCTIONAL_REQA_STATIC_FN2.md`.

| Residual | Raport | Znaczenie dla fasady |
|---|---|---|
| Dead MapLibre leftovers w `public/` + CSS | FINAL_SHIP · FUNCTIONAL_REQA_STATIC | PORZUCONE assety — nie aktywna mapa |
| GPS one-shot `getCurrentPosition` | FINAL_SHIP · HOLLOW_VERIFY | DZIAŁA, ale nie tracking |
| Vault localStorage quota (duże zdjęcia) | HOLLOW_FIX · HOLLOW_VERIFY · CHAT_GAP PARTIAL | Vault realny; persistence może paść |
| AIS / Trafikverket seed gdy brak klucza (labeled) | FINAL_SHIP · FN2 #9 · CHAT_GAP C3/C8 PARTIAL | CZĘŚCIOWO — uczciwie oznaczone |
| ZIP `.txt` stub gdy brak `dataUrl` | FUNCTIONAL_REQA_STATIC_FN2 | ZIP realny, treść pliku może być metadaną |
| Next/Supabase architektura | CHAT_GAP C6/C10 PARTIAL | poza scope makiety Vite |

**Nie residual już (naprawione względem starszych raportów):** hollow Plan B bez `loadId` (HOLLOW_VERIFY FAIL → zamknięte w FUNCTIONAL_REQA_STATIC #4 + fallback store `:1316–1319`); Eksport XLSX (FN3 FAIL → FN4 PASS).

---

## 6. Rozbieżności ocena fasady ↔ ostatnie QA

| Temat | Ostatnie QA | Ta ocena (C1) | Komentarz |
|---|---|---|---|
| Eksport XLSX | FINAL_FN3 **FAIL** → FINAL_FN4 **PASS** | **DZIAŁA** | Zgoda z FN4; FN3 historyczny |
| READY←cover | P9_RECLICK2 **SHIP** · FN3/FN4 PASS | **DZIAŁA** | Zgoda; FINAL_FN2 FAIL **unieważniony** (zły chrome) |
| Spine 2. klik | FN3/FN4 PASS; FN2 FAIL void | **DZIAŁA** | Kod: `setStageFilter(null)` + `navigateTo({stage:null})` |
| Ustalenia Zapisz | FN3 PASS; FN2 FAIL void | **DZIAŁA** | Formularze podpięte do store |
| Plan B | FINAL_SHIP / FN3 PASS; HOLLOW_VERIFY **NO_SHIP** (risk-8) | **DZIAŁA** | **Rozbieżność z HOLLOW_VERIFY:** późniejszy STATIC + fallback `loadId` w `applyPlanB` zamyka lukę; CHAT_GAP: „prior report stale” |
| Alternatywy SE „Wybierz” | brak w scorecardach klików | **ATRAPA** | QA nie testowało — fasada toast-only |
| Prefs powiadomień Options | brak | **ATRAPA** | nie w bramach |
| Workflow „Uruchom” | FN2 PASS (notif) | **CZĘŚCIOWO** | QA liczy notif = PASS; silnik reguł nadal atrapa semantyczna |
| GPS / AIS seed | residual OK | **CZĘŚCIOWO** | zgodne z residual, nie FAIL |
| FINAL_FN2 overall NO_SHIP | unieważniony ~03:09 | — | nie używać jako SoT klików |

---

## 7. Podsumowanie liczników (wiersze tabeli §1)

| Stan | Liczba (wiersze tabeli §1) |
|---|---:|
| DZIAŁA | **73** |
| CZĘŚCIOWO | **11** |
| ATRAPA | **8** |
| PORZUCONE | **6** |
| ZAKOMENTOWANE | **0** (brak wykrytych `//`-wyłączonych handlerów w `src/views`/`src/components`) |

*Licznik = wiersze tabeli §1 (zagregowane kontrolki, nie każdy input osobno). Pola formularzy Ustalenia/Options policzone jako grupy DZIAŁA.*

### Top 10 ATRAPA / PORZUCONE (priorytet dla etapu D)

1. **Alternatywy SE ×4 „Wybierz”** — toast only (`RisksView.tsx:269–290`) — ATRAPA  
2. **Pill `+1h 35 min`** w drawerze — stały string (`LoadDrawer.tsx:137,221`) — ATRAPA  
3. **Delty faktury +1240/+600** (`InvoicesView.tsx:37`) — ATRAPA  
4. **Tasks deadline `18+i*9`** (`TasksView.tsx:42`) — ATRAPA  
5. **Prefs powiadomień** bez filtra (`OptionsView.tsx:143`) — ATRAPA  
6. **SAIL_ROWS pogoda** (`RisksView.tsx:16–21`) — ATRAPA  
7. **DRAWING 100% kompletności** (`DocsView.tsx:34–35`) — ATRAPA (wskaźnik)  
8. **Geofence „Próbki”=2** (`GeofenceView.tsx:98`) — ATRAPA  
9. **`CorridorMap.leaflet.tsx` + MapLibre public** — PORZUCONE  
10. **JSONLogic/akcje workflow w runtime** — semantycznie PORZUCONE mimo UI DZIAŁA/CZĘŚCIOWO  

---

## 8. Metoda / limity tego audytu

- Źródło prawdy: drzewo `src/` na boxie w chwili audytu; linie z `rg`/`Read`.  
- Nie uruchamiano ponownego klik-e2e w tym przebiegu C1 — dowody klików = raporty QA z 2026-09-23.  
- Nie inventowano `plik:linia`: gdy handler tylko toast → ATRAPA; gdy mutacja store/download/nawigacja → DZIAŁA; gdy mutacja + seed/live gap → CZĘŚCIOWO.  
- C2–C6 **nie** ruszane.

