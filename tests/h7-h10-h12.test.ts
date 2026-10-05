import { describe, expect, it } from 'vitest';
import { buildMapImageUrl } from '../supabase/functions/_shared/here/mapImage.ts';
import {
  WIND_GUST_MS_THRESHOLD,
  gustExceedsThreshold,
  seWeekendBanHit,
  plSundayBanHit,
  holidayBanHit,
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

describe('H-12 święta', () => {
  it('holidayBanHit z bazy', () => {
    expect(holidayBanHit(true)).toBe(true);
    expect(holidayBanHit(false)).toBe(false);
    expect(holidayBanHit(null)).toBe(false);
  });
});

import { PDFDocument } from 'pdf-lib';
import { appendMapPage, buildLoadsPdf } from '../src/lib/pdfExport';
import { readFileSync } from 'node:fs';
import { buildSeedLoads } from '../src/data/seed';

describe('H-7 appendMapPage', () => {
  it('dokłada stronę z PNG', async () => {
    const font = readFileSync('public/fonts/LiberationSans-Regular.ttf');
    const base = await buildLoadsPdf(buildSeedLoads().slice(0, 1), font, { title: 'H7' });
    // 1x1 PNG
    const png = Uint8Array.from(Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    ));
    const out = await appendMapPage(base, png, 'Mapa test', font);
    const doc = await PDFDocument.load(out);
    expect(doc.getPageCount()).toBe(2);
  });
});

import {
  buildRouteProfileUrl,
  extractElevations,
  summarizeElevation,
  pickLegsForRoute,
} from '../supabase/functions/_shared/here/routeProfile.ts';

describe('H-8 routeProfile', () => {
  it('URL standard truck z elevation, bez vehicle dims', () => {
    const u = buildRouteProfileUrl({
      apiKey: 'k',
      origin: [52.0, 17.0],
      destination: [54.0, 18.0],
    });
    expect(u).toContain('transportMode=truck');
    expect(u).toContain('elevation');
    expect(u).not.toContain('vehicle%5Bheight%5D');
    expect(u).not.toContain('vehicle[height]');
  });
  it('z wymiarami gdy withNotices', () => {
    const u = buildRouteProfileUrl({
      apiKey: 'k',
      origin: [52, 17],
      destination: [54, 18],
      withNotices: true,
      dims: { heightM: 4, widthM: 2.5, lengthM: 16, weightT: 40, axleCount: 5, axleLoadT: 10 },
    });
    expect(u).toContain('vehicle');
    expect(u).toContain('notices');
  });
  it('pickLegs + summarize', () => {
    expect(pickLegsForRoute('Gdynia')).toEqual(['PL-GDY', 'SE-NYN']);
    const s = summarizeElevation([10, 12, 11, 20]);
    expect(s.minM).toBe(10);
    expect(s.maxM).toBe(20);
    expect(s.samples).toBe(4);
    expect(extractElevations({ routes: [{ sections: [{ elevation: [1, 2] }] }] })).toEqual([1, 2]);
  });
});
