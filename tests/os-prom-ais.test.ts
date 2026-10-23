/**
 * #461 (0270) na osi Status: „Prom” z rozkładu poprawiony z AIS (STATUS_AUTO FERRY → FERRY, korekta, zastępuje wpis
 * z rozkładu) — wiersz „Na promie” zrobiony z godziną z AIS i dopiskiem „według AIS”, nie „pominięte”.
 * Układ zdarzeń jak SG-23 na produkcji 23.10.2026 (dane uproszczone).
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { buildStatusAxis } from '../src/lib/statusAxis';
import { histRow, isNoChange } from '../src/lib/p6History';
import { StatusAxisTab } from '../src/components/drawer/StatusAxisTab';
import { eventFromRow } from '../src/data/mappers';
import type { Load, LoadEvent } from '../src/types';

const ev = (id: number, type: string, at: string, payload: Record<string, unknown> = {}): LoadEvent =>
  eventFromRow({ id, load_id: 'L1', event_type: type, occurred_at: at, payload });

const SCHED = '2026-10-22T18:00:00+00:00';
const AIS = '2026-10-22T18:17:09.308+00:00';
const events: LoadEvent[] = [
  ev(2288, 'STATUS_AUTO', '2026-10-22T17:34:12+00:00', { from: 'IN_TRANSIT_PL', to: 'AT_PORT_GDANSK', source: 'GPS', powod: 'wjazd w strefę portu PL' }),
  ev(2294, 'STATUS_AUTO', SCHED, { from: 'AT_PORT_GDANSK', to: 'FERRY', source: 'SCHEDULE', powod: 'odejście przypisanego rejsu' }),
  ev(2297, 'STATUS_AUTO', AIS, { from: 'FERRY', to: 'FERRY', actor: 'system', hotfix: '0270', source: 'AIS', korekta: true, zastepuje: 2294, poprzednio: SCHED }),
  ev(2350, 'STATUS_AUTO', '2026-10-23T06:27:01.491+00:00', { from: 'FERRY', to: 'AT_PORT_NYNASHAMN', source: 'GPS', synthetic: true, powod: 'pozycja na trasie SE po promie — uzupełniony Port SE' }),
  ev(2351, 'STATUS_AUTO', '2026-10-23T07:05:50+00:00', { from: 'AT_PORT_NYNASHAMN', to: 'IN_TRANSIT_SE', source: 'GPS', powod: 'pozycja na trasie SE po promie' }),
];
const load = { id: 'L1', status: 'IN_TRANSIT_SE', stage: 'SE_ROAD', unloadedAt: null, resources: {}, plannedLoadDate: null, plannedDeliverDate: null } as unknown as Load;
const rowOf = (s: string) => buildStatusAxis(load, events).groups.flatMap((g) => g.rows).find((r) => r.statuses.includes(s as never));

describe('#461 — „Na promie” po korekcie z AIS', () => {
  it('wiersz zrobiony (nie pominięty), godzina z AIS, korekta automatyczna', () => {
    const r = rowOf('ON_FERRY');
    expect(r?.kind).toBe('done');
    expect(r?.hit?.at).toBe(AIS);
    expect(r?.hit?.source).toBe('auto');
    expect(r?.hit?.channel).toBe('AIS');
    expect(r?.hit?.korekta?.auto).toBe(true);
  });

  it('dopisek „według AIS · z rozkładu było …”, bez „poprawił Administrator HHL”', () => {
    const html = renderToStaticMarkup(createElement(StatusAxisTab, { load, events, geofences: [], locale: 'pl', phone: false, canStatus: false, onChange: () => {} }));
    expect(html).toContain('wypłynięcie według AIS · z rozkładu było 22.10.2026, 20:00');
    expect(html).not.toContain('Administrator HHL');
    expect(html).toContain('data-axis-row="ON_FERRY" data-axis-kind="done"');
  });

  it('FERRY → FERRY bez korekty nadal nie tworzy wiersza', () => {
    const plain = [ev(1, 'STATUS_AUTO', AIS, { from: 'FERRY', to: 'FERRY', source: 'AIS' })];
    expect(buildStatusAxis({ ...load, status: 'FERRY' } as Load, plain).groups.flatMap((g) => g.rows).find((r) => r.statuses.includes('ON_FERRY'))?.hit).toBeNull();
  });

  it('„z rozkładu” tylko gdy zastąpiony wpis był z rozkładu; inaczej samo „było …”', () => {
    const manual = events.map((e) => (e.id === 'ev-2294' ? { ...e, payload: { ...e.payload, source: 'GPS' } } : e));
    const html = renderToStaticMarkup(createElement(StatusAxisTab, { load, events: manual, geofences: [], locale: 'pl', phone: false, canStatus: false, onChange: () => {} }));
    expect(html).toContain('wypłynięcie według AIS · było 22.10.2026, 20:00');
    expect(html).not.toContain('z rozkładu było');
  });

  it('„Na promie” z AIS z własnym powodem (A10_b) — powód zostaje', () => {
    const a10 = [ev(1, 'STATUS_AUTO', AIS, { from: 'AT_PORT_GDANSK', to: 'FERRY', source: 'AIS', powod: 'pozycja zbieżna z AIS statku (≤ 2 km)' })];
    const html = renderToStaticMarkup(createElement(StatusAxisTab, { load: { ...load, status: 'FERRY' } as Load, events: a10, geofences: [], locale: 'pl', phone: false, canStatus: false, onChange: () => {} }));
    expect(html).toContain('Pozycja zbieżna z AIS statku');
  });

  it('Historia: korekta z AIS widoczna („według AIS, było …”), nie „bez zmian”', () => {
    const fix = events.find((e) => e.id === 'ev-2297')!;
    expect(isNoChange(fix)).toBe(false);
    expect(histRow(fix, 'pl').tail).toBe('wypłynięcie według AIS (było 22.10.2026, 20:00)');
  });
});
