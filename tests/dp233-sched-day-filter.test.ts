/**
 * DP-233 (#861): filtr Harmonogramu Załadunki/Rozładunki · dziś/jutro + sort.
 */
import { describe, expect, it } from 'vitest';
import {
  applySchedDayFilter,
  countSchedDay,
  defaultDayKind,
  matchSchedDay,
  schedDayYmd,
} from '../src/lib/schedDayFilter';
import type { Load } from '../src/types';

const base = {
  awizacja: { loadWindowStart: null, loadWindowEnd: null, unloadWindowStart: null, unloadWindowEnd: null, confirmed: false },
  planDates: { loadFrom: null, loadTo: null, deliveryFrom: null, deliveryTo: null },
} as unknown as Load;

function L(partial: Partial<Load> & Pick<Load, 'code' | 'plannedLoadDate' | 'plannedDeliverDate'>): Load {
  return { ...base, ...partial, awizacja: { ...base.awizacja, ...(partial.awizacja ?? {}) }, planDates: { ...base.planDates, ...(partial.planDates ?? {}) } } as Load;
}

describe('DP-233 schedDayFilter', () => {
  const now = '2026-11-07T10:00:00+01:00'; // sobota Europe/Warsaw

  it('schedDayYmd dziś/jutro Europe/Warsaw', () => {
    expect(schedDayYmd(now, 'today')).toBe('2026-11-07');
    expect(schedDayYmd(now, 'tomorrow')).toBe('2026-11-08');
  });

  it('defaultDayKind z wariantu KSH', () => {
    expect(defaultDayKind(null)).toBeNull();
    expect(defaultDayKind(undefined)).toBeNull();
    expect(defaultDayKind('LOADING')).toBe('loading');
    expect(defaultDayKind('UNLOADING')).toBe('unloading');
  });

  it('match / count po plannedLoadDate / plannedDeliverDate', () => {
    const a = L({ code: 'A', plannedLoadDate: '2026-11-07', plannedDeliverDate: '2026-11-09' });
    const b = L({ code: 'B', plannedLoadDate: '2026-11-08', plannedDeliverDate: '2026-11-07' });
    expect(matchSchedDay(a, 'loading', '2026-11-07')).toBe(true);
    expect(matchSchedDay(a, 'unloading', '2026-11-07')).toBe(false);
    expect(matchSchedDay(b, 'unloading', '2026-11-07')).toBe(true);
    expect(countSchedDay([a, b], 'loading', '2026-11-07')).toBe(1);
    expect(countSchedDay([a, b], 'unloading', '2026-11-07')).toBe(1);
  });

  it('sort: godzina rosnąco, brak godziny na końcu, potem nr zlecenia', () => {
    const late = L({
      code: 'SG-02', hhlOrderNo: '2',
      plannedLoadDate: '2026-11-07', plannedDeliverDate: '2026-11-10',
      planDates: { loadFrom: '2026-11-07T14:00:00+01:00', loadTo: null, deliveryFrom: null, deliveryTo: null },
    });
    const early = L({
      code: 'SG-01', hhlOrderNo: '1',
      plannedLoadDate: '2026-11-07', plannedDeliverDate: '2026-11-10',
      planDates: { loadFrom: '2026-11-07T08:00:00+01:00', loadTo: null, deliveryFrom: null, deliveryTo: null },
    });
    const noHour = L({
      code: 'SG-03', hhlOrderNo: '3',
      plannedLoadDate: '2026-11-07', plannedDeliverDate: '2026-11-10',
    });
    const otherDay = L({
      code: 'SG-09', hhlOrderNo: '9',
      plannedLoadDate: '2026-11-08', plannedDeliverDate: '2026-11-10',
      planDates: { loadFrom: '2026-11-08T07:00:00+01:00', loadTo: null, deliveryFrom: null, deliveryTo: null },
    });
    const out = applySchedDayFilter([late, noHour, early, otherDay], 'loading', '2026-11-07');
    expect(out.map((x) => x.code)).toEqual(['SG-01', 'SG-02', 'SG-03']);
  });

  it('bez kind — lista bez zmian kolejności (kopia)', () => {
    const a = L({ code: 'A', plannedLoadDate: '2026-11-07', plannedDeliverDate: '2026-11-09' });
    const b = L({ code: 'B', plannedLoadDate: '2026-11-07', plannedDeliverDate: '2026-11-09' });
    const out = applySchedDayFilter([b, a], null, '2026-11-07');
    expect(out.map((x) => x.code)).toEqual(['B', 'A']);
  });
});
