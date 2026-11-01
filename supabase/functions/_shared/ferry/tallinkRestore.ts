/**
 * BN3 #686 / decyzja 72 cz. 2 — reguły auto-przywrócenia Tallink Alert (F7 r1).
 * Pure helpers: jobs + store + testy bez cyklu importów.
 */

/** #686 F7 B3: filtr PostgREST `SAILING_CANCELLED:%:{sailingId}`. */
export function sailingCancelledRiskLike(sailingId: string): string {
  const esc = sailingId.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
  return `SAILING_CANCELLED:%:${esc}`;
}

/** #686 F7 B1: cofnięcie tylko gdy ODWOLANY z Tallink Alert (domena tallink.com). */
export function isTallinkAlertAutoCancel(notice: {
  source: string;
  operator: string;
  sourceUrl?: string | null;
} | null | undefined): boolean {
  if (!notice || notice.source !== 'AUTO') return false;
  if (!/TALLINK/i.test(notice.operator)) return false;
  const url = (notice.sourceUrl ?? '').toLowerCase();
  return url.includes('tallink.com');
}

/** #686 F7 pkt 1: status sprzed odwołania — OPOZNIONY gdy delayed_*, inaczej ZAPLANOWANY. */
export function restoreStatusAfterCancel(s: {
  delayed_departure_at: string | null;
  delayed_arrival_at: string | null;
}): 'ZAPLANOWANY' | 'OPOZNIONY' {
  if (s.delayed_departure_at || s.delayed_arrival_at) return 'OPOZNIONY';
  return 'ZAPLANOWANY';
}

/** #686 F7 B2: load_id z dedupów SAILING_CANCELLED (także zamkniętych). */
export function loadIdsFromSailingCancelledDedups(
  rows: { load_id: string | null; dedup_key: string | null }[],
): string[] {
  return [...new Set(rows.filter((r) => r.load_id).map((r) => r.load_id!))];
}

/** #686 F7 B2: transporty z ryzyka odwołania, które mają inny sailing_id. */
export function filterLoadsReassignedFromSailing(
  loadIds: string[],
  loads: { id: string; sailing_id: string | null }[],
  sailingId: string,
): string[] {
  const want = new Set(loadIds);
  return loads.filter((l) => want.has(l.id) && l.sailing_id !== sailingId).map((l) => l.id);
}

/**
 * #686 F7 pkt 5 (72c restore): zdegradowany / niewzorcowy komunikat przywrócenia.
 * Także „will operate.” (mutacja M12) — ryzyko MEDIUM, bez auto.
 */
export function tallinkAlertLooksLikeRestore(text: string): boolean {
  if (/\bwill\s+not\s+operate\b/i.test(text)) return false;
  return /\b(?:will\s+operate(?:\s+as\s+(?:planned|scheduled))?|has\s+been\s+reinstated|is\s+no\s+longer\s+cancel(?:led|ed)|operates\s+as\s+planned|back\s+in\s+service|reinstated)\b/i
    .test(text);
}
