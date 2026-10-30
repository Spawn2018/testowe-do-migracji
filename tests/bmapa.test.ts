import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { shouldFetch, ROAD_FETCH_DAY_MS } from '../supabase/functions/_shared/here/roadFetch';
import {
  HERE_MAX_ZOOM,
  H6_LAYER_ENABLED,
  ROAD_PL,
  ROAD_SE,
  ROAD_KAA,
  roadKaaSpecFromVia,
  STRAIGHT_GDN_NYN,
  STRAIGHT_GDY_KAA,
  WATER_GDN_NYN,
  WATER_GDY_KAA,
  basemapFor,
  distPointToSegmentKm,
  h6Requests,
  kaaDeviationOk,
  lineHitsLand,
  visibleFerryMarkers,
  ferryPhase,
  metersPerPixel,
  maxDeviationToCorridorKm,
  maxDeviationSymmetricKm,
  nearestKm,
  rawGps,
  roadGeometryOk,
  ferryVisible,
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
    // AUD-01c: CARTO bez klucza = obraz „API KEY REQUIRED” → ciemny zapas = Esri ulice z ciemnym filtrem (bez klucza)
    expect(dark.url).toContain('World_Street_Map');
    expect(dark.url).not.toContain('cartocdn');
    expect(dark.url).not.toContain('World_Dark_Gray');
    expect(dark.className).toBe('wt-tiles-dark');
    expect(dark.attribution).toContain('Esri');
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

  // #572 BN0 / F7 #585 r3 — N1/N2/NOWE-3; fixture inland (nie GPS).
  it('#572 SE-KAA: odchyłka NOWE-3; równoległa 10 km; roadGeometryOk; cos(lat)', () => {
    const corridor: Array<[number, number]> = [
      [56.17, 15.63],
      [56.5, 16.05],
      [57.0, 16.4],
      [57.5, 16.5],
      [58.0, 16.45],
      [58.59, 16.18],
      [59.0, 16.3],
      [59.61, 16.54],
      [60.0, 16.8],
      [60.7, 17.1],
      [61.5, 17.2],
      [62.4, 17.4],
      [63.2, 18.5],
      [63.8, 20.2],
      [64.7, 21.0],
      [65.3, 21.5],
      [65.81, 21.76],
    ];
    const denseOk = denseVia(corridor, 0.25);
    expect(roadGeometryOk(denseOk, ROAD_KAA)).toBe(true);
    expect(roadGeometryOk(denseOk, roadKaaSpecFromVia(corridor.slice(1, -1)))).toBe(true);
    // N1 awaryjne: Norrköping/Västerås nie w jeziorze.
    expect(ROAD_KAA.via.some((v) => Math.abs(v.lat - 58.59) < 0.01 && Math.abs(v.lng - 16.18) < 0.01)).toBe(true);
    expect(ROAD_KAA.via.some((v) => Math.abs(v.lat - 59.61) < 0.01 && Math.abs(v.lng - 16.54) < 0.01)).toBe(true);
    expect(ROAD_KAA.via.some((v) => Math.abs(v.lat - 59.195) < 0.01 && Math.abs(v.lng - 17.628) < 0.01)).toBe(
      false,
    );
    const dense = denseVia(corridor, 5);
    expect(kaaDeviationOk(dense, dense)).toBe(true);
    expect(maxDeviationSymmetricKm(dense, dense)).toBeLessThanOrEqual(2);
    const parallel = dense.map(([lat, lng]) => [lat, lng + 0.18] as [number, number]);
    expect(kaaDeviationOk(parallel, dense)).toBe(false);
    expect(maxDeviationToCorridorKm(parallel, dense)).toBeGreaterThan(2);
    // N2: punkt w połowie odcinka (~200 km) — nearestKm = odcinek, nie wierzchołek; cos(lat) w draw.ts.
    const sparse: Array<[number, number]> = [
      [60.0, 17.0],
      [62.0, 19.0],
    ];
    expect(nearestKm(sparse, 61.0, 18.0)).toBeLessThan(2);
    expect(Math.min(
      Math.hypot((61 - 60) * 111, (18 - 17) * 55),
      Math.hypot((61 - 62) * 111, (18 - 19) * 55),
    )).toBeGreaterThan(100);
    expect(distPointToSegmentKm(65.1, 21.05, 65.0, 20.0, 65.2, 22.0)).toBeLessThan(2);
    expect(readFileSync('supabase/functions/_shared/map/draw.ts', 'utf8')).toMatch(/cosLat/);
    const chord: Array<[number, number]> = [
      [56.1646, 15.6308],
      [65.80539, 21.75914],
    ];
    expect(roadGeometryOk(chord, ROAD_KAA)).toBe(false);
    expect(kaaDeviationOk(chord, dense)).toBe(false);
    const apply = readFileSync('src/components/map/applyBasemap.ts', 'utf8');
    expect(apply).toMatch(/ROAD_KAA/);
    expect(apply).toMatch(/ROAD_LEGS = 5/); // #667 B: + SE-KAA-INLAND
    expect(apply).toMatch(/SE-KAA-INLAND/);
    expect(apply).toMatch(/AbortController/);
    expect(apply).toMatch(/timeout\/sieć/);
    const edge = readFileSync('supabase/functions/here-roads/index.ts', 'utf8');
    expect(edge).toMatch(/passThrough=true/);
    expect(edge).toMatch(/here_corridor_via_points/);
    expect(edge).toMatch(/kaaDeviationOk/);
    expect(edge).toMatch(/shouldFetch/);
    expect(edge).toMatch(/roadKaaSpecFromVia/);
    // #667 B: E22 + inland (TRACK tylko przez stena_se_inland_corridor_code)
    expect(edge).toMatch(/SE_E22/);
    expect(edge).toMatch(/SE-KAA-INLAND/);
    expect(edge).toMatch(/stena_se_inland_corridor_code/);
    expect(edge).not.toMatch(/CORRIDOR_KAA = 'SE_KAA_TRACK'/);
    const mig = readFileSync('supabase/migrations/0316_572_bn0_se_kaa_via.sql', 'utf8');
    expect(mig).toMatch(/SE_KAA_TRACK/);
    expect(mig).toMatch(/retry_after/);
    expect(mig).toMatch(/rebuild_se_kaa_track/);
    expect(mig).toMatch(/95ab7218-69cc-490d-8b68-b379c3ed9aae/);
    expect(mig).toMatch(/b\.rn_start is not null/);
    expect(mig).not.toMatch(/st_makepoint\(15\.63048/);
  });

  it('#572 F7 r4: shouldFetch — retry_after przed świeżością', () => {
    const now = Date.parse('2026-10-27T12:00:00Z');
    const day = ROAD_FETCH_DAY_MS;
    // -infinity + retry_after w przyszłości → brak zapytania
    expect(
      shouldFetch(
        { fetched_at: '-infinity', retry_after: '2026-10-28T12:00:00Z' },
        now,
        false,
      ),
    ).toBe(false);
    // minione retry_after przy świeżym sukcesie → też brak
    expect(
      shouldFetch(
        {
          fetched_at: new Date(now - day / 2).toISOString(),
          retry_after: new Date(now - 3600e3).toISOString(),
        },
        now,
        false,
      ),
    ).toBe(false);
    // -infinity + minione retry → wolno (wymusić przeliczenie)
    expect(
      shouldFetch(
        { fetched_at: '-infinity', retry_after: new Date(now - 3600e3).toISOString() },
        now,
        false,
      ),
    ).toBe(true);
    // corridorNewer + aktywny retry → nadal brak (nie płacić)
    expect(
      shouldFetch(
        {
          fetched_at: new Date(now - day * 2).toISOString(),
          retry_after: '2026-10-28T12:00:00Z',
        },
        now,
        true,
      ),
    ).toBe(false);
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

describe('Q-18 — reguła poprawiona 05.10 07:16', () => {
  const at = (h: number) => new Date(Date.UTC(2026, 9, 5, h, 0, 0)).toISOString();
  const gdn = { id: 'wawel', lat: 54.4, lng: 18.67, ts: at(6) };
  const outGdn = { id: 'wawel', lat: 54.62, lng: 18.85, ts: at(8) };
  const sea = { id: 'wawel', lat: 55.5, lng: 18.4, ts: at(10), destination: 'PLGDN' };
  const nyn = { id: 'wawel', lat: 58.912, lng: 17.955, ts: at(18) };
  const outNyn = { id: 'wawel', lat: 58.75, lng: 17.95, ts: at(21) };
  const back = { id: 'wawel', lat: 57.2, lng: 18.2, ts: at(23), destination: 'SENYN' };
  const gdnAgain = { id: 'wawel', lat: 54.401, lng: 18.672, ts: new Date(Date.UTC(2026, 9, 6, 8, 0, 0)).toISOString() };

  it('test właściciela krok po kroku: Gdańsk → wypływa → Nynäshamn → wypływa do Polski → Gdańsk', () => {
    expect(ferryVisible([gdn])).toBe(true); // prom w Gdańsku → widoczny
    expect(ferryVisible([gdn, outGdn])).toBe(true); // wypływa → widoczny
    expect(ferryVisible([gdn, outGdn, sea])).toBe(true); // w rejsie do Szwecji → widoczny
    expect(ferryVisible([gdn, outGdn, sea, nyn])).toBe(true); // w Nynäshamn → widoczny
    expect(ferryVisible([gdn, outGdn, sea, nyn, outNyn])).toBe(false); // wypływa z Nynäshamn do Polski → znika
    expect(ferryVisible([gdn, outGdn, sea, nyn, outNyn, back])).toBe(false); // nadal w rejsie do Polski
    expect(ferryVisible([gdn, outGdn, sea, nyn, outNyn, back, gdnAgain])).toBe(true); // wchodzi w strefę Gdańska → pojawia się
  });

  it('Gdynia i Karlskrona tak samo', () => {
    const gdy = { id: 'ebba', lat: 54.533, lng: 18.55, ts: at(6) };
    const sea2 = { id: 'ebba', lat: 55.3, lng: 17.6, ts: at(9) };
    const kaa = { id: 'ebba', lat: 56.161, lng: 15.586, ts: at(14) };
    const out = { id: 'ebba', lat: 56.0, lng: 15.95, ts: at(17) };
    expect(ferryPhase([gdy])).toBe('pl-port');
    expect(ferryPhase([gdy, sea2])).toBe('to-se');
    expect(ferryPhase([gdy, sea2, kaa])).toBe('se-port');
    expect(ferryPhase([gdy, sea2, kaa, out])).toBe('to-pl');
    expect(ferryVisible([gdy, sea2, kaa, out])).toBe(false);
  });

  it('kolejność wierszy nie ma znaczenia (sortowanie po czasie)', () => {
    expect(ferryVisible([outNyn, gdn, nyn, sea])).toBe(false);
    expect(ferryVisible([nyn, gdn, sea])).toBe(true);
  });

  it('rejs do Polski niewidoczny na mapie, a pozycje zostają w zbiorze (obie strony)', () => {
    const rows = [gdn, outGdn, sea, nyn, outNyn, back];
    expect(visibleFerryMarkers(rows)).toEqual([]);
    expect(rows).toHaveLength(6);
    const two = [...rows, { id: 'nova', lat: 54.40467, lng: 18.67379, ts: at(5) }];
    expect(visibleFerryMarkers(two).map((m) => m.id)).toEqual(['nova']);
  });

  it('znacznik to ostatnia pozycja widocznego promu', () => {
    expect(visibleFerryMarkers([gdn, outGdn, sea])).toEqual([sea]);
  });

  it('destination nie odwraca kierunku ze strefy', () => {
    expect(ferryVisible([gdn, sea])).toBe(true); // destination PLGDN, ale wyszedł z Gdańska
    expect(ferryVisible([nyn, back])).toBe(false); // destination SENYN, ale wyszedł z Nynäshamn
  });

  it('bez strefy w historii: zapas z kursu, bez kursu niewidoczny', () => {
    expect(ferryVisible([{ ...sea, cog: 350 }])).toBe(true);
    expect(ferryVisible([{ ...sea, cog: 170 }])).toBe(false);
    expect(ferryVisible([sea])).toBe(false);
    expect(ferryVisible([])).toBe(false);
  });

  it('pozycje z produkcji 05.10: Nova Star w Gdańsku i Wawel w Nynäshamn są widoczne', () => {
    expect(ferryVisible([{ id: 'ns', lat: 54.40469, lng: 18.67377, ts: at(5) }])).toBe(true);
    expect(ferryVisible([{ id: 'w', lat: 58.90557, lng: 17.95721, ts: at(5) }])).toBe(true);
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
