/**
 * M4 — „Ustawienia” (KSH, SCX): ten sam panel „Preferencje interfejsu” co w Opcjach HHL.
 * Bez nowego komponentu wizualnego — układ `options-page` / `options-grid`.
 */
import { useState } from 'react';
import { useTowerStore } from '../store/useTowerStore';
import { t } from '../i18n/messages';
import { UiPrefsPanel } from '../components/settings/UiPrefsPanel';

export function SettingsView() {
  const role = useTowerStore((s) => s.role);
  const locale = useTowerStore((s) => s.locale);
  const [saved, setSaved] = useState('');
  const saveMark = (label: string) => {
    setSaved(label);
    window.setTimeout(() => setSaved(''), 1600);
  };
  return (
    <div className="options-page">
      <header className="options-title">
        <div><div className="eyebrow">{role}</div><h1>{t(locale, 'nav_settings')}</h1><p>{t(locale, 'settings_subtitle')}</p></div>
        {saved ? <span className="pill p-go">{t(locale, 'opt_saved')} · {saved}</span> : null}
      </header>
      <div className="options-grid">
        <UiPrefsPanel onSaved={saveMark} subKey="settings_prefs_sub" noteKey="settings_prefs_note" />
      </div>
    </div>
  );
}
