/**
 * H-10 — próg porywów 15 m/s (D-84) → ryzyko.
 * Korekta ETA przez wiatr: WYŁĄCZONA do akceptacji (H10_ETA_WIND_ENABLED=0) — patrz PROPOZYCJA_H10_WIATR_ETA.md.
 * H-12 — weekendy + święta PL/SE (truck_ban_holidays).
 */
export const WIND_GUST_MS_THRESHOLD = 15;

export function windRiskTitle(gustMs: number, where: string): string {
  return `Wiatr: porywy ${gustMs.toFixed(0)} m/s na trasie (${where}) — próg ${WIND_GUST_MS_THRESHOLD} m/s`;
}

export function gustExceedsThreshold(gustMs: number | null | undefined): boolean {
  return gustMs != null && Number.isFinite(gustMs) && gustMs >= WIND_GUST_MS_THRESHOLD;
}

/** Uproszczony zakaz SE: sobota–niedziela Europe/Stockholm. */
export function seWeekendBanHit(isoUtc: string): boolean {
  const d = new Date(isoUtc);
  if (Number.isNaN(d.getTime())) return false;
  const wd = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Stockholm', weekday: 'short' }).format(d);
  return wd === 'Sat' || wd === 'Sun';
}

/** PL: niedziela Europe/Warsaw. */
export function plSundayBanHit(isoUtc: string): boolean {
  const d = new Date(isoUtc);
  if (Number.isNaN(d.getTime())) return false;
  const wd = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Warsaw', weekday: 'short' }).format(d);
  return wd === 'Sun';
}

/** H-12: święto z tabeli (przekaż wynik truck_ban_holiday_hit z bazy). */
export function holidayBanHit(fromDb: boolean | null | undefined): boolean {
  return fromDb === true;
}

export function banRiskTitle(where: 'PL' | 'SE', whenLocal: string): string {
  return `Zakaz czasowy ${where}: planowany przejazd ${whenLocal} koliduje z ograniczeniem dla ciężarówek`;
}

/**
 * Propozycja H-10 (NIE stosować w ETA, dopóki H10_ETA_WIND_ENABLED=0):
 * - porywy ≥ 15 → mnożnik prędkości 0,70 na odcinkach przed pojazdem
 * - porywy ≥ 25 → postój do spadku poniżej 15
 * Źródła do akceptacji: Trafikverket / mosty E4 — PROPOZYCJA_H10_WIATR_ETA.md
 */
export const H10_ETA_PROPOSAL = {
  enabledDefault: false,
  speedFactorAbove15: 0.7,
  stopGustMs: 25,
  resumeBelowMs: 15,
} as const;
