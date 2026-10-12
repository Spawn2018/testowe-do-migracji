# ETAP B — Manifest kompletności · `08_MANIFEST.md`

| Pole | Wartość |
|---|---|
| Data | **2026-09-23** Europe/Warsaw (UTC+2) · ~21:30 CEST |
| Baseline | commit **`305da3e`** · tag **`baseline-2026-09-23`** |
| App | `/workspace/watch-tower-app` |
| SoT poza app | `/workspace/watch-tower/` |
| Źródło listy 64 | Rekonstrukcja z **struktury t110 PROMPT FINALNY (Etap B, B1–B6)** + `docs/ETAP_0_5_GIT.md` + `package.json` / `package-lock.json` + **spot-check FS**. Brzmienie 64 linii **nie** jest dosłownym cytatem t110 (pełny tekst = RT t110u). Parent może skorygować nazwy vs transcript. |
| Statusy | **TAK** / **NIE** / **CZĘŚCIOWO** / **NIE MAM** — unknown = NIE MAM + kto |
| Lockfile | **PRESENT original** — md5 `2f9ce3e5ad8e80f5cd55d2b603bf6616` (nie reconstructed) |
| Zakres | **64 pozycje**. Nie zawężać. |

Legenda kolumn: **ID** · **Pozycja** · **Status** · **Dowód / kto** · **Uwagi**

---

## B1 — Repo / kod makiety (16)

| ID | Pozycja | Status | Dowód / kto | Uwagi |
|---|---|---|---|---|
| B1.01 | `package.json` (Vite + React + TS) | TAK | `/workspace/watch-tower-app/package.json` | name `watch-tower-app`; scripts `dev`/`build`/`preview`/`ais-proxy` |
| B1.02 | `package-lock.json` **original** | TAK | `/workspace/watch-tower-app/package-lock.json` · md5 **`2f9ce3e5ad8e80f5cd55d2b603bf6616`** · 127462 B · mtime 23.09 12:48 CEST | `docs/ETAP_0_5_GIT.md`: PRESENT original, **not reconstructed**; `npm i` nie odpalane |
| B1.03 | Drzewo `src/` SPA | TAK | `/workspace/watch-tower-app/src/` | components / data / hooks / i18n / lib / store / types / views |
| B1.04 | `HashRouter` | TAK | `src/App.tsx` | SPA static host (Vercel) bez rewrite serwera |
| B1.05 | Mapa **Leaflet** (aktywna) | TAK | `src/components/map/CorridorMap.tsx`, `CorridorMap.leaflet.tsx` | decyzja po MapLibre worker 404 |
| B1.06 | MapLibre leftover (dep + public workers) | CZĘŚCIOWO | `package.json` `maplibre-gl`; `public/maplibre-gl-*` | nie aktywna mapa; leftover + README stale |
| B1.07 | `src/i18n` pl/en/sv | TAK | `src/i18n/messages.ts` | default PL hard; kompletność EN/SV **nie QA’d** (A4/RESUME) |
| B1.08 | Zustand + localStorage persist | TAK | `src/store/useTowerStore.ts` `persist(` | vault / import regression = ryzyko QA |
| B1.09 | Widoki M1–M12 + Opcje | TAK | `src/views/` (12: Dashboard, Docs, DriverPwa, Finance, Geofence, Invoices, Map, Options, Risks, Schedule, Tasks, Workflows) | |
| B1.10 | Seed JSON (`loads` 62 itd.) | TAK | `src/data/*.json` + `seed.ts` | loads.json = **62**; P9 czasem 72 — flaga A9 |
| B1.11 | `public/logos` (HHL/KSH/SCX) | TAK | `public/logos/` (10 plików) | Visual: logos w `public/logos` |
| B1.12 | Skrypty QA / AIS proxy | TAK | `scripts/ais-proxy.mjs`, `start-ais-proxy.sh`, `punkt9-*.mjs`, shot-*.mjs | AIS bez key → seed |
| B1.13 | Katalog `api/` (osobny backend) | NIE | spot-check: **brak** `/workspace/watch-tower-app/api/` | TV = middleware Vite (`vite.config.ts` `/api/trafikverket`), nie folder `api/` |
| B1.14 | CI GitHub Actions (app) | NIE | **brak** `.github/workflows` w app | tylko leftover w `node_modules/*/`.github |
| B1.15 | Supabase / Next w drzewie app | NIE | **brak** `supabase/` w app | SQL/adapters w `/workspace/watch-tower/` (`0001_core.sql`, `adapter.ts`) — materiał, nie runtime |
| B1.16 | `.env` / `.env.example` w app | NIE | brak plików `.env*` | klucze: **NIE MAM kto** (B6) |

---

## B2 — Design SoT / visual (10)

| ID | Pozycja | Status | Dowód / kto | Uwagi |
|---|---|---|---|---|
| B2.01 | Claude v2.0 HTML SoT (oryginał) | TAK | `/workspace/watch-tower/claude-v2.0/tower-makieta.html` | optyczny SoT + eye gate (MEMORY + Visual) |
| B2.02 | Kopia SoT w app (`design/`) | TAK | `design/claude-v2.0/` (4 pliki, `diff -rq` OK w ETAP 0.5) | zamrożone w baseline |
| B2.03 | `UX_MAP.md` | TAK | `/workspace/watch-tower/UX_MAP.md` | SoT UX (bot UX) |
| B2.04 | `VISUAL_BRIEF.md` | TAK | `/workspace/watch-tower/VISUAL_BRIEF.md` | |
| B2.05 | `VISUAL_ALIGN_CLAUDE.md` | TAK | `/workspace/watch-tower/VISUAL_ALIGN_CLAUDE.md` | Claude 1:1 flip |
| B2.06 | `VISUAL_BRIEF_ELITE.md` + E1–E4 | TAK | `/workspace/watch-tower/VISUAL_BRIEF_ELITE.md` | elite E1–E4 (digest UX) |
| B2.07 | `FINAL_SQUINT` PASS 96/0/6 | TAK | `research-2026/visual-gate-from-zero/FINAL_SQUINT_GATE_RESULT.md` | PASS 96 / FAIL 0 / residual 6 closed |
| B2.08 | Raporty `visual-gate-from-zero` | TAK | `research-2026/visual-gate-from-zero/` | Visual: nie ruszał `src/` |
| B2.09 | Anti-slop → v4 → Claude flip pack | TAK | `research-2026/ANTI_SLOP_*`, `VISUAL_V4_*`, `SOT_FLIP_*` | v3/v4 **odrzucone** jako skóra |
| B2.10 | `claude-sot.css` + public refs HTML | TAK | `claude-sot.css`; `public/claude-ref.html`, `claude-v2-ref.html` | |

---

## B3 — Research / integracje / wiedza (12)

| ID | Pozycja | Status | Dowód / kto | Uwagi |
|---|---|---|---|---|
| B3.01 | Pack `research-2026/` | TAK | `/workspace/watch-tower/research-2026/` | deep-dives; no app code (Research) |
| B3.02 | `START_API_NOTES.md` | TAK | `/workspace/watch-tower/START_API_NOTES.md` | |
| B3.03 | AIS MMSI Wawel / Nova Star §5.2 | TAK | `START_API_NOTES.md` §5.2; `FERRY_AIS.md` | **311852000** / **311000787** |
| B3.04 | Polferries **NO API** | TAK | `FERRY_AIS.md`, `START_API_NOTES`, A2 | seed HTML + HITL |
| B3.05 | Trafikverket notes + seed-if-no-key | TAK | `START_API_NOTES`; `vite.config.ts` middleware | live gdy key — key holder **NIE MAM** |
| B3.06 | MapLibre / OpenFreeMap notes | TAK | `research-2026/`, `docs/README.md` (stale vs Leaflet) | aktywna mapa = Leaflet |
| B3.07 | Permits PL/SE + cover READY | TAK | `PERMITS_PL_SE.md`, `src/data/permits-config.json`, `lib/permits` | |
| B3.08 | BAF / SEFS hybrid | TAK | `BAF_SEFS.md`, `src/data/sefs-tables.json`, `lib/sefs.ts` | |
| B3.09 | `CURSOR_PROMPT` + SQL + adapters | TAK | `/workspace/watch-tower/CURSOR_PROMPT.md` = kopia `docs/handover/CURSOR_PROMPT_ZRODLOWY.md`; `0001_core.sql`, `0002_geofence_engine.sql`, `adapter.ts`, `engine.ts`, `parse.ts` | **nie** runtime makiety |
| B3.10 | `ROZMOWA_CLAUDE.txt` HUMAN #1–3 | TAK | `/workspace/watch-tower/ROZMOWA_CLAUDE.txt` | A6 §1 |
| B3.11 | `AUDIT_CHAT_REQUIREMENTS.md` | TAK | `/workspace/watch-tower/AUDIT_CHAT_REQUIREMENTS.md` | parafraza, nie cytat user |
| B3.12 | `PYTANIA_SCANDINAVIAN_EXPRESS.md` | TAK | `/workspace/watch-tower/PYTANIA_SCANDINAVIAN_EXPRESS.md` | spotkanie SCX |

---

## B4 — QA / ship (10)

| ID | Pozycja | Status | Dowód / kto | Uwagi |
|---|---|---|---|---|
| B4.01 | `qa-start/` oryginał | TAK | `/workspace/watch-tower/qa-start/` (192 pliki, ETAP 0.5) | bot QA `3dac78ee-…` |
| B4.02 | Kopia `docs/qa-start/` | TAK | `/workspace/watch-tower-app/docs/qa-start/` | `diff -rq` OK w 0.5 |
| B4.03 | `FINAL_*` click / ship | TAK | `FINAL_FN2_CLICK*.md`, `FINAL_FN3_CLICK.md`, `FINAL_FN4_CLICK.md`, `FINAL_SHIP.md` | cykle SHIP/NO_SHIP |
| B4.04 | `P9_*` Punkt 9 | TAK | `docs/qa-start/P9_*.md`; `PUNKT9_FULL_QA.md` | import wipe → READY hard-block SHIP |
| B4.05 | `QA_RE_SHIP_FROZEN.md` | TAK | `docs/QA_RE_SHIP_FROZEN.md` | chrome frozen |
| B4.06 | `FUNCTIONAL_REQA_*` | TAK | `FUNCTIONAL_REQA_STATIC.md`, `_FN2.md` | |
| B4.07 | `ACCEPTANCE.md` | TAK | `docs/ACCEPTANCE.md` | |
| B4.08 | Screenshot packs (fn/ship/p9/batch) | TAK | `docs/qa-start/batch-pm|batch-scroll|fix-morning|restore-v2/` + root PNG | |
| B4.09 | Visual TAK/NIE audit (t109) | TAK | `docs/qa-start/batch-pm/VISUAL.md` | era t109 |
| B4.10 | Pełna 6-punktówka QA (proza) | CZĘŚCIOWO | digest A8 z RT samples; **pełna proza = czat QA × Sebastian** | SoT = sibling chat |

---

## B5 — Dokumenty handover / prompty (8)

| ID | Pozycja | Status | Dowód / kto | Uwagi |
|---|---|---|---|---|
| B5.01 | `00_KONTEKST.md` (A1–A9) | TAK | `docs/handover/00_KONTEKST.md` | A backfill 23.09 ~21:25 |
| B5.02 | `00_KONTEKST_A6_PROMPTY.md` | TAK | `docs/handover/00_KONTEKST_A6_PROMPTY.md` | Claude #1–3 + RT §5 + MEMORY §6 |
| B5.03 | `CURSOR_PROMPT_ZRODLOWY.md` | TAK | `docs/handover/CURSOR_PROMPT_ZRODLOWY.md` | **nie** jest t110 |
| B5.04 | `docs/ETAP_0_5_GIT.md` | TAK | `docs/ETAP_0_5_GIT.md` | freeze + lock md5 |
| B5.05 | Docs punkty 1–9 + FIX_* | TAK | `docs/*.md` (root + kopia) | A9 spis |
| B5.06 | Pełny tekst **t110u PROMPT FINALNY** jako plik | NIE | brak w `docs/handover/` | **SoT = transcript t110u** (parent) |
| B5.07 | Pełny dump A6 wszystkich user turns do pos. 0 | NIE | RT paging nie do 0 | parent: dalszy `before=` |
| B5.08 | Pełne 6-punktówki UX/Visual/Research/QA | CZĘŚCIOWO | A8 digest; proza w czatach siblingów | FYI koordynator; SoT = ich czaty |

---

## B6 — Hosting / git / sekrety / ludzie (8)

| ID | Pozycja | Status | Dowód / kto | Uwagi |
|---|---|---|---|---|
| B6.01 | Vercel URL stały | TAK | **https://watch-tower-makieta.vercel.app/** · projekt `watch-tower-makieta` | t95–t96; `docs/qa-start/batch-pm/VISUAL.md` |
| B6.02 | Konto Vercel / kto deployuje | CZĘŚCIOWO | kontekst **`sebastianbozekq-7781s`** (prompt parent / t96 era) | kto ma sesję CLI na stałe: **NIE MAM** poza tym stringiem |
| B6.03 | Cloudflare quick tunnel | CZĘŚCIOWO | `docs/PUBLIC_ACCESS.md` `https://loaded-borders-leads-mba.trycloudflare.com` | ephemeral; wymaga żywego `cloudflared` + preview |
| B6.04 | Netlify Drop | NIE MAM | brak w docs | **nie potwierdzone**; kto wie: Sebastian / parent RT wcześniejsze strony |
| B6.05 | Git remote + `gh` auth | NIE | `git remote` pusty; `gh` not logged in (`ETAP_0_5_GIT.md`) | Sebastian zakłada prywatne repo |
| B6.06 | Tag / commit baseline | TAK | `305da3e` · `baseline-2026-09-23` | working tree: tylko `?? docs/handover/` |
| B6.07 | Preview lokalny `:4177` | TAK | `http://127.0.0.1:4177/` (docs FIX_*) | box; nie jest to komputer użytkownika |
| B6.08 | Holders kluczy AISSTREAM / TRAFIKVERKET / MapTiler / domena | NIE MAM | brak `.env`; README wymienia nazwy env | **kto:** Sebastian / ops — nie udokumentowane |

---

## Podsumowanie statusów (64)

| Status | Liczba | IDs |
|---|---|---|
| TAK | 50 | większość B1–B5 + B6.01/06/07 |
| CZĘŚCIOWO | 5 | B1.06 MapLibre leftover; B4.10 / B5.08 pełne 6-punktówki; B6.02 konto Vercel; B6.03 CF tunnel |
| NIE | 7 | B1.13 api/; B1.14 CI; B1.15 supabase w app; B1.16 .env; B5.06 plik t110; B5.07 dump A6→0; B6.05 remote/gh |
| NIE MAM | 2 | B6.04 Netlify Drop; B6.08 holders kluczy |

Licznik wierszy tabel: B1=16 + B2=10 + B3=12 + B4=10 + B5=8 + B6=8 = **64**.

### Luki do parenta (nie zawężać)

1. Exact wording 64 linii z t110 — **skorygować vs RT** jeśli rekonstrukcja mija się z listą.
2. A6 dump do `before=0`.
3. Pełny t110u na dysku (opcjonalna kopia; SoT = transcript).
4. Netlify + key holders.
5. `gh` remote — tylko Sebastian.

*Etap B started. C/D nie. `src/` nietknięte. Brak commita (parent).*
