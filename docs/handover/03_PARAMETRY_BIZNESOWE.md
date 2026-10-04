# 03 · Parametry biznesowe

| Pole | Wartość |
|---|---|
| Data | **2026-09-24** Europe/Warsaw (F2.4) |
| Zasada | Każdy wiersz: **USTALONE** (z umowy / SoT / kodu reguł) vs **DEMONSTRACYJNE** (seed / UI demo) + dowód `src`/`docs` |
| Bez commit · bez zmian kodu |

Legenda: **USTALONE** = reguła produktowa lub wartość z załącznika/cennika SoT; **DEMONSTRACYJNE** = ilustracja makiety (można zmienić bez umowy).

---

## 1. Stawki (cennik)

| Parametr | Wartość | Status | Dowód |
|---|---|---|---|
| Waluta cennika SCX bazowego | **EUR** · tylko `cena_bazowa_EUR` | **USTALONE** | `scx-rates-base.json` `currency`/`rule`; `scxRates.ts` komentarz |
| Kolumna „Cena aktualna” (z BAF) | **NIGDY** do wyceny | **USTALONE** | `scx-rates-base.json` `rule`; `scxRates.ts:3` |
| Brackety COST makiety (3) | L0–14 / 14–17 / 17–22 · base **16500 / 19200 / 22800** | **DEMONSTRACYJNE** | `seed.ts` `RATE_COST` — uproszczone PLN bracket, nie wiersze SCX 1:1 |
| Brackety REV makiety (3) | **20500 / 23800 / 27900** | **DEMONSTRACYJNE** | `seed.ts` `RATE_REV` |
| Match reguły | dokładnie 1 hit wymiarowy; 0 → `NO_BRACKET`; >1 → `AMBIGUOUS` | **USTALONE** (logika) | `pricing.ts` `matchRate` |
| Edycja w Opcje | HHL: `updateRate` → persist | **USTALONE** (UX) | `OptionsView` · `useTowerStore.updateRate` |
| Przykład SoT SCX wiersz 1 | „Słupy skrajne” · baza **7640 EUR** · zestaw max 18×3×2.5 / 22 t | **USTALONE** (źródło xlsx) | `scx-rates-base.json` rows[0] |

---

## 2. BAF / SEFS (dopłata paliwowa)

### 2.0 Ścieżki dokumentacji — **jeden obowiązek**

| Plik | Rola |
|---|---|
| **`docs/watch-tower/BAF_SEFS.md`** | **Obowiązujący SoT mechanizmu SEFS** (załącznik umowy / `BAF_SPEC.docx`) — zasady 1–8, źródła URL, tabele SEK/PLN |
| `src/data/sefs-tables.json` (= kopia `docs/watch-tower/sefs-tables.json`) | Maszynowa postać tabel + `base` + `sources` + `rule: hybrid_min` — musi być zgodna z `BAF_SEFS.md` |
| `src/lib/sefs.ts` | Implementacja: `lookupMult`, `computeSefs`, `SEFS_WEEKLY`, `sefsForLoadDate`, `applySefsToRoadRate` |
| `docs/handover/MECHANIZM_PIENIEDZY.md` | SoT **pieniędzy/faktur/kursu NBP**; dla paliwa tylko odsyła do SEFS hybrid_min — **nie zastępuje** `BAF_SEFS.md` w budowie tablic |
| `docs/claude/archiwum/D7_*.md` | Historia decyzji D7 (hybrid_min) — archiwum, nie SoT |

**Obowiązujący dokument mechanizmu SEFS:** `docs/watch-tower/BAF_SEFS.md`.

### 2.1 Parametry (skrót)

| Parametr | Wartość | Status | Dowód |
|---|---|---|---|
| Model | **hybrid_min**: `appliedMult = min(mult_sek, mult_pln)` | **USTALONE** | `sefs-tables.json` `rule`; `sefs.ts` `computeSefs`; `BAF_SEFS.md` §2 |
| Zakres SEFS | **tylko stawka drogowa**; nie ferry eco / demurrage / extras | **USTALONE** | `sefs.ts` nagłówek; `pricing.ts:37–39` |
| Baza kontraktowa | SEK **19.47** · PLN **5.698** | **USTALONE** | `sefs-tables.json` `base`; `BAF_SEFS.md` §4 |
| Źródła indeksu | OKQ8 GoEasy Diesel B2B · ORLEN Ekodiesel hurt | **USTALONE** (URL) | `BAF_SEFS.md` §Źródła · `SEFS_SOURCES` |
| Snapshoty tygodniowe w kodzie | W36–W38 2026 (ceny 19.12–19.68 SEK / 5.62–5.74 PLN) | **DEMONSTRACYJNE** (wartości) / **USTALONE** (mechanizm) | `sefs.ts` `SEFS_WEEKLY` — nie live scrape |
| `BAF_PARAMS` UI (Opcje) | legacy pola — **nie zasilają** `computeSefs` | **DEMONSTRACYJNE / FASADA** | `OptionsView` · `seed.ts` `BAF_PARAMS` → D25 / F2.4-c |
| Live ORLEN/OKQ8 | brak fetch w SPA | — | atrapa indeksu = seed |

### 2.2 Tabela zgodności F2.4 (doc ↔ kod)

Kolumny: `reguła z dokumentu | cytat, plik, sekcja | kod: plik, linia | zgodne?`

| # | reguła z dokumentu | cytat, plik, sekcja | kod: plik, linia | zgodne? |
|---|---|---|---|---|
| 1 | Źródło hurt SE (SEK) | „OKQ8 GoEasy Diesel (listowa B2B)” + URL okq8.se — `BAF_SEFS.md` §Źródła | `sefs-tables.json` `sources.sek` / `urls.okq8`; `sefs.ts` `SEFS_SOURCES` 25–32 | **tak** |
| 2 | Źródło hurt PL (PLN) | „ORLEN Ekodiesel” + URL orlen.pl hurt — `BAF_SEFS.md` §Źródła | `sources.pln` / `urls.orlen`; `SEFS_SOURCES.orlen` | **tak** |
| 3 | Częstotliwość odczytu | „Cotygodniowa korekta” — `BAF_SEFS.md` §1 pkt 1 | Brak live scrape; snapshoty `SEFS_WEEKLY` W36–W38 (`sefs.ts` 81–85) — tygodniowy rytm demonstracyjny | **częściowo** (mechanizm tygodniowy tak; automatyczny odczyt **nie**) → **F2.4-b** |
| 4 | Budowa tablicy `SEFS_SEK` | Tabela SEK „cena do (włącznie) → mnożnik” — `BAF_SEFS.md` §Tabela SEK | `sefs-tables.json` `sek[]` → `SEFS_SEK` (`sefs.ts` 34); `lookupMult` 38–45 (`lte` włącznie) | **tak** (treść 1:1 z md) |
| 5 | Budowa tablicy `SEFS_PLN` | Tabela PLN — `BAF_SEFS.md` §Tabela PLN | `sefs-tables.json` `pln[]` → `SEFS_PLN` (`sefs.ts` 35) | **tak** |
| 6 | Hybrid = niższy mnożnik | „do rozliczenia **niższy z dwóch mnożników**” — `BAF_SEFS.md` §2 | `computeSefs` → `Math.min(multSek, multPln)` (`sefs.ts` 50–59) | **tak** |
| 7 | Zakres tylko stawka drogowa | „tylko stawka transportu drogowego — nie anulowanie… ani przestoje” — `BAF_SEFS.md` §6 | `applySefsToRoadRate` + `pricing.ts` 37–54 (ferryEco/extras poza SEFS) | **tak** |
| 8 | Zaokrąglenie ceny indeksu | „zaokrąglenie 2 miejsca” — `BAF_SEFS.md` §3 | `round2` przed lookup (`sefs.ts` 47–48, 56–57); wynik drogi `Math.round(…*100)/100` (`sefs.ts` 62–64) | **tak** |
| 9 | Progi „do X” / poza tabelą | „do X” = ≤ X; poniżej pierwszego → pierwszy; powyżej ostatniego → ostatni — `BAF_SEFS.md` §7 | `lookupMult` (`sefs.ts` 38–45) | **tak** |
| 10 | Minimum / maksimum mnożnika | Brzegi tabel (SEK 0.92…1.50, PLN 0.93…1.41) — `BAF_SEFS.md` tabele; **brak** floor%/cap% w załączniku | Kod: brzegi z tablic. UI Opcje `floorPct`/`capPct` **nie** wchodzą do `computeSefs` | **tak** (kontrakt); UI % = fasada → F2.4-c |
| 11 | Baza kontraktowa 1,00 | OKQ8 **19,47** SEK/l · ORLEN **5,698** PLN/l — `BAF_SEFS.md` §4 | `sefs-tables.json` `base.sek/pln`; tier PLN `lte:5.7 → 1.0` (5.698 po `round2` → 5.70) | **tak** |

**Podsumowanie tabeli:** **9 zgodne** · **1 częściowo (F2.4-b)** · **0 sprzecznych w samym `computeSefs`** · fasada Opcji osobno (F2.4-c). Konflikt daty SEFS: F2.4-a.

### 2.3 Który odczyt indeksu obowiązuje w danej dacie

| Źródło | Reguła | Cytat |
|---|---|---|
| **`BAF_SEFS.md` (obowiązujący)** | Cena = **średnia arytmetyczna** cen ON z **poprzedniego** tygodnia kalendarzowego (pon–niedz), 2 dp. Mnożnik stosuje się do zleceń z **datą załadunku** w tygodniu zastosowania. | §3–§5: „średnia… z poprzedniego tygodnia”; „datą załadunku w danym tygodniu” |
| Kod (`sefs.ts`) | **Nie liczy** średniej z dziennych odczytów. Bierze gotowe `priceSek`/`pricePln` z `SEFS_WEEKLY` dla okna `weekStart…weekEnd` zawierającego `loadDate`, inaczej ostatni snapshot. | `sefsForLoadDate` 87–90; `SEFS_WEEKLY` 81–85 (note: „Mean Mon–Sun…”) |
| `MECHANIZM_PIENIEDZY.md` | Od 04.10 (D-34, U-3-PALIWO) opłata paliwowa wg **daty załadunku**. Kurs NBP nadal wg rozładunku. Starszy zapis o dniu rozładunku jako dacie paliwa jest zastąpiony. | §4, adnotacja 04.10 |

**Wniosek:** dokument SoT SEFS **nie milczy** — reguła to **średnia z poprzedniego tygodnia**, nie „ostatni odczyt przed datą” ani „z tego samego dnia”. Fasada `SEFS_WEEKLY` w `sefs.ts` nadal nie liczy tej średniej (demo) → **F2.4-b**. Produkcja liczy średnią w `sefs_week_calc` (migracja 0155) z `fuel_index_readings`. Kotwica daty: SoT SEFS = **załadunek**; od 04.10 MECHANIZM i migawka (`fuel_ref_date`, `fuelLocalDate`) też = **załadunek**. Konflikt F2.4-a (MECHANIZM kontra BAF) **zamknięty 04.10**. Jeden opis mechanizmu: `docs/watch-tower/BAF_SEFS.md`. Pieniądze i kurs: `MECHANIZM_PIENIEDZY.md`.

**32.1** Jeden obowiązujący opis mechanizmu SEFS: `docs/watch-tower/BAF_SEFS.md`. `MECHANIZM_PIENIEDZY.md` nie buduje tablic.

**32.5** Pola Opcji poniżej nie wchodzą do `computeSefs` (bez zmian 04.10).

**33.4** Odczyt obowiązujący w dacie załadunku: średnia poprzedniego tygodnia pon–niedz. Bez odczytów mnożnik nie jest zgadywany.

### 2.4 Opcje UI → `computeSefs`

`computeSefs(priceSek, pricePln)` (`sefs.ts` 50–59) przyjmuje **wyłącznie dwie ceny**. Wycena: `sefsForLoadDate` → `SEFS_WEEKLY` (`pricing.ts` 50–54). Store `baf` / `updateBaf` **nigdzie** nie jest czytany w `sefs.ts` / `pricing.ts` / `scxRates.ts`.

| Pole Opcje (`bafFields`) | Zapis do `store.baf`? | Zasila `computeSefs`? | Uwaga |
|---|---|---|---|
| `indexSource` | tak | **nie** | fasada |
| `baseValue` (UI: SEK/l) | tak | **nie** | baza kontraktowa jest w JSON, nie z UI |
| `baseDate` | tak | **nie** | fasada |
| `currentValue` (UI: SEK/l) | tak | **nie** | nie podaje PLN; nie woła `computeSefs` |
| `valueDate` | tak | **nie** | fasada |
| `fuelShare` | tak | **nie** | brak w `BAF_SEFS.md` |
| `triggerThreshold` | tak | **nie** | brak w SoT |
| `roundingStep` | tak | **nie** | kod ma stałe `round2` |
| `floorPct` | tak | **nie** | brak w SoT |
| `capPct` | tak | **nie** | brak w SoT |
| `sourceUrl` | tak | **nie** | URL-e z JSON |

Nota UI (`OptionsView` ~110): „Parametry są zapisywane do `baf` i **używane przy kolejnych snapshotach wyceny**” — **fałsz** względem kodu → D25 / F2.4-c.

**Lista D25 (pola Opcje BAF/SEFS bez zasilania `computeSefs`):**  
`indexSource`, `baseValue`, `baseDate`, `currentValue`, `valueDate`, `fuelShare`, `triggerThreshold`, `roundingStep`, `floorPct`, `capPct`, `sourceUrl` (+ myląca nota panelu).

---

## 3. FX (kursy)

| Parametr | Wartość | Status | Dowód |
|---|---|---|---|
| Live NBP / FX client | **brak** w SPA | PLANOWANE (research) | `00_KONTEKST` A3 · `START_API_NOTES` poza P0 |
| Waluta snapshotów load | często **`PLN`** w seed pricing | **DEMONSTRACYJNE** | `seed.ts` / typ `LoadPricing.currency` |
| Cennik SCX SoT | **EUR** | **USTALONE** | `scx-rates-base.json` |
| Konwersja EUR↔PLN w runtime | **niezaimplementowana** | — | brak modułu FX |

---

## 4. Factoring

| Parametr | Wartość | Status | Dowód |
|---|---|---|---|
| Domyślna oferta HHL | enabled · fee **2.5%** · delay **48 h** · label `SCX Factoring` | **DEMONSTRACYJNE** | `useTowerStore.ts` `DEFAULT_FACTORING_OFFER` |
| Snapshot na fakturze | `feeAmount`, `netPayout`, `payoutAt` | **USTALONE** (logika) | `buildFactoringSnapshot` |
| Role | HHL konfiguruje ofertę; SCX wybiera tryb przy złożeniu | **USTALONE** (UX) | `permissions` + `InvoicesView` · QA PUNKT9 #14 |
| Seed faktur | feePct mieszane (m.in. 2.0) | **DEMONSTRACYJNE** | `seed.ts` ~1117+ |
| Realny bank/factor API | brak | — | makieta store-only |

---

## 5. Kody / typy opóźnień i ryzyk

Brak osobnej tabeli „delay codes” IATA-style. W modelu:

| Kod / typ | Znaczenie | Status | Dowód |
|---|---|---|---|
| `LoadStatus.DELAYED` | flaga opóźnienia | **USTALONE** (enum) | `types/index.ts` |
| `LoadStatus.SILENT` | brak pingów (>90 min w ETA) | **USTALONE** (enum + ETA) | `eta.ts` `silent >90` |
| `RiskType`: `FERRY` · `ROAD_SE` · `DOC` · `OPS` · `FORCE_MAJEURE` | klasy wyjątków | **USTALONE** | `types` · seed risks |
| TV CRITICAL → `FORCE_MAJEURE`, inaczej `ROAD_SE` | mapowanie Situation | **USTALONE** (reguła makiety) | `trafikverket.ts` `riskTypeForSituation` |
| `FerryBooking.status` `DELAYED` | opóźnienie promu (+2 h wait w ETA) | **USTALONE** (logika) | `eta.ts:152–154` |
| `applyForceMajeureDelays` | bump ETA o `impactHours` risku | **DEMONSTRACYJNE** wielkości | `seed.ts` |
| Pill UI `+1h 35 min` | stały string | **DEMONSTRACYJNE / ATRAPA** | `LoadDrawer.tsx:137,221` · `02_FASADA` |

---

## 6. Progi i limity

| Parametr | Wartość | Status | Dowód |
|---|---|---|---|
| Próg marży (flaga) | **`marginPct < 0.12`** → `belowThreshold` | **USTALONE** (reguła makiety) | `pricing.ts:73` · Finance KPI |
| Match faktury | \|diff\| ≤ **50** → MATCHED, else DISPUTED | **USTALONE** (reguła) | `pricing.ts` `matchInvoice` default `threshold=50` |
| Stress seed marży | SG-15/22/08, SS-02 → 9% | **DEMONSTRACYJNE** | `seed.ts` `buildSeedLoads` |
| Extras default w `buildPricing` | **800** (gdy brak opts) | **DEMONSTRACYJNE** | `pricing.ts:56` |
| Rev ferry/extras markup | `ferryEco×1.05`, `extras×0.75` | **DEMONSTRACYJNE** | `pricing.ts:58` |
| Import: `accepted===0` | commit zablokowany, baza nietknięta | **USTALONE** (integralność) | `commitImport` · ScheduleView disabled |
| READY gate | blokada gdy cover/mismatch/`docMissing`/`!permitFits` | **USTALONE** | `permits.ts` `isReadyBlocked` · FIX_READY_GATE |
| Densystość / waga import | `WEIGHT_INCONSISTENT` odrzuca wiersz | **USTALONE** (walidator) | `scheduleParse.ts` |
| Limity zezwoleń PL/SE | wg research GDDKiA / TSFS | **USTALONE** (SoT docs) | `PERMITS_PL_SE.md` · `permits-config.json` |

---

## 7. Cykl fakturowania

| Parametr | Wartość | Status | Dowód |
|---|---|---|---|
| Etykieta tygodnia w UI | „tydzień **38** · 14–20.09.2026” | **DEMONSTRACYJNE / ATRAPA** | `InvoicesView.tsx:62` — nie z `getNow()` |
| Agregat tygodnia | `loads` filtrowane do „week” w widoku | **DEMONSTRACYJNE** | `InvoicesView` `useMemo` week |
| Delty demo sporu | +**1240** / +**600** PLN na i===2 / i===4 | **DEMONSTRACYJNE / ATRAPA** | `InvoicesView.tsx:37,73` |
| Statusy faktury | m.in. złożenie SCX · spór/zatwierdzenie HHL · factoring snapshot | **USTALONE** (przepływ UI) | store `submitInvoice` / `resolveInvoice` · FN2 #7 |
| Powiadomienie seed | „Różnica >50 PLN na linii SG-04” | **DEMONSTRACYJNE** | `seed.ts` |

---

## 8. Kotwice korytarza (adresy)

| Punkt | Współrzędne | Status | Dowód |
|---|---|---|---|
| LOADING KSH Śrem | 52.07391, 17.02460 | **USTALONE** | `status.ts` `SITES` · `ADDRESSES.md` · START_API_NOTES |
| Port Gdańsk (orient.) | 54.39, 18.72 | **USTALONE** (orient.) | j.w. |
| Nynäshamn | 58.90, 17.95 | **USTALONE** (orient.) | j.w. |
| SITE Boden | 65.80539, 21.75914 | **USTALONE** | j.w. |

---

## 9. Skrót dla buildera

- Wycena produkcyjna w makiecie = **bracket RATE_*** + **SEFS_WEEKLY**, nie kolumna „aktualna” z Excela.  
- Factoring / tydzień faktur / delty sporu = **demo**, nie umowa.  
- 12% marży i ±50 PLN match = **stałe reguły kodu** (ustalone w makiecie; potwierdzić z biznesem przed Etapem D).  
