import { describe, expect, it } from 'vitest';
import { formatHistoryActor } from '../src/lib/historyActor';

describe('formatHistoryActor (10c.1)', () => {
  it('maps system/auto to System // Watch Tower', () => {
    expect(formatHistoryActor('system')).toBe('System // Watch Tower');
    expect(formatHistoryActor('')).toBe('System // Watch Tower');
    expect(formatHistoryActor('import')).toBe('System // Watch Tower');
    expect(formatHistoryActor('geofence-engine')).toBe('System // Watch Tower');
  });
  it('keeps imię // firma', () => {
    expect(formatHistoryActor('Jan Kowalski // HHL')).toBe('Jan Kowalski // HHL');
  });
  it('maps bare role to — // org', () => {
    expect(formatHistoryActor('HHL')).toBe('— // HHL');
    expect(formatHistoryActor('SCX')).toBe('— // SCX');
  });
});
