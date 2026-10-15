/**
 * M4 — panel „Preferencje interfejsu” (wzorzec z Opcji HHL, użyty ponownie we wszystkich rolach).
 * Język, waluta wyświetlania, motyw — ustawienia KAŻDEGO użytkownika (Q12).
 * Q-9 B: motyw systemu albo jasny/ciemny ręcznie.
 */
import { useTowerStore } from '../../store/useTowerStore';
import { t } from '../../i18n/messages';

export function UiPrefsPanel({ onSaved, showDemoMarks: showDemoToggle, subKey = 'opt_defaults', noteKey = 'opt_theme_note' }: { onSaved: (label: string) => void; showDemoMarks?: boolean; subKey?: string; noteKey?: string }) {
  const locale = useTowerStore((s) => s.locale);
  const theme = useTowerStore((s) => s.theme);
  const themeManual = useTowerStore((s) => s.themeManual);
  const displayCurrency = useTowerStore((s) => s.displayCurrency);
  const setDisplayCurrency = useTowerStore((s) => s.setDisplayCurrency);
  const setThemePreference = useTowerStore((s) => s.setThemePreference);
  const showDemoMarks = useTowerStore((s) => s.showDemoMarks);
  const setShowDemoMarks = useTowerStore((s) => s.setShowDemoMarks);
  const themeValue = themeManual ? theme : 'system';
  return (
    <section className="panel option-panel" data-screen="for-me">
      <header className="panel-hd"><h2>{t(locale, 'opt_ui_prefs')}</h2><span className="sub">{t(locale, subKey)}</span></header>
      <div className="panel-bd"><dl className="kv options-kv">
        {showDemoToggle ? <><dt>{t(locale, 'opt_demo_marks')}</dt><dd><label className="switchline"><input type="checkbox" checked={showDemoMarks} onChange={(e) => { setShowDemoMarks(e.target.checked); onSaved('demo'); }} /><span>{showDemoMarks ? t(locale, 'on') : t(locale, 'off')}</span></label><div className="muted" style={{ marginTop: 4 }}>{t(locale, 'opt_demo_marks_sub')}</div></dd></> : null}
        {/* P8 — brak wyboru języka w UI */}
        <dt>{t(locale, 'opt_currency')}</dt><dd data-deur-exempt="currency-pref" title={t(locale, 'a6_opt_deur_cur')}><select className="input" aria-label={t(locale, 'opt_currency')} value={displayCurrency} onChange={(e) => { setDisplayCurrency(e.target.value as 'EUR' | 'PLN'); onSaved('waluta'); }}><option value="PLN">PLN</option><option value="EUR">EUR</option></select></dd>
        <dt>{t(locale, 'opt_theme')}</dt><dd><select className="input" aria-label={t(locale, 'opt_theme')} value={themeValue} onChange={(e) => { const v = e.target.value as 'system' | 'dark' | 'light'; setThemePreference(v); onSaved('motyw'); }}><option value="system">{t(locale, 'opt_theme_system')}</option><option value="dark">{t(locale, 'opt_theme_dark')}</option><option value="light">{t(locale, 'opt_theme_light')}</option></select></dd>
        <dt>{t(locale, 'opt_theme_default')}</dt><dd className="muted">{t(locale, 'opt_theme_system_note')}</dd>
        {/* E5: powiadomienia na telefon — Dla mnie › Ten telefon / komputer (DeviceScreen) */}
      </dl><div className="note option-note" data-deur-exempt="currency-pref" title={t(locale, 'a6_opt_deur_curnote')}>{t(locale, noteKey)}</div></div>
    </section>
  );
}
