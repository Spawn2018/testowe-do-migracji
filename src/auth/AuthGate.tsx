import { useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { getSupabase } from './client';
import { authErrorPl, viewRoleForOrg, ROLE_LABEL_PL } from './config';
import { setAuthProfile, type AuthProfile } from './profile';
import { useTowerStore } from '../store/useTowerStore';
import './auth.css';

type State =
  | { kind: 'loading' }
  | { kind: 'anon' }
  | { kind: 'noaccess'; reason: string }
  | { kind: 'ready'; session: Session; profile: AuthProfile };

function Brand() {
  return <div className="brand"><b>TOWER</b><span>Stegra Boden · H&amp;H Logistics</span></div>;
}

function LoginScreen() {
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
      : { ok: true, text: 'Link do logowania został wysłany. Sprawdź skrzynkę i otwórz go w tej przeglądarce.' });
  };

  return (
    <div className="auth-screen" data-auth="login">
      <section className="panel auth-card">
        <header className="panel-hd"><Brand /></header>
        <div className="panel-bd">
          <form className="auth-form" onSubmit={submit}>
            <label>Adres e-mail
              <input className="input full" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <button className="btn" type="submit" disabled={busy || !email.trim()}>{busy ? 'Wysyłanie…' : 'Wyślij link do logowania'}</button>
            {msg && <div className={`auth-msg ${msg.ok ? 'ok' : 'err'}`} role="status">{msg.text}</div>}
            <div className="auth-msg">Dostęp wyłącznie na zaproszenie administratora HHL.</div>
          </form>
        </div>
      </section>
    </div>
  );
}

function NoAccess({ reason }: { reason: string }) {
  return (
    <div className="auth-screen" data-auth="noaccess">
      <section className="panel auth-card">
        <header className="panel-hd"><Brand /></header>
        <div className="panel-bd auth-form">
          <div className="auth-msg err">{reason}</div>
          <button className="btn ghost" type="button" onClick={() => void getSupabase().then((sb) => sb.auth.signOut())}>Wyloguj</button>
        </div>
      </section>
    </div>
  );
}

export default function AuthGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    let alive = true;
    let unsub: (() => void) | undefined;
    const load = async (session: Session | null) => {
      if (!session) { setAuthProfile(null); if (alive) setState({ kind: 'anon' }); return; }
      const sb = await getSupabase();
      const { data, error } = await sb.rpc('my_profile');
      const p = (Array.isArray(data) ? data[0] : null) as AuthProfile | null;
      if (!alive) return;
      if (error || !p) { setAuthProfile(null); setState({ kind: 'noaccess', reason: 'Konto nie jest przypisane do żadnej organizacji. Skontaktuj się z administratorem HHL.' }); return; }
      if (!p.active) { setAuthProfile(null); setState({ kind: 'noaccess', reason: 'Konto zostało dezaktywowane przez administratora HHL.' }); return; }
      const viewRole = viewRoleForOrg(p.org_code);
      if (!viewRole) { setAuthProfile(null); setState({ kind: 'noaccess', reason: `Organizacja ${p.org_code} nie ma jeszcze widoku w aplikacji.` }); return; }
      setAuthProfile(p);
      const st = useTowerStore.getState();
      if (st.role !== viewRole) st.setRole(viewRole);
      setState({ kind: 'ready', session, profile: p });
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

  // Rola widoku wynika z konta — przełącznik demo nie może jej zmienić.
  useEffect(() => {
    if (state.kind !== 'ready') return;
    const locked = viewRoleForOrg(state.profile.org_code);
    return useTowerStore.subscribe((s) => {
      if (locked && s.role !== locked) useTowerStore.getState().setRole(locked);
    });
  }, [state]);

  if (state.kind === 'loading') return <div className="auth-screen" data-auth="loading"><div className="auth-msg">Ładowanie…</div></div>;
  if (state.kind === 'anon') return <LoginScreen />;
  if (state.kind === 'noaccess') return <NoAccess reason={state.reason} />;
  return (
    <>
      {children}
      <div className="auth-session" data-auth="session">
        <b>{state.profile.email}</b><span>{ROLE_LABEL_PL[state.profile.role]}</span>
        <button className="chipbtn" type="button" onClick={() => void getSupabase().then((sb) => sb.auth.signOut())}>Wyloguj</button>
      </div>
    </>
  );
}
