import { useCallback, useEffect, useState } from 'react';
import { getSupabase } from './client';
import { getAuthProfile } from './profile';
import { authErrorPl } from './config';
import { deviceLabel, markManualLogout } from './sessionYear';
import './auth.css';
import { useTowerStore } from '../store/useTowerStore';
import { INTL_LOCALE, t, tp } from '../i18n/messages';
import type { Locale } from '../types';

interface Row { id: string; user_agent: string | null; created_at: string; expires_at: string; last_active_at: string; is_current: boolean }
const fmt = (iso: string, locale: Locale) => new Date(iso).toLocaleString(INTL_LOCALE[locale], { dateStyle: 'short', timeStyle: 'short' });

/** ANEKS 5 §4.4 — „Moje urządzenia” i „Wyloguj ze wszystkich urządzeń” (każdy użytkownik, tylko tryb Supabase). */
export default function MyDevices() {
  const me = getAuthProfile();
  const locale = useTowerStore((s) => s.locale);
  const [rows, setRows] = useState<Row[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => {
    const sb = await getSupabase();
    const { data, error } = await sb.rpc('my_sessions');
    if (error) setMsg(authErrorPl(error.message));
    setRows((data ?? []) as Row[]);
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  if (!me) return null;

  const logoutAll = async () => {
    setBusy(true);
    const sb = await getSupabase();
    const { error } = await sb.rpc('revoke_user_sessions');
    if (error) { setBusy(false); setMsg(authErrorPl(error.message)); return; }
    markManualLogout();
    await sb.auth.signOut({ scope: 'local' });
  };

  return (
    <section className="panel option-panel option-wide" data-auth="my-devices">
      <header className="panel-hd"><h2>{t(locale, 'a6_md_h')}</h2><span className="sub">{tp(locale, 'a6_md_sub', { n: rows.length })}</span></header>
      <div className="panel-bd flush">
        {rows.map((r) => (
          <div className="auth-admin-row" key={r.id}>
            <span className="grow"><b>{deviceLabel(r.user_agent)}</b>{r.is_current && <small>{t(locale, 'a6_md_this')}</small>}</span>
            <small>{t(locale, 'a6_md_times').replace('{a}', fmt(r.created_at, locale)).replace('{b}', fmt(r.expires_at, locale)).replace('{c}', fmt(r.last_active_at, locale))}</small>
          </div>
        ))}
        {msg && <div className="auth-msg err auth-admin-row" role="status">{msg}</div>}
        <div className="auth-admin-row">
          <button className="btn ghost" type="button" disabled={busy} onClick={() => void logoutAll()}>{t(locale, 'a6_md_logout_all')}</button>
        </div>
      </div>
    </section>
  );
}
