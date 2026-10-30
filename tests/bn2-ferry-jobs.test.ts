/**
 * BN2 / F7 #660 — testy joba ferry-schedule / ferry-portnet (mock fetch, bez sieci).
 * Częściowa awaria Tallinka, Portnet vs RECZNIE/ODWOLANY, domknięcie W_REJSIE FI→EE, idempotencja.
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
const NOW = new Date('2026-10-30T12:00:00Z');
const MEGA = 'v-mega';

class MemStore implements SyncStore {
  sailings: DbSailing[] = [];
  risks: (RiskInput & { loadId?: string })[] = [];
  runs: { job: string; at: string; ok: boolean; result: JobResult }[] = [];
  n = 0;
  async projectId() { return 'p1'; }
  async vessels() {
    return [
      { id: MEGA, name: 'M/F Megastar', mmsi: 276829000 },
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
    if (url.includes('stenalinefreight.com') || url.includes('portoftallinn') || url.includes('stockholm')) {
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

describe('F7 #660 ferry-schedule Tallink', () => {
  it('częściowa awaria Tallinka → zapisuje kierunki OK, bez SOURCE_DOWN', async () => {
    const st = new MemStore();
    const pages: Record<string, string | number> = {
      ...basePages,
      'from=tal&to=hel': TALLINK,
      'from=hel&to=tal': 503,
      'from=tal&to=sto': 503,
      'from=sto&to=tal': 503,
    };
    const r = await runFerrySchedule(deps(st, pages));
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

  it('HEL-TLL po arrival_at+2h bez ATA → DOPLYNAL (actual_arrival_at null)', async () => {
    const st = new MemStore();
    st.sailings.push({
      id: 'stuck', vessel_id: MEGA, route: 'HEL-TLL',
      departure_at: '2026-10-29T10:00:00.000Z', arrival_at: '2026-10-29T12:00:00.000Z',
      delayed_departure_at: null, delayed_arrival_at: null,
      actual_departure_at: '2026-10-29T10:10:00.000Z', actual_arrival_at: null,
      status: 'W_REJSIE', source: 'TALLINK',
    });
    // Pusty Portnet — tylko domknięcie.
    const empty = JSON.stringify({ portCalls: [] });
    const r = await runFerryPortnet(deps(st, { 'port-calls': empty }, new Date('2026-10-29T15:00:00Z')));
    expect(r.ok).toBe(true);
    expect(st.sailings.find((s) => s.id === 'stuck')).toMatchObject({
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
