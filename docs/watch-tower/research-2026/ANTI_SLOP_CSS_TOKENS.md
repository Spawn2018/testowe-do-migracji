> **NIEAKTUALNE — zastąpione przez VISUAL_BRIEF.md + design/claude-v2.0/ (tokeny Claude / Barlow)**
>
> Indeks: `docs/handover/09_INDEKS_WIEDZY.md` · Etap C4 · 2026-09-23. Pliku nie usuwać.

# ANTI-SLOP CSS TOKENS — copy-paste for builder (2026-09-23)

**SoT:** [`../VISUAL_BRIEF.md`](../VISUAL_BRIEF.md) §0–§6 · **FAIL gate:** [`ANTI_SLOP_CHECKLIST.md`](./ANTI_SLOP_CHECKLIST.md)  
Paste into `watch-tower-app/src/index.css` (or equivalent). Prefer **SOLID**. Amber = signal only.

```css
/* ========== WT ANTI-SLOP TOKENS ========== */
:root, [data-theme="dark"] {
  --wt-bg:          #080F15;
  --wt-surface:     #101C25;
  --wt-surface-2:   #16242F;
  --wt-surface-3:   #1D2E3A;

  --wt-ink:         #DCE7EE;
  --wt-ink-muted:   #A4B6C2;
  --wt-ink-faint:   #748896;

  --wt-border:      #263A48;
  --wt-border-soft: #1C2B36;

  --wt-accent:      #E5A544; /* rail / MED / tab underline ONLY */
  --wt-accent-bg:   #3A2C12;

  --wt-crit:        #E8687C;
  --wt-crit-bg:     #3B1720;
  --wt-high:        #E8687C;
  --wt-med:         #E5A544;
  --wt-med-bg:      #3A2C12;
  --wt-ok:          #4FB79E;
  --wt-ok-bg:       #0F2B27;

  --wt-ferry:       #6BA8D6;
  --wt-ferry-bg:    #12283A;
  --wt-road:        #A4B6C2;
  --wt-site:        #4FB79E;
  --wt-plan:        #7E93A1;
  --wt-plan-bg:     #1A272F;
  --wt-focus:       #5AA6E8;

  --wt-font-ui:   "IBM Plex Sans", "Segoe UI", system-ui, sans-serif;
  --wt-font-kpi:  "IBM Plex Sans Condensed", "IBM Plex Sans", sans-serif;
  --wt-font-mono: "IBM Plex Mono", ui-monospace, "Cascadia Mono", monospace;

  --wt-r-ctrl: 2px;
  --wt-r-panel: 3px;
  --wt-r-table: 0;
  --wt-gut: 3px;
  --wt-topbar-h: 52px;
  --wt-nav-w: 186px;
  --wt-nav-w-collapsed: 56px;
  --wt-kpi-v: 29px;
  --wt-spine-n: 26px;
  --wt-row-pad-y: 6px;
  --wt-row-pad-x: 9px;
}

[data-theme="light"] {
  --wt-bg:          #E3E9ED;
  --wt-surface:     #FFFFFF;
  --wt-surface-2:   #F4F7F9;
  --wt-surface-3:   #EAEFF3;
  --wt-ink:         #0E1A24;
  --wt-ink-muted:   #3C4E5C;
  --wt-ink-faint:   #6C7D8A;
  --wt-border:      #C9D5DD;
  --wt-border-soft: #DEE6EB;
  --wt-accent:      #C97E12;
  --wt-accent-bg:   #FBEFD9;
  --wt-crit:        #B32639;
  --wt-crit-bg:     #F8DEE2;
  --wt-ok:          #1B6E5D;
  --wt-ok-bg:       #DCEDE8;
  --wt-ferry:       #245C87;
  --wt-ferry-bg:    #DCE8F1;
  --wt-plan:        #6C7D8A;
  --wt-plan-bg:     #E6ECF0;
  --wt-focus:       #1D6FB8;
  --wt-med:         #C97E12;
  --wt-med-bg:      #FBEFD9;
  --wt-high:        #B32639;
}

/* base */
html, body {
  background: var(--wt-bg);
  color: var(--wt-ink);
  font-family: var(--wt-font-ui);
  font-size: 13.5px;
  font-variant-numeric: tabular-nums;
}
*:focus-visible { outline: 2px solid var(--wt-focus); outline-offset: 2px; }

/* optional glass — chrome over map ONLY */
.wt-glass-chrome {
  background: color-mix(in srgb, var(--wt-surface) 97%, transparent);
  backdrop-filter: blur(16px) saturate(1.15);
  -webkit-backdrop-filter: blur(16px) saturate(1.15);
  border: 1px solid color-mix(in srgb, var(--wt-border) 70%, var(--wt-ink) 30%);
  color: var(--wt-ink);
}
.wt-glass-panel {
  background: color-mix(in srgb, var(--wt-surface) 98.5%, transparent);
  backdrop-filter: blur(18px) saturate(1.15);
  -webkit-backdrop-filter: blur(18px) saturate(1.15);
  border: 1px solid color-mix(in srgb, var(--wt-border) 65%, var(--wt-ink) 35%);
  color: var(--wt-ink);
}
@supports not (backdrop-filter: blur(1px)) {
  .wt-glass-chrome, .wt-glass-panel { background: var(--wt-surface); }
}

/* instrument seg — ink invert (KILL amber outline chips) */
.wt-seg {
  display: flex; border: 1px solid var(--wt-border);
  border-radius: var(--wt-r-ctrl); overflow: hidden; background: var(--wt-surface-2);
}
.wt-seg button {
  padding: 5px 11px; font-size: 12.5px; font-weight: 500;
  color: var(--wt-ink-muted); border: 0; border-right: 1px solid var(--wt-border);
  background: transparent; cursor: pointer;
}
.wt-seg button:last-child { border-right: 0; }
.wt-seg button[aria-pressed="true"] {
  background: var(--wt-ink); color: var(--wt-surface); font-weight: 600;
}

/* flush KPI */
.wt-kpis {
  display: grid; grid-template-columns: repeat(3, 1fr);
  border-top: 1px solid var(--wt-border-soft); gap: 0;
}
.wt-kpi {
  padding: 11px 13px; text-align: left; cursor: pointer;
  border: 0; border-right: 1px solid var(--wt-border-soft);
  border-bottom: 1px solid var(--wt-border-soft);
  background: var(--wt-surface);
}
.wt-kpi:nth-child(3n) { border-right: 0; }
.wt-kpi:hover { background: var(--wt-surface-2); }
.wt-kpi .k { font-size: 11.5px; color: var(--wt-ink-faint); }
.wt-kpi .v {
  font-family: var(--wt-font-kpi); font-size: var(--wt-kpi-v); font-weight: 700;
  line-height: 1.05;
}
.wt-kpi .v.alert { color: var(--wt-crit); }
.wt-kpi .v.warn  { color: var(--wt-accent); }
.wt-kpi .v.good  { color: var(--wt-ok); }

/* spine */
.wt-corridor {
  background: var(--wt-surface); border-bottom: 1px solid var(--wt-border);
  padding: 9px 14px 11px; overflow-x: auto;
}
.wt-stage {
  flex: 1; text-align: left; padding: 2px 10px 2px 12px;
  border: 0; border-left: 1px solid var(--wt-border-soft);
  background: transparent; cursor: pointer;
}
.wt-stage .n {
  font-family: var(--wt-font-kpi); font-weight: 700;
  font-size: var(--wt-spine-n); line-height: 1;
}
.wt-stage .n.zero { color: var(--wt-ink-faint); font-weight: 500; }
.wt-stage[aria-pressed="true"] { background: var(--wt-surface-3); }

/* exception gut */
.wt-ex-gut { width: var(--wt-gut); flex: 0 0 var(--wt-gut); align-self: stretch; }
.wt-ex-row[data-sev="CRITICAL"] .wt-ex-gut,
.wt-ex-row[data-sev="HIGH"] .wt-ex-gut { background: var(--wt-crit); }
.wt-ex-row[data-sev="MEDIUM"] .wt-ex-gut { background: var(--wt-med); }

/* nav amber rail ONLY */
.wt-nav button {
  border-left: var(--wt-gut) solid transparent;
  background: transparent; color: var(--wt-ink-muted);
}
.wt-nav button[aria-current="page"] {
  background: var(--wt-surface-3); color: var(--wt-ink); font-weight: 600;
  border-left-color: var(--wt-accent);
}

/* tabs amber underline ONLY */
.wt-dtabs button[aria-selected="true"] {
  border-bottom: 2px solid var(--wt-accent);
  color: var(--wt-ink); font-weight: 600;
}

/* solid table */
.wt-table { border-collapse: collapse; border-radius: var(--wt-r-table); font-size: 13.2px; }
.wt-table thead th {
  position: sticky; top: 0; background: var(--wt-surface-2);
  font-family: var(--wt-font-kpi); font-size: 13px; font-weight: 600;
  padding: 7px 9px; border-bottom: 1px solid var(--wt-border);
}
.wt-table tbody td {
  padding: var(--wt-row-pad-y) var(--wt-row-pad-x);
  border-bottom: 1px solid var(--wt-border-soft);
}

/* map overlays solid */
.wt-maplayers, .wt-mapkey {
  position: absolute; background: var(--wt-surface);
  border: 1px solid var(--wt-border); border-radius: var(--wt-r-ctrl);
  padding: 7px 9px; color: var(--wt-ink);
}

/* primary btn = ink invert, NOT amber fill */
.wt-btn-primary {
  background: var(--wt-ink); color: var(--wt-bg);
  border: 1px solid var(--wt-ink); border-radius: var(--wt-r-ctrl);
  padding: 6px 12px; font-weight: 600; cursor: pointer;
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation: none !important; transition: none !important;
  }
}
```

## Token table (quick)

| Token | Dark | Use |
|---|---|---|
| `--wt-bg` | `#080F15` | page |
| `--wt-surface` | `#101C25` | solid panels |
| `--wt-accent` | `#E5A544` | rail / MED / tab only |
| `--wt-crit` | `#E8687C` | CRITICAL/HIGH |
| `--wt-ok` | `#4FB79E` | on-time / OK |
| `--wt-ferry` | `#6BA8D6` | SEA segment |
| `--wt-font-kpi` | Plex Condensed | KPI 29 / spine 26 |
| `--wt-r-panel` | 3px | max panel radius |
| `--wt-gut` | 3px | severity + nav bar |

## Banned class smells (delete if present)

- `.rounded-2xl` / `shadow-lg` on KPI cards
- Amber `border-color: var(--wt-accent)` on role chips / filter chips as default
- `gap-4` / `gap-6` card grids for KPI
- Gradient text utilities on `.v`
- Barlow font-face as product UI

*Builder paste · WT—Visual 2026-09-23*
