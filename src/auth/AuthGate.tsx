import { useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { getSupabase } from './client';
import { authErrorPl, viewRoleForOrg } from './config';
import { t } from '../i18n/messages';
import { setAuthProfile, type AuthProfile } from './profile';
import { useTowerStore } from '../store/useTowerStore';
import { markManualLogout, rememberLogin, sessionEndReason, SESSION_END_MSG, type SessionEnd } from './sessionYear';
import './auth.css';

type State =
  | { kind: 'loading' }
  | { kind: 'anon'; ended?: SessionEnd }
  | { kind: 'noaccess'; reason: string }
  | { kind: 'ready'; session: Session; profile: AuthProfile };

function Brand() {
  return <div className="brand"><b>TOWER</b><span>Stegra Boden · H&amp;H Logistics</span></div>;
}

function LoginScreen({ ended }: { ended?: SessionEnd }) {
  const locale = useTowerStore((s) => s.locale);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const sb = await getSupabase();
    const { error } = await sb.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin + window.location.pathname },
    });
    setBusy(false);
    setMsg(error
      ? { ok: false, text: authErrorPl(error.message) }
      : { ok: true, text: t(locale, 'a6_auth_link_sent') });
  };

  return (
    <div className="auth-screen" data-auth="login">
      <section className="panel auth-card">
        <header className="panel-hd"><Brand /></header>
        <div className="panel-bd">
          <form className="auth-form" onSubmit={submit}>
            {ended && <div className="auth-msg err" role="alert" data-auth="session-ended">{SESSION_END_MSG[ended][locale]}</div>}
            <label>{t(locale, 'a6_auth_email')}
              <input className="input full" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <button className="btn" type="submit" disabled={busy || !email.trim()}>{t(locale, busy ? 'a6_auth_sending' : 'a6_auth_send')}</button>
            {msg && <div className={`auth-msg ${msg.ok ? 'ok' : 'err'}`} role="status">{msg.text}</div>}
            <div className="auth-msg">{t(locale, 'a6_auth_invite_only')}</div>
          </form>
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
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    let alive = true;
    let unsub: (() => void) | undefined;
    const load = async (session: Session | null) => {
      if (!session) {
        setAuthProfile(null);
        void import('../data/supabaseBridge').then((b) => b.disconnectSupabaseData());
        // ANEKS 5 §4: sesja usunięta na serwerze (rok, wyloguj wszędzie, HHL) → komunikat na ekranie logowania
        const ended = sessionEndReason(Date.now());   // brak znaczników (pierwsze wejście, ręczne wylogowanie) → null
        if (alive) setState({ kind: 'anon', ended });
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
      setAuthProfile(p);
      const st = useTowerStore.getState();
      if (st.role !== viewRole) st.setRole(viewRole);
      // BK3: dane z serwera (RLS) zastępują store przed pokazaniem aplikacji.
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
    void getSupabase().then(async (sb) => {
      const { data } = await sb.auth.getSession();
      await load(data.session);
      const { data: sub } = sb.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') void load(session);
      });
      unsub = () => sub.subscription.unsubscribe();
    }).catch((e: unknown) => alive && setState({ kind: 'noaccess', reason: authErrorPl(String(e)) }));
    return () => { alive = false; unsub?.(); };
  }, []);

  // Rola widoku wynika z konta — przełącznik nie może jej zmienić. I-2a: wyjątek HHL (podgląd widoku KSH/SCX
  // na danych dostępnych dla HHL; przełącznik widzi wyłącznie HHL — lib/prodFacade canSwitchView).
  useEffect(() => {
    if (state.kind !== 'ready') return;
    const locked = viewRoleForOrg(state.profile.org_code);
    if (locked === 'HHL') return;
    return useTowerStore.subscribe((s) => {
      if (locked && s.role !== locked) useTowerStore.getState().setRole(locked);
    });
  }, [state]);

  if (state.kind === 'loading') return <div className="auth-screen" data-auth="loading"><div className="auth-msg">{t(locale, 'a6_auth_loading')}</div></div>;
  if (state.kind === 'anon') return <LoginScreen ended={state.ended} />;
  if (state.kind === 'noaccess') return <NoAccess reason={state.reason} />;
  return (
    <>
      {children}
      <div className="auth-session" data-auth="session">
        <b>{state.profile.email}</b><span>{t(locale, `a6_role_${state.profile.role}`)}</span>
        <button className="chipbtn" type="button" onClick={() => { markManualLogout(); void getSupabase().then((sb) => sb.auth.signOut()); }}>{t(locale, 'a6_auth_logout')}</button>
      </div>
    </>
  );
}
