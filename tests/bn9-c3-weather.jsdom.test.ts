/**
 * @vitest-environment jsdom
 * BN9-c3 (#573 „Ekrany po BN5”) — pogoda morska dla przepraw bałtyckich: Ryzyka › Pogoda na przeprawach (pięć przepraw,
 * sortowanie po ryzyku, „Brak odczytu”, atrybucja, dopisek NAVTEX, link do mapy lodowej FMI) i Kokpit (karty przepraw
 * aktywnych transportów; bez transportów bałtyckich — jak dotąd). Dane wymyślone (G-09).
 */
import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import type { MarineConditionRow, MarineCorridorCode } from '../src/lib/marineWeatherDb';
import {
  FMI_ICE_CHART_URL, MARINE_CORRIDOR_ORDER, cockpitCrossings, corridorOfRoute, crossingAhead, isNoReading, marineCrossings, nearestFerrySeaRow,
} from '../src/lib/bn9c3Marine';
import { MarineSection } from '../src/components/risks/MarineSection';
import { RoutePanel } from '../src/components/risks/RoutePanel';
import { MarineCards } from '../src/components/dash/MarineCards';
import { Cockpit } from '../src/components/dash/Cockpit';
import { altProposal, ferryAlert, ferryRowsFromDb } from '../src/lib/p6Route';
import { rt } from '../src/i18n/p6';
import { sampleMarineOf } from '../src/lib/p6Source';
import { BN9C3_EN, I18N_ALL } from '../src/i18n/messages';
import type { Load, Sailing } from '../src/types';

const NOW = '2026-11-02T10:00:00Z';
const NAMES: Record<MarineCorridorCode, string> = {
  BALTIC_GDN_NYN: 'Gdańsk – Nynäshamn',
  BALTIC_GDY_KAA: 'Gdynia – Karlskrona',
  BALTIC_GULF_FI: 'Tallinn / Muuga – Helsinki / Vuosaari (Zatoka Fińska)',
  BALTIC_PLD_KPS: 'Paldiski – Kapellskär',
  BALTIC_TLL_STO: 'Tallinn – Sztokholm',
};

function m(corridor: MarineCorridorCode, p: Partial<MarineConditionRow> = {}): MarineConditionRow {
  return {
    corridor, maxWaveM: 1.2, maxGustKn: 22, risk: 'niskie', waveThrM: 3.8, gustThrKn: 40, sources: 'FMI WAM · FMI HARMONIE',
    attribution: 'Dane: FMI / DMI / SMHI (CC BY 4.0)', observedAt: '2026-11-02T09:00:00Z', windowFrom: null, windowTo: null, ...p,
  };
}
/** wiersz startowy migracji 0375: bez fali, porywów i źródeł (observed_at = chwila wstawienia) */
const start = (c: MarineCorridorCode) => m(c, { maxWaveM: null, maxGustKn: null, sources: '', risk: 'niskie', observedAt: '2026-11-01T23:30:00Z' });

function sailing(id: string, route: Sailing['route'], p: Partial<Sailing> = {}): Sailing {
  return {
    id, vessel: 'Statek', operator: 'X', route, departureAt: '2026-11-02T16:00:00Z', arrivalAt: '2026-11-02T20:00:00Z',
    delayedDepartureAt: null, delayedArrivalAt: null, status: 'ZAPLANOWANY', source: 'TALLINK', ...p,
  } as Sailing;
}
const onSailing = (sailingId: string, p: Partial<Load> = {}) => ({ sailingId, status: 'PLANNED', stage: 'PLAN', ...p }) as Pick<Load, 'sailingId' | 'status' | 'stage'>;
const NOW_MS = Date.parse(NOW);

let root: Root | null = null;
let host: HTMLDivElement | null = null;
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});
function mount(el: ReturnType<typeof createElement>, width = 1440): HTMLElement {
  host = document.createElement('div');
  host.style.width = `${width}px`;
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => { root!.render(el); });
  return host;
}
const rowNames = (el: HTMLElement) => [...el.querySelectorAll('[data-marine-row] [data-marine-name]')].map((b) => b.textContent);
const rowCodes = (el: HTMLElement) => [...el.querySelectorAll('[data-marine-row]')].map((li) => li.getAttribute('data-marine-row'));

describe('BN9-c3 — korytarz pogody z rodziny trasy rejsu', () => {
  it('trasy obu kierunków, Terminal A → właściwy korytarz; nieznana trasa → null (nigdy domyślny Gdańsk – Nynäshamn)', () => {
    expect(corridorOfRoute('GDN-NYN')).toBe('BALTIC_GDN_NYN');
    expect(corridorOfRoute('NYN-GDN')).toBe('BALTIC_GDN_NYN');
    expect(corridorOfRoute('KAA-GDY')).toBe('BALTIC_GDY_KAA');
    expect(corridorOfRoute('TLL-HEL')).toBe('BALTIC_GULF_FI');
    expect(corridorOfRoute('TLLA-HEL')).toBe('BALTIC_GULF_FI');
    expect(corridorOfRoute('HELA-TLL')).toBe('BALTIC_GULF_FI');
    expect(corridorOfRoute('VUO-MUU')).toBe('BALTIC_GULF_FI');
    expect(corridorOfRoute('KPS-PLD')).toBe('BALTIC_PLD_KPS');
    expect(corridorOfRoute('STO-TLL')).toBe('BALTIC_TLL_STO');
    expect(corridorOfRoute('XXX-YYY')).toBeNull();
    expect(corridorOfRoute(null)).toBeNull();
  });
  it('„brak odczytu”: brak wiersza, puste observed_at, wiersz startowy; odczyt z samymi porywami to odczyt', () => {
    expect(isNoReading(null)).toBe(true);
    expect(isNoReading(m('BALTIC_GULF_FI', { observedAt: '' }))).toBe(true);
    expect(isNoReading(start('BALTIC_GULF_FI'))).toBe(true);
    expect(isNoReading(m('BALTIC_GULF_FI', { maxWaveM: null }))).toBe(false);
  });
});

describe('BN9-c3 — Ryzyka › Pogoda na przeprawach', () => {
  it('pięć przepraw z nazwami po polsku portami; wszystkie niskie — stała kolejność', () => {
    const el = mount(createElement(MarineSection, { locale: 'pl', marine: MARINE_CORRIDOR_ORDER.map((c) => m(c)), demo: false }));
    expect(rowNames(el)).toEqual(MARINE_CORRIDOR_ORDER.map((c) => NAMES[c]));
    const li = el.querySelector('[data-marine-row="BALTIC_GULF_FI"]')!;
    expect(li.textContent).toContain('Ryzyko niskie');
    expect(li.textContent).toContain('fala maks. 1,2 m · porywy maks. 22 kn');
    expect(li.textContent).toContain('źródła: FMI WAM · FMI HARMONIE');
    expect(li.querySelector('.rk-alert')?.className).toBe('rk-alert is-go');
    expect(el.querySelector('.rk-sec-sub')?.textContent).toBe('progi alarmu: fala 3,8 m, porywy 40 kn');
  });
  it('sortowanie: najpierw wysokie, potem podwyższone, potem reszta w stałej kolejności; te same kolory co wiersze promów', () => {
    const marine = [
      m('BALTIC_GDN_NYN'), m('BALTIC_GDY_KAA', { risk: 'podwyższone', maxWaveM: 2.9 }), m('BALTIC_GULF_FI'),
      m('BALTIC_PLD_KPS', { risk: 'wysokie', maxWaveM: 4.1, maxGustKn: 44 }), m('BALTIC_TLL_STO', { risk: 'podwyższone' }),
    ];
    expect(marineCrossings(marine).map((v) => v.corridor)).toEqual(['BALTIC_PLD_KPS', 'BALTIC_GDY_KAA', 'BALTIC_TLL_STO', 'BALTIC_GDN_NYN', 'BALTIC_GULF_FI']);
    const el = mount(createElement(MarineSection, { locale: 'pl', marine, demo: false }));
    expect(rowCodes(el)).toEqual(['BALTIC_PLD_KPS', 'BALTIC_GDY_KAA', 'BALTIC_TLL_STO', 'BALTIC_GDN_NYN', 'BALTIC_GULF_FI']);
    const top = el.querySelector('[data-marine-row="BALTIC_PLD_KPS"]')!;
    expect(top.getAttribute('data-risk')).toBe('wysokie');
    expect(top.querySelector('.rk-alert')?.className).toBe('rk-alert is-red');
    expect(top.textContent).toContain('Ryzyko wysokie · fala maks. 4,1 m · porywy maks. 44 kn');
    expect(el.querySelector('[data-marine-row="BALTIC_GDY_KAA"] .rk-alert')?.className).toBe('rk-alert is-amber');
  });
  it('„Brak odczytu”: wiersz startowy, puste observed_at i brak wiersza — bez fali, porywów i czasu; na końcu listy', () => {
    const marine = [m('BALTIC_GDN_NYN', { risk: 'podwyższone' }), m('BALTIC_GDY_KAA', { observedAt: '' }), start('BALTIC_GULF_FI'), m('BALTIC_TLL_STO')];
    const el = mount(createElement(MarineSection, { locale: 'pl', marine, demo: false }));
    expect(rowCodes(el)).toEqual(['BALTIC_GDN_NYN', 'BALTIC_GDY_KAA', 'BALTIC_GULF_FI', 'BALTIC_PLD_KPS', 'BALTIC_TLL_STO']);
    for (const c of ['BALTIC_GDY_KAA', 'BALTIC_GULF_FI', 'BALTIC_PLD_KPS']) {
      const li = el.querySelector(`[data-marine-row="${c}"]`)!;
      expect(li.getAttribute('data-risk')).toBe('none');
      expect(li.querySelector('[data-noread]')?.textContent).toBe('Brak odczytu');
      expect(li.querySelector('[data-marine-meta]')).toBeNull();
      expect(li.textContent).not.toMatch(/fala|Ryzyko/);
    }
    /* czas odczytu sekcji tylko z przepraw z odczytem — wiersz startowy (23:30) nie udaje pomiaru */
    expect(el.querySelector('[data-attribution="marine"]')?.textContent).toMatch(/^Dane: FMI \/ DMI \/ SMHI \(CC BY 4\.0\) · odczyt 02\.11\.2026, 10:00$/);
  });
  it('bez danych (błąd odczytu): pięć wierszy „Brak odczytu”, bez atrybucji FMI/DMI/SMHI (nie podpisujemy danych, których nie ma)', () => {
    const el = mount(createElement(MarineSection, { locale: 'pl', marine: [], demo: false }));
    expect(el.querySelectorAll('[data-noread]').length).toBe(5);
    expect(el.querySelector('[data-attribution]')).toBeNull();
    expect(el.textContent).not.toContain('FMI / DMI / SMHI');
    /* dopisek NAVTEX i link mapy lodowej zostają */
    expect(el.querySelector('[data-sea-disclaimer]')).not.toBeNull();
  });
  it('fala albo porywy null przy odczycie: „—” bez jednostki', () => {
    const el = mount(createElement(MarineSection, { locale: 'pl', marine: [m('BALTIC_GULF_FI', { maxWaveM: null, maxGustKn: 18 })], demo: false }));
    const li = el.querySelector('[data-marine-row="BALTIC_GULF_FI"]')!;
    expect(li.textContent).toContain('fala maks. — · porywy maks. 18 kn');
    expect(li.textContent).not.toContain('— m');
  });
  it('atrybucja, dopisek NAVTEX i link „Mapa lodowa FMI” (nowa karta, rel noopener noreferrer, bez osadzania)', () => {
    const el = mount(createElement(MarineSection, { locale: 'pl', marine: [m('BALTIC_GDN_NYN')], demo: false }));
    expect(el.querySelector('[data-sea-disclaimer]')?.textContent)
      .toBe('Informacja pomocnicza — nie zastępuje decyzji armatora i kapitana ani komunikatów NAVTEX.');
    const a = el.querySelector('a[data-ice-chart]') as HTMLAnchorElement;
    expect(a.textContent).toBe('Mapa lodowa FMI');
    expect(a.getAttribute('href')).toBe(FMI_ICE_CHART_URL);
    expect(FMI_ICE_CHART_URL).toBe('https://cdn.fmi.fi/marine-observations/products/ice-charts/latest-full-color-ice-chart.pdf');
    expect(a.getAttribute('target')).toBe('_blank');
    expect(a.getAttribute('rel')).toBe('noopener noreferrer');
    expect(el.querySelector('iframe, embed, object')).toBeNull();
  });
  it('demo: Ryzyka › Sytuacja na trasie pokazuje pięć przepraw z przykładu (oznaczone), dawnej atrybucji pod promami brak', () => {
    const el = mount(createElement(MemoryRouter, null, createElement(RoutePanel, {
      role: 'HHL', locale: 'pl', phone: false, nowIso: NOW, loads: [], risks: [], sailings: [], marine: [], corridor: null,
      seSituations: [], seDemo: false, showDemoMarks: true,
    })));
    const sec = el.querySelector('[data-panel="marine"]') as HTMLElement;
    expect(sec.getAttribute('data-demo')).toBe('marine');
    expect(rowNames(sec).sort()).toEqual(Object.values(NAMES).sort());
    expect(sampleMarineOf(NOW).every((r) => r.sources.endsWith('(przykład)'))).toBe(true);
    expect(el.querySelector('[data-panel="ferry"] [data-attribution]')).toBeNull();
    expect(el.querySelectorAll('[data-attribution="marine"]').length).toBe(1);
  });
  it('telefon 390 px: te same wiersze (nazwy, ryzyko, źródła); długie nazwy i źródła łamią się w CSS', () => {
    const el = mount(createElement(MemoryRouter, null, createElement(RoutePanel, {
      role: 'HHL', locale: 'pl', phone: true, nowIso: NOW, loads: [], risks: [], sailings: [], marine: [], corridor: null,
      seSituations: [], seDemo: false, showDemoMarks: true, parts: ['ferry', 'roads'], withHead: false,
    })), 390);
    const sec = el.querySelector('[data-panel="marine"]') as HTMLElement;
    expect(sec.querySelectorAll('[data-marine-row]').length).toBe(5);
    expect(sec.querySelectorAll('[data-marine-meta]').length).toBe(5);
    const css = readFileSync('src/components/risks/risks.css', 'utf8');
    expect(css).toMatch(/\.rk-marine \.rk-ferry-tx b,\.rk-sea-meta\{overflow-wrap:anywhere\}/);
    expect(readFileSync('src/components/risks/MarineSection.tsx', 'utf8')).not.toMatch(/style=\{|width:\s*\d|dangerouslySetInnerHTML/);
  });
  it('wiersz promu armatora bałtyckiego bierze pogodę korytarza trasy rejsu; wiersz startowy — bez pomiaru; PL–SE bez zmian', () => {
    const nowMs = Date.parse(NOW);
    const sails = [
      sailing('tl', 'TLL-STO', { operator: 'Tallink Silja', source: 'TALLINK' }),
      sailing('df', 'PLD-KPS', { operator: 'DFDS', source: 'DFDS', vessel: 'Finbo' }),
      sailing('pf', 'GDN-NYN', { operator: 'Polferries', source: 'POLFERRIES', vessel: 'Nova Star' }),
    ];
    const marine = [m('BALTIC_TLL_STO', { risk: 'podwyższone', maxWaveM: 2.6 }), start('BALTIC_PLD_KPS'), m('BALTIC_GDN_NYN', { maxWaveM: 1.0 })];
    const rows = ferryRowsFromDb(sails, marine, [], nowMs);
    const by = (id: string) => rows.find((r) => r.id === id)!;
    expect(by('tl').sea).toMatchObject({ risk: 'podwyższone', waveM: 2.6 });
    expect(by('df').sea).toBeNull();
    expect(by('pf').sea).toMatchObject({ waveM: 1.0 });
  });
});

describe('BN9-c3 — Kokpit: pogoda na przeprawach aktywnych transportów', () => {
  const sails = [sailing('s-gdn', 'GDN-NYN'), sailing('s-gdy', 'GDY-KAA'), sailing('s-tll', 'TLLA-HEL'), sailing('s-sto', 'TLL-STO'), sailing('s-pld', 'PLD-KPS')];
  const marine = MARINE_CORRIDOR_ORDER.map((c) => (c === 'BALTIC_TLL_STO' ? m(c, { risk: 'wysokie', maxWaveM: 4.2, maxGustKn: 45 }) : m(c)));

  it('tylko przeprawy, którymi jadą aktywne transporty (rodzina trasy z rejsu), z liczbą transportów; ryzyko wyżej', () => {
    const list = cockpitCrossings([onSailing('s-tll'), onSailing('s-tll'), onSailing('s-sto'), onSailing('s-gdn'), onSailing('brak')], sails, marine, NOW_MS);
    expect(list.map((c) => [c.corridor, c.loads])).toEqual([['BALTIC_TLL_STO', 1], ['BALTIC_GDN_NYN', 1], ['BALTIC_GULF_FI', 2]]);
    const el = mount(createElement(MarineCards, { locale: 'pl', crossings: list, onGo: () => {} }));
    const cards = [...el.querySelectorAll('[data-ck-sea-row]')];
    expect(cards.map((c) => c.getAttribute('data-ck-sea-row'))).toEqual(['BALTIC_TLL_STO', 'BALTIC_GDN_NYN', 'BALTIC_GULF_FI']);
    expect(cards.every((c) => c.classList.contains('kpi') && c.classList.contains('ck-tile'))).toBe(true);
    expect(cards[0].querySelector('.k .ck-desk')?.textContent).toBe('Tallinn – Sztokholm');
    expect(cards[0].querySelector('.v')?.className).toBe('v alert');
    expect(cards[0].querySelector('.v')?.textContent).toBe('4,2 mfala maks.');
    expect(cards[0].querySelector('.d .ck-desk')?.textContent).toBe('porywy maks. 45 kn · ryzyko wysokie · odczyt 02.11.2026, 10:00 · 1 transport');
    expect(cards[2].querySelector('.k .ck-desk')?.textContent).toBe(NAMES.BALTIC_GULF_FI);
    expect(cards[2].querySelector('.d .ck-desk')?.textContent).toContain('· 2 transporty');
    expect(el.querySelector('[data-attribution="marine-cockpit"]')?.textContent).toContain('Dane: FMI / DMI / SMHI (CC BY 4.0) · Informacja pomocnicza');
  });
  it('przeprawa bez odczytu (wiersz startowy): „—” i „brak odczytu”', () => {
    const list = cockpitCrossings([onSailing('s-pld')], sails, [start('BALTIC_PLD_KPS')], NOW_MS);
    expect(list).toHaveLength(1);
    const el = mount(createElement(MarineCards, { locale: 'pl', crossings: list, onGo: () => {} }));
    expect(el.querySelector('.v')?.textContent).toBe('—');
    expect(el.querySelector('.d .ck-desk')?.textContent).toBe('brak odczytu · 1 transport');
  });
  it('regresja: bez transportów bałtyckich (tylko Gdańsk – Nynäshamn / Gdynia – Karlskrona albo bez rejsu) — brak kart, Kokpit jak dotąd', () => {
    expect(cockpitCrossings([onSailing('s-gdn'), onSailing('s-gdy'), onSailing('', { sailingId: null })], sails, marine, NOW_MS)).toEqual([]);
    expect(cockpitCrossings([], sails, marine, NOW_MS)).toEqual([]);
    const el = mount(createElement(Cockpit, {
      locale: 'pl', role: 'SCX', org: 'Scandinavian Express', kind: 'Dyspozytor', date: '02.11.2026',
      tiles: [{ id: 'ferry', label: 'Najbliższy prom', labelShort: 'Najbliższy prom', go: 'risk', value: '—', of: null, desc: 'x', descShort: 'x', tone: 'default' }],
      onGo: () => {}, extra: null,
    }));
    expect(el.querySelector('[data-ck-sea]')).toBeNull();
    expect(el.querySelectorAll('.ck-grid').length).toBe(1);
    expect(el.querySelectorAll('[data-ck]').length).toBe(1);
  });
  it('Kokpit z transportem bałtyckim: karty pod kafelkami w tej samej ramce, klik prowadzi do Ryzyk', () => {
    let went = 0;
    const list = cockpitCrossings([onSailing('s-sto')], sails, marine, NOW_MS);
    const el = mount(createElement(Cockpit, {
      locale: 'pl', role: 'HHL', org: 'H&H Logistics', kind: 'Administrator', date: '02.11.2026', tiles: [], onGo: () => {},
      extra: createElement(MarineCards, { locale: 'pl', crossings: list, onGo: () => { went += 1; } }),
    }));
    const card = el.querySelector('[data-cockpit] [data-ck-sea] [data-ck-sea-row="BALTIC_TLL_STO"]') as HTMLButtonElement;
    act(() => card.click());
    expect(went).toBe(1);
    const src = readFileSync('src/views/DashboardView.tsx', 'utf8');
    expect(src).toContain('cockpitCrossings(mapLoads, sailings, marineRows, mapNowMin * 60_000)');
    expect(src).toMatch(/extra=\{seaCrossings\.length \?/);
  });
  it('telefon 390 px: krótka nazwa i krótki opis w kartach; nazwy i wartości łamią się (bez poziomego przewijania)', () => {
    const list = cockpitCrossings([onSailing('s-tll'), onSailing('s-sto')], sails, marine, NOW_MS);
    const el = mount(createElement(MarineCards, { locale: 'pl', crossings: list, onGo: () => {} }), 390);
    const fi = el.querySelector('[data-ck-sea-row="BALTIC_GULF_FI"]')!;
    expect(fi.querySelector('.k .ck-phone')?.textContent).toBe('Zatoka Fińska');
    expect(fi.querySelector('.d .ck-phone')?.textContent).toBe('22 kn · niskie');
    const css = readFileSync('src/index.css', 'utf8');
    expect(css).toContain('.ck-sea-card .k{overflow-wrap:anywhere}');
    expect(css).toContain('.ck-sea-card .v{white-space:normal}');
  });
});

describe('BN9-c3 — Kokpit: tylko transporty z przeprawą przed sobą', () => {
  const ended = sailing('s-hel-old', 'TLL-HEL', { departureAt: '2026-11-02T05:00:00Z', arrivalAt: '2026-11-02T08:00:00Z', status: 'DOPLYNAL' });
  const open = sailing('s-hel', 'TLL-HEL');
  const late = sailing('s-hel-late', 'TLL-HEL', { departureAt: '2026-11-02T06:00:00Z', arrivalAt: '2026-11-02T09:00:00Z', delayedArrivalAt: '2026-11-02T11:00:00Z' });
  const sails = [ended, open, late];
  const marine = [m('BALTIC_GULF_FI')];

  it('naczepa po zjeździe z promu TLL-HEL (rejs dopłynął, drogi SE) nie jest liczona — brak kart', () => {
    const offFerry = onSailing('s-hel-old', { status: 'IN_TRANSIT_SE', stage: 'SE' as Load['stage'] });
    expect(crossingAhead(offFerry, ended, NOW_MS)).toBe(false);
    expect(cockpitCrossings([offFerry], sails, marine, NOW_MS)).toEqual([]);
    /* rejs bez „Dopłynął”, ale planowe przypłynięcie minęło — też za sobą */
    const pastNoFlag = sailing('s-hel-past', 'TLL-HEL', { arrivalAt: '2026-11-02T08:00:00Z' });
    expect(cockpitCrossings([onSailing('s-hel-past', { status: 'IN_TRANSIT_SE', stage: 'SE' as Load['stage'] })], [pastNoFlag], marine, NOW_MS)).toEqual([]);
  });
  it('liczone: rejs trwa (przypłynięcie po „teraz”, także opóźnione), albo transport przed promem lub na promie', () => {
    const list = cockpitCrossings([
      onSailing('s-hel', { status: 'IN_TRANSIT_PL', stage: 'PL' as Load['stage'] }),
      onSailing('s-hel-late', { status: 'IN_TRANSIT_SE', stage: 'SE' as Load['stage'] }),
      onSailing('s-hel-old', { status: 'ON_FERRY', stage: 'FERRY' as Load['stage'] }),
      onSailing('s-hel-old', { status: 'IN_TRANSIT_SE', stage: 'SE' as Load['stage'] }),
    ], sails, marine, NOW_MS);
    expect(list.map((c) => [c.corridor, c.loads])).toEqual([['BALTIC_GULF_FI', 3]]);
  });
  it('bez wierszy pogody (błąd odczytu): karta „brak odczytu”, sam dopisek NAVTEX bez atrybucji FMI/DMI/SMHI', () => {
    const list = cockpitCrossings([onSailing('s-hel')], sails, [], NOW_MS);
    const el = mount(createElement(MarineCards, { locale: 'pl', crossings: list, onGo: () => {} }));
    expect(el.querySelector('.d .ck-desk')?.textContent).toBe('brak odczytu · 1 transport');
    expect(el.querySelector('[data-attribution="marine-cockpit"]')?.textContent)
      .toBe('Informacja pomocnicza — nie zastępuje decyzji armatora i kapitana ani komunikatów NAVTEX.');
  });
  it('karta bez ramki u góry (bez podwójnej linii pod kafelkami)', () => {
    expect(readFileSync('src/index.css', 'utf8')).not.toMatch(/\.ck-sea\{border-top/);
  });
});

describe('BN9-c3 — kafelek „Najbliższy prom”: Gdańsk – Nynäshamn z listy wielu korytarzy', () => {
  it('bierze BALTIC_GDN_NYN, pomija wiersz startowy i wiersz bez fali; wiersza bałtyckiego nigdy', () => {
    const gdn = m('BALTIC_GDN_NYN', { maxWaveM: 1.0, risk: 'niskie' });
    const sto = m('BALTIC_TLL_STO', { maxWaveM: 4.2, risk: 'wysokie' });
    expect(nearestFerrySeaRow([sto, m('BALTIC_GULF_FI'), gdn])).toBe(gdn);
    expect(nearestFerrySeaRow([sto, start('BALTIC_GDN_NYN')])).toBeNull();
    expect(nearestFerrySeaRow([sto, m('BALTIC_GDN_NYN', { maxWaveM: null })])).toBeNull();
    expect(nearestFerrySeaRow([sto, m('BALTIC_GULF_FI')])).toBeNull();
    expect(nearestFerrySeaRow([])).toBeNull();
    expect(readFileSync('src/views/DashboardView.tsx', 'utf8')).toContain('const row = nearestFerrySeaRow(rows);');
  });
});

describe('BN9-c3 — sztorm na przeprawach bałtyckich: „Możliwe odwołanie” i druga przeprawa (decyzja koordynatora, zasada BN3)', () => {
  const nowMs = Date.parse(NOW);
  const tl = sailing('tl', 'TLL-STO', { operator: 'Tallink Silja', source: 'TALLINK', vessel: 'Baltic Queen' });
  const df = sailing('df', 'PLD-KPS', { operator: 'DFDS', source: 'DFDS', vessel: 'Finbo Cargo', departureAt: '2026-11-02T18:00:00Z', arrivalAt: '2026-11-03T04:00:00Z' });

  it('sztorm na Tallinn – Sztokholm: wiersz Tallink TLL-STO „Możliwe odwołanie”; druga przeprawa DFDS (Paldiski – Kapellskär) bez sztormu', () => {
    const rows = ferryRowsFromDb([tl, df], [m('BALTIC_TLL_STO', { risk: 'wysokie', maxWaveM: 4.3 }), m('BALTIC_PLD_KPS')], [], nowMs);
    const row = rows.find((r) => r.id === 'tl')!;
    expect(ferryAlert(row)).toBe('STORM');
    expect(rt('pl', 'p6_ferry_STORM')).toBe('Możliwe odwołanie');
    expect(ferryAlert(rows.find((r) => r.id === 'df')!)).toBe('OK');
    const alt = altProposal(rows, [tl, df], nowMs);
    expect(alt).toMatchObject({ kind: 'ALT', from: 'TALLINK', to: 'DFDS', reason: 'STORM', dest: 'SE' });
    expect(alt && 'sailings' in alt ? alt.sailings.map((s) => s.id) : []).toEqual(['df']);
  });
  it('sztorm także na Paldiski – Kapellskär: bez propozycji (oba kierunki do Szwecji zagrożone)', () => {
    const rows = ferryRowsFromDb([tl, df], [m('BALTIC_TLL_STO', { risk: 'wysokie' }), m('BALTIC_PLD_KPS', { risk: 'wysokie' })], [], nowMs);
    expect(altProposal(rows, [tl, df], nowMs)).toEqual({ kind: 'BOTH', dest: 'SE' });
  });
  it('sztorm na Zatoce Fińskiej: wszyscy armatorzy do Finlandii „Możliwe odwołanie” → BOTH, jak dziś', () => {
    const sails = [
      sailing('fi-tl', 'TLL-HEL', { operator: 'Tallink Silja', source: 'TALLINK' }),
      sailing('fi-vk', 'TLLA-HEL', { operator: 'Viking Line', source: 'VIKING', departureAt: '2026-11-02T16:30:00Z' }),
      sailing('fi-ek', 'MUU-VUO', { operator: 'Eckerö Line', source: 'ECKERO', departureAt: '2026-11-02T17:00:00Z' }),
    ];
    const rows = ferryRowsFromDb(sails, [m('BALTIC_GULF_FI', { risk: 'wysokie', maxWaveM: 4.0 })], [], nowMs);
    expect(rows.map((r) => [r.line, ferryAlert(r)]).sort()).toEqual([['ECKERO', 'STORM'], ['TALLINK', 'STORM'], ['VIKING', 'STORM']]);
    expect(altProposal(rows, sails, nowMs)).toEqual({ kind: 'BOTH', dest: 'FI' });
  });
  it('regresja: Polferries i Stena bez zmian — pogoda bałtycka nie zmienia ich wierszy ani propozycji', () => {
    const pf = sailing('pf', 'GDN-NYN', { operator: 'Polferries', source: 'POLFERRIES', vessel: 'Nova Star' });
    const st = sailing('st', 'GDY-KAA', { operator: 'Stena Line', source: 'STENA', vessel: 'Stena Ebba', departureAt: '2026-11-02T18:00:00Z' });
    const legacy = [m('BALTIC_GDN_NYN', { risk: 'wysokie', maxWaveM: 4.0 }), m('BALTIC_GDY_KAA')];
    const base = ferryRowsFromDb([pf, st], legacy, [], nowMs);
    const withBaltic = ferryRowsFromDb([pf, st], [...legacy, m('BALTIC_TLL_STO', { risk: 'wysokie' }), m('BALTIC_GULF_FI', { risk: 'wysokie' })], [], nowMs);
    expect(withBaltic).toEqual(base);
    expect(base.map((r) => [r.line, ferryAlert(r)])).toEqual([['POLFERRIES', 'STORM'], ['STENA', 'OK']]);
    const alt = altProposal(base, [pf, st], nowMs);
    expect(alt).toMatchObject({ kind: 'ALT', from: 'POLFERRIES', to: 'STENA', reason: 'STORM' });
    expect(alt && 'dest' in alt ? alt.dest : undefined).toBeUndefined();
    /* przy sztormie u Polferries i bałtyckim — propozycja PL–SE ma pierwszeństwo, jak dotąd */
    const mixed = ferryRowsFromDb([pf, st, tl], [...legacy, m('BALTIC_TLL_STO', { risk: 'wysokie' })], [], nowMs);
    expect(altProposal(mixed, [pf, st, tl], nowMs)).toMatchObject({ kind: 'ALT', from: 'POLFERRIES', to: 'STENA' });
  });
});

describe('BN9-c3 — Ryzyka KSH na komputerze: sekcja pogody nie przesuwa „Drogi SE”', () => {
  it('KSH: sekcja w części promów, w siatce na pełną szerokość na końcu; na telefonie w kolejności dokumentu', () => {
    const el = mount(createElement(MemoryRouter, null, createElement(RoutePanel, {
      role: 'KSH', locale: 'pl', phone: false, nowIso: NOW, loads: [], risks: [], sailings: [], marine: [], corridor: null,
      seSituations: [], seDemo: false, showDemoMarks: true, parts: ['ferry', 'roads'], withHead: false,
    })));
    const panels = [...el.querySelectorAll('.rk-route-parts > [data-panel]')].map((s) => s.getAttribute('data-panel'));
    /* DP-189: 4 sekcje bałtyckie zawsze (jak SE), także bez transportów bałtyckich */
    expect(panels).toEqual(['ferry', 'marine', 'road-pl', 'road-se', 'road-lt', 'road-lv', 'road-ee', 'road-fi']);
    const css = readFileSync('src/components/risks/risks.css', 'utf8');
    expect(css).toContain('.rk-ksh .rk-route-parts>[data-panel="marine"]{grid-column:1 / -1;order:1}');
    expect(css).toMatch(/@media \(max-width: 768px\)\{[\s\S]*\.rk-ksh \.rk-route-parts>\[data-panel="marine"\]\{order:0\}/);
  });
});

describe('BN9-c3 — teksty', () => {
  it('klucze PL w słowniku; EN (BN9C3_EN) z tymi samymi kluczami, bez polskich liter, niepodpięte (8A)', () => {
    const pl = Object.keys(I18N_ALL.pl).filter((k) => k.startsWith('bn9c3_')).sort();
    expect(Object.keys(BN9C3_EN).sort()).toEqual(pl);
    for (const v of Object.values(BN9C3_EN)) expect(/[ąćęłńóśźż]/i.test(v), v).toBe(false);
    expect(Object.keys(I18N_ALL.en).some((k) => k.startsWith('bn9c3_'))).toBe(false);
    /* nieużywany po przeniesieniu atrybucji */
    expect(readFileSync('src/i18n/p6.ts', 'utf8')).not.toContain('p6_sea_attr');
  });
});
