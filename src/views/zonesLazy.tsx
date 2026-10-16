/**
 * wyglad/P8-c — Strefy (E34) poza pierwszym wczytaniem (budżet 400 kB gzip, `scripts/bundle-size.mjs`); widok otwiera
 * tylko HHL. Bez zmiany działania.
 */
import { lazy, Suspense } from 'react';
import { lazyRetry } from '../lib/lazyRetry';

const Zones = lazy(lazyRetry(() => import('./ZonesView').then((m) => ({ default: m.ZonesView }))));

export function ZonesViewLazy() {
  return <Suspense fallback={null}><Zones /></Suspense>;
}
