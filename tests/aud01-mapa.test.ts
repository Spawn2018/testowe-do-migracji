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

describe('AUD-01 kafelki: brzeg Vercel, nie host danych', () => {
  it('produkcja → /tiles/<motyw>/<z>/<x>/<y> na domenie aplikacji', () => {
    expect(tileUrl({ z: 5, x: 17, y: 9 }, 'dark', 'tower.log-mar.pl')).toEqual({ url: '/tiles/dark/5/17/9', viaEdge: true });
    expect(tileUrl({ z: 5, x: 17, y: 9 }, 'light', 'watch-tower-makieta.vercel.app').viaEdge).toBe(true);
  });
  it('localhost → wprost do funkcji', () => {
    const r = tileUrl({ z: 1, x: 0, y: 1 }, 'light', '127.0.0.1');
    expect(r.viaEdge).toBe(false);
    expect(r.url).toMatch(/\/functions\/v1\/here-raster\?z=1&x=0&y=1&theme=light&forceFunctionRegion=eu-west-1$/);
  });
  it('vercel.json: przepisanie /tiles → here-raster z pamięcią brzegu', () => {
    const v = JSON.parse(read('vercel.json')) as { rewrites: { source: string; destination: string }[]; headers: { source: string; headers: { key: string; value: string }[] }[] };
    const rw = v.rewrites.find((r) => r.source.startsWith('/tiles/'));
    expect(rw?.destination).toMatch(/^https:\/\/nglnnrmzmhusvxslousq\.supabase\.co\/functions\/v1\/here-raster\?theme=:theme&z=:z&x=:x&y=:y&forceFunctionRegion=eu-west-1$/);
    const h = v.headers.find((x) => x.source === '/tiles/(.*)');
    expect(h?.headers).toContainEqual({ key: 'x-vercel-enable-rewrite-caching', value: '1' });
  });
  it('here-raster: token z x-wt-token, pamięć brzegu tylko dla 200, licznik D-78 przy każdym pobraniu z HERE', () => {
    const f = read('supabase/functions/here-raster/index.ts');
    expect(f).toMatch(/x-wt-token/);
    expect(f).toMatch(/'vercel-cdn-cache-control': 'max-age=604800'/);
    expect(f).toMatch(/here_note_service', \{ p_service: 'tiles', p_n: n/);
    expect(f).toMatch(/pending \+= 1/);
    expect(f).not.toMatch(/private, max-age/);
    expect(f).toMatch(/headers\.delete\('vary'\)/);
  });
  it('AUD-01b here-raster: sesja bez bazy (JWKS), budżet raz na 60 s, 404 spoza siatki w pamięci brzegu', () => {
    const f = read('supabase/functions/here-raster/index.ts');
    expect(f).toMatch(/createRemoteJWKSet\(new URL\(`\$\{supabaseUrl\}\/auth\/v1\/\.well-known\/jwks\.json`\)/);
    expect(f).toMatch(/audience: 'authenticated'/);
    expect(f).toMatch(/now - openCache\.at < 60_000/);
    expect(f).toMatch(/status: 404, headers: h/);
    const serve = f.slice(f.indexOf('Deno.serve'));
    expect(serve).not.toMatch(/auth\.getUser|rpc\('here_tiles_open'\)|rpc\('here_note_service'/);
    expect(read('src/components/map/applyBasemap.ts')).toMatch(/here-roads\?forceFunctionRegion=\$\{FUNCTION_REGION\}/);
  });
  it('podkład bez czekania na map_display_state; jeden odczyt stanu na stronę', () => {
    const b = read('src/components/map/applyBasemap.ts');
    const resolve = b.slice(b.indexOf('export async function resolveBasemap'), b.indexOf('export function tileUrl'));
    expect(resolve).not.toMatch(/map_display_state|rpc\(/);
    expect(b.match(/rpc\('map_display_state'\)/g)).toHaveLength(1);
  });
  it('mapa: dane dopiero po podkładzie (albo 1,5 s)', () => {
    const c = read('src/components/map/CorridorMap.tsx');
    expect(c).toMatch(/layer\.once\('load'/);
    expect(c).toMatch(/setBasemapReady\(true\); \}, 1500\)/);
  });
});
