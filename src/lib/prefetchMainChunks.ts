/**
 * DP-224 B3 (#817): po starcie powłoki w tle wczytaj leniwe kawałki tras głównych
 * (Mapa, Harmonogram, Ryzyka, Dokumenty, mapa korytarza na Kokpicie, karta transportu).
 * Otwarta karta po wdrożeniu nie musi wtedy dociągać nowego hasha przy pierwszej nawigacji.
 */
export const loadMapViewChunk = () => import('../views/MapView').then((m) => ({ default: m.MapView }))
export const loadScheduleViewChunk = () => import('../views/ScheduleView').then((m) => ({ default: m.ScheduleView }))
export const loadRisksViewChunk = () => import('../views/RisksView').then((m) => ({ default: m.RisksView }))
export const loadDocsViewChunk = () => import('../views/DocsView').then((m) => ({ default: m.DocsView }))
export const loadCorridorMapChunk = () => import('../components/map/CorridorMap').then((m) => ({ default: m.CorridorMap }))
export const loadLoadDrawerChunk = () => import('../components/drawer/LoadDrawer').then((m) => ({ default: m.LoadDrawer }))

const MAIN_CHUNKS = [
  loadMapViewChunk,
  loadScheduleViewChunk,
  loadRisksViewChunk,
  loadDocsViewChunk,
  loadCorridorMapChunk,
  loadLoadDrawerChunk,
] as const

/** Jednorazowe podgrzanie — błędy sieci/hasha nie przerywają startu (lazyRetry + NewVersionBar). */
export function prefetchMainChunks(): void {
  if (typeof window === 'undefined') return
  const warm = () => {
    for (const load of MAIN_CHUNKS) void load().catch(() => undefined)
  }
  /* F7 #826: bez timeout na zajętej mapie idle może nie odpalić długo — max 5 s */
  const idle = (window as Window & { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => void }).requestIdleCallback
  if (idle) idle(warm, { timeout: 5000 })
  else window.setTimeout(warm, 1500)
}
