# STATUS PLANU — część B, C i przed pilotażem (05.10.2026 ~11:45 PL)

Źródło: `PLAN.md` + dowody z main (`94cd582` + Hobby B-UI).  
Pozycja bez dowodu = **do zrobienia**.  
Czeka właściciel / zewnętrzne = **bez budowy** (tylko lista).

---

## 1. Część B

| ID | Status | Dowód | Na co czeka |
|---|---|---|---|
| B-1 | **DONE** | PR #4 (`70d1c95` / `925ef37`) | — |
| B-2a | **DONE** | panel Ryzyka, `upcomingOutboundSailings` (05.10) | — |
| B-2b | **DONE** | H-2 / Trafikverket Situation 1.6 | — |
| B-2c | **DONE** | `LOGIKA_SYSTEMU.md` §1 | — |
| B-3a | **czeka właściciel** | — | D-83 (wymiary) |
| B-4a | **DONE** | usunięte wiersze pilotażu przychodu (05.10) | — |
| B-4b | **DONE** | Faktury: tylko CMR; wzorzec | — |
| B-5 | **DONE** | PR #76, migracja 0165, `dpl_8m39851J3SY5MFcdUJq8CfDj2k96` | — |
| B-6a…B-6i | **DONE** | PR #74, migracja 0164 (B-6e) | — |
| B-MAPA | **DONE** | PR #61/#62; Q-18 → PR #64 | — |
| PL-PLURAL | **DONE** | PR #63, `src/lib/plPlural.ts` | — |
| B-7a | **DONE** | `tests/b7-map.spec.ts`; wzorzec 05.10 | — |
| B-7b | **DONE** | `tests/b7-map.spec.ts` | — |
| B-7c | **DONE** | PR #80, wariant A (brak GPS, ryzyko) | — |
| B-8 | **DONE** | PR #80: zakres dat, bez kierowcy/ciągnika, Zmień ciągnik | — |
| B-8-IMP | **DONE** | PR #5 import pomija STANDARD; 0137 usuwa 42 NTG (`b9505d3`) | — |
| B-9 | **DONE** | PR #80, wariant C (× + kafelek Prom) | — |
| Q-9 | **DONE** | PR #80, wariant B (motyw systemu) | — |
| PALIWO-AUTO-A | **DONE** | `PALIWO_PROBKA_2A_05_10.md`; akceptacja ~10:37 | — |
| PALIWO-AUTO-B | **DONE** | PR #79, 0168; OKQ8 Q8 Trucks Diesel 22,90 | — |
| SEFS-KOREKTA | **DONE** | PR #77, 0166 | — |
| SMS-SILENT-FIX | **DONE** | 0167, `4b562d2` / `79674c8`; próg 30 + cooldown 60 | — |
| MIG-0159-REG | **DONE** | `79674c8` ewidencja 0159 na PROD | — |
| B-10 | **do zrobienia** | — | — (budowa) |
| B-KSH | **do zrobienia** | — | — (budowa) |
| B-REJSY | **do zrobienia** | — | — (budowa) |
| B-Q | **do zrobienia** | część pytań zamknięta w L-* (bez pełnego dowodu B-Q) | — (dokumentacja + reszta) |
| Q-11a | **do zrobienia** | — | — (budowa / test 5 rozmiarów) |
| Q-11b | **do zrobienia** | — | — (push Android/iOS) |
| Q-17 | **DONE** | B-MAPA PR #61/#62 — trasa promu z historii AIS po wodzie (`draw.ts`) | — |
| Q-18 | **DONE** | PR #64, `tests/bmapa.test.ts` | — |
| Q-19 | **DONE** | B-MAPA — HERE logistics tiles z etykietami | — |

## 2. Część C

| ID | Status | Dowód | Na co czeka |
|---|---|---|---|
| C-SEP | **do zrobienia** | — | — (budowa; SharePoint zapis = II-10-E2) |

## 3. Szczególnie wskazane (już poza B/C w PLAN)

| ID | Status | Dowód | Na co czeka |
|---|---|---|---|
| HHL-4a | **DONE** | Dodaj/Edytuj + awizacja/szuflada | zapis SharePoint = II-10-E2 / D-33 |
| FAK-9 | **DONE** | M6 / invoices3 | — |
| UI-12 | **DONE** | Nav session; Docs/Schedule | — |
| D-31 | **DONE** | CSS ≤430; RESP-14; G4-D27-D31 | — |
| D-27 | **DONE** | kontrast `--ink-3`; G4 | — |

## 4. Przed częścią B / kolejka nocna (aktualizacja statusów)

| ID | Status | Dowód | Na co czeka |
|---|---|---|---|
| U-3-PALIWO | **DONE** | 0155 | — |
| DIAGNOZA-ETA | **do zrobienia** | — | — (tylko raport, bez kodu) |
| DRV-CLOSE | **DONE** | 0156 | — |
| STD-CLEAN | **DONE** | 0157 | — |
| SMS-KSH-1H + ETA-PRE-LOAD | **DONE** | 0158 | — |
| AIS-SRC | **DONE** (pomiar 24 h otwarty) | PR #56/#64, 0159/0163 | pomiar 24 h |
| FERRY-STATUS | **DONE** | 0160 | — |
| PL-DATA | **DONE** | PR #59, 0161 | — |
| VERIFY-13 | **do zrobienia** | — | — (weryfikacja bez kodu) |
| PALIWO-33.3 | **DONE** | `tests/money.test.ts` | — |

## 5. Po części B (kolejność właściciela 05.10 ~11:43)

| ID | Status | Dowód | Na co czeka |
|---|---|---|---|
| H-2-PL | **do zrobienia** | — | — (HERE utrudnienia PL) |
| H-6 | **czeka właściciel** | warstwa w B-MAPA, flaga wyłączona | D-83 |
| H-7 | **do zrobienia** | — | — |
| H-8 | **do zrobienia** | — | — |
| H-10 | **do zrobienia** (ryzyko wiatru); ETA+wiatr po emtrack | — | wydłużanie ETA → TELM-2 / H-4 |
| H-12 | **do zrobienia** | — | — |
| H-4 / H-5 | **czeka zewnętrzne** | propozycja w POSTEP | TELM-2 (emtrack) |
| CLEAN-MAPLIBRE | **do potwierdzenia** | `package.json` bez maplibre (04.10) | — (potwierdzenie) |
| AUTH-MAIL | **DONE** | POSTEP 02.10 — szablony Auth „Watch Tower” | — |
| I-29 | **DONE** | `I29_BUDGETY_140.md` | — |
| GATE-WEEKLY | **RYTM** | brama TEST niedziela | następna: **11.10.2026** |
| SEC-OWASP | **do zrobienia** | — | po całej kolejce P1 przed pilotażem |

## 6. Tylko lista — bez budowy

**Czeka właściciel:** D-83 → B-3a, H-1/H-3 (już zbudowane, wyłączone), H-6; R-0 (plan czyszczenia do akceptacji); D-3, D-7, D-14, D-16, D-17, D-21.

**Dane zewnętrzne:** TELM-2 (emtrack) → H-4/H-5/H-10 ETA; II-10-E1 (IT KSH) → SharePoint etap 1.

## 7. Kolejka budowy (ten przebieg)

1. DIAGNOZA-ETA (raport) → VERIFY-13 (raport) → CLEAN-MAPLIBRE (potwierdzenie)
2. C-SEP → B-KSH → B-REJSY → B-10 (paczki) → B-Q (domknięcie dokumentacji) → Q-11a → Q-11b
3. H-2-PL → H-7 → H-8 → H-10 (ryzyko) → H-12
4. SEC-OWASP (ASVS L2 + ZAP pasywny + zależności + RLS)

H1/H3/H6 flagi: **false**. Obie domeny 200 po każdym wdrożeniu.
