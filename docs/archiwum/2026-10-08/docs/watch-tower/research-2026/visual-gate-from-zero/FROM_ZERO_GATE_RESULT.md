# FROM ZERO gate — Visual squint (2026-09-23 ~02:06 CEST)

**Verdict: PASS** (re-gate after P0 A–C)

**SoT:** `claude-visual-ref/tower-makieta.html` ≡ `claude-makieta.html`  
**Shots:** `watch-tower-app/shots-start/from-zero-claude-{hhl-dark,ksh-light,map,nav}.png` (~02:04)  
**Ref:** `from-zero-claude-makieta-dark.png`  
**Builder:** `shots-start/FROM_ZERO_VISUAL_REGATE_SUMMARY.md`  
**HARD:** Claude = 1:1 visual + text + layout + style · ours = data/functions/integrations only

---

## Prior FAIL → fixed

| # | Was | Now |
|---|---|---|
| **A** | `Do załatwienia` | **`Wymaga decyzji`** (= Claude `q_title`) |
| **B** | OTIF cliff + chips | Triad **Wymaga decyzji \| Postęp dostaw Plan/Wykonanie + mini Mapa** |
| **C** | Spine 8 | **9** stages incl. **Gdańsk** (Przygotowanie…Dostarczone) |
| **D** | Map attribution-flag blob | Solid `.maplayers` / `.mapkey`; no UA-flag stretch |

---

## Squint checklist

| # | Check | |
|---|---|---|
| 1 | Barlow + Condensed · brand 23 · body 14 | PASS |
| 2 | Claude hex tokens dark/light | PASS |
| 3 | Topbar 52 · ink `.seg` · TOWER · H&H / KSH / Scandinavian Express | PASS |
| 4 | Nav 186 · amber current · Kokpit…Strefy (HHL) | PASS |
| 5 | Corridor 9 · Condensed counts · Gdańsk present | PASS |
| 6 | KPI flush · solid panels | PASS |
| 7 | Exception title + gut + next-action + age | PASS |
| 8 | Progress Plan/Wykonanie weeks + mini map | PASS |
| 9 | Map chrome solid layers/legend (no flag blob) | PASS |
| 10 | HHL dark · KSH light first paint | PASS |
| 11 | Roles HHL/KSH/SCX only | PASS |
| 12 | M1–M12 inside shell | PASS (builder) |
| 13 | Side-by-side reads as Claude twin | **PASS** |

**Allowed diffs:** seed/live counts, ETAs, codes, bell badge, MapLibre engine inside Claude map chrome.

**P2 note (non-blocking):** KSH light nav looks shorter (Rozliczenia only; fewer Automations/Strefy rows than HHL). If makieta always shows full IA for every role, align — else document as role gate.

---

## Gate rule

Prior FAIL (~01:56) **superseded**. Shell chrome/copy/layout/style squint-match makieta for FROM ZERO rebuild.

---

## Confirm on `from-zero-fix-*` (koordynator ~02:07)

Shots `from-zero-fix-{hhl-dark,ksh-light,map,nav}.png` (~02:05) + `FIX_A_C.md` reviewed.

**Verdict unchanged: PASS** — A–C present (Wymaga decyzji · Postęp dostaw Plan/Wykonanie + mini Mapa · spine 9+Gdańsk). Same twin as `from-zero-claude-*` re-gate.

P2 non-blocking: exception row ID text looks doubled in places (`SG-09SG-09`) — polish, not shell FAIL.
