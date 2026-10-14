/**
 * wyglad/P5 — przykłady tylko dla trybu demo (strażnik I-0): próg marży i średnie cen paliwa z publikacjami.
 * Wołane wyłącznie przez `src/lib/p5Source.ts` za warunkiem `import.meta.env.VITE_AUTH_MODE !== 'supabase'`.
 * W produkcji te dane podaje baza (E16 próg w Opcjach, E39 `fuel_basis`, E4b faktoring, E40 adresy i dziennik wysyłek)
 * — podłącza wykonawca. Adresy e-mail zmyślone (example.com, G-09).
 */
import { SEFS_PLN, SEFS_SEK, type SefsTier } from './sefs';
import { addDays, type FuelPubl, type FuelWeekRow } from './p5Finance';
import type { Bill } from '../types';
import { factoringPayout } from './p5Invoices';
import type { FactoringOfferView, FactoringTask, PackActions } from './p5Source';
import type { PackConfig, PackSent } from './p5Pack';
import { addDaysIso } from './invoices3';

/** Próg marży z Opcji (E16, 08.10: 4 %). */
export const demoMarginThreshold = (): number => 4;

/** Średnia z przedziału tabeli mnożników, która daje ten mnożnik (przykład spójny z tabelą). */
function avgFor(mult: number, tiers: SefsTier[]): number | null {
  const i = tiers.findIndex((t) => t.mult === mult);
  if (i < 0) return null;
  const hi = tiers[i].lte;
  const lo = i > 0 ? tiers[i - 1].lte : hi - 0.4;
  return Math.round((lo + (hi - lo) * 0.62) * 100) / 100;
}

function publications(idxFrom: string, okq8: number, orlen: number, until: string): FuelPubl[] {
  const out: FuelPubl[] = [];
  /* OKQ8: pon, śr, czw, pt; Orlen: pon–pt (jak w bazie: 4 i 5 publikacji w pełnym tygodniu) */
  for (const d of [0, 2, 3, 4]) { const day = addDays(idxFrom, d); if (day <= until) out.push({ date: day, source: 'OKQ8', price: Math.round((okq8 + (d - 2) * 0.03) * 100) / 100 }); }
  for (const d of [0, 1, 2, 3, 4]) { const day = addDays(idxFrom, d); if (day <= until) out.push({ date: day, source: 'ORLEN', price: Math.round((orlen + (d - 2) * 0.02) * 100) / 100 }); }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.source.localeCompare(b.source));
}

/** E39: średnie OKQ8 i Orlen z liczbą publikacji dla zamkniętych tygodni wskaźników; lista publikacji (też w toku). */
export function demoFuelEnrich(rows: FuelWeekRow[], today: string): FuelWeekRow[] {
  return rows.map((r) => {
    if (!r.idx) return r;
    const sek = avgFor(r.okq8?.mult ?? r.applied ?? 1, SEFS_SEK) ?? 22.63;
    const pln = avgFor(r.orlen?.mult ?? r.applied ?? 1, SEFS_PLN) ?? 7.22;
    const pub = r.weekLast ? null : publications(r.idx.from, sek, pln, today < r.idx.to ? today : r.idx.to);
    if (r.state !== 'OSTATECZNA') return { ...r, publications: pub };
    return {
      ...r,
      okq8: r.okq8 ? { ...r.okq8, avg: sek, n: 4 } : r.okq8,
      orlen: r.orlen ? { ...r.orlen, avg: pln, n: 5 } : r.orlen,
      publications: pub,
    };
  });
}

/** E4b — oferta HHL (07.10: 1 % od netto, wypłata 48 h po akceptacji przez HHL). */
export const demoFactoringOffer = (): FactoringOfferView => ({ feePct: 1, hours: 48, version: 1, from: '2026-10-07' });

/** E4b — zadanie „Wypłata faktoringu” dla pierwszej przyjętej, nieopłaconej faktury przewoźnika. */
export function demoFactoringTasks(bills: Bill[], nowIso: string): FactoringTask[] {
  const b = bills.find((x) => x.direction === 'KOSZT' && x.verification === 'ZAAKCEPTOWANA' && x.payment !== 'OPLACONA');
  if (!b) return [];
  const accepted = new Date(Date.parse(nowIso) - 60 * 60 * 1000).toISOString();
  const due = new Date(Date.parse(accepted) + 48 * 3600 * 1000).toISOString();
  const { fee, payout } = factoringPayout(b.net, b.gross, 1);
  return [{ billId: b.id, number: b.number, issuer: 'Scandinavian Express', currency: b.currency, net: b.net, gross: b.gross, fee, payout, issuedAt: b.issueDate, acceptedAt: accepted, dueAt: due, paidAt: null, feePct: 1, hours: 48 }];
}

/** E40 — adresy księgowości (Opcje › Adresy księgowości) i dziennik wysyłek: wysłana paczka HHL dla przyjętej faktury SCX. */
export function demoAccountingPack(bills: Bill[]): PackConfig {
  const sent: PackConfig['sent'] = {};
  for (const b of bills) {
    if (b.direction === 'KOSZT' && (b.verification === 'ZAAKCEPTOWANA' || b.payment === 'OPLACONA')) {
      sent[`${b.weekKey}:HHL`] = { at: `${addDaysIso(b.issueDate, 2)}T09:14:00+02:00`, to: 1, status: 'DORECZONO', by: 'Konto pokazowe' };
    }
  }
  return {
    addresses: { KSH: ['ksiegowosc.ksh@example.com', 'faktury.ksh@example.com'], HHL: ['ksiegowosc.hhl@example.com'] },
    sent,
  };
}

/** E40 — w demo „Wyślij” zapisuje tylko stan na ekranie, ZIP pakuje wgrane CMR (bez wysyłki i bez zapisu w bazie). */
export function demoPackActions(): PackActions {
  return {
    send: async (_key, _weekKey, to, nowIso): Promise<PackSent> => ({ at: nowIso, to: to.length, status: 'DORECZONO', by: 'Konto pokazowe' }),
    zip: async (docs, filename, codeOf) => {
      const { downloadDocumentsZip } = await import('./zipDocs');
      await downloadDocumentsZip(docs, filename, codeOf);
    },
  };
}
