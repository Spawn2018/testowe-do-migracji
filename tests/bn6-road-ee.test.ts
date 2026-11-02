/**
 * BN6 (#716) cz.4 — Tark Tee EE: DATEX XML/SRTI JSON, filtr korytarza, runRoadEe.
 * F7 #733 r1 B1–B9.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BALTIC_DETOUR_RE,
  CORRIDOR_EE,
  EE_ATTRIBUTION,
  EE_DATEX_FEEDS,
  EE_DATEX_KEY_HEADER,
  EE_SOURCE_REF,
  EE_UA,
  applyBalticCorridorRoadFilter,
  balticCapLongDetourClosure,
  balticSlowdownMult,
  dimensionLimitRisk,
  eeDatexApiKey,
  eeDatexFeedUrl,
  eeRoadOnCorridor,
  eeSeverityForRecord,
  extractBalticRoadRef,
  filterInEeBboxes,
  hasDatexMarker,
  minDistToCorridorKm,
  nearEePortTerminal,
  normalizeEeRoadRef,
  parseEeDatexXml,
  parseEeFeedBody,
  parseEeMeasurementSites,
  parseEeSrtiJson,
  parseEeWeatherData,
  stripBalticDetourText,
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
const sitesXml = readFileSync(resolve('tests/fixtures/ee-tarktee-measurement-sites-sample.xml'), 'utf8');
const weatherXml = readFileSync(resolve('tests/fixtures/ee-tarktee-weather-sample.xml'), 'utf8');
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

  it('F7 B9: wysokość z heightCharacteristic/vehicleHeight → dimensionLimitRisk', () => {
    const h = parseEeDatexXml(restXml, 'RESTRICTIONS').find((e) => e.id === 'bn6-ee-height-t4')!;
    expect(h.heightLimitM).toBe(4.2);
    const r = dimensionLimitRisk('EE', h, EE_SOURCE_REF, EE_ATTRIBUTION);
    expect(r.severity).toBe('MEDIUM');
    expect(r.titleKey).toBe('rk_road_baltic_dim_check');
  });

  it('F7 B1: goły numer „4 Tallinn–Pärnu–Ikla” → T4 on; 11101 → off', () => {
    expect(normalizeEeRoadRef('4')).toBe('T4');
    expect(normalizeEeRoadRef(extractBalticRoadRef('4 Tallinn–Pärnu–Ikla'))).toBe('T4');
    expect(eeRoadOnCorridor('4 Tallinn–Pärnu–Ikla', { lat: 58.385, lon: 24.498 })).toBe('on');
    expect(eeRoadOnCorridor('11101', { lat: 58.385, lon: 24.498 })).toBe('off');
    const bare = parseEeDatexXml(restXml, 'RESTRICTIONS').find((e) => e.id === 'bn6-ee-bare-4')!;
    expect(bare.road).toBe('T4');
    expect(eeRoadOnCorridor(bare.road, bare)).toBe('on');
  });

  it('F7 B2: ümbersõit w wspólnym regexie — strip + długie zamknięcie → MEDIUM', () => {
    expect(BALTIC_DETOUR_RE.test('Ümbersõit mööda T4')).toBe(true);
    const blob = 'Tee nr 15128 suletud. Ümbersõit mööda T4';
    expect(stripBalticDetourText(blob)).not.toMatch(/\bT4\b/);
    const det = parseEeDatexXml(restXml, 'RESTRICTIONS').find((e) => e.id === 'bn6-ee-detour-local')!;
    expect(det.hasDetour).toBe(true);
    expect(det.road).not.toBe('T4');
    const capped = balticCapLongDetourClosure(det, NOW.getTime());
    expect(capped.severity).toBe('MEDIUM');
  });

  it('F7 B3 / r2 B3: CORRIDOR_EE T4 + T11 Jüri/Väo + T8 Keila; wschód > 3 km', () => {
    expect(minDistToCorridorKm(58.904, 24.425, CORRIDOR_EE)).toBeLessThan(1);
    expect(minDistToCorridorKm(59.13, 24.43, CORRIDOR_EE)).toBeLessThan(1);
    expect(minDistToCorridorKm(59.354, 24.893, CORRIDOR_EE)).toBeLessThan(3); // Jüri T11
    expect(minDistToCorridorKm(59.413, 24.884, CORRIDOR_EE)).toBeLessThan(3); // Väo
    expect(minDistToCorridorKm(59.308, 24.413, CORRIDOR_EE)).toBeLessThan(3); // Keila T8
    expect(minDistToCorridorKm(58.80, 24.70, CORRIDOR_EE)).toBeGreaterThan(3);
    expect(minDistToCorridorKm(59.20, 24.70, CORRIDOR_EE)).toBeGreaterThan(3);
  });

  it('F7 B4: hasDatexMarker — message/null/[]/Error/HTML → unknown', () => {
    expect(hasDatexMarker(restXml, 'xml')).toBe(true);
    expect(parseEeFeedBody('{"message":"Forbidden"}', 'SRTI_ACCIDENT', 'json').format).toBe('unknown');
    expect(parseEeFeedBody('null', 'SRTI_ACCIDENT', 'json').format).toBe('unknown');
    expect(parseEeFeedBody('[]', 'SRTI_ACCIDENT', 'json').format).toBe('unknown');
    expect(parseEeFeedBody('<Error>denied</Error>', 'RESTRICTIONS', 'xml').format).toBe('unknown');
    expect(parseEeFeedBody(
      '<!DOCTYPE html><html><body>payloadPublication mentioned</body></html>',
      'RESTRICTIONS',
      'xml',
    ).format).toBe('unknown');
    /* F7 r3: brak struktury → unknown; pusta poprawna → datex-json (0) */
    expect(parseEeFeedBody(
      '{"message":"Forbidden","payload":null}',
      'SRTI_ACCIDENT',
      'json',
    ).format).toBe('unknown');
    const emptyFeat = parseEeFeedBody('{"features":[]}', 'SRTI_ACCIDENT', 'json');
    expect(emptyFeat.format).toBe('datex-json');
    expect(emptyFeat.events).toHaveLength(0);
    const emptyPub = parseEeFeedBody(
      '{"payload":{"situationPublication":{}}}',
      'SRTI_ACCIDENT',
      'json',
    );
    expect(emptyPub.format).toBe('datex-json');
    expect(emptyPub.events).toHaveLength(0);
  });

  it('F7 B5 / r2 B1: nested weather — jäide / zimno+RH / mgła → HIGH+slow; märg → nie', () => {
    const sites = parseEeMeasurementSites(sitesXml);
    expect(sites.has('ee-site-t4-marjamaa')).toBe(true);
    const stats = { parsed: 0, skipped: 0, swapped: 0, weatherBlocks: 0, weatherNoSite: 0 };
    const wx = parseEeWeatherData(weatherXml, sites, stats);
    expect(wx.some((e) => /jäide|libedus/i.test(e.detail ?? ''))).toBe(true);
    const icy = wx.find((e) => /jäide|libedus/i.test(e.detail ?? ''))!;
    expect(icy.severity).toBe('HIGH');
    expect(wx.some((e) => /temp nawierzchni -1/i.test(e.detail ?? '') && e.severity === 'HIGH')).toBe(true);
    expect(wx.some((e) => /widocznosc 120/i.test(e.detail ?? '') && e.severity === 'HIGH')).toBe(true);
    /* id z czasem pomiaru (dwa pomiary tej samej stacji) */
    expect(wx.filter((e) => e.id.startsWith('ee-wx:ee-site-t4-marjamaa')).length).toBeGreaterThanOrEqual(2);
    const near = applyBalticCorridorRoadFilter('EE', wx);
    const onIcy = near.find((e) => e.id === icy.id)!;
    expect(onIcy.corridorMatch).toBe('on');
    const slow = balticSlowdownMult(near.filter((e) => e.corridorMatch === 'on'));
    expect(slow.mult).toBeGreaterThan(1);
    expect(slow.reason ?? '').toMatch(/pogoda/);
    /* sama mokra nawierzchnia bez lodu — brak zdarzenia z samym „märg” */
    expect(wx.filter((e) => /märg/i.test(e.detail ?? '') && !/temp|widocznosc|jäide|libedus/i.test(e.detail ?? ''))).toHaveLength(0);
    expect(stats.weatherNoSite).toBeGreaterThanOrEqual(1);
  });

  it('F7 B7: atrybucja Transpordiamet / Tark Tee (tarktee.ee)', () => {
    expect(EE_ATTRIBUTION).toBe('Transpordiamet / Tark Tee (tarktee.ee)');
  });

  it('parseEeSrtiJson: wypadek przy porcie; blokada HIGH', () => {
    const acc = parseEeSrtiJson(srtiJson, 'SRTI_ACCIDENT');
    expect(acc.length).toBeGreaterThanOrEqual(2);
    const port = acc.find((e) => e.id === 'bn6-ee-acc-tallinn')!;
    expect(port.lat).toBeCloseTo(59.444, 3);
    expect(eeSeverityForRecord('SRTI_ACCIDENT', 'UnprotectedAccident', {
      contentText: 'UnprotectedAccident',
    })).toBe('MEDIUM');
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

  it('filtr bbox + corridor: Narva off; Pärnu on', () => {
    const raw = parseEeDatexXml(restXml, 'RESTRICTIONS');
    const boxed = filterInEeBboxes(raw);
    expect(boxed.some((e) => e.id === 'bn6-ee-far-east')).toBe(false);
    const near = applyBalticCorridorRoadFilter('EE', boxed);
    const parnu = near.find((e) => e.id === 'bn6-ee-rw-parnu')!;
    expect(parnu.corridorMatch).toBe('on');
  });

  it('weightLimitRisk bez masy ładunku → MEDIUM check', () => {
    const e = parseEeDatexXml(restXml, 'RESTRICTIONS').find((x) => x.id === 'bn6-ee-weight-t4')!;
    const r = weightLimitRisk('EE', e, null, EE_SOURCE_REF, EE_ATTRIBUTION);
    expect(r.severity).toBe('MEDIUM');
    expect(r.titleKey).toBe('rk_road_baltic_weight_check');
  });

  it('eeDatexApiKey: TOKEN przed PASSWORD (N5); bez USER', () => {
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

  it('LIVE: nagłówek X-DATEX-API-KEY; :swapped w obs; raise tylko on', async () => {
    const store = new MemStore();
    const pages: Record<string, string | number> = {};
    for (const f of EE_DATEX_FEEDS) {
      const url = eeDatexFeedUrl(f.path);
      if (f.code === 'RESTRICTIONS') pages[url] = restXml;
      else if (f.code === 'MEASUREMENT_SITES') pages[url] = sitesXml;
      else if (f.code === 'WEATHER') pages[url] = weatherXml;
      else if (f.code === 'SRTI_ACCIDENT' || f.code === 'SRTI_BLOCKAGE') {
        pages[url] = JSON.stringify(srtiJson);
      } else {
        pages[url] = '<?xml version="1.0"?><d2LogicalModel><payloadPublication></payloadPublication></d2LogicalModel>';
      }
    }
    const { d, headerCalls } = deps(store, pages);
    const res = await runRoadEe(d);
    expect(headerCalls.some((c) => c.headers[EE_DATEX_KEY_HEADER] === 'test-ee-key')).toBe(true);
    expect(headerCalls.every((c) => (c.headers['User-Agent'] ?? '').includes('road-ee'))).toBe(true);
    expect(EE_UA).toContain('road-ee');
    expect(res.observations?.source).toBe('tarktee_datex');
    expect(res.observations?.key_env_first).toBe('TARKTEE_DATEX_TOKEN');
    expect(Number(res.observations?.fetched_ok)).toBeGreaterThan(0);
    /* F7 B8 — per-usługa z :swapped */
    const restObs = String(res.observations?.ee_restrictions ?? '');
    expect(restObs).toMatch(/^ok:\d+:\d+:datex-xml:\d+$/);
    expect(store.risks.every((r) => r.kind === 'ROAD_EE')).toBe(true);
    expect(store.risks.some((r) => String(r.detail?.opis ?? '').includes('Narva'))).toBe(false);
    expect(store.risks.every((r) => r.detail?.zrodlo === EE_ATTRIBUTION)).toBe(true);
    expect(store.corridor?.corridor).toBe('ROAD_EE');
    expect(store.staleCalls.some((s) => s.prefix === 'ROAD_EE:')).toBe(true);
  });

  it('F7 B4: 4× SRTI {"message"} → incomplete, bez resolveStale', async () => {
    const store = new MemStore();
    const pages: Record<string, string | number> = {};
    for (const f of EE_DATEX_FEEDS) {
      const url = eeDatexFeedUrl(f.path);
      if (f.code === 'RESTRICTIONS') pages[url] = restXml;
      else if (f.code.startsWith('SRTI_')) pages[url] = '{"message":"Forbidden"}';
      else if (f.code === 'MEASUREMENT_SITES') pages[url] = sitesXml;
      else {
        pages[url] = '<?xml version="1.0"?><d2LogicalModel><payloadPublication></payloadPublication></d2LogicalModel>';
      }
    }
    const { d } = deps(store, pages);
    const res = await runRoadEe(d);
    expect(res.observations?.complete).toBe('0');
    expect(store.staleCalls.some((s) => s.prefix === 'ROAD_EE:')).toBe(false);
  });

  it('F7 r2 B2: 0 measurementSites → complete=0, ostrzeżenie brak stacji, bez resolveStale', async () => {
    const store = new MemStore();
    const emptySites =
      '<?xml version="1.0"?><d2LogicalModel><payloadPublication xsi:type="MeasurementSiteTablePublication">'
      + '<measurementSiteTable></measurementSiteTable></payloadPublication></d2LogicalModel>';
    const pages: Record<string, string | number> = {};
    for (const f of EE_DATEX_FEEDS) {
      const url = eeDatexFeedUrl(f.path);
      if (f.code === 'RESTRICTIONS') pages[url] = restXml;
      else if (f.code === 'MEASUREMENT_SITES') pages[url] = emptySites;
      else if (f.code === 'WEATHER') pages[url] = weatherXml;
      else if (f.code.startsWith('SRTI_')) pages[url] = JSON.stringify(srtiJson);
      else {
        pages[url] = '<?xml version="1.0"?><d2LogicalModel><payloadPublication></payloadPublication></d2LogicalModel>';
      }
    }
    const { d } = deps(store, pages);
    const res = await runRoadEe(d);
    expect(res.observations?.measurement_sites).toBe('0');
    expect(res.observations?.complete).toBe('0');
    expect(res.warnings?.some((w) => /brak stacji/i.test(w))).toBe(true);
    expect(store.staleCalls.some((s) => s.prefix === 'ROAD_EE:')).toBe(false);
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

  it('DP-169: timeout w warning z hostem tarktee.ee, bez ścieżki i klucza', async () => {
    const store = new MemStore();
    const f = (async () => {
      throw new DOMException('The operation was aborted.', 'AbortError');
    }) as typeof fetch;
    const d: JobDeps = {
      store,
      fetch: f,
      env: { TARKTEE_DATEX_TOKEN: 'sekret-ee-xyz' },
      now: () => new Date('2026-11-02T12:00:00Z'),
    };
    const res = await runRoadEe(d);
    expect(res.warnings?.some((w) => /timeout tarktee\.ee/i.test(w))).toBe(true);
    expect(JSON.stringify(res)).not.toContain('sekret-ee-xyz');
    expect(JSON.stringify(res)).not.toMatch(/\/api\/v1\/datex\//);
  });
});
