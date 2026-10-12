# P9 adversarial RE_CLICK — 2026-09-23

## Bundle

- JS src: `/assets/index-D00ZV9dP.js`
  - SHA-256: `6b44af3d316345746c1dd3b56df2947f49c557acdecaf31d2da2d8e56ac07cee`
  - 1,903,533 bytes
- CSS src/hash: `/assets/index-ByS64djj.css`
  - SHA-256: `a6ad47d5d899bc114a622a9f20b4d94151e1e4fdc222e4b20dedad238811633b`
  - 57,682 bytes

## 1. Import merge / no wipe

Fixture: `p9r-merge-plus1-valid.xlsx` (full schedule plus `QA-RECLICK-923`).

- Before: UI `62 / 62`; exported schedule contained 72 data rows.
- Dry run: `+11 / ~62 / -0 / ⚠0` — no deletes.
- After commit: UI `73 / 73`; existing rows such as `SG-01` remained and `QA-RECLICK-923` was present.
- Result: **PASS** — merge preserved existing loads; no replace-all/wipe.

Evidence:
- `p9r-import-before.png`
- `p9r-import-dryrun.png`
- `p9r-import-after.png`

## 2. SG-34 mismatch / READY gate

SG-34 showed the mismatch warning: `Brak zezwolenia. Zestaw ma 21,80 m długości...`; Documents had no permit attached. However, `Ustaw READY` was actionable. Clicking it changed SG-34 from `Planowany` to `Gotowy`.

- Mismatch UI: **PASS**
- READY disabled/blocking: **FAIL**
- Overall SG-34 check: **FAIL**

Evidence:
- `p9r-sg34-mismatch.png`
- `p9r-sg34-ready.png`

## Overall

# **NO_SHIP**

## Hollow/fail list

- **FAIL:** SG-34 permit mismatch does not disable/block `Ustaw READY`; READY was set successfully.
- No other hollow CTA was checked in this retest.
