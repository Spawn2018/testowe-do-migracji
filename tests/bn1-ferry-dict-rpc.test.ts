import { afterEach, describe, expect, it } from 'vitest';
import {
  applyFerryDictSnapshot, isKnownRoute, isOutbound, operatorsForRoute, operatorName, resetFerryDictRpc,
} from '../src/lib/ferryCatalog';
import { ferryRouteFromDb, sailingFromRow, type SailingDbRow } from '../src/data/mappers';

afterEach(() => {
  resetFerryDictRpc();
});

describe('BN1 — ferry_dict_snapshot → katalog', () => {
  it('TLLA-HEL z RPC nie spada na GDN-NYN; armatorzy i outbound z family_key', () => {
    expect(isKnownRoute('TLLA-HEL')).toBe(false);
    expect(ferryRouteFromDb('TLLA-HEL')).toBe('GDN-NYN');

    applyFerryDictSnapshot({
      operators: [
        { code: 'VIKING', name: 'Viking Line' },
        { code: 'TALLINK', name: 'Tallink' },
      ],
      ports: [],
      routes: [
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
  });

  it('seed Stena/Polferries bez RPC bez zmian', () => {
    expect(ferryRouteFromDb('GDY-KAA')).toBe('GDY-KAA');
    expect(operatorsForRoute('GDN-NYN')).toEqual(['POLFERRIES']);
    expect(isOutbound('KAA-GDY')).toBe(false);
  });
});
