import { useMemo, useRef, useState } from 'react';
import { useTowerStore } from '../store/useTowerStore';
import { readFileAsDataUrl } from '../lib/docsIo';
import { canMatchInvoice, canSubmitInvoice, canSeeCost } from '../lib/permissions';
import { t } from '../i18n/messages';
import type { Document, FactoringOffer } from '../types';
import { DocPreview } from '../components/ui/DocPreview';
import { DocFileRow } from '../components/ui/DocFileRow';

function fmt(n: number) {
  return Math.round(n).toLocaleString('pl-PL');
}

export function InvoicesView() {
  const role = useTowerStore((s) => s.role);
  const locale = useTowerStore((s) => s.locale);
  const loads = useTowerStore((s) => s.loads);
  const invoices = useTowerStore((s) => s.invoices);
  const factoringOffer = useTowerStore((s) => s.factoringOffer);
  const updateFactoringOffer = useTowerStore((s) => s.updateFactoringOffer);
  const submitInvoice = useTowerStore((s) => s.submitInvoice);
  const resolveInvoice = useTowerStore((s) => s.resolveInvoice);
  const selectLoad = useTowerStore((s) => s.selectLoad);
  const [useFactoring, setUseFactoring] = useState(true);
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null);
  const documents = useTowerStore((s) => s.documents);
  const uploadDocument = useTowerStore((s) => s.uploadDocument);
  const attachRef = useRef<HTMLInputElement>(null);
  const [attachLoadId, setAttachLoadId] = useState<string | null>(null);

  const week = useMemo(
    () => loads.filter((l) => l.status === 'DELIVERED' || l.status === 'UNLOADING').slice(-6),
    [loads],
  );
  const expected = week.reduce((s, l) => s + l.pricing.costTotal, 0);
  const rows = week.map((l, i) => {
    const inv = l.pricing.costTotal + (i === 2 ? 1240 : i === 4 ? 600 : 0);
    const diff = inv - l.pricing.costTotal;
    return { l, inv, diff };
  });
  const invoiced = rows.reduce((s, r) => s + r.inv, 0);

  if (!canSeeCost(role) && role !== 'HHL') {
    return (
      <div className="panel section-card page-sections" data-page="invoices" style={{ margin: 12 }}>
        <div className="panel-bd" style={{ color: 'var(--ink-3)' }}>
          {t(locale, 'inv_unavailable')}
        </div>
      </div>
    );
  }

  const disputed = invoices.find((i) => i.status === 'DISPUTED') ?? invoices[0];
  const feePreview = Math.round((invoiced * factoringOffer.feePercent) / 100);
  const netPreview = invoiced - feePreview;

  return (
    <div className="invoices-page page-sections" data-page="invoices">
      <div className="panel section-card" style={{ margin: 12 }}>
        <header className="panel-hd">
          <h2>{t(locale, 'nav_inv')}</h2>
          <span className="sub">tydzień 38 · 14–20.09.2026 · Scandinavian Express</span>
          <div className="spacer" />
          {role === 'SCX' && canSubmitInvoice(role) ? (
            <button
              type="button"
              className="btn"
              onClick={() =>
                submitInvoice(
                  '2026-W38',
                  week.map((l) => l.id),
                  Object.fromEntries(
                    week.map((l, i) => [l.id, l.pricing.costTotal + (i === 2 ? 1240 : i === 4 ? 600 : 0)]),
                  ),
                  useFactoring && factoringOffer.enabled,
                )
              }
            >
              Złóż fakturę
            </button>
          ) : canMatchInvoice(role) ? (
            <>
              <button
                type="button"
                className="chipbtn"
                onClick={() => disputed && resolveInvoice(disputed.id, 'DISPUTED')}
              >
                Zgłoś spór
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => disputed && resolveInvoice(disputed.id, 'MATCHED')}
              >
                Zatwierdź
              </button>
            </>
          ) : null}
        </header>
        <div className="panel-bd flush">
          <div className="filters">
            <span>
              Kwota z cennika <b className="mono">{fmt(expected)} PLN</b>
            </span>
            <span>
              Kwota z faktury <b className="mono">{fmt(invoiced)} PLN</b>
            </span>
            <span>
              Rozbieżność{' '}
              <b className="mono" style={{ color: 'var(--red)' }}>
                +{fmt(invoiced - expected)} PLN
              </b>
            </span>
            <div className="spacer" />
            <span className="pill p-red">Do wyjaśnienia</span>
          </div>
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Wysyłka</th>
                  <th>Typ</th>
                  <th>Dostawa</th>
                  <th className="num">Wg cennika</th>
                  <th className="num">Zafakturowano</th>
                  <th className="num">Różnica</th>
                  <th>Ocena</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ l, inv, diff }) => (
                  <tr key={l.id} style={{ cursor: 'pointer' }} onClick={() => selectLoad(l.id)}>
                    <td>
                      <span className="code">{l.code}</span>
                    </td>
                    <td>{l.itemType}</td>
                    <td>{l.plannedDeliverDate}</td>
                    <td className="num">{fmt(l.pricing.costTotal)}</td>
                    <td className="num">{fmt(inv)}</td>
                    <td className={`num ${diff ? 'money neg' : ''}`}>{diff ? `+${fmt(diff)}` : '—'}</td>
                    <td>
                      {diff ? (
                        <span className="pill p-red">poza cennikiem</span>
                      ) : (
                        <span className="pill p-go">zgodna</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="note">
            Porównanie trójstronne: transporty zaznaczone przez przewoźnika ↔ transporty faktycznie zrealizowane ↔ kwota
            wynikająca z cennika. Dwie pozycje rozliczone poza macierzą — pilotaż drugiego pojazdu nie był awizowany.
          </div>
        </div>
      </div>

      {role === 'HHL' ? (
        <div className="panel section-card" style={{ margin: 12 }}>
          <header className="panel-hd">
            <h2>{t(locale, 'factoring_admin_title')}</h2>
            <span className="sub">{t(locale, 'factoring_admin_hint')}</span>
          </header>
          <div className="panel-bd">
            <dl className="kv">
              <dt>{t(locale, 'factoring_enabled')}</dt>
              <dd>
                <label>
                  <input
                    type="checkbox"
                    checked={factoringOffer.enabled}
                    onChange={(e) => updateFactoringOffer({ enabled: e.target.checked })}
                  />{' '}
                  {factoringOffer.enabled ? 'tak' : 'nie'}
                </label>
              </dd>
              <dt>{t(locale, 'factoring_fee_pct')}</dt>
              <dd>
                <input
                  className="input"
                  type="number"
                  step="0.1"
                  min={0}
                  max={20}
                  value={factoringOffer.feePercent}
                  onChange={(e) => updateFactoringOffer({ feePercent: Number(e.target.value) || 0 })}
                  style={{ width: 80 }}
                />
              </dd>
              <dt>{t(locale, 'factoring_delay')}</dt>
              <dd>
                <input
                  className="input"
                  type="number"
                  min={1}
                  value={factoringOffer.payoutDelayValue}
                  onChange={(e) =>
                    updateFactoringOffer({ payoutDelayValue: Number(e.target.value) || 1 })
                  }
                  style={{ width: 72 }}
                />{' '}
                <select
                  className="input"
                  value={factoringOffer.payoutDelayUnit}
                  onChange={(e) =>
                    updateFactoringOffer({
                      payoutDelayUnit: e.target.value as FactoringOffer['payoutDelayUnit'],
                    })
                  }
                >
                  <option value="hours">{t(locale, 'factoring_unit_hours')}</option>
                  <option value="days">{t(locale, 'factoring_unit_days')}</option>
                </select>
              </dd>
              <dt>{t(locale, 'factoring_label')}</dt>
              <dd>
                <input
                  className="input"
                  style={{ width: '100%' }}
                  value={factoringOffer.label}
                  onChange={(e) => updateFactoringOffer({ label: e.target.value })}
                />
              </dd>
            </dl>
          </div>
        </div>
      ) : null}

      {role === 'SCX' && canSubmitInvoice(role) && factoringOffer.enabled ? (
        <div className="panel section-card" style={{ margin: 12 }}>
          <header className="panel-hd">
            <h2>{t(locale, 'factoring_payment_mode')}</h2>
            <span className="sub">{factoringOffer.label}</span>
          </header>
          <div className="panel-bd">
            <div className="mrow">
              <span className="lbl">
                <label>
                  <input
                    type="radio"
                    name="paymode"
                    checked={!useFactoring}
                    onChange={() => setUseFactoring(false)}
                  />{' '}
                  {t(locale, 'factoring_standard')}
                </label>
              </span>
              <span style={{ color: 'var(--ink-3)', fontSize: 12.5 }}>{t(locale, 'factoring_standard_hint')}</span>
            </div>
            <div className="mrow">
              <span className="lbl">
                <label>
                  <input
                    type="radio"
                    name="paymode"
                    checked={useFactoring}
                    onChange={() => setUseFactoring(true)}
                  />{' '}
                  {t(locale, 'factoring_option')}
                </label>
              </span>
              <span style={{ color: 'var(--ink-3)', fontSize: 12.5 }}>
                {t(locale, 'factoring_option_hint')
                  .replace('{fee}', String(factoringOffer.feePercent))
                  .replace(
                    '{delay}',
                    `${factoringOffer.payoutDelayValue} ${
                      factoringOffer.payoutDelayUnit === 'hours'
                        ? t(locale, 'factoring_unit_hours')
                        : t(locale, 'factoring_unit_days')
                    }`,
                  )}
              </span>
            </div>
            {useFactoring ? (
              <>
                <div className="mrow">
                  <span className="lbl">{t(locale, 'factoring_gross')}</span>
                  <span>{fmt(invoiced)} PLN</span>
                </div>
                <div className="mrow">
                  <span className="lbl">{t(locale, 'factoring_fee')}</span>
                  <span>
                    −{fmt(feePreview)} PLN ({factoringOffer.feePercent}%)
                  </span>
                </div>
                <div className="mrow total">
                  <span>{t(locale, 'factoring_net')}</span>
                  <span>{fmt(netPreview)} PLN</span>
                </div>
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      {invoices.some((i) => i.factoring?.selected) ? (
        <div className="panel section-card" style={{ margin: 12 }}>
          <header className="panel-hd">
            <h2>{t(locale, 'factoring_review_title')}</h2>
          </header>
          <div className="panel-bd">
            {invoices
              .filter((i) => i.factoring?.selected)
              .slice(0, 4)
              .map((i) => (
                <div key={i.id} className="mrow">
                  <span className="lbl">
                    {i.weekLabel} · <span className="pill p-amber">{t(locale, 'factoring_badge')}</span>
                  </span>
                  <span>
                    net {fmt(i.factoring!.netPayout)} · {i.payoutStatus ?? 'NONE'}
                    {i.factoring?.payoutAt ? ` · ${i.factoring.payoutAt.slice(0, 16)}` : ''}
                  </span>
                </div>
              ))}
          </div>
        </div>
      ) : null}

      <div className="panel section-card" style={{ margin: 12 }}>
        <header className="panel-hd">
          <h2>Załączniki CMR / POD</h2>
          <span className="sub">dokumenty do faktury tygodnia · podgląd i pobieranie</span>
          <div className="spacer" />
          {role === 'SCX' || role === 'HHL' ? (
            <button
              type="button"
              className="btn"
              onClick={() => {
                const id = week[0]?.id;
                if (!id) return;
                setAttachLoadId(id);
                attachRef.current?.click();
              }}
            >
              Wgraj załącznik
            </button>
          ) : null}
        </header>
        <div className="panel-bd">
          {week.length === 0 ? (
            <div className="note" style={{ border: 0, padding: 0 }}>
              Brak transportów w rozliczeniu.
            </div>
          ) : (
            week.flatMap((l) => {
              const docs = documents.filter(
                (d) =>
                  d.loadId === l.id &&
                  (d.category === 'CMR' || d.category === 'POD') &&
                  (d.status === 'UPLOADED' || d.status === 'MISSING'),
              );
              if (docs.length === 0) {
                return [
                  <div key={`${l.id}-empty`} className="mrow">
                    <span className="lbl">
                      <span className="code">{l.code}</span> · CMR
                    </span>
                    <span style={{ color: 'var(--red)' }}>brak</span>
                  </div>,
                ];
              }
              return docs.map((d) => (
                <DocFileRow
                  key={d.id}
                  doc={d}
                  label={`${l.code} · ${d.category}`}
                  onPreview={setPreviewDoc}
                  showUpload={role === 'SCX' || role === 'HHL'}
                  onUploadClick={() => {
                    setAttachLoadId(l.id);
                    attachRef.current?.click();
                  }}
                />
              ));
            })
          )}
        </div>
        <input
          ref={attachRef}
          type="file"
          accept="image/*,application/pdf"
          className="sronly"
          aria-label="Wybierz załącznik CMR lub POD"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f || !attachLoadId) return;
            void readFileAsDataUrl(f)
              .then((r) => {
                const cat = /pod/i.test(r.name) ? 'POD' : 'CMR';
                uploadDocument(attachLoadId, cat as 'CMR' | 'POD', r.name, {
                  dataUrl: r.dataUrl,
                  mimeType: r.mimeType,
                  bytes: r.bytes,
                });
              })
              .catch(() => {
                useTowerStore.getState().pushToast('Nie udało się odczytać pliku', 'HIGH');
              });
          }}
        />
      </div>

      <DocPreview doc={previewDoc} onClose={() => setPreviewDoc(null)} />

    </div>
  );
}
