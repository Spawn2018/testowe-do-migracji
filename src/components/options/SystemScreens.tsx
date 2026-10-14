/**
 * wyglad/P3-c — ekrany E12 (`img/e12-after`): System › Przełączniki bezpieczeństwa, System › Historia zmian,
 * System › Eksport danych, Zasady transportu › Progi alarmów.
 * Tylko wygląd. Odczyt i zapis (`admin_security_flag_set`, historia, eksport, progi) podłącza wykonawca.
 */
import { useState, type ReactNode } from 'react';
import type { Locale } from '../../types';
import { t, tp } from '../../i18n/messages';
import { up } from './up';

/* ---------- Przełączniki bezpieczeństwa ---------- */

export type SecurityFlagRow = {
  key: string;
  name: string;
  on: boolean;
  /** Co robi — zdanie o skutku. */
  does: string;
  /** „02.10, 18:43” */
  when: string;
  /** Imię i nazwisko albo rodzaj konta; null = zmiana poleceniem w bazie. */
  by: string | null;
};

export function FlagsScreen({ locale, flags: initial, readOnly, onToggle, mark }: {
  locale: Locale;
  flags: SecurityFlagRow[];
  readOnly?: boolean;
  onToggle?: (key: string, next: boolean) => void;
  mark?: ReactNode;
}) {
  const [flags, setFlags] = useState(initial);
  const [ask, setAsk] = useState<SecurityFlagRow | null>(null);
  const last = (f: SecurityFlagRow) => `${f.when} · ${f.by ?? t(locale, 'p3c_by_command')}`;
  const confirm = () => {
    if (!ask) return;
    setFlags((fs) => fs.map((f) => (f.key === ask.key ? { ...f, on: !f.on } : f)));
    onToggle?.(ask.key, !ask.on);
    setAsk(null);
  };
  const sw = (f: SecurityFlagRow) => (
    <button
      type="button"
      className="ox-switch"
      role="switch"
      aria-checked={f.on}
      aria-label={f.name}
      disabled={readOnly}
      onClick={() => setAsk(f)}
    ><span className="ox-track"><i /></span></button>
  );
  return (
    <div className="ox-flags">
      <div className="ox-count-line"><span>{tp(locale, 'p3c_flags_count', { n: flags.length })}</span>{mark}</div>
      <table className="ox-table ox-cards-phone" data-opt-table="flags">
        <thead><tr><th>{up(t(locale, 'p3c_col_flag'))}</th><th>{up(t(locale, 'p3c_col_state'))}</th><th>{up(t(locale, 'p3c_col_does'))}</th><th>{up(t(locale, 'p3c_col_last'))}</th></tr></thead>
        <tbody>
          {flags.map((f) => (
            <tr key={f.key} data-flag={f.key}>
              <th scope="row" data-label={up(t(locale, 'p3c_col_flag'))}><b>{f.name}</b></th>
              <td data-label={up(t(locale, 'p3c_col_state'))}>{sw(f)}</td>
              <td data-label={up(t(locale, 'p3c_col_does'))}>{f.does}</td>
              <td data-label={up(t(locale, 'p3c_col_last'))} className="ox-nowrap" data-content>{last(f)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {readOnly ? null : <p className="ox-foot">{t(locale, 'p3c_flags_foot')}</p>}
      {ask ? (
        <div className="ox-scrim" role="presentation" onClick={() => setAsk(null)}>
          <div className="ox-dialog" role="dialog" aria-modal="true" aria-labelledby="ox-flag-q" onClick={(e) => e.stopPropagation()}>
            <h3 id="ox-flag-q">{t(locale, ask.on ? 'p3c_flag_q_off' : 'p3c_flag_q_on').replace('{name}', ask.name)}</h3>
            <p><b>{t(locale, 'p3c_effect')}</b> {ask.does}</p>
            <div className="ox-actions">
              <button type="button" className="btn ghost ox-btn" onClick={() => setAsk(null)}>{t(locale, 'p3c_cancel')}</button>
              <button type="button" className="btn ox-btn" onClick={confirm}>{t(locale, 'p3c_yes_change')}</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ---------- Historia zmian ---------- */

export type HistoryEntry = {
  id: string;
  /** „07.10, 14:10” */
  when: string;
  /** „Administrator HHL” albo „Anna Nowak // HHL” */
  who: string;
  /** Zdanie po polsku: „Zaproszenie: nowe konto Operacje HHL”. */
  text: string;
  was?: string;
  is?: string;
};

export function HistoryScreen({ locale, entries, techCount, people, areas, range, mark, onDownload }: {
  locale: Locale;
  entries: HistoryEntry[];
  /** Liczba zmian technicznych ukrytych domyślnie. */
  techCount?: number;
  people: string[];
  areas: string[];
  range: { from: string; to: string };
  mark?: ReactNode;
  onDownload?: (fmt: 'csv' | 'xlsx') => void;
}) {
  const [tech, setTech] = useState(false);
  return (
    <div className="ox-hist">
      <div className="ox-filters">
        <label className="ox-field"><span>{up(t(locale, 'p3c_hist_from'))}</span><input className="input" type="date" defaultValue={range.from} /></label>
        <label className="ox-field"><span>{up(t(locale, 'p3c_hist_to'))}</span><input className="input" type="date" defaultValue={range.to} /></label>
        <label className="ox-field"><span>{up(t(locale, 'p3c_hist_who'))}</span>
          <select className="input" defaultValue="">
            <option value="">{t(locale, 'p3c_hist_all')}</option>
            {people.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
        <label className="ox-field"><span>{up(t(locale, 'p3c_hist_what'))}</span>
          <select className="input" defaultValue="">
            <option value="">{t(locale, 'p3c_hist_all_what')}</option>
            {areas.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
      </div>
      <div className="ox-count-line">
        {techCount != null ? (
          <label className="ox-switchline">
            <button type="button" className="ox-switch" role="switch" aria-checked={tech} onClick={() => setTech(!tech)}><span className="ox-track"><i /></span></button>
            <span>{t(locale, 'p3c_hist_tech').replace('{n}', new Intl.NumberFormat('pl-PL').format(techCount))}</span>
          </label>
        ) : <span />}
        {mark}
      </div>
      {entries.length ? (
        <ol className="ox-hist-list">
          {entries.map((e) => (
            <li key={e.id}>
              <div className="ox-hist-hd"><b data-content>{e.when}</b><span data-content>{e.who}</span></div>
              <div className="ox-hist-tx" data-content>{e.text}</div>
              {e.was != null || e.is != null ? (
                <div className="ox-hist-diff">
                  <span><small>{t(locale, 'p3c_hist_was')}</small><s data-content>{e.was ?? '—'}</s></span>
                  <span aria-hidden="true">→</span>
                  <span><small>{t(locale, 'p3c_hist_is')}</small><b data-content>{e.is ?? '—'}</b></span>
                </div>
              ) : null}
            </li>
          ))}
        </ol>
      ) : <p className="ox-empty">{t(locale, 'p3c_hist_empty')}</p>}
      <div className="ox-actions ox-actions-start">
        <button type="button" className="btn ghost ox-btn" onClick={() => onDownload?.('csv')}>{t(locale, 'p3c_dl_csv')}</button>
        <button type="button" className="btn ghost ox-btn" onClick={() => onDownload?.('xlsx')}>{t(locale, 'p3c_dl_xlsx')}</button>
      </div>
    </div>
  );
}

/* ---------- Eksport danych ---------- */

export type ExportKind = 'loads' | 'hist' | 'risks' | 'fin';
const EXPORT_KEY: Record<ExportKind, string> = { loads: 'p3c_exp_loads', hist: 'p3c_exp_hist', risks: 'p3c_exp_risks', fin: 'p3c_exp_fin' };

export function ExportScreen({ locale, kinds, range, fileName, onDownload }: {
  locale: Locale;
  /** Co ta rola może pobrać (Faktury i finanse — tylko HHL; Historia zmian — bez Operacji, E12-1). */
  kinds: ExportKind[];
  range: { from: string; to: string };
  /** np. „WatchTower_Transporty_01.10–08.10.xlsx” */
  fileName: (kind: ExportKind) => string;
  onDownload?: (kind: ExportKind, fmt: 'xlsx' | 'csv') => void;
}) {
  const [kind, setKind] = useState<ExportKind>(kinds[0] ?? 'loads');
  return (
    <div className="ox-export">
      <dl className="ox-kv">
        <dt>{t(locale, 'p3c_exp_what')}</dt>
        <dd>
          <div className="ox-seg" role="radiogroup" aria-label={t(locale, 'p3c_exp_what')}>
            {kinds.map((k) => (
              <button key={k} type="button" role="radio" aria-checked={k === kind} onClick={() => setKind(k)}>
                {t(locale, EXPORT_KEY[k])}{k === 'fin' ? <small> ({t(locale, 'p3c_exp_fin_note')})</small> : null}
              </button>
            ))}
          </div>
        </dd>
        <dt>{t(locale, 'p3c_exp_range')}</dt>
        <dd>
          <div className="ox-range">
            <label className="ox-field"><span>{up(t(locale, 'p3c_hist_from'))}</span><input className="input" type="date" defaultValue={range.from} /></label>
            <label className="ox-field"><span>{up(t(locale, 'p3c_hist_to'))}</span><input className="input" type="date" defaultValue={range.to} /></label>
          </div>
          <small className="ox-muted">{t(locale, 'p3c_exp_range_note')}</small>
        </dd>
        <dt>{t(locale, 'p3c_exp_cols')}</dt><dd>{t(locale, 'p3c_exp_cols_note')}</dd>
        <dt>{t(locale, 'p3c_exp_who')}</dt><dd>{t(locale, 'p3c_exp_who_note')}</dd>
        <dt>{t(locale, 'p3c_exp_file')}</dt><dd><span className="ox-file" data-content>„{fileName(kind)}”</span> · {t(locale, 'p3c_exp_no_limit')}</dd>
      </dl>
      <div className="ox-actions ox-actions-start">
        <button type="button" className="btn ox-btn" onClick={() => onDownload?.(kind, 'xlsx')}>{t(locale, 'p3c_dl_xlsx')}</button>
        <button type="button" className="btn ghost ox-btn" onClick={() => onDownload?.(kind, 'csv')}>{t(locale, 'p3c_dl_csv')}</button>
      </div>
    </div>
  );
}

/* ---------- Progi alarmów ---------- */

export type ThresholdRow = {
  key: string;
  label: string;
  /** „3,8 m” albo „48 h · 12 h” */
  value: string;
  /** Zdanie o skutku: „wyżej sprawa „możliwe odwołanie rejsu”” */
  effect: string;
};

export function ThresholdsScreen({ locale, rows, readOnly, onChange, mark }: {
  locale: Locale;
  rows: ThresholdRow[];
  readOnly?: boolean;
  onChange?: (key: string) => void;
  mark?: ReactNode;
}) {
  return (
    <div className="ox-thr">
      {mark ? <div className="ox-count-line"><span />{mark}</div> : null}
      <ul className="ox-thr-list">
        {rows.map((r) => (
          <li key={r.key} data-threshold={r.key}>
            <span className="ox-thr-label">{r.label}</span>
            <span className="ox-thr-val"><b data-content>{r.value}</b> <span>— {r.effect}</span></span>
            {readOnly ? null : <button type="button" className="btn ghost ox-btn" onClick={() => onChange?.(r.key)}>{t(locale, 'p3c_thr_change')}</button>}
          </li>
        ))}
      </ul>
    </div>
  );
}
