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
  ferryIceRisk, ferryIceRiskDedup, isPortCallV2Reissued, isWinterNavWindowActive,
  isWinterNavWindowActiveOnSailingDay, matchPortCallV2CancelledFleet,
  parseIbnetRestriction, parsePortCallV2Visits, parseWinterNavigationLocations,
  portCallV2ActiveVisitsUrl, portCallV2CancelledFleetRisk, portCallV2CancelledHasFihel,
  portCallV2CancelledRiskDedup, portCallV2CancelledUrl, vesselMeetsIbnetIceClass,
  winterLocodesForRoute, winterNavIceRisk, winterNavRiskDedup, WINTER_NAV_LOCATIONS_URL,
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
    if (url.includes('/ais/v1/locations')) {
      return new Response(JSON.stringify({ type: 'FeatureCollection', features: [] }), { status: 200 });
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

  it('BN5: winterLocodesForRoute + ferryIceRisk MEDIUM/HIGH (vs FERRY_WINTER)', () => {
    expect(winterLocodesForRoute('PLD-KPS')).toEqual(['EEPLA', 'SEKPS']);
    expect(winterLocodesForRoute('TLL-HEL')).toEqual(['EETLL', 'FIHEL']);
    expect(winterLocodesForRoute('HEL-STO')).toEqual([]);
    /* F7 #722 B1: Vuosaari → FIHEL (Port Helsinki). */
    expect(winterLocodesForRoute('MUU-VUO')).toEqual(['EEMUG', 'FIHEL']);
    expect(winterLocodesForRoute('VUO-MUU')).toEqual(['FIHEL', 'EEMUG']);
    const hit = {
      locode: 'EEPLA', name: 'PALDISKI', kind: 'RESTRICTION' as const,
      summary: 'II 2000', startTime: '2026-02-01T00:00:00Z', endTime: null,
    };
    const med = ferryIceRisk({
      hit, sailingId: 's1', vessel: 'Sirena', route: 'PLD-KPS',
      departureUtc: '2026-02-10T12:00:00Z', nowIso: '2026-02-10T12:00:00Z',
    });
    expect(med.severity).toBe('MEDIUM');
    expect(med.dedup).toBe(ferryIceRiskDedup('s1', hit));
    expect(med.title).toMatch(/sprawdź klasę lodową/);
    /* DP-120: IBNet „II 2000” → po polsku. */
    expect(med.title).toMatch(/klasa lodowa II, min\. 2000 DWT/);
    const high = ferryIceRisk({
      hit: { ...hit, kind: 'SUSPENSION', summary: 'closed' },
      sailingId: 's1', vessel: 'Sirena', route: 'PLD-KPS',
      departureUtc: '2026-02-10T12:00:00Z', nowIso: '2026-02-10T12:00:00Z',
    });
    expect(high.severity).toBe('HIGH');
    expect(high.dedup).not.toBe(winterNavRiskDedup(hit));
  });

  it('DP-120 / F7 #777: I=IC; 1C spełnia I; IB nie; IA Super 2000; złożone; zła data', () => {
    const ib = parseIbnetRestriction('I 2000');
    expect(ib.polish).toBe('klasa lodowa IC lub wyższa, min. 2000 DWT');
    expect(ib.classCode).toBe('I');
    expect(vesselMeetsIbnetIceClass('1C', ib)).toBe(true);
    expect(vesselMeetsIbnetIceClass('1A Super', ib)).toBe(true);
    expect(vesselMeetsIbnetIceClass('II', ib)).toBe(false);
    expect(vesselMeetsIbnetIceClass(null, ib)).toBe(false);
    /* I = IC — 1C spełnia „I”, nie spełnia „IB”. */
    expect(vesselMeetsIbnetIceClass('1C', parseIbnetRestriction('IB 2000'))).toBe(false);

    const iaSuper = parseIbnetRestriction('IA Super 2000');
    expect(iaSuper.classCode).toBe('IAS');
    expect(iaSuper.minDwt).toBe(2000);
    expect(iaSuper.polish).toMatch(/IA Super.*2000/);

    const compound = parseIbnetRestriction('IC 1300 / II 2000');
    expect(compound.alternatives).toHaveLength(2);
    expect(compound.polish).toMatch(/IC.*1300/);
    expect(compound.polish).toMatch(/II.*2000/);
    expect(vesselMeetsIbnetIceClass('1C', compound)).toBe(true);
    expect(vesselMeetsIbnetIceClass('II', compound)).toBe(true);
    expect(vesselMeetsIbnetIceClass('III', compound)).toBe(false);
    /* minDwt > 2000 → nie pomijaj (brak vessels.dwt). */
    expect(vesselMeetsIbnetIceClass('1A', parseIbnetRestriction('IA 4000'))).toBe(false);

    const dep = Date.parse('2026-02-15T18:00:00Z');
    expect(isWinterNavWindowActiveOnSailingDay(
      '2026-02-01T00:00:00Z', '2026-02-20T00:00:00Z', dep,
    )).toBe(true);
    expect(isWinterNavWindowActiveOnSailingDay(
      '2026-02-01T00:00:00Z', '2026-02-10T00:00:00Z', dep,
    )).toBe(false);
    /* Niepoprawna data → jak otwarte. */
    expect(isWinterNavWindowActiveOnSailingDay('not-a-date', null, dep)).toBe(true);
    /* Rejs przed północą UTC vs okno od 22/23Z tego dnia. */
    const lateDep = Date.parse('2026-02-15T23:30:00Z');
    expect(isWinterNavWindowActiveOnSailingDay(
      '2026-02-15T22:00:00Z', '2026-02-16T06:00:00Z', lateDep,
    )).toBe(true);

    expect(winterNavIceRisk({
      locode: 'FIHEL', name: 'HELSINKI', kind: 'RESTRICTION',
      summary: 'I 2000', startTime: '2026-02-01T00:00:00Z', endTime: null,
    }, '2026-02-10T12:00:00Z').title).toMatch(/klasa lodowa IC lub wyższa, min\. 2000 DWT/);

    const low = ferryIceRisk({
      hit: {
        locode: 'SENYN', name: 'NYNASHAMN', kind: 'RESTRICTION',
        summary: 'IB 2000', startTime: '2026-02-01T00:00:00Z', endTime: null,
      },
      sailingId: 's1', vessel: 'Estelle', route: 'GDY-KAA',
      departureUtc: '2026-02-10T12:00:00Z', nowIso: '2026-02-10T12:00:00Z',
      vesselIceClass: '1C',
    });
    expect(low.title).toMatch(/klasa 1C < wymagana IB/);
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
    expect(portCallV2CancelledHasFihel({})).toMatchObject({ hasFihel: false, count: 0, warnings: [] });
    const unknown = portCallV2CancelledHasFihel({ foo: 1 });
    expect(unknown.count).toBe(0);
    expect(unknown.hasFihel).toBe(false);
    expect(unknown.warnings.some((w) => /nieznane klucze/i.test(w))).toBe(true);
    const withVisits = portCallV2CancelledHasFihel({ visits: [{ id: 1 }, { id: 2 }] });
    expect(withVisits.hasFihel).toBe(true);
    expect(withVisits.count).toBe(2);
  });

  it('DP-121: URL status=cancelled bez locode; parse + filtr floty ± okno; HIGH bez daty', () => {
    const url = portCallV2CancelledUrl('2026-02-01T00:00:00.000Z', '2026-02-20T00:00:00.000Z');
    expect(url).toContain('status=cancelled');
    expect(url).not.toContain('locode=');
    expect(url).toContain('fromDateTime=');
    const activeUrl = portCallV2ActiveVisitsUrl('2026-02-01T00:00:00.000Z', '2026-02-20T00:00:00.000Z');
    expect(activeUrl).not.toContain('status=');
    const parsed = parsePortCallV2Visits([
      {
        visitId: 'FI-1', vesselName: 'MEGASTAR', portOfCall: 'FIHEL',
        mmsi: '276829000', vesselId: '9395159',
        eta: '2026-02-10T10:00:00.000Z', etd: '2026-02-10T12:00:00.000Z',
        status: 'Cancelled',
      },
      {
        visitId: 'FI-2', vesselName: 'OBCY', portOfCall: 'FIHEL',
        mmsi: '111111111', status: 'Cancelled',
        eta: '2026-02-10T10:00:00.000Z',
      },
      {
        visitId: 'FI-3', vesselName: 'MEGASTAR', portOfCall: 'FIKOK',
        mmsi: '276829000', status: 'Cancelled',
        eta: '2026-02-10T10:00:00.000Z',
      },
    ]);
    expect(parsed.visits).toHaveLength(3);
    const vessels = [{ id: MEGA, name: 'M/F Megastar', mmsi: 276829000, imo: 9395159 }];
    const sailings = [{
      id: 's1', vessel_id: MEGA, route: 'HEL-TLL' as const,
      departure_at: '2026-02-10T12:05:00.000Z', arrival_at: '2026-02-10T14:30:00.000Z',
      delayed_departure_at: null, delayed_arrival_at: null,
      status: 'ZAPLANOWANY' as const, source: 'TALLINK' as const,
    }];
    const hits = matchPortCallV2CancelledFleet(parsed.visits, vessels, sailings);
    expect(hits).toHaveLength(1);
    expect(hits[0]!.visit.visitId).toBe('FI-1');
    expect(hits[0]!.sailing?.id).toBe('s1');
    const risk = portCallV2CancelledFleetRisk(hits[0]!, '2026-02-10T12:00:00.000Z', url);
    expect(risk.dedup).toBe(portCallV2CancelledRiskDedup('FI-1'));
    expect(risk.dedup).not.toMatch(/\d{4}-\d{2}-\d{2}$/);
    expect(risk.severity).toBe('HIGH');
    expect(risk.title).toMatch(/sprawdź rejs/);
    expect(String(risk.params.dep)).toBeTruthy();
    expect((risk.detail as { audience?: string }).audience).toBe('HHL');
    const noSail = portCallV2CancelledFleetRisk(
      { ...hits[0]!, sailing: null },
      '2026-02-10T12:00:00.000Z',
      url,
    );
    expect(noSail.title).toMatch(/sprawdź rejs \(bez dopasowania\)/);
    expect(noSail.params.dep).toBe('(bez dopasowania)');
    const reissue = parsePortCallV2Visits([{
      visitId: 'FI-1b', vesselName: 'MEGASTAR', portOfCall: 'FIHEL',
      mmsi: '276829000', vesselId: '9395159',
      eta: '2026-02-10T10:30:00.000Z', etd: '2026-02-10T12:15:00.000Z',
      status: 'Expected to Arrive',
    }], 'active');
    expect(isPortCallV2Reissued(hits[0]!.visit, reissue.visits)).toBe(true);
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

  it('v2 cancelled bez floty → brak ryzyka (obce / brak MMSI)', async () => {
    const st = new MemStore();
    const r = await runFerryPortnet(deps(st, {
      'port-calls': PORTNET,
      'winter-navigation': JSON.stringify({ type: 'FeatureCollection', features: [] }),
      'port-call/v2': JSON.stringify([{
        visitId: 'x1', portOfCall: 'FIHEL', status: 'Cancelled', mmsi: '111',
      }]),
    }));
    expect(r.ok).toBe(true);
    expect(st.risks.filter((x) => x.dedup.startsWith('FERRY_PORTCALL_V2_CANCELLED:'))).toHaveLength(0);
  });

  it('DP-121 / decyzja 100: flota ±3 h → HIGH HHL; status rejsu bez zmian; dedup bez daty', async () => {
    const st = new MemStore();
    st.sailings.push({
      id: 's-mega', vessel_id: MEGA, route: 'HEL-TLL',
      departure_at: '2026-02-10T12:00:00.000Z', arrival_at: '2026-02-10T14:30:00.000Z',
      delayed_departure_at: null, delayed_arrival_at: null,
      status: 'ZAPLANOWANY', source: 'TALLINK',
    });
    const r = await runFerryPortnet(deps(st, {
      'port-calls': PORTNET,
      'winter-navigation': JSON.stringify({ type: 'FeatureCollection', features: [] }),
      'status=cancelled': JSON.stringify([{
        visitId: 'FI20260210-001',
        vesselName: 'MEGASTAR',
        portOfCall: 'FIHEL',
        mmsi: '276829000',
        eta: '2026-02-10T10:00:00.000Z',
        etd: '2026-02-10T12:00:00.000Z',
        status: 'Cancelled',
      }]),
      'visits?fromDateTime': JSON.stringify([]),
    }));
    expect(r.ok).toBe(true);
    expect(r.observations?.port_call_v2_fihel_cancelled).toBe('1');
    expect(r.observations?.port_call_v2_fleet_n).toBe('1');
    expect(r.observations?.port_call_v2_matched).toBe('1');
    expect(r.observations?.port_call_v2_cancelled_odwolany).toBeUndefined();
    const risks = st.risks.filter((x) => x.dedup.startsWith('FERRY_PORTCALL_V2_CANCELLED:'));
    expect(risks).toHaveLength(1);
    expect(risks[0]!.dedup).toBe('FERRY_PORTCALL_V2_CANCELLED:FI20260210-001');
    expect(risks[0]!.dedup).not.toMatch(/:\d{4}-\d{2}-\d{2}$/);
    expect(risks[0]!.severity).toBe('HIGH');
    expect(risks[0]!.title).toMatch(/sprawdź rejs/);
    expect((risks[0]!.detail as { audience?: string }).audience).toBe('HHL');
    expect(st.sailings[0]!.status).toBe('ZAPLANOWANY');
  });

  it('DP-121 / decyzja 100: re-zgłoszenie aktywnej wizyty → bez ryzyka', async () => {
    const st = new MemStore();
    st.sailings.push({
      id: 's-mega', vessel_id: MEGA, route: 'HEL-TLL',
      departure_at: '2026-02-10T12:00:00.000Z', arrival_at: '2026-02-10T14:30:00.000Z',
      delayed_departure_at: null, delayed_arrival_at: null,
      status: 'ZAPLANOWANY', source: 'TALLINK',
    });
    const r = await runFerryPortnet(deps(st, {
      'port-calls': PORTNET,
      'winter-navigation': JSON.stringify({ type: 'FeatureCollection', features: [] }),
      'status=cancelled': JSON.stringify([{
        visitId: 'FI20260210-001',
        vesselName: 'MEGASTAR',
        portOfCall: 'FIHEL',
        mmsi: '276829000',
        eta: '2026-02-10T10:00:00.000Z',
        etd: '2026-02-10T12:00:00.000Z',
        status: 'Cancelled',
      }]),
      'visits?fromDateTime': JSON.stringify([{
        visitId: 'FI20260210-002',
        vesselName: 'MEGASTAR',
        portOfCall: 'FIHEL',
        mmsi: '276829000',
        eta: '2026-02-10T10:20:00.000Z',
        etd: '2026-02-10T12:10:00.000Z',
        status: 'Expected to Arrive',
      }]),
    }));
    expect(r.ok).toBe(true);
    expect(r.observations?.port_call_v2_reissued).toBe('1');
    expect(r.observations?.port_call_v2_matched).toBeUndefined();
    expect(st.risks.filter((x) => x.dedup.startsWith('FERRY_PORTCALL_V2_CANCELLED:'))).toHaveLength(0);
    expect(st.sailings[0]!.status).toBe('ZAPLANOWANY');
  });
});
