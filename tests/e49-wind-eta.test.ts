import { describe, expect, it } from 'vitest';
import {
  E49_WIND_DEFAULTS,
  slipAppliesLocally,
  slipMultLocal,
  windBearingOf,
  windEtaEffect,
  windRelativeAngleDeg,
} from '../supabase/functions/_shared/e49/windEta.ts';
import {
  parseFmiHarmonieWind,
  parseSmhiSnow1gWind,
  smhiOutsideGrid,
  windSourceLabel,
} from '../supabase/functions/_shared/e49/windForecast.ts';

describe('E49-a windEta (DP-205 / Z1 Z6)', () => {
  it('15–19 m/s → bez zmian', () => {
    expect(windEtaEffect({ gustMs: 18, travelDeg: 0, windFromDeg: 90 }).kind).toBe('none');
  });

  it('22 m/s z boku → ×1,15; z przodu ×1,05; z tyłu bez zmian', () => {
    const cross = windEtaEffect({ gustMs: 22, travelDeg: 0, windFromDeg: 90 });
    expect(cross).toEqual({ kind: 'slow', bearing: 'cross', mult: 1.15, gustMs: 22 });
    const head = windEtaEffect({ gustMs: 22, travelDeg: 0, windFromDeg: 10 });
    expect(head).toEqual({ kind: 'slow', bearing: 'head', mult: 1.05, gustMs: 22 });
    const tail = windEtaEffect({ gustMs: 22, travelDeg: 0, windFromDeg: 180 });
    expect(tail.kind).toBe('none');
  });

  it('26 m/s → postój do <20 + 30 min', () => {
    const hold = windEtaEffect({ gustMs: 26, travelDeg: 0, windFromDeg: 90 });
    expect(hold).toEqual({
      kind: 'hold',
      gustMs: 26,
      resumeBelowMs: E49_WIND_DEFAULTS.WIND_RESUME_MS,
      resumeExtraMin: E49_WIND_DEFAULTS.WIND_RESUME_MIN,
    });
  });

  it('kąt względny i bearing', () => {
    expect(windRelativeAngleDeg(0, 90)).toBe(90);
    expect(windBearingOf(0, 20)).toBe('head');
    expect(windBearingOf(0, 90)).toBe('cross');
    expect(windBearingOf(0, 170)).toBe('tail');
  });

  it('śliskość lokalnie ≤ 25 km', () => {
    expect(slipAppliesLocally(10)).toBe(true);
    expect(slipAppliesLocally(25)).toBe(true);
    expect(slipAppliesLocally(25.1)).toBe(false);
    expect(slipMultLocal(5)).toBe(1.15);
    expect(slipMultLocal(40)).toBe(1);
  });
});

describe('E49-a windForecast SMHI/FMI', () => {
  it('parsuje snow1g z kierunkiem', () => {
    const samples = parseSmhiSnow1gWind({
      timeSeries: [
        {
          time: '2026-11-04T12:00:00Z',
          data: { wind_speed: 8, wind_speed_of_gust: 22, wind_from_direction: 90 },
        },
      ],
    });
    expect(samples).toHaveLength(1);
    expect(samples[0].gustMs).toBe(22);
    expect(samples[0].windFromDeg).toBe(90);
    expect(samples[0].source).toBe('SMHI');
    expect(smhiOutsideGrid(samples)).toBe(false);
    expect(smhiOutsideGrid([])).toBe(true);
  });

  it('FMI HARMONIE XML → poryw; podpis FMI', () => {
    const xml = `
      <wfs:member><gml:id="WindGust-1"/>
        <wml2:time>2026-11-04T14:00:00Z</wml2:time><wml2:value>26</wml2:value>
      </wfs:member>
      <wfs:member><gml:id="WindSpeedMS-1"/>
        <wml2:time>2026-11-04T14:00:00Z</wml2:time><wml2:value>18</wml2:value>
      </wfs:member>`;
    const samples = parseFmiHarmonieWind(xml);
    expect(samples).toHaveLength(1);
    expect(samples[0].gustMs).toBe(26);
    expect(samples[0].windMs).toBe(18);
    expect(samples[0].source).toBe('FMI');
    expect(windSourceLabel('FMI')).toMatch(/FMI/);
  });
});
