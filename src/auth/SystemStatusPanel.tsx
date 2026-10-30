/**
 * DEC-6 — stan systemu: kopie, integracje, ostatni kontakt bramki SMS (I-3).
 * SharePoint „Synchronizuj” / wymuszenie kopii — po II-10 / RPC admin.
 */
import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { getSupabase } from './client';
import { useTowerStore } from '../store/useTowerStore';
import { hasKey, t, tp } from '../i18n/messages';
import { deeplWarnText } from '../lib/deeplWarn';
import { fmtDateTime } from '../lib/time';
import './auth.css';

type BackupRow = {
  id: number;
  status: string;
  started_at: string;
  finished_at: string | null;
  error: string | null;
};

type IntegRow = {
  id: number;
  job: string;
  ok: boolean;
  ran_at: string;
};

type SmsDeviceRow = {
  id: string;
  label: string;
  last_seen_at: string | null;
  revoked_at: string | null;
  paused: boolean;
};

const SILENT_MS = 15 * 60 * 1000;

/** Zadania integracji zapisujące integration_runs (ostatni przebieg każdego — także rzadkich, raz na dobę). */
export const KNOWN_JOBS = [
  'send-notifications', 'rio-links', 'safefleet-poll', 'ferry-ais', 'ferry-ais-listen', 'ferry-status', 'ferry-schedule', 'ferry-portnet', 'ferry-departures', 'ferry-weather',
  'road-se', 'road-pl', 'daily-admin-digest', 'email-budget', 'rodo', 'usage-check', 'fuel-wob',
] as const;

type TileState = 'ok' | 'warn' | 'bad' | 'off';

/** B-6d — ostatni przebieg każdego zadania (lista posortowana malejąco po ran_at albo dowolnie). */
export function latestPerJob(rows: readonly IntegRow[]): IntegRow[] {
  const best = new Map<string, IntegRow>();
  for (const r of rows) {
    const cur = best.get(r.job);
    if (!cur || r.ran_at > cur.ran_at) best.set(r.job, r);
  }
  return [...best.values()].sort((a, b) => a.job.localeCompare(b.job));
}

function levelState(level: string | undefined): TileState {
  if (!level || level === 'off') return 'off';
  if (/crit|full|stop|block/i.test(level)) return 'bad';
  if (/warn/i.test(level)) return 'warn';
  return 'ok';
}

function Tile({ state, k, v, d, attrs }: { state: TileState; k: string; v: string; d: string; attrs?: Record<string, string> }) {
  return (
    <div className="sys-tile" data-state={state} {...attrs}>
      <div className="k">{k}</div>
      <div className="v">{v}</div>
      {d ? <div className="d">{d}</div> : null}
    </div>
  );
}

export default function SystemStatusPanel() {
  const locale = useTowerStore((s) => s.locale);
  const location = useLocation();
  const watchBackup = new URLSearchParams(location.search).get('kopia') === '1';
  const [backups, setBackups] = useState<BackupRow[]>([]);
  const [integs, setIntegs] = useState<IntegRow[]>([]);
  const [smsDevices, setSmsDevices] = useState<SmsDeviceRow[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [mailBudget, setMailBudget] = useState<{ immediate_n: number; digest_n: number; suppressed_n: number; level: string; suppressed_to?: { recipient: string; n: number }[] | null } | null>(null);
  const [hereBudget, setHereBudget] = useState<{
    enabled: boolean; requests: number; estimated_usd: number; level: string; budget_usd?: number; pct?: number;
    tiles_requests?: number; tiles_pool?: number; tiles_over_usd?: number; tiles_usd?: number;
    routing_requests?: number; routing_pool?: number; routing_over_usd?: number;
    matching_requests?: number; matching_usd?: number; tiles_open?: boolean;
    services?: { service: string; requests: number; pool: number; over_usd: number; pct_pool: number | null }[];
  } | null>(null);
  const [deepl, setDeepl] = useState<{ characters: number; monthly_limit: number; queued: number; level: string; queued_active?: number | null; oldest_age_min?: number | null } | null>(null);
  const [csp, setCsp] = useState<{ mode: string; until: string; violations_7d: number; hits_7d: number; top: string; level: string } | null>(null);

  const refresh = useCallback(async () => {
    const sb = await getSupabase();
    const b = await sb
      .from('backup_runs')
      .select('id,status,started_at,finished_at,error')
      .order('started_at', { ascending: false })
      .limit(7);
    if (b.error) setMsg(b.error.message);
    else {
      setMsg(null);
      setBackups((b.data ?? []) as BackupRow[]);
    }

    const recent = await sb
      .from('integration_runs')
      .select('id,job,ok,ran_at')
      .order('ran_at', { ascending: false })
      .limit(200);
    const seen = new Set(((recent.data ?? []) as IntegRow[]).map((r) => r.job));
    const rare = await Promise.all(KNOWN_JOBS.filter((j) => !seen.has(j)).map((j) => sb
      .from('integration_runs')
      .select('id,job,ok,ran_at')
      .eq('job', j)
      .order('ran_at', { ascending: false })
      .limit(1)));
    if (recent.error) setIntegs([]);
    else setIntegs([...((recent.data ?? []) as IntegRow[]), ...rare.flatMap((r) => (r.data ?? []) as IntegRow[])]);

    const h = await sb.rpc('here_budget_view');
    if (h.error || !h.data) setHereBudget({ enabled: false, requests: 0, estimated_usd: 0, level: 'off' });
    else setHereBudget(h.data as NonNullable<typeof hereBudget>);

    const s = await sb
      .from('sms_devices')
      .select('id,label,last_seen_at,revoked_at,paused')
      .is('revoked_at', null)
      .order('last_seen_at', { ascending: false, nullsFirst: false });
    if (s.error) setSmsDevices([]);
    else setSmsDevices((s.data ?? []) as SmsDeviceRow[]);

    const d = await sb.rpc('deepl_usage_view');
    if (d.error || !d.data) setDeepl(null);
    else setDeepl(d.data as { characters: number; monthly_limit: number; queued: number; level: string });

    const e = await sb.rpc('email_budget_status');
    if (e.error || e.data == null) setMailBudget(null);
    else setMailBudget(e.data as { immediate_n: number; digest_n: number; suppressed_n: number; level: string; suppressed_to?: { recipient: string; n: number }[] | null });

    const c = await sb.rpc('csp_status_view');
    if (c.error || !c.data) setCsp(null);
    else setCsp(c.data as NonNullable<typeof csp>);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!watchBackup) return;
    const tick = window.setInterval(() => { void refresh(); }, 4000);
    const stop = window.setTimeout(() => window.clearInterval(tick), 180000);
    return () => { window.clearInterval(tick); window.clearTimeout(stop); };
  }, [watchBackup, refresh]);

  useEffect(() => {
    if (!watchBackup) return;
    document.querySelector('[data-backup-list]')?.scrollIntoView({ block: 'start' });
  }, [watchBackup, backups.length]);

  const fmt = (iso: string | null) => {
    if (!iso) return '—';
    try {
      return fmtDateTime(iso);
    } catch {
      return iso;
    }
  };

  const smsSilent = (seen: string | null) => {
    if (!seen) return true;
    return Date.now() - new Date(seen).getTime() > SILENT_MS;
  };

  // B-6d — pulpit: kafelki ze stanem (ok / uwaga / błąd / brak) zamiast list tekstu
  const smsState: TileState = smsDevices.length === 0 ? 'off' : smsDevices.some((d) => !smsSilent(d.last_seen_at)) ? 'ok' : 'bad';
  const lastBackup = backups[0] ?? null;
  const backupState: TileState = !lastBackup ? 'off' : lastBackup.status === 'OK' ? 'ok' : lastBackup.status === 'ERROR' ? 'bad' : 'warn';
  const jobs = latestPerJob(integs);
  const badJobs = jobs.filter((j) => !j.ok);
  const integState: TileState = jobs.length === 0 ? 'off' : badJobs.length ? 'bad' : 'ok';
  const mailState: TileState = !mailBudget ? 'off' : mailBudget.level === 'critical_only' ? 'bad' : mailBudget.level === 'warn' || mailBudget.suppressed_n > 0 ? 'warn' : 'ok';
  const hereState: TileState = !hereBudget || !hereBudget.enabled ? 'off' : levelState(hereBudget.level);
  const deeplState: TileState = !deepl ? 'off' : levelState(deepl.level);
  const cspState: TileState = !csp ? 'off' : csp.level === 'bad' ? 'bad' : csp.level === 'warn' ? 'warn' : 'ok';
  const nf = (n: number | undefined) => Number(n ?? 0).toLocaleString('pl-PL');
  const jobName = (job: string) => {
    const k = `b6_job_${job.replace(/-/g, '_')}`;
    return hasKey(locale, k) ? t(locale, k) : job;
  };

  return (
    <div data-panel="system-status">
      {msg ? <div className="note">{msg}</div> : null}
      <div className="sys-dash" data-sys-dash>
        <Tile state={smsState} k={t(locale, 'b6_sys_gw')} attrs={{ 'data-sms-silent': smsState === 'bad' ? '1' : '0' }}
          v={t(locale, smsState === 'ok' ? 'b6_sys_sms_ok' : smsState === 'bad' ? 'b6_sys_sms_silent' : 'b6_sys_sms_none')}
          d={smsDevices.length ? `${smsDevices[0].label}${smsDevices[0].paused ? ` · ${t(locale, 'i3_device_paused')}` : ''} · ${tp(locale, 'opt_acc_gateway_seen', { d: fmt(smsDevices[0].last_seen_at) })}${smsState === 'bad' ? ` · ${t(locale, 'opt_acc_gateway_risk')}` : ''}` : t(locale, 'opt_acc_gateway_none')} />
        <Tile state={mailState} k={t(locale, 'b6_sys_mail')} attrs={{ 'data-email-budget': mailBudget?.level ?? 'brak' }}
          v={mailBudget ? String(mailBudget.immediate_n + mailBudget.digest_n) : t(locale, 'b6_sys_none')}
          d={mailBudget ? `${tp(locale, 'b6_sys_mail_d', { n: String(mailBudget.immediate_n), d: String(mailBudget.digest_n), s: String(mailBudget.suppressed_n) })}${mailBudget.level === 'warn' ? ` · ${t(locale, 'opt_acc_email_warn')}` : ''}${mailBudget.level === 'critical_only' ? ` · ${t(locale, 'opt_acc_email_crit')}` : ''}` : ''} />
        <Tile state={backupState} k={t(locale, 'b6_sys_backup')}
          v={lastBackup ? (hasKey(locale, `b6_sys_backup_${lastBackup.status}`) ? t(locale, `b6_sys_backup_${lastBackup.status}`) : lastBackup.status) : t(locale, 'b6_sys_none')}
          d={lastBackup ? `${fmt(lastBackup.started_at)}${lastBackup.error ? ` · ${lastBackup.error.slice(0, 80)}` : ''}` : t(locale, 'opt_acc_sys_none')} />
        <Tile state={integState} k={t(locale, 'b6_sys_integ')}
          v={jobs.length ? tp(locale, 'b6_sys_integ_v', { ok: String(jobs.length - badJobs.length), n: String(jobs.length) }) : t(locale, 'b6_sys_none')}
          d={jobs.length ? (badJobs.length ? tp(locale, 'b6_sys_integ_bad', { jobs: badJobs.map((j) => jobName(j.job)).join(', ') }) : t(locale, 'b6_sys_integ_all_ok')) : t(locale, 'opt_acc_sys_none')} />
        <Tile state={hereState} k={t(locale, 'b6_sys_here')} attrs={{ 'data-here-tile': hereBudget?.level ?? 'off', id: 'here' }}
          v={`${nf(hereBudget?.estimated_usd)} / ${nf(hereBudget?.budget_usd ?? 100)} USD`}
          d={tp(locale, 'b6_sys_here_d', {
            tiles: `${nf(hereBudget?.tiles_requests)}/${nf(hereBudget?.tiles_pool)}`,
            routes: `${nf(hereBudget?.routing_requests)}/${nf(hereBudget?.routing_pool)}`,
            match: nf(hereBudget?.matching_requests),
            over: nf(hereBudget?.estimated_usd),
            basemap: hereBudget?.tiles_open ? 'HERE' : 'zapas',
          })} />
        <Tile state={deeplState} k={t(locale, 'b6_sys_deepl')} attrs={{ 'data-deepl-usage': deepl?.level ?? 'brak' }}
          v={nf(deepl?.characters)}
          d={`${tp(locale, 'b6_sys_deepl_d', { limit: nf(deepl?.monthly_limit ?? 1000000), q: String(deepl?.queued_active ?? deepl?.queued ?? 0) })}${deeplWarnText(deepl, locale)}${deepl?.level === 'full' ? ` · ${t(locale, 'pl_deepl_full')}` : ''}`} />
        <Tile state={cspState} k={t(locale, 'b6_sys_csp')} attrs={{ 'data-csp': csp?.level ?? 'off' }}
          v={csp ? String(csp.violations_7d) : t(locale, 'b6_sys_none')}
          d={csp ? tp(locale, 'b6_sys_csp_d', { until: csp.until || '—', hits: String(csp.hits_7d), top: csp.top || '—' }) : ''} />
      </div>
      {mailBudget && mailBudget.suppressed_n > 0 ? (
        <div className="note" style={{ marginTop: 10 }}>
          {tp(locale, 'opt_acc_email_held', { s: String(mailBudget.suppressed_n), who: (mailBudget.suppressed_to ?? []).map((x) => `${x.recipient} (${x.n})`).join(', ') || '—' })}
        </div>
      ) : null}
      <div className="sys-cols">
        <div>
          <h4 className="sec">{t(locale, 'b6_sys_jobs_h')}</h4>
          {jobs.length === 0 ? <div className="muted">{t(locale, 'opt_acc_sys_none')}</div> : (
            <table className="sys-table" data-integ-list>
              <tbody>{jobs.map((j) => (
                <tr key={j.job} data-job={j.job}>
                  <td>{jobName(j.job)}</td>
                  <td><span className={`pill ${j.ok ? 'p-go' : 'p-red'}`}>{t(locale, j.ok ? 'b6_sys_ok' : 'b6_sys_err')}</span></td>
                  <td className="sys-when">{fmt(j.ran_at)}</td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>
        <div>
          <h4 className="sec" data-backup-list>{t(locale, 'b6_sys_backups_h')}</h4>
          {backups.length === 0 ? <div className="muted">{t(locale, 'opt_acc_sys_none')}</div> : (
            <table className="sys-table" data-backup-list>
              <tbody>{backups.map((r) => (
                <tr key={r.id}>
                  <td>#{r.id}</td>
                  <td><span className={`pill ${r.status === 'OK' ? 'p-go' : r.status === 'ERROR' ? 'p-red' : 'p-amber'}`}>{hasKey(locale, `b6_sys_backup_${r.status}`) ? t(locale, `b6_sys_backup_${r.status}`) : r.status}</span></td>
                  <td className="sys-when">{fmt(r.started_at)}{r.error ? ` · ${r.error.slice(0, 80)}` : ''}</td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>
      </div>
      <div className="note option-note">{t(locale, 'opt_acc_sys_note')}</div>
      <button type="button" className="chipbtn" style={{ marginTop: 10 }} onClick={() => void refresh()}>{t(locale, 'opt_acc_sys_refresh')}</button>
    </div>
  );
}
