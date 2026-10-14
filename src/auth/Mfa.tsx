/**
 * I-5 — weryfikacja dwuetapowa (TOTP, Supabase Auth). Tylko tryb Supabase.
 *   MfaSetup   — zapis aplikacji uwierzytelniającej (kod QR + klucz) i potwierdzenie pierwszym kodem → sesja aal2;
 *   MfaVerify  — kod z aplikacji przy logowaniu (aal1 → aal2);
 *   MyMfa      — panel w Opcjach: stan 2FA, zapis, a dla HHL_ADMIN w sesji aal2 — wymaganie 2FA dla administratorów.
 * Egzekwowanie w bazie (0057): HHL_ADMIN bez aal2 przy włączonym wymaganiu nie widzi danych i nie wywoła RPC.
 */
import { useCallback, useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabase } from './client';
import { authErrorPl } from './config';
import { t } from '../i18n/messages';
import { useTowerStore } from '../store/useTowerStore';
import './auth.css';

export interface MfaStatus { role: string | null; aal: string; enforced: boolean; required: boolean; satisfied: boolean; factors?: number }

/**
 * D-20261014-1420-01 R1 — stan „2FA: Włączona” w Moje konto.
 * Tylko zweryfikowane TOTP (`listFactors`, `status === 'verified'`).
 * `my_mfa_status.satisfied` NIE wchodzi: znaczy „spełnia wymaganie”, nie „ma 2FA”.
 */
export function accountMfaEnabled(verifiedTotpCount: number): boolean {
  return verifiedTotpCount > 0;
}

/** I-17: nazwa nowego urządzenia — unikalna na koncie (Supabase wymaga różnych friendlyName). */
export function deviceName(existing: string[], now = new Date()): string {
  const base = `Watch Tower ${existing.length + 1} · ${now.toISOString().slice(0, 16).replace('T', ' ')}`;
  let name = base; let i = 2;
  while (existing.includes(name)) name = `${base} (${i++})`;
  return name;
}

export async function readMfaStatus(sb: SupabaseClient): Promise<MfaStatus | null> {
  const { data, error } = await sb.rpc('my_mfa_status');
  if (error || !data) return null;
  return data as MfaStatus;
}

/** Co pokazać po zalogowaniu: nic, weryfikację kodu albo obowiązkowy zapis TOTP. */
export function mfaStep(level: { currentLevel: string | null; nextLevel: string | null } | null, status: MfaStatus | null): 'none' | 'verify' | 'setup' {
  if (level && level.currentLevel !== 'aal2' && level.nextLevel === 'aal2') return 'verify';
  if (status?.required && !status.satisfied) return 'setup';
  return 'none';
}

const cleanCode = (s: string) => s.replace(/\D/g, '').slice(0, 6);

export function MfaSetup({ onDone, second = false }: { onDone?: () => void; second?: boolean }) {
  const locale = useTowerStore((s) => s.locale);
  const [factor, setFactor] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const start = async () => {
    setBusy(true); setMsg(null);
    const sb = await getSupabase();
    // porzucone, niepotwierdzone zapisy blokują nowy — usuwamy tylko niezweryfikowane
    const list = await sb.auth.mfa.listFactors();
    for (const f of list.data?.all ?? []) if (f.factor_type === 'totp' && f.status !== 'verified') await sb.auth.mfa.unenroll({ factorId: f.id });
    const names = (list.data?.totp ?? []).filter((f) => f.status === 'verified').map((f) => f.friendly_name ?? '');
    const { data, error } = await sb.auth.mfa.enroll({ factorType: 'totp', friendlyName: deviceName(names) });
    setBusy(false);
    if (error || !data) { setMsg({ ok: false, text: authErrorPl(error?.message ?? '') }); return; }
    setFactor({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
  };
  const confirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!factor) return;
    setBusy(true); setMsg(null);
    const sb = await getSupabase();
    const { error } = await sb.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
    setBusy(false);
    if (error) { setMsg({ ok: false, text: t(locale, 'i5_code_bad') }); return; }
    setMsg({ ok: true, text: t(locale, 'i5_setup_ok') });
    onDone?.();
  };

  if (!factor) {
    return (
      <div className="auth-form" data-mfa="setup">
        <div className="auth-msg">{t(locale, second ? 'i17_second_intro' : 'i5_setup_intro')}</div>
        <button className="btn" type="button" disabled={busy} onClick={() => void start()}>{t(locale, second ? 'i17_add' : 'i5_setup_start')}</button>
        {msg && <div className={`auth-msg ${msg.ok ? 'ok' : 'err'}`} role="status">{msg.text}</div>}
      </div>
    );
  }
  return (
    <form className="auth-form" data-mfa="setup-code" onSubmit={confirm}>
      <div className="auth-msg">{t(locale, 'i5_setup_scan')}</div>
      <img src={factor.qr} alt={t(locale, 'i5_qr_alt')} width={180} height={180} style={{ background: '#fff', padding: 6, alignSelf: 'flex-start' }} />
      <div className="auth-msg">{t(locale, 'i5_secret')} <code data-mfa-secret>{factor.secret}</code></div>
      <label>{t(locale, 'i5_code')}
        <input className="input full" inputMode="numeric" autoComplete="one-time-code" required value={code} onChange={(e) => setCode(cleanCode(e.target.value))} />
      </label>
      <button className="btn" type="submit" disabled={busy || code.length !== 6}>{t(locale, 'i5_confirm')}</button>
      {msg && <div className={`auth-msg ${msg.ok ? 'ok' : 'err'}`} role="status">{msg.text}</div>}
    </form>
  );
}

export function MfaVerify() {
  const locale = useTowerStore((s) => s.locale);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [devices, setDevices] = useState<{ id: string; name: string }[]>([]);
  const [pick, setPick] = useState('');
  useEffect(() => {
    void getSupabase().then((sb) => sb.auth.mfa.listFactors()).then((list) => {
      const d = (list.data?.totp ?? []).filter((x) => x.status === 'verified').map((x) => ({ id: x.id, name: x.friendly_name ?? x.id.slice(0, 8) }));
      setDevices(d); setPick((p) => p || d[0]?.id || '');
    });
  }, []);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    const sb = await getSupabase();
    const list = await sb.auth.mfa.listFactors();
    const all = (list.data?.totp ?? []).filter((x) => x.status === 'verified');
    const f = all.find((x) => x.id === pick) ?? all[0];
    if (!f) { setBusy(false); setErr(t(locale, 'i5_no_factor')); return; }
    const { error } = await sb.auth.mfa.challengeAndVerify({ factorId: f.id, code });
    setBusy(false);
    if (error) setErr(t(locale, 'i5_code_bad'));
  };
  return (
    <form className="auth-form" data-mfa="verify" onSubmit={submit}>
      <div className="auth-msg">{t(locale, 'i5_verify_intro')}</div>
      {devices.length > 1 && (
        <label>{t(locale, 'i17_device')}
          <select className="input full" data-mfa-device value={pick} onChange={(e) => setPick(e.target.value)}>
            {devices.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </label>
      )}
      <label>{t(locale, 'i5_code')}
        <input className="input full" inputMode="numeric" autoComplete="one-time-code" required autoFocus value={code} onChange={(e) => setCode(cleanCode(e.target.value))} />
      </label>
      <button className="btn" type="submit" disabled={busy || code.length !== 6}>{t(locale, 'i5_confirm')}</button>
      {err && <div className="auth-msg err" role="alert">{err}</div>}
    </form>
  );
}

/** Panel w Opcjach. */
export default function MyMfa() {
  const locale = useTowerStore((s) => s.locale);
  const [status, setStatus] = useState<MfaStatus | null>(null);
  const [devices, setDevices] = useState<{ id: string; name: string; at: string }[]>([]);
  const hasTotp = devices.length > 0;
  const [setup, setSetup] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    const sb = await getSupabase();
    setStatus(await readMfaStatus(sb));
    const list = await sb.auth.mfa.listFactors();
    setDevices((list.data?.totp ?? []).filter((f) => f.status === 'verified').map((f) => ({ id: f.id, name: f.friendly_name ?? f.id.slice(0, 8), at: f.created_at })));
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  if (!status) return null;
  const admin = status.role === 'HHL_ADMIN';
  const remove = async (id: string) => {
    setMsg(null);
    const sb = await getSupabase();
    const { error } = await sb.auth.mfa.unenroll({ factorId: id });
    if (error) setMsg(authErrorPl(error.message));
    await refresh();
  };
  const toggle = async () => {
    setMsg(null);
    const sb = await getSupabase();
    const { error } = await sb.rpc('admin_set_mfa_enforcement', { p_enabled: !status.enforced });
    if (error) setMsg(authErrorPl(error.message));
    await refresh();
  };
  return (
    <section className="panel option-panel option-wide" data-auth="my-mfa">
      <header className="panel-hd"><h2>{t(locale, 'i5_h')}</h2><span className="sub">{t(locale, hasTotp ? 'i5_on' : 'i5_off')}</span></header>
      <div className="panel-bd flush">
        {!hasTotp && !setup && (
          <div className="auth-admin-row"><span className="grow">{t(locale, admin ? 'i5_admin_should' : 'i5_optional')}</span>
            <button className="btn" type="button" onClick={() => setSetup(true)}>{t(locale, 'i5_setup_start')}</button></div>
        )}
        {setup && !hasTotp && <div className="auth-admin-row"><MfaSetup onDone={() => { setSetup(false); void refresh(); }} /></div>}
        {devices.map((d) => (
          <div className="auth-admin-row" key={d.id} data-mfa-device-row>
            <span className="grow">{d.name}</span>
            <small>{new Date(d.at).toLocaleDateString(locale)}</small>
            {devices.length > 1 && status.aal === 'aal2'
              ? <button className="btn ghost" type="button" data-mfa-remove onClick={() => void remove(d.id)}>{t(locale, 'i17_remove')}</button>
              : null}
          </div>
        ))}
        {hasTotp && devices.length < 2 && !setup && (
          <div className="auth-admin-row" data-mfa-second><span className="grow">{t(locale, 'i17_second_hint')}</span>
            {status.aal === 'aal2'
              ? <button className="btn" type="button" onClick={() => setSetup(true)}>{t(locale, 'i17_add')}</button>
              : <small>{t(locale, 'i5_enforce_needs_aal2')}</small>}</div>
        )}
        {setup && hasTotp && <div className="auth-admin-row"><MfaSetup second onDone={() => { setSetup(false); void refresh(); }} /></div>}
        {admin && (
          <div className="auth-admin-row" data-mfa-enforced={String(status.enforced)}>
            <span className="grow">{t(locale, status.enforced ? 'i5_enforced_on' : 'i5_enforced_off')}</span>
            {status.aal === 'aal2'
              ? (!status.enforced && devices.length < 2
                  ? <small data-mfa-needs-second>{t(locale, 'i17_enforce_needs_two')}</small>
                  : <button className="btn ghost" type="button" onClick={() => void toggle()}>{t(locale, status.enforced ? 'i5_enforce_disable' : 'i5_enforce_enable')}</button>)
              : <small>{t(locale, 'i5_enforce_needs_aal2')}</small>}
          </div>
        )}
        {msg && <div className="auth-msg err auth-admin-row" role="status">{msg}</div>}
      </div>
    </section>
  );
}
