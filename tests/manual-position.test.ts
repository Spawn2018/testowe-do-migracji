import { describe, expect, it } from 'vitest';
import { manualPositionTs, parseManualPosition } from '../src/lib/manualPosition';

describe('#559 parseManualPosition', () => {
  it('para współrzędnych w różnych zapisach', () => {
    expect(parseManualPosition('54.4047, 18.6772')).toEqual({ lat: 54.4047, lon: 18.6772 });
    expect(parseManualPosition('54.4047 18.6772')).toEqual({ lat: 54.4047, lon: 18.6772 });
    expect(parseManualPosition(' 58.9087;17.9583 ')).toEqual({ lat: 58.9087, lon: 17.9583 });
    expect(parseManualPosition('54,4047 18,6772')).toEqual({ lat: 54.4047, lon: 18.6772 });
  });
  it('adres z Map Google', () => {
    expect(parseManualPosition('https://www.google.com/maps/@54.4047,18.6772,15z')).toEqual({ lat: 54.4047, lon: 18.6772 });
    expect(parseManualPosition('https://www.google.com/maps?q=58.9087,17.9583')).toEqual({ lat: 58.9087, lon: 17.9583 });
    expect(parseManualPosition('https://www.google.com/maps/place/x/@50,10,12z/data=!3d58.9087!4d17.9583')).toEqual({ lat: 58.9087, lon: 17.9583 });
  });
  it('odrzuca śmieci i złe zakresy', () => {
    for (const s of ['', 'abc', '95.1, 18.2', '54.1, 190.2', '0, 0', '54.4047', 'https://maps.app.goo.gl/abc', '1,2,3']) {
      expect(parseManualPosition(s)).toBeNull();
    }
  });
  it('czas pozycji', () => {
    const now = new Date('2026-10-25T15:00:00Z');
    expect(manualPositionTs(0, now)).toBe('2026-10-25T15:00:00.000Z');
    expect(manualPositionTs(15, now)).toBe('2026-10-25T14:45:00.000Z');
    expect(manualPositionTs(-5, now)).toBe('2026-10-25T15:00:00.000Z');
    expect(manualPositionTs(5000, now)).toBe('2026-10-24T15:00:00.000Z');
  });
});
