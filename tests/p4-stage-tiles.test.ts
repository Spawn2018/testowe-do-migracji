/**
 * wyglad/P4 — E28 przypisanie statusów do kafelków (według E25), E27 okno śledzenia, L7 oznaczenia obok statusu.
 */
import { describe, expect, it } from 'vitest';
import { countByTile, nextTrackingStarts, stageTileOf, statusMarkers, trackingPhase, trackingWindowPrep, type StageTile } from '../src/lib/stageTiles';
import type { Load } from '../src/types';

const L = (p: Partial<Load> & { status: string }): Load =>
  ({ id: p.code ?? 'X', code: 'X', stage: 'PLAN', plannedLoadDate: '2026-10-09', delayed: false, docMissing: false, silentMinutes: null,
    resources: { trailerPlate: '' }, ...p }) as unknown as Load;

describe('E28 — każdy status w dokładnie jednym kafelku (E25)', () => {
  const cases: [string, StageTile | null][] = [
    ['PLANNED', 'PREP'], ['RESOURCES_PENDING', 'PREP'], ['DOC_MISSING', 'PREP'], ['READY', 'PREP'],
    ['LOADING', 'LOADING'], ['IN_TRANSIT_PL', 'ROAD_PL'], ['AT_PORT', 'PORT_PL'], ['ON_FERRY', 'FERRY'],
    ['AT_PORT_SE', 'PORT_SE'], ['IN_TRANSIT_SE', 'ROAD_SE'], ['APPROACHING_SITE', 'SITE'],
    ['UNLOADING', 'DELIVERED'], ['DELIVERED', 'DELIVERED'], ['READY_TO_INVOICE', 'SETTLE'], ['INVOICED', 'SETTLE'],
    ['CANCELLED', null],
  ];
  it.each(cases)('%s → %s', (status, tile) => {
    expect(stageTileOf(L({ status }))).toBe(tile);
  });
  it('„Na placu” nie trafia do Nynäshamn (błąd z E28 „Fakty”), Opóźniony i Cichy — kafelek z etapu', () => {
    expect(stageTileOf(L({ status: 'APPROACHING_SITE', stage: 'APPROACH' }))).toBe('SITE');
    expect(stageTileOf(L({ status: 'DELAYED', stage: 'SE_ROAD' }))).toBe('ROAD_SE');
    expect(stageTileOf(L({ status: 'SILENT', stage: 'TO_PORT' }))).toBe('ROAD_PL');
  });
  it('liczby: anulowane poza paskiem', () => {
    const c = countByTile([L({ status: 'PLANNED' }), L({ status: 'CANCELLED' }), L({ status: 'APPROACHING_SITE' }), L({ status: 'UNLOADING' })]);
    expect(c.PREP).toBe(1);
    expect(c.SITE).toBe(1);
    expect(c.DELIVERED).toBe(1);
    expect(Object.values(c).reduce((a, b) => a + b, 0)).toBe(3);
  });
});

describe('E27 — okno śledzenia od 03:00 w dniu załadunku do „Dostarczone”', () => {
  it('przygotowanie przed dniem załadunku i przed 03:00 — poza oknem; od 03:00 — w oknie', () => {
    const l = L({ status: 'READY', plannedLoadDate: '2026-10-08' });
    expect(trackingPhase(l, '2026-10-07T20:00:00Z')).toBe('before');
    expect(trackingPhase(l, '2026-10-08T00:30:00Z')).toBe('before'); // 02:30 w Warszawie
    expect(trackingPhase(l, '2026-10-08T01:00:00Z')).toBe('on'); // 03:00
    expect(trackingPhase(L({ status: 'IN_TRANSIT_SE' }), '2026-10-01T00:00:00Z')).toBe('on');
    expect(trackingPhase(L({ status: 'DELIVERED' }), '2026-10-08T12:00:00Z')).toBe('after');
    expect(trackingPhase(L({ status: 'CANCELLED' }), '2026-10-08T12:00:00Z')).toBe('after');
  });
  it('Mapa (E27): przygotowanie po 03:00 w dniu załadunku — kandydat na znacznik (gdy baza ma GPS); w trasie i przed oknem — nie', () => {
    const now = '2026-10-08T06:00:00Z';
    const loads = [
      L({ code: 'A', status: 'READY', plannedLoadDate: '2026-10-08' }),
      L({ code: 'B', status: 'READY', plannedLoadDate: '2026-10-09' }),
      L({ code: 'C', status: 'IN_TRANSIT_PL', stage: 'TO_PORT' }),
      L({ code: 'D', status: 'PLANNED', plannedLoadDate: '2026-10-07' }),
    ];
    expect(trackingWindowPrep(loads, now).map((l) => l.code)).toEqual(['A', 'D']);
    expect(trackingWindowPrep(loads, '2026-10-08T00:30:00Z').map((l) => l.code)).toEqual(['D']);
  });
  it('najbliższe włączenia: dni po kolei, transporty w dniu', () => {
    const loads = [
      L({ status: 'PLANNED', code: 'SG-16', plannedLoadDate: '2026-10-08' }),
      L({ status: 'PLANNED', code: 'SG-15', plannedLoadDate: '2026-10-08' }),
      L({ status: 'READY', code: 'SG-24', plannedLoadDate: '2026-10-21' }),
      L({ status: 'PLANNED', code: 'SG-17', plannedLoadDate: '2026-10-16' }),
      L({ status: 'IN_TRANSIT_PL', code: 'SG-03', plannedLoadDate: '2026-10-07' }),
    ];
    const next = nextTrackingStarts(loads, '2026-10-07T18:00:00Z', 3);
    expect(next.map((g) => g.day)).toEqual(['2026-10-08', '2026-10-16', '2026-10-21']);
    expect(next[0].loads.map((l) => l.code)).toEqual(['SG-15', 'SG-16']);
  });
});

describe('L7 — oznaczenia obok statusu', () => {
  it('Brak dokumentów: w przygotowaniu to status, po starcie — oznaczenie', () => {
    expect(statusMarkers(L({ status: 'DOC_MISSING', docMissing: true }), { hasDelayMinutes: false })).toEqual([]);
    expect(statusMarkers(L({ status: 'IN_TRANSIT_SE', docMissing: true }), { hasDelayMinutes: false })).toEqual(['nodocs']);
  });
  it('Brak GPS po 30 min ciszy w trasie; Opóźniony tylko bez liczby minut', () => {
    expect(statusMarkers(L({ status: 'IN_TRANSIT_PL', silentMinutes: 45 }), { hasDelayMinutes: false })).toEqual(['nogps']);
    expect(statusMarkers(L({ status: 'IN_TRANSIT_PL', silentMinutes: 10 }), { hasDelayMinutes: false })).toEqual([]);
    expect(statusMarkers(L({ status: 'IN_TRANSIT_SE', delayed: true }), { hasDelayMinutes: false })).toEqual(['late']);
    expect(statusMarkers(L({ status: 'IN_TRANSIT_SE', delayed: true }), { hasDelayMinutes: true })).toEqual([]);
    expect(statusMarkers(L({ status: 'PLANNED', silentMinutes: 200 }), { hasDelayMinutes: false })).toEqual([]);
  });
});
