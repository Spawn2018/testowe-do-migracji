/**
 * @vitest-environment jsdom
 * DP-192 (pytanie właściciela 03.11 08:49): karta transportu bałtyckiego (TLL-HEL) — ETA jest liczone w bazie (BN8b, 0385).
 * Puste ETA z flagą „brak pozycji GPS” → prawdziwy powód (jak Polska – Szwecja), nie „jeszcze nie jest liczona”.
 * „brak danych” z dopiskiem tylko bez żadnej podstawy ETA. Dane wymyślone (G-09).
 */
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';

beforeAll(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

const { useTowerStore } = await import('../src/store/useTowerStore');
const { EtaBlock } = await import('../src/components/drawer/EtaBlock');
const { stageTileOf } = await import('../src/lib/stageTiles');
const { loadFromRow } = await import('../src/data/mappers');
const { pt } = await import('../src/i18n/p7');
const { p9m } = await import('../src/i18n/p9c');
const { t } = await import('../src/i18n/messages');
type Load = import('../src/types').Load;
type LoadRow = import('../src/data/mappers').LoadRow;
type OrgRow = import('../src/data/mappers').OrgRow;

let host: HTMLDivElement;
let root: Root | null = null;
const initial = useTowerStore.getState();

afterEach(() => {
  if (root) act(() => { root!.unmount(); });
  root = null;
  host?.remove();
});

const NOW = '2026-11-03T08:00:00Z';
const BASIS_NO_GPS = { method: 'ETA v2 (OSM)', segment: 'IN_TRANSIT_PL', flags: ['brak pozycji GPS'], here_leg: 'PL-TLL' };

const ORGS: OrgRow[] = [
  { id: '11111111-1111-4111-8111-111111111111', code: 'HHL', kind: 'FORWARDER' },
  { id: '33333333-3333-4333-8333-333333333333', code: 'SCX', kind: 'CARRIER' },
];
const row = (over: Partial<LoadRow>): LoadRow => ({
  id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', order_no: 'ZL-TEST-192', carrier_org_id: ORGS[1].id, status: 'IN_TRANSIT_PL',
  plan_load_date: '2026-11-01', plan_load_from: null, plan_load_to: null,
  plan_delivery_date: '2026-11-06', plan_delivery_from: null, plan_delivery_to: null,
  tractor_plate: 'XX 00000', trailer_plate: null, driver_name: null, driver_phone: null, escort_vehicles: 0,
  ferry_booking_ref: null, sailing_id: null, sailings: null,
  combo_length_m: null, combo_width_m: null, combo_height_m: null, combo_weight_t: null, delay_minutes: 0, eta_site: null,
  shipment_items: [],
  ...over,
} as LoadRow);

/** transport w trasie z danych demo, bez ETA — podstawa ETA z wiersza bazy przez mapper */
const onRoad = (): Load => {
  const l = initial.loads.find((x) => {
    const k = stageTileOf(x);
    return k && !['PREP', 'LOADING', 'DELIVERED', 'SETTLE', 'SITE'].includes(k) && x.status !== 'ON_FERRY' && !x.etaPreLoad;
  });
  if (!l) throw new Error('brak transportu w trasie w danych demo');
  return { ...l, etaBoden: null, etaDetail: null, etaPreLoad: false, etaReasons: [], etaComputedAt: null } as Load;
};
const fromDb = (over: Partial<LoadRow>): Load => {
  const m = loadFromRow(row(over), ORGS, 0, NOW);
  return { ...onRoad(), etaBoden: m.etaBoden, etaDetail: m.etaDetail ?? null, etaReasons: m.etaReasons, etaMethod: m.etaMethod, etaComputedAt: m.etaComputedAt, etaUpdatedAt: m.etaUpdatedAt };
};

async function eta(load: Load, route: string | null) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(createElement(EtaBlock, { load, locale: 'pl', phone: false, nowIso: NOW, deliveredAt: null, siteSince: null, delayMin: null, route }));
  });
  return host.querySelector<HTMLElement>('[data-eta-block]')!;
}

describe('DP-192 · mapper — podstawa ETA', () => {
  it('eta_basis z flagą „brak pozycji GPS” → etaReasons z flagą, etaComputedAt z eta_computed_at', () => {
    const l = loadFromRow(row({ eta_basis: BASIS_NO_GPS, eta_computed_at: '2026-11-03T07:55:00Z' }), ORGS, 0, NOW);
    expect(l.etaBoden).toBeNull();
    expect(l.etaReasons).toEqual(['brak pozycji GPS']);
    expect(l.etaComputedAt).toBe('2026-11-03T07:55:00Z');
  });
  it('bez eta_basis → etaComputedAt brak', () => {
    const l = loadFromRow(row({ eta_basis: null }), ORGS, 0, NOW);
    expect(l.etaComputedAt ?? null).toBeNull();
  });
});

describe('DP-192 · karta transportu — powód braku ETA', () => {
  it('(a) TLL-HEL + flaga „brak pozycji GPS” → „ETA: –” i „Brak pozycji GPS”, bez dopisku bałtyckiego', async () => {
    const el = await eta(fromDb({ eta_basis: BASIS_NO_GPS, eta_computed_at: '2026-11-03T07:55:00Z' }), 'TLL-HEL');
    expect(el.hasAttribute('data-eta-baltic')).toBe(false);
    expect(el.querySelector('.etab-val')!.textContent).toContain(t('pl', 'p4b_eta_none'));
    expect(el.querySelector('.etab-val')!.textContent).not.toContain(pt('pl', 'p7_eta_baltic_val'));
    expect(el.querySelector('.etab-sub')!.textContent).toContain(p9m('pl', 'p9c_drawer_nogps'));
    expect(el.textContent).not.toContain(pt('pl', 'p7_eta_baltic_sub'));
    expect(el.textContent).not.toContain('jeszcze nie jest liczona');
  });

  it('(a′) TLL-HEL + flaga bez szczegółów ETA → powód z listy flag (jak Polska – Szwecja), jeden raz', async () => {
    const el = await eta({ ...onRoad(), etaReasons: ['brak pozycji GPS'], etaComputedAt: '2026-11-03T07:55:00Z' }, 'TLL-HEL');
    expect(el.hasAttribute('data-eta-baltic')).toBe(false);
    const sub = el.querySelector('.etab-sub')!.textContent ?? '';
    expect(sub.toLowerCase().split('brak pozycji gps').length - 1).toBe(1);
    expect(sub).not.toContain(pt('pl', 'p7_eta_baltic_sub'));
  });

  it('(b) TLL-HEL bez podstawy ETA → „brak danych” i dopisek bałtycki (nowy, prawdziwy tekst)', async () => {
    const el = await eta(onRoad(), 'TLL-HEL');
    expect(el.getAttribute('data-eta-baltic')).toBe('pending');
    expect(el.querySelector('.etab-val')!.textContent).toContain(pt('pl', 'p7_eta_baltic_val'));
    expect(el.querySelector('.etab-sub')!.textContent).toContain(pt('pl', 'p7_eta_baltic_sub'));
    expect(pt('pl', 'p7_eta_baltic_sub')).toBe('ETA pojawi się po pierwszym obliczeniu dla tej trasy.');
  });

  it('(c) GDN-NYN bez GPS — bez zmian: „ETA: –”, bez dopisków', async () => {
    const load = fromDb({ eta_basis: BASIS_NO_GPS, eta_computed_at: '2026-11-03T07:55:00Z' });
    const el = await eta(load, 'GDN-NYN');
    expect(el.hasAttribute('data-eta-baltic')).toBe(false);
    expect(el.querySelector('.etab-val')!.textContent).toContain(t('pl', 'p4b_eta_none'));
    expect(el.textContent).not.toContain(pt('pl', 'p7_eta_baltic_sub'));
    expect(el.querySelector('.etab-sub')!.textContent).not.toContain(p9m('pl', 'p9c_drawer_nogps'));
  });
});
