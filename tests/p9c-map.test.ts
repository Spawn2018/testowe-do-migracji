/**
 * wyglad/P9-c — Mapa według E29 (zdecydowane 08.10 12:14; pyt. 1 A; L20, L22): wiersz tabeli i znacznik z tych samych
 * danych — etap, pozycja (godzina, statek, brak GPS, bez pozycji z powodem), ETA Boden, filtry.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { headCounts, markerTone, mapRow, rowMatches, searchHintKey, type RowCtx } from '../src/lib/p9cMap';
import { p9m, p9mp } from '../src/i18n/p9c';
import type { Load } from '../src/types';

const NOW = '2026-10-09T22:30:00Z'; // 00:30 w Polsce (10.10)
const DAY = '2026-10-10T04:30:00Z'; // 06:30 w Polsce, po 03:00
const tx: RowCtx['tx'] = (k, p) => (p ? p9mp('pl', k, p) : p9m('pl', k));
const ctx = (over: Partial<RowCtx> = {}): RowCtx => ({
  role: 'HHL', nowIso: NOW, prod: true, hasFix: () => false, sailingOf: () => undefined, tx, ...over,
});

function load(over: Partial<Load> & { status: string }): Load {
  return {
    id: 'x', code: 'SG-13', itemType: 'SG', qty: 1, stage: 'SE_ROAD', progress: 0.7,
    plannedLoadDate: '2026-10-07', plannedDeliverDate: '2026-10-09', carrierId: 'scx',
    resources: { driverName: 'A', tractorPlate: 'CTR44190', trailerPlate: 'GD035YX' },
    ferry: { vessel: null, departureAt: null, arrivalAt: null, bookingRef: null, status: 'NONE' },
    etaBoden: null, silentMinutes: null, delayed: false, hhlOrderNo: 'HHL/2026/1250', carrierOrderNo: '0005/09/S/2026',
    ...over,
  } as unknown as Load;
}

describe('P9-c · wiersz Mapy', () => {
  it('w drodze z pozycją: godzina ostatniej pozycji, ETA, opóźnienie wobec okna KSH', () => {
    const r = mapRow(load({
      status: 'IN_TRANSIT_SE', etaBoden: '2026-10-09T11:05:00Z', delayed: true, delayMinutesDb: 70,
      etaDetail: { lastFixAt: '2026-10-09T22:19:00Z' },
    }), ctx({ hasFix: () => true }));
    expect(r.tile).toBe('ROAD_SE');
    expect(r.pos).toMatchObject({ kind: 'fix', text: '00:19', alarm: false });
    expect(r.eta.main).toMatch(/^09\.10, 13:05$/);
    expect(r.eta.sub).toBe('+1 h 10 min po oknie');
    expect(r.late).toBe(true);
    expect(r.seg).toBe('SE');
    expect(r.label).toBe('SG-13 · HHL/2026/1250');
  });

  it('brak GPS (cisza 30 min w ruchu, L22): „brak GPS od”, próg, ETA z ostatniej pozycji', () => {
    const r = mapRow(load({ status: 'IN_TRANSIT_PL', stage: 'TO_PORT', silentMinutes: 110, etaBoden: '2026-10-10T04:10:00Z' }), ctx({ hasFix: () => true }));
    expect(r.nogps).toBe(true);
    expect(r.pos).toMatchObject({ kind: 'nogps', text: 'brak GPS od 22:40', sub: 'próg 30 min w ruchu', alarm: true });
    expect(r.eta.sub).toBe('z ostatniej pozycji');
    expect(r.seg).toBe('PL');
  });

  it('na promie: statek (AIS) i rejs z portami', () => {
    const r = mapRow(load({ status: 'ON_FERRY', stage: 'FERRY', sailingId: 's1', etaDetail: { lastFixAt: '2026-10-09T22:14:00Z' } }), ctx({
      hasFix: () => true,
      sailingOf: () => ({ id: 's1', vessel: 'Wawel', route: 'GDN-NYN' } as never),
    }));
    expect(r.pos).toMatchObject({ kind: 'ship', text: '00:14', sub: 'statek (AIS)' });
    expect(r.stageSub).toBe('Wawel · Gdańsk → Nynäshamn');
  });

  it('dzień załadunku po 03:00 bez linku: w oknie, „brak pozycji”, powód i kto uzupełnia; ETA „–”; opóźnienie przed wyjazdem się nie liczy', () => {
    const r = mapRow(load({ status: 'PLANNED', stage: 'PLAN', plannedLoadDate: '2026-10-10', delayed: true, trackingLink: null }), ctx({ nowIso: DAY }));
    expect(r.inWindow).toBe(true);
    expect(r.pos).toMatchObject({ kind: 'none', text: 'brak pozycji', sub: 'brak linku śledzenia · Do zrobienia SCX', alarm: true });
    expect(r.nopos).toBe(true);
    expect(r.eta.main).toBe('–');
    expect(r.late).toBe(false);
    expect(r.stageSub).toBe('dzień załadunku 10.10');
  });

  it('link czeka na pierwszą pozycję; przed 03:00 poza oknem', () => {
    const wait = mapRow(load({ status: 'READY', stage: 'PLAN', plannedLoadDate: '2026-10-10', trackingLink: { provider: 'RIO', check: { state: 'pending' } } }), ctx({ nowIso: DAY }));
    expect(wait.pos.sub).toBe('link śledzenia czeka na pierwszą pozycję');
    const early = mapRow(load({ status: 'PLANNED', stage: 'PLAN', plannedLoadDate: '2026-10-10' }), ctx());
    expect(early.inWindow).toBe(false);
    expect(early.nopos).toBe(false);
  });

  it('na placu: „na placu od”; po „Dostarczone” poza oknem', () => {
    const site = mapRow(load({ status: 'AT_SITE', stage: 'SITE', etaBoden: '2026-10-09T21:05:00Z' }), ctx({ hasFix: () => true }));
    expect(site.eta.main).toBe('na placu od 23:05');
    expect(markerTone(site.tile)).toBe('site');
    const done = mapRow(load({ status: 'DELIVERED', stage: 'DELIVERED' }), ctx());
    expect(done.inWindow).toBe(false);
  });

  it('nagłówek i wyszukiwanie (kod, numer zlecenia, tablice)', () => {
    const a = mapRow(load({ status: 'IN_TRANSIT_SE' }), ctx({ hasFix: () => true, nowIso: DAY }));
    const b = mapRow(load({ status: 'PLANNED', stage: 'PLAN', plannedLoadDate: '2026-10-10' }), ctx({ nowIso: DAY }));
    expect(headCounts([a, b])).toEqual({ n: 2, withPos: 1, noPos: 1 });
    const l = load({ status: 'IN_TRANSIT_SE' });
    expect(rowMatches(l, 'HHL', 'ctr44')).toBe(true);
    expect(rowMatches(l, 'HHL', '0005/09')).toBe(true);
    expect(rowMatches(l, 'HHL', 'hhl/2026/1250')).toBe(true);
    expect(rowMatches(l, 'HHL', 'GD035')).toBe(true);
    expect(rowMatches(l, 'HHL', 'xyz')).toBe(false);
  });

  it('wyszukiwanie według firmy (E41, 08.10): KSH tylko kod i tablice, SCX swój numer i HHL, nigdy numer z pliku KSH', () => {
    const l = load({ status: 'IN_TRANSIT_SE', orderNo: '15048/2026/OSL/GDA/P' });
    /* KSH: numer zlecenia HHL ani SCX nie jest kluczem (nie ujawnia powiązania) */
    expect(rowMatches(l, 'KSH', 'HHL/2026/1250')).toBe(false);
    expect(rowMatches(l, 'KSH', '0005/09/S/2026')).toBe(false);
    expect(rowMatches(l, 'KSH', 'sg-13')).toBe(true);
    expect(rowMatches(l, 'KSH', 'CTR44190')).toBe(true);
    expect(rowMatches(l, 'KSH', 'gd035')).toBe(true);
    /* SCX widzi numer HHL (tylko do odczytu) i swój */
    expect(rowMatches(l, 'SCX', 'HHL/2026/1250')).toBe(true);
    expect(rowMatches(l, 'SCX', '0005/09')).toBe(true);
    /* numer z pliku KSH nie jest kluczem w żadnej firmie (jak Harmonogram) */
    for (const role of ['HHL', 'SCX', 'KSH'] as const) expect(rowMatches(l, role, '15048/2026')).toBe(false);
    expect(searchHintKey('KSH')).toBe('p9c_search_ksh');
    expect(p9m('pl', searchHintKey('KSH'))).toBe('Szukaj: kod, tablice');
    expect(p9m('pl', searchHintKey('HHL'))).toBe('Szukaj: kod, nr zlecenia, tablice');
    expect(p9m('pl', searchHintKey('SCX'))).toBe('Szukaj: kod, nr zlecenia, tablice');
  });

  it('KSH widzi sam kod (E41)', () => {
    expect(mapRow(load({ status: 'IN_TRANSIT_SE' }), ctx({ role: 'KSH' })).label).toBe('SG-13');
  });
});

describe('P9-c · teksty i podpięcie', () => {
  it('nagłówek bez częstotliwości (L20), warstwy E29 pkt 3, legenda pkt 4', () => {
    expect(p9mp('pl', 'p9c_head', { n: 6, m: 4, k: 2 })).toBe('W oknie śledzenia 6 · z pozycją 4 · bez pozycji 2');
    expect(p9m('pl', 'p9c_head_hint')).toBe(' — od 03:00 w dniu załadunku do „Dostarczone”');
    expect(['p9c_l_vehicles', 'p9c_l_route', 'p9c_l_zones', 'p9c_l_road', 'p9c_l_trail'].map((k) => p9m('pl', k)))
      .toEqual(['Pojazdy i statki', 'Trasa (droga i prom)', 'Strefy', 'Utrudnienia drogowe', 'Przebieg wybranego']);
    expect(p9m('pl', 'p9c_lg_road')).toBe('w drodze (PL, port, prom, SE)');
  });
  it('bez kodów transportów w tekstach (I-0) i bez „pozycje co”', () => {
    const src = readFileSync('src/i18n/p9c.ts', 'utf8');
    expect(src).not.toMatch(/SG-\d|T-\d|WGM|pozycje co/);
  });
  it('mapa: „Trasa” = droga i prom, statki pod „Pojazdy”, bez kropek (E45 pkt 2–3)', () => {
    const map = readFileSync('src/components/map/CorridorMap.tsx', 'utf8');
    expect(map).toMatch(/setVis\(layers\.ferryLeg, !!mapLayers\.route\)/);
    expect(map).toMatch(/setVis\(layers\.ais, !!mapLayers\.vehicles\)/);
    expect(map).toMatch(/setVis\(layers\.poi, false\)/);
  });
  it('strona Mapa poza pierwszym wczytaniem (budżet 400 kB)', () => {
    expect(readFileSync('src/App.tsx', 'utf8')).toMatch(/import \{ MapViewLazy as MapView \} from '\.\/views\/mapLazy'/);
  });
});

describe('P9-c · powód braku pozycji tylko z danych', () => {
  it('stan linku nieznany (pole niepodane) — bez powodu', () => {
    const r = mapRow(load({ status: 'PLANNED', stage: 'PLAN', plannedLoadDate: '2026-10-10' }), ctx({ nowIso: '2026-10-10T04:30:00Z' }));
    expect(r.pos).toMatchObject({ kind: 'none', sub: null, alarm: true });
  });
});
