/**
 * @vitest-environment jsdom
 * DP-48, DP-49, DP-52 (rejestr drobnych poprawek): testy zachowania w jsdom.
 * DP-48 — dopisek „przed planowanym załadunkiem” dla wybranego rejsu jako osobna linia pod polem „Rejs promem”.
 * DP-49 — jeden tekst braku rejsów: okno Awizacja i Harmonogram › Rejsy.
 * DP-52 — ostrzeżenia oxlint (set-state-in-effect, nieużywany setRole) bez zmiany zachowania.
 * DP-60 (Pakiet DP-B): martwy `OptionsAccordion` usunięty razem z jego testem; DP-65: test oxlint pada, gdy oxlint się nie uruchomi;
 * DP-68: sonda hooka bez przypisania do zmiennej spoza komponentu (react(globals)).
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, createElement, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

/* DP-52: atrapa klienta bazy dla useOpenDecisions (tylko gdy VITE_AUTH_MODE=supabase) */
const db = vi.hoisted(() => ({ result: { data: [] as unknown[], error: null as null | { message: string } }, calls: 0 }));
vi.mock('../src/auth/client', () => ({
  getSupabase: async () => {
    db.calls += 1;
    const chain = {
      from: () => chain,
      select: () => chain,
      in: () => chain,
      order: () => chain,
      limit: async () => db.result,
    };
    return chain;
  },
}));

beforeAll(() => {
  (globalThis as unknown as { CSS?: { escape?: (s: string) => string } }).CSS ??= { escape: (s: string) => s };
  Element.prototype.scrollIntoView ??= function scrollIntoView() { /* jsdom */ };
});

const { useTowerStore } = await import('../src/store/useTowerStore');
const { AwizacjaModal } = await import('../src/components/drawer/AwizacjaModal');
const { SailingsPanel } = await import('../src/views/SailingsPanel');
const { useOpenDecisions } = await import('../src/components/risks/useDecisions');
const { isBeforePlannedLoad } = await import('../src/lib/awizacjaState');
const { pt } = await import('../src/i18n/p7');
const { sv } = await import('../src/i18n/sail7');
const { SAILINGS_EMPTY_TEXT } = await import('../src/i18n/sailingsEmpty');

let host: HTMLDivElement;
let root: Root;
const mount = () => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
};
const tick = (ms = 0) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
const initial = useTowerStore.getState();

afterEach(() => {
  act(() => { root?.unmount(); });
  host?.remove();
  useTowerStore.setState({ loads: initial.loads, sailings: initial.sailings, role: initial.role, locale: initial.locale });
  vi.unstubAllEnvs();
});

type L = (typeof initial.loads)[number];
const baseLoad = (over: Partial<L> = {}): L => {
  const l = initial.loads[0];
  return { ...l, sailingId: undefined, awizacja: { ...l.awizacja, loadWindowStart: undefined, loadWindowEnd: undefined }, ...over } as L;
};
const pick = (sel: HTMLSelectElement, value: string) => {
  act(() => {
    sel.value = value;
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  });
};

describe('DP-48 · Awizacja: dopisek „przed planowanym załadunkiem” zawsze widoczny dla wybranego rejsu', () => {
  it('rejs przed załadunkiem: osobna linia pod polem (poza <select>), ten sam warunek isBeforePlannedLoad', async () => {
    /* załadunek daleko w przyszłości → każdy osiągalny rejs jest „przed planowanym załadunkiem” */
    const load = baseLoad({ plannedLoadDate: '2099-01-01' });
    useTowerStore.setState({ role: 'HHL', locale: 'pl', loads: [load, ...initial.loads.slice(1)] });
    mount();
    await act(async () => { root.render(createElement(AwizacjaModal, { load, onClose: () => undefined })); });
    const sel = host.querySelector('select[data-awiz-sailing]') as HTMLSelectElement;
    expect(sel).toBeTruthy();
    expect(host.querySelector('[data-awiz-sailing-before]')).toBeNull();
    const opt = [...sel.options].find((o) => o.value && !o.closest('optgroup'))!;
    expect(opt).toBeTruthy();
    const sailing = useTowerStore.getState().sailings.find((s) => s.id === opt.value)!;
    expect(isBeforePlannedLoad(sailing, load, 'POLFERRIES')).toBe(true);
    /* opcja nadal ma dopisek (lista rozwinięta) — logika bez zmian */
    expect(opt.textContent).toContain(pt('pl', 'p7_m_sailing_before_load'));
    pick(sel, opt.value);
    const hint = host.querySelector('[data-awiz-sailing-before]') as HTMLElement;
    expect(hint).not.toBeNull();
    expect(hint.textContent).toBe(pt('pl', 'p7_m_sailing_before_load_sel'));
    expect(hint.textContent).toContain(pt('pl', 'p7_m_sailing_before_load'));
    expect(sel.contains(hint)).toBe(false);
    expect(hint.closest('label')).toBe(sel.closest('label'));
    expect(hint.classList.contains('am-hint')).toBe(true);
    /* „Brak rejsu” → linia znika */
    pick(sel, '');
    expect(host.querySelector('[data-awiz-sailing-before]')).toBeNull();
  });

  it('rejs po załadunku: bez dopisku w opcji i bez linii pod polem', async () => {
    const load = baseLoad({ plannedLoadDate: '2000-01-01' });
    useTowerStore.setState({ role: 'HHL', locale: 'pl', loads: [load, ...initial.loads.slice(1)] });
    mount();
    await act(async () => { root.render(createElement(AwizacjaModal, { load, onClose: () => undefined })); });
    const sel = host.querySelector('select[data-awiz-sailing]') as HTMLSelectElement;
    const opt = [...sel.options].find((o) => o.value && !o.closest('optgroup'))!;
    expect(opt.textContent).not.toContain(pt('pl', 'p7_m_sailing_before_load'));
    pick(sel, opt.value);
    expect(host.querySelector('[data-awiz-sailing-before]')).toBeNull();
  });

  it('linia pod polem łamie się (blok, zawijanie) — widoczna na 1440 i 390 px', () => {
    const css = readFileSync('src/components/drawer/p7.css', 'utf8');
    expect(css).toMatch(/\.am-hint\{display:block;/);
    expect(css).toMatch(/\.am-hint-before\{[^}]*overflow-wrap:anywhere/);
  });
});

describe('DP-49 · jeden tekst braku rejsów: Awizacja i Harmonogram › Rejsy', () => {
  it('stała: poprawna polszczyzna, kropka na końcu, bez podwójnej kropki; oba klucze z jednego źródła', () => {
    expect(SAILINGS_EMPTY_TEXT).toMatch(/^Brak rejsów tego armatora w rozkładzie/);
    expect(SAILINGS_EMPTY_TEXT.endsWith('.')).toBe(true);
    expect(SAILINGS_EMPTY_TEXT).not.toMatch(/\.\./);
    expect(pt('pl', 'p7_m_sailing_empty')).toBe(SAILINGS_EMPTY_TEXT);
    expect(sv('pl', 'sv_line_empty')).toBe(SAILINGS_EMPTY_TEXT);
  });

  it('oba ekrany przy pustym rozkładzie pokazują ten sam tekst', async () => {
    const load = baseLoad();
    useTowerStore.setState({ role: 'HHL', locale: 'pl', sailings: [], loads: [load, ...initial.loads.slice(1)] });
    mount();
    await act(async () => { root.render(createElement(AwizacjaModal, { load, onClose: () => undefined })); });
    const awiz = host.querySelector('[data-awiz-sailing-empty]')?.textContent;
    act(() => { root.unmount(); });
    host.remove();

    mount();
    await act(async () => { root.render(createElement(SailingsPanel, {})); });
    const line = host.querySelector('[data-sail-line]') as HTMLSelectElement;
    pick(line, 'DFDS');
    const harm = host.querySelector('[data-sail-empty]')?.textContent;

    expect(awiz).toBe(SAILINGS_EMPTY_TEXT);
    expect(harm).toBe(SAILINGS_EMPTY_TEXT);
  });
});

describe('DP-52 · oxlint bez starszych ostrzeżeń, zachowanie bez zmian', () => {
  it('oxlint: brak set-state-in-effect / refs w useDecisions, OptionsShell, WhoGetsScreen, AwizacjaModal i nieużywanego setRole w AccountMenu', () => {
    const files = [
      'src/components/risks/useDecisions.ts',
      'src/components/options/OptionsShell.tsx',
      'src/components/options/WhoGetsScreen.tsx',
      'src/components/drawer/AwizacjaModal.tsx',
      'src/components/shell/AccountMenu.tsx',
    ];
    const r = spawnSync('node_modules/.bin/oxlint', ['-f', 'unix', ...files], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    /* DP-65: oxlint musi się uruchomić (brak programu / awaria = błąd testu, nie cichy sukces); 0 = bez błędów, 1 = błędy lintu */
    expect(r.error, String(r.error ?? '')).toBeUndefined();
    expect([0, 1], `oxlint status=${r.status} ${r.stderr ?? ''}`).toContain(r.status);
    const bad = String(r.stdout ?? '').split('\n').filter((l) => /set-state-in-effect|no-unused-vars|react\(refs\)/.test(l));
    expect(bad).toEqual([]);
  });

  it('useOpenDecisions: w paczce demo bez zapytania; w trybie bazy wiersze po odpowiedzi, błąd bazy w error, refresh działa', async () => {
    /* DP-68: sonda oddaje wynik hooka przez efekt do funkcji spoza komponentu — bez przypisania zmiennej spoza komponentu w renderze */
    type Api = ReturnType<typeof useOpenDecisions>;
    const probe: { api: Api | null } = { api: null };
    const report = (a: Api) => { probe.api = a; };
    const Probe = ({ enabled }: { enabled: boolean }) => {
      const a = useOpenDecisions(enabled);
      useEffect(() => { report(a); });
      return null;
    };
    db.calls = 0;
    mount();
    await act(async () => { root.render(createElement(Probe, { enabled: true })); });
    await tick();
    expect(db.calls).toBe(0);
    expect(probe.api!.rows).toEqual([]);
    act(() => { root.unmount(); });

    vi.stubEnv('VITE_AUTH_MODE', 'supabase');
    db.result = {
      data: [{ id: 'd1', type_code: 'X', status: 'NEW', title: 'T', due_at: null, escalated_at: null, load_id: null, risk_id: null, decision_types: null }],
      error: null,
    };
    root = createRoot(host);
    await act(async () => { root.render(createElement(Probe, { enabled: false })); });
    await tick();
    expect(db.calls).toBe(0);
    await act(async () => { root.render(createElement(Probe, { enabled: true })); });
    await tick();
    expect(db.calls).toBe(1);
    expect(probe.api!.rows.map((r) => r.id)).toEqual(['d1']);
    expect(probe.api!.error).toBeNull();

    db.result = { data: [], error: { message: 'brak połączenia' } };
    await act(async () => { await probe.api!.refresh(); });
    expect(probe.api!.error).toBe('brak połączenia');
    expect(probe.api!.rows.map((r) => r.id)).toEqual(['d1']);
  });
});
