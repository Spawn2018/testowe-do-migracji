/**
 * B-5 (decyzja właściciela 05.10) — model kreatora reguł: wyzwalacze w czterech grupach, warunki (wiersze ↔ JSONLogic),
 * akcje (powiadomienie, decyzja, e-mail, SMS według zasad stref) ↔ teksty akcji `workflowMap`, ostrzeżenie o duplikacie
 * w trybie demo (produkcja pyta bazę: `wf_duplicate_check`, katalog w 0165).
 */
import type { WorkflowRule } from '../types';
import { triggerToDb } from '../data/workflowMap';

export type TriggerGroup = 'event' | 'status' | 'risk' | 'deadline';

export const TRIGGER_GROUPS: Record<TriggerGroup, string[]> = {
  event: ['GEOFENCE_ENTER', 'GEOFENCE_EXIT', 'GEOFENCE_DWELL', 'MILESTONE_LOADED', 'MILESTONE_UNLOADED', 'DRIVER_ON_FERRY',
    'SCHEDULE_IMPORTED', 'FERRY_STATUS', 'SILENT_VEHICLE', 'DELAY_DETECTED'],
  status: ['STATUS_CHANGED', 'STATUS_AUTO', 'STATUS_AT_SITE', 'STATUS_CANCELLED'],
  risk: ['RISK_RAISED'],
  deadline: ['SCHEDULE_DATE_CRITICAL', 'PLAN_DATES_CHANGED', 'PLAN_DATES_CONFIRMED', 'CRON_DAILY_06'],
};

export function groupOf(trigger: string): TriggerGroup {
  const db = triggerToDb(trigger);
  for (const g of Object.keys(TRIGGER_GROUPS) as TriggerGroup[]) if (TRIGGER_GROUPS[g].includes(db)) return g;
  return 'event';
}

/** Pola warunku dostępne w grupie (ścieżka w kontekście silnika: payload.* = zdarzenie, load.* = transport). */
export const CONDITION_FIELDS: Record<TriggerGroup, string[]> = {
  event: ['payload.geofence_kind', 'payload.delay_min', 'payload.status', 'load.status', 'load.has_carrier'],
  status: ['payload.status', 'payload.old_status', 'load.has_carrier'],
  risk: ['payload.kind', 'payload.severity', 'load.status'],
  deadline: ['load.hours_to_load', 'load.hours_to_delivery', 'load.plan_dates_status', 'load.status'],
};

export const CONDITION_OPS = ['==', '!=', '<', '<=', '>', '>=', 'in'] as const;
export type ConditionOp = (typeof CONDITION_OPS)[number];
export interface ConditionRow { field: string; op: ConditionOp; value: string }

export const DECISION_TYPES = ['FERRY_CANCELLED', 'ETA_AFTER_LATEST', 'KSH_DATE_LT_5D', 'NO_AWIZACJA', 'DOC_MISSING', 'KSH_ROW_GONE',
  'TOWER_KSH_CONFLICT', 'KSH_FILE_ERROR', 'NO_POSITION', 'ROUTE_DEVIATION', 'SEFS_OUT_OF_TABLE', 'SEFS_INVOICE_DIFF', 'KR_OVER_3',
  'INSURANCE_EXPIRING', 'DWELL_OVER_FREE', 'BACKUP_FAILED',
  /* wyglad/W-naprawy (D-20261017-1450-01 §2 pkt 4): nowe sprawy A6, A2 L14, A3 */
  'KSH_DATES_CHECK', 'DELIVERED_CHECK', 'CMR_UPLOAD',
  /* A1 L17 (D-20261017-2130-01 §5) */
  'DELIVERY_UNCONFIRMED'] as const;

export type Audience = 'HHL' | 'KSH' | 'CARRIER';
export const AUDIENCES: Audience[] = ['HHL', 'KSH', 'CARRIER'];
export type SmsList = 'LOAD_SREM' | 'UNLOAD_BODEN';
export type SmsKind = 'ZONE_APPROACH' | 'ZONE_ENTER';

export interface CreatorActions {
  notify: Audience[];
  decision: string | null;
  email: Audience[];
  emailCritical: boolean;
  zones: SmsList[];
  smsKind: SmsKind;
  /** akcje spoza kreatora (np. risk:… z reguł startowych) — zachowane bez zmian */
  other: string[];
}

export interface CreatorDraft {
  name: string;
  group: TriggerGroup;
  trigger: string;
  rows: ConditionRow[];
  advanced: boolean;
  conditionJson: string;
  actions: CreatorActions;
  enabled: boolean;
}

export const emptyActions = (): CreatorActions => ({ notify: [], decision: null, email: [], emailCritical: false, zones: [], smsKind: 'ZONE_ENTER', other: [] });

export function emptyDraft(): CreatorDraft {
  return { name: '', group: 'event', trigger: 'GEOFENCE_ENTER', rows: [], advanced: false, conditionJson: 'true', actions: emptyActions(), enabled: true };
}

const NOTIFY_TXT: Record<Audience, string> = { HHL: 'notify_hhl', KSH: 'notify_ksh', CARRIER: 'notify_scx' };

export function actionsToText(a: CreatorActions): string[] {
  const out: string[] = [];
  for (const x of a.notify) out.push(NOTIFY_TXT[x]);
  if (a.decision) out.push(`decision:${a.decision}`);
  for (const x of a.email) out.push(`email:${x}${a.emailCritical ? ':critical' : ''}`);
  for (const x of a.zones) out.push(`smszone:${x}:${a.smsKind}`);
  return [...out, ...a.other];
}

export function actionsFromText(list: string[]): CreatorActions {
  const a = emptyActions();
  for (const raw of list) {
    const v = raw.trim();
    const low = v.toLowerCase();
    if (low === 'notify_hhl') a.notify.push('HHL');
    else if (low === 'notify_ksh') a.notify.push('KSH');
    else if (low === 'notify_scx' || low === 'notify_carrier') a.notify.push('CARRIER');
    else if (/^decision:/i.test(v)) a.decision = v.slice(9).toUpperCase();
    else if (low === 'email') a.email.push('HHL');
    else if (/^email:(hhl|ksh|carrier)(:critical)?$/i.test(v)) {
      const [, aud, crit] = v.split(':');
      a.email.push(aud.toUpperCase() as Audience);
      if (crit) a.emailCritical = true;
    } else if (/^smszone:(load_srem|unload_boden):(zone_approach|zone_enter)$/i.test(v)) {
      const [, list, kind] = v.split(':');
      a.zones.push(list.toUpperCase() as SmsList);
      a.smsKind = kind.toUpperCase() as SmsKind;
    } else a.other.push(v);
  }
  return a;
}

const num = (s: string): number | null => (/^-?\d+(\.\d+)?$/.test(s.trim()) ? Number(s) : null);
const lit = (s: string): unknown => {
  const t = s.trim();
  if (t === 'true') return true;
  if (t === 'false') return false;
  const n = num(t);
  return n === null ? t : n;
};

export function rowsToLogic(rows: ConditionRow[]): unknown {
  const parts = rows.filter((r) => r.field && r.value.trim() !== '').map((r) => ({ [r.op]: [{ var: r.field }, lit(r.value)] }));
  if (!parts.length) return true;
  return parts.length === 1 ? parts[0] : { and: parts };
}

/** JSONLogic → wiersze, gdy da się (porównania pola ze stałą, ewentualnie w „and”); inaczej null (tryb zaawansowany). */
export function logicToRows(logic: unknown): ConditionRow[] | null {
  if (logic === true || logic === 'true') return [];
  const one = (x: unknown): ConditionRow | null => {
    if (!x || typeof x !== 'object' || Array.isArray(x)) return null;
    const keys = Object.keys(x as object);
    if (keys.length !== 1 || !(CONDITION_OPS as readonly string[]).includes(keys[0])) return null;
    const args = (x as Record<string, unknown>)[keys[0]];
    if (!Array.isArray(args) || args.length !== 2) return null;
    const v = args[0] as { var?: unknown };
    if (!v || typeof v !== 'object' || typeof v.var !== 'string') return null;
    const c = args[1];
    if (c !== null && typeof c === 'object') return null;
    return { field: v.var, op: keys[0] as ConditionOp, value: String(c) };
  };
  if (logic && typeof logic === 'object' && !Array.isArray(logic) && Object.keys(logic).length === 1 && 'and' in (logic as object)) {
    const list = (logic as { and: unknown }).and;
    if (!Array.isArray(list)) return null;
    const rows = list.map(one);
    return rows.every(Boolean) ? (rows as ConditionRow[]) : null;
  }
  const r = one(logic);
  return r ? [r] : null;
}

export function draftCondition(d: CreatorDraft): string {
  if (d.advanced) return d.conditionJson.trim() || 'true';
  return JSON.stringify(rowsToLogic(d.rows));
}

export function draftFromRule(rule: WorkflowRule): CreatorDraft {
  const trigger = triggerToDb(rule.trigger);
  let parsed: unknown = true;
  try { parsed = JSON.parse(rule.condition || 'true'); } catch { parsed = null; }
  const rows = parsed === null ? null : logicToRows(parsed);
  return {
    name: rule.name,
    group: groupOf(trigger),
    trigger,
    rows: rows ?? [],
    advanced: rows === null,
    conditionJson: rule.condition || 'true',
    actions: actionsFromText(rule.actions),
    enabled: rule.enabled,
  };
}

export function validateDraft(d: CreatorDraft): 'b5_need_name' | 'b5_need_action' | 'b5_cond_bad_json' | null {
  if (!d.name.trim()) return 'b5_need_name';
  if (!actionsToText(d.actions).length) return 'b5_need_action';
  if (d.advanced) { try { JSON.parse(d.conditionJson.trim() || 'true'); } catch { return 'b5_cond_bad_json'; } }
  return null;
}

export interface DupWarning { kind: 'RULE' | 'BUILTIN'; text: string; rule?: string }

/** Lustro katalogu `wf_builtin_alarms()` z 0165 (dla trybu demo; produkcja pyta bazę). */
export const BUILTIN_ALARMS: { trigger: string; action: string; label: string }[] = [
  { trigger: 'SILENT_VEHICLE', action: 'notify', label: 'Cisza GPS — automat detect_silent_vehicles: ryzyko SILENT_VEHICLE i decyzja NO_POSITION' },
  { trigger: 'SILENT_VEHICLE', action: 'decision', label: 'Cisza GPS — ryzyko otwiera decyzję NO_POSITION (L-1)' },
  { trigger: 'SILENT_VEHICLE', action: 'email', label: 'Cisza GPS — e-mail decyzji automatycznej NO_POSITION' },
  { trigger: 'SILENT_VEHICLE', action: 'sms', label: 'Cisza GPS — SMS GPS_SILENT (D-19)' },
  { trigger: 'DELAY_DETECTED', action: 'notify', label: 'Opóźnienie — ryzyko ETA_BREACH i decyzja ETA_AFTER_LATEST (II-7, L-1)' },
  { trigger: 'DELAY_DETECTED', action: 'decision', label: 'Opóźnienie — decyzja ETA_AFTER_LATEST (L-1)' },
  { trigger: 'DELAY_DETECTED', action: 'email', label: 'Opóźnienie — e-mail decyzji automatycznej ETA_AFTER_LATEST' },
  { trigger: 'GEOFENCE_ENTER', action: 'sms', label: 'Wjazd na plac Śrem / Boden — SMS stref (0106, SMS-KSH-1H 0158)' },
  { trigger: 'GEOFENCE_ENTER', action: 'notify', label: 'Wjazd w strefę — statusy automatyczne i powiadomienia LOAD_STATUS (macierz)' },
  { trigger: 'GEOFENCE_EXIT', action: 'notify', label: 'Wyjazd ze strefy — statusy automatyczne i powiadomienia LOAD_STATUS (macierz)' },
  { trigger: 'STATUS_CHANGED', action: 'notify', label: 'Zmiana statusu — powiadomienia LOAD_STATUS (macierz)' },
  { trigger: 'FERRY_STATUS', action: 'notify', label: 'Status promu — ryzyko FERRY i decyzja FERRY_CANCELLED (FERRY-STATUS, L-9)' },
  { trigger: 'FERRY_STATUS', action: 'decision', label: 'Status promu — decyzja FERRY_CANCELLED (L-1)' },
  { trigger: 'SCHEDULE_DATE_CRITICAL', action: 'notify', label: 'Zmiana daty — ryzyko LATE_DATE_CHANGE i decyzja KSH_DATE_LT_5D (DATY-67)' },
  { trigger: 'SCHEDULE_DATE_CRITICAL', action: 'decision', label: 'Zmiana daty — decyzja KSH_DATE_LT_5D (L-1)' },
  { trigger: 'MILESTONE_UNLOADED', action: 'sms', label: 'Rozładunek — SMS potwierdzenia rozładunku (tower-sms-rozladunek)' },
  { trigger: 'RISK_RAISED', action: 'decision', label: 'Ryzyko — automat L-1 otwiera decyzję dla rodzajów z katalogu (l1_decision_type)' },
];

const actionType = (t: string): string => (t.startsWith('notify_') ? 'notify' : t.startsWith('smszone:') ? 'sms' : t.split(':')[0]);
const actionKey = (t: string): string => t.replace(/:critical$/, '').toLowerCase();

/** Demo: ta sama logika co `wf_duplicate_check` (inna reguła: wyzwalacz + warunek (albo „zawsze”) + wspólna akcja; wbudowany alarm). */
export function localDuplicateCheck(rules: WorkflowRule[], trigger: string, condition: string, actions: string[], excludeId?: string): DupWarning[] {
  const out: DupWarning[] = [];
  const t = triggerToDb(trigger);
  const norm = (c: string) => { try { return JSON.stringify(JSON.parse(c || 'true')); } catch { return c; } };
  const c = norm(condition);
  for (const r of rules) {
    if (r.id === excludeId || triggerToDb(r.trigger) !== t) continue;
    const rc = norm(r.condition);
    if (!(rc === c || rc === 'true' || c === 'true')) continue;
    const mine = new Set(actions.map(actionKey));
    if (r.actions.some((x) => mine.has(actionKey(x)))) out.push({ kind: 'RULE', rule: r.name, text: `Reguła „${r.name}”${r.enabled ? '' : ' (wyłączona)'} ma ten sam wyzwalacz, warunek i akcję` });
  }
  const types = new Set(actions.map(actionType));
  for (const b of BUILTIN_ALARMS) if (b.trigger === t && types.has(b.action)) out.push({ kind: 'BUILTIN', text: b.label });
  for (const a of actions) if (a.startsWith('decision:')) out.push({ kind: 'BUILTIN', text: `Decyzję ${a.slice(9)} otwiera też automat (L-1) — reguła nie otworzy drugiej, gdy ta jest otwarta` });
  return out.filter((w, i) => out.findIndex((x) => x.text === w.text) === i);
}
