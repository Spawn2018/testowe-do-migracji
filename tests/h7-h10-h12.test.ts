import { describe, expect, it } from 'vitest';
import { buildMapImageUrl } from '../supabase/functions/_shared/here/mapImage.ts';
import {
  WIND_GUST_MS_THRESHOLD,
  gustExceedsThreshold,
  seWeekendBanHit,
  plSundayBanHit,
} from '../supabase/functions/_shared/here/windAndBans.ts';

describe('H-7 mapImage', () => {
  it('buduje URL z punktem i stylem', () => {
    const u = buildMapImageUrl({
      apiKey: 'test-key',
      points: [{ lat: 52.1, lon: 17.0, label: 'P' }],
      width: 640,
      height: 360,
    });
    expect(u).toContain('image.maps.hereapi.com/mia/v3/');
    expect(u).toContain('640x360');
    expect(u).toContain('apiKey=test-key');
    expect(decodeURIComponent(u)).toContain('52.1,17');
  });
});

describe('H-10 wiatr', () => {
  it('próg 15 m/s', () => {
    expect(WIND_GUST_MS_THRESHOLD).toBe(15);
    expect(gustExceedsThreshold(14.9)).toBe(false);
    expect(gustExceedsThreshold(15)).toBe(true);
    expect(gustExceedsThreshold(null)).toBe(false);
  });
});

describe('H-12 zakazy', () => {
  it('SE weekend / PL niedziela', () => {
    // 2026-10-10 Saturday 12:00 UTC → SE afternoon Sat
    expect(seWeekendBanHit('2026-10-10T12:00:00Z')).toBe(true);
    // Monday
    expect(seWeekendBanHit('2026-10-05T12:00:00Z')).toBe(false);
    // Sunday PL
    expect(plSundayBanHit('2026-10-11T12:00:00Z')).toBe(true);
    expect(plSundayBanHit('2026-10-05T12:00:00Z')).toBe(false);
  });
});
