/**
 * @vitest-environment jsdom
 */
/**
 * DP-79 — jeden zegar demo. Kokpit w demo (bez `?now=`) pokazywał nagłówek z bieżącą datą (31.10.2026),
 * „dziś 23.09.2026” na wykresie i „ostatnia pozycja 37 d temu” w pasku śledzenia. Teraz nagłówek (fmtDate(getNow())),
 * „dziś” wykresu i pasek śledzenia biorą ten sam zegar (`getNow`). Produkcja — czas rzeczywisty.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { fmtDate } from '../src/lib/time';
import { DeliveryProgress } from '../src/components/chart/DeliveryProgress';
import { TrackingBar } from '../src/components/drawer/TrackingBar';
import { buildSeedLoads } from '../src/data/seed';
import { buildDemoSnapshot } from '../src/data/demoProvider';
import { getNow, getNowIso, getNowMs, isFrozenNow, resetFrozenNowCache } from '../src/lib/frozenNow';
import { trackingPhase } from '../src/lib/stageTiles';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let host: HTMLDivElement | null = null;
function mount(el: ReturnType<typeof createElement>): HTMLDivElement {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => { root!.render(el); });
  return host;
}

afterEach(() => {
  act(() => { root?.unmount(); });
  host?.remove();
  root = null;
  host = null;
  vi.unstubAllEnvs();
});

describe('DP-79: jeden zegar demo (Kokpit)', () => {
  it('demo bez ?now=: getNow() = 23.09.2026 i płynie od wczytania strony (nie data bieżąca)', async () => {
    resetFrozenNowCache();
    expect(isFrozenNow()).toBe(false);
    const ms = getNowMs();
    expect(ms).toBeGreaterThanOrEqual(Date.parse('2026-09-23T14:32:00Z'));
    expect(ms - Date.parse('2026-09-23T14:32:00Z')).toBeLessThan(10 * 60_000);
    expect(fmtDate(getNowIso())).toBe('23.09.2026');
  });

  it('nagłówek, „dziś” wykresu i „ostatnia pozycja” w pasku z tego samego zegara', async () => {
    resetFrozenNowCache();
    const nowIso = getNow().toISOString();
    const header = fmtDate(nowIso);

    const { loads, events } = buildDemoSnapshot();
    expect(header).toBe('23.09.2026');
    const chart = mount(createElement(DeliveryProgress, { loads, locale: 'pl' }));
    expect(chart.textContent).toContain(`dziś ${header}`);
    act(() => { root?.unmount(); });
    host?.remove();

    const on = loads.find((l) => l.code === 'T-01');
    expect(on && trackingPhase(on, nowIso)).toBe('on');
    const bar = mount(createElement(TrackingBar, { load: on!, events: events.filter((e) => e.loadId === on!.id), locale: 'pl', nowIso }));
    const txt = bar.textContent ?? '';
    expect(txt).toContain('ostatnia pozycja');
    /* ostatnia pozycja demo jest kilka minut przed zegarem — nie „37 d temu” */
    expect(txt).toMatch(/ostatnia pozycja \d+ min temu/);
  });

  it('?now= z URL ma pierwszeństwo — nagłówek i „dziś” wykresu idą za nim', async () => {
    window.history.replaceState(null, '', '/#/?now=2026-10-14T10:00:00Z');
    try {
      resetFrozenNowCache();
      expect(fmtDate(getNow().toISOString())).toBe('14.10.2026');
      const chart = mount(createElement(DeliveryProgress, { loads: buildSeedLoads(), locale: 'pl' }));
      expect(chart.textContent).toContain('dziś 14.10.2026');
    } finally {
      window.history.replaceState(null, '', '/');
      resetFrozenNowCache();
    }
  });

  it('produkcja (VITE_AUTH_MODE=supabase): czas rzeczywisty, bez zegara demo', async () => {
    vi.stubEnv('VITE_AUTH_MODE', 'supabase');
    vi.resetModules();
    const m = await import('../src/lib/frozenNow');
    m.resetFrozenNowCache();
    expect(m.isFrozenNow()).toBe(false);
    const before = Date.now();
    const ms = m.getNowMs();
    expect(ms).toBeGreaterThanOrEqual(before);
    expect(ms - Date.now()).toBeLessThanOrEqual(5);
    expect(Math.abs(m.getNow().getTime() - Date.now())).toBeLessThan(1000);
    vi.unstubAllEnvs();
    vi.resetModules();
  });
});
