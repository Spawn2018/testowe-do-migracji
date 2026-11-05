/**
 * DP-224 B (#817 / F7 #821): zachowanie TTL i pokrycia legów — `tests/dp224-b-mappool.jsdom.test.ts`.
 * Ten plik: szybki strażnik źródła (bez jsdom).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const poolSrc = () => readFileSync('src/components/map/mapPool.ts', 'utf8');

describe('DP-224 B mapPool — strażnik źródła', () => {
  it('TTL loadedAt + poolLinesReusable + roadsLoads', () => {
    const src = poolSrc();
    expect(src).toMatch(/LINES_CACHE_TTL_MS/);
    expect(src).toMatch(/poolLinesReusable/);
    expect(src).toMatch(/loadedAt/);
    expect(src).toMatch(/serverLegCodes/);
    expect(src).toMatch(/poolStats\.roadsLoads \+= 1/);
    expect(src).not.toMatch(/if \(e\.lines\.legs\) return Promise\.resolve\(\);/);
  });
});
