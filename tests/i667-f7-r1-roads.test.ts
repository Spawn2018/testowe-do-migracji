/**
 * #667 F7 r1 — B1 ROAD_KAA_E22 vs ROAD_KAA; N7 geometria bez Leaflet (applyBasemap ciągnie L).
 * checkRoads / SPEC — i667-orange-roads (źródło). B2 ZonesMap — tamże.
 * Etap #667 / decyzja właściciela 30.10 15:54.
 */
import { describe, expect, it } from 'vitest';
import {
  ROAD_KAA, ROAD_KAA_E22, roadGeometryOk, type LatLng,
} from '../supabase/functions/_shared/map/draw';

/** Gęsta łamana przez punkty kontrolne (jak bmapa denseVia). */
function denseVia(pts: readonly LatLng[], stepKm: number): LatLng[] {
  const out: LatLng[] = [];
  for (let i = 0; i < pts.length - 1; i += 1) {
    const [aLat, aLng] = pts[i]!;
    const [bLat, bLng] = pts[i + 1]!;
    const dLat = bLat - aLat;
    const dLng = bLng - aLng;
    const dist = Math.hypot(dLat * 111, dLng * 55);
    const n = Math.max(1, Math.ceil(dist / stepKm));
    for (let k = 0; k < n; k += 1) {
      out.push([aLat + (dLat * k) / n, aLng + (dLng * k) / n]);
    }
  }
  out.push(pts[pts.length - 1]!);
  return out;
}

describe('#667 F7 r1 B1 SE-KAA bez Västerås', () => {
  const e22Corridor: LatLng[] = [
    [56.1646, 15.6308],
    [58.59, 16.18],
    [59.33, 18.05], // Sztokholm — daleko od Västerås
    [60.67, 17.14],
    [62.39, 17.31],
    [65.80539, 21.75914],
  ];

  it('geometria E22 przechodzi ROAD_KAA_E22, odpada ROAD_KAA (Västerås)', () => {
    const line = denseVia(e22Corridor, 0.4);
    expect(roadGeometryOk(line, ROAD_KAA_E22)).toBe(true);
    expect(roadGeometryOk(line, ROAD_KAA)).toBe(false);
  });

  it('ROAD_KAA_E22 nie wymaga Västerås; ROAD_KAA tak', () => {
    expect(ROAD_KAA_E22.via.some((v) => Math.abs(v.lat - 59.61) < 0.01 && Math.abs(v.lng - 16.54) < 0.01)).toBe(false);
    expect(ROAD_KAA.via.some((v) => Math.abs(v.lat - 59.61) < 0.01 && Math.abs(v.lng - 16.54) < 0.01)).toBe(true);
    expect(ROAD_KAA_E22.via.some((v) => Math.abs(v.lat - 59.33) < 0.05 && Math.abs(v.lng - 18.05) < 0.1)).toBe(true);
  });
});
