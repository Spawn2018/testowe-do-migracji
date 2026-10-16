/**
 * wyglad/P8-c (E34, img/e34-after): Strefy — lista według trasy, co uruchamia strefa, porty według rejsu, liczby po
 * polsku, historia zmian (przesunięcia i promień), podgląd wpływu zmiany (pytanie 1 B), produkcja bez źródła.
 */
import { describe, expect, it, vi } from 'vitest';
import {
  ZONE_KINDS, changeParts, distM, edgeM, groupOf, groupZones, impactOf, insideNow, parseCenter, parseNum, radiusText, routeOf,
  type ZoneRow,
} from '../src/lib/p8cZones';
import { P8C_PL } from '../src/i18n/p8c';

const Z = (id: string, name: string, type: ZoneRow['type'], lat: number, lng: number, radiusM: number, extra: Partial<ZoneRow> = {}): ZoneRow => ({
  id, name, type, lat, lng, radiusM, shape: 'circle', hysteresisM: 200, samplesRequired: 2, dwellMin: 10,
  notifyHhl: false, notifyKsh: false, notifyScx: false, active: true, trigger: 'ENTER', country: lat > 56 ? 'SE' : 'PL', ...extra,
});
const ZONES = [
  Z('a', 'Plac budowy Stegra Boden', 'SITE', 65.80539, 21.75914, 1000),
  Z('b', 'Terminal Stena Line Karlskrona', 'PORT_IN', 56.16, 15.58, 800),
  Z('c', 'Bufor 20 km przed Gdynią', 'PRE_PORT', 54.45, 18.4, 20000),
  Z('d', 'KSH Śrem · Grunwaldzka 27C', 'LOADING', 52.07, 17.02, 600),
  Z('e', 'Terminal Nynäshamn', 'PORT_IN', 58.9, 17.95, 800),
  Z('f', 'Bufor 50 km przed Boden', 'PRE_ARRIVAL', 65.7, 21.9, 50000),
  Z('g', 'Terminal Polferries Gdańsk', 'PORT_OUT', 54.4, 18.68, 800),
  Z('h', 'Bufor 50 km przed Śremem', 'PRE_ARRIVAL', 52.07, 17.02, 50000),
  Z('i', 'Terminal Stena Line Gdynia', 'PORT_OUT', 54.53, 18.51, 800),
  Z('j', 'Bufor 20 km przed Gdańskiem', 'PRE_PORT', 54.3, 18.55, 20000),
];

describe('lista według trasy (E34)', () => {
  it('grupy w kolejności trasy, w grupie bufor przed miejscem; porty w Szwecji: Polferries, potem Stena', () => {
    const g = groupZones(ZONES);
    expect(g.map((x) => x.group)).toEqual(['srem', 'gdansk', 'gdynia', 'se_ports', 'boden']);
    expect(g.map((x) => x.zones.map((z) => z.id))).toEqual([['h', 'd'], ['j', 'g'], ['c', 'i'], ['e', 'b'], ['f', 'a']]);
  });
  it('porty według rejsu: Gdynia i Karlskrona — Stena, Gdańsk i Nynäshamn — Polferries; trasa z danych wygrywa', () => {
    expect(routeOf(ZONES[1]!)).toBe('STENA');
    expect(routeOf(ZONES[4]!)).toBe('POLFERRIES');
    expect(routeOf({ ...ZONES[4]!, route: 'STENA' })).toBe('STENA');
    expect(routeOf(ZONES[0]!)).toBeNull();
  });
  it('rodzaje: 6, które działają; Punkt kontrolny i Postój — grupa „Inne”', () => {
    expect(ZONE_KINDS).toEqual(['LOADING', 'PRE_ARRIVAL', 'PRE_PORT', 'PORT_OUT', 'PORT_IN', 'SITE']);
    expect(groupOf(Z('x', 'Parking', 'REST', 60, 17, 400))).toBe('other');
  });
  it('liczby po polsku: „800 m”, „1 000 m”, „50 km”', () => {
    const sp = (x: string) => x.replace(/\u00a0/g, ' ');
    expect([radiusText(800), radiusText(1000), radiusText(1500), radiusText(50000), radiusText(20000)].map(sp)).toEqual(['800 m', '1 000 m', '1 500 m', '50 km', '20 km']);
    /* spacje nierozdzielające: „1 000 m” nie łamie się w wierszu */
    expect(radiusText(1000)).toBe('1\u00a0000\u00a0m');
  });
});

describe('historia i wpływ zmiany', () => {
  const now = { lat: 65.80539, lng: 21.75914, radiusM: 1000 };
  const b1 = { lat: 65.800041, lng: 21.750004, radiusM: 1000 };
  const b2 = { lat: 65.807551, lng: 21.72402, radiusM: 1500 };
  it('przesunięcia jak w bazie: 726 m (15:55) i 1 449 m z promieniem 1 500 → 1 000 (15:52)', () => {
    expect(changeParts({ at: '', who: '', before: b1, after: now, reason: null })).toEqual({ moved: 726, radius: null });
    expect(changeParts({ at: '', who: '', before: b2, after: b1, reason: null })).toEqual({ moved: 1449, radius: [1500, 1000] });
    expect(changeParts({ at: '', who: '', before: null, after: b2, reason: null })).toEqual({ moved: null, radius: null });
  });
  it('SG-03 przy placu: po zmianie z 15:55 — 9 m poza strefą, przed nią ok. 735 m poza — status bez zmian (pytanie 1 B)', () => {
    const pos = [{ code: 'SG-03', lat: 65.812823, lng: 21.771843, at: '2026-10-06T10:35:00Z' }];
    const [row] = impactOf(pos, b1, now);
    expect(row!.change).toBe('none');
    expect(row!.afterM).toBe(9);
    expect(row!.beforeM).toBeGreaterThanOrEqual(730);
    expect(row!.beforeM).toBeLessThanOrEqual(745);
  });
  it('margines granicy: wyjazd dopiero dalej niż margines; w marginesie status bez zmian (jak silnik stref)', () => {
    const inside = [{ code: 'XX-02', lat: 65.80539, lng: 21.75914 + 0.0205, at: '2026-10-07T06:00:00Z' }];
    const smaller = { ...now, radiusM: 800 };
    const [r] = impactOf(inside, now, smaller, 200);
    expect(r!.beforeM).toBeLessThan(0);
    expect(r!.afterM).toBeGreaterThan(0);
    expect(r!.afterM).toBeLessThanOrEqual(200);
    expect(r!.change).toBe('none');
    expect(impactOf(inside, now, smaller, 0)[0]!.change).toBe('exit');
  });
  it('pozycje daleko od strefy (ponad 5 km) i bez współrzędnych pomijane', () => {
    const pos = [{ code: 'YY-01', lat: 60, lng: 17 }, { code: 'YY-02', lat: 0, lng: 0 }];
    expect(impactOf(pos, now, { ...now, radiusM: 1100 })).toEqual([]);
  });
  it('przejście granicy = wjazd albo wyjazd; liczy się tylko najnowsza pozycja transportu', () => {
    const pos = [
      { code: 'XX-01', lat: 65.812823, lng: 21.771843, at: '2026-10-06T10:35:00Z' },
      { code: 'XX-01', lat: 65.80539, lng: 21.75914, at: '2026-10-07T06:00:00Z' },
    ];
    const bigger = { ...now, radiusM: 1100 };
    expect(impactOf(pos.slice(0, 1), now, bigger)[0]!.change).toBe('enter');
    expect(impactOf(pos.slice(0, 1), bigger, now)[0]!.change).toBe('exit');
    const rows = impactOf(pos, now, bigger);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.item.at).toBe('2026-10-07T06:00:00Z');
  });
  it('odległość i „teraz w strefie”', () => {
    expect(Math.round(distM(b1, now))).toBe(726);
    expect(edgeM(now, now)).toBe(-1000);
    expect(insideNow([{ lat: 65.80539, lng: 21.75914 }, { lat: 0, lng: 0 }, { lat: 60, lng: 17 }], now)).toBe(1);
  });
});

describe('pola formularza', () => {
  it('środek: przecinek dziesiętny, kropka, „N · E”; poza trasą — brak', () => {
    expect(parseCenter('65,80539 21,75914')).toEqual({ lat: 65.80539, lng: 21.75914 });
    expect(parseCenter('65.80539, 21.75914')).toEqual({ lat: 65.80539, lng: 21.75914 });
    expect(parseCenter('65.80539,21.75914')).toEqual({ lat: 65.80539, lng: 21.75914 });
    expect(parseCenter('65,81273 N · 21,78898 E')).toEqual({ lat: 65.81273, lng: 21.78898 });
    expect(parseCenter('65,80539; 21,75914')).toEqual({ lat: 65.80539, lng: 21.75914 });
    expect(parseCenter('40 21')).toBeNull();
    expect(parseCenter('65,8')).toBeNull();
    expect(parseCenter('abc def')).toBeNull();
  });
  it('liczby: „1 000”, „1 000 m”, „10 min”, „2,5”; puste i tekst — brak', () => {
    expect([parseNum('1 000'), parseNum('1 000 m'), parseNum('10 min'), parseNum('2,5'), parseNum('0')]).toEqual([1000, 1000, 10, 2.5, 0]);
    expect([parseNum(''), parseNum('abc'), parseNum('-5'), parseNum('1e3')]).toEqual([null, null, null, null]);
  });
});

describe('teksty i źródło', () => {
  it('bez „sms:” / „mailto:” (I-2) i bez kodów etapów w nazwach grup', () => {
    const all = Object.values(P8C_PL).join('\n').toLowerCase();
    expect(all).not.toContain('sms:');
    expect(all).not.toContain('mailto:');
    expect(P8C_PL.p8c_g_gdansk).toBe('Gdańsk · Polferries → Nynäshamn');
  });
  it('produkcja przed podłączeniem: strona Strefy zostaje przy dzisiejszej tabeli', async () => {
    vi.stubEnv('VITE_AUTH_MODE', 'supabase');
    try {
      const { zonesOf } = await import('../src/lib/p8cSource');
      const { zonesReady } = await import('../src/lib/p8cReady');
      expect(zonesOf()).toBeNull();
      expect(zonesReady()).toBe(false);
    } finally {
      vi.unstubAllEnvs();
    }
  });
  it('demo: menu Strefy i źródło stref włączają się razem (p8cReady = p8cSource)', async () => {
    const { zonesOf } = await import('../src/lib/p8cSource');
    const { zonesReady } = await import('../src/lib/p8cReady');
    expect(zonesReady()).toBe(zonesOf() !== null);
    expect(zonesReady()).toBe(true);
  });
});
