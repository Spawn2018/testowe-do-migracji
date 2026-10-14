/**
 * wyglad/P5 — Dokumenty (E31) poza pierwszym wczytaniem (budżet 400 kB gzip, `scripts/bundle-size.mjs`);
 * teksty P5 (`src/i18n/p5.ts`) ładują się razem z widokiem. Bez zmiany działania.
 */
import { lazy, Suspense } from 'react';
import { lazyRetry } from '../lib/lazyRetry';

/* lazyRetry: po wdrożeniu stary plik widoku znika — jedno odświeżenie zamiast pustego ekranu */
const Docs = lazy(lazyRetry(() => import('./DocsView').then((m) => ({ default: m.DocsView }))));

export function DocsViewLazy() {
  return <Suspense fallback={null}><Docs /></Suspense>;
}
