/**
 * wyglad/P8-d — Automatyzacje (E35, decyzje 08.10.2026, 12:14; img/e35-after).
 * Zakładki: „Działa samo” (P4-c) · „Własne reguły · N” · „Przebiegi” · „Historia zmian”.
 * Własne reguły zdaniami „Gdy … wtedy …”, przy regule liczba przebiegów w 30 dniach, „Zmień”, „Wyłącz” / „Włącz”, „Usuń”
 * (z powodem). Kreator obok listy (≥ 1280 px) albo zamiast niej (węższy ekran, telefon). Przebiegi zdaniami, kliknięcie
 * otwiera transport. Zmienia tylko Administrator HHL; Operacje HHL — podgląd wszystkich zakładek (E35 pkt 5, E9).
 */
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTowerStore } from '../../store/useTowerStore';
import { getAuthProfile } from '../../auth/profile';
import { useIsPhone } from '../../lib/useIsPhone';
import { getNowIso } from '../../lib/frozenNow';
import { formatListDateTime } from '../../lib/format';
import { plPlural } from '../../lib/plPlural';
import { clickableRow } from '../../lib/clickableRow';
import { autoMetaOf } from '../../lib/p4cSource';
import { recentRuns, type OwnRule, type RuleHist, type RuleRun, type ZoneOption } from '../../lib/p8dRules';
import { rulesOf } from '../../lib/p8dSource';
import { t } from '../../i18n/messages';
import { wt } from '../../i18n/p4cWf';
import { p8dt } from '../../i18n/p8d';
import { AutoRulesList } from './AutoRulesList';
import { RuleCreator } from './RuleCreator';
import { histText, ruleSentence, runRules, runText } from './ruleText';
import './rules.css';

type Tab = 'auto' | 'own' | 'runs' | 'hist';
const TABS: Tab[] = ['auto', 'own', 'runs', 'hist'];
type Load<T> = { data: T | null; fail: boolean };
type Ask = { id: string; kind: 'off' | 'on' | 'remove' };

function useList<T>(get: (() => Promise<T>) | null, rev: number, initial: T | null = null): [Load<T>, () => void] {
  const [st, setSt] = useState<Load<T>>({ data: initial, fail: false });
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!get) return;
    let alive = true;
    void get().then((data) => { if (alive) setSt({ data, fail: false }); }, () => { if (alive) setSt((s) => ({ data: s.data, fail: true })); });
    return () => { alive = false; };
  }, [get, rev, n]);
  return [st, () => { setSt((s) => ({ data: s.data, fail: false })); setN((x) => x + 1); }];
}

export function RulesPage() {
  const src = useMemo(() => rulesOf(), []);
  const phone = useIsPhone();
  const locale = useTowerStore((s) => s.locale);
  const role = useTowerStore((s) => s.role);
  const loads = useTowerStore((s) => s.loads);
  const events = useTowerStore((s) => s.events);
  const selectLoad = useTowerStore((s) => s.selectLoad);
  const workflowFocus = useTowerStore((s) => s.workflowFocus);
  /* E9, E35 pkt 5: zmienia tylko Administrator HHL; Operacje HHL — podgląd */
  const canEdit = role === 'HHL' && getAuthProfile()?.role !== 'HHL_OPS' && !!src?.save;
  const [tab, setTab] = useState<Tab>(workflowFocus ? 'own' : 'auto');
  const [rev, setRev] = useState(0);
  const [rules, retryRules] = useList(src?.rules ?? null, rev, src?.initial ?? null);
  const [runs, retryRuns] = useList(src?.runs ?? null, rev);
  const [hist, retryHist] = useList(src?.history ?? null, rev);
  const [zones] = useList(src?.zones ?? null, 0);
  const [creator, setCreator] = useState<{ rule: OwnRule | null } | null>(null);
  const [ask, setAsk] = useState<Ask | null>(null);
  const [askReason, setAskReason] = useState('');
  const [askErr, setAskErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const opener = useRef<HTMLElement | null>(null);
  const askRef = useRef<HTMLInputElement>(null);
  const busyRef = useRef(false);
  const uid = useId();
  const nowIso = getNowIso();
  const autoMeta = useMemo(() => autoMetaOf(loads, events, nowIso), [loads, events, nowIso]);

  useEffect(() => { if (workflowFocus) setTab('own'); }, [workflowFocus]);
  useEffect(() => { if (ask) askRef.current?.focus(); }, [ask]);

  if (!src) return null;
  const list = rules.data ?? [];
  const zoneList: ZoneOption[] = zones.data ?? [];
  const runList = runs.data ? recentRuns(runs.data, nowIso) : null;

  const focusBack = () => window.setTimeout(() => { const el = opener.current; if (el && el.isConnected) el.focus(); }, 0);
  const openCreator = (rule: OwnRule | null, from: HTMLElement) => { opener.current = from; setNote(''); setAsk(null); setCreator({ rule }); };
  const closeCreator = (res: { rule: OwnRule | null; created: boolean } | null) => {
    setCreator(null);
    if (res) {
      setNote(p8dt(res.created ? 'p8d_done_created' : 'p8d_done_saved'));
      setRev((n) => n + 1);
      setTab('own');
      if (res.created && res.rule) {
        const rid = res.rule.id;
        window.setTimeout(() => document.querySelector<HTMLElement>(`[data-rule="${CSS.escape(rid)}"] .rl-rule-name`)?.focus(), 60);
        return;
      }
    }
    focusBack();
  };

  const doAsk = async () => {
    if (!ask || busyRef.current) return;
    if (!askReason.trim()) { setAskErr(p8dt('p8d_e_reason')); askRef.current?.focus(); return; }
    const fn = ask.kind === 'remove' ? src.remove : src.setEnabled;
    if (!fn) return;
    busyRef.current = true;
    setBusy(true);
    const r = await (ask.kind === 'remove' ? src.remove!(ask.id, askReason.trim()) : src.setEnabled!(ask.id, ask.kind === 'on', askReason.trim())).catch(() => ({ ok: false }));
    busyRef.current = false;
    setBusy(false);
    if (!r.ok) { setAskErr(p8dt('p8d_e_fail')); return; }
    setNote(p8dt(ask.kind === 'remove' ? 'p8d_done_removed' : ask.kind === 'on' ? 'p8d_done_on' : 'p8d_done_off'));
    const was = ask;
    setAsk(null);
    setAskReason('');
    setAskErr('');
    setRev((n) => n + 1);
    /* fokus: przy wyłączeniu i włączeniu — przycisk przełącznika; po usunięciu — „+ Nowa reguła” albo zakładka */
    window.setTimeout(() => {
      const el = was.kind === 'remove'
        ? document.querySelector<HTMLElement>('[data-rule-new]') ?? document.getElementById('wf-tab-own')
        : document.querySelector<HTMLElement>(`[data-rule="${CSS.escape(was.id)}"] [data-rule-toggle]`);
      el?.focus();
    }, 80);
  };

  const fail = (retry: () => void) => (
    <div className="rl-fail" role="alert">
      <span>{p8dt('p8d_fail')}</span>
      <button type="button" className="btn ghost" onClick={retry}>{p8dt('p8d_retry')}</button>
    </div>
  );

  const newBtn = canEdit ? (
    <button type="button" className={`btn rl-new${phone ? ' is-wide' : ''}`} onClick={(e) => openCreator(null, e.currentTarget)} data-rule-new>{p8dt('p8d_new')}</button>
  ) : null;

  const tabLabel = (k: Tab) => {
    if (k === 'auto') return wt(locale, 'p4c_wf_tab_auto');
    if (k === 'own') return p8dt(phone ? 'p8d_tab_own_s' : 'p8d_tab_own', { n: list.length });
    if (k === 'runs') return p8dt('p8d_tab_runs');
    return p8dt(phone ? 'p8d_tab_hist_s' : 'p8d_tab_hist');
  };

  const ownPanel = (
    <div className="rl-own">
      <p className="rl-lead">{p8dt('p8d_own_lead')}</p>
      {!canEdit ? <p className="rl-ro">{p8dt('p8d_ro')}</p> : null}
      {rules.fail && !rules.data ? fail(retryRules) : !rules.data ? <p className="rl-lead">{p8dt('p8d_loading')}</p> : list.length ? (
        <ul className="rl-rules">
          {list.map((r) => {
            const asking = ask?.id === r.id ? ask : null;
            const focused = workflowFocus === r.id || workflowFocus === r.name;
            return (
              <li key={r.id} className={`rl-rule${r.enabled ? '' : ' is-off'}${focused ? ' is-focus' : ''}`} data-rule={r.id}>
                <div className="rl-rule-txt">
                  <b className="rl-rule-name" tabIndex={-1}>{r.name}</b>
                  <span>{ruleSentence(r, zoneList)}</span>
                  <small>
                    {p8dt('p8d_runs30', { n: r.runs30, word: plPlural(r.runs30, 'przebieg', 'przebiegi', 'przebiegów') })}
                    {r.lastRunAt ? ` · ${p8dt('p8d_last', { d: formatListDateTime(r.lastRunAt) })}` : ''}
                  </small>
                </div>
                <span className={`rl-state${r.enabled ? ' is-on' : ''}`}>{p8dt(r.enabled ? 'p8d_on' : 'p8d_off')}</span>
                {canEdit ? (
                  <span className="rl-acts">
                    <button type="button" className="btn" onClick={(e) => openCreator(r, e.currentTarget)} data-rule-edit>{p8dt('p8d_change')}</button>
                    <button type="button" className="btn ghost" aria-expanded={asking?.kind === 'on' || asking?.kind === 'off'} onClick={() => { setAsk({ id: r.id, kind: r.enabled ? 'off' : 'on' }); setAskReason(''); setAskErr(''); setNote(''); }} data-rule-toggle>
                      {p8dt(r.enabled ? 'p8d_toggle_off' : 'p8d_toggle_on')}
                    </button>
                    <button type="button" className="btn ghost" aria-expanded={asking?.kind === 'remove'} onClick={() => { setAsk({ id: r.id, kind: 'remove' }); setAskReason(''); setAskErr(''); setNote(''); }} data-rule-remove>{p8dt('p8d_remove')}</button>
                  </span>
                ) : null}
                {asking ? (
                  <div className="rl-ask" role="group" aria-label={p8dt(asking.kind === 'remove' ? 'p8d_remove' : asking.kind === 'on' ? 'p8d_toggle_on' : 'p8d_toggle_off')}>
                    <label className="rl-f">
                      <span>{p8dt(asking.kind === 'remove' ? 'p8d_ask_remove' : asking.kind === 'on' ? 'p8d_ask_on' : 'p8d_ask_off')}</span>
                      <input ref={askRef} className="input" value={askReason} aria-invalid={askErr ? true : undefined} aria-describedby={askErr ? `${uid}-ask` : undefined}
                        onChange={(e) => { setAskReason(e.target.value); setAskErr(''); }} onKeyDown={(e) => { if (e.key === 'Enter') void doAsk(); }} data-rule-reason />
                    </label>
                    <span className="rl-ask-acts">
                      <button type="button" className="btn" aria-disabled={busy || undefined} onClick={() => void doAsk()} data-rule-ask-yes>
                        {p8dt(asking.kind === 'remove' ? 'p8d_remove' : asking.kind === 'on' ? 'p8d_toggle_on' : 'p8d_toggle_off')}
                      </button>
                      <button type="button" className="btn ghost" onClick={() => {
                        const sel = asking.kind === 'remove' ? '[data-rule-remove]' : '[data-rule-toggle]';
                        setAsk(null);
                        window.setTimeout(() => document.querySelector<HTMLElement>(`[data-rule="${CSS.escape(r.id)}"] ${sel}`)?.focus(), 0);
                      }}>{p8dt('p8d_c_cancel')}</button>
                    </span>
                    {askErr ? <p className="rl-err" id={`${uid}-ask`} role="alert">{askErr}</p> : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : <p className="rl-empty">{p8dt('p8d_own_none')}</p>}
      {phone ? newBtn : null}
    </div>
  );

  const openRun = (r: RuleRun) => {
    const id = r.loadId ?? (r.code ? loads.find((l) => l.code === r.code)?.id : undefined);
    if (id) selectLoad(id);
  };
  const runsPanel = (
    <div className="rl-runs-wrap">
      <p className="rl-lead"><b>{p8dt('p8d_r_title')}</b> · {p8dt('p8d_r_sub')}</p>
      {runs.fail && !runs.data ? fail(retryRuns) : !runList ? <p className="rl-lead">{p8dt('p8d_loading')}</p> : !runList.length ? <p className="rl-empty">{p8dt('p8d_r_none')}</p> : phone ? (
        <ul className="rl-run-cards">
          {runList.map((r) => (
            <li key={r.id}>
              <button type="button" className="rl-run-card" onClick={() => openRun(r)} disabled={!r.code} data-run={r.id}>
                <span className="rl-run-top"><b>{r.code ?? '—'}</b><span>{formatListDateTime(r.at)}</span></span>
                <span className="rl-run-rule">{runRules(r)}</span>
                <span className={`rl-res is-${r.result.kind}`}>{runText(r.result, r.rules.length)}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <table className="rl-runs" data-rule-runs>
          <thead>
            <tr>
              <th scope="col">{up(p8dt('p8d_r_when'))}</th>
              <th scope="col">{up(p8dt('p8d_r_rule'))}</th>
              <th scope="col">{up(p8dt('p8d_r_load'))}</th>
              <th scope="col">{up(p8dt('p8d_r_result'))}</th>
            </tr>
          </thead>
          <tbody>
            {runList.map((r) => (
              <tr key={r.id} {...(r.code ? clickableRow(() => openRun(r)) : {})} aria-label={r.code ? p8dt('p8d_r_open', { code: r.code }) : undefined} data-run={r.id}>
                <td className="rl-when">{formatListDateTime(r.at)}</td>
                <td>{runRules(r)}</td>
                <td><b>{r.code ?? '—'}</b></td>
                <td className={`rl-res is-${r.result.kind}`}>{runText(r.result, r.rules.length)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {runList?.length ? <p className="rl-foot">{p8dt('p8d_r_foot')}</p> : null}
    </div>
  );

  const histPanel = (
    <div className="rl-hist-wrap">
      {hist.fail && !hist.data ? fail(retryHist) : !hist.data ? <p className="rl-lead">{p8dt('p8d_loading')}</p> : !hist.data.length ? <p className="rl-empty">{p8dt('p8d_h_none')}</p> : (
        <ul className="rl-hist" data-rule-hist>
          {hist.data.map((h: RuleHist, i: number) => (
            <li key={`${h.at}-${i}`}><b>{formatListDateTime(h.at)} · {h.who}</b> · {histText(h)}</li>
          ))}
        </ul>
      )}
    </div>
  );

  const main = (
    <section className="panel rl-main" aria-labelledby={`${uid}-h`}>
      <header className="rl-hd">
        <h2 id={`${uid}-h`}>{t(locale, 'nav_wf')}</h2>
        {!phone ? newBtn : null}
      </header>
      <div
        className="dtabs wf-tabs rl-tabs"
        role="tablist"
        aria-label={t(locale, 'nav_wf')}
        onKeyDown={(e) => {
          if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft' && e.key !== 'Home' && e.key !== 'End') return;
          e.preventDefault();
          const i = TABS.indexOf(tab);
          const next = e.key === 'Home' ? TABS[0]! : e.key === 'End' ? TABS[TABS.length - 1]! : TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length]!;
          setTab(next);
          document.getElementById(`wf-tab-${next}`)?.focus();
        }}
      >
        {TABS.map((k) => (
          <button key={k} type="button" role="tab" id={`wf-tab-${k}`} aria-controls={`wf-panel-${k}`} aria-selected={tab === k} tabIndex={tab === k ? 0 : -1} data-wf-tab={k} onClick={() => setTab(k)}>
            {tabLabel(k)}
          </button>
        ))}
      </div>
      <div className="panel-bd flush" role="tabpanel" id="wf-panel-auto" aria-labelledby="wf-tab-auto" hidden={tab !== 'auto'}>
        <AutoRulesList locale={locale} meta={autoMeta} />
        {phone ? <div className="rl-pad">{newBtn}</div> : null}
      </div>
      <div className="panel-bd flush" role="tabpanel" id="wf-panel-own" aria-labelledby="wf-tab-own" hidden={tab !== 'own'}>{ownPanel}</div>
      <div className="panel-bd flush" role="tabpanel" id="wf-panel-runs" aria-labelledby="wf-tab-runs" hidden={tab !== 'runs'}>{runsPanel}</div>
      <div className="panel-bd flush" role="tabpanel" id="wf-panel-hist" aria-labelledby="wf-tab-hist" hidden={tab !== 'hist'}>{histPanel}</div>
    </section>
  );

  return (
    <div className={`rl${creator ? ' has-creator' : ''}${phone ? ' is-phone' : ''}`} data-page="workflows">
      <p className="rl-live" role="status">{note}</p>
      {main}
      {creator && canEdit ? (
        <RuleCreator key={creator.rule?.id ?? 'new'} rule={creator.rule} zones={zoneList} src={src} phone={phone} onClose={closeCreator} />
      ) : null}
    </div>
  );
}

function up(s: string): string { return s.toLocaleUpperCase('pl-PL'); }
