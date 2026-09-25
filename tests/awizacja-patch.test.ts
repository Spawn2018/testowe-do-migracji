/** BK5 — formularz awizacji wysyła wyłącznie zmienione pola (okna planowe przewoźnika bez zmian → bez zapisu). */
import { describe, expect, it } from 'vitest';
import { awizacjaChanges } from '../src/lib/awizacjaPatch';
import { awizacjaPatchToDb } from '../src/data/mappers';
import type { Awizacja } from '../src/types';

const prev: Awizacja = {
  loadWindowStart: '2026-10-05T06:00:00+02:00', loadWindowEnd: '2026-10-05T14:00:00+02:00',
  unloadWindowStart: '2026-10-09T07:00:00+02:00', unloadWindowEnd: null, confirmed: false,
};

describe('BK5 awizacjaChanges', () => {
  it('same instants in another ISO form → nothing to write (no plan_* columns)', () => {
    const next = { ...prev, loadWindowStart: '2026-10-05T04:00:00.000Z', loadWindowEnd: '2026-10-05T12:00Z' };
    expect(awizacjaChanges(prev, next)).toEqual({});
    expect(awizacjaPatchToDb(awizacjaChanges(prev, next))).toEqual({});
  });
  it('only confirmed toggled → no window columns sent', () => {
    const d = awizacjaChanges(prev, { ...prev, confirmed: true });
    expect(d).toEqual({ confirmed: true });
    expect(awizacjaPatchToDb(d)).toEqual({});
  });
  it('seconds dropped by datetime-local are not a change', () => {
    const p2 = { ...prev, loadWindowStart: '2026-10-05T06:00:30+02:00' };
    expect(awizacjaChanges(p2, { ...p2, loadWindowStart: '2026-10-05T06:00:00+02:00' })).toEqual({});
  });
  it('a real change sends just that field; null ↔ value counts', () => {
    const d = awizacjaChanges(prev, { ...prev, loadWindowEnd: '2026-10-05T16:00:00+02:00', unloadWindowEnd: '2026-10-09T15:00:00+02:00' });
    expect(Object.keys(d).sort()).toEqual(['loadWindowEnd', 'unloadWindowEnd']);
    expect(awizacjaPatchToDb(d)).toEqual({ plan_load_to: '2026-10-05T16:00:00+02:00', plan_delivery_to: '2026-10-09T15:00:00+02:00' });
    expect(awizacjaChanges(prev, { ...prev, loadWindowStart: null })).toEqual({ loadWindowStart: null });
  });
});
