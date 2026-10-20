/**
 * D-20261020-1118-01 (właściciel 20.10.2026, 11:18): zezwolenie „Firma” albo „Trasa” według tabeli symboli,
 * piloci tylko przy KR i PL-B, kolumna Dokumenty w Harmonogramie bez „–” przy braku bez terminu.
 * Dane zmyślone (G-17).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { firmPermitFor, withoutRoutePermits } from '../src/lib/permitKind';
import { docCell } from '../src/lib/schedLayout';
import { demoSymbolSpec } from '../src/lib/p7SymbolsDemo';
import type { PermitView } from '../src/lib/p5Source';
import type { Load } from '../src/types';

const OWNER = {
  firma: ['BS-A', 'BS-B', 'BS-C', 'PL-A', 'PL-B', 'SG', 'SS', 'T', 'TS'],
  trasa: ['KR'],
  pilots: ['KR', 'PL-B'],
  noPilots: ['BS-A', 'BS-B', 'BS-C', 'PL-A', 'SG', 'SS', 'T', 'TS'],
};

describe('tabela symboli — zgodna z decyzją właściciela 11:18', () => {
  const spec = (sym: string) => {
    const code = sym === 'KR' ? 'KR-01' : sym === 'PL-A' ? 'PL-01' : sym === 'PL-B' ? 'PL-02' : `${sym}-01`;
    const widthM = sym === 'PL-B' ? 3.4 : 2.45;
    return demoSymbolSpec({ code, dims: { lengthM: 18, widthM, heightM: 2.4, weightT: 20 } } as Pick<Load, 'code' | 'dims'>);
  };
  it('Firma / Trasa', () => {
    for (const s of OWNER.firma) expect(spec(s)?.permit, s).toBe('FIRMA');
    for (const s of OWNER.trasa) expect(spec(s)?.permit, s).toBe('TRASA');
  });
  it('piloci PL i SE tylko KR i PL-B', () => {
    for (const s of OWNER.pilots) expect(spec(s)?.pilots, s).toBe(true);
    for (const s of OWNER.noPilots) expect(spec(s)?.pilots, s).toBe(false);
  });
});

describe('zezwolenie firmowe — jedno, podpięte samo', () => {
  const P = (over: Partial<PermitView>): PermitView => ({
    id: 'p', scope: 'FIRMA', country: 'PL', number: '13/GD/2026', validFrom: '2026-01-25', validTo: '2028-01-25',
    limits: { l: 23, w: 3.4, h: 4.3 }, pilot: null, appliesTo: 'Firma', loads: 92, ...over,
  });
  it('ważne w dniu załadunku', () => {
    expect(firmPermitFor({ plannedLoadDate: '2026-10-16' }, [P({})])?.number).toBe('13/GD/2026');
    expect(firmPermitFor({ plannedLoadDate: '2028-02-01' }, [P({})])).toBeNull();
    expect(firmPermitFor({ plannedLoadDate: '2026-10-16' }, [P({ scope: 'TRASA' })])).toBeNull();
    expect(firmPermitFor({ plannedLoadDate: '2026-10-16' }, null)).toBeNull();
  });
  it('najdłużej ważne pierwsze', () => {
    const a = P({ id: 'a', number: 'A', validTo: '2026-12-31' });
    const b = P({ id: 'b', number: 'B', validTo: '2027-06-30' });
    expect(firmPermitFor({ plannedLoadDate: '2026-10-16' }, [a, b])?.number).toBe('B');
  });
  it('bez wierszy „zezwolenie PL / SE” przy Firmie; przy Trasie bez zmian', () => {
    const rows = [{ category: 'PERMIT_PL' as const }, { category: 'PERMIT_SE' as const }, { category: 'CMR' as const }];
    expect(withoutRoutePermits(rows, true).map((r) => r.category)).toEqual(['CMR']);
    expect(withoutRoutePermits(rows, false)).toHaveLength(3);
  });
});

describe('Harmonogram › Dokumenty (E31)', () => {
  const reqs = [{ category: 'PERMIT_PL' as const, required: true, responsible: 'CARRIER' as const, anchor: 'BEFORE_LOAD' as const, offsetHours: 48 }];
  it('brak bez terminu — „brak: …”, nie „–”', () => {
    const c = docCell([{ loadId: 'L', category: 'PERMIT_PL', dueAt: null, state: 'MISSING' }, { loadId: 'L', category: 'PERMIT_SE', dueAt: null, state: 'MISSING' }], reqs);
    expect(c).toEqual({ tone: 'due', keys: ['s7_d_PERMIT_PL', 's7_d_PERMIT_SE'], due: null });
  });
  it('dotychczasowe stany bez zmian', () => {
    expect(docCell([], reqs)).toEqual({ tone: 'none' });
    expect(docCell([{ loadId: 'L', category: 'CMR', dueAt: '2026-10-01T10:00:00Z', state: 'OK' }], reqs)).toEqual({ tone: 'ok' });
    expect(docCell([{ loadId: 'L', category: 'PERMIT_PL', dueAt: '2026-10-21T10:00:00Z', state: 'MISSING' }], reqs).tone).toBe('due');
    expect(docCell([{ loadId: 'L', category: 'CMR', dueAt: '2026-10-01T10:00:00Z', state: 'OVERDUE' }], reqs).tone).toBe('bad');
  });
});

describe('produkcja — tabela symboli i piloci z bazy', () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });
  it('symbol transportu → wiersz tabeli; rodzaj zezwolenia z loads.permit_kind; piloci z load_escorts', async () => {
    vi.stubEnv('VITE_AUTH_MODE', 'supabase');
    const m = await import('../src/lib/p7Source');
    m.setSymbolSpecsFromServer([
      { symbol: 'SG', position_name: 'Słupy główne', combo_length_m: '21.69', combo_width_m: '2.45', combo_height_m: '3.75', pilot: 'BRAK', permit_kind: 'FIRMA' },
      { symbol: 'KR', position_name: 'Kratownice', combo_length_m: '23.69', combo_width_m: '3.52', combo_height_m: '3.90', pilot: 'PL_SE', permit_kind: 'TRASA' },
    ]);
    const sg = { id: 'l1', code: 'SG-18', symbol: 'SG', permitKind: 'FIRMA' } as Load;
    const kr = { id: 'l2', code: 'KR-03', symbol: 'KR', permitKind: 'TRASA' } as Load;
    expect(m.symbolSpecOf(sg)).toMatchObject({ symbol: 'SG', permit: 'FIRMA', pilots: false, set: { l: 21.69, w: 2.45, h: 3.75 } });
    expect(m.symbolSpecOf(kr)).toMatchObject({ permit: 'TRASA', pilots: true });
    expect(m.symbolSpecOf({ id: 'x', code: 'R-01', symbol: null } as Load)).toBeNull();
    m.setPilotsFromServer([{ loadId: 'l2', scope: 'PL', plate: 'WX 00001', name: 'Jan Testowy' }, { loadId: 'l2', scope: 'SE', plate: 'ABC 001', name: null }]);
    expect(m.pilotsOf(kr)).toEqual({ pl: { plate: 'WX 00001', name: 'Jan Testowy' }, se: { plate: 'ABC 001', name: null } });
    expect(m.pilotsOf(sg)).toEqual({ pl: { plate: null, name: null }, se: { plate: null, name: null } });
    /* zapis pilotów dopiero po `awiz_pilots_set` w bazie (#353) — flaga wykonawcy */
    expect(m.savePilotsOf()).toBeNull();
  });
});

describe('ekran — źródła', () => {
  it('Dokumenty: Firma — jeden wiersz, bez sekcji „Zezwolenia transportu”', () => {
    const s = readFileSync('src/components/drawer/PanelDocs.tsx', 'utf8');
    expect(s).toMatch(/data-pd-req="PERMIT_FIRM"/);
    expect(s).toMatch(/\{firm \? null : permitForm\}/);
  });
  it('Przegląd: „Plan i ETA” zwijane, ramka ETA poza zwijaniem; mapa 340 / 300 px', () => {
    const s = readFileSync('src/components/drawer/PanelOverview.tsx', 'utf8');
    const plan = s.slice(s.indexOf('<details className="po-sec po-fold" data-po="plan">'), s.indexOf('data-po="eta"'));
    expect(plan).toContain('</details>');
    expect(plan).not.toContain('<EtaBlock');
    expect(plan).not.toMatch(/<details[^>]*open/);
    const css = readFileSync('src/components/drawer/p7.css', 'utf8');
    expect(css).toMatch(/\.po-map\{position:relative;height:340px\}/);
    expect(css).toMatch(/\.po-map\.is-phone\{height:300px\}/);
  });
  it('Status: „Przygotowanie” i „Rozliczenie” zwinięte domyślnie', () => {
    const s = readFileSync('src/components/drawer/StatusAxisTab.tsx', 'utf8');
    expect(s).toMatch(/useState<\{ prep: boolean; after: boolean \}>\(\{ prep: false, after: false \}\)/);
  });
});

describe('Status — zwinięte sekcje pokazują bieżący status sekcji', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { createElement } = await import('react');
  const { StatusAxisTab } = await import('../src/components/drawer/StatusAxisTab');
  const ev = (type: string, at: string, payload: Record<string, unknown> = {}) => ({ id: `${type}-${at}`, loadId: 'L1', type, at, actor: 'system', payload });
  const load = (status: string) => ({
    id: 'L1', status, stage: 'PLAN', unloadedAt: null, resources: { trailerPlate: null }, plannedLoadDate: '2026-10-21', plannedDeliverDate: '2026-10-26',
  }) as never;
  const html = (status: string, events: ReturnType<typeof ev>[]) =>
    renderToStaticMarkup(createElement(StatusAxisTab, { load: load(status), events, geofences: [], locale: 'pl', phone: false, canStatus: false, onChange: () => {} }));
  const rows = (h: string, g: string) => {
    const sec = new RegExp(`<section[^>]*data-axis-group="${g}"[\\s\\S]*?</section>`).exec(h)?.[0] ?? '';
    return [...sec.matchAll(/data-axis-row="([^"]+)"/g)].map((m) => m[1]);
  };
  it('w Przygotowaniu: tylko bieżący; Rozliczenie: pierwszy oczekujący; W trasie — wszystkie', () => {
    const h = html('RESOURCES_PENDING', [ev('SCHEDULE_IMPORTED', '2026-10-01T10:00:00Z'), ev('STATUS_AUTO', '2026-10-18T08:00:00Z', { from: 'PLANNED', to: 'RESOURCES_PENDING', source: 'DATA' })]);
    expect(rows(h, 'prep')).toEqual(['RESOURCES_PENDING']);
    expect(rows(h, 'after')).toEqual(['READY_TO_INVOICE']);
    expect(rows(h, 'route').length).toBeGreaterThan(5);
    expect(h).toMatch(/data-axis-group="prep" data-axis-open="false"/);
    expect(h).toContain('rozwiń ▾');
  });
  it('po Przygotowaniu: ostatni osiągnięty status sekcji', () => {
    const h = html('IN_TRANSIT_PL', [ev('SCHEDULE_IMPORTED', '2026-10-01T10:00:00Z'), ev('STATUS_READY', '2026-10-19T08:00:00Z'), ev('STATUS_AUTO', '2026-10-21T08:00:00Z', { from: 'READY', to: 'IN_TRANSIT_PL', source: 'GPS' })]);
    expect(rows(h, 'prep')).toEqual(['READY']);
  });
});

describe('Historia — zapis pilotów (#357)', () => {
  it('PILOTS_SET: kategoria Zasoby, polski nagłówek', async () => {
    const { histCat, histRow } = await import('../src/lib/p6History');
    expect(histCat('PILOTS_SET')).toBe('ZASOBY');
    const r = histRow({ id: 'ev-1', loadId: 'L', type: 'PILOTS_SET', at: '2026-10-20T10:00:00Z', actor: 'Jan Testowy // SCX', payload: { pl: { plate: 'WX 00001', kontakt: true } } }, 'pl');
    expect(r.head).toBe('Piloci w awizacji zapisani');
  });
});

describe('Harmonogram › Dokumenty przy zezwoleniu firmowym (F7 #355 B1)', () => {
  it('ważne zezwolenie firmowe — „komplet” zamiast „–” przed dostawą; po terminie CMR — „brak”', async () => {
    const { firmDocRows } = await import('../src/lib/permitKind');
    const firm = [{ id: 'p', scope: 'FIRMA' as const, country: 'PL' as const, number: '13/GD/2026', validFrom: '2026-01-25', validTo: '2028-01-25', limits: null, pilot: null, appliesTo: 'Firma', loads: 1 }];
    const L = { id: 'L', plannedLoadDate: '2026-10-21' };
    expect(docCell(firmDocRows([], L, firm), [])).toEqual({ tone: 'ok' });
    expect(docCell(firmDocRows([], L, []), [])).toEqual({ tone: 'none' });
    const cmr = [{ loadId: 'L', category: 'CMR' as const, dueAt: '2026-10-25T10:00:00Z', state: 'OVERDUE' as const }];
    expect(docCell(firmDocRows(cmr, L, firm), []).tone).toBe('bad');
    const pl = [{ loadId: 'L', category: 'PERMIT_PL' as const, dueAt: null, state: 'MISSING' as const }];
    expect(docCell(firmDocRows(pl, L, firm), [])).toEqual({ tone: 'ok' });
  });
});

describe('produkcja — piloci: wpisy PL / SE przed starszymi PL_SE (F7 #360 P5)', () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });
  it('PL_SE nie zajmuje strony, którą ma wpis PL; trafia na wolne SE', async () => {
    vi.stubEnv('VITE_AUTH_MODE', 'supabase');
    const m = await import('../src/lib/p7Source');
    const kr = { id: 'l3', code: 'KR-04', symbol: 'KR', permitKind: 'TRASA' } as Load;
    m.setPilotsFromServer([
      { loadId: 'l3', scope: 'PL_SE', plate: 'GD 11111', name: 'Stary Wpis' },
      { loadId: 'l3', scope: 'PL', plate: 'WX 00002', name: 'Nowy Pilot' },
    ]);
    expect(m.pilotsOf(kr)).toEqual({ pl: { plate: 'WX 00002', name: 'Nowy Pilot' }, se: { plate: 'GD 11111', name: 'Stary Wpis' } });
  });
});
