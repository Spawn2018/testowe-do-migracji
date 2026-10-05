import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  HERE_MAX_ZOOM,
  H6_LAYER_ENABLED,
  ROAD_PL,
  ROAD_SE,
  STRAIGHT_GDN_NYN,
  STRAIGHT_GDY_KAA,
  WATER_GDN_NYN,
  WATER_GDY_KAA,
  basemapFor,
  h6Requests,
  lineHitsLand,
  markersSailingToSweden,
  metersPerPixel,
  rawGps,
  roadGeometryOk,
  sailingToSweden,
  trailForDraw,
  warsawMonth,
} from '../src/lib/map/draw';
import { prodFleetMarkers } from '../src/lib/vehicleMarkers';

const lightHere = basemapFor({
  theme: 'light',
  spentUsd: 10,
  spentMonth: '2026-10-01',
  now: new Date('2026-10-15T10:00:00Z'),
});
const darkHere = basemapFor({
  theme: 'dark',
  spentUsd: 10,
  spentMonth: '2026-10-01',
  now: new Date('2026-10-15T10:00:00Z'),
});

describe('B-MAPA podkład', () => {
  it('każdy motyw przy otwartym budżecie to HERE logistics', () => {
    expect(lightHere.provider).toBe('here');
    expect(lightHere.style).toBe('logistics.day');
    expect(darkHere.provider).toBe('here');
    expect(darkHere.style).toBe('logistics.night');
    expect(lightHere.hereRequests).toBe(true);
    expect(darkHere.hereRequests).toBe(true);
    expect(lightHere.attribution).toContain('HERE');
    expect(lightHere.maxZoom).toBeGreaterThanOrEqual(18);
    expect(lightHere.url).toBeNull();
  });

  it('80% budżetu: zapas z etykietami i zero zapytań HERE do końca miesiąca', () => {
    const oct = new Date('2026-10-20T12:00:00Z');
    const light = basemapFor({ theme: 'light', spentUsd: 80, spentMonth: '2026-10-01', now: oct });
    const dark = basemapFor({ theme: 'dark', spentUsd: 80, spentMonth: '2026-10-01', now: oct });
    expect(light.hereRequests).toBe(false);
    expect(dark.hereRequests).toBe(false);
    expect(light.url).toContain('World_Street_Map');
    expect(light.url).not.toContain('World_Light_Gray');
    expect(light.attribution).toContain('Esri');
    expect(light.attribution).not.toContain('CARTO');
    expect(dark.url).toContain('dark_all');
    expect(dark.url).not.toContain('World_Dark_Gray');
    expect(dark.attribution).toContain('CARTO');
    expect(dark.attribution).toContain('OpenStreetMap');
    const back = basemapFor({
      theme: 'light',
      spentUsd: 80,
      spentMonth: '2026-10-01',
      now: new Date('2026-10-31T23:30:00Z'),
    });
    expect(warsawMonth(back ? new Date('2026-10-31T23:30:00Z') : new Date())).toBe('2026-11');
    expect(back.provider).toBe('here');
    expect(back.hereRequests).toBe(true);
  });

  it('zoom pokazuje plac w Śremie i w Boden', () => {
    expect(HERE_MAX_ZOOM).toBeGreaterThanOrEqual(18);
    expect(metersPerPixel(52.07391, 18)).toBeLessThan(0.5);
    expect(metersPerPixel(65.80539, 18)).toBeLessThan(0.4);
  });

  it('mapy nie wołają szarego Esri ani błędnego podpisu', () => {
    for (const file of [
      'src/components/map/CorridorMap.tsx',
      'src/components/map/GeofenceEditorMap.tsx',
      'src/components/drawer/LoadDrawer.tsx',
    ]) {
      const src = readFileSync(file, 'utf8');
      expect(src).not.toContain('World_Light_Gray');
      expect(src).not.toContain('World_Dark_Gray');
      expect(src).not.toContain('carto.com/attributions">CARTO</a> · Esri');
    }
    expect(readFileSync('src/components/map/CorridorMap.tsx', 'utf8')).toContain('applyBasemap');
    expect(readFileSync('src/components/map/GeofenceEditorMap.tsx', 'utf8')).toContain('applyBasemap');
    expect(readFileSync('src/components/drawer/LoadDrawer.tsx', 'utf8')).toContain('CorridorMap');
    expect(readFileSync('src/components/map/TrackReplay.tsx', 'utf8')).toContain('data-trail-source');
  });
});

describe('B-MAPA geometria', () => {
  it('cięciwa nie jest trasą drogową, gęsta łamana przez punkty kontrolne jest', () => {
    const chord: Array<[number, number]> = [
      [52.07391, 17.0246],
      [54.40372, 18.6813],
    ];
    expect(roadGeometryOk(chord, ROAD_PL)).toBe(false);
    const dense = denseVia(ROAD_PL.via.map((v) => [v.lat, v.lng] as [number, number]), 0.4);
    expect(roadGeometryOk(dense, ROAD_PL)).toBe(true);
    expect(roadGeometryOk(dense, ROAD_SE)).toBe(false);
  });

  it('ślad przez rondo to surowe punkty, bez dopasowania', () => {
    const roundabout = [
      { lat: 52.4064, lng: 16.925 },
      { lat: 52.4066, lng: 16.9254 },
      { lat: 52.4065, lng: 16.9258 },
      { lat: 52.4062, lng: 16.9255 },
    ];
    const drawn = trailForDraw(roundabout);
    expect(drawn.source).toBe('points');
    expect(drawn.matched).toBe(false);
    expect(drawn.line).toEqual(roundabout);
  });

  it('pozycja auta nie jest przesuwana', () => {
    const fix = { lat: 52.07391, lng: 17.0246 };
    expect(rawGps(fix)).toEqual(fix);
    const markers = prodFleetMarkers(
      [{ id: 'l', code: 'SG-01', status: 'IN_TRANSIT_PL', progress: 0.2, driver: null, plate: null }],
      new Map([['l', fix]]),
    );
    expect(markers[0].lat).toBe(fix.lat);
    expect(markers[0].lng).toBe(fix.lng);
  });

  it('trasy promów nie tną lądu, prosta tak', () => {
    expect(lineHitsLand(WATER_GDN_NYN)).toBe(false);
    expect(lineHitsLand(WATER_GDY_KAA)).toBe(false);
    expect(lineHitsLand(STRAIGHT_GDN_NYN)).toBe(true);
    expect(lineHitsLand(STRAIGHT_GDY_KAA)).toBe(true);
  });

  it('warstwa H-6 nie woła HERE', () => {
    expect(H6_LAYER_ENABLED).toBe(false);
    expect(h6Requests(false, true)).toBe(false);
    expect(h6Requests(true, true)).toBe(false);
    expect(h6Requests(true, false)).toBe(false);
  });
});

describe('Q-18', () => {
  const gdn = { id: 'wawel', lat: 54.4, lng: 18.67, ts: '2026-10-05T06:00:00Z' };
  const sea = { id: 'wawel', lat: 55.5, lng: 18.4, ts: '2026-10-05T10:00:00Z', destination: 'PLGDN' };
  const nyn = { id: 'wawel', lat: 58.912, lng: 17.955, ts: '2026-10-05T18:00:00Z' };
  const back = { id: 'wawel', lat: 57.2, lng: 18.2, ts: '2026-10-05T22:00:00Z', destination: 'SENYN' };

  it('wyjście z Gdańska pokazuje prom, wejście do Nynäshamn chowa', () => {
    expect(sailingToSweden([gdn])).toBe(false);
    expect(sailingToSweden([gdn, sea])).toBe(true);
    expect(sailingToSweden([gdn, sea, nyn])).toBe(false);
  });

  it('rejs do Polski jest niewidoczny, a pozycja zostaje w zbiorze', () => {
    const rows = [gdn, sea, nyn, back];
    expect(sailingToSweden([nyn, back])).toBe(false);
    expect(markersSailingToSweden(rows)).toEqual([]);
    expect(rows).toHaveLength(4);
  });

  it('destination nie odwraca kierunku ze strefy', () => {
    expect(sailingToSweden([gdn, sea])).toBe(true);
    expect(sailingToSweden([nyn, back])).toBe(false);
    expect(sailingToSweden([sea])).toBe(false);
  });
});

function denseVia(via: Array<[number, number]>, stepKm: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let i = 0; i < via.length - 1; i++) {
    const [aLat, aLng] = via[i];
    const [bLat, bLng] = via[i + 1];
    const km = Math.hypot((bLat - aLat) * 111, (bLng - aLng) * 111 * Math.cos((aLat * Math.PI) / 180));
    const n = Math.max(2, Math.ceil(km / stepKm));
    for (let s = 0; s < n; s++) {
      const t = s / n;
      out.push([aLat + (bLat - aLat) * t, aLng + (bLng - aLng) * t]);
    }
  }
  out.push(via[via.length - 1]);
  return out;
}
