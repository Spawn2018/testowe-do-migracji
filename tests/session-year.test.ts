import { describe, expect, it } from 'vitest';
import {
  LOGIN_AT_KEY, MANUAL_LOGOUT_KEY, SESSION_END_MSG, deviceLabel, loginAtFromJwt, markManualLogout, rememberLogin, sessionEndReason,
} from '../src/auth/sessionYear';

const mem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m }; };
const jwt = (payload: object) => `x.${btoa(JSON.stringify(payload)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')}.y`;
const DAY = 86_400_000;

describe('A5 sesja roczna — ekran logowania po usunięciu sesji', () => {
  it('czas logowania z claim amr (najwcześniejszy), zły token → null', () => {
    expect(loginAtFromJwt(jwt({ amr: [{ method: 'otp', timestamp: 1_700_000_100 }, { method: 'x', timestamp: 1_700_000_000 }] }))).toBe(1_700_000_000_000);
    expect(loginAtFromJwt('zly')).toBeNull();
    expect(loginAtFromJwt(null)).toBeNull();
  });
  it('sesja usunięta po roku → komunikat „Minął rok…” (PL/EN/SV)', () => {
    const s = mem(); const t0 = Date.parse('2025-09-26T08:00:00Z');
    rememberLogin(jwt({ amr: [{ timestamp: t0 / 1000 }] }), s);
    expect(s.getItem(LOGIN_AT_KEY)).toBe(String(t0));
    expect(sessionEndReason(t0 + 365 * DAY + 60_000, s)).toBe('YEAR');
    /* E37 „Komunikaty zdaniami” (koniec sesji: „Zaloguj się e-mailem i hasłem”; logowanie hasłem od 29.09) */
    expect(SESSION_END_MSG.YEAR.pl).toBe('Minął rok od logowania na tym urządzeniu. Zaloguj się e-mailem i hasłem.');
    expect(SESSION_END_MSG.YEAR.en).toMatch(/year/);
    expect(SESSION_END_MSG.YEAR.sv).toMatch(/ett år/);
    expect(s.getItem(LOGIN_AT_KEY)).toBeNull();
  });
  it('sesja usunięta wcześniej (wyloguj wszędzie / HHL / dezaktywacja) → „Sesja zakończona”', () => {
    const s = mem(); const t0 = Date.parse('2026-09-01T08:00:00Z');
    rememberLogin(jwt({ amr: [{ timestamp: t0 / 1000 }] }), s);
    expect(sessionEndReason(t0 + 10 * DAY, s)).toBe('REVOKED');
  });
  it('ręczne wylogowanie i pierwsze wejście — bez komunikatu', () => {
    const s = mem();
    rememberLogin(jwt({ amr: [{ timestamp: 1_700_000_000 }] }), s);
    markManualLogout(s);
    expect(s.getItem(MANUAL_LOGOUT_KEY)).toBe('1');
    expect(sessionEndReason(Date.now(), s)).toBeNull();
    expect(sessionEndReason(Date.now(), mem())).toBeNull();
  });
  it('etykieta urządzenia', () => {
    expect(deviceLabel('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36')).toBe('Chrome · Windows');
    expect(deviceLabel('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1')).toBe('Safari · iOS');
    expect(deviceLabel(null)).toBe('Przeglądarka');
  });
});
