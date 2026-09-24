# 03 · Parametry biznesowe

| Pole | Wartość |
|---|---|
| Data | **2026-09-23** Europe/Warsaw |
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

| Parametr | Wartość | Status | Dowód |
|---|---|---|---|
| Model | **hybrid_min**: `appliedMult = min(mult_sek, mult_pln)` | **USTALONE** | `sefs-tables.json` `rule`; `sefs.ts` `computeSefs`; `BAF_SEFS.md` |
| Zakres SEFS | **tylko stawka drogowa**; nie ferry eco / demurrage / extras | **USTALONE** | `sefs.ts` nagłówek; `pricing.ts:37–39` |
| Baza kontraktowa | SEK **19.47** · PLN **5.698** | **USTALONE** | `sefs-tables.json` `base` |
| Źródła indeksu | OKQ8 GoEasy Diesel B2B · ORLEN Ekodiesel hurt | **USTALONE** (URL) | `SEFS_SOURCES` · `sefs-tables.json` `sources.urls` |
| Snapshoty tygodniowe w kodzie | W36–W38 2026 (ceny 19.12–19.68 SEK / 5.62–5.74 PLN) | **DEMONSTRACYJNE** (wartości) / **USTALONE** (mechanizm) | `sefs.ts` `SEFS_WEEKLY` — nie live scrape |
| `BAF_PARAMS` UI | `indexSource: SEFS_HYBRID_…`, `baseValue: 19.47`, `currentValue: 19.68`, `capPct: 2`, … | **DEMONSTRACYJNE** pola legacy UI | `seed.ts` `BAF_PARAMS`; realna wycena idzie przez `SEFS_WEEKLY` |
| Live ORLEN/OKQ8 | brak fetch w SPA | — | atrapa indeksu = seed (patrz `02_FASADA`) |

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
