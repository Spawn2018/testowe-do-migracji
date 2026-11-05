/**
 * H-10 / E49 — próg porywów w Ryzykach (D-84 = 20 m/s od 16.10; E49-a DP-205).
 * Korekta ETA przez wiatr: moduł `_shared/e49/windEta.ts` (Z1); stara H10_ETA_PROPOSAL usunięta.
 * H-12 — weekendy + święta PL/SE (truck_ban_holidays).
 */
import { E49_WIND_DEFAULTS } from '../e49/windEta.ts';

/** D-84 / E49 Z2: próg sprawy „Silny wiatr” = WIND_SLOW_MS (domyślnie 20). */
export const WIND_GUST_MS_THRESHOLD = E49_WIND_DEFAULTS.WIND_SLOW_MS;

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

/**
 * DP-211 F7 #805 N1: agregacja próbek RPC świąt.
 * true wygrywa; jeśli którakolwiek próbka = null i żadna nie = true → null (→ warn, nigdy ok).
 */
export function mergeHolidayBanSamples(hits: ReadonlyArray<boolean | null>): boolean | null {
  let sawNull = false;
  for (const hit of hits) {
    if (hit === true) return true;
    if (hit == null) sawNull = true;
  }
  return sawNull ? null : false;
}

export function banRiskTitle(where: 'PL' | 'SE', whenLocal: string): string {
  return `Zakaz czasowy ${where}: planowany przejazd ${whenLocal} koliduje z ograniczeniem dla ciężarówek`;
}
