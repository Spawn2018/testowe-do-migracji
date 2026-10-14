/**
 * wyglad/P6 — Ryzyka (E7) poza pierwszym wczytaniem (budżet 400 kB gzip, `scripts/bundle-size.mjs`);
 * teksty P6 (`src/i18n/p6.ts`) ładują się razem z widokiem. Bez zmiany działania.
 */
import { lazy, Suspense } from 'react';
import { lazyRetry } from '../lib/lazyRetry';

/* lazyRetry: po wdrożeniu stary plik widoku znika — jedno odświeżenie zamiast pustego ekranu */
const Risks = lazy(lazyRetry(() => import('./RisksView').then((m) => ({ default: m.RisksView }))));

export function RisksViewLazy() {
  return <Suspense fallback={null}><Risks /></Suspense>;
}
