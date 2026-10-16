/** AUTH-1 — logowanie hasłem: walidacja hasła + statyczne gwarancje UI/migracji. */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { passwordOk, PASSWORD_MIN } from '../src/auth/config';

describe('AUTH-1 hasło', () => {
  it(`minimalna długość = ${PASSWORD_MIN}`, () => {
    expect(PASSWORD_MIN).toBe(12);
    expect(passwordOk('12345678901')).toBe(false);
    expect(passwordOk('123456789012')).toBe(true);
  });

  it('AuthGate: hasło, Dalej, reset bez ujawniania konta (A3)', () => {
    const gate = readFileSync('src/auth/AuthGate.tsx', 'utf8');
    const client = readFileSync('src/auth/client.ts', 'utf8');
    expect(gate).toMatch(/signInWithPassword/);
    expect(gate).not.toMatch(/auth_email_allowed/);
    expect(gate).toMatch(/sendRecoveryLink/);
    /* wyglad/P10b-a (E37 pkt 7): jedna odpowiedź „Jeśli adres ma konto, wysłaliśmy link. Działa na każdym urządzeniu przez 1 h.” */
    expect(gate).toMatch(/p10b_reset_sent/);
    expect(readFileSync('src/auth/sendAuthEmail.ts', 'utf8')).toMatch(/auth\/v1\/recover/);
    expect(gate).toMatch(/data-auth="link-pending"/);
    expect(gate).toMatch(/data-auth="set-password"/);
    expect(gate).not.toMatch(/signInWithOtp/);
    expect(client).toMatch(/detectSessionInUrl:\s*false/);
    expect(client).toMatch(/flowType:\s*'pkce'/);
  });

  it('0099 + 0208: auth_email_allowed bez anon (A3)', () => {
    const sql = readFileSync('supabase/migrations/0099_auth_password_login.sql', 'utf8');
    expect(sql).toMatch(/auth_email_allowed/);
    expect(sql).toMatch(/must_set_password/);
    expect(sql).toMatch(/app_user_mark_password_set/);
    const a3 = readFileSync('supabase/migrations/0208_audyt_a2_a3_reads_auth.sql', 'utf8');
    expect(a3).toMatch(/revoke execute on function public\.auth_email_allowed\(text\) from anon/i);
  });
});
