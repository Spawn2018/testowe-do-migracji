/**
 * @vitest-environment jsdom
 * Pakiet DP-B (rejestr drobnych poprawek koordynatora):
 * DP-64 — `p7.ts` i `sail7.ts` biorą tekst braku rejsów z jednego źródła (`SAILINGS_EMPTY_TEXT`): test zachowania —
 *         podmiana stałej zmienia oba słowniki (nie porównanie tekstu w kodzie).
 * DP-177 — Ryzyka › Drogi LT/LV/EE/FI: liczba nie odrywa się od jednostki także w tytule wiersza (etykieta limitu „12 t”).
 * DP-62 — Opcje (`OptionsShell`): wskazanie ekranu z zewnątrz (`request.seq`) obsłużone raz, w renderze; przewinięcie w efekcie.
 * DP-62 — Kto co dostaje (`WhoGetsScreen`): nowe dane z propsów bez setState w efekcie — ekran pokazuje je bez ponownego montowania.
 * DP-185 — Awizacja: armator startowy bez efektu (`picked ?? startOperator`); pole rejsu puste a rejs przypięty → dociągnięty `sailingId`.
 * Dane wymyślone (G-09).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, createElement, Fragment } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { Load, Risk } from '../src/types';

let root: Root | null = null;
let host: HTMLDivElement | null = null;
afterEach(() => {
  if (root) act(() => { root!.unmount(); });
  host?.remove();
  root = null;
  host = null;
  vi.doUnmock('../src/i18n/sailingsEmpty');
  vi.resetModules();
});
const mount = () => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
};

describe('DP-64 · tekst braku rejsów: jedno źródło dla p7 i sail7', () => {
  it('podmieniona stała SAILINGS_EMPTY_TEXT → oba słowniki zwracają nową wartość', async () => {
    const MARK = 'ZNACZNIK-DP-64';
    vi.resetModules();
    vi.doMock('../src/i18n/sailingsEmpty', () => ({ SAILINGS_EMPTY_TEXT: MARK }));
    const { pt } = await import('../src/i18n/p7');
    const { sv } = await import('../src/i18n/sail7');
    expect(pt('pl', 'p7_m_sailing_empty')).toBe(MARK);
    expect(sv('pl', 'sv_line_empty')).toBe(MARK);
  });

  it('bez podmiany: obie wartości równe stałej', async () => {
    vi.resetModules();
    const { SAILINGS_EMPTY_TEXT } = await import('../src/i18n/sailingsEmpty');
    const { pt } = await import('../src/i18n/p7');
    const { sv } = await import('../src/i18n/sail7');
    expect(pt('pl', 'p7_m_sailing_empty')).toBe(SAILINGS_EMPTY_TEXT);
    expect(sv('pl', 'sv_line_empty')).toBe(SAILINGS_EMPTY_TEXT);
  });
});

describe('DP-177 · Drogi bałtyckie: twarda spacja między liczbą a jednostką w tytule', () => {
  it('tytuł z limitem masy „12 t” — twarda spacja (etykieta, podpowiedź, dopisek ładunku)', async () => {
    const { withBalticRoad, balticRoadSections } = await import('../src/lib/bn9c4Roads');
    const { balticRoadSectionNodes } = await import('../src/components/risks/BalticRoads');
    const base = {
      id: 'fi-w', type: 'OPS', severity: 'HIGH', title: 'Trasa FI: limit masy 12 t — sprawdź zezwolenie / trasę', detail: 'opis',
      owner: 'HHL', meta: '', nextAction: '', ageHours: 1, kind: 'ROAD_FI',
      titleKey: 'rk_road_baltic_weight',
      titleParams: { country: 'FI', road: 'E75', event: 'Kelirikko 4 km', limit: 12, load: 14 },
    } as unknown as Risk;
    const r = withBalticRoad(base, { kind: 'ROAD_FI', detail: { zrodlo: 'Fintraffic', weight_limit_t: 12 } });
    const sections = balticRoadSections([r], new Set(['FI'] as const), null, '2026-11-02T10:00:00Z');
    mount();
    act(() => {
      root!.render(createElement(Fragment, null, ...balticRoadSectionNodes({ sections, locale: 'pl', phone: false, demo: false })));
    });
    const row = host!.querySelector('[data-baltic-road="fi-w"]')!;
    expect(row).not.toBeNull();
    const title = row.querySelector('.rk-road-t') as HTMLElement;
    expect(title.textContent).toContain('12 t');
    expect(title.textContent).toContain('E75');
    expect(title.textContent).toContain('Warunki drogowe');
    expect(title.textContent).not.toMatch(/\d (?:km|m|h|min|t|dni|%)(?![\p{L}\p{N}])/u);
    /* DP-204/#781 pkt 6: bez dublowania „Limit masy” + „Ograniczenie masy” — tag ukryty. */
    expect(row.querySelector('[data-limit-tag]')).toBeNull();
    expect(title.getAttribute('title')).toContain('12 t');
    const check = row.querySelector('[data-limit-check]')?.textContent ?? '';
    expect(check).not.toMatch(/\d t(?![\p{L}\p{N}])/u);
  });
});

describe('DP-185 · Awizacja: przypięty rejs dociągnięty do pustego pola', () => {
  it('okno otwarte bez rejsu; transport dostaje przypięty rejs → pole rejsu = przypięty rejs; ręczny wybór zostaje', async () => {
    const { useTowerStore } = await import('../src/store/useTowerStore');
    const { AwizacjaModal } = await import('../src/components/drawer/AwizacjaModal');
    const initial = useTowerStore.getState();
    try {
      const l0 = initial.loads[0];
      const load = { ...l0, plannedLoadDate: '2099-01-01', sailingId: undefined, awizacja: { ...l0.awizacja, loadWindowStart: undefined, loadWindowEnd: undefined } } as Load;
      useTowerStore.setState({ role: 'HHL', locale: 'pl', loads: [load, ...initial.loads.slice(1)] });
      mount();
      const render = (l: Load) => act(async () => { root!.render(createElement(AwizacjaModal, { load: l, onClose: () => undefined })); });
      await render(load);
      const sel = () => host!.querySelector<HTMLSelectElement>('select[data-awiz-sailing]')!;
      expect(sel().value).toBe('');
      const target = [...sel().options].find((o) => o.value && !o.closest('optgroup'))!;
      expect(target).toBeTruthy();
      await render({ ...load, sailingId: target.value });
      expect(sel().value).toBe(target.value);
      /* użytkownik wybiera „Brak rejsu” — kolejne odświeżenie transportu nie nadpisuje wyboru */
      act(() => {
        sel().value = '';
        sel().dispatchEvent(new Event('change', { bubbles: true }));
      });
      await render({ ...load, sailingId: target.value });
      expect(sel().value).toBe('');
    } finally {
      useTowerStore.setState({ loads: initial.loads, sailings: initial.sailings, role: initial.role, locale: initial.locale });
    }
  });
});

describe('DP-62 · WhoGetsScreen: nowe dane z propsów bez ponownego montowania', () => {
  it('nowe grupy i stan kart z propsów — widoczne po ponownym renderze', async () => {
    const { WhoGetsScreen } = await import('../src/components/options/WhoGetsScreen');
    const cell = { bell: true, push: false, mail: false };
    const groups = (title: string) => [{ id: 'g', title: 'Grupa', rows: [{ id: 'r1', title, cells: { HHL_ADMIN: cell } }] }];
    const cards = (on: boolean) => ({ mail: { on, used: 1, max: 90, reserve: 10 }, push: { on: !on, devices: 1 }, last: { when: '—', text: '—' } });
    mount();
    const render = (title: string, on: boolean) => act(() => {
      root!.render(createElement(WhoGetsScreen, { locale: 'pl', groups: groups(title) as never, cards: cards(on) }));
    });
    render('Zdarzenie A', false);
    const switches = () => [...host!.querySelectorAll('[role="switch"]')].map((b) => b.getAttribute('aria-checked'));
    expect(host!.textContent).toContain('Zdarzenie A');
    const before = switches();
    expect(before).toEqual(['false', 'true']);
    render('Zdarzenie B', true);
    expect(host!.textContent).toContain('Zdarzenie B');
    expect(host!.textContent).not.toContain('Zdarzenie A');
    expect(switches()).toEqual(['true', 'false']);
  });
});

describe('DP-62 · OptionsShell: wskazanie ekranu z zewnątrz obsłużone raz', () => {
  it('nowe `seq` otwiera ekran i przewija `main` na górę; to samo `seq` ponownie — bez zmian', async () => {
    const { OptionsShell } = await import('../src/components/options/OptionsShell');
    const main = document.createElement('main');
    const scrollTo = vi.fn();
    (main as unknown as { scrollTo: typeof scrollTo }).scrollTo = scrollTo;
    document.body.appendChild(main);
    try {
      const groups = [{ id: 'people' as const, screens: [
        { id: 'users' as const, body: createElement('p', { 'data-body': 'users' }, 'U') },
        { id: 'logins' as const, body: createElement('p', { 'data-body': 'logins' }, 'L') },
      ] }];
      mount();
      const render = (request: { screen: 'users' | 'logins'; seq: number } | null) => act(() => {
        root!.render(createElement(OptionsShell, { locale: 'pl', rootKey: 'p3c_root_opts', groups, request }));
      });
      render(null);
      expect(host!.querySelector('[data-body="users"]')).not.toBeNull();
      expect(scrollTo).not.toHaveBeenCalled();
      render({ screen: 'logins', seq: 1 });
      expect(host!.querySelector('[data-body="logins"]')).not.toBeNull();
      expect(scrollTo).toHaveBeenCalledTimes(1);
      render({ screen: 'logins', seq: 1 });
      expect(scrollTo).toHaveBeenCalledTimes(1);
      render({ screen: 'users', seq: 2 });
      expect(host!.querySelector('[data-body="users"]')).not.toBeNull();
      expect(scrollTo).toHaveBeenCalledTimes(2);
    } finally {
      main.remove();
    }
  });
});
