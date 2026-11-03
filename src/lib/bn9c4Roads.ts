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
 * DP-189 (#757): sekcje LT/LV/EE/FI zawsze widoczne (jak Drogi SE) — także bez transportu bałtyckiego.
 * `onRoute` = oznaczenie kraju na trasie aktywnego transportu i kolejność sekcji (te kraje wyżej), nie filtr.
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
  /** BN9-c4b: tekst ze źródła w języku kraju (podgląd „Pokaż oryginał”, jak Drogi SE); brak — null */
  original: string | null;
  /** BN9-c4b: tłumaczenie opisu w toku — zamiast opisu „Tłumaczenie w toku” (jak Drogi SE) */
  pending: boolean;
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
    note: info?.pending ? null : str(r.detail), from: info?.from ?? null, to: info?.to ?? null, source: info?.source ?? null,
    limit,
    limitValue: limit === 'WEIGHT' ? weight : limit === 'HEIGHT' ? info?.heightLimitM ?? null : limit === 'WIDTH' ? info?.widthLimitM ?? null : null,
    loadT: r.titleKey === KEY_WEIGHT ? num(p.load) : null,
    original: info?.original ?? null, pending: info?.pending === true,
  };
}

/** Wiersz `corridor_conditions` źródła drogowego kraju (BN6: `ROAD_LT` … `ROAD_FI`). */
export interface BalticCorridorRow {
  corridor: 'ROAD_LT' | 'ROAD_LV' | 'ROAD_EE' | 'ROAD_FI';
  observedAt: string | null;
  slowdownMult: number;
  reason: string | null;
}

/** Świeży odczyt źródła: `observed_at` nie starszy niż 60 min (decyzja A, F7 r1 #728). */
export const SOURCE_FRESH_MIN = 60;
/**
 * Stan źródła kraju: FRESH — odczyt ≤ 60 min („Brak utrudnień na korytarzu”); STALE — starszy odczyt („Brak świeżych danych”);
 * NONE — brak wiersza („Źródło jeszcze niepodłączone”); UNKNOWN — błąd odczytu (null).
 */
export type SourceState = 'FRESH' | 'STALE' | 'NONE' | 'UNKNOWN';
export function sourceStateOf(row: BalticCorridorRow | undefined, rowsLoaded: boolean, nowIso: string): SourceState {
  if (!rowsLoaded) return 'UNKNOWN';
  if (!row || !row.observedAt) return 'NONE';
  const age = Date.parse(nowIso) - Date.parse(row.observedAt);
  return Number.isFinite(age) && age <= SOURCE_FRESH_MIN * 60_000 ? 'FRESH' : 'STALE';
}

export interface BalticRoadSection {
  country: BalticRoadCountry;
  rows: BalticRoadRow[];
  /** atrybucje z `detail.zrodlo` bez powtórzeń; brak — pusta lista (bez wpisanych na sztywno źródeł) */
  sources: string[];
  /** czy aktywny transport jedzie przez ten kraj */
  onRoute: boolean;
  source: SourceState;
  /** ostatni odczyt źródła (`corridor_conditions.observed_at`) */
  observedAt: string | null;
  /** spowolnienie korytarza w procentach (slowdown_mult > 1), inaczej null */
  slowdownPct: number | null;
}

const ts = (v: string | null) => (v ? Date.parse(v) : NaN);
/* rosnąco, brak wartości na końcu */
const byTime = (a: string | null, b: string | null) => {
  const x = ts(a);
  const y = ts(b);
  if (Number.isFinite(x) && Number.isFinite(y)) return x - y;
  return Number.isFinite(x) ? -1 : Number.isFinite(y) ? 1 : 0;
};

/* BN9-c4b: 0 — trwa (początek ≤ teraz), 1 — zaplanowane, 2 — bez początku */
const phaseOf = (r: BalticRoadRow, now: number) => {
  const f = ts(r.from);
  return !Number.isFinite(f) ? 2 : f <= now ? 0 : 1;
};

/**
 * Najpierw większy wpływ. Przy równym wpływie (BN9-c4b, decyzja 89 — „najważniejsze i najświeższe”, gdy podano `nowIso`):
 * najpierw trwające, od najświeższego początku; potem zaplanowane, od najbliższego; na końcu bez początku; dalej `to`, id.
 * Bez `nowIso` — jak w BN9-c4: `from` rosnąco (brak na końcu), potem `to`, id.
 */
export function sortBalticRows(rows: readonly BalticRoadRow[], nowIso?: string): BalticRoadRow[] {
  const now = nowIso ? Date.parse(nowIso) : NaN;
  if (!Number.isFinite(now)) {
    return [...rows].sort((a, b) => IMPACT_RANK[b.impact] - IMPACT_RANK[a.impact] || byTime(a.from, b.from) || byTime(a.to, b.to) || a.id.localeCompare(b.id));
  }
  return [...rows].sort((a, b) => {
    const pa = phaseOf(a, now);
    const pb = phaseOf(b, now);
    return IMPACT_RANK[b.impact] - IMPACT_RANK[a.impact] || pa - pb
      || (pa === 0 ? byTime(b.from, a.from) : byTime(a.from, b.from)) || byTime(a.to, b.to) || a.id.localeCompare(b.id);
  });
}

/**
 * Sekcje „Drogi LT / LV / EE / FI” (DP-189 / #757): zawsze cztery kraje (jak Drogi SE).
 * Wszystkie ryzyka kraju w sekcji; bez wierszy — stan źródła. `onRoute` tylko do oznaczenia i kolejności
 * (kraje z aktywnym transportem bałtyckim wyżej; w grupie — kolejność makiety LT→LV→EE→FI).
 */
export function balticRoadSections(
  risks: readonly Risk[],
  onRoute: ReadonlySet<BalticRoadCountry>,
  corridors: readonly BalticCorridorRow[] | null = null,
  nowIso: string = new Date().toISOString(),
): BalticRoadSection[] {
  const all = risks.map((r) => ({ r, row: balticRoadRow(r) })).filter((x): x is { r: Risk; row: BalticRoadRow } => !!x.row);
  const rank = new Map(BALTIC_ROAD_COUNTRIES.map((c, i) => [c, i]));
  return BALTIC_ROAD_COUNTRIES
    .map((country): BalticRoadSection => {
      const on = onRoute.has(country);
      const list = sortBalticRows(all.filter((x) => x.row.country === country).map((x) => x.row), nowIso);
      const c = corridors?.find((k) => k.corridor === `ROAD_${country}`);
      const state = sourceStateOf(c, corridors != null, nowIso);
      return {
        country, rows: list, sources: [...new Set(list.map((r) => r.source).filter((s): s is string => !!s))], onRoute: on,
        source: state, observedAt: c?.observedAt ?? null,
        slowdownPct: c && c.slowdownMult > 1 ? Math.round((c.slowdownMult - 1) * 100) : null,
      };
    })
    .sort((a, b) => Number(b.onRoute) - Number(a.onRoute) || (rank.get(a.country)! - rank.get(b.country)!));
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
