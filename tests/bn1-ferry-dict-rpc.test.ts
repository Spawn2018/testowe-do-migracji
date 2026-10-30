import { afterEach, describe, expect, it } from 'vitest';
import {
  applyFerryDictSnapshot, FERRY_ROUTES, isKnownRoute, isOutbound, operatorsForRoute, operatorName,
  resetFerryDictRpc, routeLabelPl, routeShortLabel,
} from '../src/lib/ferryCatalog';
import { ferryPortPl } from '../src/lib/ferryStatusPl';
import { ferryRouteFromDb, sailingFromRow, type SailingDbRow } from '../src/data/mappers';

afterEach(() => {
  resetFerryDictRpc();
});

describe('BN1 — ferry_dict_snapshot → katalog', () => {
  it('TLLA-HEL / HELA-TLL w seedzie; nieznany kod zostaje surowy (nie GDN-NYN)', () => {
    expect(isKnownRoute('TLLA-HEL')).toBe(true);
    expect(ferryRouteFromDb('TLLA-HEL')).toBe('TLLA-HEL');
    expect(isOutbound('HELA-TLL')).toBe(false);
    expect(ferryRouteFromDb('ABC-XYZ')).toBe('ABC-XYZ');
    expect(sailingFromRow({
      id: 'u',
      route: 'ABC-XYZ',
      departure_at: '2026-10-30T08:00:00Z',
      arrival_at: '2026-10-30T10:00:00Z',
      delayed_departure_at: null,
      delayed_arrival_at: null,
      status: 'ZAPLANOWANY',
      source: 'RECZNIE',
    }).routeUnknown).toBe(true);
  });

  it('RPC: outbound z krajów portów (nie z family → kanoniczna)', () => {
    applyFerryDictSnapshot({
      operators: [
        { code: 'VIKING', name: 'Viking Line' },
        { code: 'TALLINK', name: 'Tallink' },
      ],
      ports: [
        { code: 'TLL_A', name: 'Tallinn', terminal: 'A', country: 'EE', lat: 59.44, lon: 24.77 },
        { code: 'HEL_KAT', name: 'Helsinki', terminal: 'KAT', country: 'FI', lat: 60.16, lon: 24.97 },
      ],
      routes: [
        {
          code: 'RPC-REV',
          port_from: 'HEL_KAT',
          port_to: 'TLL_A',
          family_key: 'TLL-HEL',
          operators: ['VIKING'],
        },
        {
          code: 'TLLA-HEL',
          port_from: 'TLL_A',
          port_to: 'HEL_KAT',
          family_key: 'TLL-HEL',
          operators: ['VIKING', 'ECKERO'],
        },
        {
          code: 'TLL-HEL',
          port_from: 'TLL_D',
          port_to: 'HEL_T2',
          family_key: 'TLL-HEL',
          operators: ['TALLINK'],
        },
      ],
    });

    expect(isKnownRoute('TLLA-HEL')).toBe(true);
    expect(ferryRouteFromDb('TLLA-HEL')).toBe('TLLA-HEL');
    expect(operatorsForRoute('TLLA-HEL')).toEqual(['VIKING', 'ECKERO']);
    expect(isOutbound('TLLA-HEL')).toBe(true);
    /* F7: kod spoza seeda — kraje portów, nie outbound rodziny (HELA-TLL przez family byłoby true) */
    expect(isOutbound('RPC-REV')).toBe(false);
    expect(operatorName('VIKING')).toBe('Viking Line');

    const row: SailingDbRow = {
      id: 's1',
      route: 'TLLA-HEL',
      departure_at: '2026-10-30T08:00:00Z',
      arrival_at: '2026-10-30T10:00:00Z',
      delayed_departure_at: null,
      delayed_arrival_at: null,
      status: 'ZAPLANOWANY',
      source: 'VIKING',
      vessels: { name: 'XPRS', operator: 'Viking Line' },
    };
    expect(sailingFromRow(row).route).toBe('TLLA-HEL');
    expect(sailingFromRow(row).routeUnknown).toBeUndefined();
  });

  it('seed Stena/Polferries bez RPC bez zmian', () => {
    expect(ferryRouteFromDb('GDY-KAA')).toBe('GDY-KAA');
    expect(operatorsForRoute('GDN-NYN')).toEqual(['POLFERRIES']);
    expect(isOutbound('KAA-GDY')).toBe(false);
  });

  /* F7 #668 N3: 12 seed + 2 aliasy Terminal A = 14 kodów jak ferry_routes na prod */
  it('F7 #668 N3: każdy kod FERRY_ROUTES + TLLA/HELA ma routeLabelPl i short ≠ kod', () => {
    const codes = [...FERRY_ROUTES.map((r) => r.code), 'TLLA-HEL', 'HELA-TLL'];
    expect(codes).toHaveLength(14);
    for (const c of codes) {
      const pl = routeLabelPl(c);
      expect(pl, c).toBeTruthy();
      expect(pl).not.toBe(c);
      expect(routeShortLabel(c)).not.toBe(c);
    }
  });

  /* DP-9 (#671 / BN9-b pkt 12): routeLabelPl — seed + nazwy z bazy w komunikatach armatora */
  it('DP-9: routeLabelPl seed / alias / RPC (nazwy portów z bazy)', () => {
    expect(routeLabelPl('TLLA-HEL')).toBe('Tallinn A–Helsinki');
    expect(routeLabelPl('GDN-NYN')).toBe('Gdańsk–Nynäshamn');
    expect(routeLabelPl('TLL-HEL')).toBe('Tallinn–Helsinki');
    applyFerryDictSnapshot({
      operators: [{ code: 'VIKING', name: 'Viking Line' }],
      ports: [
        { code: 'HEL_KAT', name: 'Helsinki', terminal: 'KAT', country: 'FI', lat: 60.16, lon: 24.97 },
        { code: 'TLL_A', name: 'Tallinn', terminal: 'A', country: 'EE', lat: 59.44, lon: 24.77 },
      ],
      routes: [{
        code: 'RPC-REV',
        port_from: 'HEL_KAT',
        port_to: 'TLL_A',
        family_key: 'TLL-HEL',
        operators: ['VIKING'],
      }],
    });
    expect(routeLabelPl('RPC-REV')).toBe('Helsinki KAT–Tallinn A');
    expect(ferryPortPl('RPC-REV')).toBe('Helsinki KAT–Tallinn A');
  });
});
