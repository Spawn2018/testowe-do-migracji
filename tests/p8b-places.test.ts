/**
 * wyglad/P8-b (E42, img/e42-after): SMS przy miejscach — rodzaje A–D (B tylko Boden), transporty, których dotyczy brak
 * odbiorców, numery w pełnej postaci (15.10, 03:12), kierunkowy PL / SE, prawa (Operacje HHL — podgląd), produkcja bez źródła.
 */
import { describe, expect, it, vi } from 'vitest';
import {
  LEAD_MIN, QUIET, WAIT_KM, WAIT_MIN, affectedLoads, kindsFor, nationalText, parsePhone, personFromUser, personPhone, personSummary,
  samePhone,
} from '../src/lib/p8bPlaces';
import { P8B_PL } from '../src/i18n/p8b';
import type { Load } from '../src/types';

const L = (code: string, status: Load['status'], plannedLoadDate: string) =>
  ({ code, status, stage: undefined, plannedLoadDate }) as unknown as Load;

describe('rodzaje i warunki (E42)', () => {
  it('B (wcześniejszy przyjazd) tylko Boden; stałe 60 min, 30 min / 2 km, cisza 20:00–06:00', () => {
    expect(kindsFor('LOAD_SREM')).toEqual(['A', 'C', 'D']);
    expect(kindsFor('UNLOAD_BODEN')).toEqual(['A', 'B', 'C', 'D']);
    expect([LEAD_MIN, WAIT_MIN, WAIT_KM]).toEqual([60, 30, 2]);
    expect(QUIET).toEqual({ from: '20:00', to: '06:00' });
  });
});

describe('kogo dotyczy brak odbiorców', () => {
  const now = '2026-10-15T10:00:00Z';
  const loads = [
    L('XX-01', 'IN_TRANSIT_SE', '2026-10-12'),
    L('XX-02', 'PLANNED', '2026-10-15'),
    L('XX-03', 'PLANNED', '2026-10-20'),
    L('XX-04', 'DELIVERED', '2026-10-10'),
    L('XX-05', 'CANCELLED', '2026-10-15'),
    L('XX-06', 'IN_TRANSIT_PL', '2026-10-14'),
    L('XX-07', 'ON_FERRY', '2026-10-13'),
  ];
  it('Boden — od promu (SMS do Boden dopiero po promie, E42 pkt A i B)', () => {
    expect(affectedLoads('UNLOAD_BODEN', loads, now).map((l) => l.code)).toEqual(['XX-01', 'XX-07']);
  });
  it('Śrem — tylko przed wyjazdem z załadunku', () => {
    expect(affectedLoads('LOAD_SREM', loads, now).map((l) => l.code)).toEqual(['XX-02']);
  });
});

describe('numery', () => {
  it('pełny numer z kierunkowym (bez ukrywania)', () => {
    expect(personPhone({ country: 'PL', phone: '000000010' })).toBe('+48 000 000 010');
    expect(personPhone({ country: 'SE', phone: '0700000000' })).toBe('+46 700 000 000');
  });
  it('numer z pola: kierunkowy z wyboru obok, a wpisany +46 / +48 wygrywa; PL 9 cyfr, SE z zerem, 9–10 cyfr', () => {
    expect(parsePhone('+46 70 000 00 00', 'PL')).toEqual({ country: 'SE', phone: '0700000000' });
    expect(parsePhone('600 000 907', 'PL')).toEqual({ country: 'PL', phone: '600000907' });
    expect(parsePhone('600 000 907', 'SE')).toEqual({ country: 'SE', phone: '0600000907' });
    expect(parsePhone('070 000 00 00', 'SE')).toEqual({ country: 'SE', phone: '0700000000' });
    expect(parsePhone('1234567', 'PL')).toBeNull();
    expect(parsePhone('0701234567', 'PL')).toBeNull();
    expect(parsePhone('+1 555 000 000', 'PL')).toBeNull();
    expect(parsePhone('12', 'PL')).toBeNull();
  });
  it('w polu numer krajowy bez kierunkowego (kierunkowy jest w wyborze obok)', () => {
    expect(nationalText({ country: 'PL', phone: '600000907' })).toBe('600 000 907');
    expect(nationalText({ country: 'SE', phone: '0700000000' })).toBe('070 000 00 00');
    expect(samePhone({ country: 'PL', phone: '600000907' }, { country: 'PL', phone: '600000907' })).toBe(true);
    expect(samePhone({ country: 'PL', phone: '600000907' }, { country: 'SE', phone: '600000907' })).toBe(false);
  });
  it('osoba z konta: imię i telefon z E6; konto bez telefonu — null', () => {
    const p = personFromUser({ id: 'u1', name: 'Anna Nowak', phone: '+48 000 000 021' }, ['A', 'C']);
    expect(p).toEqual({ userId: 'u1', name: 'Anna Nowak', country: 'PL', phone: '000000021', kinds: ['A', 'C'] });
    expect(personFromUser({ id: 'u2', name: 'Bez telefonu', phone: null }, ['A'])).toBeNull();
    expect(personSummary(p!)).toBe('Anna Nowak · +48 000 000 021 · A, C');
  });
});

describe('teksty', () => {
  it('bez wyboru języka (E43, 22:42) i bez „sms:” / „mailto:” w tekstach (I-2)', () => {
    const all = Object.values(P8B_PL).join('\n');
    expect(all).not.toMatch(/język|SE\s*\/\s*PL|PL\s*\/\s*SE/i);
    expect(all.toLowerCase()).not.toContain('sms:');
    expect(all.toLowerCase()).not.toContain('mailto:');
  });
});

describe('ekran — prawa', () => {
  it('Administrator HHL: wybór osoby, numer, rodzaje A–D, przełącznik wysyłki; Śrem bez B; osoba spoza wczytanej listy kont zostaje w wyborze', async () => {
    const { renderToStaticMarkup } = await import('react-dom/server');
    const { createElement } = await import('react');
    const { SmsPlaces } = await import('../src/components/options/SmsPlaces');
    const html = renderToStaticMarkup(createElement(SmsPlaces, { readOnly: false }));
    expect(html).toContain('data-sp-send-btn');
    expect(html).toContain('data-sp-pick="UNLOAD_BODEN:1"');
    expect(html).toMatch(/data-sp-kind="LOAD_SREM:1:B"[^>]*disabled|disabled[^>]*data-sp-kind="LOAD_SREM:1:B"/);
    expect(html).toContain(P8B_PL.p8b_send_off.replace('{to}', '+48 000 000 010'));
    expect(html).toContain('data-sp-warn');
    /* lista kont jeszcze się nie wczytała — zapisana osoba z Śremu (pozycja 1) nadal widoczna */
    expect(html).toContain('data-sp-name="LOAD_SREM:1"');
    expect(html).toMatch(/aria-label="Załadunek[^"]*|aria-label="KSH Śrem/);
  });

  it('Operacje HHL: podgląd — pola zablokowane, bez przełącznika i bez „Usuń osobę”', async () => {
    const { renderToStaticMarkup } = await import('react-dom/server');
    const { createElement } = await import('react');
    const { SmsPlaces } = await import('../src/components/options/SmsPlaces');
    const html = renderToStaticMarkup(createElement(SmsPlaces, { readOnly: true }));
    expect(html).toContain('data-sp-ro');
    expect(html).not.toContain('data-sp-send-btn');
    expect(html).not.toContain('data-sp-del');
    const picks = html.match(/<select[^>]*data-sp-pick[^>]*>/g) ?? [];
    expect(picks.length).toBeGreaterThan(0);
    for (const s of picks) expect(s).toContain('disabled');
  });

  it('produkcja przed podłączeniem: ekran E42 nie zastępuje dzisiejszych formularzy', async () => {
    vi.stubEnv('VITE_AUTH_MODE', 'supabase');
    try {
      const { smsPlacesOf, smsPlacesReady } = await import('../src/lib/p8bSource');
      expect(smsPlacesOf()).toBeNull();
      expect(smsPlacesReady()).toBe(false);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
