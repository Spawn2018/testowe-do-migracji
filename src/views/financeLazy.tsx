/**
 * wyglad/P5 — Finanse (E16, E39) poza pierwszym wczytaniem. Pierwsze wczytanie ma budżet 400 kB gzip
 * (`scripts/bundle-size.mjs`); teksty Finansów (`src/i18n/p5.ts`) ładują się razem z widokiem. Bez zmiany działania.
 */
import { lazy, Suspense } from 'react';
import { lazyRetry } from '../lib/lazyRetry';

/* lazyRetry: po wdrożeniu stary plik widoku znika — jedno odświeżenie zamiast pustego ekranu */
const Finance = lazy(lazyRetry(() => import('./FinanceView').then((m) => ({ default: m.FinanceView }))));

export function FinanceViewLazy() {
  return <Suspense fallback={null}><Finance /></Suspense>;
}
