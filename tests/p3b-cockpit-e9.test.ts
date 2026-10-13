/**
 * wyglad/P3-b — Kokpit każdej firmy i liczby w menu według E9 (decyzja 07.10 19:11, img/e9-after).
 * Kafelki: kolejność i treść dla HHL, KSH i SCX; „Do zrobienia” = liczba przy „Ryzyka” w menu;
 * „Faktury” w menu = faktury czekające na moje działanie + transporty gotowe do mojej faktury (bez zastępczego „1”).
 */
import { describe, expect, it } from 'vitest';
import { addDays, buildCockpit, dayKey, invoiceTodoCount, invoicedSets, todoQueue, type CockpitInput } from '../src/lib/cockpitE9';
import type { Bill, Document, Invoice, Load, Risk } from '../src/types';

const NOW = '2026-10-07T16:00:00Z'; // 07.10, 18:00 w Warszawie

const load = (id: string, p: Partial<Load>): Load =>
  ({ id, code: id, stage: 'PLAN', status: 'PLANNED', qty: 1, dims: { weightT: 10 }, plannedLoadDate: '2026-10-09', plannedDeliverDate: '2026-10-14', ...p }) as unknown as Load;
const doc = (loadId: string, category: Document['category']): Document =>
  ({ id: `${loadId}-${category}`, loadId, category, status: 'UPLOADED' }) as unknown as Document;

const LOADS: Load[] = [
  load('SG-01', { stage: 'DELIVERED', status: 'DELIVERED', qty: 7, dims: { weightT: 20.7 } as Load['dims'], plannedDeliverDate: '2026-10-05', unloadedAt: '2026-10-06T08:00:00Z' }),
  load('SG-02', { stage: 'DELIVERED', status: 'DELIVERED', plannedDeliverDate: '2026-10-06', unloadedAt: '2026-10-06T10:00:00Z' }),
  load('SG-03', { stage: 'SITE', status: 'IN_TRANSIT', plannedDeliverDate: '2026-10-08' }),
  load('SG-04', { stage: 'PLAN', status: 'RESOURCES_PENDING', plannedLoadDate: '2026-10-05' }),
  load('SG-05', { stage: 'PLAN', status: 'DOC_MISSING', plannedLoadDate: '2026-10-08', plannedDeliverDate: '2026-10-10' }),
  load('SG-06', { stage: 'PLAN', status: 'READY', plannedLoadDate: '2026-10-12' }),
];
const DOCS: Document[] = [doc('SG-02', 'CMR'), doc('SG-05', 'PERMIT_PL'), doc('SG-05', 'PERMIT_SE'), doc('SG-06', 'PERMIT_PL')];
const RISKS = [
  { title: 'Brak zezwolenia', loadId: 'SG-04' },
  { title: 'Awizacja po terminie', loadId: 'SG-04' },
  { title: 'SEFS: brak źródła indeksu' },
  { title: 'Nieznany kod źródła drogowego X' },
] as Pick<Risk, 'title' | 'loadId'>[];

function input(role: CockpitInput['role'], extra: Partial<CockpitInput> = {}): CockpitInput {
  return {
    role, locale: 'pl', nowIso: NOW, loads: LOADS, documents: DOCS, bills: [], invoicedLoadIds: new Set(), billedLoadIds: new Set(),
    todo: todoQueue(role, RISKS as Risk[], LOADS) ?? { total: 0, loads: 0, other: 0 },
    ferry: { vessel: 'Wawel', route: 'GDN → NYN', depIso: '2026-10-08T16:00:00Z', sea: { waveM: 1.3, risk: 'niskie' } },
    margin: { pct: 0.048, moneyText: '144 392,63 PLN', tierText: 'prognoza' },
    ...extra,
  };
}

describe('E9 — „Do zrobienia” i liczby w menu', () => {
  it('HHL: otwarte sprawy bez komunikatów technicznych; podział na transporty i sprawy bez transportu', () => {
    expect(todoQueue('HHL', RISKS as Risk[], LOADS)).toEqual({ total: 3, loads: 1, other: 1 });
  });
  it('SCX: transporty czekające na awizację lub dokumenty; KSH bez listy (null)', () => {
    expect(todoQueue('SCX', [], LOADS)).toEqual({ total: 2, loads: 2, other: 0 });
    expect(todoQueue('KSH', RISKS as Risk[], LOADS)).toBeNull();
  });
  it('Faktury w menu: KSH do sprawdzenia; HHL faktury SCX + gotowe do faktury dla KSH; SCX sporne + gotowe do swojej faktury; 0 = brak liczby', () => {
    const bills = [{ recipient: 'KSH', verification: 'DO_WERYFIKACJI', lines: [] }] as unknown as Bill[];
    expect(invoiceTodoCount('KSH', { loads: LOADS, documents: DOCS, bills, invoices: [] })).toBe(1);
    const inv = [{ status: 'SUBMITTED', lines: [] }, { status: 'DISPUTED', lines: [{ loadId: 'SG-02' }] }] as unknown as Invoice[];
    // HHL: 1 faktura SCX do sprawdzenia + SG-02 (CMR, bez faktury dla KSH)
    expect(invoiceTodoCount('HHL', { loads: LOADS, documents: DOCS, bills: [], invoices: inv })).toBe(2);
    // SCX: 1 sporna; SG-02 jest już na fakturze SCX
    expect(invoiceTodoCount('SCX', { loads: LOADS, documents: DOCS, bills: [], invoices: inv })).toBe(1);
    expect(invoiceTodoCount('SCX', { loads: LOADS, documents: [], bills: [], invoices: [] })).toBe(0);
  });
  it('invoicedSets: transporty z faktur SCX i z faktur HHL osobno', () => {
    const s = invoicedSets([{ lines: [{ loadId: 'A' }] }] as Invoice[], [{ lines: [{ loadId: 'B' }] }] as unknown as Bill[]);
    expect([...s.invoicedLoadIds]).toEqual(['A']);
    expect([...s.billedLoadIds]).toEqual(['B']);
  });
});

describe('E9 — kafelki Kokpitu (img/e9-after)', () => {
  it('HHL: kolejność, „Strona ›”, liczby z danych', () => {
    const tiles = buildCockpit(input('HHL'));
    expect(tiles.map((x) => x.id)).toEqual(['in-transit', 'todo', 'loads7', 'permits7', 'delivered', 'margin']);
    expect(tiles.map((x) => x.go)).toEqual(['map', 'risk', 'sched', 'docs', 'inv', 'fin']);
    const by = Object.fromEntries(tiles.map((x) => [x.id, x]));
    expect(by['in-transit'].value).toBe('1');
    expect(by['in-transit'].desc).toBe('na placu w Boden: SG-03');
    expect(by.todo.value).toBe('3');
    expect(by.todo.tone).toBe('alert');
    expect(by.todo.desc).toBe('1 transport · 1 inna sprawa');
    // załadunki 07.10–13.10 bez wyjazdu: SG-05, SG-06; po terminie: SG-04
    expect(by.loads7.value).toBe('2');
    expect(by.loads7.desc).toBe('1 po dacie załadunku bez wyjazdu');
    expect(by.loads7.descShort).toBe('1 po terminie');
    expect(by.permits7.value).toBe('1');
    expect(by.permits7.of).toBe('z 2');
    expect(by.permits7.tone).toBe('warn');
    expect(by.delivered.desc).toBe('SG-01 czeka na podpisany CMR · 1 gotowy do faktury');
    expect(by.margin.label).toBe('Marża (prognoza)');
    expect(by.margin.value).toBe('4,8');
    expect(by.margin.of).toBe('%');
    expect(by.margin.money).toBe(true);
  });
  it('KSH: bez „Do zrobienia” i bez marży; elementy i tony; plan 72 h; terminowość; prom; faktury', () => {
    const tiles = buildCockpit(input('KSH'));
    expect(tiles.map((x) => x.id)).toEqual(['delivered', 'in-transit', 'plan72', 'otif', 'ferry', 'bills']);
    expect(tiles.some((x) => x.money)).toBe(false);
    const by = Object.fromEntries(tiles.map((x) => [x.id, x]));
    expect(by.delivered.value).toBe('2');
    expect(by.delivered.of).toBe('z 6');
    expect(by.delivered.desc).toBe('8 elementów · 30,7 t (SG-01, SG-02)');
    expect(by.delivered.descShort).toBe('8 elem. · 30,7 t');
    expect(by['in-transit'].desc).toBe('SG-03 na placu w Boden');
    expect(by.plan72.value).toBe('2');
    expect(by.plan72.desc).toBe('1 w drodze · 1 jeszcze nie wyjechało');
    // ostatnia dostawa: SG-02 w terminie, SG-01 dzień po planie → 1 z 2
    expect(by.otif.value).toBe('1');
    expect(by.otif.of).toBe('z 2');
    expect(by.ferry.value).toBe('08.10, 18:00');
    expect(by.ferry.valueShort).toBe('08.10 18:00');
    expect(by.ferry.desc).toBe('Wawel GDN → NYN · fala 1,3 m · ryzyko niskie');
    expect(by.ferry.descShort).toBe('fala 1,3 m · niskie');
    expect(by.bills.desc).toBe('brak faktur HHL w systemie');
  });
  it('SCX: Do zrobienia, zezwolenia przy załadunkach, do zafakturowania z tygodniem; prom bez prognozy = brak źródła', () => {
    const tiles = buildCockpit(input('SCX', { ferry: { vessel: 'Wawel', route: 'GDN → NYN', depIso: '2026-10-08T16:00:00Z', sea: null } }));
    expect(tiles.map((x) => x.id)).toEqual(['todo', 'in-transit', 'loads7', 'to-invoice', 'ferry', 'otif']);
    const by = Object.fromEntries(tiles.map((x) => [x.id, x]));
    expect(by.todo.value).toBe('2');
    expect(by.loads7.desc).toBe('zezwolenia 1 z 2 · 1 po dacie załadunku');
    expect(by['to-invoice'].value).toBe('1');
    expect(by['to-invoice'].desc).toBe('1 czeka na podpisany CMR (SG-01) · tydz. 41');
    expect(by.ferry.desc).toBe('Wawel GDN → NYN · prognoza morza: brak źródła danych');
  });
  it('źródła dopinane później: porywy u SCX (B7) i godzina wjazdu na plac u KSH', () => {
    const sea = { waveM: 1.3, risk: 'niskie', gustKn: 23.3 };
    const scx = buildCockpit(input('SCX', { ferry: { vessel: 'Wawel', route: 'GDN → NYN', depIso: '2026-10-08T16:00:00Z', sea } }));
    expect(scx.find((x) => x.id === 'ferry')!.desc).toBe('Wawel GDN → NYN · fala 1,3 m, porywy 23 kn · ryzyko niskie');
    const ksh = buildCockpit(input('KSH', { ferry: { vessel: 'Wawel', route: 'GDN → NYN', depIso: '2026-10-08T16:00:00Z', sea }, siteSince: new Map([['SG-03', '2026-10-07T06:35:00Z']]) }));
    expect(ksh.find((x) => x.id === 'ferry')!.desc).toBe('Wawel GDN → NYN · fala 1,3 m · ryzyko niskie');
    expect(ksh.find((x) => x.id === 'in-transit')!.desc).toBe('SG-03 na placu w Boden od 08:35');
  });
  it('dzień kalendarza w Warszawie i dodawanie dni', () => {
    expect(dayKey('2026-10-07T22:30:00Z')).toBe('2026-10-08');
    expect(dayKey('2026-10-07')).toBe('2026-10-07');
    expect(dayKey(null)).toBeNull();
    expect(addDays('2026-10-30', 3)).toBe('2026-11-02');
  });
});
