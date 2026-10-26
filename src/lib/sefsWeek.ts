/**
 * B-6h — stan poprzedniego tygodnia dla opłaty paliwowej, tak jak liczy baza (sefs_week_calc, 0155):
 * odczyty dzienne (okres = data RRRR-MM-DD) z poprzedniego tygodnia pon–niedz względem dnia odniesienia,
 * średnia SEK i osobno PLN, mnożniki z tabel, stosowany niższy. Czas Europe/Warsaw.
 * Tylko podgląd w Opcjach — wartość przy transporcie liczy i zapisuje baza.
 * #563/F7: cena dnia = odczyt efektywny (korekta wygrywa); dni bez odczytu = ostatnia znana (jak baza);
 * jeden odczyt na dzień (nie 2× przy dwóch wpisach); `tier_bound` jak w wersji załącznika.
 */
import { lookupMult, round2, type SefsTier, type SefsTierBound } from './sefs';

export interface WeekReading {
  id?: number;
  index_code: string;
  period: string;
  value: number;
  corrects_id: number | null;
}

export interface PrevWeekStatus {
  from: string; to: string; nSek: number; nPln: number;
  avgSek: number | null; avgPln: number | null; mult: number | null;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Dzień w Warszawie jako RRRR-MM-DD. */
export function warsawDay(now: Date): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Warsaw', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

function addDays(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Odczyty aktualne: bez oryginałów, które mają korektę (#563 — jak `currentReadings` / baza). */
export function effectiveReadings(readings: readonly WeekReading[]): WeekReading[] {
  const corrected = new Set(readings.map((r) => r.corrects_id).filter((x): x is number => x !== null));
  return readings.filter((r) => r.id == null || !corrected.has(r.id));
}

/** Średnia 7 cen dziennych z przeniesieniem ostatniej znanej (jak sefs_*_daily_avg). */
function dailyAvg(
  live: readonly WeekReading[],
  code: string,
  from: string,
  to: string,
): { avg: number | null; n: number } {
  const rows = live
    .filter((r) => r.index_code === code && DAY.test(r.period))
    .slice()
    .sort((a, b) => a.period.localeCompare(b.period) || (a.id ?? 0) - (b.id ?? 0));
  const byDay = new Map<string, number>();
  for (const r of rows) byDay.set(r.period, Number(r.value));

  let last: number | null = null;
  for (const r of rows) {
    if (r.period < from) last = Number(r.value);
  }

  let sum = 0;
  let n = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) {
    if (byDay.has(d)) last = byDay.get(d)!;
    if (last == null) return { avg: null, n };
    sum += last;
    n += 1;
  }
  return n ? { avg: sum / n, n } : { avg: null, n: 0 };
}

export function prevWeekStatus(
  readings: readonly WeekReading[],
  refDay: string,
  tiers?: { sek: SefsTier[]; pln: SefsTier[] } | null,
  bound: SefsTierBound = 'MAX',
): PrevWeekStatus {
  const dow = (new Date(`${refDay}T12:00:00Z`).getUTCDay() + 6) % 7; // pon = 0
  const weekStart = addDays(refDay, -dow);
  const from = addDays(weekStart, -7);
  const to = addDays(weekStart, -1);
  const live = effectiveReadings(readings);
  const sek = dailyAvg(live, 'SEK', from, to);
  const pln = dailyAvg(live, 'PLN', from, to);
  const avgSek = sek.avg;
  const avgPln = pln.avg;
  const mult = avgSek !== null && avgPln !== null && tiers
    ? Math.min(lookupMult(round2(avgSek), tiers.sek, bound), lookupMult(round2(avgPln), tiers.pln, bound))
    : null;
  return { from, to, nSek: sek.n, nPln: pln.n, avgSek, avgPln, mult };
}
