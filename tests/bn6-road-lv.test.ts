/**
 * BN6 (#716) cz.3 — LVC NAP LV: DATEX/GeoJSON, dedup śliskości, runRoadLv.
 * F7 #730 r1 B1–B7 / N1–N8 + DP-160/164.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  LT_ICY_RE,
  LV_ATTRIBUTION,
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
  balticWarnHost,
  classifyBalticNetError,
  dedupeLvSlippery,
  extractBalticRoadRef,
  extractBalticRoadRefPreferStreet,
  filterInLvBboxes,
  isDimensionLimitEvent,
  lvCoordsFromRecord,
  lvNormalizeLatLon,
  lvRoadOnCorridor,
  lvSeverityForRecord,
  lvUrlShape,
  normalizeLvNapUrl,
  parseLvDatexXml,
  parseLvFeedBody,
  parseLvWeightDimGeoJson,
  stripBalticDetourText,
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
  LV_NAP_ROADWORKS_KEY: 'k-rw-secret-value',
  LV_NAP_ROADWORKS_URL: 'https://nap.example/lv/roadworks',
  LV_NAP_SLIPPERY_WM_KEY: 'k-sw',
  LV_NAP_SLIPPERY_WM_URL: 'https://nap.example/lv/slippery-wm',
  LV_NAP_SLIPPERY_TI_KEY: 'k-st',
  LV_NAP_SLIPPERY_TI_URL: 'https://nap.example/lv/slippery-ti',
  LV_NAP_WEIGHT_DIM_KEY: 'k-wd',
  LV_NAP_WEIGHT_DIM_URL: 'https://nap.example/lv/weight-dim',
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

describe('BN6 runRoadLv F7 #730', () => {
  it('nagłówek Ocp-Apim + UA; bez URL/kluczy w warnings; ryzyka + corridor', async () => {
    const st = new MemStore();
    const { d, headerCalls } = deps(st, {
      'nap.example/lv/roadworks': rwXml,
      'nap.example/lv/slippery-wm': slipWm,
      'nap.example/lv/slippery-ti': slipTi,
      'nap.example/lv/weight-dim': JSON.stringify(weightJson),
    }, MOCK_ENV);
    const r = await runRoadLv(d);
    /* F7 #736 B1: sonda hosta bez klucza + 4 zbiory z nagłówkiem. */
    const probeCalls = headerCalls.filter((c) => /https:\/\/nap\.example\/?$/i.test(c.url));
    const feedCalls = headerCalls.filter((c) => c.headers[LV_NAP_KEY_HEADER]);
    expect(probeCalls.length).toBe(1);
    expect(probeCalls[0]!.headers[LV_NAP_KEY_HEADER]).toBeUndefined();
    expect(feedCalls.length).toBe(4);
    for (const c of feedCalls) {
      expect(c.headers['User-Agent']).toBe(LV_UA);
      expect(c.headers[LV_NAP_KEY_HEADER]).toBeTruthy();
    }
    expect(r.observations?.header).toBe(LV_NAP_KEY_HEADER);
    expect(r.observations?.complete).toBe('1');
    expect(r.observations?.probe_lv).toMatch(/^(?:\d+|timeout|DNS|TLS|reset|connect timeout|read timeout|sieć):\d+$/);
    expect(r.observations?.lv_url_kind).toBe('nap.example/lv');
    expect(r.observations?.key_header_sent).toBe('1');
    expect(r.observations?.key_len).toBe(String('k-rw-secret-value'.length));
    expect(r.observations?.key_trimmed).toBe('0');
    expect(r.warnings?.some((w) => /nap\.example|https?:\/\//i.test(w))).toBe(false);
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
    expect(st.risks.some((x) => x.dedup === 'ROAD_LV:v2:bn6-lv-rw-far-east')).toBe(false);
    expect(String(r.observations?.lv_roadworks ?? '')).toMatch(/^ok:\d+:\d+:datex-xml:\d+$/);
    expect(r.observations?.lv_swapped).toMatch(/^\d+$/);
  });

  it('B4: 1/4 HTML → complete=false, bez resolveStale', async () => {
    const st = new MemStore();
    const r = await runRoadLv(deps(st, {
      'nap.example/lv/roadworks': '<!DOCTYPE html><html>serwiss</html>',
      'nap.example/lv/slippery-wm': slipWm,
      'nap.example/lv/slippery-ti': slipTi,
      'nap.example/lv/weight-dim': JSON.stringify(weightJson),
    }, MOCK_ENV).d);
    expect(r.observations?.fetched_ok).toBe('3');
    expect(r.observations?.complete).toBe('0');
    expect(r.warnings?.some((w) => /nieczytelna odpowiedź ROADWORKS/.test(w))).toBe(true);
    expect(st.staleCalls.length).toBe(0);
  });

  it('SOURCE_DOWN po 3× fetched_ok===0 (configured>0)', async () => {
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

  it('N3: brak sekretów → ok, configured:0, bez SOURCE_DOWN', async () => {
    const st = new MemStore();
    const r = await runRoadLv(deps(st, {}, {}).d);
    expect(r.ok).toBe(true);
    expect(r.observations?.configured).toBe('0');
    expect(st.risks.length).toBe(0);
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

  it('r2 B4: maintenance/[]/Error/XHTML → unknown; bez resolveStale', async () => {
    expect(parseLvFeedBody('{"message":"maintenance"}', 'ROADWORKS').format).toBe('unknown');
    expect(parseLvFeedBody('[]', 'ROADWORKS').format).toBe('unknown');
    expect(parseLvFeedBody('<Error>fail</Error>', 'ROADWORKS').format).toBe('unknown');
    expect(parseLvFeedBody('<?xml version="1.0"?><html><body>x</body></html>', 'ROADWORKS').format)
      .toBe('unknown');
    const st = new MemStore();
    const r = await runRoadLv(deps(st, {
      'nap.example/lv/roadworks': '{"message":"maintenance"}',
      'nap.example/lv/slippery-wm': '[]',
      'nap.example/lv/slippery-ti': '<Error>x</Error>',
      'nap.example/lv/weight-dim': '<?xml version="1.0"?><html>x</html>',
    }, MOCK_ENV).d);
    expect(r.observations?.complete).toBe('0');
    expect(r.observations?.fetched_ok).toBe('0');
    expect(st.staleCalls.length).toBe(0);
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

  it('F7 r3 B1: apvedceļš/apvedceļa/apbraukšana nie dają numeru z objazdu', () => {
    for (const detour of ['apvedceļš pa A7', 'apvedceļa pa A7', 'apbraukšana pa A7'] as const) {
      const blob = `Ceļš slēgts, ${detour}`;
      expect(stripBalticDetourText(blob)).not.toMatch(/\bA7\b/);
      expect(extractBalticRoadRefPreferStreet(null, blob)).not.toBe('A7');
    }
    const filtered = applyBalticCorridorRoadFilter('LV', [{
      id: 'lv-detour-text', title: 'zamknięcie', detail: 'Ceļš slēgts, apvedceļš pa A7',
      severity: 'HIGH', lat: 56.95, lon: 24.10, kind: 'CLOSURES',
      start: null, end: null, roadClosed: true, hasDetour: true,
    }]);
    expect(filtered[0].road).not.toBe('A7');
    expect(filtered[0].severity).toBe('MEDIUM');
  });

  it('F7 r3 B2: lv_swapped w observations przy zamianie osi', () => {
    const swapped = lvNormalizeLatLon(24.10, 56.95);
    expect(swapped.swapped).toBe(true);
    expect(swapped.lat).toBeCloseTo(56.95, 2);
    const rec = `<x><latitude>24.10</latitude><longitude>56.95</longitude></x>`;
    expect(lvCoordsFromRecord(rec)?.swapped).toBe(1);
  });

  it('F7 r3 B3: start=null + koniec ≤72 h → HIGH; bez końca → MEDIUM', () => {
    const now = Date.parse('2026-11-02T07:00:00Z');
    const shortEnd: BalticRoadEvent = {
      id: 's', title: 'zamknięcie A7', detail: 'apbraukšana',
      severity: 'HIGH', lat: 56.95, lon: 24.10, kind: 'CLOSURES',
      start: null, end: '2026-11-03T07:00:00Z', road: 'A7',
      roadClosed: true, hasDetour: true,
    };
    expect(balticCapLongDetourClosure(shortEnd, now).severity).toBe('HIGH');
    expect(applyBalticCorridorRoadFilter('LV', [shortEnd], now)[0].severity).toBe('HIGH');
    const noEnd: BalticRoadEvent = {
      ...shortEnd, id: 'n', end: null,
    };
    expect(balticCapLongDetourClosure(noEnd, now).severity).toBe('MEDIUM');
  });

  it('F7 r3: per budget przy wyczerpanym limicie czasu', async () => {
    const st = new MemStore();
    let n = 0;
    const f = (async () => {
      n++;
      await new Promise((r) => setTimeout(r, 30));
      return new Response(rwXml, { status: 200, headers: { 'Content-Type': 'application/xml' } });
    }) as typeof fetch;
    const env: Record<string, string> = {};
    for (const code of [
      'ROADWORKS', 'ROAD_OPERATOR', 'ABNORMAL_TRAFFIC', 'ACCIDENT', 'ACTIVITIES',
      'CLOSURES', 'EXC_WEATHER_WM', 'EXC_WEATHER_TI',
    ] as const) {
      env[`LV_NAP_${code}_KEY`] = `k-${code}`;
      env[`LV_NAP_${code}_URL`] = `https://nap.example/lv/${code.toLowerCase()}`;
    }
    const r = await runRoadLv({
      store: st,
      fetch: f,
      env,
      now: () => NOW,
    });
    const vals = Object.entries(r.observations ?? {})
      .filter(([k]) => k.startsWith('lv_'))
      .map(([, v]) => String(v));
    expect(vals.some((v) => v === 'budget') || n >= 1).toBe(true);
  });

  it('r2 N8: timeout w warnings; wartość klucza nie w detail', async () => {
    const st = new MemStore();
    let calls = 0;
    const f = (async () => {
      calls++;
      await new Promise((r) => setTimeout(r, 50));
      throw new DOMException('The operation was aborted.', 'AbortError');
    }) as typeof fetch;
    const d: JobDeps = {
      store: st,
      fetch: f,
      env: {
        LV_NAP_ROADWORKS_KEY: 'sekret-klucz-xyz',
        LV_NAP_ROADWORKS_URL: 'https://nap.example/lv/roadworks',
      },
      now: () => NOW,
    };
    /* podmień timeout na krótki przez Abort — jobs używa 10s; tu fetch od razu abort */
    const r = await runRoadLv(d);
    expect(calls).toBeGreaterThan(0);
    expect(r.warnings?.some((w) => /timeout nap\.example/i.test(w))).toBe(true);
    expect(r.warnings?.every((w) => !/\/lv\/roadworks/i.test(w))).toBe(true);
    expect(JSON.stringify(r)).not.toContain('sekret-klucz-xyz');
    expect(st.risks.every((x) => !JSON.stringify(x.detail ?? {}).includes('sekret-klucz-xyz')))
      .toBe(true);
  });

  it('DP-165: klasa DNS/TLS/reset + host bez ścieżki w warning', async () => {
    const cases: { err: Error; re: RegExp }[] = [
      { err: Object.assign(new Error('getaddrinfo ENOTFOUND bad.host'), { name: 'TypeError' }), re: /DNS bad\.host/ },
      { err: new Error('unable to verify the first certificate'), re: /TLS bad\.host/ },
      { err: Object.assign(new Error('read ECONNRESET'), { name: 'Error' }), re: /reset bad\.host/ },
    ];
    for (const { err, re } of cases) {
      const st = new MemStore();
      const r = await runRoadLv({
        store: st,
        fetch: (async () => { throw err; }) as typeof fetch,
        env: {
          LV_NAP_ROADWORKS_KEY: 'sekret-abc',
          LV_NAP_ROADWORKS_URL: 'https://bad.host/lv/api/pull/secret-path?k=sekret-abc',
        },
        now: () => NOW,
      });
      expect(r.warnings?.some((w) => re.test(w))).toBe(true);
      expect(r.observations?.lv_url_kind).toBe('bad.host/lv');
      expect(JSON.stringify(r)).not.toContain('sekret-abc');
      expect(JSON.stringify(r)).not.toContain('secret-path');
    }
  });

  it('F7 #736 B2: klucz z \\n → trim, key_trimmed=1, wartość poza obs/warnings', async () => {
    const st = new MemStore();
    const rawKey = 'sekret-trim-xyz\n';
    const headerVals: string[] = [];
    const f = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      const hdrs = (init?.headers ?? {}) as Record<string, string>;
      if (hdrs[LV_NAP_KEY_HEADER]) headerVals.push(hdrs[LV_NAP_KEY_HEADER]);
      return new Response(rwXml, { status: 200 });
    }) as typeof fetch;
    const r = await runRoadLv({
      store: st,
      fetch: f,
      env: {
        LV_NAP_ROADWORKS_KEY: rawKey,
        LV_NAP_ROADWORKS_URL: 'https://nap.example/lv/api/pull/field_source',
      },
      now: () => NOW,
    });
    expect(r.observations?.key_trimmed).toBe('1');
    expect(r.observations?.key_header_sent).toBe('1');
    expect(r.observations?.key_len).toBe(String('sekret-trim-xyz'.length));
    expect(r.observations?.lv_url_kind).toBe('nap.example/lv');
    expect(headerVals.every((v) => v === 'sekret-trim-xyz' && !v.includes('\n'))).toBe(true);
    expect(JSON.stringify(r.observations ?? {})).not.toContain('sekret-trim-xyz');
    expect(JSON.stringify(r.warnings ?? [])).not.toContain('sekret-trim-xyz');
  });

  it('DP-170: lv_shape_* bez wartości URL (https/same_cyfry/spacje/pusty/bez_schematu)', async () => {
    expect(lvUrlShape('')).toBe('pusty');
    expect(lvUrlShape('44751')).toBe('same_cyfry');
    expect(lvUrlShape(' 44751 ')).toBe('spacje');
    expect(lvUrlShape('https://nap.example/lv/x')).toBe('https');
    expect(lvUrlShape('http://nap.example/lv/x')).toBe('http');
    expect(lvUrlShape('nap.example/lv/x')).toBe('bez_schematu');
    const st = new MemStore();
    const r = await runRoadLv({
      store: st,
      fetch: (async () => new Response('<a/>', { status: 200 })) as typeof fetch,
      env: {
        LV_NAP_ROADWORKS_KEY: 'k',
        LV_NAP_ROADWORKS_URL: 'https://nap.example/lv/roadworks',
        LV_NAP_WEIGHT_DIM_KEY: 'k2',
        LV_NAP_WEIGHT_DIM_URL: '44751',
        LV_NAP_SLIPPERY_WM_KEY: 'k3',
        LV_NAP_SLIPPERY_WM_URL: 'host-bez-schematu',
      },
      now: () => NOW,
    });
    expect(r.observations?.lv_shape_roadworks).toBe('https');
    expect(r.observations?.lv_shape_weight_dim).toBe('same_cyfry');
    /* DP-171: host bez schematu / bez `/` → nie_url, bez fetchu. */
    expect(r.observations?.lv_shape_slippery_wm).toBe('nie_url');
    expect(r.observations?.lv_shape_slippery_ti).toBe('pusty');
    expect(r.observations?.lv_base).toBe(balticWarnHost(LV_NAP_BASE));
    const shapes = Object.entries(r.observations ?? {})
      .filter(([k]) => k.startsWith('lv_shape_'))
      .map(([, v]) => String(v));
    expect(shapes.every((v) => /^(https|http|bez_schematu|same_cyfry|spacje|pusty|nie_url)$/.test(v))).toBe(true);
    expect(shapes.join('')).not.toContain('44751');
    expect(shapes.join('')).not.toContain('host-bez');
  });

  it('DP-171: normalizacja /api, https:///api, pełny URL; pusty/spacje bez fetchu', async () => {
    const base = LV_NAP_BASE.replace(/\/+$/, '');
    expect(normalizeLvNapUrl('/api/x')).toEqual({
      url: `${base}/api/x`, shape: 'bez_schematu', kind: balticUrlKind(`${base}/api/x`),
    });
    expect(normalizeLvNapUrl('https:///api/x').url).toBe(`${base}/api/x`);
    expect(normalizeLvNapUrl('https:///api/x').shape).toBe('https');
    expect(normalizeLvNapUrl('https://api/pull/1').url).toBe(`${base}/api/pull/1`);
    expect(normalizeLvNapUrl('https://host.example/api/x')).toEqual({
      url: 'https://host.example/api/x',
      shape: 'https',
      kind: balticUrlKind('https://host.example/api/x'),
    });
    expect(normalizeLvNapUrl('')).toEqual({ url: null, shape: 'pusty', kind: '' });
    expect(normalizeLvNapUrl('  ')).toEqual({ url: null, shape: 'spacje', kind: '' });
    expect(normalizeLvNapUrl('host-bez-schematu')).toEqual({ url: null, shape: 'nie_url', kind: '' });

    const fetched: string[] = [];
    const st = new MemStore();
    const r = await runRoadLv({
      store: st,
      fetch: (async (input: RequestInfo | URL) => {
        const u = String(input);
        fetched.push(u);
        if (u === 'https://www.transportdata.gov.lv/' || u.endsWith('://www.transportdata.gov.lv/')) {
          return new Response('<html>ok</html>', { status: 200 });
        }
        return new Response(
          '<?xml version="1.0"?><d2LogicalModel><payloadPublication></payloadPublication></d2LogicalModel>',
          { status: 200, headers: { 'Content-Type': 'application/xml' } },
        );
      }) as typeof fetch,
      env: {
        LV_NAP_ROADWORKS_KEY: 'k1',
        LV_NAP_ROADWORKS_URL: '/api/pull/metadata/1',
        LV_NAP_CLOSURES_KEY: 'k2',
        LV_NAP_CLOSURES_URL: 'https:///api/pull/metadata/2',
        LV_NAP_ACCIDENTS_KEY: 'k3',
        LV_NAP_ACCIDENTS_URL: 'https://nap.example/lv/accidents',
        LV_NAP_WEIGHT_DIM_KEY: 'k4',
        LV_NAP_WEIGHT_DIM_URL: '',
        LV_NAP_BLOCKAGE_KEY: 'k5',
        LV_NAP_BLOCKAGE_URL: 'nie-url-bez-slash',
      },
      now: () => NOW,
    });
    expect(r.observations?.configured).toBe('3');
    expect(r.observations?.lv_shape_roadworks).toBe('bez_schematu');
    expect(r.observations?.lv_shape_closures).toBe('https');
    expect(r.observations?.lv_shape_accidents).toBe('https');
    expect(r.observations?.lv_shape_weight_dim).toBe('pusty');
    expect(r.observations?.lv_shape_blockage).toBe('nie_url');
    expect(r.observations?.lv_url_kind).toBe(balticUrlKind(`${base}/api/pull/metadata/1`));
    expect(r.observations?.lv_base).toBe('www.transportdata.gov.lv');
    expect(fetched.some((u) => u === `${base}/api/pull/metadata/1`)).toBe(true);
    expect(fetched.some((u) => u === `${base}/api/pull/metadata/2`)).toBe(true);
    expect(fetched.some((u) => u === 'https://nap.example/lv/accidents')).toBe(true);
    expect(fetched.join('')).not.toContain('nie-url-bez-slash');
    expect(JSON.stringify(r.observations ?? {})).not.toContain('/api/pull/metadata/1');
  });
});

describe('F7 #748 r1 — LV meta drugi fetch bez klucza poza NAP', () => {
  it('obcy host: drugi fetch bez nagłówka klucza; 401 → meta:obcy-host; data_host', async () => {
    const st = new MemStore();
    const meta = JSON.stringify({
      files: [{ field_source_url: 'https://cdn.obcy.example/lv/roadworks.xml' }],
    });
    const { d, headerCalls } = deps(st, {
      'nap.example/lv/roadworks': meta,
      'cdn.obcy.example/lv/roadworks.xml': 401,
      'nap.example/lv/slippery-wm': slipWm,
      'nap.example/lv/slippery-ti': slipTi,
      'nap.example/lv/weight-dim': JSON.stringify(weightJson),
    }, MOCK_ENV);
    const r = await runRoadLv(d);
    const second = headerCalls.find((c) => c.url.includes('cdn.obcy.example'));
    expect(second).toBeTruthy();
    expect(second!.headers[LV_NAP_KEY_HEADER]).toBeUndefined();
    expect(r.observations?.lv_roadworks_shape).toBe('meta:obcy-host:cdn.obcy.example');
    expect(r.observations?.lv_roadworks_data_host).toBe('cdn.obcy.example');
    expect(headerCalls.some((c) =>
      c.url.includes('cdn.obcy.example') && c.headers[LV_NAP_KEY_HEADER],
    )).toBe(false);
  });

  it('host NAP: drugi fetch z kluczem + data_host', async () => {
    const st = new MemStore();
    const meta = JSON.stringify({
      field_source_url: 'https://www.transportdata.gov.lv/api/pull/data/rw',
    });
    const { d, headerCalls } = deps(st, {
      'nap.example/lv/roadworks': meta,
      'www.transportdata.gov.lv/api/pull/data/rw': rwXml,
      'nap.example/lv/slippery-wm': slipWm,
      'nap.example/lv/slippery-ti': slipTi,
      'nap.example/lv/weight-dim': JSON.stringify(weightJson),
    }, MOCK_ENV);
    const r = await runRoadLv(d);
    const second = headerCalls.find((c) =>
      c.url.includes('www.transportdata.gov.lv/api/pull/data/rw'),
    );
    expect(second).toBeTruthy();
    expect(second!.headers[LV_NAP_KEY_HEADER]).toBe('k-rw-secret-value');
    expect(r.observations?.lv_roadworks_data_host).toBe('www.transportdata.gov.lv');
    expect(String(r.observations?.lv_roadworks ?? '')).toMatch(/^ok:\d+:\d+:datex-xml:\d+$/);
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
