/**
 * #667 F7 r1 — B1 ROAD_KAA_E22 vs ROAD_KAA; N7 geometria bez Leaflet.
 * #667 F7 r3–r6 B4/B5/B7 — kaaDeviationOk sparse + dens. + via na E4;
 * F7 r6: korytarze z 0354 (st_makepoint); Umeå/Piteå/Sundsvall na jezdni E4.
 * Etap #667 / decyzja właściciela 30.10 15:54.
 */
import { readFileSync } from 'node:fs';
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
    const dist = havKm(pts[i]!, pts[i + 1]!);
    const n = Math.max(1, Math.ceil(dist / stepKm));
    for (let k = 0; k < n; k += 1) {
      out.push([aLat + (dLat * k) / n, aLng + (dLng * k) / n]);
    }
  }
  out.push(pts[pts.length - 1]!);
  return out;
}

/** Haversine km — gęsta łamana / odchyłka (nie via SQL). */
function havKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const toR = (d: number) => (d * Math.PI) / 180;
  const dLat = toR(b[0] - a[0]);
  const dLng = toR(b[1] - a[1]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toR(a[0])) * Math.cos(toR(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Vincenty WGS84 (m) — jak PostGIS `geography` / `here_corridor_via_points` (DP-38). */
function geodesicM(a: LatLng, b: LatLng): number {
  const toR = (d: number) => (d * Math.PI) / 180;
  const aLat = toR(a[0]);
  const aLon = toR(a[1]);
  const bLat = toR(b[0]);
  const bLon = toR(b[1]);
  const f = 1 / 298.257223563;
  const A = 6378137;
  const B = 6356752.314245;
  const L = bLon - aLon;
  const U1 = Math.atan((1 - f) * Math.tan(aLat));
  const U2 = Math.atan((1 - f) * Math.tan(bLat));
  const sinU1 = Math.sin(U1);
  const cosU1 = Math.cos(U1);
  const sinU2 = Math.sin(U2);
  const cosU2 = Math.cos(U2);
  let lam = L;
  let lamP = 0;
  let iter = 0;
  let sinLam = 0;
  let cosLam = 0;
  let sinSig = 0;
  let cosSig = 0;
  let sig = 0;
  let sinAlpha = 0;
  let cos2A = 0;
  let cos2SigM = 0;
  let C = 0;
  do {
    sinLam = Math.sin(lam);
    cosLam = Math.cos(lam);
    sinSig = Math.sqrt(
      (cosU2 * sinLam) ** 2 + (cosU1 * sinU2 - sinU1 * cosU2 * cosLam) ** 2,
    );
    if (sinSig === 0) return 0;
    cosSig = sinU1 * sinU2 + cosU1 * cosU2 * cosLam;
    sig = Math.atan2(sinSig, cosSig);
    sinAlpha = (cosU1 * cosU2 * sinLam) / sinSig;
    cos2A = 1 - sinAlpha * sinAlpha;
    cos2SigM = cos2A !== 0 ? cosSig - (2 * sinU1 * sinU2) / cos2A : 0;
    C = (f / 16) * cos2A * (4 + f * (4 - 3 * cos2A));
    lamP = lam;
    lam =
      L +
      (1 - C) *
        f *
        sinAlpha *
        (sig +
          C *
            sinSig *
            (cos2SigM + C * cosSig * (-1 + 2 * cos2SigM * cos2SigM)));
  } while (Math.abs(lam - lamP) > 1e-12 && ++iter < 200);
  const u2 = (cos2A * (A * A - B * B)) / (B * B);
  const Aa = 1 + (u2 / 16384) * (4096 + u2 * (-768 + u2 * (320 - 175 * u2)));
  const Bb = (u2 / 1024) * (256 + u2 * (-128 + u2 * (74 - 47 * u2)));
  const dSig =
    Bb *
    sinSig *
    (cos2SigM +
      (Bb / 4) *
        (cosSig * (-1 + 2 * cos2SigM * cos2SigM) -
          (Bb / 6) *
            cos2SigM *
            (-3 + 4 * sinSig * sinSig) *
            (-3 + 4 * cos2SigM * cos2SigM)));
  return B * Aa * (sig - dSig);
}

/** Jak `here_corridor_via_points`: via co ~100 km = najbliższy wierzchołek śladu (metry geodezyjne). */
function viaAlongCorridor(pts: readonly LatLng[], pMax = 14): LatLng[] {
  if (pts.length < 2) return [...pts];
  const steps = pts.map((p, i) => (i === 0 ? 0 : geodesicM(pts[i - 1]!, p)));
  const cum: number[] = [];
  let s = 0;
  for (const d of steps) {
    s += d;
    cum.push(s);
  }
  const lenM = cum[cum.length - 1]!;
  let n = Math.min(pMax, Math.max(0, Math.floor(lenM / 100_000) - 1));
  if (n < 1 && lenM >= 200_000) n = 1;
  const vias: LatLng[] = [];
  for (let i = 1; i <= n; i += 1) {
    const target = (lenM * i) / (n + 1);
    let best = 0;
    let bestAbs = Infinity;
    for (let j = 0; j < cum.length; j += 1) {
      const a = Math.abs(cum[j]! - target);
      if (a < bestAbs) {
        bestAbs = a;
        best = j;
      }
    }
    vias.push(pts[best]!);
  }
  return [pts[0]!, ...vias, pts[pts.length - 1]!];
}

/** F7 r6 uwaga 2: korytarz z pliku 0354 (parsowanie `st_makepoint`), nie ręczna kopia. */
function corridorFrom0354(code: 'SE_E22' | 'SE_KAA_INLAND'): LatLng[] {
  const sql = readFileSync(
    new URL('../supabase/migrations/0354_667_kaa_corridor_lulea.sql', import.meta.url),
    'utf8',
  );
  const marker = `where code = '${code}'`;
  const idx = sql.indexOf(marker);
  if (idx < 0) throw new Error(`brak ${code} w 0354`);
  const before = sql.slice(0, idx);
  const start = before.lastIndexOf('st_makeline(array[');
  if (start < 0) throw new Error(`brak st_makeline dla ${code}`);
  const end = before.indexOf(']), 4326)', start);
  if (end < 0) throw new Error(`brak końca array dla ${code}`);
  const body = before.slice(start + 'st_makeline(array['.length, end);
  const pts: LatLng[] = [];
  for (const pm of body.matchAll(/st_makepoint\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)/g)) {
    pts.push([Number(pm[2]), Number(pm[1])]);
  }
  if (pts.length < 8) throw new Error(`${code}: za mało punktów (${pts.length})`);
  return pts;
}

const SE_E22_PROD = corridorFrom0354('SE_E22');
const SE_KAA_INLAND_PROD = corridorFrom0354('SE_KAA_INLAND');

/** SE_E22 sprzed densyfikacji r4 (bez 21.2932/64.3511) — do asercji negatywnej. */
const SE_E22_BEFORE_R4: LatLng[] = SE_E22_PROD.filter(
  ([lat, lng]) => !(Math.abs(lat - 64.3511) < 1e-6 && Math.abs(lng - 21.2932) < 1e-6),
);

/** ControlPts = origin + via z logiki here_corridor_via_points + destination. */
function ctrlFromViaLogic(corridor: readonly LatLng[]): LatLng[] {
  return viaAlongCorridor(corridor, 14);
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
      havKm([lat, lng], [cLat, cLng]) <= 3,
    );
    if (nearCtrl) return [lat, lng] as LatLng;
    return [lat, lng + 0.09] as LatLng; // ~5 km E
  });
}

/** Pełna linia akceptacyjna: gęsty pień E22 + północ z fixture HERE SE-NYN (prod). */
function hereLineFromFixture(corridorSouth: readonly LatLng[]): LatLng[] {
  const fix = JSON.parse(
    readFileSync(new URL('./fixtures/se-nyn-north-here.json', import.meta.url), 'utf8'),
  ) as { northHere: LatLng[] };
  const south = denseVia(
    corridorSouth.filter(([lat]) => lat < 63.2),
    3,
  );
  return [...south, ...fix.northHere];
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

describe('#667 F7 r3–r6 B4/B5/B7 kaaDeviationOk — korytarze z 0354', () => {
  it('0354 SE_E22: dens. + Uppsala E4 + Umeå/Piteå/Sundsvall na jezdni (F7 r6)', () => {
    expect(SE_E22_PROD).toHaveLength(31);
    expect(SE_E22_PROD[0]).toEqual([56.1646, 15.6308]);
    expect(SE_E22_PROD.some(([lat, lng]) => Math.abs(lat - 58.95) < 0.01 && Math.abs(lng - 17.50) < 0.01)).toBe(true);
    expect(SE_E22_PROD.some(([lat, lng]) => Math.abs(lat - 65.606) < 0.01 && Math.abs(lng - 22.053) < 0.01)).toBe(true);
    expect(SE_E22_PROD.some(([lat, lng]) => Math.abs(lat - 64.3511) < 1e-4 && Math.abs(lng - 21.2932) < 1e-4)).toBe(true);
    expect(SE_E22_PROD.some(([lat, lng]) => Math.abs(lat - 59.8767) < 1e-4 && Math.abs(lng - 17.6953) < 1e-4)).toBe(true);
    // F7 r6: stare punkty poza E4 usunięte
    expect(SE_E22_PROD.some(([lat, lng]) => Math.abs(lat - 63.8258) < 1e-4 && Math.abs(lng - 20.2630) < 1e-4)).toBe(false);
    expect(SE_E22_PROD.some(([lat, lng]) => Math.abs(lat - 65.3172) < 1e-4 && Math.abs(lng - 21.4794) < 1e-4)).toBe(false);
    expect(SE_E22_PROD.some(([lat, lng]) => Math.abs(lat - 62.3908) < 1e-4 && Math.abs(lng - 17.3069) < 1e-4)).toBe(false);
    // F7 r6: nowe na E4 / HERE
    expect(SE_E22_PROD.some(([lat, lng]) => Math.abs(lat - 63.8127) < 1e-4 && Math.abs(lng - 20.3263) < 1e-4)).toBe(true);
    expect(SE_E22_PROD.some(([lat, lng]) => Math.abs(lat - 65.3232) < 1e-4 && Math.abs(lng - 21.4319) < 1e-4)).toBe(true);
    expect(SE_E22_PROD.some(([lat, lng]) => Math.abs(lat - 62.391) < 1e-4 && Math.abs(lng - 17.340) < 1e-4)).toBe(true);
  });

  it('F7 r6 B4-test (b): viaAlongCorridor (geodezja) = lista SQL po przesunięciu na E4', () => {
    const via = viaAlongCorridor(SE_E22_PROD, 14);
    const expected: LatLng[] = [
      [56.1646, 15.6308],
      [56.865, 16.385],
      [57.89, 16.4],
      [58.594, 16.183],
      [59.195, 17.628],
      [59.8767, 17.6953],
      [60.6638, 17.109],
      [61.7279, 17.065],
      [62.6323, 17.9379],
      [63.2909, 18.7153],
      [64.3511, 21.2932],
      [64.7507, 20.9528],
      [65.8054, 21.7591],
    ];
    expect(via).toHaveLength(expected.length);
    for (let i = 0; i < via.length; i += 1) {
      expect(via[i]![0]).toBeCloseTo(expected[i]![0], 3);
      expect(via[i]![1]).toBeCloseTo(expected[i]![1], 3);
    }
  });

  // DP-38 / F7 #673 r7: haversine brał 9. via 63.2909 (remis ~49 km do celu);
  // geodezja WGS84 jak SQL `geography` → 63.8127 (Umeå E4).
  it('DP-38: viaAlongCorridor INLAND = lista jak SQL (geodezja, nie haversine)', () => {
    const via = viaAlongCorridor(SE_KAA_INLAND_PROD, 14);
    const expected: LatLng[] = [
      [56.1646, 15.6308],
      [56.865, 16.385],
      [57.755, 16.58],
      [58.594, 16.183],
      [59.371, 16.507],
      [60.151, 16.929],
      [60.6638, 17.109],
      [62.391, 17.34],
      [62.6323, 17.9379],
      [63.8127, 20.3263],
      [64.3511, 21.2932],
      [64.7507, 20.9528],
      [65.8054, 21.7591],
    ];
    expect(via).toHaveLength(expected.length);
    for (let i = 0; i < via.length; i += 1) {
      expect(via[i]![0]).toBeCloseTo(expected[i]![0], 3);
      expect(via[i]![1]).toBeCloseTo(expected[i]![1], 3);
    }
    // Regresja haversine: 9. via nie wraca na Örnsköldsvik.
    expect(via[9]![0]).toBeCloseTo(63.8127, 3);
    expect(Math.abs(via[9]![0]! - 63.2909)).toBeGreaterThan(0.1);
  });

  it('linia HERE-like wzdłuż SE_E22 przechodzi sparse (controlPts + 15 km)', () => {
    const ctrl = ctrlFromViaLogic(SE_E22_PROD);
    const line = hereLikeAlong(SE_E22_PROD, ctrl);
    expect(kaaDeviationOk(line, SE_E22_PROD, { sparseCorridor: true, controlPts: ctrl })).toBe(true);
    expect(kaaDeviationOk(line, SE_E22_PROD)).toBe(false);
  });

  it('linia HERE-like wzdłuż SE_KAA_INLAND przechodzi sparse', () => {
    expect(SE_KAA_INLAND_PROD.length).toBeGreaterThanOrEqual(32);
    const ctrl = ctrlFromViaLogic(SE_KAA_INLAND_PROD);
    const line = hereLikeAlong(SE_KAA_INLAND_PROD, ctrl);
    expect(kaaDeviationOk(line, SE_KAA_INLAND_PROD, { sparseCorridor: true, controlPts: ctrl })).toBe(true);
  });

  it('F7 r5 uwaga 1: wierzchołek INLAND 16.120/59.279 w korytarzu (OSRM; odbiór SELECT po wdrożeniu)', () => {
    expect(SE_KAA_INLAND_PROD.some(([lat, lng]) => Math.abs(lat - 59.279) < 1e-4 && Math.abs(lng - 16.120) < 1e-4)).toBe(true);
  });

  it('F7 r6 B4-test (a): fixture SE-NYN + korytarze z 0354 — pada bez dens., przechodzi po r4/r6', () => {
    const line = hereLineFromFixture(SE_E22_PROD);
    const ctrlOld = ctrlFromViaLogic(SE_E22_BEFORE_R4);
    const ctrlNew = ctrlFromViaLogic(SE_E22_PROD);
    expect(kaaDeviationOk(line, SE_E22_BEFORE_R4, { sparseCorridor: true, controlPts: ctrlOld })).toBe(false);
    expect(kaaDeviationOk(line, SE_E22_PROD, { sparseCorridor: true, controlPts: ctrlNew })).toBe(true);
    const inlandCtrl = ctrlFromViaLogic(SE_KAA_INLAND_PROD);
    const inlandLine = hereLineFromFixture(SE_KAA_INLAND_PROD);
    expect(kaaDeviationOk(inlandLine, SE_KAA_INLAND_PROD, { sparseCorridor: true, controlPts: inlandCtrl })).toBe(true);
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
    const e22Ctrl = ctrlFromViaLogic(SE_E22_PROD);
    const inlandCtrl = ctrlFromViaLogic(SE_KAA_INLAND_PROD);
    expect(kaaDeviationOk(line, SE_E22_PROD, { sparseCorridor: true, controlPts: e22Ctrl })).toBe(false);
    expect(kaaDeviationOk(line, SE_KAA_INLAND_PROD, { sparseCorridor: true, controlPts: inlandCtrl })).toBe(false);
  });

  it('negatyw: Norwegia (zachód) odpada dla E22 i INLAND (F7 r5 uwaga 2)', () => {
    const no: LatLng[] = [
      [56.1646, 15.6308],
      [58.0, 11.5],
      [60.0, 10.5],
      [63.0, 10.0],
      [65.8054, 21.7591],
    ];
    const line = denseVia(no, 2);
    const e22Ctrl = ctrlFromViaLogic(SE_E22_PROD);
    const inlandCtrl = ctrlFromViaLogic(SE_KAA_INLAND_PROD);
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
