/**
 * wyglad/P6 — Ryzyka (E7) poza pierwszym wczytaniem (budżet 400 kB gzip, `scripts/bundle-size.mjs`);
 * teksty P6 (`src/i18n/p6.ts`) ładują się razem z widokiem. Bez zmiany działania.
 * DP-224 B3: ten sam `import()` co `prefetchMainChunks`.
 */
import { lazy, Suspense } from 'react';
import { lazyRetry } from '../lib/lazyRetry';
import { loadRisksViewChunk } from '../lib/prefetchMainChunks';

const Risks = lazy(lazyRetry(loadRisksViewChunk));

export function RisksViewLazy() {
  return <Suspense fallback={null}><Risks /></Suspense>;
}
