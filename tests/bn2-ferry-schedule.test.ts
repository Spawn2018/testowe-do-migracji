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
import {
  parseVikingSchedule, parseVikingTimetableHtml, parseVikingPlannedChanges,
} from '../src/lib/ferry/vikingline';
import { parseEckeroSchedule, parseEckeroTimetableHtml } from '../src/lib/ferry/eckero';
import {
  extractDfdsSeasonalPdfUrl, filterDfdsFallbackToFailedWeeks, mergeDfdsMissingDays, mergeDfdsSailings,
  parseDfdsSchedule, parseDfdsTimetableApi, parseDfdsWeeklyHtml,
} from '../src/lib/ferry/dfds';
import { parseSeasonRanges, ymdInRanges } from '../supabase/functions/_shared/ferry/weeklySchedule';
import { parsePortTallinnHtml, portTallinnToSailings } from '../src/lib/ferry/portTallinn';
import { parsePortsStockholmPortEntry, portsStockholmToSailings } from '../src/lib/ferry/portsStockholm';

const TALLINK = JSON.parse(readFileSync(new URL('./fixtures/tallink-timetable-tal-hel-2026-10-30.json', import.meta.url), 'utf8'));
const PORTNET = JSON.parse(readFileSync(new URL('./fixtures/digitraffic-port-calls-megastar-2026-10-29.json', import.meta.url), 'utf8'));
const PORTNET_TERM_A = JSON.parse(readFileSync(new URL('./fixtures/digitraffic-port-calls-terminal-a-sample.json', import.meta.url), 'utf8'));
const VIKING = JSON.parse(readFileSync(new URL('./fixtures/viking-schedule-sample.json', import.meta.url), 'utf8'));
const ECKERO = JSON.parse(readFileSync(new URL('./fixtures/eckero-schedule-sample.json', import.meta.url), 'utf8'));
const DFDS = JSON.parse(readFileSync(new URL('./fixtures/dfds-schedule-sample.json', import.meta.url), 'utf8'));
const PORT_TLL = readFileSync(new URL('./fixtures/port-tallinn-departures-arrivals-sample.html', import.meta.url), 'utf8');
const PORT_STO = JSON.parse(readFileSync(new URL('./fixtures/ports-stockholm-portentry-sample.json', import.meta.url), 'utf8'));
const VIKING_HTML = readFileSync(new URL('./fixtures/viking-timetable-helsinki-tallinn-sample.html', import.meta.url), 'utf8');
const VIKING_CARGO_HTML = readFileSync(new URL('./fixtures/viking-cargo-helsinki-tallinn-sample.html', import.meta.url), 'utf8');
const ECKERO_HTML = readFileSync(new URL('./fixtures/eckero-timetable-finlandia-finbo-sample.html', import.meta.url), 'utf8');
const DFDS_HTML = readFileSync(new URL('./fixtures/dfds-weekly-paldiski-kapellskar-sample.html', import.meta.url), 'utf8');
const DFDS_API = JSON.parse(readFileSync(new URL('./fixtures/dfds-timetable-api-sample.json', import.meta.url), 'utf8'));

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

  // F7 #661 następny PR: Terminal A (Viking/Finlandia) vs D (Tallink).
  it('FIHEL Terminal A: Viking XPRS / Finlandia → TLLA-HEL/HELA-TLL; Tallink → TLL-HEL', () => {
    const r = parseDigitrafficPortCalls(PORTNET_TERM_A);
    expect(r.warnings).toEqual([]);
    const xprs = r.calls.find((c) => c.vessel === 'M/F Viking XPRS');
    expect(xprs).toMatchObject({
      arrivalRoute: 'TLLA-HEL',
      departureRoute: 'HELA-TLL',
      actualArrivalUtc: '2026-10-30T08:00:00.000Z',
      actualDepartureUtc: '2026-10-30T09:00:00.000Z',
    });
    const fin = r.calls.find((c) => c.vessel === 'M/F Finlandia');
    expect(fin).toMatchObject({
      arrivalRoute: 'TLLA-HEL',
      departureRoute: 'HELA-TLL',
    });
    const mega = r.calls.find((c) => c.vessel === 'M/F Megastar');
    expect(mega).toMatchObject({
      arrivalRoute: 'TLL-HEL',
      departureRoute: 'HEL-TLL',
    });
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

  it('#666 A Cargo: sezony + 60 dni + wyjątek 24.12 tylko 10:30 HEL→TLL', () => {
    const r = parseVikingTimetableHtml(VIKING_CARGO_HTML, { fromYmd: '2026-10-30', days: 60 });
    /* F7 #668 r3: fixture ma 2. element bez dat → jedno ostrzeżenie; bez pusta/zablokowana */
    expect(r.warnings.filter((w) => /pusta|zablokowana/i.test(w))).toEqual([]);
    expect(r.warnings.filter((w) => /bez rozpoznanego sezonu/i.test(w)).length).toBeGreaterThanOrEqual(1);
    expect(r.sailings.length).toBeGreaterThan(50);
    expect(r.sailings.every((s) => s.route === 'TLLA-HEL' || s.route === 'HELA-TLL')).toBe(true);
    // 30.10.2026 = Fri → HELA-TLL 07:45 / 14:15 (sezon 10.08–31.12.2026)
    expect(r.sailings.some((s) =>
      s.route === 'HELA-TLL' && s.departureUtc.startsWith('2026-10-30T') && s.vessel === 'M/F Viking XPRS'
    )).toBe(true);
    const hel2412 = r.sailings.filter((s) => s.route === 'HELA-TLL' && s.departureUtc.startsWith('2026-12-24'));
    expect(hel2412).toHaveLength(1);
    expect(hel2412[0]!.departureUtc).toMatch(/2026-12-24T08:30:00/); // 10:30 EET
    const tll2412 = r.sailings.filter((s) => s.route === 'TLLA-HEL' && s.departureUtc.startsWith('2026-12-24'));
    expect(tll2412).toHaveLength(1);
    const planned = parseVikingPlannedChanges(VIKING_CARGO_HTML, 2026);
    expect(planned.days.some((p) => p.ymds.includes('2026-12-24'))).toBe(true);
    // 30.10 = Fri → 04.00* Tallinn→Helsinki (tylko fracht, gwiazdka w rozkładzie)
    const freight0400 = r.sailings.filter((s) =>
      s.route === 'TLLA-HEL' && s.departureUtc.startsWith('2026-10-30') && s.vessel === 'M/F Viking XPRS'
    );
    expect(freight0400.some((s) => s.departureUtc.includes('T02:00:00') || s.departureUtc.includes('T01:00:00'))).toBe(true);
    // horyzont 60 d: listopad i grudzień z sezonu 10.08–31.12.2026
    expect(r.sailings.some((s) => s.departureUtc.startsWith('2026-11-'))).toBe(true);
    expect(r.sailings.some((s) => s.departureUtc.startsWith('2026-12-'))).toBe(true);
  });

  it('F7 #668 r3: Cargo accordion — ostatni element; Cinderella tylko 22.6–8.8.2027', () => {
    const r = parseVikingTimetableHtml(VIKING_CARGO_HTML, { fromYmd: '2026-10-30', days: 60 });
    /* (a) 2. element fixture bez dat → ostrzeżenie, 0 duplikatów */
    expect(r.warnings.some((w) => /bez rozpoznanego sezonu|Struktura/i.test(w))).toBe(true);
    const allKeys = r.sailings.map((s) => `${s.route}|${s.departureUtc}`);
    expect(allKeys.length).toBe(new Set(allKeys).size);
    const day = r.sailings.filter((s) => s.departureUtc.startsWith('2026-10-30'));
    expect(day.filter((s) => s.route === 'HELA-TLL' && s.departureUtc.includes('T05:45')).length).toBe(1);
    /* (b) horyzont lato 2027 — Cinderella jest w 22.6–8.8 i nigdzie poza (nie every([])) */
    const summer = parseVikingTimetableHtml(VIKING_CARGO_HTML, { fromYmd: '2027-06-15', days: 70 });
    const cinderella = summer.sailings.filter((s) => /Cinderella|Gabriella/i.test(s.vessel));
    expect(cinderella.length).toBeGreaterThan(0);
    expect(cinderella.every((s) => {
      const d = s.departureUtc.slice(0, 10);
      return d >= '2027-06-22' && d <= '2027-08-08';
    })).toBe(true);
    const outsideSummer = summer.sailings.filter((s) => {
      if (!/Cinderella|Gabriella/i.test(s.vessel)) return false;
      const d = s.departureUtc.slice(0, 10);
      return d < '2027-06-22' || d > '2027-08-08';
    });
    expect(outsideSummer).toHaveLength(0);
    // tabela bez sezonu / bez akordeonu → ostrzeżenie, nie „wszystkie daty”
    const bare = parseVikingTimetableHtml(
      '<table><tr><td>Departure</td><td>Arrival</td><td>Day</td><td>Ship</td></tr>'
      + '<tr><td>07.45</td><td>10.00</td><td>Fri</td><td>Viking XPRS</td></tr></table>',
      { fromYmd: '2026-10-30', days: 7 },
    );
    expect(bare.sailings).toHaveLength(0);
    expect(bare.warnings.some((w) => /bez rozpoznanego sezonu|Struktura/i.test(w))).toBe(true);
  });

  it('F7 #668 r3: parseSeasonRanges po pozycji; ymdInRanges([]) = false', () => {
    const mixed = parseSeasonRanges('Jan 1st 2027 - Jun 21st 2027 then 22.6.2027–8.8.2027');
    expect(mixed.map((r) => `${r.from}/${r.to}`)).toEqual([
      '2027-01-01/2027-06-21',
      '2027-06-22/2027-08-08',
    ]);
    expect(ymdInRanges('2027-07-01', [])).toBe(false);
  });

  it('F7 #668 r4: parseSeasonRanges d.m.–d.m.yyyy (rok dziedziczony)', () => {
    const r = parseSeasonRanges('1.1.–21.6.2027 oraz 10.08.2026–31.12.2026');
    expect(r.some((x) => x.from === '2027-01-01' && x.to === '2027-06-21')).toBe(true);
    expect(r.some((x) => x.from === '2026-08-10' && x.to === '2026-12-31')).toBe(true);
  });

  it('F7 #668 r5 B1: sezon przez Nowy Rok 22.12.–6.1.2027', () => {
    const r = parseSeasonRanges('22.12.–6.1.2027');
    expect(r).toEqual([{ from: '2026-12-22', to: '2027-01-06' }]);
    const html = `
<details class="c-accordion__item">
  <h3>22.12.–6.1.2027</h3>
  <table><tr><td>Departure</td><td>Arrival</td><td>Day</td><td>Ship</td></tr>
  <tr><td>10.30</td><td>13.10</td><td>Mon–Sun</td><td>Viking XPRS</td></tr></table>
</details>`;
    const out = parseVikingTimetableHtml(html, { fromYmd: '2026-12-28', days: 4 });
    expect(out.sailings.some((s) => s.departureUtc.startsWith('2026-12-28'))).toBe(true);
    expect(out.sailings.some((s) => s.departureUtc.startsWith('2026-12-31'))).toBe(true);
  });

  it('F7 #668 r4 Bloker 1: dwa kierunki w jednym elemencie akordeonu', () => {
    const html = `
<details class="c-accordion__item">
  <h3>10.08.2026–31.12.2026</h3>
  <h4>Tallinn–Helsinki</h4>
  <table><tr><td>Tallinn–Helsinki</td></tr><tr><td>Departure</td><td>Arrival</td><td>Day</td><td>Ship</td></tr>
  <tr><td>07.00</td><td>09.30</td><td>Mon–Sun</td><td>Viking XPRS</td></tr></table>
  <h4>Helsinki–Tallinn</h4>
  <table><tr><td>Helsinki–Tallinn</td></tr><tr><td>Departure</td><td>Arrival</td><td>Day</td><td>Ship</td></tr>
  <tr><td>10.30</td><td>13.10</td><td>Mon–Sun</td><td>Viking XPRS</td></tr></table>
</details>`;
    const r = parseVikingTimetableHtml(html, { fromYmd: '2026-10-30', days: 3 });
    expect(r.sailings.some((s) => s.route === 'TLLA-HEL')).toBe(true);
    expect(r.sailings.some((s) => s.route === 'HELA-TLL')).toBe(true);
    expect(r.warnings.some((w) => /bez rozpoznanego sezonu/i.test(w))).toBe(false);
  });

  it('F7 #668 r5 B2: trasa tylko w h4 (bez etykiety w tabeli) — obie kolejności', () => {
    const mk = (first: string, second: string) => `
<details class="c-accordion__item">
  <h3>10.08.2026–31.12.2026</h3>
  <h4>${first}</h4>
  <table><tr><td>Departure</td><td>Arrival</td><td>Day</td><td>Ship</td></tr>
  <tr><td>07.00</td><td>09.30</td><td>Mon–Sun</td><td>Viking XPRS</td></tr></table>
  <h4>${second}</h4>
  <table><tr><td>Departure</td><td>Arrival</td><td>Day</td><td>Ship</td></tr>
  <tr><td>10.30</td><td>13.10</td><td>Mon–Sun</td><td>Viking XPRS</td></tr></table>
</details>`;
    const a = parseVikingTimetableHtml(mk('Tallinn–Helsinki', 'Helsinki–Tallinn'), { fromYmd: '2026-10-30', days: 2 });
    const aTll = a.sailings.filter((s) => s.route === 'TLLA-HEL' && s.departureUtc.startsWith('2026-10-30'));
    const aHel = a.sailings.filter((s) => s.route === 'HELA-TLL' && s.departureUtc.startsWith('2026-10-30'));
    expect(aTll).toHaveLength(1);
    expect(aHel).toHaveLength(1);
    expect(aTll[0]!.departureUtc < aHel[0]!.departureUtc).toBe(true); // 07:00 przed 10:30
    const b = parseVikingTimetableHtml(mk('Helsinki–Tallinn', 'Tallinn–Helsinki'), { fromYmd: '2026-10-30', days: 2 });
    const bHel = b.sailings.filter((s) => s.route === 'HELA-TLL' && s.departureUtc.startsWith('2026-10-30'));
    const bTll = b.sailings.filter((s) => s.route === 'TLLA-HEL' && s.departureUtc.startsWith('2026-10-30'));
    expect(bHel).toHaveLength(1);
    expect(bTll).toHaveLength(1);
    expect(bHel[0]!.departureUtc < bTll[0]!.departureUtc).toBe(true);
  });

  it('F7 #668 r5 B2: bez c-accordion — dwa details (ostatni wygrywa sezon+trasy)', () => {
    const html = `
<details>
  <h3>1.1.–21.6.2027</h3>
  <h4>Tallinn–Helsinki</h4>
  <table><tr><td>Departure</td><td>Arrival</td><td>Day</td><td>Ship</td></tr>
  <tr><td>06.00</td><td>08.30</td><td>Mon–Sun</td><td>Viking XPRS</td></tr></table>
</details>
<details>
  <h3>10.08.2026–31.12.2026</h3>
  <h4>Tallinn–Helsinki</h4>
  <table><tr><td>Departure</td><td>Arrival</td><td>Day</td><td>Ship</td></tr>
  <tr><td>07.00</td><td>09.30</td><td>Mon–Sun</td><td>Viking XPRS</td></tr></table>
  <h4>Helsinki–Tallinn</h4>
  <table><tr><td>Departure</td><td>Arrival</td><td>Day</td><td>Ship</td></tr>
  <tr><td>10.30</td><td>13.10</td><td>Mon–Sun</td><td>Viking XPRS</td></tr></table>
</details>`;
    const r = parseVikingTimetableHtml(html, { fromYmd: '2026-10-30', days: 2 });
    expect(r.sailings.some((s) => s.route === 'TLLA-HEL')).toBe(true);
    expect(r.sailings.some((s) => s.route === 'HELA-TLL')).toBe(true);
    expect(r.sailings.every((s) => !s.departureUtc.startsWith('2027-'))).toBe(true);
  });

  it('F7 #668 r6: lastDetailsChunk — trzeci details bez h4/etykiety → HELA-TLL (nie pierwsze details)', () => {
    /* Mutacja „pierwsze <details>” brałaby Tallinn–Helsinki → TLLA-HEL. */
    const html = `
<details>
  <h3>1.1.–21.6.2027</h3>
  <h4>Tallinn–Helsinki</h4>
</details>
<details>
  <h3>22.6.–8.8.2027</h3>
  <h4>Helsinki–Tallinn</h4>
</details>
<details>
  <h3>10.08.2026–31.12.2026</h3>
  <table><tr><td>Departure</td><td>Arrival</td><td>Day</td><td>Ship</td></tr>
  <tr><td>10.30</td><td>13.10</td><td>Mon–Sun</td><td>Viking XPRS</td></tr></table>
</details>`;
    const r = parseVikingTimetableHtml(html, { fromYmd: '2026-10-30', days: 1 });
    expect(r.sailings.some((s) => s.route === 'HELA-TLL' && s.departureUtc.startsWith('2026-10-30'))).toBe(true);
    expect(r.sailings.every((s) => s.route !== 'TLLA-HEL' || !s.departureUtc.startsWith('2026-10-30'))).toBe(true);
  });

  it('F7 #668 r5: Planned changes — nearestVessel + tylko kierunek wyjątku', () => {
    /* Wyjątek tylko HEL→TLL: tygodniówka HEL wycięta; TLL z tabeli zostaje; 17:00 → Cinderella (bliżej 18:00). */
    const html = `
<details class="c-accordion__item">
  <h3>10.08.2026–31.12.2026</h3>
  <h4>Helsinki–Tallinn</h4>
  <table><tr><td>Departure</td><td>Arrival</td><td>Day</td><td>Ship</td></tr>
  <tr><td>14.00</td><td>16.30</td><td>Mon–Sun</td><td>Viking XPRS</td></tr>
  <tr><td>18.00</td><td>20.30</td><td>Mon–Sun</td><td>Viking Cinderella</td></tr></table>
  <h4>Tallinn–Helsinki</h4>
  <table><tr><td>Departure</td><td>Arrival</td><td>Day</td><td>Ship</td></tr>
  <tr><td>07.00</td><td>09.30</td><td>Mon–Sun</td><td>Viking XPRS</td></tr></table>
</details>
<p>Planned changes in timetable</p>
<p>Christmas 2026 24.12.2026 Timetable from Helsinki to Tallinn: Sailing at 17.00, arrival at 19.30</p>`;
    const planned = parseVikingPlannedChanges(html, 2026);
    expect(planned.days.some((d) => d.ymds.includes('2026-12-24') && d.legs.some((l) => l.route === 'HELA-TLL'))).toBe(true);
    expect(planned.days.every((d) => !d.ymds.includes('2026-12-24') || !d.legs.some((l) => l.route === 'TLLA-HEL'))).toBe(true);
    const r = parseVikingTimetableHtml(html, { fromYmd: '2026-12-23', days: 3 });
    const hel24 = r.sailings.filter((s) => s.route === 'HELA-TLL' && s.departureUtc.startsWith('2026-12-24'));
    expect(hel24).toHaveLength(1);
    /* 17:00 bliżej 18:00 Cinderella niż 14:00 XPRS; godzina wyjątku nie sezonowa */
    expect(hel24[0]!.vessel).toMatch(/Cinderella/i);
    expect(hel24[0]!.departureUtc).toContain('T15:00');
    /* TLL bez wyjątku — tygodniówka 07:00 zostaje */
    expect(r.sailings.some((s) => s.route === 'TLLA-HEL' && s.departureUtc.startsWith('2026-12-24'))).toBe(true);
    expect(r.sailings.some((s) => s.route === 'HELA-TLL' && s.departureUtc.startsWith('2026-12-23'))).toBe(true);
  });

  it('F7 #668 r5: Planned changes — brak tabeli trasy → ostrzeżenie; Tallinn-only head', () => {
    const html = `
<details class="c-accordion__item">
  <h3>10.08.2026–31.12.2026</h3>
  <h4>Helsinki–Tallinn</h4>
  <table><tr><td>Departure</td><td>Arrival</td><td>Day</td><td>Ship</td></tr>
  <tr><td>14.00</td><td>16.30</td><td>Mon–Sun</td><td>Viking XPRS</td></tr></table>
</details>
<p>Planned changes in timetable</p>
<p>25.12.2026 Timetable from Tallinn to Helsinki: Sailing at 10.30, arrival at 13.00</p>
<p>26.12.2026 Timetable from Mariehamn to nowhere: Sailing at 12.00, arrival at 14.00</p>`;
    const r = parseVikingTimetableHtml(html, { fromYmd: '2026-12-25', days: 2 });
    expect(r.warnings.some((w) => /brak statku w tabeli sezonowej.*TLLA-HEL/i.test(w))).toBe(true);
    expect(r.warnings.some((w) => /nierozpoznany nagłówek.*Mariehamn/i.test(w))).toBe(true);
  });

  it('F7 #668 r3 N1: mergeDfdsMissingDays — doba lokalna (nie UTC slice)', () => {
    // 23:59 EET 26.10 = 21:59 UTC; PDF 22:00 EET tej samej doby = 19:00 UTC
    const api = [{
      route: 'PLD-KPS' as const, vessel: 'M/F Sirena Seaways',
      departureUtc: '2026-10-26T21:59:00.000Z', arrivalUtc: '2026-10-27T07:00:00.000Z',
    }];
    const pdfSameDay = [{
      route: 'PLD-KPS' as const, vessel: 'M/F Sirena Seaways',
      departureUtc: '2026-10-26T19:00:00.000Z', arrivalUtc: '2026-10-27T05:00:00.000Z',
    }];
    const pdfMissing = [{
      route: 'PLD-KPS' as const, vessel: 'M/F Sirena Seaways',
      departureUtc: '2026-10-28T19:00:00.000Z', arrivalUtc: '2026-10-29T05:00:00.000Z',
    }];
    const merged = mergeDfdsMissingDays(api, [...pdfSameDay, ...pdfMissing]);
    expect(merged).toHaveLength(2);
    expect(merged.some((s) => s.departureUtc === '2026-10-26T21:59:00.000Z')).toBe(true);
    expect(merged.some((s) => s.departureUtc === '2026-10-26T19:00:00.000Z')).toBe(false);
    expect(merged.some((s) => s.departureUtc === '2026-10-28T19:00:00.000Z')).toBe(true);
  });

  it('F7 #668 r6: filterDfdsFallbackToFailedWeeks — okno UTC [from,to] zapytania API', () => {
    const failed = [{
      dateFromIso: '2026-10-26T22:00:00.000Z',
      dateToIso: '2026-11-02T21:59:59.999Z',
      route: 'PLD-KPS' as const,
    }];
    const inWin = {
      route: 'PLD-KPS' as const, vessel: 'M/F Sirena Seaways',
      departureUtc: '2026-10-27T20:00:00.000Z', arrivalUtc: '2026-10-28T05:30:00.000Z',
    };
    const outWin = {
      route: 'PLD-KPS' as const, vessel: 'M/F Sirena Seaways',
      departureUtc: '2026-11-03T20:00:00.000Z', arrivalUtc: '2026-11-04T05:30:00.000Z',
    };
    /* Pon. udanego tygodnia (poza oknem UTC) nie wraca z PDF mimo tej samej doby lokalnej. */
    const mondayOkWeek = {
      route: 'PLD-KPS' as const, vessel: 'M/F Sirena Seaways',
      departureUtc: '2026-10-26T20:00:00.000Z', arrivalUtc: '2026-10-27T05:30:00.000Z',
    };
    const filtered = filterDfdsFallbackToFailedWeeks([inWin, outWin, mondayOkWeek], failed);
    expect(filtered).toEqual([inWin]);
  });

  it('F7 #668 r4 Bloker 2: mergeDfdsMissingDays — 00:30 lokalnie (UTC poprzedniej doby)', () => {
    // PLD 00:30 EET 26.10 = 22:30Z 25.10 — stary slice(0,10) brałby 25.10
    const apiPld = [{
      route: 'PLD-KPS' as const, vessel: 'M/F Sirena Seaways',
      departureUtc: '2026-10-25T22:30:00.000Z', arrivalUtc: '2026-10-26T07:00:00.000Z',
    }];
    const pdfSameLocal = [{
      route: 'PLD-KPS' as const, vessel: 'M/F Sirena Seaways',
      departureUtc: '2026-10-26T19:00:00.000Z', arrivalUtc: '2026-10-27T05:00:00.000Z',
    }];
    const pdfPrevLocal = [{
      route: 'PLD-KPS' as const, vessel: 'M/F Sirena Seaways',
      departureUtc: '2026-10-25T19:00:00.000Z', arrivalUtc: '2026-10-26T05:00:00.000Z',
    }];
    const mPld = mergeDfdsMissingDays(apiPld, [...pdfSameLocal, ...pdfPrevLocal]);
    expect(mPld).toHaveLength(2);
    expect(mPld.some((s) => s.departureUtc === '2026-10-25T22:30:00.000Z')).toBe(true);
    expect(mPld.some((s) => s.departureUtc === '2026-10-26T19:00:00.000Z')).toBe(false);
    expect(mPld.some((s) => s.departureUtc === '2026-10-25T19:00:00.000Z')).toBe(true);
    // KPS 00:30 CET 26.10 = 23:30Z 25.10
    const apiKps = [{
      route: 'KPS-PLD' as const, vessel: 'M/F Sirena Seaways',
      departureUtc: '2026-10-25T23:30:00.000Z', arrivalUtc: '2026-10-26T08:00:00.000Z',
    }];
    const pdfKpsSame = [{
      route: 'KPS-PLD' as const, vessel: 'M/F Sirena Seaways',
      departureUtc: '2026-10-26T21:00:00.000Z', arrivalUtc: '2026-10-27T06:00:00.000Z',
    }];
    const pdfKpsPrev = [{
      route: 'KPS-PLD' as const, vessel: 'M/F Sirena Seaways',
      departureUtc: '2026-10-25T21:00:00.000Z', arrivalUtc: '2026-10-26T06:00:00.000Z',
    }];
    const mKps = mergeDfdsMissingDays(apiKps, [...pdfKpsSame, ...pdfKpsPrev]);
    expect(mKps).toHaveLength(2);
    expect(mKps.some((s) => s.departureUtc === '2026-10-26T21:00:00.000Z')).toBe(false);
    expect(mKps.some((s) => s.departureUtc === '2026-10-25T21:00:00.000Z')).toBe(true);
    /* F7 #668 r6: okno = UTC [from,to]; 26.10 19:00Z poza 25.10 00:00–23:59Z */
    const filtered = filterDfdsFallbackToFailedWeeks(
      [...pdfSameLocal, ...pdfPrevLocal],
      [{ dateFromIso: '2026-10-25T00:00:00.000Z', dateToIso: '2026-10-25T23:59:59.000Z', route: 'PLD-KPS' }],
    );
    expect(filtered.some((s) => s.departureUtc === '2026-10-25T19:00:00.000Z')).toBe(true);
    expect(filtered.some((s) => s.departureUtc === '2026-10-26T19:00:00.000Z')).toBe(false);
  });

  it('Eckerö HTML: Finlandia TLLA-HEL 06:00 Mon-Sat + Finbo', () => {
    const r = parseEckeroTimetableHtml(ECKERO_HTML, { fromYmd: '2026-10-30', days: 7 });
    expect(r.sailings.some((s) => s.vessel === 'M/F Finlandia' && s.route === 'TLLA-HEL')).toBe(true);
    expect(r.sailings.some((s) => s.vessel === 'M/F Finlandia' && s.route === 'HELA-TLL')).toBe(true);
    expect(r.sailings.some((s) => s.vessel === 'M/F Finbo Cargo')).toBe(true);
  });

  it('F7 #661: Finbo przerwa 24.12–5.01; Finlandia 2 sezony; Viking poza zakresem', () => {
    const finboBreak = parseEckeroTimetableHtml(ECKERO_HTML, { fromYmd: '2026-12-20', days: 20 });
    const finbo = finboBreak.sailings.filter((s) => s.vessel === 'M/F Finbo Cargo');
    expect(finbo.some((s) => s.departureUtc.startsWith('2026-12-22'))).toBe(true);
    expect(finbo.every((s) => !s.departureUtc.startsWith('2026-12-24'))).toBe(true);
    expect(finbo.every((s) => !s.departureUtc.startsWith('2026-12-25'))).toBe(true);
    expect(finbo.every((s) => !s.departureUtc.startsWith('2027-01-02'))).toBe(true);
    const finlandia = parseEckeroTimetableHtml(ECKERO_HTML, { fromYmd: '2027-06-01', days: 7 });
    expect(finlandia.sailings.some((s) => s.vessel === 'M/F Finlandia')).toBe(true);
    // Viking fixture: 01.09.2026–21.06.2027 — sierpień 2026 poza sezonem
    const vikingOut = parseVikingTimetableHtml(VIKING_HTML, { fromYmd: '2026-08-01', days: 7 });
    expect(vikingOut.sailings).toHaveLength(0);
    const vikingIn = parseVikingTimetableHtml(VIKING_HTML, { fromYmd: '2026-10-30', days: 3 });
    expect(vikingIn.sailings.length).toBeGreaterThan(0);
  });

  it('DFDS HTML: PLD 22:00 Mon + KPS 09:30', () => {
    const r = parseDfdsWeeklyHtml(DFDS_HTML, { fromYmd: '2026-10-26', days: 7 }); // poniedziałek
    expect(r.warnings.filter((w) => /Struktura/i.test(w))).toEqual([]);
    expect(r.sailings.some((s) => s.route === 'PLD-KPS' && s.departureUtc.startsWith('2026-10-26'))).toBe(true);
    expect(r.sailings.some((s) => s.route === 'KPS-PLD' && s.departureUtc.startsWith('2026-10-26'))).toBe(true);
  });

  it('#666 DFDS Dynamic: API obu kierunków + odstępstwo 23:59 + PDF ze strony', () => {
    const pld = parseDfdsTimetableApi(DFDS_API.pld_kps_week44);
    const kps = parseDfdsTimetableApi(DFDS_API.kps_pld_week44);
    expect(pld.warnings).toEqual([]);
    expect(kps.warnings).toEqual([]);
    expect(pld.sailings.every((s) => s.route === 'PLD-KPS' && s.vessel === 'M/F Sirena Seaways')).toBe(true);
    expect(kps.sailings.every((s) => s.route === 'KPS-PLD' && s.vessel === 'M/F Sirena Seaways')).toBe(true);
    // Tydzień 44: Mon/Tue 23:59 lokalnie (odstępstwo vs sezonowy 22:00) → UTC 21:59 EET.
    expect(pld.sailings.some((s) => s.departureUtc === '2026-10-26T21:59:00.000Z')).toBe(true);
    expect(pld.sailings.some((s) => s.departureUtc.startsWith('2026-10-30T'))).toBe(true);
    expect(kps.sailings.some((s) => s.departureUtc.startsWith('2026-10-26') || s.departureUtc.startsWith('2026-11-01'))).toBe(true);
    const merged = mergeDfdsSailings(pld.sailings, kps.sailings);
    expect(merged.length).toBe(pld.sailings.length + kps.sailings.length);
    expect(mergeDfdsSailings(pld.sailings, pld.sailings).length).toBe(pld.sailings.length);
    const bad = parseDfdsTimetableApi({ foo: 1 });
    expect(bad.sailings).toEqual([]);
    expect(bad.warnings.join(' ')).toMatch(/tablicy|Dynamic/);
    const html = `Download seasonal schedule <a href="https://assets.ctfassets.net/z860498abl84/Gy4OYoQ6LuDjJU4BuGKun/f8fe25019414d460662df90e830c3ba6/Schedule_Paldiski_-_Kapellskär.pdf">PDF</a>`;
    expect(extractDfdsSeasonalPdfUrl(html)).toMatch(/Schedule_Paldiski/);
  });

  it('F7 #661: rozwinięcie tygodnia przez DST (marzec / październik Tallinn)', () => {
    // Fixture z sezonem obejmującym marzec (produkcyjny Viking: od 01.09).
    const html = `<html><body><h2>01.01.2026–31.12.2026</h2>
<table data-route="tallinn-helsinki"><thead><tr><th>Departure</th><th>Arrival</th><th>Day</th><th>Ship</th></tr></thead>
<tbody><tr><td>07.00</td><td>09.30</td><td>Every Day</td><td>Viking XPRS</td></tr></tbody></table>
</body></html>`;
    // 29.03.2026 03:00 EET→EEST (+2→+3); 25.10.2026 04:00 EEST→EET.
    const spring = parseVikingTimetableHtml(html, { fromYmd: '2026-03-28', days: 3 });
    expect(spring.sailings.find((s) => s.departureUtc.startsWith('2026-03-28'))!.departureUtc)
      .toBe('2026-03-28T05:00:00.000Z'); // 07:00 EET
    expect(spring.sailings.find((s) => s.departureUtc.startsWith('2026-03-30'))!.departureUtc)
      .toBe('2026-03-30T04:00:00.000Z'); // 07:00 EEST
    const autumn = parseVikingTimetableHtml(html, { fromYmd: '2026-10-24', days: 3 });
    expect(autumn.sailings.find((s) => s.departureUtc.startsWith('2026-10-24'))!.departureUtc)
      .toBe('2026-10-24T04:00:00.000Z'); // 07:00 EEST
    expect(autumn.sailings.find((s) => s.departureUtc.startsWith('2026-10-25'))!.departureUtc)
      .toBe('2026-10-25T05:00:00.000Z'); // 07:00 EET
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

  /* DP-10 (#671 / F7 #661): PoT — osobne trasy Terminal A (Viking) vs D (Tallink); bez mieszania. */
  it('DP-10: Viking → TLLA-HEL, Tallink → TLL-HEL (bez dublowania tras)', () => {
    const r = parsePortTallinnHtml(PORT_TLL, '2026-10-30');
    const viking = r.events.filter((e) => /viking/i.test(e.vessel));
    const tallink = r.events.filter((e) => /mystar|megastar/i.test(e.vessel));
    expect(viking.length).toBeGreaterThan(0);
    expect(tallink.length).toBeGreaterThan(0);
    expect(viking.every((e) => e.route === 'TLLA-HEL' || e.route === 'HELA-TLL')).toBe(true);
    expect(tallink.every((e) => e.route === 'TLL-HEL' || e.route === 'HEL-TLL')).toBe(true);
    // Job nie wstawia z toSailings (F7 r2/r3) — helper istnieje tylko do testu parsera.
    const fake = portTallinnToSailings(r.events);
    expect(fake.some((s) => s.route === 'TLLA-HEL')).toBe(true);
    expect(fake.some((s) => s.route === 'TLL-HEL')).toBe(true);
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
