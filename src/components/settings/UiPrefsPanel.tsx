/**
 * M4 — panel „Preferencje interfejsu” (wzorzec z Opcji HHL, użyty ponownie we wszystkich rolach).
 * Język, waluta wyświetlania, motyw — ustawienia KAŻDEGO użytkownika (Q12).
 * Q-9 B: motyw systemu albo jasny/ciemny ręcznie.
 */
import { useEffect, useState } from 'react';
import { useTowerStore } from '../../store/useTowerStore';
import { SUPABASE_AUTH_ENABLED } from '../../auth/config';
import { t } from '../../i18n/messages';

export function UiPrefsPanel({ onSaved, showDemoMarks: showDemoToggle, subKey = 'opt_defaults', noteKey = 'opt_theme_note' }: { onSaved: (label: string) => void; showDemoMarks?: boolean; subKey?: string; noteKey?: string }) {
  const locale = useTowerStore((s) => s.locale);
  const theme = useTowerStore((s) => s.theme);
  const themeManual = useTowerStore((s) => s.themeManual);
  const displayCurrency = useTowerStore((s) => s.displayCurrency);
  const setLocale = useTowerStore((s) => s.setLocale);
  const setDisplayCurrency = useTowerStore((s) => s.setDisplayCurrency);
  const setThemePreference = useTowerStore((s) => s.setThemePreference);
  const showDemoMarks = useTowerStore((s) => s.showDemoMarks);
  const setShowDemoMarks = useTowerStore((s) => s.setShowDemoMarks);
  const themeValue = themeManual ? theme : 'system';
  const live = import.meta.env.VITE_AUTH_MODE === 'supabase' && SUPABASE_AUTH_ENABLED;
  const [pushOn, setPushOn] = useState(true);
  const [pushMsg, setPushMsg] = useState<string | null>(null);
  const [iosHint, setIosHint] = useState(false);
  useEffect(() => {
    if (!live) return;
    void import('../../lib/webPush').then(({ isIosSafari, isStandalonePwa }) => {
      setIosHint(isIosSafari() && !isStandalonePwa());
    });
  }, [live]);
  return (
    <section className="panel option-panel">
      <header className="panel-hd"><h2>{t(locale, 'opt_ui_prefs')}</h2><span className="sub">{t(locale, subKey)}</span></header>
      <div className="panel-bd"><dl className="kv options-kv">
        {showDemoToggle ? <><dt>{t(locale, 'opt_demo_marks')}</dt><dd><label className="switchline"><input type="checkbox" checked={showDemoMarks} onChange={(e) => { setShowDemoMarks(e.target.checked); onSaved('demo'); }} /><span>{showDemoMarks ? t(locale, 'on') : t(locale, 'off')}</span></label><div className="muted" style={{ marginTop: 4 }}>{t(locale, 'opt_demo_marks_sub')}</div></dd></> : null}
        <dt>{t(locale, 'opt_lang')}</dt><dd><select className="input" aria-label={t(locale, 'opt_lang')} value={locale} onChange={(e) => { setLocale(e.target.value as 'pl' | 'en' | 'sv'); onSaved('język'); }}><option value="pl">Polski</option><option value="en">English</option><option value="sv">Svenska</option></select></dd>
        <dt>{t(locale, 'opt_currency')}</dt><dd data-deur-exempt="currency-pref" title={t(locale, 'a6_opt_deur_cur')}><select className="input" aria-label={t(locale, 'opt_currency')} value={displayCurrency} onChange={(e) => { setDisplayCurrency(e.target.value as 'EUR' | 'PLN'); onSaved('waluta'); }}><option value="PLN">PLN</option><option value="EUR">EUR</option></select></dd>
        <dt>{t(locale, 'opt_theme')}</dt><dd><select className="input" aria-label={t(locale, 'opt_theme')} value={themeValue} onChange={(e) => { const v = e.target.value as 'system' | 'dark' | 'light'; setThemePreference(v); onSaved('motyw'); }}><option value="system">{t(locale, 'opt_theme_system')}</option><option value="dark">{t(locale, 'opt_theme_dark')}</option><option value="light">{t(locale, 'opt_theme_light')}</option></select></dd>
        <dt>{t(locale, 'opt_theme_default')}</dt><dd className="muted">{t(locale, 'opt_theme_system_note')}</dd>
        {live ? (
          <>
            <dt>{t(locale, 'q11b_push')}</dt>
            <dd>
              <label className="switchline">
                <input
                  type="checkbox"
                  checked={pushOn}
                  onChange={(e) => {
                    const on = e.target.checked;
                    setPushOn(on);
                    void (async () => {
                      const wp = await import('../../lib/webPush');
                      if (on) {
                        const r = await wp.enableWebPush();
                        setPushMsg(r.ok ? t(locale, 'q11b_on') : `${t(locale, 'q11b_fail')}: ${r.reason}`);
                      } else {
                        await wp.disableWebPush();
                        setPushMsg(t(locale, 'q11b_off'));
                      }
                      onSaved('push');
                    })();
                  }}
                />
                <span>{pushOn ? t(locale, 'on') : t(locale, 'off')}</span>
              </label>
              {iosHint ? <div className="muted" style={{ marginTop: 6 }} data-q11b-ios>{t(locale, 'q11b_ios_hint')}</div> : null}
              {pushMsg ? <div className="muted" style={{ marginTop: 4 }}>{pushMsg}</div> : null}
            </dd>
          </>
        ) : null}
      </dl><div className="note option-note" data-deur-exempt="currency-pref" title={t(locale, 'a6_opt_deur_curnote')}>{t(locale, noteKey)}</div></div>
    </section>
  );
}
