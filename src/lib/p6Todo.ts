/**
 * wyglad/P6 — lista „Do zrobienia” (E7, img/e7-desk, img/e7-phone; E6 karta sprawy, img/e6-desk).
 * Moduł czysty: z ryzyk, decyzji i spraw dodatkowych (dopłaty G-22, „czy dostarczono?” L14) układa karty —
 * jedna na transport, w środku sprawy z firmą i osobą; jednakowe sprawy bez transportu w jednej karcie (E7 pkt 3);
 * zakazy ruchu jako informacja przy transporcie (decyzja 07.10 15:55); najpilniejsze najpierw; filtry
 * Moje / Moja firma / Wszystkie (E6, E7 pkt 1). Które ryzyko jest sprawą — `todoRules.ts` (to samo co liczba w menu).
 * Samozamykanie i „przed pojazdem” (E7 pkt 3, 5) — wykonawca (dopisek P6).
 */
import type { DeliveredCheck, OrgKind, Risk, Severity } from '../types';
import type { FeeSuggestion } from './p5Fees';
import type { DetourCase } from './e49Detour';
import { isTimeBan, isTodoRisk, todoCardKey } from './todoRules';

export type IssueSrc = 'RISK' | 'DECISION' | 'FEE' | 'CHECK' | 'DETOUR';
/** Dokąd prowadzi główny przycisk sprawy (bez zapisu — nawigacja). */
export type IssueGo = 'AWIZACJA' | 'DOCS' | 'PRICING' | 'OPEN' | 'FEE' | 'INVOICE' | 'NONE';
export type TodoScope = 'MINE' | 'FIRM' | 'ALL';
export type PersonRole = 'HHL_ADMIN' | 'HHL_OPS' | 'CARRIER_DISPATCH' | 'CARRIER_USER' | 'CLIENT_USER';

export interface CasePerson { id: string; name: string; org: OrgKind; role: PersonRole; phone: string | null }
export interface CaseEvent { at: string; who: string; what: string }

export interface DecisionOption { code: string; label_key: string; requires_comment: boolean; effect: string }
export interface TodoDecision {
  id: string;
  typeCode: string;
  titleKey: string | null;
  title: string;
  dueAt: string | null;
  escalatedAt: string | null;
  loadId: string | null;
  decider: OrgKind;
  /** rola z katalogu decyzji (decision_types.decider_role), do sprawdzenia prawa rozstrzygnięcia */
  deciderRole: string | null;
  status: string;
  options: DecisionOption[];
  /** wyglad/W-todo-jedna-sprawa (#384): ryzyko, z którego decyzja powstała (`decisions.risk_id`) */
  riskId?: string | null;
  /** #384 pkt 5: szczegóły decyzji z bazy (np. `proposal` przy KSH_DATE_COUNTER) */
  detail?: Record<string, unknown> | null;
}

export interface TodoIssue {
  id: string;
  src: IssueSrc;
  loadId: string | null;
  /** firma, która decyduje albo uzupełnia */
  owner: OrgKind;
  severity: Severity;
  dueAt: string | null;
  overdue: boolean;
  /** ile jednakowych zgłoszeń połączonych w tę sprawę */
  merged: number;
  /** id wszystkich połączonych zgłoszeń (linki z dzwonka i `/#/decyzje/<id>` do każdego z nich) */
  mergedIds?: string[];
  go: IssueGo;
  ageHours: number;
  risk?: Risk;
  decision?: TodoDecision;
  fee?: FeeSuggestion;
  check?: DeliveredCheck;
  /** wyglad/E49: zamknięty most albo droga — „Objazd czy postój?” (SCX) */
  detour?: DetourCase;
  /** wyglad/W-todo-jedna-sprawa (#384): id ryzyk schowanych pod tą decyzją — liczą się jak ona (menu, „Moja firma”, linki) */
  coveredIds?: string[];
}

export interface TodoInfo { id: string; loadId: string; risk: Risk }

export interface TodoCard {
  key: string;
  loadId: string | null;
  severity: Severity;
  issues: TodoIssue[];
  infos: TodoInfo[];
  dueAt: string | null;
  overdue: boolean;
  ageHours: number;
}

export const SEV_RANK: Record<Severity, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
const maxSev = (a: Severity, b: Severity): Severity => (SEV_RANK[a] >= SEV_RANK[b] ? a : b);
const minIso = (a: string | null, b: string | null) => (!a ? b : !b ? a : Date.parse(a) <= Date.parse(b) ? a : b);

/** Rodzaje braków danych do awizacji (E7-4 „Brak danych do awizacji”): prowadzą do awizacji. */
const AWIZ_KEYS = /^(rk_seed_res|rk_seed_escort|rk_order_no)/;

export function riskGo(r: Risk): IssueGo {
  /* A4 (wyglad/W-faktura-termin): faktura po terminie — do tej faktury w Fakturach */
  if (r.kind === 'INVOICE_OVERDUE' && r.invoiceId) return 'INVOICE';
  if (r.type === 'DOC') return 'DOCS';
  if (r.kind === 'RESOURCE_MISSING' || (r.titleKey && AWIZ_KEYS.test(r.titleKey))) return 'AWIZACJA';
  return r.loadId ? 'OPEN' : 'NONE';
}

const DEC_GO: Record<string, IssueGo> = { NO_AWIZACJA: 'AWIZACJA', NO_SAILING: 'AWIZACJA', NO_TRACKING: 'AWIZACJA', NO_AWIZ_SE: 'AWIZACJA', DOC_MISSING: 'DOCS', DWELL_OVER_FREE: 'PRICING', INSURANCE_EXPIRING: 'DOCS' };

export function riskIssue(r: Risk, nowIso: string): TodoIssue {
  void nowIso;
  return {
    id: r.id, src: 'RISK', loadId: r.loadId ?? null, owner: r.owner, severity: r.severity,
    dueAt: null, overdue: false, merged: 1, go: riskGo(r), ageHours: r.ageHours, risk: r,
  };
}

export function decisionIssue(d: TodoDecision, nowIso: string): TodoIssue {
  const overdue = !!d.dueAt && Date.parse(d.dueAt) < Date.parse(nowIso);
  const ageHours = d.dueAt && overdue ? Math.round((Date.parse(nowIso) - Date.parse(d.dueAt)) / 36e5) : 0;
  return {
    id: d.id, src: 'DECISION', loadId: d.loadId, owner: d.decider,
    severity: d.escalatedAt || overdue ? 'CRITICAL' : 'HIGH',
    dueAt: d.dueAt, overdue, merged: 1, go: DEC_GO[d.typeCode] ?? (d.loadId ? 'OPEN' : 'NONE'), ageHours, decision: d,
  };
}

function nonLoadKey(i: TodoIssue): string {
  /* ten sam rodzaj i ta sama treść (np. 12 × „SEFS: brak źródła indeksu”); różne wiersze pliku KSH zostają osobno */
  if (i.decision) return `D:${i.decision.typeCode}:${i.decision.title}`;
  if (i.risk) return todoCardKey(i.risk);
  return `X:${i.src}:${i.id}`;
}

export interface TodoInput {
  risks: readonly Risk[];
  decisions?: readonly TodoDecision[];
  /** dopłaty (G-22) i „czy dostarczono?” (L14) jako gotowe sprawy */
  extras?: readonly TodoIssue[];
  nowIso: string;
}

/**
 * Karty „Do zrobienia”. Ryzyka bierze tylko te, które są sprawą (`isTodoRisk`) — wywołujący podaje już ryzyka
 * widoczne dla konta. Zakazy ruchu przy transporcie idą do `infos` (bez liczenia).
 */
export function buildTodo({ risks, decisions = [], extras = [], nowIso }: TodoInput): TodoCard[] {
  const issues: TodoIssue[] = [];
  const infos: TodoInfo[] = [];
  /* wyglad/W-todo-jedna-sprawa (#384): ryzyko z otwartą decyzją to ta sama sprawa — zostaje karta decyzji
     z przyciskami (np. „Późna zmiana daty” pod „KSH zmieniło datę < 5 dni”, „Decyzja po terminie” pod decyzją) */
  /* Chowamy tylko pod decyzją z tej samej listy (widoczną dla konta); DELIVERED_CHECK nie ma własnej karty (L14). */
  const shown = decisions.filter((d) => d.typeCode !== 'DELIVERED_CHECK');
  const decIds = new Set(shown.map((d) => d.id));
  const byRisk = new Map(shown.filter((d) => d.riskId).map((d) => [d.riskId as string, d.id]));
  const covered = new Map<string, string[]>();
  for (const r of risks) {
    const under = byRisk.get(r.id) ?? (r.decisionId && decIds.has(r.decisionId) ? r.decisionId : null);
    if (under) {
      covered.set(under, [...(covered.get(under) ?? []), r.id]);
      continue;
    }
    if (r.loadId && isTimeBan(r)) infos.push({ id: r.id, loadId: r.loadId, risk: r });
    else if (isTodoRisk(r)) issues.push(riskIssue(r, nowIso));
  }
  for (const d of decisions) {
    /* D-20261018-1100-01: L14 jest kartą CHECK, nie drugą decyzją DELIVERED_CHECK */
    if (d.typeCode === 'DELIVERED_CHECK') continue;
    const di = decisionIssue(d, nowIso);
    const cov = covered.get(d.id);
    issues.push(cov ? { ...di, coveredIds: cov } : di);
  }
  issues.push(...extras);

  const cards = new Map<string, TodoCard>();
  const merged = new Map<string, TodoIssue>();
  for (const i of issues) {
    let key: string;
    let issue = i;
    if (i.loadId) key = `L:${i.loadId}`;
    else {
      key = nonLoadKey(i);
      const prev = merged.get(key);
      if (prev) {
        prev.merged += 1;
        prev.mergedIds = [...(prev.mergedIds ?? [prev.id]), i.id];
        prev.dueAt = minIso(prev.dueAt, i.dueAt);
        prev.overdue = prev.overdue || i.overdue;
        prev.severity = maxSev(prev.severity, i.severity);
        prev.ageHours = Math.max(prev.ageHours, i.ageHours);
        continue;
      }
      issue = { ...i };
      merged.set(key, issue);
    }
    const c = cards.get(key);
    if (c) {
      c.issues.push(issue);
    } else {
      cards.set(key, { key, loadId: i.loadId, severity: i.severity, issues: [issue], infos: [], dueAt: null, overdue: false, ageHours: 0 });
    }
  }
  for (const inf of infos) {
    const c = cards.get(`L:${inf.loadId}`);
    if (c) c.infos.push(inf);
  }
  const out = [...cards.values()];
  for (const c of out) {
    c.issues.sort(issueOrder);
    c.severity = c.issues.reduce<Severity>((s, i) => maxSev(s, i.severity), 'LOW');
    c.dueAt = c.issues.reduce<string | null>((s, i) => minIso(s, i.dueAt), null);
    c.overdue = c.issues.some((i) => i.overdue);
    c.ageHours = c.issues.reduce((s, i) => Math.max(s, i.ageHours), 0);
  }
  return out.sort(cardOrder);
}

/** Informacje o zakazach ruchu dla transportów bez karty (pokazane przy transporcie w panelu — nie tu). */
export function timeBanInfos(risks: readonly Risk[]): TodoInfo[] {
  return risks.filter((r) => r.loadId && isTimeBan(r)).map((r) => ({ id: r.id, loadId: r.loadId as string, risk: r }));
}

function issueOrder(a: TodoIssue, b: TodoIssue): number {
  return SEV_RANK[b.severity] - SEV_RANK[a.severity]
    || Number(b.overdue) - Number(a.overdue)
    || (a.dueAt ? Date.parse(a.dueAt) : Infinity) - (b.dueAt ? Date.parse(b.dueAt) : Infinity)
    || b.ageHours - a.ageHours
    || a.id.localeCompare(b.id);
}

/** „Najpilniejsze najpierw”: waga, po terminie, najbliższy termin, najstarsze. */
export function cardOrder(a: TodoCard, b: TodoCard): number {
  return SEV_RANK[b.severity] - SEV_RANK[a.severity]
    || Number(b.overdue) - Number(a.overdue)
    || (a.dueAt ? Date.parse(a.dueAt) : Infinity) - (b.dueAt ? Date.parse(b.dueAt) : Infinity)
    || b.ageHours - a.ageHours
    || b.issues.length - a.issues.length
    || a.key.localeCompare(b.key);
}

/**
 * Zakres: Moje — sprawy przypisane do mnie; Moja firma — sprawy mojej firmy; Wszystkie — wszystko, co konto widzi.
 * Karta zostaje, gdy ma co najmniej jedną sprawę w zakresie.
 * `counted` (E9, E7-2; audyt-F F-01): ryzyka liczone przy „Ryzyka” w menu (`todoRisks`) — w „Moja firma” zostają
 * tylko karty z taką sprawą, żeby domyślny filtr pokazał tyle kart, ile mówi nagłówek, menu i Kokpit.
 */
export function scopeCards(
  cards: readonly TodoCard[],
  scope: TodoScope,
  org: OrgKind,
  assigneeOf: (issueId: string) => CasePerson | null,
  meId: string | null,
  counted?: ReadonlySet<string>,
): TodoCard[] {
  if (scope === 'ALL') return [...cards];
  const isCounted = (i: TodoIssue) => !!counted && (
    counted.has(i.risk?.id ?? '')
    || !!i.mergedIds?.some((id) => counted.has(id))
    || !!i.coveredIds?.some((id) => counted.has(id))
  );
  /* #384: decyzja ze schowanym ryzykiem tej firmy zostaje w „Moja firma” (liczba = menu i Kokpit) */
  const keep = (i: TodoIssue) => (scope === 'FIRM'
    ? i.owner === org || isCounted(i)
    : !!meId && assigneeOf(i.id)?.id === meId);
  /* waga, termin i kolejność z widocznych spraw — karta nie zostaje czerwona przez sprawę innej firmy */
  return cards
    .filter((c) => scope !== 'FIRM' || !counted || c.issues.some(isCounted))
    .map((c) => {
      const issues = c.issues.filter(keep);
      return {
        ...c, issues,
        severity: issues.reduce<Severity>((s, i) => maxSev(s, i.severity), 'LOW'),
        dueAt: issues.reduce<string | null>((s, i) => minIso(s, i.dueAt), null),
        overdue: issues.some((i) => i.overdue),
        ageHours: issues.reduce((s, i) => Math.max(s, i.ageHours), 0),
      };
    })
    .filter((c) => c.issues.length > 0)
    .sort(cardOrder);
}

/**
 * Zakres domyślny = ten, który liczy menu (E7-2, `todoQueue`): Administrator HHL — wszystkie, reszta — firma.
 * Operacje HHL: „Moja firma” z listą liczonych spraw (`countedFor`) — ta sama liczba w filtrze, nagłówku, menu i Kokpicie.
 */
export function defaultScope(kind: string): TodoScope {
  return kind === 'HHL_ADMIN' ? 'ALL' : 'FIRM';
}

/**
 * audyt-F F-01 (E9 „Operacje: sprawy HHL”): u Operacji HHL „Moja firma” = sprawy, które liczy menu — id ryzyk z `todoRisks`.
 * Dopłaty i decyzje wejdą do liczby razem z wykonawcą (P6); do tego czasu karta tylko z nimi jest w „Wszystkie”.
 * Inne rodzaje kont bez zmian (`undefined`).
 */
export function countedFor(kind: string, countedRisks: readonly Pick<Risk, 'id'>[]): ReadonlySet<string> | undefined {
  return kind === 'HHL_OPS' ? new Set(countedRisks.map((r) => r.id)) : undefined;
}

/** Ryzyka widoczne dla firmy na stronie Ryzyka (jak dotąd): KSH bez listy, SCX swoje i sytuacje na trasie. */
export function visibleTodoRisks(role: OrgKind, risks: readonly Risk[]): Risk[] {
  if (role === 'KSH') return [];
  if (role === 'SCX') return risks.filter((r) => r.owner === 'SCX' || r.type === 'FERRY' || r.type === 'ROAD_SE' || r.type === 'FORCE_MAJEURE');
  return [...risks];
}
