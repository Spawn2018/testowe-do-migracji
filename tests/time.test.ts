import { describe, expect, it } from 'vitest';
import {
  TZ_LOAD_PL,
  TZ_UNLOAD_SE,
  calendarDayNoonMs,
  delayMinutesVsPlan,
  calendarDayEndMs,
  formatCalendarDay,
  refYearInOps,
  formatTableInZone,
  formatTableDay,
  formatCompactInZone,
  formatEtaBoden,
  formatEtaBodenCompact,
  formatLoadPl,
  formatUnloadSe,
  isoToDatetimeLocalValue,
  parseInstant,
  wallLocalToIso,
  zoneOffsetIso,
} from '../src/lib/time';

describe('D8 timezone policy', () => {
  it('calendar YYYY-MM-DD formats without UTC midnight shift', () => {
    expect(formatCalendarDay('2026-09-26')).toBe('26.09.2026');
    expect(formatLoadPl('2026-09-23')).toBe('23.09.2026');
    expect(formatUnloadSe('2026-09-26')).toBe('26.09.2026');
    expect(parseInstant('2026-09-26')).toBeNull();
  });

  it('does not use ISO slice semantics — Z and +02:00 compact to same Warsaw/Stockholm wall in CEST', () => {
    const z = '2026-09-23T12:32:00.000Z'; // 14:32 CEST
    const off = '2026-09-23T14:32:00+02:00';
    expect(formatEtaBodenCompact(z)).toBe('23.09 14:32');
    expect(formatEtaBodenCompact(off)).toBe('23.09 14:32');
    // old bug: z.slice(5,16) => '09-23T12:32' (UTC) vs off.slice => '09-23T14:32'
    expect(z.slice(5, 16)).not.toBe(off.slice(5, 16));
  });

  it('wallLocalToIso tags PL load and SE unload with zone offset (not hardcoded +02 forever)', () => {
    const pl = wallLocalToIso('2026-09-23T06:00', TZ_LOAD_PL);
    const se = wallLocalToIso('2026-09-26T07:00', TZ_UNLOAD_SE);
    expect(pl).toMatch(/^2026-09-23T06:00:00/);
    expect(se).toMatch(/^2026-09-26T07:00:00/);
    // September → CEST +02 for both Warsaw and Stockholm
    expect(pl?.endsWith('+02:00') || pl?.endsWith('+02')).toBe(true);
    expect(se?.endsWith('+02:00') || se?.endsWith('+02')).toBe(true);
    const round = isoToDatetimeLocalValue(pl, TZ_LOAD_PL);
    expect(round).toBe('2026-09-23T06:00');
  });

  it('delayMinutesVsPlan: od końca dnia dostawy w Europe/Stockholm (SCOPE §57), nie od południa ani Date.parse', () => {
    expect(delayMinutesVsPlan('2026-09-26T18:00:00+02:00', '2026-09-26')).toBeNull(); // ten sam dzień — brak opóźnienia
    expect(delayMinutesVsPlan('2026-09-26T23:59:00+02:00', '2026-09-26')).toBeNull();
    expect(delayMinutesVsPlan('2026-09-27T02:00:00+02:00', '2026-09-26')).toBe(120); // północ Sztokholm → 02:00
    expect(delayMinutesVsPlan('2026-12-27T01:00:00+01:00', '2026-12-26')).toBe(60); // zima (CET)
    expect(calendarDayEndMs('2026-09-30', TZ_UNLOAD_SE)).toBe(Date.parse('2026-09-30T22:00:00Z'));
    // naive Date.parse('2026-09-26') is UTC midnight — would skew on some hosts
    const naive = Date.parse('2026-09-26');
    const noon = calendarDayNoonMs('2026-09-26', TZ_UNLOAD_SE)!;
    expect(noon).not.toBe(naive);
  });

  it('formatEtaBoden / formatLoadPl use site zones', () => {
    const iso = '2026-09-24T10:00:00Z';
    expect(formatEtaBoden(iso)).toMatch(/24\.09\.2026/);
    expect(formatLoadPl(iso)).toMatch(/24\.09\.2026/);
    expect(formatCompactInZone(iso, TZ_UNLOAD_SE)).toMatch(/^24\.09 /);
    expect(zoneOffsetIso(new Date('2026-09-24T10:00:00Z'), TZ_LOAD_PL)).toMatch(/\+02/);
  });
});

describe('D17 table date format — omit redundant year', () => {
  it('formatTableDay drops year when it matches refYear', () => {
    expect(formatTableDay('2026-09-26', 2026)).toBe('26.09');
    expect(formatTableDay('2026-01-05', 2026)).toBe('05.01');
  });

  it('formatTableDay keeps year when it differs from refYear', () => {
    expect(formatTableDay('2025-12-31', 2026)).toBe('31.12.2025');
    expect(formatTableDay('2027-01-02', 2026)).toBe('02.01.2027');
  });

  it('formatTableInZone omits year for same-year instants, keeps zone wall clock', () => {
    // 12:32Z → 14:32 CEST Warsaw/Stockholm
    expect(formatTableInZone('2026-09-23T12:32:00.000Z', TZ_UNLOAD_SE, 2026)).toBe('23.09 14:32');
    expect(formatTableInZone('2025-12-31T12:00:00+01:00', TZ_UNLOAD_SE, 2026)).toMatch(/^31\.12\.2025 /);
  });

  it('formatTableInZone date-only delegates to formatTableDay', () => {
    expect(formatTableInZone('2026-09-28', TZ_UNLOAD_SE, 2026)).toBe('28.09');
  });

  it('refYearInOps uses Europe/Warsaw civil year', () => {
    expect(refYearInOps(new Date('2026-09-23T14:32:00Z'))).toBe(2026);
  });
});
