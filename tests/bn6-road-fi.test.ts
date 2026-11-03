/**
 * BN6 (#716) cz.1 — Digitraffic FI: parser, bbox, filtr korytarza, limity masy, runRoadFi (F7 #726).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  FI_ANNOUNCEMENTS_URL,
  FI_ATTRIBUTION,
  FI_BBOX_LIMIT,
  FI_ROADWORKS_URL,
  FI_WEIGHT_URL,
  applyFiCorridorRoadFilter,
  balticRoadRisk,
  balticSlowdownMult,
  eventInFiBboxes,
  extractFiRoadRef,
  fiBboxInLimit,
  fiCorridorBboxes,
  fiRoadOnCorridor,
  fiSeverity,
  fiTrafficUrl,
  fiTypeLabelPl,
  filterInFiBboxes,
  nearFiPortTerminal,
  parseFiTrafficMessages,
  weightLimitRisk,
  type BalticRoadEvent,
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

function allOkPages(body = EMPTY_FC): Record<string, string | number> {
  return {
    'traffic-message/v2/roadworks': body,
    'traffic-message/v2/traffic-announcements': body,
    'traffic-message/v2/weight-restrictions': body,
  };
}

describe('BN6 road-fi — Digitraffic', () => {
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
    expect(headerCalls.length).toBe(15); // 3 endpointy × 5 bboxów
    for (const c of headerCalls) {
      expect(c.headers['Digitraffic-User']).toBeTruthy();
      expect(c.headers['Accept-Encoding']).toBe('gzip');
    }
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

  it('DP-157(c): poza korytarzem nie w keep → resolveStale zamyka stare ROAD_FI', async () => {
    const st = new MemStore();
    st.risks.push({
      kind: 'ROAD_FI', severity: 'MEDIUM', title: 'stare uliczne',
      dedup: 'ROAD_FI:v2:GUID-STREET-HEL',
      detail: {}, titleKey: 'rk_road_baltic', params: {},
    });
    /* F7 #732 B4: ~4 km od Länsisatamy — poza strefą portu 2 km. */
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
    expect(st.staleCalls[0]!.keep.every((k) => !k.includes('GUID-STREET-HEL'))).toBe(true);
    expect(st.risks.some((x) => x.dedup.includes('GUID-STREET-HEL'))).toBe(false);
  });
});
