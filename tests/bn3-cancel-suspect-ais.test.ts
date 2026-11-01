/**
 * BN3 decyzja 61 — podejrzenie odwołania: ETA+45 bez ATA + AIS stoi w porcie Zatoki → FERRY MEDIUM.
 * Bez zmiany statusu rejsu. Viking / Eckerö / Finbo / Tallink.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  cancelSuspectDue, cancelSuspectRiskDedup, cancelSuspectTrigger,
  collectPortCallIds, isStandingInGulfPort, portCallDisappeared,
  GULF_FERRY_ROUTES,
} from '../supabase/functions/_shared/ferry/cancelSuspect';
import { parseDigitrafficLocations } from '../supabase/functions/_shared/ferry/digitraffic';
import {
  runFerryPortnet, type JobDeps, type JobResult, type SyncStore,
} from '../supabase/functions/_shared/integrations/jobs';
import type { DbSailing, RiskInput, SailingInsert, SailingPatch } from '../supabase/functions/_shared/integrations/sync';

const fx = (n: string) => readFileSync(new URL(`./fixtures/${n}`, import.meta.url), 'utf8');
const PORTNET = fx('digitraffic-port-calls-megastar-2026-10-29.json');
const AIS_STAND = fx('digitraffic-ais-standing-hel-synthetic.json');
const AIS_MOVE = fx('digitraffic-ais-moving-synthetic.json');
const MEGA = 'v-mega';
/** ETA 10:00Z → próg 10:45; now 11:00 = po gracie. */
const NOW = new Date('2026-10-30T11:00:00Z');
const ETA = '2026-10-30T10:00:00.000Z';
const DEP = '2026-10-30T07:30:00.000Z';

class MemStore implements SyncStore {
  sailings: DbSailing[] = [];
  risks: (RiskInput & { loadId?: string })[] = [];
  runs: { job: string; at: string; ok: boolean; result: JobResult }[] = [];
  n = 0;
  async projectId() { return 'p1'; }
  async vessels() {
    return [
      { id: MEGA, name: 'M/F Megastar', mmsi: 276829000 },
      { id: 'v-xprs', name: 'M/F Viking XPRS', mmsi: 230705000 },
    ];
  }
  async sailingsSince(from: string) {
    return this.sailings.filter((s) => s.departure_at >= from).map((s) => ({ ...s }));
  }
  async maxVikingFileDepartureAt() { return null; }
  async insertSailings(rows: SailingInsert[]) {
    for (const r of rows) this.sailings.push({ id: `s${++this.n}`, ...r });
  }
  async updateSailing(id: string, patch: SailingPatch) {
    const s = this.sailings.find((x) => x.id === id);
    if (!s) return false;
    const {
      actual_departure_at, actual_arrival_at, delayed_arrival_at, delayed_departure_at, ...rest
    } = patch;
    if (Object.keys(rest).length && s.source !== 'RECZNIE') Object.assign(s, rest);
    if (actual_departure_at !== undefined) s.actual_departure_at = actual_departure_at;
    if (actual_arrival_at !== undefined) s.actual_arrival_at = actual_arrival_at;
    if (delayed_arrival_at !== undefined) s.delayed_arrival_at = delayed_arrival_at;
    if (delayed_departure_at !== undefined) s.delayed_departure_at = delayed_departure_at;
    return true;
  }
  async sailingAssignedLoadCount() { return 0; }
  async deleteSailing() { return false; }
  async raiseRisk(r: RiskInput & { loadId?: string }) {
    if (this.risks.some((x) => x.dedup === r.dedup)) return false;
    this.risks.push(r); return true;
  }
  async hasOpenRisk(prefix: string) {
    return this.risks.some((r) => r.dedup.startsWith(prefix));
  }
  async resolveRisks(prefix: string) {
    const hit = this.risks.filter((r) => r.dedup.startsWith(prefix));
    this.risks = this.risks.filter((r) => !r.dedup.startsWith(prefix));
    return hit.length;
  }
  async resolveStaleRisks(prefix: string, keep: string[]) {
    const keepSet = new Set(keep);
    const hit = this.risks.filter((r) => r.dedup.startsWith(prefix) && !keepSet.has(r.dedup));
    this.risks = this.risks.filter((r) => !(r.dedup.startsWith(prefix) && !keepSet.has(r.dedup)));
    return hit.length;
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
    if (url.includes('umgdy.gov.pl')) {
      return new Response(
        '<html><body><h2>Port Gdynia</h2><table class="table table-striped"><tr><th>Call ID</th></tr></table></body></html>',
        { status: 200 },
      );
    }
    if (url.includes('ts.ee') || url.includes('portsofstockholm')) {
      return new Response('niedostepne', { status: 503 });
    }
    if (url.includes('/ais/v1/locations')) {
      return new Response(JSON.stringify({ type: 'FeatureCollection', features: [] }), { status: 200 });
    }
    throw new Error(`nieoczekiwane: ${url}`);
  }) as typeof fetch;
  return { store, fetch: f, env: {}, now: () => now };
}

function gulfSailing(over: Partial<DbSailing> = {}): DbSailing {
  return {
    id: 's-gulf-1',
    vessel_id: MEGA,
    route: 'TLL-HEL',
    departure_at: DEP,
    arrival_at: ETA,
    delayed_departure_at: null,
    delayed_arrival_at: null,
    actual_departure_at: null,
    actual_arrival_at: null,
    status: 'W_REJSIE',
    source: 'TALLINK',
    source_ref: null,
    ...over,
  };
}

describe('BN3 cancel-suspect helpers', () => {
  it('trasy zatoki + cancelSuspectDue 45 min', () => {
    expect(GULF_FERRY_ROUTES.has('TLL-HEL')).toBe(true);
    expect(GULF_FERRY_ROUTES.has('HELA-TLL')).toBe(true);
    expect(GULF_FERRY_ROUTES.has('MUU-VUO')).toBe(true);
    expect(GULF_FERRY_ROUTES.has('GDY-KAA')).toBe(false);
    const eta = '2026-10-30T10:00:00.000Z';
    expect(cancelSuspectDue(eta, Date.parse('2026-10-30T10:44:00Z'))).toBe(false);
    expect(cancelSuspectDue(eta, Date.parse('2026-10-30T10:45:00Z'))).toBe(true);
  });

  it('isStandingInGulfPort: SOG≈0 w HEL; SOG≥3 → nie', () => {
    const stand = parseDigitrafficLocations(JSON.parse(AIS_STAND), 276829000)!;
    expect(isStandingInGulfPort(stand)).toBe(true);
    const move = parseDigitrafficLocations(JSON.parse(AIS_MOVE), 276829000)!;
    expect(isStandingInGulfPort(move)).toBe(false);
  });

  it('portCallDisappeared + collectPortCallIds z fixture', () => {
    const ids = collectPortCallIds(JSON.parse(PORTNET));
    expect(ids.has('3405135')).toBe(true);
    expect(portCallDisappeared('digitraffic:portcall:3405135:TLL-HEL', ids)).toBe(false);
    expect(portCallDisappeared('digitraffic:portcall:999:TLL-HEL', ids)).toBe(true);
    expect(portCallDisappeared('digitraffic:portcall:999:TLL-HEL', null)).toBe(false);
    const t = cancelSuspectTrigger({
      etaIso: ETA, departureIso: DEP, nowMs: NOW.getTime(),
      sourceRef: 'digitraffic:portcall:999:TLL-HEL', activePortCallIds: ids,
    });
    expect(t.due).toBe(true);
    expect(t.disappeared).toBe(true);
    expect(t.check).toBe(true);
  });
});

describe('BN3 ferry-portnet × cancel-suspect AIS', () => {
  it('ETA+45 + AIS SOG≈0 w HEL → FERRY MEDIUM; status bez zmian', async () => {
    const st = new MemStore();
    st.sailings.push(gulfSailing());
    const statusBefore = st.sailings[0]!.status;
    const r = await runFerryPortnet(deps(st, {
      'port-calls': JSON.stringify({ portCalls: [] }),
      'locations?mmsi=': AIS_STAND,
    }));
    expect(r.ok).toBe(true);
    const risks = st.risks.filter((x) => x.dedup.startsWith('FERRY_CANCEL_SUSPECT:'));
    expect(risks).toHaveLength(1);
    expect(risks[0]!.severity).toBe('MEDIUM');
    expect(risks[0]!.titleKey).toBe('rk_ferry_cancel_suspect');
    expect(risks[0]!.dedup).toBe(cancelSuspectRiskDedup('s-gulf-1'));
    expect(st.sailings[0]!.status).toBe(statusBefore);
    expect(st.sailings[0]!.actual_arrival_at).toBeNull();
    expect(r.observations?.cancel_suspect_hits).toBe('1');
  });

  it('ETA+45 + AIS w ruchu (SOG≥3) → bez ryzyka', async () => {
    const st = new MemStore();
    st.sailings.push(gulfSailing());
    await runFerryPortnet(deps(st, {
      'port-calls': JSON.stringify({ portCalls: [] }),
      'locations?mmsi=': AIS_MOVE,
    }));
    expect(st.risks.filter((x) => x.dedup.startsWith('FERRY_CANCEL_SUSPECT:'))).toHaveLength(0);
    expect(st.sailings[0]!.status).toBe('W_REJSIE');
  });

  it('ETA+30 (przed progiem) → bez ryzyka mimo AIS w porcie', async () => {
    const st = new MemStore();
    st.sailings.push(gulfSailing({
      arrival_at: '2026-10-30T10:30:00.000Z',
      departure_at: '2026-10-30T08:00:00.000Z',
    }));
    /* now 11:00; ETA 10:30 → +30 min < 45 */
    await runFerryPortnet(deps(st, {
      'port-calls': JSON.stringify({ portCalls: [] }),
      'locations?mmsi=': AIS_STAND,
    }));
    expect(st.risks.filter((x) => x.dedup.startsWith('FERRY_CANCEL_SUSPECT:'))).toHaveLength(0);
  });

  it('ODWOLANY → bez nowego podejrzenia', async () => {
    const st = new MemStore();
    st.sailings.push(gulfSailing({ status: 'ODWOLANY' }));
    await runFerryPortnet(deps(st, {
      'port-calls': JSON.stringify({ portCalls: [] }),
      'locations?mmsi=': AIS_STAND,
    }));
    expect(st.risks.filter((x) => x.dedup.startsWith('FERRY_CANCEL_SUSPECT:'))).toHaveLength(0);
  });

  it('DOPLYNAL / z ATA → bez ryzyka; zniknięcie ryzyka gdy AIS już nie stoi', async () => {
    const st = new MemStore();
    st.sailings.push(gulfSailing({ id: 's-ata', actual_arrival_at: '2026-10-30T10:05:00.000Z', status: 'DOPLYNAL' }));
    await runFerryPortnet(deps(st, {
      'port-calls': JSON.stringify({ portCalls: [] }),
      'locations?mmsi=': AIS_STAND,
    }));
    expect(st.risks.filter((x) => x.dedup.startsWith('FERRY_CANCEL_SUSPECT:'))).toHaveLength(0);

    st.sailings = [gulfSailing()];
    await runFerryPortnet(deps(st, {
      'port-calls': JSON.stringify({ portCalls: [] }),
      'locations?mmsi=': AIS_STAND,
    }));
    expect(st.risks.filter((x) => x.dedup.startsWith('FERRY_CANCEL_SUSPECT:'))).toHaveLength(1);

    await runFerryPortnet(deps(st, {
      'port-calls': JSON.stringify({ portCalls: [] }),
      'locations?mmsi=': AIS_MOVE,
    }));
    expect(st.risks.filter((x) => x.dedup.startsWith('FERRY_CANCEL_SUSPECT:'))).toHaveLength(0);
  });

  it('Portnet zniknął (source_ref) + AIS stoi → ryzyko nawet gdy ETA+30', async () => {
    const st = new MemStore();
    st.sailings.push(gulfSailing({
      id: 's-gone',
      arrival_at: '2026-10-30T10:30:00.000Z',
      source_ref: 'digitraffic:portcall:999001:TLL-HEL',
      source: 'VIKING',
      route: 'TLLA-HEL',
      vessel_id: MEGA,
    }));
    await runFerryPortnet(deps(st, {
      'port-calls': JSON.stringify({ portCalls: [] }),
      'locations?mmsi=': AIS_STAND,
    }));
    const risks = st.risks.filter((x) => x.dedup.startsWith('FERRY_CANCEL_SUSPECT:'));
    expect(risks).toHaveLength(1);
    expect(risks[0]!.detail).toMatchObject({ powod: 'PORTCALL_GONE' });
    expect(st.sailings[0]!.status).toBe('W_REJSIE');
  });

  it('RECZNIE: nadal ryzyko, bez zmiany statusu', async () => {
    const st = new MemStore();
    st.sailings.push(gulfSailing({ source: 'RECZNIE', status: 'ZAPLANOWANY' }));
    await runFerryPortnet(deps(st, {
      'port-calls': JSON.stringify({ portCalls: [] }),
      'locations?mmsi=': AIS_STAND,
    }));
    expect(st.risks.some((x) => x.dedup === cancelSuspectRiskDedup('s-gulf-1'))).toBe(true);
    expect(st.sailings[0]!.status).toBe('ZAPLANOWANY');
  });
});
