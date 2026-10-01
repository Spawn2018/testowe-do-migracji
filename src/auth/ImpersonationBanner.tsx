/**
 * ADM-10 — pasek „Działasz jako …” (wyjście jednym kliknięciem).
 */
import { useState } from 'react';
import { getAuthProfile, requestAuthReload } from './profile';
import { getSupabase } from './client';
import { authErrorPl } from './config';
import { useTowerStore } from '../store/useTowerStore';
import { t } from '../i18n/messages';
import './auth.css';

export function ImpersonationBanner() {
  const locale = useTowerStore((s) => s.locale);
  const me = getAuthProfile();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!me?.acting_as) return null;

  const name = me.full_name?.trim() || me.email;
  const label = t(locale, 'a6_ua_act_as_banner')
    .replace('{name}', name)
    .replace('{email}', me.email);

  const exit = async () => {
    setBusy(true);
    setErr(null);
    try {
      const sb = await getSupabase();
      const { error } = await sb.rpc('admin_impersonate_stop');
      if (error) {
        setErr(authErrorPl(error.message));
        setBusy(false);
        return;
      }
      requestAuthReload();
    } catch (e) {
      setErr(authErrorPl(e instanceof Error ? e.message : String(e)));
      setBusy(false);
    }
  };

  return (
    <div className="banner" data-banner="impersonation" role="status">
      <div>
        <b>{label}</b>
        {err ? <span className="auth-msg err"> {err}</span> : null}
      </div>
      <button className="chipbtn" type="button" disabled={busy} onClick={() => void exit()}>
        {t(locale, 'a6_ua_act_as_exit')}
      </button>
    </div>
  );
}
