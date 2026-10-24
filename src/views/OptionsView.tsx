import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useTowerStore } from '../store/useTowerStore';
import type { BafParams, FactoringOffer, Locale } from '../types';
import { formatPlNumber } from '../lib/format';
import { geofenceDisplayName, geofenceTypeLabel } from '../lib/enumLabels';
import { hasKey, t, tp } from '../i18n/messages';
import { DemoMark } from '../components/ui/DemoMark';
import { SUPABASE_AUTH_ENABLED } from '../auth/config';
import { UiPrefsPanel } from '../components/settings/UiPrefsPanel';
import { OptionsShell } from '../components/options/OptionsShell';
import type { OptGroup, OptScreen, OptScreenId, AccountKind } from '../components/options/types';
import { useDemoOptions } from '../components/options/useDemoOptions';
import { ForMeScreen } from '../components/options/ForMeScreen';
import { DeviceScreen } from '../components/options/DeviceScreen';
import { MessageTexts } from '../components/options/MessageTexts';
import { SmsPlaces } from '../components/options/SmsPlaces';
import { smsPlacesReady } from '../lib/p8bSource';
import { OptionsHowTo } from '../components/settings/OptionsHowTo';
import { SmsFallbackEntry } from '../components/shell/SmsFallbackEntry';
import { PROD_BUILD, shows } from '../lib/prodFacade';
import { lazyRetry } from '../lib/lazyRetry';
import { parseRoute } from '../lib/routes';
import { OPEN_OPTIONS_EVENT, optScreenOf, takeOptionsScreen, type OptionsScreen } from '../lib/openOptions';
import { getNowIso } from '../lib/frozenNow';
import { localDateOf } from '../lib/money/engine';
import { accountingPackConfigOf } from '../lib/p5Source';
import {
  accountingAddressesSaverOf, accountingTestMailOf, cancelRulesOf, cancelSaverOf, dwellRulesOf, dwellSaverOf,
  fuelActionsOf, fuelScreenOf, marginSettingOf, paymentTermsOf, paymentTermsSaverOf, rateCardOf, rateCardSaverOf,
} from '../lib/p5bSource';
import { KshSyncSourceBlock, StatusScreen } from '../components/options/StatusScreen';
import { sourceHealth } from '../lib/sysSource';
import { myNotifyOf, useLiveNotify } from '../lib/forMeSource';
import { NOTIFY_CATALOG_READY } from '../lib/notifyCatalog';
import { etaCalibrationApproveOf, etaCalibrationOf, type CalibVersion, type EtaCalibration } from '../lib/etaCalibSource';
import { accountRole } from '../lib/accountRole';
import { OPTIONS_CHANGED_EVENT } from '../lib/optionsChanged';
import type { LiveMeta } from '../auth/liveOptionsMeta';

/** A6-T2 — znacznik „Zapisano · …” w aktywnym języku (PL bez zmian). */
function savedText(locale: Locale, code: string): string {
  const k = `a6_saved_${code.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l')}`;
  return hasKey(locale, k) ? t(locale, k) : code;
}

/* wyglad/W-opcje-live-1: ekrany Opcji na produkcji w wyglądzie z audytu (te same ekrany co w demo, dane i RPC z dawnych formularzy) */
const UsersAdmin = import.meta.env.VITE_AUTH_MODE === 'supabase' && SUPABASE_AUTH_ENABLED ? lazy(lazyRetry(() => import('../auth/LiveUsers'))) : null;
/** D-20261014-0700-01 J3 pkt 1: AccountScreen zamiast MyAccount + Mfa + MyDevices. */
const LiveAccount = import.meta.env.VITE_AUTH_MODE === 'supabase' && SUPABASE_AUTH_ENABLED ? lazy(lazyRetry(() => import('../auth/LiveAccountScreen'))) : null;
/* E3 (W-opcje-live-2): Opłata paliwowa na produkcji — ekran z audytu; BafForm (wersje, ceny ręczne, dziennik) rozwijany pod nim */
const LiveFuel = import.meta.env.VITE_AUTH_MODE === 'supabase' && SUPABASE_AUTH_ENABLED ? lazy(lazyRetry(() => import('../auth/LiveFuel'))) : null;
/* E11 (właściciel 21.10.2026 19:52): „Kto co dostaje” na produkcji w wyglądzie z audytu — ten sam ekran co w demo, dane z bazy */
const NotificationMatrixForm = import.meta.env.VITE_AUTH_MODE === 'supabase' && SUPABASE_AUTH_ENABLED ? lazy(lazyRetry(() => import('../auth/LiveWhoGets'))) : null;
/* E33/E-06 (W-opcje-live-2): Cennik na produkcji — tabela symboli z audytu, pełny formularz RateCardForm rozwijany pod nią */
const LiveRateCard = import.meta.env.VITE_AUTH_MODE === 'supabase' && SUPABASE_AUTH_ENABLED ? lazy(lazyRetry(() => import('../auth/LiveRateCard'))) : null;
/* E42 (W-opcje-live-2): SMS przy miejscach na produkcji — ekran z audytu; wyzwalacze, SMS testowe, bramka i strefy rozwijane pod nim */
const LiveSmsPlaces = import.meta.env.VITE_AUTH_MODE === 'supabase' && SUPABASE_AUTH_ENABLED ? lazy(lazyRetry(() => import('../auth/LiveSmsPlaces'))) : null;
/* E33 (W-opcje-live-2): Dopłaty na produkcji — ekran z audytu, dane i zapis jak w DwellOptionsForm (ops_thresholds) */
const LiveDwell = import.meta.env.VITE_AUTH_MODE === 'supabase' && SUPABASE_AUTH_ENABLED ? lazy(lazyRetry(() => import('../auth/LiveDwell'))) : null;
/* #412 E40 (0285): terminy płatności i adresy księgowości z bazy — ten sam ekran co w demo */
const LiveTerms = import.meta.env.VITE_AUTH_MODE === 'supabase' && SUPABASE_AUTH_ENABLED ? lazy(lazyRetry(() => import('../auth/LiveTerms'))) : null;
/* E23 (W-opcje-live-2): Stan systemu na produkcji — „Źródła danych” z audytu, dzisiejszy panel rozwijany pod listą */
const LiveStatus = import.meta.env.VITE_AUTH_MODE === 'supabase' && SUPABASE_AUTH_ENABLED ? lazy(lazyRetry(() => import('../auth/LiveStatus'))) : null;
const OpsThresholdsForm = import.meta.env.VITE_AUTH_MODE === 'supabase' && SUPABASE_AUTH_ENABLED ? lazy(lazyRetry(() => import('../auth/LiveThresholds'))) : null;
const AuthLoginLog = import.meta.env.VITE_AUTH_MODE === 'supabase' && SUPABASE_AUTH_ENABLED ? lazy(lazyRetry(() => import('../auth/LiveLogins'))) : null;
const BroadcastForm = import.meta.env.VITE_AUTH_MODE === 'supabase' && SUPABASE_AUTH_ENABLED ? lazy(lazyRetry(() => import('../auth/LiveBroadcast'))) : null;
const DataExportPanel = import.meta.env.VITE_AUTH_MODE === 'supabase' && SUPABASE_AUTH_ENABLED ? lazy(lazyRetry(() => import('../auth/LiveExport'))) : null;
const ChangeHistoryPanel = import.meta.env.VITE_AUTH_MODE === 'supabase' && SUPABASE_AUTH_ENABLED ? lazy(lazyRetry(() => import('../auth/LiveHistory'))) : null;
const SecurityFlags = import.meta.env.VITE_AUTH_MODE === 'supabase' && SUPABASE_AUTH_ENABLED ? lazy(lazyRetry(() => import('../auth/LiveFlags'))) : null;
const LiveCalib = import.meta.env.VITE_AUTH_MODE === 'supabase' && SUPABASE_AUTH_ENABLED ? lazy(lazyRetry(() => import('../auth/LiveCalib'))) : null;
/* stany w menu z bazy — moduł tylko w buildzie produkcyjnym (strażnik I-2: demo bez klienta Supabase) */
const loadLiveMeta = import.meta.env.VITE_AUTH_MODE === 'supabase' && SUPABASE_AUTH_ENABLED ? () => import('../auth/liveOptionsMeta') : null;
const PermitRequirement = import.meta.env.VITE_AUTH_MODE === 'supabase' && SUPABASE_AUTH_ENABLED ? lazy(lazyRetry(() => import('../auth/PermitRequirement'))) : null;
/* wyglad/P5 (E31, E12, L26): terminy dokumentów — przeniesione ze strony Dokumenty, zapis bez zmian */
const DocTerms = lazy(lazyRetry(() => import('../components/docs/DocTerms')));
const FactoringOfferScreen = lazy(lazyRetry(() => import('../components/options/FactoringOfferScreen').then((m) => ({ default: m.FactoringOfferScreen }))));
/* wyglad/P5-b (E3, E33, E16, E40, E12): Opłata paliwowa, Dopłaty (postój), Cennik (anulowanie, próg marży), Terminy i adresy */
const FuelScreen = lazy(lazyRetry(() => import('../components/options/MoneyScreens').then((m) => ({ default: m.FuelScreen }))));
const DwellScreen = lazy(lazyRetry(() => import('../components/options/MoneyScreens').then((m) => ({ default: m.DwellScreen }))));
const RatesExtras = lazy(lazyRetry(() => import('../components/options/MoneyScreens').then((m) => ({ default: m.RatesExtras }))));
const TermsScreen = lazy(lazyRetry(() => import('../components/options/MoneyScreens').then((m) => ({ default: m.TermsScreen }))));
/* wyglad/audyt-E (E-06, C-14): cennik według symboli w wersjach zamiast linii L/W/H */
const RateCard = lazy(lazyRetry(() => import('../components/options/MoneyScreens').then((m) => ({ default: m.RateCard }))));
/* wyglad/W-eta — Opcje › Kalibracja ETA (E15 pkt 7; audyt 17.10 sekcja 08 N6): osobny kawałek, poza pierwszym ładowaniem */
const EtaCalibScreen = lazy(lazyRetry(() => import('../components/options/EtaCalibScreen').then((m) => ({ default: m.EtaCalibScreen }))));

const bafFields: Array<{ key: keyof BafParams; labelKey: string; type?: 'number' | 'text'; step?: string; suffix?: string }> = [
  { key: 'indexSource', labelKey: 'baf_index', type: 'text' },
  { key: 'baseValue', labelKey: 'baf_base', type: 'number', step: '0.01', suffix: 'a6_unit_sek_l' },
  { key: 'baseDate', labelKey: 'baf_base_date', type: 'text' },
  { key: 'currentValue', labelKey: 'baf_current', type: 'number', step: '0.01', suffix: 'a6_unit_sek_l' },
  { key: 'valueDate', labelKey: 'baf_value_date', type: 'text' },
  { key: 'fuelShare', labelKey: 'fin_fuel_share', type: 'number', step: '0.01', suffix: '%' },
  { key: 'triggerThreshold', labelKey: 'baf_trigger', type: 'number', step: '0.01', suffix: '%' },
  { key: 'roundingStep', labelKey: 'baf_rounding', type: 'number', step: '0.01' },
  { key: 'floorPct', labelKey: 'baf_floor', type: 'number', step: '0.1', suffix: '%' },
  { key: 'capPct', labelKey: 'baf_cap', type: 'number', step: '0.1', suffix: '%' },
  { key: 'sourceUrl', labelKey: 'baf_url', type: 'text' },
];

function SuspenseBlock({ children }: { children: ReactNode }) {
  return <Suspense fallback={null}>{children}</Suspense>;
}

function Soon({ locale, tipKey }: { locale: Locale; tipKey: string }) {
  return <div className="note option-note" data-dec6-soon={tipKey}>{t(locale, tipKey)}</div>;
}

export function OptionsView() {
  const role = useTowerStore((s) => s.role);
  const locale = useTowerStore((s) => s.locale);
  const factoringOffer = useTowerStore((s) => s.factoringOffer);
  const updateFactoringOffer = useTowerStore((s) => s.updateFactoringOffer);
  const baf = useTowerStore((s) => s.baf);
  const updateBaf = useTowerStore((s) => s.updateBaf);
  const geofences = useTowerStore((s) => s.geofences);
  const saveGeofence = useTowerStore((s) => s.saveGeofence);
  const smsEntry = useTowerStore((s) => s.smsEntry);
  const bills = useTowerStore((s) => s.bills);
  const loads = useTowerStore((s) => s.loads);
  const location = useLocation();
  const [saved, setSaved] = useState('');
  /* wyglad/P3-c (E11, E37 pkt 1): menu konta i adresy /opcje/… otwierają ekran z menu bocznego. */
  const [request, setRequest] = useState<{ screen: OptScreenId; seq: number } | null>(null);
  /* wyglad/W-eta: wersja zatwierdzona w Kalibracji ETA — ten sam stan na ekranie i w menu bocznym (F7 P2) */
  const [calibApproved, setCalibApproved] = useState<CalibVersion | null>(null);
  /* wyglad/W-opcje-live-1: stany w menu i na kafelkach z bazy (produkcja); odświeżane po zapisie w ekranie */
  const [liveMeta, setLiveMeta] = useState<LiveMeta | null>(null);
  const metaAdmin = accountRole(role) !== 'HHL_OPS';
  useEffect(() => {
    if (!loadLiveMeta || role !== 'HHL') return undefined;
    let alive = true;
    const load = () => {
      void loadLiveMeta()
        .then((m) => m.loadOptionsMeta(locale, metaAdmin))
        .then((v) => { if (alive) setLiveMeta(v); }, () => { /* bez stanów — zostają nazwy ekranów */ });
    };
    load();
    window.addEventListener(OPTIONS_CHANGED_EVENT, load);
    return () => { alive = false; window.removeEventListener(OPTIONS_CHANGED_EVENT, load); };
  }, [locale, metaAdmin, role]);
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
  useEffect(() => {
    const r = parseRoute(location.pathname);
    const screen: OptScreenId | null = smsEntry != null || r.kind === 'system' ? 'status'
      : r.kind === 'options' && r.section === 'sms' ? 'zones'
        : r.kind === 'options' && r.section === 'cennik' ? 'rates' : null;
    if (screen) setRequest((prev) => ({ screen, seq: (prev?.seq ?? 0) + 1 }));
  }, [location.pathname, smsEntry]);

  const saveMark = (label: string) => {
    setSaved(label);
    window.setTimeout(() => setSaved(''), 1600);
  };
  const updateBafField = (key: keyof BafParams, value: string) => {
    const numeric = ['baseValue', 'currentValue', 'fuelShare', 'triggerThreshold', 'roundingStep', 'floorPct', 'capPct'];
    updateBaf({ [key]: numeric.includes(key) ? Number(value) || 0 : value } as Partial<BafParams>);
  };
  const updateFactoring = <K extends keyof FactoringOffer>(key: K, value: FactoringOffer[K]) => updateFactoringOffer({ [key]: value });

  /* E12-A: Operacje HHL — bez Użytkowników, Logowań i Historii; ustawienia tylko do odczytu (baza 0198). */
  const authRole = accountRole(role);
  const isHhlAdmin = authRole !== 'HHL_OPS';
  const kind: AccountKind = isHhlAdmin ? 'HHL_ADMIN' : 'HHL_OPS';
  const ro = !isHhlAdmin;
  const change = ro ? 'read' as const : 'admin' as const;

  /* wyglad/audyt-E (E-05, W47; E11 „w przeglądarce zostaje tylko motyw i waluta”): przełączniki „na tym urządzeniu”
     usunięte; w Dla mnie › Co dostaję osoba HHL ustawia swoje kanały tak samo jak KSH i SCX — jedno miejsce zapisu
     `myNotifyOf` (demo: magazyn strony; produkcja: wykonawca). „Oznacz wszystkie jako przeczytane” jest w dzwonku (E5). */
  const my = myNotifyOf(kind);
  const live = useLiveNotify(kind);
  const demo = useDemoOptions(locale, { kind, readOnly: ro, my });

  if (role !== 'HHL') {
    return <div className="panel section-card" style={{ margin: 12 }}><div className="panel-bd"><b>{t(locale, 'opt_hhl_only')}</b></div></div>;
  }

  const noSource = <div className="note option-note">{t(locale, 'p3c_no_source')}</div>;
  const pick = (id: OptScreenId, prod: ReactNode): ReactNode => demo?.bodies[id] ?? prod ?? noSource;
  const scr = (id: OptScreenId, body: ReactNode, extra: Partial<OptScreen> = {}): OptScreen => ({
    id,
    body,
    meta: demo?.meta[id]?.meta ?? liveMeta?.meta[id]?.meta,
    metaTone: demo?.meta[id]?.tone ?? liveMeta?.meta[id]?.tone,
    ...extra,
  });
  const block = (el: ReactNode) => <SuspenseBlock>{el}</SuspenseBlock>;
  /* wyglad/W-konta (audyt 17.10 sekcja 07 N2, do czasu P3-d): stare formularze produkcji u Operacji HHL — pola nieaktywne,
     przyciski zmian ukryte (E12-1A: Operacje w Opcjach tylko odczyt). `fieldset disabled` wyłącza wszystkie pola naraz. */
  const roBlock = (el: ReactNode) => block(ro ? <fieldset disabled className="opt-ro" data-opt-ro>{el}</fieldset> : el);
  const calibMeta = (c: EtaCalibration): string => {
    const n = c.observations.filter((o) => !o.skipped).length;
    if (calibApproved) return tp(locale, 'cal_meta_done', { no: calibApproved.no });
    if (c.proposal) return t(locale, 'cal_meta_ready');
    return n >= c.needed ? t(locale, 'cal_meta_same') : tp(locale, 'cal_meta_wait', { n, need: c.needed });
  };

  /* strefy (włącz / wyłącz) — pod ekranem SMS przy miejscach */
  const zoneList = (
    <div className="settings-list" style={{ marginTop: 10 }} data-live-sms-zones>
      {geofences.map((g) => (
        <div className="settings-row" key={g.id}>
          <div>
            <b data-content>{geofenceDisplayName(g.name, locale)}</b>
            <span>{geofenceTypeLabel(g.type, locale)} · {g.radiusM >= 1000 ? `${Math.round(g.radiusM / 1000)} km` : `${g.radiusM} m`}</span>
          </div>
          {/* F7 #415: Operacje HHL — tylko podgląd (E12-1A), przełącznik nieaktywny */}
          <button type="button" className={`mini-toggle${g.active ? ' is-on' : ''}`} aria-pressed={g.active} disabled={ro} onClick={() => { if (ro) return; saveGeofence({ ...g, active: !g.active }); saveMark('strefa'); }}>
            <i />{g.active ? t(locale, 'on') : t(locale, 'off')}
          </button>
        </div>
      ))}
    </div>
  );

  const groups: OptGroup[] = [];

  if (isHhlAdmin) {
    groups.push({
      id: 'people',
      screens: [
        scr('users', pick('users', UsersAdmin ? block(<UsersAdmin />) : null), { right: 'admin' }),
        scr('logins', pick('logins', AuthLoginLog ? block(<AuthLoginLog />) : null)),
      ],
    });
  }

  groups.push({
    id: 'notify',
    screens: [
      scr('who', (
        <>
          {pick('who', NotificationMatrixForm ? block(<NotificationMatrixForm readOnly={ro} />) : null)}
          <OptionsHowTo locale={locale} k="b6_howto_notif" />
        </>
      ), { right: change }),
      scr('zones', smsPlacesReady() ? <SmsPlaces readOnly={ro} /> : LiveSmsPlaces ? block(<LiveSmsPlaces readOnly={ro}>{zoneList}</LiveSmsPlaces>) : (
        <>
          <OptionsHowTo locale={locale} k="b6_howto_zones" />
          {zoneList}
        </>
      ), { right: change }),
      scr('bcast', pick('bcast', BroadcastForm ? block(<BroadcastForm readOnly={ro} admin={isHhlAdmin} />) : null), { right: change }),
      /* P11 (e11/e12, G-11): „Treści wiadomości” ostatnie w grupie Powiadomienia */
      scr('texts', <MessageTexts readOnly={ro} />, { right: change }),
    ],
  });

  /* wyglad/P5-b — dane ekranów Pieniądze; null = nie podłączone (zostaje dzisiejszy formularz albo sekcji nie ma) */
  const fuelView = fuelScreenOf(localDateOf(getNowIso()), getNowIso());
  const fuelMeta = fuelView?.current.applied != null ? `× ${formatPlNumber(fuelView.current.applied, 2)}` : undefined;
  const dwell = dwellRulesOf();
  const cancel = cancelRulesOf();
  const margin = marginSettingOf();
  const terms = paymentTermsOf();
  const rateCard = rateCardOf();
  const addresses = accountingPackConfigOf(bills)?.addresses ?? null;
  const ratesExtras = cancel || margin ? block(
    <RatesExtras
      locale={locale}
      readOnly={ro}
      cancel={cancel}
      onCancelSave={cancelSaverOf()}
      margin={margin ? margin.pct : undefined}
      onMarginSave={margin?.save ?? null}
    />,
  ) : null;

  const money: OptScreen[] = [
    scr('rates', PROD_BUILD ? (
      <>
        {ratesExtras}
        {LiveRateCard ? block(<LiveRateCard readOnly={ro} />) : <div className="note option-note">{t(locale, 'i2_rates_no_source')}</div>}
      </>
    ) : (
      <>
        {ratesExtras}
        {/* wyglad/audyt-E (E-06, C-14; E33, E11, E16): symbole, wersje KSH i SCX od daty, „Nowa wersja cennika” z pytaniem
            i wpisem w Historii, liczby po polsku, D × S × W; bez noty z kursem demo i „Zapis od razu” */}
        {rateCard ? block(
          <RateCard locale={locale} view={rateCard} today={localDateOf(getNowIso())} nowIso={getNowIso()} readOnly={ro} onSave={rateCardSaverOf()} />,
        ) : null}
      </>
    ), { right: change, mark: PROD_BUILD ? undefined : <DemoMark /> }),
    scr('surch', dwell
      ? block(<DwellScreen locale={locale} rules={dwell} readOnly={ro} onSave={dwellSaverOf()} />)
      : LiveDwell ? block(<LiveDwell readOnly={ro} />) : <Soon locale={locale} tipKey="opt_acc_dwell_note" />, { right: change, mark: dwell && !PROD_BUILD ? <DemoMark /> : undefined }),
    scr('fuel', fuelView ? block(
      <FuelScreen locale={locale} view={fuelView} actions={fuelActionsOf()} readOnly={ro} />,
    ) : LiveFuel ? block(<LiveFuel readOnly={ro} />) : (
      <>
        <OptionsHowTo locale={locale} k="b6_howto_sefs" />
        <>
            <div className="fuel-grid">
              <div><h4 className="sec">{t(locale, 'opt_index_read')}</h4><dl className="kv options-kv fuel-kv">{bafFields.slice(0, 6).map((field) => <div className="kv-row" key={String(field.key)}><dt>{t(locale, field.labelKey)}</dt><dd><div className="input-unit"><input className="input full" type={field.type ?? 'text'} step={field.step} value={String(baf[field.key])} readOnly disabled title={t(locale, 'opt_baf_facade_title')} onChange={(e) => updateBafField(field.key, e.target.value)} onBlur={() => saveMark('BAF')} />{field.suffix ? <span>{t(locale, field.suffix)}</span> : null}</div></dd></div>)}</dl></div>
              <div><h4 className="sec">{t(locale, 'opt_billing_rules')}</h4><dl className="kv options-kv fuel-kv">{bafFields.slice(6).map((field) => <div className="kv-row" key={String(field.key)}><dt>{t(locale, field.labelKey)}</dt><dd><div className="input-unit"><input className="input full" type={field.type ?? 'text'} step={field.step} value={String(baf[field.key])} readOnly disabled title={t(locale, 'opt_baf_facade_title')} onChange={(e) => updateBafField(field.key, e.target.value)} onBlur={() => saveMark('BAF')} />{field.suffix ? <span>{t(locale, field.suffix)}</span> : null}</div></dd></div>)}</dl></div>
            </div>
            <div className="note option-note" data-facade="baf-options">{t(locale, 'opt_baf_facade_note')}</div>
        </>
      </>
    ), {
      right: change,
      mark: PROD_BUILD ? undefined : <DemoMark />,
      /* P11 (e3, E3 „Jedna liczba”): mnożnik przy pozycji menu z tego samego źródła co karta „Ten tydzień” */
      meta: fuelMeta,
    }),
  ];
  if (!terms && !addresses && LiveTerms) {
    money.push(scr('terms', block(<LiveTerms readOnly={ro} />), { right: change }));
  } else if (terms || addresses) {
    money.push(scr('terms', block(
      <TermsScreen
        locale={locale}
        readOnly={ro}
        terms={terms}
        onTermsSave={paymentTermsSaverOf()}
        addresses={addresses}
        onAddrSave={accountingAddressesSaverOf()}
        onTest={accountingTestMailOf()}
      />,
    ), {
      right: change,
      mark: PROD_BUILD ? undefined : <DemoMark />,
      /* wyglad/audyt-E (E-15; obraz E11 `e11-desk`): stan przy pozycji menu — „30 / 35 dni” (KSH płaci HHL / HHL płaci SCX) */
      meta: terms ? `${terms.kshDays} / ${terms.scxDays} dni` : undefined,
    }));
  }
  if (shows('factoringOffer')) {
    /* wyglad/P5 (E4b, img/e4b-desk): „Oferta HHL” — pola i zapis jak dotąd, wygląd według raportu */
    money.push(scr('fact', (
      <Suspense fallback={null}>
        <FactoringOfferScreen locale={locale} offer={factoringOffer} readOnly={ro} onChange={updateFactoring} onSaved={saveMark} />
      </Suspense>
    ), { right: change }));
  }
  groups.push({ id: 'money', screens: money });

  groups.push({
    id: 'rules',
    screens: [
      scr('thr', (
        <>
          <OptionsHowTo locale={locale} k="b6_howto_thresh" />
          {pick('thr', OpsThresholdsForm ? block(<OpsThresholdsForm readOnly={ro} />) : <Soon locale={locale} tipKey="opt_acc_thresh_soon" />)}
        </>
      ), { right: change }),
      scr('permits', (
        <>
          <Suspense fallback={null}><DocTerms canEdit={isHhlAdmin} /></Suspense>
          {PermitRequirement ? roBlock(<PermitRequirement />) : demo?.bodies.permitsFlag ?? <Soon locale={locale} tipKey="opt_acc_perm_soon" />}
        </>
      ), { right: change }),
      (() => {
        /* wyglad/W-eta — Kalibracja ETA: pomiary, propozycja po 5 dostawach, zatwierdza Administrator HHL (Operacje — podgląd).
           Produkcja: `null` → „Brak źródła danych.”, dopóki wykonawca nie podłączy P4-u (D-20261017-1100-01 §3). */
        const calib = etaCalibrationOf(loads);
        return scr('calib', calib ? (
          <Suspense fallback={null}>
            <EtaCalibScreen locale={locale} data={calib} readOnly={ro} onApprove={ro ? null : etaCalibrationApproveOf(calib)} approved={calibApproved} onApproved={setCalibApproved} />
          </Suspense>
        ) : LiveCalib ? block(<LiveCalib readOnly={ro} />) : noSource, {
          right: change,
          mark: calib && !PROD_BUILD ? <DemoMark /> : undefined,
          meta: calib ? calibMeta(calib) : liveMeta?.meta.calib?.meta,
        });
      })(),
    ],
  });

  const system: OptScreen[] = [
    /* wyglad/P10b-c (E23, E47, E19 pkt 7, E46): źródła danych, błędy aplikacji, bezpieczeństwo, wydajność;
       produkcja do podłączenia danych (D-20261016-0845-01) — dzisiejszy panel stanu */
    scr('status', (
      <>
        <SmsFallbackEntry />
        {sourceHealth(getNowIso())
          ? <StatusScreen locale={locale} nowIso={getNowIso()} admin={isHhlAdmin} />
          : LiveStatus ? block(<LiveStatus admin={isHhlAdmin} />) : (
            <>
              {/* wyglad/P7-e2: wiersz „Plik KSH (SharePoint)” także nad dzisiejszym panelem (W13 zasady 15–16) */}
              <KshSyncSourceBlock locale={locale} nowIso={getNowIso()} admin={isHhlAdmin} />
              <Soon locale={locale} tipKey="opt_acc_sys_soon" />
            </>
          )}
      </>
    ), { mark: PROD_BUILD ? undefined : <DemoMark /> }),
    scr('flags', pick('flags', SecurityFlags ? block(<SecurityFlags readOnly={ro} />) : null), { right: change }),
  ];
  if (isHhlAdmin) system.push(scr('hist', pick('hist', ChangeHistoryPanel ? block(<ChangeHistoryPanel />) : null)));
  system.push(scr('export', pick('export', DataExportPanel ? block(<DataExportPanel admin={isHhlAdmin} />) : null), { right: 'download' }));
  groups.push({ id: 'system', screens: system });

  const forme: OptScreen[] = [
    scr('account', pick('account', LiveAccount ? block(<LiveAccount />) : null), { right: 'own' }),
    scr('forme', pick('forme', live
      ? <ForMeScreen locale={locale} kind={kind} groups={NOTIFY_CATALOG_READY} prefs={live.prefs} onSave={live.save} />
      : <ForMeScreen locale={locale} kind={null} groups={null} />), { right: 'own' }),
    scr('look', (
      <>
        {/* wyglad/audyt-E (E-13; E37, E11 „tylko na Twoim koncie”): ten sam opis co u KSH i SCX */}
        <UiPrefsPanel onSaved={saveMark} showDemoMarks={shows('demoMarksToggle')} subKey="settings_prefs_sub" noteKey="settings_prefs_note" />
        {/* wyglad/J4: ocena przewoźników przeniesiona do Kokpitu (E11/E12 — raport, nie ustawienie) */}
      </>
    ), { right: 'own' }),
    scr('device', <DeviceScreen locale={locale} />, { right: 'own' }),
  ];
  /* wyglad/P10b-b (E37 pkt 3): „Instrukcja” znika z Opcji i Ustawień — zastępuje ją Pomoc („?”, menu konta) */
  groups.push({ id: 'forme', screens: forme });

  for (const g of groups) {
    const s = demo?.summaries[g.id] ?? liveMeta?.summaries[g.id];
    /* P11 (e3): „paliwo × …” w opisie grupy Pieniądze — ta sama liczba co przy pozycji menu */
    if (s) { g.summary = g.id === 'money' ? s.text.replace('{fuel}', fuelMeta ?? '—') : s.text; g.summaryTone = s.tone; }
  }

  return (
    <div className="options-page" data-page="options" data-p3c="shell">
      <OptionsShell
        locale={locale}
        rootKey="opt_title"
        who={`HHL · ${t(locale, `p3c_kind_${kind}`).toLowerCase()}`}
        groups={groups}
        request={request}
        saved={saved ? <span className="pill p-go">{t(locale, 'opt_saved')} · {savedText(locale, saved)}</span> : null}
      />
    </div>
  );
}
