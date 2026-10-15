/**
 * C16 N1 / N8 — mapowanie kodów i HMAC ack (D-20261015-1955-01).
 * Logika jak w `_shared/pushFailReason.ts` / `pushAck.ts` (Edge Deno ≠ import Vitest).
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

async function signPushAck(nid: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(nid));
  const bytes = new Uint8Array(mac);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function verifyPushAck(nid: string, ack: string, secret: string): Promise<boolean> {
  if (!nid || !ack || !secret) return false;
  const expected = await signPushAck(nid, secret);
  if (expected.length !== ack.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ ack.charCodeAt(i);
  }
  return diff === 0;
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

describe('pushAck HMAC (C16-N3)', () => {
  it('dobry podpis → true; zły → false', async () => {
    const secret = 'test-vapid-private';
    const nid = 'test:sub-1:1729000000000';
    const ack = await signPushAck(nid, secret);
    expect(await verifyPushAck(nid, ack, secret)).toBe(true);
    expect(await verifyPushAck(nid, ack + 'x', secret)).toBe(false);
    expect(await verifyPushAck(nid, ack, 'other')).toBe(false);
    expect(await verifyPushAck('', ack, secret)).toBe(false);
  });
});
