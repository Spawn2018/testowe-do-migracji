# IDENTICAL CLAUDE — chrome/copy/layout lock (2026-09-23 ~02:15 CEST)

**Mandate:** Visual squint = identical to Claude makieta. Ours = data/functions only.  
**SoT:** `claude-visual-ref/tower-makieta.html` ≡ `public/claude-ref.html`  
**App:** `/workspace/watch-tower-app` · preview `http://127.0.0.1:4177/` · `npm run build` **PASS**  
**Shots:** `watch-tower-app/shots-start/identical-claude-{app,makieta,diff-notes}.png`

---

## Fixes applied

| # | Issue | Fix |
|---|---|---|
| 1 | **P2 doubled IDs** `SG-09SG-09` | `ExceptionRow`: code only in `.t` when not already in `title`; never re-append in `.m`. Meta = `owner · nextAction` only (Claude pattern). |
| 2 | Title+meta visually concatenated (Tailwind/inline spans) | `.exq .t` / `.exq .m` → `display:block` (stack like makieta rows). |
| 3 | Brand logo chip (not in Claude) | Removed role logo pill from `.brand`; sub = `Stegra Boden · {ROLE_META.name}`. |
| 4 | Topbar hamburger (not in Claude) | Removed ☰ from topbar; nav collapse remains on nav footer only. |
| 5 | `corridor-inner` min-width **1080** vs Claude **940** | CSS → `min-width:940px`. |
| 6 | KPI panel sub `SITE POI` | → `{date} · projekt Stegra Boden` (Claude). |
| 7 | Double panel margin inline | Dropped redundant `style={{ margin: 12 }}` (`.panel` already `margin:12px`). |
| 8 | Locked-price I18N | `no_price` → Claude `locked`: PL *Ta cena nie jest widoczna w Twojej roli.* / EN / SV. |
| 9 | Nav badges | Risk = all risks (Claude); geo = geofences.length; sched = loads.length. |
| 10 | Map chrome | Wrapped in `.panel` + `.panel-hd` (Mapa · N pojazdów… · chipbtn Strefy) + `.mapsplit` / `.mapbox` / `.maplayers` / `.mlist` + Claude `.note`. |
| 11 | Risks view chrome | `.panel` + `q_title`/`exceptions` head; ExceptionRow gets `code` without `[TYPE]` prefix. |
| 12 | HHL Marża KPI shape | Value = PLN total; delta = `pct% · koszt … PLN` (Claude `k_margin`). |
| 13 | SCX Przychód tygodnia | PLN figure + `tydzień 38, do zafakturowania` (not em-dash). |

---

## Chrome parity (HHL dark · PL)

| Check | App | Makieta |
|---|---|---|
| Brand | `TOWER` | `TOWER` |
| Brand sub | `Stegra Boden · H&H Logistics` | same |
| Roles | H&H Logistics / KSH / Scandinavian Express | same |
| Spine 9 | Przygotowanie…Dostarczone (+ Gdańsk) | same |
| Nav labels | Kokpit…Strefy | same |
| KPI labels | Transporty w drodze · Wymaga decyzji · Terminowość · Marża narastająco · Komplet dokumentów · Czas wykrycia odchylenia | same |
| Panel heads | H&H Logistics · Wymaga decyzji · Postęp dostaw · Mapa | same |
| Topbar / nav | 52 / 186 | 52 / 186 |
| corridor min | 940px | 940px |
| Logo chip / ☰ | none | none |
| Doubled ex IDs | **[]** | **[]** |

---

## Allowed diffs (data / product)

- Seed counts, ETAs, exception copy bodies, banner text (app = live critical exception; makieta = ferry copy).
- Bell + Notification Center badge (product).
- Nav footer collapse «/» (product; no topbar ☰).
- MapLibre/Leaflet engine inside Claude `.mapbox` (vs SVG sketch).
- Extra drawer tabs (resources / awizacja / ferry / ETA) beyond Claude’s five — labels for shared tabs stay Claude I18N.

---

## Verify

1. Open app `:4177/` beside `claude-ref.html` — squint shell = twin.  
2. Exception rows: one code in title line; meta on second line; no `SG-09SG-09`.  
3. `npm run build` PASS · preview 4177.  
4. Shots `identical-claude-*.png`.

**Gate:** Visual squint = identical.
