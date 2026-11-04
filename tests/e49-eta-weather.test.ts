import { describe, expect, it } from 'vitest';
import {
  slipperyCause,
  weatherFromCorridorWind,
  windCaseRisk,
  type CorridorWindRow,
} from '../supabase/functions/_shared/e49/etaWeather.ts';

const baseRows = (gustMs: number, windFromDeg: number): CorridorWindRow[] => [
  {
    corridor: 'SE_E4',
    km: 0,
    lon: 18,
    lat: 59,
    bearingDeg: 0,
    source: 'SMHI',
    samples: [
      {
        at: '2026-11-04T12:00:00.000Z',
        gustMs,
        windMs: gustMs * 0.7,
        windFromDeg,
        source: 'SMHI',
      },
      {
        at: '2026-11-04T18:00:00.000Z',
        gustMs: 12,
        windMs: 8,
        windFromDeg,
        source: 'SMHI',
      },
    ],
  },
  {
    corridor: 'SE_E4',
    km: 25,
    lon: 18.2,
    lat: 59.2,
    bearingDeg: 0,
    source: 'SMHI',
    samples: [
      {
        at: '2026-11-04T12:00:00.000Z',
        gustMs,
        windMs: gustMs * 0.7,
        windFromDeg,
        source: 'SMHI',
      },
    ],
  },
];

describe('E49-a etaWeather (DP-205 cz.3 / Z1 Z2)', () => {
  it('22 m/s z boku → WIND +addMin; z tyłu bez wpisu', () => {
    const cross = weatherFromCorridorWind({
      rows: baseRows(22, 90),
      fromKm: 0,
      startAt: new Date('2026-11-04T12:00:00Z'),
      driveH: 4,
    });
    expect(cross.weather.some((w) => w.kind === 'WIND' && w.side === 'CROSS')).toBe(true);
    expect(cross.addMin).toBeGreaterThan(0);

    const tail = weatherFromCorridorWind({
      rows: baseRows(22, 180),
      fromKm: 0,
      startAt: new Date('2026-11-04T12:00:00Z'),
      driveH: 4,
    });
    expect(tail.weather).toEqual([]);
    expect(tail.addMin).toBe(0);
  });

  it('26 m/s → WIND_HOLD z untilIso', () => {
    const hold = weatherFromCorridorWind({
      rows: baseRows(26, 90),
      fromKm: 0,
      startAt: new Date('2026-11-04T12:00:00Z'),
      driveH: 8,
    });
    expect(hold.weather[0]?.kind).toBe('WIND_HOLD');
    expect(hold.holdMin).toBeGreaterThan(0);
    expect(hold.weather[0]?.untilIso).toBeTruthy();
  });

  it('Z2 risk: Silny wiatr MEDIUM, postój HIGH', () => {
    const strong = windCaseRisk({
      loadId: 'a0000000-0000-4000-8000-000000000205',
      corridor: 'SE_E4',
      km: 100,
      gustMs: 22,
      addMin: 14,
      hold: false,
      atIso: '2026-11-04T12:00:00Z',
      side: 'CROSS',
    });
    expect(strong.severity).toBe('MEDIUM');
    expect(strong.title).toMatch(/Silny wiatr/);
    expect(strong.dedup).toContain('E49_WIND:');

    const stop = windCaseRisk({
      loadId: 'a0000000-0000-4000-8000-000000000205',
      corridor: 'SE_E4',
      km: 100,
      gustMs: 27,
      addMin: 210,
      hold: true,
      atIso: '2026-11-04T12:00:00Z',
      untilIso: '2026-11-04T18:30:00Z',
    });
    expect(stop.severity).toBe('HIGH');
    expect(stop.title).toMatch(/Postój przez wiatr/);
  });

  it('SLIPPERY lokalnie', () => {
    const s = slipperyCause({ where: 'E4 Skellefteå', addMin: 4 });
    expect(s.kind).toBe('SLIPPERY');
    expect(s.addMin).toBe(4);
  });
});
