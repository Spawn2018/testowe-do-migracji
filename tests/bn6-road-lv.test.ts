/**
 * BN6 (#716) cz.3 — LVC NAP LV: DATEX/GeoJSON, dedup śliskości, runRoadLv.
 * F7 #730 + DP-200 (#773): snapshot REST POST download-file + x-api-key.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  LT_ICY_RE,
  LV_ATTRIBUTION,
  LV_DOWNLOAD_FILE_URL,
  LV_FILE_INFO_URL,
  LV_NAP_BASE,
  LV_NAP_KEY_HEADER,
  LV_SOURCE_REF,
  LV_UA,
  applyBalticCorridorRoadFilter,
  balticCapLongDetourClosure,
  balticKeyMeta,
  balticNetWarning,
  balticSlowdownMult,
  balticUrlKind,
  balticJsonErrorSnippet,
  balticWarnHost,
  classifyBalticNetError,
  dedupeLvSlippery,
  balticShouldRaiseRisk,
  extractBalticRoadRef,
  extractBalticRoadRefPreferStreet,
  filterInLvBboxes,
  formatBalticRoadTitle,
  isDimensionLimitEvent,
  lvCoordsFromRecord,
  lvFileInfoFirstId,
  lvIsFileIdMismatch,
  lvNormalizeLatLon,
  lvRoadOnCorridor,
  lvSeverityForRecord,
  lvUrlShape,
  normalizeLvNapUrl,
  normalizeLvRoadCode,
  parseLvDatexXml,
  parseLvFeedBody,
  parseLvWeightDimGeoJson,
  stripBalticDetourText,
  weightLimitRisk,
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
const datexJson = JSON.parse(
  readFileSync(resolve('tests/fixtures/lv-nap-datex-json-sample.json'), 'utf8'),
);
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

/** DP-200 — mock per klucz zbioru (ten sam URL download-file). */
type LvMockReply = string | number | { status: number; body?: string };
type LvKeyMock = { download?: LvMockReply; info?: LvMockReply };

function replyOf(r: LvMockReply | undefined, fallbackStatus = 404): Response {
  if (r == null) return new Response('missing', { status: fallbackStatus });
  if (typeof r === 'number') {
    if (r === 204) return new Response(null, { status: 204 });
    return new Response(r === 403 ? '{"error":"FileIdMismatch"}' : 'err', { status: r });
  }
  if (typeof r === 'string') return new Response(r, { status: 200 });
  if (r.status === 204) return new Response(null, { status: 204 });
  return new Response(r.body ?? '', { status: r.status });
}

function deps(
  store: MemStore,
  byKey: Record<string, LvKeyMock>,
  env: Record<string, string>,
): {
  d: JobDeps;
  headerCalls: { url: string; method: string; headers: Record<string, string>; body?: string }[];
} {
  const headerCalls: {
    url: string; method: string; headers: Record<string, string>; body?: string;
  }[] = [];
  const f = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? 'GET').toUpperCase();
    const hdrs: Record<string, string> = {};
    const raw = init?.headers;
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      for (const [k, v] of Object.entries(raw as Record<string, string>)) hdrs[k] = String(v);
    }
    const body = typeof init?.body === 'string' ? init.body : undefined;
    headerCalls.push({ url, method, headers: hdrs, body });
    if (/transportdata\.gov\.lv\/?$/i.test(url) || url === `${LV_NAP_BASE}/`) {
      return new Response('<html>ok</html>', { status: 200 });
    }
    const key = hdrs[LV_NAP_KEY_HEADER] ?? '';
    const mock = byKey[key];
    if (url.includes('/api/v1/metadata/file/info')) {
      return replyOf(mock?.info);
    }
    if (url.includes('/api/v1/get/file/download-file')) {
      return replyOf(mock?.download);
    }
    return new Response('missing', { status: 404 });
  }) as typeof fetch;
  return {
    d: { store, fetch: f, env, now: () => NOW },
    headerCalls,
  };
}

const MOCK_ENV: Record<string, string> = {
  LV_NAP_ROADWORKS_KEY: 'k-rw-secret-value',
  LV_NAP_SLIPPERY_WM_KEY: 'k-sw',
  LV_NAP_SLIPPERY_TI_KEY: 'k-st',
  LV_NAP_WEIGHT_DIM_KEY: 'k-wd',
};

const MOCK_BY_KEY: Record<string, LvKeyMock> = {
  'k-rw-secret-value': { download: rwXml },
  'k-sw': { download: slipWm },
  'k-st': { download: slipTi },
  'k-wd': { download: JSON.stringify(weightJson) },
};

describe('BN6 DP-160 / F7 #730 N1 LT_ICY_RE', () => {
  it('rdzenie bez końcowej granicy; negatywy Drėgna/Sausa', () => {
    expect(LT_ICY_RE.test('Apledėjusi')).toBe(true);
    expect(LT_ICY_RE.test('Šerkšnas')).toBe(true);
    expect(LT_ICY_RE.test('Apledėję')).toBe(true);
    expect(LT_ICY_RE.test('Ledo')).toBe(true);
    expect(LT_ICY_RE.test('Snieguota')).toBe(true);
    expect(LT_ICY_RE.test('Užsnigta')).toBe(true);
    expect(LT_ICY_RE.test('ledas')).toBe(true);
    expect(LT_ICY_RE.test('šlapdriba')).toBe(true);
    expect(LT_ICY_RE.test('service')).toBe(false);
    expect(LT_ICY_RE.test('Šlapia')).toBe(false);
    expect(LT_ICY_RE.test('Drėgna')).toBe(false);
    expect(LT_ICY_RE.test('Sausa')).toBe(false);
  });
});

describe('BN6 parse LV DATEX / GeoJSON (F7 #730)', () => {
  it('B1: Ceļa remontdarbi A7 → LOW; posList + roadClosed → HIGH', () => {
    const parsed = parseLvDatexXml(rwXml, 'ROADWORKS');
    expect(parsed.length).toBe(3);
    const rw = parsed.find((e) => e.id === 'bn6-lv-rw-riga')!;
    expect(rw.severity).toBe('LOW');
    expect(rw.title).toMatch(/roboty/);
    expect(lvSeverityForRecord('ROADWORKS', 'Ceļa remontdarbi A7')).toBe('LOW');
    const closed = parsed.find((e) => e.id === 'bn6-lv-rw-poslist')!;
    expect(closed.severity).toBe('HIGH');
    expect(closed.hasDetour).toBe(true);
    expect(closed.lat).toBeCloseTo(56.9535, 3);
    const near = filterInLvBboxes(parsed);
    expect(near.map((e) => e.id).sort()).toEqual(['bn6-lv-rw-poslist', 'bn6-lv-rw-riga'].sort());
  });

  it('B3/r2 B4: JSON z situationRecord; HTML/APIM/Error/[] → unknown', () => {
    const body = JSON.stringify(datexJson);
    expect(body[0]).toBe('{');
    expect(body).toMatch(/situationRecord/i);
    /* stary błąd: /situationRecord/ w pierwszych 500 znakach → XML; teraz pierwszy znak. */
    expect(body.slice(0, 500)).toMatch(/situationRecord/i);
    const parsed = parseLvFeedBody(body, 'ROADWORKS');
    expect(parsed.format).toBe('datex-json');
    expect(parsed.events.length).toBe(1);
    expect(parsed.events[0].severity).toBe('LOW');
    expect(parseLvFeedBody('<!DOCTYPE html><html>x</html>', 'ROADWORKS').format).toBe('unknown');
    expect(parseLvFeedBody('', 'ROADWORKS').format).toBe('empty');
    expect(parseLvFeedBody('{"message":"maintenance"}', 'ROADWORKS').format).toBe('unknown');
    expect(parseLvFeedBody('[]', 'ROADWORKS').format).toBe('unknown');
    expect(parseLvFeedBody('<Error>fail</Error>', 'CLOSURES').format).toBe('unknown');
    expect(parseLvFeedBody('<?xml version="1.0"?><html><body/></html>', 'ROADWORKS').format)
      .toBe('unknown');
  });

  it('r2 B5/B6: ice w policeForces ≠ HIGH; lanesBlocked→MEDIUM; LANE_CLOSURES→MEDIUM; speedLimit→LOW', () => {
    const police = JSON.stringify({
      sourceType: 'policeForces',
      type: 'strongWinds',
      advice: 'ServicePatrol',
    });
    expect(lvSeverityForRecord('EXC_WEATHER_WM', police, {
      contentText: 'strongWinds ServicePatrol',
      signals: {
        roadClosed: false, carriagewayBlocked: false, lanesBlocked: false,
        laneClosures: false, alternateTraffic: false, narrowOrContraflow: false,
        hasDetour: false, hasDimLimit: false, speedLimitOnly: false,
      },
    })).toBe('MEDIUM');
    expect(lvSeverityForRecord('ROADWORKS', 'x', {
      contentText: 'roboty',
      signals: {
        roadClosed: false, carriagewayBlocked: false, lanesBlocked: true,
        laneClosures: false, alternateTraffic: false, narrowOrContraflow: false,
        hasDetour: false, hasDimLimit: false, speedLimitOnly: false,
      },
    })).toBe('MEDIUM');
    expect(lvSeverityForRecord('LANE_CLOSURES', 'x', {
      contentText: 'pas',
      signals: {
        roadClosed: false, carriagewayBlocked: false, lanesBlocked: false,
        laneClosures: true, alternateTraffic: false, narrowOrContraflow: false,
        hasDetour: false, hasDimLimit: false, speedLimitOnly: false,
      },
    })).toBe('MEDIUM');
    expect(lvSeverityForRecord('ROADWORKS', 'temporarySpeedLimit only', {
      contentText: 'temporarySpeedLimit',
      signals: {
        roadClosed: false, carriagewayBlocked: false, lanesBlocked: false,
        laneClosures: false, alternateTraffic: false, narrowOrContraflow: false,
        hasDetour: false, hasDimLimit: false, speedLimitOnly: true,
      },
    })).toBe('LOW');
    expect(extractBalticRoadRefPreferStreet(
      null,
      'remontdarbi uz V1004, apbraukšana pa A7',
    )).toBe('V1004');
  });

  it('B6: posList centroid; N7 dekoduje encje XML', () => {
    const rec = `<x><posList>56.95 24.10 56.96 24.12</posList><value>A &amp; B</value></x>`;
    expect(lvCoordsFromRecord(rec)?.lat).toBeCloseTo(56.955, 3);
    const e = parseLvDatexXml(rwXml, 'ROADWORKS').find((x) => x.id === 'bn6-lv-rw-poslist')!;
    expect(e.detail).toContain('&');
    expect(e.detail).not.toContain('&amp;');
  });

  it('N5: dedup śliskości WM+TI → siatka 0,01°', () => {
    const a = parseLvDatexXml(slipWm, 'SLIPPERY_WM');
    const b = parseLvDatexXml(slipTi, 'SLIPPERY_TI');
    expect(a[0].id).toMatch(/^slippery:\d+\.\d{2}:/);
    expect(a[0].id).toBe(b[0].id);
    const dedup = dedupeLvSlippery([...a, ...b]);
    expect(dedup.length).toBe(1);
    expect(dedup[0].severity).toBe('HIGH');
  });

  it('WEIGHT_DIM GeoJSON: height → dim; weight; filtr bbox', () => {
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
});

describe('BN6 runRoadLv / DP-200 REST snapshot', () => {
  it('POST download-file + x-api-key; UA; ryzyka + corridor; lv_mode', async () => {
    const st = new MemStore();
    const { d, headerCalls } = deps(st, MOCK_BY_KEY, MOCK_ENV);
    const r = await runRoadLv(d);
    const probeCalls = headerCalls.filter((c) => /transportdata\.gov\.lv\/?$/i.test(c.url));
    const feedCalls = headerCalls.filter((c) =>
      c.url.includes('/download-file') && c.headers[LV_NAP_KEY_HEADER],
    );
    expect(probeCalls.length).toBe(1);
    expect(probeCalls[0]!.headers[LV_NAP_KEY_HEADER]).toBeUndefined();
    expect(feedCalls.length).toBe(4);
    for (const c of feedCalls) {
      expect(c.method).toBe('POST');
      expect(c.headers['User-Agent']).toBe(LV_UA);
      expect(c.headers[LV_NAP_KEY_HEADER]).toBeTruthy();
      expect(c.headers['Content-Type']).toMatch(/application\/json/i);
      expect(c.body).toContain('"file_id":"1"');
    }
    expect(r.observations?.header).toBe(LV_NAP_KEY_HEADER);
    expect(r.observations?.lv_mode).toBe('rest_snapshot');
    expect(r.observations?.complete).toBe('1');
    expect(r.observations?.lv_base).toBe('www.transportdata.gov.lv');
    expect(r.observations?.lv_url_kind).toBe(balticUrlKind(LV_DOWNLOAD_FILE_URL));
    expect(r.warnings?.some((w) => w.includes('k-rw-secret-value'))).toBe(false);
    expect(JSON.stringify(r.observations ?? {})).not.toContain('k-rw-secret-value');
    expect(st.corridor?.corridor).toBe('ROAD_LV');
    expect(st.risks.some((x) => x.dedup === 'ROAD_LV:v2:bn6-lv-rw-riga')).toBe(true);
    expect(st.risks.filter((x) => String(x.dedup).startsWith('ROAD_LV:v2:slippery:')).length).toBe(1);
    const dim = st.risks.find((x) => x.dedup === 'ROAD_LV:v2:bn6-lv-wd-riga-bridge');
    expect(dim?.titleKey).toBe('rk_road_baltic_dim_check');
    expect(dim?.detail?.zrodlo).toBe(LV_ATTRIBUTION);
    expect(dim?.sourceUrl).toBe(LV_SOURCE_REF);
    expect(st.staleCalls.length).toBe(1);
    expect(String(r.observations?.lv_roadworks ?? '')).toMatch(/^ok:\d+$/);
  });

  it('DP-200: 204 → empty_204, complete, bez ostrzeżenia', async () => {
    const st = new MemStore();
    const byKey: Record<string, LvKeyMock> = {
      'k-rw-secret-value': { download: 204 },
      'k-sw': { download: 204 },
      'k-st': { download: 204 },
      'k-wd': { download: 204 },
    };
    const r = await runRoadLv(deps(st, byKey, MOCK_ENV).d);
    expect(r.observations?.fetched_ok).toBe('4');
    expect(r.observations?.complete).toBe('1');
    expect(r.observations?.lv_roadworks).toBe('empty_204');
    expect(r.warnings ?? []).toEqual([]);
    expect(st.staleCalls.length).toBe(1);
  });

  it('DP-200: 403 FileIdMismatch → file/info → ponów download', async () => {
    const st = new MemStore();
    const byKey: Record<string, LvKeyMock> = {
      'k-rw-secret-value': {
        download: { status: 403, body: '{"error":"FileIdMismatch"}' },
        info: JSON.stringify({ dataset: 'rw', files: [{ file_id: '9', file_name: 'a.xml' }] }),
      },
      'k-sw': { download: slipWm },
      'k-st': { download: slipTi },
      'k-wd': { download: JSON.stringify(weightJson) },
    };
    let rwPosts = 0;
    const base = deps(st, byKey, MOCK_ENV);
    const f = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const hdrs: Record<string, string> = {};
      const raw = init?.headers;
      if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        for (const [k, v] of Object.entries(raw as Record<string, string>)) hdrs[k] = String(v);
      }
      const key = hdrs[LV_NAP_KEY_HEADER] ?? '';
      if (url.includes('download-file') && key === 'k-rw-secret-value') {
        rwPosts++;
        const body = typeof init?.body === 'string' ? init.body : '';
        if (body.includes('"file_id":"9"')) {
          return new Response(rwXml, { status: 200 });
        }
        return new Response('{"error":"FileIdMismatch"}', { status: 403 });
      }
      return base.d.fetch(input, init);
    }) as typeof fetch;
    const r = await runRoadLv({ ...base.d, fetch: f });
    expect(rwPosts).toBeGreaterThanOrEqual(2);
    expect(String(r.observations?.lv_roadworks ?? '')).toMatch(/^ok:\d+$/);
    expect(r.observations?.complete).toBe('1');
  });

  it('1/4 HTML → complete=false, bez resolveStale', async () => {
    const st = new MemStore();
    const r = await runRoadLv(deps(st, {
      'k-rw-secret-value': { download: '<!DOCTYPE html><html>serwiss</html>' },
      'k-sw': { download: slipWm },
      'k-st': { download: slipTi },
      'k-wd': { download: JSON.stringify(weightJson) },
    }, MOCK_ENV).d);
    expect(r.observations?.fetched_ok).toBe('3');
    expect(r.observations?.complete).toBe('0');
    expect(r.warnings?.some((w) => /nieczytelna odpowiedź ROADWORKS/.test(w))).toBe(true);
    expect(st.staleCalls.length).toBe(0);
  });

  it('SOURCE_DOWN po 3× fetched_ok===0 (configured>0); err:500', async () => {
    const st = new MemStore();
    st.runs.push(
      {
        job: 'road-lv', ok: false,
        result: {
          job: 'road-lv', mode: 'LIVE', ok: false,
          observations: { fetched_ok: '0', configured: '4' },
        },
      },
      {
        job: 'road-lv', ok: false,
        result: {
          job: 'road-lv', mode: 'LIVE', ok: false,
          observations: { fetched_ok: '0', configured: '4' },
        },
      },
    );
    const r = await runRoadLv(deps(st, {
      'k-rw-secret-value': { download: 500 },
      'k-sw': { download: 500 },
      'k-st': { download: 500 },
      'k-wd': { download: 500 },
    }, MOCK_ENV).d);
    expect(r.observations?.fetched_ok).toBe('0');
    expect(r.observations?.road_lv_fail_streak).toBe('3');
    expect(st.risks.some((x) => x.dedup.startsWith('SOURCE_DOWN:ROAD_LV'))).toBe(true);
    expect(r.observations?.lv_roadworks).toBe('err:500');
    expect(r.observations?.lv_slippery_wm).toBe('err:500');
  });

  it('DP-188: lv_*_err z JSON error; max 3', async () => {
    expect(balticJsonErrorSnippet('{"error":"subscription inactive"}')).toBe('subscription inactive');
    const st = new MemStore();
    const errBody = '{"error":"gateway: bad subscription key"}';
    const r = await runRoadLv(deps(st, {
      'k-rw-secret-value': { download: { status: 403, body: errBody } },
      'k-sw': { download: { status: 403, body: errBody } },
      'k-st': { download: { status: 403, body: errBody } },
      'k-wd': { download: '<!DOCTYPE html><html>SPA</html>' },
    }, MOCK_ENV).d);
    expect(r.observations?.fetched_ok).toBe('0');
    expect(r.observations?.lv_roadworks_err).toBe('gateway: bad subscription key');
    const errKeys = Object.keys(r.observations ?? {}).filter((k) => k.endsWith('_err'));
    expect(errKeys.length).toBeLessThanOrEqual(3);
  });

  it('brak KEY → ok, configured:0; sam KEY bez URL = skonfigurowany', async () => {
    const st = new MemStore();
    const empty = await runRoadLv(deps(st, {}, {}).d);
    expect(empty.ok).toBe(true);
    expect(empty.observations?.configured).toBe('0');
    expect(empty.warnings?.some((w) => /brak skonfigurowanych LV_NAP_\*_KEY/.test(w))).toBe(true);

    const st2 = new MemStore();
    const r = await runRoadLv(deps(st2, {
      'only-key': { download: rwXml },
    }, { LV_NAP_ROADWORKS_KEY: 'only-key' }).d);
    expect(r.observations?.configured).toBe('1');
    expect(String(r.observations?.lv_roadworks ?? '')).toMatch(/^ok:\d+$/);
  });

  it('B7: P/V → LOW; wielomiesięczne A7 z objazdem → MEDIUM bez slowdown', () => {
    expect(extractBalticRoadRef('V1004 Salacgrīva')).toBe('V1004');
    expect(lvRoadOnCorridor('A4')).toBe('on');
    const pv = applyBalticCorridorRoadFilter('LV', [{
      id: 'P', title: 'Closure · V1004', detail: 'boczna', severity: 'HIGH',
      lat: 56.95, lon: 24.10, kind: 'CLOSURES', start: null, end: null, road: 'V1004',
    }])[0];
    expect(pv.severity).toBe('LOW');
    expect(balticSlowdownMult([pv]).mult).toBe(1);

    const longDetour: BalticRoadEvent = {
      id: 'L', title: 'zamknięcie A7', detail: 'apbraukšana / detour',
      severity: 'HIGH', lat: 56.95, lon: 24.10, kind: 'CLOSURES',
      start: '2025-11-01T00:00:00Z', end: '2026-06-01T00:00:00Z',
      road: 'A7', hasDetour: true,
    };
    const capped = balticCapLongDetourClosure(longDetour);
    expect(capped.severity).toBe('MEDIUM');
    const on = applyBalticCorridorRoadFilter('LV', [longDetour])[0];
    expect(on.severity).toBe('MEDIUM');
    expect(balticSlowdownMult([on]).mult).toBe(1);
  });

  it('HIGH zamknięcie na A7 spowalnia; height nie; DP-164 off-road bez slowdown', () => {
    expect(lvRoadOnCorridor('A7')).toBe('on');
    expect(lvRoadOnCorridor('A12')).toBe('off');
    const closed: BalticRoadEvent = {
      id: 'C', title: 'zamkniecie', detail: 'x', severity: 'HIGH',
      lat: 56.95, lon: 24.10, kind: 'CLOSURES', start: null, end: null,
      road: 'A7', corridorMatch: 'on', roadClosed: true,
    };
    const height: BalticRoadEvent = {
      id: 'H', title: 'wys', detail: 'x', severity: 'MEDIUM',
      lat: 56.95, lon: 24.10, kind: 'WEIGHT_DIM', start: null, end: null, heightLimitM: 4,
      road: 'A7', corridorMatch: 'on',
    };
    expect(balticSlowdownMult([height]).mult).toBe(1);
    expect(balticSlowdownMult([closed]).reason).toBe('zamknięcia: 1');
    const off = applyBalticCorridorRoadFilter('LV', [{
      id: 'O', title: 'Closure · A12', detail: 'boczna', severity: 'HIGH',
      lat: 56.95, lon: 24.10, kind: 'CLOSURES', start: null, end: null, road: 'A12',
    }])[0];
    expect(off.severity).toBe('LOW');
    expect(balticSlowdownMult([off]).mult).toBe(1);
  });

  it('r2 B5: ice w policeForces ≠ HIGH; Slidens w komentarzu = HIGH', () => {
    const police = `<situationRecord id="p1" xsi:type="AuthorityOperation">
      <pointCoordinates><latitude>56.95</latitude><longitude>24.10</longitude></pointCoordinates>
      <source><sourceType>policeForces</sourceType></source>
      <advice>ice</advice>
      <generalPublicComment><comment><values><value>Strong winds</value></values></comment></generalPublicComment>
    </situationRecord>`;
    const wrap = `<?xml version="1.0"?><d2LogicalModel><payloadPublication><situation>${police}</situation></payloadPublication></d2LogicalModel>`;
    const parsed = parseLvDatexXml(wrap, 'EXC_WEATHER_WM');
    expect(parsed[0]?.severity).toBe('MEDIUM');
    expect(lvSeverityForRecord('SLIPPERY_WM', '', {
      contentText: 'Slidens ceļš',
    })).toBe('HIGH');
  });

  it('r2 B6: lanesBlocked → MEDIUM; LANE_CLOSURES → MEDIUM; speedLimit → LOW', () => {
    expect(lvSeverityForRecord('ROADWORKS',
      '<trafficConstrictionType>lanesBlocked</trafficConstrictionType>')).toBe('MEDIUM');
    expect(lvSeverityForRecord('LANE_CLOSURES',
      '<roadOrCarriagewayOrLaneManagementType>laneClosures</roadOrCarriagewayOrLaneManagementType>'))
      .toBe('MEDIUM');
    expect(lvSeverityForRecord('ROADWORKS',
      '<temporarySpeedLimit>70</temporarySpeedLimit>')).toBe('LOW');
    expect(lvSeverityForRecord('ROADWORKS',
      '<trafficConstrictionType>carriagewayBlocked</trafficConstrictionType>')).toBe('HIGH');
  });

  it('F7 r3 B1: apvedceļš nie daje numeru z objazdu', () => {
    for (const detour of ['apvedceļš pa A7', 'apvedceļa pa A7', 'apbraukšana pa A7'] as const) {
      const blob = `Ceļš slēgts, ${detour}`;
      expect(stripBalticDetourText(blob)).not.toMatch(/\bA7\b/);
      expect(extractBalticRoadRefPreferStreet(null, blob)).not.toBe('A7');
    }
  });

  it('F7 r3 B2/B3: swapped + cap detour', () => {
    const swapped = lvNormalizeLatLon(24.10, 56.95);
    expect(swapped.swapped).toBe(true);
    const now = Date.parse('2026-11-02T07:00:00Z');
    const shortEnd: BalticRoadEvent = {
      id: 's', title: 'zamknięcie A7', detail: 'apbraukšana',
      severity: 'HIGH', lat: 56.95, lon: 24.10, kind: 'CLOSURES',
      start: null, end: '2026-11-03T07:00:00Z', road: 'A7',
      roadClosed: true, hasDetour: true,
    };
    expect(balticCapLongDetourClosure(shortEnd, now).severity).toBe('HIGH');
    expect(balticCapLongDetourClosure({ ...shortEnd, end: null }, now).severity).toBe('MEDIUM');
  });

  it('timeout w warnings; klucz poza obs', async () => {
    const st = new MemStore();
    const f = (async () => {
      throw new DOMException('The operation was aborted.', 'AbortError');
    }) as typeof fetch;
    const r = await runRoadLv({
      store: st, fetch: f,
      env: { LV_NAP_ROADWORKS_KEY: 'sekret-klucz-xyz' },
      now: () => NOW,
    });
    expect(r.warnings?.some((w) => /timeout www\.transportdata\.gov\.lv/i.test(w))).toBe(true);
    expect(JSON.stringify(r)).not.toContain('sekret-klucz-xyz');
  });

  it('DP-170/171: lv_shape_* nadal z opcjonalnego URL; KEY sam wystarczy', async () => {
    expect(lvUrlShape('')).toBe('pusty');
    expect(normalizeLvNapUrl('/api/x').url).toBe(`${LV_NAP_BASE}/api/x`);
    const st = new MemStore();
    const r = await runRoadLv(deps(st, {
      'k': { download: rwXml },
      'k2': { download: 204 },
    }, {
      LV_NAP_ROADWORKS_KEY: 'k',
      LV_NAP_ROADWORKS_URL: 'https://nap.example/lv/roadworks',
      LV_NAP_WEIGHT_DIM_KEY: 'k2',
      LV_NAP_WEIGHT_DIM_URL: '44751',
    }).d);
    expect(r.observations?.lv_shape_roadworks).toBe('https');
    expect(r.observations?.lv_shape_weight_dim).toBe('same_cyfry');
    expect(r.observations?.configured).toBe('2');
  });

  it('lvFileInfoFirstId + FileIdMismatch helper', () => {
    expect(lvFileInfoFirstId({ files: [{ file_id: '7' }] })).toBe('7');
    expect(lvFileInfoFirstId({ files: [] })).toBeNull();
    expect(lvIsFileIdMismatch(403, 'FileIdMismatch')).toBe(true);
    expect(lvIsFileIdMismatch(404, 'FileIdMismatch')).toBe(false);
    expect(LV_FILE_INFO_URL).toContain('/metadata/file/info');
  });
});

describe('DP-202/203 LV korytarz + tytuły PL (#778/#779); decyzja 99 obok trasy', () => {
  it('parser LVC: A7_L → on; A6_K masa → off LOW „obok trasy”', () => {
    expect(normalizeLvRoadCode('A7_L')).toBe('A7');
    expect(normalizeLvRoadCode('A6_K')).toBe('A6');
    expect(normalizeLvRoadCode('P103_I')).toBe('P103');
    expect(normalizeLvRoadCode('V1021_I')).toBe('V1021');
    expect(extractBalticRoadRef('heightRestrictions · A6_K · km 22.97')).toBe('A6');
    expect(extractBalticRoadRef('massRestrictions · A7_L · km 6.2')).toBe('A7');
    expect(lvRoadOnCorridor(normalizeLvRoadCode('A7_L'))).toBe('on');
    expect(lvRoadOnCorridor(normalizeLvRoadCode('A6_K'))).toBe('off');
    expect(lvRoadOnCorridor(normalizeLvRoadCode('V1021_I'))).toBe('off');

    const a7 = applyBalticCorridorRoadFilter('LV', [{
      id: 'a7', title: 'massRestrictions · A7_L', detail: 'A7_L · km 6.2',
      severity: 'MEDIUM', lat: 56.95, lon: 24.10, kind: 'WEIGHT_DIM',
      start: null, end: null, road: normalizeLvRoadCode('A7_L'), weightLimitT: 40,
    }])[0]!;
    expect(a7.corridorMatch).toBe('on');
    expect(balticShouldRaiseRisk('LV', a7)).toBe('on');
    const a7Risk = weightLimitRisk('LV', a7, null, LV_SOURCE_REF, LV_ATTRIBUTION);
    expect(a7Risk.title).toMatch(/^Warunki drogowe A7 \(LV\): Ograniczenie masy/);
    expect(a7Risk.title).not.toMatch(/obok trasy/);

    const a6 = applyBalticCorridorRoadFilter('LV', [{
      id: 'a6', title: 'massRestrictions · A6_K', detail: 'A6_K · km 22',
      severity: 'MEDIUM', lat: 56.95, lon: 24.10, kind: 'WEIGHT_DIM',
      start: null, end: null, road: normalizeLvRoadCode('A6_K'), weightLimitT: 40,
    }])[0]!;
    expect(a6.corridorMatch).toBe('off');
    expect(balticShouldRaiseRisk('LV', a6)).toBe('off');
    const a6Risk = weightLimitRisk('LV', a6, null, LV_SOURCE_REF, LV_ATTRIBUTION);
    expect(a6Risk.severity).toBe('LOW');
    expect(a6Risk.title).toMatch(/Warunki drogowe A6 \(LV\) · obok trasy:/);
    expect(a6Risk.title).toMatch(/Ograniczenie masy 40 t/);

    const v = applyBalticCorridorRoadFilter('LV', [{
      id: 'v', title: 'virtualMass · V1021_I', detail: 'V1021_I',
      severity: 'MEDIUM', lat: 56.95, lon: 24.10, kind: 'WEIGHT_DIM',
      start: null, end: null, road: normalizeLvRoadCode('V1021_I'),
    }])[0]!;
    expect(v.corridorMatch).toBe('off');
    expect(balticShouldRaiseRisk('LV', v)).toBe('off');
  });

  it('unknown ≤300 m → sprawdź; daleko → off „obok trasy”; A7 on bez dopisku', () => {
    const nearUnknown: BalticRoadEvent = {
      id: 'u', title: 'massRestrictions', detail: 'km 1',
      severity: 'MEDIUM', lat: 56.95, lon: 24.10, kind: 'WEIGHT_DIM',
      start: '2026-11-03T10:00:00Z', end: null, road: null, corridorMatch: 'unknown',
      weightLimitT: 40,
    };
    expect(balticShouldRaiseRisk('LV', nearUnknown)).toBe('unknown-near');
    const farUnknown: BalticRoadEvent = {
      ...nearUnknown, id: 'far', lat: 55.0, lon: 26.0,
    };
    expect(balticShouldRaiseRisk('LV', farUnknown)).toBe('off');

    const onEv: BalticRoadEvent = {
      id: 't', title: 'massRestrictions · A7_L', detail: 'A7 · km 6.2',
      severity: 'MEDIUM', lat: 56.95, lon: 24.10, kind: 'WEIGHT_DIM',
      start: '2026-11-03T10:00:00Z', end: '2026-11-04T18:00:00Z',
      road: 'A7', corridorMatch: 'on', weightLimitT: 40,
    };
    const title = formatBalticRoadTitle('LV', onEv, 'Ograniczenie masy 40 t');
    expect(title.title).toMatch(/^Warunki drogowe A7 \(LV\): Ograniczenie masy 40 t/);
    expect(title.title).not.toMatch(/^Trasa LV:/);
    expect(title.off).toBe('');
    const w = weightLimitRisk('LV', onEv, null, LV_SOURCE_REF, LV_ATTRIBUTION);
    expect(w.title).toMatch(/Warunki drogowe A7 \(LV\):/);
    expect(w.title).toMatch(/Ograniczenie masy 40 t/);
    expect(w.params.road).toBe('A7');
  });
});

describe('DP-165/169 classifyBalticNetError', () => {
  it('mapuje typowe komunikaty i host bez ścieżki', () => {
    expect(classifyBalticNetError(new DOMException('aborted', 'AbortError'))).toBe('timeout');
    expect(classifyBalticNetError(new Error('getaddrinfo ENOTFOUND x'))).toBe('DNS');
    expect(classifyBalticNetError(new Error('self signed certificate'))).toBe('TLS');
    expect(classifyBalticNetError(new Error('read ECONNRESET'))).toBe('reset');
    expect(classifyBalticNetError(new Error('connect ETIMEDOUT'))).toBe('timeout');
    expect(balticWarnHost('https://a.example/path?key=sek')).toBe('a.example');
    expect(balticUrlKind('https://nap.example/lv/api/pull/metadata/44751?x=1')).toBe('nap.example/lv');
    expect(balticKeyMeta('abc\n')).toEqual({
      key: 'abc', key_len: 3, key_trimmed: 1, key_header_sent: 1,
    });
    expect(balticNetWarning('LV X', 'https://a.example/secret', new Error('ECONNRESET')))
      .toBe('LV X: reset a.example');
  });
});
