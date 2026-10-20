/**
 * M6 — faktury, model trzech stron (MECHANIZM_PIENIEDZY §6; baza: 0003 + 0014 `register_invoice`).
 *   KOSZT    — wystawca SCX, odbiorca HHL; widzą HHL i SCX, KSH nigdy.
 *   PRZYCHOD — wystawca HHL, odbiorca KSH; widzą HHL i KSH, SCX nigdy.
 * Netto z dokumentu; VAT 23% i brutto liczy baza (A4). Kurs per pozycja (PLN)
 * podpowiadany z reguły W3, wystawca potwierdza albo poprawia. Kontrole = te same co w bazie.
 * Dwa niezależne statusy: weryfikacja (odbiorca) i płatność (wyłącznie HHL).
 */
import type { Bill, BillDirection, BillFlag, BillLine, BillLineFx, BillPayment, BillVerification, Document, Load, OrgKind, RoleId } from '../types';
import { isoWeekKeyLocal, localDateOf } from './money/engine';

export function addDaysIso(dateIso: string, days: number): string {
  const d = new Date(`${dateIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
import { applyInvoiceToSide, fxForDate, leastTier, unloadedAtOf } from './money/loadMoney';
import { dictEntry } from '../i18n/messages';
import { serverRuleOn } from './serverRules';
import { currentCmr } from './statusSettlement';
import { STATUS_TO_STAGE } from './status';

export const BILL_TERM_DAYS: Record<BillDirection, number> = { PRZYCHOD: 30, KOSZT: 35 };
/** Tolerancja kwoty do czasu A4 — jak `register_invoice` (0015): > 1 i > 0,2 %. */
export const BILL_TOLERANCE = { abs: 1, pct: 0.002 };
/**
 * wyglad/W-naprawy · A4 (audyt 17.10; decyzja 07.10, 12:35: faktura zgadza się co do grosza): każda różnica ≥ 0,01
 * w walucie faktury → flaga KWOTA, bez „zgodna”; „pominięty z tygodnia” tylko wśród transportów z CMR.
 * W demo od razu; na produkcji po A4 w `register_invoice` — wykonawca przestawia `INVOICE_A4` w `serverRules.ts`
 * (flagi pozycji idą do bazy w `billToRpc`, więc widok i baza zmieniają regułę razem).
 */
export const BILL_TOLERANCE_A4 = 0.01;
export const invoiceA4On = (): boolean => serverRuleOn('INVOICE_A4');

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

/** Decyzja właściciela 16.10, 13:58 · 1: ceny netto, VAT 23 % dolicza system (nikt nie wpisuje VAT ani brutto). */
export const BILL_VAT_RATE = 0.23;
/** VAT = round(netto × 0,23, 2), brutto = netto + VAT (audyt-C C-08, C-09). */
export function vatGrossOf(net: number): { vat: number; gross: number } {
  const vat = round2(net * BILL_VAT_RATE);
  return { vat, gross: round2(net + vat) };
}
const outOfTolerance = (diff: number, base: number) => (invoiceA4On()
  ? Math.abs(round2(diff)) >= BILL_TOLERANCE_A4
  : Math.abs(diff) > BILL_TOLERANCE.abs && (base === 0 || Math.abs(diff) / base > BILL_TOLERANCE.pct));

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
  /** Rozmiar PDF w bajtach (limit 10 MB jak wszystkie PDF — aneks 4). */
  pdfSize?: number | null;
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

/**
 * wyglad/W-naprawy · A4 (audyt 17.10, D-20261017-0730-01): faktura tylko z CMR. Transport wchodzi na fakturę, gdy ma status
 * „Gotowe do fakturowania” / „Zafakturowano” (automat C17 po wgraniu CMR) albo — zanim automat zmieni status — warunek
 * automatu C17 (`c17_cmr_after_delivery`): aktualny CMR (niezastąpiony), wgrany, nie wcześniej niż rozładunek.
 * Pozostałe z tygodnia kreator pokazuje szare, z opisem „czeka na CMR”. Bazę (`register_invoice`) robi wykonawca.
 */
export function billReady(l: Load, documents: readonly Document[] = []): boolean {
  if (l.status === 'READY_TO_INVOICE' || l.status === 'INVOICED') return true;
  const cmr = currentCmr(l.id, documents);
  const at = unloadedAtOf(l);
  if (!cmr || cmr.status !== 'UPLOADED' || !cmr.uploadedAt || !at) return false;
  return Date.parse(cmr.uploadedAt) >= Date.parse(at);
}

/** F7 (A4): „zgodna” tylko gdy suma się zgadza i żadna pozycja nie ma flagi KWOTA (różnice ±0,01 się nie znoszą), a faktura ma pozycje. */
export function billSumOk(chk: Pick<BillCheck, 'lines' | 'invoicedTotal' | 'expectedTotal'>): boolean {
  const diff = round2(chk.invoicedTotal - chk.expectedTotal);
  return diff === 0 && chk.lines.length > 0 && chk.lines.every((l) => !l.flags.includes('KWOTA'));
}

/** F7: kwota wpisana tak, jak aplikacja ją pokazuje („6 271,90”, także twarda spacja) albo „6271.9”; pusta / błędna → null. */
export function parseAmount(v: string): number | null {
  const t = v.replace(/[\s\u00a0\u202f]/g, '').replace(',', '.');
  return t === '' || Number.isNaN(Number(t)) ? null : Number(t);
}

/** PDF faktury ≤ 10 MB — ten sam limit co zasobnik `faktury` i `create_document` (0029/0039). */
export const INVOICE_PDF_MAX_BYTES = 10 * 1024 * 1024;

export interface BillCheck {
  lines: BillLine[];
  headerFlags: string[];
  missingLoadIds: string[];
  /** Błędy blokujące rejestrację (jak w bazie) — kody: NUMBER, ISSUE_DATE, WEEK, AMOUNTS, PDF, PDF_SIZE, NO_LINES, DOUBLE:<kod>, ROLE. */
  errors: string[];
  expectedTotal: number;
  invoicedTotal: number;
}

/** Kontrole przy rejestracji — lustro `register_invoice` (§6.3). */
export function checkBill(draft: BillDraft, loads: Load[], bills: Bill[], todayLocal: string, documents: readonly Document[] = []): BillCheck {
  const byId = new Map(loads.map((l) => [l.id, l]));
  const already = invoicedLoadIds(bills, draft.direction);
  const errors: string[] = [];
  if (!draft.number.trim()) errors.push('NUMBER');
  if (!draft.issueDate) errors.push('ISSUE_DATE');
  if (!/^\d{4}-W\d{2}$/.test(draft.weekKey)) errors.push('WEEK');
  if (draft.net == null || draft.vat == null || draft.gross == null) errors.push('AMOUNTS');
  if (!draft.pdfName) errors.push('PDF');
  else if (draft.pdfSize != null && draft.pdfSize > INVOICE_PDF_MAX_BYTES) errors.push('PDF_SIZE');
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
  /* A4: „pominięty z tygodnia” tylko wśród transportów z CMR — czekający na CMR nie mogą być na fakturze (po A4 w bazie) */
  const missingLoadIds = billCandidates(loads, bills, draft.direction, draft.weekKey)
    .filter((l) => !onBill.has(l.id) && (!invoiceA4On() || billReady(l, documents))).map((l) => l.id);
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
  if (next === 'SPORNA' && !(note ?? '').trim()) return 'Status „Sporna” wymaga uzasadnienia';
  return null;
}

/** Kwota z faktury sprowadzona do EUR (Z1: obok wyliczenia; kurs z pozycji). */
export function lineInvoicedEur(line: BillLine, currency: 'EUR' | 'PLN'): number | null {
  if (currency === 'EUR') return round2(line.invoicedNet);
  return line.fx?.mid ? round2(line.invoicedNet / line.fx.mid) : null;
}

export const BILL_FLAG_LABEL: Record<BillFlag | 'BRAK_NA_FAKTURZE', Record<'pl' | 'en' | 'sv', string>> = {
  ZLY_TYDZIEN: dictEntry('a6_bill_flag_label_zly_tydzien'),
  NIEZREALIZOWANY: dictEntry('a6_bill_flag_label_niezrealizowany'),
  BRAK_NA_FAKTURZE: dictEntry('a6_bill_flag_label_brak_na_fakturze'),
  KWOTA: dictEntry('a6_bill_flag_label_kwota'),
  OPLATA_PALIWOWA: dictEntry('a6_bill_flag_label_oplata_paliwowa'),
  TABELA_NBP: dictEntry('a6_bill_flag_label_tabela_nbp'),
  KURS_NBP: dictEntry('a6_bill_flag_label_kurs_nbp'),
  DATA_KURSU: dictEntry('a6_bill_flag_label_data_kursu'),
  BRAK_KURSU: dictEntry('a6_bill_flag_label_brak_kursu'),
};

export const VERIFICATION_LABEL: Record<BillVerification, Record<'pl' | 'en' | 'sv', string>> = {
  DO_WERYFIKACJI: dictEntry('a6_verification_label_do_weryfikacji'),
  ZGODNA: dictEntry('a6_verification_label_zgodna'),
  SPORNA: dictEntry('a6_verification_label_sporna'),
  ZAAKCEPTOWANA: dictEntry('a6_verification_label_zaakceptowana'),
};
export const PAYMENT_LABEL: Record<BillPayment, Record<'pl' | 'en' | 'sv', string>> = {
  NIEOPLACONA: dictEntry('a6_payment_label_nieoplacona'),
  PO_TERMINIE: dictEntry('a6_payment_label_po_terminie'),
  OPLACONA: dictEntry('a6_payment_label_oplacona'),
};
export const verificationPill = (v: BillVerification): string =>
  v === 'SPORNA' ? 'p-red' : v === 'ZAAKCEPTOWANA' || v === 'ZGODNA' ? 'p-go' : 'p-amber';
export const paymentPill = (p: BillPayment): string => (p === 'PO_TERMINIE' ? 'p-red' : p === 'OPLACONA' ? 'p-go' : 'p-amber');

/**
 * Dane startowe (DemoProvider): po dwie faktury w każdym kierunku z transportów zrealizowanych.
 * Kwoty = wyliczenie (zgodne) poza jedną pozycją sporną; waluty EUR i PLN (kurs per pozycja z reguły).
 * audyt-C C-11 (E4, E40): faktura za tydzień rozładunku, wystawiona po końcu tego tygodnia (nigdy przed rozładunkiem);
 * tygodnie: dwa ostatnie zamknięte przed „dziś”, a gdy dane demo mają rozładunki po „dziś” — dwa pierwsze tygodnie
 * rozładunków. VAT 23 % z netto (C-08).
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
  const all = [...byWeek.keys()].sort();
  const closed = all.filter((wk) => addDaysIso(isoWeekMonday(wk), 6) < todayLocal);
  const weeks = closed.length >= 2 ? closed.slice(-2) : all.slice(0, 2);
  const out: Bill[] = [];
  const mk = (direction: BillDirection, wk: string, currency: 'EUR' | 'PLN', seq: number, issueAfterDays: number, opts: Partial<Bill>, bump?: number): Bill | null => {
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
    /* audyt-C C-08: VAT 23 % liczy system z netto (decyzja 16.10, 13:58 · 1) */
    const { vat } = vatGrossOf(net);
    const { issuer, recipient } = billParties(direction);
    /* wystawiona `issueAfterDays` dni po niedzieli tygodnia rozładunku */
    const issueDate = addDaysIso(isoWeekMonday(wk), 6 + issueAfterDays);
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
  const k1 = mk('KOSZT', w1, 'EUR', 1, 1, { verification: 'ZAAKCEPTOWANA' });
  if (k1) out.push({ ...k1, payment: 'OPLACONA', paidAt: addDaysIso(k1.issueDate, 14) });
  const k2 = w2 !== w1 ? mk('KOSZT', w2, 'PLN', 2, 1, {}, 180) : null;
  if (k2) out.push(k2);
  const p1 = mk('PRZYCHOD', w1, 'EUR', 1, 2, { verification: 'ZGODNA' });
  if (p1) out.push(p1);
  const p2 = w2 !== w1 ? mk('PRZYCHOD', w2, 'PLN', 2, 3, {}) : null;
  if (p2) out.push(p2);
  return out.map((b) => ({ ...b, payment: billPaymentToday(b, todayLocal) }));
}

/**
 * P11 pkt 7 partia 5 (paczka D: Faktury miały faktury za t37–t38, a Finanse i Rozliczenia — „Zafakturowane 0”):
 * w demo etap „Zafakturowane” strony bierze się z faktur na stronie Faktury — faktura HHL → KSH zamyka przychód,
 * faktura SCX → HHL zamyka koszt (kwota z pozycji faktury w EUR; faktura w PLN — przez kurs pozycji). Wyliczenie zostaje
 * bez zmian (Z1). Na produkcji etap daje baza (E25, C17).
 */
export function withBilledMoney(loads: Load[], bills: Bill[]): Load[] {
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const billed = new Map<string, { cost?: number; rev?: number }>();
  for (const b of bills) {
    for (const ln of b.lines) {
      const eur = b.currency === 'EUR' ? ln.invoicedNet : ln.fx?.mid ? r2(ln.invoicedNet / ln.fx.mid) : null;
      if (eur == null) continue;
      const cur = billed.get(ln.loadId) ?? {};
      billed.set(ln.loadId, b.direction === 'KOSZT' ? { ...cur, cost: eur } : { ...cur, rev: eur });
    }
  }
  return loads.map((l) => {
    const hit = billed.get(l.id);
    const m = l.pricing?.money;
    if (!hit || !m) return l;
    const cost = hit.cost != null ? applyInvoiceToSide(m.cost, hit.cost) : m.cost;
    const rev = hit.rev != null ? applyInvoiceToSide(m.rev, hit.rev) : m.rev;
    /* przegląd 18.10 (P13): transport na obu fakturach (SCX → HHL i HHL → KSH) ma status „Zafakturowano” —
       pasek etapów „Rozliczenie” i Harmonogram zgodne z Finansami („Zafakturowane · obie faktury”) */
    const both = hit.cost != null && hit.rev != null && (l.status === 'DELIVERED' || l.status === 'READY_TO_INVOICE');
    return {
      ...l,
      ...(both ? { status: 'INVOICED' as const, stage: STATUS_TO_STAGE.INVOICED } : {}),
      pricing: { ...l.pricing, money: { ...m, tier: leastTier(cost.tier, rev.tier), cost, rev } },
    };
  });
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

/* ---------- M7 — przypomnienia o płatności (lustro send_payment_reminders) ---------- */
export const REMINDER_CADENCE = [-3, 0, 1, 7, 14] as const;
export type ReminderState = 'WYSLANE' | 'ZAPLANOWANE' | 'WSTRZYMANE';
export interface ReminderStep { date: string; offset: number; state: ReminderState }

/** Płatnik = odbiorca faktury, wierzyciel = wystawca; nigdy trzecia strona. */
export function reminderRecipients(b: Pick<Bill, 'issuer' | 'recipient'>): { payer: OrgKind; payee: OrgKind } {
  return { payer: b.recipient, payee: b.issuer };
}

/** Plan przypomnień faktury na dziś: wysłane (dzień minął), zaplanowane, wstrzymane (opłacona → cisza). */
export function reminderPlan(b: Pick<Bill, 'dueDate' | 'paidAt' | 'payment'>, todayLocal: string, cadence: readonly number[] = REMINDER_CADENCE): ReminderStep[] {
  const paid = b.payment === 'OPLACONA' || Boolean(b.paidAt);
  return cadence.map((offset) => {
    const date = addDaysIso(b.dueDate, offset);
    const sentBeforePaid = date <= todayLocal && (!b.paidAt || date < b.paidAt);
    const state: ReminderState = sentBeforePaid ? 'WYSLANE' : paid ? 'WSTRZYMANE' : 'ZAPLANOWANE';
    return { date, offset, state };
  });
}

/** Kto dostaje przypomnienie o tej fakturze (rola widoku) — KSH nigdy o kosztowej, SCX nigdy o przychodowej. */
export const receivesReminders = (role: RoleId, b: Pick<Bill, 'issuer' | 'recipient'>): boolean =>
  role === b.issuer || role === b.recipient;
