/**
 * wyglad/W-demo (audyt 17.10, D-20261017-0730-01 §4): dane demo zgodne z dniem demo 23.09.2026
 * (sekcja 15 N2, N6; sekcja 08 N11; sekcja 01 N18).
 */
import { describe, expect, it } from 'vitest';
import { buildDemoSnapshot, DEMO_TODAY_LOCAL } from '../src/data/demoProvider';
import { DEMO_ETA } from '../src/data/demoEta';
import { fxForDate } from '../src/lib/money/loadMoney';
import { delayMinutesVsPlan } from '../src/lib/time';
import { delayPillMinutes } from '../src/lib/prodDash';
import { migrateTowerPersist, STORE_SCHEMA_VERSION } from '../src/lib/storePersist';
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
    /* F7: plan dostawy minął, rozładunku brak — kurs bieżący, nie „na stałe” */
    const late = fxForDate(DEMO_TODAY_LOCAL, DEMO_TODAY_LOCAL, undefined, false);
    expect(late.provisional).toBe(true);
    expect(late.rate.effectiveDate <= DEMO_TODAY_LOCAL).toBe(true);
  });
});

describe('ETA w demo (E15; N2, N11, N18)', () => {
  it('każdy transport w trasie ma ETA Boden, pasmo i szczegóły; bez „Brak pozycji GPS”', () => {
    const miss = snap.loads.filter((l) => IN_ROUTE.includes(l.status) && l.status !== 'LOADING' && (!l.etaBoden || !l.etaDetail || l.etaConfMin == null));
    expect(miss.map((l) => l.code)).toEqual([]);
    expect(snap.loads.filter((l) => IN_ROUTE.includes(l.status)).every((l) => !l.etaReasons?.includes('Brak pozycji GPS'))).toBe(true);
    /* Załadunek: „–” przed wyjazdem (E15), ale z pozycją */
    for (const l of snap.loads.filter((x) => x.status === 'LOADING')) {
      expect(l.etaBoden, l.code).toBeNull();
      expect(l.etaDetail?.lastFixAt, l.code).toBeTruthy();
    }
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

const CLOCK = Date.parse('2026-09-23T14:32:00Z');
const byCode = (c: string) => snap.loads.find((l) => l.code === c)!;

describe('F7 (17.10): spójność danych demo z zegarem 23.09, 16:32', () => {
  it('rozładunek i „Dostarczone” nie z przyszłości (także status Rozładunek)', () => {
    for (const l of snap.loads.filter((x) => x.status === 'DELIVERED' || x.status === 'UNLOADING')) {
      expect(l.unloadedAt, l.code).toBeTruthy();
      expect(Date.parse(l.unloadedAt!) <= CLOCK, `${l.code} ${l.unloadedAt}`).toBe(true);
    }
  });
  it('zdarzenia przed zegarem i w kolejności: import ≤ zasoby ≤ załadunek ≤ rejs ≤ rozładunek', () => {
    const ORDER = ['SCHEDULE_IMPORTED', 'RESOURCES_ASSIGNED', 'LOADED', 'ON_FERRY', 'UNLOADED'];
    for (const l of snap.loads) {
      const ev = snap.events.filter((e) => e.loadId === l.id);
      expect(ev.every((e) => Date.parse(e.at) <= CLOCK), l.code).toBe(true);
      const at = ORDER.map((t) => ev.find((e) => e.type === t)?.at).filter((x): x is string => !!x).map(Date.parse);
      expect(at, l.code).toEqual([...at].sort((a, b) => a - b));
    }
  });
  it('załadunki i dostawy przeliczonych transportów w dni robocze', () => {
    for (const l of snap.loads.filter((x) => [...IN_ROUTE, 'UNLOADING', 'DELIVERED'].includes(x.status))) {
      for (const d of [l.plannedLoadDate, l.plannedDeliverDate]) expect([0, 6].includes(new Date(`${d}T12:00:00Z`).getUTCDay()), `${l.code} ${d}`).toBe(false);
    }
  });
  it('ETA = ostatnia pozycja + jazda + odpoczynek (Droga SE, brak GPS, odpoczynek, SG-35)', () => {
    const fm = new Set(snap.risks.filter((r) => r.type === 'FORCE_MAJEURE').map((r) => r.loadId));
    const list = snap.loads.filter((l) => ['IN_TRANSIT_SE', 'SILENT'].includes(l.status) && !fm.has(l.id) && l.code !== 'T-17');
    expect(list.length).toBeGreaterThan(3);
    for (const l of [...list, byCode('SG-35')]) {
      const d = l.etaDetail!;
      const from = d.phase === 'REST' ? Date.parse(d.restUntil!) : Date.parse(d.lastFixAt!) + (d.restHours ?? 0) * 3600e3;
      expect(Date.parse(l.etaBoden!), l.code).toBe(from + (d.driveMin ?? 0) * 60_000);
    }
  });
  it('„po oknie” i pigułka opóźnienia tylko, gdy ETA jest za oknem dostawy', () => {
    for (const l of snap.loads.filter((x) => x.etaBoden && IN_ROUTE.includes(x.status))) {
      const vs = delayMinutesVsPlan(l.etaBoden, l.plannedDeliverDate, l.planDates?.deliveryTo ?? l.awizacja?.unloadWindowEnd);
      const after = Date.parse(l.etaBoden!) > Date.parse(l.awizacja.unloadWindowEnd!);
      expect(vs != null, l.code).toBe(after);
      if (l.delayed) expect(delayPillMinutes(l, vs, false) != null, l.code).toBe(after);
    }
    expect(Date.parse(byCode('SG-35').etaBoden!) > Date.parse(byCode('SG-35').awizacja.unloadWindowEnd!)).toBe(true);
  });
  it('na placu od godziny przed zegarem; brak GPS: pozycja = zegar − cisza; teksty spraw z tych samych liczb', () => {
    for (const l of snap.loads.filter((x) => x.status === 'APPROACHING_SITE')) expect(Date.parse(l.etaDetail!.waitSince!) <= CLOCK, l.code).toBe(true);
    for (const l of snap.loads.filter((x) => x.status === 'SILENT')) {
      expect(Date.parse(l.etaDetail!.lastFixAt!), l.code).toBe(CLOCK - (l.silentMinutes ?? 95) * 60_000);
    }
    const silent = snap.risks.find((r) => r.id === 'risk-silent')!;
    const sl = snap.loads.find((l) => l.id === silent.loadId)!;
    expect(silent.title).toBe(`Brak pozycji od ${Math.floor(sl.silentMinutes! / 60)} h ${sl.silentMinutes! % 60} min`);
    for (const r of snap.risks.filter((x) => x.id.startsWith('risk-eta-'))) {
      const l = snap.loads.find((x) => x.id === r.loadId)!;
      const late = Math.round((Date.parse(l.etaBoden!) - Date.parse(l.awizacja.unloadWindowEnd!)) / 60_000);
      expect(r.title, l.code).toBe(`Prognoza przyjazdu poza oknem o ${Math.floor(late / 60)} h ${late % 60} min`);
    }
    for (const r of snap.risks.filter((x) => x.id.startsWith('risk-permit-'))) {
      const l = snap.loads.find((x) => x.id === r.loadId)!;
      const h = Math.max(1, Math.round((Date.parse(l.awizacja.loadWindowStart!) - CLOCK) / 3600e3));
      expect(r.title, l.code).toBe(`Brak zezwolenia — załadunek za ${h < 48 ? `${h} h` : `${Math.round(h / 24)} dni`}`);
    }
  });
  it('SG-31 w Szwecji — załadunek przed promem; czat demo przed załadunkiem', () => {
    expect(byCode('SG-31').plannedLoadDate).toBe('2026-09-21');
    for (const m of snap.messages) {
      const l = snap.loads.find((x) => x.id === m.loadId)!;
      expect(m.at.slice(0, 10) < l.plannedLoadDate, l.code).toBe(true);
    }
  });
  it('zapis przeglądarki sprzed v4 nie przykrywa danych demo (stare daty, brak ETA)', () => {
    expect(STORE_SCHEMA_VERSION).toBe(4);
    const st = migrateTowerPersist({ role: 'KSH', theme: 'dark', loads: [{ id: 'old' }], events: [], risks: [] }, 3).state;
    expect(st).toMatchObject({ role: 'KSH', theme: 'dark' });
    expect(st).not.toHaveProperty('loads');
    expect(st).not.toHaveProperty('events');
  });
});
