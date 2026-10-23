/**
 * #413 / E35 Z2–Z3 — źródło Automatyzacji na produkcji (store + RPC historii / soft-delete).
 * Powód z UI: przyjmujemy; audit_log z triggera nie ma pola reason bez migracji — nie zmyślamy wpisu.
 */
import { getSupabase } from '../auth/client';
import { loadRuleHistory } from '../data/workflowServer';
import { useTowerStore } from '../store/useTowerStore';
import { getNowIso } from './frozenNow';
import { draftToWorkflow, histFromServer, runsToRuleRuns, workflowToOwn } from './p8dMap';
import {
  builtinOverlap, dwellHits, sameRules, type CheckHit, type CheckResult, type OwnRule, type RuleDraft,
  type RuleHist, type RuleRun, type Visit, type ZoneOption,
} from './p8dRules';
import { canManageWorkflows } from './prodFacade';

const since30 = (now: string) => Date.parse(now) - 30 * 86_400_000;

function storeRules(): OwnRule[] {
  const s = useTowerStore.getState();
  const now = getNowIso();
  const since = since30(now);
  return s.workflows
    .map((w) => workflowToOwn(w, s.workflowRuns, since))
    .filter((r): r is OwnRule => r != null);
}

async function prodRules(): Promise<OwnRule[]> {
  return storeRules();
}

async function prodRuns(): Promise<RuleRun[]> {
  const s = useTowerStore.getState();
  const names = new Map(s.workflows.map((w) => [w.id, w.name]));
  /* soft-deleted START mogą mieć przebiegi — nazwa z runów bez wiersza w workflows: zostaw id */
  const codes = new Map(s.loads.map((l) => [l.id, l.code]));
  return runsToRuleRuns(s.workflowRuns, names, codes, since30(getNowIso()));
}

async function prodHistory(): Promise<RuleHist[]> {
  try {
    const rows = await loadRuleHistory(null, 200);
    return histFromServer(rows);
  } catch {
    return [];
  }
}

async function prodZones(): Promise<ZoneOption[]> {
  return useTowerStore.getState().geofences
    .filter((g) => g.active)
    .map((g) => ({ id: g.id, name: g.name, type: g.type }));
}

function visitsFromEvents(): Visit[] {
  const s = useTowerStore.getState();
  const codeOf = new Map(s.loads.map((l) => [l.id, l.code]));
  const enters = new Map<string, { code: string; loadId: string; zoneId: string; enter: string }>();
  const out: Visit[] = [];
  const geo = s.events
    .filter((e) => e.type === 'GEOFENCE_ENTER' || e.type === 'GEOFENCE_EXIT')
    .slice()
    .sort((a, b) => a.at.localeCompare(b.at));
  for (const e of geo) {
    const zoneId = String(e.payload?.geofence_id ?? '');
    if (!zoneId) continue;
    const key = `${e.loadId}:${zoneId}`;
    if (e.type === 'GEOFENCE_ENTER') {
      enters.set(key, { code: codeOf.get(e.loadId) ?? e.loadId, loadId: e.loadId, zoneId, enter: e.at });
    } else {
      const ent = enters.get(key);
      if (ent) {
        out.push({ ...ent, exit: e.at });
        enters.delete(key);
      }
    }
  }
  for (const ent of enters.values()) out.push({ ...ent, exit: null });
  return out;
}

async function prodCheck(d: RuleDraft, selfId: string | null): Promise<CheckResult> {
  const now = getNowIso();
  const since = since30(now);
  const zones = await prodZones();
  const rules = storeRules();
  let hits: CheckHit[] = [];
  const w = d.when;
  if (w.kind === 'zone') hits = dwellHits(visitsFromEvents(), w.zoneId, w.minutes, now);
  else if (w.kind === 'status') {
    const codeOf = new Map(useTowerStore.getState().loads.map((l) => [l.id, l.code]));
    hits = useTowerStore.getState().events
      .filter((e) => (e.type === 'STATUS_CHANGED' || e.type === 'STATUS_AUTO') && Date.parse(e.at) >= since)
      .filter((e) => w.status === 'ANY' || String(e.payload?.status ?? '') === w.status
        || String(e.payload?.status ?? '') === String(e.payload?.new_status ?? ''))
      .map((e) => ({ code: codeOf.get(e.loadId) ?? '', loadId: e.loadId, at: e.at }));
  } else {
    /* issue / daily: bez pewnego źródła w store → puste hits (lepiej pusto niż zmyślone; E35 check). */
    hits = [];
  }
  return {
    hits: hits.sort((a, b) => b.at.localeCompare(a.at)),
    builtins: builtinOverlap(w, zones),
    same: sameRules(d, rules, selfId),
  };
}

async function prodSave(id: string | null, d: RuleDraft, _reason: string | null): Promise<{ ok: boolean; rule?: OwnRule; error?: string }> {
  /* _reason: E35 Z3 — UI wymaga przy zmianie; bez migracji audit nie ma pola reason. */
  const patch = draftToWorkflow(d);
  const store = useTowerStore.getState();
  try {
    if (id) {
      store.updateWorkflow(id, patch);
      const rule = workflowToOwn({ ...patch, id, runCount: store.workflows.find((w) => w.id === id)?.runCount ?? 0 }, store.workflowRuns, since30(getNowIso()));
      return rule ? { ok: true, rule } : { ok: true };
    }
    const newId = store.createWorkflow(patch);
    const rule: OwnRule = {
      id: newId, name: d.name.trim(), when: d.when, then: { ...d.then, notify: [...d.then.notify] },
      enabled: d.enabled, runs30: 0, lastRunAt: null,
    };
    return { ok: true, rule };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'zapis nieudany' };
  }
}

async function prodSetEnabled(id: string, on: boolean, _reason: string): Promise<{ ok: boolean }> {
  try {
    useTowerStore.getState().updateWorkflow(id, { enabled: on });
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

async function prodRemove(id: string, _reason: string): Promise<{ ok: boolean }> {
  /* E35 Z3: soft-delete (removed_at) — przebiegi zostają; hard DELETE kasowałby workflow_runs. */
  try {
    const sb = await getSupabase();
    const { error } = await sb.from('workflows').update({ enabled: false, removed_at: new Date().toISOString() }).eq('id', id);
    if (error) return { ok: false };
    useTowerStore.setState((s) => ({ workflows: s.workflows.filter((w) => w.id !== id) }));
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export function prodRulesSource() {
  const admin = canManageWorkflows();
  return {
    rules: prodRules,
    runs: prodRuns,
    history: prodHistory,
    zones: prodZones,
    check: prodCheck,
    save: admin ? prodSave : null,
    setEnabled: admin ? prodSetEnabled : null,
    remove: admin ? prodRemove : null,
  };
}
