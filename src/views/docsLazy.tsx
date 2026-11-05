/**
 * wyglad/P5 — Dokumenty (E31) poza pierwszym wczytaniem (budżet 400 kB gzip, `scripts/bundle-size.mjs`);
 * teksty P5 (`src/i18n/p5.ts`) ładują się razem z widokiem. Bez zmiany działania.
 * DP-224 B3: ten sam `import()` co `prefetchMainChunks`.
 */
import { lazy, Suspense } from 'react';
import { lazyRetry } from '../lib/lazyRetry';
import { loadDocsViewChunk } from '../lib/prefetchMainChunks';

const Docs = lazy(lazyRetry(loadDocsViewChunk));

export function DocsViewLazy() {
  return <Suspense fallback={null}><Docs /></Suspense>;
}
