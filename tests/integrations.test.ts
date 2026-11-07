/**
 * M12 — zadania integracji danych zewnętrznych: test każdej funkcji na zapisanych danych, bez sieci.
 * Polferries: prawdziwe strony z 26.09.2026 (rozkład cargo i komunikaty); Digitraffic: prawdziwa odpowiedź z 25.09.2026.
 * Trafikverket / DATEX II: przykłady w formacie z dokumentacji dostawców (brak kluczy) — tests/fixtures/*sample*.
 * TomTom Flow: usunięty (CLEAN-TT-HERE / D-28).
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  clearDmiResponseCache, MIN_INTERVAL_MIN, previousActualArrivalBefore, runFerryAis, runFerrySchedule, runFerryStatus, runFerryWeather, runJob,
  runRoadPl, runRoadSe, runTrafficFlow,
  type JobDeps, type JobResult, type SyncStore, type VehiclePos,
} from '../supabase/functions/_shared/integrations/jobs';
import type { DbSailing, RiskInput, SailingInsert, SailingPatch } from '../supabase/functions/_shared/integrations/sync';
import { planSailingSync } from '../supabase/functions/_shared/integrations/sync';
import {
  distanceToCorridorKm, CORRIDOR_SE, parseTrafikverketSituations, roadRisk,
  seIsOffMainCorridor, trafikverketResultError, trafikverketSituationQuery,
} from '../supabase/functions/_shared/integrations/road';

const fx = (n: string) => readFileSync(new URL(`./fixtures/${n}`, import.meta.url), 'utf8');
const CARGO = fx('polferries-cargo-rozklad-2026-09-26.html');
const STATUS = fx('polferries-komunikaty-2026-09-26.html');
const AIS = fx('digitraffic-nova-star-2026-09-25.json');
const TV_RC = fx('trafikverket-roadcondition-sample.json');
const TV_WX = fx('trafikverket-weather-sample.json');
const TV_SIT = fx('trafikverket-situation-sample.json');
const TV_SIT_EMPTY = '{"RESPONSE":{"RESULT":[{"Situation":[]}]}}';
const DATEX = fx('datex2-kpd-sample.xml');
const NOW = new Date('2026-09-26T01:45:00Z');
const WAW = 'v-waw'; const NS = 'v-ns';

class MemStore implements SyncStore {
  sailings: DbSailing[] = [];
  risks: (RiskInput & { loadId?: string })[] = [];
  runs: { job: string; at: string; ok: boolean; result: JobResult }[] = [];
  positions: VehiclePos[] = [];
  corridor: { corridor: string; slowdownMult: number; reason: string | null; detail?: unknown } | null = null;
  corridors: { corridor: string; slowdownMult: number; detail?: unknown }[] = [];
  marine: { maxWaveM: number | null; maxGustKn: number | null; risk: string; sources: string } | null = null;
  marineWarnings: string[] = [];
  thr = { waveM: 3.8, gustKn: 40 };
  n = 0;
  /** F7 #706 B1: INFO AIS_<port> tylko przy >0 transportach. */
  loadCounts = new Map<string, number>();
  async sailingAssignedLoadCount(id: string) { return this.loadCounts.get(id) ?? 0; }
  async projectId() { return 'p1'; }
  async vessels() { return [{ id: WAW, name: 'M/F Wawel', mmsi: null }, { id: NS, name: 'M/F Nova Star', mmsi: 311000787 }]; }
  async sailingsSince(from: string) { return this.sailings.filter((s) => s.departure_at >= from).map((s) => ({ ...s })); }
  async insertSailings(rows: SailingInsert[]) {
    for (const r of rows) if (!this.sailings.some((s) => s.vessel_id === r.vessel_id && s.departure_at === r.departure_at)) this.sailings.push({ id: `s${++this.n}`, ...r });
  }
  async updateSailing(id: string, patch: SailingPatch) {
    const s = this.sailings.find((x) => x.id === id);
    if (!s) return false;
    const { actual_departure_at, actual_arrival_at, ...rest } = patch;
    let wrote = false;
    if (Object.keys(rest).length) {
      if (s.source !== 'RECZNIE') { Object.assign(s, rest); wrote = true; }
    }
    if (actual_departure_at !== undefined) { s.actual_departure_at = actual_departure_at; wrote = true; }
    if (actual_arrival_at !== undefined) { s.actual_arrival_at = actual_arrival_at; wrote = true; }
    return wrote;
  }
  async raiseRisk(r: RiskInput & { loadId?: string }) {
    if (this.risks.some((x) => x.dedup === r.dedup)) return false;
    this.risks.push(r); return true;
  }
  resolved: string[] = [];
  async resolveRisks(prefix: string) { const hit = this.risks.filter((r) => r.dedup.startsWith(prefix)); this.risks = this.risks.filter((r) => !r.dedup.startsWith(prefix)); this.resolved.push(prefix); return hit.length; }
  async resolveStaleRisks(prefix: string, keep: string[]) {
    const keepSet = new Set(keep);
    const hit = this.risks.filter((r) => r.dedup.startsWith(prefix) && !keepSet.has(r.dedup));
    this.risks = this.risks.filter((r) => !(r.dedup.startsWith(prefix) && !keepSet.has(r.dedup)));
    return hit.length;
  }
  async latestPositions() { return this.positions; }
  /** DP-187 / F7 #765 A: kotwica = started_at (fallback at); pominięć nie zapisujemy. */
  async lastRun(job: string) {
    for (let i = this.runs.length - 1; i >= 0; i--) {
      const r = this.runs[i]!;
      if (r.job !== job) continue;
      const started = r.result?.started_at;
      if (typeof started === 'string' && !Number.isNaN(Date.parse(started))) return started;
      return r.at;
    }
    return null;
  }
  async recordRun(job: string, ok: boolean, result: JobResult) {
    this.runs.push({ job, at: result.started_at ?? NOW.toISOString(), ok, result });
  }
  vesselPositions: {
    vesselId: string; lat: number; lon: number; observedAt: string;
    source?: string; etaAt?: string | null; sogKn?: number | null;
  }[] = [];
  async saveVesselPosition(vesselId: string, fix: {
    lat: number; lon: number; timestampUtc: string; source?: string; etaAt?: string | null; sogKn?: number | null;
  }) {
    if (this.vesselPositions.some((p) => p.vesselId === vesselId && p.observedAt === fix.timestampUtc)) return;
    this.vesselPositions.push({
      vesselId, lat: fix.lat, lon: fix.lon, observedAt: fix.timestampUtc,
      source: fix.source, etaAt: fix.etaAt ?? null, sogKn: fix.sogKn ?? null,
    });
  }
  async lastPortPosition(
    vesselId: string,
    hub: { lat: number; lon: number },
    _radiusKm: number,
    sinceIso: string,
  ) {
    const { findAtdTransitionIso, haversineKm, GEOFENCE_QUERY_RADIUS_KM } =
      await import('../supabase/functions/_shared/ferry/geofenceTransition');
    const rows = this.vesselPositions
      .filter((p) => p.vesselId === vesselId && p.observedAt >= sinceIso
        && haversineKm(p.lat, p.lon, hub.lat, hub.lon) <= GEOFENCE_QUERY_RADIUS_KM)
      .map((p) => ({
        observed_at: p.observedAt, lat: p.lat, lon: p.lon, sog_kn: p.sogKn ?? null,
      }));
    return findAtdTransitionIso(rows, hub);
  }
  /** DP-128 F7 r1: ATA tylko przy przejściu ≤20 min (histereza / SOG). */
  async firstPortEntryAfter(
    vesselId: string,
    hub: { lat: number; lon: number },
    _radiusKm: number,
    sinceIso: string,
  ) {
    const { findAtaTransitionIso, haversineKm, GEOFENCE_QUERY_RADIUS_KM } =
      await import('../supabase/functions/_shared/ferry/geofenceTransition');
    const rows = this.vesselPositions
      .filter((p) => p.vesselId === vesselId && p.observedAt >= sinceIso
        && haversineKm(p.lat, p.lon, hub.lat, hub.lon) <= GEOFENCE_QUERY_RADIUS_KM)
      .map((p) => ({
        observed_at: p.observedAt, lat: p.lat, lon: p.lon, sog_kn: p.sogKn ?? null,
      }));
    return findAtaTransitionIso(rows, hub);
  }
  async latestVesselObserved() {
    const best = new Map<string, string>();
    for (const row of this.vesselPositions) {
      const cur = best.get(row.vesselId);
      if (!cur || row.observedAt > cur) best.set(row.vesselId, row.observedAt);
    }
    return [...best.entries()].map(([vesselId, observedAt]) => ({ vesselId, observedAt }));
  }
  async seSlowdownPct() { return 15; }
  async saveCorridorCondition(row: { corridor: 'SE_E4' | 'SE_E22' | 'ROAD_LT' | 'ROAD_LV' | 'ROAD_EE' | 'ROAD_FI'; slowdownMult: number; reason: string | null; detail?: unknown }) {
    this.corridors.push({ corridor: row.corridor, slowdownMult: row.slowdownMult, detail: row.detail });
    if (row.corridor === 'SE_E4') this.corridor = { corridor: row.corridor, slowdownMult: row.slowdownMult, reason: row.reason, detail: row.detail };
  }
  async opsThresholds() { return this.thr; }
  /** DP-145: opcjonalny słownik code→family_key (jak ferry_routes). */
  ferryFamilies: Record<string, string> | null = null;
  async ferryRouteFamilies() {
    return this.ferryFamilies ?? {};
  }
  async saveMarineCondition(row: {
    corridor: 'BALTIC_GDN_NYN' | 'BALTIC_GDY_KAA' | 'BALTIC_GULF_FI' | 'BALTIC_PLD_KPS' | 'BALTIC_TLL_STO'; maxWaveM: number | null; maxGustKn: number | null;
    risk: 'niskie' | 'podwyższone' | 'wysokie'; sources: string; detail?: unknown;
  }) {
    this.marine = { maxWaveM: row.maxWaveM, maxGustKn: row.maxGustKn, risk: row.risk, sources: row.sources };
    const detail = row.detail as { warnings?: string[] } | undefined;
    if (detail?.warnings?.length) this.marineWarnings = detail.warnings;
  }
  hereNotes: { service: string; n: number }[] = [];
  async noteHereUsage(service: 'tiles' | 'routing' | 'matching' | 'attributes' | 'traffic', n: number) {
    this.hereNotes.push({ service, n });
  }
  async hereMonthSpend() { return 0; }
}

function deps(store: MemStore, pages: Record<string, string | number>, env: Record<string, string> = {}, now = NOW) {
  /* DP-150: w testach bez sztucznego odstępu DMI (prod: domyślnie 400 ms). */
  const envMerged: Record<string, string> = { DMI_REQUEST_GAP_MS: '0', ...env };
  const calls: string[] = [];
  const headerCalls: { url: string; headers: Record<string, string> }[] = [];
  const f = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input); calls.push(url);
    const hdrs: Record<string, string> = {};
    const raw = init?.headers;
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      for (const [k, v] of Object.entries(raw as Record<string, string>)) hdrs[k] = String(v);
    }
    headerCalls.push({ url, headers: hdrs });
    const hit = Object.entries(pages).find(([k]) => url.includes(k));
    if (hit) {
      return typeof hit[1] === 'number' ? new Response('err', { status: hit[1] }) : new Response(hit[1], { status: 200 });
    }
    // STENA-3: domyślnie pusta tablica (testy Polferries nie muszą stubować Steny)
    if (url.includes('_jcr_content.timetable.')) {
      return new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (url.includes('stenalinefreight.com')) {
      return new Response('niedostepne', { status: 503 });
    }
    /* BN3 decyzja 61: RSS ERR — puste trafienia, bez SOURCE_DOWN w testach Polferries/Stena. */
    if (url.includes('news.err.ee/rss') || url.includes('news.err.ee')) {
      return new Response(
        '<?xml version="1.0"?><rss version="2.0"><channel><title>news</title></channel></rss>',
        { status: 200, headers: { 'Content-Type': 'application/rss+xml' } },
      );
    }
    /* BN5 cz.3: poza sezonem pusto = brak ograniczeń (domyślny stub). */
    if (url.includes('winter-navigation')) {
      return new Response(JSON.stringify({ type: 'FeatureCollection', features: [] }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      });
    }
    throw new Error(`nieoczekiwane zapytanie (sieć zabroniona w teście): ${url}`);
  }) as typeof fetch;
  const d: JobDeps = { store, fetch: f, env: envMerged, now: () => now };
  return { d, calls, headerCalls };
}

/** mutacja wpisu rejsu Gdańsk → Nynäshamn M/F Wawel 26.09 na prawdziwej stronie komunikatów */
function mutateWawel26(cls: string, badge: string) {
  const d = STATUS.indexOf('2026-09-26 M/F Wawel');
  const c = STATUS.lastIndexOf('polferries--rejs--status--scheduled"', d);
  const b = STATUS.indexOf('status-badge">Planowo<', d);
  let out = STATUS.slice(0, b) + `status-badge">${badge}<` + STATUS.slice(b + 'status-badge">Planowo<'.length);
  out = out.slice(0, c) + `polferries--rejs--status--${cls}"` + out.slice(c + 'polferries--rejs--status--scheduled"'.length);
  return out;
}
const dep26 = '2026-09-26T16:00:00.000Z';

describe('ferry-schedule — rozkład cargo (prawdziwa strona 26.09.2026)', () => {
  it('zapisuje rejsy od wczoraj w przód w obu kierunkach; drugi przebieg nic nie zmienia', async () => {
    const st = new MemStore();
    const r = await runFerrySchedule(deps(st, { 'cargo/rozklad': CARGO }).d);
    expect(r.ok).toBe(true);
    expect(r.inserted).toBe(147); // 26.09 → 04.01.2027, oba kierunki (strona z 26.09.2026)
    expect(st.sailings.every((s) => s.source === 'POLFERRIES' && s.departure_at >= '2026-09-25')).toBe(true);
    expect(st.sailings.find((s) => s.route === 'GDN-NYN' && s.departure_at === dep26)?.vessel_id).toBe(WAW);
    const again = await runFerrySchedule(deps(st, { 'cargo/rozklad': CARGO }).d);
    expect(again).toMatchObject({ inserted: 0, updated: 0 });
    expect(again.unchanged).toBe(r.inserted);
  });
  it('pierwszeństwo: RECZNIE nietknięty, DANE_STARTOWE poprawiony (także statek)', async () => {
    const st = new MemStore();
    st.sailings.push(
      { id: 'm', vessel_id: WAW, route: 'GDN-NYN', departure_at: dep26, arrival_at: '2026-09-27T12:00:00.000Z', delayed_departure_at: null, delayed_arrival_at: null, status: 'ZAPLANOWANY', source: 'RECZNIE' },
      { id: 'd', vessel_id: WAW, route: 'GDN-NYN', departure_at: '2026-09-28T16:00:00.000Z', arrival_at: '2026-09-29T08:00:00.000Z', delayed_departure_at: null, delayed_arrival_at: null, status: 'ZAPLANOWANY', source: 'DANE_STARTOWE' },
    );
    const r = await runFerrySchedule(deps(st, { 'cargo/rozklad': CARGO }).d);
    expect(r.manualKept).toBe(1);
    expect(st.sailings.find((s) => s.id === 'm')).toMatchObject({ arrival_at: '2026-09-27T12:00:00.000Z', source: 'RECZNIE' });
    expect(st.sailings.find((s) => s.id === 'd')).toMatchObject({ vessel_id: NS, arrival_at: '2026-09-29T10:00:00.000Z', source: 'POLFERRIES' });
  });
  it('zmiana struktury strony → ryzyko „źródło niedostępne”, bez zapisu (nigdy cicha pustka)', async () => {
    const st = new MemStore();
    const r = await runFerrySchedule(deps(st, { 'cargo/rozklad': '<html><body>nowa strona</body></html>', '_jcr_content.timetable.': 503 }).d);
    expect(r.ok).toBe(false);
    expect(st.sailings).toHaveLength(0);
    expect(st.risks.some((x) => x.dedup === 'SOURCE_DOWN:POLFERRIES_SCHEDULE:2026-09-26')).toBe(true);
  });
});

describe('STENA-3 — rozkład/status Gdynia–Karlskrona (JSON 01.10.2026)', () => {
  const GDKA = fx('stena-timetable-gdka-2026-10-01.json');
  const KAGD = fx('stena-timetable-kagd-2026-10-01.json');
  const SPIRIT = 'v-spirit'; const EBBA = 'v-ebba'; const ESTE = 'v-este';
  class StenaStore extends MemStore {
    override async vessels() {
      return [
        { id: WAW, name: 'M/F Wawel', mmsi: null },
        { id: NS, name: 'M/F Nova Star', mmsi: 311000787 },
        { id: SPIRIT, name: 'M/F Stena Spirit', mmsi: 311058100 },
        { id: EBBA, name: 'M/F Stena Ebba', mmsi: 219031310 },
        { id: ESTE, name: 'M/F Stena Estelle', mmsi: 219030885 },
      ];
    }
  }
  it('ferry-status: On Time → ZAPLANOWANY source STENA, trasy GDY-KAA i KAA-GDY', async () => {
    const st = new StenaStore();
    const pages: Record<string, string | number> = {
      'komunikaty-kursowania': 503,
      'timetable.GDKA.2026-09-26': GDKA,
      'timetable.KAGD.2026-09-26': KAGD,
      'timetable.GDKA.2026-09-27': '[]',
      'timetable.KAGD.2026-09-27': '[]',
    };
    const r = await runFerryStatus(deps(st, pages, {}, new Date('2026-09-26T12:00:00Z')).d);
    expect(r.ok).toBe(true);
    const stena = st.sailings.filter((s) => s.source === 'STENA');
    expect(stena.length).toBeGreaterThanOrEqual(4);
    expect(stena.every((s) => s.status === 'ZAPLANOWANY')).toBe(true);
    expect(stena.some((s) => s.route === 'GDY-KAA')).toBe(true);
    expect(stena.some((s) => s.route === 'KAA-GDY')).toBe(true);
  });
  it('ferry-status: Delayed → OPOZNIONY z estimatedLocalDepartureTime', async () => {
    const st = new StenaStore();
    const rows = JSON.parse(GDKA) as Array<Record<string, unknown>>;
    rows[0].status = 'Delayed';
    rows[0].estimatedLocalDepartureTime = '2026-10-01T09:00:00';
    const delayed = JSON.stringify(rows);
    const pages: Record<string, string | number> = {
      'komunikaty-kursowania': 503,
      'timetable.GDKA.2026-09-26': delayed,
      'timetable.KAGD.2026-09-26': '[]',
      'timetable.GDKA.2026-09-27': '[]',
      'timetable.KAGD.2026-09-27': '[]',
    };
    await runFerryStatus(deps(st, pages, {}, new Date('2026-09-26T12:00:00Z')).d);
    const s = st.sailings.find((x) => x.source === 'STENA' && x.route === 'GDY-KAA' && x.vessel_id === EBBA);
    expect(s).toMatchObject({ status: 'OPOZNIONY' });
    expect(s?.delayed_departure_at).toMatch(/2026-10-01T07:00:00/); // 09:00 Warsaw = 07:00 UTC
  });
});

describe('ferry-status — komunikaty (prawdziwa strona 26.09.2026)', () => {
  it('zapisuje rejsy z prawdziwej strony (Planowo → ZAPLANOWANY), bez ryzyk', async () => {
    const st = new MemStore();
    const { d, calls } = deps(st, { 'komunikaty-kursowania': STATUS });
    const r = await runFerryStatus(d);
    expect(r.ok).toBe(true);
    expect(r.unknown).toBe(0);
    expect(r.inserted).toBe(10);
    expect(st.sailings.filter((s) => s.source === 'POLFERRIES')).toHaveLength(10);
    expect(st.sailings.filter((s) => s.source === 'POLFERRIES').every((s) => s.status === 'ZAPLANOWANY')).toBe(true);
    expect(st.risks.some((x) => String(x.dedup).startsWith('SOURCE_DOWN:STENA_STATUS:'))).toBe(true);
    expect(st.risks.some((x) => String(x.dedup).startsWith('SOURCE_DOWN:POLFERRIES_STATUS:'))).toBe(false);
    expect(calls.some((c) => c.includes('komunikaty-kursowania'))).toBe(true);
  });
  it('HTTP 403 Cloudflare → NIEZNANY + ryzyko źródła (II-5), bez zapisu rejsów Polferries', async () => {
    const st = new MemStore();
    const r = await runFerryStatus(deps(st, { 'komunikaty-kursowania': 403, '_jcr_content.timetable.': 503 }).d);
    expect(r.ok).toBe(false);
    expect(r.unknown).toBeGreaterThanOrEqual(1);
    expect(st.risks.some((x) => String(x.dedup).startsWith('SOURCE_DOWN:POLFERRIES_STATUS:'))).toBe(true);
    expect(JSON.stringify(st.risks)).toMatch(/403|Cloudflare/i);
    expect(st.sailings.filter((s) => s.source === 'POLFERRIES')).toHaveLength(0);
  });
  it('odwołanie z komunikatu → ODWOLANY na istniejącym rejsie POLFERRIES; RECZNIE nietknięty', async () => {
    const st = new MemStore();
    await runFerryStatus(deps(st, { 'komunikaty-kursowania': STATUS }).d);
    const r = await runFerryStatus(deps(st, { 'komunikaty-kursowania': mutateWawel26('cancelled', 'Odwołany') }).d);
    expect(r.updated).toBe(1);
    expect(st.sailings.find((s) => s.departure_at === dep26 && s.route === 'GDN-NYN')?.status).toBe('ODWOLANY');
    const st2 = new MemStore();
    st2.sailings.push({ id: 'm', vessel_id: WAW, route: 'GDN-NYN', departure_at: dep26, arrival_at: '2026-09-27T10:00:00.000Z', delayed_departure_at: null, delayed_arrival_at: null, status: 'ZAPLANOWANY', source: 'RECZNIE' });
    const r2 = await runFerryStatus(deps(st2, { 'komunikaty-kursowania': mutateWawel26('cancelled', 'Odwołany') }).d);
    expect(r2.manualKept).toBe(1);
    expect(st2.sailings.find((s) => s.id === 'm')?.status).toBe('ZAPLANOWANY');
  });
  it('opóźnienie (inna godzina w komunikacie) → OPOZNIONY z delayed_*; powrót do planu czyści opóźnienie', async () => {
    const st = new MemStore();
    const i = STATUS.indexOf('2026-09-26 M/F Wawel'); const b = STATUS.indexOf('--schedule-item--body', i); const t = STATUS.indexOf('>18:00<', b);
    const late = STATUS.slice(0, t) + '>20:30<' + STATUS.slice(t + 7);
    await runFerryStatus(deps(st, { 'komunikaty-kursowania': late }).d);
    const s = st.sailings.find((x) => x.departure_at === dep26 && x.route === 'GDN-NYN')!;
    expect(s).toMatchObject({ status: 'OPOZNIONY', delayed_departure_at: '2026-09-26T18:30:00.000Z' });
    await runFerryStatus(deps(st, { 'komunikaty-kursowania': STATUS }).d);
    expect(st.sailings.find((x) => x.id === s.id)).toMatchObject({ status: 'ZAPLANOWANY', delayed_departure_at: null });
  });
  it('status NIEZNANY → rejs bez zmiany, ryzyko MEDIUM dla HHL (raz, deduplikacja)', async () => {
    const st = new MemStore();
    await runFerryStatus(deps(st, { 'komunikaty-kursowania': STATUS }).d);
    const before = JSON.stringify(st.sailings);
    const page = mutateWawel26('diverted', 'Zmiana portu');
    const r = await runFerryStatus(deps(st, { 'komunikaty-kursowania': page }).d);
    expect(r).toMatchObject({ unknown: 1, risks: 1 });
    expect(JSON.stringify(st.sailings)).toBe(before);
    const unknown = st.risks.find((x) => x.dedup === `FERRY_UNKNOWN:M/F Wawel:${dep26}`);
    expect(unknown).toMatchObject({ kind: 'FERRY', severity: 'MEDIUM' });
    expect(String(unknown?.detail.surowy_status)).toContain('diverted');
    await runFerryStatus(deps(st, { 'komunikaty-kursowania': page }).d);
    expect(st.risks.filter((x) => String(x.dedup).startsWith('FERRY_UNKNOWN:'))).toHaveLength(1);
  });
  it('HTTP 503 → ryzyko „źródło niedostępne”, bez zapisu; kolejny udany odczyt zamyka ryzyko', async () => {
    const st = new MemStore();
    const r = await runFerryStatus(deps(st, { 'komunikaty-kursowania': 503, '_jcr_content.timetable.': 503 }).d);
    expect(r.ok).toBe(false);
    expect(st.risks.some((x) => x.title.match(/Źródło niedostępne: status promów/))).toBe(true);
    expect(st.sailings).toHaveLength(0);
    await runFerryStatus(deps(st, { 'komunikaty-kursowania': STATUS }).d);
    expect(st.risks.filter((x) => String(x.dedup).startsWith('SOURCE_DOWN:POLFERRIES_STATUS:'))).toHaveLength(0);
    expect(st.resolved).toContain('SOURCE_DOWN:POLFERRIES_STATUS:');
  });
  it('nagłówek User-Agent wyłącznie ASCII (inaczej fetch odrzuca żądanie)', async () => {
    const { USER_AGENT, DIGITRAFFIC_USER, STENA_IRM_UA } = await import('../supabase/functions/_shared/integrations/jobs');
    expect(/^[\x20-\x7e]+$/.test(USER_AGENT) && /^[\x20-\x7e]+$/.test(DIGITRAFFIC_USER) && /^[\x20-\x7e]+$/.test(STENA_IRM_UA)).toBe(true);
    expect(STENA_IRM_UA).toMatch(/Watch Tower/);
    expect(() => new Headers({ 'User-Agent': USER_AGENT })).not.toThrow();
  });
  it('runJob: nie częściej niż co 15 min (bez zapisu pominięć — F7 #765 A)', async () => {
    const st = new MemStore();
    await runJob('ferry-status', deps(st, { 'komunikaty-kursowania': STATUS }).d);
    const early = await runJob('ferry-status', deps(st, { 'komunikaty-kursowania': STATUS }, {}, new Date(NOW.getTime() + 5 * 60000)).d);
    expect(early.skipped).toBe(true);
    expect(early.observations?.skipped_gap_min).toBeTruthy();
    const later = await runJob('ferry-status', deps(st, { 'komunikaty-kursowania': STATUS }, {}, new Date(NOW.getTime() + 15 * 60000)).d);
    expect(later.skipped).toBeUndefined();
    // #421: po zmianie statusu odświeżany jest też ferry-schedule (zapis przed recordRun statusu).
    // F7 #765 A: pominięcie tylko w odpowiedzi / logu — nie w integration_runs.
    expect(st.runs.map((r) => r.job)).toEqual(['ferry-schedule', 'ferry-status', 'ferry-status']);
    expect(st.runs.filter((r) => r.result.skipped)).toHaveLength(0);
  });
  it('DP-223 (#816): route-hazards MIN=30 — po 30 min nie skipped (cron :17/:47)', async () => {
    expect(MIN_INTERVAL_MIN['route-hazards']).toBe(30);
    const st = new MemStore();
    st.runs.push({
      job: 'route-hazards',
      at: NOW.toISOString(),
      ok: true,
      result: { job: 'route-hazards', mode: 'LIVE', ok: true, started_at: NOW.toISOString() },
    });
    const early = await runJob('route-hazards', deps(st, {}, {}, new Date(NOW.getTime() + 20 * 60_000)).d);
    expect(early.skipped).toBe(true);
    expect(early.observations?.skipped_gap_min).toBeTruthy();
    const later = await runJob('route-hazards', deps(st, {}, {}, new Date(NOW.getTime() + 30 * 60_000)).d);
    expect(later.skipped).toBeUndefined();
    expect(later.ok).toBe(true);
  });
  it('DP-187: lastRun=start+90s, now=start+15min → nie pomija (kotwica started_at)', async () => {
    const st = new MemStore();
    const start = NOW;
    const finished = new Date(start.getTime() + 90_000);
    // road-ee MIN=15: od ran_at (=start+90s) przy cronie +15 min gap=13.5 < 14 → skip;
    // od started_at gap=15 ≥ 14 → nie pomija (#756 / F7 #765).
    st.runs.push({
      job: 'road-ee',
      at: finished.toISOString(),
      ok: true,
      result: {
        job: 'road-ee', mode: 'LIVE', ok: true,
        started_at: start.toISOString(),
      },
    });
    const atCron = new Date(start.getTime() + 15 * 60_000);
    expect((atCron.getTime() - finished.getTime()) / 60_000).toBeLessThan(14);
    expect((atCron.getTime() - start.getTime()) / 60_000).toBe(15);
    const r = await runJob('road-ee', deps(st, {}, {}, atCron).d);
    expect(r.skipped).toBeUndefined();
    expect(r.started_at).toBe(atCron.toISOString());
  });
});

describe('ferry-ais — Digitraffic (prawdziwa odpowiedź 25.09.2026)', () => {
  const sail = (vessel: string, dep: string, arr: string, route: DbSailing['route'] = 'GDN-NYN'): DbSailing => ({
    id: `ais-${vessel}-${route}`, vessel_id: vessel, route, departure_at: dep, arrival_at: arr,
    delayed_departure_at: null, delayed_arrival_at: null, actual_departure_at: null, actual_arrival_at: null,
    status: 'ZAPLANOWANY', source: 'POLFERRIES',
  });
  it('Nova Star w rejsie (100 km na S od Nynäshamn, 17 w.) → W_REJSIE; bez WYPŁYNĄŁ (za daleko od portu / F7)', async () => {
    const st = new MemStore();
    st.sailings.push(sail(NS, '2026-09-24T16:00:00.000Z', '2026-09-25T10:00:00.000Z'), sail(WAW, '2026-09-24T16:00:00.000Z', '2026-09-25T10:00:00.000Z'));
    const r = await runFerryAis(deps(st, { 'digitraffic.fi': AIS }, {}, new Date('2026-09-24T19:40:00Z')).d);
    expect(r.observations?.['M/F Nova Star']).toBe('W_REJSIE');
    expect(r.observations?.['M/F Wawel']).toBe('BRAK_MMSI');
    // DP-128 F7 r1: mid-sea bez pary geofence ≤20 min → brak ATD + BEZ_PRZEJSCIA_GEOFENCE.
    expect(r.observations?.['M/F Nova Star:DEP']).toBe('BEZ_PRZEJSCIA_GEOFENCE');
    expect(st.sailings.find((s) => s.vessel_id === NS)?.actual_departure_at).toBeNull();
    expect(st.risks).toHaveLength(0);
    expect(st.runs.some((x) => x.job === 'ferry-departures' && x.ok)).toBe(true);
  });
  it('świeża pozycja 5 km od GDN + ruch + lastPortPosition → actual_departure_at; stara (>15 min) → bez', async () => {
    const st = new MemStore();
    st.sailings.push(sail(NS, '2026-09-24T16:00:00.000Z', '2026-09-25T10:00:00.000Z'));
    // DP-128: ATD wymaga geofence wyjścia (pozycja w hubie GDN przed ruchem).
    st.vesselPositions.push({ vesselId: NS, lat: 54.40372, lon: 18.68130, observedAt: '2026-09-24T19:30:00.000Z' });
    // GDN 54.40372, 18.68130 → ~5 km NNE
    const near = AIS.replace('17.850695, 57.980348', '18.70, 54.45').replace('"sog" : 17.1', '"sog" : 8');
    await runFerryAis(deps(st, { 'digitraffic.fi': near }, {}, new Date('2026-09-24T19:40:00Z')).d);
    expect(st.sailings.find((s) => s.vessel_id === NS)?.actual_departure_at).toBe('2026-09-24T19:30:00.000Z');
    expect(st.sailings.find((s) => s.vessel_id === NS)?.status).toBe('W_REJSIE'); // #446
    const st2 = new MemStore();
    st2.sailings.push(sail(NS, '2026-09-24T16:00:00.000Z', '2026-09-25T10:00:00.000Z'));
    st2.vesselPositions.push({ vesselId: NS, lat: 54.40372, lon: 18.68130, observedAt: '2026-09-24T19:30:00.000Z' });
    await runFerryAis(deps(st2, { 'digitraffic.fi': near }, {}, new Date('2026-09-24T20:00:00Z')).d);
    expect(st2.sailings.find((s) => s.vessel_id === NS)?.actual_departure_at ?? null).toBeNull();
  });
  it('DP-222 F7 B1: Nova Star 04.11 luka 22 min + SOG≥3 → ATD 17:09 + W_REJSIE', async () => {
    const st = new MemStore();
    st.sailings.push(sail(NS, '2026-11-04T17:00:00.000Z', '2026-11-05T07:00:00.000Z'));
    for (const p of [
      { lat: 54.4041, lon: 18.6781, observedAt: '2026-11-04T16:59:35.000Z', sogKn: 0 },
      { lat: 54.4048, lon: 18.6687, observedAt: '2026-11-04T17:09:44.000Z', sogKn: 5 },
      { lat: 54.4426, lon: 18.6676, observedAt: '2026-11-04T17:31:34.000Z', sogKn: 10.3 },
      { lat: 54.4858, lon: 18.7435, observedAt: '2026-11-04T17:47:45.000Z', sogKn: 16.6 },
    ]) {
      st.vesselPositions.push({ vesselId: NS, ...p });
    }
    const out = AIS.replace('17.850695, 57.980348', '18.7435, 54.4858')
      .replace('"sog" : 17.1', '"sog" : 16.6')
      .replace('1790278580817', String(Date.parse('2026-11-04T17:47:45.000Z')));
    const r = await runFerryAis(deps(st, { 'digitraffic.fi': out }, {}, new Date('2026-11-04T17:50:00Z')).d);
    const s = st.sailings.find((x) => x.vessel_id === NS)!;
    expect(s.actual_departure_at).toBe('2026-11-04T17:09:44.000Z');
    expect(s.status).toBe('W_REJSIE');
    expect(r.observations?.['M/F Nova Star:DEP']).toMatch(/^WYPŁYNĄŁ_/);
  });
  it('DP-222: Nova 02.11 para AIS; późniejsze ATA nie psuje since/accept', async () => {
    const st = new MemStore();
    const target = sail(NS, '2026-11-02T17:00:00.000Z', '2026-11-03T11:00:00.000Z');
    target.id = 'nova-0211-gdn';
    const later = sail(NS, '2026-11-03T17:00:00.000Z', '2026-11-04T11:00:00.000Z', 'NYN-GDN');
    later.id = 'nova-0311-nyn';
    later.status = 'DOPLYNAL';
    later.actual_departure_at = '2026-11-03T17:23:30.000Z';
    later.actual_arrival_at = '2026-11-04T10:25:14.000Z';
    st.sailings.push(target, later);
    expect(previousActualArrivalBefore(st.sailings, NS, target.id, target.departure_at)).toBeNull();
    for (const p of [
      { lat: 54.4040, lon: 18.6781, observedAt: '2026-11-02T17:04:10.000Z', sogKn: 0 },
      { lat: 54.4037, lon: 18.6774, observedAt: '2026-11-02T17:08:47.000Z', sogKn: 1.3 },
      { lat: 54.4044, lon: 18.6713, observedAt: '2026-11-02T17:11:46.000Z', sogKn: 4.8 },
      { lat: 54.4052, lon: 18.6668, observedAt: '2026-11-02T17:13:46.000Z', sogKn: 5.1 },
      { lat: 54.4117, lon: 18.6597, observedAt: '2026-11-02T17:19:06.000Z', sogKn: 5.8 },
      { lat: 54.4275, lon: 18.6499, observedAt: '2026-11-02T17:28:16.000Z', sogKn: 7 },
      { lat: 54.4348, lon: 18.6556, observedAt: '2026-11-02T17:31:36.000Z', sogKn: 9.1 },
      { lat: 54.4917, lon: 18.7493, observedAt: '2026-11-02T17:54:26.000Z', sogKn: 16.1 },
    ]) {
      st.vesselPositions.push({ vesselId: NS, ...p });
    }
    const out = AIS.replace('17.850695, 57.980348', '18.7493, 54.4917')
      .replace('"sog" : 17.1', '"sog" : 16.1')
      .replace('1790278580817', String(Date.parse('2026-11-02T17:54:26.000Z')));
    const r = await runFerryAis(deps(st, { 'digitraffic.fi': out }, {}, new Date('2026-11-02T17:55:00Z')).d);
    expect(st.sailings.find((x) => x.id === target.id)?.actual_departure_at).toBe('2026-11-02T17:19:06.000Z');
    expect(r.observations?.['M/F Nova Star:DEP']).toMatch(/^WYPŁYNĄŁ_/);
  });
  it('DP-222 F7 B1: postój w porcie 2 h po ETD → bez ATD', async () => {
    const st = new MemStore();
    st.sailings.push(sail(NS, '2026-11-04T16:00:00.000Z', '2026-11-05T06:00:00.000Z'));
    for (let m = 0; m <= 120; m += 20) {
      st.vesselPositions.push({
        vesselId: NS, lat: 54.40372, lon: 18.68130,
        observedAt: new Date(Date.parse('2026-11-04T16:00:00.000Z') + m * 60_000).toISOString(),
        sogKn: 0,
      });
    }
    const dock = AIS.replace('17.850695, 57.980348', '18.68130, 54.40372')
      .replace('"sog" : 17.1', '"sog" : 0')
      .replace('1790278580817', String(Date.parse('2026-11-04T18:00:00.000Z')));
    const r = await runFerryAis(deps(st, { 'digitraffic.fi': dock }, {}, new Date('2026-11-04T18:05:00Z')).d);
    expect(st.sailings.find((x) => x.vessel_id === NS)?.actual_departure_at ?? null).toBeNull();
    expect(r.observations?.['M/F Nova Star:DEP']).toBeUndefined();
  });
  it('DP-222 F7 B2: ATD + późniejszy rejs z ATD → DOPLYNAL (bez ATA)', async () => {
    const st = new MemStore();
    const old = sail(WAW, '2026-11-03T17:00:00.000Z', '2026-11-04T07:00:00.000Z');
    old.status = 'W_REJSIE';
    old.actual_departure_at = '2026-11-03T17:10:00.000Z';
    const next = sail(WAW, '2026-11-04T17:14:00.000Z', '2026-11-05T07:00:00.000Z', 'NYN-GDN');
    next.id = 'ais-waw-nyn-gdn';
    next.actual_departure_at = '2026-11-04T17:20:00.000Z';
    next.status = 'W_REJSIE';
    st.sailings.push(old, next);
    /* Mid-sea fix — bez nowego ATD; closeStale zamyka stary GDN-NYN. */
    const mid = AIS.replace('1790278580817', String(Date.parse('2026-11-05T12:00:00.000Z')));
    const r = await runFerryAis(deps(st, { 'digitraffic.fi': mid }, {}, new Date('2026-11-05T12:05:00Z')).d);
    expect(st.sailings.find((x) => x.id === old.id)).toMatchObject({
      status: 'DOPLYNAL',
      actual_arrival_at: null,
      actual_departure_at: '2026-11-03T17:10:00.000Z',
    });
    expect(r.observations?.dp222_closed_gdn).toBe('1');
  });
  it('DP-222 F7 B2: rejs trwający (przed arrival+6h, bez późniejszego ATD) → W_REJSIE', async () => {
    const st = new MemStore();
    st.sailings.push(sail(NS, '2026-11-04T17:00:00.000Z', '2026-11-05T07:00:00.000Z'));
    for (const p of [
      { lat: 54.4041, lon: 18.6781, observedAt: '2026-11-04T16:59:35.000Z', sogKn: 0 },
      { lat: 54.4048, lon: 18.6687, observedAt: '2026-11-04T17:09:44.000Z', sogKn: 5 },
      { lat: 54.4426, lon: 18.6676, observedAt: '2026-11-04T17:31:34.000Z', sogKn: 10.3 },
      { lat: 54.4858, lon: 18.7435, observedAt: '2026-11-04T17:47:45.000Z', sogKn: 16.6 },
    ]) {
      st.vesselPositions.push({ vesselId: NS, ...p });
    }
    const out = AIS.replace('17.850695, 57.980348', '18.7435, 54.4858')
      .replace('"sog" : 17.1', '"sog" : 16.6')
      .replace('1790278580817', String(Date.parse('2026-11-04T17:47:45.000Z')));
    /* Jak BS-03 przed ATA — now = 17:50, arrival 07:00+1d → W_REJSIE. */
    await runFerryAis(deps(st, { 'digitraffic.fi': out }, {}, new Date('2026-11-04T17:50:00Z')).d);
    expect(st.sailings.find((x) => x.vessel_id === NS)).toMatchObject({
      actual_departure_at: '2026-11-04T17:09:44.000Z',
      status: 'W_REJSIE',
      actual_arrival_at: null,
    });
  });
  it('KAA-GDY w Karlskronie (port odejścia) → bez fałszywego dopłynięcia; NYN-GDN w Gdańsku + geofence → actual_arrival', async () => {
    const st = new MemStore();
    st.sailings.push(sail(NS, '2026-09-24T16:00:00.000Z', '2026-09-25T10:00:00.000Z', 'KAA-GDY'));
    const inKaa = AIS.replace('17.850695, 57.980348', '15.63080, 56.16460').replace('"sog" : 17.1', '"sog" : 0.2');
    const rKaa = await runFerryAis(deps(st, { 'digitraffic.fi': inKaa }, {}, new Date('2026-09-24T19:40:00Z')).d);
    expect(st.sailings.find((s) => s.route === 'KAA-GDY')?.actual_arrival_at ?? null).toBeNull();
    expect(rKaa.observations?.['M/F Nova Star']).toBe('W_PORCIE_KARLSKRONA');
    const st2 = new MemStore();
    const sArr = sail(NS, '2026-09-24T16:00:00.000Z', '2026-09-25T10:00:00.000Z', 'NYN-GDN');
    sArr.actual_departure_at = '2026-09-24T16:05:00.000Z';
    st2.sailings.push(sArr);
    // DP-128 F7 r1: poprzednia ≤20 min przed wejściem, >4 km od GDN (albo SOG≥3).
    st2.vesselPositions.push({
      vesselId: NS, lat: 54.45, lon: 18.75, observedAt: '2026-09-24T19:25:00.000Z', sogKn: 8,
    });
    const inGdn = AIS.replace('17.850695, 57.980348', '18.68130, 54.40372').replace('"sog" : 17.1', '"sog" : 0.2');
    await runFerryAis(deps(st2, { 'digitraffic.fi': inGdn }, {}, new Date('2026-09-24T19:40:00Z')).d);
    expect(st2.sailings.find((s) => s.route === 'NYN-GDN')?.actual_arrival_at).toBeTruthy();
    expect(st2.sailings.find((s) => s.route === 'NYN-GDN')?.status).toBe('DOPLYNAL'); // #446
    expect(st2.runs.some((x) => x.job === 'ferry-departures')).toBe(true);
  });
  it('F7 r2: lastPortPosition sprzed dni → bez actual_departure; dopiero w oknie [plan−2h, teraz]', async () => {
    const st = new MemStore();
    // Plan 22.10 08:00; świeża ~6 km od GDY + stara w porcie 19.10 → nie bierzemy 19.10 (poza since).
    st.sailings.push(sail(NS, '2026-10-22T08:00:00.000Z', '2026-10-22T20:00:00.000Z', 'GDY-KAA'));
    st.vesselPositions.push({ vesselId: NS, lat: 54.53321, lon: 18.54425, observedAt: '2026-10-19T06:00:00.000Z' });
    /* ~6 km N od GDY — w oknie zapytania 15 km (F7 r1), poza histerezą OUT. */
    const far = AIS.replace('17.850695, 57.980348', '18.54425, 54.587').replace('"sog" : 17.1', '"sog" : 8')
      .replace('1790278580817', String(Date.parse('2026-10-22T08:10:00.000Z')));
    await runFerryAis(deps(st, { 'digitraffic.fi': far }, {}, new Date('2026-10-22T08:12:00Z')).d);
    expect(st.sailings.find((s) => s.vessel_id === NS)?.actual_departure_at ?? null).toBeNull();
    // Świeża pozycja w porcie w oknie planu + ruch >4 km w ≤20 min → OK.
    const st2 = new MemStore();
    st2.sailings.push(sail(NS, '2026-10-22T08:00:00.000Z', '2026-10-22T20:00:00.000Z', 'GDY-KAA'));
    st2.vesselPositions.push({ vesselId: NS, lat: 54.53321, lon: 18.54425, observedAt: '2026-10-22T07:55:00.000Z' });
    await runFerryAis(deps(st2, { 'digitraffic.fi': far }, {}, new Date('2026-10-22T08:12:00Z')).d);
    expect(st2.sailings.find((s) => s.vessel_id === NS)?.actual_departure_at).toBe('2026-10-22T07:55:00.000Z');
  });
  it('DP-128: odrzucony lastPortPosition + bieżąca 3–10 km → BEZ actual_departure (geofence)', async () => {
    // Etap DP-128 / BN4 — supersedes #446 zapas 3–10 km bez przejścia przez geofence.
    const st = new MemStore();
    st.sailings.push(sail(NS, '2026-10-22T08:00:00.000Z', '2026-10-22T20:00:00.000Z', 'GDY-KAA'));
    st.vesselPositions.push({ vesselId: NS, lat: 54.53321, lon: 18.54425, observedAt: '2026-10-19T06:00:00.000Z' });
    const mid = AIS.replace('17.850695, 57.980348', '18.62, 54.55').replace('"sog" : 17.1', '"sog" : 8')
      .replace('1790278580817', String(Date.parse('2026-10-22T08:10:00.000Z')));
    const r = await runFerryAis(deps(st, { 'digitraffic.fi': mid }, {}, new Date('2026-10-22T08:12:00Z')).d);
    expect(st.sailings.find((s) => s.vessel_id === NS)?.actual_departure_at ?? null).toBeNull();
    expect(r.observations?.['M/F Nova Star:DEP']).toBe('BEZ_PRZEJSCIA_GEOFENCE');
  });
  it('F7 r2: dopłynięcie starsze niż wypłynięcie / >15 min → bez actual_arrival', async () => {
    const st = new MemStore();
    const s = sail(NS, '2026-09-24T08:00:00.000Z', '2026-09-24T20:00:00.000Z', 'KAA-GDY');
    s.actual_departure_at = '2026-09-24T08:00:00.000Z';
    st.sailings.push(s);
    // W Gdyni, wiek ≤15 min, ale sygnał 07:50 (przed wypłynięciem 08:00).
    const early = AIS.replace('17.850695, 57.980348', '18.54425, 54.53321').replace('"sog" : 17.1', '"sog" : 0.2')
      .replace('1790278580817', String(Date.parse('2026-09-24T07:50:00.000Z')));
    await runFerryAis(deps(st, { 'digitraffic.fi': early }, {}, new Date('2026-09-24T08:00:00Z')).d);
    expect(st.sailings.find((x) => x.route === 'KAA-GDY')?.actual_arrival_at ?? null).toBeNull();
    // Świeże dopłynięcie + poprzednia ≤20 min poza hubem → OK (DP-128 F7 r1).
    const st2 = new MemStore();
    const s2 = sail(NS, '2026-09-24T08:00:00.000Z', '2026-09-24T20:00:00.000Z', 'KAA-GDY');
    s2.actual_departure_at = '2026-09-24T08:00:00.000Z';
    st2.sailings.push(s2);
    st2.vesselPositions.push({
      vesselId: NS, lat: 54.56, lon: 18.60, observedAt: '2026-09-24T19:25:00.000Z', sogKn: 8,
    });
    const okArr = AIS.replace('17.850695, 57.980348', '18.54425, 54.53321').replace('"sog" : 17.1', '"sog" : 0.2')
      .replace('1790278580817', String(Date.parse('2026-09-24T19:35:00.000Z')));
    await runFerryAis(deps(st2, { 'digitraffic.fi': okArr }, {}, new Date('2026-09-24T19:40:00Z')).d);
    expect(st2.sailings.find((x) => x.route === 'KAA-GDY')?.actual_arrival_at).toBeTruthy();
    expect(st2.sailings.find((x) => x.route === 'KAA-GDY')?.status).toBe('DOPLYNAL'); // #446
  });
  it('postój w porcie Nynäshamn + geofence → actual_arrival_at + INFO CC BY 4.0; sygnał >1 h → bez AIS_GAP', async () => {
    const st = new MemStore();
    const sNyn = sail(NS, '2026-09-24T16:00:00.000Z', '2026-09-25T10:00:00.000Z');
    sNyn.actual_departure_at = '2026-09-24T16:10:00.000Z';
    st.sailings.push(sNyn);
    st.loadCounts.set(sNyn.id, 1); /* F7 #706 B1: INFO także NYN tylko z transportami */
    /* F7 r1: poprzednia ≤20 min przed wejściem, >4 km od NYN. */
    st.vesselPositions.push({
      vesselId: NS, lat: 58.85, lon: 17.95, observedAt: '2026-09-24T19:25:00.000Z', sogKn: 6,
    });
    const inPort = AIS.replace('17.850695, 57.980348', '17.9562, 58.9046').replace('"sog" : 17.1', '"sog" : 0.2');
    await runFerryAis(deps(st, { 'digitraffic.fi': inPort }, {}, new Date('2026-09-24T19:40:00Z')).d);
    expect(st.risks[0]).toMatchObject({ kind: 'FERRY', severity: 'INFO' });
    expect(String(st.risks[0].detail.atrybucja)).toBe('Dane AIS: Fintraffic / digitraffic.fi, licencja CC BY 4.0');
    expect(st.sailings.find((s) => s.vessel_id === NS)?.actual_arrival_at).toBeTruthy();
    // ferry-status czyści delayed_*, nie actual_*
    expect(st.sailings.find((s) => s.vessel_id === NS)?.delayed_arrival_at).toBeNull();
    const st2 = new MemStore();
    st2.sailings.push(sail(NS, '2026-09-24T16:00:00.000Z', '2026-09-25T10:00:00.000Z'));
    const r = await runFerryAis(deps(st2, { 'digitraffic.fi': inPort }, {}, new Date('2026-09-25T09:00:00Z')).d);
    expect(r.observations?.['M/F Nova Star']).toBe('BRAK_SWIEZEGO_SYGNALU');
    expect(st2.risks.some((x) => x.dedup.startsWith('AIS_NYN:'))).toBe(false);
    expect(st2.risks.some((x) => x.titleKey === 'rk_ais_gap')).toBe(false);
    expect(st2.runs.some((x) => x.job === 'ferry-departures')).toBe(true);
  });
  it('DP-128: pierwszy sygnał już w porcie (bez toru poza hubem) → bez ATA', async () => {
    const st = new MemStore();
    const s = sail(NS, '2026-11-01T08:30:00.000Z', '2026-11-01T11:10:00.000Z', 'HELA-TLL');
    s.actual_departure_at = '2026-11-01T08:21:00.000Z';
    st.sailings.push(s);
    // Tallinn Terminal A — jak prod Viking XPRS 01.11 (ATA bez geofence).
    const inTll = AIS.replace('17.850695, 57.980348', '24.768, 59.444').replace('"sog" : 17.1', '"sog" : 0')
      .replace('1790278580817', String(Date.parse('2026-11-01T12:18:52.731Z')));
    const r = await runFerryAis(deps(st, { 'digitraffic.fi': inTll }, {}, new Date('2026-11-01T12:20:00Z')).d);
    expect(st.sailings[0].actual_arrival_at).toBeNull();
    expect(r.observations?.['M/F Nova Star:ARR']).toBe('BEZ_PRZEJSCIA_GEOFENCE');
  });
});

describe('I-2j — ferry-ais zapisuje pozycje promów do bazy (vessel_positions)', () => {
  const sail = (vessel: string, dep: string, arr: string): DbSailing => ({
    id: `ais-${vessel}`, vessel_id: vessel, route: 'GDN-NYN', departure_at: dep, arrival_at: arr,
    delayed_departure_at: null, delayed_arrival_at: null, actual_departure_at: null, actual_arrival_at: null,
    status: 'ZAPLANOWANY', source: 'POLFERRIES',
  });
  it('rejs w toku: pozycja z czasem sygnału AIS; powtórka tego samego sygnału = 0 nowych wierszy', async () => {
    const st = new MemStore();
    st.sailings.push(sail(NS, '2026-09-24T16:00:00.000Z', '2026-09-25T10:00:00.000Z'));
    await runFerryAis(deps(st, { 'digitraffic.fi': AIS }, {}, new Date('2026-09-24T19:40:00Z')).d);
    expect(st.vesselPositions).toHaveLength(1);
    expect(st.vesselPositions[0]).toMatchObject({ vesselId: NS, lat: 57.980348, lon: 17.850695 });
    expect(st.vesselPositions[0].observedAt).toMatch(/^2026-09-2\dT/);
    await runFerryAis(deps(st, { 'digitraffic.fi': AIS }, {}, new Date('2026-09-24T19:50:00Z')).d);
    expect(st.vesselPositions).toHaveLength(1);
  });
  it('bez rejsu w toku: pozycja zapisana (mapa), bez obserwacji i bez ryzyka; statek bez MMSI — bez zapytania', async () => {
    const st = new MemStore();
    const { d, calls } = deps(st, { 'digitraffic.fi': AIS }, {}, new Date('2026-09-24T19:40:00Z'));
    const r = await runFerryAis(d);
    expect(calls).toHaveLength(1);
    expect(st.vesselPositions.map((p) => p.vesselId)).toEqual([NS]);
    expect(r.observations).toEqual({});
    expect(st.risks).toHaveLength(0);
  });
  it('brak statku w odpowiedzi Digitraffic → 0 pozycji (nie zmyślamy)', async () => {
    const st = new MemStore();
    await runFerryAis(deps(st, { 'digitraffic.fi': '{"type":"FeatureCollection","features":[]}' }, {}, new Date('2026-09-24T19:40:00Z')).d);
    expect(st.vesselPositions).toHaveLength(0);
  });
});

describe('road-se — Trafikverket (II-6 RoadCondition + WeatherMeasurepoint)', () => {
  it('bez klucza: tryb DEMO, żadnego zapytania (funkcja nie działa na niby)', async () => {
    const st = new MemStore();
    const { d, calls } = deps(st, {});
    expect(await runRoadSe(d)).toMatchObject({ mode: 'DEMO', ok: true });
    expect(calls).toHaveLength(0);
  });
  it('z kluczem: śliskość E4 + śnieg → ROAD_SE + slowdown 1.15; E14 i norma pominięte', async () => {
    const st = new MemStore();
    let n = 0;
    const pages: Record<string, string | number> = {};
    const { d, calls } = deps(st, pages, { TRAFIKVERKET_API_KEY: 'k' });
    // trzy POST na ten sam URL — kolejność: RoadCondition, Weather, Situation (pusta = brak zmyślonych zdarzeń)
    const orig = d.fetch;
    d.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push(url);
      if (url.includes('trafikinfo.trafikverket.se')) {
        n++;
        const body = n === 1 ? TV_RC : n === 2 ? TV_WX : TV_SIT_EMPTY;
        return new Response(body, { status: 200 });
      }
      return orig(input, init);
    }) as typeof fetch;
    const r = await runRoadSe(d);
    expect(r.risks).toBe(2);
    expect(st.risks.map((x) => x.dedup).sort()).toEqual(['ROAD_SE:RC:RC_E4_SLIP_1', 'ROAD_SE:WX:WX_SNOW_1']);
    expect(st.corridor).toMatchObject({ corridor: 'SE_E4', slowdownMult: 1.15 });
    expect(r.observations?.slowdown).toBe('1.15');
    expect(r.observations?.situations).toBe('0');
    expect((st.corridor?.detail as { situations?: unknown[] }).situations).toEqual([]);
    expect(calls.filter((c) => c.includes('trafikinfo'))).toHaveLength(3);
    expect(distanceToCorridorKm(63.1792, 14.6357, CORRIDOR_SE)).toBeGreaterThan(100);
  });
  it('błąd obu źródeł → ryzyko „źródło niedostępne” ROAD_SE', async () => {
    const st = new MemStore();
    await runRoadSe(deps(st, { 'trafikverket.se': 401 }, { TRAFIKVERKET_API_KEY: 'k' }).d);
    expect(st.risks[0]).toMatchObject({ kind: 'ROAD_SE', dedup: 'SOURCE_DOWN:TRAFIKVERKET:2026-09-26' });
  });
});

  it('Situation 1.6 na E4 → ROAD_SE; poza korytarzem, zawieszone i pusta lista nie tworzą zdarzeń', async () => {
    const q = trafikverketSituationQuery('klucz-test');
    expect(q).toContain('schemaversion="1.6"');
    expect(q).toContain('namespace="road.trafficinfo"');
    expect(q).not.toContain('schemaversion="1.5"');
    const parsed = parseTrafikverketSituations(JSON.parse(TV_SIT));
    // jedna sytuacja, kilka odchyleń: zostaje wypadek (wyżej niż roboty); info i droga 45 odpadają
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({ id: 'SE_STA_TRISSID_1_7654321', kind: 'wypadek', road: 'E4', severity: 'HIGH' });
    /* Decyzja 99: SE poza E4/E22 → LOW „obok trasy” (gdy trafia do ROAD_SE). */
    const onSe = roadRisk('SE', parsed[0]!, 'https://www.trafikverket.se/');
    expect(onSe.title).toMatch(/^Warunki drogowe E4:/);
    expect(onSe.title).not.toMatch(/obok trasy/);
    expect(seIsOffMainCorridor({ ...parsed[0]!, road: 'E20' })).toBe(true);
    const offSe = roadRisk('SE', { ...parsed[0]!, road: 'E20', corridorMatch: 'off' }, 'https://www.trafikverket.se/');
    expect(offSe.severity).toBe('LOW');
    expect(offSe.title).toMatch(/Warunki drogowe E20 · obok trasy:/);
    expect(offSe.detail?.obok_trasy).toBe(true);
    const off = JSON.parse(TV_SIT);
    for (const d of off.RESPONSE.RESULT[0].Situation[0].Deviation) d.Geometry.WGS84 = 'POINT (12.694 56.046)';
    expect(parseTrafikverketSituations(off)).toHaveLength(0);
    const suspended = JSON.parse(TV_SIT);
    for (const d of suspended.RESPONSE.RESULT[0].Situation[0].Deviation) d.Suspended = true;
    expect(parseTrafikverketSituations(suspended)).toHaveLength(0);
    expect(parseTrafikverketSituations(JSON.parse(TV_SIT_EMPTY))).toEqual([]);

    const st = new MemStore();
    st.risks.push({ kind: 'ROAD_SE', severity: 'HIGH', title: 'stare', titleKey: 'rk_road_se', params: {}, detail: {}, dedup: 'ROAD_SE:SIT:STARE', sourceUrl: '', validUntil: null });
    let n = 0;
    const bodies = [TV_RC, TV_WX, TV_SIT];
    const { d } = deps(st, {}, { TRAFIKVERKET_API_KEY: 'k' });
    d.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (!url.includes('trafikinfo.trafikverket.se')) throw new Error(url);
      return new Response(bodies[n++] ?? TV_SIT_EMPTY, { status: 200 });
    }) as typeof fetch;
    const r = await runRoadSe(d);
    expect(r.observations?.slowdown).toBe('1.15');
    expect(st.risks.map((x) => x.dedup).sort()).toEqual(['ROAD_SE:RC:RC_E4_SLIP_1', 'ROAD_SE:SIT:SE_STA_TRISSID_1_7654321', 'ROAD_SE:WX:WX_SNOW_1']);
    expect(st.risks.find((x) => x.dedup === 'ROAD_SE:SIT:SE_STA_TRISSID_1_7654321')).toMatchObject({ kind: 'ROAD_SE', severity: 'HIGH' });
    const detail = st.corridor?.detail as { situations?: { id: string; kind: string }[]; situationsStatus?: string };
    expect(detail.situationsStatus).toBe('ok');
    expect(detail.situations?.map((s) => s.kind)).toEqual(['wypadek']);
    expect(st.corridors.some((c) => c.corridor === 'SE_E22')).toBe(true);
    const e4 = st.corridor?.detail as { drogi?: string[] };
    expect(e4.drogi).toEqual(['E4', 'E22']);
  });

  it('błąd samych sytuacji nie kasuje współczynnika II-6 i nie zmyśla zdarzeń', async () => {
    const st = new MemStore();
    let n = 0;
    const { d } = deps(st, {}, { TRAFIKVERKET_API_KEY: 'k' });
    d.fetch = (async () => {
      n++;
      if (n === 3) return new Response('nope', { status: 503 });
      return new Response(n === 1 ? TV_RC : TV_WX, { status: 200 });
    }) as typeof fetch;
    const r = await runRoadSe(d);
    expect(r.ok).toBe(false);
    expect(r.observations?.slowdown).toBe('1.15');
    expect(st.risks.map((x) => x.dedup).sort()).toEqual(['ROAD_SE:RC:RC_E4_SLIP_1', 'ROAD_SE:WX:WX_SNOW_1']);
    expect((st.corridor?.detail as { situationsStatus?: string }).situationsStatus).toBe('blad');
    expect((st.corridor?.detail as { situations?: unknown[] }).situations).toEqual([]);
  });

  it('koperta błędu Situation nie jest pustą listą i nie zamyka istniejących ryzyk', async () => {
    const body = JSON.stringify({ RESPONSE: { RESULT: [{ ERROR: { SOURCE: 'Request', MESSAGE: 'ObjectType does not exist' } }] } });
    expect(trafikverketResultError(JSON.parse(body))).toMatch(/does not exist/);
    const st = new MemStore();
    st.risks.push({ kind: 'ROAD_SE', severity: 'HIGH', title: 'stare', titleKey: 'rk_road_se', params: {}, detail: {}, dedup: 'ROAD_SE:SIT:ZOSTAJE', sourceUrl: '', validUntil: null });
    let n = 0;
    const { d } = deps(st, {}, { TRAFIKVERKET_API_KEY: 'k' });
    d.fetch = (async () => {
      n++;
      return new Response(n === 3 ? body : n === 1 ? TV_RC : TV_WX, { status: 200 });
    }) as typeof fetch;
    const r = await runRoadSe(d);
    expect(r.ok).toBe(false);
    expect(st.risks.some((x) => x.dedup === 'ROAD_SE:SIT:ZOSTAJE')).toBe(true);
    expect((st.corridor?.detail as { situationsStatus?: string }).situationsStatus).toBe('blad');
    expect(r.observations?.slowdown).toBe('1.15');
  });

  it('F7 #780 r3: nieznany kod TV → DeepL + pamięć; brak RESOURCE_MISSING:TV_CODE; tv_codes_auto', async () => {
    const sit = JSON.parse(TV_SIT);
    for (const d of sit.RESPONSE.RESULT[0].Situation[0].Deviation) {
      d.MessageType = 'ZzzNytt';
      d.MessageCodeValue = 'accidentInvolvingHeavyLorries';
      d.Message = 'Tillfällig stängning vid olycka';
      d.Header = '';
    }
    const memory = new Map<string, string>();
    let deeplN = 0;
    let used = 0;
    class TranslateStore extends MemStore {
      async translationGet(hash: string) { return memory.get(hash) ?? null; }
      async translationPut(hash: string, _s: string, pl: string) { memory.set(hash, pl); }
      async translationEnqueue() {}
      async translationDequeue() {}
      async deeplUsage() { return { characters: used, limit: 1_000_000 }; }
      async deeplAddUsage(n: number) { used += n; return used; }
    }
    const st = new TranslateStore();
    st.risks.push({
      kind: 'RESOURCE_MISSING', severity: 'LOW', title: 'stary TV', titleKey: 'rk_tv_unknown_code_hhl',
      params: {}, detail: { rule: 'TV_CODE' }, dedup: 'RESOURCE_MISSING:TV_CODE:2026-09-25',
      sourceUrl: '', validUntil: null,
    });
    const bodies = [TV_RC, TV_WX, JSON.stringify(sit)];
    let n = 0;
    const { d } = deps(st, {}, { TRAFIKVERKET_API_KEY: 'k', DEEPL_API_KEY: 'dk' });
    d.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('api-free.deepl.com')) {
        deeplN += 1;
        return new Response(JSON.stringify({ translations: [{ text: 'Tymczasowe zamknięcie przy wypadku' }] }), { status: 200 });
      }
      if (!url.includes('trafikinfo')) throw new Error(url);
      return new Response(bodies[n++] ?? TV_SIT_EMPTY, { status: 200 });
    }) as typeof fetch;
    const r1 = await runRoadSe(d);
    expect(Number(r1.observations?.tv_codes_auto ?? 0)).toBeGreaterThan(0);
    expect(st.risks.some((x) => String(x.dedup).startsWith('RESOURCE_MISSING:TV_CODE:'))).toBe(false);
    const sitRisk = st.risks.find((x) => String(x.dedup).startsWith('ROAD_SE:SIT:'));
    expect(sitRisk?.title).toMatch(/^Warunki drogowe E4:/);
    expect(sitRisk?.title).not.toMatch(/accidentInvolving|Tillfällig|stängning|ZzzNytt|RESOURCE_MISSING/);
    expect(deeplN).toBeGreaterThanOrEqual(1);
    /* opis / note z DeepL albo „Tłumaczenie w toku” — nigdy SV w tytule (powyżej) */
    expect(String(sitRisk?.detail?.opis ?? sitRisk?.title)).toMatch(/Tymczasowe|wypadek|Tłumaczenie|zdarzenie/i);
    const deeplFirst = deeplN;
    n = 0;
    const r2 = await runRoadSe(d);
    expect(Number(r2.observations?.tv_codes_auto ?? 0)).toBeGreaterThan(0);
    expect(deeplN).toBe(deeplFirst);
    expect(st.risks.some((x) => String(x.dedup).startsWith('RESOURCE_MISSING:TV_CODE:'))).toBe(false);
  });

const HERE_TRAFFIC_PL = JSON.stringify({
  sourceUpdated: '2026-10-05T10:00:00Z',
  results: [
    {
      location: {
        length: 1200,
        shape: { links: [{ points: [{ lat: 53.12, lng: 18.01 }, { lat: 53.13, lng: 18.02 }], length: 1200, functionalClass: 2 }] },
      },
      incidentDetails: {
        id: 'inc-pl-1', originalId: 'inc-pl-1',
        startTime: '2026-10-05T08:00:00Z', endTime: '2026-10-06T20:00:00Z',
        roadClosed: true, criticality: 'major', type: 'construction',
        summary: { value: 'Roboty S5 — zwężenie' },
        description: { value: 'Roboty drogowe przy węźle Bydgoszcz — zwężenie pasa' },
      },
    },
    {
      location: {
        length: 500,
        shape: { links: [{ points: [{ lat: 50.66, lng: 17.92 }, { lat: 50.67, lng: 17.93 }], length: 500, functionalClass: 1 }] },
      },
      incidentDetails: {
        id: 'inc-opole', originalId: 'inc-opole',
        roadClosed: false, criticality: 'minor', type: 'accident',
        summary: { value: 'Wypadek A4 Opole — poza korytarzem' },
        description: { value: 'poza' },
      },
    },
  ],
});

describe('road-pl — H-2-PL HERE Traffic + zapas KPD', () => {
  it('bez HERE i KPD: tryb DEMO', async () => {
    expect(await runRoadPl(deps(new MemStore(), {}).d)).toMatchObject({ mode: 'DEMO' });
  });
  it('HERE Traffic: incydent na korytarzu → ROAD_PL; Opole pominięte; 1× note traffic', async () => {
    const st = new MemStore();
    const r = await runRoadPl(deps(
      st,
      { 'data.traffic.hereapi.com': HERE_TRAFFIC_PL },
      { HERE_API_KEY: 'test-key' },
    ).d);
    expect(r).toMatchObject({ mode: 'LIVE', ok: true, risks: 1 });
    expect(r.observations?.source).toBe('here_traffic');
    expect(st.hereNotes).toEqual([{ service: 'traffic', n: 1 }]);
    expect(st.risks[0]).toMatchObject({ kind: 'ROAD_PL', severity: 'HIGH', dedup: 'ROAD_PL:HERE:inc-pl-1' });
    expect(String(st.risks[0].detail.opis)).toMatch(/Bydgoszcz/);
    expect(st.risks).toHaveLength(1);
  });
  it('KPD zapas gdy brak HERE_API_KEY', async () => {
    const st = new MemStore();
    const r = await runRoadPl(deps(st, { 'kpd.example': DATEX }, { KPD_DATEX_URL: 'https://kpd.example/datex' }).d);
    expect(r.risks).toBe(1);
    expect(st.risks[0]).toMatchObject({ kind: 'ROAD_PL', severity: 'HIGH', dedup: 'ROAD_PL:PL-GDDKIA-R-1001', validUntil: '2026-10-15T20:00:00+02:00' });
    expect(String(st.risks[0].detail.opis)).toMatch(/S5 węzeł Bydgoszcz/);
  });
});

describe('traffic-flow — CLEAN-TT-HERE (TomTom wycofany)', () => {
  it('zawsze DEMO; bez pobierania TomTom nawet przy kluczu w env', async () => {
    const st = new MemStore();
    const r = await runTrafficFlow(deps(st, {}, { TOMTOM_API_KEY: 'sekret' }).d);
    expect(r).toMatchObject({ job: 'traffic-flow', mode: 'DEMO', ok: true });
    expect(String(r.reason)).toMatch(/CLEAN-TT-HERE|wycofany/i);
    expect(st.risks).toHaveLength(0);
  });
});

describe('planSailingSync — zasady', () => {
  it('nieznany statek → pominięty i zgłoszony; rejs sprzed okna pominięty', () => {
    const p = planSailingSync({
      existing: [], vessels: [{ id: WAW, name: 'M/F Wawel', mmsi: null }], projectId: 'p', sinceUtc: '2026-09-25T00:00:00Z',
      incoming: [
        { route: 'GDN-NYN', vessel: 'M/F Baltivia', departureUtc: dep26, arrivalUtc: '2026-09-27T10:00:00Z' },
        { route: 'GDN-NYN', vessel: 'M/F Wawel', departureUtc: '2026-09-01T16:00:00Z', arrivalUtc: '2026-09-02T10:00:00Z' },
      ],
    });
    expect(p.unknownVessels).toEqual(['M/F Baltivia']);
    expect(p.inserts).toHaveLength(0);
  });

  it('DP-91: zniknięcie remarku DFDS → ZAPLANOWANY + delayed_* null (przed wypłynięciem)', () => {
    const p = planSailingSync({
      existing: [{
        id: 's1', vessel_id: WAW, route: 'PLD-KPS',
        departure_at: '2026-10-27T21:59:00.000Z', arrival_at: '2026-10-28T07:30:00.000Z',
        delayed_departure_at: '2026-10-27T23:00:00.000Z', delayed_arrival_at: '2026-10-28T08:31:00.000Z',
        status: 'OPOZNIONY', source: 'DFDS',
      }],
      vessels: [{ id: WAW, name: 'M/F Sirena Seaways', mmsi: null }],
      projectId: 'p',
      source: 'DFDS',
      incoming: [{
        route: 'PLD-KPS', vessel: 'M/F Sirena Seaways',
        departureUtc: '2026-10-27T21:59:00.000Z', arrivalUtc: '2026-10-28T07:30:00.000Z',
        status: 'ZAPLANOWANY',
      }],
    });
    expect(p.updates).toHaveLength(1);
    expect(p.updates[0]!.patch).toMatchObject({
      status: 'ZAPLANOWANY',
      delayed_departure_at: null,
      delayed_arrival_at: null,
    });
  });

  it('DP-92: actualDepartureUtc → actual_departure_at + W_REJSIE', () => {
    const p = planSailingSync({
      existing: [{
        id: 's1', vessel_id: WAW, route: 'PLD-KPS',
        departure_at: '2026-10-27T21:59:00.000Z', arrival_at: '2026-10-28T07:30:00.000Z',
        delayed_departure_at: null, delayed_arrival_at: null,
        status: 'ZAPLANOWANY', source: 'DFDS',
      }],
      vessels: [{ id: WAW, name: 'M/F Sirena Seaways', mmsi: null }],
      projectId: 'p',
      source: 'DFDS',
      incoming: [{
        route: 'PLD-KPS', vessel: 'M/F Sirena Seaways',
        departureUtc: '2026-10-27T21:59:00.000Z', arrivalUtc: '2026-10-28T07:30:00.000Z',
        actualDepartureUtc: '2026-10-27T22:05:00.000Z',
      }],
    });
    expect(p.updates).toHaveLength(1);
    expect(p.updates[0]!.patch).toMatchObject({
      actual_departure_at: '2026-10-27T22:05:00.000Z',
      status: 'W_REJSIE',
    });
  });
});

describe('ferry-weather — II-8 FMI+DMI+SMHI', () => {
  const FMI_WAM = fx('fmi-wam-mid-2026-10-02.xml');
  const FMI_GUST = fx('fmi-harmonie-gust-2026-10-02.xml');
  const FMI_NAN = fx('fmi-wam-nan-offgrid.xml');
  const FMI_HORIZON = fx('fmi-wam-horizon-nan.xml');
  const FMI_COASTAL = fx('fmi-wam-coastal-short.xml');
  const DMI = fx('dmi-wam-nsb-2026-10-02.json');
  const SMHI = fx('smhi-ocobs-knolls-latest.json');
  const SNOW1G = fx('smhi-snow1g-gulf-mid.json');
  const WX_NOW = new Date('2026-10-02T04:00:00Z');

  beforeEach(() => {
    clearDmiResponseCache();
  });

  function wxPages(): Record<string, string | number> {
    return {
      // fmiWamUrl/fmiHarmonieUrl trzymają `::` (nie %3A%3A) w storedquery_id
      'forecast::wam': FMI_WAM,
      'forecast::harmonie': FMI_GUST,
      'forecastedr/collections/wam_nsb': DMI,
      'ocobs.smhi.se': SMHI,
    };
  }

  it('zapisuje marine_conditions + atrybucję; bez breach przy spokojnym Bałtyku', async () => {
    const st = new MemStore();
    st.sailings = [{
      id: 's-wx', vessel_id: WAW, route: 'GDN-NYN',
      departure_at: '2026-10-02T16:00:00.000Z', arrival_at: '2026-10-03T10:00:00.000Z',
      delayed_departure_at: null, delayed_arrival_at: null, status: 'ZAPLANOWANY', source: 'POLFERRIES',
    }];
    const r = await runFerryWeather(deps(st, wxPages(), {}, WX_NOW).d);
    expect(r.ok).toBe(true);
    expect(st.marine).not.toBeNull();
    expect(st.marine!.sources).toMatch(/FMI|DMI|SMHI/);
    expect(st.marine!.risk).toBe('niskie');
    expect(st.risks.filter((x) => x.dedup.startsWith('FERRY_WEATHER:'))).toHaveLength(0);
    expect(r.observations?.attribution).toMatch(/CC BY 4\.0/);
  });

  it('fala ≥ WAVE_M w oknie rejsu → ryzyko FERRY_WEATHER', async () => {
    const st = new MemStore();
    st.thr = { waveM: 1.05, gustKn: 40 }; // próg poniżej fixture (~1.1 m)
    st.sailings = [{
      id: 's-storm', vessel_id: WAW, route: 'GDN-NYN',
      departure_at: '2026-10-02T03:00:00.000Z', arrival_at: '2026-10-02T21:00:00.000Z',
      delayed_departure_at: null, delayed_arrival_at: null, status: 'ZAPLANOWANY', source: 'POLFERRIES',
    }];
    const r = await runFerryWeather(deps(st, wxPages(), {}, WX_NOW).d);
    expect(r.ok).toBe(true);
    expect(st.risks.some((x) => x.dedup === 'FERRY_WEATHER:s-storm')).toBe(true);
    expect(st.risks.find((x) => x.dedup === 'FERRY_WEATHER:s-storm')?.titleKey).toBe('rk_ferry_weather');
  });

  it('wszystkie źródła padły → SOURCE_DOWN MARINE_WEATHER', async () => {
    const st = new MemStore();
    const r = await runFerryWeather(deps(st, {
      'opendata.fmi.fi': 503,
      'opendataapi.dmi.dk': 429,
      'ocobs.smhi.se': 500,
      'snow1g': 500,
    }, {}, WX_NOW).d);
    expect(r.ok).toBe(false);
    expect(st.risks[0]?.dedup).toMatch(/^SOURCE_DOWN:MARINE_WEATHER:/);
  });

  it('BN5: trasa bez mapy bez FERRY_WEATHER; SMHI sam nie ratuje SOURCE_DOWN', async () => {
    const st = new MemStore();
    st.thr = { waveM: 0.5, gustKn: 5 };
    st.sailings = [{
      id: 's-unknown', vessel_id: WAW, route: 'HEL-STO',
      departure_at: '2026-10-02T03:00:00.000Z', arrival_at: '2026-10-02T21:00:00.000Z',
      delayed_departure_at: null, delayed_arrival_at: null, status: 'ZAPLANOWANY', source: 'TALLINK',
    }];
    const ok = await runFerryWeather(deps(st, wxPages(), {}, WX_NOW).d);
    expect(ok.ok).toBe(true);
    expect(st.risks.filter((x) => x.dedup.startsWith('FERRY_WEATHER:'))).toHaveLength(0);

    const down = new MemStore();
    const r = await runFerryWeather(deps(down, {
      'opendata.fmi.fi': 503,
      'opendataapi.dmi.dk': 429,
      'ocobs.smhi.se': SMHI,
      'snow1g': SNOW1G,
    }, {}, WX_NOW).d);
    expect(r.ok).toBe(false);
    expect(down.risks[0]?.dedup).toMatch(/^SOURCE_DOWN:MARINE_WEATHER:/);
  });

  it('BN5 cz.2: DMI 429 przy FMI OK → bez SOURCE_DOWN', async () => {
    const st = new MemStore();
    const r = await runFerryWeather(deps(st, {
      'forecast::wam': FMI_WAM,
      'forecast::harmonie': FMI_GUST,
      'forecastedr/collections/wam_nsb': 429,
      'ocobs.smhi.se': SMHI,
    }, {}, WX_NOW).d);
    expect(r.ok).toBe(true);
    expect(st.risks.filter((x) => x.dedup.startsWith('SOURCE_DOWN:MARINE_WEATHER:'))).toHaveLength(0);
    expect(r.warnings?.some((w) => /DMI .*HTTP 429/.test(w))).toBe(true);
  });

  it('BN5 cz.2: Harmonie padł → snow1g zapas wiatru; WAM cały NaN → ostrzeżenie poza siatką', async () => {
    const st = new MemStore();
    const { d, calls } = deps(st, {
      'forecast::wam': FMI_NAN,
      'forecast::harmonie': 503,
      'forecastedr/collections/wam_nsb': DMI,
      'ocobs.smhi.se': SMHI,
      'snow1g': SNOW1G,
    }, {}, WX_NOW);
    const r = await runFerryWeather(d);
    expect(r.ok).toBe(true);
    expect(calls.some((u) => u.includes('/category/snow1g/'))).toBe(true);
    expect(calls.every((u) => !u.includes('pmp3g'))).toBe(true);
    expect(st.marineWarnings.some((w) => /NaN poza siatką/.test(w))).toBe(true);
    expect(st.marine!.sources).toMatch(/SMHI|DMI/);
  });

  it('DP-149: NaN na końcu horyzontu → bez „poza siatką”; DP-150: ≤5 zapytań DMI', async () => {
    const st = new MemStore();
    const { d, calls } = deps(st, {
      'forecast::wam': FMI_HORIZON,
      'forecast::harmonie': FMI_GUST,
      'forecastedr/collections/wam_nsb': DMI,
      'ocobs.smhi.se': SMHI,
    }, {}, WX_NOW);
    const r = await runFerryWeather(d);
    expect(r.ok).toBe(true);
    expect(r.warnings?.some((w) => /NaN poza siatką/.test(w))).toBe(false);
    const dmiCalls = calls.filter((u) => u.includes('forecastedr/collections/wam_nsb'));
    expect(dmiCalls.length).toBeGreaterThan(0);
    expect(dmiCalls.length).toBeLessThanOrEqual(5);
  });

  it('DP-152: przybrzeżny krótki horyzont nie skraca endtime DMI (maksimum po punktach)', async () => {
    const st = new MemStore();
    const { d, calls } = deps(st, {
      'forecast::harmonie': FMI_GUST,
      'forecastedr/collections/wam_nsb': DMI,
      'ocobs.smhi.se': SMHI,
    }, {}, WX_NOW);
    const inner = d.fetch!;
    d.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('forecast::wam') && url.includes('54.4')) {
        return new Response(FMI_COASTAL, { status: 200 });
      }
      if (url.includes('forecast::wam')) {
        return new Response(FMI_WAM, { status: 200 });
      }
      return inner(input, init);
    }) as typeof fetch;
    const r = await runFerryWeather(d);
    expect(r.ok).toBe(true);
    const dmiCalls = calls.filter((u) => u.includes('forecastedr/collections/wam_nsb'));
    expect(dmiCalls.length).toBeGreaterThan(0);
    /* Coastal lastValid = 05:00; MID = 12:00. Min skracałby do 05:00; max zostawia ≥12:00. */
    expect(dmiCalls.every((u) => u.includes('2026-10-02T12%3A00%3A00Z') || u.includes('2026-10-02T12:00:00Z'))).toBe(true);
    expect(dmiCalls.some((u) => /2026-10-02T05(%3A|:)00/.test(u) && !/2026-10-02T12/.test(u))).toBe(false);
  });

  it('BN5 cz.3: EEPLA ograniczenie → FERRY_ICE na PLD-KPS; GDN-NYN bez; gzip + Digitraffic-User', async () => {
    const iceFc = JSON.stringify({
      type: 'FeatureCollection',
      lastUpdated: '2026-10-02T03:00:00Z',
      features: [{
        type: 'Feature',
        properties: {
          name: 'PALDISKI',
          locodeList: 'EEPLA',
          restrictions: [{
            startTime: '2026-10-01T00:00:00Z',
            endTime: '2026-10-20T00:00:00Z',
            textCompilation: 'II 2000',
          }],
        },
      }],
    });
    const st = new MemStore();
    st.sailings = [
      {
        id: 's-pld', vessel_id: WAW, route: 'PLD-KPS',
        departure_at: '2026-10-02T12:00:00.000Z', arrival_at: '2026-10-02T20:00:00.000Z',
        delayed_departure_at: null, delayed_arrival_at: null, status: 'ZAPLANOWANY', source: 'DFDS',
      },
      {
        id: 's-gdn', vessel_id: WAW, route: 'GDN-NYN',
        departure_at: '2026-10-02T16:00:00.000Z', arrival_at: '2026-10-03T10:00:00.000Z',
        delayed_departure_at: null, delayed_arrival_at: null, status: 'ZAPLANOWANY', source: 'POLFERRIES',
      },
    ];
    const { d, headerCalls } = deps(st, {
      ...wxPages(),
      'winter-navigation': iceFc,
    }, {}, WX_NOW);
    const r = await runFerryWeather(d);
    expect(r.ok).toBe(true);
    const ice = st.risks.filter((x) => x.dedup.startsWith('FERRY_ICE:'));
    expect(ice).toHaveLength(1);
    expect(ice[0]!.dedup).toBe('FERRY_ICE:s-pld:EEPLA:RESTRICTION');
    expect(ice[0]!.severity).toBe('MEDIUM');
    expect(ice[0]!.titleKey).toBe('rk_ferry_ice');
    expect(ice[0]!.title).toMatch(/sprawdź klasę lodową/);
    /* DP-120: IBNet „II 2000” po polsku. */
    expect(ice[0]!.title).toMatch(/klasa lodowa II, min\. 2000 DWT/);
    expect(st.risks.some((x) => x.dedup.includes('s-gdn') && x.dedup.startsWith('FERRY_ICE:'))).toBe(false);
    expect(r.observations?.attribution).toMatch(/Fintraffic/);
    const winterHdr = headerCalls.find((c) => c.url.includes('winter-navigation'));
    expect(winterHdr?.headers['Accept-Encoding']).toBe('gzip');
    expect(winterHdr?.headers['Digitraffic-User']).toBeTruthy();
  });

  it('DP-145: ferryRouteFamilies — HEL-STO ze słownika dostaje FERRY_WEATHER; bez mapy nie', async () => {
    const pages = wxPages();
    const sailing = {
      id: 's-hel-sto', vessel_id: WAW, route: 'HEL-STO' as never,
      departure_at: '2026-10-02T12:00:00.000Z', arrival_at: '2026-10-02T20:00:00.000Z',
      delayed_departure_at: null, delayed_arrival_at: null, status: 'ZAPLANOWANY' as const, source: 'TALLINK',
    };
    const bare = new MemStore();
    bare.thr = { waveM: 1.05, gustKn: 40 };
    bare.sailings = [sailing];
    bare.ferryFamilies = {}; // puste = tylko zapas kodu; HEL-STO poza mapą
    const r0 = await runFerryWeather(deps(bare, pages, {}, WX_NOW).d);
    expect(r0.ok).toBe(true);
    expect(bare.risks.filter((x) => x.dedup.startsWith('FERRY_WEATHER:'))).toHaveLength(0);

    const mapped = new MemStore();
    mapped.thr = { waveM: 1.05, gustKn: 40 };
    mapped.sailings = [sailing];
    mapped.ferryFamilies = { 'HEL-STO': 'TLL-STO' };
    const r1 = await runFerryWeather(deps(mapped, pages, {}, WX_NOW).d);
    expect(r1.ok).toBe(true);
    expect(mapped.risks.some((x) => x.dedup === 'FERRY_WEATHER:s-hel-sto')).toBe(true);
  });

  it('DP-147/148: awaria ferryRouteFamilies → job OK, zapas w kodzie, ostrzeżenie', async () => {
    const pages = wxPages();
    const st = new MemStore();
    st.thr = { waveM: 1.05, gustKn: 40 };
    st.sailings = [{
      id: 's-gdn-fb', vessel_id: WAW, route: 'GDN-NYN',
      departure_at: '2026-10-02T12:00:00.000Z', arrival_at: '2026-10-02T20:00:00.000Z',
      delayed_departure_at: null, delayed_arrival_at: null, status: 'ZAPLANOWANY', source: 'POLFERRIES',
    }];
    st.ferryRouteFamilies = async () => {
      throw new Error('ferry_routes families: simulated down');
    };
    const r = await runFerryWeather(deps(st, pages, {}, WX_NOW).d);
    expect(r.ok).toBe(true);
    expect(r.warnings?.some((w) => /ferry_routes|mapy w kodzie/i.test(w))).toBe(true);
    expect(st.risks.some((x) => x.dedup === 'FERRY_WEATHER:s-gdn-fb')).toBe(true);
  });

  it('BN5 cz.3: zawieszenie FIHEL → FERRY_ICE HIGH na TLL-HEL; pusto = bez ryzyka', async () => {
    const susp = JSON.stringify({
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        properties: {
          name: 'HELSINKI',
          locodeList: 'FIHEL',
          suspensions: [{
            startTime: '2026-10-01T00:00:00Z',
            endTime: '2026-10-10T00:00:00Z',
            textCompilation: 'closed for traffic',
          }],
        },
      }],
    });
    const st = new MemStore();
    st.sailings = [{
      id: 's-tll', vessel_id: WAW, route: 'TLL-HEL',
      departure_at: '2026-10-02T10:00:00.000Z', arrival_at: '2026-10-02T12:00:00.000Z',
      delayed_departure_at: null, delayed_arrival_at: null, status: 'ZAPLANOWANY', source: 'TALLINK',
    }];
    const r = await runFerryWeather(deps(st, { ...wxPages(), 'winter-navigation': susp }, {}, WX_NOW).d);
    expect(r.ok).toBe(true);
    const ice = st.risks.filter((x) => x.dedup.startsWith('FERRY_ICE:'));
    expect(ice).toHaveLength(1);
    expect(ice[0]!.severity).toBe('HIGH');
    expect(ice[0]!.dedup).toBe('FERRY_ICE:s-tll:FIHEL:SUSPENSION');

    const empty = new MemStore();
    empty.sailings = st.sailings;
    const r2 = await runFerryWeather(deps(empty, {
      ...wxPages(),
      'winter-navigation': JSON.stringify({ type: 'FeatureCollection', features: [] }),
    }, {}, WX_NOW).d);
    expect(r2.ok).toBe(true);
    expect(empty.risks.filter((x) => x.dedup.startsWith('FERRY_ICE:'))).toHaveLength(0);
    expect(r2.observations?.attribution).toMatch(/Fintraffic/);
  });

  it('F7 #722 B1: ograniczenie FIHEL → FERRY_ICE na MUU-VUO (Vuosaari=FIHEL)', async () => {
    const restr = JSON.stringify({
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        properties: {
          name: 'HELSINKI',
          locodeList: 'FIHEL',
          restrictions: [{
            startTime: '2026-10-01T00:00:00Z',
            endTime: '2026-10-20T00:00:00Z',
            textCompilation: 'I 2000',
          }],
        },
      }],
    });
    const st = new MemStore();
    st.sailings = [{
      id: 's-muu', vessel_id: WAW, route: 'MUU-VUO',
      departure_at: '2026-10-02T10:00:00.000Z', arrival_at: '2026-10-02T12:00:00.000Z',
      delayed_departure_at: null, delayed_arrival_at: null, status: 'ZAPLANOWANY', source: 'ECKERO',
    }];
    const r = await runFerryWeather(deps(st, { ...wxPages(), 'winter-navigation': restr }, {}, WX_NOW).d);
    expect(r.ok).toBe(true);
    const ice = st.risks.filter((x) => x.dedup.startsWith('FERRY_ICE:'));
    expect(ice).toHaveLength(1);
    expect(ice[0]!.dedup).toBe('FERRY_ICE:s-muu:FIHEL:RESTRICTION');
    expect(ice[0]!.severity).toBe('MEDIUM');
    expect(ice[0]!.title).toMatch(/klasa lodowa IC lub wyższa, min\. 2000 DWT/);
  });

  it('DP-120 / F7 #777: IAS spełnia I 2000; Wawel bez klasy; nocny rejs — dzień przypłynięcia; zawieszenie mimo klasy', async () => {
    const MEGA = 'v-mega';
    const restr = JSON.stringify({
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        properties: {
          name: 'HELSINKI',
          locodeList: 'FIHEL',
          restrictions: [{
            startTime: '2026-10-01T00:00:00Z',
            endTime: '2026-10-20T00:00:00Z',
            textCompilation: 'I 2000',
          }],
        },
      }],
    });
    class StoreIce extends MemStore {
      override async vessels() {
        return [
          /* F7 #777: Wawel bez publicznej klasy → NULL; IAS tylko gdzie Portnet IAS. */
          { id: WAW, name: 'M/F Wawel', mmsi: null, ice_class: null },
          { id: NS, name: 'M/F Nova Star', mmsi: 311000787, ice_class: null },
          { id: MEGA, name: 'M/F Viking XPRS', mmsi: 230705000, ice_class: '1A Super' },
        ];
      }
    }
    const okClass = new StoreIce();
    okClass.sailings = [{
      id: 's-muu', vessel_id: MEGA, route: 'MUU-VUO',
      departure_at: '2026-10-02T10:00:00.000Z', arrival_at: '2026-10-02T12:00:00.000Z',
      delayed_departure_at: null, delayed_arrival_at: null, status: 'ZAPLANOWANY', source: 'ECKERO',
    }];
    const r1 = await runFerryWeather(deps(okClass, { ...wxPages(), 'winter-navigation': restr }, {}, WX_NOW).d);
    expect(r1.ok).toBe(true);
    expect(okClass.risks.filter((x) => x.dedup.startsWith('FERRY_ICE:'))).toHaveLength(0);

    /* Okno kończy się 1.10 — rejs 2.10: brak przecięcia dnia. */
    const ended = JSON.stringify({
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        properties: {
          name: 'HELSINKI',
          locodeList: 'FIHEL',
          restrictions: [{
            startTime: '2026-09-01T00:00:00Z',
            endTime: '2026-10-01T00:00:00Z',
            textCompilation: 'I 2000',
          }],
        },
      }],
    });
    const st2 = new StoreIce();
    st2.sailings = okClass.sailings;
    const r2 = await runFerryWeather(deps(st2, { ...wxPages(), 'winter-navigation': ended }, {}, WX_NOW).d);
    expect(r2.ok).toBe(true);
    expect(st2.risks.filter((x) => x.dedup.startsWith('FERRY_ICE:'))).toHaveLength(0);

    /* Nocny GDN→NYN: zawieszenie SENYN w dniu przypłynięcia (nie odejścia). */
    const nightSusp = JSON.stringify({
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        properties: {
          name: 'NYNASHAMN',
          locodeList: 'SENYN',
          suspensions: [{
            startTime: '2026-10-03T05:00:00Z',
            endTime: '2026-10-03T16:00:00Z',
            textCompilation: 'closed',
          }],
          restrictions: [],
        },
      }],
    });
    const night = new StoreIce();
    night.sailings = [{
      id: 's-gdn-night', vessel_id: MEGA, route: 'GDN-NYN',
      departure_at: '2026-10-02T16:00:00.000Z', arrival_at: '2026-10-03T10:00:00.000Z',
      delayed_departure_at: null, delayed_arrival_at: null, status: 'ZAPLANOWANY', source: 'POLFERRIES',
    }];
    const r3 = await runFerryWeather(deps(night, { ...wxPages(), 'winter-navigation': nightSusp }, {}, WX_NOW).d);
    expect(r3.ok).toBe(true);
    const nightIce = night.risks.filter((x) => x.dedup.startsWith('FERRY_ICE:'));
    expect(nightIce).toHaveLength(1);
    expect(nightIce[0]!.dedup).toBe('FERRY_ICE:s-gdn-night:SENYN:SUSPENSION');
    expect(nightIce[0]!.severity).toBe('HIGH');
    /* Zawieszenie przy klasie spełniającej ograniczenie — nadal HIGH. */
    expect(nightIce[0]!.title).toMatch(/Viking XPRS/);
  });

  it('BN5 pkt 4: fala 4 m na GULF_FI → FERRY_WEATHER TLL-HEL/MUU-VUO, nie GDN-NYN', async () => {
    // #714 §6: breach tylko na rejsach korytarza GULF_FI (nie GDN-NYN).
    const FMI_WAM_HIGH = FMI_WAM.replace(
      /<wml2:value>1\.\d+<\/wml2:value>/g,
      '<wml2:value>4.0</wml2:value>',
    );
    const st = new MemStore();
    st.thr = { waveM: 3.8, gustKn: 40 };
    st.sailings = [
      {
        id: 's-tll', vessel_id: WAW, route: 'TLL-HEL',
        departure_at: '2026-10-02T10:00:00.000Z', arrival_at: '2026-10-02T12:00:00.000Z',
        delayed_departure_at: null, delayed_arrival_at: null, status: 'ZAPLANOWANY', source: 'TALLINK',
      },
      {
        id: 's-muu', vessel_id: WAW, route: 'MUU-VUO',
        departure_at: '2026-10-02T10:30:00.000Z', arrival_at: '2026-10-02T13:00:00.000Z',
        delayed_departure_at: null, delayed_arrival_at: null, status: 'ZAPLANOWANY', source: 'ECKERO',
      },
      {
        id: 's-gdn', vessel_id: WAW, route: 'GDN-NYN',
        departure_at: '2026-10-02T10:00:00.000Z', arrival_at: '2026-10-03T04:00:00.000Z',
        delayed_departure_at: null, delayed_arrival_at: null, status: 'ZAPLANOWANY', source: 'POLFERRIES',
      },
    ];
    const { d } = deps(st, wxPages(), {}, WX_NOW);
    const inner = d.fetch!;
    d.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      // GULF_MID 59.80,24.85 — tylko WAM z wysoką falą; reszta punktów spokojna.
      if (url.includes('forecast::wam') && url.includes('latlon=59.8')) {
        return new Response(FMI_WAM_HIGH, { status: 200 });
      }
      return inner(input, init);
    }) as typeof fetch;
    const r = await runFerryWeather(d);
    expect(r.ok).toBe(true);
    const wx = st.risks.filter((x) => x.dedup.startsWith('FERRY_WEATHER:'));
    expect(wx.map((x) => x.dedup).sort()).toEqual(['FERRY_WEATHER:s-muu', 'FERRY_WEATHER:s-tll']);
    expect(st.risks.some((x) => x.dedup === 'FERRY_WEATHER:s-gdn')).toBe(false);
  });
});


describe('AIS-SRC — trzy źródła, bez filtra Q-18', () => {
  const SPIRIT = 'v-spirit';
  const stenaBody = JSON.stringify({
    errors: [],
    data: [{
      geometry: { type: 'Point', coordinates: [55.1, 18.12] },
      properties: {
        imo: 7907661, mmsi: 219031605, vessel_name: 'STENA SPIRIT',
        latitude: 55.09783936, longitude: 18.12014198,
        dt_pos_utc: '2026-10-04 23:29:58', eta: '2026-10-05T06:00:00Z', sog: 15.9, cog: 200, nav_status_code: 0,
      },
    }],
  });
  class AisStore extends MemStore {
    override async vessels() {
      return [
        { id: NS, name: 'M/F Nova Star', mmsi: 311000787, imo: 9462067 },
        { id: SPIRIT, name: 'M/F Stena Spirit', mmsi: 219031605, imo: 7907661 },
      ];
    }
  }
  it('dwie pozycje: zapisana nowsza, ze źródłem; ETA Steny zostaje przy pozycji', async () => {
    const st = new AisStore();
    const olderAis = [{
      mmsi: 219031605, lat: 54.5, lon: 18.5, sogKn: 10, cog: 1, navStat: 0,
      timestampUtc: '2026-10-04T23:00:00.000Z', source: 'AISSTREAM' as const,
    }];
    const { d } = deps(st, { 'irm.stenalinefreight.com': stenaBody, 'digitraffic.fi': '{"type":"FeatureCollection","features":[]}' }, { AISSTREAM_API_KEY: 'test-key-not-real' }, new Date('2026-10-04T23:35:00Z'));
    d.collectAisstream = async () => olderAis;
    await runFerryAis(d);
    const spirit = st.vesselPositions.filter((p) => p.vesselId === SPIRIT);
    // #421: zapisujemy każde źródło (STENA + starszy AISSTREAM), nie tylko zwycięzcę.
    expect(spirit).toHaveLength(2);
    const stena = spirit.find((p) => p.source === 'STENA')!;
    expect(stena).toMatchObject({ lat: 55.09783936, lon: 18.12014198, source: 'STENA', etaAt: '2026-10-05T06:00:00.000Z' });
    expect(stena.lat).not.toBe(55.1);
    expect(spirit.some((p) => p.source === 'AISSTREAM' && p.lat === 54.5)).toBe(true);
  });
  it('awaria aisstream → pozycja z Digitraffic, bez wyjątku', async () => {
    const st = new AisStore();
    const { d } = deps(st, { 'irm.stenalinefreight.com': 503, 'digitraffic.fi': AIS }, { AISSTREAM_API_KEY: 'test-key-not-real' }, new Date('2026-09-24T19:40:00Z'));
    d.collectAisstream = async () => { throw new Error('socket down'); };
    const r = await runFerryAis(d);
    expect(r.ok).toBe(true);
    expect(st.vesselPositions.some((p) => p.vesselId === NS && p.source === 'DIGITRAFFIC')).toBe(true);
    expect(st.risks.some((x) => x.dedup.startsWith('SOURCE_DOWN:STENA_IRM:'))).toBe(true);
  });
  it('zły format Steny → ryzyko i zapas Digitraffic', async () => {
    const st = new AisStore();
    const { d } = deps(st, { 'irm.stenalinefreight.com': '{"foo":1}', 'digitraffic.fi': AIS }, {}, new Date('2026-09-24T19:40:00Z'));
    const r = await runFerryAis(d);
    expect(r.ok).toBe(true);
    expect(st.vesselPositions.some((p) => p.vesselId === NS)).toBe(true);
    expect(st.risks.some((x) => String(x.detail.zrodlo) === 'STENA_IRM')).toBe(true);
  });
  it('rejs do Polski nie gubi pozycji (Q-18 nie jest zbudowane, ETA ma pełne dane)', async () => {
    const st = new AisStore();
    st.sailings.push({
      id: 'back', vessel_id: NS, route: 'NYN-GDN',
      departure_at: '2026-09-24T16:00:00.000Z', arrival_at: '2026-09-25T10:00:00.000Z',
      delayed_departure_at: null, delayed_arrival_at: null, actual_departure_at: null, actual_arrival_at: null,
      status: 'ZAPLANOWANY', source: 'POLFERRIES',
    });
    const { d } = deps(st, { 'irm.stenalinefreight.com': 503, 'digitraffic.fi': AIS }, {}, new Date('2026-09-24T19:40:00Z'));
    await runFerryAis(d);
    expect(st.vesselPositions.some((p) => p.vesselId === NS)).toBe(true);
    expect(st.vesselPositions.find((p) => p.vesselId === NS)?.lat).toBeCloseTo(57.980348, 4);
  });
});

describe('FERRY-STATUS — Freight główne, AEM zapas', () => {
  const FREIGHT_HTML = `<h3>Gdynia – Karlskrona</h3><span class="date">2026-10-05</span><div class="Rtable-cell">18:00</div><div class="Rtable-cell">06:00</div><div class="Rtable-cell">Stena Ebba</div><div class="Rtable-cell">Cancelled</div><h3>Karlskrona – Gdynia</h3><span class="date">2026-10-05</span><div class="Rtable-cell">09:00</div><div class="Rtable-cell">19:00</div><div class="Rtable-cell">Stena Spirit</div><div class="Rtable-cell">Arrived</div>`;
  class FreightStore extends MemStore {
    override async vessels() {
      return [
        { id: WAW, name: 'M/F Wawel', mmsi: null },
        { id: 'v-ebba', name: 'M/F Stena Ebba', mmsi: 219031310 },
        { id: 'v-spirit', name: 'M/F Stena Spirit', mmsi: 219031605 },
      ];
    }
  }
  it('odwołany rejs z Freight zapisuje się jako ODWOLANY i nie woła zapasu', async () => {
    const { resetStenaFreightCache } = await import('../supabase/functions/_shared/integrations/jobs');
    resetStenaFreightCache();
    const st = new FreightStore();
    const { d, calls } = deps(st, {
      'admin-ajax.php': JSON.stringify({ success: true, data: { content: FREIGHT_HTML } }),
      'timetable/GDKA': '<script>var ajax_object = {"security":"tok123"};</script>',
      'komunikaty-kursowania': 503,
    }, {}, new Date('2026-10-05T12:00:00Z'));
    const r = await runFerryStatus(d);
    expect(r.ok).toBe(true);
    // Zapas statusu (AEM) nie jest wołany gdy Freight OK; #421 może wołać timetable przy odświeżeniu rozkładu.
    expect(st.sailings.find((s) => s.vessel_id === 'v-ebba')).toMatchObject({ status: 'ODWOLANY', source: 'STENA', route: 'GDY-KAA' });
    expect(st.risks.some((x) => String(x.dedup).startsWith('SOURCE_DOWN:STENA_STATUS:'))).toBe(false);
    expect(calls.some((c) => c.includes('admin-ajax.php'))).toBe(true);
  });
  it('błąd Freight → ryzyko i przejście na JSON AEM, bez wyjątku', async () => {
    const { resetStenaFreightCache } = await import('../supabase/functions/_shared/integrations/jobs');
    resetStenaFreightCache();
    const st = new FreightStore();
    const GDKA = fx('stena-timetable-gdka-2026-10-01.json');
    const pages: Record<string, string | number> = {
      'komunikaty-kursowania': 503,
      'stenalinefreight.com': 503,
      'timetable.GDKA.2026-09-26': GDKA,
      'timetable.KAGD.2026-09-26': '[]',
      'timetable.GDKA.2026-09-27': '[]',
      'timetable.KAGD.2026-09-27': '[]',
    };
    const r = await runFerryStatus(deps(st, pages, {}, new Date('2026-09-26T12:00:00Z')).d);
    expect(r.ok).toBe(true);
    expect(st.risks.some((x) => String(x.dedup).startsWith('SOURCE_DOWN:STENA_STATUS:'))).toBe(true);
    expect(st.sailings.some((s) => s.source === 'STENA' && s.route === 'GDY-KAA')).toBe(true);
    expect(r.warnings?.some((w) => /zapas/i.test(w))).toBe(true);
  });
});
