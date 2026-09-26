/** ANEKS 4 PR1 — żywe wywołanie keep_alive() na projekcie TESTOWYM (SUPABASE_LIVE=1), bez e-maila. */
import { describe, expect, it } from 'vitest';
import { beat } from '../workers/keep-alive/src/core';

const live = process.env.SUPABASE_LIVE === '1';
describe.skipIf(!live)('PR1 live — keep_alive() przez API bazy (klucz anon)', () => {
  it('znacznik zapisany i świeży', async () => {
    const r = await beat({
      SUPABASE_URL: process.env.VITE_SUPABASE_URL ?? '', SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY ?? '',
      ALERT_EMAIL: '', RESEND_API_KEY: '', MAIL_FROM: '',
    });
    expect(r.ok, r.detail).toBe(true);
  });
});
