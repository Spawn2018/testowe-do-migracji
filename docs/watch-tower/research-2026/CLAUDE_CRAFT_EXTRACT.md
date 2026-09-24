> **NIEAKTUALNE — zastąpione przez VISUAL_BRIEF.md + claude-v2.0 (polityka „inspired not cloned” VOID → 1:1)**
>
> Indeks: `docs/handover/09_INDEKS_WIEDZY.md` · Etap C4 · 2026-09-23. Pliku nie usuwać.

# CLAUDE_CRAFT_EXTRACT — craft recipes from makieta (inspired, not cloned)

**Status:** SoT extract for WT — Visual rewrite  
**Canonical source:** `claude-visual-ref/tower-makieta.html` (92 KB, identical sibling `claude-makieta.html`)  
**Read alongside:** `VISUAL_BRIEF.md` §1–3 / §11 · `START_UI_SPEC.md` P0.1 · SPA `watch-tower-app/src/index.css`  
**Date:** 2026-09-23 (Europe/Warsaw)

---

## Framing (Sebastian locked)

> **Claude makieta = REFERENCE LEVEL, not a 1:1 clone.**

| DO | DO NOT |
|---|---|
| Match / **exceed** craft: denser layout, stronger contrast, sharper type hierarchy, spine/KPI/table discipline | Adopt **Barlow / Barlow Condensed** as product fonts |
| Keep identity: **IBM Plex Sans / Condensed / Mono**, cold steel + **one amber** | Copy HTML DOM / Claude CSS var names as our identity |
| Prefer **solid** `--wt-surface` panels (Claude uses solid; Sebastian prefers solid over washed glass) | Clone Claude tokens verbatim into SPA branding |
| Dense glass **only** on chrome overlays if used (97%/blur16 chrome · 98.5%/blur18 panels) — or skip glass and stay solid | Full-page glass KPI / milk / neon / blob |
| Roles **HHL / KSH / SCX** only; SITE Stegra = POI geography | Stegra persona / theme row |

**SoT language:** *inspired by Claude craft, not cloned.*

Font swap (locked): wherever makieta says `"Barlow Condensed"` → SPA `--font-cond` / IBM Plex Sans Condensed; `"Barlow"` → IBM Plex Sans. **Sizes, weights, letter-spacing, density stay.**

---

## A. Design tokens from makieta

Quoted from `:root` / dark override in `tower-makieta.html` L11–47. SPA already maps these 1:1 as `--wt-*` in `index.css` — **keep SPA names**, values are the craft floor.

### A.1 Surfaces & ink (light default in HTML; dark = HHL ops floor)

```css
/* LIGHT (makieta --* → SPA --wt-*) */
--page / --wt-bg:           #E3E9ED;
--surface / --wt-surface:   #FFFFFF;
--surface-2 / --wt-surface-2: #F4F7F9;
--surface-3 / --wt-surface-3: #EAEFF3;
--ink / --wt-ink:           #0E1A24;
--ink-2 / --wt-ink-muted:   #3C4E5C;
--ink-3 / --wt-ink-faint:   #6C7D8A;
--rule / --wt-border:       #C9D5DD;
--rule-2 / --wt-border-soft: #DEE6EB;

/* DARK (makieta [data-theme=dark] / prefers-color-scheme) */
--page / --wt-bg:           #080F15;
--surface / --wt-surface:   #101C25;
--surface-2 / --wt-surface-2: #16242F;
--surface-3 / --wt-surface-3: #1D2E3A;
--ink / --wt-ink:           #DCE7EE;
--ink-2 / --wt-ink-muted:   #A4B6C2;
--ink-3 / --wt-ink-faint:   #748896;
--rule / --wt-border:       #263A48;
--rule-2 / --wt-border-soft: #1C2B36;
```

### A.2 Accent & severity

```css
/* LIGHT */
--amber / --wt-accent:  #C97E12;  --amber-bg / --wt-accent-bg: #FBEFD9;
--red / --wt-crit:      #B32639;  --red-bg / --wt-crit-bg:     #F8DEE2;
--go / --wt-ok:         #1B6E5D;  --go-bg / --wt-ok-bg:        #DCEDE8;
--sea / --wt-ferry:     #245C87;  --sea-bg / --wt-ferry-bg:    #DCE8F1;
--plan / --wt-plan:     #6C7D8A;  --plan-bg / --wt-plan-bg:    #E6ECF0;
--focus / --wt-focus:   #1D6FB8;  /* a11y — NOT amber */

/* DARK */
--amber / --wt-accent:  #E5A544;  --amber-bg: #3A2C12;
--red / --wt-crit:      #E8687C;  --red-bg:   #3B1720;
--go / --wt-ok:         #4FB79E;  --go-bg:    #0F2B27;
--sea / --wt-ferry:     #6BA8D6;  --sea-bg:   #12283A;
--plan / --wt-plan:     #7E93A1;  --plan-bg:  #1A272F;
--focus / --wt-focus:   #5AA6E8;
```

MEDIUM gut = same amber as accent. CRITICAL+HIGH share `--wt-crit` (do not split palette).

### A.3 Font stacks & sizes (makieta → SPA swap)

| Role | Makieta (reference) | SPA identity (use this) | Size / weight |
|---|---|---|---|
| Body UI | Barlow 14 / lh 1.45 | IBM Plex Sans | **13.5–14** / 400–500 |
| Brand wordmark | Barlow Condensed 23 / 700 / ls `.06em` | IBM Plex Sans Condensed | **22–23** / 700 / ls `.06em` |
| Spine count `.n` | Barlow Condensed **26** / 700 (zero → 500 + ink-3) | Condensed | **24–26** / 700 |
| KPI value `.v` | Barlow Condensed **29** / 700 / lh 1.05 | Condensed | **28–30** / 700 |
| Panel title | Condensed **17** / 600 / ls `.02em` | Condensed | **15–17** / 600 |
| Drawer code `h3` | Condensed **25** / 700 / ls `.03em` | Condensed | **24–25** / 700 |
| Table body | 13.2 | Sans + tabular | **13–13.2** |
| Thead | Condensed 13 / 600 | Condensed or Sans 600 | **13** / 600 |
| Meta / caption | 11.5–12.5 ink-3 | Sans faint | **11.5–12.5** |
| Mono / clock / age | Condensed 13–14 | **IBM Plex Mono** (or condensed tabular) | 12–14 |
| Status pill | Condensed 11.5 / 600 / pad `1×7` / r 2 | Condensed | **11.5** / 600 |
| Nav label | 14 | Sans | **13–14** |
| Global | `font-variant-numeric: tabular-nums` | keep | — |

### A.4 Spacing rhythm (quoted)

| Token | Makieta value |
|---|---|
| Topbar h | **52px** · pad `0 14px` · gap 18 |
| Spine | pad `9px 14px 11px` · min-inner **940px** · bar **3px** |
| Nav w | **186px** (collapsed recipe: **56px** @ ≤1100) |
| Nav item | pad `8px 14px` · left bar **3px** · gap 9 |
| Panel margin | **12px** · border 1 rule |
| Panel-hd pad | `9px 13px` · surface-2 |
| Panel-bd pad | **13px** (flush = 0) |
| KPI tile pad | `11px 13px` |
| Exception row | pad `9px 13px 9px 10px` · gap 10 · gut **3px** |
| Table th / td | th `7×9` · td `6×9` → row ~**32–34px** |
| Drawer | `min(560px,100%)` → SPA brief locks **440** (400–480) |
| Radius | controls/pills **2px** · panels 0–3 (makieta panel = **0** radius, square) |
| Iconbtn | **30×30** · r 2 |

### A.5 Glass / chrome

**Makieta has NO backdrop-filter.** Topbar, nav, panels, map overlays, drawer = **100% solid** `--surface`.

SPA already has dense glass recipes in `index.css` (Sebastian 2026-09-23). **Current preference: prefer solid like Claude when readability matters; glass only on chrome overlays if used.**

```css
/* KEEP if chrome glass is used — do not regress below these fills */
.wt-glass-chrome {
  background: color-mix(in srgb, var(--wt-surface) 97%, transparent);
  backdrop-filter: blur(16px) saturate(1.15);
  border: 1px solid color-mix(in srgb, var(--wt-border) 70%, var(--wt-ink) 30%);
  color: var(--wt-ink); /* never translucent ink */
}
.wt-glass-panel {
  background: color-mix(in srgb, var(--wt-surface) 98.5%, transparent);
  backdrop-filter: blur(18px) saturate(1.15);
  border: 1px solid color-mix(in srgb, var(--wt-border) 65%, var(--wt-ink) 35%);
  color: var(--wt-ink);
}
/* KPI / tables / spine = solid — never glass */
```

Rewrite bias: Topbar / drawer / notif popover may stay glass **or** go solid `--wt-surface`. Map layer/legend chips: solid surface border (Claude) or chrome glass — not milk.

---

## B. Component anatomy (craft recipes)

Recipes below quote makieta CSS; apply with **IBM Plex** and SPA tokens. Structure is craft anatomy, not a DOM mandate.

### B.1 Topbar

**DOM outline (reference):**
```
header.topbar
  .brand > b + span#brandSub
  .spacer
  .roleswitch > span + .seg#roleSeg > button[data-role]×3
  .seg#langSeg > button[data-lang]×3
  button.iconbtn#themeBtn
  .clock
```

**Craft CSS (makieta → adapt):**
```css
.topbar {
  display: flex; align-items: center; gap: 18px;
  padding: 0 14px; height: 52px;
  background: var(--wt-surface); /* SOLID preferred */
  border-bottom: 1px solid var(--wt-border);
}
.brand b {
  font-family: var(--font-cond);
  font-weight: 700; font-size: 23px; letter-spacing: .06em;
}
.brand span { color: var(--wt-ink-faint); font-size: 13px; }
```

**Elite feel:** flat steel bar, no shadow, brand condensed tracking, clock tabular — command desk, not marketing header.

### B.2 Role switcher (`.seg`)

```css
.seg {
  display: flex; border: 1px solid var(--wt-border);
  border-radius: 2px; overflow: hidden; background: var(--wt-surface-2);
}
.seg button {
  padding: 5px 11px; font-size: 12.5px; font-weight: 500;
  color: var(--wt-ink-muted); border-right: 1px solid var(--wt-border);
}
.seg button[aria-pressed="true"] {
  background: var(--wt-ink); color: var(--wt-surface); /* inverted ink fill */
  font-weight: 600;
}
```

**Craft note:** Claude uses **ink-inverted segment** (not amber outline chips). SPA Topbar currently uses separate `wt-btn`s with amber border + accent text when active — softer / more “SaaS chip”. To match craft: either unified `.seg` with ink press, or keep logos but press = surface-3 + ink weight, amber only as 1px edge if needed — **not amber-filled buttons**.

Roles: **HHL / KSH / SCX only** (makieta already; no Stegra).

### B.3 Corridor spine

```
.corridor > .corridor-inner
  button.stage[aria-pressed] × N
    .n | .l | .bar > i (width = share of max)
```

```css
.corridor {
  background: var(--wt-surface); border-bottom: 1px solid var(--wt-border);
  padding: 9px 14px 11px; overflow-x: auto;
}
.corridor-inner { display: flex; align-items: stretch; min-width: 940px; }
.stage {
  flex: 1; padding: 2px 10px 2px 12px;
  border-left: 1px solid var(--wt-border-soft); text-align: left;
}
.stage .n {
  font-family: var(--font-cond); font-weight: 700;
  font-size: 26px; line-height: 1; color: var(--wt-ink);
}
.stage .n.zero { color: var(--wt-ink-faint); font-weight: 500; }
.stage .l { font-size: 11.5px; color: var(--wt-ink-faint); margin-top: 2px; }
.stage .bar { height: 3px; margin-top: 6px; background: var(--wt-border-soft); }
.stage .bar i { display: block; height: 3px; /* domain color fill % */ }
.stage[aria-pressed="true"] { background: var(--wt-surface-3); }
.stage[aria-pressed="true"] .l { color: var(--wt-ink); }
/* bar colors: .sea → ferry · .site → ok · .pre → plan · else road/sea */
```

**Elite:** proportional bar (count/max), not full-width tint; pressed = wash only; zero counters de-emphasized; every stage filters map+list.

### B.4 Nav

```css
nav {
  background: var(--wt-surface); border-right: 1px solid var(--wt-border);
  padding: 10px 0; width: 186px;
}
nav button {
  display: flex; align-items: center; gap: 9px; width: 100%;
  padding: 8px 14px; font-size: 14px; color: var(--wt-ink-muted);
  border-left: 3px solid transparent; text-align: left;
}
nav button[aria-current="page"] {
  background: var(--wt-surface-3); color: var(--wt-ink); font-weight: 600;
  border-left-color: var(--wt-accent); /* amber = sole product signal */
}
nav .count {
  margin-left: auto; font-size: 11.5px; font-weight: 600;
  padding: 0 5px; border-radius: 2px;
  background: var(--wt-border-soft); color: var(--wt-ink-muted);
}
nav .count.hot { background: var(--wt-crit-bg); color: var(--wt-crit); }
nav .sep { height: 1px; background: var(--wt-border-soft); margin: 9px 14px; }
```

**Elite:** 3px amber rail (not pill fill of whole row); hot badge only when needed; separators group money/admin.

### B.5 KPI strip (flush rail — anti-card)

```css
.kpis {
  display: grid; grid-template-columns: repeat(3, 1fr);
  border-top: 1px solid var(--wt-border-soft);
  /* NO gap — flush inside one solid panel */
}
.kpi {
  padding: 11px 13px;
  border-right: 1px solid var(--wt-border-soft);
  border-bottom: 1px solid var(--wt-border-soft);
}
.kpi .k { font-size: 11.5px; color: var(--wt-ink-faint); }
.kpi .v {
  font-family: var(--font-cond); font-size: 29px; font-weight: 700;
  line-height: 1.05; margin-top: 1px;
}
.kpi .d { font-size: 11.5px; color: var(--wt-ink-faint); margin-top: 1px; }
.kpi .v.alert { color: var(--wt-crit); }
.kpi .v.warn  { color: var(--wt-accent); }
.kpi .v.good  { color: var(--wt-ok); }
```

**Elite:** one panel, divider grid, huge condensed number, color = severity not decoration. Every tile clickable (SPA already).

### B.6 Exception row

```css
.exq li {
  display: flex; gap: 10px; align-items: flex-start;
  padding: 9px 13px 9px 10px;
  border-bottom: 1px solid var(--wt-border-soft); cursor: pointer;
}
.exq .gut { width: 3px; flex: 0 0 3px; align-self: stretch; background: var(--wt-plan); }
.exq li[data-sev="CRITICAL"] .gut,
.exq li[data-sev="HIGH"] .gut { background: var(--wt-crit); }
.exq li[data-sev="MEDIUM"] .gut { background: var(--wt-med); /* = accent */ }
.exq .t { font-weight: 500; line-height: 1.3; }
.exq .m { font-size: 12px; color: var(--wt-ink-faint); margin-top: 2px; }
.exq .age {
  font-family: var(--font-cond); font-size: 13px;
  color: var(--wt-ink-faint); white-space: nowrap;
}
```

**Elite:** gut is primary signal (no ⚠️ icon); meta must carry **next action**; age condensed tabular right.

### B.7 Map overlays (legend / layers)

```css
.maplayers, .mapkey {
  position: absolute; background: var(--wt-surface); /* SOLID */
  border: 1px solid var(--wt-border); padding: 7px 9px;
}
.maplayers { top: 9px; left: 9px; font-size: 12.5px; max-width: 190px; }
.mapkey {
  bottom: 9px; left: 9px; font-size: 12px;
  display: flex; gap: 11px; flex-wrap: wrap;
  max-width: min(480px, calc(100% - 18px));
}
.mapkey i { width: 8px; height: 8px; border-radius: 50%; display: inline-block; margin-right: 4px; }
```

Legend dots: sea / amber / red / go / ink-3 (silent). SPA MapView has layers chrome glass top-left — **missing bottom legend chip** (GAP).

### B.8 Notification bell panel

**Not in makieta HTML** — SPA invents it (START_UI_SPEC). Craft to borrow from ExceptionRow + solid/glass panel:

- Bell hit ~30–32 · badge condensed 10 tabular on `--wt-crit`
- Panel **360–400** wide · header + mark-all · rows = gut 3 + title/body + age
- Prefer **solid** surface or `.wt-glass-panel` 98.5%/18 — never translucent text

### B.9 Drawer header

```css
.drawer {
  width: min(560px, 100%); /* SPA: 440 locked */
  background: var(--wt-surface); border-left: 1px solid var(--wt-border);
}
.drawer-hd { padding: 12px 15px; border-bottom: 1px solid var(--wt-border); }
.drawer-hd h3 {
  font-family: var(--font-cond); font-size: 25px; font-weight: 700;
  letter-spacing: .03em; margin: 0;
}
.drawer-hd .meta { font-size: 12.5px; color: var(--wt-ink-faint); margin-top: 3px; }
.dtabs { background: var(--wt-surface-2); border-bottom: 1px solid var(--wt-border); }
.dtabs button[aria-selected="true"] {
  border-bottom: 2px solid var(--wt-accent); font-weight: 600; color: var(--wt-ink);
  background: var(--wt-surface);
}
```

Scrim: `rgba(6,14,20,.45)`.

### B.10 Status pills

```css
.pill {
  display: inline-block; padding: 1px 7px; border-radius: 2px;
  font-size: 11.5px; font-weight: 600;
  font-family: var(--font-cond); letter-spacing: .02em;
}
.p-plan  { background: var(--wt-plan-bg);  color: var(--wt-ink-muted); /* or --wt-plan */ }
.p-go    { background: var(--wt-ok-bg);    color: var(--wt-ok); }
.p-sea   { background: var(--wt-ferry-bg); color: var(--wt-ferry); }
.p-amber { background: var(--wt-accent-bg); color: var(--wt-accent); }
.p-red   { background: var(--wt-crit-bg);  color: var(--wt-crit); }
```

Short codes only — never full sentences.

### What makes it feel more elite than generic SaaS

1. **Flush tables & KPI rails** — borders as structure, almost no card-gap air  
2. **One amber product signal** — nav rail / tab underline / MED gut; domain hues elsewhere  
3. **Condensed display only on numbers** — body stays quiet sans  
4. **3px severity gut** — scan in <3 s without icons  
5. **Radius 2** — instrument, not consumer app  
6. **Solid steel surfaces** — no frosted KPI hero  
7. **Pressed = surface-3 wash or ink invert** — not neon glow  
8. **Actionable chrome** — spine/KPI/row all filter or open drawer  

---

## C. Density & character rules

### C.1 Repeated numbers

| Measure | Value |
|---|---|
| Row / cell pad | 6×9 (table), 9×13 (lists) |
| Panel pad / margin | 13 / 12 |
| Gaps in topbar / filters | 8–18 (prefer even scale 8/10/12/14) |
| Bar / gut / nav rail | **3px** everywhere as signal width |
| Control height | icon 30 · btn ~28 · input 28 |
| Radius | **2** controls · ≤3–4 panels · **0** table |

### C.2 Severity gut

- Always 3px full stretch  
- CRITICAL/HIGH → crit · MEDIUM → amber · else plan  
- Never replace with emoji warning  

### C.3 Pressed / active

| Control | Pressed look |
|---|---|
| Spine stage | `surface-3` bg · label → ink |
| Nav current | `surface-3` + **3px amber** left |
| Seg / chipbtn | **ink fill** + surface text (inverted) |
| Drawer tab | 2px amber underline + surface bg |
| Map hover row | `amber-bg` wash |

### C.4 Table vs card philosophy

- **Default = table / flush list** inside one bordered panel  
- Cards only when content is genuinely heterogeneous (banner, locked pricing, map split)  
- KPI = cells in a grid, **not** `gap-3` floating cards  
- Dashboard secondary columns: still one `panel` with `panel-hd` + flush body — not padded “card stacks” with large radius  

---

## D. GAP vs current SPA

SPA tokens/colors already match makieta hex. Gaps are **craft execution** (density, hierarchy, solid discipline, missing pieces).

- **Spine counts 24px vs makieta 26px** — bump to 24–26; bar uses full domain color opacity even when n=0 at 0.35 (makieta uses width% on track — SPA full bar always on; consider proportional fill like Claude).  
- **KPI value 28 vs 29** — minor; lh SPA 1.1 vs makieta 1.05; pad `py-2.5` ≈ ok, keep minHeight discipline without airy cards.  
- **Role switcher craft:** SPA = discrete logo chips + amber border/text when active; makieta = unified `.seg` with **ink-inverted press**. Feels chippy/SaaS vs steel instrument.  
- **Topbar glass vs Claude solid:** SPA `wt-glass-chrome` on topbar; Claude solid surface. Sebastian now prefers solid — consider solid topbar (glass optional only where overlaying map).  
- **Drawer glass vs solid:** SPA `wt-glass-panel` width 440; Claude solid 560. Prefer solid surface; keep 440 width.  
- **Drawer title 24 vs 25** + letter-spacing `.03em` missing on SPA h3.  
- **Nav current:** SPA absolute 3px bar + rounded `mx-1 my-0.5` row (height 32) — slightly “chip in gutter”; Claude full-bleed button with border-left 3 transparent→amber. Closer to edge-to-edge rail = denser.  
- **Nav label 13px vs 14** — slight underweight.  
- **Panel headers:** Claude `panel-hd` surface-2 + condensed 17 + sub; SPA often bare `font-cond 15` without surface-2 strip / sub count — less hierarchy.  
- **Dashboard cardy air:** `p-3 space-y-3` + `lg:grid-cols-2 gap-3` + secondary sections `wt-panel p-3` without flush `panel-hd` — more card-grid than Claude’s `grid2` zero-gap split inside one panel.  
- **Map legend missing:** Claude `.mapkey` bottom-left solid chip; SPA only layers panel top-left — no status legend overlay.  
- **Map layers:** SPA uses glass chrome (ok if overlaying basemap); Claude solid — either fine if ink full opacity.  
- **Exception age:** SPA `font-cond` weight 600 but size inherits (~13.5 body); Claude explicit **13 condensed**.  
- **Exception meta:** SPA includes nextAction (good); ensure title weight 500 / lh 1.3 matches.  
- **Status pills:** SPA already 1×7 / r2 / 11.5 cond — aligned.  
- **Table thead:** Schedule etc. need sticky surface-2 + condensed 13 / pad 7×9 — verify not default Tailwind loose.  
- **Banner strip:** Claude `.banner` / `.banner.red` with 3px left edge — SPA dash uses ferry/situation **buttons** instead of full-width severity banner; craft gap for exception-first home.  
- **Clock:** Claude condensed 14 ink-2; SPA mono 12 — prefer condensed or mono tabular 13–14.  
- **Brand:** SPA 22 vs Claude 23 — within brief 22–24; tracking `.06em` ok.  
- **Body 13.5 vs 14** — brief allows 13.5–14; fine.  
- **No Barlow regression** — SPA correctly on IBM Plex (GOOD — preserve).  
- **Glass on KPI:** SPA KPI solid (GOOD). Do not glass them.  

---

## E. Constraints to PRESERVE (do not regress)

1. **Dense glass (if used):** chrome **97%** + blur **16**; panel **98.5%** + blur **18**; KPI / tables / spine **solid**. Prefer solid panels over washed glass (Sebastian 2026-09-23 course-correct).  
2. **Cold steel + one amber** — ferry/ok/crit are domain, not second brand hue.  
3. **IBM Plex Sans / Condensed / Mono** — **never** ship Barlow from HTML.  
4. **Anti-slop:** no Inter/indigo/blur-orbs/hero mesh/full-page glass KPI/pastel card grids/`radius ≥ 8`/dead metrics.  
5. **Roles HHL / KSH / SCX only** — no Stegra persona; SITE label = POI geography.  
6. **Theme first paint:** HHL+SCX dark, KSH light; toggle for all.  
7. **Actionable chrome:** every KPI / spine stage / exception row navigates.  
8. **Severity gut 3px** + next action on exceptions.  
9. **Inspired by Claude craft, not cloned** — match density/contrast/hierarchy; keep WT identity.

---

## Copy-paste recipe pack (SPA-ready)

```css
/* --- WT craft floor (IBM Plex + Claude density) --- */
:root {
  /* use existing --wt-* tokens from index.css — hex already match Claude */
  --wt-topbar-h: 52px;
  --wt-spine-pad-y: 9px 14px 11px;
  --wt-nav-w: 186px;
  --wt-nav-w-collapsed: 56px;
  --wt-panel-margin: 12px;
  --wt-panel-pad: 13px;
  --wt-gut: 3px;
  --wt-radius-ctrl: 2px;
  --wt-row-td-pad: 6px 9px;
  --wt-kpi-num: 29px;
  --wt-spine-num: 26px;
  --wt-brand-size: 23px;
}

.wt-seg-pressed {
  background: var(--wt-ink);
  color: var(--wt-surface);
  font-weight: 600;
}
.wt-nav-current {
  background: var(--wt-surface-3);
  color: var(--wt-ink);
  font-weight: 600;
  border-left: 3px solid var(--wt-accent);
}
.wt-spine-count {
  font-family: var(--font-cond);
  font-size: var(--wt-spine-num);
  font-weight: 700;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}
.wt-kpi-value {
  font-family: var(--font-cond);
  font-size: var(--wt-kpi-num);
  font-weight: 700;
  line-height: 1.05;
  font-variant-numeric: tabular-nums;
}
.wt-severity-gut {
  width: var(--wt-gut);
  flex: 0 0 var(--wt-gut);
  align-self: stretch;
}
```

---

## Sources grepped

- `tower-makieta.html` L11–267 (`:root`, shell, corridor, nav, kpi, exq, table, map, drawer, pills)  
- `claude-makieta.html` — byte-identical sibling  
- `claude-visual-ref/README.md` — makieta = self-contained demo; roles HHL/KSH/SCX  
- `CURSOR_PROMPT.md` — product context; management-by-exception; not visual SoT  
- SPA `index.css` + shell/ui components for GAP  
- `VISUAL_BRIEF.md` §1–3 / §11 + `START_UI_SPEC.md` P0.1 glass lock  

*End extract. Rewrite motto: inspired by Claude craft, not cloned.*
