/**
 * DP-231 / #859 — mapa: ucięty ferry_track_sample (ASC) nie może utrwalać starego markera
 * jako „bieżącego”, gdy w zbiorze jest świeższy punkt; ucięcie → Stan „Częściowo”.
 */
import { describe, expect, it, beforeEach } from 'vitest';
import { markersFromTrack } from '../src/lib/aisDb';
import {
  clearFerryTrackSampleTruncation,
  FERRY_TRACK_SAMPLE_LIMIT,
  ferryTrackSampleTruncatedAt,
  noteFerryTrackSampleTruncated,
  withFerryTrackTruncation,
} from '../src/lib/ferryTrackHealth';
import type { SourceRow } from '../src/lib/sysSource';
import { readFileSync } from 'node:fs';

describe('DP-231 ferry_track_sample', () => {
  beforeEach(() => clearFerryTrackSampleTruncation());

  it('markersFromTrack: przy mieszance stare/nowe bierze max(ts) (nie pierwszy z ASC)', () => {
    const old = {
      vessel_id: 'v1',
      name: 'Nova',
      mmsi: 311000787,
      lat: 54.4,
      lon: 18.7,
      observed_at: '2026-11-05T22:43:00.000Z',
      cog: 10,
      sog_kn: 12,
    };
    const neu = {
      ...old,
      lat: 55.1,
      lon: 17.9,
      observed_at: '2026-11-07T00:20:00.000Z',
    };
    /* Symulacja uciętej odpowiedzi ASC: najpierw stare, potem (gdyby weszły) nowe — max wygrywa. */
    const markers = markersFromTrack([old, neu]);
    expect(markers).toHaveLength(1);
    expect(markers[0].ts).toBe(neu.observed_at);
    expect(markers[0].lat).toBe(55.1);
  });

  it('markersFromTrack: sam ucięty ASC (tylko stare) → stary ts (RPC musi dostarczyć świeże)', () => {
    const onlyOld = Array.from({ length: 3 }, (_, i) => ({
      vessel_id: 'v1',
      name: 'Nova',
      mmsi: 311000787,
      lat: 54.4 + i * 0.01,
      lon: 18.7,
      observed_at: `2026-11-05T${String(20 + i).padStart(2, '0')}:00:00.000Z`,
      cog: 10,
      sog_kn: 12,
    }));
    const markers = markersFromTrack(onlyOld);
    expect(markers[0].ts).toBe('2026-11-05T22:00:00.000Z');
  });

  it('withFerryTrackTruncation → partial w Stanie systemu', () => {
    const base: SourceRow[] = [{
      id: 'ferry-pos',
      name: 'Pozycje promów',
      cadence: '',
      feeds: '',
      lastAt: '2026-11-07T00:00:00Z',
      state: 'ok',
      since: null,
      why: null,
      canCheck: false,
    }];
    const out = withFerryTrackTruncation(base, true);
    expect(out[0].state).toBe('partial');
    expect(out[0].why).toMatch(/ucięt/i);
  });

  it('noteFerryTrackSampleTruncated ustawia znacznik dla LiveStatus', () => {
    expect(ferryTrackSampleTruncatedAt()).toBeNull();
    noteFerryTrackSampleTruncated('2026-11-07T00:30:00Z');
    expect(ferryTrackSampleTruncatedAt()).toBe('2026-11-07T00:30:00Z');
  });

  it('aisDb: jawny .limit(FERRY_TRACK_SAMPLE_LIMIT) i flaga ucięcia', () => {
    const src = readFileSync('src/lib/aisDb.ts', 'utf8');
    expect(src).toContain('.limit(FERRY_TRACK_SAMPLE_LIMIT)');
    expect(src).toContain('noteFerryTrackSampleTruncated');
    expect(FERRY_TRACK_SAMPLE_LIMIT).toBe(1000);
  });
});
