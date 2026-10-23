/**
 * #489 (0276): po odpięciu rejsu baza cofa „Prom” do poprzedniego statusu (STATUS_AUTO, source SAILING_REMOVED,
 * `cofniete: true`, `zastepuje`, `cofniete_ids`). Oś: wpisy „Prom” z rejsu znikają, bieżący „Droga PL” z godziną odpięcia;
 * inne korekty (np. „Prom” z AIS innego transportu, korekta Administratora HHL) zostają. Układ jak SG-18 (dane uproszczone).
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { StatusAxisTab } from '../src/components/drawer/StatusAxisTab';
import { buildStatusAxis, statusHits } from '../src/lib/statusAxis';
import { eventFromRow } from '../src/data/mappers';
import type { Load, LoadEvent } from '../src/types';

const ev = (id: number, type: string, at: string, payload: Record<string, unknown> = {}, loadId = 'L18'): LoadEvent =>
  eventFromRow({ id, load_id: loadId, event_type: type, occurred_at: at, payload });

const OFF = '2026-10-23T11:05:13+00:00';
const base: LoadEvent[] = [
  ev(2232, 'STATUS_IN_TRANSIT_PL', '2026-10-21T09:00:00+00:00', { actor: 'Jan Nowak // SCX' }),
  ev(2295, 'STATUS_AUTO', '2026-10-22T16:15:39+00:00', { from: 'IN_TRANSIT_PL', to: 'FERRY', source: 'AIS', powod: 'wypłynięcie rejsu (AIS) — korekta #461' }),
];
const undo = (zastepuje: number, ids: number[] = []) =>
  ev(2400, 'STATUS_AUTO', OFF, { from: 'FERRY', to: 'IN_TRANSIT_PL', source: 'SAILING_REMOVED', cofniete: true, zastepuje, cofniete_ids: ids, powod: 'rejs odpięty — powrót do poprzedniego statusu', actor: 'Sebastian Bożek // H&H Logistics' });
const load = { id: 'L18', status: 'IN_TRANSIT_PL', stage: 'TO_PORT', unloadedAt: null, resources: {}, plannedLoadDate: null, plannedDeliverDate: null } as unknown as Load;
const row = (events: LoadEvent[], s: string) => buildStatusAxis(load, events).groups.flatMap((g) => g.rows).find((r) => r.statuses.includes(s as never));

describe('#489 — cofnięty „Prom” po odpięciu rejsu', () => {
  it('SG-18: „Na promie” bez wpisu, „Droga PL” bieżący z pierwotną godziną i dopiskiem odpięcia', () => {
    const events = [...base, undo(2295)];
    expect(row(events, 'ON_FERRY')?.hit).toBeNull();
    const cur = row(events, 'IN_TRANSIT_PL');
    expect(cur?.kind).toBe('current');
    expect(cur?.hit?.at).toBe('2026-10-21T09:00:00+00:00');
    expect(cur?.hit?.cofniecieAt).toBe(OFF);
    const html = renderToStaticMarkup(createElement(StatusAxisTab, { load, events, geofences: [], locale: 'pl', phone: false, canStatus: false, onChange: () => {} }));
    expect(html).toContain('rejs odpięty 23.10.2026, 13:05 — powrót do tego statusu');
  });

  it('powrót do statusu bez wcześniejszego wpisu — godzina odpięcia i powód', () => {
    const events = [base[1], undo(2295)];
    const cur = row(events, 'IN_TRANSIT_PL');
    expect(cur?.hit?.at).toBe(OFF);
    const html = renderToStaticMarkup(createElement(StatusAxisTab, { load, events, geofences: [], locale: 'pl', phone: false, canStatus: false, onChange: () => {} }));
    expect(html).toContain('rejs odpięty 23.10.2026, 13:05 — powrót do tego statusu');
  });

  it('łańcuch rozkład → korekta AIS: oba wpisy znikają (cofniete_ids)', () => {
    const chain = [
      ev(2291, 'STATUS_AUTO', '2026-10-22T16:00:00+00:00', { from: 'AT_PORT_GDANSK', to: 'FERRY', source: 'SCHEDULE' }),
      ev(2296, 'STATUS_AUTO', '2026-10-22T16:15:00+00:00', { from: 'FERRY', to: 'FERRY', source: 'AIS', korekta: true, zastepuje: 2291, actor: 'system' }),
    ];
    const events = [...chain, undo(2296, [2291, 2296])];
    expect(statusHits(events).filter((h) => h.status === 'ON_FERRY')).toHaveLength(0);
  });

  it('cofnięcie nie wyrzuca korekty innego transportu ani innej korekty tego samego', () => {
    const other = ev(2297, 'STATUS_AUTO', '2026-10-22T18:17:00+00:00', { from: 'FERRY', to: 'FERRY', source: 'AIS', korekta: true, zastepuje: 2294, actor: 'system' }, 'L23');
    const hits = statusHits([...base, undo(2295), other]);
    expect(hits.some((h) => h.at === '2026-10-22T18:17:00+00:00' && h.status === 'ON_FERRY')).toBe(true);
  });
});
