/**
 * AUD-04 (A4) — PL-DATA: tytuły sytuacji Trafikverket po polsku ze słownika (bez DeepL) + kafelki HERE z napisami po polsku.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { plSeLocation } from '../src/lib/pl/seLocation';
import { describeDeviation } from '../src/lib/pl/describe';
import { riskFromRow } from '../src/data/mappers';
import { renderNotice } from '../supabase/functions/_shared/notifyTemplates';
import { directTileTemplate } from '../src/components/map/hereTileMeter';
import { TILE_LANG, tileLang, tileCacheControl } from '../supabase/functions/_shared/map/tilePolicy';

vi.mock('leaflet', () => ({ default: {} }));
const { tileUrl } = await import('../src/components/map/applyBasemap');

/* tytuły z produkcji (risk_signals, 06.10) */
const CASES: [string, string][] = [
  ['E4: från Hörnefors till Stöcksjö båda riktningarna i Västerbottens län (AC)', 'E4: od Hörnefors do Stöcksjö, oba kierunki, region Västerbotten'],
  ['E4: från Backen till Gärde båda riktningarna i Gävleborgs län (X)', 'E4: od Backen do Gärde, oba kierunki, region Gävleborg'],
  ['från Dockstabaren till Docksta Marina i riktning mot Sundsvall i Västernorrlands län (Y)', 'od Dockstabaren do Docksta Marina, w kierunku Sundsvall, region Västernorrland'],
  ['E4: E 4 mellan Vattrång och Harmånger, i båda riktningar.', 'E4: między Vattrång a Harmånger, oba kierunki'],
  ['E4: E 4 vid Trafikplats Torsboda II (236), i riktning mot Härnösand.', 'E4: przy węźle Torsboda II (236), w kierunku Härnösand'],
  ['E4: E22 från Trafikplats Ronneby V (56) till Trafikplats Galtsjön i riktning mot Kristianstad i Blekinge län (K)', 'E22: od węzła Ronneby V (56) do węzła Galtsjön, w kierunku Kristianstad, region Blekinge'],
  ['E22 från Trafikplats Karlshamn Ö (53) till Trafikplats Karlshamn V (51) båda riktningarna i Blekinge län (K)', 'E22 od węzła Karlshamn Ö (53) do węzła Karlshamn V (51), oba kierunki, region Blekinge'],
  ['E4: E4.26 mellan E4 (Linvävarvägen) och E20 (Norrtullspåfarten) i Solna kommun', 'E4: E4.26 między E4 (Linvävarvägen) a E20 (Norrtullspåfarten), gmina Solna'],
  ['E4: vid Söderköpings kommun  i Östergötlands län (E)', 'E4: gmina Söderköping, region Östergötland'],
  ['mellan E4 (Linvävarvägen) och E20 (Norrtullspåfarten) i Solna kommun', 'między E4 (Linvävarvägen) a E20 (Norrtullspåfarten), gmina Solna'],
  ['från Cirkulationsplats Skellefteå N till Trafikplats Solbacken i riktning mot Haparanda i Västerbottens län (AC)', 'od ronda Skellefteå N do węzła Solbacken, w kierunku Haparanda, region Västerbotten'],
  ['från Länsgr. Västerbottens/Norrbottens län vid Kinnbäck till Trafikplats Björkhammar båda riktningarna i Västerbottens län (AC)', 'od granicy regionów Västerbotten/Norrbotten przy Kinnbäck do węzła Björkhammar, oba kierunki, region Västerbotten'],
  ['Warunki drogowe E4: roboty drogowe, från Trafikplats Brunnby (184) till Trafikplats Säby (186) båda riktningarna i Uppsala län (C), duży wpływ na ruch, od 06.10, 21:06 do 07.10, 05:00',
    'Warunki drogowe E4: roboty drogowe, od węzła Brunnby (184) do węzła Säby (186), oba kierunki, region Uppsala, duży wpływ na ruch, od 06.10, 21:06 do 07.10, 05:00'],
];
const SWEDISH = /(?<!\p{L})(från|till|mellan|och|båda|riktning\p{L}*|län|vid|mot|kommun|Trafikplats|Cirkulationsplats)(?!\p{L})|\([A-Z]{1,2}\)/u;

describe('AUD-04 tytuły Trafikverket po polsku (słownik, bez DeepL)', () => {
  it.each(CASES)('%s', (sv, pl) => {
    const out = plSeLocation(sv);
    expect(out).toBe(pl);
    expect(out).not.toMatch(SWEDISH);
    expect(plSeLocation(out)).toBe(out); // idempotentne — tekst polski bez zmian
  });
  it('tekst polski i nazwy miejscowości bez zmian', () => {
    expect(plSeLocation('E4 Gävle — roboty drogowe')).toBe('E4 Gävle — roboty drogowe');
    expect(plSeLocation('Tillberga, Mellansel, Länna')).toBe('Tillberga, Mellansel, Länna');
  });
  it('pobranie (Edge): describeDeviation składa miejsce po polsku z LocationDescriptor', () => {
    const r = describeDeviation({ LocationDescriptor: 'E4 från Hörnefors till Stöcksjö båda riktningarna i Västerbottens län (AC)', MessageType: 'Vägarbete' }, 'roboty', 'E4');
    expect(r.title).toContain('od Hörnefors do Stöcksjö, oba kierunki, region Västerbotten');
    expect(r.title).not.toMatch(SWEDISH);
  });
  it('tytuły już zapisane w bazie: riskFromRow (tytuł i parametry) po polsku', () => {
    const risk = riskFromRow({
      id: 'r1', load_id: null, kind: 'ROAD_SE', severity: 'LOW', title_key: 'rk_road_se', detected_at: '2026-10-06T10:00:00Z',
      title: 'E4: från Hörnefors till Stöcksjö båda riktningarna i Västerbottens län (AC)',
      detail: { params: { event: 'från Backen till Gärde båda riktningarna i Gävleborgs län (X)' } },
    }, '2026-10-06T12:00:00Z');
    expect(risk.title).toBe('E4: od Hörnefors do Stöcksjö, oba kierunki, region Västerbotten');
    expect(risk.titleParams?.event).toBe('od Backen do Gärde, oba kierunki, region Gävleborg');
  });
  it('dzwonek: RISK_OPEN z tytułem szwedzkim → polski', () => {
    const n = renderNotice({ template: 'RISK_OPEN', payload: { title: 'E4: från Hörnefors till Stöcksjö båda riktningarna i Västerbottens län (AC)', severity: 'LOW', locale: 'pl' } });
    expect(n.subject).toBe('Nowe ryzyko: E4: od Hörnefors do Stöcksjö, oba kierunki, region Västerbotten');
  });
  it('bez DeepL: moduł słownika nie woła sieci', () => {
    const f = vi.spyOn(globalThis, 'fetch');
    for (const [sv] of CASES) plSeLocation(sv);
    expect(f).not.toHaveBeenCalled();
    f.mockRestore();
    expect(readFileSync('src/lib/pl/seLocation.ts', 'utf8')).not.toMatch(/^import|fetch\(/m);
  });
});

describe('AUD-04 kafelki HERE z napisami po polsku (Raster Tile API v3 `lang`)', () => {
  it('wprost z HERE (klucz przeglądarkowy): lang=pl', () => {
    expect(TILE_LANG).toBe('pl');
    expect(directTileTemplate('light', 'k')).toBe('https://maps.hereapi.com/v3/base/mc/{z}/{x}/{y}/png?style=logistics.day&size=256&lang=pl&apiKey=k');
  });
  it('zapas: /tiles?lang=pl (nowy klucz pamięci przeglądarki) i wprost do funkcji z lang=pl', () => {
    expect(tileUrl({ z: 5, x: 17, y: 9 }, 'light', 'tower.log-mar.pl').url).toBe('/tiles/logistics.day/5/17/9?lang=pl');
    expect(tileUrl({ z: 1, x: 0, y: 1 }, 'dark', 'localhost').url).toMatch(/here-raster\?style=logistics\.night&z=1&x=0&y=1&lang=pl&/);
  });
  it('here-raster: lang z listy (tylko pl), inne → pl; adres HERE z lang', () => {
    expect(tileLang(null)).toBe('pl');
    expect(tileLang('pl')).toBe('pl');
    expect(tileLang('sv&apiKey=x')).toBe('pl');
    const src = readFileSync('supabase/functions/here-raster/index.ts', 'utf8');
    expect(src).toMatch(/&size=256&lang=\$\{tileLang\(url\.searchParams\.get\('lang'\)\)\}&apiKey=/);
  });
  it('api/tiles przekazuje lang=pl do here-raster; pamięć tylko przeglądarki ≤ 24 h, bez s-maxage', async () => {
    const t = await import('../api/tiles.js');
    const real = globalThis.fetch;
    try {
      globalThis.fetch = vi.fn(async () => new Response(new Uint8Array([0x89, 0x50]), { headers: { 'content-type': 'image/png', 'cache-control': 'public, max-age=86400, s-maxage=86400' } })) as typeof fetch;
      const ok = await t.GET(new Request('https://tower.log-mar.pl/api/tiles?style=logistics.day&z=6&x=35&y=21&lang=pl'));
      expect(ok.status).toBe(200);
      expect(ok.headers.get('cache-control')).toBe('private, max-age=86400');
      expect(String((globalThis.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls[0][0])).toMatch(/&lang=pl&forceFunctionRegion=/);
    } finally {
      globalThis.fetch = real;
    }
    expect(tileCacheControl('max-age=172800')).toMatch(/^private, max-age=86400$/);
  });
});
