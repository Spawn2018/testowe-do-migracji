import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('AUD-01e: jedna mapa na sesję (źródło)', () => {
  const comp = readFileSync('src/components/map/CorridorMap.tsx', 'utf8');
  const pool = readFileSync('src/components/map/mapPool.ts', 'utf8');
  it('CorridorMap nie tworzy ani nie niszczy mapy — bierze ją z puli i oddaje', () => {
    expect(comp).not.toMatch(/L\.map\(/);
    expect(comp).not.toMatch(/map\.remove\(\)/);
    expect(comp).toMatch(/acquireMap\(containerRef\.current, slot\)/);
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
    expect(pool).toMatch(/if \(!e\.pooled\) \{\n    e\.map\.remove\(\)/);
    expect(pool).not.toMatch(/prefetch|keepBuffer|preload/i);
  });
  it('panel zlecenia ma własne miejsce widoku', () => {
    /* wyglad/P4-b — E27: kropka w panelu tylko w oknie śledzenia (lista stała między renderami) */
    const d = readFileSync('src/components/drawer/LoadDrawer.tsx', 'utf8');
    expect(d).toMatch(/<CorridorMap loads=\{drawerMapLoads\} embedded slot="drawer" \/>/);
    expect(d).toMatch(/const drawerMapLoads = useMemo\(\(\) => \(load && trackingPhase\(load, nowIso\) === 'on' \? \[load\] : \[\]\)/);
  });
});
