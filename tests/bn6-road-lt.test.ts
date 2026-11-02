/**
 * BN6 (#716) cz.2 — eismoinfo LT: parser restrictions/weather, bbox Via Baltica, runRoadLt.
 * F7 #727: B1 mokro≠adverse, B2 limity H/W bez slowdown, B3 fixtures real, N1 LOW roboty, N2/N3.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  LT_ATTRIBUTION,
  LT_FRICTION_ADVERSE,
  LT_RESTRICTIONS_URL,
  LT_UA,
  LT_WEATHER_URL,
  balticRoadRisk,
  balticSlowdownMult,
  dimensionLimitRisk,
  eventInLtBboxes,
  filterInLtBboxes,
  isDimensionLimitEvent,
  ltPerspejimaiText,
  ltWeatherToSlowdownEvents,
  parseLtPolylineCentroid,
  parseLtRestrictions,
  parseLtWeather,
  weightLimitRisk,
  type BalticRoadEvent,
} from '../supabase/functions/_shared/integrations/roadBaltic.ts';
import {
  runRoadLt,
  type JobDeps,
  type JobResult,
  type SyncStore,
} from '../supabase/functions/_shared/integrations/jobs.ts';
import type { RiskInput } from '../supabase/functions/_shared/integrations/sync.ts';

const rest = JSON.parse(
  readFileSync(resolve('tests/fixtures/lt-eismoinfo-restrictions-sample.json'), 'utf8'),
);
const wx = JSON.parse(
  readFileSync(resolve('tests/fixtures/lt-eismoinfo-weather-sample.json'), 'utf8'),
);
const restReal = JSON.parse(
  readFileSync(resolve('tests/fixtures/lt-eismoinfo-restrictions-real.json'), 'utf8'),
);
const wxReal = JSON.parse(
  readFileSync(resolve('tests/fixtures/lt-eismoinfo-weather-real.json'), 'utf8'),
);
const NOW = new Date('2026-11-02T06:00:00Z');

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
    throw new Error(`nieoczekiwane: ${url}`);
  }) as typeof fetch;
  return { d: { store, fetch: f, env: {}, now: () => NOW }, headerCalls };
}

function allOkPages(): Record<string, string | number> {
  return {
    'restrictions.eismoinfo.lt': JSON.stringify(rest),
    'weather-conditions-service': JSON.stringify(wx),
  };
}

describe('BN6 road-lt — eismoinfo', () => {
  it('polyline centroid', () => {
    expect(parseLtPolylineCentroid('54.9 23.9 55.0 24.0')).toEqual([54.95, 23.95]);
    expect(parseLtPolylineCentroid('')).toBeNull();
  });

  it('parser restrictions → id, limity, LD/SVKD; N1 LOW; B2 height MEDIUM', () => {
    const ev = parseLtRestrictions(rest);
    expect(ev.length).toBe(5);
    const w = ev.find((e) => e.id === 'bn6-lt-weight-panevezys')!;
    expect(w.weightLimitT).toBe(40);
    expect(w.severity).toBe('HIGH');
    expect(w.unknownCodes).toEqual(['LD', 'SVKD']);
    const closed = ev.find((e) => e.id === 'bn6-lt-closed-marijampole')!;
    expect(closed.heightLimitM).toBe(4);
    expect(closed.severity).toBe('HIGH');
    const constr = ev.find((e) => e.id === 'bn6-lt-construction-kaunas')!;
    expect(constr.severity).toBe('LOW');
    expect(String(constr.detail)).not.toMatch(/nie podaje wypadkow/);
    const height = ev.find((e) => e.id === 'bn6-lt-height-only-kaunas')!;
    expect(height.severity).toBe('MEDIUM');
    expect(height.heightLimitM).toBe(4.2);
  });

  it('filtr bbox Via Baltica: Kaunas w; Vilnius wschód poza', () => {
    const ev = parseLtRestrictions(rest);
    const near = filterInLtBboxes(ev);
    expect(near.map((e) => e.id).sort()).toEqual([
      'bn6-lt-closed-marijampole',
      'bn6-lt-construction-kaunas',
      'bn6-lt-height-only-kaunas',
      'bn6-lt-weight-panevezys',
    ].sort());
    const far = ev.find((e) => e.id === 'bn6-lt-far-vilnius-east')!;
    expect(eventInLtBboxes(far)).toBe(false);
  });

  it('balticRoadRisk → ROAD_LT + detail.oryginal; N2 bez wypadkow w opis', () => {
    const w = parseLtRestrictions(rest).find((e) => e.id === 'bn6-lt-weight-panevezys')!;
    const r = balticRoadRisk('LT', w, LT_RESTRICTIONS_URL, LT_ATTRIBUTION);
    expect(r.kind).toBe('ROAD_LT');
    expect(r.dedup).toBe('ROAD_LT:bn6-lt-weight-panevezys');
    expect(r.detail.oryginal).toBe('LD,SVKD');
    expect(r.detail.zrodlo).toBe(LT_ATTRIBUTION);
    expect(String(r.detail.opis)).not.toMatch(/nie podaje wypadkow/);
  });

  it('limit masy: ładunek > limit → HIGH; brak masy → MEDIUM sprawdź', () => {
    const w = parseLtRestrictions(rest).find((e) => e.id === 'bn6-lt-weight-panevezys')!;
    const hi = weightLimitRisk('LT', w, 48, LT_RESTRICTIONS_URL, LT_ATTRIBUTION);
    expect(hi.severity).toBe('HIGH');
    expect(hi.titleKey).toBe('rk_road_baltic_weight');
    const med = weightLimitRisk('LT', w, null, LT_RESTRICTIONS_URL, LT_ATTRIBUTION);
    expect(med.severity).toBe('MEDIUM');
    expect(med.titleKey).toBe('rk_road_baltic_weight_check');
  });

  it('B2: height/width → dimensionLimitRisk MEDIUM; bez slowdown', () => {
    const height = parseLtRestrictions(rest).find((e) => e.id === 'bn6-lt-height-only-kaunas')!;
    expect(isDimensionLimitEvent(height)).toBe(true);
    const r = dimensionLimitRisk('LT', height, LT_RESTRICTIONS_URL, LT_ATTRIBUTION);
    expect(r.severity).toBe('MEDIUM');
    expect(r.titleKey).toBe('rk_road_baltic_dim_check');
    expect(r.title).toMatch(/wysokość/);
    expect(balticSlowdownMult([height]).mult).toBe(1);
  });

  it('B1: šlapia+friction0.6 nie adverse; plikledis adverse; N3 ice≠service', () => {
    const stations = parseLtWeather(wx);
    expect(stations.length).toBe(4);
    const wet = stations.find((s) => s.id === 'bn6-lt-wx-wet-ok')!;
    expect(wet.adverse).toBe(false);
    expect(wet.friction).toBe(0.6);
    const slip = stations.find((s) => s.id === 'bn6-lt-wx-panevezys-slippery')!;
    expect(slip.adverse).toBe(true);
    expect(slip.friction!).toBeLessThan(LT_FRICTION_ADVERSE);
    const ok = stations.find((s) => s.id === 'bn6-lt-wx-kaunas-ok')!;
    expect(ok.adverse).toBe(false);
    const slow = ltWeatherToSlowdownEvents(stations);
    expect(slow.map((e) => e.id)).toEqual(['wx:bn6-lt-wx-panevezys-slippery']);
    expect(slow.every((e) => e.severity === 'HIGH')).toBe(true);
    expect(ltPerspejimaiText('service road').danger).toBe(false);
    expect(ltPerspejimaiText('Pliklus kelias').danger).toBe(true);
  });

  it('B3: prawdziwy feed weather — pola lat/lng/kelio_danga/perspejimai[]', () => {
    const stations = parseLtWeather(wxReal);
    expect(stations.length).toBeGreaterThanOrEqual(3);
    expect(stations.every((s) => Number.isFinite(s.lat) && Number.isFinite(s.lon))).toBe(true);
    const wet = stations.find((s) => (s.surface ?? '').toLowerCase().includes('šlap'));
    if (wet) expect(wet.adverse).toBe(false);
    const parsedRest = parseLtRestrictions(restReal);
    expect(parsedRest.length).toBeGreaterThanOrEqual(3);
    expect(parsedRest.some((e) => e.kind === 'weakBridge')).toBe(true);
    expect(parsedRest.some((e) => e.severity === 'LOW')).toBe(true);
  });

  it('balticSlowdownMult: zamknięcie spowalnia; height i masa nie', () => {
    const closed: BalticRoadEvent = {
      id: 'C', title: 'zamkniecie', detail: 'x', severity: 'HIGH',
      lat: 54.56, lon: 23.35, kind: 'closed', start: null, end: null,
    };
    const weight: BalticRoadEvent = {
      id: 'W', title: 'limit', detail: 'x', severity: 'HIGH',
      lat: 55.73, lon: 24.35, kind: 'weakBridge', start: null, end: null, weightLimitT: 40,
    };
    const height: BalticRoadEvent = {
      id: 'H', title: 'wys', detail: 'x', severity: 'MEDIUM',
      lat: 54.92, lon: 23.92, kind: 'obstructionType', start: null, end: null, heightLimitM: 4.2,
    };
    expect(balticSlowdownMult([weight]).mult).toBe(1);
    expect(balticSlowdownMult([height]).mult).toBe(1);
    expect(balticSlowdownMult([closed]).mult).toBeGreaterThan(1);
  });
});

describe('BN6 runRoadLt', () => {
  it('User-Agent LT_UA; 2 endpointy', async () => {
    const st = new MemStore();
    const { d, headerCalls } = deps(st, allOkPages());
    await runRoadLt(d);
    expect(headerCalls.length).toBe(2);
    expect(headerCalls.some((c) => c.url.includes('restrictions.eismoinfo.lt'))).toBe(true);
    expect(headerCalls.some((c) => c.url.includes('weather-conditions-service'))).toBe(true);
    for (const c of headerCalls) {
      expect(c.headers['User-Agent']).toBe(LT_UA);
    }
  });

  it('SOURCE_DOWN po 3× fetched_ok===0', async () => {
    const st = new MemStore();
    st.runs.push(
      {
        job: 'road-lt', ok: false,
        result: {
          job: 'road-lt', mode: 'LIVE', ok: false,
          observations: { fetched_ok: '0' },
        },
      },
      {
        job: 'road-lt', ok: false,
        result: {
          job: 'road-lt', mode: 'LIVE', ok: false,
          observations: { fetched_ok: '0' },
        },
      },
    );
    const r = await runRoadLt(deps(st, {
      'restrictions.eismoinfo.lt': 500,
      'weather-conditions-service': 500,
    }).d);
    expect(r.ok).toBe(false);
    expect(r.observations?.fetched_ok).toBe('0');
    expect(r.observations?.road_lt_fail_streak).toBe('3');
    expect(st.risks.some((x) => x.dedup.startsWith('SOURCE_DOWN:ROAD_LT'))).toBe(true);
  });

  it('komplet → resolveStaleRisks; częściowa awaria → bez zamknięcia', async () => {
    const stOk = new MemStore();
    stOk.risks.push({
      kind: 'ROAD_LT', severity: 'MEDIUM', title: 'stare', dedup: 'ROAD_LT:OLD',
      detail: {}, titleKey: 'rk_road_baltic', params: {},
    });
    const rOk = await runRoadLt(deps(stOk, allOkPages()).d);
    expect(rOk.observations?.complete).toBe('1');
    expect(stOk.staleCalls.length).toBe(1);
    expect(stOk.risks.some((x) => x.dedup === 'ROAD_LT:OLD')).toBe(false);
    expect(stOk.corridor?.corridor).toBe('ROAD_LT');
    expect(stOk.risks.some((x) => x.dedup === 'ROAD_LT:bn6-lt-construction-kaunas')).toBe(true);
    const constr = stOk.risks.find((x) => x.dedup === 'ROAD_LT:bn6-lt-construction-kaunas');
    expect(constr?.severity).toBe('LOW');
    expect(stOk.risks.some((x) => x.dedup === 'ROAD_LT:bn6-lt-far-vilnius-east')).toBe(false);
    const weightRisk = stOk.risks.find((x) => x.dedup === 'ROAD_LT:bn6-lt-weight-panevezys');
    expect(weightRisk?.detail?.oryginal).toBe('LD,SVKD');
    expect(weightRisk?.detail?.uwaga_wypadki).toMatch(/nie podaje wypadkow/);
    const heightRisk = stOk.risks.find((x) => x.dedup === 'ROAD_LT:bn6-lt-height-only-kaunas');
    expect(heightRisk?.severity).toBe('MEDIUM');
    expect(heightRisk?.titleKey).toBe('rk_road_baltic_dim_check');

    const stPart = new MemStore();
    stPart.risks.push({
      kind: 'ROAD_LT', severity: 'MEDIUM', title: 'stare', dedup: 'ROAD_LT:OLD',
      detail: {}, titleKey: 'rk_road_baltic', params: {},
    });
    const rPart = await runRoadLt(deps(stPart, {
      'restrictions.eismoinfo.lt': JSON.stringify(rest),
      'weather-conditions-service': 500,
    }).d);
    expect(rPart.observations?.complete).toBe('0');
    expect(Number(rPart.observations?.fetched_ok)).toBe(1);
    expect(stPart.staleCalls.length).toBe(0);
    expect(stPart.risks.some((x) => x.dedup === 'ROAD_LT:OLD')).toBe(true);
  });

  it('sourceUrl = restrictions; weather tylko w corridor slowdown', async () => {
    const st = new MemStore();
    await runRoadLt(deps(st, allOkPages()).d);
    const hit = st.risks.find((r) => r.dedup === 'ROAD_LT:bn6-lt-construction-kaunas');
    expect(hit?.sourceUrl).toBe(LT_RESTRICTIONS_URL);
    expect(hit?.detail?.zrodlo).toBe(LT_ATTRIBUTION);
    expect(st.risks.some((r) => String(r.dedup).startsWith('ROAD_LT:wx:'))).toBe(false);
    expect(Number(st.corridor?.slowdownMult)).toBeGreaterThan(1);
    expect(LT_WEATHER_URL).toMatch(/weather-conditions/);
  });
});
