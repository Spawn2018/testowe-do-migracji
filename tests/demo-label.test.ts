import { describe, expect, it } from 'vitest';
import {
  DEMO_MARK_PL,
  isDemoSourceMode,
  trafikverketShortLabel,
  trafikverketSourceNote,
} from '../src/lib/demoLabel';

describe('D3 demo label (Trafikverket / D18 pattern)', () => {
  it('seed mode is explicit Polish demo — not live API wording', () => {
    expect(isDemoSourceMode('seed')).toBe(true);
    expect(isDemoSourceMode('live')).toBe(false);
    expect(trafikverketSourceNote('seed')).toMatch(/demonstracyjne/i);
    expect(trafikverketSourceNote('seed')).toMatch(/brak klucza Trafikverket/i);
    expect(trafikverketSourceNote('seed')).not.toMatch(/\blive\b/i);
    expect(trafikverketShortLabel('seed')).toBe('demonstracyjne');
    expect(DEMO_MARK_PL).toBe('DEMONSTRACYJNE');
  });

  it('live mode keeps live wording for when a key exists later', () => {
    expect(trafikverketSourceNote('live')).toBe('Trafikverket live');
    expect(trafikverketShortLabel('live')).toBe('live');
  });
});
