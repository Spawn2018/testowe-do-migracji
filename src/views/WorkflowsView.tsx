/**
 * Automatyzacje — B-5 (decyzja właściciela 05.10, ostateczna): przycisk „Nowa automatyzacja” (tylko HHL_ADMIN)
 * i kreator reguł w oknie: nazwa, wyzwalacz (zdarzenie / status / ryzyko / termin), warunki, akcje (powiadomienie,
 * decyzja, e-mail, SMS według zasad stref), włącz/wyłącz, edycja, usuwanie, historia zmian (kto, kiedy, co).
 * Zapis do tego samego silnika co 0094 (tabela `workflows`) — ONE-MECH; ostrzeżenie o duplikacie przed zapisem.
 */
import { useEffect, useMemo, useState } from 'react';
import { useTowerStore } from '../store/useTowerStore';
import { t, tp } from '../i18n/messages';
import { fmtDateTime } from '../lib/time';
import { wt } from '../i18n/p4cWf';
import { decText } from '../i18n/decisions';
import { workflowDisplayName } from '../lib/enumLabels';
import { PROD_BUILD, canManageWorkflows } from '../lib/prodFacade';
import {
  AUDIENCES, CONDITION_FIELDS, CONDITION_OPS, DECISION_TYPES, TRIGGER_GROUPS, actionsToText, draftCondition, draftFromRule,
  emptyDraft, localDuplicateCheck, validateDraft, type Audience, type ConditionRow, type CreatorDraft, type DupWarning,
  type SmsKind, type SmsList, type TriggerGroup,
} from '../lib/workflowCreator';
import { triggerToDb } from '../data/workflowMap';
import type { WorkflowRule } from '../types';
import { AutoRulesList } from '../components/automations/AutoRulesList';
import { autoMetaOf } from '../lib/p4cSource';
import { getNowIso } from '../lib/frozenNow';
import { rulesReady } from '../lib/p8dReady';
import { RulesPage } from '../components/automations/RulesPage';

/** tryb Supabase — stała z kompilacji, by paczka demo nie zawierała klienta bazy (I-2) */
const LIVE = import.meta.env.VITE_AUTH_MODE === 'supabase';

const GROUPS: TriggerGroup[] = ['event', 'status', 'risk', 'deadline'];
const SMS_LISTS: SmsList[] = ['LOAD_SREM', 'UNLOAD_BODEN'];
const SMS_KINDS: SmsKind[] = ['ZONE_APPROACH', 'ZONE_ENTER'];

interface HistRow { at: string; who: string; action: string; ruleName: string; what: string }

function fmtWhen(iso: string): string {
  const out = fmtDateTime(iso);
  return out === '—' ? iso : out;
}

async function fetchHistory(id: string | null): Promise<HistRow[]> {
  if (import.meta.env.VITE_AUTH_MODE !== 'supabase') return [];
  const m = await import('../data/workflowServer');
  const rows = await m.loadRuleHistory(id, id ? 50 : 100);
  return rows.map((r) => ({ at: r.at, who: r.who, action: r.action, ruleName: r.ruleName, what: m.historyWhat(r) }));
}

function HistoryList({ id, locale }: { id: string | null; locale: Parameters<typeof t>[0] }) {
  const live = LIVE;
  const [rows, setRows] = useState<HistRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (!live) return;
    let on = true;
    fetchHistory(id).then((r) => { if (on) setRows(r); }).catch((e) => { if (on) setErr(e instanceof Error ? e.message : String(e)); });
    return () => { on = false; };
  }, [id, live]);
  if (!live) return <div className="note" data-wf-history="demo">{t(locale, 'b5_history_demo')}</div>;
  if (err) return <div className="note" data-wf-history="error">{err}</div>;
  if (!rows) return <div className="note" data-wf-history="loading">…</div>;
  if (!rows.length) return <div className="note" data-wf-history="empty">{t(locale, 'b5_history_empty')}</div>;
  return (
    <ul className="wf-history" data-wf-history="rows">
      {rows.map((r, i) => (
        <li key={i}><b>{fmtWhen(r.at)}</b> · {r.who} · {t(locale, `b5_hist_${r.action}`)}{id ? '' : ` · „${r.ruleName}”`}{r.what ? ` · ${r.what}` : ''}</li>
      ))}
    </ul>
  );
}

/**
 * wyglad/P8-d — Automatyzacje według E35: gdy jest źródło własnych reguł (`rulesReady()`, demo), strona `RulesPage`
 * (Działa samo · Własne reguły · Przebiegi · Historia zmian, kreator „Gdy … wtedy …”). Bez źródła (produkcja do
 * podłączenia w P8) — dzisiejszy widok z kreatorem B-5.
 */
export function WorkflowsView() {
  return rulesReady() ? <RulesPage /> : <LegacyWorkflowsView />;
}

function LegacyWorkflowsView() {
  const workflows = useTowerStore((s) => s.workflows);
  const toggleWorkflow = useTowerStore((s) => s.toggleWorkflow);
  const createWorkflow = useTowerStore((s) => s.createWorkflow);
  const updateWorkflow = useTowerStore((s) => s.updateWorkflow);
  const deleteWorkflow = useTowerStore((s) => s.deleteWorkflow);
  const pushToast = useTowerStore((s) => s.pushToast);
  const locale = useTowerStore((s) => s.locale);
  const role = useTowerStore((s) => s.role);
  const workflowFocus = useTowerStore((s) => s.workflowFocus);
  const loads = useTowerStore((s) => s.loads);
  const events = useTowerStore((s) => s.events);
  /* wyglad/P4-c (E35 pkt 1, L13): pierwsza zakładka „Działa samo”; wskazana reguła własna otwiera „Własne reguły” */
  const [wfTab, setWfTab] = useState<'auto' | 'own'>(workflowFocus ? 'own' : 'auto');
  useEffect(() => { if (workflowFocus) setWfTab('own'); }, [workflowFocus]);
  const autoMeta = useMemo(() => autoMetaOf(loads, events, getNowIso()), [loads, events]);
  const manage = canManageWorkflows(PROD_BUILD, undefined, PROD_BUILD ? undefined : role);
  const active = workflows.filter((w) => w.enabled).length;
  const focused = workflowFocus ? workflows.find((w) => w.id === workflowFocus || w.name === workflowFocus) : undefined;
  const trgLabel = (code: string) => { const k = `b5_trg_${triggerToDb(code)}`; const v = t(locale, k); return v === k ? code : v; };

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<WorkflowRule | null>(null);
  const [draft, setDraft] = useState<CreatorDraft>(emptyDraft);
  const [warnings, setWarnings] = useState<DupWarning[] | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAllHist, setShowAllHist] = useState(false);

  const openNew = () => { setEditing(null); setDraft(emptyDraft()); setWarnings(null); setError(null); setOpen(true); };
  const openEdit = (w: WorkflowRule) => { setEditing(w); setDraft(draftFromRule(w)); setWarnings(null); setError(null); setOpen(true); };
  const close = () => { setOpen(false); setWarnings(null); setError(null); };
  const patch = (p: Partial<CreatorDraft>) => { setDraft((d) => ({ ...d, ...p })); setWarnings(null); };
  const patchAct = (p: Partial<CreatorDraft['actions']>) => { setDraft((d) => ({ ...d, actions: { ...d.actions, ...p } })); setWarnings(null); };
  const toggleIn = <T,>(list: T[], v: T): T[] => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const fields = useMemo(() => CONDITION_FIELDS[draft.group], [draft.group]);

  const commit = () => {
    const actions = actionsToText(draft.actions);
    const condition = draftCondition(draft);
    const description = `${trgLabel(draft.trigger)} → ${actions.join(', ')}`;
    if (editing) {
      const same = JSON.stringify(actions) === JSON.stringify(editing.actions);
      updateWorkflow(editing.id, {
        name: draft.name.trim(), description, trigger: draft.trigger, condition, enabled: draft.enabled,
        ...(same ? {} : { actions }),
      });
    } else {
      createWorkflow({ name: draft.name.trim(), description, trigger: draft.trigger, condition, actions, enabled: draft.enabled });
    }
    pushToast(tp(locale, 'b5_ts_saved', { name: draft.name.trim() }), 'LOW');
    close();
  };

  const save = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const bad = validateDraft(draft);
    if (bad) { setError(t(locale, bad)); return; }
    setError(null);
    if (warnings && warnings.length) { commit(); return; } // „Zapisz mimo to” — ostrzeżenie już pokazane
    const actions = actionsToText(draft.actions);
    const condition = draftCondition(draft);
    setChecking(true);
    try {
      const found = import.meta.env.VITE_AUTH_MODE === 'supabase'
        ? await (await import('../data/workflowServer')).serverDuplicateCheck(draft.trigger, condition, actions, editing?.id)
        : localDuplicateCheck(workflows, draft.trigger, condition, actions, editing?.id);
      if (found.length) { setWarnings(found); return; }
      commit();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setChecking(false);
    }
  };

  const remove = () => {
    if (!editing) return;
    if (editing.code && editing.code.startsWith('START-')) { setError(t(locale, 'b5_delete_start')); return; }
    if (typeof window !== 'undefined' && !window.confirm(tp(locale, 'b5_delete_confirm', { name: editing.name }))) return;
    deleteWorkflow(editing.id);
    close();
  };

  const setRow = (i: number, p: Partial<ConditionRow>) => patch({ rows: draft.rows.map((r, j) => (j === i ? { ...r, ...p } : r)) });

  return (
    <div className="panel workflow-page page-sections" data-page="workflows" style={{ margin: 12 }}>
      <header className="panel-hd">
        <h2>{t(locale, 'nav_wf')}</h2>
        <span className="sub">{active} {t(locale, 'wf_active_n')} · {workflows.length} {t(locale, 'wf_rules_n')}</span>
        <div className="spacer" />
        {manage ? <button type="button" className="btn" data-wf-new onClick={openNew}>{t(locale, 'b5_new')}</button> : null}
      </header>
      <div
        className="dtabs wf-tabs"
        role="tablist"
        aria-label={t(locale, 'nav_wf')}
        onKeyDown={(e) => {
          /* klawiatura: strzałki przełączają zakładki (wzorzec tablist) */
          if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft' && e.key !== 'Home' && e.key !== 'End') return;
          e.preventDefault();
          const next = e.key === 'Home' ? 'auto' : e.key === 'End' ? 'own' : wfTab === 'auto' ? 'own' : 'auto';
          setWfTab(next);
          document.getElementById(`wf-tab-${next}`)?.focus();
        }}
      >
        <button type="button" role="tab" id="wf-tab-auto" aria-controls="wf-panel-auto" aria-selected={wfTab === 'auto'} tabIndex={wfTab === 'auto' ? 0 : -1} data-wf-tab="auto" onClick={() => setWfTab('auto')}>
          {wt(locale, 'p4c_wf_tab_auto')}
        </button>
        <button type="button" role="tab" id="wf-tab-own" aria-controls="wf-panel-own" aria-selected={wfTab === 'own'} tabIndex={wfTab === 'own' ? 0 : -1} data-wf-tab="own" onClick={() => setWfTab('own')}>
          {wt(locale, 'p4c_wf_tab_own', { n: workflows.length })}
        </button>
      </div>
      {/* oba panele w drzewie (aria-controls), niewybrany ukryty atrybutem hidden */}
      <div className="panel-bd flush" role="tabpanel" id="wf-panel-auto" aria-labelledby="wf-tab-auto" hidden={wfTab !== 'auto'}>
        <AutoRulesList locale={locale} meta={autoMeta} />
      </div>
      <div role="tabpanel" id="wf-panel-own" aria-labelledby="wf-tab-own" hidden={wfTab !== 'own'}>
      {workflowFocus ? (
        <section className="note" data-workflow-preview={workflowFocus} style={{ margin: '0 12px 8px' }}>
          <b>{t(locale, 'wf_preview')}</b>
          <div data-content>{focused?.name ?? workflowFocus}</div>
          {focused ? <div className="rule" data-content>{focused.description || `${trgLabel(focused.trigger)} → ${focused.actions.join(', ')}`}</div> : null}
          {focused ? <div className="wf-meta" data-content>{trgLabel(focused.trigger)}{tp(locale, 'a6_wf_cond', { c: focused.condition })}</div> : null}
        </section>
      ) : null}
      <div className="panel-bd flush">
        {workflows.map((w) => (
          <div key={w.id} className="wf" data-wf-id={w.id} data-wf-open={workflowFocus === w.id || workflowFocus === w.name ? '1' : '0'}>
            <button type="button" className="sw" aria-pressed={w.enabled} aria-label={tp(locale, w.enabled ? 'a6_wf_toggle_off' : 'a6_wf_toggle_on', { name: workflowDisplayName(w, locale) })} onClick={() => toggleWorkflow(w.id)} disabled={!manage} />
            <div className="wf-copy"><b data-content>{workflowDisplayName(w, locale)}</b><span className="rule" data-content>{w.description || `${trgLabel(w.trigger)} → ${w.actions.join(', ')}`}</span><span className="wf-meta" data-content>{trgLabel(w.trigger)}{tp(locale, 'a6_wf_cond', { c: w.condition })}</span></div>
            <span className="wf-count">{w.runCount}× {t(locale, 'wf_runs')}</span>
            {manage ? <button type="button" className="chipbtn wf-edit" onClick={() => openEdit(w)}>{t(locale, 'b5_edit_rule')}</button> : null}
          </div>
        ))}
        <div className="note">{t(locale, 'b5_note')}{workflows.some((w) => w.code?.startsWith('START-')) ? ` ${t(locale, 'b5_start_note')}` : ''}</div>
        {manage ? (
          <details className="wf-history-all" open={showAllHist} onToggle={(e) => setShowAllHist((e.target as HTMLDetailsElement).open)}>
            <summary>{t(locale, 'b5_history_all')}</summary>
            {showAllHist ? <HistoryList id={null} locale={locale} /> : null}
          </details>
        ) : null}
      </div>
      </div>

      {manage && open ? <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && close()}>
        <section className="panel wf-creator" role="dialog" aria-modal="true" aria-labelledby="wf-create-title" data-wf-creator>
          <header className="panel-hd"><div><h2 id="wf-create-title">{t(locale, editing ? 'b5_edit' : 'b5_new')}</h2><span className="sub">{t(locale, 'b5_form_sub')}</span></div><div className="spacer" /><button type="button" className="iconbtn" aria-label={t(locale, 'a6_wf_close')} onClick={close}>×</button></header>
          <form className="panel-bd" onSubmit={save}>
            <label className="form-field"><span>{t(locale, 'b5_name')}</span><input autoFocus required maxLength={120} className="input" value={draft.name} onChange={(e) => patch({ name: e.target.value })} placeholder={t(locale, 'b5_name_ph')} /></label>

            <div className="form-field"><span>{t(locale, 'b5_trigger_group')}</span>
              <div className="wf-groups" role="radiogroup">
                {GROUPS.map((g) => (
                  <label key={g} className="switchline"><input type="radio" name="wf-group" checked={draft.group === g} onChange={() => patch({ group: g, trigger: TRIGGER_GROUPS[g][0], rows: [] })} /><span>{t(locale, `b5_grp_${g}`)}</span></label>
                ))}
              </div>
              <select className="input" data-wf-trigger value={draft.trigger} onChange={(e) => patch({ trigger: e.target.value })}>
                {TRIGGER_GROUPS[draft.group].map((c) => <option key={c} value={c}>{trgLabel(c)}</option>)}
              </select>
            </div>

            <div className="form-field"><span>{t(locale, 'b5_conditions')} <small>{t(locale, 'b5_conditions_hint')}</small></span>
              {draft.advanced ? (
                <textarea className="input" data-wf-condition-json value={draft.conditionJson} onChange={(e) => patch({ conditionJson: e.target.value })} />
              ) : (
                <>
                  {draft.rows.map((r, i) => (
                    <div key={i} className="wf-cond-row">
                      <select className="input" value={r.field} onChange={(e) => setRow(i, { field: e.target.value })}>
                        {[...new Set([...fields, r.field])].map((f) => <option key={f} value={f}>{t(locale, `b5_fld_${f.replace('.', '_')}`) === `b5_fld_${f.replace('.', '_')}` ? f : t(locale, `b5_fld_${f.replace('.', '_')}`)}</option>)}
                      </select>
                      <select className="input" value={r.op} onChange={(e) => setRow(i, { op: e.target.value as ConditionRow['op'] })}>
                        {CONDITION_OPS.map((o) => <option key={o} value={o}>{o === 'in' ? t(locale, 'b5_op_in') : o}</option>)}
                      </select>
                      <input className="input" value={r.value} onChange={(e) => setRow(i, { value: e.target.value })} />
                      <button type="button" className="iconbtn" aria-label={t(locale, 'b5_cond_remove')} onClick={() => patch({ rows: draft.rows.filter((_, j) => j !== i) })}>×</button>
                    </div>
                  ))}
                  <button type="button" className="chipbtn" data-wf-cond-add onClick={() => patch({ rows: [...draft.rows, { field: fields[0], op: '==', value: '' }] })}>{t(locale, 'b5_cond_add')}</button>
                </>
              )}
              <label className="switchline"><input type="checkbox" checked={draft.advanced} onChange={(e) => patch({ advanced: e.target.checked, conditionJson: e.target.checked ? draftCondition({ ...draft, advanced: false }) : draft.conditionJson })} /><span>{t(locale, 'b5_cond_advanced')}</span></label>
            </div>

            <fieldset className="form-field wf-actions-set"><span>{t(locale, 'b5_actions')} <small>{t(locale, 'b5_actions_hint')}</small></span>
              <div className="wf-act" data-wf-act="notify"><b>{t(locale, 'b5_act_notify')}</b>
                {AUDIENCES.map((a: Audience) => <label key={a} className="switchline"><input type="checkbox" checked={draft.actions.notify.includes(a)} onChange={() => patchAct({ notify: toggleIn(draft.actions.notify, a) })} /><span>{t(locale, `b5_aud_${a}`)}</span></label>)}
              </div>
              <div className="wf-act" data-wf-act="decision"><b>{t(locale, 'b5_act_decision')}</b>
                <select className="input" value={draft.actions.decision ?? ''} onChange={(e) => patchAct({ decision: e.target.value || null })}>
                  <option value="">—</option>
                  {DECISION_TYPES.map((d) => <option key={d} value={d}>{decText(locale, `dec_type_${d}`, d)}</option>)}
                </select>
              </div>
              <div className="wf-act" data-wf-act="email"><b>{t(locale, 'b5_act_email')}</b>
                {AUDIENCES.map((a: Audience) => <label key={a} className="switchline"><input type="checkbox" checked={draft.actions.email.includes(a)} onChange={() => patchAct({ email: toggleIn(draft.actions.email, a) })} /><span>{t(locale, `b5_aud_${a}`)}</span></label>)}
                <label className="switchline"><input type="checkbox" checked={draft.actions.emailCritical} onChange={(e) => patchAct({ emailCritical: e.target.checked })} /><span>{t(locale, 'b5_act_email_critical')}</span></label>
              </div>
              <div className="wf-act" data-wf-act="sms"><b>{t(locale, 'b5_act_smszone')}</b> <small>{t(locale, 'b5_act_sms_hint')}</small>
                {SMS_LISTS.map((l) => <label key={l} className="switchline"><input type="checkbox" checked={draft.actions.zones.includes(l)} onChange={() => patchAct({ zones: toggleIn(draft.actions.zones, l) })} /><span>{t(locale, `b5_sms_${l}`)}</span></label>)}
                <select className="input" value={draft.actions.smsKind} onChange={(e) => patchAct({ smsKind: e.target.value as SmsKind })}>
                  {SMS_KINDS.map((k) => <option key={k} value={k}>{t(locale, `b5_sms_${k}`)}</option>)}
                </select>
              </div>
              {draft.actions.other.length ? <div className="wf-act"><b>{t(locale, 'b5_act_other')}</b> <span className="wf-meta">{draft.actions.other.join(', ')}</span></div> : null}
            </fieldset>

            <label className="switchline creator-enabled"><input type="checkbox" checked={draft.enabled} onChange={(e) => patch({ enabled: e.target.checked })} /><span>{t(locale, 'b5_enabled')}</span></label>

            {error ? <div className="note bad" role="alert" data-wf-error>{error}</div> : null}
            {warnings && warnings.length ? (
              <div className="note warn" role="alert" data-wf-dup>
                <b>{t(locale, 'b5_dup_title')}</b>
                <ul>{warnings.map((w, i) => <li key={i} data-dup-kind={w.kind}>{w.text}</li>)}</ul>
                <div>{t(locale, 'b5_dup_note')}</div>
              </div>
            ) : null}

            <div className="creator-actions">
              <button type="submit" className="btn" disabled={checking} data-wf-save>{checking ? t(locale, 'b5_dup_checking') : t(locale, warnings && warnings.length ? 'b5_save_anyway' : 'b5_save')}</button>
              <button type="button" className="btn ghost" onClick={close}>{t(locale, 'b5_cancel')}</button>
              <div className="spacer" />
              {editing ? <button type="button" className="btn ghost danger" data-wf-delete onClick={remove}>{t(locale, 'b5_delete')}</button> : null}
            </div>

            {editing ? (
              <details className="wf-history-one">
                <summary>{t(locale, 'b5_history')}</summary>
                <HistoryList id={editing.id} locale={locale} />
              </details>
            ) : null}
          </form>
        </section>
      </div> : null}
    </div>
  );
}
