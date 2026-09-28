/**
 * M6 — faktury v2 (MECHANIZM_PIENIEDZY §6, ZLECENIE §8 / Aneks 1–2). Wzorce makiety: panel / tablewrap / kv / mrow / pill.
 *   HHL — „Faktury kosztowe” (weryfikacja faktur SCX, „Opłacona”) i „Faktury przychodowe” (kreator jak u SCX).
 *   SCX — rejestracja faktury kosztowej (waluta EUR / PLN), lista ze statusami i terminem; bez „Opłacona”.
 *   KSH — wyłącznie faktury HHL → KSH: PDF + CMR + POD, kontrola względem cen KSH (nigdy koszt),
 *         ZGODNA / SPORNA (z uzasadnieniem) / ZAAKCEPTOWANA, termin i status płatności.
 * Kwoty w walucie faktury → `data-deur-exempt="invoice-currency"`.
 */
import { useEffect, useMemo, useState } from 'react';
import { useTowerStore } from '../store/useTowerStore';
import { t } from '../i18n/messages';
import type { Bill, BillDirection, BillLineFx, BillVerification, Document, Locale } from '../types';
import { getNowIso } from '../lib/frozenNow';
import { isoWeekKeyLocal, localDateOf } from '../lib/money/engine';
import { unloadedAtOf } from '../lib/money/loadMoney';
import {
  BILL_FLAG_LABEL, PAYMENT_LABEL, VERIFICATION_LABEL, billCandidates, billPaymentToday, billVisibleTo,
  canMarkPaid, canRegisterBill, computedEurFor, canVerifyBill, checkBill, expectedNetFor, invoicedLoadIds, isoWeekMonday,
  addDaysIso, paymentPill, reminderPlan, reminderRecipients, suggestLineFx, verificationPill, type BillDraft,
} from '../lib/invoices3';
import { DocFileRow } from '../components/ui/DocFileRow';
import { DocPreview } from '../components/ui/DocPreview';
import { canReplyDispute, disputeActorSide, paymentBlockedByDispute, type DisputeEvent } from '../lib/invoiceDispute';

/** III-7 — historia sporu (zgłoszenie → odpowiedź / korekta wystawcy → rozstrzygnięcie) i odpowiedź wystawcy. */
function DisputeThread({ bill }: { bill: Bill }) {
  const role = useTowerStore((s) => s.role);
  const locale = useTowerStore((s) => s.locale);
  const [events, setEvents] = useState<DisputeEvent[] | null>(null);
  const [reply, setReply] = useState('');
  const [tick, setTick] = useState(0);
  const server = import.meta.env.VITE_AUTH_MODE === 'supabase';
  useEffect(() => {
    if (import.meta.env.VITE_AUTH_MODE !== 'supabase') return;
    let alive = true;
    const load = () => void import('../data/invoiceDisputeServer')
      .then((m) => m.loadDisputeEvents(bill.id))
      .then((ev) => { if (alive) setEvents(ev); })
      .catch(() => { if (alive) setEvents([]); });
    load();
    // zmiana statusu zapisuje się w tle (write-through) — drugi odczyt po chwili dociąga wpis z wyzwalacza
    const again = setTimeout(load, 1500);
    return () => { alive = false; clearTimeout(again); };
  }, [bill.id, bill.verification, tick]);
  // demo: zgłoszenie z uzasadnienia faktury + odpowiedzi z bieżącej sesji
  const [demoReplies, setDemoReplies] = useState<DisputeEvent[]>([]);
  const list: DisputeEvent[] = server
    ? events ?? []
    : [
        ...(bill.disputeNote ? [{ id: 'd0', kind: 'OPENED' as const, statusTo: 'SPORNA', note: bill.disputeNote, at: bill.createdAt ?? '' }] : []),
        ...demoReplies,
      ];
  const send = async () => {
    const st = useTowerStore.getState();
    const text = reply.trim();
    if (!text) { st.pushToast(t(locale, 'iii7_reply_empty'), 'HIGH'); return; }
    try {
      if (import.meta.env.VITE_AUTH_MODE === 'supabase') {
        await (await import('../data/invoiceDisputeServer')).replyDispute(bill.id, text);
        setTick((x) => x + 1);
      } else {
        setDemoReplies((xs) => [...xs, { id: `r${xs.length + 1}`, kind: 'REPLY', statusTo: 'SPORNA', note: text, at: getNowIso() }]);
      }
      setReply('');
      st.pushToast(t(locale, 'iii7_reply_sent'), 'MEDIUM');
    } catch (e) {
      st.pushToast(t(locale, 'iii6_err').replace('{msg}', e instanceof Error ? e.message : String(e)), 'HIGH');
    }
  };
  if (!list.length && !canReplyDispute(role, bill)) return null;
  return (
    <div className="note" data-dispute-thread={bill.id}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{t(locale, 'iii7_thread')}</div>
      {list.map((e) => (
        <div key={e.id} className="mrow" data-dispute-event={e.kind}>
          <span className="lbl">
            {fmtDay(e.at ? e.at.slice(0, 10) : null)} · {disputeActorSide(e.kind) === 'issuer' ? bill.issuer : bill.recipient} · {t(locale, `iii7_k_${e.kind}`)}
            {e.kind === 'RESOLVED' && e.statusTo ? ` (${VERIFICATION_LABEL[e.statusTo as BillVerification]?.[locale] ?? e.statusTo})` : ''}
          </span>
          <span data-content>{e.note ?? ''}</span>
        </div>
      ))}
      {canReplyDispute(role, bill) ? (
        <div className="filters" data-bill-actions="dispute-reply">
          <input className="input" style={{ flex: 1, minWidth: 220 }} placeholder={t(locale, 'iii7_reply_ph')} value={reply}
            onChange={(e) => setReply(e.target.value)} aria-label={t(locale, 'iii7_reply_ph')} data-dispute-reply="" />
          <button type="button" className="btn" data-action="dispute-reply" onClick={() => void send()}>{t(locale, 'iii7_reply')}</button>
        </div>
      ) : null}
    </div>
  );
}

const fmtCur = (n: number | null | undefined, cur: string, locale: Locale) =>
  n == null ? '—' : new Intl.NumberFormat(locale === 'sv' ? 'sv-SE' : locale === 'en' ? 'en-GB' : 'pl-PL', { style: 'currency', currency: cur, minimumFractionDigits: 2 }).format(n);
const fmtDay = (iso: string | null | undefined) => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : '—');

function Amount({ n, cur }: { n: number | null | undefined; cur: string }) {
  const locale = useTowerStore((s) => s.locale);
  return <span className="mono" data-deur-exempt="invoice-currency">{fmtCur(n, cur, locale)}</span>;
}

function errLabel(code: string, locale: Locale): string {
  if (code.startsWith('DOUBLE:')) return `${code.slice(7)}: ${t(locale, 'bill_err_DOUBLE')}`;
  return t(locale, `bill_err_${code}`);
}

export function BillsPanel() {
  const role = useTowerStore((s) => s.role);
  const locale = useTowerStore((s) => s.locale);
  const allBills = useTowerStore((s) => s.bills);
  const [wizard, setWizard] = useState<BillDirection | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const today = localDateOf(getNowIso());
  const bills = useMemo(
    () => allBills.filter((b) => billVisibleTo(role, b)).map((b) => ({ ...b, payment: billPaymentToday(b, today) })),
    [allBills, role, today],
  );
  const sections: BillDirection[] = role === 'HHL' ? ['KOSZT', 'PRZYCHOD'] : role === 'SCX' ? ['KOSZT'] : ['PRZYCHOD'];

  return (
    <div data-bills>
      {sections.map((dir) => {
        const list = bills.filter((b) => b.direction === dir);
        const title = role === 'KSH' ? t(locale, 'bill_title_ksh') : t(locale, dir === 'KOSZT' ? 'bill_title_cost' : 'bill_title_rev');
        return (
          <div key={dir} className="panel section-card" style={{ margin: 12 }} data-bill-section={dir}>
            <header className="panel-hd">
              <h2>{title}</h2>
              <span className="sub">{t(locale, dir === 'KOSZT' ? 'bill_sub_cost' : role === 'KSH' ? 'bill_sub_ksh' : 'bill_sub_rev')}</span>
              <div className="spacer" />
              {canRegisterBill(role, dir) ? (
                <button type="button" className="btn" data-bill-new={dir} onClick={() => setWizard(wizard === dir ? null : dir)}>
                  {t(locale, dir === 'KOSZT' ? 'bill_new_cost' : 'bill_new_rev')}
                </button>
              ) : null}
            </header>
            <div className="panel-bd flush">
              {wizard === dir ? <BillWizard direction={dir} onDone={(id) => { setWizard(null); if (id) setOpenId(id); }} /> : null}
              {list.length === 0 ? (
                <div className="note">{t(locale, 'bill_empty')}</div>
              ) : (
                <div className="tablewrap">
                  <table>
                    <thead>
                      <tr>
                        <th>{t(locale, 'bill_col_number')}</th>
                        <th>{t(locale, 'bill_col_week')}</th>
                        <th>{t(locale, 'bill_col_issue')}</th>
                        <th className="num">{t(locale, 'bill_col_net')}</th>
                        <th className="num">{t(locale, 'bill_col_vat')}</th>
                        <th className="num">{t(locale, 'bill_col_gross')}</th>
                        <th>{t(locale, 'bill_col_due')}</th>
                        <th>{t(locale, 'bill_col_verif')}</th>
                        <th>{t(locale, 'bill_col_pay')}</th>
                        <th>{t(locale, 'bill_col_checks')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.map((b) => {
                        const flagged = b.lines.filter((l) => l.flags.length).length + (b.headerFlags.length ? 1 : 0);
                        return (
                          <tr key={b.id} data-bill={b.id} style={{ cursor: 'pointer' }} aria-selected={openId === b.id} onClick={() => setOpenId(openId === b.id ? null : b.id)}>
                            <td><span className="code" data-content>{b.number}</span></td>
                            <td className="mono" data-content>{b.weekKey}</td>
                            <td>{fmtDay(b.issueDate)}</td>
                            <td className="num"><Amount n={b.net} cur={b.currency} /></td>
                            <td className="num"><Amount n={b.vat} cur={b.currency} /></td>
                            <td className="num"><Amount n={b.gross} cur={b.currency} /></td>
                            <td>{fmtDay(b.dueDate)}</td>
                            <td><span className={`pill ${verificationPill(b.verification)}`} data-verif={b.verification}>{VERIFICATION_LABEL[b.verification][locale]}</span></td>
                            <td><span className={`pill ${paymentPill(b.payment)}`} data-pay={b.payment}>{PAYMENT_LABEL[b.payment][locale]}</span></td>
                            <td>{flagged ? <span className="pill p-amber">{t(locale, 'bill_flags')} · {flagged}</span> : <span className="pill p-go">{t(locale, 'bill_ok')}</span>}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              {list.some((b) => b.id === openId) ? <BillDetail bill={list.find((b) => b.id === openId)!} /> : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function BillDetail({ bill }: { bill: Bill }) {
  const role = useTowerStore((s) => s.role);
  const locale = useTowerStore((s) => s.locale);
  const loads = useTowerStore((s) => s.loads);
  const documents = useTowerStore((s) => s.documents);
  const verifyBill = useTowerStore((s) => s.verifyBill);
  const markBillPaid = useTowerStore((s) => s.markBillPaid);
  const unmarkBillPaid = useTowerStore((s) => s.unmarkBillPaid);
  const selectLoad = useTowerStore((s) => s.selectLoad);
  const [note, setNote] = useState('');
  const [paidAt, setPaidAt] = useState(localDateOf(getNowIso()));
  const [reason, setReason] = useState('');
  const [preview, setPreview] = useState<Document | null>(null);
  const byId = new Map(loads.map((l) => [l.id, l]));
  const lineIds = new Set(bill.lines.map((l) => l.loadId));
  /* KSH w module faktur: wyłącznie PDF faktury + CMR + POD (lustro invoice_documents_ksh_scope) */
  const docs = documents.filter((d) => d.loadId && lineIds.has(d.loadId) && (d.category === 'CMR' || d.category === 'POD') && d.status !== 'MISSING');
  const pdf: Document | undefined = bill.pdfStoragePath && bill.pdfDocId
    ? {
        id: bill.pdfDocId, loadId: bill.lines[0]?.loadId ?? '', category: 'INVOICE', name: bill.pdfName ?? 'faktura.pdf',
        uploadedAt: bill.createdAt, deadline: null, status: 'UPLOADED', permitFits: null, visibleTo: [bill.issuer, bill.recipient],
        dataUrl: null, mimeType: 'application/pdf', bytes: 0, source: 'tower', storagePath: bill.pdfStoragePath,
      }
    : undefined;
  const verify = (v: BillVerification) => { if (verifyBill(bill.id, v, v === 'SPORNA' ? note : null)) setNote(''); };

  return (
    <div className="panel-bd" data-bill-detail={bill.id} style={{ borderTop: '1px solid var(--line)' }}>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>{t(locale, 'sched_col_code')}</th>
              <th>{t(locale, 'bill_col_unload')}</th>
              <th className="num">{t(locale, bill.direction === 'PRZYCHOD' && role === 'KSH' ? 'bill_col_expected_ksh' : 'bill_col_expected')}</th>
              <th className="num">{t(locale, 'bill_col_invoiced')}</th>
              {bill.currency === 'PLN' ? <th>{t(locale, 'bill_col_fx')}</th> : null}
              <th>{t(locale, 'bill_col_checks')}</th>
            </tr>
          </thead>
          <tbody>
            {bill.lines.map((ln) => {
              const l = byId.get(ln.loadId);
              const at = l ? unloadedAtOf(l) : null;
              return (
                <tr key={ln.loadId} style={{ cursor: 'pointer' }} onClick={() => l && selectLoad(l.id)}>
                  <td><span className="code" data-content>{l?.code ?? ln.loadId}</span></td>
                  <td>{fmtDay(at ? localDateOf(at) : null)}</td>
                  <td className="num"><Amount n={ln.expectedNet} cur={bill.currency} /></td>
                  <td className="num"><Amount n={ln.invoicedNet} cur={bill.currency} /></td>
                  {bill.currency === 'PLN' ? (
                    <td className="mono" data-deur-exempt="invoice-fx" data-content>
                      {ln.fx ? `${ln.fx.tableNo} · ${ln.fx.mid.toFixed(4)} · ${fmtDay(ln.fx.effectiveDate)}` : '—'}
                    </td>
                  ) : null}
                  <td>
                    {ln.flags.length
                      ? ln.flags.map((f) => <span key={f} className="pill p-amber" data-flag={f} style={{ marginRight: 4 }}>{BILL_FLAG_LABEL[f][locale]}</span>)
                      : <span className="pill p-go">{t(locale, 'bill_ok')}</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {bill.headerFlags.length ? (
        <div className="note" data-flag="BRAK_NA_FAKTURZE">
          {BILL_FLAG_LABEL.BRAK_NA_FAKTURZE[locale]}: <span data-content>{bill.missingLoadIds.map((id) => byId.get(id)?.code ?? id).join(', ')}</span>
        </div>
      ) : null}
      <dl className="kv">
        <dt>{t(locale, 'bill_pdf')}</dt>
        <dd>{pdf ? <DocFileRow doc={pdf} onPreview={setPreview} /> : <span data-content>{bill.pdfName ?? '—'}</span>}</dd>
        <dt>{t(locale, 'bill_col_due')}</dt>
        <dd>{fmtDay(bill.dueDate)} · {t(locale, bill.dueFromDocument ? 'bill_due_doc' : 'bill_due_terms')}</dd>
        <dt>{t(locale, 'bill_reminders')}</dt>
        <dd data-reminders>
          {reminderPlan(bill, localDateOf(getNowIso())).map((r) => (
            <span key={r.offset} className={`pill ${r.state === 'WYSLANE' ? 'p-go' : r.state === 'WSTRZYMANE' ? '' : 'p-amber'}`} data-reminder={r.state} style={{ marginRight: 4 }} title={t(locale, `bill_rem_${r.state}`)}>
              {fmtDay(r.date)} · {r.offset > 0 ? `+${r.offset}` : r.offset}
            </span>
          ))}
          <span style={{ color: 'var(--ink-3)' }}>
            {' '}{t(locale, 'bill_rem_to')} {reminderRecipients(bill).payer} ({t(locale, 'bill_rem_payer')}) · {reminderRecipients(bill).payee} ({t(locale, 'bill_rem_payee')}){bill.payment === 'OPLACONA' ? ` · ${t(locale, 'bill_rem_WSTRZYMANE')}` : ''}
          </span>
        </dd>
        {bill.disputeNote ? (<><dt>{t(locale, 'bill_dispute_note')}</dt><dd data-content>{bill.disputeNote}</dd></>) : null}
        {bill.paidAt ? (<><dt>{t(locale, 'bill_paid_at')}</dt><dd>{fmtDay(bill.paidAt)}</dd></>) : null}
      </dl>
      {docs.length ? docs.map((d) => (
        <DocFileRow key={d.id} doc={d} label={`${byId.get(d.loadId!)?.code ?? ''} · ${d.category}`} onPreview={setPreview} />
      )) : null}
      <DisputeThread bill={bill} />
      {canVerifyBill(role, bill) ? (
        <div className="filters" data-bill-actions="verify">
          <input className="input" style={{ flex: 1, minWidth: 220 }} placeholder={t(locale, 'bill_dispute_ph')} value={note} onChange={(e) => setNote(e.target.value)} aria-label={t(locale, 'bill_dispute_note')} />
          <button type="button" className="chipbtn" data-verify="SPORNA" onClick={() => verify('SPORNA')}>{VERIFICATION_LABEL.SPORNA[locale]}</button>
          <button type="button" className="chipbtn" data-verify="ZGODNA" onClick={() => verify('ZGODNA')}>{VERIFICATION_LABEL.ZGODNA[locale]}</button>
          <button type="button" className="btn" data-verify="ZAAKCEPTOWANA" onClick={() => verify('ZAAKCEPTOWANA')}>{VERIFICATION_LABEL.ZAAKCEPTOWANA[locale]}</button>
        </div>
      ) : null}
      {canMarkPaid(role) ? (
        <div className="filters" data-bill-actions="pay">
          {bill.payment === 'OPLACONA' ? (
            <>
              <input className="input" style={{ flex: 1, minWidth: 220 }} placeholder={t(locale, 'bill_unpaid_reason')} value={reason} onChange={(e) => setReason(e.target.value)} aria-label={t(locale, 'bill_unpaid_reason')} />
              <button type="button" className="chipbtn" data-unpaid onClick={() => { if (unmarkBillPaid(bill.id, reason)) setReason(''); }}>{t(locale, 'bill_unmark_paid')}</button>
            </>
          ) : (
            <>
              <span>{t(locale, 'bill_paid_at')}</span>
              <input className="input" type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} aria-label={t(locale, 'bill_paid_at')} />
              <button type="button" className="btn" data-paid disabled={paymentBlockedByDispute(bill)} onClick={() => markBillPaid(bill.id, paidAt)}>{t(locale, 'bill_mark_paid')}</button>
              {paymentBlockedByDispute(bill) ? <span className="pill p-red" data-pay-blocked="">{t(locale, 'iii7_pay_blocked')}</span> : null}
            </>
          )}
        </div>
      ) : null}
      <DocPreview doc={preview} onClose={() => setPreview(null)} />
    </div>
  );
}

interface LineState { on: boolean; net: string; fuel: string; fx: BillLineFx | null; fxConfirmed: boolean }

function BillWizard({ direction, onDone }: { direction: BillDirection; onDone: (id: string | null) => void }) {
  const locale = useTowerStore((s) => s.locale);
  const loads = useTowerStore((s) => s.loads);
  const bills = useTowerStore((s) => s.bills);
  const registerBill = useTowerStore((s) => s.registerBill);
  const today = localDateOf(getNowIso());
  const weeks = useMemo(() => {
    const done = invoicedLoadIds(bills, direction);
    const set = new Set<string>();
    for (const l of loads) {
      const at = unloadedAtOf(l);
      if (at && !done.has(l.id) && (direction === 'PRZYCHOD' || !l.carrierId || l.carrierId === 'org-scx')) set.add(isoWeekKeyLocal(at));
    }
    return [...set].sort().reverse();
  }, [loads, bills, direction]);
  const [week, setWeek] = useState(weeks[0] ?? '');
  const [currency, setCurrency] = useState<'EUR' | 'PLN'>('EUR');
  const [number, setNumber] = useState('');
  const [issueDate, setIssueDate] = useState(today);
  const [dueDoc, setDueDoc] = useState('');
  const [net, setNet] = useState('');
  const [vat, setVat] = useState('');
  const [gross, setGross] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const candidates = useMemo(() => (week ? billCandidates(loads, bills, direction, week) : []), [loads, bills, direction, week]);
  const [lines, setLines] = useState<Record<string, LineState>>({});
  const lineOf = (id: string): LineState => {
    if (lines[id]) return lines[id];
    const l = loads.find((x) => x.id === id)!;
    const fx = currency === 'PLN' ? suggestLineFx(l, direction, today) : null;
    const exp = expectedNetFor(l, direction, currency, today) ?? (fx ? Math.round(computedEurFor(l, direction) * fx.mid * 100) / 100 : null);
    return { on: true, net: exp != null ? String(exp) : '', fuel: '', fx, fxConfirmed: false };
  };
  const patch = (id: string, p: Partial<LineState>) => setLines((s) => ({ ...s, [id]: { ...lineOf(id), ...p } }));
  const num = (v: string) => (v.trim() === '' || Number.isNaN(Number(v.replace(',', '.'))) ? null : Number(v.replace(',', '.')));

  const draft: BillDraft = {
    direction, number, issueDate, weekKey: week, currency, net: num(net), vat: num(vat), gross: num(gross),
    dueDateFromDocument: dueDoc || null, pdfName: file?.name ?? null, pdfSize: file?.size ?? null,
    lines: candidates.filter((l) => lineOf(l.id).on).map((l) => {
      const st = lineOf(l.id);
      return { loadId: l.id, invoicedNet: num(st.net) ?? 0, invoicedFuel: num(st.fuel), fx: currency === 'PLN' && st.fxConfirmed ? st.fx : null };
    }),
  };
  const chk = checkBill(draft, loads, bills, today);
  const monday = week ? isoWeekMonday(week) : '';

  return (
    <div className="panel-bd" data-bill-wizard={direction} style={{ borderBottom: '1px solid var(--line)' }}>
      <dl className="kv">
        <dt>{t(locale, 'bill_col_week')}</dt>
        <dd>
          <select className="input" value={week} data-w="week" onChange={(e) => { setWeek(e.target.value); setLines({}); }}>
            {weeks.map((w) => <option key={w} value={w}>{w}</option>)}
          </select>{' '}
          {monday ? <span style={{ color: 'var(--ink-3)' }}>{fmtDay(monday)}–{fmtDay(addDaysIso(monday, 6))}</span> : null}
        </dd>
        <dt>{t(locale, 'bill_currency')}</dt>
        <dd data-deur-exempt="invoice-currency">
          <div className="seg" role="group" aria-label={t(locale, 'bill_currency')}>
            {(['EUR', 'PLN'] as const).map((c) => (
              <button key={c} type="button" data-cur={c} aria-pressed={currency === c} onClick={() => { setCurrency(c); setLines({}); }}>{c}</button>
            ))}
          </div>
        </dd>
        <dt>{t(locale, 'bill_col_number')}</dt>
        <dd><input className="input" data-w="number" value={number} onChange={(e) => setNumber(e.target.value)} /></dd>
        <dt>{t(locale, 'bill_col_issue')}</dt>
        <dd><input className="input" type="date" data-w="issue" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} /></dd>
        <dt>{t(locale, 'bill_due_doc_in')}</dt>
        <dd><input className="input" type="date" data-w="due" value={dueDoc} onChange={(e) => setDueDoc(e.target.value)} /> <span style={{ color: 'var(--ink-3)' }}>{t(locale, 'bill_due_hint')}</span></dd>
        <dt>{t(locale, 'bill_totals')}</dt>
        <dd data-deur-exempt="invoice-currency">
          <input className="input" data-w="net" style={{ width: 110 }} placeholder={t(locale, 'bill_col_net')} value={net} onChange={(e) => setNet(e.target.value)} />{' '}
          <input className="input" data-w="vat" style={{ width: 90 }} placeholder={t(locale, 'bill_col_vat')} value={vat} onChange={(e) => setVat(e.target.value)} />{' '}
          <input className="input" data-w="gross" style={{ width: 110 }} placeholder={t(locale, 'bill_col_gross')} value={gross} onChange={(e) => setGross(e.target.value)} />{' '}
          <span style={{ color: 'var(--ink-3)' }}>{currency} · {t(locale, 'bill_vat_hint')}</span>
        </dd>
        <dt>{t(locale, 'bill_pdf')}</dt>
        <dd><input type="file" accept="application/pdf" data-w="pdf" aria-label={t(locale, 'bill_pdf')} onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></dd>
      </dl>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th />
              <th>{t(locale, 'sched_col_code')}</th>
              <th>{t(locale, 'bill_col_unload')}</th>
              <th className="num">{t(locale, 'bill_col_expected')}</th>
              <th className="num">{t(locale, 'bill_col_invoiced')}</th>
              {currency === 'PLN' ? <th>{t(locale, 'bill_col_fx')}</th> : null}
              <th>{t(locale, 'bill_col_checks')}</th>
            </tr>
          </thead>
          <tbody>
            {candidates.map((l) => {
              const st = lineOf(l.id);
              const at = unloadedAtOf(l);
              const res = chk.lines.find((x) => x.loadId === l.id);
              return (
                <tr key={l.id} data-w-line={l.code}>
                  <td><input type="checkbox" checked={st.on} onChange={(e) => patch(l.id, { on: e.target.checked })} aria-label={l.code} /></td>
                  <td><span className="code" data-content>{l.code}</span></td>
                  <td>{fmtDay(at ? localDateOf(at) : null)}</td>
                  <td className="num"><Amount n={expectedNetFor(l, direction, currency, today)} cur={currency} /></td>
                  <td className="num" data-deur-exempt="invoice-currency"><input className="input" style={{ width: 110 }} value={st.net} onChange={(e) => patch(l.id, { net: e.target.value })} disabled={!st.on} /></td>
                  {currency === 'PLN' ? (
                    <td data-deur-exempt="invoice-fx">
                      {st.fx ? (
                        <>
                          <input className="input" style={{ width: 120 }} value={st.fx.tableNo} onChange={(e) => patch(l.id, { fx: { ...st.fx!, tableNo: e.target.value } })} aria-label={t(locale, 'bill_fx_table')} />{' '}
                          <input className="input" style={{ width: 80 }} value={String(st.fx.mid)} onChange={(e) => patch(l.id, { fx: { ...st.fx!, mid: Number(e.target.value.replace(',', '.')) || 0 } })} aria-label={t(locale, 'bill_fx_mid')} />{' '}
                          <input className="input" type="date" value={st.fx.effectiveDate} onChange={(e) => patch(l.id, { fx: { ...st.fx!, effectiveDate: e.target.value } })} aria-label={t(locale, 'bill_fx_date')} />{' '}
                          <label><input type="checkbox" data-fx-confirm checked={st.fxConfirmed} onChange={(e) => patch(l.id, { fxConfirmed: e.target.checked })} /> {t(locale, 'bill_fx_confirm')}</label>
                        </>
                      ) : <span className="pill p-amber">{BILL_FLAG_LABEL.BRAK_KURSU[locale]}</span>}
                    </td>
                  ) : null}
                  <td>
                    {!st.on ? '—' : res?.flags.length
                      ? res.flags.map((f) => <span key={f} className="pill p-amber" data-flag={f} style={{ marginRight: 4 }}>{BILL_FLAG_LABEL[f][locale]}</span>)
                      : <span className="pill p-go">{t(locale, 'bill_ok')}</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="filters">
        <span>{t(locale, 'bill_expected_total')} <Amount n={chk.expectedTotal} cur={currency} /></span>
        <span>{t(locale, 'bill_invoiced_total')} <Amount n={chk.invoicedTotal} cur={currency} /></span>
        {chk.headerFlags.length ? <span className="pill p-amber" data-flag="BRAK_NA_FAKTURZE">{BILL_FLAG_LABEL.BRAK_NA_FAKTURZE[locale]} · {chk.missingLoadIds.length}</span> : null}
        <div className="spacer" />
        <button type="button" className="chipbtn" onClick={() => onDone(null)}>{t(locale, 'bill_cancel')}</button>
        <button
          type="button"
          className="btn"
          data-w="submit"
          onClick={() => {
            const r = registerBill(draft, file);
            if (r.ok) onDone(r.id); else setErrors(r.errors);
          }}
        >
          {t(locale, 'bill_submit')}
        </button>
      </div>
      {errors.length ? (
        <div className="note" data-w-errors style={{ color: 'var(--red)' }}>
          {errors.map((e) => <div key={e}>{errLabel(e, locale)}</div>)}
        </div>
      ) : null}
      <div className="note">{t(locale, 'bill_wizard_note')}</div>
    </div>
  );
}
