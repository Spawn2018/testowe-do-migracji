/**
 * BN9-c3 (#573 „Ekrany po BN5”) — pogoda morska dla przepraw bałtyckich: moduł czysty dla Ryzyk › Pogoda i Kokpitu.
 *
 * Dane: `marine_conditions` z `fetchMarineConditions` (BN5, migracja 0375 — pięć korytarzy); demo — `p6Source.sampleMarineOf`.
 * Korytarz transportu = rodzina trasy rejsu (tor wodny z katalogu promów): TLL-HEL i MUU-VUO → Zatoka Fińska,
 * PLD-KPS → Paldiski – Kapellskär, TLL-STO → Tallinn – Sztokholm; GDN-NYN i GDY-KAA bez zmian. Trasa bez mapy → null
 * (brak oceny, nigdy domyślny Gdańsk – Nynäshamn). Progi bez zmian: 3,8 m / 40 kn (z wiersza bazy).
 */
import type { Load, Sailing } from '../types';
import type { MarineConditionRow, MarineCorridorCode, MarineRiskLevel } from './marineWeatherDb';
import { waterTrackOf, type WaterTrackId } from './ferryCatalog';
import { stageTileOf, type StageTile } from './stageTiles';

/** Stała kolejność przepraw (Ryzyka › Pogoda, Kokpit): najpierw PL–SE, potem bałtyckie. */
export const MARINE_CORRIDOR_ORDER: readonly MarineCorridorCode[] = [
  'BALTIC_GDN_NYN',
  'BALTIC_GDY_KAA',
  'BALTIC_GULF_FI',
  'BALTIC_PLD_KPS',
  'BALTIC_TLL_STO',
];

/** Przeprawy sprzed BN5 (Polska – Szwecja) — Kokpit bez transportów bałtyckich wygląda jak dotąd. */
export const PL_SE_CORRIDORS: ReadonlySet<MarineCorridorCode> = new Set(['BALTIC_GDN_NYN', 'BALTIC_GDY_KAA']);

/** Nazwy po polsku portami (klucze słownika `bn9c3_corr_*`). */
export const CORRIDOR_NAME_KEY: Record<MarineCorridorCode, string> = {
  BALTIC_GDN_NYN: 'bn9c3_corr_BALTIC_GDN_NYN',
  BALTIC_GDY_KAA: 'bn9c3_corr_BALTIC_GDY_KAA',
  BALTIC_GULF_FI: 'bn9c3_corr_BALTIC_GULF_FI',
  BALTIC_PLD_KPS: 'bn9c3_corr_BALTIC_PLD_KPS',
  BALTIC_TLL_STO: 'bn9c3_corr_BALTIC_TLL_STO',
};

const TRACK_CORRIDOR: Record<WaterTrackId, MarineCorridorCode> = {
  'GDN-NYN': 'BALTIC_GDN_NYN',
  'GDY-KAA': 'BALTIC_GDY_KAA',
  'TLL-HEL': 'BALTIC_GULF_FI',
  'MUU-VUO': 'BALTIC_GULF_FI',
  'PLD-KPS': 'BALTIC_PLD_KPS',
  'TLL-STO': 'BALTIC_TLL_STO',
};

/** Link tekstowy do mapy lodowej FMI (BN5 §3: sam link, bez osadzania — licencja PDF do potwierdzenia). */
export const FMI_ICE_CHART_URL = 'https://cdn.fmi.fi/marine-observations/products/ice-charts/latest-full-color-ice-chart.pdf';

export const MARINE_ATTRIBUTION_DEFAULT = 'Dane: FMI / DMI / SMHI (CC BY 4.0)';

/** Korytarz pogody trasy rejsu (oba kierunki, Terminal A i kody z bazy przez rodzinę trasy). Nieznana trasa → null. */
export function corridorOfRoute(route: string | null | undefined): MarineCorridorCode | null {
  const track = waterTrackOf(route);
  return track ? TRACK_CORRIDOR[track] ?? null : null;
}

/** Wiersz bez odczytu: brak wiersza, brak `observed_at` albo wiersz startowy migracji (bez fali, porywów i źródeł). */
export function isNoReading(m: MarineConditionRow | null | undefined): boolean {
  if (!m) return true;
  if (!m.observedAt) return true;
  return m.maxWaveM == null && m.maxGustKn == null && !m.sources;
}

export interface MarineCrossingView {
  corridor: MarineCorridorCode;
  /** null = brak odczytu */
  risk: MarineRiskLevel | null;
  waveM: number | null;
  gustKn: number | null;
  waveThrM: number;
  gustThrKn: number;
  observedAt: string | null;
  sources: string;
  attribution: string;
  noReading: boolean;
}

const RISK_RANK: Record<MarineRiskLevel, number> = { wysokie: 2, 'podwyższone': 1, niskie: 0 };

export function crossingView(corridor: MarineCorridorCode, m: MarineConditionRow | null | undefined): MarineCrossingView {
  const none = isNoReading(m);
  return {
    corridor,
    risk: none ? null : m!.risk,
    waveM: none ? null : m!.maxWaveM,
    gustKn: none ? null : m!.maxGustKn,
    waveThrM: m?.waveThrM ?? 3.8,
    gustThrKn: m?.gustThrKn ?? 40,
    observedAt: none ? null : m!.observedAt,
    sources: none ? '' : m!.sources,
    /* bez wiersza z bazy (błąd odczytu) — bez atrybucji: nie podpisujemy danych, których nie ma */
    attribution: m ? m.attribution || MARINE_ATTRIBUTION_DEFAULT : '',
    noReading: none,
  };
}

/** Najpierw przeprawy z ryzykiem wyższym (wysokie, potem podwyższone), potem reszta w stałej kolejności. */
export function sortCrossings(list: readonly MarineCrossingView[]): MarineCrossingView[] {
  const rank = (v: MarineCrossingView) => (v.risk ? RISK_RANK[v.risk] : 0);
  const pos = (v: MarineCrossingView) => MARINE_CORRIDOR_ORDER.indexOf(v.corridor);
  return [...list].sort((a, b) => rank(b) - rank(a) || pos(a) - pos(b));
}

/** Ryzyka › Pogoda: wszystkie pięć przepraw (brak wiersza = „brak odczytu”), posortowane. */
export function marineCrossings(marine: readonly MarineConditionRow[]): MarineCrossingView[] {
  return sortCrossings(MARINE_CORRIDOR_ORDER.map((c) => crossingView(c, marine.find((m) => m.corridor === c))));
}

/** Najnowszy odczyt spośród przepraw z danymi (wiersz startowy nie podaje czasu odczytu). */
export function latestReadingAt(list: readonly MarineCrossingView[]): string | null {
  return list.map((v) => v.observedAt).filter((x): x is string => !!x).sort().pop() ?? null;
}

/** Atrybucja sekcji: wartości z bazy bez powtórzeń (pusty wpis → domyślna); bez wierszy (błąd odczytu) — pusta. */
export function marineAttribution(marine: readonly MarineConditionRow[]): string {
  if (!marine.length) return '';
  return [...new Set(marine.map((m) => m.attribution || MARINE_ATTRIBUTION_DEFAULT))].join(' · ');
}

/**
 * Kafelek „Najbliższy prom” (B3 / H3.4, jak dotąd): pogoda Gdańsk – Nynäshamn z listy wszystkich korytarzy.
 * Wiersz startowy i wiersz bez fali — brak morza; wiersze bałtyckie nigdy nie trafiają do kafelka.
 */
export function nearestFerrySeaRow(marine: readonly MarineConditionRow[]): MarineConditionRow | null {
  const row = marine.find((r) => r.corridor === 'BALTIC_GDN_NYN');
  return row && !isNoReading(row) && row.maxWaveM != null ? row : null;
}

/** Etapy przed promem i na promie — transport ma przeprawę jeszcze przed sobą albo jest na niej. */
const BEFORE_OR_ON_FERRY: ReadonlySet<StageTile> = new Set(['PREP', 'LOADING', 'ROAD_PL', 'PORT_PL', 'FERRY']);

export type SeaLoad = Pick<Load, 'sailingId' | 'status' | 'stage'>;
export type SeaSailing = Pick<Sailing, 'id' | 'route' | 'arrivalAt' | 'delayedArrivalAt' | 'status'>;

/**
 * Rejs transportu jeszcze się nie zakończył: nie „Dopłynął” i efektywne przypłynięcie (opóźnione, gdy jest) po „teraz”
 * (front nie ma `arrived_at` — „Dopłynął” to ten sam fakt), albo transport jest w etapie przed promem lub na promie.
 * Naczepa po zjeździe z promu (port SE, drogi SE, plac) z zakończonym rejsem — przeprawę ma za sobą.
 */
export function crossingAhead(l: SeaLoad, s: SeaSailing, nowMs: number): boolean {
  const arr = Date.parse(s.delayedArrivalAt || s.arrivalAt);
  const voyageOpen = s.status !== 'DOPLYNAL' && Number.isFinite(arr) && arr > nowMs;
  const tile = stageTileOf(l);
  return voyageOpen || (tile != null && BEFORE_OR_ON_FERRY.has(tile));
}

/** Przeprawy, którymi jadą transporty (z rejsu transportu, przeprawa jeszcze przed nimi): korytarz → liczba transportów. */
export function corridorsOfLoads(
  loads: readonly SeaLoad[],
  sailings: readonly SeaSailing[],
  nowMs: number,
): Map<MarineCorridorCode, number> {
  const byId = new Map(sailings.map((s) => [s.id, s]));
  const out = new Map<MarineCorridorCode, number>();
  for (const l of loads) {
    const s = l.sailingId ? byId.get(l.sailingId) : undefined;
    if (!s || !crossingAhead(l, s, nowMs)) continue;
    const c = corridorOfRoute(s.route);
    if (c) out.set(c, (out.get(c) ?? 0) + 1);
  }
  return out;
}

export interface CockpitCrossing extends MarineCrossingView {
  /** liczba aktywnych transportów na tej przeprawie */
  loads: number;
}

/**
 * Kokpit: karty pogody morskiej dla przepraw aktywnych transportów — tylko gdy co najmniej jeden aktywny transport
 * jedzie przeprawą bałtycką (poza Polska – Szwecja). Inaczej pusta lista: Kokpit wygląda jak dotąd (kafelek
 * „Najbliższy prom” z pogodą Gdańsk – Nynäshamn).
 */
export function cockpitCrossings(
  activeLoads: readonly SeaLoad[],
  sailings: readonly SeaSailing[],
  marine: readonly MarineConditionRow[],
  nowMs: number,
): CockpitCrossing[] {
  const used = corridorsOfLoads(activeLoads, sailings, nowMs);
  if (![...used.keys()].some((c) => !PL_SE_CORRIDORS.has(c))) return [];
  const views = MARINE_CORRIDOR_ORDER.filter((c) => used.has(c)).map((c) => crossingView(c, marine.find((m) => m.corridor === c)));
  return sortCrossings(views).map((v) => ({ ...v, loads: used.get(v.corridor) ?? 0 }));
}
