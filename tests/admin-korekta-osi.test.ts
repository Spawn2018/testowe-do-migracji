/**
 * wyglad/W-admin-daty — D-0005 (0234): Administrator HHL poprawia godzinę zapisanego statusu.
 * Baza nie zmienia starego wpisu (load_events niezmienne), tylko dopisuje `STATUS_<X>` z payload
 * { korekta, zastepuje, poprzednio, przez }. Oś Status pokazuje jeden wiersz z poprawioną godziną
 * i „poprawił Administrator HHL (było …)”, Historia — „korekta godziny (było …)”. Dane zmyślone.
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { buildStatusAxis, dayTime, statusHits } from '../src/lib/statusAxis';
import { histRow } from '../src/lib/p6History';
import { StatusAxisTab } from '../src/components/drawer/StatusAxisTab';
import type { Load, LoadEvent } from '../src/types';

const ev = (id: number, type: string, at: string, payload: Record<string, unknown> = {}, actor = 'system'): LoadEvent =>
  ({ id: `ev-${id}`, loadId: 'L1', type, at, actor, payload });

const ORIG = '2026-10-07T12:00:00Z'; /* 14:00 czasu polskiego */
const FIX = '2026-10-07T10:30:00Z'; /* 12:30 */
const base: LoadEvent[] = [
  ev(1, 'SCHEDULE_IMPORTED', '2026-10-01T19:43:00Z'),
  ev(2, 'STATUS_READY', '2026-10-05T09:10:00Z', {}, 'Anna Wiśniewska // HHL'),
  ev(3, 'STATUS_LOADING', '2026-10-06T06:00:00Z', {}, 'Jan Nowak // SCX'),
  ev(4, 'STATUS_DELIVERED', ORIG, {}, 'Jan Nowak // SCX'),
];
const fix = (id: number, at: string, zastepuje: number, poprzednio: string, actor = 'system') =>
  ev(id, 'STATUS_DELIVERED', at, { korekta: true, zastepuje, poprzednio, przez: 'HHL_ADMIN' }, actor);

const load = { id: 'L1', status: 'DELIVERED', stage: 'SITE', unloadedAt: FIX, resources: {}, plannedLoadDate: null, plannedDeliverDate: null } as unknown as Load;
const delivered = (events: LoadEvent[]) =>
  buildStatusAxis(load, events).groups.flatMap((g) => g.rows).filter((r) => r.statuses.includes('DELIVERED'));

describe('D-0005 — korekta godziny statusu na osi', () => {
  it('jeden wiersz „Dostarczone” z poprawioną (wcześniejszą) godziną, bez starego wpisu', () => {
    const rows = delivered([...base, fix(5, FIX, 4, ORIG)]);
    expect(rows).toHaveLength(1);
    expect(rows[0].hit?.at).toBe(FIX);
    expect(rows[0].hit?.source).toBe('manual');
    expect(rows[0].hit?.korekta).toEqual({ poprzednio: ORIG, przez: 'HHL_ADMIN' });
    expect(buildStatusAxis(load, [...base, fix(5, FIX, 4, ORIG)]).currentSince).toBe(FIX);
    /* zastąpiony wpis nie trafia do listy statusów */
    expect(statusHits([...base, fix(5, FIX, 4, ORIG)]).filter((h) => h.status === 'DELIVERED').map((h) => h.at)).toEqual([FIX]);
  });

  it('kolejna korekta: wygrywa najnowsza (najwyższy numer zdarzenia), także gdy ma wcześniejszą godzinę', () => {
    const later = '2026-10-07T11:00:00Z';
    const earliest = '2026-10-07T09:00:00Z';
    expect(delivered([...base, fix(5, FIX, 4, ORIG), fix(6, later, 5, FIX)])[0].hit?.at).toBe(later);
    expect(delivered([...base, fix(5, FIX, 4, ORIG), fix(6, earliest, 5, FIX)])[0].hit?.at).toBe(earliest);
    /* 0234 wskazuje jako „zastępowany” wpis z najpóźniejszą godziną — oba dopiski mogą zastępować ten sam stary */
    expect(delivered([...base, fix(5, FIX, 4, ORIG), fix(6, earliest, 4, ORIG)])[0].hit?.at).toBe(earliest);
  });

  it('bez korekty — bez zmian (SCX ponownie ustawia godzinę „Dostarczone”: najpóźniejszy wpis)', () => {
    const again = ev(5, 'STATUS_DELIVERED', '2026-10-07T13:00:00Z', {}, 'Jan Nowak // SCX');
    const rows = delivered([...base, again]);
    expect(rows[0].hit?.at).toBe('2026-10-07T13:00:00Z');
    expect(rows[0].hit?.korekta).toBeNull();
  });

  it('oś: „poprawił Administrator HHL (było 07.10.2026, 14:00)”; z osobą w payload.actor — imię i firma', () => {
    const html = (events: LoadEvent[]) =>
      renderToStaticMarkup(createElement(StatusAxisTab, { load, events, geofences: [], locale: 'pl', phone: false, canStatus: false, onChange: () => {} }));
    const a = html([...base, fix(5, FIX, 4, ORIG)]);
    expect(a).toContain(`poprawił Administrator HHL (było ${dayTime(ORIG)})`);
    expect(dayTime(ORIG)).toBe('07.10.2026, 14:00');
    expect(a).toContain(dayTime(FIX));
    expect(a).not.toContain('>Auto<');
    const b = html([...base, fix(5, FIX, 4, ORIG, 'Anna Wiśniewska // H&H Logistics')]);
    expect(b).toContain('poprawił Anna Wiśniewska // H&amp;H Logistics (było 07.10.2026, 14:00)');
  });

  it('Historia: autor Administrator HHL i „korekta godziny (było …)”', () => {
    const r = histRow(fix(5, FIX, 4, ORIG), 'pl');
    expect(r.who).toBe('Administrator HHL');
    expect(r.to).toBe('Dostarczone');
    expect(r.tail).toBe('korekta godziny (było 07.10.2026, 14:00)');
    expect(histRow(fix(5, FIX, 4, ORIG, 'Anna Wiśniewska // H&H Logistics'), 'pl').who).toBe('Anna Wiśniewska // H&H Logistics');
  });
});
