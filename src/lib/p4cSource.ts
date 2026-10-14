/**
 * wyglad/P4-c — skąd wygląd bierze dane: produkcja — pola od wykonawcy (`load.trackingLink`, `load.readyGaps`,
 * `load.deliveredCheck`; D-20261014-1320-01 K2); demo — przykłady z `p4cDemo.ts`.
 * Warunek `import.meta.env.VITE_AUTH_MODE` wpisany wprost, żeby build produkcyjny wyciął przykłady (strażnik I-0).
 */
import type { DeliveredCheck, Document, Geofence, Load, LoadEvent, ReadyGap, TrackingLinkInfo } from '../types';
import { demoAutoMeta, demoDeliveredCheck, demoTrackingLink } from './p4cDemo';
import { computeReadyGaps } from './readyGaps';
import { dayTime, isoMs } from './statusAxis';

export function trackingLinkOf(load: Load, loads: readonly Load[], nowIso: string): TrackingLinkInfo | null {
  if (load.trackingLink !== undefined) return load.trackingLink;
  return import.meta.env.VITE_AUTH_MODE !== 'supabase' ? demoTrackingLink(load, loads, nowIso) : null;
}

/** null = brak danych (nic nie pokazujemy i nie blokujemy); [] = komplet. */
export function readyGapsOf(load: Load, docs: readonly Document[]): ReadyGap[] | null {
  if (load.readyGaps !== undefined) return load.readyGaps;
  /* jedna definicja E32 pkt 6 — ta sama w demo i w produkcji (K2.2) */
  return computeReadyGaps(load, docs);
}

export function deliveredCheckOf(
  load: Load,
  loads: readonly Load[],
  geofences: readonly Pick<Geofence, 'type' | 'name'>[],
  nowIso: string,
  role: 'HHL' | 'KSH' | 'SCX',
): DeliveredCheck | null {
  if (load.status === 'DELIVERED' || String(load.status) === 'CANCELLED' /* jak TrackingBar: anulowany spoza LoadStatus */) return null;
  if (load.deliveredCheck !== undefined) return load.deliveredCheck;
  return import.meta.env.VITE_AUTH_MODE !== 'supabase' ? demoDeliveredCheck(load, loads, geofences, nowIso, role) : null;
}

function prodAutoMeta(loads: readonly Load[], events: readonly LoadEvent[], nowIso: string): Partial<Record<string, string>> {
  const now = isoMs(nowIso);
  const last = [...events]
    .filter((e) => e.type === 'STATUS_AUTO' || e.type.startsWith('GEOFENCE_') || ['LOADING', 'LOADED', 'PORT_OUT', 'PORT_IN', 'SITE', 'UNLOADED'].includes(e.type))
    .filter((e) => isoMs(e.at) <= now)
    .sort((a, b) => isoMs(b.at) - isoMs(a.at))[0];
  const load = last ? loads.find((l) => l.id === last.loadId) : undefined;
  const out: Partial<Record<string, string>> = {};
  if (last && load) out.zones = `${load.code} · ${dayTime(last.at)}`;
  return out;
}

/** Ostatnie działania automatów na liście „Działa samo” (E35 pkt 1; K2.4). */
export function autoMetaOf(loads: readonly Load[], events: readonly LoadEvent[], nowIso: string): Partial<Record<string, string>> {
  return import.meta.env.VITE_AUTH_MODE !== 'supabase'
    ? demoAutoMeta(loads, events, nowIso)
    : prodAutoMeta(loads, events, nowIso);
}
