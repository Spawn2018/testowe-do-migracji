/**
 * M6 — faktury v2 (MECHANIZM_PIENIEDZY §6, ZLECENIE §8 / Aneks 1–2). Wzorce makiety: panel / tablewrap / kv / mrow / pill.
 *   HHL — „Faktury kosztowe” (weryfikacja faktur SCX, „Opłacona”) i „Faktury przychodowe” (kreator jak u SCX).
 *   SCX — rejestracja faktury kosztowej (waluta EUR / PLN), lista ze statusami i terminem; bez „Opłacona”.
 *   KSH — wyłącznie faktury HHL → KSH: PDF + CMR, kontrola względem cen KSH (nigdy koszt),
 *         ZGODNA / SPORNA (z uzasadnieniem) / ZAAKCEPTOWANA, termin i status płatności.
 * Kwoty w walucie faktury → `data-deur-exempt="invoice-currency"`.
 */
import { Fragment, useEffect, useMemo, useState } from 'react';
import { useTowerStore } from '../store/useTowerStore';
import { t } from '../i18n/messages';
import type { Bill, BillDirection, BillLineFx, BillVerification, Document, Locale } from '../types';
import { getNowIso } from '../lib/frozenNow';
import { isoWeekKeyLocal, localDateOf } from '../lib/money/engine';
import { unloadedAtOf } from '../lib/money/loadMoney';
import { transportLabel } from '../lib/transportName';
import {
  BILL_TERM_DAYS,
  BILL_FLAG_LABEL, VERIFICATION_LABEL, billCandidates, billPaymentToday, billVisibleTo,
  canMarkPaid, canRegisterBill, computedEurFor, canVerifyBill, checkBill, expectedNetFor, invoicedLoadIds,
  addDaysIso, reminderPlan, reminderRecipients, suggestLineFx, vatGrossOf, type BillDraft,
} from '../lib/invoices3';
import { DocFileRow } from '../components/ui/DocFileRow';
import { DocPreview } from '../components/ui/DocPreview';
import { canReplyDispute, correctionFileError, disputeActorSide, paymentBlockedByDispute, type DisputeEvent } from '../lib/invoiceDispute';
import { readFileAsDataUrl } from '../lib/docsIo';
import { clickableRow } from '../lib/clickableRow';
import { formatPlNumber } from '../lib/format';
import { transportsText } from '../lib/p5Finance';
import { ISSUER, RECIPIENT, billDiff, billStatus, invoiceKpis, pendingWeeks, weekKeyLabel, weekOptionLabel, type InvKpis, type InvStatus } from '../lib/p5Invoices';
import { up } from '../components/options/up';
import { ft, ftn, ftp } from '../i18n/p5';
import { factoringOfferOf } from '../lib/p5Source';
import { billLineFuel } from '../lib/p5cFuel';
import { fc, fcp } from '../i18n/p5c';
import { PaymentChoice } from '../components/invoices/Factoring';

/** III-7 — historia sporu (zgłoszenie → odpowiedź / korekta wystawcy → rozstrzygnięcie) i odpowiedź wystawcy. */
function DisputeThread({ bill }: { bill: Bill }) {
  const role = useTowerStore((s) => s.role);
  const locale = useTowerStore((s) => s.locale);
  const [events, setEvents] = useState<DisputeEvent[] | null>(null);
  const [reply, setReply] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const [busy, setBusy] = useState(false);
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
  const pickFile = (f: File | null) => {
    const st = useTowerStore.getState();
    const bad = f ? correctionFileError(f) : null;
    if (bad) { st.pushToast(t(locale, bad === 'type' ? 'iii7_file_type' : 'iii7_file_size'), 'HIGH'); setFile(null); setFileKey((k) => k + 1); return; }
    setFile(f);
  };
  const send = async () => {
    const st = useTowerStore.getState();
    const text = reply.trim();
    if (!text) { st.pushToast(t(locale, 'iii7_reply_empty'), 'HIGH'); return; }
    setBusy(true);
    try {
      if (import.meta.env.VITE_AUTH_MODE === 'supabase') {
        await (await import('../data/invoiceDisputeServer')).replyDispute(bill.id, text, file);
        setTick((x) => x + 1);
      } else {
        const att = file ? await readFileAsDataUrl(file) : null;
        setDemoReplies((xs) => [...xs, {
          id: `r${xs.length + 1}`, kind: file ? 'CORRECTION' : 'REPLY', statusTo: 'SPORNA', note: text, at: getNowIso(),
          ...(att && file ? { docName: file.name, docUrl: att.dataUrl } : {}),
        }]);
      }
      setReply(''); setFile(null); setFileKey((k) => k + 1);
      st.pushToast(t(locale, file ? 'iii7_corr_sent' : 'iii7_reply_sent'), 'MEDIUM');
    } catch (e) {
      st.pushToast(t(locale, 'iii6_err').replace('{msg}', e instanceof Error ? e.message : String(e)), 'HIGH');
    } finally {
      setBusy(false);
    }
  };
  const openDoc = async (e: DisputeEvent) => {
    try {
      const url = e.docUrl ?? (e.docId && import.meta.env.VITE_AUTH_MODE === 'supabase'
        ? await (await import('../data/invoiceDisputeServer')).disputeDocUrl(e.docId) : null);
      // Tylko https (link podpisany) albo data: PDF/obraz z lokalnego odczytu — nie javascript:.
      if (!url) return;
      let allowed: URL;
      try { allowed = new URL(url); } catch { return; }
      const href = allowed.protocol === 'https:'
        ? allowed.href
        : (allowed.protocol === 'data:' && /^data:(application\/pdf|image\/)/i.test(allowed.href) ? allowed.href : '');
      if (href.startsWith('https://') || href.startsWith('data:application/pdf') || href.startsWith('data:image/')) {
        const a = document.createElement('a');
        a.href = href;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
    } catch (err) {
      useTowerStore.getState().pushToast(t(locale, 'iii6_err').replace('{msg}', err instanceof Error ? err.message : String(err)), 'HIGH');
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
          <span data-content>
            {e.note ?? ''}
            {e.docId || e.docUrl ? (
              <button type="button" className="btn ghost" style={{ marginLeft: 8 }} data-dispute-doc={e.docName ?? ''} onClick={() => void openDoc(e)}>
                {t(locale, 'iii7_open_doc')}{e.docName ? `: ${e.docName}` : ''}
              </button>
            ) : null}
          </span>
        </div>
      ))}
      {canReplyDispute(role, bill) ? (
        <div className="filters" data-bill-actions="dispute-reply">
          <input className="input" style={{ flex: 1, minWidth: 220 }} placeholder={t(locale, 'iii7_reply_ph')} value={reply}
            onChange={(e) => setReply(e.target.value)} aria-label={t(locale, 'iii7_reply_ph')} data-dispute-reply="" />
          <label className="btn ghost" title={t(locale, 'iii7_attach_hint')}>
            {file ? file.name : t(locale, 'iii7_attach')}
            <input key={fileKey} type="file" accept="application/pdf" hidden data-dispute-file=""
              aria-label={t(locale, 'iii7_attach')} onChange={(e) => pickFile(e.target.files?.[0] ?? null)} />
          </label>
          <button type="button" className="btn" data-action="dispute-reply" disabled={busy} onClick={() => void send()}>
            {t(locale, file ? 'iii7_send_corr' : 'iii7_reply')}
          </button>
        </div>
      ) : null}
    </div>
  );
}

/* E4: kwoty jak w raporcie — „21 820,30” (EUR, waluta umowy); inna waluta faktury z kodem: „38 413,13 PLN”. */
const fmtCur = (n: number | null | undefined, cur: string) =>
  n == null ? '—' : cur === 'EUR' ? formatPlNumber(n, 2) : `${formatPlNumber(n, 2)} ${cur}`;
const fmtNum = (n: number | null | undefined) => (n == null ? '—' : formatPlNumber(n, 2));
const fmtDay = (iso: string | null | undefined) => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : '—');

function Amount({ n, cur }: { n: number | null | undefined; cur: string }) {
  return <span className="mono" data-deur-exempt="invoice-currency">{fmtCur(n, cur)}</span>;
}

function errLabel(code: string, locale: Locale): string {
  if (code.startsWith('DOUBLE:')) return `${code.slice(7)}: ${t(locale, 'bill_err_DOUBLE')}`;
  return t(locale, `bill_err_${code}`);
}

/** E4 — kafelki nad listą: czeka na wystawienie, do weryfikacji, do zapłaty w 7 dni, po terminie. */
function Kpis({ direction, kpis }: { direction: BillDirection; kpis: InvKpis }) {
  const locale = useTowerStore((s) => s.locale);
  const first = kpis.pending[0];
  const ver = kpis.toVerify[0];
  const dm = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}`;
  return (
    <div className="inv-kpis" data-inv-kpis={direction}>
      <section className={`inv-kpi${first ? ' is-sea' : ''}`} data-inv-kpi="pending">
        <h3>{up(ft(locale, 'p5_inv_k_pending'))}</h3>
        <b className="inv-kpi-v">{first ? ftp(locale, 'p5_inv_k_pending_v', { no: first.no }) : '—'}</b>
        <p>
          {first ? (
            <>
              {ftp(locale, 'p5_inv_k_pending_s', { loads: transportsText(first.loads.length), range: `${dm(first.from)}–${dm(first.to)}`, net: formatPlNumber(first.netEur, 2) })}
              <b>{ftp(locale, 'p5_inv_k_pending_who', { who: ISSUER[direction] })}</b>
              {kpis.pending.length > 1 ? ftn(locale, 'p5_inv_k_pending_more', kpis.pending.length - 1) : ''}
            </>
          ) : ft(locale, 'p5_inv_k_pending_none')}
        </p>
      </section>
      <section className={`inv-kpi${kpis.toVerify.length && kpis.verifyMine ? ' is-warn' : ''}`} data-inv-kpi="verify">
        <h3>{up(kpis.verifyMine ? ft(locale, 'p5_inv_k_verify_mine') : ftp(locale, 'p5_inv_k_verify_other', { who: RECIPIENT[direction] }))}</h3>
        <b className="inv-kpi-v">{kpis.toVerify.length}</b>
        <p>
          {ver ? (
            <>
              <span data-content>{ftp(locale, 'p5_inv_k_verify_s', { number: ver.number, diff: formatPlNumber(billDiff(ver), 2), cur: ver.currency })}</span>
              <b>{ftp(locale, 'p5_inv_k_verify_who', { who: RECIPIENT[direction] })}</b>
            </>
          ) : ft(locale, 'p5_inv_k_verify_none')}
        </p>
      </section>
      <section className="inv-kpi" data-inv-kpi="due">
        <h3>{up(ft(locale, 'p5_inv_k_due'))}</h3>
        <b className="inv-kpi-v">{kpis.dueSoon.length}</b>
        <p>{kpis.nextDue ? ftp(locale, 'p5_inv_k_due_s', { date: dm(kpis.nextDue) }) : ft(locale, 'p5_inv_k_due_none')}</p>
      </section>
      <section className={`inv-kpi${kpis.overdue.length ? ' is-red' : ''}`} data-inv-kpi="overdue">
        <h3>{up(ft(locale, 'p5_inv_k_over'))}</h3>
        <b className="inv-kpi-v">{kpis.overdue.length}</b>
        <p>
          {kpis.overdue[0] ? (
            <span data-content>
              {ftp(locale, 'p5_inv_k_over_some', { number: kpis.overdue[0].number, date: dm(kpis.overdue[0].dueDate) })}
              {kpis.overdue.length > 1 ? ftp(locale, 'p5_inv_k_over_more', { n: kpis.overdue.length - 1 }) : ''}
            </span>
          ) : ft(locale, 'p5_inv_k_over_s')}
        </p>
      </section>
    </div>
  );
}

/** E4 — obieg faktury w pięciu krokach (komputer). */
function Flow({ direction }: { direction: BillDirection }) {
  const locale = useTowerStore((s) => s.locale);
  const steps = [1, 2, 3, 4, 5].map((i) => ({
    h: ftp(locale, `p5_inv_flow_${i}h`, { who: i === 2 ? ISSUER[direction] : RECIPIENT[direction] }),
    t: ft(locale, `p5_inv_flow_${i}t`),
    d: ftp(locale, `p5_inv_flow_${i}d`, { days: BILL_TERM_DAYS[direction] }),
  }));
  return (
    <ol className="inv-flow" data-inv-flow={direction}>
      {steps.map((s) => (
        <li key={s.t}>
          <span className="inv-flow-h">{up(s.h)}</span>
          <b>{s.t}</b>
          <span className="inv-flow-d">{s.d}</span>
        </li>
      ))}
    </ol>
  );
}

const STATUS_TAG: Record<InvStatus, string> = {
  DO_WYSTAWIENIA: 'fin-tag sea', DO_WERYFIKACJI: 'fin-tag warn', ZGODNA: 'fin-tag go', SPORNA: 'fin-tag red',
  ZAAKCEPTOWANA: 'fin-tag go', OPLACONA: 'fin-tag go solid', PO_TERMINIE: 'fin-tag red',
};

function StatusTag({ bill, status }: { bill?: Bill; status: InvStatus }) {
  const locale = useTowerStore((s) => s.locale);
  return (
    <span className={STATUS_TAG[status]} data-bill-status={status} data-verif={bill?.verification} data-pay={bill?.payment}>
      {up(ft(locale, `p5_inv_st_${status}`))}
    </span>
  );
}

/** E4 — jedna sekcja kierunku (koszt SCX → HHL albo przychód HHL → KSH): kafelki, obieg, lista, nowa faktura, szczegóły. */
export function BillsSection({ direction, phone }: { direction: BillDirection; phone: boolean }) {
  const role = useTowerStore((s) => s.role);
  const locale = useTowerStore((s) => s.locale);
  const allBills = useTowerStore((s) => s.bills);
  const loads = useTowerStore((s) => s.loads);
  const verifyBill = useTowerStore((s) => s.verifyBill);
  const [wizard, setWizard] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const today = localDateOf(getNowIso());
  const bills = useMemo(
    () => allBills.filter((b) => billVisibleTo(role, b)).map((b) => ({ ...b, payment: billPaymentToday(b, today) })),
    [allBills, role, today],
  );
  const list = useMemo(
    () => bills.filter((b) => b.direction === direction).sort((a, b) => b.weekKey.localeCompare(a.weekKey) || b.issueDate.localeCompare(a.issueDate)),
    [bills, direction],
  );
  const pending = useMemo(() => pendingWeeks(loads, allBills, direction, today), [loads, allBills, direction, today]);
  const kpis = useMemo(() => invoiceKpis(role, bills, pending, direction, today), [role, bills, pending, direction, today]);
  const title = role === 'KSH' ? ft(locale, 'p5_inv_list_ksh') : role === 'SCX' ? ft(locale, 'p5_inv_list_scx') : ft(locale, `p5_inv_list_${direction}`);
  const dm = (d: string | null | undefined) => (d ? `${d.slice(8, 10)}.${d.slice(5, 7)}` : '—');
  const quick = (b: Bill) => canVerifyBill(role, b) && b.verification === 'DO_WERYFIKACJI';
  const open = (id: string) => setOpenId((o) => (o === id ? null : id));
  const dispute = (id: string) => {
    setOpenId(id);
    window.setTimeout(() => (document.querySelector(`[data-bill-detail="${id}"] [data-dispute-note]`) as HTMLInputElement | null)?.focus(), 50);
  };
  const actions = (b: Bill) => quick(b) ? (
    <span className="inv-actions" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      <button type="button" className="btn" data-bill-quick="ZAAKCEPTOWANA" onClick={() => verifyBill(b.id, 'ZAAKCEPTOWANA', null)}>{ft(locale, 'p5_inv_accept')}</button>
      <button type="button" className="btn ghost" data-bill-quick="SPORNA" onClick={() => dispute(b.id)}>{ft(locale, 'p5_inv_dispute')}</button>
    </span>
  ) : null;

  return (
    <div data-bill-section={direction} className="inv-section">
      <Kpis direction={direction} kpis={kpis} />
      {phone ? null : <Flow direction={direction} />}
      {/* telefon (img/e4-faktury-phone): bez nagłówka listy — tytuł zostaje w etykiecie sekcji, przycisk nowej faktury nad kartami */}
      <section className="panel fin-panel" aria-labelledby={phone ? undefined : `inv-list-${direction}`} aria-label={phone ? title : undefined}>
        {phone && !canRegisterBill(role, direction) ? null : (
        <header className="panel-hd fin-hd2 inv-list-hd">
          {phone ? null : <h3 id={`inv-list-${direction}`}>{title}</h3>}
          {role === 'HHL' && !phone ? <span className="sub">{ft(locale, `p5_inv_list_sees_${direction}`)}</span> : null}
          <div className="spacer" />
          {canRegisterBill(role, direction) ? (
            <button type="button" className="btn" data-bill-new={direction} aria-expanded={wizard} onClick={() => setWizard((w) => !w)}>
              {t(locale, direction === 'KOSZT' ? 'bill_new_cost' : 'bill_new_rev')}
            </button>
          ) : null}
        </header>
        )}
        {wizard ? <BillWizard direction={direction} onDone={(id) => { setWizard(false); if (id) setOpenId(id); }} /> : null}
        {list.length === 0 && pending.length === 0 ? (
          <p className="fin-muted fin-pad">{ft(locale, 'p5_inv_empty')}</p>
        ) : phone ? (
          <div className="fin-cards inv-cards">
            {pending.map((w) => (
              <article key={w.weekKey} className="fin-card inv-card is-sea" data-bill-pending={w.weekKey}>
                <header className="fin-card-hd"><b>{ftp(locale, 'p5_inv_card_week', { label: weekKeyLabel(w.weekKey) })}</b><StatusTag status="DO_WYSTAWIENIA" /></header>
                <b className="inv-card-big">{ftp(locale, 'p5_inv_card_net', { net: formatPlNumber(w.netEur, 2) })}</b>
                <p className="fin-muted">{ftp(locale, 'p5_inv_card_pending', { loads: transportsText(w.loads.length), who: ISSUER[direction] })}</p>
              </article>
            ))}
            {list.map((b) => (
              <article key={b.id} className="fin-card inv-card" data-bill={b.id}>
                <button type="button" className="fin-card-btn inv-card-hd" aria-expanded={openId === b.id} onClick={() => open(b.id)}>
                  <span className="code" data-content>{b.number}</span>
                  <StatusTag bill={b} status={billStatus(b)} />
                </button>
                <b className="inv-card-big" data-deur-exempt="invoice-currency">{formatPlNumber(b.gross, 2)} {b.currency} {ft(locale, 'p5_inv_col_gross').toLocaleLowerCase('pl-PL')}</b>
                <p className="fin-muted" data-deur-exempt="invoice-currency">
                  {ftp(locale, 'p5_inv_card_line', { week: Number(b.weekKey.slice(-2)), loads: transportsText(b.lines.length), net: fmtNum(b.net), vat: fmtNum(b.vat), due: dm(b.dueDate) })}
                </p>
                {quick(b) ? <div className="inv-card-acts">{actions(b)}</div> : null}
                {openId === b.id ? <BillDetail bill={b} /> : null}
              </article>
            ))}
          </div>
        ) : (
          <div className="fin-scroll">
            <table className="fin-table inv-table">
              <thead>
                <tr>
                  <th>{up(ft(locale, 'p5_inv_col_week'))}</th>
                  <th>{up(ft(locale, 'p5_inv_col_inv'))}</th>
                  <th className="num">{up(ft(locale, 'p5_inv_col_loads'))}</th>
                  <th className="num">{up(ft(locale, 'p5_inv_col_net'))}</th>
                  <th className="num">{up(ft(locale, 'p5_inv_col_vat'))}</th>
                  <th className="num">{up(ft(locale, 'p5_inv_col_gross'))}</th>
                  <th>{up(ft(locale, 'p5_inv_col_due'))}</th>
                  <th>{up(ft(locale, 'p5_inv_col_status'))}</th>
                  <th><span className="sronly">{t(locale, 'bill_col_checks')}</span></th>
                </tr>
              </thead>
              <tbody>
                {pending.map((w) => (
                  <tr key={w.weekKey} data-bill-pending={w.weekKey}>
                    <td>{weekKeyLabel(w.weekKey)}</td>
                    <td className="fin-muted">{ft(locale, 'p5_inv_not_issued')}</td>
                    <td className="num">{w.loads.length}</td>
                    <td className="num"><b>{formatPlNumber(w.netEur, 2)}</b></td>
                    <td className="num">{formatPlNumber(vatGrossOf(w.netEur).vat, 2)}</td>
                    <td className="num"><b>{formatPlNumber(vatGrossOf(w.netEur).gross, 2)}</b></td>
                    <td>—</td>
                    <td><StatusTag status="DO_WYSTAWIENIA" /></td>
                    <td className="fin-muted">{ftp(locale, 'p5_inv_waits', { who: ISSUER[direction] })}</td>
                  </tr>
                ))}
                {list.map((b) => {
                  const flagged = b.lines.filter((l) => l.flags.length).length + (b.headerFlags.length ? 1 : 0);
                  return (
                    <Fragment key={b.id}>
                      <tr data-bill={b.id} className={openId === b.id ? 'is-open' : undefined} aria-selected={openId === b.id} {...clickableRow(() => open(b.id))}>
                        <td>{weekKeyLabel(b.weekKey)}</td>
                        <td>
                          <span className="code" data-content>{b.number}</span>
                          <span className="inv-sub">{ftp(locale, 'p5_inv_issued', { date: dm(b.issueDate) })}{b.pdfName || b.pdfStoragePath ? ' · PDF' : ''}</span>
                        </td>
                        <td className="num">{b.lines.length}</td>
                        <td className="num"><b><Amount n={b.net} cur={b.currency} /></b></td>
                        <td className="num"><Amount n={b.vat} cur={b.currency} /></td>
                        <td className="num"><b><Amount n={b.gross} cur={b.currency} /></b></td>
                        <td>{dm(b.dueDate)}</td>
                        <td>
                          <span className="inv-status">
                            <StatusTag bill={b} status={billStatus(b)} />
                            {flagged ? <span className="fin-tag warn" data-bill-flags={flagged}>{up(t(locale, 'bill_flags'))} · {flagged}</span> : null}
                          </span>
                        </td>
                        <td>{actions(b)}</td>
                      </tr>
                      {openId === b.id ? (
                        <tr className="fin-detail-row"><td colSpan={9}><BillDetail bill={b} /></td></tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

/** E4 — tabela „Kto co widzi i co robi”. */
export function WhoSees() {
  const locale = useTowerStore((s) => s.locale);
  const rows = [1, 2, 3];
  const cell = (r: number, who: 'hhl' | 'ksh' | 'scx') => {
    const v = ft(locale, `p5_inv_who_r${r}_${who}`);
    return <td className={v === 'nie widzi' ? 'fin-muted' : 'inv-who-yes'}>{v}</td>;
  };
  return (
    <section className="panel fin-panel" aria-labelledby="inv-who-h" data-inv-who>
      <header className="panel-hd fin-hd2"><h3 id="inv-who-h">{ft(locale, 'p5_inv_who_h')}</h3></header>
      <div className="fin-scroll">
        <table className="fin-table">
          <thead>
            <tr><th><span className="sronly">{ft(locale, 'p5_inv_col_inv')}</span></th><th>HHL</th><th>KSH</th><th>{up('Scandinavian Express')}</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r}><th scope="row">{ft(locale, `p5_inv_who_r${r}`)}</th>{cell(r, 'hhl')}{cell(r, 'ksh')}{cell(r, 'scx')}</tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
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
  /* B-4b: przy fakturze wyłącznie PDF faktury + CMR (bez POD) */
  const docs = documents.filter((d) => d.loadId && lineIds.has(d.loadId) && d.category === 'CMR' && d.status !== 'MISSING');
  const pdf: Document | undefined = bill.pdfStoragePath && bill.pdfDocId
    ? {
        id: bill.pdfDocId, loadId: bill.lines[0]?.loadId ?? '', category: 'INVOICE', name: bill.pdfName ?? 'faktura.pdf',
        uploadedAt: bill.createdAt, deadline: null, status: 'UPLOADED', permitFits: null, visibleTo: [bill.issuer, bill.recipient],
        dataUrl: null, mimeType: 'application/pdf', bytes: 0, source: 'tower', storagePath: bill.pdfStoragePath,
      }
    : undefined;
  const verify = (v: BillVerification) => { if (verifyBill(bill.id, v, v === 'SPORNA' ? note : null)) setNote(''); };

  return (
    <div className="inv-detail" data-bill-detail={bill.id}>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>{fc(locale, 'p5c_bd_load')}</th>
              <th>{t(locale, 'bill_col_unload')}</th>
              <th className="num">{t(locale, bill.direction === 'PRZYCHOD' && role === 'KSH' ? 'bill_col_expected_ksh' : 'bill_col_expected')}</th>
              <th className="num">{t(locale, 'bill_col_invoiced')}</th>
              {bill.currency === 'PLN' ? <th>{fc(locale, 'p5c_bd_fx')}</th> : null}
              <th>{t(locale, 'bill_col_checks')}</th>
            </tr>
          </thead>
          <tbody>
            {bill.lines.map((ln) => {
              const l = byId.get(ln.loadId);
              const at = l ? unloadedAtOf(l) : null;
              /* wyglad/P5-c (E39): przy pozycji — tydzień i mnożnik opłaty paliwowej oraz kwota z wyliczenia */
              const fuel = billLineFuel(l, bill.direction, bill.currency, ln.fx, localDateOf(getNowIso()));
              return (
                <tr key={ln.loadId} style={{ cursor: 'pointer' }} {...clickableRow(() => { if (l) selectLoad(l.id); })}>
                  <td>
                    <span className="code" data-content>{l ? transportLabel(l, role) : '—'}</span>
                    {fuel ? (
                      <span className="inv-sub inv-fuel" data-bill-fuel={fuel.week} data-deur-exempt="fuel-index">
                        {fcp(locale, 'p5c_bd_fuel', { week: fuel.week, mult: formatPlNumber(fuel.mult, 2) })}
                        {fuel.forecast ? ` · ${fc(locale, 'p5c_bd_fuel_fc')}` : ''}
                        {fuel.amount != null ? ` · ${fcp(locale, 'p5c_bd_fuel_amt', { amt: formatPlNumber(fuel.amount, 2), cur: fuel.currency })}` : ''}
                      </span>
                    ) : null}
                  </td>
                  <td>{fmtDay(at ? localDateOf(at) : null)}</td>
                  <td className="num"><Amount n={ln.expectedNet} cur={bill.currency} /></td>
                  <td className="num"><Amount n={ln.invoicedNet} cur={bill.currency} /></td>
                  {bill.currency === 'PLN' ? (
                    <td className="mono" data-deur-exempt="invoice-fx" data-content>
                      {ln.fx ? `${ln.fx.tableNo} · ${formatPlNumber(ln.fx.mid, 4)} · ${fmtDay(ln.fx.effectiveDate)}` : '—'}
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
          {/* wyglad/P5 — E4 „Weryfikacja”: Akceptuj albo Sporna z powodem (bez osobnego „Zgodna”) */}
          <input className="input" style={{ flex: 1, minWidth: 220 }} placeholder={t(locale, 'bill_dispute_ph')} value={note} onChange={(e) => setNote(e.target.value)} aria-label={t(locale, 'bill_dispute_note')} data-dispute-note="" />
          <button type="button" className="btn ghost" data-verify="SPORNA" onClick={() => verify('SPORNA')}>{ft(locale, 'p5_inv_dispute')}</button>
          <button type="button" className="btn" data-verify="ZAAKCEPTOWANA" onClick={() => verify('ZAAKCEPTOWANA')}>{ft(locale, 'p5_inv_accept')}</button>
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
  const role = useTowerStore((s) => s.role);
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
  /* audyt-C C-09 (E4; decyzja 16.10, 13:58 · 1): wystawca wpisuje netto, VAT 23 % i brutto liczy system na bieżąco */
  const netN = num(net);
  const sums = netN != null ? vatGrossOf(netN) : null;

  const draft: BillDraft = {
    direction, number, issueDate, weekKey: week, currency, net: netN, vat: sums?.vat ?? null, gross: sums?.gross ?? null,
    dueDateFromDocument: dueDoc || null, pdfName: file?.name ?? null, pdfSize: file?.size ?? null,
    lines: candidates.filter((l) => lineOf(l.id).on).map((l) => {
      const st = lineOf(l.id);
      return { loadId: l.id, invoicedNet: num(st.net) ?? 0, invoicedFuel: num(st.fuel), fx: currency === 'PLN' && st.fxConfirmed ? st.fx : null };
    }),
  };
  const chk = checkBill(draft, loads, bills, today);

  const diff = Math.round((chk.invoicedTotal - chk.expectedTotal) * 100) / 100;
  const due = addDaysIso(issueDate || today, BILL_TERM_DAYS[direction]); /* 03_REJESTR: SCX → HHL 35 dni, HHL → KSH 30 dni */
  const offer = direction === 'KOSZT' && role === 'SCX' ? factoringOfferOf() : null;

  return (
    <div className="inv-form" data-bill-wizard={direction}>
      <header className="inv-form-hd">
        <h4 className="sec">{week ? ftp(locale, 'p5_inv_new_h', { no: Number(week.slice(-2)) }) : ft(locale, 'p5_inv_new')}</h4>
        <label className="inv-week">
          <span>{t(locale, 'bill_col_week')}</span>
          <select className="input" value={week} data-w="week" onChange={(e) => { setWeek(e.target.value); setLines({}); }}>
            {weeks.map((w) => <option key={w} value={w}>{weekOptionLabel(w)}</option>)}
          </select>
        </label>
      </header>
      <div className="inv-form-grid">
        <div className="inv-form-lines">
          <div className="fin-scroll">
            <table className="fin-table">
              <thead>
                <tr>
                  <th><span className="sronly">{t(locale, 'bill_col_checks')}</span></th>
                  <th>{up(t(locale, 'sched_col_code'))}</th>
                  <th>{up(t(locale, 'bill_col_unload'))}</th>
                  <th className="num">{up(t(locale, 'bill_col_expected'))}</th>
                  <th className="num">{up(t(locale, 'bill_col_invoiced'))}</th>
                  {currency === 'PLN' ? <th>{up(t(locale, 'bill_col_fx'))}</th> : null}
                  <th>{up(t(locale, 'bill_col_checks'))}</th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((l) => {
                  const st = lineOf(l.id);
                  const at = unloadedAtOf(l);
                  const res = chk.lines.find((x) => x.loadId === l.id);
                  return (
                    <tr key={l.id} data-w-line={l.code}>
                      <td><input type="checkbox" className="inv-check" checked={st.on} onChange={(e) => patch(l.id, { on: e.target.checked })} aria-label={transportLabel(l, role)} /></td>
                      <td><span className="code" data-content>{transportLabel(l, role)}</span></td>
                      <td>{fmtDay(at ? localDateOf(at) : null)}</td>
                      <td className="num"><Amount n={expectedNetFor(l, direction, currency, today)} cur={currency} /></td>
                      <td className="num" data-deur-exempt="invoice-currency"><input className="input inv-num" value={st.net} onChange={(e) => patch(l.id, { net: e.target.value })} disabled={!st.on} aria-label={`${t(locale, 'bill_col_invoiced')} · ${transportLabel(l, role)}`} /></td>
                      {currency === 'PLN' ? (
                        <td data-deur-exempt="invoice-fx">
                          {st.fx ? (
                            <span className="inv-fx">
                              <input className="input" style={{ width: 120 }} value={st.fx.tableNo} onChange={(e) => patch(l.id, { fx: { ...st.fx!, tableNo: e.target.value } })} aria-label={t(locale, 'bill_fx_table')} />
                              <input className="input" style={{ width: 80 }} value={String(st.fx.mid)} onChange={(e) => patch(l.id, { fx: { ...st.fx!, mid: Number(e.target.value.replace(',', '.')) || 0 } })} aria-label={t(locale, 'bill_fx_mid')} />
                              <input className="input" type="date" value={st.fx.effectiveDate} onChange={(e) => patch(l.id, { fx: { ...st.fx!, effectiveDate: e.target.value } })} aria-label={t(locale, 'bill_fx_date')} />
                              <label><input type="checkbox" data-fx-confirm checked={st.fxConfirmed} onChange={(e) => patch(l.id, { fxConfirmed: e.target.checked })} /> {t(locale, 'bill_fx_confirm')}</label>
                            </span>
                          ) : <span className="fin-tag warn">{BILL_FLAG_LABEL.BRAK_KURSU[locale]}</span>}
                        </td>
                      ) : null}
                      <td>
                        {!st.on ? '—' : res?.flags.length
                          ? res.flags.map((f) => <span key={f} className="fin-tag warn" data-flag={f} style={{ marginRight: 4 }}>{BILL_FLAG_LABEL[f][locale]}</span>)
                          : <span className="fin-tag go">{t(locale, 'bill_ok')}</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="fin-muted">{ft(locale, 'p5_inv_form_lines_note')}</p>
        </div>
        <div className="inv-form-fields">
          <div className="inv-fields">
            <label className="inv-field"><span>{t(locale, 'bill_col_number')}</span><input className="input" data-w="number" value={number} onChange={(e) => setNumber(e.target.value)} /></label>
            <label className="inv-field"><span>{t(locale, 'bill_col_issue')}</span><input className="input" type="date" data-w="issue" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} /></label>
            <div className="inv-field" data-deur-exempt="invoice-currency">
              <span id={`inv-cur-${direction}`}>{t(locale, 'bill_currency')}</span>
              <div className="seg" role="group" aria-labelledby={`inv-cur-${direction}`}>
                {(['EUR', 'PLN'] as const).map((c) => (
                  <button key={c} type="button" data-cur={c} aria-pressed={currency === c} onClick={() => { setCurrency(c); setLines({}); }}>{c}</button>
                ))}
              </div>
            </div>
            <label className="inv-field"><span>{t(locale, 'bill_due_doc_in')}</span><input className="input" type="date" data-w="due" value={dueDoc} onChange={(e) => setDueDoc(e.target.value)} /></label>
            <label className="inv-field" data-deur-exempt="invoice-currency"><span>{t(locale, 'bill_col_net')} ({currency})</span><input className="input" data-w="net" inputMode="decimal" value={net} onChange={(e) => setNet(e.target.value)} /></label>
            <label className="inv-field" data-deur-exempt="invoice-currency"><span>{ftp(locale, 'p5_inv_vat_auto', { cur: currency })}</span><input className="input inv-auto" data-w="vat" readOnly tabIndex={-1} value={sums ? formatPlNumber(sums.vat, 2) : '—'} /></label>
            <label className="inv-field" data-deur-exempt="invoice-currency"><span>{ftp(locale, 'p5_inv_gross_auto', { cur: currency })}</span><input className="input inv-auto" data-w="gross" readOnly tabIndex={-1} value={sums ? formatPlNumber(sums.gross, 2) : '—'} /></label>
            <label className="inv-field inv-field-wide"><span>{t(locale, 'bill_pdf')}</span><input className="input" type="file" accept="application/pdf" data-w="pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
          </div>
          <p className="fin-muted">{t(locale, 'bill_due_hint')} · {t(locale, 'bill_vat_hint')}</p>
          {offer ? <PaymentChoice offer={offer} net={netN} gross={sums?.gross ?? null} due={due} currency={currency} /> : null}
          <dl className="inv-sum" data-deur-exempt="invoice-currency">
            <div><dt>{ft(locale, 'p5_inv_form_sum_exp')}</dt><dd><Amount n={chk.expectedTotal} cur={currency} /></dd></div>
            <div><dt>{ft(locale, 'p5_inv_form_sum_inv')}</dt><dd><Amount n={chk.invoicedTotal} cur={currency} /></dd></div>
            <div className="strong"><dt>{ft(locale, 'p5_inv_form_sum_diff')}</dt><dd className={diff === 0 ? 'inv-ok' : 'neg'}><Amount n={diff} cur={currency} />{diff === 0 ? ` · ${ft(locale, 'p5_inv_form_sum_ok')}` : ''}</dd></div>
            <div><dt>{t(locale, 'bill_col_due')} ({BILL_TERM_DAYS[direction]})</dt><dd>{fmtDay(dueDoc || due)}</dd></div>
          </dl>
          {chk.headerFlags.length ? <span className="fin-tag warn" data-flag="BRAK_NA_FAKTURZE">{BILL_FLAG_LABEL.BRAK_NA_FAKTURZE[locale]} · {chk.missingLoadIds.length}</span> : null}
          <div className="inv-form-acts">
            <button type="button" className="btn ghost" onClick={() => onDone(null)}>{t(locale, 'bill_cancel')}</button>
            <button
              type="button"
              className="btn inv-send"
              data-w="submit"
              onClick={() => {
                const r = registerBill(draft, file);
                if (r.ok) onDone(r.id); else setErrors(r.errors);
              }}
            >
              {ft(locale, `p5_inv_form_send_${direction}`)}
            </button>
          </div>
          {errors.length ? (
            <div className="note inv-errors" data-w-errors>
              {errors.map((e) => <div key={e}>{errLabel(e, locale)}</div>)}
            </div>
          ) : null}
        </div>
      </div>
      <p className="note">{t(locale, 'bill_wizard_note')}</p>
    </div>
  );
}
