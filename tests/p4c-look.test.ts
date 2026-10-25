/**
 * wyglad/P4-c — teksty wyglądu z danych od wykonawcy: pole „Link śledzenia” (E44 pkt 1, 5, 6, 8),
 * „Gotowy” (L6, L9, L29), opis lokalizatora w pasku śledzenia; przykłady demo nie trafiają do produkcji (strażnik I-0).
 * Rejestracje i identyfikatory zmyślone (G-09, G-17).
 */
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TrackingLinkField } from '../src/components/drawer/TrackingLinkField';
import { deliveryRefMs, readyGapsText, trackerBarRio, trackingLinkNotes, trackingStartMs } from '../src/lib/p4c';
import type { Load, TrackingLinkInfo } from '../src/types';

const load = { plannedLoadDate: '2026-10-05', plannedDeliverDate: '2026-10-07', planDates: undefined } as unknown as Pick<Load, 'plannedLoadDate' | 'plannedDeliverDate' | 'planDates'>;
const NOW = '2026-10-04T10:00:00Z';

describe('E44 — pod polem „Link śledzenia”', () => {
  it('działa: rejestracja, ważność, ostatnia pozycja; lokalizator w naczepie', () => {
    const info: TrackingLinkInfo = { provider: 'RIO', asset: 'TST 0001', validFrom: '2026-10-05T01:00:00Z', validTo: '2026-10-08T04:00:00Z', trackerOn: 'NACZEPA', check: { state: 'ok', lastFixAt: '2026-10-04T09:56:00Z' } };
    const v = trackingLinkNotes(info, load, NOW, 'pl');
    expect(v.check).toEqual({ key: 'ok', tone: 'ok', text: 'Link RIO działa · TST 0001 · ważny do 08.10.2026, 06:00 · ostatnia pozycja 11:56' });
    expect(v.tracker).toBe('Lokalizator: naczepa TST 0001 (RIO)');
    expect(v.notes).toEqual([]);
  });
  it('J-10: stara pozycja przy „działa” — data i ton ostrzegawczy po 12 h; wczoraj bez ostrzeżenia z datą', () => {
    const old: TrackingLinkInfo = { provider: 'RIO', asset: 'TST 0001', validFrom: '2026-10-01T01:00:00Z', validTo: '2026-10-08T04:00:00Z', trackerOn: 'NACZEPA', check: { state: 'ok', lastFixAt: '2026-10-02T12:05:00Z' } };
    const v = trackingLinkNotes(old, load, NOW, 'pl');
    expect(v.check?.tone).toBe('warn');
    expect(v.check?.text).toBe('Link RIO działa · TST 0001 · ważny do 08.10.2026, 06:00 · ostatnia pozycja 02.10.2026, 14:05 — ponad 12\u00a0h temu. Sprawdź link u przewoźnika.');
    const night: TrackingLinkInfo = { ...old, check: { state: 'ok', lastFixAt: '2026-10-03T20:00:00Z' } };
    const n = trackingLinkNotes(night, load, '2026-10-04T05:00:00Z', 'pl');
    expect(n.check?.tone).toBe('ok');
    expect(n.check?.text).toContain('ostatnia pozycja 03.10.2026, 22:00');
    const future: TrackingLinkInfo = { ...old, validFrom: '2026-10-05T01:00:00Z' };
    expect(trackingLinkNotes(future, load, NOW, 'pl').check?.tone).toBe('ok');
  });
  it('ostrzeżenia: wygasa przed dostawą, zacznie nadawać po 03:00, użyty przy innym transporcie, pojazd spoza awizacji', () => {
    const info: TrackingLinkInfo = { provider: 'RIO', asset: 'TST 0002', validFrom: '2026-10-05T08:00:00Z', validTo: '2026-10-07T04:00:00Z', trackerOn: 'NIEZNANY', usedBy: ['K-01 · SCX-26-0001'], check: { state: 'ok' } };
    const v = trackingLinkNotes(info, load, NOW, 'pl');
    expect(v.notes.map((n) => n.key)).toEqual(['used-by', 'unknown-asset', 'expires-early', 'starts-late']);
    expect(v.notes.find((n) => n.key === 'expires-early')?.text).toBe('Link wygasa 07.10.2026, 06:00, przed dostawą 07.10.2026. Poproś przewoźnika o nowy link.');
    expect(v.notes.find((n) => n.key === 'starts-late')?.text).toBe('Link RIO zacznie nadawać 05.10.2026, 10:00.');
    expect(v.tracker).toBeNull();
  });
  it('błąd, brak odpowiedzi, sprawdzanie; wygasły link zastępuje wynik', () => {
    expect(trackingLinkNotes({ provider: 'RIO', check: { state: 'invalid' } }, load, NOW, 'pl').check?.tone).toBe('bad');
    expect(trackingLinkNotes({ provider: 'RIO', check: { state: 'down' } }, load, NOW, 'pl').check?.tone).toBe('warn');
    expect(trackingLinkNotes({ provider: 'RIO', check: { state: 'pending' } }, load, NOW, 'pl').check?.text).toBe('Sprawdzam link RIO…');
    const exp = trackingLinkNotes({ provider: 'RIO', asset: 'TST 0003', validTo: '2026-10-04T08:00:00Z', check: { state: 'ok' } }, load, NOW, 'pl');
    expect(exp.check?.key).toBe('expired');
    expect(exp.check?.text).toContain('wygasł 04.10.2026, 10:00');
  });
  it('pasek śledzenia: pojazd z lokalizatorem, start linku; bez danych z serwera — opis P4-b', () => {
    expect(trackerBarRio({ provider: 'RIO', asset: 'TST 0001', trackerOn: 'CIAGNIK_PL' }, NOW, 'pl')).toBe('Lokalizator: ciągnik TST 0001 · RIO');
    expect(trackerBarRio({ provider: 'RIO', asset: 'TST 0001', trackerOn: 'NACZEPA', validFrom: '2026-10-05T08:00:00Z' }, NOW, 'pl'))
      .toBe('Lokalizator: naczepa TST 0001 · RIO · Link RIO zacznie nadawać 05.10.2026, 10:00');
    expect(trackerBarRio(null, NOW, 'pl')).toBeNull();
    expect(trackerBarRio({ provider: 'EMTRACK' }, NOW, 'pl')).toBeNull();
  });
  it('okno śledzenia od 03:00 w dniu załadunku; dostawa do końca dnia albo do godziny z okna KSH; czas zimowy po 25.10', () => {
    expect(new Date(trackingStartMs(load)).toISOString()).toBe('2026-10-05T01:00:00.000Z');
    const winter = { plannedLoadDate: '2026-11-03', plannedDeliverDate: '2026-11-06', planDates: undefined } as unknown as typeof load;
    expect(new Date(trackingStartMs(winter)).toISOString()).toBe('2026-11-03T02:00:00.000Z');
    expect(new Date(deliveryRefMs(winter)).toISOString()).toBe('2026-11-06T22:59:00.000Z');
    expect(new Date(deliveryRefMs(load)).toISOString()).toBe('2026-10-07T21:59:00.000Z');
    const withTo = { ...load, planDates: { deliveryTo: '2026-10-07T12:00:00+02:00' } } as unknown as typeof load;
    expect(new Date(deliveryRefMs(withTo)).toISOString()).toBe('2026-10-07T10:00:00.000Z');
  });
});

describe('L6, L9, L29 — „Gotowy”: czego brakuje i kto uzupełnia', () => {
  it('jedna firma', () => {
    expect(readyGapsText([{ kind: 'AWIZ', items: ['naczepa', 'telefon'], who: 'SCX' }, { kind: 'PERMIT', items: ['SE'], who: 'SCX' }], 'pl'))
      .toEqual({ list: 'awizacja (naczepa, telefon) · zezwolenie SE', who: 'Scandinavian Express' });
  });
  it('dwie firmy — co która', () => {
    const r = readyGapsText([
      { kind: 'PILOTS', items: ['pilot SE — imię i nazwisko'], who: 'SCX' },
      { kind: 'ORDER_HHL', who: 'HHL' },
      { kind: 'ORDER_SCX', who: 'SCX' },
    ], 'pl');
    expect(r.list).toBe('piloci (pilot SE — imię i nazwisko) · nr zlecenia HHL · nr zlecenia SCX');
    expect(r.who).toBe('Scandinavian Express (piloci, nr zlecenia SCX) i H&H Logistics (nr zlecenia HHL)');
  });
});

describe('I-0 — przykłady P4-c tylko w demo', () => {
  it('p4cSource woła przykłady wyłącznie za warunkiem trybu demo wpisanym wprost', () => {
    const src = readFileSync(new URL('../src/lib/p4cSource.ts', import.meta.url), 'utf8');
    const calls = src.match(/demo[A-Z]\w+\(/g) ?? [];
    const guarded = src.match(/import\.meta\.env\.VITE_AUTH_MODE !== 'supabase' \? demo[A-Z]\w+\(/g) ?? [];
    expect(calls.length).toBeGreaterThan(0);
    expect(guarded.length).toBe(calls.length);
  });
  it('klucz linku RIO nie trafia do widoku: zapisany link (z danymi z serwera i bez nich, także „rio:”) → „RIO · … · ••••”', () => {
    const FAKE = 'zmyslony-unit';
    const url = `https://public.position-sharing.rio.cloud/?id=00000000-0000-0000-0000-000000000000&secret=${FAKE}`;
    const render = (savedRef: string, info: TrackingLinkInfo | null) => renderToStaticMarkup(createElement(TrackingLinkField, {
      value: savedRef, onChange: () => {}, savedRef, info, load, locale: 'pl', nowIso: NOW,
    }));
    for (const [ref, info] of [[url, null], [url, { provider: 'RIO', asset: 'TST 0001', check: { state: 'ok' } }], [`rio:${FAKE}`, null]] as const) {
      const html = render(ref, info as TrackingLinkInfo | null);
      expect(html).toContain('data-tl-chip');
      expect(html).not.toContain(FAKE);
    }
    /* emtrack i inne adresy — jak dziś, w polu */
    expect(render('https://emtrack.eu/app/', null)).toContain('value="https://emtrack.eu/app/"');
  });
});
