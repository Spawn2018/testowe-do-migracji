/**
 * ADM-10 — pasek „Działasz jako …” (wyjście jednym kliknięciem).
 * wyglad/P3 (E37 pkt 6, img/e37-after): pasek pod paskiem górnym, bursztynowy; zdanie o zapisie w historii; „Zakończ”.
 */
import { useState } from 'react';
import { getAuthProfile, requestAuthReload } from './profile';
import { getSupabase } from './client';
import { authErrorPl } from './config';
import { useTowerStore } from '../store/useTowerStore';
import { hasKey, t } from '../i18n/messages';
import './auth.css';

export function ImpersonationBanner() {
  const locale = useTowerStore((s) => s.locale);
  const me = getAuthProfile();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  /* B5 (0249): Podgląd (tylko odczyt) ma własny pasek — PreviewBanner */
  if (!me?.acting_as || me.preview_ro) return null;

  const name = me.full_name?.trim() || me.email;
  const kindKey = `p3a_as_${me.role}`;
  const kind = hasKey(locale, kindKey) ? t(locale, kindKey) : t(locale, `a6_role_${me.role}`);
  // G4: imię i nazwisko administratora; do migracji my_profile — e-mail.
  const admin = me.real_full_name?.trim() || me.real_email || '';

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
    <div className="subbar subbar-actas" data-banner="impersonation" role="status">
      <p className="subbar-tx">
        <b>{`${t(locale, 'p3a_actas_bold').replace('{kind}', kind)} (${name})`}</b>{' '}
        {t(locale, 'p3a_actas_rest').replace('{admin}', admin).replace('{kind}', kind)}
        {err ? <span className="auth-msg err"> {err}</span> : null}
      </p>
      <button className="subbar-btn" type="button" disabled={busy} onClick={() => void exit()}>
        {t(locale, 'p3a_actas_end')}
      </button>
    </div>
  );
}
