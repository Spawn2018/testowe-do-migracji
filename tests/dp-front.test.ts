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
import { groupVessels, vesselOperator, VESSELS_FALLBACK } from '../src/lib/vesselGroups';
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
  it('Mapa: „Finlandia · Tallinn A → Helsinki”; brak rejsu — sam statek, bez Gdańsk → Nynäshamn', () => {
    const r = mapRow(ferryLoad(), ctx({ sailingOf: () => ({ id: 's1', vessel: 'Finlandia', route: 'TLLA-HEL' } as never) }));
    expect(r.stageSub).toBe('Finlandia · Tallinn A → Helsinki');
    const bare = mapRow(ferryLoad('Wawel'), ctx());
    expect(bare.stageSub).toBe('Wawel');
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
  });
  it('w kodzie nie ma już podziału kodu po myślniku z domyślnym GDN-NYN', () => {
    for (const f of ['src/lib/p9cMap.ts', 'src/lib/p9eGroups.ts']) {
      expect(readFileSync(f, 'utf8')).not.toMatch(/'GDN-NYN'\)\.split\('-'\)/);
    }
  });
});

describe('DP-3, DP-5 · Harmonogram › Rejsy', () => {
  const panel = readFileSync('src/views/SailingsPanel.tsx', 'utf8');
  it('nieznana trasa oznaczona w wierszu rejsu', () => {
    expect(sv('pl', 'sv_route_unknown')).toBe('nieznana trasa');
    expect(panel).toMatch(/data-route-unknown/);
    expect(panel).toMatch(/routeCell\(r\)/);
  });
  it('ręczny rejs: nieznany kod nie zamienia się w GDN-NYN', () => {
    expect(panel).not.toMatch(/: 'GDN-NYN';/);
    expect(panel).toMatch(/sv_route_unknown_err/);
  });
});

describe('DP-7 · tory promów rysowane w jednym miejscu', () => {
  it('CorridorMap korzysta z drawFerryLanes z mapPool, bez własnej kopii torów', () => {
    const c = readFileSync('src/components/map/CorridorMap.tsx', 'utf8');
    expect(c).toMatch(/drawFerryLanes\(layers\.ferryLeg, new Set\(ferries\.map\(\(f\) => f\.leg\)\)\)/);
    expect(c).not.toMatch(/WATER_TRACKS_EXTRA|WATER_GDN_NYN|WATER_GDY_KAA/);
    const p = readFileSync('src/components/map/mapPool.ts', 'utf8');
    expect(p.match(/drawFerryLanes\(ferryLeg\)/g)?.length).toBe(1);
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
      { op: 'STENA', names: ['Stena Ebba'] },
      { op: 'POLFERRIES', names: ['Wawel'] },
      { op: 'VIKING', names: ['Viking Grace', 'Viking XPRS'] },
      { op: 'ECKERO', names: ['Finlandia'] },
    ]);
    expect(vesselOperator(g, 'Viking Grace')).toBe('VIKING');
  });
  it('zapas: stała lista BN9-b, w panelu bez stałej VESSELS', () => {
    expect(VESSELS_FALLBACK.map((x) => x.op)).toEqual(['POLFERRIES', 'STENA', 'TALLINK', 'VIKING', 'ECKERO', 'DFDS']);
    const panel = readFileSync('src/views/SailingsPanel.tsx', 'utf8');
    expect(panel).not.toMatch(/const VESSELS\b/);
    expect(panel).toMatch(/import\('\.\.\/data\/vesselsServer'\)/);
    expect(panel).toMatch(/VITE_AUTH_MODE === 'supabase' && SUPABASE_AUTH_ENABLED/);
  });
});
