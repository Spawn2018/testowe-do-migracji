/**
 * DP-7 (F7 #670): stałe tory wodne do warstwy promu — jedno źródło dla `mapPool` (tworzenie mapy) i `CorridorMap`
 * (po przerysowaniu przepraw z HERE). Czysta funkcja (bez Leaflet), testowana bez przeglądarki.
 * BN9-b: tory Korytarza bałtyckiego ze słownika przepraw (Estonia ⇄ Finlandia / Szwecja) — zawsze, ten sam styl.
 */
import { WATER_GDN_NYN, WATER_GDY_KAA } from './draw';
import { WATER_TRACKS_EXTRA } from './ferryLines';

export type LaneLine = readonly (readonly [number, number])[];

/** Styl torów promowych — jeden dla wszystkich map korytarza. */
export const FERRY_LANE_STYLE = { color: '#6BA8D6', weight: 3, opacity: 0.9 } as const;

/** Odcinki HERE, które zastępują stały tor (GDN–NYN, GDY–KAA). */
export const HERE_FERRY_LEGS = ['FERRY-GDN-NYN', 'FERRY-GDY-KAA'] as const;

/**
 * Linie torów `[lat, lng]`; `skipLegs` — przeprawy, które HERE już narysowało (FERRY-GDN-NYN, FERRY-GDY-KAA).
 * Tory bałtyckie zawsze.
 */
export function ferryLaneLines(skipLegs: ReadonlySet<string> = new Set()): LaneLine[] {
  const legacy = { 'FERRY-GDN-NYN': WATER_GDN_NYN, 'FERRY-GDY-KAA': WATER_GDY_KAA } as const;
  const out: LaneLine[] = [];
  for (const [leg, lane] of Object.entries(legacy)) {
    if (skipLegs.has(leg)) continue;
    /* WATER_GDN_NYN / WATER_GDY_KAA są w kolejności [lng, lat] */
    out.push(lane.map(([lng, lat]) => [lat, lng] as const));
  }
  for (const line of Object.values(WATER_TRACKS_EXTRA)) out.push(line.map(([lat, lng]) => [lat, lng] as const));
  return out;
}
