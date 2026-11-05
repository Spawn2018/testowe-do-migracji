/**
 * DP-224 B (#817): jedna mapa w puli; po wczytaniu legów przejścia widoków bez ponownego map_display_state.
 * Etap C2 / mapa — po cz. A (0414).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const poolSrc = () => readFileSync('src/components/map/mapPool.ts', 'utf8');

describe('DP-224 B mapPool — bez ponownego pobierania tras', () => {
  it('drawCorridorLines: przy e.lines.legs bez sieci; licznik roadsLoads', () => {
    const src = poolSrc();
    expect(src).toMatch(/roadsLoads/);
    expect(src).toMatch(/DP-224 B/);
    expect(src).toMatch(/if \(e\.lines\.legs\) return Promise\.resolve\(\);/);
    expect(src).toMatch(/poolStats\.roadsLoads \+= 1/);
  });

  it('CorridorMap nadal bierze mapę z puli (AUD-01e)', () => {
    const comp = readFileSync('src/components/map/CorridorMap.tsx', 'utf8');
    expect(comp).toMatch(/acquireMap\(containerRef\.current, slot, linesSpecRef\.current\)/);
    expect(comp).toMatch(/releaseMap\(pooled, slot\)/);
    expect(comp).not.toMatch(/L\.map\(/);
  });
});
