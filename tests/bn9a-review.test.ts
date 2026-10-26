/**
 * BN9-a — poprawki po recenzji PR #575: armatorzy awizacji tylko z danymi, ta sama reguła wyboru rejsu dla Steny i
 * Polferries co przed katalogiem, odprawa z katalogu, tory wodne nowych przepraw po wodzie.
 */
import { describe, expect, it } from 'vitest';
import {
  awizacjaOperators, earliestFerryDepartureMs, operatorMatches, PORT_CLEARANCE_H, reachableSailings, STENA_PORT_CLEARANCE_H,
} from '../src/lib/awizacjaState';
import { clearanceHoursFor, FERRY_ROUTE_CODES } from '../src/lib/ferryCatalog';
import { effArrival, effDeparture, hasDeparted, historicalSailings, selectableSailings } from '../src/lib/sailings';
import { WATER_TRACKS_EXTRA } from '../src/lib/map/ferryLines';
import { zoneRouteOptions } from '../src/lib/p8cZones';
import type { Load, Sailing } from '../src/types';

const NOW_ISO = '2026-10-26T08:00:00Z';

function S(p: Partial<Sailing> & Pick<Sailing, 'id' | 'route' | 'departureAt'>): Sailing {
  return {
    vessel: 'Statek', arrivalAt: p.departureAt, delayedDepartureAt: null, delayedArrivalAt: null,
    status: 'ZAPLANOWANY', source: 'RECZNIE', ...p,
  };
}

describe('awizacja — lista armatorów', () => {
  const pf = S({ id: 'pf', route: 'GDN-NYN', departureAt: '2026-10-27T16:00:00Z', source: 'POLFERRIES' });
  const st = S({ id: 'st', route: 'GDY-KAA', departureAt: '2026-10-27T19:00:00Z', source: 'STENA' });
  it('dzisiejsze dane: dokładnie Polferries i Stena, w tej kolejności', () => {
    expect(awizacjaOperators([pf, st]).map((o) => o.id)).toEqual(['POLFERRIES', 'STENA']);
    expect(awizacjaOperators([]).map((o) => o.label)).toEqual(['Polferries', 'Stena Line']);
  });
  it('z rejsem Vikinga — trzy; powrót albo dane startowe nie dodają armatora', () => {
    const vk = S({ id: 'vk', route: 'TLL-HEL', departureAt: '2026-10-27T10:00:00Z', operator: 'Viking Line' });
    expect(awizacjaOperators([pf, st, vk]).map((o) => o.id)).toEqual(['POLFERRIES', 'STENA', 'VIKING']);
    const back = S({ id: 'b', route: 'HEL-TLL', departureAt: '2026-10-27T10:00:00Z', operator: 'Viking Line' });
    const seed = S({ id: 's', route: 'TLL-HEL', departureAt: '2026-10-27T10:00:00Z', operator: 'Viking Line', source: 'DANE_STARTOWE' });
    expect(awizacjaOperators([pf, back, seed]).map((o) => o.id)).toEqual(['POLFERRIES', 'STENA']);
  });
  it('wybrany armator zostaje na liście', () => {
    expect(awizacjaOperators([], 'DFDS').map((o) => o.id)).toEqual(['POLFERRIES', 'STENA', 'DFDS']);
  });
});

describe('odprawa portu z katalogu', () => {
  const load = { plannedLoadDate: '2026-10-28', awizacja: { loadWindowStart: null, loadWindowEnd: null, unloadWindowStart: null, unloadWindowEnd: null, confirmed: false } };
  const t0 = Date.parse('2026-10-28T06:00:00+02:00');
  it('Polferries 14 h, Stena 16 h — jak przed katalogiem', () => {
    expect(PORT_CLEARANCE_H).toBe(14);
    expect(STENA_PORT_CLEARANCE_H).toBe(16);
    expect(earliestFerryDepartureMs(load, 'POLFERRIES')).toBe(t0 + 14 * 36e5);
    expect(earliestFerryDepartureMs(load, 'STENA')).toBe(t0 + 16 * 36e5);
  });
  it('nowi armatorzy — z portu wyjazdowego w katalogu, nie ze Steny', () => {
    for (const op of ['TALLINK', 'VIKING', 'ECKERO', 'DFDS'] as const) {
      expect(earliestFerryDepartureMs(load, op)).toBe(t0 + clearanceHoursFor(op) * 36e5);
    }
  });
});

/* ---------- macierz: stara reguła (przed BN9-a) a nowa ---------- */
type Legacy = 'POLFERRIES' | 'STENA';
function legacyMatches(s: Sailing, operator: Legacy): boolean {
  const op = (s.operator ?? '').toLowerCase();
  if (operator === 'STENA') return op.includes('stena') || s.route === 'GDY-KAA' || s.route === 'KAA-GDY';
  return !op.includes('stena') && (s.route === 'GDN-NYN' || s.route === 'NYN-GDN' || !s.route);
}
function legacySelectable(all: Sailing[], nowIso: string, currentId: string | null, operator: Legacy): string[] {
  const outbound = operator === 'STENA' ? 'GDY-KAA' : 'GDN-NYN';
  return all.filter((s) => {
    if (s.id === currentId) return true;
    if (s.route !== outbound || s.status === 'ODWOLANY' || hasDeparted(s, nowIso)) return false;
    const op = (s.operator ?? '').toLowerCase();
    if (operator === 'STENA') return op.includes('stena') || s.route === 'GDY-KAA';
    return !op.includes('stena');
  }).sort((a, b) => Date.parse(effDeparture(a)) - Date.parse(effDeparture(b))).map((s) => s.id);
}
function legacyHistorical(all: Sailing[], nowIso: string, operator: Legacy): string[] {
  const outbound = operator === 'STENA' ? 'GDY-KAA' : 'GDN-NYN';
  const now = Date.parse(nowIso);
  return all.filter((s) => {
    if (s.route !== outbound || s.status === 'ODWOLANY') return false;
    if (!(Date.parse(effArrival(s)) <= now)) return false;
    const op = (s.operator ?? '').toLowerCase();
    if (operator === 'STENA') return op.includes('stena') || s.route === 'GDY-KAA';
    return !op.includes('stena');
  }).sort((a, b) => Date.parse(effDeparture(b)) - Date.parse(effDeparture(a))).map((s) => s.id);
}

describe('wybór rejsu: Stena i Polferries — identyczny wynik jak przed katalogiem', () => {
  const routes = [...FERRY_ROUTE_CODES, ''] as Sailing['route'][];
  const ops = [undefined, 'Stena Line', 'Polferries', 'Polferries / Stena', 'TT-Line', 'Tallink', 'Viking Line', 'DFDS'];
  const deps = ['2026-10-25T10:00:00Z', '2026-10-27T10:00:00Z'];
  const all: Sailing[] = [];
  let n = 0;
  for (const route of routes) for (const operator of ops) for (const departureAt of deps) for (const status of ['ZAPLANOWANY', 'ODWOLANY'] as const) {
    all.push(S({ id: `s${n++}`, route, operator, departureAt, status, source: n % 3 === 0 ? 'STENA' : n % 3 === 1 ? 'POLFERRIES' : 'RECZNIE' }));
  }

  it('operatorMatches — każda kombinacja trasy (też pusta) i nazwy armatora', () => {
    for (const s of all) for (const op of ['POLFERRIES', 'STENA'] as const) {
      expect(operatorMatches(s, op), `${s.route}|${s.operator}|${op}`).toBe(legacyMatches(s, op));
    }
  });
  it('selectableSailings i historicalSailings', () => {
    for (const op of ['POLFERRIES', 'STENA'] as const) {
      for (const cur of [null, 's5', 's40']) {
        expect(selectableSailings(all, NOW_ISO, cur, op).map((s) => s.id)).toEqual(legacySelectable(all, NOW_ISO, cur, op));
      }
      expect(historicalSailings(all, NOW_ISO, op).map((s) => s.id)).toEqual(legacyHistorical(all, NOW_ISO, op));
    }
  });
  it('reachableSailings', () => {
    const load: Pick<Load, 'plannedLoadDate' | 'awizacja' | 'sailingId'> = {
      plannedLoadDate: '2026-10-26', sailingId: null,
      awizacja: { loadWindowStart: null, loadWindowEnd: null, unloadWindowStart: null, unloadWindowEnd: null, confirmed: false },
    };
    for (const op of ['POLFERRIES', 'STENA'] as const) {
      const minDep = Date.parse('2026-10-26T06:00:00+02:00') + (op === 'STENA' ? 16 : 14) * 36e5;
      const legacy = legacySelectable(all, NOW_ISO, null, op)
        .map((id) => all.find((s) => s.id === id)!)
        .filter((s) => legacyMatches(s, op) && Date.parse(effDeparture(s)) >= minDep)
        .map((s) => s.id);
      expect(reachableSailings(all, load, NOW_ISO, op).map((s) => s.id)).toEqual(legacy);
    }
  });
});

describe('strefa — lista armatorów', () => {
  it('Polferries i Stena zawsze, nowy tylko gdy strefa go ma', () => {
    expect(zoneRouteOptions('POLFERRIES')).toEqual(['POLFERRIES', 'STENA']);
    expect(zoneRouteOptions('STENA')).toEqual(['POLFERRIES', 'STENA']);
    expect(zoneRouteOptions(null)).toEqual(['POLFERRIES', 'STENA']);
    expect(zoneRouteOptions('TALLINK')).toEqual(['POLFERRIES', 'STENA', 'TALLINK']);
  });
});

/* ---------- tory na wodzie ---------- */
type P = readonly [number, number]; // [szer., dł.]
/** Rzut lokalny w km (wystarczy na odległości rzędu kilometrów). */
const xy = (p: P, lat0: number): [number, number] => [p[1] * 111.32 * Math.cos((lat0 * Math.PI) / 180), p[0] * 110.57];
function segPointKm(a: P, b: P, c: P): number {
  const lat0 = c[0];
  const [ax, ay] = xy(a, lat0); const [bx, by] = xy(b, lat0); const [cx, cy] = xy(c, lat0);
  const dx = bx - ax; const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((cx - ax) * dx + (cy - ay) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(ax + t * dx - cx, ay + t * dy - cy);
}
function cross(a: P, b: P, c: P, d: P): boolean {
  const o = (p: P, q: P, r: P) => (q[1] - p[1]) * (r[0] - p[0]) - (q[0] - p[0]) * (r[1] - p[1]);
  return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
}
function inside(p: P, ring: readonly P[]): boolean {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [yi, xi] = ring[i]; const [yj, xj] = ring[j];
    if (yi > p[0] !== yj > p[0] && p[1] < ((xj - xi) * (p[0] - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

/** Jednoznaczne punkty lądu (środki miast i wysp). */
const LAND_POINTS: Record<string, P> = {
  'Paldiski (miasto)': [59.356, 24.05],
  'Lidingö': [59.36, 18.2],
  'Vaxholm (miasto)': [59.403, 18.338],
  'Naissaar': [59.565, 24.52],
  'Aegna': [59.582, 24.757],
};
/**
 * Przybliżone wielokąty lądu [szer., dł.] — z wielokątów lądu OpenStreetMap, uproszczone i zmniejszone o ok. 200 m,
 * więc leżą w całości na lądzie.
 */
const LAND_RINGS: Record<string, readonly P[]> = {
  'Lidingö': [[59.3531, 18.133], [59.383, 18.132], [59.383, 18.1473], [59.3761, 18.1713], [59.379, 18.1742], [59.3826, 18.1701], [59.3816, 18.1848], [59.3805, 18.1876], [59.3779, 18.1853], [59.3754, 18.1874], [59.3747, 18.2038], [59.3776, 18.2123], [59.3744, 18.2171], [59.3741, 18.2428], [59.3705, 18.2543], [59.3653, 18.2523], [59.3666, 18.2263], [59.3697, 18.2182], [59.3656, 18.1887], [59.3714, 18.1606], [59.3691, 18.1546], [59.3654, 18.1572], [59.3616, 18.1803], [59.3608, 18.223], [59.3559, 18.2316], [59.3514, 18.2302], [59.3449, 18.208], [59.3406, 18.2052], [59.3411, 18.1667], [59.3531, 18.133]],
  'Pakri (półwysep)': [[59.386, 24.0372], [59.3883, 24.0422], [59.3829, 24.0619], [59.3835, 24.0757], [59.3749, 24.0991], [59.3631, 24.1524], [59.3543, 24.158], [59.302, 24.158], [59.3022, 24.1161], [59.3043, 24.1198], [59.3119, 24.1182], [59.3296, 24.1037], [59.3367, 24.0767], [59.356, 24.0444], [59.3741, 24.0378], [59.386, 24.0372]],
  'Väike-Pakri': [[59.3475, 23.9397], [59.3606, 23.9554], [59.3542, 23.9838], [59.3472, 23.9959], [59.3394, 24.0014], [59.33, 24.007], [59.3211, 24.0051], [59.3161, 24.0079], [59.3178, 23.9998], [59.3149, 23.9906], [59.3178, 23.9736], [59.3233, 23.9675], [59.3323, 23.9686], [59.3395, 23.9508], [59.3459, 23.9474], [59.3475, 23.9397]],
  'Naissaar': [[59.5695, 24.4798], [59.5749, 24.4894], [59.5932, 24.5004], [59.6035, 24.5131], [59.5924, 24.5194], [59.5819, 24.5334], [59.5762, 24.5345], [59.5583, 24.5489], [59.5488, 24.5502], [59.5409, 24.5597], [59.5389, 24.5411], [59.5416, 24.5208], [59.5574, 24.4888], [59.5662, 24.4849], [59.5695, 24.4798]],
  'Aegna': [[59.5809, 24.7409], [59.584, 24.7435], [59.5873, 24.7634], [59.5821, 24.7754], [59.574, 24.7565], [59.5753, 24.7482], [59.5809, 24.7409]],
  'Vaxholm': [[59.4056, 18.3116], [59.4064, 18.3327], [59.4035, 18.35], [59.4023, 18.3306], [59.4056, 18.3116]],
};

describe('tory nowych przepraw idą po wodzie', () => {
  it('wielokąty kontrolne leżą na swoich punktach lądu', () => {
    expect(inside(LAND_POINTS['Lidingö'], LAND_RINGS['Lidingö'])).toBe(true);
    expect(inside(LAND_POINTS['Paldiski (miasto)'], LAND_RINGS['Pakri (półwysep)'])).toBe(true);
  });
  for (const [id, line] of Object.entries(WATER_TRACKS_EXTRA)) {
    it(`${id}: ≥ 500 m od punktów lądu, bez przecięcia wielokątów lądu`, () => {
      for (let i = 0; i < line.length - 1; i++) {
        const a = line[i]; const b = line[i + 1];
        for (const [name, p] of Object.entries(LAND_POINTS)) {
          expect(segPointKm(a, b, p), `${id} odcinek ${i} — ${name}`).toBeGreaterThan(0.5);
        }
        for (const [name, ring] of Object.entries(LAND_RINGS)) {
          expect(inside(a, ring), `${id} punkt ${i} w ${name}`).toBe(false);
          for (let k = 0; k < ring.length - 1; k++) {
            expect(cross(a, b, ring[k], ring[k + 1]), `${id} odcinek ${i} tnie ${name}`).toBe(false);
          }
        }
      }
    });
  }
});
