import { describe, expect, it } from 'vitest';
import { upcomingOutboundSailings } from '../src/lib/sailings';
import type { Sailing } from '../src/types';

const NOW = Date.parse('2026-10-05T12:00:00Z');

function S(p: Partial<Sailing> & Pick<Sailing, 'id' | 'route' | 'departureAt'>): Sailing {
  return {
    vessel: 'Statek',
    arrivalAt: p.departureAt,
    delayedDepartureAt: null,
    delayedArrivalAt: null,
    status: 'ZAPLANOWANY',
    source: 'POLFERRIES',
    ...p,
  };
}

describe('B-2a: wypłynięcia Steny w Ryzykach', () => {
  it('pokazuje Polferries i Stenę (GDY–KAA), z lookback 3 h', () => {
    const all = [
      S({ id: 'pf-old', route: 'GDN-NYN', departureAt: '2026-10-05T08:00:00Z' }), // >3h wstecz
      S({ id: 'pf-1', route: 'GDN-NYN', departureAt: '2026-10-05T14:00:00Z' }),
      S({ id: 'st-1', route: 'GDY-KAA', departureAt: '2026-10-05T15:00:00Z', source: 'STENA', operator: 'Stena Line', vessel: 'Stena Spirit' }),
      S({ id: 'st-back', route: 'KAA-GDY', departureAt: '2026-10-05T18:00:00Z', source: 'STENA', operator: 'Stena Line' }),
      S({ id: 'st-2', route: 'GDY-KAA', departureAt: '2026-10-05T21:00:00Z', source: 'STENA', operator: 'Stena Line', vessel: 'Stena Estelle' }),
    ];
    const got = upcomingOutboundSailings(all, NOW);
    expect(got.polferries.map((s) => s.id)).toEqual(['pf-1']);
    expect(got.stena.map((s) => s.id)).toEqual(['st-1', 'st-2']);
  });

  it('brak rozkładu Steny: pusta lista stena, nie zmyślone rejsy', () => {
    const onlyPol = [S({ id: 'pf', route: 'GDN-NYN', departureAt: '2026-10-05T14:00:00Z' })];
    expect(upcomingOutboundSailings(onlyPol, NOW).stena).toEqual([]);
    expect(upcomingOutboundSailings(onlyPol, NOW).polferries.map((s) => s.id)).toEqual(['pf']);
  });
});
