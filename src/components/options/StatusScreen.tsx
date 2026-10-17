/**
 * wyglad/P10b-c — Opcje › System › Stan systemu według E23 (źródła danych), E47 (błędy aplikacji), E19 pkt 7
 * (bezpieczeństwo, tylko Administrator HHL) i E46 (wydajność). Makiety: `makiety_html/E23/zrodla.html`,
 * `makiety_html/E46/bledy.html`, `raport/img/e19-after`. Najpierw to, co wymaga uwagi; bez kodów (E21); telefon — lista.
 * Dane: `src/lib/sysSource.ts` (demo — przykłady; produkcja — D-20261016-0845-01).
 */
import { Fragment, useMemo, useState, type ReactNode } from 'react';

import type { Locale } from '../../types';
import './sys.css';
import { t } from '../../i18n/messages';
import { sy, syp } from '../../i18n/sys';
import { useIsPhone } from '../../lib/useIsPhone';
import { formatListDateTime } from '../../lib/format';
import { TZ_OPS } from '../../lib/time';
import { hm } from '../../lib/p9cMap';
import { LiveMark } from '../shell/LiveMark';
import { kshSyncOf, kshSyncSourceRow } from '../../lib/kshSyncView';
import { useTowerStore } from '../../store/useTowerStore';
import {
  appErrors, checkSource, otherJobs, perfResults, saveSourceThreshold, securityRows, sourceHealth, sourceThresholds, sysActionsReady,
  type AppErrors, type CheckResult, type ErrorGroup, type SourceRow, type SourceState, type SourceThreshold,
} from '../../lib/sysSource';

type SysTab = 'sources' | 'errors' | 'security' | 'perf';

const ATTN: ReadonlySet<SourceState> = new Set(['down', 'partial', 'nomeasure']);
const ORDER: Record<SourceState, number> = { down: 0, partial: 1, nomeasure: 2, ok: 3, nosource: 4 };
const dt = (iso: string) => formatListDateTime(iso, TZ_OPS);
const sameDay = (a: string, b: string) => dt(a).split(', ')[0] === dt(b).split(', ')[0];

function durText(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h ? `${h} h${m ? ` ${m} min` : ''}` : `${m} min`;
}

/** „od 00:00 · 2 h 51 min”, „od 4 dni”, „od 06.10, 14:16” (makieta E23). */
function sinceText(locale: Locale, r: SourceRow, nowIso: string): string | null {
  if (!r.since || !ATTN.has(r.state)) return null;
  const min = (Date.parse(nowIso) - Date.parse(r.since)) / 60_000;
  if (sameDay(r.since, nowIso)) return syp(locale, 'sys_since_today', { t: hm(r.since), d: durText(min) });
  if (r.state === 'nomeasure' && min >= 2 * 24 * 60) return syp(locale, 'sys_since_days', { n: Math.floor(min / (24 * 60)) });
  return syp(locale, 'sys_since_at', { t: dt(r.since) });
}

function lastText(r: SourceRow, nowIso: string): string {
  if (r.lastText) return r.lastText;
  if (!r.lastAt) return '—';
  return sameDay(r.lastAt, nowIso) ? hm(r.lastAt) : dt(r.lastAt);
}

function Dot({ state }: { state: SourceState | 'ok' | 'warn' | 'bad' }) {
  return <i className={`sys-dot is-${state}`} aria-hidden="true" />;
}

/* ── Źródła danych (E23) ─────────────────────────────────────────────────────────────── */

function Sources({ locale, rows, nowIso, canCheck, admin }: { locale: Locale; rows: SourceRow[]; nowIso: string; canCheck: boolean; admin: boolean }) {
  const phone = useIsPhone();
  const [checks, setChecks] = useState<Record<string, CheckResult | 'busy'>>({});
  const [open, setOpen] = useState<string | null>(null);
  const [showRest, setShowRest] = useState(false);
  const sorted = useMemo(() => [...rows].sort((a, b) => ORDER[a.state] - ORDER[b.state]), [rows]);
  const n = (s: SourceState) => rows.filter((r) => r.state === s).length;
  const sum = [
    n('down') ? syp(locale, 'sys_sum_down', { n: n('down') }) : '',
    n('partial') + n('nomeasure') ? syp(locale, 'sys_sum_warn', { n: n('partial') + n('nomeasure') }) : '',
    n('ok') ? syp(locale, 'sys_sum_ok', { n: n('ok') }) : '',
    n('nosource') ? syp(locale, 'sys_sum_none', { n: n('nosource') }) : '',
  ].filter(Boolean).join(' · ');

  const run = (id: string) => {
    /* wyglad/P7-e2: demo odpowiada stanem wiersza, gdy źródła nie ma w danych demo (np. „Plik KSH (SharePoint)”) */
    const p = checkSource(id, nowIso, rows.find((r) => r.id === id)?.state);
    if (!p) return;
    setChecks((c) => ({ ...c, [id]: 'busy' }));
    void p.then((res) => setChecks((c) => ({ ...c, [id]: res })));
  };
  const checkBtn = (r: SourceRow) => {
    if (!canCheck || !r.canCheck || !ATTN.has(r.state) || !sysActionsReady()) return null;
    const c = checks[r.id];
    return (
      <button type="button" className="btn ghost ox-btn sys-check" data-sys-check={r.id} disabled={c === 'busy'} onClick={() => run(r.id)}>
        {c === 'busy' ? sy(locale, 'sys_checking') : sy(locale, 'sys_check')}
      </button>
    );
  };
  const checkLine = (r: SourceRow) => {
    const c = checks[r.id];
    if (!c || c === 'busy') return null;
    return <span className="sys-checked" data-sys-checked={r.id}>{syp(locale, 'sys_checked', { t: hm(c.at), state: sy(locale, `sys_st_${c.state}`).toLocaleLowerCase('pl') })}{c.text ? ` — ${c.text}` : ''}</span>;
  };

  const head = (
    <div className="sys-hd">
      <b>{sy(locale, 'sys_tab_sources')}</b>
      <span className="sys-sum" data-sys-sum>{phone ? syp(locale, 'sys_ph_attention', { n: rows.filter((r) => ATTN.has(r.state)).length }) : sum}</span>
      <LiveMark />
    </div>
  );

  if (phone) {
    const attn = sorted.filter((r) => ATTN.has(r.state));
    const rest = sorted.filter((r) => !ATTN.has(r.state));
    const restSum = [n('ok') ? syp(locale, 'sys_sum_ok', { n: n('ok') }) : '', n('nosource') ? syp(locale, 'sys_sum_none', { n: n('nosource') }) : ''].filter(Boolean).join(' · ');
    const item = (r: SourceRow) => {
      const since = sinceText(locale, r, nowIso);
      const isOpen = open === r.id;
      return (
        <li key={r.id} className={`sys-m is-${r.state}`} data-sys-source={r.id} data-state={r.state}>
          <button type="button" className="sys-m-row" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : r.id)}>
            <Dot state={r.state} />
            <span className="sys-m-t">
              <b>{r.name}</b>
              <small>{[since ? `${sy(locale, `sys_st_${r.state}`)} ${since}` : sy(locale, `sys_st_${r.state}`), r.lastAt || r.lastText ? syp(locale, 'sys_ph_data', { t: lastText(r, nowIso) }) : ''].filter(Boolean).join(' · ')}</small>
            </span>
          </button>
          {isOpen ? (
            <div className="sys-m-more">
              <p><span className="sys-k">{sy(locale, 'sys_col_feeds')}:</span> {r.feeds}</p>
              {r.why ? <p>{r.why}</p> : null}
              {checkBtn(r)}
              {checkLine(r)}
            </div>
          ) : null}
        </li>
      );
    };
    return (
      <section className="sys-sec" data-sys-sources>
        {head}
        <ul className="sys-mlist">
          {attn.map(item)}
          {showRest ? rest.map(item) : null}
        </ul>
        {!showRest && rest.length ? (
          <button type="button" className="sys-rest" data-sys-rest onClick={() => setShowRest(true)}>{syp(locale, 'sys_ph_rest', { list: restSum })}</button>
        ) : null}
        <Thresholds locale={locale} admin={admin} />
      </section>
    );
  }

  const jobs = otherJobs(nowIso) ?? [];
  return (
    <section className="sys-sec" data-sys-sources>
      {head}
      <div className="sys-tablewrap">
        <table className="sys-tbl sys-src">
          <thead>
            <tr>
              <th className="c-src">{sy(locale, 'sys_col_source')} · {sy(locale, 'sys_col_feeds').toLocaleLowerCase('pl')}</th>
              <th className="c-last">{sy(locale, 'sys_col_last')}</th>
              <th className="c-st">{sy(locale, 'sys_col_state')}</th>
              <th>{sy(locale, 'sys_col_why')}</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => {
              const since = sinceText(locale, r, nowIso);
              return (
                <tr key={r.id} className={`is-${r.state}`} data-sys-source={r.id} data-state={r.state}>
                  <td><b>{r.name}</b>{r.cadence ? <small>{r.cadence}</small> : null}<small className="sys-feeds">{r.feeds}</small></td>
                  <td className="sys-num">{lastText(r, nowIso)}</td>
                  <td>
                    <span className={`sys-st is-${r.state}`}><Dot state={r.state} />{sy(locale, `sys_st_${r.state}`)}</span>
                    {since ? <small>{since}</small> : null}
                  </td>
                  <td>{r.why ? <span className="sys-why">{r.why}</span> : null}{checkBtn(r)}{checkLine(r)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {jobs.length ? (
        <details className="sys-other" data-sys-other>
          <summary>{syp(locale, 'sys_other', { n: jobs.length })}</summary>
          <p className="sys-note">{sy(locale, 'sys_other_note')}</p>
          <ul>
            {jobs.map((j) => (
              <li key={j.id}><span className={`sys-st is-${j.state}`}><Dot state={j.state} />{j.name}</span><span className="sys-num">{j.lastAt ? (sameDay(j.lastAt, nowIso) ? hm(j.lastAt) : dt(j.lastAt)) : '—'}</span></li>
            ))}
          </ul>
        </details>
      ) : null}
      <Thresholds locale={locale} admin={admin} />
    </section>
  );
}

/** Progi „Nie działa” (E23 pkt 3; zmienia Administrator HHL, z potwierdzeniem jak w Opcjach › Progi). */
function Thresholds({ locale, admin }: { locale: Locale; admin: boolean }) {
  const rows = sourceThresholds();
  const [vals, setVals] = useState<Record<string, number>>(() => Object.fromEntries((rows ?? []).map((r) => [r.key, r.value])));
  const [edit, setEdit] = useState<{ key: string; draft: string; ask: boolean } | null>(null);
  if (!rows) return null;
  const fmt = (x: number) => new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 2 }).format(x);
  const num = (d: string) => Number(d.replace(',', '.'));
  const canSave = admin && sysActionsReady();
  const line = (r: SourceThreshold) => {
    const label = sy(locale, `sys_thr_${r.key}`);
    const v = vals[r.key];
    const editing = edit?.key === r.key;
    return (
      <li key={r.key} data-sys-threshold={r.key} className={editing ? 'is-edit' : undefined}>
        <span className="ox-thr-label">{label}</span>
        {editing ? (
          <span className="ox-thr-edit">
            {edit.ask ? (
              <span className="ox-thr-ask">{t(locale, 'p3c_thr_ask').replace('{name}', label).replace('{was}', `${fmt(v)} ${r.unit}`).replace('{is}', `${fmt(num(edit.draft))} ${r.unit}`)}</span>
            ) : (
              <label className="ox-thr-input"><input className="input" inputMode="decimal" aria-label={label} value={edit.draft} onChange={(e) => setEdit({ ...edit, draft: e.target.value })} /><span>{r.unit}</span></label>
            )}
          </span>
        ) : (
          <span className="ox-thr-val"><b data-content>{fmt(v)} {r.unit}</b> <span>— {sy(locale, 'sys_thr_fx')}</span></span>
        )}
        {!canSave ? null : editing ? (
          <span className="ox-thr-btns">
            <button type="button" className="btn ghost ox-btn" onClick={() => setEdit(null)}>{t(locale, 'p3c_cancel')}</button>
            {edit.ask ? (
              <button
                type="button"
                className="btn ox-btn"
                onClick={() => {
                  const next = num(edit.draft);
                  void saveSourceThreshold(r.key, next)?.then((ok) => { if (ok) setVals((x) => ({ ...x, [r.key]: next })); });
                  setEdit(null);
                }}
              >
                {t(locale, 'p3c_yes_change')}
              </button>
            ) : (
              <button type="button" className="btn ox-btn" disabled={!(num(edit.draft) > 0) || num(edit.draft) === v} onClick={() => setEdit({ ...edit, ask: true })}>{t(locale, 'p3c_m_save')}</button>
            )}
          </span>
        ) : (
          <button type="button" className="btn ghost ox-btn" onClick={() => setEdit({ key: r.key, draft: fmt(v), ask: false })}>{t(locale, 'p3c_thr_change')}</button>
        )}
      </li>
    );
  };
  return (
    <div className="sys-thr" data-sys-thresholds>
      <h3 className="sys-h3">{sy(locale, 'sys_thr_h')}</h3>
      <p className="sys-note">{sy(locale, 'sys_thr_note')}</p>
      <ul className="ox-thr-list">{rows.map(line)}</ul>
    </div>
  );
}

/* ── Błędy aplikacji (E47) ───────────────────────────────────────────────────────────── */

function ErrorStateTag({ locale, g }: { locale: Locale; g: ErrorGroup }) {
  const txt = g.state === 'known' ? (g.stateNote ?? '') : sy(locale, `sys_err_st_${g.state}`);
  return <span className={`mtag sys-etag is-${g.state}`} data-err-state={g.state}>{txt.charAt(0).toLocaleUpperCase('pl') + txt.slice(1)}</span>;
}

function Errors({ locale, data, nowIso }: { locale: Locale; data: AppErrors; nowIso: string }) {
  const phone = useIsPhone();
  const [open, setOpen] = useState<string | null>(null);
  const pages = [...new Set(data.groups.map((g) => g.where))];
  const when = (iso: string) => (sameDay(iso, nowIso) ? hm(iso) : dt(iso));
  const more = (g: ErrorGroup): ReactNode => (
    <dl className="sys-edl" data-err-more={g.id}>
      {g.stack ? <><dt>{sy(locale, 'sys_err_stack')}</dt><dd>{g.stack}</dd></> : null}
      {g.pages?.length ? <><dt>{sy(locale, 'sys_err_where_all')}</dt><dd>{g.pages.join(', ')}</dd></> : null}
      {g.roles?.length ? <><dt>{sy(locale, 'sys_err_roles')}</dt><dd>{g.roles.join(', ')}</dd></> : null}
    </dl>
  );
  const tiles = (
    <div className="sys-kpis">
      <div className="sys-kpi"><b>{data.groups.length}</b><span>{sy(locale, 'sys_err_kinds')}</span></div>
      <div className="sys-kpi"><b>{data.total7d}</b><span>{sy(locale, 'sys_err_count')}</span></div>
      <div className="sys-kpi"><b>{data.newCount}</b><span>{data.newSince ? syp(locale, 'sys_err_new', { t: dt(data.newSince) }) : sy(locale, 'sys_err_none_new')}</span></div>
      <div className="sys-kpi"><b>{pages.length}</b><span>{syp(locale, 'sys_err_pages', { list: pages.join(', ') })}</span></div>
    </div>
  );
  return (
    <section className="sys-sec" data-sys-errors>
      <div className="sys-hd">
        <b>{sy(locale, 'sys_tab_errors')}</b>
        <span className="sys-sum">{phone ? syp(locale, 'sys_err_new_short', { n: data.newCount }) : sy(locale, 'sys_err_sub')}</span>
      </div>
      {phone ? (
        <ul className="sys-mlist">
          {data.groups.map((g) => (
            <li key={g.id} className="sys-m sys-ecard" data-err={g.id}>
              <button type="button" className="sys-m-row" aria-expanded={open === g.id} onClick={() => setOpen(open === g.id ? null : g.id)}>
                <span className="sys-m-t">
                  <b className="sys-emsg">{g.message}</b>
                  <small>{syp(locale, 'sys_err_line', { where: g.where, count: g.count, people: g.people, t: when(g.lastAt) })}</small>
                </span>
                <ErrorStateTag locale={locale} g={g} />
              </button>
              {open === g.id ? <div className="sys-m-more">{more(g)}</div> : null}
            </li>
          ))}
        </ul>
      ) : (
        <>
          {tiles}
          <div className="sys-tablewrap">
            <table className="sys-tbl sys-err">
              <thead>
                <tr>
                  <th>{sy(locale, 'sys_err_col_msg')}</th>
                  <th>{sy(locale, 'sys_err_col_where')}</th>
                  <th className="sys-num">{sy(locale, 'sys_err_col_people')}</th>
                  <th className="sys-num">{sy(locale, 'sys_err_col_count')}</th>
                  <th className="sys-num">{sy(locale, 'sys_err_col_builds')}</th>
                  <th>{sy(locale, 'sys_err_col_first')}</th>
                  <th>{sy(locale, 'sys_err_col_last')}</th>
                  <th>{sy(locale, 'sys_err_col_state')}</th>
                </tr>
              </thead>
              <tbody>
                {data.groups.map((g) => (
                  <Fragment key={g.id}>
                    <tr className="sys-erow" data-err={g.id} tabIndex={0} aria-expanded={open === g.id}
                      onClick={() => setOpen(open === g.id ? null : g.id)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(open === g.id ? null : g.id); } }}>
                      <td><b className="sys-emsg">{g.message}</b></td>
                      <td>{g.where}</td>
                      <td className="sys-num">{g.people}</td>
                      <td className="sys-num">{g.count}</td>
                      <td className="sys-num">{g.builds}</td>
                      <td className="sys-num">{when(g.firstAt)}</td>
                      <td className="sys-num">{when(g.lastAt)}</td>
                      <td><ErrorStateTag locale={locale} g={g} /></td>
                    </tr>
                    {open === g.id ? <tr className="sys-emore"><td colSpan={8}>{more(g)}</td></tr> : null}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <p className="sys-rule" data-err-rule>{sy(locale, 'sys_err_rule')}</p>
    </section>
  );
}

/* ── Bezpieczeństwo (E19 pkt 7) i Wydajność (E46) ──────────────────────────────────── */

/** „2,1 s · 0,02 · 180 ms” — każda część w jednym kawałku (bez łamania „180 / ms”, „≤ / 300 ms”). */
function segs(text: string) {
  const parts = text.split(' · ');
  return parts.map((p, i) => <Fragment key={i}>{i ? ' · ' : null}<span className="sys-seg">{p}</span></Fragment>);
}

function Security({ locale, nowIso }: { locale: Locale; nowIso: string }) {
  const rows = securityRows(nowIso) ?? [];
  const phone = useIsPhone();
  return (
    <section className="sys-sec" data-sys-security>
      <div className="sys-hd"><b>{sy(locale, 'sys_tab_security')}</b><span className="sys-sum">{sy(locale, 'sys_sec_sub')}</span></div>
      {phone ? (
        <ul className="sys-mlist">
          {rows.map((r) => (
            <li key={r.id} className="sys-m" data-sec={r.id}>
              <div className="sys-m-row"><Dot state={r.state} /><span className="sys-m-t"><b>{r.what}</b><small>{r.value}</small></span></div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="sys-tablewrap">
          <table className="sys-tbl sys-secT">
            <thead><tr><th>{sy(locale, 'sys_sec_col_what')}</th><th>{sy(locale, 'sys_sec_col_state')}</th><th>{sy(locale, 'sys_sec_col_details')}</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} data-sec={r.id}>
                  <td><b>{r.what}</b></td>
                  <td><span className={`sys-st is-${r.state}`}><Dot state={r.state} />{r.value}</span></td>
                  <td>{r.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="sys-note">{sy(locale, 'sys_sec_note')}</p>
    </section>
  );
}

function PerfView({ locale, nowIso }: { locale: Locale; nowIso: string }) {
  const p = perfResults(nowIso);
  if (!p) return <p className="sys-note">{sy(locale, 'sys_none')}</p>;
  const state = (ok: boolean | null) => (ok == null ? sy(locale, 'sys_perf_none') : ok ? sy(locale, 'sys_perf_ok') : sy(locale, 'sys_perf_bad'));
  return (
    <section className="sys-sec" data-sys-perf>
      <div className="sys-hd"><b>{sy(locale, 'sys_tab_perf')}</b><span className="sys-sum">{syp(locale, 'sys_perf_sub', { t: p.at ? dt(p.at) : '—' })}</span></div>
      <div className="sys-tablewrap">
        <table className="sys-tbl sys-perf">
          <thead><tr><th>{sy(locale, 'sys_perf_col_what')}</th><th>{sy(locale, 'sys_perf_col_how')}</th><th>{sy(locale, 'sys_perf_col_result')}</th><th>{sy(locale, 'sys_perf_col_limit')}</th><th>{sy(locale, 'sys_perf_col_state')}</th></tr></thead>
          <tbody>
            {p.rows.map((r) => (
              <tr key={r.id} data-perf={r.id} data-ok={r.ok == null ? 'none' : String(r.ok)}>
                <td><b>{r.what}</b></td>
                <td>{segs(r.how)}</td>
                <td>{segs(r.result)}</td>
                <td>{segs(r.limit)}</td>
                <td><span className={`sys-st is-${r.ok == null ? 'nosource' : r.ok ? 'ok' : 'down'}`}><Dot state={r.ok == null ? 'nosource' : r.ok ? 'ok' : 'down'} />{state(r.ok)}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/**
 * wyglad/P7-e2 (F7): na produkcji, dopóki Stan systemu czeka na dane źródeł (D-20261016-0845-01, P10a), ekran pokazuje
 * dzisiejszy panel — wiersz „Plik KSH (SharePoint)” stoi wtedy nad nim, gdy wykonawca poda stan synchronizacji (W13).
 */
export function KshSyncSourceBlock({ locale, nowIso, admin }: { locale: Locale; nowIso: string; admin: boolean }) {
  const kshSync = useTowerStore((s) => kshSyncOf(s));
  if (!kshSync) return null;
  return (
    <div className="sys" data-sys-screen-ksh>
      <Sources locale={locale} rows={[kshSyncSourceRow(kshSync, nowIso)]} nowIso={nowIso} canCheck admin={admin} />
    </div>
  );
}

export function StatusScreen({ locale, nowIso, admin, mark }: { locale: Locale; nowIso: string; admin: boolean; mark?: ReactNode }) {
  const [tab, setTab] = useState<SysTab>('sources');
  const phone = useIsPhone();
  /* wyglad/P7-e (W13 zasady 15–16): wiersz „Plik KSH (SharePoint)”, gdy wykonawca poda stan synchronizacji */
  const kshSync = useTowerStore((s) => kshSyncOf(s));
  const rows0 = sourceHealth(nowIso);
  const rows = rows0 && kshSync ? [kshSyncSourceRow(kshSync, nowIso), ...rows0] : rows0;
  const errs = appErrors(nowIso);
  if (!rows) return null;
  const tabs: SysTab[] = ['sources', ...(errs ? ['errors' as const] : []), ...(admin && securityRows(nowIso) ? ['security' as const] : []), 'perf'];
  /* telefon 390: krótsze nazwy, żeby cztery zakładki zmieściły się w jednym wierszu */
  const label = (k: SysTab) => sy(locale, k === 'sources' ? (phone ? 'sys_tab_sources_short' : 'sys_tab_sources')
    : k === 'errors' ? (phone ? 'sys_tab_errors_short' : 'sys_tab_errors') : k === 'security' ? 'sys_tab_security' : 'sys_tab_perf');
  return (
    <div className="sys" data-sys-screen>
      {mark ? <div className="ox-count-line"><span />{mark}</div> : null}
      <div className="sys-tabs" role="tablist" aria-label={sy(locale, 'sys_tabs')}>
        {tabs.map((k) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} data-sys-tab={k} onClick={() => setTab(k)}>{label(k)}</button>
        ))}
      </div>
      {tab === 'sources' ? <Sources locale={locale} rows={rows} nowIso={nowIso} canCheck admin={admin} /> : null}
      {tab === 'errors' && errs ? <Errors locale={locale} data={errs} nowIso={nowIso} /> : null}
      {tab === 'security' && admin ? <Security locale={locale} nowIso={nowIso} /> : null}
      {tab === 'perf' ? <PerfView locale={locale} nowIso={nowIso} /> : null}
    </div>
  );
}
