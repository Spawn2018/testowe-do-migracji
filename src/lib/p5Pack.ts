/**
 * wyglad/P5 — E40 „Paczka tygodnia dla księgowości” (img/e40-after, Finanse, tylko HHL): czyste funkcje widoku.
 * Dwie paczki na tydzień faktury: księgowość KSH (faktura HHL → KSH) i księgowość HHL (faktura SCX → HHL, 1A).
 * Wysyłka zablokowana, gdy brakuje faktury, PDF, akceptacji faktury SCX przez HHL (2A), CMR z podpisem przy
 * którymkolwiek transporcie (3A) albo adresu w Opcjach. Każdy plik osobno (4A); zestawienie HHL bez przychodu,
 * z numerami zleceń HHL i SCX (5B); zestawienie KSH: kod, rozładunek, netto.
 * Bez zapisu i bez nowych zapytań — adresy, dziennik wysyłek, wysyłkę i ZIP podłącza wykonawca (`p5Source`).
 */
import type { Bill, BillDirection, Document, Load } from '../types';
import { addDaysIso, isoWeekMonday } from './invoices3';
import { localDateOf } from './money/engine';
import { unloadedAtOf } from './money/loadMoney';
import { fmtWeek } from './time';

/** Paczka KSH = faktury przychodowe HHL → KSH; paczka HHL = faktury kosztowe SCX → HHL. */
export type PackKey = 'KSH' | 'HHL';
export const PACK_DIR: Record<PackKey, BillDirection> = { KSH: 'PRZYCHOD', HHL: 'KOSZT' };
export const PACKS: PackKey[] = ['KSH', 'HHL'];

export interface PackSent {
  at: string;
  /** Liczba adresów, na które poszła wysyłka. */
  to: number;
  /** ZLECONO = wpis w dzienniku bez e-maila; WYSLANO/DORECZONO/BLAD po Edge (F7 #512). */
  status: 'ZLECONO' | 'DORECZONO' | 'WYSLANO' | 'BLAD';
  by: string;
}

export interface PackConfig {
  addresses: Record<PackKey, string[]>;
  /** Klucz „2026-W41:KSH”. */
  sent: Partial<Record<string, PackSent>>;
}

export type PackBlockKind = 'NO_INVOICE' | 'NO_PDF' | 'NOT_ACCEPTED' | 'DISPUTED' | 'NO_CMR' | 'NO_ADDRESS';
export interface PackBlock { kind: PackBlockKind; number?: string; codes?: string[] }

export interface PackLoad {
  id: string;
  code: string;
  hhlOrderNo: string | null;
  carrierOrderNo: string | null;
  unloadDay: string | null;
  cmr: boolean;
}

export interface AccountingPack {
  key: PackKey;
  weekKey: string;
  bills: Bill[];
  loads: PackLoad[];
  /** Suma netto / VAT / brutto, gdy faktury tygodnia mają jedną walutę; inaczej null (pokazujemy każdą fakturę). */
  total: { net: number; vat: number; gross: number; currency: 'EUR' | 'PLN' } | null;
  files: string[];
  to: string[];
  blocks: PackBlock[];
  sent: PackSent | null;
}

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** „t41 · 05.10.2026–11.10.2026” z klucza „2026-W41”. */
export function packWeekLabel(weekKey: string): string {
  const m = /^(\d{4})-W(\d{2})$/.exec(weekKey);
  if (!m) return weekKey;
  const from = isoWeekMonday(weekKey);
  const to = addDaysIso(from, 6);
  return fmtWeek(Number(m[2]), from, to);
}

/** Tygodnie faktur (dowolnego kierunku), od najnowszego. */
export function packWeeks(bills: Pick<Bill, 'weekKey'>[]): string[] {
  return [...new Set(bills.map((b) => b.weekKey))].sort().reverse();
}

/** Nazwa pliku z numeru faktury albo kodu: „FV/41/2026” → „FV_41_2026”. */
export const fileSafe = (s: string) => s.trim().replace(/[^\p{L}\p{N}.-]+/gu, '_').replace(/^_+|_+$/g, '');

/**
 * CMR transportu = wgrany dokument CMR. Po E31 (decyzja 1B: tylko CMR z rozładunku, z podpisem odbiorcy) każdy CMR
 * jest podpisany; do tego czasu napisy mówią „CMR”, bez „z podpisem”.
 */
export function hasSignedCmr(loadId: string, docs: readonly Pick<Document, 'loadId' | 'category' | 'status'>[]): boolean {
  return docs.some((d) => d.loadId === loadId && d.category === 'CMR' && d.status === 'UPLOADED');
}

export function accountingPack(
  key: PackKey,
  weekKey: string,
  loads: readonly Load[],
  bills: readonly Bill[],
  docs: readonly Pick<Document, 'loadId' | 'category' | 'status'>[],
  cfg: PackConfig | null,
): AccountingPack {
  const dir = PACK_DIR[key];
  const list = bills.filter((b) => b.direction === dir && b.weekKey === weekKey).sort((a, b) => a.issueDate.localeCompare(b.issueDate));
  const byId = new Map(loads.map((l) => [l.id, l]));
  const seen = new Set<string>();
  const packLoads: PackLoad[] = [];
  for (const b of list) {
    for (const ln of b.lines) {
      if (seen.has(ln.loadId)) continue;
      seen.add(ln.loadId);
      const l = byId.get(ln.loadId);
      const at = l ? unloadedAtOf(l) : null;
      packLoads.push({
        id: ln.loadId,
        code: l?.code ?? ln.loadId,
        hhlOrderNo: l?.hhlOrderNo ?? null,
        carrierOrderNo: l?.carrierOrderNo ?? null,
        unloadDay: at ? localDateOf(at) : null,
        cmr: hasSignedCmr(ln.loadId, docs),
      });
    }
  }
  const cur = list.length && list.every((b) => b.currency === list[0].currency) ? list[0].currency : null;
  const total = cur
    ? { net: r2(list.reduce((s, b) => s + b.net, 0)), vat: r2(list.reduce((s, b) => s + b.vat, 0)), gross: r2(list.reduce((s, b) => s + b.gross, 0)), currency: cur }
    : null;
  const wk = `t${Number(weekKey.slice(-2))}`;
  const files = [
    ...list.map((b) => `${fileSafe(b.number)}.pdf`),
    ...packLoads.map((l) => `${fileSafe(l.code)}_CMR.pdf`),
    `Zestawienie_${wk}_${key}.pdf`,
  ];
  const blocks: PackBlock[] = [];
  if (!list.length) blocks.push({ kind: 'NO_INVOICE' });
  for (const b of list) if (!b.pdfName && !b.pdfStoragePath) blocks.push({ kind: 'NO_PDF', number: b.number });
  if (key === 'HHL') {
    for (const b of list) {
      if (b.verification === 'SPORNA') blocks.push({ kind: 'DISPUTED', number: b.number });
      /* 2A: tylko zaakceptowana (albo już opłacona); dawna „Zgodna” to jeszcze nie akceptacja */
      else if (b.verification !== 'ZAAKCEPTOWANA' && b.payment !== 'OPLACONA') blocks.push({ kind: 'NOT_ACCEPTED', number: b.number });
    }
  }
  const noCmr = packLoads.filter((l) => !l.cmr).map((l) => l.code);
  if (noCmr.length) blocks.push({ kind: 'NO_CMR', codes: noCmr });
  const to = cfg?.addresses[key] ?? [];
  if (!to.length) blocks.push({ kind: 'NO_ADDRESS' });
  return { key, weekKey, bills: list, loads: packLoads, total, files, to, blocks, sent: cfg?.sent[`${weekKey}:${key}`] ?? null };
}
