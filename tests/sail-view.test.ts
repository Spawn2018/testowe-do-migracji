/**
 * wyglad/P7-d — Harmonogram › Rejsy według E30 pkt 7 (makieta `makiety_html/E30/harm.html`, raport `img/e30-after`).
 * Dane rejsów wymyślone (G-09).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Sailing } from '../src/types';
import { isOutbound, lineOf, reachOf, sailDay, sailRows, sailTime, sourceKey } from '../src/lib/sailView';
import { sv } from '../src/i18n/sail7';

const NOW = '2026-10-08T05:00:00Z'; // 08.10, 07:00 czasu polskiego
const S = (p: Partial<Sailing> & Pick<Sailing, 'id' | 'route' | 'departureAt'>): Sailing => ({
  vessel: 'Wawel', arrivalAt: p.departureAt, delayedDepartureAt: null, delayedArrivalAt: null,
  status: 'ZAPLANOWANY', source: 'POLFERRIES', ...p,
});
const all: Sailing[] = [
  S({ id: 'a', route: 'GDN-NYN', vessel: 'Wawel', departureAt: '2026-10-08T16:00:00Z', arrivalAt: '2026-10-09T10:00:00Z' }),
  S({ id: 'b', route: 'GDY-KAA', vessel: 'Stena Estelle', departureAt: '2026-10-08T06:00:00Z', arrivalAt: '2026-10-08T15:45:00Z', source: 'STENA' }),
  S({ id: 'c', route: 'NYN-GDN', vessel: 'Nova Star', departureAt: '2026-10-08T17:00:00Z' }),
  S({ id: 'd', route: 'KAA-GDY', vessel: 'Stena Spirit', departureAt: '2026-10-08T19:00:00Z', source: 'STENA' }),
  S({ id: 'e', route: 'GDN-NYN', vessel: 'Nova Star', departureAt: '2026-10-07T16:00:00Z' }),
  S({ id: 'f', route: 'GDY-KAA', vessel: 'Stena Ebba', departureAt: '2026-10-18T18:00:00Z', source: 'STENA' }),
  S({ id: 'g', route: 'GDN-NYN', vessel: 'Wawel', departureAt: '2027-01-09T17:00:00Z' }),
  S({ id: 'h', route: 'GDY-KAA', vessel: 'Stena Spirit', departureAt: '2026-10-25T18:00:00Z', source: 'STENA', status: 'ODWOLANY' }),
];
const loads = [
  { code: 'SG-16', sailingId: 'a' }, { code: 'SG-15', sailingId: 'a' }, { code: 'SG-9', sailingId: 'a' },
  { code: 'T-01', sailingId: null },
];

describe('E30 pkt 7: Rejsy', () => {
  it('domyślnie przyszłe i tylko do Szwecji; od najbliższego odejścia', () => {
    const r = sailRows(all, loads, NOW, { future: true, returns: false });
    expect(r.map((x) => x.sailing.id)).toEqual(['b', 'a', 'f', 'h', 'g']);
    expect(r.every((x) => isOutbound(x.sailing.route))).toBe(true);
  });
  it('„Pokaż powroty” dokłada rejsy do Polski; bez „Przyszłe” także minione', () => {
    expect(sailRows(all, loads, NOW, { future: true, returns: true }).map((x) => x.sailing.id)).toEqual(['b', 'a', 'c', 'd', 'f', 'h', 'g']);
    const past = sailRows(all, loads, NOW, { future: false, returns: false });
    expect(past[0].sailing.id).toBe('e');
    expect(past[0].gone).toBe(true);
  });
  it('kolumna „Transporty”: kody rejsu rosnąco (SG-9 przed SG-15)', () => {
    const a = sailRows(all, loads, NOW, { future: true, returns: false }).find((x) => x.sailing.id === 'a')!;
    expect(a.codes).toEqual(['SG-9', 'SG-15', 'SG-16']);
    expect(sailRows(all, loads, NOW, { future: true, returns: false }).find((x) => x.sailing.id === 'b')!.codes).toEqual([]);
  });
  it('opóźnienie: odejście po opóźnieniu decyduje o kolejności i „Przyszłe”', () => {
    const late = S({ id: 'x', route: 'GDN-NYN', departureAt: '2026-10-08T04:00:00Z', delayedDepartureAt: '2026-10-08T06:30:00Z' });
    const r = sailRows([late, ...all], loads, NOW, { future: true, returns: false });
    expect(r[0].sailing.id).toBe('b');
    expect(r[1]).toMatchObject({ sailing: { id: 'x' }, delayed: true, dep: '2026-10-08T06:30:00Z' });
  });
  it('armator z trasy albo z operatora; źródło „Stena Line” zamiast klucza (E30: bez „sail_src_”)', () => {
    expect(lineOf({ route: 'GDY-KAA' })).toBe('STENA');
    expect(lineOf({ route: 'NYN-GDN' })).toBe('POLFERRIES');
    expect(lineOf({ route: 'GDN-NYN', operator: 'Stena Line' })).toBe('STENA');
    for (const src of ['POLFERRIES', 'STENA', 'RECZNIE', 'DANE_STARTOWE'] as const) {
      const label = sv('pl', sourceKey(src));
      expect(label).not.toMatch(/sv_src_|sail_src_/);
    }
    expect(sv('pl', sourceKey('STENA'))).toBe('Stena Line');
  });
  it('zasięg rozkładów: Stena, potem Polferries; bez odwołanych; rok zawsze (właściciel 16.10.2026)', () => {
    const r = reachOf(all);
    expect(r.map((x) => x.line)).toEqual(['STENA', 'POLFERRIES']);
    expect(sailDay(r[0].untilIso)).toBe('18.10.2026');
    expect(sailDay(r[1].untilIso)).toBe('09.01.2027');
  });
  it('godziny po polsku: „08.10.2026, 08:00” — rok zawsze, także w bieżącym roku', () => {
    expect(sailTime('2026-10-08T06:00:00Z')).toBe('08.10.2026, 08:00');
    expect(sailTime('2027-01-09T17:00:00Z')).toBe('09.01.2027, 18:00');
  });
  it('nagłówek obejmuje obie przeprawy; ekran bez starego „Rozkład Gdańsk ⇄ Nynäshamn” i bez „pokaż minione”', () => {
    expect(sv('pl', 'sv_sub')).toBe('Polska → Szwecja oraz Estonia → Finlandia i Szwecja');
    const panel = readFileSync('src/views/SailingsPanel.tsx', 'utf8');
    expect(panel).not.toMatch(/sail_sub|sail_show_past|sail_source_note|sail_src_\$/);
    expect(panel).toMatch(/data-sail-returns/);
    expect(panel).toMatch(/onShowLoads/);
    const view = readFileSync('src/views/ScheduleView.tsx', 'utf8');
    expect(view).toMatch(/sv\(locale, 'sv_sub'\)/);
    expect(view).toMatch(/l\.sailingId === sailPick/);
  });
});
