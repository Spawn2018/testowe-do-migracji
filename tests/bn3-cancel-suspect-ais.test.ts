/**
 * BN3 decyzja 61 / F7 #696 r1 — podejrzenie odwołania: ETA+45…+6 h bez ATA
 * + AIS stoi w **porcie wyjścia** → FERRY MEDIUM. Bez zmiany statusu.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  cancelSuspectDue, cancelSuspectRiskDedup, cancelSuspectTrigger,
  collectPortCallIds, departureHubsForRoute, isFreshAisFix, isStandingAtDeparturePort,
  isStandingInGulfPort, mergePortCallIdsIfComplete, portCallDisappeared,
  CANCEL_SUSPECT_MAX_SOG_KN, CANCEL_SUSPECT_WINDOW_AFTER_ETA_H, GULF_FERRY_ROUTES,
} from '../supabase/functions/_shared/ferry/cancelSuspect';
import { parseDigitrafficLocations } from '../supabase/functions/_shared/ferry/digitraffic';
import {
  runFerryPortnet, type JobDeps, type JobResult, type SyncStore,
} from '../supabase/functions/_shared/integrations/jobs';
import type { DbSailing, RiskInput, SailingInsert, SailingPatch } from '../supabase/functions/_shared/integrations/sync';

const fx = (n: string) => readFileSync(new URL(`./fixtures/${n}`, import.meta.url), 'utf8');
const PORTNET = fx('digitraffic-port-calls-megastar-2026-10-29.json');
const AIS_TLL = fx('digitraffic-ais-standing-tll-synthetic.json');
const AIS_HEL = fx('digitraffic-ais-standing-hel-synthetic.json');
const AIS_MOVE = fx('digitraffic-ais-moving-synthetic.json');
const MEGA = 'v-mega';
/** ETA 10:00Z → okno 10:45…16:00; now 11:00 = w oknie. */
const NOW = new Date('2026-10-30T11:00:00Z');
const ETA = '2026-10-30T10:00:00.000Z';
const DEP = '2026-10-30T07:30:00.000Z';
/** Niepusta pula Portnet bez id rejsu testowego — komplet do „zniknięcia”. */
const PORTNET_OTHER = JSON.stringify({
  portCalls: [{ portCallId: 111, vessel: { name: 'Other' }, portAreaDetails: [] }],
});

function aisJson(o: {
  lat: number; lon: number; sog?: number | null; tsMs?: number; mmsi?: number;
}): string {
  const mmsi = o.mmsi ?? 276829000;
  const props: Record<string, unknown> = {
    mmsi, cog: 90, navStat: 1, rot: 0, heading: 90, timestamp: 0,
    timestampExternal: o.tsMs ?? Date.parse('2026-10-30T10:50:00Z'),
  };
  if (o.sog !== null && o.sog !== undefined) props.sog = o.sog;
  return JSON.stringify({
    type: 'FeatureCollection',
    features: [{
      mmsi, type: 'Feature',
      geometry: { type: 'Point', coordinates: [o.lon, o.lat] },
      properties: props,
    }],
  });
}

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

describe('BN3 cancel-suspect helpers (F7 #696 r1)', () => {
  it('trasy zatoki + okno ETA grace…+6 h (B6)', () => {
    expect(GULF_FERRY_ROUTES.has('TLL-HEL')).toBe(true);
    expect(GULF_FERRY_ROUTES.has('GDY-KAA')).toBe(false);
    const eta = '2026-10-30T10:00:00.000Z';
    expect(cancelSuspectDue(eta, Date.parse('2026-10-30T10:44:00Z'))).toBe(false);
    expect(cancelSuspectDue(eta, Date.parse('2026-10-30T10:45:00Z'))).toBe(true);
    expect(cancelSuspectDue(eta, Date.parse('2026-10-30T16:00:00Z'))).toBe(true);
    expect(cancelSuspectDue(eta, Date.parse('2026-10-30T16:00:01Z'))).toBe(false);
    expect(CANCEL_SUSPECT_WINDOW_AFTER_ETA_H).toBe(6);
  });

  it('B1: hub wyjścia TLL-HEL = Vanasadam; HEL ≠ wyjście', () => {
    const hubs = departureHubsForRoute('TLL-HEL');
    expect(hubs.map((h) => h.code).sort()).toEqual(['TLL', 'TLL_D']);
    const atTll = parseDigitrafficLocations(JSON.parse(AIS_TLL), 276829000)!;
    const atHel = parseDigitrafficLocations(JSON.parse(AIS_HEL), 276829000)!;
    expect(isStandingAtDeparturePort(atTll, 'TLL-HEL')).toBe(true);
    expect(isStandingAtDeparturePort(atHel, 'TLL-HEL')).toBe(false);
    expect(isStandingAtDeparturePort(atHel, 'HEL-TLL')).toBe(true);
  });

  it('B3: brak SOG ≠ stoi; próg SOG na granicy (M12)', () => {
    const base = parseDigitrafficLocations(JSON.parse(AIS_TLL), 276829000)!;
    expect(isStandingAtDeparturePort({ ...base, sogKn: null }, 'TLL-HEL')).toBe(false);
    expect(isStandingAtDeparturePort({ ...base, sogKn: undefined }, 'TLL-HEL')).toBe(false);
    expect(isStandingAtDeparturePort({ ...base, sogKn: CANCEL_SUSPECT_MAX_SOG_KN }, 'TLL-HEL')).toBe(true);
    expect(isStandingAtDeparturePort({ ...base, sogKn: CANCEL_SUSPECT_MAX_SOG_KN + 0.01 }, 'TLL-HEL')).toBe(false);
    expect(isStandingInGulfPort({ ...base, sogKn: null })).toBe(false);
  });

  it('B2: świeżość AIS ≤ 60 min', () => {
    const fix = parseDigitrafficLocations(JSON.parse(AIS_TLL), 276829000)!;
    expect(isFreshAisFix(fix, NOW.toISOString())).toBe(true);
    expect(isFreshAisFix({
      ...fix,
      timestampUtc: '2025-10-30T12:00:00.000Z',
    }, NOW.toISOString())).toBe(false);
  });

  it('B5: mergePortCallIdsIfComplete — pusta / jedna strona → null', () => {
    expect(mergePortCallIdsIfComplete({
      etaOk: true, etdOk: true,
      etaJson: { portCalls: [] }, etdJson: { portCalls: [] },
    })).toBeNull();
    expect(mergePortCallIdsIfComplete({
      etaOk: true, etdOk: false,
      etaJson: JSON.parse(PORTNET_OTHER), etdJson: null,
    })).toBeNull();
    const ids = mergePortCallIdsIfComplete({
      etaOk: true, etdOk: true,
      etaJson: JSON.parse(PORTNET_OTHER),
      etdJson: { portCalls: [{ portCallId: 222 }] },
    });
    expect(ids?.has('111')).toBe(true);
    expect(ids?.has('222')).toBe(true);
  });

  it('portCallDisappeared + trigger w oknie ETA', () => {
    const ids = collectPortCallIds(JSON.parse(PORTNET));
    expect(portCallDisappeared('digitraffic:portcall:999:TLL-HEL', ids)).toBe(true);
    expect(portCallDisappeared('digitraffic:portcall:999:TLL-HEL', null)).toBe(false);
    const t = cancelSuspectTrigger({
      etaIso: ETA, departureIso: DEP, nowMs: NOW.getTime(),
      sourceRef: 'digitraffic:portcall:999:TLL-HEL', activePortCallIds: ids,
    });
    expect(t.due).toBe(true);
    expect(t.disappeared).toBe(true);
  });

  it('M9: zniknięcie bez odejścia (dep w przyszłości) → bez disappeared', () => {
    const t = cancelSuspectTrigger({
      etaIso: ETA,
      departureIso: '2026-10-30T12:00:00.000Z',
      nowMs: NOW.getTime(),
      sourceRef: 'digitraffic:portcall:999:TLL-HEL',
      activePortCallIds: new Set(['1']),
    });
    expect(t.due).toBe(true);
    expect(t.disappeared).toBe(false);
    expect(t.check).toBe(true);
  });
});

describe('BN3 ferry-portnet × cancel-suspect AIS (F7 #696 r1)', () => {
  it('ETA+45 + AIS SOG≈0 w porcie wyjścia (TLL) → FERRY MEDIUM; status bez zmian', async () => {
    const st = new MemStore();
    st.sailings.push(gulfSailing());
    const statusBefore = st.sailings[0]!.status;
    const r = await runFerryPortnet(deps(st, {
      'port-calls': PORTNET_OTHER,
      'locations?mmsi=': AIS_TLL,
    }));
    expect(r.ok).toBe(true);
    const risks = st.risks.filter((x) => x.dedup.startsWith('FERRY_CANCEL_SUSPECT:'));
    expect(risks).toHaveLength(1);
    expect(risks[0]!.severity).toBe('MEDIUM');
    expect(risks[0]!.titleKey).toBe('rk_ferry_cancel_suspect');
    expect(risks[0]!.dedup).toBe(cancelSuspectRiskDedup('s-gulf-1'));
    expect(risks[0]!.detail).toMatchObject({ hub: 'TLL' });
    expect(st.sailings[0]!.status).toBe(statusBefore);
    expect(st.sailings[0]!.actual_arrival_at).toBeNull();
    expect(r.observations?.cancel_suspect_hits).toBe('1');
  });

  it('B1: AIS w HEL przy TLL-HEL → bez ryzyka (port docelowy)', async () => {
    const st = new MemStore();
    st.sailings.push(gulfSailing());
    await runFerryPortnet(deps(st, {
      'port-calls': PORTNET_OTHER,
      'locations?mmsi=': AIS_HEL,
    }));
    expect(st.risks.filter((x) => x.dedup.startsWith('FERRY_CANCEL_SUSPECT:'))).toHaveLength(0);
  });

  it('B1/M8: geofence — AIS 300 km od hubu → bez ryzyka', async () => {
    const st = new MemStore();
    st.sailings.push(gulfSailing());
    await runFerryPortnet(deps(st, {
      'port-calls': PORTNET_OTHER,
      'locations?mmsi=': aisJson({ lat: 55.0, lon: 20.0, sog: 0.1 }),
    }));
    expect(st.risks.filter((x) => x.dedup.startsWith('FERRY_CANCEL_SUSPECT:'))).toHaveLength(0);
  });

  it('B2: stary AIS (rok wstecz) → bez ryzyka', async () => {
    const st = new MemStore();
    st.sailings.push(gulfSailing());
    await runFerryPortnet(deps(st, {
      'port-calls': PORTNET_OTHER,
      'locations?mmsi=': aisJson({
        lat: 59.443, lon: 24.77, sog: 0.2,
        tsMs: Date.parse('2025-10-30T12:00:00Z'),
      }),
    }));
    expect(st.risks.filter((x) => x.dedup.startsWith('FERRY_CANCEL_SUSPECT:'))).toHaveLength(0);
  });

  it('B3: brak pola sog → bez ryzyka', async () => {
    const st = new MemStore();
    st.sailings.push(gulfSailing());
    await runFerryPortnet(deps(st, {
      'port-calls': PORTNET_OTHER,
      'locations?mmsi=': aisJson({ lat: 59.443, lon: 24.77, sog: null }),
    }));
    expect(st.risks.filter((x) => x.dedup.startsWith('FERRY_CANCEL_SUSPECT:'))).toHaveLength(0);
  });

  it('ETA+45 + AIS w ruchu → bez ryzyka', async () => {
    const st = new MemStore();
    st.sailings.push(gulfSailing());
    await runFerryPortnet(deps(st, {
      'port-calls': PORTNET_OTHER,
      'locations?mmsi=': AIS_MOVE,
    }));
    expect(st.risks.filter((x) => x.dedup.startsWith('FERRY_CANCEL_SUSPECT:'))).toHaveLength(0);
  });

  it('B6: ETA+7 h (poza oknem) → bez ryzyka mimo AIS w TLL', async () => {
    const st = new MemStore();
    st.sailings.push(gulfSailing());
    const late = new Date('2026-10-30T17:05:00Z');
    await runFerryPortnet(deps(st, {
      'port-calls': PORTNET_OTHER,
      'locations?mmsi=': aisJson({
        lat: 59.443, lon: 24.77, sog: 0.2,
        tsMs: Date.parse('2026-10-30T17:00:00Z'),
      }),
    }, late));
    expect(st.risks.filter((x) => x.dedup.startsWith('FERRY_CANCEL_SUSPECT:'))).toHaveLength(0);
  });

  it('ETA+30 (przed progiem) → bez ryzyka', async () => {
    const st = new MemStore();
    st.sailings.push(gulfSailing({
      arrival_at: '2026-10-30T10:30:00.000Z',
      departure_at: '2026-10-30T08:00:00.000Z',
    }));
    await runFerryPortnet(deps(st, {
      'port-calls': PORTNET_OTHER,
      'locations?mmsi=': AIS_TLL,
    }));
    expect(st.risks.filter((x) => x.dedup.startsWith('FERRY_CANCEL_SUSPECT:'))).toHaveLength(0);
  });

  it('ODWOLANY → bez nowego podejrzenia', async () => {
    const st = new MemStore();
    st.sailings.push(gulfSailing({ status: 'ODWOLANY' }));
    await runFerryPortnet(deps(st, {
      'port-calls': PORTNET_OTHER,
      'locations?mmsi=': AIS_TLL,
    }));
    expect(st.risks.filter((x) => x.dedup.startsWith('FERRY_CANCEL_SUSPECT:'))).toHaveLength(0);
  });

  it('M11: actual_arrival_at bez DOPLYNAL → bez ryzyka', async () => {
    const st = new MemStore();
    st.sailings.push(gulfSailing({
      actual_arrival_at: '2026-10-30T10:05:00.000Z',
      status: 'W_REJSIE',
    }));
    await runFerryPortnet(deps(st, {
      'port-calls': PORTNET_OTHER,
      'locations?mmsi=': AIS_TLL,
    }));
    expect(st.risks.filter((x) => x.dedup.startsWith('FERRY_CANCEL_SUSPECT:'))).toHaveLength(0);
  });

  it('DOPLYNAL → bez; potem resolve gdy AIS nie stoi', async () => {
    const st = new MemStore();
    st.sailings.push(gulfSailing({
      id: 's-ata', actual_arrival_at: '2026-10-30T10:05:00.000Z', status: 'DOPLYNAL',
    }));
    await runFerryPortnet(deps(st, {
      'port-calls': PORTNET_OTHER,
      'locations?mmsi=': AIS_TLL,
    }));
    expect(st.risks.filter((x) => x.dedup.startsWith('FERRY_CANCEL_SUSPECT:'))).toHaveLength(0);

    st.sailings = [gulfSailing()];
    await runFerryPortnet(deps(st, {
      'port-calls': PORTNET_OTHER,
      'locations?mmsi=': AIS_TLL,
    }));
    expect(st.risks.filter((x) => x.dedup.startsWith('FERRY_CANCEL_SUSPECT:'))).toHaveLength(1);

    await runFerryPortnet(deps(st, {
      'port-calls': PORTNET_OTHER,
      'locations?mmsi=': AIS_MOVE,
    }));
    expect(st.risks.filter((x) => x.dedup.startsWith('FERRY_CANCEL_SUSPECT:'))).toHaveLength(0);
  });

  it('B5: pusta odpowiedź Portnet ≠ zniknięcie (nawet z source_ref)', async () => {
    const st = new MemStore();
    st.sailings.push(gulfSailing({
      id: 's-empty',
      source_ref: 'digitraffic:portcall:999001:TLL-HEL',
      source: 'VIKING',
    }));
    /* ETA+45 i tak w oknie — ale powod nie PORTCALL_GONE gdy ids=null; AIS w TLL → ETA_GRACE. */
    await runFerryPortnet(deps(st, {
      'port-calls': JSON.stringify({ portCalls: [] }),
      'locations?mmsi=': AIS_TLL,
    }));
    const risks = st.risks.filter((x) => x.dedup.startsWith('FERRY_CANCEL_SUSPECT:'));
    expect(risks).toHaveLength(1);
    expect(risks[0]!.detail).toMatchObject({ powod: 'ETA_GRACE' });
  });

  it('Portnet zniknął (kompletna pula bez id) + AIS w TLL → PORTCALL_GONE/BOTH', async () => {
    const st = new MemStore();
    st.sailings.push(gulfSailing({
      id: 's-gone',
      source_ref: 'digitraffic:portcall:999001:TLL-HEL',
      source: 'VIKING',
      route: 'TLLA-HEL',
    }));
    await runFerryPortnet(deps(st, {
      'port-calls': PORTNET_OTHER,
      'locations?mmsi=': AIS_TLL,
    }));
    const risks = st.risks.filter((x) => x.dedup.startsWith('FERRY_CANCEL_SUSPECT:'));
    expect(risks).toHaveLength(1);
    expect(['PORTCALL_GONE', 'BOTH']).toContain(
      (risks[0]!.detail as { powod?: string }).powod,
    );
    expect(st.sailings[0]!.status).toBe('W_REJSIE');
  });

  it('M1: zniknięcie bez AIS (HTTP 503) → SOURCE_DOWN, bez fałszywego stoi; keep', async () => {
    const st = new MemStore();
    st.sailings.push(gulfSailing({
      id: 's-down',
      source_ref: 'digitraffic:portcall:999:TLL-HEL',
    }));
    st.risks.push({
      kind: 'FERRY', severity: 'MEDIUM', title: 'x', titleKey: 'rk_ferry_cancel_suspect',
      dedup: cancelSuspectRiskDedup('s-down'), detail: {},
    });
    await runFerryPortnet(deps(st, {
      'port-calls': PORTNET_OTHER,
      'locations?mmsi=': 503,
    }));
    expect(st.risks.some((x) => x.dedup === cancelSuspectRiskDedup('s-down'))).toBe(true);
    expect(st.risks.some((x) => x.dedup.startsWith('SOURCE_DOWN:DIGITRAFFIC_AIS:'))).toBe(true);
  });

  it('M7/B4: AIS HTTP≠200 ≠ stoi; SOURCE_DOWN; nie zamyka istniejącego', async () => {
    const st = new MemStore();
    st.sailings.push(gulfSailing());
    st.risks.push({
      kind: 'FERRY', severity: 'MEDIUM', title: 'x', titleKey: 'rk_ferry_cancel_suspect',
      dedup: cancelSuspectRiskDedup('s-gulf-1'), detail: {},
    });
    await runFerryPortnet(deps(st, {
      'port-calls': PORTNET_OTHER,
      'locations?mmsi=': 503,
    }));
    expect(st.risks.filter((x) => x.dedup === cancelSuspectRiskDedup('s-gulf-1'))).toHaveLength(1);
    expect(st.risks.some((x) => x.dedup.startsWith('SOURCE_DOWN:DIGITRAFFIC_AIS:'))).toBe(true);
  });

  it('M6: dedup per rejs (nie wspólny) — dwa rejsy → dwa ryzyka', async () => {
    const st = new MemStore();
    st.sailings.push(gulfSailing({ id: 's-a' }));
    st.sailings.push(gulfSailing({
      id: 's-b', vessel_id: 'v-xprs',
      departure_at: '2026-10-30T08:00:00.000Z',
    }));
    await runFerryPortnet(deps(st, {
      'port-calls': PORTNET_OTHER,
      'locations?mmsi=276829000': AIS_TLL,
      'locations?mmsi=230705000': aisJson({
        lat: 59.443, lon: 24.77, sog: 0.1, mmsi: 230705000,
      }),
    }));
    const risks = st.risks.filter((x) => x.dedup.startsWith('FERRY_CANCEL_SUSPECT:'));
    expect(risks.map((r) => r.dedup).sort()).toEqual([
      cancelSuspectRiskDedup('s-a'),
      cancelSuspectRiskDedup('s-b'),
    ]);
    /* asercja bez użycia cancelSuspectRiskDedup w liczeniu — jawne stringi */
    expect(new Set(risks.map((r) => r.dedup)).size).toBe(2);
  });

  it('RECZNIE: nadal ryzyko, bez zmiany statusu', async () => {
    const st = new MemStore();
    st.sailings.push(gulfSailing({ source: 'RECZNIE', status: 'ZAPLANOWANY' }));
    await runFerryPortnet(deps(st, {
      'port-calls': PORTNET_OTHER,
      'locations?mmsi=': AIS_TLL,
    }));
    expect(st.risks.some((x) => x.dedup === cancelSuspectRiskDedup('s-gulf-1'))).toBe(true);
    expect(st.sailings[0]!.status).toBe('ZAPLANOWANY');
  });

  it('closeStaleFiToEe: podejrzenie (ten sam przebieg) blokuje auto-DOPLYNAL (decyzja 61b)', async () => {
    const st = new MemStore();
    /* HEL-TLL, arrival +2 h minione, AIS stoi w HEL (wyjście) — cancel-suspect przed closeStale. */
    st.sailings.push(gulfSailing({
      id: 's-hel',
      route: 'HEL-TLL',
      departure_at: '2026-10-30T06:00:00.000Z',
      arrival_at: '2026-10-30T08:00:00.000Z',
      status: 'W_REJSIE',
    }));
    const now = new Date('2026-10-30T11:00:00Z');
    await runFerryPortnet(deps(st, {
      'port-calls': PORTNET_OTHER,
      'locations?mmsi=': aisJson({
        lat: 60.153, lon: 24.915, sog: 0.1,
        tsMs: Date.parse('2026-10-30T10:50:00Z'),
      }),
    }, now));
    expect(st.risks.some((x) => x.dedup === cancelSuspectRiskDedup('s-hel'))).toBe(true);
    expect(st.sailings[0]!.status).toBe('W_REJSIE');
  });
});
