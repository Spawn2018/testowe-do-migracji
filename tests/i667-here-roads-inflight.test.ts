/**
 * #667 F7 r3 uwaga 2 — dwa równoległe loadRoadLines → jeden POST here-roads.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

describe('#667 F7 r3 hereRoadsInFlight', () => {
  it('źródło: równoległe wołania dzielą hereRoadsInFlight', () => {
    const src = readFileSync('src/components/map/applyBasemap.ts', 'utf8');
    expect(src).toMatch(/let hereRoadsInFlight/);
    expect(src).toMatch(/if \(hereRoadsInFlight\) return hereRoadsInFlight/);
    expect(src).toMatch(/hereRoadsInFlight = \(async/);
    expect(src).toMatch(/hereRoadsInFlight = null/);
  });

  it('dwa równoległe loadRoadLines → jeden POST here-roads (model in-flight)', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true }));
    let inFlight: Promise<string[]> | null = null;
    let posts = 0;
    /** Ten sam wzorzec co applyBasemap.loadRoadLines (hereRoadsInFlight). */
    const loadRoadLines = async (): Promise<string[]> => {
      if (inFlight) return inFlight;
      inFlight = (async () => {
        posts += 1;
        await fetchMock('https://example.supabase.co/functions/v1/here-roads', { method: 'POST' });
        try {
          return ['ok'];
        } finally {
          inFlight = null;
        }
      })();
      return inFlight;
    };
    const [a, b] = await Promise.all([loadRoadLines(), loadRoadLines()]);
    expect(a).toEqual(['ok']);
    expect(b).toEqual(['ok']);
    expect(posts).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
