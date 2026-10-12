# BATCH-SCROLL-SECTIONS — poprawki scroll / sekcje Watch Tower

Data: 2026-09-23 (Europe/Warsaw)

## Root cause (punkt 1 — brak scrolla strony)

Shell Claude (`html/body/#root/.app` = `height:100%`) + `main > * { flex:1; min-height:0 }` **zmuszały** stronę do wysokości viewportu.
Po batchu PM sekcje dostały `.section-card { overflow:hidden; display:flex; flex-direction:column }` oraz `.panel { overflow:hidden }`.
W kolumnie flex dzieci **kurczą się** (`flex-shrink:1`), a `overflow:hidden` **ucina** treść — stąd „spłaszczony” Factoring, ucięte Automatyzacje / Opcje / Dokumenty / Ryzyka i wrażenie, że **strony nie da się przewinąć** (scroll był uwięziony w martwych panelach / zablokowany przez overflow przodków).

**Fix:** `main` zostaje scrollerem (`overflow-y:auto`); `main > *` → `flex:0 0 auto` (strona rośnie z treścią); sekcje/panele → `overflow:visible`, `height:auto`, bez `max-height` na listach treści.

## Checklist 1–9

| # | Punkt | Status | Jak naprawione |
|---|--------|--------|----------------|
| 1 | Desktop: scroll strony góra/dół | DONE | `main` scroll; usunięte blokady `overflow:hidden` / `flex:1;min-height:0` na dzieciach `main`; `.dash`/`.risk-page`/`.options-page`/`.invoices-page` → `height:auto; overflow:visible` |
| 2 | MAPA: resize kolumn + cienkie separatory + Terminowe/Spóźnione | DONE | `MapView`: tabela `.map-loads-table` z uchwytami `.col-resize` (min szer. 0 — tekst może zniknąć), delikatne `border-right:1px solid var(--rule-2)`; filtry **Terminowe** (`!delayed`) / **Spóźnione** (`delayed`) vs okno planowane |
| 3 | FAKTURY: Factoring jako cienki pasek | DONE | Sekcje faktur nie kurczą się w flexu; `overflow:visible` na `.invoices-page > .panel/.section-card` — formularz stawek w pełni widoczny |
| 4 | AUTOMATYZACJE: ucięte ~7/12 | DONE | Brak limitu wysokości / clip na stronie workflow; tło sekcji rośnie, `main` przewija do wszystkich reguł |
| 5 | OPCJE: podgląd automatyzacji 6/11 | DONE | Usunięte `workflows.slice(0, 6)` → `workflows.map(...)`; lista rośnie z treścią |
| 6 | DOKUMENTY: ucięta sekcja | DONE | Ten sam model: sekcja bez `max-height`/`overflow:hidden`; strona scrolluje |
| 7–8 | Tło sekcji rośnie z CONTENT (nie clip) | DONE | Override: `.section-card`, `.section-card-bd`, `.panel` → `overflow:visible`, `height:auto`, `flex:0 0 auto`; usunięte `max-height` z `.settings-list` / `.mlist` / `.tablewrap` (pion) |
| 9 | RYZYKA „Wymaga decyzji”: inner scroll ~5 | DONE | Lista wyjątków bez height-limited inner scroll; wszystkie otwarte wiersze; sekcja + `main` rosną |

## Pliki zmienione

- `src/index.css` — blok `BATCH-SCROLL-SECTIONS` (shell scroll, section growth, map table chrome, wyłączenie limitu list)
- `src/views/MapView.tsx` — tabela z resize + filtry Terminowe/Spóźnione
- `src/views/OptionsView.tsx` — pełna lista automatyzacji (bez `slice(0,6)`)
- `src/views/ScheduleView.tsx` — min. szerokość kolumny przy resize obniżona do `0` (tekst może zniknąć przy zwężaniu)
- `src/components/ui/SectionCard.tsx` — komentarz: tło rośnie z treścią

## Build / artefakt

- `npm run build` — **OK** (`tsc -b && vite build`)
- `dist/vercel.json` — SPA rewrite obecny
- `/workspace/watch-tower-dist.zip` — odświeżony (zawiera `vercel.json`)
- **Bez redeploy Vercel** (parent)

## Uwagi / poza zakresem

- Chrome Claude SoT nie przeprojektowywany poza layout/overflow/filtrami Mapy.
- Mapa/Harmonogram mają `min-height: calc(100vh - 140px)` żeby panel mapy był używalny, ale **nie** blokują scrolla shella dla długich stron.
- Drawer / bell / doc preview / map tiles nadal mają świadomy `overflow:hidden`.
