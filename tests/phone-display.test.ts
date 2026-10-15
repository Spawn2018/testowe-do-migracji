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
