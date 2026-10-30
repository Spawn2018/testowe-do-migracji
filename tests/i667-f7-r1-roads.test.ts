/**
 * #667 F7 r1 — B1 ROAD_KAA_E22 vs ROAD_KAA; N7 geometria bez Leaflet.
 * #667 F7 r3 B4/B5 — kaaDeviationOk sparse (SE_E22 / INLAND) + 30 pkt SE_E22 z 0298.
 * Etap #667 / decyzja właściciela 30.10 15:54.
 */
import { describe, expect, it } from 'vitest';
import {
  ROAD_KAA, ROAD_KAA_E22, roadGeometryOk, kaaDeviationOk, type LatLng,
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

/**
 * SE_E22 po 0354 F7 r3 B5 = 30 pkt z 0298 + origin HERE + Luleå E4/97.
 * (Vagnhärad 17.50/58.95 — bez niego status.sh #496 OFF_CORRIDOR fail.)
 */
const SE_E22_PROD: LatLng[] = [
  [56.1646, 15.6308],
  [56.198, 15.656],
  [56.19, 15.84],
  [56.30, 15.99],
  [56.47, 16.06],
  [56.63, 16.17],
  [56.663, 16.366],
  [56.87, 16.32],
  [57.26, 16.45],
  [57.758, 16.637],
  [57.89, 16.40],
  [58.48, 16.32],
  [58.594, 16.183],
  [58.753, 17.008],
  [58.95, 17.50], // Vagnhärad
  [59.03, 17.54],
  [59.09, 17.57],
  [59.195, 17.628],
  [59.3293, 18.0686],
  [59.8586, 17.6389],
  [60.6749, 17.1413],
  [61.7274, 17.1056],
  [62.3908, 17.3069],
  [62.6323, 17.9379],
  [63.2909, 18.7153],
  [63.8258, 20.2630],
  [64.7507, 20.9528],
  [65.3172, 21.4794],
  [65.606, 22.053],
  [65.8054, 21.7591],
];

/** SE_KAA_INLAND po 0354 — pień + Västerås + ta sama północ. */
const SE_KAA_INLAND_PROD: LatLng[] = [
  [56.1646, 15.6308],
  [56.198, 15.656],
  [56.19, 15.84],
  [56.30, 15.99],
  [56.47, 16.06],
  [56.63, 16.17],
  [56.663, 16.366],
  [56.87, 16.32],
  [57.26, 16.45],
  [57.758, 16.637],
  [57.89, 16.40],
  [58.48, 16.32],
  [58.594, 16.183],
  [58.795, 16.195],
  [58.996, 16.207],
  [59.133, 16.337],
  [59.371, 16.507],
  [59.6099, 16.5448],
  [59.9079, 16.6066],
  [60.151, 16.929],
  [60.45, 17.00],
  [60.6749, 17.1413],
  [61.7274, 17.1056],
  [62.3908, 17.3069],
  [62.6323, 17.9379],
  [63.2909, 18.7153],
  [63.8258, 20.2630],
  [64.7507, 20.9528],
  [65.3172, 21.4794],
  [65.606, 22.053],
  [65.8054, 21.7591],
];

/** ControlPts = origin + wybrane via z korytarza + destination (jak HERE). */
function ctrlFromCorridor(corridor: readonly LatLng[], idxs: number[]): LatLng[] {
  return idxs.map((i) => corridor[i]!);
}

/**
 * Linia „jak HERE”: gęsta wzdłuż korytarza + synchroniczny offset 5 km na środku
 * odcinków północnych (stara reguła 0,15×L odpada; sparse 15 km OK).
 */
function hereLikeAlong(corridor: readonly LatLng[], ctrl: readonly LatLng[]): LatLng[] {
  const dense = denseVia(corridor, 2);
  return dense.map(([lat, lng]) => {
    if (lat < 61 || lat > 64.5) return [lat, lng] as LatLng;
    const nearCtrl = ctrl.some(([cLat, cLng]) =>
      Math.hypot((lat - cLat) * 111, (lng - cLng) * 55) <= 3,
    );
    if (nearCtrl) return [lat, lng] as LatLng;
    return [lat, lng + 0.09] as LatLng; // ~5 km E
  });
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

describe('#667 F7 r3 B4/B5 kaaDeviationOk sparse + SE_E22 30 pkt', () => {
  it('SE_E22 ma 30 wierzchołków (0298); origin HERE + Vagnhärad + Luleå E4', () => {
    expect(SE_E22_PROD).toHaveLength(30);
    expect(SE_E22_PROD[0]).toEqual([56.1646, 15.6308]);
    expect(SE_E22_PROD.some(([lat, lng]) => Math.abs(lat - 58.95) < 0.01 && Math.abs(lng - 17.50) < 0.01)).toBe(true);
    expect(SE_E22_PROD.some(([lat, lng]) => Math.abs(lat - 65.606) < 0.01 && Math.abs(lng - 22.053) < 0.01)).toBe(true);
    expect(SE_E22_PROD.some(([lat, lng]) => Math.abs(lat - 65.5848) < 0.01 && Math.abs(lng - 22.1547) < 0.01)).toBe(false);
  });

  it('linia HERE-like wzdłuż SE_E22 przechodzi sparse (controlPts + 15 km)', () => {
    const ctrl = ctrlFromCorridor(SE_E22_PROD, [0, 12, 18, 20, 22, 29]);
    const line = hereLikeAlong(SE_E22_PROD, ctrl);
    expect(kaaDeviationOk(line, SE_E22_PROD, { sparseCorridor: true, controlPts: ctrl })).toBe(true);
    // stara reguła śladu — offset 5 km na północy > max(2, 0.15×odcinek)
    expect(kaaDeviationOk(line, SE_E22_PROD)).toBe(false);
  });

  it('linia HERE-like wzdłuż SE_KAA_INLAND przechodzi sparse', () => {
    expect(SE_KAA_INLAND_PROD.length).toBeGreaterThanOrEqual(30);
    const ctrl = ctrlFromCorridor(SE_KAA_INLAND_PROD, [0, 12, 17, 21, 23, 30]);
    const line = hereLikeAlong(SE_KAA_INLAND_PROD, ctrl);
    expect(kaaDeviationOk(line, SE_KAA_INLAND_PROD, { sparseCorridor: true, controlPts: ctrl })).toBe(true);
  });

  it('negatyw: linia przez Jönköping / E4 zachodnią odpada (objazd regionu)', () => {
    const west: LatLng[] = [
      [56.1646, 15.6308],
      [56.66, 16.37],
      [57.78, 14.16], // Jönköping — daleko od E22/E4 wybrzeża
      [59.27, 15.21], // Örebro
      [60.67, 17.14],
      [62.39, 17.31],
      [65.8054, 21.7591],
    ];
    const line = denseVia(west, 2);
    const e22Ctrl = ctrlFromCorridor(SE_E22_PROD, [0, 12, 18, 20, 22, 29]);
    const inlandCtrl = ctrlFromCorridor(SE_KAA_INLAND_PROD, [0, 12, 17, 21, 23, 30]);
    expect(kaaDeviationOk(line, SE_E22_PROD, { sparseCorridor: true, controlPts: e22Ctrl })).toBe(false);
    expect(kaaDeviationOk(line, SE_KAA_INLAND_PROD, { sparseCorridor: true, controlPts: inlandCtrl })).toBe(false);
  });

  it('SE_KAA_TRACK (bez sparse): stara reguła — dense OK, równoległa >2 km nie', () => {
    const dense = denseVia(SE_E22_PROD.slice(0, 8), 0.5);
    expect(kaaDeviationOk(dense, dense)).toBe(true);
    const parallel = dense.map(([lat, lng]) => [lat, lng + 0.18] as LatLng);
    expect(kaaDeviationOk(parallel, dense)).toBe(false);
  });
});
