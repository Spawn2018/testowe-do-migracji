/**
 * E41 (P2) — jedna funkcja nazwy. KSH bez numerów. SMS sam kod.
 */
import { describe, expect, it } from 'vitest';
import {
  stripTransportPrefix,
  transportCaseTitle,
  transportLabel,
  transportSearchBlob,
  transportSmsCode,
} from '../src/lib/transportName';

const sg03 = { code: 'SG-03', hhlOrderNo: '0005/09/S/2026', carrierOrderNo: '15062/2026/OSL/GDA/P' };
const sg07 = { code: 'SG-07', hhlOrderNo: null, carrierOrderNo: '  ' };

describe('E41 nazwa transportu', () => {
  it('HHL i SCX z numerem, KSH sam kod', () => {
    expect(transportLabel(sg03, 'HHL')).toBe('SG-03 · 0005/09/S/2026');
    expect(transportLabel(sg03, 'SCX')).toBe('SG-03 · 15062/2026/OSL/GDA/P');
    expect(transportLabel(sg03, 'KSH')).toBe('SG-03');
    expect(transportLabel(sg03, 'KSH')).not.toMatch(/0005|15062/);
  });

  it('brak numeru: dopisek tylko w harmonogramie i panelu', () => {
    expect(transportLabel(sg07, 'HHL', 'schedule')).toBe('SG-07 brak nr HHL');
    expect(transportLabel(sg07, 'SCX', 'panel')).toBe('SG-07 brak nr SCX');
    expect(transportLabel(sg07, 'HHL', 'plain')).toBe('SG-07');
    expect(transportLabel(sg07, 'KSH', 'panel')).toBe('SG-07');
  });

  it('tytuł sprawy po nazwie ma pauzę, SMS sam kod', () => {
    expect(transportCaseTitle(sg03, 'HHL', 'Nowa wiadomość w czacie')).toBe(
      'SG-03 · 0005/09/S/2026 — Nowa wiadomość w czacie',
    );
    expect(transportCaseTitle(sg07, 'KSH', '5c77d4d7: brak awizacji przed załadunkiem')).toBe(
      'SG-07 — brak awizacji przed załadunkiem',
    );
    expect(transportSmsCode(sg03)).toBe('SG-03');
    expect(transportSmsCode(sg03)).not.toContain('·');
  });

  it('wyszukiwanie KSH nie widzi numerów', () => {
    expect(transportSearchBlob({ ...sg03, orderNo: '15048/2026/OSL/GDA/P' }, 'KSH')).toBe('sg-03');
    expect(transportSearchBlob(sg03, 'HHL')).toContain('0005/09/s/2026');
    expect(transportSearchBlob(sg03, 'SCX')).toContain('15062/2026/osl/gda/p');
    expect(stripTransportPrefix('SG-03 · 0005/09/S/2026 — brak awizacji', 'SG-03')).toBe('brak awizacji');
  });
});
