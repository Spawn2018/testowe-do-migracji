import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** B-4a: w przychodzie nie ma wiersza „pilotaż i dodatki”. */
describe('B-4a Finanse — bez pilotażu w przychodzie', () => {
  const src = readFileSync(new URL('../src/views/FinanceView.tsx', import.meta.url), 'utf8');

  it('nie renderuje fin_rev_extra ani a6_fin_pilot po stronie przychodu (exR)', () => {
    expect(src).not.toMatch(/fin_rev_extra/);
    expect(src).not.toMatch(/\bexR\b/);
    // koszt SCX może nadal mieć a6_fin_pilot + exC — to nie przychód
    expect(src).toMatch(/a6_fin_pilot/);
    expect(src).toMatch(/\bexC\b/);
  });
});
