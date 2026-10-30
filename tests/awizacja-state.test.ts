import { describe, expect, it, vi } from 'vitest';
import {
  awizacjaOperators,
  earliestFerryDepartureMs,
  hasAwizacja,
  historicalSailingsAllowed,
  isBeforePlannedLoad,
  PORT_CLEARANCE_H,
  reachableSailings,
} from '../src/lib/awizacjaState';
import { historicalSailings } from '../src/lib/sailings';
import { pt } from '../src/i18n/p7';
import type { Load, Sailing } from '../src/types';

const emptyRes = {
  driverName: null, driverPhone: null, tractorPlate: null, trailerPlate: null,
  escort: false, escortPlate: null, setLengthM: null, setWidthM: null, setHeightM: null, setWeightT: null,
};

function load(partial: Partial<Load> & { id: string }): Load {
  return {
    code: partial.id,
    itemType: 'X',
    dims: { lengthM: 1, widthM: 1, heightM: 1, weightT: 1 },
    qty: 1,
    status: 'PLANNED',
    stage: 'PLAN',
    progress: 0,
    plannedLoadDate: '2026-10-02',
    plannedDeliverDate: '2026-10-05',
    carrierId: 'c',
    resources: { ...emptyRes },
    awizacja: { loadWindowStart: null, loadWindowEnd: null, unloadWindowStart: null, unloadWindowEnd: null, confirmed: false },
    ferry: { vessel: null, departureAt: null, arrivalAt: null, bookingRef: null, status: 'NONE' },
    pricing: {} as Load['pricing'],
    etaSegments: [],
    etaBoden: null,
    etaConfidence: 'MED',
    etaEarliestHours: 0,
    etaLatestHours: 0,
    etaReasons: [],
    etaMethod: 'x',
    etaUpdatedAt: '',
    lat: 0, lng: 0, heading: 0, silentMinutes: null,
    sequenceOrder: 1, sequenceRisk: false, delayed: false, docMissing: false, permitFits: null,
    ...partial,
  };
}

describe('hasAwizacja', () => {
  it('false when empty', () => {
    expect(hasAwizacja(load({ id: 'a' }))).toBe(false);
  });
  it('true when driver + tractor', () => {
    expect(hasAwizacja(load({
      id: 'a',
      resources: { ...emptyRes, driverName: 'Jan', tractorPlate: 'ABC123' },
    }))).toBe(true);
  });
  it('true when sailing assigned', () => {
    expect(hasAwizacja(load({ id: 'a', sailingId: 's1' }))).toBe(true);
  });
});

describe('reachableSailings', () => {
  const now = '2026-10-01T10:00:00.000Z';
  const sail = (id: string, dep: string): Sailing => ({
    id, vessel: 'Wawel', route: 'GDN-NYN',
    departureAt: dep, arrivalAt: '2026-10-04T12:00:00.000Z',
    delayedDepartureAt: null, delayedArrivalAt: null,
    status: 'ZAPLANOWANY', source: 'DANE_STARTOWE',
  });

  it('#666 decyzja 51: pokazuje też rejsy przed odprawą (oznaczenie w UI)', () => {
    const l = load({
      id: 'a',
      plannedLoadDate: '2026-10-02',
      awizacja: {
        loadWindowStart: '2026-10-02T06:00:00+02:00',
        loadWindowEnd: '2026-10-02T14:00:00+02:00',
        unloadWindowStart: null, unloadWindowEnd: null, confirmed: false,
      },
    });
    const min = earliestFerryDepartureMs(l);
    expect(min).toBe(Date.parse('2026-10-02T14:00:00+02:00') + PORT_CLEARANCE_H * 36e5);

    const early = sail('early', new Date(min - 36e5).toISOString());
    const ok = sail('ok', new Date(min + 36e5).toISOString());
    const ids = reachableSailings([early, ok], l, now).map((s) => s.id);
    expect(ids).toEqual(['early', 'ok']);
  });

  it('keeps current sailing even if early', () => {
    const l = load({ id: 'a', sailingId: 'early', plannedLoadDate: '2026-10-02' });
    const early = sail('early', '2026-10-02T12:00:00.000Z');
    expect(reachableSailings([early], l, now).map((s) => s.id)).toEqual(['early']);
  });

  it('#666: załadunek za 3 tyg. / 20.11 — Stena i Tallink (nie tylko Baltic Queen)', () => {
    const nowIso = '2026-10-30T12:00:00.000Z';
    const l = load({ id: 'late', plannedLoadDate: '2026-11-20', sailingId: null });
    const all: Sailing[] = [
      { id: 'st1', vessel: 'M/F Stena Ebba', route: 'GDY-KAA', departureAt: '2026-11-21T18:00:00.000Z', arrivalAt: '2026-11-22T08:00:00.000Z', delayedDepartureAt: null, delayedArrivalAt: null, status: 'ZAPLANOWANY', source: 'STENA' },
      { id: 'tl1', vessel: 'M/F MyStar', route: 'TLL-HEL', departureAt: '2026-11-21T05:30:00.000Z', arrivalAt: '2026-11-21T07:30:00.000Z', delayedDepartureAt: null, delayedArrivalAt: null, status: 'ZAPLANOWANY', source: 'TALLINK' },
      { id: 'bq1', vessel: 'M/F Baltic Queen', route: 'TLL-STO', departureAt: '2026-11-05T16:00:00.000Z', arrivalAt: '2026-11-06T08:00:00.000Z', delayedDepartureAt: null, delayedArrivalAt: null, status: 'ZAPLANOWANY', source: 'TALLINK' },
      { id: 'past', vessel: 'M/F Wawel', route: 'GDN-NYN', departureAt: '2026-10-20T16:00:00.000Z', arrivalAt: '2026-10-21T10:00:00.000Z', delayedDepartureAt: null, delayedArrivalAt: null, status: 'ZAPLANOWANY', source: 'POLFERRIES' },
    ];
    expect(reachableSailings(all, l, nowIso, 'STENA').map((s) => s.id)).toEqual(['st1']);
    expect(reachableSailings(all, l, nowIso, 'TALLINK').map((s) => s.id).sort()).toEqual(['bq1', 'tl1']);
    expect(isBeforePlannedLoad(all[2]!, l, 'TALLINK')).toBe(true);
    expect(isBeforePlannedLoad(all[0]!, l, 'STENA')).toBe(false);
  });
});

describe('#666 decyzja 52/55 — historyczne Polferries i komunikaty', () => {
  const nowIso = '2026-10-30T12:00:00.000Z';
  const pastPf: Sailing = {
    id: 'pf-past', vessel: 'M/F Wawel', route: 'GDN-NYN',
    departureAt: '2026-10-28T16:00:00.000Z', arrivalAt: '2026-10-29T10:00:00.000Z',
    delayedDepartureAt: null, delayedArrivalAt: null, status: 'ZAPLANOWANY', source: 'POLFERRIES',
  };
  it('historicalSailings obejmuje Polferries (grupa tylko HHL_ADMIN w UI)', () => {
    expect(historicalSailings([pastPf], nowIso, 'POLFERRIES').map((s) => s.id)).toEqual(['pf-past']);
  });
  it('F7 #668 N4: historicalSailingsAllowed — HHL_ADMIN tak, OPS/SCX nie; demo null', () => {
    expect(historicalSailingsAllowed('HHL_ADMIN')).toBe(true);
    expect(historicalSailingsAllowed('HHL_OPS')).toBe(false);
    expect(historicalSailingsAllowed('SCX')).toBe(false);
    expect(historicalSailingsAllowed('KSH')).toBe(false);
    // gałąź demo: accountRole == null przy auth ≠ supabase
    vi.stubEnv('VITE_AUTH_MODE', 'demo');
    expect(historicalSailingsAllowed(null)).toBe(true);
    vi.stubEnv('VITE_AUTH_MODE', 'supabase');
    expect(historicalSailingsAllowed(null)).toBe(false);
    vi.unstubAllEnvs();
  });
  it('decyzja 55: zawsze 6 armatorów; tekst pustej listy w słowniku', () => {
    expect(awizacjaOperators([]).map((o) => o.id)).toEqual([
      'POLFERRIES', 'STENA', 'TALLINK', 'VIKING', 'ECKERO', 'DFDS',
    ]);
    expect(pt('pl', 'p7_m_sailing_empty')).toMatch(/Brak rejsów w rozkładzie/);
    expect(pt('pl', 'p7_m_sailing_before_load')).toBe('przed planowanym załadunkiem');
    expect(pt('pl', 'p7_m_sailing_hist')).toMatch(/tylko Administrator HHL/);
  });
});
