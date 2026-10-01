import { describe, expect, it } from 'vitest';
import {
  CORRIDOR_PL,
  CORRIDOR_SE,
  OSM_ATTRIBUTION,
  corridorLengthKm,
  corridorProgress,
  distanceToCorridorKm,
  driveHoursRemaining,
} from '../src/lib/corridor';

describe('II-7 corridor OSM', () => {
  it('PL i SE mają długość > 100 km', () => {
    expect(corridorLengthKm(CORRIDOR_PL)).toBeGreaterThan(100);
    expect(corridorLengthKm(CORRIDOR_SE)).toBeGreaterThan(100);
  });

  it('punkt na E4: remainingFrac w (0,1), blisko linii', () => {
    const p = corridorProgress(63.5, 19.5, CORRIDOR_SE);
    expect(p.remainingFrac).toBeGreaterThan(0.05);
    expect(p.remainingFrac).toBeLessThan(0.95);
    expect(p.offM).toBeLessThan(30_000);
  });

  it('start PL ≈ remainingFrac 1; koniec ≈ 0', () => {
    const start = corridorProgress(52.0739, 17.0246, CORRIDOR_PL);
    const end = corridorProgress(54.4037, 18.6813, CORRIDOR_PL);
    expect(start.remainingFrac).toBeGreaterThan(0.95);
    expect(end.remainingFrac).toBeLessThan(0.05);
  });

  it('>2 km od korytarza (poznań-zachód)', () => {
    expect(distanceToCorridorKm(52.0, 14.0, CORRIDOR_PL)).toBeGreaterThan(2);
  });

  it('tempo: połowa SE × 17 h × 1.15', () => {
    const total = corridorLengthKm(CORRIDOR_SE);
    const h = driveHoursRemaining(total / 2, total, 17, 1.15);
    expect(h).toBeCloseTo(17 * 0.5 * 1.15, 5);
  });

  it('attribution ODbL', () => {
    expect(OSM_ATTRIBUTION).toContain('OpenStreetMap');
  });
});
