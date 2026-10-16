/**
 * wyglad/A5 — okno „Zmień status”, statusy rozliczenia (E25 pkt „Rozliczenie”, decyzje 07.10 17:46; dopisek D-20261015-0300-01 A5).
 * „Gotowe do fakturowania” wymaga pliku CMR z podpisem odbiorcy; „Zafakturowano” — transportu na obu fakturach
 * (SCX → HHL i HHL → KSH), a okno pokazuje, której brakuje. Te same warunki sprawdza baza w `load_status_set` (A5);
 * okno tylko je pokazuje i blokuje „Zapisz”, gdy brak widać już w danych tej firmy. Bez zapisu i bez nowych zapytań.
 */
import type { Bill, BillDirection, Document, LoadStatus, OrgKind } from '../types';

/** Faktury, które firma widzi (MECHANIZM_PIENIEDZY §6): HHL obie, SCX swoją (SCX → HHL), KSH fakturę HHL → KSH. */
export function billVisible(dir: BillDirection, role: OrgKind): boolean {
  if (role === 'HHL') return true;
  return role === 'SCX' ? dir === 'KOSZT' : dir === 'PRZYCHOD';
}

export const SETTLE_DIRS: BillDirection[] = ['KOSZT', 'PRZYCHOD'];

export interface SettleBillRow {
  dir: BillDirection;
  /** Faktura z tym transportem; `null` = brak (gdy firma ją widzi). */
  bill: Bill | null;
  /** Firma nie widzi tej faktury — sprawdzi baza przy zapisie. */
  hidden: boolean;
}

export type SettleGate =
  | { kind: 'cmr'; cmr: Document | null; blocked: boolean }
  | { kind: 'inv'; rows: SettleBillRow[]; missing: BillDirection[]; blocked: boolean };

/** Aktualny plik CMR transportu (bez zastąpionych wersji i pustych wymagań), najnowszy pierwszy. */
export function currentCmr(loadId: string, docs: readonly Document[]): Document | null {
  const list = docs.filter((d) => d.loadId === loadId && d.category === 'CMR' && !d.superseded && d.status !== 'MISSING');
  list.sort((a, b) => (b.uploadedAt ?? '').localeCompare(a.uploadedAt ?? ''));
  return list[0] ?? null;
}

/** Warunek dokumentu dla wybranego statusu; `null` — status bez warunku rozliczenia. */
export function settlementGate(
  status: LoadStatus,
  loadId: string,
  role: OrgKind,
  docs: readonly Document[],
  bills: readonly Bill[],
): SettleGate | null {
  if (status === 'READY_TO_INVOICE') {
    const cmr = currentCmr(loadId, docs);
    return { kind: 'cmr', cmr, blocked: !cmr };
  }
  if (status === 'INVOICED') {
    const rows = SETTLE_DIRS.map((dir): SettleBillRow => {
      if (!billVisible(dir, role)) return { dir, bill: null, hidden: true };
      const bill = bills.find((b) => b.direction === dir && b.lines.some((l) => l.loadId === loadId)) ?? null;
      return { dir, bill, hidden: false };
    });
    const missing = rows.filter((r) => !r.hidden && !r.bill).map((r) => r.dir);
    return { kind: 'inv', rows, missing, blocked: missing.length > 0 };
  }
  return null;
}
