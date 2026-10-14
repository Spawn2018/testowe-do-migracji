import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useTowerStore } from '../store/useTowerStore';
import type { BafParams, FactoringOffer, Locale, RateRule } from '../types';
import { geofenceDisplayName, geofenceTypeLabel } from '../lib/enumLabels';
import { hasKey, t } from '../i18n/messages';
import { DemoMark } from '../components/ui/DemoMark';
import { DEMO_FX_META } from '../lib/money/demoFx';
import { SUPABASE_AUTH_ENABLED } from '../auth/config';
import { getAuthProfile } from '../auth/profile';
import { UiPrefsPanel } from '../components/settings/UiPrefsPanel';
import { OptionsShell } from '../components/options/OptionsShell';
import type { OptGroup, OptScreen, OptScreenId, AccountKind } from '../components/options/types';
import { useDemoOptions } from '../components/options/useDemoOptions';
import { ForMeScreen } from '../components/options/ForMeScreen';
import { OptionsHowTo } from '../components/settings/OptionsHowTo';
import { SmsFallbackEntry } from '../components/shell/SmsFallbackEntry';
import { PROD_BUILD, shows } from '../lib/prodFacade';
import { parseRoute } from '../lib/routes';
import { OPEN_OPTIONS_EVENT, takeOptionsScreen, type OptionsScreen } from '../lib/openOptions';

/** A6-T2 — znacznik „Zapisano · …” w aktywnym języku (PL bez zmian). */
function savedText(locale: Locale, code: string): string {
  const k = `a6_saved_${code.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l')}`;
  return hasKey(locale, k) ? t(locale, k) : code;
}

const Guide = import.meta.env.VITE_AUTH_MODE === 'supabase' && SUPABASE_AUTH_ENABLED ? lazy(() => import('../components/guide/Guide')) : null;
const MyMfa = import.meta.env.VITE_AUTH_MODE === 'supabase' && SUPABASE_AUTH_ENABLED ? lazy(() => import('../auth/Mfa')) : null;
const UsersAdmin = import.meta.env.VITE_AUTH_MODE === 'supabase' && SUPABASE_AUTH_ENABLED ? lazy(() => import('../auth/UsersAdmin')) : null;
const MyAccount = import.meta.env.VITE_AUTH_MODE === 'supabase' && SUPABASE_AUTH_ENABLED ? lazy(() => import('../auth/MyAccount')) : null;
const BafForm = import.meta.env.VITE_AUTH_MODE === 'supabase' && SUPABASE_AUTH_ENABLED ? lazy(() => import('../auth/BafForm')) : null;
const NotificationMatrixForm = import.meta.env.VITE_AUTH_MODE === 'supabase' && SUPABASE_AUTH_ENABLED ? lazy(() => import('../auth/NotificationMatrixForm')) : null;
const RateCardForm = import.meta.env.VITE_AUTH_MODE === 'supabase' && SUPABASE_AUTH_ENABLED ? lazy(() => import('../auth/RateCardForm')) : null;
const SmsGateway = import.meta.env.VITE_AUTH_MODE === 'supabase' && SUPABASE_AUTH_ENABLED ? lazy(() => import('../auth/SmsGateway')) : null;
const SmsZoneRecipients = import.meta.env.VITE_AUTH_MODE === 'supabase' && SUPABASE_AUTH_ENABLED ? lazy(() => import('../auth/SmsZoneRecipients')) : null;
const OpsThresholdsForm = import.meta.env.VITE_AUTH_MODE === 'supabase' && SUPABASE_AUTH_ENABLED ? lazy(() => import('../auth/OpsThresholdsForm')) : null;
const DwellOptionsForm = import.meta.env.VITE_AUTH_MODE === 'supabase' && SUPABASE_AUTH_ENABLED ? lazy(() => import('../auth/OpsThresholdsForm').then((m) => ({ default: m.DwellOptionsForm }))) : null;
const SystemStatusPanel = import.meta.env.VITE_AUTH_MODE === 'supabase' && SUPABASE_AUTH_ENABLED ? lazy(() => import('../auth/SystemStatusPanel')) : null;
const AuthLoginLog = import.meta.env.VITE_AUTH_MODE === 'supabase' && SUPABASE_AUTH_ENABLED ? lazy(() => import('../auth/AuthLoginLog')) : null;
const BroadcastForm = import.meta.env.VITE_AUTH_MODE === 'supabase' && SUPABASE_AUTH_ENABLED ? lazy(() => import('../auth/BroadcastForm')) : null;
const DataExportPanel = import.meta.env.VITE_AUTH_MODE === 'supabase' && SUPABASE_AUTH_ENABLED ? lazy(() => import('../auth/DataExportPanel')) : null;
const ChangeHistoryPanel = import.meta.env.VITE_AUTH_MODE === 'supabase' && SUPABASE_AUTH_ENABLED ? lazy(() => import('../auth/ChangeHistoryPanel')) : null;
const PermitRequirement = import.meta.env.VITE_AUTH_MODE === 'supabase' && SUPABASE_AUTH_ENABLED ? lazy(() => import('../auth/PermitRequirement')) : null;
const CarrierScorecard = import.meta.env.VITE_AUTH_MODE === 'supabase' && SUPABASE_AUTH_ENABLED ? lazy(() => import('../auth/CarrierScorecard')) : null;
const MyDevices = import.meta.env.VITE_AUTH_MODE === 'supabase' && SUPABASE_AUTH_ENABLED ? lazy(() => import('../auth/MyDevices')) : null;

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

function formatRate(rule: RateRule) {
  return `L ${rule.lengthFrom}–${rule.lengthTo} m · W ${rule.widthFrom}–${rule.widthTo} m · H ${rule.heightFrom}–${rule.heightTo} m · ${rule.weightFrom}–${rule.weightTo} t`;
}

function RateEditor({
  side,
  rules,
  onChange,
  onSave,
  currency,
  locale,
}: {
  side: 'COST' | 'REVENUE';
  rules: RateRule[];
  onChange: (id: string, value: number) => void;
  onSave: () => void;
  currency: 'EUR' | 'PLN';
  locale: 'pl' | 'en' | 'sv';
}) {
  return (
    <div className="options-page page-sections" data-page="options">
      <div className="rate-editor-head"><b>{side === 'COST' ? t(locale, 'opt_cost_scx') : t(locale, 'opt_rev_hhl')}</b><span>{currency} · {t(locale, 'opt_base_ex_sefs')}</span></div>
      {rules.map((rule, index) => (
        <div className="rate-line" key={rule.id}>
          <div className="rate-copy"><b>{t(locale, 'opt_line')} {index + 1}</b><span>{formatRate(rule)}</span></div>
          <label className="rate-value"><input aria-label={`${side === 'COST' ? t(locale, 'opt_cost') : t(locale, 'opt_rev')} ${t(locale, 'opt_line')} ${index + 1}`} className="input rate-input" type="number" min="0" step="0.01" value={rule.baseRate} onChange={(e) => onChange(rule.id, Number(e.target.value) || 0)} onBlur={onSave} /><span>{currency}</span></label>
        </div>
      ))}
    </div>
  );
}

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
  const rateCost = useTowerStore((s) => s.rateCost);
  const rateRev = useTowerStore((s) => s.rateRev);
  const updateRate = useTowerStore((s) => s.updateRate);
  const geofences = useTowerStore((s) => s.geofences);
  const saveGeofence = useTowerStore((s) => s.saveGeofence);
  const notificationPrefs = useTowerStore((s) => s.notificationPrefs);
  const updateNotificationPrefs = useTowerStore((s) => s.updateNotificationPrefs);
  const smsEntry = useTowerStore((s) => s.smsEntry);
  const location = useLocation();
  const [saved, setSaved] = useState('');
  /* wyglad/P3-c (E11, E37 pkt 1): menu konta i adresy /opcje/… otwierają ekran z menu bocznego. */
  const [request, setRequest] = useState<{ screen: OptScreenId; seq: number } | null>(null);
  useEffect(() => {
    const go = (screen: OptionsScreen | null) => {
      if (!screen) return;
      setRequest((r) => ({ screen: screen === 'my-account' ? 'account' : 'forme', seq: (r?.seq ?? 0) + 1 }));
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
  const authRole = getAuthProfile()?.role;
  const isHhlAdmin = authRole !== 'HHL_OPS';
  const kind: AccountKind = isHhlAdmin ? 'HHL_ADMIN' : 'HHL_OPS';
  const ro = !isHhlAdmin;
  const change = ro ? 'read' as const : 'admin' as const;

  /* Przełączniki „na tym urządzeniu” (dziś tylko w przeglądarce, E11) — w Dla mnie › Co dostaję. */
  const browserPrefs = (
    <>
      <div className="pref-list">
        {([['workflowAlerts', t(locale, 'opt_wf_rules')], ['geofenceAlerts', t(locale, 'opt_geo_alerts')], ['riskAlerts', t(locale, 'opt_risk_alerts')]] as const)
          .filter(([key]) => key !== 'workflowAlerts' || !PROD_BUILD)
          .map(([key, label]) => (
            <label key={key} className="switchline">
              <input type="checkbox" checked={notificationPrefs?.[key] ?? true} onChange={(e) => { updateNotificationPrefs({ [key]: e.target.checked }); saveMark('powiadomienia'); }} />
              <span>{label}</span>
            </label>
          ))}
      </div>
      <div className="note option-note">{t(locale, 'b6_notif_filter_note')}</div>
      <button type="button" className="chipbtn" onClick={() => useTowerStore.getState().markAllNotificationsRead('HHL')}>{t(locale, 'opt_mark_read')}</button>
    </>
  );

  const demo = useDemoOptions(locale, { kind, readOnly: ro, prefs: browserPrefs });

  if (role !== 'HHL') {
    return <div className="panel section-card" style={{ margin: 12 }}><div className="panel-bd"><b>{t(locale, 'opt_hhl_only')}</b></div></div>;
  }

  const noSource = <div className="note option-note">{t(locale, 'p3c_no_source')}</div>;
  const pick = (id: OptScreenId, prod: ReactNode): ReactNode => demo?.bodies[id] ?? prod ?? noSource;
  const scr = (id: OptScreenId, body: ReactNode, extra: Partial<OptScreen> = {}): OptScreen => ({
    id,
    body,
    meta: demo?.meta[id]?.meta,
    metaTone: demo?.meta[id]?.tone,
    ...extra,
  });
  const block = (el: ReactNode) => <SuspenseBlock>{el}</SuspenseBlock>;

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
          {pick('who', NotificationMatrixForm ? block(<NotificationMatrixForm />) : null)}
          <OptionsHowTo locale={locale} k="b6_howto_notif" />
        </>
      ), { right: change }),
      scr('zones', (
        <>
          <OptionsHowTo locale={locale} k="b6_howto_zones" />
          {SmsZoneRecipients ? block(<SmsZoneRecipients />) : null}
          {SmsGateway ? block(<SmsGateway />) : null}
          <div className="settings-list" style={{ marginTop: 10 }}>
            {geofences.map((g) => (
              <div className="settings-row" key={g.id}>
                <div>
                  <b data-content>{geofenceDisplayName(g.name, locale)}</b>
                  <span>{geofenceTypeLabel(g.type, locale)} · {g.radiusM >= 1000 ? `${Math.round(g.radiusM / 1000)} km` : `${g.radiusM} m`}</span>
                </div>
                <button type="button" className={`mini-toggle${g.active ? ' is-on' : ''}`} aria-pressed={g.active} disabled={ro} onClick={() => { saveGeofence({ ...g, active: !g.active }); saveMark('strefa'); }}>
                  <i />{g.active ? t(locale, 'on') : t(locale, 'off')}
                </button>
              </div>
            ))}
          </div>
        </>
      ), { right: change }),
      scr('bcast', pick('bcast', BroadcastForm ? block(<BroadcastForm />) : null), { right: change }),
    ],
  });

  const money: OptScreen[] = [
    scr('rates', PROD_BUILD ? (
      RateCardForm ? block(<RateCardForm />) : <div className="note option-note">{t(locale, 'i2_rates_no_source')}</div>
    ) : (
      <>
        <div className="rate-grid">
          <RateEditor side="COST" rules={rateCost} currency="EUR" locale={locale} onChange={(id, value) => updateRate('COST', id, value)} onSave={() => saveMark('cennik')} />
          <RateEditor side="REVENUE" rules={rateRev} currency="EUR" locale={locale} onChange={(id, value) => updateRate('REVENUE', id, value)} onSave={() => saveMark('cennik')} />
        </div>
        <div className="note option-note" data-fx-note="demo">{t(locale, 'opt_rates_note')} {` · ${t(locale, 'opt_fx_demo')} ${DEMO_FX_META.tableLabel} · ${DEMO_FX_META.effectiveDate} · ${DEMO_FX_META.mid.toFixed(4).replace('.', ',')}.`}</div>
        {RateCardForm ? block(<RateCardForm />) : null}
      </>
    ), { right: change, mark: PROD_BUILD ? undefined : <DemoMark /> }),
    scr('surch', DwellOptionsForm ? block(<DwellOptionsForm />) : <Soon locale={locale} tipKey="opt_acc_dwell_note" />, { right: change }),
    scr('fuel', (
      <>
        <OptionsHowTo locale={locale} k="b6_howto_sefs" />
        {BafForm ? block(<BafForm />) : (
          <>
            <div className="fuel-grid">
              <div><h4 className="sec">{t(locale, 'opt_index_read')}</h4><dl className="kv options-kv fuel-kv">{bafFields.slice(0, 6).map((field) => <div className="kv-row" key={String(field.key)}><dt>{t(locale, field.labelKey)}</dt><dd><div className="input-unit"><input className="input full" type={field.type ?? 'text'} step={field.step} value={String(baf[field.key])} readOnly disabled title={t(locale, 'opt_baf_facade_title')} onChange={(e) => updateBafField(field.key, e.target.value)} onBlur={() => saveMark('BAF')} />{field.suffix ? <span>{t(locale, field.suffix)}</span> : null}</div></dd></div>)}</dl></div>
              <div><h4 className="sec">{t(locale, 'opt_billing_rules')}</h4><dl className="kv options-kv fuel-kv">{bafFields.slice(6).map((field) => <div className="kv-row" key={String(field.key)}><dt>{t(locale, field.labelKey)}</dt><dd><div className="input-unit"><input className="input full" type={field.type ?? 'text'} step={field.step} value={String(baf[field.key])} readOnly disabled title={t(locale, 'opt_baf_facade_title')} onChange={(e) => updateBafField(field.key, e.target.value)} onBlur={() => saveMark('BAF')} />{field.suffix ? <span>{t(locale, field.suffix)}</span> : null}</div></dd></div>)}</dl></div>
            </div>
            <div className="note option-note" data-facade="baf-options">{t(locale, 'opt_baf_facade_note')}</div>
          </>
        )}
      </>
    ), { right: change, mark: BafForm ? undefined : <DemoMark /> }),
  ];
  if (shows('factoringOffer')) {
    money.push(scr('fact', (
      <dl className="kv options-kv">
        <dt>{t(locale, 'opt_active')}</dt><dd><label className="switchline"><input type="checkbox" checked={factoringOffer.enabled} onChange={(e) => { updateFactoring('enabled', e.target.checked); saveMark('factoring'); }} /><span>{factoringOffer.enabled ? t(locale, 'yes') : t(locale, 'no')}</span></label></dd>
        <dt>{t(locale, 'opt_offer_name')}</dt><dd><input className="input full" aria-label={t(locale, 'opt_offer_name')} value={factoringOffer.label ?? ''} onChange={(e) => updateFactoring('label', e.target.value)} onBlur={() => saveMark('oferta')} /></dd>
        <dt>{t(locale, 'opt_fee')}</dt><dd><div className="inline-input"><input className="input" aria-label={t(locale, 'opt_fee')} type="number" min="0" max="20" step="0.1" value={factoringOffer.feePercent} onChange={(e) => updateFactoring('feePercent', Number(e.target.value) || 0)} onBlur={() => saveMark('prowizja')} /><span>%</span></div></dd>
        <dt>{t(locale, 'opt_payout_after')}</dt><dd><div className="inline-input"><input className="input" aria-label={t(locale, 'opt_payout_after')} type="number" min="1" value={factoringOffer.payoutDelayValue} onChange={(e) => updateFactoring('payoutDelayValue', Number(e.target.value) || 1)} onBlur={() => saveMark('termin')} /><select className="input" aria-label={t(locale, 'opt_payout_after')} value={factoringOffer.payoutDelayUnit} onChange={(e) => { updateFactoring('payoutDelayUnit', e.target.value as 'hours' | 'days'); saveMark('termin'); }}><option value="hours">{t(locale, 'opt_hours')}</option><option value="days">{t(locale, 'opt_days')}</option></select></div></dd>
        <dt>{t(locale, 'opt_note')}</dt><dd><input className="input full" aria-label={t(locale, 'opt_note')} value={factoringOffer.notes ?? ''} onChange={(e) => updateFactoring('notes', e.target.value)} onBlur={() => saveMark('notatka')} /></dd>
      </dl>
    ), { right: change }));
  }
  groups.push({ id: 'money', screens: money });

  groups.push({
    id: 'rules',
    screens: [
      scr('thr', (
        <>
          <OptionsHowTo locale={locale} k="b6_howto_thresh" />
          {pick('thr', OpsThresholdsForm ? block(<OpsThresholdsForm />) : <Soon locale={locale} tipKey="opt_acc_thresh_soon" />)}
        </>
      ), { right: change }),
      scr('permits', PermitRequirement ? block(<PermitRequirement />) : <Soon locale={locale} tipKey="opt_acc_perm_soon" />, { right: change }),
    ],
  });

  const system: OptScreen[] = [
    scr('status', (
      <>
        <SmsFallbackEntry />
        {SystemStatusPanel ? block(<SystemStatusPanel />) : <Soon locale={locale} tipKey="opt_acc_sys_soon" />}
      </>
    )),
    scr('flags', pick('flags', null), { right: change }),
  ];
  if (isHhlAdmin) system.push(scr('hist', pick('hist', ChangeHistoryPanel ? block(<ChangeHistoryPanel />) : null)));
  system.push(scr('export', pick('export', DataExportPanel ? block(<DataExportPanel />) : null), { right: 'download' }));
  groups.push({ id: 'system', screens: system });

  const forme: OptScreen[] = [
    scr('account', pick('account', (MyAccount || MyMfa || MyDevices) ? (
      <>
        {MyAccount ? block(<MyAccount />) : null}
        {MyMfa ? block(<MyMfa />) : null}
        {MyDevices ? block(<MyDevices />) : null}
      </>
    ) : null), { right: 'own' }),
    scr('forme', pick('forme', <ForMeScreen locale={locale} kind={null} groups={null}>{browserPrefs}</ForMeScreen>), { right: 'own' }),
    scr('look', (
      <>
        <UiPrefsPanel onSaved={saveMark} showDemoMarks={shows('demoMarksToggle')} />
        {CarrierScorecard ? block(<CarrierScorecard />) : null}
      </>
    ), { right: 'own' }),
  ];
  if (Guide) forme.push(scr('guide', block(<Guide locale={locale} role="hhl" />)));
  groups.push({ id: 'forme', screens: forme });

  for (const g of groups) {
    const s = demo?.summaries[g.id];
    if (s) { g.summary = s.text; g.summaryTone = s.tone; }
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
