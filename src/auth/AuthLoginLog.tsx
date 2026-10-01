/**
 * DEC-6 — dziennik logowań Auth (Supabase audit_log_entries) dla HHL_ADMIN.
 */
import { useCallback, useEffect, useState } from 'react';
import { getSupabase } from './client';
import { useTowerStore } from '../store/useTowerStore';
import { t } from '../i18n/messages';
import './auth.css';

type Row = {
  created_at: string;
  ip_address: string | null;
  action: string;
  actor: string;
  log_type: string;
  email: string;
};

export default function AuthLoginLog() {
  const locale = useTowerStore((s) => s.locale);
  const [rows, setRows] = useState<Row[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setBusy(true);
    const sb = await getSupabase();
    const { data, error } = await sb.rpc('admin_auth_login_log', { p_limit: 50 });
    setBusy(false);
    if (error) {
      setMsg(error.message);
      setRows([]);
      return;
    }
    setMsg(null);
    setRows((data ?? []) as Row[]);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const fmt = (iso: string) => {
    try {
      return new Date(iso).toLocaleString(locale === 'sv' ? 'sv-SE' : locale === 'en' ? 'en-GB' : 'pl-PL');
    } catch {
      return iso;
    }
  };

  const outcome = (r: Row) => {
    const a = `${r.action} ${r.log_type}`.toLowerCase();
    if (/fail|error|unauthor/.test(a)) return t(locale, 'opt_acc_authlog_fail');
    if (/login|token|user_signed|password/.test(a)) return t(locale, 'opt_acc_authlog_ok');
    return r.action || r.log_type || '—';
  };

  return (
    <div data-panel="auth-login-log">
      <div className="inline-input" style={{ marginBottom: 8, gap: 8 }}>
        <button type="button" className="chipbtn" disabled={busy} onClick={() => void refresh()}>
          {t(locale, 'opt_acc_authlog_refresh')}
        </button>
        <span className="note">{rows.length}</span>
      </div>
      {msg ? <div className="note">{msg}</div> : null}
      {rows.length === 0 && !msg ? (
        <div className="note option-note">{t(locale, 'opt_acc_authlog_empty')}</div>
      ) : (
        <div className="settings-list" data-auth-log-list>
          {rows.map((r, i) => (
            <div className="settings-row" key={`${r.created_at}-${i}`}>
              <div>
                <b data-content>{r.email || r.actor || '—'}</b>
                <span>
                  {fmt(r.created_at)}
                  {r.ip_address ? ` · ${r.ip_address}` : ''}
                </span>
              </div>
              <small>{outcome(r)}</small>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
