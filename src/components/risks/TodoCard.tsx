/**
 * wyglad/P6 — karta „Do zrobienia” (E7, img/e7-desk, img/e7-phone) i karta sprawy (E6, img/e6-desk, img/e6-phone).
 * Karta na transport: kod i numer zlecenia, status i daty, liczba spraw; kliknięcie rozwija kartę w miejscu (E7 pkt 9).
 * W środku sprawy: nazwa, kto decyduje albo uzupełnia, przypisana osoba, przyciski (☎ firmy, awizacja, „Biorę tę sprawę”,
 * „Uzupełnij”). „Szczegóły” otwiera kartę sprawy: transport, kto decyduje, przypisana do, „Zadzwoń w tej sprawie”,
 * historia; w produkcji także opcje rozstrzygnięcia z katalogu decyzji (dotychczasowe Centrum decyzji, bez zmiany zapisu).
 * Zakaz ruchu w dniu przejazdu — „ⓘ Informacja … (nie liczy się)”.
 */
import { useState, type ReactNode } from 'react';
import type { Load, Locale, OrgKind } from '../../types';
import type { CaseEvent, CasePerson, TodoCard, TodoIssue } from '../../lib/p6Todo';
import type { DecisionsApi } from './useDecisions';
import { riskText, t } from '../../i18n/messages';
import { decText } from '../../i18n/decisions';
import { rt, rtHas, rtn, rtp } from '../../i18n/p6';
import { formatListDateTime, formatPlNumber } from '../../lib/format';
import { routeStatusLabel } from '../../lib/statusLabel';
import { stripTransportPrefix, transportLabel } from '../../lib/transportName';
import { durText } from '../../lib/p5Fees';
import { AUTO_RISK_CODES, autoRiskLabel, type AutoRiskCode } from '../../lib/sailings';
import { DeliveredCheckCard } from '../drawer/DeliveredCheckCard';
import { DetourCard } from './DetourCard';
import { e49t } from '../../i18n/e49';
import { timeOnly } from '../../lib/statusAxis';
import { EMPTY_PROPOSAL, proposalOfDetail, proposalPayload, proposalSummary, type ProposalForm } from '../../lib/proposeDate';
import { getNow } from '../../lib/frozenNow';
import { etaCalibDecisionLine } from '../../lib/etaCalibAuto';
import { confirmKeyOf, hasOwnSnooze, optionVisible, takesNote } from '../../lib/carrierDecision';

export interface CardCtx {
  role: 'HHL' | 'SCX';
  locale: Locale;
  phone: boolean;
  nowIso: string;
  loadOf: (id: string) => Load | undefined;
  /** DP-137: kod trasy rejsu — etykiety FI zamiast „Droga SE” (25A). */
  routeOf?: (sailingId: string | null | undefined) => string | null;
  /** przydział podłączony (demo albo wykonawca) */
  assignOn: boolean;
  assignee: (issueId: string) => CasePerson | null;
  me: CasePerson | null;
  peopleOf: (org: OrgKind) => CasePerson[] | null;
  historyOf: (issueId: string) => CaseEvent[] | null;
  onTake: (i: TodoIssue) => void;
  onGive: (i: TodoIssue) => void;
  onTakeover: (i: TodoIssue) => void;
  /** sprawa czekająca na potwierdzenie „Przejmij” (E6-5) */
  confirmId: string | null;
  onConfirm: (i: TodoIssue) => void;
  onCancelConfirm: () => void;
  onGo: (i: TodoIssue) => void;
  onFee: (i: TodoIssue) => void;
  checkHandlers: (i: TodoIssue) => { onYes?: () => void; onNo?: () => void; busy?: boolean };
  /** wyglad/E49: „Objazd czy postój?” — kto decyduje i zapis (null = nie podłączone) */
  detourHandlers: (i: TodoIssue) => { canDecide: boolean; busy: boolean; onDecide: ((pick: 'HOLD' | 'DETOUR', note: string | null) => void) | null };
  decisions: DecisionsApi | null;
  /** `overdue` — decyzja po terminie albo eskalowana (#384 pkt 6: wtedy także Operacje HHL) */
  mayResolve: (deciderRole: string | null, overdue?: boolean) => boolean;
  /** rola konta oglądającego (`accountRole`) — na produkcji z profilu; `me` jest tylko w demo */
  userRole: string | null;
  onResolved: (i: TodoIssue, hint: string | null) => void;
}

const ORG_SHORT: Record<OrgKind, string> = { HHL: 'HHL', SCX: 'SCX', KSH: 'KSH' };
/* „08.10.2026” — rok zawsze (właściciel 16.10.2026) */
const dm = (iso: string | null | undefined) => (iso ? formatListDateTime(iso).split(', ')[0] : '—');
const sevClass = (s: string) => (s === 'CRITICAL' || s === 'HIGH' ? 'is-red' : s === 'MEDIUM' ? 'is-amber' : 'is-sea');

export function cardTitle(card: TodoCard, ctx: CardCtx): string {
  const load = card.loadId ? ctx.loadOf(card.loadId) : undefined;
  if (!card.loadId) return issueTexts(card.issues[0], ctx).name;
  if (!load) return rt(ctx.locale, 'p6_load_unknown');
  const full = transportLabel(load, ctx.role);
  if (!ctx.phone) return full;
  /* telefon: „SG-05 · 15065” — pierwsza liczba numeru zlecenia, bez roku (img/e7-phone) */
  const [code, num] = full.split(' \u00B7 ');
  if (!num) return full;
  const part = num.split('/').find((x) => /^\d+$/.test(x) && !/^20\d\d$/.test(x));
  return part ? `${code} \u00B7 ${part}` : full;
}

export function issueTexts(i: TodoIssue, ctx: CardCtx): { name: string; detail: string } {
  const { locale } = ctx;
  const org = rt(locale, `p6_org_${i.owner}`);
  const a = ctx.assignOn ? ctx.assignee(i.id) : null;
  const who = i.go === 'INVOICE' ? rtp(locale, 'p6_checks_pay', { org })
    : !i.decision && (i.go === 'AWIZACJA' || i.go === 'DOCS') ? rtp(locale, 'p6_fills', { org }) : rtp(locale, 'p6_decides', { org });
  const taken = !ctx.assignOn ? null : !a ? rt(locale, 'p6_nobody') : a.id === ctx.me?.id ? rt(locale, 'p6_taken_me') : rtp(locale, 'p6_taken', { name: a.name });
  const load = i.loadId ? ctx.loadOf(i.loadId) : undefined;
  if (i.decision) {
    const d = i.decision;
    const short = rtHas(`p6_dec_short_${d.typeCode}`) ? rt(locale, `p6_dec_short_${d.typeCode}`) : decText(locale, d.titleKey, d.title);
    const name = d.dueAt
      ? rtp(locale, i.overdue ? 'p6_dec_over' : 'p6_dec_due', { what: short, date: formatListDateTime(d.dueAt) })
      : short;
    const merged = i.merged > 1 ? rtn(locale, 'p6_merged', i.merged) : null;
    /* treść tej decyzji (który wiersz, jaka ETA) — jak w dawnym Centrum decyzji */
    const own = stripTransportPrefix(d.title, load?.code);
    const specific = own && own !== short && own !== decText(locale, d.titleKey, '') ? own : null;
    return { name, detail: [specific, rtp(locale, 'p6_decides', { org }), taken, merged].filter(Boolean).join(' · ') };
  }
  if (i.fee) {
    const f = i.fee;
    const name = f.kind === 'DWELL'
      ? rtp(locale, 'p6_fee_name_DWELL', { where: f.where, dur: f.minutes != null ? durText(f.minutes) : '—' })
      : rtp(locale, 'p6_fee_name_CANCEL', { pct: f.pct ?? 0 });
    const amount = ctx.role === 'SCX' ? f.costEur : f.revEur;
    const detail = ctx.role === 'HHL' && f.scx === 'CZEKA_HHL'
      ? rtp(locale, 'p6_fee_wait_hhl', { fee: `${formatPlNumber(f.costEur, 2)} EUR` })
      : rtp(locale, 'p6_fee_sub', { fee: `${formatPlNumber(amount, 2)} EUR`, org });
    return { name, detail };
  }
  if (i.check) return { name: '', detail: '' };
  if (i.detour) {
    return { name: e49t('e49_short', { place: i.detour.place }), detail: rtp(locale, 'p6_decides', { org }) + ` · ${timeOnly(i.detour.decideByIso)}` };
  }
  const r = i.risk!;
  /* P11 pkt 7 (e32, e41): nazwa sprawy od wielkiej litery po zdjęciu kodu transportu („Brak numeru zlecenia HHL”) */
  const name0 = stripTransportPrefix(riskText(locale, r.title, r.titleKey, r.titleParams), load?.code);
  const name = name0.charAt(0).toLocaleUpperCase('pl') + name0.slice(1);
  /* „Odpowiada: X” z dawnego opisu zastępuje „uzupełnia / decyduje X” (E6) */
  const meta = riskText(locale, r.meta, r.metaKey, r.metaParams).replace(/^Odpowiada:[^·]*(·\s*)?/, '').trim();
  const merged = i.merged > 1 ? rtn(locale, 'p6_merged', i.merged) : null;
  /* rodzaj automatu i rejsu (M10) — jak dawna lista ryzyk */
  const tag = r.code && (AUTO_RISK_CODES as string[]).includes(r.code) ? autoRiskLabel(r.code as AutoRiskCode, locale) : null;
  return { name, detail: [tag, meta || null, who, taken, merged].filter(Boolean).join(' · ') };
}

function loadLine(load: Load, ctx: CardCtx): string {
  const loadDay = load.plannedLoadDate ? dm(load.plannedLoadDate) : '—';
  const past = !!load.plannedLoadDate && Date.parse(`${load.plannedLoadDate.slice(0, 10)}T23:59:59Z`) < Date.parse(ctx.nowIso)
    && ['PLANNED', 'RESOURCES_PENDING', 'DOC_MISSING', 'READY'].includes(load.status);
  const route = ctx.routeOf?.(load.sailingId) ?? null;
  return rtp(ctx.locale, 'p6_load_dates', {
    status: routeStatusLabel(load.status, load.stage, ctx.locale, route),
    load: loadDay,
    late: past ? rt(ctx.locale, 'p6_load_late') : '',
    deliver: load.plannedDeliverDate ? dm(load.plannedDeliverDate) : '—',
  });
}

function PhoneLink({ person, className, children, label }: { person: CasePerson; className: string; children: ReactNode; label: string }) {
  if (!person.phone) return null;
  return <a className={className} href={`tel:${person.phone.replace(/\s/g, '')}`} aria-label={label}>{children}</a>;
}

/** Przyciski sprawy (prawa strona; na telefonie pod tekstem). */
function IssueActions({ i, ctx }: { i: TodoIssue; ctx: CardCtx }) {
  const { locale, role } = ctx;
  const mine = i.owner === role;
  const a = ctx.assignOn ? ctx.assignee(i.id) : null;
  const people = !mine ? ctx.peopleOf(i.owner) : null;
  const callTo = people?.length ? (people.find((p) => p.id === a?.id) ?? people[0]) : null;
  if (ctx.confirmId === i.id && a) {
    return (
      <div className="rk-acts rk-confirm" role="group" aria-label={rtp(locale, 'p6_takeover_q', { name: a.name })}>
        <span className="rk-confirm-q">{rtp(locale, 'p6_takeover_q', { name: a.name })}</span>
        <button type="button" className="btn" data-rk-confirm={i.id} onClick={() => ctx.onConfirm(i)}>{rt(locale, 'p6_takeover_yes')}</button>
        <button type="button" className="btn ghost" onClick={ctx.onCancelConfirm}>{rt(locale, 'p6_cancel')}</button>
      </div>
    );
  }
  const out: ReactNode[] = [];
  if (callTo?.phone) {
    out.push(
      <PhoneLink key="call" person={callTo} className="btn rk-call" label={rtp(locale, 'p6_case_call_to', { name: callTo.name, phone: callTo.phone })}>
        <span aria-hidden="true">☎{'\u00a0'}</span>{ORG_SHORT[i.owner]}
      </PhoneLink>,
    );
  }
  if (mine && ctx.assignOn && ctx.me && i.src !== 'CHECK') {
    if (!a) out.push(<button key="take" type="button" className="btn rk-take" data-rk-take={i.id} onClick={() => ctx.onTake(i)}>{rt(locale, 'p6_take')}</button>);
    else if (a.id === ctx.me.id) out.push(<button key="give" type="button" className="btn ghost" data-rk-give={i.id} onClick={() => ctx.onGive(i)}>{rt(locale, 'p6_give')}</button>);
    else if (a.org === ctx.me.org) out.push(<button key="over" type="button" className="btn ghost" data-rk-takeover={i.id} onClick={() => ctx.onTakeover(i)}>{rt(locale, 'p6_takeover')}</button>);
  }
  if (i.go === 'AWIZACJA') {
    out.push(<button key="go" type="button" className="btn ghost" data-rk-go="awizacja" onClick={() => ctx.onGo(i)}>
      {mine ? rt(locale, 'p6_fill') : ctx.phone ? rt(locale, 'p6_awiz_s') : rt(locale, 'p6_awiz')}
    </button>);
  } else if (i.go === 'DOCS') {
    out.push(<button key="go" type="button" className="btn ghost" data-rk-go="docs" onClick={() => ctx.onGo(i)}>{rt(locale, 'p6_docs')}</button>);
  } else if (i.go === 'FEE') {
    out.push(<button key="go" type="button" className="btn ghost" data-rk-go="fee" onClick={() => ctx.onFee(i)}>{rt(locale, 'p6_fee')}</button>);
  } else if (i.go === 'INVOICE') {
    out.push(<button key="go" type="button" className="btn ghost" data-rk-go="invoice" onClick={() => ctx.onGo(i)}>{rt(locale, 'p6_invoice')}</button>);
  } else if ((i.go === 'OPEN' || i.go === 'PRICING') && i.loadId) {
    out.push(<button key="go" type="button" className="btn ghost" data-rk-go="open" onClick={() => ctx.onGo(i)}>{rt(locale, 'p6_open')}</button>);
  }
  return out.length ? <div className="rk-acts">{out}</div> : null;
}

/** Karta sprawy (E6): transport, kto decyduje, przypisana do, „Zadzwoń w tej sprawie”, rozstrzygnięcie, historia. */
function CaseDetail({ i, ctx }: { i: TodoIssue; ctx: CardCtx }) {
  const { locale } = ctx;
  const load = i.loadId ? ctx.loadOf(i.loadId) : undefined;
  const a = ctx.assignOn ? ctx.assignee(i.id) : null;
  const decider = ctx.peopleOf(i.owner);
  /* przy sprawie przewoźnika — także Operacje HHL („gdy przewoźnik nie odbiera”, img/e6-desk) */
  const backup = i.owner === 'SCX' ? (ctx.peopleOf('HHL') ?? []).filter((p) => p.role === 'HHL_OPS') : [];
  const call = decider ? [...[...decider].sort((x, y) => Number(y.id === a?.id) - Number(x.id === a?.id)), ...backup] : null;
  const history = ctx.historyOf(i.id);
  const d = i.decision;
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  /* #384 pkt 5: formularz terminu dla opcji z efektem PROPOSE („Proponuję inny termin”) */
  const [proposeCode, setProposeCode] = useState<string | null>(null);
  const [prop, setProp] = useState<ProposalForm>(EMPTY_PROPOSAL);
  const [msg, setMsg] = useState<string | null>(null);
  /* #590/#592: Anuluj / Usuń / Przywróć — potwierdzenie na stronie (bez okien przeglądarki) */
  const [confirmOpt, setConfirmOpt] = useState<string | null>(null);
  const roleKey = i.owner === 'SCX' ? 'CARRIER_DISPATCH' : i.owner === 'KSH' ? 'CLIENT_USER' : 'HHL_OPS';
  const adminOnly = d?.deciderRole === 'ADMIN';
  const sendProposal = async () => {
    if (!ctx.decisions || !d || !proposeCode) return;
    const r = proposalPayload(prop, getNow());
    if ('error' in r) {
      setMsg(decText(locale, `dec_prop_err_${r.error}`));
      return;
    }
    setBusy(true);
    const res = await ctx.decisions.resolve(d.id, proposeCode, note.trim() || proposalSummary(prop), r.payload);
    setBusy(false);
    if (res.error) setMsg(res.error);
    else ctx.onResolved(i, res.hint);
  };
  const resolve = async (code: string, needsNote: boolean, effect?: string, confirmed = false) => {
    if (!ctx.decisions || !d) return;
    if (!confirmed && confirmKeyOf(d.typeCode, code)) {
      if (needsNote && note.trim().length < 3) {
        setMsg(t(locale, 'dec_need_comment'));
        return;
      }
      setMsg(null);
      setProposeCode(null);
      setConfirmOpt((c) => (c === code ? null : code));
      return;
    }
    setConfirmOpt(null);
    if (effect === 'PROPOSE') {
      setMsg(null);
      setProposeCode((c) => (c === code ? null : code));
      return;
    }
    if (needsNote && note.trim().length < 3) {
      setMsg(t(locale, 'dec_need_comment'));
      return;
    }
    setBusy(true);
    const r = await ctx.decisions.resolve(d.id, code, note.trim() || null);
    setBusy(false);
    if (r.error) setMsg(r.error);
    else ctx.onResolved(i, r.hint);
  };
  const snooze = async () => {
    if (!ctx.decisions || !d) return;
    setBusy(true);
    const e = await ctx.decisions.snooze(d.id, 2);
    setBusy(false);
    if (e) setMsg(e);
    else ctx.onResolved(i, null);
  };
  return (
    <div className="rk-case" data-rk-case={i.id}>
      <dl className="rk-case-dl">
        {load ? (
          <div><dt>{rt(locale, 'p6_case_load')}</dt><dd>{loadLine(load, ctx)}</dd></div>
        ) : null}
        <div>
          <dt>{rt(locale, i.go === 'INVOICE' ? 'p6_case_pay' : !d && (i.go === 'AWIZACJA' || i.go === 'DOCS') ? 'p6_case_fill' : 'p6_case_dec')}</dt>
          <dd>{adminOnly
            ? rtp(locale, 'p6_case_dec_admin', { org: rt(locale, `p6_org_${i.owner}`) })
            : rtp(locale, 'p6_case_dec_line', { org: rt(locale, `p6_org_${i.owner}`), role: rt(locale, `p6_role_${roleKey}`) })}</dd>
        </div>
        {d && proposalOfDetail(d.detail) ? (
          <div><dt>{decText(locale, 'dec_prop_title')}</dt><dd data-rk-proposal>{proposalOfDetail(d.detail)}</dd></div>
        ) : null}
        {d && etaCalibDecisionLine(d.typeCode, d.detail) ? (
          <div><dt>{decText(locale, 'dec_eta_calib_title')}</dt><dd data-rk-eta-calib>{etaCalibDecisionLine(d.typeCode, d.detail)}</dd></div>
        ) : null}
        {ctx.assignOn ? (
          <div><dt>{rt(locale, 'p6_case_assigned')}</dt><dd><b>{a ? (a.id === ctx.me?.id ? `${rt(locale, 'p6_me')} (${a.name})` : a.name) : rt(locale, 'p6_case_assigned_none')}</b></dd></div>
        ) : null}
      </dl>
      {call && call.length ? (
        <div className="rk-callbox">
          <h4 className="rk-sec">{rt(locale, 'p6_case_call')}</h4>
          <ul>
            {call.map((p) => (
              <li key={p.id} className={p.id === a?.id ? 'is-assigned' : undefined}>
                <span className="rk-person">
                  <b>{p.name}</b>
                  <span>
                    {rt(locale, `p6_role_${p.role}`)} · {rt(locale, `p6_org_${p.org}`)}
                    {p.id === a?.id ? ` · ${rt(locale, 'p6_case_assigned_tag')}` : ''}
                    {p.org !== i.owner ? ` · ${rt(locale, 'p6_case_backup')}` : ''}
                  </span>
                </span>
                {p.phone ? <span className="rk-phone">{p.phone}</span> : <span className="rk-phone neg">{rt(locale, 'p6_case_no_phone')}</span>}
                {p.phone ? (
                  <PhoneLink person={p} className={p.id === a?.id ? 'btn rk-call-btn is-solid' : 'btn rk-call-btn'} label={rtp(locale, 'p6_case_call_to', { name: p.name, phone: p.phone })}>
                    <span aria-hidden="true">☎{'\u00a0'}</span>{rt(locale, 'p6_case_call_btn')}
                  </PhoneLink>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {d && ctx.decisions ? (
        ctx.mayResolve(d.deciderRole, i.overdue || !!d.escalatedAt) ? (
          <div className="rk-resolve">
            <div className="rk-acts">
              {d.options.filter((o) => optionVisible(d.typeCode, o.code, ctx.userRole)).map((o) => (
                <button key={o.code} type="button" className="btn" disabled={busy} data-rk-opt={o.code}
                  aria-expanded={o.effect === 'PROPOSE' ? proposeCode === o.code : confirmKeyOf(d.typeCode, o.code) ? confirmOpt === o.code : undefined}
                  onClick={() => void resolve(o.code, o.requires_comment, o.effect)}>
                  {decText(locale, o.label_key, o.code)}{o.requires_comment && o.effect !== 'PROPOSE' ? ' *' : ''}
                </button>
              ))}
              {hasOwnSnooze(d.typeCode) ? null : (
                <button type="button" className="btn ghost" disabled={busy} onClick={() => void snooze()}>{t(locale, 'dec_snooze_2h')}</button>
              )}
            </div>
            {confirmOpt ? (() => {
              const o = d.options.find((x) => x.code === confirmOpt);
              const key = confirmKeyOf(d.typeCode, confirmOpt);
              if (!o || !key) return null;
              return (
                <div className="rk-dec-confirm" role="alert" data-rk-dec-confirm={o.code}>
                  <p>{decText(locale, key)}</p>
                  <div className="rk-acts">
                    <button type="button" className={o.code === 'REMOVE' || o.code === 'CANCEL' ? 'btn is-solid is-danger' : 'btn is-solid'} disabled={busy}
                      data-rk-dec-yes={o.code} autoFocus onClick={() => void resolve(o.code, o.requires_comment, o.effect, true)}>
                      {decText(locale, 'dec_confirm_yes')}: {decText(locale, o.label_key, o.code)}
                    </button>
                    <button type="button" className="btn ghost" disabled={busy} data-rk-dec-back onClick={() => {
                      const back = o.code;
                      setConfirmOpt(null);
                      requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-rk-case="${CSS.escape(i.id)}"] [data-rk-opt="${CSS.escape(back)}"]`)?.focus());
                    }}>
                      {decText(locale, 'dec_confirm_back')}
                    </button>
                  </div>
                </div>
              );
            })() : null}
            {proposeCode ? (
              <fieldset className="rk-propose" data-rk-propose>
                <legend>{decText(locale, 'dec_prop_title')}</legend>
                <div className="rk-propose-grid">
                  <label><span>{decText(locale, 'dec_prop_load_date')} *</span>
                    <input className="input" type="date" required value={prop.loadDate} data-rk-prop="load_date"
                      onChange={(e) => setProp((p) => ({ ...p, loadDate: e.target.value }))} /></label>
                  <label><span>{decText(locale, 'dec_prop_load_time')}</span>
                    <input className="input" type="time" value={prop.loadTime} data-rk-prop="load_time"
                      onChange={(e) => setProp((p) => ({ ...p, loadTime: e.target.value }))} /></label>
                  <label><span>{decText(locale, 'dec_prop_del_date')}</span>
                    <input className="input" type="date" value={prop.deliveryDate} data-rk-prop="delivery_date"
                      onChange={(e) => setProp((p) => ({ ...p, deliveryDate: e.target.value }))} /></label>
                  <label><span>{decText(locale, 'dec_prop_del_time')}</span>
                    <input className="input" type="time" value={prop.deliveryTime} data-rk-prop="delivery_time"
                      onChange={(e) => setProp((p) => ({ ...p, deliveryTime: e.target.value }))} /></label>
                </div>
                <p className="rk-muted">{decText(locale, 'dec_prop_hint')}</p>
                <button type="button" className="btn is-solid" disabled={busy} data-rk-prop-send onClick={() => void sendProposal()}>
                  {decText(locale, 'dec_prop_send')}
                </button>
              </fieldset>
            ) : null}
            {takesNote(d.typeCode) ? (
              <label className="rk-note">
                <span>{t(locale, 'dec_comment')}</span>
                <textarea className="input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
              </label>
            ) : null}
          </div>
        ) : <p className="rk-muted" data-rk-other-firm>{rtp(locale, 'p6_case_other_firm', { org: ORG_SHORT[i.owner] })}</p>
      ) : null}
      {msg ? <p className="rk-muted neg" role="status">{msg}</p> : null}
      {history && history.length ? (
        <div className="rk-hist">
          <h4 className="rk-sec">{rt(locale, 'p6_case_hist')}</h4>
          <ul>
            {history.map((h, k) => <li key={k}>{formatListDateTime(h.at)} · <b>{h.who}</b> · {h.what}</li>)}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function IssueRow({ i, ctx, open, onToggle }: { i: TodoIssue; ctx: CardCtx; open: boolean; onToggle: () => void }) {
  const { locale } = ctx;
  if (i.check) {
    const h = ctx.checkHandlers(i);
    return (
      <li className="rk-issue is-check" data-rk-issue={i.id}>
        <DeliveredCheckCard check={i.check} locale={locale} busy={h.busy} onYes={h.onYes} onNo={h.onNo} />
      </li>
    );
  }
  if (i.detour) {
    const h = ctx.detourHandlers(i);
    return (
      <li className="rk-issue is-detour" data-rk-issue={i.id} data-src={i.src}>
        <DetourCard c={i.detour} nowIso={ctx.nowIso} canDecide={h.canDecide} busy={h.busy} onDecide={h.onDecide} />
      </li>
    );
  }
  const tx = issueTexts(i, ctx);
  return (
    <li className="rk-issue" data-rk-issue={i.id} data-src={i.src}>
      <div className="rk-issue-main">
        <div className="rk-issue-tx">
          <b className="rk-issue-name">{tx.name}</b>
          {tx.detail ? <span className="rk-issue-sub">{tx.detail}</span> : null}
          <button type="button" className="linkbtn rk-more" aria-expanded={open} data-rk-details={i.id} onClick={onToggle}>
            {rt(locale, open ? 'p6_details_hide' : 'p6_details')}
          </button>
        </div>
        <IssueActions i={i} ctx={ctx} />
      </div>
      {open ? <CaseDetail i={i} ctx={ctx} /> : null}
    </li>
  );
}

export function TodoCardView({
  card, ctx, expanded, onToggle, openIssue, setOpenIssue,
}: {
  card: TodoCard;
  ctx: CardCtx;
  expanded: boolean;
  onToggle: () => void;
  openIssue: string | null;
  setOpenIssue: (id: string | null) => void;
}) {
  const { locale } = ctx;
  const load = card.loadId ? ctx.loadOf(card.loadId) : undefined;
  const n = card.issues.length;
  const title = cardTitle(card, ctx);
  const tag = <span className={`rk-tag ${sevClass(card.severity)}`}>{ctx.phone ? n : rtn(locale, 'p6_issues', n)}</span>;
  const infos = card.infos.length ? (
    <span className="rk-infos">
      {card.infos.map((x) => (
        <span key={x.id} className="rk-info" data-rk-info>
          <span aria-hidden="true">ⓘ </span>
          {rtp(locale, ctx.phone ? 'p6_info_s' : 'p6_info', { text: riskText(locale, x.risk.title, x.risk.titleKey, x.risk.titleParams) })}
        </span>
      ))}
    </span>
  ) : null;

  /* karta bez transportu (np. SEFS): jedna sprawa, przyciski od razu */
  if (!card.loadId) {
    const i = card.issues[0];
    const tx = issueTexts(i, ctx);
    const open = openIssue === i.id;
    return (
      <article className={`rk-card ${sevClass(card.severity)}`} data-rk-card={card.key} data-rk-issue={i.id}>
        <div className="rk-card-row">
          <div className="rk-card-tx">
            <h3 className="rk-card-t">{tx.name}</h3>
            <span className="rk-card-s">{tx.detail}</span>
            <button type="button" className="linkbtn rk-more" aria-expanded={open} data-rk-details={i.id} onClick={() => setOpenIssue(open ? null : i.id)}>
              {rt(locale, open ? 'p6_details_hide' : 'p6_details')}
            </button>
          </div>
          <IssueActions i={i} ctx={ctx} />
        </div>
        {open ? <CaseDetail i={i} ctx={ctx} /> : null}
      </article>
    );
  }

  const summary = card.issues.map((i) => (i.check ? null : issueTexts(i, ctx).name)).filter(Boolean).slice(0, 2).join(' · ');
  return (
    <article className={`rk-card ${sevClass(card.severity)}${expanded ? ' is-open' : ''}`} data-rk-card={card.key}>
      <button type="button" className="rk-card-hd" aria-expanded={expanded} onClick={onToggle}>
        <span className="rk-card-tx">
          <span className="rk-card-t">{title}</span>
          <span className="rk-card-s">{expanded && load ? loadLine(load, ctx) : summary}</span>
          {infos}
        </span>
        {tag}
      </button>
      {expanded ? (
        <ul className="rk-issues">
          {card.issues.map((i) => (
            <IssueRow key={i.id} i={i} ctx={ctx} open={openIssue === i.id} onToggle={() => setOpenIssue(openIssue === i.id ? null : i.id)} />
          ))}
        </ul>
      ) : null}
    </article>
  );
}
