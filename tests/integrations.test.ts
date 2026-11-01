/**
 * M12 — zadania integracji danych zewnętrznych: test każdej funkcji na zapisanych danych, bez sieci.
 * Polferries: prawdziwe strony z 26.09.2026 (rozkład cargo i komunikaty); Digitraffic: prawdziwa odpowiedź z 25.09.2026.
 * Trafikverket / DATEX II: przykłady w formacie z dokumentacji dostawców (brak kluczy) — tests/fixtures/*sample*.
 * TomTom Flow: usunięty (CLEAN-TT-HERE / D-28).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  runFerryAis, runFerrySchedule, runFerryStatus, runFerryWeather, runJob, runRoadPl, runRoadSe, runTrafficFlow,
  type JobDeps, type JobResult, type SyncStore, type VehiclePos,
} from '../supabase/functions/_shared/integrations/jobs';
import type { DbSailing, RiskInput, SailingInsert, SailingPatch } from '../supabase/functions/_shared/integrations/sync';
import { planSailingSync } from '../supabase/functions/_shared/integrations/sync';
import { distanceToCorridorKm, CORRIDOR_SE, parseTrafikverketSituations, trafikverketResultError, trafikverketSituationQuery } from '../supabase/functions/_shared/integrations/road';

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
  thr = { waveM: 3.8, gustKn: 40 };
  n = 0;
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
  async lastRun(job: string) { return this.runs.filter((r) => r.job === job).at(-1)?.at ?? null; }
  async recordRun(job: string, ok: boolean, result: JobResult) { this.runs.push({ job, at: NOW.toISOString(), ok, result }); }
  vesselPositions: { vesselId: string; lat: number; lon: number; observedAt: string; source?: string; etaAt?: string | null }[] = [];
  async saveVesselPosition(vesselId: string, fix: { lat: number; lon: number; timestampUtc: string; source?: string; etaAt?: string | null }) {
    if (this.vesselPositions.some((p) => p.vesselId === vesselId && p.observedAt === fix.timestampUtc)) return;
    this.vesselPositions.push({ vesselId, lat: fix.lat, lon: fix.lon, observedAt: fix.timestampUtc, source: fix.source, etaAt: fix.etaAt ?? null });
  }
  async lastPortPosition(vesselId: string, hub: { lat: number; lon: number }, radiusKm: number) {
    const { distanceKm } = await import('../supabase/functions/_shared/ferry/digitraffic');
    const hit = this.vesselPositions
      .filter((p) => p.vesselId === vesselId && distanceKm(p.lat, p.lon, hub.lat, hub.lon) <= radiusKm)
      .sort((a, b) => b.observedAt.localeCompare(a.observedAt))[0];
    return hit?.observedAt ?? null;
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
  async saveCorridorCondition(row: { corridor: 'SE_E4' | 'SE_E22'; slowdownMult: number; reason: string | null; detail?: unknown }) {
    this.corridors.push({ corridor: row.corridor, slowdownMult: row.slowdownMult, detail: row.detail });
    if (row.corridor === 'SE_E4') this.corridor = { corridor: row.corridor, slowdownMult: row.slowdownMult, reason: row.reason, detail: row.detail };
  }
  async opsThresholds() { return this.thr; }
  async saveMarineCondition(row: {
    corridor: 'BALTIC_GDN_NYN' | 'BALTIC_GDY_KAA'; maxWaveM: number | null; maxGustKn: number | null;
    risk: 'niskie' | 'podwyższone' | 'wysokie'; sources: string;
  }) {
    this.marine = { maxWaveM: row.maxWaveM, maxGustKn: row.maxGustKn, risk: row.risk, sources: row.sources };
  }
  hereNotes: { service: string; n: number }[] = [];
  async noteHereUsage(service: 'tiles' | 'routing' | 'matching' | 'attributes' | 'traffic', n: number) {
    this.hereNotes.push({ service, n });
  }
  async hereMonthSpend() { return 0; }
}

function deps(store: MemStore, pages: Record<string, string | number>, env: Record<string, string> = {}, now = NOW) {
  const calls: string[] = [];
  const f = (async (input: RequestInfo | URL) => {
    const url = String(input); calls.push(url);
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
    throw new Error(`nieoczekiwane zapytanie (sieć zabroniona w teście): ${url}`);
  }) as typeof fetch;
  const d: JobDeps = { store, fetch: f, env, now: () => now };
  return { d, calls };
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
  it('runJob: nie częściej niż co 15 min (dziennik przebiegów)', async () => {
    const st = new MemStore();
    await runJob('ferry-status', deps(st, { 'komunikaty-kursowania': STATUS }).d);
    const early = await runJob('ferry-status', deps(st, { 'komunikaty-kursowania': STATUS }, {}, new Date(NOW.getTime() + 5 * 60000)).d);
    expect(early.skipped).toBe(true);
    const later = await runJob('ferry-status', deps(st, { 'komunikaty-kursowania': STATUS }, {}, new Date(NOW.getTime() + 15 * 60000)).d);
    expect(later.skipped).toBeUndefined();
    // #421: po zmianie statusu odświeżany jest też ferry-schedule (zapis przed recordRun statusu).
    expect(st.runs.map((r) => r.job)).toEqual(['ferry-schedule', 'ferry-status', 'ferry-status']);
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
    // F7: mid-sea bez historii w porcie i poza pasmem 3–10 km → nie zmyślamy godziny wypłynięcia.
    expect(r.observations?.['M/F Nova Star:DEP']).toBeUndefined();
    expect(st.sailings.find((s) => s.vessel_id === NS)?.actual_departure_at).toBeNull();
    expect(st.risks).toHaveLength(0);
    expect(st.runs.some((x) => x.job === 'ferry-departures' && x.ok)).toBe(true);
  });
  it('świeża pozycja 5 km od GDN + ruch → actual_departure_at; stara (>15 min) → bez', async () => {
    const st = new MemStore();
    st.sailings.push(sail(NS, '2026-09-24T16:00:00.000Z', '2026-09-25T10:00:00.000Z'));
    // GDN 54.40372, 18.68130 → ~5 km NNE
    const near = AIS.replace('17.850695, 57.980348', '18.70, 54.45').replace('"sog" : 17.1', '"sog" : 8');
    await runFerryAis(deps(st, { 'digitraffic.fi': near }, {}, new Date('2026-09-24T19:40:00Z')).d);
    expect(st.sailings.find((s) => s.vessel_id === NS)?.actual_departure_at).toBeTruthy();
    expect(st.sailings.find((s) => s.vessel_id === NS)?.status).toBe('W_REJSIE'); // #446
    const st2 = new MemStore();
    st2.sailings.push(sail(NS, '2026-09-24T16:00:00.000Z', '2026-09-25T10:00:00.000Z'));
    await runFerryAis(deps(st2, { 'digitraffic.fi': near }, {}, new Date('2026-09-24T20:00:00Z')).d);
    expect(st2.sailings.find((s) => s.vessel_id === NS)?.actual_departure_at ?? null).toBeNull();
  });
  it('KAA-GDY w Karlskronie (port odejścia) → bez fałszywego dopłynięcia; NYN-GDN w Gdańsku → actual_arrival', async () => {
    const st = new MemStore();
    st.sailings.push(sail(NS, '2026-09-24T16:00:00.000Z', '2026-09-25T10:00:00.000Z', 'KAA-GDY'));
    const inKaa = AIS.replace('17.850695, 57.980348', '15.63080, 56.16460').replace('"sog" : 17.1', '"sog" : 0.2');
    const rKaa = await runFerryAis(deps(st, { 'digitraffic.fi': inKaa }, {}, new Date('2026-09-24T19:40:00Z')).d);
    expect(st.sailings.find((s) => s.route === 'KAA-GDY')?.actual_arrival_at ?? null).toBeNull();
    expect(rKaa.observations?.['M/F Nova Star']).toBe('W_PORCIE_KARLSKRONA');
    const st2 = new MemStore();
    st2.sailings.push(sail(NS, '2026-09-24T16:00:00.000Z', '2026-09-25T10:00:00.000Z', 'NYN-GDN'));
    const inGdn = AIS.replace('17.850695, 57.980348', '18.68130, 54.40372').replace('"sog" : 17.1', '"sog" : 0.2');
    await runFerryAis(deps(st2, { 'digitraffic.fi': inGdn }, {}, new Date('2026-09-24T19:40:00Z')).d);
    expect(st2.sailings.find((s) => s.route === 'NYN-GDN')?.actual_arrival_at).toBeTruthy();
    expect(st2.sailings.find((s) => s.route === 'NYN-GDN')?.status).toBe('DOPLYNAL'); // #446
    expect(st2.runs.some((x) => x.job === 'ferry-departures')).toBe(true);
  });
  it('F7 r2: lastPortPosition sprzed dni → bez actual_departure; dopiero w oknie [plan−2h, teraz]', async () => {
    const st = new MemStore();
    // Plan 22.10 08:00; świeża >10 km od GDY + stara w porcie 19.10 → nie bierzemy 19.10 (brak fallbacku fix).
    st.sailings.push(sail(NS, '2026-10-22T08:00:00.000Z', '2026-10-22T20:00:00.000Z', 'GDY-KAA'));
    st.vesselPositions.push({ vesselId: NS, lat: 54.53321, lon: 18.54425, observedAt: '2026-10-19T06:00:00.000Z' });
    const far = AIS.replace('17.850695, 57.980348', '18.80, 54.70').replace('"sog" : 17.1', '"sog" : 8')
      .replace('1790278580817', String(Date.parse('2026-10-22T08:10:00.000Z')));
    await runFerryAis(deps(st, { 'digitraffic.fi': far }, {}, new Date('2026-10-22T08:12:00Z')).d);
    expect(st.sailings.find((s) => s.vessel_id === NS)?.actual_departure_at ?? null).toBeNull();
    // Świeża pozycja w porcie w oknie planu + ruch >3 km → OK.
    const st2 = new MemStore();
    st2.sailings.push(sail(NS, '2026-10-22T08:00:00.000Z', '2026-10-22T20:00:00.000Z', 'GDY-KAA'));
    st2.vesselPositions.push({ vesselId: NS, lat: 54.53321, lon: 18.54425, observedAt: '2026-10-22T07:55:00.000Z' });
    await runFerryAis(deps(st2, { 'digitraffic.fi': far }, {}, new Date('2026-10-22T08:12:00Z')).d);
    expect(st2.sailings.find((s) => s.vessel_id === NS)?.actual_departure_at).toBe('2026-10-22T07:55:00.000Z');
  });
  it('#446: odrzucony lastPortPosition + bieżąca 3–10 km → actual_departure z fix', async () => {
    const st = new MemStore();
    st.sailings.push(sail(NS, '2026-10-22T08:00:00.000Z', '2026-10-22T20:00:00.000Z', 'GDY-KAA'));
    // Stara w porcie (odrzucona oknem) + świeża ~5 km od GDY (pasmo zapasu).
    st.vesselPositions.push({ vesselId: NS, lat: 54.53321, lon: 18.54425, observedAt: '2026-10-19T06:00:00.000Z' });
    const mid = AIS.replace('17.850695, 57.980348', '18.62, 54.55').replace('"sog" : 17.1', '"sog" : 8')
      .replace('1790278580817', String(Date.parse('2026-10-22T08:10:00.000Z')));
    await runFerryAis(deps(st, { 'digitraffic.fi': mid }, {}, new Date('2026-10-22T08:12:00Z')).d);
    expect(st.sailings.find((s) => s.vessel_id === NS)?.actual_departure_at).toBe('2026-10-22T08:10:00.000Z');
    expect(st.sailings.find((s) => s.vessel_id === NS)?.status).toBe('W_REJSIE');
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
    // Świeże dopłynięcie po wypłynięciu → OK.
    const st2 = new MemStore();
    const s2 = sail(NS, '2026-09-24T08:00:00.000Z', '2026-09-24T20:00:00.000Z', 'KAA-GDY');
    s2.actual_departure_at = '2026-09-24T08:00:00.000Z';
    st2.sailings.push(s2);
    const okArr = AIS.replace('17.850695, 57.980348', '18.54425, 54.53321').replace('"sog" : 17.1', '"sog" : 0.2')
      .replace('1790278580817', String(Date.parse('2026-09-24T19:35:00.000Z')));
    await runFerryAis(deps(st2, { 'digitraffic.fi': okArr }, {}, new Date('2026-09-24T19:40:00Z')).d);
    expect(st2.sailings.find((x) => x.route === 'KAA-GDY')?.actual_arrival_at).toBeTruthy();
    expect(st2.sailings.find((x) => x.route === 'KAA-GDY')?.status).toBe('DOPLYNAL'); // #446
  });
  it('postój w porcie Nynäshamn → actual_arrival_at + INFO CC BY 4.0; sygnał >1 h → bez AIS_GAP', async () => {
    const st = new MemStore();
    st.sailings.push(sail(NS, '2026-09-24T16:00:00.000Z', '2026-09-25T10:00:00.000Z'));
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
});

describe('ferry-weather — II-8 FMI+DMI+SMHI', () => {
  const FMI_WAM = fx('fmi-wam-mid-2026-10-02.xml');
  const FMI_GUST = fx('fmi-harmonie-gust-2026-10-02.xml');
  const DMI = fx('dmi-wam-nsb-2026-10-02.json');
  const SMHI = fx('smhi-ocobs-knolls-latest.json');
  const WX_NOW = new Date('2026-10-02T04:00:00Z');

  function wxPages(): Record<string, string | number> {
    return {
      'forecast%3A%3Awam': FMI_WAM,
      'forecast%3A%3Aharmonie': FMI_GUST,
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
    }, {}, WX_NOW).d);
    expect(r.ok).toBe(false);
    expect(st.risks[0]?.dedup).toMatch(/^SOURCE_DOWN:MARINE_WEATHER:/);
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
