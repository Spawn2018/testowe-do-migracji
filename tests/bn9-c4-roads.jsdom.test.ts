/**
 * @vitest-environment jsdom
 * BN9-c4 (#573 „Ekrany po BN6”) — Ryzyka › Drogi: Litwa, Łotwa, Estonia, Finlandia. Sekcje krajów (ten sam wygląd wierszy
 * co Drogi SE), „Brak utrudnień na korytarzu” tylko dla krajów na trasie aktywnego transportu, bez transportów bałtyckich —
 * bez sekcji (jak dotąd), limit masy wyróżniony z dopiskiem, atrybucja z `detail.zrodlo`, regresja Drogi PL/SE, telefon 390 px.
 * BN9-c4b (decyzja 89, 02.11 22:32): sekcja kraju działa jak Drogi SE — otwarta, pierwsze 4 (`FIRST_ROADS`), „Pokaż wszystkie”,
 * wspólny wiersz `RoadRow` z oryginałem / „Tłumaczenie w toku”.
 * Dane wymyślone (G-09).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { RoutePanel } from '../src/components/risks/RoutePanel';
import {
  attributionView, balticCountriesOfLoads, balticCountriesOfRoute, balticCountryOf, balticRoadSections, roadInfoFromDetail, sortBalticRows, withBalticRoad,
} from '../src/lib/bn9c4Roads';
import { FIRST_ROADS } from '../src/lib/p6Route';
import { isRouteOnly, isTodoRisk, routeRisks } from '../src/lib/todoRules';
import { sampleBalticCorridorsOf, sampleBalticRoadRisksOf, sampleBalticRoutesOf } from '../src/lib/p6Source';
import { todoQueue } from '../src/lib/cockpitE9';
import { textHits } from './e21Rules';
import { BN9C4_EN, I18N_ALL } from '../src/i18n/messages';
import type { Load, Risk, Sailing } from '../src/types';
import type { BalticCorridorRow } from '../src/lib/bn9c4Roads';

const NOW = '2026-11-02T10:00:00Z';
/* świeże odczyty źródeł (10 min przed „teraz”) — decyzja A */
const FRESH: BalticCorridorRow[] = (['ROAD_LT', 'ROAD_LV', 'ROAD_EE', 'ROAD_FI'] as const)
  .map((corridor) => ({ corridor, observedAt: '2026-11-02T09:50:00Z', slowdownMult: 1, reason: null }));
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
    seSituations: [], seDemo: false, showDemoMarks: true, parts: ['ferry', 'roads'], withHead: false, balticCorridors: FRESH, ...p,
  })), width);
}
/** BN9-c4b: sekcje krajów od razu otwarte (pierwsze 4) — „Pokaż wszystkie” w każdej sekcji, która go ma */
function expand(el: HTMLElement): HTMLElement {
  for (const b of [...el.querySelectorAll<HTMLButtonElement>('[data-baltic-all][aria-expanded="false"]')]) act(() => { b.click(); });
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
      original: null, pending: false,
    });
    const other = withBalticRoad(risk({ id: 'p', kind: 'ROAD_PL' }), { kind: 'ROAD_PL', detail: { zrodlo: 'HERE' } });
    expect(other.road).toBeUndefined();
  });

  it('DP-162: riskFromRow wypełnia road dla ROAD_FI (bez withBalticRoad)', async () => {
    const { riskFromRow } = await import('../src/data/mappers');
    const r = riskFromRow({
      id: 'rf', load_id: null, kind: 'ROAD_FI', severity: 'LOW', title: 'Trasa FI: roboty drogowe',
      title_key: 'rk_road_baltic',
      detail: {
        zrodlo: FI_SRC, od: '2026-11-01T08:00:00Z', do: '2026-11-05T16:00:00Z',
        lat: 65.01, lon: 25.47, weight_limit_t: null, height_limit_m: 4.2, width_limit_m: null,
        opis: 'Tie 4, Oulu. Tietyö.',
      },
      detected_at: '2026-11-02T10:00:00Z',
    }, '2026-11-02T12:00:00Z');
    expect(r.type).toBe('OPS');
    expect(r.road).toEqual({
      source: FI_SRC, from: '2026-11-01T08:00:00Z', to: '2026-11-05T16:00:00Z',
      lat: 65.01, lon: 25.47, weightLimitT: null, heightLimitM: 4.2, widthLimitM: null, original: null, pending: false,
    });
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
    /* BN9-c4b: otwarte od razu (jak Drogi SE), licznik w nagłówku; jedna pozycja — bez „Pokaż wszystkie” */
    expect(el.querySelector('[data-panel="road-fi"] [data-baltic-sum]')!.textContent).toBe('Finlandia · 1 utrudnienie · 0 wysokich');
    expect(el.querySelectorAll('[data-panel="road-fi"] [data-baltic-road]').length).toBe(1);
    expect(el.querySelector('[data-baltic-all]')).toBeNull();
  });
  it('transport PLD-KPS: LT, LV, EE; FI poza trasą — bez sekcji także z ryzykami (N4); ryzyko FI przy transporcie — widoczne', () => {
    const only = panel({ loads: [load('L-kps', 's-kps')], sailings: SAILS, risks: [road('fi1', 'FI')] });
    expect(panels(only).filter((p) => /^road-(lt|lv|ee|fi)$/.test(p!))).toEqual(['road-lt', 'road-lv', 'road-ee']);
    act(() => root?.unmount());
    host?.remove();
    const withLoad = expand(panel({ loads: [load('L-kps', 's-kps')], sailings: SAILS, risks: [road('fi1', 'FI'), road('fi2', 'FI', { loadId: 'L-x' })] }));
    expect(panels(withLoad)).toContain('road-fi');
    expect([...withLoad.querySelectorAll('[data-panel="road-fi"] [data-baltic-road]')].map((x) => x.getAttribute('data-baltic-road'))).toEqual(['fi2']);
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
    /* przy tym samym wpływie i tym samym czasie — kolejność id */
    expect([...el.querySelectorAll('[data-panel="road-fi"] [data-baltic-road]')].map((r) => r.getAttribute('data-baltic-road'))).toEqual(['p1', 'w1']);
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
  it('ryzyko drogowe bałtyckie przy transporcie widoczne zawsze — także bez transportów bałtyckich (N4)', () => {
    const el = expand(panel({ risks: [road('x', 'FI', { loadId: 'L-hel' })] }));
    expect(panels(el).filter((p) => /^road-(lt|lv|ee|fi)$/.test(p!))).toEqual(['road-fi']);
    expect(el.querySelector('[data-baltic-road="x"]')!.getAttribute('data-risk-id')).toBe('x');
  });
  it('sortowanie przy równym wpływie (BN9-c4b, decyzja 89): trwające od najświeższego początku, potem najbliższe, bez początku na końcu; dalej `to`, id', () => {
    const t = (id: string, from: string | null, to: string | null) => road(id, 'FI', {}, { od: from, do: to });
    const el = expand(panel({ loads, sailings: SAILS, risks: [
      t('e', null, null), t('d', null, '2026-11-03T00:00:00Z'), t('c', '2026-11-04T00:00:00Z', null), t('c0', '2026-11-03T00:00:00Z', null),
      t('b', '2026-11-01T00:00:00Z', '2026-11-06T00:00:00Z'), t('a', '2026-11-01T00:00:00Z', '2026-11-05T00:00:00Z'),
      t('n', '2026-11-02T09:00:00Z', null),
      road('z', 'FI', { severity: 'HIGH' }, { od: null, do: null }),
    ] }));
    expect([...el.querySelectorAll('[data-panel="road-fi"] [data-baltic-road]')].map((x) => x.getAttribute('data-baltic-road')))
      .toEqual(['z', 'n', 'a', 'b', 'c0', 'c', 'd', 'e']);
    /* bez „teraz” — jak w BN9-c4 (`from` rosnąco) */
    const [fi] = balticRoadSections([t('a', '2026-11-01T00:00:00Z', null), t('n', '2026-11-02T09:00:00Z', null)], new Set(['FI']), FRESH, NOW);
    expect(fi.rows.map((r) => r.id)).toEqual(['n', 'a']);
    expect(sortBalticRows(fi.rows).map((r) => r.id)).toEqual(['a', 'n']);
  });
  it('stan źródła bez zdarzeń (decyzja A): świeży ≤ 60 min, starszy z czasem ostatniego odczytu, brak wiersza, błąd odczytu; spowolnienie w nagłówku', () => {
    const rows: BalticCorridorRow[] = [
      { corridor: 'ROAD_LT', observedAt: '2026-11-02T09:00:00Z', slowdownMult: 1, reason: null },
      { corridor: 'ROAD_LV', observedAt: '2026-11-02T08:30:00Z', slowdownMult: 1, reason: null },
      { corridor: 'ROAD_FI', observedAt: '2026-11-02T09:55:00Z', slowdownMult: 1.2, reason: 'śliskość' },
    ];
    const el = panel({ loads, sailings: SAILS, balticCorridors: rows });
    const e = (c: string) => el.querySelector(`[data-empty="road-${c}"]`) as HTMLElement;
    expect(e('lt').textContent).toBe('Brak utrudnień na korytarzu.');
    expect(e('lv').textContent).toMatch(/^Brak świeżych danych ze źródła \(ostatni odczyt: 02\.11\.2026, \d{2}:30\)\.$/);
    expect(e('ee').textContent).toBe('Źródło jeszcze niepodłączone.');
    expect(el.querySelector('[data-panel="road-fi"] [data-baltic-slow]')!.textContent).toBe(' · spowolnienie +20%');
    expect(el.querySelector('[data-panel="road-lt"] [data-baltic-slow]')).toBeNull();
    act(() => root?.unmount());
    host?.remove();
    const err = panel({ loads, sailings: SAILS, balticCorridors: null });
    expect(err.querySelector('[data-empty="road-lt"]')!.textContent).toBe('Brak odczytu stanu źródła.');
    expect(err.querySelector('[data-empty="road-lt"]')!.textContent).not.toMatch(/Brak utrudnień/);
  });
  it('dopisek LT (decyzja B): „Źródło LT (Via Lietuva) nie podaje wypadków.” tylko w sekcji LT', () => {
    const el = panel({ loads, sailings: SAILS });
    expect(el.querySelector('[data-panel="road-lt"] [data-lt-note]')!.textContent).toBe('Źródło LT (Via Lietuva) nie podaje wypadków.');
    expect(el.querySelectorAll('[data-lt-note]').length).toBe(1);
  });
  it('link do ryzyka (N3, BN9-c4b): `focusRiskId` spoza pierwszych 4 włącza „Pokaż wszystkie” (także niski wpływ); w pierwszych — bez zmian', () => {
    const many = Array.from({ length: 8 }, (_, i) => road(`m${i}`, 'FI'));
    const low = road('low', 'LV', { severity: 'LOW' });
    const lv = road('lv1', 'LV');
    const el = panel({ loads, sailings: SAILS, risks: [...many, low, lv], focusRiskId: 'm7' });
    expect(el.querySelector('[data-panel="road-fi"]')!.getAttribute('data-all')).toBe('1');
    expect(el.querySelector('[data-risk-id="m7"]')).not.toBeNull();
    expect(el.querySelector('[data-panel="road-lv"]')!.getAttribute('data-all')).toBe('0');
    expect(el.querySelector('[data-risk-id="low"]')).toBeNull();
    act(() => root?.unmount());
    host?.remove();
    const el2 = panel({ loads, sailings: SAILS, risks: [...many, low, lv], focusRiskId: 'low' });
    expect(el2.querySelector('[data-panel="road-lv"]')!.getAttribute('data-all')).toBe('1');
    expect(el2.querySelector('[data-panel="road-lv"] [data-risk-id="low"]')).not.toBeNull();
    expect(el2.querySelector('[data-panel="road-fi"]')!.getAttribute('data-all')).toBe('0');
    act(() => root?.unmount());
    host?.remove();
    const el3 = panel({ loads, sailings: SAILS, risks: many, focusRiskId: 'm0' });
    expect(el3.querySelector('[data-panel="road-fi"]')!.getAttribute('data-all')).toBe('0');
    expect(readFileSync('src/views/RisksView.tsx', 'utf8')).toContain('...rr.roadBaltic');
  });
  it('BN9-c4b: sekcja kraju domyślnie otwarta jak Drogi SE — pierwsze 4 w kolejności, „Pokaż wszystkie N” / „Pokaż mniej”, niski wpływ dopiero w rozwinięciu', () => {
    expect(FIRST_ROADS).toBe(4);
    const risks = [
      road('m1', 'FI', {}, { od: '2026-11-01T08:00:00Z' }), road('m2', 'FI', {}, { od: '2026-11-02T08:00:00Z' }),
      road('h1', 'FI', { severity: 'HIGH' }), road('c1', 'FI', { severity: 'CRITICAL' }),
      road('m3', 'FI', {}, { od: '2026-11-03T08:00:00Z' }), road('m4', 'FI', {}, { od: null }),
      road('l1', 'FI', { severity: 'LOW' }), road('l2', 'FI', { severity: 'LOW' }),
    ];
    const el = panel({ loads, sailings: SAILS, risks });
    const sec = el.querySelector('[data-panel="road-fi"]') as HTMLElement;
    expect(sec.querySelector('[data-baltic-toggle]')).toBeNull();
    expect(sec.querySelector('[data-baltic-sum]')!.textContent).toBe('Finlandia · 8 utrudnień · 2 wysokie');
    const ids = () => [...sec.querySelectorAll('[data-baltic-road]')].map((x) => x.getAttribute('data-baltic-road'));
    expect(ids()).toEqual(['c1', 'h1', 'm2', 'm1']);
    const all = sec.querySelector('[data-baltic-all]') as HTMLButtonElement;
    expect(all.textContent).toBe('Pokaż wszystkie 8');
    expect(all.getAttribute('aria-expanded')).toBe('false');
    expect(all.getAttribute('aria-controls')).toBe('rk-fi-list');
    expect(sec.querySelector('#rk-fi-list')).not.toBeNull();
    act(() => { all.click(); });
    expect(ids()).toEqual(['c1', 'h1', 'm2', 'm1', 'm3', 'm4', 'l1', 'l2']);
    expect(all.textContent).toBe('Pokaż mniej');
    expect(all.getAttribute('aria-expanded')).toBe('true');
    act(() => { all.click(); });
    expect(ids()).toHaveLength(4);
    /* ta sama stała i ten sam wiersz co Drogi SE */
    const src = readFileSync('src/components/risks/BalticRoads.tsx', 'utf8');
    expect(src).toMatch(/FIRST_ROADS/);
    expect(src).not.toMatch(/FIRST_ROWS|data-baltic-toggle|data-baltic-low(?!only)/);
    expect(src).toMatch(/<RoadRow/);
    expect(readFileSync('src/components/risks/RoutePanel.tsx', 'utf8')).toMatch(/<RoadRow/);
  });
  it('BN9-c4b: do 4 pozycji bez niskiego wpływu — bez przycisku; same LOW — tylko ich liczba i „Pokaż wszystkie”', () => {
    const el = panel({ loads, sailings: SAILS, risks: [
      road('a', 'FI'), road('b', 'FI'), road('c', 'FI'), road('d', 'FI'), road('l1', 'EE', { severity: 'LOW' }), road('l2', 'EE', { severity: 'LOW' }),
    ] });
    const fi = el.querySelector('[data-panel="road-fi"]') as HTMLElement;
    expect(fi.querySelectorAll('[data-baltic-road]').length).toBe(4);
    expect(fi.querySelector('[data-baltic-all]')).toBeNull();
    const ee = el.querySelector('[data-panel="road-ee"]') as HTMLElement;
    expect(ee.querySelector('[data-baltic-sum]')!.textContent).toBe('Estonia · 2 utrudnienia · 0 wysokich');
    expect(ee.querySelectorAll('[data-baltic-road]').length).toBe(0);
    expect(ee.querySelector('[data-baltic-lowonly]')!.textContent).toBe('2 informacje o niskim wpływie');
    const all = ee.querySelector('[data-baltic-all]') as HTMLButtonElement;
    expect(all.hasAttribute('aria-controls')).toBe(false);
    act(() => { all.click(); });
    expect(ee.querySelectorAll('[data-baltic-road]').length).toBe(2);
    expect(ee.querySelector('[data-baltic-lowonly]')).toBeNull();
  });
  it('BN9-c4b: oryginał i „Tłumaczenie w toku” jak w Drogach SE (`detail.oryginal`); bez oryginału i przy kodach LT — bez pustych pól', () => {
    const tr = road('tr', 'FI', { detail: 'Roboty drogowe, zwężenie' }, { opis: 'Roboty drogowe, zwężenie', oryginal: 'Tietyö, kaista suljettu' });
    const pend = road('pe', 'FI', { detail: 'Tietyö käynnissä' }, { opis: 'Tietyö käynnissä', oryginal: 'Tietyö käynnissä' });
    const flag = road('fl', 'LV', { detail: 'Ceļa darbi' }, { opis: 'Ceļa darbi', oryginal: 'Ceļa darbi A7', pending: true });
    const codes = road('co', 'LT', { detail: 'Ograniczenie' }, { opis: 'Ograniczenie', oryginal: 'LD,SVKD' });
    const plain = road('pl', 'EE');
    const el = panel({ loads, sailings: SAILS, risks: [tr, pend, flag, codes, plain] });
    const row = (id: string) => el.querySelector(`[data-baltic-road="${id}"]`) as HTMLElement;
    expect(row('tr').querySelector('.rk-road-s')!.textContent).toMatch(/ · przetłumaczone z fińskiego$/);
    expect(row('tr').querySelector('[data-road-note="baltic"]')!.textContent).toBe('Roboty drogowe, zwężenie');
    expect(row('tr').querySelector('details.rk-orig summary')!.textContent).toBe('Pokaż oryginał');
    expect(row('tr').querySelector('[data-original="road"]')!.textContent).toBe('Tietyö, kaista suljettu');
    for (const id of ['pe', 'fl']) {
      expect(row(id).querySelector('[data-road-note="pending"]')!.textContent).toBe('Tłumaczenie w toku');
      expect(row(id).querySelector('[data-road-note="baltic"]')).toBeNull();
      expect(row(id).querySelector('.rk-road-s')!.textContent).not.toMatch(/przetłumaczone/);
      expect(row(id).querySelector('[data-original="road"]')).not.toBeNull();
    }
    expect(row('fl').querySelector('.rk-road-s')!.textContent).not.toMatch(/łotewskiego/);
    for (const id of ['co', 'pl']) {
      expect(row(id).querySelector('details')).toBeNull();
      expect(row(id).querySelector('[data-road-note="pending"]')).toBeNull();
      expect(row(id).querySelector('.rk-road-s')!.textContent).not.toMatch(/przetłumaczone/);
      expect(row(id).querySelector('[data-road-note="baltic"]')).not.toBeNull();
    }
    act(() => root?.unmount());
    host?.remove();
    /* telefon — jak Drogi SE: bez opisu i bez podglądu oryginału */
    const ph = panel({ phone: true, loads, sailings: SAILS, risks: [tr, pend] }, 390);
    expect(ph.querySelector('[data-baltic] details')).toBeNull();
    expect(ph.querySelector('[data-baltic] [data-road-note]')).toBeNull();
  });
  it('balticDemo przy VITE_AUTH_MODE=supabase nie dodaje nic (N8)', () => {
    vi.stubEnv('VITE_AUTH_MODE', 'supabase');
    try {
      expect(sampleBalticRoadRisksOf(NOW)).toEqual([]);
      expect(sampleBalticRoutesOf()).toEqual([]);
      expect(sampleBalticCorridorsOf(NOW)).toBeNull();
      const el = panel({ balticDemo: true });
      expect(el.querySelector('[data-baltic]')).toBeNull();
    } finally {
      vi.unstubAllEnvs();
    }
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
    /* N2: telefon — tytuł do dwóch linii */
    expect(css).toContain('@media (max-width: 480px){[data-baltic] .rk-road-t{white-space:normal;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}}');
    expect(css).toContain('[data-baltic] .rk-road-n,.rk-road-attr{overflow-wrap:anywhere}');
    expect(readFileSync('src/components/risks/BalticRoads.tsx', 'utf8')).not.toMatch(/style=\{|width:\s*\d/);
  });
  it('produkcja: 146 × ROAD_FI MEDIUM (fińskie tytuły) — od razu 4 pozycje z licznikiem, „Pokaż wszystkie 149” z LOW na końcu, wielokropek z pełnym tytułem', () => {
    const many = Array.from({ length: 146 }, (_, i) => road(`m${String(i).padStart(3, '0')}`, 'FI', {
      severity: 'MEDIUM', titleParams: { country: 'FI', event: `Tie 50, eli Kehä III, Vantaa. Tietyö <${i}> & "x"` },
    }));
    const lows = [road('low1', 'FI', { severity: 'LOW' }), road('low2', 'FI', { severity: 'LOW' })];
    const hi = road('hi', 'FI', { severity: 'HIGH' });
    const el = panel({ loads, sailings: SAILS, risks: [...many, ...lows, hi] });
    const sec = el.querySelector('[data-panel="road-fi"]') as HTMLElement;
    expect(sec.getAttribute('data-all')).toBe('0');
    expect(sec.querySelector('[data-baltic-sum]')!.textContent).toBe('Finlandia · 149 utrudnień · 1 wysokie');
    const visible = () => [...sec.querySelectorAll('#rk-fi-list [data-baltic-road]')].map((x) => x.getAttribute('data-baltic-road'));
    expect(visible()).toEqual(['hi', 'm000', 'm001', 'm002']);
    const all = sec.querySelector('[data-baltic-all]') as HTMLButtonElement;
    expect(all.textContent).toBe('Pokaż wszystkie 149');
    act(() => { all.click(); });
    expect(visible()).toHaveLength(149);
    expect(visible().slice(-2)).toEqual(['low1', 'low2']);
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
    expect(el.querySelectorAll('[data-baltic-road]').length).toBe(5);
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
