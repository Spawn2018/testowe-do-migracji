/**
 * @vitest-environment jsdom
 * BN9-c6 (#720 BN8 §3 pkt 5 — ekrany po BN8): awizacja (wszyscy armatorzy trasy, start od armatora rejsu/trasy,
 * odprawa EE 2 h — 82-C), „Przypnij rejs” dla tras z Estonii (kraj przypłynięcia), karta transportu (wiersz „Rejs”
 * z trasą i stan ETA trasy bałtyckiej przed BN8b), Kokpit (najbliższy prom bałtycki obok Polferries/Stena),
 * pasek górny (TLLA-HEL → „Tallinn A”), DP-177 (keepUnits w tytułach dróg bałtyckich).
 * Regresja Polska – Szwecja: te same teksty i wartości co przed BN9-c6. Dane wymyślone (G-09).
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';

const db = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('../src/auth/client', () => ({ getSupabase: async () => ({ rpc: db.rpc }) }));

beforeAll(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  (globalThis as unknown as { CSS?: { escape?: (s: string) => string } }).CSS ??= { escape: (s: string) => s };
  Element.prototype.scrollIntoView ??= function scrollIntoView() { /* jsdom */ };
});

const { useTowerStore } = await import('../src/store/useTowerStore');
const { AwizacjaModal } = await import('../src/components/drawer/AwizacjaModal');
const { SailingPin } = await import('../src/components/drawer/SailingPin');
const { EtaBlock } = await import('../src/components/drawer/EtaBlock');
const { PanelOverview } = await import('../src/components/drawer/PanelOverview');
const { BalticFerries } = await import('../src/components/dash/BalticFerries');
const { balticNearest, plSeNearest } = await import('../src/components/dash/balticNearest');
const { Cockpit } = await import('../src/components/dash/Cockpit');
const { Topbar } = await import('../src/components/shell/Topbar');
const { keepUnits } = await import('../src/components/risks/RoadRow');
const { arrivalCountry, initialAwizOperator, isBalticRoute } = await import('../src/components/drawer/bn9c6Route');
const { applyFerryDictSnapshot, resetFerryDictRpc } = await import('../src/lib/ferryCatalog');
const { nearestCrossingByOperator } = await import('../src/lib/sailings');
const { stageTileOf } = await import('../src/lib/stageTiles');
const { pt, ptp } = await import('../src/i18n/p7');
const { t } = await import('../src/i18n/messages');
type Sailing = import('../src/types').Sailing;
type Load = import('../src/types').Load;

let host: HTMLDivElement;
let root: Root | null = null;
const mount = () => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
};
const tick = (ms = 0) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
const initial = useTowerStore.getState();

afterEach(() => {
  if (root) act(() => { root!.unmount(); });
  root = null;
  host?.remove();
  useTowerStore.setState({ loads: initial.loads, sailings: initial.sailings, role: initial.role, locale: initial.locale, risks: initial.risks });
  resetFerryDictRpc();
  vi.unstubAllEnvs();
  db.rpc.mockReset();
});

function S(p: Partial<Sailing> & Pick<Sailing, 'id' | 'route' | 'departureAt'>): Sailing {
  return {
    vessel: 'Statek', arrivalAt: p.departureAt, delayedDepartureAt: null, delayedArrivalAt: null,
    status: 'ZAPLANOWANY', source: 'RECZNIE', ...p,
  } as Sailing;
}
const H = 36e5;
const iso = (ms: number) => new Date(ms).toISOString();

/* dzień załadunku daleko w przyszłości: wszystkie rejsy są przyszłe; start odprawy = 06:00 (+02:00) tego dnia */
const LOAD_DAY = '2099-03-10';
const T0 = Date.parse(`${LOAD_DAY}T06:00:00+02:00`);
const baseLoad = (over: Partial<Load> = {}): Load => {
  const l = initial.loads[0];
  return {
    ...l, plannedLoadDate: LOAD_DAY, sailingId: undefined,
    ferry: { ...l.ferry, vessel: null, departureAt: null },
    awizacja: { ...l.awizacja, loadWindowStart: undefined, loadWindowEnd: undefined }, ...over,
  } as Load;
};
const BEFORE = () => pt('pl', 'p7_m_sailing_before_load');
const optionText = (id: string) => host.querySelector<HTMLOptionElement>(`[data-awiz-sailing] option[value="${id}"]`)?.textContent ?? null;
const pick = (sel: HTMLSelectElement, value: string) => {
  act(() => {
    sel.value = value;
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  });
};

/* ---------- 1. Awizacja ---------- */
describe('BN9-c6 · 1. Awizacja: armatorzy trasy, start od rejsu/trasy, odprawa EE 2 h', () => {
  const tl1 = S({ id: 'tl1', route: 'TLL-HEL', vessel: 'MyStar', source: 'TALLINK', operator: 'Tallink Silja', departureAt: iso(T0 + 3 * H), arrivalAt: iso(T0 + 5 * H) });
  const tl0 = S({ id: 'tl0', route: 'TLL-HEL', vessel: 'Megastar', source: 'TALLINK', operator: 'Tallink Silja', departureAt: iso(T0 + 1 * H), arrivalAt: iso(T0 + 3 * H) });
  const pf = S({ id: 'pf1', route: 'GDN-NYN', vessel: 'Wawel', source: 'POLFERRIES', operator: 'Polferries', departureAt: iso(T0 + 3 * H), arrivalAt: iso(T0 + 21 * H) });
  const pf2 = S({ id: 'pf2', route: 'GDN-NYN', vessel: 'Nova Star', source: 'POLFERRIES', operator: 'Polferries', departureAt: iso(T0 + 15 * H), arrivalAt: iso(T0 + 33 * H) });
  const st = S({ id: 'st1', route: 'GDY-KAA', vessel: 'Stena Spirit', source: 'STENA', operator: 'Stena Line', departureAt: iso(T0 + 15 * H), arrivalAt: iso(T0 + 25 * H) });

  async function open(load: Load, sailings: Sailing[]) {
    useTowerStore.setState({ role: 'HHL', locale: 'pl', loads: [load, ...initial.loads.slice(1)], sailings });
    mount();
    await act(async () => { root!.render(createElement(AwizacjaModal, { load, onClose: () => undefined })); });
  }
  const opSel = () => host.querySelector<HTMLSelectElement>('[data-awiz-operator]')!;

  it('rejs TLL-HEL przypięty → start od Tallink; rejs 3 h po załadunku nie jest „przed załadunkiem” (2 h), 1 h — jest', async () => {
    await open(baseLoad({ sailingId: 'tl1' }), [tl1, tl0, pf]);
    expect(opSel().value).toBe('TALLINK');
    expect(optionText('tl1')).not.toContain(BEFORE());
    expect(optionText('tl0')).toContain(BEFORE());
    /* wcześniej (odprawa 14 h) oba byłyby „przed załadunkiem” */
  });

  it('regresja Polferries: rejs 3 h po załadunku dalej „przed załadunkiem” (Gdańsk 14 h), 15 h — nie', async () => {
    await open(baseLoad(), [pf, pf2, tl1]);
    expect(opSel().value).toBe('POLFERRIES');
    expect(optionText('pf1')).toContain(BEFORE());
    expect(optionText('pf2')).not.toContain(BEFORE());
    expect(optionText('tl1')).toBeNull();
  });

  it('regresja Stena: przypięty rejs Gdynia → Karlskrona — start od Steny (nie na sztywno Polferries), Gdynia 16 h', async () => {
    await open(baseLoad({ sailingId: 'st1' }), [st, pf]);
    expect(opSel().value).toBe('STENA');
    expect(optionText('st1')).toContain(BEFORE());
  });

  it('bez rejsu: start od armatora trasy transportu (statek Tallink → TLL-HEL)', () => {
    expect(initialAwizOperator(null, 'TLL-HEL')).toBe('TALLINK');
    expect(initialAwizOperator(null, 'PLD-KPS')).toBe('DFDS');
    expect(initialAwizOperator(null, null)).toBe('POLFERRIES');
    expect(initialAwizOperator(st, null)).toBe('STENA');
  });

  it('lista armatorów: wszyscy ze słownika, także armator tylko z bazy; bez rejsów — komunikat zostaje', async () => {
    applyFerryDictSnapshot({
      operators: [{ code: 'NEWFERRY', name: 'New Ferry Line' }],
      ports: [],
      routes: [{ code: 'TLL-HEL', port_from: 'TLL', port_to: 'HEL', family_key: 'TLL-HEL', operators: ['TALLINK', 'NEWFERRY'] }],
    });
    await open(baseLoad(), [pf]);
    const ops = [...opSel().options].map((o) => o.value);
    expect(ops).toEqual(['POLFERRIES', 'STENA', 'TALLINK', 'VIKING', 'ECKERO', 'DFDS', 'NEWFERRY']);
    expect([...opSel().options].find((o) => o.value === 'NEWFERRY')?.textContent).toBe('New Ferry Line');
    pick(opSel(), 'NEWFERRY');
    expect(host.querySelector('[data-awiz-sailing-empty]')?.textContent).toBe(pt('pl', 'p7_m_sailing_empty'));
  });
});

/* ---------- 2. Przypnij rejs ---------- */
describe('BN9-c6 · 2. „Przypnij rejs” — trasy z Estonii, kraj przypłynięcia z trasy', () => {
  const tl = S({ id: 'tl-pin', route: 'TLL-HEL', vessel: 'MyStar', source: 'TALLINK', departureAt: '2026-11-03T08:00:00Z', arrivalAt: '2026-11-03T10:00:00Z' });
  const pf = S({ id: 'pf-pin', route: 'GDN-NYN', vessel: 'Wawel', source: 'POLFERRIES', departureAt: '2026-11-03T16:00:00Z', arrivalAt: '2026-11-04T06:00:00Z' });
  const suggest = (proposed: string | null) => ({ data: { ok: true, mismatch: true, assigned_sailing_id: 'a', proposed_sailing_id: proposed, proposed_label: null }, error: null });

  async function render(sailings: Sailing[], route: string | null) {
    vi.stubEnv('VITE_AUTH_MODE', 'supabase');
    mount();
    await act(async () => { root!.render(createElement(SailingPin, { loadId: 'L1', locale: 'pl', sailings, route })); });
    await tick(10);
  }

  it('TLL-HEL: przycisk jest, „Auto jest już w Finlandii”, pytanie „etap w Finlandii”; zapis na rejs EE', async () => {
    db.rpc.mockImplementation(async (fn: string) => (fn === 'sailing_mismatch_suggest' ? suggest('tl-pin') : { data: { ok: true }, error: null }));
    await render([tl], 'TLL-HEL');
    const lead = host.querySelector('[data-sail-pin-lead]')!.textContent!;
    expect(lead).toContain('Auto jest już w Finlandii');
    expect(lead).not.toContain('Szwecji');
    act(() => { host.querySelector<HTMLButtonElement>('[data-sail-pin-btn]')!.click(); });
    expect(host.querySelector('[data-sail-pin-ask]')!.textContent).toContain('etap w Finlandii');
    await act(async () => { host.querySelector<HTMLButtonElement>('[data-sail-pin-yes]')!.click(); });
    await tick(10);
    expect(db.rpc).toHaveBeenCalledWith('sailing_mismatch_assign', { p_load_id: 'L1', p_sailing_id: 'tl-pin' });
    expect(host.querySelector('[data-sail-pin-done]')).not.toBeNull();
  });

  it('brak pasującego rejsu na trasie TLL-HEL → tekst z Finlandią (z trasy transportu)', async () => {
    db.rpc.mockResolvedValue(suggest(null));
    await render([], 'TLL-HEL');
    expect(host.querySelector('[data-sail-pin-none]')!.textContent).toBe(pt('pl', 'p7_pin_none_fi'));
  });

  it('odmowa „trasa” na trasie bałtyckiej — komunikat o trasach z Estonii (nie Gdańsk/Gdynia)', async () => {
    db.rpc.mockImplementation(async (fn: string) => (fn === 'sailing_mismatch_suggest' ? suggest('tl-pin') : { data: null, error: { message: 'zła trasa rejsu' } }));
    await render([tl], 'TLL-HEL');
    act(() => { host.querySelector<HTMLButtonElement>('[data-sail-pin-btn]')!.click(); });
    await act(async () => { host.querySelector<HTMLButtonElement>('[data-sail-pin-yes]')!.click(); });
    await tick(10);
    expect(host.querySelector('[data-sail-pin-err]')!.textContent).toBe(pt('pl', 'p7_pin_err_route_ee'));
  });

  it('regresja GDN-NYN: teksty „w Szwecji” bez zmian (te same klucze)', async () => {
    db.rpc.mockResolvedValue(suggest('pf-pin'));
    await render([pf], 'GDN-NYN');
    expect(host.querySelector('[data-sail-pin-lead]')!.textContent).toBe(ptp('pl', 'p7_pin_lead', { sailing: host.querySelector('[data-sail-pin-lead]')!.textContent!.split('Pasujący rejs: ')[1].replace(/\.$/, '') }));
    expect(host.querySelector('[data-sail-pin-lead]')!.textContent).toContain('w Szwecji');
  });

  it('kraj przypłynięcia z trasy: FI dla TLL-HEL / TLLA-HEL / MUU-VUO, SE dla TLL-STO / PLD-KPS / GDN-NYN', () => {
    for (const r of ['TLL-HEL', 'TLLA-HEL', 'MUU-VUO']) expect(arrivalCountry(r), r).toBe('FI');
    for (const r of ['TLL-STO', 'PLD-KPS', 'GDN-NYN', 'GDY-KAA']) expect(arrivalCountry(r), r).toBe('SE');
    expect(isBalticRoute('TLL-STO')).toBe(true);
    expect(isBalticRoute('GDN-NYN')).toBe(false);
    expect(isBalticRoute(null)).toBe(false);
  });
});

/* ---------- 3. Karta transportu: wiersz Rejs i ETA ---------- */
describe('BN9-c6 · 3. Karta transportu — wiersz „Rejs” i ETA dla TLL-HEL', () => {
  const onRoad = () => {
    const l = initial.loads.find((x) => {
      const k = stageTileOf(x);
      return k && !['PREP', 'LOADING', 'DELIVERED', 'SETTLE', 'SITE'].includes(k) && x.status !== 'ON_FERRY' && !x.etaPreLoad;
    });
    if (!l) throw new Error('brak transportu w trasie w danych demo');
    return { ...l, etaBoden: null, etaDetail: null, etaPreLoad: false } as Load;
  };

  async function eta(load: Load, route: string | null) {
    mount();
    await act(async () => {
      root!.render(createElement(EtaBlock, { load, locale: 'pl', phone: false, nowIso: '2026-11-03T08:00:00Z', deliveredAt: null, siteSince: null, delayMin: null, route }));
    });
    return host.querySelector<HTMLElement>('[data-eta-block]')!;
  }

  it('TLL-HEL bez ETA z bazy (przed BN8b) → „brak danych” i dopisek, zamiast samego „ETA: –”', async () => {
    const el = await eta(onRoad(), 'TLL-HEL');
    expect(el.getAttribute('data-eta-baltic')).toBe('pending');
    expect(el.querySelector('.etab-val')!.textContent).toContain(pt('pl', 'p7_eta_baltic_val'));
    expect(el.querySelector('.etab-sub')!.textContent).toContain(pt('pl', 'p7_eta_baltic_sub'));
  });

  it('TLL-HEL z ETA z bazy — ETA jak dotąd, bez dopisku', async () => {
    const el = await eta({ ...onRoad(), etaBoden: '2026-11-05T09:00:00Z' }, 'TLL-HEL');
    expect(el.hasAttribute('data-eta-baltic')).toBe(false);
    expect(el.textContent).not.toContain(pt('pl', 'p7_eta_baltic_sub'));
  });

  it('regresja GDN-NYN bez ETA — „ETA: –” jak dotąd', async () => {
    const el = await eta(onRoad(), 'GDN-NYN');
    expect(el.hasAttribute('data-eta-baltic')).toBe(false);
    expect(el.querySelector('.etab-val')!.textContent).toContain(t('pl', 'p4b_eta_none'));
  });

  async function card(load: Load, sailings: Sailing[]) {
    useTowerStore.setState({ role: 'HHL', locale: 'pl', loads: [load], sailings });
    mount();
    await act(async () => {
      root!.render(createElement(PanelOverview, {
        load, loads: [load], role: 'HHL', locale: 'pl', phone: false, nowIso: '2026-11-03T08:00:00Z', events: [], docs: [], risks: [],
        sailings, insAuto: null, deliveredAt: null, siteSince: null, delayMin: null, mapNode: null, ratingNode: null,
        onAwiz: () => undefined, onKshDates: () => undefined, onTab: () => undefined,
      }));
    });
    return host.querySelector<HTMLElement>('[data-ferry-row]')!;
  }

  it('wiersz „Rejs” TLL-HEL: statek · Tallinn → Helsinki · odejście → przypłynięcie; ETA „brak danych”', async () => {
    const s = S({ id: 'c-tl', route: 'TLL-HEL', vessel: 'MyStar', source: 'TALLINK', departureAt: '2026-11-04T08:00:00Z', arrivalAt: '2026-11-04T10:00:00Z' });
    const load = { ...onRoad(), sailingId: 'c-tl', ferry: { ...onRoad().ferry, vessel: 'MyStar', departureAt: s.departureAt } } as Load;
    const row = await card(load, [s]);
    expect(row.textContent).toMatch(/^MyStar · Tallinn → Helsinki · 04\.11\.2026, 09:00 → 04\.11\.2026, 11:00$/);
    expect(host.querySelector('[data-eta-block]')!.getAttribute('data-eta-baltic')).toBe('pending');
  });

  it('regresja GDN-NYN: wiersz „Rejs” bez trasy (statek · odejście → przypłynięcie), ETA bez dopisku', async () => {
    const s = S({ id: 'c-pf', route: 'GDN-NYN', vessel: 'Wawel', source: 'POLFERRIES', departureAt: '2026-11-04T16:00:00Z', arrivalAt: '2026-11-05T06:00:00Z' });
    const load = { ...onRoad(), sailingId: 'c-pf', ferry: { ...onRoad().ferry, vessel: 'Wawel', departureAt: s.departureAt } } as Load;
    const row = await card(load, [s]);
    expect(row.textContent).toMatch(/^Wawel · 04\.11\.2026, 17:00 → 05\.11\.2026, 07:00$/);
    expect(row.textContent).not.toContain('Gdańsk');
    expect(host.querySelector('[data-eta-block]')!.hasAttribute('data-eta-baltic')).toBe(false);
  });
});

/* ---------- 4. Kokpit ---------- */
describe('BN9-c6 · 4. Kokpit — najbliższy prom bałtycki obok Polferries/Stena', () => {
  const NOW = Date.parse('2026-11-03T08:00:00Z');
  const sail = [
    S({ id: 'k-pf', route: 'GDN-NYN', vessel: 'Wawel', source: 'POLFERRIES', departureAt: '2026-11-03T16:00:00Z', arrivalAt: '2026-11-04T06:00:00Z' }),
    S({ id: 'k-tl', route: 'TLL-HEL', vessel: 'MyStar', source: 'TALLINK', departureAt: '2026-11-03T10:30:00Z', arrivalAt: '2026-11-03T12:30:00Z' }),
    S({ id: 'k-vk', route: 'TLLA-HEL', vessel: 'Viking XPRS', source: 'VIKING', departureAt: '2026-11-03T09:30:00Z', arrivalAt: '2026-11-03T12:00:00Z', delayedArrivalAt: '2026-11-03T12:40:00Z' }),
    S({ id: 'k-df', route: 'PLD-KPS', vessel: 'Sirena Seaways', source: 'DFDS', departureAt: '2026-11-03T18:00:00Z', arrivalAt: '2026-11-04T03:30:00Z' }),
  ];

  it('balticNearest: tylko armatorzy spoza PL–SE z rejsem, od najbliższego odejścia', () => {
    const list = balticNearest(nearestCrossingByOperator(sail, NOW, 1));
    expect(list.map((x) => x.op)).toEqual(['VIKING', 'TALLINK', 'DFDS']);
    expect(balticNearest(nearestCrossingByOperator([sail[0]], NOW, 1))).toEqual([]);
  });

  it('decyzja #750: najbliższy rejs to Tallink → kafelek „Najbliższy prom” = najbliższy Polferries/Stena; Tallink tylko w sekcji bałtyckiej', () => {
    const st = S({ id: 'k-st', route: 'GDY-KAA', vessel: 'Stena Spirit', source: 'STENA', departureAt: '2026-11-03T19:00:00Z', arrivalAt: '2026-11-04T05:00:00Z' });
    const near = nearestCrossingByOperator([...sail, st], NOW, 1);
    expect(plSeNearest(near)?.id).toBe('k-pf');
    expect(balticNearest(near).map((x) => x.sailing.id)).toContain('k-tl');
    expect(balticNearest(near).map((x) => x.sailing.id)).not.toContain('k-pf');
    /* bez rejsów PL–SE — kafelek „brak rejsu”, mimo rejsów bałtyckich */
    expect(plSeNearest(nearestCrossingByOperator(sail.slice(1), NOW, 1))).toBeNull();
    /* tylko Stena — Stena */
    expect(plSeNearest(nearestCrossingByOperator([st, sail[1]], NOW, 1))?.id).toBe('k-st');
  });

  it('Kokpit: karty Viking/Tallink/DFDS z trasą i ETA przypłynięcia (opóźnione, gdy jest) pod kafelkami', async () => {
    const ferries = balticNearest(nearestCrossingByOperator(sail, NOW, 1));
    mount();
    await act(async () => {
      root!.render(createElement(Cockpit, {
        locale: 'pl', role: 'HHL', org: 'HHL', kind: '', date: '',
        tiles: [{ id: 'ferry', label: 'Najbliższy prom', labelShort: 'Najbliższy prom', go: 'risk', value: '03.11.2026, 17:00', of: null, desc: 'Wawel Gdańsk → Nynäshamn', descShort: 'x', tone: 'default' }],
        onGo: () => undefined,
        extra: createElement(BalticFerries, { locale: 'pl', ferries, onGo: () => undefined }),
      }));
    });
    expect(host.querySelector('[data-ck="ferry"]')!.textContent).toContain('Wawel Gdańsk → Nynäshamn');
    const box = host.querySelector('[data-ck-baltic-ferries]')!;
    expect(box.querySelector('h3')!.textContent).toBe(pt('pl', 'p7_ck_baltic_h'));
    const cards = [...box.querySelectorAll<HTMLElement>('[data-ck-baltic-op]')];
    expect(cards.map((c) => c.dataset.ckBalticOp)).toEqual(['VIKING', 'TALLINK', 'DFDS']);
    expect(cards[0].querySelector('.k')!.textContent).toBe('Viking Line');
    expect(cards[0].querySelector('[data-ck-baltic-eta]')!.textContent).toBe('Viking XPRS Tallinn A → Helsinki · przypłynięcie (ETA) 03.11.2026, 13:40');
    expect(cards[0].querySelector('.v')!.className).toContain('warn');
    expect(cards[1].querySelector('[data-ck-baltic-eta]')!.textContent).toContain('MyStar Tallinn → Helsinki');
    expect(cards[2].querySelector('[data-ck-baltic-eta]')!.textContent).toContain('Paldiski → Kapellskär');
  });

  it('bez rejsów bałtyckich — nic się nie rysuje (Kokpit jak dotąd)', async () => {
    mount();
    await act(async () => { root!.render(createElement(BalticFerries, { locale: 'pl', ferries: [], onGo: () => undefined })); });
    expect(host.innerHTML).toBe('');
  });
});

/* ---------- 5. Pasek górny ---------- */
describe('BN9-c6 · 5. Pasek górny — TLLA-HEL to „Tallinn A”, nie „TLLA”', () => {
  it('lista rejsów (`ferries=all`, demo): Viking/Eckerö „Tallinn A → Helsinki”; Polferries/Stena jak dotąd', async () => {
    window.location.hash = `#/?now=${encodeURIComponent('2026-09-23T14:32:00Z')}&ferries=all`;
    useTowerStore.setState({ role: 'HHL', locale: 'pl' });
    mount();
    await act(async () => { root!.render(createElement(Topbar)); });
    const more = host.querySelector<HTMLButtonElement>('[data-ops-more]');
    expect(more).not.toBeNull();
    act(() => { more!.click(); });
    const rows = [...host.querySelectorAll('[data-ops-pop-row]')].map((r) => r.textContent ?? '');
    const all = rows.join('\n');
    expect(all).not.toMatch(/TLLA/);
    expect(rows.find((r) => r.includes('Viking XPRS'))).toContain('Tallinn A → Helsinki');
    expect(rows.find((r) => r.includes('Finlandia'))).toContain('Tallinn A → Helsinki');
    expect(rows.find((r) => r.includes('MyStar'))).toContain('Tallinn → Helsinki');
    expect(rows.find((r) => r.includes('Wawel'))).toContain('Gdańsk → Nynäshamn');
    expect(rows.find((r) => r.includes('Stena Estelle'))).toContain('Gdynia → Karlskrona');
    expect(rows.find((r) => r.includes('Sirena Seaways'))).toContain('Paldiski → Kapellskär');
    window.location.hash = '';
  });
});

/* ---------- 6. DP-177 ---------- */
describe('BN9-c6 · 6. DP-177 — keepUnits w tytułach dróg bałtyckich', () => {
  it('liczba z jednostką ze spacją nierozdzielającą', () => {
    expect(keepUnits('Kelirikko 4 Oulu 12 t, 50 km/h')).toBe('Kelirikko 4 Oulu 12 t, 50 km/h');
  });
});
