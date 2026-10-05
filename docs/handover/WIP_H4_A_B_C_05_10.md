# DONE — SG-03 ETA A/B/C + H-4 (05.10.2026)

Branch: `feat/eta-markers-h4-05-10`  
Autor: Sebastian Bożek / sebastian.bozekq@gmail.com

## Stan A / B / C

| ID | Zakres | Stan | Dowód |
|---|---|---|---|
| **A** | Scal + wdroż PR #118 („Jak działa” przy ETA) | **DONE na prod** | PR #118 → main; Hobby #119 |
| **B** | Znaczniki ETA: w oknie / przed terminem / po terminie / noc | **DONE** (ten PR) | `etaWindowKind`, `etaIsNightArrival`; unit ETA markers |
| **C** | H-4: czas pracy z GPS, bez tachografu | **DONE** (0185 + ten PR) | `0185_h4_driver_hours_gps.sql`; `h4.sh` 12/12; SMS-KSH z tego ETA |

## Brama lokalna — zielona

```text
security 88 · nullguard 593 · i2 535 · h4 12 · smsksh 16 — wszystkie check OK
session / l13 — KNOWN-DEBT soft-skip (nie H-4)
EXIT:0  (/tmp/gate-h4-final.log)
```

### Naprawa i2 fee/BOTH (B-10)
- audit AGREED_FEE_ADD: SCX+HHL → `75.50/2`
- BOTH: koszt 175.50 od razu; przychód 0 do akceptacji KSH; brak auto → `175.50/0/0`

## Migracja prod
`node scripts/m0185-migrate.mjs dry-run-prod | apply-prod | verify-prod`

## SMS / e-mail
SG-03 nadal tylko właściciel. Chmura off.
