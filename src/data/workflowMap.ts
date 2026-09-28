/**
 * 9.4 (28.09) — widok „Automatyzacje” na danych z bazy (0094/0095): mapowanie wierszy `workflows` /
 * `workflow_runs` na typy widoku i z powrotem. Wygląd bez zmian — kreator zapisuje przez API
 * (RLS `wf_all`: tylko HHL_ADMIN, walidacja `wf_validate` w bazie), lista i przełącznik czytają/zapisują tabelę.
 */
import type { WorkflowRule, WorkflowRun } from '../types';

export interface WorkflowDbRow {
  id: string; name: string; description: string | null; trigger_type: string;
  condition: unknown; actions: unknown; enabled: boolean;
}
export interface WorkflowRunDbRow {
  id: number; workflow_id: string; load_id: string | null; status: string; result: Record<string, unknown> | null; ran_at: string;
}
interface DbAction { type: string; audience?: string; kind?: string; severity?: string; title?: string; text?: string }

/** Wyzwalacze kreatora (makieta) ↔ typy zdarzeń w bazie. Pozostałe kody przechodzą bez zmian (baza je sprawdza). */
const UI_TO_DB: Record<string, string> = { POSITION_STALE: 'SILENT_VEHICLE', UNLOADED: 'MILESTONE_UNLOADED' };
const DB_TO_UI: Record<string, string> = { SILENT_VEHICLE: 'POSITION_STALE', MILESTONE_UNLOADED: 'UNLOADED' };
export const triggerToDb = (t: string): string => UI_TO_DB[t] ?? t;
export const triggerFromDb = (t: string): string => DB_TO_UI[t] ?? t;

const AUD_TO_UI: Record<string, string> = { HHL: 'notify_hhl', KSH: 'notify_ksh', CARRIER: 'notify_scx' };
const UI_TO_AUD: Record<string, string> = { notify_hhl: 'HHL', notify_ksh: 'KSH', notify_scx: 'CARRIER', notify_carrier: 'CARRIER' };

export function actionToText(a: DbAction): string {
  if (a.type === 'notify') return AUD_TO_UI[a.audience ?? ''] ?? `notify_${String(a.audience ?? '').toLowerCase()}`;
  if (a.type === 'risk') return `risk:${a.kind ?? ''}:${a.severity ?? ''}`;
  return a.type;
}

/** Tekst kreatora → akcja bazy: notify_hhl | notify_ksh | notify_scx | risk:RODZAJ:POZIOM | email | sms. */
export function actionFromText(s: string): DbAction {
  const v = s.trim();
  const low = v.toLowerCase();
  if (UI_TO_AUD[low]) return { type: 'notify', audience: UI_TO_AUD[low] };
  if (low === 'email' || low === 'sms') return { type: low };
  const m = v.match(/^risk:([A-Z_]+):([A-Z]+)$/i);
  if (m) return { type: 'risk', kind: m[1].toUpperCase(), severity: m[2].toUpperCase() };
  throw new Error(`Nieznana akcja „${v}” (dozwolone: notify_hhl, notify_ksh, notify_scx, risk:RODZAJ:POZIOM, email, sms)`);
}

export function conditionToDb(c: string): unknown {
  const s = c.trim() || 'true';
  try { return JSON.parse(s); } catch { throw new Error('Warunek: niepoprawny JSON (JSONLogic, np. {"==":[{"var":"payload.geofence_kind"},"PRE_ARRIVAL"]})'); }
}

export function workflowFromRow(r: WorkflowDbRow, okRuns: number): WorkflowRule {
  const acts = Array.isArray(r.actions) ? (r.actions as DbAction[]) : [];
  return {
    id: r.id,
    name: r.name,
    description: r.description ?? '',
    trigger: triggerFromDb(r.trigger_type),
    condition: typeof r.condition === 'string' ? r.condition : JSON.stringify(r.condition ?? true),
    actions: acts.map(actionToText),
    enabled: r.enabled,
    runCount: okRuns,
  };
}

export function workflowRunFromRow(r: WorkflowRunDbRow): WorkflowRun {
  const status: WorkflowRun['status'] = r.status === 'OK' ? 'OK' : r.status === 'SKIPPED' || r.status === 'QUEUED' ? 'SKIPPED' : 'ERROR';
  const res = r.result ?? {};
  const note = r.status === 'QUEUED' ? 'w kolejce'
    : typeof res.error === 'string' ? `${r.status}: ${res.error}`
      : typeof res.reason === 'string' ? res.reason : r.status;
  return { id: `wr-${r.id}`, workflowId: r.workflow_id, at: r.ran_at, status, note, loadId: r.load_id ?? undefined };
}

/** Wiersz do zapisu (insert/update) z reguły widoku. */
export function workflowToDb(rule: Partial<Omit<WorkflowRule, 'id' | 'runCount'>>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (rule.name !== undefined) row.name = rule.name;
  if (rule.description !== undefined) row.description = rule.description;
  if (rule.trigger !== undefined) row.trigger_type = triggerToDb(rule.trigger);
  if (rule.condition !== undefined) row.condition = conditionToDb(rule.condition);
  if (rule.actions !== undefined) row.actions = rule.actions.map(actionFromText);
  if (rule.enabled !== undefined) row.enabled = rule.enabled;
  return row;
}
