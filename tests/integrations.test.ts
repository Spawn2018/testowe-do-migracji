/**
 * M12 — zadania integracji danych zewnętrznych: test każdej funkcji na zapisanych danych, bez sieci.
 * Polferries: prawdziwe strony z 26.09.2026 (rozkład cargo i komunikaty); Digitraffic: prawdziwa odpowiedź z 25.09.2026.
 * Trafikverket / TomTom / DATEX II: przykłady w formacie z dokumentacji dostawców (brak kluczy) — tests/fixtures/*sample*.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  runFerryAis, runFerrySchedule, runFerryStatus, runJob, runRoadPl, runRoadSe, runTrafficFlow,
  type JobDeps, type JobResult, type SyncStore, type VehiclePos,
} from '../supabase/functions/_shared/integrations/jobs';
import type { DbSailing, RiskInput, SailingInsert, SailingPatch } from '../supabase/functions/_shared/integrations/sync';
import { planSailingSync } from '../supabase/functions/_shared/integrations/sync';
import { distanceToCorridorKm, CORRIDOR_SE } from '../supabase/functions/_shared/integrations/road';

const fx = (n: string) => readFileSync(new URL(`./fixtures/${n}`, import.meta.url), 'utf8');
const CARGO = fx('polferries-cargo-rozklad-2026-09-26.html');
const STATUS = fx('polferries-komunikaty-2026-09-26.html');
const AIS = fx('digitraffic-nova-star-2026-09-25.json');
const TV = fx('trafikverket-situation-sample.json');
const TT = fx('tomtom-flow-sample.json');
const DATEX = fx('datex2-kpd-sample.xml');
const NOW = new Date('2026-09-26T01:45:00Z');
const WAW = 'v-waw'; const NS = 'v-ns';

class MemStore implements SyncStore {
  sailings: DbSailing[] = [];
  risks: (RiskInput & { loadId?: string })[] = [];
  runs: { job: string; at: string; ok: boolean; result: JobResult }[] = [];
  positions: VehiclePos[] = [];
  n = 0;
  async projectId() { return 'p1'; }
  async vessels() { return [{ id: WAW, name: 'M/F Wawel', mmsi: null }, { id: NS, name: 'M/F Nova Star', mmsi: 311000787 }]; }
  async sailingsSince(from: string) { return this.sailings.filter((s) => s.departure_at >= from).map((s) => ({ ...s })); }
  async insertSailings(rows: SailingInsert[]) {
    for (const r of rows) if (!this.sailings.some((s) => s.vessel_id === r.vessel_id && s.departure_at === r.departure_at)) this.sailings.push({ id: `s${++this.n}`, ...r });
  }
  async updateSailing(id: string, patch: SailingPatch) {
    const s = this.sailings.find((x) => x.id === id);
    if (!s || s.source === 'RECZNIE') return false;
    Object.assign(s, patch); return true;
  }
  async raiseRisk(r: RiskInput & { loadId?: string }) {
    if (this.risks.some((x) => x.dedup === r.dedup)) return false;
    this.risks.push(r); return true;
  }
  resolved: string[] = [];
  async resolveRisks(prefix: string) { const hit = this.risks.filter((r) => r.dedup.startsWith(prefix)); this.risks = this.risks.filter((r) => !r.dedup.startsWith(prefix)); this.resolved.push(prefix); return hit.length; }
  async latestPositions() { return this.positions; }
  async lastRun(job: string) { return this.runs.filter((r) => r.job === job).at(-1)?.at ?? null; }
  async recordRun(job: string, ok: boolean, result: JobResult) { this.runs.push({ job, at: NOW.toISOString(), ok, result }); }
}

function deps(store: MemStore, pages: Record<string, string | number>, env: Record<string, string> = {}, now = NOW) {
  const calls: string[] = [];
  const f = (async (input: RequestInfo | URL) => {
    const url = String(input); calls.push(url);
    const hit = Object.entries(pages).find(([k]) => url.includes(k));
    if (!hit) throw new Error(`nieoczekiwane zapytanie (sieć zabroniona w teście): ${url}`);
    return typeof hit[1] === 'number' ? new Response('err', { status: hit[1] }) : new Response(hit[1], { status: 200 });
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
    const r = await runFerrySchedule(deps(st, { 'cargo/rozklad': '<html><body>nowa strona</body></html>' }).d);
    expect(r.ok).toBe(false);
    expect(st.sailings).toHaveLength(0);
    expect(st.risks[0]).toMatchObject({ kind: 'FERRY', severity: 'HIGH', dedup: 'SOURCE_DOWN:POLFERRIES_SCHEDULE:2026-09-26' });
  });
});

describe('ferry-status — komunikaty (prawdziwa strona 26.09.2026)', () => {
  it('zapisuje rejsy z prawdziwej strony (Planowo → ZAPLANOWANY), bez ryzyk', async () => {
    const st = new MemStore();
    const { d, calls } = deps(st, { 'komunikaty-kursowania': STATUS });
    const r = await runFerryStatus(d);
    expect(r).toMatchObject({ ok: true, unknown: 0, risks: 0 });
    expect(r.inserted).toBe(10);
    expect(st.sailings.every((s) => s.status === 'ZAPLANOWANY' && s.source === 'POLFERRIES')).toBe(true);
    expect(calls).toEqual(['https://polferries.pl/faq/komunikaty-kursowania-promow.html']);
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
    expect(st.risks[0]).toMatchObject({ kind: 'FERRY', severity: 'MEDIUM', dedup: `FERRY_UNKNOWN:M/F Wawel:${dep26}` });
    expect(String(st.risks[0].detail.surowy_status)).toContain('diverted');
    await runFerryStatus(deps(st, { 'komunikaty-kursowania': page }).d);
    expect(st.risks).toHaveLength(1);
  });
  it('HTTP 503 → ryzyko „źródło niedostępne”, bez zapisu; kolejny udany odczyt zamyka ryzyko', async () => {
    const st = new MemStore();
    const r = await runFerryStatus(deps(st, { 'komunikaty-kursowania': 503 }).d);
    expect(r.ok).toBe(false);
    expect(st.risks[0].title).toMatch(/Źródło niedostępne: status promów/);
    expect(st.sailings).toHaveLength(0);
    await runFerryStatus(deps(st, { 'komunikaty-kursowania': STATUS }).d);
    expect(st.risks).toHaveLength(0);
    expect(st.resolved).toEqual(['SOURCE_DOWN:POLFERRIES_STATUS:']);
  });
  it('nagłówek User-Agent wyłącznie ASCII (inaczej fetch odrzuca żądanie)', async () => {
    const { USER_AGENT, DIGITRAFFIC_USER } = await import('../supabase/functions/_shared/integrations/jobs');
    expect(/^[\x20-\x7e]+$/.test(USER_AGENT) && /^[\x20-\x7e]+$/.test(DIGITRAFFIC_USER)).toBe(true);
    expect(() => new Headers({ 'User-Agent': USER_AGENT })).not.toThrow();
  });
  it('runJob: nie częściej niż co 15 min (dziennik przebiegów)', async () => {
    const st = new MemStore();
    await runJob('ferry-status', deps(st, { 'komunikaty-kursowania': STATUS }).d);
    const early = await runJob('ferry-status', deps(st, { 'komunikaty-kursowania': STATUS }, {}, new Date(NOW.getTime() + 5 * 60000)).d);
    expect(early.skipped).toBe(true);
    const later = await runJob('ferry-status', deps(st, { 'komunikaty-kursowania': STATUS }, {}, new Date(NOW.getTime() + 15 * 60000)).d);
    expect(later.skipped).toBeUndefined();
    expect(st.runs.map((r) => r.job)).toEqual(['ferry-status', 'ferry-status']);
  });
});

describe('ferry-ais — Digitraffic (prawdziwa odpowiedź 25.09.2026)', () => {
  const sail = (vessel: string, dep: string, arr: string): DbSailing => ({ id: `ais-${vessel}`, vessel_id: vessel, route: 'GDN-NYN', departure_at: dep, arrival_at: arr, delayed_departure_at: null, delayed_arrival_at: null, status: 'ZAPLANOWANY', source: 'POLFERRIES' });
  it('Nova Star w rejsie (100 km na S od Nynäshamn, 17 w.) → W_REJSIE, bez ryzyka; Wawel bez MMSI', async () => {
    const st = new MemStore();
    st.sailings.push(sail(NS, '2026-09-24T16:00:00.000Z', '2026-09-25T10:00:00.000Z'), sail(WAW, '2026-09-24T16:00:00.000Z', '2026-09-25T10:00:00.000Z'));
    const r = await runFerryAis(deps(st, { 'digitraffic.fi': AIS }, {}, new Date('2026-09-24T19:40:00Z')).d);
    expect(r.observations).toEqual({ 'M/F Nova Star': 'W_REJSIE', 'M/F Wawel': 'BRAK_MMSI' });
    expect(st.risks).toHaveLength(0);
  });
  it('postój w porcie Nynäshamn → informacja (INFO) z atrybucją CC BY 4.0; sygnał >1 h → brak wniosku o statku', async () => {
    const st = new MemStore();
    st.sailings.push(sail(NS, '2026-09-24T16:00:00.000Z', '2026-09-25T10:00:00.000Z'));
    const inPort = AIS.replace('17.850695, 57.980348', '17.9562, 58.9046').replace('"sog" : 17.1', '"sog" : 0.2');
    await runFerryAis(deps(st, { 'digitraffic.fi': inPort }, {}, new Date('2026-09-24T19:40:00Z')).d);
    expect(st.risks[0]).toMatchObject({ kind: 'FERRY', severity: 'INFO' });
    expect(String(st.risks[0].detail.atrybucja)).toBe('Dane AIS: Fintraffic / digitraffic.fi, licencja CC BY 4.0');
    const st2 = new MemStore();
    st2.sailings.push(sail(NS, '2026-09-24T16:00:00.000Z', '2026-09-25T10:00:00.000Z'));
    const r = await runFerryAis(deps(st2, { 'digitraffic.fi': inPort }, {}, new Date('2026-09-25T09:00:00Z')).d);
    expect(r.observations?.['M/F Nova Star']).toBe('BRAK_SWIEZEGO_SYGNALU');
    expect(st2.risks).toHaveLength(0);
  });
});

describe('road-se — Trafikverket', () => {
  it('bez klucza: tryb DEMO, żadnego zapytania (funkcja nie działa na niby)', async () => {
    const st = new MemStore();
    const { d, calls } = deps(st, {});
    expect(await runRoadSe(d)).toMatchObject({ mode: 'DEMO', ok: true });
    expect(calls).toHaveLength(0);
  });
  it('z kluczem: utrudnienia w buforze 5 km od E4 → ROAD_SE (poziom z SeverityCode); spoza korytarza i „brak wpływu” pominięte', async () => {
    const st = new MemStore();
    const { d, calls } = deps(st, { 'trafikverket.se': TV }, { TRAFIKVERKET_API_KEY: 'k' });
    const r = await runRoadSe(d);
    expect(r.risks).toBe(2);
    expect(st.risks.map((x) => [x.kind, x.severity, x.dedup])).toEqual([
      ['ROAD_SE', 'MEDIUM', 'ROAD_SE:SE_STA_TRISSID_1_1234567'], ['ROAD_SE', 'HIGH', 'ROAD_SE:SE_STA_TRISSID_1_7654321'],
    ]);
    expect(calls[0]).toBe('https://api.trafikinfo.trafikverket.se/v2/data.json');
    expect(distanceToCorridorKm(63.1792, 14.6357, CORRIDOR_SE)).toBeGreaterThan(100);
  });
  it('błąd źródła → ryzyko „źródło niedostępne” ROAD_SE', async () => {
    const st = new MemStore();
    await runRoadSe(deps(st, { 'trafikverket.se': 401 }, { TRAFIKVERKET_API_KEY: 'k' }).d);
    expect(st.risks[0]).toMatchObject({ kind: 'ROAD_SE', dedup: 'SOURCE_DOWN:TRAFIKVERKET:2026-09-26' });
  });
});

describe('road-pl — KPD GDDKiA (DATEX II)', () => {
  it('bez rejestracji: tryb DEMO', async () => {
    expect(await runRoadPl(deps(new MemStore(), {}).d)).toMatchObject({ mode: 'DEMO' });
  });
  it('rekord na S5 przy trasie → ROAD_PL HIGH z opisem PL; A4 Opole poza trasą pominięte', async () => {
    const st = new MemStore();
    const r = await runRoadPl(deps(st, { 'kpd.example': DATEX }, { KPD_DATEX_URL: 'https://kpd.example/datex' }).d);
    expect(r.risks).toBe(1);
    expect(st.risks[0]).toMatchObject({ kind: 'ROAD_PL', severity: 'HIGH', dedup: 'ROAD_PL:PL-GDDKIA-R-1001', validUntil: '2026-10-15T20:00:00+02:00' });
    expect(String(st.risks[0].detail.opis)).toMatch(/S5 węzeł Bydgoszcz/);
  });
});

describe('traffic-flow — TomTom', () => {
  const car: VehiclePos = { load_id: 'L1', code: 'SG-07', lat: 53.1235, lon: 18.0084, ts: NOW.toISOString() };
  it('bez klucza: tryb DEMO', async () => {
    expect(await runTrafficFlow(deps(new MemStore(), {}).d)).toMatchObject({ mode: 'DEMO' });
  });
  it('31 km/h wobec 90 swobodnie przy aucie → ROAD_PL MEDIUM na transporcie; klucz nie trafia do ostrzeżeń', async () => {
    const st = new MemStore(); st.positions = [car];
    const r = await runTrafficFlow(deps(st, { 'api.tomtom.com': TT }, { TOMTOM_API_KEY: 'sekret' }).d);
    expect(r.risks).toBe(1);
    expect(st.risks[0]).toMatchObject({ loadId: 'L1', kind: 'ROAD_PL', severity: 'MEDIUM' });
    const st2 = new MemStore(); st2.positions = [car];
    const r2 = await runTrafficFlow(deps(st2, { 'api.tomtom.com': 500 }, { TOMTOM_API_KEY: 'sekret' }).d);
    expect(JSON.stringify(r2.warnings)).not.toContain('sekret');
    expect(st2.risks[0].dedup).toBe('SOURCE_DOWN:TOMTOM:2026-09-26');
  });
  it('niska pewność pomiaru → bez ryzyka', async () => {
    const st = new MemStore(); st.positions = [car];
    await runTrafficFlow(deps(st, { 'api.tomtom.com': TT.replace('"confidence": 0.97', '"confidence": 0.3') }, { TOMTOM_API_KEY: 'k' }).d);
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
