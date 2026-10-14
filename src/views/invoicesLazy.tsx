/**
 * wyglad/P5 — Faktury (E4, E4b) poza pierwszym wczytaniem. Pierwsze wczytanie ma budżet 400 kB gzip
 * (`scripts/bundle-size.mjs`). Bez zmiany działania: rejestracja, weryfikacja i opłacenie jak w module faktur.
 */
import { lazy, Suspense } from 'react';
import { lazyRetry } from '../lib/lazyRetry';

/* lazyRetry: po wdrożeniu stary plik widoku znika — jedno odświeżenie zamiast pustego ekranu */
const Invoices = lazy(lazyRetry(() => import('./InvoicesView').then((m) => ({ default: m.InvoicesView }))));

export function InvoicesViewLazy() {
  return <Suspense fallback={null}><Invoices /></Suspense>;
}
