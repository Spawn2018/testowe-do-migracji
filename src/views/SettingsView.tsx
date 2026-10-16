/**
 * Ustawienia (KSH, SCX) — wyglad/P3-c: ten sam układ co Opcje HHL (E11, E12 pkt 1: KSH i SCX tylko „Dla mnie”).
 * Ekrany: Moje konto (E37, E6), Co dostaję (E11), Wygląd i waluta, Instrukcja; na produkcji także
 * Pieniądze › Opłata paliwowa tylko do odczytu (I-13; pełny ekran E39 — P5).
 */
import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { useTowerStore } from '../store/useTowerStore';
import { t } from '../i18n/messages';
import { UiPrefsPanel } from '../components/settings/UiPrefsPanel';
import { SUPABASE_AUTH_ENABLED } from '../auth/config';
import { getAuthProfile } from '../auth/profile';
import { OPEN_OPTIONS_EVENT, optScreenOf, takeOptionsScreen, type OptionsScreen } from '../lib/openOptions';
import { OptionsShell } from '../components/options/OptionsShell';
import type { AccountKind, OptGroup, OptScreen, OptScreenId } from '../components/options/types';
import { useDemoOptions } from '../components/options/useDemoOptions';
import { ForMeScreen } from '../components/options/ForMeScreen';
import { DeviceScreen } from '../components/options/DeviceScreen';
import { myNotifyOf, useLiveNotify } from '../lib/forMeSource';
import { NOTIFY_CATALOG } from '../lib/notifyCatalog';

/* I-13: parametry SEFS tylko do odczytu (zakres wg RLS) — wyłącznie produkcja */
const SefsReadOnly = import.meta.env.VITE_AUTH_MODE === 'supabase' && SUPABASE_AUTH_ENABLED ? lazy(() => import('../auth/SefsReadOnly')) : null;
/** D-20261014-0700-01 J3 pkt 1: Moje konto KSH/SCX (Podgląd = tylko odczyt w LiveAccountScreen). */
const LiveAccount = import.meta.env.VITE_AUTH_MODE === 'supabase' && SUPABASE_AUTH_ENABLED ? lazy(() => import('../auth/LiveAccountScreen')) : null;

function block(el: ReactNode) {
  return <Suspense fallback={null}>{el}</Suspense>;
}

export function SettingsView() {
  const role = useTowerStore((s) => s.role);
  const locale = useTowerStore((s) => s.locale);
  const [saved, setSaved] = useState('');
  const saveMark = (label: string) => {
    setSaved(label);
    window.setTimeout(() => setSaved(''), 1600);
  };
  const [request, setRequest] = useState<{ screen: OptScreenId; seq: number } | null>(null);
  useEffect(() => {
    const go = (screen: OptionsScreen | null) => {
      if (!screen) return;
      setRequest((r) => ({ screen: optScreenOf(screen), seq: (r?.seq ?? 0) + 1 }));
    };
    go(takeOptionsScreen());
    const onOpen = () => go(takeOptionsScreen());
    window.addEventListener(OPEN_OPTIONS_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_OPTIONS_EVENT, onOpen);
  }, []);

  const profileRole = getAuthProfile()?.role;
  const kind: AccountKind = role === 'KSH'
    ? 'CLIENT_USER'
    : profileRole === 'CARRIER_USER' ? 'CARRIER_USER' : 'CARRIER_DISPATCH';
  /* wyglad/audyt-E (W47 — właściciel 16.10, 13:58 i 14:09): KSH i SCX same ustawiają swoje powiadomienia w Co dostaję */
  const demo = useDemoOptions(locale, { kind, readOnly: true, my: myNotifyOf(kind) });
  const live = useLiveNotify(kind);
  const noSource = <div className="note option-note">{t(locale, 'p3c_no_source')}</div>;

  const forme: OptScreen[] = [
    { id: 'account', right: 'own', body: demo?.bodies.account ?? (LiveAccount ? block(<LiveAccount />) : noSource) },
    { id: 'forme', right: 'own', body: demo?.bodies.forme ?? (live
      ? <ForMeScreen locale={locale} kind={kind} groups={NOTIFY_CATALOG} prefs={live.prefs} onSave={live.save} />
      : <ForMeScreen locale={locale} kind={null} groups={null} />) },
    {
      id: 'look',
      right: 'own',
      body: (
        <>
          <UiPrefsPanel onSaved={saveMark} subKey="settings_prefs_sub" noteKey="settings_prefs_note" />
          {/* wyglad/J4: ocena przewoźnika przeniesiona do Kokpitu SCX (E11/E12) */}
        </>
      ),
    },
    { id: 'device', right: 'own', body: <DeviceScreen locale={locale} /> },
  ];
  /* wyglad/P10b-b (E37 pkt 3): „Instrukcja” znika z Opcji i Ustawień — zastępuje ją Pomoc („?”, menu konta) */

  const groups: OptGroup[] = [];
  if (SefsReadOnly && (role === 'KSH' || role === 'SCX')) {
    groups.push({ id: 'money', screens: [{ id: 'fuel', right: 'read', body: block(<SefsReadOnly />) }] });
  }
  groups.push({ id: 'forme', screens: forme, summary: demo?.summaries.forme?.text });

  const firm = role === 'KSH' ? 'KSH' : 'SCX';
  return (
    <div className="options-page" data-page="settings" data-p3c="shell">
      <OptionsShell
        locale={locale}
        rootKey="p3c_settings"
        who={`${firm} · ${t(locale, `p3c_kind_${kind}`).toLowerCase()}`}
        groups={groups}
        request={request}
        saved={saved ? <span className="pill p-go">{t(locale, 'opt_saved')} · {saved}</span> : null}
      />
    </div>
  );
}
