/**
 * DP-234 / F7 #863 — Q-18: po DP-231 ~5 h historii bez strefy → COG;
 * kotwice (ostatni fix w porcie + pierwszy po wyjściu) → ta sama faza co pełne 48 h.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { ferryPhase, ferryVisible, PORT_ZONES, type TrackFix } from '../src/lib/map/draw';
import { markersFromTrack } from '../src/lib/aisDb';

const at = (h: number) => `2026-11-07T${String(h).padStart(2, '0')}:00:00.000Z`;

describe('DP-234 ferry zone anchors / Q-18', () => {
  it('długi GDN→morze: same 5 h morza → COG; + kotwice strefy = faza jak pełna historia', () => {
    const gdn: TrackFix = { id: 'v', lat: 54.4, lng: 18.67, ts: at(0), cog: 10 };
    /* Poza GDN (r=6) i GDY (r=5) — jak fixture bmapa DP-234. */
    const firstOut: TrackFix = { id: 'v', lat: 54.85, lng: 18.3, ts: at(1), cog: 350 };
    /* 12 h rejsu — ostatnie 5 h bez strefy (jak limit DP-231). */
    const sea: TrackFix[] = Array.from({ length: 12 }, (_, i) => ({
      id: 'v',
      lat: 55.0 + i * 0.25,
      lng: 18.2,
      ts: at(2 + i),
      cog: 350,
    }));
    const full = [gdn, firstOut, ...sea];
    const recentOnly = sea.slice(-5);
    const withAnchors = [gdn, firstOut, ...recentOnly];

    expect(ferryPhase(full)).toBe('to-se');
    expect(ferryVisible(full)).toBe(true);
    /* Bez kotwic: nieznana strefa → zapas COG północ = to-se, ale przy COG południe = zła faza. */
    expect(ferryPhase(recentOnly.map((f) => ({ ...f, cog: 170 })))).toBe('to-pl');
    expect(ferryVisible(recentOnly.map((f) => ({ ...f, cog: 170 })))).toBe(false);
    /* Z kotwicami: faza identyczna z pełną historią niezależnie od COG. */
    expect(ferryPhase(withAnchors.map((f) => ({ ...f, cog: 170 })))).toBe('to-se');
    expect(ferryVisible(withAnchors.map((f) => ({ ...f, cog: 170 })))).toBe(true);
    expect(ferryPhase(withAnchors)).toBe(ferryPhase(full));
  });

  it('powrót z NYN: kotwice se-port + wyjście → to-pl jak pełna historia', () => {
    const nyn: TrackFix = { id: 'v', lat: 58.912, lng: 17.955, ts: at(0), cog: 180 };
    const out: TrackFix = { id: 'v', lat: 58.7, lng: 18.0, ts: at(1), cog: 180 };
    const sea: TrackFix[] = Array.from({ length: 10 }, (_, i) => ({
      id: 'v',
      lat: 58.4 - i * 0.3,
      lng: 18.1,
      ts: at(2 + i),
      cog: 180,
    }));
    const full = [nyn, out, ...sea];
    const withAnchors = [nyn, out, ...sea.slice(-5)];
    expect(ferryPhase(full)).toBe('to-pl');
    expect(ferryPhase(withAnchors)).toBe(ferryPhase(full));
    expect(ferryVisible(withAnchors)).toBe(false);
  });

  it('markersFromTrack z kotwicami: widoczny mimo COG południe na świeżych punktach', () => {
    const rows = [
      {
        vessel_id: 'v1', name: 'Nova', mmsi: 1,
        lat: 54.4, lon: 18.67, observed_at: at(0), cog: 10, sog_kn: 12,
      },
      {
        vessel_id: 'v1', name: 'Nova', mmsi: 1,
        lat: 54.85, lon: 18.3, observed_at: at(1), cog: 350, sog_kn: 14,
      },
      {
        vessel_id: 'v1', name: 'Nova', mmsi: 1,
        lat: 56.5, lon: 18.0, observed_at: at(14), cog: 170, sog_kn: 16,
      },
    ];
    const markers = markersFromTrack(rows);
    expect(markers).toHaveLength(1);
    expect(markers[0].ts).toBe(at(14));
  });

  it('migracja 0432: kotwice stref + PORT_ZONES jak draw.ts (wszystkie 11)', () => {
    const sql = readFileSync('supabase/migrations/0432_dp234_ferry_zone_anchors.sql', 'utf8');
    expect(sql).toMatch(/last_zone/);
    expect(sql).toMatch(/first_after/);
    expect(sql).toMatch(/rn_recent <= 20/);
    // Mutacja: bez kotwic stref — ten expect pada.
    expect(sql).toMatch(/in_zone/);
    expect(PORT_ZONES).toHaveLength(11);
    const zoneRows = [...sql.matchAll(/\('([A-Z]+)'(::text)?, *([0-9.]+)(::float8)?, *([0-9.]+)(::float8)?, *([0-9.]+)/g)]
      .map((m) => ({ id: m[1], lat: Number(m[3]), lng: Number(m[5]), radiusKm: Number(m[7]) }));
    expect(zoneRows).toHaveLength(11);
    // F7 #881: id + środek + promień — zmiana w draw.ts bez 0432 rozjeżdża mapę.
    for (const z of PORT_ZONES) {
      expect(zoneRows, `strefa ${z.id} w 0432`).toContainEqual({
        id: z.id, lat: z.lat, lng: z.lng, radiusKm: z.radiusKm,
      });
    }
  });
});
