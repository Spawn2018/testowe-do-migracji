import { useEffect, useState, type FormEvent } from 'react';
import { getSupabase } from './client';
import { getAuthProfile, requestAuthReload } from './profile';
import { authErrorPl } from './config';
import { isE164 } from '../lib/phoneNational';
import { useTowerStore } from '../store/useTowerStore';
import { t } from '../i18n/messages';
import './auth.css';

/** E6 — Moje konto: imię, nazwisko, telefon (każdy swoje; bez przebudowy wyglądu). */
export default function MyAccount() {
  const me = getAuthProfile();
  const locale = useTowerStore((s) => s.locale);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!me) return;
    setFirstName(me.first_name ?? '');
    setLastName(me.last_name ?? '');
    setPhone(me.phone ?? '');
  }, [me]);

  if (!me) return null;

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const fn = firstName.trim();
    const ln = lastName.trim();
    const ph = phone.trim();
    if (!fn || !ln) {
      setMsg({ ok: false, text: t(locale, 'a6_ua_name_required') });
      return;
    }
    if (!isE164(ph)) {
      setMsg({ ok: false, text: t(locale, 'a6_ua_phone_e164') });
      return;
    }
    setBusy(true);
    setMsg(null);
    const sb = await getSupabase();
    const { error } = await sb.rpc('admin_user_profile_set', {
      p_user: me.user_id,
      p_first_name: fn,
      p_last_name: ln,
      p_phone: ph,
    });
    setBusy(false);
    if (error) {
      setMsg({ ok: false, text: authErrorPl(error.message) });
      return;
    }
    setMsg({ ok: true, text: t(locale, 'a6_ua_profile_saved') });
    requestAuthReload();
  };

  const missingPhone = !me.phone || !isE164(me.phone);

  return (
    <section className="panel option-panel option-wide" data-auth="my-account">
      <header className="panel-hd">
        <h2>{t(locale, 'a6_ua_my_h')}</h2>
        <span className="sub">{me.email}</span>
      </header>
      {missingPhone ? (
        <div className="auth-msg err auth-admin-row" role="status">{t(locale, 'a6_ua_phone_banner')}</div>
      ) : null}
      <form className="auth-form" onSubmit={(e) => void save(e)}>
        <label>{t(locale, 'a6_ua_first')}<input className="input full" required value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" /></label>
        <label>{t(locale, 'a6_ua_last')}<input className="input full" required value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" /></label>
        <label>{t(locale, 'a6_ua_phone')}<input className="input full" required value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" placeholder="+48…" /></label>
        <button className="btn" type="submit" disabled={busy}>{t(locale, 'a6_ua_save')}</button>
      </form>
      {msg ? <div className={`auth-msg ${msg.ok ? 'ok' : 'err'} auth-admin-row`} role="status">{msg.text}</div> : null}
      {me.phone && isE164(me.phone) ? (
        <div className="auth-admin-row">
          <a className="chipbtn" href={`tel:${me.phone}`}>{t(locale, 'a6_ua_call')}</a>
        </div>
      ) : null}
    </section>
  );
}
