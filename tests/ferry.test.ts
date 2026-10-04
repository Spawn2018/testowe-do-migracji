/**
 * TOWER — testy źródeł statusu promu.
 * Dane: prawdziwa strona komunikatów Polferries i prawdziwa odpowiedź
 * Digitraffic, zapisane 25.09.2026 w tests/fixtures/.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parsePolferriesStatus, localToUtc } from '../src/lib/ferry/polferries';
import { parseDigitrafficLocations, interpretFix, aisDepartureDelayMin } from '../src/lib/ferry/digitraffic';
import { parseStenaTimetable, stenaTimetableUrl } from '../src/lib/ferry/stena';

const HTML = readFileSync(new URL('./fixtures/polferries-komunikaty-2026-09-25.html', import.meta.url), 'utf8');
const AIS = JSON.parse(readFileSync(new URL('./fixtures/digitraffic-nova-star-2026-09-25.json', import.meta.url), 'utf8'));

describe('Polferries — prawdziwa strona z 25.09.2026', () => {
  const r = parsePolferriesStatus(HTML);
  const gn = r.sailings.filter((s) => s.route === 'GDN-NYN');
  const ng = r.sailings.filter((s) => s.route === 'NYN-GDN');

  it('odczytuje rejsy w obu kierunkach linii Gdańsk – Nynäshamn', () => {
    expect(gn.length).toBeGreaterThan(0);
    expect(ng.length).toBeGreaterThan(0);
  });
  it('wyłącznie statki tej linii', () => {
    for (const s of r.sailings) expect(['M/F Wawel', 'M/F Nova Star']).toContain(s.vessel);
  });
  it('pomija inne linie (Świnoujście, Karlshamn)', () => {
    expect(r.sailings.every((s) => s.route === 'GDN-NYN' || s.route === 'NYN-GDN')).toBe(true);
  });
  it('odejście 18:00 czasu polskiego we wrześniu = 16:00 UTC; przyjście +1 dzień 12:00 = 10:00 UTC', () => {
    const s = gn.find((x) => x.date === '2026-09-25')!;
    expect(s.plannedDepartureUtc).toBe('2026-09-25T16:00:00.000Z');
    expect(s.plannedArrivalUtc).toBe('2026-09-26T10:00:00.000Z');
  });
  it('wszystkie rejsy planowo, bez ostrzeżeń', () => {
    expect(r.sailings.every((s) => s.status === 'ZAPLANOWANY')).toBe(true);
    expect(r.warnings).toEqual([]);
  });
});

describe('Polferries — przypadki, których na stronie dziś nie ma', () => {
  const one = HTML.slice(0);
  const mutate = (fn: (h: string) => string) => parsePolferriesStatus(fn(one));

  it('godzina w treści komunikatu inna niż planowa → OPÓŹNIONY z nową godziną', () => {
    const r = mutate((h) => {
      const i = h.indexOf('2026-09-25 M/F Nova Star');
      const b = h.indexOf('--schedule-item--body', i);
      const t = h.indexOf('>18:00<', b);
      return h.slice(0, t) + '>21:00<' + h.slice(t + 7);
    });
    const s = r.sailings.find((x) => x.route === 'GDN-NYN' && x.date === '2026-09-25')!;
    expect(s.status).toBe('OPOZNIONY');
    expect(s.expectedDepartureUtc).toBe('2026-09-25T19:00:00.000Z');
    expect(s.plannedDepartureUtc).toBe('2026-09-25T16:00:00.000Z');
  });
  // Zmiana DOKŁADNIE w rejsie Gdańsk → Nynäshamn z 25.09 — pierwsze „Planowo"
  // na stronie należy do linii Świnoujście – Ystad, którą parser słusznie pomija.
  const inGdnItem = (h: string, cls: string, badge: string) => {
    const d = h.indexOf('2026-09-25 M/F Nova Star');
    const c = h.lastIndexOf('polferries--rejs--status--scheduled"', d);
    const b = h.indexOf('status-badge">Planowo<', d);
    let out = h.slice(0, b) + `status-badge">${badge}<` + h.slice(b + 'status-badge">Planowo<'.length);
    out = out.slice(0, c) + `polferries--rejs--status--${cls}"` + out.slice(c + 'polferries--rejs--status--scheduled"'.length);
    return out;
  };
  const gdn25 = (r: ReturnType<typeof parsePolferriesStatus>) =>
    r.sailings.find((x) => x.route === 'GDN-NYN' && x.date === '2026-09-25')!;

  it('odznaka „Odwołany" → ODWOŁANY', () => {
    const r = mutate((h) => inGdnItem(h, 'cancelled', 'Odwołany'));
    expect(gdn25(r).status).toBe('ODWOLANY');
  });
  it('nieznany status → NIEZNANY i ostrzeżenie, bez zgadywania', () => {
    const r = mutate((h) => inGdnItem(h, 'diverted', 'Zmiana portu'));
    expect(gdn25(r).status).toBe('NIEZNANY');
    expect(r.warnings.join(' ')).toMatch(/Nieznany status/);
  });
  it('pozostałe rejsy nietknięte', () => {
    const r = mutate((h) => inGdnItem(h, 'cancelled', 'Odwołany'));
    expect(r.sailings.filter((x) => x.status === 'ODWOLANY')).toHaveLength(1);
  });
  it('zmiana struktury strony → ostrzeżenie, nie cicha pusta lista', () => {
    const r = parsePolferriesStatus(HTML.replaceAll('navy-header', 'nowy-naglowek'));
    expect(r.sailings).toEqual([]);
    expect(r.warnings[0]).toMatch(/Struktura strony zmieniona/);
  });
});

describe('Czas lokalny → UTC przy zmianie czasu', () => {
  it('lato: 18:00 = 16:00 UTC', () => expect(localToUtc('2026-07-01', '18:00')).toBe('2026-07-01T16:00:00.000Z'));
  it('zima: 18:00 = 17:00 UTC', () => expect(localToUtc('2026-12-01', '18:00')).toBe('2026-12-01T17:00:00.000Z'));
  it('przyjście +1 dzień przez noc zmiany czasu (24→25.10.2026)', () =>
    expect(localToUtc('2026-10-24', '12:00', 1)).toBe('2026-10-25T11:00:00.000Z'));
});

describe('Digitraffic — prawdziwa odpowiedź dla Nova Star', () => {
  const fix = parseDigitrafficLocations(AIS, 311000787)!;
  it('odczytuje pozycję, prędkość i czas', () => {
    expect(fix.mmsi).toBe(311000787);
    expect(fix.lat).toBeCloseTo(57.98, 1);
    expect(fix.sogKn).toBeGreaterThan(10);
  });
  it('statek w ruchu, sygnał świeży → W_REJSIE', () => {
    const now = new Date(Date.parse(fix.timestampUtc) + 10 * 60000).toISOString();
    expect(interpretFix(fix, now)).toBe('W_REJSIE');
  });
  it('sygnał sprzed kilku godzin → BRAK_SWIEZEGO_SYGNALU, nie wniosek o statku', () => {
    const now = new Date(Date.parse(fix.timestampUtc) + 5 * 3600000).toISOString();
    expect(interpretFix(fix, now)).toBe('BRAK_SWIEZEGO_SYGNALU');
  });
  it('postój w Nynäshamn → W_PORCIE_NYNASHAMN', () => {
    const inPort = { ...fix, lat: 58.9046, lon: 17.9563, sogKn: 0.2 };
    const now = new Date(Date.parse(fix.timestampUtc) + 5 * 60000).toISOString();
    expect(interpretFix(inPort, now)).toBe('W_PORCIE_NYNASHAMN');
  });
  it('postój w Karlskrona (Stena) → W_PORCIE_KARLSKRONA', () => {
    const inPort = { ...fix, lat: 56.1646, lon: 15.6308, sogKn: 0.1 };
    const now = new Date(Date.parse(fix.timestampUtc) + 5 * 60000).toISOString();
    expect(interpretFix(inPort, now, 60, 'KAA')).toBe('W_PORCIE_KARLSKRONA');
  });

  it('II-9: brak pozycji / stary sygnał / brak SOG → null (nie opóźnienie)', () => {
    const now = '2026-10-01T10:00:00Z';
    const dep = '2026-10-01T12:00:00Z';
    expect(aisDepartureDelayMin(
      { mmsi: 1, lat: 56, lon: 18, sogKn: null, cog: null, navStat: null, timestampUtc: now },
      now, dep, 'GDN-NYN',
    )).toBeNull();
    expect(aisDepartureDelayMin(
      { mmsi: 1, lat: 56, lon: 18, sogKn: 15, cog: null, navStat: null, timestampUtc: '2026-10-01T08:00:00Z' },
      now, dep, 'GDN-NYN',
    )).toBeNull();
  });

  it('II-9: daleko przy małej prędkości → opóźnienie > 0', () => {
    const now = '2026-10-01T10:00:00Z';
    const dep = '2026-10-01T11:00:00Z'; // 1 h do odejścia
    // ~200 km od Gdańska, 10 kn ≈ 18,5 km/h → ~10,8 h → spóźnienie
    const d = aisDepartureDelayMin(
      { mmsi: 1, lat: 56.0, lon: 18.0, sogKn: 10, cog: null, navStat: null, timestampUtc: now },
      now, dep, 'GDN-NYN',
    );
    expect(d).not.toBeNull();
    expect(d!).toBeGreaterThan(60);
  });

  it('II-9: w porcie odejścia → null', () => {
    const now = '2026-10-01T10:00:00Z';
    expect(aisDepartureDelayMin(
      { mmsi: 1, lat: 54.40372, lon: 18.68130, sogKn: 5, cog: null, navStat: null, timestampUtc: now },
      now, '2026-10-01T12:00:00Z', 'GDN-NYN',
    )).toBeNull();
  });
});

describe('Stena Line — JSON rozkładu 01.10.2026', () => {
  const GDKA = JSON.parse(readFileSync(new URL('./fixtures/stena-timetable-gdka-2026-10-01.json', import.meta.url), 'utf8'));
  const KAGD = JSON.parse(readFileSync(new URL('./fixtures/stena-timetable-kagd-2026-10-01.json', import.meta.url), 'utf8'));

  it('URL publiczny AEM z kodem trasy i datą', () => {
    expect(stenaTimetableUrl('GDKA', '2026-10-01')).toMatch(/timetable\.GDKA\.2026-10-01\.json$/);
  });
  it('odczytuje rejsy Gdynia→Karlskrona z nazwami M/F Stena *', () => {
    const r = parseStenaTimetable(GDKA, { routeCode: 'GDKA', dateYmd: '2026-10-01' });
    expect(r.warnings).toEqual([]);
    expect(r.sailings.length).toBeGreaterThanOrEqual(3);
    expect(r.sailings.every((s) => s.route === 'GDY-KAA')).toBe(true);
    expect(r.sailings.map((s) => s.vessel).sort()).toEqual(
      expect.arrayContaining(['M/F Stena Ebba', 'M/F Stena Spirit', 'M/F Stena Estelle']),
    );
  });
  it('Karlskrona→Gdynia: 08:00 lokalnie SE = 06:00 UTC latem', () => {
    const r = parseStenaTimetable(KAGD, { routeCode: 'KAGD', dateYmd: '2026-10-01' });
    const este = r.sailings.find((s) => s.vessel === 'M/F Stena Estelle' && s.date === '2026-10-01')!;
    expect(este.departureUtc).toBe('2026-10-01T06:00:00.000Z');
    expect(este.status).toBe('ZAPLANOWANY');
  });
  it('Delayed → OPOZNIONY; Cancelled → ODWOŁANY; nieznany → NIEZNANY', () => {
    const delayed = structuredClone(GDKA);
    delayed[0].status = 'Delayed';
    delayed[0].estimatedLocalDepartureTime = '2026-10-01T09:30:00';
    expect(parseStenaTimetable(delayed).sailings[0].status).toBe('OPOZNIONY');
    const cancelled = structuredClone(GDKA);
    cancelled[0].status = 'Cancelled';
    expect(parseStenaTimetable(cancelled).sailings[0].status).toBe('ODWOLANY');
    const weird = structuredClone(GDKA);
    weird[0].status = 'Diverted';
    const r = parseStenaTimetable(weird);
    expect(r.sailings[0].status).toBe('NIEZNANY');
    expect(r.warnings.join(' ')).toMatch(/Nieznany status/);
  });
  it('zmiana struktury (nie tablica) → ostrzeżenie, pusta lista', () => {
    const r = parseStenaTimetable({ oops: true });
    expect(r.sailings).toEqual([]);
    expect(r.warnings[0]).toMatch(/Struktura rozkładu Stena zmieniona/);
  });
});

describe('AIS-SRC — parser Steny i znacznik', () => {
  it('współrzędne z properties, nie z geometry.coordinates (lat, lon)', async () => {
    const { parseStenaFerries } = await import('../src/lib/ferry/stenaAis');
    const parsed = parseStenaFerries({
      data: [{
        geometry: { type: 'Point', coordinates: [55.09783936, 18.12014198] },
        properties: {
          imo: 7907661, mmsi: 219031605, latitude: 55.09783936, longitude: 18.12014198,
          dt_pos_utc: '2026-10-04 23:29:58', eta: '2026-10-05T06:00:00Z', sog: 15.9,
        },
      }],
    });
    expect(parsed.warning).toBeNull();
    expect(parsed.fixes[0].lat).toBe(55.09783936);
    expect(parsed.fixes[0].lon).toBe(18.12014198);
    expect(parsed.fixes[0].lon).not.toBe(55.09783936);
    expect(parsed.fixes[0].source).toBe('STENA');
    expect(parsed.fixes[0].timestampUtc).toBe('2026-10-04T23:29:58.000Z');
  });
  it('pozycja starsza niż 15 min → znacznik wyszarzony; 24 h nie jest mierzone tej nocy', async () => {
    const { ferryMarkerTone, pickNewerFix, STENA_FRESHNESS_24H } = await import('../src/lib/ferry/stenaAis');
    expect(ferryMarkerTone('2026-10-04T23:00:00Z', '2026-10-04T23:16:00Z')).toBe('stale');
    expect(ferryMarkerTone('2026-10-04T23:00:00Z', '2026-10-04T23:10:00Z')).toBe('fresh');
    const newer = pickNewerFix([
      { mmsi: 1, lat: 1, lon: 2, sogKn: null, cog: null, navStat: null, timestampUtc: '2026-10-04T23:00:00Z', source: 'STENA' },
      { mmsi: 1, lat: 3, lon: 4, sogKn: null, cog: null, navStat: null, timestampUtc: '2026-10-04T23:20:00Z', source: 'DIGITRAFFIC' },
    ]);
    expect(newer?.source).toBe('DIGITRAFFIC');
    expect(newer?.lat).toBe(3);
    expect(STENA_FRESHNESS_24H).toMatchObject({ hours: 24, maxAgeMin: 5, vessels: 3, runTonight: false });
  });
});
