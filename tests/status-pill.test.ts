import { describe, expect, it } from 'vitest';
import { formatDelayPill } from '../src/components/ui/StatusPill';

describe('formatDelayPill B-8.8', () => {
  it('under 24h → hours+min', () => {
    expect(formatDelayPill(95)).toBe('+1h35');
  });
  it('over 24h → days+hours+min', () => {
    expect(formatDelayPill(42 * 60)).toBe('+1d 18h 00m');
  });
});
