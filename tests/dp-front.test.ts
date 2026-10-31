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
import { createVesselsLoader, currentVesselGroups, defaultVessel, groupVessels, LEGACY_VESSEL_ROUTE, routeOfVessel, subscribeVesselGroups, vesselOperator, VESSELS_FALLBACK, VESSELS_WARN } from '../src/lib/vesselGroups';
import { emptyRowsKey, manualRouteError, sailingFocusPlan, sailingLineOptions, showRouteUnknown, vesselSelectKey } from '../src/lib/sailingsForm';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { useVesselGroups } from '../src/lib/useVesselGroups';
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
  /* DP-33: podłączenie w panelu sprawdza render w tests/dp-front-4.jsdom.test.ts (pigułka, komunikat, brak zapisu). */
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
  /* DP-33: rysowanie przez drawFerryLanes — test zachowania w tests/dp-front-4.jsdom.test.ts. */
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
    /* DP-33: panel i paczka demo — test zachowania w tests/dp-front-4.jsdom.test.ts (lista zapasowa, brak loadera w demo). */
  });
});

describe('DP-14 · trasa auta bez rejsu wpisana wprost', () => {
  it('Polferries → GDN-NYN, Stena → GDY-KAA niezależnie od liczby tras armatora w słowniku', () => {
    expect(LEGACY_VESSEL_ROUTE).toEqual({ POLFERRIES: 'GDN-NYN', STENA: 'GDY-KAA' });
    expect(routeOfVessel('Wawel')).toBe('GDN-NYN');
    expect(routeOfVessel('NOVA STAR')).toBe('GDN-NYN');
    expect(routeOfVessel('Stena Spirit')).toBe('GDY-KAA');
    for (const v of ['Viking XPRS', 'Viking Grace', 'Finlandia', 'Sirena Seaways', 'Baltic Queen', 'Megastar']) expect(routeOfVessel(v)).toBeNull();
  });
});

describe('DP-15 · kolejność armatorów listy statków', () => {
  it('wejście w innej kolejności → kolejność katalogu (Polferries, Stena, …)', () => {
    const g = groupVessels([
      { name: 'M/F Finlandia', operator: 'Eckerö Line' },
      { name: 'M/F Viking XPRS', operator: 'Viking Line' },
      { name: 'M/F Stena Ebba', operator: 'Stena Line' },
      { name: 'M/F Wawel', operator: 'Polferries' },
    ]);
    expect(g.map((x) => x.op)).toEqual(['POLFERRIES', 'STENA', 'VIKING', 'ECKERO']);
  });
});

describe('DP-16, DP-17 · jedna pamięć listy statków', () => {
  const groups = [{ op: 'POLFERRIES' as const, names: ['Wawel', 'Galileusz'] }];
  it('jedno pobranie na sesję; mapy widzą listę z bazy', async () => {
    let calls = 0;
    const l = createVesselsLoader(async () => { calls++; return groups; });
    l.reset();
    expect(currentVesselGroups()).toBe(VESSELS_FALLBACK);
    await l.load(); await l.load();
    expect(calls).toBe(1);
    expect(currentVesselGroups()).toEqual(groups);
    /* statek dopisany w bazie (nazwa bez armatora) → trasa armatora */
    expect(routeOfVessel('Galileusz')).toBe('GDN-NYN');
    l.reset();
  });
  it('N7: dwa równoczesne wywołania → jedno pobranie', async () => {
    let calls = 0;
    const l = createVesselsLoader(async () => { calls++; return groups; });
    l.reset();
    await Promise.all([l.load(), l.load()]);
    expect(calls).toBe(1);
    l.reset();
  });
  it('B1/N1 (DP-25, DP-28): zmiana listy powiadamia subskrybentów i podmienia referencję; hook widzi nową listę', async () => {
    let n = 0;
    const off = subscribeVesselGroups(() => { n++; });
    const l = createVesselsLoader(async () => groups);
    l.reset();
    const before = currentVesselGroups();
    expect(currentVesselGroups()).toBe(before); /* stabilny snapshot — bez pętli renderów */
    const Probe = () => createElement('i', null, useVesselGroups().map((g) => g.names.join('+')).join('|'));
    expect(renderToString(createElement(Probe))).not.toContain('Galileusz');
    await l.load();
    expect(n).toBeGreaterThanOrEqual(1);
    expect(currentVesselGroups()).not.toBe(before); /* nowa referencja = zależność efektu mapy i memo tabeli */
    expect(renderToString(createElement(Probe))).toContain('Wawel+Galileusz');
    off();
    l.reset();
    /* mapRow z listą sesji (z bazy) — to, co przelicza memo Mapy i efekt rysowania */
    expect(mapRow(ferryLoad('Galileusz'), ctx({ vessels: groups })).stageSub).toBe('Galileusz · Gdańsk → Nynäshamn');
    expect(mapRow(ferryLoad('Galileusz'), ctx()).stageSub).toBe('Galileusz');
    expect(routeOfVessel('Galileusz', groups)).toBe('GDN-NYN');
  });
  it('DP-27: błąd odczytu listy — jedno ostrzeżenie na sesję', async () => {
    const msgs: string[] = [];
    const l = createVesselsLoader(async () => { throw new Error('x'); }, (m) => { msgs.push(m); });
    l.reset();
    await expect(l.load()).rejects.toThrow('x');
    await expect(l.load()).rejects.toThrow('x');
    await expect(l.load()).rejects.toThrow('x');
    expect(msgs).toEqual([VESSELS_WARN]);
    expect(VESSELS_WARN).not.toMatch(/Error|x$/);
    l.reset();
  });
  it('po błędzie pamięć się czyści i następne wywołanie próbuje ponownie', async () => {
    let calls = 0;
    const l = createVesselsLoader(async () => { calls++; if (calls === 1) throw new Error('x'); return groups; });
    l.reset();
    await expect(l.load()).rejects.toThrow('x');
    expect(currentVesselGroups()).toBe(VESSELS_FALLBACK);
    await expect(l.load()).resolves.toEqual(groups);
    expect(calls).toBe(2);
    l.reset();
  });
});

describe('DP-19 · domyślny statek', () => {
  it('„Wawel” bez względu na wielkość liter, inaczej pierwszy z listy', () => {
    expect(defaultVessel([{ op: 'POLFERRIES', names: ['WAWEL', 'Nova Star'] }])).toBe('WAWEL');
    expect(defaultVessel([{ op: 'STENA', names: ['Stena Ebba'] }])).toBe('Stena Ebba');
    expect(defaultVessel(VESSELS_FALLBACK)).toBe('Wawel');
  });
});

describe('DP-20 · filtr armatora w Rejsach (decyzja 55)', () => {
  it('zawsze 6 armatorów, także bez rejsów — N2: kolejność katalogu (Polferries pierwsze)', () => {
    expect(sailingLineOptions()).toEqual(['POLFERRIES', 'STENA', 'TALLINK', 'VIKING', 'ECKERO', 'DFDS']);
  });
  it('N3: decyzja 55 tylko gdy armator nie ma żadnego rejsu; ukryte filtrem → zwykły komunikat', () => {
    expect(emptyRowsKey('DFDS', false, true, false)).toBe('sv_line_empty');
    expect(sv('pl', 'sv_line_empty')).toMatch(/Brak rejsów tego armatora/);
    expect(emptyRowsKey('DFDS', true, true, false)).toBe('sv_none_future');
    expect(emptyRowsKey('DFDS', true, false, true)).toBe('sv_none');
    expect(emptyRowsKey('ALL', true, true, false)).toBe('sv_none_future');
    expect(emptyRowsKey('ALL', true, false, true)).toBe('sv_none');
  });
  it('N4–N6 (DP-28): filtr zawsze widoczny, wybór statku po pobraniu listy, wejście z promu zeruje filtr', () => {
    expect(sailingLineOptions()).toHaveLength(6);
    expect(vesselSelectKey(VESSELS_FALLBACK, VESSELS_FALLBACK)).toBe('zapas');
    expect(vesselSelectKey([{ op: 'POLFERRIES', names: ['Wawel'] }], VESSELS_FALLBACK)).toBe('baza');
    /* rejs widoczny przy bieżących przełącznikach → tylko filtr na „Wszyscy” i wyróżnienie */
    expect(sailingFocusPlan('s1', ['s1', 's2'], ['s1'])).toEqual({ focusId: 's1', lineSel: 'ALL', showAll: false });
    /* rejs miniony / powrót → pokaż wszystko */
    expect(sailingFocusPlan('s2', ['s1', 's2'], ['s1'])).toEqual({ focusId: 's2', lineSel: 'ALL', showAll: true });
    /* rejsu nie ma w rozkładzie albo brak żądania → nic nie zmieniamy */
    expect(sailingFocusPlan('zz', ['s1'], ['s1'])).toBeNull();
    expect(sailingFocusPlan(null, ['s1'], ['s1'])).toBeNull();
  });
});

describe('DP-6 · jedna funkcja skrótu trasy', () => {
  it('routeShortLabel dla 14 tras: format „TLLA → HEL”; Terminal A po stronie Tallinna w obu kierunkach', async () => {
    const { routeShortLabel } = await import('../src/lib/ferryCatalog');
    expect(Object.fromEntries(['GDN-NYN', 'NYN-GDN', 'GDY-KAA', 'KAA-GDY', 'TLL-HEL', 'HEL-TLL', 'TLLA-HEL', 'HELA-TLL',
      'MUU-VUO', 'VUO-MUU', 'TLL-STO', 'STO-TLL', 'PLD-KPS', 'KPS-PLD'].map((c) => [c, routeShortLabel(c)]))).toEqual({
      'GDN-NYN': 'GDN → NYN', 'NYN-GDN': 'NYN → GDN', 'GDY-KAA': 'GDY → KAA', 'KAA-GDY': 'KAA → GDY',
      'TLL-HEL': 'TLL → HEL', 'HEL-TLL': 'HEL → TLL', 'TLLA-HEL': 'TLLA → HEL', 'HELA-TLL': 'HEL → TLLA',
      'MUU-VUO': 'MUU → VUO', 'VUO-MUU': 'VUO → MUU', 'TLL-STO': 'TLL → STO', 'STO-TLL': 'STO → TLL',
      'PLD-KPS': 'PLD → KPS', 'KPS-PLD': 'KPS → PLD',
    });
    const portName = await import('../src/lib/portName');
    expect('ferryRouteShort' in portName).toBe(false);
  });
});
