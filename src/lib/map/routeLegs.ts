/**
 * BN9-c5 (#718 BN7 §4) — które linie tras rysuje która mapa. Czysty moduł (bez Leaflet), testowany bez przeglądarki.
 *
 * - Karta transportu (Przegląd w panelu): legi drogowe rodziny trasy transportu (`ferry_routes.road_corridor_pre/post`
 *   z `map_display_state.route_legs`) i tor wodny tej trasy (`extraWaterTracksFor([route])`). GDY-KAA: przy `SE-KAA`
 *   także `SE-KAA-INLAND` (decyzja 36 — jedno pole w bazie, reguła tutaj). Trasa nieznana (bez rejsu i statku) — rdzeń
 *   Polska–Szwecja jak dotąd.
 * - Mapa i Kokpit: rdzeń Polska–Szwecja (jak dotąd) i korytarze tras, którymi jadą aktywne transporty (okno śledzenia).
 *   Tory bałtyckie i legi BN7 tylko wtedy, gdy jedzie nimi aktywny transport.
 * - Inne mapy (strefy, edytor strefy): sam rdzeń — bez legów BN7 i torów bałtyckich.
 * - Trasy powrotne: bez linii (Q-18 — powroty ukryte, `isOutbound`).
 */
import { isOutbound, waterTrackOf, type WaterTrackId } from '../ferryCatalog';
import { routeOfVessel, type VesselGroup } from '../vesselGroups';
import type { LatLng } from './draw';

/** Legi BN7 (0355/0381, `map_group='bn7'`). */
export const BN7_LEGS: ReadonlySet<string> = new Set(['PL-TLL', 'PL-MUU', 'PL-PLD', 'FI-HEL', 'FI-VUO', 'SE-STO', 'SE-KPS']);

/** Tory rdzenia Polska–Szwecja (rysowane jak dotąd na Mapie, w Kokpicie i na mapach stref). */
export const CORE_TRACKS: readonly WaterTrackId[] = ['GDN-NYN', 'GDY-KAA'];

/** Wiersz `map_display_state.route_legs` (0381). */
export type RouteLegRow = { route: string; pre: string | null; post: string | null };

/**
 * Zapas, gdy stan mapy nie ma jeszcze `route_legs` (stary cache) albo trasy w nim nie ma (np. TLLA-HEL): te same pary
 * co 0381, po rodzinie toru wodnego.
 */
export const ROUTE_LEGS_FALLBACK: Readonly<Record<WaterTrackId, { pre: string; post: string }>> = {
  'GDN-NYN': { pre: 'PL-GDN', post: 'SE-NYN' },
  'GDY-KAA': { pre: 'PL-GDY', post: 'SE-KAA' },
  'TLL-HEL': { pre: 'PL-TLL', post: 'FI-HEL' },
  'MUU-VUO': { pre: 'PL-MUU', post: 'FI-VUO' },
  'TLL-STO': { pre: 'PL-TLL', post: 'SE-STO' },
  'PLD-KPS': { pre: 'PL-PLD', post: 'SE-KPS' },
};

/** Decyzja 36: przy `SE-KAA` rysujemy też odcinek śródlądowy (osobny leg, jedno pole w bazie). */
const WITH_LEG: Readonly<Record<string, readonly string[]>> = { 'SE-KAA': ['SE-KAA-INLAND'] };

/** Legi drogowe trasy (kolejność: przed promem, po promie, dopiski). Trasa powrotna albo nieznana — pusto (Q-18). */
export function legsOfRoute(route: string | null | undefined, routeLegs: readonly RouteLegRow[] = []): string[] {
  if (!route || !isOutbound(route)) return [];
  const row = routeLegs.find((r) => r.route === route);
  const track = waterTrackOf(route);
  const fb = track ? ROUTE_LEGS_FALLBACK[track] : undefined;
  const pre = row ? row.pre : fb?.pre ?? null;
  const post = row ? row.post : fb?.post ?? null;
  const out: string[] = [];
  for (const leg of [pre, post]) {
    if (!leg || out.includes(leg)) continue;
    out.push(leg);
    for (const extra of WITH_LEG[leg] ?? []) if (!out.includes(extra)) out.push(extra);
  }
  return out;
}

/** Co rysuje mapa: legi drogowe, tory wodne; `baltic` — jest linia Korytarza bałtyckiego (dopisek, kadr). */
export type CorridorScope = {
  legs: ReadonlySet<string>;
  tracks: ReadonlySet<WaterTrackId>;
  baltic: boolean;
  /** Stały klucz (zależność efektów rysowania). */
  key: string;
};

function scopeOf(legs: Iterable<string>, tracks: Iterable<WaterTrackId>): CorridorScope {
  const l = new Set(legs);
  const t = new Set(tracks);
  const baltic = [...t].some((x) => !CORE_TRACKS.includes(x));
  return { legs: l, tracks: t, baltic, key: `${[...l].sort().join(',')}|${[...t].sort().join(',')}` };
}

/** Rdzeń Polska–Szwecja: legi obu tras rdzenia (z dopiskiem śródlądowym) i oba tory. */
export function baselineScope(routeLegs: readonly RouteLegRow[] = []): CorridorScope {
  return scopeOf(CORE_TRACKS.flatMap((r) => legsOfRoute(r, routeLegs)), CORE_TRACKS);
}

/**
 * Zakres linii dla tras. `baseline` — rdzeń zawsze (Mapa, Kokpit, mapy stref); bez rdzenia (karta transportu) — tylko
 * trasy z listy, a gdy żadna nie jest znana — rdzeń (dzisiejszy rysunek).
 */
export function corridorScope(
  routes: Iterable<string | null | undefined>,
  routeLegs: readonly RouteLegRow[] = [],
  baseline = true,
): CorridorScope {
  const legs: string[] = [];
  const tracks: WaterTrackId[] = [];
  for (const route of routes) {
    if (!route || !isOutbound(route)) continue;
    const track = waterTrackOf(route);
    if (!track) continue;
    legs.push(...legsOfRoute(route, routeLegs));
    tracks.push(track);
  }
  if (baseline || tracks.length === 0) {
    const core = baselineScope(routeLegs);
    legs.push(...core.legs);
    tracks.push(...core.tracks);
  }
  return scopeOf(legs, tracks);
}

/** Legi z liniami ograniczone do zakresu (kolejność wejścia; ta sama linia raz — demo: PL-GDN i PL-GDY). */
export function linesInScope<T extends { leg: string; line: readonly LatLng[] }>(legs: readonly T[], scope: CorridorScope): T[] {
  const seen = new Set<readonly LatLng[]>();
  const out: T[] = [];
  for (const l of legs) {
    if (!scope.legs.has(l.leg) || seen.has(l.line)) continue;
    seen.add(l.line);
    out.push(l);
  }
  return out;
}

/** Mapy bez transportu (strefy, edytor strefy): bez legów BN7 (nawet gdy serwer je poda po `cron_fetch`). */
export function coreLegsOnly<T extends { leg: string }>(legs: readonly T[]): T[] {
  return legs.filter((l) => !BN7_LEGS.has(l.leg));
}

/* ---------- trasa transportu ---------- */

type SailingLike = { id: string; vessel: string; route: string; departureAt: string };
type LoadLike = { code?: string; sailingId?: string | null; ferry: { vessel: string | null; departureAt: string | null } };

/**
 * Trasa promu transportu: rejs przypisany (`sailing_id`), rejs tego statku o tej godzinie, trasa armatora statku
 * (Polferries, Stena — jedna trasa wyjazdowa); inaczej null (bez zgadywania).
 * `override` — demo: trasa przykładowa po kodzie transportu (`demoRouteOverrides`), nigdy w produkcji.
 */
export function routeOfLoad(
  l: LoadLike | null | undefined,
  sailings: readonly SailingLike[],
  vessels?: readonly VesselGroup[],
  override?: ReadonlyMap<string, string>,
): string | null {
  if (!l) return null;
  const o = l.code ? override?.get(l.code) : undefined;
  if (o) return o;
  if (l.sailingId) {
    const s = sailings.find((x) => x.id === l.sailingId);
    if (s?.route) return s.route;
  }
  const v = l.ferry.vessel;
  if (!v) return null;
  const same = sailings.find((x) => x.vessel === v && !!l.ferry.departureAt && x.departureAt === l.ferry.departureAt);
  if (same?.route) return same.route;
  return routeOfVessel(v, vessels);
}

/**
 * Demo (migawki BN9-c5): `demoRoute=SG-11:TLL-HEL,SG-17:TLL-HEL` w adresie (jak `now=`) — przykładowa trasa bałtycka
 * dla transportów demo, bez zmiany danych demo. Wołający pilnuje, żeby nie działało w produkcji.
 */
export function demoRouteOverrides(href: string | null | undefined): Map<string, string> {
  const out = new Map<string, string>();
  if (!href) return out;
  const parts: string[] = [];
  const q1 = href.indexOf('?');
  if (q1 >= 0) parts.push(href.slice(q1 + 1));
  const hash = href.indexOf('#');
  if (hash >= 0) {
    const h = href.slice(hash);
    const q2 = h.indexOf('?');
    if (q2 >= 0) parts.push(h.slice(q2 + 1));
  }
  for (const p of parts) {
    let raw: string | null = null;
    try { raw = new URLSearchParams(p.split('#')[0]).get('demoRoute'); } catch { raw = null; }
    if (!raw) continue;
    for (const pair of raw.split(',')) {
      const [code, route] = pair.split(':').map((x) => x.trim());
      if (code && route && /^[A-Z]{3,4}-[A-Z]{3,4}$/.test(route)) out.set(code, route);
    }
  }
  return out;
}

/**
 * Demo: trasy z adresu czytane raz na sesję (adres zmienia się przy nawigacji, jak `now=` w `frozenNow`).
 * `enabled` = false (produkcja) — zawsze pusto.
 */
let demoRoutesCache: ReadonlyMap<string, string> | null = null;
const NO_ROUTES: ReadonlyMap<string, string> = new Map();
export function sessionDemoRoutes(enabled: boolean): ReadonlyMap<string, string> {
  if (!enabled) return NO_ROUTES;
  if (!demoRoutesCache) demoRoutesCache = typeof window === 'undefined' ? new Map() : demoRouteOverrides(window.location.href);
  return demoRoutesCache;
}
/** Tylko testy. */
export function __resetDemoRoutesForTests(): void {
  demoRoutesCache = null;
}

/* ---------- kadr ---------- */

/** Odcinek polski legów bałtyckich (via BN7 §2: Białystok, Suwałki, Kowno, Bauska, Ainaži, Parnawa). */
const VIA_PL_EE: readonly LatLng[] = [[53.13, 23.16], [54.1, 22.93], [54.9, 23.9], [56.41, 24.19], [57.87, 24.36], [58.39, 24.5]];
/** FI: Jyväskylä, Oulu, Tornio, Kalix. */
const VIA_FI: readonly LatLng[] = [[62.24, 25.75], [65.01, 25.47], [65.85, 24.15], [65.85, 23.15]];
/** SE: Uppsala, Gävle, Sundsvall, Umeå (KPS przez Norrtälje). */
const VIA_SE: readonly LatLng[] = [[59.86, 17.64], [60.67, 17.14], [62.39, 17.31], [63.83, 20.26]];

/**
 * Punkty kadru rodzin bałtyckich (decyzja BN7 §4 pkt 7: kadr z narysowanych linii plus zapas) — punkty via legów;
 * tory wodne dokłada `corridorBoundsOf`. Rdzeń — pusto (kadr bez zmian).
 */
export const FAMILY_EXTENT: Readonly<Partial<Record<WaterTrackId, readonly LatLng[]>>> = {
  'TLL-HEL': [...VIA_PL_EE, ...VIA_FI],
  'MUU-VUO': [...VIA_PL_EE, ...VIA_FI],
  'TLL-STO': [...VIA_PL_EE, ...VIA_SE],
  'PLD-KPS': [...VIA_PL_EE, [59.76, 18.7], ...VIA_SE],
};
