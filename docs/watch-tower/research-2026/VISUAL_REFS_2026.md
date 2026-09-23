# WATCH TOWER — VISUAL_REFS_2026

**Date:** 2026-09-23 (Europe/Warsaw)  
**Product:** WATCH TOWER — dense multi-party logistics control tower (PL→SE oversized steel, Stegra Boden)  
**Brand lock:** cold steel + **single amber accent** — elevate craft, do not replace palette.  
**Method:** primary product pages, help centers, design-system docs, FAA HF papers, craft essays.  
**Uncertainty:** public marketing pages ≠ live product chrome; where we lack authenticated screenshots we extract **interaction rules**, not pixel clones. Flagged `[UNCERTAIN]` when evidence is marketing-only.

Sources below = **RULES TO STEAL**, not UI to copy.

---

## How to use this pack

1. Read a row → take the **Rules** into `VISUAL_BRIEF.md` / components.
2. Never paste competitor layouts, colors, logos, or copy.
3. Pair with `ANTI_SLOP_CHECKLIST.md` before shipping a screen.
4. Gap list vs current SPA: `ELITE_GAPS.md`. Patch text: `VISUAL_BRIEF_ELITE_DELTA.md`.

---

## A. Ops command centers / SOC / trading floors / ATC-adjacent density

### A1. Bloomberg Terminal UX (conceal complexity)
- **URL:** https://www.bloomberg.com/company/stories/how-bloomberg-terminal-ux-designers-conceal-complexity/ · ethos companion https://www.bloomberg.com/company/stories/bloombergs-customer-centric-design-ethos/  
- **Evidence quality:** `[UNCERTAIN]` — Bloomberg pages returned 403 to automated fetch (2026-09-23); rules below from secondary cites + long-standing Terminal practice (dense panes, keyboard, tabular numerics). Treat as principle set, not screenshot SoT.
- **Rules to steal:**
  1. **Task panes, not hero dashboards** — every region answers one operator question (queue / map / detail).
  2. **Predictable coordinates** — same type of data always in the same place across loads/roles.
  3. **Keyboard + tabular-nums first** — scanning speed > decoration; mono/condensed for IDs and money.
  4. **Hide complexity behind progressive disclosure** — secondary detail in drawer/tabs, not new panels.
- **Anti-pattern if misused:** recreating Terminal green-on-black nostalgia, cryptic abbreviations without PL/EN/SV labels, or packing unrelated widgets into one “power user” soup.

### A2. FAA / ATC information display (human factors)
- **URL:** FAA HF — Information Display Protocol & complexity papers, e.g. https://hf.tc.faa.gov/publications/2015-06-information-display-protocol/full_text.pdf · https://www.faa.gov/sites/faa.gov/files/data_research/research/med_humanfacs/oamtechreports/200726.pdf
- **Rules to steal:**
  1. **Critical continuous, context on demand** — severity gut + spine counters always visible; deep permit text only in drawer.
  2. **≤ ~4 categorical colors for primary encoding** — WT already: amber (signal/med), crit, ok/teal, ferry blue — do not add magenta “AI”.
  3. **Stable salience hierarchy** — CRITICAL must never look like MEDIUM; gut > icon > copy.
  4. **Clutter kills search time** — remove decorative icons/sparklines that do not change a decision.
- **Anti-pattern if misused:** aviation skeuomorphism (radar rings, altitude tapes) or rainbow status maps.

### A3. Datadog DRUIDS (enterprise ops design system)
- **URL:** https://www.datadoghq.com/blog/engineering/druids-the-design-system-that-powers-datadog/ · docs site referenced: druids.datadoghq.com
- **Rules to steal:**
  1. **Same pattern everywhere** — filter / time / inspect behave identically on Kokpit, Mapa, Dokumenty, Finanse.
  2. **Minimize dead ends** — every exception row → drawer with next action; every KPI → filter when meaningful.
  3. **Code as SoT for components** — recipes in VISUAL_BRIEF must match SPA tokens (no Figma-only fantasy).
  4. **Cmd/Ctrl+K mental model OK** — dense products expect jump-to; optional later, not MVP chrome.
- **Anti-pattern if misused:** cloning Datadog purple/brand, observability chart walls, or “loupe” gimmicks on marketing pages.

### A4. Grafana dashboard maturity (anti-sprawl)
- **URL:** https://grafana.com/docs/grafana/latest/visualizations/dashboards/build-dashboards/best-practices/
- **Rules to steal:**
  1. **A screen must answer a question** — HHL morning = “what breaks OTIF/margin today?” not “pretty overview”.
  2. **Alert → directed view** — banner/toast opens the load or Ryzyka, not a generic home.
  3. **Normalize axes / like-with-like** — corridor spine counts are comparable; don’t mix money KPI with unitless vanity.
  4. **Kill dashboard sprawl** — max 6 KPI; no duplicate “status cards” that restate the spine.
- **Anti-pattern if misused:** building Watch Tower as a Grafana clone (panel grids, auto-refresh fireworks, stacked area charts as decoration).

### A5. CrowdStrike Falcon / SOC workbench density
- **URL:** https://developer.crowdstrike.com/foundry/experience-capabilities/ui-extensions/ (Foundry UI sockets / case panels)
- **Rules to steal:**
  1. **Case/exception panel is the unit of work** — ExceptionRow + LoadDrawer = SOC “case”.
  2. **Embed context in the workbench** — permit_fits, ETA band, factoring status live *inside* the load case, not on a separate “insights” page.
  3. **Severity + age + owner** triad on every open item.
- **Anti-pattern if misused:** red-team cyber aesthetics, threat score theater, or neon glows.

---

## B. Logistics visibility / control towers (visual patterns only)

### B1. project44 Movement / Visibility
- **URL:** https://www.project44.com/platform/visibility/ · disruption map narrative https://www.project44.com/blog/project44-enhances-movement-platform-with-new-capabilities-to-help-customers-mitigate-supply-chain-disruption/
- **Rules to steal:**
  1. **Disruption → filtered set of impacted loads** — ferry storm / ROAD_SE event rings a cohort, not a blog post.
  2. **Map is a launchpad into the list** — click disruption → exception queue scoped; map alone is not the product.
  3. **Predictive ETA as arrival window usable for execution** — show segment context (PL road / ferry / SE road), not one orphan timestamp.
  4. **Shared visibility by role rules** — Stegra/KSH see less; hide nodes, don’t blur (already WT SoT).
- **Anti-pattern if misused:** copying Movement marketing AI-agent chrome, indigo SaaS shells, or claiming “world’s largest graph” metrics we don’t have.

### B2. Shippeo multimodal visibility
- **URL:** https://www.shippeo.com/visibility/real-time-visibility · exception release https://www.shippeo.com/resources/explore/press-releases/shippeo-unveils-powerful-new-features-extending-shipment-visibility-depth-and-coverage-while-helping-users-navigate-global-supply-chain-risks
- **Rules to steal:**
  1. **At-risk first on home** — “shipments at risk” widgets / filters before “all transports”.
  2. **Saved searches / sticky filter chips** — operator returns to the same exception slice (Prom, DOC!, SILENT).
  3. **Missed milestone = auto exception** — silent vehicle / missed LOADING dwell becomes a queue row with verb.
  4. **Ring-fence disruption cohort** — same as project44; visual = map highlight + list filter sync.
- **Anti-pattern if misused:** drag-drop widget playground as default (WT fixed shell: spine + exceptions + map split); pastel carrier marketing look.

### B3. FourKites Intelligent Control Tower
- **URL:** https://www.fourkites.ai/platform · Shipment Twin https://www.fourkites.ai/platform/digital-twins/shipment-twin  
- **Evidence note:** product narrative heavily agentic (2026). Steal **exception→action + decision trace**, not autonomous-agent UI claims.
- **Rules to steal:**
  1. **Dashboard vs tower test** — alert without next action = dashboard; WT ExceptionRow must end in a verb (`Wgraj zezwolenie`, `Plan B rejsu`).
  2. **Impact trace across entities** — one delay can touch permit, ferry slot, invoice line; surface linked chips in drawer.
  3. **Decision / audit trace** — every state change leaves an AuditStrip entry (actor, ts, reason).
  4. **Never hide uncertainty** — confidence and freshness are first-class (see also Locus §B6).
- **Anti-pattern if misused:** fake “resolved in 47 minutes by AI” theater; agent chat bubbles as primary ops UI.

### B4. Transporeon Visibility Hub (map ↔ table)
- **URL:** https://intercom.help/sixfold/en/articles/11957713-global-containers-map-view (Aug 2025 help center — primary UX spec)
- **Rules to steal:**
  1. **Map | Table switch with sticky preference** — WT default remains **split 60/40**; full-map only as explicit focus.
  2. **Cluster bubbles by shared vessel/leg** — ferry M/F Wawel cluster of loads; click zooms + updates sidebar cards.
  3. **Status-colored markers match list pills** — on-time / delayed / unknown (upcoming) — map legend = StatusPill tokens.
  4. **Sidebar cards summarize trip** — code · status · ETA · next risk; not a second spreadsheet.
- **Anti-pattern if misused:** full-bleed map with empty chrome; clusters that don’t filter the list; decorative AIS aesthetics.

### B5. Everstream Analytics — network / risk map
- **URL:** https://www.everstream.ai/platform/network-mapping/ · monitoring https://www.everstream.ai/platform/global-monitoring/
- **Rules to steal:**
  1. **Risk is network-shaped** — corridor nodes (Śrem→Gdańsk→Nynäshamn→E4→Boden) carry risk chips, not generic heat blobs.
  2. **Alert relevance over volume** — badge hot only CRITICAL/HIGH; eliminate alert fatigue (nav badges already).
  3. **Scorecard on select** — click risk → why (FERRY/ROAD_SE/DOC/OPS) + Plan B CTA.
- **Anti-pattern if misused:** world risk heatmaps unrelated to PL→SE corridor; fake global threat scores.

### B6. Locus — ETA confidence bands (2026)
- **URL:** https://locus.sh/blogs/real-time-visibility-eta-confidence-bands/ (published 2026-09-18 — high relevance)
- **Rules to steal:**
  1. **Point ETA is incomplete** — always pair estimate with band/confidence + last observation age.
  2. **Rank exceptions by miss probability / severity×impact**, not raw lateness alone (aligns with WT `severity × time-to-impact`).
  3. **Widen band when feed is stale** — SILENT vehicle ≠ “calm on-time”.
  4. **Show source class** — telematics vs milestone vs schedule heuristic; never “AI 94%”.
- **Anti-pattern if misused:** inventing fake calibration tables; overconfident narrow bands without method label.

### B7. Track Freight / dense TMS (carry-forward from VISUAL_BRIEF §9)
- **URL:** product-private / brief internal — keep as rule source already in SoT.
- **Rules:** one row = status + owner + next action; ~32 px rows; sticky thead; money right tabular; zero card-per-shipment.
- **Anti-pattern:** Material 48 px rows; shipment-as-card grids.

---

## C. Dense B2B enterprise craft (Linear-adjacent discipline ≠ pastel SaaS)

### C1. Linear — density without shouting (Mar 2026 refresh)
- **URL:** https://linear.app/now/behind-the-latest-design-refresh · method https://linear.app/method/introduction
- **Rules to steal:**
  1. **Don’t compete for attention you haven’t earned** — nav/recents recede; exception queue + drawer own attention.
  2. **Structure felt, not seen** — fewer hard separators; soft borders; no border zoo.
  3. **Fewer icons, smaller icons** — glyph only for status/action (matches WT anti-patterns).
  4. **Calm motion** — micro only; no bounce (matches WT §7).
- **Anti-pattern if misused:** importing Linear’s soft pastel/indigo marketing look, large radii, or issue-tracker empty states into a control tower.

### C2. IBM Carbon — data table density
- **URL:** https://carbondesignsystem.com/components/data-table/style/
- **Rules to steal:**
  1. **Named row sizes** — WT ops tables ≈ Carbon **sm 32 px** (already brief ~32–34).
  2. **Header matches body density** — thead same rhythm as rows.
  3. **Toolbar height pairs with row size** — dense filter bar ~32, not 48 Material.
  4. **Selected / hover / zebra tokens explicit** — use `--wt-accent-bg` wash, not heavy shadows.
- **Anti-pattern if misused:** Carbon “AI aura” gradients on tables (Carbon documents AI presence styles — **hard ban** for WT).

### C3. Stripe Apps style tokens (enterprise restraint)
- **URL:** https://docs.stripe.com/stripe-apps/style
- **Rules to steal:**
  1. **Tokenized spacing scale only** — Stripe: 2/4/8/16/24/32/48; WT already 2…24 — enforce, no “18 on eye”.
  2. **Keyline borders > shadows** — `keyline: neutral` mindset = 1 px `--wt-border`.
  3. **Limited preset components** — don’t invent six button personalities.
  4. **Semantic color for text/icons** (`success`/`critical`) — domain ferry blue stays domain, not “brand #2”.
- **Anti-pattern if misused:** Stripe purple brand, marketing gradients, or sparse “fintech whitespace” on ops queues.

### C4. SAP enterprise visual language (composure) `[UNCERTAIN]`
- **URL:** search hits point to SAP design stories (Sapphire 2026); verify before citing in client decks.
- **Rules to steal (principle-level):** calm flat surfaces; hierarchy via alignment/spacing not card-everywhere; AI without gimmick motion.
- **Anti-pattern:** Fiori generic blue chrome as WT skin.

---

## D. Map + queue split patterns (tools, not dashboards)

### D1. Transporeon cluster ↔ sidebar (see B4)
Primary public UX spec for map/table parity and cluster click behavior.

### D2. MapLibre hover sync
- **URL:** https://www.maplibre.org/maplibre-gl-js/docs/examples/create-a-hover-effect/
- **Rules to steal:**
  1. **Shared `hoveredId` / `selectedId`** — list `tr.hl` ↔ marker feature-state.
  2. **Focus mode dims others** — already in VISUAL_BRIEF §6; require real opacity change, not a no-op toggle.
  3. **Layers must mutate pixels** — trail/ferry/seEvents either render or leave the UI (QA B4).
- **Anti-pattern:** map as wallpaper; layer checkboxes that do nothing; full-screen map without list on ops roles.

### D3. Fleet / tool split (industry pattern)
- **Pattern (multiple fleet UIs):** left or right dense queue, center map, overlay layer card, bottom breadcrumb corridor.
- **WT canonical:** grid `1.35fr / 1fr` (~60/40), layer panel top-left surface, legend bottom-left, corridor breadcrumb for KSH light theme.
- **Anti-pattern:** equal 50/50 with huge padding; map legend using non-token colors.

---

## E. Cross-cutting rules for Watch Tower (synthesis)

| Theme | Elite rule | WT binding |
|---|---|---|
| Exception→action | Every hot row ends in a verb + owner | ExceptionRow meta: `transport · owner · next action` |
| Uncertainty | ETA + confidence + freshness | New: ConfidencePill + PredictionBand |
| Permits | Kind is data, not prose | PermitKindChip `PERIOD` \| `TRIP` \| `REGULATION` |
| Money workflow | Status machine visible | FactoringStatus + invoice match chips |
| Provenance | Append-only events readable | AuditStrip under drawer header / Przebieg |
| Density | ~32 px rows, flush KPI rail | Carbon sm + brief §5 |
| Map | Tool with synced list | Transporeon + MapLibre rules |
| Craft | Recede chrome, one accent | Linear principle + cold steel/amber lock |

---

## F. Source confidence legend

| Tag | Meaning |
|---|---|
| Primary product/help/docs | Prefer |
| Marketing landing | Extract interaction idea only; `[UNCERTAIN]` pixels |
| HF / design-system docs | Strong for density/a11y rules |
| Secondary blog | Use when dated 2025–2026 and concrete; still no fake metrics |

**Do not invent screenshots or competitor KPIs in client materials.**

---

*End VISUAL_REFS_2026. Companion files: ANTI_SLOP_CHECKLIST.md · ELITE_GAPS.md · VISUAL_BRIEF_ELITE_DELTA.md*
