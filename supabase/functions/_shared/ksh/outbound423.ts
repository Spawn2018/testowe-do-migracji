/**
 * #637 F7: HTTP 423 (plik otwarty) = stan przejściowy, nie błąd.
 * Backoff: 5 → 15 → 30 → 60 min, potem co 60 min. Sprawa HHL dopiero po 4 h.
 */

/** Odstęp do następnej próby po N-tej odpowiedzi 423 (attempts po inkrementacji). */
export function outbound423RetryDelayMinutes(attemptsAfter: number): number {
  const n = Math.max(1, Math.floor(attemptsAfter));
  if (n <= 1) return 5;
  if (n === 2) return 15;
  if (n === 3) return 30;
  return 60;
}

export const OUTBOUND_423_LOCK_RISK_HOURS = 4;
export const OUTBOUND_423_ERROR = 'upload_http_423';
