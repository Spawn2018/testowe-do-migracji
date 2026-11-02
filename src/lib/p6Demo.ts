/**
 * wyglad/P6 — przykłady demo strony Ryzyka (G-09: osoby, telefony, decyzje, rejsy i zakazy zmyślone;
 * telefony z puli fikcyjnej +48 000 000 0xx, I-2 — nie do wybrania).
 * Wywoływane wyłącznie z `p6Source.ts` za warunkiem trybu demo wpisanym wprost (strażnik I-0).
 */
import type { Load, OrgKind, Risk, Sailing } from '../types';
import type { CaseEvent, CasePerson, TodoDecision } from './p6Todo';
import type { FerryRowView } from './p6Route';
import type { MarineConditionRow } from './marineWeatherDb';
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

/**
 * BN9-c3 — pogoda morska demo dla pięciu przepraw (Ryzyka › Pogoda, Kokpit). Wartości wymyślone (G-09), oznaczone jako
 * przykład w źródłach; PL–SE zgodne z wierszami promów powyżej (Polferries: sztorm 3,2 m / 42 kn, Stena: 2,4 m / 31 kn).
 */
export function demoMarineRows(nowIso: string): MarineConditionRow[] {
  const day = demoFerryDay(nowIso);
  const at = (hh: string) => new Date(Date.parse(wallLocalToIso(`${day}T${hh}`, TZ_OPS)!)).toISOString();
  const row = (corridor: MarineConditionRow['corridor'], wave: number, gust: number, risk: MarineConditionRow['risk'], hh: string, sources: string): MarineConditionRow => ({
    corridor, maxWaveM: wave, maxGustKn: gust, risk, waveThrM: 3.8, gustThrKn: 40,
    sources: `${sources} (przykład)`, attribution: 'Dane: FMI / DMI / SMHI (CC BY 4.0)', observedAt: at(hh), windowFrom: null, windowTo: null,
  });
  return [
    row('BALTIC_GDN_NYN', 3.2, 42, 'wysokie', '11:16', 'FMI WAM · FMI HARMONIE · DMI'),
    row('BALTIC_GDY_KAA', 2.4, 31, 'podwyższone', '08:15', 'FMI WAM · FMI HARMONIE · SMHI'),
    row('BALTIC_GULF_FI', 1.3, 24, 'niskie', '11:00', 'FMI WAM · FMI HARMONIE'),
    row('BALTIC_PLD_KPS', 2.8, 35, 'podwyższone', '11:00', 'FMI WAM · FMI HARMONIE · SMHI'),
    row('BALTIC_TLL_STO', 1.9, 29, 'niskie', '11:00', 'FMI WAM · FMI HARMONIE · DMI'),
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

/**
 * BN9-c4 — drogi LT/LV/EE/FI w demo (Ryzyka › Drogi). Zdarzenia wymyślone (G-09), źródła z dopiskiem „(przykład)”;
 * kształt jak ryzyka BN6 (`roadBaltic.ts`: `kind` ROAD_*, klucze `rk_road_baltic*`, `detail.zrodlo`, od/do). Estonia bez
 * zdarzeń — wiersz „Brak utrudnień na korytarzu”. Trasa transportu demo: Tallinn – Helsinki (LT, LV, EE i FI).
 */
export const DEMO_BALTIC_ROUTES: readonly string[] = ['TLL-HEL'];

export function demoBalticRoadRisks(nowIso: string): Risk[] {
  const now = Date.parse(nowIso);
  const at = (h: number) => iso(now + h * H);
  const FI_SRC = 'Source: Fintraffic / digitraffic.fi, license CC 4.0 BY (przykład)';
  const mk = (
    id: string, country: 'LT' | 'LV' | 'EE' | 'FI', severity: Risk['severity'], titleKey: string, params: Record<string, string | number>,
    title: string, opis: string, from: number | null, to: number | null, source: string, weight: number | null = null,
  ): Risk => ({
    id, type: 'OPS', kind: `ROAD_${country}`, severity, title, titleKey, titleParams: { country, ...params },
    detail: opis, owner: 'HHL', meta: '', nextAction: '', ageHours: 1,
    road: { source, from: from == null ? null : at(from), to: to == null ? null : at(to), lat: null, lon: null, weightLimitT: weight, heightLimitM: null, widthLimitM: null },
  });
  return [
    mk('demo-road-fi-1', 'FI', 'HIGH', 'rk_road_baltic', { event: 'Wypadek, zamknięty pas ruchu — E75 Kemi' }, 'Trasa FI: Wypadek, zamknięty pas ruchu — E75 Kemi',
      'Objazd lokalny, utrudnienia do ok. 2 godzin (przykład).', -1, 2, FI_SRC),
    mk('demo-road-fi-2', 'FI', 'MEDIUM', 'rk_road_baltic_weight_check', { event: 'Kelirikko — droga 4 Oulu', limit: 12 }, 'Trasa FI: limit masy 12 t — sprawdź zezwolenie / trasę',
      'Czasowe ograniczenie masy w okresie roztopów (przykład).', -48, 240, FI_SRC, 12),
    mk('demo-road-fi-3', 'FI', 'MEDIUM', 'rk_road_baltic', { event: 'Roboty drogowe — E75 Vuosaari – Kerava' }, 'Trasa FI: Roboty drogowe — E75 Vuosaari – Kerava',
      'Zwężenie do jednego pasa, ograniczenie prędkości 50 km/h (przykład).', -72, 96, FI_SRC),
    mk('demo-road-lt-1', 'LT', 'MEDIUM', 'rk_road_baltic_weight_check', { event: 'Słaby most — A1 Kowno', limit: 40 }, 'Trasa LT: limit masy 40 t — sprawdź zezwolenie / trasę',
      'Ograniczenie nośności mostu (przykład).', -240, null, 'przykład (demo)', 40),
    mk('demo-road-lv-1', 'LV', 'MEDIUM', 'rk_road_baltic', { event: 'Roboty drogowe — A7 Bauska' }, 'Trasa LV: Roboty drogowe — A7 Bauska',
      'Ruch wahadłowy (przykład).', -24, 72, 'przykład (demo)'),
  ];
}
