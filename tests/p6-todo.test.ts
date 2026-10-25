/**
 * wyglad/P6 — „Do zrobienia” (E7) i „Sytuacja na trasie” (E7 pkt 4, PLAN 8.4 / E7-5).
 * Liczba w menu, w Kokpicie i na karcie to te same karty (E7-2); zakazy ruchu bez liczenia (decyzja 07.10 15:55);
 * sytuacje na trasie bez transportu i sprawy techniczne poza listą (E7 pkt 4, 7); jednakowe sprawy razem (E7 pkt 3).
 * Dane zmyślone (G-09). Przykłady demo tylko w demo (strażnik I-0).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Load, Risk, Sailing } from '../src/types';
import { isRouteOnly, isSystemRisk, isTimeBan, isTodoRisk, routeRisks } from '../src/lib/todoRules';
import { buildTodo, decisionIssue, defaultScope, scopeCards, visibleTodoRisks, type TodoDecision } from '../src/lib/p6Todo';
import { todoQueue, viewedKind } from '../src/lib/cockpitE9';
import { altProposal, ferryAlert, ferryRowsFromDb, roadCounts, roadRowsFromCorridor, type FerryRowView } from '../src/lib/p6Route';
import { buildDemoSnapshot } from '../src/data/demoProvider';

const NOW = '2026-10-07T14:00:00Z'; // 07.10, 16:00 w Warszawie
const risk = (p: Partial<Risk>): Risk => ({
  id: p.id ?? Math.random().toString(36).slice(2), type: 'OPS', severity: 'HIGH', title: 'x', detail: '', owner: 'HHL',
  meta: '', nextAction: '', ageHours: 1, ...p,
}) as Risk;
const dec = (p: Partial<TodoDecision>): TodoDecision => ({
  id: 'd', typeCode: 'NO_AWIZACJA', titleKey: 'dec_type_NO_AWIZACJA', title: 'Brak awizacji', dueAt: null, escalatedAt: null,
  loadId: null, decider: 'SCX', deciderRole: 'CARRIER', status: 'NEW', options: [], ...p,
});

describe('E7 — co jest sprawą do zrobienia', () => {
  it('zakaz ruchu w dniu przejazdu — tylko informacja (nie liczy się)', () => {
    const ban = risk({ kind: 'ROAD_SE', type: 'ROAD_SE', title: 'Zakaz ruchu w SE w dniu przejazdu 10.10', loadId: 'L1' });
    expect(isTimeBan(ban)).toBe(true);
    expect(isTodoRisk(ban)).toBe(false);
    expect(isTimeBan(risk({ kind: 'RESOURCE_MISSING', title: 'zakaz ruchu' }))).toBe(false);
  });
  it('sytuacja na trasie bez transportu i sprawa techniczna — poza listą; z transportem zostaje', () => {
    expect(isRouteOnly(risk({ type: 'FERRY' }))).toBe(true);
    expect(isTodoRisk(risk({ type: 'ROAD_SE' }))).toBe(false);
    expect(isTodoRisk(risk({ type: 'ROAD_SE', loadId: 'L1' }))).toBe(true);
    expect(isSystemRisk(risk({ kind: 'JOB_FAILURE' }))).toBe(true);
    expect(isTodoRisk(risk({ kind: 'JOB_FAILURE' }))).toBe(false);
    expect(isTodoRisk(risk({ code: 'SOURCE_DOWN' }))).toBe(false);
  });
  it('sytuacje bez transportu trafiają do „Sytuacji na trasie”, nie znikają (prom, pogoda, drogi PL, zakazy, technika)', () => {
    const rr = routeRisks([
      risk({ id: 'f', type: 'FERRY', title: 'AIS: odejście opóźnione' }),
      risk({ id: 'w', type: 'FORCE_MAJEURE', title: 'Porywy wiatru 22 m/s' }),
      risk({ id: 'p', type: 'OPS', kind: 'ROAD_PL', title: 'A1: roboty' }),
      risk({ id: 'b', type: 'OPS', kind: 'ROAD_PL', title: 'Zakaz ruchu w PL 25.10' }),
      risk({ id: 's', kind: 'JOB_FAILURE', title: 'SMS bez potwierdzenia' }),
      risk({ id: 'se', type: 'ROAD_SE', title: 'Warunki drogowe E4: roboty' }),
      risk({ id: 'l', type: 'FERRY', loadId: 'L1', title: 'Rejs odwołany' }),
    ]);
    expect([rr.ferry, rr.weather, rr.roadPl, rr.bans, rr.system].map((x) => x.map((r) => r.id))).toEqual([['f'], ['w'], ['p'], ['b'], ['s']]);
  });
});

describe('E7 — karty', () => {
  const RISKS = [
    risk({ id: 'a', loadId: 'L1', owner: 'SCX', severity: 'MEDIUM', title: 'Brak kierowcy' }),
    risk({ id: 'b', loadId: 'L1', owner: 'HHL', severity: 'HIGH', title: 'Brak numeru zlecenia HHL' }),
    risk({ id: 'c', loadId: 'L2', owner: 'SCX', severity: 'CRITICAL', title: 'Brak zezwolenia' }),
    risk({ id: 'ban', loadId: 'L1', kind: 'ROAD_SE', type: 'ROAD_SE', severity: 'LOW', title: 'Zakaz ruchu w SE w dniu przejazdu 10.10' }),
    risk({ id: 'sea', type: 'FERRY', title: 'Fala 3,2 m' }),
  ];
  const SEFS = Array.from({ length: 12 }, (_, i) => dec({ id: `s${i}`, typeCode: 'SEFS_OUT_OF_TABLE', titleKey: 'dec_type_SEFS_OUT_OF_TABLE', title: 'SEFS: brak źródła indeksu', decider: 'HHL', dueAt: '2026-10-18T12:45:00Z' }));

  it('jedna karta na transport, zakaz jako informacja, 12 jednakowych decyzji SEFS → 1 karta', () => {
    const cards = buildTodo({ risks: RISKS, decisions: SEFS, nowIso: NOW });
    /* najpilniejsze najpierw: waga, po terminie, najbliższy termin (karta z terminem przed kartą bez terminu) */
    expect(cards.map((c) => c.key)).toEqual(['L:L2', 'D:SEFS_OUT_OF_TABLE:SEFS: brak źródła indeksu', 'L:L1']);
    const l1 = cards.find((c) => c.key === 'L:L1')!;
    expect(l1.issues.map((i) => i.id)).toEqual(['b', 'a']);
    expect(l1.infos.map((i) => i.id)).toEqual(['ban']);
    expect(cards[1].issues).toHaveLength(1);
    expect(cards[1].issues[0].merged).toBe(12);
    /* link do każdej z połączonych decyzji trafia do tej karty (E7-6) */
    expect(cards[1].issues[0].mergedIds).toHaveLength(12);
  });
  it('różne treści pod jednym kluczem nie łączą się (rk_generic, polisy, wiersze pliku KSH)', () => {
    const cards = buildTodo({
      risks: [risk({ titleKey: 'rk_generic', title: 'Polisa A wygasa' }), risk({ titleKey: 'rk_generic', title: 'Polisa B wygasa' })],
      decisions: [dec({ id: 'k1', typeCode: 'KSH_FILE_ERROR', title: 'Wiersz 12: brak daty' }), dec({ id: 'k2', typeCode: 'KSH_FILE_ERROR', title: 'Wiersz 40: zła waga' })],
      nowIso: NOW,
    });
    expect(cards).toHaveLength(4);
    expect(cards.every((c) => c.issues[0].merged === 1)).toBe(true);
  });
  it('Moja firma: waga i kolejność tylko z widocznych spraw', () => {
    const cards = buildTodo({ risks: [
      risk({ id: 'x1', loadId: 'A', owner: 'SCX', severity: 'CRITICAL' }), risk({ id: 'x2', loadId: 'A', owner: 'HHL', severity: 'MEDIUM' }),
      risk({ id: 'y1', loadId: 'B', owner: 'HHL', severity: 'HIGH' }),
    ], nowIso: NOW });
    const firm = scopeCards(cards, 'FIRM', 'HHL', () => null, null);
    expect(firm.map((c) => [c.key, c.severity])).toEqual([['L:B', 'HIGH'], ['L:A', 'MEDIUM']]);
  });
  it('decyzja po terminie albo przekazana wyżej — najpilniejsza', () => {
    expect(decisionIssue(dec({ dueAt: '2026-10-01T10:00:00Z' }), NOW)).toMatchObject({ overdue: true, severity: 'CRITICAL', go: 'AWIZACJA' });
    expect(decisionIssue(dec({ dueAt: '2026-10-09T10:00:00Z' }), NOW)).toMatchObject({ overdue: false, severity: 'HIGH' });
    expect(decisionIssue(dec({ escalatedAt: NOW }), NOW).severity).toBe('CRITICAL');
  });
  it('filtry: Moja firma — sprawy firmy; Moje — przypisane do mnie; Wszystkie — całość', () => {
    const cards = buildTodo({ risks: RISKS, nowIso: NOW });
    expect(scopeCards(cards, 'FIRM', 'HHL', () => null, null).map((c) => c.key)).toEqual(['L:L1']);
    expect(scopeCards(cards, 'FIRM', 'SCX', () => null, null).map((c) => c.key)).toEqual(['L:L2', 'L:L1']);
    const me = { id: 'me', name: 'Ja', org: 'SCX' as const, role: 'CARRIER_DISPATCH' as const, phone: null };
    expect(scopeCards(cards, 'MINE', 'SCX', (id) => (id === 'c' ? me : null), 'me').map((c) => c.key)).toEqual(['L:L2']);
    expect(scopeCards(cards, 'ALL', 'SCX', () => null, null)).toHaveLength(2);
    expect([defaultScope('HHL_ADMIN'), defaultScope('HHL_OPS'), defaultScope('CARRIER_DISPATCH')]).toEqual(['ALL', 'FIRM', 'FIRM']);
  });
  it('E7-2: liczba w menu = liczba kart w zakresie domyślnym (dane demo, każda firma)', () => {
    const { risks } = buildDemoSnapshot();
    for (const [role, kind] of [['HHL', 'HHL_ADMIN'], ['HHL', 'HHL_OPS'], ['SCX', 'CARRIER_DISPATCH']] as const) {
      const cards = buildTodo({ risks: visibleTodoRisks(role, risks), nowIso: NOW });
      const shown = scopeCards(cards, defaultScope(kind), role, () => null, null);
      expect(shown.length).toBe(todoQueue(role, risks, viewedKind(role, kind))!.total);
    }
    expect(visibleTodoRisks('KSH', risks)).toEqual([]);
  });
});

describe('8.4 / E7-5 — druga przeprawa', () => {
  const row = (p: Partial<FerryRowView>): FerryRowView => ({
    id: 'r', line: 'POLFERRIES', vessel: 'Nova Star', depIso: '2026-10-07T16:00:00Z', delayedIso: null, status: 'ZAPLANOWANY', sea: null, onBoard: 0, ...p,
  });
  const storm = { risk: 'wysokie' as const, waveM: 3.2, gustKn: 42, thrWaveM: 3.8, thrGustKn: 40, at: NOW };
  const sail = (id: string, route: Sailing['route'], source: Sailing['source'], dep: string, status: Sailing['status'] = 'ZAPLANOWANY'): Sailing => ({
    id, vessel: id, route, departureAt: dep, arrivalAt: dep, delayedDepartureAt: null, delayedArrivalAt: null, status, source,
  });
  const SCHED = [
    sail('Stena Ebba', 'GDY-KAA', 'STENA', '2026-10-07T18:00:00Z'),
    sail('Stena Spirit', 'GDY-KAA', 'STENA', '2026-10-08T07:00:00Z'),
    sail('Stena Vision', 'GDY-KAA', 'STENA', '2026-10-08T18:00:00Z'),
    sail('Stena Estelle', 'GDY-KAA', 'STENA', '2026-10-09T07:00:00Z'),
    sail('Nova Star', 'GDN-NYN', 'POLFERRIES', '2026-10-07T16:00:00Z'),
  ];
  const nowMs = Date.parse(NOW);

  it('sztorm na Polferries, Stena spokojna → do trzech najbliższych odejść Steny', () => {
    const p = altProposal([row({ sea: storm }), row({ id: 's', line: 'STENA', vessel: 'Stena Ebba' })], SCHED, nowMs);
    expect(p).toMatchObject({ kind: 'ALT', from: 'POLFERRIES', to: 'STENA', reason: 'STORM' });
    expect(p && p.kind === 'ALT' ? p.sailings.map((s) => s.vessel) : []).toEqual(['Stena Ebba', 'Stena Spirit', 'Stena Vision']);
  });
  it('odwołany rejs → powód „odwołany”; sztorm na obu → bez propozycji; brak rozkładu → „Brak danych”; spokojnie → nic', () => {
    expect(altProposal([row({ status: 'ODWOLANY' })], SCHED, nowMs)).toMatchObject({ kind: 'ALT', reason: 'CANCELLED' });
    expect(altProposal([row({ sea: storm }), row({ line: 'STENA', status: 'ODWOLANY' })], SCHED, nowMs)).toEqual({ kind: 'BOTH' });
    expect(altProposal([row({ sea: storm })], SCHED.filter((s) => s.source !== 'STENA'), nowMs)).toMatchObject({ kind: 'NODATA', to: 'STENA' });
    expect(altProposal([row({})], SCHED, nowMs)).toBeNull();
    expect(ferryAlert(row({ delayedIso: '2026-10-07T17:00:00Z' }))).toBe('DELAYED');
  });
  it('promy dziś z rozkładu (bez danych startowych), transporty na pokładzie, najbliższy, gdy dziś brak', () => {
    /* U-100: „na pokładzie” = etap Prom; rezerwacja przed wjazdem (PORT_PL) się nie liczy */
    const loads = [
      { sailingId: 'Nova Star', status: 'ON_FERRY', stage: 'FERRY' },
      { sailingId: 'Nova Star', status: 'ON_FERRY', stage: 'FERRY' },
      { sailingId: 'Nova Star', status: 'AT_PORT_GDANSK', stage: 'GDANSK' },
      { sailingId: null, status: 'ON_FERRY', stage: 'FERRY' },
    ] as unknown as Load[];
    const rows = ferryRowsFromDb([...SCHED, sail('Seed', 'GDN-NYN', 'DANE_STARTOWE', '2026-10-07T15:00:00Z')], [], loads, nowMs);
    expect(rows.map((r) => [r.vessel, r.onBoard])).toEqual([['Nova Star', 2], ['Stena Ebba', 0]]);
  });
});

describe('E7 pkt 4 — drogi', () => {
  it('najpierw bardzo duży i duży wpływ; liczba sytuacji na drogę', () => {
    const rows = roadRowsFromCorridor([
      { id: '1', severity: 'MEDIUM', title: 'Roboty', road: 'E4', original: null, note: null },
      { id: '2', severity: 'CRITICAL', title: 'Zamknięcie drogi', road: 'E4', original: 'Vägen avstängd', note: null },
      { id: '3', severity: 'HIGH', title: 'Wypadek', road: 'E22', original: null, note: null },
    ]);
    expect(rows.map((r) => [r.id, r.impact])).toEqual([['2', 'VERY_HIGH'], ['3', 'HIGH'], ['1', 'MEDIUM']]);
    expect(roadCounts(rows)).toBe('E4: 2 · E22: 1');
  });
});

describe('I-0 — przykłady P6 tylko w demo', () => {
  it('p6Source woła przykłady wyłącznie za warunkiem trybu demo wpisanym wprost; p6Demo tylko z p6Source', () => {
    const src = readFileSync(new URL('../src/lib/p6Source.ts', import.meta.url), 'utf8');
    const calls = src.match(/\b(demo[A-Z]\w+|DEMO_PEOPLE)[.(]/g) ?? [];
    const guarded = src.match(/import\.meta\.env\.VITE_AUTH_MODE !== 'supabase' \? (demo[A-Z]\w+|DEMO_PEOPLE)[.(]/g) ?? [];
    expect(calls.length).toBeGreaterThan(5);
    expect(guarded.length).toBe(calls.length);
    for (const f of ['src/components/risks/TodoPanel.tsx', 'src/components/risks/TodoCard.tsx', 'src/components/risks/RoutePanel.tsx', 'src/views/RisksView.tsx']) {
      expect(readFileSync(f, 'utf8')).not.toMatch(/p6Demo/);
    }
  });
  it('strona Ryzyka bez kodów spraw i bez daty z sekundami (E7 pkt 8, E21)', () => {
    const card = readFileSync('src/components/risks/TodoCard.tsx', 'utf8');
    expect(card).not.toMatch(/type_code|>\{[^}]*typeCode\}|toLocaleString\(/);
  });
});

describe('U-100 — Sytuacja na trasie zgodnie z makietą E7', () => {
  it('„statek w porcie” (AIS, informacja) nie trafia do ostrzeżeń rejsów; ostrzeżenie promowe zostaje', () => {
    const base = { severity: 'LOW', type: 'FERRY', loadId: null, title: 'x', meta: '', detail: '' };
    const rr = routeRisks([
      { ...base, id: 'a', titleKey: 'rk_ais_arrived' },
      { ...base, id: 'b', titleKey: 'rk_ais_arrived_kaa' },
      { ...base, id: 'c', severity: 'HIGH', titleKey: 'rk_ferry_storm' },
    ] as unknown as Risk[]);
    expect(rr.ferry.map((r) => r.id)).toEqual(['c']);
  });
  it('RoutePanel: etykieta wpływu tylko od średniego wzwyż; na telefonie bez „na pokładzie” w wierszu i bez noty drugiej przeprawy', () => {
    const src = readFileSync('src/components/risks/RoutePanel.tsx', 'utf8');
    expect(src).toContain("r.severity === 'LOW' ? null");
    expect(src).toContain('r.onBoard > 0 && !phone');
    expect(src).toContain("{!phone ? <p className=\"rk-muted\">{rt(locale, 'p6_alt_note')}</p> : null}");
  });
});
