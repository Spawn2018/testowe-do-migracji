/**
 * BN2 (#573) — parsery rozkładów bałtyckich i Portnet (bez sieci).
 * Tallink: prawdziwa odpowiedź booking.tallink.com 30.10.2026.
 * Digitraffic Portnet: prawdziwa odpowiedź Megastar 29–30.10.2026.
 * Port of Tallinn / Ports of Stockholm: próbki z 30.10.2026.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseTallinkTimetable, tallinkTimetableUrl } from '../src/lib/ferry/tallink';
import { parseDigitrafficPortCalls } from '../src/lib/ferry/digitrafficPortCalls';
import { parseVikingSchedule, parseVikingTimetableHtml } from '../src/lib/ferry/vikingline';
import { parseEckeroSchedule, parseEckeroTimetableHtml } from '../src/lib/ferry/eckero';
import { parseDfdsSchedule, parseDfdsWeeklyHtml } from '../src/lib/ferry/dfds';
import { parsePortTallinnHtml, portTallinnToSailings } from '../src/lib/ferry/portTallinn';
import { parsePortsStockholmPortEntry, portsStockholmToSailings } from '../src/lib/ferry/portsStockholm';

const TALLINK = JSON.parse(readFileSync(new URL('./fixtures/tallink-timetable-tal-hel-2026-10-30.json', import.meta.url), 'utf8'));
const PORTNET = JSON.parse(readFileSync(new URL('./fixtures/digitraffic-port-calls-megastar-2026-10-29.json', import.meta.url), 'utf8'));
const VIKING = JSON.parse(readFileSync(new URL('./fixtures/viking-schedule-sample.json', import.meta.url), 'utf8'));
const ECKERO = JSON.parse(readFileSync(new URL('./fixtures/eckero-schedule-sample.json', import.meta.url), 'utf8'));
const DFDS = JSON.parse(readFileSync(new URL('./fixtures/dfds-schedule-sample.json', import.meta.url), 'utf8'));
const PORT_TLL = readFileSync(new URL('./fixtures/port-tallinn-departures-arrivals-sample.html', import.meta.url), 'utf8');
const PORT_STO = JSON.parse(readFileSync(new URL('./fixtures/ports-stockholm-portentry-sample.json', import.meta.url), 'utf8'));
const VIKING_HTML = readFileSync(new URL('./fixtures/viking-timetable-helsinki-tallinn-sample.html', import.meta.url), 'utf8');
const ECKERO_HTML = readFileSync(new URL('./fixtures/eckero-timetable-finlandia-finbo-sample.html', import.meta.url), 'utf8');
const DFDS_HTML = readFileSync(new URL('./fixtures/dfds-weekly-paldiski-kapellskar-sample.html', import.meta.url), 'utf8');

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

  it('HEL→TAL: pierFrom LSA2 + pierTo DTER → HEL-TLL (Terminal D po stronie Tallinna)', () => {
    const r = parseTallinkTimetable({
      trips: {
        '2026-10-30': {
          outwards: [{
            cityFrom: 'HEL', cityTo: 'TAL', pierFrom: 'LSA2', pierTo: 'DTER',
            shipCode: 'MEGASTAR', departureIsoDate: '2026-10-30T07:30', arrivalIsoDate: '2026-10-30T09:30',
          }],
        },
      },
    });
    expect(r.sailings).toHaveLength(1);
    expect(r.sailings[0]!.route).toBe('HEL-TLL');
    expect(r.sailings[0]!.vessel).toBe('M/F Megastar');
  });

  it('shipCode QUEEN (TLL↔STO) → M/F Baltic Queen', () => {
    const r = parseTallinkTimetable({
      trips: {
        '2026-10-31': {
          outwards: [{
            cityFrom: 'TAL', cityTo: 'STO', pierFrom: 'DTER', pierTo: 'VHAM',
            shipCode: 'QUEEN', departureIsoDate: '2026-10-31T18:00', arrivalIsoDate: '2026-11-01T10:00',
          }],
        },
      },
    });
    expect(r.sailings).toHaveLength(1);
    expect(r.sailings[0]!.route).toBe('TLL-STO');
    expect(r.sailings[0]!.vessel).toBe('M/F Baltic Queen');
    expect(r.sailings[0]!.shipCode).toBe('QUEEN');
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

describe('BN2 Viking / Eckerö / DFDS HTML tygodniowy → 14 dni', () => {
  it('Viking HTML: Fri 10:30 HEL→TLL i 14-dniowy zakres', () => {
    const r = parseVikingTimetableHtml(VIKING_HTML, { fromYmd: '2026-10-30', days: 14 });
    expect(r.warnings.filter((w) => /Struktura|pusta|zablokowana/i.test(w))).toEqual([]);
    expect(r.sailings.length).toBeGreaterThan(10);
    expect(r.sailings.every((s) => s.route === 'TLLA-HEL' || s.route === 'HELA-TLL')).toBe(true);
    // 30.10.2026 = piątek → HELA-TLL 07:45 / 14:15
    expect(r.sailings.some((s) =>
      s.route === 'HELA-TLL' && s.departureUtc.startsWith('2026-10-30') && s.vessel === 'M/F Viking XPRS'
    )).toBe(true);
  });

  it('Eckerö HTML: Finlandia TLLA-HEL 06:00 Mon-Sat + Finbo', () => {
    const r = parseEckeroTimetableHtml(ECKERO_HTML, { fromYmd: '2026-10-30', days: 7 });
    expect(r.sailings.some((s) => s.vessel === 'M/F Finlandia' && s.route === 'TLLA-HEL')).toBe(true);
    expect(r.sailings.some((s) => s.vessel === 'M/F Finlandia' && s.route === 'HELA-TLL')).toBe(true);
    expect(r.sailings.some((s) => s.vessel === 'M/F Finbo Cargo')).toBe(true);
  });

  it('DFDS HTML: PLD 22:00 Mon + KPS 09:30', () => {
    const r = parseDfdsWeeklyHtml(DFDS_HTML, { fromYmd: '2026-10-26', days: 7 }); // poniedziałek
    expect(r.warnings.filter((w) => /Struktura/i.test(w))).toEqual([]);
    expect(r.sailings.some((s) => s.route === 'PLD-KPS' && s.departureUtc.startsWith('2026-10-26'))).toBe(true);
    expect(r.sailings.some((s) => s.route === 'KPS-PLD' && s.departureUtc.startsWith('2026-10-26'))).toBe(true);
  });
});

describe('BN2 Port of Tallinn HTML', () => {
  it('odczytuje odjazdy Terminal A/D i Muuga HHLA', () => {
    const r = parsePortTallinnHtml(PORT_TLL, '2026-10-30');
    expect(r.events.length).toBeGreaterThan(0);
    expect(r.events.some((e) => e.vessel === 'M/F Viking XPRS' && e.route === 'TLLA-HEL')).toBe(true);
    expect(r.events.some((e) => e.vessel === 'M/F MyStar' && e.route === 'TLL-HEL')).toBe(true);
    expect(r.events.some((e) => e.vessel === 'M/F Finbo Cargo' && e.route === 'MUU-VUO')).toBe(true);
    // F7 r2: job nie używa toSailings (zmyślony crossing); helper tylko do sprawdzenia parsera.
    expect(portTallinnToSailings(r.events).length).toBeGreaterThan(0);
  });

  it('przyjazdy Helsinki → Tallinn A/D', () => {
    const r = parsePortTallinnHtml(PORT_TLL, '2026-10-30');
    expect(r.events.some((e) => e.kind === 'ARRIVAL' && e.route === 'HELA-TLL')).toBe(true);
  });

  it('zła struktura → ostrzeżenie', () => {
    const r = parsePortTallinnHtml('<html></html>', '2026-10-30');
    expect(r.events).toEqual([]);
    expect(r.warnings.join(' ')).toMatch(/brak tabeli|struktura/i);
  });
});

describe('BN2 Ports of Stockholm portentry', () => {
  it('Sirena Kapellskär → PLD-KPS / KPS-PLD + actual_*', () => {
    const r = parsePortsStockholmPortEntry(PORT_STO);
    expect(r.warnings).toEqual([]);
    expect(r.calls.some((c) => c.vessel === 'M/F Sirena Seaways' && c.arrivalRoute === 'PLD-KPS')).toBe(true);
    expect(r.calls.some((c) => c.actualArrivalUtc && c.actualDepartureUtc)).toBe(true);
    // F7 r2: job nie tworzy rozkładu z Stockholm — tylko actual_* na istniejących.
    expect(portsStockholmToSailings(r.calls).some((s) => s.route === 'PLD-KPS' || s.route === 'KPS-PLD')).toBe(true);
  });

  it('Baltic Queen Värtahamnen → TLL-STO / STO-TLL', () => {
    const r = parsePortsStockholmPortEntry(PORT_STO);
    expect(r.calls.some((c) => c.vessel === 'M/F Baltic Queen' && c.arrivalRoute === 'TLL-STO')).toBe(true);
  });

  it('zła struktura → ostrzeżenie', () => {
    const r = parsePortsStockholmPortEntry({});
    expect(r.calls).toEqual([]);
    expect(r.warnings.join(' ')).toMatch(/Struktura|items/);
  });
});
