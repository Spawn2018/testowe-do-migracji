/**
 * wyglad/P4-c — skąd wygląd bierze dane: produkcja — pola od wykonawcy (`load.trackingLink`, `load.readyGaps`,
 * `load.deliveredCheck`; D-20261014-1320-01 K2); demo — przykłady z `p4cDemo.ts`.
 * Warunek `import.meta.env.VITE_AUTH_MODE` wpisany wprost, żeby build produkcyjny wyciął przykłady (strażnik I-0).
 */
import type { DeliveredCheck, Document, Geofence, Load, LoadEvent, ReadyGap, TrackingLinkInfo } from '../types';
import { demoAutoMeta, demoDeliveredCheck, demoReadyGaps, demoTrackingLink } from './p4cDemo';
import { computeReadyGaps } from './readyGaps';
import { dayTime, isoMs } from './statusAxis';

export function trackingLinkOf(load: Load, loads: readonly Load[], nowIso: string): TrackingLinkInfo | null {
  if (load.trackingLink !== undefined) return load.trackingLink;
  return import.meta.env.VITE_AUTH_MODE !== 'supabase' ? demoTrackingLink(load, loads, nowIso) : null;
}

/**
 * null = brak danych (nic nie pokazujemy i nie blokujemy); [] = komplet.
 * `companyDocs` — wszystkie dokumenty (pliki firmy bez transportu); używane tylko w demo (polisa SCX firmy, audyt-C C-06).
 */
export function readyGapsOf(load: Load, docs: readonly Document[], companyDocs: readonly Document[] = []): ReadyGap[] | null {
  if (load.readyGaps !== undefined) return load.readyGaps;
  /* jedna definicja E32 pkt 6 — ta sama w demo i w produkcji (K2.2) */
  return import.meta.env.VITE_AUTH_MODE !== 'supabase' ? demoReadyGaps(load, docs, companyDocs) : computeReadyGaps(load, docs);
}

/** B1 / L14: sprawa „czy dostarczono?” z bazy (load.deliveredCheck) albo z GEOFENCE_EXIT SITE przy krótkim postoju. */
export function deliveredCheckFromEvents(
  load: Load,
  events: readonly LoadEvent[],
  geofences: readonly Pick<Geofence, 'type' | 'name'>[],
  role: 'HHL' | 'KSH' | 'SCX',
  thresholdMin = 10,
): DeliveredCheck | null {
  if (load.status === 'DELIVERED' || String(load.status) === 'CANCELLED') return null;
  const siteExit = [...events]
    .filter((e) => e.loadId === load.id && e.type === 'GEOFENCE_EXIT')
    .sort((a, b) => isoMs(b.at) - isoMs(a.at))[0];
  if (!siteExit) return null;
  const p = (siteExit.payload ?? {}) as { dwell_min?: number; minutes?: number; zone?: string; geofence_type?: string };
  const minutes = Number(p.dwell_min ?? p.minutes ?? NaN);
  if (!Number.isFinite(minutes) || minutes >= thresholdMin) return null;
  const zoneName = p.zone
    ?? geofences.find((g) => g.type === 'SITE')?.name
    ?? 'Plac budowy';
  return {
    id: `dc-${load.id}-${siteExit.at}`,
    exitAt: siteExit.at,
    minutes: Math.round(minutes),
    thresholdMin,
    zoneName,
    canDecide: role === 'SCX',
  };
}

export function deliveredCheckOf(
  load: Load,
  loads: readonly Load[],
  geofences: readonly Pick<Geofence, 'type' | 'name'>[],
  nowIso: string,
  role: 'HHL' | 'KSH' | 'SCX',
  events: readonly LoadEvent[] = [],
): DeliveredCheck | null {
  if (load.status === 'DELIVERED' || String(load.status) === 'CANCELLED' /* jak TrackingBar: anulowany spoza LoadStatus */) return null;
  if (load.deliveredCheck !== undefined) return load.deliveredCheck;
  return import.meta.env.VITE_AUTH_MODE !== 'supabase' ? demoDeliveredCheck(load, loads, geofences, nowIso, role) : deliveredCheckFromEvents(load, events, geofences, role);
}

function prodAutoMeta(loads: readonly Load[], events: readonly LoadEvent[], nowIso: string): Partial<Record<string, string>> {
  const now = isoMs(nowIso);
  const timed = [...events].filter((e) => isoMs(e.at) <= now).sort((a, b) => isoMs(b.at) - isoMs(a.at));
  const zoneEv = timed.find((e) => e.type === 'STATUS_AUTO' || e.type.startsWith('GEOFENCE_')
    || ['LOADING', 'LOADED', 'PORT_OUT', 'PORT_IN', 'SITE', 'UNLOADED'].includes(e.type));
  const priceEv = timed.find((e) => /PRICE|FEE|BAF|SEFS|INVOICE/i.test(e.type) || /price|fee|baf/i.test(String((e.payload as { kind?: string } | undefined)?.kind ?? '')));
  const textEv = timed.find((e) => e.type === 'NOTE' || /NOTIFY|BROADCAST|TEXT/i.test(e.type));
  const out: Partial<Record<string, string>> = {};
  if (zoneEv) {
    const load = loads.find((l) => l.id === zoneEv.loadId);
    if (load) out.zones = `${load.code} · ${dayTime(zoneEv.at)}`;
  }
  /* B2 / K2.4: prices i texts — nie tylko zones */
  if (priceEv) {
    const load = loads.find((l) => l.id === priceEv.loadId);
    out.prices = load ? `${load.code} · ${dayTime(priceEv.at)}` : dayTime(priceEv.at);
  }
  if (textEv) {
    const load = loads.find((l) => l.id === textEv.loadId);
    out.texts = load ? `${load.code} · ${dayTime(textEv.at)}` : dayTime(textEv.at);
  }
  return out;
}

/** Ostatnie działania automatów na liście „Działa samo” (E35 pkt 1; K2.4). */
export function autoMetaOf(loads: readonly Load[], events: readonly LoadEvent[], nowIso: string): Partial<Record<string, string>> {
  return import.meta.env.VITE_AUTH_MODE !== 'supabase' ? demoAutoMeta(loads, events, nowIso) : prodAutoMeta(loads, events, nowIso);
}
