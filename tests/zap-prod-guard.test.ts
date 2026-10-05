import { describe, expect, it } from 'vitest';
import { assertActiveScanAllowed, isProdZapTarget } from '../scripts/zap/prodGuard.mjs';

describe('ZAP Active Scan — ochrona PROD', () => {
  it('oznacza tower.log-mar.pl jako prod', () => {
    expect(isProdZapTarget('https://tower.log-mar.pl')).toBe(true);
    expect(isProdZapTarget('https://tower.log-mar.pl/')).toBe(true);
    expect(isProdZapTarget('https://www.tower.log-mar.pl')).toBe(true);
  });

  it('oznacza watch-tower-makieta.vercel.app jako prod', () => {
    expect(isProdZapTarget('https://watch-tower-makieta.vercel.app')).toBe(true);
  });

  it('odrzuca Active Scan na prod (throw)', () => {
    expect(() => assertActiveScanAllowed('https://tower.log-mar.pl')).toThrow(/ODMOWA|zabroniony/i);
    expect(() => assertActiveScanAllowed('https://watch-tower-makieta.vercel.app')).toThrow(/ODMOWA|zabroniony/i);
  });

  it('pozwala na URL TEST (nie-prod)', () => {
    expect(isProdZapTarget('https://watch-tower-test.vercel.app')).toBe(false);
    expect(isProdZapTarget('http://127.0.0.1:4173')).toBe(false);
    expect(() => assertActiveScanAllowed('https://watch-tower-test.example')).not.toThrow();
  });

  it('puste URL = błąd', () => {
    expect(() => assertActiveScanAllowed('')).toThrow(/Brak URL/);
  });
});
