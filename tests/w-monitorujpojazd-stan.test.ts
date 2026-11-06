import { describe, expect, it } from 'vitest';
import { LIVE_SOURCES, liveSourceRows, type RunRow } from '../src/auth/LiveStatus';
import { KNOWN_JOBS } from '../src/auth/SystemStatusPanel';
import {
  isBrokenMonitorujPojazdTrackingRef, isMonitorujPojazdTrackingRef, trackerKind,
} from '../src/lib/trackerLink';
import { redactTrackingRef } from '../src/lib/trackingRefSafe';

describe('#837 monitorujpojazd w stanie systemu i linku', () => {
  it('LIVE_SOURCES: telematics-monitorujpojazd zaraz po safefleet, próg 10 min', () => {
    const i = LIVE_SOURCES.findIndex((s) => s.id === 'telematics-monitorujpojazd');
    expect(i).toBe(LIVE_SOURCES.findIndex((s) => s.id === 'telematics-safefleet') + 1);
    expect(LIVE_SOURCES[i]).toMatchObject({ jobs: ['monitorujpojazd-poll'], maxMin: 10 });
    expect(KNOWN_JOBS).toContain('monitorujpojazd-poll');
  });

  it('liveSourceRows buduje wiersz monitorujpojazd', () => {
    const now = '2026-11-06T12:00:00Z';
    const runs: RunRow[] = [
      { job: 'monitorujpojazd-poll', ok: true, ran_at: '2026-11-06T11:55:00Z' },
    ];
    const row = liveSourceRows('pl', runs, [], [], now).find((r) => r.id === 'telematics-monitorujpojazd')!;
    expect(row.state).toBe('ok');
    expect(row.name).toMatch(/monitorujpojazd/i);
  });

  it('trackerKind + redact bez pełnego UUID', () => {
    const token = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee1234';
    const url = `https://sledz.monitorujpojazd.pl/share/${token}/`;
    expect(trackerKind(url)).toBe('monitorujpojazd');
    expect(isMonitorujPojazdTrackingRef(url)).toBe(true);
    expect(isBrokenMonitorujPojazdTrackingRef('https://sledz.monitorujpojazd.pl/x')).toBe(true);
    expect(redactTrackingRef(url)).toBe('mp:ee1234');
    expect(redactTrackingRef(url)).not.toContain(token);
    expect(redactTrackingRef(`http://sledz.monitorujpojazd.pl/share/${token}/`)).toBe('mp:ee1234');
  });
});
