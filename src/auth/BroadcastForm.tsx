/**
 * DEC-6 — komunikat (baner) dla wybranych firm: treść, termin, HHL/SCX/KSH.
 */
import { useCallback, useEffect, useState } from 'react';
import { getSupabase } from './client';
import { useTowerStore } from '../store/useTowerStore';
import { t } from '../i18n/messages';
import './auth.css';

type Active = {
  id: number;
  body: string;
  expires_at: string;
  for_forwarder: boolean;
  for_carrier: boolean;
  for_client: boolean;
};

function defaultExpiryIso(): string {
  const d = new Date(Date.now() + 24 * 3600 * 1000);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export default function BroadcastForm() {
  const locale = useTowerStore((s) => s.locale);
  const [body, setBody] = useState('');
  const [expires, setExpires] = useState(defaultExpiryIso);
  const [fwd, setFwd] = useState(true);
  const [car, setCar] = useState(true);
  const [cli, setCli] = useState(true);
  const [active, setActive] = useState<Active | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const sb = await getSupabase();
    const q = await sb
      .from('system_broadcast')
      .select('id,body,expires_at,for_forwarder,for_carrier,for_client,cleared_at')
      .is('cleared_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (q.error) {
      setMsg(q.error.message);
      setActive(null);
      return;
    }
    setMsg(null);
    setActive(q.data as Active | null);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function publish() {
    setBusy(true);
    const sb = await getSupabase();
    const expiresAt = new Date(expires).toISOString();
    const { error } = await sb.rpc('admin_broadcast_set', {
      p_body: body,
      p_expires_at: expiresAt,
      p_forwarder: fwd,
      p_carrier: car,
      p_client: cli,
    });
    setBusy(false);
    if (error) {
      setMsg(error.message);
      return;
    }
    setBody('');
    setMsg(t(locale, 'opt_acc_bcast_saved'));
    await refresh();
  }

  async function clear() {
    setBusy(true);
    const sb = await getSupabase();
    const { error } = await sb.rpc('admin_broadcast_clear');
    setBusy(false);
    if (error) {
      setMsg(error.message);
      return;
    }
    setMsg(t(locale, 'opt_acc_bcast_cleared'));
    await refresh();
  }

  return (
    <div data-panel="broadcast">
      {msg ? <div className="note">{msg}</div> : null}
      {active ? (
        <div className="banner" data-bcast-active style={{ margin: '0 0 10px' }}>
          <div>
            <b>{t(locale, 'opt_acc_bcast_active')}</b> {active.body}
            <div className="note">
              {new Date(active.expires_at).toLocaleString(
                locale === 'sv' ? 'sv-SE' : locale === 'en' ? 'en-GB' : 'pl-PL',
              )}
              {' · '}
              {[
                active.for_forwarder ? 'HHL' : null,
                active.for_carrier ? 'SCX' : null,
                active.for_client ? 'KSH' : null,
              ]
                .filter(Boolean)
                .join(', ')}
            </div>
          </div>
        </div>
      ) : (
        <div className="note option-note">{t(locale, 'opt_acc_bcast_none')}</div>
      )}
      <label className="auth-form" style={{ gap: 8 }}>
        <span>{t(locale, 'opt_acc_bcast_body')}</span>
        <textarea
          className="input"
          rows={3}
          maxLength={500}
          value={body}
          disabled={busy}
          onChange={(e) => setBody(e.target.value)}
        />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8, fontSize: 12.5 }}>
        <span>{t(locale, 'opt_acc_bcast_expires')}</span>
        <input
          className="input"
          type="datetime-local"
          value={expires}
          disabled={busy}
          onChange={(e) => setExpires(e.target.value)}
        />
      </label>
      <div className="pref-list" style={{ marginTop: 10 }}>
        <label className="switchline">
          <input type="checkbox" checked={fwd} disabled={busy} onChange={(e) => setFwd(e.target.checked)} />
          <span>HHL</span>
        </label>
        <label className="switchline">
          <input type="checkbox" checked={car} disabled={busy} onChange={(e) => setCar(e.target.checked)} />
          <span>SCX</span>
        </label>
        <label className="switchline">
          <input type="checkbox" checked={cli} disabled={busy} onChange={(e) => setCli(e.target.checked)} />
          <span>KSH</span>
        </label>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
        <button type="button" className="chipbtn" disabled={busy || !body.trim()} onClick={() => void publish()}>
          {t(locale, 'opt_acc_bcast_publish')}
        </button>
        <button type="button" className="chipbtn" disabled={busy || !active} onClick={() => void clear()}>
          {t(locale, 'opt_acc_bcast_clear')}
        </button>
      </div>
    </div>
  );
}
