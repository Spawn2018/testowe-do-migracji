/**
 * C16 N1 / N8 — mapowanie kodów usługi push → reason (D-20261015-1955-01).
 * Logika w `_shared/pushFailReason.ts`; tu kopia reguł (Edge Deno nie jest importem Vitest).
 */
import { describe, expect, it } from 'vitest';

type PushFailReason = 'gone' | 'auth' | 'payload' | 'service';

function pushFailReasonOf(statusCode: number | undefined | null): PushFailReason {
  if (statusCode === 404 || statusCode === 410) return 'gone';
  if (statusCode === 401 || statusCode === 403) return 'auth';
  if (statusCode === 400 || statusCode === 413) return 'payload';
  return 'service';
}

function pushStatusCodeOf(err: unknown): number | undefined {
  if (err && typeof err === 'object' && 'statusCode' in err) {
    const n = (err as { statusCode?: unknown }).statusCode;
    if (typeof n === 'number' && Number.isFinite(n)) return n;
  }
  return undefined;
}

describe('pushFailReasonOf (C16-N1)', () => {
  it('410/404 → gone; 401/403 → auth; 400/413 → payload; reszta → service', () => {
    expect(pushFailReasonOf(410)).toBe('gone');
    expect(pushFailReasonOf(404)).toBe('gone');
    expect(pushFailReasonOf(401)).toBe('auth');
    expect(pushFailReasonOf(403)).toBe('auth');
    expect(pushFailReasonOf(400)).toBe('payload');
    expect(pushFailReasonOf(413)).toBe('payload');
    expect(pushFailReasonOf(500)).toBe('service');
    expect(pushFailReasonOf(503)).toBe('service');
    expect(pushFailReasonOf(undefined)).toBe('service');
    expect(pushFailReasonOf(null)).toBe('service');
  });

  it('kod z e.statusCode, nie z message (F4)', () => {
    expect(pushStatusCodeOf({ statusCode: 410, message: 'Received unexpected response code' })).toBe(410);
    expect(pushStatusCodeOf(new Error('410 Gone'))).toBeUndefined();
  });
});
