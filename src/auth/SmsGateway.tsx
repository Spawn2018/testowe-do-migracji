import { useCallback, useEffect, useState } from 'react';
import { getSupabase } from './client';
import { authErrorPl } from './config';
import { useTowerStore } from '../store/useTowerStore';
import { t, tp } from '../i18n/messages';
import './auth.css';

/**
 * I-3 — bramka SMS dla HHL (0067/0068): urządzenia (wydanie tokenu raz, pauza, odwołanie), numery testowe,
 * SMS testowy, ostatnie SMS z kolejki (bez treści z linkiem — tylko rodzaj, status i 3 ostatnie cyfry).
 * Przed R-2 (flaga EXTERNAL_MESSAGING) telefon dostaje wyłącznie SMS testowe na numery z listy.
 */
interface Device { id: string; label: string; created_at: string; revoked_at: string | null; paused: boolean; last_seen_at: string | null; day_sent: number; day_limit: number }
interface Sms { id: string; kind: string; status: string; to_e164: string; created_at: string; fallback_at: string | null; error: string | null }
interface TestNo { to_e164: string; label: string }

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw' }) : '—');

export default function SmsGateway() {
  const locale = useTowerStore((s) => s.locale);
  const [devices, setDevices] = useState<Device[]>([]);
  const [sms, setSms] = useState<Sms[]>([]);
  const [nums, setNums] = useState<TestNo[]>([]);
  const [ext, setExt] = useState<boolean | null>(null);
  const [label, setLabel] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [num, setNum] = useState('');
  const [numLabel, setNumLabel] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const sb = await getSupabase();
    const [d, o, n, f] = await Promise.all([
      sb.from('sms_devices').select('id, label, created_at, revoked_at, paused, last_seen_at, day_sent, day_limit').order('created_at', { ascending: false }),
      sb.from('sms_outbox').select('id, kind, status, to_e164, created_at, fallback_at, error').order('created_at', { ascending: false }).limit(20),
      sb.from('sms_test_numbers').select('to_e164, label').order('created_at'),
      sb.rpc('sms_external_messaging_state'),
    ]);
    setDevices((d.data ?? []) as Device[]);
    setSms((o.data ?? []) as Sms[]);
    setNums((n.data ?? []) as TestNo[]);
    setExt(typeof f.data === 'boolean' ? f.data : null);
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  const call = async (fn: string, args: Record<string, unknown>, ok: string) => {
    setBusy(true); setMsg(null);
    const sb = await getSupabase();
    const { data, error } = await sb.rpc(fn, args);
    setBusy(false);
    setMsg(error ? { ok: false, text: authErrorPl(error.message) } : { ok: true, text: ok });
    if (!error) await refresh();
    return error ? null : (data as unknown);
  };

  return (
    <section className="panel option-panel option-wide" data-sms-gateway>
      <header className="panel-hd"><h2>{t(locale, 'i3_h')}</h2>
        <span className={`pill ${ext ? 'p-amber' : 'p-go'}`} data-sms-external={ext ? 'on' : 'off'}>{t(locale, ext ? 'i3_ext_on' : 'i3_ext_off')}</span>
      </header>
      {msg && <div className={`auth-msg ${msg.ok ? 'ok' : 'err'} auth-admin-row`} role="status">{msg.text}</div>}
      <div className="panel-bd">
        <div className="note option-note">{t(locale, 'i3_note')}</div>
        <div className="note option-note">{t(locale, 'i3_apk_note')}</div>

        <h4 className="sec">{t(locale, 'i3_devices_h')}</h4>
        <form className="baf-form" onSubmit={async (e) => { e.preventDefault(); const tok = await call('sms_issue_device', { p_label: label }, t(locale, 'i3_device_issued')); if (tok) { setToken(String(tok)); setLabel(''); } }}>
          <label>{t(locale, 'i3_device_label')}<input className="input" required minLength={2} value={label} onChange={(e) => setLabel(e.target.value)} /></label>
          <button className="btn" type="submit" disabled={busy}>{t(locale, 'i3_device_issue')}</button>
        </form>
        {token && <div className="banner" data-sms-token style={{ margin: '8px 0', wordBreak: 'break-all' }}>{t(locale, 'i3_token_once')} <span className="mono">{token}</span></div>}
        <div className="panel-bd flush" data-sms="devices">
          {devices.length === 0 ? <div className="auth-admin-row">{t(locale, 'i3_devices_none')}</div> : devices.map((d) => (
            <div className={`auth-admin-row${d.revoked_at ? ' inactive' : ''}`} key={d.id} data-sms-device={d.label}>
              <span className="grow"><b>{d.label}</b> · {tp(locale, 'i3_device_seen', { d: when(d.last_seen_at) })} · {tp(locale, 'i3_device_today', { n: String(d.day_sent), m: String(d.day_limit) })}
                {d.revoked_at ? ` · ${t(locale, 'i3_device_revoked')}` : d.paused ? ` · ${t(locale, 'i3_device_paused')}` : ''}</span>
              {!d.revoked_at && <>
                <button className="chipbtn" type="button" disabled={busy} onClick={() => call('sms_set_paused', { p_id: d.id, p_paused: !d.paused }, t(locale, d.paused ? 'i3_resumed' : 'i3_paused'))}>{t(locale, d.paused ? 'i3_resume' : 'i3_pause')}</button>
                <button className="chipbtn" type="button" disabled={busy} onClick={() => call('sms_revoke_device', { p_id: d.id }, t(locale, 'i3_device_revoked'))}>{t(locale, 'i3_revoke')}</button>
              </>}
            </div>
          ))}
        </div>

        <h4 className="sec">{t(locale, 'i3_test_h')}</h4>
        <form className="baf-form" onSubmit={async (e) => { e.preventDefault(); if (await call('sms_add_test_number', { p_to: num.trim(), p_label: numLabel }, t(locale, 'i3_test_added')) !== null) { setNum(''); setNumLabel(''); } }}>
          <label>{t(locale, 'i3_test_number')}<input className="input" required value={num} onChange={(e) => setNum(e.target.value)} /></label>
          <label>{t(locale, 'i3_test_label')}<input className="input" value={numLabel} onChange={(e) => setNumLabel(e.target.value)} /></label>
          <button className="btn" type="submit" disabled={busy}>{t(locale, 'i3_test_add')}</button>
        </form>
        <div className="panel-bd flush" data-sms="test-numbers">
          {nums.map((n) => (
            <div className="auth-admin-row" key={n.to_e164}><span className="grow"><b>{n.label}</b> · …{n.to_e164.slice(-3)}</span>
              <button className="chipbtn" type="button" disabled={busy} onClick={() => call('sms_send_test', { p_to: n.to_e164 }, t(locale, 'i3_test_sent'))}>{t(locale, 'i3_test_send')}</button></div>
          ))}
        </div>

        <h4 className="sec">{t(locale, 'i3_queue_h')}</h4>
        <div className="panel-bd flush" data-sms="queue">
          {sms.length === 0 ? <div className="auth-admin-row">{t(locale, 'i3_queue_none')}</div> : sms.map((o) => (
            <div className="auth-admin-row" key={o.id} data-sms-row={o.kind}><span className="grow">{when(o.created_at)} · <b>{o.kind}</b> · {o.status} · …{o.to_e164.slice(-3)}{o.fallback_at ? ` · ${t(locale, 'i3_fallback')}` : ''}{o.error ? ` · ${o.error}` : ''}</span></div>
          ))}
        </div>
      </div>
    </section>
  );
}
