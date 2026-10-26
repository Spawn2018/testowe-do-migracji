/**
 * wyglad/P3-c — ekrany E12 (`img/e12-after`): System › Przełączniki bezpieczeństwa, System › Historia zmian,
 * System › Eksport danych, Zasady transportu › Progi alarmów.
 * Tylko wygląd. Odczyt i zapis (`admin_security_flag_set`, historia, eksport, progi) podłącza wykonawca.
 */
import { useEffect, useState, type ReactNode } from 'react';
import type { Locale } from '../../types';
import { t, tp } from '../../i18n/messages';
import { E49_THR } from '../../i18n/e49Thr';
import { openOptionsScreen } from '../../lib/openOptions';

/* ---------- Przełączniki bezpieczeństwa ---------- */

/**
 * 10 kluczy `security_flags` w kolejności ekranu; nazwa i zdanie: p3c_flag_<KEY> / p3c_flag_<KEY>_fx.
 * wyglad/P9-b (decyzja 16.10 01:13): H1_ROUTE_CHECK, H3_CORRIDOR_OBSTACLES, H6_MAP_OBSTACLES usunięte na stałe.
 * wyglad/audyt-E (E5 07.10 12:52, E11 13:21 „jeden przełącznik na sprawę”, C3): AUTOMATIC_DECISION_EMAIL nie ma —
 * e-mail o decyzji ustawia tylko „Kto co dostaje”.
 * #446 / F7 #451: TELM_RIO_LINKS (E44, odczyt pozycji z linków RIO; zgoda RIO 22.10) obok emtrack.
 */
export const SECURITY_FLAG_KEYS = [
  'EXTERNAL_MESSAGING', 'MFA_HHL_ADMIN', 'PERMIT_REQUIRED_NON_STANDARD', 'SMS_ZONE_APPROACH', 'SMS_ZONE_ENTER',
  'TELM_EMTRACK_WEB', 'TELM_RIO_LINKS', 'DRIVER_LINK_ACCEPT', 'FUEL_SE_PL_INGEST', 'FUEL_WOB_INGEST',
] as const;

export type SecurityFlagRow = {
  key: string;
  on: boolean;
  /** „02.10, 18:43” */
  when: string;
  /** Imię i nazwisko albo rodzaj konta; null = zmiana poleceniem w bazie. */
  by: string | null;
};

const namedFlags = (locale: Locale, rows: SecurityFlagRow[]) =>
  rows.map((f) => ({ ...f, name: t(locale, `p3c_flag_${f.key}`), does: t(locale, `p3c_flag_${f.key}_fx`) }));

export function FlagsScreen({ locale, flags: initialRaw, readOnly, onToggle, mark, blocked, busy }: {
  locale: Locale;
  flags: SecurityFlagRow[];
  readOnly?: boolean;
  onToggle?: (key: string, next: boolean) => void;
  mark?: ReactNode;
  /** wyglad/2fa: przełącznik zablokowany z powodem (np. MFA_HHL_ADMIN — konto bez 2FA na dwóch urządzeniach albo sesja bez kodu) */
  blocked?: Partial<Record<string, string>>;
  /** Zapis w toku (produkcja): przełączniki i „Tak, zmień” wyłączone. */
  busy?: boolean;
}) {
  const [flags, setFlags] = useState(() => namedFlags(locale, initialRaw));
  /* produkcja: po zapisie przychodzi nowy stan z bazy (stan i ostatnia zmiana) */
  useEffect(() => { setFlags(namedFlags(locale, initialRaw)); }, [initialRaw, locale]);
  const [ask, setAsk] = useState<(SecurityFlagRow & { name: string; does: string }) | null>(null);
  const last = (f: SecurityFlagRow & { name: string }) => `${f.when} · ${f.by ?? t(locale, 'p3c_by_command')}`;
  const confirm = () => {
    if (!ask) return;
    setFlags((fs) => fs.map((f) => (f.key === ask.key ? { ...f, on: !f.on } : f)));
    onToggle?.(ask.key, !ask.on);
    setAsk(null);
  };
  const sw = (f: SecurityFlagRow & { name: string; does: string }) => (
    <button
      type="button"
      className="ox-switch"
      role="switch"
      aria-checked={f.on}
      aria-label={f.name}
      disabled={readOnly || busy || (!!blocked?.[f.key] && !f.on)}
      onClick={() => setAsk(f)}
    ><span className="ox-track"><i /></span></button>
  );
  return (
    <div className="ox-flags">
      <div className="ox-count-line"><span>{tp(locale, 'p3c_flags_count', { n: flags.length })}</span>{mark}</div>
      <table className="ox-table ox-cards-phone" data-opt-table="flags">
        <thead><tr><th>{t(locale, 'p3c_col_flag')}</th><th>{t(locale, 'p3c_col_state')}</th><th>{t(locale, 'p3c_col_does')}</th><th>{t(locale, 'p3c_col_last')}</th></tr></thead>
        <tbody>
          {flags.map((f) => (
            <tr key={f.key} data-flag={f.key}>
              <th scope="row" data-label={t(locale, 'p3c_col_flag')}><b>{f.name}</b>{blocked?.[f.key] && !f.on && !readOnly ? <small className="ox-flag-why" data-flag-blocked>{blocked[f.key]}</small> : null}</th>
              <td data-label={t(locale, 'p3c_col_state')}>{sw(f)}</td>
              <td data-label={t(locale, 'p3c_col_does')}>{f.does}</td>
              <td data-label={t(locale, 'p3c_col_last')} className="ox-flag-last" data-content>{last(f)}</td>
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
              <button type="button" className="btn ox-btn" disabled={busy} onClick={confirm}>{t(locale, 'p3c_yes_change')}</button>
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

/** Filtry Historii zmian (produkcja: sterowane — każdy wybór pobiera wpisy z bazy). */
export type HistoryFilters = { from: string; to: string; who: string; what: string; q: string };
type Opt = { value: string; label: string };

export function HistoryScreen({ locale, entries, techCount, people, areas, range, mark, onDownload, filters, onFilters, tech: techIn, onTech, onRefresh, busy, note }: {
  locale: Locale;
  entries: HistoryEntry[];
  /** Liczba zmian technicznych ukrytych domyślnie. */
  techCount?: number;
  people: Array<string | Opt>;
  areas: Array<string | Opt>;
  range: { from: string; to: string };
  mark?: ReactNode;
  onDownload?: (fmt: 'csv' | 'xlsx') => void;
  /** Produkcja: filtry sterowane z zewnątrz (z polem „Szukaj”). */
  filters?: HistoryFilters;
  onFilters?: (f: HistoryFilters) => void;
  tech?: boolean;
  onTech?: (on: boolean) => void;
  onRefresh?: () => void;
  busy?: boolean;
  note?: string;
}) {
  const [techOwn, setTechOwn] = useState(false);
  const tech = techIn ?? techOwn;
  const setTech = (on: boolean) => { setTechOwn(on); onTech?.(on); };
  const opt = (o: string | Opt): Opt => (typeof o === 'string' ? { value: o, label: o } : o);
  const f = filters;
  const set = (patch: Partial<HistoryFilters>) => { if (f) onFilters?.({ ...f, ...patch }); };
  return (
    <div className="ox-hist">
      <div className="ox-filters">
        <label className="ox-field"><span>{t(locale, 'p3c_hist_from')}</span>{f
          ? <input className="input" type="date" value={f.from} onChange={(e) => set({ from: e.target.value })} />
          : <input className="input" type="date" defaultValue={range.from} />}</label>
        <label className="ox-field"><span>{t(locale, 'p3c_hist_to')}</span>{f
          ? <input className="input" type="date" value={f.to} onChange={(e) => set({ to: e.target.value })} />
          : <input className="input" type="date" defaultValue={range.to} />}</label>
        <label className="ox-field"><span>{t(locale, 'p3c_hist_who')}</span>
          <select className="input" {...(f ? { value: f.who, onChange: (e) => set({ who: e.target.value }) } : { defaultValue: '' })}>
            <option value="">{t(locale, 'p3c_hist_all')}</option>
            {people.map(opt).map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </label>
        <label className="ox-field"><span>{t(locale, 'p3c_hist_what')}</span>
          <select className="input" {...(f ? { value: f.what, onChange: (e) => set({ what: e.target.value }) } : { defaultValue: '' })}>
            <option value="">{t(locale, 'p3c_hist_all_what')}</option>
            {areas.map(opt).map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
          </select>
        </label>
        {f ? (
          <label className="ox-field"><span>{t(locale, 'opt_acc_hist_search')}</span>
            <input className="input" type="search" value={f.q} placeholder={t(locale, 'opt_acc_hist_search_ph')} onChange={(e) => set({ q: e.target.value })} />
          </label>
        ) : null}
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
        {onRefresh ? <button type="button" className="btn ghost ox-btn" disabled={busy} onClick={onRefresh}>{t(locale, 'opt_acc_hist_refresh')}</button> : null}
        <button type="button" className="btn ghost ox-btn" disabled={busy || (!!f && !entries.length)} onClick={() => onDownload?.('csv')}>{t(locale, 'p3c_dl_csv')}</button>
        <button type="button" className="btn ghost ox-btn" disabled={busy || (!!f && !entries.length)} onClick={() => onDownload?.('xlsx')}>{t(locale, 'p3c_dl_xlsx')}</button>
      </div>
      {note ? <p className="ox-foot">{note}</p> : null}
    </div>
  );
}

/* ---------- Eksport danych ---------- */

export type ExportKind = 'loads' | 'hist' | 'risks' | 'fin';
const EXPORT_KEY: Record<ExportKind, string> = { loads: 'p3c_exp_loads', hist: 'p3c_exp_hist', risks: 'p3c_exp_risks', fin: 'p3c_exp_fin' };

export function ExportScreen({ locale, kinds, range, fileName, onDownload, onRange, fileNote, busy, labels }: {
  locale: Locale;
  /** Co ta rola może pobrać (Faktury i finanse — tylko HHL; Historia zmian — bez Operacji, E12-1). */
  kinds: ExportKind[];
  range: { from: string; to: string };
  /** np. „WatchTower_Transporty_01.10.2026–08.10.2026.xlsx” */
  fileName: (kind: ExportKind) => string;
  onDownload?: (kind: ExportKind, fmt: 'xlsx' | 'csv') => void;
  /** Produkcja: zakres sterowany (puste pola = wszystko). */
  onRange?: (r: { from: string; to: string }) => void;
  /** Zamiast „bez limitu wierszy” (produkcja: limit pobrania). */
  fileNote?: (kind: ExportKind) => string;
  busy?: boolean;
  /** Własna nazwa rodzaju (produkcja: „Sprawy” = decyzje). */
  labels?: Partial<Record<ExportKind, string>>;
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
                {labels?.[k] ?? t(locale, EXPORT_KEY[k])}{k === 'fin' ? <small> ({t(locale, 'p3c_exp_fin_note')})</small> : null}
              </button>
            ))}
          </div>
        </dd>
        <dt>{t(locale, 'p3c_exp_range')}</dt>
        <dd>
          <div className="ox-range">
            <label className="ox-field"><span>{t(locale, 'p3c_hist_from')}</span>{onRange
              ? <input className="input" type="date" value={range.from} onChange={(e) => onRange({ ...range, from: e.target.value })} />
              : <input className="input" type="date" defaultValue={range.from} />}</label>
            <label className="ox-field"><span>{t(locale, 'p3c_hist_to')}</span>{onRange
              ? <input className="input" type="date" value={range.to} onChange={(e) => onRange({ ...range, to: e.target.value })} />
              : <input className="input" type="date" defaultValue={range.to} />}</label>
          </div>
          <small className="ox-muted">{t(locale, 'p3c_exp_range_note')}</small>
        </dd>
        <dt>{t(locale, 'p3c_exp_cols')}</dt><dd>{t(locale, 'p3c_exp_cols_note')}</dd>
        <dt>{t(locale, 'p3c_exp_who')}</dt><dd>{t(locale, 'p3c_exp_who_note')}</dd>
        <dt>{t(locale, 'p3c_exp_file')}</dt><dd><span className="ox-file" data-content>„{fileName(kind)}”</span> · {fileNote ? fileNote(kind) : t(locale, 'p3c_exp_no_limit')}</dd>
      </dl>
      <div className="ox-actions ox-actions-start">
        <button type="button" className="btn ox-btn" disabled={busy} onClick={() => onDownload?.(kind, 'xlsx')}>{t(locale, 'p3c_dl_xlsx')}</button>
        <button type="button" className="btn ghost ox-btn" disabled={busy} onClick={() => onDownload?.(kind, 'csv')}>{t(locale, 'p3c_dl_csv')}</button>
      </div>
    </div>
  );
}

/* ---------- Progi alarmów ---------- */

/** Klucze `ops_thresholds` w kolejności ekranu; etykieta i zdanie o skutku: p3c_thr_<KEY> / p3c_thr_<KEY>_fx. */
export const THRESHOLD_KEYS = [
  'WAVE_M', 'GUST_KN', 'DELAY_MIN', 'LEAD_DAYS',
  'AWIZ_EARLY_H', 'AWIZ_LATE_H', 'DOC_WARN_H', 'DOC_CRIT_H',
  'SILENT_MIN', 'SILENT_STOP_H', 'OFFROUTE_KM',
  'ETA_CONF_HIGH_MIN', 'ETA_CONF_MED_MIN', 'GEOFENCE_EDGE_M',
] as const;

export type ThresholdRow = {
  key: string;
  value: number;
  /** „m”, „węzłów”, „min”, „dni”, „h”, „km” */
  unit: string;
};

/** P11 (E21): procent bez odstępu („4%”), inne jednostki z odstępem („30 min”). */
const withUnit = (v: string, unit: string) => (unit === '%' ? `${v}%` : `${v} ${unit}`);

/** Przełącznik 0/1 nad progami (produkcja: `import_quiet_hours` — ciche uzupełnienie godzin z pliku KSH). */
export type ThresholdToggle = { key: string; label: string; note: string; on: boolean };

export function ThresholdsScreen({ locale, rows, readOnly, onSave, mark, toggles, onToggle, labels, busy }: {
  locale: Locale;
  rows: ThresholdRow[];
  readOnly?: boolean;
  /** Zapis po potwierdzeniu (wykonawca: admin_ops_threshold_set). */
  onSave?: (key: string, value: number) => void;
  mark?: ReactNode;
  toggles?: ThresholdToggle[];
  onToggle?: (key: string, on: boolean) => void;
  /** Etykieta i zdanie o skutku spoza słownika (produkcja: próg z bazy bez wpisu — nazwa z `label_pl`). */
  labels?: Partial<Record<string, { label: string; fx: string }>>;
  /** Zapis w toku (produkcja): „Zmień”, „Tak, zmień” i przełącznik wyłączone. */
  busy?: boolean;
}) {
  const [vals, setVals] = useState<Record<string, number>>(() => Object.fromEntries(rows.map((r) => [r.key, r.value])));
  /* produkcja: po zapisie i odświeżeniu przychodzą wartości z bazy */
  useEffect(() => { setVals(Object.fromEntries(rows.map((r) => [r.key, r.value]))); }, [rows]);
  const [edit, setEdit] = useState<{ key: string; draft: string; ask: boolean } | null>(null);
  const fmt = (n: number) => new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 2 }).format(n);
  const num = (d: string) => Number(d.replace(',', '.'));
  return (
    <div className="ox-thr">
      {mark ? <div className="ox-count-line"><span />{mark}</div> : null}
      {toggles?.length ? (
        <ul className="ox-thr-list" data-thr-toggles>
          {toggles.map((g) => (
            <li key={g.key} data-threshold-toggle={g.key} data-on={g.on ? 'on' : 'off'}>
              <span className="ox-thr-label">{g.label}</span>
              <span className="ox-thr-val"><span>{g.note}</span></span>
              <button type="button" className="ox-switch" role="switch" aria-checked={g.on} aria-label={g.label} disabled={readOnly || busy} onClick={() => onToggle?.(g.key, !g.on)}><span className="ox-track"><i /></span></button>
            </li>
          ))}
        </ul>
      ) : null}
      <ul className="ox-thr-list">
        {rows.map((r) => {
          const label = labels?.[r.key]?.label ?? E49_THR[r.key] ?? t(locale, `p3c_thr_${r.key}`);
          const fx = labels?.[r.key]?.fx ?? E49_THR[`${r.key}_fx`] ?? t(locale, `p3c_thr_${r.key}_fx`);
          const editing = edit?.key === r.key;
          const v = vals[r.key];
          return (
            <li key={r.key} data-threshold={r.key} className={editing ? 'is-edit' : undefined}>
              <span className="ox-thr-label">{label}</span>
              {editing ? (
                <span className="ox-thr-edit">
                  {edit.ask ? (
                    <span className="ox-thr-ask">{t(locale, 'p3c_thr_ask').replace('{name}', label).replace('{was}', withUnit(fmt(v), r.unit)).replace('{is}', withUnit(fmt(num(edit.draft)), r.unit))}</span>
                  ) : (
                    <label className="ox-thr-input"><input className="input" inputMode="decimal" aria-label={label} value={edit.draft} onChange={(e) => setEdit({ ...edit, draft: e.target.value })} /><span>{r.unit}</span></label>
                  )}
                  <span className="ox-thr-val"><span>— {fx}</span></span>
                </span>
              ) : (
                <span className="ox-thr-val"><b data-content>{withUnit(fmt(v), r.unit)}</b> <span>— {fx}</span></span>
              )}
              {readOnly ? null : editing ? (
                <span className="ox-thr-btns">
                  <button type="button" className="btn ghost ox-btn" onClick={() => setEdit(null)}>{t(locale, 'p3c_cancel')}</button>
                  {edit.ask ? (
                    <button type="button" className="btn ox-btn" disabled={busy} onClick={() => { setVals({ ...vals, [r.key]: num(edit.draft) }); onSave?.(r.key, num(edit.draft)); setEdit(null); }}>{t(locale, 'p3c_yes_change')}</button>
                  ) : (
                    <button type="button" className="btn ox-btn" disabled={!(num(edit.draft) > 0) || num(edit.draft) === v} onClick={() => setEdit({ ...edit, ask: true })}>{t(locale, 'p3c_m_save')}</button>
                  )}
                </span>
              ) : (
                <button type="button" className="btn ghost ox-btn" disabled={busy} onClick={() => setEdit({ key: r.key, draft: fmt(v), ask: false })}>{t(locale, 'p3c_thr_change')}</button>
              )}
            </li>
          );
        })}
        {/* P11 (e12, makieta „Progi alarmów”, ostatni wiersz): progi źródeł danych są w Stanie systemu — odnośnik */}
        <li data-threshold-link="status">
          <span className="ox-thr-label">{t(locale, 'p3c_thr_src')}</span>
          <span className="ox-thr-val"><span>{t(locale, 'p3c_thr_src_v')}</span></span>
          <button type="button" className="btn ghost ox-btn" onClick={() => openOptionsScreen('status')}>{t(locale, 'p3c_thr_src_go')}</button>
        </li>
      </ul>
    </div>
  );
}
