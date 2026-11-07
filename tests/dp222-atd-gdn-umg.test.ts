/**
 * DP-222 / #814 — ATD GDN-NYN z UMG „Gdańsk Nowy Port” (Polferries).
 * Digitraffic bez Zatoki + AISSTREAM rzadki; UMG + geofence ≤60 min (F7 #818 B1).
 * Etap: C2 / BN9-c2. Decyzja: ten sam wzorzec co BN3 UMG Stena/Gdynia.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  extractGdanskNowyPortHtml, isNynashamnNote, mapPolferriesVessel,
  parseUmgdyGdanskNowyHtml, polferriesUmgCandidates,
} from '../supabase/functions/_shared/ferry/umgdyShipMovements';
import {
  runFerryPortnet, shouldCloseGdnNynWithoutAtd, statusAfterGdnNynAtd,
  type JobDeps, type JobResult, type SyncStore,
} from '../supabase/functions/_shared/integrations/jobs';
import type { DbSailing, RiskInput, SailingInsert, SailingPatch } from '../supabase/functions/_shared/integrations/sync';

const fx = (n: string) => readFileSync(new URL(`./fixtures/${n}`, import.meta.url), 'utf8');
const PORTNET = fx('digitraffic-port-calls-megastar-2026-10-29.json');
const UMG_OUT = fx('umgdy-gdansk-nowy-outgoing-wawel-sample.html');
const UMG_IN = fx('umgdy-gdansk-nowy-in-port-empty-sample.html');
const UMG_ETA = fx('umgdy-gdansk-nowy-expected-nova-sample.html');
const WAW = 'v-wawel';
const NS = 'v-nova';
const NOW = new Date('2026-11-05T12:00:00Z');

class MemStore implements SyncStore {
  sailings: DbSailing[] = [];
  risks: (RiskInput & { loadId?: string })[] = [];
  runs: { job: string; at: string; ok: boolean; result: JobResult }[] = [];
  n = 0;
  async projectId() { return 'p1'; }
  async vessels() {
    return [
      { id: WAW, name: 'M/F Wawel', mmsi: 311852000 },
      { id: NS, name: 'M/F Nova Star', mmsi: 311000787 },
      { id: 'v-mega', name: 'M/F Megastar', mmsi: 276829000 },
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
  unfinishedBySailing = new Map<string, string[]>();
  async sailingAssignedLoadCount(id: string) {
    return (this.unfinishedBySailing.get(id) ?? []).length;
  }
  async sailingUnfinishedLoadIds(id: string) {
    return this.unfinishedBySailing.get(id) ?? [];
  }
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
    if (url.includes('/ais/v1/locations')) {
      return new Response(JSON.stringify({ type: 'FeatureCollection', features: [] }), { status: 200 });
    }
    throw new Error(`nieoczekiwane: ${url}`);
  }) as typeof fetch;
  return { store, fetch: f, env: {}, now: () => now };
}

describe('DP-222 UMG Gdańsk Nowy Port parser', () => {
  it('extractGdanskNowyPortHtml: Wawel; Port Północny pominięty', () => {
    const sec = extractGdanskNowyPortHtml(UMG_OUT);
    expect(sec).toBeTruthy();
    expect(sec!).toMatch(/WAWEL/i);
    expect(sec!).not.toMatch(/Port Północny/i);
  });

  it('mapPolferriesVessel + isNynashamnNote', () => {
    expect(mapPolferriesVessel('WAWEL', '7814462')).toBe('M/F Wawel');
    expect(mapPolferriesVessel('NOVA STAR', '')).toBe('M/F Nova Star');
    expect(mapPolferriesVessel('OTHER', '1')).toBeNull();
    expect(isNynashamnNote('Nynashamn')).toBe(true);
    expect(isNynashamnNote('Nynäshamn')).toBe(true);
    expect(isNynashamnNote('Klaipeda')).toBe(false);
  });

  it('parse + candidates: tylko Wawel z Nynäshamn (nie OTHER CARGO)', () => {
    const p = parseUmgdyGdanskNowyHtml(UMG_OUT, 'ETD');
    expect(p.rows).toHaveLength(1);
    expect(p.rows[0]).toMatchObject({
      vessel: 'M/F Wawel', kind: 'ETD', note: 'Nynashamn',
    });
    expect(polferriesUmgCandidates(p.rows)).toHaveLength(1);
    expect(polferriesUmgCandidates([{ ...p.rows[0]!, note: 'Klaipeda' }])).toHaveLength(0);
  });
});

describe('DP-222 UMG × ferry-portnet — ATD GDN-NYN', () => {
  it('past ETD Wawel (nie w porcie) → actual_departure_at GDN-NYN + W_REJSIE', async () => {
    const st = new MemStore();
    st.sailings.push({
      id: 'gdn-waw', vessel_id: WAW, route: 'GDN-NYN',
      departure_at: '2026-11-04T17:00:00.000Z', arrival_at: '2026-11-05T11:00:00.000Z',
      delayed_departure_at: null, delayed_arrival_at: null,
      actual_departure_at: null, actual_arrival_at: null,
      status: 'ZAPLANOWANY', source: 'POLFERRIES',
    });
    const r = await runFerryPortnet(deps(st, {
      'port-calls': PORTNET,
      'statki-spodziewane': UMG_ETA,
      'statki-wychodzace': UMG_OUT,
      'statki-w-porcie': UMG_IN,
    }));
    expect(r.ok).toBe(true);
    expect(st.sailings.find((s) => s.id === 'gdn-waw')).toMatchObject({
      status: 'W_REJSIE',
      actual_departure_at: '2026-11-04T17:00:00.000Z',
    });
    expect(Number(r.observations?.umg_stena_rows ?? 0)).toBeGreaterThanOrEqual(1);
  });

  it('Wawel nadal w porcie Gdańsk → past ETD nie staje się actual', async () => {
    const inPort = UMG_IN.replace(
      '<tbody>\n</tbody>',
      `<tbody>
<tr>
<td>7378282</td><td>WAWEL</td><td>7814462</td><td></td>
<td>04.11.2026 10:00:00</td><td>Westerplatte</td>
</tr>
</tbody>`,
    );
    const st = new MemStore();
    st.sailings.push({
      id: 'gdn-waw', vessel_id: WAW, route: 'GDN-NYN',
      departure_at: '2026-11-04T17:00:00.000Z', arrival_at: '2026-11-05T11:00:00.000Z',
      delayed_departure_at: null, delayed_arrival_at: null,
      actual_departure_at: null, actual_arrival_at: null,
      status: 'ZAPLANOWANY', source: 'POLFERRIES',
    });
    await runFerryPortnet(deps(st, {
      'port-calls': PORTNET,
      'statki-spodziewane': UMG_ETA,
      'statki-wychodzace': UMG_OUT,
      'statki-w-porcie': inPort,
    }));
    expect(st.sailings.find((s) => s.id === 'gdn-waw')?.actual_departure_at ?? null).toBeNull();
  });

  it('DP-222 B2 / DP-237 r2: W_REJSIE z ATD + późniejszy ATD → DOPLYNAL', async () => {
    const st = new MemStore();
    const old: DbSailing = {
      id: 'gdn-waw', vessel_id: WAW, route: 'GDN-NYN',
      departure_at: '2026-11-03T17:00:00.000Z', arrival_at: '2026-11-04T07:00:00.000Z',
      delayed_departure_at: null, delayed_arrival_at: null,
      actual_departure_at: '2026-11-03T17:05:00.000Z', actual_arrival_at: null,
      status: 'W_REJSIE', source: 'POLFERRIES',
    };
    const next: DbSailing = {
      id: 'nyn-waw', vessel_id: WAW, route: 'NYN-GDN',
      departure_at: '2026-11-04T17:14:00.000Z', arrival_at: '2026-11-05T07:00:00.000Z',
      delayed_departure_at: null, delayed_arrival_at: null,
      actual_departure_at: '2026-11-04T17:20:00.000Z', actual_arrival_at: null,
      status: 'W_REJSIE', source: 'POLFERRIES',
    };
    st.sailings.push(old, next);
    expect(statusAfterGdnNynAtd(old, [old, next], Date.parse('2026-11-05T12:00:00Z'), null))
      .toBe('DOPLYNAL');
    const r = await runFerryPortnet(deps(st, {
      'port-calls': PORTNET,
      'statki-spodziewane': UMG_ETA,
      'statki-wychodzace': UMG_OUT,
      'statki-w-porcie': UMG_IN,
    }, new Date('2026-11-05T12:00:00Z')));
    expect(r.ok).toBe(true);
    expect(r.observations?.dp222_closed_gdn).toBe('1');
    expect(st.sailings.find((s) => s.id === 'gdn-waw')).toMatchObject({
      status: 'DOPLYNAL',
      actual_arrival_at: null,
      actual_departure_at: '2026-11-03T17:05:00.000Z',
    });
  });

  it('DP-222/237: ZAPLANOWANY bez ATD+ATA + późniejszy ATD → ZAMKNIETY_BEZ_POTWIERDZENIA', async () => {
    const st = new MemStore();
    const old: DbSailing = {
      id: 'gdn-waw-03', vessel_id: WAW, route: 'GDN-NYN',
      departure_at: '2026-11-03T17:00:00.000Z', arrival_at: '2026-11-04T07:00:00.000Z',
      delayed_departure_at: null, delayed_arrival_at: null,
      actual_departure_at: null, actual_arrival_at: null,
      status: 'ZAPLANOWANY', source: 'POLFERRIES',
    };
    const next: DbSailing = {
      id: 'nyn-waw-04', vessel_id: WAW, route: 'NYN-GDN',
      departure_at: '2026-11-04T17:14:00.000Z', arrival_at: '2026-11-05T07:00:00.000Z',
      delayed_departure_at: null, delayed_arrival_at: null,
      actual_departure_at: '2026-11-04T17:20:00.000Z', actual_arrival_at: null,
      status: 'W_REJSIE', source: 'POLFERRIES',
    };
    st.sailings.push(old, next);
    expect(shouldCloseGdnNynWithoutAtd(old, [old, next])).toBe(true);
    expect(shouldCloseGdnNynWithoutAtd({ ...old, actual_departure_at: '2026-11-03T17:05:00.000Z' }, [old, next]))
      .toBe(false);
    const r = await runFerryPortnet(deps(st, {
      'port-calls': PORTNET,
      'statki-spodziewane': UMG_ETA,
      'statki-wychodzace': UMG_OUT,
      'statki-w-porcie': UMG_IN,
    }, new Date('2026-11-05T12:00:00Z')));
    expect(r.ok).toBe(true);
    expect(r.observations?.dp222_closed_gdn).toBe('1');
    expect(st.sailings.find((s) => s.id === 'gdn-waw-03')).toMatchObject({
      status: 'ZAMKNIETY_BEZ_POTWIERDZENIA',
      actual_departure_at: null,
      actual_arrival_at: null,
    });
  });

  it('DP-237: TLLA-HEL ZAPLANOWANY + późniejszy ATD → ZAMKNIETY_BEZ_POTWIERDZENIA (nie tylko GDN-NYN)', async () => {
    const st = new MemStore();
    const old: DbSailing = {
      id: 'tlla-xprs', vessel_id: NS, route: 'TLLA-HEL',
      departure_at: '2026-11-06T02:00:00.000Z', arrival_at: '2026-11-06T04:45:00.000Z',
      delayed_departure_at: null, delayed_arrival_at: null,
      actual_departure_at: null, actual_arrival_at: null,
      status: 'ZAPLANOWANY', source: 'TALLINK',
    };
    const next: DbSailing = {
      id: 'hela-xprs', vessel_id: NS, route: 'HELA-TLL',
      departure_at: '2026-11-06T05:30:00.000Z', arrival_at: '2026-11-06T08:00:00.000Z',
      delayed_departure_at: null, delayed_arrival_at: null,
      actual_departure_at: '2026-11-06T05:35:00.000Z', actual_arrival_at: null,
      status: 'W_REJSIE', source: 'TALLINK',
    };
    st.sailings.push(old, next);
    expect(shouldCloseGdnNynWithoutAtd(old, [old, next])).toBe(true);
    const r = await runFerryPortnet(deps(st, {
      'port-calls': PORTNET,
      'statki-spodziewane': UMG_ETA,
      'statki-wychodzace': UMG_OUT,
      'statki-w-porcie': UMG_IN,
    }, new Date('2026-11-07T12:00:00Z')));
    expect(r.ok).toBe(true);
    expect(Number(r.observations?.dp222_closed_gdn ?? 0)).toBeGreaterThanOrEqual(1);
    expect(st.sailings.find((s) => s.id === 'tlla-xprs')).toMatchObject({
      status: 'ZAMKNIETY_BEZ_POTWIERDZENIA',
      actual_departure_at: null,
      actual_arrival_at: null,
    });
  });

  it('DP-237 B3: ZAPLANOWANY bez ATD + transport → bez znacznika, HIGH HHL+SCX', async () => {
    const st = new MemStore();
    const old: DbSailing = {
      id: 'gdn-waw-b3', vessel_id: WAW, route: 'GDN-NYN',
      departure_at: '2026-11-03T17:00:00.000Z', arrival_at: '2026-11-04T07:00:00.000Z',
      delayed_departure_at: null, delayed_arrival_at: null,
      actual_departure_at: null, actual_arrival_at: null,
      status: 'ZAPLANOWANY', source: 'POLFERRIES',
    };
    const next: DbSailing = {
      id: 'nyn-waw-b3', vessel_id: WAW, route: 'NYN-GDN',
      departure_at: '2026-11-04T17:14:00.000Z', arrival_at: '2026-11-05T07:00:00.000Z',
      delayed_departure_at: null, delayed_arrival_at: null,
      actual_departure_at: '2026-11-04T17:20:00.000Z', actual_arrival_at: null,
      status: 'W_REJSIE', source: 'POLFERRIES',
    };
    st.sailings.push(old, next);
    st.unfinishedBySailing.set('gdn-waw-b3', ['load-b3']);
    const r = await runFerryPortnet(deps(st, {
      'port-calls': PORTNET,
      'statki-spodziewane': UMG_ETA,
      'statki-wychodzace': UMG_OUT,
      'statki-w-porcie': UMG_IN,
    }, new Date('2026-11-05T12:00:00Z')));
    expect(r.ok).toBe(true);
    expect(st.sailings.find((s) => s.id === 'gdn-waw-b3')?.status).toBe('ZAPLANOWANY');
    // DP-238: dep w params/tytule = Europe/Warsaw (pl-PL), nie ISO UTC.
    const depWarsaw = new Intl.DateTimeFormat('pl-PL', {
      timeZone: 'Europe/Warsaw', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
    }).format(new Date('2026-11-03T17:00:00.000Z'));
    expect(st.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        severity: 'HIGH',
        titleKey: 'rk_ferry_unconfirmed_dep',
        loadId: 'load-b3',
        dedup: 'FERRY_UNCONFIRMED_DEP:gdn-waw-b3:load-b3',
        params: expect.objectContaining({ dep: depWarsaw }),
        title: expect.stringContaining(depWarsaw),
        detail: expect.objectContaining({ audience: 'HHL_PRZEWOZNIK' }),
      }),
    ]));
    expect(depWarsaw).not.toMatch(/T17:00/);
  });
});
