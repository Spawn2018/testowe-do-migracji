import { useState } from 'react';
import { useTowerStore } from '../store/useTowerStore';
import { defaultThemeForRole } from '../lib/permissions';
import type { BafParams, FactoringOffer, RateRule } from '../types';

const bafFields: Array<{ key: keyof BafParams; label: string; type?: 'number' | 'text'; step?: string; suffix?: string }> = [
  { key: 'indexSource', label: 'Źródło indeksu', type: 'text' },
  { key: 'baseValue', label: 'Cena bazowa', type: 'number', step: '0.01', suffix: 'SEK/l' },
  { key: 'baseDate', label: 'Okres bazowy', type: 'text' },
  { key: 'currentValue', label: 'Cena bieżąca', type: 'number', step: '0.01', suffix: 'SEK/l' },
  { key: 'valueDate', label: 'Odczyt na dzień', type: 'text' },
  { key: 'fuelShare', label: 'Udział paliwa', type: 'number', step: '0.01', suffix: '%' },
  { key: 'triggerThreshold', label: 'Próg naliczania', type: 'number', step: '0.01', suffix: '%' },
  { key: 'roundingStep', label: 'Krok zaokrąglenia', type: 'number', step: '0.01' },
  { key: 'floorPct', label: 'Minimum dopłaty', type: 'number', step: '0.1', suffix: '%' },
  { key: 'capPct', label: 'Maksimum dopłaty', type: 'number', step: '0.1', suffix: '%' },
  { key: 'sourceUrl', label: 'URL źródła', type: 'text' },
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
}: {
  side: 'COST' | 'REVENUE';
  rules: RateRule[];
  onChange: (id: string, value: number) => void;
  onSave: () => void;
  currency: 'EUR' | 'PLN';
}) {
  return (
    <div className="options-page page-sections" data-page="options">
      <div className="rate-editor-head"><b>{side === 'COST' ? 'Koszt SCX' : 'Przychód HHL'}</b><span>{currency} · baza bez SEFS</span></div>
      {rules.map((rule, index) => (
        <div className="rate-line" key={rule.id}>
          <div className="rate-copy"><b>Linia {index + 1}</b><span>{formatRate(rule)}</span></div>
          <label className="rate-value"><input aria-label={`${side === 'COST' ? 'Koszt' : 'Przychód'} linia ${index + 1}`} className="input rate-input" type="number" min="0" step="1" value={rule.baseRate} onChange={(e) => onChange(rule.id, Number(e.target.value) || 0)} onBlur={onSave} /><span>{currency}</span></label>
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
    return <div className="panel section-card" style={{ margin: 12 }}><div className="panel-bd"><b>Opcje są dostępne tylko dla HHL.</b></div></div>;
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
        <div><div className="eyebrow">HHL · ADMINISTRACJA</div><h1>Opcje</h1><p>Cennik SCX i parametry paliwowe dla bieżącego profilu HHL.</p></div>
        {saved ? <span className="pill p-go">Zapisano · {saved}</span> : null}
      </header>

      <div className="options-grid">
        <section className="panel option-panel option-wide pricing-panel">
          <header className="panel-hd"><h2>SCX · cennik bazowy</h2><span className="sub">{`szybka edycja linii bazowych · ${displayCurrency}`}</span><span className="panel-mark">CENNIK</span></header>
          <div className="panel-bd">
            <div className="rate-grid">
              <RateEditor side="COST" rules={rateCost} currency={displayCurrency} onChange={(id, value) => updateRate('COST', id, value)} onSave={() => saveMark('cennik')} />
              <RateEditor side="REVENUE" rules={rateRev} currency={displayCurrency} onChange={(id, value) => updateRate('REVENUE', id, value)} onSave={() => saveMark('cennik')} />
            </div>
            <div className="note option-note">Kwoty bazowe przed doliczeniem SEFS. Zapis następuje od razu w profilu HHL.</div>
          </div>
        </section>

        <section className="panel option-panel option-wide fuel-panel">
          <header className="panel-hd"><h2>BAF / SEFS · paliwo</h2><span className="sub">indeks, progi i ograniczenia dopłaty</span><span className="panel-mark">PALIWO</span></header>
          <div className="panel-bd">
            <div className="fuel-grid">
              <div><h4 className="sec">Odczyt indeksu</h4><dl className="kv options-kv fuel-kv">{bafFields.slice(0, 6).map((field) => <div className="kv-row" key={String(field.key)}><dt>{field.label}</dt><dd><div className="input-unit"><input className="input full" type={field.type ?? 'text'} step={field.step} value={String(baf[field.key])} onChange={(e) => updateBafField(field.key, e.target.value)} onBlur={() => saveMark('BAF')} />{field.suffix ? <span>{field.suffix}</span> : null}</div></dd></div>)}</dl></div>
              <div><h4 className="sec">Zasady naliczania</h4><dl className="kv options-kv fuel-kv">{bafFields.slice(6).map((field) => <div className="kv-row" key={String(field.key)}><dt>{field.label}</dt><dd><div className="input-unit"><input className="input full" type={field.type ?? 'text'} step={field.step} value={String(baf[field.key])} onChange={(e) => updateBafField(field.key, e.target.value)} onBlur={() => saveMark('BAF')} />{field.suffix ? <span>{field.suffix}</span> : null}</div></dd></div>)}</dl></div>
            </div>
            <div className="note option-note">BAF/SEFS dotyczy wyłącznie frachtu drogowego. Parametry są zapisywane do <span className="code">baf</span> i używane przy kolejnych snapshotach wyceny.</div>
          </div>
        </section>

        <section className="panel option-panel">
          <header className="panel-hd"><h2>Preferencje interfejsu</h2><span className="sub">domyślne dla HHL</span></header>
          <div className="panel-bd"><dl className="kv options-kv">
            <dt>Język aplikacji</dt><dd><select className="input" value={locale} onChange={(e) => { setLocale(e.target.value as 'pl' | 'en' | 'sv'); saveMark('język'); }}><option value="pl">Polski</option><option value="en">English</option><option value="sv">Svenska</option></select></dd>
            <dt>Waluta wyświetlania</dt><dd><select className="input" value={displayCurrency} onChange={(e) => { setDisplayCurrency(e.target.value as 'EUR' | 'PLN'); saveMark('waluta'); }}><option value="PLN">PLN</option><option value="EUR">EUR</option></select></dd>
            <dt>Motyw</dt><dd><select className="input" value={theme} onChange={(e) => { setTheme(e.target.value as 'dark' | 'light'); saveMark('motyw'); }}><option value="dark">Ciemny · HHL</option><option value="light">Jasny</option></select></dd>
            <dt>Domyślny motyw</dt><dd className="muted">{defaultThemeForRole('HHL') === 'dark' ? 'Ciemny (HHL)' : 'Jasny'}</dd>
          </dl><div className="note option-note">Zmiana motywu jest zapisywana lokalnie dla bieżącego profilu.</div></div>
        </section>

        <section className="panel option-panel">
          <header className="panel-hd"><h2>Oferta factoringu</h2><span className="sub">widoczna dla SCX przy fakturze</span></header>
          <div className="panel-bd"><dl className="kv options-kv">
            <dt>Aktywna</dt><dd><label className="switchline"><input type="checkbox" checked={factoringOffer.enabled} onChange={(e) => { updateFactoring('enabled', e.target.checked); saveMark('factoring'); }} /><span>{factoringOffer.enabled ? 'Tak' : 'Nie'}</span></label></dd>
            <dt>Nazwa oferty</dt><dd><input className="input full" value={factoringOffer.label ?? ''} onChange={(e) => updateFactoring('label', e.target.value)} onBlur={() => saveMark('oferta')} /></dd>
            <dt>Prowizja</dt><dd><div className="inline-input"><input className="input" type="number" min="0" max="20" step="0.1" value={factoringOffer.feePercent} onChange={(e) => updateFactoring('feePercent', Number(e.target.value) || 0)} onBlur={() => saveMark('prowizja')} /><span>%</span></div></dd>
            <dt>Wypłata po</dt><dd><div className="inline-input"><input className="input" type="number" min="1" value={factoringOffer.payoutDelayValue} onChange={(e) => updateFactoring('payoutDelayValue', Number(e.target.value) || 1)} onBlur={() => saveMark('termin')} /><select className="input" value={factoringOffer.payoutDelayUnit} onChange={(e) => { updateFactoring('payoutDelayUnit', e.target.value as 'hours' | 'days'); saveMark('termin'); }}><option value="hours">godzinach</option><option value="days">dniach</option></select></div></dd>
            <dt>Notatka</dt><dd><input className="input full" value={factoringOffer.notes ?? ''} onChange={(e) => updateFactoring('notes', e.target.value)} onBlur={() => saveMark('notatka')} /></dd>
          </dl></div>
        </section>


        <section className="panel option-panel">
          <header className="panel-hd"><h2>Strefy geograficzne</h2><span className="sub">{geofences.filter((g) => g.active).length}/{geofences.length} aktywnych</span></header>
          <div className="panel-bd flush"><div className="settings-list">{geofences.map((g) => <div className="settings-row" key={g.id}><div><b>{g.name}</b><span>{g.type} · {g.radiusM >= 1000 ? `${Math.round(g.radiusM / 1000)} km` : `${g.radiusM} m`}</span></div><button type="button" className={`mini-toggle${g.active ? ' is-on' : ''}`} aria-pressed={g.active} onClick={() => { saveGeofence({ ...g, active: !g.active }); saveMark('strefa'); }}><i />{g.active ? 'WŁ.' : 'WYŁ.'}</button></div>)}</div></div>
        </section>

        <section className="panel option-panel">
          <header className="panel-hd"><h2>Powiadomienia</h2><span className="sub">{notifications.filter((n) => !n.read).length} nieprzeczytanych</span></header>
          <div className="panel-bd"><div className="pref-list">
            {([['workflowAlerts', 'Reguły automatyzacji'], ['geofenceAlerts', 'Wjazd / wyjazd ze strefy'], ['riskAlerts', 'Ryzyka i opóźnienia']] as const).map(([key, label]) => <label key={key} className="switchline"><input type="checkbox" checked={notificationPrefs?.[key] ?? true} onChange={(e) => { updateNotificationPrefs({ [key]: e.target.checked }); saveMark('powiadomienia'); }} /><span>{label}</span></label>)}
          </div><button type="button" className="chipbtn" onClick={() => useTowerStore.getState().markAllNotificationsRead('HHL')}>Oznacz wszystkie jako przeczytane</button></div>
        </section>

        <section className="panel option-panel option-wide">
          <header className="panel-hd"><h2>Automatyzacje</h2><span className="sub">{workflows.filter((w) => w.enabled).length} aktywnych z {workflows.length}</span><div className="spacer" /><button type="button" className="chipbtn" onClick={() => setView('wf')}>Otwórz Automatyzacje →</button></header>
          <div className="panel-bd"><div className="workflow-summary">{workflows.map((w) => <button type="button" className="workflow-summary-row" key={w.id} onClick={() => setView('wf')}><span className={`status-dot${w.enabled ? ' on' : ''}`} /><span>{w.name}</span><small>{w.enabled ? 'WŁ.' : 'WYŁ.'}</small></button>)}</div></div>
        </section>
      </div>
    </div>
  );
}
