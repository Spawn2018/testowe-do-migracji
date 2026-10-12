# FUNCTIONAL Click Re-QA #3 (fn3c)

## DOM gate
- **PASS**
- title: `TOWER — Stegra Boden`
- brand: `TOWER`
- stages: `Przygotowanie`, `Załadunek`, `Droga PL`, `Gdańsk`, `Prom`, `Nynäshamn`, `Droga SE`, `Boden`, `Dostarczone`
- counters at gate: `18, 3, 3, 3, 6, 3, 14, 5, 7`
- scriptSrc: `/assets/index-DTAR6Tdg.js`
- proof: `/workspace/watch-tower/qa-start/fn3c-dom-gate.png`

## Priority retest
1. **Eksport XLSX — FAIL**: clicked `Eksport XLSX`; no `.xlsx` appeared in Downloads. Downloads contained no XLSX (only existing `QA-SCHEDULE-742_docs.zip` 374 B plus unrelated files). Toast/UI only; no filename/size to record.
2. **Driver camera→vault — PASS**: `#/driver/demo-sg14`, uploaded `driver-cmr.jpg` as CMR; driver showed `Załączono · CMR · driver-cmr.jpg (12 B)`. Coordinator Documents showed `DOC_UPLOADED` vault note `CMR:driver-cmr.jpg→load-020✓`; SG-14 Docs cell was nonzero (`Z C P M`).
3. **Ustalenia SCX + KSH — PASS**: SCX edited pilot number to `PIL 20 FN3`, saved, closed/reopened, and value persisted. KSH showed read-only note `Edycja zasobów i awizacji: Scandinavian Express / H&H Logistics` with no editable forms.
4. **Import no-wipe — PASS**: KSH counters before/after remained `18,3,3,3,6,3,14,5,7`. Empty valid fixture yielded `0/0 OK`, `+0 / ~0 / −0 / ⚠0`. `Zatwierdź` was present but disabled with message/title `Brak poprawnych wierszy — commit zablokowany (baza nietknięta)`; click was blocked by disabled state and no counters were wiped.

## Spot-checks
5. **READY SG-07 MISMATCH — PASS**: `Ustaw READY` disabled; click attempt exposed `title="MISMATCH document"`.
6. **Plan B mutates — PASS**: clicked first alternative `Przelicz`; control became pressed.
7. **ZIP bytes — PASS**: `QA-SCHEDULE-742_docs.zip` present in Download history, 374 bytes.
8. **Spine 2nd-click clears — PASS**: second click on `Przygotowanie` cleared its pressed state/selection.
9. **Bell mark-all — PASS**: `Oznacz wszystkie` reduced unread notification count from 5 to 0.

## Hollow list
- Eksport XLSX: no real `.xlsx` download.

## Overall
**NO_SHIP**
