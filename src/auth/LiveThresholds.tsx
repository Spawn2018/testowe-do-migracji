/**
 * Opcje › Zasady transportu › Progi alarmów — produkcja w wyglądzie z audytu (E12 „Progi alarmów”: wartość ze zdaniem o skutku,
 * zmiana z potwierdzeniem). Ekran = `ThresholdsScreen` (ten sam co w demo). Dane jak w dawnym `OpsThresholdsForm`:
 * `ops_thresholds` (wszystkie progi poza dopłatami — także `SILENT_MIN_EMTRACK` z 0254), przełącznik „Ciche uzupełnienie godzin”
 * (`import_quiet_hours`, 0/1), zapis `admin_ops_threshold_set`. Operacje HHL — tylko odczyt (E12-1A).
 * Progi wiatru i śliskości (E49) w bazie jeszcze nie istnieją — ekran pokazuje tylko to, co jest w bazie.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getSupabase } from './client';
import { useTowerStore } from '../store/useTowerStore';
import { hasKey, t, tp } from '../i18n/messages';
import { THRESHOLD_KEYS, ThresholdsScreen, type ThresholdRow } from '../components/options/SystemScreens';
import { announceOptionsChanged, errText, QUIET_KEY, useBusy } from './liveOpts';

type Db = { key: string; value_num: number | string; unit: string; label_pl: string };

/** Kolejność ekranu: E12 + cisza naczepy emtrack (#398, 0254) zaraz po ciszy GPS. */
export const LIVE_THRESHOLD_ORDER: readonly string[] = (() => {
  const base = [...THRESHOLD_KEYS] as string[];
  base.splice(base.indexOf('SILENT_STOP_H') + 1, 0, 'SILENT_MIN_EMTRACK');
  return base;
})();
/** Dopłaty (postój) mają własny ekran „Dopłaty”. */
const DWELL = /^DWELL_/;

const UNIT: Record<string, string> = { kn: 'węzłów', d: 'dni' };

/** Wiersze ekranu z bazy: znane klucze w kolejności E12, potem pozostałe z bazy (poza dopłatami i przełącznikiem 0/1). */
export function thresholdRows(rows: readonly Db[]): ThresholdRow[] {
  const list = rows.filter((r) => r.key !== QUIET_KEY && !DWELL.test(r.key));
  const pos = (k: string) => { const i = LIVE_THRESHOLD_ORDER.indexOf(k); return i < 0 ? 1000 : i; };
  return [...list]
    .sort((a, b) => pos(a.key) - pos(b.key) || a.key.localeCompare(b.key))
    .map((r) => ({ key: r.key, value: Number(r.value_num), unit: UNIT[r.unit] ?? r.unit }));
}

export default function LiveThresholds({ readOnly = false }: { readOnly?: boolean }) {
  const locale = useTowerStore((s) => s.locale);
  const [rows, setRows] = useState<Db[] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const { busy, guard } = useBusy((e) => setMsg(errText(locale, e)));

  const refresh = useCallback(async () => {
    try {
    const sb = await getSupabase();
    const q = await sb.from('ops_thresholds').select('key,value_num,unit,label_pl');
    if (q.error) { setMsg(errText(locale, q.error)); setRows([]); return; }
    setRows((q.data ?? []) as Db[]);
    } catch (e) {
      setMsg(errText(locale, e));
      setRows((cur) => cur ?? []);
    }
  }, [locale]);
  useEffect(() => { void refresh(); }, [refresh]);

  const save = (key: string, value: number) => {
    if (readOnly) return;
    if (!(value > 0)) { setMsg(t(locale, 'opt_acc_thresh_bad')); return; }
    void guard(async () => {
      const sb = await getSupabase();
      const { error } = await sb.rpc('admin_ops_threshold_set', { p_key: key, p_value: value });
      setMsg(error ? errText(locale, error) : null);
      if (!error) announceOptionsChanged();
      await refresh();
    });
  };
  const toggle = (key: string, on: boolean) => {
    if (readOnly || key !== QUIET_KEY) return;
    void guard(async () => {
      const sb = await getSupabase();
      const { error } = await sb.rpc('admin_ops_threshold_set', { p_key: QUIET_KEY, p_value: on ? 1 : 0 });
      setMsg(error ? errText(locale, error) : null);
      if (!error) announceOptionsChanged();
      await refresh();
    });
  };

  const list = useMemo(() => thresholdRows(rows ?? []), [rows]);
  if (!rows) return <div className="note" role="status">{msg ?? t(locale, 'p3l_loading')}</div>;
  const quiet = rows.find((r) => r.key === QUIET_KEY);
  /* próg z bazy bez wpisu w słowniku: nazwa z `label_pl`, bez zdania o skutku */
  const labels = Object.fromEntries(rows
    .filter((r) => !hasKey(locale, `p3c_thr_${r.key}`))
    .map((r) => [r.key, { label: r.label_pl, fx: t(locale, 'p3l_thr_fx_none') }]));
  return (
    <div data-panel="ops-thresholds" data-live="thresholds">
      {msg ? <div className="note ox-alert" role="status">{msg}</div> : null}
      <ThresholdsScreen
        locale={locale}
        rows={list}
        readOnly={readOnly}
        onSave={save}
        labels={labels}
        toggles={quiet ? [{
          key: QUIET_KEY,
          label: t(locale, 'opt_quiet_hours'),
          note: t(locale, Number(quiet.value_num) === 1 ? 'opt_quiet_hours_on' : 'opt_quiet_hours_off'),
          on: Number(quiet.value_num) === 1,
        }] : undefined}
        onToggle={toggle}
        busy={busy}
      />
    </div>
  );
}
