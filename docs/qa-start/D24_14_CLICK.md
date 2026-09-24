# D24 — pełny przebieg 14 prób (click)

| Pole | Wartość |
|---|---|
| When | **2026-09-24 02:29 CEST** (Europe/Warsaw) |
| App URL | `http://127.0.0.1:4177/#/?now=2026-09-23T14%3A32%3A00Z` |
| HEAD | `86050d10fbc0bf2ba05f9f1e447411489715a322` |
| Tree | `d305c2453055ee15961ec576bff5c98ee254d83a` |
| Tag | `etap-c-2026-09-23` (present) |
| JS bundle | `/assets/index-BqvbHwzw.js` |
| **appChecksum** (sha256 JS) | `d91ce4c3786451f20adf3ec8fead38c8d39dc8ed5a464ebb67c84a24762474fa` |
| CSS | `/assets/index-KIdUC5RD.css` |
| CSS sha256 | `320c485d3e0db9beceab44ed2e8e85d61c83be34ab07f345e4f11d7f079733b1` |
| Runner | `scripts/d24-14-click.mjs` (+ targeted reprobes #3, #13) |
| Posture | Prefer **FAIL**; no product code changed |

## Scorecard #1–#14

| # | Verdict | Evidence (1 line) | Screenshot |
|---:|---|---|---|
| 1 | PASS | mutations: exportXlsx size=14656; resources tractor=D24-TR-KI3Y on SG-34; map nav→leaflet; wf run notifs 13→14 | `docs/qa-start/d24/01-mutations.png` |
| 2 | PASS | blocked=K-03 disabled=true status=RESOURCES_PENDING title=docMissing flag; shot=docs/qa-start/d24/02-ready-blocked.png; cover READY on P-02 | `docs/qa-start/d24/02-ready.png` |
| 3 | PASS | HHL/SCX: Eksport XLSX yes, Wgraj no; KSH: Wgraj yes; export blob ~14.6KB; dry-run p9r-merge-plus1-valid.xlsx → +1/~72/−0/⚠0; Zatwierdź → loads 72→73 with QA-RECLICK-923; SG-01 preserved | `docs/qa-start/d24/03-commit.png` |
| 4 | PASS | persist on SG-02: tractor/pilot=D24-PIL-KW09; booking=D24-AW-KW09; wrote={"res":true,"awiz":true,"ferry":false,"reasons":[]} | `docs/qa-start/d24/04-ustalenia.png` |
| 5 | PASS | clicked=Przelicz; PLAN_B events 0→1; notifs 14→15; ferryPresent=true | `docs/qa-start/d24/05-planb.png` |
| 6 | PASS | docs 432→432; hit=doc-muesl003-holsq; uiHasAttach=true | `docs/qa-start/d24/06-driver.png` |
| 7 | PASS | geo rows=13; leaflet=true; ais=true; fleet=true; tv=true | `docs/qa-start/d24/07-map-layers.png` |
| 8 | PASS | Trafikverket=seed; AIS=seed; lines=["Schemat korytarza, nie mapa nawigacyjna. Trasa lądowa w Szwecji odwzorowuje przebieg z zezwolenia, nie wynik routera. Trafikverket E4: seed · AIS: seed · GPS fleet tick co 1,5 s. Kolu… | `docs/qa-start/d24/08-trafikverket.png` |
| 9 | PASS | HHL feeEdit=true fee=3.7; SCX={"ok":true,"label":"Płatność standardowa"}; offer={"enabled":true,"feePercent":3.7,"payoutDelayValue":48,"payoutDelayUnit":"hours","label":"SCX Factoring","notes":""} | `docs/qa-start/d24/09-factoring-scx.png` |
| 10 | PASS | SEFS/BAF render: ORLEN=true OKQ8=true; pct=15,0%,1,0%,15,3%,13,2%,15,1%,20,5%,16,0%,16,0%; PLN=5.70 PLN,5.74 PLN | `docs/qa-start/d24/10-sefs.png` |
| 11 | PASS | bell unread 16→0; spine 121Przygotowanie cleared=true; KPI→Powiadomienia | `docs/qa-start/d24/11-kpi.png` |
| 12 | PASS | band=HIGH; range=true; lines=["ETA Boden","05.10.2026, 14:00 w oknie HIGH","pasmo 0.0–0.0 h · heurystyka · prom Wawel"] | `docs/qa-start/d24/12-eta.png` |
| 13 | PASS | HHL table headers Przychód/Koszt/Marża + values; KSH lock: "Stawki przewoźnika i marża spedytora nie są dostępne w roli klienta."; SCX lock: "Cena płacona przez KSH i marża spedytora nie są dostępne w roli przewoźnika." | `docs/qa-start/d24/13-reprobe-hhl.png` |
| 14 | PASS | Grunwaldzka 27C + Stalverket 20 visible ({"srem":true,"boden":true,"sremLoose":true,"bodenLoose":true}) | `docs/qa-start/d24/14-addresses.png` |

## Fail list

(none)

## Verdict

**SHIP** — **14/14 PASS**

Fala 0 gate item D24 closed by this report. D26 / Fala 1 **not started**.

## Notes

- Frozen clock: `?now=2026-09-23T14:32:00Z` (CEST wall 16:32 on UI).
- #3 commit exercised after Podgląd zmian; merge preserved SG-01.
- #13 initial auto-probe was weak (label+digit regex); role lock copy confirmed via reprobe screenshots — HHL sees Przychód/Koszt/Marża; KSH/SCX see explicit denial strings.
- Screenshots: `docs/qa-start/d24/`.
- Machine JSON: `docs/qa-start/d24/results.json`.
