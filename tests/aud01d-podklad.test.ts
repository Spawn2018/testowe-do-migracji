import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { createTileMeter, directTileTemplate, reportToSupabase, servedFromCache } from '../src/components/map/hereTileMeter';

vi.mock('leaflet', () => ({ default: {} }));

describe('AUD-01d podkład: HERE wprost z przeglądarki, licznik D-78, bez wspólnej pamięci brzegu', () => {
  it('adres kafelka wprost: maps.hereapi.com raster v3, styl logistyczny, klucz przeglądarkowy', () => {
    const u = directTileTemplate('dark', 'brow ser');
    expect(u).toBe('https://maps.hereapi.com/v3/base/mc/{z}/{x}/{y}/png?style=logistics.night&size=256&lang=pl&apiKey=brow%20ser');
    expect(directTileTemplate('light', 'k')).toContain('style=logistics.day');
  });

  it('pamięć przeglądarki: liczone wszystko, czego nie widać jako trafienie w pamięć', () => {
    const perf = (e?: Partial<PerformanceResourceTiming>) => ({ getEntriesByName: () => (e ? [e] : []) }) as unknown as Performance;
    expect(servedFromCache('u', perf({ transferSize: 0, decodedBodySize: 900 }))).toBe(true);
    expect(servedFromCache('u', perf({ transferSize: 1200, decodedBodySize: 900 }))).toBe(false);
    expect(servedFromCache('u', perf({ transferSize: 0, decodedBodySize: 0 }))).toBeNull();
    expect(servedFromCache('u', perf())).toBeNull();
  });

  it('licznik: zbiorczo, najwyżej raz na minutę, ≤ 5000 na wywołanie, ponowienie po błędzie, 80% → zapas', async () => {
    let t = 0;
    const calls: [number, boolean][] = [];
    let answer: boolean | null = true;
    const m = createTileMeter({ report: async (n, f) => { calls.push([n, f]); return answer; }, now: () => t });
    const closed = vi.fn();
    m.onClosed(closed);
    m.add(30); m.add(12);
    await m.tick();
    expect(calls).toEqual([[42, false]]);
    m.add(5);
    t = 59_000; await m.tick();
    expect(calls.length).toBe(1);
    answer = null;
    t = 60_000; await m.tick();
    expect(m.pending).toBe(5);
    m.add(6000);
    answer = false;
    t = 120_000; await m.tick();
    expect(calls.at(-1)).toEqual([5000, false]);
    expect(m.pending).toBe(1005);
    expect(closed).toHaveBeenCalledTimes(1);
    m.final();
    expect(calls.at(-1)).toEqual([1005, true]);
    expect(m.pending).toBe(0);
    m.final();
    expect(calls.at(-1)).toEqual([1005, true]);
  });

  it('pagehide: keepalive z tokenem zapamiętanym przy zwykłym zgłoszeniu, RPC here_tiles_report', async () => {
    const f = vi.fn(async () => Response.json({ tiles_open: true }));
    expect(await reportToSupabase(3, true, f as unknown as typeof fetch)).toBeNull();
    expect(f).not.toHaveBeenCalled();
    const src = readFileSync('src/components/map/hereTileMeter.ts', 'utf8');
    expect(src).toMatch(/rest\/v1\/rpc\/here_tiles_report/);
    expect(src).toMatch(/keepalive: final/);
    expect(src).toMatch(/addEventListener\('pagehide'/);
  });

  it('warstwa: z kluczem wprost do HERE + licznik; bez klucza pośrednik; po 3 błędach pośrednik; bez prefetchu', () => {
    const src = readFileSync('src/components/map/applyBasemap.ts', 'utf8');
    expect(src).toMatch(/directTilesOn\(key\)/);
    expect(src).toMatch(/\+\+errors < 3/);
    expect(src).toMatch(/servedFromCache\(src\) !== true\) meter\.add\(1\)/);
    expect(src).not.toMatch(/prefetch|keepBuffer|preload/i);
    expect(src).not.toMatch(/HERE_API_KEY/);
  });

  it('klucz serwerowy nie trafia do klienta; CSP img-src zawiera maps.hereapi.com; brak s-maxage dla kafelków', () => {
    const vercel = readFileSync('vercel.json', 'utf8');
    const headers = readFileSync('public/_headers', 'utf8');
    expect(vercel).toMatch(/img-src [^;]*https:\/\/maps\.hereapi\.com/);
    expect(headers).toMatch(/img-src [^;]*https:\/\/maps\.hereapi\.com/);
    expect(vercel).not.toMatch(/rewrite-caching|s-maxage|CDN-Cache-Control/i);
    for (const f of ['api/tiles.js', 'supabase/functions/here-raster/index.ts', 'supabase/functions/_shared/map/tilePolicy.ts']) {
      expect(readFileSync(f, 'utf8')).not.toMatch(/'[^']*s-maxage=\d/);
    }
    const env = readFileSync('src/vite-env.d.ts', 'utf8');
    expect(env).toMatch(/VITE_HERE_BROWSER_KEY/);
    expect(env).not.toMatch(/VITE_HERE_API_KEY/);
  });

  it('migracja 0191: RPC dla zalogowanego, limity, zwraca tiles_open', () => {
    const sql = readFileSync('supabase/migrations/0191_aud01d_here_tiles_report.sql', 'utf8');
    expect(sql).toMatch(/grant execute on function public\.here_tiles_report\(integer\) to authenticated/);
    expect(sql).toMatch(/revoke all on function public\.here_tiles_report\(integer\) from public, anon/);
    expect(sql).toMatch(/between 0 and 5000/);
    expect(sql).toMatch(/here_note_service\('tiles'/);
  });
});
