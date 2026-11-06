/**
 * BN8 front `src/lib` (#720): clearance EE 2 h (82-C), clearanceHoursForRoute,
 * altProposal przez CrossingMap, DP-143 GeofenceCountry EE/FI + route kod trasy, DP-144 armator z RPC.
 */
import { describe, expect, it, afterEach } from 'vitest';
import {
  applyFerryDictSnapshot, catalogOperators, clearanceHoursFor, clearanceHoursForRoute,
  isFerryOperator, resetFerryDictRpc,
} from '../src/lib/ferryCatalog';
import { awizacjaOperators, earliestFerryDepartureMsForRoute } from '../src/lib/awizacjaState';
import { altProposal, type FerryRowView } from '../src/lib/p6Route';
import { placeForCountry } from '../src/lib/geofenceDraft';
import { geofenceFromRow, type GeofenceRow } from '../src/data/mappers';
import type { GeofenceCountry, Sailing } from '../src/types';

const NOW = Date.parse('2026-11-03T08:00:00Z');

function S(p: Partial<Sailing> & Pick<Sailing, 'id' | 'route' | 'departureAt' | 'source'>): Sailing {
  return {
    vessel: 'Statek', arrivalAt: p.departureAt, delayedDepartureAt: null, delayedArrivalAt: null,
    status: 'ZAPLANOWANY', operator: null, ...p,
  };
}

function row(p: Partial<FerryRowView> & Pick<FerryRowView, 'line'>): FerryRowView {
  return {
    id: p.id ?? p.line, vessel: p.vessel ?? p.line, depIso: '2026-11-03T12:00:00Z',
    delayedIso: null, status: p.status ?? 'ZAPLANOWANY', sea: p.sea ?? null, onBoard: 0,
    route: p.route, ...p,
  };
}

afterEach(() => resetFerryDictRpc());

describe('BN8 — odprawa EE 2 h (82-C)', () => {
  it('clearanceHoursFor: Polferries 14, Stena 16, armatorzy EE 2', () => {
    expect(clearanceHoursFor('POLFERRIES')).toBe(14);
    expect(clearanceHoursFor('STENA')).toBe(16);
    expect(clearanceHoursFor('TALLINK')).toBe(2);
    expect(clearanceHoursFor('VIKING')).toBe(2);
    expect(clearanceHoursFor('ECKERO')).toBe(2);
    expect(clearanceHoursFor('DFDS')).toBe(2);
  });

  it('clearanceHoursForRoute: port wyjazdowy trasy, nie pierwszy armator', () => {
    expect(clearanceHoursForRoute('GDN-NYN')).toBe(14);
    expect(clearanceHoursForRoute('GDY-KAA')).toBe(16);
    expect(clearanceHoursForRoute('TLL-HEL')).toBe(2);
    expect(clearanceHoursForRoute('TLLA-HEL')).toBe(2);
    expect(clearanceHoursForRoute('MUU-VUO')).toBe(2);
    expect(clearanceHoursForRoute('PLD-KPS')).toBe(2);
    expect(clearanceHoursForRoute(null, 'STENA')).toBe(16);
  });

  it('earliestFerryDepartureMsForRoute liczy od portu trasy', () => {
    const load = {
      plannedLoadDate: '2026-11-04',
      awizacja: {
        loadWindowStart: null, loadWindowEnd: null,
        unloadWindowStart: null, unloadWindowEnd: null, confirmed: false,
      },
    };
    const t0 = Date.parse('2026-11-04T06:00:00+02:00');
    expect(earliestFerryDepartureMsForRoute(load, 'TLL-HEL', 'TALLINK')).toBe(t0 + 2 * 36e5);
    expect(earliestFerryDepartureMsForRoute(load, 'GDN-NYN', 'POLFERRIES')).toBe(t0 + 14 * 36e5);
  });
});

describe('BN8 — altProposal jedna ścieżka (CrossingMap)', () => {
  it('Polferries sztorm → Stena z mapy armatorów', () => {
    const st = S({ id: 'st1', route: 'GDY-KAA', departureAt: '2026-11-03T14:00:00Z', source: 'STENA', operator: 'Stena Line' });
    const alt = altProposal(
      [row({ line: 'POLFERRIES', sea: { risk: 'wysokie', waveM: 4, gustKn: 40, thrWaveM: 3, thrGustKn: 30, at: null } }),
        row({ line: 'STENA', vessel: 'Ebba' })],
      [st],
      NOW,
    );
    expect(alt).toMatchObject({ kind: 'ALT', from: 'POLFERRIES', to: 'STENA' });
    if (alt?.kind === 'ALT') expect(alt.sailings.map((s) => s.id)).toEqual(['st1']);
  });

  it('Tallink odwołany → Eckerö w FI', () => {
    // DP-83: Eckerö na TLLA-HEL (Terminal A), nie na TLL-HEL (Tallink D).
    const ek = S({ id: 'ek1', route: 'TLLA-HEL', departureAt: '2026-11-03T15:00:00Z', source: 'ECKERO', operator: 'Eckerö Line' });
    const alt = altProposal(
      [row({ line: 'TALLINK', status: 'ODWOLANY', route: 'TLL-HEL' }), row({ line: 'ECKERO', route: 'TLLA-HEL' })],
      [ek],
      NOW,
    );
    expect(alt).toMatchObject({ kind: 'ALT', from: 'TALLINK', to: 'ECKERO', dest: 'FI' });
  });
});

describe('BN8 DP-143 — GeofenceCountry EE/FI + route kod trasy', () => {
  it('placeForCountry EE/FI = porty katalogu', () => {
    expect(placeForCountry('EE')).toEqual({ lat: 59.443, lng: 24.77 });
    expect(placeForCountry('FI')).toEqual({ lat: 60.153, lng: 24.915 });
  });

  it('geofenceFromRow zachowuje EE i kod trasy TLL-HEL', () => {
    const r: GeofenceRow = {
      id: 'g1', name: 'Tallinn OUT', kind: 'PORT_OUT', lat: 59.44, lng: 24.77,
      radius_m: 800, hysteresis_m: 100, dwell_seconds: 0, debounce_fixes: 1,
      notify_orgs: [], active: true, notify_enter: true, notify_dwell: false, notify_exit: false,
      country: 'EE', route: 'TLL-HEL',
    };
    const g = geofenceFromRow(r, []);
    expect(g.country).toBe('EE' satisfies GeofenceCountry);
    expect(g.route).toBe('TLL-HEL');
  });
});

describe('BN8 DP-144 — armator tylko w bazie', () => {
  it('isFerryOperator + catalogOperators + awizacjaOperators po snapshocie', () => {
    expect(isFerryOperator('NEWFERRY')).toBe(false);
    applyFerryDictSnapshot({
      operators: [{ code: 'NEWFERRY', name: 'New Ferry Line' }],
      ports: [],
      routes: [{ code: 'AAA-BBB', port_from: 'TLL', port_to: 'HEL', family_key: 'TLL-HEL', operators: ['NEWFERRY'] }],
    });
    expect(isFerryOperator('NEWFERRY')).toBe(true);
    expect(catalogOperators().some((o) => o.code === 'NEWFERRY' && o.name === 'New Ferry Line')).toBe(true);
    expect(awizacjaOperators().some((o) => o.id === 'NEWFERRY' && o.label === 'New Ferry Line')).toBe(true);
  });
});
