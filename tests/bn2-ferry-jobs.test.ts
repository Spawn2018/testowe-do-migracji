/**
 * BN2 / F7 #660 — testy joba ferry-schedule / ferry-portnet (mock fetch, bez sieci).
 * F7 r2/r3: Port of Tallinn tylko odwołania; Stockholm actual_* bez insertów/godzin.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  fetchStenaDays, runFerryPortnet, runFerrySchedule,
  type JobDeps, type JobResult, type SyncStore,
} from '../supabase/functions/_shared/integrations/jobs';
import type { DbSailing, RiskInput, SailingInsert, SailingPatch } from '../supabase/functions/_shared/integrations/sync';

const fx = (n: string) => readFileSync(new URL(`./fixtures/${n}`, import.meta.url), 'utf8');
const CARGO = fx('polferries-cargo-rozklad-2026-09-26.html');
const TALLINK = fx('tallink-timetable-tal-hel-2026-10-30.json');
const PORTNET = fx('digitraffic-port-calls-megastar-2026-10-29.json');
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
      { id: 'v-xprs', name: 'M/F Viking XPRS', mmsi: 230629000 },
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
  async insertSailings(rows: SailingInsert[]) {
    for (const r of rows) {
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
  async raiseRisk(r: RiskInput & { loadId?: string }) {
    if (this.risks.some((x) => x.dedup === r.dedup)) return false;
    this.risks.push(r); return true;
  }
  async resolveRisks(prefix: string) {
    const hit = this.risks.filter((r) => r.dedup.startsWith(prefix));
    this.risks = this.risks.filter((r) => !r.dedup.startsWith(prefix));
    return hit.length;
  }
  async latestPositions() { return []; }
  async lastRun(job: string) { return this.runs.filter((r) => r.job === job).at(-1)?.at ?? null; }
  async recordRun(job: string, ok: boolean, result: JobResult) {
    this.runs.push({ job, at: NOW.toISOString(), ok, result });
  }
  async saveVesselPosition() { /* no-op */ }
}

function deps(store: MemStore, pages: Record<string, string | number>, now = NOW): JobDeps {
  const f = (async (input: RequestInfo | URL) => {
    const url = String(input);
    const hit = Object.entries(pages).find(([k]) => url.includes(k));
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

  it('B1: prawdziwa tabela HTML DFDS → rejsy bez SOURCE_DOWN', async () => {
    const st = new MemStore();
    const pages: Record<string, string | number> = {
      ...tallinkPages,
      'dfds.com': DFDS_HTML,
      'ctfassets.net': 503,
    };
    await runFerrySchedule(deps(st, pages));
    expect(st.sailings.some((s) => s.source === 'DFDS' && s.route === 'PLD-KPS')).toBe(true);
    expect(st.risks.some((x) => String(x.dedup).startsWith('SOURCE_DOWN:DFDS_SCHEDULE:'))).toBe(false);
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
