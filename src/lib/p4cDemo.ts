/**
 * wyglad/P4-c — przykłady tylko dla trybu demo (makieta). Produkcja dostaje te dane od wykonawcy
 * (`load.trackingLink`, `load.readyGaps`, `load.deliveredCheck`, ostatnie działania automatów) — moduł nie trafia do
 * paczki produkcyjnej: wołany wyłącznie za warunkiem `import.meta.env.VITE_AUTH_MODE !== 'supabase'` w `p4cSource.ts`.
 * Rejestracje i czasy wynikają z danych demo (bez prawdziwych linków, kluczy i tablic — G-09, G-17).
 */
import type { DeliveredCheck, Document, Geofence, Load, LoadEvent, LoadStatus, ReadyGap, TrackingLinkInfo } from '../types';
import { isReadyBlocked } from './permits';
import { dayTime, isoMs } from './statusAxis';
import { transportLabel } from './transportName';

const ROUTE: LoadStatus[] = ['LOADING', 'IN_TRANSIT_PL', 'AT_PORT', 'ON_FERRY', 'AT_PORT_SE', 'IN_TRANSIT_SE', 'APPROACHING_SITE', 'DELAYED', 'SILENT'];
const PREP: LoadStatus[] = ['PLANNED', 'RESOURCES_PENDING', 'DOC_MISSING'];

const byCode = (a: Load, b: Load) => a.code.localeCompare(b.code, 'pl', { numeric: true });
const plusDayUtc = (day: string, d: number, hh: number) => {
  const t = Date.parse(`${day.slice(0, 10)}T00:00:00Z`) + d * 864e5;
  return new Date(t + hh * 36e5).toISOString().replace('.000Z', 'Z');
};

/** E44 — warianty pola „Link śledzenia” rozłożone na kilka transportów demo. */
export function demoTrackingLink(load: Load, loads: readonly Load[], nowIso: string): TrackingLinkInfo | null {
  const sorted = [...loads].sort(byCode);
  const route = sorted.filter((l) => ROUTE.includes(l.status));
  const ready = sorted.filter((l) => l.status === 'READY');
  const pending = sorted.filter((l) => l.status === 'RESOURCES_PENDING');
  const asset = (l: Load) => (l.resources.trailerPlate ?? l.resources.tractorPlate ?? '').trim() || null;
  const okTo = (l: Load) => plusDayUtc(l.plannedDeliverDate, 1, 4);
  const now = isoMs(nowIso);
  if (route[0]?.id === load.id) {
    return { provider: 'RIO', asset: asset(load), validFrom: plusDayUtc(load.plannedLoadDate, 0, 1), validTo: okTo(load), trackerOn: 'NACZEPA',
      check: { state: 'ok', at: new Date(now - 6 * 6e4).toISOString(), lastFixAt: new Date(now - 4 * 6e4).toISOString() } };
  }
  if (route[1]?.id === load.id) {
    return { provider: 'RIO', asset: (load.resources.tractorPlate ?? '').trim() || null, validFrom: plusDayUtc(load.plannedLoadDate, 0, 1), validTo: okTo(load),
      trackerOn: 'CIAGNIK_PL', check: { state: 'ok', at: new Date(now - 12 * 6e4).toISOString(), lastFixAt: new Date(now - 9 * 6e4).toISOString() } };
  }
  if (ready[0]?.id === load.id) {
    /* wygasa w dniu dostawy o 06:00 i zaczyna nadawać o 10:00 w dniu załadunku (E44 pkt 5) */
    return { provider: 'RIO', asset: asset(load), validFrom: plusDayUtc(load.plannedLoadDate, 0, 8), validTo: plusDayUtc(load.plannedDeliverDate, 0, 4),
      trackerOn: 'NACZEPA', check: { state: 'ok', at: nowIso } };
  }
  if (ready[1]?.id === load.id) {
    const other = route[0];
    const foreign = sorted.find((l) => l.id !== load.id && l.resources.tractorPlate && l.resources.tractorPlate !== load.resources.tractorPlate);
    return { provider: 'RIO', asset: (foreign?.resources.tractorPlate ?? '').trim() || null, validFrom: plusDayUtc(load.plannedLoadDate, 0, 1), validTo: okTo(load),
      trackerOn: 'NIEZNANY', usedBy: other ? [transportLabel(other, 'SCX', 'plain')] : null, check: { state: 'ok', at: nowIso } };
  }
  if (ready[2]?.id === load.id) return { provider: 'RIO', asset: null, check: { state: 'invalid', at: nowIso } };
  if (pending[0]?.id === load.id) return { provider: 'RIO', asset: null, check: { state: 'pending', at: nowIso } };
  return null;
}

/** L6, L9, L29 — braki z danych demo (produkcja: jedna definicja z bazy, E32 pkt 6). */
export function demoReadyGaps(load: Load, docs: readonly Document[]): ReadyGap[] {
  if (!PREP.includes(load.status)) return [];
  const r = load.resources;
  const gaps: ReadyGap[] = [];
  const awiz = [
    !r.driverName?.trim() ? 'kierowca' : null,
    !r.driverPhone?.trim() ? 'telefon' : null,
    !r.tractorPlate?.trim() ? 'ciągnik' : null,
    !r.trailerPlate?.trim() ? 'naczepa' : null,
    r.trailerSwap && !r.tractorDeliveryPlate?.trim() ? 'ciągnik SE' : null,
  ].filter(Boolean) as string[];
  if (awiz.length) gaps.push({ kind: 'AWIZ', items: awiz, who: 'SCX' });
  if ((load.permit?.plPilotsRequired ?? 0) > 0 && !r.escortPlate?.trim()) gaps.push({ kind: 'PILOTS', items: ['pilot PL', 'pilot SE'], who: 'SCX' });
  if (!load.carrierOrderNo?.trim()) gaps.push({ kind: 'ORDER_SCX', who: 'SCX' });
  if (!load.hhlOrderNo?.trim()) gaps.push({ kind: 'ORDER_HHL', who: 'HHL' });
  if (isReadyBlocked(load, [...docs]).blocked) gaps.push({ kind: 'PERMIT', who: 'SCX' });
  return gaps;
}

/** E26 pkt 4, L14 — jedna sprawa na pierwszym transporcie „Na placu”. */
export function demoDeliveredCheck(
  load: Load,
  loads: readonly Load[],
  geofences: readonly Pick<Geofence, 'type' | 'name'>[],
  nowIso: string,
  role: 'HHL' | 'KSH' | 'SCX',
): DeliveredCheck | null {
  const first = [...loads].sort(byCode).find((l) => l.status === 'APPROACHING_SITE');
  if (!first || first.id !== load.id) return null;
  return {
    id: `demo-dc-${load.id}`,
    exitAt: new Date(isoMs(nowIso) - 25 * 6e4).toISOString(),
    minutes: 6,
    zoneName: geofences.find((g) => g.type === 'SITE')?.name ?? 'Plac budowy',
    canDecide: role === 'SCX',
  };
}

/** E35 pkt 1 — ostatnie działanie „Statusu ze stref” z dziennika zdarzeń demo. */
export function demoAutoMeta(loads: readonly Load[], events: readonly LoadEvent[]): Partial<Record<string, string>> {
  const last = [...events]
    .filter((e) => e.type === 'STATUS_AUTO' || e.type.startsWith('GEOFENCE_'))
    .sort((a, b) => isoMs(b.at) - isoMs(a.at))[0];
  const load = last ? loads.find((l) => l.id === last.loadId) : undefined;
  return {
    zones: last && load ? `${transportLabel(load, 'HHL', 'plain')} · ${dayTime(last.at)}` : undefined,
    texts: 'tryb testowy',
  };
}
