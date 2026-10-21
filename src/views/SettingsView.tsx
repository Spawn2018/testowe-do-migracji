/**
 * Ustawienia (KSH, SCX) — wyglad/P3-c: ten sam układ co Opcje HHL (E11, E12 pkt 1: KSH i SCX tylko „Dla mnie”).
 * Ekrany: Moje konto (E37, E6), Co dostaję (E11), Wygląd i waluta, Instrukcja oraz
 * Pieniądze › Opłata paliwowa tylko do odczytu (I-13; decyzja właściciela 17.10.2026, 07:20 — 5B: KSH i SCX widzą ją
 * tylko do odczytu, w demo i na produkcji; zmienia E12 pkt 1). Produkcja — ten sam ekran z danymi z bazy (`LiveFuel`, wersje z `SefsReadOnly` rozwijane pod nim), demo — ekran E39 bez zapisu.
 */
import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { useTowerStore } from '../store/useTowerStore';
import { t } from '../i18n/messages';
import { UiPrefsPanel } from '../components/settings/UiPrefsPanel';
import { SUPABASE_AUTH_ENABLED } from '../auth/config';
import { OPEN_OPTIONS_EVENT, optScreenOf, takeOptionsScreen, type OptionsScreen } from '../lib/openOptions';
import { OptionsShell } from '../components/options/OptionsShell';
import type { AccountKind, OptGroup, OptScreen, OptScreenId } from '../components/options/types';
import { useDemoOptions } from '../components/options/useDemoOptions';
import { ForMeScreen } from '../components/options/ForMeScreen';
import { DeviceScreen } from '../components/options/DeviceScreen';
import { myNotifyOf, useLiveNotify } from '../lib/forMeSource';
import { NOTIFY_CATALOG } from '../lib/notifyCatalog';
import { fuelScreenOf } from '../lib/p5bSource';
import { DEMO_EXAMPLE_BASE_EUR } from '../lib/p5bDemo';
import { getNowIso } from '../lib/frozenNow';
import { localDateOf } from '../lib/money/engine';
import { lazyRetry } from '../lib/lazyRetry';
import { accountRole } from '../lib/accountRole';

/* I-13: parametry SEFS tylko do odczytu (zakres wg RLS) — wyłącznie produkcja */
/* 5B (W-opcje-live-2): na produkcji ekran z audytu z danymi z bazy (tylko odczyt, bez spraw HHL) */
const LiveFuel = import.meta.env.VITE_AUTH_MODE === 'supabase' && SUPABASE_AUTH_ENABLED ? lazy(lazyRetry(() => import('../auth/LiveFuel'))) : null;
/** D-20261014-0700-01 J3 pkt 1: Moje konto KSH/SCX (Podgląd = tylko odczyt w LiveAccountScreen). */
const LiveAccount = import.meta.env.VITE_AUTH_MODE === 'supabase' && SUPABASE_AUTH_ENABLED ? lazy(lazyRetry(() => import('../auth/LiveAccountScreen'))) : null;

/* 5B (17.10): demo — ten sam ekran „Opłata paliwowa” co w Opcjach HHL, tylko do odczytu */
const FuelScreen = lazy(lazyRetry(() => import('../components/options/MoneyScreens').then((m) => ({ default: m.FuelScreen }))));

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

  const profileRole = accountRole(role);
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
  /* P11 (e12, 5B): „Dla mnie” pierwsza (Moje konto na starcie), Pieniądze › Opłata paliwowa (tylko odczyt) niżej */
  groups.push({ id: 'forme', screens: forme, summary: demo?.summaries.forme?.text });
  const fuelDemo = LiveFuel ? null : fuelScreenOf(localDateOf(getNowIso()), getNowIso());
  if (role === 'KSH' || role === 'SCX') {
    if (LiveFuel) groups.push({ id: 'money', screens: [{ id: 'fuel', right: 'read', body: block(<LiveFuel readOnly party={role} />) }] });
    else if (fuelDemo) {
      /* F7 (17.10): przykład opłaty na własnej stawce — KSH stawka KSH (przychód HHL), SCX stawka SCX; bez spraw HHL */
      const view = { ...fuelDemo, exampleBaseEur: role === 'KSH' ? DEMO_EXAMPLE_BASE_EUR.rev : DEMO_EXAMPLE_BASE_EUR.cost };
      groups.push({ id: 'money', screens: [{ id: 'fuel', right: 'read', body: block(<FuelScreen locale={locale} view={view} actions={null} readOnly party={role} />) }] });
    }
  }

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
