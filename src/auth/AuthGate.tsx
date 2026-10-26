import { useEffect, useRef, useState, type ReactNode } from 'react';
import { BrandLogo } from './BrandLogo';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { getSupabase } from './client';
import { authErrorPl, passwordOk, PASSWORD_MIN, viewRoleForOrg } from './config';
import { clearStalePreview, previewRoOf } from './previewSwitch';
import { sendRecoveryLink } from './sendAuthEmail';
import { t, tp } from '../i18n/messages';
import { getAuthProfile, setAuthProfile, AUTH_RELOAD_EVENT, type AuthProfile, type AuthReloadDetail } from './profile';
import { useTowerStore } from '../store/useTowerStore';
import { markManualLogout, rememberLogin, sessionEndReason, SESSION_END_MSG, type SessionEnd } from './sessionYear';
import { MfaSetup, MfaVerify, mfaStep, readMfaStatus } from './Mfa';
import { ExpiredLinkScreen } from './ExpiredLinkScreen';
import { p10bp } from '../i18n/p10b';
import { RECOVERY_LINK_TTL, expiredLinkInfo, isExpiredLinkError, resendExpiredLink, type ExpiredLinkInfo, type PendingLink } from '../lib/p10bSource';
import { FirstEntryFlow, InviteStep, PasswordStep } from './FirstEntry';
import { enableNotifications, firstEntryReady, firstEntryReceives, inviteInfo, saveMyDetails, type InviteInfo } from '../lib/firstEntrySource';
import { requestHelpOnce } from '../lib/firstEntryFlag';
import { splitName, type FirstStep } from '../lib/firstEntry';
import { viewedKind } from '../lib/cockpitE9';
import { needsPhone } from '../components/shell/PhoneMissingBar';
import './auth.css';

/** D-20261013-2255-01 G4: last_sign_in_at z sesji Auth, gdy my_profile jeszcze nie zwraca pola. */
function withSessionProfile(p: AuthProfile, session: Session): AuthProfile {
  const fromSession = session.user.last_sign_in_at ?? null;
  if (p.last_sign_in_at || !fromSession) return p;
  return { ...p, last_sign_in_at: fromSession };
}

const LINK_KEY = 'tower_auth_link_pending';

type State =
  | { kind: 'loading' }
  | { kind: 'link-pending' }
  | { kind: 'anon'; ended?: SessionEnd; mode?: 'login' | 'forgot' }
  | { kind: 'set-password'; session: Session; profile: AuthProfile; reason: 'invite' | 'recovery' | 'required' }
  | { kind: 'noaccess'; reason: string }
  /* wyglad/P10b-a (E37 pkt 7): wygasły albo zużyty link z e-maila */
  | { kind: 'expired'; link: PendingLink }
  | { kind: 'mfa'; step: 'verify' | 'setup' }
  /* wyglad/P10b-d (E37 pkt 9): kroki 3–4 po zaproszeniu albo sam krok 3 przy logowaniu konta bez telefonu */
  | { kind: 'first-entry'; session: Session; profile: AuthProfile; steps: FirstStep[]; help: boolean }
  | { kind: 'ready'; session: Session; profile: AuthProfile };

function Brand() {
  const locale = useTowerStore((s) => s.locale);
  return (
    <div className="brand auth-brand">
      <BrandLogo alt={t(locale, 'brand')} />
      <span>Stegra Boden · H&amp;H Logistics</span>
    </div>
  );
}

function redirectTo(): string {
  return window.location.origin + window.location.pathname;
}

/**
 * wyglad/P10b-a (E37 pkt 7): Auth po nieudanej weryfikacji wraca z `#error=access_denied&error_code=otp_expired…`
 * (albo tym samym w zapytaniu). Wcześniej taki adres trafiał do routera — ekran logowania bez słowa wyjaśnienia.
 */
const EXPIRED_RE = /error_code=(otp_expired|otp_disabled|flow_state_expired|flow_state_not_found)|error=access_denied/;
function captureExpiredFromUrl(): PendingLink | false {
  if (typeof window === 'undefined') return false;
  const hash = window.location.hash;
  const search = window.location.search;
  if (!EXPIRED_RE.test(hash) && !EXPIRED_RE.test(search)) return false;
  history.replaceState(null, '', window.location.pathname);
  return { hash, search };
}

/** Czy hash/query wygląda na link z e-maila Auth (invite / recovery / magic / PKCE). */
function captureAuthLinkFromUrl(): boolean {
  const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : '';
  const fromHash = hash.includes('access_token=') || hash.includes('token_hash=')
    || /type=(invite|recovery|signup|magiclink|email)/.test(hash);
  const q = window.location.search;
  const fromQuery = /[?&]code=/.test(q) || /[?&]token_hash=/.test(q)
    || /[?&]type=(invite|recovery|signup|magiclink|email)/.test(q);
  if (!fromHash && !fromQuery) return false;
  sessionStorage.setItem(LINK_KEY, JSON.stringify({ hash: window.location.hash, search: window.location.search }));
  history.replaceState(null, '', window.location.pathname);
  return true;
}

async function consumePendingLink(sb: SupabaseClient): Promise<{ error?: string; recovery?: boolean; link?: PendingLink }> {
  const raw = sessionStorage.getItem(LINK_KEY);
  sessionStorage.removeItem(LINK_KEY);
  if (!raw) return { error: 'Brak linku do weryfikacji.' };
  let pending: { hash?: string; search?: string };
  try { pending = JSON.parse(raw) as { hash?: string; search?: string }; }
  catch { return { error: 'Uszkodzony link.' }; }
  const r = await consumeLink(sb, pending);
  return { ...r, link: pending };
}

async function consumeLink(sb: SupabaseClient, pending: { hash?: string; search?: string }): Promise<{ error?: string; recovery?: boolean }> {

  const hash = (pending.hash ?? '').replace(/^#/, '');
  const hashParams = new URLSearchParams(hash.includes('=') ? hash : '');
  const search = pending.search ?? '';
  const queryParams = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);

  const access = hashParams.get('access_token');
  const refresh = hashParams.get('refresh_token');
  const type = hashParams.get('type') ?? queryParams.get('type') ?? '';
  if (access && refresh) {
    const { error } = await sb.auth.setSession({ access_token: access, refresh_token: refresh });
    if (error) return { error: authErrorPl(error.message) };
    return { recovery: type === 'recovery' };
  }

  // Cross-browser invite/recovery: token_hash z szablonu ConfirmationURL (bez code_verifier).
  const tokenHash = queryParams.get('token_hash') ?? hashParams.get('token_hash');
  if (tokenHash) {
    const otpType = (type || 'email') as 'invite' | 'recovery' | 'magiclink' | 'signup' | 'email';
    const { error } = await sb.auth.verifyOtp({ token_hash: tokenHash, type: otpType === 'invite' ? 'invite' : otpType === 'recovery' ? 'recovery' : 'email' });
    if (error) return { error: authErrorPl(error.message) };
    return { recovery: otpType === 'recovery' };
  }

  // PKCE: ?code=… (ta sama przeglądarka, która rozpoczęła flow).
  const code = queryParams.get('code');
  if (code) {
    const { error } = await sb.auth.exchangeCodeForSession(code);
    if (error) return { error: authErrorPl(error.message) };
    return { recovery: type === 'recovery' || /type=recovery/.test(search) };
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

/** wyglad/P10b-d: rodzaj linku z e-maila (`type=invite` / `type=recovery`) — krok 1 tylko przy zaproszeniu. */
function pendingLinkType(): 'invite' | 'recovery' | 'other' {
  try {
    const raw = sessionStorage.getItem(LINK_KEY);
    const p = raw ? (JSON.parse(raw) as { hash?: string; search?: string }) : null;
    const m = /[?&#]type=([a-z_]+)/.exec(`${p?.hash ?? ''}&${p?.search ?? ''}`);
    return m?.[1] === 'invite' ? 'invite' : m?.[1] === 'recovery' ? 'recovery' : 'other';
  } catch {
    return 'other';
  }
}

function pendingLink(): PendingLink {
  try {
    const raw = sessionStorage.getItem(LINK_KEY);
    return raw ? (JSON.parse(raw) as { hash?: string; search?: string }) : null;
  } catch {
    return null;
  }
}

/** wyglad/P10b-d (E37 pkt 9, krok 1 z 4): kto zaprasza, firma, konto, „Dalej — ustaw hasło” (ochrona przed skanerami). */
function InviteStepContainer({ onContinue, onCancel }: { onContinue: () => void; onCancel: () => void }) {
  const locale = useTowerStore((s) => s.locale);
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    void inviteInfo(pendingLink()).then((i) => { if (alive) setInfo(i); }).catch(() => {});
    return () => { alive = false; };
  }, []);
  return <InviteStep locale={locale} brand={<Brand />} pos={{ n: 1, total: 4 }} info={info} busy={busy} onContinue={() => { setBusy(true); onContinue(); }} onCancel={onCancel} />;
}

function LinkPendingScreen({ onContinue, onCancel }: { onContinue: () => void; onCancel: () => void }) {
  const locale = useTowerStore((s) => s.locale);
  if (firstEntryReady() && pendingLinkType() === 'invite') return <InviteStepContainer onContinue={onContinue} onCancel={onCancel} />;
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
    // A3 (D-20261015-0300-01): bez sprawdzania konta po stronie klienta — zawsze ten sam komunikat.
    const mail = await sendRecoveryLink(addr, redirectTo());
    setBusy(false);
    /* wyglad/P10b-a (E37 pkt 7): zawsze ta sama odpowiedź — także „brak zaproszenia” (bez zdradzania, czy konto
       istnieje); własny tekst tylko przy zbyt wielu próbach i nieudanej wysyłce e-maila */
    const err = mail.error ? authErrorPl(mail.error) : '';
    const own = /Zbyt wiele prób|Nie udało się wysłać e-maila|Nieprawidłowy adres e-mail/.test(err);
    setMsg(own
      ? { ok: false, text: err }
      : { ok: true, text: p10bp(locale, 'p10b_reset_sent', { ttl: RECOVERY_LINK_TTL }) });
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
      setMsg({ ok: false, text: tp(locale, 'auth_pw_rule', { n: PASSWORD_MIN }) });
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

  /* wyglad/P10b-d (E37 pkt 9, krok 2 z 4): po zaproszeniu — ten sam zapis, ekran ścieżki pierwszego wejścia */
  if (firstEntryReady() && reason !== 'recovery') {
    return (
      <PasswordStep locale={locale} brand={<Brand />} pos={{ n: 2, total: 4 }}
        onSave={async (next) => {
          const sb = await getSupabase();
          const { error } = await sb.auth.updateUser({ password: next });
          if (error) return authErrorPl(error.message);
          const { error: markErr } = await sb.rpc('app_user_mark_password_set');
          if (markErr) return authErrorPl(markErr.message);
          onDone();
          return null;
        }} />
    );
  }

  return (
    <div className="auth-screen" data-auth="set-password">
      <section className="panel auth-card">
        <header className="panel-hd"><Brand /></header>
        <div className="panel-bd">
          <form className="auth-form" onSubmit={submit}>
            <b>{t(locale, reason === 'recovery' ? 'auth_set_pw_recovery' : 'auth_set_pw')}</b>
            <p className="auth-msg">{tp(locale, 'auth_set_pw_hint', { n: PASSWORD_MIN })}</p>
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

/** wyglad/P10b-a: ekran „Link wygasł” z informacją o linku (źródło p10bSource; produkcja do podłączenia). */
function ExpiredLinkContainer({ link, onForgot, onLogin }: { link: PendingLink; onForgot: () => void; onLogin: () => void }) {
  const locale = useTowerStore((s) => s.locale);
  const [info, setInfo] = useState<ExpiredLinkInfo | null>(null);
  useEffect(() => {
    let alive = true;
    void expiredLinkInfo(link).then((i) => { if (alive) setInfo(i); }).catch(() => {});
    return () => { alive = false; };
  }, [link]);
  return (
    <ExpiredLinkScreen
      brand={<Brand />}
      locale={locale}
      info={info}
      onResend={() => resendExpiredLink(link)}
      onForgot={onForgot}
      onLogin={onLogin}
    />
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
  const [state, setState] = useState<State>(() => {
    const expired = captureExpiredFromUrl();
    if (expired) return { kind: 'expired', link: expired };
    return (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(LINK_KEY)) || captureAuthLinkFromUrl()
      ? { kind: 'link-pending' }
      : { kind: 'loading' };
  });
  const [anonMode, setAnonMode] = useState<'login' | 'forgot'>('login');
  const [recoveryOnce, setRecoveryOnce] = useState(false);
  const loadRef = useRef<(session: Session | null, opts?: { forcePassword?: boolean }) => Promise<void>>(async () => {});
  /* Właściciel 21.10.2026 19:52: aplikacja nie przeładowuje się po powrocie na kartę.
     Klucz konta, którego dane są już na ekranie (logowanie + profil + widok); inny klucz = pełne ładowanie jak dotąd
     (F7 #403: „Działaj jako”, Podgląd, zmiana roli, zapis imienia/telefonu, wyłączenie konta). */
  const readyKeyRef = useRef<string | null>(null);

  useEffect(() => {
    let alive = true;
    let unsub: (() => void) | undefined;
    const load = async (session: Session | null, opts?: { forcePassword?: boolean }) => {
      /* każde wczytanie zaczyna od „nic nie jest gotowe” — klucz wraca tylko po dojściu do „ready” */
      const prevKey = readyKeyRef.current;
      readyKeyRef.current = null;
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
      /* F7 #403: błąd sieci przy cichym wczytaniu (np. telefon po wybudzeniu) — ekran zostaje, tylko komunikat */
      if (error && prevKey) { readyKeyRef.current = prevKey; useTowerStore.getState().pushToast(t(useTowerStore.getState().locale, 'a6_auth_bg_fail'), 'LOW'); return; }
      if (error || !p) { setAuthProfile(null); setState({ kind: 'noaccess', reason: t(useTowerStore.getState().locale, 'a6_auth_no_org') }); return; }
      if (!p.active) { setAuthProfile(null); setState({ kind: 'noaccess', reason: t(useTowerStore.getState().locale, 'a6_auth_deactivated') }); return; }
      /* B5 (0300): „acting_as” to albo Podgląd (tylko odczyt), albo „Działaj jako” — rozróżnia baza */
      if (p.acting_as) p.preview_ro = await previewRoOf(p);
      else if (p.role === 'HHL_ADMIN') await clearStalePreview();
      if (!alive) return;
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
      const profile = withSessionProfile(p, session);
      setAuthProfile(profile);
      const st = useTowerStore.getState();
      if (st.role !== viewRole) st.setRole(viewRole);
      /* to samo konto, profil i widok już na ekranie — tylko ciche odświeżenie danych (otwarty transport zostaje) */
      const key = [session.user.id, p.user_id, p.role, p.org_code, viewRole, p.acting_as ? 'as' : '', p.real_user_id ?? '',
        p.full_name ?? '', p.phone ?? '', p.email ?? '', p.active ? '1' : '0'].join('|');
      const silent = prevKey === key;
      if (alive && !silent) setState({ kind: 'loading' });
      try {
        const bridge = await import('../data/supabaseBridge');
        if (silent) await bridge.refreshFromServer({ keepSelection: true });
        else await bridge.connectSupabaseData(sb);
      } catch (e) {
        if (silent) { readyKeyRef.current = key; useTowerStore.getState().pushToast(t(useTowerStore.getState().locale, 'a6_auth_bg_fail'), 'LOW'); return; }
        if (alive) setState({ kind: 'noaccess', reason: t(useTowerStore.getState().locale, 'a6_auth_fetch_fail').replace('{err}', e instanceof Error ? e.message : String(e)) });
        return;
      }
      /* wyglad/P10b-d (E37 pkt 9): konto bez telefonu — krok 3 przy logowaniu */
      const first = firstEntryReady() && needsPhone(profile);
      if (!first && alive) readyKeyRef.current = key;
      if (alive) setState(first ? { kind: 'first-entry', session, profile, steps: ['details'], help: false } : { kind: 'ready', session, profile });
      /* C16 N6: odśwież zapis urządzenia push po zalogowaniu */
      void import('../lib/webPush').then((wp) => {
        void wp.syncWebPush();
        wp.listenWebPushResync();
      }).catch(() => {});
    };
    loadRef.current = load;

    void getSupabase().then(async (sb) => {
      if (state.kind === 'link-pending' || state.kind === 'expired') return; // czekamy na „Dalej” / ekran „Link wygasł”
      const { data } = await sb.auth.getSession();
      await load(data.session, recoveryOnce ? { forcePassword: true } : undefined);
      const { data: sub } = sb.auth.onAuthStateChange((event, session) => {
        if (event === 'PASSWORD_RECOVERY') {
          setRecoveryOnce(true);
          void load(session, { forcePassword: true });
          return;
        }
        /* Supabase zgłasza SIGNED_IN także po każdym powrocie na kartę (odzyskanie sesji). `load` sprawdza profil
           (wyłączenie konta, zmiana roli) i przy tym samym kluczu odświeża dane w tle, bez ekranu ładowania. */
        if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED' || event === 'MFA_CHALLENGE_VERIFIED') {
          void load(session, recoveryOnce ? { forcePassword: true } : undefined);
        }
      });
      unsub = () => sub.subscription.unsubscribe();
    }).catch((e: unknown) => alive && setState({ kind: 'noaccess', reason: authErrorPl(String(e)) }));
    return () => { alive = false; unsub?.(); };
    // link-pending / recoveryOnce — celowo: po Dalej przeładujemy efekt
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.kind === 'link-pending' ? 'pending' : state.kind === 'expired' ? 'expired' : 'go', recoveryOnce]);

  useEffect(() => {
    const onReload = (e: Event) => {
      const done = (e as CustomEvent<AuthReloadDetail | undefined>).detail?.done;
      void getSupabase().then(async (sb) => {
        const { data } = await sb.auth.getSession();
        await loadRef.current(data.session);
      }).catch(() => {}).finally(() => done?.());
    };
    window.addEventListener(AUTH_RELOAD_EVENT, onReload);
    return () => window.removeEventListener(AUTH_RELOAD_EVENT, onReload);
  }, []);

  useEffect(() => {
    if (state.kind !== 'ready') return;
    const locked = viewRoleForOrg(state.profile.org_code);
    /* B5 (D-20261019-1525-01): Podgląd innych widoków ma wyłącznie Administrator HHL — inne konta HHL (HHL_OPS)
       zostają w widoku HHL, także po zapamiętanym wcześniej Podglądzie */
    if (locked === 'HHL' && state.profile.role === 'HHL_ADMIN') return;
    const { org_code: org, role } = state.profile;
    return useTowerStore.subscribe((s) => {
      /* F7 #342 D3: po zmianie profilu (koniec „Działaj jako”) stara blokada nie cofa widoku nowego konta */
      const cur = getAuthProfile();
      if (!cur || cur.org_code !== org || cur.role !== role) return;
      if (locked && s.role !== locked) useTowerStore.getState().setRole(locked);
    });
  }, [state]);

  if (state.kind === 'loading') {
    return (
      <div className="auth-screen" data-auth="loading">
        <div className="auth-card panel">
          <BrandLogo className="auth-boot-logo" alt={t(locale, 'brand')} />
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
              /* wyglad/P10b-a (E37 pkt 7): wygasły link → ekran „Link wygasł” zamiast czerwonego komunikatu */
              setState(isExpiredLinkError(r.error) ? { kind: 'expired', link: r.link ?? null } : { kind: 'noaccess', reason: r.error });
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
                if (p.acting_as) p.preview_ro = await previewRoOf(p);
                setState({ kind: 'loading' });
                // trigger load via fake state flip
                setRecoveryOnce(false);
                const level = (await sb.auth.mfa.getAuthenticatorAssuranceLevel()).data ?? null;
                const step = mfaStep(level, await readMfaStatus(sb));
                if (step !== 'none') { setState({ kind: 'mfa', step }); return; }
                const profile = withSessionProfile(p, data.session);
                setAuthProfile(profile);
                const viewRole = viewRoleForOrg(p.org_code);
                if (viewRole) useTowerStore.getState().setRole(viewRole);
                try {
                  const bridge = await import('../data/supabaseBridge');
                  await bridge.connectSupabaseData(sb);
                  /* wyglad/P10b-d (E37 pkt 9): po haśle — kroki 3 i 4, potem Kokpit z „Jak pracuję” otwartym raz */
                  setState(firstEntryReady()
                    ? { kind: 'first-entry', session: data.session, profile, steps: ['details', 'notify'], help: true }
                    : { kind: 'ready', session: data.session, profile });
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

  if (state.kind === 'first-entry') {
    const { session, profile, steps, help } = state;
    const name = profile.first_name || profile.last_name
      ? { first: profile.first_name ?? '', last: profile.last_name ?? '' }
      : splitName(profile.full_name);
    const org = viewRoleForOrg(profile.org_code) ?? 'KSH';
    return (
      <FirstEntryFlow
        locale={locale}
        brand={<Brand />}
        steps={steps}
        numbered={steps.length > 1}
        kind={viewedKind(org, profile.role)}
        initial={{ ...name, phone: profile.phone ?? null }}
        missing={steps.length === 1}
        onSaveDetails={(d) => saveMyDetails(d) ?? Promise.resolve(false)}
        loadReceives={firstEntryReceives}
        onEnable={enableNotifications}
        onDone={(d) => {
          const next = d ? { ...profile, first_name: d.first, last_name: d.last, full_name: `${d.first} ${d.last}`, phone: d.phone } : profile;
          setAuthProfile(next);
          setState({ kind: 'ready', session, profile: next });
          if (help) requestHelpOnce();
        }}
      />
    );
  }

  if (state.kind === 'expired') {
    return (
      <ExpiredLinkContainer
        link={state.link}
        onForgot={() => { setAnonMode('forgot'); setState({ kind: 'loading' }); }}
        onLogin={() => { setAnonMode('login'); setState({ kind: 'loading' }); }}
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
