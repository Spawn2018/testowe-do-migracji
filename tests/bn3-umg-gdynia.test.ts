/**
 * BN3 pkt 7 — Urząd Morski Gdynia: zapas ETA/ATA/ETD Stena GDY↔KAA.
 * F7 #695 r1: B1 przyszłe ETD; B3 tr[^>]*> + SOURCE_DOWN tylko po 3×OK.
 * F7 #695 r2: B2 delayed tylko przy SOURCE_DOWN:STENA_STATUS; B4 past ETD wymaga OK „w porcie”.
 * F7 #695 r3: mutacje — przyszłe ETD bez down; częściowy SOURCE_DOWN; RECZNIE+ETA przy down.
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
    if (url.includes('/ais/v1/locations')) {
      return new Response(JSON.stringify({ type: 'FeatureCollection', features: [] }), { status: 200 });
    }
    throw new Error(`nieoczekiwane: ${url}`);
  }) as typeof fetch;
  return { store, fetch: f, env: {}, now: () => now };
}

const EMPTY_TABLE = `<!DOCTYPE html><html><body>
<h2>Port Gdynia</h2>
<table class="table table-striped"><thead><tr>
<th>Call ID</th><th>Nazwa statku</th><th>IMO</th><th>Agent</th><th>ATA (LT)</th><th>Nabrzeże</th>
</tr></thead><tbody></tbody></table>
</body></html>`;

const TR_ATTR_ATA = `<!DOCTYPE html><html><body>
<h2>Port Gdynia</h2>
<table class="table table-striped">
<thead><tr class="head">
<th>Call ID</th><th>Nazwa statku</th><th>IMO</th><th>Agent</th><th>ATA (LT)</th><th>Nabrzeże</th>
</tr></thead>
<tbody>
<tr class="odd">
<td>7377814</td><td>STENA EBBA</td><td>9863003</td><td>Stena</td>
<td>31.10.2026 08:50:00</td><td>Polskie</td>
</tr>
</tbody></table>
</body></html>`;

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

  it('F7 B3: <tr class=…> czyta wiersze; pusta tabela → ostrzeżenie struktury', () => {
    const withAttr = parseUmgdyGdyniaHtml(TR_ATTR_ATA, 'ATA');
    expect(withAttr.rows).toHaveLength(1);
    expect(withAttr.warnings.filter((w) => /struktura|pusta/i.test(w))).toHaveLength(0);
    const empty = parseUmgdyGdyniaHtml(EMPTY_TABLE, 'ATA');
    expect(empty.rows).toHaveLength(0);
    expect(empty.warnings.some((w) => /pusta tabela/i.test(w))).toBe(true);
  });
});

describe('BN3 UMG × ferry-portnet', () => {
  it('ATA Ebba → actual KAA-GDY; past ETD Estelle (nie w porcie) → actual GDY-KAA; ETA Spirit +próg → delayed', async () => {
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
        departure_at: '2026-10-31T09:00:00.000Z', arrival_at: '2026-10-31T13:00:00.000Z',
        delayed_departure_at: null, delayed_arrival_at: null,
        actual_departure_at: null, actual_arrival_at: null,
        status: 'ZAPLANOWANY', source: 'STENA',
      },
      {
        id: 'kaa-spir', vessel_id: SPIR, route: 'KAA-GDY',
        /* ETA fixture = 13:00Z; plan 12:00 → opóźnienie 60 min ≥ 15. */
        departure_at: '2026-10-31T08:00:00.000Z', arrival_at: '2026-10-31T12:00:00.000Z',
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
    /* F7 r2 B2: bez SOURCE_DOWN:STENA_STATUS — UMG nie pisze delayed. */
    expect(st.sailings.find((s) => s.id === 'kaa-spir')?.delayed_arrival_at).toBeNull();
  });

  it('F7 B1: przyszłe ETD → delayed_departure (≥ próg) tylko przy STENA_STATUS down', async () => {
    const st = new MemStore();
    st.risks.push({
      kind: 'INTEGRATION', severity: 'MEDIUM', title: 'Stena status', titleKey: 'rk_source_down',
      params: {}, detail: {}, dedup: 'SOURCE_DOWN:STENA_STATUS:x',
    });
    st.sailings.push({
      id: 'gdy-este-fut', vessel_id: ESTE, route: 'GDY-KAA',
      departure_at: '2026-10-31T17:00:00.000Z', arrival_at: '2026-10-31T21:00:00.000Z',
      delayed_departure_at: null, delayed_arrival_at: null,
      actual_departure_at: null, actual_arrival_at: null,
      status: 'ZAPLANOWANY', source: 'STENA',
    });
    /* ETD 19:00 LT CET = 18:00Z; NOW 12:00Z → przyszłość; opóźnienie vs plan 60 min. */
    const futureEtd = UMG_ETD.replace('31.10.2026 10:00:00', '31.10.2026 19:00:00');
    await runFerryPortnet(deps(st, {
      'port-calls': PORTNET,
      'statki-spodziewane': EMPTY_TABLE,
      'statki-wychodzace': futureEtd,
      'statki-w-porcie': EMPTY_TABLE,
    }));
    const s = st.sailings.find((x) => x.id === 'gdy-este-fut')!;
    expect(s.actual_departure_at).toBeNull();
    expect(s.status).toBe('ZAPLANOWANY');
    expect(s.delayed_departure_at).toMatch(/^2026-10-31T18:00:00/);
  });

  it('F7 r2 B2: sekwencja Stena planowo → UMG → Stena → UMG — stabilne = armator', async () => {
    const st = new MemStore();
    st.sailings.push({
      id: 'kaa-spir', vessel_id: SPIR, route: 'KAA-GDY',
      departure_at: '2026-10-31T08:00:00.000Z', arrival_at: '2026-10-31T12:00:00.000Z',
      delayed_departure_at: null, delayed_arrival_at: null,
      actual_departure_at: null, actual_arrival_at: null,
      status: 'ZAPLANOWANY', source: 'STENA',
    });
    const pages = {
      'port-calls': PORTNET,
      'statki-spodziewane': UMG_ETA,
      'statki-wychodzace': EMPTY_TABLE,
      'statki-w-porcie': EMPTY_TABLE,
    };
    /* 1) Sync Steny „planowo” — delayed null (symulacja feedu). */
    const clearStena = async () => {
      await st.resolveRisks('SOURCE_DOWN:STENA_STATUS:');
      const s = st.sailings.find((x) => x.id === 'kaa-spir')!;
      s.delayed_arrival_at = null;
      s.delayed_departure_at = null;
    };
    /* 2) UMG przy działającym Stena — milczy. */
    await clearStena();
    await runFerryPortnet(deps(st, pages));
    expect(st.sailings.find((s) => s.id === 'kaa-spir')?.delayed_arrival_at).toBeNull();
    /* 3) Awaria Steny → UMG wpisuje ETA. */
    st.risks.push({
      kind: 'INTEGRATION', severity: 'MEDIUM', title: 'Stena status', titleKey: 'rk_source_down',
      params: {}, detail: {}, dedup: 'SOURCE_DOWN:STENA_STATUS:x',
    });
    await runFerryPortnet(deps(st, pages));
    expect(st.sailings.find((s) => s.id === 'kaa-spir')?.delayed_arrival_at)
      .toBe('2026-10-31T13:00:00.000Z');
    /* 4) Sync Steny wraca (planowo) → null; UMG nie przywraca. */
    await clearStena();
    await runFerryPortnet(deps(st, pages));
    expect(st.sailings.find((s) => s.id === 'kaa-spir')?.delayed_arrival_at).toBeNull();
    await runFerryPortnet(deps(st, pages));
    expect(st.sailings.find((s) => s.id === 'kaa-spir')?.delayed_arrival_at).toBeNull();
  });

  it('F7 r2 B2: ETA = plan (< próg) nie zapisuje; armatorowy delayed nietknięty (także przy down)', async () => {
    const st = new MemStore();
    st.risks.push({
      kind: 'INTEGRATION', severity: 'MEDIUM', title: 'Stena status', titleKey: 'rk_source_down',
      params: {}, detail: {}, dedup: 'SOURCE_DOWN:STENA_STATUS:x',
    });
    st.sailings.push(
      {
        id: 'kaa-spir-eq', vessel_id: SPIR, route: 'KAA-GDY',
        departure_at: '2026-10-31T10:00:00.000Z', arrival_at: '2026-10-31T13:00:00.000Z',
        delayed_departure_at: null, delayed_arrival_at: null,
        actual_departure_at: null, actual_arrival_at: null,
        status: 'ZAPLANOWANY', source: 'STENA',
      },
      {
        id: 'kaa-spir-arm', vessel_id: SPIR, route: 'KAA-GDY',
        departure_at: '2026-10-31T16:00:00.000Z', arrival_at: '2026-10-31T19:00:00.000Z',
        delayed_departure_at: null, delayed_arrival_at: '2026-10-31T19:30:00.000Z',
        actual_departure_at: null, actual_arrival_at: null,
        status: 'ZAPLANOWANY', source: 'STENA',
      },
    );
    await runFerryPortnet(deps(st, {
      'port-calls': PORTNET,
      'statki-spodziewane': UMG_ETA,
      'statki-wychodzace': EMPTY_TABLE,
      'statki-w-porcie': EMPTY_TABLE,
    }));
    expect(st.sailings.find((s) => s.id === 'kaa-spir-eq')?.delayed_arrival_at).toBeNull();
    /* kaa-spir-arm: ETA fixture 13:00 nie pasuje do planu 19:00 (±3 h) — bez zmiany. */
    expect(st.sailings.find((s) => s.id === 'kaa-spir-arm')?.delayed_arrival_at)
      .toBe('2026-10-31T19:30:00.000Z');
  });

  it('F7 r2 B4: past ETD bez OK strony „w porcie” → bez actual / W_REJSIE', async () => {
    const st = new MemStore();
    st.sailings.push({
      id: 'gdy-este', vessel_id: ESTE, route: 'GDY-KAA',
      departure_at: '2026-10-31T09:00:00.000Z', arrival_at: '2026-10-31T13:00:00.000Z',
      delayed_departure_at: null, delayed_arrival_at: null,
      actual_departure_at: null, actual_arrival_at: null,
      status: 'ZAPLANOWANY', source: 'STENA',
    });
    await runFerryPortnet(deps(st, {
      'port-calls': PORTNET,
      'statki-spodziewane': EMPTY_TABLE,
      'statki-wychodzace': UMG_ETD,
      'statki-w-porcie': 503,
    }));
    const s = st.sailings.find((x) => x.id === 'gdy-este')!;
    expect(s.actual_departure_at).toBeNull();
    expect(s.status).toBe('ZAPLANOWANY');
  });

  it('pierwszeństwo: ATA/ETD/ETA pomija gdy actual już jest (Portnet/AIS/armator)', async () => {
    const st = new MemStore();
    st.sailings.push(
      {
        id: 'kaa-ebba', vessel_id: EBBA, route: 'KAA-GDY',
        departure_at: '2026-10-31T04:00:00.000Z', arrival_at: '2026-10-31T07:50:00.000Z',
        delayed_departure_at: null, delayed_arrival_at: null,
        actual_departure_at: '2026-10-31T04:05:00.000Z',
        actual_arrival_at: '2026-10-31T07:40:00.000Z',
        status: 'DOPLYNAL', source: 'STENA',
      },
      {
        id: 'gdy-este', vessel_id: ESTE, route: 'GDY-KAA',
        departure_at: '2026-10-31T09:00:00.000Z', arrival_at: '2026-10-31T13:00:00.000Z',
        delayed_departure_at: null, delayed_arrival_at: null,
        actual_departure_at: '2026-10-31T09:05:00.000Z', actual_arrival_at: null,
        status: 'W_REJSIE', source: 'STENA',
      },
    );
    await runFerryPortnet(deps(st, {
      'port-calls': PORTNET,
      'statki-spodziewane': UMG_ETA,
      'statki-wychodzace': UMG_ETD,
      'statki-w-porcie': UMG_IN,
    }));
    expect(st.sailings.find((s) => s.id === 'kaa-ebba')?.actual_arrival_at)
      .toBe('2026-10-31T07:40:00.000Z');
    expect(st.sailings.find((s) => s.id === 'gdy-este')?.actual_departure_at)
      .toBe('2026-10-31T09:05:00.000Z');
  });

  it('RECZNIE: ETA nie nadpisuje; ATA ustawia tylko actual bez statusu', async () => {
    const st = new MemStore();
    st.sailings.push(
      {
        id: 'kaa-ebba-r', vessel_id: EBBA, route: 'KAA-GDY',
        departure_at: '2026-10-31T04:00:00.000Z', arrival_at: '2026-10-31T07:50:00.000Z',
        delayed_departure_at: null, delayed_arrival_at: null,
        actual_departure_at: '2026-10-31T04:05:00.000Z', actual_arrival_at: null,
        status: 'W_REJSIE', source: 'RECZNIE',
      },
      {
        id: 'kaa-spir-r', vessel_id: SPIR, route: 'KAA-GDY',
        departure_at: '2026-10-31T08:00:00.000Z', arrival_at: '2026-10-31T12:00:00.000Z',
        delayed_departure_at: null, delayed_arrival_at: null,
        actual_departure_at: null, actual_arrival_at: null,
        status: 'ZAPLANOWANY', source: 'RECZNIE',
      },
    );
    await runFerryPortnet(deps(st, {
      'port-calls': PORTNET,
      'statki-spodziewane': UMG_ETA,
      'statki-wychodzace': EMPTY_TABLE,
      'statki-w-porcie': UMG_IN,
    }));
    expect(st.sailings.find((s) => s.id === 'kaa-ebba-r')).toMatchObject({
      status: 'W_REJSIE', actual_arrival_at: '2026-10-31T07:50:00.000Z',
    });
    expect(st.sailings.find((s) => s.id === 'kaa-spir-r')?.delayed_arrival_at).toBeNull();
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

  it('F7 B3: pusta tabela / częściowy 503 → SOURCE_DOWN; zamknięcie tylko po 3×OK', async () => {
    const st = new MemStore();
    st.risks.push({
      kind: 'INTEGRATION', severity: 'MEDIUM', title: 'x', titleKey: 'rk_x',
      params: {}, detail: {}, dedup: 'SOURCE_DOWN:UMG_GDY:old',
    });
    /* 2×503 + 1 pusta → nie zamykać. */
    await runFerryPortnet(deps(st, {
      'port-calls': PORTNET,
      'statki-spodziewane': 503,
      'statki-wychodzace': 503,
      'statki-w-porcie': EMPTY_TABLE,
    }));
    expect(st.risks.some((r) => r.dedup.startsWith('SOURCE_DOWN:UMG_GDY'))).toBe(true);

    /* Pełny powrót 3×OK → zamknięcie. */
    const st2 = new MemStore();
    st2.risks.push({
      kind: 'INTEGRATION', severity: 'MEDIUM', title: 'x', titleKey: 'rk_x',
      params: {}, detail: {}, dedup: 'SOURCE_DOWN:UMG_GDY:old',
    });
    await runFerryPortnet(deps(st2, {
      'port-calls': PORTNET,
      'statki-spodziewane': UMG_ETA,
      'statki-wychodzace': UMG_ETD,
      'statki-w-porcie': UMG_IN,
    }));
    expect(st2.risks.filter((r) => r.dedup.startsWith('SOURCE_DOWN:UMG_GDY'))).toHaveLength(0);
  });

  /* F7 #695 r3 — mutacje przeżyte w r2: 3 testy bez zmian w kodzie produkcyjnym. */
  it('F7 r3: przyszłe ETD +60 min przy działającym Stena → delayed_departure bez zmian', async () => {
    const st = new MemStore();
    st.sailings.push({
      id: 'gdy-este-fut-ok', vessel_id: ESTE, route: 'GDY-KAA',
      departure_at: '2026-10-31T17:00:00.000Z', arrival_at: '2026-10-31T21:00:00.000Z',
      delayed_departure_at: null, delayed_arrival_at: null,
      actual_departure_at: null, actual_arrival_at: null,
      status: 'ZAPLANOWANY', source: 'STENA',
    });
    const futureEtd = UMG_ETD.replace('31.10.2026 10:00:00', '31.10.2026 19:00:00');
    await runFerryPortnet(deps(st, {
      'port-calls': PORTNET,
      'statki-spodziewane': EMPTY_TABLE,
      'statki-wychodzace': futureEtd,
      'statki-w-porcie': EMPTY_TABLE,
    }));
    const s = st.sailings.find((x) => x.id === 'gdy-este-fut-ok')!;
    expect(s.delayed_departure_at).toBeNull();
    expect(s.actual_departure_at).toBeNull();
    expect(s.status).toBe('ZAPLANOWANY');
  });

  it('F7 r3: 2 strony OK + 1×503 → SOURCE_DOWN UMG_GDY otwarte (nie zamykane)', async () => {
    const st = new MemStore();
    st.risks.push({
      kind: 'INTEGRATION', severity: 'MEDIUM', title: 'x', titleKey: 'rk_x',
      params: {}, detail: {}, dedup: 'SOURCE_DOWN:UMG_GDY:old',
    });
    /* okPages=2 (nie 0) — mutacja `okPages === 0` błędnie zamknęłaby ryzyko. */
    await runFerryPortnet(deps(st, {
      'port-calls': PORTNET,
      'statki-spodziewane': UMG_ETA,
      'statki-wychodzace': UMG_ETD,
      'statki-w-porcie': 503,
    }));
    expect(st.risks.some((r) => r.dedup.startsWith('SOURCE_DOWN:UMG_GDY'))).toBe(true);
  });

  it('F7 r3: RECZNIE + STENA_STATUS down + ETA +60 → delayed_arrival bez zmian', async () => {
    const st = new MemStore();
    st.risks.push({
      kind: 'INTEGRATION', severity: 'MEDIUM', title: 'Stena status', titleKey: 'rk_source_down',
      params: {}, detail: {}, dedup: 'SOURCE_DOWN:STENA_STATUS:x',
    });
    st.sailings.push({
      id: 'kaa-spir-recz', vessel_id: SPIR, route: 'KAA-GDY',
      departure_at: '2026-10-31T08:00:00.000Z', arrival_at: '2026-10-31T12:00:00.000Z',
      delayed_departure_at: null, delayed_arrival_at: null,
      actual_departure_at: null, actual_arrival_at: null,
      status: 'ZAPLANOWANY', source: 'RECZNIE',
    });
    await runFerryPortnet(deps(st, {
      'port-calls': PORTNET,
      'statki-spodziewane': UMG_ETA,
      'statki-wychodzace': EMPTY_TABLE,
      'statki-w-porcie': EMPTY_TABLE,
    }));
    expect(st.sailings.find((s) => s.id === 'kaa-spir-recz')?.delayed_arrival_at).toBeNull();
  });
});
