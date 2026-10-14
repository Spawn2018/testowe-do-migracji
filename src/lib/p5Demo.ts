/**
 * wyglad/P5 — przykłady tylko dla trybu demo (strażnik I-0): próg marży i średnie cen paliwa z publikacjami.
 * Wołane wyłącznie przez `src/lib/p5Source.ts` za warunkiem `import.meta.env.VITE_AUTH_MODE !== 'supabase'`.
 * W produkcji te dane podaje baza (E16 próg w Opcjach, E39 `fuel_basis`) — podłącza wykonawca.
 */
import { SEFS_PLN, SEFS_SEK, type SefsTier } from './sefs';
import { addDays, type FuelPubl, type FuelWeekRow } from './p5Finance';

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
