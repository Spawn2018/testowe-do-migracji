/**
 * AUD-01 (audyt 06.10, A1) — mapa: pozycje jednym zapytaniem, kafelki przez brzeg Vercel, podkład przed danymi.
 */
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.fn();
vi.mock('../src/auth/client', () => ({ getSupabase: async () => ({ rpc }) }));
vi.mock('leaflet', () => ({ default: {} }));

const { fetchLatestVehicleFixes, fixIds, parseFixRows, __resetFixCache, FIX_TTL_MS } = await import('../src/lib/vehiclePositions');
const { tileUrl } = await import('../src/components/map/applyBasemap');

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

describe('AUD-01 pozycje GPS: jedno zapytanie', () => {
  beforeEach(() => { rpc.mockReset(); __resetFixCache(); });

  it('94 transporty → jedno wywołanie latest_vehicle_fixes, zwraca tylko te z pozycją', async () => {
    const ids = Array.from({ length: 94 }, (_, i) => id(i + 1));
    rpc.mockResolvedValue({ data: [{ load_id: ids[5], ts: '2026-10-06T08:00:00Z', lat: 52.1, lng: 17.0 }], error: null });
    const out = await fetchLatestVehicleFixes([...ids, 'demo-1', ids[0]]);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc.mock.calls[0][0]).toBe('latest_vehicle_fixes');
    expect((rpc.mock.calls[0][1] as { p_loads: string[] }).p_loads).toHaveLength(94);
    expect(out).toEqual([{ loadId: ids[5], lat: 52.1, lng: 17.0 }]);
  });

  it('ten sam zestaw w TTL (Mapa: licznik + mapa korytarza) → nadal jedno zapytanie; po TTL — nowe', async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    const ids = [id(2), id(1)];
    await Promise.all([fetchLatestVehicleFixes(ids, 1000), fetchLatestVehicleFixes([id(1), id(2)], 1500)]);
    expect(rpc).toHaveBeenCalledTimes(1);
    await fetchLatestVehicleFixes(ids, 1000 + FIX_TTL_MS + 1);
    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it('brak transportów z serwera → zero zapytań; błąd → jedna ponowna próba, potem brak pozycji (bez zapamiętania)', async () => {
    const wait = vi.fn(async () => {});
    expect(await fetchLatestVehicleFixes(['demo-1', 'x'], 0, wait)).toEqual([]);
    expect(rpc).not.toHaveBeenCalled();
    rpc.mockResolvedValue({ data: null, error: { message: 'canceling statement due to statement timeout' } });
    expect(await fetchLatestVehicleFixes([id(1)], 0, wait)).toEqual([]);
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(wait).toHaveBeenCalledWith(1500);
    rpc.mockReset();
    rpc.mockResolvedValue({ data: [{ load_id: id(1), lat: 1, lng: 2 }], error: null });
    expect(await fetchLatestVehicleFixes([id(1)], 1, wait)).toEqual([{ loadId: id(1), lat: 1, lng: 2 }]);
    expect(rpc).toHaveBeenCalledTimes(1);
  });
  it('AUD-01b: 500 (statement timeout) w pierwszej próbie, 200 w drugiej → pozycje są', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'timeout' } }).mockResolvedValueOnce({ data: [{ load_id: id(7), lat: 3, lng: 4 }], error: null });
    expect(await fetchLatestVehicleFixes([id(7)], 0, async () => {})).toEqual([{ loadId: id(7), lat: 3, lng: 4 }]);
  });

  it('parseFixRows odrzuca puste i nienumeryczne współrzędne; fixIds sortuje i usuwa duplikaty', () => {
    expect(parseFixRows([{ load_id: id(1), lat: null, lng: 1 }, { load_id: id(2), lat: 'a', lng: 1 }, { load_id: id(3), lat: 1, lng: 2 }]))
      .toEqual([{ loadId: id(3), lat: 1, lng: 2 }]);
    expect(fixIds([id(3), id(1), id(3), 'demo'])).toEqual([id(1), id(3)]);
  });

  it('w kodzie mapy nie ma już load_track per transport (tylko odtwarzanie wybranego transportu)', () => {
    expect(read('src/lib/vehiclePositions.ts')).not.toMatch(/rpc\('load_track'/);
    expect(read('src/components/map/CorridorMap.tsx')).not.toMatch(/rpc\('load_track'/);
    expect(read('src/views/MapView.tsx')).not.toMatch(/rpc\('load_track'/);
    expect(read('src/components/map/TrackReplay.tsx')).toMatch(/if \(noFix\) return/);
    expect(read('supabase/migrations/0190_aud01_latest_vehicle_fixes.sql')).toMatch(/security invoker/);
  });
});

describe('AUD-01c kafelki: publiczne, /tiles/<styl HERE>, brzeg Vercel (fra1) → here-raster (eu-central-1)', () => {
  it('produkcja → /tiles/logistics.day|logistics.night/<z>/<x>/<y> na domenie aplikacji', () => {
    expect(tileUrl({ z: 5, x: 17, y: 9 }, 'dark', 'tower.log-mar.pl')).toEqual({ url: '/tiles/logistics.night/5/17/9?lang=pl', viaEdge: true });
    expect(tileUrl({ z: 5, x: 17, y: 9 }, 'light', 'watch-tower-makieta.vercel.app')).toEqual({ url: '/tiles/logistics.day/5/17/9?lang=pl', viaEdge: true });
  });
  it('localhost → wprost do funkcji, region eu-central-1', () => {
    const r = tileUrl({ z: 1, x: 0, y: 1 }, 'light', '127.0.0.1');
    expect(r.viaEdge).toBe(false);
    expect(r.url).toMatch(/\/functions\/v1\/here-raster\?style=logistics\.day&z=1&x=0&y=1&lang=pl&forceFunctionRegion=eu-central-1$/);
  });
  it('vercel.json: /tiles/<styl>/… → api/tiles; region fra1; bez przepisania na Supabase', () => {
    const v = JSON.parse(read('vercel.json')) as { regions: string[]; rewrites: { source: string; destination: string }[] };
    expect(v.regions).toEqual(['fra1']);
    const rw = v.rewrites.filter((r) => r.source.startsWith('/tiles/'));
    expect(rw.length).toBe(2);
    for (const r of rw) expect(r.destination).toBe('/api/tiles?style=:style&z=:z&x=:x&y=:y');
    expect(JSON.stringify(v)).not.toMatch(/supabase\.co\/functions/);
  });
  it('api/tiles: style HERE i light/dark, siatka, eu-central-1, bez ciasteczek i bez autoryzacji', async () => {
    const t = await import('../api/tiles.js');
    expect(t.parseTile('https://x/api/tiles?style=logistics.day&z=6&x=35&y=21')).toEqual({ style: 'logistics.day', z: 6, x: 35, y: 21 });
    expect(t.parseTile('https://x/api/tiles?style=logistics.night&z=0&x=0&y=0')).toMatchObject({ style: 'logistics.night' });
    expect(t.parseTile('https://x/api/tiles?style=dark&z=4&x=15&y=15')).toMatchObject({ style: 'dark' });
    expect(t.parseTile('https://x/api/tiles?style=satellite&z=4&x=1&y=1')).toEqual({ error: 'styl' });
    expect(t.parseTile('https://x/api/tiles?style=light&z=4&x=99&y=0')).toEqual({ error: 'siatka' });
    expect(t.parseTile('https://x/api/tiles?style=light&z=20&x=0&y=0')).toEqual({ error: 'siatka' });
    expect(t.TILE_REGION).toBe('eu-central-1');
    const src = read('api/tiles.js');
    expect(src).not.toMatch(/'set-cookie'|Authorization|'vary'/);
  });
  it('api/tiles GET (AUD-01d): obraz → 200 private (bez s-maxage, nawet gdy upstream poda public); błąd → no-store; 404 spoza siatki → private 1 h', async () => {
    const t = await import('../api/tiles.js');
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    const real = globalThis.fetch;
    try {
      globalThis.fetch = vi.fn(async () => new Response(png, { headers: { 'content-type': 'image/png', 'cache-control': 'public, max-age=3600, s-maxage=3600', 'set-cookie': 'a=b', 'x-sb-edge-region': 'eu-central-1' } })) as typeof fetch;
      const ok = await t.GET(new Request('https://tower.log-mar.pl/api/tiles?style=logistics.day&z=6&x=35&y=21'));
      expect(ok.status).toBe(200);
      expect(ok.headers.get('cache-control')).toBe('private, max-age=3600');
      expect(ok.headers.get('set-cookie')).toBeNull();
      expect(ok.headers.get('x-sb-edge-region')).toBe('eu-central-1');
      expect(String((globalThis.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls[0][0])).toMatch(/style=logistics\.day&z=6&x=35&y=21&lang=pl&forceFunctionRegion=eu-central-1$/);
      globalThis.fetch = vi.fn(async () => Response.json({ fallback: true }, { status: 409 })) as typeof fetch;
      const closed = await t.GET(new Request('https://tower.log-mar.pl/api/tiles?style=light&z=6&x=35&y=21'));
      expect(closed.status).toBe(409);
      expect(closed.headers.get('cache-control')).toBe('no-store');
      const bad = await t.GET(new Request('https://tower.log-mar.pl/api/tiles?style=light&z=4&x=99&y=0'));
      expect(bad.status).toBe(404);
      expect(bad.headers.get('cache-control')).toBe('private, max-age=3600');
      expect(t.privateCache('public, max-age=99999, s-maxage=99999')).toBe('private, max-age=86400');
    } finally {
      globalThis.fetch = real;
    }
  });
  it('zasady kafelków: Referer tylko dwie domeny, AUD-01d private max-age z nagłówka HERE (≤ 24 h), limit częstości', async () => {
    const p = await import('../supabase/functions/_shared/map/tilePolicy');
    expect(p.refererOk(null)).toBe(true);
    expect(p.refererOk('https://tower.log-mar.pl/#/mapa')).toBe(true);
    expect(p.refererOk('https://watch-tower-makieta.vercel.app/')).toBe(true);
    expect(p.refererOk('https://evil.example/')).toBe(false);
    expect(p.refererOk('https://tower.log-mar.pl.evil.example/')).toBe(false);
    expect(p.browserSeconds('max-age=3600')).toBe(3600);
    expect(p.browserSeconds('public, max-age=86400')).toBe(86400);
    expect(p.browserSeconds('max-age=99999999')).toBe(86400);
    expect(p.browserSeconds(null)).toBe(3600);
    expect(p.tileCacheControl('max-age=3600')).toBe('private, max-age=3600');
    expect(p.tileCacheControl('public, max-age=604800')).not.toMatch(/s-maxage|public/);
    expect(p.STYLE.light).toBe('logistics.day');
    expect(p.STYLE.dark).toBe('logistics.night');
    expect(p.gridOk(19, 2 ** 19 - 1, 0)).toBe(true);
    expect(p.gridOk(4, 16, 0)).toBe(false);
    const ok = p.rateLimiter({ perIp: 2, total: 3, windowMs: 1000 });
    expect([ok('a', 0), ok('a', 1), ok('a', 2)]).toEqual([true, true, false]);
    expect([ok('b', 3), ok('c', 4)]).toEqual([true, false]);
    expect(ok('a', 1000)).toBe(true);
  });
  it('here-raster: bez sesji, licznik D-78 przy każdym pobraniu z HERE, budżet 60 s, błędy no-store', () => {
    const f = read('supabase/functions/here-raster/index.ts');
    expect(f).not.toMatch(/getUser|jwtVerify|x-wt-token/);
    expect(f).toMatch(/here_note_service', \{ p_service: 'tiles', p_n: n/);
    expect(f).toMatch(/pending \+= 1/);
    expect(f).toMatch(/now - openCache\.at < 60_000/);
    expect(f).toMatch(/reply\(\{ fallback: true \}, 409, NO_STORE\)/);
    expect(f).toMatch(/reply\(\{ error: 'domena' \}, 403, NO_STORE\)/);
    expect(f).toMatch(/reply\(\{ error: 'limit' \}, 429/);
    expect(f).toMatch(/reply\(\{ error: 'zly kafel' \}, 404, BAD_TILE_CACHE\)/);
    const fetchAt = f.indexOf('await fetch(');
    expect(f.indexOf('noteHereFetch();', fetchAt)).toBeGreaterThan(fetchAt);
    expect(f.indexOf('noteHereFetch();', fetchAt)).toBeLessThan(f.indexOf('upstream.ok', fetchAt));
  });
  it('klient: sonda po błędzie kafelka — 409 → zapas, 404 HTML z /tiles → wprost do funkcji', async () => {
    const { probeTileError } = await import('../src/components/map/applyBasemap');
    const f = (status: number, type: string) => (async () => new Response('x', { status, headers: { 'content-type': type } })) as unknown as typeof fetch;
    expect(await probeTileError('/tiles/a', true, f(409, 'application/json'))).toBe('closed');
    expect(await probeTileError('/tiles/a', true, f(404, 'text/html'))).toBe('edge-missing');
    expect(await probeTileError('/tiles/a', true, f(404, 'application/json'))).toBe('other');
    expect(await probeTileError('/tiles/a', true, f(502, 'application/json'))).toBe('other');
    expect(read('src/components/map/applyBasemap.ts')).not.toMatch(/x-wt-token|Authorization: `Bearer \$\{token\}`, apikey: SUPABASE_ANON_KEY, 'x-wt-token'/);
  });
  it('podkład bez czekania na map_display_state; jeden odczyt stanu na stronę', () => {
    const b = read('src/components/map/applyBasemap.ts');
    const resolve = b.slice(b.indexOf('export async function resolveBasemap'), b.indexOf('export function tileTemplate'));
    expect(resolve).not.toMatch(/map_display_state|rpc\(/);
    expect(b.match(/rpc\('map_display_state'\)/g)).toHaveLength(1);
  });
  it('mapa: dane dopiero po podkładzie (albo 1,5 s)', () => {
    const c = read('src/components/map/CorridorMap.tsx');
    expect(c).toMatch(/layer\.once\('load'/);
    expect(c).toMatch(/setBasemapReady\(true\); \}, 1500\)/);
  });
});
