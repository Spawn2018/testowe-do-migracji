/**
 * wyglad/P8-d — Automatyzacje › własne reguły (E35, decyzje 08.10.2026, 12:14; img/e35-after).
 * Kreator zdaniami „Gdy … wtedy …”: wybory z list (strefa, „dłużej niż”, status, rodzaj sprawy, przegląd o 06:00),
 * bez operatorów i JSON. Akcje: powiadomienie (firma i rola), sprawa w Do zrobienia, e-mail (treść z E43),
 * SMS do odbiorców miejsca według zasad E42 (pytanie 1 = B). „Sprawdź na ostatnich 30 dniach”: kiedy reguła by zadziałała
 * i czy coś wbudowanego robi to samo. Przebiegi i historia zdaniami.
 * Czyste funkcje widoku — bez zapytań i zapisów.
 */
import type { LoadStatus } from '../types';

export type Who = 'HHL_OPS' | 'HHL_ADMIN' | 'KSH' | 'SCX';
export const WHO: readonly Who[] = ['HHL_OPS', 'HHL_ADMIN', 'KSH', 'SCX'];

export type IssueKind = 'AWIZ' | 'DOCS' | 'NUMS' | 'DATES' | 'DWELL' | 'GPS' | 'DELAY' | 'FERRY';
export const ISSUE_KINDS: readonly IssueKind[] = ['AWIZ', 'DOCS', 'NUMS', 'DATES', 'DWELL', 'GPS', 'DELAY', 'FERRY'];

export type DailyCheck = 'LOAD_WITHIN' | 'DELIVERY_WITHIN' | 'DATES_UNCONFIRMED';
export const DAILY_CHECKS: readonly DailyCheck[] = ['LOAD_WITHIN', 'DELIVERY_WITHIN', 'DATES_UNCONFIRMED'];

/** Statusy z E25 do wyboru (w kolejności transportu); `ANY` — każda zmiana. */
export const RULE_STATUSES: readonly (LoadStatus | 'ANY')[] = [
  'ANY', 'READY', 'LOADING', 'IN_TRANSIT_PL', 'AT_PORT', 'ON_FERRY', 'AT_PORT_SE', 'IN_TRANSIT_SE', 'APPROACHING_SITE',
  'DELIVERED', 'READY_TO_INVOICE', 'INVOICED', 'CANCELLED',
];

/** „Dłużej niż” (min): 15 min … 24 h. */
export const DWELL_STEPS: readonly number[] = [15, 30, 60, 120, 180, 240, 360, 720, 1440];
/** „W ciągu” przy przeglądzie o 06:00 (h). */
export const WITHIN_STEPS: readonly number[] = [24, 48, 72];

export type RuleWhen =
  | { kind: 'zone'; zoneId: string; minutes: number }
  | { kind: 'status'; status: LoadStatus | 'ANY' }
  | { kind: 'issue'; issue: IssueKind }
  | { kind: 'daily'; check: DailyCheck; hours: number };

export type SmsPlace = 'SREM' | 'BODEN';

export interface RuleThen {
  notify: Who[];
  /** sprawa w Do zrobienia — kto ją załatwia; null = bez sprawy */
  todo: Who | null;
  /** e-mail do tych samych odbiorców co powiadomienie (treść z E43) */
  email: boolean;
  /** SMS do odbiorców miejsca według zasad E42; null = bez SMS (nazwa pola bez „sms:” — strażnik I-2) */
  smsTo: SmsPlace | null;
}

export interface RuleDraft {
  name: string;
  when: RuleWhen;
  then: RuleThen;
  enabled: boolean;
}

export interface OwnRule extends RuleDraft {
  id: string;
  /** liczba przebiegów z wykonaniem w ostatnich 30 dniach */
  runs30: number;
  lastRunAt: string | null;
}

export interface ZoneOption { id: string; name: string; type: string }

export type RunResult =
  | { kind: 'done'; notify: { who: Who; n: number }[]; todo?: Who | null; email?: number; smsN?: number }
  /** zdanie z serwera, np. „wjazd na plac, a reguła dotyczy strefy 50 km” */
  | { kind: 'nomatch'; why: string }
  | { kind: 'skipped'; since: string | null }
  | { kind: 'error'; text: string };

export interface RuleRun {
  id: string;
  at: string;
  /** nazwy reguł (jeden wiersz może dotyczyć kilku reguł tego samego zdarzenia) */
  rules: string[];
  code: string | null;
  loadId: string | null;
  result: RunResult;
}

export type HistAction = 'created' | 'changed' | 'on' | 'off' | 'removed';
export interface RuleHist { at: string; who: string; action: HistAction; rule: string; what?: string | null; reason: string | null }

/** Pobyt w strefie (ostatnie 30 dni) — do „Sprawdź”. */
export interface Visit { code: string; loadId: string | null; zoneId: string; enter: string; exit: string | null }

export interface CheckHit { code: string; loadId: string | null; at: string; from?: string; exit?: string | null; still?: boolean; n?: number }
export interface CheckResult { hits: CheckHit[]; builtins: BuiltinOverlap[]; same: string[] }
export type BuiltinOverlap = 'dwell' | 'arrive' | 'status' | 'issue' | 'dates' | 'awiz';

export const emptyThen = (): RuleThen => ({ notify: [], todo: null, email: false, smsTo: null });
/** Nowa reguła startuje wyłączona (img/e35-after: „włączona” niezaznaczone) — Administrator włącza ją po sprawdzeniu na 30 dniach. */
export const emptyDraft = (zoneId = ''): RuleDraft => ({ name: '', when: { kind: 'zone', zoneId, minutes: 180 }, then: emptyThen(), enabled: false });

/** Domyślne parametry przy zmianie „Gdy”. */
export function whenOf(kind: RuleWhen['kind'], zoneId = ''): RuleWhen {
  switch (kind) {
    case 'zone': return { kind, zoneId, minutes: 180 };
    case 'status': return { kind, status: 'DELIVERED' };
    case 'issue': return { kind, issue: 'AWIZ' };
    case 'daily': return { kind, check: 'LOAD_WITHIN', hours: 48 };
  }
}

/** „15 min”, „1 h”, „1 h 30 min”, „24 h”. */
export function durText(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export type RuleError = 'name' | 'zone' | 'then' | 'todo' | 'email' | 'reason';

/** Błędy formularza (kolejność pól). `editing` — zmiana istniejącej reguły wymaga powodu (historia z powodem, E35 pkt 4). */
export function validateRule(d: RuleDraft, reason: string, editing: boolean): RuleError[] {
  const out: RuleError[] = [];
  if (!d.name.trim()) out.push('name');
  if (d.when.kind === 'zone' && !d.when.zoneId) out.push('zone');
  const t = d.then;
  if (!t.notify.length && !t.todo && !t.email && !t.smsTo) out.push('then');
  if (t.email && !t.notify.length) out.push('email');
  if (editing && !reason.trim()) out.push('reason');
  return out;
}

const minutesBetween = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / 60_000;

/**
 * „Auto jest w strefie dłużej niż …” na pobytach z ostatnich 30 dni: chwila zadziałania = wjazd + próg;
 * pobyt krótszy niż próg — brak. Pobyt bez wyjazdu liczy się do `nowIso`.
 */
export function dwellHits(visits: readonly Visit[], zoneId: string, minutes: number, nowIso: string): CheckHit[] {
  const since = Date.parse(nowIso) - 30 * 86_400_000;
  return visits
    .filter((v) => v.zoneId === zoneId && Date.parse(v.enter) >= since && minutesBetween(v.enter, v.exit ?? nowIso) >= minutes)
    .map((v) => ({
      code: v.code,
      loadId: v.loadId,
      from: v.enter,
      at: new Date(Date.parse(v.enter) + minutes * 60_000).toISOString(),
      exit: v.exit,
      still: !v.exit,
    }))
    .sort((a, b) => b.at.localeCompare(a.at));
}

/**
 * Wbudowane automaty robiące to samo (E35 pkt 3): postój ponad czas wolny (E33: 6 h Śrem, 4 h plac),
 * zdarzenia „Auto 50 km przed placem / przed Śremem”, „Auto 20 km przed portem” (Kto co dostaje), zmiana statusu
 * i nowa sprawa (Kto co dostaje), terminy awizacji i dat (Sprawy z terminem).
 */
export function builtinOverlap(w: RuleWhen, zones: readonly ZoneOption[]): BuiltinOverlap[] {
  switch (w.kind) {
    case 'zone': {
      const z = zones.find((x) => x.id === w.zoneId);
      if (!z) return [];
      if ((z.type === 'SITE' && w.minutes >= 240) || (z.type === 'LOADING' && w.minutes >= 360)) return ['dwell'];
      if ((z.type === 'PRE_ARRIVAL' || z.type === 'PRE_PORT') && w.minutes <= 15) return ['arrive'];
      return [];
    }
    case 'status': return ['status'];
    case 'issue': return ['issue'];
    case 'daily':
      if (w.check === 'DATES_UNCONFIRMED') return ['dates'];
      if (w.check === 'LOAD_WITHIN' && w.hours <= 48) return ['awiz'];
      return [];
  }
}

const sameWhen = (a: RuleWhen, b: RuleWhen) => JSON.stringify(a) === JSON.stringify(b);

/** Własne reguły z tym samym „Gdy” i wspólnym odbiorcą albo tą samą akcją — ostrzeżenie (bez blokady zapisu). */
export function sameRules(d: RuleDraft, rules: readonly OwnRule[], selfId: string | null): string[] {
  return rules
    .filter((r) => r.id !== selfId && sameWhen(r.when, d.when)
      && (r.then.notify.some((x) => d.then.notify.includes(x)) || (!!r.then.smsTo && r.then.smsTo === d.then.smsTo) || (!!r.then.todo && r.then.todo === d.then.todo)))
    .map((r) => r.name);
}

/** Najnowsze przebiegi pierwsze; tylko ostatnie 30 dni. */
export function recentRuns(runs: readonly RuleRun[], nowIso: string): RuleRun[] {
  const since = Date.parse(nowIso) - 30 * 86_400_000;
  return runs.filter((r) => Date.parse(r.at) >= since).sort((a, b) => b.at.localeCompare(a.at));
}
