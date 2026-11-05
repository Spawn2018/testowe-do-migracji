import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('AUD-01e: jedna mapa na sesję (źródło)', () => {
  const comp = readFileSync('src/components/map/CorridorMap.tsx', 'utf8');
  const pool = readFileSync('src/components/map/mapPool.ts', 'utf8');
  it('CorridorMap nie tworzy ani nie niszczy mapy — bierze ją z puli i oddaje', () => {
    expect(comp).not.toMatch(/L\.map\(/);
    expect(comp).not.toMatch(/map\.remove\(\)/);
    /* BN9-c5: trzeci argument — zakres linii widoku (karta transportu / Mapa i Kokpit) */
    expect(comp).toMatch(/acquireMap\(containerRef\.current, slot, linesSpecRef\.current\)/);
    expect(comp).toMatch(/releaseMap\(pooled, slot\)/);
  });
  it('słuchacze i obserwatory zdejmowane przy zamknięciu widoku (bez wycieku)', () => {
    expect(comp).toMatch(/map\.on\('zoomend', onZoom\)/);
    expect(comp).toMatch(/map\.off\('zoomend', onZoom\)/);
    expect(comp).toMatch(/ro\?\.disconnect\(\)/);
    expect(comp).toMatch(/cancelAnimationFrame\(raf\)/);
    expect(comp).toMatch(/layer\.off\('load', done\)/);
  });
  it('pula: jedna mapa, schowek tego samego rozmiaru, widok per miejsce, ten sam motyw = bez nowego podkładu, bez prefetchu', () => {
    expect(pool.match(/L\.map\(/g)?.length).toBe(1);
    expect(pool).toMatch(/if \(e\.tilesTheme === theme\) return Promise\.resolve\(e\.layers\.tiles\)/);
    expect(pool).toMatch(/holder\.style\.width = `\$\{Math\.max\(1, w\)\}px`/);
    expect(pool).toMatch(/views\.set\(slot/);
    /* DP-224 E (#817): destroyLeafletMap zamiast gołego e.map.remove() — unikaj `_leaflet_pos` */
    expect(pool).toMatch(/if \(!e\.pooled\) \{\n(?:    (?:\/\*|   ).*\n|    e\.basemapSeq \+= 1;\n)*    destroyLeafletMap\(e\.map\)/);
    /* wyglad/W-dane: spóźniony podkład nie trafia na zamkniętą mapę jednorazową (błąd „appendChild”) */
    expect(pool).toMatch(/e\.basemapSeq \+= 1;\n    destroyLeafletMap\(e\.map\)/);
    expect(pool).toMatch(/e\.basemapSeq !== seq \? e\.layers\.tiles : applyBasemap\(/);
    expect(pool).not.toMatch(/prefetch|keepBuffer|preload/i);
  });
  it('panel zlecenia ma własne miejsce widoku', () => {
    /* wyglad/P4-b — E27: kropka w panelu tylko w oknie śledzenia (lista stała między renderami) */
    const d = readFileSync('src/components/drawer/LoadDrawer.tsx', 'utf8');
    expect(d).toMatch(/<CorridorMap loads=\{drawerMapLoads\} embedded slot="drawer" \/>/);
    expect(d).toMatch(/const drawerMapLoads = useMemo\(\(\) => \(load && trackingPhase\(load, nowIso\) === 'on' \? \[load\] : \[\]\)/);
  });
});
