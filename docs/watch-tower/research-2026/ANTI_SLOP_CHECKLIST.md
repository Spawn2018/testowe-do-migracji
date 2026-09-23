# ANTI-SLOP CHECKLIST — 30s FAIL gate (2026-09-23)

**HARD P0.** Any FAIL = do not ship. No “almost” / no polish pass.

Full SoT: [`../VISUAL_BRIEF.md`](../VISUAL_BRIEF.md) §0 · Refs: [`ANTI_SLOP_REFS_2026-09-23.md`](./ANTI_SLOP_REFS_2026-09-23.md) · Tokens: [`ANTI_SLOP_CSS_TOKENS.md`](./ANTI_SLOP_CSS_TOKENS.md)

---

## 30-second screenshot gate

Hold phone/screenshot at arm’s length (~2 m / 1 km smell test):

| # | Check | PASS | FAIL |
|---|---|---|---|
| 1 | Severity guts + spine counters readable | solid ink, counts pop | hero void / empty air |
| 2 | KPI = flush rail inside one panel | shared dividers, zero gap | card grid + soft shadow |
| 3 | One amber signal only | rail / MED / tab underline | amber-outline chips everywhere |
| 4 | Fonts | IBM Plex Sans/Condensed/Mono | Barlow / Inter / Roboto / Poppins |
| 5 | Radius / shadows | panels ≤3–4 · table 0 · no float shadow | soft SaaS radius ≥8 |
| 6 | Role/lang control | seg **ink-invert** pressed | amber chip chrome |
| 7 | Color | cold steel + amber + domain | indigo / pastel / 2nd neon / gradient KPI |
| 8 | Chrome noise | glyphs only when status/action | Lucide ornament spam |
| 9 | Exception row | what · why · **next verb** · age | status-only jewelry |
| 10 | Map | list/split or focus + legend | full-bleed poster / no list |
| 11 | Glass | none OR dense chrome over map | KPI/table glass wash |
| 12 | Roles | HHL / KSH / SCX | Stegra as app role |
| 13 | Confidence | HIGH/MED/LOW + source | “AI 94%” |
| 14 | Motion | ≤160 ms / reduced-motion kills | bounce / count-up / shimmer |
| 15 | Prices | node hidden if no rights | blur / `••••` theatre |

**Rule:** if you need more than 30s to decide → it already smells. FAIL and rewrite chrome.

---

## Top AI-smell kills (this SPA)

1. **Amber-outline chip chrome** (role switcher, filters) → replace with `.wt-seg` ink-invert  
2. **KPI card grids with gap** → flush `.wt-kpis` rail, solid  
3. **Soft radius + shadow stacks** → radius 2–3, border > shadow  
4. **Hero / empty decorative chrome** → exception-first density  
5. **Barlow leftover** → IBM Plex remap 1:1 Condensed sizes  
6. **Indigo / second neon / gradient KPI** → delete  
7. **Lucide ornament spam** → strip decorative icons  
8. **Glass as personality** → solid-first; glass only map chrome if needed  

---

## Pass stamp

```
[ ] 30s gate all PASS
[ ] VISUAL_BRIEF §0 FAIL list zero hits
[ ] ANTI_SLOP_CSS_TOKENS applied (seg ink-invert, flush KPI, solid table)
[ ] Screenshot side-by-side vs Claude craft floor (inspired, not clone)
```

Ship only when all four checked.

*WT—Visual · 2026-09-23*
