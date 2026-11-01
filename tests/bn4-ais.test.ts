/**
 * BN4 (#573) — AIS Zatoka Fińska: bbox aisstream + śledzenie MMSI z `vessels`
 * (nie tylko 5 PL/SE). Digitraffic poll dla Megastar itd.
 * F7 #701 r1 B1: mapy portów wszystkich tras — bez domyślnego GDN/NYN.
 */
import { describe, expect, it } from 'vitest';
import {
  BALTIC_BBOX, BALTIC_BBOX_GULF, BALTIC_BBOX_SOUTH, BALTIC_BBOXES,
} from '../supabase/functions/_shared/ferry/aisstream';
import { isTrackedMmsi, TRACKED_MMSI } from '../supabase/functions/_shared/ferry/stenaAis';
import {
  runFerryAis, type JobDeps, type SyncStore,
} from '../supabase/functions/_shared/integrations/jobs';
import {
  aisDepartureDelayMin, arrivalPortForRoute, departurePortForRoute, portCoords,
  type VesselFix,
} from '../supabase/functions/_shared/ferry/digitraffic';

const MEGA = 'v-megastar';
const XPRS = 'v-xprs';
const WAW = 'v-wawel';

/** Feature Digitraffic dla MMSI Megastar (276829000) — Zatoka Fińska. */
const MEGA_AIS = JSON.stringify({
  type: 'FeatureCollection',
  features: [{
    type: 'Feature',
    mmsi: 276829000,
    geometry: { type: 'Point', coordinates: [24.95, 59.95] },
    properties: {
      mmsi: 276829000,
      sog: 18.2,
      cog: 90,
      navStat: 0,
      timestampExternal: Date.parse('2026-11-01T10:00:00.000Z'),
    },
  }],
});

/** Viking XPRS (230705000) na morzu Zatoki ~20 kn — środek TLL↔HEL. */
const XPRS_AIS = JSON.stringify({
  type: 'FeatureCollection',
  features: [{
    type: 'Feature',
    mmsi: 230705000,
    geometry: { type: 'Point', coordinates: [24.9, 59.85] },
    properties: {
      mmsi: 230705000,
      sog: 20,
      cog: 0,
      navStat: 0,
      timestampExternal: Date.parse('2026-11-01T10:00:00.000Z'),
    },
  }],
});

class Mem {
  vesselPositions: { vesselId: string; lat: number; lon: number; source?: string }[] = [];
  risks: { dedup: string; title?: string }[] = [];
  sailings: {
    id: string; vessel_id: string; route: string; departure_at: string; arrival_at: string;
    delayed_departure_at: string | null; delayed_arrival_at: string | null;
    actual_departure_at: string | null; actual_arrival_at: string | null;
    status: string; source: string;
  }[] = [];
  async projectId() { return 'p'; }
  async vessels() {
    return [
      { id: WAW, name: 'M/F Wawel', mmsi: null, imo: 7814462 },
      { id: MEGA, name: 'M/F Megastar', mmsi: 276829000, imo: 9773064 },
      { id: XPRS, name: 'M/F Viking XPRS', mmsi: 230705000, imo: 9375654 },
    ];
  }
  async sailingsSince() { return this.sailings; }
  async insertSailings() { /* */ }
  async updateSailing() { return false; }
  async saveVesselPosition(vesselId: string, fix: VesselFix) {
    this.vesselPositions.push({
      vesselId, lat: fix.lat, lon: fix.lon, source: fix.source,
    });
  }
  async raiseRisk(r: { dedup: string; title?: string }) { this.risks.push(r); return true; }
  async resolveRisks() { return 0; }
  async resolveStaleRisks() { return 0; }
  async latestPositions() { return []; }
  async lastRun() { return null; }
  async recordRun() { /* */ }
}

function deps(st: Mem, bodies: Record<string, string | number>, env: Record<string, string> = {}, now = new Date('2026-11-01T10:05:00Z')): JobDeps {
  const f = (async (input: RequestInfo | URL) => {
    const url = String(input);
    const hit = Object.entries(bodies).find(([k]) => url.includes(k));
    if (hit) {
      return typeof hit[1] === 'number' ? new Response('err', { status: hit[1] }) : new Response(hit[1], { status: 200 });
    }
    throw new Error(`nieoczekiwane zapytanie: ${url}`);
  }) as typeof fetch;
  return { store: st as unknown as SyncStore, fetch: f, env, now: () => now };
}

describe('BN4 AIS — bbox Zatoka + MMSI z vessels', () => {
  it('BALTIC_BBOXES: PL/SE + Zatoka Fińska (BN4)', () => {
    expect(BALTIC_BBOX_SOUTH).toEqual([[54.0, 15.2], [59.3, 19.9]]);
    expect(BALTIC_BBOX_GULF).toEqual([[59.0, 17.5], [60.5, 26.0]]);
    expect(BALTIC_BBOXES).toEqual([BALTIC_BBOX_SOUTH, BALTIC_BBOX_GULF]);
    expect(BALTIC_BBOX).toEqual([[54.0, 15.2], [60.5, 26.0]]);
  });

  it('isTrackedMmsi: MMSI z vessels (Megastar/XPRS), nie tylko TRACKED_MMSI PL/SE', () => {
    expect(TRACKED_MMSI.has(276829000)).toBe(false);
    expect(isTrackedMmsi(276829000)).toBe(true);
    expect(isTrackedMmsi(230705000)).toBe(true);
    expect(isTrackedMmsi(311852000)).toBe(true);
    expect(isTrackedMmsi(null)).toBe(false);
    expect(isTrackedMmsi(123)).toBe(false);
  });

  it('runFerryAis: Digitraffic poll dla Megastar (MMSI spoza listy PL/SE)', async () => {
    const st = new Mem();
    const r = await runFerryAis(deps(st, { 'digitraffic.fi': MEGA_AIS }));
    expect(r.ok).toBe(true);
    const mega = st.vesselPositions.find((p) => p.vesselId === MEGA);
    expect(mega).toBeTruthy();
    expect(mega!.source).toBe('DIGITRAFFIC');
    expect(mega!.lat).toBeCloseTo(59.95, 4);
    expect(mega!.lon).toBeCloseTo(24.95, 4);
    expect(st.vesselPositions.some((p) => p.vesselId === WAW)).toBe(false);
  });
});

describe('BN4 F7 #701 r1 B1 — mapy portów (bez domyślnego GDN/NYN)', () => {
  it('TLLA-HEL / HELA-TLL / MUU-VUO: porty Zatoki, nie GDN/NYN', () => {
    expect(departurePortForRoute('TLLA-HEL')).toBe('TLLA');
    expect(arrivalPortForRoute('TLLA-HEL')).toBe('HELA');
    expect(departurePortForRoute('HELA-TLL')).toBe('HELA');
    expect(arrivalPortForRoute('HELA-TLL')).toBe('TLLA');
    expect(departurePortForRoute('MUU-VUO')).toBe('MUU');
    expect(arrivalPortForRoute('MUU-VUO')).toBe('VUO');
    expect(departurePortForRoute('TLL-HEL')).toBe('TLL');
    expect(arrivalPortForRoute('HEL-TLL')).toBe('TLL');
    expect(departurePortForRoute('PLD-KPS')).toBe('PLD');
    expect(arrivalPortForRoute('STO-TLL')).toBe('TLL');
    expect(portCoords('TLLA')!.lat).toBeCloseTo(59.444, 3);
    expect(portCoords('HELA')!.lat).toBeCloseTo(60.166, 3);
  });

  it('trasa bez mapy → null (nigdy GDN/NYN)', () => {
    expect(departurePortForRoute('XXX-YYY')).toBeNull();
    expect(arrivalPortForRoute('XXX-YYY')).toBeNull();
    expect(portCoords(null)).toBeNull();
    expect(aisDepartureDelayMin(
      { mmsi: 1, lat: 59.85, lon: 24.9, sogKn: 20, cog: null, navStat: null, timestampUtc: '2026-11-01T10:00:00Z' },
      '2026-11-01T10:05:00Z', '2026-11-01T12:00:00Z', 'XXX-YYY',
    )).toBeNull();
  });

  it('Viking XPRS TLLA-HEL na morzu 20 kn → brak opóźnienia II-9 i brak delayed_*', async () => {
    const now = '2026-11-01T10:05:00Z';
    const dep = '2026-11-01T12:00:00Z';
    // Środek Zatoki względem Gdańska = setki km → stary kod dawał opóźnienie; mapa TLLA → null lub małe.
    expect(aisDepartureDelayMin(
      { mmsi: 230705000, lat: 59.85, lon: 24.9, sogKn: 20, cog: 0, navStat: 0, timestampUtc: now },
      now, dep, 'TLLA-HEL',
    )).toBeNull();

    const st = new Mem();
    st.sailings.push({
      id: 's-xprs', vessel_id: XPRS, route: 'TLLA-HEL',
      departure_at: dep, arrival_at: '2026-11-01T14:00:00Z',
      delayed_departure_at: null, delayed_arrival_at: null,
      actual_departure_at: null, actual_arrival_at: null,
      status: 'ZAPLANOWANY', source: 'VIKING',
    });
    const r = await runFerryAis(deps(st, { 'digitraffic.fi': XPRS_AIS }));
    expect(r.ok).toBe(true);
    expect(st.risks.some((x) => x.dedup.startsWith('AIS_DEP_DELAY:'))).toBe(false);
    expect(st.sailings[0].delayed_departure_at).toBeNull();
    expect(st.sailings[0].delayed_arrival_at).toBeNull();
  });
});
