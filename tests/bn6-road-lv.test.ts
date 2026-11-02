/**
 * BN6 (#716) cz.3 — LVC NAP LV: DATEX/GeoJSON, dedup śliskości, runRoadLv.
 * DP-160 (LT_ICY_RE) — testy w bn6-road-lt + tutaj smoke.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  LT_ICY_RE,
  LV_ATTRIBUTION,
  LV_NAP_KEY_HEADER,
  LV_SOURCE_REF,
  LV_UA,
  balticSlowdownMult,
  dedupeLvSlippery,
  filterInLvBboxes,
  isDimensionLimitEvent,
  parseLvDatexXml,
  parseLvFeedBody,
  parseLvWeightDimGeoJson,
  type BalticRoadEvent,
} from '../supabase/functions/_shared/integrations/roadBaltic.ts';
import {
  runRoadLv,
  type JobDeps,
  type JobResult,
  type SyncStore,
} from '../supabase/functions/_shared/integrations/jobs.ts';
import type { RiskInput } from '../supabase/functions/_shared/integrations/sync.ts';

const rwXml = readFileSync(resolve('tests/fixtures/lv-nap-roadworks-sample.xml'), 'utf8');
const slipWm = readFileSync(resolve('tests/fixtures/lv-nap-slippery-wm-sample.xml'), 'utf8');
const slipTi = readFileSync(resolve('tests/fixtures/lv-nap-slippery-ti-sample.xml'), 'utf8');
const weightJson = JSON.parse(
  readFileSync(resolve('tests/fixtures/lv-nap-weight-dim-sample.json'), 'utf8'),
);
const NOW = new Date('2026-11-02T07:00:00Z');

class MemStore implements SyncStore {
  risks: (RiskInput & { loadId?: string })[] = [];
  resolvedPrefixes: string[] = [];
  staleCalls: { prefix: string; keep: string[] }[] = [];
  runs: { job: string; ok: boolean; result: JobResult }[] = [];
  corridor: { corridor: string; slowdownMult: number; reason: string | null } | null = null;
  async projectId() { return 'p1'; }
  async vessels() { return []; }
  async sailingsSince() { return []; }
  async insertSailings() { /* */ }
  async updateSailing() { return false; }
  async raiseRisk(r: RiskInput & { loadId?: string }) {
    if (this.risks.some((x) => x.dedup === r.dedup)) return false;
    this.risks.push(r);
    return true;
  }
  async resolveRisks(prefix: string) {
    this.resolvedPrefixes.push(prefix);
    const n = this.risks.filter((r) => r.dedup.startsWith(prefix)).length;
    this.risks = this.risks.filter((r) => !r.dedup.startsWith(prefix));
    return n;
  }
  async resolveStaleRisks(prefix: string, keep: string[]) {
    this.staleCalls.push({ prefix, keep: [...keep] });
    const keepSet = new Set(keep);
    const hit = this.risks.filter((r) => r.dedup.startsWith(prefix) && !keepSet.has(r.dedup));
    this.risks = this.risks.filter((r) => !(r.dedup.startsWith(prefix) && !keepSet.has(r.dedup)));
    return hit.length;
  }
  async latestPositions() { return []; }
  async lastRun() { return null; }
  async recentJobResults(job: string, limit: number) {
    return this.runs.filter((r) => r.job === job).slice(-limit).reverse().map((r) => r.result);
  }
  async recordRun(job: string, ok: boolean, result: JobResult) {
    this.runs.push({ job, ok, result });
  }
  async saveVesselPosition() { /* */ }
  async seSlowdownPct() { return 15; }
  async saveCorridorCondition(row: {
    corridor: string; slowdownMult: number; reason: string | null;
  }) {
    this.corridor = {
      corridor: row.corridor, slowdownMult: row.slowdownMult, reason: row.reason,
    };
  }
  async opsThresholds() { return { waveM: 3.8, gustKn: 40 }; }
  async ferryRouteFamilies() { return {}; }
  async saveMarineCondition() { /* */ }
  async noteHereUsage() { /* */ }
  async hereMonthSpend() { return 0; }
}

function deps(
  store: MemStore,
  pages: Record<string, string | number>,
  env: Record<string, string>,
): { d: JobDeps; headerCalls: { url: string; headers: Record<string, string> }[] } {
  const headerCalls: { url: string; headers: Record<string, string> }[] = [];
  const f = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const hdrs: Record<string, string> = {};
    const raw = init?.headers;
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      for (const [k, v] of Object.entries(raw as Record<string, string>)) hdrs[k] = String(v);
    }
    headerCalls.push({ url, headers: hdrs });
    const hit = Object.entries(pages)
      .filter(([k]) => url.includes(k))
      .sort((a, b) => b[0].length - a[0].length)[0];
    if (hit) {
      return typeof hit[1] === 'number'
        ? new Response('err', { status: hit[1] })
        : new Response(hit[1], { status: 200 });
    }
    return new Response('missing', { status: 404 });
  }) as typeof fetch;
  return {
    d: { store, fetch: f, env, now: () => NOW },
    headerCalls,
  };
}

const MOCK_ENV: Record<string, string> = {
  LV_NAP_ROADWORKS_KEY: 'k-rw',
  LV_NAP_ROADWORKS_URL: 'https://nap.example/lv/roadworks',
  LV_NAP_SLIPPERY_WM_KEY: 'k-sw',
  LV_NAP_SLIPPERY_WM_URL: 'https://nap.example/lv/slippery-wm',
  LV_NAP_SLIPPERY_TI_KEY: 'k-st',
  LV_NAP_SLIPPERY_TI_URL: 'https://nap.example/lv/slippery-ti',
  LV_NAP_WEIGHT_DIM_KEY: 'k-wd',
  LV_NAP_WEIGHT_DIM_URL: 'https://nap.example/lv/weight-dim',
};

describe('BN6 DP-160 LT_ICY_RE', () => {
  it('łapie Apledėjusi / ledas / šlapdriba / sniegas; nie service', () => {
    expect(LT_ICY_RE.test('Apledėjusi')).toBe(true);
    expect(LT_ICY_RE.test('ledas')).toBe(true);
    expect(LT_ICY_RE.test('šlapdriba')).toBe(true);
    expect(LT_ICY_RE.test('sniegas')).toBe(true);
    expect(LT_ICY_RE.test('service')).toBe(false);
    expect(LT_ICY_RE.test('Šlapia')).toBe(false);
  });
});

describe('BN6 parse LV DATEX / GeoJSON', () => {
  it('DATEX XML: zdarzenie na korytarzu + poza bboxem', () => {
    const parsed = parseLvDatexXml(rwXml, 'ROADWORKS');
    expect(parsed.length).toBe(2);
    const near = filterInLvBboxes(parsed);
    expect(near.map((e) => e.id)).toEqual(['bn6-lv-rw-riga']);
    expect(near[0].severity).toBe('MEDIUM');
    expect(near[0].title).toMatch(/A7/);
  });

  it('dedup śliskości WM+TI → jedno id sticky', () => {
    const a = parseLvDatexXml(slipWm, 'SLIPPERY_WM');
    const b = parseLvDatexXml(slipTi, 'SLIPPERY_TI');
    expect(a[0].id).toMatch(/^slippery:/);
    expect(a[0].id).toBe(b[0].id);
    const dedup = dedupeLvSlippery([...a, ...b]);
    expect(dedup.length).toBe(1);
    expect(dedup[0].severity).toBe('HIGH');
  });

  it('WEIGHT_DIM GeoJSON: height MEDIUM dim; weight; filtr bbox', () => {
    const parsed = parseLvWeightDimGeoJson(weightJson, 'WEIGHT_DIM');
    expect(parsed.length).toBe(3);
    const near = filterInLvBboxes(parsed);
    expect(near.length).toBe(2);
    const height = near.find((e) => e.id === 'bn6-lv-wd-riga-bridge')!;
    expect(height.heightLimitM).toBe(4);
    expect(isDimensionLimitEvent(height)).toBe(true);
    const weight = near.find((e) => e.id === 'bn6-lv-wd-weight')!;
    expect(weight.weightLimitT).toBe(40);
  });

  it('parseLvFeedBody wybiera format', () => {
    expect(parseLvFeedBody(rwXml, 'ROADWORKS').format).toBe('datex-xml');
    expect(parseLvFeedBody(JSON.stringify(weightJson), 'WEIGHT_DIM').format).toBe('geojson');
    expect(parseLvFeedBody('', 'ROADWORKS').format).toBe('empty');
  });
});

describe('BN6 runRoadLv', () => {
  it('nagłówek Ocp-Apim + UA; bez URL w warnings; ryzyka + corridor', async () => {
    const st = new MemStore();
    const { d, headerCalls } = deps(st, {
      'nap.example/lv/roadworks': rwXml,
      'nap.example/lv/slippery-wm': slipWm,
      'nap.example/lv/slippery-ti': slipTi,
      'nap.example/lv/weight-dim': JSON.stringify(weightJson),
    }, MOCK_ENV);
    const r = await runRoadLv(d);
    expect(headerCalls.length).toBe(4);
    for (const c of headerCalls) {
      expect(c.headers['User-Agent']).toBe(LV_UA);
      expect(c.headers[LV_NAP_KEY_HEADER]).toBeTruthy();
    }
    expect(r.observations?.header).toBe(LV_NAP_KEY_HEADER);
    expect(r.observations?.complete).toBe('1');
    expect(r.warnings?.some((w) => /nap\.example|https?:\/\//i.test(w))).toBe(false);
    expect(st.corridor?.corridor).toBe('ROAD_LV');
    expect(st.risks.some((x) => x.dedup === 'ROAD_LV:bn6-lv-rw-riga')).toBe(true);
    expect(st.risks.filter((x) => String(x.dedup).startsWith('ROAD_LV:slippery:')).length).toBe(1);
    const dim = st.risks.find((x) => x.dedup === 'ROAD_LV:bn6-lv-wd-riga-bridge');
    expect(dim?.titleKey).toBe('rk_road_baltic_dim_check');
    expect(dim?.detail?.zrodlo).toBe(LV_ATTRIBUTION);
    expect(dim?.sourceUrl).toBe(LV_SOURCE_REF);
    expect(st.staleCalls.length).toBe(1);
    expect(st.risks.some((x) => x.dedup === 'ROAD_LV:bn6-lv-rw-far-east')).toBe(false);
  });

  it('SOURCE_DOWN po 3× fetched_ok===0', async () => {
    const st = new MemStore();
    st.runs.push(
      {
        job: 'road-lv', ok: false,
        result: { job: 'road-lv', mode: 'LIVE', ok: false, observations: { fetched_ok: '0' } },
      },
      {
        job: 'road-lv', ok: false,
        result: { job: 'road-lv', mode: 'LIVE', ok: false, observations: { fetched_ok: '0' } },
      },
    );
    const r = await runRoadLv(deps(st, {
      'nap.example/lv/roadworks': 500,
      'nap.example/lv/slippery-wm': 500,
      'nap.example/lv/slippery-ti': 500,
      'nap.example/lv/weight-dim': 500,
    }, MOCK_ENV).d);
    expect(r.observations?.fetched_ok).toBe('0');
    expect(r.observations?.road_lv_fail_streak).toBe('3');
    expect(st.risks.some((x) => x.dedup.startsWith('SOURCE_DOWN:ROAD_LV'))).toBe(true);
    expect(r.warnings?.every((w) => !/https?:\/\//i.test(w))).toBe(true);
  });

  it('brak sekretów → bez SOURCE_DOWN', async () => {
    const st = new MemStore();
    const r = await runRoadLv(deps(st, {}, {}).d);
    expect(r.ok).toBe(false);
    expect(r.observations?.configured).toBe('0');
    expect(st.risks.length).toBe(0);
  });

  it('HIGH zamknięcie spowalnia; height nie', () => {
    const closed: BalticRoadEvent = {
      id: 'C', title: 'zamkniecie', detail: 'x', severity: 'HIGH',
      lat: 56.95, lon: 24.10, kind: 'CLOSURES', start: null, end: null,
    };
    const height: BalticRoadEvent = {
      id: 'H', title: 'wys', detail: 'x', severity: 'MEDIUM',
      lat: 56.95, lon: 24.10, kind: 'WEIGHT_DIM', start: null, end: null, heightLimitM: 4,
    };
    expect(balticSlowdownMult([height]).mult).toBe(1);
    expect(balticSlowdownMult([closed]).mult).toBeGreaterThan(1);
  });
});
