/**
 * M6 — faktury, model trzech stron (MECHANIZM_PIENIEDZY §6; baza: 0003 + 0014 `register_invoice`).
 *   KOSZT    — wystawca SCX, odbiorca HHL; widzą HHL i SCX, KSH nigdy.
 *   PRZYCHOD — wystawca HHL, odbiorca KSH; widzą HHL i KSH, SCX nigdy.
 * Netto / VAT / brutto przepisane z dokumentu (system nie liczy VAT). Kurs per pozycja (PLN)
 * podpowiadany z reguły W3, wystawca potwierdza albo poprawia. Kontrole = te same co w bazie.
 * Dwa niezależne statusy: weryfikacja (odbiorca) i płatność (wyłącznie HHL).
 */
import type { Bill, BillDirection, BillFlag, BillLine, BillLineFx, BillPayment, BillVerification, Load, OrgKind, RoleId } from '../types';
import { isoWeekKeyLocal, localDateOf } from './money/engine';

export function addDaysIso(dateIso: string, days: number): string {
  const d = new Date(`${dateIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
import { fxForDate, unloadedAtOf } from './money/loadMoney';

export const BILL_TERM_DAYS: Record<BillDirection, number> = { PRZYCHOD: 30, KOSZT: 35 };
/** Tolerancja kwoty — jak `matchInvoice` i `register_invoice`: > 1 i > 0,2 %. */
export const BILL_TOLERANCE = { abs: 1, pct: 0.002 };

export function billParties(direction: BillDirection): { issuer: OrgKind; recipient: OrgKind } {
  return direction === 'KOSZT' ? { issuer: 'SCX', recipient: 'HHL' } : { issuer: 'HHL', recipient: 'KSH' };
}

/** W7 — widoczność (lustro RLS `invoices_read`). */
export function billVisibleTo(role: RoleId, b: Pick<Bill, 'issuer' | 'recipient'>): boolean {
  return role === 'HHL' || b.issuer === role || b.recipient === role;
}
export const canRegisterBill = (role: RoleId, direction: BillDirection): boolean =>
  (direction === 'KOSZT' && role === 'SCX') || (direction === 'PRZYCHOD' && role === 'HHL');
/** Weryfikuje odbiorca; wystawca nie weryfikuje własnej (Q14). */
export const canVerifyBill = (role: RoleId, b: Pick<Bill, 'recipient' | 'verification'>): boolean =>
  b.recipient === role;
/** „Opłacona” i cofnięcie — wyłącznie HHL (funkcja bazy z datą / powodem, dziennik audytu). */
export const canMarkPaid = (role: RoleId): boolean => role === 'HHL';

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const outOfTolerance = (diff: number, base: number) =>
  Math.abs(diff) > BILL_TOLERANCE.abs && (base === 0 || Math.abs(diff) / base > BILL_TOLERANCE.pct);

/** Reguła kursu dla transportu: migawka przy rozładunku, inaczej W3 z tabel. */
export function ruleFxFor(load: Load, direction: BillDirection, todayLocal: string): BillLineFx | null {
  const side = direction === 'KOSZT' ? load.pricing.money?.cost : load.pricing.money?.rev;
  if (side?.fx?.tableNo && !side.fx.provisional) return { tableNo: side.fx.tableNo, mid: side.fx.mid, effectiveDate: side.fx.date };
  const at = unloadedAtOf(load);
  if (!at) return null;
  const { rate, provisional } = fxForDate(localDateOf(at), todayLocal);
  return provisional ? null : { tableNo: rate.no, mid: rate.mid, effectiveDate: rate.effectiveDate };
}

/**
 * Podpowiedź kursu pozycji (W3) — wystawca potwierdza albo poprawia. Gdy reguła nie jest jeszcze
 * rozstrzygnięta (kurs prowizoryczny), podpowiedzią jest migawka transportu — kontrola kursu i tak
 * porównuje z regułą (w bazie: fx_rate_before).
 */
export function suggestLineFx(load: Load, direction: BillDirection, todayLocal: string): BillLineFx | null {
  const rule = ruleFxFor(load, direction, todayLocal);
  if (rule) return rule;
  const side = direction === 'KOSZT' ? load.pricing.money?.cost : load.pricing.money?.rev;
  return side?.fx?.tableNo ? { tableNo: side.fx.tableNo, mid: side.fx.mid, effectiveDate: side.fx.date } : null;
}

/** Wyliczenie strony w EUR (Z1: nigdy nadpisywane fakturą). */
export function computedEurFor(load: Load, direction: BillDirection): number {
  const side = direction === 'KOSZT' ? load.pricing.money?.cost : load.pricing.money?.rev;
  return side?.computedEur ?? (direction === 'KOSZT' ? load.pricing.costTotal : load.pricing.revTotal);
}
export const fuelEurFor = (load: Load, direction: BillDirection): number =>
  direction === 'KOSZT' ? load.pricing.costSefs : load.pricing.revSefs;

export function expectedNetFor(load: Load, direction: BillDirection, currency: 'EUR' | 'PLN', todayLocal: string): number | null {
  const eur = computedEurFor(load, direction);
  if (currency === 'EUR') return round2(eur);
  const fx = ruleFxFor(load, direction, todayLocal);
  return fx ? round2(eur * fx.mid) : null;
}

export interface BillLineDraft { loadId: string; invoicedNet: number; invoicedFuel?: number | null; fx?: BillLineFx | null }
export interface BillDraft {
  direction: BillDirection;
  number: string;
  issueDate: string;
  receiptDate?: string | null;
  weekKey: string;
  currency: 'EUR' | 'PLN';
  net: number | null;
  vat: number | null;
  gross: number | null;
  dueDateFromDocument?: string | null;
  pdfName?: string | null;
  lines: BillLineDraft[];
}

/** Transporty kierunku: KOSZT — przewoźnika (SCX), PRZYCHOD — wszystkie transporty projektu. */
const loadsOfDirection = (loads: Load[], direction: BillDirection) =>
  direction === 'KOSZT' ? loads.filter((l) => !l.carrierId || l.carrierId === 'org-scx') : loads;

/** Transporty już na fakturze tego kierunku (podwójne fakturowanie → blokada). */
export function invoicedLoadIds(bills: Bill[], direction: BillDirection, exceptBillId?: string): Set<string> {
  return new Set(bills.filter((b) => b.direction === direction && b.id !== exceptBillId).flatMap((b) => b.lines.map((l) => l.loadId)));
}

/** Transporty zrealizowane w tygodniu (lokalnie), jeszcze niezafakturowane w kierunku — kandydaci do kreatora. */
export function billCandidates(loads: Load[], bills: Bill[], direction: BillDirection, weekKey: string): Load[] {
  const done = invoicedLoadIds(bills, direction);
  return loadsOfDirection(loads, direction).filter((l) => {
    const at = unloadedAtOf(l);
    return at && isoWeekKeyLocal(at) === weekKey && !done.has(l.id);
  });
}

export interface BillCheck {
  lines: BillLine[];
  headerFlags: string[];
  missingLoadIds: string[];
  /** Błędy blokujące rejestrację (jak w bazie) — kody: NUMBER, ISSUE_DATE, WEEK, AMOUNTS, PDF, NO_LINES, DOUBLE:<kod>, ROLE. */
  errors: string[];
  expectedTotal: number;
  invoicedTotal: number;
}

/** Kontrole przy rejestracji — lustro `register_invoice` (§6.3). */
export function checkBill(draft: BillDraft, loads: Load[], bills: Bill[], todayLocal: string): BillCheck {
  const byId = new Map(loads.map((l) => [l.id, l]));
  const already = invoicedLoadIds(bills, draft.direction);
  const errors: string[] = [];
  if (!draft.number.trim()) errors.push('NUMBER');
  if (!draft.issueDate) errors.push('ISSUE_DATE');
  if (!/^\d{4}-W\d{2}$/.test(draft.weekKey)) errors.push('WEEK');
  if (draft.net == null || draft.vat == null || draft.gross == null) errors.push('AMOUNTS');
  if (!draft.pdfName) errors.push('PDF');
  if (draft.lines.length === 0) errors.push('NO_LINES');
  const lines: BillLine[] = draft.lines.map((d) => {
    const l = byId.get(d.loadId);
    const flags: BillFlag[] = [];
    if (already.has(d.loadId)) errors.push(`DOUBLE:${l?.code ?? d.loadId}`);
    const at = l ? unloadedAtOf(l) : null;
    if (!at) flags.push('NIEZREALIZOWANY');
    else if (isoWeekKeyLocal(at) !== draft.weekKey) flags.push('ZLY_TYDZIEN');
    const rule = l ? ruleFxFor(l, draft.direction, todayLocal) : null;
    if (draft.currency === 'PLN' && !d.fx) flags.push('BRAK_KURSU');
    if (d.fx && rule) {
      if (d.fx.tableNo !== rule.tableNo) flags.push('TABELA_NBP');
      if (Math.abs(d.fx.mid - rule.mid) > 0.00005) flags.push('KURS_NBP');
      if (d.fx.effectiveDate !== rule.effectiveDate) flags.push('DATA_KURSU');
    }
    const expectedNet = l ? expectedNetFor(l, draft.direction, draft.currency, todayLocal) : null;
    if (expectedNet != null && outOfTolerance(round2(d.invoicedNet - expectedNet), expectedNet)) flags.push('KWOTA');
    if (l && d.invoicedFuel != null) {
      const fe = fuelEurFor(l, draft.direction);
      const expFuel = draft.currency === 'EUR' ? round2(fe) : rule ? round2(fe * rule.mid) : null;
      if (expFuel != null && outOfTolerance(round2(d.invoicedFuel - expFuel), Math.abs(expFuel))) flags.push('OPLATA_PALIWOWA');
    }
    return { loadId: d.loadId, invoicedNet: round2(d.invoicedNet), invoicedFuel: d.invoicedFuel ?? null, fx: d.fx ?? null, expectedNet, flags };
  });
  const onBill = new Set(draft.lines.map((l) => l.loadId));
  const missingLoadIds = billCandidates(loads, bills, draft.direction, draft.weekKey).filter((l) => !onBill.has(l.id)).map((l) => l.id);
  return {
    lines,
    headerFlags: missingLoadIds.length ? ['BRAK_NA_FAKTURZE'] : [],
    missingLoadIds,
    errors,
    expectedTotal: round2(lines.reduce((s, l) => s + (l.expectedNet ?? 0), 0)),
    invoicedTotal: round2(lines.reduce((s, l) => s + l.invoicedNet, 0)),
  };
}

/** Termin: z dokumentu > relacja (30 KSH / 35 HHL wobec SCX), od wystawienia (Q3/Q4). */
export function billDueDate(direction: BillDirection, issueDate: string, fromDocument?: string | null, termDays?: number): string {
  return fromDocument || addDaysIso(issueDate, termDays ?? BILL_TERM_DAYS[direction]);
}

/** Stan płatności dziś (lustro `refresh_payment_status`, w obie strony). */
export function billPaymentToday(b: Pick<Bill, 'dueDate' | 'paidAt' | 'payment'>, todayLocal: string): BillPayment {
  if (b.payment === 'OPLACONA' || b.paidAt) return 'OPLACONA';
  return todayLocal > b.dueDate ? 'PO_TERMINIE' : 'NIEOPLACONA';
}

/** Przejścia weryfikacji: DO_WERYFIKACJI → ZGODNA / SPORNA → ZAAKCEPTOWANA; SPORNA wymaga uzasadnienia (Q7). */
export function verifyError(next: BillVerification, note?: string | null): string | null {
  if (next === 'SPORNA' && !(note ?? '').trim()) return 'Status SPORNA wymaga uzasadnienia';
  return null;
}

/** Kwota z faktury sprowadzona do EUR (Z1: obok wyliczenia; kurs z pozycji). */
export function lineInvoicedEur(line: BillLine, currency: 'EUR' | 'PLN'): number | null {
  if (currency === 'EUR') return round2(line.invoicedNet);
  return line.fx?.mid ? round2(line.invoicedNet / line.fx.mid) : null;
}

export const BILL_FLAG_LABEL: Record<BillFlag | 'BRAK_NA_FAKTURZE', Record<'pl' | 'en' | 'sv', string>> = {
  ZLY_TYDZIEN: { pl: 'zły tydzień', en: 'wrong week', sv: 'fel vecka' },
  NIEZREALIZOWANY: { pl: 'niezrealizowany', en: 'not delivered', sv: 'ej levererad' },
  BRAK_NA_FAKTURZE: { pl: 'pominięty z tygodnia', en: 'missing from week', sv: 'saknas från veckan' },
  KWOTA: { pl: 'kwota', en: 'amount', sv: 'belopp' },
  OPLATA_PALIWOWA: { pl: 'opłata paliwowa', en: 'fuel surcharge', sv: 'bränsletillägg' },
  TABELA_NBP: { pl: 'tabela NBP', en: 'NBP table', sv: 'NBP-tabell' },
  KURS_NBP: { pl: 'kurs', en: 'rate', sv: 'kurs' },
  DATA_KURSU: { pl: 'data kursu', en: 'rate date', sv: 'kursdatum' },
  BRAK_KURSU: { pl: 'brak kursu', en: 'no rate', sv: 'kurs saknas' },
};

export const VERIFICATION_LABEL: Record<BillVerification, Record<'pl' | 'en' | 'sv', string>> = {
  DO_WERYFIKACJI: { pl: 'do weryfikacji', en: 'to verify', sv: 'att granska' },
  ZGODNA: { pl: 'zgodna', en: 'matched', sv: 'stämmer' },
  SPORNA: { pl: 'sporna', en: 'disputed', sv: 'bestridd' },
  ZAAKCEPTOWANA: { pl: 'zaakceptowana', en: 'accepted', sv: 'godkänd' },
};
export const PAYMENT_LABEL: Record<BillPayment, Record<'pl' | 'en' | 'sv', string>> = {
  NIEOPLACONA: { pl: 'nieopłacona', en: 'unpaid', sv: 'obetald' },
  PO_TERMINIE: { pl: 'po terminie', en: 'overdue', sv: 'förfallen' },
  OPLACONA: { pl: 'opłacona', en: 'paid', sv: 'betald' },
};
export const verificationPill = (v: BillVerification): string =>
  v === 'SPORNA' ? 'p-red' : v === 'ZAAKCEPTOWANA' || v === 'ZGODNA' ? 'p-go' : 'p-amber';
export const paymentPill = (p: BillPayment): string => (p === 'PO_TERMINIE' ? 'p-red' : p === 'OPLACONA' ? 'p-go' : 'p-amber');

/**
 * Dane startowe (DemoProvider): po dwie faktury w każdym kierunku z transportów zrealizowanych.
 * Kwoty = wyliczenie (zgodne) poza jedną pozycją sporną; waluty EUR i PLN (kurs per pozycja z reguły).
 */
export function buildSeedBills(loads: Load[], todayLocal: string): Bill[] {
  const delivered = loads
    .map((l) => ({ l, at: unloadedAtOf(l) }))
    .filter((x): x is { l: Load; at: string } => Boolean(x.at))
    .sort((a, b) => (a.at < b.at ? -1 : 1));
  const byWeek = new Map<string, Load[]>();
  for (const { l, at } of delivered) {
    const wk = isoWeekKeyLocal(at);
    byWeek.set(wk, [...(byWeek.get(wk) ?? []), l]);
  }
  const weeks = [...byWeek.keys()].sort().slice(-2);
  const out: Bill[] = [];
  const mk = (direction: BillDirection, wk: string, currency: 'EUR' | 'PLN', seq: number, issueAgoDays: number, opts: Partial<Bill>, bump?: number): Bill | null => {
    const ls = byWeek.get(wk) ?? [];
    if (!ls.length) return null;
    const lines: BillLine[] = ls.map((l, i) => {
      const side = direction === 'KOSZT' ? l.pricing.money?.cost : l.pricing.money?.rev;
      /* dane demo: rozładunki po „dziś” → kurs z migawki (prowizoryczny), żeby pozycja PLN miała kurs */
      const fx = currency === 'PLN'
        ? ruleFxFor(l, direction, todayLocal) ?? (side?.fx ? { tableNo: side.fx.tableNo, mid: side.fx.mid, effectiveDate: side.fx.date } : null)
        : null;
      const eur = computedEurFor(l, direction);
      const exp = currency === 'EUR' ? round2(eur) : fx ? round2(eur * fx.mid) : 0;
      const net = round2(exp + (i === 0 && bump ? bump : 0));
      return { loadId: l.id, invoicedNet: net, invoicedFuel: null, fx, expectedNet: exp, flags: outOfTolerance(net - exp, exp) ? ['KWOTA'] : [] };
    });
    const net = round2(lines.reduce((s, l) => s + l.invoicedNet, 0));
    const vat = 0; // odwrotne obciążenie — przepisane z dokumentu, system nie liczy VAT
    const { issuer, recipient } = billParties(direction);
    const issueDate = addDaysIso(todayLocal, -issueAgoDays);
    return {
      id: `bill-${direction === 'KOSZT' ? 'k' : 'p'}-${wk}`,
      direction, issuer, recipient,
      number: direction === 'KOSZT' ? `SCX/FV/${wk.slice(0, 4)}/${wk.slice(6)}/${seq}` : `HHL/FV/2026/${String(900 + seq).padStart(4, '0')}`,
      issueDate, weekKey: wk, currency, net, vat, gross: round2(net + vat),
      dueDate: billDueDate(direction, issueDate), dueFromDocument: false,
      verification: 'DO_WERYFIKACJI', payment: 'NIEOPLACONA', paidAt: null,
      pdfDocId: null, pdfName: `${direction === 'KOSZT' ? 'SCX' : 'HHL'}_faktura_${wk}.pdf`,
      lines, headerFlags: [], missingLoadIds: [], createdAt: `${issueDate}T09:00:00+02:00`, ...opts,
    };
  };
  const [w1, w2] = weeks.length === 2 ? weeks : [weeks[0], weeks[0]];
  const k1 = mk('KOSZT', w1, 'EUR', 1, 40, { verification: 'ZAAKCEPTOWANA' });
  if (k1) out.push({ ...k1, payment: 'OPLACONA', paidAt: addDaysIso(k1.issueDate, 30) });
  const k2 = w2 !== w1 ? mk('KOSZT', w2, 'PLN', 2, 5, {}, 180) : null;
  if (k2) out.push(k2);
  const p1 = mk('PRZYCHOD', w1, 'EUR', 1, 35, { verification: 'ZGODNA' });
  if (p1) out.push(p1);
  const p2 = w2 !== w1 ? mk('PRZYCHOD', w2, 'PLN', 2, 2, {}) : null;
  if (p2) out.push(p2);
  return out.map((b) => ({ ...b, payment: billPaymentToday(b, todayLocal) }));
}

/** Poniedziałek tygodnia ISO (RRRR-Www) jako data lokalna. */
export function isoWeekMonday(weekKey: string): string {
  const m = weekKey.match(/^(\d{4})-W(\d{2})$/);
  if (!m) throw new Error('Tydzień w formacie RRRR-Www');
  const y = Number(m[1]); const w = Number(m[2]);
  const jan4 = new Date(Date.UTC(y, 0, 4));
  const mon = new Date(jan4);
  mon.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7) + (w - 1) * 7);
  return mon.toISOString().slice(0, 10);
}
