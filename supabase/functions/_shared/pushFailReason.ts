/** C16 N1 / N2 — kod odpowiedzi usługi push → powód dla ekranu i dziennika. */
export type PushFailReason = 'gone' | 'auth' | 'payload' | 'service';

export function pushFailReasonOf(statusCode: number | undefined | null): PushFailReason {
  if (statusCode === 404 || statusCode === 410) return 'gone';
  if (statusCode === 401 || statusCode === 403) return 'auth';
  if (statusCode === 400 || statusCode === 413) return 'payload';
  return 'service';
}

/** Domena usługi (FCM / Apple / Mozilla) — bez pełnego adresu urządzenia. */
export function pushServiceHost(endpoint: string): string {
  try {
    return new URL(endpoint).hostname;
  } catch {
    return 'unknown';
  }
}

/** Kod z wyjątku biblioteki `web-push` (`statusCode`), nie z `message`. */
export function pushStatusCodeOf(err: unknown): number | undefined {
  if (err && typeof err === 'object' && 'statusCode' in err) {
    const n = (err as { statusCode?: unknown }).statusCode;
    if (typeof n === 'number' && Number.isFinite(n)) return n;
  }
  return undefined;
}
