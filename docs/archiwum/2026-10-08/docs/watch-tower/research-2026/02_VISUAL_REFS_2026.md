> **NIEAKTUALNE — zastąpione przez VISUAL_BRIEF.md + claude-v2.0**
>
> Indeks: `docs/handover/09_INDEKS_WIEDZY.md` · Etap C4 · 2026-09-23. Pliku nie usuwać.

# WATCH TOWER — Visual refs & craft (Sept 2026)

**Owner:** WT — Visual  
**Bar:** state-of-the-art ops UI · anti-slop · dense command center · DORA-enterprise  
**Brand lock:** cold steel + **one** amber accent — elevate craft, do not replace the palette.

Sources below = **rules to extract**, not UI to clone.

---

## 1. References → rules

| Source | Evidence | Steal as rules | Do NOT steal |
|---|---|---|---|
| **FourKites — trust / uncertainty** (Bartsch, Feb 2026) | https://contra.com/p/o6AlmO2v-designing-trustworthy-real-time-data-visibility-for-four-kites | "Never hide uncertainty"; confidence first-class; progressive disclosure of sources; alert = *what · why · next action* | Fake "AI 94%"; hiding stale GPS; dashboard without exception queue |
| **project44 / Shippeo / FourKites** (RTTV category 2025–26) | BusinessWire RTTV report Aug 2025; p44 vs FK comparison 2026 | Exception-first home; map secondary; ETA with segment context | Marketing uplift %; indigo SaaS chrome; hero marketing layouts |
| **ToolJet shipment control tower** | https://blog.tooljet.com/shipment-control-tower/ | Near-black canvas + **one** orange/amber accent; exceptions page = at-risk only; recovery action with actor+timestamp | "Generous spacing" from article — we stay density-9 |
| **SAP Joule Work visual language** (Sapphire 2026) | https://www.sap.com/design/stories-resources/a-new-visual-language-defines-enterprise-ai | Calm precision; flat surfaces; hierarchy via spacing/alignment **instead of** card-everywhere; AI without gimmick motion | Glass / mesh / decorative containment |
| **Dense dashboard craft** | https://github.com/educlopez/ui-craft/blob/main/skills/ui-craft-dense-dashboard/SKILL.md | IBM Plex + mono IDs; density 9; 4/8 grid; motion 3; tabular-nums; border > shadow | Inter as hero; radius 8–16; sparklines everywhere for decoration |
| **Enterprise command UX patterns** | https://github.com/szl-holdings/platform/blob/main/docs/COMMAND_UX_PATTERNS.md | Evidence bar (confidence + provenance); approval/decision surface; Operator vs Executive density | Softworker marketing copy; pastel domain accents |
| **B2B typography 2026** (Lollypop, Jul 2026) | https://lollypop.design/blog/2026/july/enterprise-saas-typography-rules/ | Fixed type scale; humanist UI + mono data; WCAG AA | Random off-scale sizes; weight 300 |
| **Track Freight / dense TMS** (existing brief §9) | VISUAL_BRIEF.md | Row ~32 px; sticky thead; money right tabular | Card-per-shipment |

---

## 2. Anti-slop (Sept 2026) — hard bans

If a screenshot looks AI-generated SaaS → FAIL:

1. Inter / Roboto / Poppins / Barlow as UI hero
2. Indigo/violet (`#6366f1` family), mesh gradient, blur orbs, glassmorphism
3. Card grid with `gap ≥ 16` + `radius ≥ 8` + soft floating shadow
4. Pill-everything; Lucide decorative on every row
5. Gradient text on KPI; second neon accent beside amber
6. Skeleton shimmer on every row; empty-state illustrations
7. "AI confidence 94%" without source / without ETA range
8. Hiding prices with blur — **hide the node**
9. Full-bleed map without list on ops views
10. Motion >160 ms, bounce, KPI count-up, parallax

**30 s screenshot gate:** from afar — severity gut + spine counters; up close — tabular ETA/money; zero decoration without status.

---

## 3. Gap: SPA shots vs elite bar (2026-09-23)

Shots in `/workspace/watch-tower-app/shots/`:

| Symptom | vs VISUAL_BRIEF | Elite fix (SoT now; code after START) |
|---|---|---|
| KPI as separate "cards" in a strip | Tokens OK, **containment** too SaaS | KPI strip: soft dividers, zero card-gap; condensed values |
| Exception queue directionally OK | Gut + next action partial | Enforce triple: *what · why · next*; age tabular condensed |
| No ConfidencePill / ETA range in UI | Recipe already in brief §6 | After START: mount beside ETA in drawer + list |
| No PermitKind PERIOD/TRIP/REGULATION | Recipe in brief | Chips in docs + mismatch wash |
| No FactoringStatus / AuditTrail chrome | Recipe in brief | HHL-only factoring; audit row mono ts |
| Look = "dashboard product" not "ops tool" | Density partial | Flush panels, radius ≤4, row 32–34, less air between blocks |
| Light theme KSH/Stegra | Tokens mapped | First paint per role — already §8 |

---

## 4. Elite component set (SoT names)

Already in `VISUAL_BRIEF.md` §6 — do not fork recipes; enforce:

- `ConfidencePill` + `EtaRangeBar` + reason chips (heuristic, not "AI %")
- `PermitKind` = PERIOD | TRIP | REGULATION
- `FactoringStatus` = NOT_OFFERED … REJECTED (HHL only, hide node)
- `AuditTrailRow` = ts mono · actor · action · reason
- ExceptionRow = gut + next action mandatory

New hue tokens: **forbidden**. Map states onto existing ok/med/crit/ferry/plan.

---

## 5. DORA-enterprise craft (visual meaning)

Not CI DORA metrics — here "elite enterprise" means:

- **Evidence-first:** every alert and ETA has provenance / freshness
- **Decision surface:** approve/reject/run with consequence in copy, not toast-only
- **Auditability:** every consequential click leaves AuditTrailRow
- **Role honesty:** Stegra/KSH never see finance chrome (no node)
- **Restraint:** SAP-like calm + Bloomberg/Retool density — not Linear marketing pastel

---

## 6. After START (Visual) — order

1. Density/containment on cockpit (KPI strip, exception flush)
2. Mount elite chips (confidence, permit kind, factoring, audit)
3. Light polish KSH/Stegra (AA contrast)
4. Map craft: legend + layer panel surface, hover sync — no decoration
5. Screenshot gate vs `ANTI_SLOP_CHECKLIST.md`

---

*Visual research SoT. Conflict with competitor marketing → this file + VISUAL_BRIEF win.*
