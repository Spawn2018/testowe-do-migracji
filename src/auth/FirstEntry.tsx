/**
 * wyglad/P10b-d — pierwsze wejście (E37 pkt 9, makieta `makiety_html/E37/pasek.html` „Po zmianie · telefon · zaproszona
 * osoba”): 1 Zaproszenie, 2 Hasło, 3 Twoje dane (telefon wymagany), 4 Powiadomienia i telefon; potem Kokpit z „Jak
 * pracuję” otwartym raz. Krok 4 można pominąć („Zaczynam” bez włączania). Konto bez telefonu dostaje sam krok 3 przy
 * następnym logowaniu. Ekrany tylko pokazują — zapisy przychodzą z zewnątrz (`firstEntrySource.ts`, logowanie w AuthGate).
 */
import { BrandLogo } from './BrandLogo';
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import type { Locale } from '../types';
import { fe, fep } from '../i18n/first';
import { ft } from '../i18n/p6f';
import { PASSWORD_MIN } from './config';
import { useTowerStore } from '../store/useTowerStore';
import { INVITE_STEPS, phoneE164, phoneParts, platformOf, pwCheck, receivesSummary, stepNumber, type FirstStep } from '../lib/firstEntry';
import type { MatrixGroup } from '../components/options/channels';
import type { AccountKind } from '../lib/cockpitE9';
import type { InviteInfo, NotifyResult } from '../lib/firstEntrySource';
import type { PhoneCountry } from '../lib/phoneNational';
import { useInstallState } from '../lib/installPrompt';
import './first.css';

type Pos = { n: number; total: number } | null;

/** Logo i projekt — jak na ekranie logowania. */
export function FirstBrand() {
  return (
    <div className="brand auth-brand">
      <BrandLogo alt="Watch Tower" />
      <span>Stegra Boden · H&amp;H Logistics</span>
    </div>
  );
}

function Shell({ brand, step, children }: { brand: ReactNode; step: FirstStep; children: ReactNode }) {
  return (
    <div className="auth-screen fe" data-auth="first-entry" data-fe-step={step}>
      <section className="panel auth-card">
        <header className="panel-hd">{brand}</header>
        <div className="panel-bd auth-form">{children}</div>
      </section>
    </div>
  );
}

function Head({ locale, pos, title }: { locale: Locale; pos: Pos; title: string }) {
  return (
    <div className="fe-head">
      {pos ? (
        <div className="fe-steps" role="img" aria-label={fep(locale, 'fe_steps_aria', pos)}>
          <span className="fe-steps-n" data-fe-pos>{fep(locale, 'fe_step', pos)}</span>
          <span className="fe-steps-bar" aria-hidden="true">
            {Array.from({ length: pos.total }, (_, i) => <i key={i} className={i < pos.n ? 'is-on' : undefined} />)}
          </span>
        </div>
      ) : null}
      <b className="auth-title" data-fe-title>{title}</b>
    </div>
  );
}

/* ── 1 · Zaproszenie ─────────────────────────────────────────────────────────────── */

export function InviteStep({ locale, brand, pos, info, busy, onContinue, onCancel }: {
  locale: Locale; brand: ReactNode; pos: Pos; info: InviteInfo | null; busy?: boolean; onContinue: () => void; onCancel: () => void;
}) {
  return (
    <Shell brand={brand} step="invite">
      <Head locale={locale} pos={pos} title={fe(locale, 'fe_inv_title')} />
      <p className="auth-msg fe-lead" data-fe-lead>
        {info ? fep(locale, 'fe_inv_by', { who: info.inviter, company: info.inviterCompany }) : fe(locale, 'fe_inv_general')}
      </p>
      {info ? (
        <dl className="fe-dl" data-fe-invite>
          <dt>{fe(locale, 'fe_inv_person')}</dt><dd>{info.person}</dd>
          <dt>{fe(locale, 'fe_inv_company')}</dt><dd>{info.company}</dd>
          <dt>{fe(locale, 'fe_inv_account')}</dt><dd>{info.account}</dd>
        </dl>
      ) : null}
      <button className="btn fe-btn" type="button" data-fe-next disabled={busy} onClick={onContinue}>{fe(locale, 'fe_inv_next')}</button>
      <p className="auth-msg auth-note">{fe(locale, 'fe_inv_note')}</p>
      <button className="btn ghost fe-btn" type="button" data-fe-cancel onClick={onCancel}>{fe(locale, 'fe_inv_cancel')}</button>
    </Shell>
  );
}

/* ── 2 · Hasło ───────────────────────────────────────────────────────────────────── */

function PwInput({ id, label, value, onChange, locale, children }: { id: string; label: string; value: string; onChange: (v: string) => void; locale: Locale; children?: ReactNode }) {
  const [show, setShow] = useState(false);
  return (
    <label htmlFor={id}>{label}
      <div className="auth-pw-wrap">
        <input id={id} className="input full" type={show ? 'text' : 'password'} required minLength={PASSWORD_MIN} autoComplete="new-password"
          value={value} onChange={(e) => onChange(e.target.value)} />
        <button className="chipbtn auth-pw-toggle fe-show" type="button" onClick={() => setShow((s) => !s)} aria-pressed={show}>
          {fe(locale, show ? 'fe_pw_hide' : 'fe_pw_show')}
        </button>
      </div>
      {children}
    </label>
  );
}

/** `onSave` zwraca komunikat błędu albo `null` (zapisane). */
export function PasswordStep({ locale, brand, pos, onSave }: {
  locale: Locale; brand: ReactNode; pos: Pos; onSave: (pw: string) => Promise<string | null>;
}) {
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const chk = pwCheck(pw, PASSWORD_MIN);
  const same = pw2.length > 0 && pw2 === pw;
  /* wyglad/audyt-E (E-12): najpierw długość, potem brak cyfry albo litery */
  const pwMsg = fep(locale, chk.ok ? 'fe_pw_len_ok' : chk.len < PASSWORD_MIN ? 'fe_pw_len_short' : !chk.digit ? 'fe_pw_no_digit' : 'fe_pw_no_letter', { n: chk.len, min: PASSWORD_MIN });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!chk.ok) { setErr(pwMsg); return; }
    if (!same) { setErr(fe(locale, 'fe_pw_diff')); return; }
    setBusy(true); setErr(null);
    let msg: string | null = null;
    try { msg = await onSave(pw); } catch (x) { msg = x instanceof Error ? x.message : String(x); }
    setBusy(false);
    if (msg) setErr(msg);
  };

  return (
    <Shell brand={brand} step="password">
      <form className="auth-form" onSubmit={(e) => { void submit(e); }}>
        <Head locale={locale} pos={pos} title={fe(locale, 'fe_pw_title')} />
        <PwInput id="fe-pw" label={fe(locale, 'fe_pw')} value={pw} onChange={setPw} locale={locale}>
          <span className={`fe-check${pw ? (chk.ok ? ' is-ok' : ' is-bad') : ''}`} data-fe-pwlen>
            {pw ? pwMsg : fep(locale, 'fe_pw_len_empty', { min: PASSWORD_MIN })}
          </span>
        </PwInput>
        <PwInput id="fe-pw2" label={fe(locale, 'fe_pw_repeat')} value={pw2} onChange={setPw2} locale={locale}>
          {pw2 ? <span className={`fe-check ${same ? 'is-ok' : 'is-bad'}`} data-fe-pwsame>{same ? `✓ ${fe(locale, 'fe_pw_same')}` : fe(locale, 'fe_pw_diff')}</span> : null}
        </PwInput>
        <button className="btn fe-btn" type="submit" data-fe-next disabled={busy || !pw || !pw2}>{fe(locale, busy ? 'fe_pw_saving' : 'fe_pw_save')}</button>
        {err ? <div className="auth-msg err" role="alert">{err}</div> : null}
        <p className="auth-msg auth-note">{fe(locale, 'fe_pw_note')}</p>
      </form>
    </Shell>
  );
}

/* ── 3 · Twoje dane ──────────────────────────────────────────────────────────────── */

export type MyDetails = { first: string; last: string; phone: string };

export function DetailsStep({ locale, brand, pos, initial, missing, onSave }: {
  locale: Locale; brand: ReactNode; pos: Pos; initial: { first: string; last: string; phone: string | null };
  /** Logowanie konta bez telefonu (sam krok 3). */
  missing?: boolean;
  /** `true` = zapisane. */
  onSave: (d: MyDetails) => Promise<boolean>;
}) {
  const parts = phoneParts(initial.phone);
  const [first, setFirst] = useState(initial.first);
  const [last, setLast] = useState(initial.last);
  const [cc, setCc] = useState<PhoneCountry>(parts.country);
  const [num, setNum] = useState(parts.national);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!first.trim() || !last.trim()) { setErr(fe(locale, 'fe_det_name_bad')); return; }
    const phone = phoneE164(cc, num);
    if (!phone) { setErr(fe(locale, 'fe_det_phone_bad')); return; }
    setBusy(true); setErr(null);
    let ok = false;
    try { ok = await onSave({ first: first.trim(), last: last.trim(), phone }); } catch { ok = false; }
    setBusy(false);
    if (!ok) setErr(fe(locale, 'fe_det_fail'));
  };

  return (
    <Shell brand={brand} step="details">
      <form className="auth-form" onSubmit={(e) => { void submit(e); }} noValidate>
        <Head locale={locale} pos={pos} title={fe(locale, 'fe_det_title')} />
        {missing ? <p className="auth-msg fe-lead" data-fe-missing>{fe(locale, 'fe_det_missing')}</p> : null}
        <div className="fe-row2">
          <label>{fe(locale, 'fe_det_first')}<input className="input full" autoComplete="given-name" value={first} onChange={(e) => setFirst(e.target.value)} data-fe-first /></label>
          <label>{fe(locale, 'fe_det_last')}<input className="input full" autoComplete="family-name" value={last} onChange={(e) => setLast(e.target.value)} data-fe-last /></label>
        </div>
        <fieldset className="fe-phone">
          <legend>{fe(locale, 'fe_det_phone')}</legend>
          <div className="fe-phone-row">
            <select className="input" aria-label={fe(locale, 'fe_det_cc')} value={cc} onChange={(e) => setCc(e.target.value as PhoneCountry)} data-fe-cc>
              <option value="PL">{fe(locale, 'fe_det_cc_PL')}</option>
              <option value="SE">{fe(locale, 'fe_det_cc_SE')}</option>
            </select>
            <input className="input full" type="tel" inputMode="tel" autoComplete="tel-national" aria-label={fe(locale, 'fe_det_number')}
              value={num} onChange={(e) => setNum(e.target.value)} data-fe-phone />
          </div>
          <span className="auth-msg auth-note">{fe(locale, 'fe_det_phone_note')}</span>
        </fieldset>
        <button className="btn fe-btn" type="submit" data-fe-next disabled={busy}>{fe(locale, busy ? 'fe_det_saving' : pos ? 'fe_det_next' : 'fe_det_save')}</button>
        {err ? <div className="auth-msg err" role="alert" data-fe-err>{err}</div> : null}
      </form>
    </Shell>
  );
}

/* ── 4 · Powiadomienia i telefon ─────────────────────────────────────────────────── */

export function NotifyStep({ locale, brand, pos, kind, loadReceives, onEnable, onDone }: {
  locale: Locale; brand: ReactNode; pos: Pos; kind: AccountKind;
  loadReceives: () => Promise<MatrixGroup[] | null>;
  onEnable: () => Promise<NotifyResult>;
  onDone: () => void;
}) {
  const [groups, setGroups] = useState<MatrixGroup[] | null | undefined>(undefined);
  const [push, setPush] = useState<NotifyResult | 'busy' | null>(null);
  const platform = useMemo(() => (typeof navigator === 'undefined' ? 'desktop' : platformOf(navigator.userAgent, navigator.maxTouchPoints ?? 0)), []);
  const { state: inst, install } = useInstallState();
  const [installMsg, setInstallMsg] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void loadReceives().then((g) => { if (alive) setGroups(g); }).catch(() => { if (alive) setGroups(null); });
    return () => { alive = false; };
  }, [loadReceives]);

  const sum = groups ? receivesSummary(groups, kind) : null;
  const enable = async () => {
    setPush('busy');
    let r: NotifyResult = 'fail';
    try { r = await onEnable(); } catch { r = 'fail'; }
    setPush(r);
  };
  const pushMsg = push === 'ok' ? 'fe_nt_push_ok' : push === 'denied' ? 'fe_nt_push_denied' : push === 'unsupported' ? 'fe_nt_push_unsupported' : push === 'fail' ? 'fe_nt_push_fail' : null;

  return (
    <Shell brand={brand} step="notify">
      <Head locale={locale} pos={pos} title={fe(locale, 'fe_nt_title')} />
      {sum ? (
        sum.titles.length ? (
          <div className="fe-gets" data-fe-gets>
            <p className="auth-msg">{fe(locale, 'fe_nt_gets')}</p>
            <ul>{sum.titles.map((x) => <li key={x}>{x}</li>)}</ul>
            {sum.more ? <p className="auth-msg auth-note">{fep(locale, 'fe_nt_more', { n: sum.more })}</p> : null}
          </div>
        ) : <p className="auth-msg" data-fe-gets>{fe(locale, 'fe_nt_none')}</p>
      ) : null}
      <button className="btn ghost fe-btn fe-push" type="button" data-fe-push disabled={push === 'busy' || push === 'ok'} onClick={() => { void enable(); }}>
        {push === 'busy' ? fe(locale, 'fe_nt_push_busy') : fe(locale, platform === 'desktop' ? 'fe_nt_push_desk' : 'fe_nt_push_phone')}
      </button>
      {pushMsg ? <div className={`auth-msg ${push === 'ok' ? 'ok' : 'err'}`} role="status" data-fe-push-msg>{fe(locale, pushMsg)}</div> : null}
      <div className="fe-install" data-fe-install={platform}>
        {inst === 'app' ? <p className="auth-msg ok">{fe(locale, 'fe_nt_app')}</p>
          : inst === 'installed' ? <p className="auth-msg ok">{fe(locale, 'fe_nt_installed')}</p>
            : platform === 'ios' ? (
              <p className="auth-msg">{fe(locale, 'fe_nt_ios_1')}<b>{fe(locale, 'fe_nt_ios_b')}</b>{fe(locale, 'fe_nt_ios_2')}</p>
            ) : install ? (
              <div className="fe-install-row">
                {platform === 'android' ? <span className="auth-msg">{fe(locale, 'fe_nt_android')}</span> : null}
                <button className="btn ghost fe-btn" type="button" data-fe-install-btn
                  onClick={() => { void install().then((ok) => setInstallMsg(ok ? null : ft('p6f_install_no'))); }}>{ft('p6f_install')}</button>
              </div>
            ) : platform === 'android' ? <p className="auth-msg">{fe(locale, 'fe_nt_android_menu')}</p> : null}
        {installMsg ? <p className="auth-msg auth-note">{installMsg}</p> : null}
      </div>
      <button className="btn fe-btn" type="button" data-fe-done onClick={onDone}>{fe(locale, 'fe_nt_start')}</button>
      <p className="auth-msg auth-note">{fe(locale, 'fe_nt_later')}</p>
    </Shell>
  );
}

/* ── Ścieżka ─────────────────────────────────────────────────────────────────────── */

/**
 * Kroki po kolei. `steps` — które pokazać; numeracja „n z 4” według pełnej ścieżki zaproszenia, gdy `numbered`
 * (logowanie bez telefonu: sam krok 3 bez numeru). Kroki 1–2 w produkcji pokazuje logowanie (AuthGate) — tu
 * przychodzą tylko 3–4; w demo cała ścieżka.
 */
export function FirstEntryFlow({
  locale, brand, steps, numbered, kind, invite, initial, missing,
  onInviteCancel, onPassword, onSaveDetails, loadReceives, onEnable, onDone,
}: {
  locale: Locale; brand: ReactNode; steps: readonly FirstStep[]; numbered: boolean; kind: AccountKind;
  invite?: InviteInfo | null; initial: { first: string; last: string; phone: string | null }; missing?: boolean;
  onInviteCancel?: () => void;
  onPassword?: (pw: string) => Promise<string | null>;
  onSaveDetails: (d: MyDetails) => Promise<boolean>;
  loadReceives: () => Promise<MatrixGroup[] | null>;
  onEnable: () => Promise<NotifyResult>;
  onDone: (d: MyDetails | null) => void;
}) {
  const [i, setI] = useState(0);
  const [saved, setSaved] = useState<MyDetails | null>(null);
  const step = steps[i];
  const pos = numbered ? stepNumber(step, INVITE_STEPS) : null;
  const next = (d: MyDetails | null = saved) => {
    if (i + 1 < steps.length) setI(i + 1);
    else onDone(d);
  };
  useEffect(() => { if (typeof window !== 'undefined') window.scrollTo(0, 0); }, [i]);

  if (step === 'invite') {
    return <InviteStep locale={locale} brand={brand} pos={pos} info={invite ?? null} onContinue={() => next()} onCancel={() => onInviteCancel?.()} />;
  }
  if (step === 'password') {
    return (
      <PasswordStep locale={locale} brand={brand} pos={pos}
        onSave={async (pw) => {
          const msg = onPassword ? await onPassword(pw) : null;
          if (!msg) next();
          return msg;
        }} />
    );
  }
  if (step === 'details') {
    return (
      <DetailsStep locale={locale} brand={brand} pos={pos} initial={initial} missing={missing}
        onSave={async (d) => {
          const ok = await onSaveDetails(d);
          if (ok) { setSaved(d); next(d); }
          return ok;
        }} />
    );
  }
  return <NotifyStep locale={locale} brand={brand} pos={pos} kind={kind} loadReceives={loadReceives} onEnable={onEnable} onDone={() => next()} />;
}
