/**
 * @vitest-environment jsdom
 * BN9-c4 (#573 „Ekrany po BN6”) — Ryzyka › Drogi: Litwa, Łotwa, Estonia, Finlandia. Sekcje krajów (ten sam wygląd wierszy
 * co Drogi SE), „Brak utrudnień na korytarzu” tylko dla krajów na trasie aktywnego transportu, bez transportów bałtyckich —
 * bez sekcji (jak dotąd), limit masy wyróżniony z dopiskiem, atrybucja z `detail.zrodlo`, regresja Drogi PL/SE, telefon 390 px.
 * Dane wymyślone (G-09).
 */
import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { RoutePanel } from '../src/components/risks/RoutePanel';
import {
  attributionView, balticCountriesOfLoads, balticCountriesOfRoute, balticCountryOf, balticRoadSections, roadInfoFromDetail, withBalticRoad,
} from '../src/lib/bn9c4Roads';
import { isRouteOnly, isTodoRisk, routeRisks } from '../src/lib/todoRules';
import { sampleBalticRoadRisksOf } from '../src/lib/p6Source';
import { todoQueue } from '../src/lib/cockpitE9';
import { textHits } from './e21Rules';
import { BN9C4_EN, I18N_ALL } from '../src/i18n/messages';
import type { Load, Risk, Sailing } from '../src/types';

const NOW = '2026-11-02T10:00:00Z';
const FI_SRC = 'Source: Fintraffic / digitraffic.fi, license CC 4.0 BY';

function risk(p: Partial<Risk> & Pick<Risk, 'id'>): Risk {
  return { type: 'OPS', severity: 'MEDIUM', title: 'x', detail: '', owner: 'HHL', meta: '', nextAction: '', ageHours: 1, ...p } as Risk;
}
function road(id: string, country: 'LT' | 'LV' | 'EE' | 'FI', p: Partial<Risk> = {}, detail: Record<string, unknown> = {}): Risk {
  const base = risk({
    id, kind: `ROAD_${country}`, title: `Trasa ${country}: Roboty`, titleKey: 'rk_road_baltic',
    titleParams: { country, event: `Roboty ${id}` }, detail: `opis ${id}`, ...p,
  });
  return withBalticRoad(base, { kind: `ROAD_${country}`, detail: { zrodlo: FI_SRC, od: '2026-11-01T08:00:00Z', do: '2026-11-05T16:00:00Z', ...detail } });
}
function sailing(id: string, route: string): Sailing {
  return {
    id, vessel: 'Statek', operator: 'X', route, departureAt: '2026-11-02T16:00:00Z', arrivalAt: '2026-11-02T20:00:00Z',
    delayedDepartureAt: null, delayedArrivalAt: null, status: 'ZAPLANOWANY', source: 'TALLINK',
  } as Sailing;
}
function load(id: string, sailingId: string | null, p: Partial<Load> = {}): Load {
  return { id, code: id, sailingId, status: 'IN_TRANSIT_PL', stage: 'TO_PORT', plannedLoadDate: '2026-11-01', ...p } as unknown as Load;
}

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
type PanelProps = Parameters<typeof RoutePanel>[0];
function panel(p: Partial<PanelProps> = {}, width = 1440): HTMLElement {
  return mount(createElement(MemoryRouter, null, createElement(RoutePanel, {
    role: 'HHL', locale: 'pl', phone: false, nowIso: NOW, loads: [], risks: [], sailings: [], marine: [], corridor: null,
    seSituations: [], seDemo: false, showDemoMarks: true, parts: ['ferry', 'roads'], withHead: false, ...p,
  })), width);
}
/** rozwiń sekcje krajów (domyślnie zwinięte) */
function expand(el: HTMLElement): HTMLElement {
  for (const b of [...el.querySelectorAll<HTMLButtonElement>('[data-baltic-toggle]')]) act(() => { b.click(); });
  return el;
}
const panels = (el: HTMLElement) => [...el.querySelectorAll('.rk-route-parts > [data-panel]')].map((s) => s.getAttribute('data-panel'));
const SAILS = [sailing('s-hel', 'TLLA-HEL'), sailing('s-kps', 'PLD-KPS'), sailing('s-sto', 'TLL-STO'), sailing('s-nyn', 'GDN-NYN'), sailing('s-vuo', 'VUO-MUU')];

describe('BN9-c4 — rodzaj i kraje trasy', () => {
  it('kraj po `kind` (LT/LV/EE/FI); ROAD_PL, ROAD_SE i inne → null (w mappers.ts ROAD_FI ma type OPS jak ROAD_PL)', () => {
    expect(['ROAD_LT', 'ROAD_LV', 'ROAD_EE', 'ROAD_FI'].map((k) => balticCountryOf({ kind: k }))).toEqual(['LT', 'LV', 'EE', 'FI']);
    expect(balticCountryOf({ kind: 'ROAD_PL' })).toBeNull();
    expect(balticCountryOf({ kind: 'ROAD_SE' })).toBeNull();
    expect(balticCountryOf({ kind: undefined })).toBeNull();
  });
  it('rodzina trasy: TLL-HEL / MUU-VUO → LT, LV, EE, FI; PLD-KPS i TLL-STO → LT, LV, EE; PL–SE i nieznana → brak', () => {
    expect(balticCountriesOfRoute('TLL-HEL')).toEqual(['LT', 'LV', 'EE', 'FI']);
    expect(balticCountriesOfRoute('TLLA-HEL')).toEqual(['LT', 'LV', 'EE', 'FI']);
    expect(balticCountriesOfRoute('VUO-MUU')).toEqual(['LT', 'LV', 'EE', 'FI']);
    expect(balticCountriesOfRoute('PLD-KPS')).toEqual(['LT', 'LV', 'EE']);
    expect(balticCountriesOfRoute('TLL-STO')).toEqual(['LT', 'LV', 'EE']);
    expect(balticCountriesOfRoute('GDN-NYN')).toEqual([]);
    expect(balticCountriesOfRoute('XXX-YYY')).toEqual([]);
  });
  it('aktywny transport: przed promem — LT/LV/EE (i FI dla Zatoki Fińskiej); po promie — tylko FI; po dostawie i poza oknem — nic', () => {
    const c = (l: Load) => [...balticCountriesOfLoads([l], SAILS, NOW)].sort();
    expect(c(load('a', 's-hel'))).toEqual(['EE', 'FI', 'LT', 'LV']);
    expect(c(load('b', 's-kps'))).toEqual(['EE', 'LT', 'LV']);
    expect(c(load('c', 's-hel', { status: 'ON_FERRY', stage: 'FERRY' } as Partial<Load>))).toEqual(['FI']);
    expect(c(load('d', 's-hel', { status: 'IN_TRANSIT_SE', stage: 'SE_ROAD' } as Partial<Load>))).toEqual(['FI']);
    expect(c(load('e', 's-sto', { status: 'IN_TRANSIT_SE', stage: 'SE_ROAD' } as Partial<Load>))).toEqual([]);
    expect(c(load('f', 's-hel', { status: 'DELIVERED', stage: 'DELIVERED' } as Partial<Load>))).toEqual([]);
    expect(c(load('g', 's-hel', { status: 'PLANNED', stage: 'PLAN', plannedLoadDate: '2026-11-20' } as Partial<Load>))).toEqual([]);
    expect(c(load('h', 's-nyn'))).toEqual([]);
    expect(c(load('i', null))).toEqual([]);
  });
  it('detail BN6 → źródło, od/do, limity (bez interpretacji); inne rodzaje bez pola `road`', () => {
    expect(roadInfoFromDetail({ zrodlo: FI_SRC, od: 'a', do: null, weight_limit_t: 12, lat: 65.1, lon: 25.4 })).toEqual({
      source: FI_SRC, from: 'a', to: null, lat: 65.1, lon: 25.4, weightLimitT: 12, heightLimitM: null, widthLimitM: null,
    });
    const other = withBalticRoad(risk({ id: 'p', kind: 'ROAD_PL' }), { kind: 'ROAD_PL', detail: { zrodlo: 'HERE' } });
    expect(other.road).toBeUndefined();
  });
});

describe('BN9-c4 — Do zrobienia i Sytuacja na trasie', () => {
  it('drogi LT/LV/EE/FI bez transportu są sytuacją na trasie (jak ROAD_PL), nie sprawą do zrobienia; z transportem — sprawa', () => {
    for (const c of ['LT', 'LV', 'EE', 'FI'] as const) {
      const r = road(`r-${c}`, c);
      expect(isRouteOnly(r)).toBe(true);
      expect(isTodoRisk(r)).toBe(false);
      expect(isTodoRisk({ ...r, loadId: 'L1' })).toBe(true);
    }
    const rr = routeRisks([road('fi', 'FI'), road('lt', 'LT'), risk({ id: 'pl', kind: 'ROAD_PL', title: 'A1: roboty' })]);
    expect(rr.roadBaltic.map((r) => r.id)).toEqual(['fi', 'lt']);
    expect(rr.roadPl.map((r) => r.id)).toEqual(['pl']);
  });
});

describe('BN9-c4 — Ryzyka › Drogi: sekcje krajów', () => {
  const loads = [load('L-hel', 's-hel')];
  it('transport TLL-HEL: sekcje LT, LV, EE, FI po Drogi PL i SE; kraj bez ryzyk — „Brak utrudnień na korytarzu.”', () => {
    const el = panel({ loads, sailings: SAILS, risks: [road('fi1', 'FI'), road('lv1', 'LV', {}, { zrodlo: 'Źródło LV' })] });
    expect(panels(el)).toEqual(['ferry', 'marine', 'road-pl', 'road-se', 'road-lt', 'road-lv', 'road-ee', 'road-fi']);
    expect(el.querySelector('[data-panel="road-fi"] h3')!.textContent).toBe('Drogi FI');
    expect(el.querySelector('[data-panel="road-lt"] [data-empty="road-lt"]')!.textContent).toBe('Brak utrudnień na korytarzu.');
    expect(el.querySelector('[data-panel="road-ee"] [data-empty="road-ee"]')).not.toBeNull();
    /* zwinięte domyślnie: sam licznik */
    expect(el.querySelectorAll('[data-baltic-road]').length).toBe(0);
    expect(el.querySelector('[data-panel="road-fi"] [data-baltic-sum]')!.textContent).toBe('Finlandia · 1 utrudnienie · 0 wysokich');
    expand(el);
    expect(el.querySelectorAll('[data-panel="road-fi"] [data-baltic-road]').length).toBe(1);
  });
  it('transport PLD-KPS: LT, LV, EE; FI tylko gdy ma ryzyka (poza trasą — bez „brak utrudnień”)', () => {
    const only = panel({ loads: [load('L-kps', 's-kps')], sailings: SAILS });
    expect(panels(only).filter((p) => /^road-(lt|lv|ee|fi)$/.test(p!))).toEqual(['road-lt', 'road-lv', 'road-ee']);
    act(() => root?.unmount());
    host?.remove();
    const withFi = panel({ loads: [load('L-kps', 's-kps')], sailings: SAILS, risks: [road('fi1', 'FI')] });
    expect(panels(withFi)).toContain('road-fi');
    expect(withFi.querySelector('[data-empty="road-fi"]')).toBeNull();
  });
  it('bez transportów bałtyckich: sekcji bałtyckich nie ma — nawet z ryzykami (wygląd jak dotąd)', () => {
    const el = panel({ loads: [load('L-nyn', 's-nyn')], sailings: SAILS, risks: [road('fi1', 'FI'), road('lt1', 'LT')] });
    expect(panels(el)).toEqual(['ferry', 'marine', 'road-pl', 'road-se']);
    expect(el.querySelector('[data-baltic]')).toBeNull();
  });
  it('wiersz jak Drogi SE: pole kraju, tytuł zdarzenia, wpływ (kolory rk-alert), kiedy; najpierw większy wpływ', () => {
    const el = panel({
      loads, sailings: SAILS,
      risks: [road('a', 'FI', { severity: 'MEDIUM' }), road('b', 'FI', { severity: 'CRITICAL' }), road('c', 'FI', { severity: 'HIGH' })],
    });
    expand(el);
    const rows = [...el.querySelectorAll('[data-panel="road-fi"] [data-baltic-road]')];
    expect(rows.map((r) => r.getAttribute('data-baltic-road'))).toEqual(['b', 'c', 'a']);
    expect(rows[0].querySelector('.rk-box')!.textContent).toBe('FI');
    expect(rows[0].querySelector('.rk-road-t')!.textContent).toBe('Roboty b');
    expect(rows[0].querySelector('.rk-alert')!.className).toContain('is-red');
    expect(rows[1].querySelector('.rk-alert')!.className).toContain('is-amber');
    expect(rows[2].querySelector('.rk-alert')!.className).toContain('is-plain');
    expect(rows[0].querySelector('.rk-road-s')!.textContent).toMatch(/^Bardzo duży wpływ · \d{2}\.\d{2}\.\d{4}, \d{2}:\d{2} – \d{2}\.\d{2}\.\d{4}, \d{2}:\d{2}$/);
    expect(rows[0].querySelector('[data-road-note="baltic"]')!.textContent).toBe('opis b');
  });
  it('limit masy: etykieta „Limit masy”, tytuł z limitem i dopisek „Sprawdź zezwolenie / trasę.”; bez wymyślonej masy ładunku', () => {
    const check = road('w1', 'FI', {
      severity: 'MEDIUM', titleKey: 'rk_road_baltic_weight_check', titleParams: { country: 'FI', event: 'Kelirikko', limit: 12 },
      title: 'Trasa FI: limit masy 12 t — sprawdź zezwolenie / trasę',
    }, { weight_limit_t: 12 });
    const over = road('w2', 'LT', {
      severity: 'HIGH', titleKey: 'rk_road_baltic_weight', titleParams: { country: 'LT', event: 'Most', limit: 40, load: 52.5 },
    }, { weight_limit_t: 40 });
    const plain = road('p1', 'FI');
    const height = road('h1', 'EE', {}, { height_limit_m: 4.2 });
    const el = panel({ loads, sailings: SAILS, risks: [plain, check, over, height] });
    expand(el);
    const w1 = el.querySelector('[data-baltic-road="w1"]') as HTMLElement;
    expect(w1.getAttribute('data-limit')).toBe('WEIGHT');
    expect(w1.querySelector('[data-limit-tag]')!.textContent).toBe('Limit masy 12 t');
    expect(w1.querySelector('.rk-road-t')!.textContent).toBe('Limit masy 12 tKelirikko');
    expect(w1.querySelector('[data-limit-check]')!.textContent).toBe('Sprawdź zezwolenie / trasę.');
    expect(w1.textContent).not.toMatch(/ładunek/i);
    expect(w1.querySelector('[data-road-note="baltic"]')!.textContent).toBe('opis w1');
    /* masa ładunku tylko, gdy przyszła z bazy (params.load) */
    const w2 = el.querySelector('[data-baltic-road="w2"]') as HTMLElement;
    expect(w2.querySelector('[data-limit-tag]')!.textContent).toBe('Limit masy 40 t');
    expect(w2.querySelector('[data-limit-check]')!.textContent).toBe('Ładunek 52,5 t — sprawdź zezwolenie / trasę.');
    /* limit wysokości z detail (bez wartości masy) — etykieta „Limit wysokości 4,2 m” */
    expect(el.querySelector('[data-baltic-road="h1"] [data-limit-tag]')!.textContent).toBe('Limit wysokości 4,2 m');
    /* przy tym samym wpływie limit przed zwykłym zdarzeniem */
    expect([...el.querySelectorAll('[data-panel="road-fi"] [data-baltic-road]')].map((r) => r.getAttribute('data-baltic-road'))).toEqual(['w1', 'p1']);
    expect(el.querySelector('[data-baltic-road="p1"] [data-limit-tag]')).toBeNull();
    expect(readFileSync('src/components/risks/risks.css', 'utf8')).toMatch(/\.rk-limit-tag\{[^}]*color:var\(--amber-ink\)/);
  });
  it('atrybucja pod sekcją z `detail.zrodlo` (bez powtórzeń); bez źródła — bez atrybucji (nic na sztywno)', () => {
    const el = panel({
      loads, sailings: SAILS,
      risks: [road('f1', 'FI'), road('f2', 'FI'), road('l1', 'LV', {}, { zrodlo: 'LVC / transportdata.gov.lv (CC0)' }), road('t1', 'LT', {}, { zrodlo: null })],
    });
    /* zapis z bazy „Source: …, license CC 4.0 BY” → po polsku i „CC BY 4.0” (strażnik E21) */
    expect(el.querySelector('[data-attribution="road-fi"]')!.textContent).toBe('Źródło: Fintraffic / digitraffic.fi, licencja CC BY 4.0');
    expect(attributionView(FI_SRC, 'en')).toBe('Source: Fintraffic / digitraffic.fi, licence CC BY 4.0');
    expect(attributionView('Via Lietuva (eismoinfo.lt)')).toBe('Via Lietuva (eismoinfo.lt)');
    expect(el.querySelector('[data-attribution="road-lv"]')!.textContent).toBe('Dane: LVC / transportdata.gov.lv (CC0)');
    expect(el.querySelector('[data-attribution="road-lt"]')).toBeNull();
    expect(el.querySelector('[data-attribution="road-ee"]')).toBeNull();
    const src = readFileSync('src/components/risks/BalticRoads.tsx', 'utf8');
    expect(src).not.toMatch(/Fintraffic|digitraffic|Lietuva|eismoinfo|transportdata|Tark Tee|tarktee|dangerouslySetInnerHTML/);
  });
  it('ryzyko drogowe bałtyckie przy transporcie nie trafia do sekcji (to sprawa przy transporcie)', () => {
    const el = panel({ loads, sailings: SAILS, risks: [road('x', 'FI', { loadId: 'L-hel' })] });
    expect(el.querySelector('[data-baltic-road="x"]')).toBeNull();
    expect(el.querySelector('[data-empty="road-fi"]')).not.toBeNull();
  });
  it('regresja: Drogi PL i Drogi SE bez zmian (te same teksty i ten sam HTML z transportem bałtyckim i bez)', () => {
    const a = panel({ risks: [risk({ id: 'pl', kind: 'ROAD_PL', title: 'A1: roboty' })] });
    const pl0 = a.querySelector('[data-panel="road-pl"]')!.outerHTML;
    const se0 = a.querySelector('[data-panel="road-se"]')!.outerHTML;
    act(() => root?.unmount());
    host?.remove();
    const b = panel({ loads, sailings: SAILS, risks: [risk({ id: 'pl', kind: 'ROAD_PL', title: 'A1: roboty' }), road('fi1', 'FI')] });
    expect(b.querySelector('[data-panel="road-pl"]')!.outerHTML).toBe(pl0);
    expect(b.querySelector('[data-panel="road-se"]')!.outerHTML).toBe(se0);
    expect(b.querySelector('[data-panel="road-se"] h3')!.textContent).toBe('Drogi SE');
    expect(b.querySelector('[data-panel="road-pl"] h3')!.textContent).toBe('Drogi PL');
  });
  it('demo: przykładowe drogi FI/LT/LV oznaczone, Estonia „brak utrudnień”; źródła z dopiskiem przykładu', () => {
    const el = panel({ balticDemo: true });
    expand(el);
    expect(panels(el).filter((p) => /^road-(lt|lv|ee|fi)$/.test(p!))).toEqual(['road-lt', 'road-lv', 'road-ee', 'road-fi']);
    expect(el.querySelector('[data-panel="road-fi"]')!.getAttribute('data-demo')).toBe('baltic-roads');
    expect(el.querySelector('[data-empty="road-ee"]')).not.toBeNull();
    expect(el.querySelectorAll('[data-panel="road-fi"] [data-baltic-road]').length).toBe(3);
    expect(el.querySelector('[data-panel="road-fi"] [data-limit="WEIGHT"]')).not.toBeNull();
    expect(sampleBalticRoadRisksOf(NOW).every((r) => /przykład/.test(r.road?.source ?? ''))).toBe(true);
  });
  it('telefon 390 px: te same sekcje i wiersze, bez opisu; dopisek limitu zostaje; długie teksty łamią się w CSS', () => {
    const risks = [road('a', 'FI', { titleKey: 'rk_road_baltic_weight_check', titleParams: { country: 'FI', event: 'Kelirikko', limit: 12 } }, { weight_limit_t: 12 }), road('b', 'FI')];
    const el = panel({ phone: true, loads, sailings: SAILS, risks }, 390);
    expand(el);
    expect(panels(el).filter((p) => /^road-/.test(p!))).toEqual(['road-pl', 'road-se', 'road-lt', 'road-lv', 'road-ee', 'road-fi']);
    expect(el.querySelectorAll('[data-panel="road-fi"] [data-baltic-road]').length).toBe(2);
    expect(el.querySelector('[data-road-note="baltic"]')).toBeNull();
    expect(el.querySelector('[data-limit-check]')).not.toBeNull();
    const css = readFileSync('src/components/risks/risks.css', 'utf8');
    expect(css).toContain('[data-baltic] .rk-road-t{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}');
    expect(css).toContain('[data-baltic] .rk-road-n,.rk-road-attr{overflow-wrap:anywhere}');
    expect(readFileSync('src/components/risks/BalticRoads.tsx', 'utf8')).not.toMatch(/style=\{|width:\s*\d/);
  });
  it('produkcja: 146 × ROAD_FI MEDIUM (fińskie tytuły) — zwinięte z licznikiem, 5 pozycji + „Pokaż wszystkie”, LOW zwinięte, wielokropek z pełnym tytułem', () => {
    const many = Array.from({ length: 146 }, (_, i) => road(`m${String(i).padStart(3, '0')}`, 'FI', {
      severity: 'MEDIUM', titleParams: { country: 'FI', event: `Tie 50, eli Kehä III, Vantaa. Tietyö <${i}> & "x"` },
    }));
    const lows = [road('low1', 'FI', { severity: 'LOW' }), road('low2', 'FI', { severity: 'LOW' })];
    const hi = road('hi', 'FI', { severity: 'HIGH' });
    const el = panel({ loads, sailings: SAILS, risks: [...many, ...lows, hi] });
    const sec = el.querySelector('[data-panel="road-fi"]') as HTMLElement;
    expect(sec.getAttribute('data-open')).toBe('0');
    expect(sec.querySelector('[data-baltic-sum]')!.textContent).toBe('Finlandia · 149 utrudnień · 1 wysokie');
    expect(sec.querySelectorAll('[data-baltic-road]').length).toBe(0);
    const t = sec.querySelector('[data-baltic-toggle]') as HTMLButtonElement;
    expect(t.getAttribute('aria-expanded')).toBe('false');
    act(() => { t.click(); });
    expect(t.getAttribute('aria-expanded')).toBe('true');
    const visible = () => [...sec.querySelectorAll('.rk-baltic-list > ul [data-baltic-road]')].map((x) => x.getAttribute('data-baltic-road'));
    expect(visible()).toHaveLength(5);
    expect(visible()[0]).toBe('hi');
    const all = sec.querySelector('[data-baltic-all]') as HTMLButtonElement;
    expect(all.textContent).toBe('Pokaż wszystkie 147');
    act(() => { all.click(); });
    expect(visible()).toHaveLength(147);
    expect(visible()).not.toContain('low1');
    const low = sec.querySelector('details[data-baltic-low]') as HTMLDetailsElement;
    expect(low.open).toBe(false);
    expect(low.querySelector('summary')!.textContent).toBe('2 informacje o niskim wpływie');
    expect(low.querySelectorAll('[data-baltic-road]').length).toBe(2);
    /* pełny tytuł w podpowiedzi; znaki specjalne jako tekst (bez HTML) */
    const t0 = sec.querySelector('[data-baltic-road="m000"] .rk-road-t') as HTMLElement;
    expect(t0.getAttribute('title')).toBe('Tie 50, eli Kehä III, Vantaa. Tietyö <0> & "x"');
    expect(t0.querySelector('*')).toBeNull();
  });
  it('Kokpit i menu: 146 × ROAD_FI bez transportu nie zmienia liczby „Do zrobienia”', () => {
    const base = [risk({ id: 'a', loadId: 'L1', title: 'Brak kierowcy' }), risk({ id: 'b', title: 'Brak polisy' })];
    const many = Array.from({ length: 146 }, (_, i) => road(`m${i}`, 'FI'));
    expect(todoQueue('HHL', [...base, ...many])).toEqual(todoQueue('HHL', base));
    expect(todoQueue('SCX', [...base, ...many])).toEqual(todoQueue('SCX', base));
  });
  it('strażnik tekstów E21: demo (rozwinięte, także niski wpływ) bez trafień — atrybucja „CC BY 4.0”', () => {
    const el = expand(panel({ balticDemo: true }));
    for (const d of [...el.querySelectorAll('details')]) d.open = true;
    const text = [...el.querySelectorAll('[data-baltic]')].map((x) => (x as HTMLElement).textContent).join('\n');
    expect(textHits(text, '/ryzyka')).toEqual([]);
    expect(text).toContain('licencja CC BY 4.0');
  });
  it('sekcje z modułu: bez krajów na trasie → pusta lista', () => {
    expect(balticRoadSections([road('f', 'FI')], new Set())).toEqual([]);
  });
});

describe('BN9-c4 — teksty', () => {
  it('klucze PL w słowniku; EN (BN9C4_EN) z tymi samymi kluczami, bez polskich liter, niepodpięte (8A)', () => {
    const pl = Object.keys(I18N_ALL.pl).filter((k) => k.startsWith('bn9c4_')).sort();
    expect(pl.length).toBeGreaterThan(10);
    expect(Object.keys(BN9C4_EN).sort()).toEqual(pl);
    for (const v of Object.values(BN9C4_EN)) expect(/[ąćęłńóśźż]/i.test(v), v).toBe(false);
    expect(Object.keys(I18N_ALL.en).some((k) => k.startsWith('bn9c4_'))).toBe(false);
  });
});
