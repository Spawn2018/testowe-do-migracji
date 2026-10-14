/**
 * wyglad/P4-c — skąd wygląd bierze dane: produkcja — pola od wykonawcy (`load.trackingLink`, `load.readyGaps`,
 * `load.deliveredCheck`; dopisek do PR wyglad/P4-c); demo — przykłady z `p4cDemo.ts`.
 * Warunek `import.meta.env.VITE_AUTH_MODE` wpisany wprost, żeby build produkcyjny wyciął przykłady (strażnik I-0).
 * Bez zapytań i zapisów.
 */
import type { DeliveredCheck, Document, Geofence, Load, LoadEvent, ReadyGap, TrackingLinkInfo } from '../types';
import { demoAutoMeta, demoDeliveredCheck, demoReadyGaps, demoTrackingLink } from './p4cDemo';

export function trackingLinkOf(load: Load, loads: readonly Load[], nowIso: string): TrackingLinkInfo | null {
  if (load.trackingLink !== undefined) return load.trackingLink;
  return import.meta.env.VITE_AUTH_MODE !== 'supabase' ? demoTrackingLink(load, loads, nowIso) : null;
}

/** null = brak danych (nic nie pokazujemy i nie blokujemy); [] = komplet. */
export function readyGapsOf(load: Load, docs: readonly Document[]): ReadyGap[] | null {
  if (load.readyGaps !== undefined) return load.readyGaps;
  return import.meta.env.VITE_AUTH_MODE !== 'supabase' ? demoReadyGaps(load, docs) : null;
}

export function deliveredCheckOf(
  load: Load,
  loads: readonly Load[],
  geofences: readonly Pick<Geofence, 'type' | 'name'>[],
  nowIso: string,
  role: 'HHL' | 'KSH' | 'SCX',
): DeliveredCheck | null {
  if (load.status === 'DELIVERED' || load.status === 'CANCELLED') return null;
  if (load.deliveredCheck !== undefined) return load.deliveredCheck;
  return import.meta.env.VITE_AUTH_MODE !== 'supabase' ? demoDeliveredCheck(load, loads, geofences, nowIso, role) : null;
}

/** Ostatnie działania automatów na liście „Działa samo” (E35 pkt 1); produkcja — wykonawca. */
export function autoMetaOf(loads: readonly Load[], events: readonly LoadEvent[]): Partial<Record<string, string>> {
  return import.meta.env.VITE_AUTH_MODE !== 'supabase' ? demoAutoMeta(loads, events) : {};
}
