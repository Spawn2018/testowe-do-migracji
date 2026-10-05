/**
 * AIS-POLF (05.10.2026) — aisstream dla Wawel i Nova Star.
 * Przyczyna: ramki binarne (Blob w Deno) ginęły w JSON.parse; 8 s nasłuchu nie łapie statku przy nabrzeżu (co 3 min).
 * Bez sieci: atrapa WebSocket.
 */
import { describe, expect, it } from 'vitest';
import {
  collectAisstreamFixes, decodeAisFrame, parseAisTimeUtc, parseAisstreamMessage,
} from '../supabase/functions/_shared/ferry/aisstream';
import {
  aisListenMs, runFerryAis, runFerryAisListen, runJob, type JobDeps, type SyncStore,
} from '../supabase/functions/_shared/integrations/jobs';
import type { VesselFix } from '../supabase/functions/_shared/ferry/digitraffic';

const WAWEL = 'v-wawel';
const NOVA = 'v-nova';
const ALLOW = new Set(['311852000', '311000787']);

function frame(mmsi: number, name: string, lat: number, lon: number, time: string, type = 'PositionReport') {
  return JSON.stringify({
    MessageType: type,
    MetaData: { MMSI: mmsi, ShipName: name, latitude: lat, longitude: lon, time_utc: time },
    Message: { [type]: { UserID: mmsi, Latitude: lat, Longitude: lon, Sog: 0, Cog: 360, NavigationalStatus: 5 } },
  });
}
const WAWEL_FRAME = frame(311852000, 'M/F WAWEL', 58.90556, 17.95722, '2026-10-05 05:22:23.246764256 +0000 UTC');
const NOVA_FRAME = frame(311000787, 'NOVA STAR', 54.40467, 18.67379, '2026-10-05 05:20:13.614382071 +0000 UTC');
const FOREIGN = frame(265000000, 'OBCY', 55, 17, '2026-10-05 05:20:00.0 +0000 UTC');

class FakeWs {
  static instances: FakeWs[] = [];
  static frames: unknown[] = [];
  binaryType = 'blob';
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((ev: { data: unknown }) => void | Promise<void>) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  constructor(public url: string) {
    FakeWs.instances.push(this);
    setTimeout(async () => {
      this.onopen?.();
      for (const f of FakeWs.frames) await this.onmessage?.({ data: f });
    }, 0);
  }
  send(s: string) { this.sent.push(s); }
  close() { /* atrapa */ }
}
const enc = (s: string) => new TextEncoder().encode(s);

describe('AIS-POLF — ramki aisstream', () => {
  it('czas time_utc z nanosekundami i „+0000 UTC” → ISO', () => {
    expect(parseAisTimeUtc('2026-10-05 05:19:10.554119198 +0000 UTC')).toBe('2026-10-05T05:19:10.554Z');
    expect(parseAisTimeUtc('2026-10-05 07:19:10 +0200 CEST')).toBe('2026-10-05T05:19:10.000Z');
    expect(parseAisTimeUtc('2026-10-05T05:19:10Z')).toBe('2026-10-05T05:19:10.000Z');
    expect(parseAisTimeUtc('bzdura')).toBeNull();
  });

  it('ramka binarna (ArrayBuffer, Uint8Array, Blob) dekoduje się do JSON', async () => {
    const u8 = enc(WAWEL_FRAME);
    expect(await decodeAisFrame(u8.buffer.slice(0))).toBe(WAWEL_FRAME);
    expect(await decodeAisFrame(u8)).toBe(WAWEL_FRAME);
    expect(await decodeAisFrame(new Blob([u8]))).toBe(WAWEL_FRAME);
    expect(await decodeAisFrame(WAWEL_FRAME)).toBe(WAWEL_FRAME);
    // dawny kod: String(Blob) → "[object Blob]" → JSON.parse pada
    expect(String(new Blob([u8]))).toBe('[object Blob]');
  });

  it('MMSI liczbowy w MetaData porównany jako tekst; obcy MMSI odrzucony', () => {
    const w = parseAisstreamMessage(WAWEL_FRAME, ALLOW, '2026-10-05T05:30:00.000Z');
    expect(w).toMatchObject({ mmsi: 311852000, lat: 58.90556, lon: 17.95722, source: 'AISSTREAM', timestampUtc: '2026-10-05T05:22:23.246Z', navStat: 5 });
    expect(w?.cog).toBeNull(); // 360 = brak kursu
    expect(parseAisstreamMessage(FOREIGN, ALLOW, '2026-10-05T05:30:00.000Z')).toBeNull();
    expect(parseAisstreamMessage('{"MessageType":"ShipStaticData","MetaData":{"MMSI":311852000}}', ALLOW, 'x')).toBeNull();
  });

  it('klasa B też jest pozycją', () => {
    const f = frame(311000787, 'NOVA STAR', 54.4, 18.67, '2026-10-05 05:20:13 +0000 UTC', 'StandardClassBPositionReport');
    expect(parseAisstreamMessage(f, ALLOW, 'x')?.lat).toBe(54.4);
  });

  it('collectAisstreamFixes: binaryType arraybuffer, subskrypcja z FiltersShipMMSI (tekst), ramki binarne → 2 pozycje', async () => {
    FakeWs.instances = [];
    FakeWs.frames = [enc(FOREIGN).buffer.slice(0), enc(WAWEL_FRAME).buffer.slice(0), new Blob([enc(NOVA_FRAME)])];
    const fixes = await collectAisstreamFixes('klucz-testowy', ['311852000', '311000787'], 200, {
      stopWhenAllSeen: true, WebSocketImpl: FakeWs as unknown as typeof WebSocket,
    });
    const ws = FakeWs.instances[0];
    expect(ws.binaryType).toBe('arraybuffer');
    const sub = JSON.parse(ws.sent[0]);
    expect(sub.FiltersShipMMSI).toEqual(['311852000', '311000787']);
    expect(sub.BoundingBoxes[0]).toEqual([[54.0, 15.2], [59.3, 19.9]]);
    expect(fixes.map((f) => f.mmsi).sort()).toEqual([311000787, 311852000]);
  });

  it('odrzucona subskrypcja → błąd, bez klucza w treści', async () => {
    FakeWs.instances = [];
    FakeWs.frames = [enc('{"error":"Api Key Is Not Valid"}').buffer.slice(0)];
    await expect(collectAisstreamFixes('tajny-klucz', ['311852000'], 200, { WebSocketImpl: FakeWs as unknown as typeof WebSocket }))
      .rejects.toThrow(/aisstream/);
    await expect(collectAisstreamFixes('tajny-klucz', ['311852000'], 200, { WebSocketImpl: FakeWs as unknown as typeof WebSocket }))
      .rejects.not.toThrow(/tajny-klucz/);
  });
});

class Store {
  positions: { vesselId: string; fix: VesselFix }[] = [];
  risks: { dedup: string }[] = [];
  runs: string[] = [];
  async projectId() { return 'p1'; }
  async vessels() {
    return [
      { id: WAWEL, name: 'M/F Wawel', mmsi: 311852000, imo: 7814462 },
      { id: NOVA, name: 'M/F Nova Star', mmsi: 311000787, imo: 9462067 },
    ];
  }
  async sailingsSince() { return []; }
  async insertSailings() { /* nic */ }
  async updateSailing() { return false; }
  async raiseRisk(r: { dedup: string }) { if (this.risks.some((x) => x.dedup === r.dedup)) return false; this.risks.push(r); return true; }
  async latestPositions() { return []; }
  async lastRun() { return null; }
  async resolveRisks(prefix: string) { const n = this.risks.length; this.risks = this.risks.filter((r) => !r.dedup.startsWith(prefix)); return n - this.risks.length; }
  async recordRun(job: string) { this.runs.push(job); }
  async saveVesselPosition(vesselId: string, fix: VesselFix) {
    if (this.positions.some((p) => p.vesselId === vesselId && p.fix.timestampUtc === fix.timestampUtc)) return;
    this.positions.push({ vesselId, fix });
  }
  async latestVesselObserved() {
    const best = new Map<string, string>();
    for (const p of this.positions) if (!best.has(p.vesselId) || p.fix.timestampUtc > best.get(p.vesselId)!) best.set(p.vesselId, p.fix.timestampUtc);
    return [...best.entries()].map(([vesselId, observedAt]) => ({ vesselId, observedAt }));
  }
  async latestAisstreamFixes(since: string) {
    const out = new Map<string, { vesselId: string; fix: VesselFix }>();
    for (const p of this.positions) {
      if (p.fix.source !== 'AISSTREAM' || p.fix.timestampUtc < since) continue;
      const cur = out.get(p.vesselId);
      if (!cur || p.fix.timestampUtc > cur.fix.timestampUtc) out.set(p.vesselId, p);
    }
    return [...out.values()];
  }
}

const NOW = new Date('2026-10-05T05:24:00Z');
function deps(store: Store, env: Record<string, string>, extra: Partial<JobDeps> = {}): JobDeps {
  const f = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('digitraffic.fi')) return new Response('{"type":"FeatureCollection","features":[]}', { status: 200 });
    throw new Error(`sieć zabroniona w teście: ${url}`);
  }) as typeof fetch;
  return { store: store as unknown as SyncStore, fetch: f, env, now: () => NOW, ...extra };
}

describe('AIS-POLF — nasłuch co minutę i zapis', () => {
  it('czas nasłuchu: domyślnie 50 s, granice 5–55 s (limit ścienny funkcji Edge 150 s)', () => {
    expect(aisListenMs(undefined)).toBe(50_000);
    expect(aisListenMs('120000')).toBe(55_000);
    expect(aisListenMs('1000')).toBe(5_000);
    expect(aisListenMs('abc')).toBe(50_000);
  });

  it('ferry-ais-listen zapisuje Wawel i Nova Star ze źródłem AISSTREAM', async () => {
    const st = new Store();
    let asked = 0;
    const r = await runFerryAisListen(deps(st, { AISSTREAM_API_KEY: 'k' }, {
      collectAisstream: async (ms) => {
        asked = ms ?? 0;
        return [
          parseAisstreamMessage(WAWEL_FRAME, ALLOW, NOW.toISOString())!,
          parseAisstreamMessage(NOVA_FRAME, ALLOW, NOW.toISOString())!,
        ];
      },
    }));
    expect(r.ok).toBe(true);
    expect(asked).toBe(50_000);
    expect(r.inserted).toBe(2);
    expect(st.positions.map((p) => [p.vesselId, p.fix.source])).toEqual([[WAWEL, 'AISSTREAM'], [NOVA, 'AISSTREAM']]);
  });

  it('bez klucza: nic nie pobiera i nie zapisuje', async () => {
    const st = new Store();
    const r = await runFerryAisListen(deps(st, {}));
    expect(r.mode).toBe('DEMO');
    expect(st.positions).toHaveLength(0);
  });

  it('runJob nie pomija nasłuchu co minutę (brak limitu 3 min)', async () => {
    const st = new Store();
    st.lastRun = async () => new Date(NOW.getTime() - 60_000).toISOString();
    const r = await runJob('ferry-ais-listen', deps(st, { AISSTREAM_API_KEY: 'k' }, { collectAisstream: async () => [] }));
    expect(r.skipped).toBeUndefined();
  });

  it('ferry-ais bierze świeżą pozycję AISSTREAM z bazy: bez ryzyka „brak pozycji AIS”, mimo pustego Digitraffic', async () => {
    const st = new Store();
    await st.saveVesselPosition(WAWEL, parseAisstreamMessage(WAWEL_FRAME, ALLOW, NOW.toISOString())!);
    await st.saveVesselPosition(NOVA, parseAisstreamMessage(NOVA_FRAME, ALLOW, NOW.toISOString())!);
    const r = await runFerryAis(deps(st, { AISSTREAM_API_KEY: 'k' }));
    expect(r.ok).toBe(true);
    expect(st.risks.filter((x) => x.dedup.startsWith('AIS_GAP:'))).toEqual([]);
    expect(st.positions).toHaveLength(2); // powtórka tego samego sygnału nie dubluje wiersza
  });

  it('ferry-ais nie otwiera WebSocket (nasłuch jest w ferry-ais-listen)', async () => {
    const st = new Store();
    const before = FakeWs.instances.length;
    await runFerryAis(deps(st, { AISSTREAM_API_KEY: 'k' }));
    expect(FakeWs.instances.length).toBe(before);
  });
});
