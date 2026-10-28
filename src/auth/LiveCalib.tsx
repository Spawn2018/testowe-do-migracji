/**
 * Opcje › Zasady transportu › Kalibracja ETA — produkcja w wyglądzie z demo (E15 pkt 7; `EtaCalibScreen`).
 * Odczyt: czasy odcinków `eta_segment_params`, pomiary dostaw `eta_segment_observations`, wersje `eta_calibration_versions`
 * (zatwierdzone = `applied`; propozycja = najnowsza niezastosowana i niezamrożona), zamrożenie `app_parameters.ETA_CALIBRATION_FROZEN`.
 * Zapis: `apply_eta_calibration_version(p_version)` i `admin_set_eta_calibration_frozen(p_frozen)` — tylko Administrator HHL.
 * W-604 (0320): wszystkie wersje ze stanem (zastosowana / cofnięta / odrzucona / zastąpiona / oczekuje), numer = id wersji
 * (ten sam co w dzwonku „Kalibracja ETA zastosowana automatycznie”); „Cofnij” → `eta_calibration_undo(p_version)` — tylko
 * Administrator HHL, także przy zamrożeniu. Błędy funkcji po polsku z kodu (`calibErrorKey`).
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
import { calibErrorKey, calibVersionStatus, undoableVersionId, type CalibVersionDb } from '../lib/etaCalibAuto';
import type { Load, Locale } from '../types';
import { announceOptionsChanged, errText, personName, useBusy, type PersonDb } from './liveOpts';

type Param = { code: string; label: string; hours: number | string };
type Obs = { id: number; load_id: string; corridor: string; hours_observed: number | string | null; exclude_reason: string | null; observed_at: string };
type Hours = Record<string, { hours?: number | string; spread_pct?: number | string | null }>;
type Ver = {
  id: number; created_at: string; created_by: string | null; params_after: Hours | null; params_before?: Hours | null;
  n_obs: number | null; error_before_min: number | string | null; error_after_min: number | string | null;
  applied: boolean; frozen: boolean | null; note: string | null; undone_at?: string | null; rejected_at?: string | null;
};
/** Dopiski bazy w `note` (0320) — nie pokazujemy ich jako opisu wersji. */
const MACHINE_NOTE = /propozycja ciągła|auto-applied|\bundone\b|\brejected\b|\bsuperseded\b/i;

/** Stare nazwy korytarzy pomiaru (sprzed 0320) → kod czasu (`eta_segment_params`). */
const CORRIDOR_SEG: Readonly<Record<string, string>> = { SE_E4: 'SE_ROAD' };
/**
 * Odcinek pomiaru → kod czasu. Od 0320 `corridor` to już kod odcinka (PL_ROAD_GDY, SE_ROAD_KAA, PORT_CHECKIN…);
 * mapujemy tylko stare nazwy — inaczej pomiary tras Gdynia/Karlskrona nie trafiały do swoich odcinków (#620 uwaga).
 */
export const segOfCorridor = (corridor: string): string => CORRIDOR_SEG[corridor] ?? corridor;
/** Kolumna w tabeli pomiarów: droga PL, odprawa w porcie albo droga SE (rejs i przerwy nie są tu pokazywane). */
export function obsColumn(seg: string): 'pl' | 'port' | 'se' | null {
  if (seg === 'PL_ROAD' || seg.startsWith('PL_ROAD_')) return 'pl';
  if (seg === 'PORT_CHECKIN' || seg.startsWith('PORT_CHECKIN_')) return 'port';
  if (seg === 'SE_ROAD' || seg.startsWith('SE_ROAD_')) return 'se';
  return null;
}
/** Bez kalibracji (rozkład armatora, przepisy UE) i parametry, które nie są odcinkiem trasy. */
const FIXED_NOTE: Record<string, string> = { CROSSING_DEFAULT: 'p3l_cal_fixed_crossing', SE_DAILY_REST: 'p3l_cal_fixed_rest' };
const NOT_SEGMENT = new Set(['GPS_FRESH_MIN']);

const minOf = (h: number | string | null | undefined) => (h == null || h === '' ? null : Math.round(Number(h) * 60));

export function calibFromDb(locale: Locale, params: readonly Param[], obs: readonly Obs[], vers: readonly Ver[], loads: readonly Load[], nameOf: (id: string | null) => string, frozen = false): EtaCalibration {
  const code = (id: string) => loads.find((l) => l.id === id)?.code ?? id.slice(0, 8);
  const observations: CalibObservation[] = obs.map((o) => {
    const col = obsColumn(segOfCorridor(o.corridor));
    return {
      id: `obs-${o.id}`,
      loadId: o.load_id,
      code: code(o.load_id),
      arrivedAt: o.observed_at,
      err24: null, err6: null, err1: null,
      plMin: col === 'pl' ? minOf(o.hours_observed) : null,
      portMin: col === 'port' ? minOf(o.hours_observed) : null,
      seMin: col === 'se' ? minOf(o.hours_observed) : null,
      breaksMin: null,
      rest: null,
      skipped: o.exclude_reason,
    };
  });
  /* propozycja: najnowsza niezastosowana, niezamrożona, nie cofnięta, nie odrzucona i nie zastąpiona (0320) */
  const proposalVer = [...vers]
    .filter((v) => !v.applied && !v.frozen && !v.undone_at && !v.rejected_at && !/superseded/i.test(v.note ?? ''))
    .sort((a, b) => b.id - a.id)[0] ?? null;
  const segments: CalibSegment[] = params.filter((p) => !NOT_SEGMENT.has(p.code)).map((p) => {
    const cur = minOf(p.hours) ?? 0;
    if (FIXED_NOTE[p.code]) return fixed(p.code, p.label, cur, t(locale, FIXED_NOTE[p.code]));
    const values = obs
      .filter((o) => !o.exclude_reason && segOfCorridor(o.corridor) === p.code && o.hours_observed != null)
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
  const undoId = undoableVersionId(vers as readonly CalibVersionDb[]);
  const versions: CalibVersion[] = [...vers].sort((a, b) => b.id - a.id).map((v) => {
    const list = Object.entries(v.params_after ?? {}).map(([k, x]) => `${params.find((p) => p.code === k)?.label ?? k} ${etaDuration(minOf(x.hours) ?? 0)}`).join(', ');
    const human = v.note?.trim() && !MACHINE_NOTE.test(v.note) ? v.note.trim() : '';
    return {
      id: String(v.id),
      no: v.id,
      at: v.created_at,
      by: nameOf(v.created_by),
      what: human || (list ? tp(locale, 'p3l_cal_ver_what', { list }) : v.note?.trim() ?? ''),
      current: v.id === undoId,
      status: calibVersionStatus(v as CalibVersionDb, frozen),
      undoable: v.id === undoId,
    };
  });
  return {
    needed: CALIB_NEEDED,
    observations,
    segments,
    versions,
    proposal: proposalVer ? {
      id: String(proposalVer.id),
      /* F7 r1 Ś1: zmiana > 15 % — rozstrzyga decyzja w Ryzykach (zatwierdzenie z ekranu zostawiłoby ją otwartą) */
      awaitsDecision: calibVersionStatus(proposalVer as CalibVersionDb, frozen) === 'pending_decision',
      at: proposalVer.created_at,
      errorBeforeMin: Math.round(Number(proposalVer.error_before_min ?? 0)),
      errorAfterMin: Math.round(Number(proposalVer.error_after_min ?? 0)),
    } : null,
  };
}

/** Komunikat błędu funkcji kalibracji: kod bazy → zdanie po polsku, inaczej ogólny „Nie udało się: …”. */
export function calibErrText(locale: Locale, e: unknown): string {
  const key = calibErrorKey(e as { code?: string; message?: string } | null);
  return key ? t(locale, key) : errText(locale, e);
}

export default function LiveCalib({ readOnly = false, highlight = null }: { readOnly?: boolean; highlight?: string | null }) {
  const locale = useTowerStore((s) => s.locale);
  const loads = useTowerStore((s) => s.loads);
  const [db, setDb] = useState<{ params: Param[]; obs: Obs[]; vers: Ver[]; frozen: boolean } | null>(null);
  const [people, setPeople] = useState<PersonDb[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const { busy, guard } = useBusy((e) => setMsg(calibErrText(locale, e)));

  const refresh = useCallback(async () => {
    try {
    const sb = await getSupabase();
    const [p, o, v, f, u] = await Promise.all([
      sb.from('eta_segment_params').select('code,label,hours').order('code'),
      sb.from('eta_segment_observations').select('id,load_id,corridor,hours_observed,exclude_reason,observed_at').order('observed_at'),
      sb.from('eta_calibration_versions').select('id,created_at,created_by,params_before,params_after,n_obs,error_before_min,error_after_min,applied,frozen,note,undone_at,rejected_at').order('id'),
      sb.from('app_parameters').select('key,value').eq('key', 'ETA_CALIBRATION_FROZEN').maybeSingle(),
      sb.from('app_users').select('id,email,full_name,first_name,last_name,phone,role,active,org_id'),
    ]);
    const err = p.error ?? o.error ?? v.error;
    if (err) { setMsg(errText(locale, err)); }
    setDb({
      params: (p.data ?? []) as Param[],
      obs: (o.data ?? []) as Obs[],
      vers: (v.data ?? []) as Ver[],
      frozen: Number((f.data as { value?: number | string } | null)?.value ?? 0) === 1,
    });
    setPeople((u.data ?? []) as PersonDb[]);
    } catch (e) {
      setMsg(errText(locale, e));
      setDb((cur) => cur ?? { params: [], obs: [], vers: [], frozen: false });
    }
  }, [locale]);
  useEffect(() => { void refresh(); }, [refresh]);

  const byId = useMemo(() => new Map(people.map((x) => [x.id, x])), [people]);
  const data = useMemo(() => (db ? calibFromDb(locale, db.params, db.obs, db.vers, loads, (id) => {
    const x = id ? byId.get(id) : undefined;
    return x ? personName(x) : t(locale, 'p3l_h_auto');
  }, db.frozen) : null), [db, loads, byId, locale]);

  const approve = useCallback(async (id: string) => {
    const sb = await getSupabase();
    const { error } = await sb.rpc('apply_eta_calibration_version', { p_version: Number(id) });
    if (error) {
      setMsg(calibErrText(locale, error));
      /* wersja już nieaktualna (nowsza, cofnięta, usunięta) — lista z bazy */
      if (calibErrorKey(error)) await refresh();
      return { ok: false };
    }
    setMsg(null);
    announceOptionsChanged();
    await refresh();
    /* nowa wersja przychodzi z bazy po odświeżeniu (`approved={null}` niżej — ekran nie dopisuje jej drugi raz) */
    return { ok: true, version: { id, no: 0, at: new Date().toISOString(), by: '', what: '' } };
  }, [locale, refresh]);

  const undo = useCallback(async (id: string): Promise<{ ok: boolean; error?: string | null }> => {
    const sb = await getSupabase();
    const { error } = await sb.rpc('eta_calibration_undo', { p_version: Number(id) });
    if (error) {
      if (calibErrorKey(error)) await refresh();
      return { ok: false, error: calibErrText(locale, error) };
    }
    setMsg(null);
    announceOptionsChanged();
    await refresh();
    return { ok: true };
  }, [locale, refresh]);

  const freeze = (next: boolean) => {
    if (readOnly) return;
    void guard(async () => {
      const sb = await getSupabase();
      const { error } = await sb.rpc('admin_set_eta_calibration_frozen', { p_frozen: next });
      setMsg(error ? calibErrText(locale, error) : null);
      if (!error) announceOptionsChanged();
      await refresh();
    });
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
        onFreeze={readOnly || busy ? undefined : freeze}
        note={`${t(locale, 'p3l_cal_note')}${pending ? ` ${t(locale, 'p3l_cal_no_prop')}` : ''}`}
        onUndo={readOnly ? null : undo}
        highlight={highlight}
      />
    </div>
  );
}
