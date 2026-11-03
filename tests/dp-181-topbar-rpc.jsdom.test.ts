/**
 * @vitest-environment jsdom
 * DP-181 / F7 #755: pasek górny — armator tylko z RPC (spoza seeda) z rejsem pojawia się w wierszach.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';

vi.mock('../src/lib/prodFacade', async (orig) => ({
  ...(await orig<typeof import('../src/lib/prodFacade')>()),
  PROD_BUILD: true,
}));

beforeAll(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

const { useTowerStore } = await import('../src/store/useTowerStore');
const { Topbar } = await import('../src/components/shell/Topbar');
const { applyFerryDictSnapshot, resetFerryDictRpc } = await import('../src/lib/ferryCatalog');
type Sailing = import('../src/types').Sailing;

let host: HTMLDivElement;
let root: Root | null = null;
const initial = useTowerStore.getState();

afterEach(() => {
  if (root) act(() => { root!.unmount(); });
  root = null;
  host?.remove();
  useTowerStore.setState({ sailings: initial.sailings, role: initial.role, locale: initial.locale });
  resetFerryDictRpc();
});

describe('DP-181 / F7 #755 — Topbar: armator tylko z RPC', () => {
  it('rejs NEWFERRY ze snapshota → wiersz w liście paska (+N)', async () => {
    applyFerryDictSnapshot({
      operators: [{ code: 'NEWFERRY', name: 'New Ferry Line' }],
      ports: [
        { code: 'TLL', country: 'EE', name: 'Tallinn' },
        { code: 'HEL', country: 'FI', name: 'Helsinki' },
      ],
      routes: [{ code: 'AAA-BBB', port_from: 'TLL', port_to: 'HEL', family_key: 'TLL-HEL', operators: ['NEWFERRY'] }],
    });
    const now = Date.now();
    const nf = {
      id: 'nf1',
      vessel: 'New Star',
      route: 'AAA-BBB',
      departureAt: new Date(now + 3_600_000).toISOString(),
      arrivalAt: new Date(now + 5_400_000).toISOString(),
      delayedDepartureAt: null,
      delayedArrivalAt: null,
      status: 'ZAPLANOWANY',
      source: 'NEWFERRY',
    } as Sailing;
    useTowerStore.setState({ role: 'HHL', locale: 'pl', sailings: [nf] });
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => { root!.render(createElement(Topbar)); });
    const more = host.querySelector<HTMLButtonElement>('[data-ops-more]');
    expect(more).not.toBeNull();
    act(() => { more!.click(); });
    const rows = [...host.querySelectorAll('[data-ops-pop-row]')].map((r) => r.textContent ?? '');
    expect(rows.some((r) => r.includes('New Ferry Line') && r.includes('New Star'))).toBe(true);
  });
});
