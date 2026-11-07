/**
 * DP-234 / F7 #863 — Q-18: po DP-231 ~5 h historii bez strefy → COG;
 * kotwice (ostatni fix w porcie + pierwszy po wyjściu) → ta sama faza co pełne 48 h.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { ferryPhase, ferryVisible, type TrackFix } from '../src/lib/map/draw';
import { markersFromTrack } from '../src/lib/aisDb';

const at = (h: number) => `2026-11-07T${String(h).padStart(2, '0')}:00:00.000Z`;

describe('DP-234 ferry zone anchors / Q-18', () => {
  it('długi GDN→morze: same 5 h morza → COG; + kotwice strefy = faza jak pełna historia', () => {
    const gdn: TrackFix = { id: 'v', lat: 54.4, lng: 18.67, ts: at(0), cog: 10 };
    const firstOut: TrackFix = { id: 'v', lat: 54.55, lng: 18.5, ts: at(1), cog: 350 };
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
        lat: 54.55, lon: 18.5, observed_at: at(1), cog: 350, sog_kn: 14,
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

  it('migracja 0432: kotwice stref + PORT_ZONES jak draw.ts', () => {
    const sql = readFileSync('supabase/migrations/0432_dp234_ferry_zone_anchors.sql', 'utf8');
    expect(sql).toMatch(/last_zone/);
    expect(sql).toMatch(/first_after/);
    expect(sql).toMatch(/54\.4/);
    expect(sql).toMatch(/59\.443/);
    expect(sql).toMatch(/rn_recent <= 20/);
    // Mutacja: bez kotwic stref — ten expect pada.
    expect(sql).toMatch(/in_zone/);
  });
});
