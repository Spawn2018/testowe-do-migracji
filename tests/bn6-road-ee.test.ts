/**
 * BN6 (#716) cz.4 — Tark Tee EE: DATEX XML/SRTI JSON, filtr korytarza, runRoadEe.
 * F7 #733 r1 B1–B9.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BALTIC_DETOUR_RE,
  BALTIC_FEED_MAX_BYTES,
  BALTIC_ICY_WORDS,
  CORRIDOR_EE,
  EE_ATTRIBUTION,
  EE_DATEX_FEEDS,
  EE_DATEX_KEY_HEADER,
  EE_FEED_TIMEOUT_MS,
  EE_HEAVY_FEED_CACHE_TTL_MS,
  EE_ICY_CONTENT_RE,
  EE_RESTRICTIONS_MAX_BYTES,
  EE_RESTRICTIONS_TIMEOUT_MS,
  EE_SOURCE_REF,
  EE_UA,
  LV_ICY_CONTENT_RE,
  applyBalticCorridorRoadFilter,
  balticCapLongDetourClosure,
  balticFeedObsKey,
  balticFeedObsOk,
  balticFeedShapeObs,
  balticKeyMeta,
  balticRoadLabel,
  balticShortPlace,
  balticSlowdownMult,
  classifyBalticFeedClass,
  classifyBalticNetError,
  lvMetadataDataUrl,
  lvNapKeyAllowedForUrl,
  clearEeHeavyFeedCache,
  clearEeSitesCache,
  dimensionLimitRisk,
  EE_PROBE_API_PATH,
  eeDatexApiKey,
  eeDatexApiKeyMeta,
  eeDatexFeedUrl,
  eeIsDatexPublicationEnvelope,
  eeRoadOnCorridor,
  formatBalticRoadTitle,
  formatEeWeatherDetailPl,
  nearestCorridorRoad,
  probeEeDatexApi,
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
  readBalticFeedBody,
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
    /* DP-168 N3: limit masy z liczbą → MEDIUM w parserze. */
    expect(w.severity).toBe('MEDIUM');
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

  it('F7 B4 / DP-178: hasDatexMarker — message/null/Error/HTML → unknown; [] = OK', () => {
    expect(hasDatexMarker(restXml, 'xml')).toBe(true);
    expect(parseEeFeedBody('{"message":"Forbidden"}', 'SRTI_ACCIDENT', 'json').format).toBe('unknown');
    expect(parseEeFeedBody('null', 'SRTI_ACCIDENT', 'json').format).toBe('unknown');
    /* DP-178 pkt 3 (#735): pusty [] = OK 0 rekordów (nie bad:unknown). */
    const emptyArr = parseEeFeedBody('[]', 'SRTI_ACCIDENT', 'json');
    expect(emptyArr.format).toBe('datex-json');
    expect(emptyArr.events).toHaveLength(0);
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
    /* DP-180: pusta koperta DATEX (feedType/…) bez situationRecord = OK 0 rekordów. */
    const emptyEnvelope = {
      feedDescription: 'SRTI unprotectedAccident',
      feedType: 'SRTI',
      publicationTime: '2026-11-03T03:00:00Z',
      publicationCreator: { nationalIdentifier: 'EE' },
      payloadPublicationExtension: {},
    };
    expect(eeIsDatexPublicationEnvelope(emptyEnvelope)).toBe(true);
    expect(hasDatexMarker(JSON.stringify(emptyEnvelope), 'json')).toBe(false);
    const envParsed = parseEeFeedBody(
      JSON.stringify(emptyEnvelope),
      'SRTI_ACCIDENT',
      'json',
    );
    expect(envParsed.format).toBe('datex-json');
    expect(envParsed.events).toHaveLength(0);
    const envRoadworks = parseEeFeedBody(
      JSON.stringify({ ...emptyEnvelope, feedDescription: 'shortTermRoadWorks' }),
      'SRTI_ROADWORKS',
      'json',
    );
    expect(envRoadworks.format).toBe('datex-json');
    expect(envRoadworks.events).toHaveLength(0);
  });

  it('DP-178: shape obs + LV metadata URL + RESTRICTIONS 20 MB', () => {
    expect(EE_RESTRICTIONS_MAX_BYTES).toBe(20 * 1024 * 1024);
    expect(classifyBalticFeedClass('<!DOCTYPE html><html></html>', 'text/html')).toBe('html');
    expect(classifyBalticFeedClass('[]', 'application/json')).toBe('json-array-pusty');
    expect(classifyBalticFeedClass('{"files":[],"url":"x"}', 'application/json'))
      .toBe('json-obiekt:files,url');
    expect(classifyBalticFeedClass('<d2:payloadPublication xmlns:d2="x"/>', 'application/xml'))
      .toBe('xml:d2:payloadPublication');
    expect(classifyBalticFeedClass('\u001f\u008bxx', null)).toBe('gzip-nierozpakowany');
    expect(balticFeedShapeObs(200, 'application/json; charset=utf-8', 12, '[]'))
      .toBe('200:application/json:12:json-array-pusty');
    expect(lvMetadataDataUrl({
      files: [{ field_source_url: 'https://data.example.lv/feed.xml' }],
    })).toBe('https://data.example.lv/feed.xml');
    expect(lvMetadataDataUrl({ message: 'maintenance' })).toBeNull();
    /* F7 #748 r1: klucz tylko host NAP / *.transportdata.gov.lv */
    expect(lvNapKeyAllowedForUrl('https://www.transportdata.gov.lv/api/pull/x')).toBe(true);
    expect(lvNapKeyAllowedForUrl('https://api.transportdata.gov.lv/file.xml')).toBe(true);
    expect(lvNapKeyAllowedForUrl('https://cdn.example.com/feed.xml')).toBe(false);
  });

  it('F7 B5 / r2 B1 / DP-204.5: nested weather — jäide / zimno+RH / mgła → HIGH+slow; märg → nie', () => {
    const sites = parseEeMeasurementSites(sitesXml);
    expect(sites.has('ee-site-t4-marjamaa')).toBe(true);
    expect(sites.get('ee-site-t4-marjamaa')?.road).toBe('T4');
    const stats = { parsed: 0, skipped: 0, swapped: 0, weatherBlocks: 0, weatherNoSite: 0 };
    const wx = parseEeWeatherData(weatherXml, sites, stats);
    expect(wx.some((e) => /jäide|libedus/i.test(e.detail ?? ''))).toBe(true);
    const icy = wx.find((e) => /jäide|libedus/i.test(e.detail ?? ''))!;
    expect(icy.severity).toBe('HIGH');
    expect(icy.road).toBe('T4');
    expect(icy.title).toMatch(/ryzyko gołoledzi|słaba widoczność/);
    /* F7 #784 r2: −1 °C + 95 % → HIGH; 800 m → MEDIUM; 150/120 m → HIGH. */
    expect(wx.some((e) => /temperatura nawierzchni −1 °C/i.test(e.detail ?? '') && e.severity === 'HIGH')).toBe(true);
    expect(wx.some((e) => /widoczność 800 m/i.test(e.detail ?? '') && e.severity === 'MEDIUM' && e.title === 'słaba widoczność')).toBe(true);
    expect(wx.some((e) => /widoczność 150 m/i.test(e.detail ?? '') && e.severity === 'HIGH')).toBe(true);
    expect(wx.some((e) => /widoczność 120 m/i.test(e.detail ?? '') && e.severity === 'HIGH')).toBe(true);
    /* id z czasem pomiaru (dwa pomiary tej samej stacji) */
    expect(wx.filter((e) => e.id.startsWith('ee-wx:ee-site-t4-marjamaa')).length).toBeGreaterThanOrEqual(2);
    const near = applyBalticCorridorRoadFilter('EE', wx);
    const onIcy = near.find((e) => e.id === icy.id)!;
    expect(onIcy.corridorMatch).toBe('on');
    const slow = balticSlowdownMult(near.filter((e) => e.corridorMatch === 'on'));
    expect(slow.mult).toBeGreaterThan(1);
    expect(slow.reason ?? '').toMatch(/pogoda/);
    /* sama mokra nawierzchnia bez lodu — brak zdarzenia z samym „märg” */
    expect(wx.filter((e) => /märg/i.test(e.detail ?? '') && !/temp|widoczność|jäide|libedus/i.test(e.detail ?? ''))).toHaveLength(0);
    expect(stats.weatherNoSite).toBeGreaterThanOrEqual(1);
  });

  it('F7 B7: atrybucja Transpordiamet / Tark Tee (tarktee.ee)', () => {
    expect(EE_ATTRIBUTION).toBe('Transpordiamet / Tark Tee (tarktee.ee)');
  });

  it('DP-204.5 / #781 pkt 8–12: EE droga ze stacji; LV A7 z geometrii; miejsce; pogoda PL', () => {
    const sites = parseEeMeasurementSites(sitesXml);
    expect(sites.get('ee-site-t4-marjamaa')?.road).toBe('T4');
    expect(sites.get('ee-site-kose')?.name).toMatch(/Kose/i);
    const wx = parseEeWeatherData(weatherXml, sites);
    const icy = wx.find((e) => /jäide|libedus/i.test(e.detail ?? ''))!;
    expect(icy.road).toBe('T4');
    expect(formatBalticRoadTitle('EE', icy).roadLabel).toMatch(/^T4$/);
    expect(formatBalticRoadTitle('EE', icy).title).not.toMatch(/droga b\.d\./i);

    /* LV wypadek bez kodu przy A7 → A7 z geometrii korytarza. */
    const nearA7 = nearestCorridorRoad('LV', 56.83, 24.23);
    expect(nearA7).toBe('A7');
    const lvAcc = applyBalticCorridorRoadFilter('LV', [{
      id: 'lv-acc', title: 'Accident', detail: 'Wypadek',
      severity: 'HIGH', lat: 56.83, lon: 24.23, kind: 'ACCIDENTS',
      start: null, end: null, road: null,
    }])[0]!;
    expect(lvAcc.road).toBe('A7');
    expect(lvAcc.corridorMatch).toBe('on');
    expect(balticRoadLabel('LV', lvAcc.road)).toBe('A7');

    /* Punkt daleko bez numeru → nazwa miejsca, nie „b.d.” w HIGH. */
    const far = applyBalticCorridorRoadFilter('EE', [{
      id: 'ee-far', title: 'SAFETY', detail: 'Kose vald',
      severity: 'HIGH', lat: 59.18, lon: 25.17, kind: 'SAFETY',
      start: null, end: null, road: null, placeName: 'stacja Kose',
    }])[0]!;
    const farTitle = formatBalticRoadTitle('EE', far);
    expect(farTitle.roadLabel).toMatch(/Kose/i);
    expect(farTitle.roadLabel).not.toMatch(/droga b\.d\./i);
    expect(farTitle.title).not.toMatch(/droga b\.d\./i);

    /* Tytuł bez wykonawcy/telefonu; ≤ 40 znaków miejsca. */
    const short = balticShortPlace(
      'Remont drogi. Wykonawca: AB „Kauno tiltai”, tel. +370 600 00000, odcinek Kaunas–Rumšiškės',
      { road: 'A1', typePl: 'roboty drogowe', maxLen: 40 },
    );
    expect(short.length).toBeLessThanOrEqual(40);
    expect(short).not.toMatch(/Wykonawca|tel\.|\+370/i);

    const pl = formatEeWeatherDetailPl({
      surfaceTempC: -0.8, humidityPct: 92, visibilityM: 20_000,
    });
    expect(pl).toBe('temperatura nawierzchni −0,8 °C · wilgotność 92% · widoczność 20 km');
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
    expect(eeDatexApiKeyMeta({ TARKTEE_DATEX_TOKEN: 'tok\n' })).toEqual({
      key: 'tok', key_len: 3, key_trimmed: 1, key_header_sent: 1,
    });
    expect(balticKeyMeta('  ')).toEqual({
      key: '', key_len: 0, key_trimmed: 1, key_header_sent: 0,
    });
  });
});

describe('BN6 runRoadEe', () => {
  beforeEach(() => {
    clearEeSitesCache();
    clearEeHeavyFeedCache();
  });

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
    const pages: Record<string, string | number> = {
      'https://tarktee.ee/': '<html>ok</html>',
    };
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
    const probeCalls = headerCalls.filter((c) => c.url === 'https://tarktee.ee/');
    expect(probeCalls.length).toBe(1);
    expect(probeCalls[0]!.headers[EE_DATEX_KEY_HEADER]).toBeUndefined();
    expect(headerCalls.some((c) => c.headers[EE_DATEX_KEY_HEADER] === 'test-ee-key')).toBe(true);
    expect(headerCalls.every((c) => (c.headers['User-Agent'] ?? '').includes('road-ee'))).toBe(true);
    expect(EE_UA).toContain('road-ee');
    expect(res.observations?.source).toBe('tarktee_datex');
    expect(res.observations?.key_env_first).toBe('TARKTEE_DATEX_TOKEN');
    expect(res.observations?.probe_ee).toMatch(/^200:\d+$/);
    /* DP-170: sonda API 45 s — animalObstacle + gzip; DP-171: feedy też 30 s + gzip. */
    expect(res.observations?.ee_probe_api).toMatch(/^200:\d+:\d+$/);
    expect(EE_FEED_TIMEOUT_MS).toBe(30_000);
    const apiProbeCalls = headerCalls.filter((c) =>
      c.url.includes(EE_PROBE_API_PATH) && c.headers[EE_DATEX_KEY_HEADER] === 'test-ee-key'
      && c.headers['Accept-Encoding'] === 'gzip');
    expect(apiProbeCalls.length).toBeGreaterThanOrEqual(1);
    const feedGzip = headerCalls.filter((c) =>
      c.url.includes('/api/v1/datex/')
      && !c.url.includes(EE_PROBE_API_PATH)
      && c.headers[EE_DATEX_KEY_HEADER] === 'test-ee-key');
    expect(feedGzip.length).toBeGreaterThan(0);
    expect(feedGzip.every((c) => c.headers['Accept-Encoding'] === 'gzip')).toBe(true);
    expect(res.observations?.key_header_sent).toBe('1');
    expect(res.observations?.key_len).toBe(String('test-ee-key'.length));
    expect(res.observations?.key_trimmed).toBe('0');
    expect(Number(res.observations?.fetched_ok)).toBeGreaterThan(0);
    expect(res.observations?.ee_sites_source).toBe('fetch');
    expect(res.observations?.ee_restrictions_ms).toMatch(/^\d+$/);
    expect(res.observations?.ee_measurement_sites_ms).toMatch(/^\d+$/);
    /* F7 B8 — per-usługa z :swapped */
    const restObs = String(res.observations?.ee_restrictions ?? '');
    expect(restObs).toMatch(/^ok:\d+:\d+:datex-xml:\d+$/);
    expect(store.risks.every((r) => r.kind === 'ROAD_EE')).toBe(true);
    expect(store.risks.some((r) => String(r.detail?.opis ?? '').includes('Narva'))).toBe(false);
    expect(store.risks.every((r) => r.detail?.zrodlo === EE_ATTRIBUTION)).toBe(true);
    expect(store.corridor?.corridor).toBe('ROAD_EE');
    expect(store.staleCalls.some((s) => s.prefix === 'ROAD_EE:')).toBe(true);
    expect(EE_RESTRICTIONS_TIMEOUT_MS).toBe(45_000);
    expect(EE_HEAVY_FEED_CACHE_TTL_MS).toBe(60 * 60 * 1000);
    expect(res.observations?.ee_restrictions_source).toBe('fetch');
  });

  it('DP-180: RESTRICTIONS/SAFETY z cache w TTL 60 min; complete OK; source=cache', async () => {
    const pages: Record<string, string | number> = {
      'https://tarktee.ee/': '<html>ok</html>',
    };
    for (const f of EE_DATEX_FEEDS) {
      const url = eeDatexFeedUrl(f.path);
      if (f.code === 'RESTRICTIONS') pages[url] = restXml;
      else if (f.code === 'SAFETY') {
        pages[url] = '<?xml version="1.0"?><d2LogicalModel><payloadPublication></payloadPublication></d2LogicalModel>';
      } else if (f.code === 'MEASUREMENT_SITES') pages[url] = sitesXml;
      else if (f.code === 'WEATHER') pages[url] = weatherXml;
      else if (f.code === 'SRTI_ACCIDENT' || f.code === 'SRTI_BLOCKAGE') {
        pages[url] = JSON.stringify(srtiJson);
      } else if (f.code.startsWith('SRTI_')) {
        pages[url] = JSON.stringify({
          feedType: 'SRTI',
          publicationTime: '2026-11-03T03:00:00Z',
          payloadPublicationExtension: {},
        });
      } else {
        pages[url] = '<?xml version="1.0"?><d2LogicalModel><payloadPublication></payloadPublication></d2LogicalModel>';
      }
    }
    const store1 = new MemStore();
    const { d: d1, headerCalls: h1 } = deps(store1, pages);
    const r1 = await runRoadEe(d1);
    expect(r1.observations?.ee_restrictions_source).toBe('fetch');
    expect(r1.observations?.ee_safety_source).toBe('fetch');
    const restFetches1 = h1.filter((c) => c.url.includes('/restrictions')).length;
    expect(restFetches1).toBeGreaterThanOrEqual(1);

    const store2 = new MemStore();
    const { d: d2, headerCalls: h2 } = deps(store2, pages);
    const r2 = await runRoadEe(d2);
    expect(r2.observations?.ee_restrictions_source).toBe('cache');
    expect(r2.observations?.ee_safety_source).toBe('cache');
    expect(String(r2.observations?.ee_restrictions ?? '')).toMatch(/^ok:\d+:0:cache:0$/);
    expect(h2.filter((c) => c.url.includes('/restrictions')).length).toBe(0);
    expect(h2.filter((c) => c.url.includes('/safetyData')).length).toBe(0);
    expect(Number(r2.observations?.fetched_ok)).toBe(Number(r2.observations?.expected_fetches));
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
    expect(res.observations?.probe_ee).toMatch(/^timeout:\d+$/);
    expect(res.observations?.ee_probe_api).toMatch(/^timeout:\d+:0$/);
    expect(res.observations?.key_header_sent).toBe('1');
    expect(res.observations?.key_len).toBe(String('sekret-ee-xyz'.length));
    expect(JSON.stringify(res)).not.toContain('sekret-ee-xyz');
    expect(JSON.stringify(res)).not.toMatch(/\/api\/v1\/datex\//);
  });

  it('DP-170: probeEeDatexApi → kod:ms:bajty; Accept-Encoding gzip; klucz w nagłówku', async () => {
    const body = JSON.stringify({ situation: [] });
    const f = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      const hdrs = (init?.headers ?? {}) as Record<string, string>;
      expect(hdrs['Accept-Encoding']).toBe('gzip');
      expect(hdrs[EE_DATEX_KEY_HEADER]).toBe('k');
      return new Response(body, {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Content-Length': String(body.length) },
      });
    }) as typeof fetch;
    const out = await probeEeDatexApi(f, 'k', EE_UA);
    expect(out).toMatch(/^200:\d+:\d+$/);
    const bytes = Number(out.split(':')[2]);
    expect(bytes).toBe(body.length);
  });

  /* F7 #739 B1 — próba 45 s równolegle z pulą; przy wiszącym API całość < 75 s. */
  it('F7 #739 B1: wiszące ee_probe_api równolegle z feedami — przebieg < 75 s', async () => {
    vi.useFakeTimers();
    try {
      const store = new MemStore();
      const pages: Record<string, string | number> = {
        'https://tarktee.ee/': '<html>ok</html>',
      };
      for (const feed of EE_DATEX_FEEDS) {
        const url = eeDatexFeedUrl(feed.path);
        if (feed.code === 'RESTRICTIONS') pages[url] = restXml;
        else if (feed.code === 'MEASUREMENT_SITES') pages[url] = sitesXml;
        else if (feed.code === 'WEATHER') pages[url] = weatherXml;
        else if (feed.code === 'SRTI_ACCIDENT' || feed.code === 'SRTI_BLOCKAGE') {
          pages[url] = JSON.stringify(srtiJson);
        } else {
          pages[url] = '<?xml version="1.0"?><d2LogicalModel><payloadPublication></payloadPublication></d2LogicalModel>';
        }
      }
      let probeSettled = false;
      let feedDuringProbe = false;
      const f = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes(EE_PROBE_API_PATH)) {
          await new Promise<never>((_, reject) => {
            const abort = () => {
              probeSettled = true;
              reject(new DOMException('The operation was aborted.', 'AbortError'));
            };
            if (init?.signal?.aborted) abort();
            else init?.signal?.addEventListener('abort', abort, { once: true });
          });
        }
        if (!probeSettled && url.includes('/api/v1/datex/') && !url.includes(EE_PROBE_API_PATH)) {
          feedDuringProbe = true;
        }
        const body = pages[url];
        if (body === undefined) return new Response('missing', { status: 404 });
        if (typeof body === 'number') return new Response('err', { status: body });
        return new Response(body, {
          status: 200,
          headers: { 'Content-Type': url.includes('srti') ? 'application/json' : 'application/xml' },
        });
      }) as typeof fetch;
      const started = Date.now();
      const runP = runRoadEe({
        store,
        fetch: f,
        env: { TARKTEE_DATEX_TOKEN: 'test-ee-key' },
        now: () => new Date(Date.now()),
      });
      await vi.advanceTimersByTimeAsync(74_000);
      const res = await runP;
      expect(Date.now() - started).toBeLessThan(75_000);
      expect(feedDuringProbe).toBe(true);
      expect(res.observations?.ee_probe_api).toMatch(/^timeout:\d+:0$/);
      expect(Number(res.observations?.fetched_ok)).toBeGreaterThan(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('F7 #736 B2: EE klucz z \\n → trim, key_trimmed=1, wartość poza obs', async () => {
    const store = new MemStore();
    const pages: Record<string, string | number> = { 'https://tarktee.ee/': '<html>ok</html>' };
    for (const f of EE_DATEX_FEEDS) {
      pages[eeDatexFeedUrl(f.path)] = f.format === 'json'
        ? JSON.stringify(srtiJson)
        : '<?xml version="1.0"?><d2LogicalModel><payloadPublication></payloadPublication></d2LogicalModel>';
    }
    pages[eeDatexFeedUrl('restrictions')] = restXml;
    pages[eeDatexFeedUrl('measurementSites')] = sitesXml;
    const headerVals: string[] = [];
    const base = deps(store, pages, { TARKTEE_DATEX_TOKEN: 'ee-key-trim\n' });
    const f = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const hdrs = (init?.headers ?? {}) as Record<string, string>;
      if (hdrs[EE_DATEX_KEY_HEADER]) headerVals.push(hdrs[EE_DATEX_KEY_HEADER]);
      return base.d.fetch(input, init);
    }) as typeof fetch;
    const res = await runRoadEe({ ...base.d, fetch: f });
    expect(res.observations?.key_trimmed).toBe('1');
    expect(res.observations?.key_len).toBe(String('ee-key-trim'.length));
    expect(headerVals.every((v) => v === 'ee-key-trim' && !v.includes('\n'))).toBe(true);
    expect(JSON.stringify(res.observations ?? {})).not.toContain('ee-key-trim');
  });
});

describe('DP-168 roadBaltic shared', () => {
  it('balticFeedObsOk / key — szablon <kraj>_<usługa>=ok:…', () => {
    expect(balticFeedObsOk(3, 1, 'datex-xml', 0)).toBe('ok:3:1:datex-xml:0');
    expect(balticFeedObsKey('EE', 'SRTI_ACCIDENT')).toBe('ee_srti_accident');
    expect(balticFeedObsKey('lv', 'ROADWORKS')).toBe('lv_roadworks');
  });

  it('wspólny regex pogody: jedna lista słów; jäide raz; märg nie', () => {
    expect(BALTIC_ICY_WORDS.ee.filter((w) => w.includes('jäide'))).toHaveLength(1);
    expect(EE_ICY_CONTENT_RE.test('Jäide, libedus teel')).toBe(true);
    expect(EE_ICY_CONTENT_RE.test('märg tee')).toBe(false);
    expect(LV_ICY_CONTENT_RE.test('slidens ceļš, ledus')).toBe(true);
    expect(LV_ICY_CONTENT_RE.test('policeForces')).toBe(false);
  });

  /* F7 #737 B1 — \\w* nie łapało ē/ā; [\\p{L}\\p{M}]* tak. */
  it('F7 #737 B1: apledējis / apledējusi → lód; Šlapia / märg / police → nie', () => {
    expect(LV_ICY_CONTENT_RE.test('Ceļš apledējis')).toBe(true);
    expect(LV_ICY_CONTENT_RE.test('apledējusi brauktuve')).toBe(true);
    expect(LV_ICY_CONTENT_RE.test('slidenā ceļa')).toBe(true);
    expect(LV_ICY_CONTENT_RE.test('Šlapia')).toBe(false);
    expect(EE_ICY_CONTENT_RE.test('märg')).toBe(false);
    expect(LV_ICY_CONTENT_RE.test('police')).toBe(false);
  });

  it('readBalticFeedBody: Content-Length > 5 MB → too_large; strumień OK', async () => {
    const bigCl = new Response('x', {
      status: 200,
      headers: { 'Content-Length': String(BALTIC_FEED_MAX_BYTES + 1) },
    });
    expect(await readBalticFeedBody(bigCl)).toEqual({
      ok: false, reason: 'too_large', bytes: BALTIC_FEED_MAX_BYTES + 1,
    });

    const ok = new Response('<?xml ok?>', { status: 200 });
    const okBody = await readBalticFeedBody(ok);
    expect(okBody).toEqual({ ok: true, text: '<?xml ok?>', bytes: '<?xml ok?>'.length });

    const over = new Response(new Uint8Array(BALTIC_FEED_MAX_BYTES + 8), { status: 200 });
    const overBody = await readBalticFeedBody(over);
    expect(overBody.ok).toBe(false);
    if (!overBody.ok) expect(overBody.reason).toBe('too_large');

    /* DP-178: RESTRICTIONS 20 MB — Content-Length 6 MB: default too_large, limit 20 MB OK. */
    const midCl = String(6 * 1024 * 1024);
    expect(await readBalticFeedBody(new Response('x', {
      status: 200, headers: { 'Content-Length': midCl },
    }))).toMatchObject({ ok: false, reason: 'too_large' });
    expect(await readBalticFeedBody(new Response('ok-restr', {
      status: 200, headers: { 'Content-Length': midCl },
    }), EE_RESTRICTIONS_MAX_BYTES)).toEqual({ ok: true, text: 'ok-restr', bytes: 8 });
  });

  /* F7 #737 B2 — AbortError w trakcie czytania → classifyBalticNetError = timeout. */
  it('F7 #737 B2: abort w trakcie czytania → timeout (nie „sieć”)', async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('<partial'));
        controller.error(new DOMException('The operation was aborted.', 'AbortError'));
      },
    });
    const res = new Response(stream, { status: 200 });
    let caught: unknown;
    try {
      await readBalticFeedBody(res);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(DOMException);
    expect((caught as DOMException).name).toBe('AbortError');
    expect(classifyBalticNetError(caught)).toBe('timeout');
  });

  it('N3: eeSeverityForRecord z weightLimitT → MEDIUM', () => {
    expect(eeSeverityForRecord('RESTRICTIONS', 'weight', { weightLimitT: 40 })).toBe('MEDIUM');
  });
});
