/**
 * Opcje › Pieniądze › Dopłaty — produkcja w wyglądzie z audytu (E33): ekran `DwellScreen` (ten sam co w demo).
 * Dane i zapis jak w dzisiejszym formularzu `DwellOptionsForm`: tabela `ops_thresholds` (klucze DWELL_*), zapis RPC
 * `admin_ops_threshold_set` (tylko Administrator HHL — baza odmawia innym). Wybory „start liczenia” i „godzina” w bazie
 * jako 1 / 2 (1 = później z wjazdu i planu, 2 = od wjazdu; 1 = cała godzina, 2 = ułamek).
 */
import { useCallback, useEffect, useState } from 'react';
import { getSupabase } from './client';
import { useTowerStore } from '../store/useTowerStore';
import { t } from '../i18n/messages';
import { DwellScreen } from '../components/options/MoneyScreens';
import type { DwellRulesView } from '../lib/p5bFuel';
import type { DwellPatch } from '../lib/p5bSource';

type Row = { key: string; value_num: number | string; updated_at: string | null };

const KEY: Record<keyof DwellPatch, string> = {
  freeLoadH: 'DWELL_FREE_LOAD_H',
  freeUnloadH: 'DWELL_FREE_UNLOAD_H',
  hourEur: 'DWELL_HOURLY_EUR',
  dayEur: 'DWELL_DAILY_EUR',
  dayAfterH: 'DWELL_DAY_AFTER_H',
  startFrom: 'DWELL_START_LATER',
  hourMode: 'DWELL_FULL_HOUR',
};

/** Wiersze `ops_thresholds` → zasady postoju; null — brakuje któregoś klucza (ekran pokazuje brak źródła). */
export function dwellFromDb(rows: readonly Row[]): DwellRulesView | null {
  const v = (k: string) => {
    const r = rows.find((x) => x.key === k);
    const n = r ? Number(r.value_num) : NaN;
    return Number.isFinite(n) ? n : null;
  };
  const vals = Object.fromEntries(Object.entries(KEY).map(([f, k]) => [f, v(k)])) as Record<keyof DwellPatch, number | null>;
  if (Object.values(vals).some((x) => x == null)) return null;
  return {
    freeLoadH: vals.freeLoadH!, freeUnloadH: vals.freeUnloadH!, hourEur: vals.hourEur!, dayEur: vals.dayEur!, dayAfterH: vals.dayAfterH!,
    startFrom: vals.startFrom === 2 ? 'ENTRY' : 'LATER',
    hourMode: vals.hourMode === 2 ? 'FRACTION' : 'FULL',
    /* kto zmienił — w tabeli progów nie ma autora; data i autor są w Historii zmian */
    changed: null,
  };
}

/** Zmiana z ekranu → pary (klucz, wartość) dla `admin_ops_threshold_set`. */
export function dwellPatchToDb(patch: DwellPatch): Array<{ key: string; value: number }> {
  return (Object.entries(patch) as Array<[keyof DwellPatch, DwellPatch[keyof DwellPatch]]>).flatMap(([f, val]) => {
    if (val == null) return [];
    if (f === 'startFrom') return [{ key: KEY[f], value: val === 'ENTRY' ? 2 : 1 }];
    if (f === 'hourMode') return [{ key: KEY[f], value: val === 'FRACTION' ? 2 : 1 }];
    return [{ key: KEY[f], value: Number(val) }];
  });
}

export default function LiveDwell({ readOnly = false }: { readOnly?: boolean }) {
  const locale = useTowerStore((s) => s.locale);
  const [rules, setRules] = useState<DwellRulesView | null | undefined>(undefined);
  const [ver, setVer] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const sb = await getSupabase();
    const q = await sb.from('ops_thresholds').select('key,value_num,updated_at').like('key', 'DWELL_%');
    if (q.error) { setMsg(q.error.message); setRules(null); return; }
    setRules(dwellFromDb((q.data ?? []) as Row[]));
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  const save = useCallback(async (patch: DwellPatch): Promise<boolean> => {
    if (readOnly) return false;
    const sb = await getSupabase();
    for (const p of dwellPatchToDb(patch)) {
      const { error } = await sb.rpc('admin_ops_threshold_set', { p_key: p.key, p_value: p.value });
      if (error) { setMsg(error.message); return false; }
    }
    setMsg(null);
    return true;
  }, [readOnly]);

  if (rules === undefined) return null;
  if (rules === null) return <div className="note option-note" role="status">{msg ?? t(locale, 'p3c_no_source')}</div>;
  return (
    <div data-panel="live-dwell">
      {msg ? <div className="note" role="status">{msg}</div> : null}
      <DwellScreen key={ver} locale={locale} rules={rules} readOnly={readOnly} onSave={readOnly ? null : async (p) => { const ok = await save(p); if (!ok) { await refresh(); setVer((v) => v + 1); } return ok; }} />
    </div>
  );
}
