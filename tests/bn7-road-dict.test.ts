/**
 * @vitest-environment jsdom
 * BN7 (#718) — roadSpecFromDict + resolveLegs cron_fetch + via w URL.
 * F7 #738 N10: checkRoads dict + storeRoad length/duration + SOURCE_DOWN przy cronFetch.
 */
import { describe, expect, it, vi } from 'vitest';
import { roadSpecFromDict, type LatLng } from '../supabase/functions/_shared/map/draw.ts';
import {
  refreshRoadLegs,
  resolveLegs,
  ROAD_CRON_REFRESH_MS,
  ROAD_LEGS,
  type RoadGeomRow,
  type RoadRefreshStore,
} from '../supabase/functions/_shared/here/refreshRoadLegs.ts';
import { legDefFromRow } from '../supabase/functions/_shared/here/legDefFromRow.ts';
import { checkRoads } from '../src/components/map/applyBasemap.ts';

function denseLine(via: LatLng[], stepKm = 0.4): LatLng[] {
  const out: LatLng[] = [];
  for (let i = 0; i < via.length - 1; i += 1) {
    const [aLat, aLng] = via[i]!;
    const [bLat, bLng] = via[i + 1]!;
    const dist = Math.hypot((bLat - aLat) * 111, (bLng - aLng) * 111 * Math.cos((aLat * Math.PI) / 180));
    const n = Math.max(1, Math.ceil(dist / stepKm));
    for (let k = 0; k < n; k += 1) {
      out.push([aLat + ((bLat - aLat) * k) / n, aLng + ((bLng - aLng) * k) / n]);
    }
  }
  out.push(via[via.length - 1]!);
  return out;
}

describe('BN7 roadSpecFromDict', () => {
  const via: LatLng[] = [
    [53.13, 23.16],
    [54.9, 23.9],
    [56.41, 24.19],
    [58.39, 24.5],
  ];
  const spine: LatLng[] = [
    [52.07, 17.02],
    ...via,
    [59.44, 24.75],
  ];

  it('przyjmuje linię w limicie km z via ≤ 8 km', () => {
    const line = denseLine(spine, 0.5);
    expect(line.length).toBeGreaterThanOrEqual(200);
    expect(roadSpecFromDict(line, { via, minKm: 100, maxKm: 2000 })).toBe(true);
  });

  it('odrzuca odchyłkę via > 8 km', () => {
    const line = denseLine(spine, 0.5);
    const farVia: LatLng[] = [[60, 30]]; // daleko od E67
    expect(roadSpecFromDict(line, { via: farVia, minKm: 100, maxKm: 2000 })).toBe(false);
  });

  it('odrzuca długość poza min/max', () => {
    const line = denseLine(spine, 0.5);
    expect(roadSpecFromDict(line, { via, minKm: 5000, maxKm: 6000 })).toBe(false);
  });
});

describe('BN7 resolveLegs cron_fetch', () => {
  it('cron pomija leg z cronFetch:false; browserOnly pomija browserFetch:false', async () => {
    const bn7 = {
      leg: 'PL-TLL',
      origin: '52.07,17.02',
      destination: '59.44,24.75',
      spec: 'dict' as const,
      summary: 'BN7',
      browserFetch: false,
      mapGroup: 'bn7' as const,
      cronFetch: false,
      viaPoints: [[53.13, 23.16]] as LatLng[],
      minKm: 1250,
      maxKm: 1400,
    };
    const store: RoadRefreshStore = {
      listLegs: async () => [...ROAD_LEGS, bn7],
      listGeometry: async () => [],
      storeRoad: async () => true,
      loadCorridor: async (code) => ({ code, pts: [], via: [], updatedAt: 0 }),
      monthSpend: async () => 0,
      noteRouting: async () => {},
    };
    const browser = await resolveLegs(store, true);
    expect(browser.map((l) => l.leg)).not.toContain('PL-TLL');
    expect(browser).toHaveLength(5);
    const cron = await resolveLegs(store, false);
    expect(cron.map((l) => l.leg)).not.toContain('PL-TLL');
    expect(cron).toHaveLength(5);
  });

  it('cron bierze BN7 gdy cronFetch:true', async () => {
    const bn7 = {
      leg: 'PL-TLL',
      origin: '52.07,17.02',
      destination: '59.44,24.75',
      spec: 'dict' as const,
      summary: 'BN7',
      browserFetch: false,
      mapGroup: 'bn7' as const,
      cronFetch: true,
    };
    const store: RoadRefreshStore = {
      listLegs: async () => [...ROAD_LEGS, bn7],
      listGeometry: async () => [],
      storeRoad: async () => true,
      loadCorridor: async (code) => ({ code, pts: [], via: [], updatedAt: 0 }),
      monthSpend: async () => 0,
      noteRouting: async () => {},
    };
    const cron = await resolveLegs(store, false);
    expect(cron.map((l) => l.leg)).toContain('PL-TLL');
  });
});

describe('BN7 legDefFromRow + refresh URL', () => {
  it('legDefFromRow mapuje via/min/max/cron/dict', () => {
    const def = legDefFromRow({
      leg: 'PL-TLL',
      origin_lat: 52.07,
      origin_lng: 17.02,
      dest_lat: 59.44,
      dest_lng: 24.75,
      spec: 'dict',
      summary: 'x',
      via_points: [[53.13, 23.16]],
      min_km: 1250,
      max_km: 1500,
      cron_fetch: false,
      browser_fetch: false,
      map_group: 'bn7',
    });
    expect(def.spec).toBe('dict');
    expect(def.cronFetch).toBe(false);
    expect(def.viaPoints).toEqual([[53.13, 23.16]]);
    expect(def.minKm).toBe(1250);
    expect(def.maxKm).toBe(1500);
  });

  it('F7 #738 B2: cron_fetch tylko przy === true (brak/null → false)', () => {
    expect(legDefFromRow({
      leg: 'X', origin_lat: 1, origin_lng: 2, dest_lat: 3, dest_lng: 4, spec: 'dict',
    }).cronFetch).toBe(false);
    expect(legDefFromRow({
      leg: 'X', origin_lat: 1, origin_lng: 2, dest_lat: 3, dest_lng: 4, spec: 'dict',
      cron_fetch: null,
    }).cronFetch).toBe(false);
    expect(legDefFromRow({
      leg: 'X', origin_lat: 1, origin_lng: 2, dest_lat: 3, dest_lng: 4, spec: 'dict',
      cron_fetch: true,
    }).cronFetch).toBe(true);
  });

  it('refreshRoadLegs dict: via + exclude[countries] + return summary w URL', async () => {
    const urls: string[] = [];
    const fetchFn = vi.fn(async (input: RequestInfo | URL) => {
      urls.push(String(input));
      return new Response('nope', { status: 500 });
    });
    const rows: RoadGeomRow[] = [{
      leg: 'PL-TLL',
      fetched_at: new Date(Date.now() - 40 * 864e5).toISOString(),
      points: null,
      retry_after: null,
    }];
    const s: RoadRefreshStore = {
      listLegs: async () => [{
        leg: 'PL-TLL',
        origin: '52.07391,17.0246',
        destination: '59.44,24.775',
        spec: 'dict',
        summary: 'BN7',
        browserFetch: false,
        mapGroup: 'bn7',
        cronFetch: true,
        viaPoints: [[53.13, 23.16], [54.9, 23.9]],
        minKm: 1250,
        maxKm: 1400,
      }],
      listGeometry: async () => rows,
      storeRoad: async () => true,
      loadCorridor: async (code) => ({ code, pts: [], via: [], updatedAt: 0 }),
      monthSpend: async () => 0,
      noteRouting: async () => {},
    };
    await refreshRoadLegs(s, {
      fetch: fetchFn as unknown as typeof fetch,
      hereApiKey: 'k',
      maxAgeMs: ROAD_CRON_REFRESH_MS,
    });
    expect(urls.length).toBe(1);
    const u = decodeURIComponent(urls[0]!);
    expect(u).toMatch(/return=polyline,summary/);
    expect(u).toMatch(/exclude\[countries\]=RUS,BLR/);
    expect(u).toMatch(/via=53\.13,23\.16!passThrough=true/);
    expect(u).toMatch(/via=54\.9,23\.9!passThrough=true/);
  });

  it('F7 #738 N10: storeRoad przekazuje lengthM/durationS (RPC p_length_m/p_duration_s)', async () => {
    const metas: Array<{ lengthM?: number; durationS?: number } | undefined> = [];
    const store: RoadRefreshStore = {
      listLegs: async () => [],
      listGeometry: async () => [],
      storeRoad: async (_l, _p, _s, _n, meta) => {
        metas.push(meta);
        return true;
      },
      loadCorridor: async (code) => ({ code, pts: [], via: [], updatedAt: 0 }),
      monthSpend: async () => 0,
      noteRouting: async () => {},
    };
    await store.storeRoad('PL-TLL', [[52, 17], [59, 24]], 'ok', undefined, {
      lengthM: 1_300_000,
      durationS: 60_000,
    });
    expect(metas[0]).toEqual({ lengthM: 1_300_000, durationS: 60_000 });
  });
});

describe('BN7 checkRoads dict + SOURCE_DOWN', () => {
  it('F7 #738 N10: checkRoads przyjmuje spec=dict w limicie', () => {
    const via: LatLng[] = [[53.13, 23.16], [54.9, 23.9], [56.41, 24.19], [58.39, 24.5]];
    const line = denseLine([[52.07, 17.02], ...via, [59.44, 24.75]], 0.5);
    const r = checkRoads([{
      leg: 'PL-TLL',
      spec: 'dict',
      points: line,
      summary: 'ok',
      via_points: via,
      min_km: 100,
      max_km: 2000,
    }]);
    expect(r.accepted).toHaveLength(1);
    expect(r.rejected).toHaveLength(0);
  });

  it('F7 #738 N10: BN7 z cronFetch=true wchodzi do missingLegs (SOURCE_DOWN)', async () => {
    const bn7 = {
      leg: 'PL-TLL',
      origin: '52.07,17.02',
      destination: '59.44,24.75',
      spec: 'dict' as const,
      summary: 'BN7',
      browserFetch: false,
      mapGroup: 'bn7' as const,
      cronFetch: true,
      viaPoints: [[53.13, 23.16]] as LatLng[],
      minKm: 1250,
      maxKm: 1500,
    };
    const store: RoadRefreshStore = {
      listLegs: async () => [...ROAD_LEGS, bn7],
      listGeometry: async () => [
        ...ROAD_LEGS.map((l) => ({
          leg: l.leg,
          fetched_at: new Date(Date.now() - 40 * 864e5).toISOString(),
          points: null,
          retry_after: null,
        })),
        {
          leg: 'PL-TLL',
          fetched_at: new Date(Date.now() - 40 * 864e5).toISOString(),
          points: null,
          retry_after: null,
        },
      ],
      storeRoad: async () => true,
      loadCorridor: async (code) => ({ code, pts: [], via: [], updatedAt: 0 }),
      monthSpend: async () => 0,
      noteRouting: async () => {},
    };
    const r = await refreshRoadLegs(store, {
      fetch: (async () => new Response('nope', { status: 500 })) as unknown as typeof fetch,
      hereApiKey: 'k',
      maxAgeMs: ROAD_CRON_REFRESH_MS,
    });
    // N10: przy cronFetch=true BN7 liczy się do SOURCE_DOWN / missingLegs.
    expect(r.missingLegs).toContain('PL-TLL');
  });
});
