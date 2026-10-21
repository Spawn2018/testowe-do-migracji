/**
 * wyglad/P6 (E7 pkt 1: „Centrum decyzji i Wymaga decyzji połączone”) — otwarte decyzje do kart „Do zrobienia”.
 * To samo zapytanie i te same funkcje bazy co dotychczasowe Centrum decyzji (DEC-2): `decisions` z katalogiem
 * `decision_types`, rozstrzygnięcie `decision_resolve`, odłożenie `decision_snooze`. Tylko produkcja; demo — `p6Source.ts`.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { OrgKind } from '../../types';
import type { DecisionOption, TodoDecision } from '../../lib/p6Todo';

type DecRow = {
  id: string;
  type_code: string;
  status: string;
  title: string;
  due_at: string | null;
  escalated_at: string | null;
  load_id: string | null;
  risk_id: string | null;
  detail?: Record<string, unknown> | null;
  decision_types: { title_key: string; options: DecisionOption[]; decider_role: string } | null;
};

const ORG: Record<string, OrgKind> = { CARRIER: 'SCX', CLIENT: 'KSH', HHL: 'HHL' };

export function decisionFromRow(r: DecRow): TodoDecision {
  const role = r.decision_types?.decider_role ?? null;
  return {
    id: r.id, typeCode: r.type_code, titleKey: r.decision_types?.title_key ?? null, title: r.title,
    dueAt: r.due_at, escalatedAt: r.escalated_at, loadId: r.load_id,
    decider: (role && ORG[role]) || 'HHL', deciderRole: role, status: r.status,
    options: r.decision_types?.options ?? [],
    riskId: r.risk_id ?? null,
    detail: r.detail ?? null,
  };
}

export interface DecisionsApi {
  rows: TodoDecision[];
  error: string | null;
  refresh: () => Promise<void>;
  /** wynik `decision_resolve` (ui_hint) albo błąd; `payload` = daty przy PROPOSE_DATE (#384) */
  resolve: (
    id: string,
    option: string,
    note: string | null,
    payload?: Record<string, unknown> | null,
  ) => Promise<{ hint: string | null; error: string | null }>;
  snooze: (id: string, hours: number) => Promise<string | null>;
}

export function useOpenDecisions(enabled: boolean): DecisionsApi {
  const [rows, setRows] = useState<TodoDecision[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    /* warunek wpisany wprost — paczka demo bez klienta Supabase (I-2) */
    if (import.meta.env.VITE_AUTH_MODE !== 'supabase' || !enabled) return;
    const { getSupabase } = await import('../../auth/client');
    const sb = await getSupabase();
    const q = await sb
      .from('decisions')
      .select('id,type_code,status,title,due_at,escalated_at,load_id,risk_id,detail,decision_types(title_key,options,decider_role)')
      .in('status', ['NEW', 'ASSIGNED', 'SNOOZED'])
      .order('due_at', { ascending: true, nullsFirst: false })
      .limit(50);
    if (q.error) {
      setError(q.error.message);
      return;
    }
    setRows(((q.data ?? []) as unknown as DecRow[]).map(decisionFromRow));
    setError(null);
  }, [enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const resolve = useCallback(async (
    id: string,
    option: string,
    note: string | null,
    payload?: Record<string, unknown> | null,
  ) => {
    if (import.meta.env.VITE_AUTH_MODE !== 'supabase') return { hint: null, error: null };
    const { getSupabase } = await import('../../auth/client');
    const sb = await getSupabase();
    const args: Record<string, unknown> = { p_decision: id, p_option: option, p_note: note };
    if (payload != null) args.p_payload = payload;
    const { data, error: e } = await sb.rpc('decision_resolve', args);
    if (e) return { hint: null, error: e.message };
    await refresh();
    return { hint: (data as { ui_hint?: string } | null)?.ui_hint ?? null, error: null };
  }, [refresh]);

  const snooze = useCallback(async (id: string, hours: number) => {
    if (import.meta.env.VITE_AUTH_MODE !== 'supabase') return null;
    const until = new Date(Date.now() + hours * 3600_000).toISOString();
    const { getSupabase } = await import('../../auth/client');
    const sb = await getSupabase();
    const { error: e } = await sb.rpc('decision_snooze', { p_decision: id, p_until: until });
    if (e) return e.message;
    await refresh();
    return null;
  }, [refresh]);

  return useMemo(() => ({ rows, error, refresh, resolve, snooze }), [rows, error, refresh, resolve, snooze]);
}
