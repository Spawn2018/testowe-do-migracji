/**
 * M4 — panel „Preferencje interfejsu” (wzorzec z Opcji HHL, użyty ponownie we wszystkich rolach).
 * Język, waluta wyświetlania, motyw — ustawienia KAŻDEGO użytkownika (Q12).
 * Tryb Supabase: zapis w `user_preferences` (write-through z akcji store).
 */
import { useTowerStore } from '../../store/useTowerStore';
import { defaultThemeForRole } from '../../lib/permissions';
import { t } from '../../i18n/messages';

export function UiPrefsPanel({ onSaved, showDemoMarks: showDemoToggle, subKey = 'opt_defaults', noteKey = 'opt_theme_note' }: { onSaved: (label: string) => void; showDemoMarks?: boolean; subKey?: string; noteKey?: string }) {
  const role = useTowerStore((s) => s.role);
  const locale = useTowerStore((s) => s.locale);
  const theme = useTowerStore((s) => s.theme);
  const displayCurrency = useTowerStore((s) => s.displayCurrency);
  const setLocale = useTowerStore((s) => s.setLocale);
  const setDisplayCurrency = useTowerStore((s) => s.setDisplayCurrency);
  const setTheme = useTowerStore((s) => s.setTheme);
  const showDemoMarks = useTowerStore((s) => s.showDemoMarks);
  const setShowDemoMarks = useTowerStore((s) => s.setShowDemoMarks);
  const roleDefaultDark = defaultThemeForRole(role) === 'dark';
  return (
    <section className="panel option-panel">
      <header className="panel-hd"><h2>{t(locale, 'opt_ui_prefs')}</h2><span className="sub">{t(locale, subKey)}</span></header>
      <div className="panel-bd"><dl className="kv options-kv">
        {showDemoToggle ? <><dt>{t(locale, 'opt_demo_marks')}</dt><dd><label className="switchline"><input type="checkbox" checked={showDemoMarks} onChange={(e) => { setShowDemoMarks(e.target.checked); onSaved('demo'); }} /><span>{showDemoMarks ? t(locale, 'on') : t(locale, 'off')}</span></label><div className="muted" style={{ marginTop: 4 }}>{t(locale, 'opt_demo_marks_sub')}</div></dd></> : null}
        <dt>{t(locale, 'opt_lang')}</dt><dd><select className="input" value={locale} onChange={(e) => { setLocale(e.target.value as 'pl' | 'en' | 'sv'); onSaved('język'); }}><option value="pl">Polski</option><option value="en">English</option><option value="sv">Svenska</option></select></dd>
        <dt>{t(locale, 'opt_currency')}</dt><dd data-deur-exempt="currency-pref" title="D-EUR-T: wybór waluty (wyjątek)"><select className="input" value={displayCurrency} onChange={(e) => { setDisplayCurrency(e.target.value as 'EUR' | 'PLN'); onSaved('waluta'); }}><option value="PLN">PLN</option><option value="EUR">EUR</option></select></dd>
        <dt>{t(locale, 'opt_theme')}</dt><dd><select className="input" value={theme} onChange={(e) => { setTheme(e.target.value as 'dark' | 'light'); onSaved('motyw'); }}><option value="dark">{t(locale, 'opt_theme_dark')}</option><option value="light">{t(locale, 'opt_theme_light')}</option></select></dd>
        <dt>{t(locale, 'opt_theme_default')}</dt><dd className="muted">{roleDefaultDark ? t(locale, 'opt_theme_dark_hhl') : t(locale, 'opt_theme_light')}</dd>
      </dl><div className="note option-note" data-deur-exempt="currency-pref" title="D-EUR-T: opis wyboru waluty (wyjątek)">{t(locale, noteKey)}</div></div>
    </section>
  );
}
