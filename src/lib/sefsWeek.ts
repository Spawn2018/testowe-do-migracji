/**
 * B-6h — stan poprzedniego tygodnia dla opłaty paliwowej, tak jak liczy baza (sefs_week_calc, 0155):
 * odczyty dzienne (okres = data RRRR-MM-DD) z poprzedniego tygodnia pon–niedz względem dnia odniesienia,
 * średnia SEK i osobno PLN, mnożniki z tabel, stosowany niższy. Czas Europe/Warsaw.
 * Tylko podgląd w Opcjach — wartość przy transporcie liczy i zapisuje baza.
 */
import { lookupMult, round2, type SefsTier } from './sefs';

export interface WeekReading { index_code: string; period: string; value: number; corrects_id: number | null }

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

export function prevWeekStatus(
  readings: readonly WeekReading[],
  refDay: string,
  tiers?: { sek: SefsTier[]; pln: SefsTier[] } | null,
): PrevWeekStatus {
  const dow = (new Date(`${refDay}T12:00:00Z`).getUTCDay() + 6) % 7; // pon = 0
  const weekStart = addDays(refDay, -dow);
  const from = addDays(weekStart, -7);
  const to = addDays(weekStart, -1);
  // jak w bazie: wiersze bez wskazania korekty (corrects_id is null), okres dzienny w oknie
  const inWeek = (code: string) => readings.filter((r) => r.index_code === code && r.corrects_id === null
    && DAY.test(r.period) && r.period >= from && r.period <= to);
  const sek = inWeek('SEK'); const pln = inWeek('PLN');
  const avg = (xs: WeekReading[]) => (xs.length ? xs.reduce((a, r) => a + Number(r.value), 0) / xs.length : null);
  const avgSek = avg(sek); const avgPln = avg(pln);
  const mult = avgSek !== null && avgPln !== null && tiers
    ? Math.min(lookupMult(round2(avgSek), tiers.sek), lookupMult(round2(avgPln), tiers.pln))
    : null;
  return { from, to, nSek: sek.length, nPln: pln.length, avgSek, avgPln, mult };
}
