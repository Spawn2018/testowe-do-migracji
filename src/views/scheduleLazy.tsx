/**
 * wyglad/P7-c — Harmonogram (E38, E30) poza pierwszym wczytaniem (budżet 400 kB gzip, `scripts/bundle-size.mjs`);
 * tabele, teksty i style układu pliku ładują się razem z widokiem. Bez zmiany działania.
 * DP-224 B3: ten sam `import()` co `prefetchMainChunks`.
 */
import { lazy, Suspense } from 'react';
import { lazyRetry } from '../lib/lazyRetry';
import { loadScheduleViewChunk } from '../lib/prefetchMainChunks';

const Schedule = lazy(lazyRetry(loadScheduleViewChunk));

export function ScheduleViewLazy() {
  return <Suspense fallback={null}><Schedule /></Suspense>;
}
