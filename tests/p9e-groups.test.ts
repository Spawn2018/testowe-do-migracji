/**
 * wyglad/P9-e — grupowanie znaczników: auta na promie (E45 pkt 5, test pkt 6: „3 transporty jednego rejsu = jeden
 * znacznik »3«”) i auta w jednej strefie (D-20261009-1309-01 R5, test pkt 5: plac Boden „3”, jedno wyjeżdża → „2” + osobny).
 */
import { describe, expect, it } from 'vitest';
import {
  carsWord, demoStageAnchor, groupView, placeMarkers, splitLabel, vesselKey, zoneOf,
  type GroupItem, type GroupZone, type Placed,
} from '../src/lib/p9eGroups';
import { p9e, p9ep } from '../src/i18n/p9e';

const ZONES: GroupZone[] = [
  { id: 'z-load', name: 'KSH Śrem', type: 'LOADING', lat: 52.07391, lng: 17.0246, radiusM: 600, active: true },
  { id: 'z-gdn', name: 'Port Gdańsk', type: 'PORT_OUT', lat: 54.40372, lng: 18.6813, radiusM: 800, active: true },
  { id: 'z-pre', name: 'Bufor 20 km', type: 'PRE_PORT', lat: 54.3, lng: 18.55, radiusM: 20000, active: true },
  { id: 'z-nyn', name: 'Terminal Nynäshamn', type: 'PORT_IN', lat: 58.903, lng: 17.948, radiusM: 900, active: true },
  { id: 'z-site', name: 'Plac budowy Stegra Boden', type: 'SITE', lat: 65.81273, lng: 21.78898, radiusM: 1000, active: true },
  { id: 'z-buf', name: 'Bufor 50 km przed Boden', type: 'PRE_ARRIVAL', lat: 65.7, lng: 21.9, radiusM: 50000, active: true },
  { id: 'z-rest', name: 'Parking', type: 'REST', lat: 60.82, lng: 17.2, radiusM: 400, active: true },
];

const item = (id: string, lat: number, lng: number, extra: Partial<GroupItem> = {}): GroupItem => ({
  id, lat, lng, tile: 'ROAD_SE', ferryKey: null, lastFixAt: '2026-10-08T16:00:00Z', late: false, ...extra,
});
const noShip = () => null;
const kinds = (ps: Placed[]) => ps.map((p) => (p.kind === 'one' ? `one:${p.id}` : `${p.kind}:${p.ids.length}`));

describe('P9-e grupowanie — strefy (R5)', () => {
  it('3 auta na placu Boden → jeden znacznik „3” na środku strefy; jedno wyjeżdża → „2” + osobny', () => {
    const inSite = [item('a', 65.8127, 21.7889, { tile: 'SITE' }), item('b', 65.8100, 21.7900, { tile: 'SITE' }), item('c', 65.8150, 21.7850, { tile: 'SITE' })];
    const p1 = placeMarkers(inSite, { zones: ZONES, shipOf: noShip, grouping: true });
    expect(kinds(p1)).toEqual(['zone:3']);
    const g = p1[0] as Extract<Placed, { kind: 'zone' }>;
    expect([g.lat, g.lng, g.zoneName, g.zoneType]).toEqual([65.81273, 21.78898, 'Plac budowy Stegra Boden', 'SITE']);
    const p2 = placeMarkers([...inSite.slice(0, 2), item('c', 65.70, 21.70, { tile: 'ROAD_SE' })], { zones: ZONES, shipOf: noShip, grouping: true });
    expect(kinds(p2)).toEqual(['zone:2', 'one:c']);
  });

  it('jedno auto w strefie — zwykły znacznik na swojej pozycji', () => {
    const p = placeMarkers([item('a', 52.0739, 17.0247, { tile: 'LOADING' })], { zones: ZONES, shipOf: noShip, grouping: true });
    expect(p).toEqual([{ kind: 'one', id: 'a', lat: 52.0739, lng: 17.0247 }]);
  });

  it('bufory, punkty i parkingi się nie liczą (tylko załadunek, port PL, port SE, plac); strefa wyłączona też nie', () => {
    expect(zoneOf(54.2, 18.4, ZONES)).toBeNull(); // tylko bufor 20 km
    expect(zoneOf(65.6, 21.9, ZONES)).toBeNull(); // tylko bufor 50 km
    expect(zoneOf(60.82, 17.2, ZONES)).toBeNull(); // parking
    expect(zoneOf(54.4037, 18.6813, ZONES)?.id).toBe('z-gdn');
    expect(zoneOf(54.4037, 18.6813, ZONES.map((z) => ({ ...z, active: false })))).toBeNull();
    const two = placeMarkers([item('a', 54.2, 18.4), item('b', 54.2, 18.4)], { zones: ZONES, shipOf: noShip, grouping: true });
    expect(kinds(two)).toEqual(['one:a', 'one:b']);
  });

  it('opóźnione auto w grupie → grupa z obwódką „opóźniony”', () => {
    const p = placeMarkers([item('a', 58.903, 17.948, { tile: 'PORT_SE' }), item('b', 58.903, 17.948, { tile: 'PORT_SE', late: true })], { zones: ZONES, shipOf: noShip, grouping: true });
    expect(p[0].kind === 'zone' && p[0].late).toBe(true);
  });
});

describe('P9-e grupowanie — prom (E45 pkt 5)', () => {
  const onFerry = (id: string, lat: number, fix: string) => item(id, lat, 18.0, { tile: 'FERRY', ferryKey: 's-1', lastFixAt: fix });

  it('3 auta jednego rejsu → jeden znacznik „3” na pozycji statku z AIS', () => {
    const p = placeMarkers(
      [onFerry('a', 56.0, '2026-10-08T17:00:00Z'), onFerry('b', 56.1, '2026-10-08T17:05:00Z'), onFerry('c', 56.2, '2026-10-08T16:00:00Z')],
      { zones: ZONES, shipOf: (k) => (k === 's-1' ? { lat: 57.3, lng: 18.2, ts: '2026-10-08T20:10:00Z', stale: false, vessel: 'Wawel' } : null), grouping: true },
    );
    expect(kinds(p)).toEqual(['ferry:3']);
    const g = p[0] as Extract<Placed, { kind: 'ferry' }>;
    expect([g.lat, g.lng, g.ais, g.at, g.vessel]).toEqual([57.3, 18.2, 'ok', '2026-10-08T20:10:00Z', 'Wawel']);
  });

  it('bez AIS — ostatnia pozycja auta (najnowsza w grupie) i „brak AIS”', () => {
    const p = placeMarkers([onFerry('a', 56.0, '2026-10-08T17:00:00Z'), onFerry('b', 56.1, '2026-10-08T17:05:00Z')], { zones: ZONES, shipOf: noShip, grouping: true });
    const g = p[0] as Extract<Placed, { kind: 'ferry' }>;
    expect([g.lat, g.ais, g.at]).toEqual([56.1, 'none', '2026-10-08T17:05:00Z']);
  });

  it('prom ma pierwszeństwo przed strefą; dwa rejsy — dwa znaczniki; po zejściu z promu osobno', () => {
    const p = placeMarkers([
      item('a', 54.4037, 18.6813, { tile: 'FERRY', ferryKey: 's-1' }),
      item('b', 54.4037, 18.6813, { tile: 'FERRY', ferryKey: 's-1' }),
      item('c', 54.4037, 18.6813, { tile: 'FERRY', ferryKey: 's-2' }),
      item('d', 58.0, 17.8, { tile: 'PORT_SE', ferryKey: 's-2' }),
    ], { zones: ZONES, shipOf: noShip, grouping: true });
    expect(kinds(p)).toEqual(['ferry:2', 'ferry:1', 'one:d']);
  });

  it('Przegląd i tryb skupienia — bez grup', () => {
    const p = placeMarkers([item('a', 65.8127, 21.7889), item('b', 65.8127, 21.7889)], { zones: ZONES, shipOf: noShip, grouping: false });
    expect(kinds(p)).toEqual(['one:a', 'one:b']);
  });
});

describe('P9-e dymek i lista', () => {
  const tx = (k: string, p?: Record<string, string | number>) => (p ? p9ep('pl', k, p) : p9e('pl', k));
  const ctx = {
    nowIso: '2026-10-08T20:30:00Z',
    row: (id: string) => ({ id, label: `${id.toUpperCase()} · HHL/2026/1`, stageKey: 'p4_tile_FERRY', late: false }),
    ferryInfo: () => ({ vessel: 'Wawel', route: 'GDN-NYN', departureAt: '2026-10-08T16:00:00Z' }),
    tx,
    hm: () => '22:10',
    dt: () => '08.10, 18:00',
  };

  it('prom: „Prom Wawel · 3 auta”, rejs z godziną wypłynięcia, odczyt AIS', () => {
    const v = groupView({ kind: 'ferry', key: 'ferry:s-1', ferryKey: 's-1', ids: ['sg-15', 'sg-16', 'sg-17'], lat: 0, lng: 0, ais: 'ok', at: '2026-10-08T20:10:00Z', vessel: 'Wawel', late: false }, ctx);
    expect(v.title).toBe('Prom Wawel · 3 auta');
    expect(v.sub).toBe('Gdańsk → Nynäshamn · wypłynął 08.10, 18:00');
    expect(v.note).toBe('pozycja statku z AIS · 22:10');
    expect(v.rows.map((r) => splitLabel(r.label).code)).toEqual(['SG-15', 'SG-16', 'SG-17']);
  });

  it('prom przed wypłynięciem i bez AIS', () => {
    const v = groupView({ kind: 'ferry', key: 'ferry:s-1', ferryKey: 's-1', ids: ['a', 'b', 'c', 'd', 'e'], lat: 0, lng: 0, ais: 'none', at: null, vessel: null, late: false }, { ...ctx, nowIso: '2026-10-08T12:00:00Z' });
    expect(v.title).toBe('Prom Wawel · 5 aut');
    expect(v.sub).toBe('Gdańsk → Nynäshamn · odpływa 08.10, 18:00');
    expect(v.note).toBe('brak AIS');
  });

  it('strefa: nazwa miejsca i rodzaj', () => {
    const v = groupView({ kind: 'zone', key: 'zone:z-site', zoneId: 'z-site', zoneName: 'Plac budowy Stegra Boden', zoneType: 'SITE', ids: ['a', 'b'], lat: 0, lng: 0, late: false }, ctx);
    expect([v.title, v.sub, v.note]).toEqual(['Plac budowy Stegra Boden · 2 auta', 'plac', null]);
  });

  it('odmiana, nazwa statku, nazwa transportu, demo', () => {
    expect([1, 2, 4, 5, 12, 14, 22, 25].map(carsWord)).toEqual(['one', 'few', 'few', 'many', 'many', 'many', 'few', 'many']);
    expect(vesselKey('Nova Star')).toBe(vesselKey('NOVA  STAR'));
    expect(splitLabel('SG-03')).toEqual({ code: 'SG-03', num: null });
    expect(demoStageAnchor('SITE', ZONES)).toEqual({ lat: 65.81273, lng: 21.78898 });
    expect(demoStageAnchor('PORT_PL', ZONES)).toEqual({ lat: 54.40372, lng: 18.6813 });
    expect(demoStageAnchor('ROAD_SE', ZONES)).toBeNull();
    expect(demoStageAnchor('FERRY', ZONES)).not.toBeNull();
  });
});
