/**
 * D15 — mapa ładowana leniwie: Leaflet + warstwy korytarza w osobnym kawałku paczki.
 * Zastępnik zajmuje dokładnie to samo miejsce (absolutnie w kontenerze), więc układ się nie przesuwa.
 */
import { lazy, Suspense } from 'react';
import type { Load } from '../../types';

const CorridorMapImpl = lazy(() => import('./CorridorMap').then((m) => ({ default: m.CorridorMap })));

export function CorridorMap(props: { loads: Load[]; embedded?: boolean }) {
  return (
    <Suspense fallback={<div className="corridor-map-root" data-map-loading style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', minHeight: 0 }} />}>
      <CorridorMapImpl {...props} />
    </Suspense>
  );
}
