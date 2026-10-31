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

/** Haversine km — jak SQL `geography` / F7 r5 B4-test (b). */
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

function segKm(a: LatLng, b: LatLng): number {
  return havKm(a, b);
}

/** Jak `here_corridor_via_points`: via co ~100 km = najbliższy wierzchołek śladu (nie cięciwa). */
function viaAlongCorridor(pts: readonly LatLng[], pMax = 14): LatLng[] {
  if (pts.length < 2) return [...pts];
  const steps = pts.map((p, i) => (i === 0 ? 0 : segKm(pts[i - 1]!, p)));
  const cum: number[] = [];
  let s = 0;
  for (const d of steps) {
    s += d;
    cum.push(s);
  }
  const lenKm = cum[cum.length - 1]!;
  let n = Math.min(pMax, Math.max(0, Math.floor(lenKm / 100) - 1));
  if (n < 1 && lenKm >= 200) n = 1;
  const vias: LatLng[] = [];
  for (let i = 1; i <= n; i += 1) {
    const target = (lenKm * i) / (n + 1);
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

  it('F7 r6 B4-test (b): viaAlongCorridor (haversine) = lista po przesunięciu na E4', () => {
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
