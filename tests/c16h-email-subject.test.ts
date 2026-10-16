import { describe, expect, it } from 'vitest';
import { renderNotice } from '../supabase/functions/_shared/notifyTemplates';

/** C16-H H5 (D-20261016-0100-01): temat e-maila RISK_OPEN po polsku, nie kod szablonu. */
describe('C16-H temat RISK_OPEN (send-notifications / notifyTemplates)', () => {
  it('pl: Nowe ryzyko: … — bez kodu RISK_OPEN', () => {
    const n = renderNotice(
      { template: 'RISK_OPEN', payload: { title: 'Warunki drogowe E4: wypadek', severity: 'HIGH', locale: 'pl' } },
      'pl',
    );
    expect(n.subject).toBe('Nowe ryzyko: Warunki drogowe E4: wypadek');
    expect(n.subject).not.toBe('RISK_OPEN');
    expect(n.subject).not.toMatch(/^RISK_/);
  });
});
