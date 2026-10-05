# STATUS PLANU — część B, C i przed pilotażem (05.10.2026 ~12:40 PL)

Źródło: `PLAN.md` + main `4e2d45d` (po D-78/H-3 PR #84, barlow #85, C-SEP #82/#83).  
Pozycja bez dowodu = **do zrobienia**.  
Czeka właściciel / zewnętrzne = **bez budowy**.

---

## 1. Część B

| ID | Status | Dowód | Na co czeka |
|---|---|---|---|
| B-1 | **DONE** | PR #4 (`70d1c95` / `925ef37`) | — |
| B-2a | **DONE** | panel Ryzyka, `upcomingOutboundSailings` | — |
| B-2b | **DONE** | H-2 / Trafikverket Situation 1.6 | — |
| B-2c | **DONE** | `LOGIKA_SYSTEMU.md` §1 | — |
| B-3a | **czeka właściciel** | — | D-83 (wymiary) |
| B-4a | **DONE** | usunięte wiersze pilotażu przychodu | — |
| B-4b | **DONE** | Faktury: tylko CMR | — |
| B-5 | **DONE** | PR #76, 0165 | — |
| B-6a…B-6i | **DONE** | PR #74, 0164 | — |
| B-MAPA | **DONE** | PR #61/#62; Q-18 PR #64 | — |
| PL-PLURAL | **DONE** | PR #63 | — |
| B-7a | **DONE** | `tests/b7-map.spec.ts` | — |
| B-7b | **DONE** | `tests/b7-map.spec.ts` | — |
| B-7c | **DONE** | PR #80, wariant A | — |
| B-8 | **DONE** | PR #80 | — |
| B-8-IMP | **DONE** | PR #5; 0137 | — |
| B-9 | **DONE** | PR #80, wariant C | — |
| Q-9 | **DONE** | PR #80, wariant B | — |
| PALIWO-AUTO-A/B | **DONE** | próbka + PR #79 / 0168 | — |
| SEFS-KOREKTA | **DONE** | PR #77, 0166 | — |
| SMS-SILENT-FIX | **DONE** | 0167 | — |
| MIG-0159-REG | **DONE** | ewidencja 0159 | — |
| B-10 | **do zrobienia** | częściowo: C-SEP/B-KSH/B-REJSY (#82) | — (budowa luk) |
| B-KSH | **DONE** | PR #82 PlanDatesPanel Edytuj | — |
| B-REJSY | **DONE** | PR #82 filtr Przyszłe, rok, HHL_ADMIN | — |
| B-Q | **do zrobienia** | część w L-* / Q-17–19; brak zbiorczego dowodu | — (dokumentacja) |
| Q-11a | **do zrobienia** | — | — (5 rozmiarów) |
| Q-11b | **do zrobienia** | — | — (push Android/iOS) |
| Q-17 | **DONE** | B-MAPA PR #61/#62 | — |
| Q-18 | **DONE** | PR #64 | — |
| Q-19 | **DONE** | B-MAPA logistics tiles | — |

## 2. Część C

| ID | Status | Dowód | Na co czeka |
|---|---|---|---|
| C-SEP | **DONE** | PR #82/#83, 0169, `cSep.ts` | SharePoint zapis = II-10-E2 |

## 3. Szczególnie wskazane

| ID | Status | Dowód | Na co czeka |
|---|---|---|---|
| HHL-4a | **DONE** | Dodaj/Edytuj + awizacja | SharePoint = II-10-E2 |
| FAK-9 | **DONE** | M6 / invoices3 | — |
| UI-12 | **DONE** | Nav session | — |
| D-31 | **DONE** | CSS ≤430; RESP-14 | — |
| D-27 | **DONE** | kontrast `--ink-3` | — |

## 4. Kolejka przed B / nocna

| ID | Status | Dowód | Na co czeka |
|---|---|---|---|
| U-3-PALIWO…PALIWO-33.3 | **DONE** | 0155–0161, #59, money tests | — |
| DIAGNOZA-ETA | **DONE** | `DIAGNOZA_ETA_05_10.md` | — |
| VERIFY-13 | **do zrobienia** | — | — (raport bez kodu) |

## 5. Po części B

| ID | Status | Dowód | Na co czeka |
|---|---|---|---|
| D-78 | **DONE** | PR #84, 0170; **0172** pule potwierdzone (tiles 30000 Advanced Raster / routes 5000 Truck; źródło: konto HERE właściciela, 05.10) | — |
| H-1 | **zbudowane, wyłączone** | 0153; flaga false | D-83 |
| H-2-PL | **DONE** | 0171, HERE Traffic w `road-pl`, raport `RAPORT_D78_ZGODNOSC_05_10.md` | — |
| H-3 | **zbudowane, wyłączone** | PR #84 Routing v8, bez Attributes | D-83 |
| H-6 | **zbudowane, wyłączone** | B-MAPA warstwa | D-83 |
| H-7 | **do zrobienia** | — | — |
| H-8 | **do zrobienia** | — | — |
| H-10 | **do zrobienia** (ryzyko); ETA+wiatr po emtrack | — | ETA → TELM-2 |
| H-12 | **do zrobienia** | — | — |
| H-4 / H-5 | **czeka zewnętrzne** | — | TELM-2 |
| TELM-EMTRACK-WEB | **ZBUDOWANE (flaga false)** | 0173+0174 cron, Edge, raport 05.10; fix rk_source_down | włączenie HHL + sekrety Edge |
| CLEAN-MAPLIBRE | **DONE** | brak maplibre/mapbox | — |
| AUTH-MAIL | **DONE** | POSTEP 02.10 | — |
| I-29 | **DONE** | `I29_BUDGETY_140.md` | — |
| GATE-WEEKLY | **RYTM** | — | **11.10.2026** |
| SEC-OWASP | **do zrobienia** | — | ostatnia przed pilotażem |

## 6. Tylko lista — bez budowy

**Czeka właściciel:** D-83 → B-3a, H-1/H-3/H-6; R-0; D-3, D-7, D-14, D-16, D-17, D-21.  
**Zewnętrzne:** TELM-2 (emtrack); II-10-E1 (IT KSH).

## 7. Kolejka budowy (po H-2-PL ~12:40+)

1. VERIFY-13 (raport) → B-10 (luki) → B-Q (dokumentacja) → Q-11a → Q-11b  
2. H-7 → H-8 → H-10 (ryzyko wiatru) → H-12  
3. SEC-OWASP (ASVS L2)

H1/H3/H6: **false**. Obie domeny 200 po wdrożeniu.
