/**
 * wyglad/P3-b — Kokpit każdej firmy i liczby w menu według E9 (decyzja 07.10 19:11, img/e9-after).
 * Kafelki: kolejność i treść dla HHL, KSH i SCX; „Do zrobienia” = liczba przy „Ryzyka” w menu;
 * „Faktury” w menu = faktury czekające na moje działanie + transporty gotowe do mojej faktury (bez zastępczego „1”).
 */
import { describe, expect, it } from 'vitest';
import { addDays, buildCockpit, dayKey, invoiceTodoCount, loadsBilledBy, todoQueue, todoRisks, viewedKind, type CockpitInput } from '../src/lib/cockpitE9';
import type { Bill, Document, Load, Risk } from '../src/types';

const NOW = '2026-10-07T16:00:00Z'; // 07.10, 18:00 w Warszawie

const load = (id: string, p: Partial<Load>): Load =>
  ({ id, code: id, stage: 'PLAN', status: 'PLANNED', qty: 1, dims: { weightT: 10 }, plannedLoadDate: '2026-10-09', plannedDeliverDate: '2026-10-14', ...p }) as unknown as Load;
/* wyglad/W-naprawy (A4): CMR liczy się po rozładunku (lustro automatu C17) — plik z datą wgrania po rozładunku SG-02 */
const doc = (loadId: string, category: Document['category']): Document =>
  ({ id: `${loadId}-${category}`, loadId, category, status: 'UPLOADED', uploadedAt: '2026-10-06T12:00:00Z' }) as unknown as Document;

/* Statusy jak z produkcji (src/data/mappers.ts): „Rozładowany” (UNLOADED) → UNLOADING / etap SITE,
   „Na placu” (AT_SITE) → APPROACHING_SITE / etap APPROACH; etap DELIVERED w produkcji nie występuje (E25). */
const LOADS: Load[] = [
  load('SG-01', { stage: 'SITE', status: 'UNLOADING', qty: 7, dims: { weightT: 20.7 } as Load['dims'], plannedDeliverDate: '2026-10-05', unloadedAt: '2026-10-06T08:00:00Z' }),
  load('SG-02', { stage: 'SITE', status: 'UNLOADING', plannedDeliverDate: '2026-10-06', unloadedAt: '2026-10-06T10:00:00Z' }),
  load('SG-03', { stage: 'APPROACH', status: 'APPROACHING_SITE', plannedDeliverDate: '2026-10-08' }),
  load('SG-04', { stage: 'PLAN', status: 'RESOURCES_PENDING', plannedLoadDate: '2026-10-05' }),
  load('SG-05', { stage: 'PLAN', status: 'DOC_MISSING', plannedLoadDate: '2026-10-08', plannedDeliverDate: '2026-10-10' }),
  load('SG-06', { stage: 'PLAN', status: 'READY', plannedLoadDate: '2026-10-12' }),
];
const DOCS: Document[] = [doc('SG-02', 'CMR'), doc('SG-05', 'PERMIT_PL'), doc('SG-05', 'PERMIT_SE'), doc('SG-06', 'PERMIT_PL')];
const RISKS = [
  { title: 'Brak zezwolenia', loadId: 'SG-04', owner: 'SCX' },
  { title: 'Awizacja po terminie', loadId: 'SG-04', owner: 'HHL' },
  { title: 'SEFS: brak źródła indeksu', owner: 'HHL' },
  { title: 'Nieznany kod źródła drogowego X', owner: 'HHL' },
] as Pick<Risk, 'title' | 'loadId' | 'owner'>[];
const bill = (p: Partial<Bill>): Bill => ({ lines: [], ...p }) as unknown as Bill;

function input(role: CockpitInput['role'], extra: Partial<CockpitInput> = {}): CockpitInput {
  return {
    role, locale: 'pl', nowIso: NOW, loads: LOADS, documents: DOCS, bills: [],
    todo: todoQueue(role, RISKS) ?? { total: 0, loads: 0, other: 0 },
    ferry: { vessel: 'Wawel', route: 'GDN → NYN', depIso: '2026-10-08T16:00:00Z', sea: { waveM: 1.3, risk: 'niskie' } },
    margin: { pct: 0.048, moneyText: '144 392,63 PLN', tierText: 'prognoza' },
    ...extra,
  };
}

describe('E9 — „Do zrobienia” i liczby w menu', () => {
  it('HHL Administrator: wszystkie sprawy bez komunikatów technicznych; Operacje: sprawy HHL; podział na transporty i sprawy bez transportu', () => {
    /* wyglad/P6 (E7 pkt 1–2): liczba = karty — SG-04 z dwiema sprawami to jedna karta, SEFS druga */
    expect(todoQueue('HHL', RISKS)).toEqual({ total: 2, loads: 1, other: 1 });
    expect(todoQueue('HHL', RISKS, 'HHL_OPS')).toEqual({ total: 2, loads: 1, other: 1 });
  });
  it('SCX: sprawy SCX; KSH bez listy (null); lista „Najpilniejsze” = te same sprawy', () => {
    expect(todoQueue('SCX', RISKS)).toEqual({ total: 1, loads: 1, other: 0 });
    expect(todoQueue('KSH', RISKS)).toBeNull();
    expect(todoRisks('SCX', RISKS).map((r) => r.title)).toEqual(['Brak zezwolenia']);
    expect(todoRisks('KSH', RISKS)).toEqual([]);
  });
  it('rodzaj konta: z profilu tylko dla własnej firmy; w Podglądzie rodzaj domyślny oglądanej firmy', () => {
    expect(viewedKind('HHL', 'HHL_OPS')).toBe('HHL_OPS');
    expect(viewedKind('KSH', 'HHL_ADMIN')).toBe('CLIENT_USER');
    expect(viewedKind('SCX', 'HHL_OPS')).toBe('CARRIER_DISPATCH');
    expect(viewedKind('SCX', 'CARRIER_USER')).toBe('CARRIER_USER');
    expect(viewedKind('HHL', null)).toBe('HHL_ADMIN');
  });
  it('Faktury w menu (tabela Faktur): KSH do sprawdzenia; HHL faktury SCX do sprawdzenia + gotowe do faktury dla KSH; SCX sporne + gotowe do swojej; 0 = brak liczby', () => {
    const bills = [
      bill({ issuer: 'HHL', recipient: 'KSH', verification: 'DO_WERYFIKACJI' }),
      bill({ id: 'b-scx-41', direction: 'KOSZT', issuer: 'SCX', recipient: 'HHL', verification: 'DO_WERYFIKACJI', lines: [{ loadId: 'SG-02' }] as Bill['lines'] }),
      bill({ issuer: 'SCX', recipient: 'HHL', verification: 'SPORNA' }),
    ];
    /* audyt-C C-10 (E4, E9): „gotowe do mojej faktury” = ta sama funkcja co kafel „Czeka na wystawienie” (`pendingWeeks`):
       transporty rozładowane w zamkniętym tygodniu, bez faktury tej firmy. Tydzień SG-01 / SG-02 (t41) zamyka się 11.10. */
    const open = '2026-10-07';
    const closed = '2026-10-12';
    expect(invoiceTodoCount('KSH', { loads: LOADS, documents: DOCS, bills, today: closed })).toBe(1);
    // HHL, tydzień otwarty: tylko 1 faktura SCX do sprawdzenia
    expect(invoiceTodoCount('HHL', { loads: LOADS, documents: DOCS, bills, today: open })).toBe(1);
    // HHL, tydzień zamknięty: + SG-02 (z CMR, na fakturze SCX, bez faktury HHL dla KSH); SG-01 czeka na CMR (A4)
    expect(invoiceTodoCount('HHL', { loads: LOADS, documents: DOCS, bills, today: closed })).toBe(2);
    // SCX: 1 sporna; SG-01 czeka na CMR (A4), SG-02 jest już na fakturze SCX
    expect(invoiceTodoCount('SCX', { loads: LOADS, documents: DOCS, bills, today: closed })).toBe(1);
    // bez CMR nic nie jest gotowe do faktury (A4)
    expect(invoiceTodoCount('HHL', { loads: LOADS, documents: [], bills, today: closed })).toBe(1);
    expect(invoiceTodoCount('SCX', { loads: LOADS, documents: DOCS, bills: [], today: open })).toBe(0);
    // faktura HHL zakwestionowana przez KSH: odpowiada HHL (wystawca), KSH już nie ma nic do zrobienia
    const disputed = [bill({ issuer: 'HHL', recipient: 'KSH', verification: 'SPORNA' })];
    expect(invoiceTodoCount('HHL', { loads: [], bills: disputed, today: closed })).toBe(1);
    expect(invoiceTodoCount('KSH', { loads: [], bills: disputed, today: closed })).toBe(0);
  });
  it('loadsBilledBy: transporty z faktur danego wystawcy', () => {
    const bills = [bill({ issuer: 'SCX', lines: [{ loadId: 'A' }] as Bill['lines'] }), bill({ issuer: 'HHL', lines: [{ loadId: 'B' }] as Bill['lines'] })];
    expect([...loadsBilledBy(bills, 'SCX')]).toEqual(['A']);
    expect([...loadsBilledBy(bills, 'HHL')]).toEqual(['B']);
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
    /* wyglad/P6 (E7): 1 karta transportu + 1 karta bez transportu */
    expect(by.todo.value).toBe('2');
    expect(by.todo.tone).toBe('alert');
    expect(by.todo.desc).toBe('1 transport · 1 inna sprawa');
    // załadunki 07.10–13.10 bez wyjazdu: SG-05, SG-06; po terminie: SG-04
    expect(by.loads7.value).toBe('2');
    expect(by.loads7.desc).toBe('1 po dacie załadunku bez wyjazdu');
    expect(by.loads7.descShort).toBe('1 po terminie');
    expect(by.permits7.value).toBe('1');
    expect(by.permits7.of).toBe('z 2');
    expect(by.permits7.tone).toBe('warn');
    /* audyt-C C-10: „gotowe do faktury” = transporty z zamkniętego tygodnia (kafel „Czeka na wystawienie”); t41 zamyka się 11.10 */
    expect(by.delivered.desc).toBe('SG-01 czeka na podpisany CMR · 0 gotowych do faktury');
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
    expect(by.plan72.desc).toBe('1 w drodze · 1 jeszcze nie wyjechał');
    expect(by.plan72.descShort).toBe('1 nie wyjechał');
    // ostatnia dostawa: SG-02 w terminie, SG-01 dzień po planie → 1 z 2
    expect(by.otif.value).toBe('1');
    expect(by.otif.of).toBe('z 2');
    expect(by.otif.desc).toBe('SG-02: plan 06.10.2026, dostawa 06.10.2026');
    expect(by.otif.descShort).toBe('SG-02 w terminie');
    expect(by.ferry.value).toBe('08.10.2026, 18:00');
    /* telefon: liczba w jednej linii (E8 pkt 6) — godzina, data z rokiem w opisie */
    expect(by.ferry.valueShort).toBe('18:00');
    expect(by.ferry.desc).toBe('Wawel GDN → NYN · fala 1,3 m · ryzyko niskie');
    expect(by.ferry.descShort).toBe('08.10.2026 · fala 1,3 m · niskie');
    expect(by.bills.desc).toBe('brak faktur HHL w systemie');
  });
  it('SCX: Do zrobienia, zezwolenia przy załadunkach, do zafakturowania z tygodniem dostawy; prom bez prognozy → strona Ryzyka', () => {
    const tiles = buildCockpit(input('SCX', { ferry: { vessel: 'Wawel', route: 'GDN → NYN', depIso: '2026-10-08T16:00:00Z', sea: null } }));
    expect(tiles.map((x) => x.id)).toEqual(['todo', 'in-transit', 'loads7', 'to-invoice', 'ferry', 'otif']);
    const by = Object.fromEntries(tiles.map((x) => [x.id, x]));
    expect(by.todo.value).toBe('1');
    expect(by['in-transit'].desc).toBe('SG-03 na placu w Boden');
    expect(by.loads7.desc).toBe('zezwolenia 1 z 2 · 1 po dacie załadunku');
    /* przegląd 18.10 (P12): liczba = kafel „Czeka na wystawienie” w Fakturach — tydzień t41 jeszcze trwa, więc 0 */
    expect(by['to-invoice'].value).toBe('0');
    expect(by['to-invoice'].desc).toBe('1 czeka na podpisany CMR (SG-01) · t41');
    expect(by['to-invoice'].descShort).toBe('1 czeka na CMR');
    expect(by.ferry.desc).toBe('Wawel GDN → NYN · prognoza morza na stronie Ryzyka');
    expect(by.ferry.valueShort).toBe('18:00');
    expect(by.ferry.descShort).toBe('08.10.2026 · prognoza w Ryzykach');
    // SG-02 już na fakturze SCX → do zafakturowania 0, czeka SG-01
    const billed = buildCockpit(input('SCX', { bills: [bill({ issuer: 'SCX', recipient: 'HHL', lines: [{ loadId: 'SG-02' }] as Bill['lines'] })] }));
    expect(billed.find((x) => x.id === 'to-invoice')!.value).toBe('0');
  });
  it('liczba mnoga i puste stany', () => {
    const late = LOADS.map((l) => (l.id === 'SG-06' ? { ...l, plannedDeliverDate: '2026-10-09' } : l));
    const ksh = buildCockpit(input('KSH', { loads: late }));
    expect(ksh.find((x) => x.id === 'plan72')!.desc).toBe('1 w drodze · 2 jeszcze nie wyjechały');
    const two = buildCockpit(input('SCX', { documents: [] }));
    expect(two.find((x) => x.id === 'to-invoice')!.desc).toBe('2 czekają na podpisany CMR (SG-01, SG-02) · t41');
    const hhl = buildCockpit(input('HHL', { documents: [] }));
    expect(hhl.find((x) => x.id === 'delivered')!.desc).toBe('SG-01, SG-02 czekają na podpisany CMR · 0 gotowych do faktury');
    const none = LOADS.filter((l) => l.status !== 'UNLOADING');
    expect(buildCockpit(input('HHL', { loads: none })).find((x) => x.id === 'delivered')!.desc).toBe('jeszcze bez rozładowanych transportów');
    expect(buildCockpit(input('SCX', { loads: none })).find((x) => x.id === 'to-invoice')!.desc).toBe('nic nie czeka na fakturę · t41');
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
