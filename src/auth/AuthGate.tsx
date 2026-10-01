import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { getSupabase } from './client';
import { authErrorPl, passwordOk, PASSWORD_MIN, viewRoleForOrg } from './config';
import { t } from '../i18n/messages';
import { setAuthProfile, AUTH_RELOAD_EVENT, type AuthProfile } from './profile';
import { useTowerStore } from '../store/useTowerStore';
import { markManualLogout, rememberLogin, sessionEndReason, SESSION_END_MSG, type SessionEnd } from './sessionYear';
import { MfaSetup, MfaVerify, mfaStep, readMfaStatus } from './Mfa';
import './auth.css';

const LINK_KEY = 'tower_auth_link_pending';

type State =
  | { kind: 'loading' }
  | { kind: 'link-pending' }
  | { kind: 'anon'; ended?: SessionEnd; mode?: 'login' | 'forgot' }
  | { kind: 'set-password'; session: Session; profile: AuthProfile; reason: 'invite' | 'recovery' | 'required' }
  | { kind: 'noaccess'; reason: string }
  | { kind: 'mfa'; step: 'verify' | 'setup' }
  | { kind: 'ready'; session: Session; profile: AuthProfile };

function Brand() {
  const theme = useTowerStore((s) => s.theme);
  const locale = useTowerStore((s) => s.locale);
  const src = theme === 'light' ? '/brand/watchtower-logo-full.png' : '/brand/watchtower-logo-full-dark.png';
  return (
    <div className="brand auth-brand">
      <img src={src} alt={t(locale, 'brand')} width={240} height={80} />
      <span>Stegra Boden · H&amp;H Logistics</span>
    </div>
  );
}

function redirectTo(): string {
  return window.location.origin + window.location.pathname;
}

/** Czy hash/query wygląda na link z e-maila Auth (invite / recovery / magic). */
function captureAuthLinkFromUrl(): boolean {
  const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : '';
  const fromHash = hash.includes('access_token=') || /type=(invite|recovery|signup|magiclink|email)/.test(hash);
  const q = window.location.search;
  const fromQuery = /[?&]code=/.test(q) || /[?&]type=(invite|recovery)/.test(q);
  if (!fromHash && !fromQuery) return false;
  sessionStorage.setItem(LINK_KEY, JSON.stringify({ hash: window.location.hash, search: window.location.search }));
  history.replaceState(null, '', window.location.pathname);
  return true;
}

async function consumePendingLink(sb: SupabaseClient): Promise<{ error?: string; recovery?: boolean }> {
  const raw = sessionStorage.getItem(LINK_KEY);
  sessionStorage.removeItem(LINK_KEY);
  if (!raw) return { error: 'Brak linku do weryfikacji.' };
  let pending: { hash?: string; search?: string };
  try { pending = JSON.parse(raw) as { hash?: string; search?: string }; }
  catch { return { error: 'Uszkodzony link.' }; }

  const hash = (pending.hash ?? '').replace(/^#/, '');
  const params = new URLSearchParams(hash.includes('=') ? hash : '');
  const access = params.get('access_token');
  const refresh = params.get('refresh_token');
  const type = params.get('type') ?? '';
  if (access && refresh) {
    const { error } = await sb.auth.setSession({ access_token: access, refresh_token: refresh });
    if (error) return { error: authErrorPl(error.message) };
    return { recovery: type === 'recovery' };
  }
  const search = pending.search ?? '';
  const code = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search).get('code');
  if (code) {
    const { error } = await sb.auth.exchangeCodeForSession(code);
    if (error) return { error: authErrorPl(error.message) };
    return { recovery: /type=recovery/.test(search) };
  }
  return { error: 'Link wygasł lub jest niekompletny.' };
}

function PasswordField({
  id, label, value, onChange, autoComplete, minLength = PASSWORD_MIN,
}: {
  id: string; label: string; value: string; onChange: (v: string) => void; autoComplete: string; minLength?: number;
}) {
  const [show, setShow] = useState(false);
  return (
    <label>{label}
      <div className="auth-pw-wrap">
        <input
          id={id}
          className="input full"
          type={show ? 'text' : 'password'}
          required
          minLength={minLength}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <button className="chipbtn auth-pw-toggle" type="button" onClick={() => setShow((s) => !s)} aria-pressed={show}>
          {show ? 'Ukryj' : 'Pokaż'}
        </button>
      </div>
    </label>
  );
}

function LinkPendingScreen({ onContinue, onCancel }: { onContinue: () => void; onCancel: () => void }) {
  const locale = useTowerStore((s) => s.locale);
  return (
    <div className="auth-screen" data-auth="link-pending">
      <section className="panel auth-card">
        <header className="panel-hd"><Brand /></header>
        <div className="panel-bd auth-form">
          <p className="auth-msg">{t(locale, 'auth_link_pending')}</p>
          <button className="btn" type="button" data-auth="link-continue" onClick={onContinue}>{t(locale, 'auth_link_continue')}</button>
          <button className="btn ghost" type="button" onClick={onCancel}>{t(locale, 'a6_auth_logout')}</button>
        </div>
      </section>
    </div>
  );
}

function LoginScreen({
  ended, mode, onForgot, onBack,
}: {
  ended?: SessionEnd; mode: 'login' | 'forgot'; onForgot: () => void; onBack: () => void;
}) {
  const locale = useTowerStore((s) => s.locale);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const submitLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const sb = await getSupabase();
    const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) setMsg({ ok: false, text: authErrorPl(error.message) });
    // sukces → onAuthStateChange w AuthGate
  };

  const submitForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const addr = email.trim().toLowerCase();
    const sb = await getSupabase();
    const { data: allowed, error: allowErr } = await sb.rpc('auth_email_allowed', { p_email: addr });
    if (allowErr) {
      setBusy(false);
      setMsg({ ok: false, text: authErrorPl(allowErr.message) });
      return;
    }
    if (allowed !== true) {
      setBusy(false);
      setMsg({ ok: false, text: t(locale, 'auth_no_invite') });
      return;
    }
    const { error } = await sb.auth.resetPasswordForEmail(addr, { redirectTo: redirectTo() });
    setBusy(false);
    setMsg(error
      ? { ok: false, text: authErrorPl(error.message) }
      : { ok: true, text: t(locale, 'auth_reset_sent') });
  };

  if (mode === 'forgot') {
    return (
      <div className="auth-screen" data-auth="forgot">
        <section className="panel auth-card">
          <header className="panel-hd"><Brand /></header>
          <div className="panel-bd">
            <form className="auth-form" onSubmit={submitForgot}>
              <p className="auth-msg">{t(locale, 'auth_forgot_hint')}</p>
              <label>{t(locale, 'a6_auth_email')}
                <input className="input full" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </label>
              <button className="btn" type="submit" disabled={busy || !email.trim()}>{t(locale, busy ? 'a6_auth_sending' : 'auth_forgot_send')}</button>
              {msg && <div className={`auth-msg ${msg.ok ? 'ok' : 'err'}`} role="status">{msg.text}</div>}
              <button className="btn ghost" type="button" onClick={onBack}>{t(locale, 'auth_back_login')}</button>
            </form>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="auth-screen" data-auth="login">
      <section className="panel auth-card">
        <header className="panel-hd"><Brand /></header>
        <div className="panel-bd">
          <form className="auth-form" onSubmit={submitLogin}>
            {ended && <div className="auth-msg err" role="alert" data-auth="session-ended">{SESSION_END_MSG[ended][locale]}</div>}
            <label>{t(locale, 'a6_auth_email')}
              <input className="input full" type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <PasswordField id="auth-pw" label={t(locale, 'auth_password')} value={password} onChange={setPassword} autoComplete="current-password" />
            <button className="btn" type="submit" disabled={busy || !email.trim() || !password}>{t(locale, busy ? 'auth_signing' : 'auth_sign_in')}</button>
            {msg && <div className={`auth-msg ${msg.ok ? 'ok' : 'err'}`} role="status">{msg.text}</div>}
            <button className="btn ghost" type="button" onClick={onForgot}>{t(locale, 'auth_forgot')}</button>
            <div className="auth-msg">{t(locale, 'a6_auth_invite_only')}</div>
          </form>
        </div>
      </section>
    </div>
  );
}

function SetPasswordScreen({
  reason, onDone,
}: {
  reason: 'invite' | 'recovery' | 'required'; onDone: () => void;
}) {
  const locale = useTowerStore((s) => s.locale);
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordOk(pw)) {
      setMsg({ ok: false, text: t(locale, 'auth_pw_short').replace('{n}', String(PASSWORD_MIN)) });
      return;
    }
    if (pw !== pw2) {
      setMsg({ ok: false, text: t(locale, 'auth_pw_mismatch') });
      return;
    }
    setBusy(true); setMsg(null);
    const sb = await getSupabase();
    const { error } = await sb.auth.updateUser({ password: pw });
    if (error) {
      setBusy(false);
      setMsg({ ok: false, text: authErrorPl(error.message) });
      return;
    }
    const { error: markErr } = await sb.rpc('app_user_mark_password_set');
    setBusy(false);
    if (markErr) {
      setMsg({ ok: false, text: authErrorPl(markErr.message) });
      return;
    }
    onDone();
  };

  return (
    <div className="auth-screen" data-auth="set-password">
      <section className="panel auth-card">
        <header className="panel-hd"><Brand /></header>
        <div className="panel-bd">
          <form className="auth-form" onSubmit={submit}>
            <b>{t(locale, reason === 'recovery' ? 'auth_set_pw_recovery' : 'auth_set_pw')}</b>
            <p className="auth-msg">{t(locale, 'auth_set_pw_hint').replace('{n}', String(PASSWORD_MIN))}</p>
            <PasswordField id="auth-new-pw" label={t(locale, 'auth_password')} value={pw} onChange={setPw} autoComplete="new-password" />
            <PasswordField id="auth-new-pw2" label={t(locale, 'auth_password_repeat')} value={pw2} onChange={setPw2} autoComplete="new-password" />
            <button className="btn" type="submit" disabled={busy || !pw || !pw2}>{t(locale, busy ? 'auth_saving' : 'auth_set_pw_save')}</button>
            {msg && <div className={`auth-msg ${msg.ok ? 'ok' : 'err'}`} role="status">{msg.text}</div>}
          </form>
        </div>
      </section>
    </div>
  );
}

function MfaScreen({ step }: { step: 'verify' | 'setup' }) {
  const locale = useTowerStore((s) => s.locale);
  return (
    <div className="auth-screen" data-auth="mfa">
      <section className="panel auth-card">
        <header className="panel-hd"><Brand /></header>
        <div className="panel-bd auth-form">
          <b>{t(locale, 'i5_h')}</b>
          {step === 'verify' ? <MfaVerify /> : <MfaSetup />}
          <button className="btn ghost" type="button" onClick={() => { markManualLogout(); void getSupabase().then((sb) => sb.auth.signOut()); }}>{t(locale, 'a6_auth_logout')}</button>
        </div>
      </section>
    </div>
  );
}

function NoAccess({ reason }: { reason: string }) {
  const locale = useTowerStore((s) => s.locale);
  return (
    <div className="auth-screen" data-auth="noaccess">
      <section className="panel auth-card">
        <header className="panel-hd"><Brand /></header>
        <div className="panel-bd auth-form">
          <div className="auth-msg err">{reason}</div>
          <button className="btn ghost" type="button" onClick={() => { markManualLogout(); void getSupabase().then((sb) => sb.auth.signOut()); }}>{t(locale, 'a6_auth_logout')}</button>
        </div>
      </section>
    </div>
  );
}

export default function AuthGate({ children }: { children: ReactNode }) {
  const locale = useTowerStore((s) => s.locale);
  const [state, setState] = useState<State>(() =>
    (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(LINK_KEY)) || captureAuthLinkFromUrl()
      ? { kind: 'link-pending' }
      : { kind: 'loading' },
  );
  const [anonMode, setAnonMode] = useState<'login' | 'forgot'>('login');
  const [recoveryOnce, setRecoveryOnce] = useState(false);
  const loadRef = useRef<(session: Session | null, opts?: { forcePassword?: boolean }) => Promise<void>>(async () => {});

  useEffect(() => {
    let alive = true;
    let unsub: (() => void) | undefined;
    const load = async (session: Session | null, opts?: { forcePassword?: boolean }) => {
      if (!session) {
        setAuthProfile(null);
        void import('../data/supabaseBridge').then((b) => b.disconnectSupabaseData());
        const ended = sessionEndReason(Date.now());
        if (alive) setState({ kind: 'anon', ended, mode: 'login' });
        return;
      }
      rememberLogin(session.access_token);
      const sb = await getSupabase();
      const { data, error } = await sb.rpc('my_profile');
      const p = (Array.isArray(data) ? data[0] : null) as AuthProfile | null;
      if (!alive) return;
      if (error || !p) { setAuthProfile(null); setState({ kind: 'noaccess', reason: t(useTowerStore.getState().locale, 'a6_auth_no_org') }); return; }
      if (!p.active) { setAuthProfile(null); setState({ kind: 'noaccess', reason: t(useTowerStore.getState().locale, 'a6_auth_deactivated') }); return; }
      const viewRole = viewRoleForOrg(p.org_code);
      if (!viewRole) { setAuthProfile(null); setState({ kind: 'noaccess', reason: t(useTowerStore.getState().locale, 'a6_auth_no_view').replace('{org}', p.org_code) }); return; }

      const needPw = opts?.forcePassword || p.must_set_password === true;
      if (needPw) {
        setAuthProfile(null);
        setState({
          kind: 'set-password',
          session,
          profile: p,
          reason: opts?.forcePassword ? 'recovery' : (p.must_set_password ? 'required' : 'invite'),
        });
        return;
      }

      const level = (await sb.auth.mfa.getAuthenticatorAssuranceLevel()).data ?? null;
      const step = mfaStep(level, await readMfaStatus(sb));
      if (!alive) return;
      if (step !== 'none') { setAuthProfile(null); setState({ kind: 'mfa', step }); return; }
      setAuthProfile(p);
      const st = useTowerStore.getState();
      if (st.role !== viewRole) st.setRole(viewRole);
      if (alive) setState({ kind: 'loading' });
      try {
        const bridge = await import('../data/supabaseBridge');
        await bridge.connectSupabaseData(sb);
      } catch (e) {
        if (alive) setState({ kind: 'noaccess', reason: t(useTowerStore.getState().locale, 'a6_auth_fetch_fail').replace('{err}', e instanceof Error ? e.message : String(e)) });
        return;
      }
      if (alive) setState({ kind: 'ready', session, profile: p });
    };
    loadRef.current = load;

    void getSupabase().then(async (sb) => {
      if (state.kind === 'link-pending') return; // czekamy na „Dalej”
      const { data } = await sb.auth.getSession();
      await load(data.session, recoveryOnce ? { forcePassword: true } : undefined);
      const { data: sub } = sb.auth.onAuthStateChange((event, session) => {
        if (event === 'PASSWORD_RECOVERY') {
          setRecoveryOnce(true);
          void load(session, { forcePassword: true });
          return;
        }
        if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED' || event === 'MFA_CHALLENGE_VERIFIED') {
          void load(session, recoveryOnce ? { forcePassword: true } : undefined);
        }
      });
      unsub = () => sub.subscription.unsubscribe();
    }).catch((e: unknown) => alive && setState({ kind: 'noaccess', reason: authErrorPl(String(e)) }));
    return () => { alive = false; unsub?.(); };
    // link-pending / recoveryOnce — celowo: po Dalej przeładujemy efekt
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.kind === 'link-pending' ? 'pending' : 'go', recoveryOnce]);

  useEffect(() => {
    const onReload = () => {
      void getSupabase().then(async (sb) => {
        const { data } = await sb.auth.getSession();
        await loadRef.current(data.session);
      });
    };
    window.addEventListener(AUTH_RELOAD_EVENT, onReload);
    return () => window.removeEventListener(AUTH_RELOAD_EVENT, onReload);
  }, []);

  useEffect(() => {
    if (state.kind !== 'ready') return;
    const locked = viewRoleForOrg(state.profile.org_code);
    if (locked === 'HHL') return;
    return useTowerStore.subscribe((s) => {
      if (locked && s.role !== locked) useTowerStore.getState().setRole(locked);
    });
  }, [state]);

  if (state.kind === 'loading') {
    const theme = useTowerStore.getState().theme;
    const src = theme === 'light' ? '/brand/watchtower-logo-full.png' : '/brand/watchtower-logo-full-dark.png';
    return (
      <div className="auth-screen" data-auth="loading">
        <div className="auth-card panel">
          <img className="auth-boot-logo" src={src} alt={t(locale, 'brand')} width={240} height={80} />
          <div className="auth-msg">{t(locale, 'a6_auth_loading')}</div>
        </div>
      </div>
    );
  }

  if (state.kind === 'link-pending') {
    return (
      <LinkPendingScreen
        onCancel={() => {
          sessionStorage.removeItem(LINK_KEY);
          setState({ kind: 'anon', mode: 'login' });
        }}
        onContinue={() => {
          void (async () => {
            const sb = await getSupabase();
            const r = await consumePendingLink(sb);
            if (r.error) {
              setState({ kind: 'noaccess', reason: r.error });
              return;
            }
            if (r.recovery) setRecoveryOnce(true);
            const { data } = await sb.auth.getSession();
            // przełącz kind → efekt załaduje sesję
            setState({ kind: 'loading' });
            if (!data.session) setState({ kind: 'anon', mode: 'login' });
          })();
        }}
      />
    );
  }

  if (state.kind === 'set-password') {
    return (
      <SetPasswordScreen
        reason={state.reason}
        onDone={() => {
          setRecoveryOnce(false);
          setState({ kind: 'loading' });
          void getSupabase().then(async (sb) => {
            const { data } = await sb.auth.getSession();
            // wymuś przeładowanie profilu (must_set_password=false)
            const { data: sub } = sb.auth.onAuthStateChange(() => undefined);
            sub.subscription.unsubscribe();
            window.dispatchEvent(new Event('tower-auth-reload'));
            // prosty reload stanu: SIGNED_IN ścieżka
            if (data.session) {
              const { data: prof } = await sb.rpc('my_profile');
              const p = (Array.isArray(prof) ? prof[0] : null) as AuthProfile | null;
              if (p && !p.must_set_password) {
                setState({ kind: 'loading' });
                // trigger load via fake state flip
                setRecoveryOnce(false);
                const level = (await sb.auth.mfa.getAuthenticatorAssuranceLevel()).data ?? null;
                const step = mfaStep(level, await readMfaStatus(sb));
                if (step !== 'none') { setState({ kind: 'mfa', step }); return; }
                setAuthProfile(p);
                const viewRole = viewRoleForOrg(p.org_code);
                if (viewRole) useTowerStore.getState().setRole(viewRole);
                try {
                  const bridge = await import('../data/supabaseBridge');
                  await bridge.connectSupabaseData(sb);
                  setState({ kind: 'ready', session: data.session, profile: p });
                } catch (e) {
                  setState({ kind: 'noaccess', reason: t(locale, 'a6_auth_fetch_fail').replace('{err}', e instanceof Error ? e.message : String(e)) });
                }
              }
            }
          });
        }}
      />
    );
  }

  if (state.kind === 'anon') {
    return (
      <LoginScreen
        ended={state.ended}
        mode={anonMode}
        onForgot={() => setAnonMode('forgot')}
        onBack={() => setAnonMode('login')}
      />
    );
  }
  if (state.kind === 'noaccess') return <NoAccess reason={state.reason} />;
  if (state.kind === 'mfa') return <MfaScreen step={state.step} />;
  /* UI-12: użytkownik / rola / Wyloguj → lewy pasek (Nav), nie fixed bottom */
  return <>{children}</>;
}
