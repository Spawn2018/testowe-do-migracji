import { useState } from 'react';
import { useTowerStore } from '../store/useTowerStore';
import { defaultThemeForRole } from '../lib/permissions';
import type { BafParams, FactoringOffer, RateRule } from '../types';
import { geofenceTypeLabel } from '../lib/enumLabels';
import { t } from '../i18n/messages';
import { DemoMark } from '../components/ui/DemoMark';
import { DEMO_FX_META } from '../lib/money/demoFx';

const bafFields: Array<{ key: keyof BafParams; labelKey: string; type?: 'number' | 'text'; step?: string; suffix?: string }> = [
  { key: 'indexSource', labelKey: 'baf_index', type: 'text' },
  { key: 'baseValue', labelKey: 'baf_base', type: 'number', step: '0.01', suffix: 'SEK/l' },
  { key: 'baseDate', labelKey: 'baf_base_date', type: 'text' },
  { key: 'currentValue', labelKey: 'baf_current', type: 'number', step: '0.01', suffix: 'SEK/l' },
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
  const theme = useTowerStore((s) => s.theme);
  const displayCurrency = useTowerStore((s) => s.displayCurrency);
  const setLocale = useTowerStore((s) => s.setLocale);
  const setDisplayCurrency = useTowerStore((s) => s.setDisplayCurrency);
  const setTheme = useTowerStore((s) => s.setTheme);
  const showDemoMarks = useTowerStore((s) => s.showDemoMarks);
  const setShowDemoMarks = useTowerStore((s) => s.setShowDemoMarks);
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
        <div><div className="eyebrow">HHL · ADMIN</div><h1>{t(locale, "opt_title")}</h1><p>{t(locale, 'opt_subtitle')}</p></div>
        {saved ? <span className="pill p-go">{t(locale, "opt_saved")} · {saved}</span> : null}
      </header>

      <div className="options-grid">
        <section className="panel option-panel option-wide pricing-panel">
          <header className="panel-hd"><h2>{t(locale, "opt_rates_h2")}</h2><span className="sub">{`${t(locale, "opt_rates_sub")} · EUR`}</span><span className="panel-mark">{t(locale, "opt_rates_mark")}</span><DemoMark /></header>
          <div className="panel-bd">
            <div className="rate-grid">
              <RateEditor side="COST" rules={rateCost} currency="EUR" locale={locale} onChange={(id, value) => updateRate('COST', id, value)} onSave={() => saveMark('cennik')} />
              <RateEditor side="REVENUE" rules={rateRev} currency="EUR" locale={locale} onChange={(id, value) => updateRate('REVENUE', id, value)} onSave={() => saveMark('cennik')} />
            </div>
            <div className="note option-note">{t(locale, 'opt_rates_note')} {` · ${t(locale, 'opt_fx_demo')} ${DEMO_FX_META.tableLabel} · ${DEMO_FX_META.effectiveDate} · ${DEMO_FX_META.mid.toFixed(4).replace('.', ',')}.`}</div>
          </div>
        </section>

        <section className="panel option-panel option-wide fuel-panel" data-deur-exempt="fuel-index" title="D-EUR-T: indeks paliwowy (wyjątek)">
          <header className="panel-hd"><h2>{t(locale, "opt_fuel_h2")}</h2><span className="sub">{t(locale, 'opt_fuel_sub')} · {t(locale, 'opt_baf_facade_mark')}</span><span className="panel-mark">{t(locale, "opt_fuel_mark")}</span><DemoMark /></header>
          <div className="panel-bd">
            <div className="fuel-grid">
              <div><h4 className="sec">{t(locale, "opt_index_read")}</h4><dl className="kv options-kv fuel-kv">{bafFields.slice(0, 6).map((field) => <div className="kv-row" key={String(field.key)}><dt>{t(locale, field.labelKey)}</dt><dd><div className="input-unit"><input className="input full" type={field.type ?? 'text'} step={field.step} value={String(baf[field.key])} readOnly disabled title={t(locale, 'opt_baf_facade_title')} onChange={(e) => updateBafField(field.key, e.target.value)} onBlur={() => saveMark('BAF')} />{field.suffix ? <span>{field.suffix}</span> : null}</div></dd></div>)}</dl></div>
              <div><h4 className="sec">{t(locale, "opt_billing_rules")}</h4><dl className="kv options-kv fuel-kv">{bafFields.slice(6).map((field) => <div className="kv-row" key={String(field.key)}><dt>{t(locale, field.labelKey)}</dt><dd><div className="input-unit"><input className="input full" type={field.type ?? 'text'} step={field.step} value={String(baf[field.key])} readOnly disabled title={t(locale, 'opt_baf_facade_title')} onChange={(e) => updateBafField(field.key, e.target.value)} onBlur={() => saveMark('BAF')} />{field.suffix ? <span>{field.suffix}</span> : null}</div></dd></div>)}</dl></div>
            </div>
            <div className="note option-note" data-facade="baf-options">{t(locale, 'opt_baf_facade_note')}</div>
          </div>
        </section>

        <section className="panel option-panel">
          <header className="panel-hd"><h2>{t(locale, "opt_ui_prefs")}</h2><span className="sub">{t(locale, 'opt_defaults')}</span></header>
          <div className="panel-bd"><dl className="kv options-kv">
            <dt>{t(locale, 'opt_demo_marks')}</dt><dd><label className="switchline"><input type="checkbox" checked={showDemoMarks} onChange={(e) => { setShowDemoMarks(e.target.checked); saveMark('demo'); }} /><span>{showDemoMarks ? t(locale, 'on') : t(locale, 'off')}</span></label><div className="muted" style={{ marginTop: 4 }}>{t(locale, 'opt_demo_marks_sub')}</div></dd>
            <dt>{t(locale, 'opt_lang')}</dt><dd><select className="input" value={locale} onChange={(e) => { setLocale(e.target.value as 'pl' | 'en' | 'sv'); saveMark('język'); }}><option value="pl">Polski</option><option value="en">English</option><option value="sv">Svenska</option></select></dd>
            <dt>{t(locale, 'opt_currency')}</dt><dd data-deur-exempt="currency-pref" title="D-EUR-T: wybór waluty (wyjątek)"><select className="input" value={displayCurrency} onChange={(e) => { setDisplayCurrency(e.target.value as 'EUR' | 'PLN'); saveMark('waluta'); }}><option value="PLN">PLN</option><option value="EUR">EUR</option></select></dd>
            <dt>{t(locale, "opt_theme")}</dt><dd><select className="input" value={theme} onChange={(e) => { setTheme(e.target.value as 'dark' | 'light'); saveMark('motyw'); }}><option value="dark">{t(locale, "opt_theme_dark")}</option><option value="light">{t(locale, "opt_theme_light")}</option></select></dd>
            <dt>{t(locale, 'opt_theme_default')}</dt><dd className="muted">{defaultThemeForRole('HHL') === 'dark' ? t(locale, 'opt_theme_dark_hhl') : t(locale, 'opt_theme_light')}</dd>
          </dl><div className="note option-note">{t(locale, 'opt_theme_note')}</div></div>
        </section>

        <section className="panel option-panel">
          <header className="panel-hd"><h2>{t(locale, "opt_factoring_h2")}</h2><span className="sub">{t(locale, "opt_factoring_sub")}</span></header>
          <div className="panel-bd"><dl className="kv options-kv">
            <dt>{t(locale, "opt_active")}</dt><dd><label className="switchline"><input type="checkbox" checked={factoringOffer.enabled} onChange={(e) => { updateFactoring('enabled', e.target.checked); saveMark('factoring'); }} /><span>{factoringOffer.enabled ? t(locale, 'yes') : t(locale, 'no')}</span></label></dd>
            <dt>{t(locale, "opt_offer_name")}</dt><dd><input className="input full" value={factoringOffer.label ?? ''} onChange={(e) => updateFactoring('label', e.target.value)} onBlur={() => saveMark('oferta')} /></dd>
            <dt>{t(locale, "opt_fee")}</dt><dd><div className="inline-input"><input className="input" type="number" min="0" max="20" step="0.1" value={factoringOffer.feePercent} onChange={(e) => updateFactoring('feePercent', Number(e.target.value) || 0)} onBlur={() => saveMark('prowizja')} /><span>%</span></div></dd>
            <dt>{t(locale, 'opt_payout_after')}</dt><dd><div className="inline-input"><input className="input" type="number" min="1" value={factoringOffer.payoutDelayValue} onChange={(e) => updateFactoring('payoutDelayValue', Number(e.target.value) || 1)} onBlur={() => saveMark('termin')} /><select className="input" value={factoringOffer.payoutDelayUnit} onChange={(e) => { updateFactoring('payoutDelayUnit', e.target.value as 'hours' | 'days'); saveMark('termin'); }}><option value="hours">{t(locale, "opt_hours")}</option><option value="days">{t(locale, "opt_days")}</option></select></div></dd>
            <dt>{t(locale, "opt_note")}</dt><dd><input className="input full" value={factoringOffer.notes ?? ''} onChange={(e) => updateFactoring('notes', e.target.value)} onBlur={() => saveMark('notatka')} /></dd>
          </dl></div>
        </section>


        <section className="panel option-panel">
          <header className="panel-hd"><h2>{t(locale, "opt_geo_h2")}</h2><span className="sub">{geofences.filter((g) => g.active).length}/{geofences.length} {t(locale, "opt_active_n")}</span></header>
          <div className="panel-bd flush"><div className="settings-list">{geofences.map((g) => <div className="settings-row" key={g.id}><div><b data-content>{g.name}</b><span>{geofenceTypeLabel(g.type, locale)} · {g.radiusM >= 1000 ? `${Math.round(g.radiusM / 1000)} km` : `${g.radiusM} m`}</span></div><button type="button" className={`mini-toggle${g.active ? ' is-on' : ''}`} aria-pressed={g.active} onClick={() => { saveGeofence({ ...g, active: !g.active }); saveMark('strefa'); }}><i />{g.active ? t(locale, 'on') : t(locale, 'off')}</button></div>)}</div></div>
        </section>

        <section className="panel option-panel">
          <header className="panel-hd"><h2>{t(locale, "opt_notif_h2")}</h2><span className="sub">{notifications.filter((n) => !n.read).length} {t(locale, "opt_unread")}</span></header>
          <div className="panel-bd"><div className="pref-list">
            {([['workflowAlerts', t(locale, 'opt_wf_rules')], ['geofenceAlerts', t(locale, 'opt_geo_alerts')], ['riskAlerts', t(locale, 'opt_risk_alerts')]] as const).map(([key, label]) => <label key={key} className="switchline"><input type="checkbox" checked={notificationPrefs?.[key] ?? true} onChange={(e) => { updateNotificationPrefs({ [key]: e.target.checked }); saveMark('powiadomienia'); }} /><span>{label}</span></label>)}
          </div><div className="note option-note">{t(locale, 'opt_notif_filter_note')}</div><button type="button" className="chipbtn" onClick={() => useTowerStore.getState().markAllNotificationsRead('HHL')}>{t(locale, "opt_mark_read")}</button></div>
        </section>

        <section className="panel option-panel option-wide">
          <header className="panel-hd"><h2>{t(locale, "opt_auto_h2")}</h2><span className="sub">{workflows.filter((w) => w.enabled).length} {t(locale, "opt_active_of")} {workflows.length}</span><div className="spacer" /><button type="button" className="chipbtn" onClick={() => setView('wf')}>{t(locale, 'opt_open_wf')}</button></header>
          <div className="panel-bd"><div className="workflow-summary">{workflows.map((w) => <button type="button" className="workflow-summary-row" key={w.id} onClick={() => setView('wf')}><span className={`status-dot${w.enabled ? ' on' : ''}`} /><span data-content>{w.name}</span><small>{w.enabled ? t(locale, 'on') : t(locale, 'off')}</small></button>)}</div></div>
        </section>
      </div>
    </div>
  );
}
