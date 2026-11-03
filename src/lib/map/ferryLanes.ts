/**
 * DP-7 (F7 #670): stałe tory wodne do warstwy promu — jedno źródło dla `mapPool` (tworzenie mapy) i `CorridorMap`
 * (po przerysowaniu przepraw z HERE). Czysta funkcja (bez Leaflet), testowana bez przeglądarki.
 * BN9-b: tory Korytarza bałtyckiego ze słownika przepraw (Estonia ⇄ Finlandia / Szwecja), ten sam styl.
 * BN9-c5 (#718 BN7 §4): tory bałtyckie już nie „zawsze” — tylko dla tras z zakresu mapy (`extraWaterTracksFor`).
 */
import type { WaterTrackId } from '../ferryCatalog';
import { WATER_GDN_NYN } from './draw';
import { extraWaterTracksFor, WATER_TRACKS_EXTRA } from './ferryLines';

export type LaneLine = readonly (readonly [number, number])[];

/**
 * DP-78: tor Gdynia–Karlskrona [lng, lat] rysowany na mapach. Wcześniej (`WATER_GDY_KAA` z `_shared/map/draw.ts`) kończył
 * się poziomym odcinkiem 56,16° N od 15,95° E do portu — nad Sturkö, Tjurkö i szkierami. Teraz podejście od południa,
 * otwartym morzem na zachód od Utklippan, przesmykiem Kungsholmen–Drottningskär (Aspö / Tjurkö) do portu.
 * Początek i koniec bez zmian (porty z katalogu). Wersja serwerowa w `_shared` bez zmian (poza zakresem paczki frontu).
 */
export const WATER_GDY_KAA_LANE: readonly (readonly [number, number])[] = [
  [18.54, 54.533],
  [18.85, 54.9],
  [17.6, 55.35],
  [16.5, 55.75],
  [15.85, 55.98],
  [15.62, 56.06],
  [15.595, 56.107],
  [15.61, 56.135],
  [15.63, 56.161],
];

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

/** Tory rdzenia (GDN-NYN, GDY-KAA) — domyślny zakres: Mapa i Kokpit bez transportów bałtyckich, mapy stref. */
export const CORE_LANE_TRACKS: ReadonlySet<WaterTrackId> = new Set<WaterTrackId>(['GDN-NYN', 'GDY-KAA']);

/**
 * Linie torów `[lat, lng]`; `skipLegs` — przeprawy, które HERE już narysowało (FERRY-GDN-NYN, FERRY-GDY-KAA).
 * `tracks` — tory w zakresie mapy (BN9-c5): rdzeń domyślnie; tory bałtyckie tylko, gdy są w zakresie.
 */
export function ferryLaneLines(
  skipLegs: ReadonlySet<string> = new Set(),
  tracks: ReadonlySet<WaterTrackId> = CORE_LANE_TRACKS,
): LaneLine[] {
  const legacy = [
    ['FERRY-GDN-NYN', 'GDN-NYN', WATER_GDN_NYN],
    ['FERRY-GDY-KAA', 'GDY-KAA', WATER_GDY_KAA_LANE],
  ] as const;
  const out: LaneLine[] = [];
  for (const [leg, track, lane] of legacy) {
    if (skipLegs.has(leg) || !tracks.has(track)) continue;
    /* WATER_GDN_NYN / WATER_GDY_KAA_LANE są w kolejności [lng, lat] */
    out.push(lane.map(([lng, lat]) => [lat, lng] as const));
  }
  /* kolejność stała (jak `WATER_TRACKS_EXTRA`), niezależna od kolejności tras w zakresie */
  const extra = (Object.keys(WATER_TRACKS_EXTRA) as WaterTrackId[]).filter((id) => tracks.has(id));
  for (const { line } of extraWaterTracksFor(extra)) out.push(line.map(([lat, lng]) => [lat, lng] as const));
  return out;
}
