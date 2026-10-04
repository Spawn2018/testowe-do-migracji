import { describe, expect, it } from 'vitest';
import { nearestCrossingSailings } from '../src/lib/sailings';
import type { Sailing } from '../src/types';

const NOW = Date.parse('2026-10-04T18:00:00Z');

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

describe('L-9: alternatywy rejsu z rozkładu', () => {
  it('bierze najbliższe Polferries i Stenę, pomija odwołane, przeszłe i dane startowe', () => {
    const all = [
      S({ id: 'pf-old', route: 'GDN-NYN', departureAt: '2026-10-04T10:00:00Z' }),
      S({ id: 'pf-x', route: 'GDN-NYN', departureAt: '2026-10-05T16:00:00Z', status: 'ODWOLANY' }),
      S({ id: 'pf-2', route: 'GDN-NYN', departureAt: '2026-10-06T16:00:00Z' }),
      S({ id: 'pf-1', route: 'GDN-NYN', departureAt: '2026-10-05T16:00:00Z', status: 'OPOZNIONY', delayedDepartureAt: '2026-10-05T18:00:00Z' }),
      S({ id: 'pf-back', route: 'NYN-GDN', departureAt: '2026-10-05T20:00:00Z' }),
      S({ id: 'seed', route: 'GDN-NYN', departureAt: '2026-10-05T12:00:00Z', source: 'DANE_STARTOWE' }),
      S({ id: 'st-1', route: 'GDY-KAA', departureAt: '2026-10-05T21:00:00Z', source: 'STENA', operator: 'Stena Line', vessel: 'Stena Spirit' }),
      S({ id: 'st-back', route: 'KAA-GDY', departureAt: '2026-10-06T08:00:00Z', source: 'STENA', operator: 'Stena Line' }),
      S({ id: 'tt', route: 'GDN-NYN', departureAt: '2026-10-05T15:00:00Z', source: 'RECZNIE', operator: 'TT-Line', vessel: 'Zmyślony' }),
    ];
    const got = nearestCrossingSailings(all, NOW);
    expect(got.polferries.map((s) => s.id)).toEqual(['pf-1', 'pf-2']);
    expect(got.stena.map((s) => s.id)).toEqual(['st-1']);
  });

  it('brak rozkładu armatora daje pustą listę, nie zmyślony rejs', () => {
    const onlyPol = [S({ id: 'pf', route: 'GDN-NYN', departureAt: '2026-10-05T16:00:00Z' })];
    expect(nearestCrossingSailings(onlyPol, NOW).stena).toEqual([]);
    expect(nearestCrossingSailings([], NOW)).toEqual({ polferries: [], stena: [] });
  });

  it('pokazuje co najwyżej trzy najbliższe odejścia', () => {
    const many = [1, 2, 3, 4].map((n) =>
      S({ id: `s${n}`, route: 'GDY-KAA', departureAt: `2026-10-0${n + 4}T20:00:00Z`, source: 'STENA', operator: 'Stena Line' }),
    );
    expect(nearestCrossingSailings(many, NOW).stena.map((s) => s.id)).toEqual(['s1', 's2', 's3']);
    expect(nearestCrossingSailings(many, NOW).polferries).toEqual([]);
  });

  it('ręczny wpis na trasie armatora wchodzi, gdy nie jest danymi startowymi', () => {
    const manual = S({
      id: 'm',
      route: 'GDY-KAA',
      departureAt: '2026-10-07T18:00:00Z',
      source: 'RECZNIE',
      operator: 'Stena Line',
    });
    expect(nearestCrossingSailings([manual], NOW).stena.map((s) => s.id)).toEqual(['m']);
  });
});
