/** I-2j — mapa w produkcji: pozycje promów z bazy (vessel_positions) z czasem sygnału albo „brak źródła danych”. */
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { latestPerVessel, type VesselPositionRow } from '../src/lib/aisDb';
import { latestReadAt, subscribeFerryPositions } from '../src/lib/ais';

const NS = { name: 'M/F Nova Star', mmsi: 311000787 };
const WAW = { name: 'M/F Wawel', mmsi: 311852000 };
const row = (vessel_id: string, observed_at: string, lat: number, v = NS): VesselPositionRow =>
  ({ vessel_id, lat, lon: 17.9, sog_kn: 12, cog: 10, observed_at, vessels: v });

describe('I-2j — pozycje promów z bazy', () => {
  it('ostatnia pozycja każdego statku, czas sygnału zachowany, źródło „db”', () => {
    const p = latestPerVessel([
      row('ns', '2026-09-27T17:00:00Z', 58.1), row('ns', '2026-09-27T18:10:00Z', 58.7), row('waw', '2026-09-27T16:00:00Z', 55.0, WAW),
    ]);
    expect(p.map((x) => [x.name, x.lat, x.ts, x.source])).toEqual([
      ['M/F Nova Star', 58.7, '2026-09-27T18:10:00Z', 'db'], ['M/F Wawel', 55.0, '2026-09-27T16:00:00Z', 'db'],
    ]);
    /* BN9-c2: vesselId zawsze = vessels.id z bazy (bez mapowania FERRY_VESSELS / WAW|NS). */
    expect(p.map((x) => x.vesselId)).toEqual(['ns', 'waw']);
    expect(latestReadAt(p)).toBe('2026-09-27T18:10:00Z');
  });
  it('BN9-c2: MMSI spoza listy demo → vesselId = vessels.id (nie WAW)', () => {
    const megastar = { name: 'Megastar', mmsi: 276829000 };
    const p = latestPerVessel([row('uuid-megastar', '2026-11-01T12:00:00Z', 59.9, megastar)]);
    expect(p).toHaveLength(1);
    expect(p[0].vesselId).toBe('uuid-megastar');
    expect(p[0].name).toBe('Megastar');
    expect(p[0].vesselId).not.toBe('WAW');
  });
  it('BN9-c2: aisDb bez importu listy demo (vesselId = vessels.id)', () => {
    const src = readFileSync('src/lib/aisDb.ts', 'utf8');
    expect(src).not.toMatch(/from '\.\/ferry'/);
    expect(src).toContain('vesselId: r.vessel_id');
  });
  it('brak wierszy → pusta lista i brak czasu (UI: „brak źródła danych”)', () => {
    expect(latestPerVessel([])).toEqual([]);
    expect(latestReadAt([])).toBeNull();
  });
  it('produkcja: bez połączenia WebSocket i bez pozycji przykładowych — najpierw tryb „none”', () => {
    const WS = vi.fn();
    vi.stubGlobal('WebSocket', WS);
    vi.stubEnv('VITE_AUTH_MODE', 'supabase');
    const calls: [number, string][] = [];
    const stop = subscribeFerryPositions({ prod: true, onUpdate: (pos, mode) => calls.push([pos.length, mode]) });
    stop();
    expect(WS).not.toHaveBeenCalled();
    expect(calls[0]).toEqual([0, 'none']);
    expect(calls.some(([, m]) => m === 'seed')).toBe(false);
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });
  it('mapa i widok mapy korzystają z jednego wejścia (subscribeFerryPositions z PROD_BUILD)', () => {
    for (const f of ['src/components/map/CorridorMap.tsx', 'src/views/MapView.tsx']) {
      const src = readFileSync(f, 'utf8');
      expect(src).toContain('subscribeFerryPositions({');
      expect(src).toContain('prod: PROD_BUILD');
      expect(src).not.toMatch(/subscribeAis\(/);
    }
  });
});
