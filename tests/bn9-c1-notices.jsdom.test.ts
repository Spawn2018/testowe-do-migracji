/**
 * @vitest-environment jsdom
 * BN9-c1 — formularz ręcznego komunikatu armatora i historia komunikatów.
 * DP-86: filtr armatora (`noticeSailingsFor`) na > 40 rejsach bałtyckich: GDN-NYN, GDY-KAA, TLL-HEL i TLLA-HEL
 *        (Viking Line i Eckerö Line na wspólnej trasie Tallinn A → Helsinki).
 * DP-87: lista bez rejsów z przeszłości.
 * DP-104: „automatyczny” / „ręczny” i link do źródła tylko https (nowa karta, noopener noreferrer).
 * Dane wymyślone (G-09).
 */
import { afterEach, describe, expect, it } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { Sailing } from '../src/types';
import { NOTICE_SAILINGS_MAX, noticeSailingsFor, noticeSourceHref, noticeSourcePl } from '../src/lib/operatorNotices';
import { NoticeHistory, type NoticeRow } from '../src/components/OperatorNoticeForm';

const NOW = Date.parse('2026-11-02T12:00:00Z');
const H = 3600_000;

function sailing(id: string, route: string, source: Sailing['source'], depMs: number, extra: Partial<Sailing> = {}): Sailing {
  return {
    id,
    vessel: `Statek ${id}`,
    route: route as Sailing['route'],
    departureAt: new Date(depMs).toISOString(),
    arrivalAt: new Date(depMs + 3 * H).toISOString(),
    delayedDepartureAt: null,
    delayedArrivalAt: null,
    status: 'ZAPLANOWANY',
    source,
    ...extra,
  };
}

/** 6 doby × 4 trasy × 2 rejsy + rejsy z przeszłości; Viking i Eckerö na zmianę na TLLA-HEL. */
function baltic(): Sailing[] {
  const out: Sailing[] = [];
  for (let d = 0; d < 6; d++) {
    for (let k = 0; k < 2; k++) {
      const t = NOW + (d * 24 + k * 6 + 1) * H;
      out.push(sailing(`pf-${d}-${k}`, 'GDN-NYN', 'POLFERRIES', t, { operator: 'Polferries' }));
      out.push(sailing(`st-${d}-${k}`, 'GDY-KAA', 'STENA', t + H, { operator: 'Stena Line' }));
      out.push(sailing(`vk-${d}-${k}`, 'TLLA-HEL', 'VIKING', t + 2 * H, { operator: 'Viking Line' }));
      out.push(sailing(`ek-${d}-${k}`, 'TLLA-HEL', 'ECKERO', t + 3 * H, { operator: 'Eckerö Line' }));
      out.push(sailing(`tk-${d}-${k}`, 'TLL-HEL', 'TALLINK', t + 4 * H, { operator: 'Tallink Silja' }));
    }
  }
  /* ręczne rejsy z nazwą armatora w `operator` (źródło RECZNIE) */
  out.push(sailing('vk-reczny', 'TLLA-HEL', 'RECZNIE', NOW + 30 * H, { operator: 'Viking Line' }));
  out.push(sailing('ek-reczny', 'TLLA-HEL', 'RECZNIE', NOW + 31 * H, { operator: 'Eckerö Line' }));
  /* przeszłość (DP-87) */
  out.push(sailing('vk-wczoraj', 'TLLA-HEL', 'VIKING', NOW - 20 * H, { operator: 'Viking Line' }));
  out.push(sailing('pf-rano', 'GDN-NYN', 'POLFERRIES', NOW - 2 * H, { operator: 'Polferries' }));
  out.push(sailing('ek-minuta', 'TLLA-HEL', 'ECKERO', NOW - 60_000, { operator: 'Eckerö Line' }));
  /* kolejność wejściowa odwrócona — funkcja musi sama posortować */
  return out.reverse();
}

describe('DP-86 · noticeSailingsFor — filtr armatora', () => {
  const all = baltic();

  it('zestaw testowy ma ponad 40 rejsów bałtyckich', () => {
    expect(all.length).toBeGreaterThan(40);
  });

  it('Viking Line: tylko rejsy Vikinga z TLLA-HEL, bez Eckerö na tej samej trasie i bez Tallinka', () => {
    const v = noticeSailingsFor(all, 'VIKING', NOW);
    expect(v.map((s) => s.id).sort()).toEqual([...Array.from({ length: 12 }, (_, i) => `vk-${Math.floor(i / 2)}-${i % 2}`), 'vk-reczny'].sort());
    expect(v.every((s) => s.route === 'TLLA-HEL')).toBe(true);
  });

  it('Eckerö Line: tylko rejsy Eckerö z TLLA-HEL, bez Vikinga', () => {
    const e = noticeSailingsFor(all, 'ECKERO', NOW);
    expect(e).toHaveLength(13);
    expect(e.some((s) => s.id.startsWith('vk-'))).toBe(false);
    expect(e.map((s) => s.id)).toContain('ek-reczny');
  });

  it('Polferries — tylko GDN-NYN; Stena — tylko GDY-KAA; Tallink — tylko TLL-HEL', () => {
    expect(new Set(noticeSailingsFor(all, 'POLFERRIES', NOW).map((s) => s.route))).toEqual(new Set(['GDN-NYN']));
    expect(new Set(noticeSailingsFor(all, 'STENA', NOW).map((s) => s.route))).toEqual(new Set(['GDY-KAA']));
    expect(new Set(noticeSailingsFor(all, 'TALLINK', NOW).map((s) => s.route))).toEqual(new Set(['TLL-HEL']));
    expect(noticeSailingsFor(all, 'DFDS', NOW)).toEqual([]);
  });

  it('kolejność od najbliższego odejścia i limit 40 rejsów', () => {
    const many = Array.from({ length: 55 }, (_, i) => sailing(`v${i}`, 'TLLA-HEL', 'VIKING', NOW + (55 - i) * H));
    const v = noticeSailingsFor(many, 'VIKING', NOW);
    expect(v).toHaveLength(NOTICE_SAILINGS_MAX);
    const deps = v.map((s) => Date.parse(s.departureAt));
    expect(deps).toEqual([...deps].sort((a, b) => a - b));
    expect(v[0].id).toBe('v54');
  });

  it('bez armatora — pusta lista', () => {
    expect(noticeSailingsFor(all, '', NOW)).toEqual([]);
    expect(noticeSailingsFor(all, null, NOW)).toEqual([]);
  });
});

describe('DP-87 · bez rejsów z przeszłości', () => {
  it('rejs, który odszedł (także minutę temu), nie jest na liście', () => {
    const ids = [...noticeSailingsFor(baltic(), 'VIKING', NOW), ...noticeSailingsFor(baltic(), 'ECKERO', NOW), ...noticeSailingsFor(baltic(), 'POLFERRIES', NOW)]
      .map((s) => s.id);
    expect(ids).not.toContain('vk-wczoraj');
    expect(ids).not.toContain('pf-rano');
    expect(ids).not.toContain('ek-minuta');
  });

  it('opóźniony rejs liczy się od nowej godziny odejścia', () => {
    const late = sailing('opoz', 'GDN-NYN', 'POLFERRIES', NOW - 2 * H, { delayedDepartureAt: new Date(NOW + H).toISOString(), status: 'OPOZNIONY' });
    const gone = sailing('opoz-wyplynal', 'GDN-NYN', 'POLFERRIES', NOW - 5 * H, { delayedDepartureAt: new Date(NOW - H).toISOString(), status: 'OPOZNIONY' });
    expect(noticeSailingsFor([late, gone], 'POLFERRIES', NOW).map((s) => s.id)).toEqual(['opoz']);
  });

  it('rejs dokładnie „teraz” zostaje (granica)', () => {
    expect(noticeSailingsFor([sailing('teraz', 'GDN-NYN', 'POLFERRIES', NOW)], 'POLFERRIES', NOW)).toHaveLength(1);
  });
});

describe('DP-104 · źródło komunikatu', () => {
  it('etykiety: AUTO → automatyczny, RECZNIE i brak → ręczny', () => {
    expect(noticeSourcePl('AUTO')).toBe('automatyczny');
    expect(noticeSourcePl('RECZNIE')).toBe('ręczny');
    expect(noticeSourcePl(null)).toBe('ręczny');
  });

  it('link tylko dla https', () => {
    expect(noticeSourceHref('https://example.com/komunikat?id=1')).toBe('https://example.com/komunikat?id=1');
    expect(noticeSourceHref('http://example.com/x')).toBeNull();
    expect(noticeSourceHref('javascript:alert(1)')).toBeNull();
    expect(noticeSourceHref('//example.com/x')).toBeNull();
    expect(noticeSourceHref('nie adres')).toBeNull();
    expect(noticeSourceHref('')).toBeNull();
    expect(noticeSourceHref(null)).toBeNull();
  });

  let host: HTMLDivElement;
  let root: Root;
  afterEach(() => { act(() => { root?.unmount(); }); host?.remove(); });

  it('historia: oznaczenie i link w nowej karcie z rel="noopener noreferrer"; bez linku dla ręcznego i dla http', async () => {
    const rows: NoticeRow[] = [
      { id: 'n1', sailing_id: 's1', operator: 'TALLINK', kind: 'ODWOLANY', new_departure: null, note: 'Odwołany przez armatora', created_at: '2026-11-01T08:00:00Z', source: 'AUTO', source_url: 'https://example.com/alert' },
      { id: 'n2', sailing_id: 's2', operator: 'VIKING', kind: 'OPOZNIONY', new_departure: '2026-11-01T10:00:00Z', note: null, created_at: '2026-11-01T07:00:00Z', source: 'RECZNIE', source_url: null },
      { id: 'n3', sailing_id: 's3', operator: 'DFDS', kind: 'ODWOLANY', new_departure: null, note: null, created_at: '2026-11-01T06:00:00Z', source: 'AUTO', source_url: 'http://example.com/niebezpieczny' },
    ];
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => { root.render(createElement(NoticeHistory, { rows })); });
    const r1 = host.querySelector('[data-notice-row="n1"]')!;
    expect(r1.querySelector('[data-notice-source]')?.getAttribute('data-notice-source')).toBe('AUTO');
    expect(r1.textContent).toContain('automatyczny');
    const a = r1.querySelector('a[data-notice-link]') as HTMLAnchorElement;
    expect(a.href).toBe('https://example.com/alert');
    expect(a.target).toBe('_blank');
    expect(a.rel).toBe('noopener noreferrer');
    const r2 = host.querySelector('[data-notice-row="n2"]')!;
    expect(r2.textContent).toContain('ręczny');
    expect(r2.querySelector('a')).toBeNull();
    const r3 = host.querySelector('[data-notice-row="n3"]')!;
    expect(r3.textContent).toContain('automatyczny');
    expect(r3.querySelector('a')).toBeNull();
  });

  it('pusta historia — nic', async () => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => { root.render(createElement(NoticeHistory, { rows: [] })); });
    expect(host.querySelector('[data-notice-history]')).toBeNull();
  });
});
