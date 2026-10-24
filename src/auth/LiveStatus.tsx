/**
 * Opcje › System › Stan systemu — produkcja w wyglądzie z audytu (E23, `img/e23-after`): lista „Źródła danych”
 * (`StatusScreen`, ten sam ekran co w demo). Dane z tych samych tabel co dzisiejszy panel (`SystemStatusPanel`):
 * `integration_runs` (ostatni przebieg i seria błędów każdego zadania), `sms_devices` (ostatni kontakt bramki),
 * `backup_runs` (kopia). Progi „Nie działa” — stałe z E23 (w bazie nie ma tabeli progów źródeł).
 * Dzisiejszy panel (limity usług, kopie, przebiegi zadań, „Odśwież”) zostaje pod listą — żadna funkcja nie znika.
 */
import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { getSupabase } from './client';
import { useTowerStore } from '../store/useTowerStore';
import { t, tp } from '../i18n/messages';
import { getNowIso } from '../lib/frozenNow';
import { lazyRetry } from '../lib/lazyRetry';
import { StatusScreen } from '../components/options/StatusScreen';
import { appErrorsFromDb, perfFromDb, type AppErrors, type OtherJob, type Perf, type SourceRow, type SourceState } from '../lib/sysSource';
import type { Locale } from '../types';

const SystemStatusPanel = lazy(lazyRetry(() => import('./SystemStatusPanel')));

/** `disabled` — #446: zadanie przebiegło przy wyłączonej fladze (np. TELM_RIO_LINKS), `integration_runs.result.disabled`. */
export type RunRow = { job: string; ok: boolean; ran_at: string; disabled?: boolean | null };
export type DeviceRow = { label: string; last_seen_at: string | null; revoked_at: string | null; paused: boolean };
export type BackupRow = { status: string; started_at: string };

/** Źródło E23 → zadania w `integration_runs` i próg świeżości w minutach (null — bez harmonogramu: stary wynik = „Brak pomiaru”). */
type SourceDef = { id: string; jobs: string[]; maxMin: number | null; check: boolean };
export const LIVE_SOURCES: readonly SourceDef[] = [
  { id: 'telematics', jobs: ['emtrack-web'], maxMin: 10, check: false },
  /* #437 E44: pozycje z linku RIO (podwykonawcy SCX), cron tower-rio-links co 2 min */
  { id: 'telematics-rio', jobs: ['rio-links'], maxMin: 10, check: false },
  { id: 'ferry-pos', jobs: ['ferry-ais', 'ferry-ais-listen'], maxMin: 15, check: false },
  { id: 'ferry-status', jobs: ['ferry-status'], maxMin: 30, check: false },
  { id: 'schedule', jobs: ['ferry-schedule'], maxMin: 26 * 60, check: false },
  { id: 'ferry-departures', jobs: ['ferry-departures'], maxMin: 26 * 60, check: false },
  { id: 'road-se', jobs: ['road-se'], maxMin: 45, check: false },
  { id: 'road-pl', jobs: ['road-pl'], maxMin: 45, check: false },
  { id: 'hazards', jobs: ['route-hazards'], maxMin: 3 * 60, check: false },
  { id: 'weather', jobs: ['ferry-weather'], maxMin: 3 * 60, check: false },
  { id: 'fuel', jobs: ['fuel-prices', 'fuel-wob'], maxMin: 26 * 60, check: false },
  { id: 'mail', jobs: ['email-budget'], maxMin: null, check: false },
];
/** Zadania pokazywane w „Pozostałe zadania” (nie zasilają ekranów bezpośrednio). */
export const LIVE_OTHER_JOBS = [
  'send-notifications', 'web-push-send', 'daily-admin-digest', 'doc-retention', 'rodo', 'usage-check',
  'security-advisor-snapshot', 'security-advisor-snapshot-edge',
] as const;
const SMS_MAX_MIN = 15;
/** Ile ostatnich przebiegów każdego zadania czyta ekran. */
export const RUN_LIMIT = 20;
const BACKUP_MAX_MIN = 26 * 60;

/** „10 min”, „3 h”, „8 dni” */
export function limitText(min: number): string {
  if (min >= 2 * 24 * 60 && min % (24 * 60) === 0) return `${min / (24 * 60)} dni`;
  if (min >= 60 && min % 60 === 0) return `${min / 60} h`;
  return `${min} min`;
}

const k = (id: string) => id.replace(/-/g, '_');
const minutes = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / 60_000;

/** Przebiegi jednego źródła od najnowszego; seria błędów od początku listy. */
function runsOf(runs: readonly RunRow[], jobs: readonly string[]): RunRow[] {
  return runs.filter((r) => jobs.includes(r.job)).sort((a, b) => b.ran_at.localeCompare(a.ran_at));
}

function stateOf(rs: readonly RunRow[], maxMin: number | null, nowIso: string): { state: SourceState; lastAt: string | null; since: string | null; why: 'fail' | 'stale' | 'old' | 'off' | null } {
  if (!rs.length) return { state: 'nosource', lastAt: null, since: null, why: null };
  /* F7 #451 D1: przebieg przy wyłączonej fladze (ok, ale bez odczytu) nie jest „danymi z” */
  const lastOk = rs.find((r) => r.ok && r.disabled !== true) ?? null;
  const lastAt = lastOk?.ran_at ?? null;
  /* #446: wyłączone flagą — nie „działa” i nie „nie działa”; od kiedy = pierwszy przebieg serii wyłączonych.
     F7 #451 P1: gdy seria wypełnia całe okno odczytu (RUN_LIMIT), początek jest nieznany — bez „od”.
     Wyłączone zadanie nie przechodzi w „Nie działa” po czasie (świeżość nie jest wtedy sprawdzana). */
  if (rs[0].disabled === true) {
    let i = 0;
    while (i + 1 < rs.length && rs[i + 1].disabled === true) i += 1;
    const whole = i === rs.length - 1 && rs.length >= RUN_LIMIT;
    return { state: 'nomeasure', lastAt, since: whole ? null : rs[i].ran_at, why: 'off' };
  }
  if (!rs[0].ok) {
    let i = 0;
    while (i + 1 < rs.length && !rs[i + 1].ok) i += 1;
    return { state: 'down', lastAt, since: rs[i].ran_at, why: 'fail' };
  }
  const age = minutes(rs[0].ran_at, nowIso);
  if (maxMin == null) return age > 26 * 60 ? { state: 'nomeasure', lastAt, since: rs[0].ran_at, why: 'old' } : { state: 'ok', lastAt, since: null, why: null };
  if (age > maxMin) {
    const since = new Date(Date.parse(rs[0].ran_at) + maxMin * 60_000).toISOString();
    return { state: 'down', lastAt, since, why: 'stale' };
  }
  return { state: 'ok', lastAt, since: null, why: null };
}

/** Wiersze „Źródła danych” z przebiegów zadań, bramki SMS i kopii — czysta funkcja (test). */
export function liveSourceRows(locale: Locale, runs: readonly RunRow[], devices: readonly DeviceRow[], backups: readonly BackupRow[], nowIso: string): SourceRow[] {
  const rows: SourceRow[] = LIVE_SOURCES.map((d) => {
    const s = stateOf(runsOf(runs, d.jobs), d.maxMin, nowIso);
    const why = s.why === 'fail' ? t(locale, 'ol2_src_why_fail')
      : s.why === 'stale' ? tp(locale, 'ol2_src_why_stale', { n: limitText(d.maxMin!) })
        : s.why === 'old' ? t(locale, 'ol2_src_why_old')
          : s.why === 'off' ? t(locale, 'ol2_src_why_off')
            : s.state === 'nosource' ? t(locale, 'ol2_src_why_none') : null;
    return {
      id: d.id, name: t(locale, `ol2_src_${k(d.id)}`), cadence: t(locale, `ol2_src_${k(d.id)}_cad`), feeds: t(locale, `ol2_src_${k(d.id)}_feeds`),
      lastAt: s.lastAt, state: s.state, since: s.since, why, canCheck: d.check,
    };
  });
  /* bramka SMS: ostatni kontakt aktywnego telefonu */
  const live = devices.filter((d) => !d.revoked_at).sort((a, b) => (b.last_seen_at ?? '').localeCompare(a.last_seen_at ?? ''));
  const seen = live[0]?.last_seen_at ?? null;
  const smsState: SourceState = !live.length ? 'nosource' : seen && minutes(seen, nowIso) <= SMS_MAX_MIN ? 'ok' : 'down';
  rows.push({
    id: 'sms', name: t(locale, 'ol2_src_smsgw'), cadence: t(locale, 'ol2_src_smsgw_cad'), feeds: t(locale, 'ol2_src_smsgw_feeds'),
    lastAt: seen, state: smsState, since: smsState === 'down' && seen ? seen : null,
    why: smsState === 'down' ? tp(locale, 'ol2_src_why_stale', { n: limitText(SMS_MAX_MIN) }) : smsState === 'nosource' ? t(locale, 'ol2_src_smsgw_none') : live[0]?.paused ? t(locale, 'i3_device_paused') : null,
    canCheck: false,
  });
  /* kopia zapasowa */
  const b = [...backups].sort((x, y) => y.started_at.localeCompare(x.started_at))[0] ?? null;
  const bState: SourceState = !b ? 'nosource' : b.status === 'ERROR' ? 'down' : b.status !== 'OK' ? 'partial' : minutes(b.started_at, nowIso) > BACKUP_MAX_MIN ? 'down' : 'ok';
  rows.push({
    id: 'backup', name: t(locale, 'ol2_src_backup'), cadence: t(locale, 'ol2_src_backup_cad'), feeds: t(locale, 'ol2_src_backup_feeds'),
    lastAt: b?.started_at ?? null, state: bState, since: bState === 'down' || bState === 'partial' ? b?.started_at ?? null : null,
    why: bState === 'down' ? t(locale, b?.status === 'ERROR' ? 'ol2_src_why_fail' : 'ol2_src_why_backup_old') : bState === 'nosource' ? t(locale, 'ol2_src_why_none') : null,
    canCheck: false,
  });
  return rows;
}

/** „Pozostałe zadania”: ostatni przebieg i stan każdego zadania pomocniczego. */
export function liveOtherJobs(locale: Locale, runs: readonly RunRow[]): OtherJob[] {
  return LIVE_OTHER_JOBS.flatMap((job) => {
    const rs = runsOf(runs, [job]);
    if (!rs.length) return [];
    const key = `b6_job_${job.replace(/-/g, '_')}`;
    const name = t(locale, key) !== key ? t(locale, key) : t(locale, `ol2_job_${job.replace(/-/g, '_')}`);
    return [{ id: job, name, lastAt: rs.find((r) => r.ok)?.ran_at ?? null, state: rs[0].ok ? 'ok' as const : 'down' as const }];
  });
}

const RUN_JOBS = [...new Set([...LIVE_SOURCES.flatMap((s) => s.jobs), ...LIVE_OTHER_JOBS])];

export default function LiveStatus({ admin }: { admin: boolean }) {
  const locale = useTowerStore((s) => s.locale);
  /* „?kopia=1” (link z powiadomienia o kopii): dzisiejszy panel z listą kopii od razu rozwinięty */
  const watchBackup = new URLSearchParams(useLocation().search).get('kopia') === '1';
  const [data, setData] = useState<{ runs: RunRow[]; devices: DeviceRow[]; backups: BackupRow[] } | null>(null);
  /* #422/#508: Wydajność (HHL) i Błędy aplikacji (tylko Administrator HHL) — błąd odczytu nie blokuje Źródeł danych */
  const [perf, setPerf] = useState<Perf>(() => perfFromDb(null));
  const [errors, setErrors] = useState<AppErrors | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const sb = await getSupabase();
      /* ostatnie 20 przebiegów każdego zadania — seria błędów i ostatni udany */
      const per = await Promise.all(RUN_JOBS.map((job) => sb.from('integration_runs').select('job,ok,ran_at,disabled:result->disabled').eq('job', job).order('ran_at', { ascending: false }).limit(RUN_LIMIT)));
      const [d, b] = await Promise.all([
        sb.from('sms_devices').select('label,last_seen_at,revoked_at,paused'),
        sb.from('backup_runs').select('status,started_at').order('started_at', { ascending: false }).limit(1),
      ]);
      const [pr, er] = await Promise.all([
        sb.rpc('perf_results_latest'),
        admin ? sb.rpc('app_errors_recent', { p_days: 7 }) : Promise.resolve({ data: null, error: null }),
      ]);
      setPerf(perfFromDb(pr.error ? null : pr.data));
      setErrors(er.error ? null : appErrorsFromDb(er.data));
      const err = per.find((r) => r.error)?.error ?? d.error ?? b.error ?? null;
      setMsg(err ? err.message : null);
      setData({
        runs: per.flatMap((r) => (r.data ?? []) as RunRow[]),
        devices: (d.data ?? []) as DeviceRow[],
        backups: (b.data ?? []) as BackupRow[],
      });
    } catch (e) {
      /* F7 #415: wyjątek przy odczycie — komunikat zamiast stałego „Wczytywanie…” */
      setMsg(e instanceof Error ? e.message : t(locale, 'ol2_read_fail'));
      setData((x) => x ?? { runs: [], devices: [], backups: [] });
    }
  }, [locale, admin]);
  useEffect(() => { void refresh(); }, [refresh]);

  const nowIso = getNowIso();
  return (
    <div data-panel="live-status">
      {msg ? <div className="note" role="status">{msg}</div> : null}
      {data ? (
        <StatusScreen
          locale={locale}
          nowIso={nowIso}
          admin={admin}
          live={{ rows: liveSourceRows(locale, data.runs, data.devices, data.backups, nowIso), jobs: liveOtherJobs(locale, data.runs), perf, errors }}
        />
      ) : <p className="note" role="status">{t(locale, 'ol2_loading')}</p>}
      <details className="ol2-more" data-live-status-more open={watchBackup || undefined}>
        <summary>{t(locale, 'ol2_status_more')}</summary>
        <Suspense fallback={null}><SystemStatusPanel /></Suspense>
      </details>
    </div>
  );
}
