/**
 * wyglad/P10b-a (E37 pkt 4 i 7): komunikat HHL z „Zamknij”, „Nie pamiętam hasła” zawsze tak samo, ekran „Link wygasł”.
 * Teksty z tabeli „Komunikaty — dziś i po zmianie” (`makiety_html/E37/pasek.html`), bez kodów i nazw usług.
 */
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { p10b, p10bp } from '../src/i18n/p10b';
import { ExpiredLinkScreen } from '../src/auth/ExpiredLinkScreen';
import { isExpiredLinkError, RECOVERY_LINK_TTL, type ExpiredLinkInfo } from '../src/lib/p10bSource';

const noop = () => {};
const screen = (info: ExpiredLinkInfo | null) => renderToString(createElement(ExpiredLinkScreen, {
  brand: createElement('span', null, 'WT'), locale: 'pl', info, onResend: async () => true, onForgot: noop, onLogin: noop,
}));

describe('P10b-a · teksty E37', () => {
  it('„Nie pamiętam hasła”: jedna odpowiedź z czasem ważności z ustawień logowania (1 h)', () => {
    expect(RECOVERY_LINK_TTL).toBe('1 h');
    expect(p10bp('pl', 'p10b_reset_sent', { ttl: RECOVERY_LINK_TTL }))
      .toBe('Jeśli adres ma konto, wysłaliśmy link. Działa na każdym urządzeniu przez 1 h.');
    const cfg = readFileSync('supabase/config.toml', 'utf8');
    expect(cfg).toMatch(/otp_expiry = 3600/);
  });
  it('komunikat HHL: „Zamknij”, na telefonie „✕” z opisem', () => {
    expect(p10b('pl', 'p10b_bcast_close')).toBe('Zamknij');
    expect(p10b('pl', 'p10b_bcast_close_aria')).toBe('Zamknij komunikat HHL');
  });
  it('bez kodów, nazw usług i odnośników sms:/mailto:', () => {
    const src = [...readFileSync('src/i18n/p10b.ts', 'utf8').matchAll(/: '([^']*)',/g)].map((m) => m[1]).join('\n').toLowerCase();
    expect(src).toContain('link wygasł');
    for (const bad of ['sms:', 'mailto:', 'supabase', 'resend', 'smtp', 'otp_', 'tower_no_invite']) expect(src).not.toContain(bad);
  });
});

describe('P10b-a · ekran „Link wygasł”', () => {
  it('bez informacji o linku (produkcja do podłączenia): tytuł, „Nie pamiętam hasła”, „Wróć do logowania”', () => {
    const html = screen(null);
    expect(html).toContain('data-auth="expired"');
    expect(html).toContain('Link wygasł');
    expect(html).toContain('Poproś o nowy link: wpisz swój adres w „Nie pamiętam hasła”.');
    expect(html).toContain('data-expired-forgot');
    expect(html).toContain('Wróć do logowania');
    expect(html).not.toContain('data-expired-resend');
    expect(html).not.toContain('Link wygasł lub');
  });
  it('zaproszenie ważne: ważność linku i zaproszenia, „Wyślij nowy link na …”, przypis', () => {
    const html = screen({ email: 'anna.nowak@example.com', kind: 'invite', linkTtl: '24 h', inviteValidUntil: '2026-10-16T10:00:00Z', canResend: true });
    expect(html).toMatch(/Link w e-mailu działa 24 h\. Twoje zaproszenie jest ważne do 16\.10\.2026, 12:00\./);
    expect(html).toContain('Wyślij nowy link na anna.nowak@example.com');
    expect(html).toContain('Nowy link przychodzi w ciągu minuty. Problem? Zadzwoń do Operacji HHL.');
  });
  it('zaproszenie wygasło: bez wysyłki, prośba do Operacji HHL', () => {
    const html = screen({ email: 'x@example.com', kind: 'invite', linkTtl: '24 h', inviteValidUntil: '2026-10-01T10:00:00Z', canResend: false });
    expect(html).toContain('Twoje zaproszenie też wygasło. Poproś Operacje HHL o nowe.');
    expect(html).not.toContain('data-expired-resend');
  });
  it('reset hasła: ważność 1 h i wysyłka', () => {
    const html = screen({ email: 'x@example.com', kind: 'recovery', linkTtl: '1 h', inviteValidUntil: null, canResend: true });
    expect(html).toContain('Link w e-mailu działa 1 h.');
    expect(html).toContain('Wyślij nowy link na x@example.com');
  });
  it('rozpoznanie wygasłego linku', () => {
    expect(isExpiredLinkError('Link wygasł lub został już użyty. Poproś o nowy.')).toBe(true);
    expect(isExpiredLinkError('Link wygasł lub jest niekompletny.')).toBe(true);
    expect(isExpiredLinkError('Email link is invalid or has expired')).toBe(true);
    expect(isExpiredLinkError('Nieprawidłowy e-mail lub hasło.')).toBe(false);
  });
});

describe('P10b-a · podpięcie (źródło)', () => {
  const gate = readFileSync('src/auth/AuthGate.tsx', 'utf8');
  it('AuthGate: powrót z błędem Auth (#error_code=otp_expired) i wygasły link z „Dalej” → ekran „Link wygasł”', () => {
    expect(gate).toMatch(/const expired = captureExpiredFromUrl\(\);\n    if \(expired\) return \{ kind: 'expired', link: expired \};/);
    expect(gate).toMatch(/isExpiredLinkError\(r\.error\) \? \{ kind: 'expired', link: r\.link \?\? null \}/);
    expect(gate).toMatch(/otp_expired/);
  });
  it('„Nie pamiętam hasła”: ta sama odpowiedź także przy „brak zaproszenia” (bez zdradzania konta)', () => {
    expect(gate).toMatch(/p10bp\(locale, 'p10b_reset_sent', \{ ttl: RECOVERY_LINK_TTL \}\)/);
    expect(gate).not.toMatch(/t\(locale, 'auth_reset_sent'\)/);
    const own = /const own = \/Zbyt wiele prób\|Nie udało się wysłać e-maila\|Nieprawidłowy adres e-mail\//;
    expect(gate).toMatch(own);
  });
});

describe('P10b-a · komunikat HHL', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.resetModules(); });
  it('demo z `komunikat-hhl=1`: treść, data końca i „Zamknij”; po zamknięciu nie wraca', async () => {
    const store = new Map<string, string>();
    vi.stubGlobal('window', { location: { hash: '#/?komunikat-hhl=1', search: '' } });
    vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); } });
    vi.stubEnv('VITE_AUTH_MODE', 'demo');
    vi.resetModules();
    const { SystemBroadcastBanner } = await import('../src/components/shell/SystemBroadcastBanner');
    const html = renderToString(createElement(SystemBroadcastBanner));
    expect(html).toContain('data-banner="system-broadcast"');
    expect(html).toContain('Prom Stena Estelle wypływa o 10:00 zamiast 08:00. Awizacje bez zmian.');
    expect(html).toContain('data-bcast-close');
    expect(html).toContain('Zamknij');
    expect(html).toContain('aria-label="Zamknij komunikat HHL"');
    const { dismissBroadcast } = await import('../src/lib/p10bSource');
    dismissBroadcast(-1);
    expect(store.get('wt-bcast-closed--1')).toBe('1');
    expect(renderToString(createElement(SystemBroadcastBanner))).toBe('');
  });
  it('demo bez flagi: brak komunikatu', async () => {
    vi.stubGlobal('window', { location: { hash: '#/', search: '' } });
    vi.stubEnv('VITE_AUTH_MODE', 'demo');
    vi.resetModules();
    const { SystemBroadcastBanner } = await import('../src/components/shell/SystemBroadcastBanner');
    expect(renderToString(createElement(SystemBroadcastBanner))).toBe('');
  });
});
