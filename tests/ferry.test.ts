/**
 * TOWER — testy źródeł statusu promu.
 * Dane: prawdziwa strona komunikatów Polferries i prawdziwa odpowiedź
 * Digitraffic, zapisane 25.09.2026 w tests/fixtures/.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parsePolferriesStatus, localToUtc } from '../src/lib/ferry/polferries';
import { parseDigitrafficLocations, interpretFix } from '../src/lib/ferry/digitraffic';

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
    const inPort = { ...fix, lat: 58.9352, lon: 17.9510, sogKn: 0.2 };
    const now = new Date(Date.parse(fix.timestampUtc) + 5 * 60000).toISOString();
    expect(interpretFix(inPort, now)).toBe('W_PORCIE_NYNASHAMN');
  });
});
