/**
 * BN9-c4 (#573 „Ekrany po BN6”) — Ryzyka › Drogi: Litwa, Łotwa, Estonia, Finlandia. Moduł czysty (bez zapytań).
 *
 * Dane: ryzyka `risk_signals` rodzajów `ROAD_LT` / `ROAD_LV` / `ROAD_EE` / `ROAD_FI` (BN6, #726, migracja 0376) z tego
 * samego zapytania co dziś; demo — przykład z `p6Source.sampleBalticRoadRisksOf`. Rodzaj rozpoznajemy po `kind`
 * (mapowanie w `mappers.ts` daje tym ryzykom `type: 'OPS'` jak `ROAD_PL`, więc `type` nie wystarcza).
 *
 * Kraje na trasie transportu = rodzina trasy rejsu (tor wodny z katalogu promów):
 * - TLL-HEL / MUU-VUO (Zatoka Fińska): LT, LV, EE przed promem i FI po promie;
 * - PLD-KPS, TLL-STO: LT, LV, EE przed promem;
 * - GDN-NYN, GDY-KAA: bez krajów bałtyckich.
 * Gdy żaden aktywny transport nie jedzie trasą bałtycką — bez sekcji bałtyckich (Ryzyka › Drogi jak dotąd).
 */
import type { Load, Risk, Sailing } from '../types';
import { waterTrackOf, type WaterTrackId } from './ferryCatalog';
import { stageTileOf, trackingPhase, type StageTile } from './stageTiles';
import { impactOf, type RoadImpact } from './p6Route';

export type BalticRoadCountry = 'LT' | 'LV' | 'EE' | 'FI';
/** Kolejność na trasie: załadunek → LT → LV → EE → prom → FI. */
export const BALTIC_ROAD_COUNTRIES: readonly BalticRoadCountry[] = ['LT', 'LV', 'EE', 'FI'];
const KIND_COUNTRY: Record<string, BalticRoadCountry> = { ROAD_LT: 'LT', ROAD_LV: 'LV', ROAD_EE: 'EE', ROAD_FI: 'FI' };
export { BALTIC_ROAD_KINDS, roadInfoFromDetail, withBalticRoad } from './bn9c4RoadDetail';

/** Klucze tytułów BN6 (`src/i18n/risks.ts`, `roadBaltic.ts`). */
export const KEY_EVENT = 'rk_road_baltic';
export const KEY_WEIGHT = 'rk_road_baltic_weight';
export const KEY_WEIGHT_CHECK = 'rk_road_baltic_weight_check';

/** Kraj ryzyka drogowego bałtyckiego po `kind` z bazy; inne rodzaje → null. */
export function balticCountryOf(r: Pick<Risk, 'kind'>): BalticRoadCountry | null {
  return (r.kind && KIND_COUNTRY[r.kind]) || null;
}

const PRE: readonly BalticRoadCountry[] = ['LT', 'LV', 'EE'];
const TRACK_COUNTRIES: Record<WaterTrackId, { pre: readonly BalticRoadCountry[]; post: readonly BalticRoadCountry[] }> = {
  'GDN-NYN': { pre: [], post: [] },
  'GDY-KAA': { pre: [], post: [] },
  'TLL-HEL': { pre: PRE, post: ['FI'] },
  'MUU-VUO': { pre: PRE, post: ['FI'] },
  'PLD-KPS': { pre: PRE, post: [] },
  'TLL-STO': { pre: PRE, post: [] },
};

/** Kraje bałtyckie trasy rejsu (oba kierunki, Terminal A, kody z bazy przez rodzinę trasy). Nieznana trasa → []. */
export function balticCountriesOfRoute(route: string | null | undefined): BalticRoadCountry[] {
  const track = waterTrackOf(route);
  if (!track) return [];
  const c = TRACK_COUNTRIES[track];
  return c ? [...c.pre, ...c.post] : [];
}

/* etapy przed promem — drogi przed przeprawą (LT, LV, EE) jeszcze przed transportem */
const BEFORE_FERRY: ReadonlySet<StageTile> = new Set(['PREP', 'LOADING', 'ROAD_PL', 'PORT_PL']);
/* do dostawy — drogi po przeprawie (FI) jeszcze przed transportem */
const BEFORE_SITE: ReadonlySet<StageTile> = new Set(['PREP', 'LOADING', 'ROAD_PL', 'PORT_PL', 'FERRY', 'PORT_SE', 'ROAD_SE', 'SITE']);

export type RoadLoad = Pick<Load, 'sailingId' | 'status' | 'stage' | 'plannedLoadDate'>;

/**
 * Kraje, przez które jedzie aktywny transport (w oknie śledzenia, jak Mapa i Kokpit) i których drogi ma jeszcze przed sobą:
 * kraje przed promem — do etapu „port wyjścia”; kraje po promie — do dostawy.
 */
export function balticCountriesOfLoads(
  loads: readonly RoadLoad[],
  sailings: readonly Pick<Sailing, 'id' | 'route'>[],
  nowIso: string,
): Set<BalticRoadCountry> {
  const byId = new Map(sailings.map((s) => [s.id, s]));
  const out = new Set<BalticRoadCountry>();
  for (const l of loads) {
    const s = l.sailingId ? byId.get(l.sailingId) : undefined;
    if (!s || trackingPhase(l, nowIso) !== 'on') continue;
    const track = waterTrackOf(s.route);
    const c = track ? TRACK_COUNTRIES[track] : null;
    const tile = stageTileOf(l);
    if (!c || !tile) continue;
    if (BEFORE_FERRY.has(tile)) c.pre.forEach((k) => out.add(k));
    if (BEFORE_SITE.has(tile)) c.post.forEach((k) => out.add(k));
  }
  return out;
}

/** Kraje z rodzin tras (demo: przykładowa trasa transportu z `p6Source`). */
export function balticCountriesOfRoutes(routes: readonly string[]): Set<BalticRoadCountry> {
  return new Set(routes.flatMap((r) => balticCountriesOfRoute(r)));
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

export type RoadLimit = 'WEIGHT' | 'HEIGHT' | 'WIDTH';

export interface BalticRoadRow {
  id: string;
  country: BalticRoadCountry;
  impact: RoadImpact;
  /** klucz tytułu BN6 (zdarzenie / limit masy) */
  titleKey: string | null;
  /** nazwa zdarzenia ze źródła (`params.event`), gdy jest */
  event: string | null;
  /** tytuł z bazy (zapas, gdy brak klucza) */
  title: string;
  /** opis ze źródła (`detail.opis`) */
  note: string | null;
  from: string | null;
  to: string | null;
  source: string | null;
  /** ograniczenie masy/wysokości/szerokości — wyróżnione z dopiskiem „sprawdź zezwolenie / trasę” */
  limit: RoadLimit | null;
  limitValue: number | null;
  /** masa ładunku z ryzyka (`params.load`, tylko gdy baza ją podała) */
  loadT: number | null;
}

const IMPACT_RANK: Record<RoadImpact, number> = { VERY_HIGH: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };

export function balticRoadRow(r: Risk): BalticRoadRow | null {
  const country = balticCountryOf(r);
  if (!country) return null;
  const p = r.titleParams ?? {};
  const info = r.road;
  const weightKey = r.titleKey === KEY_WEIGHT || r.titleKey === KEY_WEIGHT_CHECK;
  const weight = num(p.limit) ?? info?.weightLimitT ?? null;
  const limit: RoadLimit | null = weightKey || info?.weightLimitT != null ? 'WEIGHT'
    : info?.heightLimitM != null ? 'HEIGHT' : info?.widthLimitM != null ? 'WIDTH' : null;
  return {
    id: r.id, country, impact: impactOf(r.severity), titleKey: r.titleKey ?? null, event: str(p.event), title: r.title,
    note: str(r.detail), from: info?.from ?? null, to: info?.to ?? null, source: info?.source ?? null,
    limit,
    limitValue: limit === 'WEIGHT' ? weight : limit === 'HEIGHT' ? info?.heightLimitM ?? null : limit === 'WIDTH' ? info?.widthLimitM ?? null : null,
    loadT: r.titleKey === KEY_WEIGHT ? num(p.load) : null,
  };
}

export interface BalticRoadSection {
  country: BalticRoadCountry;
  rows: BalticRoadRow[];
  /** atrybucje z `detail.zrodlo` bez powtórzeń; brak — pusta lista (bez wpisanych na sztywno źródeł) */
  sources: string[];
  /** czy aktywny transport jedzie przez ten kraj */
  onRoute: boolean;
}

/** Najpierw większy wpływ, potem ograniczenia (masa/wymiary), potem kolejność id. */
export function sortBalticRows(rows: readonly BalticRoadRow[]): BalticRoadRow[] {
  return [...rows].sort((a, b) => IMPACT_RANK[b.impact] - IMPACT_RANK[a.impact] || Number(!!b.limit) - Number(!!a.limit) || a.id.localeCompare(b.id));
}

/**
 * Sekcje „Drogi LT / LV / EE / FI”. Bez aktywnych transportów bałtyckich — pusta lista (wygląd jak dotąd).
 * Z transportem: kraj na trasie (wiersze albo „brak utrudnień na korytarzu”) i kraj z ryzykami poza trasą; reszta ukryta.
 */
export function balticRoadSections(risks: readonly Risk[], onRoute: ReadonlySet<BalticRoadCountry>): BalticRoadSection[] {
  if (onRoute.size === 0) return [];
  const rows = risks.filter((r) => !r.loadId).map(balticRoadRow).filter((x): x is BalticRoadRow => !!x);
  return BALTIC_ROAD_COUNTRIES
    .map((country) => {
      const list = sortBalticRows(rows.filter((r) => r.country === country));
      return { country, rows: list, sources: [...new Set(list.map((r) => r.source).filter((s): s is string => !!s))], onRoute: onRoute.has(country) };
    })
    .filter((s) => s.onRoute || s.rows.length > 0);
}

/**
 * Atrybucja na ekranie (przegląd #728, strażnik E21): zapis źródła z bazy po polsku i w formie licencji „CC BY 4.0”
 * („Source: …, license CC 4.0 BY” → „Źródło: …, licencja CC BY 4.0”; EN: „Source: …, licence CC BY 4.0”).
 * Nazwy źródła bez zmian — tylko słowa „Source/license” i kolejność „CC 4.0 BY”.
 */
export function attributionView(src: string, locale: 'pl' | 'en' | string = 'pl'): string {
  const en = locale === 'en';
  return src.trim()
    .replace(/^(?:source|źródło)\s*:\s*/i, en ? 'Source: ' : 'Źródło: ')
    .replace(/\blicen[cs]e\b/gi, en ? 'licence' : 'licencja')
    .replace(/\bCC (\d\.\d) BY\b/g, 'CC BY $1');
}
