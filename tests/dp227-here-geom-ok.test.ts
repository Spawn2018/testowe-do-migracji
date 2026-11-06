/**
 * @vitest-environment jsdom
 * DP-227 / #840: po uproszczeniu points_display (~50 m) odcinki > 3 km —
 * przeglądarka ufa geom_ok z serwera (walidacja na pełnych points).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { checkRoads } from '../src/components/map/applyBasemap.ts';

/** Linia display z odcinkiem ~20 km (jak PL-TLL po Douglas–Peucker) — pada maxSegKm ≤ 3. */
function displayLineWithLongSeg(): [number, number][] {
  const out: [number, number][] = [];
  // gęsty start
  for (let i = 0; i < 50; i++) out.push([54.3 + i * 0.001, 18.6 + i * 0.001]);
  // skok ~20 km (≈ 0.18° szer.)
  out.push([54.35 + 0.18, 18.65]);
  for (let i = 0; i < 50; i++) out.push([54.53 + i * 0.001, 18.65 + i * 0.001]);
  return out;
}

describe('DP-227 checkRoads geom_ok', () => {
  it('geom_ok=true + długi odcinek display → przyjęta', () => {
    const line = displayLineWithLongSeg();
    const { accepted, rejected } = checkRoads([
      {
        leg: 'PL-TLL',
        points: line,
        spec: 'dict',
        via_points: [[54.4, 18.7]],
        min_km: 1,
        max_km: 5000,
        geom_ok: true,
        summary: 'OK',
      },
    ]);
    expect(rejected).toEqual([]);
    expect(accepted).toHaveLength(1);
    expect(accepted[0]!.length).toBe(line.length);
  });

  it('geom_ok=false + geom_reject → odrzucona z powodem serwera', () => {
    const { accepted, rejected } = checkRoads([
      {
        leg: 'FI-HEL',
        points: displayLineWithLongSeg(),
        spec: 'loose',
        geom_ok: false,
        geom_reject: 'segment 20.1 km > 3',
        summary: 'FI-HEL — segment 20.1 km > 3',
      },
    ]);
    expect(accepted).toEqual([]);
    expect(rejected).toEqual([{ leg: 'FI-HEL', why: 'segment 20.1 km > 3' }]);
  });

  it('geom_ok=true bez punktów (≥2) → nadal odrzut', () => {
    const { accepted, rejected } = checkRoads([
      {
        leg: 'SE-NYN',
        points: [[58.9, 17.9]],
        spec: 'se',
        geom_ok: true,
        summary: '',
      },
    ]);
    expect(accepted).toEqual([]);
    expect(rejected).toEqual([{ leg: 'SE-NYN', why: 'brak punktów' }]);
  });

  it('bez geom_ok — stara ścieżka (długi odcinek → geometria)', () => {
    const { accepted, rejected } = checkRoads([
      {
        leg: 'PL-GDN',
        points: displayLineWithLongSeg(),
        spec: 'pl',
        summary: 'OK',
      },
    ]);
    expect(accepted).toEqual([]);
    expect(rejected.some((r) => r.leg === 'PL-GDN' && /geometria/i.test(r.why))).toBe(true);
  });

  it('migracja 0421: kolumny + map_display_state zwraca geom_ok', () => {
    const sql = readFileSync(
      resolve(__dirname, '../supabase/migrations/0421_dp227_here_geom_ok.sql'),
      'utf8',
    );
    expect(sql).toMatch(/geom_ok/);
    expect(sql).toMatch(/geom_reject/);
    expect(sql).toMatch(/'geom_ok',\s*g\.geom_ok/);
    expect(sql).toMatch(/DP-227/);
  });
});
