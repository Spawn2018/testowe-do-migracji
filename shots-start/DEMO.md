# START sprint demo

## Build
`npm run build` → PASS (2026-09-23)

## Services
- Preview: `npm run preview` (e.g. :4177)
- AIS proxy: `npm run ais-proxy` → `ws://localhost:4175/ais` (key from box-secrets, never in browser)

## Click path
1. Topbar roles **HHL | KSH | SCX** with logos — no Stegra role
2. Bell → unread list → **Przeczytane** → vanishes; badge drops
3. ☰ collapse nav → 56px icon rail
4. Kokpit KPI tiles → deep-link map/risk/docs/fin/tasks/inv
5. Spine stage → map + filter
6. Mapa: OpenFreeMap tiles, corridor_ref, trucks animating, ferry AIS markers, E4 chips; badges Situation/AIS
7. Harmonogram: DnD zone XLSX → dry-run → commit
8. `#/driver/demo-sg14` → SG-14 (load-020)

## Key files
- `src/components/map/CorridorMap.tsx` — MapLibre + fleet + AIS + TV
- `src/data/corridor_ref.json` — permit/reference polyline
- `src/data/ferry-sailings.json` + `src/lib/ferry.ts` + `src/lib/ais.ts`
- `scripts/ais-proxy.mjs` + `scripts/start-ais-proxy.sh`
- `src/lib/trafikverket.ts` + Vite `/api/trafikverket` middleware
- `src/lib/permits.ts` — `cover()` PERIOD/TRIP/REGULATION
- Shell: Topbar logos+bell, Nav collapse, glass chrome

## Glass dense (P0) + QA P1 (2026-09-23)
- Glass: chrome 94% / panel 96% / btn glass 95% — see GLASS_DENSE.md
- Spine 2nd click clears stage filter via navigateTo(null)
- Schedule: ExcelJS real parse + parseSchedule/diffSchedule dry-run (no SG-99 hardcode)
- Hollow CTAs: Plan B → real notification; Driver file capture → DOC_UPLOADED; Docs ZIP = real store-ZIP
