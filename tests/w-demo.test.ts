/**
 * wyglad/W-demo (audyt 17.10, D-20261017-0730-01 §4): dane demo zgodne z dniem demo 23.09.2026
 * (sekcja 15 N2, N6; sekcja 08 N11; sekcja 01 N18).
 */
import { describe, expect, it } from 'vitest';
import { buildDemoSnapshot, DEMO_TODAY_LOCAL } from '../src/data/demoProvider';
import { DEMO_ETA } from '../src/data/demoEta';
import { fxForDate } from '../src/lib/money/loadMoney';
import type { LoadStatus } from '../src/types';
import { demoDecisions } from '../src/lib/p6Demo';
import { todoRisks } from '../src/lib/cockpitE9';


const snap = buildDemoSnapshot();
const IN_ROUTE: LoadStatus[] = ['LOADING', 'IN_TRANSIT_PL', 'AT_PORT', 'ON_FERRY', 'IN_TRANSIT_SE', 'DELAYED', 'SILENT', 'APPROACHING_SITE'];
const BEFORE: LoadStatus[] = ['PLANNED', 'READY', 'RESOURCES_PENDING', 'DOC_MISSING'];

describe('daty demo zgodne z dniem demo (N6)', () => {
  it('w trasie, na placu i dostarczone — załadunek najpóźniej 23.09; przed załadunkiem — od 23.09', () => {
    const bad = snap.loads.filter((l) => (
      [...IN_ROUTE, 'UNLOADING', 'DELIVERED'].includes(l.status) ? l.plannedLoadDate > DEMO_TODAY_LOCAL
        : BEFORE.includes(l.status) ? l.plannedLoadDate < DEMO_TODAY_LOCAL : false
    )).map((l) => `${l.code} ${l.status} ${l.plannedLoadDate}`);
    expect(bad).toEqual([]);
  });
  it('dostarczone: rozładunek przed „teraz”; dostawa po załadunku', () => {
    for (const l of snap.loads.filter((x) => x.status === 'DELIVERED')) {
      expect(String(l.unloadedAt).slice(0, 10) <= DEMO_TODAY_LOCAL, l.code).toBe(true);
      expect(l.plannedDeliverDate > l.plannedLoadDate, l.code).toBe(true);
    }
  });
  it('kolejność jak w pliku KSH — po dacie załadunku', () => {
    const days = snap.loads.map((l) => l.plannedLoadDate);
    expect(days).toEqual([...days].sort());
  });
  it('kurs przed rozładunkiem = ostatnia tabela do dziś, nie tabela z przyszłości', () => {
    const r = fxForDate('2026-09-28', DEMO_TODAY_LOCAL);
    expect(r.provisional).toBe(true);
    expect(r.rate.effectiveDate <= DEMO_TODAY_LOCAL).toBe(true);
    const after = fxForDate('2026-09-18', DEMO_TODAY_LOCAL);
    expect(after.provisional).toBe(false);
    expect(after.rate.effectiveDate < '2026-09-18').toBe(true);
  });
});

describe('ETA w demo (E15; N2, N11, N18)', () => {
  it('każdy transport w trasie ma ETA Boden, pasmo i szczegóły; bez „Brak pozycji GPS”', () => {
    const miss = snap.loads.filter((l) => IN_ROUTE.includes(l.status) && l.status !== 'LOADING' && (!l.etaBoden || !l.etaDetail || l.etaConfMin == null));
    expect(miss.map((l) => l.code)).toEqual([]);
    expect(snap.loads.filter((l) => IN_ROUTE.includes(l.status)).every((l) => !l.etaReasons?.includes('Brak pozycji GPS'))).toBe(true);
  });
  it('przykłady makiety E15: w trasie (T-17), odpoczynek (SS-08), czeka przed placem (T-18), cisza GPS (SG-33)', () => {
    const by = (c: string) => snap.loads.find((l) => l.code === c)!;
    expect(by('T-17').etaDetail?.phase).toBe('DRIVE');
    expect(by('SS-08').etaDetail).toMatchObject({ phase: 'REST', restHours: 11 });
    expect(by('T-18').etaDetail?.phase).toBe('WAIT_SITE');
    expect(by('SG-33').etaDetail?.lastFixAt).toBe(DEMO_ETA['SG-33'].detail.lastFixAt);
    expect(by('SG-35').etaConfidence).toBe('LOW');
  });
});

describe('sprawy demo przy tych samych transportach (E7-2: liczba w menu = liczba kart)', () => {
  it('każda decyzja demo stoi przy transporcie, który ma już sprawę', () => {
    const withRisk = new Set(todoRisks('HHL', snap.risks).map((r) => r.loadId).filter(Boolean));
    const lone = demoDecisions(snap.loads, '2026-09-23T14:32:00Z').filter((d) => !withRisk.has(d.loadId)).map((d) => d.id);
    expect(lone).toEqual([]);
  });
});
