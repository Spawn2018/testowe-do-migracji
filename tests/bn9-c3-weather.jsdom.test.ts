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
  FMI_ICE_CHART_URL, MARINE_CORRIDOR_ORDER, cockpitCrossings, corridorOfRoute, isNoReading, marineCrossings,
} from '../src/lib/bn9c3Marine';
import { MarineSection } from '../src/components/risks/MarineSection';
import { RoutePanel } from '../src/components/risks/RoutePanel';
import { MarineCards } from '../src/components/dash/MarineCards';
import { Cockpit } from '../src/components/dash/Cockpit';
import { ferryRowsFromDb } from '../src/lib/p6Route';
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
const onSailing = (sailingId: string) => ({ sailingId }) as Pick<Load, 'sailingId'>;

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
  it('bez danych (błąd odczytu): pięć wierszy „Brak odczytu” i domyślna atrybucja', () => {
    const el = mount(createElement(MarineSection, { locale: 'pl', marine: [], demo: false }));
    expect(el.querySelectorAll('[data-noread]').length).toBe(5);
    expect(el.querySelector('[data-attribution="marine"]')?.textContent).toBe('Dane: FMI / DMI / SMHI (CC BY 4.0)');
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
    const list = cockpitCrossings([onSailing('s-tll'), onSailing('s-tll'), onSailing('s-sto'), onSailing('s-gdn'), onSailing('brak')], sails, marine);
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
    const list = cockpitCrossings([onSailing('s-pld')], sails, [start('BALTIC_PLD_KPS')]);
    expect(list).toHaveLength(1);
    const el = mount(createElement(MarineCards, { locale: 'pl', crossings: list, onGo: () => {} }));
    expect(el.querySelector('.v')?.textContent).toBe('—');
    expect(el.querySelector('.d .ck-desk')?.textContent).toBe('brak odczytu · 1 transport');
  });
  it('regresja: bez transportów bałtyckich (tylko Gdańsk – Nynäshamn / Gdynia – Karlskrona albo bez rejsu) — brak kart, Kokpit jak dotąd', () => {
    expect(cockpitCrossings([onSailing('s-gdn'), onSailing('s-gdy'), { sailingId: null }], sails, marine)).toEqual([]);
    expect(cockpitCrossings([], sails, marine)).toEqual([]);
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
    const list = cockpitCrossings([onSailing('s-sto')], sails, marine);
    const el = mount(createElement(Cockpit, {
      locale: 'pl', role: 'HHL', org: 'H&H Logistics', kind: 'Administrator', date: '02.11.2026', tiles: [], onGo: () => {},
      extra: createElement(MarineCards, { locale: 'pl', crossings: list, onGo: () => { went += 1; } }),
    }));
    const card = el.querySelector('[data-cockpit] [data-ck-sea] [data-ck-sea-row="BALTIC_TLL_STO"]') as HTMLButtonElement;
    act(() => card.click());
    expect(went).toBe(1);
    const src = readFileSync('src/views/DashboardView.tsx', 'utf8');
    expect(src).toContain('cockpitCrossings(mapLoads, sailings, marineRows)');
    expect(src).toMatch(/extra=\{seaCrossings\.length \?/);
  });
  it('telefon 390 px: krótka nazwa i krótki opis w kartach; nazwy i wartości łamią się (bez poziomego przewijania)', () => {
    const list = cockpitCrossings([onSailing('s-tll'), onSailing('s-sto')], sails, marine);
    const el = mount(createElement(MarineCards, { locale: 'pl', crossings: list, onGo: () => {} }), 390);
    const fi = el.querySelector('[data-ck-sea-row="BALTIC_GULF_FI"]')!;
    expect(fi.querySelector('.k .ck-phone')?.textContent).toBe('Zatoka Fińska');
    expect(fi.querySelector('.d .ck-phone')?.textContent).toBe('22 kn · niskie');
    const css = readFileSync('src/index.css', 'utf8');
    expect(css).toContain('.ck-sea-card .k{overflow-wrap:anywhere}');
    expect(css).toContain('.ck-sea-card .v{white-space:normal}');
  });
});

describe('BN9-c3 — teksty', () => {
  it('klucze PL w słowniku; EN (BN9C3_EN) z tymi samymi kluczami, bez polskich liter, niepodpięte (8A)', () => {
    const pl = Object.keys(I18N_ALL.pl).filter((k) => k.startsWith('bn9c3_')).sort();
    expect(Object.keys(BN9C3_EN).sort()).toEqual(pl);
    for (const v of Object.values(BN9C3_EN)) expect(/[ąćęłńóśźż]/i.test(v), v).toBe(false);
    expect(Object.keys(I18N_ALL.en).some((k) => k.startsWith('bn9c3_'))).toBe(false);
  });
});
