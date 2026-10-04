import { lazy, Suspense, useMemo, useState, type ReactNode } from 'react';
import { useTowerStore } from '../store/useTowerStore';
import type { BafParams, FactoringOffer, Locale, RateRule } from '../types';
import { geofenceDisplayName, geofenceTypeLabel, workflowDisplayName } from '../lib/enumLabels';
import { hasKey, t } from '../i18n/messages';
import { DemoMark } from '../components/ui/DemoMark';
import { DEMO_FX_META } from '../lib/money/demoFx';
import { SUPABASE_AUTH_ENABLED } from '../auth/config';
import { UiPrefsPanel } from '../components/settings/UiPrefsPanel';
import { OptionsAccordion, type OptionsSectionDef } from '../components/settings/OptionsAccordion';
import { SmsFallbackEntry } from '../components/shell/SmsFallbackEntry';
import { canSeeWorkflows, PROD_BUILD, shows } from '../lib/prodFacade';

/** A6-T2 — znacznik „Zapisano · …” w aktywnym języku (PL bez zmian). */
function savedText(locale: Locale, code: string): string {
  const k = `a6_saved_${code.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l')}`;
  return hasKey(locale, k) ? t(locale, k) : code;
}

const Guide = import.meta.env.VITE_AUTH_MODE === 'supabase' && SUPABASE_AUTH_ENABLED ? lazy(() => import('../components/guide/Guide')) : null;
const MyMfa = import.meta.env.VITE_AUTH_MODE === 'supabase' && SUPABASE_AUTH_ENABLED ? lazy(() => import('../auth/Mfa')) : null;
const UsersAdmin = import.meta.env.VITE_AUTH_MODE === 'supabase' && SUPABASE_AUTH_ENABLED ? lazy(() => import('../auth/UsersAdmin')) : null;
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
  const notifications = useTowerStore((s) => s.notifications);
  const workflows = useTowerStore((s) => s.workflows);
  const smsEntry = useTowerStore((s) => s.smsEntry);
  const setView = useTowerStore((s) => s.setView);
  const [saved, setSaved] = useState('');

  const saveMark = (label: string) => {
    setSaved(label);
    window.setTimeout(() => setSaved(''), 1600);
  };
  const updateBafField = (key: keyof BafParams, value: string) => {
    const numeric = ['baseValue', 'currentValue', 'fuelShare', 'triggerThreshold', 'roundingStep', 'floorPct', 'capPct'];
    updateBaf({ [key]: numeric.includes(key) ? Number(value) || 0 : value } as Partial<BafParams>);
  };
  const updateFactoring = <K extends keyof FactoringOffer>(key: K, value: FactoringOffer[K]) => updateFactoringOffer({ [key]: value });

  const geoActive = geofences.filter((g) => g.active).length;
  const unread = notifications.filter((n) => !n.read).length;
  const wfOn = workflows.filter((w) => w.enabled).length;

  const sections: OptionsSectionDef[] = useMemo(() => {
    if (role !== 'HHL') return [];
    const list: OptionsSectionDef[] = [];

    list.push({
      id: 'notif-dec',
      titleKey: 'opt_acc_notif_title',
      descKey: 'opt_acc_notif_desc',
      count: String(unread),
      keywords: 'macierz decyzje powiadomienia matrix',
      children: (
        <>
          {NotificationMatrixForm ? <SuspenseBlock><NotificationMatrixForm /></SuspenseBlock> : null}
          <div className="pref-list" style={{ marginTop: 10 }}>
            {([['workflowAlerts', t(locale, 'opt_wf_rules')], ['geofenceAlerts', t(locale, 'opt_geo_alerts')], ['riskAlerts', t(locale, 'opt_risk_alerts')]] as const)
              .filter(([key]) => key !== 'workflowAlerts' || !PROD_BUILD)
              .map(([key, label]) => (
                <label key={key} className="switchline">
                  <input type="checkbox" checked={notificationPrefs?.[key] ?? true} onChange={(e) => { updateNotificationPrefs({ [key]: e.target.checked }); saveMark('powiadomienia'); }} />
                  <span>{label}</span>
                </label>
              ))}
          </div>
          <div className="note option-note">{t(locale, 'opt_notif_filter_note')}</div>
          <button type="button" className="chipbtn" onClick={() => useTowerStore.getState().markAllNotificationsRead('HHL')}>{t(locale, 'opt_mark_read')}</button>
          {canSeeWorkflows() ? (
            <div style={{ marginTop: 12 }}>
              <div className="note">{t(locale, 'opt_auto_h2')}: {wfOn}/{workflows.length} — ONE-MECH / D-29</div>
              <div className="workflow-summary">
                {workflows.map((w) => (
                  <button type="button" className="workflow-summary-row" key={w.id} onClick={() => setView('wf')}>
                    <span className={`status-dot${w.enabled ? ' on' : ''}`} />
                    <span data-content>{workflowDisplayName(w, locale)}</span>
                    <small>{w.enabled ? t(locale, 'on') : t(locale, 'off')}</small>
                  </button>
                ))}
              </div>
              <button type="button" className="chipbtn" onClick={() => setView('wf')}>{t(locale, 'opt_open_wf')}</button>
            </div>
          ) : null}
        </>
      ),
    });

    list.push({
      id: 'sms-zones',
      titleKey: 'opt_acc_sms_title',
      descKey: 'opt_acc_sms_desc',
      count: `${geoActive}/${geofences.length}`,
      keywords: 'sms strefy geofence bramka recipients',
      children: (
        <>
          {SmsZoneRecipients ? <SuspenseBlock><SmsZoneRecipients /></SuspenseBlock> : null}
          {SmsGateway ? <SuspenseBlock><SmsGateway /></SuspenseBlock> : null}
          <div className="settings-list" style={{ marginTop: 10 }}>
            {geofences.map((g) => (
              <div className="settings-row" key={g.id}>
                <div>
                  <b data-content>{geofenceDisplayName(g.name, locale)}</b>
                  <span>{geofenceTypeLabel(g.type, locale)} · {g.radiusM >= 1000 ? `${Math.round(g.radiusM / 1000)} km` : `${g.radiusM} m`}</span>
                </div>
                <button type="button" className={`mini-toggle${g.active ? ' is-on' : ''}`} aria-pressed={g.active} onClick={() => { saveGeofence({ ...g, active: !g.active }); saveMark('strefa'); }}>
                  <i />{g.active ? t(locale, 'on') : t(locale, 'off')}
                </button>
              </div>
            ))}
          </div>
        </>
      ),
    });

    list.push({
      id: 'thresholds',
      titleKey: 'opt_acc_thresh_title',
      descKey: 'opt_acc_thresh_desc',
      count: '10',
      keywords: 'progi fala wiatr opóźnienie awizacja',
      children: OpsThresholdsForm
        ? <SuspenseBlock><OpsThresholdsForm /></SuspenseBlock>
        : <Soon locale={locale} tipKey="opt_acc_thresh_soon" />,
    });

    list.push({
      id: 'dwell',
      titleKey: 'opt_acc_dwell_title',
      descKey: 'opt_acc_dwell_desc',
      count: '7',
      keywords: 'czas wolny przestój postój dopłata WSTĘPNE',
      children: DwellOptionsForm
        ? <SuspenseBlock><DwellOptionsForm /></SuspenseBlock>
        : <Soon locale={locale} tipKey="opt_acc_dwell_note" />,
    });

    list.push({
      id: 'system',
      titleKey: 'opt_acc_sys_title',
      descKey: 'opt_acc_sys_desc',
      keywords: 'integracje sharepoint kopia backup sms bramka',
      children: (
        <>
          <SmsFallbackEntry />
          {SystemStatusPanel
            ? <SuspenseBlock><SystemStatusPanel /></SuspenseBlock>
            : <Soon locale={locale} tipKey="opt_acc_sys_soon" />}
        </>
      ),
    });

    list.push({
      id: 'users',
      titleKey: 'opt_acc_users_title',
      descKey: 'opt_acc_users_desc',
      keywords: 'użytkownicy sesje 2fa mfa hasło devices',
      children: (
        <>
          {UsersAdmin ? <SuspenseBlock><UsersAdmin /></SuspenseBlock> : null}
          {MyMfa ? <SuspenseBlock><MyMfa /></SuspenseBlock> : null}
          {MyDevices ? <SuspenseBlock><MyDevices /></SuspenseBlock> : null}
          {!UsersAdmin && !MyMfa && !MyDevices ? <Soon locale={locale} tipKey="opt_acc_users_soon" /> : null}
        </>
      ),
    });

    list.push({
      id: 'auth-log',
      titleKey: 'opt_acc_authlog_title',
      descKey: 'opt_acc_authlog_desc',
      keywords: 'dziennik logowań auth',
      children: AuthLoginLog
        ? <SuspenseBlock><AuthLoginLog /></SuspenseBlock>
        : <Soon locale={locale} tipKey="opt_acc_authlog_soon" />,
    });

    list.push({
      id: 'broadcast',
      titleKey: 'opt_acc_bcast_title',
      descKey: 'opt_acc_bcast_desc',
      keywords: 'komunikat baner',
      children: BroadcastForm
        ? <SuspenseBlock><BroadcastForm /></SuspenseBlock>
        : <Soon locale={locale} tipKey="opt_acc_bcast_soon" />,
    });

    list.push({
      id: 'history',
      titleKey: 'opt_acc_hist_title',
      descKey: 'opt_acc_hist_desc',
      keywords: 'historia zmian audit dziennik było jest',
      children: ChangeHistoryPanel
        ? <SuspenseBlock><ChangeHistoryPanel /></SuspenseBlock>
        : <Soon locale={locale} tipKey="opt_acc_hist_soon" />,
    });

    list.push({
      id: 'export',
      titleKey: 'opt_acc_export_title',
      descKey: 'opt_acc_export_desc',
      keywords: 'eksport csv xlsx',
      children: DataExportPanel
        ? <SuspenseBlock><DataExportPanel /></SuspenseBlock>
        : <Soon locale={locale} tipKey="opt_acc_export_soon" />,
    });

    list.push({
      id: 'rates',
      titleKey: 'opt_acc_rates_title',
      descKey: 'opt_acc_rates_desc',
      keywords: 'cennik rate card',
      children: PROD_BUILD ? (
        RateCardForm ? <SuspenseBlock><RateCardForm /></SuspenseBlock> : (
          <div className="note option-note">{t(locale, 'i2_rates_no_source')}</div>
        )
      ) : (
        <>
          <div className="rate-grid">
            <RateEditor side="COST" rules={rateCost} currency="EUR" locale={locale} onChange={(id, value) => updateRate('COST', id, value)} onSave={() => saveMark('cennik')} />
            <RateEditor side="REVENUE" rules={rateRev} currency="EUR" locale={locale} onChange={(id, value) => updateRate('REVENUE', id, value)} onSave={() => saveMark('cennik')} />
          </div>
          <div className="note option-note">{t(locale, 'opt_rates_note')} {` · ${t(locale, 'opt_fx_demo')} ${DEMO_FX_META.tableLabel} · ${DEMO_FX_META.effectiveDate} · ${DEMO_FX_META.mid.toFixed(4).replace('.', ',')}.`}</div>
          {RateCardForm ? <SuspenseBlock><RateCardForm /></SuspenseBlock> : null}
        </>
      ),
    });

    list.push({
      id: 'sefs',
      titleKey: 'opt_acc_sefs_title',
      descKey: 'opt_acc_sefs_desc',
      keywords: 'sefs baf paliwo',
      children: (
        <>
          {BafForm ? <SuspenseBlock><BafForm /></SuspenseBlock> : (
            <>
              <div className="fuel-grid">
                <div><h4 className="sec">{t(locale, 'opt_index_read')}</h4><dl className="kv options-kv fuel-kv">{bafFields.slice(0, 6).map((field) => <div className="kv-row" key={String(field.key)}><dt>{t(locale, field.labelKey)}</dt><dd><div className="input-unit"><input className="input full" type={field.type ?? 'text'} step={field.step} value={String(baf[field.key])} readOnly disabled title={t(locale, 'opt_baf_facade_title')} onChange={(e) => updateBafField(field.key, e.target.value)} onBlur={() => saveMark('BAF')} />{field.suffix ? <span>{t(locale, field.suffix)}</span> : null}</div></dd></div>)}</dl></div>
                <div><h4 className="sec">{t(locale, 'opt_billing_rules')}</h4><dl className="kv options-kv fuel-kv">{bafFields.slice(6).map((field) => <div className="kv-row" key={String(field.key)}><dt>{t(locale, field.labelKey)}</dt><dd><div className="input-unit"><input className="input full" type={field.type ?? 'text'} step={field.step} value={String(baf[field.key])} readOnly disabled title={t(locale, 'opt_baf_facade_title')} onChange={(e) => updateBafField(field.key, e.target.value)} onBlur={() => saveMark('BAF')} />{field.suffix ? <span>{t(locale, field.suffix)}</span> : null}</div></dd></div>)}</dl></div>
              </div>
              <div className="note option-note" data-facade="baf-options">{t(locale, 'opt_baf_facade_note')}</div>
            </>
          )}
        </>
      ),
    });

    list.push({
      id: 'permits',
      titleKey: 'opt_acc_perm_title',
      descKey: 'opt_acc_perm_desc',
      keywords: 'zezwolenia permit',
      children: PermitRequirement ? <SuspenseBlock><PermitRequirement /></SuspenseBlock> : <Soon locale={locale} tipKey="opt_acc_perm_soon" />,
    });

    list.push({
      id: 'prefs',
      titleKey: 'opt_acc_prefs_title',
      descKey: 'opt_acc_prefs_desc',
      keywords: 'preferencje ui motyw język',
      children: (
        <>
          <UiPrefsPanel onSaved={saveMark} showDemoMarks={shows('demoMarksToggle')} />
          {CarrierScorecard ? <SuspenseBlock><CarrierScorecard /></SuspenseBlock> : null}
          {shows('factoringOffer') ? (
            <dl className="kv options-kv" style={{ marginTop: 12 }}>
              <dt>{t(locale, 'opt_active')}</dt><dd><label className="switchline"><input type="checkbox" checked={factoringOffer.enabled} onChange={(e) => { updateFactoring('enabled', e.target.checked); saveMark('factoring'); }} /><span>{factoringOffer.enabled ? t(locale, 'yes') : t(locale, 'no')}</span></label></dd>
              <dt>{t(locale, 'opt_offer_name')}</dt><dd><input className="input full" aria-label={t(locale, 'opt_offer_name')} value={factoringOffer.label ?? ''} onChange={(e) => updateFactoring('label', e.target.value)} onBlur={() => saveMark('oferta')} /></dd>
              <dt>{t(locale, 'opt_fee')}</dt><dd><div className="inline-input"><input className="input" aria-label={t(locale, 'opt_fee')} type="number" min="0" max="20" step="0.1" value={factoringOffer.feePercent} onChange={(e) => updateFactoring('feePercent', Number(e.target.value) || 0)} onBlur={() => saveMark('prowizja')} /><span>%</span></div></dd>
              <dt>{t(locale, 'opt_payout_after')}</dt><dd><div className="inline-input"><input className="input" aria-label={t(locale, 'opt_payout_after')} type="number" min="1" value={factoringOffer.payoutDelayValue} onChange={(e) => updateFactoring('payoutDelayValue', Number(e.target.value) || 1)} onBlur={() => saveMark('termin')} /><select className="input" aria-label={t(locale, 'opt_payout_after')} value={factoringOffer.payoutDelayUnit} onChange={(e) => { updateFactoring('payoutDelayUnit', e.target.value as 'hours' | 'days'); saveMark('termin'); }}><option value="hours">{t(locale, 'opt_hours')}</option><option value="days">{t(locale, 'opt_days')}</option></select></div></dd>
              <dt>{t(locale, 'opt_note')}</dt><dd><input className="input full" aria-label={t(locale, 'opt_note')} value={factoringOffer.notes ?? ''} onChange={(e) => updateFactoring('notes', e.target.value)} onBlur={() => saveMark('notatka')} /></dd>
            </dl>
          ) : null}
          {Guide ? <SuspenseBlock><Guide locale={locale} role="hhl" /></SuspenseBlock> : null}
        </>
      ),
    });

    return list;
  }, [
    role, locale, unread, geoActive, geofences, wfOn, workflows, notificationPrefs,
    rateCost, rateRev, baf, factoringOffer, saveGeofence, updateNotificationPrefs,
    updateRate, setView, updateFactoringOffer, updateBaf,
  ]);

  if (role !== 'HHL') {
    return <div className="panel section-card" style={{ margin: 12 }}><div className="panel-bd"><b>{t(locale, 'opt_hhl_only')}</b></div></div>;
  }

  return (
    <div className="options-page" data-dec6="shell">
      <header className="options-title">
        <div>
          <div className="eyebrow">{t(locale, 'a6_opt_eyebrow')}</div>
          <h1>{t(locale, 'opt_title')}</h1>
          <p>{t(locale, 'opt_acc_subtitle')}</p>
        </div>
        {saved ? <span className="pill p-go">{t(locale, 'opt_saved')} · {savedText(locale, saved)}</span> : null}
      </header>
      <OptionsAccordion locale={locale} sections={sections} forceOpen={smsEntry ? 'system' : null} />
    </div>
  );
}
