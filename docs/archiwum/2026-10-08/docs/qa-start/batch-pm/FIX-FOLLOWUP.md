# Watch Tower fix follow-up

Date: 2026-09-23 14:09 UTC+2

- Kokpit mini-map CSS now has one definitive `.grid2-map-body` sizing rule at 280px with a 280px minimum, hidden embedded controls, and absolute fill for map children; `.dash` remains the scroll root.
- Dashboard inline mini-map height is aligned to 280px.
- Production bundle rebuilt; `nextLiveSailing` is present in `dist/assets/index-BnZ6tEHd.js`.
- JS SHA-256: `f22fa53814b5fc70e1d46140f5f3360250756ed9046d246dfe9a859eb4d26b91`
- `npm run build`: PASS.
- `/workspace/watch-tower-dist.zip` refreshed from `dist/` and includes `vercel.json`.
