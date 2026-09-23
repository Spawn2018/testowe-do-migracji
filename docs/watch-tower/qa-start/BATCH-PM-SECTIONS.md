# BATCH-PM-SECTIONS — poprawki UI Watch Tower (PL)

Data: 2026-09-23 (Europe/Warsaw)

## Checklist 1–8

### 1) Naprawy layoutu ze screenshotów — **DONE**
| Obszar | Status | Uwagi |
|--------|--------|-------|
| Kokpit mapa ucięta | DONE | `.grid2-map-body` 230px + Leaflet absolute fill + ResizeObserver/`invalidateSize` |
| Mapa strzałki promów | DONE | DivIcon ze strzałką w kropce; heading z COG AIS lub kierunku rejsu |
| Harmonogram telefon | DONE | Kolumna `phone` (`resources.driverPhone`) |
| Harmonogram resize / dblclick | DONE | uchwyt `.col-resize` + auto-fit po dwukliku nagłówka |
| Harmonogram widoczność / DnD kolumn | DONE | picker „Kolumny” + drag nagłówków |
| Harmonogram Zapisz widok | DONE | przycisk **na lewo** od Eksport XLSX → `watch-tower-schedule-cols-v1` |
| Harmonogram filtry etapów | DONE | Załadunek, Droga PL, Gdańsk, Prom, Nynäshamn, Droga SE, Boden (+ istniejące) |
| Ryzyka alternatywy SE | DONE | blok pod sytuacjami korytarza + ROAD_SE / siła wyższa |
| Faktury overlap | DONE | `.invoices-page` stack + `overflow:hidden` na panelach |

### 2) Sekcje jak Opcje → Strefy geograficzne — **DONE**
- `SectionCard` (szary `panel-hd` + body + clip)
- Widoki menu oznaczone `section-card` / `page-sections` / `data-page`

### 3) Fitted background — **DONE**
- Panele / section-card / tablewrap: content nie wylewa się poza tło karty

### 4) Strzałki na markerach ciężarówek — **DONE**
- UP = w stronę Boden (faza dostawy), DOWN = w stronę KSH Śrem (załadunek / prep)

### 5) Widget promu LIVE — **DONE**
- `nextLiveSailing` + generowany rozkład Polferries GDN↔NYN; Topbar odlicza do następnego wyjścia (nie stuck na przeszłym Wawel 22.09)

### 6) DnD sekcji (Android home) — **DONE**
- `usePageSectionDnD` na szarym `panel-hd`; kolejność w localStorage per strona+org

### 7) Faktury SCX — **DONE**
- Stack sekcji; factoring nie nachodzi na tabelę

### 8) Nic poza tym / build — **DONE**
- `npm run build` OK
- `dist/vercel.json` rewrite SPA
- `/workspace/watch-tower-dist.zip` odświeżony (~2.1 MB)
- **Bez redeploy Vercel** (parent)

## Kluczowe pliki
- `src/lib/ferry.ts`, `src/lib/mapMarkers.ts`, `src/lib/scheduleColumns.ts`
- `src/components/shell/Topbar.tsx`, `src/components/map/CorridorMap.tsx`
- `src/components/ui/SectionCard.tsx`, `src/components/ui/PageSections.tsx`
- `src/hooks/useSectionOrder.ts`, `src/hooks/usePageSectionDnD.ts`
- `src/views/ScheduleView.tsx`, `RisksView.tsx`, `InvoicesView.tsx`, `DashboardView.tsx`, + pozostałe menu views
- `src/App.tsx`, `src/index.css`

## Blockers
- Brak blockerów builda. Odliczanie promu z seed+generated timetable (bez API rezerwacji). AIS nadal seed/proxy.
- Chrome Claude SoT **nie** przeprojektowywany poza zamówionymi punktami.
