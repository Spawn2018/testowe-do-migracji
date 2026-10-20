/**
 * wyglad/W-a10-zrodlo — A10 (D-20261019-1540-01 §3): na osi Status każdy wpis ma źródło —
 * „automatycznie (GPS / strefa / prom / dokumenty / import)” albo „ręcznie — osoba”.
 * Automat Przygotowania (Brak zasobów / Brak dokumentów / Gotowy) przesuwa w obie strony;
 * oś pokazuje bieżący stan, a nie najdalszy osiągnięty. Dane zmyślone (G-17).
 */
import { describe, expect, it } from 'vitest';
import { buildStatusAxis, hitChannel, statusHits } from '../src/lib/statusAxis';
import { fs6 } from '../src/i18n/p6c';
import { histRow } from '../src/lib/p6History';
import { htHas } from '../src/i18n/p6b';
import type { Load, LoadEvent } from '../src/types';

let n = 0;
const ev = (type: string, at: string, payload: Record<string, unknown> = {}, actor = 'system'): LoadEvent =>
  ({ id: `ev-${++n}`, loadId: 'L1', type, at, actor, payload });
const load = (status: string): Pick<Load, 'status' | 'stage' | 'unloadedAt'> =>
  ({ status, stage: 'PREP', unloadedAt: null }) as unknown as Pick<Load, 'status' | 'stage' | 'unloadedAt'>;

describe('A10: źródło automatu z payload.source', () => {
  it('nowe źródła: rozkład, dane, dokumenty, kierowca, faktura', () => {
    expect(hitChannel('STATUS_AUTO', { source: 'SCHEDULE' }, 'ON_FERRY')).toBe('SCHEDULE');
    expect(hitChannel('STATUS_AUTO', { source: 'FERRY_SCHEDULE', lat: 54.5 }, 'ON_FERRY')).toBe('SCHEDULE');
    expect(hitChannel('STATUS_AUTO', { source: 'DATA' }, 'RESOURCES_PENDING')).toBe('DATA');
    expect(hitChannel('STATUS_AUTO', { source: 'AWIZACJA' }, 'READY')).toBe('DATA');
    expect(hitChannel('STATUS_AUTO', { source: 'DOC' }, 'READY_TO_INVOICE')).toBe('DOC');
    expect(hitChannel('STATUS_AUTO', { source: 'PERMIT' }, 'DOC_MISSING')).toBe('DOC');
    expect(hitChannel('STATUS_AUTO', { source: 'DRIVER' }, 'DELIVERED')).toBe('DRIVER');
    expect(hitChannel('STATUS_AUTO', { source: 'DRIVER_PWA' }, 'LOADING')).toBe('DRIVER');
    expect(hitChannel('STATUS_AUTO', { source: 'INVOICE' }, 'INVOICED')).toBe('INVOICE');
    expect(hitChannel('MILESTONE_LOADED', { via: 'driver_token' }, 'LOADING')).toBe('DRIVER');
  });
  it('konflikt kategorii: słowa lokalizatora wygrywają (F7 #350 P1)', () => {
    expect(hitChannel('STATUS_AUTO', { source: 'GPS_DATA' }, 'READY')).toBe('GPS');
    expect(hitChannel('STATUS_AUTO', { source: 'DRIVER_GPS' }, 'DELIVERED')).toBe('GPS');
    expect(hitChannel('STATUS_AUTO', { source: 'GPS', zrodlo: 'ROZKLAD' }, 'ON_FERRY')).toBe('GPS');
    expect(hitChannel('STATUS_AUTO', { source: 'DOC', lat: 54.4 }, 'READY_TO_INVOICE')).toBe('DOC');
  });
  it('każdy kanał ma etykietę na osi i w Historii', () => {
    for (const ch of ['GPS', 'AIS', 'SCHEDULE', 'DATA', 'DOC', 'DRIVER', 'INVOICE']) {
      expect(fs6('pl', `p6c_tag_${ch}`)).not.toBe(`p6c_tag_${ch}`);
      expect(htHas(`p6b_src_${ch}`)).toBe(true);
    }
  });
  it('dotychczasowe źródła bez zmian; fragment słowa to nie źródło', () => {
    expect(hitChannel('STATUS_AUTO', { source: 'AIS' }, 'ON_FERRY')).toBe('AIS');
    expect(hitChannel('STATUS_AUTO', { geofence_id: 'gf-1' }, 'LOADING')).toBe('GPS');
    expect(hitChannel('STATUS_AUTO', { source: 'C17_BACKFILL' }, 'DELIVERED')).toBeNull();
    expect(hitChannel('STATUS_AUTO', { source: 'METADATA' }, 'READY')).toBeNull();
    expect(hitChannel('STATUS_AUTO', { source: 'DOCKER' }, 'READY')).toBeNull();
  });
  it('wpis ręczny nie dostaje kanału automatu', () => {
    const hits = statusHits([ev('STATUS_READY', '2026-10-20T08:00:00Z', { manual: true, source: 'DATA' }, 'Anna Nowak // HHL')]);
    expect(hits[0].source).toBe('manual');
    expect(hits[0].channel).toBeNull();
    expect(hits[0].actor).toBe('Anna Nowak // HHL');
  });
  it('etykiety po polsku dla każdego kanału', () => {
    for (const [k, v] of [['SCHEDULE', 'Rozkład'], ['DATA', 'Dane'], ['DOC', 'Dokumenty'], ['DRIVER', 'Kierowca'], ['INVOICE', 'Faktura']]) {
      expect(fs6('pl', `p6c_tag_${k}`)).toBe(v);
    }
    expect(fs6('pl', 'p6c_legend')).toMatch(/Dokumenty = zezwolenia, polisy, CMR/);
  });
});

describe('A10: Przygotowanie w obie strony', () => {
  const events = [
    ev('SCHEDULE_IMPORTED', '2026-10-01T10:00:00Z'),
    ev('STATUS_AUTO', '2026-10-18T08:00:00Z', { from: 'PLANNED', to: 'RESOURCES_PENDING', source: 'DATA', powod: 'brak kierowcy' }),
    ev('STATUS_AUTO', '2026-10-18T12:00:00Z', { from: 'RESOURCES_PENDING', to: 'READY', source: 'DATA', powod: 'komplet' }),
    /* kierowca usunięty — automat cofa wewnątrz Przygotowania */
    ev('STATUS_AUTO', '2026-10-19T09:00:00Z', { from: 'READY', to: 'RESOURCES_PENDING', source: 'DATA', powod: 'brak kierowcy' }),
  ];
  it('bieżący = Brak zasobów z najnowszą godziną; Gotowy wraca do „czeka”', () => {
    const axis = buildStatusAxis(load('RESOURCES_PENDING'), events);
    const prep = axis.groups.find((g) => g.key === 'prep')!;
    const row = (s: string) => prep.rows.find((r) => r.statuses.includes(s as never))!;
    expect(axis.current).toBe('RESOURCES_PENDING');
    expect(axis.currentSince).toBe('2026-10-19T09:00:00Z');
    expect(row('RESOURCES_PENDING').kind).toBe('current');
    expect(row('RESOURCES_PENDING').hit?.channel).toBe('DATA');
    expect(row('READY').kind).toBe('pending');
    expect(row('PLANNED').hit?.source).toBe('import');
  });
  it('ponowny komplet — Gotowy bieżący, z kanałem Dane', () => {
    const more = [...events, ev('STATUS_AUTO', '2026-10-19T15:00:00Z', { from: 'RESOURCES_PENDING', to: 'READY', source: 'DATA' })];
    const axis = buildStatusAxis(load('READY'), more);
    expect(axis.current).toBe('READY');
    expect(axis.currentSince).toBe('2026-10-19T15:00:00Z');
    const ready = axis.groups.find((g) => g.key === 'prep')!.rows.find((r) => r.statuses.includes('READY'))!;
    expect(ready.hit?.channel).toBe('DATA');
  });
});

describe('A10: Historia pokazuje źródło automatu', () => {
  it('status z CMR — „dokumenty”; Przygotowanie — „dane awizacji”; rozkład promu', () => {
    const cmr = histRow(ev('STATUS_AUTO', '2026-10-15T12:11:00Z', { from: 'DELIVERED', to: 'READY_TO_INVOICE', source: 'DOC', powod: 'CMR z podpisem odbiorcy wgrany' }), 'pl');
    expect(cmr.src).toBe('dokumenty');
    const prep = histRow(ev('STATUS_AUTO', '2026-10-19T09:00:00Z', { from: 'READY', to: 'RESOURCES_PENDING', source: 'DATA' }), 'pl');
    expect(prep.src).toBe('dane awizacji');
    const ferry = histRow(ev('STATUS_AUTO', '2026-10-19T20:00:00Z', { from: 'AT_PORT', to: 'ON_FERRY', source: 'FERRY_SCHEDULE' }), 'pl');
    expect(ferry.src).toBe('rozkład promu');
    const gps = histRow(ev('STATUS_AUTO', '2026-10-19T21:00:00Z', { from: 'ON_FERRY', to: 'AT_PORT_SE', source: 'GPS', provider: 'emtrack' }), 'pl');
    expect(gps.src).toBe('GPS emtrack');
    /* oś i Historia zgodne także przy wpisie z pozycją (F7 #350 P2) */
    const ferryLat = histRow(ev('STATUS_AUTO', '2026-10-19T20:00:00Z', { from: 'AT_PORT', to: 'ON_FERRY', source: 'FERRY_SCHEDULE', lat: 54.5 }), 'pl');
    expect(ferryLat.src).toBe('rozkład promu');
    const doc = histRow(ev('STATUS_AUTO', '2026-10-15T12:11:00Z', { to: 'READY_TO_INVOICE', source: 'DOC', lat: 65.8 }), 'pl');
    expect(doc.src).toBe('dokumenty');
  });
  it('wpis ręczny z `source: DATA` — bez źródła automatu w Historii (F7 #350 U1)', () => {
    const row = histRow(ev('STATUS_READY', '2026-10-20T08:00:00Z', { manual: true, source: 'DATA' }, 'Anna Nowak // HHL'), 'pl');
    expect(row.src).toBeNull();
  });
});
