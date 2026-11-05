/**
 * wyglad/P9-c — Mapa (E29) poza pierwszym wczytaniem (budżet 400 kB gzip, `scripts/bundle-size.mjs`);
 * teksty i liczenie widoku (`src/i18n/p9c.ts`, `src/lib/p9cMap.ts`) ładują się razem z widokiem. Bez zmiany działania.
 * DP-224 B3: ten sam `import()` co `prefetchMainChunks` (podgrzanie w tle).
 */
import { lazy, Suspense } from 'react';
import { lazyRetry } from '../lib/lazyRetry';
import { loadMapViewChunk } from '../lib/prefetchMainChunks';

/* lazyRetry: po wdrożeniu stary plik widoku znika — pasek NewVersionBar zamiast cichego reload */
const MapInner = lazy(lazyRetry(loadMapViewChunk));

export function MapViewLazy() {
  return <Suspense fallback={null}><MapInner /></Suspense>;
}
