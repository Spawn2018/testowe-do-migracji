/**
 * D-20261014-0700-01 J3 pkt 1 — dane do AccountScreen (wyglad/P3-c).
 * D-20261014-1420-01 R1/R2/R4: 2FA = verified TOTP; MyMfa przy ≥1 urządzeniu; hasło — osobny komunikat.
 * my_profile / admin_user_profile_set, 2FA (Mfa), my_sessions / revoke_user_sessions.
 * Podgląd KSH/SCX (E9-7, G-07): tylko odczyt — bez RPC zapisów.
 */
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { AccountScreen, type MyDevice } from '../components/options/PeopleScreens';
import type { AccountKind } from '../components/options/types';
import { t, tp } from '../i18n/messages';
import { fmtDateTime } from '../lib/time';
import { isE164 } from '../lib/phoneNational';
import { isPreviewReadOnly } from '../lib/prodFacade';
import { useTowerStore } from '../store/useTowerStore';
import type { Locale } from '../types';
import { getSupabase } from './client';
import { authErrorPl, passwordOk, PASSWORD_MIN } from './config';
import MyMfa, { MfaSetup, accountMfaEnabled } from './Mfa';
import { getAuthProfile, requestAuthReload } from './profile';
import { deviceLabel } from './sessionYear';
import './auth.css';

type SessionRow = {
  id: string;
  user_agent: string | null;
  created_at: string;
  expires_at: string;
  last_active_at: string;
  is_current: boolean;
};

function roleToKind(role: string | undefined | null): AccountKind {
  if (role === 'HHL_OPS') return 'HHL_OPS';
  if (role === 'CLIENT_USER') return 'CLIENT_USER';
  if (role === 'CARRIER_DISPATCH') return 'CARRIER_DISPATCH';
  if (role === 'CARRIER_USER') return 'CARRIER_USER';
  return 'HHL_ADMIN';
}

/** „16.10.2026, 08:05” we wszystkich językach (właściciel 16.10.2026). */
function fmtWhen(iso: string | null | undefined, _locale: Locale): string | null {
  if (!iso) return null;
  return fmtDateTime(iso);
}

export default function LiveAccountScreen() {
  const locale = useTowerStore((s) => s.locale);
  const previewRo = isPreviewReadOnly();
  const me = getAuthProfile();
  const [mfaOn, setMfaOn] = useState(false);
  const [devices, setDevices] = useState<MyDevice[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pwOpen, setPwOpen] = useState(false);
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [mfaSetup, setMfaSetup] = useState(false);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const sb = await getSupabase();
    // R1: bez my_mfa_status.satisfied — tylko zweryfikowane TOTP
    const list = await sb.auth.mfa.listFactors();
    const totp = (list.data?.totp ?? []).filter((f) => f.status === 'verified');
    setMfaOn(accountMfaEnabled(totp.length));
    const { data, error } = await sb.rpc('my_sessions');
    if (error) {
      setMsg({ ok: false, text: authErrorPl(error.message) });
      setDevices([]);
      return;
    }
    const rows = (data ?? []) as SessionRow[];
    setDevices(rows.map((r) => ({
      id: r.id,
      name: deviceLabel(r.user_agent),
      last: fmtWhen(r.last_active_at, locale) ?? '',
      push: false,
      current: r.is_current,
    })));
  }, [locale]);

  useEffect(() => { void refresh(); }, [refresh]);

  if (!me) return null;

  const kind = roleToKind(me.role);
  const accountMe = {
    first: me.first_name ?? '',
    last: me.last_name ?? '',
    phone: me.phone ?? '',
    mail: me.email,
    kind,
    lastLogin: fmtWhen(me.last_sign_in_at, locale),
  };

  const onSave = previewRo ? undefined : async (v: { first: string; last: string; phone: string }) => {
    const fn = v.first.trim();
    const ln = v.last.trim();
    const ph = v.phone.trim();
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

  const onPassword = previewRo ? undefined : () => {
    setPwOpen(true);
    setPw('');
    setPw2('');
    setMsg(null);
  };

  const submitPassword = async (e: FormEvent) => {
    e.preventDefault();
    if (previewRo) return;
    if (!passwordOk(pw)) {
      setMsg({ ok: false, text: tp(locale, 'auth_pw_rule', { n: PASSWORD_MIN }) });
      return;
    }
    if (pw !== pw2) {
      setMsg({ ok: false, text: t(locale, 'auth_pw_mismatch') });
      return;
    }
    setBusy(true);
    setMsg(null);
    const sb = await getSupabase();
    const { error } = await sb.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) {
      setMsg({ ok: false, text: authErrorPl(error.message) });
      return;
    }
    setPwOpen(false);
    setPw('');
    setPw2('');
    setMsg({ ok: true, text: t(locale, 'auth_pw_changed') });
  };

  const onMfa = previewRo ? undefined : () => {
    setMfaSetup(true);
    setMsg(null);
  };

  /** D-20261014-1420-01 R3: jedno urządzenie przez my_session_revoke (nie signOut others). */
  const onRemoveDevice = previewRo ? undefined : async (id: string) => {
    const target = devices.find((d) => d.id === id);
    if (!target || target.current) return;
    setBusy(true);
    setMsg(null);
    const sb = await getSupabase();
    const { error } = await sb.rpc('my_session_revoke', { p_session: id });
    setBusy(false);
    if (error) {
      setMsg({ ok: false, text: authErrorPl(error.message) });
      return;
    }
    await refresh();
  };

  return (
    <div data-live-account={previewRo ? 'ro' : 'rw'} data-busy={busy ? '1' : undefined}>
      <AccountScreen
        key={`${me.user_id}:${me.first_name}:${me.last_name}:${me.phone}`}
        locale={locale}
        me={accountMe}
        mfa={mfaOn}
        devices={devices}
        onSave={onSave}
        onPassword={onPassword}
        onMfa={onMfa}
        onRemoveDevice={onRemoveDevice}
      />
      {pwOpen && !previewRo ? (
        <section className="ox-panel" data-auth="change-password">
          <form className="auth-form" onSubmit={(e) => void submitPassword(e)}>
            <label>{t(locale, 'auth_password')}<input className="input full" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" /></label>
            <label>{t(locale, 'auth_password_repeat')}<input className="input full" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" /></label>
            <div className="ox-actions">
              <button className="btn ox-btn" type="submit" disabled={busy}>{t(locale, 'p3c_m_pw_change')}</button>
              <button className="btn ghost ox-btn" type="button" onClick={() => setPwOpen(false)}>{t(locale, 'p3c_cancel')}</button>
            </div>
          </form>
        </section>
      ) : null}
      {mfaSetup && !previewRo && !mfaOn ? (
        <section className="ox-panel" data-auth="my-mfa" data-mfa-first="1">
          <div className="ox-panel-bd">
            <MfaSetup onDone={() => { setMfaSetup(false); void refresh(); }} />
          </div>
        </section>
      ) : null}
      {/* R2: MyMfa (drugie urządzenie, usuwanie, wymóg admin) — tymczasowo do wyglądu koordynatora */}
      {mfaOn && !previewRo ? <MyMfa /> : null}
      {msg ? <div className={`auth-msg ${msg.ok ? 'ok' : 'err'} auth-admin-row`} role="status">{msg.text}</div> : null}
    </div>
  );
}
