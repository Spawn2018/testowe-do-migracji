/**
 * DEC-6 — stan systemu: kopie, integracje, ostatni kontakt bramki SMS (I-3).
 * SharePoint „Synchronizuj” / wymuszenie kopii — po II-10 / RPC admin.
 */
import { useCallback, useEffect, useState } from 'react';
import { getSupabase } from './client';
import { useTowerStore } from '../store/useTowerStore';
import { t, tp } from '../i18n/messages';
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

export default function SystemStatusPanel() {
  const locale = useTowerStore((s) => s.locale);
  const [backups, setBackups] = useState<BackupRow[]>([]);
  const [integs, setIntegs] = useState<IntegRow[]>([]);
  const [smsDevices, setSmsDevices] = useState<SmsDeviceRow[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [mailBudget, setMailBudget] = useState<{ immediate_n: number; digest_n: number; suppressed_n: number; level: string; suppressed_to?: { recipient: string; n: number }[] | null } | null>(null);

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

    const i = await sb
      .from('integration_runs')
      .select('id,job,ok,ran_at')
      .order('ran_at', { ascending: false })
      .limit(12);
    if (i.error) setIntegs([]);
    else setIntegs((i.data ?? []) as IntegRow[]);

    const s = await sb
      .from('sms_devices')
      .select('id,label,last_seen_at,revoked_at,paused')
      .is('revoked_at', null)
      .order('last_seen_at', { ascending: false, nullsFirst: false });
    if (s.error) setSmsDevices([]);
    else setSmsDevices((s.data ?? []) as SmsDeviceRow[]);

    const e = await sb.rpc('email_budget_status');
    if (e.error || e.data == null) setMailBudget(null);
    else setMailBudget(e.data as { immediate_n: number; digest_n: number; suppressed_n: number; level: string; suppressed_to?: { recipient: string; n: number }[] | null });
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const fmt = (iso: string | null) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString(locale === 'sv' ? 'sv-SE' : locale === 'en' ? 'en-GB' : 'pl-PL');
    } catch {
      return iso;
    }
  };

  const smsSilent = (seen: string | null) => {
    if (!seen) return true;
    return Date.now() - new Date(seen).getTime() > SILENT_MS;
  };

  return (
    <div data-panel="system-status">
      {msg ? <div className="note">{msg}</div> : null}
      <h4 className="sec">{t(locale, 'opt_acc_sys_gateway')}</h4>
      {smsDevices.length === 0 ? (
        <div className="muted">{t(locale, 'opt_acc_gateway_none')}</div>
      ) : (
        <div className="settings-list">
          {smsDevices.map((d) => {
            const silent = smsSilent(d.last_seen_at);
            return (
              <div className="settings-row" key={d.id} data-sms-silent={silent ? '1' : '0'}>
                <div>
                  <b>{d.label}{d.paused ? ` · ${t(locale, 'i3_device_paused')}` : ''}</b>
                  <span>
                    {tp(locale, 'opt_acc_gateway_seen', { d: fmt(d.last_seen_at) })}
                    {silent ? ` · ${t(locale, 'opt_acc_gateway_risk')}` : ''}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {mailBudget ? (
        <div className="note" data-email-budget={mailBudget.level} style={{ marginTop: 14 }}>
          {tp(locale, 'opt_acc_email_budget', {
            n: String(mailBudget.immediate_n),
            d: String(mailBudget.digest_n),
            s: String(mailBudget.suppressed_n),
          })}
          {mailBudget.level === 'warn' ? ` ${t(locale, 'opt_acc_email_warn')}` : ''}
          {mailBudget.level === 'critical_only' ? ` ${t(locale, 'opt_acc_email_crit')}` : ''}
          {mailBudget.suppressed_n > 0
            ? ` ${tp(locale, 'opt_acc_email_held', {
                s: String(mailBudget.suppressed_n),
                who: (mailBudget.suppressed_to ?? []).map((x) => `${x.recipient} (${x.n})`).join(', ') || '—',
              })}`
            : ''}
        </div>
      ) : null}
      <h4 className="sec" style={{ marginTop: 14 }}>{t(locale, 'opt_acc_sys_backup')}</h4>
      {backups.length === 0 ? (
        <div className="muted">{t(locale, 'opt_acc_sys_none')}</div>
      ) : (
        <div className="settings-list">
          {backups.map((r) => (
            <div className="settings-row" key={r.id}>
              <div>
                <b>#{r.id} · {r.status}</b>
                <span>{fmt(r.started_at)} → {fmt(r.finished_at)}{r.error ? ` · ${r.error.slice(0, 80)}` : ''}</span>
              </div>
            </div>
          ))}
        </div>
      )}
      <h4 className="sec" style={{ marginTop: 14 }}>{t(locale, 'opt_acc_sys_integ')}</h4>
      {integs.length === 0 ? (
        <div className="muted">{t(locale, 'opt_acc_sys_none')}</div>
      ) : (
        <div className="settings-list">
          {integs.map((r) => (
            <div className="settings-row" key={r.id}>
              <div>
                <b>{r.job} · {r.ok ? 'OK' : 'ERR'}</b>
                <span>{fmt(r.ran_at)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="note option-note">{t(locale, 'opt_acc_sys_note')}</div>
      <button type="button" className="chipbtn" onClick={() => void refresh()}>{t(locale, 'opt_acc_sys_refresh')}</button>
    </div>
  );
}
