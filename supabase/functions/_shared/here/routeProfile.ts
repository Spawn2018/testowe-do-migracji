/**
 * H-8 A — profil wysokości / nachylenia Routing v8.
 * Standardowy truck bez vehicle[*] dopóki H1/H3 (D-83) wyłączone.
 * Po D-83: te same URL-e z wymiarami + notices.
 */
import { CORRIDOR_LEGS, type CorridorLegName } from './corridorObstacles.ts';
import type { CompleteDims } from './routeCheck.ts';

export type ProfilePoint = { i: number; elevM: number; gradePct: number | null };

export function buildRouteProfileUrl(args: {
  apiKey: string;
  origin: readonly [number, number];
  destination: readonly [number, number];
  /** Po D-83 — gdy H1/H3 włączone i wymiary kompletne. */
  dims?: CompleteDims | null;
  withNotices?: boolean;
}): string {
  const q = new URLSearchParams();
  q.set('transportMode', 'truck');
  q.set('origin', `${args.origin[0]},${args.origin[1]}`);
  q.set('destination', `${args.destination[0]},${args.destination[1]}`);
  q.set('return', 'polyline,summary,elevation');
  q.set('departureTime', 'any');
  q.set('lang', 'pl-PL');
  q.set('apiKey', args.apiKey);
  if (args.withNotices && args.dims) {
    q.set('spans', 'notices,names,length,streetAttributes,truckAttributes');
    q.set('vehicle[height]', String(Math.round(args.dims.heightM * 100)));
    q.set('vehicle[width]', String(Math.round(args.dims.widthM * 100)));
    q.set('vehicle[length]', String(Math.round(args.dims.lengthM * 100)));
    q.set('vehicle[grossWeight]', String(Math.round(args.dims.weightT * 1000)));
    q.set('vehicle[currentWeight]', String(Math.round(args.dims.weightT * 1000)));
    q.set('vehicle[axleCount]', String(args.dims.axleCount));
    q.set('vehicle[weightPerAxle]', String(Math.round(args.dims.axleLoadT * 1000)));
  }
  return `https://router.hereapi.com/v8/routes?${q.toString()}`;
}

/** Wybór odcinków jak w H-3 — pełny korytarz PL+SE (4 nogi). */
export function profileLegs(): typeof CORRIDOR_LEGS {
  return CORRIDOR_LEGS;
}

export function pickLegsForRoute(route: string | null | undefined): CorridorLegName[] {
  const r = (route ?? '').toUpperCase();
  const out: CorridorLegName[] = [];
  if (r.includes('GDY')) out.push('PL-GDY');
  else out.push('PL-GDN');
  if (r.includes('KARLSKRONA') || r.includes('KAA')) out.push('SE-KAA');
  else out.push('SE-NYN');
  return out;
}

/** Elevation z odpowiedzi HERE (section.elevation[] albo spans). */
export function extractElevations(body: unknown): number[] {
  const elev: number[] = [];
  const routes = (body as { routes?: Array<{ sections?: Array<Record<string, unknown>> }> })?.routes ?? [];
  for (const route of routes) {
    for (const section of route.sections ?? []) {
      const e = section.elevation;
      if (Array.isArray(e)) {
        for (const v of e) {
          const n = Number(v);
          if (Number.isFinite(n)) elev.push(n);
        }
      }
    }
  }
  return elev;
}

export function summarizeElevation(elev: number[]): {
  points: ProfilePoint[];
  minM: number | null;
  maxM: number | null;
  maxGradePct: number | null;
  samples: number;
} {
  if (!elev.length) {
    return { points: [], minM: null, maxM: null, maxGradePct: null, samples: 0 };
  }
  const points: ProfilePoint[] = [];
  let maxGrade: number | null = null;
  for (let i = 0; i < elev.length; i++) {
    let grade: number | null = null;
    if (i > 0) {
      // Przybliżenie: 1 punkt ≈ ~equal spacing; grade = Δh / 1 (względne %) — raportujemy Δh między sąsiadami
      const dh = elev[i]! - elev[i - 1]!;
      grade = Math.round(dh * 10) / 10; // metry różnicy jako „ostrość” lokalna; UI pokazuje max |Δh|
      if (maxGrade == null || Math.abs(grade) > Math.abs(maxGrade)) maxGrade = grade;
    }
    points.push({ i, elevM: elev[i]!, gradePct: grade });
  }
  return {
    points: points.filter((_, idx) => idx % Math.max(1, Math.floor(points.length / 40)) === 0 || idx === points.length - 1),
    minM: Math.min(...elev),
    maxM: Math.max(...elev),
    maxGradePct: maxGrade,
    samples: elev.length,
  };
}
