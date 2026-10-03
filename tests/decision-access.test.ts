import { describe, expect, it } from 'vitest';
import { mayResolveDecision } from '../src/lib/decisionAccess';

describe('L-2 kto rozstrzyga', () => {
  it('firma z katalogu może, inna nie', () => {
    expect(mayResolveDecision('HHL', 'HHL_OPS')).toBe(true);
    expect(mayResolveDecision('HHL', 'CARRIER_DISPATCH')).toBe(false);
    expect(mayResolveDecision('CARRIER', 'CARRIER_USER')).toBe(true);
    expect(mayResolveDecision('CARRIER', 'HHL_OPS')).toBe(false);
    expect(mayResolveDecision('ADMIN', 'HHL_OPS')).toBe(false);
    expect(mayResolveDecision('ADMIN', 'CARRIER_DISPATCH')).toBe(false);
  });

  it('administrator HHL może każdy typ', () => {
    expect(mayResolveDecision('HHL', 'HHL_ADMIN')).toBe(true);
    expect(mayResolveDecision('CARRIER', 'HHL_ADMIN')).toBe(true);
    expect(mayResolveDecision('ADMIN', 'HHL_ADMIN')).toBe(true);
    expect(mayResolveDecision('CLIENT', 'HHL_ADMIN')).toBe(true);
  });
});
