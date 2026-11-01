/**
 * BN3 pkt 7 — Urząd Morski Gdynia: zapas ETA/ATA/ETD Stena GDY↔KAA.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  extractPortGdyniaHtml, isKarlskronaNote, parseUmgLocalTime, parseUmgdyGdyniaHtml,
  stenaUmgCandidates,
} from '../supabase/functions/_shared/ferry/umgdyShipMovements';
import {
  runFerryPortnet, type JobDeps, type JobResult, type SyncStore,
} from '../supabase/functions/_shared/integrations/jobs';
import type { DbSailing, RiskInput, SailingInsert, SailingPatch } from '../supabase/functions/_shared/integrations/sync';

const fx = (n: string) => readFileSync(new URL(`./fixtures/${n}`, import.meta.url), 'utf8');
const PORTNET = fx('digitraffic-port-calls-megastar-2026-10-29.json');
const UMG_IN = fx('umgdy-gdynia-in-port-stena-sample.html');
const UMG_ETA = fx('umgdy-gdynia-expected-stena-sample.html');
const UMG_ETD = fx('umgdy-gdynia-outgoing-stena-sample.html');
const EBBA = 'v-ebba';
const SPIR = 'v-spir';
const ESTE = 'v-este';
const NOW = new Date('2026-10-31T12:00:00Z');

class MemStore implements SyncStore {
  sailings: DbSailing[] = [];
  risks: (RiskInput & { loadId?: string })[] = [];
  runs: { job: string; at: string; ok: boolean; result: JobResult }[] = [];
  n = 0;
  async projectId() { return 'p1'; }
  async vessels() {
    return [
      { id: EBBA, name: 'M/F Stena Ebba', mmsi: 219031310 },
      { id: SPIR, name: 'M/F Stena Spirit', mmsi: 219031605 },
      { id: ESTE, name: 'M/F Stena Estelle', mmsi: 219030885 },
      { id: 'v-mega', name: 'M/F Megastar', mmsi: 276829000 },
    ];
  }
  async sailingsSince(from: string) {
    return this.sailings.filter((s) => s.departure_at >= from).map((s) => ({ ...s }));
  }
  async maxVikingFileDepartureAt() { return null; }
  async insertSailings(rows: SailingInsert[]) {
    for (const r of rows) {
      this.sailings.push({ id: `s${++this.n}`, ...r });
    }
  }
  async updateSailing(id: string, patch: SailingPatch) {
    const s = this.sailings.find((x) => x.id === id);
    if (!s) return false;
    const { actual_departure_at, actual_arrival_at, delayed_arrival_at, ...rest } = patch;
    if (Object.keys(rest).length && s.source !== 'RECZNIE') Object.assign(s, rest);
    if (actual_departure_at !== undefined) s.actual_departure_at = actual_departure_at;
    if (actual_arrival_at !== undefined) s.actual_arrival_at = actual_arrival_at;
    if (delayed_arrival_at !== undefined) s.delayed_arrival_at = delayed_arrival_at;
    return true;
  }
  async sailingAssignedLoadCount() { return 0; }
  async deleteSailing() { return false; }
  async raiseRisk(r: RiskInput & { loadId?: string }) {
    if (this.risks.some((x) => x.dedup === r.dedup)) return false;
    this.risks.push(r); return true;
  }
  async resolveRisks(prefix: string) {
    const hit = this.risks.filter((r) => r.dedup.startsWith(prefix));
    this.risks = this.risks.filter((r) => !r.dedup.startsWith(prefix));
    return hit.length;
  }
  async resolveStaleRisks(prefix: string, keep: string[]) {
    const keepSet = new Set(keep);
    this.risks = this.risks.filter((r) => !(r.dedup.startsWith(prefix) && !keepSet.has(r.dedup)));
    return 0;
  }
  async latestPositions() { return []; }
  async lastRun() { return null; }
  async recordRun(job: string, ok: boolean, result: JobResult) {
    this.runs.push({ job, at: NOW.toISOString(), ok, result });
  }
  async saveVesselPosition() { /* no-op */ }
  async ferryPortDelayMin() { return 15; }
}

function deps(store: MemStore, pages: Record<string, string | number>, now = NOW): JobDeps {
  const f = (async (input: RequestInfo | URL) => {
    const url = String(input);
    /* UMG: dokładne ścieżki (in-port jest prefiksem wychodzących/spodziewanych). */
    if (url.includes('umgdy.gov.pl')) {
      if (url.includes('statki-spodziewane') && pages['statki-spodziewane'] != null) {
        const v = pages['statki-spodziewane']!;
        return typeof v === 'number' ? new Response('err', { status: v }) : new Response(v, { status: 200 });
      }
      if (url.includes('statki-wychodzace') && pages['statki-wychodzace'] != null) {
        const v = pages['statki-wychodzace']!;
        return typeof v === 'number' ? new Response('err', { status: v }) : new Response(v, { status: 200 });
      }
      if (pages['statki-w-porcie'] != null) {
        const v = pages['statki-w-porcie']!;
        return typeof v === 'number' ? new Response('err', { status: v }) : new Response(v, { status: 200 });
      }
      if (pages['umgdy.gov.pl'] != null) {
        const v = pages['umgdy.gov.pl']!;
        return typeof v === 'number' ? new Response('err', { status: v }) : new Response(v, { status: 200 });
      }
    }
    const hit = Object.entries(pages)
      .filter(([k]) => url.includes(k))
      .sort((a, b) => b[0].length - a[0].length)[0];
    if (hit) {
      return typeof hit[1] === 'number'
        ? new Response('err', { status: hit[1] })
        : new Response(hit[1], { status: 200 });
    }
    if (url.includes('winter-navigation')) {
      return new Response(JSON.stringify({ type: 'FeatureCollection', features: [] }), { status: 200 });
    }
    if (url.includes('port-call/v2')) return new Response('[]', { status: 200 });
    if (url.includes('ts.ee') || url.includes('portsofstockholm')) {
      return new Response('niedostepne', { status: 503 });
    }
    throw new Error(`nieoczekiwane: ${url}`);
  }) as typeof fetch;
  return { store, fetch: f, env: {}, now: () => now };
}

describe('BN3 UMG Gdynia parser', () => {
  it('extractPortGdyniaHtml pomija Gdańsk', () => {
    const sec = extractPortGdyniaHtml(UMG_IN);
    expect(sec).toBeTruthy();
    expect(sec!).toMatch(/STENA EBBA/i);
    expect(sec!).not.toMatch(/Port Gdańsk/i);
  });

  it('parseUmgLocalTime: ISO z offsetem i DD.MM.RRRR', () => {
    expect(parseUmgLocalTime('2026-10-31T14:00:00+01:00')).toBe('2026-10-31T13:00:00.000Z');
    expect(parseUmgLocalTime('31.10.2026 08:50:00')).toMatch(/^2026-10-31T/);
  });

  it('parseUmgdyGdyniaHtml ATA: tylko Stena Ebba', () => {
    const p = parseUmgdyGdyniaHtml(UMG_IN, 'ATA');
    expect(p.rows).toHaveLength(1);
    expect(p.rows[0]!.vessel).toBe('M/F Stena Ebba');
    expect(p.rows[0]!.imo).toBe(9863003);
  });

  it('stenaUmgCandidates: ETA bez Karlskrony → odrzut; z Karlskroną → OK', () => {
    const eta = parseUmgdyGdyniaHtml(UMG_ETA, 'ETA').rows;
    expect(isKarlskronaNote(eta[0]!.note)).toBe(true);
    expect(stenaUmgCandidates(eta)).toHaveLength(1);
    expect(stenaUmgCandidates([{ ...eta[0]!, note: 'Klaipeda' }])).toHaveLength(0);
  });
});

describe('BN3 UMG × ferry-portnet', () => {
  it('ATA Ebba → actual_arrival KAA-GDY; ETD Estelle → actual_departure GDY-KAA; ETA Spirit → delayed', async () => {
    const st = new MemStore();
    st.sailings.push(
      {
        id: 'kaa-ebba', vessel_id: EBBA, route: 'KAA-GDY',
        departure_at: '2026-10-31T04:00:00.000Z', arrival_at: '2026-10-31T07:50:00.000Z',
        delayed_departure_at: null, delayed_arrival_at: null,
        actual_departure_at: '2026-10-31T04:05:00.000Z', actual_arrival_at: null,
        status: 'W_REJSIE', source: 'STENA',
      },
      {
        id: 'gdy-este', vessel_id: ESTE, route: 'GDY-KAA',
        departure_at: '2026-10-31T18:00:00.000Z', arrival_at: '2026-10-31T22:00:00.000Z',
        delayed_departure_at: null, delayed_arrival_at: null,
        actual_departure_at: null, actual_arrival_at: null,
        status: 'ZAPLANOWANY', source: 'STENA',
      },
      {
        id: 'kaa-spir', vessel_id: SPIR, route: 'KAA-GDY',
        departure_at: '2026-10-31T10:00:00.000Z', arrival_at: '2026-10-31T13:00:00.000Z',
        delayed_departure_at: null, delayed_arrival_at: null,
        actual_departure_at: null, actual_arrival_at: null,
        status: 'ZAPLANOWANY', source: 'STENA',
      },
    );
    const r = await runFerryPortnet(deps(st, {
      'port-calls': PORTNET,
      'statki-spodziewane': UMG_ETA,
      'statki-wychodzace': UMG_ETD,
      'statki-w-porcie': UMG_IN,
    }));
    expect(r.ok).toBe(true);
    expect(Number(r.observations?.umg_stena_rows ?? 0)).toBe(3);
    expect(st.sailings.find((s) => s.id === 'kaa-ebba')).toMatchObject({
      status: 'DOPLYNAL', actual_arrival_at: '2026-10-31T07:50:00.000Z',
    });
    expect(st.sailings.find((s) => s.id === 'gdy-este')).toMatchObject({
      status: 'W_REJSIE', actual_departure_at: expect.stringMatching(/^2026-10-31T/),
    });
    expect(st.sailings.find((s) => s.id === 'kaa-spir')?.delayed_arrival_at).toBe('2026-10-31T13:00:00.000Z');
  });

  it('wszystkie UMG 503 → SOURCE_DOWN UMG_GDY MEDIUM; ok Portnet bez zmian', async () => {
    const st = new MemStore();
    const r = await runFerryPortnet(deps(st, {
      'port-calls': PORTNET,
      'umgdy.gov.pl': 503,
    }));
    expect(r.ok).toBe(true);
    const down = st.risks.filter((x) => x.dedup.startsWith('SOURCE_DOWN:UMG_GDY'));
    expect(down).toHaveLength(1);
    expect(down[0]!.severity).toBe('MEDIUM');
  });
});
