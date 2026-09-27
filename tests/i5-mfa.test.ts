/** I-5 — 2FA: decyzja ekranu po logowaniu + statyczne gwarancje (AuthGate, Opcje, migracja 0057). */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { mfaStep, type MfaStatus } from '../src/auth/Mfa';

const st = (o: Partial<MfaStatus>): MfaStatus => ({ role: 'HHL_ADMIN', aal: 'aal1', enforced: false, required: false, satisfied: true, ...o });

describe('I-5 mfaStep', () => {
  it('zapisany TOTP, sesja aal1 → kod', () => expect(mfaStep({ currentLevel: 'aal1', nextLevel: 'aal2' }, st({}))).toBe('verify'));
  it('sesja aal2 → nic', () => expect(mfaStep({ currentLevel: 'aal2', nextLevel: 'aal2' }, st({ aal: 'aal2' }))).toBe('none'));
  it('wymaganie włączone, brak TOTP → obowiązkowy zapis', () => expect(mfaStep({ currentLevel: 'aal1', nextLevel: 'aal1' }, st({ enforced: true, required: true, satisfied: false }))).toBe('setup'));
  it('wymaganie wyłączone, brak TOTP → nic (stan produkcji do D-11)', () => expect(mfaStep({ currentLevel: 'aal1', nextLevel: 'aal1' }, st({}))).toBe('none'));
  it('brak danych → nic', () => expect(mfaStep(null, null)).toBe('none'));
});

describe('I-5 statycznie', () => {
  const gate = readFileSync('src/auth/AuthGate.tsx', 'utf8');
  const opts = readFileSync('src/views/OptionsView.tsx', 'utf8');
  const sql = readFileSync('supabase/migrations/0057_mfa_hhl_admin.sql', 'utf8');
  it('AuthGate: poziom aal przed danymi i zdarzenie MFA_CHALLENGE_VERIFIED', () => {
    expect(gate).toMatch(/getAuthenticatorAssuranceLevel/);
    expect(gate).toMatch(/MFA_CHALLENGE_VERIFIED/);
    expect(gate.indexOf('mfaStep(')).toBeLessThan(gate.indexOf('setAuthProfile(p)'));
  });
  it('Opcje: panel 2FA tylko w buildzie Supabase (leniwy import)', () => {
    expect(opts).toMatch(/const MyMfa = import\.meta\.env\.VITE_AUTH_MODE === 'supabase' && SUPABASE_AUTH_ENABLED \? lazy\(\(\) => import\('\.\.\/auth\/Mfa'\)\)/);
  });
  it('0057: flaga włączana tylko, gdy każdy aktywny HHL_ADMIN ma TOTP; zmiana wymaga aal2', () => {
    expect(sql).toMatch(/security_flags/);
    expect(sql).toMatch(/current_aal\(\) = 'aal2'/);
  });
});
