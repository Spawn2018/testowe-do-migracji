/**
 * DP-3, DP-4, DP-5, DP-7, DP-8 (rejestr drobnych poprawek, zgłoszenie #671; źródła F7 #649 i F7 #670).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { mapRow, type RowCtx } from '../src/lib/p9cMap';
import { groupView } from '../src/lib/p9eGroups';
import { p9m, p9mp } from '../src/i18n/p9c';
import { p9e, p9ep } from '../src/i18n/p9e';
import { sv } from '../src/i18n/sail7';
import { ferryRouteEnds } from '../src/lib/portName';
import { groupVessels, routeOfVessel, vesselOperator, VESSELS_FALLBACK } from '../src/lib/vesselGroups';
import { manualRouteError, showRouteUnknown } from '../src/lib/sailingsForm';
import { ferryLaneLines, HERE_FERRY_LEGS } from '../src/lib/map/ferryLanes';
import { WATER_TRACKS_EXTRA } from '../src/lib/map/ferryLines';
import { WATER_GDN_NYN } from '../src/lib/map/draw';
import type { Load } from '../src/types';

const NOW = '2026-10-09T22:30:00Z';
const tx: RowCtx['tx'] = (k, p) => (p ? p9mp('pl', k, p) : p9m('pl', k));
const ctx = (over: Partial<RowCtx> = {}): RowCtx => ({
  role: 'HHL', nowIso: NOW, prod: true, hasFix: () => true, sailingOf: () => undefined, tx, ...over,
});
const ferryLoad = (vessel: string | null = null) => ({
  id: 'x', code: 'SG-13', itemType: 'SG', qty: 1, stage: 'FERRY', status: 'ON_FERRY', progress: 0.5, sailingId: 's1',
  plannedLoadDate: '2026-10-07', plannedDeliverDate: '2026-10-09', carrierId: 'scx',
  resources: { driverName: 'A', tractorPlate: 'X', trailerPlate: 'Y' },
  ferry: { vessel, departureAt: null, arrivalAt: null, bookingRef: null, status: 'NONE' },
  etaBoden: null, silentMinutes: null, delayed: false, etaDetail: { lastFixAt: '2026-10-09T22:14:00Z' },
} as unknown as Load);

describe('DP-4 · porty ze słownika tras zamiast dzielenia kodu', () => {
  it('Terminal A i trasy bałtyckie pełnymi nazwami', () => {
    expect(ferryRouteEnds('pl', 'TLLA-HEL')).toEqual({ a: 'Tallinn A', b: 'Helsinki' });
    expect(ferryRouteEnds('pl', 'GDN-NYN')).toEqual({ a: 'Gdańsk', b: 'Nynäshamn' });
    expect(ferryRouteEnds('pl', null)).toBeNull();
  });
  it('Mapa: „Finlandia · Tallinn A → Helsinki”; bez rejsu — trasa z armatora statku albo sam statek', () => {
    const r = mapRow(ferryLoad(), ctx({ sailingOf: () => ({ id: 's1', vessel: 'Finlandia', route: 'TLLA-HEL' } as never) }));
    expect(r.stageSub).toBe('Finlandia · Tallinn A → Helsinki');
    expect(mapRow(ferryLoad('Wawel'), ctx()).stageSub).toBe('Wawel · Gdańsk → Nynäshamn');
    expect(mapRow(ferryLoad('Baltic Queen'), ctx()).stageSub).toBe('Baltic Queen');
    const unk = mapRow(ferryLoad(), ctx({ sailingOf: () => ({ id: 's1', vessel: 'X', route: 'ZZZ-QQQ' } as never) }));
    expect(unk.stageSub).toBe('X · ZZZ-QQQ');
  });
  it('dymek promu: trasa bałtycka i nieznana trasa bez podmiany', () => {
    const t = (k: string, p?: Record<string, string | number>) => (p ? p9ep('pl', k, p) : p9e('pl', k));
    const base = {
      nowIso: '2026-10-08T20:30:00Z', row: () => null, tx: t, hm: () => '22:10', dt: () => '08.10, 18:00',
    };
    const g = { kind: 'ferry', key: 'ferry:s', ferryKey: 's', ids: [], lat: 0, lng: 0, ais: 'ok', at: null, vessel: 'Finlandia', late: false } as never;
    expect(groupView(g, { ...base, ferryInfo: () => ({ vessel: 'Finlandia', route: 'TLLA-HEL', departureAt: '2026-10-08T16:00:00Z' }) } as never).sub)
      .toBe('Tallinn A → Helsinki · wypłynął 08.10, 18:00');
    expect(groupView(g, { ...base, ferryInfo: () => ({ vessel: 'X', route: 'ZZZ-QQQ', departureAt: '2026-10-08T22:00:00Z' }) } as never).sub)
      .toBe('ZZZ-QQQ · odpływa 08.10, 18:00');
    expect(groupView(g, { ...base, ferryInfo: () => ({ vessel: 'X', route: null, departureAt: null }) } as never).sub).toBeNull();
    /* B2: bez trasy — sam czas, bez „ · ” na początku */
    expect(groupView(g, { ...base, ferryInfo: () => ({ vessel: 'X', route: null, departureAt: '2026-10-08T22:00:00Z' }) } as never).sub)
      .toBe('odpływa 08.10, 18:00');
    expect(groupView(g, { ...base, ferryInfo: () => ({ vessel: 'X', route: null, departureAt: '2026-10-08T16:00:00Z' }) } as never).sub)
      .toBe('wypłynął 08.10, 18:00');
  });
  it('w kodzie nie ma już podziału kodu po myślniku z domyślnym GDN-NYN', () => {
    for (const f of ['src/lib/p9cMap.ts', 'src/lib/p9eGroups.ts']) {
      expect(readFileSync(f, 'utf8')).not.toMatch(/'GDN-NYN'\)\.split\('-'\)/);
    }
  });
});

describe('DP-3, DP-5 · Harmonogram › Rejsy (U1–U3)', () => {
  it('U3: znacznik „nieznana trasa” według flagi routeUnknown, także gdy kod rozkłada się na porty', () => {
    expect(sv('pl', 'sv_route_unknown')).toBe('nieznana trasa');
    expect(showRouteUnknown({ routeUnknown: true })).toBe(true);
    expect(showRouteUnknown({})).toBe(false);
    expect(showRouteUnknown({ routeUnknown: false })).toBe(false);
  });
  it('U2: ręczny rejs — tylko trasa ze słownika; GDN-KAA i śmieci nie zapisują się', () => {
    for (const ok of ['GDN-NYN', 'GDY-KAA', 'TLL-HEL', 'TLLA-HEL', 'HELA-TLL']) expect(manualRouteError(ok)).toBeNull();
    for (const bad of ['GDN-KAA', 'ZZZ-QQQ', '']) expect(manualRouteError(bad)).toBe('sv_route_unknown_err');
    expect(sv('pl', 'sv_route_unknown_err')).toBe('Nieznana trasa — wybierz trasę z listy');
  });
  it('panel używa tych reguł (pigułka i komunikat błędu w formularzu)', () => {
    const panel = readFileSync('src/views/SailingsPanel.tsx', 'utf8');
    expect(panel).toMatch(/showRouteUnknown\(r\.sailing\)/);
    expect(panel).toMatch(/manualRouteError\(route\)/);
    expect(panel).toMatch(/data-sail-error/);
  });
});

describe('DP-7 · tory promów z jednego źródła', () => {
  const extra = Object.keys(WATER_TRACKS_EXTRA).length;
  it('bez HERE: 2 stałe tory + wszystkie tory bałtyckie, w kolejności [lat, lng]', () => {
    const lines = ferryLaneLines();
    expect(lines).toHaveLength(2 + extra);
    expect(lines[0][0]).toEqual([WATER_GDN_NYN[0][1], WATER_GDN_NYN[0][0]]);
  });
  it('skipLegs: przeprawy narysowane z HERE nie rysują się drugi raz, tory bałtyckie zostają', () => {
    expect(ferryLaneLines(new Set(['FERRY-GDN-NYN']))).toHaveLength(1 + extra);
    expect(ferryLaneLines(new Set(HERE_FERRY_LEGS))).toHaveLength(extra);
  });
  it('mapPool i CorridorMap rysują przez drawFerryLanes', () => {
    const c = readFileSync('src/components/map/CorridorMap.tsx', 'utf8');
    expect(c).toMatch(/drawFerryLanes\(layers\.ferryLeg, new Set\(ferries\.map\(\(f\) => f\.leg\)\)\)/);
    expect(c).not.toMatch(/WATER_TRACKS_EXTRA|WATER_GDN_NYN|WATER_GDY_KAA/);
    expect(readFileSync('src/components/map/mapPool.ts', 'utf8').match(/drawFerryLanes\(ferryLeg\)/g)?.length).toBe(1);
  });
});

describe('DP-4 · trasa auta na promie bez rejsu', () => {
  it('tylko Polferries i Stena (B1); wielkość liter bez znaczenia (U7)', () => {
    expect(routeOfVessel('Nova Star')).toBe('GDN-NYN');
    expect(routeOfVessel('M/F Stena Spirit')).toBe('GDY-KAA');
    expect(routeOfVessel('Wawel')).toBe('GDN-NYN');
    expect(routeOfVessel('Stena Ebba')).toBe('GDY-KAA');
    /* B1: nowi armatorzy — bez zgadywania terminala i trasy */
    for (const v of ['Viking XPRS', 'Viking Grace', 'Finlandia', 'Sirena Seaways', 'Baltic Queen', 'Megastar']) expect(routeOfVessel(v)).toBeNull();
    /* U7: wielkość liter i „M/F” */
    expect(routeOfVessel('NOVA STAR')).toBe('GDN-NYN');
    expect(routeOfVessel('M/F wawel')).toBe('GDN-NYN');
    expect(routeOfVessel('Nieznany')).toBeNull();
    expect(routeOfVessel(null)).toBeNull();
  });
});

describe('DP-8 · statki z tabeli vessels', () => {
  it('grupy armatorów z nazw w bazie (bez „M/F”), nowy statek pojawia się sam', () => {
    const g = groupVessels([
      { name: 'M/F Wawel', operator: 'POLSCA Baltic Ferries (Polferries)' },
      { name: 'M/F Stena Ebba', operator: 'Stena Line' },
      { name: 'M/F Viking Grace', operator: 'Viking Line' },
      { name: 'M/F Viking XPRS', operator: 'Viking Line' },
      { name: 'M/F Finlandia', operator: 'Eckerö Line' },
      { name: 'M/F Bez Armatora', operator: null },
    ]);
    expect(g).toEqual([
      { op: 'POLFERRIES', names: ['Wawel'] },
      { op: 'STENA', names: ['Stena Ebba'] },
      { op: 'VIKING', names: ['Viking Grace', 'Viking XPRS'] },
      { op: 'ECKERO', names: ['Finlandia'] },
    ]);
    expect(vesselOperator(g, 'Viking Grace')).toBe('VIKING');
    expect(vesselOperator(g, 'VIKING GRACE')).toBe('VIKING');
  });
  it('zapas: stała lista BN9-b, w panelu bez stałej VESSELS', () => {
    expect(VESSELS_FALLBACK.map((x) => x.op)).toEqual(['POLFERRIES', 'STENA', 'TALLINK', 'VIKING', 'ECKERO', 'DFDS']);
    const panel = readFileSync('src/views/SailingsPanel.tsx', 'utf8');
    expect(panel).not.toMatch(/const VESSELS\b/);
    expect(panel).toMatch(/import\('\.\.\/data\/vesselsServer'\)/);
    expect(panel).toMatch(/VITE_AUTH_MODE === 'supabase' && SUPABASE_AUTH_ENABLED/);
  });
});
