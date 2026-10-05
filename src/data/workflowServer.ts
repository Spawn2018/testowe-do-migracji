/**
 * B-5 (0165) — kreator reguł w trybie Supabase: ostrzeżenie o duplikacie przed zapisem (`wf_duplicate_check`)
 * i historia zmian reguły z audit_log (`workflow_rule_history`). Obie funkcje bazy: tylko HHL_ADMIN.
 */
import { getSupabase } from '../auth/client';
import { actionFromText, conditionToDb, triggerToDb } from './workflowMap';
import type { DupWarning } from '../lib/workflowCreator';

export interface RuleHistoryRow { at: string; who: string; action: string; workflowId: string; ruleName: string; changes: Record<string, unknown>; source: string | null }

export async function serverDuplicateCheck(trigger: string, condition: string, actions: string[], excludeId?: string): Promise<DupWarning[]> {
  const sb = await getSupabase();
  const r = await sb.rpc('wf_duplicate_check', {
    p_trigger: triggerToDb(trigger), p_condition: conditionToDb(condition), p_actions: actions.map(actionFromText),
    p_exclude: excludeId && /^[0-9a-f-]{36}$/i.test(excludeId) ? excludeId : null,
  });
  if (r.error) throw new Error(r.error.message);
  return ((r.data ?? []) as { kind: 'RULE' | 'BUILTIN'; text: string; rule?: string }[]).map((x) => ({ kind: x.kind, text: x.text, rule: x.rule }));
}

export async function loadRuleHistory(workflowId: string | null, limit = 100): Promise<RuleHistoryRow[]> {
  const sb = await getSupabase();
  const r = await sb.rpc('workflow_rule_history', { p_workflow: workflowId, p_limit: limit });
  if (r.error) throw new Error(r.error.message);
  return ((r.data ?? []) as { at: string; who: string; action: string; workflow_id: string; rule_name: string; changes: Record<string, unknown>; source: string | null }[])
    .map((x) => ({ at: x.at, who: x.who, action: x.action, workflowId: x.workflow_id, ruleName: x.rule_name, changes: x.changes ?? {}, source: x.source }));
}

/** Krótki opis „co” dla wiersza historii: lista zmienionych pól (po polsku). */
export function historyWhat(row: RuleHistoryRow): string {
  const LABEL: Record<string, string> = { name: 'nazwa', trigger_type: 'wyzwalacz', condition: 'warunki', actions: 'akcje', enabled: 'włączona', description: 'opis' };
  const po = (row.changes.po ?? {}) as Record<string, unknown>;
  const przed = (row.changes.przed ?? {}) as Record<string, unknown>;
  if (row.action === 'ZMIENIONO') {
    return Object.keys(po).filter((k) => LABEL[k]).map((k) => (k === 'enabled' ? `${LABEL[k]}: ${przed[k] ? 'tak' : 'nie'} → ${po[k] ? 'tak' : 'nie'}`
      : k === 'name' ? `${LABEL[k]}: „${String(przed[k] ?? '')}” → „${String(po[k] ?? '')}”` : LABEL[k])).join(', ');
  }
  return '';
}
