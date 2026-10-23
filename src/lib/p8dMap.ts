/**
 * #413 / E35 Z2 — mapowanie uproszczonego modelu P8-d (Gdy/Wtedy) ↔ silnik B-5 (`workflows`).
 *
 * Wybór (E35): reguły zapisane z kreatora E35 trzymają pełny szkic w `description` (`p8d:…`), a trigger/
 * condition/actions to najlepsze przybliżenie dla silnika. Reguły B-5 spoza zone/status/issue/daily
 * (np. SILENT_VEHICLE + decision) — **pomijane** na liście „Własne reguły” (kreator zdaniami; pełny B-5
 * zostaje w Legacy do usunięcia w tej samej linii produktu).
 */
import { statusFromDb, statusToDb } from '../data/mappers';
import type { LoadStatus, WorkflowRule, WorkflowRun } from '../types';
import type {
  DailyCheck, IssueKind, OwnRule, RuleDraft, RuleHist, RuleRun, RuleThen, RuleWhen, Who,
} from './p8dRules';
import { emptyThen } from './p8dRules';

const P8D_MARK = 'p8d:';

interface P8dBlob { v: 1; when: RuleWhen; then: RuleThen }

const WHO_TO_ACT: Record<Who, string> = {
  HHL_OPS: 'notify_hhl',
  HHL_ADMIN: 'notify_hhl',
  KSH: 'notify_ksh',
  SCX: 'notify_scx',
};
const ACT_TO_WHO: Record<string, Who> = {
  notify_hhl: 'HHL_OPS',
  notify_ksh: 'KSH',
  notify_scx: 'SCX',
  notify_carrier: 'SCX',
};

/** IssueKind (E35) → przybliżony `risk_signals.kind` przy RISK_RAISED (silnik). */
const ISSUE_TO_RISK: Record<IssueKind, string> = {
  AWIZ: 'LOADING_UNCONFIRMED',
  DOCS: 'DOC_MISSING',
  NUMS: 'RESOURCE_MISSING',
  DATES: 'DATES_UNCONFIRMED',
  DWELL: 'ETA_BREACH',
  GPS: 'SILENT_VEHICLE',
  DELAY: 'ETA_BREACH', /* drobne F7: ten sam kind co DWELL — osobny kind wymaga migracji risk_signals */
  FERRY: 'FERRY',
};

function parseBlob(description: string): P8dBlob | null {
  if (!description.startsWith(P8D_MARK)) return null;
  try {
    const j = JSON.parse(description.slice(P8D_MARK.length)) as P8dBlob;
    if (j?.v !== 1 || !j.when || !j.then) return null;
    return j;
  } catch {
    return null;
  }
}

function encodeBlob(d: RuleDraft): string {
  const blob: P8dBlob = { v: 1, when: d.when, then: { ...d.then, notify: [...d.then.notify] } };
  return P8D_MARK + JSON.stringify(blob);
}

function thenFromActions(actions: string[]): RuleThen {
  const then = emptyThen();
  for (const a of actions) {
    const low = a.toLowerCase();
    if (ACT_TO_WHO[low]) {
      const w = ACT_TO_WHO[low]!;
      if (!then.notify.includes(w)) then.notify.push(w);
    } else if (low === 'email' || /^email:(hhl|ksh|carrier)/i.test(a)) {
      then.email = true;
    } else if (/^smszone:load_srem:/i.test(a)) then.smsTo = 'SREM';
    else if (/^smszone:unload_boden:/i.test(a)) then.smsTo = 'BODEN';
  }
  return then;
}

function actionsFromThen(then: RuleThen): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const w of then.notify) {
    const a = WHO_TO_ACT[w];
    if (!seen.has(a)) { seen.add(a); out.push(a); }
  }
  if (then.email) {
    for (const a of seen) {
      const aud = a === 'notify_ksh' ? 'KSH' : a === 'notify_scx' ? 'CARRIER' : 'HHL';
      out.push(`email:${aud}`);
    }
    if (!seen.size) out.push('email:HHL');
  }
  if (then.smsTo === 'SREM') out.push('smszone:LOAD_SREM:ZONE_ENTER');
  if (then.smsTo === 'BODEN') out.push('smszone:UNLOAD_BODEN:ZONE_ENTER');
  /* then.todo — brak akcji B-5 „sprawa w Do zrobienia”; zostaje tylko w blobie p8d (E35). */
  return out.length ? out : ['notify_hhl'];
}

function engineOf(when: RuleWhen): { trigger: string; condition: string } {
  switch (when.kind) {
    case 'zone':
      /* GEOFENCE_DWELL odpala po dwell_seconds strefy (0274) — próg minut w UI = dwell strefy (blob). */
      return {
        trigger: 'GEOFENCE_DWELL',
        condition: JSON.stringify({ '==': [{ var: 'payload.geofence_id' }, when.zoneId] }),
      };
    case 'status': {
      if (when.status === 'ANY') return { trigger: 'STATUS_CHANGED', condition: 'true' };
      const db = statusToDb(when.status);
      /* DELAYED/SILENT nie są statusami w bazie — bez warunku statusu (tylko ANY albo pomiń). */
      if (!db) return { trigger: 'STATUS_CHANGED', condition: 'true' };
      return {
        trigger: 'STATUS_CHANGED',
        condition: JSON.stringify({ '==': [{ var: 'payload.status' }, db] }),
      };
    }
    case 'issue':
      return {
        trigger: 'RISK_RAISED',
        condition: JSON.stringify({ '==': [{ var: 'payload.kind' }, ISSUE_TO_RISK[when.issue]] }),
      };
    case 'daily': {
      /* kontekst silnika: payload || { load: wf_load_context() } — pola w load.* (0236/0281). */
      const field = when.check === 'DELIVERY_WITHIN' ? 'load.hours_to_delivery'
        : when.check === 'LOAD_WITHIN' ? 'load.hours_to_load' : 'load.plan_dates_status';
      const cond = when.check === 'DATES_UNCONFIRMED'
        ? { '==': [{ var: field }, 'WSTEPNA'] }
        : { '<=': [{ var: field }, when.hours] };
      return { trigger: 'CRON_DAILY_06', condition: JSON.stringify(cond) };
    }
  }
}

/** Szkic E35 → wiersz `workflows` (create/update). */
export function draftToWorkflow(d: RuleDraft): Omit<WorkflowRule, 'id' | 'runCount'> {
  const { trigger, condition } = engineOf(d.when);
  return {
    name: d.name.trim(),
    description: encodeBlob(d),
    trigger,
    condition,
    actions: actionsFromThen(d.then),
    enabled: d.enabled,
  };
}

/**
 * Wiersz `workflows` → OwnRule albo `null` (E35: pomiń niemapowalne B-5).
 * Soft-delete START już odfiltrowane w providerze (`.is('removed_at', null)`).
 */
export function workflowToOwn(
  w: WorkflowRule,
  runs: readonly WorkflowRun[],
  sinceMs: number,
): OwnRule | null {
  const blob = parseBlob(w.description);
  let when: RuleWhen;
  let then: RuleThen;
  if (blob) {
    when = blob.when;
    then = blob.then;
  } else {
    const mapped = reverseMap(w);
    if (!mapped) return null;
    when = mapped.when;
    then = mapped.then;
  }
  const mine = runs.filter((r) => r.workflowId === w.id && Date.parse(r.at) >= sinceMs);
  const ok = mine.filter((r) => r.status === 'OK');
  const last = mine.reduce<string | null>((a, r) => (!a || r.at > a ? r.at : a), null);
  return {
    id: w.id,
    name: w.name,
    when,
    then: { ...then, notify: [...then.notify] },
    enabled: w.enabled,
    runs30: ok.length,
    lastRunAt: last,
  };
}

/** Konserwatywne odczytanie B-5 bez bloba; null = poza modelem P8-d. */
function reverseMap(w: WorkflowRule): { when: RuleWhen; then: RuleThen } | null {
  const then = thenFromActions(w.actions);
  let cond: unknown = true;
  try { cond = JSON.parse(w.condition || 'true'); } catch { cond = null; }
  const t = w.trigger;
  if (t === 'GEOFENCE_DWELL' || t === 'GEOFENCE_ENTER') {
    const zoneId = pickVar(cond, 'payload.geofence_id');
    if (!zoneId) return null;
    return { when: { kind: 'zone', zoneId, minutes: 180 }, then };
  }
  if (t === 'STATUS_CHANGED' || t === 'STATUS_AUTO') {
    const st = pickVar(cond, 'payload.status') ?? pickVar(cond, 'payload.to');
    if (!st || cond === true) return { when: { kind: 'status', status: 'ANY' }, then };
    return { when: { kind: 'status', status: statusFromDb(st) }, then };
  }
  if (t === 'RISK_RAISED') {
    const kind = pickVar(cond, 'payload.kind');
    const issue = (Object.entries(ISSUE_TO_RISK).find(([, v]) => v === kind)?.[0] ?? null) as IssueKind | null;
    if (!issue) return null;
    return { when: { kind: 'issue', issue }, then };
  }
  if (t === 'CRON_DAILY_06') {
    const check: DailyCheck = pickVar(cond, 'load.plan_dates_status') != null || pickVar(cond, 'plan_dates_status') != null
      ? 'DATES_UNCONFIRMED'
      : pickVar(cond, 'load.hours_to_delivery') != null || pickVar(cond, 'hours_to_delivery') != null
        ? 'DELIVERY_WITHIN' : 'LOAD_WITHIN';
    const hours = Number(pickRight(cond) ?? 48) || 48;
    return { when: { kind: 'daily', check, hours }, then };
  }
  return null;
}

function pickVar(logic: unknown, field: string): string | null {
  if (!logic || typeof logic !== 'object') return null;
  const o = logic as Record<string, unknown>;
  if ('and' in o && Array.isArray(o.and)) {
    for (const p of o.and) {
      const v = pickVar(p, field);
      if (v) return v;
    }
    return null;
  }
  const key = Object.keys(o)[0];
  if (!key) return null;
  const args = o[key];
  if (!Array.isArray(args) || args.length < 2) return null;
  const v = args[0] as { var?: string };
  if (v && typeof v === 'object' && v.var === field) return String(args[1]);
  return null;
}

function pickRight(logic: unknown): unknown {
  if (!logic || typeof logic !== 'object') return null;
  const o = logic as Record<string, unknown>;
  if ('and' in o && Array.isArray(o.and)) return pickRight(o.and[0]);
  const key = Object.keys(o)[0];
  if (!key) return null;
  const args = o[key];
  return Array.isArray(args) && args.length >= 2 ? args[1] : null;
}

/** Przebiegi store → zdania E35 (jeden wiersz na run; bez grupowania po event_id). */
export function runsToRuleRuns(
  runs: readonly WorkflowRun[],
  rulesById: Map<string, string>,
  loadsById: Map<string, string>,
  sinceMs: number,
): RuleRun[] {
  return runs
    .filter((r) => Date.parse(r.at) >= sinceMs)
    .map((r) => {
      const name = rulesById.get(r.workflowId) ?? r.workflowId;
      let result: RuleRun['result'];
      if (r.status === 'OK') result = { kind: 'done', notify: [] };
      else if (r.status === 'SKIPPED') result = { kind: 'skipped', since: null };
      else result = { kind: 'error', text: r.note || 'błąd przebiegu' };
      return {
        id: r.id,
        at: r.at,
        rules: [name],
        code: r.loadId ? (loadsById.get(r.loadId) ?? null) : null,
        loadId: r.loadId ?? null,
        result,
      };
    })
    .sort((a, b) => b.at.localeCompare(a.at));
}

/** Historia RPC `workflow_rule_history` → `RuleHist`. */
export function histFromServer(
  rows: { at: string; who: string; action: string; ruleName: string; changes: Record<string, unknown>; source: string | null }[],
): RuleHist[] {
  return rows.map((r) => {
    const po = (r.changes.po ?? {}) as Record<string, unknown>;
    const przed = (r.changes.przed ?? {}) as Record<string, unknown>;
    let action: RuleHist['action'] = 'changed';
    if (r.action === 'UTWORZONO') action = 'created';
    else if (r.action === 'USUNIĘTO' || po.removed === true || po.removed_at) action = 'removed';
    else if (typeof po.enabled === 'boolean' && po.enabled !== przed.enabled) action = po.enabled ? 'on' : 'off';
    /* #505 F7: audit_row_change pisze _reason (nie kolumna reason). */
    const reason = typeof po._reason === 'string' ? po._reason
      : typeof po.reason === 'string' ? po.reason
        : typeof r.changes.reason === 'string' ? String(r.changes.reason) : null;
    const what = typeof po.what === 'string' ? po.what : null;
    return {
      at: r.at,
      who: r.who || r.source || 'system',
      action,
      rule: r.ruleName,
      what,
      reason,
    };
  });
}
