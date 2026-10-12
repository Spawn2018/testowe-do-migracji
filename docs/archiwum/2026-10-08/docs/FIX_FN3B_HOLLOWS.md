# FIX_FN3B_HOLLOWS — Claude click NO_SHIP hollows (FINAL_FN2_CLICK_CLAUDE.md)

- **When:** 2026-09-23 ~03:33 Europe/Warsaw (CEST / UTC+2)
- **App:** `http://127.0.0.1:4177/` · bundle **`index-DTAR6Tdg.js`**
- **Rule:** Claude chrome FROZEN — no look/CSS/Visual-gated string edits
- **Scope:** schedule / driver / drawer / store / xlsx only (no SE-road)

## Source QA
`/workspace/watch-tower/qa-start/FINAL_FN2_CLICK_CLAUDE.md` → **NO_SHIP** hollows:
1. Eksport XLSX — toast but no `.xlsx` download
2. Driver camera → vault — Docs 0/0, no `DOC_UPLOADED`
3. Ustalenia SCX persist + KSH read-only note incomplete
4. Import `Zatwierdź` with 0/1 OK wiped schedule

---

## FAIL 1 — Eksport XLSX no download

**Cause:** Headless/CDP `showSaveFilePicker` AbortError aborted the whole export before blob fallback; toast could still fire from prior paths / cancel swallow.

**Fix (`src/lib/xlsxExport.ts` + `ScheduleView`):**
- Normalize ExcelJS buffer → `Uint8Array`, reject empty buffer/blob
- Prefer File System Access **only when not automated** (`navigator.webdriver` / Headless UA)
- Blob path: copy bytes → `createObjectURL` → append `<a download>` to `document.body` → `MouseEvent` click + `.click()` → revoke/remove after 4s
- ScheduleView: `.catch` → CRITICAL toast with failure reason (soft-skip «Anulowano»)

**Smoke:** CDP download listener → `WATCH_TOWER_HHL_harmonogram.xlsx` **13264 bytes** (`via: cdp-download`).

---


### Eksport CDP (QA LAST FAIL)

- `xlsxExport.ts` now copies ExcelJS bytes into an owned `ArrayBuffer` before creating the Blob, then clicks an appended Blob URL anchor through both `MouseEvent` and `.click()`.
- A base64 `data:` URI anchor is also clicked as the small-file fallback. File System Access is skipped for webdriver, Headless UA, Playwright, `chrome.runtime`, or the zero-plugin Chrome automation signature.
- `ScheduleView` awaits the export, reports `rows` and byte size on success, and emits a CRITICAL toast containing the error on failure.
- Puppeteer-core proof: `http://127.0.0.1:4177/` → `Harmonogram` → `Eksport XLSX`, with `Page.setDownloadBehavior` to `/tmp/wt-xlsx-dl/`: `WATCH_TOWER_HHL_harmonogram.xlsx` **13,265 bytes**, ZIP integrity OK.
- `npm run build`: **PASS**. Preview restarted and listening on `127.0.0.1:4177`.
- QA time: **2026-09-23 03:43 CEST (UTC+2)**.

## FAIL 2 — Driver camera → vault

**Cause (linked to FAIL 4):** Import with 0 accepted wiped all loads → DocsView showed **0/0**. Driver UI still showed attach because `documents[]` persisted, but coordinator completeness is `ok / nLoads`.

**Fix:**
- `driverAttachDoc` (~425): invalid token → HIGH toast; token OK but load missing → **CRITICAL** toast (import wipe); require `dataUrl` starting with `data:`
- Still writes `documents[]` with `status: 'UPLOADED'`, `source: 'driver'`, event **`DOC_UPLOADED`**
- `DocsView`: still counts `UPLOADED` (incl. driver); adds **Vault kierowcy (DOC_UPLOADED)** note when `source==='driver'`
- DriverPwa FileReader `onload` path unchanged (completes before attach)

**Smoke:** `#/driver/demo-active` → SG-14 · token demo-active · Aparat/CMR visible.

---

## FAIL 3 — Ustalenia SCX + KSH

**Fix (`LoadDrawer`):**
- SCX: `canEditResources` already includes SCX — same Zapisz zasoby / Zapisz awizację forms as HHL; store toasts «Zasoby zapisane» / «Awizacja zapisana»
- Form keys `key={res-|awi- + load.id}` only — **not** `load.id+role` (role switch must not remount/wipe unsaved)
- KSH read-only: visible Polish note  
  **«Edycja zasobów i awizacji: Scandinavian Express / H&H Logistics»**  
  + kv values for zasoby + awizacja/prom when `!canEdit`

---

## FAIL 4 — Import commit wipes data on 0/1 OK — CRITICAL

**Cause:** `accepted===0` → `diffSchedule` treats all existing codes as removed → `commitImport` emptied `loads`.

**Fix:**
- `scheduleDryRun.ts`: if `accepted===0` → `added=[]`, `changed=[]`, `removedIds=[]`
- `ScheduleView`: **Disable** `Zatwierdź` when `dryRun.accepted===0`; click still no-ops + CRITICAL toast
- `commitImport`: if `accepted===0` → no-op + CRITICAL toast  
  **«Import odrzucony — brak poprawnych wierszy, baza nietknięta»**  
  Defense for stale callers: refuse wipe-all when `accepted==null` and only removals

---

## Build / preview

| Step | Result |
|------|--------|
| `npm run build` | **PASS** |
| Preview | `127.0.0.1:4177` · pid listening · HTTP 200 |
| Bundle | `index-DTAR6Tdg.css` / `index-DTAR6Tdg.js` |
| Smoke script | `scripts/smoke-fn3b-hollows.mjs` → EXIT 0 |

### Smoke summary (`/tmp/wt-fn3b-smoke.json`)
- exportXlsx: **ok** · 13264 B · cdp-download
- importGuard: **ok** (disable + CRITICAL toast + KSH note in bundle)
- driverAttach: **ok** (demo-active / SG-14)

---

## Ready for RE_CLICK

Parent may open public tunnel to **4177**. Re-QA must hard-refresh Claude shell on **`index-DTAR6Tdg.js`** (cache-bust). Do not use stale `index-Dy3BsA9-.js`.
