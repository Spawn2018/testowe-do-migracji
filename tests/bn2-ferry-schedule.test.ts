/**
 * BN2 (#573) — parsery rozkładów bałtyckich i Portnet (bez sieci).
 * Tallink: prawdziwa odpowiedź booking.tallink.com 30.10.2026.
 * Digitraffic Portnet: prawdziwa odpowiedź Megastar 29–30.10.2026.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseTallinkTimetable, tallinkTimetableUrl } from '../src/lib/ferry/tallink';
import { parseDigitrafficPortCalls } from '../src/lib/ferry/digitrafficPortCalls';
import { parseVikingSchedule } from '../src/lib/ferry/vikingline';
import { parseEckeroSchedule } from '../src/lib/ferry/eckero';
import { parseDfdsSchedule } from '../src/lib/ferry/dfds';

const TALLINK = JSON.parse(readFileSync(new URL('./fixtures/tallink-timetable-tal-hel-2026-10-30.json', import.meta.url), 'utf8'));
const PORTNET = JSON.parse(readFileSync(new URL('./fixtures/digitraffic-port-calls-megastar-2026-10-29.json', import.meta.url), 'utf8'));
const VIKING = JSON.parse(readFileSync(new URL('./fixtures/viking-schedule-sample.json', import.meta.url), 'utf8'));
const ECKERO = JSON.parse(readFileSync(new URL('./fixtures/eckero-schedule-sample.json', import.meta.url), 'utf8'));
const DFDS = JSON.parse(readFileSync(new URL('./fixtures/dfds-schedule-sample.json', import.meta.url), 'utf8'));

describe('BN2 Tallink timetable', () => {
  it('buduje URL z zakresem dat', () => {
    expect(tallinkTimetableUrl({
      from: 'tal', to: 'hel', dateFrom: '2026-10-30', dateTo: '2026-11-12',
    })).toMatch(/booking\.tallink\.com\/api\/timetables/);
  });

  it('odczytuje rejsy TAL→HEL Terminal D (MyStar/Megastar/Victoria)', () => {
    const r = parseTallinkTimetable(TALLINK);
    expect(r.sailings.length).toBeGreaterThan(0);
    expect(r.sailings.every((s) => s.route === 'TLL-HEL')).toBe(true);
    expect(r.sailings.every((s) => /^D/i.test(s.pierFrom))).toBe(true);
    const names = new Set(r.sailings.map((s) => s.vessel));
    expect(names.has('M/F Megastar') || names.has('M/F MyStar') || names.has('M/F Victoria I')).toBe(true);
  });

  it('07:30 Tallinn → 09:30 Helsinki = UTC z Europe/Tallinn/Helsinki', () => {
    const r = parseTallinkTimetable(TALLINK);
    const s = r.sailings.find((x) => x.shipCode === 'MYSTAR' && x.departureUtc.startsWith('2026-10-30'));
    expect(s).toBeTruthy();
    // Po zmianie czasu (ost. niedziela X): EET UTC+2 — 07:30 → 05:30Z, 09:30 → 07:30Z
    expect(s!.departureUtc).toBe('2026-10-30T05:30:00.000Z');
    expect(s!.arrivalUtc).toBe('2026-10-30T07:30:00.000Z');
  });

  it('zła struktura → ostrzeżenie, 0 rejsów', () => {
    const r = parseTallinkTimetable({ foo: 1 });
    expect(r.sailings).toEqual([]);
    expect(r.warnings.join(' ')).toMatch(/Struktura|trips/);
  });
});

describe('BN2 Digitraffic Portnet', () => {
  it('Megastar FIHEL: ATA z EETLL → TLL-HEL, ATD → HEL-TLL', () => {
    const r = parseDigitrafficPortCalls(PORTNET);
    expect(r.warnings).toEqual([]);
    expect(r.calls.length).toBeGreaterThan(0);
    const c = r.calls[0]!;
    expect(c.vessel).toBe('M/F Megastar');
    expect(c.arrivalRoute).toBe('TLL-HEL');
    expect(c.departureRoute).toBe('HEL-TLL');
    expect(c.actualArrivalUtc).toBe('2026-10-29T16:30:00.000Z');
    expect(c.actualDepartureUtc).toBe('2026-10-29T17:15:00.000Z');
  });

  it('zła struktura → ostrzeżenie', () => {
    const r = parseDigitrafficPortCalls({});
    expect(r.calls).toEqual([]);
    expect(r.warnings.join(' ')).toMatch(/Struktura|portCalls/);
  });
});

describe('BN2 Viking / Eckerö / DFDS (fixture znormalizowany)', () => {
  it('Viking XPRS TLLA-HEL / HELA-TLL', () => {
    const r = parseVikingSchedule(VIKING);
    expect(r.warnings).toEqual([]);
    expect(r.sailings.map((s) => s.route).sort()).toEqual(['HELA-TLL', 'TLLA-HEL']);
    expect(r.sailings.every((s) => s.vessel === 'M/F Viking XPRS')).toBe(true);
  });

  it('Eckerö Finlandia + Finbo Cargo', () => {
    const r = parseEckeroSchedule(ECKERO);
    expect(r.warnings).toEqual([]);
    expect(r.sailings.some((s) => s.route === 'TLLA-HEL' && s.vessel === 'M/F Finlandia')).toBe(true);
    expect(r.sailings.some((s) => s.route === 'MUU-VUO' && s.vessel === 'M/F Finbo Cargo')).toBe(true);
  });

  it('DFDS Sirena PLD-KPS / KPS-PLD', () => {
    const r = parseDfdsSchedule(DFDS);
    expect(r.warnings).toEqual([]);
    expect(r.sailings.map((s) => s.route).sort()).toEqual(['KPS-PLD', 'PLD-KPS']);
  });
});
