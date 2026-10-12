> **NIEAKTUALNE — zastąpione przez VISUAL_BRIEF_ELITE.md (root pointer) + UX_MAP.md §6.5; elita research z erą Plex VOID dla shell**
>
> Indeks: `docs/handover/09_INDEKS_WIEDZY.md` · Etap C4 · 2026-09-23. Pliku nie usuwać.

# WATCH TOWER — VISUAL_BRIEF_ELITE

**Status:** STANDBY (przed komendą START Sebastiana)  
**Owner:** WT — Visual  
**Data:** 2026-09-23  
**Bar:** state-of-the-art wizualnie · top-tier craft · elite DORA-enterprise · anti-slop  
**Kod makiety:** ❌ nie przed START

## Relacja do SoT

| Plik | Rola |
|---|---|
| [`../VISUAL_BRIEF.md`](../VISUAL_BRIEF.md) | **SoT tokenów + receptur** (już podniesiony do elite: uncertainty, flush KPI, next-action, checklist) |
| **Ten plik** | Elite bar + research + anti-slop + gap SPA → redesign po START |
| [`ANTI_SLOP_CHECKLIST.md`](./ANTI_SLOP_CHECKLIST.md) | Screenshot gate PASS/FAIL |
| [`02_VISUAL_REFS_2026.md`](./02_VISUAL_REFS_2026.md) / [`VISUAL_REFS_2026.md`](./VISUAL_REFS_2026.md) | Pełne refs |
| [`ELITE_GAPS.md`](./ELITE_GAPS.md) | Gap lista |
| Research UX: [`02_UX_UI_2026.md`](./02_UX_UI_2026.md), [`04-ux-ops-trends-2026.md`](./04-ux-ops-trends-2026.md) | Trendy ops 09/2026 |

**Konflikt:** wygrywa `VISUAL_BRIEF.md` dla tokenów/CSS; ten plik wygrywa dla *elite intent*, anti-slop i kolejności redesignu po START.

---

## 1. Elite intent (lock)

1. **Never hide uncertainty** — ETA bez ConfidencePill + zakresu = niedokończone; alert bez *next action* = niedokończone.
2. **Cold steel + jeden amber** — zero drugiej hue „brand”; ferry/ok/crit = domain, nie accent produktowy.
3. **Tool, nie dashboard SaaS** — flush panels, radius ≤4, row 32–34, KPI rail bez card-gap.
4. **Evidence + audit** — każdy consequential click → AuditTrailRow; confidence z etykietą źródła, nie „AI 94%”.
5. **Role honesty** — KSH/Stegra: light first-paint, zero finance chrome (brak węzła).
6. **Restraint** — SAP-like composure + Bloomberg/Retool density; nie Linear-marketing pastel / indigo Tailwind.

---

## 2. Typografia (elite craft)

- **Keep:** IBM Plex Sans + Condensed (KPI/spine/brand/pills only) + Mono (IDs, money, ETA, audit ts).
- Body 13.5–14 · table 13 · caption 11.5–12 · KPI 26–30 condensed 700.
- `font-variant-numeric: tabular-nums` globalnie; slashed-zero OK na kodach.
- **Ban:** Inter / Barlow / Poppins / Roboto hero; weight 300; hero ≥20 px na ops.

---

## 3. Density & motion

- Scale: `2·4·6·8·10·12·14·16·20·24` — bez „na oko”.
- Topbar 52 · spine 56–64 · nav 186 · drawer 400–480 · row ~32–34 · gut 3 px · radius 2–4 (tabela 0).
- KPI = **flush rail** (dividers), nie floating cards.
- Motion ≤160 ms; opacity/color only; `prefers-reduced-motion` = kill switch.
- Ban: bounce, KPI count-up, skeleton shimmer, drawer spring, map decorative pan.

---

## 4. Elite components (już w VISUAL_BRIEF §6 — egzekwuj po START)

| Component | Reguła krótka |
|---|---|
| ExceptionRow | gut + what · why · **next (verb)** · age |
| ConfidencePill | HIGH/MED/LOW + źródło; EtaRangeBar mono |
| PermitKind | PERIOD / TRIP / REGULATION — mapuj na ok/ferry/plan, bez nowych hue |
| FactoringStatus | HHL-only; hide node dla innych ról |
| AuditTrailRow | ts mono · actor · action · reason |

---

## 5. Anti-slop (skrót)

Pełna checklista: [`ANTI_SLOP_CHECKLIST.md`](./ANTI_SLOP_CHECKLIST.md)

Hard FAIL: indigo/mesh/full-page glass KPI/milk/neon · card-gap≥16+radius≥8 · blur cen · AI-% bez źródła · mapa full-bleed bez listy · Inter hero. Dense chrome/panel glass OK (START P0.1).

---

## 6. Gap SPA (stan 2026-09-23)

Tokeny w `watch-tower-app` ≈ brief. **Containment** nadal cardy-SaaS (KPI strip, powietrze).  
Po START: redesign containment → mount elite chips → light AA KSH/Stegra → map craft → screenshot gate.

Szczegóły: [`ELITE_GAPS.md`](./ELITE_GAPS.md).

---

## 7. Po START — kolejność Visual

1. Flush KPI + exception density (wyjście z cardy-SaaS)  
2. Confidence / Permit / Factoring / Audit w UI  
3. Light polish KSH/Stegra (WCAG AA)  
4. Map: legend + layers surface, hover sync  
5. Gate anti-slop PASS na zrzutach  

---

## 8. Research refs (skrót)

| Ref | Reguła |
|---|---|
| FourKites trust UX (2026) | Never hide uncertainty; action-first alerts |
| project44 / Shippeo | Exception-first; mapa secondary |
| SAP Joule Work (2026) | Flat surfaces; hierarchy bez card-everywhere |
| Dense Plex craft | Density 9; border > shadow; motion 3 |
| ToolJet control tower | Near-black + jeden amber accent |

Pełne URL i anti-patterns: pliki `*VISUAL_REFS*` / `02_UX_UI_2026.md` w tym katalogu.

---

*Koniec VISUAL_BRIEF_ELITE. STANDBY — redesign UI dopiero po komendzie START.*

---

## 9. START lock (GO)

Zobacz [`START_UI_SPEC.md`](./START_UI_SPEC.md). Skrót:

1. **DENSE glass** chrome-only: chrome **97%** + blur **16px**, panel **98.5%** + blur **18px** (supersedes 78% / blur 8–12); KPI/tables/spine solid; density = `claude-makieta.html`
2. Collapsible nav 186↔56
3. Roles: HHL / KSH / SCX (no Stegra persona)
4. Org logos from `public/logos/`
5. Every tile clickable → filter / deep-link; **no hollow CTAs**
6. Notification bell: all + mark-read removes
7. P0 FIX (2026-09-23): spine 2nd-click clear filter; real XLSX dry-run; hollow CTA ban — see START_UI_SPEC `## P0 FIX`

**Po START §7 supersede:** najpierw containment+dense-glass+roles+logos+bell+click-through, potem elite chips (Confidence/Permit/Factoring/Audit).
