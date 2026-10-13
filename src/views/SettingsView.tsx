/**
 * M4 — „Ustawienia” (KSH, SCX): ten sam panel „Preferencje interfejsu” co w Opcjach HHL.
 * Bez nowego komponentu wizualnego — układ `options-page` / `options-grid`.
 */
import { lazy, Suspense, useEffect, useState } from 'react';
import { useTowerStore } from '../store/useTowerStore';
import { t } from '../i18n/messages';
import { UiPrefsPanel } from '../components/settings/UiPrefsPanel';
import { SUPABASE_AUTH_ENABLED } from '../auth/config';
import { OPEN_OPTIONS_EVENT, scrollToScreen, takeOptionsScreen, type OptionsScreen } from '../lib/openOptions';

const Guide = import.meta.env.VITE_AUTH_MODE === 'supabase' && SUPABASE_AUTH_ENABLED ? lazy(() => import('../components/guide/Guide')) : null;
/* I-13: parametry SEFS tylko do odczytu (zakres wg RLS) — wyłącznie produkcja */
const CarrierScorecard = import.meta.env.VITE_AUTH_MODE === 'supabase' && SUPABASE_AUTH_ENABLED ? lazy(() => import('../auth/CarrierScorecard')) : null;
const SefsReadOnly = import.meta.env.VITE_AUTH_MODE === 'supabase' && SUPABASE_AUTH_ENABLED ? lazy(() => import('../auth/SefsReadOnly')) : null;

export function SettingsView() {
  const role = useTowerStore((s) => s.role);
  const locale = useTowerStore((s) => s.locale);
  const [saved, setSaved] = useState('');
  const saveMark = (label: string) => {
    setSaved(label);
    window.setTimeout(() => setSaved(''), 1600);
  };
  useEffect(() => {
    const go = (screen: OptionsScreen | null) => {
      if (!screen) return;
      scrollToScreen(screen === 'my-account' ? '[data-auth="my-account"]' : '[data-screen="for-me"]');
    };
    go(takeOptionsScreen());
    const onOpen = () => go(takeOptionsScreen());
    window.addEventListener(OPEN_OPTIONS_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_OPTIONS_EVENT, onOpen);
  }, []);
  return (
    <div className="options-page">
      <header className="options-title">
        <div><div className="eyebrow">{role}</div><h1>{t(locale, 'nav_settings')}</h1><p>{t(locale, 'settings_subtitle')}</p></div>
        {saved ? <span className="pill p-go">{t(locale, 'opt_saved')} · {saved}</span> : null}
      </header>
      <div className="options-grid">
        <UiPrefsPanel onSaved={saveMark} subKey="settings_prefs_sub" noteKey="settings_prefs_note" />
        {SefsReadOnly && (role === 'KSH' || role === 'SCX') && <Suspense fallback={null}><SefsReadOnly /></Suspense>}
        {CarrierScorecard && role === 'SCX' && <Suspense fallback={null}><CarrierScorecard /></Suspense>}
        {Guide && <Suspense fallback={null}><Guide locale={locale} role={role === 'KSH' ? 'ksh' : role === 'SCX' ? 'scx' : 'hhl'} /></Suspense>}
      </div>
    </div>
  );
}
