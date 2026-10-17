/**
 * wyglad/P10b-d — pierwsze wejście (E37 pkt 9): obliczenia widoku, źródło (I-0, produkcja bez zmian do podłączenia)
 * i miejsca w logowaniu (AuthGate) za warunkiem `firstEntryReady()`.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { INVITE_STEPS, phoneE164, phoneParts, platformOf, pwCheck, receivesSummary, splitName, stepNumber } from '../src/lib/firstEntry';
import { DEMO_MATRIX } from '../src/components/options/demo';

describe('pierwsze wejście — obliczenia', () => {
  it('4 kroki w kolejności E37 pkt 9; „n z 4” tylko w ścieżce zaproszenia', () => {
    expect(INVITE_STEPS).toEqual(['invite', 'password', 'details', 'notify']);
    expect(stepNumber('details', INVITE_STEPS)).toEqual({ n: 3, total: 4 });
    expect(stepNumber('details', ['details'])).toBeNull();
  });

  it('hasło: minimum 12 znaków, litery i cyfry (E19 decyzja 1 A; wyglad/audyt-E E-12)', () => {
    expect(pwCheck('Bezpieczne14!!', 12)).toEqual({ len: 14, ok: true, letter: true, digit: true });
    expect(pwCheck('krotkie', 12)).toEqual({ len: 7, ok: false, letter: true, digit: false });
    expect(pwCheck('Dlugie-haslo-bez', 12)).toEqual({ len: 16, ok: false, letter: true, digit: false });
    expect(pwCheck('ąęśćżźółń1234', 12)).toEqual({ len: 13, ok: false, letter: false, digit: true }); /* jak Supabase: litera a–z */
    expect(pwCheck('123456789012', 12)).toEqual({ len: 12, ok: false, letter: false, digit: true });
    expect(pwCheck('Zażółć-1234!', 12)).toMatchObject({ ok: true });
  });

  it('telefon: kierunkowy + numer → E.164; zły numer → null; odczyt z konta', () => {
    expect(phoneE164('PL', '600 100 200')).toBe('+48600100200');
    expect(phoneE164('SE', '070 123 45 67')).toBe('+46701234567');
    expect(phoneE164('PL', '12')).toBeNull();
    expect(phoneE164('PL', '')).toBeNull();
    expect(phoneParts('+46701234567')).toEqual({ country: 'SE', national: '0701234567' });
    expect(phoneParts(null)).toEqual({ country: 'PL', national: '' });
    expect(splitName('Anna Maria Nowak')).toEqual({ first: 'Anna', last: 'Maria Nowak' });
  });

  it('urządzenie: iPhone, iPad z „Macintosh” i dotykiem, Android, komputer', () => {
    expect(platformOf('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')).toBe('ios');
    expect(platformOf('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5)).toBe('ios');
    expect(platformOf('Mozilla/5.0 (Linux; Android 14; SM-S928B)')).toBe('android');
    expect(platformOf('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe('desktop');
  });

  it('„Dostajesz:” według „Dla mnie”: najpierw na telefon, bez „Sytuacji ogólnej”, małą literą', () => {
    const rows = DEMO_MATRIX.flatMap((g) => g.rows);
    for (const kind of ['HHL_ADMIN', 'HHL_OPS', 'CLIENT_USER', 'CARRIER_DISPATCH', 'CARRIER_USER'] as const) {
      const mine = rows.filter((r) => !r.risksOnly && r.cells[kind] && (r.cells[kind]!.bell || r.cells[kind]!.push || r.cells[kind]!.mail));
      const push = mine.filter((r) => r.cells[kind]!.push);
      const sum = receivesSummary(DEMO_MATRIX, kind);
      expect(sum.push, kind).toBe(push.length);
      expect(sum.titles.length + sum.more, kind).toBe(mine.length);
      const expected = [...push, ...mine.filter((r) => !r.cells[kind]!.push)].slice(0, 3).map((r) => r.title.charAt(0).toLocaleLowerCase('pl') + r.title.slice(1));
      expect(sum.titles, kind).toEqual(expected);
      expect(sum.titles.join(' '), kind).not.toMatch(/Sytuacja ogólna/i);
    }
  });
});

describe('pierwsze wejście — źródło i logowanie', () => {
  it('źródło: warunek trybu wpisany wprost (I-0); produkcja do podłączenia', () => {
    const src = readFileSync('src/lib/firstEntrySource.ts', 'utf8');
    expect(src.match(/import\.meta\.env\.VITE_AUTH_MODE !== 'supabase'/g)?.length).toBeGreaterThanOrEqual(5);
    expect(src).toMatch(/D-20261016-0930-01/);
  });

  it('AuthGate: krok 1 tylko przy linku zaproszenia, krok 2 poza „Nie pamiętam hasła”, kroki 3–4 po haśle, sam krok 3 bez telefonu — każdy za firstEntryReady()', () => {
    const g = readFileSync('src/auth/AuthGate.tsx', 'utf8');
    expect(g).toMatch(/firstEntryReady\(\) && pendingLinkType\(\) === 'invite'/);
    expect(g).toMatch(/firstEntryReady\(\) && reason !== 'recovery'/);
    expect(g).toMatch(/firstEntryReady\(\) && needsPhone\(profile\)/);
    expect(g).toMatch(/steps: \['details', 'notify'\], help: true/);
  });

  it('teksty bez kodów i nazw usług (E21)', () => {
    const tx = readFileSync('src/i18n/first.ts', 'utf8');
    expect(tx).not.toMatch(/supabase|resend|SG-\d|HHL_|CLIENT_|CARRIER_/i);
  });
});
