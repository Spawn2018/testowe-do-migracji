# FINAL QA — START sprint (static + click)

- **URL:** http://127.0.0.1:4177/ · AIS http://127.0.0.1:4175/
- **When:** 2026-09-23 ~00:58 CEST
- **Overall: FIX** (nie SHIP)

## Scorecard (reconciled)

| # | Gate | Static | Click | **Final** | Notes |
|---|------|--------|-------|-----------|-------|
| 1 | Roles HHL/KSH/SCX only | PASS | PASS | **PASS** | `01-roles.png` |
| 2 | MapLibre + trucks + AIS | PASS | FAIL | **FAIL** | Canvas bez tiles; MapLibre worker error; AIS seed (brak klucza). `02-map.png` |
| 3 | Collapsible / glass / logos | PASS | PASS | **PASS** | `03`/`04` |
| 4 | Bell mark-read | PASS | PASS | **PASS** | 13→12; delete≠read. `05`/`06` |
| 5 | KPI/spine/exception deep-links | FAIL | PASS | **FIX** | Klik: KPI/spine/exception działają. Kod: 2. klik spine nie clear (regres). |
| 6 | DnD dry-run→commit | FAIL | PASS | **FIX** | Flow UI PASS; dry-run nadal hardcode (brak parse XLSX). `09-schedule-dry-run.png` |
| 7 | ≥62 + Kratownice + PERIOD\|TRIP\|REGULATION | PASS | FAIL | **FIX** | Seed: 62 + K-01..03 W=3.6 (PERIOD/TRIP). Klik: tabela 64 po imporcie; UI cover głównie PERIOD; TRIP/REGULATION słabo widoczne. |
| 8 | demo-sg14 → SG-14 | PASS | PASS | **PASS** | `12`/`13` |
| 9 | SCX Koszt tyg | PASS | PASS | **PASS** | `14-scx-dashboard.png` |
| 10 | No dead / hollow | FAIL | PASS* | **FIX** | Primary CTA OK; SG-09 Set READY mimo braku permit = dziura reguł. |

## Blokery do SHIP
1. Naprawić MapLibre tiles (worker/CDN) + sensowny AIS key lub uczciwy banner seed
2. Spine: drugi klik musi clear filter
3. Import: parse XLSX albo label „symulacja” bez claimu real file
4. Permit UI: pokazać TRIP/REGULATION cover; READY zablokowane przy gap
5. Hollow mocks (ZIP/kamera/Plan B) albo wyrzuć z primary

## Screenshots
`/workspace/watch-tower/qa-start/01-roles.png` … `14-scx-dashboard.png`

## Polish verdict (Sebastian)
START sprint: **FIX**. Duży skok (role, bell, glass, DnD flow, driver token, SCX koszt, ≥62). Nie SHIP przez mapę bez tiles, fake dry-run pod spodem, spine clear i READY bez permit.
