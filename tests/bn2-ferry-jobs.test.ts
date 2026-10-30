/**
 * BN2 / F7 #660 — testy joba ferry-schedule / ferry-portnet (mock fetch, bez sieci).
 * F7 r2/r3: Port of Tallinn tylko odwołania; Stockholm actual_* bez insertów/godzin.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  runFerryPortnet, runFerrySchedule,
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
      { id: 'v-waw', name: 'M/F Wawel', mmsi: null },
      { id: 'v-ns', name: 'M/F Nova Star', mmsi: 311000787 },
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
