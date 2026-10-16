/**
 * wyglad/P9-c — Mapa (E29) poza pierwszym wczytaniem (budżet 400 kB gzip, `scripts/bundle-size.mjs`);
 * teksty i liczenie widoku (`src/i18n/p9c.ts`, `src/lib/p9cMap.ts`) ładują się razem z widokiem. Bez zmiany działania.
 */
import { lazy, Suspense } from 'react';
import { lazyRetry } from '../lib/lazyRetry';

/* lazyRetry: po wdrożeniu stary plik widoku znika — jedno odświeżenie zamiast pustego ekranu */
const MapInner = lazy(lazyRetry(() => import('./MapView').then((m) => ({ default: m.MapView }))));

export function MapViewLazy() {
  return <Suspense fallback={null}><MapInner /></Suspense>;
}
