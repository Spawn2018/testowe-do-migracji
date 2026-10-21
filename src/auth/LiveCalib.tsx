/**
 * Opcje › Zasady transportu › Kalibracja ETA — produkcja w wyglądzie z demo (E15 pkt 7; `EtaCalibScreen`).
 * Odczyt: czasy odcinków `eta_segment_params`, pomiary dostaw `eta_segment_observations`, wersje `eta_calibration_versions`
 * (zatwierdzone = `applied`; propozycja = najnowsza niezastosowana i niezamrożona), zamrożenie `app_parameters.ETA_CALIBRATION_FROZEN`.
 * Zapis: `apply_eta_calibration_version(p_version)` i `admin_set_eta_calibration_frozen(p_frozen)` — tylko Administrator HHL.
 * Błędu ETA 24 h / 6 h / 1 h, odprawy i przerw baza jeszcze nie zapisuje — kolumny „–”.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getSupabase } from './client';
import { useTowerStore } from '../store/useTowerStore';
import { t, tp } from '../i18n/messages';
import { etaDuration } from '../lib/etaDuration';
import { EtaCalibScreen } from '../components/options/EtaCalibScreen';
import { CALIB_NEEDED, CALIB_SAME_PCT, fixed, measured } from '../lib/etaCalibDemo';
import type { CalibObservation, CalibSegment, CalibVersion, EtaCalibration } from '../lib/etaCalibSource';
import type { Load, Locale } from '../types';
import { announceOptionsChanged, personName, type PersonDb } from './liveOpts';

type Param = { code: string; label: string; hours: number | string };
type Obs = { id: number; load_id: string; corridor: string; hours_observed: number | string | null; exclude_reason: string | null; observed_at: string };
type Ver = { id: number; created_at: string; created_by: string | null; params_after: Record<string, { hours?: number | string }> | null; n_obs: number | null; error_before_min: number | string | null; error_after_min: number | string | null; applied: boolean; frozen: boolean | null; note: string | null };

/** Odcinek pomiaru → kod czasu (`eta_segment_params`). */
const CORRIDOR_SEG: Record<string, string> = { SE_E4: 'SE_ROAD', PL_ROAD: 'PL_ROAD' };
/** Bez kalibracji (rozkład armatora, przepisy UE) i parametry, które nie są odcinkiem trasy. */
const FIXED_NOTE: Record<string, string> = { CROSSING_DEFAULT: 'p3l_cal_fixed_crossing', SE_DAILY_REST: 'p3l_cal_fixed_rest' };
const NOT_SEGMENT = new Set(['GPS_FRESH_MIN']);

const minOf = (h: number | string | null | undefined) => (h == null || h === '' ? null : Math.round(Number(h) * 60));

export function calibFromDb(locale: Locale, params: readonly Param[], obs: readonly Obs[], vers: readonly Ver[], loads: readonly Load[], nameOf: (id: string | null) => string): EtaCalibration {
  const code = (id: string) => loads.find((l) => l.id === id)?.code ?? id.slice(0, 8);
  const observations: CalibObservation[] = obs.map((o) => ({
    id: `obs-${o.id}`,
    loadId: o.load_id,
    code: code(o.load_id),
    arrivedAt: o.observed_at,
    err24: null, err6: null, err1: null,
    plMin: CORRIDOR_SEG[o.corridor] === 'PL_ROAD' ? minOf(o.hours_observed) : null,
    portMin: null,
    seMin: CORRIDOR_SEG[o.corridor] === 'SE_ROAD' ? minOf(o.hours_observed) : null,
    breaksMin: null,
    rest: null,
    skipped: o.exclude_reason,
  }));
  const proposalVer = [...vers].filter((v) => !v.applied && !v.frozen).sort((a, b) => b.id - a.id)[0] ?? null;
  const segments: CalibSegment[] = params.filter((p) => !NOT_SEGMENT.has(p.code)).map((p) => {
    const cur = minOf(p.hours) ?? 0;
    if (FIXED_NOTE[p.code]) return fixed(p.code, p.label, cur, t(locale, FIXED_NOTE[p.code]));
    const values = obs
      .filter((o) => !o.exclude_reason && CORRIDOR_SEG[o.corridor] === p.code && o.hours_observed != null)
      .map((o) => minOf(o.hours_observed)!);
    const m = measured(p.code, p.label, cur, values);
    /* propozycja z bazy: czas po zmianie = `params_after` (to zapisze „Zatwierdź”) */
    const after = proposalVer?.params_after?.[p.code]?.hours;
    if (after != null && cur > 0) {
      const med = minOf(after)!;
      const dev = Math.round(((med - cur) / cur) * 100);
      return { ...m, medianMin: med, devPct: dev, verdict: Math.abs(dev) <= CALIB_SAME_PCT ? 'same' : 'propose', n: Math.max(m.n, proposalVer?.n_obs ?? 0) };
    }
    /* bez propozycji w bazie nie ma czego zatwierdzić — „zmiana” zostaje informacją (mediana i odchylenie) */
    return m;
  });
  const applied = [...vers].filter((v) => v.applied).sort((a, b) => a.id - b.id);
  const versions: CalibVersion[] = applied.map((v, i) => ({
    id: String(v.id),
    no: i + 1,
    at: v.created_at,
    by: nameOf(v.created_by),
    what: v.note?.trim() || tp(locale, 'p3l_cal_ver_what', {
      list: Object.entries(v.params_after ?? {}).map(([k, x]) => `${params.find((p) => p.code === k)?.label ?? k} ${etaDuration(minOf(x.hours) ?? 0)}`).join(', '),
    }),
    current: i === applied.length - 1,
  })).reverse();
  return {
    needed: CALIB_NEEDED,
    observations,
    segments,
    versions,
    proposal: proposalVer ? {
      id: String(proposalVer.id),
      at: proposalVer.created_at,
      errorBeforeMin: Math.round(Number(proposalVer.error_before_min ?? 0)),
      errorAfterMin: Math.round(Number(proposalVer.error_after_min ?? 0)),
    } : null,
  };
}

export default function LiveCalib({ readOnly = false }: { readOnly?: boolean }) {
  const locale = useTowerStore((s) => s.locale);
  const loads = useTowerStore((s) => s.loads);
  const [db, setDb] = useState<{ params: Param[]; obs: Obs[]; vers: Ver[]; frozen: boolean } | null>(null);
  const [people, setPeople] = useState<PersonDb[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const sb = await getSupabase();
    const [p, o, v, f, u] = await Promise.all([
      sb.from('eta_segment_params').select('code,label,hours').order('code'),
      sb.from('eta_segment_observations').select('id,load_id,corridor,hours_observed,exclude_reason,observed_at').order('observed_at'),
      sb.from('eta_calibration_versions').select('id,created_at,created_by,params_after,n_obs,error_before_min,error_after_min,applied,frozen,note').order('id'),
      sb.from('app_parameters').select('key,value').eq('key', 'ETA_CALIBRATION_FROZEN').maybeSingle(),
      sb.from('app_users').select('id,email,full_name,first_name,last_name,phone,role,active,org_id'),
    ]);
    const err = p.error ?? o.error ?? v.error;
    if (err) { setMsg(err.message); }
    setDb({
      params: (p.data ?? []) as Param[],
      obs: (o.data ?? []) as Obs[],
      vers: (v.data ?? []) as Ver[],
      frozen: Number((f.data as { value?: number | string } | null)?.value ?? 0) === 1,
    });
    setPeople((u.data ?? []) as PersonDb[]);
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  const byId = useMemo(() => new Map(people.map((x) => [x.id, x])), [people]);
  const data = useMemo(() => (db ? calibFromDb(locale, db.params, db.obs, db.vers, loads, (id) => {
    const x = id ? byId.get(id) : undefined;
    return x ? personName(x) : t(locale, 'p3l_h_auto');
  }) : null), [db, loads, byId, locale]);

  const approve = useCallback(async (id: string) => {
    const sb = await getSupabase();
    const { error } = await sb.rpc('apply_eta_calibration_version', { p_version: Number(id) });
    if (error) { setMsg(tp(locale, 'p3l_err', { err: error.message })); return { ok: false }; }
    announceOptionsChanged();
    await refresh();
    /* nowa wersja przychodzi z bazy po odświeżeniu (`approved={null}` niżej — ekran nie dopisuje jej drugi raz) */
    return { ok: true, version: { id, no: 0, at: new Date().toISOString(), by: '', what: '' } };
  }, [locale, refresh]);

  const freeze = (next: boolean) => {
    if (readOnly) return;
    void (async () => {
      const sb = await getSupabase();
      const { error } = await sb.rpc('admin_set_eta_calibration_frozen', { p_frozen: next });
      setMsg(error ? tp(locale, 'p3l_err', { err: error.message }) : null);
      await refresh();
    })();
  };

  if (!data || !db) return <div className="note" role="status">{msg ?? t(locale, 'p3l_loading')}</div>;
  const pending = !data.proposal && data.segments.some((s) => s.verdict === 'propose');
  return (
    <div data-panel="eta-calibration" data-live="calib">
      {msg ? <div className="note ox-alert" role="status">{msg}</div> : null}
      <EtaCalibScreen
        locale={locale}
        data={data}
        readOnly={readOnly}
        onApprove={readOnly ? null : approve}
        approved={null}
        frozen={db.frozen}
        onFreeze={readOnly ? undefined : freeze}
        note={`${t(locale, 'p3l_cal_note')}${pending ? ` ${t(locale, 'p3l_cal_no_prop')}` : ''}`}
      />
    </div>
  );
}
