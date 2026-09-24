# D1 — inwentarz klas Tailwind (przed usunięciem)

| Pole | Wartość |
|---|---|
| When | **2026-09-24** Europe/Warsaw |
| Scope | Fala-1-**D1 inventory** (D1a) — **bez** usuwania Tailwind / bez przepisywania JSX |
| App | `/workspace/watch-tower-app` |
| SoT chrome | Claude v2.0 (`.topbar`, `.panel`, `.btn`, … w `src/index.css`) |
| Numeracja | **Fala-1-D1** ≠ stary NAPRAWY D1 (alternatywy trasy) — patrz NAPRAWY |

## Werdykt skanu

| Metryka | Liczba |
|---|---:|
| Unikalne utility Tailwind w `className` | **26** |
| Wystąpienia (utility × file:line) | **42** |
| Pliki z utility w JSX | **2** |
| `@apply` w CSS | **0** |
| `dark:` / responsive variants w className | **0** |

**Pliki z utility:** `src/components/shell/NotificationBell.tsx`, `src/views/DriverPwa.tsx`

Reszta SPA jest już na klasach roli Claude (`.panel`, `.filters`, `.drawer`, …) albo na **inline `style`** (nie jest to utility class — poza zakresem stripu className; można sprzątać osobno).

## Tailwind w bundlu CSS (nie className)

| Element | Lokalizacja | Uwaga na removal |
|---|---|---|
| `@import "tailwindcss"` | `src/index.css:1` | Usunąć w commicie removal |
| `@theme` font tokens | `src/index.css:3-7` | Przenieść `--font-sans/mono/cond` do `:root` / Claude sheet |
| `.panel.p-0/.p-2/.p-3/.p-4` padding unset | `src/index.css` (~L478) | **Delete-only** po usunięciu TW — obrona przed utility `p-*` na `.panel` |
| deps `tailwindcss`, `@tailwindcss/vite` | `package.json` | Usunąć w removal + plugin Vite |

## Już pokryte Claude / delete-only

| Co | Status |
|---|---|
| Główny chrome (topbar, nav, panel, drawer, btn, chipbtn, filters, map, toast, …) | **Brak TW utilities** w className — removal = no-op na tych plikach |
| `.panel.p-*` padding unset | Usunąć razem z TW (nie potrzebne bez utilities) |
| Product classes mylone ze skanem (`p-red`, `p-go`, `grid2`, `col-resize`, `inline-input`, `font-cond`, `cond`, `tabular`) | **Nie Tailwind** — zostają |

**Wniosek:** faktyczna praca removal to głównie **Driver PWA** + **pozycjonowanie badge w NotificationBell** + wycięcie importu/deps/`@theme`.

## Mapa utility → klasa roli (propozycja)

| utility | file:line | proposed role class | notes |
|---|---|---|---|
| `p-3` | `src/views/DriverPwa.tsx:32` | `.driver-pwa-hd / .driver-pwa-main / .driver-alert / .driver-attach-note / .driver-pwa-ft` | 12px padding rhythm |
| `p-3` | `src/views/DriverPwa.tsx:47` | `.driver-pwa-hd / .driver-pwa-main / .driver-alert / .driver-attach-note / .driver-pwa-ft` | 12px padding rhythm |
| `p-3` | `src/views/DriverPwa.tsx:49` | `.driver-pwa-hd / .driver-pwa-main / .driver-alert / .driver-attach-note / .driver-pwa-ft` | 12px padding rhythm |
| `p-3` | `src/views/DriverPwa.tsx:145` | `.driver-pwa-hd / .driver-pwa-main / .driver-alert / .driver-attach-note / .driver-pwa-ft` | 12px padding rhythm |
| `p-3` | `src/views/DriverPwa.tsx:164` | `.driver-pwa-hd / .driver-pwa-main / .driver-alert / .driver-attach-note / .driver-pwa-ft` | 12px padding rhythm |
| `flex` | `src/views/DriverPwa.tsx:31` | `.driver-pwa / .driver-pwa-tabs / .driver-pwa-main / .driver-btn-row` | context-specific flex containers |
| `flex` | `src/views/DriverPwa.tsx:39` | `.driver-pwa / .driver-pwa-tabs / .driver-pwa-main / .driver-btn-row` | context-specific flex containers |
| `flex` | `src/views/DriverPwa.tsx:47` | `.driver-pwa / .driver-pwa-tabs / .driver-pwa-main / .driver-btn-row` | context-specific flex containers |
| `flex` | `src/views/DriverPwa.tsx:86` | `.driver-pwa / .driver-pwa-tabs / .driver-pwa-main / .driver-btn-row` | context-specific flex containers |
| `w-full` | `src/views/DriverPwa.tsx:55` | `.driver-btn-block` | full-width CTA; keep .btn |
| `w-full` | `src/views/DriverPwa.tsx:72` | `.driver-btn-block` | full-width CTA; keep .btn |
| `w-full` | `src/views/DriverPwa.tsx:101` | `.driver-btn-block` | full-width CTA; keep .btn |
| `flex-1` | `src/views/DriverPwa.tsx:47` | `.driver-pwa-main / .driver-btn-grow` | grow main or button |
| `flex-1` | `src/views/DriverPwa.tsx:91` | `.driver-pwa-main / .driver-btn-grow` | grow main or button |
| `flex-col` | `src/views/DriverPwa.tsx:31` | `.driver-pwa / .driver-pwa-main` | column stack |
| `flex-col` | `src/views/DriverPwa.tsx:47` | `.driver-pwa / .driver-pwa-main` | column stack |
| `gap-1` | `src/views/DriverPwa.tsx:39` | `.driver-pwa-tabs / .driver-btn-row` | 4px gap |
| `gap-1` | `src/views/DriverPwa.tsx:86` | `.driver-pwa-tabs / .driver-btn-row` | 4px gap |
| `relative` | `src/components/shell/NotificationBell.tsx:46` | `.bell-wrap / .bell-trigger` | badge positioning context |
| `relative` | `src/components/shell/NotificationBell.tsx:49` | `.bell-wrap / .bell-trigger` | badge positioning context |
| `text-[12px]` | `src/views/DriverPwa.tsx:36` | `.driver-meta / .driver-pwa-ft` | 12px meta copy |
| `text-[12px]` | `src/views/DriverPwa.tsx:164` | `.driver-meta / .driver-pwa-ft` | 12px meta copy |
| `text-[13px]` | `src/views/DriverPwa.tsx:49` | `.driver-alert / .driver-attach-note` | 13px body |
| `text-[13px]` | `src/views/DriverPwa.tsx:145` | `.driver-alert / .driver-attach-note` | 13px body |
| `text-[var(--wt-ink-faint)]` | `src/views/DriverPwa.tsx:36` | `.driver-meta / .driver-pwa-ft` | faint ink token |
| `text-[var(--wt-ink-faint)]` | `src/views/DriverPwa.tsx:164` | `.driver-meta / .driver-pwa-ft` | faint ink token |
| `absolute` | `src/components/shell/NotificationBell.tsx:61` | `.bell-badge` | unread count badge; keep .cond.tabular |
| `bg-[var(--wt-bg)]` | `src/views/DriverPwa.tsx:31` | `.driver-pwa` | merge into .driver-pwa token bg |
| `bg-[var(--wt-crit-bg)]` | `src/views/DriverPwa.tsx:49` | `.driver-alert` | critical banner |
| `bg-[var(--wt-surface)]` | `src/views/DriverPwa.tsx:32` | `.driver-pwa-hd` | token surface |
| `bg-[var(--wt-surface-2)]` | `src/views/DriverPwa.tsx:145` | `.driver-attach-note` | surface-2 chip |
| `border-[var(--wt-border)]` | `src/views/DriverPwa.tsx:32` | `.driver-pwa-hd` | token border |
| `border-b` | `src/views/DriverPwa.tsx:32` | `.driver-pwa-hd` | header rule |
| `gap-3` | `src/views/DriverPwa.tsx:47` | `.driver-pwa-main` | 12px stack gap |
| `hidden` | `src/views/DriverPwa.tsx:113` | `.driver-file-input` | visually hide file input; keep accessible |
| `max-w-md` | `src/views/DriverPwa.tsx:31` | `.driver-pwa` | phone column ~28rem |
| `min-h-full` | `src/views/DriverPwa.tsx:31` | `.driver-pwa` | shell column fills viewport |
| `mt-2` | `src/views/DriverPwa.tsx:39` | `.driver-pwa-tabs` | 8px top margin under meta |
| `mx-auto` | `src/views/DriverPwa.tsx:31` | `.driver-pwa` | center column |
| `text-[var(--wt-crit)]` | `src/views/DriverPwa.tsx:49` | `.driver-alert` | critical ink |
| `text-[var(--wt-ink)]` | `src/views/DriverPwa.tsx:31` | `.driver-pwa` | merge into .driver-pwa token ink |
| `underline` | `src/views/DriverPwa.tsx:165` | `.driver-back-link` | text link underline |

### Grupy (merge w removal)

1. **`.driver-pwa`** — `min-h-full flex flex-col max-w-md mx-auto` + tokeny `--wt-*` (albo Claude `--page/--ink`).
2. **`.driver-pwa-hd`** — `p-3 border-b` + border/surface tokens.
3. **`.driver-meta`** — `text-[12px]` + faint ink.
4. **`.driver-pwa-tabs`** — `flex gap-1 mt-2`.
5. **`.driver-pwa-main`** — `p-3 flex flex-col gap-3 flex-1`.
6. **`.driver-alert`** — critical banner (`p-3` + crit tokens + `text-[13px]`).
7. **`.driver-btn-block`** — modifier na `.btn` = `width:100%` (zamiast `w-full`).
8. **`.driver-btn-grow`** — modifier na `.btn` = `flex:1` (zamiast `flex-1`).
9. **`.driver-btn-row`** — `flex gap-1`.
10. **`.driver-file-input`** — ukryty input pliku (zamiast `hidden`).
11. **`.driver-attach-note`** — `p-3` + surface-2 + `text-[13px]`.
12. **`.driver-pwa-ft`** — footer meta.
13. **`.driver-back-link`** — `text-decoration:underline`.
14. **`.bell-wrap`** — `position:relative`.
15. **`.bell-trigger`** — `position:relative` na `.iconbtn`.
16. **`.bell-badge`** — `position:absolute` (+ `.cond.tabular` / inline top-right).

## Poza zakresem className (notatka)

Inline `style` z `display:flex` / `gap` występuje m.in. w `ScheduleView`, `MapView`, `LoadDrawer`, `GeofenceView`, `Topbar`, `NotificationBell` (treść listy). To **nie** są utility classes — inventory ich nie liczy. Opcjonalny follow-up po D1 removal.

## Następny krok (NIE w tym commicie)

Commit removal (osobny task): dodać klasy roli do `src/index.css` → podmienić className w 2 plikach → usunąć `@import "tailwindcss"` / `@theme` (po migracji fontów) → usunąć deps + Vite plugin → `test:unit` + `playwright` bez regeneracji snapshotów.

## Metoda skanu

Heurystyka: tokeny w `className` wyglądające na utility Tailwind (`flex`, `p-3`, `bg-[…]`, …), z wykluczeniem znanych klas Claude/product (`pill`, `p-red`, `grid2`, …). CSS: `@import "tailwindcss"`, `@theme`, `@apply`.
