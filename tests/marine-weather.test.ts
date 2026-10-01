/**
 * II-8 — unit: parsery FMI/DMI/SMHI + progi WAVE_M / GUST_KN (D-39).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  evaluateMarineWindow,
  marineWeatherRisk,
  msToKnots,
  parseDmiCoverageJson,
  parseFmiTimeValuePair,
  parseSmhiOcobs,
  samplesInWindow,
} from '../supabase/functions/_shared/ferry/marineWeather';

const fx = (n: string) => readFileSync(new URL(`./fixtures/${n}`, import.meta.url), 'utf8');

describe('marineWeather — jednostki', () => {
  it('40 kn ≈ 20,58 m/s', () => {
    expect(msToKnots(20.577).toFixed(0)).toBe('40');
  });
});

describe('marineWeather — FMI WFS', () => {
  it('parsuje SigWaveHeight z fixture mid-route', () => {
    const xml = fx('fmi-wam-mid-2026-10-02.xml');
    const rows = parseFmiTimeValuePair(xml, 'MID', 'wave');
    expect(rows.length).toBeGreaterThan(5);
    const withWave = rows.filter((r) => r.waveM != null);
    expect(withWave[0]!.waveM).toBeGreaterThan(0.5);
    expect(withWave[0]!.waveM).toBeLessThan(5);
    expect(withWave.every((r) => r.source === 'FMI')).toBe(true);
  });
  it('parsuje WindGust z Harmonie → kn', () => {
    const xml = fx('fmi-harmonie-gust-2026-10-02.xml');
    const rows = parseFmiTimeValuePair(xml, 'MID', 'gust');
    const withGust = rows.filter((r) => r.gustKn != null);
    expect(withGust.length).toBeGreaterThan(3);
    expect(withGust[0]!.gustKn).toBeGreaterThan(5);
    expect(withGust[0]!.gustKn).toBeLessThan(80);
  });
});

describe('marineWeather — DMI CoverageJSON', () => {
  it('parsuje significant-wave-height i wind-speed', () => {
    const json = JSON.parse(fx('dmi-wam-nsb-2026-10-02.json'));
    const rows = parseDmiCoverageJson(json, 'MID');
    expect(rows).toHaveLength(7);
    expect(rows[0]!.waveM).toBe(1.12);
    expect(rows[3]!.gustKn).toBeCloseTo(msToKnots(9.5), 1);
    expect(rows.every((r) => r.source === 'DMI')).toBe(true);
  });
});

describe('marineWeather — SMHI ocobs', () => {
  it('parsuje boję Knolls Grund', () => {
    const json = JSON.parse(fx('smhi-ocobs-knolls-latest.json'));
    const rows = parseSmhiOcobs(json);
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows[0]!.waveM).toBe(1.18);
    expect(rows[0]!.source).toBe('SMHI');
  });
});

describe('marineWeather — progi D-39', () => {
  it('breach przy fali ≥ 3,8 m', () => {
    const ev = evaluateMarineWindow(
      [{ at: '2026-10-02T12:00:00Z', waveM: 3.9, gustKn: 20, windMs: null, periodS: null, source: 'FMI', point: 'MID' }],
      3.8,
      40,
    );
    expect(ev.breached).toBe(true);
    expect(ev.risk).toBe('wysokie');
  });
  it('breach przy porywach ≥ 40 kn', () => {
    const ev = evaluateMarineWindow(
      [{ at: '2026-10-02T12:00:00Z', waveM: 1.2, gustKn: 41, windMs: 21, periodS: null, source: 'FMI', point: 'MID' }],
      3.8,
      40,
    );
    expect(ev.breached).toBe(true);
  });
  it('podwyższone przy 75% progu; niskie poniżej', () => {
    expect(evaluateMarineWindow(
      [{ at: '2026-10-02T12:00:00Z', waveM: 3.0, gustKn: 10, windMs: null, periodS: null, source: 'FMI', point: 'MID' }],
      3.8, 40,
    ).risk).toBe('podwyższone');
    expect(evaluateMarineWindow(
      [{ at: '2026-10-02T12:00:00Z', waveM: 1.1, gustKn: 12, windMs: null, periodS: null, source: 'FMI', point: 'MID' }],
      3.8, 40,
    ).risk).toBe('niskie');
  });
  it('okno ±6 h filtruje próbki; ryzyko ma atrybucję i dedup', () => {
    const all = [
      { at: '2026-10-02T06:00:00Z', waveM: 4.0, gustKn: null, windMs: null, periodS: null, source: 'FMI' as const, point: 'MID' as const },
      { at: '2026-10-02T18:00:00Z', waveM: 1.0, gustKn: null, windMs: null, periodS: null, source: 'DMI' as const, point: 'MID' as const },
    ];
    const win = samplesInWindow(all, '2026-10-02T10:00:00Z', '2026-10-02T22:00:00Z');
    expect(win).toHaveLength(1);
    expect(win[0]!.waveM).toBe(1.0);
    const risk = marineWeatherRisk({
      sailingId: 's1',
      vessel: 'M/F Wawel',
      departureUtc: '2026-10-02T16:00:00Z',
      eval: evaluateMarineWindow(all, 3.8, 40),
      nowIso: '2026-10-02T10:00:00Z',
    });
    expect(risk.dedup).toBe('FERRY_WEATHER:s1');
    expect(risk.titleKey).toBe('rk_ferry_weather');
    expect(String(risk.detail.atrybucja)).toMatch(/FMI|DMI/);
  });
});
