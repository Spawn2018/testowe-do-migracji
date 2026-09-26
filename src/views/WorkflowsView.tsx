import { useState } from 'react';
import { useTowerStore } from '../store/useTowerStore';
import { t, tp } from '../i18n/messages';
import { workflowDisplayName } from '../lib/enumLabels';


const TRIGGER_KEYS = [
  ['GEOFENCE_ENTER', 'wf_enter'],
  ['POSITION_STALE', 'wf_stale'],
  ['FERRY_STATUS', 'wf_ferry'],
  ['SCHEDULE_IMPORTED', 'wf_import'],
  ['UNLOADED', 'wf_unload'],
  ['CRON_DAILY_06', 'wf_cron'],
] as const;

const emptyDraft = { name: '', trigger: 'GEOFENCE_ENTER', condition: '', actions: '', enabled: true };

export function WorkflowsView() {
  const workflows = useTowerStore((s) => s.workflows);
  const toggleWorkflow = useTowerStore((s) => s.toggleWorkflow);
  const runWorkflowNow = useTowerStore((s) => s.runWorkflowNow);
  const createWorkflow = useTowerStore((s) => s.createWorkflow);
  const locale = useTowerStore((s) => s.locale);
  const active = workflows.filter((w) => w.enabled).length;
  const triggerLabel = (code: string) => {
    const key = TRIGGER_KEYS.find(([v]) => v === code)?.[1];
    return key ? t(locale, key) : code;
  };
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState(emptyDraft);

  const openCreator = () => { setDraft(emptyDraft); setCreating(true); };
  const save = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const name = draft.name.trim();
    if (!name) return;
    createWorkflow({
      name,
      description: `${triggerLabel(draft.trigger)} → ${draft.actions.split(/[\n,]/).map((a) => a.trim()).filter(Boolean).join(', ') || t(locale, 'a6_wf_no_actions')}`,
      trigger: draft.trigger,
      condition: draft.condition.trim() || 'true',
      actions: draft.actions.split(/[\n,]/).map((a) => a.trim()).filter(Boolean),
      enabled: draft.enabled,
    });
    setCreating(false);
  };

  return (
    <div className="panel workflow-page page-sections" data-page="workflows" style={{ margin: 12 }}>
      <header className="panel-hd">
        <h2>{t(locale, 'nav_wf')}</h2>
        <span className="sub">{active} {t(locale, 'wf_active_n')} · {workflows.length} {t(locale, 'wf_rules_n')}</span>
        <div className="spacer" />
        <button type="button" className="btn" onClick={openCreator}>{t(locale, 'wf_new')}</button>
      </header>
      <div className="panel-bd flush">
        {workflows.map((w) => (
          <div key={w.id} className="wf">
            <button type="button" className="sw" aria-pressed={w.enabled} aria-label={tp(locale, w.enabled ? 'a6_wf_toggle_off' : 'a6_wf_toggle_on', { name: workflowDisplayName(w, locale) })} onClick={() => toggleWorkflow(w.id)} />
            <div className="wf-copy"><b data-content>{workflowDisplayName(w, locale)}</b><span className="rule" data-content>{w.description || `${triggerLabel(w.trigger)} → ${w.actions.join(', ')}`}</span><span className="wf-meta" data-content>{triggerLabel(w.trigger)}{tp(locale, 'a6_wf_cond', { c: w.condition })}</span></div>
            <span className="wf-count">{w.runCount}× {t(locale, 'wf_runs')}</span>
            <button type="button" className="chipbtn wf-run" onClick={() => runWorkflowNow(w.id)}>{t(locale, 'a6_wf_run')}</button>
          </div>
        ))}
        <div className="note">{t(locale, 'wf_note')}</div>
      </div>

      {creating ? <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && setCreating(false)}>
        <section className="panel wf-creator" role="dialog" aria-modal="true" aria-labelledby="wf-create-title">
          <header className="panel-hd"><div><h2 id="wf-create-title">{t(locale, 'wf_new')}</h2><span className="sub">{t(locale, 'a6_wf_form_sub')}</span></div><div className="spacer" /><button type="button" className="iconbtn" aria-label={t(locale, 'a6_wf_close')} onClick={() => setCreating(false)}>×</button></header>
          <form className="panel-bd" onSubmit={save}>
            <label className="form-field"><span>{t(locale, 'a6_wf_name')}</span><input autoFocus required className="input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder={t(locale, 'a6_wf_name_ph')} /></label>
            <label className="form-field"><span>{t(locale, 'a6_wf_trigger')}</span><select className="input" value={draft.trigger} onChange={(e) => setDraft({ ...draft, trigger: e.target.value })}>{TRIGGER_KEYS.map(([value, labelKey]) => <option key={value} value={value}>{t(locale, labelKey)}</option>)}</select></label>
            <label className="form-field"><span>{t(locale, 'a6_wf_condition')} <small>{t(locale, 'a6_wf_condition_hint')}</small></span><textarea className="input" value={draft.condition} onChange={(e) => setDraft({ ...draft, condition: e.target.value })} placeholder={t(locale, 'a6_wf_condition_ph')} /></label>
            <label className="form-field"><span>{t(locale, 'a6_wf_actions')} <small>{t(locale, 'a6_wf_actions_hint')}</small></span><textarea className="input" value={draft.actions} onChange={(e) => setDraft({ ...draft, actions: e.target.value })} placeholder="notify_hhl, create_task" /></label>
            <label className="switchline creator-enabled"><input type="checkbox" checked={draft.enabled} onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })} /><span>{t(locale, 'a6_wf_enabled')}</span></label>
            <div className="creator-actions"><button type="submit" className="btn">{t(locale, 'a6_wf_save')}</button><button type="button" className="btn ghost" onClick={() => setCreating(false)}>{t(locale, 'a6_wf_cancel')}</button></div>
          </form>
        </section>
      </div> : null}
    </div>
  );
}
