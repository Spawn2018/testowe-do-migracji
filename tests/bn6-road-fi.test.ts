/**
 * BN6 (#716) cz.1 — Digitraffic FI: parser, bbox, filtr korytarza, limity masy, runRoadFi (F7 #726).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CORRIDOR_FI,
  FI_ANNOUNCEMENTS_URL,
  FI_ATTRIBUTION,
  FI_BBOX_LIMIT,
  FI_ROADWORKS_URL,
  FI_WEIGHT_URL,
  FI_WX_SEG_KM,
  applyFiCorridorRoadFilter,
  balticRoadRisk,
  balticSlowdownMult,
  densifyCorridor,
  eventInFiBboxes,
  extractFiRoadRef,
  formatBalticRoadTitle,
  scrubEmptyRoadNrPhrase,
  fiBboxInLimit,
  fiCorridorBboxes,
  fiRoadConditionLabelPl,
  fiRoadOnCorridor,
  fiSeverity,
  fiTrafficUrl,
  fiTypeLabelPl,
  fiE75SegmentLabel,
  fiStationDisplayName,
  fiWeatherSegmentsAhead,
  fiWeatherToRiskEvents,
  fiWxLoadSlipDedup,
  fiWxLoadSlipRisk,
  fiWxLoadSlipTitle,
  filterInFiBboxes,
  isSlipperySurface,
  nearFiPortTerminal,
  parseFiTrafficMessages,
  parseFiWeatherStationsData,
  parseFiWeatherStationsMeta,
  weightLimitRisk,
  type BalticRoadEvent,
  type FiWeatherSensorReading,
} from '../supabase/functions/_shared/integrations/roadBaltic.ts';
import {
  runRoadFi,
  type JobDeps,
  type JobResult,
  type SyncStore,
} from '../supabase/functions/_shared/integrations/jobs.ts';
import type { RiskInput } from '../supabase/functions/_shared/integrations/sync.ts';

const rw = JSON.parse(
  readFileSync(resolve('tests/fixtures/fi-digitraffic-roadworks-sample.json'), 'utf8'),
);
const wt = JSON.parse(
  readFileSync(resolve('tests/fixtures/fi-digitraffic-weight-sample.json'), 'utf8'),
);
const EMPTY_FC = JSON.stringify({ type: 'FeatureCollection', features: [] });
const NOW = new Date('2026-11-02T04:00:00Z');

class MemStore implements SyncStore {
  risks: (RiskInput & { loadId?: string })[] = [];
  resolvedPrefixes: string[] = [];
  staleCalls: { prefix: string; keep: string[] }[] = [];
  runs: { job: string; ok: boolean; result: JobResult }[] = [];
  corridor: { corridor: string; slowdownMult: number; reason: string | null } | null = null;
  /** DP-217: transporty na FI_E75 (fromKm). */
  fiLoadCorridors: Array<{
    loadId: string; code: string; leg: 'PL' | 'SE'; fromKm: number; currentLeg: boolean;
  }> = [];
  async projectId() { return 'p1'; }
  async vessels() { return []; }
  async sailingsSince() { return []; }
  async insertSailings() { /* */ }
  async updateSailing() { return false; }
  async e49WindLoadCorridors() { return this.fiLoadCorridors; }
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

const FI_WX_META = readFileSync(
  resolve('tests/fixtures/fi-digitraffic-weather-stations-meta.json'), 'utf8',
);
const FI_WX_DATA = readFileSync(
  resolve('tests/fixtures/fi-digitraffic-weather-stations-data.json'), 'utf8',
);

function allOkPages(body = EMPTY_FC): Record<string, string | number> {
  return {
    'traffic-message/v2/roadworks': body,
    'traffic-message/v2/traffic-announcements': body,
    'traffic-message/v2/weight-restrictions': body,
    /* DP-216: stacje pogodowe — osobny odczyt (nie w expectedFetches bbox). */
    'weather/v1/stations/data': FI_WX_DATA,
    'weather/v1/stations': FI_WX_META,
  };
}

describe('BN6 road-fi — Digitraffic', () => {
  it('F7 #802 B1: KELI po opisie EN/FI; value 1=Dry (nie wilgotna)', () => {
    expect(fiRoadConditionLabelPl('Dry')).toBe('sucha');
    expect(fiRoadConditionLabelPl('Kuiva')).toBe('sucha');
    expect(fiRoadConditionLabelPl(1)).toBe('sucha'); /* żywe Digitraffic */
    expect(fiRoadConditionLabelPl(2)).toBe('wilgotna');
    expect(fiRoadConditionLabelPl(7)).toBe('lód');
    expect(fiRoadConditionLabelPl('Ice')).toBe('lód');
    expect(fiRoadConditionLabelPl('Frost')).toBe('szron');
    expect(isSlipperySurface({ surfaceTempC: -1, moist: true })).toBe(true);
    expect(isSlipperySurface({ surfaceTempC: 1, moist: true })).toBe(false);
    const meta = parseFiWeatherStationsMeta(JSON.parse(FI_WX_META));
    const readings = parseFiWeatherStationsData(JSON.parse(FI_WX_DATA), meta);
    /* sucha zimna → brak ryzyka (nie zgadywać po kodzie 1=wilgotna) */
    expect(readings.find((r) => r.id === '1205')).toMatchObject({
      conditionPl: 'sucha', moist: false, icy: false, slippery: false,
    });
    expect(readings.find((r) => r.id === '1202')).toMatchObject({
      conditionPl: 'wilgotna', moist: true, slippery: true,
    });
    expect(readings.find((r) => r.id === '1203')).toMatchObject({
      conditionPl: 'lód', icy: true, slippery: true,
    });
    expect(readings.find((r) => r.id === '1204')).toMatchObject({
      conditionPl: 'szron', icy: true, slippery: true,
    });
  });

  it('F7 #802 B2/B3 + DP-217: klaster 25 km; tytuł gołoledzi; odcinki zawsze MEDIUM', () => {
    const meta = parseFiWeatherStationsMeta(JSON.parse(FI_WX_META));
    const readings = parseFiWeatherStationsData(JSON.parse(FI_WX_DATA), meta);
    const ev = fiWeatherToRiskEvents(readings);
    expect(ev.every((e) => e.id.startsWith('fi-wx:seg:'))).toBe(true);
    expect(ev.some((e) => e.id.includes('9999'))).toBe(false); /* >3 km */
    expect(ev.every((e) => e.severity === 'MEDIUM')).toBe(true);
    const icy = ev.find((e) => /Śliska nawierzchnia:/.test(e.title));
    const coldWet = ev.find((e) => /Ryzyko gołoledzi:/.test(e.title));
    expect(icy?.title).toMatch(/E75 \(FI\), .+, nawierzchnia /);
    expect(coldWet?.title).toMatch(/Ryzyko gołoledzi: E75 \(FI\)/);
    expect(ev.every((e) => !/Warunki pogodowe/.test(e.title))).toBe(true);
    /* DP-217: hasTransport nie podbija odcinków do HIGH (fala dzwonków). */
    const withTransportFlag = fiWeatherToRiskEvents(readings, undefined, {
      hasTransportOnFiE75: true,
    });
    expect(withTransportFlag.every((e) => e.severity === 'MEDIUM')).toBe(true);
    const risk = balticRoadRisk('FI', icy!, 'https://tie.digitraffic.fi/api/weather/v1/stations/data', FI_ATTRIBUTION);
    expect(risk.title).toMatch(/^Śliska nawierzchnia: E75 \(FI\)/);
    expect(risk.severity).toBe('MEDIUM');
  });

  it('DP-220 / #809: kody stacji vt4_… → tytuł PL bez prefiksu', () => {
    expect(fiStationDisplayName('vt4_Mäntsälä_Ohkola')).toBe('Mäntsälä–Ohkola');
    expect(fiStationDisplayName('vt4_Helsinki_Konala')).toBe('Helsinki–Konala');
    expect(fiStationDisplayName('Porvoo')).toBe('Porvoo');
    expect(fiStationDisplayName('vt4')).toBeNull();
    /* Ta sama miejscowość na odcinku → stacje humanizowane, nie surowy kod. */
    const sameTownSeg = Math.floor(90 / FI_WX_SEG_KM); /* Lahti…Lahti gdy end też Lahti */
    const withCodes = fiE75SegmentLabel(sameTownSeg, [
      { id: '123', name: 'vt4_Mäntsälä_Ohkola' },
      { id: '124', name: 'vt4_Helsinki_Konala' },
    ]);
    expect(withCodes).not.toMatch(/vt\d+_/i);
    expect(withCodes).toMatch(/Mäntsälä–Ohkola/);
    expect(withCodes).toMatch(/Helsinki–Konala/);
  });

  it('DP-217 / #804: unikalne etykiety odcinków; HIGH 1× przed autem', () => {
    const labels = [0, 1, 2, 3, 4, 5].map((s) => fiE75SegmentLabel(s));
    expect(new Set(labels).size).toBe(labels.length);
    expect(labels.every((l) => !/^Vuosaari–Tornio$/.test(l))).toBe(true);
    expect(fiE75SegmentLabel(3)).toMatch(/Lahti|Heinola/);
    expect(fiE75SegmentLabel(7)).toMatch(/Jyväskylä|Äänekoski/);

    /* 10 śliskich odcinków 0…9 (0–250 km); auto na km 100 → HIGH tylko przed + horyzont. */
    const dens = densifyCorridor(CORRIDOR_FI);
    const fake: FiWeatherSensorReading[] = [];
    for (let seg = 0; seg < 10; seg++) {
      const km = seg * FI_WX_SEG_KM + 5;
      /* punkt wzdłuż CORRIDOR_FI ≈ km (przybliżenie liniowe po dens). */
      let cum = 0;
      let lat = CORRIDOR_FI[0]![0];
      let lon = CORRIDOR_FI[0]![1];
      for (let i = 1; i < dens.length; i++) {
        const a = dens[i - 1]!;
        const b = dens[i]!;
        const R = 6371;
        const dLat = ((b[0] - a[0]) * Math.PI) / 180;
        const dLon = ((b[1] - a[1]) * Math.PI) / 180;
        const la1 = (a[0] * Math.PI) / 180;
        const la2 = (b[0] * Math.PI) / 180;
        const h = Math.sin(dLat / 2) ** 2
          + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
        const step = 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
        if (cum + step >= km) {
          const u = step > 0 ? (km - cum) / step : 0;
          lat = a[0] + (b[0] - a[0]) * u;
          lon = a[1] + (b[1] - a[1]) * u;
          break;
        }
        cum += step;
        lat = b[0];
        lon = b[1];
      }
      fake.push({
        id: `s${seg}`,
        lat,
        lon,
        name: `stacja ${seg}`,
        airC: -5,
        surfaceC: -0.7 - seg * 0.1,
        windMs: null,
        gustMs: null,
        conditionRaw: 'Moist',
        conditionPl: 'wilgotna',
        moist: true,
        icy: false,
        slippery: true,
      });
    }
    const ev = fiWeatherToRiskEvents(fake, dens);
    expect(ev.length).toBe(10);
    expect(ev.every((e) => e.severity === 'MEDIUM')).toBe(true);
    const placeNames = ev.map((e) => e.placeName);
    expect(new Set(placeNames).size).toBeGreaterThan(1);

    const fromKm = 100;
    const ahead = fiWeatherSegmentsAhead(ev, fromKm);
    /* Odcinki z końcem ≥ 100 → seg≥4 (100–125); horyzont 420 → do seg 20. */
    expect(ahead.every((e) => {
      const seg = Number(String(e.id).replace('fi-wx:seg:', ''));
      return (seg + 1) * FI_WX_SEG_KM >= fromKm;
    })).toBe(true);
    expect(ahead.length).toBeLessThan(10); /* za autem (seg 0–3) odpadają */
    expect(ahead.length).toBeGreaterThan(0);

    const loadRisk = fiWxLoadSlipRisk({
      loadId: '11111111-1111-4111-8111-111111111217',
      ahead,
      nowMs: Date.parse('2026-11-05T04:00:00Z'),
    });
    expect(loadRisk).not.toBeNull();
    expect(loadRisk!.severity).toBe('HIGH');
    expect(loadRisk!.loadId).toBe('11111111-1111-4111-8111-111111111217');
    expect(loadRisk!.dedup).toBe(
      fiWxLoadSlipDedup('11111111-1111-4111-8111-111111111217'),
    );
    expect(loadRisk!.detail.audience).toBe('HHL_PRZEWOZNIK');
    expect(loadRisk!.title).toMatch(/Ryzyko gołoledzi na trasie: \d+ odcinki E75/);
    expect(fiWxLoadSlipTitle(ahead)).toBe(loadRisk!.title);
    expect(fiWxLoadSlipRisk({
      loadId: '11111111-1111-4111-8111-111111111217',
      ahead: [],
    })).toBeNull();
  });

  it('F7 #802 B2: 30 śliskich stacji → ≤ N odcinków; 0 HIGH bez transportu', () => {
    const dens = densifyCorridor(CORRIDOR_FI);
    const fake: FiWeatherSensorReading[] = [];
    /* 30 punktów wzdłuż CORRIDOR_FI → klastry co FI_WX_SEG_KM, nie 30 ryzyk. */
    for (let i = 0; i < 30; i++) {
      const t = i / 29;
      const idx = Math.min(CORRIDOR_FI.length - 1, Math.floor(t * (CORRIDOR_FI.length - 1)));
      const a = CORRIDOR_FI[idx]!;
      const b = CORRIDOR_FI[Math.min(CORRIDOR_FI.length - 1, idx + 1)]!;
      const u = (t * (CORRIDOR_FI.length - 1)) % 1;
      fake.push({
        id: `s${i}`,
        lat: a[0] + (b[0] - a[0]) * u,
        lon: a[1] + (b[1] - a[1]) * u,
        name: `stacja ${i}`,
        airC: -5,
        surfaceC: -3,
        windMs: null,
        gustMs: null,
        conditionRaw: 'Moist',
        conditionPl: 'wilgotna',
        moist: true,
        icy: false,
        slippery: true,
      });
    }
    let corridorLenKm = 0;
    for (let i = 1; i < dens.length; i++) {
      const a = dens[i - 1]!;
      const b = dens[i]!;
      const R = 6371;
      const dLat = ((b[0] - a[0]) * Math.PI) / 180;
      const dLon = ((b[1] - a[1]) * Math.PI) / 180;
      const la1 = (a[0] * Math.PI) / 180;
      const la2 = (b[0] * Math.PI) / 180;
      const h = Math.sin(dLat / 2) ** 2
        + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
      corridorLenKm += 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
    }
    const nSeg = Math.ceil(corridorLenKm / FI_WX_SEG_KM) + 1;
    const ev = fiWeatherToRiskEvents(fake, dens);
    expect(ev.length).toBeLessThanOrEqual(nSeg);
    expect(ev.length).toBeLessThan(30);
    expect(ev.every((e) => e.severity === 'MEDIUM')).toBe(true);
  });

  it('wszystkie bboxy korytarza w limicie [20,59,32,71]', () => {
    for (const b of fiCorridorBboxes()) {
      expect(fiBboxInLimit(b)).toBe(true);
    }
    expect(fiBboxInLimit({ xMin: 19, xMax: 21, yMin: 60, yMax: 61 })).toBe(false);
    expect(() => fiTrafficUrl(FI_ROADWORKS_URL, {
      xMin: 19, xMax: 33, yMin: 58, yMax: 72,
    })).toThrow(/poza/);
  });

  it('parser roadworks → zdarzenia z id i tytułem', () => {
    const ev = parseFiTrafficMessages(rw);
    expect(ev.length).toBeGreaterThanOrEqual(1);
    expect(ev[0]!.id).toMatch(/^GUID/);
    expect(ev[0]!.title.length).toBeGreaterThan(3);
    expect(ev[0]!.lat).not.toBeNull();
  });

  it('DP-157(a): zwykłe Tietyö → LOW; zamknięcie → HIGH', () => {
    expect(fiSeverity('road work', 'Tie 4, Oulu. Tietyö.', null).severity).toBe('LOW');
    expect(fiSeverity('ROAD_WORK', 'Tietyö Kehä III', null).severity).toBe('LOW');
    expect(fiSeverity('road work', 'Tie 4 suljettu', null).severity).toBe('HIGH');
  });

  it('F7 #732 B1 / DP-168 N3: kelirikko bez/z liczbą → MEDIUM; nie spowalnia ETA', () => {
    expect(fiSeverity('weight restriction', 'kelirikko VT4', null).severity).toBe('MEDIUM');
    expect(fiSeverity('weight', 'painorajoitus ilman lukua', null).severity).toBe('MEDIUM');
    expect(fiSeverity('weight restriction', 'painorajoitus 12 t', 12).severity).toBe('MEDIUM');
    const kel: BalticRoadEvent = {
      id: 'KEL', title: 'limit masy', detail: 'kelirikko VT4', severity: 'MEDIUM',
      lat: 65.0, lon: 25.5, kind: 'weight', start: null, end: null,
      corridorMatch: 'on',
    };
    const risk = weightLimitRisk('FI', kel, null, FI_ROADWORKS_URL, 'Fintraffic');
    expect(risk.severity).toBe('MEDIUM');
    expect(risk.titleKey).toBe('rk_road_baltic_weight_check');
    expect(risk.params).toMatchObject({ limit: null });
    expect(balticSlowdownMult([{ ...kel, severity: 'MEDIUM' }]).mult).toBe(1);
    expect(balticSlowdownMult([{
      ...kel, severity: 'HIGH', weightLimitT: 12,
    }]).mult).toBe(1);
  });

  it('F7 #732 B3: wypadek bez blokady → MEDIUM; z zamknięciem → HIGH', () => {
    expect(fiSeverity('accident', 'Onnettomuus VT4', null).severity).toBe('MEDIUM');
    expect(fiSeverity('accident', 'Onnettomuus VT4', null).roadClosed).toBe(false);
    expect(fiSeverity('accident', 'Onnettomuus VT4 suljettu', null).severity).toBe('HIGH');
    expect(fiSeverity('accident', 'Onnettomuus ajorata suljettu', null).severity).toBe('HIGH');
  });

  it('DP-157(b)/F7 B2: filtr VT4/E75/50/101/103; Tie 8/75 → off', () => {
    expect(extractFiRoadRef('Tie 4, Oulu. Tietyö.')).toBe('4');
    expect(extractFiRoadRef('Kehä III, Vantaa')).toBe('50');
    expect(extractFiRoadRef('Kehä I, Helsinki')).toBe('101');
    expect(extractFiRoadRef('Tietyö 2 km')).toBeNull();
    expect(fiRoadOnCorridor('4')).toBe('on');
    expect(fiRoadOnCorridor('E75')).toBe('on');
    expect(fiRoadOnCorridor('E8')).toBe('on');
    expect(fiRoadOnCorridor('50')).toBe('on');
    expect(fiRoadOnCorridor('101')).toBe('on');
    expect(fiRoadOnCorridor('103')).toBe('on');
    expect(fiRoadOnCorridor('110')).toBe('off');
    expect(fiRoadOnCorridor('8')).toBe('off');
    expect(fiRoadOnCorridor('75')).toBe('off');
    expect(extractFiRoadRef('Tie 8, Vaasa')).toBe('8');
    expect(fiRoadOnCorridor(extractFiRoadRef('Tie 8, Vaasa'))).toBe('off');
    expect(fiRoadOnCorridor(extractFiRoadRef('Tie 75'))).toBe('off');
    /* DP-166: lokalne 5-cyfrowe → off (nie unknown); DP-203: bez awansu unknown→on po km. */
    expect(extractFiRoadRef('Tie 19511, Espoo. Tietyö.')).toBe('19511');
    expect(fiRoadOnCorridor(extractFiRoadRef('Tie 19511, Espoo. Tietyö.'))).toBe('off');
    expect(extractFiRoadRef('Tie 8155')).toBe('8155');
    expect(fiRoadOnCorridor('8155')).toBe('off');
    const localNear: BalticRoadEvent = {
      id: 'LOC19511', title: 'roboty drogowe', detail: 'Tie 19511, Espoo. Tietyö.',
      severity: 'LOW', lat: 60.45, lon: 25.0, kind: 'road work', start: null, end: null,
    };
    expect(applyFiCorridorRoadFilter([localNear]).find((e) => e.id === 'LOC19511')!.corridorMatch)
      .toBe('off');
    /* Poza 2 km od portów (F7 B4) — inaczej road 110 i tak byłby „on”. */
    const street: BalticRoadEvent = {
      id: 'HEL', title: 'roboty drogowe', detail: 'Mannerheimintie. Tietyö.',
      severity: 'LOW', lat: 60.186, lon: 24.915, kind: 'road work', start: null, end: null,
      road: '110',
    };
    const vt4 = parseFiTrafficMessages(rw)[0]!;
    const filtered = applyFiCorridorRoadFilter([street, vt4]);
    expect(filtered.find((e) => e.id === 'HEL')!.corridorMatch).toBe('off');
    expect(filtered.find((e) => e.id === vt4.id)!.corridorMatch).toBe('on');
  });

  it('F7 #732 B4: ≤2 km od Länsisatamy/Vuosaari → on; 4 km + ulica → off', () => {
    expect(nearFiPortTerminal(60.150, 24.915)).toBe(true);
    /* ~1 km N od Länsisatamy */
    const nearPort: BalticRoadEvent = {
      id: 'PORT', title: 'roboty drogowe', detail: 'Länsisatama. Tietyö.',
      severity: 'LOW', lat: 60.159, lon: 24.915, kind: 'road work',
      start: null, end: null,
    };
    /* ~4 km N — Mannerheimintie poza terminalem i poza listą dróg */
    const farStreet: BalticRoadEvent = {
      id: 'FAR', title: 'roboty drogowe', detail: 'Mannerheimintie 110. Tietyö.',
      severity: 'LOW', lat: 60.186, lon: 24.915, kind: 'road work',
      start: null, end: null,
    };
    const filtered = applyFiCorridorRoadFilter([nearPort, farStreet]);
    expect(filtered.find((e) => e.id === 'PORT')!.corridorMatch).toBe('on');
    expect(filtered.find((e) => e.id === 'FAR')!.corridorMatch).not.toBe('on');
  });

  it('DP-158: etykieta PL w title; fiński w detail', () => {
    expect(fiTypeLabelPl('road work', 'Tie 4. Tietyö.')).toBe('roboty drogowe');
    expect(fiTypeLabelPl('TRAFFIC_ANNOUNCEMENT', 'Liikennetiedote')).toBe('komunikat');
    expect(fiTypeLabelPl('weight restriction', 'painorajoitus 12 t')).toBe('limit masy');
    const ev = parseFiTrafficMessages(rw)[0]!;
    expect(ev.title).toBe('roboty drogowe');
    expect(ev.detail).toMatch(/Tietyö/i);
    expect(ev.severity).toBe('LOW');
  });

  it('filtr bbox: 1,5 km w bboxie → jest; 5 km poza → brak (F7 #726 B2)', () => {
    /* Punkt w pierwszym bboxie (Helsinki–Lahti: 24.5–26.5 E, 59.8–61.5 N). */
    const inBox: BalticRoadEvent = {
      id: 'IN', title: 'w bbox', detail: 'x', severity: 'MEDIUM',
      lat: 60.5, lon: 25.2, kind: 'road work', start: null, end: null,
    };
    /* Zachód Finlandii — poza pięcioma bboxami korytarza VT4. */
    const outBox: BalticRoadEvent = {
      id: 'OUT', title: 'poza', detail: 'x', severity: 'MEDIUM',
      lat: 60.2, lon: 21.5, kind: 'road work', start: null, end: null,
    };
    expect(eventInFiBboxes(inBox)).toBe(true);
    expect(eventInFiBboxes(outBox)).toBe(false);
    expect(filterInFiBboxes([inBox, outBox]).map((e) => e.id)).toEqual(['IN']);
  });

  it('fixture roadworks Ii (VT4) w bboxie korytarza; FAR poza', () => {
    const nearPt = parseFiTrafficMessages(rw)[0]!;
    expect(eventInFiBboxes(nearPt)).toBe(true);
    const far = parseFiTrafficMessages(wt).find((e) => e.id === 'GUID-FAR-BN6')!;
    expect(eventInFiBboxes(far)).toBe(false);
    const keep = filterInFiBboxes([nearPt, far]);
    expect(keep.some((e) => e.id === nearPt.id)).toBe(true);
    expect(keep.some((e) => e.id === 'GUID-FAR-BN6')).toBe(false);
  });

  it('limit masy: ładunek > limit → HIGH; brak masy → MEDIUM sprawdź', () => {
    const w = parseFiTrafficMessages(wt).find((e) => e.id === 'GUID-WEIGHT-BN6')!;
    expect(w.weightLimitT).toBe(12);
    const hi = weightLimitRisk('FI', w, 40, FI_ROADWORKS_URL, 'Fintraffic');
    expect(hi.severity).toBe('HIGH');
    expect(hi.titleKey).toBe('rk_road_baltic_weight');
    const med = weightLimitRisk('FI', w, null, FI_ROADWORKS_URL, 'Fintraffic');
    expect(med.severity).toBe('MEDIUM');
    expect(med.titleKey).toBe('rk_road_baltic_weight_check');
  });

  it('balticSlowdownMult: kelirikko (weightLimitT) nie spowalnia', () => {
    const w: BalticRoadEvent = {
      id: 'W', title: 'kelirikko', detail: 'weight', severity: 'HIGH',
      lat: 65.0, lon: 25.5, kind: 'weight', start: null, end: null, weightLimitT: 12,
    };
    const closed: BalticRoadEvent = {
      id: 'C', title: 'zamkniecie', detail: 'closed', severity: 'HIGH',
      lat: 65.0, lon: 25.5, kind: 'closed', start: null, end: null,
    };
    expect(balticSlowdownMult([w]).mult).toBe(1);
    expect(balticSlowdownMult([closed]).mult).toBeGreaterThan(1);
  });

  it('balticRoadRisk → ROAD_FI + atrybucja', () => {
    const ev = parseFiTrafficMessages(rw)[0]!;
    const r = balticRoadRisk('FI', ev, FI_ROADWORKS_URL, 'Source: Fintraffic');
    expect(r.kind).toBe('ROAD_FI');
    expect(r.dedup).toBe(`ROAD_FI:v2:${ev.id}`);
    expect(r.detail.zrodlo).toMatch(/Fintraffic/);
  });

  it('FI_BBOX_LIMIT stałe jak w spec', () => {
    expect(FI_BBOX_LIMIT).toEqual({ xMin: 20, yMin: 59, xMax: 32, yMax: 71 });
  });
});

describe('BN6 runRoadFi — F7 #726', () => {
  it('nagłówki Digitraffic-User + Accept-Encoding gzip', async () => {
    const st = new MemStore();
    const { d, headerCalls } = deps(st, allOkPages());
    await runRoadFi(d);
    expect(headerCalls.length).toBe(17); // 3×5 bbox + 2 weather (DP-216)
    for (const c of headerCalls) {
      expect(c.headers['Digitraffic-User']).toBeTruthy();
      expect(c.headers['Accept-Encoding']).toBe('gzip');
    }
  });

  it('DP-217 / #804: 1× HIGH load + MEDIUM odcinki; 0 HIGH bez transportu', async () => {
    const stNo = new MemStore();
    const rNo = await runRoadFi(deps(stNo, allOkPages()).d);
    expect(Number(rNo.observations?.fi_weather_events ?? 0)).toBeGreaterThan(0);
    expect(rNo.observations?.fi_wx_load_alerts).toBe('0');
    const segNo = stNo.risks.filter((x) => /fi-wx:seg:/.test(x.dedup));
    expect(segNo.length).toBeGreaterThan(0);
    expect(segNo.every((x) => x.severity === 'MEDIUM')).toBe(true);
    expect(stNo.risks.some((x) => /fi-wx:load:/.test(x.dedup))).toBe(false);

    const st = new MemStore();
    st.fiLoadCorridors = [{
      loadId: '22222222-2222-4222-8222-222222222217',
      code: 'FI_E75',
      leg: 'SE',
      fromKm: 100,
      currentLeg: true,
    }];
    const r = await runRoadFi(deps(st, allOkPages()).d);
    expect(r.observations?.fi_wx_load_alerts).toBe('1');
    const loadRisks = st.risks.filter((x) => /fi-wx:load:/.test(x.dedup));
    expect(loadRisks).toHaveLength(1);
    expect(loadRisks[0]!.severity).toBe('HIGH');
    expect(loadRisks[0]!.loadId).toBe('22222222-2222-4222-8222-222222222217');
    expect(loadRisks[0]!.detail.audience).toBe('HHL_PRZEWOZNIK');
    const segs = st.risks.filter((x) => /fi-wx:seg:/.test(x.dedup));
    expect(segs.every((x) => x.severity === 'MEDIUM')).toBe(true);
    expect(segs.every((x) => x.loadId == null)).toBe(true);
  });

  it('SOURCE_DOWN po 3× fetched_ok===0', async () => {
    const st = new MemStore();
    st.runs.push(
      {
        job: 'road-fi', ok: false,
        result: {
          job: 'road-fi', mode: 'LIVE', ok: false,
          observations: { fetched_ok: '0' },
        },
      },
      {
        job: 'road-fi', ok: false,
        result: {
          job: 'road-fi', mode: 'LIVE', ok: false,
          observations: { fetched_ok: '0' },
        },
      },
    );
    const r = await runRoadFi(deps(st, {
      'traffic-message/v2/roadworks': 500,
      'traffic-message/v2/traffic-announcements': 500,
      'traffic-message/v2/weight-restrictions': 500,
    }).d);
    expect(r.ok).toBe(false);
    expect(r.observations?.fetched_ok).toBe('0');
    expect(r.observations?.road_fi_fail_streak).toBe('3');
    expect(st.risks.some((x) => x.dedup.startsWith('SOURCE_DOWN:ROAD_FI'))).toBe(true);
  });

  it('częściowy przebieg (fetched_ok>0) nie nabija streak SOURCE_DOWN', async () => {
    const st = new MemStore();
    /* Historia partial — streak liczy tylko fetched_ok===0. */
    st.runs.push({
      job: 'road-fi', ok: false,
      result: { job: 'road-fi', mode: 'LIVE', ok: false, observations: { fetched_ok: '7' } },
    });
    const r = await runRoadFi(deps(st, {
      'traffic-message/v2/roadworks': 500,
      'traffic-message/v2/traffic-announcements': 500,
      'traffic-message/v2/weight-restrictions': 500,
    }).d);
    expect(r.observations?.road_fi_fail_streak).toBe('1');
    expect(st.risks.some((x) => x.dedup.startsWith('SOURCE_DOWN:ROAD_FI'))).toBe(false);
  });

  it('komplet → resolveStaleRisks; częściowa awaria → bez zamknięcia', async () => {
    const stOk = new MemStore();
    stOk.risks.push({
      kind: 'ROAD_FI', severity: 'MEDIUM', title: 'stare', dedup: 'ROAD_FI:OLD',
      detail: {}, titleKey: 'rk_road_baltic', params: {},
    });
    const rOk = await runRoadFi(deps(stOk, allOkPages()).d);
    expect(rOk.observations?.complete).toBe('1');
    expect(stOk.staleCalls.length).toBe(1);
    expect(stOk.risks.some((x) => x.dedup === 'ROAD_FI:OLD')).toBe(false);

    const stPart = new MemStore();
    stPart.risks.push({
      kind: 'ROAD_FI', severity: 'MEDIUM', title: 'stare', dedup: 'ROAD_FI:OLD',
      detail: {}, titleKey: 'rk_road_baltic', params: {},
    });
    /* roadworks OK, reszta 500 → fetched_ok = 5 < 15 */
    const rPart = await runRoadFi(deps(stPart, {
      'traffic-message/v2/roadworks': EMPTY_FC,
      'traffic-message/v2/traffic-announcements': 500,
      'traffic-message/v2/weight-restrictions': 500,
    }).d);
    expect(rPart.observations?.complete).toBe('0');
    expect(Number(rPart.observations?.fetched_ok)).toBe(5);
    expect(stPart.staleCalls.length).toBe(0);
    expect(stPart.risks.some((x) => x.dedup === 'ROAD_FI:OLD')).toBe(true);
  });

  it('sourceUrl per endpoint źródła', async () => {
    const st = new MemStore();
    const body = JSON.stringify({
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [25.2, 60.5] },
        properties: {
          situationId: 'GUID-ANN-BN6',
          situationType: 'accident',
          announcements: [{ language: 'fi', title: 'Wypadek VT4' }],
        },
      }],
    });
    await runRoadFi(deps(st, {
      'traffic-message/v2/roadworks': EMPTY_FC,
      'traffic-message/v2/traffic-announcements': body,
      'traffic-message/v2/weight-restrictions': EMPTY_FC,
    }).d);
    const hit = st.risks.find((r) => r.dedup === 'ROAD_FI:v2:GUID-ANN-BN6');
    expect(hit?.sourceUrl).toBe(FI_ANNOUNCEMENTS_URL);
    expect(hit?.detail?.zrodlo).toBe(FI_ATTRIBUTION);
    expect(hit?.params?.type_pl ?? hit?.params?.event).toBe('wypadek');
  });

  it('decyzja 99: poza korytarzem → keep LOW „obok trasy” (wcześniej DP-157c bez ryzyka)', async () => {
    const st = new MemStore();
    st.risks.push({
      kind: 'ROAD_FI', severity: 'MEDIUM', title: 'stare inne',
      dedup: 'ROAD_FI:v2:GUID-OLD-OTHER',
      detail: {}, titleKey: 'rk_road_baltic', params: {},
    });
    /* F7 #732 B4: ~4 km od Länsisatamy — poza strefą portu 2 km → unknown daleko → off. */
    const streetBody = JSON.stringify({
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [24.915, 60.186] },
        properties: {
          situationId: 'GUID-STREET-HEL',
          situationType: 'road work',
          announcements: [{ language: 'fi', title: 'Mannerheimintie 110. Tietyö.' }],
        },
      }],
    });
    const r = await runRoadFi(deps(st, allOkPages(streetBody)).d);
    expect(r.observations?.complete).toBe('1');
    expect(st.staleCalls.length).toBe(1);
    expect(st.staleCalls[0]!.keep.some((k) => k.includes('GUID-STREET-HEL'))).toBe(true);
    expect(st.risks.some((x) => x.dedup === 'ROAD_FI:v2:GUID-OLD-OTHER')).toBe(false);
    const street = st.risks.find((x) => x.dedup.includes('GUID-STREET-HEL'));
    expect(street?.severity).toBe('LOW');
    expect(street?.title).toMatch(/obok trasy/);
    expect(Number(r.observations?.fi_off_corridor)).toBeGreaterThan(0);
  });
});

describe('DP-213 FI: bez pustego „Droga nr ,” (#793)', () => {
  it('scrubEmptyRoadNrPhrase zostawia miejscowość', () => {
    expect(scrubEmptyRoadNrPhrase('Droga nr , Jämsä')).toBe('Jämsä');
    expect(scrubEmptyRoadNrPhrase('Tie , Äänekoski')).toBe('Äänekoski');
    expect(scrubEmptyRoadNrPhrase('Droga nr ,')).toBe('');
  });

  it('tytuł ROAD_FI bez „Droga nr ,” gdy numer tylko w road', () => {
    const e: BalticRoadEvent = {
      id: 'fi-jamsa',
      title: 'roboty drogowe',
      detail: 'Droga nr , Jämsä',
      severity: 'LOW',
      lat: 61.86,
      lon: 25.19,
      kind: 'road work',
      start: null,
      end: null,
      road: '343',
      corridorMatch: 'off',
    };
    const titled = formatBalticRoadTitle('FI', e);
    expect(titled.title).not.toMatch(/Droga\s+nr\s*,/i);
    expect(titled.title).toMatch(/Jämsä/);
    expect(titled.roadLabel).toMatch(/343|droga 343/);
  });
});
