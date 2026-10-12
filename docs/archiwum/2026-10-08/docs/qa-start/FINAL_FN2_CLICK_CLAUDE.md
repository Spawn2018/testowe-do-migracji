# Adversarial functional click Re-QA — Claude shell only

## DOM gate
**PASS before probes.** Fresh incognito window with cache-bust URL and hard refresh was used.

Evaluate/snapshot gate dump before probes:
```json
{
  "title": "TOWER — Stegra Boden",
  "brand": "TOWER",
  "stages": ["18 Przygotowanie", "3 Załadunek", "3 Droga PL", "3 Gdańsk", "6 Prom", "3 Nynäshamn", "14 Droga SE", "5 Boden", "7 Dostarczone"],
  "scriptSrc": ["http://127.0.0.1:4177/assets/index-Dy3BsA9-.js"]
}
```
Post-probe page-context dump is also saved at `/workspace/watch-tower/qa-start/fn3b-evaluate-dump.json` (title/brand/script still correct; stage counts became 0 after the tested import commit).

Gate proof: `/workspace/watch-tower/qa-start/fn3b-dom-gate.png`
Bundle: `index-Dy3BsA9-.js`

## 14-probe scorecard
1. **FAIL / partial — Ustalenia.** HHL resource edit and `Zapisz zasoby` persisted (`Driver 10 QA`), but SCX form persistence and KSH read-only note were not demonstrated. `/workspace/watch-tower/qa-start/fn3b-ustalenia.png`
2. **PASS — READY cover gate.** SG-07 mismatch left `Ustaw READY` disabled; it did not become READY. `/workspace/watch-tower/qa-start/fn3b-ready-cover.png`
3. **PASS — Plan B.** Selecting Gdynia–Karlskrona produced Plan B toast, selected ferry alternative, and notification increment. `/workspace/watch-tower/qa-start/fn3b-plan-b.png`
4. **PASS — ZIP.** Real download `QA-SCHEDULE-742_docs.zip` (374 bytes) verified in Download history and Downloads. `/workspace/watch-tower/qa-start/fn3b-zip.png`
5. **FAIL — Eksport XLSX.** Visible for HHL/KSH/SCX, but no `.xlsx` download was produced; Downloads remained ZIP-only. `/workspace/watch-tower/qa-start/fn3b-xlsx.png`
6. **PASS with data-integrity warning — Wgraj aktualizację.** KSH upload reached preview (`Podgląd zmian`) then `Zatwierdź` and showed `Import zatwierdzony`; invalid fixture resulted in 0/1 OK and cleared stage/schedule data. `/workspace/watch-tower/qa-start/fn3b-upload.png`
7. **PASS — Factoring.** HHL configured 2.7%/48 hours; SCX could toggle standard/factoring and saw the configured offer. `/workspace/watch-tower/qa-start/fn3b-factoring.png`
8. **PASS — WF run.** Clicking factoring workflow produced `Uruchomiono: Akceptacja factoringu` and notification increment. `/workspace/watch-tower/qa-start/fn3b-wf.png`
9. **PASS — Map sources.** Map footer explicitly showed `Trafikverket E4: seed · AIS: seed`; GPS fleet tick also present. `/workspace/watch-tower/qa-start/fn3b-map.png`
10. **FAIL — Driver camera/vault.** Driver UI showed attachment `CMR:driver-cmr.jpg`, but coordinator Documents stayed 0/0 and no `DOC_UPLOADED` vault state was observed. `/workspace/watch-tower/qa-start/fn3b-driver-camera.png`
11. **PASS — Bell mark read.** `Oznacz wszystkie` reduced unread count 16 → 0. `/workspace/watch-tower/qa-start/fn3b-bell.png`
12. **PASS — Spine second click.** First Przygotowanie click set active filter; second cleared pressed state/filter while remaining on Map. `/workspace/watch-tower/qa-start/fn3b-spine.png`
13. **PASS — KPI deep-link.** `Transporty w drodze` KPI deep-linked to Map. `/workspace/watch-tower/qa-start/fn3b-kpi.png`
14. **FAIL — CTA spot-check.** `Eksport XLSX` is a visible no-op across roles; this is independently a functional failure. `/workspace/watch-tower/qa-start/fn3b-xlsx.png`

## Hollow list
- XLSX export produces no real `.xlsx`: `/workspace/watch-tower/qa-start/fn3b-xlsx.png`
- Driver upload does not surface as vault `DOC_UPLOADED`: `/workspace/watch-tower/qa-start/fn3b-driver-camera.png`
- Ustalenia role coverage incomplete (SCX persistence/KSH read-only not proven): `/workspace/watch-tower/qa-start/fn3b-ustalenia.png`
- Import commit accepted 0/1 valid rows and cleared operational counters: `/workspace/watch-tower/qa-start/fn3b-upload.png`

## Overall
**NO_SHIP**
