# WATCH TOWER — RESUME STATUS (Claude shell)

**When:** 2026-09-23 ~01:43 CEST (Europe/Warsaw)  
**App:** `/workspace/watch-tower-app`  
**Preview:** `http://0.0.0.0:4177/` (`vite preview --host 0.0.0.0 --port 4177`)  
**Build:** `npm run build` **PASS**  
**SoT:** `VISUAL_BRIEF.md` · `VISUAL_ALIGN_CLAUDE.md` · `research-2026/START_UI_SPEC.md` · `claude-visual-ref/tower-makieta.html`  
**Policy:** Claude makieta = **1:1** visual + layout + Barlow + copy voice. App expands with product utility only (M1–M12, ≥62 loads, map/AIS/TV/SEFS/permits/factoring/import). No alternate Plex/v3/v4/anti-slop skin.

---

## 1) Shell status — Claude 1:1

| Check | Result |
|---|---|
| Barlow + Barlow Condensed (Google Fonts) | **PASS** — `index.html` + `@theme` / `--wt-font-*` |
| Tokens = Claude hex (`--wt-*` aliases 1:1) | **PASS** — dark `#080F15` / light `#E3E9ED` page |
| Topbar **52** · brand Condensed **23** · ink `.seg` | **PASS** |
| Nav **186** · amber 3px current · collapse **56** · glyphs + `.sep` | **PASS** |
| Spine Condensed **26** + 3px bars | **PASS** |
| KPI flush 3-col · Condensed **29** · solid | **PASS** |
| HHL/SCX dark · KSH light first paint | **PASS** |
| Roles HHL/KSH/SCX only · Stegra = SITE POI | **PASS** |
| Leaflet public tiles (Esri Canvas Gray) | **PASS** — `.leaflet-container` + tiles loaded |
| Squint vs makieta | **PASS** (metrics all true) |

Prior Visual gate (`CLAUDE_SHELL_GATE.md` / pass ~01:37) already claimed PASS; this resume **re-verified** after PL copy align + rebuild.

### PL copy voice (Claude I18N)

Aligned to makieta `I18N.pl` where product stages map:

| Product stage | PL (now) |
|---|---|
| PLAN | Przygotowanie |
| LOADING | Załadunek |
| TO_PORT | Droga PL |
| FERRY | Prom |
| SE_ROAD | Droga SE |
| APPROACH | Nynäshamn |
| SITE | Boden |
| DELIVERED | Dostarczone |

Also: role switcher label **Widok**; SCX nav **Moje zadania**; KSH fin **Rozliczenia** / SCX fin **Moje stawki**; search Claude string. Leftover English UI literals (pricing dt, map legend leaflet twin, TV seed titles, Geofence WŁ./WYŁ., factoring live, etc.) → Polish. Lang switcher PL/EN/SV kept (makieta has it); default `locale: 'pl'`.

**Note:** Product spine stays **8** stages (utility model); Claude makieta has **9** (PRE…DONE with Gdańsk separate). Chrome/type/tokens match; stage count is intentional product mapping, not a second visual system.

---

## 2) Fresh shots

| File | Content |
|---|---|
| `watch-tower-app/shots-start/resume-claude-shell-cockpit.png` | HHL dark · Kokpit |
| `watch-tower-app/shots-start/resume-claude-shell-map.png` | HHL dark · Mapa + Leaflet tiles |
| `watch-tower-app/shots-start/resume-claude-shell-ksh.png` | KSH light · Kokpit |
| `watch-tower-app/shots-start/resume-claude-makieta-cockpit.png` | SoT side-by-side (dark HHL) |
| `watch-tower-app/shots-start/resume-claude-makieta-ksh.png` | SoT side-by-side (KSH light) |
| `watch-tower-app/shots-start/resume-claude-shell-metrics.json` | gate metrics (all checks `true`) |

---

## 3) Functional gaps left (honest)

Shell is **not** the blocker. Remaining product/integration gaps from closeout / UX_MAP:

| Gap | Severity | Notes |
|---|---|---|
| **Re-QA → SHIP** | Process | No full human click-QA after this rebuild |
| **Trafikverket live** | Integration | Needs API key; else PL-labeled seed (honest) |
| **AIS live** | Integration | Proxy + key; else seed banner |
| **Spine 8 vs Claude 9** | Product map | Keep 8; do not invent 9th stage without UX_MAP change |
| **Vite in-memory vs Claude Next/Supabase** | Architecture | Out of makieta scope; business flows mirrored locally |
| EN/SV dict completeness | Low | PL is default + SoT; EN/SV switcher present like makieta but not QA’d this pass |

M1–M12 core (import XLSX, bell, pricing hide, READY←cover, factoring, ETA bands, geofence editor, 12 workflows, 62 loads, SEFS waterfall) — **kept** from prior closeout; not re-broken by shell/copy pass.

---

## 4) Files touched this resume

- `src/i18n/messages.ts` — Claude PL voice + role-aware `navLabel`
- `src/components/shell/Nav.tsx` — pass `role` into `navLabel`
- `src/components/shell/CorridorSpine.tsx` — PL filter titles
- `src/components/drawer/LoadDrawer.tsx` — pricing labels PL
- `src/views/{Risks,Geofence,Finance,Invoices,Schedule,Docs}View.tsx` — EN→PL UI
- `src/components/map/CorridorMap.leaflet.tsx` — PL mapkey (twin)
- `src/lib/trafikverket.ts` — seed situations PL
- `src/data/seed.ts` — waitlist → lista oczekujących
- `scripts/shot-resume-claude-shell.mjs` — resume shots
- this `RESUME_STATUS.md`

**Do not invent a new visual system.** Claude shell remains SoT.
