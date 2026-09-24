import { useMemo, useRef, useState } from 'react';
import { useTowerStore } from '../store/useTowerStore';
import { readFileAsDataUrl } from '../lib/docsIo';
import { canMatchInvoice, canSubmitInvoice, canSeeCost } from '../lib/permissions';
import { t } from '../i18n/messages';
import type { Document, FactoringOffer } from '../types';
import { DocPreview } from '../components/ui/DocPreview';
import { DocFileRow } from '../components/ui/DocFileRow';
import {
  billedMapFromInvoiceLines,
  buildThreeWayMatch,
  isLoadCompleted,
  rateCardExpected,
  threeWayVerdictLabel,
  threeWayVerdictPill,
} from '../lib/invoiceMatch';
import { formatOpsDateTime, formatTableDay, refYearInOps } from '../lib/time';
import { getNow } from '../lib/frozenNow';
import { formatAppMoney } from '../lib/money/demoFx';

/** D25 — week label from invoice / ISO week, not hard-coded copy. */
function weekSubtitle(weekLabel: string | null | undefined, locale: 'pl' | 'en' | 'sv'): string {
  const m = (weekLabel ?? '').match(/(\d{4})-W(\d{1,2})/i);
  if (!m) return weekLabel || '';
  const year = Number(m[1]);
  const week = Number(m[2]);
  // ISO week: Thursday of week determines dates — approximate Mon–Sun via UTC Thursday
  const simple = new Date(Date.UTC(year, 0, 1 + (week - 1) * 7));
  const dow = simple.getUTCDay();
  const mon = new Date(simple);
  mon.setUTCDate(simple.getUTCDate() - ((dow + 6) % 7));
  const sun = new Date(mon);
  sun.setUTCDate(mon.getUTCDate() + 6);
  const fmt = (d: Date) =>
    `${String(d.getUTCDate()).padStart(2, '0')}.${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  const word = locale === 'en' ? 'week' : locale === 'sv' ? 'vecka' : 'tydzień';
  return `${word} ${week} · ${fmt(mon)}–${fmt(sun)}.${year} · Scandinavian Express`;
}
import { docCategoryLabel, payoutStatusLabel } from '../lib/enumLabels';

export function InvoicesView() {
  const role = useTowerStore((s) => s.role);
  const locale = useTowerStore((s) => s.locale);
  const refYear = refYearInOps(getNow());
  const currency = useTowerStore((s) => s.displayCurrency);
  const money = (n: number) => formatAppMoney(n, locale, currency);
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

  const completed = useMemo(() => loads.filter(isLoadCompleted), [loads]);
  /** Prefer open W38 dispute / submit as billed SoT; else last completed as draft selection. */
  const focusInvoice = useMemo(() => {
    return (
      invoices.find((i) => i.weekLabel === '2026-W38' && (i.status === 'DISPUTED' || i.status === 'SUBMITTED')) ??
      invoices.find((i) => i.status === 'DISPUTED') ??
      invoices.find((i) => i.status === 'SUBMITTED') ??
      null
    );
  }, [invoices]);

  const week = useMemo(() => {
    if (focusInvoice?.lines.length) {
      const ids = new Set(focusInvoice.lines.map((ln) => ln.loadId));
      const fromInv = loads.filter((l) => ids.has(l.id));
      const extras = completed.filter((l) => !ids.has(l.id)).slice(-4);
      return [...fromInv, ...extras];
    }
    return completed.slice(-6);
  }, [focusInvoice, loads, completed]);

  const match = useMemo(() => {
    const selectedIds = focusInvoice?.lines.map((ln) => ln.loadId) ?? week.map((l) => l.id);
    const billedByLoadId = focusInvoice
      ? billedMapFromInvoiceLines(focusInvoice.lines)
      : Object.fromEntries(week.map((l) => [l.id, rateCardExpected(l)]));
    return buildThreeWayMatch({
      loads: week,
      selectedIds,
      billedByLoadId,
    });
  }, [focusInvoice, week]);

  const expected = match.expectedTotal;
  const invoiced = match.billedTotal;
  const rows = match.lines;

  if (!canSeeCost(role) && role !== 'HHL') {
    return (
      <div className="panel section-card page-sections" data-page="invoices" style={{ margin: 12 }}>
        <div className="panel-bd" style={{ color: 'var(--ink-3)' }}>
          {t(locale, 'inv_unavailable')}
        </div>
      </div>
    );
  }

  const disputed = focusInvoice ?? invoices.find((i) => i.status === 'DISPUTED') ?? invoices[0];
  const feePreview = Math.round((invoiced * factoringOffer.feePercent) / 100);
  const netPreview = invoiced - feePreview;

  return (
    <div className="invoices-page page-sections" data-page="invoices">
      <div className="panel section-card" style={{ margin: 12 }}>
        <header className="panel-hd">
          <h2>{t(locale, 'nav_inv')}</h2>
          <span className="sub">{weekSubtitle(focusInvoice?.weekLabel ?? disputed?.weekLabel ?? '2026-W38', locale)}</span>
          <div className="spacer" />
          {role === 'SCX' && canSubmitInvoice(role) ? (
            <button
              type="button"
              className="btn"
              onClick={() =>
                submitInvoice(
                  '2026-W38',
                  week.filter(isLoadCompleted).map((l) => l.id),
                  Object.fromEntries(
                    week.filter(isLoadCompleted).map((l) => [l.id, rateCardExpected(l)]),
                  ),
                  useFactoring && factoringOffer.enabled,
                )
              }
            >
              {t(locale, 'inv_submit')}
            </button>
          ) : canMatchInvoice(role) ? (
            <>
              <button
                type="button"
                className="chipbtn"
                onClick={() => disputed && resolveInvoice(disputed.id, 'DISPUTED')}
              >
                {t(locale, 'btn_dispute')}
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => disputed && resolveInvoice(disputed.id, 'MATCHED')}
              >
                {t(locale, 'btn_approve')}
              </button>
            </>
          ) : null}
        </header>
        <div className="panel-bd flush">
          <div className="filters">
            <span>
              Kwota z cennika <b className="mono">{money(expected)}</b>
            </span>
            <span>
              Kwota z faktury <b className="mono">{money(invoiced)}</b>
            </span>
            <span>
              {t(locale, 'inv_diff')}{' '}
              <b
                className="mono"
                style={{ color: match.diffTotal === 0 ? 'var(--go)' : 'var(--red)' }}
              >
                {match.diffTotal > 0 ? '+' : ''}
                {money(match.diffTotal)}
              </b>
            </span>
            <div className="spacer" />
            <span className={`pill ${match.openCount ? 'p-red' : 'p-go'}`}>
              {match.openCount ? `${t(locale, 'inv_to_clarify')} · ${match.openCount}` : t(locale, 'inv_match_ok')}
            </span>
          </div>
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>{t(locale, 'sched_col_code')}</th>
                  <th>{t(locale, 'inv_type')}</th>
                  <th>{t(locale, 'inv_delivery')}</th>
                  <th className="num">Wg cennika</th>
                  <th className="num">Zafakturowano</th>
                  <th className="num">{t(locale, 'inv_diff_col')}</th>
                  <th>Ocena</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.loadId}
                    style={{ cursor: 'pointer' }}
                    onClick={() => selectLoad(row.loadId)}
                  >
                    <td>
                      <span className="code" data-content>{row.code}</span>
                    </td>
                    <td data-content>{row.itemType}</td>
                    <td>{formatTableDay(row.deliverDate === '—' ? null : row.deliverDate, refYear)}</td>
                    <td className="num">{money(row.expected)}</td>
                    <td className="num">{row.selected ? money(row.billed) : '—'}</td>
                    <td className={`num ${row.diff ? 'money neg' : ''}`}>
                      {row.diff ? `${row.diff > 0 ? '+' : ''}${money(row.diff)}` : '—'}
                    </td>
                    <td>
                      <span className={`pill ${threeWayVerdictPill(row.verdict)}`}>
                        {threeWayVerdictLabel(row.verdict)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="note">
            {t(locale, 'inv_three_way')}
            {' '}(<span className="code">pricing.costTotal</span>). {t(locale, 'inv_threshold_note')} ±
            {money(match.threshold)} · otwarte: {match.openCount}.
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
                  <span>{money(invoiced)}</span>
                </div>
                <div className="mrow">
                  <span className="lbl">{t(locale, 'factoring_fee')}</span>
                  <span>
                    −{money(feePreview)} ({factoringOffer.feePercent}%)
                  </span>
                </div>
                <div className="mrow total">
                  <span>{t(locale, 'factoring_net')}</span>
                  <span>{money(netPreview)}</span>
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
                    net {money(i.factoring!.netPayout)} · {payoutStatusLabel(i.payoutStatus, locale)}
                    {i.factoring?.payoutAt ? ` · ${formatOpsDateTime(i.factoring.payoutAt)}` : ''}
                  </span>
                </div>
              ))}
          </div>
        </div>
      ) : null}

      <div className="panel section-card" style={{ margin: 12 }}>
        <header className="panel-hd">
          <h2>{t(locale, 'inv_attachments')}</h2>
          <span className="sub">{t(locale, 'inv_docs_sub')}</span>
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
              {t(locale, 'btn_attach')}
            </button>
          ) : null}
        </header>
        <div className="panel-bd">
          {week.length === 0 ? (
            <div className="note" style={{ border: 0, padding: 0 }}>
              {t(locale, 'inv_empty')}
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
                  label={`${l.code} · ${docCategoryLabel(d.category, locale)}`}
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
