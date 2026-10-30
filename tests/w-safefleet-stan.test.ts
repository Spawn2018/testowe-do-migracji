import { describe, expect, it } from 'vitest';
import { LIVE_SOURCES, liveSourceRows, type RunRow } from '../src/auth/LiveStatus';
import { KNOWN_JOBS } from '../src/auth/SystemStatusPanel';
import { isBrokenSafefleetTrackingRef, isSafefleetTrackingRef, trackerKind } from '../src/lib/trackerLink';
import { redactTrackingRef } from '../src/lib/trackingRefSafe';

describe('#662 SafeFleet w stanie systemu i linku', () => {
  it('LIVE_SOURCES: telematics-safefleet zaraz po rio, próg 10 min', () => {
    const i = LIVE_SOURCES.findIndex((s) => s.id === 'telematics-safefleet');
    expect(i).toBe(LIVE_SOURCES.findIndex((s) => s.id === 'telematics-rio') + 1);
    expect(LIVE_SOURCES[i]).toMatchObject({ jobs: ['safefleet-poll'], maxMin: 10 });
    expect(KNOWN_JOBS).toContain('safefleet-poll');
  });

  it('liveSourceRows buduje wiersz SafeFleet', () => {
    const now = '2026-10-30T12:00:00Z';
    const runs: RunRow[] = [
      { job: 'safefleet-poll', ok: true, ran_at: '2026-10-30T11:55:00Z' },
    ];
    const row = liveSourceRows('pl', runs, [], [], now).find((r) => r.id === 'telematics-safefleet')!;
    expect(row.state).toBe('ok');
    expect(row.name).toMatch(/SafeFleet/i);
  });

  it('trackerKind + redact bez pełnego tokenu', () => {
    const token = `${'a'.repeat(26)}b1c2d3`;
    const url = `https://portal.safefleet.pl/safefleet/temporary_link/view/${token}/`;
    expect(trackerKind(url)).toBe('safefleet');
    expect(isSafefleetTrackingRef(url)).toBe(true);
    expect(isBrokenSafefleetTrackingRef('https://portal.safefleet.pl/x')).toBe(true);
    expect(redactTrackingRef(url)).toBe('safefleet:b1c2d3');
    expect(redactTrackingRef(url)).not.toContain(token);
  });
});
