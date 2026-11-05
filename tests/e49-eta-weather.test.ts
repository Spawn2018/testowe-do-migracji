import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  planWindCase,
  slipperyCause,
  weatherFromCorridorWind,
  windCaseDedup,
  windCaseRisk,
  windThresholdsFromOps,
  type CorridorWindRow,
} from '../supabase/functions/_shared/e49/etaWeather.ts';
import { E49_WIND_DEFAULTS } from '../supabase/functions/_shared/e49/windEta.ts';
import { runRouteHazards, type JobDeps } from '../supabase/functions/_shared/integrations/jobs.ts';

const baseRows = (gustMs: number, windFromDeg: number): CorridorWindRow[] => [
  {
    corridor: 'SE_E4',
    km: 0,
    lon: 18,
    lat: 59,
    bearingDeg: 0,
    source: 'SMHI',
    samples: [
      {
        at: '2026-11-04T12:00:00.000Z',
        gustMs,
        windMs: gustMs * 0.7,
        windFromDeg,
        source: 'SMHI',
      },
      {
        at: '2026-11-04T18:00:00.000Z',
        gustMs: 12,
        windMs: 8,
        windFromDeg,
        source: 'SMHI',
      },
    ],
  },
  {
    corridor: 'SE_E4',
    km: 25,
    lon: 18.2,
    lat: 59.2,
    bearingDeg: 0,
    source: 'SMHI',
    samples: [
      {
        at: '2026-11-04T12:00:00.000Z',
        gustMs,
        windMs: gustMs * 0.7,
        windFromDeg,
        source: 'SMHI',
      },
    ],
  },
];

describe('E49-a etaWeather (DP-205 cz.3 / Z1 Z2)', () => {
  it('22 m/s z boku → WIND +addMin; z tyłu bez wpisu', () => {
    const cross = weatherFromCorridorWind({
      rows: baseRows(22, 90),
      fromKm: 0,
      startAt: new Date('2026-11-04T12:00:00Z'),
      driveH: 4,
    });
    expect(cross.weather.some((w) => w.kind === 'WIND' && w.side === 'CROSS')).toBe(true);
    expect(cross.addMin).toBeGreaterThan(0);

    const tail = weatherFromCorridorWind({
      rows: baseRows(22, 180),
      fromKm: 0,
      startAt: new Date('2026-11-04T12:00:00Z'),
      driveH: 4,
    });
    expect(tail.weather).toEqual([]);
    expect(tail.addMin).toBe(0);
  });

  it('26 m/s → WIND_HOLD z untilIso', () => {
    const hold = weatherFromCorridorWind({
      rows: baseRows(26, 90),
      fromKm: 0,
      startAt: new Date('2026-11-04T12:00:00Z'),
      driveH: 8,
    });
    expect(hold.weather[0]?.kind).toBe('WIND_HOLD');
    expect(hold.holdMin).toBeGreaterThan(0);
    expect(hold.weather[0]?.untilIso).toBeTruthy();
  });

  it('Z2 risk: Silny wiatr MEDIUM, postój HIGH; jeden klucz E49_WIND:{transport}:{korytarz}', () => {
    const loadId = 'a0000000-0000-4000-8000-000000000205';
    const strong = windCaseRisk({
      loadId,
      corridor: 'SE_E4',
      km: 100,
      gustMs: 22,
      hold: false,
      atIso: '2026-11-04T12:00:00Z',
      untilIso: '2026-11-04T16:00:00Z',
      side: 'CROSS',
      addMin: 12,
    });
    expect(strong.severity).toBe('MEDIUM');
    expect(strong.title).toMatch(/Silny wiatr na trasie:/);
    expect(strong.title).toMatch(/E4 \(SE\)/);
    expect(strong.title).toMatch(/22 m\/s z boku/);
    expect(strong.title).toMatch(/\+12 min/);
    /* F7 #785 r1 pkt 5a: bez km w kluczu — nie sprawa na punkt co 25 km */
    expect(strong.dedup).toBe(`E49_WIND:${loadId}:SE_E4`);
    expect(strong.detail.audience).toBe('HHL_PRZEWOZNIK');

    const stop = windCaseRisk({
      loadId,
      corridor: 'SE_E4',
      km: 100,
      gustMs: 27,
      hold: true,
      atIso: '2026-11-04T12:00:00Z',
      untilIso: '2026-11-04T18:30:00Z',
      addMin: 30,
    });
    expect(stop.severity).toBe('HIGH');
    expect(stop.title).toMatch(/Postój przez wiatr:/);
    /* pkt 5c: eskalacja na TYM SAMYM kluczu (nie E49_WIND_HOLD:) */
    expect(stop.dedup).toBe(strong.dedup);
    expect(windCaseDedup(loadId, 'SE_E4')).toBe(strong.dedup);
    expect(stop.detail.audience).toBe('HHL_PRZEWOZNIK');
  });

  it('DP-216: tytuł LV A1 Saulkrasti–Ainaži (#783 pkt 7)', () => {
    const r = windCaseRisk({
      loadId: 'a0000000-0000-4000-8000-000000000216',
      corridor: 'LV_A1',
      km: 50,
      gustMs: 21,
      hold: false,
      atIso: '2026-11-04T13:00:00Z',
      untilIso: '2026-11-04T17:00:00Z',
      side: 'CROSS',
      addMin: 12,
    });
    expect(r.title).toBe(
      'Silny wiatr na trasie: A1 (LV), Saulkrasti–Ainaži, 21 m/s z boku, 14:00–18:00, +12 min',
    );
  });

  it('progi z ops_thresholds nadpisują domyślne (Z1 pkt 5)', () => {
    const thr = windThresholdsFromOps([
      { key: 'WIND_SLOW_MS', value_num: 18 },
      { key: 'WIND_HOLD_MS', value_num: '23' },
      { key: 'SLIP_PCT', value_num: 20 },
    ]);
    expect(thr.WIND_SLOW_MS).toBe(18);
    expect(thr.WIND_HOLD_MS).toBe(23);
    expect(thr.SLIP_MULT).toBeCloseTo(1.2);
    expect(thr.WIND_RESUME_MIN).toBe(30);
  });

  it('SLIPPERY lokalnie', () => {
    const s = slipperyCause({ where: 'E4 Skellefteå', addMin: 4 });
    expect(s.kind).toBe('SLIPPERY');
    expect(s.addMin).toBe(4);
  });
});

/* Z2 plan sprawy: jedna na transport+korytarz, histereza, eskalacja na tym samym kluczu. */
const NOW = new Date('2026-11-04T12:00:00Z');
const LOAD = 'b0000000-0000-4000-8000-000000000205';
const gustRow = (km: number, gustMs: number, windFromDeg = 180): CorridorWindRow => ({
  corridor: 'SE_E4',
  km,
  lon: 18,
  lat: 59,
  bearingDeg: 0,
  source: 'SMHI',
  samples: [{ at: '2026-11-04T15:00:00.000Z', gustMs, windMs: gustMs * 0.7, windFromDeg, source: 'SMHI' }],
});
const THR = { WIND_SLOW_MS: 20, WIND_HOLD_MS: 25, WIND_RESUME_MIN: 30 };

describe('E49-a Z2 planWindCase (F7 #785 r1 pkt 5)', () => {
  it('kilka punktów ≥ 20 m/s → jedna sprawa na transport+korytarz (najsilniejszy punkt)', () => {
    const plan = planWindCase({
      loadId: LOAD, corridor: 'SE_E4', fromKm: 0, now: NOW, thr: THR, isOpen: false,
      rows: [gustRow(0, 21), gustRow(25, 22), gustRow(50, 23), gustRow(75, 21)],
    });
    expect(plan.action).toBe('raise');
    if (plan.action !== 'raise') return;
    expect(plan.risk.dedup).toBe(`E49_WIND:${LOAD}:SE_E4`);
    expect(plan.risk.severity).toBe('MEDIUM');
    expect(plan.risk.detail.km).toBe(50);
  });

  it('20–24 m/s z TYŁU też otwiera sprawę (Z2: niezależnie od kierunku)', () => {
    const plan = planWindCase({
      loadId: LOAD, corridor: 'SE_E4', fromKm: 0, now: NOW, thr: THR, isOpen: false,
      rows: [gustRow(0, 22, 180)], // bearing 0, wiatr z 180° = z tyłu
    });
    expect(plan.action).toBe('raise');
  });

  it('eskalacja 20–24 → ≥ 25 m/s: ten sam klucz, wyższa waga', () => {
    const mid = planWindCase({
      loadId: LOAD, corridor: 'SE_E4', fromKm: 0, now: NOW, thr: THR, isOpen: false, rows: [gustRow(25, 22)],
    });
    const high = planWindCase({
      loadId: LOAD, corridor: 'SE_E4', fromKm: 0, now: NOW, thr: THR, isOpen: true, rows: [gustRow(25, 27)],
    });
    expect(mid.action === 'raise' && high.action === 'raise').toBe(true);
    if (mid.action !== 'raise' || high.action !== 'raise') return;
    expect(high.risk.dedup).toBe(mid.risk.dedup);
    expect(mid.risk.severity).toBe('MEDIUM');
    expect(high.risk.severity).toBe('HIGH');
  });

  it('punkty ZA autem (km < fromKm) nie dają sprawy', () => {
    const plan = planWindCase({
      loadId: LOAD, corridor: 'SE_E4', fromKm: 300, now: NOW, thr: THR, isOpen: false,
      rows: [gustRow(0, 28), gustRow(100, 26), gustRow(325, 12)],
    });
    expect(plan.action).toBe('close');
  });

  it('histereza: 18–19,9 m/s przy otwartej sprawie → keep; poniżej 18 → close; bez otwartej → close', () => {
    const open = planWindCase({
      loadId: LOAD, corridor: 'SE_E4', fromKm: 0, now: NOW, thr: THR, isOpen: true, rows: [gustRow(0, 19)],
    });
    expect(open.action).toBe('keep');
    const low = planWindCase({
      loadId: LOAD, corridor: 'SE_E4', fromKm: 0, now: NOW, thr: THR, isOpen: true, rows: [gustRow(0, 17.5)],
    });
    expect(low.action).toBe('close');
    const notOpen = planWindCase({
      loadId: LOAD, corridor: 'SE_E4', fromKm: 0, now: NOW, thr: THR, isOpen: false, rows: [gustRow(0, 19)],
    });
    expect(notOpen.action).toBe('close');
  });

  it('próg z ops_thresholds (np. 18 m/s) steruje sprawą, nie stała w kodzie', () => {
    const plan = planWindCase({
      loadId: LOAD, corridor: 'SE_E4', fromKm: 0, now: NOW,
      thr: { ...THR, WIND_SLOW_MS: 18 }, isOpen: false, rows: [gustRow(0, 19)],
    });
    expect(plan.action).toBe('raise');
  });
});

/* route-hazards: bez zalewu RISK_OPEN, tylko korytarze transportu, AT_SITE pominięty, zamknięcie bez prognozy. */
type WindStore = Record<string, unknown>;
const makeDeps = (store: WindStore): JobDeps => ({
  store: store as unknown as JobDeps['store'],
  fetch: (async () => new Response('{}')) as typeof fetch,
  env: {},
  now: () => NOW,
});
const baseStore = (over: WindStore = {}): { store: WindStore; raised: string[]; resolved: Array<[string, string[]]> } => {
  const raised: string[] = [];
  const resolved: Array<[string, string[]]> = [];
  const store: WindStore = {
    listActiveLoadsForTelematics: async () => [
      { id: LOAD, status: 'IN_TRANSIT_SE' },
      { id: 'c0000000-0000-4000-8000-000000000001', status: 'AT_SITE' },
    ],
    corridorWindFreshCount: async () => 5,
    listCorridorWindForecast: async (code: string) =>
      code === 'SE_E4' ? [gustRow(25, 22), gustRow(50, 23), gustRow(75, 21)] : [],
    e49WindLoadCorridors: async () => [
      { loadId: LOAD, code: 'SE_E4', leg: 'SE', fromKm: 0, currentLeg: true },
      { loadId: LOAD, code: 'FI_E75', leg: 'SE', fromKm: 0, currentLeg: false },
      { loadId: 'c0000000-0000-4000-8000-000000000001', code: 'SE_E4', leg: 'SE', fromKm: 0, currentLeg: true },
    ],
    e49WindThresholds: async () => ({ ...E49_WIND_DEFAULTS }),
    openRiskDedups: async () => [],
    raiseRisk: async (r: { dedup: string }) => { raised.push(r.dedup); return true; },
    resolveStaleRisks: async (prefix: string, keep: string[]) => { resolved.push([prefix, keep]); return 0; },
    ...over,
  };
  return { store, raised, resolved };
};

describe('E49-a Z2 runRouteHazards (F7 #785 r1)', () => {
  it('jedna sprawa na transport+korytarz; AT_SITE i odcinek nie-bieżący pominięte', async () => {
    const { store, raised, resolved } = baseStore();
    await runRouteHazards(makeDeps(store));
    expect(raised).toEqual([`E49_WIND:${LOAD}:SE_E4`]);
    const stale = resolved.find(([p]) => p === 'E49_WIND:');
    expect(stale?.[1]).toEqual([`E49_WIND:${LOAD}:SE_E4`]);
  });

  it('otwarta sprawa przy kolejnym przebiegu: nadal ten sam klucz, zamykanie tylko spoza listy keep', async () => {
    const { store, resolved } = baseStore({
      openRiskDedups: async () => [`E49_WIND:${LOAD}:SE_E4`],
      raiseRisk: async () => false, /* aktualizacja w miejscu (0398), bez nowego RISK_OPEN */
    });
    const res = await runRouteHazards(makeDeps(store));
    expect(res.risks).toBe(0);
    expect(resolved.find(([p]) => p === 'E49_WIND:')?.[1]).toEqual([`E49_WIND:${LOAD}:SE_E4`]);
  });

  it('brak świeżej prognozy → zamyka otwarte sprawy wiatru', async () => {
    const { store, raised, resolved } = baseStore({ corridorWindFreshCount: async () => 0 });
    await runRouteHazards(makeDeps(store));
    expect(raised).toEqual([]);
    expect(resolved).toContainEqual(['E49_WIND:', []]);
  });
});

/* Strażnik migracji (F7 #785 r1): wrapper i Z4 w rdzeniu żyją w 0398 — późniejsza migracja z pełnym
   create or replace function public.compute_load_eta( nadpisałaby wrapper, więc musi wołać rdzeń. */
describe('E49-a migracje ETA — strażnik wrappera', () => {
  const dir = join(__dirname, '..', 'supabase', 'migrations');
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  const full = (f: string) => readFileSync(join(dir, f), 'utf8');

  it('0398: rdzeń bez mnożnika slowdown, wrapper woła compute_load_eta_core, korytarze per transport w 0397', () => {
    const m398 = full(files.find((f) => f.startsWith('0398_'))!);
    expect(m398).toMatch(/h_road_eff := h_road;\s+-- E49 Z4/);
    expect(m398).toMatch(/h_pl_eff := h_pl;\s+-- E49 Z4/);
    expect(m398).toMatch(/compute_load_eta_core\(p_load, p_now\)/);
    expect(m398).toMatch(/E49_WIND:/); /* ~ '^E49_WIND:' (nie LIKE E49\_WIND:%) */
    /* F7 #785 r2: audience → matrix_notify bez KSH */
    expect(m398).toMatch(/new\.audience = 'HHL_PRZEWOZNIK'/);
    expect(m398).toMatch(/p_only_org_kind|FORWARDER'|matrix_notify\([^)]*'FORWARDER'/);
    const m397 = full(files.find((f) => f.startsWith('0397_'))!);
    expect(m397).toMatch(/e49_wind_load_corridors/);
    /* AT_SITE nie uruchamia pobierania prognozy (#783 pkt 6, test 14) */
    const legs = m397.slice(m397.indexOf('function public.e49_wind_load_corridors'), m397.indexOf('function public.e49_wind_active_corridors'));
    expect(legs).not.toMatch(/AT_SITE'/);
  });

  it('po 0398 nikt nie odtwarza pełnego compute_load_eta bez wołania rdzenia', () => {
    const after = files.filter((f) => f > '0398_zzz');
    for (const f of after) {
      const t = full(f);
      if (/create or replace function public\.compute_load_eta\b\s*\(/i.test(t)) {
        expect(t, `${f} nadpisuje wrapper E49`).toMatch(/compute_load_eta_core\(/);
      }
    }
  });
});
