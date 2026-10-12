# PUNKT 5 — Pliki: wgrywanie / podgląd / pobieranie

**When:** 2026-09-23 ~04:03 Europe/Warsaw (UTC+2)  
**App:** `/workspace/watch-tower-app` · Preview `http://127.0.0.1:4177/`  
**Build:** `npm run build` **PASS** · bundle `index-Ci1P56BW.js` / `index-o4uiwX0M.css`  
**Chrome rule:** Claude v2.0 FROZEN — `.iconbtn` / `.btn` / `.btn.ghost` / `.scrim` / `.panel` / `.mrow` only; no new design system. UI **PL only**.

---

## Goal (done)

Everywhere documents appear:
1. **Wgrywanie** — `input[type=file]` → `readFileAsDataUrl` → `uploadDocument(..., { dataUrl, mimeType, bytes })`
2. **Podgląd po kliknięciu** — `.scrim` + `.panel.docpreview`; obraz / PDF (object URL); **Esc** zamyka (capture, przed drawer)
3. **Ikona pobierania** — `.iconbtn` z glifem **↓** przy każdym wierszu; blob download z `dataUrl` (lub stub metadanych PL)

---

## Surfaces covered

| Surface | Upload | Preview (klik ✓ nazwa) | Download ↓ |
|---|---|---|---|
| **LoadDrawer → Dokumenty** | Wgraj / Wgraj dokument (file input) | tak | tak (każdy UPLOADED) |
| **DocsView** (tabela kategorii + **Pliki w vault**) | Wgraj dokument | tak | tak |
| **DocsView** vault kierowcy | — (źródło: Driver PWA) | tak | tak |
| **InvoicesView → Załączniki CMR / POD** | Wgraj załącznik | tak | tak |
| **DriverPwa** vault notes | Aparat / plik (istniejące) | tak | tak |

**CMR list:** drawer + Faktury załączniki + DocsView filtr kategorii CMR (klik wiersza tabeli).

---

## Store / lib

- `Document` już miał `dataUrl` / `mimeType` / `bytes` / `source`
- `uploadDocument(loadId, category, name, opts?)` — zapisuje bajty do vault; toast PL `Dokument wgrany · …`
- `src/lib/docsIo.ts` **new** — odczyt pliku, object URL, pobieranie, stub PL gdy brak bajtów (seed)
- ZIP (`zipDocs.ts`) bez zmian funkcjonalnych

---

## Visual (eye vs Claude v2.0)

| Element | Claude ref | App P5 |
|---|---|---|
| Wiersz pliku | `.mrow` · etykieta · `✓ nazwa` (go: kolor) | to samo + `.iconbtn` ↓ (P5) |
| Przyciski dołu drawer | `.btn.ghost` ZIP · `.btn` Wgraj | bez zmian layoutu |
| Overlay | `.scrim` + panel/drawer chrome | `.scrim` (z-index 50) + `.panel.docpreview` (z 51) · hd: h2 + `.sub` + `.iconbtn` ↓/✕ |
| Ikony | `.iconbtn` 30×30, border `--rule`, radius 2px | te same klasy / tokeny |

Ref light vs app dark = theme; chrome recipes match. App drawer labels categories as enum (`PERMIT_PL`…) — **pre-existing**, not redesigned in P5.

---

## Files touched

| File | Change |
|---|---|
| `src/lib/docsIo.ts` | **new** — IO / preview / download |
| `src/components/ui/DocPreview.tsx` | **new** — scrim + panel, Esc |
| `src/components/ui/DocFileRow.tsx` | **new** — `.mrow` + ✓ nazwa + ↓ |
| `src/store/useTowerStore.ts` | `uploadDocument` + `dataUrl` |
| `src/components/drawer/LoadDrawer.tsx` | file input + rows + preview |
| `src/views/DocsView.tsx` | vault rows + upload + preview |
| `src/views/InvoicesView.tsx` | panel Załączniki CMR/POD |
| `src/views/DriverPwa.tsx` | vault → DocFileRow + preview |
| `src/index.css` | SPA extras `.docpreview` / `.docrow-*` only |
| `scripts/smoke-p5-docs.mjs` / `shot-p5-preview.mjs` | smoke / shots |
| `PUNKT5_FILES.md` | this file |

**Not touched:** P6 Opcje, P7 transports, P8 rate editor, full QA, Claude chrome tokens.

---

## Deliverables

| Item | Path / result |
|---|---|
| Build | **PASS** |
| Preview | `http://127.0.0.1:4177/` |
| Doc | `/workspace/watch-tower-app/PUNKT5_FILES.md` |
| Shot docs | `/tmp/wt-p5-docs.png` — DocsView + vault + ↓ |
| Shot preview | `/tmp/wt-p5-preview.png` — scrim + panel + obraz |
| Extra | `/tmp/wt-p5-drawer-docs.png`, `/tmp/wt-p5-invoices.png`, `/tmp/wt-p5-ref-drawer-docs.png` |

## Verdict

**PASS** — Punkt 5 only; PL UI; upload→vault; preview Esc; download `.iconbtn` ↓; eye-checked vs Claude v2 drawer docs chrome.
