import { describe, expect, it } from 'vitest';
import { vesselById } from '../src/lib/ferry';
import {
  cockpitFerryBanner,
  focusVoyage,
  formatVoyageDayLabel,
  loadsOnVoyage,
  seaForSailing,
  voyageSeaTableRows,
} from '../src/lib/voyage';
import type { Load } from '../src/types';

const NOW = new Date('2026-09-23T14:32:00+02:00');

function stubLoad(
  partial: Partial<Load> & Pick<Load, 'id' | 'status' | 'stage'>,
): Load {
  return {
    code: partial.code ?? partial.id,
    ferry: {
      vessel: null,
      departureAt: null,
      arrivalAt: null,
      bookingRef: null,
      status: 'NONE',
      ...partial.ferry,
    },
    ...partial,
  } as Load;
}

describe('D4 voyage SoT', () => {
  it('focusVoyage prefers elevated-sea GDN sailing from timetable (not hardcoded 25.09)', () => {
    const focus = focusVoyage(NOW);
    expect(focus.depPort).toBe('GDN');
    // 23.09 niskie, 24.09 podwyższone → focus 24.09
    expect(focus.depLocal.slice(0, 10)).toBe('2026-09-24');
    expect(focus.vessel).toBe('WAW'); // schedule SoT — NOT old SAIL_ROWS Nova Star
    expect(seaForSailing(focus).risk).toBe('podwyższone');
    expect(formatVoyageDayLabel(focus.depLocal)).toBe('24.09.2026');
  });

  it('voyageSeaTableRows vessels follow ferry-sailings schedule (opposite of old SAIL_ROWS)', () => {
    const rows = voyageSeaTableRows(NOW);
    expect(rows.length).toBe(4);
    const byDay = Object.fromEntries(rows.map((r) => [r.sailing.depLocal.slice(0, 10), r]));
    // Old SAIL_ROWS: 24.09 Nova Star / 25.09 Wawel — schedule: WAW / NS
    expect(byDay['2026-09-24'].vesselName).toContain('Wawel');
    expect(byDay['2026-09-25'].vesselName).toMatch(/Nova Star/);
    expect(byDay['2026-09-24'].riskLabel).toBe('podwyższone');
    expect(rows.find((r) => r.focused)?.sailing.depLocal.slice(0, 10)).toBe('2026-09-24');
  });

  it('loadsOnVoyage prefers departureAt day, else vessel + ferry-adjacent', () => {
    const focus = focusVoyage(NOW); // 2026-09-24 WAW
    const loads = [
      stubLoad({
        id: 'day-hit',
        status: 'AT_PORT',
        stage: 'GDANSK',
        ferry: {
          vessel: 'Nova Star',
          departureAt: '2026-09-24T20:00:00+02:00',
          arrivalAt: null,
          bookingRef: 'X',
          status: 'BOOKED',
        },
      }),
      stubLoad({
        id: 'vessel-hit',
        status: 'AT_PORT',
        stage: 'GDANSK',
        ferry: {
          vessel: 'Wawel',
          departureAt: null,
          arrivalAt: null,
          bookingRef: null,
          status: 'BOOKED',
        },
      }),
      stubLoad({
        id: 'other-day',
        status: 'AT_PORT',
        stage: 'GDANSK',
        ferry: {
          vessel: 'Wawel',
          departureAt: '2026-09-25T18:00:00+02:00',
          arrivalAt: null,
          bookingRef: null,
          status: 'BOOKED',
        },
      }),
    ];
    expect(loadsOnVoyage(loads, focus).map((l) => l.id)).toEqual(['day-hit']);
    const noDay = loads.filter((l) => l.id !== 'day-hit');
    expect(loadsOnVoyage(noDay, focus).map((l) => l.id)).toEqual(['vessel-hit']);
  });

  it('cockpitFerryBanner shares focus day/vessel/sea with risks table', () => {
    const focus = focusVoyage(NOW);
    const banner = cockpitFerryBanner([], NOW);
    expect(banner.voyage.id).toBe(focus.id);
    expect(banner.title).toBe('Rejs 24.09.2026 zagrożony.');
    expect(banner.body).toContain('2,9 m');
    expect(banner.body).toContain(vesselById(focus.vessel).name);
    expect(banner.body).toMatch(/0 transport/);
  });
});
