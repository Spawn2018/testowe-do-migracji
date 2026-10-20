/**
 * DEC-6 — progi i terminy (ops_thresholds). Tylko HHL_ADMIN zapisuje przez RPC.
 */
import { useCallback, useEffect, useState } from 'react';
import { getSupabase } from './client';
import { useTowerStore } from '../store/useTowerStore';
import { t } from '../i18n/messages';
import './auth.css';

type Row = { key: string; value_num: number; unit: string; label_pl: string };

const ORDER = [
  'WAVE_M', 'GUST_KN', 'DELAY_MIN', 'LEAD_DAYS',
  'AWIZ_EARLY_H', 'AWIZ_LATE_H', 'DOC_WARN_H', 'DOC_CRIT_H',
  'SILENT_MIN', 'SILENT_STOP_H', 'OFFROUTE_KM',
  'ETA_CONF_HIGH_MIN', 'ETA_CONF_MED_MIN', 'GEOFENCE_EDGE_M',
] as const;

/** D-20261020-1157-01 (#356, 0240): przełącznik 0/1 „cichego” uzupełnienia godzin z pliku KSH — wyłączenie 26.10. */
const QUIET_KEY = 'import_quiet_hours';

export default function OpsThresholdsForm() {
  const locale = useTowerStore((s) => s.locale);
  const [rows, setRows] = useState<Row[]>([]);
  const [quiet, setQuiet] = useState<Row | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const sb = await getSupabase();
    const q = await sb.from('ops_thresholds').select('key,value_num,unit,label_pl');
    if (q.error) {
      setMsg(q.error.message);
      return;
    }
    const list = ((q.data ?? []) as Row[]).filter((r) => (ORDER as readonly string[]).includes(r.key));
    list.sort((a, b) => ORDER.indexOf(a.key as typeof ORDER[number]) - ORDER.indexOf(b.key as typeof ORDER[number]));
    setRows(list);
    setQuiet(((q.data ?? []) as Row[]).find((r) => r.key === QUIET_KEY) ?? null);
    const d: Record<string, string> = {};
    for (const r of list) d[r.key] = String(r.value_num);
    setDraft(d);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function save(key: string) {
    const raw = draft[key];
    const num = Number(String(raw).replace(',', '.'));
    if (!(num > 0)) {
      setMsg(t(locale, 'opt_acc_thresh_bad'));
      return;
    }
    setBusy(true);
    const sb = await getSupabase();
    const { error } = await sb.rpc('admin_ops_threshold_set', { p_key: key, p_value: num });
    setBusy(false);
    if (error) {
      setMsg(error.message);
      return;
    }
    setMsg(null);
    await refresh();
  }

  /* przełącznik 0/1 — RPC przyjmuje 0 tylko dla tego klucza (0240); zapis od razu po kliknięciu */
  async function setQuietOn(on: boolean) {
    setBusy(true);
    const sb = await getSupabase();
    const { error } = await sb.rpc('admin_ops_threshold_set', { p_key: QUIET_KEY, p_value: on ? 1 : 0 });
    setBusy(false);
    if (error) {
      setMsg(error.message);
      return;
    }
    setMsg(null);
    await refresh();
  }

  return (
    <div data-panel="ops-thresholds">
      {msg ? <div className="note">{msg}</div> : null}
      {quiet ? (
        <label className="check-row" data-quiet-hours={quiet.value_num === 1 ? 'on' : 'off'}>
          <input type="checkbox" checked={quiet.value_num === 1} disabled={busy} onChange={(e) => void setQuietOn(e.target.checked)} />
          <span>
            <b>{t(locale, 'opt_quiet_hours')}</b>
            <small>{` — ${t(locale, quiet.value_num === 1 ? 'opt_quiet_hours_on' : 'opt_quiet_hours_off')}`}</small>
          </span>
        </label>
      ) : null}
      <dl className="kv options-kv">
        {rows.map((r) => (
          <div className="kv-row" key={r.key}>
            <dt>{locale === 'pl' ? r.label_pl : t(locale, `opt_thr_${r.key}`)}</dt>
            <dd>
              <div className="inline-input">
                <input
                  className="input"
                  type="number"
                  step="any"
                  min="0"
                  disabled={busy}
                  aria-label={r.label_pl}
                  value={draft[r.key] ?? ''}
                  onChange={(e) => setDraft((d) => ({ ...d, [r.key]: e.target.value }))}
                  onBlur={() => void save(r.key)}
                />
                <span>{r.unit}</span>
              </div>
            </dd>
          </div>
        ))}
      </dl>
      <div className="note option-note">{t(locale, 'opt_acc_thresh_note')}</div>
    </div>
  );
}

const DWELL = [
  'DWELL_FREE_LOAD_H', 'DWELL_FREE_UNLOAD_H', 'DWELL_HOURLY_EUR', 'DWELL_DAILY_EUR',
  'DWELL_START_LATER', 'DWELL_FULL_HOUR', 'DWELL_DAY_AFTER_H',
] as const;

export function DwellOptionsForm() {
  const locale = useTowerStore((s) => s.locale);
  const [rows, setRows] = useState<Row[]>([]);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => {
    const sb = await getSupabase();
    const q = await sb.from('ops_thresholds').select('key,value_num,unit,label_pl');
    if (q.error) { setMsg(q.error.message); return; }
    const list = ((q.data ?? []) as Row[]).filter((r) => (DWELL as readonly string[]).includes(r.key));
    list.sort((a, b) => DWELL.indexOf(a.key as typeof DWELL[number]) - DWELL.indexOf(b.key as typeof DWELL[number]));
    setRows(list);
    const d: Record<string, string> = {};
    for (const r of list) d[r.key] = String(r.value_num);
    setDraft(d);
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  async function save(key: string) {
    const num = Number(String(draft[key]).replace(',', '.'));
    if (!(num > 0)) { setMsg(t(locale, 'opt_acc_thresh_bad')); return; }
    setBusy(true);
    const sb = await getSupabase();
    const { error } = await sb.rpc('admin_ops_threshold_set', { p_key: key, p_value: num });
    setBusy(false);
    if (error) { setMsg(error.message); return; }
    setMsg(null);
    await refresh();
  }
  return (
    <div data-panel="dwell-options">
      {msg ? <div className="note">{msg}</div> : null}
      <dl className="kv options-kv">
        {rows.map((r) => (
          <div className="kv-row" key={r.key}>
            <dt>{r.label_pl}</dt>
            <dd>
              <div className="inline-input">
                <input className="input" type="number" step="any" min="0" disabled={busy} aria-label={r.label_pl}
                  value={draft[r.key] ?? ''} onChange={(e) => setDraft((d) => ({ ...d, [r.key]: e.target.value }))}
                  onBlur={() => void save(r.key)} />
                <span>{r.unit}</span>
              </div>
            </dd>
          </div>
        ))}
      </dl>
      <div className="note option-note">{t(locale, 'opt_acc_dwell_note')}</div>
    </div>
  );
}
