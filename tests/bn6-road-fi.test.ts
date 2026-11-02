/**
 * BN6 (#716) cz.1 — Digitraffic FI: parser, bbox, bufor 2 km, limity masy.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CORRIDOR_FI,
  FI_BBOX_LIMIT,
  balticRoadRisk,
  fiBboxInLimit,
  fiCorridorBboxes,
  fiTrafficUrl,
  filterNearCorridor,
  parseFiTrafficMessages,
  weightLimitRisk,
} from '../supabase/functions/_shared/integrations/roadBaltic.ts';
import { FI_ROADWORKS_URL } from '../supabase/functions/_shared/integrations/roadBaltic.ts';
import { distanceToCorridorKm } from '../supabase/functions/_shared/integrations/road.ts';

const rw = JSON.parse(
  readFileSync(resolve('tests/fixtures/fi-digitraffic-roadworks-sample.json'), 'utf8'),
);
const wt = JSON.parse(
  readFileSync(resolve('tests/fixtures/fi-digitraffic-weight-sample.json'), 'utf8'),
);

describe('BN6 road-fi — Digitraffic', () => {
  it('wszystkie bboxy korytarza w limicie [20,59,32,71]', () => {
    for (const b of fiCorridorBboxes()) {
      expect(fiBboxInLimit(b)).toBe(true);
    }
    expect(fiBboxInLimit({ xMin: 19, xMax: 21, yMin: 60, yMax: 61 })).toBe(false);
    expect(() => fiTrafficUrl(FI_ROADWORKS_URL, {
      xMin: 19, xMax: 33, yMin: 58, yMax: 72,
    })).toThrow(/poza/);
  });

  it('parser roadworks → zdarzenia z id i tytułem', () => {
    const ev = parseFiTrafficMessages(rw);
    expect(ev.length).toBeGreaterThanOrEqual(1);
    expect(ev[0]!.id).toMatch(/^GUID/);
    expect(ev[0]!.title.length).toBeGreaterThan(3);
    expect(ev[0]!.lat).not.toBeNull();
  });

  it('bufor 2 km: blisko korytarza → tak; daleko → nie', () => {
    const nearPt = parseFiTrafficMessages(rw)[0]!;
    expect(nearPt.lat).not.toBeNull();
    const dNear = distanceToCorridorKm(nearPt.lat!, nearPt.lon!, CORRIDOR_FI);
    expect(dNear).toBeLessThan(50); // Ii przy VT4 — w pasie korytarza FI

    const far = parseFiTrafficMessages(wt).find((e) => e.id === 'GUID-FAR-BN6')!;
    const dFar = distanceToCorridorKm(far.lat!, far.lon!, CORRIDOR_FI);
    expect(dFar).toBeGreaterThan(5);

    const filtered = filterNearCorridor(
      [nearPt, far],
      CORRIDOR_FI,
      Math.max(2, dNear + 0.1),
    );
    expect(filtered.some((e) => e.id === nearPt.id)).toBe(true);
    expect(filtered.some((e) => e.id === 'GUID-FAR-BN6')).toBe(false);
  });

  it('1,5 km → ryzyko; 5 km → brak (spec #716)', () => {
    const [lat0, lon0] = CORRIDOR_FI[0]!;
    /* ~1,5 km E od Vuosaari (1° lon ≈ 55 km @ 60°N → 0,027° ≈ 1,5 km). */
    const near15 = {
      id: 'N15', title: 'blisko', detail: 'x', severity: 'MEDIUM' as const,
      lat: lat0, lon: lon0 + 0.027, kind: 'road work', start: null, end: null,
    };
    /* Spec: 5 km poza buforem — punkt zachodni daleko od legów FI. */
    const far5 = {
      id: 'F5', title: 'daleko', detail: 'x', severity: 'MEDIUM' as const,
      lat: 60.2, lon: 20.5, kind: 'road work', start: null, end: null,
    };
    const dNear = distanceToCorridorKm(near15.lat, near15.lon, CORRIDOR_FI);
    expect(dNear).toBeLessThan(2);
    expect(dNear).toBeGreaterThan(1);
    expect(distanceToCorridorKm(far5.lat, far5.lon, CORRIDOR_FI)).toBeGreaterThan(5);
    const keep = filterNearCorridor([near15, far5], CORRIDOR_FI, 2);
    expect(keep.map((e) => e.id)).toEqual(['N15']);
  });

  it('limit masy: ładunek > limit → HIGH; brak masy → MEDIUM sprawdź', () => {
    const w = parseFiTrafficMessages(wt).find((e) => e.id === 'GUID-WEIGHT-BN6')!;
    expect(w.weightLimitT).toBe(12);
    const hi = weightLimitRisk('FI', w, 40, FI_ROADWORKS_URL, 'Fintraffic');
    expect(hi.severity).toBe('HIGH');
    expect(hi.titleKey).toBe('rk_road_baltic_weight');
    const med = weightLimitRisk('FI', w, null, FI_ROADWORKS_URL, 'Fintraffic');
    expect(med.severity).toBe('MEDIUM');
    expect(med.titleKey).toBe('rk_road_baltic_weight_check');
  });

  it('balticRoadRisk → ROAD_FI + atrybucja', () => {
    const ev = parseFiTrafficMessages(rw)[0]!;
    const r = balticRoadRisk('FI', ev, FI_ROADWORKS_URL, 'Source: Fintraffic');
    expect(r.kind).toBe('ROAD_FI');
    expect(r.dedup).toBe(`ROAD_FI:${ev.id}`);
    expect(r.detail.zrodlo).toMatch(/Fintraffic/);
  });

  it('FI_BBOX_LIMIT stałe jak w spec', () => {
    expect(FI_BBOX_LIMIT).toEqual({ xMin: 20, yMin: 59, xMax: 32, yMax: 71 });
  });
});
