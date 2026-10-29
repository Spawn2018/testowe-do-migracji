import { describe, expect, it } from 'vitest';
import {
  FERRY_OPERATORS, FERRY_PORTS, FERRY_ROUTES, isKnownRoute, isOutbound, operatorsForRoute, outboundRoutesOf,
  portByCode, routeByCode, routePorts,
} from '../src/lib/ferryCatalog';
import { sailingFromRow, type SailingDbRow } from '../src/data/mappers';
import { operatorMatches } from '../src/lib/awizacjaState';
import { crossingLine, nearestCrossingByOperator, nearestCrossingSailings } from '../src/lib/sailings';
import { lineOf, ROUTE_SHORT, isOutbound as sailIsOutbound } from '../src/lib/sailView';
import { LINE_PORTS, ferryRowsFromDb, rowPorts } from '../src/lib/p6Route';
import { extraWaterTracksFor, WATER_TRACKS_EXTRA } from '../src/lib/map/ferryLines';
import { haversineKm, lineLengthKm, maxSegmentKm, WATER_GDN_NYN, WATER_GDY_KAA } from '../src/lib/map/draw';
import { portName } from '../src/lib/portName';
import { ferryPortPl } from '../src/lib/ferryStatusPl';
import type { Sailing } from '../src/types';

const NOW = Date.parse('2026-10-26T08:00:00Z');

function S(p: Partial<Sailing> & Pick<Sailing, 'id' | 'route' | 'departureAt'>): Sailing {
  return {
    vessel: 'Statek', arrivalAt: p.departureAt, delayedDepartureAt: null, delayedArrivalAt: null,
    status: 'ZAPLANOWANY', source: 'RECZNIE', ...p,
  };
}

describe('BN9-a — katalog promów jest spójny', () => {
  it('każda trasa ma oba porty i co najmniej jednego armatora z katalogu', () => {
    const ops = new Set(FERRY_OPERATORS.map((o) => o.code));
    for (const r of FERRY_ROUTES) {
      expect(r.code).toMatch(/^[A-Z]{3}-[A-Z]{3}$/);
      const [a, b] = r.code.split('-');
      expect([a, b]).toEqual([r.from, r.to]);
      expect(portByCode(r.from)).not.toBeNull();
      expect(portByCode(r.to)).not.toBeNull();
      expect(r.operators.length).toBeGreaterThan(0);
      for (const o of r.operators) expect(ops.has(o)).toBe(true);
    }
  });

  it('kierunki parami: dla każdej trasy jest powrót z tymi samymi armatorami i torem, dokładnie jedna jest wyjazdowa', () => {
    for (const r of FERRY_ROUTES) {
      const back = routeByCode(`${r.to}-${r.from}`);
      expect(back, r.code).not.toBeNull();
      expect(back!.operators).toEqual(r.operators);
      expect(back!.waterTrack).toBe(r.waterTrack);
      expect(back!.outbound).toBe(!r.outbound);
    }
  });

  it('kody unikalne, porty z krajem i nazwą w słowniku', () => {
    expect(new Set(FERRY_ROUTES.map((r) => r.code)).size).toBe(FERRY_ROUTES.length);
    expect(new Set(FERRY_PORTS.map((p) => p.code)).size).toBe(FERRY_PORTS.length);
    for (const p of FERRY_PORTS) {
      expect(['PL', 'SE', 'EE', 'FI']).toContain(p.country);
      expect(portName('pl', p.code)).not.toBe(p.code);
    }
    expect(portName('pl', 'STO')).toBe('Sztokholm');
    expect(portName('en', 'KPS')).toBe('Kapellskär');
  });

  it('kierunek wyjazdowy: PL → SE i z Estonii', () => {
    expect(FERRY_ROUTES.filter((r) => r.outbound).map((r) => r.code).sort())
      .toEqual(['GDN-NYN', 'GDY-KAA', 'MUU-VUO', 'PLD-KPS', 'TLL-HEL', 'TLL-STO']);
    expect(isOutbound('GDN-NYN')).toBe(true);
    expect(isOutbound('KAA-GDY')).toBe(false);
    expect(isOutbound('HEL-TLL')).toBe(false);
    expect(isOutbound('XXX-YYY')).toBe(false);
    expect(sailIsOutbound('TLL-HEL')).toBe(true);
    expect(sailIsOutbound('NYN-GDN')).toBe(false);
  });

  it('pomocnicze: armatorzy, porty trasy, trasy wyjazdowe armatora', () => {
    expect(operatorsForRoute('TLL-HEL')).toEqual(['TALLINK', 'VIKING', 'ECKERO']);
    expect(operatorsForRoute('PLD-KPS')).toEqual(['DFDS', 'TALLINK']);
    expect(operatorsForRoute('nope')).toEqual([]);
    expect(routePorts('MUU-VUO')!.map((p) => p.country)).toEqual(['EE', 'FI']);
    expect(outboundRoutesOf('POLFERRIES')).toEqual(['GDN-NYN']);
    expect(outboundRoutesOf('STENA')).toEqual(['GDY-KAA']);
    expect(outboundRoutesOf('TALLINK')).toEqual(['TLL-HEL', 'TLL-STO', 'PLD-KPS']);
    expect(isKnownRoute('TLL-STO')).toBe(true);
    expect(isKnownRoute('GDN-KAA')).toBe(false);
  });

  it('dzisiejsze widoki bez zmian: skróty tras, porty wierszy Polferries i Stena', () => {
    expect(ROUTE_SHORT['GDN-NYN']).toBe('GDN → NYN');
    expect(ROUTE_SHORT['KAA-GDY']).toBe('KAA → GDY');
    expect(LINE_PORTS.POLFERRIES).toEqual({ from: 'GDN', to: 'NYN' });
    expect(LINE_PORTS.STENA).toEqual({ from: 'GDY', to: 'KAA' });
    expect(ferryPortPl('GDN-NYN')).toBe('Gdańsk–Nynäshamn');
    expect(ferryPortPl('TLL-HEL')).toBe('Tallinn–Helsinki');
  });
});

describe('BN9-a — mapowanie rejsów z bazy', () => {
  const row = (route: string, source = 'RECZNIE'): SailingDbRow => ({
    id: 'r', route, departure_at: '2026-10-27T08:00:00Z', arrival_at: '2026-10-27T10:00:00Z',
    delayed_departure_at: null, delayed_arrival_at: null, status: 'ZAPLANOWANY', source, vessels: { name: 'Megastar', operator: 'Tallink' },
  });
  it('TLL-HEL/TLLA-HEL zostają; nieznany kod — surowy (BN1 F7 #649, nie GDN-NYN)', () => {
    expect(sailingFromRow(row('TLL-HEL')).route).toBe('TLL-HEL');
    expect(sailingFromRow(row('KPS-PLD')).route).toBe('KPS-PLD');
    expect(sailingFromRow(row('KAA-GDY')).route).toBe('KAA-GDY');
    expect(sailingFromRow(row('TLLA-HEL')).route).toBe('TLLA-HEL');
    expect(sailingFromRow(row('TLLA-HEL')).routeUnknown).toBeUndefined();
    expect(sailingFromRow(row('ABC-DEF')).route).toBe('ABC-DEF');
    expect(sailingFromRow(row('ABC-DEF')).routeUnknown).toBe(true);
  });
  it('źródło: armator z katalogu zostaje, inne — RECZNIE', () => {
    expect(sailingFromRow(row('TLL-HEL', 'TALLINK')).source).toBe('TALLINK');
    expect(sailingFromRow(row('GDY-KAA', 'STENA')).source).toBe('STENA');
    expect(sailingFromRow(row('TLL-HEL', 'COS')).source).toBe('RECZNIE');
  });
});

describe('BN9-a — armator rejsu', () => {
  it('operatorMatches: Polferries i Stena jak dotąd', () => {
    expect(operatorMatches(S({ id: 'a', route: 'GDY-KAA', departureAt: 'x' }), 'STENA')).toBe(true);
    expect(operatorMatches(S({ id: 'a', route: 'GDN-NYN', departureAt: 'x', operator: 'Stena Line' }), 'STENA')).toBe(true);
    expect(operatorMatches(S({ id: 'a', route: 'GDN-NYN', departureAt: 'x', operator: 'Stena Line' }), 'POLFERRIES')).toBe(false);
    expect(operatorMatches(S({ id: 'a', route: 'NYN-GDN', departureAt: 'x' }), 'POLFERRIES')).toBe(true);
    expect(operatorMatches(S({ id: 'a', route: 'TLL-HEL', departureAt: 'x' }), 'POLFERRIES')).toBe(false);
    expect(operatorMatches(S({ id: 'a', route: 'TLL-HEL', departureAt: 'x' }), 'STENA')).toBe(false);
  });
  it('operatorMatches: nowe trasy — nazwa armatora albo jego trasa', () => {
    const viking = S({ id: 'v', route: 'TLL-HEL', departureAt: 'x', operator: 'Viking Line' });
    expect(operatorMatches(viking, 'VIKING')).toBe(true);
    expect(operatorMatches(viking, 'TALLINK')).toBe(false);
    const bare = S({ id: 'b', route: 'HEL-TLL', departureAt: 'x' });
    expect(operatorMatches(bare, 'TALLINK')).toBe(true);
    expect(operatorMatches(bare, 'ECKERO')).toBe(true);
    expect(operatorMatches(bare, 'DFDS')).toBe(false);
    expect(operatorMatches(S({ id: 'd', route: 'PLD-KPS', departureAt: 'x', operator: 'DFDS Seaways' }), 'DFDS')).toBe(true);
    expect(operatorMatches(S({ id: 'f', route: 'MUU-VUO', departureAt: 'x', operator: 'Finbo Cargo' }), 'ECKERO')).toBe(true);
  });
  it('crossingLine i lineOf: armator z rejsu, a bez niego pierwszy z katalogu', () => {
    expect(crossingLine(S({ id: 'a', route: 'TLL-HEL', departureAt: 'x', operator: 'Viking Line' }))).toBe('VIKING');
    expect(crossingLine(S({ id: 'b', route: 'TLL-HEL', departureAt: 'x' }))).toBe('TALLINK');
    expect(crossingLine(S({ id: 'c', route: 'PLD-KPS', departureAt: 'x' }))).toBe('DFDS');
    expect(crossingLine(S({ id: 'd', route: 'TLL-HEL', departureAt: 'x', source: 'ECKERO' }))).toBe('ECKERO');
    expect(crossingLine(S({ id: 'e', route: 'GDN-NYN', departureAt: 'x', operator: 'TT-Line' }))).toBeNull();
    expect(lineOf({ route: 'MUU-VUO' })).toBe('ECKERO');
    expect(lineOf({ route: 'GDY-KAA' })).toBe('STENA');
  });
});

describe('BN9-a — najbliższe rejsy: nowi armatorzy tylko z rejsem', () => {
  const pf = S({ id: 'pf', route: 'GDN-NYN', departureAt: '2026-10-26T16:00:00Z', source: 'POLFERRIES' });
  const st = S({ id: 'st', route: 'GDY-KAA', departureAt: '2026-10-26T19:00:00Z', source: 'STENA' });
  it('dzisiejsze dane — tylko Polferries i Stena, kształt jak dotąd', () => {
    expect(Object.keys(nearestCrossingByOperator([pf, st], NOW))).toEqual(['STENA', 'POLFERRIES']);
    expect(Object.keys(nearestCrossingByOperator([], NOW))).toEqual(['STENA', 'POLFERRIES']);
    expect(nearestCrossingSailings([pf, st], NOW)).toEqual({ polferries: [pf], stena: [st] });
  });
  it('rejs Tallinka dochodzi jako osobna pozycja; powroty i odwołane nie', () => {
    const tl = S({ id: 'tl', route: 'TLL-HEL', departureAt: '2026-10-26T10:00:00Z', operator: 'Tallink' });
    const back = S({ id: 'tb', route: 'HEL-TLL', departureAt: '2026-10-26T11:00:00Z', operator: 'Tallink' });
    const vx = S({ id: 'vx', route: 'TLL-HEL', departureAt: '2026-10-26T12:00:00Z', operator: 'Viking Line', status: 'ODWOLANY' });
    const m = nearestCrossingByOperator([pf, st, tl, back, vx], NOW);
    expect(m.TALLINK?.map((s) => s.id)).toEqual(['tl']);
    expect(m.VIKING).toBeUndefined();
    expect(nearestCrossingSailings([pf, st, tl], NOW)).toEqual({ polferries: [pf], stena: [st] });
  });
  it('Sytuacja na trasie: wiersze nowych armatorów tylko z rejsem', () => {
    const rows = ferryRowsFromDb([pf, st], [], [], NOW);
    expect(rows.map((r) => r.line)).toEqual(['POLFERRIES', 'STENA']);
    const tl = S({ id: 'tl', route: 'TLL-STO', departureAt: '2026-10-26T15:00:00Z', operator: 'Tallink' });
    const rows2 = ferryRowsFromDb([pf, st, tl], [], [], NOW);
    expect(rows2.map((r) => r.line)).toEqual(['TALLINK', 'POLFERRIES', 'STENA']);
    expect(rows2[0].sea).toBeNull();
    expect(rowPorts(rows2[0])).toEqual({ from: 'TLL', to: 'STO' });
    expect(rowPorts(rows2[1])).toEqual({ from: 'GDN', to: 'NYN' });
    expect(rowPorts({ line: 'STENA' })).toEqual({ from: 'GDY', to: 'KAA' });
  });
});

describe('BN9-a — tory wodne nowych przepraw', () => {
  /* Bałtyk z Zatoką Fińską i Morzem Alandzkim */
  const inBaltic = ([lat, lng]: readonly [number, number]) => lat >= 53.5 && lat <= 61 && lng >= 9.5 && lng <= 30.5;

  it('każdy punkt w bboxie Bałtyku, końce < 3 km od portów trasy, bez dziur, rozsądna długość', () => {
    for (const [id, line] of Object.entries(WATER_TRACKS_EXTRA)) {
      const r = routeByCode(id)!;
      expect(r.waterTrack).toBe(id);
      expect(line.length).toBeGreaterThanOrEqual(5);
      for (const p of line) expect(inBaltic(p), `${id} ${p}`).toBe(true);
      const [a, b] = routePorts(id)!;
      const first = line[0];
      const last = line[line.length - 1];
      expect(haversineKm(first[0], first[1], a.lat, a.lng), `${id} start`).toBeLessThan(3);
      expect(haversineKm(last[0], last[1], b.lat, b.lng), `${id} koniec`).toBeLessThan(3);
      expect(maxSegmentKm(line)).toBeLessThan(80);
      const straight = haversineKm(a.lat, a.lng, b.lat, b.lng);
      const len = lineLengthKm(line);
      expect(len).toBeGreaterThanOrEqual(straight);
      expect(len).toBeLessThan(straight * 1.6);
    }
  });

  it('TLL-STO przechodzi przez Mariehamn', () => {
    const near = WATER_TRACKS_EXTRA['TLL-STO'].some(([lat, lng]) => haversineKm(lat, lng, 60.093, 19.925) < 3);
    expect(near).toBe(true);
  });

  it('dzisiejsze tory: końce < 3 km od portów z katalogu', () => {
    for (const [code, lane] of [['GDN-NYN', WATER_GDN_NYN], ['GDY-KAA', WATER_GDY_KAA]] as const) {
      const [a, b] = routePorts(code)!;
      const [fLng, fLat] = lane[0];
      const [lLng, lLat] = lane[lane.length - 1];
      expect(haversineKm(fLat, fLng, a.lat, a.lng)).toBeLessThan(3);
      expect(haversineKm(lLat, lLng, b.lat, b.lng)).toBeLessThan(3);
    }
  });

  it('rysowane tylko dla użytych nowych tras — dzisiejsze trasy nie dają nic', () => {
    expect(extraWaterTracksFor(['GDN-NYN', 'KAA-GDY', null, undefined])).toEqual([]);
    expect(extraWaterTracksFor(['HEL-TLL', 'TLL-HEL', 'PLD-KPS']).map((x) => x.id)).toEqual(['TLL-HEL', 'PLD-KPS']);
  });
});
