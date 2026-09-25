/**
 * M3 — pobieranie kursu NBP: zawsze PRZEDZIAŁ [dzień − 14, dzień − 1], nigdy pojedynczy dzień
 * (dzień bez publikacji → 404). Ta sama reguła co `fx_sync_nbp()` w bazie (0011).
 * Logika wyboru tabeli pozostaje w engine.ts (`nbpRateBefore`) — tu tylko przedział i adres.
 */
import { fetchNbpEurRange, nbpRateBefore, localDateOf, type NbpRate } from './engine';

const addDays = (dateIso: string, n: number) => {
  const [y, m, d] = dateIso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};

/** Przedział zapytania dla dnia lokalnego rozładunku. */
export function nbpRangeForDay(localDate: string): { from: string; to: string } {
  return { from: addDays(localDate, -14), to: addDays(localDate, -1) };
}

export function nbpRangeUrl(localDate: string): string {
  const { from, to } = nbpRangeForDay(localDate);
  return `https://api.nbp.pl/api/exchangerates/rates/a/eur/${from}/${to}/?format=json`;
}

/** Migawka kursu dla rozładunku (UTC ISO) — dzień lokalny (Z2), przedział, reguła W3. */
export async function fxSnapshotForUnload(unloadedAtUtc: string): Promise<{ localDate: string; rate: NbpRate }> {
  const localDate = localDateOf(unloadedAtUtc);
  const { from, to } = nbpRangeForDay(localDate);
  const rates = await fetchNbpEurRange(from, to);
  return { localDate, rate: nbpRateBefore(rates, localDate) };
}
