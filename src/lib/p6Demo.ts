/**
 * wyglad/P6 — przykłady demo strony Ryzyka (G-09: osoby, telefony, decyzje, rejsy i zakazy zmyślone;
 * telefony z puli fikcyjnej +48 000 000 0xx, I-2 — nie do wybrania).
 * Wywoływane wyłącznie z `p6Source.ts` za warunkiem trybu demo wpisanym wprost (strażnik I-0).
 */
import type { Load, OrgKind, Risk, Sailing } from '../types';
import type { CaseEvent, CasePerson, TodoDecision } from './p6Todo';
import type { FerryRowView } from './p6Route';
import { formatListDateTime } from './format';
import { TZ_OPS, wallLocalToIso } from './time';

const H = 3600_000;
const iso = (ms: number) => new Date(ms).toISOString();

export const DEMO_PEOPLE: CasePerson[] = [
  { id: 'demo-hhl-1', name: 'Anna Wiśniewska', org: 'HHL', role: 'HHL_ADMIN', phone: '+48 000 000 010' },
  { id: 'demo-hhl-2', name: 'Marek Lis', org: 'HHL', role: 'HHL_OPS', phone: '+48 000 000 003' },
  { id: 'demo-scx-1', name: 'Jan Nowak', org: 'SCX', role: 'CARRIER_DISPATCH', phone: '+48 000 000 001' },
  { id: 'demo-scx-2', name: 'Ewa Kowal', org: 'SCX', role: 'CARRIER_DISPATCH', phone: '+48 000 000 002' },
];

export function demoMe(org: OrgKind): CasePerson {
  return org === 'SCX'
    ? { id: 'demo-me-scx', name: 'Konto pokazowe', org: 'SCX', role: 'CARRIER_DISPATCH', phone: null }
    : { id: 'demo-me-hhl', name: 'Konto pokazowe', org: 'HHL', role: 'HHL_ADMIN', phone: null };
}

const byCode = (loads: readonly Load[], code: string) => loads.find((l) => l.code === code) ?? null;

/** Decyzje przy transportach, które już mają sprawy (liczba w menu bez zmian). */
export function demoDecisions(loads: readonly Load[], nowIso: string): TodoDecision[] {
  const now = Date.parse(nowIso);
  const out: TodoDecision[] = [];
  const add = (code: string, d: Omit<TodoDecision, 'loadId' | 'status' | 'options' | 'deciderRole'> & { deciderRole?: string }) => {
    const l = byCode(loads, code);
    if (l) out.push({ ...d, deciderRole: d.deciderRole ?? null, loadId: l.id, status: d.escalatedAt ? 'NEW' : 'ASSIGNED', options: [] });
  };
  /* przegląd 18.10 (B1): sprawa po terminie przy SG-34 (załadunek jutro, brak zezwolenia na zestaw) — SG-09 ma zestaw
     kompletny i tylko sprawę zezwolenia; brak awizacji — SG-19 (bez kierowcy i zestawu) */
  add('SG-34', { id: 'demo-dec-1', typeCode: 'DOC_MISSING', titleKey: 'dec_type_DOC_MISSING', title: 'Brak zezwolenia lub dokumentu przed „Gotowy”', dueAt: iso(now - 50 * H), escalatedAt: iso(now - 49.9 * H), decider: 'SCX', deciderRole: 'CARRIER_DISPATCH' });
  add('SG-19', { id: 'demo-dec-2', typeCode: 'NO_AWIZACJA', titleKey: 'dec_type_NO_AWIZACJA', title: 'Brak awizacji w terminie', dueAt: iso(now + 20 * H), escalatedAt: null, decider: 'SCX', deciderRole: 'CARRIER_DISPATCH' });
  add('SG-10', { id: 'demo-dec-3', typeCode: 'ETA_AFTER_LATEST', titleKey: 'dec_type_ETA_AFTER_LATEST', title: 'ETA po godzinie „najpóźniej do”', dueAt: iso(now + 3 * H), escalatedAt: null, decider: 'HHL', deciderRole: 'HHL_OPS' });
  return out;
}

/** Przydział na start (E6 „Biorę tę sprawę”): decyzja SG-18 u Jana Nowaka. */
export function demoAssignments(): Record<string, string> {
  return { 'demo-dec-2': 'demo-scx-1' };
}

export function demoHistory(id: string, nowIso: string): CaseEvent[] {
  const now = Date.parse(nowIso);
  const sys = 'System // Watch Tower';
  if (id === 'demo-dec-1') {
    return [
      { at: iso(now - 52 * H), who: sys, what: `sprawa otwarta (termin ${formatListDateTime(iso(now - 50 * H))})` },
      { at: iso(now - 49.9 * H), who: sys, what: 'przekazana wyżej do HHL' },
    ];
  }
  if (id === 'demo-dec-2') {
    return [
      { at: iso(now - 20 * H), who: sys, what: `sprawa otwarta (termin ${formatListDateTime(iso(now + 20 * H))})` },
      { at: iso(now - 6 * H), who: 'Jan Nowak // Scandinavian Express', what: '„Biorę tę sprawę”' },
    ];
  }
  if (id === 'demo-dec-3') return [{ at: iso(now - 1 * H), who: sys, what: 'ETA po godzinie „najpóźniej do” — sprawa otwarta' }];
  return [];
}

/** Zakaz ruchu w dniu przejazdu — informacja przy transporcie (nie liczy się), dwa transporty z kartą. */
export function demoTimeBans(loads: readonly Load[], nowIso: string): Risk[] {
  const banMs = Date.parse(nowIso) + 48 * H;
  const day = formatListDateTime(iso(banMs)).split(', ')[0];
  const banDay = new Intl.DateTimeFormat('en-CA', { timeZone: TZ_OPS }).format(new Date(banMs));
  /* przegląd 18.10 (P21): dzień zakazu w terminie transportu — transporty w drodze do Szwecji z dostawą w ten dzień albo później */
  const ON_WAY: ReadonlySet<string> = new Set(['AT_PORT', 'ON_FERRY', 'AT_PORT_SE', 'IN_TRANSIT_SE', 'DELAYED']);
  return [...loads]
    .filter((l) => ON_WAY.has(l.status) && l.plannedLoadDate <= banDay && l.plannedDeliverDate >= banDay)
    .sort((a, b) => a.code.localeCompare(b.code, 'pl', { numeric: true }))
    .slice(0, 2)
    .map((l, i) => ({
      id: `demo-ban-${i}`, type: 'ROAD_SE' as const, kind: 'ROAD_SE', severity: 'LOW' as const,
      title: `Zakaz ruchu w SE w dniu przejazdu ${day}`, detail: '', loadId: l.id, owner: 'HHL' as const,
      meta: '', nextAction: '', ageHours: 1,
    }));
}

/** Dzień rejsów demo: dziś, a po 17:00 (czas polski) — jutro (rejsy 18:00 i 20:00 jeszcze przed nami). */
function demoFerryDay(nowIso: string): string {
  const d = new Date(nowIso);
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Warsaw', hour: '2-digit', hourCycle: 'h23' }).format(d));
  const base = hour >= 17 ? new Date(d.getTime() + 24 * H) : d;
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw', year: 'numeric', month: '2-digit', day: '2-digit' }).format(base);
}

/** Promy dziś (img/e7-desk): Polferries ze sztormem, Stena z podwyższonym ryzykiem → propozycja drugiej przeprawy. */
export function demoFerryRows(nowIso: string, onBoard: number): FerryRowView[] {
  const day = demoFerryDay(nowIso);
  /* W-naprawy-2 (F7): czas polski także po zmianie czasu 25.10 (jak rozkład demo) */
  const at = (hh: string) => new Date(Date.parse(wallLocalToIso(`${day}T${hh}`, TZ_OPS)!)).toISOString();
  return [
    { id: 'demo-fr-1', line: 'POLFERRIES', vessel: 'Nova Star', depIso: at('18:00'), delayedIso: null, status: 'ZAPLANOWANY', onBoard,
      sea: { risk: 'wysokie', waveM: 3.2, gustKn: 42, thrWaveM: 3.8, thrGustKn: 40, at: at('11:16') } },
    { id: 'demo-fr-2', line: 'STENA', vessel: 'Stena Ebba', depIso: at('20:00'), delayedIso: null, status: 'ZAPLANOWANY', onBoard: 0,
      sea: { risk: 'podwyższone', waveM: 2.4, gustKn: 31, thrWaveM: 3.8, thrGustKn: 40, at: at('08:15') } },
  ];
}

/** Rozkład Steny do propozycji drugiej przeprawy (8.4) — w demo trzy najbliższe odejścia. */
export function demoStenaSailings(nowIso: string): Sailing[] {
  const day = demoFerryDay(nowIso);
  const next = new Date(Date.parse(`${day}T12:00:00Z`) + 24 * H).toISOString().slice(0, 10);
  const mk = (id: string, vessel: string, d: string, hh: string): Sailing => {
    const dep = new Date(Date.parse(wallLocalToIso(`${d}T${hh}`, TZ_OPS)!)).toISOString();
    return { id, vessel, operator: 'Stena Line', route: 'GDY-KAA', departureAt: dep, arrivalAt: iso(Date.parse(dep) + 11 * H),
      delayedDepartureAt: null, delayedArrivalAt: null, status: 'ZAPLANOWANY', source: 'STENA' };
  };
  return [mk('demo-st-1', 'Stena Ebba', day, '20:00'), mk('demo-st-2', 'Stena Spirit', next, '09:00'), mk('demo-st-3', 'Stena Ebba', next, '20:00')];
}
