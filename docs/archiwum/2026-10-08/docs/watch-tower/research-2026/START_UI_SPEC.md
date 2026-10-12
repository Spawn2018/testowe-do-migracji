# START UI SPEC — Visual → Builder (pass 2 · synced)

**Synced:** 2026-09-23 ~01:31 · with UX `VISUAL_BRIEF.md` + `UX_MAP.md` + `VISUAL_ALIGN_CLAUDE.md`

| Layer | Source of truth |
|---|---|
| **Visual + text + layout + style (1:1)** | [`VISUAL_BRIEF.md`](../VISUAL_BRIEF.md) + [`claude-makieta.html`](../claude-makieta.html) + [`claude-visual-ref/`](../claude-visual-ref/) |
| **Clone policy** | [`VISUAL_ALIGN_CLAUDE.md`](../VISUAL_ALIGN_CLAUDE.md) — Claude = **1:1 clone target**, not “bar only” |
| **M1–M12 · workflows · roles · seed · functional acceptance** | [`UX_MAP.md`](../UX_MAP.md) |
| **Builder handoff (this file)** | Tokens + shell geometry + ship gate pointing at VISUAL_BRIEF §0 |

**Sebastian HARD ~01:41:** Claude = **1:1 visual + text + layout + style**. Ours = data/functions/integrations only. **Gate any deviation as FAIL.**

**FROM ZERO ~01:46 (Sebastian):** Rebuild SPA shell from **Claude makieta CSS/DOM only**. Expand with data/functions/integrations. **No alternate design.** Gate = squint-match [`tower-makieta.html`](../claude-visual-ref/tower-makieta.html). Prior shell PASSes superseded until rebuild shots land.

**Override:** Prior anti-slop “Barlow FAIL / Plex only / Claude = bar not clone” is **void** for shell. Barlow is **required**. Plex-as-primary is **FAIL**.

**Roles / theme:** HHL · KSH · SCX only · Stegra = SITE POI · first-paint HHL+SCX `data-theme="dark"` · KSH `light`.

---

## Sync status (pass 2)

- [x] `VISUAL_BRIEF.md` — Claude 1:1 (UX)  
- [x] `UX_MAP.md` — split SoT; shell Claude; acceptance visual match  
- [x] `VISUAL_ALIGN_CLAUDE.md` — clone-target policy  
- [x] `START_UI_SPEC.md` — this pass (Visual)  
- [x] SPA: Barlow loaded; tokens = Claude hex; side-by-side vs makieta PASS (Builder 2026-09-23 ~01:35 EU/Warsaw)  

---

## Claude tokens (canonical — match VISUAL_BRIEF §2)

```css
/* light */
:root, [data-theme="light"] {
  --page: #E3E9ED;
  --surface: #FFFFFF;
  --surface-2: #F4F7F9;
  --surface-3: #EAEFF3;
  --ink: #0E1A24;
  --ink-2: #3C4E5C;
  --ink-3: #6C7D8A;
  --rule: #C9D5DD;
  --rule-2: #DEE6EB;
  --amber: #C97E12; --amber-bg: #FBEFD9;
  --red: #B32639;   --red-bg: #F8DEE2;
  --go: #1B6E5D;    --go-bg: #DCEDE8;
  --sea: #245C87;   --sea-bg: #DCE8F1;
  --plan: #6C7D8A;  --plan-bg: #E6ECF0;
  --focus: #1D6FB8;
}

/* dark */
[data-theme="dark"] {
  --page: #080F15;
  --surface: #101C25;
  --surface-2: #16242F;
  --surface-3: #1D2E3A;
  --ink: #DCE7EE;
  --ink-2: #A4B6C2;
  --ink-3: #748896;
  --rule: #263A48;
  --rule-2: #1C2B36;
  --amber: #E5A544; --amber-bg: #3A2C12;
  --red: #E8687C;   --red-bg: #3B1720;
  --go: #4FB79E;    --go-bg: #0F2B27;
  --sea: #6BA8D6;   --sea-bg: #12283A;
  --plan: #7E93A1;  --plan-bg: #1A272F;
  --focus: #5AA6E8;
}
```

Optional `--wt-*` aliases **must equal** these hex values (VISUAL_BRIEF §2 aliases table).

### Type (required)

```html
<link href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700&family=Barlow+Condensed:wght@500;600;700&display=swap" rel="stylesheet">
```

| Use | Face | Size / weight |
|---|---|---|
| Body | Barlow | 14 / 400–700 · tabular-nums |
| Brand | Condensed | 23 / 700 · ls .06em |
| Panel h2 | Condensed | 17 / 600 |
| KPI `.v` | Condensed | **29** / 700 |
| Spine `.n` | Condensed | **26** / 700 |
| Drawer h3 | Condensed | 25 / 700 |
| Table th | Condensed | 13 / 600 |

### Shell geometry (makieta)

| Part | Spec |
|---|---|
| Topbar | 52px |
| Nav | **186px** expanded · **56px** collapsed (≤1100 and/or toggle + `sessionStorage.wtNavCollapsed`) |
| Current nav | amber **3px** left rail |
| Corridor spine | Condensed counts + **3px** stage bars |
| Controls radius | **2px** |
| Panels | 1px `--rule`, solid `--surface` (no milk glass KPI/spine/table) |
| Seg | ink-invert pressed |
| KPI | flush 3-col rule grid (no card gap) |

---

## Ship gate (Visual)

Full table: **VISUAL_BRIEF §0**. Builder FAIL if:

1. Plex / Inter / Poppins as primary (Barlow missing)  
2. Soft card-gap KPI / big radius SaaS  
3. Nav ≠ Claude (no amber current, missing labels/counts)  
4. Corridor missing / wrong chrome  
5. Milk glass on KPI/spine/table  
6. Amber-outline chip role/lang (need ink `.seg`)  
7. Side-by-side vs `claude-makieta.html` fails squint test  

**PASS =** squint match Claude shell + M1–M12 wired per UX_MAP.

Gate artifact: [`CLAUDE_SHELL_GATE.md`](./CLAUDE_SHELL_GATE.md)


---

## Legacy notes (subordinate to Claude clone)

Text below may still mention dense glass / older P0 lists. **If it conflicts with Claude solid-first shell or Barlow**, ignore it. Prefer [`VISUAL_BRIEF.md`](../VISUAL_BRIEF.md) §0–§6 and [`VISUAL_ALIGN_CLAUDE.md`](../VISUAL_ALIGN_CLAUDE.md).

Useful keepers from legacy P0 (functional, not alternate look): collapsible nav, HHL/KSH/SCX only, org logos, click-through KPIs, bell mark-read, spine 2nd-click clear, real XLSX dry-run, no hollow CTAs.

## P0 — sześć priorytetów Sebastiana

### 1. Glass 2026 + anti-slop (DENSE — Sebastian 2026-09-23)

Glass was too transparent / unreadable. Motif stays; fill is near-opaque; readability from fill, not from weak blur.

**Locked tokens (canonical)** — Visual owns CSS class values in `watch-tower-app/src/index.css`:

```css
/* chrome: topbar, map chips, glass buttons */
.wt-glass-chrome {
  background: color-mix(in srgb, var(--wt-surface) 97%, transparent);
  backdrop-filter: blur(16px) saturate(1.15);
  -webkit-backdrop-filter: blur(16px) saturate(1.15);
  border: 1px solid color-mix(in srgb, var(--wt-border) 70%, var(--wt-ink) 30%);
  color: var(--wt-ink); /* never translucent ink */
}
/* panels: drawer, notification popover */
.wt-glass-panel {
  background: color-mix(in srgb, var(--wt-surface) 98.5%, transparent);
  backdrop-filter: blur(18px) saturate(1.15);
  -webkit-backdrop-filter: blur(18px) saturate(1.15);
  border: 1px solid color-mix(in srgb, var(--wt-border) 65%, var(--wt-ink) 35%);
  color: var(--wt-ink);
}
.wt-btn.wt-glass-chrome {
  background: color-mix(in srgb, var(--wt-surface-2) 97%, transparent);
  color: var(--wt-ink);
}
@supports not (backdrop-filter: blur(1px)) {
  .wt-glass-chrome, .wt-glass-panel { background: var(--wt-surface); }
}
```

**Rules:**
- Chrome (topbar, map chips, glass buttons): **97%** fill + blur **16px**
- Panels (drawer, notification popover): **98.5%** fill + blur **18px**
- KPI / tables / spine remain **100% solid** `--wt-surface` (no glass)
- Text/icons on glass: full `var(--wt-ink)` / muted tokens — never opacity <0.85 on body text
- Stronger border contrast (mix border + ink) — keep motif, keep text crisp
- Blur cap raised to **18px panels / 16px chrome** (was 12) because fill is near-opaque — **supersedes** old 78% / blur 8–12

**Still FAIL:** full-page glass KPI, milk glass white on dark, neon edge, blob mesh / tinted rainbow / heavy frosted hero cards.

**Gęstość (Claude makieta = shell SoT):** row ~32–34, panel padding 12–13, spine 56–64, topbar **52**, nav **186→56**, spine n **26**, KPI **29**. KPI = **flush rail** (dividers), nie card-gap.

**Solid first:** Claude makieta = 100% solid surfaces. Prefer `--wt-surface` solid for topbar/drawer/nav/panels; dense glass 97/98.5 **only** where chrome overlays a busy surface (map). Never wash KPI/table/spine.

Font w SPA: **Barlow** (required; Plex not primary). Rozmiary Condensed 1:1 z craft extract.

### 2. Nav boczne ZWIJALNE

| Stan | Szerokość | Zachowanie |
|---|---|---|
| Expanded (default ≥1100) | **186 px** | ikona + label + badge |
| Collapsed | **56 px** | tylko glyph; tooltip `title`/`aria-label`; badge jako kropka/hot |
| Toggle | topbar lub pin na dole nav | `aria-expanded`; persystencja `localStorage.wt-nav-collapsed` |
| ≤1100 | auto-collapse | jak makieta `@media` |

Current item: 3 px amber left bar + surface-3 (bez pill fill całej szerokości).

### 3. Role: tylko HHL / KSH / SCX — bez STEGRA

- Usuń `STEGRA` z `RoleId`, switchera, `navForRole`, dashboard branch, seed `visibleTo`.
- **SITE / POI** „Stegra · Stalverket 20, Boden” zostaje jako **geografia**, nie rola.
- First paint theme:
  - **HHL** → `dark`
  - **SCX** → `dark`
  - **KSH** → `light`
- Manual theme toggle nadal dla wszystkich; session preference jak w VISUAL_BRIEF §8.

### 4. Logo firmowe per org

Pliki (już na dysku):

| Role | Light | Dark | Path |
|---|---|---|---|
| HHL | `hhl.png` / `hhl-wide.png` | test contrast | `/logos/hhl.png` |
| KSH | `ksh.svg` | `ksh-white.svg` | `/logos/ksh.svg` |
| SCX | `scx.png` | `scx-dark.png` | `/logos/scx.png` |

**UI:** w role switcherze: mark 20–24 px + kod roli; aktywna org w topbar: mark + short name (`H&H Logistics` / `KSH` / `Scandinavian Express`).  
Nie recolorować marek na amber produktu. Pad 2 px w chipie surface-2.

Źródła: hhlogistics.pl · ksh.pl · scandinavian.com.pl (README w folderze logos).

### 5. Wszystko klikalne → filtr lub deep-link

Każdy kafelek musi mieć `onClick` + `cursor:pointer` + keyboard:

| Element | Target |
|---|---|
| ExceptionRow | open LoadDrawer (loadId) + scroll do wyjątku; opcjonalnie set filter severity |
| KPI tile | set store filter (stage / severity / docs / margin flag) + stay on dash **lub** navigate list with query |
| Spine segment | filter loads+map by corridor stage (`aria-pressed`) |
| Risk chip / ferry risk | `view=risks` + riskId selected |
| Docs OK KPI | `view=docs` + filter missing |
| Margin waterfall row | `view=finance` + highlight line |
| Invoice badge | `view=invoices` |
| Map marker | sync list highlight + open drawer |
| Notification item | deep-link jak payload (`view`, `tab`, `entityId`) |

**Reguła:** brak martwych CTA. Hover = surface-2; pressed spine = surface-3.

### 6. Dzwonek + centrum powiadomień

- Topbar: bell iconbtn + badge count (**tylko unread**).
- Panel (popover glass, width 360–400): lista **wszystkich** notyfikacji widocznych dla roli (nie tylko hot).
- Każdy item: severity gut · title · meta · relative time · deep-link.
- **Oznacz jako przeczytane** (per item lub „oznacz wszystkie”) → **znika z listy unread** i schodzi z badge; opcjonalnie sekcja „Przeczytane” collapsed na dole (max 20) **albo** twarde usunięcie z UI po read — Sebastian: *oznacz przeczytane → znikają* → **usuń z listy** po mark-read.
- Seed ≥12 notyfikacji cross-module (exception, ferry, docs, invoice, geofence, ETA confidence drop).

Store sketch:
```ts
notifications: { id, roleScope[], severity, title, body, href: { view, entityId?, tab? }, read: boolean, ts }[]
markRead(id) // filters out of unread; badge = unread.length
```

---

## P0 FIX — Sebastian follow-up (2026-09-23)

Document for builder. Visual owns glass CSS only; spine / xlsx / hollow-CTA are builder unless trivial CSS.

### 1. Glass denser (tokens above)
- Visual owns `.wt-glass-chrome` / `.wt-glass-panel` / `.wt-btn.wt-glass-chrome` values in `index.css`.
- Target: chrome **97%** + blur **16px**; panels **98.5%** + blur **18px**; solid KPI/tables/spine.
- Text on glass = full ink (never translucent body text).

### 2. Spine 2nd click must clear filter
**Bug:** `CorridorSpine.tsx` calls `setStageFilter(stage)` then `navigateTo({ view:'map', stage })`. Store `setStageFilter` toggles null on same stage, but `navigateTo` then **FORCE-sets** `stageFilter: opts.stage` — so 2nd click never clears.

**Fix recipe (toggle in one place):**
- Compute `next = stageFilter === stage ? null : stage`, then `navigateTo({ view:'map', stage: next })`
- **OR** make `navigateTo` treat explicit `null` / use a toggle helper — do not call toggle then overwrite with forced stage.

### 3. Real XLSX dry-run (not hardcoded fake)
**Bug:** `ScheduleView.tsx` ~lines 39–65 hardcodes a `dryRun` object; no `xlsx` package in `package.json`.

**Fix:**
- Add dependency: SheetJS `xlsx` (or equivalent)
- In `acceptFile`, parse the uploaded `File`, map columns, produce `added` / `changed` / `removed` / `rejected` from file contents vs current loads
- Show **real** counts from parse/diff
- Reject non-xlsx uploads (clear error, no fake success)

### 4. No hollow CTAs
- Every visible button/link must: navigate, open drawer, set filter, or open a **real** modal
- Ban: `alert('soon')`, empty `onClick`, decorative primary buttons with no action
- Audit primary/secondary CTAs across dash, schedule, map, docs, finance

### Acceptance (this FIX)
- [ ] Glass chrome ≈97% / panel ≈98.5%; blur 16/18; KPI/tables/spine solid; ink full opacity
- [ ] Spine 2nd click clears `stageFilter` (map + list); pressed state resets
- [ ] XLSX dry-run parses real file; counts match file; non-xlsx rejected; no hardcoded dryRun object
- [ ] No hollow CTAs — every visible control has a real action (no `alert('soon')` / empty onClick)


---

## P0 VISUAL — Match / exceed Claude craft (match makieta shell; M1–M12 are ours) — 2026-09-23

**Goal:** SPA must feel **at least as dense/crafted** as `claude-visual-ref/tower-makieta.html` — while keeping **WT identity** (Barlow, `--wt-*`, HHL/KSH/SCX, solid-first + dense glass lock).

**SoT:** [`../VISUAL_BRIEF.md`](../VISUAL_BRIEF.md) §5–§6 + **§12** · extract [`CLAUDE_CRAFT_EXTRACT.md`](./CLAUDE_CRAFT_EXTRACT.md) · handoff [`CLAUDE_CRAFT_HANDOFF.md`](./CLAUDE_CRAFT_HANDOFF.md)

### Framing
| DO | DO NOT |
|---|---|
| Match/exceed density, contrast, spine/KPI/table/map discipline | Invent Plex/alternate type system |
| Prefer **SOLID** `--wt-surface` panels | Full-page / KPI glass, milk, blob, indigo |
| Dense glass **97%/16** chrome · **98.5%/18** panel **only if** chrome needs depth | Regress glass to 78% / weak blur |
| Use Barlow Condensed sizes 1:1 from makieta | Prefer Claude class recipes (`.topbar` `.panel` `.kpi` …); `--wt-*` aliases OK if 1:1 tokens |

### Concrete CSS recipes
Copy from **VISUAL_BRIEF §6** (already SPA-tokenized):
- §6.1 Topbar + `.wt-seg` (ink-invert press) + iconbtn 30 + clock Condensed 14
- §6.2 Corridor spine `.wt-stage` n=26 / bar track+fill / pressed surface-3
- §6.3 Nav 186↔56 · current amber left 3px
- §6.4 Flush KPI rail value **29** · pad 11×13 · zero gap
- §6.5 ExceptionRow gut 3 · age Condensed 13 · next action required
- §6.6 StatusPill / chips radius 2
- §6.7 Table sticky Condensed th · td 6×9
- §6.8 Map `.wt-maplayers` + **`.wt-mapkey`** (solid or dense chrome)
- §6.9 LoadDrawer h3 25 · tabs amber underline on surface-2 strip
- §6.10 Bell panel solid or `.wt-glass-panel`

### Builder checklist (visual impact order)
1. [ ] Spine number **26** Condensed 700; bar = track + % fill (domain color); pad 9/14/11
2. [ ] KPI value **29** / lh 1.05; flush 3-col rail; pad 11×13; no card gap
3. [ ] Role + lang controls → unified **seg ink-invert** (not amber-outline chips)
4. [ ] Topbar + drawer → **solid surface** preferred (glass only if overlaying map)
5. [ ] Drawer h3 **25** + letter-spacing `.03em`; tabs surface-2 + amber 2px underline
6. [ ] Nav current = full-bleed surface-3 + **3px amber** left (not inset rounded chip)
7. [ ] Panel headers = surface-2 strip + Condensed **17** + optional sub
8. [ ] Map: keep layers; **add bottom legend** `.wt-mapkey`
9. [ ] Exception age Condensed 13 faint; meta always includes next action
10. [ ] Table: sticky Condensed th 13; td pad 6×9; reduce dashboard `gap-3` card air
11. [ ] Clock Condensed/tabular 14; iconbtn 30×30; brand 23 / tracking .06em
12. [ ] Optional severity banner 3px left on exception-first home

### Glass rule (explicit)
Keep locked denser tokens (chrome 97%+blur16 · panel 98.5%+blur18). **Apply Claude’s solid chrome density TO glass fills** (near-opaque) — do not wash out. Prefer skipping glass entirely on topbar/drawer when not overlaying content.

### Acceptance (this P0 VISUAL)
- [ ] Side-by-side vs `tower-makieta.html`: density/contrast feel ≥ Claude; fonts = Barlow (locked)
- [ ] Key sizes: topbar 52 · spine 26 · KPI 29 · nav 186↔56 · row ~32–34 · gut/nav bar 3
- [ ] Solid KPI/spine/table/nav; glass only optional chrome; no 78% regression
- [ ] Seg ink-invert · map legend present · drawer tabs amber underline
- [ ] Anti-slop PASS · roles HHL/KSH/SCX · Stegra = SITE POI only
- [ ] All prior P0 + P0 FIX boxes still green (click-through, bell, spine toggle, XLSX, no hollow CTA)


---

## Acceptance (Visual gate)

- [ ] Brak roli STEGRA w UI
- [ ] Theme first-paint HHL/SCX dark, KSH light
- [ ] Nav collapse 186↔56 + persist
- [ ] Org logos visible in switcher (real files, not initials-only)
- [ ] Prefer solid panels; glass only chrome overlays (97/98.5) if needed; KPI/tables/spine solid
- [ ] Density match Claude makieta with Barlow (locked clone; not airy SaaS)
- [ ] Exception/KPI/spine/tiles clickable with real filter or deep-link
- [ ] Bell shows unread count; mark-read removes from list; empty state „Brak powiadomień”
- [ ] Anti-slop checklist PASS (`ANTI_SLOP_CHECKLIST.md`)

---

*Visual delivers SoT + logos. Builder implements in `watch-tower-app`. UX updates UX_MAP (Stegra role removal) — ping sent.*
