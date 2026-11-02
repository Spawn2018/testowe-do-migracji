/**
 * BN6 (#716) cz.4 — Tark Tee EE: DATEX XML/SRTI JSON, filtr korytarza, runRoadEe.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  EE_ATTRIBUTION,
  EE_DATEX_FEEDS,
  EE_DATEX_KEY_HEADER,
  EE_SOURCE_REF,
  EE_UA,
  applyBalticCorridorRoadFilter,
  balticSlowdownMult,
  eeDatexApiKey,
  eeDatexFeedUrl,
  eeRoadOnCorridor,
  eeSeverityForRecord,
  extractBalticRoadRef,
  filterInEeBboxes,
  nearEePortTerminal,
  parseEeDatexXml,
  parseEeFeedBody,
  parseEeSrtiJson,
  weightLimitRisk,
} from '../supabase/functions/_shared/integrations/roadBaltic.ts';
import {
  runRoadEe,
  type JobDeps,
  type JobResult,
  type SyncStore,
} from '../supabase/functions/_shared/integrations/jobs.ts';
import type { RiskInput } from '../supabase/functions/_shared/integrations/sync.ts';

const restXml = readFileSync(resolve('tests/fixtures/ee-tarktee-restrictions-sample.xml'), 'utf8');
const srtiJson = JSON.parse(
  readFileSync(resolve('tests/fixtures/ee-tarktee-srti-accident-sample.json'), 'utf8'),
);
const NOW = new Date('2026-11-02T12:00:00Z');

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
  env: Record<string, string> = { TARKTEE_DATEX_TOKEN: 'test-ee-key' },
): { d: JobDeps; headerCalls: { url: string; headers: Record<string, string> }[] } {
  const headerCalls: { url: string; headers: Record<string, string> }[] = [];
  const f = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    headerCalls.push({ url, headers: (init?.headers ?? {}) as Record<string, string> });
    const body = pages[url];
    if (body === undefined) {
      return new Response('missing', { status: 404 });
    }
    if (typeof body === 'number') {
      return new Response('err', { status: body });
    }
    return new Response(body, {
      status: 200,
      headers: { 'Content-Type': url.includes('srti') ? 'application/json' : 'application/xml' },
    });
  }) as typeof fetch;
  return {
    d: {
      now: () => NOW,
      fetch: f,
      env,
      store,
    },
    headerCalls,
  };
}

describe('BN6 road-ee parsers', () => {
  it('parseEeDatexXml: roboty LOW, zamknięcie HIGH, masa z maxGrossWeightAllowed', () => {
    const ev = parseEeDatexXml(restXml, 'RESTRICTIONS');
    expect(ev.map((e) => e.id)).toEqual(expect.arrayContaining([
      'bn6-ee-rw-parnu', 'bn6-ee-closed-t4', 'bn6-ee-weight-t4', 'bn6-ee-far-east',
    ]));
    const rw = ev.find((e) => e.id === 'bn6-ee-rw-parnu')!;
    expect(rw.severity).toBe('LOW');
    expect(rw.road).toBe('T4');
    const closed = ev.find((e) => e.id === 'bn6-ee-closed-t4')!;
    expect(closed.severity).toBe('HIGH');
    expect(closed.roadClosed).toBe(true);
    const w = ev.find((e) => e.id === 'bn6-ee-weight-t4')!;
    expect(w.weightLimitT).toBe(40);
    expect(w.severity).toBe('HIGH');
  });

  it('parseEeSrtiJson: wypadek przy porcie; blokada HIGH', () => {
    const acc = parseEeSrtiJson(srtiJson, 'SRTI_ACCIDENT');
    expect(acc.length).toBeGreaterThanOrEqual(2);
    const port = acc.find((e) => e.id === 'bn6-ee-acc-tallinn')!;
    expect(port.lat).toBeCloseTo(59.444, 3);
    expect(eeSeverityForRecord('SRTI_ACCIDENT', 'UnprotectedAccident')).toBe('MEDIUM');
    const blk = parseEeSrtiJson(srtiJson, 'SRTI_BLOCKAGE')
      .find((e) => e.id === 'bn6-ee-acc-blocked');
    expect(blk?.severity).toBe('HIGH');
  });

  it('extractBalticRoadRef rozpoznaje T4 / E67', () => {
    expect(extractBalticRoadRef('Teetööd T4 Pärnu')).toBe('T4');
    expect(extractBalticRoadRef('E67 closed')).toBe('E67');
  });

  it('eeRoadOnCorridor: T4/E67/T11 on; T1 tylko przy Muuga; T12 off', () => {
    expect(eeRoadOnCorridor('T4', { lat: 58.4, lon: 24.5 })).toBe('on');
    expect(eeRoadOnCorridor('E67', { lat: 58.8, lon: 24.7 })).toBe('on');
    expect(eeRoadOnCorridor('T1', { lat: 59.50, lon: 24.96 })).toBe('on');
    expect(eeRoadOnCorridor('T1', { lat: 59.38, lon: 28.19 })).toBe('off');
    expect(eeRoadOnCorridor('T12', { lat: 58.4, lon: 24.5 })).toBe('off');
  });

  it('nearEePortTerminal: Vanasadam ≤2 km', () => {
    expect(nearEePortTerminal(59.444, 24.768)).toBe(true);
    expect(nearEePortTerminal(59.50, 25.50)).toBe(false);
  });

  it('filtr bbox + corridor: Narva off/raise pominięte; Pärnu on', () => {
    const raw = parseEeDatexXml(restXml, 'RESTRICTIONS');
    const boxed = filterInEeBboxes(raw);
    expect(boxed.some((e) => e.id === 'bn6-ee-far-east')).toBe(false);
    const near = applyBalticCorridorRoadFilter('EE', boxed);
    const parnu = near.find((e) => e.id === 'bn6-ee-rw-parnu')!;
    expect(parnu.corridorMatch).toBe('on');
    const slow = balticSlowdownMult(near.filter((e) => e.corridorMatch === 'on'));
    expect(slow.mult).toBeGreaterThan(1);
  });

  it('weightLimitRisk bez masy ładunku → MEDIUM check', () => {
    const e = parseEeDatexXml(restXml, 'RESTRICTIONS').find((x) => x.id === 'bn6-ee-weight-t4')!;
    const r = weightLimitRisk('EE', e, null, EE_SOURCE_REF, EE_ATTRIBUTION);
    expect(r.severity).toBe('MEDIUM');
    expect(r.titleKey).toBe('rk_road_baltic_weight_check');
  });

  it('eeDatexApiKey: TOKEN przed PASSWORD; bez USER', () => {
    expect(eeDatexApiKey({ TARKTEE_DATEX_TOKEN: 'tok' })).toBe('tok');
    expect(eeDatexApiKey({ TARKTEE_DATEX_PASSWORD: 'pwd' })).toBe('pwd');
    expect(eeDatexApiKey({ TARKTEE_DATEX_USER: 'u' })).toBe('');
    expect(eeDatexFeedUrl('restrictions')).toContain('/datex/restrictions');
  });
});

describe('BN6 runRoadEe', () => {
  it('bez sekretu: configured:0, ok, bez SOURCE_DOWN', async () => {
    const store = new MemStore();
    const { d } = deps(store, {}, {});
    const res = await runRoadEe(d);
    expect(res.ok).toBe(true);
    expect(res.observations?.configured).toBe('0');
    expect(store.risks).toHaveLength(0);
  });

  it('LIVE: nagłówek X-DATEX-API-KEY; raise tylko corridor on; resolveStale', async () => {
    const store = new MemStore();
    const pages: Record<string, string | number> = {};
    for (const f of EE_DATEX_FEEDS) {
      const url = eeDatexFeedUrl(f.path);
      if (f.code === 'RESTRICTIONS') pages[url] = restXml;
      else if (f.code === 'SRTI_ACCIDENT' || f.code === 'SRTI_BLOCKAGE') {
        pages[url] = JSON.stringify(srtiJson);
      } else {
        /* puste ale rozpoznane DATEX XML bez rekordów → skipped format? użyj minimalnego */
        pages[url] = '<?xml version="1.0"?><d2LogicalModel><payloadPublication></payloadPublication></d2LogicalModel>';
      }
    }
    const { d, headerCalls } = deps(store, pages);
    const res = await runRoadEe(d);
    expect(headerCalls.some((c) => c.headers[EE_DATEX_KEY_HEADER] === 'test-ee-key')).toBe(true);
    expect(headerCalls.every((c) => (c.headers['User-Agent'] ?? '').includes('road-ee'))).toBe(true);
    expect(EE_UA).toContain('road-ee');
    expect(res.observations?.source).toBe('tarktee_datex');
    expect(Number(res.observations?.fetched_ok)).toBeGreaterThan(0);
    expect(store.risks.every((r) => r.kind === 'ROAD_EE')).toBe(true);
    expect(store.risks.some((r) => String(r.detail?.opis ?? '').includes('Narva'))).toBe(false);
    expect(store.corridor?.corridor).toBe('ROAD_EE');
    expect(store.staleCalls.some((s) => s.prefix === 'ROAD_EE:')).toBe(true);
  });

  it('SOURCE_DOWN po 3× fetched_ok===0 przy skonfigurowanym kluczu', async () => {
    const store = new MemStore();
    store.runs = [
      { job: 'road-ee', ok: false, result: { job: 'road-ee', mode: 'LIVE', ok: false, risks: 0, warnings: [], observations: { fetched_ok: '0', configured: '1' } } },
      { job: 'road-ee', ok: false, result: { job: 'road-ee', mode: 'LIVE', ok: false, risks: 0, warnings: [], observations: { fetched_ok: '0', configured: '1' } } },
    ];
    const pages: Record<string, string | number> = {};
    for (const f of EE_DATEX_FEEDS) pages[eeDatexFeedUrl(f.path)] = 503;
    const { d } = deps(store, pages);
    const res = await runRoadEe(d);
    expect(res.ok).toBe(false);
    expect(store.risks.some((r) => r.dedup.startsWith('SOURCE_DOWN:ROAD_EE'))).toBe(true);
  });

  it('parseEeFeedBody: XML vs JSON', () => {
    const x = parseEeFeedBody(restXml, 'RESTRICTIONS', 'xml');
    expect(x.format).toBe('datex-xml');
    expect(x.events.length).toBeGreaterThan(0);
    const j = parseEeFeedBody(JSON.stringify(srtiJson), 'SRTI_ACCIDENT', 'json');
    expect(j.format).toBe('datex-json');
  });
});
