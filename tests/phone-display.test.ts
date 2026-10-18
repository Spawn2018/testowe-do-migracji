// Decyzja właściciela 15.10.2026, 03:12: numery telefonów wszędzie widoczne, bez ukrywania
// (zastępuje „numer częściowo ukryty” z makiety E37). Dopisek D-20261015-0330-01 pkt 1.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { groupPhone } from '../src/lib/phoneDisplay';

describe('groupPhone — pełny numer', () => {
  it('PL i SE w grupach po 3 cyfry', () => {
    expect(groupPhone('+48000000001')).toBe('+48 000 000 001');
    expect(groupPhone('+46000000012')).toBe('+46 000 000 012');
  });
  it('kod kraju 1, 2 albo 3 cyfry (E.164; F7 #307 D1)', () => {
    expect(groupPhone('+12025550100')).toBe('+1 202 555 01 00');
    expect(groupPhone('+79161234567')).toBe('+7 916 123 45 67');
    expect(groupPhone('+37000000002')).toBe('+370 000 000 02');
    expect(groupPhone('+358401234567')).toBe('+358 401 234 567');
    expect(groupPhone('+420601234567')).toBe('+420 601 234 567');
    expect(groupPhone('+972501234567')).toBe('+972 501 234 567');
    expect(groupPhone('+4915112345678')).toBe('+49 151 123 456 78');
    expect(groupPhone('+447700900123')).toBe('+44 770 090 01 23');
    expect(groupPhone('+36301234567')).toBe('+36 301 234 567');
  });
  it('numer bez prefiksu i krótki zostają czytelne', () => {
    expect(groupPhone('000000001')).toBe('000 000 001');
    expect(groupPhone(' 112 ')).toBe('112');
  });
  it('żadnej maski w menu konta i w Bramce SMS', () => {
    for (const f of ['src/components/shell/AccountMenu.tsx', 'src/auth/SmsGateway.tsx']) {
      const src = readFileSync(f, 'utf8');
      expect(src).not.toMatch(/•••|maskPhone|to_e164\.slice\(-/);
      expect(src).toMatch(/groupPhone\(/);
    }
  });
});
