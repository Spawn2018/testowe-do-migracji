/**
 * wyglad/2fa (D-20261014-1420-01 „Koordynator”): teksty urządzeń 2FA i blokady wymagania dla administratorów —
 * bez „sms:”, „mailto:”, „supabase” (I-2); „Podgląd — nic tu nie zapiszesz” (W38, E37).
 */
import { describe, expect, it } from 'vitest';
import { M2_PL, m2 } from '../src/i18n/mfa2';

describe('2FA — teksty', () => {
  it('urządzenia, drugie urządzenie, blokady, Podgląd', () => {
    expect(m2('m2_since', { d: '12.10.2026' })).toBe('od 12.10.2026');
    expect(m2('m2_q_remove', { name: 'Telefon 1' })).toBe('Usunąć urządzenie „Telefon 1”?');
    expect(M2_PL.m2_preview).toBe('Podgląd — nic tu nie zapiszesz.');
    const all = Object.values(M2_PL).join('\n').toLowerCase();
    for (const bad of ['sms:', 'mailto:', 'supabase']) expect(all).not.toContain(bad);
  });
});
