/**
 * #645 / #637: błędy przejściowe Graph (429/503/504/409/423) = pending z backoffem,
 * nie failed. Sprawa HHL dopiero po 4 h (RPC note_423 / clear_423).
 */

/** Odstęp do następnej próby po N-tej odpowiedzi przejściowej (attempts po inkrementacji). */
export function outboundTransientRetryDelayMinutes(attemptsAfter: number): number {
  const n = Math.max(1, Math.floor(attemptsAfter));
  if (n <= 1) return 5;
  if (n === 2) return 15;
  if (n === 3) return 30;
  return 60;
}

/** Alias historyczny (#644). */
export const outbound423RetryDelayMinutes = outboundTransientRetryDelayMinutes;

export const OUTBOUND_TRANSIENT_LOCK_RISK_HOURS = 4;
export const OUTBOUND_423_ERROR = 'upload_http_423';

export function isOutboundTransientReason(reason: string): boolean {
  return (
    reason === OUTBOUND_423_ERROR
    || reason === 'upload_http_423'
    || reason.startsWith('workbook_http_423')
    || reason.startsWith('workbook_http_429')
    || reason.startsWith('workbook_http_503')
    || reason.startsWith('workbook_http_504')
    || reason.startsWith('workbook_http_409')
    || reason === 'workbook_http_423'
    || reason === 'workbook_http_429'
    || reason === 'workbook_http_503'
    || reason === 'workbook_http_504'
    || reason === 'workbook_http_409'
  );
}
