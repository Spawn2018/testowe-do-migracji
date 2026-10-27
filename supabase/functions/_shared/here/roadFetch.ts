/**
 * #572 BN0 / F7 #585 r4 — kiedy wołać płatne HERE dla lega drogi.
 * Najpierw `retry_after` (bez zapytań w oknie odrzucenia), potem świeżość 30 dni.
 */

export const ROAD_FETCH_DAY_MS = 30 * 864e5;

export type RoadGeomPrev = {
  fetched_at: string;
  retry_after: string | null;
};

/**
 * true = wolno wołać HERE.
 * `-infinity` w fetched_at → age = Infinity (traktuj jak nieświeże), ale aktywny retry_after blokuje.
 */
export function shouldFetch(
  prev: RoadGeomPrev | undefined,
  now: number,
  corridorNewer: boolean,
  dayMs: number = ROAD_FETCH_DAY_MS,
): boolean {
  if (!prev) return true;
  const retryAt = prev.retry_after ? Date.parse(prev.retry_after) : NaN;
  if (Number.isFinite(retryAt) && now < retryAt) return false;
  const fetched = Date.parse(prev.fetched_at);
  const age = Number.isFinite(fetched) ? now - fetched : Infinity;
  if (age < dayMs && !corridorNewer) return false;
  return true;
}
