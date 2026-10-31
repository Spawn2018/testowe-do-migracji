/**
 * DP-7 (F7 #670): stałe tory wodne do warstwy promu — jedno źródło dla `mapPool` (tworzenie mapy) i `CorridorMap`
 * (po przerysowaniu przepraw z HERE). Czysta funkcja (bez Leaflet), testowana bez przeglądarki.
 * BN9-b: tory Korytarza bałtyckiego ze słownika przepraw (Estonia ⇄ Finlandia / Szwecja) — zawsze, ten sam styl.
 */
import { WATER_GDN_NYN, WATER_GDY_KAA } from './draw';
import { WATER_TRACKS_EXTRA } from './ferryLines';

export type LaneLine = readonly (readonly [number, number])[];

/**
 * Styl torów promowych — JEDEN dla wszystkich map: korytarz (Kokpit, Mapa, szuflada/karta transportu, telefon —
 * `mapPool`/`drawFerryLanes`/`CorridorMap`, także przeprawy z HERE) i mapa Stref (`ZonesMap` mode="all").
 * DP-76 (decyzje właściciela 31.10.2026): jasnoniebieski przerywany; w jasnym motywie ciemniejszy jasnoniebieski
 * `#3A82BA`, krycie 1 (kontrast 3,57 : 1 na morzu #DCF2FA), w ciemnym `#6BA8D6`, krycie 0,9. Oba: grubość 3, '6 6'.
 * Komponenty nie mają własnych literałów koloru ani przerywania torów — tylko `ferryLaneStyle(theme)`.
 */
export const FERRY_LANE_STYLES = {
  light: { color: '#3A82BA', weight: 3, opacity: 1, dashArray: '6 6' },
  dark: { color: '#6BA8D6', weight: 3, opacity: 0.9, dashArray: '6 6' },
} as const;

export type FerryLaneTheme = keyof typeof FERRY_LANE_STYLES;
export type FerryLaneStyle = (typeof FERRY_LANE_STYLES)[FerryLaneTheme];

/** Styl torów promowych dla motywu (nieznany motyw → ciemny, jak domyślny motyw aplikacji). */
export function ferryLaneStyle(theme: string): FerryLaneStyle {
  return theme === 'light' ? FERRY_LANE_STYLES.light : FERRY_LANE_STYLES.dark;
}

/** Znacznik polilinii toru promowego (przerysowanie stylu przy zmianie motywu bez ruszania innych linii). */
export const FERRY_LANE_CLASS = 'wt-ferry-lane';

/** Opcje polilinii toru promowego dla motywu: styl + znacznik do przerysowania przy zmianie motywu. */
export function ferryLaneOptions(theme: string): FerryLaneStyle & { className: typeof FERRY_LANE_CLASS } {
  return { ...ferryLaneStyle(theme), className: FERRY_LANE_CLASS };
}

/**
 * DP-76: zmiana motywu na żywo — nadaje styl motywu wszystkim torom (polilinie z `FERRY_LANE_CLASS`) w grupie warstw.
 * Działa na obiektach z `eachLayer`/`setStyle` (Leaflet), bez importu Leaflet tutaj (czysty moduł).
 */
export function restyleFerryLanes(
  group: { eachLayer: (fn: (l: unknown) => void) => unknown },
  theme: string,
): void {
  const style = ferryLaneStyle(theme);
  group.eachLayer((l) => {
    const pl = l as { options?: { className?: string }; setStyle?: (s: object) => unknown };
    if (pl.options?.className === FERRY_LANE_CLASS && typeof pl.setStyle === 'function') pl.setStyle(style);
  });
}

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
