/**
 * BN3 pkt 7–8 — winter-navigation v2 + sonda port-call v2 + DP-11.
 * F7 #694 r1: R1-B1 bez ryzyka v2; R1-B2 locode z tras; R1-B3 testy joba.
 * Etap: BN3 / #573 decyzja 61.
 */
import { afterEach, describe, expect, it } from 'vitest';
import {
  applyFerryDictSnapshot, operatorsForRoute, resetFerryDictRpc,
} from '../src/lib/ferryCatalog';
import {
  isWinterNavWindowActive, parseWinterNavigationLocations, portCallV2CancelledHasFihel,
  winterNavIceRisk, winterNavRiskDedup, WINTER_NAV_LOCATIONS_URL,
} from '../supabase/functions/_shared/ferry/winterNavigation';
import {
  runFerryPortnet, type JobDeps, type JobResult, type SyncStore,
} from '../supabase/functions/_shared/integrations/jobs';
import type { DbSailing, RiskInput, SailingInsert, SailingPatch } from '../supabase/functions/_shared/integrations/sync';
import { readFileSync } from 'node:fs';

const PORTNET = readFileSync(new URL('./fixtures/digitraffic-port-calls-megastar-2026-10-29.json', import.meta.url), 'utf8');
const NOW = new Date('2026-02-10T12:00:00Z');
const MEGA = 'v-mega';

afterEach(() => {
  resetFerryDictRpc();
});

function winterFc(locode: string, name: string, active = true) {
  return {
    type: 'FeatureCollection',
    lastUpdated: '2026-02-10T10:00:00Z',
    features: [{
      type: 'Feature',
      properties: {
        name,
        locodeList: locode,
        restrictions: active ? [{
          startTime: '2026-02-01T00:00:00Z',
          endTime: '2026-02-20T00:00:00Z',
          textCompilation: 'I 2000',
        }] : [],
        suspensions: [],
      },
    }],
  };
}

class MemStore implements SyncStore {
  sailings: DbSailing[] = [];
  risks: (RiskInput & { loadId?: string })[] = [];
  runs: { job: string; at: string; ok: boolean; result: JobResult }[] = [];
  n = 0;
  async projectId() { return 'p1'; }
  async vessels() {
    return [{ id: MEGA, name: 'M/F Megastar', mmsi: 276829000 }];
  }
  async sailingsSince(from: string) {
    return this.sailings.filter((s) => s.departure_at >= from).map((s) => ({ ...s }));
  }
  async maxVikingFileDepartureAt() { return null; }
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
    Object.assign(s, patch);
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
  delayMin = 15;
  async ferryPortDelayMin() { return this.delayMin; }
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
    if (url.includes('port-call/v2')) {
      return new Response('[]', { status: 200 });
    }
    /* BN3 UMG: pusty Port Gdynia (bez Stena) — nie wywraca winter-nav. */
    if (url.includes('umgdy.gov.pl')) {
      return new Response(
        '<html><body><h2>Port Gdynia</h2><table class="table table-striped"><tr><th>Call ID</th></tr></table></body></html>',
        { status: 200 },
      );
    }
    if (url.includes('ts.ee') || url.includes('portsofstockholm')) {
      return new Response('niedostepne', { status: 503 });
    }
    throw new Error(`nieoczekiwane zapytanie: ${url}`);
  }) as typeof fetch;
  return { store, fetch: f, env: {}, now: () => now };
}

describe('BN3 winter-nav / MMSI / DP-11', () => {
  it('DP-11: operatorsForRoute — RPC przed seedem (TLL-HEL tylko TALLINK z bazy)', () => {
    expect(operatorsForRoute('TLL-HEL')).toEqual(['TALLINK', 'VIKING', 'ECKERO']);
    applyFerryDictSnapshot({
      operators: [{ code: 'TALLINK', name: 'Tallink' }],
      ports: [],
      routes: [{
        code: 'TLL-HEL',
        port_from: 'TLL',
        port_to: 'HEL',
        family_key: 'TLL-HEL',
        operators: ['TALLINK'],
      }],
    });
    expect(operatorsForRoute('TLL-HEL')).toEqual(['TALLINK']);
    expect(operatorsForRoute('GDN-NYN')).toEqual(['POLFERRIES']);
  });

  it('isWinterNavWindowActive: start/end względem now', () => {
    const now = Date.parse('2026-02-10T12:00:00Z');
    expect(isWinterNavWindowActive('2026-02-01T00:00:00Z', '2026-02-20T00:00:00Z', now)).toBe(true);
    expect(isWinterNavWindowActive('2026-02-15T00:00:00Z', '2026-02-20T00:00:00Z', now)).toBe(false);
    expect(isWinterNavWindowActive('2026-01-01T00:00:00Z', '2026-02-01T00:00:00Z', now)).toBe(false);
    expect(isWinterNavWindowActive('2026-02-01T00:00:00Z', null, now)).toBe(true);
  });

  it('parseWinterNavigationLocations: aktywne ograniczenie FIHEL → hit; przeszłe pominięte', () => {
    const json = {
      type: 'FeatureCollection',
      lastUpdated: '2026-02-10T10:00:00Z',
      features: [{
        type: 'Feature',
        properties: {
          name: 'HELSINKI',
          locodeList: 'FIHEL',
          restrictions: [
            {
              startTime: '2026-02-01T00:00:00Z',
              endTime: '2026-02-20T00:00:00Z',
              textCompilation: 'I 2000',
            },
            {
              startTime: '2026-01-01T00:00:00Z',
              endTime: '2026-01-15T00:00:00Z',
              textCompilation: 'II 2000',
            },
          ],
          suspensions: [{
            startTime: '2026-02-09T00:00:00Z',
            endTime: '2026-02-11T00:00:00Z',
            textCompilation: 'ice class required',
          }],
        },
      }, {
        type: 'Feature',
        properties: {
          name: 'BOHUS',
          locodeList: 'SEBOH',
          restrictions: [{
            startTime: '2026-02-01T00:00:00Z',
            endTime: '2026-03-01T00:00:00Z',
            textCompilation: 'I 2000',
          }],
        },
      }],
    };
    const parsed = parseWinterNavigationLocations(json, '2026-02-10T12:00:00Z');
    expect(parsed.hits).toHaveLength(2);
    expect(parsed.hits.map((h) => h.kind).sort()).toEqual(['RESTRICTION', 'SUSPENSION']);
    expect(parsed.hits.every((h) => h.locode === 'FIHEL')).toBe(true);
    expect(winterNavRiskDedup(parsed.hits[0]!)).toMatch(/^FERRY_WINTER:FIHEL:/);
    expect(winterNavIceRisk(parsed.hits[0]!, '2026-02-10T12:00:00Z').severity).toBe('MEDIUM');
  });

  it('F7 #694 R1-B2: lokacja spoza tras (LVRIX / SEMMA) → brak trafienia', () => {
    const json = {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        properties: {
          name: 'RIGA',
          locodeList: 'LVRIX',
          restrictions: [{
            startTime: '2026-02-01T00:00:00Z',
            endTime: '2026-03-01T00:00:00Z',
            textCompilation: 'I 2000',
          }],
        },
      }, {
        type: 'Feature',
        properties: {
          name: 'MALMO',
          locodeList: 'SEMMA',
          suspensions: [{
            startTime: '2026-02-01T00:00:00Z',
            endTime: '2026-03-01T00:00:00Z',
            textCompilation: 'closed',
          }],
        },
      }],
    };
    const parsed = parseWinterNavigationLocations(json, '2026-02-10T12:00:00Z');
    expect(parsed.hits).toEqual([]);
  });

  it('parseWinterNavigationLocations: brak FeatureCollection → ostrzeżenie struktury', () => {
    const parsed = parseWinterNavigationLocations(null, '2026-02-10T12:00:00Z');
    expect(parsed.hits).toEqual([]);
    expect(parsed.warnings.some((w) => /struktura/i.test(w))).toBe(true);
  });

  it('F7 #694 R1-B1: portCallV2 — {} / nieznana struktura → count 0; lista → hasFihel bez ryzyka w jobie', () => {
    expect(portCallV2CancelledHasFihel({})).toEqual({ hasFihel: false, count: 0, warnings: [] });
    const unknown = portCallV2CancelledHasFihel({ foo: 1 });
    expect(unknown.count).toBe(0);
    expect(unknown.hasFihel).toBe(false);
    expect(unknown.warnings.some((w) => /nieznane klucze/i.test(w))).toBe(true);
    const withVisits = portCallV2CancelledHasFihel({ visits: [{ id: 1 }, { id: 2 }] });
    expect(withVisits.hasFihel).toBe(true);
    expect(withVisits.count).toBe(2);
  });
});

describe('F7 #694 R1-B3 ferry-portnet × winter-nav', () => {
  it('aktywne ograniczenie → 1× MEDIUM; drugi przebieg bez nowego; zniknięcie → zamknięte', async () => {
    const st = new MemStore();
    const pagesActive = {
      'port-calls': PORTNET,
      'winter-navigation': JSON.stringify(winterFc('FIHEL', 'HELSINKI')),
    };
    const r1 = await runFerryPortnet(deps(st, pagesActive));
    expect(r1.ok).toBe(true);
    const winter = st.risks.filter((r) => r.dedup.startsWith('FERRY_WINTER:'));
    expect(winter).toHaveLength(1);
    expect(winter[0]!.severity).toBe('MEDIUM');
    expect(winter[0]!.dedup).toBe('FERRY_WINTER:FIHEL:RESTRICTION');

    const r2 = await runFerryPortnet(deps(st, pagesActive));
    expect(r2.ok).toBe(true);
    expect(st.risks.filter((r) => r.dedup.startsWith('FERRY_WINTER:'))).toHaveLength(1);

    const pagesGone = {
      'port-calls': PORTNET,
      'winter-navigation': JSON.stringify(winterFc('FIHEL', 'HELSINKI', false)),
    };
    await runFerryPortnet(deps(st, pagesGone));
    expect(st.risks.filter((r) => r.dedup.startsWith('FERRY_WINTER:'))).toHaveLength(0);
  });

  it('HTTP 503 winter-nav → SOURCE_DOWN DIGITRAFFIC_WINTER MEDIUM; sukces → zamknięte', async () => {
    const st = new MemStore();
    const rFail = await runFerryPortnet(deps(st, {
      'port-calls': PORTNET,
      'winter-navigation': 503,
    }));
    expect(rFail.ok).toBe(true);
    const down = st.risks.filter((r) => r.dedup.startsWith('SOURCE_DOWN:DIGITRAFFIC_WINTER'));
    expect(down).toHaveLength(1);
    expect(down[0]!.severity).toBe('MEDIUM');

    await runFerryPortnet(deps(st, {
      'port-calls': PORTNET,
      'winter-navigation': JSON.stringify({ type: 'FeatureCollection', features: [] }),
    }));
    expect(st.risks.filter((r) => r.dedup.startsWith('SOURCE_DOWN:DIGITRAFFIC_WINTER'))).toHaveLength(0);
  });

  it('zła struktura winter-nav → SOURCE_DOWN DIGITRAFFIC_WINTER MEDIUM', async () => {
    const st = new MemStore();
    await runFerryPortnet(deps(st, {
      'port-calls': PORTNET,
      'winter-navigation': JSON.stringify({ type: 'NotFeatureCollection', features: [] }),
    }));
    const down = st.risks.filter((r) => r.dedup.startsWith('SOURCE_DOWN:DIGITRAFFIC_WINTER'));
    expect(down).toHaveLength(1);
    expect(down[0]!.severity).toBe('MEDIUM');
    expect(String(down[0]!.sourceUrl ?? WINTER_NAV_LOCATIONS_URL)).toContain('winter-navigation');
  });

  it('v2 cancelled z wizytami → brak ryzyka (tylko observations)', async () => {
    const st = new MemStore();
    const r = await runFerryPortnet(deps(st, {
      'port-calls': PORTNET,
      'winter-navigation': JSON.stringify({ type: 'FeatureCollection', features: [] }),
      'port-call/v2': JSON.stringify({ visits: [{ id: 1 }] }),
    }));
    expect(r.ok).toBe(true);
    expect(r.observations?.port_call_v2_fihel_cancelled).toBe('1');
    expect(st.risks.filter((x) => /PORTCALL_V2|portcall_v2/i.test(x.dedup))).toHaveLength(0);
  });
});
