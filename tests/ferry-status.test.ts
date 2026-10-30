import { describe, expect, it } from 'vitest';
import { parseStenaFreightTimetable, freightSecurityToken, freightWindow } from '../supabase/functions/_shared/ferry/stenaFreight';
import { evaluateMarineWindow, marinePointsForRoute } from '../supabase/functions/_shared/ferry/marineWeather';
import { trafikverketSituationQuery } from '../supabase/functions/_shared/integrations/road';
import { d19Pl } from '../src/i18n/d19Extra';
import { ferryPortPl, ferryStatusPl } from '../src/lib/ferryStatusPl';

const HTML = `
<h3>Gdynia – Karlskrona</h3>
<span class="date">2026-10-05</span>
<div class="Rtable-cell"><span class="strikethrough">10:00</span><span class="highlight">09:47</span></div>
<div class="Rtable-cell">07:15</div>
<div class="Rtable-cell">Stena Spirit</div>
<div class="Rtable-cell">Departed</div>
<div class="Rtable-cell">21:30</div>
<div class="Rtable-cell">08:00</div>
<div class="Rtable-cell">Stena Estelle</div>
<div class="Rtable-cell">Cancelled</div>
<h3>Karlskrona – Gdynia</h3>
<span class="date">2026-10-05</span>
<div class="Rtable-cell">16:00</div>
<div class="Rtable-cell">22:30</div>
<div class="Rtable-cell">Stena Ebba</div>
<div class="Rtable-cell">Arrived</div>
`;

describe('FERRY-STATUS — rozkład Stena Freight', () => {
  it('token, okno dziś+59 (#666 decyzja 54), oba kierunki, statusy i wcześniejszy odjazd', () => {
    expect(freightSecurityToken('var ajax_object = {"security":"abc123"};')).toBe('abc123');
    const w = freightWindow(new Date('2026-10-05T22:00:00Z'));
    expect(w).toEqual({ from: '2026-10-05', to: '2026-12-03', routeCode: 'GDKA' });
    const { sailings, warnings } = parseStenaFreightTimetable(HTML);
    expect(warnings.filter((x) => /Struktura/.test(x))).toEqual([]);
    expect(sailings.map((s) => `${s.route}:${s.vessel}:${s.status}`)).toEqual([
      'GDY-KAA:M/F Stena Spirit:ZAPLANOWANY',
      'GDY-KAA:M/F Stena Estelle:ODWOLANY',
      'KAA-GDY:M/F Stena Ebba:ZAPLANOWANY',
    ]);
    const spirit = sailings[0];
    expect(spirit.departureUtc).not.toBe(spirit.expectedDepartureUtc);
    expect(Date.parse(spirit.expectedDepartureUtc)).toBeLessThan(Date.parse(spirit.departureUtc));
    expect(ferryStatusPl('Departed')).toBe('Wypłynął');
    expect(ferryStatusPl('Arrived')).toBe('Przypłynął');
    expect(ferryStatusPl('Cancelled')).toBe('Odwołany');
    expect(ferryPortPl('PLGDY')).toBe('Gdynia');
    expect(ferryPortPl('SEKAA')).toBe('Karlskrona');
    expect(ferryPortPl('PLGDN')).toBe('Gdańsk');
    expect(ferryPortPl('SENYN')).toBe('Nynäshamn');
  });

  it('zmiana struktury nie jest cichym sukcesem', () => {
    const bad = parseStenaFreightTimetable('{"success":true,"data":{}}');
    expect(bad.sailings).toEqual([]);
    expect(bad.warnings[0]).toMatch(/Struktura/);
  });
});

describe('FERRY-STATUS — pogoda i panel', () => {
  it('fala powyżej 3,8 m na obu trasach jest przekroczeniem progu', () => {
    for (const route of ['GDN-NYN', 'GDY-KAA'] as const) {
      const point = marinePointsForRoute(route)[0];
      const ev = evaluateMarineWindow([
        { point, at: '2026-10-05T12:00:00Z', waveM: 4.1, gustKn: 20, source: 'FMI' },
      ], 3.8, 40);
      expect(ev.breached).toBe(true);
      expect(ev.risk).toBe('wysokie');
    }
    expect(marinePointsForRoute('GDY-KAA')).toEqual(['GDY', 'MID_STENA', 'KAA']);
    expect(marinePointsForRoute('GDN-NYN')).toEqual(['GDN', 'MID', 'NYN', 'SMHI_KNOLLS']);
  });

  it('zapytanie Trafikverket i tytuł panelu obejmują E4 i E22', () => {
    const q = trafikverketSituationQuery('klucz-test');
    expect(q).toContain('value="E4"');
    expect(q).toContain('value="E22"');
    expect(d19Pl.risk_road_se_title).toMatch(/E4/);
    expect(d19Pl.risk_road_se_title).toMatch(/E22/);
  });
});
