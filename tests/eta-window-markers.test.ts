import { describe, expect, it } from 'vitest';
import { t } from '../src/i18n/messages';
import {
  etaWindowKind,
  etaIsNightArrival,
  delayMinutesVsPlan,
} from '../src/lib/time';

/** Decyzja właściciela 05.10 B — trzy kolory + noc. */
describe('ETA znaczniki okna (B)', () => {
  const day = '2026-10-07';
  // Stockholm CEST = UTC+2 in October
  const winFrom = '2026-10-07T06:00:00+02:00';
  const winTo = '2026-10-07T16:00:00+02:00';

  it('zielony w oknie — ETA między od a do', () => {
    expect(etaWindowKind('2026-10-07T10:00:00+02:00', day, winFrom, winTo)).toBe('in_window');
  });

  it('bursztynowy przed terminem — ETA przed początkiem okna', () => {
    expect(etaWindowKind('2026-10-06T01:02:00+02:00', day, winFrom, winTo)).toBe('before');
    expect(etaWindowKind('2026-10-07T05:00:00+02:00', day, winFrom, winTo)).toBe('before');
  });

  it('czerwony po terminie — ten sam warunek co delayMinutesVsPlan', () => {
    const eta = '2026-10-07T18:00:00+02:00';
    expect(etaWindowKind(eta, day, winFrom, winTo)).toBe('after');
    expect(delayMinutesVsPlan(eta, day, winTo)).toBeGreaterThan(0);
  });

  it('bez godziny „od” — początek dnia dostawy; bez „do” — koniec dnia', () => {
    expect(etaWindowKind('2026-10-06T23:00:00+02:00', day, null, null)).toBe('before');
    expect(etaWindowKind('2026-10-07T12:00:00+02:00', day, null, null)).toBe('in_window');
    expect(etaWindowKind('2026-10-08T01:00:00+02:00', day, null, null)).toBe('after');
  });

  it('przyjazd nocą 22:00–06:00 Europe/Warsaw', () => {
    expect(etaIsNightArrival('2026-10-06T23:30:00+02:00')).toBe(true);
    expect(etaIsNightArrival('2026-10-07T01:02:00+02:00')).toBe(true);
    expect(etaIsNightArrival('2026-10-07T10:00:00+02:00')).toBe(false);
    expect(etaIsNightArrival('2026-10-07T21:59:00+02:00')).toBe(false);
  });
});

describe('ETA „Jak działa” — znaczniki B', () => {
  for (const loc of ['pl', 'en', 'sv'] as const) {
    it(`${loc}: opisuje w oknie / przed / po / noc`, () => {
      const s = t(loc, 'a6_dr_eta_howto');
      const items = s.split('|').map((x) => x.trim()).filter(Boolean);
      expect(items.length).toBeGreaterThanOrEqual(7);
      expect(t(loc, 'a6_dr_before_window')).toBeTruthy();
      expect(t(loc, 'a6_dr_after_window')).toBeTruthy();
      expect(t(loc, 'a6_dr_night_arrival')).toBeTruthy();
    });
  }
  it('pl: bez starej reguły „wcześniejszy też w oknie”', () => {
    const s = t('pl', 'a6_dr_eta_howto');
    expect(s).toContain('„przed terminem”');
    expect(s).toContain('„przyjazd nocą”');
    expect(s).toContain('bez danych z tachografu');
    expect(s).not.toContain('nie ostrzega o przyjeździe przed terminem');
  });
});
