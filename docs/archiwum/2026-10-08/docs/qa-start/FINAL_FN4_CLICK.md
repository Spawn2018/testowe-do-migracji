# Functional Re-QA #4 — Click

- **Gate:** PASS — current Incognito Chrome app is **TOWER** (not WATCH TOWER); stage spine includes **Przygotowanie**; page title `TOWER — Stegra Boden`.
- **Script:** `/assets/index-DrIIYTnq.js`
- **Gate proof:** `/workspace/watch-tower/qa-start/fn4-dom-gate.png`

## Primary: Eksport XLSX

- Clicked `Harmonogram` → `Eksport XLSX`.
- **PASS:** native Chrome Downloads save flow completed; real file confirmed:
  - `WATCH_TOWER_KSH_harmonogram.xlsx` — **13,265 bytes**
- Additional same-run export also present: `WATCH_TOWER_HHL_harmonogram.xlsx` — 13,265 bytes.
- **Downloads proof:** `/workspace/watch-tower/qa-start/fn4-xlsx.png`

## Quick spot

1. **READY SG-07 mismatch:** PASS — `Ustaw READY` observed disabled in SG-07 drawer.
2. **ZIP download:** PASS — `WATCH_TOWER_dokumenty_tydzien.zip` — **86,250 bytes**.
3. **Spine Przygotowanie 2nd-click clears:** PASS — second click removed the pressed state/filter.

## Result

**Overall: SHIP**

**Hollow list:** none.
