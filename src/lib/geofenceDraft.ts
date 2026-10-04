import { SITES } from './status';
import type { Geofence, GeofenceCountry } from '../types';

/** Środek Bałtyku — stary domyślny punkt nowej strefy. L-12 go nie używa. */
export const BALTIC_CENTER = { lat: 60, lng: 18 } as const;

/** Nowa strefa startuje na załadunku w Śremie, w Polsce. */
export const NEW_ZONE_PL = {
  lat: SITES.loading.lat,
  lng: SITES.loading.lng,
  country: 'PL' as const,
};

/** Gdy kraj zmienia się na Szwecję, zanim ktoś ruszy środek, punkt idzie na plac w Boden. */
export const NEW_ZONE_SE = {
  lat: SITES.site.lat,
  lng: SITES.site.lng,
  country: 'SE' as const,
};

export function isBalticCenter(lat: number, lng: number): boolean {
  return Math.abs(lat - BALTIC_CENTER.lat) < 1e-6 && Math.abs(lng - BALTIC_CENTER.lng) < 1e-6;
}

export function placeForCountry(country: GeofenceCountry): { lat: number; lng: number } {
  if (country === 'SE') return { lat: NEW_ZONE_SE.lat, lng: NEW_ZONE_SE.lng };
  return { lat: NEW_ZONE_PL.lat, lng: NEW_ZONE_PL.lng };
}

export function newGeofenceDraft(name: string): Geofence {
  return {
    id: `gf-new-${Date.now()}`,
    name,
    type: 'CHECKPOINT',
    shape: 'circle',
    lat: NEW_ZONE_PL.lat,
    lng: NEW_ZONE_PL.lng,
    country: 'PL',
    radiusM: 1000,
    hysteresisM: 200,
    samplesRequired: 1,
    dwellMin: 5,
    notifyHhl: true,
    notifyKsh: false,
    notifyScx: true,
    active: true,
    trigger: 'ENTER',
  };
}

/** Kolumna „kogo powiadomić” czyta ptaszki strefy, nie rodzaj. */
export function notifyWho(g: Pick<Geofence, 'notifyHhl' | 'notifyKsh' | 'notifyScx'>): string {
  const parts: string[] = [];
  if (g.notifyKsh) parts.push('KSH');
  if (g.notifyScx) parts.push('SCX');
  if (g.notifyHhl) parts.push('HHL');
  return parts.length ? parts.join(', ') : '—';
}
