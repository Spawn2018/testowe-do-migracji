import { describe, expect, it } from 'vitest';
import {
  bearingDeg,
  coordsFromGeoJson,
  haversineKm,
  samplePolylineEveryKm,
} from '../supabase/functions/_shared/e49/corridorWind.ts';
import {
  fetchWindSeriesForPoint,
  gustMeetsThresholdInWindow,
  runCorridorWindCore,
} from '../supabase/functions/_shared/e49/corridorWindJob.ts';
import { fmiHarmonieWindUrl, nearestWindSample } from '../supabase/functions/_shared/e49/windForecast.ts';

describe('E49-a corridorWind sampling (DP-205)', () => {
  it('co 25 km na prostej ~100 km → 0,25,50,75,100', () => {
    // ~111 km N–S przy Δlat=1°
    const coords: [number, number][] = [
      [18.0, 54.0],
      [18.0, 55.0],
    ];
    const pts = samplePolylineEveryKm(coords, 25);
    expect(pts[0]!.km).toBe(0);
    expect(pts.map((p) => p.km)).toContain(25);
    expect(pts.map((p) => p.km)).toContain(50);
    expect(pts.length).toBeGreaterThanOrEqual(4);
    expect(pts.every((p) => p.bearingDeg >= 0 && p.bearingDeg < 360)).toBe(true);
  });

  it('GeoJSON LineString → coords; bearing północ ≈ 0', () => {
    const gj = {
      type: 'LineString',
      coordinates: [[18, 54], [18, 55]],
    };
    const c = coordsFromGeoJson(gj);
    expect(c).toHaveLength(2);
    expect(bearingDeg(c[0]!, c[1]!)).toBeLessThan(5);
    expect(haversineKm(c[0]!, c[1]!)).toBeGreaterThan(100);
  });

  it('brak transportu → 0 zapytań (Z6.14)', async () => {
    const fetches: string[] = [];
    const res = await runCorridorWindCore({
      store: {
        e49WindActiveCorridors: async () => [],
      },
      fetch: async (url) => {
        fetches.push(String(url));
        return new Response('{}');
      },
      now: new Date('2026-11-04T12:00:00Z'),
    });
    expect(res.corridors).toBe(0);
    expect(res.points).toBe(0);
    expect(fetches).toHaveLength(0);
    expect(res.reason).toMatch(/0 zapytań/);
  });

  it('SMHI poza siatką → FMI; zapis punktu', async () => {
    const upserts: unknown[] = [];
    const res = await runCorridorWindCore({
      store: {
        e49WindActiveCorridors: async () => ['SE_E4'],
        corridorPolylineGeoJson: async () => ({
          type: 'LineString',
          coordinates: [[18.1, 59.0], [18.2, 59.2]],
        }),
        upsertCorridorWindForecast: async (row) => { upserts.push(row); },
      },
      fetch: async (url) => {
        const u = String(url);
        if (u.includes('snow1g')) {
          return new Response(JSON.stringify({ timeSeries: [] }), { status: 200 });
        }
        if (u.includes('harmonie')) {
          const xml = `
            <wfs:member><gml:id="WindGust-1"/>
              <wml2:time>2026-11-04T14:00:00Z</wml2:time><wml2:value>22</wml2:value>
            </wfs:member>
            <wfs:member><gml:id="WindDirection-1"/>
              <wml2:time>2026-11-04T14:00:00Z</wml2:time><wml2:value>90</wml2:value>
            </wfs:member>`;
          return new Response(xml, { status: 200 });
        }
        return new Response('no', { status: 404 });
      },
      now: new Date('2026-11-04T12:00:00Z'),
      stepKm: 50,
    });
    expect(res.fetchedOk).toBeGreaterThan(0);
    expect(res.sourceFmi).toBeGreaterThan(0);
    expect(upserts.length).toBeGreaterThan(0);
    expect((upserts[0] as { source: string }).source).toBe('FMI');
  });

  it('FMI URL zawiera WindDirection; nearestWindSample; próg 20 m/s w 24 h', () => {
    const url = fmiHarmonieWindUrl(59.3, 18.1, '2026-11-04T12:00:00Z', '2026-11-06T12:00:00Z');
    expect(url).toMatch(/WindDirection/);
    const samples = [
      { at: '2026-11-04T12:00:00.000Z', gustMs: 10, windMs: 8, windFromDeg: 90, source: 'SMHI' as const },
      { at: '2026-11-04T18:00:00.000Z', gustMs: 22, windMs: 14, windFromDeg: 80, source: 'SMHI' as const },
    ];
    expect(nearestWindSample(samples, '2026-11-04T18:10:00Z')?.gustMs).toBe(22);
    expect(gustMeetsThresholdInWindow(samples, '2026-11-04T12:00:00Z', 20)?.gustMs).toBe(22);
    expect(gustMeetsThresholdInWindow(samples, '2026-11-04T12:00:00Z', 25)).toBeNull();
  });

  it('fetchWindSeriesForPoint — SMHI gdy jest seria', async () => {
    const out = await fetchWindSeriesForPoint(
      async () => new Response(JSON.stringify({
        timeSeries: [{
          time: '2026-11-04T12:00:00Z',
          data: { wind_speed: 8, wind_speed_of_gust: 21, wind_from_direction: 100 },
        }],
      }), { status: 200 }),
      18.0,
      59.0,
      new Date('2026-11-04T12:00:00Z'),
    );
    expect(out.source).toBe('SMHI');
    expect(out.samples[0]!.gustMs).toBe(21);
  });
});
