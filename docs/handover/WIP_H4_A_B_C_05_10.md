# WIP — SG-03 ETA A/B/C + H-4 (05.10.2026 ~19:29 CEST)

Branch: `feat/eta-markers-h4-05-10`  
Autor commitów: Sebastian Bożek / sebastian.bozekq@gmail.com

## Stan A / B / C

| ID | Zakres | Stan | Dowód |
|---|---|---|---|
| **A** | Scal + wdroż PR #118 („Jak działa” przy ETA) | **DONE na prod** | PR #118 → main; Hobby PR #119; deploy `dpl_2X8yd4YCKB9MMgFxiHPE59TcLN3K`; obie domeny 200; bundle `index-BMJGz_ta.js` |
| **B** | Znaczniki ETA: w oknie / przed terminem / po terminie / noc | **DONE w branchu** (niescalone) | `src/lib/time.ts` (`etaWindowKind`, `etaIsNightArrival`); `LoadDrawer`; i18n PL/EN/SV; `tests/eta-window-markers.test.ts` 15/15 unit |
| **C** | H-4: czas pracy z GPS, bez tachografu | **WIP w branchu** — migracja + testy lokalne OK; **brama pełna niezielona** | `supabase/migrations/0185_h4_driver_hours_gps.sql`; `tests/db/h4.sh` **12/12**; `smsksh` **16/16** (czasy względne) |

## Dokumenty decyzji (DONE w branchu)
- `POLECENIA_KOORDYNATORA.md` — A/B/C dosłownie 05.10 ~18:40
- `wzorzec/03_REJESTR_DECYZJI.md` — D-85: brak tachografu na stałe, GPS = źródło; ETA-MARK; H-4
- `PLAN.md` — H-4 W TOKU → DONE (0185)
- `RAPORT_SG03_H4_ETA_05_10.md` — porównanie ETA przed/po

## Brama lokalna — ostatni pomiar

```text
h4        12/12 OK
smsksh    16/16 OK
search_path missing = 0 (po fix document_retention_years w 0185)
nullguard 593/0 FAIL (allowlist + katalog uzupełnione)
i2        533 OK, 2 FAIL  ← blokuje pełną zieleń
session / l13 — soft-skip w gate.sh jako KNOWN-DEBT 05.10 (nie H-4)
```

Gate job mógł jeszcze biec w tle przy zapisie WIP (`bash tests/db/gate.sh` po rebuild `tower_boot`).

### Otwarte FAIL (nie zaczynać od zera)

1. **i2 — 2 FAIL** (po poprawkach B-10 fee): doprecyzować testy `load_agreed_fee_*` / BOTH extras (ścieżka SCX COST vs oczekiwania). Nie regresja proporcjonalnego ETA.
2. **session** — `zdezaktywowany z ważnym tokenem` widzi wiersze (KNOWN-DEBT; wyłączone z `check` w gate.sh).
3. **l13** — 4 FAIL (KNOWN-DEBT; wyłączone z `check`).

## Wznowienie (kolejność)

```bash
cd /workspace/watch-tower-app
git checkout feat/eta-markers-h4-05-10
git pull

# 1) Domknij 2 FAIL i2 (tests/db/i2.sh — fee/BOTH), ewentualnie przywróć check session/l13
# 2) Pełna brama:
export PGADMIN=postgres://postgres@localhost:5433/postgres
bash tests/db/gate.sh
# oczekiwane: zero linii „oczekiwano”; h4 12/12; smsksh 16/16; i2 0 FAIL

# 3) PR + merge + deploy z main (Hobby: pusty commit Sebastiana albo vercel deploy --prod --force
#    gdy HEAD ma autora sebastian.bozekq@gmail.com)
gh pr create --base main --head feat/eta-markers-h4-05-10 \
  --title "H-4 + ETA znaczniki B (A=#118 już na prod)" \
  --body "0185 H-4 GPS bez tachografu; znaczniki ETA; raport SG-03"
# po zielonej bramie: gh pr merge; deploy; nałożyć 0185 na PROD dopiero po bramie
```

## Nie kasować
- `supabase/migrations/0185_h4_driver_hours_gps.sql`
- `tests/db/h4.sh`, `tests/eta-window-markers.test.ts`
- poprawki `smsksh.sh` (czasy `date -u -d 'N minutes ago'`)

## SMS / e-mail
SG-03 nadal tylko właściciel. Chmura off.
