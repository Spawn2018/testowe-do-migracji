/**
 * BN3 pkt 7–8 — winter-navigation v2 + port-call v2 cancelled + DP-11 (operatorsForRoute: baza przed seedem).
 * Etap: BN3 / #573 decyzja 61.
 */
import { afterEach, describe, expect, it } from 'vitest';
import {
  applyFerryDictSnapshot, operatorsForRoute, resetFerryDictRpc,
} from '../src/lib/ferryCatalog';
import {
  isWinterNavWindowActive, parseWinterNavigationLocations, portCallV2CancelledHasFihel,
  winterNavRiskDedup,
} from '../supabase/functions/_shared/ferry/winterNavigation';

afterEach(() => {
  resetFerryDictRpc();
});

describe('BN3 winter-nav / MMSI / DP-11', () => {
  it('DP-11: operatorsForRoute — RPC przed seedem (TLL-HEL tylko TALLINK z bazy)', () => {
    expect(operatorsForRoute('TLL-HEL')).toEqual(['TALLINK', 'VIKING', 'ECKERO']);
    applyFerryDictSnapshot({
      operators: [{ code: 'TALLINK', name: 'Tallink' }],
      ports: [],
      routes: [{
        code: 'TLL-HEL',
        port_from: 'TLL',
        port_to: 'HEL',
        family_key: 'TLL-HEL',
        operators: ['TALLINK'],
      }],
    });
    expect(operatorsForRoute('TLL-HEL')).toEqual(['TALLINK']);
    expect(operatorsForRoute('GDN-NYN')).toEqual(['POLFERRIES']);
  });

  it('isWinterNavWindowActive: start/end względem now', () => {
    const now = Date.parse('2026-02-10T12:00:00Z');
    expect(isWinterNavWindowActive('2026-02-01T00:00:00Z', '2026-02-20T00:00:00Z', now)).toBe(true);
    expect(isWinterNavWindowActive('2026-02-15T00:00:00Z', '2026-02-20T00:00:00Z', now)).toBe(false);
    expect(isWinterNavWindowActive('2026-01-01T00:00:00Z', '2026-02-01T00:00:00Z', now)).toBe(false);
    expect(isWinterNavWindowActive('2026-02-01T00:00:00Z', null, now)).toBe(true);
  });

  it('parseWinterNavigationLocations: aktywne ograniczenie FIHEL → hit; przeszłe pominięte', () => {
    const json = {
      type: 'FeatureCollection',
      lastUpdated: '2026-02-10T10:00:00Z',
      features: [{
        type: 'Feature',
        properties: {
          name: 'HELSINKI',
          locodeList: 'FIHEL',
          restrictions: [
            {
              startTime: '2026-02-01T00:00:00Z',
              endTime: '2026-02-20T00:00:00Z',
              textCompilation: 'I 2000',
            },
            {
              startTime: '2026-01-01T00:00:00Z',
              endTime: '2026-01-15T00:00:00Z',
              textCompilation: 'II 2000',
            },
          ],
          suspensions: [{
            startTime: '2026-02-09T00:00:00Z',
            endTime: '2026-02-11T00:00:00Z',
            textCompilation: 'ice class required',
          }],
        },
      }, {
        type: 'Feature',
        properties: {
          name: 'BOHUS',
          locodeList: 'SEBOH',
          restrictions: [{
            startTime: '2026-02-01T00:00:00Z',
            endTime: '2026-03-01T00:00:00Z',
            textCompilation: 'I 2000',
          }],
        },
      }],
    };
    const parsed = parseWinterNavigationLocations(json, '2026-02-10T12:00:00Z');
    expect(parsed.hits).toHaveLength(2);
    expect(parsed.hits.map((h) => h.kind).sort()).toEqual(['RESTRICTION', 'SUSPENSION']);
    expect(parsed.hits.every((h) => h.locode === 'FIHEL')).toBe(true);
    expect(winterNavRiskDedup(parsed.hits[0]!)).toMatch(/^FERRY_WINTER:FIHEL:/);
  });

  it('parseWinterNavigationLocations: brak FeatureCollection → ostrzeżenie struktury', () => {
    const parsed = parseWinterNavigationLocations(null, '2026-02-10T12:00:00Z');
    expect(parsed.hits).toEqual([]);
    expect(parsed.warnings.some((w) => /struktura/i.test(w))).toBe(true);
  });

  it('portCallV2CancelledHasFihel: {} → brak; niepusta lista → hasFihel', () => {
    expect(portCallV2CancelledHasFihel({})).toEqual({ hasFihel: false, count: 0, warnings: [] });
    const withVisits = portCallV2CancelledHasFihel({ visits: [{ id: 1 }, { id: 2 }] });
    expect(withVisits.hasFihel).toBe(true);
    expect(withVisits.count).toBe(2);
  });
});
