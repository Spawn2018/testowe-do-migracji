/**
 * wyglad/P5 — faktoring dla przewoźnika (E4b, img/e4b-desk / -phone; decyzja 07.10, 12:52):
 *   SCX przy nowej fakturze wybiera „Standardowo (35 dni)” albo „Faktoring HHL” i widzi prowizję i kwotę wypłaty;
 *   HHL widzi zadanie „Wypłata faktoringu” z terminem 48 h od akceptacji i krokami.
 * Oferta i zadania: `src/lib/p5Source.ts` (dziś tylko demo); zapis wyboru i wypłaty podłącza wykonawca (`onChange`, `onMarkPaid`).
 */
import { useState } from 'react';
import type { Locale } from '../../types';
import { formatPlNumber } from '../../lib/format';
import { fmtDateTime, formatCalendarDay } from '../../lib/time';
import { factoringPayout } from '../../lib/p5Invoices';
import type { FactoringOfferView, FactoringTask } from '../../lib/p5Source';
import { ft, ftp } from '../../i18n/p5';
import { useTowerStore } from '../../store/useTowerStore';

/* rok zawsze — właściciel 16.10.2026: „08.10.2026”, „08.10.2026, 12:00” */
const dm = (d: string) => formatCalendarDay(d.slice(0, 10));
const dmh = (iso: string) => fmtDateTime(iso, 'Europe/Warsaw');

export function PaymentChoice({ offer, net, gross, due, currency, value, onChange }: {
  offer: FactoringOfferView;
  net: number | null;
  gross: number | null;
  due: string;
  /** Waluta faktury (EUR albo PLN) — kwoty i prowizja w tej walucie. */
  currency: string;
  value?: 'STANDARD' | 'FACTORING';
  onChange?: (v: 'STANDARD' | 'FACTORING') => void;
}) {
  const locale = useTowerStore((s) => s.locale);
  const [local, setLocal] = useState<'STANDARD' | 'FACTORING'>('STANDARD');
  const v = value ?? local;
  const set = (x: 'STANDARD' | 'FACTORING') => { setLocal(x); onChange?.(x); };
  const calc = net != null && gross != null ? factoringPayout(net, gross, offer.feePct) : null;
  const eur = (n: number | null) => (n == null ? '—' : `${formatPlNumber(n, 2)} ${currency}`);
  return (
    <fieldset className="fact-choice" data-fact-choice={v} data-deur-exempt="invoice-currency">
      <legend>{ft(locale, 'p5_fact_pay_h')}</legend>
      {(['STANDARD', 'FACTORING'] as const).map((k) => (
        <label key={k} className={`fact-opt${v === k ? ' is-on' : ''}`} data-fact-opt={k}>
          <input type="radio" name="fact-choice" checked={v === k} onChange={() => set(k)} />
          <span className="fact-opt-t">
            <b>{ft(locale, k === 'STANDARD' ? 'p5_fact_std' : 'p5_fact_hhl')}</b>
            <span className="fin-muted">
              {k === 'STANDARD'
                ? ftp(locale, 'p5_fact_std_d', { due: dm(due) })
                : ftp(locale, 'p5_fact_hhl_d', { hours: offer.hours, pct: formatPlNumber(offer.feePct, offer.feePct % 1 ? 1 : 0), fee: calc ? formatPlNumber(calc.fee, 2) : '—', cur: currency })}
            </span>
          </span>
          <b className="fact-opt-v">{k === 'STANDARD' ? eur(gross) : eur(calc?.payout ?? null)}</b>
        </label>
      ))}
      <p className="fin-muted">{ft(locale, 'p5_fact_pay_note')}</p>
    </fieldset>
  );
}

export function FactoringTaskCard({ task, nowIso, locale, onMarkPaid }: { task: FactoringTask; nowIso: string; locale: Locale; onMarkPaid?: (billId: string) => void }) {
  const [paid, setPaid] = useState<boolean>(task.paidAt != null);
  const leftH = Math.max(0, Math.round((Date.parse(task.dueAt) - Date.parse(nowIso)) / 3600000));
  const late = Date.parse(task.dueAt) < Date.parse(nowIso);
  const steps = [
    { on: true, t: ft(locale, 'p5_fact_tl_1'), d: dm(task.issuedAt) },
    { on: true, t: ft(locale, 'p5_fact_tl_2'), d: ftp(locale, 'p5_fact_tl_2d', { at: dmh(task.acceptedAt), hours: task.hours }) },
    { on: paid ? true : 'now', t: ft(locale, 'p5_fact_tl_3'), d: ftp(locale, 'p5_fact_tl_3d', { at: dmh(task.dueAt) }) },
    { on: paid, t: ft(locale, 'p5_fact_tl_4'), d: ftp(locale, 'p5_fact_tl_4d', { fee: formatPlNumber(task.fee, 2), cur: task.currency }) },
  ];
  return (
    <section className="panel fin-panel fact-task" data-fact-task={task.billId} data-deur-exempt="invoice-currency" aria-labelledby={`fact-${task.billId}`}>
      <header className="panel-hd fin-hd2"><h3 id={`fact-${task.billId}`}>{ft(locale, 'p5_fact_task_h')}</h3></header>
      <div className="fin-pad fact-task-bd">
        <div className={`fact-due${late ? ' is-late' : ''}${paid ? ' is-paid' : ''}`}>
          <span className="fact-due-h">{late ? ftp(locale, 'p5_fact_task_late', { at: dmh(task.dueAt) }) : ftp(locale, 'p5_fact_task_due', { at: dmh(task.dueAt), h: leftH })}</span>
          <b className="fact-due-v">{formatPlNumber(task.payout, 2)} {task.currency}</b>
          <span className="fin-muted" data-content>{task.number} · {task.issuer}</span>
        </div>
        {paid ? null : (
          <button type="button" className="btn fact-mark" data-fact-mark={task.billId} onClick={() => { setPaid(true); onMarkPaid?.(task.billId); }}>
            {ft(locale, 'p5_fact_task_mark')}
          </button>
        )}
        <ol className="fact-steps">
          {steps.map((s) => (
            <li key={s.t} className={s.on === true ? 'is-done' : s.on === 'now' ? 'is-now' : undefined}>
              <b>{s.t}</b>
              <span className="fin-muted">{s.d}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
