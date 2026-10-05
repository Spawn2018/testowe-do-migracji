/**
 * H-10 — próg porywów 15 m/s (D-84) → ryzyko (bez korekty ETA do czasu TELM/H-4).
 * H-12 — kolizja planu z zakazem ruchu ciężarówek (weekendy SE; nocne PL wstępnie).
 */
export const WIND_GUST_MS_THRESHOLD = 15;

export function windRiskTitle(gustMs: number, where: string): string {
  return `Wiatr: porywy ${gustMs.toFixed(0)} m/s na trasie (${where}) — próg ${WIND_GUST_MS_THRESHOLD} m/s`;
}

export function gustExceedsThreshold(gustMs: number | null | undefined): boolean {
  return gustMs != null && Number.isFinite(gustMs) && gustMs >= WIND_GUST_MS_THRESHOLD;
}

/** Uproszczony zakaz SE: sobota 00:00–niedziela 24:00 Europe/Stockholm dla ciężaru (wstępne). */
export function seWeekendBanHit(isoUtc: string): boolean {
  const d = new Date(isoUtc);
  if (Number.isNaN(d.getTime())) return false;
  const wd = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Stockholm', weekday: 'short' }).format(d);
  return wd === 'Sat' || wd === 'Sun';
}

/** PL: niedziela (wstępne — pełny kalendarz świąt w LOGIKA po H-12). */
export function plSundayBanHit(isoUtc: string): boolean {
  const d = new Date(isoUtc);
  if (Number.isNaN(d.getTime())) return false;
  const wd = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Warsaw', weekday: 'short' }).format(d);
  return wd === 'Sun';
}

export function banRiskTitle(where: 'PL' | 'SE', whenLocal: string): string {
  return `Zakaz czasowy ${where}: planowany przejazd ${whenLocal} koliduje z ograniczeniem dla ciężarówek`;
}
