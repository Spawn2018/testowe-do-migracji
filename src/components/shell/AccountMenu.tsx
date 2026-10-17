/**
 * wyglad/P3 (E37 pkt 1–2, img/e37-after „Po zmianie”): konto po prawej stronie paska górnego.
 * Komputer: inicjały, imię i nazwisko, „firma · rodzaj”, ▼ → menu: Moje konto, Dla mnie, Pomoc, Jasny / ciemny, Wyloguj.
 * Telefon: same inicjały → menu: Moje konto, Pomoc, Podgląd (tylko HHL), Jasny / ciemny, Wyloguj.
 * Menu jest zawsze w drzewie (atrybut `hidden`, gdy zamknięte), żeby `#themeBtn` (uchwyt testów) istniał.
 * Dane konta czyta z profilu (logika Cursora); bez nowych zapisów.
 */
import { useEffect, useRef, useState } from 'react';
import { useTowerStore } from '../../store/useTowerStore';
import { hasKey, t } from '../../i18n/messages';
import { ROLE_META } from '../../lib/permissions';
import { canSwitchView } from '../../lib/prodFacade';
import { AUTH_RELOAD_EVENT, getAuthProfile, type AuthProfile } from '../../auth/profile';
import { markManualLogout } from '../../auth/sessionYear';
import { openOptionsScreen } from '../../lib/openOptions';
import type { Locale, RoleId } from '../../types';
import { formatListDateTime } from '../../lib/format';
import { getNow } from '../../lib/frozenNow';
import { groupPhone } from '../../lib/phoneDisplay';
import { OPEN_ACCOUNT_EVENT } from '../../lib/helpNav';
import { accountRole } from '../../lib/accountRole';
import { setDemoAccountKind, type DemoAccountKind } from '../../lib/demoAccount';

const PREVIEW_ROLES: RoleId[] = ['HHL', 'KSH', 'SCX'];
const DEMO_KIND: Record<RoleId, string> = { HHL: 'HHL_ADMIN', KSH: 'CLIENT_USER', SCX: 'CARRIER_DISPATCH' };
/** wyglad/W-konta: drugi rodzaj konta firmy w demo (E9 — widok „tylko do odczytu” Operacji HHL, Użytkownik SCX). */
const DEMO_KINDS: Partial<Record<RoleId, Array<{ kind: string; demo: DemoAccountKind | null }>>> = {
  HHL: [{ kind: 'HHL_ADMIN', demo: null }, { kind: 'HHL_OPS', demo: 'HHL_OPS' }],
  SCX: [{ kind: 'CARRIER_DISPATCH', demo: null }, { kind: 'CARRIER_USER', demo: 'CARRIER_USER' }],
};

function useProfile(): AuthProfile | null {
  const [p, setP] = useState<AuthProfile | null>(() => getAuthProfile());
  useEffect(() => {
    const sync = () => setP(getAuthProfile());
    sync();
    window.addEventListener(AUTH_RELOAD_EVENT, sync);
    return () => window.removeEventListener(AUTH_RELOAD_EVENT, sync);
  }, []);
  return p;
}

function personName(p: AuthProfile | null, locale: Locale): string {
  if (!p) return t(locale, 'p3a_acc_demo_name');
  const full = p.full_name?.trim() || [p.first_name, p.last_name].filter(Boolean).join(' ').trim();
  return full || p.email;
}

function initials(name: string): string {
  const words = name.replace(/@.*/, '').split(/[\s._-]+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return (words[0] ?? '?').slice(0, 2).toUpperCase();
}

/** „HHL · Operacje” (komputer, pod nazwiskiem). */
function kindShort(locale: Locale, userRole: string): string {
  const k = `p3a_kind_${userRole}`;
  return hasKey(locale, k) ? t(locale, k) : t(locale, `a6_role_${userRole}`);
}

/** „Operacje HHL” (nagłówek menu po nazwie firmy). */
function kindLong(locale: Locale, userRole: string): string {
  const k = `p3a_long_${userRole}`;
  return hasKey(locale, k) ? t(locale, k) : t(locale, `a6_role_${userRole}`);
}

/** „dziś, 07:58” albo „07.10, 18:20” (E21). */
function lastLogin(locale: Locale, iso: string): string {
  const at = formatListDateTime(iso);
  const today = formatListDateTime(getNow().toISOString()).split(', ')[0];
  const [day, time] = at.split(', ');
  return day === today && time ? `${t(locale, 'p3a_acc_today')}, ${time}` : at;
}

export function AccountMenu() {
  const locale = useTowerStore((s) => s.locale);
  const role = useTowerStore((s) => s.role);
  const setRole = useTowerStore((s) => s.setRole);
  const toggleTheme = useTowerStore((s) => s.toggleTheme);
  const profile = useProfile();
  const [open, setOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  /* wyglad/P10b-b (E37 pkt 3): krok Pomocy „Menu konta” / „Podgląd” (telefon) otwiera to menu */
  useEffect(() => {
    const onOpen = (e: Event) => {
      setOpen(true);
      setPreviewOpen(!!(e as CustomEvent<{ preview?: boolean }>).detail?.preview);
      btnRef.current?.focus();
    };
    window.addEventListener(OPEN_ACCOUNT_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_ACCOUNT_EVENT, onOpen);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) { setOpen(false); setPreviewOpen(false); }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); setPreviewOpen(false); btnRef.current?.focus(); }
    };
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const name = personName(profile, locale);
  const userRole = profile?.role ?? accountRole(role) ?? DEMO_KIND[role];
  const demoKinds = !profile && import.meta.env.VITE_AUTH_MODE !== 'supabase' ? DEMO_KINDS[role] : undefined;
  const orgName = profile?.org_name || ROLE_META[role].name;
  const contact = [
    profile?.phone ? t(locale, 'p3a_acc_tel').replace('{tel}', groupPhone(profile.phone)) : profile?.email ?? '',
    profile?.last_sign_in_at ? t(locale, 'p3a_acc_last').replace('{when}', lastLogin(locale, profile.last_sign_in_at)) : '',
  ].filter(Boolean).join(' · ');
  const switchView = canSwitchView();

  const close = () => {
    setOpen(false);
    setPreviewOpen(false);
  };
  const logout = () => {
    close();
    markManualLogout();
    if (import.meta.env.VITE_AUTH_MODE === 'supabase') {
      void import('../../auth/client').then(({ getSupabase }) => getSupabase()).then((sb) => sb.auth.signOut());
    }
  };

  return (
    <div className="acc-wrap" ref={ref}>
      <button
        ref={btnRef}
        type="button"
        className="acc-chip"
        id="accountBtn"
        data-auth={profile ? 'session' : undefined}
        aria-expanded={open}
        aria-controls="accountMenu"
        aria-label={t(locale, 'p3a_acc_open').replace('{name}', `${name}, ${kindShort(locale, userRole)}`)}
        onClick={() => { setOpen((v) => !v); setPreviewOpen(false); }}
      >
        <span className="acc-avatar" aria-hidden>{initials(name)}</span>
        <span className="acc-who">
          <b>{name}</b>
          <span>{kindShort(locale, userRole)}</span>
        </span>
        <span className="acc-caret" aria-hidden>▼</span>
      </button>
      <div className="acc-menu" id="accountMenu" role="group" aria-label={name} hidden={!open} data-acc-menu>
        <div className="acc-hd">
          <b>{name}</b>
          <span>{`${orgName} · ${kindLong(locale, userRole)}`}</span>
          {contact ? <small>{contact}</small> : null}
        </div>
        <button type="button" className="acc-row acc-row-desc" data-acc="my-account"
          onClick={() => { close(); openOptionsScreen('my-account'); }}>
          <span className="acc-lbl">{t(locale, 'p3a_acc_my')}</span>
          <span className="acc-hint">{t(locale, 'p3a_acc_my_hint')}</span>
          <span className="acc-chev" aria-hidden>›</span>
        </button>
        <button type="button" className="acc-row" data-acc="for-me"
          onClick={() => { close(); openOptionsScreen('for-me'); }}>
          <span className="acc-lbl">{t(locale, 'p3a_acc_forme')}</span>
          <span className="acc-hint">{t(locale, 'p3a_acc_forme_hint')}</span>
          <span className="acc-chev" aria-hidden>›</span>
        </button>
        <button type="button" className="acc-row" data-acc="help"
          onClick={() => { close(); window.dispatchEvent(new CustomEvent('wt-open-help')); }}>
          <span className="acc-lbl">{t(locale, 'p3a_acc_help')}</span>
          <span className="acc-hint">?</span>
          <span className="acc-chev" aria-hidden>›</span>
        </button>
        {switchView ? (
          <div className="acc-preview" data-acc="preview">
            <button type="button" className="acc-row" aria-expanded={previewOpen}
              onClick={() => setPreviewOpen((v) => !v)}>
              <span className="acc-lbl">{t(locale, 'p3a_acc_preview')}</span>
              <span className="acc-chev" aria-hidden>{previewOpen ? '‹' : '›'}</span>
            </button>
            {previewOpen ? (
              <div className="seg acc-seg" role="group" aria-label={t(locale, 'p3a_preview_lbl')} data-preview-seg>
                {PREVIEW_ROLES.map((r) => (
                  <button key={r} type="button" data-role={r} aria-pressed={role === r} title={ROLE_META[r].name}
                    onClick={() => { setRole(r); close(); }}>
                    {ROLE_META[r].short}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
        {demoKinds ? (
          <div className="acc-demo-kind" data-acc="demo-kind">
            <p className="acc-kind-hd">{t(locale, 'p3a_acc_kind')}</p>
            <div className="seg acc-seg" role="group" aria-label={t(locale, 'p3a_acc_kind')} data-demo-kind-seg>
              {demoKinds.map((k) => (
                <button key={k.kind} type="button" data-demo-kind={k.kind} aria-pressed={userRole === k.kind}
                  onClick={() => {
                    if (userRole === k.kind) { close(); return; }
                    setDemoAccountKind(k.demo);
                    /* przeładowanie: prawa konta czyta każdy ekran przy rysowaniu (accountRole) */
                    window.location.reload();
                  }}>
                  {t(locale, `p3a_kshort_${k.kind}`)}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        <button type="button" className="acc-row" id="themeBtn" data-acc="theme"
          aria-label={t(locale, 'p3a_acc_theme')}
          onClick={() => toggleTheme()}>
          <span className="acc-lbl">{t(locale, 'p3a_acc_theme')}</span>
          <span className="acc-hint">T</span>
          <span className="acc-chev" aria-hidden>›</span>
        </button>
        {profile ? (
          <button type="button" className="acc-row acc-out" data-acc="logout" onClick={logout}>
            <span className="acc-lbl">{t(locale, 'p3a_acc_logout')}</span>
          </button>
        ) : null}
      </div>
    </div>
  );
}
