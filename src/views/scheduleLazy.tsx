/**
 * wyglad/P7-c — Harmonogram (E38, E30) poza pierwszym wczytaniem (budżet 400 kB gzip, `scripts/bundle-size.mjs`);
 * tabele, teksty i style układu pliku ładują się razem z widokiem. Bez zmiany działania.
 */
import { lazy, Suspense } from 'react';
import { lazyRetry } from '../lib/lazyRetry';

/* lazyRetry: po wdrożeniu stary plik widoku znika — jedno odświeżenie zamiast pustego ekranu */
const Schedule = lazy(lazyRetry(() => import('./ScheduleView').then((m) => ({ default: m.ScheduleView }))));

export function ScheduleViewLazy() {
  return <Suspense fallback={null}><Schedule /></Suspense>;
}
