/**
 * BN7 (#718) — roadSpecFromDict + resolveLegs cron_fetch + via w URL.
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
      max_km: 1400,
      cron_fetch: false,
      browser_fetch: false,
      map_group: 'bn7',
    });
    expect(def.spec).toBe('dict');
    expect(def.cronFetch).toBe(false);
    expect(def.viaPoints).toEqual([[53.13, 23.16]]);
    expect(def.minKm).toBe(1250);
    expect(def.maxKm).toBe(1400);
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
});
