import { lazy, Suspense, useState } from 'react';
import { useTowerStore } from '../store/useTowerStore';
import type { BafParams, FactoringOffer, Locale, RateRule } from '../types';
import { geofenceDisplayName, geofenceTypeLabel, workflowDisplayName } from '../lib/enumLabels';
import { hasKey, t } from '../i18n/messages';

/** A6-T2 — znacznik „Zapisano · …” w aktywnym języku (PL bez zmian). */
function savedText(locale: Locale, code: string): string {
  const k = `a6_saved_${code.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l')}`;
  return hasKey(locale, k) ? t(locale, k) : code;
}
import { DemoMark } from '../components/ui/DemoMark';
import { DEMO_FX_META } from '../lib/money/demoFx';
import { SUPABASE_AUTH_ENABLED } from '../auth/config';
import { UiPrefsPanel } from '../components/settings/UiPrefsPanel';
import { canSeeWorkflows, PROD_BUILD, shows } from '../lib/prodFacade';

// BK2: panel użytkowników HHL_ADMIN — tylko w trybie Supabase.
const Guide = import.meta.env.VITE_AUTH_MODE === 'supabase' && SUPABASE_AUTH_ENABLED ? lazy(() => import('../components/guide/Guide')) : null;
const MyMfa = import.meta.env.VITE_AUTH_MODE === 'supabase' && SUPABASE_AUTH_ENABLED ? lazy(() => import('../auth/Mfa')) : null;
const UsersAdmin = import.meta.env.VITE_AUTH_MODE === 'supabase' && SUPABASE_AUTH_ENABLED ? lazy(() => import('../auth/UsersAdmin')) : null;
/* ANEKS 5 §4.4 — Moje urządzenia / Wyloguj ze wszystkich urządzeń (tylko Supabase) */
/* I-2f — prawdziwy formularz BAF/SEFS (0052) zamiast fasady — tylko Supabase */
const BafForm = import.meta.env.VITE_AUTH_MODE === 'supabase' && SUPABASE_AUTH_ENABLED ? lazy(() => import('../auth/BafForm')) : null;
/* I-19 — formularz cennika HHL (0065) — tylko Supabase */
const RateCardForm = import.meta.env.VITE_AUTH_MODE === 'supabase' && SUPABASE_AUTH_ENABLED ? lazy(() => import('../auth/RateCardForm')) : null;
/* I-3 — bramka SMS (0067/0068) — tylko Supabase */
const SmsGateway = import.meta.env.VITE_AUTH_MODE === 'supabase' && SUPABASE_AUTH_ENABLED ? lazy(() => import('../auth/SmsGateway')) : null;
/* I-27 — wymóg zezwoleń dla transportów ponadnormatywnych (0084) — tylko Supabase */
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
  const setView = useTowerStore((s) => s.setView);
  const [saved, setSaved] = useState('');

  if (role !== 'HHL') {
    return <div className="panel section-card" style={{ margin: 12 }}><div className="panel-bd"><b>{t(locale, "opt_hhl_only")}</b></div></div>;
  }

  const saveMark = (label: string) => {
    setSaved(label);
    window.setTimeout(() => setSaved(''), 1600);
  };
  const updateBafField = (key: keyof BafParams, value: string) => {
    const numeric = ['baseValue', 'currentValue', 'fuelShare', 'triggerThreshold', 'roundingStep', 'floorPct', 'capPct'];
    updateBaf({ [key]: numeric.includes(key) ? Number(value) || 0 : value } as Partial<BafParams>);
  };
  const updateFactoring = <K extends keyof FactoringOffer>(key: K, value: FactoringOffer[K]) => updateFactoringOffer({ [key]: value });

  return (
    <div className="options-page">
      <header className="options-title">
        <div><div className="eyebrow">{t(locale, 'a6_opt_eyebrow')}</div><h1>{t(locale, "opt_title")}</h1><p>{t(locale, 'opt_subtitle')}</p></div>
        {saved ? <span className="pill p-go">{t(locale, "opt_saved")} · {savedText(locale, saved)}</span> : null}
      </header>

      <div className="options-grid">
        {PROD_BUILD ? (RateCardForm ? <Suspense fallback={null}><RateCardForm /></Suspense> :
          <section className="panel option-panel option-wide pricing-panel" data-no-source="rate-card">
            <header className="panel-hd"><h2>{t(locale, "opt_rates_h2")}</h2></header>
            <div className="panel-bd"><div className="note option-note">{t(locale, 'i2_rates_no_source')}</div></div>
          </section>
        ) : (
          <>
        <section className="panel option-panel option-wide pricing-panel" data-deur-exempt="rate-card-source" title={t(locale, 'a6_opt_deur_rates')}>
          <header className="panel-hd"><h2>{t(locale, "opt_rates_h2")}</h2><span className="sub">{`${t(locale, "opt_rates_sub")} · ${t(locale, 'a6_cur_eur')}`}</span><span className="panel-mark">{t(locale, "opt_rates_mark")}</span><DemoMark /></header>
          <div className="panel-bd">
            <div className="rate-grid">
              <RateEditor side="COST" rules={rateCost} currency="EUR" locale={locale} onChange={(id, value) => updateRate('COST', id, value)} onSave={() => saveMark('cennik')} />
              <RateEditor side="REVENUE" rules={rateRev} currency="EUR" locale={locale} onChange={(id, value) => updateRate('REVENUE', id, value)} onSave={() => saveMark('cennik')} />
            </div>
            <div className="note option-note">{t(locale, 'opt_rates_note')} {` · ${t(locale, 'opt_fx_demo')} ${DEMO_FX_META.tableLabel} · ${DEMO_FX_META.effectiveDate} · ${DEMO_FX_META.mid.toFixed(4).replace('.', ',')}.`}</div>
          </div>
        </section>

          <section className="panel option-panel option-wide fuel-panel" data-deur-exempt="fuel-index" title={t(locale, 'a6_opt_deur_fuel')}>
          <header className="panel-hd"><h2>{t(locale, "opt_fuel_h2")}</h2><span className="sub">{t(locale, 'opt_fuel_sub')} · {t(locale, 'opt_baf_facade_mark')}</span><span className="panel-mark">{t(locale, "opt_fuel_mark")}</span><DemoMark /></header>
          <div className="panel-bd">
            <div className="fuel-grid">
              <div><h4 className="sec">{t(locale, "opt_index_read")}</h4><dl className="kv options-kv fuel-kv">{bafFields.slice(0, 6).map((field) => <div className="kv-row" key={String(field.key)}><dt>{t(locale, field.labelKey)}</dt><dd><div className="input-unit"><input className="input full" type={field.type ?? 'text'} step={field.step} value={String(baf[field.key])} readOnly disabled title={t(locale, 'opt_baf_facade_title')} onChange={(e) => updateBafField(field.key, e.target.value)} onBlur={() => saveMark('BAF')} />{field.suffix ? <span>{t(locale, field.suffix)}</span> : null}</div></dd></div>)}</dl></div>
              <div><h4 className="sec">{t(locale, "opt_billing_rules")}</h4><dl className="kv options-kv fuel-kv">{bafFields.slice(6).map((field) => <div className="kv-row" key={String(field.key)}><dt>{t(locale, field.labelKey)}</dt><dd><div className="input-unit"><input className="input full" type={field.type ?? 'text'} step={field.step} value={String(baf[field.key])} readOnly disabled title={t(locale, 'opt_baf_facade_title')} onChange={(e) => updateBafField(field.key, e.target.value)} onBlur={() => saveMark('BAF')} />{field.suffix ? <span>{t(locale, field.suffix)}</span> : null}</div></dd></div>)}</dl></div>
            </div>
            <div className="note option-note" data-facade="baf-options">{t(locale, 'opt_baf_facade_note')}</div>
          </div>
        </section>

          </>
        )}
        {BafForm && <Suspense fallback={null}><BafForm /></Suspense>}
        {SmsGateway && <Suspense fallback={null}><SmsGateway /></Suspense>}
        {PermitRequirement && <Suspense fallback={null}><PermitRequirement /></Suspense>}
        {CarrierScorecard && <Suspense fallback={null}><CarrierScorecard /></Suspense>}

        <UiPrefsPanel onSaved={saveMark} showDemoMarks={shows('demoMarksToggle')} />

        {shows('factoringOffer') ? <section className="panel option-panel">
          <header className="panel-hd"><h2>{t(locale, "opt_factoring_h2")}</h2><span className="sub">{t(locale, "opt_factoring_sub")}</span></header>
          <div className="panel-bd"><dl className="kv options-kv">
            <dt>{t(locale, "opt_active")}</dt><dd><label className="switchline"><input type="checkbox" checked={factoringOffer.enabled} onChange={(e) => { updateFactoring('enabled', e.target.checked); saveMark('factoring'); }} /><span>{factoringOffer.enabled ? t(locale, 'yes') : t(locale, 'no')}</span></label></dd>
            <dt>{t(locale, "opt_offer_name")}</dt><dd><input className="input full" aria-label={t(locale, "opt_offer_name")} value={factoringOffer.label ?? ''} onChange={(e) => updateFactoring('label', e.target.value)} onBlur={() => saveMark('oferta')} /></dd>
            <dt>{t(locale, "opt_fee")}</dt><dd><div className="inline-input"><input className="input" aria-label={t(locale, "opt_fee")} type="number" min="0" max="20" step="0.1" value={factoringOffer.feePercent} onChange={(e) => updateFactoring('feePercent', Number(e.target.value) || 0)} onBlur={() => saveMark('prowizja')} /><span>%</span></div></dd>
            <dt>{t(locale, 'opt_payout_after')}</dt><dd><div className="inline-input"><input className="input" aria-label={t(locale, 'opt_payout_after')} type="number" min="1" value={factoringOffer.payoutDelayValue} onChange={(e) => updateFactoring('payoutDelayValue', Number(e.target.value) || 1)} onBlur={() => saveMark('termin')} /><select className="input" aria-label={t(locale, 'opt_payout_after')} value={factoringOffer.payoutDelayUnit} onChange={(e) => { updateFactoring('payoutDelayUnit', e.target.value as 'hours' | 'days'); saveMark('termin'); }}><option value="hours">{t(locale, "opt_hours")}</option><option value="days">{t(locale, "opt_days")}</option></select></div></dd>
            <dt>{t(locale, "opt_note")}</dt><dd><input className="input full" aria-label={t(locale, "opt_note")} value={factoringOffer.notes ?? ''} onChange={(e) => updateFactoring('notes', e.target.value)} onBlur={() => saveMark('notatka')} /></dd>
          </dl></div>
        </section> : null}


        <section className="panel option-panel">
          <header className="panel-hd"><h2>{t(locale, "opt_geo_h2")}</h2><span className="sub">{geofences.filter((g) => g.active).length}/{geofences.length} {t(locale, "opt_active_n")}</span></header>
          <div className="panel-bd flush"><div className="settings-list">{geofences.map((g) => <div className="settings-row" key={g.id}><div><b data-content>{geofenceDisplayName(g.name, locale)}</b><span>{geofenceTypeLabel(g.type, locale)} · {g.radiusM >= 1000 ? `${Math.round(g.radiusM / 1000)} km` : `${g.radiusM} m`}</span></div><button type="button" className={`mini-toggle${g.active ? ' is-on' : ''}`} aria-pressed={g.active} onClick={() => { saveGeofence({ ...g, active: !g.active }); saveMark('strefa'); }}><i />{g.active ? t(locale, 'on') : t(locale, 'off')}</button></div>)}</div></div>
        </section>

        <section className="panel option-panel">
          <header className="panel-hd"><h2>{t(locale, "opt_notif_h2")}</h2><span className="sub">{notifications.filter((n) => !n.read).length} {t(locale, "opt_unread")}</span></header>
          <div className="panel-bd"><div className="pref-list">
            {([['workflowAlerts', t(locale, 'opt_wf_rules')], ['geofenceAlerts', t(locale, 'opt_geo_alerts')], ['riskAlerts', t(locale, 'opt_risk_alerts')]] as const).filter(([key]) => key !== 'workflowAlerts' || !PROD_BUILD).map(([key, label]) => <label key={key} className="switchline"><input type="checkbox" checked={notificationPrefs?.[key] ?? true} onChange={(e) => { updateNotificationPrefs({ [key]: e.target.checked }); saveMark('powiadomienia'); }} /><span>{label}</span></label>)}
          </div><div className="note option-note">{t(locale, 'opt_notif_filter_note')}</div><button type="button" className="chipbtn" onClick={() => useTowerStore.getState().markAllNotificationsRead('HHL')}>{t(locale, "opt_mark_read")}</button></div>
        </section>

        {canSeeWorkflows() ? <section className="panel option-panel option-wide">
          <header className="panel-hd"><h2>{t(locale, "opt_auto_h2")}</h2><span className="sub">{workflows.filter((w) => w.enabled).length} {t(locale, "opt_active_of")} {workflows.length}</span><div className="spacer" /><button type="button" className="chipbtn" onClick={() => setView('wf')}>{t(locale, 'opt_open_wf')}</button></header>
          <div className="panel-bd"><div className="workflow-summary">{workflows.map((w) => <button type="button" className="workflow-summary-row" key={w.id} onClick={() => setView('wf')}><span className={`status-dot${w.enabled ? ' on' : ''}`} /><span data-content>{workflowDisplayName(w, locale)}</span><small>{w.enabled ? t(locale, 'on') : t(locale, 'off')}</small></button>)}</div></div>
        </section> : null}
        {Guide && <Suspense fallback={null}><Guide locale={locale} role="hhl" /></Suspense>}
        {MyMfa && <Suspense fallback={null}><MyMfa /></Suspense>}
        {MyDevices && <Suspense fallback={null}><MyDevices /></Suspense>}
        {UsersAdmin && <Suspense fallback={null}><UsersAdmin /></Suspense>}
      </div>
    </div>
  );
}
