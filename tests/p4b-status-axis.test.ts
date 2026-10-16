/**
 * wyglad/P4-b — oś statusów E25 (img/e25-after), podpowiedź z GPS do okna „Zmień status”, rozpoznanie linku śledzenia (E44).
 * Dane jak SG-03 na produkcji (zdarzenia z `load_events`, godziny polskie; zmyślone numery — G-17).
 */
import { describe, expect, it } from 'vitest';
import { axisActor, axisStatus, buildStatusAxis, dayTime, gpsHint, hoursMinutes } from '../src/lib/statusAxis';
import { trackerKind } from '../src/lib/trackerLink';
import type { Load, LoadEvent } from '../src/types';

const ev = (type: string, at: string, payload: Record<string, unknown> = {}, actor = 'system', note?: string): LoadEvent =>
  ({ id: `${type}-${at}`, loadId: 'L1', type, at, actor, payload, note });

const SITE = 'gf-site';
const events: LoadEvent[] = [
  ev('SCHEDULE_IMPORTED', '2026-10-01T19:43:00Z', { code: 'SG-03' }),
  ev('STATUS_READY', '2026-10-05T09:10:00Z', {}, 'HHL', 'Zasoby uzupełnione — cover OK'),
  /* B4 / D-20261015-0300-01: skipTracker z payload.tracker_on, nie ze słowa „naczep” w powod */
  ev('STATUS_AUTO', '2026-10-05T11:21:00Z', { from: 'READY', to: 'READY', powod: 'faza ustalona z pozycji przy podłączeniu', zrodlo: 'TELM_PHASE_INFER', tracker_on: 'NACZEPA', lat: 62.5, lon: 17.6 }),
  ev('STATUS_AUTO', '2026-10-05T11:21:00Z', { from: 'READY', to: 'IN_TRANSIT_SE', powod: 'faza ustalona z pozycji przy podłączeniu', zrodlo: 'TELM_PHASE_INFER', tracker_on: 'NACZEPA', lat: 62.5, lon: 17.6 }),
  ev('GEOFENCE_ENTER', '2026-10-07T06:35:00Z', { geofence_id: SITE }),
  ev('STATUS_AUTO', '2026-10-07T06:35:00Z', { from: 'IN_TRANSIT_SE', to: 'AT_SITE', powod: 'wjazd na plac budowy', geofence_id: SITE }),
  ev('GEOFENCE_EXIT', '2026-10-07T10:19:00Z', { geofence_id: SITE }),
];
const load = (status: string): Pick<Load, 'status' | 'stage' | 'unloadedAt'> =>
  ({ status, stage: 'SITE', unloadedAt: null }) as unknown as Pick<Load, 'status' | 'stage' | 'unloadedAt'>;

describe('E25 — oś statusów z dziennika zdarzeń', () => {
  it('SG-03 „Na placu”: grupy, pominięte z przyczyną, AUTO / RĘCZNIE, bieżący, oczekujące', () => {
    const a = buildStatusAxis(load('APPROACHING_SITE'), events);
    const [prep, route, after] = a.groups;
    expect(prep.rows.map((r) => [r.statuses.join('+'), r.kind])).toEqual([
      ['PLANNED', 'done'],
      ['RESOURCES_PENDING+DOC_MISSING', 'skipped'],
      ['READY', 'done'],
    ]);
    expect(prep.rows[0].hit?.source).toBe('import');
    expect(prep.rows[1].skipWhy).toBe('complete');
    expect(prep.rows[2].hit?.source).toBe('manual');
    expect(route.rows.map((r) => [r.statuses.join('+'), r.kind])).toEqual([
      ['LOADING+IN_TRANSIT_PL+AT_PORT+ON_FERRY+AT_PORT_SE', 'skipped'],
      ['IN_TRANSIT_SE', 'done'],
      ['APPROACHING_SITE', 'current'],
      ['DELIVERED', 'pending'],
    ]);
    expect(route.rows[0].skipWhy).toBe('trackerSe');
    expect(route.rows[0].skipTracker).toBe('trailer');
    expect(route.rows[1].hit?.source).toBe('auto');
    expect(route.rows[1].hit?.phaseInfer).toBe(true);
    expect(after.rows.map((r) => r.kind)).toEqual(['pending', 'pending']);
    expect(a.current).toBe('APPROACHING_SITE');
    expect(dayTime(a.currentSince)).toBe('07.10.2026, 08:35');
    expect(dayTime(a.firstFixAt)).toBe('05.10.2026, 13:21');
  });

  it('ręczne „Dostarczone” z okna (payload.manual) — bieżący, ręcznie, data realizacji', () => {
    const manual = ev('STATUS_DELIVERED', '2026-10-07T10:19:00Z', { manual: true, from: 'AT_SITE', to: 'DELIVERED' }, 'Jan Testowy // H&H Logistics', 'potwierdzone z placem');
    const a = buildStatusAxis(load('DELIVERED'), [...events, manual]);
    const row = a.groups[1].rows.find((r) => r.statuses[0] === 'DELIVERED')!;
    expect(row.kind).toBe('current');
    expect(row.hit?.source).toBe('manual');
    expect(row.hit?.actor).toBe('Jan Testowy // H&H Logistics');
    expect(dayTime(a.deliveredAt)).toBe('07.10.2026, 12:19');
  });

  it('kody bazy na osi (AT_PORT_NYNASHAMN → Port SE, UNLOADED → Dostarczone); Anulowany poza osią', () => {
    expect(axisStatus('AT_PORT_NYNASHAMN')).toBe('AT_PORT_SE');
    expect(axisStatus('UNLOADED')).toBe('DELIVERED');
    expect(axisStatus('CANCELLED')).toBeNull();
    const a = buildStatusAxis(load('CANCELLED'), events);
    expect(a.cancelled).toBe(true);
    expect(a.current).toBeNull();
  });

  it('autor: „Imię Nazwisko // Firma”, stare wpisy — nazwa firmy', () => {
    expect(axisActor('Jan Testowy//SCX')).toBe('Jan Testowy // SCX');
    expect(axisActor('HHL')).toBe('H&H Logistics');
    expect(axisActor(null)).toBeNull();
    expect(hoursMinutes((3 * 60 + 44) * 60_000)).toBe('3 h 44 min');
  });
});

describe('E25 — podpowiedź z GPS w oknie „Zmień status”', () => {
  const zones = [{ id: SITE, type: 'SITE' as const }];
  it('„Dostarczone” → ostatni wyjazd z placu po bieżącym statusie; „Na placu” → wjazd', () => {
    expect(gpsHint('DELIVERED', events, zones, '2026-10-07T06:35:00Z')).toEqual({ kind: 'siteExit', at: '2026-10-07T10:19:00Z' });
    expect(gpsHint('APPROACHING_SITE', events, zones, null)).toEqual({ kind: 'siteEnter', at: '2026-10-07T06:35:00Z' });
    expect(gpsHint('DELIVERED', events, zones, '2026-10-07T11:00:00Z')).toBeNull();
    expect(gpsHint('READY', events, zones, null)).toBeNull();
  });
  it('porównanie po czasie, nie po tekście (+02:00 z okna i Z z bazy); strefa dopisana przy fazie z pozycji (synthetic) — pominięta', () => {
    /* ręcznie „Na placu” 08:35 czasu polskiego, wyjazd z placu 07:30Z = 09:30 — podpowiedź musi go widzieć */
    const evs = [...events, ev('GEOFENCE_EXIT', '2026-10-07T07:30:00Z', { geofence_id: SITE })];
    expect(gpsHint('DELIVERED', evs, zones, '2026-10-07T08:35:00+02:00')).toEqual({ kind: 'siteExit', at: '2026-10-07T10:19:00Z' });
    const only = [ev('GEOFENCE_EXIT', '2026-10-07T07:30:00Z', { geofence_id: SITE })];
    expect(gpsHint('DELIVERED', only, zones, '2026-10-07T08:35:00+02:00')).toEqual({ kind: 'siteExit', at: '2026-10-07T07:30:00Z' });
    const loadZone = [{ id: 'gf-srem', type: 'LOADING' as const }];
    const synth = [ev('GEOFENCE_EXIT', '2026-10-05T11:21:00Z', { geofence_id: 'gf-srem', synthetic: true, zrodlo: 'TELM_PHASE_INFER' })];
    expect(gpsHint('IN_TRANSIT_PL', synth, loadZone, null)).toBeNull();
  });
  it('data realizacji usługi z `actual_delivery_at` (rozliczenie), nie z późniejszej poprawki statusu', () => {
    const again = ev('STATUS_DELIVERED', '2026-10-08T09:00:00Z', { manual: true }, 'Jan Testowy // H&H Logistics');
    const a = buildStatusAxis({ status: 'DELIVERED', stage: 'DELIVERED', unloadedAt: '2026-10-07T10:19:00Z' } as never, [...events, again]);
    expect(dayTime(a.deliveredAt)).toBe('07.10.2026, 12:19');
  });
});

describe('E44 — rozpoznanie linku śledzenia (bez pokazywania linku)', () => {
  it('RIO, emtrack, inne, brak', () => {
    expect(trackerKind('https://public.position-sharing.rio.cloud/?id=00000000-0000-0000-0000-000000000000&secret=TEST')).toBe('rio');
    expect(trackerKind('https://emtrack.eu/app/')).toBe('emtrack');
    expect(trackerKind('ABC-123')).toBe('other');
    expect(trackerKind('  ')).toBe('none');
  });
});
