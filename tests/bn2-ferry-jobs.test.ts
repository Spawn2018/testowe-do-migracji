/**
 * BN2 / F7 #660 — testy joba ferry-schedule / ferry-portnet (mock fetch, bez sieci).
 * F7 r2/r3: Port of Tallinn tylko odwołania; Stockholm actual_* bez insertów/godzin.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  fetchStenaDays, pickUniqueInWindow, runFerryPortnet, runFerrySchedule, runFerryStatus,
  type JobDeps, type JobResult, type SyncStore,
} from '../supabase/functions/_shared/integrations/jobs';
import type { DbSailing, RiskInput, SailingInsert, SailingPatch } from '../supabase/functions/_shared/integrations/sync';
import { sourceDownRisk } from '../supabase/functions/_shared/integrations/sync';

const fx = (n: string) => readFileSync(new URL(`./fixtures/${n}`, import.meta.url), 'utf8');
const CARGO = fx('polferries-cargo-rozklad-2026-09-26.html');
const TALLINK = fx('tallink-timetable-tal-hel-2026-10-30.json');
const PORTNET = fx('digitraffic-port-calls-megastar-2026-10-29.json');
const PORTNET_XPRS_ES = fx('digitraffic-viking-xprs-es-sample.json');
const PORT_TLL = fx('port-tallinn-departures-arrivals-sample.html');
const PORT_STO = fx('ports-stockholm-portentry-sample.json');
const DFDS_HTML = fx('dfds-weekly-paldiski-kapellskar-sample.html');
const DFDS_API = fx('dfds-timetable-api-sample.json');
const VIKING_HTML = fx('viking-timetable-helsinki-tallinn-sample.html');
const VIKING_CARGO_HTML = fx('viking-cargo-helsinki-tallinn-sample.html');
const NOW = new Date('2026-10-30T12:00:00Z');
const MEGA = 'v-mega';
const MYST = 'v-myst';
const SIRENA = 'v-sirena';

class MemStore implements SyncStore {
  sailings: DbSailing[] = [];
  risks: (RiskInput & { loadId?: string })[] = [];
  runs: { job: string; at: string; ok: boolean; result: JobResult }[] = [];
  n = 0;
  async projectId() { return 'p1'; }
  async vessels() {
    return [
      { id: MEGA, name: 'M/F Megastar', mmsi: 276829000 },
      { id: MYST, name: 'M/F MyStar', mmsi: 276817000 },
      { id: SIRENA, name: 'M/F Sirena Seaways', mmsi: 277569000 },
      { id: 'v-xprs', name: 'M/F Viking XPRS', mmsi: 230705000 },
      { id: 'v-cind', name: 'M/F Viking Cinderella', mmsi: null },
      { id: 'v-gab', name: 'M/F Gabriella', mmsi: null },
      { id: 'v-fin', name: 'M/F Finlandia', mmsi: 230987000 },
      { id: 'v-queen', name: 'M/F Baltic Queen', mmsi: 276815000 },
      { id: 'v-waw', name: 'M/F Wawel', mmsi: null },
      { id: 'v-ns', name: 'M/F Nova Star', mmsi: 311000787 },
      { id: 'v-ebba', name: 'M/F Stena Ebba', mmsi: null },
      { id: 'v-spir', name: 'M/F Stena Spirit', mmsi: null },
      { id: 'v-este', name: 'M/F Stena Estelle', mmsi: null },
    ];
  }
  async sailingsSince(from: string) {
    return this.sailings.filter((s) => s.departure_at >= from).map((s) => ({ ...s }));
  }
  /** F7 #690 R2-B4 / 63c — max bez limitu 1000 (jedna metoda; F7 r3 bez duplikatu). */
  async maxVikingFileDepartureAt(nowIso: string) {
    let max: string | null = null;
    for (const s of this.sailings) {
      if (s.source !== 'VIKING') continue;
      if (s.source_ref != null && s.source_ref !== '') continue;
      if (s.departure_at <= nowIso) continue;
      if (!max || s.departure_at > max) max = s.departure_at;
    }
    return max;
  }
  async insertSailings(rows: SailingInsert[]) {
    for (const r of rows) {
      /* F7 #688 r3: unikalny source_ref (wiersz poza sinceIso) → konflikt jak w bazie. */
      if (r.source_ref && this.sailings.some((s) => s.source_ref === r.source_ref)) {
        throw new Error(`duplicate source_ref: ${r.source_ref}`);
      }
      if (!this.sailings.some((s) => s.vessel_id === r.vessel_id && s.departure_at === r.departure_at)) {
        this.sailings.push({ id: `s${++this.n}`, ...r });
      }
    }
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
  assignedLoads = new Set<string>();
  deleteThrows = false;
  async sailingAssignedLoadCount(sailingId: string) {
    return this.assignedLoads.has(sailingId) ? 1 : 0;
  }
  async deleteSailing(id: string) {
    if (this.deleteThrows) throw new Error('fk loads.sailing_id');
    const s = this.sailings.find((x) => x.id === id);
    if (!s || s.source === 'RECZNIE') return false;
    this.sailings = this.sailings.filter((x) => x.id !== id);
    return true;
  }
  async raiseRisk(r: RiskInput & { loadId?: string }) {
    if (this.risks.some((x) => x.dedup === r.dedup)) return false;
    this.risks.push(r); return true;
  }
  async resolveRisks(prefix: string) {
    const hit = this.risks.filter((r) => r.dedup.startsWith(prefix));
    this.risks = this.risks.filter((r) => !r.dedup.startsWith(prefix));
    return hit.length;
  }
  /** F7 #694 R1-B3 — zamykanie nieaktualnych FERRY_WINTER:*. */
  async resolveStaleRisks(prefix: string, keep: string[]) {
    const keepSet = new Set(keep);
    const hit = this.risks.filter((r) => r.dedup.startsWith(prefix) && !keepSet.has(r.dedup));
    this.risks = this.risks.filter((r) => !(r.dedup.startsWith(prefix) && !keepSet.has(r.dedup)));
    return hit.length;
  }
  async latestPositions() { return []; }
  async lastRun(job: string) { return this.runs.filter((r) => r.job === job).at(-1)?.at ?? null; }
  async recordRun(job: string, ok: boolean, result: JobResult) {
    this.runs.push({ job, at: NOW.toISOString(), ok, result });
  }
  async saveVesselPosition() { /* no-op */ }
  /** F7 #682 B1 — domyślnie 15; testy mogą nadpisać. */
  delayMin = 15;
  async ferryPortDelayMin() { return this.delayMin; }
}

function deps(store: MemStore, pages: Record<string, string | number>, now = NOW): JobDeps {
  const f = (async (input: RequestInfo | URL) => {
    const url = String(input);
    /* #685-a: dłuższy klucz wygrywa (locode=FIHEL przed port-calls). */
    const hit = Object.entries(pages)
      .filter(([k]) => url.includes(k))
      .sort((a, b) => b[0].length - a[0].length)[0];
    if (hit) {
      return typeof hit[1] === 'number'
        ? new Response('err', { status: hit[1] })
        : new Response(hit[1], { status: 200 });
    }
    if (url.includes('_jcr_content.timetable.')) {
      return new Response('[]', { status: 200 });
    }
    if (url.includes('stenalinefreight.com')) {
      return new Response('niedostepne', { status: 503 });
    }
    if (url.includes('ts.ee') || url.includes('portsofstockholm')) {
      return new Response('niedostepne', { status: 503 });
    }
    /* BN3: winter-nav / port-call v2 — domyślnie puste (bez aktywnych ograniczeń). */
    if (url.includes('winter-navigation')) {
      return new Response(JSON.stringify({ type: 'FeatureCollection', features: [] }), { status: 200 });
    }
    if (url.includes('port-call/v2')) {
      return new Response('[]', { status: 200 });
    }
    /* BN3: UMG Gdynia — domyślnie pusta sekcja (bez Stena). */
    if (url.includes('umgdy.gov.pl')) {
      return new Response(
        '<html><body><h2>Port Gdynia</h2><table class="table table-striped"><tr><th>Call ID</th></tr></table></body></html>',
        { status: 200 },
      );
    }
    throw new Error(`nieoczekiwane zapytanie: ${url}`);
  }) as typeof fetch;
  return { store, fetch: f, env: {}, now: () => now };
}

const basePages = {
  'cargo/rozklad': CARGO,
  'port-calls': PORTNET,
  /* #666 A: domyślnie oba źródła Viking niedostępne (nadpisz w teście). */
  'viking-line-cargo': 503 as const,
  'sales.vikingline.com': 503 as const,
};

const tallinkPages = {
  ...basePages,
  'from=tal&to=hel': TALLINK,
  'from=hel&to=tal': 503 as const,
  'from=tal&to=sto': 503 as const,
  'from=sto&to=tal': 503 as const,
};

describe('F7 #660 ferry-schedule Tallink', () => {
  it('częściowa awaria Tallinka → zapisuje kierunki OK, bez SOURCE_DOWN', async () => {
    const st = new MemStore();
    const r = await runFerrySchedule(deps(st, { ...tallinkPages }));
    expect(r.ok).toBe(true);
    expect(st.sailings.some((s) => s.source === 'TALLINK' && s.route === 'TLL-HEL')).toBe(true);
    expect(st.risks.some((x) => String(x.dedup).startsWith('SOURCE_DOWN:TALLINK_SCHEDULE:'))).toBe(false);
  });

  it('całkowita awaria Tallinka → SOURCE_DOWN (dedup)', async () => {
    const st = new MemStore();
    const pages: Record<string, string | number> = {
      ...basePages,
      'api/timetables': 503,
    };
    const r = await runFerrySchedule(deps(st, pages));
    expect(st.risks.some((x) => String(x.dedup).startsWith('SOURCE_DOWN:TALLINK_SCHEDULE:'))).toBe(true);
    // Polferries OK → cały job nadal ok
    expect(r.ok).toBe(true);
    const again = await runFerrySchedule(deps(st, pages));
    expect(st.risks.filter((x) => String(x.dedup).startsWith('SOURCE_DOWN:TALLINK_SCHEDULE:'))).toHaveLength(1);
    expect(again.ok).toBe(true);
  });
});

describe('F7 #660 r2/r3 Port of Tallinn / Stockholm bez zmyślonych godzin', () => {
  it('Tallink + Port of Tallinn: bez duplikatu, bez actual_* z planu tablicy', async () => {
    const st = new MemStore();
    const pages: Record<string, string | number> = {
      ...tallinkPages,
      'ts.ee/en/departures': PORT_TLL,
      'ts.ee/en/arrivals': PORT_TLL,
    };
    const r = await runFerrySchedule(deps(st, pages));
    expect(r.ok).toBe(true);
    // MyStar 07:30 lokalnie = 05:30Z; Tallink arrival 09:30 = 07:30Z — PoT nie nadpisuje godzin.
    // F7 r3: atUtc z tablicy = plan → actual_* i status bez zmian (nie „wypłynął” przed faktem).
    const myst = st.sailings.filter((s) => s.vessel_id === MYST && s.route === 'TLL-HEL'
      && s.departure_at === '2026-10-30T05:30:00.000Z');
    expect(myst).toHaveLength(1);
    expect(myst[0]).toMatchObject({
      source: 'TALLINK',
      arrival_at: '2026-10-30T07:30:00.000Z',
      status: 'ZAPLANOWANY',
    });
    expect(myst[0]!.actual_departure_at ?? null).toBeNull();
    expect(myst[0]!.actual_arrival_at ?? null).toBeNull();
    // PoT nie tworzy rejsów Viking/Eckerö (brak ich własnego rozkładu w tym PR).
    expect(st.sailings.every((s) => s.source !== 'VIKING' && s.source !== 'ECKERO')).toBe(true);
  });

  it('Port of Tallinn: zdarzenie z samym planem → actual_* puste, status bez zmian', async () => {
    const st = new MemStore();
    st.sailings.push({
      id: 'plan', vessel_id: MYST, route: 'TLL-HEL',
      departure_at: '2026-10-30T05:30:00.000Z', arrival_at: '2026-10-30T07:30:00.000Z',
      delayed_departure_at: null, delayed_arrival_at: null,
      actual_departure_at: null, actual_arrival_at: null,
      status: 'ZAPLANOWANY', source: 'TALLINK',
    });
    const pages: Record<string, string | number> = {
      ...basePages,
      'api/timetables': 503,
      'ts.ee/en/departures': PORT_TLL,
      'ts.ee/en/arrivals': PORT_TLL,
    };
    const r = await runFerrySchedule(deps(st, pages));
    expect(r.ok).toBe(true);
    const plan = st.sailings.find((s) => s.id === 'plan')!;
    expect(plan).toMatchObject({
      status: 'ZAPLANOWANY',
      departure_at: '2026-10-30T05:30:00.000Z',
      arrival_at: '2026-10-30T07:30:00.000Z',
    });
    expect(plan.actual_departure_at ?? null).toBeNull();
    expect(plan.actual_arrival_at ?? null).toBeNull();
  });

  it('Ports of Stockholm: actual_* na istniejącym, bez insertu i bez zmiany godzin', async () => {
    const st = new MemStore();
    // actual 19:05 / 21:10 lokalny Stockholm (CET) → 18:05Z / 20:10Z; dep ≥ since (now−1d).
    st.sailings.push(
      {
        id: 'pld', vessel_id: SIRENA, route: 'PLD-KPS',
        departure_at: '2026-10-29T12:30:00.000Z', arrival_at: '2026-10-29T18:05:00.000Z',
        delayed_departure_at: null, delayed_arrival_at: null,
        actual_departure_at: null, actual_arrival_at: null,
        status: 'W_REJSIE', source: 'DFDS',
      },
      {
        id: 'kps', vessel_id: SIRENA, route: 'KPS-PLD',
        departure_at: '2026-10-29T20:10:00.000Z', arrival_at: '2026-10-30T06:00:00.000Z',
        delayed_departure_at: null, delayed_arrival_at: null,
        actual_departure_at: null, actual_arrival_at: null,
        status: 'ZAPLANOWANY', source: 'DFDS',
      },
    );
    const pages: Record<string, string | number> = {
      ...basePages,
      'api/timetables': 503,
      'portsofstockholm.com': PORT_STO,
    };
    const beforeIds = new Set(st.sailings.map((s) => s.id));
    const r = await runFerrySchedule(deps(st, pages));
    expect(r.ok).toBe(true);
    expect(st.sailings.find((s) => s.id === 'pld')).toMatchObject({
      arrival_at: '2026-10-29T18:05:00.000Z',
      departure_at: '2026-10-29T12:30:00.000Z',
      actual_arrival_at: '2026-10-29T18:05:00.000Z',
      status: 'DOPLYNAL',
      source: 'DFDS',
    });
    expect(st.sailings.find((s) => s.id === 'kps')).toMatchObject({
      departure_at: '2026-10-29T20:10:00.000Z',
      arrival_at: '2026-10-30T06:00:00.000Z',
      actual_departure_at: '2026-10-29T20:10:00.000Z',
      status: 'W_REJSIE',
      source: 'DFDS',
    });
    // Stockholm nie dodaje nowych rejsów Sireny (tylko actual_*).
    expect(st.sailings.filter((s) => s.vessel_id === SIRENA && !beforeIds.has(s.id))).toHaveLength(0);
  });

  it('RECZNIE przy odwołaniu z Port of Tallinn nietknięte', async () => {
    const st = new MemStore();
    st.sailings.push({
      id: 'recz', vessel_id: MYST, route: 'TLL-HEL',
      departure_at: '2026-10-30T05:30:00.000Z', arrival_at: '2026-10-30T07:30:00.000Z',
      delayed_departure_at: null, delayed_arrival_at: null,
      actual_departure_at: null, actual_arrival_at: null,
      status: 'ZAPLANOWANY', source: 'RECZNIE',
    });
    const html = `<!DOCTYPE html><html><body>
<table class="table" id="passenger-lines-outbound"><tbody>
<tr data-terminal="d" data-from_to="helsinki" data-company="tallink">
<td data-sort_value="07:30">07:30</td>
<td data-sort_value="MYSTAR">MYSTAR</td>
<td data-sort_value="Tallinn">Tallinn</td>
<td data-sort_value="Helsinki">Helsinki</td>
<td data-sort_value="D">Terminal D</td>
<td data-sort_value="Tallink">Tallink</td>
<td data-sort_value="Cancelled">Cancelled</td>
</tr></tbody></table>
<table class="table" id="passenger-lines-inbound"><tbody></tbody></table>
</body></html>`;
    const pages: Record<string, string | number> = {
      ...basePages,
      'api/timetables': 503,
      'ts.ee/en/departures': html,
      'ts.ee/en/arrivals': html,
    };
    await runFerrySchedule(deps(st, pages));
    expect(st.sailings.find((s) => s.id === 'recz')).toMatchObject({
      status: 'ZAPLANOWANY', source: 'RECZNIE',
      departure_at: '2026-10-30T05:30:00.000Z',
      arrival_at: '2026-10-30T07:30:00.000Z',
    });
  });
});

describe('F7 #660 ferry-portnet', () => {
  it('RECZNIE: actual_* bez zmiany statusu; ODWOLANY: actual_* bez zmiany statusu', async () => {
    const st = new MemStore();
    // Portnet Megastar: ATA 16:30Z → TLL-HEL, ATD 17:15Z → HEL-TLL (±3 h).
    st.sailings.push(
      {
        id: 'recz', vessel_id: MEGA, route: 'TLL-HEL',
        departure_at: '2026-10-29T14:30:00.000Z', arrival_at: '2026-10-29T16:30:00.000Z',
        delayed_departure_at: null, delayed_arrival_at: null,
        actual_departure_at: null, actual_arrival_at: null,
        status: 'ZAPLANOWANY', source: 'RECZNIE',
      },
      {
        id: 'odwo', vessel_id: MEGA, route: 'HEL-TLL',
        departure_at: '2026-10-29T17:15:00.000Z', arrival_at: '2026-10-29T19:15:00.000Z',
        delayed_departure_at: null, delayed_arrival_at: null,
        actual_departure_at: null, actual_arrival_at: null,
        status: 'ODWOLANY', source: 'TALLINK',
      },
    );
    const r = await runFerryPortnet(deps(st, { 'port-calls': PORTNET }, new Date('2026-10-29T20:00:00Z')));
    expect(r.ok).toBe(true);
    expect(st.sailings.find((s) => s.id === 'recz')).toMatchObject({
      status: 'ZAPLANOWANY', source: 'RECZNIE', actual_arrival_at: '2026-10-29T16:30:00.000Z',
    });
    expect(st.sailings.find((s) => s.id === 'odwo')).toMatchObject({
      status: 'ODWOLANY', actual_departure_at: '2026-10-29T17:15:00.000Z',
    });
  });

  it('zwykły rejs → DOPLYNAL / W_REJSIE z actual_*', async () => {
    const st = new MemStore();
    st.sailings.push(
      {
        id: 'ok-arr', vessel_id: MEGA, route: 'TLL-HEL',
        departure_at: '2026-10-29T14:00:00.000Z', arrival_at: '2026-10-29T16:30:00.000Z',
        delayed_departure_at: null, delayed_arrival_at: null,
        actual_departure_at: '2026-10-29T14:05:00.000Z', actual_arrival_at: null,
        status: 'W_REJSIE', source: 'TALLINK',
      },
      {
        id: 'ok-dep', vessel_id: MEGA, route: 'HEL-TLL',
        departure_at: '2026-10-29T17:15:00.000Z', arrival_at: '2026-10-29T19:15:00.000Z',
        delayed_departure_at: null, delayed_arrival_at: null,
        actual_departure_at: null, actual_arrival_at: null,
        status: 'ZAPLANOWANY', source: 'TALLINK',
      },
    );
    const r = await runFerryPortnet(deps(st, { 'port-calls': PORTNET }, new Date('2026-10-29T20:00:00Z')));
    expect(r.ok).toBe(true);
    expect(st.sailings.find((s) => s.id === 'ok-arr')).toMatchObject({
      status: 'DOPLYNAL', actual_arrival_at: '2026-10-29T16:30:00.000Z',
    });
    expect(st.sailings.find((s) => s.id === 'ok-dep')).toMatchObject({
      status: 'W_REJSIE', actual_departure_at: '2026-10-29T17:15:00.000Z',
    });
  });

  it('BN3 decyzja 58: ATA − arrival ≥ 15 min → delayed_arrival_at; RECZNIE bez delayed', async () => {
    // Fixture Megastar ATA 16:30Z — plan 16:00 → +30 min ≥ 15.
    const late = new MemStore();
    late.sailings.push({
      id: 'late-arr', vessel_id: MEGA, route: 'TLL-HEL',
      departure_at: '2026-10-29T14:00:00.000Z', arrival_at: '2026-10-29T16:00:00.000Z',
      delayed_departure_at: null, delayed_arrival_at: null,
      actual_departure_at: '2026-10-29T14:05:00.000Z', actual_arrival_at: null,
      status: 'W_REJSIE', source: 'TALLINK',
    });
    const r1 = await runFerryPortnet(deps(late, { 'port-calls': PORTNET }, new Date('2026-10-29T20:00:00Z')));
    expect(r1.ok).toBe(true);
    expect(late.sailings.find((s) => s.id === 'late-arr')).toMatchObject({
      status: 'DOPLYNAL',
      actual_arrival_at: '2026-10-29T16:30:00.000Z',
      delayed_arrival_at: '2026-10-29T16:30:00.000Z',
    });
    const recz = new MemStore();
    recz.sailings.push({
      id: 'late-recz', vessel_id: MEGA, route: 'TLL-HEL',
      departure_at: '2026-10-29T14:00:00.000Z', arrival_at: '2026-10-29T16:00:00.000Z',
      delayed_departure_at: null, delayed_arrival_at: null,
      actual_departure_at: null, actual_arrival_at: null,
      status: 'ZAPLANOWANY', source: 'RECZNIE',
    });
    const r2 = await runFerryPortnet(deps(recz, { 'port-calls': PORTNET }, new Date('2026-10-29T20:00:00Z')));
    expect(r2.ok).toBe(true);
    expect(recz.sailings.find((s) => s.id === 'late-recz')).toMatchObject({
      status: 'ZAPLANOWANY',
      actual_arrival_at: '2026-10-29T16:30:00.000Z',
      delayed_arrival_at: null,
    });
  });

  it('F7 #682 B1/B4/B5: próg z parametru; ATA +10 bez delayed; dwa rejsy w oknie', async () => {
    // B5: ATA +10 min < 15 → actual bez delayed_arrival.
    const mild = new MemStore();
    mild.sailings.push({
      id: 'mild', vessel_id: MEGA, route: 'TLL-HEL',
      departure_at: '2026-10-29T14:20:00.000Z', arrival_at: '2026-10-29T16:20:00.000Z',
      delayed_departure_at: null, delayed_arrival_at: null,
      actual_departure_at: null, actual_arrival_at: null,
      status: 'W_REJSIE', source: 'TALLINK',
    });
    // Fixture ATA 16:30 → +10 względem 16:20.
    await runFerryPortnet(deps(mild, { 'port-calls': PORTNET }, new Date('2026-10-29T20:00:00Z')));
    expect(mild.sailings.find((s) => s.id === 'mild')).toMatchObject({
      actual_arrival_at: '2026-10-29T16:30:00.000Z',
      delayed_arrival_at: null,
      status: 'DOPLYNAL',
    });
    // B1: próg 0 → +10 min daje delayed.
    const thr0 = new MemStore();
    thr0.delayMin = 0;
    thr0.sailings.push({
      id: 'thr0', vessel_id: MEGA, route: 'TLL-HEL',
      departure_at: '2026-10-29T14:20:00.000Z', arrival_at: '2026-10-29T16:20:00.000Z',
      delayed_departure_at: null, delayed_arrival_at: null,
      actual_departure_at: null, actual_arrival_at: null,
      status: 'W_REJSIE', source: 'TALLINK',
    });
    await runFerryPortnet(deps(thr0, { 'port-calls': PORTNET }, new Date('2026-10-29T20:00:00Z')));
    expect(thr0.sailings.find((s) => s.id === 'thr0')!.delayed_arrival_at).toBe('2026-10-29T16:30:00.000Z');
    // B4: dwa rejsy Megastar w ±3 h od ATA 16:30 → pominąć + ryzyko.
    const amb = new MemStore();
    amb.sailings.push(
      {
        id: 'a1', vessel_id: MEGA, route: 'TLL-HEL',
        departure_at: '2026-10-29T14:00:00.000Z', arrival_at: '2026-10-29T16:00:00.000Z',
        delayed_departure_at: null, delayed_arrival_at: null,
        actual_departure_at: null, actual_arrival_at: null,
        status: 'W_REJSIE', source: 'TALLINK',
      },
      {
        id: 'a2', vessel_id: MEGA, route: 'TLL-HEL',
        departure_at: '2026-10-29T15:00:00.000Z', arrival_at: '2026-10-29T17:00:00.000Z',
        delayed_departure_at: null, delayed_arrival_at: null,
        actual_departure_at: null, actual_arrival_at: null,
        status: 'W_REJSIE', source: 'TALLINK',
      },
    );
    await runFerryPortnet(deps(amb, { 'port-calls': PORTNET }, new Date('2026-10-29T20:00:00Z')));
    expect(amb.sailings.every((s) => s.actual_arrival_at == null)).toBe(true);
    expect(amb.risks.some((r) => String(r.dedup).startsWith('FERRY_UNKNOWN:PORTNET_ATA:'))).toBe(true);
    // pickUniqueInWindow: północ / jeden kandydat.
    const one = pickUniqueInWindow(
      [{ id: 'n', t: Date.parse('2026-10-30T00:30:00.000Z') }],
      Date.parse('2026-10-30T01:00:00.000Z'),
      (x) => x.t,
      3 * 3600_000,
    );
    expect(one).toMatchObject({ kind: 'hit', item: { id: 'n' } });
  });

  // DP-94 (F7 #682 r2): ATD 13–19 min przed planem → actual_*, bez delayed_departure, W_REJSIE.
  it('DP-94: ATD 13–19 min przed planem nie daje delayed_departure', async () => {
    // Fixture ATD HEL-TLL = 17:15Z; plan 17:28 / 17:30 / 17:34 = −13 / −15 / −19 min.
    for (const [id, dep] of [
      ['early13', '2026-10-29T17:28:00.000Z'],
      ['early15', '2026-10-29T17:30:00.000Z'],
      ['early19', '2026-10-29T17:34:00.000Z'],
    ] as const) {
      const st = new MemStore();
      st.sailings.push({
        id, vessel_id: MEGA, route: 'HEL-TLL',
        departure_at: dep, arrival_at: '2026-10-29T19:30:00.000Z',
        delayed_departure_at: null, delayed_arrival_at: null,
        actual_departure_at: null, actual_arrival_at: null,
        status: 'ZAPLANOWANY', source: 'TALLINK',
      });
      const r = await runFerryPortnet(deps(st, { 'port-calls': PORTNET }, new Date('2026-10-29T20:00:00Z')));
      expect(r.ok).toBe(true);
      expect(st.sailings.find((s) => s.id === id)).toMatchObject({
        actual_departure_at: '2026-10-29T17:15:00.000Z',
        delayed_departure_at: null,
        status: 'W_REJSIE',
      });
    }
  });

  // DP-95 (F7 #682 r2): ±3 h — ATA tylko do jednoznacznego rejsu; bez ryzyka przy jednym hicie.
  it('DP-95: tolerancja ±3 h — ATA tylko do jednego rejsu; wariant po północy', async () => {
    // Dzień: przypłynięcia 10:30 / 16:30Z, ATA 16:30 → tylko drugi; pierwszy bez actual i bez ryzyka.
    const day = new MemStore();
    day.sailings.push(
      {
        id: 'm1030', vessel_id: MEGA, route: 'TLL-HEL',
        departure_at: '2026-10-29T08:30:00.000Z', arrival_at: '2026-10-29T10:30:00.000Z',
        delayed_departure_at: null, delayed_arrival_at: null,
        actual_departure_at: null, actual_arrival_at: null,
        status: 'W_REJSIE', source: 'TALLINK',
      },
      {
        id: 'm1630', vessel_id: MEGA, route: 'TLL-HEL',
        departure_at: '2026-10-29T14:30:00.000Z', arrival_at: '2026-10-29T16:30:00.000Z',
        delayed_departure_at: null, delayed_arrival_at: null,
        actual_departure_at: null, actual_arrival_at: null,
        status: 'W_REJSIE', source: 'TALLINK',
      },
    );
    await runFerryPortnet(deps(day, { 'port-calls': PORTNET }, new Date('2026-10-29T20:00:00Z')));
    expect(day.sailings.find((s) => s.id === 'm1030')).toMatchObject({
      actual_arrival_at: null,
    });
    expect(day.sailings.find((s) => s.id === 'm1630')).toMatchObject({
      actual_arrival_at: '2026-10-29T16:30:00.000Z',
      status: 'DOPLYNAL',
    });
    expect(day.risks.some((r) => String(r.dedup).startsWith('FERRY_UNKNOWN:PORTNET_ATA:'))).toBe(false);

    // Po północy: 23:50 / ATA 00:20 / następny 06:00 — tylko pierwszy w ±3 h.
    const midJson = JSON.stringify({
      portCalls: [{
        vesselName: 'Megastar',
        mmsi: 276829000,
        portToVisit: 'FIHEL',
        prevPort: 'EETLL',
        nextPort: 'EETLL',
        portAreaDetails: [{
          ata: '2026-10-30T00:20:00.000Z',
          atd: null,
          eta: '2026-10-30T00:20:00.000Z',
          etd: null,
        }],
      }],
    });
    const mid = new MemStore();
    mid.sailings.push(
      {
        id: 'pre-mid', vessel_id: MEGA, route: 'TLL-HEL',
        departure_at: '2026-10-29T21:50:00.000Z', arrival_at: '2026-10-29T23:50:00.000Z',
        delayed_departure_at: null, delayed_arrival_at: null,
        actual_departure_at: null, actual_arrival_at: null,
        status: 'W_REJSIE', source: 'TALLINK',
      },
      {
        id: 'post-mid', vessel_id: MEGA, route: 'TLL-HEL',
        departure_at: '2026-10-30T04:00:00.000Z', arrival_at: '2026-10-30T06:00:00.000Z',
        delayed_departure_at: null, delayed_arrival_at: null,
        actual_departure_at: null, actual_arrival_at: null,
        status: 'W_REJSIE', source: 'TALLINK',
      },
    );
    await runFerryPortnet(deps(mid, { 'port-calls': midJson }, new Date('2026-10-30T08:00:00Z')));
    expect(mid.sailings.find((s) => s.id === 'pre-mid')).toMatchObject({
      actual_arrival_at: '2026-10-30T00:20:00.000Z',
      status: 'DOPLYNAL',
    });
    expect(mid.sailings.find((s) => s.id === 'post-mid')).toMatchObject({
      actual_arrival_at: null,
      status: 'W_REJSIE',
    });
    expect(mid.risks.some((r) => String(r.dedup).startsWith('FERRY_UNKNOWN:PORTNET_ATA:'))).toBe(false);
  });

  it('F7 #682 B5: sourceDownRisk Polferries/Stena HIGH; DFDS/Tallink MEDIUM; ferry-status DFDS', async () => {
    expect(sourceDownRisk('POLFERRIES_STATUS', ['x'], '2026-10-31T12:00:00.000Z').severity).toBe('HIGH');
    expect(sourceDownRisk('STENA_SCHEDULE', ['x'], '2026-10-31T12:00:00.000Z').severity).toBe('HIGH');
    expect(sourceDownRisk('DFDS_STATUS', ['x'], '2026-10-31T12:00:00.000Z').severity).toBe('MEDIUM');
    expect(sourceDownRisk('TALLINK_SCHEDULE', ['x'], '2026-10-31T12:00:00.000Z').severity).toBe('MEDIUM');
    const both = JSON.parse(DFDS_API) as { pld_kps_week44: unknown[]; kps_pld_week44: unknown[] };
    const st = new MemStore();
    st.sailings.push({
      id: 'dfds1', vessel_id: SIRENA, route: 'PLD-KPS',
      departure_at: '2026-10-27T21:59:00.000Z', arrival_at: '2026-10-28T07:30:00.000Z',
      delayed_departure_at: null, delayed_arrival_at: null,
      status: 'ZAPLANOWANY', source: 'DFDS',
    });
    const f = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('portOfLoading=EEPLN')) {
        return new Response(JSON.stringify(both.pld_kps_week44), { status: 200 });
      }
      if (url.includes('portOfLoading=SEKPS')) {
        return new Response(JSON.stringify(both.kps_pld_week44), { status: 200 });
      }
      if (url.includes('komunikaty') || url.includes('stena')) {
        return new Response('err', { status: 503 });
      }
      throw new Error(`nieoczekiwane: ${url}`);
    }) as typeof fetch;
    const r = await runFerryStatus({
      store: st, fetch: f, env: {}, now: () => new Date('2026-10-28T10:00:00Z'),
    });
    expect(r.ok).toBe(true);
    const s = st.sailings.find((x) => x.id === 'dfds1');
    expect(s).toMatchObject({
      status: 'OPOZNIONY',
      delayed_departure_at: '2026-10-27T23:00:00.000Z',
      delayed_arrival_at: '2026-10-28T08:31:00.000Z',
    });
    expect(st.risks.some((x) => String(x.dedup).startsWith('SOURCE_DOWN:DFDS_STATUS:'))).toBe(false);
  });

  it('HEL-TLL / STO-TLL / KPS-PLD po arrival_at+2h bez ATA → DOPLYNAL', async () => {
    const st = new MemStore();
    st.sailings.push(
      {
        id: 'stuck-hel', vessel_id: MEGA, route: 'HEL-TLL',
        departure_at: '2026-10-29T10:00:00.000Z', arrival_at: '2026-10-29T12:00:00.000Z',
        delayed_departure_at: null, delayed_arrival_at: null,
        actual_departure_at: '2026-10-29T10:10:00.000Z', actual_arrival_at: null,
        status: 'W_REJSIE', source: 'TALLINK',
      },
      {
        id: 'stuck-sto', vessel_id: MEGA, route: 'STO-TLL',
        departure_at: '2026-10-28T22:00:00.000Z', arrival_at: '2026-10-29T10:00:00.000Z',
        delayed_departure_at: null, delayed_arrival_at: null,
        actual_departure_at: '2026-10-28T22:05:00.000Z', actual_arrival_at: null,
        status: 'W_REJSIE', source: 'TALLINK',
      },
      {
        id: 'stuck-kps', vessel_id: SIRENA, route: 'KPS-PLD',
        departure_at: '2026-10-29T08:00:00.000Z', arrival_at: '2026-10-29T18:00:00.000Z',
        delayed_departure_at: null, delayed_arrival_at: null,
        actual_departure_at: '2026-10-29T08:10:00.000Z', actual_arrival_at: null,
        status: 'W_REJSIE', source: 'DFDS',
      },
    );
    const empty = JSON.stringify({ portCalls: [] });
    const r = await runFerryPortnet(deps(st, { 'port-calls': empty }, new Date('2026-10-29T21:00:00Z')));
    expect(r.ok).toBe(true);
    expect(st.sailings.find((s) => s.id === 'stuck-hel')).toMatchObject({
      status: 'DOPLYNAL', actual_arrival_at: null,
    });
    expect(st.sailings.find((s) => s.id === 'stuck-sto')).toMatchObject({
      status: 'DOPLYNAL', actual_arrival_at: null,
    });
    expect(st.sailings.find((s) => s.id === 'stuck-kps')).toMatchObject({
      status: 'DOPLYNAL', actual_arrival_at: null,
    });
  });

  it('drugi przebieg idempotentny (bez ponownego update statusu)', async () => {
    const st = new MemStore();
    st.sailings.push({
      id: 'ok-arr', vessel_id: MEGA, route: 'TLL-HEL',
      departure_at: '2026-10-29T14:00:00.000Z', arrival_at: '2026-10-29T16:30:00.000Z',
      delayed_departure_at: null, delayed_arrival_at: null,
      actual_departure_at: '2026-10-29T14:05:00.000Z', actual_arrival_at: null,
      status: 'W_REJSIE', source: 'TALLINK',
    });
    const now = new Date('2026-10-29T20:00:00Z');
    const first = await runFerryPortnet(deps(st, { 'port-calls': PORTNET }, now));
    expect(first.updated).toBeGreaterThan(0);
    const second = await runFerryPortnet(deps(st, { 'port-calls': PORTNET }, now));
    expect(second.updated).toBe(0);
  });
});

describe('F7 #661 B1/B2 DFDS bez stałej HTML; PoT tylko dziś', () => {
  it('B1: HTTP 200 bez tabeli DFDS → SOURCE_DOWN, 0 rejsów DFDS (bez zmyślonych godzin)', async () => {
    const st = new MemStore();
    const pages: Record<string, string | number> = {
      ...tallinkPages,
      'dfds.com': '<html><body>Paldiski Kapellskar — no table</body></html>',
      'ctfassets.net': '%PDF-1.4 binary without timetable text',
    };
    await runFerrySchedule(deps(st, pages));
    expect(st.sailings.every((s) => s.source !== 'DFDS')).toBe(true);
    expect(st.risks.some((x) => String(x.dedup).startsWith('SOURCE_DOWN:DFDS_SCHEDULE:'))).toBe(true);
  });

  it('B1: prawdziwa tabela HTML DFDS → rejsy + SOURCE_DOWN MEDIUM (API bez rejsów, F7 #668 r7)', async () => {
    const st = new MemStore();
    const pages: Record<string, string | number> = {
      ...tallinkPages,
      'dfds.com': DFDS_HTML,
      'ctfassets.net': 503,
    };
    await runFerrySchedule(deps(st, pages));
    expect(st.sailings.some((s) => s.source === 'DFDS' && s.route === 'PLD-KPS')).toBe(true);
    const risk = st.risks.find((x) => String(x.dedup).startsWith('SOURCE_DOWN:DFDS_SCHEDULE:'));
    expect(risk).toMatchObject({ severity: 'MEDIUM', kind: 'FERRY' });
    expect(JSON.stringify(risk?.detail)).toMatch(/zapasu PDF/i);
  });

  it('#666: DFDS Dynamic API → rejsy PLD-KPS/KPS-PLD; HTML/PDF zbędne', async () => {
    const st = new MemStore();
    const both = JSON.parse(DFDS_API) as { pld_kps_week44: unknown[]; kps_pld_week44: unknown[] };
    let pageHits = 0;
    let pdfHits = 0;
    const apiBody = JSON.stringify([...both.pld_kps_week44, ...both.kps_pld_week44]);
    const f = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('api/timetable')) return new Response(apiBody, { status: 200 });
      if (url.includes('routes-and-schedules')) { pageHits += 1; return new Response('err', { status: 503 }); }
      if (url.includes('ctfassets.net')) { pdfHits += 1; return new Response('err', { status: 503 }); }
      const pages: Record<string, string | number> = { ...tallinkPages };
      const hit = Object.entries(pages).find(([k]) => url.includes(k));
      if (hit) {
        return typeof hit[1] === 'number'
          ? new Response('err', { status: hit[1] })
          : new Response(hit[1], { status: 200 });
      }
      if (url.includes('_jcr_content.timetable.')) return new Response('[]', { status: 200 });
      if (url.includes('ts.ee') || url.includes('portsofstockholm') || url.includes('stenalinefreight')) {
        return new Response('err', { status: 503 });
      }
      throw new Error(`nieoczekiwane: ${url}`);
    }) as typeof fetch;
    await runFerrySchedule({ store: st, fetch: f, env: {}, now: () => NOW });
    expect(st.sailings.some((s) => s.source === 'DFDS' && s.route === 'PLD-KPS')).toBe(true);
    expect(st.sailings.some((s) => s.source === 'DFDS' && s.route === 'KPS-PLD')).toBe(true);
    expect(st.risks.some((x) => String(x.dedup).startsWith('SOURCE_DOWN:DFDS_SCHEDULE:'))).toBe(false);
    /* F7 #668 r3 N2: przy pełnym API zero zapytań do strony/PDF */
    expect(pageHits).toBe(0);
    expect(pdfHits).toBe(0);
  });

  it('F7 #668 r5: API bez poniedziałku + kolejne tygodnie 503 → odwołany nie wraca; padnięte z PDF', async () => {
    const st = new MemStore();
    const both = JSON.parse(DFDS_API) as {
      pld_kps_week44: Array<{ scheduledDeparture?: string; portOfLoading?: string }>;
      kps_pld_week44: unknown[];
    };
    /* Tydzień 44 bez pon. 26.10 PLD — HTML/PDF ma Mon 22:00; nie może wrócić z zapasu. */
    const pldSansMon = both.pld_kps_week44.filter(
      (r) => !String(r.scheduledDeparture ?? '').startsWith('2026-10-26'),
    );
    expect(pldSansMon.length).toBeLessThan(both.pld_kps_week44.length);
    const week1Start = '2026-10-26';
    let pageHits = 0;
    let pdfHits = 0;
    const f = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('api/timetable')) {
        const u = new URL(url);
        const from = u.searchParams.get('dateFrom') ?? '';
        const load = u.searchParams.get('portOfLoading') ?? '';
        if (from.startsWith(week1Start)) {
          const body = load === 'EEPLN' ? pldSansMon : both.kps_pld_week44;
          return new Response(JSON.stringify(body), { status: 200 });
        }
        return new Response('err', { status: 503 });
      }
      if (url.includes('routes-and-schedules')) {
        pageHits += 1;
        return new Response(DFDS_HTML, { status: 200 });
      }
      if (url.includes('ctfassets.net')) {
        pdfHits += 1;
        return new Response(DFDS_HTML, { status: 200 });
      }
      const pages: Record<string, string | number> = { ...tallinkPages };
      const hit = Object.entries(pages).find(([k]) => url.includes(k));
      if (hit) {
        return typeof hit[1] === 'number'
          ? new Response('err', { status: hit[1] })
          : new Response(hit[1], { status: 200 });
      }
      if (url.includes('_jcr_content.timetable.')) return new Response('[]', { status: 200 });
      if (url.includes('ts.ee') || url.includes('portsofstockholm') || url.includes('stenalinefreight')) {
        return new Response('err', { status: 503 });
      }
      throw new Error(`nieoczekiwane: ${url}`);
    }) as typeof fetch;
    await runFerrySchedule({ store: st, fetch: f, env: {}, now: () => NOW });
    const dfds = st.sailings.filter((s) => s.source === 'DFDS');
    expect(dfds.some((s) => s.route === 'PLD-KPS')).toBe(true);
    /* Odwołany pon. 26.10 z API — HTML Mon 22:00 nie wraca (tydzień OK, nie failedWindow). */
    expect(dfds.every((s) => !s.departure_at.startsWith('2026-10-26T20:00'))).toBe(true);
    /* Kolejne tygodnie 503 → uzupełnione z HTML (np. pon. 02.11 22:00 EET = 20:00Z). */
    expect(dfds.some((s) => s.route === 'PLD-KPS' && s.departure_at.startsWith('2026-11-02T20:00'))).toBe(true);
    expect(pageHits + pdfHits).toBeGreaterThan(0);
    expect(st.risks.some((x) => String(x.dedup).startsWith('SOURCE_DOWN:DFDS_SCHEDULE:'))).toBe(false);
  });

  it('F7 #668 r6: jeden pusty tydzień [] + reszta OK → ostrzeżenie, bez PDF', async () => {
    const st = new MemStore();
    const both = JSON.parse(DFDS_API) as { pld_kps_week44: unknown[]; kps_pld_week44: unknown[] };
    const week1Start = '2026-10-26';
    let pageHits = 0;
    const f = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('api/timetable')) {
        const u = new URL(url);
        const from = u.searchParams.get('dateFrom') ?? '';
        const load = u.searchParams.get('portOfLoading') ?? '';
        if (from.startsWith(week1Start)) {
          return new Response('[]', { status: 200 });
        }
        if (from.startsWith('2026-11-02')) {
          const body = load === 'EEPLN' ? both.pld_kps_week44 : both.kps_pld_week44;
          return new Response(JSON.stringify(body), { status: 200 });
        }
        return new Response(JSON.stringify(load === 'EEPLN' ? both.pld_kps_week44 : both.kps_pld_week44), {
          status: 200,
        });
      }
      if (url.includes('routes-and-schedules') || url.includes('ctfassets.net')) {
        pageHits += 1;
        return new Response(DFDS_HTML, { status: 200 });
      }
      const pages: Record<string, string | number> = { ...tallinkPages };
      const hit = Object.entries(pages).find(([k]) => url.includes(k));
      if (hit) {
        return typeof hit[1] === 'number'
          ? new Response('err', { status: hit[1] })
          : new Response(hit[1], { status: 200 });
      }
      if (url.includes('_jcr_content.timetable.')) return new Response('[]', { status: 200 });
      if (url.includes('ts.ee') || url.includes('portsofstockholm') || url.includes('stenalinefreight')) {
        return new Response('err', { status: 503 });
      }
      throw new Error(`nieoczekiwane: ${url}`);
    }) as typeof fetch;
    const out = await runFerrySchedule({ store: st, fetch: f, env: {}, now: () => NOW });
    expect(pageHits).toBe(0);
    expect(out.warnings.some((w) => /API pusty tydzień/i.test(w))).toBe(true);
    expect(st.sailings.every((s) => !s.departure_at.startsWith('2026-10-26T20:00'))).toBe(true);
    expect(st.risks.some((x) => String(x.dedup).startsWith('SOURCE_DOWN:DFDS_SCHEDULE:'))).toBe(false);
  });

  it('F7 #668 r7: wszystkie []/{} → PDF + SOURCE_DOWN MEDIUM; API OK → zamknięte', async () => {
    const both = JSON.parse(DFDS_API) as { pld_kps_week44: unknown[]; kps_pld_week44: unknown[] };
    const runWith = async (body: string) => {
      const st = new MemStore();
      let pdfHits = 0;
      const f = (async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('api/timetable')) return new Response(body, { status: 200 });
        if (url.includes('routes-and-schedules')) {
          return new Response(
            `<html><body><a href="https://downloads.ctfassets.net/x/dfds.pdf">pdf</a>${DFDS_HTML}</body></html>`,
            { status: 200 },
          );
        }
        if (url.includes('ctfassets.net') || url.includes('dfds.pdf')) {
          pdfHits += 1;
          return new Response(DFDS_HTML, { status: 200 });
        }
        const pages: Record<string, string | number> = { ...tallinkPages };
        const hit = Object.entries(pages).find(([k]) => url.includes(k));
        if (hit) {
          return typeof hit[1] === 'number'
            ? new Response('err', { status: hit[1] })
            : new Response(hit[1], { status: 200 });
        }
        if (url.includes('_jcr_content.timetable.')) return new Response('[]', { status: 200 });
        if (url.includes('ts.ee') || url.includes('portsofstockholm') || url.includes('stenalinefreight')) {
          return new Response('err', { status: 503 });
        }
        throw new Error(`nieoczekiwane: ${url}`);
      }) as typeof fetch;
      const out = await runFerrySchedule({ store: st, fetch: f, env: {}, now: () => NOW });
      return { st, out, pdfHits };
    };

    /* Decyzja 50 / F7 r7: zapas PDF ≠ źródło sprawne — SOURCE_DOWN MEDIUM przy 0 rejsów z API. */
    const empty = await runWith('[]');
    expect(empty.pdfHits).toBeGreaterThan(0);
    expect(empty.st.sailings.some((s) => s.source === 'DFDS')).toBe(true);
    const emptyRisk = empty.st.risks.find((x) => String(x.dedup).startsWith('SOURCE_DOWN:DFDS_SCHEDULE:'));
    expect(emptyRisk).toMatchObject({ severity: 'MEDIUM', kind: 'FERRY' });
    expect(JSON.stringify(emptyRisk?.detail)).toMatch(/zapasu PDF/i);

    const bad = await runWith('{}');
    expect(bad.pdfHits).toBeGreaterThan(0);
    expect(bad.st.sailings.some((s) => s.source === 'DFDS')).toBe(true);
    expect(bad.out.warnings.some((w) => /oczekiwano tablicy/i.test(w))).toBe(true);
    const badRisk = bad.st.risks.find((x) => String(x.dedup).startsWith('SOURCE_DOWN:DFDS_SCHEDULE:'));
    expect(badRisk).toMatchObject({ severity: 'MEDIUM', kind: 'FERRY' });
    expect(JSON.stringify(badRisk?.detail)).toMatch(/zapasu PDF/i);

    /* PDF bez rejsów (strona pusta) → SOURCE_DOWN + „oczekiwano tablicy”. */
    {
      const st = new MemStore();
      const f = (async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('api/timetable')) return new Response('{}', { status: 200 });
        if (url.includes('routes-and-schedules') || url.includes('ctfassets.net') || url.includes('dfds.pdf')) {
          return new Response('<html><body>brak tabeli</body></html>', { status: 200 });
        }
        const pages: Record<string, string | number> = { ...tallinkPages };
        const hit = Object.entries(pages).find(([k]) => url.includes(k));
        if (hit) {
          return typeof hit[1] === 'number'
            ? new Response('err', { status: hit[1] })
            : new Response(hit[1], { status: 200 });
        }
        if (url.includes('_jcr_content.timetable.')) return new Response('[]', { status: 200 });
        if (url.includes('ts.ee') || url.includes('portsofstockholm') || url.includes('stenalinefreight')) {
          return new Response('err', { status: 503 });
        }
        throw new Error(`nieoczekiwane: ${url}`);
      }) as typeof fetch;
      const out = await runFerrySchedule({ store: st, fetch: f, env: {}, now: () => NOW });
      expect(st.sailings.every((s) => s.source !== 'DFDS')).toBe(true);
      expect(out.warnings.some((w) => /oczekiwano tablicy/i.test(w))).toBe(true);
      expect(st.risks.some((x) => String(x.dedup).startsWith('SOURCE_DOWN:DFDS_SCHEDULE:'))).toBe(true);
    }

    /* Niepusta tablica bez rozpoznanych tras → jak struktura (failedWindow + PDF). */
    const junk = await runWith(JSON.stringify([{ portOfLoading: 'XX', portOfDischarge: 'YY', vehicleName: 'X' }]));
    expect(junk.pdfHits).toBeGreaterThan(0);
    expect(junk.out.warnings.some((w) => /nieznana trasa|Struktura/i.test(w))).toBe(true);
    expect(junk.st.risks.some((x) => String(x.dedup).startsWith('SOURCE_DOWN:DFDS_SCHEDULE:'))).toBe(true);

    /* Potem API OK → SOURCE_DOWN zamknięte. */
    const stOk = new MemStore();
    stOk.risks.push({
      kind: 'FERRY', severity: 'MEDIUM', title: 'x', titleKey: 'rk_source_down', params: {},
      detail: {}, dedup: `SOURCE_DOWN:DFDS_SCHEDULE:${NOW.toISOString().slice(0, 10)}`, sourceUrl: null,
    });
    const fOk = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('api/timetable')) {
        const u = new URL(url);
        const load = u.searchParams.get('portOfLoading') ?? '';
        const body = load === 'EEPLN' ? both.pld_kps_week44 : both.kps_pld_week44;
        return new Response(JSON.stringify(body), { status: 200 });
      }
      if (url.includes('routes-and-schedules') || url.includes('ctfassets.net')) {
        throw new Error('PDF nie powinien być pobrany przy API OK');
      }
      const pages: Record<string, string | number> = { ...tallinkPages };
      const hit = Object.entries(pages).find(([k]) => url.includes(k));
      if (hit) {
        return typeof hit[1] === 'number'
          ? new Response('err', { status: hit[1] })
          : new Response(hit[1], { status: 200 });
      }
      if (url.includes('_jcr_content.timetable.')) return new Response('[]', { status: 200 });
      if (url.includes('ts.ee') || url.includes('portsofstockholm') || url.includes('stenalinefreight')) {
        return new Response('err', { status: 503 });
      }
      throw new Error(`nieoczekiwane: ${url}`);
    }) as typeof fetch;
    await runFerrySchedule({ store: stOk, fetch: fOk, env: {}, now: () => NOW });
    expect(stOk.risks.some((x) => String(x.dedup).startsWith('SOURCE_DOWN:DFDS_SCHEDULE:'))).toBe(false);
    expect(stOk.sailings.some((s) => s.source === 'DFDS')).toBe(true);
  });

  it('F7 #668 r7 B1: tydzień 1 PLD {} / junk + reszta OK → PDF + częściowa awaria 19/20', async () => {
    const both = JSON.parse(DFDS_API) as { pld_kps_week44: unknown[]; kps_pld_week44: unknown[] };
    const week1Start = '2026-10-26';
    const runMixed = async (badBody: string) => {
      const st = new MemStore();
      let pageHits = 0;
      let pdfHits = 0;
      const f = (async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('api/timetable')) {
          const u = new URL(url);
          const from = u.searchParams.get('dateFrom') ?? '';
          const load = u.searchParams.get('portOfLoading') ?? '';
          if (from.startsWith(week1Start) && load === 'EEPLN') {
            return new Response(badBody, { status: 200 });
          }
          const body = load === 'EEPLN' ? both.pld_kps_week44 : both.kps_pld_week44;
          return new Response(JSON.stringify(body), { status: 200 });
        }
        if (url.includes('routes-and-schedules')) {
          pageHits += 1;
          return new Response(
            `<html><body><a href="https://downloads.ctfassets.net/x/dfds.pdf">pdf</a>${DFDS_HTML}</body></html>`,
            { status: 200 },
          );
        }
        if (url.includes('ctfassets.net') || url.includes('dfds.pdf')) {
          pdfHits += 1;
          return new Response(DFDS_HTML, { status: 200 });
        }
        const pages: Record<string, string | number> = { ...tallinkPages };
        const hit = Object.entries(pages).find(([k]) => url.includes(k));
        if (hit) {
          return typeof hit[1] === 'number'
            ? new Response('err', { status: hit[1] })
            : new Response(hit[1], { status: 200 });
        }
        if (url.includes('_jcr_content.timetable.')) return new Response('[]', { status: 200 });
        if (url.includes('ts.ee') || url.includes('portsofstockholm') || url.includes('stenalinefreight')) {
          return new Response('err', { status: 503 });
        }
        throw new Error(`nieoczekiwane: ${url}`);
      }) as typeof fetch;
      const out = await runFerrySchedule({ store: st, fetch: f, env: {}, now: () => NOW });
      return { st, out, pageHits, pdfHits };
    };

    const junkHours = JSON.stringify([{
      portOfLoading: 'EEPLN', portOfDischarge: 'SEKPS', vehicleName: 'Sirena Seaways',
      scheduledDeparture: 'not-a-date', scheduledArrival: 'also-bad',
    }]);
    for (const badBody of ['{}', JSON.stringify([{ portOfLoading: 'XX', portOfDischarge: 'YY', vehicleName: 'X' }]), junkHours]) {
      const r = await runMixed(badBody);
      expect(r.pageHits + r.pdfHits).toBeGreaterThan(0);
      expect(r.out.warnings.some((w) => /częściowa awaria API \(19\/20\)/i.test(w))).toBe(true);
      /* Okno padnięte: PLD tydzień 1 — rejs z PDF w tym zakresie (po filtrze). */
      expect(r.st.sailings.some((s) => s.source === 'DFDS' && s.departure_at >= '2026-10-26' && s.departure_at < '2026-11-02')).toBe(true);
      expect(r.st.risks.some((x) => String(x.dedup).startsWith('SOURCE_DOWN:DFDS_SCHEDULE:'))).toBe(false);
      if (badBody === junkHours) {
        expect(r.out.warnings.some((w) => /nieczytelne godziny/i.test(w))).toBe(true);
      }
    }
  });

  it('F7 #668 r5: DFDS — odwołany rejs z tygodnia API nie wraca z PDF; 503 → uzupełnienie', async () => {
    const st = new MemStore();
    const both = JSON.parse(DFDS_API) as { pld_kps_week44: Record<string, unknown>[]; kps_pld_week44: Record<string, unknown>[] };
    const removed = both.pld_kps_week44[0]!;
    const removedDep = String(removed.scheduledDeparture);
    const week1Body = JSON.stringify([
      ...both.pld_kps_week44.slice(1),
      ...both.kps_pld_week44,
    ]);
    let pdfHits = 0;
    const f = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('api/timetable')) {
        /* Pierwszy tydzień (dateFrom ≈ 2026-10-26) → API bez jednego rejsu; kolejne → 503 */
        if (url.includes('2026-10-26') || url.includes('dateFrom=2026-10-26')) {
          return new Response(week1Body, { status: 200 });
        }
        /* parse dateFrom from query */
        const m = url.match(/dateFrom=([^&]+)/);
        const from = m ? decodeURIComponent(m[1]!) : '';
        if (from.startsWith('2026-10-26') || from.startsWith('2026-10-25')) {
          return new Response(week1Body, { status: 200 });
        }
        return new Response('err', { status: 503 });
      }
      if (url.includes('routes-and-schedules')) {
        return new Response(`<html><body><a href="https://downloads.ctfassets.net/x/dfds.pdf">pdf</a>${DFDS_HTML}</body></html>`, { status: 200 });
      }
      if (url.includes('ctfassets.net') || url.includes('dfds.pdf')) {
        pdfHits += 1;
        return new Response(DFDS_HTML, { status: 200 });
      }
      const pages: Record<string, string | number> = { ...tallinkPages };
      const hit = Object.entries(pages).find(([k]) => url.includes(k));
      if (hit) {
        return typeof hit[1] === 'number'
          ? new Response('err', { status: hit[1] })
          : new Response(hit[1], { status: 200 });
      }
      if (url.includes('_jcr_content.timetable.')) return new Response('[]', { status: 200 });
      if (url.includes('ts.ee') || url.includes('portsofstockholm') || url.includes('stenalinefreight')) {
        return new Response('err', { status: 503 });
      }
      throw new Error(`nieoczekiwane: ${url}`);
    }) as typeof fetch;
    await runFerrySchedule({ store: st, fetch: f, env: {}, now: () => NOW });
    const dfds = st.sailings.filter((s) => s.source === 'DFDS');
    expect(dfds.length).toBeGreaterThan(0);
    /* Odwołany z tygodnia 1 (API) nie wraca z PDF mimo że PDF ma ten dzień */
    const removedUtc = new Date(removedDep).toISOString();
    expect(dfds.some((s) => s.departure_at === removedUtc)).toBe(false);
    /* Kolejne tygodnie (503) uzupełnione z PDF — rejsy po horyzoncie week1 */
    expect(dfds.some((s) => s.departure_at >= '2026-11-03')).toBe(true);
    expect(pdfHits).toBeGreaterThan(0);
  });

  it('B2: odwołanie dziś nie oznacza jutrzejszego rejsu o tej godzinie', async () => {
    const st = new MemStore();
    st.sailings.push(
      {
        id: 'today', vessel_id: MYST, route: 'TLL-HEL',
        departure_at: '2026-10-30T05:30:00.000Z', arrival_at: '2026-10-30T07:30:00.000Z',
        delayed_departure_at: null, delayed_arrival_at: null,
        actual_departure_at: null, actual_arrival_at: null,
        status: 'ZAPLANOWANY', source: 'TALLINK',
      },
      {
        id: 'tomorrow', vessel_id: MYST, route: 'TLL-HEL',
        departure_at: '2026-10-31T05:30:00.000Z', arrival_at: '2026-10-31T07:30:00.000Z',
        delayed_departure_at: null, delayed_arrival_at: null,
        actual_departure_at: null, actual_arrival_at: null,
        status: 'ZAPLANOWANY', source: 'TALLINK',
      },
    );
    const html = `<!DOCTYPE html><html><body>
<table class="table" id="passenger-lines-outbound"><tbody>
<tr data-terminal="d" data-from_to="helsinki" data-company="tallink">
<td data-sort_value="07:30">07:30</td>
<td data-sort_value="MYSTAR">MYSTAR</td>
<td data-sort_value="Tallinn">Tallinn</td>
<td data-sort_value="Helsinki">Helsinki</td>
<td data-sort_value="D">Terminal D</td>
<td data-sort_value="Tallink">Tallink</td>
<td data-sort_value="Cancelled">Cancelled</td>
</tr></tbody></table>
<table class="table" id="passenger-lines-inbound"><tbody></tbody></table>
</body></html>`;
    const pages: Record<string, string | number> = {
      ...basePages,
      'api/timetables': 503,
      'ts.ee/en/departures': html,
      'ts.ee/en/arrivals': html,
    };
    await runFerrySchedule(deps(st, pages));
    expect(st.sailings.find((s) => s.id === 'today')).toMatchObject({ status: 'ODWOLANY' });
    expect(st.sailings.find((s) => s.id === 'tomorrow')).toMatchObject({ status: 'ZAPLANOWANY' });
  });
});

const HEL_TLL_JSON = JSON.stringify({
  trips: {
    '2026-10-30': {
      outwards: [{
        cityFrom: 'HEL', cityTo: 'TAL', pierFrom: 'LSA2', pierTo: 'DTER',
        shipCode: 'MEGASTAR', departureIsoDate: '2026-10-30T07:30', arrivalIsoDate: '2026-10-30T09:30',
        sailId: 1, sailPackageCode: 'HEL-TAL', sailPackageName: 'Helsinki-Tallinn',
      }],
    },
  },
});

const TLL_STO_QUEEN = JSON.stringify({
  trips: {
    '2026-10-31': {
      outwards: [{
        cityFrom: 'TAL', cityTo: 'STO', pierFrom: 'DTER', pierTo: 'VHAM',
        shipCode: 'QUEEN', departureIsoDate: '2026-10-31T18:00', arrivalIsoDate: '2026-11-01T10:00',
        sailId: 2, sailPackageCode: 'TAL-STO', sailPackageName: 'Tallinn-Stockholm',
      }],
    },
  },
});

describe('F7 #661 B3 Tallink oba kierunki + Viking/Eckerö joby', () => {
  it('B3: Tallink TLL-HEL + HEL-TLL + QUEEN TLL-STO w jednym przebiegu', async () => {
    const st = new MemStore();
    const pages: Record<string, string | number> = {
      ...basePages,
      'from=tal&to=hel': TALLINK,
      'from=hel&to=tal': HEL_TLL_JSON,
      'from=tal&to=sto': TLL_STO_QUEEN,
      'from=sto&to=tal': 503,
    };
    await runFerrySchedule(deps(st, pages));
    expect(st.sailings.some((s) => s.source === 'TALLINK' && s.route === 'TLL-HEL')).toBe(true);
    expect(st.sailings.some((s) => s.source === 'TALLINK' && s.route === 'HEL-TLL')).toBe(true);
    expect(st.sailings.some((s) => s.source === 'TALLINK' && s.route === 'TLL-STO')).toBe(true);
    expect(st.risks.some((x) => String(x.dedup).startsWith('SOURCE_DOWN:TALLINK_SCHEDULE:'))).toBe(false);
  });

  it('Decyzja 50: Viking Cargo+sales 403 → SOURCE_DOWN MEDIUM (bez rejsów VIKING)', async () => {
    const st = new MemStore();
    const pages: Record<string, string | number> = {
      ...tallinkPages,
      'viking-line-cargo': 403,
      'sales.vikingline.com': 403,
      'eckeroline.com': 503,
      'dfds.com': 503,
      'ctfassets.net': 503,
    };
    await runFerrySchedule(deps(st, pages));
    expect(st.sailings.every((s) => s.source !== 'VIKING')).toBe(true);
    const vk = st.risks.find((x) => String(x.dedup).startsWith('SOURCE_DOWN:VIKING_SCHEDULE:'));
    expect(vk).toMatchObject({ severity: 'MEDIUM', kind: 'FERRY' });
    expect(st.risks.some((x) => String(x.dedup).startsWith('SOURCE_DOWN:TALLINK_SCHEDULE:'))).toBe(false);
  });

  it('F7 #690 R2-B4/63c: Cargo 403 + pokrycie 29 d → SOURCE_DOWN; 30 d → resolve', async () => {
    const pages: Record<string, string | number> = {
      ...tallinkPages,
      'viking-line-cargo': 403,
      'sales.vikingline.com': 403,
      'eckeroline.com': 503,
      'dfds.com': 503,
      'ctfassets.net': 503,
    };
    const st29 = new MemStore();
    st29.sailings.push({
      id: 'vk-29',
      vessel_id: 'v-xprs',
      route: 'TLLA-HEL',
      departure_at: '2026-11-28T12:00:00.000Z',
      arrival_at: '2026-11-28T14:30:00.000Z',
      delayed_departure_at: null,
      delayed_arrival_at: null,
      status: 'ZAPLANOWANY',
      source: 'VIKING',
      source_ref: null,
    });
    await runFerrySchedule(deps(st29, pages));
    expect(st29.risks.some((x) => String(x.dedup).startsWith('SOURCE_DOWN:VIKING_SCHEDULE:'))).toBe(true);

    const st30 = new MemStore();
    st30.sailings.push({
      id: 'vk-30',
      vessel_id: 'v-xprs',
      route: 'TLLA-HEL',
      departure_at: '2026-11-29T12:00:00.000Z',
      arrival_at: '2026-11-29T14:30:00.000Z',
      delayed_departure_at: null,
      delayed_arrival_at: null,
      status: 'ZAPLANOWANY',
      source: 'VIKING',
      source_ref: null,
    });
    st30.risks.push({
      kind: 'FERRY',
      severity: 'MEDIUM',
      title: 'Źródło niedostępne',
      dedup: 'SOURCE_DOWN:VIKING_SCHEDULE:x',
    });
    await runFerrySchedule(deps(st30, pages));
    expect(st30.risks.some((x) => String(x.dedup).startsWith('SOURCE_DOWN:VIKING_SCHEDULE:'))).toBe(false);
  });

  it('#666 A: Cargo OK → rejsy VIKING mimo sales 403; Eckerö SOURCE_DOWN', async () => {
    const st = new MemStore();
    const pages: Record<string, string | number> = {
      ...tallinkPages,
      'viking-line-cargo': VIKING_CARGO_HTML,
      'sales.vikingline.com': 403,
      'eckeroline.com': 503,
      'dfds.com': 503,
      'ctfassets.net': 503,
    };
    await runFerrySchedule(deps(st, pages));
    expect(st.sailings.some((s) => s.source === 'VIKING' && (s.route === 'TLLA-HEL' || s.route === 'HELA-TLL'))).toBe(true);
    expect(st.risks.some((x) => String(x.dedup).startsWith('SOURCE_DOWN:ECKERO_SCHEDULE:'))).toBe(true);
    expect(st.risks.some((x) => String(x.dedup).startsWith('SOURCE_DOWN:VIKING_SCHEDULE:'))).toBe(false);
  });

  it('#666 A: Cargo 403 + sales HTML → zapas; idempotencja', async () => {
    const st = new MemStore();
    const pages: Record<string, string | number> = {
      ...tallinkPages,
      'viking-line-cargo': 403,
      'sales.vikingline.com': VIKING_HTML,
      'eckeroline.com': 503,
      'dfds.com': 503,
      'ctfassets.net': 503,
    };
    await runFerrySchedule(deps(st, pages));
    const n1 = st.sailings.filter((s) => s.source === 'VIKING').length;
    expect(n1).toBeGreaterThan(0);
    const r2 = await runFerrySchedule(deps(st, pages));
    expect(st.sailings.filter((s) => s.source === 'VIKING')).toHaveLength(n1);
    expect(r2.inserted).toBe(0);
  });

  it('Viking + PoT: bez duplikatu; RECZNIE Viking/Eckerö nietknięte przy odwołaniu', async () => {
    const st = new MemStore();
    st.sailings.push(
      {
        id: 'recz-vk', vessel_id: 'v-xprs', route: 'TLLA-HEL',
        departure_at: '2026-10-30T01:30:00.000Z', arrival_at: '2026-10-30T03:30:00.000Z',
        delayed_departure_at: null, delayed_arrival_at: null,
        actual_departure_at: null, actual_arrival_at: null,
        status: 'ZAPLANOWANY', source: 'RECZNIE',
      },
      {
        id: 'recz-ec', vessel_id: 'v-fin', route: 'TLLA-HEL',
        departure_at: '2026-10-30T04:00:00.000Z', arrival_at: '2026-10-30T06:00:00.000Z',
        delayed_departure_at: null, delayed_arrival_at: null,
        actual_departure_at: null, actual_arrival_at: null,
        status: 'ZAPLANOWANY', source: 'RECZNIE',
      },
    );
    const cancelHtml = `<!DOCTYPE html><html><body>
<table class="table" id="passenger-lines-outbound"><tbody>
<tr data-terminal="a" data-from_to="helsinki" data-company="viking_line_abp">
<td data-sort_value="03:30">03:30</td>
<td data-sort_value="VIKING XPRS">VIKING XPRS</td>
<td data-sort_value="Tallinn">Tallinn</td>
<td data-sort_value="Helsinki">Helsinki</td>
<td data-sort_value="A">Terminal A</td>
<td data-sort_value="Viking Line Abp">Viking Line Abp</td>
<td data-sort_value="Cancelled">Cancelled</td>
</tr>
<tr data-terminal="a" data-from_to="helsinki" data-company="eckeroe_line_ab_oy">
<td data-sort_value="06:00">06:00</td>
<td data-sort_value="FINLANDIA">FINLANDIA</td>
<td data-sort_value="Tallinn">Tallinn</td>
<td data-sort_value="Helsinki">Helsinki</td>
<td data-sort_value="A">Terminal A</td>
<td data-sort_value="Eckero">Eckero</td>
<td data-sort_value="Cancelled">Cancelled</td>
</tr>
</tbody></table>
<table class="table" id="passenger-lines-inbound"><tbody></tbody></table>
</body></html>`;
    const pages: Record<string, string | number> = {
      ...tallinkPages,
      'viking-line-cargo': VIKING_CARGO_HTML,
      'sales.vikingline.com': 403,
      'eckeroline.com': 503,
      'dfds.com': 503,
      'ctfassets.net': 503,
      'ts.ee/en/departures': cancelHtml,
      'ts.ee/en/arrivals': cancelHtml,
    };
    await runFerrySchedule(deps(st, pages));
    const vikingKeys = st.sailings
      .filter((s) => s.source === 'VIKING')
      .map((s) => `${s.vessel_id}|${s.departure_at}`);
    expect(new Set(vikingKeys).size).toBe(vikingKeys.length);
    expect(st.sailings.filter((s) => s.source === 'VIKING').length).toBeGreaterThan(0);
    expect(st.sailings.find((s) => s.id === 'recz-vk')).toMatchObject({
      status: 'ZAPLANOWANY', source: 'RECZNIE',
      departure_at: '2026-10-30T01:30:00.000Z',
    });
    expect(st.sailings.find((s) => s.id === 'recz-ec')).toMatchObject({
      status: 'ZAPLANOWANY', source: 'RECZNIE',
      departure_at: '2026-10-30T04:00:00.000Z',
    });
  });
});

describe('#666 F7 Stena 60 d — równoległość i SOURCE_DOWN tylko przy totalnej awarii', () => {
  const STENA_JSON = fx('stena-timetable-gdka-2026-10-01.json');

  it('częściowa awaria dni Steny → bez SOURCE_DOWN; max 4 równoległe', async () => {
    const st = new MemStore();
    let inFlight = 0;
    let maxFlight = 0;
    let stenaHits = 0;
    const f = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('_jcr_content.timetable.')) {
        inFlight += 1;
        maxFlight = Math.max(maxFlight, inFlight);
        stenaHits += 1;
        await new Promise((r) => setTimeout(r, 5));
        inFlight -= 1;
        // co 7. zapytanie 503 — reszta pusta tablica (OK)
        if (stenaHits % 7 === 0) return new Response('err', { status: 503 });
        return new Response('[]', { status: 200 });
      }
      if (url.includes('cargo/rozklad')) return new Response(CARGO, { status: 200 });
      if (url.includes('viking-line-cargo') || url.includes('sales.vikingline.com')) {
        return new Response('err', { status: 503 });
      }
      if (url.includes('api/timetables')) return new Response(TALLINK, { status: 200 });
      if (url.includes('eckeroline') || url.includes('dfds.com') || url.includes('ctfassets')) {
        return new Response('err', { status: 503 });
      }
      if (url.includes('ts.ee') || url.includes('portsofstockholm') || url.includes('stenalinefreight')) {
        return new Response('err', { status: 503 });
      }
      throw new Error(`nieoczekiwane: ${url}`);
    }) as typeof fetch;
    const r = await runFerrySchedule({ store: st, fetch: f, env: {}, now: () => NOW });
    expect(r.ok).toBe(true);
    expect(stenaHits).toBe(120); // 60 d × 2 trasy
    expect(maxFlight).toBeLessThanOrEqual(4);
    expect(st.risks.some((x) => String(x.dedup).startsWith('SOURCE_DOWN:STENA_SCHEDULE:'))).toBe(false);
  });

  it('całkowita awaria Steny → SOURCE_DOWN; jeden dzień OK → bez SOURCE_DOWN', async () => {
    const stFail = new MemStore();
    await runFerrySchedule(deps(stFail, {
      ...tallinkPages,
      '_jcr_content.timetable.': 503,
      'eckeroline.com': 503,
      'dfds.com': 503,
      'ctfassets.net': 503,
    }));
    expect(stFail.risks.some((x) => String(x.dedup).startsWith('SOURCE_DOWN:STENA_SCHEDULE:'))).toBe(true);

    const stOk = new MemStore();
    let n = 0;
    const f = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('_jcr_content.timetable.')) {
        n += 1;
        // pierwszy dzień GDKA z prawdziwym JSON; reszta pusta / jedna 503
        if (n === 1) return new Response(STENA_JSON.replaceAll('2026-10-01', '2026-10-30'), { status: 200 });
        if (n === 2) return new Response('err', { status: 503 });
        return new Response('[]', { status: 200 });
      }
      if (url.includes('cargo/rozklad')) return new Response(CARGO, { status: 200 });
      if (url.includes('from=tal&to=hel')) return new Response(TALLINK, { status: 200 });
      if (url.includes('api/timetables') || url.includes('from=')) return new Response('err', { status: 503 });
      if (url.includes('viking') || url.includes('eckeroline') || url.includes('dfds') || url.includes('ctfassets')) {
        return new Response('err', { status: 503 });
      }
      if (url.includes('ts.ee') || url.includes('portsofstockholm') || url.includes('stenalinefreight')) {
        return new Response('err', { status: 503 });
      }
      throw new Error(`nieoczekiwane: ${url}`);
    }) as typeof fetch;
    await runFerrySchedule({ store: stOk, fetch: f, env: {}, now: () => NOW });
    expect(stOk.risks.some((x) => String(x.dedup).startsWith('SOURCE_DOWN:STENA_SCHEDULE:'))).toBe(false);
  });

  it('F7 #668 r3/r4 N9: budżet z wstrzykniętym zegarem; bez SOURCE_DOWN gdy coś pobrano', async () => {
    const STENA_JSON = fx('stena-timetable-gdka-2026-10-01.json');
    let n = 0;
    let tick = 0;
    const wallNow = () => {
      tick += 1;
      /* start=0; po 4. sprawdzeniu budżetu → ponad limit (symulacja bez Date.now). */
      return tick <= 5 ? 0 : 100_000;
    };
    const f = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('_jcr_content.timetable.')) {
        n += 1;
        return new Response(STENA_JSON.replaceAll('2026-10-01', '2026-10-30'), { status: 200 });
      }
      throw new Error(`nieoczekiwane: ${url}`);
    }) as typeof fetch;
    const r = await fetchStenaDays(
      { store: new MemStore(), fetch: f, env: {}, now: () => NOW },
      8,
      90_000,
      wallNow,
    );
    expect(r.warnings.some((w) => /przerwano/i.test(w) && /trasa×dzień|trasaxdzień|pobrań/i.test(w))).toBe(true);
    expect(r.fetchedOk).toBeGreaterThan(0);
    expect(n).toBeLessThan(16);
    expect(r.fetchedOk === 0).toBe(false);
  });
});

describe('#685-a Digitraffic Viking near schedule (decyzja 63a)', () => {
  it('HTML 403 + Portnet XPRS ES → rejsy VIKING; SOURCE_DOWN zostaje', async () => {
    const st = new MemStore();
    const pages: Record<string, string | number> = {
      ...tallinkPages,
      'viking-line-cargo': 403,
      'sales.vikingline.com': 403,
      'port-calls': PORTNET_XPRS_ES,
      'eckeroline.com': 503,
      'dfds.com': 503,
      'ctfassets.net': 503,
    };
    await runFerrySchedule(deps(st, pages));
    const vk = st.sailings.filter((s) => s.source === 'VIKING');
    expect(vk.some((s) => s.route === 'TLLA-HEL')).toBe(true);
    expect(vk.some((s) => s.route === 'HELA-TLL')).toBe(true);
    expect(vk.length).toBeGreaterThanOrEqual(4);
    expect(st.risks.some((x) => String(x.dedup).startsWith('SOURCE_DOWN:VIKING_SCHEDULE:'))).toBe(true);
  });

  it('F7 #690 R2-B4/63c: 403 Viking — pokrycie 29 d → SOURCE_DOWN; 30 d → resolve', async () => {
    const pages403: Record<string, string | number> = {
      ...tallinkPages,
      'viking-line-cargo': 403,
      'sales.vikingline.com': 403,
      'port-calls': 503,
      'eckeroline.com': 503,
      'dfds.com': 503,
      'ctfassets.net': 503,
    };
    const st29 = new MemStore();
    st29.sailings.push({
      id: 'cov-29', vessel_id: 'v-xprs', route: 'TLLA-HEL',
      departure_at: new Date(NOW.getTime() + 29 * 864e5).toISOString(),
      arrival_at: new Date(NOW.getTime() + 29 * 864e5 + 2.5 * 3600e3).toISOString(),
      delayed_departure_at: null, delayed_arrival_at: null,
      actual_departure_at: null, actual_arrival_at: null,
      status: 'ZAPLANOWANY', source: 'VIKING', source_ref: null,
    });
    await runFerrySchedule(deps(st29, pages403));
    expect(st29.risks.some((x) => String(x.dedup).startsWith('SOURCE_DOWN:VIKING_SCHEDULE:'))).toBe(true);

    const st30 = new MemStore();
    st30.sailings.push({
      id: 'cov-30', vessel_id: 'v-xprs', route: 'TLLA-HEL',
      departure_at: new Date(NOW.getTime() + 30 * 864e5).toISOString(),
      arrival_at: new Date(NOW.getTime() + 30 * 864e5 + 2.5 * 3600e3).toISOString(),
      delayed_departure_at: null, delayed_arrival_at: null,
      actual_departure_at: null, actual_arrival_at: null,
      status: 'ZAPLANOWANY', source: 'VIKING', source_ref: null,
    });
    st30.risks.push({
      kind: 'FERRY', severity: 'MEDIUM', title: 'x', titleKey: 'x', params: {},
      detail: {}, dedup: `SOURCE_DOWN:VIKING_SCHEDULE:${NOW.toISOString().slice(0, 10)}`,
    });
    await runFerrySchedule(deps(st30, pages403));
    expect(st30.risks.some((x) => String(x.dedup).startsWith('SOURCE_DOWN:VIKING_SCHEDULE:'))).toBe(false);
  });

  it('RECZNIE w oknie ±30 min — bez nadpisania; manualKept ≥ 1', async () => {
    const st = new MemStore();
    /* HELA-TLL z ETD 08:30 — departure = etd */
    st.sailings.push({
      id: 'recz-hel', vessel_id: 'v-xprs', route: 'HELA-TLL',
      departure_at: '2026-10-31T08:25:00.000Z', arrival_at: '2026-10-31T10:40:00.000Z',
      delayed_departure_at: null, delayed_arrival_at: null,
      actual_departure_at: null, actual_arrival_at: null,
      status: 'ZAPLANOWANY', source: 'RECZNIE',
    });
    const pages: Record<string, string | number> = {
      ...tallinkPages,
      'viking-line-cargo': 403,
      'sales.vikingline.com': 403,
      'port-calls': PORTNET_XPRS_ES,
      'eckeroline.com': 503,
      'dfds.com': 503,
      'ctfassets.net': 503,
    };
    const result = await runFerrySchedule(deps(st, pages));
    const recz = st.sailings.find((s) => s.id === 'recz-hel')!;
    expect(recz.source).toBe('RECZNIE');
    expect(recz.departure_at).toBe('2026-10-31T08:25:00.000Z');
    expect(recz.arrival_at).toBe('2026-10-31T10:40:00.000Z');
    /* F7 #688 r1: licznik manualKept przy chronionym RECZNIE */
    expect((result.manualKept ?? 0)).toBeGreaterThanOrEqual(1);
  });

  it('F7 #688 r1: existing.push — drugi PortCall ±5 min → bez drugiego insertu', async () => {
    const st = new MemStore();
    const twin = {
      portCalls: [
        {
          portCallId: 9301, portCallTimestamp: '2026-10-30T08:00:00.000Z',
          portToVisit: 'FIHEL', prevPort: 'EETLL', nextPort: 'EETLL',
          vesselName: 'Viking XPRS', mmsi: 230705000,
          portAreaDetails: [{
            eta: '2026-10-31T07:30:00.000Z', etd: '2026-10-31T08:30:00.000Z',
            portAreaCode: 'ES', berthCode: 'KATAJANOKKA',
          }],
        },
        {
          portCallId: 9302, portCallTimestamp: '2026-10-30T08:01:00.000Z',
          portToVisit: 'FIHEL', prevPort: 'EETLL', nextPort: 'EETLL',
          vesselName: 'Viking XPRS', mmsi: 230705000,
          portAreaDetails: [{
            eta: '2026-10-31T07:35:00.000Z', etd: '2026-10-31T08:35:00.000Z',
            portAreaCode: 'ES', berthCode: 'KATAJANOKKA',
          }],
        },
      ],
    };
    const pages: Record<string, string | number> = {
      ...tallinkPages,
      'viking-line-cargo': 403,
      'sales.vikingline.com': 403,
      'port-calls': JSON.stringify(twin),
      'eckeroline.com': 503,
      'dfds.com': 503,
      'ctfassets.net': 503,
    };
    await runFerrySchedule(deps(st, pages));
    const tlla = st.sailings.filter((s) => s.route === 'TLLA-HEL' && s.source === 'VIKING');
    const hela = st.sailings.filter((s) => s.route === 'HELA-TLL' && s.source === 'VIKING');
    /* Pierwszy insert + existing.push; drugi w oknie ±30 → hit bez insertu */
    expect(tlla).toHaveLength(1);
    expect(hela).toHaveLength(1);
    expect(tlla[0]!.source_ref).toBe('digitraffic:portcall:9301:TLLA-HEL');
  });

  it('dwa kandydaci w oknie → ambiguous + ryzyko MEDIUM, bez insertu na tę godzinę', async () => {
    const st = new MemStore();
    st.sailings.push(
      {
        id: 'a1', vessel_id: 'v-xprs', route: 'HELA-TLL',
        departure_at: '2026-10-31T08:20:00.000Z', arrival_at: '2026-10-31T10:35:00.000Z',
        delayed_departure_at: null, delayed_arrival_at: null,
        status: 'ZAPLANOWANY', source: 'VIKING',
      },
      {
        id: 'a2', vessel_id: 'v-xprs', route: 'HELA-TLL',
        departure_at: '2026-10-31T08:40:00.000Z', arrival_at: '2026-10-31T10:55:00.000Z',
        delayed_departure_at: null, delayed_arrival_at: null,
        status: 'ZAPLANOWANY', source: 'DANE_STARTOWE',
      },
    );
    const pages: Record<string, string | number> = {
      ...tallinkPages,
      'viking-line-cargo': 403,
      'sales.vikingline.com': 403,
      'port-calls': PORTNET_XPRS_ES,
      'eckeroline.com': 503,
      'dfds.com': 503,
      'ctfassets.net': 503,
    };
    await runFerrySchedule(deps(st, pages));
    expect(st.risks.some((x) => String(x.dedup).startsWith('FERRY_UNKNOWN:DIGITRAFFIC_VIKING:'))).toBe(true);
    expect(st.sailings.filter((s) => s.route === 'HELA-TLL' && s.departure_at === '2026-10-31T08:30:00.000Z')).toHaveLength(0);
  });

  it('F7 #688 r1 B3: HTML w oknie — Digitraffic nie nadpisuje arrival', async () => {
    const st = new MemStore();
    st.sailings.push({
      id: 'html-hel', vessel_id: 'v-xprs', route: 'HELA-TLL',
      departure_at: '2026-10-31T08:30:00.000Z', arrival_at: '2026-10-31T10:45:00.000Z',
      delayed_departure_at: null, delayed_arrival_at: null,
      status: 'ZAPLANOWANY', source: 'VIKING',
    });
    const pages: Record<string, string | number> = {
      ...tallinkPages,
      'viking-line-cargo': 403,
      'sales.vikingline.com': 403,
      'port-calls': PORTNET_XPRS_ES,
      'eckeroline.com': 503,
      'dfds.com': 503,
      'ctfassets.net': 503,
    };
    await runFerrySchedule(deps(st, pages));
    expect(st.sailings.find((s) => s.id === 'html-hel')!.arrival_at).toBe('2026-10-31T10:45:00.000Z');
  });

  it('F7 #688 r1 B4: source_ref idempotencja + ETA +45 min', async () => {
    const st = new MemStore();
    const pages: Record<string, string | number> = {
      ...tallinkPages,
      'viking-line-cargo': 403,
      'sales.vikingline.com': 403,
      'port-calls': PORTNET_XPRS_ES,
      'eckeroline.com': 503,
      'dfds.com': 503,
      'ctfassets.net': 503,
    };
    await runFerrySchedule(deps(st, pages));
    const n1 = st.sailings.filter((s) => s.source_ref?.startsWith('digitraffic:portcall:')).length;
    expect(n1).toBeGreaterThanOrEqual(4);
    await runFerrySchedule(deps(st, pages));
    expect(st.sailings.filter((s) => s.source_ref?.startsWith('digitraffic:portcall:')).length).toBe(n1);
    const hit = st.sailings.find((s) => s.source_ref === 'digitraffic:portcall:9101:TLLA-HEL')!;
    expect(hit).toMatchObject({ departure_at: '2026-10-31T05:00:00.000Z', arrival_at: '2026-10-31T07:30:00.000Z' });
    const shifted = JSON.parse(PORTNET_XPRS_ES) as {
      portCalls: { portCallId: number; portAreaDetails: { eta?: string }[] }[];
    };
    shifted.portCalls.find((p) => p.portCallId === 9101)!.portAreaDetails[0]!.eta = '2026-10-31T08:15:00.000Z';
    await runFerrySchedule(deps(st, { ...pages, 'port-calls': JSON.stringify(shifted) }));
    const upd = st.sailings.find((s) => s.source_ref === 'digitraffic:portcall:9101:TLLA-HEL')!;
    expect(upd.arrival_at).toBe('2026-10-31T08:15:00.000Z');
    expect(upd.departure_at).toBe('2026-10-31T05:45:00.000Z');
  });

  it('F7 #688 r2 B1: wycofanie jednego portCallId → delete / ryzyko z transportem', async () => {
    const st = new MemStore();
    const pages: Record<string, string | number> = {
      ...tallinkPages,
      'viking-line-cargo': 403,
      'sales.vikingline.com': 403,
      'port-calls': PORTNET_XPRS_ES,
      'eckeroline.com': 503,
      'dfds.com': 503,
      'ctfassets.net': 503,
    };
    await runFerrySchedule(deps(st, pages));
    const withLoad = st.sailings.find((s) => s.source_ref === 'digitraffic:portcall:9102:HELA-TLL')!;
    st.assignedLoads.add(withLoad.id);
    const full = JSON.parse(PORTNET_XPRS_ES) as { portCalls: { portCallId: number }[] };
    const without9102 = {
      portCalls: full.portCalls.filter((p) => p.portCallId !== 9102),
    };
    expect(without9102.portCalls.some((p) => p.portCallId === 9101)).toBe(true);
    await runFerrySchedule(deps(st, { ...pages, 'port-calls': JSON.stringify(without9102) }));
    /* 9101 zostaje; 9102 HELA-TLL z transportem → ryzyko; 9102 TLLA-HEL bez transportu → delete. */
    expect(st.sailings.some((s) => s.source_ref === 'digitraffic:portcall:9101:HELA-TLL')).toBe(true);
    expect(st.sailings.some((s) => s.source_ref === 'digitraffic:portcall:9101:TLLA-HEL')).toBe(true);
    expect(st.sailings.some((s) => s.source_ref === 'digitraffic:portcall:9102:HELA-TLL')).toBe(true);
    expect(st.risks.some((x) => String(x.dedup).includes('DIGITRAFFIC_VIKING_WITHDRAWN'))).toBe(true);
    expect(st.sailings.some((s) => s.source_ref === 'digitraffic:portcall:9102:TLLA-HEL')).toBe(false);
  });

  it('F7 #688 r2 B1: pusta lista / ETA 503+ETD [] / foo — nie kasuje Digitraffic', async () => {
    const vkPages: Record<string, string | number> = {
      ...tallinkPages,
      'viking-line-cargo': 403,
      'sales.vikingline.com': 403,
      'eckeroline.com': 503,
      'dfds.com': 503,
      'ctfassets.net': 503,
    };
    const seed = new MemStore();
    await runFerrySchedule(deps(seed, { ...vkPages, 'port-calls': PORTNET_XPRS_ES }));
    const n0 = seed.sailings.filter((s) => s.source_ref?.startsWith('digitraffic:portcall:')).length;
    expect(n0).toBeGreaterThanOrEqual(4);

    const empty = new MemStore();
    empty.sailings = seed.sailings.map((s) => ({ ...s }));
    await runFerrySchedule(deps(empty, { ...vkPages, 'port-calls': JSON.stringify({ portCalls: [] }) }));
    expect(empty.sailings.filter((s) => s.source_ref?.startsWith('digitraffic:portcall:')).length).toBe(n0);

    const partial = new MemStore();
    partial.sailings = seed.sailings.map((s) => ({ ...s }));
    /* Klucze dłuższe niż `port-calls` (tallinkPages) — osobne ETA/ETD. */
    await runFerrySchedule(deps(partial, {
      ...vkPages,
      'port-calls?etaFrom': 503,
      'port-calls?etdFrom': JSON.stringify({ portCalls: [] }),
    }));
    expect(partial.sailings.filter((s) => s.source_ref?.startsWith('digitraffic:portcall:')).length).toBe(n0);

    const weird = new MemStore();
    weird.sailings = seed.sailings.map((s) => ({ ...s }));
    await runFerrySchedule(deps(weird, { ...vkPages, 'port-calls': JSON.stringify({ foo: 1 }) }));
    expect(weird.sailings.filter((s) => s.source_ref?.startsWith('digitraffic:portcall:')).length).toBe(n0);
  });

  it('F7 #688 r2 B2: HTML po Digitraffic (nocny 04.00) → 1 wiersz; drugi przebieg bez zapisów', async () => {
    const nightDt = {
      portCalls: [{
        portCallId: 9401, portCallTimestamp: '2026-10-28T10:00:00.000Z',
        portToVisit: 'FIHEL', prevPort: 'EETLL', nextPort: 'EETLL',
        vesselName: 'Viking XPRS', mmsi: 230705000,
        /* ETA 06:45 EET = 04:45Z → Digitraffic dep 02:15Z; HTML piątek 04:00 = 02:00Z */
        portAreaDetails: [{
          eta: '2026-10-30T04:45:00.000Z', etd: '2026-10-30T08:30:00.000Z',
          portAreaCode: 'ES', berthCode: 'KATAJANOKKA',
        }],
      }],
    };
    const wall = new Date('2026-10-29T12:00:00.000Z');
    const st = new MemStore();
    const dtOnly: Record<string, string | number> = {
      ...tallinkPages,
      'viking-line-cargo': 403,
      'sales.vikingline.com': 403,
      'port-calls': JSON.stringify(nightDt),
      'eckeroline.com': 503,
      'dfds.com': 503,
      'ctfassets.net': 503,
    };
    await runFerrySchedule(deps(st, dtOnly, wall));
    const dtRow = st.sailings.find((s) => s.source_ref === 'digitraffic:portcall:9401:TLLA-HEL');
    expect(dtRow).toMatchObject({ departure_at: '2026-10-30T02:15:00.000Z' });

    const withHtml: Record<string, string | number> = {
      ...tallinkPages,
      'viking-line-cargo': VIKING_CARGO_HTML,
      'sales.vikingline.com': 403,
      'port-calls': JSON.stringify(nightDt),
      'eckeroline.com': 503,
      'dfds.com': 503,
      'ctfassets.net': 503,
    };
    await runFerrySchedule(deps(st, withHtml, wall));
    const tllaNight = st.sailings.filter((s) =>
      s.vessel_id === 'v-xprs' && s.route === 'TLLA-HEL'
      && Math.abs(Date.parse(s.departure_at) - Date.parse('2026-10-30T02:00:00.000Z')) <= 30 * 60_000);
    expect(tllaNight).toHaveLength(1);
    expect(tllaNight[0]!.source_ref == null || !String(tllaNight[0]!.source_ref).startsWith('digitraffic:')).toBe(true);

    const before = st.sailings.map((s) => ({ ...s }));
    const r2 = await runFerrySchedule(deps(st, withHtml, wall));
    expect(r2.inserted ?? 0).toBe(0);
    expect(r2.updated ?? 0).toBe(0);
    expect(st.sailings).toHaveLength(before.length);
  });

  it('F7 #688 r2 B3: status≠ZAPLANOWANY / przeszły / RECZNIE+source_ref — bez delete', async () => {
    const st = new MemStore();
    const pages: Record<string, string | number> = {
      ...tallinkPages,
      'viking-line-cargo': 403,
      'sales.vikingline.com': 403,
      'port-calls': PORTNET_XPRS_ES,
      'eckeroline.com': 503,
      'dfds.com': 503,
      'ctfassets.net': 503,
    };
    await runFerrySchedule(deps(st, pages));
    const full = JSON.parse(PORTNET_XPRS_ES) as { portCalls: { portCallId: number }[] };
    const only9101 = { portCalls: full.portCalls.filter((p) => p.portCallId === 9101) };

    const wRejsie = st.sailings.find((s) => s.source_ref === 'digitraffic:portcall:9102:HELA-TLL')!;
    wRejsie.status = 'W_REJSIE';
    const past = st.sailings.find((s) => s.source_ref === 'digitraffic:portcall:9102:TLLA-HEL')!;
    past.departure_at = '2026-10-29T10:00:00.000Z';
    past.arrival_at = '2026-10-29T12:30:00.000Z';
    const recz = st.sailings.find((s) => s.source_ref === 'digitraffic:portcall:9101:TLLA-HEL')!;
    recz.source = 'RECZNIE';

    await runFerrySchedule(deps(st, { ...pages, 'port-calls': JSON.stringify(only9101) }));
    expect(st.sailings.some((s) => s.id === wRejsie.id)).toBe(true);
    expect(st.sailings.some((s) => s.id === past.id)).toBe(true);
    expect(st.sailings.some((s) => s.id === recz.id && s.source === 'RECZNIE')).toBe(true);
  });

  it('F7 #688 r1 B1: URL Portnet ma etaFrom/mmsi, bez from=', async () => {
    const st = new MemStore();
    const seen: string[] = [];
    const base = deps(st, {
      ...tallinkPages,
      'viking-line-cargo': 403,
      'sales.vikingline.com': 403,
      'port-calls': PORTNET_XPRS_ES,
      'eckeroline.com': 503,
      'dfds.com': 503,
      'ctfassets.net': 503,
    });
    const wrap: typeof fetch = async (input, init) => {
      const url = String(input);
      if (url.includes('port-calls')) seen.push(url);
      return base.fetch!(input, init);
    };
    await runFerrySchedule({ ...base, fetch: wrap });
    expect(seen.length).toBeGreaterThanOrEqual(1);
    expect(seen.every((u) => u.includes('etaFrom=') || u.includes('etdFrom='))).toBe(true);
    expect(seen.every((u) => u.includes('mmsi=230705000'))).toBe(true);
    expect(seen.every((u) => !/[?&]from=/.test(u))).toBe(true);
  });

  it('F7 #688 r3 B1: HTML adoptuje Digitraffic (ta sama godzina) → source_ref null; wycofanie nie kasuje', async () => {
    const wall = new Date('2026-10-28T12:00:00.000Z');
    const st = new MemStore();
    const htmlPages: Record<string, string | number> = {
      ...tallinkPages,
      'viking-line-cargo': VIKING_CARGO_HTML,
      'sales.vikingline.com': 403,
      'port-calls': 403,
      'eckeroline.com': 503,
      'dfds.com': 503,
      'ctfassets.net': 503,
    };
    /* 1) HTML — dokładna godzina (DST); 2) oznacz jako Digitraffic; 3) HTML+Portnet → adopt. */
    await runFerrySchedule(deps(st, htmlPages, wall));
    const htmlRow = st.sailings.find((s) =>
      s.vessel_id === 'v-xprs' && s.route === 'TLLA-HEL' && !s.source_ref
      && s.departure_at.startsWith('2026-10-29T'));
    expect(htmlRow).toBeTruthy();
    const depIso = htmlRow!.departure_at;
    const arrIso = htmlRow!.arrival_at;
    htmlRow!.source_ref = 'digitraffic:portcall:9501:TLLA-HEL';
    const sameHour = {
      portCalls: [{
        portCallId: 9501, portCallTimestamp: '2026-10-27T10:00:00.000Z',
        portToVisit: 'FIHEL', prevPort: 'EETLL', nextPort: 'EETLL',
        vesselName: 'Viking XPRS', mmsi: 230705000,
        portAreaDetails: [{
          eta: arrIso, etd: '2026-10-29T10:30:00.000Z',
          portAreaCode: 'ES', berthCode: 'KATAJANOKKA',
        }],
      }],
    };
    const withBoth: Record<string, string | number> = {
      ...tallinkPages,
      'viking-line-cargo': VIKING_CARGO_HTML,
      'sales.vikingline.com': 403,
      'port-calls': JSON.stringify(sameHour),
      'eckeroline.com': 503,
      'dfds.com': 503,
      'ctfassets.net': 503,
    };
    await runFerrySchedule(deps(st, withBoth, wall));
    const adopted = st.sailings.find((s) => s.id === htmlRow!.id);
    expect(adopted).toBeTruthy();
    expect(adopted!.source_ref == null || !String(adopted!.source_ref).startsWith('digitraffic:')).toBe(true);
    expect(adopted!.departure_at).toBe(depIso);

    const before = st.sailings.map((s) => ({ ...s }));
    const r2 = await runFerrySchedule(deps(st, withBoth, wall));
    expect(r2.inserted ?? 0).toBe(0);
    expect(r2.updated ?? 0).toBe(0);
    expect(st.sailings).toHaveLength(before.length);

    const onlyOther = {
      portCalls: [{
        portCallId: 9502, portCallTimestamp: '2026-10-28T11:00:00.000Z',
        portToVisit: 'FIHEL', prevPort: 'EETLL', nextPort: 'EETLL',
        vesselName: 'Viking XPRS', mmsi: 230705000,
        portAreaDetails: [{
          eta: '2026-11-01T07:30:00.000Z', etd: '2026-11-01T10:30:00.000Z',
          portAreaCode: 'ES', berthCode: 'KATAJANOKKA',
        }],
      }],
    };
    await runFerrySchedule(deps(st, { ...withBoth, 'port-calls': JSON.stringify(onlyOther) }, wall));
    expect(st.sailings.some((s) => s.id === htmlRow!.id && s.departure_at === depIso)).toBe(true);
  });

  it('F7 #688 r3 B2: HTML 12:15 + Portnet 12:50 → bez drugiego rejsu (±3 h)', async () => {
    const st = new MemStore();
    st.sailings.push({
      id: 'html-1215', vessel_id: 'v-xprs', route: 'HELA-TLL',
      departure_at: '2026-10-31T12:15:00.000Z', arrival_at: '2026-10-31T14:55:00.000Z',
      delayed_departure_at: null, delayed_arrival_at: null,
      status: 'ZAPLANOWANY', source: 'VIKING',
    });
    const port = {
      portCalls: [{
        portCallId: 9601, portCallTimestamp: '2026-10-30T08:00:00.000Z',
        portToVisit: 'FIHEL', prevPort: 'EETLL', nextPort: 'EETLL',
        vesselName: 'Viking XPRS', mmsi: 230705000,
        portAreaDetails: [{
          eta: '2026-10-31T15:00:00.000Z', etd: '2026-10-31T12:50:00.000Z',
          portAreaCode: 'ES', berthCode: 'KATAJANOKKA',
        }],
      }],
    };
    await runFerrySchedule(deps(st, {
      ...tallinkPages,
      'viking-line-cargo': 403,
      'sales.vikingline.com': 403,
      'port-calls': JSON.stringify(port),
      'eckeroline.com': 503,
      'dfds.com': 503,
      'ctfassets.net': 503,
    }));
    expect(st.sailings.filter((s) => s.vessel_id === 'v-xprs' && s.route === 'HELA-TLL')).toHaveLength(1);
    expect(st.sailings.some((s) => s.source_ref === 'digitraffic:portcall:9601:HELA-TLL')).toBe(false);
  });

  it('F7 #688 r3 B2: ETA +45 przy HTML w ±3 h → usuń Digitraffic; HTML wraca → 1 wiersz', async () => {
    const wall = new Date('2026-10-30T12:00:00.000Z');
    const basePc = {
      portCalls: [{
        portCallId: 9701, portCallTimestamp: '2026-10-28T10:00:00.000Z',
        portToVisit: 'FIHEL', prevPort: 'EETLL', nextPort: 'EETLL',
        vesselName: 'Viking XPRS', mmsi: 230705000,
        /* 15:30 EET = 13:30Z ETA → TLLA dep 11:00Z; HTML sobota 14:00 lokalnie = 12:00Z — poza ±30, w ±3 h */
        portAreaDetails: [{
          eta: '2026-10-31T13:30:00.000Z', etd: '2026-10-31T16:00:00.000Z',
          portAreaCode: 'ES', berthCode: 'KATAJANOKKA',
        }],
      }],
    };
    const st = new MemStore();
    await runFerrySchedule(deps(st, {
      ...tallinkPages,
      'viking-line-cargo': 403,
      'sales.vikingline.com': 403,
      'port-calls': JSON.stringify(basePc),
      'eckeroline.com': 503,
      'dfds.com': 503,
      'ctfassets.net': 503,
    }, wall));
    expect(st.sailings.some((s) => s.source_ref === 'digitraffic:portcall:9701:TLLA-HEL')).toBe(true);

    /* HTML w oknie ±3 h od Digitraffic (sobota 14:00 EET = 12:00Z vs Digitraffic 11:00Z). */
    st.sailings.push({
      id: 'html-sat-1400', vessel_id: 'v-xprs', route: 'TLLA-HEL',
      departure_at: '2026-10-31T12:00:00.000Z', arrival_at: '2026-10-31T14:30:00.000Z',
      delayed_departure_at: null, delayed_arrival_at: null,
      status: 'ZAPLANOWANY', source: 'VIKING',
    });
    const shifted = JSON.parse(JSON.stringify(basePc)) as {
      portCalls: { portAreaDetails: { eta: string }[] }[];
    };
    shifted.portCalls[0]!.portAreaDetails[0]!.eta = '2026-10-31T14:15:00.000Z'; /* +45 min */
    await runFerrySchedule(deps(st, {
      ...tallinkPages,
      'viking-line-cargo': 403,
      'sales.vikingline.com': 403,
      'port-calls': JSON.stringify(shifted),
      'eckeroline.com': 503,
      'dfds.com': 503,
      'ctfassets.net': 503,
    }, wall));
    /* HELA-TLL Digitraffic może zostać (brak HTML w ±3 h); TLLA-HEL musi zniknąć. */
    expect(st.sailings.some((s) => s.source_ref === 'digitraffic:portcall:9701:TLLA-HEL')).toBe(false);
    expect(st.sailings.filter((s) =>
      s.vessel_id === 'v-xprs' && s.route === 'TLLA-HEL'
      && Math.abs(Date.parse(s.departure_at) - Date.parse('2026-10-31T12:00:00.000Z')) <= 3 * 3600_000
    )).toHaveLength(1);
  });

  it('F7 #688 r3 B3: ETA {foo}+ETD bez 9102 / odwrotnie — nic nie znika', async () => {
    const vkPages: Record<string, string | number> = {
      ...tallinkPages,
      'viking-line-cargo': 403,
      'sales.vikingline.com': 403,
      'eckeroline.com': 503,
      'dfds.com': 503,
      'ctfassets.net': 503,
    };
    const seed = new MemStore();
    await runFerrySchedule(deps(seed, { ...vkPages, 'port-calls': PORTNET_XPRS_ES }));
    const n0 = seed.sailings.filter((s) => s.source_ref?.startsWith('digitraffic:portcall:')).length;
    expect(n0).toBeGreaterThanOrEqual(4);
    const full = JSON.parse(PORTNET_XPRS_ES) as { portCalls: { portCallId: number }[] };
    const without9102 = { portCalls: full.portCalls.filter((p) => p.portCallId !== 9102) };

    const a = new MemStore();
    a.sailings = seed.sailings.map((s) => ({ ...s }));
    await runFerrySchedule(deps(a, {
      ...vkPages,
      'port-calls?etaFrom': JSON.stringify({ foo: 1 }),
      'port-calls?etdFrom': JSON.stringify(without9102),
    }));
    expect(a.sailings.filter((s) => s.source_ref?.startsWith('digitraffic:portcall:')).length).toBe(n0);

    const b = new MemStore();
    b.sailings = seed.sailings.map((s) => ({ ...s }));
    await runFerrySchedule(deps(b, {
      ...vkPages,
      'port-calls?etaFrom': JSON.stringify(without9102),
      'port-calls?etdFrom': JSON.stringify({ foo: 1 }),
    }));
    expect(b.sailings.filter((s) => s.source_ref?.startsWith('digitraffic:portcall:')).length).toBe(n0);
  });

  it('F7 #688 r3 B3: wstaw 07:00Z / ETD 10:00Z; drugi przebieg 12:00Z → wiersz zostaje (przeszły)', async () => {
    const early = new Date('2026-10-31T07:00:00.000Z');
    const late = new Date('2026-10-31T12:00:00.000Z');
    /* ETA i ETD z różnymi odejściami — unikalność (vessel_id, departure_at). */
    const pc = {
      portCalls: [{
        portCallId: 9801, portCallTimestamp: '2026-10-30T08:00:00.000Z',
        portToVisit: 'FIHEL', prevPort: 'EETLL', nextPort: 'EETLL',
        vesselName: 'Viking XPRS', mmsi: 230705000,
        portAreaDetails: [{
          eta: '2026-10-31T15:00:00.000Z', etd: '2026-10-31T10:00:00.000Z',
          portAreaCode: 'ES', berthCode: 'KATAJANOKKA',
        }],
      }],
    };
    const pages: Record<string, string | number> = {
      ...tallinkPages,
      'viking-line-cargo': 403,
      'sales.vikingline.com': 403,
      'port-calls': JSON.stringify(pc),
      'eckeroline.com': 503,
      'dfds.com': 503,
      'ctfassets.net': 503,
    };
    const st = new MemStore();
    await runFerrySchedule(deps(st, pages, early));
    const hela = st.sailings.find((s) => s.source_ref === 'digitraffic:portcall:9801:HELA-TLL')!;
    expect(hela).toMatchObject({ departure_at: '2026-10-31T10:00:00.000Z' });
    /* Drugi przebieg bez tego portCall — wiersz już w przeszłości względem now=12:00Z → bez delete. */
    await runFerrySchedule(deps(st, {
      ...pages,
      'port-calls': JSON.stringify({ portCalls: [{
        portCallId: 9802, portCallTimestamp: '2026-10-30T09:00:00.000Z',
        portToVisit: 'FIHEL', prevPort: 'EETLL', nextPort: 'EETLL',
        vesselName: 'Viking XPRS', mmsi: 230705000,
        portAreaDetails: [{
          eta: '2026-11-01T07:30:00.000Z', etd: '2026-11-01T10:30:00.000Z',
          portAreaCode: 'ES', berthCode: 'KATAJANOKKA',
        }],
      }] }),
    }, late));
    expect(st.sailings.some((s) => s.id === hela.id)).toBe(true);
  });

  it('F7 #688 r3 B3: nocny z transportem → zostaje + ryzyko DUP', async () => {
    const nightDt = {
      portCalls: [{
        portCallId: 9401, portCallTimestamp: '2026-10-28T10:00:00.000Z',
        portToVisit: 'FIHEL', prevPort: 'EETLL', nextPort: 'EETLL',
        vesselName: 'Viking XPRS', mmsi: 230705000,
        portAreaDetails: [{
          eta: '2026-10-30T04:45:00.000Z', etd: '2026-10-30T08:30:00.000Z',
          portAreaCode: 'ES', berthCode: 'KATAJANOKKA',
        }],
      }],
    };
    const wall = new Date('2026-10-29T12:00:00.000Z');
    const st = new MemStore();
    await runFerrySchedule(deps(st, {
      ...tallinkPages,
      'viking-line-cargo': 403,
      'sales.vikingline.com': 403,
      'port-calls': JSON.stringify(nightDt),
      'eckeroline.com': 503,
      'dfds.com': 503,
      'ctfassets.net': 503,
    }, wall));
    const dtRow = st.sailings.find((s) => s.source_ref === 'digitraffic:portcall:9401:TLLA-HEL')!;
    st.assignedLoads.add(dtRow.id);
    st.sailings.push({
      id: 'html-night', vessel_id: 'v-xprs', route: 'TLLA-HEL',
      departure_at: '2026-10-30T02:00:00.000Z', arrival_at: '2026-10-30T04:45:00.000Z',
      delayed_departure_at: null, delayed_arrival_at: null,
      status: 'ZAPLANOWANY', source: 'VIKING',
    });
    await runFerrySchedule(deps(st, {
      ...tallinkPages,
      'viking-line-cargo': 403,
      'sales.vikingline.com': 403,
      'port-calls': JSON.stringify(nightDt),
      'eckeroline.com': 503,
      'dfds.com': 503,
      'ctfassets.net': 503,
    }, wall));
    expect(st.sailings.some((s) => s.id === dtRow.id)).toBe(true);
    expect(st.risks.some((x) => String(x.dedup).includes('DIGITRAFFIC_VIKING_DUP')
      && x.titleKey === 'rk_ferry_digitraffic_dup')).toBe(true);
  });

  it('F7 #688 r3 B3: Digitraffic padł, HTML OK → SOURCE_DOWN DIGITRAFFIC_VIKING MEDIUM', async () => {
    const st = new MemStore();
    await runFerrySchedule(deps(st, {
      ...tallinkPages,
      'viking-line-cargo': VIKING_CARGO_HTML,
      'sales.vikingline.com': 403,
      'port-calls': 503,
      'eckeroline.com': 503,
      'dfds.com': 503,
      'ctfassets.net': 503,
    }));
    expect(st.sailings.some((s) => s.source === 'VIKING' && !s.source_ref)).toBe(true);
    const risk = st.risks.find((x) => String(x.dedup).startsWith('SOURCE_DOWN:DIGITRAFFIC_VIKING:'));
    expect(risk?.severity).toBe('MEDIUM');
  });

  it('F7 #688 r3 nieblokujące: konflikt source_ref poza sinceIso → bez wyjątku', async () => {
    const st = new MemStore();
    /* Wiersz poza horyzontem sailingsSince (since = now−1d przy NOW=30.10) — nadal w MemStore. */
    st.sailings.push({
      id: 'old-ref', vessel_id: 'v-xprs', route: 'TLLA-HEL',
      departure_at: '2026-10-20T05:00:00.000Z', arrival_at: '2026-10-20T07:30:00.000Z',
      delayed_departure_at: null, delayed_arrival_at: null,
      status: 'ZAPLANOWANY', source: 'VIKING',
      source_ref: 'digitraffic:portcall:9101:TLLA-HEL',
    });
    await expect(runFerrySchedule(deps(st, {
      ...tallinkPages,
      'viking-line-cargo': 403,
      'sales.vikingline.com': 403,
      'port-calls': PORTNET_XPRS_ES,
      'eckeroline.com': 503,
      'dfds.com': 503,
      'ctfassets.net': 503,
    }))).resolves.toBeTruthy();
    /* Nowy insert z tym samym ref nie przeszedł; job nie rzucił. */
    expect(st.sailings.filter((s) => s.source_ref === 'digitraffic:portcall:9101:TLLA-HEL')).toHaveLength(1);
  });

  it('F7 #688 r4: filtr trasy — HTML HELA-TLL 23:00Z nie blokuje Digitraffic TLLA-HEL 20:00Z', async () => {
    const st = new MemStore();
    st.sailings.push({
      id: 'html-hela-2300', vessel_id: 'v-xprs', route: 'HELA-TLL',
      departure_at: '2026-11-01T23:00:00.000Z', arrival_at: '2026-11-02T01:40:00.000Z',
      delayed_departure_at: null, delayed_arrival_at: null,
      status: 'ZAPLANOWANY', source: 'VIKING',
    });
    const port = {
      portCalls: [{
        portCallId: 9601, portCallTimestamp: '2026-10-30T08:00:00.000Z',
        portToVisit: 'FIHEL', prevPort: 'EETLL', nextPort: 'EETLL',
        vesselName: 'Viking XPRS', mmsi: 230705000,
        /* ETA 22:30Z → TLLA-HEL dep 20:00Z (= dokładnie 180 min od HELA 23:00 — inna trasa). */
        portAreaDetails: [{
          eta: '2026-11-01T22:30:00.000Z', etd: null,
          portAreaCode: 'ES', berthCode: 'KATAJANOKKA',
        }],
      }],
    };
    await runFerrySchedule(deps(st, {
      ...tallinkPages,
      'viking-line-cargo': 403,
      'sales.vikingline.com': 403,
      'port-calls': JSON.stringify(port),
      'eckeroline.com': 503,
      'dfds.com': 503,
      'ctfassets.net': 503,
    }));
    expect(st.sailings.some((s) => s.source_ref === 'digitraffic:portcall:9601:TLLA-HEL'
      && s.departure_at === '2026-11-01T20:00:00.000Z')).toBe(true);
    expect(st.sailings.filter((s) => s.id === 'html-hela-2300')).toHaveLength(1);
  });

  it('F7 #688 r4: !isDigitrafficRef — 100@13:30 → 101@14:15: jest 101, nie ma 100', async () => {
    const wall = new Date('2026-10-30T12:00:00.000Z');
    /* Tylko ETD → HELA-TLL (bez ETA), żeby uniknąć kolizji vessel+departure w MemStore. */
    const pc100 = {
      portCalls: [{
        portCallId: 100, portCallTimestamp: '2026-10-29T10:00:00.000Z',
        portToVisit: 'FIHEL', prevPort: 'FIHEL', nextPort: 'EETLL',
        vesselName: 'Viking XPRS', mmsi: 230705000,
        portAreaDetails: [{
          etd: '2026-10-31T13:30:00.000Z',
          portAreaCode: 'ES', berthCode: 'KATAJANOKKA',
        }],
      }],
    };
    const st = new MemStore();
    const pages = {
      ...tallinkPages,
      'viking-line-cargo': 403 as const,
      'sales.vikingline.com': 403 as const,
      'port-calls': JSON.stringify(pc100),
      'eckeroline.com': 503 as const,
      'dfds.com': 503 as const,
      'ctfassets.net': 503 as const,
    };
    await runFerrySchedule(deps(st, pages, wall));
    expect(st.sailings.some((s) => s.source_ref === 'digitraffic:portcall:100:HELA-TLL')).toBe(true);
    const pc101 = {
      portCalls: [{
        portCallId: 101, portCallTimestamp: '2026-10-29T11:00:00.000Z',
        portToVisit: 'FIHEL', prevPort: 'FIHEL', nextPort: 'EETLL',
        vesselName: 'Viking XPRS', mmsi: 230705000,
        portAreaDetails: [{
          etd: '2026-10-31T14:15:00.000Z',
          portAreaCode: 'ES', berthCode: 'KATAJANOKKA',
        }],
      }],
    };
    await runFerrySchedule(deps(st, { ...pages, 'port-calls': JSON.stringify(pc101) }, wall));
    expect(st.sailings.some((s) => s.source_ref === 'digitraffic:portcall:101:HELA-TLL')).toBe(true);
    expect(st.sailings.some((s) => s.source_ref === 'digitraffic:portcall:100:HELA-TLL')).toBe(false);
  });

  it('F7 #688 r4: {portCalls:[]} + lista bez 9102 — nic nie znika (oba warianty)', async () => {
    const vkPages: Record<string, string | number> = {
      ...tallinkPages,
      'viking-line-cargo': 403,
      'sales.vikingline.com': 403,
      'eckeroline.com': 503,
      'dfds.com': 503,
      'ctfassets.net': 503,
    };
    const seed = new MemStore();
    await runFerrySchedule(deps(seed, { ...vkPages, 'port-calls': PORTNET_XPRS_ES }));
    const n0 = seed.sailings.filter((s) => s.source_ref?.startsWith('digitraffic:portcall:')).length;
    const full = JSON.parse(PORTNET_XPRS_ES) as { portCalls: { portCallId: number }[] };
    const without9102 = { portCalls: full.portCalls.filter((p) => p.portCallId !== 9102) };

    const a = new MemStore();
    a.sailings = seed.sailings.map((s) => ({ ...s }));
    await runFerrySchedule(deps(a, {
      ...vkPages,
      'port-calls?etaFrom': JSON.stringify({ portCalls: [] }),
      'port-calls?etdFrom': JSON.stringify(without9102),
    }));
    expect(a.sailings.filter((s) => s.source_ref?.startsWith('digitraffic:portcall:')).length).toBe(n0);

    const b = new MemStore();
    b.sailings = seed.sailings.map((s) => ({ ...s }));
    await runFerrySchedule(deps(b, {
      ...vkPages,
      'port-calls?etaFrom': JSON.stringify(without9102),
      'port-calls?etdFrom': JSON.stringify({ portCalls: [] }),
    }));
    expect(b.sailings.filter((s) => s.source_ref?.startsWith('digitraffic:portcall:')).length).toBe(n0);
  });

  it('F7 #688 r4: safeDelete rzuca → job kończy się, Tallink zapisany, ostrzeżenie', async () => {
    const st = new MemStore();
    st.deleteThrows = true;
    st.sailings.push({
      id: 'dt-orphan', vessel_id: 'v-xprs', route: 'HELA-TLL',
      departure_at: '2026-10-31T12:15:00.000Z', arrival_at: '2026-10-31T14:55:00.000Z',
      delayed_departure_at: null, delayed_arrival_at: null,
      status: 'ZAPLANOWANY', source: 'VIKING',
      source_ref: 'digitraffic:portcall:9601:HELA-TLL',
    });
    st.sailings.push({
      id: 'html-1215', vessel_id: 'v-xprs', route: 'HELA-TLL',
      departure_at: '2026-10-31T12:15:00.000Z', arrival_at: '2026-10-31T14:55:00.000Z',
      delayed_departure_at: null, delayed_arrival_at: null,
      status: 'ZAPLANOWANY', source: 'VIKING',
    });
    /* Unikalność vessel+departure — przesuń Digitraffic o 5 min (nadal w ±3 h od HTML). */
    st.sailings[0]!.departure_at = '2026-10-31T12:20:00.000Z';
    const port = {
      portCalls: [{
        portCallId: 9601, portCallTimestamp: '2026-10-30T08:00:00.000Z',
        portToVisit: 'FIHEL', prevPort: 'EETLL', nextPort: 'EETLL',
        vesselName: 'Viking XPRS', mmsi: 230705000,
        portAreaDetails: [{
          eta: '2026-10-31T15:00:00.000Z', etd: '2026-10-31T12:50:00.000Z',
          portAreaCode: 'ES', berthCode: 'KATAJANOKKA',
        }],
      }],
    };
    const r = await runFerrySchedule(deps(st, {
      ...tallinkPages,
      'viking-line-cargo': 403,
      'sales.vikingline.com': 403,
      'port-calls': JSON.stringify(port),
      'eckeroline.com': 503,
      'dfds.com': 503,
      'ctfassets.net': 503,
    }));
    expect(r.ok).toBe(true);
    expect(st.sailings.some((s) => s.id === 'dt-orphan')).toBe(true);
    expect(st.sailings.some((s) => s.source === 'TALLINK')).toBe(true);
    expect(r.warnings.some((w) => /nie usunięto rejsu/i.test(w))).toBe(true);
  });

  it('F7 #688 r4: obie strony 200 {foo:1} → SOURCE_DOWN DIGITRAFFIC_VIKING MEDIUM', async () => {
    const st = new MemStore();
    await runFerrySchedule(deps(st, {
      ...tallinkPages,
      'viking-line-cargo': VIKING_CARGO_HTML,
      'sales.vikingline.com': 403,
      'port-calls': JSON.stringify({ foo: 1 }),
      'eckeroline.com': 503,
      'dfds.com': 503,
      'ctfassets.net': 503,
    }));
    const risk = st.risks.find((x) => String(x.dedup).startsWith('SOURCE_DOWN:DIGITRAFFIC_VIKING:'));
    expect(risk?.severity).toBe('MEDIUM');
  });

  it('F7 #688 r4: sąsiad wokół depMsRef — ETA >3 h od HTML, stary czas w oknie → usuń Digitraffic', async () => {
    const wall = new Date('2026-10-30T12:00:00.000Z');
    const st = new MemStore();
    st.sailings.push({
      id: 'html-1200', vessel_id: 'v-xprs', route: 'TLLA-HEL',
      departure_at: '2026-10-31T12:00:00.000Z', arrival_at: '2026-10-31T14:30:00.000Z',
      delayed_departure_at: null, delayed_arrival_at: null,
      status: 'ZAPLANOWANY', source: 'VIKING',
    });
    st.sailings.push({
      id: 'dt-1100', vessel_id: 'v-xprs', route: 'TLLA-HEL',
      departure_at: '2026-10-31T11:00:00.000Z', arrival_at: '2026-10-31T13:30:00.000Z',
      delayed_departure_at: null, delayed_arrival_at: null,
      status: 'ZAPLANOWANY', source: 'VIKING',
      source_ref: 'digitraffic:portcall:9701:TLLA-HEL',
    });
    /* Nowe ETA: dep 16:00Z (= +4 h od HTML) — poza ±3 h od HTML, ale depMsRef 11:00 w oknie. */
    const shifted = {
      portCalls: [{
        portCallId: 9701, portCallTimestamp: '2026-10-28T10:00:00.000Z',
        portToVisit: 'FIHEL', prevPort: 'EETLL', nextPort: 'EETLL',
        vesselName: 'Viking XPRS', mmsi: 230705000,
        portAreaDetails: [{
          eta: '2026-10-31T18:30:00.000Z', etd: '2026-10-31T16:00:00.000Z',
          portAreaCode: 'ES', berthCode: 'KATAJANOKKA',
        }],
      }],
    };
    await runFerrySchedule(deps(st, {
      ...tallinkPages,
      'viking-line-cargo': 403,
      'sales.vikingline.com': 403,
      'port-calls': JSON.stringify(shifted),
      'eckeroline.com': 503,
      'dfds.com': 503,
      'ctfassets.net': 503,
    }, wall));
    expect(st.sailings.some((s) => s.source_ref === 'digitraffic:portcall:9701:TLLA-HEL')).toBe(false);
    expect(st.sailings.filter((s) => s.id === 'html-1200')).toHaveLength(1);
  });

  it('F7 #688 r4: granica okna ±3 h — 2,5 h blokuje; 3,5 h wstawia', async () => {
    const wall = new Date('2026-10-30T12:00:00.000Z');
    const mkPort = (etd: string) => ({
      portCalls: [{
        portCallId: 9901, portCallTimestamp: '2026-10-29T08:00:00.000Z',
        portToVisit: 'FIHEL', prevPort: 'EETLL', nextPort: 'EETLL',
        vesselName: 'Viking XPRS', mmsi: 230705000,
        portAreaDetails: [{
          eta: '2026-11-01T20:00:00.000Z', etd,
          portAreaCode: 'ES', berthCode: 'KATAJANOKKA',
        }],
      }],
    });
    const pagesBase: Record<string, string | number> = {
      ...tallinkPages,
      'viking-line-cargo': 403,
      'sales.vikingline.com': 403,
      'eckeroline.com': 503,
      'dfds.com': 503,
      'ctfassets.net': 503,
    };

    const near = new MemStore();
    near.sailings.push({
      id: 'html-1215', vessel_id: 'v-xprs', route: 'HELA-TLL',
      departure_at: '2026-10-31T12:15:00.000Z', arrival_at: '2026-10-31T14:55:00.000Z',
      delayed_departure_at: null, delayed_arrival_at: null,
      status: 'ZAPLANOWANY', source: 'VIKING',
    });
    /* 12:15 + 2,5 h = 14:45 — w oknie 3 h → bez insertu. */
    await runFerrySchedule(deps(near, {
      ...pagesBase,
      'port-calls': JSON.stringify(mkPort('2026-10-31T14:45:00.000Z')),
    }, wall));
    expect(near.sailings.some((s) => s.source_ref === 'digitraffic:portcall:9901:HELA-TLL')).toBe(false);

    const far = new MemStore();
    far.sailings.push({
      id: 'html-1215b', vessel_id: 'v-xprs', route: 'HELA-TLL',
      departure_at: '2026-10-31T12:15:00.000Z', arrival_at: '2026-10-31T14:55:00.000Z',
      delayed_departure_at: null, delayed_arrival_at: null,
      status: 'ZAPLANOWANY', source: 'VIKING',
    });
    /* 12:15 + 3,5 h = 15:45 — poza ±3 h → insert. */
    await runFerrySchedule(deps(far, {
      ...pagesBase,
      'port-calls': JSON.stringify(mkPort('2026-10-31T15:45:00.000Z')),
    }, wall));
    expect(far.sailings.some((s) => s.source_ref === 'digitraffic:portcall:9901:HELA-TLL'
      && s.departure_at === '2026-10-31T15:45:00.000Z')).toBe(true);
  });

  it('F7 #688 r4: titleKey rk_ferry_digitraffic_withdrawn przy wycofaniu z transportem', async () => {
    const st = new MemStore();
    const pages: Record<string, string | number> = {
      ...tallinkPages,
      'viking-line-cargo': 403,
      'sales.vikingline.com': 403,
      'port-calls': PORTNET_XPRS_ES,
      'eckeroline.com': 503,
      'dfds.com': 503,
      'ctfassets.net': 503,
    };
    await runFerrySchedule(deps(st, pages));
    const withLoad = st.sailings.find((s) => s.source_ref === 'digitraffic:portcall:9102:HELA-TLL')!;
    st.assignedLoads.add(withLoad.id);
    const full = JSON.parse(PORTNET_XPRS_ES) as { portCalls: { portCallId: number }[] };
    const without9102 = { portCalls: full.portCalls.filter((p) => p.portCallId !== 9102) };
    await runFerrySchedule(deps(st, { ...pages, 'port-calls': JSON.stringify(without9102) }));
    expect(st.risks.some((x) => x.titleKey === 'rk_ferry_digitraffic_withdrawn'
      && String(x.dedup).includes('DIGITRAFFIC_VIKING_WITHDRAWN'))).toBe(true);
  });

  it('F7 #688 r4: RECZNIE 12:15 + Portnet 12:50 → 1 wiersz RECZNIE, bez zmian', async () => {
    const st = new MemStore();
    st.sailings.push({
      id: 'recz-1215', vessel_id: 'v-xprs', route: 'HELA-TLL',
      departure_at: '2026-10-31T12:15:00.000Z', arrival_at: '2026-10-31T14:55:00.000Z',
      delayed_departure_at: null, delayed_arrival_at: null,
      status: 'ZAPLANOWANY', source: 'RECZNIE',
    });
    const port = {
      portCalls: [{
        portCallId: 9601, portCallTimestamp: '2026-10-30T08:00:00.000Z',
        portToVisit: 'FIHEL', prevPort: 'FIHEL', nextPort: 'EETLL',
        vesselName: 'Viking XPRS', mmsi: 230705000,
        /* Tylko ETD → HELA-TLL (RECZNIE blokuje); bez ETA/TLLA. */
        portAreaDetails: [{
          etd: '2026-10-31T12:50:00.000Z',
          portAreaCode: 'ES', berthCode: 'KATAJANOKKA',
        }],
      }],
    };
    await runFerrySchedule(deps(st, {
      ...tallinkPages,
      'viking-line-cargo': 403,
      'sales.vikingline.com': 403,
      'port-calls': JSON.stringify(port),
      'eckeroline.com': 503,
      'dfds.com': 503,
      'ctfassets.net': 503,
    }));
    expect(st.sailings.filter((s) => s.vessel_id === 'v-xprs' && s.route === 'HELA-TLL')).toHaveLength(1);
    expect(st.sailings.find((s) => s.id === 'recz-1215')).toMatchObject({
      source: 'RECZNIE', departure_at: '2026-10-31T12:15:00.000Z',
    });
    expect(st.sailings.some((s) => s.source_ref?.startsWith('digitraffic:'))).toBe(false);
  });

  it('F7 #688 r4: DANE_STARTOWE w ±3 h blokuje insert Digitraffic', async () => {
    const st = new MemStore();
    st.sailings.push({
      id: 'seed-1215', vessel_id: 'v-xprs', route: 'HELA-TLL',
      departure_at: '2026-10-31T12:15:00.000Z', arrival_at: '2026-10-31T14:55:00.000Z',
      delayed_departure_at: null, delayed_arrival_at: null,
      status: 'ZAPLANOWANY', source: 'DANE_STARTOWE',
    });
    const port = {
      portCalls: [{
        portCallId: 9601, portCallTimestamp: '2026-10-30T08:00:00.000Z',
        portToVisit: 'FIHEL', prevPort: 'FIHEL', nextPort: 'EETLL',
        vesselName: 'Viking XPRS', mmsi: 230705000,
        portAreaDetails: [{
          etd: '2026-10-31T12:50:00.000Z',
          portAreaCode: 'ES', berthCode: 'KATAJANOKKA',
        }],
      }],
    };
    await runFerrySchedule(deps(st, {
      ...tallinkPages,
      'viking-line-cargo': 403,
      'sales.vikingline.com': 403,
      'port-calls': JSON.stringify(port),
      'eckeroline.com': 503,
      'dfds.com': 503,
      'ctfassets.net': 503,
    }));
    expect(st.sailings.filter((s) => s.vessel_id === 'v-xprs' && s.route === 'HELA-TLL')).toHaveLength(1);
    expect(st.sailings.find((s) => s.id === 'seed-1215')!.source).toBe('DANE_STARTOWE');
  });
});
